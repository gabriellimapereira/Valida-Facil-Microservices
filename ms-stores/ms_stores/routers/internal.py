"""
Endpoints internos (S2S) e consumidor de eventos do MS Stores (Filiais & Requisições).
"""

import logging
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from shared.auth import require_internal_service, resolve_db_client
from shared.broker import DomainEvent, broker

logger = logging.getLogger("valida_facil.ms_stores.internal")
router = APIRouter(dependencies=[Depends(require_internal_service)])


@router.get("/stores/map")
async def get_stores_map_internal(request: Request, company_id: str = Query(...)):
    client = resolve_db_client(request)
    resp = (
        client.table("stores").select("id, name").eq("company_id", company_id).execute()
    )
    return {str(row["id"]): row.get("name") for row in (resp.data or [])}


@router.get("/stores/{store_id}")
async def get_store_internal(
    store_id: str, request: Request, company_id: str = Query(...)
):
    client = resolve_db_client(request)
    resp = (
        client.table("stores")
        .select("id, company_id, name, code")
        .eq("id", store_id)
        .eq("company_id", company_id)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(
            status_code=404, detail="Filial não encontrada nesta empresa."
        )
    return resp.data


@router.post("/events")
async def handle_stores_event(event: DomainEvent, request: Request):
    """Consumidor de notificações assíncronas destinadas às Lojas Filiais (idempotente)."""
    client = resolve_db_client(request)
    if broker.is_processed(event.event_id, client):
        return {"status": "already_processed", "event_id": event.event_id}

    logger.info(
        "[MS Stores] Evento consumido: %s (%s) agregado=%s",
        event.event_type,
        event.event_id,
        event.aggregate_id,
    )
    broker.mark_processed(event.event_id, "stores", client)
    return {
        "status": "processed",
        "event_id": event.event_id,
        "event_type": event.event_type,
    }
