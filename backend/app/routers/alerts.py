"""
Disparo manual de checagem de validade (além do job automático diário do
scheduler) — útil para o admin forçar o envio a qualquer momento, ou para
debug em ambiente de desenvolvimento.
"""
import secrets

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.config import settings
from app.core.security import AuthedUser, require_admin
from app.services import expiry_service

router = APIRouter()


@router.post("/check-expiry")
async def trigger_expiry_check(
    window_days: int = Query(default=15, ge=1, le=365),
    user: AuthedUser = Depends(require_admin),
):
    result = expiry_service.check_and_notify_company(user.client, user.company_id, window_days=window_days)
    return result


@router.get("/cron-expiry-check", tags=["Cron"])
@router.post("/cron-expiry-check", tags=["Cron"])
async def cron_expiry_check(
    request: Request,
    cron_key: str | None = Query(default=None),
    window_days: int = Query(default=15, ge=1, le=365),
):
    """
    Endpoint acionado pelo Vercel Cron (ou webhook agendado) para varredura diária
    e disparo de alertas de validade para todas as empresas.
    Protegido por CRON_SECRET quando configurado.
    """
    if settings.cron_secret:
        auth_header = request.headers.get("Authorization", "")
        token_match = False
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            token_match = secrets.compare_digest(token, settings.cron_secret)
        key_match = bool(cron_key and secrets.compare_digest(cron_key, settings.cron_secret))

        if not (token_match or key_match):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token de autorização do Cron inválido ou ausente.",
            )
    elif settings.environment == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso bloqueado: CRON_SECRET obrigatório em ambiente de produção.",
        )

    results = expiry_service.run_expiry_check_all_companies(window_days=window_days)
    return {"status": "concluido", "empresas_processadas": len(results), "detalhes": results}
