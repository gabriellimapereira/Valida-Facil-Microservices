"""
Autenticação e autorização das rotas.

O fluxo é: o front envia o JWT que o próprio Supabase Auth emitiu no login
(header `Authorization: Bearer <token>`). O backend NÃO reimplementa
validação de senha nem gera seus próprios tokens — ele apenas repassa esse
token para o Supabase confirmar que é válido (`auth.get_user`) e, a partir
daí, usa um client "amarrado" a esse usuário para todas as queries — ou
seja, o RLS do Postgres é quem decide o que ele pode ou não acessar.

Isso é proposital: mesmo que exista um bug de lógica em alguma rota daqui,
o banco continua recusando acesso a dados de outra empresa.
"""
from dataclasses import dataclass
from typing import Optional

from fastapi import Header, HTTPException, status
from supabase import Client

from app.core.supabase_client import client_for_token


@dataclass
class AuthedUser:
    id: str
    email: Optional[str]
    company_id: Optional[str]
    role: Optional[str]
    access_token: str
    client: Client  # já autenticado como este usuário — respeita RLS
    full_name: Optional[str] = None


def _extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticação ausente. Envie o header Authorization: Bearer <token>.",
        )
    return authorization.split(" ", 1)[1].strip()


async def get_current_user(authorization: Optional[str] = Header(default=None)) -> AuthedUser:
    """
    Valida o JWT junto ao Supabase Auth e carrega o perfil (empresa + papel).
    Não exige que o usuário já tenha uma empresa vinculada — use
    `get_current_user_with_company` para rotas que exigem isso.
    """
    token = _extract_bearer_token(authorization)
    client = client_for_token(token)

    try:
        auth_response = client.auth.get_user(token)
    except Exception as exc:  # token expirado, malformado, revogado etc.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão inválida ou expirada. Faça login novamente.",
        ) from exc

    user = getattr(auth_response, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida.")

    try:
        profile_resp = (
            client.table("profiles")
            .select("company_id, role, full_name")
            .eq("id", user.id)
            .maybe_single()
            .execute()
        )
        profile_data = profile_resp.data or {}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha ao consultar perfil no Supabase: {exc}",
        ) from exc

    return AuthedUser(
        id=user.id,
        email=user.email,
        company_id=profile_data.get("company_id"),
        role=profile_data.get("role"),
        full_name=profile_data.get("full_name"),
        access_token=token,
        client=client,
    )


async def get_current_user_with_company(
    authorization: Optional[str] = Header(default=None),
) -> AuthedUser:
    """Mesma coisa que get_current_user, mas bloqueia quem ainda não
    completou o onboarding (sem empresa vinculada)."""
    user = await get_current_user(authorization)
    if not user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Este usuário ainda não está vinculado a nenhuma empresa.",
        )
    return user


async def require_admin(authorization: Optional[str] = Header(default=None)) -> AuthedUser:
    """Para rotas administrativas (convidar usuário, disparar relatório
    manual etc.) — exige empresa vinculada E papel 'admin'."""
    user = await get_current_user_with_company(authorization)
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Ação restrita a administradores da empresa.",
        )
    return user
