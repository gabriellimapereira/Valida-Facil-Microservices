from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class MovementCreate(BaseModel):
    product_id: UUID
    movement_type: Literal["entrada", "saida", "ajuste"]
    # Positivo para entrada, negativo para saída. Em ajustes, pode ser
    # positivo ou negativo dependendo da correção necessária.
    quantity_delta: int = Field(..., description="Variação de quantidade aplicada ao estoque")
    note: Optional[str] = Field(default=None, max_length=280)


class MovementResult(BaseModel):
    company_id: UUID
    product_id: UUID
    product_name: str
    previous_quantity: int
    new_quantity: int
    min_stock: int
    crossed_low_stock: bool
    notification_email: Optional[str] = None
