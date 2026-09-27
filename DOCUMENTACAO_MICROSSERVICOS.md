# Valida Facil — Especificacao Arquitetural de Microsservicos

Este documento descreve a arquitetura distribuida baseada em **Microsservicos** do sistema **Valida Facil**, projetada para operar no modelo de **Armazem Central (CD - Centro de Distribuicao) e Lojas Filiadas (Filiais)**.

> **Uso deste documento:** O conteudo abaixo foi estruturado para ser autocontido. Voce pode copiar este arquivo integralmente ou em partes para alimentar a janela de contexto de outro chat/LLM ou repassar a equipe de desenvolvimento.

---

## Bloco de Contexto Rapido (Copie e Cole no Novo Chat)

```text
Contexto do Projeto: Valida Facil (Arquitetura de Microsservicos)
O Valida Facil e um sistema de gestao de estoque e suprimentos com foco rigoroso em controle de validades de produtos por lote (regra FEFO: First Expire, First Out). 
A arquitetura e dividida em 3 microsservicos independentes (padrao Database per Service), orquestrados por um API Gateway e comunicando-se de forma hibrida (Sincrona via HTTP/REST e Assincrona via Message Broker RabbitMQ/Kafka):

1. API Gateway: Ponto unico de entrada HTTP para clientes (Web/Mobile), responsavel por roteamento, autenticacao e seguranca.
2. MS de Usuarios & Empresa: Gerencia autenticacao, RBAC (Administrador do Armazem e Colaboradores de Loja) e dados cadastrais da empresa (multi-tenant). Banco: BD Usuarios.
3. MS de Estoque (Armazem Central): Gerencia o Centro de Distribuicao, catalogo geral, controle de lotes, datas de validade (FEFO) e atendimento/despacho de requisicoes. Banco: BD Estoque.
4. MS de Lojas (Filiais): Gerencia o inventario local de cada loja especifica, emite requisicoes de itens para o armazem e controla entradas/saidas locais. Banco: BD Loja.
5. Message Broker: Intermediador de mensageria assincrona para tráfego resiliente e desacoplado de requisicoes entre Lojas e Estoque.
```

---

## 1. Visao Geral e Regra de Negocio

### 1.1. O Problema de Negocio
Redes varejistas e distribuidoras enfrentam dois grandes gargalos:
1. **Perdas financeiras por produtos vencidos:** Falta de rastreabilidade de lotes proximos da data de expiracao.
2. **Desabastecimento e atrito na reposicao:** Falta de comunicacao padronizada entre as filiais e o armazem central, gerando pedidos duplicados ou perdas de comunicacao sob picos de operacao.

### 1.2. A Proposta de Solucao
O **Valida Facil** unifica a logistica interna da rede:
- O **Armazem Central** armazena mercadorias em larga escala e atende as filiais aplicando automaticamente o criterio **FEFO** (*First Expire, First Out* — o lote que vence primeiro e o primeiro a ser separado).
- As **Lojas Filiais** gerenciam seu estoque de gondola e balcao e emitem **Requisicoes** formais ao armazem para reabastecimento.

---

## 2. Perfis de Acesso (RBAC)

1. **Administrador de Armazem / Geral:**
   - Visualiza todo o armazem central e o panorama de todas as filiais.
   - Gerencia cadastros de produtos, fornecedores e lotes mestres.
   - Atende, separa e despacha as requisicoes solicitadas pelas lojas.
   - Configura regras de notificacao e disparos de alerta de vencimento.

2. **Colaborador de Loja:**
   - Vinculado a uma filial especifica.
   - Gerencia o inventario local de sua respectiva loja (vendas, entradas, perdas locais).
   - Consulta a disponibilidade de itens no armazem central.
   - Cria e acompanha o status de **Requisicoes** de reposicao enviadas ao armazem.

---

## 3. Topologia da Arquitetura

O sistema adota o padrao **Database per Service**, garantindo que nenhum servico acesse diretamente as tabelas de outro.

```mermaid
flowchart TD
    User["👤 Usuários\n(Admin Armazém / Colaborador Loja)"] -->|HTTP / REST (Síncrono)| GW["🚪 API GATEWAY\n(Roteamento, Autenticação, Rate Limit)"]

    subgraph ECOSSISTEMA ["Ecossistema de Microsserviços"]
        direction TB
        
        GW -->|HTTP / REST| MS_USER["🔐 MS de Usuários & Empresa\n• Autenticação & Perfis\n• Gestão da Empresa (Tenant)"]
        GW -->|HTTP / REST| MS_EST["📦 MS de Estoque (Armazém Central)\n• Catálogo Geral & Lotes\n• Regra FEFO (Validades)\n• Atendimento de Requisições"]
        GW -->|HTTP / REST| MS_LOJA["🏪 MS de Lojas (Filiais)\n• Inventário Local da Filial\n• Emissão de Requisições\n• Recebimento de Despachos"]

        MS_LOJA -.->|HTTP / REST (Consulta Síncrona de Saldo)| MS_EST

        MS_LOJA ==>|1. Publica Requisição (Assíncrono)| BROKER["📨 MESSAGE BROKER\n(RabbitMQ / Apache Kafka)"]
        BROKER ==>|2. Processar Requisição (Assíncrono)| MS_EST
        MS_EST ==>|3. Atualização de Status / Despacho| BROKER
        BROKER ==>|4. Confirmação / Atualização| MS_LOJA
    end

    MS_USER --- DB_USER[("🗄️ BD Usuários\n(PostgreSQL)")]
    MS_EST --- DB_EST[("🗄️ BD Estoque\n(PostgreSQL)")]
    MS_LOJA --- DB_LOJA[("🗄️ BD Loja\n(PostgreSQL)")]

    classDef gateway fill:#0F172A,stroke:#38BDF8,stroke-width:2px,color:#fff;
    classDef service fill:#FFFFFF,stroke:#64748B,stroke-width:2px,color:#0F172A;
    classDef broker fill:#1E293B,stroke:#F59E0B,stroke-width:2px,color:#FCD34D;
    classDef db fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#78350F;

    class GW gateway;
    class MS_USER,MS_EST,MS_LOJA service;
    class BROKER broker;
    class DB_USER,DB_EST,DB_LOJA db;
```

---

## 4. Padroes de Comunicacao: Sincrono vs. Assincrono

A arquitetura equilibra deliberadamente chamadas imediatas (Request-Response) e orientacao a eventos (*Event-Driven*).

### 4.1. Comunicacao Sincrona (HTTP / REST)
Utilizada exclusivamente em operacoes onde o cliente ou usuario **necessita da resposta imediata na tela** para tomar uma acao.

1. **Usuario $\rightarrow$ API Gateway $\rightarrow$ Qualquer Servico:**
   - Exemplos: Efetuar login, listar catalogo da loja, visualizar painel de controle.
   - Motivo: O protocolo HTTP web funciona no ciclo requisicao-resposta; a tela precisa dos dados para renderizar a interface.
2. **MS de Lojas $\rightarrow$ MS de Estoque (Consulta de Disponibilidade no Armazem):**
   - Cenario: O colaborador da filial esta na tela montando uma lista de reposicao e precisa saber: *"O armazem central tem 100 caixas de oleo disponiveis agora?"*.
   - Chamada direta HTTP GET interna (via rede privada protegida).

### 4.2. Comunicacao Assincrona (via Message Broker — RabbitMQ ou Kafka)
Utilizada em processos transacionais de negocio que envolvem processamento pesado, etapas logisticas ou onde **tolerancia a falhas e desacoplamento temporal** sao mandatorios.

1. **MS de Lojas $\rightarrow$ Broker $\rightarrow$ MS de Estoque (Envio de Requisicao):**
   - A loja confirma a requisicao. O MS de Lojas publica o evento `RequisicaoCriadaEvent` na fila e devolve imediatamente para o colaborador: `202 Accepted` (*"Requisicao enviada para processamento"*).
   - O colaborador nao fica travado esperando a alocacao fisica no armazem.
   - Se o MS de Estoque estiver em deploy ou temporariamente fora do ar, a requisicao permanece protegida e persistida na fila.
   - Buffer contra picos: se 100 lojas emitirem requisicoes as 18h simultaneamente, o Estoque consome no seu ritmo sem derrubar o banco de dados.

2. **MS de Estoque $\rightarrow$ Broker $\rightarrow$ MS de Lojas (Notificacoes de Status e Despacho):**
   - Conforme o armazem separa os itens e efetua a baixa nos lotes, publica eventos como `RequisicaoSeparadaEvent` e `RequisicaoDespachadaEvent`.
   - O MS de Lojas consome esses eventos e atualiza o historico local daquela filial.

---

## 5. Detalhamento de Cada Servico

### 5.1. API Gateway
- **Responsabilidades:**
  - Ponto unico de entrada publica (ex: `api.validafacil.com.br`).
  - Roteamento reverso para as portas internas dos servicos.
  - Validacao inicial de tokens JWT e filtragem de seguranca (CORS, Rate Limiting, Prevensao de DDoS).
  - Isolamento de rede: os microsservicos e bancos rodam em sub-redes privadas (VPC); apenas o Gateway recebe trafego da internet.

---

### 5.2. Microsservico de Usuarios & Empresa (MS 1)
- **Responsabilidades:**
  - Cadastro institucional da Empresa (CNPJ, razao social, e-mail de alertas).
  - Autenticacao de usuarios (login, hashing seguro de senhas, geracao de JWT).
  - Gestao de colaboradores e papeis (Admin de Armazem vs. Colaborador de Loja).
  - Vinculacao de colaboradores as filiais correspondentes.
- **Banco de Dados (BD Usuarios):**
  - `companies`: Dados da empresa tenant.
  - `users` / `profiles`: Credenciais, papeis (`admin`, `colaborador_loja`), identificador da loja vinculada (`store_id`).
  - `stores`: Cadastro das filiais existentes (nome, codigo, endereco).

---

### 5.3. Microsservico de Estoque — Armazem Central (MS 2)
- **Responsabilidades:**
  - Gestao fisica do Armazem Central / CD.
  - Cadastro mestre de produtos, precos de custo, categorias e fornecedores.
  - **Controle de Lotes e Validades (Regra FEFO):** Rastreio minucioso da data de vencimento de cada lote recebido dos fabricantes.
  - Consumo da fila de **Requisicoes** das lojas.
  - **Processamento de Requisicao:** Reserva de itens selecionando automaticamente os lotes com vencimento mais proximo.
  - Despacho de cargas e baixa no saldo do armazem.
  - Disparo de alertas preventivos de produtos proximos do vencimento no CD.
- **Banco de Dados (BD Estoque):**
  - `catalog_products`: Cadastro geral de produtos e atributos.
  - `warehouse_batches`: Lotes fisicos no armazem (`batch_number`, `expiry_date`, `quantity_available`).
  - `central_movements`: Historico de entradas de fornecedores e saidas de transferencias.
  - `warehouse_requisitions`: Registro do atendimento das requisicoes recebidas das lojas.

---

### 5.4. Microsservico de Lojas — Filiais (MS 3)
- **Responsabilidades:**
  - Gestao do estoque local de uma filial especifica.
  - Emissao de **Requisicoes** de reposicao para o Armazem Central.
  - Recebimento e conferencia fisica de mercadorias despachadas pelo CD.
  - Registro de saidas locais (vendas na ponta, perdas operacionais ou quebras).
  - Monitoramento das datas de validade dos itens presentes na gondola daquela filial.
- **Banco de Dados (BD Loja):**
  - `store_inventory`: Saldo local da loja por produto e lote.
  - `store_requisitions`: Requisicoes emitidas pela loja (`status`: *pendente*, *em_separacao*, *despachado*, *recebido*).
  - `store_movements`: Entradas por transferencia e saidas locais.

---

## 6. Ciclo de Vida Completo de uma Requisicao

O fluxo a seguir exemplifica a integracao de todos os componentes de ponta a ponta:

```text
[Colaborador na Loja]
        │
        ▼ 1. Monta pedido e consulta saldo em tempo real (HTTP GET)
[MS Lojas] ──(Síncrono / REST)──> [MS Estoque] (Retorna disponibilidade)
        │
        ▼ 2. Clica em "Enviar Requisição" (HTTP POST)
[MS Lojas] ──(Grava status 'pendente' no BD Loja)
        │
        ▼ 3. Publica mensagem no Message Broker
   [BROKER: fila.requisicoes.armazem]
        │
        ▼ 4. Consumo assíncrono pelo Armazém Central
[MS Estoque] (Retira da fila)
        │
        ├─> Aplica regra FEFO (prioriza lotes mais próximos do vencimento)
        ├─> Reserva quantidade e deduz do saldo físico (BD Estoque)
        └─> Altera status para 'em_separacao'
        │
        ▼ 5. Armazém conclui a separação e despacha os itens
[MS Estoque] ──> Publica evento [BROKER: fila.notificacoes.lojas]
        │
        ▼ 6. Consumo pela Filial
[MS Lojas] (Atualiza status da requisição local para 'despachada')
        │
        ▼ 7. Carga chega fisicamente na Loja
[Colaborador na Loja] ──> Clica em "Confirmar Recebimento"
[MS Lojas] ──> Dá entrada automática no estoque local daquela filial (BD Loja)
```

---

## 7. Padrao de Mensageria e Eventos (Payloads Sugeridos)

### 7.1. Evento: `RequisicaoCriadaEvent`
- **Fila / Routing Key:** `requisicao.criada`
- **Produtor:** MS de Lojas
- **Consumidor:** MS de Estoque
- **Exemplo de Payload:**
  ```json
  {
    "event_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "event_type": "REQUISICAO_CRIADA",
    "timestamp": "2026-09-27T18:30:00Z",
    "store_id": "loja-filial-01",
    "requisition_id": "req-2026-0089",
    "requested_by": "operador-joao@empresa.com.br",
    "items": [
      {
        "product_code": "ALM-0001",
        "requested_quantity": 40
      },
      {
        "product_code": "ALM-0005",
        "requested_quantity": 25
      }
    ]
  }
  ```

### 7.2. Evento: `RequisicaoDespachadaEvent`
- **Fila / Routing Key:** `requisicao.despachada`
- **Produtor:** MS de Estoque
- **Consumidor:** MS de Lojas
- **Exemplo de Payload:**
  ```json
  {
    "event_id": "c1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
    "event_type": "REQUISICAO_DESPACHADA",
    "timestamp": "2026-09-27T20:15:00Z",
    "store_id": "loja-filial-01",
    "requisition_id": "req-2026-0089",
    "items_allocated": [
      {
        "product_code": "ALM-0001",
        "quantity": 40,
        "batch_number": "LOTE-2026-A",
        "expiry_date": "2026-10-15"
      },
      {
        "product_code": "ALM-0005",
        "quantity": 25,
        "batch_number": "LOTE-2026-C",
        "expiry_date": "2026-11-01"
      }
    ]
  }
  ```

---

## 8. Consideracoes para Implementacao e Stack Recomendada

Caso este modelo seja implementado no codigo:

| Componente | Tecnologias Recomendadas | Justificativa |
| :--- | :--- | :--- |
| **API Gateway** | Kong, Traefik, Ocelot ou FastAPI Gateway | Alta performance, suporte a plugins de JWT, rate limit e SSL termination. |
| **Message Broker** | RabbitMQ ou Apache Kafka | RabbitMQ e ideal para roteamento flexivel de filas com AMQP; Kafka e ideal caso deseje replay de eventos e altissimo volume. |
| **Bancos de Dados** | PostgreSQL com schemas independentes ou bancos dedicados | Mantem a conformidade com o padrao *Database per Service* e ACID por servico. |
| **Persistencia Assincrona**| Padrao Outbox / Transactional Outbox | Garante que o evento so seja publicado no Broker se a transacao no banco local do servico for commitada com sucesso. |
| **Deploy / Orquestracao** | Docker Compose (Local) / Kubernetes (Producao) | Permite escalar o MS de Lojas ou MS de Estoque separadamente conforme a demanda. |
