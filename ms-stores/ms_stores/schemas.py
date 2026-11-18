"""Schemas do MS Stores (Lojas Filiais, Movimentações Locais e Requisições)."""

from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class StoreCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    code: str = Field(..., min_length=2, max_length=40)
    address: Optional[str] = Field(default=None, max_length=240)
    phone: Optional[str] = Field(default=None, max_length=40)

    @field_validator("name", "code")
    @classmethod
    def strip_required(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 2:
            raise ValueError("Campo deve ter ao menos 2 caracteres válidos.")
        return cleaned


class StoreUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    code: Optional[str] = Field(default=None, min_length=2, max_length=40)
    address: Optional[str] = Field(default=None, max_length=240)
    phone: Optional[str] = Field(default=None, max_length=40)


class StoreOut(BaseModel):
    id: str
    company_id: str
    code: str
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    created_at: Optional[str] = None


class StoreInventoryOut(BaseModel):
    id: str
    store_id: str
    product_id: str
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    category: Optional[str] = None
    expiry: Optional[str] = None
    quantity: int
    min_stock: int
    updated_at: Optional[str] = None


class StoreInventoryMovement(BaseModel):
    product_id: UUID
    quantity_delta: int = Field(
        ..., description="Quantidade positiva (entrada) ou negativa (saída local)"
    )
    note: Optional[str] = Field(default=None, max_length=280)

    @field_validator("quantity_delta")
    @classmethod
    def validate_non_zero(cls, v: int) -> int:
        if v == 0:
            raise ValueError("A movimentação na filial deve ser diferente de zero.")
        return v


class StoreMinStockUpdate(BaseModel):
    min_stock: int = Field(..., ge=0)


class StoreMovementOut(BaseModel):
    id: str
    store_id: str
    product_id: str
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    changed_by: Optional[str] = None
    changed_by_name: Optional[str] = None
    movement_type: str
    quantity_delta: int
    previous_quantity: Optional[int] = None
    new_quantity: Optional[int] = None
    requisition_id: Optional[str] = None
    note: Optional[str] = None
    created_at: Optional[str] = None


class RequisitionItemCreate(BaseModel):
    product_id: UUID
    quantity_requested: int = Field(..., gt=0)


class RequisitionItemApproval(BaseModel):
    product_id: UUID
    quantity_approved: int = Field(..., ge=0)


class RequisitionCreate(BaseModel):
    store_id: UUID
    notes: Optional[str] = Field(default=None, max_length=500)
    items: List[RequisitionItemCreate] = Field(..., min_length=1)


class RequisitionStatusUpdate(BaseModel):
    status: Literal["aprovada", "despachada", "recebida", "cancelada"]
    items_approved: Optional[List[RequisitionItemApproval]] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class RequisitionItemOut(BaseModel):
    id: str
    product_id: str
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    expiry: Optional[str] = None
    quantity_requested: int
    quantity_approved: Optional[int] = None


class RequisitionOut(BaseModel):
    id: str
    company_id: str
    store_id: str
    store_name: Optional[str] = None
    requested_by: Optional[str] = None
    requested_by_name: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    items: List[RequisitionItemOut] = []
