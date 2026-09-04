"""
Fábrica dos clients Supabase. Este é o arquivo mais sensível do projeto —
qualquer bug aqui pode furar o isolamento entre empresas. Regra de ouro:

- `service_client()`  -> chave service_role. IGNORA o RLS por completo.
  Só deve ser usado nas duas situações abaixo, e sempre filtrando
  `company_id` manualmente no código quando ler/escrever dados:
    1) Onboarding de empresa (usuário ainda não tem company_id, então o
       RLS legitimamente bloquearia a criação).
    2) Convite de novo usuário (API administrativa do Auth).

- `client_for_token(jwt)` -> chave anon + token do usuário logado.
  Toda query feita por esse client passa pelo RLS do Postgres exatamente
  como se tivesse sido feita pelo próprio front-end. É o client usado em
  praticamente todas as rotas — inclusive geração de relatório e
  movimentação de estoque — porque assim o isolamento entre empresas é
  garantido pelo banco, não por lógica do backend.
"""
from supabase import Client, create_client

from app.config import settings


def service_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def anon_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def client_for_token(access_token: str) -> Client:
    """Client autenticado como o usuário dono do token — respeita RLS."""
    client = anon_client()
    client.postgrest.auth(access_token)
    return client
