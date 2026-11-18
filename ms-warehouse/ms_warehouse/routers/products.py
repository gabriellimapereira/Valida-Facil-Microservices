"""
Rotas de Gerenciamento do Catálogo do Armazém Central (MS Warehouse).
Gerencia os produtos e estoque mestre dentro da instância isolada db-warehouse.
"""

import uuid
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from shared.auth import (
    AuthedUser,
    get_current_user_with_company,
    require_central_warehouse_access,
)
from shared.database import get_db

router = APIRouter(prefix="/products", tags=["Produtos (Armazém Central)"])


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1)
    code: Optional[str] = None
    category: str = Field(..., min_length=1)
    price: float = Field(0.0, ge=0.0)
    quantity: int = Field(0, ge=0)
    min_stock: int = Field(0, ge=0)
    expiry: Optional[str] = None
    supplier: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = Field(None, ge=0.0)
    quantity: Optional[int] = Field(None, ge=0)
    min_stock: Optional[int] = Field(None, ge=0)
    expiry: Optional[str] = None
    supplier: Optional[str] = None


class ProductOut(BaseModel):
    id: str
    code: Optional[str] = None
    name: str
    category: str
    price: float = 0.0
    quantity: int = 0
    min_stock: int = 0
    expiry: Optional[str] = None
    supplier: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


def _format_row(row: dict) -> ProductOut:
    exp = row.get("expiry")
    if isinstance(exp, (date, datetime)):
        exp = exp.isoformat()[:10]
    created = row.get("created_at")
    if isinstance(created, datetime):
        created = created.isoformat()
    updated = row.get("updated_at")
    if isinstance(updated, datetime):
        updated = updated.isoformat()

    return ProductOut(
        id=str(row["id"]),
        code=row.get("code"),
        name=row.get("name") or "Produto",
        category=row.get("category") or "outros",
        price=float(row.get("price") or 0.0),
        quantity=int(row.get("quantity") or 0),
        min_stock=int(row.get("min_stock") or 0),
        expiry=exp,
        supplier=row.get("supplier"),
        created_at=created,
        updated_at=updated,
    )


@router.get("", response_model=List[ProductOut])
async def list_products(
    user: AuthedUser = Depends(get_current_user_with_company),
):
    """Lista todos os produtos do armazém central pertencentes à empresa do usuário."""
    db = user.client or get_db("warehouse")
    resp = (
        db.table("products")
        .select("*")
        .eq("company_id", user.company_id)
        .order("name", ascending=True)
        .execute()
    )
    rows = resp.data if resp and resp.data else []
    return [_format_row(r) for r in rows]


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: ProductCreate,
    user: AuthedUser = Depends(require_central_warehouse_access),
):
    """Cadastra um novo produto no catálogo do armazém central."""
    db = user.client or get_db("warehouse")
    product_id = str(uuid.uuid4())

    data = {
        "id": product_id,
        "company_id": user.company_id,
        "name": payload.name.strip(),
        "code": payload.code.strip() if payload.code else None,
        "category": payload.category.strip(),
        "price": payload.price,
        "quantity": payload.quantity,
        "min_stock": payload.min_stock,
        "expiry": payload.expiry if payload.expiry else None,
        "supplier": payload.supplier.strip() if payload.supplier else None,
    }

    resp = db.table("products").insert(data).execute()
    created = resp.data if resp and resp.data else data
    if isinstance(created, list) and created:
        created = created[0]
    return _format_row(created)


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: str,
    user: AuthedUser = Depends(get_current_user_with_company),
):
    """Busca detalhes de um produto específico do armazém central."""
    db = user.client or get_db("warehouse")
    resp = (
        db.table("products")
        .select("*")
        .eq("id", product_id)
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado."
        )
    return _format_row(resp.data)


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    user: AuthedUser = Depends(require_central_warehouse_access),
):
    """Atualiza dados cadastrais de um produto."""
    db = user.client or get_db("warehouse")
    update_data = {}
    if payload.name is not None:
        update_data["name"] = payload.name.strip()
    if payload.code is not None:
        update_data["code"] = payload.code.strip()
    if payload.category is not None:
        update_data["category"] = payload.category.strip()
    if payload.price is not None:
        update_data["price"] = payload.price
    if payload.quantity is not None:
        update_data["quantity"] = payload.quantity
    if payload.min_stock is not None:
        update_data["min_stock"] = payload.min_stock
    if payload.expiry is not None:
        update_data["expiry"] = payload.expiry or None
    if payload.supplier is not None:
        update_data["supplier"] = payload.supplier.strip() if payload.supplier else None

    if not update_data:
        raise HTTPException(
            status_code=400, detail="Nenhum campo informado para atualização."
        )

    resp = (
        db.table("products")
        .update(update_data)
        .eq("id", product_id)
        .eq("company_id", user.company_id)
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Produto não encontrado."
        )
    return _format_row(resp.data)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    user: AuthedUser = Depends(require_central_warehouse_access),
):
    """Remove um produto do armazém central."""
    db = user.client or get_db("warehouse")
    db.table("products").delete().eq("id", product_id).eq(
        "company_id", user.company_id
    ).execute()
    return None
