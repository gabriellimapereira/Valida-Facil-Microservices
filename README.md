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

A solucao adota uma arquitetura desacoplada, combinando servicos serverless para APIs de negocio e recursos de Backend as a Service (BaaS) para persistencia e autenticacao.

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
- PostgreSQL gerenciado via Supabase
- Row Level Security (RLS) aplicado a 100% das tabelas para garantia de isolamento entre empresas
- Funcoes PL/pgSQL atomicas para operacoes criticas de saldo
- Supabase Auth (GoTrue) com emissao de tokens JWT
- Supabase Storage com buckets privados e distribuicao via URLs assinadas de curta duracao

---

## 3. Modelo de Seguranca e Conformidade

A seguranca da informacao e o pilar central da arquitetura do Valida Facil:

- Isolamento Multi-Tenant: Cada requisicao ao banco de dados executa sob o contexto de seguranca do usuario logado (RLS). Nao ha possibilidade de vazamento de dados entre empresas distintas, mesmo sob falha na camada de aplicacao.
- Controle de Acesso Baseado em Funcoes (RBAC):
  - Administrador: Gestao cadastral da empresa, convite de membros, alteracao de papeis de colaboradores, exclusao de registros e emissao de relatorios.
  - Operador: Consulta ao catalogo de produtos, registro de entradas e saidas de itens e acompanhamento de alertas de validade.
- Protecao contra Escalada de Privilegios: Triggers e politicas de banco impedem que usuarios alterem seu proprio nivel de acesso ou sua vinculacao empresarial via cliente.
- Historico Imutavel: A tabela de movimentacoes de estoque bloqueia operacoes de edicao e delecao por clientes HTTP comuns.
- Cabecalhos de Seguranca HTTP: Middleware ativo aplicando Strict-Transport-Security (HSTS), X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy e politicas restritivas de permissoes.
- Sanitizacao de Respostas: O backend trata globalmente qualquer excecao nao mapeada, prevenindo o vazamento de stack traces, estruturas de schemas ou mensagens de drivers internos.

---

## 4. Estrutura do Repositorio

```text
.
|-- backend/
|   |-- app/
|   |   |-- core/             # Configuracoes de seguranca, scheduler e clients
|   |   |-- routers/          # Endpoints da API (empresas, estoque, alertas, relatorios)
|   |   |-- schemas/          # Modelos Pydantic de entrada e saida
|   |   |-- services/         # Regras de negocio, e-mail, PDF e persistencia
|   |   |-- templates/        # Templates Jinja2 para e-mails transacionais e relatorios
|   |   `-- utils/            # Formatadores e helpers auxiliares
|   |-- supabase/             # Scripts SQL de funcoes, schemas e politicas RLS
|   |-- tests/                # Testes automatizados (unitarios e de integracao)
|   |-- Dockerfile            # Imagem de producao para execucao conteinerizada
|   `-- requirements.txt      # Dependencias do ecossistema Python
|
|-- frontend/
|   |-- public/               # Assets estaticos, manifestos e icones oficiais
|   |-- src/
|   |   |-- components/       # Componentes de interface (layout, produtos, perfil, UI)
|   |   |-- context/          # Provedores de estado global (Auth, Product, Toast)
|   |   |-- pages/            # Telas da aplicacao (Dashboard, Estoque, Perfil, Login, etc.)
|   |   |-- routes/           # Rotas protegidas e guardas de navegacao
|   |   |-- services/         # Integracoes com backend e Supabase Client
|   |   `-- utils/            # Formatadores monetarios, de datas e validacoes
|   `-- supabase/             # Schemas e migracoes do banco de dados
|
|-- diagramas/                # Diagramas arquiteturais e esquemas conceituais (ignorado no Git)
|-- DOCUMENTACAO.md           # Manual tecnico aprofundado do sistema
|-- README.md                 # Guia executivo e documentacao inicial
`-- vercel.json               # Configuracao de roteamento monorepo e Vercel Cron
```

---

## 5. Instalacao e Execucao Local

### Pre-requisitos
- Node.js versao 18 ou superior
- Python versao 3.11 ou superior
- Projeto ativo no Supabase (com schema executado)

### 5.1. Configuracao do Banco de Dados
Acesse o SQL Editor no painel do Supabase e execute o script consolidado:
`frontend/supabase/schema.sql`

Em seguida, execute as configuracoes de armazenamento:
`backend/supabase/storage.sql`

### 5.2. Configuracao do Backend
Navegue ate a pasta do backend, crie o ambiente virtual e instale os pacotes necessarios:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Crie o arquivo `.env` na pasta `backend/` com as seguintes variaveis:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anonima
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service-role
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

Inicie o servidor de desenvolvimento:

```bash
uvicorn app.main:app --reload --port 8000
```

### 5.3. Configuracao do Frontend
Em outro terminal, acesse a pasta do frontend e instale as dependencias:

```bash
cd frontend
npm install
```

Crie o arquivo `.env` na pasta `frontend/`:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
VITE_API_BASE_URL=http://localhost:8000
```

Execute a aplicacao:

```bash
npm run dev
```

Acesse o endereco `http://localhost:5173` em seu navegador.

---

## 6. Execucao de Testes e Validacao de Codigo

### Testes do Backend
Para rodar a suite completa de testes unitarios e de integracao do backend:

```bash
cd backend
./.venv/bin/pytest
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
