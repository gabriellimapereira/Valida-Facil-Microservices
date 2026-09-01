from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class MovementCreate(BaseModel):
    product_id: UUID
    movement_type: Literal["entrada", "saida", "ajuste"]
    # Positivo para entrada, negativo para saída. Em ajustes, pode ser
    # positivo ou negativo dependendo da correção necessária (máximo 1.000.000).
    quantity_delta: int = Field(..., ge=-1_000_000, le=1_000_000, description="Variação de quantidade aplicada ao estoque")
    note: Optional[str] = Field(default=None, max_length=280)

    @field_validator("quantity_delta")
    @classmethod
    def validate_non_zero(cls, v: int) -> int:
        if v == 0:
            raise ValueError("A variação de quantidade não pode ser zero.")
        return v


class MovementResult(BaseModel):
    company_id: UUID
    product_id: UUID
    product_name: str
    previous_quantity: int
    new_quantity: int
    min_stock: int
    crossed_low_stock: bool
    notification_email: Optional[str] = None
