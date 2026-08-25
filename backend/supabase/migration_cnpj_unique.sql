-- =====================================================================
-- Valida Fácil — garante a constraint unique(cnpj) na tabela companies
--
-- Por que isso pode ser necessário mesmo já tendo "cnpj text unique" no
-- schema.sql: se a tabela "companies" já existia (de uma execução
-- anterior do schema.sql), o "create table if not exists" pula a criação
-- por completo — ele não retroage a estrutura de uma tabela já existente.
-- Rode este script no SQL Editor pra garantir que a constraint existe de
-- fato, independente de quando a tabela foi criada.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'companies_cnpj_key'
  ) then
    alter table companies add constraint companies_cnpj_key unique (cnpj);
  end if;
end $$;

-- Conferir se ficou correta:
-- select conname from pg_constraint where conrelid = 'companies'::regclass;

-- ---------------------------------------------------------------------
-- Opcional (recomendado) — reforça no banco que CNPJ é obrigatório,
-- mesmo além da validação do backend (defesa em profundidade). SÓ rode
-- isso depois de confirmar que nenhuma empresa já cadastrada está com
-- cnpj nulo, senão o comando abaixo vai falhar:
--
--   select id, name from companies where cnpj is null;
--
-- Se a consulta acima não retornar nenhuma linha, pode rodar:
--
--   alter table companies alter column cnpj set not null;
-- ---------------------------------------------------------------------
