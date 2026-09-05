"""
Disparo manual de checagem de validade (além do job automático diário do
scheduler) — útil para o admin forçar o envio a qualquer momento, ou para
debug em ambiente de desenvolvimento.
"""
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
        expected_token = f"Bearer {settings.cron_secret}"
        if auth_header != expected_token and cron_key != settings.cron_secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token de autorização do Cron inválido ou ausente.",
            )

    results = expiry_service.run_expiry_check_all_companies(window_days=window_days)
    return {"status": "concluido", "empresas_processadas": len(results), "detalhes": results}
