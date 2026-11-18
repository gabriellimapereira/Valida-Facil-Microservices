from unittest.mock import patch
from fastapi.testclient import TestClient
from gateway.main import app


def test_trigger_expiry_check_sem_auth_retorna_401():
    client = TestClient(app)
    res = client.post("/alerts/check-expiry")
    assert res.status_code == 401


def test_trigger_expiry_check_com_admin_chama_servico(
    make_test_client, make_authed_user, fake_client
):
    admin_user = make_authed_user(fake_client, role="admin")
    client = make_test_client(admin=admin_user)

    with patch(
        "ms_warehouse.services.expiry_service.check_and_notify_company"
    ) as mock_check:
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


def test_trigger_expiry_check_com_parametro_invalido_retorna_422(
    make_test_client, make_authed_user, fake_client
):
    admin_user = make_authed_user(fake_client, role="admin")
    client = make_test_client(admin=admin_user)
    res = client.post("/alerts/check-expiry?window_days=0")
    assert res.status_code == 422


def test_cron_expiry_check_executa_e_retorna_sucesso():
    client = TestClient(app)
    with patch(
        "ms_warehouse.services.expiry_service.run_expiry_check_all_companies"
    ) as mock_run:
        mock_run.return_value = [{"company_id": "c1", "notified": True, "count": 3}]
        res = client.get("/alerts/cron-expiry-check?window_days=15")

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "concluido"
    assert data["empresas_processadas"] == 1
    mock_run.assert_called_once_with(window_days=15)


def test_cron_expiry_check_com_secret_incorreto_retorna_401():
    client = TestClient(app)
    with patch("shared.config.settings.cron_secret", "segredo-super-secreto"):
        res = client.get(
            "/alerts/cron-expiry-check",
            headers={"Authorization": "Bearer segredo-errado"},
        )
        assert res.status_code == 401

        with patch(
            "ms_warehouse.services.expiry_service.run_expiry_check_all_companies"
        ) as mock_run:
            mock_run.return_value = []
            res_ok = client.get(
                "/alerts/cron-expiry-check",
                headers={"Authorization": "Bearer segredo-super-secreto"},
            )
            assert res_ok.status_code == 200
