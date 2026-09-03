"""
Onboarding de empresa, gestão de equipe (membros) e convite de usuários.
"""
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.core.security import AuthedUser, get_current_user, get_current_user_with_company, require_admin
from app.core.supabase_client import service_client
from app.schemas.company import (
    CompanyCreate,
    CompanyOut,
    InviteUserRequest,
    InviteUserResponse,
    MemberOut,
    UpdateMemberRoleRequest,
)

router = APIRouter()


@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
async def create_company(payload: CompanyCreate, user: AuthedUser = Depends(get_current_user)):
    if user.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este usuário já está vinculado a uma empresa.",
        )

    admin_client = service_client()

    try:
        company_resp = admin_client.table("companies").insert(
            payload.model_dump(exclude_none=True)
        ).execute()
    except Exception as exc:
        message = str(exc).lower()
        if "duplicate" in message or "unique" in message or "cnpj" in message:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe uma empresa cadastrada com esse CNPJ.",
            )
        raise HTTPException(status_code=500, detail=f"Não foi possível criar a empresa: {exc}")

    if not company_resp.data:
        raise HTTPException(status_code=500, detail="Não foi possível criar a empresa.")
    company = company_resp.data[0]

    admin_client.table("profiles").update(
        {"company_id": company["id"], "role": "admin"}
    ).eq("id", user.id).execute()

    return company


@router.get("/me", response_model=CompanyOut)
async def get_my_company(user: AuthedUser = Depends(get_current_user)):
    if not user.company_id:
        raise HTTPException(status_code=404, detail="Usuário sem empresa vinculada.")
    resp = user.client.table("companies").select("*").eq("id", user.company_id).maybe_single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    return resp.data


@router.get("/members", response_model=List[MemberOut])
async def list_company_members(user: AuthedUser = Depends(get_current_user_with_company)):
    """Retorna todos os colaboradores/membros da empresa do usuário logado."""
    resp = (
        user.client.table("profiles")
        .select("id, full_name, email, role, created_at")
        .eq("company_id", user.company_id)
        .execute()
    )
    return resp.data or []


@router.post("/invite", response_model=InviteUserResponse, status_code=status.HTTP_201_CREATED)
async def invite_user(payload: InviteUserRequest, user: AuthedUser = Depends(require_admin)):
    admin_client = service_client()

    # Busca o nome do administrador que está convidando e o nome da empresa
    admin_profile_resp = (
        user.client.table("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybe_single()
        .execute()
    )
    admin_name = (admin_profile_resp.data or {}).get("full_name") or user.email or "Administrador"

    company_resp = (
        user.client.table("companies")
        .select("name")
        .eq("id", user.company_id)
        .maybe_single()
        .execute()
    )
    company_name = (company_resp.data or {}).get("name") or "Valida Fácil"

    try:
        created = admin_client.auth.admin.invite_user_by_email(
            payload.email,
            {
                "data": {
                    "full_name": payload.full_name,
                    "invited_by": admin_name,
                    "company_name": company_name,
                },
                "redirect_to": f"{settings.frontend_url}/definir-senha",
            },
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Não foi possível convidar o usuário: {exc}")

    new_user = getattr(created, "user", None)
    if not new_user:
        raise HTTPException(status_code=500, detail="Convite não retornou um usuário válido.")

    admin_client.table("profiles").update(
        {"company_id": user.company_id, "role": "operador", "full_name": payload.full_name, "email": payload.email}
    ).eq("id", new_user.id).execute()

    return InviteUserResponse(status="convite enviado", user_id=new_user.id, email=payload.email)


@router.patch("/members/{member_id}", response_model=MemberOut)
async def update_member_role(
    member_id: UUID,
    payload: UpdateMemberRoleRequest,
    user: AuthedUser = Depends(require_admin),
):
    """Altera o papel de um membro da equipe (Apenas Administrador)."""
    admin_client = service_client()
    resp = (
        admin_client.table("profiles")
        .update({"role": payload.role})
        .eq("id", str(member_id))
        .eq("company_id", user.company_id)
        .select("id, full_name, email, role, created_at")
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Membro não encontrado ou não pertence a esta empresa.")
    return resp.data


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(member_id: UUID, user: AuthedUser = Depends(require_admin)):
    """Remove o vínculo de um colaborador com a empresa (Apenas Administrador)."""
    if str(member_id) == str(user.id):
        raise HTTPException(status_code=400, detail="Você não pode remover seu próprio usuário da empresa.")

    admin_client = service_client()
    profile_resp = (
        admin_client.table("profiles")
        .select("id, email")
        .eq("id", str(member_id))
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not profile_resp.data:
        raise HTTPException(status_code=404, detail="Membro não encontrado ou não pertence a esta empresa.")

    try:
        admin_client.auth.admin.delete_user(str(member_id))
    except Exception:
        admin_client.table("profiles").update({"company_id": None, "role": "operador"}).eq("id", str(member_id)).execute()

    return None
