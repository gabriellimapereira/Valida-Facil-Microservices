"""
Endpoints internos (S2S) do MS Identity para consultas síncronas de outros microsserviços.
Nunca expostos diretamente aos clientes finais pelo API Gateway.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from shared.auth import require_internal_service, resolve_db_client

router = APIRouter(dependencies=[Depends(require_internal_service)])


class MembersBatchRequest(BaseModel):
    company_id: str
    user_ids: List[str]


@router.get("/members/{user_id}")
async def get_member_internal(
    user_id: str,
    request: Request,
    company_id: str = Query(...),
):
    client = resolve_db_client(request)
    resp = (
        client.table("profiles")
        .select("id, full_name, email, role, store_id, company_id")
        .eq("id", user_id)
        .eq("company_id", company_id)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(
            status_code=404, detail="Usuário não encontrado na empresa."
        )
    return resp.data


@router.get("/profiles/{user_id}")
async def get_profile_internal(user_id: str, request: Request):
    """Resolve claims de um JWT legado sem expor o banco do Identity aos outros serviços."""
    client = resolve_db_client(request)
    resp = (
        client.table("profiles")
        .select("id, company_id, role, full_name, store_id")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")
    return resp.data


@router.post("/members/batch")
async def get_members_batch_internal(payload: MembersBatchRequest, request: Request):
    if not payload.user_ids:
        return {}
    client = resolve_db_client(request)
    unique_ids = set(str(uid) for uid in payload.user_ids if uid)
    resp = (
        client.table("profiles")
        .select("id, full_name, email, role, store_id")
        .eq("company_id", payload.company_id)
        .execute()
    )
    result = {}
    for row in resp.data or []:
        if str(row.get("id")) in unique_ids:
            result[str(row["id"])] = row
    return result


@router.get("/companies/{company_id}")
async def get_company_internal(company_id: str, request: Request):
    client = resolve_db_client(request)
    resp = (
        client.table("companies")
        .select("id, name, notification_email, segment")
        .eq("id", company_id)
        .maybe_single()
        .execute()
    )
    if not resp or not resp.data:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    return resp.data
