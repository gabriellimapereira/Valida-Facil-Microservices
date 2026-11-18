"""
Rotas de geração de relatórios PDF/Excel e armazenamento — MS Warehouse.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException

from ms_warehouse.schemas.report import ReportRequest, ReportResponse
from ms_warehouse.services import report_service, storage_service
from shared.auth import AuthedUser, get_current_user_with_company
from shared.http_client import identity_client

logger = logging.getLogger("valida_facil.ms_warehouse.reports")
router = APIRouter()


async def _fetch_company_name(user: AuthedUser) -> str | None:
    headers = (
        {"Authorization": f"Bearer {user.access_token}"} if user.access_token else {}
    )
    try:
        resp = await identity_client.get(
            f"/internal/companies/{user.company_id}", headers=headers
        )
    except Exception as exc:
        logger.exception(
            "Falha ao consultar empresa %s no MS Identity.", user.company_id
        )
        raise HTTPException(
            status_code=502,
            detail="Não foi possível consultar os dados da empresa no serviço de Identidade.",
        ) from exc
    if resp.status_code == 404:
        return None
    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail="O serviço de Identidade não conseguiu consultar a empresa.",
        )
    return resp.json().get("name")


@router.post("/generate", response_model=ReportResponse)
async def generate_report_route(
    payload: ReportRequest,
    user: AuthedUser = Depends(get_current_user_with_company),
):
    company_name = await _fetch_company_name(user)
    if not company_name:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")

    try:
        content, filename, content_type = report_service.generate_report(
            user.client,
            company_name,
            payload,
        )
    except Exception as exc:
        logger.exception("Erro ao gerar relatório: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Falha ao renderizar o relatório: {exc}",
        )

    try:
        signed_url = storage_service.upload_and_sign(
            user.client,
            user.company_id,
            filename,
            content,
            content_type,
        )
    except Exception as exc:
        logger.exception("Erro ao enviar relatório para o Storage: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Falha ao salvar o relatório no Storage: {exc}",
        )

    return ReportResponse(
        url=signed_url,
        filename=filename,
        expires_in_seconds=storage_service.SIGNED_URL_EXPIRES_IN,
    )
