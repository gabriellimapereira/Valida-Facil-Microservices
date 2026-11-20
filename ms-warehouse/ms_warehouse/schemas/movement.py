from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class MovementCreate(BaseModel):
    """Payload de criação de movimentação no estoque central."""

    product_id: UUID
    movement_type: Literal["entrada", "saida", "ajuste"]
    quantity_delta: int = Field(
        ...,
        description="Variação de quantidade aplicada (positivo para entrada, negativo para saída, livre em ajustes)",
    )
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
