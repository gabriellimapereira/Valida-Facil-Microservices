"""
Geração de relatórios sob demanda. Fluxo: busca dados (RLS garante que só
vem da empresa do usuário) -> agrega com pandas -> gera PDF ->
sobe pro Storage -> devolve link assinado de curta duração.
"""
from fastapi import APIRouter, Depends, HTTPException

from app.core.security import AuthedUser, get_current_user_with_company
from app.schemas.report import ReportRequest, ReportResponse
from app.services import report_service, storage_service
from app.services.storage_service import SIGNED_URL_EXPIRES_IN

router = APIRouter()


@router.post("/generate", response_model=ReportResponse)
async def generate_report(payload: ReportRequest, user: AuthedUser = Depends(get_current_user_with_company)):
    company_resp = user.client.table("companies").select(
        "id, name, cnpj, address, phone, email, notification_email, segment"
    ).eq("id", user.company_id).maybe_single().execute()
    if not company_resp.data:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
    company_data = company_resp.data

    profile_resp = user.client.table("profiles").select("full_name").eq("id", user.id).maybe_single().execute()
    responsible_name = (profile_resp.data or {}).get("full_name") if profile_resp and profile_resp.data else None
    company_data["responsible_name"] = responsible_name

    try:
        content, filename, content_type = report_service.generate_report(
            user.client, company_data, payload
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha ao gerar relatório: {exc}")

    try:
        url = storage_service.upload_and_sign(user.client, user.company_id, filename, content, content_type)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha ao salvar relatório no Storage: {exc}")

    return ReportResponse(url=url, filename=filename, expires_in_seconds=SIGNED_URL_EXPIRES_IN)

