-- ==============================================================================
-- Valida Fácil — Reforço de Segurança & RLS (Migration de Produção)
-- Execute este script no SQL Editor do seu projeto Supabase antes de subir o app.
-- ==============================================================================

-- 1. COMPANIES: Apenas administradores podem atualizar dados cadastrais da empresa
drop policy if exists "Usuários atualizam a própria empresa" on companies;
drop policy if exists "Apenas administradores atualizam a própria empresa" on companies;
create policy "Apenas administradores atualizam a própria empresa"
  on companies for update
  using (
    id = public.get_auth_user_company_id()
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

-- Bloqueia exclusão de empresas via cliente comum (apenas service_role pode deletar)
drop policy if exists "Bloquear exclusão de empresas via cliente" on companies;
create policy "Bloquear exclusão de empresas via cliente"
  on companies for delete
  using (false);


-- 2. PROFILES: Usuário só pode atualizar seu próprio perfil, mas NÃO pode alterar seu próprio role nem sua empresa (prevenção de privilege escalation)
drop policy if exists "Usuários atualizam o próprio perfil" on profiles;
create policy "Usuários atualizam o próprio perfil"
  on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    -- Garante que o role e o company_id não foram adulterados diretamente pelo client
    and role = (select p.role from profiles p where p.id = auth.uid())
    and (
      company_id is not distinct from (select p.company_id from profiles p where p.id = auth.uid())
    )
  );

-- Bloqueia deleção direta de perfis pelo cliente
drop policy if exists "Bloquear deleção direta de perfis" on profiles;
create policy "Bloquear deleção direta de perfis"
  on profiles for delete
  using (false);


-- 3. STOCK_MOVEMENTS: Histórico de auditoria imutável (não pode ser alterado nem deletado via client)
drop policy if exists "Movimentações de estoque são imutáveis" on stock_movements;
create policy "Movimentações de estoque são imutáveis"
  on stock_movements for update
  using (false);

drop policy if exists "Movimentações não podem ser excluídas via cliente" on stock_movements;
create policy "Movimentações não podem ser excluídas via cliente"
  on stock_movements for delete
  using (false);
