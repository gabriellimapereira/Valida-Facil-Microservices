-- =====================================================================
-- Valida Fácil — Microservice Stores & Requisitions (db-stores)
-- Banco de Dados: valida_stores
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Lojas Filiais
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL, -- Referência lógica ao tenant (sem FK física para db-identity)
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_stores_company
    ON stores (company_id);

-- 2. Estoque Local da Filial
CREATE TABLE IF NOT EXISTS store_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    company_id UUID NOT NULL,
    product_id UUID NOT NULL, -- Referência lógica ao produto (sem FK física para db-warehouse)
    quantity INTEGER NOT NULL DEFAULT 0,
    min_stock INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_store_inventory_company
    ON store_inventory (company_id, store_id);

-- 3. Movimentações Locais na Filial
CREATE TABLE IF NOT EXISTS store_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    changed_by UUID,
    movement_type TEXT NOT NULL, -- 'entrada', 'saida', 'ajuste', 'recebimento'
    quantity_delta INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reason TEXT,
    requisition_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_movements_store
    ON store_movements (store_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ms_store_movements_unique_receipt
    ON store_movements (requisition_id, product_id)
    WHERE requisition_id IS NOT NULL;

-- 4. Requisições entre Filial e Armazém
CREATE TABLE IF NOT EXISTS requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'rejeitada', 'despachada', 'recebida', 'cancelada')),
    notes TEXT,
    requested_by UUID,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dispatched_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_requisitions_company_store
    ON requisitions (company_id, store_id, created_at DESC);

-- 5. Itens da Requisição
CREATE TABLE IF NOT EXISTS requisition_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    quantity_requested INTEGER NOT NULL,
    quantity_approved INTEGER,
    quantity_fulfilled INTEGER NOT NULL DEFAULT 0,
    UNIQUE (requisition_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_requisition_items_req
    ON requisition_items (requisition_id);

-- 6. Funções Atômicas Locais da Filial
CREATE OR REPLACE FUNCTION store_inventory_movement(
    p_store_id UUID,
    p_product_id UUID,
    p_quantity_delta INTEGER,
    p_note TEXT DEFAULT NULL,
    p_changed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_company_id UUID;
    v_prev_qty INTEGER := 0;
    v_new_qty INTEGER;
    v_inv_id UUID;
BEGIN
    IF p_quantity_delta = 0 THEN
        RAISE EXCEPTION 'A variação de quantidade não pode ser zero.';
    END IF;

    SELECT company_id INTO v_company_id
    FROM stores
    WHERE id = p_store_id;

    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Filial não encontrada.';
    END IF;

    SELECT id, quantity INTO v_inv_id, v_prev_qty
    FROM store_inventory
    WHERE store_id = p_store_id AND product_id = p_product_id
    FOR UPDATE;

    v_prev_qty := COALESCE(v_prev_qty, 0);
    v_new_qty := v_prev_qty + p_quantity_delta;

    IF v_new_qty < 0 THEN
        RAISE EXCEPTION 'Saldo insuficiente na filial (atual: %, tentativa: %).', v_prev_qty, p_quantity_delta;
    END IF;

    INSERT INTO store_inventory (store_id, company_id, product_id, quantity, updated_at)
    VALUES (p_store_id, v_company_id, p_product_id, v_new_qty, NOW())
    ON CONFLICT (store_id, product_id) DO UPDATE
    SET quantity = v_new_qty,
        updated_at = NOW();

    INSERT INTO store_movements (
        company_id, store_id, product_id, changed_by, movement_type, quantity_delta, previous_quantity, new_quantity, reason
    )
    VALUES (
        v_company_id,
        p_store_id,
        p_product_id,
        p_changed_by,
        CASE WHEN p_quantity_delta > 0 THEN 'entrada' ELSE 'saida' END,
        p_quantity_delta,
        v_prev_qty,
        v_new_qty,
        p_note
    );

    RETURN jsonb_build_object(
        'store_id', p_store_id,
        'product_id', p_product_id,
        'previous_quantity', v_prev_qty,
        'new_quantity', v_new_qty
    );
END;
$$;

CREATE OR REPLACE FUNCTION receive_requisition_store(
    p_requisition_id UUID,
    p_changed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_req RECORD;
    v_item RECORD;
    v_prev_qty INTEGER;
    v_new_qty INTEGER;
    v_qty INTEGER;
BEGIN
    SELECT * INTO v_req
    FROM requisitions
    WHERE id = p_requisition_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Requisição não encontrada.';
    END IF;

    IF v_req.status = 'recebida' THEN
        RETURN jsonb_build_object(
            'requisition_id', p_requisition_id,
            'status', 'recebida',
            'store_id', v_req.store_id,
            'already_received', true
        );
    END IF;

    IF v_req.status <> 'despachada' THEN
        RAISE EXCEPTION 'Apenas requisições com status "despachada" podem ser recebidas (status atual: %).', v_req.status;
    END IF;

    UPDATE requisitions
    SET status = 'recebida',
        received_at = NOW(),
        updated_at = NOW()
    WHERE id = p_requisition_id;

    FOR v_item IN (SELECT * FROM requisition_items WHERE requisition_id = p_requisition_id) LOOP
        v_qty := COALESCE(v_item.quantity_approved, v_item.quantity_requested);
        IF v_qty > 0 THEN
            SELECT COALESCE(quantity, 0) INTO v_prev_qty
            FROM store_inventory
            WHERE store_id = v_req.store_id AND product_id = v_item.product_id
            FOR UPDATE;

            v_prev_qty := COALESCE(v_prev_qty, 0);
            v_new_qty := v_prev_qty + v_qty;

            INSERT INTO store_inventory (store_id, company_id, product_id, quantity, updated_at)
            VALUES (v_req.store_id, v_req.company_id, v_item.product_id, v_new_qty, NOW())
            ON CONFLICT (store_id, product_id) DO UPDATE
            SET quantity = v_new_qty,
                updated_at = NOW();

            INSERT INTO store_movements (
                company_id, store_id, product_id, changed_by, movement_type, quantity_delta, previous_quantity, new_quantity, reason, requisition_id
            )
            VALUES (
                v_req.company_id,
                v_req.store_id,
                v_item.product_id,
                p_changed_by,
                'recebimento',
                v_qty,
                v_prev_qty,
                v_new_qty,
                'Recebimento da Requisição #' || SUBSTR(v_req.id::text, 1, 8),
                p_requisition_id
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'requisition_id', p_requisition_id,
        'status', 'recebida',
        'store_id', v_req.store_id
    );
END;
$$;

ALTER TABLE requisitions ADD COLUMN IF NOT EXISTS requested_by UUID;
UPDATE requisitions SET requested_by = created_by WHERE requested_by IS NULL AND created_by IS NOT NULL;
