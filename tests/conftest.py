"""
Fixtures compartilhadas pelos testes. O banco fake mantém dados separados
por serviço e evita depender de rede, PostgreSQL ou credenciais.
"""

import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
for _rel in ("", "api-gateway", "ms-identity", "ms-warehouse", "ms-stores"):
    _path = str(_REPO_ROOT / _rel) if _rel else str(_REPO_ROOT)
    if _path not in sys.path:
        sys.path.insert(0, _path)

import pytest
from fastapi.testclient import TestClient

from shared.database import get_current_service_name
from shared.security import AuthedUser


class FakeResult:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    """Simula o encadeamento do supabase-py. Guarda uma REFERÊNCIA à lista
    de linhas da "tabela" (não uma cópia) — assim insert/update/delete
    feitos numa chamada aparecem em chamadas seguintes a .table(), igual
    ao banco de verdade. Os filtros (.eq(), .gte()...) só são aplicados de
    fato no .execute(), na ordem em que o supabase-py normalmente recebe
    (ex: .update(payload).eq("id", x).execute() só atualiza quem bate com
    o filtro — uma versão anterior desse fake tinha esse bug)."""

    def __init__(self, rows):
        self._rows = rows
        self._filters = []
        self._mode = "select"  # select | single | maybe_single
        self._pending_insert = None
        self._pending_upsert = None
        self._pending_update = None
        self._pending_delete = False
        self._order_by = None
        self._order_desc = False
        self._limit = None

    def select(self, *_args, **_kwargs):
        return self

    def order(self, field, *_args, desc=False, **_kwargs):
        self._order_by = field
        self._order_desc = bool(desc)
        return self

    def limit(self, count):
        self._limit = int(count)
        return self

    def eq(self, field, value):
        self._filters.append(lambda r: r.get(field) == value)
        return self

    def neq(self, field, value):
        self._filters.append(lambda r: r.get(field) != value)
        return self

    def in_(self, field, values):
        allowed = set(values)
        self._filters.append(lambda r: r.get(field) in allowed)
        return self

    def gte(self, field, value):
        self._filters.append(
            lambda r: r.get(field) is not None and r.get(field) >= value
        )
        return self

    def lte(self, field, value):
        self._filters.append(
            lambda r: r.get(field) is not None and r.get(field) <= value
        )
        return self

    @property
    def not_(self):
        return self

    def is_(self, field, value):
        if value == "null":
            self._filters.append(lambda r: r.get(field) is not None)
        return self

    def single(self):
        self._mode = "single"
        return self

    def maybe_single(self):
        self._mode = "maybe_single"
        return self

    def insert(self, payload):
        self._pending_insert = payload if isinstance(payload, list) else [payload]
        return self

    def upsert(self, payload):
        self._pending_upsert = payload if isinstance(payload, list) else [payload]
        return self

    def update(self, payload):
        self._pending_update = payload
        return self

    def delete(self):
        self._pending_delete = True
        return self

    def execute(self):
        if self._pending_upsert is not None:
            upserted = []
            for item in self._pending_upsert:
                row = dict(item)
                key = row.get("id")
                existing = (
                    next((r for r in self._rows if r.get("id") == key), None)
                    if key
                    else None
                )
                if existing:
                    existing.update(row)
                    upserted.append(existing)
                else:
                    row.setdefault("id", str(uuid.uuid4()))
                    row.setdefault("created_at", datetime.now(timezone.utc).isoformat())
                    self._rows.append(row)
                    upserted.append(row)
            if self._mode in ("single", "maybe_single"):
                return FakeResult(upserted[0] if upserted else None)
            return FakeResult(upserted)

        if self._pending_insert is not None:
            inserted = []
            for item in self._pending_insert:
                row = dict(item)
                row.setdefault("id", str(uuid.uuid4()))
                row.setdefault("created_at", datetime.now(timezone.utc).isoformat())
                self._rows.append(row)
                inserted.append(row)
            if self._mode in ("single", "maybe_single"):
                return FakeResult(inserted[0] if inserted else None)
            return FakeResult(inserted)

        matched = [r for r in self._rows if all(f(r) for f in self._filters)]

        if self._pending_update is not None:
            for row in matched:
                row.update(self._pending_update)
            if self._mode in ("single", "maybe_single"):
                return FakeResult(matched[0] if matched else None)
            return FakeResult(matched)

        if self._pending_delete:
            for row in list(matched):
                self._rows.remove(row)
            return FakeResult(matched)

        if self._mode == "maybe_single":
            return FakeResult(matched[0]) if matched else None
        if self._mode == "single":
            return FakeResult(matched[0] if matched else None)
        if self._order_by:
            matched = sorted(
                matched,
                key=lambda r: (
                    r.get(self._order_by) is None,
                    str(r.get(self._order_by) or ""),
                ),
                reverse=self._order_desc,
            )
        if self._limit is not None:
            matched = matched[: self._limit]
        return FakeResult(matched)


class _RpcCall:
    def __init__(self, data):
        self._data = data

    def execute(self):
        return FakeResult(self._data)


class _FakeTables:
    _TABLE_OWNERS = {
        "companies": "identity",
        "profiles": "identity",
        "users": "identity",
        "stores": "stores",
        "store_inventory": "stores",
        "store_movements": "stores",
        "requisitions": "stores",
        "requisition_items": "stores",
        "categories": "warehouse",
        "products": "warehouse",
        "stock_movements": "warehouse",
        "warehouse_dispatches": "warehouse",
    }

    def __init__(self, client):
        self._client = client

    @staticmethod
    def _normalize_service(service_name):
        if not service_name:
            return None
        return service_name.removeprefix("ms-").lower()

    def _owner(self, table_name):
        return self._TABLE_OWNERS.get(
            table_name,
            self._normalize_service(get_current_service_name()) or "default",
        )

    def __getitem__(self, table_name):
        owner = self._owner(table_name)
        return self._client._tables_by_service.setdefault(owner, {}).setdefault(
            table_name, []
        )

    def __setitem__(self, table_name, rows):
        owner = self._owner(table_name)
        self._client._tables_by_service.setdefault(owner, {})[table_name] = list(rows)

    def get(self, table_name, default=None):
        owner = self._owner(table_name)
        return self._client._tables_by_service.setdefault(owner, {}).get(
            table_name, default
        )

    def setdefault(self, table_name, default=None):
        owner = self._owner(table_name)
        return self._client._tables_by_service.setdefault(owner, {}).setdefault(
            table_name, default
        )


class FakeDatabaseClient:
    """Cliente de banco fake com particionamento e isolamento por serviço."""

    def __init__(self, tables=None, rpc_results=None):
        self._tables_by_service = {}
        self.tables = _FakeTables(self)
        for table_name, rows in (tables or {}).items():
            self.tables[table_name] = rows
        self.rpc_results = rpc_results or {}
        self.rpc_calls = []

    def table(self, name):
        service = _FakeTables._normalize_service(get_current_service_name())
        owner = self._tables_owner(name)
        if service and owner != "default" and service != owner:
            raise AssertionError(
                f"O serviço '{service}' tentou acessar a tabela '{name}' do serviço '{owner}'."
            )
        table_service = owner if owner != "default" else (service or "default")
        tables = self._tables_by_service.setdefault(table_service, {})
        tables.setdefault(name, [])
        return FakeQuery(tables[name])

    @staticmethod
    def _tables_owner(name):
        return _FakeTables._TABLE_OWNERS.get(name, "default")

    def rpc(self, name, params):
        self.rpc_calls.append((name, params))
        if name not in self.rpc_results:
            raise AssertionError(f"Teste não configurou retorno para o RPC '{name}'.")
        return _RpcCall(self.rpc_results[name])


@pytest.fixture
def fake_client():
    """Client fake vazio — o teste popula `tables`/`rpc_results` conforme precisa."""
    return FakeDatabaseClient()


@pytest.fixture
def make_authed_user():
    def _make(
        client,
        company_id="company-1",
        role="admin",
        user_id="user-1",
        store_id=None,
        full_name=None,
    ):
        return AuthedUser(
            id=user_id,
            email="teste@empresa.com",
            company_id=company_id,
            role=role,
            access_token="fake-token",
            client=client,
            full_name=full_name,
            store_id=store_id,
        )

    return _make


@pytest.fixture
def make_test_client():
    """Devolve uma função que cria um TestClient do FastAPI com as
    dependências de autenticação substituídas pelo usuário fake passado —
    assim testamos a rota de ponta a ponta sem precisar de um JWT real."""
    from shared import security
    from gateway.main import app

    def _make(user=None, admin=None):
        if user is not None:
            app.dependency_overrides[security.get_current_user_with_company] = lambda: (
                user
            )
            app.dependency_overrides[security.get_current_user] = lambda: user
        if admin is not None:
            app.dependency_overrides[security.require_admin] = lambda: admin
        return TestClient(app)

    yield _make
    app.dependency_overrides.clear()
