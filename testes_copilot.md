# Testes e análise de lógica — Valida Fácil

> **Registro histórico:** resultados e referências abaixo descrevem uma revisão anterior à migração para PostgreSQL Database-per-Service e autenticação JWT nativa. Não representam a validação atual; as referências ao schema Supabase são legadas.

**Objetivo:** registrar resultados de testes e achados acionáveis para uma IA implementar correções.
**Escopo:** estado local atual do repositório, incluindo os microsserviços, frontend, testes e SQL em `database/supabase/`.
**Limite:** os testes usam doubles/fakes e não executam as migrações em um Supabase/PostgreSQL real; os achados envolvendo concorrência e RPC precisam de testes de integração com banco.

## Resultados das verificações

| Verificação | Resultado |
|---|---|
| `.venv/bin/python -m pytest -q` | **98 passaram**; 202 avisos de depreciação de dependências. |
| `cd frontend && npm test` | **150 passaram** em 24 arquivos. |
| `.venv/bin/python -m compileall -q api-gateway shared ms-identity ms-stores ms-warehouse tests` | **Passou**. |
| `cd frontend && npm run build` | **Passou**; Vite alertou que o bundle principal minificado excede 500 kB. |
| `cd frontend && npm run lint` | **Falhou** ao resolver `eslint-plugin-react` a partir da configuração na raiz. Com `--resolve-plugins-relative-to .`, o ESLint executou e apontou **17 erros**: 16 ocorrências de `global` não definido em testes e um bloco `catch` vazio em `frontend/src/services/reportService.js:143`. |
| `git diff --check` | **Passou**. |

O build de frontend foi executado a partir da pasta `frontend`; os comandos npm precisam ser executados nesse diretório.

## Achados para correção

### 1. Segredo interno conhecido por padrão pode liberar endpoints privilegiados

- **Prioridade:** Alta, se o serviço for iniciado sem sobrescrever o valor.
- **Referências:** `shared/config.py:38`; `docker-compose.yml:29,55,81,112`; `shared/auth.py:20-25,31-57`; `ms-warehouse/ms_warehouse/routers/internal.py:24`.
- **Evidência:** o segredo interno tem valor padrão fixo (`valida-facil-internal-dev-secret`) e o Compose repete esse fallback. As rotas internas aceitam esse segredo; sem token de usuário, `resolve_db_client` retorna o cliente Supabase com service role.
- **Impacto:** uma implantação que omita `INTERNAL_SERVICE_SECRET` fica com autenticação interna previsível, permitindo chamadas diretas a operações S2S privilegiadas caso o serviço esteja acessível.
- **Correção sugerida:** exigir segredo fornecido pelo ambiente em produção e falhar no startup se estiver ausente ou igual ao valor de desenvolvimento. Evitar expor as portas dos microsserviços fora da rede interna. Adicionar teste de configuração de produção sem segredo.

### 2. Falha da RPC de recebimento pode creditar o estoque duas vezes

- **Prioridade:** Alta.
- **Referências:** `ms-stores/ms_stores/routers/requisitions.py:192-255`; `database/supabase/setup_microservices_isolated_schema.sql:493-559`.
- **Evidência:** `_credit_store_inventory_on_receipt` captura qualquer exceção da RPC `receive_requisition_store` e segue para uma implementação alternativa que soma a quantidade no inventário. Se a transação da RPC for confirmada no banco, mas a resposta se perder/expirar, o fallback soma novamente e grava o status como recebida. O fallback também pode mascarar erros reais da RPC e não é atômico com a escrita do inventário e do histórico.
- **Correção sugerida:** usar fallback somente para cliente de teste explicitamente identificado; em produção, propagar a falha. Tornar o recebimento idempotente no banco, por exemplo registrando a transição/recebimento uma única vez dentro da mesma transação. Testar falha de resposta após commit.

### 3. Recebimentos concorrentes podem duplicar créditos

- **Prioridade:** Alta.
- **Referências:** `database/supabase/setup_microservices_isolated_schema.sql:506-555`; `ms-stores/ms_stores/routers/requisitions.py:448-470,648`.
- **Evidência:** a RPC lê o status `despachada`, verifica o status e só atualiza a requisição para `recebida` depois de creditar os itens. Não há bloqueio da linha (`FOR UPDATE`) nem atualização condicional atômica antes do crédito. Duas chamadas simultâneas podem observar `despachada` e ambas somar a quantidade em `store_inventory`.
- **Correção sugerida:** serializar o recebimento por requisição e condicionar a transição de status a `status = 'despachada'` na mesma transação; somente a chamada que efetivamente mudar o status deve creditar itens. Criar teste concorrente contra PostgreSQL.

### 4. Despacho da mesma requisição não é idempotente entre microsserviços

- **Prioridade:** Alta.
- **Referências:** `ms-stores/ms_stores/routers/requisitions.py:544-585`; `ms-warehouse/ms_warehouse/routers/internal.py:130-228`.
- **Evidência:** o MS Stores chama `/internal/stock/dispatch` antes de atualizar o status local para `despachada`. O endpoint do armazém deduz quantidades, mas não verifica se aquele `requisition_id` já foi processado nem registra uma chave idempotente. Se o armazém concluir o despacho e a atualização local falhar (ou a resposta se perder), a requisição pode continuar `aprovada`; uma repetição debita o estoque novamente.
- **Correção sugerida:** tornar o despacho idempotente por `requisition_id` no MS Warehouse, persistindo o resultado e devolvendo a alocação anterior em repetições. Cobrir repetição após sucesso remoto e falha da atualização local, além de duas chamadas simultâneas.

### 5. Atualização do estoque mínimo não valida se o produto pertence à empresa

- **Prioridade:** Média.
- **Referências:** `ms-stores/ms_stores/routers/stores.py:383-411`; `database/supabase/setup_microservices_isolated_schema.sql:144-152,708-723`.
- **Evidência:** `update_store_min_stock` valida a propriedade da filial, mas não consulta o catálogo central para validar `product_id`. A FK de `store_inventory.product_id` só exige que o produto exista; a política RLS de escrita restringe a filial à empresa do usuário, mas não exige que o produto seja da mesma empresa.
- **Impacto:** um usuário pode associar à filial da própria empresa um produto de outra empresa se conhecer/fornecer seu UUID, contaminando os dados do inventário e permitindo referências cruzadas entre tenants.
- **Correção sugerida:** validar o produto com o catálogo do MS Warehouse antes de inserir/atualizar e, preferencialmente, reforçar a mesma regra no banco com uma relação/constraint que impeça combinações entre empresas. Adicionar teste com produto de outra empresa.

## Pendências de qualidade

- Corrigir a resolução de plugins no comando padrão de lint e configurar os globais do ambiente de testes (`global`) ou usar a API apropriada do Vitest. Revisar o `catch` vazio em `frontend/src/services/reportService.js:143`.
- Avaliar divisão sob demanda do bundle principal do frontend, atualmente acima do limite de aviso do Vite.
- Reexecutar testes de integração de banco depois das correções; a suíte atual não comprova concorrência, idempotência sob falha de rede ou políticas RLS em PostgreSQL real.

## Observação sobre o estado do workspace

O worktree já continha alterações, arquivos novos e exclusões antes desta análise. Nenhum código existente foi alterado; este relatório é o único arquivo criado para a solicitação.
