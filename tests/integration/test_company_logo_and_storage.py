"""
Testes de integração do Object Storage autônomo e endpoints de Logotipo da Empresa.
Valida upload multipart, validação de MIME type, limite de 3MB, remoção e entrega estática.
"""

import io

from shared.storage import storage_service


def test_upload_company_logo_com_sucesso(
    make_test_client, fake_client, make_authed_user
):
    fake_client.tables["companies"] = [
        {
            "id": "company-1",
            "name": "Empório Boa Safra",
            "cnpj": "12345678000199",
            "phone": "11987654321",
            "notification_email": "contato@boasafra.com",
            "initials": "BS",
            "logo_url": None,
        }
    ]
    admin = make_authed_user(fake_client, company_id="company-1", role="admin")
    client = make_test_client(user=admin, admin=admin)

    # Imagem fake em memória (PNG)
    png_header = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" + b"fake-png-content"
    files = {"file": ("logotipo.png", io.BytesIO(png_header), "image/png")}

    response = client.post("/companies/logo", files=files)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["logo_url"] is not None
    assert "/storage/logos/company-1/logo_" in data["logo_url"]
    assert data["logo_url"].endswith(".png")

    # Verifica que o arquivo foi realmente persistido no Object Storage
    file_path = data["logo_url"].removeprefix("/storage/logos/")
    content, mime = storage_service.get_file("logos", file_path)
    assert content == png_header
    assert "png" in mime


def test_upload_company_logo_recusa_formato_invalido(
    make_test_client, fake_client, make_authed_user
):
    fake_client.tables["companies"] = [{"id": "company-1", "name": "Empório Boa Safra"}]
    admin = make_authed_user(fake_client, company_id="company-1", role="admin")
    client = make_test_client(user=admin, admin=admin)

    # Envia arquivo PDF fingindo ser imagem ou executável
    files = {
        "file": (
            "malware.exe",
            io.BytesIO(b"MZfakeexecutable"),
            "application/octet-stream",
        )
    }
    response = client.post("/companies/logo", files=files)
    assert response.status_code == 400
    assert "Formato inválido" in response.json()["detail"]


def test_upload_company_logo_recusa_arquivo_maior_que_3mb(
    make_test_client, fake_client, make_authed_user
):
    fake_client.tables["companies"] = [{"id": "company-1", "name": "Empório Boa Safra"}]
    admin = make_authed_user(fake_client, company_id="company-1", role="admin")
    client = make_test_client(user=admin, admin=admin)

    # Gera 3.5 MB de dados
    big_data = b"X" * (3 * 1024 * 1024 + 1024)
    files = {"file": ("foto_gigante.png", io.BytesIO(big_data), "image/png")}
    response = client.post("/companies/logo", files=files)
    assert response.status_code == 400
    assert "3MB" in response.json()["detail"]


def test_remove_company_logo(make_test_client, fake_client, make_authed_user):
    fake_client.tables["companies"] = [
        {
            "id": "company-1",
            "name": "Empório Boa Safra",
            "logo_url": "/storage/logos/company-1/logo_123.png",
        }
    ]
    admin = make_authed_user(fake_client, company_id="company-1", role="admin")
    client = make_test_client(user=admin, admin=admin)

    response = client.delete("/companies/logo")
    assert response.status_code == 200
    assert response.json()["logo_url"] is None


def test_gateway_serve_arquivo_armazenado(make_test_client):
    # Grava arquivo fake diretamente no storage service
    storage_service.save_file(
        "logos", "test-company/logo_test.png", b"conteudo-de-teste", "image/png"
    )

    client = make_test_client()
    response = client.get("/storage/logos/test-company/logo_test.png")
    assert response.status_code == 200
    assert response.content == b"conteudo-de-teste"
    assert "image/png" in response.headers.get("content-type", "")
    assert "max-age=3600" in response.headers.get("cache-control", "")

    # Arquivo inexistente retorna 404
    missing_resp = client.get("/storage/logos/inexistente/inexistente.png")
    assert missing_resp.status_code == 404
