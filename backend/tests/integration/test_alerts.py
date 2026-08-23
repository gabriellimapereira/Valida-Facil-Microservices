"""
Testes de integração de POST /alerts/check-expiry — disparo manual da
checagem de validade (a mesma lógica do job diário, sob demanda).
"""
import app.routers.alerts as alerts_router


def test_dispara_checagem_como_admin(monkeypatch, make_test_client, fake_client, make_authed_user):
    called_with = {}

    def fake_check(client, company_id, window_days=15):
        called_with["company_id"] = company_id
        called_with["window_days"] = window_days
        return {"notified": True, "count": 3}

    monkeypatch.setattr(alerts_router.expiry_service, "check_and_notify_company", fake_check)

    admin_user = make_authed_user(fake_client, company_id="company-1", role="admin")
    client = make_test_client(admin=admin_user)

    response = client.post("/alerts/check-expiry")

    assert response.status_code == 200
    assert response.json() == {"notified": True, "count": 3}
    assert called_with == {"company_id": "company-1", "window_days": 15}


def test_aceita_janela_de_dias_customizada(monkeypatch, make_test_client, fake_client, make_authed_user):
    called_with = {}
    monkeypatch.setattr(
        alerts_router.expiry_service,
        "check_and_notify_company",
        lambda client, company_id, window_days=15: called_with.update(window_days=window_days)
        or {"notified": False, "count": 0},
    )

    admin_user = make_authed_user(fake_client, company_id="company-1", role="admin")
    client = make_test_client(admin=admin_user)

    response = client.post("/alerts/check-expiry?window_days=30")

    assert response.status_code == 200
    assert called_with["window_days"] == 30


def test_janela_fora_do_intervalo_permitido_retorna_422(make_test_client, fake_client, make_authed_user):
    admin_user = make_authed_user(fake_client, company_id="company-1", role="admin")
    client = make_test_client(admin=admin_user)

    response = client.post("/alerts/check-expiry?window_days=0")

    assert response.status_code == 422


def test_sem_autenticacao_retorna_401(make_test_client):
    client = make_test_client()

    response = client.post("/alerts/check-expiry")

    assert response.status_code == 401
