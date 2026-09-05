"""
Configurações centrais da aplicação, lidas do arquivo .env.
Nunca acesse variáveis de ambiente diretamente pelo código — sempre
importe `settings` daqui, para manter um único ponto de verdade.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # SMTP
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str = "no-reply@validafacil.com.br"
    smtp_from_name: str = "Valida Fácil"

    # Geral
    reports_bucket: str = "reports"
    frontend_url: str = "https://valida-facil-livid.vercel.app"
    environment: str = "development"
    cron_secret: str | None = None
    cors_origins: str = ""

    @property
    def allowed_cors_origins(self) -> list[str]:
        origins = [self.frontend_url]
        if self.cors_origins:
            for o in self.cors_origins.split(","):
                clean = o.strip()
                if clean and clean not in origins:
                    origins.append(clean)
        return origins

    @property
    def is_smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)


settings = Settings()
