"""
Rotas públicas (via API Gateway) de Empresas, Onboarding, Equipe e Convites (MS Identity).
"""

import logging
import bcrypt
import secrets
import time
from typing import Dict, List, Optional
from uuid import UUID, uuid4

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Response,
    UploadFile,
    status,
)

from ms_identity.schemas import (
    CompanyCreate,
    CompanyOut,
    CompanyUpdate,
    InviteUserRequest,
    InviteUserResponse,
    MemberOut,
    UpdateMemberRequest,
)
from ms_identity.services.auth_tokens import issue_and_send_action_email
from shared.auth import (
    AuthedUser,
    get_current_user,
    get_current_user_with_company,
    require_admin,
)
from shared.database import get_db
from shared.http_client import stores_client
from shared.storage import storage_service

logger = logging.getLogger("valida_facil.ms_identity.companies")

router = APIRouter()


def _get_admin_client():
    """Retorna o client administrativo do banco exclusivo do serviço Identity."""
    return get_db("identity")


async def _validate_store_for_company(
    store_id: UUID,
    company_id: str,
    access_token: str,
) -> Optional[str]:
    """
    Valida via HTTP no MS Stores se a filial existe e pertence à empresa do usuário.
    Preserva o isolamento de banco por serviço (Identity nunca lê tabela `stores` direto).
    """
    headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}
    resp = await stores_client.get(
        f"/internal/stores/{store_id}",
        params={"company_id": company_id},
        headers=headers,
    )
    if resp.status_code == 404:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Filial informada não encontrada para esta empresa.",
        )
    if resp.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Não foi possível validar a filial junto ao serviço de Lojas.",
        )
    data = resp.json()
    return data.get("name")


async def _fetch_store_names_map(company_id: str, access_token: str) -> Dict[str, str]:
    """Consulta o mapa {store_id: store_name} via HTTP no MS Stores."""
    headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}
    try:
        resp = await stores_client.get(
            "/internal/stores/map",
            params={"company_id": company_id},
            headers=headers,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, dict):
                return data
    except Exception as exc:
        logger.debug("Falha ao buscar nomes de filiais no MS Stores: %s", exc)
    return {}


@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
async def create_company(
    payload: CompanyCreate, user: AuthedUser = Depends(get_current_user)
):
    """Onboarding de empresa usando chave administrativa (usuário ainda sem company_id no RLS)."""
    if user.company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este usuário já está vinculado a uma empresa.",
        )

    admin_client = _get_admin_client()
    try:
        company_resp = (
            admin_client.table("companies").insert(payload.model_dump()).execute()
        )
    except Exception as exc:
        message = str(exc).lower()
        if "duplicate" in message or "unique" in message or "cnpj" in message:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe uma empresa cadastrada com esse CNPJ.",
            )
        logger.exception("Falha ao criar empresa para usuário %s: %s", user.id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível criar a empresa no banco de dados. Tente novamente mais tarde.",
        )

    rows = company_resp.data or []
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Empresa criada, mas os dados não foram retornados pelo banco.",
        )
    company = rows[0]

    try:
        admin_client.table("profiles").update(
            {"company_id": company["id"], "role": "admin", "store_id": None}
        ).eq("id", user.id).execute()
    except Exception as exc:
        logger.exception(
            "Falha ao vincular usuário %s à empresa %s; executando rollback: %s",
            user.id,
            company["id"],
            exc,
        )
        admin_client.table("companies").delete().eq("id", company["id"]).execute()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao vincular perfil administrador à nova empresa.",
        )

    return company


@router.get("/me", response_model=CompanyOut)
async def get_my_company(user: AuthedUser = Depends(get_current_user)):
    if not user.company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário ainda não possui empresa vinculada.",
        )
    resp = (
        user.client.table("companies")
        .select("*")
        .eq("id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa não encontrada.",
        )
    return resp.data


@router.patch("/me", response_model=CompanyOut)
async def update_my_company(
    payload: CompanyUpdate, user: AuthedUser = Depends(require_admin)
):
    updates = {
        k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None
    }
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum dado informado para atualização.",
        )
    try:
        resp = (
            user.client.table("companies")
            .update(updates)
            .eq("id", user.company_id)
            .execute()
        )
    except Exception as exc:
        if "cnpj" in str(exc).lower() or "unique" in str(exc).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Já existe outra empresa cadastrada com esse CNPJ.",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível atualizar os dados da empresa.",
        )
    rows = resp.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    return rows[0]


MAX_LOGO_SIZE_BYTES = 3 * 1024 * 1024  # 3MB
ALLOWED_LOGO_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/svg+xml",
}


@router.post("/logo", response_model=CompanyOut)
@router.post("/{company_id}/logo", response_model=CompanyOut)
async def upload_company_logo(
    file: UploadFile = File(...),
    company_id: Optional[str] = None,
    user: AuthedUser = Depends(require_admin),
):
    """Upload do logotipo da empresa para o Object Storage e atualização de logo_url."""
    target_company_id = str(user.company_id)
    if company_id and str(company_id) != target_company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para alterar o logo de outra empresa.",
        )

    content_type = file.content_type or "image/png"
    if content_type.lower() not in ALLOWED_LOGO_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato inválido. Por favor, envie uma imagem PNG, JPG, WebP ou SVG.",
        )

    content = await file.read()
    if len(content) > MAX_LOGO_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A imagem deve ter no máximo 3MB.",
        )

    ext = "png"
    if file.filename and "." in file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower()
    if ext == "jpeg":
        ext = "jpg"

    filename = f"logo_{int(time.time())}.{ext}"
    path = f"{target_company_id}/{filename}"

    logo_url = storage_service.save_file("logos", path, content, content_type)

    db = user.client or _get_admin_client()
    resp = (
        db.table("companies")
        .update({"logo_url": logo_url})
        .eq("id", target_company_id)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    return rows[0]


@router.delete("/logo", response_model=CompanyOut)
@router.delete("/{company_id}/logo", response_model=CompanyOut)
async def remove_company_logo(
    company_id: Optional[str] = None,
    user: AuthedUser = Depends(require_admin),
):
    """Remove o logotipo da empresa no Object Storage e no banco de dados."""
    target_company_id = str(user.company_id)
    if company_id and str(company_id) != target_company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Você não tem permissão para alterar o logo de outra empresa.",
        )

    db = user.client or _get_admin_client()
    resp = (
        db.table("companies")
        .update({"logo_url": None})
        .eq("id", target_company_id)
        .execute()
    )
    rows = resp.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    return rows[0]


@router.get("/members", response_model=List[MemberOut])
async def list_company_members(
    user: AuthedUser = Depends(get_current_user_with_company),
):
    resp = (
        user.client.table("profiles")
        .select("id, full_name, email, role, store_id, created_at")
        .eq("company_id", user.company_id)
        .order("created_at")
        .execute()
    )
    members = resp.data or []
    has_store_links = any(m.get("store_id") for m in members)
    store_names = (
        await _fetch_store_names_map(str(user.company_id), user.access_token)
        if has_store_links
        else {}
    )

    enriched = []
    for m in members:
        sid = m.get("store_id")
        enriched.append(
            {
                **m,
                "store_id": sid,
                "store_name": store_names.get(str(sid)) if sid else None,
            }
        )
    return enriched


@router.post(
    "/invite", response_model=InviteUserResponse, status_code=status.HTTP_201_CREATED
)
async def invite_user(
    payload: InviteUserRequest, user: AuthedUser = Depends(require_admin)
):
    if payload.store_id is not None:
        await _validate_store_for_company(
            payload.store_id, str(user.company_id), user.access_token
        )

    admin_client = _get_admin_client()

    existing_profile_resp = (
        admin_client.table("profiles")
        .select("id, email, company_id, role")
        .eq("email", payload.email.lower().strip())
        .maybe_single()
        .execute()
    )
    existing_profile = existing_profile_resp.data if existing_profile_resp else None

    store_id_str = str(payload.store_id) if payload.store_id else None

    if existing_profile:
        if existing_profile.get("company_id") == user.company_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este colaborador já faz parte da sua empresa.",
            )
        if existing_profile.get("company_id") is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Este e-mail já está vinculado a outra empresa no sistema.",
            )
        admin_client.table("profiles").update(
            {
                "company_id": user.company_id,
                "role": "operador",
                "full_name": payload.full_name,
                "store_id": store_id_str,
            }
        ).eq("id", existing_profile["id"]).execute()
        return InviteUserResponse(
            status="colaborador adicionado",
            user_id=str(existing_profile["id"]),
            email=payload.email,
        )

    existing_user_resp = (
        admin_client.table("users")
        .select("id")
        .eq("email", payload.email.lower().strip())
        .maybe_single()
        .execute()
    )
    if existing_user_resp and existing_user_resp.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este e-mail já está cadastrado no sistema.",
        )

    user_id = str(uuid4())
    password_hash = bcrypt.hashpw(secrets.token_bytes(32), bcrypt.gensalt()).decode(
        "utf-8"
    )
    try:
        admin_client.table("users").insert(
            {
                "id": user_id,
                "email": payload.email.lower().strip(),
                "password_hash": password_hash,
                "is_active": True,
            }
        ).execute()
        admin_client.table("profiles").insert(
            {
                "id": user_id,
                "company_id": user.company_id,
                "full_name": payload.full_name,
                "email": payload.email.lower().strip(),
                "role": "operador",
                "store_id": store_id_str,
            }
        ).execute()
        issue_and_send_action_email(
            admin_client,
            user_id,
            payload.email.lower().strip(),
            "invitation",
        )
    except Exception as exc:
        logger.exception(
            "Falha ao criar convite para %s na empresa %s.",
            payload.email,
            user.company_id,
        )
        try:
            admin_client.table("profiles").delete().eq("id", user_id).execute()
            admin_client.table("users").delete().eq("id", user_id).execute()
        except Exception:
            logger.exception(
                "Falha ao desfazer o cadastro incompleto do convite %s.", user_id
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Não foi possível criar e enviar o convite. Verifique a configuração de SMTP.",
        ) from exc

    return InviteUserResponse(
        status="convite enviado",
        user_id=user_id,
        email=payload.email,
    )


@router.patch("/members/{member_id}", response_model=MemberOut)
async def update_member(
    member_id: UUID,
    payload: UpdateMemberRequest,
    user: AuthedUser = Depends(require_admin),
):
    fields_set = payload.model_fields_set
    if not fields_set:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe ao menos o perfil de acesso ou a filial de vínculo.",
        )

    if (
        payload.role is not None
        and str(member_id) == str(user.id)
        and payload.role == "operador"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode revogar seu próprio papel de administrador.",
        )

    update_data: dict = {}
    if "role" in fields_set and payload.role is not None:
        update_data["role"] = payload.role

    store_name: Optional[str] = None
    if "store_id" in fields_set:
        if payload.store_id is not None:
            store_name = await _validate_store_for_company(
                payload.store_id, str(user.company_id), user.access_token
            )
            update_data["store_id"] = str(payload.store_id)
        else:
            update_data["store_id"] = None

    admin_client = _get_admin_client()
    existing_resp = (
        admin_client.table("profiles")
        .select("id, full_name, email, role, store_id, created_at")
        .eq("id", str(member_id))
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not existing_resp or not existing_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Colaborador não encontrado nesta empresa.",
        )

    resp = (
        admin_client.table("profiles")
        .update(update_data)
        .eq("id", str(member_id))
        .eq("company_id", user.company_id)
        .execute()
    )
    updated_rows = resp.data or []
    updated = updated_rows[0] if updated_rows else {**existing_resp.data, **update_data}

    if updated.get("store_id") and store_name is None:
        store_map = await _fetch_store_names_map(
            str(user.company_id), user.access_token
        )
        store_name = store_map.get(str(updated["store_id"]))

    return {
        **updated,
        "store_name": store_name,
    }


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(member_id: UUID, user: AuthedUser = Depends(require_admin)):
    if str(member_id) == str(user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Você não pode remover a si mesmo da empresa.",
        )

    admin_client = _get_admin_client()
    existing = (
        admin_client.table("profiles")
        .select("id")
        .eq("id", str(member_id))
        .eq("company_id", user.company_id)
        .maybe_single()
        .execute()
    )
    if not existing or not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Colaborador não encontrado nesta empresa.",
        )

    admin_client.table("profiles").update(
        {"company_id": None, "role": "operador", "store_id": None}
    ).eq("id", str(member_id)).eq("company_id", user.company_id).execute()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
