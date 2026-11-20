"""
Rotas de Autenticação Nativa (MS Identity & Tenants).
Fornece login, registro de conta e emissão de JWT desacoplados do Supabase.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from ms_identity.services.auth_tokens import (
    consume_action_token,
    issue_and_send_action_email,
    validate_action_token,
)
from shared.auth import AuthedUser, get_current_user
from shared.config import settings
from shared.database import get_db

logger = logging.getLogger("ms_identity.auth")

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserOut(BaseModel):
    id: str
    email: str
    role: str = "operador"
    company_id: Optional[str] = None
    full_name: Optional[str] = None
    store_id: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)
    company_name: Optional[str] = None
    cnpj: Optional[str] = None
    phone: Optional[str] = None


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordActionRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=200)
    password: str = Field(..., min_length=8)


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


def _create_jwt(
    user_id: str,
    email: str,
    company_id: Optional[str],
    role: str,
    full_name: Optional[str],
    store_id: Optional[str],
) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "company_id": company_id,
        "role": role,
        "full_name": full_name,
        "store_id": store_id,
        "iat": int(now.timestamp()),
        "exp": int(
            (now + timedelta(minutes=settings.jwt_expiration_minutes)).timestamp()
        ),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest):
    """Autentica o usuário com email e senha e retorna um token JWT assinado."""
    db = get_db("identity")

    resp = (
        db.table("users")
        .select("*")
        .eq("email", payload.email.lower().strip())
        .maybe_single()
        .execute()
    )
    user_row = (resp.data or {}) if resp else {}

    if not user_row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas. Verifique seu e-mail e senha.",
        )

    stored_hash = user_row.get("password_hash", "")
    try:
        is_valid = bcrypt.checkpw(
            payload.password.encode("utf-8"), stored_hash.encode("utf-8")
        )
    except Exception:
        is_valid = False

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas. Verifique seu e-mail e senha.",
        )

    user_id = str(user_row["id"])

    prof_resp = (
        db.table("profiles").select("*").eq("id", user_id).maybe_single().execute()
    )
    prof_row = (prof_resp.data or {}) if prof_resp else {}

    company_id = str(prof_row["company_id"]) if prof_row.get("company_id") else None
    role = prof_row.get("role") or "operador"
    full_name = prof_row.get("full_name") or user_row.get("email")
    store_id = str(prof_row["store_id"]) if prof_row.get("store_id") else None

    token = _create_jwt(
        user_id, user_row["email"], company_id, role, full_name, store_id
    )

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut(
            id=user_id,
            email=user_row["email"],
            role=role,
            company_id=company_id,
            full_name=full_name,
            store_id=store_id,
        ),
    )


@router.post("/password-reset")
async def request_password_reset(payload: PasswordResetRequest):
    """Envia link de recuperação sem revelar se o e-mail está cadastrado."""
    if not settings.is_smtp_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="O envio de recuperação de senha não está configurado.",
        )

    db = get_db("identity")
    response = (
        db.table("users")
        .select("id, email")
        .eq("email", payload.email.lower().strip())
        .maybe_single()
        .execute()
    )
    user = response.data if response else None
    if user:
        try:
            issue_and_send_action_email(
                db, str(user["id"]), user["email"], "password_reset"
            )
        except Exception as exc:
            logger.exception(
                "Falha ao enviar recuperação de senha para %s.", user["email"]
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Não foi possível enviar o e-mail de recuperação.",
            ) from exc

    return {
        "message": "Se o e-mail estiver cadastrado, você receberá um link de recuperação."
    }


@router.get("/password-reset/validate")
async def validate_password_reset(token: str):
    valid = bool(validate_action_token(get_db("identity"), token, "password_reset"))
    return {"valid": valid}


@router.post("/password-reset/confirm")
async def confirm_password_reset(payload: PasswordActionRequest):
    password_hash = bcrypt.hashpw(
        payload.password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")
    user_id = consume_action_token(
        get_db("identity"),
        payload.token,
        "password_reset",
        password_hash,
    )
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Link inválido ou expirado."
        )
    return {"message": "Senha alterada com sucesso."}


@router.post("/password/change")
async def change_password(
    payload: PasswordChangeRequest, user: AuthedUser = Depends(get_current_user)
):
    db = get_db("identity")
    response = (
        db.table("users")
        .select("password_hash")
        .eq("id", user.id)
        .maybe_single()
        .execute()
    )
    user_row = response.data if response else None
    stored_hash = (user_row or {}).get("password_hash", "")
    try:
        valid = bcrypt.checkpw(
            payload.current_password.encode("utf-8"), stored_hash.encode("utf-8")
        )
    except (ValueError, TypeError):
        valid = False
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A senha atual está incorreta.",
        )

    password_hash = bcrypt.hashpw(
        payload.new_password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")
    db.table("users").update({"password_hash": password_hash}).eq(
        "id", user.id
    ).execute()
    return {"message": "Senha alterada com sucesso."}


@router.get("/invitation/validate")
async def validate_invitation(token: str):
    valid = bool(validate_action_token(get_db("identity"), token, "invitation"))
    return {"valid": valid}


@router.post("/invitation/accept")
async def accept_invitation(payload: PasswordActionRequest):
    password_hash = bcrypt.hashpw(
        payload.password.encode("utf-8"), bcrypt.gensalt()
    ).decode("utf-8")
    user_id = consume_action_token(
        get_db("identity"),
        payload.token,
        "invitation",
        password_hash,
    )
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Convite inválido ou expirado.",
        )
    return {"message": "Convite aceito."}


@router.post(
    "/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED
)
async def register(payload: RegisterRequest):
    """Cria uma nova conta de usuário (e empresa, se informada) no db-identity."""
    db = get_db("identity")
    email = payload.email.lower().strip()

    existing = (
        db.table("users").select("id").eq("email", email).maybe_single().execute()
    )
    if existing and existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este e-mail já está cadastrado no sistema.",
        )

    user_id = str(uuid.uuid4())
    pw_hash = bcrypt.hashpw(payload.password.encode("utf-8"), bcrypt.gensalt()).decode(
        "utf-8"
    )

    db.table("users").insert(
        {
            "id": user_id,
            "email": email,
            "password_hash": pw_hash,
            "is_active": True,
        }
    ).execute()

    company_id = None
    role = "operador"

    if payload.company_name and payload.cnpj:
        company_id = str(uuid.uuid4())
        initials = (
            "".join([w[0].upper() for w in payload.company_name.split() if w][:2])
            or "VF"
        )
        db.table("companies").insert(
            {
                "id": company_id,
                "name": payload.company_name,
                "cnpj": payload.cnpj,
                "phone": payload.phone or "(00) 00000-0000",
                "notification_email": email,
                "initials": initials,
            }
        ).execute()
        role = "admin"

    db.table("profiles").insert(
        {
            "id": user_id,
            "company_id": company_id,
            "full_name": payload.full_name,
            "email": email,
            "role": role,
        }
    ).execute()

    token = _create_jwt(user_id, email, company_id, role, payload.full_name, None)

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut(
            id=user_id,
            email=email,
            role=role,
            company_id=company_id,
            full_name=payload.full_name,
            store_id=None,
        ),
    )


@router.get("/me", response_model=UserOut)
async def get_me(user: AuthedUser = Depends(get_current_user)):
    """Retorna os dados cadastrais do usuário autenticado a partir do token."""
    return UserOut(
        id=user.id,
        email=user.email or "",
        role=user.role or "operador",
        company_id=user.company_id,
        full_name=user.full_name,
        store_id=user.store_id,
    )
