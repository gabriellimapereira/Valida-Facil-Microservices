"""
Distributed Tracing e Propagação de Correlation ID / Request ID.

Permite rastrear o ciclo de vida completo de cada transação de negócio
através do API Gateway, microsserviços, chamadas HTTP S2S e eventos assíncronos no RabbitMQ/Outbox.
"""

import contextvars
import uuid

_CORRELATION_ID_CTX: contextvars.ContextVar[str] = contextvars.ContextVar(
    "correlation_id", default=""
)


def get_correlation_id() -> str:
    """Retorna o Correlation ID do contexto assíncrono atual."""
    return _CORRELATION_ID_CTX.get()


def set_correlation_id(correlation_id: str) -> contextvars.Token:
    """Define o Correlation ID para o contexto assíncrono atual."""
    return _CORRELATION_ID_CTX.set(correlation_id)


def reset_correlation_id(token: contextvars.Token) -> None:
    """Restaura o contexto anterior do Correlation ID."""
    _CORRELATION_ID_CTX.reset(token)


def generate_correlation_id() -> str:
    """Gera um novo identificador único de correlação (UUID v4)."""
    return str(uuid.uuid4())
