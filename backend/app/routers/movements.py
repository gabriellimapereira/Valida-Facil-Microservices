"""
Registro de movimentações de estoque. É aqui que o "estoque baixo dispara
e-mail" acontece — de forma assíncrona (BackgroundTasks), para a resposta
da API não esperar o envio do e-mail terminar.
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from app.core.security import AuthedUser, get_current_user_with_company
from app.schemas.movement import MovementCreate, MovementResult
from app.services import stock_service

router = APIRouter()


@router.post("", response_model=MovementResult, status_code=201)
async def create_movement(
    payload: MovementCreate,
    background_tasks: BackgroundTasks,
    user: AuthedUser = Depends(get_current_user_with_company),
):
    try:
        result = stock_service.apply_movement(user.client, payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if result.crossed_low_stock:
        company_resp = user.client.table("companies").select("name").eq("id", user.company_id).maybe_single().execute()
        company_name = (company_resp.data or {}).get("name", "")
        background_tasks.add_task(stock_service.notify_low_stock_if_needed, result, company_name)

    return result


@router.get("/low-stock")
async def get_low_stock(user: AuthedUser = Depends(get_current_user_with_company)):
    return {"items": stock_service.list_low_stock(user.client)}
