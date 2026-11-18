# Documentacao Tecnica do Sistema Valida Facil

Este documento consolida a especificacao tecnica completa, a arquitetura de software, o dicionario de dados, o catalogo de contratos de API e os procedimentos operacionais do sistema Valida Facil.

---

## 1. Visao Arquitetural e Principios de Engenharia

O Valida Facil foi projetado com foco em desacoplamento de responsabilidades, alta disponibilidade, integridade transacional e estrita seguranca multi-tenant.

### 1.1. Divisao de Camadas
A aplicacao estrutura-se em tres camadas fundamentais:

1. Camada de Apresentacao (Frontend SPA):
   - Desenvolvida em React 18 com Vite e empacotada como Single Page Application.
   - Comunica-se com a API Gateway; não acessa diretamente os bancos dos microsserviços.
   - Delega operacoes transacionais sensiveis, automacoes de disparo e geracao binaria de arquivos para a API do Backend.

2. Camada de Gateway e Microsserviços (Backend Distribuído):
   - Desenvolvida em FastAPI (Python 3.12), operando de forma assíncrona (ASGI) com arquiteturas de **API Gateway (:8000)** e três microsserviços de domínio independentes: **MS Identity (:8001)**, **MS Warehouse (:8002)** e **MS Stores (:8003)** (consulte [DOCUMENTACAO_MICROSSERVICOS.md](./DOCUMENTACAO_MICROSSERVICOS.md)).
   - Executa onboarding corporativo, envio de convites com vínculo de filial, controle de validades FEFO, movimentações atômicas no CD/Filiais com orquestração SAGA, mensageria RabbitMQ/Outbox e geração binária de relatórios (PDF e XLSX).
   - MS Identity mantém usuários, perfis e empresas; MS Warehouse e MS Stores mantêm seus próprios dados em bancos separados.
   - A autenticação local emite JWT nativo; os serviços comunicam-se via rotas `/internal/*` autenticadas com `X-Internal-Service-Token`.

3. Camada de Persistencia e Autenticacao (PostgreSQL):
   - Três instâncias PostgreSQL independentes (`identity`, `warehouse`, `stores`) com extensoes nativas (`uuid-ossp`).
   - Cada microsserviço recebe somente a URL do seu banco. Referências entre domínios são resolvidas via HTTP/eventos, sem FKs entre bancos.
   - Storage de objetos local por volume compartilhado e MinIO (compatível com S3).

---

## 2. Modelagem do Banco de Dados e Schemas

> No modo Database-per-Service, consulte os scripts `database/identity/init.sql`, `database/warehouse/init.sql` e `database/stores/init.sql`; cada banco de dados possui persistência dedicada e esquemas isolados.

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
Vincula uma conta de autenticacao nativa do MS Identity a uma empresa e a um papel de acesso.
- `id` (UUID, PK, REFERENCES `users(id)` ON DELETE CASCADE): ID do usuario correspondente no banco Identity.
- `company_id` (UUID, REFERENCES `companies(id)` ON DELETE SET NULL): Empresa a qual o colaborador pertence. Valor nulo indica usuario em processo de onboarding.
- `store_id` (UUID, REFERENCES `stores(id)` ON DELETE SET NULL): Filial a qual o colaborador esta alocado. Nulo se for Administrador do Armazem Central / Geral.
- `full_name` (TEXT): Nome completo do colaborador.
- `email` (TEXT): Endereco de e-mail do usuario.
- `role` (TEXT, NOT NULL, DEFAULT 'operador'): Nivel de permissao ('admin' ou 'operador').
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`): Data de inclusao do usuario.
- Restricao Unica Parcial: `idx_one_admin_per_company` garante a existencia de no maximo um usuario com papel 'admin' por empresa.

#### Tabela: `stores`
Unidades fisicas ou filiais vinculadas a empresa tenant.
- `id` (UUID, PK, DEFAULT `uuid_generate_v4()`): Identificador da loja.
- `company_id` (UUID, NOT NULL, REFERENCES `companies(id)` ON DELETE CASCADE): Vinculo tenant da organizacao.
- `code` (TEXT, NOT NULL): Codigo ou sigla identificadora (ex: 'CENTRO-01').
- `name` (TEXT, NOT NULL): Nome fantasia da filial (ex: 'Filial Centro').
- `address` (TEXT): Endereco da filial.
- `phone` (TEXT): Telefone de contato.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`): Data de cadastro.
- Restricao Unica: `(company_id, code)`.

#### Tabela: `store_inventory`
Saldo de estoque fisico local de cada filial para cada item do catalogo mestre.
- `id` (UUID, PK, DEFAULT `uuid_generate_v4()`): Identificador do saldo local.
- `store_id` (UUID, NOT NULL, REFERENCES `stores(id)` ON DELETE CASCADE): Filial proprietaria do saldo.
- `product_id` (UUID, NOT NULL, REFERENCES `products(id)` ON DELETE CASCADE): Item do catalogo.
- `quantity` (INTEGER, NOT NULL, DEFAULT 0): Saldo fisico disponivel na gondola/loja.
- `min_stock` (INTEGER, NOT NULL, DEFAULT 0): Ponto de pedido minimo estipulado para a loja.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`): Timestamp de atualizacao.
- Restricao Unica: `(store_id, product_id)`.

#### Tabela: `requisitions`
Cabecalho das requisicoes de reposicao emitidas pelas filiais ao Armazem Central.
- `id` (UUID, PK, DEFAULT `uuid_generate_v4()`): Identificador da requisicao.
- `company_id` (UUID, NOT NULL, REFERENCES `companies(id)` ON DELETE CASCADE): Empresa tenant.
- `store_id` (UUID, NOT NULL, REFERENCES `stores(id)` ON DELETE CASCADE): Filial solicitante.
- `requested_by` (UUID, REFERENCES `profiles(id)` ON DELETE SET NULL): Operador responsavel pelo pedido.
- `status` (TEXT, NOT NULL, DEFAULT 'pendente'): Status do ciclo ('pendente', 'aprovada', 'despachada', 'recebida', 'cancelada').
- `notes` (TEXT): Observacoes e especificacoes do pedido.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`): Data de emissao.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`): Data da ultima alteracao de status.

#### Tabela: `requisition_items`
Itens e quantidades discriminadas na requisicao de reposicao.
- `id` (UUID, PK, DEFAULT `uuid_generate_v4()`): Identificador do item da requisicao.
- `requisition_id` (UUID, NOT NULL, REFERENCES `requisitions(id)` ON DELETE CASCADE): Vinculo com o cabecalho.
- `product_id` (UUID, NOT NULL, REFERENCES `products(id)` ON DELETE CASCADE): Mercadoria requisitada.
- `quantity_requested` (INTEGER, NOT NULL): Volume desejado pela loja.
- `quantity_approved` (INTEGER): Volume validado/aprovado pelo Armazem Central.
- Restricao Unica: `(requisition_id, product_id)`.

#### Tabela: `products`
Catalogo mestre de mercadorias e estoque do **Armazem Central (CD)**.
- `id` (UUID, PK, DEFAULT `uuid_generate_v4()`): Identificador do produto.
- `company_id` (UUID, NOT NULL, REFERENCES `companies(id)` ON DELETE CASCADE): Vinculo tenant do item.
- `code` (TEXT, NOT NULL): Codigo interno de identificacao (SKU).
- `name` (TEXT, NOT NULL): Descricao completa do produto.
- `category` (TEXT, NOT NULL, REFERENCES `categories(id)`): Chave estrangeira para a categoria correspondente.
- `price` (NUMERIC(12,2), NOT NULL, DEFAULT 0): Preço unitário da mercadoria (Check: `price >= 0`, sem limite máximo artificial).
- `quantity` (INTEGER, NOT NULL, DEFAULT 0): Saldo físico disponível no Armazém Central (Check: `quantity >= 0`, sem limite máximo artificial).
- `min_stock` (INTEGER, NOT NULL, DEFAULT 0): Quantidade minima estipulada para seguranca do CD.
- `expiry` (DATE): Data limite de consumo ou validade do lote principal.
- `supplier` (TEXT): Nome ou razao social do fornecedor parceiro.
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`): Data de inclusao.
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`): Data da ultima modificacao.
- Restricao Unica: `(company_id, code)`.

#### Tabela: `stock_movements`
Livro-razao de auditoria imutavel para registro de variacoes fisicas de estoque do Armazem Central.
- `id` (UUID, PK, DEFAULT `uuid_generate_v4()`): Identificador do lancamento.
- `company_id` (UUID, NOT NULL, REFERENCES `companies(id)` ON DELETE CASCADE): Empresa de origem.
- `product_id` (UUID, NOT NULL, REFERENCES `products(id)` ON DELETE CASCADE): Mercadoria movimentada.
- `changed_by` (UUID, REFERENCES `profiles(id)` ON DELETE SET NULL): Operador responsavel pela acao.
- `movement_type` (TEXT, NOT NULL): Classificacao da operacao ('entrada' ou 'saida').
- `quantity_delta` (INTEGER, NOT NULL): Variacao quantitativa aplicada.
- `previous_quantity` (INTEGER): Saldo existente imediatamente anterior.
- `new_quantity` (INTEGER): Saldo resultante gravado no estoque do armazem.
- `note` (TEXT): Justificativa textual ou referencia documental (ex: transferencia para filial).
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT `now()`): Timestamp de efetivacao.

#### Tabela: `store_movements`
Livro-razao de auditoria imutavel para registro de entradas, saidas e recebimentos de requisicoes em cada loja filial.
- `id` (UUID, PK, DEFAULT `uuid_generate_v4()`): Identificador do lancamento na filial.
- `company_id` (UUID, NOT NULL, REFERENCES `companies(id)` ON DELETE CASCADE): Empresa tenant.
- `store_id` (UUID, NOT NULL, REFERENCES `stores(id)` ON DELETE CASCADE): Filial movimentada.
- `product_id` (UUID, NOT NULL, REFERENCES `products(id)` ON DELETE CASCADE): Produto movimentado.
- `changed_by` (UUID, REFERENCES `profiles(id)` ON DELETE SET NULL): Operador ou administrador responsavel.
- `movement_type` (TEXT, NOT NULL): Tipo (`entrada`, `saida`, `recebimento_requisicao`, `ajuste`).
- `quantity_delta`, `previous_quantity`, `new_quantity` (INTEGER): Variacao e saldos anterior/resultante.
- `requisition_id` (UUID, REFERENCES `requisitions(id)` ON DELETE SET NULL): Vinculo com requisicao recebida, quando aplicavel.
- `note` (TEXT) e `created_at` (TIMESTAMPTZ).

#### Tabelas de Mensageria: `domain_events` e `processed_events`
Suportam o padrao Transactional Outbox e a idempotencia de consumo de eventos distribuídos entre os microsserviços (`event_id`, `event_type`, `routing_key`, `payload`, `consumer_service`).

---

### 2.2. Triggers e Funcoes Stored Procedures

#### Procedimento: `apply_stock_movement`
Funcao PL/pgSQL executada com privilegios `SECURITY INVOKER` que consolida a atualizacao do saldo de um produto no Armazem Central e a insercao da linha de auditoria em transacao atomica:
1. Valida o tipo de movimentacao ('entrada' ou 'saida').
2. Obtem o registro do produto conferindo o `company_id` contra o RLS.
3. Calcula o saldo resultante (`v_new_qty = v_current_qty + p_quantity_delta`).
4. Rejeita apenas operacoes que resultem em saldo negativo (`v_new_qty < 0`), sem tetos artificiais maximos.
5. Grava a atualizacao em `products` e insere o registro detalhado em `stock_movements`.
6. Avalia se o estoque cruzou o limiar de seguranca (`v_current_qty > v_min_stock AND v_new_qty <= v_min_stock`).
7. Retorna payload JSON com os dados consolidados e a indicacao de necessidade de notificacao por e-mail.

#### Procedimento: `store_inventory_movement` e `receive_requisition_store`
Funcoes atomicas do dominio de Lojas (`MS Stores`):
- `store_inventory_movement`: atualiza ou cria saldo em `store_inventory` (bloqueando saldo negativo) e insere a linha de auditoria em `store_movements`.
- `receive_requisition_store`: consolida o recebimento de requisicoes despachadas (`despachada` -> `recebida`), creditando os itens aprovados na filial e registrando o historico em `store_movements`.

#### Procedimento: `handle_new_user`
Acionado pela trigger `on_auth_user_created` da tabela `auth.users`. Cria automaticamente a linha correspondente em `public.profiles` com o papel padrao de 'operador', garantindo integridade de perfil para todo usuario cadastrado.

#### Procedimento: `get_auth_user_company_id`
Funcao `SECURITY DEFINER` estavel com `search_path = public` utilizada internamente pelas politicas RLS para retornar o `company_id` do usuario logado (`auth.uid()`) sem incorrer em recursao infinita de politicas.

---

### 2.3. Matriz de Controle de Acesso e Isolamento Multi-tenant (RBAC e Domínios)

| Tabela | Operacao | Politica / Regra | Criterio de Seguranca |
| :--- | :--- | :--- | :--- |
| `companies` | SELECT | Visualizar propria empresa | `id = get_auth_user_company_id()` |
| `companies` | UPDATE | Atualizar propria empresa | `id = get_auth_user_company_id()` E perfil deve ser 'admin' |
| `companies` | DELETE | Bloqueio de exclusao | Proibido via cliente HTTP (`using (false)`) |
| `profiles` | SELECT | Visualizar membros | `id = auth.uid()` OU pertencente a mesma empresa |
| `profiles` | UPDATE | Atualizar perfil | `id = auth.uid()` garantindo que `role`, `company_id` e `store_id` nao sejam adulterados pelo proprio usuario |
| `profiles` | DELETE | Bloqueio de exclusao | Proibido via cliente HTTP (`using (false)`) |
| `products` | SELECT | Visualizar catalogo | `company_id = get_auth_user_company_id()` |
| `products` | ALL | Gerenciar produtos | `company_id = get_auth_user_company_id()` |
| `stock_movements`| SELECT | Visualizar movimentacoes | `company_id = get_auth_user_company_id()` |
| `stock_movements`| INSERT | Registrar lancamento | `company_id = get_auth_user_company_id()` |
| `stock_movements`| UPDATE | Bloqueio de edicao | Imutavel (`using (false)`) |
| `stock_movements`| DELETE | Bloqueio de remocao | Imutavel (`using (false)`) |
| `store_movements`| SELECT/INSERT | Auditoria da filial | Mesma empresa + isolamento de `store_id` quando usuario vinculado a filial |

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
Lista todos os colaboradores vinculados a empresa do usuario requisitante, enriquecidos com o nome da unidade de atuacao (`store_id`, `store_name`).
- Permissao: Qualquer usuario com empresa vinculada.
- Resposta: `200 OK` contendo lista de membros com `id`, `full_name`, `email`, `role`, `store_id`, `store_name` e `created_at`.

#### `POST /companies/invite`
Dispara convite por e-mail para um novo colaborador integrar a equipe da empresa, podendo vincula-lo a uma filial especifica (`store_id`) ou ao Armazem Central (`null`).
- Permissao: Restrito a usuarios com papel `admin`.
- Payload:
  ```json
  {
    "email": "colaborador@empresa.com.br",
    "full_name": "Nome do Colaborador",
    "role": "operador",
    "store_id": "uuid-da-filial-opcional"
  }
  ```
- Respostas:
  - `201 Created`: Retorna status do convite e ID do usuario criado/atualizado.
  - `409 Conflict`: Colaborador ja cadastrado nesta ou em outra organizacao.

#### `PATCH /companies/members/{member_id}`
Atualiza o papel de acesso (`role`) e/ou a unidade de atuacao (`store_id`) de um colaborador da equipe.
- Permissao: Restrito a usuarios com papel `admin`.
- Regra de Negocio: O administrador nao pode revogar seu proprio papel para 'operador'; ao informar `store_id`, o MS Identity valida a existencia da filial no MS Stores.
- Payload: `{"role": "operador", "store_id": "uuid-ou-null"}`.
- Respostas: `200 OK`, `400 Bad Request` ou `404 Not Found`.

#### `DELETE /companies/members/{member_id}`
Remove um colaborador da equipe da empresa.
- Permissao: Restrito a usuarios com papel `admin`.
- Regra de Negocio: O administrador nao pode excluir a si proprio.
- Respostas: `204 No Content` ou `404 Not Found`.

---

### 3.2. Modulo de Lojas Filiais (`/stores` — MS Stores)

#### `GET /stores`, `POST /stores`, `GET /stores/{store_id}`, `PATCH /stores/{store_id}`, `DELETE /stores/{store_id}`
CRUD completo das lojas filiais vinculadas a empresa tenant (escrita/exclusao restrita ao papel `admin`).

#### `GET /stores/{store_id}/inventory`
Consulta o inventario local e saldos fisicos de produtos presentes naquela filial, enriquecidos via S2S com nome, codigo, categoria e validade (`expiry`) do MS Warehouse.
- Permissao: Administrador ou operador da propria filial.

#### `POST /stores/{store_id}/inventory/movement` e `PATCH /stores/{store_id}/inventory/{product_id}`
Registra variacao fisica direta de estoque na loja (entrada ou saida local) gravando historico em `store_movements`, ou ajusta o estoque minimo (`min_stock`) local.
- Permissao: Administrador ou operador da propria filial.

#### `GET /stores/{store_id}/movements`
Retorna o historico de entradas, saidas e recebimentos na loja filial.

---

### 3.3. Modulo de Requisições de Reposição (`/requisitions` — MS Stores + SAGA)

#### `GET /requisitions`
Lista as requisicoes emitidas pelas filiais ao Armazem Central com filtros opcionais por loja e status.
- Permissao: Qualquer usuario com empresa vinculada (colaboradores vinculados a filial veem apenas pedidos de sua loja; administradores veem todos).
- Parametros: `store_id` (opcional), `status` (opcional).
- Resposta: `200 OK` contendo lista detalhada com itens, validades e quantidades solicitadas/aprovadas.

#### `POST /requisitions`
Emissao de uma nova requisicao de reabastecimento da loja para o armazem (valida catalogo no MS Warehouse e impede produtos duplicados no mesmo pedido).
- Permissao: Qualquer usuario com empresa vinculada.
- Payload:
  ```json
  {
    "store_id": "uuid-da-filial",
    "notes": "Reposicao semanal",
    "items": [
      { "product_id": "uuid-do-produto-1", "quantity_requested": 50 },
      { "product_id": "uuid-do-produto-2", "quantity_requested": 20 }
    ]
  }
  ```
- Respostas: `201 Created` ou `400/404`.

#### `PATCH /requisitions/{requisition_id}/status`
Atualiza a fase da requisicao respeitando a maquina de estados (`pendente` -> `aprovada` -> `despachada` -> `recebida`, ou `cancelada`) e RBAC por perfil/unidade:
- `aprovada`: Administrador aprova integralmente ou ajusta `items_approved` (`[{"product_id": "...", "quantity_approved": 10}]`).
- `despachada`: MS Stores executa etapa SAGA invocando `POST /internal/stock/dispatch` no MS Warehouse para deduzir os saldos em ordem FEFO do Armazem Central.
- `recebida`: Filial (ou admin) confirma recebimento, creditando `store_inventory` e gravando em `store_movements`.
- `cancelada` apos `despachada`: aciona compensacao SAGA `POST /internal/stock/release` devolvendo o saldo ao Armazem Central.
- Payload: `{"status": "aprovada" | "despachada" | "recebida" | "cancelada", "items_approved": [...]}`.

---

### 3.4. Modulo do Armazem Central e Movimentacoes (`/warehouse` e `/movements` — MS Warehouse)

#### `GET /warehouse/products/availability`
Retorna o catalogo do Armazem Central ordenado pelo criterio **FEFO (First Expire, First Out)**, exibindo `days_to_expiry`, `expiry_status` (`vencido`, `critico`, `atencao`, `normal`, `sem_validade`) e `low_stock`.

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
Compila os dados do estoque ou movimentacoes e gera o arquivo correspondente em formato PDF ou planilha XLSX, salvando-o no Object Storage configurado e retornando link de download temporario.
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
    "url": "/storage/reports/company-id/estoque_atual-20260914-103000.pdf",
    "filename": "estoque_atual-20260914-103000.pdf",
    "expires_in_seconds": 600
  }
  ```

---

### 3.5. Modulo de Healthcheck (`/health`)

#### `GET /health`
Informa o estado operacional consolidado do API Gateway e dos três microsserviços.
- Autenticacao: Publico.
- Resposta:
  ```json
  {
    "status": "ok",
    "service": "api-gateway",
    "environment": "production",
    "object_storage": "local-volume",
    "broker_mode": "rabbitmq-amqp",
    "services": [
      {"service": "ms-identity", "status": "ok"},
      {"service": "ms-warehouse", "status": "ok"},
      {"service": "ms-stores", "status": "ok"}
    ]
  }
  ```
- Seguranca: Nao expoem nenhum trecho ou metadado de chaves criptograficas.

---

## 4. Arquitetura do Frontend e Fluxos de Interface

O frontend foi desenvolvido com base no principio de interfaces ageis, de alta fidelidade visual e operacao tátil.

### 4.1. Gerenciamento de Estado
- `AuthContext`: Mantem a sessao ativa do usuario, carrega o perfil complementar (`profiles`) e define flags globais de controle (`isAuthenticated`, `needsOnboarding`, `role`, `companyId`, `storeId`).
- `ProductContext`: Responsavel pela colecao de produtos do Armazem Central em memoria, expondo `syncProductQuantity` e `refreshProducts` para sincronizacao apos despachos/estornos SAGA.
- `ToastContext`: Sistema centralizado de notificacoes visuais flutuantes com auto-dispensacao e suporte a variantes de sucesso, erro e alerta.

### 4.2. Guardas de Rota
- `PrivateRoute`: Intercepta rotas protegidas, renderizando um loader em tela cheia durante a restauração da sessão JWT salva e redirecionando usuários não autenticados para `/login`.
- `RequireCompany`: Assegura que usuarios sem empresa vinculada sejam imediatamente encaminhados para a tela de onboarding (`/onboarding`), impedindo o acesso ao painel principal antes do preenchimento cadastral.

### 4.3. Telas da Aplicacao
1. `LoginPage`: Interface de acesso com suporte a alternancia entre login por credenciais e recuperacao de senha por e-mail.
2. `OnboardingPage`: Cadastro simplificado e intuitivo da empresa (nome, segmento, CNPJ com mascara, telefone e e-mail de alertas).
3. `DashboardPage`: Painel de controle analitico exibindo indicadores chave de desempenho (total de produtos, estoque baixo, itens proximos do vencimento e valor financeiro total imobilizado).
4. `StockPage`: Gestao completa de estoque central com ordenacao por colunas, filtros combinados de busca, paginacao e abertura de modais de operacao sem tetos artificiais.
5. `StoresPage`: Cadastro/edicao/exclusao de filiais, controle local com ajuste de estoque minimo, indicadores FEFO, modal de movimentacao local (`StoreMovementModal`) e historico (`store_movements`).
6. `RequisitionsPage`: Solicitacao de reabastecimento com selecao orientada por FEFO (`RequisitionModal`), ajuste de quantidades aprovadas, despacho SAGA, estorno compensatorio e confirmacao de recebimento na loja.
7. `ProfilePage`: Dados da empresa, gestao da equipe com envio de convites, vinculo/realocacao de colaboradores por filial e gerenciamento de acesso.
8. `SetPasswordPage`: Tela de definicao de credencial para novos membros que acessaram via link de convite.

---

## 5. Procedimentos de Deploy e Configuracao de Infraestrutura

### 5.1. Vercel (Producao Monorepo Serverless)
O arquivo `vercel.json` na raiz do projeto orquestra a execucao conjunta do frontend SPA e do API Gateway (`api-gateway/gateway/main.py` roteando para os 3 microsserviços em modo `asgi://`):

```json
{
  "services": {
    "frontend": {
      "root": "frontend",
      "framework": "vite",
      "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
    },
    "api-gateway": {
      "root": ".",
      "entrypoint": "api-gateway/gateway/main.py"
    }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": { "service": "api-gateway" } },
    { "source": "/api", "destination": { "service": "api-gateway" } },
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

### 5.2. Orquestracao em Contêineres (Docker Compose e Dockerfiles Independentes)
Para executar a topologia completa com contêineres isolados (RabbitMQ + MS Identity + MS Warehouse + MS Stores + API Gateway + Frontend Nginx), utilize o `docker-compose.yml` na raiz do repositorio (`docker compose up --build`). Cada serviço possui seu próprio `Dockerfile` e `requirements.txt` enxuto na raiz:

- `api-gateway/Dockerfile` -> executa `gateway.main:app` (porta `8000`, sem dependências pesadas de relatórios/PDF)
- `ms-identity/Dockerfile` -> executa `ms_identity.main:app` (porta `8001`)
- `ms-warehouse/Dockerfile` -> executa `ms_warehouse.main:app` (porta `8002`, inclui WeasyPrint/Pandas/OpenPyXL/APScheduler)
- `ms-stores/Dockerfile` -> executa `ms_stores.main:app` (porta `8003`)
- `frontend/Dockerfile` -> build Vite + servidor Nginx com proxy `/api/` para `api-gateway:8000`

---

## 6. Sumario de Seguranca Operacional

O frontend acessa somente o Gateway; as credenciais de banco ficam restritas ao processo do serviço proprietário. A autenticação é 100% nativa (JWT assinado com HS256) e gerenciada pelo MS Identity.

1. Chaves e Segredos:
   - `JWT_SECRET`: Segredo privativo do MS Identity e API Gateway para emissão e validação dos tokens dos usuários.
   - `INTERNAL_SERVICE_SECRET`: Chave de autenticação mútua para comunicação interna entre microsserviços (`/internal/*`).
2. Sanitizacao de Entrada:
   - Todo payload recebido pela API e validado e tipado pelo Pydantic, bloqueando campos excedentes ou tipos incorretos.
3. Prevensao de Injecao SQL:
   - As consultas do adaptador PostgreSQL usam parâmetros preparados; nomes de tabela/coluna são derivados das operações definidas no backend.
4. Isolamento Transacional:
   - Nenhuma atualizacao de quantidade de estoque e executada de forma solta; todo saldo e atualizado dentro da procedure `apply_stock_movement`.
