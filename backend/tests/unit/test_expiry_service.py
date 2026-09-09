"""
Testes unitários de expiry_service.py — varredura de produtos próximos
do vencimento e disparo do e-mail resumo por empresa.
"""
from datetime import date, timedelta

from app.services import expiry_service


def _iso(days_from_today):
    return (date.today() + timedelta(days=days_from_today)).isoformat()


class TestCheckAndNotifyCompany:
    def test_nao_notifica_quando_nao_ha_produto_vencendo(self, fake_client):
        fake_client.tables["products"] = [
            {"name": "Fone Bluetooth", "code": "ELE-3010", "expiry": None, "company_id": "company-1"},
        ]

        result = expiry_service.check_and_notify_company(fake_client, "company-1", window_days=15)

        assert result == {"notified": False, "count": 0}

    def test_notifica_e_calcula_dias_restantes_corretamente(self, monkeypatch, fake_client):
        fake_client.tables["products"] = [
            {"name": "Maçã Gala", "code": "FRT-0012", "expiry": _iso(2), "company_id": "company-1"},
            {"name": "Morango", "code": "FRT-0060", "expiry": _iso(0), "company_id": "company-1"},
            # produto de OUTRA empresa não deve entrar (isolamento multi-tenant)
            {"name": "Produto de outra empresa", "code": "X", "expiry": _iso(1), "company_id": "company-2"},
        ]
        fake_client.tables["companies"] = [
            {"id": "company-1", "name": "Empório Boa Safra", "notification_email": "estoque@empresa.com"},
        ]

        sent_emails = []
        monkeypatch.setattr(
            expiry_service,
            "send_email",
            lambda to, subject, html_body: sent_emails.append((to, subject)) or True,
        )

        result = expiry_service.check_and_notify_company(fake_client, "company-1", window_days=15)

        assert result["notified"] is True
        assert result["count"] == 2  # só os 2 produtos da company-1
        assert sent_emails[0][0] == "estoque@empresa.com"

    def test_nao_notifica_sem_email_cadastrado(self, fake_client):
        fake_client.tables["products"] = [
            {"name": "Maçã Gala", "code": "FRT-0012", "expiry": _iso(2), "company_id": "company-1"},
        ]
        fake_client.tables["companies"] = [
            {"id": "company-1", "name": "Empório Boa Safra", "notification_email": None},
        ]

        result = expiry_service.check_and_notify_company(fake_client, "company-1", window_days=15)

        assert result["notified"] is False
        assert "reason" in result

    def test_produto_vencido_conta_dias_restantes_como_zero(self, monkeypatch, fake_client):
        fake_client.tables["products"] = [
            {"name": "Iogurte", "code": "IOG-0056", "expiry": _iso(-3), "company_id": "company-1"},
        ]
        fake_client.tables["companies"] = [
            {"id": "company-1", "name": "Empório Boa Safra", "notification_email": "estoque@empresa.com"},
        ]

        captured = {}

        def fake_render(_template, **context):
            captured.update(context)
            return "<html></html>"

        monkeypatch.setattr(expiry_service, "render", fake_render)
        monkeypatch.setattr(expiry_service, "send_email", lambda **kwargs: True)

        expiry_service.check_and_notify_company(fake_client, "company-1", window_days=15)

        assert captured["products"][0]["days_left"] == 0


class TestRunExpiryCheckAllCompanies:
    def test_varre_todas_as_empresas_isolando_por_company_id(self, monkeypatch, fake_client):
        fake_client.tables["companies"] = [
            {"id": "company-1", "name": "Empório Boa Safra", "notification_email": "a@empresa.com"},
            {"id": "company-2", "name": "Loja da Ana", "notification_email": "b@empresa.com"},
        ]
        fake_client.tables["products"] = [
            {"name": "P1", "code": "P1", "expiry": _iso(1), "company_id": "company-1"},
            {"name": "P2", "code": "P2", "expiry": _iso(1), "company_id": "company-2"},
        ]

        monkeypatch.setattr(expiry_service, "service_client", lambda: fake_client)
        checked = []
        original = expiry_service.check_and_notify_company

        def spy(client, company_id, window_days=15):
            checked.append(company_id)
            return original(client, company_id, window_days=window_days)

        monkeypatch.setattr(expiry_service, "check_and_notify_company", spy)
        monkeypatch.setattr(expiry_service, "send_email", lambda **kwargs: True)

        results = expiry_service.run_expiry_check_all_companies(window_days=15)

        assert set(checked) == {"company-1", "company-2"}
        assert isinstance(results, list)
        assert len(results) == 2
