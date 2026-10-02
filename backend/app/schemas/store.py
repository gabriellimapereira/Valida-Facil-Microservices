from datetime import datetime
from typing import Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field


class StoreCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    code: str = Field(..., min_length=1, max_length=50)
    address: Optional[str] = Field(default=None, max_length=250)
    phone: Optional[str] = Field(default=None, max_length=20)


class StoreUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    address: Optional[str] = Field(default=None, max_length=250)
    phone: Optional[str] = Field(default=None, max_length=20)


class StoreOut(BaseModel):
    id: Union[UUID, str]
    company_id: Union[UUID, str]
    name: str
    code: str
    address: Optional[str] = None
    phone: Optional[str] = None
    created_at: Optional[datetime] = None


class StoreInventoryItem(BaseModel):
    id: Union[UUID, str]
    store_id: Union[UUID, str]
    product_id: Union[UUID, str]
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    category: Optional[str] = None
    quantity: int
    min_stock: int
    updated_at: Optional[datetime] = None


class StoreInventoryMovement(BaseModel):
    product_id: Union[UUID, str]
    quantity_delta: int = Field(..., ge=-1_000_000, le=1_000_000)
    note: Optional[str] = Field(default=None, max_length=250)
