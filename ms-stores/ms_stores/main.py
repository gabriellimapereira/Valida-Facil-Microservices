"""
Aplicação FastAPI independente do Microsserviço 3 — Lojas Filiais & Requisições.
Executa na porta 8003 no docker-compose e registra-se como `asgi://stores`.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from ms_stores.routers import internal, requisitions, stores
from shared.app_factory import create_service_app
from shared.broker import DomainEvent, broker
from shared.http_client import register_asgi_app


async def _on_amqp_event(event: DomainEvent) -> None:
    logging.getLogger("valida_facil.ms_stores").info(
        "Evento AMQP consumido pelo MS Lojas: %s (%s)", event.event_type, event.event_id
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    broker.start_amqp_consumer(
        queue_name="fila.notificacoes.lojas",
        binding_keys=[
            "requisicao.despachada",
            "requisicao.cancelada",
            "estoque.critico",
        ],
        handler=_on_amqp_event,
    )
    yield
    await broker.stop_consumer()


app = create_service_app(
    title="Valida Fácil — MS Stores & Requisitions",
    description="Microsserviço responsável por lojas filiais, inventário local e workflow de requisições.",
    service_name="ms-stores",
    lifespan=lifespan,
)

for prefix in ("", "/api"):
    app.include_router(stores.router, prefix=f"{prefix}/stores", tags=["Lojas Filiais"])
    app.include_router(
        requisitions.router, prefix=f"{prefix}/requisitions", tags=["Requisições"]
    )

app.include_router(internal.router, prefix="/internal", tags=["Interno S2S"])

register_asgi_app("stores", app)
