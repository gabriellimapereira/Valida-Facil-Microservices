-- =====================================================================
-- Valida Fácil — Microservice Identity & Tenants (db-identity)
-- Banco de Dados: valida_identity
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Empresas
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    segment TEXT,
    email TEXT,
    notification_email TEXT NOT NULL,
    phone TEXT NOT NULL,
    cnpj TEXT NOT NULL UNIQUE,
    address TEXT,
    initials TEXT NOT NULL,
    logo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Usuários (Auth Nativo)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Perfis dos Usuários
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    store_id UUID, -- Referência lógica à loja gerenciada no ms-stores (sem FK cruzada entre bancos)
    full_name TEXT,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'operador', -- 'admin', 'gerente', 'operador'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_one_admin_per_company
    ON profiles (company_id)
    WHERE (role = 'admin');

CREATE INDEX IF NOT EXISTS idx_identity_profiles_company
    ON profiles (company_id);

CREATE INDEX IF NOT EXISTS idx_identity_profiles_store
    ON profiles (store_id);

-- Single-use invitations and password-reset tokens (only token hashes are persisted).
CREATE TABLE IF NOT EXISTS auth_action_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('invitation', 'password_reset')),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_auth_action_tokens_user
    ON auth_action_tokens (user_id, purpose);

-- 4. Dados Iniciais de Demonstração (Admin Padrão: admin@validafacil.com.br / admin123)
DO $$
DECLARE
    v_company_id UUID := 'a0000000-0000-0000-0000-000000000001';
    v_user_id UUID := 'b0000000-0000-0000-0000-000000000001';
BEGIN
    INSERT INTO companies (id, name, segment, email, notification_email, phone, cnpj, initials)
    VALUES (
        v_company_id,
        'Valida Fácil Matriz',
        'Varejo Alimentício',
        'admin@validafacil.com.br',
        'admin@validafacil.com.br',
        '(86) 99999-9999',
        '12.345.678/0001-90',
        'VF'
    ) ON CONFLICT (cnpj) DO NOTHING;

    INSERT INTO users (id, email, password_hash, is_active)
    VALUES (
        v_user_id,
        'admin@validafacil.com.br',
        '$2b$12$5hDdalcHgCij03HAALWlr.Y/tpBibyWzXJWrnufKN1HCCZMeedF7u',
        TRUE
    ) ON CONFLICT (email) DO NOTHING;

    INSERT INTO profiles (id, company_id, full_name, email, role)
    VALUES (
        v_user_id,
        v_company_id,
        'Administrador Valida Fácil',
        'admin@validafacil.com.br',
        'admin'
    ) ON CONFLICT (id) DO NOTHING;
END $$;
