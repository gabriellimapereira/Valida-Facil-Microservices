from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app


def test_trigger_expiry_check_sem_auth_retorna_401():
    client = TestClient(app)
    res = client.post("/alerts/check-expiry")
    assert res.status_code == 401


def test_trigger_expiry_check_com_admin_chama_servico(make_test_client, make_authed_user, fake_client):
    admin_user = make_authed_user(fake_client, role="admin")
    client = make_test_client(admin=admin_user)

    with patch("app.services.expiry_service.check_and_notify_company") as mock_check:
        mock_check.return_value = {
            "company_id": "company-1",
            "notified": True,
            "count": 2,
            "email": "notif@empresa.com",
        }
        res = client.post("/alerts/check-expiry?window_days=10")

    assert res.status_code == 200
    data = res.json()
    assert data["notified"] is True
    assert data["count"] == 2
    mock_check.assert_called_once()
    assert mock_check.call_args.kwargs["window_days"] == 10


def test_trigger_expiry_check_com_parametro_invalido_retorna_422(make_test_client, make_authed_user, fake_client):
    admin_user = make_authed_user(fake_client, role="admin")
    client = make_test_client(admin=admin_user)
    res = client.post("/alerts/check-expiry?window_days=0")
    assert res.status_code == 422
