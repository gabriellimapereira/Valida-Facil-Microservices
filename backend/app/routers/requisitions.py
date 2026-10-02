import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.security import AuthedUser, get_current_user_with_company
from app.schemas.requisition import (
    RequisitionCreate,
    RequisitionItemOut,
    RequisitionOut,
    RequisitionStatusUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=List[RequisitionOut])
async def list_requisitions(
    store_id: Optional[UUID] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    user: AuthedUser = Depends(get_current_user_with_company),
):
    """Lista as requisições de reposição da empresa com filtros opcionais."""
    query = (
        user.client.table("requisitions")
        .select("*, stores(name), profiles(full_name), requisition_items(*, products(name, code))")
        .eq("company_id", user.company_id)
        .order("created_at", desc=True)
    )

    # Se o colaborador estiver amarrado a uma loja, restringe a ela
    effective_store_id = str(user.store_id) if user.store_id else (str(store_id) if store_id else None)
    if effective_store_id:
        query = query.eq("store_id", effective_store_id)

    if status_filter:
        query = query.eq("status", status_filter)

    resp = query.execute()
    rows = resp.data or []

    result = []
    for r in rows:
        store = r.get("stores") or {}
        profile = r.get("profiles") or {}
        items_raw = r.get("requisition_items") or []

        items = []
        for it in items_raw:
            prod = it.get("products") or {}
            items.append(
                RequisitionItemOut(
                    id=it["id"],
                    product_id=it["product_id"],
                    product_name=prod.get("name"),
                    product_code=prod.get("code"),
                    quantity_requested=it["quantity_requested"],
                    quantity_approved=it.get("quantity_approved"),
                )
            )

        result.append(
            RequisitionOut(
                id=r["id"],
                company_id=r["company_id"],
                store_id=r["store_id"],
                store_name=store.get("name"),
                requested_by=r.get("requested_by"),
                requested_by_name=profile.get("full_name"),
                status=r["status"],
                notes=r.get("notes"),
                created_at=r["created_at"],
                updated_at=r["updated_at"],
                items=items,
            )
        )

    return result


@router.post("", response_model=RequisitionOut, status_code=status.HTTP_201_CREATED)
async def create_requisition(
    payload: RequisitionCreate,
    user: AuthedUser = Depends(get_current_user_with_company),
):
    """Cria uma nova requisição de reposição da loja filial para o armazém central."""
    # Garante que a loja pertence à mesma empresa
    store_resp = (
        user.client.table("stores")
        .select("id, name")
        .eq("id", str(payload.store_id))
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not store_resp.data:
        raise HTTPException(status_code=404, detail="Filial não encontrada na sua empresa.")
    store_data = store_resp.data

    # Cria o cabeçalho da requisição
    req_data = {
        "company_id": user.company_id,
        "store_id": str(payload.store_id),
        "requested_by": user.id,
        "status": "pendente",
        "notes": payload.notes,
    }

    try:
        req_resp = user.client.table("requisitions").insert(req_data).execute()
        if not req_resp.data:
            raise HTTPException(status_code=500, detail="Falha ao criar cabeçalho da requisição.")
        created_req = req_resp.data[0]
        req_id = created_req["id"]

        # Insere os itens da requisição
        items_to_insert = [
            {
                "requisition_id": req_id,
                "product_id": str(it.product_id),
                "quantity_requested": it.quantity_requested,
                "quantity_approved": it.quantity_requested,  # por padrão aprovado = solicitado
            }
            for it in payload.items
        ]
        items_resp = user.client.table("requisition_items").insert(items_to_insert).execute()
        inserted_items = items_resp.data or []

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Falha ao registrar requisição")
        raise HTTPException(status_code=400, detail="Não foi possível emitir a requisição.")

    # Constrói retorno
    items_out = []
    for it in inserted_items:
        items_out.append(
            RequisitionItemOut(
                id=it["id"],
                product_id=it["product_id"],
                quantity_requested=it["quantity_requested"],
                quantity_approved=it.get("quantity_approved"),
            )
        )

    return RequisitionOut(
        id=created_req["id"],
        company_id=created_req["company_id"],
        store_id=created_req["store_id"],
        store_name=store_data["name"],
        requested_by=created_req["requested_by"],
        requested_by_name=user.full_name,
        status="pendente",
        notes=created_req.get("notes"),
        created_at=created_req.get("created_at"),
        updated_at=created_req.get("updated_at"),
        items=items_out,
    )


@router.get("/{requisition_id}", response_model=RequisitionOut)
async def get_requisition(
    requisition_id: UUID,
    user: AuthedUser = Depends(get_current_user_with_company),
):
    resp = (
        user.client.table("requisitions")
        .select("*, stores(name), profiles(full_name), requisition_items(*, products(name, code))")
        .eq("id", str(requisition_id))
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Requisição não encontrada.")
    r = resp.data

    items = []
    for it in (r.get("requisition_items") or []):
        prod = it.get("products") or {}
        items.append(
            RequisitionItemOut(
                id=it["id"],
                product_id=it["product_id"],
                product_name=prod.get("name"),
                product_code=prod.get("code"),
                quantity_requested=it["quantity_requested"],
                quantity_approved=it.get("quantity_approved"),
            )
        )

    return RequisitionOut(
        id=r["id"],
        company_id=r["company_id"],
        store_id=r["store_id"],
        store_name=(r.get("stores") or {}).get("name"),
        requested_by=r.get("requested_by"),
        requested_by_name=(r.get("profiles") or {}).get("full_name"),
        status=r["status"],
        notes=r.get("notes"),
        created_at=r["created_at"],
        updated_at=r["updated_at"],
        items=items,
    )


@router.patch("/{requisition_id}/status", response_model=RequisitionOut)
async def update_requisition_status(
    requisition_id: UUID,
    payload: RequisitionStatusUpdate,
    user: AuthedUser = Depends(get_current_user_with_company),
):
    """
    Atualiza o status da requisição (pendente -> aprovada -> despachada -> recebida / cancelada).
    Se o status for 'recebida', invoca a transferência atômica de saldo do armazém para a loja.
    """
    current_resp = (
        user.client.table("requisitions")
        .select("*")
        .eq("id", str(requisition_id))
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not current_resp.data:
        raise HTTPException(status_code=404, detail="Requisição não encontrada.")
    current = current_resp.data

    # Se estiver aprovando e foram enviados ajustes de quantidade
    if payload.items_approved and payload.status in ("aprovada", "despachada"):
        for it in payload.items_approved:
            if "product_id" in it and "quantity_approved" in it:
                user.client.table("requisition_items").update(
                    {"quantity_approved": it["quantity_approved"]}
                ).eq("requisition_id", str(requisition_id)).eq("product_id", it["product_id"]).execute()

    # Quando a filial confirma o recebimento:
    if payload.status == "recebida":
        try:
            # Chama a procedure atômica do Supabase
            rpc_res = user.client.rpc("fulfill_requisition", {"p_requisition_id": str(requisition_id)}).execute()
        except Exception as exc:
            msg = str(exc)
            logger.exception("Falha ao efetivar recebimento da requisição")
            if "insuficiente" in msg.lower():
                raise HTTPException(status_code=400, detail="Saldo insuficiente no Armazém Central para transferir.")
            raise HTTPException(status_code=400, detail="Não foi possível confirmar o recebimento da requisição.")
    else:
        # Atualização simples de status (aprovada, despachada, cancelada)
        user.client.table("requisitions").update(
            {"status": payload.status, "updated_at": "now()"}
        ).eq("id", str(requisition_id)).execute()

    return await get_requisition(requisition_id, user)
