"""
Testes de Observabilidade Cloud-Native:
- Sondas de Nuvem: Liveness (/health/live) e Readiness (/health/ready)
- Distributed Tracing: Propagação de Correlation ID e Request ID
"""

import pytest
from fastapi.testclient import TestClient

from gateway.main import app as gateway_app
from ms_identity.main import app as identity_app
from ms_stores.main import app as stores_app
from ms_warehouse.main import app as warehouse_app
from shared.app_factory import set_correlation_id
from shared.broker import broker
from shared.config import settings
from shared.tracing import generate_correlation_id


@pytest.fixture
def gateway_client():
    return TestClient(gateway_app, base_url="http://testserver")


@pytest.fixture
def identity_client():
    return TestClient(identity_app, base_url="http://testserver")


@pytest.fixture
def warehouse_client():
    return TestClient(warehouse_app, base_url="http://testserver")


@pytest.fixture
def stores_client():
    return TestClient(stores_app, base_url="http://testserver")


class TestCloudNativeHealthProbes:
    def test_liveness_probes_todos_os_servicos_respondem_200_vivo(
        self, gateway_client, identity_client, warehouse_client, stores_client
    ):
        """Liveness probe deve responder 200 com status alive rapidamente sem checar I/O pesado."""
        for client, name in [
            (gateway_client, "api-gateway"),
            (identity_client, "ms-identity"),
            (warehouse_client, "ms-warehouse"),
            (stores_client, "ms-stores"),
        ]:
            resp = client.get("/health/live")
            assert resp.status_code == 200, f"Falha no liveness de {name}"
            data = resp.json()
            assert data["status"] == "alive"
            assert data["service"] == name

            # Também acessível com prefixo /api
            resp_api = client.get("/api/health/live")
            assert resp_api.status_code == 200

    def test_readiness_probes_com_dependencias_saudaveis_respondem_200_ready(
        self,
        gateway_client,
        identity_client,
        warehouse_client,
        stores_client,
        monkeypatch,
    ):
        """Readiness probe verifica banco de dados e broker."""
        self._use_healthy_service_databases(monkeypatch)
        for client, name in [
            (gateway_client, "api-gateway"),
            (identity_client, "ms-identity"),
            (warehouse_client, "ms-warehouse"),
            (stores_client, "ms-stores"),
        ]:
            resp = client.get("/health/ready")
            assert resp.status_code == 200, f"Falha no readiness de {name}: {resp.text}"
            data = resp.json()
            assert data["status"] == "ready"
            assert data["service"] == name

    def test_readiness_probe_retorna_503_quando_banco_falha(
        self, identity_client, monkeypatch
    ):
        """Se o banco de dados falhar, o readiness deve retornar 503 com not_ready."""
        from shared.database import DatabaseClient, _CLIENT_CACHE

        mock_url = "postgresql://user:pass@localhost:5435/valida_identity"
        monkeypatch.setattr(settings, "identity_database_url", mock_url)
        monkeypatch.setattr(settings, "database_url", "")
        mock_db = DatabaseClient(mock_url)
        monkeypatch.setattr(mock_db, "check_health", lambda: False)
        monkeypatch.setitem(_CLIENT_CACHE, mock_url, mock_db)

        resp = identity_client.get("/health/ready")
        assert resp.status_code == 503
        data = resp.json()
        assert data["status"] == "not_ready"
        assert data["checks"]["database"] == "unhealthy"

    def test_readiness_probe_retorna_503_quando_broker_falha(
        self, warehouse_client, monkeypatch
    ):
        """Se o broker falhar, o readiness deve retornar 503 com not_ready."""
        self._use_healthy_service_databases(monkeypatch)

        async def fake_broker_health():
            return False

        monkeypatch.setattr(broker, "check_health", fake_broker_health)

        resp = warehouse_client.get("/health/ready")
        assert resp.status_code == 503
        data = resp.json()
        assert data["status"] == "not_ready"
        assert data["checks"]["broker"] == "unhealthy"

    @staticmethod
    def _use_healthy_service_databases(monkeypatch):
        from shared.database import DatabaseClient, _CLIENT_CACHE

        service_urls = {
            "identity_database_url": "postgresql://identity:test@localhost/identity_test",
            "warehouse_database_url": "postgresql://warehouse:test@localhost/warehouse_test",
            "stores_database_url": "postgresql://stores:test@localhost/stores_test",
        }
        monkeypatch.setattr(settings, "database_url", "")
        for setting_name, url in service_urls.items():
            monkeypatch.setattr(settings, setting_name, url)
            client = DatabaseClient(url)
            monkeypatch.setattr(client, "check_health", lambda: True)
            monkeypatch.setitem(_CLIENT_CACHE, url, client)


class TestDistributedTracingCorrelationId:
    def test_requisicao_gera_correlation_id_quando_cliente_nao_envia(
        self, gateway_client
    ):
        """Se a requisição não possui Correlation ID, o sistema gera e devolve na resposta."""
        resp = gateway_client.get("/health/live")
        assert resp.status_code == 200
        cid = resp.headers.get("x-correlation-id")
        req_id = resp.headers.get("x-request-id")
        assert cid is not None and len(cid) > 10
        assert req_id == cid

    def test_requisicao_preserva_e_propaga_correlation_id_enviado_pelo_cliente(
        self, gateway_client
    ):
        """Se o cliente enviar X-Correlation-ID, o gateway e os microsserviços devem preservar exatamente o mesmo ID."""
        custom_id = "test-trace-id-abc-12345"
        resp = gateway_client.get(
            "/health/live", headers={"X-Correlation-ID": custom_id}
        )
        assert resp.status_code == 200
        assert resp.headers.get("x-correlation-id") == custom_id
        assert resp.headers.get("x-request-id") == custom_id

    def test_requisicao_aceita_x_request_id_como_correlation_id(self, identity_client):
        """X-Request-ID deve ser aceito como alias de Correlation ID."""
        custom_id = "req-id-789-xyz"
        resp = identity_client.get("/health/live", headers={"X-Request-ID": custom_id})
        assert resp.status_code == 200
        assert resp.headers.get("x-correlation-id") == custom_id
        assert resp.headers.get("x-request-id") == custom_id

    @pytest.mark.asyncio
    async def test_broker_publish_injeta_correlation_id_contextual_no_evento(self):
        """Eventos publicados no Broker herdam automaticamente o Correlation ID da requisição em andamento."""
        test_cid = f"trace-event-{generate_correlation_id()[:8]}"
        token = set_correlation_id(test_cid)
        try:
            event = await broker.publish(
                event_type="REQUISICAO_CRIADA",
                company_id="company-test-1",
                aggregate_id="req-test-1",
                source_service="stores",
                payload={"total_items": 1},
            )
            assert event.correlation_id == test_cid
        finally:
            from shared.tracing import reset_correlation_id

            reset_correlation_id(token)
