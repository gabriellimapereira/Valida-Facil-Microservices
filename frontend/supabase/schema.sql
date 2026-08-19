-- =====================================================================
-- EstoquePro — schema inicial para Supabase (PostgreSQL)
-- Execute no SQL Editor do seu projeto Supabase.
-- =====================================================================

create extension if not exists "uuid-ossp";

-- Empresas (multi-tenant: cada linha é uma empresa cliente do sistema)
create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  segment text,
  email text,
  notification_email text,
  phone text,
  cnpj text,
  address text,
  initials text,
  created_at timestamptz not null default now()
);

-- Categorias de produto (perecível, moda, livros, eletrônicos, outros...)
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

-- Produtos
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references companies(id) on delete cascade,
  code text not null,
  name text not null,
  category text not null references categories(id),
  price numeric(12,2) not null default 0,
  quantity integer not null default 0,
  min_stock integer not null default 0,
  expiry date,
  supplier text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);

create index if not exists idx_products_company on products(company_id);
create index if not exists idx_products_expiry on products(expiry);
create index if not exists idx_products_category on products(category);

-- Perfis de usuário, ligando auth.users a uma empresa (multi-empresa)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  full_name text,
  created_at timestamptz not null default now()
);

-- Trigger simples para manter updated_at em dia
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

-- =====================================================================
-- Row Level Security (RLS) — cada empresa só acessa seus próprios dados
-- =====================================================================

alter table companies enable row level security;
alter table products enable row level security;
alter table profiles enable row level security;

create policy "Usuários veem a própria empresa"
  on companies for select
  using (id in (select company_id from profiles where profiles.id = auth.uid()));

create policy "Usuários atualizam a própria empresa"
  on companies for update
  using (id in (select company_id from profiles where profiles.id = auth.uid()));

create policy "Usuários veem produtos da própria empresa"
  on products for select
  using (company_id in (select company_id from profiles where profiles.id = auth.uid()));

create policy "Usuários gerenciam produtos da própria empresa"
  on products for all
  using (company_id in (select company_id from profiles where profiles.id = auth.uid()))
  with check (company_id in (select company_id from profiles where profiles.id = auth.uid()));

create policy "Usuários veem o próprio perfil"
  on profiles for select
  using (id = auth.uid());
