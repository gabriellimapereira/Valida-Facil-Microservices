"""
Testes de Resiliência Distribuída e Dead Letter Queue (DLQ):
- Circuit Breaker (estados CLOSED -> OPEN -> HALF_OPEN -> CLOSED)
- Fail-fast com HTTP 503 e cabeçalho Retry-After no API Gateway
- Retry automático com Exponential Backoff para falhas transitórias
- Roteamento e arquivamento de eventos defeituosos na DLQ do Broker
"""

import time
import httpx
import pytest
from fastapi.testclient import TestClient

from gateway.main import app as gateway_app
from shared.broker import DomainEvent, broker
from shared.http_client import warehouse_client
from shared.resilience import (
    CircuitBreaker,
    CircuitState,
    execute_with_resilience,
)


@pytest.fixture
def gateway_client():
    return TestClient(gateway_app, base_url="http://testserver")


class TestCircuitBreakerStates:
    def test_circuito_inicia_fechado_e_abre_apos_limite_de_falhas(self):
        cb = CircuitBreaker("teste-service", failure_threshold=3, recovery_timeout=0.5)
        assert cb.state == CircuitState.CLOSED
        assert cb.is_allowed() is True

        # 2 falhas: circuito ainda fechado
        cb.record_failure(Exception("Falha 1"))
        cb.record_failure(Exception("Falha 2"))
        assert cb.state == CircuitState.CLOSED
        assert cb.is_allowed() is True

        # 3ª falha: atinge o threshold -> transita para OPEN
        cb.record_failure(Exception("Falha 3"))
        assert cb.state == CircuitState.OPEN
        assert cb.is_allowed() is False
        assert cb.time_remaining_until_retry() > 0

    def test_circuito_aberto_transita_para_half_open_apos_tempo_de_recuperacao(self):
        cb = CircuitBreaker("teste-service", failure_threshold=2, recovery_timeout=0.2)
        cb.record_failure(Exception("Erro A"))
        cb.record_failure(Exception("Erro B"))
        assert cb.state == CircuitState.OPEN

        # Aguarda passar o tempo de recuperação
        time.sleep(0.25)
        assert cb.state == CircuitState.HALF_OPEN
        assert cb.is_allowed() is True  # Permite tentativa canary

    def test_sucesso_em_half_open_fecha_o_circuito(self):
        cb = CircuitBreaker("teste-service", failure_threshold=2, recovery_timeout=0.1)
        cb.record_failure(Exception("Erro 1"))
        cb.record_failure(Exception("Erro 2"))
        assert cb.state == CircuitState.OPEN

        time.sleep(0.15)
        assert cb.state == CircuitState.HALF_OPEN

        # Sucesso confirma recuperação do serviço downstream
        cb.record_success()
        assert cb.state == CircuitState.CLOSED
        assert cb._failure_count == 0

    def test_falha_em_half_open_reabre_o_circuito_imediatamente(self):
        cb = CircuitBreaker("teste-service", failure_threshold=2, recovery_timeout=0.1)
        cb.record_failure(Exception("Erro 1"))
        cb.record_failure(Exception("Erro 2"))

        time.sleep(0.15)
        assert cb.state == CircuitState.HALF_OPEN

        # Falha em teste canary reabre o circuito
        cb.record_failure(Exception("Erro persistente no canary"))
        assert cb.state == CircuitState.OPEN


class TestRetryWithExponentialBackoff:
    @pytest.mark.asyncio
    async def test_retry_recupera_quando_falha_transitoria_e_resolvida(self):
        attempts = 0

        async def unstable_downstream():
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                # 1ª tentativa falha com 503 temporário
                return httpx.Response(status_code=503, content=b"Busy")
            # 2ª tentativa responde 200 OK
            return httpx.Response(status_code=200, content=b'{"ok": true}')

        cb = CircuitBreaker("unstable", failure_threshold=5)
        resp = await execute_with_resilience(
            unstable_downstream,
            method="GET",
            max_retries=2,
            base_delay=0.01,
            jitter=0.0,
            circuit_breaker=cb,
        )

        assert attempts == 2
        assert resp.status_code == 200
        assert cb.state == CircuitState.CLOSED

    @pytest.mark.asyncio
    async def test_post_nao_idempotente_nao_repete_se_servidor_ja_respondeu(self):
        attempts = 0

        async def failing_post():
            nonlocal attempts
            attempts += 1
            return httpx.Response(status_code=500, content=b"Internal Error")

        cb = CircuitBreaker("post-service", failure_threshold=5)
        resp = await execute_with_resilience(
            failing_post,
            method="POST",
            max_retries=2,
            base_delay=0.01,
            jitter=0.0,
            circuit_breaker=cb,
        )

        # POST não é seguro/idempotente: não deve tentar novamente para não duplicar efeitos colaterais
        assert attempts == 1
        assert resp.status_code == 500


class TestGatewayResilienceIntegration:
    def test_gateway_retorna_503_com_retry_after_quando_circuit_breaker_abre(
        self, gateway_client, monkeypatch
    ):
        # Simula o Circuit Breaker do warehouse aberto
        cb = warehouse_client.circuit_breaker
        cb._state = CircuitState.OPEN
        cb._last_state_change = time.time()
        cb.recovery_timeout = 15.0

        try:
            resp = gateway_client.get("/api/products")
            assert resp.status_code == 503
            data = resp.json()
            assert data["circuit_breaker"] == "open"
            assert data["service"] == "ms-warehouse"
            assert "Retry-After" in resp.headers
        finally:
            # Restaura circuito fechado para não afetar outros testes
            cb.record_success()

    def test_endpoint_gateway_resilience_reporta_status_dos_circuitos(
        self, gateway_client
    ):
        resp = gateway_client.get("/api/gateway/resilience")
        assert resp.status_code == 200
        data = resp.json()
        assert "circuit_breakers" in data
        assert "identity" in data["circuit_breakers"]
        assert "warehouse" in data["circuit_breakers"]
        assert "stores" in data["circuit_breakers"]
        assert "dead_letter_queue" in data


class TestDeadLetterQueue:
    @pytest.mark.asyncio
    async def test_evento_com_falha_persistente_vai_para_dlq(self):
        # Cria um evento defeituoso para teste de DLQ
        event = DomainEvent(
            event_type="REQUISICAO_CRIADA",
            routing_key="requisicao.criada",
            company_id="company-dlq-test",
            aggregate_id="req-dlq-123",
            source_service="stores",
            correlation_id="trace-dlq-abc",
            payload={"corrupted": True},
        )

        initial_count = len(broker.get_recent_dead_letters(limit=100))
        # Invoca _send_to_dlq
        await broker._send_to_dlq(
            channel=None, event=event, error_message="Simulated poison pill payload"
        )

        dead_letters = broker.get_recent_dead_letters(limit=10)
        assert len(broker.get_recent_dead_letters(limit=100)) == initial_count + 1
        latest = dead_letters[0]
        assert latest["event"]["aggregate_id"] == "req-dlq-123"
        assert latest["correlation_id"] == "trace-dlq-abc"
        assert "poison pill" in latest["error"]
