from uuid import uuid4

STORE_PAYLOAD = {
    "name": "Filial Shopping",
    "code": "SHOP-01",
    "address": "Av. Brasil, 500",
    "phone": "(11) 98765-4321",
}


def test_listar_lojas_retorna_lista(make_test_client, fake_client, make_authed_user):
    store_id = str(uuid4())
    fake_client.tables["stores"] = [
        {
            "id": store_id,
            "company_id": "company-1",
            "name": "Filial Centro",
            "code": "CENTRO-01",
            "address": "Rua Central, 10",
            "phone": "(11) 9999-8888",
            "created_at": "2026-01-01T00:00:00Z",
        }
    ]
    user = make_authed_user(fake_client, company_id="company-1")
    client = make_test_client(user=user)

    response = client.get("/stores")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Filial Centro"
    assert data[0]["code"] == "CENTRO-01"


def test_criar_loja_como_admin_sucesso(make_test_client, fake_client, make_authed_user):
    admin = make_authed_user(fake_client, company_id="company-1", role="admin")
    client = make_test_client(admin=admin)

    response = client.post("/stores", json=STORE_PAYLOAD)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == STORE_PAYLOAD["name"]
    assert body["code"] == STORE_PAYLOAD["code"]


def test_operador_nao_pode_criar_loja(make_test_client):
    from fastapi import HTTPException
    from app.core import security
    from app.main import app

    def _forbidden():
        raise HTTPException(status_code=403, detail="Ação restrita a administradores da empresa.")

    app.dependency_overrides[security.require_admin] = _forbidden
    client = make_test_client()

    response = client.post("/stores", json=STORE_PAYLOAD)
    assert response.status_code == 403
