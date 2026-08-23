"""
Testes unitários de app/core/security.py — a camada que decide quem pode
fazer o quê. É a parte de maior risco do backend: um bug aqui pode deixar
alguém acessar rota que não devia, então testamos cada bifurcação.
"""
import pytest
from fastapi import HTTPException

from app.core import security
from tests.conftest import FakeAuth, FakeUser


@pytest.fixture
def patch_client_for_token(monkeypatch):
    """security.py chama client_for_token(token) internamente — troca essa
    função pelo client fake que o teste já configurou."""

    def _patch(client):
        monkeypatch.setattr(security, "client_for_token", lambda _token: client)

    return _patch


class TestExtractBearerToken:
    def test_extrai_o_token_do_header(self):
        assert security._extract_bearer_token("Bearer abc123") == "abc123"

    def test_aceita_bearer_case_insensitive(self):
        assert security._extract_bearer_token("bearer abc123") == "abc123"

    def test_levanta_401_sem_header(self):
        with pytest.raises(HTTPException) as exc:
            security._extract_bearer_token(None)
        assert exc.value.status_code == 401

    def test_levanta_401_sem_prefixo_bearer(self):
        with pytest.raises(HTTPException) as exc:
            security._extract_bearer_token("abc123")
        assert exc.value.status_code == 401

    def test_levanta_401_com_header_vazio(self):
        with pytest.raises(HTTPException) as exc:
            security._extract_bearer_token("")
        assert exc.value.status_code == 401


class TestGetCurrentUser:
    async def test_carrega_usuario_e_perfil_com_sucesso(self, fake_client, patch_client_for_token):
        fake_client.auth = FakeAuth(user=FakeUser(id="user-1", email="a@empresa.com"))
        fake_client.tables["profiles"] = [
            {"id": "user-1", "company_id": "company-1", "role": "admin", "full_name": "Fulano"}
        ]
        patch_client_for_token(fake_client)

        user = await security.get_current_user("Bearer token-valido")

        assert user.id == "user-1"
        assert user.email == "a@empresa.com"
        assert user.company_id == "company-1"
        assert user.role == "admin"

    async def test_401_sem_header_de_autorizacao(self):
        with pytest.raises(HTTPException) as exc:
            await security.get_current_user(None)
        assert exc.value.status_code == 401

    async def test_401_quando_supabase_rejeita_o_token(self, fake_client, patch_client_for_token):
        fake_client.auth = FakeAuth(raise_error=True)
        patch_client_for_token(fake_client)

        with pytest.raises(HTTPException) as exc:
            await security.get_current_user("Bearer token-invalido")
        assert exc.value.status_code == 401

    async def test_401_quando_supabase_nao_retorna_usuario(self, fake_client, patch_client_for_token):
        fake_client.auth = FakeAuth(user=None)
        patch_client_for_token(fake_client)

        with pytest.raises(HTTPException) as exc:
            await security.get_current_user("Bearer token-sem-usuario")
        assert exc.value.status_code == 401

    async def test_company_id_none_quando_perfil_ainda_sem_empresa(self, fake_client, patch_client_for_token):
        fake_client.auth = FakeAuth(user=FakeUser(id="user-1", email="a@empresa.com"))
        fake_client.tables["profiles"] = [
            {"id": "user-1", "company_id": None, "role": None, "full_name": None}
        ]
        patch_client_for_token(fake_client)

        user = await security.get_current_user("Bearer token-valido")

        assert user.company_id is None
        assert user.role is None

    async def test_company_id_none_quando_perfil_nem_existe_ainda(self, fake_client, patch_client_for_token):
        # Cenário real: a trigger criou o auth.users mas o profiles ainda
        # não foi lido (race condition improvável, mas não deve derrubar
        # a API com um erro 500).
        fake_client.auth = FakeAuth(user=FakeUser(id="user-1", email="a@empresa.com"))
        fake_client.tables["profiles"] = []
        patch_client_for_token(fake_client)

        user = await security.get_current_user("Bearer token-valido")

        assert user.company_id is None


class TestGetCurrentUserWithCompany:
    async def test_403_quando_usuario_nao_tem_empresa(self, fake_client, patch_client_for_token):
        fake_client.auth = FakeAuth(user=FakeUser(id="user-1", email="a@empresa.com"))
        fake_client.tables["profiles"] = [{"id": "user-1", "company_id": None, "role": None}]
        patch_client_for_token(fake_client)

        with pytest.raises(HTTPException) as exc:
            await security.get_current_user_with_company("Bearer token-valido")
        assert exc.value.status_code == 403

    async def test_passa_quando_usuario_tem_empresa(self, fake_client, patch_client_for_token):
        fake_client.auth = FakeAuth(user=FakeUser(id="user-1", email="a@empresa.com"))
        fake_client.tables["profiles"] = [{"id": "user-1", "company_id": "company-1", "role": "operador"}]
        patch_client_for_token(fake_client)

        user = await security.get_current_user_with_company("Bearer token-valido")

        assert user.company_id == "company-1"

    async def test_propaga_401_de_get_current_user(self):
        with pytest.raises(HTTPException) as exc:
            await security.get_current_user_with_company(None)
        assert exc.value.status_code == 401


class TestRequireAdmin:
    async def test_403_quando_papel_nao_e_admin(self, fake_client, patch_client_for_token):
        fake_client.auth = FakeAuth(user=FakeUser(id="user-1", email="a@empresa.com"))
        fake_client.tables["profiles"] = [{"id": "user-1", "company_id": "company-1", "role": "operador"}]
        patch_client_for_token(fake_client)

        with pytest.raises(HTTPException) as exc:
            await security.require_admin("Bearer token-valido")
        assert exc.value.status_code == 403

    async def test_403_quando_nem_tem_empresa_ainda(self, fake_client, patch_client_for_token):
        fake_client.auth = FakeAuth(user=FakeUser(id="user-1", email="a@empresa.com"))
        fake_client.tables["profiles"] = [{"id": "user-1", "company_id": None, "role": None}]
        patch_client_for_token(fake_client)

        with pytest.raises(HTTPException) as exc:
            await security.require_admin("Bearer token-valido")
        assert exc.value.status_code == 403

    async def test_passa_quando_papel_e_admin(self, fake_client, patch_client_for_token):
        fake_client.auth = FakeAuth(user=FakeUser(id="user-1", email="a@empresa.com"))
        fake_client.tables["profiles"] = [{"id": "user-1", "company_id": "company-1", "role": "admin"}]
        patch_client_for_token(fake_client)

        user = await security.require_admin("Bearer token-valido")

        assert user.role == "admin"
