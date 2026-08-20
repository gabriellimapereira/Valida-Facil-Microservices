// Movimentação de estoque passa pelo backend (não direto no Supabase)
// porque precisa ser atômica (atualizar quantidade + gravar histórico
// juntos) e decidir, no servidor, se dispara o e-mail de estoque baixo.

import { apiClient } from "../lib/apiClient";

export async function recordMovement({ productId, movementType, quantityDelta, note }) {
  const result = await apiClient.post("/movements", {
    product_id: productId,
    movement_type: movementType,
    quantity_delta: quantityDelta,
    note: note || null,
  });

  return {
    productId: result.product_id,
    productName: result.product_name,
    previousQuantity: result.previous_quantity,
    newQuantity: result.new_quantity,
    minStock: result.min_stock,
    crossedLowStock: result.crossed_low_stock,
  };
}

export async function fetchLowStock() {
  const result = await apiClient.get("/movements/low-stock");
  return result?.items ?? [];
}
