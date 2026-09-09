"""
Fixtures compartilhadas pelos testes.

A peça central aqui é o FakeSupabaseClient: um "dublê" que imita o
suficiente da API do supabase-py (table().select().eq().execute(), rpc(),
etc.) pra que os services e as rotas rodem exatamente como rodariam com um
Supabase de verdade — sem precisar de rede, banco ou credenciais. Isso é o
que permite testar toda a lógica de negócio isoladamente.
"""
import os
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Os testes nunca falam com um Supabase de verdade (tudo é fake_client),
# mas app/config.py exige essas variáveis pra sequer importar — preenche
# com valores "dummy" só pra satisfazer a validação, sem sobrescrever um
# .env real que porventura já esteja carregado no ambiente.
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")

import pytest
from fastapi.testclient import TestClient

from app.core.security import AuthedUser


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

    # -- filtros --------------------------------------------------------
    def select(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def eq(self, field, value):
        self._filters.append(lambda r: r.get(field) == value)
        return self

    def gte(self, field, value):
        self._filters.append(lambda r: r.get(field) is not None and r.get(field) >= value)
        return self

    def lte(self, field, value):
        self._filters.append(lambda r: r.get(field) is not None and r.get(field) <= value)
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

    # -- escrita ----------------------------------------------------------
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
                existing = next((r for r in self._rows if r.get("id") == key), None) if key else None
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

        if self._mode in ("single", "maybe_single"):
            return FakeResult(matched[0] if matched else None)
        return FakeResult(matched)


class _RpcCall:
    def __init__(self, data):
        self._data = data

    def execute(self):
        return FakeResult(self._data)


class FakeUser:
    """Simula o objeto `user` que supabase.auth.get_user() devolve."""

    def __init__(self, id, email):
        self.id = id
        self.email = email


class FakeAuthResponse:
    def __init__(self, user):
        self.user = user


class FakeAuth:
    """Simula client.auth — usado nos testes de app/core/security.py.
    `admin` pode ser atribuído depois (ex: pra testar convite de usuário)."""

    def __init__(self, user=None, raise_error=False):
        self._user = user
        self._raise_error = raise_error
        self.admin = None

    def get_user(self, _token):
        if self._raise_error:
            raise Exception("Token inválido ou expirado (simulado).")
        return FakeAuthResponse(self._user)


class FakeSupabaseClient:
    """Dublê do client supabase-py. `tables` é um dict {nome: [linhas]};
    `rpc_results` é um dict {nome_da_funcao: retorno_simulado}."""

    def __init__(self, tables=None, rpc_results=None, auth=None):
        self.tables = {k: list(v) for k, v in (tables or {}).items()}
        self.rpc_results = rpc_results or {}
        self.rpc_calls = []
        self.auth = auth or FakeAuth()

    def table(self, name):
        self.tables.setdefault(name, [])
        return FakeQuery(self.tables[name])

    def rpc(self, name, params):
        self.rpc_calls.append((name, params))
        if name not in self.rpc_results:
            raise AssertionError(f"Teste não configurou retorno para o RPC '{name}'.")
        return _RpcCall(self.rpc_results[name])


@pytest.fixture
def fake_client():
    """Client fake vazio — o teste popula `tables`/`rpc_results` conforme precisa."""
    return FakeSupabaseClient()


@pytest.fixture
def make_authed_user():
    def _make(client, company_id="company-1", role="admin", user_id="user-1"):
        return AuthedUser(
            id=user_id,
            email="teste@empresa.com",
            company_id=company_id,
            role=role,
            access_token="fake-token",
            client=client,
        )

    return _make


@pytest.fixture
def make_test_client():
    """Devolve uma função que cria um TestClient do FastAPI com as
    dependências de autenticação substituídas pelo usuário fake passado —
    assim testamos a rota de ponta a ponta sem precisar de um JWT real."""
    from app.core import security
    from app.main import app

    def _make(user=None, admin=None):
        if user is not None:
            app.dependency_overrides[security.get_current_user_with_company] = lambda: user
            app.dependency_overrides[security.get_current_user] = lambda: user
        if admin is not None:
            app.dependency_overrides[security.require_admin] = lambda: admin
        return TestClient(app)

    yield _make
    app.dependency_overrides.clear()
