"""
Cliente HTTP serviço-para-serviço e de proxy para o API Gateway.

Suporta dois modos transparentes:
- `http://...` ou `https://...`: comunicação TCP real entre contêineres Docker / serviços em rede.
- `asgi://nome-do-servico`: comunicação HTTP completa via ASGITransport em memória
  (ideal para testes integrados sem subidas de porta e deploy serverless único na Vercel),
  preservando serialização JSON, headers e códigos HTTP entre os microsserviços.

Inclui Resiliência Distribuída:
- Circuit Breaker por serviço de destino (fail-fast quando um serviço falhar consecutivamente).
- Retry automático com Exponential Backoff e Jitter para erros de rede transitórios.
"""

import contextvars
from typing import Any, Callable, Dict, Optional

import httpx
from fastapi import FastAPI

from shared.config import settings
from shared.resilience import (
    CircuitBreaker,
    SAFE_IDEMPOTENT_METHODS,
    execute_with_resilience,
)
from shared.tracing import get_correlation_id

_ASGI_REGISTRY: Dict[str, FastAPI] = {}
_ACTIVE_SOURCE_APP: contextvars.ContextVar[Optional[FastAPI]] = contextvars.ContextVar(
    "_active_source_app", default=None
)


def register_asgi_app(name: str, app: FastAPI) -> None:
    _ASGI_REGISTRY[name] = app


def get_asgi_app(name: str) -> Optional[FastAPI]:
    return _ASGI_REGISTRY.get(name)


def set_active_source_app(app: Optional[FastAPI]) -> contextvars.Token:
    return _ACTIVE_SOURCE_APP.set(app)


def reset_active_source_app(token: contextvars.Token) -> None:
    _ACTIVE_SOURCE_APP.reset(token)


class ServiceHttpClient:
    """Cliente assíncrono para invocar outros microsserviços via HTTP REST ou ASGI com Resiliência."""

    def __init__(
        self,
        target_name: str,
        url_resolver: Callable[[], str],
        *,
        circuit_breaker: Optional[CircuitBreaker] = None,
        failure_threshold: int = 5,
        recovery_timeout: float = 10.0,
    ):
        self.target_name = target_name
        self.url_resolver = url_resolver
        self.circuit_breaker = circuit_breaker or CircuitBreaker(
            service_name=target_name,
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
        )

    def _sync_test_overrides(self, target_app: FastAPI) -> Dict[Any, Any]:
        """Propaga dependency_overrides apenas em chamadas asgi:// para testabilidade isolada."""
        source_app = _ACTIVE_SOURCE_APP.get()
        if source_app is None or source_app is target_app:
            return {}
        snapshot = dict(target_app.dependency_overrides)
        target_app.dependency_overrides.update(source_app.dependency_overrides)
        return snapshot

    def get_circuit_status(self) -> Dict[str, Any]:
        """Retorna as métricas atuais do Circuit Breaker para este serviço."""
        return self.circuit_breaker.get_status()

    async def _send_raw_request(
        self,
        method: str,
        path: str,
        *,
        headers: Dict[str, str],
        params: Optional[Any],
        json: Optional[Any],
        content: Optional[bytes],
        timeout: float,
    ) -> httpx.Response:
        target_url = self.url_resolver().rstrip("/")

        if target_url.startswith("asgi://"):
            service_key = target_url.removeprefix("asgi://").split("/")[0]
            target_app = get_asgi_app(service_key) or get_asgi_app(self.target_name)
            if target_app is None:
                raise RuntimeError(
                    f"Microsserviço ASGI '{service_key}' não está registrado neste processo."
                )

            source_app = _ACTIVE_SOURCE_APP.get()
            snapshot = self._sync_test_overrides(target_app)
            previous_source = getattr(target_app.state, "_parent_source_app", None)
            if source_app is not None and source_app is not target_app:
                target_app.state._parent_source_app = source_app

            try:
                transport = httpx.ASGITransport(app=target_app)
                async with httpx.AsyncClient(
                    transport=transport,
                    base_url="http://internal.asgi",
                    timeout=timeout,
                ) as client:
                    token = _ACTIVE_SOURCE_APP.set(target_app)
                    try:
                        return await client.request(
                            method=method,
                            url=path,
                            headers=headers,
                            params=params,
                            json=json,
                            content=content,
                        )
                    finally:
                        _ACTIVE_SOURCE_APP.reset(token)
            finally:
                target_app.state._parent_source_app = previous_source
                if source_app is not None and source_app is not target_app:
                    target_app.dependency_overrides.clear()
                    target_app.dependency_overrides.update(snapshot)

        async with httpx.AsyncClient(base_url=target_url, timeout=timeout) as client:
            return await client.request(
                method=method,
                url=path,
                headers=headers,
                params=params,
                json=json,
                content=content,
            )

    async def request(
        self,
        method: str,
        path: str,
        *,
        headers: Optional[Dict[str, str]] = None,
        params: Optional[Any] = None,
        json: Optional[Any] = None,
        content: Optional[bytes] = None,
        internal: bool = True,
        timeout: Optional[float] = None,
        retries: Optional[int] = None,
    ) -> httpx.Response:
        req_headers = dict(headers or {})
        cid = get_correlation_id()
        if cid:
            req_headers.setdefault("X-Correlation-ID", cid)
            req_headers.setdefault("X-Request-ID", cid)

        if internal:
            req_headers.setdefault(
                "X-Internal-Service-Token", settings.internal_service_secret
            )
            req_headers.setdefault("X-Source-Service", settings.service_name)

        eff_timeout = timeout or settings.service_timeout_seconds
        max_retries = (
            retries
            if retries is not None
            else (2 if method.upper() in SAFE_IDEMPOTENT_METHODS else 0)
        )

        async def _call():
            return await self._send_raw_request(
                method=method,
                path=path,
                headers=req_headers,
                params=params,
                json=json,
                content=content,
                timeout=eff_timeout,
            )

        return await execute_with_resilience(
            _call,
            method=method,
            max_retries=max_retries,
            circuit_breaker=self.circuit_breaker,
        )

    async def get(self, path: str, **kwargs) -> httpx.Response:
        return await self.request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs) -> httpx.Response:
        return await self.request("POST", path, **kwargs)

    async def patch(self, path: str, **kwargs) -> httpx.Response:
        return await self.request("PATCH", path, **kwargs)

    async def delete(self, path: str, **kwargs) -> httpx.Response:
        return await self.request("DELETE", path, **kwargs)


identity_client = ServiceHttpClient("identity", lambda: settings.identity_service_url)
warehouse_client = ServiceHttpClient(
    "warehouse", lambda: settings.warehouse_service_url
)
stores_client = ServiceHttpClient("stores", lambda: settings.stores_service_url)
