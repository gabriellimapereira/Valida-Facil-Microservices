"""
Aplicação FastAPI independente do Microsserviço 1 — Identidade, Tenants & RBAC.
Executa na porta 8001 no docker-compose e registra-se como `asgi://identity` para testes/serverless.
"""

from ms_identity.routers import auth, companies, internal
from shared.app_factory import create_service_app
from shared.http_client import register_asgi_app

app = create_service_app(
    title="Valida Fácil — MS Identity & Tenants",
    description="Microsserviço responsável por empresas (multi-tenant), autenticação JWT nativa, onboarding, perfis RBAC e equipe.",
    service_name="ms-identity",
)

app.include_router(auth.router)
app.include_router(companies.router, prefix="/companies", tags=["Empresas & Equipe"])
app.include_router(
    companies.router, prefix="/api/companies", tags=["Empresas & Equipe"]
)
app.include_router(internal.router, prefix="/internal", tags=["Interno S2S"])

register_asgi_app("identity", app)
