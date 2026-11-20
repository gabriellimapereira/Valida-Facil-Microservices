"""
Camada de acesso a banco de dados relacional (PostgreSQL) dedicada por microsserviço.
Implementa o padrão Database-per-Service com alta coesão e zero acoplamento físico.
Compatível com a interface fluente (table, select, insert, update, delete, rpc).
"""

from contextlib import contextmanager
import contextvars
import logging
import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Union

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from shared.config import settings

logger = logging.getLogger("valida_facil.database")


class DbResult:
    def __init__(self, data: Any = None, count: Optional[int] = None):
        self.data = data
        self.count = count

    def __repr__(self) -> str:
        return f"DbResult(data={self.data!r}, count={self.count})"


class TableQuery:
    def __init__(self, client: "DatabaseClient", table_name: str):
        self.client = client
        self.table_name = table_name
        self.action = "select"  # select, insert, update, upsert, delete
        self.columns = "*"
        self.filters: List[tuple[str, str, Any]] = []
        self.order_by: Optional[str] = None
        self.order_desc: bool = False
        self.limit_val: Optional[int] = None
        self.offset_val: Optional[int] = None
        self.is_single: bool = False
        self.is_maybe_single: bool = False
        self.payload: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None
        self.on_conflict: Optional[str] = None

    def select(self, columns: str = "*") -> "TableQuery":
        self.action = "select"
        self.columns = columns
        return self

    def insert(self, data: Union[Dict[str, Any], List[Dict[str, Any]]]) -> "TableQuery":
        self.action = "insert"
        self.payload = data
        return self

    def upsert(
        self,
        data: Union[Dict[str, Any], List[Dict[str, Any]]],
        on_conflict: Optional[str] = None,
    ) -> "TableQuery":
        self.action = "upsert"
        self.payload = data
        self.on_conflict = on_conflict
        return self

    def update(self, data: Dict[str, Any]) -> "TableQuery":
        self.action = "update"
        self.payload = data
        return self

    def delete(self) -> "TableQuery":
        self.action = "delete"
        return self

    def eq(self, column: str, value: Any) -> "TableQuery":
        self.filters.append((column, "=", value))
        return self

    def neq(self, column: str, value: Any) -> "TableQuery":
        self.filters.append((column, "<>", value))
        return self

    def in_(self, column: str, values: List[Any]) -> "TableQuery":
        self.filters.append((column, "IN", values))
        return self

    def order(
        self, column: str, desc: bool = False, ascending: Optional[bool] = None
    ) -> "TableQuery":
        if ascending is not None:
            desc = not ascending
        self.order_by = column
        self.order_desc = desc
        return self

    def limit(self, count: int) -> "TableQuery":
        self.limit_val = count
        return self

    def offset(self, count: int) -> "TableQuery":
        self.offset_val = count
        return self

    def single(self) -> "TableQuery":
        self.is_single = True
        return self

    def maybe_single(self) -> "TableQuery":
        self.is_maybe_single = True
        return self

    def _build_where(self) -> tuple[str, List[Any]]:
        if not self.filters:
            return "", []
        clauses = []
        params = []
        for col, op, val in self.filters:
            if op == "IN":
                if not val:
                    clauses.append("1=0")
                else:
                    placeholders = ", ".join(["%s"] * len(val))
                    clauses.append(f'"{col}" IN ({placeholders})')
                    params.extend(val)
            else:
                clauses.append(f'"{col}" {op} %s')
                params.append(val)
        return " WHERE " + " AND ".join(clauses), params

    def execute(self) -> Optional[DbResult]:
        return self.client._execute_table_query(self)


class RpcQuery:
    def __init__(
        self,
        client: "DatabaseClient",
        fn_name: str,
        params: Optional[Dict[str, Any]] = None,
    ):
        self.client = client
        self.fn_name = fn_name
        self.params = params or {}

    def execute(self) -> DbResult:
        return self.client._execute_rpc(self.fn_name, self.params)


class DatabaseClient:
    """Client PostgreSQL direto para um microsserviço isolado."""

    def __init__(self, database_url: str):
        self.database_url = database_url

    def table(self, table_name: str) -> TableQuery:
        return TableQuery(self, table_name)

    def from_(self, table_name: str) -> TableQuery:
        return self.table(table_name)

    def rpc(self, fn_name: str, params: Optional[Dict[str, Any]] = None) -> RpcQuery:
        return RpcQuery(self, fn_name, params)

    @contextmanager
    def get_connection(self):
        """Abre conexão com o PostgreSQL gerenciando transação e fechando o socket ao final."""
        conn = psycopg.connect(self.database_url, row_factory=dict_row)
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def check_health(self) -> bool:
        """Verifica a conectividade ativa com a instância PostgreSQL dedicada."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT 1 AS alive")
                    row = cur.fetchone()
                    return bool(row and row.get("alive") == 1)
        except Exception as exc:
            logger.warning("Falha no healthcheck do banco de dados: %s", exc)
            return False

    def _format_columns_select(self, columns: str) -> str:
        """Formata projeção de colunas para SQL mantendo identificadores seguros."""
        if not columns or columns == "*":
            return "*"
        parts = [p.strip() for p in columns.split(",") if p.strip()]
        formatted = []
        for p in parts:
            if "(" in p or " as " in p.lower() or " " in p or '"' in p:
                formatted.append(p)
            else:
                formatted.append(f'"{p}"')
        return ", ".join(formatted)

    @staticmethod
    def _serialize_row(r: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not r:
            return r
        out = {}
        for k, v in r.items():
            if isinstance(v, uuid.UUID):
                out[k] = str(v)
            elif isinstance(v, (datetime, date)):
                out[k] = v.isoformat()
            else:
                out[k] = v
        return out

    def _execute_table_query(self, q: TableQuery) -> Optional[DbResult]:
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                if q.action == "select":
                    cols = self._format_columns_select(q.columns)
                    where_sql, params = q._build_where()
                    sql = f'SELECT {cols} FROM "{q.table_name}"{where_sql}'
                    if q.order_by:
                        direction = "DESC" if q.order_desc else "ASC"
                        sql += f' ORDER BY "{q.order_by}" {direction}'
                    if q.limit_val is not None:
                        sql += f" LIMIT {int(q.limit_val)}"
                    if q.offset_val is not None:
                        sql += f" OFFSET {int(q.offset_val)}"

                    cur.execute(sql, params)
                    rows = cur.fetchall()

                    if q.is_maybe_single:
                        if not rows:
                            return None
                        return DbResult(
                            data=self._serialize_row(dict(rows[0])), count=1
                        )
                    if q.is_single:
                        if not rows:
                            return DbResult(data=None, count=0)
                        return DbResult(
                            data=self._serialize_row(dict(rows[0])), count=1
                        )

                    return DbResult(
                        data=[self._serialize_row(dict(r)) for r in rows],
                        count=len(rows),
                    )

                elif q.action == "insert":
                    if not q.payload:
                        return DbResult(data=[], count=0)
                    items = [q.payload] if isinstance(q.payload, dict) else q.payload
                    results = []
                    for item in items:
                        keys = list(item.keys())
                        col_names = ", ".join([f'"{k}"' for k in keys])
                        placeholders = ", ".join(["%s"] * len(keys))
                        values = [
                            Jsonb(v) if isinstance(v, (dict, list)) else v
                            for v in item.values()
                        ]
                        sql = f'INSERT INTO "{q.table_name}" ({col_names}) VALUES ({placeholders}) RETURNING *'
                        cur.execute(sql, values)
                        res = cur.fetchone()
                        if res:
                            results.append(self._serialize_row(dict(res)))
                    conn.commit()
                    if q.is_single or q.is_maybe_single:
                        return DbResult(
                            data=results[0] if results else None, count=len(results)
                        )
                    return DbResult(data=results, count=len(results))

                elif q.action == "upsert":
                    if not q.payload:
                        return DbResult(data=[], count=0)
                    items = [q.payload] if isinstance(q.payload, dict) else q.payload
                    results = []
                    conflict_col = q.on_conflict or "id"
                    for item in items:
                        keys = list(item.keys())
                        col_names = ", ".join([f'"{k}"' for k in keys])
                        placeholders = ", ".join(["%s"] * len(keys))
                        update_clause = ", ".join(
                            [
                                f'"{k}" = EXCLUDED."{k}"'
                                for k in keys
                                if k != conflict_col
                            ]
                        )
                        values = [
                            Jsonb(v) if isinstance(v, (dict, list)) else v
                            for v in item.values()
                        ]
                        if update_clause:
                            sql = (
                                f'INSERT INTO "{q.table_name}" ({col_names}) VALUES ({placeholders}) '
                                f'ON CONFLICT ("{conflict_col}") DO UPDATE SET {update_clause} RETURNING *'
                            )
                        else:
                            sql = (
                                f'INSERT INTO "{q.table_name}" ({col_names}) VALUES ({placeholders}) '
                                f'ON CONFLICT ("{conflict_col}") DO NOTHING RETURNING *'
                            )
                        cur.execute(sql, values)
                        res = cur.fetchone()
                        if res:
                            results.append(self._serialize_row(dict(res)))
                    conn.commit()
                    if q.is_single or q.is_maybe_single:
                        return DbResult(
                            data=results[0] if results else None, count=len(results)
                        )
                    return DbResult(data=results, count=len(results))

                elif q.action == "update":
                    if not q.payload:
                        return DbResult(data=None, count=0)
                    where_sql, params = q._build_where()
                    set_clauses = []
                    update_values = []
                    for k, v in q.payload.items():
                        set_clauses.append(f'"{k}" = %s')
                        update_values.append(
                            Jsonb(v) if isinstance(v, (dict, list)) else v
                        )
                    all_params = update_values + params
                    sql = f'UPDATE "{q.table_name}" SET {", ".join(set_clauses)}{where_sql} RETURNING *'
                    cur.execute(sql, all_params)
                    rows = cur.fetchall()
                    conn.commit()
                    results = [self._serialize_row(dict(r)) for r in rows]
                    if q.is_maybe_single or q.is_single:
                        return DbResult(
                            data=results[0] if results else None, count=len(results)
                        )
                    return DbResult(data=results, count=len(results))

                elif q.action == "delete":
                    where_sql, params = q._build_where()
                    sql = f'DELETE FROM "{q.table_name}"{where_sql} RETURNING *'
                    cur.execute(sql, params)
                    rows = cur.fetchall()
                    conn.commit()
                    results = [self._serialize_row(dict(r)) for r in rows]
                    if q.is_maybe_single or q.is_single:
                        return DbResult(
                            data=results[0] if results else None, count=len(results)
                        )
                    return DbResult(data=results, count=len(results))

                return None

    def _execute_rpc(self, fn_name: str, params: Dict[str, Any]) -> DbResult:
        """Executa função SQL armazenada (stored procedure / RPC) com parâmetros nomeados."""
        with self.get_connection() as conn:
            with conn.cursor() as cur:
                arg_names = list(params.keys())
                placeholders = []
                values = []
                for k in arg_names:
                    placeholders.append(f'"{k}" := %s')
                    v = params[k]
                    values.append(Jsonb(v) if isinstance(v, (dict, list)) else v)

                args_sql = ", ".join(placeholders)
                sql = f"SELECT {fn_name}({args_sql}) AS result"
                cur.execute(sql, values)
                row = cur.fetchone()
                conn.commit()
                res = row["result"] if row else None
                return DbResult(data=res, count=1 if res is not None else 0)


_CLIENT_CACHE: Dict[str, DatabaseClient] = {}
_CURRENT_SERVICE_NAME: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "_CURRENT_SERVICE_NAME", default=None
)


def set_current_service_name(service_name: str) -> contextvars.Token:
    return _CURRENT_SERVICE_NAME.set(service_name)


def reset_current_service_name(token: contextvars.Token) -> None:
    _CURRENT_SERVICE_NAME.reset(token)


def get_current_service_name() -> Optional[str]:
    return _CURRENT_SERVICE_NAME.get()


def get_db(service_name: Optional[str] = None) -> Any:
    """
    Retorna o client do banco exclusivo do serviço informado.
    """
    requested_service = (
        service_name or _CURRENT_SERVICE_NAME.get() or settings.service_name
    )
    db_url = settings.database_url_for(requested_service)
    if not db_url:
        raise RuntimeError(
            f"Não há DATABASE_URL configurada para o microsserviço '{requested_service}'. "
            "Configure a URL exclusiva do serviço."
        )
    if db_url not in _CLIENT_CACHE:
        _CLIENT_CACHE[db_url] = DatabaseClient(db_url)
    return _CLIENT_CACHE[db_url]
