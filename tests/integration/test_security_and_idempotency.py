"""
Testes de segurança, idempotência, concorrência e isolamento multi-tenant
cobrindo todos os achados de `testes_copilot.md`.
"""

import asyncio
from uuid import uuid4

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from gateway.main import app as gateway_app
from ms_warehouse.main import app as warehouse_app
from shared.app_factory import create_service_app
from shared.auth import require_internal_service
from shared.config import DEV_INTERNAL_SERVICE_SECRET, Settings, settings
from shared.security import AuthedUser
from tests.conftest import FakeQuery


def test_settings_rejeita_segredo_padrao_ou_vazio_em_producao():
    """Valida que o settings rejeita o segredo padrão ou vazio em produção."""
    with pytest.raises(ValidationError):
        Settings(
            environment="production",
            internal_service_secret=DEV_INTERNAL_SERVICE_SECRET,
        )

    with pytest.raises(ValidationError):
        Settings(
            environment="production",
            internal_service_secret="",
        )

    ok_settings = Settings(
        environment="production",
        internal_service_secret="segredo-exclusivo-de-producao-987654",
    )
    assert ok_settings.is_production is True


def test_create_service_app_falha_no_startup_em_producao_com_segredo_padrao(
    monkeypatch,
):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(
        settings, "internal_service_secret", DEV_INTERNAL_SERVICE_SECRET
    )

    with pytest.raises(ValueError, match="INTERNAL_SERVICE_SECRET"):
        create_service_app(title="Teste", description="Teste", service_name="test-svc")


def test_require_internal_service_bloqueia_segredo_padrao_em_producao(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(
        settings, "internal_service_secret", DEV_INTERNAL_SERVICE_SECRET
    )

    class _DummyReq:
        headers = {"X-Internal-Service-Token": DEV_INTERNAL_SERVICE_SECRET}

    with pytest.raises(HTTPException) as exc_info:
        require_internal_service(_DummyReq())
    assert exc_info.value.status_code == 500


class _RealLikeClientRpcTimeout:
    """Simula cliente PostgreSQL cuja RPC falha após commit/timeout."""

    def __init__(self, tables):
        self.tables = {k: list(v) for k, v in tables.items()}
        self.inventory_writes = 0

    def table(self, name):
        self.tables.setdefault(name, [])
        base_query = FakeQuery(self.tables[name])
        if name == "store_inventory":
            parent = self

            class _TrackedQuery(FakeQuery):
                def insert(self, payload):
                    parent.inventory_writes += 1
                    return super().insert(payload)

                def update(self, payload):
                    parent.inventory_writes += 1
                    return super().update(payload)

            return _TrackedQuery(self.tables[name])
        return base_query

    def rpc(self, _name, _params):
        class _FailingRpc:
            def execute(self):
                raise TimeoutError("Read timed out after commit")

        return _FailingRpc()


def test_falha_rpc_recebimento_propaga_erro_sem_duplicar_credito_em_cliente_real(
    make_test_client,
):
    company_id = str(uuid4())
    store_id = str(uuid4())
    prod_id = str(uuid4())
    req_id = str(uuid4())

    real_like = _RealLikeClientRpcTimeout(
        {
            "stores": [
                {
                    "id": store_id,
                    "company_id": company_id,
                    "name": "Filial A",
                    "code": "A",
                }
            ],
            "requisitions": [
                {
                    "id": req_id,
                    "company_id": company_id,
                    "store_id": store_id,
                    "requested_by": "op-1",
                    "status": "despachada",
                }
            ],
            "requisition_items": [
                {
                    "id": str(uuid4()),
                    "requisition_id": req_id,
                    "product_id": prod_id,
                    "quantity_requested": 10,
                    "quantity_approved": 10,
                }
            ],
            "store_inventory": [],
            "store_movements": [],
        }
    )

    op = AuthedUser(
        id="op-1",
        email="op@empresa.com",
        company_id=company_id,
        role="operador",
        access_token="fake-token",
        client=real_like,
        store_id=store_id,
    )
    client = make_test_client(user=op)

    res = client.patch(f"/requisitions/{req_id}/status", json={"status": "recebida"})
    assert res.status_code == 502
    assert real_like.inventory_writes == 0
    assert real_like.tables["store_inventory"] == []


@pytest.mark.asyncio
async def test_recebimentos_concorrentes_creditam_estoque_apenas_uma_vez(
    fake_client, make_authed_user
):
    """Garante que recebimentos concorrentes não duplicam crédito no estoque da filial."""
    from shared import security

    company_id = str(uuid4())
    store_id = str(uuid4())
    prod_id = str(uuid4())
    req_id = str(uuid4())

    fake_client.tables["stores"] = [
        {"id": store_id, "company_id": company_id, "name": "Filial Conc", "code": "C1"}
    ]
    fake_client.tables["products"] = [
        {
            "id": prod_id,
            "company_id": company_id,
            "code": "P1",
            "name": "Produto 1",
            "quantity": 50,
        }
    ]
    fake_client.tables["requisitions"] = [
        {
            "id": req_id,
            "company_id": company_id,
            "store_id": store_id,
            "requested_by": "op-1",
            "status": "despachada",
        }
    ]
    fake_client.tables["requisition_items"] = [
        {
            "id": str(uuid4()),
            "requisition_id": req_id,
            "product_id": prod_id,
            "quantity_requested": 12,
            "quantity_approved": 12,
        }
    ]

    op = make_authed_user(
        fake_client,
        company_id=company_id,
        role="operador",
        user_id="op-1",
        store_id=store_id,
    )
    gateway_app.dependency_overrides[security.get_current_user_with_company] = lambda: (
        op
    )
    gateway_app.dependency_overrides[security.get_current_user] = lambda: op
    try:
        transport = httpx.ASGITransport(app=gateway_app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            r1, r2 = await asyncio.gather(
                ac.patch(f"/requisitions/{req_id}/status", json={"status": "recebida"}),
                ac.patch(f"/requisitions/{req_id}/status", json={"status": "recebida"}),
            )
    finally:
        gateway_app.dependency_overrides.clear()

    codes = sorted([r1.status_code, r2.status_code])
    assert codes == [200, 400]
    assert len(fake_client.tables["store_inventory"]) == 1
    assert fake_client.tables["store_inventory"][0]["quantity"] == 12
    assert len(fake_client.tables["store_movements"]) == 1


def test_despacho_idempotente_apos_falha_local_no_ms_stores(
    make_test_client, fake_client, make_authed_user
):
    """Testa idempotência de despacho e estorno entre MS Stores e MS Warehouse."""
    from shared import security

    company_id = str(uuid4())
    store_id = str(uuid4())
    prod_id = str(uuid4())
    req_id = str(uuid4())

    fake_client.tables["companies"] = [{"id": company_id, "name": "Rede Idempotente"}]
    fake_client.tables["stores"] = [
        {"id": store_id, "company_id": company_id, "name": "Filial X", "code": "FX"}
    ]
    fake_client.tables["products"] = [
        {
            "id": prod_id,
            "company_id": company_id,
            "code": "PR-10",
            "name": "Feijão",
            "quantity": 100,
            "min_stock": 5,
        }
    ]
    fake_client.tables["requisitions"] = [
        {
            "id": req_id,
            "company_id": company_id,
            "store_id": store_id,
            "requested_by": "admin-1",
            "status": "aprovada",
        }
    ]
    fake_client.tables["requisition_items"] = [
        {
            "id": str(uuid4()),
            "requisition_id": req_id,
            "product_id": prod_id,
            "quantity_requested": 30,
            "quantity_approved": 30,
        }
    ]

    admin = make_authed_user(
        fake_client, company_id=company_id, role="admin", user_id="admin-1"
    )
    warehouse_app.dependency_overrides[security.get_current_user_with_company] = (
        lambda: admin
    )
    warehouse_app.dependency_overrides[security.get_current_user] = lambda: admin
    try:
        # 1. Simula sucesso remoto no MS Warehouse antes da atualização local no MS Stores
        wh_client = TestClient(warehouse_app)
        headers = {"X-Internal-Service-Token": settings.internal_service_secret}
        first_dispatch = wh_client.post(
            "/internal/stock/dispatch",
            json={
                "company_id": company_id,
                "requisition_id": req_id,
                "store_id": store_id,
                "store_name": "Filial X",
                "changed_by": "admin-1",
                "items": [{"product_id": prod_id, "quantity": 30}],
            },
            headers=headers,
        )
        assert first_dispatch.status_code == 200
        assert fake_client.tables["products"][0]["quantity"] == 70
        assert len(fake_client.tables["stock_movements"]) == 1

        # 2. Requisição continuou 'aprovada' no MS Stores; retry via API Gateway deve ser idempotente!
        gw_client = make_test_client(user=admin, admin=admin)
        retry_res = gw_client.patch(
            f"/requisitions/{req_id}/status", json={"status": "despachada"}
        )
        assert retry_res.status_code == 200
        assert retry_res.json()["status"] == "despachada"
        # Saldo NÃO pode ser debitado duas vezes
        assert fake_client.tables["products"][0]["quantity"] == 70
        assert len(fake_client.tables["stock_movements"]) == 1

        # 3. Estorno (SAGA compensation) repetido também é idempotente
        rel_payload = {
            "company_id": company_id,
            "requisition_id": req_id,
            "changed_by": "admin-1",
            "items": [{"product_id": prod_id, "quantity": 30}],
        }
        rel1 = wh_client.post(
            "/internal/stock/release", json=rel_payload, headers=headers
        )
        rel2 = wh_client.post(
            "/internal/stock/release", json=rel_payload, headers=headers
        )
        assert rel1.status_code == 200
        assert rel2.status_code == 200 and rel2.json().get("idempotent") is True
        assert fake_client.tables["products"][0]["quantity"] == 100
        assert len(fake_client.tables["stock_movements"]) == 2
    finally:
        warehouse_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_despachos_concorrentes_no_ms_warehouse_deduzem_apenas_uma_vez(
    fake_client, make_authed_user
):
    from shared import security

    company_id = str(uuid4())
    store_id = str(uuid4())
    prod_id = str(uuid4())
    req_id = str(uuid4())

    fake_client.tables["companies"] = [{"id": company_id, "name": "Rede Paralela"}]
    fake_client.tables["products"] = [
        {
            "id": prod_id,
            "company_id": company_id,
            "code": "PR-20",
            "name": "Óleo",
            "quantity": 40,
            "min_stock": 5,
        }
    ]
    admin = make_authed_user(
        fake_client, company_id=company_id, role="admin", user_id="admin-1"
    )
    warehouse_app.dependency_overrides[security.get_current_user_with_company] = (
        lambda: admin
    )
    warehouse_app.dependency_overrides[security.get_current_user] = lambda: admin
    headers = {"X-Internal-Service-Token": settings.internal_service_secret}
    payload = {
        "company_id": company_id,
        "requisition_id": req_id,
        "store_id": store_id,
        "store_name": "Filial Paralela",
        "changed_by": "admin-1",
        "items": [{"product_id": prod_id, "quantity": 15}],
    }
    try:
        transport = httpx.ASGITransport(app=warehouse_app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            r1, r2 = await asyncio.gather(
                ac.post("/internal/stock/dispatch", json=payload, headers=headers),
                ac.post("/internal/stock/dispatch", json=payload, headers=headers),
            )
    finally:
        warehouse_app.dependency_overrides.clear()

    assert r1.status_code == 200
    assert r2.status_code == 200
    assert fake_client.tables["products"][0]["quantity"] == 25
    assert len(fake_client.tables["stock_movements"]) == 1
    assert any(res.json().get("idempotent") is True for res in (r1, r2))


def test_update_store_min_stock_rejeita_produto_de_outra_empresa(
    make_test_client, fake_client, make_authed_user
):
    """Garante que a atualização de estoque mínimo na filial rejeita produto de outro tenant."""
    company_a = str(uuid4())
    company_b = str(uuid4())
    store_a = str(uuid4())
    prod_a = str(uuid4())
    prod_b = str(uuid4())

    fake_client.tables["stores"] = [
        {"id": store_a, "company_id": company_a, "name": "Loja A", "code": "LA"}
    ]
    fake_client.tables["products"] = [
        {
            "id": prod_a,
            "company_id": company_a,
            "code": "A1",
            "name": "Produto A",
            "quantity": 10,
        },
        {
            "id": prod_b,
            "company_id": company_b,
            "code": "B1",
            "name": "Produto B",
            "quantity": 10,
        },
    ]

    user_a = make_authed_user(
        fake_client, company_id=company_a, role="operador", store_id=store_a
    )
    client_a = make_test_client(user=user_a)

    # Produto da Empresa B deve ser rejeitado com 404 sem gravar em store_inventory
    cross_res = client_a.patch(
        f"/stores/{store_a}/inventory/{prod_b}",
        json={"min_stock": 15},
    )
    assert cross_res.status_code == 404
    assert fake_client.tables.get("store_inventory", []) == []

    # Produto da Empresa A deve funcionar normalmente
    own_res = client_a.patch(
        f"/stores/{store_a}/inventory/{prod_a}",
        json={"min_stock": 15},
    )
    assert own_res.status_code == 200
    assert own_res.json()["min_stock"] == 15
    assert len(fake_client.tables["store_inventory"]) == 1
