"""
Teste de integração de POST /movements — a rota completa: validação do
payload (Pydantic), autenticação (substituída por um usuário fake),
chamada ao service, e o disparo (ou não) do alerta de estoque baixo.
"""
from app.services import stock_service

PRODUCT_ID = "22222222-2222-2222-2222-222222222222"
COMPANY_ID = "11111111-1111-1111-1111-111111111111"


def test_movement_atualiza_quantidade_e_retorna_resultado(make_test_client, fake_client, make_authed_user):
    fake_client.rpc_results["apply_stock_movement"] = {
        "company_id": COMPANY_ID,
        "product_id": PRODUCT_ID,
        "product_name": "Maçã Gala",
        "previous_quantity": 20,
        "new_quantity": 15,
        "min_stock": 10,
        "crossed_low_stock": False,
        "notification_email": "estoque@empresa.com",
    }
    user = make_authed_user(fake_client, company_id=COMPANY_ID)
    client = make_test_client(user=user)

    response = client.post(
        "/movements",
        json={"product_id": PRODUCT_ID, "movement_type": "saida", "quantity_delta": -5, "note": "Venda balcão"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["new_quantity"] == 15
    assert body["crossed_low_stock"] is False


def test_movement_dispara_alerta_quando_cruza_estoque_minimo(
    monkeypatch, make_test_client, fake_client, make_authed_user
):
    fake_client.rpc_results["apply_stock_movement"] = {
        "company_id": COMPANY_ID,
        "product_id": PRODUCT_ID,
        "product_name": "Maçã Gala",
        "previous_quantity": 12,
        "new_quantity": 5,
        "min_stock": 10,
        "crossed_low_stock": True,
        "notification_email": "estoque@empresa.com",
    }
    fake_client.tables["companies"] = [{"id": COMPANY_ID, "name": "Empório Boa Safra"}]

    calls = []
    monkeypatch.setattr(
        stock_service,
        "notify_low_stock_if_needed",
        lambda result, company_name: calls.append((result.product_name, company_name)),
    )

    user = make_authed_user(fake_client, company_id=COMPANY_ID)
    client = make_test_client(user=user)

    response = client.post(
        "/movements", json={"product_id": PRODUCT_ID, "movement_type": "saida", "quantity_delta": -7}
    )

    assert response.status_code == 201
    # BackgroundTasks do FastAPI roda de forma síncrona no TestClient — na
    # hora que a resposta chega aqui, o alerta já deveria ter disparado.
    assert calls == [("Maçã Gala", "Empório Boa Safra")]


def test_movement_com_rpc_falhando_retorna_400(make_test_client, fake_client, make_authed_user):
    fake_client.rpc_results["apply_stock_movement"] = []  # RPC vazio -> erro no service

    user = make_authed_user(fake_client, company_id=COMPANY_ID)
    client = make_test_client(user=user)

    response = client.post(
        "/movements", json={"product_id": PRODUCT_ID, "movement_type": "saida", "quantity_delta": -1}
    )

    assert response.status_code == 400


def test_movement_payload_invalido_retorna_422(make_test_client, fake_client, make_authed_user):
    user = make_authed_user(fake_client, company_id=COMPANY_ID)
    client = make_test_client(user=user)

    # movement_type fora do enum permitido (entrada/saida/ajuste)
    response = client.post(
        "/movements", json={"product_id": PRODUCT_ID, "movement_type": "roubo", "quantity_delta": -1}
    )

    assert response.status_code == 422


def test_movement_sem_autenticacao_retorna_401(make_test_client):
    client = make_test_client()  # nenhum override -> passa pela autenticação real

    response = client.post(
        "/movements", json={"product_id": PRODUCT_ID, "movement_type": "saida", "quantity_delta": -1}
    )

    assert response.status_code == 401
