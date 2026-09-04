import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.scheduler import register_jobs, scheduler
from app.routers import alerts, companies, movements, reports

logging.basicConfig(level=logging.INFO)

_is_prod = settings.environment == "production"

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        register_jobs()
        scheduler.start()
    except Exception as exc:
        logging.warning("Scheduler não pôde ser iniciado em background: %s", exc)
    yield
    try:
        scheduler.shutdown(wait=False)
    except Exception:
        pass


app = FastAPI(
    title="Valida Fácil API",
    description="Backend complementar ao Supabase: onboarding de empresas, "
    "movimentações de estoque com alerta automático, checagem de validade "
    "e geração de relatórios em PDF/Excel.",
    version="1.0.0",
    lifespan=lifespan,
    # Desabilitar documentação interativa em produção para não expor o schema da API
    docs_url="/docs" if not _is_prod else None,
    redoc_url="/redoc" if not _is_prod else None,
    openapi_url="/openapi.json" if not _is_prod else None,
)

# Em produção, aceitar apenas o domínio configurado em FRONTEND_URL.
# Em desenvolvimento, aceitar qualquer localhost para facilitar o trabalho local.
_local_origins = [
    settings.frontend_url,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url] if _is_prod else _local_origins,
    allow_origin_regex=None if _is_prod else r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    expose_headers=["Content-Disposition"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    # HSTS só faz sentido em produção com HTTPS
    if _is_prod:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


api_router = APIRouter()
api_router.include_router(companies.router, prefix="/companies", tags=["Empresas"])
api_router.include_router(movements.router, prefix="/movements", tags=["Movimentações"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["Alertas"])
api_router.include_router(reports.router, prefix="/reports", tags=["Relatórios"])


@api_router.get("/health", tags=["Status"])
def health():
    # Não expõe detalhes do ambiente para não vazar informações de configuração
    return {"status": "ok"}


# Suporta tanto chamadas diretas quanto via rewrites do Vercel/proxies (/api/...)
app.include_router(api_router)
app.include_router(api_router, prefix="/api")
