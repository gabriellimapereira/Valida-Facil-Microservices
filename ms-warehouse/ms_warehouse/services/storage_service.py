"""Upload de relatórios para o Object Storage nativo (volume compartilhado / MinIO S3)."""

import logging
from typing import Any

from shared.config import settings
from shared.storage import storage_service

logger = logging.getLogger("valida_facil.ms_warehouse.storage")
SIGNED_URL_EXPIRES_IN = 600  # 10 minutos


def upload_and_sign(
    client: Any, company_id: str, filename: str, content: bytes, content_type: str
) -> str:
    """Salva o relatório no Object Storage nativo e devolve a URL pública gerenciada pelo Gateway."""
    path = f"{company_id}/{filename}"
    return storage_service.save_file(
        settings.reports_bucket, path, content, content_type
    )
