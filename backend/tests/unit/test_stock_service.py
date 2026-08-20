"""
Testes unitários de stock_service.py — a peça que registra movimentações
de estoque e decide quando disparar o alerta de estoque baixo.
"""
import pytest

from app.schemas.movement import MovementCreate, MovementResult
from app.services import stock_service


class TestApplyMovement:
    def test_monta_os_parametros_certos_para_o_rpc(self, fake_client):
        fake_client.rpc_results["apply_stock_movement"] = {
            "company_id": "11111111-1111-1111-1111-111111111111",
            "product_id": "22222222-2222-2222-2222-222222222222",
            "product_name": "Maçã Gala",
            "previous_quantity": 20,
            "new_quantity": 15,
            "min_stock": 10,
            "crossed_low_stock": False,
            "notification_email": "estoque@empresa.com",
        }
        payload = MovementCreate(
            product_id="22222222-2222-2222-2222-222222222222", movement_type="saida", quantity_delta=-5, note="Venda balcão"
        )

        result = stock_service.apply_movement(fake_client, payload)

        assert isinstance(result, MovementResult)
        assert result.new_quantity == 15
        # Confirma que o RPC foi chamado com os nomes de parâmetro certos
        # (p_product_id, p_movement_type, etc.) — um erro de digitação aqui
        # só apareceria em produção, contra o banco real, sem esse teste.
        rpc_name, rpc_params = fake_client.rpc_calls[0]
        assert rpc_name == "apply_stock_movement"
        assert rpc_params == {
            "p_product_id": "22222222-2222-2222-2222-222222222222",
            "p_movement_type": "saida",
            "p_quantity_delta": -5,
            "p_note": "Venda balcão",
        }

    def test_normaliza_retorno_em_lista_do_postgres(self, fake_client):
        # Dependendo de como a função SQL é declarada, o supabase-py pode
        # devolver uma lista com um item em vez de um objeto único.
        fake_client.rpc_results["apply_stock_movement"] = [
            {
                "company_id": "11111111-1111-1111-1111-111111111111",
                "product_id": "22222222-2222-2222-2222-222222222222",
                "product_name": "Maçã Gala",
                "previous_quantity": 5,
                "new_quantity": 10,
                "min_stock": 10,
                "crossed_low_stock": False,
                "notification_email": None,
            }
        ]
        payload = MovementCreate(product_id="22222222-2222-2222-2222-222222222222", movement_type="entrada", quantity_delta=5)

        result = stock_service.apply_movement(fake_client, payload)

        assert result.new_quantity == 10

    def test_levanta_erro_quando_rpc_nao_devolve_nada(self, fake_client):
        fake_client.rpc_results["apply_stock_movement"] = []
        payload = MovementCreate(product_id="22222222-2222-2222-2222-222222222222", movement_type="entrada", quantity_delta=5)

        with pytest.raises(ValueError):
            stock_service.apply_movement(fake_client, payload)


class TestNotifyLowStockIfNeeded:
    def _result(self, **overrides):
        base = dict(
            company_id="11111111-1111-1111-1111-111111111111",
            product_id="22222222-2222-2222-2222-222222222222",
            product_name="Maçã Gala",
            previous_quantity=12,
            new_quantity=5,
            min_stock=10,
            crossed_low_stock=True,
            notification_email="estoque@empresa.com",
        )
        base.update(overrides)
        return MovementResult(**base)

    def test_envia_email_quando_cruzou_o_minimo(self, monkeypatch):
        sent = {}

        def fake_send_email(to, subject, html_body):
            sent["to"] = to
            sent["subject"] = subject
            return True

        monkeypatch.setattr(stock_service, "send_email", fake_send_email)

        stock_service.notify_low_stock_if_needed(self._result(), company_name="Empório Boa Safra")

        assert sent["to"] == "estoque@empresa.com"
        assert "Maçã Gala" in sent["subject"]

    def test_nao_envia_quando_nao_cruzou_o_minimo(self, monkeypatch):
        calls = []
        monkeypatch.setattr(stock_service, "send_email", lambda **kwargs: calls.append(kwargs))

        stock_service.notify_low_stock_if_needed(
            self._result(crossed_low_stock=False), company_name="Empório Boa Safra"
        )

        assert calls == []

    def test_nao_envia_sem_email_de_notificacao_cadastrado(self, monkeypatch):
        calls = []
        monkeypatch.setattr(stock_service, "send_email", lambda **kwargs: calls.append(kwargs))

        stock_service.notify_low_stock_if_needed(
            self._result(notification_email=None), company_name="Empório Boa Safra"
        )

        assert calls == []


class TestListLowStock:
    def test_filtra_apenas_produtos_abaixo_do_minimo(self, fake_client):
        fake_client.tables["products"] = [
            {"id": "p1", "name": "Maçã Gala", "quantity": 5, "min_stock": 10},
            {"id": "p2", "name": "Fone Bluetooth", "quantity": 33, "min_stock": 15},
            {"id": "p3", "name": "Morango", "quantity": 10, "min_stock": 10},  # empatado conta
        ]

        low_stock = stock_service.list_low_stock(fake_client)

        ids = {p["id"] for p in low_stock}
        assert ids == {"p1", "p3"}
