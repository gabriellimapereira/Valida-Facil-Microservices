# Documentacao Tecnica do Sistema Valida Facil

Este documento consolida a especificacao tecnica completa, a arquitetura de software, o dicionario de dados, o catalogo de contratos de API e os procedimentos operacionais do sistema Valida Facil.

---

## 1. Visao Arquitetural e Principios de Engenharia

O Valida Facil foi projetado com foco em desacoplamento de responsabilidades, alta disponibilidade, integridade transacional e estrita seguranca multi-tenant.

### 1.1. Divisao de Camadas
A aplicacao estrutura-se em tres camadas fundamentais:

1. Camada de Apresentacao (Frontend SPA):
   - Desenvolvida em React 18 com Vite e empacotada como Single Page Application.
   - Comunica-se de forma direta com o banco de dados via Supabase SDK para consultas de leitura e gerenciamento de catalogo (sob controle do Row Level Security).
   - Delega operacoes transacionais sensiveis, automacoes de disparo e geracao binaria de arquivos para a API do Backend.

2. Camada de Orquestracao e Negocio (Backend API):
   - Desenvolvida em FastAPI (Python 3.11), operando de forma assincrona (ASGI).
   - Centraliza o onboarding corporativo, o envio de convites administrativos, o processamento de regras criticas de estoque e a renderizacao binaria de relatorios (PDF e XLSX).
   - Nao armazena senhas nem manipula sessoes locais de forma stateful: valida o JWT fornecido pelo cliente e repassa o contexto ao Postgres.

3. Camada de Persistencia e Autenticacao (PostgreSQL / Supabase):
   - Instancia relacional PostgreSQL com extensoes nativas (`uuid-ossp`).
   - Autenticacao via Supabase GoTrue com emissao de JSON Web Tokens (JWT) assinados.
   - Storage de objetos privado com particionamento por pasta de empresa e geracao de URLs assinadas temporarias.

---

## 2. Modelagem do Banco de Dados e Schemas

O banco de dados emprega chaves primarias UUID v4, integridade referencial com acoes em cascata ou anulacao controlada, e constraints de validacao de limites numericos.

### 2.1. Tabelas do Sistema

#### Tabela: `categories`
Armazena a taxonomia de classificacao dos produtos e define a aplicabilidade de controle de validade.
- `id` (TEXT, PK): Identificador slug da categoria (ex: 'perecivel', 'eletronicos', 'moda', 'livros', 'outros').
- `label` (TEXT, NOT NULL): Descricao amigavel da categoria para exibicao na interface.
- `has_expiry` (BOOLEAN, NOT NULL, DEFAULT false): Sinalizador que indica se itens vinculados a categoria devem obrigatoriamente exigir data de vencimento.

#### Tabela: `companies`
Entidade tenant que agrupa produtos, colaboradores e movimentacoes.
- `id` (UUID, PK, DEFAULT `uuid_generate_v4()`): Identificador global unico da empresa.
- `name` (TEXT, NOT NULL): Razao social ou nome fantasia da empresa.
- `segment` (TEXT): Segmento de atuacao economica.
- `email` (TEXT): E-mail corporativo institucional.
- `notification_email` (TEXT, NOT NULL): Destinatario prioritario para recebimento de alertas operacionais de estoque e validades.
- `phone` (TEXT, NOT NULL): Telefone de contato institucional com DDD.
- `cnpj` (TEXT, NOT NULL, UNIQUE): Cadastro Nacional da Pessoa Juridica com validacao de digitos verificadores.
- `address` (TEXT): Endereco fisico do estabelecimento.
- `initials` (TEXT, NOT NULL): Sigla de 1 a 3 caracteres utilizada em identificadores visuais.
- `logo_url` (TEXT): Caminho publico ou assinado da imagem de logotipo da empresa.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`): Registro de data e hora da criacao.

#### Tabela: `profiles`
Vincula a conta de autenticacao do Supabase Auth (`auth.users`) a uma empresa e a um papel de acesso.
- `id` (UUID, PK, REFERENCES `auth.users(id)` ON DELETE CASCADE): ID do usuario correspondente no modulo GoTrue.
- `company_id` (UUID, REFERENCES `companies(id)` ON DELETE SET NULL): Empresa a qual o colaborador pertence. Valor nulo indica usuario em processo de onboarding.
- `full_name` (TEXT): Nome completo do colaborador.
- `email` (TEXT): Endereco de e-mail do usuario.
- `role` (TEXT, NOT NULL, DEFAULT 'operador'): Nivel de permissao ('admin' ou 'operador').
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`): Data de inclusao do usuario.
- Restricao Unica Parcial: `idx_one_admin_per_company` garante a existencia de no maximo um usuario com papel 'admin' por empresa.

#### Tabela: `products`
Catalogo de mercadorias pertencentes a uma determinada empresa.
- `id` (UUID, PK, DEFAULT `uuid_generate_v4()`): Identificador do produto.
- `company_id` (UUID, NOT NULL, REFERENCES `companies(id)` ON DELETE CASCADE): Vinculo tenant do item.
- `code` (TEXT, NOT NULL): Codigo interno de identificacao (SKU).
- `name` (TEXT, NOT NULL): Descricao completa do produto.
- `category` (TEXT, NOT NULL, REFERENCES `categories(id)`): Chave estrangeira para a categoria correspondente.
- `price` (NUMERIC(12,2), NOT NULL, DEFAULT 0): Preco unitario da mercadoria (Check: entre 0 e 1.000.000).
- `quantity` (INTEGER, NOT NULL, DEFAULT 0): Saldo fisico disponivel em estoque (Check: entre 0 e 1.000.000).
- `min_stock` (INTEGER, NOT NULL, DEFAULT 0): Quantidade minima estipulada para seguranca operacional (Check: entre 0 e 1.000.000).
- `expiry` (DATE): Data limite de consumo ou validade da mercadoria.
- `supplier` (TEXT): Nome ou razao social do fornecedor parceiro.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`): Data de inclusao.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`): Data da ultima modificacao (atualizada automaticamente por trigger).
- Restricao Unica: `(company_id, code)` impede codigos duplicados dentro da mesma organizacao.

#### Tabela: `stock_movements`
Livro-razao de auditoria imutavel para registro de variacoes fisicas de estoque.
- `id` (UUID, PK, DEFAULT `uuid_generate_v4()`): Identificador do lancamento.
- `company_id` (UUID, NOT NULL, REFERENCES `companies(id)` ON DELETE CASCADE): Empresa de origem.
- `product_id` (UUID, NOT NULL, REFERENCES `products(id)` ON DELETE CASCADE): Mercadoria movimentada.
- `changed_by` (UUID, REFERENCES `profiles(id)` ON DELETE SET NULL): Operador responsavel pela acao.
- `movement_type` (TEXT, NOT NULL): Classificacao da operacao ('entrada' ou 'saida').
- `quantity_delta` (INTEGER, NOT NULL): Variacao quantitativa aplicada (Check: entre -1.000.000 e 1.000.000, diferente de zero).
- `previous_quantity` (INTEGER): Saldo existente imediatamente anterior a realizacao do lancamento.
- `new_quantity` (INTEGER): Saldo resultante gravado no estoque do produto.
- `note` (TEXT): Justificativa textual ou referencia documental (nota fiscal, pedido, motivo).
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`): Timestamp de efetivacao.

---

### 2.2. Triggers e Funcoes Stored Procedures

#### Procedimento: `apply_stock_movement`
Funcao PL/pgSQL executada com privilegios `SECURITY INVOKER` que consolida a atualizacao do saldo de um produto e a insercao da linha de auditoria em transacao atomica:
1. Valida o tipo de movimentacao ('entrada' ou 'saida').
2. Obtem o registro do produto conferindo o `company_id` contra o RLS.
3. Calcula o saldo resultante (`v_new_qty = v_current_qty + p_quantity_delta`).
4. Rejeita qualquer operacao que resulte em saldo negativo (`v_new_qty < 0`) ou exceda o teto de 1.000.000 unidades.
5. Grava a atualizacao em `products` e insere o registro detalhado em `stock_movements`.
6. Avalia se o estoque cruzou o limiar de seguranca (`v_current_qty > v_min_stock AND v_new_qty <= v_min_stock`).
7. Retorna payload JSON com os dados consolidados e a indicacao de necessidade de notificacao por e-mail.

#### Procedimento: `handle_new_user`
Acionado pela trigger `on_auth_user_created` da tabela `auth.users`. Cria automaticamente a linha correspondente em `public.profiles` com o papel padrao de 'operador', garantindo integridade de perfil para todo usuario cadastrado.

#### Procedimento: `get_auth_user_company_id`
Funcao `SECURITY DEFINER` estavel com `search_path = public` utilizada internamente pelas politicas RLS para retornar o `company_id` do usuario logado (`auth.uid()`) sem incorrer em recursao infinita de politicas.

---

### 2.3. Matriz de Politicas Row Level Security (RLS)

| Tabela | Operacao | Politica / Regra | Criterio de Seguranca |
| :--- | :--- | :--- | :--- |
| `companies` | SELECT | Visualizar propria empresa | `id = get_auth_user_company_id()` |
| `companies` | UPDATE | Atualizar propria empresa | `id = get_auth_user_company_id()` E perfil deve ser 'admin' |
| `companies` | DELETE | Bloqueio de exclusao | Proibido via cliente HTTP (`using (false)`) |
| `profiles` | SELECT | Visualizar membros | `id = auth.uid()` OU pertencente a mesma empresa |
| `profiles` | UPDATE | Atualizar perfil | `id = auth.uid()` com check de que `role` e `company_id` permanecem inalterados |
| `profiles` | DELETE | Bloqueio de exclusao | Proibido via cliente HTTP (`using (false)`) |
| `products` | SELECT | Visualizar catalogo | `company_id = get_auth_user_company_id()` |
| `products` | ALL | Gerenciar produtos | `company_id = get_auth_user_company_id()` |
| `stock_movements`| SELECT | Visualizar movimentacoes | `company_id = get_auth_user_company_id()` |
| `stock_movements`| INSERT | Registrar lancamento | `company_id = get_auth_user_company_id()` |
| `stock_movements`| UPDATE | Bloqueio de edicao | Imutavel (`using (false)`) |
| `stock_movements`| DELETE | Bloqueio de remocao | Imutavel (`using (false)`) |

---

## 3. Catalogo de Endpoints da API REST

A API do backend esta mapeada sob o prefixo `/api` (ou na raiz do servico). Toda requisicao autenticada exige o envio do cabecalho `Authorization: Bearer <jwt>`.

### 3.1. Modulo de Empresas (`/companies`)

#### `POST /companies`
Cadastra uma nova empresa e vincula o usuario solicitante como administrador principal.
- Permissao: Usuario autenticado sem empresa vinculada.
- Payload:
  ```json
  {
    "name": "Nome da Empresa",
    "segment": "Supermercado",
    "notification_email": "estoque@empresa.com.br",
    "phone": "(11) 98765-4321",
    "cnpj": "12.345.678/0001-90",
    "address": "Av. Principal, 100",
    "initials": "EMP"
  }
  ```
- Respostas:
  - `201 Created`: Retorna o objeto da empresa criada.
  - `400 Bad Request`: Usuario ja vinculado a uma empresa.
  - `409 Conflict`: CNPJ ja existente na base de dados.
  - `422 Unprocessable Entity`: Falha na validacao de formato ou digitos verificadores do CNPJ.

#### `GET /companies/me`
Retorna os dados cadastrais da empresa do colaborador autenticado.
- Permissao: Qualquer usuario com empresa vinculada.
- Resposta: `200 OK` contendo dados da empresa ou `404 Not Found`.

#### `GET /companies/members`
Lista todos os colaboradores vinculados a empresa do usuario requisitante.
- Permissao: Qualquer usuario com empresa vinculada.
- Resposta: `200 OK` contendo lista de membros com `id`, `full_name`, `email`, `role` e `created_at`.

#### `POST /companies/invite`
Dispara convite por e-mail para um novo colaborador integrar a equipe da empresa.
- Permissao: Restrito a usuarios com papel `admin`.
- Payload:
  ```json
  {
    "email": "colaborador@empresa.com.br",
    "full_name": "Nome do Colaborador",
    "role": "operador"
  }
  ```
- Respostas:
  - `201 Created`: Retorna status do convite e ID do usuario criado/atualizado.
  - `409 Conflict`: Colaborador ja cadastrado nesta ou em outra organizacao.

#### `PATCH /companies/members/{member_id}`
Atualiza o papel de acesso de um colaborador da equipe.
- Permissao: Restrito a usuarios com papel `admin`.
- Regra de Negocio: O administrador nao pode revogar seu proprio papel para 'operador'.
- Payload: `{"role": "admin"}` ou `{"role": "operador"}`.
- Respostas: `200 OK`, `400 Bad Request` ou `404 Not Found`.

#### `DELETE /companies/members/{member_id}`
Remove um colaborador da equipe da empresa.
- Permissao: Restrito a usuarios com papel `admin`.
- Regra de Negocio: O administrador nao pode excluir a si proprio.
- Respostas: `204 No Content` ou `404 Not Found`.

---

### 3.2. Modulo de Movimentacoes de Estoque (`/movements`)

#### `POST /movements`
Executa o lancamento transacional de entrada ou saida de mercadoria no estoque.
- Permissao: Qualquer usuario com empresa vinculada.
- Payload:
  ```json
  {
    "product_id": "uuid-do-produto",
    "movement_type": "entrada",
    "quantity_delta": 50,
    "note": "Nota Fiscal 98765"
  }
  ```
- Respostas:
  - `201 Created`:
    ```json
    {
      "company_id": "uuid-da-empresa",
      "product_id": "uuid-do-produto",
      "product_name": "Arroz Parboilizado 5kg",
      "previous_quantity": 100,
      "new_quantity": 150,
      "min_stock": 20,
      "crossed_low_stock": false,
      "notification_email": "estoque@empresa.com.br"
    }
    ```
  - `400 Bad Request`: Quantidade insuficiente para retirada ou variacao zerada.

#### `GET /movements/low-stock`
Retorna a listagem de mercadorias que se encontram com saldo em estoque igual ou inferior ao estoque minimo estipulado.
- Permissao: Qualquer usuario com empresa vinculada.
- Resposta: `200 OK` com colecao de itens criticos.

---

### 3.3. Modulo de Alertas e Validades (`/alerts`)

#### `POST /alerts/check-expiry`
Aciona sob demanda a varredura de produtos proximos do vencimento da empresa do solicitante.
- Permissao: Restrito a usuarios com papel `admin`.
- Parametros de Query: `window_days` (inteiro de 1 a 365, padrao 15).
- Resposta: `200 OK` com quantidade de produtos identificados e confirmacao de envio do e-mail.

#### `GET` ou `POST /alerts/cron-expiry-check`
Endpoint agendado utilizado por rotinas automatizadas (Vercel Cron ou jobs de infraestrutura).
- Autenticacao: Exige cabecalho `Authorization: Bearer <CRON_SECRET>` ou parametro `cron_key`.
- Regra de Seguranca: Validacao em tempo constante via `secrets.compare_digest`. Em ambiente de producao, se o segredo nao estiver parametrizado, o endpoint responde com `403 Forbidden`.
- Processamento: Itera sobre todas as empresas ativas, computa itens vencendo dentro da janela configurada e despacha os e-mails consolidados.
- Resposta: `200 OK` com total de empresas processadas e sumario executivo.

---

### 3.4. Modulo de Relatorios Analiticos (`/reports`)

#### `POST /reports/generate`
Compila os dados do estoque ou movimentacoes e gera o arquivo correspondente em formato PDF ou planilha XLSX, salvando-o no Supabase Storage e retornando link de download temporario.
- Permissao: Qualquer usuario com empresa vinculada.
- Payload:
  ```json
  {
    "report_type": "estoque_atual",
    "format": "pdf",
    "date_from": "2026-01-01",
    "date_to": "2026-03-31",
    "expiry_window_days": 30
  }
  ```
- Tipos de Relatorios Disponiveis:
  - `estoque_atual`: Fotografia completa do inventario com valorizacao financeira por item e totalizacao de capital parado.
  - `movimentacoes`: Livro de entradas e saidas no periodo com saldo liquido e discriminacao de responsavel e notas.
  - `produtos_a_vencer`: Analise preventiva com agrupamento de risco (critico ate 3 dias, atencao ate 7 dias).
  - `giro_estoque`: Curva de rotatividade baseada no volume de saidas e participacao percentual por mercadoria.
- Resposta:
  ```json
  {
    "url": "https://seu-projeto.supabase.co/storage/v1/object/sign/reports/...?token=...",
    "filename": "estoque_atual-20260914-103000.pdf",
    "expires_in_seconds": 600
  }
  ```

---

### 3.5. Modulo de Healthcheck (`/health`)

#### `GET /health`
Informa o estado operacional basico do backend para balanceadores de carga e orquestradores de contêineres.
- Autenticacao: Publico.
- Resposta:
  ```json
  {
    "status": "ok",
    "has_supabase_url": true,
    "has_anon_key": true,
    "has_service_key": true,
    "environment": "production"
  }
  ```
- Seguranca: Nao expoem nenhum trecho ou metadado de chaves criptograficas.

---

## 4. Arquitetura do Frontend e Fluxos de Interface

O frontend foi desenvolvido com base no principio de interfaces ageis, de alta fidelidade visual e operacao tátil.

### 4.1. Gerenciamento de Estado
- `AuthContext`: Mantem a sessao ativa do usuario, carrega o perfil complementar (`profiles`) e define flags globais de controle (`isAuthenticated`, `needsOnboarding`, `role`, `companyId`).
- `ProductContext`: Responsavel pela colecao de produtos em memoria, disparando atualizacoes atomicas de quantidade via `syncProductQuantity` para evitar recarregamentos desnecessarios da lista.
- `ToastContext`: Sistema centralizado de notificacoes visuais flutuantes com auto-dispensacao e suporte a variantes de sucesso, erro e alerta.

### 4.2. Guardas de Rota
- `PrivateRoute`: Intercepta rotas protegidas, renderizando um loader em tela cheia durante a checagem de sessao do Supabase e redirecionando usuarios nao autenticados para `/login`.
- `RequireCompany`: Assegura que usuarios sem empresa vinculada sejam imediatamente encaminhados para a tela de onboarding (`/onboarding`), impedindo o acesso ao painel principal antes do preenchimento cadastral.

### 4.3. Telas da Aplicacao
1. `LoginPage`: Interface de acesso com suporte a alternancia entre login por credenciais e recuperacao de senha por e-mail.
2. `OnboardingPage`: Cadastro simplificado e intuitivo da empresa (nome, segmento, CNPJ com mascara, telefone e e-mail de alertas).
3. `DashboardPage`: Painel de controle analitico exibindo indicadores chave de desempenho (total de produtos, estoque baixo, itens proximos do vencimento e valor financeiro total imobilizado).
4. `StockPage`: Gestao completa de estoque com ordenacao por colunas, filtros combinados de busca, paginacao e abertura de modais de operacao.
5. `ProfilePage`: Dados da empresa, visualizacao e gestao da equipe com painel exclusivo para o administrador convidar colaboradores e alternar cargos.
6. `SetPasswordPage`: Tela de definicao de credencial para novos membros que acessaram via link de convite.

---

## 5. Procedimentos de Deploy e Configuracao de Infraestrutura

### 5.1. Vercel (Producao Monorepo)
O arquivo `vercel.json` na raiz do projeto orquestra a execucao conjunta do frontend SPA e do backend serverless:

```json
{
  "services": {
    "frontend": {
      "root": "frontend",
      "framework": "vite",
      "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
    },
    "backend": {
      "root": "backend",
      "entrypoint": "app/main.py"
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "backend" } },
    { "source": "/api", "destination": { "service": "backend" } },
    { "source": "/(.*)", "destination": { "service": "frontend" } }
  ],
  "crons": [
    {
      "path": "/api/alerts/cron-expiry-check",
      "schedule": "0 10 * * *"
    }
  ]
}
```

### 5.2. Dockerfile do Backend
Para ambientes conteinerizados (AWS ECS, Google Cloud Run, Kubernetes ou servidores dedicados):

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 \
    libffi-dev shared-mime-info fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 6. Sumario de Seguranca Operacional

1. Chaves de Acesso:
   - `VITE_SUPABASE_ANON_KEY`: Destinada ao uso publico no navegador. Controlada 100% pelas politicas RLS do banco.
   - `SUPABASE_SERVICE_ROLE_KEY`: Privativa do backend. Utilizada estritamente em operacoes sem contexto de sessao (convites administrativos, criacao de tenant e jobs do cron).
2. Sanitizacao de Entrada:
   - Todo payload recebido pela API e validado e tipado pelo Pydantic, bloqueando campos excedentes ou tipos incorretos.
3. Prevensao de Injecao SQL:
   - O sistema utiliza o ORM/SDK nativo do PostgREST e procedimentos preparados no Postgres. Nao existem interpolacoes ou concatenacoes manuais de strings SQL no codigo.
4. Isolamento Transacional:
   - Nenhuma atualizacao de quantidade de estoque e executada de forma solta; todo saldo e atualizado dentro da procedure `apply_stock_movement`.
