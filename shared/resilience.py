"""
Módulo de Resiliência Distribuída para Valida Fácil Microservices:
- Circuit Breaker (estados CLOSED, OPEN, HALF_OPEN) com fail-fast e canary probes.
- Retry com Exponential Backoff e Jitter para falhas temporárias de rede.
"""

import asyncio
from enum import Enum
import logging
import random
import time
from typing import Any, Awaitable, Callable, Dict, Optional

import httpx

logger = logging.getLogger("valida_facil.resilience")


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreakerOpenException(Exception):
    """Exceção levantada quando uma requisição é rejeitada porque o circuito está aberto."""

    def __init__(
        self,
        service_name: str,
        time_remaining: float,
        last_error: Optional[str] = None,
    ):
        self.service_name = service_name
        self.time_remaining = max(0.0, time_remaining)
        self.last_error = last_error
        msg = (
            f"Circuito aberto para o serviço '{service_name}'. "
            f"Tentativa de recuperação em {self.time_remaining:.1f}s. "
            f"Último erro registrado: {last_error or 'Desconhecido'}"
        )
        super().__init__(msg)


class CircuitBreaker:
    """
    Circuit Breaker com máquina de estados:
    - CLOSED: requisições normais; conta falhas consecutivas.
    - OPEN: fail-fast imediato sem realizar chamada I/O.
    - HALF_OPEN: permite requisições canary controladas após tempo de recuperação.
    """

    def __init__(
        self,
        service_name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 10.0,
        half_open_max_trials: int = 2,
    ):
        self.service_name = service_name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_trials = half_open_max_trials

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_state_change = time.time()
        self._last_failure_time: Optional[float] = None
        self._last_error: Optional[str] = None
        self._half_open_trials = 0

    @property
    def state(self) -> CircuitState:
        now = time.time()
        if self._state == CircuitState.OPEN:
            if now - self._last_state_change >= self.recovery_timeout:
                self._state = CircuitState.HALF_OPEN
                self._half_open_trials = 0
                logger.info(
                    "[CircuitBreaker:%s] Transição de OPEN para HALF_OPEN (iniciando teste canary)",
                    self.service_name,
                )
        return self._state

    def is_allowed(self) -> bool:
        current_state = self.state
        if current_state == CircuitState.CLOSED:
            return True
        if current_state == CircuitState.HALF_OPEN:
            if self._half_open_trials < self.half_open_max_trials:
                self._half_open_trials += 1
                return True
            return False
        return False

    def time_remaining_until_retry(self) -> float:
        if self._state != CircuitState.OPEN:
            return 0.0
        elapsed = time.time() - self._last_state_change
        return max(0.0, self.recovery_timeout - elapsed)

    def record_success(self) -> None:
        if self._state in (CircuitState.HALF_OPEN, CircuitState.OPEN):
            logger.info(
                "[CircuitBreaker:%s] Sucesso confirmado no estado %s. Circuito FECHADO (normalizado).",
                self.service_name,
                self._state.value,
            )
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._half_open_trials = 0
        self._last_error = None
        self._last_state_change = time.time()

    def record_failure(self, error: Optional[Exception] = None) -> None:
        self._last_failure_time = time.time()
        self._last_error = str(error) if error else "Erro desconhecido"

        if self._state == CircuitState.HALF_OPEN:
            logger.warning(
                "[CircuitBreaker:%s] Falha em teste canary (HALF_OPEN). Reabrindo circuito.",
                self.service_name,
            )
            self._state = CircuitState.OPEN
            self._last_state_change = time.time()
            return

        self._failure_count += 1
        if (
            self._failure_count >= self.failure_threshold
            and self._state == CircuitState.CLOSED
        ):
            logger.error(
                "[CircuitBreaker:%s] %d falhas consecutivas atingidas. Circuito ABERTO por %.1fs.",
                self.service_name,
                self.failure_threshold,
                self.recovery_timeout,
            )
            self._state = CircuitState.OPEN
            self._last_state_change = time.time()

    def get_status(self) -> Dict[str, Any]:
        return {
            "service": self.service_name,
            "state": self.state.value,
            "failure_count": self._failure_count,
            "failure_threshold": self.failure_threshold,
            "recovery_timeout_seconds": self.recovery_timeout,
            "time_remaining_seconds": round(self.time_remaining_until_retry(), 2),
            "last_error": self._last_error,
        }


# Exceções elegíveis para retry automático
RETRYABLE_EXCEPTIONS = (
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
    httpx.WriteError,
    httpx.RemoteProtocolError,
)

RETRYABLE_STATUS_CODES = {502, 503, 504}
SAFE_IDEMPOTENT_METHODS = {"GET", "HEAD", "OPTIONS", "PUT", "DELETE"}


async def execute_with_resilience(
    coroutine_fn: Callable[[], Awaitable[httpx.Response]],
    *,
    method: str,
    max_retries: int = 2,
    base_delay: float = 0.15,
    max_delay: float = 1.5,
    jitter: float = 0.05,
    circuit_breaker: Optional[CircuitBreaker] = None,
) -> httpx.Response:
    """
    Executa uma chamada HTTP com Circuit Breaker e Retry com Exponential Backoff + Jitter.
    """
    if circuit_breaker and not circuit_breaker.is_allowed():
        raise CircuitBreakerOpenException(
            circuit_breaker.service_name,
            circuit_breaker.time_remaining_until_retry(),
            circuit_breaker._last_error,
        )

    attempt = 0
    while True:
        try:
            resp = await coroutine_fn()

            # Status de indisponibilidade transitória em método idempotente
            if (
                resp.status_code in RETRYABLE_STATUS_CODES
                and method.upper() in SAFE_IDEMPOTENT_METHODS
                and attempt < max_retries
            ):
                attempt += 1
                delay = min(
                    max_delay, base_delay * (2 ** (attempt - 1))
                ) + random.uniform(0, jitter)
                logger.warning(
                    "[Retry] Status %d em %s. Tentativa %d/%d após %.2fs",
                    resp.status_code,
                    method,
                    attempt,
                    max_retries,
                    delay,
                )
                await asyncio.sleep(delay)
                continue

            if resp.status_code in RETRYABLE_STATUS_CODES:
                if circuit_breaker:
                    circuit_breaker.record_failure(
                        Exception(f"HTTP {resp.status_code}")
                    )
            elif resp.status_code < 500:
                if circuit_breaker:
                    circuit_breaker.record_success()

            return resp

        except Exception as exc:
            is_connect_error = isinstance(
                exc, (httpx.ConnectError, httpx.ConnectTimeout)
            )
            can_retry = (
                method.upper() in SAFE_IDEMPOTENT_METHODS or is_connect_error
            ) and isinstance(exc, RETRYABLE_EXCEPTIONS)

            if can_retry and attempt < max_retries:
                attempt += 1
                delay = min(
                    max_delay, base_delay * (2 ** (attempt - 1))
                ) + random.uniform(0, jitter)
                logger.warning(
                    "[Retry] Falha de rede (%s) em %s. Tentativa %d/%d após %.2fs: %s",
                    type(exc).__name__,
                    method,
                    attempt,
                    max_retries,
                    delay,
                    exc,
                )
                await asyncio.sleep(delay)
                continue

            if circuit_breaker:
                circuit_breaker.record_failure(exc)
            raise
