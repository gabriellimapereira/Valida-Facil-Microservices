from datetime import datetime
from typing import List, Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field


class RequisitionItemCreate(BaseModel):
    product_id: Union[UUID, str]
    quantity_requested: int = Field(..., gt=0, le=1_000_000)


class RequisitionCreate(BaseModel):
    store_id: Union[UUID, str]
    notes: Optional[str] = Field(default=None, max_length=500)
    items: List[RequisitionItemCreate] = Field(..., min_length=1)


class RequisitionItemOut(BaseModel):
    id: Union[UUID, str]
    product_id: Union[UUID, str]
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    quantity_requested: int
    quantity_approved: Optional[int] = None


class RequisitionOut(BaseModel):
    id: Union[UUID, str]
    company_id: Union[UUID, str]
    store_id: Union[UUID, str]
    store_name: Optional[str] = None
    requested_by: Optional[Union[UUID, str]] = None
    requested_by_name: Optional[str] = None
    status: Literal["pendente", "aprovada", "despachada", "recebida", "cancelada"]
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    items: List[RequisitionItemOut] = []


class RequisitionStatusUpdate(BaseModel):
    status: Literal["pendente", "aprovada", "despachada", "recebida", "cancelada"]
    items_approved: Optional[List[dict]] = None  # [{"product_id": "...", "quantity_approved": 10}]
