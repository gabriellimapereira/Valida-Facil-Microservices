"""
Testes de integração de POST /reports/generate. A geração do arquivo em si
(PDF/Excel) já é testada a fundo em tests/unit/test_report_service.py —
aqui o foco é a ROTA: ela busca o nome da empresa, chama o service certo,
sobe pro Storage, e trata erro de cada etapa com o status HTTP certo.
"""

import ms_warehouse.routers.reports as reports_router


def test_gera_relatorio_com_sucesso(
    monkeypatch, make_test_client, fake_client, make_authed_user
):
    fake_client.tables["companies"] = [{"id": "company-1", "name": "Empório Boa Safra"}]

    monkeypatch.setattr(
        reports_router.report_service,
        "generate_report",
        lambda client, company_name, request: (
            b"conteudo-fake",
            "relatorio.pdf",
            "application/pdf",
        ),
    )
    monkeypatch.setattr(
        reports_router.storage_service,
        "upload_and_sign",
        lambda client, company_id, filename, content, content_type: (
            "https://storage.fake/relatorio.pdf"
        ),
    )

    user = make_authed_user(fake_client, company_id="company-1")
    client = make_test_client(user=user)

    response = client.post(
        "/reports/generate", json={"report_type": "estoque_atual", "format": "pdf"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["url"] == "https://storage.fake/relatorio.pdf"
    assert body["filename"] == "relatorio.pdf"
    assert body["expires_in_seconds"] > 0


def test_404_quando_empresa_nao_encontrada(
    make_test_client, fake_client, make_authed_user
):
    fake_client.tables["companies"] = []  # empresa "sumiu" da base
    user = make_authed_user(fake_client, company_id="company-inexistente")
    client = make_test_client(user=user)

    response = client.post(
        "/reports/generate", json={"report_type": "estoque_atual", "format": "pdf"}
    )

    assert response.status_code == 404


def test_500_quando_geracao_do_relatorio_falha(
    monkeypatch, make_test_client, fake_client, make_authed_user
):
    fake_client.tables["companies"] = [{"id": "company-1", "name": "Empório Boa Safra"}]

    def _raise(*_args, **_kwargs):
        raise RuntimeError("falha ao renderizar o PDF")

    monkeypatch.setattr(reports_router.report_service, "generate_report", _raise)

    user = make_authed_user(fake_client, company_id="company-1")
    client = make_test_client(user=user)

    response = client.post(
        "/reports/generate", json={"report_type": "estoque_atual", "format": "pdf"}
    )

    assert response.status_code == 500
    assert "renderizar" in response.json()["detail"]


def test_500_quando_upload_para_storage_falha(
    monkeypatch, make_test_client, fake_client, make_authed_user
):
    fake_client.tables["companies"] = [{"id": "company-1", "name": "Empório Boa Safra"}]

    monkeypatch.setattr(
        reports_router.report_service,
        "generate_report",
        lambda client, company_name, request: (
            b"conteudo-fake",
            "relatorio.pdf",
            "application/pdf",
        ),
    )

    def _raise_storage(*_args, **_kwargs):
        raise RuntimeError("bucket indisponível")

    monkeypatch.setattr(
        reports_router.storage_service, "upload_and_sign", _raise_storage
    )

    user = make_authed_user(fake_client, company_id="company-1")
    client = make_test_client(user=user)

    response = client.post(
        "/reports/generate", json={"report_type": "estoque_atual", "format": "pdf"}
    )

    assert response.status_code == 500
    assert "Storage" in response.json()["detail"]


def test_tipo_de_relatorio_invalido_retorna_422(
    make_test_client, fake_client, make_authed_user
):
    user = make_authed_user(fake_client, company_id="company-1")
    client = make_test_client(user=user)

    response = client.post(
        "/reports/generate",
        json={"report_type": "tipo-que-nao-existe", "format": "pdf"},
    )

    assert response.status_code == 422


def test_sem_empresa_vinculada_retorna_403(monkeypatch, make_test_client, fake_client):
    # Deixa a validação JWT real rodar; o override fornece somente o banco isolado de teste.
    from shared import security

    monkeypatch.setattr("shared.security.get_db", lambda *_args: fake_client)
    monkeypatch.setattr(
        security.jwt,
        "decode",
        lambda *_args, **_kwargs: {
            "sub": "user-1",
            "email": "a@empresa.com",
            "company_id": None,
            "role": "operador",
        },
    )

    client = make_test_client()  # sem overrides

    response = client.post(
        "/reports/generate",
        json={"report_type": "estoque_atual", "format": "pdf"},
        headers={"Authorization": "Bearer token-valido"},
    )

    assert response.status_code == 403
