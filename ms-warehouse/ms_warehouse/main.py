"""
Aplicação FastAPI independente do Microsserviço 2 — Estoque / Armazém Central (CD).
Executa na porta 8002 no docker-compose e registra-se como `asgi://warehouse`.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from ms_warehouse.core.scheduler import register_jobs, scheduler
from ms_warehouse.routers import (
    alerts,
    categories,
    internal,
    movements,
    products,
    reports,
    warehouse,
)
from shared.app_factory import create_service_app
from shared.broker import DomainEvent, broker
from shared.config import settings
from shared.http_client import register_asgi_app


async def _on_amqp_event(event: DomainEvent) -> None:
    logging.getLogger("valida_facil.ms_warehouse").info(
        "Evento AMQP consumido pelo Armazém: %s (%s)", event.event_type, event.event_id
    )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    is_prod = settings.environment == "production"
    if not is_prod:
        try:
            register_jobs()
            scheduler.start()
        except Exception as exc:
            logging.warning("Scheduler do Armazém não pôde ser iniciado: %s", exc)

    broker.start_amqp_consumer(
        queue_name="fila.requisicoes.armazem",
        binding_keys=[
            "requisicao.criada",
            "requisicao.aprovada",
            "requisicao.cancelada",
        ],
        handler=_on_amqp_event,
    )
    yield
    await broker.stop_consumer()
    if not is_prod:
        try:
            scheduler.shutdown(wait=False)
        except Exception:
            pass


app = create_service_app(
    title="Valida Fácil — MS Warehouse (Armazém Central)",
    description="Microsserviço de estoque central, movimentações, regra FEFO, alertas e relatórios.",
    service_name="ms-warehouse",
    lifespan=lifespan,
)

for prefix in ("", "/api"):
    app.include_router(products.router, prefix=prefix)
    app.include_router(categories.router, prefix=prefix)
    app.include_router(
        movements.router, prefix=f"{prefix}/movements", tags=["Movimentações Central"]
    )
    app.include_router(
        alerts.router, prefix=f"{prefix}/alerts", tags=["Alertas & Validade"]
    )
    app.include_router(reports.router, prefix=f"{prefix}/reports", tags=["Relatórios"])
    app.include_router(
        warehouse.router, prefix=f"{prefix}/warehouse", tags=["Armazém Central FEFO"]
    )

app.include_router(internal.router, prefix="/internal", tags=["Interno S2S"])

register_asgi_app("warehouse", app)
