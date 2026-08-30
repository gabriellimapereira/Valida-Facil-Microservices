import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
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

# Configuração CORS abrangente para aceitar preflights OPTIONS de qualquer porta local / frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


app.include_router(companies.router, prefix="/companies", tags=["Empresas"])
app.include_router(movements.router, prefix="/movements", tags=["Movimentações"])
app.include_router(alerts.router, prefix="/alerts", tags=["Alertas"])
app.include_router(reports.router, prefix="/reports", tags=["Relatórios"])


@app.get("/health", tags=["Status"])
def health():
    return {"status": "ok", "environment": settings.environment}
