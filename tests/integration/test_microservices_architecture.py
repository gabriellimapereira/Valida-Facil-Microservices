"""
Testes integrados da arquitetura distribuída de microsserviços:
- API Gateway (saúde agregada, topologia e roteamento por domínio)
- MS Identity (vínculo e atualização de store_id com validação via HTTP no MS Stores)
- MS Warehouse (disponibilidade FEFO, remoção do teto de 1.000.000, despacho e estorno SAGA)
- MS Stores & Requisitions (inventário local, histórico store_movements, máquina de estados rígida,
  isolamento de filial, deduplicação de itens e idempotência do broker)
"""

from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

import ms_identity.routers.companies as companies_router
import ms_warehouse.routers.internal as warehouse_internal
from gateway.main import app as gateway_app
from ms_identity.main import app as identity_app
from ms_stores.main import app as stores_app
from ms_warehouse.main import app as warehouse_app
from shared.broker import broker
from shared.config import settings


def test_gateway_health_agrega_os_tres_microsservicos(make_test_client):
    client = make_test_client()
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["service"] == "api-gateway"
    names = {svc["service"] for svc in body["services"]}
    assert names == {"ms-identity", "ms-warehouse", "ms-stores"}
    assert all(svc["status"] == "ok" for svc in body["services"])


def test_gateway_topology_e_headers_de_roteamento(
    make_test_client, fake_client, make_authed_user
):
    store_id = str(uuid4())
    fake_client.tables["stores"] = [
        {"id": store_id, "company_id": "company-1", "name": "Filial A", "code": "A1"}
    ]
    user = make_authed_user(fake_client, company_id="company-1")
    client = make_test_client(user=user)

    stores_res = client.get("/stores")
    assert stores_res.status_code == 200
    assert stores_res.headers.get("X-Gateway") == "valida-facil-gateway"
    assert stores_res.headers.get("X-Upstream-Service") == "ms-stores"

    topo_res = client.get("/gateway/topology")
    assert topo_res.status_code == 200
    assert "recent_events" in topo_res.json()


def test_ms_identity_vincula_e_atualiza_store_id_via_http(
    monkeypatch, make_test_client, fake_client, make_authed_user
):
    store_id = str(uuid4())
    member_id = str(uuid4())
    fake_client.tables["stores"] = [
        {
            "id": store_id,
            "company_id": "company-1",
            "name": "Filial Centro",
            "code": "CTR-01",
        }
    ]
    fake_client.tables["profiles"] = [
        {
            "id": member_id,
            "company_id": "company-1",
            "full_name": "Jorge Miguel",
            "email": "jorge@empresa.com",
            "role": "operador",
            "store_id": None,
            "created_at": "2026-01-01T00:00:00Z",
        }
    ]
    monkeypatch.setattr(companies_router, "_get_admin_client", lambda: fake_client)

    admin = make_authed_user(fake_client, company_id="company-1", role="admin")
    client = make_test_client(user=admin, admin=admin)

    # Vincula colaborador à Filial Centro via PATCH /companies/members/{id}
    patch_res = client.patch(
        f"/companies/members/{member_id}",
        json={"store_id": store_id},
    )
    assert patch_res.status_code == 200, patch_res.text
    assert patch_res.json()["store_id"] == store_id
    assert patch_res.json()["store_name"] == "Filial Centro"

    # Listagem deve enriquecer store_name via chamada HTTP ao MS Stores
    list_res = client.get("/companies/members")
    assert list_res.status_code == 200
    assert list_res.json()[0]["store_name"] == "Filial Centro"

    # Enviar store_id=null desvincula de volta para o Armazém Central
    clear_res = client.patch(
        f"/companies/members/{member_id}",
        json={"store_id": None},
    )
    assert clear_res.status_code == 200
    assert clear_res.json()["store_id"] is None


def test_ms_warehouse_disponibilidade_fefo_e_sem_limite_1_milhao(
    make_test_client, fake_client, make_authed_user
):
    company_id = str(uuid4())
    p_late = str(uuid4())
    p_soon = str(uuid4())
    fake_client.tables["products"] = [
        {
            "id": p_late,
            "company_id": company_id,
            "code": "ALM-002",
            "name": "Arroz Tipo 1",
            "category": "perecivel",
            "quantity": 500,
            "min_stock": 50,
            "expiry": "2030-12-01",
        },
        {
            "id": p_soon,
            "company_id": company_id,
            "code": "ALM-001",
            "name": "Iogurte Natural",
            "category": "perecivel",
            "quantity": 2_500_000,
            "min_stock": 20,
            "expiry": "2020-01-01",
        },
    ]
    fake_client.rpc_results["apply_stock_movement"] = {
        "company_id": company_id,
        "product_id": p_soon,
        "product_name": "Iogurte Natural",
        "previous_quantity": 1_000_000,
        "new_quantity": 2_500_000,
        "min_stock": 20,
        "crossed_low_stock": False,
        "notification_email": "estoque@empresa.com",
    }

    user = make_authed_user(fake_client, company_id=company_id, role="admin")
    client = make_test_client(user=user)

    # Sem teto artificial de 1.000.000 nas movimentações
    mov_res = client.post(
        "/movements",
        json={
            "product_id": p_soon,
            "movement_type": "entrada",
            "quantity_delta": 1_500_000,
        },
    )
    assert mov_res.status_code == 201
    assert mov_res.json()["new_quantity"] == 2_500_000

    # Ordenação FEFO: Iogurte (vencido/mais próximo) vem ANTES de Arroz
    avail_res = client.get("/warehouse/products/availability")
    assert avail_res.status_code == 200
    items = avail_res.json()
    assert len(items) == 2
    assert items[0]["id"] == p_soon
    assert items[0]["expiry_status"] == "vencido"
    assert items[1]["id"] == p_late
    assert items[1]["expiry_status"] == "normal"


def test_ciclo_completo_saga_requisicao_despacho_recebimento_e_estorno(
    make_test_client, fake_client, make_authed_user
):
    company_id = str(uuid4())
    store_id = str(uuid4())
    prod_id = str(uuid4())
    admin_id = str(uuid4())
    op_id = str(uuid4())

    fake_client.tables["companies"] = [{"id": company_id, "name": "Super Rede"}]
    fake_client.tables["stores"] = [
        {
            "id": store_id,
            "company_id": company_id,
            "name": "Filial Sul",
            "code": "SUL-01",
        }
    ]
    fake_client.tables["products"] = [
        {
            "id": prod_id,
            "company_id": company_id,
            "code": "LAT-01",
            "name": "Leite Integral",
            "category": "perecivel",
            "quantity": 100,
            "min_stock": 10,
            "expiry": "2027-05-10",
        }
    ]
    fake_client.tables["profiles"] = [
        {
            "id": op_id,
            "company_id": company_id,
            "full_name": "Operador Sul",
            "role": "operador",
            "store_id": store_id,
        }
    ]

    # 1. Operador da Filial Sul emite requisição
    operator = make_authed_user(
        fake_client,
        company_id=company_id,
        role="operador",
        user_id=op_id,
        store_id=store_id,
        full_name="Operador Sul",
    )
    op_client = make_test_client(user=operator)

    # Produto duplicado deve ser bloqueado com 400
    dup_res = op_client.post(
        "/requisitions",
        json={
            "store_id": store_id,
            "items": [
                {"product_id": prod_id, "quantity_requested": 10},
                {"product_id": prod_id, "quantity_requested": 5},
            ],
        },
    )
    assert dup_res.status_code == 400

    # Requisição válida para a própria filial
    create_res = op_client.post(
        "/requisitions",
        json={
            "store_id": store_id,
            "notes": "Urgente",
            "items": [{"product_id": prod_id, "quantity_requested": 30}],
        },
    )
    assert create_res.status_code == 201
    req_id = create_res.json()["id"]
    assert create_res.json()["status"] == "pendente"

    # Operador NÃO pode aprovar ou despachar
    forbid_res = op_client.patch(
        f"/requisitions/{req_id}/status", json={"status": "aprovada"}
    )
    assert forbid_res.status_code == 403

    # Operador NÃO pode pular de pendente -> recebida diretamente
    invalid_jump = op_client.patch(
        f"/requisitions/{req_id}/status", json={"status": "recebida"}
    )
    assert invalid_jump.status_code == 400

    # 2. Admin aprova ajustando quantity_approved para 25 unidades
    admin = make_authed_user(
        fake_client, company_id=company_id, role="admin", user_id=admin_id
    )
    admin_client = make_test_client(user=admin, admin=admin)

    app_res = admin_client.patch(
        f"/requisitions/{req_id}/status",
        json={
            "status": "aprovada",
            "items_approved": [{"product_id": prod_id, "quantity_approved": 25}],
        },
    )
    assert app_res.status_code == 200
    assert app_res.json()["status"] == "aprovada"
    assert app_res.json()["items"][0]["quantity_approved"] == 25
    # Saldo do armazém central ainda intacto antes do despacho
    assert fake_client.tables["products"][0]["quantity"] == 100

    # 3. Admin despacha -> MS Warehouse deduz imediatamente 25 unidades (100 -> 75)
    disp_res = admin_client.patch(
        f"/requisitions/{req_id}/status", json={"status": "despachada"}
    )
    assert disp_res.status_code == 200
    assert disp_res.json()["status"] == "despachada"
    assert fake_client.tables["products"][0]["quantity"] == 75
    assert len(fake_client.tables["stock_movements"]) == 1
    assert fake_client.tables["stock_movements"][0]["quantity_delta"] == -25

    # 4. Operador de OUTRA loja não pode confirmar recebimento desta requisição
    other_store = str(uuid4())
    other_op = make_authed_user(
        fake_client,
        company_id=company_id,
        role="operador",
        user_id=str(uuid4()),
        store_id=other_store,
    )
    other_client = make_test_client(user=other_op)
    assert (
        other_client.patch(
            f"/requisitions/{req_id}/status", json={"status": "recebida"}
        ).status_code
        == 403
    )

    # 5. Operador correto confirma recebimento -> credita store_inventory & store_movements sem rededuzir CD
    op_client = make_test_client(user=operator)
    rec_res = op_client.patch(
        f"/requisitions/{req_id}/status", json={"status": "recebida"}
    )
    assert rec_res.status_code == 200
    assert rec_res.json()["status"] == "recebida"
    assert fake_client.tables["products"][0]["quantity"] == 75
    assert fake_client.tables["store_inventory"][0]["quantity"] == 25
    assert fake_client.tables["store_movements"][0]["movement_type"] == "entrada"
    assert fake_client.tables["store_movements"][0]["quantity_delta"] == 25

    # Estado terminal 'recebida' não aceita transição posterior
    assert (
        admin_client.patch(
            f"/requisitions/{req_id}/status", json={"status": "cancelada"}
        ).status_code
        == 400
    )


def test_saga_compensacao_cancelar_requisicao_despachada_estorna_armazem(
    make_test_client, fake_client, make_authed_user
):
    company_id = str(uuid4())
    store_id = str(uuid4())
    prod_id = str(uuid4())

    fake_client.tables["companies"] = [{"id": company_id, "name": "Rede Estorno"}]
    fake_client.tables["stores"] = [
        {"id": store_id, "company_id": company_id, "name": "Filial Norte", "code": "N1"}
    ]
    fake_client.tables["products"] = [
        {
            "id": prod_id,
            "company_id": company_id,
            "code": "PR-1",
            "name": "Café",
            "quantity": 60,
            "min_stock": 5,
        }
    ]
    admin = make_authed_user(fake_client, company_id=company_id, role="admin")
    client = make_test_client(user=admin, admin=admin)

    req_id = client.post(
        "/requisitions",
        json={
            "store_id": store_id,
            "items": [{"product_id": prod_id, "quantity_requested": 15}],
        },
    ).json()["id"]

    assert (
        client.patch(
            f"/requisitions/{req_id}/status", json={"status": "aprovada"}
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/requisitions/{req_id}/status", json={"status": "despachada"}
        ).status_code
        == 200
    )
    assert fake_client.tables["products"][0]["quantity"] == 45

    # Cancelamento após despacho aciona /internal/stock/release no MS Warehouse e devolve 15 unidades (45 -> 60)
    cancel_res = client.patch(
        f"/requisitions/{req_id}/status", json={"status": "cancelada"}
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelada"
    assert fake_client.tables["products"][0]["quantity"] == 60


def test_loja_movimentacao_local_historico_edicao_e_isolamento_filial(
    make_test_client, fake_client, make_authed_user
):
    company_id = str(uuid4())
    store_a = str(uuid4())
    store_b = str(uuid4())
    prod_id = str(uuid4())

    fake_client.tables["stores"] = [
        {"id": store_a, "company_id": company_id, "name": "Loja A", "code": "LA"},
        {"id": store_b, "company_id": company_id, "name": "Loja B", "code": "LB"},
    ]
    fake_client.tables["products"] = [
        {
            "id": prod_id,
            "company_id": company_id,
            "code": "PR-2",
            "name": "Açúcar",
            "category": "perecivel",
            "quantity": 500,
        }
    ]

    op_a = make_authed_user(
        fake_client, company_id=company_id, role="operador", store_id=store_a
    )
    client_a = make_test_client(user=op_a)

    # Operador da Loja A não pode movimentar estoque da Loja B
    forbid_mov = client_a.post(
        f"/stores/{store_b}/inventory/movement",
        json={"product_id": prod_id, "quantity_delta": 10},
    )
    assert forbid_mov.status_code == 403

    # Entrada acima de 1.000.000 permitida sem teto na filial
    ok_mov = client_a.post(
        f"/stores/{store_a}/inventory/movement",
        json={
            "product_id": prod_id,
            "quantity_delta": 1_200_000,
            "note": "Carga inicial",
        },
    )
    assert ok_mov.status_code == 200
    assert ok_mov.json()["new_quantity"] == 1_200_000

    # Ajuste de estoque mínimo na filial
    min_res = client_a.patch(
        f"/stores/{store_a}/inventory/{prod_id}", json={"min_stock": 25}
    )
    assert min_res.status_code == 200
    assert min_res.json()["min_stock"] == 25

    # Inventário e Histórico enriquecidos via HTTP
    inv_res = client_a.get(f"/stores/{store_a}/inventory")
    assert inv_res.status_code == 200
    assert inv_res.json()[0]["product_name"] == "Açúcar"
    assert inv_res.json()[0]["min_stock"] == 25

    hist_res = client_a.get(f"/stores/{store_a}/movements")
    assert hist_res.status_code == 200
    assert len(hist_res.json()) == 1
    assert hist_res.json()[0]["product_name"] == "Açúcar"
    assert hist_res.json()[0]["quantity_delta"] == 1_200_000

    # Admin edita nome da filial via PATCH /stores/{id} (antes quebrava em .update().eq().select())
    admin = make_authed_user(fake_client, company_id=company_id, role="admin")
    admin_client = make_test_client(user=admin, admin=admin)
    upd_res = admin_client.patch(f"/stores/{store_a}", json={"name": "Loja A Premium"})
    assert upd_res.status_code == 200
    assert upd_res.json()["name"] == "Loja A Premium"


def test_consumidores_internos_s2s_exigem_token_e_garantem_idempotencia(
    monkeypatch, fake_client
):
    wh_client = TestClient(warehouse_app)
    assert (
        wh_client.post(
            "/internal/products/batch", json={"company_id": "c1", "product_ids": []}
        ).status_code
        == 403
    )
    monkeypatch.setattr(
        warehouse_internal, "resolve_db_client", lambda _request: fake_client
    )

    event_payload = {
        "event_id": str(uuid4()),
        "event_type": "REQUISICAO_CRIADA",
        "routing_key": "requisicao.criada",
        "company_id": "company-idemp-1",
        "aggregate_id": "req-1",
        "source_service": "stores",
        "payload": {},
    }
    headers = {"X-Internal-Service-Token": settings.internal_service_secret}
    try:
        r1 = wh_client.post("/internal/events", json=event_payload, headers=headers)
        r2 = wh_client.post("/internal/events", json=event_payload, headers=headers)
        assert r1.status_code == 200 and r1.json()["status"] == "processed"
        assert r2.status_code == 200 and r2.json()["status"] == "already_processed"
    finally:
        broker._processed_ids.discard(event_payload["event_id"])


def test_cada_microsservico_responde_health_isolado_com_cabecalho_proprio():
    expectations = [
        (gateway_app, "api-gateway"),
        (identity_app, "ms-identity"),
        (warehouse_app, "ms-warehouse"),
        (stores_app, "ms-stores"),
    ]
    for service_app, expected_name in expectations:
        client = TestClient(service_app)
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["service"] == expected_name
        assert res.headers.get("X-Service-Name") == expected_name


def test_isolamento_de_pacotes_e_dockerfiles_por_microsservico():
    repo_root = Path(__file__).resolve().parent.parent.parent
    service_dirs = ["api-gateway", "ms-identity", "ms-warehouse", "ms-stores"]

    for svc_dir in service_dirs:
        base = repo_root / svc_dir
        assert (base / "Dockerfile").is_file(), f"Dockerfile ausente em {svc_dir}"
        assert (base / "requirements.txt").is_file(), (
            f"requirements.txt ausente em {svc_dir}"
        )

        for py_file in base.rglob("*.py"):
            text = py_file.read_text(encoding="utf-8")
            assert "from app." not in text and "import app." not in text, (
                f"Import legado 'app.*' encontrado em {py_file}"
            )
            assert "from services." not in text and "import services." not in text, (
                f"Import legado 'services.*' encontrado em {py_file}"
            )

    # Serviços leves não devem carregar bibliotecas pesadas exclusivas do MS Warehouse
    heavy_warehouse_deps = ("weasyprint", "pandas", "openpyxl", "apscheduler")
    for light_service in ("api-gateway", "ms-identity", "ms-stores"):
        reqs = (
            (repo_root / light_service / "requirements.txt")
            .read_text(encoding="utf-8")
            .lower()
        )
        for dep in heavy_warehouse_deps:
            assert dep not in reqs, f"{light_service} não deve depender de '{dep}'"

    wh_reqs = (
        (repo_root / "ms-warehouse" / "requirements.txt")
        .read_text(encoding="utf-8")
        .lower()
    )
    for dep in heavy_warehouse_deps:
        assert dep in wh_reqs, f"ms-warehouse deve incluir '{dep}'"
