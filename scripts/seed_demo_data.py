#!/usr/bin/env python3
"""
Valida Fácil — Script de Carga de Dados de Demonstração e Apresentação.

Popula os 3 bancos de dados independentes (db-identity, db-warehouse e db-stores)
com dados realistas para demonstração completa de fluxos de negócio, multi-tenancy,
alertas de validade, requisições filiais e padrão Saga.
"""

import os
from pathlib import Path
import psycopg

ROOT_DIR = Path(__file__).resolve().parent.parent

IDENTITY_DB_URL = os.getenv(
    "IDENTITY_DATABASE_URL",
    "postgresql://valida_identity:local_identity_password@127.0.0.1:5435/valida_identity",
)
WAREHOUSE_DB_URL = os.getenv(
    "WAREHOUSE_DATABASE_URL",
    "postgresql://valida_warehouse:local_warehouse_password@127.0.0.1:5433/valida_warehouse",
)
STORES_DB_URL = os.getenv(
    "STORES_DATABASE_URL",
    "postgresql://valida_stores:local_stores_password@127.0.0.1:5434/valida_stores",
)

SQL_FILES = [
    (
        "Identity (Usuários e Empresas)",
        IDENTITY_DB_URL,
        ROOT_DIR / "database" / "identity" / "seeds.sql",
    ),
    (
        "Warehouse (Produtos e Movimentações)",
        WAREHOUSE_DB_URL,
        ROOT_DIR / "database" / "warehouse" / "seeds.sql",
    ),
    (
        "Stores (Lojas e Requisições)",
        STORES_DB_URL,
        ROOT_DIR / "database" / "stores" / "seeds.sql",
    ),
]


def run_sql(title: str, db_url: str, sql_path: Path):
    print(f"\n📦 Aplicando dados em: {title}...")
    if not sql_path.exists():
        print(f"❌ Arquivo SQL não encontrado: {sql_path}")
        return False

    sql_content = sql_path.read_text(encoding="utf-8")
    try:
        with psycopg.connect(db_url, connect_timeout=5) as conn:
            with conn.cursor() as cur:
                cur.execute(sql_content)
            conn.commit()
        print(f"✅ {title}: Dados aplicados com sucesso!")
        return True
    except Exception as exc:
        print(f"⚠️ Não foi possível conectar a {title}: {exc}")
        print(
            "   (Verifique se os containers Docker estão rodando via 'docker compose up -d')"
        )
        return False


def main():
    print("=" * 70)
    print("🚀 Valida Fácil — Inicializador de Dados de Apresentação")
    print("=" * 70)

    success_count = 0
    for title, db_url, sql_path in SQL_FILES:
        if run_sql(title, db_url, sql_path):
            success_count += 1

    print("\n" + "=" * 70)
    if success_count == len(SQL_FILES):
        print("🎉 TODOS OS BANCOS FORAM CARREGADOS COM SUCESSO!")
    else:
        print(f"ℹ️ {success_count}/{len(SQL_FILES)} bancos atualizados.")
        print("   Nota: Se o Docker ainda não foi iniciado, estes mesmos dados")
        print("   serão aplicados automaticamente na primeira inicialização!")
    print("=" * 70)

    print("""
📋 GUIA DE DEMONSTRAÇÃO PARA A APRESENTAÇÃO:

1. ACESSO AO SISTEMA:
   👉 Frontend: http://localhost:3000 (ou http://localhost:5173 em dev)
   👉 API Gateway / Docs: http://localhost:8000/docs
   👉 Painel RabbitMQ: http://localhost:15672 (user: validafacil / pass: validafacil123)

2. CONTAS DE USUÁRIO PRONTAS (Senha de todos: admin123):
   • Carlos Silva (Admin Geral da Matriz):
     E-mail: admin@validafacil.com.br
     Acesso: Visão completa, relatórios analíticos, gestão de lojas e colaboradores.

   • Mariana Costa (Gerente Geral):
     E-mail: gerente@validafacil.com.br
     Acesso: Gestão operacional de armazém e lojas.

   • Roberto Almoxarife (Operador do CD Central):
     E-mail: armazem@validafacil.com.br
     Acesso: Despacho de cargas, movimentações de estoque (entradas/saídas) e relatórios.

   • Juliana Santos (Operadora Filial Centro):
     E-mail: loja.centro@validafacil.com.br
     Acesso: Solicitação de requisições e conferência de recebimento da Filial Centro.

   • Lucas Mendes (Operador Filial Shopping):
     E-mail: loja.shopping@validafacil.com.br
     Acesso: Filial Shopping (com requisição despachada em trânsito pronta para receber!).

   • Ana Beatriz (Admin de Empresa Concorrente - Multi-Tenancy):
     E-mail: admin@alvorada.com.br
     Acesso: Demonstração de que os dados do Supermercado Alvorada são 100% isolados.

3. CENÁRIOS PREPARADOS PARA MOSTRAR:
   🔴 Produtos Críticos (Vencem em 1 a 3 dias - destaque em vermelho na listagem)
   🟡 Produtos em Atenção (Vencem em 4 a 7 dias - alerta amarelo)
   ⚫ Produtos Vencidos (Para filtrar e mostrar geração de relatórios de descarte)
   ⚠️ Produtos com Estoque Baixo (Abaixo do estoque mínimo configurado)
   🚚 Ciclo Completo de Abastecimento (Requisições Pendente, Despachada e Recebida)
   🔄 Compensação Saga (Requisição cancelada com estorno automático de estoque)
""")


if __name__ == "__main__":
    main()
