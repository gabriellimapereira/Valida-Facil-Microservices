-- =====================================================================
-- Valida Fácil — funções de banco usadas pelo backend
-- Execute DEPOIS do schema.sql principal (o do front), no SQL Editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- apply_stock_movement
--
-- Atualiza a quantidade do produto e registra a movimentação em
-- stock_movements numa única transação atômica (ou os dois efeitos
-- acontecem, ou nenhum). Roda como SECURITY INVOKER (não DEFINER), ou
-- seja, continua sujeita ao RLS das tabelas products/stock_movements —
-- um usuário só consegue mexer em produtos da própria empresa mesmo
-- chamando essa função diretamente.
--
-- Retorna um JSON com o suficiente pra decidir, no backend, se deve
-- disparar e-mail de estoque baixo (crossed_low_stock = true só quando a
-- movimentação ACABOU de cruzar o limite, não toda vez que consultar).
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

  update products set quantity = v_new_qty where id = p_product_id;

  insert into stock_movements (company_id, product_id, changed_by, movement_type, quantity_delta, note)
  values (v_company_id, p_product_id, auth.uid(), p_movement_type, p_quantity_delta, p_note);

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

-- Permite que qualquer usuário autenticado chame a função (o controle de
-- acesso real continua sendo feito pelo RLS das tabelas por baixo).
grant execute on function apply_stock_movement(uuid, text, integer, text) to authenticated;
