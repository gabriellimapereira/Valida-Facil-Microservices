"""
Message Broker Híbrido (RabbitMQ AMQP + Outbox / Webhook HTTP/ASGI).

Garante comunicação assíncrona orientada a eventos entre os microsserviços:
- Em ambiente Docker/produção com `RABBITMQ_URL` configurado e `aio_pika` instalado,
  publica e consome mensagens persistentes via Exchange Topic `valida_facil.events`.
- Implementa Dead Letter Exchange (DLX) e Dead Letter Queue (DLQ) para isolamento
  de mensagens defeituosas (poison pills) após retentativas, garantindo zero travamento do fluxo.
- Também persiste na tabela `domain_events` (Transactional Outbox) quando disponível
  e entrega via HTTP/ASGI (`/internal/events`) nos ambientes sem RabbitMQ (testes/Vercel).
- Implementa idempotência por `event_id` para evitar processamento duplicado.
"""

import asyncio
from collections import deque
from datetime import datetime, timezone
import json
import logging
from typing import Any, Awaitable, Callable, Deque, Dict, List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field

from shared.config import settings
from shared.http_client import identity_client, stores_client, warehouse_client

logger = logging.getLogger("valida_facil.broker")


class DomainEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: str
    routing_key: str
    company_id: str
    aggregate_id: str
    source_service: str
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    correlation_id: Optional[str] = None
    payload: Dict[str, Any] = Field(default_factory=dict)


EVENT_ROUTING_TABLE: Dict[str, str] = {
    "REQUISICAO_CRIADA": "requisicao.criada",
    "REQUISICAO_APROVADA": "requisicao.aprovada",
    "REQUISICAO_DESPACHADA": "requisicao.despachada",
    "REQUISICAO_RECEBIDA": "requisicao.recebida",
    "REQUISICAO_CANCELADA": "requisicao.cancelada",
    "ESTOQUE_CRITICO": "estoque.critico",
    "MOVIMENTACAO_ARMAZEM": "estoque.movimentado",
    "MOVIMENTACAO_FILIAL": "loja.movimentado",
}

EVENT_SUBSCRIBERS: Dict[str, List[str]] = {
    "requisicao.criada": ["warehouse"],
    "requisicao.aprovada": ["warehouse"],
    "requisicao.despachada": ["warehouse", "stores"],
    "requisicao.recebida": ["warehouse"],
    "requisicao.cancelada": ["warehouse", "stores"],
    "estoque.critico": ["stores"],
}


class EventBroker:
    """Barramento de eventos distribuído com RabbitMQ AMQP, DLQ e fallback Outbox/HTTP."""

    def __init__(self):
        self._recent_events: Deque[Dict[str, Any]] = deque(maxlen=100)
        self._recent_dead_letters: Deque[Dict[str, Any]] = deque(maxlen=100)
        self._processed_ids: set[str] = set()
        self._consumer_task: Optional[asyncio.Task] = None

    def get_recent_events(self, limit: int = 25) -> List[Dict[str, Any]]:
        items = list(self._recent_events)
        return items[-limit:][::-1]

    def get_recent_dead_letters(self, limit: int = 25) -> List[Dict[str, Any]]:
        items = list(self._recent_dead_letters)
        return items[-limit:][::-1]

    def is_processed(self, event_id: str, db_client: Any = None) -> bool:
        if event_id in self._processed_ids:
            return True
        if db_client is not None:
            try:
                resp = (
                    db_client.table("processed_events")
                    .select("event_id")
                    .eq("event_id", event_id)
                    .maybe_single()
                    .execute()
                )
                if resp and resp.data:
                    self._processed_ids.add(event_id)
                    return True
            except Exception:
                pass
        return False

    def mark_processed(
        self, event_id: str, consumer_service: str, db_client: Any = None
    ) -> None:
        self._processed_ids.add(event_id)
        if db_client is not None:
            try:
                db_client.table("processed_events").insert(
                    {
                        "event_id": event_id,
                        "consumer_service": consumer_service,
                        "processed_at": datetime.now(timezone.utc).isoformat(),
                    }
                ).execute()
            except Exception:
                pass

    def _record_outbox(self, event: DomainEvent, db_client: Any = None) -> None:
        self._recent_events.append(event.model_dump())
        if db_client is None:
            return
        try:
            db_client.table("domain_events").insert(
                {
                    "id": event.event_id,
                    "company_id": event.company_id,
                    "aggregate_id": event.aggregate_id,
                    "event_type": event.event_type,
                    "routing_key": event.routing_key,
                    "source_service": event.source_service,
                    "payload": event.payload,
                    "status": "published",
                    "created_at": event.timestamp,
                }
            ).execute()
        except Exception as exc:
            logger.warning(
                "[Broker Outbox] Falha ao persistir evento no banco: %s", exc
            )

    async def publish(
        self,
        *,
        event_type: str,
        company_id: str,
        aggregate_id: str,
        source_service: str,
        payload: Dict[str, Any],
        db_client: Any = None,
        routing_key: Optional[str] = None,
        correlation_id: Optional[str] = None,
    ) -> DomainEvent:
        from shared.app_factory import get_correlation_id

        rk = routing_key or EVENT_ROUTING_TABLE.get(
            event_type, event_type.lower().replace("_", ".")
        )
        cid = correlation_id or get_correlation_id()
        event = DomainEvent(
            event_type=event_type,
            routing_key=rk,
            company_id=str(company_id),
            aggregate_id=str(aggregate_id),
            source_service=source_service,
            correlation_id=cid,
            payload=payload,
        )
        self._record_outbox(event, db_client=db_client)

        if settings.is_rabbitmq_configured:
            published_amqp = await self._publish_amqp(event)
            if published_amqp:
                return event

        await self._dispatch_webhooks(event)
        return event

    async def check_health(self) -> bool:
        """Verifica a conectividade ativa com o RabbitMQ ou modo in-memory."""
        if not settings.is_rabbitmq_configured:
            return True
        try:
            import aio_pika

            conn = await aio_pika.connect_robust(settings.rabbitmq_url, timeout=3.0)
            await conn.close()
            return True
        except Exception as exc:
            logger.warning("[Broker Health] RabbitMQ inacessível: %s", exc)
            return False

    async def _publish_amqp(self, event: DomainEvent) -> bool:
        try:
            import aio_pika  # type: ignore

            connection = await aio_pika.connect_robust(settings.rabbitmq_url, timeout=5)
            async with connection:
                channel = await connection.channel()
                exchange = await channel.declare_exchange(
                    settings.rabbitmq_exchange,
                    aio_pika.ExchangeType.TOPIC,
                    durable=True,
                )
                headers = {}
                if event.correlation_id:
                    headers["x-correlation-id"] = event.correlation_id
                    headers["x-request-id"] = event.correlation_id

                message = aio_pika.Message(
                    body=json.dumps(event.model_dump()).encode("utf-8"),
                    content_type="application/json",
                    delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                    message_id=event.event_id,
                    headers=headers,
                )
                await exchange.publish(message, routing_key=event.routing_key)
                logger.info(
                    "[Broker AMQP] Publicado %s (%s) id=%s cid=%s",
                    event.event_type,
                    event.routing_key,
                    event.event_id,
                    event.correlation_id,
                )
                return True
        except Exception as exc:
            logger.warning(
                "[Broker AMQP] Fallback para HTTP Outbox (%s): %s",
                event.routing_key,
                exc,
            )
            return False

    async def _dispatch_webhooks(self, event: DomainEvent) -> None:
        targets = EVENT_SUBSCRIBERS.get(event.routing_key, [])
        client_map = {
            "identity": identity_client,
            "warehouse": warehouse_client,
            "stores": stores_client,
        }
        for target_name in targets:
            if target_name == event.source_service:
                continue
            client = client_map.get(target_name)
            if not client:
                continue
            try:
                await client.post(
                    "/internal/events",
                    json=event.model_dump(),
                    internal=True,
                    timeout=5.0,
                )
            except Exception as exc:
                logger.debug(
                    "[Broker HTTP Fallback] Destino '%s' indisponível para %s: %s",
                    target_name,
                    event.routing_key,
                    exc,
                )

    async def _send_to_dlq(
        self,
        channel: Any,
        event: DomainEvent,
        error_message: str,
    ) -> None:
        """Encaminha uma mensagem para a Dead Letter Queue (DLQ) para análise posterior."""
        dl_record = {
            "event": event.model_dump(),
            "failed_at": datetime.now(timezone.utc).isoformat(),
            "error": error_message,
            "correlation_id": event.correlation_id,
        }
        self._recent_dead_letters.append(dl_record)

        if not settings.is_rabbitmq_configured:
            return

        try:
            import aio_pika

            dlx_name = f"{settings.rabbitmq_exchange}.dlx"
            dlx = await channel.declare_exchange(
                dlx_name,
                aio_pika.ExchangeType.TOPIC,
                durable=True,
            )
            msg = aio_pika.Message(
                body=json.dumps(event.model_dump()).encode("utf-8"),
                content_type="application/json",
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
                message_id=event.event_id,
                headers={
                    "x-death-reason": error_message[:250],
                    "x-original-routing-key": event.routing_key,
                    "x-correlation-id": event.correlation_id or "",
                    "x-failed-at": dl_record["failed_at"],
                },
            )
            await dlx.publish(msg, routing_key=f"dead-letter.{event.routing_key}")
            logger.info(
                "[Broker DLQ] Evento %s arquivado com sucesso na DLX '%s'",
                event.event_id,
                dlx_name,
            )
        except Exception as exc:
            logger.warning("[Broker DLQ] Falha ao publicar na DLX: %s", exc)

    def start_amqp_consumer(
        self,
        *,
        queue_name: str,
        binding_keys: List[str],
        handler: Callable[[DomainEvent], Awaitable[None]],
    ) -> None:
        if not settings.is_rabbitmq_configured:
            return

        async def _consume_loop():
            try:
                import aio_pika  # type: ignore
            except ImportError:
                logger.info(
                    "aio_pika não instalado — consumidor AMQP ignorado neste ambiente."
                )
                return

            while True:
                try:
                    connection = await aio_pika.connect_robust(
                        settings.rabbitmq_url, timeout=10
                    )
                    async with connection:
                        channel = await connection.channel()
                        await channel.set_qos(prefetch_count=10)
                        exchange = await channel.declare_exchange(
                            settings.rabbitmq_exchange,
                            aio_pika.ExchangeType.TOPIC,
                            durable=True,
                        )

                        # Configura Dead Letter Exchange (DLX) e Dead Letter Queue (DLQ)
                        dlx_name = f"{settings.rabbitmq_exchange}.dlx"
                        dlx = await channel.declare_exchange(
                            dlx_name,
                            aio_pika.ExchangeType.TOPIC,
                            durable=True,
                        )
                        dlq_name = f"{queue_name}.dlq"
                        dlq = await channel.declare_queue(dlq_name, durable=True)
                        await dlq.bind(dlx, routing_key="#")

                        # Declara fila de processamento principal (com fallback defensivo)
                        try:
                            queue = await channel.declare_queue(
                                queue_name,
                                durable=True,
                                arguments={
                                    "x-dead-letter-exchange": dlx_name,
                                    "x-dead-letter-routing-key": f"dead-letter.{queue_name}",
                                },
                            )
                        except Exception:
                            queue = await channel.declare_queue(
                                queue_name, durable=True
                            )

                        for key in binding_keys:
                            await queue.bind(exchange, routing_key=key)

                        logger.info(
                            "[Broker Consumer] Fila '%s' (DLQ: '%s') inscrita em %s",
                            queue_name,
                            dlq_name,
                            binding_keys,
                        )
                        async with queue.iterator() as queue_iter:
                            async for message in queue_iter:
                                event: Optional[DomainEvent] = None
                                try:
                                    data = json.loads(message.body.decode("utf-8"))
                                    event = DomainEvent(**data)
                                except Exception as parse_err:
                                    logger.error(
                                        "[Broker Consumer] Erro ao decodificar mensagem: %s",
                                        parse_err,
                                    )
                                    await message.reject(requeue=False)
                                    continue

                                # Retentativa local controlada antes de declarar falha definitiva
                                success = False
                                max_retries = 3
                                last_error: Optional[Exception] = None
                                for attempt in range(1, max_retries + 1):
                                    try:
                                        await handler(event)
                                        success = True
                                        break
                                    except Exception as exc:
                                        last_error = exc
                                        logger.warning(
                                            "[Broker Consumer] Erro ao processar evento %s (tentativa %d/%d): %s",
                                            event.event_id,
                                            attempt,
                                            max_retries,
                                            exc,
                                        )
                                        if attempt < max_retries:
                                            await asyncio.sleep(0.3 * attempt)

                                if success:
                                    await message.ack()
                                else:
                                    logger.error(
                                        "[Broker DLQ] Evento %s falhou após %d tentativas. Despachando para DLQ: %s",
                                        event.event_id,
                                        max_retries,
                                        last_error,
                                    )
                                    await self._send_to_dlq(
                                        channel, event, str(last_error)
                                    )
                                    await message.ack()
                except asyncio.CancelledError:
                    break
                except Exception as exc:
                    logger.warning(
                        "[Broker Consumer] Reconectando em 5s (%s): %s", queue_name, exc
                    )
                    await asyncio.sleep(5)

        self._consumer_task = asyncio.create_task(_consume_loop())

    async def stop_consumer(self) -> None:
        if self._consumer_task and not self._consumer_task.done():
            self._consumer_task.cancel()
            try:
                await self._consumer_task
            except asyncio.CancelledError:
                pass


broker = EventBroker()
