import pytest

from shared.config import settings
from shared.database import (
    DatabaseClient,
    get_db,
    reset_current_service_name,
    set_current_service_name,
)


def test_get_db_usa_um_postgres_distinto_por_microsservico(monkeypatch):
    urls = {
        "identity_database_url": "postgresql://identity:test@localhost/identity_test",
        "warehouse_database_url": "postgresql://warehouse:test@localhost/warehouse_test",
        "stores_database_url": "postgresql://stores:test@localhost/stores_test",
    }
    monkeypatch.setattr(settings, "database_url", "")
    monkeypatch.setattr(settings, "service_name", "gateway")
    for setting_name, url in urls.items():
        monkeypatch.setattr(settings, setting_name, url)

    clients = {
        service_name: get_db(service_name)
        for service_name in ("identity", "warehouse", "stores")
    }

    assert all(isinstance(client, DatabaseClient) for client in clients.values())
    assert clients["identity"].database_url == urls["identity_database_url"]
    assert clients["warehouse"].database_url == urls["warehouse_database_url"]
    assert clients["stores"].database_url == urls["stores_database_url"]
    assert len({id(client) for client in clients.values()}) == 3


def test_get_db_nao_reaproveita_url_generica_de_outro_servico(monkeypatch):
    monkeypatch.setattr(settings, "service_name", "identity")
    monkeypatch.setattr(
        settings, "database_url", "postgresql://identity:test@localhost/identity"
    )
    monkeypatch.setattr(settings, "identity_database_url", "")
    monkeypatch.setattr(settings, "warehouse_database_url", "")
    monkeypatch.setattr(settings, "stores_database_url", "")

    with pytest.raises(RuntimeError, match="microsserviço 'warehouse'"):
        get_db("warehouse")


def test_url_generica_tem_precedencia_somente_no_processo_do_proprio_servico(
    monkeypatch,
):
    monkeypatch.setattr(settings, "service_name", "identity")
    monkeypatch.setattr(
        settings, "database_url", "postgresql://identity:internal@db-identity/identity"
    )
    monkeypatch.setattr(
        settings,
        "identity_database_url",
        "postgresql://identity:host@localhost/identity",
    )
    monkeypatch.setattr(
        settings,
        "warehouse_database_url",
        "postgresql://warehouse:host@localhost/warehouse",
    )

    assert (
        settings.database_url_for("identity")
        == "postgresql://identity:internal@db-identity/identity"
    )
    assert (
        settings.database_url_for("warehouse")
        == "postgresql://warehouse:host@localhost/warehouse"
    )


def test_backend_postgres_exige_url_do_servico(monkeypatch):
    monkeypatch.setattr(settings, "service_name", "gateway")
    monkeypatch.setattr(settings, "database_url", "")
    monkeypatch.setattr(settings, "identity_database_url", "")
    monkeypatch.setattr(settings, "warehouse_database_url", "")
    monkeypatch.setattr(settings, "stores_database_url", "")

    with pytest.raises(RuntimeError, match="DATABASE_URL configurada"):
        get_db("identity")


def test_fakes_de_integracao_bloqueiam_acesso_a_tabelas_de_outro_servico(fake_client):
    fake_client.tables["companies"] = [{"id": "company-1"}]
    fake_client.tables["products"] = [{"id": "product-1"}]

    service_token = set_current_service_name("warehouse")
    try:
        assert (
            fake_client.table("products").select("*").execute().data[0]["id"]
            == "product-1"
        )
        with pytest.raises(
            AssertionError, match="tabela 'companies' do serviço 'identity'"
        ):
            fake_client.table("companies")
    finally:
        reset_current_service_name(service_token)
