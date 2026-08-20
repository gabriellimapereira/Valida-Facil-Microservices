"""
Fixtures compartilhadas pelos testes.

A peça central aqui é o FakeSupabaseClient: um "dublê" que imita o
suficiente da API do supabase-py (table().select().eq().execute(), rpc(),
etc.) pra que os services e as rotas rodem exatamente como rodariam com um
Supabase de verdade — sem precisar de rede, banco ou credenciais. Isso é o
que permite testar toda a lógica de negócio isoladamente.
"""
import os
import sys
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
    """Simula o encadeamento do supabase-py. Guarda as linhas de uma
    tabela e só aplica os filtros de fato na hora do .execute()."""

    def __init__(self, rows):
        self._rows = list(rows)
        self._filters = []
        self._mode = "select"  # select | single | maybe_single

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

    # -- escrita (guardadas só pra inspeção, se o teste precisar) -------
    def insert(self, payload):
        self._rows.append(payload)
        return self

    def update(self, payload):
        for row in self._rows:
            row.update(payload)
        return self

    def delete(self):
        self._rows = []
        return self

    def execute(self):
        rows = [r for r in self._rows if all(f(r) for f in self._filters)]
        if self._mode in ("single", "maybe_single"):
            return FakeResult(rows[0] if rows else None)
        return FakeResult(rows)


class _RpcCall:
    def __init__(self, data):
        self._data = data

    def execute(self):
        return FakeResult(self._data)


class FakeSupabaseClient:
    """Dublê do client supabase-py. `tables` é um dict {nome: [linhas]};
    `rpc_results` é um dict {nome_da_funcao: retorno_simulado}."""

    def __init__(self, tables=None, rpc_results=None):
        self.tables = {k: list(v) for k, v in (tables or {}).items()}
        self.rpc_results = rpc_results or {}
        self.rpc_calls = []

    def table(self, name):
        return FakeQuery(self.tables.get(name, []))

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
