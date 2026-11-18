"""
Fábrica padrão de aplicações FastAPI para o API Gateway e os Microsserviços.
Aplica CORS, Correlation ID distribuído, headers de segurança, tratamento global de exceções
e sondas de integridade para nuvem (/health, /health/live, /health/ready).
"""

import logging
from typing import Any, Callable, Optional

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from shared.config import settings
from shared.database import reset_current_service_name, set_current_service_name
from shared.tracing import (
    generate_correlation_id,
    get_correlation_id,
    reset_correlation_id,
    set_correlation_id,
)

__all__ = [
    "create_service_app",
    "get_correlation_id",
    "set_correlation_id",
    "reset_correlation_id",
    "generate_correlation_id",
]


def create_service_app(
    *,
    title: str,
    description: str,
    service_name: str,
    lifespan: Optional[Callable[[FastAPI], Any]] = None,
    version: str = "2.0.0",
    include_health: bool = True,
) -> FastAPI:
    settings.validate_production_security()
    is_prod = settings.is_production

    app = FastAPI(
        title=title,
        description=description,
        version=version,
        lifespan=lifespan,
        docs_url="/docs" if not is_prod else None,
        redoc_url="/redoc" if not is_prod else None,
        openapi_url="/openapi.json" if not is_prod else None,
    )
    app.state.service_name = service_name

    local_origins = [
        *settings.allowed_cors_origins,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]
    origin_regex = (
        r"^https://([a-zA-Z0-9_-]+\.)?vercel\.app$"
        if is_prod
        else r"^(https?://(localhost|127\.0\.0\.1)(:\d+)?|https://([a-zA-Z0-9_-]+\.)?vercel\.app)$"
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_cors_origins if is_prod else local_origins,
        allow_origin_regex=origin_regex,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Accept",
            "X-Correlation-ID",
            "X-Request-ID",
            "X-Internal-Service-Token",
        ],
        expose_headers=[
            "Content-Disposition",
            "X-Correlation-ID",
            "X-Request-ID",
            "X-Service-Name",
            "X-Gateway",
        ],
    )

    @app.middleware("http")
    async def correlation_id_middleware(request: Request, call_next):
        """
        Extrai ou gera um Correlation ID / Request ID para a requisição.
        Propaga no contexto assíncrono e injeta nos headers de resposta.
        """
        raw_cid = (
            request.headers.get("x-correlation-id")
            or request.headers.get("x-request-id")
            or generate_correlation_id()
        )
        cid = raw_cid.strip() or generate_correlation_id()
        token = set_correlation_id(cid)
        service_token = set_current_service_name(service_name)
        try:
            response = await call_next(request)
            response.headers["X-Correlation-ID"] = cid
            response.headers["X-Request-ID"] = cid
            return response
        finally:
            reset_current_service_name(service_token)
            reset_correlation_id(token)

    @app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )
        response.headers.setdefault("X-Service-Name", service_name)
        if is_prod:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        cid = get_correlation_id()
        logging.exception(
            "[%s] Exceção não tratada no serviço '%s' em %s: %s",
            cid,
            service_name,
            request.url.path,
            exc,
        )
        msg = str(exc)
        if not is_prod:
            detail = f"Erro interno ({type(exc).__name__}): {msg}"
        else:
            detail = "Ocorreu um erro interno no servidor. Tente novamente mais tarde."
        headers = {"X-Correlation-ID": cid, "X-Request-ID": cid} if cid else None
        return JSONResponse(
            status_code=500,
            content={"detail": detail, "correlation_id": cid},
            headers=headers,
        )

    if include_health:
        health_router = APIRouter()

        @health_router.get("/health", tags=["Status"])
        def health():
            return {
                "status": "ok",
                "service": service_name,
                "version": version,
                "environment": settings.environment,
                "has_database_url": bool(settings.database_url_for(service_name)),
                "rabbitmq_configured": settings.is_rabbitmq_configured,
            }

        @health_router.get("/health/live", tags=["Status"])
        def liveness():
            """
            Liveness probe para Kubernetes/ECS/Docker:
            Indica se o processo está ativo e o loop de eventos responsivo.
            Não consulta dependências externas para evitar reinicializações em cascata.
            """
            return {
                "status": "alive",
                "service": service_name,
                "version": version,
            }

        @health_router.get("/health/ready", tags=["Status"])
        async def readiness():
            """
            Readiness probe para Kubernetes/ECS/Docker:
            Indica se o microsserviço está pronto para receber tráfego,
            testando conectividade com o seu banco dedicado e com o broker.
            """
            from shared.broker import broker
            from shared.database import get_db

            checks: dict[str, str] = {}

            # 1. Checagem do Banco de Dados dedicado
            try:
                db = get_db(service_name)
                if hasattr(db, "check_health"):
                    db_ok = db.check_health()
                else:
                    db_ok = True
                checks["database"] = "ok" if db_ok else "unhealthy"
            except Exception as exc:
                checks["database"] = f"error: {str(exc)}"

            # 2. Checagem do Broker (RabbitMQ ou Outbox)
            try:
                broker_ok = await broker.check_health()
                checks["broker"] = "ok" if broker_ok else "unhealthy"
            except Exception as exc:
                checks["broker"] = f"error: {str(exc)}"

            is_ready = all(v == "ok" for v in checks.values())
            status_code = 200 if is_ready else 503
            return JSONResponse(
                status_code=status_code,
                content={
                    "status": "ready" if is_ready else "not_ready",
                    "service": service_name,
                    "version": version,
                    "checks": checks,
                },
            )

        app.include_router(health_router)
        app.include_router(health_router, prefix="/api")

    return app
