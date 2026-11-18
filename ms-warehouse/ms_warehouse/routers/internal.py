"""
Endpoints internos (S2S) e consumidor de eventos do MS Warehouse (Armazém Central).
Garante o padrão Database-per-Service e transações compensatórias (SAGA) de despacho.
"""

import asyncio
import logging
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
from weakref import WeakKeyDictionary

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

from ms_warehouse.schemas import (
    InternalDispatchRequest,
    InternalReleaseRequest,
    MovementCreate,
    MovementResult,
    ProductsBatchRequest,
)
from ms_warehouse.services import stock_service
from shared.auth import require_internal_service, resolve_db_client
from shared.broker import DomainEvent, broker
from shared.http_client import identity_client

logger = logging.getLogger("valida_facil.ms_warehouse.internal")
router = APIRouter(dependencies=[Depends(require_internal_service)])
_DISPATCH_LOCKS_BY_LOOP: "WeakKeyDictionary[asyncio.AbstractEventLoop, Dict[str, asyncio.Lock]]" = WeakKeyDictionary()


def _get_requisition_lock(requisition_id: str) -> asyncio.Lock:
    loop = asyncio.get_running_loop()
    locks = _DISPATCH_LOCKS_BY_LOOP.setdefault(loop, {})
    if requisition_id not in locks:
        locks[requisition_id] = asyncio.Lock()
    return locks[requisition_id]


def _find_dispatch_record(client: Any, requisition_id: str) -> Optional[Dict[str, Any]]:
    resp = (
        client.table("warehouse_dispatches")
        .select("*")
        .eq("requisition_id", requisition_id)
        .maybe_single()
        .execute()
    )
    return resp.data if resp else None


def _idempotent_dispatch_response(
    existing: Dict[str, Any], requisition_id: str
) -> Dict[str, Any]:
    record_status = existing.get("status")
    if record_status == "dispatched":
        return {
            "requisition_id": requisition_id,
            "allocated_items": existing.get("allocated_items") or [],
            "dispatched_at_date": existing.get("dispatched_at_date")
            or date.today().isoformat(),
            "idempotent": True,
        }
    if record_status == "released":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Esta requisição já foi estornada e não pode ser despachada novamente.",
        )
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Despacho desta requisição já está em andamento.",
    )


def _is_fake_without_rpc(client: Any, rpc_name: str) -> bool:
    return hasattr(client, "rpc_results") and rpc_name not in client.rpc_results


async def _fetch_company_meta_via_identity(
    client: Any, company_id: str
) -> Dict[str, Any]:
    """Consulta metadados da empresa no MS Identity por S2S."""
    try:
        resp = await identity_client.get(f"/internal/companies/{company_id}")
        if resp.status_code == 200:
            return resp.json() or {}
        if resp.status_code == 404:
            return {}
        logger.error(
            "MS Identity respondeu HTTP %s ao consultar empresa %s.",
            resp.status_code,
            company_id,
        )
    except Exception:
        logger.exception("Falha ao consultar empresa %s no MS Identity.", company_id)
    return {}


def _apply_central_delta(
    client: Any,
    *,
    company_id: str,
    product: Dict[str, Any],
    movement_type: str,
    delta: int,
    note: str,
    changed_by: str | None,
) -> MovementResult:
    if not _is_fake_without_rpc(client, "apply_stock_movement"):
        return stock_service.apply_movement(
            client,
            MovementCreate(
                product_id=product["id"],
                movement_type=movement_type,
                quantity_delta=delta,
                note=note,
            ),
        )

    prev_qty = int(product.get("quantity") or 0)
    new_qty = prev_qty + delta
    if new_qty < 0:
        raise ValueError(
            f"Saldo insuficiente no Armazém Central para '{product.get('name')}' "
            f"(atual: {prev_qty}, tentativa: {delta})."
        )
    min_stock = int(product.get("min_stock") or 0)
    client.table("products").update({"quantity": new_qty}).eq(
        "id", product["id"]
    ).execute()
    client.table("stock_movements").insert(
        {
            "company_id": company_id,
            "product_id": product["id"],
            "changed_by": changed_by,
            "movement_type": movement_type,
            "quantity_delta": delta,
            "previous_quantity": prev_qty,
            "new_quantity": new_qty,
            "note": note,
        }
    ).execute()

    return MovementResult(
        company_id=company_id,
        product_id=str(product["id"]),
        product_name=product.get("name") or "Produto",
        previous_quantity=prev_qty,
        new_quantity=new_qty,
        min_stock=min_stock,
        crossed_low_stock=(prev_qty > min_stock and new_qty <= min_stock),
        notification_email=None,
    )


@router.post("/products/batch")
async def get_products_batch(payload: ProductsBatchRequest, request: Request):
    if not payload.product_ids:
        return {}
    client = resolve_db_client(request)
    target_ids = set(str(pid) for pid in payload.product_ids if pid)
    resp = (
        client.table("products")
        .select(
            "id, company_id, code, name, category, quantity, min_stock, expiry, price"
        )
        .eq("company_id", payload.company_id)
        .execute()
    )
    products_map: Dict[str, Any] = {}
    for row in resp.data or []:
        if str(row.get("id")) in target_ids:
            products_map[str(row["id"])] = row
    return products_map


@router.post("/stock/dispatch")
async def dispatch_requisition_stock(
    payload: InternalDispatchRequest,
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Reserva e deduz saldo do Armazém Central no momento do despacho (`despachada`),
    aplicando auditoria FEFO, idempotência por `requisition_id` e alerta de estoque mínimo.
    """
    client = resolve_db_client(request)
    req_id = str(payload.requisition_id)

    async with _get_requisition_lock(req_id):
        existing = _find_dispatch_record(client, req_id)
        if existing:
            return _idempotent_dispatch_response(existing, payload.requisition_id)

        resp = (
            client.table("products")
            .select("id, company_id, code, name, quantity, min_stock, expiry")
            .eq("company_id", payload.company_id)
            .execute()
        )
        catalog = {str(row["id"]): row for row in (resp.data or [])}

        # Fase 1: Validação integral antes de deduzir qualquer item (evita despacho parcial)
        validated_pairs: List[tuple[Dict[str, Any], int]] = []
        for item in payload.items:
            prod = catalog.get(str(item.product_id))
            if not prod:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Produto {item.product_id} não encontrado no Armazém Central desta empresa.",
                )
            available = int(prod.get("quantity") or 0)
            if available < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Saldo insuficiente no Armazém Central para '{prod.get('name', item.product_id)}' "
                        f"(disponível: {available}, solicitado: {item.quantity})."
                    ),
                )
            validated_pairs.append((prod, item.quantity))

        # Prioridade FEFO na ordem de separação e alocação
        validated_pairs.sort(
            key=lambda pair: (
                pair[0].get("expiry") is None,
                pair[0].get("expiry") or "9999-12-31",
            )
        )

        dispatched_date = date.today().isoformat()
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            client.table("warehouse_dispatches").insert(
                {
                    "requisition_id": req_id,
                    "company_id": payload.company_id,
                    "status": "processing",
                    "allocated_items": [],
                    "dispatched_at_date": dispatched_date,
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }
            ).execute()
        except Exception as exc:
            msg = str(exc).lower()
            if "duplicate" in msg or "unique" in msg or "23505" in msg:
                raced = _find_dispatch_record(client, req_id)
                if raced:
                    return _idempotent_dispatch_response(raced, payload.requisition_id)
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Despacho concorrente em andamento para esta requisição.",
                ) from exc
            raise

        comp_data = await _fetch_company_meta_via_identity(client, payload.company_id)
        company_name = comp_data.get("name") or "Empresa"

        req_short = req_id[:8]
        store_label = payload.store_name or str(payload.store_id)[:8]
        note = f"Despacho para {store_label} (Req #{req_short})"

        allocated: List[Dict[str, Any]] = []
        completed: List[tuple[Dict[str, Any], int]] = []
        try:
            for prod, qty in validated_pairs:
                res = _apply_central_delta(
                    client,
                    company_id=payload.company_id,
                    product=prod,
                    movement_type="saida",
                    delta=-qty,
                    note=note,
                    changed_by=payload.changed_by,
                )
                res.notification_email = comp_data.get("notification_email")
                completed.append((prod, qty))
                allocated.append(
                    {
                        "product_id": str(prod["id"]),
                        "product_code": prod.get("code"),
                        "product_name": prod.get("name"),
                        "quantity": qty,
                        "previous_quantity": res.previous_quantity,
                        "new_quantity": res.new_quantity,
                        "expiry": prod.get("expiry"),
                    }
                )
                if res.crossed_low_stock:
                    background_tasks.add_task(
                        stock_service.notify_low_stock_if_needed, res, company_name
                    )

            client.table("warehouse_dispatches").update(
                {
                    "status": "dispatched",
                    "allocated_items": allocated,
                    "dispatched_at_date": dispatched_date,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            ).eq("requisition_id", req_id).execute()
        except Exception as exc:
            # Rollback compensatório dos itens já deduzidos nesta requisição se algum passo falhar
            for done_prod, done_qty in completed:
                try:
                    _apply_central_delta(
                        client,
                        company_id=payload.company_id,
                        product=done_prod,
                        movement_type="entrada",
                        delta=done_qty,
                        note=f"Rollback erro despacho Req #{req_short}",
                        changed_by=payload.changed_by,
                    )
                except Exception:
                    logger.exception(
                        "Falha ao compensar rollback do produto %s", done_prod.get("id")
                    )
            try:
                client.table("warehouse_dispatches").delete().eq(
                    "requisition_id", req_id
                ).eq("status", "processing").execute()
            except Exception:
                logger.exception(
                    "Falha ao limpar registro processing do despacho %s", req_id
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Não foi possível separar os itens no Armazém Central: {exc}",
            )

        return {
            "requisition_id": payload.requisition_id,
            "allocated_items": allocated,
            "dispatched_at_date": dispatched_date,
        }


@router.post("/stock/release")
async def release_dispatched_stock(payload: InternalReleaseRequest, request: Request):
    """
    Transação compensatória (SAGA): estorna saldo ao Armazém Central quando uma
    requisição já despachada é cancelada antes do recebimento na filial (idempotente).
    """
    client = resolve_db_client(request)
    req_id = str(payload.requisition_id)

    async with _get_requisition_lock(req_id):
        existing = _find_dispatch_record(client, req_id)
        if existing:
            if existing.get("status") == "released":
                return {
                    "requisition_id": payload.requisition_id,
                    "restored_items": [],
                    "idempotent": True,
                }
            if existing.get("status") == "processing":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Despacho em andamento; aguarde conclusão antes de estornar.",
                )

        resp = (
            client.table("products")
            .select("id, company_id, code, name, quantity, min_stock, expiry")
            .eq("company_id", payload.company_id)
            .execute()
        )
        catalog = {str(row["id"]): row for row in (resp.data or [])}
        req_short = req_id[:8]

        restored = []
        for item in payload.items:
            prod = catalog.get(str(item.product_id))
            if not prod:
                continue
            res = _apply_central_delta(
                client,
                company_id=payload.company_id,
                product=prod,
                movement_type="entrada",
                delta=item.quantity,
                note=f"Estorno cancelamento despacho (Req #{req_short})",
                changed_by=payload.changed_by,
            )
            restored.append(
                {"product_id": str(prod["id"]), "new_quantity": res.new_quantity}
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        if existing:
            client.table("warehouse_dispatches").update(
                {"status": "released", "updated_at": now_iso}
            ).eq("requisition_id", req_id).execute()
        else:
            client.table("warehouse_dispatches").insert(
                {
                    "requisition_id": req_id,
                    "company_id": payload.company_id,
                    "status": "released",
                    "allocated_items": [],
                    "dispatched_at_date": date.today().isoformat(),
                    "created_at": now_iso,
                    "updated_at": now_iso,
                }
            ).execute()

        return {"requisition_id": payload.requisition_id, "restored_items": restored}


@router.post("/events")
async def handle_warehouse_event(event: DomainEvent, request: Request):
    """Consumidor de eventos de domínio destinados ao MS Warehouse (idempotente)."""
    client = resolve_db_client(request)
    if broker.is_processed(event.event_id, client):
        return {"status": "already_processed", "event_id": event.event_id}

    logger.info(
        "[MS Warehouse] Evento recebido: %s (%s) agregado=%s empresa=%s",
        event.event_type,
        event.event_id,
        event.aggregate_id,
        event.company_id,
    )
    broker.mark_processed(event.event_id, "warehouse", client)
    return {
        "status": "processed",
        "event_id": event.event_id,
        "event_type": event.event_type,
    }
