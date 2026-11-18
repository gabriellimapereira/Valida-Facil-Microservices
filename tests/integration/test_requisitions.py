from uuid import uuid4


def test_criar_requisicao_com_sucesso(make_test_client, fake_client, make_authed_user):
    store_id = str(uuid4())
    prod_id = str(uuid4())

    fake_client.tables["stores"] = [
        {"id": store_id, "company_id": "company-1", "name": "Filial Sul"}
    ]
    fake_client.tables["products"] = [
        {
            "id": prod_id,
            "company_id": "company-1",
            "name": "Leite Integral",
            "code": "ALM-001",
        }
    ]

    user = make_authed_user(fake_client, company_id="company-1")
    client = make_test_client(user=user)

    payload = {
        "store_id": store_id,
        "notes": "Reposição semanal",
        "items": [{"product_id": prod_id, "quantity_requested": 20}],
    }

    response = client.post("/requisitions", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pendente"
    assert body["store_name"] == "Filial Sul"
    assert len(body["items"]) == 1
    assert body["items"][0]["quantity_requested"] == 20


def test_listar_requisicoes_retorna_lista(
    make_test_client, fake_client, make_authed_user
):
    req_id = str(uuid4())
    store_id = str(uuid4())

    fake_client.tables["requisitions"] = [
        {
            "id": req_id,
            "company_id": "company-1",
            "store_id": store_id,
            "requested_by": "user-1",
            "status": "pendente",
            "notes": "Urgente",
            "created_at": "2026-02-01T10:00:00Z",
            "updated_at": "2026-02-01T10:00:00Z",
            "stores": {"name": "Loja Centro"},
            "profiles": {"full_name": "Operador Loja"},
            "requisition_items": [],
        }
    ]

    user = make_authed_user(fake_client, company_id="company-1")
    client = make_test_client(user=user)

    response = client.get("/requisitions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["status"] == "pendente"
    assert data[0]["store_name"] == "Loja Centro"
