-- ==============================================================================
-- Valida Fácil — Expansão: Armazém Central, Lojas Filiais e Requisições
-- ==============================================================================

-- 1. Tabela de Lojas Filiais
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

-- 2. Vínculo de perfil com Loja (se for operador de filial)
alter table public.profiles 
  add column if not exists store_id uuid references public.stores(id) on delete set null;

-- 3. Estoque Local da Filial
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

-- 4. Tabela de Requisições de Reposição (Loja -> Armazém)
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

-- 5. Itens da Requisição
create table if not exists public.requisition_items (
  id uuid primary key default uuid_generate_v4(),
  requisition_id uuid not null references public.requisitions(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_requested integer not null check (quantity_requested > 0 and quantity_requested <= 1000000),
  quantity_approved integer default null check (quantity_approved is null or (quantity_approved >= 0 and quantity_approved <= 1000000)),
  unique (requisition_id, product_id)
);

create index if not exists idx_req_items_requisition on public.requisition_items(requisition_id);

-- 6. Trigger para updated_at em requisitions
drop trigger if exists trg_requisitions_updated_at on public.requisitions;
create trigger trg_requisitions_updated_at
  before update on public.requisitions
  for each row execute procedure set_updated_at();

-- 7. Função Atômica RPC para Efetivar Recebimento de Requisição (Transferência Armazém -> Loja)
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

  -- Processa cada item da requisição
  for v_item in (select * from public.requisition_items where requisition_id = p_requisition_id) loop
    v_transfer_qty := coalesce(v_item.quantity_approved, v_item.quantity_requested);

    if v_transfer_qty > 0 then
      -- Verifica saldo do armazém central
      select quantity into v_current_central_qty
      from public.products
      where id = v_item.product_id;

      if v_current_central_qty < v_transfer_qty then
        raise exception 'Saldo insuficiente no Armazém Central para o produto % (atual: %, solicitado: %).', 
          v_item.product_id, v_current_central_qty, v_transfer_qty;
      end if;

      -- Deduz do Armazém Central
      update public.products
      set quantity = quantity - v_transfer_qty
      where id = v_item.product_id;

      -- Registra saída no histórico do armazém
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

      -- Credita no estoque local da Loja Filial (upsert)
      insert into public.store_inventory (store_id, product_id, quantity, updated_at)
      values (v_req.store_id, v_item.product_id, v_transfer_qty, now())
      on conflict (store_id, product_id) do update
      set quantity = store_inventory.quantity + excluded.quantity,
          updated_at = now();
    end if;
  end loop;

  -- Atualiza status da requisição para recebida
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

-- 8. Row Level Security (RLS) para os novos recursos
alter table public.stores enable row level security;
alter table public.store_inventory enable row level security;
alter table public.requisitions enable row level security;
alter table public.requisition_items enable row level security;

-- Policies Stores
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

-- Policies Store Inventory
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

-- Policies Requisitions
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

-- Policies Requisition Items
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
