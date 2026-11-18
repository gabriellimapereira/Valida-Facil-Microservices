"""
Testes de Integração para a Arquitetura Database-per-Service com Auth Nativa JWT e Catálogo Central.
"""

import uuid
import pytest
from starlette.testclient import TestClient

from gateway.main import app as gateway_app
from ms_identity.main import app as identity_app
from ms_warehouse.main import app as warehouse_app
from shared.auth import AuthedUser, get_current_user_with_company
from tests.conftest import FakeDatabaseClient


@pytest.fixture
def identity_client():
    return TestClient(identity_app)


@pytest.fixture
def warehouse_client():
    return TestClient(warehouse_app)


@pytest.fixture
def gateway_client():
    return TestClient(gateway_app)


def test_auth_native_register_and_login_flow(monkeypatch, identity_client):
    """Testa cadastro e login nativo gerando JWT e retornando o payload de usuário."""
    fake_users = {}
    fake_profiles = {}
    fake_companies = {}

    class MemoryTable:
        def __init__(self, name):
            self.name = name
            self.filters = []

        def select(self, *args, **kwargs):
            return self

        def eq(self, col, val):
            self.filters.append((col, val))
            return self

        def maybe_single(self):
            return self

        def execute(self):
            class Resp:
                def __init__(self, data):
                    self.data = data

            if self.name == "users":
                email = next((v for c, v in self.filters if c == "email"), None)
                if email and email in fake_users:
                    return Resp(fake_users[email])
                return None
            elif self.name == "profiles":
                user_id = next((v for c, v in self.filters if c == "id"), None)
                if user_id and user_id in fake_profiles:
                    return Resp(fake_profiles[user_id])
                return None
            elif self.name == "companies":
                return Resp([])
            return None

        def insert(self, data):
            if self.name == "users":
                fake_users[data["email"]] = data
            elif self.name == "profiles":
                fake_profiles[data["id"]] = data
            elif self.name == "companies":
                fake_companies[data["id"]] = data
            return self

    class MemoryDb:
        def table(self, name):
            return MemoryTable(name)

    monkeypatch.setattr("ms_identity.routers.auth.get_db", lambda *args: MemoryDb())

    # 1. Registro
    reg_payload = {
        "email": "gestor@novatesta.com.br",
        "password": "senhaForte123!",
        "full_name": "Gestor de Teste",
        "company_name": "Nova Testa Comércio",
        "cnpj": "11.222.333/0001-44",
        "phone": "(11) 98888-7777",
    }
    reg_res = identity_client.post("/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == "gestor@novatesta.com.br"
    assert reg_data["user"]["role"] == "admin"
    assert reg_data["user"]["company_id"] is not None

    # 2. Login com sucesso
    login_payload = {
        "email": "gestor@novatesta.com.br",
        "password": "senhaForte123!",
    }
    login_res = identity_client.post("/auth/login", json=login_payload)
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == "gestor@novatesta.com.br"

    # 3. Login com senha errada
    bad_login_res = identity_client.post(
        "/auth/login",
        json={"email": "gestor@novatesta.com.br", "password": "senhaIncorreta"},
    )
    assert bad_login_res.status_code == 401


def test_products_catalog_crud_in_warehouse(monkeypatch, warehouse_client):
    """Testa CRUD de produtos no armazém central com isolamento por empresa."""
    company_id = str(uuid.uuid4())
    stored_products = []

    fake_client = FakeDatabaseClient()
    fake_client.tables["products"] = stored_products
    fake_user = AuthedUser(
        id="usr-123",
        email="admin@armazem.com",
        company_id=company_id,
        role="admin",
        access_token="test-token",
        client=fake_client,
    )

    warehouse_app.dependency_overrides[get_current_user_with_company] = lambda: (
        fake_user
    )

    try:
        # 1. Cria produto
        prod_data = {
            "name": "Leite Desnatado 1L",
            "code": "LEI-001",
            "category": "perecivel",
            "price": 5.49,
            "quantity": 100,
            "min_stock": 20,
            "expiry": "2026-12-31",
            "supplier": "Laticínios Central",
        }
        res = warehouse_client.post("/products", json=prod_data)
        assert res.status_code == 201
        created = res.json()
        assert created["name"] == "Leite Desnatado 1L"
        assert created["code"] == "LEI-001"
        assert created["quantity"] == 100

        # 2. Lista produtos
        list_res = warehouse_client.get("/products")
        assert list_res.status_code == 200
        items = list_res.json()
        assert len(items) == 1
        assert items[0]["name"] == "Leite Desnatado 1L"
    finally:
        warehouse_app.dependency_overrides.pop(get_current_user_with_company, None)


def test_gateway_routes_auth_and_products(gateway_client):
    """Testa se o API Gateway roteia /auth e /products para seus respectivos microsserviços."""
    # Health do Gateway verifica que os microsserviços estão ativos
    h_res = gateway_client.get("/health")
    assert h_res.status_code == 200
    assert h_res.json()["status"] == "ok"


def test_branch_operator_read_only_in_central_warehouse(warehouse_client):
    """
    Testa a regra de negócio de isolamento:
    Operadores de filial (store_id != None) podem visualizar (GET) o catálogo central,
    mas são terminantemente impedidos (403) de criar, editar, excluir ou movimentar estoque central diretamente.
    """
    company_id = str(uuid.uuid4())
    stored_products = [
        {
            "id": "prod-cd-001",
            "company_id": company_id,
            "name": "Arroz Parboilizado 5kg",
            "code": "ARR-001",
            "category": "outros",
            "price": 28.90,
            "quantity": 500,
            "min_stock": 50,
            "expiry": "2027-01-01",
            "supplier": "Distribuidora Central",
            "image_url": None,
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
    ]

    fake_client = FakeDatabaseClient()
    fake_client.tables["products"] = stored_products
    branch_user = AuthedUser(
        id="usr-branch-operator",
        email="operador@filial.com",
        company_id=company_id,
        role="operador",
        store_id="store-shopping-center",  # Usuário vinculado a uma filial!
        access_token="test-token-branch",
        client=fake_client,
    )

    warehouse_app.dependency_overrides[get_current_user_with_company] = lambda: (
        branch_user
    )

    try:
        # 1. Consulta ao armazém central é PERMITIDA (leitura)
        res_list = warehouse_client.get("/products")
        assert res_list.status_code == 200
        data = res_list.json()
        assert len(data) == 1
        assert data[0]["code"] == "ARR-001"

        res_detail = warehouse_client.get("/products/prod-cd-001")
        assert res_detail.status_code == 200
        assert res_detail.json()["id"] == "prod-cd-001"

        # 2. Cadastro direto no armazém central é BLOQUEADO (403 Forbidden)
        new_prod = {
            "name": "Novo Produto Filial",
            "code": "NOV-001",
            "category": "perecivel",
            "price": 10.0,
            "quantity": 10,
            "min_stock": 2,
        }
        res_post = warehouse_client.post("/products", json=new_prod)
        assert res_post.status_code == 403
        assert "somente leitura" in res_post.json()["detail"].lower()

        # 3. Edição direta no armazém central é BLOQUEADA (403 Forbidden)
        res_patch = warehouse_client.patch(
            "/products/prod-cd-001", json={"price": 35.0}
        )
        assert res_patch.status_code == 403
        assert "somente leitura" in res_patch.json()["detail"].lower()

        # 4. Exclusão direta no armazém central é BLOQUEADA (403 Forbidden)
        res_delete = warehouse_client.delete("/products/prod-cd-001")
        assert res_delete.status_code == 403
        assert "somente leitura" in res_delete.json()["detail"].lower()

        # 5. Movimentação direta de estoque no CD é BLOQUEADA (403 Forbidden)
        res_mov = warehouse_client.post(
            "/movements",
            json={
                "product_id": "prod-cd-001",
                "movement_type": "saida",
                "quantity_delta": -5,
                "note": "Tentativa indevida de baixa direta no CD",
            },
        )
        assert res_mov.status_code == 403
        assert "somente leitura" in res_mov.json()["detail"].lower()
    finally:
        warehouse_app.dependency_overrides.pop(get_current_user_with_company, None)
