"""
Configuração centralizada via variáveis de ambiente (.env) compartilhada pelos microsserviços.
"""

from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_INTERNAL_SERVICE_SECRET = "valida-facil-internal-dev-secret"


class Settings(BaseSettings):
    """Configurações globais e por microsserviço da plataforma Valida Fácil."""

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = ""
    identity_database_url: str = ""
    warehouse_database_url: str = ""
    stores_database_url: str = ""

    jwt_secret: str = "valida-facil-secret-jwt-key-2026"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 1440

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_name: str = "Valida Fácil"
    smtp_from_email: str = ""

    reports_bucket: str = "reports"
    logos_bucket: str = "logos"
    storage_dir: str = "storage"
    minio_endpoint: str = "http://minio:9000"
    minio_public_url: str = "http://localhost:9000"
    frontend_url: str = "http://localhost:5173"
    environment: str = "development"
    cron_secret: str = ""
    cors_origins: str = ""

    service_name: str = "gateway"
    identity_service_url: str = "asgi://identity"
    warehouse_service_url: str = "asgi://warehouse"
    stores_service_url: str = "asgi://stores"
    internal_service_secret: str = DEV_INTERNAL_SERVICE_SECRET
    rabbitmq_url: str = ""
    rabbitmq_exchange: str = "valida_facil.events"
    service_timeout_seconds: float = 15.0

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    def validate_production_security(self) -> None:
        if not self.is_production:
            return
        secret = (self.internal_service_secret or "").strip()
        if not secret or secret == DEV_INTERNAL_SERVICE_SECRET:
            raise ValueError(
                "INTERNAL_SERVICE_SECRET deve ser configurado com um segredo exclusivo em produção."
            )

    @model_validator(mode="after")
    def _check_production_security(self) -> "Settings":
        self.validate_production_security()
        return self

    @property
    def allowed_cors_origins(self) -> List[str]:
        origins = [
            o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()
        ]
        if self.frontend_url:
            origins.append(self.frontend_url.rstrip("/"))
        return list(dict.fromkeys(origins))

    @property
    def is_smtp_configured(self) -> bool:
        return bool(
            self.smtp_host
            and self.smtp_user
            and self.smtp_password
            and self.smtp_from_email
        )

    @property
    def is_rabbitmq_configured(self) -> bool:
        return bool(self.rabbitmq_url.strip())

    def database_url_for(self, service_name: str) -> str:
        normalized_service = service_name.removeprefix("ms-").strip().lower()
        configured_service = self.service_name.removeprefix("ms-").strip().lower()
        if normalized_service == configured_service and self.database_url.strip():
            return self.database_url.strip()

        service_urls = {
            "identity": self.identity_database_url,
            "warehouse": self.warehouse_database_url,
            "stores": self.stores_database_url,
        }
        service_url = service_urls.get(normalized_service, "").strip()
        if service_url:
            return service_url

        return ""


settings = Settings()
