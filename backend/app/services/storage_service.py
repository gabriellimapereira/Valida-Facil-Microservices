"""
Upload do arquivo gerado (PDF/XLSX) para um bucket privado do Supabase
Storage, organizado por empresa (`{company_id}/{filename}`), e criação de
uma signed URL de curta duração para o front baixar sem tornar o arquivo
público.
"""
from supabase import Client

from app.config import settings

SIGNED_URL_EXPIRES_IN = 600  # 10 minutos


def upload_and_sign(client: Client, company_id: str, filename: str, content: bytes, content_type: str) -> str:
    path = f"{company_id}/{filename}"
    bucket = client.storage.from_(settings.reports_bucket)

    bucket.upload(
        path=path,
        file=content,
        file_options={"content-type": content_type, "upsert": "true"},
    )

    signed = bucket.create_signed_url(path, SIGNED_URL_EXPIRES_IN)
    # Dependendo da versão do supabase-py, a chave retornada varia.
    return signed.get("signedURL") or signed.get("signed_url") or signed.get("signedUrl")
