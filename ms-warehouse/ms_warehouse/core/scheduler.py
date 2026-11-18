"""
Agendador de tarefas em background (roda dentro do próprio processo da
API). Hoje só tem o job diário de checagem de validade; dá pra adicionar
outros (ex.: relatório semanal automático) do mesmo jeito.

Para maior robustez em produção (não depender do processo do FastAPI
estar sempre de pé), essa checagem também pode ser migrada futuramente
para um agendador gerenciado do PostgreSQL — mas para
o estágio atual do projeto, isso aqui já resolve.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from ms_warehouse.services.expiry_service import run_expiry_check_all_companies

logger = logging.getLogger("valida_facil.scheduler")

scheduler = AsyncIOScheduler(timezone="America/Sao_Paulo")


def register_jobs() -> None:
    scheduler.add_job(
        run_expiry_check_all_companies,
        trigger="cron",
        hour=7,
        minute=0,
        id="expiry_check_daily",
        replace_existing=True,
    )
    logger.info("Jobs agendados registrados.")
