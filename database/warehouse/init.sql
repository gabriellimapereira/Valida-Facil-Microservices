-- =====================================================================
-- Valida Fácil — Microservice Warehouse & Stock (db-warehouse)
-- Banco de Dados: valida_warehouse
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Categorias do Catálogo Central
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    has_expiry BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO categories (id, label, has_expiry) VALUES
    ('perecivel', 'Perecível (Alimentos)', TRUE),
    ('moda', 'Vestuário & Moda', FALSE),
    ('livros', 'Livros', FALSE),
    ('eletronicos', 'Eletrônicos', FALSE),
    ('outros', 'Outros', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2. Produtos do Armazém Central (CD)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL, -- Referência lógica ao tenant (sem FK física cruzada para db-identity)
    code TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL REFERENCES categories(id),
    price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    quantity INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0,
    expiry DATE,
    supplier TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_products_company
    ON products (company_id);

CREATE INDEX IF NOT EXISTS idx_warehouse_products_expiry
    ON products (company_id, expiry ASC)
    WHERE expiry IS NOT NULL;

-- 3. Movimentações de Estoque no Armazém Central
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    changed_by UUID,
    movement_type TEXT NOT NULL, -- 'entrada', 'saida', 'ajuste'
    quantity_delta INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_movements_company
    ON stock_movements (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_warehouse_movements_product
    ON stock_movements (product_id, created_at DESC);

-- 4. Controle de Despachos Idempotentes entre Serviços
CREATE TABLE IF NOT EXISTS warehouse_dispatches (
    requisition_id UUID PRIMARY KEY,
    company_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'dispatched', 'released')),
    allocated_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    dispatched_at_date TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_dispatches_company
    ON warehouse_dispatches (company_id, created_at DESC);

-- 5. Função Atômica de Aplicação de Movimentação no Estoque Central
CREATE OR REPLACE FUNCTION apply_stock_movement(
    p_product_id UUID,
    p_movement_type TEXT,
    p_quantity_delta INTEGER,
    p_note TEXT DEFAULT NULL,
    p_changed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_company_id UUID;
    v_current_qty INTEGER;
    v_min_stock INTEGER;
    v_new_qty INTEGER;
    v_product_name TEXT;
BEGIN
    IF p_movement_type NOT IN ('entrada', 'saida', 'ajuste') THEN
        RAISE EXCEPTION 'Tipo de movimentação inválido: %', p_movement_type;
    END IF;

    SELECT company_id, quantity, min_stock, name
      INTO v_company_id, v_current_qty, v_min_stock, v_product_name
    FROM products
    WHERE id = p_product_id
    FOR UPDATE;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Produto não encontrado.';
    END IF;

    v_new_qty := v_current_qty + p_quantity_delta;

    IF v_new_qty < 0 THEN
        RAISE EXCEPTION 'Quantidade insuficiente em estoque para essa movimentação (atual: %, tentativa: %).', v_current_qty, p_quantity_delta;
    END IF;

    UPDATE products
    SET quantity = v_new_qty,
        updated_at = NOW()
    WHERE id = p_product_id;

    INSERT INTO stock_movements (
        company_id, product_id, changed_by, movement_type, quantity_delta, previous_quantity, new_quantity, note
    )
    VALUES (
        v_company_id, p_product_id, p_changed_by, p_movement_type, p_quantity_delta, v_current_qty, v_new_qty, p_note
    );

    RETURN jsonb_build_object(
        'company_id', v_company_id,
        'product_id', p_product_id,
        'product_name', v_product_name,
        'previous_quantity', v_current_qty,
        'new_quantity', v_new_qty,
        'min_stock', v_min_stock,
        'crossed_low_stock', (v_current_qty > v_min_stock AND v_new_qty <= v_min_stock)
    );
END;
$$;
