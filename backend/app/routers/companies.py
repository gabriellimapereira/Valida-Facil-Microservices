"""
Onboarding de empresa e convite de usuários.

Estas são justamente as duas operações que NÃO dá pra fazer só com o
Supabase direto do front: criar empresa exige a chave service_role
(porque o usuário ainda não tem company_id, então o RLS bloquearia
legitimamente a criação), e convidar usuário exige a Admin API do Auth.
"""
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import AuthedUser, get_current_user, require_admin
from app.core.supabase_client import service_client
from app.schemas.company import (
    CompanyCreate,
    CompanyOut,
    InviteUserRequest,
    InviteUserResponse,
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

    company_resp = admin_client.table("companies").insert(
        payload.model_dump(exclude_none=True)
    ).execute()
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


@router.post("/invite", response_model=InviteUserResponse, status_code=status.HTTP_201_CREATED)
async def invite_user(payload: InviteUserRequest, user: AuthedUser = Depends(require_admin)):
    admin_client = service_client()

    try:
        created = admin_client.auth.admin.invite_user_by_email(
            payload.email,
            {"data": {"full_name": payload.full_name}},
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Não foi possível convidar o usuário: {exc}")

    new_user = getattr(created, "user", None)
    if not new_user:
        raise HTTPException(status_code=500, detail="Convite não retornou um usuário válido.")

    admin_client.table("profiles").update(
        {"company_id": user.company_id, "role": payload.role, "full_name": payload.full_name}
    ).eq("id", new_user.id).execute()

    return InviteUserResponse(status="convite enviado", user_id=new_user.id, email=payload.email)
