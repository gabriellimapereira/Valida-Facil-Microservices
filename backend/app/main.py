import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.scheduler import register_jobs, scheduler
from app.routers import alerts, companies, movements, reports

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    register_jobs()
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="Valida Fácil API",
    description="Backend complementar ao Supabase: onboarding de empresas, "
    "movimentações de estoque com alerta automático, checagem de validade "
    "e geração de relatórios em PDF/Excel.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(companies.router, prefix="/companies", tags=["Empresas"])
app.include_router(movements.router, prefix="/movements", tags=["Movimentações"])
app.include_router(alerts.router, prefix="/alerts", tags=["Alertas"])
app.include_router(reports.router, prefix="/reports", tags=["Relatórios"])


@app.get("/health", tags=["Status"])
def health():
    return {"status": "ok", "environment": settings.environment}
