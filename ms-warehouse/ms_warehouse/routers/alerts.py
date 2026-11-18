"""
Rotas de alertas automáticos de estoque baixo e validade — MS Warehouse.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from shared.config import settings
from ms_warehouse.services import expiry_service, stock_service
from shared.auth import AuthedUser, get_current_user_with_company, require_admin

router = APIRouter()


@router.get("/low-stock")
async def get_low_stock_alerts(
    user: AuthedUser = Depends(get_current_user_with_company),
):
    return stock_service.list_low_stock(user.client, user.company_id)


@router.post("/check-expiry")
async def trigger_expiry_check(
    window_days: int = Query(15, ge=1, le=365),
    user: AuthedUser = Depends(require_admin),
):
    return expiry_service.check_and_notify_company(
        user.client,
        user.company_id,
        window_days=window_days,
    )


@router.get("/cron-expiry-check")
async def cron_expiry_check(
    window_days: int = Query(15, ge=1, le=365),
    authorization: str | None = Header(default=None),
):
    if settings.cron_secret:
        expected = f"Bearer {settings.cron_secret}"
        if authorization != expected:
            raise HTTPException(
                status_code=401, detail="Cron secret inválido ou ausente."
            )

    results = expiry_service.run_expiry_check_all_companies(window_days=window_days)
    return {
        "status": "concluido",
        "empresas_processadas": len(results),
        "resultados": results,
    }
