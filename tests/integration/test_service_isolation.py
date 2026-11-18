import os
import subprocess
import sys
from pathlib import Path

import pytest


ROOT_DIR = Path(__file__).resolve().parents[2]


SERVICE_ISOLATION_MATRIX = [
    pytest.param(
        "api-gateway",
        "gateway.main",
        {
            "IDENTITY_SERVICE_URL": "http://ms-identity:8001",
            "WAREHOUSE_SERVICE_URL": "http://ms-warehouse:8002",
            "STORES_SERVICE_URL": "http://ms-stores:8003",
        },
        ("ms_identity", "ms_warehouse", "ms_stores", "app"),
        id="api-gateway-http-isolated",
    ),
    pytest.param(
        "ms-identity",
        "ms_identity.main",
        {},
        ("gateway", "ms_warehouse", "ms_stores", "app"),
        id="ms-identity-isolated",
    ),
    pytest.param(
        "ms-warehouse",
        "ms_warehouse.main",
        {},
        ("gateway", "ms_identity", "ms_stores", "app"),
        id="ms-warehouse-isolated",
    ),
    pytest.param(
        "ms-stores",
        "ms_stores.main",
        {},
        ("gateway", "ms_identity", "ms_warehouse", "app"),
        id="ms-stores-isolated",
    ),
]


@pytest.mark.parametrize(
    ("service_dir", "module_name", "extra_env", "forbidden_prefixes"),
    SERVICE_ISOLATION_MATRIX,
)
def test_servico_inicia_em_subprocesso_isolado_sem_importar_irmaos(
    service_dir: str,
    module_name: str,
    extra_env: dict[str, str],
    forbidden_prefixes: tuple[str, ...],
):
    """Garante que cada contêiner (shared + pasta do serviço) sobe isolado sem acoplamento."""
    isolated_pythonpath = os.pathsep.join([str(ROOT_DIR), str(ROOT_DIR / service_dir)])
    env = os.environ.copy()
    env["PYTHONPATH"] = isolated_pythonpath
    env.update(extra_env)

    script = f"""
import importlib
import sys
from fastapi.testclient import TestClient

mod = importlib.import_module({module_name!r})
app = mod.app

forbidden = {forbidden_prefixes!r}
leaked = [
    name for name in sys.modules
    if any(name == prefix or name.startswith(prefix + ".") for prefix in forbidden)
]
assert not leaked, f"Vazamento de modulos entre servicos: {{leaked}}"

with TestClient(app) as client:
    resp = client.get("/health")
    assert resp.status_code == 200, f"Status inesperado em /health: {{resp.status_code}}"
    payload = resp.json()
    assert isinstance(payload, dict) and payload.get("status")
"""
    proc = subprocess.run(
        [sys.executable, "-s", "-P", "-c", script],
        cwd=str(ROOT_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert proc.returncode == 0, (
        f"Falha ao iniciar {service_dir} isolado.\n"
        f"STDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )


def test_estrutura_raiz_sem_monolito_legado():
    """Confirma que diretórios legados (backend/, frontend/supabase/ e database/supabase/) foram removidos."""
    assert not (ROOT_DIR / "backend").exists(), (
        "Diretório legado backend/ ainda existe."
    )
    assert not (ROOT_DIR / "frontend" / "supabase").exists(), (
        "Diretório legado frontend/supabase/ ainda existe."
    )
    assert not (ROOT_DIR / "database" / "supabase").exists(), (
        "Diretório legado database/supabase/ ainda existe."
    )
    for folder in (
        "api-gateway",
        "ms-identity",
        "ms-warehouse",
        "ms-stores",
        "shared",
        "database/identity",
        "database/warehouse",
        "database/stores",
        "frontend",
        "tests",
    ):
        assert (ROOT_DIR / folder).is_dir(), f"Diretório esperado ausente: {folder}"
