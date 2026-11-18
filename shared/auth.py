"""
Autenticação, contexto multi-tenant e suporte a chamadas internas entre microsserviços.
Reexporta a verificação JWT do usuário final de `shared.security`.
"""

import secrets
from typing import Any

from fastapi import HTTPException, Request, status

from shared.security import (  # noqa: F401
    AuthedUser,
    get_current_user,
    get_current_user_with_company,
    require_admin,
    require_central_warehouse_access,
)
from shared.config import DEV_INTERNAL_SERVICE_SECRET, settings
from shared.database import get_db


def require_internal_service(request: Request) -> None:
    """Valida token compartilhado nas chamadas síncronas serviço-para-serviço."""
    expected = (settings.internal_service_secret or "").strip()
    if settings.is_production and (
        not expected or expected == DEV_INTERNAL_SERVICE_SECRET
    ):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Configuração de segredo interno inválida para ambiente de produção.",
        )
    provided = request.headers.get("X-Internal-Service-Token", "")
    if not expected or not secrets.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito à comunicação interna entre microsserviços.",
        )


def resolve_db_client(request: Request) -> Any:
    """
    Resolve o client de banco para endpoints internos (/internal/...):
    1. Se houver dependency override de usuário autenticado (em testes / ASGI),
       reutiliza o `client` injetado nele para manter isolamento do fake_client.
    2. Se houver Bearer token de usuário válido, usa o client autenticado.
    3. Caso contrário (consumidor assíncrono / cron), usa o banco exclusivo do serviço.
    """
    overrides = getattr(request.app, "dependency_overrides", {}) or {}
    for dep in (
        get_current_user_with_company,
        get_current_user,
        require_admin,
        require_central_warehouse_access,
    ):
        if dep in overrides:
            try:
                user_obj = overrides[dep]()
                if isinstance(user_obj, AuthedUser) and user_obj.client is not None:
                    return user_obj.client
            except HTTPException:
                pass
            except TypeError:
                pass

    service_name = getattr(request.app.state, "service_name", settings.service_name)
    return get_db(service_name)
