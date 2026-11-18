# Handoff e Continuidade do Projeto — Valida Fácil (Microsserviços)

> **Instrução para o agente (Antigravity):** Leia este documento antes de iniciar qualquer tarefa neste repositório (`/home/limalimao/Projetos/Valida Fácil/Código/valida-facil-microservices`). Ele registra decisões arquiteturais, alterações já realizadas além da documentação padrão, estado exato dos testes e próximos passos pendentes.

---

## 1. Visão Geral e Contexto Crítico

- **Repositório atual:** `valida-facil-microservices/` (evolução distribuída do projeto monolítico original que permanece intacto na pasta irmã `../project/`).
- **Regra de isolamento de repositório:** Não altere arquivos em `../project/` ao trabalhar aqui, salvo instrução explícita do usuário.
- **Arquitetura Adotada: Database-per-Service Pura (PostgreSQL Dedicado por Serviço):**
  - Cada microsserviço possui sua própria instância física de banco de dados PostgreSQL 16 no Docker Compose:
    - **`db-identity` (porta 5435 host -> 5432 interna):** Banco `valida_identity` (`users`, `companies`, `profiles`).
    - **`db-warehouse` (porta 5433 host -> 5432 interna):** Banco `valida_warehouse` (`categories`, `products`, `stock_movements`, `warehouse_dispatches`, RPC `apply_stock_movement`).
    - **`db-stores` (porta 5434 host -> 5432 interna):** Banco `valida_stores` (`stores`, `store_inventory`, `store_movements`, `requisitions`, `requisition_items`, RPCs `store_inventory_movement` e `receive_requisition_store`).
  - **Zero acoplamento físico:** não há chaves estrangeiras (FKs) cruzadas, conexões cruzadas ou queries JOIN cross-database.
  - **Auth Nativo:** O `ms-identity` gerencia usuários e senhas com `bcrypt` nativo e emite tokens JWT assinados contendo as claims (`user_id`, `company_id`, `role`, `store_id`).
  - **Driver de Dados Nativo (`shared/database.py`):** Utiliza `psycopg 3` com pool de conexões, serialização automática de UUID e datetime, métodos fluentes (`table()`, `rpc()`, `check_health()`).
- **Arquivos auxiliares de referência:**
  - `README.md` — visão executiva e comandos locais.
  - `docker-compose.yml` — orquestração completa (3 bancos Postgres, RabbitMQ, 3 microsserviços, API Gateway e Frontend Nginx).
  - `tests/` — suíte unificada de testes (pytest).

---

## 2. Implementações Realizadas

### 2.1. Arquitetura de Microsserviços e Gateway
- `api-gateway/` (porta 8000): Ponto único de entrada REST. Roteamento inteligente:
  - `/companies/*`, `/auth/*` -> `ms-identity` (porta 8001)
  - `/products/*`, `/categories/*`, `/movements/*`, `/alerts/*`, `/reports/*`, `/warehouse/*` -> `ms-warehouse` (porta 8002)
  - `/stores/*`, `/requisitions/*` -> `ms-stores` (porta 8003)
- `shared/http_client.py`: Comunicação S2S transparente (modo HTTP em rede ou modo in-process `asgi://` para testes e serverless).
- `shared/broker.py`: Barramento de eventos assíncronos híbrido (RabbitMQ AMQP tópico `valida_facil.events` + Transactional Outbox com fallback HTTP).

### 2.2. Etapa 1: Frontend 100% REST Puro
- O frontend (`frontend/src/`) opera inteiramente via API Gateway através de `apiClient.js` (`/api/*`).
- Eliminadas dependências proprietárias do SDK Supabase nas operações de negócio e dados.
- Autenticação e perfil baseados no JWT emitido pelo `ms-identity` e persistido em `localStorage.getItem("valida_facil_token")`.
- Paridade completa de testes: **150 testes Vitest passando (100%)** em 24 arquivos de teste.

### 2.3. Etapa 2: Observabilidade Cloud-Native e Sondas de Nuvem
- **Distributed Tracing (Correlation ID & Request ID):**
  - Implementado em `shared/tracing.py` e integrado no `shared/app_factory.py`.
  - Middleware HTTP extrai cabeçalho `X-Correlation-ID` / `X-Request-ID` (ou gera UUID v4 caso ausente) e armazena em `contextvars.ContextVar`.
  - Injetado automaticamente nas respostas HTTP (`X-Correlation-ID`, `X-Request-ID`).
  - Propagado automaticamente para microsserviços upstream através de `ServiceHttpClient` em `shared/http_client.py`.
  - Herança automática em eventos publicados no RabbitMQ (`DomainEvent.correlation_id`).
- **Sondas de Nuvem (Kubernetes / ECS / Docker Health Probes):**
  - **Liveness Probe (`GET /health/live` e `GET /api/health/live`):** Retorna HTTP 200 rápido (`{"status": "alive"}`), comprovando que o processo Uvicorn e o loop assíncrono estão responsivos sem dependência de I/O pesado.
  - **Readiness Probe (`GET /health/ready` e `GET /api/health/ready`):** Retorna HTTP 200 (`status: "ready"`) quando o banco de dados dedicado (`SELECT 1 AS alive`) e o broker de eventos estiverem saudáveis; retorna HTTP 503 (`status: "not_ready"`) caso alguma dependência esteja indisponível.
  - Gateway agrega a integridade de todos os microsserviços upstream em seu `/health/ready`.

### 2.4. Etapa 3: Resiliência Inter-Serviços (Circuit Breaker & Retry com Exponential Backoff)
- **Circuit Breaker (`shared/resilience.py`)**:
  - Implementa máquina de estados estrita: `CLOSED` -> `OPEN` -> `HALF_OPEN` -> `CLOSED`.
  - Integrado em cada instância de `ServiceHttpClient` (`identity_client`, `warehouse_client`, `stores_client`).
  - Quando um microsserviço downstream atinge 5 falhas consecutivas, o circuito se abre imediatamente (`OPEN`), rejeitando novas requisições em fail-fast (sem gastar I/O e conexões).
  - O API Gateway captura `CircuitBreakerOpenException` e responde **HTTP 503** com cabeçalho `Retry-After: <segundos>` e payload descritivo.
  - Após o tempo de recuperação (10s), o circuito transita para `HALF_OPEN` e permite requisições canary controladas: sucesso fecha o circuito (`CLOSED`); nova falha reabre o circuito (`OPEN`).
- **Retry com Exponential Backoff e Jitter**:
  - Para falhas de rede transitórias (`ConnectError`, `Timeout`, `502/503/504`) em métodos idempotentes (`GET`, `PUT`, `DELETE`).
  - Espera exponencial `base_delay * (2 ** attempt) + jitter` para evitar tempestade sincronizada (*thundering herd*).
  - Métodos não-idempotentes (`POST`) não são repetidos caso os dados já tenham sido enviados pela rede.

### 2.5. Etapa 4: Dead Letter Queue (DLQ) & Isolamento de Mensagens Tóxicas
- **RabbitMQ Dead Lettering (`shared/broker.py`)**:
  - Configuração da Dead Letter Exchange: `valida_facil.events.dlx` (Topic, durável).
  - Configuração de Dead Letter Queues dedicadas: `<queue_name>.dlq` bound em `#`.
  - Consumidores assíncronos tentam reprocessar mensagens até 3 vezes com backoff local. Caso persistam falhas (poison pill), o evento é enriquecido com metadados de erro (`x-death-reason`, `x-correlation-id`, `x-failed-at`) e arquivado na DLQ, efetuando `ack` na fila principal para não interromper os outros consumidores.
- **Auditoria de Resiliência no Gateway**:
  - Endpoint `GET /gateway/resilience` (e `/api/gateway/resilience`) reporta o estado em tempo real dos 3 Circuit Breakers e a contagem/detalhes dos últimos eventos na DLQ.

### 2.6. Etapa 5: Object Storage Autônomo (S3/MinIO/Local) e Purificação REST do Frontend
- **Object Storage Autônomo (`shared/storage.py`)**:
  - Abstração agnóstica de provedor: armazena logos e relatórios em volume compartilhado (`storage/`) ou MinIO (S3 compatível).
  - Prevenção ativa de Directory Traversal em paths de arquivos.
  - `POST /companies/logo` e `DELETE /companies/logo` implementados no `ms-identity` com validação de tipo de imagem (PNG, JPG, WebP, SVG) e limite rígido de 3MB.
  - Entrega estática de mídias através do API Gateway (`/storage/{bucket}/{path}`) e Nginx com cabeçalhos de cache HTTP (`Cache-Control: public, max-age=3600`).
  - Serviço MinIO integrado ao `docker-compose.yml` (portas 9000 e 9001).
- **Purificação REST do Frontend**:
  - Suporte a `FormData` nativo no `apiClient.js` (`postFormData`).
  - `uploadCompanyLogo` e `removeCompanyLogo` no `companyService.js` operam diretamente via API Gateway.
  - `reportService.js` consome dados de empresa, catálogo e movimentações via API Gateway (`/companies/me`, `/products`, `/movements`) em vez de consultas diretas ao banco.

---

## 3. Estado das Validações

1. **Backend (pytest `tests/`):** **131 passed (100%)**
   - Inclui testes de arquitetura SAGA, isolamento de bancos, autenticação nativa JWT, rotas FEFO, liveness/readiness probes, Correlation ID, Circuit Breaker states, fail-fast 503 com Retry-After, Exponential Backoff, Dead Letter Queue e novo Object Storage / Logo (`tests/integration/test_company_logo_and_storage.py`).
2. **Frontend (Vitest `npm test --prefix frontend`):** **150 passed (100%)** em 24 arquivos de teste.
3. **Cluster Docker Live (E2E contra instâncias reais):** **10/10 serviços integrados**
   - 3 bancos Postgres independentes (`db-identity`, `db-warehouse`, `db-stores`), RabbitMQ, MinIO Storage, 3 microsserviços, API Gateway e Frontend Nginx.

4. **Validação Visual E2E (Subagente Chrome DevTools):** **100% Concluída**
   - Autenticação e navegação no Dashboard, Estoque Central, Modal de Produto e Gestão de Lojas validadas com screenshots de alta resolução e gravação em vídeo.

---

## 4. Próximos Passos Sugeridos

- **Etapa 6: Consolidação de Commits no Git**:
  - Revisar `git status` e commitar as implementações de arquitetura de microsserviços, database-per-service, resiliência (Circuit Breaker e DLQ) e observabilidade.
