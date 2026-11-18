"""Schemas do MS Warehouse (Armazém Central, FEFO e Operações Internas S2S)."""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field


class ProductAvailabilityOut(BaseModel):
    id: str
    code: Optional[str] = None
    name: str
    category: Optional[str] = None
    quantity: int = 0
    min_stock: int = 0
    expiry: Optional[str] = None
    days_to_expiry: Optional[int] = None
    expiry_status: Literal[
        "vencido", "critico", "atencao", "normal", "sem_validade"
    ] = "sem_validade"
    low_stock: bool = False


class ProductsBatchRequest(BaseModel):
    company_id: str
    product_ids: List[str] = Field(default_factory=list)


class DispatchItemRequest(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0)


class InternalDispatchRequest(BaseModel):
    company_id: str
    requisition_id: str
    store_id: str
    store_name: str = ""
    changed_by: Optional[str] = None
    items: List[DispatchItemRequest] = Field(..., min_length=1)


class InternalReleaseRequest(BaseModel):
    company_id: str
    requisition_id: str
    changed_by: Optional[str] = None
    items: List[DispatchItemRequest] = Field(..., min_length=1)
