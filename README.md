# Valida Fácil

Sistema integrado de gestão de estoque e controle de validades de produtos (FEFO) para redes varejistas e distribuidoras, com Armazém Central, Lojas/Filiais e orquestração de requisições.

---

## Como Rodar Localmente (Sem Docker nos Serviços)

### 1. Pré-requisitos
- Python 3.11+ com ambiente virtual (`.venv`)
- Node.js 18+
- Bancos de dados PostgreSQL ativos (Identity na porta 5435, Warehouse na 5433, Stores na 5434).

> **Dica:** Para subir somente os bancos em segundo plano rapidamente:
> ```bash
> docker compose up -d db-identity db-warehouse db-stores
> ```

---

### 2. Inicialização dos Serviços

Abra dois terminais na raiz do projeto:

#### Terminal 1 — Backend (API Gateway + Microsserviços In-Process)
```bash
source .venv/bin/activate
./scripts/run_local.sh
```
*O API Gateway e todos os microsserviços estarão disponíveis em `http://localhost:8000`.*

#### Terminal 2 — Frontend (React + Vite)
```bash
cd frontend
npm run dev
```
*Acesse a interface no navegador em `http://localhost:5173`.*

> **Atalho:** Você também pode iniciar ambos a partir da raiz usando os scripts do `package.json`:
> ```bash
> npm run dev:backend   # Terminal 1
> npm run dev:frontend  # Terminal 2
> ```

---

## Credenciais de Demonstração

| Perfil | E-mail | Senha | Escopo de Acesso |
| :--- | :--- | :--- | :--- |
| **Administrador** | `admin@validafacil.com.br` | `SenhaForte123!` | Gestão global, aprovação e despacho de requisições |
| **Operador CD** | `operador@validafacil.com.br` | `SenhaForte123!` | Operações de movimentação no Armazém Central |
| **Operador Filial** | `operador.filial@validafacil.com.br` | `SenhaForte123!` | Gestão da loja filial vinculada e emissão de requisições |

---

## Testes Automatizados

```bash
# Executa a suíte unificada (Backend 129 testes + Frontend 130 testes)
npm test

# Ou individualmente:
.venv/bin/pytest tests/
npm test --prefix frontend -- --run
```

---

## Documentação Técnica Aprofundada

Para especificações detalhadas de contratos REST, arquitetura de microsserviços, schemas de banco e fluxos Saga, consulte:
- [DOCUMENTACAO.md](./DOCUMENTACAO.md)
- [DOCUMENTACAO_MICROSSERVICOS.md](./DOCUMENTACAO_MICROSSERVICOS.md)

## Link da Apresentação
- https://drive.google.com/file/d/1bSDIh3fCcV_ohGQrC2NhTiZl83jUGcsC/view?usp=sharing
