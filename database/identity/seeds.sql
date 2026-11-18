-- =====================================================================
-- Valida Fácil — Dados de Demonstração / Apresentação (db-identity)
-- =====================================================================

DO $$
DECLARE
    -- Matriz e Filiais da Empresa Principal
    v_comp_matriz UUID := 'a0000000-0000-0000-0000-000000000001';
    v_comp_alvorada UUID := 'a0000000-0000-0000-0000-000000000002';

    -- IDs das Filiais gerenciadas no ms-stores
    v_store_centro UUID := 'c0000000-0000-0000-0000-000000000001';
    v_store_shopping UUID := 'c0000000-0000-0000-0000-000000000002';
    v_store_zonasul UUID := 'c0000000-0000-0000-0000-000000000003';

    -- Hash bcrypt para a senha 'admin123'
    v_pw_hash TEXT := '$2b$12$5hDdalcHgCij03HAALWlr.Y/tpBibyWzXJWrnufKN1HCCZMeedF7u';
BEGIN
    -- 1. Empresas
    INSERT INTO companies (id, name, segment, email, notification_email, phone, cnpj, address, initials)
    VALUES
    (
        v_comp_matriz,
        'Valida Fácil Matriz',
        'Varejo Alimentício & Supermercado',
        'contato@validafacil.com.br',
        'alertas@validafacil.com.br',
        '(86) 3215-9000',
        '12.345.678/0001-90',
        'Av. Frei Serafim, 2500 - Centro, Teresina - PI',
        'VF'
    ) ON CONFLICT (cnpj) DO UPDATE
    SET name = EXCLUDED.name, segment = EXCLUDED.segment, address = EXCLUDED.address;

    INSERT INTO companies (id, name, segment, email, notification_email, phone, cnpj, address, initials)
    VALUES
    (
        v_comp_alvorada,
        'Supermercado Alvorada',
        'Supermercado',
        'contato@alvorada.com.br',
        'estoque@alvorada.com.br',
        '(86) 3221-5050',
        '98.765.432/0001-10',
        'Av. Dom Severino, 1800 - Fátima, Teresina - PI',
        'SA'
    ) ON CONFLICT (cnpj) DO UPDATE
    SET name = EXCLUDED.name, segment = EXCLUDED.segment;

    -- 2. Usuários (Todos com senha 'admin123')
    -- User 1: Carlos Silva - Admin Matriz
    INSERT INTO users (id, email, password_hash, is_active)
    VALUES ('b0000000-0000-0000-0000-000000000001', 'admin@validafacil.com.br', v_pw_hash, TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    INSERT INTO profiles (id, company_id, store_id, full_name, email, role)
    VALUES ('b0000000-0000-0000-0000-000000000001', v_comp_matriz, NULL, 'Carlos Silva (Admin Geral)', 'admin@validafacil.com.br', 'admin')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;

    -- User 2: Mariana Costa - Gerente de Operações
    INSERT INTO users (id, email, password_hash, is_active)
    VALUES ('b0000000-0000-0000-0000-000000000002', 'gerente@validafacil.com.br', v_pw_hash, TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    INSERT INTO profiles (id, company_id, store_id, full_name, email, role)
    VALUES ('b0000000-0000-0000-0000-000000000002', v_comp_matriz, NULL, 'Mariana Costa (Gerente de Operações)', 'gerente@validafacil.com.br', 'gerente')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;

    -- User 3: Roberto Almoxarife - Operador do Armazém Central
    INSERT INTO users (id, email, password_hash, is_active)
    VALUES ('b0000000-0000-0000-0000-000000000003', 'armazem@validafacil.com.br', v_pw_hash, TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    INSERT INTO profiles (id, company_id, store_id, full_name, email, role)
    VALUES ('b0000000-0000-0000-0000-000000000003', v_comp_matriz, NULL, 'Roberto Almoxarife (CD Central)', 'armazem@validafacil.com.br', 'operador')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;

    -- User 4: Juliana Santos - Operadora Filial Centro
    INSERT INTO users (id, email, password_hash, is_active)
    VALUES ('b0000000-0000-0000-0000-000000000004', 'loja.centro@validafacil.com.br', v_pw_hash, TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    INSERT INTO profiles (id, company_id, store_id, full_name, email, role)
    VALUES ('b0000000-0000-0000-0000-000000000004', v_comp_matriz, v_store_centro, 'Juliana Santos (Filial Centro)', 'loja.centro@validafacil.com.br', 'operador')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, store_id = EXCLUDED.store_id;

    -- User 5: Lucas Mendes - Operador Filial Shopping
    INSERT INTO users (id, email, password_hash, is_active)
    VALUES ('b0000000-0000-0000-0000-000000000005', 'loja.shopping@validafacil.com.br', v_pw_hash, TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    INSERT INTO profiles (id, company_id, store_id, full_name, email, role)
    VALUES ('b0000000-0000-0000-0000-000000000005', v_comp_matriz, v_store_shopping, 'Lucas Mendes (Filial Shopping)', 'loja.shopping@validafacil.com.br', 'operador')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, store_id = EXCLUDED.store_id;

    -- User 6: Fernanda Rocha - Operadora Filial Zona Sul
    INSERT INTO users (id, email, password_hash, is_active)
    VALUES ('b0000000-0000-0000-0000-000000000006', 'loja.zonasul@validafacil.com.br', v_pw_hash, TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    INSERT INTO profiles (id, company_id, store_id, full_name, email, role)
    VALUES ('b0000000-0000-0000-0000-000000000006', v_comp_matriz, v_store_zonasul, 'Fernanda Rocha (Filial Zona Sul)', 'loja.zonasul@validafacil.com.br', 'operador')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role, store_id = EXCLUDED.store_id;

    -- User 7: Ana Beatriz - Admin da Empresa 2 (Demonstração de Multi-Tenancy)
    INSERT INTO users (id, email, password_hash, is_active)
    VALUES ('b0000000-0000-0000-0000-000000000007', 'admin@alvorada.com.br', v_pw_hash, TRUE)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

    INSERT INTO profiles (id, company_id, store_id, full_name, email, role)
    VALUES ('b0000000-0000-0000-0000-000000000007', v_comp_alvorada, NULL, 'Ana Beatriz (Admin Alvorada)', 'admin@alvorada.com.br', 'admin')
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role;
END $$;
