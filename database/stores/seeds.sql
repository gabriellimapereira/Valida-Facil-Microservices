-- =====================================================================
-- Valida Fácil — Dados de Demonstração / Apresentação (db-stores)
-- =====================================================================

DO $$
DECLARE
    v_comp_matriz UUID := 'a0000000-0000-0000-0000-000000000001';

    -- IDs das Filiais
    v_store_centro UUID := 'c0000000-0000-0000-0000-000000000001';
    v_store_shopping UUID := 'c0000000-0000-0000-0000-000000000002';
    v_store_zonasul UUID := 'c0000000-0000-0000-0000-000000000003';

    -- Usuários das Lojas
    v_user_centro UUID := 'b0000000-0000-0000-0000-000000000004';
    v_user_shopping UUID := 'b0000000-0000-0000-0000-000000000005';
    v_user_zonasul UUID := 'b0000000-0000-0000-0000-000000000006';

    -- Referências lógicas a produtos do ms-warehouse
    v_p_iogurte UUID := 'd0000000-0000-0000-0000-000000000001';
    v_p_leite UUID := 'd0000000-0000-0000-0000-000000000002';
    v_p_queijo UUID := 'd0000000-0000-0000-0000-000000000003';
    v_p_presunto UUID := 'd0000000-0000-0000-0000-000000000004';
    v_p_pao UUID := 'd0000000-0000-0000-0000-000000000006';
    v_p_arroz UUID := 'd0000000-0000-0000-0000-000000000009';
    v_p_feijao UUID := 'd0000000-0000-0000-0000-000000000010';
    v_p_cafe UUID := 'd0000000-0000-0000-0000-000000000011';
    v_p_azeite UUID := 'd0000000-0000-0000-0000-000000000012';
    v_p_molho UUID := 'd0000000-0000-0000-0000-000000000013';
    v_p_oleo UUID := 'd0000000-0000-0000-0000-000000000014';
BEGIN
    -- 1. Lojas Filiais
    INSERT INTO stores (id, company_id, code, name, address, phone)
    VALUES
    (
        v_store_centro,
        v_comp_matriz,
        'FIL-01',
        'Filial Centro - Av. Principal',
        'Av. Frei Serafim, 1200 - Centro, Teresina - PI',
        '(86) 3211-1001'
    ),
    (
        v_store_shopping,
        v_comp_matriz,
        'FIL-02',
        'Filial Shopping Rio Poty',
        'Av. Marechal Castelo Branco, 800 - Piso L2, Teresina - PI',
        '(86) 3222-2002'
    ),
    (
        v_store_zonasul,
        v_comp_matriz,
        'FIL-03',
        'Filial Zona Sul - Três Andares',
        'Rua das Flores, 450 - Três Andares, Teresina - PI',
        '(86) 3233-3003'
    )
    ON CONFLICT (company_id, code) DO UPDATE
    SET name = EXCLUDED.name, address = EXCLUDED.address, phone = EXCLUDED.phone;

    -- 2. Estoque Local das Filiais (store_inventory)
    -- Filial Centro
    INSERT INTO store_inventory (store_id, company_id, product_id, quantity, min_stock)
    VALUES
        (v_store_centro, v_comp_matriz, v_p_arroz, 45, 15),
        (v_store_centro, v_comp_matriz, v_p_feijao, 30, 10),
        (v_store_centro, v_comp_matriz, v_p_leite, 20, 8),
        (v_store_centro, v_comp_matriz, v_p_iogurte, 15, 5),
        (v_store_centro, v_comp_matriz, v_p_pao, 18, 5)
    ON CONFLICT (store_id, product_id) DO UPDATE
    SET quantity = EXCLUDED.quantity, min_stock = EXCLUDED.min_stock;

    -- Filial Shopping
    INSERT INTO store_inventory (store_id, company_id, product_id, quantity, min_stock)
    VALUES
        (v_store_shopping, v_comp_matriz, v_p_iogurte, 25, 10),
        (v_store_shopping, v_comp_matriz, v_p_queijo, 12, 5),
        (v_store_shopping, v_comp_matriz, v_p_cafe, 35, 10),
        (v_store_shopping, v_comp_matriz, v_p_molho, 50, 15)
    ON CONFLICT (store_id, product_id) DO UPDATE
    SET quantity = EXCLUDED.quantity, min_stock = EXCLUDED.min_stock;

    -- Filial Zona Sul
    INSERT INTO store_inventory (store_id, company_id, product_id, quantity, min_stock)
    VALUES
        (v_store_zonasul, v_comp_matriz, v_p_arroz, 60, 20),
        (v_store_zonasul, v_comp_matriz, v_p_cafe, 22, 8),
        (v_store_zonasul, v_comp_matriz, v_p_oleo, 4, 15) -- Estoque local abaixo do mínimo
    ON CONFLICT (store_id, product_id) DO UPDATE
    SET quantity = EXCLUDED.quantity, min_stock = EXCLUDED.min_stock;

    -- 3. Requisições entre Filial e Armazém (Diferentes Status)
    -- Req 1: Recebida (Concluída com Sucesso)
    INSERT INTO requisitions (id, company_id, store_id, status, notes, created_by, created_at, dispatched_at, received_at)
    VALUES
    (
        'e0000000-0000-0000-0000-000000000001',
        v_comp_matriz,
        v_store_centro,
        'recebida',
        'Pedido semanal de reposição de grãos e laticínios para a Filial Centro.',
        v_user_centro,
        NOW() - INTERVAL '3 days',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '1 day'
    ) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

    INSERT INTO requisition_items (requisition_id, product_id, quantity_requested, quantity_approved, quantity_fulfilled)
    VALUES
        ('e0000000-0000-0000-0000-000000000001', v_p_arroz, 50, 50, 50),
        ('e0000000-0000-0000-0000-000000000001', v_p_feijao, 30, 30, 30),
        ('e0000000-0000-0000-0000-000000000001', v_p_leite, 20, 20, 20)
    ON CONFLICT (requisition_id, product_id) DO NOTHING;

    -- Req 2: Despachada (Em trânsito, aguardando operador da filial clicar em 'Confirmar Recebimento')
    INSERT INTO requisitions (id, company_id, store_id, status, notes, created_by, created_at, dispatched_at)
    VALUES
    (
        'e0000000-0000-0000-0000-000000000002',
        v_comp_matriz,
        v_store_shopping,
        'despachada',
        'Carga despachada do CD Central. Aguardando conferência e entrada no estoque da loja.',
        v_user_shopping,
        NOW() - INTERVAL '1 day',
        NOW() - INTERVAL '4 hours'
    ) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

    INSERT INTO requisition_items (requisition_id, product_id, quantity_requested, quantity_approved, quantity_fulfilled)
    VALUES
        ('e0000000-0000-0000-0000-000000000002', v_p_iogurte, 25, 25, 25),
        ('e0000000-0000-0000-0000-000000000002', v_p_queijo, 15, 15, 15),
        ('e0000000-0000-0000-0000-000000000002', v_p_presunto, 20, 20, 20)
    ON CONFLICT (requisition_id, product_id) DO NOTHING;

    -- Req 3: Pendente (Nova solicitação da loja, aguardando o CD despachar)
    INSERT INTO requisitions (id, company_id, store_id, status, notes, created_by, created_at)
    VALUES
    (
        'e0000000-0000-0000-0000-000000000003',
        v_comp_matriz,
        v_store_zonasul,
        'pendente',
        'Solicitação urgente de reposição de café e molhos para início de semana.',
        v_user_zonasul,
        NOW() - INTERVAL '2 hours'
    ) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

    INSERT INTO requisition_items (requisition_id, product_id, quantity_requested, quantity_approved, quantity_fulfilled)
    VALUES
        ('e0000000-0000-0000-0000-000000000003', v_p_cafe, 40, NULL, 0),
        ('e0000000-0000-0000-0000-000000000003', v_p_molho, 50, NULL, 0),
        ('e0000000-0000-0000-0000-000000000003', v_p_azeite, 20, NULL, 0)
    ON CONFLICT (requisition_id, product_id) DO NOTHING;

    -- Req 4: Cancelada com Compensação Saga (Demonstração da resiliência distribuída)
    INSERT INTO requisitions (id, company_id, store_id, status, notes, created_by, created_at, canceled_at)
    VALUES
    (
        'e0000000-0000-0000-0000-000000000004',
        v_comp_matriz,
        v_store_centro,
        'cancelada',
        'Pedido cancelado pelo gestor por duplicidade de lote. Compensação Saga liberou o estoque central.',
        v_user_centro,
        NOW() - INTERVAL '6 hours',
        NOW() - INTERVAL '1 hour'
    ) ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status;

    INSERT INTO requisition_items (requisition_id, product_id, quantity_requested, quantity_approved, quantity_fulfilled)
    VALUES
        ('e0000000-0000-0000-0000-000000000004', v_p_arroz, 30, 30, 0)
    ON CONFLICT (requisition_id, product_id) DO NOTHING;

    -- 4. Movimentações Locais na Filial (store_movements)
    INSERT INTO store_movements (store_id, company_id, product_id, changed_by, movement_type, quantity_delta, previous_quantity, new_quantity, reason, requisition_id, created_at)
    VALUES
    (
        v_store_centro,
        v_comp_matriz,
        v_p_arroz,
        v_user_centro,
        'recebimento',
        50,
        0,
        50,
        'Recebimento confirmado da Req #e0001 vinda do CD Central',
        'e0000000-0000-0000-0000-000000000001',
        NOW() - INTERVAL '1 day'
    ),
    (
        v_store_centro,
        v_comp_matriz,
        v_p_arroz,
        v_user_centro,
        'saida',
        -5,
        50,
        45,
        'Venda consumidor final - Cupom PDV 40129',
        NULL,
        NOW() - INTERVAL '18 hours'
    ),
    (
        v_store_shopping,
        v_comp_matriz,
        v_p_cafe,
        v_user_shopping,
        'entrada',
        35,
        0,
        35,
        'Transferência local autorizada',
        NULL,
        NOW() - INTERVAL '2 days'
    )
    ON CONFLICT DO NOTHING;
END $$;
