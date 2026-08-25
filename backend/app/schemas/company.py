import re
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    segment: Optional[str] = Field(default=None, max_length=100)
    email: Optional[EmailStr] = None
    notification_email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=20)
    cnpj: str = Field(..., description="CNPJ da empresa, com ou sem pontuação")
    address: Optional[str] = Field(default=None, max_length=300)
    initials: str = Field(..., min_length=1, max_length=3)

    @field_validator("cnpj")
    @classmethod
    def validate_cnpj(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value or "")
        if len(digits) != 14:
            raise ValueError("CNPJ deve conter 14 dígitos (com ou sem pontuação).")
        return value.strip()


class CompanyOut(BaseModel):
    id: UUID
    name: str
    segment: Optional[str] = None
    email: Optional[str] = None
    notification_email: Optional[str] = None
    phone: Optional[str] = None
    cnpj: Optional[str] = None
    address: Optional[str] = None
    initials: Optional[str] = None
    created_at: datetime


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    segment: Optional[str] = None
    notification_email: Optional[EmailStr] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class InviteUserRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=2)
    role: Literal["admin", "operador"] = "operador"


class InviteUserResponse(BaseModel):
    status: str
    user_id: str
    email: EmailStr
