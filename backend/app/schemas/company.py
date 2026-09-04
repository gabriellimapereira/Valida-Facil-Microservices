import re
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


def _validate_cnpj_digits(digits: str) -> bool:
    """Verifica os dois dígitos verificadores do CNPJ pelo algoritmo módulo 11."""
    if len(digits) != 14 or len(set(digits)) == 1:
        return False

    def _calc_digit(d: str, weights: list[int]) -> int:
        total = sum(int(d[i]) * weights[i] for i in range(len(weights)))
        remainder = total % 11
        return 0 if remainder < 2 else 11 - remainder

    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

    return (
        _calc_digit(digits, w1) == int(digits[12])
        and _calc_digit(digits, w2) == int(digits[13])
    )


class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    segment: Optional[str] = Field(default=None, max_length=100)
    email: Optional[EmailStr] = None
    notification_email: EmailStr
    phone: str = Field(..., description="Telefone com DDD, com ou sem pontuação")
    cnpj: str = Field(..., description="CNPJ da empresa, com ou sem pontuação")
    address: Optional[str] = Field(default=None, max_length=300)
    initials: str = Field(..., min_length=1, max_length=3)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value or "")
        if len(digits) < 10 or len(digits) > 11:
            raise ValueError("Telefone deve conter DDD + número (10 ou 11 dígitos).")
        return value.strip()

    @field_validator("cnpj")
    @classmethod
    def validate_cnpj(cls, value: str) -> str:
        digits = re.sub(r"\D", "", value or "")
        if len(digits) != 14:
            raise ValueError("CNPJ deve conter 14 dígitos (com ou sem pontuação).")
        if not _validate_cnpj_digits(digits):
            raise ValueError("CNPJ inválido. Verifique os dígitos verificadores.")
        return value.strip()

    @field_validator("initials")
    @classmethod
    def validate_initials(cls, value: str) -> str:
        if not re.match(r"^[A-Za-zÀ-ÿ0-9]{1,3}$", value):
            raise ValueError("Iniciais devem conter apenas letras e números (1 a 3 caracteres).")
        return value.upper()


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
    full_name: str = Field(..., min_length=2, max_length=150)
    role: Literal["admin", "operador"] = "operador"


class InviteUserResponse(BaseModel):
    status: str
    user_id: str
    email: EmailStr


class MemberOut(BaseModel):
    id: UUID
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    created_at: Optional[datetime] = None


class UpdateMemberRoleRequest(BaseModel):
    role: Literal["admin", "operador"]

