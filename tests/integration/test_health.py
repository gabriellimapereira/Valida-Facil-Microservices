"""Teste de integração mais simples possível: a API sobe e responde."""


def test_health_endpoint_responde_ok(make_test_client):
    client = make_test_client()

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
