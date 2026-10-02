import { apiClient } from "../lib/apiClient";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { MOCK_REQUISITIONS } from "../data/mockData";

let memoryRequisitions = [...MOCK_REQUISITIONS];

export async function fetchRequisitions({ storeId, status } = {}) {
  if (!isSupabaseConfigured) {
    let list = [...memoryRequisitions];
    if (storeId) list = list.filter((r) => r.storeId === storeId);
    if (status) list = list.filter((r) => r.status === status);
    return Promise.resolve(list);
  }
  const params = {};
  if (storeId) params.store_id = storeId;
  if (status) params.status = status;
  return apiClient.get("/requisitions", params);
}

export async function createRequisition({ storeId, notes, items }) {
  if (!isSupabaseConfigured) {
    const created = {
      id: `req-demo-${Date.now()}`,
      companyId: "company-demo-1",
      storeId,
      storeName: "Filial Selecionada",
      requestedBy: "user-demo-1",
      requestedByName: "Usuário Logado",
      status: "pendente",
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: items.map((it, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        productId: it.productId,
        quantityRequested: it.quantityRequested,
        quantityApproved: it.quantityRequested,
      })),
    };
    memoryRequisitions = [created, ...memoryRequisitions];
    return Promise.resolve(created);
  }
  return apiClient.post("/requisitions", {
    store_id: storeId,
    notes,
    items: items.map((it) => ({
      product_id: it.productId,
      quantity_requested: it.quantityRequested,
    })),
  });
}

export async function updateRequisitionStatus(requisitionId, { status, itemsApproved }) {
  if (!isSupabaseConfigured) {
    memoryRequisitions = memoryRequisitions.map((r) =>
      r.id === requisitionId ? { ...r, status, updatedAt: new Date().toISOString() } : r
    );
    return Promise.resolve(memoryRequisitions.find((r) => r.id === requisitionId));
  }
  return apiClient.patch(`/requisitions/${requisitionId}/status`, {
    status,
    items_approved: itemsApproved,
  });
}
