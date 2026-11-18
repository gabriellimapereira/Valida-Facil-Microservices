#!/usr/bin/env bash
set -e

# =====================================================================
# Valida Fácil — Inicializador Local (Opção A: Modo In-Process ASGI)
# Sobe o API Gateway orquestrando os 3 microsserviços em 1 único processo.
# =====================================================================

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

export PYTHONPATH=".:api-gateway:ms-identity:ms-warehouse:ms-stores"

PORT="${PORT:-8000}"

echo "======================================================"
echo "  🚀 Iniciando Valida Fácil em Modo Local (Opção A)"
echo "  📡 API Gateway + Microsserviços na porta: $PORT"
echo "======================================================"

exec uvicorn gateway.main:app --host 0.0.0.0 --port "$PORT" --reload
