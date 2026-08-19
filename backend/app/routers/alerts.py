"""
Disparo manual de checagem de validade (além do job automático diário do
scheduler) — útil para o admin forçar o envio a qualquer momento, ou para
debug em ambiente de desenvolvimento.
"""
from fastapi import APIRouter, Depends, Query

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
