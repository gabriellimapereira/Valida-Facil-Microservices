# Valida Facil

Sistema integrado de gestao de estoque e controle de validades de produtos para redes varejistas e distribuidoras.

---

## 1. Visao Geral

O Valida Facil e uma plataforma corporativa desenvolvida para gerenciar fluxos de estoque, rastrear datas de validade por lote e otimizar o abastecimento entre armazens centrais e lojas filiais. O sistema elimina perdas financeiras decorrentes de produtos vencidos por meio de monitoramento preventivo, aplicacao da regra FEFO (First Expire, First Out) e emissao automatica de alertas.

### Principais Capacidades
- Rastreamento continuo de datas de validade com classificacao automatica de urgencia (critico, atencao e em dia).
- Controle de estoque minimo com disparo imediato de notificacoes por e-mail quando o saldo cruza o limiar de seguranca.
- Registro transacional e atomico de movimentacoes de estoque (entradas e saidas), com historico de auditoria imutavel.
- Geracao sob demanda de relatorios gerenciais em formatos PDF e planilhas Excel (XLSX).
- Arquitetura multi-tenant com isolamento logico de dados por empresa e gestao de colaboradores com controle de acesso baseado em funcoes (RBAC).

---

## 2. Arquitetura e Tecnologias

A solução separa APIs de negócio em microsserviços, com PostgreSQL independente para cada domínio (Database-per-Service) e Object Storage padronizado (volume compartilhado ou MinIO S3).

### Camada de Apresentacao (Frontend)
- React 18 com Vite
- Tailwind CSS para estilizacao de componentes
- React Router DOM v6 para gerenciamento de rotas e protecao de sessao
- Lucide React para iconografia tecnica
- Vitest e React Testing Library para cobertura de testes unitarios e de integracao

### Camada de Servicos e Negocio (Backend)
- FastAPI (Python 3.11) com operacoes assincronas
- Pydantic v2 para validacao rigorosa de schemas e sanitizacao de payloads
- WeasyPrint e Jinja2 para renderizacao de relatorios em PDF
- Pandas e OpenPyXL para compilacao de planilhas analiticas
- APScheduler para rotinas em desenvolvimento local e Vercel Cron para automacoes em producao

### Persistencia e Seguranca (Banco de Dados)
- PostgreSQL com isolamento Database-per-Service: Identity, Warehouse e Stores têm bancos próprios
- Autenticação local por JWT nativo e RBAC/multi-tenant aplicado pelos serviços
- Funcoes PL/pgSQL atomicas para operacoes criticas de saldo
- Object Storage nativo por volume compartilhado (`/app/storage`) e MinIO (compatível com S3)
- Autenticação nativa por JWT no MS Identity e controle de acesso RBAC distribuído

---

## 3. Modelo de Seguranca e Conformidade

A seguranca da informacao e o pilar central da arquitetura do Valida Facil:

- Isolamento Multi-Tenant: as rotas validam empresa e perfil; o escopo dos dados é aplicado pelo microsserviço proprietário de cada banco.
- Controle de Acesso Baseado em Funcoes (RBAC):
  - Administrador: Gestao cadastral da empresa, convite de membros, alteracao de papeis de colaboradores, exclusao de registros e emissao de relatorios.
  - Operador: Consulta ao catalogo de produtos, registro de entradas e saidas de itens e acompanhamento de alertas de validade.
- Proteção contra escalada de privilégios: operações de perfil e permissões são autorizadas pelo MS Identity; os clientes não recebem credenciais diretas dos bancos.
- Historico Imutavel: A tabela de movimentacoes de estoque bloqueia operacoes de edicao e delecao por clientes HTTP comuns.
- Cabecalhos de Seguranca HTTP: Middleware ativo aplicando Strict-Transport-Security (HSTS), X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy e politicas restritivas de permissoes.
- Sanitizacao de Respostas: O backend trata globalmente qualquer excecao nao mapeada, prevenindo o vazamento de stack traces, estruturas de schemas ou mensagens de drivers internos.

---

## 4. Estrutura do Repositorio

```text
.
|-- api-gateway/              # Ponto de entrada unico (FastAPI + proxy HTTP/ASGI)
|   |-- gateway/              # Roteamento por prefixo, headers e CORS
|   |-- Dockerfile            # Imagem leve e isolada do Gateway
|   `-- requirements.txt
|
|-- ms-identity/              # Microsservico de Identidade, Empresas e Membros
|   |-- ms_identity/
|   |-- Dockerfile
|   `-- requirements.txt
|
|-- ms-warehouse/             # Microsservico do Armazem Central, FEFO, Alertas e Relatorios
|   |-- ms_warehouse/
|   |-- Dockerfile
|   `-- requirements.txt
|
|-- ms-stores/                # Microsservico de Lojas / Filiais e Requisicoes (SAGA)
|   |-- ms_stores/
|   |-- Dockerfile
|   `-- requirements.txt
|
|-- shared/                   # Pacote compartilhado (config, JWT, Storage, HTTP client, broker)
|-- database/                  # Schemas e migrações PostgreSQL independentes por serviço
|-- frontend/                 # Aplicacao React + Vite (SPA + Nginx + Vitest)
|-- tests/                    # Suite unificada de testes (unitarios, integracao e arquitetura)
|-- docker-compose.yml        # Topologia conteinerizada (RabbitMQ + Gateway + 3 MS + Frontend)
|-- pytest.ini                # Configuracao de pythonpath multi-servico para testes
|-- .env.example              # Modelo sanitizado de variaveis de ambiente na raiz
|-- DOCUMENTACAO.md           # Manual tecnico aprofundado do sistema
|-- DOCUMENTACAO_MICROSSERVICOS.md # Guia da arquitetura distribuida e protocolos
|-- README.md                 # Guia executivo e documentacao inicial
`-- vercel.json               # Configuracao de roteamento Vercel e Vercel Cron
```

---

## 5. Instalacao e Execucao Local

### Pre-requisitos
- Node.js versao 18 ou superior
- Docker e Docker Compose

### 5.1. Configuracao dos Bancos de Dados Locais
O modo local usa três instâncias PostgreSQL independentes: `db-identity`, `db-warehouse` e `db-stores`.
O Docker Compose inicializa cada banco com seu próprio script em `database/{identity,warehouse,stores}/init.sql`.
O banco da aplicação é sempre PostgreSQL separado por serviço (`db-identity`, `db-warehouse` e `db-stores`), com total autonomia de esquemas e persistência.

Em volumes Identity criados antes da migração de tokens de convite e redefinição de senha, aplique-a uma vez com o banco em execução:

```bash
docker compose exec -T db-identity psql -U valida_identity -d valida_identity < database/identity/migrations/001_auth_action_tokens.sql
```

O comando usa o usuário padrão do Compose; se `DB_IDENTITY_USER` foi personalizado, substitua `valida_identity` pelo usuário configurado. Bancos recém-criados já recebem essa tabela via `init.sql`.

### 5.2. Configuracao do Backend (Microsservicos)
Na raiz do repositorio, crie o ambiente virtual e instale as dependencias de desenvolvimento/testes (ou as dependencias individuais de cada microsservico):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
```

Copie `.env.example` para `.env` na raiz do repositorio. O arquivo já contém as URLs locais distintas; personalize somente os segredos e integrações que desejar:

```env
IDENTITY_DATABASE_URL=postgresql://valida_identity:local_identity_password@localhost:5435/valida_identity
WAREHOUSE_DATABASE_URL=postgresql://valida_warehouse:local_warehouse_password@localhost:5433/valida_warehouse
STORES_DATABASE_URL=postgresql://valida_stores:local_stores_password@localhost:5434/valida_stores
JWT_SECRET=troque-por-um-segredo-jwt-forte
FRONTEND_URL=http://localhost:5173
ENVIRONMENT=development
CRON_SECRET=segredo-para-execucao-de-cron

# Opcional: Configuracoes de SMTP para envio real de e-mails
SMTP_HOST=smtp.provedor.com
SMTP_PORT=587
SMTP_USER=usuario@provedor.com
SMTP_PASSWORD=senha-do-provedor
SMTP_FROM_EMAIL=no-reply@validafacil.com.br
SMTP_FROM_NAME=Valida Facil
```

Inicie a topologia local completa. Cada serviço recebe apenas a URL do seu banco:

```bash
docker compose up --build
```

O Gateway ficará disponível em `http://localhost:8000`; o frontend em `http://localhost:3000`. As portas PostgreSQL locais são `5435` (Identity), `5433` (Warehouse) e `5434` (Stores). Para executar os serviços Python diretamente no host, use as três URLs `*_DATABASE_URL` e inicie cada microsserviço como processo separado.

### 5.3. Configuracao do Frontend
Em outro terminal, acesse a pasta do frontend e instale as dependencias:

```bash
cd frontend
npm install
```

Crie o arquivo `.env` na pasta `frontend/`:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Execute a aplicacao:

```bash
npm run dev
```

Acesse o endereco `http://localhost:5173` em seu navegador.

---

## 6. Execucao de Testes e Validacao de Codigo

### Testes dos Microsservicos e Gateway
Para rodar a suite completa de testes unitarios, de integracao e de arquitetura a partir da raiz do projeto:

```bash
pytest -v tests/
```

### Testes do Frontend
Para executar os testes automatizados da interface e servicos do frontend:

```bash
cd frontend
npm test -- --run
```

### Validacao de Compilacao de Producao
Para verificar a integridade dos pacotes e compilar os assets estaticos:

```bash
cd frontend
npm run build
```

---

## 7. Informacoes Complementares

Para informacoes aprofundadas sobre o dicionario de dados, especificacao de contratos REST, politicas de seguranca detalhadas e arquitetura de componentes, consulte o arquivo [DOCUMENTACAO.md](./DOCUMENTACAO.md).
