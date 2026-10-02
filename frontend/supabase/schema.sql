-- =====================================================================
-- Valida Fácil — Schema Limpo & Consolidado do Banco de Dados (PostgreSQL / Supabase)
--
-- Para Resetar e Recriar o Banco do Zero:
-- Execute este script no SQL Editor do seu Dashboard no Supabase.
-- =====================================================================

-- 1. Limpeza opcional (Descomente se desejar apagar tudo e recriar do zero):
/*
drop table if exists stock_movements cascade;
drop table if exists products cascade;
drop table if exists profiles cascade;
drop table if exists companies cascade;
drop table if exists categories cascade;
*/

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- 2. Tabela de Categorias
-- ---------------------------------------------------------------------
create table if not exists categories (
  id text primary key,
  label text not null,
  has_expiry boolean not null default false
);

insert into categories (id, label, has_expiry) values
  ('perecivel', 'Perecível (Alimentos)', true),
  ('moda', 'Vestuário & Moda', false),
  ('livros', 'Livros', false),
  ('eletronicos', 'Eletrônicos', false),
  ('outros', 'Outros', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 3. Tabela de Empresas (Multi-tenant)
-- ---------------------------------------------------------------------
create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  segment text,
  email text,
  notification_email text not null,
  phone text not null,
  cnpj text not null unique,
  address text,
  initials text not null,
  logo_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Tabela de Perfis de Usuários (RBAC: admin vs operador)
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  full_name text,
  email text,
  role text not null default 'operador', -- 'admin' ou 'operador'
  created_at timestamptz not null default now()
);

-- Garante que cada empresa possua NO MÁXIMO 1 usuário Administrador (o Dono/Proprietário que a cadastrou)
create unique index if not exists idx_one_admin_per_company 
  on profiles (company_id) 
  where (role = 'admin');


-- ---------------------------------------------------------------------
-- 5. Tabela de Produtos
-- ---------------------------------------------------------------------
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null references categories(id),
  price numeric(12,2) not null default 0 check (price >= 0 and price <= 1000000),
  quantity integer not null default 0 check (quantity >= 0 and quantity <= 1000000),
  min_stock integer not null default 0 check (min_stock >= 0 and min_stock <= 1000000),
  expiry date,
  supplier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create index if not exists idx_products_company on products(company_id);
create index if not exists idx_products_expiry on products(expiry);
create index if not exists idx_products_category on products(category);

-- ---------------------------------------------------------------------
-- 6. Tabela de Auditoria e Movimentações de Estoque
-- ---------------------------------------------------------------------
create table if not exists stock_movements (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  changed_by uuid references profiles(id) on delete set null,
  movement_type text not null check (movement_type in ('entrada', 'saida', 'ajuste')),
  quantity_delta integer not null check (quantity_delta >= -1000000 and quantity_delta <= 1000000 and quantity_delta <> 0),
  previous_quantity integer,
  new_quantity integer,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_movements_company on stock_movements(company_id);
create index if not exists idx_movements_product on stock_movements(product_id);

-- ---------------------------------------------------------------------
-- 7. Triggers de Atualização e Criação Automática de Perfil
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at
  before update on products
  for each row execute procedure set_updated_at();

-- Trigger para criar perfil automaticamente no Auth Sign-up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    'operador'
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, profiles.full_name);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------
-- 8. Função Atômica RPC de Movimentação de Estoque
-- ---------------------------------------------------------------------
create or replace function apply_stock_movement(
  p_product_id uuid,
  p_movement_type text,
  p_quantity_delta integer,
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_company_id uuid;
  v_current_qty integer;
  v_min_stock integer;
  v_new_qty integer;
  v_product_name text;
  v_notification_email text;
begin
  if p_movement_type not in ('entrada', 'saida', 'ajuste') then
    raise exception 'Tipo de movimentação inválido: %', p_movement_type;
  end if;

  select company_id, quantity, min_stock, name
    into v_company_id, v_current_qty, v_min_stock, v_product_name
  from products
  where id = p_product_id;

  if v_company_id is null then
    raise exception 'Produto não encontrado ou sem permissão de acesso.';
  end if;

  v_new_qty := v_current_qty + p_quantity_delta;

  if v_new_qty < 0 then
    raise exception 'Quantidade insuficiente em estoque para essa movimentação (atual: %, tentativa: %).', v_current_qty, p_quantity_delta;
  end if;

  if v_new_qty > 1000000 then
    raise exception 'A quantidade resultante de estoque (%) ultrapassa o limite permitido de 1.000.000.', v_new_qty;
  end if;

  update products set quantity = v_new_qty where id = p_product_id;

  insert into stock_movements (
    company_id, product_id, changed_by, movement_type, quantity_delta, previous_quantity, new_quantity, note
  )
  values (
    v_company_id, p_product_id, auth.uid(), p_movement_type, p_quantity_delta, v_current_qty, v_new_qty, p_note
  );

  select notification_email into v_notification_email
  from companies where id = v_company_id;

  return jsonb_build_object(
    'company_id', v_company_id,
    'product_id', p_product_id,
    'product_name', v_product_name,
    'previous_quantity', v_current_qty,
    'new_quantity', v_new_qty,
    'min_stock', v_min_stock,
    'crossed_low_stock', (v_current_qty > v_min_stock and v_new_qty <= v_min_stock),
    'notification_email', v_notification_email
  );
end;
$$;

grant execute on function apply_stock_movement(uuid, text, integer, text) to authenticated;

-- Helper function para obter o company_id do usuário logado sem recursão de RLS
create or replace function public.get_auth_user_company_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

grant execute on function public.get_auth_user_company_id() to authenticated;

-- ---------------------------------------------------------------------
-- 9. Row Level Security (RLS) - Isolamento por Empresa
-- ---------------------------------------------------------------------
alter table companies enable row level security;
alter table products enable row level security;
alter table profiles enable row level security;
alter table stock_movements enable row level security;

-- Policies para Companies
drop policy if exists "Usuários veem a própria empresa" on companies;
create policy "Usuários veem a própria empresa"
  on companies for select
  using (id = public.get_auth_user_company_id());

drop policy if exists "Usuários atualizam a própria empresa" on companies;
create policy "Usuários atualizam a própria empresa"
drop policy if exists "Apenas administradores atualizam a própria empresa" on companies;
create policy "Apenas administradores atualizam a própria empresa"
  on companies for update
  using (id = public.get_auth_user_company_id());
  using (
    id = public.get_auth_user_company_id()
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid()
      and profiles.role = 'admin'
    )
  );

drop policy if exists "Bloquear exclusão de empresas via cliente" on companies;
create policy "Bloquear exclusão de empresas via cliente"
  on companies for delete
  using (false);

-- Policies para Products
drop policy if exists "Usuários veem produtos da própria empresa" on products;
create policy "Usuários veem produtos da própria empresa"
  on products for select
  using (company_id = public.get_auth_user_company_id());

drop policy if exists "Usuários gerenciam produtos da própria empresa" on products;
create policy "Usuários gerenciam produtos da própria empresa"
  on products for all
  using (company_id = public.get_auth_user_company_id())
  with check (company_id = public.get_auth_user_company_id());

-- Policies para Profiles
drop policy if exists "Usuários veem perfis da própria empresa" on profiles;
create policy "Usuários veem perfis da própria empresa"
  on profiles for select
  using (
    id = auth.uid() 
    or (company_id is not null and company_id = public.get_auth_user_company_id())
  );

-- Previne privilege escalation: usuário só atualiza seu próprio perfil, mas NÃO pode alterar seu próprio role nem sua empresa
drop policy if exists "Usuários atualizam o próprio perfil" on profiles;
create policy "Usuários atualizam o próprio perfil"
  on profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from profiles p where p.id = auth.uid())
    and (
      company_id is not distinct from (select p.company_id from profiles p where p.id = auth.uid())
    )
  );

drop policy if exists "Bloquear deleção direta de perfis" on profiles;
create policy "Bloquear deleção direta de perfis"
  on profiles for delete
  using (false);

-- Policies para Stock Movements
drop policy if exists "Usuários veem movimentações da própria empresa" on stock_movements;
create policy "Usuários veem movimentações da própria empresa"
  on stock_movements for select
  using (company_id = public.get_auth_user_company_id());

drop policy if exists "Usuários registram movimentações na própria empresa" on stock_movements;
create policy "Usuários registram movimentações na própria empresa"
  on stock_movements for insert
  with check (company_id = public.get_auth_user_company_id());

-- Histórico de auditoria imutável (não pode ser alterado nem deletado via client)
drop policy if exists "Movimentações de estoque são imutáveis" on stock_movements;
create policy "Movimentações de estoque são imutáveis"
  on stock_movements for update
  using (false);

drop policy if exists "Movimentações não podem ser excluídas via cliente" on stock_movements;
create policy "Movimentações não podem ser excluídas via cliente"
  on stock_movements for delete
  using (false);

-- ---------------------------------------------------------------------
-- 10. Expansão: Lojas Filiais e Requisições (Modelo Armazém Central)
-- ---------------------------------------------------------------------
create table if not exists public.stores (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  address text,
  phone text,
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create index if not exists idx_stores_company on public.stores(company_id);

alter table public.profiles 
  add column if not exists store_id uuid references public.stores(id) on delete set null;

create table if not exists public.store_inventory (
  id uuid primary key default uuid_generate_v4(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0 and quantity <= 1000000),
  min_stock integer not null default 0 check (min_stock >= 0 and min_stock <= 1000000),
  updated_at timestamptz not null default now(),
  unique (store_id, product_id)
);

create index if not exists idx_store_inventory_store on public.store_inventory(store_id);
create index if not exists idx_store_inventory_product on public.store_inventory(product_id);

create table if not exists public.requisitions (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'despachada', 'recebida', 'cancelada')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_requisitions_company on public.requisitions(company_id);
create index if not exists idx_requisitions_store on public.requisitions(store_id);

create table if not exists public.requisition_items (
  id uuid primary key default uuid_generate_v4(),
  requisition_id uuid not null references public.requisitions(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_requested integer not null check (quantity_requested > 0 and quantity_requested <= 1000000),
  quantity_approved integer default null check (quantity_approved is null or (quantity_approved >= 0 and quantity_approved <= 1000000)),
  unique (requisition_id, product_id)
);

create index if not exists idx_req_items_requisition on public.requisition_items(requisition_id);

drop trigger if exists trg_requisitions_updated_at on public.requisitions;
create trigger trg_requisitions_updated_at
  before update on public.requisitions
  for each row execute procedure set_updated_at();

create or replace function public.fulfill_requisition(
  p_requisition_id uuid
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_req record;
  v_item record;
  v_current_central_qty integer;
  v_transfer_qty integer;
begin
  select * into v_req
  from public.requisitions
  where id = p_requisition_id;

  if not found then
    raise exception 'Requisição não encontrada ou sem permissão de acesso.';
  end if;

  if v_req.status not in ('aprovada', 'despachada') then
    raise exception 'Apenas requisições aprovadas ou despachadas podem ser recebidas (status atual: %).', v_req.status;
  end if;

  for v_item in (select * from public.requisition_items where requisition_id = p_requisition_id) loop
    v_transfer_qty := coalesce(v_item.quantity_approved, v_item.quantity_requested);

    if v_transfer_qty > 0 then
      select quantity into v_current_central_qty
      from public.products
      where id = v_item.product_id;

      if v_current_central_qty < v_transfer_qty then
        raise exception 'Saldo insuficiente no Armazém Central para o produto % (atual: %, solicitado: %).', 
          v_item.product_id, v_current_central_qty, v_transfer_qty;
      end if;

      update public.products
      set quantity = quantity - v_transfer_qty
      where id = v_item.product_id;

      insert into public.stock_movements (
        company_id, product_id, changed_by, movement_type, quantity_delta, previous_quantity, new_quantity, note
      )
      values (
        v_req.company_id, 
        v_item.product_id, 
        auth.uid(), 
        'saida', 
        -v_transfer_qty, 
        v_current_central_qty, 
        v_current_central_qty - v_transfer_qty, 
        'Transferência para Filial (Req #' || substr(v_req.id::text, 1, 8) || ')'
      );

      insert into public.store_inventory (store_id, product_id, quantity, updated_at)
      values (v_req.store_id, v_item.product_id, v_transfer_qty, now())
      on conflict (store_id, product_id) do update
      set quantity = store_inventory.quantity + excluded.quantity,
          updated_at = now();
    end if;
  end loop;

  update public.requisitions
  set status = 'recebida',
      updated_at = now()
  where id = p_requisition_id;

  return jsonb_build_object(
    'requisition_id', p_requisition_id,
    'status', 'recebida',
    'store_id', v_req.store_id
  );
end;
$$;

grant execute on function public.fulfill_requisition(uuid) to authenticated;

alter table public.stores enable row level security;
alter table public.store_inventory enable row level security;
alter table public.requisitions enable row level security;
alter table public.requisition_items enable row level security;

drop policy if exists "Usuários veem lojas da própria empresa" on public.stores;
create policy "Usuários veem lojas da própria empresa"
  on public.stores for select
  using (company_id = public.get_auth_user_company_id());

drop policy if exists "Apenas administradores gerenciam lojas" on public.stores;
create policy "Apenas administradores gerenciam lojas"
  on public.stores for all
  using (
    company_id = public.get_auth_user_company_id()
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  )
  with check (
    company_id = public.get_auth_user_company_id()
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

drop policy if exists "Usuários veem estoque de lojas da própria empresa" on public.store_inventory;
create policy "Usuários veem estoque de lojas da própria empresa"
  on public.store_inventory for select
  using (
    exists (
      select 1 from public.stores s 
      where s.id = store_inventory.store_id 
      and s.company_id = public.get_auth_user_company_id()
    )
  );

drop policy if exists "Usuários gerenciam estoque de lojas da própria empresa" on public.store_inventory;
create policy "Usuários gerenciam estoque de lojas da própria empresa"
  on public.store_inventory for all
  using (
    exists (
      select 1 from public.stores s 
      where s.id = store_inventory.store_id 
      and s.company_id = public.get_auth_user_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.stores s 
      where s.id = store_inventory.store_id 
      and s.company_id = public.get_auth_user_company_id()
    )
  );

drop policy if exists "Usuários veem requisições da própria empresa" on public.requisitions;
create policy "Usuários veem requisições da própria empresa"
  on public.requisitions for select
  using (company_id = public.get_auth_user_company_id());

drop policy if exists "Usuários criam requisições na própria empresa" on public.requisitions;
create policy "Usuários criam requisições na própria empresa"
  on public.requisitions for insert
  with check (company_id = public.get_auth_user_company_id());

drop policy if exists "Usuários atualizam requisições da própria empresa" on public.requisitions;
create policy "Usuários atualizam requisições da própria empresa"
  on public.requisitions for update
  using (company_id = public.get_auth_user_company_id());

drop policy if exists "Usuários veem itens de requisições da própria empresa" on public.requisition_items;
create policy "Usuários veem itens de requisições da própria empresa"
  on public.requisition_items for select
  using (
    exists (
      select 1 from public.requisitions r
      where r.id = requisition_items.requisition_id
      and r.company_id = public.get_auth_user_company_id()
    )
  );

drop policy if exists "Usuários gerenciam itens de requisições da própria empresa" on public.requisition_items;
create policy "Usuários gerenciam itens de requisições da própria empresa"
  on public.requisition_items for all
  using (
    exists (
      select 1 from public.requisitions r
      where r.id = requisition_items.requisition_id
      and r.company_id = public.get_auth_user_company_id()
    )
  )
  with check (
    exists (
      select 1 from public.requisitions r
      where r.id = requisition_items.requisition_id
      and r.company_id = public.get_auth_user_company_id()
    )
  );
