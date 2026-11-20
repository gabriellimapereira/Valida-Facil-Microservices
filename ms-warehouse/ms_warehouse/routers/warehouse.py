"""
Rotas de consulta FEFO e disponibilidade do Armazém Central (CD) — MS Warehouse.
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query

from ms_warehouse.schemas import ProductAvailabilityOut
from shared.auth import AuthedUser, get_current_user_with_company

router = APIRouter()


def _classify_expiry(expiry_str: Optional[str]) -> tuple[Optional[int], str]:
    if not expiry_str:
        return None, "sem_validade"
    try:
        exp_date = date.fromisoformat(str(expiry_str)[:10])
    except ValueError:
        return None, "sem_validade"
    days = (exp_date - date.today()).days
    if days < 0:
        return days, "vencido"
    if days <= 15:
        return days, "critico"
    if days <= 45:
        return days, "atencao"
    return days, "normal"


@router.get("/products/availability", response_model=List[ProductAvailabilityOut])
async def list_central_availability(
    in_stock_only: bool = Query(False),
    user: AuthedUser = Depends(get_current_user_with_company),
):
    """
    Retorna o catálogo do Armazém Central ordenado pelo critério FEFO
    (First Expire, First Out — itens próximos do vencimento aparecem primeiro).
    """
    resp = (
        user.client.table("products")
        .select("id, code, name, category, quantity, min_stock, expiry")
        .eq("company_id", user.company_id)
        .execute()
    )
    rows = resp.data or []
    result: List[ProductAvailabilityOut] = []

    for row in rows:
        qty = int(row.get("quantity") or 0)
        if in_stock_only and qty <= 0:
            continue
        min_stock = int(row.get("min_stock") or 0)
        days, exp_status = _classify_expiry(row.get("expiry"))
        result.append(
            ProductAvailabilityOut(
                id=str(row["id"]),
                code=row.get("code"),
                name=row.get("name") or "Produto",
                category=row.get("category"),
                quantity=qty,
                min_stock=min_stock,
                expiry=row.get("expiry"),
                days_to_expiry=days,
                expiry_status=exp_status,
                low_stock=(qty <= min_stock),
            )
        )

    result.sort(
        key=lambda item: (
            item.expiry is None,
            item.expiry or "9999-12-31",
            item.name.lower(),
        )
    )
    return result
