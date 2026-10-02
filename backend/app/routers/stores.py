import logging
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import AuthedUser, get_current_user_with_company, require_admin
from app.schemas.store import (
    StoreCreate,
    StoreInventoryItem,
    StoreInventoryMovement,
    StoreOut,
    StoreUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=List[StoreOut])
async def list_stores(user: AuthedUser = Depends(get_current_user_with_company)):
    """Lista todas as lojas filiais da empresa do usuário."""
    resp = (
        user.client.table("stores")
        .select("*")
        .eq("company_id", user.company_id)
        .order("name")
        .execute()
    )
    return resp.data or []


@router.post("", response_model=StoreOut, status_code=status.HTTP_201_CREATED)
async def create_store(payload: StoreCreate, user: AuthedUser = Depends(require_admin)):
    """Cadastra uma nova loja filial (Apenas Administrador)."""
    try:
        data = {
            "company_id": user.company_id,
            "code": payload.code.strip().upper(),
            "name": payload.name.strip(),
            "address": payload.address.strip() if payload.address else None,
            "phone": payload.phone.strip() if payload.phone else None,
        }
        resp = user.client.table("stores").insert(data).execute()
    except Exception as exc:
        msg = str(exc).lower()
        if "unique" in msg or "duplicate" in msg or "code" in msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Já existe uma filial cadastrada com o código '{payload.code}'.",
            )
        logger.exception("Falha ao cadastrar filial")
        raise HTTPException(status_code=400, detail="Não foi possível cadastrar a filial.")

    if not resp.data:
        raise HTTPException(status_code=500, detail="Banco não retornou a filial criada.")
    return resp.data[0]


@router.get("/{store_id}", response_model=StoreOut)
async def get_store(store_id: UUID, user: AuthedUser = Depends(get_current_user_with_company)):
    resp = (
        user.client.table("stores")
        .select("*")
        .eq("id", str(store_id))
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Filial não encontrada.")
    return resp.data


@router.patch("/{store_id}", response_model=StoreOut)
async def update_store(
    store_id: UUID,
    payload: StoreUpdate,
    user: AuthedUser = Depends(require_admin),
):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Nenhum dado informado para atualização.")

    resp = (
        user.client.table("stores")
        .update(update_data)
        .eq("id", str(store_id))
        .eq("company_id", user.company_id)
        .select("*")
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Filial não encontrada.")
    return resp.data


@router.get("/{store_id}/inventory", response_model=List[StoreInventoryItem])
async def get_store_inventory(
    store_id: UUID,
    user: AuthedUser = Depends(get_current_user_with_company),
):
    """Consulta o estoque local de uma filial específica."""
    resp = (
        user.client.table("store_inventory")
        .select("id, store_id, product_id, quantity, min_stock, updated_at, products(name, code, category)")
        .eq("store_id", str(store_id))
        .execute()
    )
    rows = resp.data or []
    result = []
    for r in rows:
        prod = r.get("products") or {}
        result.append(
            StoreInventoryItem(
                id=r["id"],
                store_id=r["store_id"],
                product_id=r["product_id"],
                product_name=prod.get("name"),
                product_code=prod.get("code"),
                category=prod.get("category"),
                quantity=r["quantity"],
                min_stock=r["min_stock"],
                updated_at=r["updated_at"],
            )
        )
    return result


@router.post("/{store_id}/inventory/movement")
async def record_store_inventory_movement(
    store_id: UUID,
    payload: StoreInventoryMovement,
    user: AuthedUser = Depends(get_current_user_with_company),
):
    """Registra uma variação física direta no estoque da loja (ex: venda ou quebra local)."""
    # Verifica o saldo atual
    inv_resp = (
        user.client.table("store_inventory")
        .select("*")
        .eq("store_id", str(store_id))
        .eq("product_id", str(payload.product_id))
        .maybe_single()
        .execute()
    )
    inv = inv_resp.data

    current_qty = inv["quantity"] if inv else 0
    new_qty = current_qty + payload.quantity_delta

    if new_qty < 0:
        raise HTTPException(
            status_code=400,
            detail=f"Saldo insuficiente na loja (atual: {current_qty}, tentativa: {payload.quantity_delta}).",
        )

    if inv:
        res = (
            user.client.table("store_inventory")
            .update({"quantity": new_qty, "updated_at": "now()"})
            .eq("id", inv["id"])
            .select()
            .single()
            .execute()
        )
    else:
        res = (
            user.client.table("store_inventory")
            .insert({
                "store_id": str(store_id),
                "product_id": str(payload.product_id),
                "quantity": new_qty,
            })
            .select()
            .single()
            .execute()
        )

    return {"status": "ok", "store_id": store_id, "product_id": payload.product_id, "new_quantity": new_qty}
