import { apiClient } from "../lib/apiClient";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { MOCK_STORES } from "../data/mockData";

let memoryStores = [...MOCK_STORES];

export async function fetchStores() {
  if (!isSupabaseConfigured) {
    return Promise.resolve([...memoryStores]);
  }
  return apiClient.get("/stores");
}

export async function createStore({ name, code, address, phone }) {
  if (!isSupabaseConfigured) {
    const created = {
      id: `store-demo-${Date.now()}`,
      companyId: "company-demo-1",
      name,
      code,
      address,
      phone,
      createdAt: new Date().toISOString(),
    };
    memoryStores = [created, ...memoryStores];
    return Promise.resolve(created);
  }
  return apiClient.post("/stores", { name, code, address, phone });
}

export async function fetchStoreInventory(storeId) {
  if (!isSupabaseConfigured) {
    // Retorna inventário simulado para teste
    return Promise.resolve([
      { id: "inv-1", store_id: storeId, product_id: "1", product_name: "Maçã Gala (caixa 10kg)", product_code: "FRT-0012", category: "perecivel", quantity: 8, min_stock: 5, updated_at: new Date().toISOString() },
      { id: "inv-2", store_id: storeId, product_id: "3", product_name: "Leite Integral 1L (fardo)", product_code: "LAT-0231", category: "perecivel", quantity: 12, min_stock: 10, updated_at: new Date().toISOString() },
    ]);
  }
  return apiClient.get(`/stores/${storeId}/inventory`);
}

export async function recordStoreMovement(storeId, { productId, quantityDelta, note }) {
  if (!isSupabaseConfigured) {
    return Promise.resolve({ status: "ok", store_id: storeId, product_id: productId, new_quantity: 10 });
  }
  return apiClient.post(`/stores/${storeId}/inventory/movement`, {
    product_id: productId,
    quantity_delta: quantityDelta,
    note,
  });
}
