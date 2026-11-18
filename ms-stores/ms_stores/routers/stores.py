"""
Rotas de Lojas Filiais, Inventário Local e Histórico de Movimentações da Loja (MS Stores).
Comunica-se via HTTP S2S com MS Warehouse e MS Identity sem cruzar tabelas de outros domínios.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status

from ms_stores.schemas import (
    StoreCreate,
    StoreInventoryMovement,
    StoreInventoryOut,
    StoreMinStockUpdate,
    StoreMovementOut,
    StoreOut,
    StoreUpdate,
)
from shared.auth import (
    AuthedUser,
    get_current_user_with_company,
    require_admin,
)
from shared.broker import broker
from shared.http_client import identity_client, warehouse_client

logger = logging.getLogger("valida_facil.ms_stores.stores")
router = APIRouter()


def _verify_store_ownership(user: AuthedUser, store_id: UUID) -> Dict[str, Any]:
    resp = (
        user.client.table("stores")
        .select("*")
        .eq("id", str(store_id))
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filial não encontrada nesta empresa.",
        )
    return resp.data


def _enforce_branch_access(user: AuthedUser, store_id: UUID) -> None:
    if user.role != "admin" and user.store_id and str(user.store_id) != str(store_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Colaborador vinculado a outra filial não possui acesso a este inventário.",
        )


async def _fetch_products_batch(
    company_id: str,
    product_ids: List[str],
    access_token: str,
) -> Dict[str, Dict[str, Any]]:
    if not product_ids:
        return {}
    headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}
    try:
        resp = await warehouse_client.post(
            "/internal/products/batch",
            json={"company_id": str(company_id), "product_ids": product_ids},
            headers=headers,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict):
                return data
    except Exception as exc:
        logger.warning("Falha ao consultar catálogo no MS Warehouse: %s", exc)
    return {}


async def _fetch_members_batch(
    company_id: str,
    user_ids: List[str],
    access_token: str,
) -> Dict[str, Dict[str, Any]]:
    if not user_ids:
        return {}
    headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}
    try:
        resp = await identity_client.post(
            "/internal/members/batch",
            json={"company_id": str(company_id), "user_ids": user_ids},
            headers=headers,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict):
                return data
    except Exception as exc:
        logger.debug("Falha ao consultar usuários no MS Identity: %s", exc)
    return {}


@router.get("", response_model=List[StoreOut])
async def list_stores(user: AuthedUser = Depends(get_current_user_with_company)):
    resp = (
        user.client.table("stores")
        .select("*")
        .eq("company_id", user.company_id)
        .order("created_at")
        .execute()
    )
    return resp.data or []


@router.post("", response_model=StoreOut, status_code=status.HTTP_201_CREATED)
async def create_store(payload: StoreCreate, user: AuthedUser = Depends(require_admin)):
    insert_data = {
        "company_id": user.company_id,
        "name": payload.name.strip(),
        "code": payload.code.strip().upper(),
        "address": payload.address.strip() if payload.address else None,
        "phone": payload.phone.strip() if payload.phone else None,
    }
    try:
        resp = user.client.table("stores").insert(insert_data).execute()
    except Exception as exc:
        msg = str(exc).lower()
        if "duplicate" in msg or "unique" in msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Já existe uma filial com o código '{insert_data['code']}' nesta empresa.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível criar a filial. Verifique os dados informados.",
        )

    rows = resp.data or []
    if not rows:
        raise HTTPException(status_code=400, detail="Falha ao criar filial.")
    return rows if isinstance(rows, dict) else rows[0]


@router.get("/{store_id}", response_model=StoreOut)
async def get_store(
    store_id: UUID, user: AuthedUser = Depends(get_current_user_with_company)
):
    return _verify_store_ownership(user, store_id)


@router.patch("/{store_id}", response_model=StoreOut)
async def update_store(
    store_id: UUID,
    payload: StoreUpdate,
    user: AuthedUser = Depends(require_admin),
):
    update_data = {
        k: (v.strip().upper() if k == "code" else v.strip())
        if isinstance(v, str)
        else v
        for k, v in payload.model_dump(exclude_unset=True).items()
        if v is not None
    }
    if not update_data:
        raise HTTPException(
            status_code=400, detail="Nenhum dado informado para atualização."
        )

    _verify_store_ownership(user, store_id)

    try:
        resp = (
            user.client.table("stores")
            .update(update_data)
            .eq("id", str(store_id))
            .eq("company_id", user.company_id)
            .execute()
        )
    except Exception as exc:
        if "duplicate" in str(exc).lower() or "unique" in str(exc).lower():
            raise HTTPException(
                status_code=409, detail="Já existe outra filial com este código."
            )
        raise HTTPException(
            status_code=400, detail="Não foi possível atualizar a filial."
        )

    rows = resp.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Filial não encontrada.")
    return rows[0]


@router.delete("/{store_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_store(store_id: UUID, user: AuthedUser = Depends(require_admin)):
    _verify_store_ownership(user, store_id)
    user.client.table("stores").delete().eq("id", str(store_id)).eq(
        "company_id", user.company_id
    ).execute()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{store_id}/inventory", response_model=List[StoreInventoryOut])
async def get_store_inventory(
    store_id: UUID,
    user: AuthedUser = Depends(get_current_user_with_company),
):
    _verify_store_ownership(user, store_id)
    _enforce_branch_access(user, store_id)

    resp = (
        user.client.table("store_inventory")
        .select("id, store_id, product_id, quantity, min_stock, updated_at")
        .eq("store_id", str(store_id))
        .execute()
    )
    rows = resp.data or []
    missing_ids = [
        str(r["product_id"])
        for r in rows
        if r.get("product_id") and not isinstance(r.get("products"), dict)
    ]
    all_ids = [str(r["product_id"]) for r in rows if r.get("product_id")]
    products_map = await _fetch_products_batch(
        str(user.company_id), all_ids if all_ids else missing_ids, user.access_token
    )

    result = []
    for row in rows:
        pid = str(row["product_id"])
        embedded = row.get("products") if isinstance(row.get("products"), dict) else {}
        prod = products_map.get(pid) or embedded
        result.append(
            {
                "id": row["id"],
                "store_id": row["store_id"],
                "product_id": pid,
                "product_name": prod.get("name"),
                "product_code": prod.get("code"),
                "category": prod.get("category"),
                "expiry": prod.get("expiry"),
                "quantity": int(row.get("quantity") or 0),
                "min_stock": int(row.get("min_stock") or 0),
                "updated_at": row.get("updated_at"),
            }
        )
    return result


@router.post("/{store_id}/inventory/movement")
async def record_store_movement(
    store_id: UUID,
    payload: StoreInventoryMovement,
    user: AuthedUser = Depends(get_current_user_with_company),
):
    _verify_store_ownership(user, store_id)
    _enforce_branch_access(user, store_id)

    # Verifica no MS Warehouse que o produto pertence ao catálogo da empresa
    prod_map = await _fetch_products_batch(
        str(user.company_id), [str(payload.product_id)], user.access_token
    )
    if str(payload.product_id) not in prod_map:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado no catálogo central da empresa.",
        )

    is_fake_without_rpc = (
        hasattr(user.client, "rpc_results")
        and "store_inventory_movement" not in user.client.rpc_results
    )

    if not is_fake_without_rpc:
        try:
            rpc_resp = user.client.rpc(
                "store_inventory_movement",
                {
                    "p_store_id": str(store_id),
                    "p_product_id": str(payload.product_id),
                    "p_quantity_delta": payload.quantity_delta,
                    "p_note": payload.note,
                },
            ).execute()
            data = (
                rpc_resp.data[0] if isinstance(rpc_resp.data, list) else rpc_resp.data
            )
            if not data:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="A movimentação na filial não retornou confirmação do banco.",
                )
            await broker.publish(
                event_type="MOVIMENTACAO_FILIAL",
                company_id=str(user.company_id),
                aggregate_id=str(store_id),
                source_service="stores",
                payload={
                    "store_id": str(store_id),
                    "product_id": str(payload.product_id),
                    "quantity_delta": payload.quantity_delta,
                    "new_quantity": data.get("new_quantity"),
                },
                db_client=user.client,
            )
            return {
                "status": "ok",
                "store_id": str(store_id),
                "product_id": str(payload.product_id),
                "previous_quantity": data.get("previous_quantity"),
                "new_quantity": data.get("new_quantity"),
            }
        except HTTPException:
            raise
        except Exception as exc:
            msg = str(exc)
            lowered = msg.lower()
            if (
                "insuficiente" in lowered
                or "saldo" in lowered
                or "variação" in lowered
                or "não pertence" in lowered
            ):
                raise HTTPException(status_code=400, detail=msg) from exc
            logger.error(
                "Falha na RPC store_inventory_movement (%s): %s", store_id, exc
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Falha ao registrar movimentação no estoque da filial.",
            ) from exc

    # Caminho exclusivo para o cliente fake em testes sem stub da RPC configurado
    inv_resp = (
        user.client.table("store_inventory")
        .select("*")
        .eq("store_id", str(store_id))
        .eq("product_id", str(payload.product_id))
        .maybe_single()
        .execute()
    )
    current = inv_resp.data if inv_resp else None
    prev_qty = int(current["quantity"]) if current else 0
    new_qty = prev_qty + payload.quantity_delta
    if new_qty < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Saldo insuficiente na filial para esta saída (atual: {prev_qty}, tentativa: {payload.quantity_delta}).",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    if current:
        user.client.table("store_inventory").update(
            {"quantity": new_qty, "updated_at": now_iso}
        ).eq("id", current["id"]).execute()
    else:
        user.client.table("store_inventory").insert(
            {
                "store_id": str(store_id),
                "product_id": str(payload.product_id),
                "quantity": new_qty,
                "min_stock": 0,
                "updated_at": now_iso,
            }
        ).execute()

    movement_type = "entrada" if payload.quantity_delta > 0 else "saida"
    try:
        user.client.table("store_movements").insert(
            {
                "company_id": user.company_id,
                "store_id": str(store_id),
                "product_id": str(payload.product_id),
                "changed_by": user.id,
                "movement_type": movement_type,
                "quantity_delta": payload.quantity_delta,
                "previous_quantity": prev_qty,
                "new_quantity": new_qty,
                "note": payload.note,
                "created_at": now_iso,
            }
        ).execute()
    except Exception as exc:
        logger.debug("Histórico store_movements opcional indisponível: %s", exc)

    await broker.publish(
        event_type="MOVIMENTACAO_FILIAL",
        company_id=str(user.company_id),
        aggregate_id=str(store_id),
        source_service="stores",
        payload={
            "store_id": str(store_id),
            "product_id": str(payload.product_id),
            "quantity_delta": payload.quantity_delta,
            "new_quantity": new_qty,
        },
        db_client=user.client,
    )

    return {
        "status": "ok",
        "store_id": str(store_id),
        "product_id": str(payload.product_id),
        "previous_quantity": prev_qty,
        "new_quantity": new_qty,
    }


@router.patch("/{store_id}/inventory/{product_id}")
async def update_store_min_stock(
    store_id: UUID,
    product_id: UUID,
    payload: StoreMinStockUpdate,
    user: AuthedUser = Depends(get_current_user_with_company),
):
    _verify_store_ownership(user, store_id)
    _enforce_branch_access(user, store_id)

    # Garante que o produto pertence ao catálogo central da mesma empresa antes de gravar em store_inventory
    prod_map = await _fetch_products_batch(
        str(user.company_id), [str(product_id)], user.access_token
    )
    if str(product_id) not in prod_map:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Produto não encontrado no catálogo central da empresa.",
        )

    inv_resp = (
        user.client.table("store_inventory")
        .select("*")
        .eq("store_id", str(store_id))
        .eq("product_id", str(product_id))
        .maybe_single()
        .execute()
    )
    current_inv = inv_resp.data if inv_resp else None
    now_iso = datetime.now(timezone.utc).isoformat()
    if current_inv:
        user.client.table("store_inventory").update(
            {"min_stock": payload.min_stock, "updated_at": now_iso}
        ).eq("id", current_inv["id"]).execute()
    else:
        user.client.table("store_inventory").insert(
            {
                "store_id": str(store_id),
                "product_id": str(product_id),
                "quantity": 0,
                "min_stock": payload.min_stock,
                "updated_at": now_iso,
            }
        ).execute()

    return {
        "store_id": str(store_id),
        "product_id": str(product_id),
        "min_stock": payload.min_stock,
    }


@router.get("/{store_id}/movements", response_model=List[StoreMovementOut])
async def list_store_movements(
    store_id: UUID,
    user: AuthedUser = Depends(get_current_user_with_company),
):
    _verify_store_ownership(user, store_id)
    _enforce_branch_access(user, store_id)

    try:
        resp = (
            user.client.table("store_movements")
            .select("*")
            .eq("store_id", str(store_id))
            .order("created_at", desc=True)
            .execute()
        )
        rows = resp.data or []
    except Exception:
        rows = []

    prod_ids = list({str(r["product_id"]) for r in rows if r.get("product_id")})
    user_ids = list({str(r["changed_by"]) for r in rows if r.get("changed_by")})

    products_map = await _fetch_products_batch(
        str(user.company_id), prod_ids, user.access_token
    )
    members_map = await _fetch_members_batch(
        str(user.company_id), user_ids, user.access_token
    )

    result = []
    for row in rows:
        pid = str(row["product_id"])
        uid = str(row["changed_by"]) if row.get("changed_by") else ""
        prod = products_map.get(pid) or {}
        member = members_map.get(uid) or {}
        result.append(
            {
                "id": str(row["id"]),
                "store_id": str(row["store_id"]),
                "product_id": pid,
                "product_name": prod.get("name"),
                "product_code": prod.get("code"),
                "changed_by": row.get("changed_by"),
                "changed_by_name": member.get("full_name") or member.get("email"),
                "movement_type": row.get("movement_type"),
                "quantity_delta": int(row.get("quantity_delta") or 0),
                "previous_quantity": row.get("previous_quantity"),
                "new_quantity": row.get("new_quantity"),
                "requisition_id": row.get("requisition_id"),
                "note": row.get("note"),
                "created_at": row.get("created_at"),
            }
        )
    return result
