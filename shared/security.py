"""Autenticação e autorização por JWT nativo e dados do MS Identity."""

from dataclasses import dataclass
from typing import Any, Optional

import jwt
from fastapi import Depends, Header, HTTPException, status

from shared.config import settings
from shared.database import get_db
from shared.http_client import identity_client


@dataclass
class AuthedUser:
    id: str
    email: Optional[str]
    company_id: Optional[str]
    role: Optional[str]
    access_token: str
    client: Any
    full_name: Optional[str] = None
    store_id: Optional[str] = None


def _extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação ausente. Envie o header Authorization.",
        )
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação ausente. Envie o header Authorization.",
        )
    return token


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
) -> AuthedUser:
    """Valida o JWT nativo e resolve o perfil e client do banco do serviço."""
    token = _extract_bearer_token(authorization)
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida ou expirada. Faça login novamente.",
        ) from exc

    user_id = str(payload.get("sub") or payload.get("id") or "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida ou expirada. Faça login novamente.",
        )

    email = payload.get("email")
    company_id = payload.get("company_id")
    role = payload.get("role", "operador")
    full_name = payload.get("full_name")
    store_id = payload.get("store_id")
    db_client = get_db()

    if "company_id" not in payload or "role" not in payload:
        profile_response = await identity_client.get(f"/internal/profiles/{user_id}")
        if profile_response.status_code not in (200, 404):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Não foi possível resolver o perfil no serviço de Identidade.",
            )
        pdata = profile_response.json() if profile_response.status_code == 200 else {}
        company_id = payload.get("company_id", pdata.get("company_id"))
        role = payload.get("role", pdata.get("role", "operador"))
        full_name = full_name or pdata.get("full_name")
        store_id = store_id or pdata.get("store_id")

    return AuthedUser(
        id=user_id,
        email=email,
        company_id=company_id,
        role=role,
        full_name=full_name,
        store_id=store_id,
        access_token=token,
        client=db_client,
    )


async def get_current_user_with_company(
    authorization: Optional[str] = Header(default=None),
) -> AuthedUser:
    """Bloqueia usuários ainda sem empresa vinculada."""
    user = await get_current_user(authorization)
    if not user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este usuário ainda não está vinculado a nenhuma empresa.",
        )
    return user


async def require_admin(
    authorization: Optional[str] = Header(default=None),
) -> AuthedUser:
    """Exige empresa vinculada e papel de administrador."""
    user = await get_current_user_with_company(authorization)
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ação restrita a administradores da empresa.",
        )
    return user


async def require_central_warehouse_access(
    user_or_token: Any = Depends(get_current_user_with_company),
) -> AuthedUser:
    """
    Exige empresa vinculada e bloqueia operadores de filial de modificarem
    diretamente o catálogo e o estoque do armazém central.
    Operadores de filial têm acesso somente leitura ao catálogo central
    e afetam o estoque do CD exclusivamente através de Requisições.
    """
    if isinstance(user_or_token, str) or user_or_token is None:
        user = await get_current_user_with_company(user_or_token)
    else:
        user = user_or_token

    if user.store_id is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operadores de filial possuem acesso somente leitura ao armazém central. Utilize a aba Requisições para solicitar produtos.",
        )
    return user
