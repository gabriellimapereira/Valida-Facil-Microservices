"""
Rotas de Movimentação do Armazém Central (CD) no MS Warehouse.
Executa RPC atômica `apply_stock_movement` e publica eventos de domínio no broker.
"""

import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from ms_warehouse.schemas import MovementCreate, MovementResult
from ms_warehouse.services import stock_service
from shared.auth import (
    AuthedUser,
    require_central_warehouse_access,
)
from shared.broker import broker
from shared.http_client import identity_client

logger = logging.getLogger("valida_facil.ms_warehouse.movements")
router = APIRouter()


async def _resolve_company_meta(user: AuthedUser) -> dict:
    """Busca os metadados da empresa no MS Identity, sem consultar outro banco."""
    headers = (
        {"Authorization": f"Bearer {user.access_token}"} if user.access_token else {}
    )
    try:
        resp = await identity_client.get(
            f"/internal/companies/{user.company_id}", headers=headers
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        logger.exception(
            "Falha ao consultar a empresa %s no MS Identity.", user.company_id
        )
    return {}


@router.post("", response_model=MovementResult, status_code=status.HTTP_201_CREATED)
async def create_movement(
    payload: MovementCreate,
    background_tasks: BackgroundTasks,
    user: AuthedUser = Depends(require_central_warehouse_access),
):
    if payload.quantity_delta == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A variação de quantidade deve ser diferente de zero.",
        )

    try:
        result = stock_service.apply_movement(user.client, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        logger.exception("Erro ao aplicar movimentação de estoque central: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível aplicar a movimentação de estoque.",
        )

    if result.crossed_low_stock:
        company = await _resolve_company_meta(user)
        result.notification_email = company.get("notification_email")
        background_tasks.add_task(
            stock_service.notify_low_stock_if_needed,
            result,
            company.get("name") or "Sua empresa",
        )
        await broker.publish(
            event_type="ESTOQUE_CRITICO",
            company_id=str(user.company_id),
            aggregate_id=str(payload.product_id),
            source_service="warehouse",
            payload={
                "product_id": str(payload.product_id),
                "product_name": result.product_name,
                "new_quantity": result.new_quantity,
                "min_stock": result.min_stock,
            },
            db_client=user.client,
        )

    return result
