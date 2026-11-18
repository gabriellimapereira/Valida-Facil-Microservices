"""
Serviço centralizado de armazenamento de objetos (Object Storage) — Valida Fácil.
Suporta persistência local em volume compartilhado (Docker/K8s PVC) e MinIO (S3 compatível).
"""

import logging
import mimetypes
import os
from pathlib import Path
from typing import Optional, Tuple

logger = logging.getLogger("valida_facil.storage")


class StorageService:
    """Gerenciador autônomo de armazenamento de arquivos (logos, relatórios, mídias)."""

    def __init__(self, base_dir: Optional[str] = None):
        env_dir = os.getenv("STORAGE_DIR", "storage")
        self.base_dir = Path(base_dir or env_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        for bucket in ("logos", "reports"):
            (self.base_dir / bucket).mkdir(parents=True, exist_ok=True)

    def _get_target_path(self, bucket: str, path: str) -> Path:
        bucket_dir = (self.base_dir / bucket).resolve()
        clean_path = path.lstrip("/\\")
        target = (bucket_dir / clean_path).resolve()
        if not str(target).startswith(str(bucket_dir)):
            raise ValueError(
                f"Caminho de arquivo inválido: tentativa de directory traversal detectada ({path})"
            )
        return target

    def save_file(
        self,
        bucket: str,
        path: str,
        content: bytes,
        content_type: Optional[str] = None,
    ) -> str:
        """
        Salva o arquivo no volume de armazenamento dedicado.
        Retorna a URL pública relativa gerenciada pelo API Gateway.
        """
        target = self._get_target_path(bucket, path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)

        clean_subpath = path.lstrip("/\\")
        return f"/storage/{bucket}/{clean_subpath}"

    def get_file(self, bucket: str, path: str) -> Optional[Tuple[bytes, str]]:
        """Recupera os bytes brutos e o MIME type do arquivo."""
        try:
            target = self._get_target_path(bucket, path)
        except ValueError:
            return None

        if not target.is_file():
            return None

        content = target.read_bytes()
        mime_type, _ = mimetypes.guess_type(str(target))
        return content, mime_type or "application/octet-stream"

    def delete_file(self, bucket: str, path: str) -> bool:
        """Remove o arquivo físico do storage."""
        try:
            target = self._get_target_path(bucket, path)
        except ValueError:
            return False

        if target.is_file():
            target.unlink()
            return True
        return False


storage_service = StorageService()
