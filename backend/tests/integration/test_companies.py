"""
Testes de integração das rotas de empresa: onboarding (POST /companies),
consulta (GET /companies/me), membros (GET /companies/members) e convite de usuário (POST /companies/invite).
"""
import app.routers.companies as companies_router

COMPANY_PAYLOAD = {
    "name": "Empório Boa Safra",
    "notification_email": "estoque@empresa.com",
    "initials": "EB",
    "phone": "(89) 3222-4455",
    "cnpj": "11.222.333/0001-81",
}


def test_criar_empresa_com_sucesso(monkeypatch, make_test_client, fake_client, make_authed_user):
    fake_client.tables["profiles"] = [{"id": "user-1", "company_id": None, "role": None}]
    monkeypatch.setattr(companies_router, "service_client", lambda: fake_client)

    user = make_authed_user(fake_client, company_id=None, user_id="user-1")
    client = make_test_client(user=user)

    response = client.post("/companies", json=COMPANY_PAYLOAD)

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Empório Boa Safra"
    assert body["initials"] == "EB"

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

    response = client.post("/companies", json={"name": "Empório Boa Safra"})

    assert response.status_code == 422


def test_criar_empresa_sem_cnpj_retorna_422(make_test_client, fake_client, make_authed_user):
    user = make_authed_user(fake_client, company_id=None)
    client = make_test_client(user=user)

    payload = {k: v for k, v in COMPANY_PAYLOAD.items() if k != "cnpj"}
    response = client.post("/companies", json=payload)

    assert response.status_code == 422


def test_criar_empresa_com_cnpj_incompleto_retorna_422(make_test_client, fake_client, make_authed_user):
    user = make_authed_user(fake_client, company_id=None)
    client = make_test_client(user=user)

    response = client.post("/companies", json={**COMPANY_PAYLOAD, "cnpj": "123.456"})

    assert response.status_code == 422


def test_criar_empresa_sem_telefone_retorna_422(make_test_client, fake_client, make_authed_user):
    user = make_authed_user(fake_client, company_id=None)
    client = make_test_client(user=user)

    payload = {k: v for k, v in COMPANY_PAYLOAD.items() if k != "phone"}
    response = client.post("/companies", json=payload)

    assert response.status_code == 422


def test_criar_empresa_com_telefone_incompleto_retorna_422(make_test_client, fake_client, make_authed_user):
    user = make_authed_user(fake_client, company_id=None)
    client = make_test_client(user=user)

    response = client.post("/companies", json={**COMPANY_PAYLOAD, "phone": "8932224"})

    assert response.status_code == 422


def test_criar_empresa_aceita_telefone_celular_11_digitos(monkeypatch, make_test_client, fake_client, make_authed_user):
    fake_client.tables["profiles"] = [{"id": "user-1", "company_id": None, "role": None}]
    monkeypatch.setattr(companies_router, "service_client", lambda: fake_client)

    user = make_authed_user(fake_client, company_id=None, user_id="user-1")
    client = make_test_client(user=user)

    response = client.post("/companies", json={**COMPANY_PAYLOAD, "phone": "(89) 98765-4321"})

    assert response.status_code == 201


def test_criar_empresa_aceita_cnpj_sem_pontuacao(monkeypatch, make_test_client, fake_client, make_authed_user):
    fake_client.tables["profiles"] = [{"id": "user-1", "company_id": None, "role": None}]
    monkeypatch.setattr(companies_router, "service_client", lambda: fake_client)

    user = make_authed_user(fake_client, company_id=None, user_id="user-1")
    client = make_test_client(user=user)

    response = client.post("/companies", json={**COMPANY_PAYLOAD, "cnpj": "11222333000181"})

    assert response.status_code == 201


def test_criar_empresa_com_digitos_verificadores_invalidos_retorna_422(make_test_client, fake_client, make_authed_user):
    user = make_authed_user(fake_client, company_id=None)
    client = make_test_client(user=user)

    response = client.post("/companies", json={**COMPANY_PAYLOAD, "cnpj": "11.222.333/0001-99"})

    assert response.status_code == 422
    assert "dígitos verificadores" in response.text


def test_criar_empresa_com_cnpj_duplicado_retorna_409(monkeypatch, make_test_client, fake_client, make_authed_user):
    class _RaisingCompaniesTable:
        def insert(self, _payload):
            return self

        def execute(self):
            raise Exception('duplicate key value violates unique constraint "companies_cnpj_key"')

    class _RaisingServiceClient:
        def table(self, name):
            if name == "companies":
                return _RaisingCompaniesTable()
            return fake_client.table(name)

    monkeypatch.setattr(companies_router, "service_client", lambda: _RaisingServiceClient())

    user = make_authed_user(fake_client, company_id=None)
    client = make_test_client(user=user)

    response = client.post("/companies", json=COMPANY_PAYLOAD)

    assert response.status_code == 409
    assert "CNPJ" in response.json()["detail"]


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


def test_list_company_members_retorna_membros(make_test_client, fake_client, make_authed_user):
    company_id = "33333333-3333-3333-3333-333333333333"
    fake_client.tables["profiles"] = [
        {"id": "11111111-1111-1111-1111-111111111111", "company_id": company_id, "full_name": "Carlos Silva", "email": "carlos@empresa.com", "role": "admin", "created_at": "2026-01-01T00:00:00Z"},
        {"id": "22222222-2222-2222-2222-222222222222", "company_id": company_id, "full_name": "Mariana Souza", "email": "mariana@empresa.com", "role": "operador", "created_at": "2026-01-02T00:00:00Z"},
    ]
    user = make_authed_user(fake_client, company_id=company_id)
    client = make_test_client(user=user)

    response = client.get("/companies/members")

    assert response.status_code == 200
    members = response.json()
    assert len(members) == 2
    assert members[0]["full_name"] == "Carlos Silva"


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

    assert response.status_code == 201, response.json()
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
    client = make_test_client()

    response = client.post(
        "/companies/invite",
        json={"email": "novo@empresa.com", "full_name": "Novo Usuário", "role": "operador"},
    )

    assert response.status_code == 401


def test_admin_nao_pode_rebaixar_o_proprio_papel(monkeypatch, make_test_client, fake_client, make_authed_user):
    admin_id = "a0000000-0000-0000-0000-000000000001"
    admin_user = make_authed_user(fake_client, company_id="company-1", role="admin", user_id=admin_id)
    client = make_test_client(admin=admin_user)

    response = client.patch(
        f"/companies/members/{admin_id}",
        json={"role": "operador"},
    )

    assert response.status_code == 400
    assert "Você não pode revogar seu próprio papel" in response.json()["detail"]

