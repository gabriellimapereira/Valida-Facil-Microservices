"""
API Gateway (Ponto Único de Entrada HTTP - Porta 8000).

Responsabilidades:
- Roteamento dinâmico por domínio para os 3 microsserviços:
  • /companies/*          -> MS Identity & Tenants (porta 8001)
  • /movements|alerts|reports|warehouse/* -> MS Warehouse (porta 8002)
  • /stores|requisitions/* -> MS Stores & Requisitions (porta 8003)
- Políticas de segurança centralizadas (CORS, headers OWASP, isolamento de exceções).
- Health-check agregado dos microsserviços e telemetria do barramento de eventos.
- Suporte transparente a contêineres separados via HTTP (`http://ms-*:800x`)
  ou modo in-process ASGI (`asgi://*`) para deploy serverless (Vercel) e testes.
"""

import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, Tuple

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from shared.app_factory import create_service_app
from shared.auth import AuthedUser, get_current_user_with_company
from shared.broker import broker
from shared.config import settings
from shared.resilience import CircuitBreakerOpenException
from shared.storage import storage_service
from shared.http_client import (
    ServiceHttpClient,
    identity_client,
    reset_active_source_app,
    set_active_source_app,
    stores_client,
    warehouse_client,
)

logger = logging.getLogger("valida_facil.gateway")

# Carrega apps ASGI locais sempre que algum destino estiver em modo asgi://
_LOADED_ASGI = False


def _ensure_local_service_paths() -> None:
    repo_root = Path(__file__).resolve().parent.parent.parent
    for rel in ("", "api-gateway", "ms-identity", "ms-warehouse", "ms-stores"):
        candidate = str(repo_root / rel) if rel else str(repo_root)
        if candidate not in sys.path:
            sys.path.insert(0, candidate)


def _ensure_asgi_microservices_loaded() -> None:
    global _LOADED_ASGI
    if _LOADED_ASGI:
        return
    if any(
        url.startswith("asgi://")
        for url in (
            settings.identity_service_url,
            settings.warehouse_service_url,
            settings.stores_service_url,
        )
    ):
        _ensure_local_service_paths()
    if settings.identity_service_url.startswith("asgi://"):
        import ms_identity.main  # noqa: F401
    if settings.warehouse_service_url.startswith("asgi://"):
        import ms_warehouse.main  # noqa: F401
    if settings.stores_service_url.startswith("asgi://"):
        import ms_stores.main  # noqa: F401
    _LOADED_ASGI = True


_ensure_asgi_microservices_loaded()

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-length",
    "content-encoding",
}


def _resolve_upstream(
    clean_path: str,
) -> Tuple[str, ServiceHttpClient] | Tuple[None, None]:
    if (
        clean_path == "/companies"
        or clean_path.startswith("/companies/")
        or clean_path == "/auth"
        or clean_path.startswith("/auth/")
    ):
        return "ms-identity", identity_client
    if (
        clean_path == "/movements"
        or clean_path.startswith("/movements/")
        or clean_path == "/alerts"
        or clean_path.startswith("/alerts/")
        or clean_path == "/reports"
        or clean_path.startswith("/reports/")
        or clean_path == "/warehouse"
        or clean_path.startswith("/warehouse/")
        or clean_path == "/products"
        or clean_path.startswith("/products/")
        or clean_path == "/categories"
        or clean_path.startswith("/categories/")
    ):
        return "ms-warehouse", warehouse_client
    if (
        clean_path == "/stores"
        or clean_path.startswith("/stores/")
        or clean_path == "/requisitions"
        or clean_path.startswith("/requisitions/")
    ):
        return "ms-stores", stores_client
    return None, None


@asynccontextmanager
async def _gateway_lifespan(_app: FastAPI):
    _ensure_asgi_microservices_loaded()
    logger.info(
        "API Gateway iniciado [identity=%s, warehouse=%s, stores=%s]",
        settings.identity_service_url,
        settings.warehouse_service_url,
        settings.stores_service_url,
    )
    yield


app = create_service_app(
    title="Valida Fácil — API Gateway",
    description="Gateway único orquestrando os microsserviços de Identidade, Armazém Central (FEFO) e Lojas/Requisições.",
    service_name="api-gateway",
    lifespan=_gateway_lifespan,
    include_health=False,
)


async def _probe_service(
    name: str, client: ServiceHttpClient, url: str
) -> Dict[str, Any]:
    token = set_active_source_app(app)
    try:
        resp = await client.get("/health", internal=False, timeout=3.0)
        ok = resp.status_code == 200
        return {
            "service": name,
            "url": url,
            "status": "ok" if ok else "degraded",
            "status_code": resp.status_code,
        }
    except Exception as exc:
        return {
            "service": name,
            "url": url,
            "status": "unreachable",
            "error": str(exc),
        }
    finally:
        reset_active_source_app(token)


async def _aggregated_health() -> Dict[str, Any]:
    checks = await asyncio.gather(
        _probe_service("ms-identity", identity_client, settings.identity_service_url),
        _probe_service(
            "ms-warehouse", warehouse_client, settings.warehouse_service_url
        ),
        _probe_service("ms-stores", stores_client, settings.stores_service_url),
    )
    all_ok = all(c["status"] == "ok" for c in checks)
    return {
        "status": "ok" if all_ok else "degraded",
        "service": "api-gateway",
        "environment": settings.environment,
        "object_storage": "local-volume",
        "broker_mode": "rabbitmq-amqp"
        if settings.is_rabbitmq_configured
        else "outbox-http",
        "services": checks,
        "circuit_breakers": {
            "identity": identity_client.get_circuit_status(),
            "warehouse": warehouse_client.get_circuit_status(),
            "stores": stores_client.get_circuit_status(),
        },
    }


@app.get("/health", tags=["Gateway"])
@app.get("/api/health", tags=["Gateway"])
async def gateway_health():
    return await _aggregated_health()


@app.get("/health/live", tags=["Gateway"])
@app.get("/api/health/live", tags=["Gateway"])
def gateway_liveness():
    """Liveness probe do API Gateway: indica que o processo e loop assíncrono estão responsivos."""
    return {
        "status": "alive",
        "service": "api-gateway",
        "environment": settings.environment,
    }


@app.get("/health/ready", tags=["Gateway"])
@app.get("/api/health/ready", tags=["Gateway"])
async def gateway_readiness():
    """Readiness probe do API Gateway: valida saúde dos microsserviços upstream e broker."""
    checks = await asyncio.gather(
        _probe_service("ms-identity", identity_client, settings.identity_service_url),
        _probe_service(
            "ms-warehouse", warehouse_client, settings.warehouse_service_url
        ),
        _probe_service("ms-stores", stores_client, settings.stores_service_url),
    )
    broker_ok = await broker.check_health()
    all_ok = all(c["status"] == "ok" for c in checks) and broker_ok
    status_code = 200 if all_ok else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if all_ok else "not_ready",
            "service": "api-gateway",
            "broker": "ok" if broker_ok else "unhealthy",
            "services": checks,
        },
    )


@app.get("/gateway/topology", tags=["Gateway"])
@app.get("/api/gateway/topology", tags=["Gateway"])
async def gateway_topology(user: AuthedUser = Depends(get_current_user_with_company)):
    health_data = await _aggregated_health()
    company_events = [
        ev
        for ev in broker.get_recent_events(limit=30)
        if ev.get("company_id") == str(user.company_id)
    ]
    return {
        **health_data,
        "recent_events": company_events[:15],
    }


@app.get("/gateway/resilience", tags=["Gateway"])
@app.get("/api/gateway/resilience", tags=["Gateway"])
def gateway_resilience():
    """Retorna métricas de saúde dos Circuit Breakers e mensagens na Dead Letter Queue (DLQ)."""
    return {
        "service": "api-gateway",
        "circuit_breakers": {
            "identity": identity_client.get_circuit_status(),
            "warehouse": warehouse_client.get_circuit_status(),
            "stores": stores_client.get_circuit_status(),
        },
        "dead_letter_queue": {
            "total_recent": len(broker.get_recent_dead_letters(limit=100)),
            "recent_events": broker.get_recent_dead_letters(limit=15),
        },
    }


@app.get("/storage/{bucket}/{file_path:path}", tags=["Storage"])
@app.get("/api/storage/{bucket}/{file_path:path}", tags=["Storage"])
async def serve_storage_file(bucket: str, file_path: str):
    """Serve arquivos e relatórios armazenados no Object Storage autônomo."""
    file_info = storage_service.get_file(bucket, file_path)
    if not file_info:
        raise HTTPException(
            status_code=404, detail="Arquivo não encontrado no armazenamento."
        )
    content, mime_type = file_info
    return Response(
        content=content,
        media_type=mime_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.api_route(
    "/{full_path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    include_in_schema=False,
)
async def proxy_to_microservice(full_path: str, request: Request):
    path = f"/{full_path}".rstrip("/") or "/"
    clean_path = (
        path[4:] if path.startswith("/api/") else ("/" if path == "/api" else path)
    )
    if not clean_path.startswith("/"):
        clean_path = f"/{clean_path}"

    service_label, upstream = _resolve_upstream(clean_path)
    if upstream is None or service_label is None:
        raise HTTPException(
            status_code=404, detail="Rota não encontrada no API Gateway."
        )

    fwd_headers = {
        k: v.strip()
        for k, v in request.headers.items()
        if k.lower() not in ("host", "content-length", "x-internal-service-token")
        and v.strip()
    }
    body = await request.body()

    token = set_active_source_app(app)
    try:
        upstream_resp = await upstream.request(
            method=request.method,
            path=clean_path,
            headers=fwd_headers,
            params=request.query_params,
            content=body if body else None,
            internal=False,
        )
    except HTTPException:
        raise
    except CircuitBreakerOpenException as cb_exc:
        logger.warning(
            "Circuit Breaker aberto para %s ao acessar %s: %s",
            service_label,
            clean_path,
            cb_exc,
        )
        retry_after = str(int(cb_exc.time_remaining) + 1)
        return JSONResponse(
            status_code=503,
            content={
                "detail": f"Microsserviço '{service_label}' temporariamente indisponível (Circuit Breaker aberto). Tente novamente em {retry_after}s.",
                "circuit_breaker": "open",
                "service": service_label,
                "retry_after_seconds": retry_after,
            },
            headers={"Retry-After": retry_after},
        )
    except Exception as exc:
        logger.exception(
            "Erro ao encaminhar %s para %s: %s", clean_path, service_label, exc
        )
        raise HTTPException(
            status_code=502,
            detail=f"Microsserviço '{service_label}' temporariamente indisponível.",
        )
    finally:
        reset_active_source_app(token)

    resp_headers = {
        k: v
        for k, v in upstream_resp.headers.items()
        if k.lower() not in HOP_BY_HOP_HEADERS
    }
    resp_headers["X-Gateway"] = "valida-facil-gateway"
    resp_headers["X-Upstream-Service"] = service_label

    return Response(
        content=upstream_resp.content,
        status_code=upstream_resp.status_code,
        headers=resp_headers,
        media_type=upstream_resp.headers.get("content-type"),
    )
