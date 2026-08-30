"""
Upload do arquivo gerado (PDF/XLSX) para um bucket privado do Supabase
Storage, organizado por empresa (`{company_id}/{filename}`), e criação de
uma signed URL de curta duração para o front baixar sem tornar o arquivo
público.
"""
import logging
from supabase import Client

from app.config import settings
from app.core.supabase_client import service_client

logger = logging.getLogger(__name__)
SIGNED_URL_EXPIRES_IN = 600  # 10 minutos


def _ensure_bucket_exists() -> None:
    try:
        admin_client = service_client()
        admin_client.storage.create_bucket(settings.reports_bucket, options={"public": False})
        logger.info(f"Bucket de relatórios '{settings.reports_bucket}' criado com sucesso.")
    except Exception as exc:
        logger.debug(f"Tentativa de criar bucket '{settings.reports_bucket}': {exc}")


def upload_and_sign(client: Client, company_id: str, filename: str, content: bytes, content_type: str) -> str:
    path = f"{company_id}/{filename}"

    # O backend gera o relatório após validar o token e a empresa do usuário.
    # O upload no Storage é feito via service_client (com service_role) para garantir
    # escrita no bucket privado, e a entrega é feita por Signed URL temporária (10 min).
    try:
        admin_client = service_client()
        bucket = admin_client.storage.from_(settings.reports_bucket)
    except Exception:
        bucket = client.storage.from_(settings.reports_bucket)

    try:
        bucket.upload(
            path=path,
            file=content,
            file_options={"content-type": content_type, "upsert": "true"},
        )
    except Exception as exc:
        err_msg = str(exc)
        if "Bucket not found" in err_msg or "404" in err_msg:
            # Bucket ainda não existia no Supabase — cria automaticamente e tenta o upload novamente
            _ensure_bucket_exists()
            bucket.upload(
                path=path,
                file=content,
                file_options={"content-type": content_type, "upsert": "true"},
            )
        else:
            raise exc

    try:
        signed = bucket.create_signed_url(path, SIGNED_URL_EXPIRES_IN, options={"download": filename})
    except Exception:
        signed = bucket.create_signed_url(path, SIGNED_URL_EXPIRES_IN)

    return signed.get("signedURL") or signed.get("signed_url") or signed.get("signedUrl")
