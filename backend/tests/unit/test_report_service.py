"""
Testes unitários de report_service.py.

Diferente dos outros, esses testes geram o PDF/Excel de verdade (não só
checam a lógica) — é proposital: a única forma de pegar um template Jinja2
quebrado ou uma incompatibilidade do WeasyPrint é realmente renderizando.
"""
from datetime import date, timedelta

import pytest

from app.schemas.report import ReportFormat, ReportRequest, ReportType
from app.services import report_service


@pytest.fixture
def stocked_client(fake_client):
    fake_client.tables["products"] = [
        {
            "id": "p1", "name": "Maçã Gala", "code": "FRT-0012", "category": "perecivel",
            "price": 42.9, "quantity": 5, "min_stock": 10,
            "expiry": (date.today() + timedelta(days=2)).isoformat(),
        },
        {
            "id": "p2", "name": "Fone Bluetooth", "code": "ELE-3010", "category": "eletronicos",
            "price": 149.9, "quantity": 33, "min_stock": 15, "expiry": None,
        },
    ]
    fake_client.tables["stock_movements"] = [
        {
            "id": "m1", "movement_type": "saida", "quantity_delta": -5, "note": "Venda balcão",
            "created_at": "2026-08-14T10:00:00Z", "product_id": "p1",
            "products": {"name": "Maçã Gala", "code": "FRT-0012"},
        },
    ]
    return fake_client


class TestGenerateReport:
    @pytest.mark.parametrize("report_type", list(ReportType))
    @pytest.mark.parametrize("fmt", list(ReportFormat))
    def test_gera_arquivo_para_cada_combinacao_de_tipo_e_formato(self, stocked_client, report_type, fmt):
        request = ReportRequest(
            report_type=report_type,
            format=fmt,
            date_from=date.today() - timedelta(days=7),
            date_to=date.today(),
        )

        content, filename, content_type = report_service.generate_report(
            stocked_client, "Empório Boa Safra", request
        )

        assert isinstance(content, bytes)
        assert len(content) > 0
        assert filename.startswith(report_type.value)
        assert filename.endswith(fmt.value)
        if fmt == ReportFormat.pdf:
            assert content.startswith(b"%PDF")
            assert content_type == "application/pdf"
        else:
            assert content_type.startswith("application/vnd.openxmlformats")

    def test_estoque_atual_calcula_valor_total_certo(self, stocked_client):
        request = ReportRequest(report_type=ReportType.stock_snapshot, format=ReportFormat.xlsx)

        content, _filename, _content_type = report_service.generate_report(
            stocked_client, "Empório Boa Safra", request
        )

        # 5 * 42.90 + 33 * 149.90 = 5157.20 — só confirmamos que os valores
        # aparecem no Excel gerado (evita regressão silenciosa na conta).
        import io

        import pandas as pd

        df = pd.read_excel(io.BytesIO(content))
        assert pytest.approx(df["Valor total (R$)"].sum(), rel=1e-3) == 5 * 42.9 + 33 * 149.9

    def test_produtos_a_vencer_respeita_a_janela_de_dias(self, stocked_client):
        # Maçã Gala vence em 2 dias — cabe numa janela de 1 dia? Não.
        request = ReportRequest(report_type=ReportType.expiry, format=ReportFormat.xlsx, expiry_window_days=1)

        content, _filename, _content_type = report_service.generate_report(
            stocked_client, "Empório Boa Safra", request
        )

        import io

        import pandas as pd

        df = pd.read_excel(io.BytesIO(content))
        assert len(df) == 0  # nada vence em 1 dia

    def test_tipo_de_relatorio_desconhecido_gera_erro(self, stocked_client):
        # Simula um valor fora do enum chegando até aqui (defesa extra).
        class FakeRequest:
            report_type = "algo-invalido"
            format = ReportFormat.pdf
            date_from = None
            date_to = None
            expiry_window_days = 15

        with pytest.raises(ValueError):
            report_service.generate_report(stocked_client, "Empório Boa Safra", FakeRequest())
