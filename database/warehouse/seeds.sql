-- =====================================================================
-- Valida Fácil — Dados de Demonstração / Apresentação (db-warehouse)
-- =====================================================================

DO $$
DECLARE
    v_comp_matriz UUID := 'a0000000-0000-0000-0000-000000000001';
    v_comp_alvorada UUID := 'a0000000-0000-0000-0000-000000000002';
    v_user_armazem UUID := 'b0000000-0000-0000-0000-000000000003';
BEGIN
    -- 1. Categorias
    INSERT INTO categories (id, label, has_expiry) VALUES
        ('perecivel', 'Perecível (Alimentos)', TRUE),
        ('moda', 'Vestuário & Moda', FALSE),
        ('livros', 'Livros', FALSE),
        ('eletronicos', 'Eletrônicos', FALSE),
        ('outros', 'Outros', FALSE)
    ON CONFLICT (id) DO NOTHING;

    -- 2. Produtos do Armazém Central (CD) - Empresa Matriz
    -- A) Produtos Críticos (Vencem em <= 3 dias - Vermelho Urgente)
    INSERT INTO products (id, company_id, code, name, category, price, quantity, min_stock, expiry, supplier)
    VALUES
    (
        'd0000000-0000-0000-0000-000000000001',
        v_comp_matriz,
        '7891000100011',
        'Iogurte Natural Integral 170g',
        'perecivel',
        4.50,
        120,
        30,
        CURRENT_DATE + INTERVAL '2 days',
        'Laticínios Vale do Poti'
    ),
    (
        'd0000000-0000-0000-0000-000000000002',
        v_comp_matriz,
        '7891000100028',
        'Leite Pasteurizado Tipo A 1L',
        'perecivel',
        5.80,
        85,
        25,
        CURRENT_DATE + INTERVAL '1 day',
        'Laticínios Vale do Poti'
    ),
    (
        'd0000000-0000-0000-0000-000000000003',
        v_comp_matriz,
        '7891000100035',
        'Queijo Minas Frescal 500g',
        'perecivel',
        22.90,
        40,
        15,
        CURRENT_DATE + INTERVAL '3 days',
        'Queijaria da Serra'
    ),
    -- B) Produtos em Atenção (Vencem em 4 a 7 dias - Amarelo Atenção)
    (
        'd0000000-0000-0000-0000-000000000004',
        v_comp_matriz,
        '7891000100042',
        'Presunto Cozido Fatiado 200g',
        'perecivel',
        8.90,
        95,
        30,
        CURRENT_DATE + INTERVAL '5 days',
        'Frigorífico União'
    ),
    (
        'd0000000-0000-0000-0000-000000000005',
        v_comp_matriz,
        '7891000100059',
        'Peito de Frango Congelado 1kg',
        'perecivel',
        18.50,
        150,
        40,
        CURRENT_DATE + INTERVAL '7 days',
        'Avícola Central'
    ),
    (
        'd0000000-0000-0000-0000-000000000006',
        v_comp_matriz,
        '7891000100066',
        'Pão de Forma Tradicional 500g',
        'perecivel',
        7.20,
        60,
        20,
        CURRENT_DATE + INTERVAL '6 days',
        'Panificadora Poti'
    ),
    -- C) Produtos Vencidos (Para demonstrar auditoria, descarte e relatórios)
    (
        'd0000000-0000-0000-0000-000000000007',
        v_comp_matriz,
        '7891000100073',
        'Ricota Fresca 300g',
        'perecivel',
        12.00,
        10,
        10,
        CURRENT_DATE - INTERVAL '3 days',
        'Queijaria da Serra'
    ),
    (
        'd0000000-0000-0000-0000-000000000008',
        v_comp_matriz,
        '7891000100080',
        'Massa Folhada Pronta 400g',
        'perecivel',
        14.50,
        8,
        10,
        CURRENT_DATE - INTERVAL '6 days',
        'Massa Express'
    ),
    -- D) Produtos com Validade Confortável (Em dia - Verde)
    (
        'd0000000-0000-0000-0000-000000000009',
        v_comp_matriz,
        '7891000100097',
        'Arroz Tipo 1 Branco 5kg',
        'perecivel',
        29.90,
        520,
        100,
        CURRENT_DATE + INTERVAL '180 days',
        'Cerealista Nordeste'
    ),
    (
        'd0000000-0000-0000-0000-000000000010',
        v_comp_matriz,
        '7891000100103',
        'Feijão Carioca 1kg',
        'perecivel',
        8.50,
        380,
        80,
        CURRENT_DATE + INTERVAL '120 days',
        'Cerealista Nordeste'
    ),
    (
        'd0000000-0000-0000-0000-000000000011',
        v_comp_matriz,
        '7891000100110',
        'Café Torrado e Moído 500g',
        'perecivel',
        19.90,
        260,
        50,
        CURRENT_DATE + INTERVAL '90 days',
        'Café do Sertão'
    ),
    (
        'd0000000-0000-0000-0000-000000000012',
        v_comp_matriz,
        '7891000100127',
        'Azeite de Oliva Extra Virgem 500ml',
        'perecivel',
        42.00,
        190,
        30,
        CURRENT_DATE + INTERVAL '240 days',
        'Importadora Ibérica'
    ),
    (
        'd0000000-0000-0000-0000-000000000013',
        v_comp_matriz,
        '7891000100134',
        'Molho de Tomate Tradicional 340g',
        'perecivel',
        3.49,
        420,
        60,
        CURRENT_DATE + INTERVAL '150 days',
        'Alimentos do Campo'
    ),
    -- E) Produtos com Estoque Baixo (< min_stock - Alerta de Reposição)
    (
        'd0000000-0000-0000-0000-000000000014',
        v_comp_matriz,
        '7891000100141',
        'Óleo de Soja Refinado 900ml',
        'perecivel',
        6.99,
        9,
        50,
        CURRENT_DATE + INTERVAL '90 days',
        'Grãos do Brasil'
    ),
    (
        'd0000000-0000-0000-0000-000000000015',
        v_comp_matriz,
        '7891000100158',
        'Açúcar Cristal 1kg',
        'perecivel',
        4.89,
        14,
        40,
        CURRENT_DATE + INTERVAL '300 days',
        'Usina Boa Esperança'
    ),
    -- F) Produtos Não Perecíveis
    (
        'd0000000-0000-0000-0000-000000000016',
        v_comp_matriz,
        '7892000200015',
        'Leitor de Código de Barras USB Laser',
        'eletronicos',
        189.00,
        22,
        5,
        NULL,
        'Tech Comércio e Automação'
    ),
    (
        'd0000000-0000-0000-0000-000000000017',
        v_comp_matriz,
        '7892000200022',
        'Bobina Térmica PDV 80mm x 40m (Cx 30)',
        'outros',
        85.00,
        65,
        15,
        NULL,
        'Papéis e Suprimentos Teresina'
    ),
    (
        'd0000000-0000-0000-0000-000000000018',
        v_comp_matriz,
        '7892000200039',
        'Avental Operacional Valida Fácil (Tam G)',
        'moda',
        35.00,
        45,
        10,
        NULL,
        'Uniformes Confecções'
    )
    ON CONFLICT (company_id, name) DO UPDATE
    SET price = EXCLUDED.price,
        quantity = EXCLUDED.quantity,
        min_stock = EXCLUDED.min_stock,
        expiry = EXCLUDED.expiry,
        supplier = EXCLUDED.supplier;

    -- Produto isolado da Empresa 2 (Alvorada) para demonstrar Multi-Tenancy
    INSERT INTO products (id, company_id, code, name, category, price, quantity, min_stock, expiry, supplier)
    VALUES
    (
        'd0000000-0000-0000-0000-000000000019',
        v_comp_alvorada,
        '7893000300018',
        'Farinha de Trigo Especial 1kg',
        'perecivel',
        5.20,
        180,
        30,
        CURRENT_DATE + INTERVAL '90 days',
        'Moinho Alvorada'
    )
    ON CONFLICT (company_id, name) DO NOTHING;

    -- 3. Histórico de Movimentações no Armazém Central (Auditoria)
    INSERT INTO stock_movements (id, company_id, product_id, changed_by, movement_type, quantity_delta, previous_quantity, new_quantity, note, created_at)
    VALUES
    (
        'f0000000-0000-0000-0000-000000000001',
        v_comp_matriz,
        'd0000000-0000-0000-0000-000000000009',
        v_user_armazem,
        'entrada',
        520,
        0,
        520,
        'Recebimento de carga - NF 84920 - Cerealista Nordeste',
        NOW() - INTERVAL '5 days'
    ),
    (
        'f0000000-0000-0000-0000-000000000002',
        v_comp_matriz,
        'd0000000-0000-0000-0000-000000000010',
        v_user_armazem,
        'entrada',
        400,
        0,
        400,
        'Recebimento de carga - NF 84921 - Cerealista Nordeste',
        NOW() - INTERVAL '5 days'
    ),
    (
        'f0000000-0000-0000-0000-000000000003',
        v_comp_matriz,
        'd0000000-0000-0000-0000-000000000010',
        v_user_armazem,
        'saida',
        -20,
        400,
        380,
        'Despacho de abastecimento para Filial Centro (Req. #e0001)',
        NOW() - INTERVAL '2 days'
    ),
    (
        'f0000000-0000-0000-0000-000000000004',
        v_comp_matriz,
        'd0000000-0000-0000-0000-000000000001',
        v_user_armazem,
        'entrada',
        150,
        0,
        150,
        'Recebimento lote refrigerado - NF 11029 - Laticínios Vale do Poti',
        NOW() - INTERVAL '3 days'
    ),
    (
        'f0000000-0000-0000-0000-000000000005',
        v_comp_matriz,
        'd0000000-0000-0000-0000-000000000001',
        v_user_armazem,
        'saida',
        -30,
        150,
        120,
        'Despacho de abastecimento para Filial Shopping (Req. #e0002)',
        NOW() - INTERVAL '1 day'
    ),
    (
        'f0000000-0000-0000-0000-000000000006',
        v_comp_matriz,
        'd0000000-0000-0000-0000-000000000014',
        v_user_armazem,
        'ajuste',
        -41,
        50,
        9,
        'Ajuste por contagem de inventário físico - Lote avariado descartado',
        NOW() - INTERVAL '12 hours'
    )
    ON CONFLICT (id) DO NOTHING;

    -- 4. Despachos no Armazém Central (Sincronizados com ms-stores)
    INSERT INTO warehouse_dispatches (requisition_id, company_id, status, allocated_items, dispatched_at_date)
    VALUES
    (
        'e0000000-0000-0000-0000-000000000001',
        v_comp_matriz,
        'dispatched',
        '[{"product_id": "d0000000-0000-0000-0000-000000000009", "quantity": 50}, {"product_id": "d0000000-0000-0000-0000-000000000010", "quantity": 30}]'::jsonb,
        (CURRENT_DATE - INTERVAL '2 days')::text
    ),
    (
        'e0000000-0000-0000-0000-000000000002',
        v_comp_matriz,
        'dispatched',
        '[{"product_id": "d0000000-0000-0000-0000-000000000001", "quantity": 25}, {"product_id": "d0000000-0000-0000-0000-000000000003", "quantity": 15}]'::jsonb,
        (CURRENT_DATE - INTERVAL '1 day')::text
    ),
    (
        'e0000000-0000-0000-0000-000000000004',
        v_comp_matriz,
        'released',
        '[{"product_id": "d0000000-0000-0000-0000-000000000009", "quantity": 30}]'::jsonb,
        CURRENT_DATE::text
    )
    ON CONFLICT (requisition_id) DO NOTHING;
END $$;
