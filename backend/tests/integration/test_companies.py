"""
Testes de integração das rotas de empresa: onboarding (POST /companies),
consulta (GET /companies/me) e convite de usuário (POST /companies/invite)
— as duas primeiras usam a chave service_role, por isso precisam de um
tratamento especial nos testes (ver comentário abaixo).
"""
import app.routers.companies as companies_router

COMPANY_PAYLOAD = {
    "name": "Empório Boa Safra",
    "notification_email": "estoque@empresa.com",
    "initials": "EB",
}


def test_criar_empresa_com_sucesso(monkeypatch, make_test_client, fake_client, make_authed_user):
    # companies.py chama service_client() diretamente (não via Depends),
    # então o jeito de interceptar é sobrescrever o nome importado dentro
    # do MÓDULO DA ROTA — sobrescrever app.core.supabase_client.service_client
    # não teria efeito aqui, porque "from x import y" já copiou a referência.
    fake_client.tables["profiles"] = [{"id": "user-1", "company_id": None, "role": None}]
    monkeypatch.setattr(companies_router, "service_client", lambda: fake_client)

    user = make_authed_user(fake_client, company_id=None, user_id="user-1")
    client = make_test_client(user=user)

    response = client.post("/companies", json=COMPANY_PAYLOAD)

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Empório Boa Safra"
    assert body["initials"] == "EB"

    # confirma que o profile do usuário foi vinculado como admin
    profile = fake_client.tables["profiles"][0]
    assert profile["company_id"] == body["id"]
    assert profile["role"] == "admin"


def test_nao_deixa_criar_empresa_se_usuario_ja_tem_uma(make_test_client, fake_client, make_authed_user):
    user = make_authed_user(fake_client, company_id="company-ja-existe")
    client = make_test_client(user=user)

    response = client.post("/companies", json=COMPANY_PAYLOAD)

    assert response.status_code == 400


def test_criar_empresa_sem_autenticacao_retorna_401(make_test_client):
    client = make_test_client()

    response = client.post("/companies", json=COMPANY_PAYLOAD)

    assert response.status_code == 401


def test_criar_empresa_com_payload_incompleto_retorna_422(make_test_client, fake_client, make_authed_user):
    user = make_authed_user(fake_client, company_id=None)
    client = make_test_client(user=user)

    # faltam campos obrigatórios: notification_email e initials
    response = client.post("/companies", json={"name": "Empório Boa Safra"})

    assert response.status_code == 422


def test_get_my_company_retorna_dados_da_empresa(make_test_client, fake_client, make_authed_user):
    fake_client.tables["companies"] = [
        {
            "id": "33333333-3333-3333-3333-333333333333",
            "name": "Empório Boa Safra",
            "created_at": "2026-01-01T00:00:00Z",
        }
    ]
    user = make_authed_user(fake_client, company_id="33333333-3333-3333-3333-333333333333")
    client = make_test_client(user=user)

    response = client.get("/companies/me")

    assert response.status_code == 200
    assert response.json()["name"] == "Empório Boa Safra"


def test_get_my_company_404_sem_empresa_vinculada(make_test_client, fake_client, make_authed_user):
    user = make_authed_user(fake_client, company_id=None)
    client = make_test_client(user=user)

    response = client.get("/companies/me")

    assert response.status_code == 404


class FakeInvitedUser:
    id = "new-user-1"


class FakeInviteResult:
    user = FakeInvitedUser()


class FakeAdminAuth:
    def invite_user_by_email(self, _email, _options):
        return FakeInviteResult()


class FakeAdminAuthFalhando:
    def invite_user_by_email(self, _email, _options):
        raise Exception("e-mail já cadastrado")


def test_convite_como_admin_funciona(monkeypatch, make_test_client, fake_client, make_authed_user):
    fake_client.auth.admin = FakeAdminAuth()
    fake_client.tables["profiles"] = [{"id": "new-user-1", "company_id": None, "role": None}]
    monkeypatch.setattr(companies_router, "service_client", lambda: fake_client)

    admin_user = make_authed_user(fake_client, company_id="company-1", role="admin")
    client = make_test_client(admin=admin_user)

    response = client.post(
        "/companies/invite",
        json={"email": "novo@empresa.com", "full_name": "Novo Usuário", "role": "operador"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["user_id"] == "new-user-1"

    profile = fake_client.tables["profiles"][0]
    assert profile["company_id"] == "company-1"
    assert profile["role"] == "operador"


def test_convite_com_falha_no_supabase_retorna_400(monkeypatch, make_test_client, fake_client, make_authed_user):
    fake_client.auth.admin = FakeAdminAuthFalhando()
    monkeypatch.setattr(companies_router, "service_client", lambda: fake_client)

    admin_user = make_authed_user(fake_client, company_id="company-1", role="admin")
    client = make_test_client(admin=admin_user)

    response = client.post(
        "/companies/invite",
        json={"email": "duplicado@empresa.com", "full_name": "Duplicado", "role": "operador"},
    )

    assert response.status_code == 400


def test_convite_sem_autenticacao_retorna_401(make_test_client):
    # O papel específico (admin vs operador) já é testado a fundo em
    # tests/unit/test_security.py::TestRequireAdmin — aqui só confirmamos
    # que a rota está mesmo protegida por ALGUMA autenticação (pega
    # regressão tipo "esqueceram de colocar Depends(require_admin)").
    client = make_test_client()

    response = client.post(
        "/companies/invite",
        json={"email": "novo@empresa.com", "full_name": "Novo Usuário", "role": "operador"},
    )

    assert response.status_code == 401
