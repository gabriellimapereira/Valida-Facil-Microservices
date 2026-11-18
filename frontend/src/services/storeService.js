import { apiClient, getAccessToken } from "../lib/apiClient";
import { MOCK_STORES } from "../data/mockData";

let memoryStores = [...MOCK_STORES];
let memoryStoreInventory = {
  "store-demo-1": [
    {
      id: "inv-1",
      store_id: "store-demo-1",
      product_id: "1",
      product_name: "Maçã Gala (caixa 10kg)",
      product_code: "FRT-0012",
      category: "perecivel",
      quantity: 8,
      min_stock: 5,
      updated_at: new Date().toISOString(),
    },
    {
      id: "inv-2",
      store_id: "store-demo-1",
      product_id: "3",
      product_name: "Leite Integral 1L (fardo)",
      product_code: "LAT-0231",
      category: "perecivel",
      quantity: 12,
      min_stock: 10,
      updated_at: new Date().toISOString(),
    },
  ],
};
let memoryStoreMovements = {};

function normalizeStore(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id ?? row.companyId,
    code: row.code,
    name: row.name,
    address: row.address || "",
    phone: row.phone || "",
    createdAt: row.created_at ?? row.createdAt,
  };
}

function normalizeInventoryItem(row) {
  return {
    id: row.id,
    storeId: row.store_id ?? row.storeId,
    productId: row.product_id ?? row.productId,
    productName: row.product_name ?? row.productName ?? "Produto",
    productCode: row.product_code ?? row.productCode ?? "SKU",
    category: row.category || "",
    expiry: row.expiry || null,
    quantity: Number(row.quantity ?? 0),
    minStock: Number(row.min_stock ?? row.minStock ?? 0),
    updatedAt: row.updated_at ?? row.updatedAt,
    // Mantém aliases snake_case para qualquer consumidor legado
    store_id: row.store_id ?? row.storeId,
    product_id: row.product_id ?? row.productId,
    product_name: row.product_name ?? row.productName ?? "Produto",
    product_code: row.product_code ?? row.productCode ?? "SKU",
    min_stock: Number(row.min_stock ?? row.minStock ?? 0),
    updated_at: row.updated_at ?? row.updatedAt,
  };
}

function normalizeStoreMovement(row) {
  return {
    id: row.id,
    storeId: row.store_id ?? row.storeId,
    productId: row.product_id ?? row.productId,
    productName: row.product_name ?? row.productName ?? "Produto",
    productCode: row.product_code ?? row.productCode ?? "SKU",
    changedBy: row.changed_by ?? row.changedBy,
    changedByName: row.changed_by_name ?? row.changedByName ?? "Colaborador",
    movementType: row.movement_type ?? row.movementType ?? "ajuste",
    quantityDelta: Number(row.quantity_delta ?? row.quantityDelta ?? 0),
    previousQuantity: row.previous_quantity ?? row.previousQuantity ?? null,
    newQuantity: row.new_quantity ?? row.newQuantity ?? null,
    requisitionId: row.requisition_id ?? row.requisitionId ?? null,
    note: row.note || "",
    createdAt: row.created_at ?? row.createdAt,
  };
}

export async function fetchStores() {
  if (!getAccessToken()) {
    return Promise.resolve(memoryStores.map(normalizeStore));
  }
  const rows = await apiClient.get("/stores");
  return (rows || []).map(normalizeStore);
}

export async function createStore({ name, code, address, phone }) {
  if (!getAccessToken()) {
    const created = normalizeStore({
      id: `store-demo-${Date.now()}`,
      company_id: "company-demo-1",
      name,
      code: code.toUpperCase(),
      address,
      phone,
      created_at: new Date().toISOString(),
    });
    memoryStores = [created, ...memoryStores];
    return Promise.resolve(created);
  }
  const row = await apiClient.post("/stores", { name, code, address, phone });
  return normalizeStore(row);
}

export async function updateStore(storeId, changes) {
  if (!getAccessToken()) {
    memoryStores = memoryStores.map((s) => (s.id === storeId ? normalizeStore({ ...s, ...changes }) : s));
    return Promise.resolve(memoryStores.find((s) => s.id === storeId));
  }
  const row = await apiClient.patch(`/stores/${storeId}`, changes);
  return normalizeStore(row);
}

export async function deleteStore(storeId) {
  if (!getAccessToken()) {
    memoryStores = memoryStores.filter((s) => s.id !== storeId);
    return Promise.resolve();
  }
  return apiClient.delete(`/stores/${storeId}`);
}

export async function fetchStoreInventory(storeId) {
  if (!getAccessToken()) {
    const rows = memoryStoreInventory[storeId] || [];
    return Promise.resolve(rows.map(normalizeInventoryItem));
  }
  const rows = await apiClient.get(`/stores/${storeId}/inventory`);
  return (rows || []).map(normalizeInventoryItem);
}

export async function recordStoreMovement(storeId, { productId, quantityDelta, note, productName, productCode }) {
  if (!getAccessToken()) {
    const list = memoryStoreInventory[storeId] ? [...memoryStoreInventory[storeId]] : [];
    const idx = list.findIndex((it) => (it.product_id || it.productId) === productId);
    const prevQty = idx >= 0 ? Number(list[idx].quantity) : 0;
    const newQty = prevQty + Number(quantityDelta);
    if (newQty < 0) {
      throw new Error(`Saldo insuficiente na filial (atual: ${prevQty}).`);
    }
    const now = new Date().toISOString();
    if (idx >= 0) {
      list[idx] = { ...list[idx], quantity: newQty, updated_at: now };
    } else {
      list.unshift({
        id: `inv-${Date.now()}`,
        store_id: storeId,
        product_id: productId,
        product_name: productName || "Produto",
        product_code: productCode || "SKU",
        quantity: newQty,
        min_stock: 0,
        updated_at: now,
      });
    }
    memoryStoreInventory[storeId] = list;
    const hist = memoryStoreMovements[storeId] ? [...memoryStoreMovements[storeId]] : [];
    hist.unshift({
      id: `sm-${Date.now()}`,
      store_id: storeId,
      product_id: productId,
      product_name: productName || list.find((i) => i.product_id === productId)?.product_name || "Produto",
      product_code: productCode || list.find((i) => i.product_id === productId)?.product_code || "SKU",
      movement_type: quantityDelta > 0 ? "entrada" : "saida",
      quantity_delta: Number(quantityDelta),
      previous_quantity: prevQty,
      new_quantity: newQty,
      note: note || "",
      created_at: now,
    });
    memoryStoreMovements[storeId] = hist;
    return Promise.resolve({ status: "ok", store_id: storeId, product_id: productId, new_quantity: newQty });
  }
  return apiClient.post(`/stores/${storeId}/inventory/movement`, {
    product_id: productId,
    quantity_delta: quantityDelta,
    note,
  });
}

export async function updateStoreMinStock(storeId, productId, minStock) {
  if (!getAccessToken()) {
    const list = memoryStoreInventory[storeId] || [];
    memoryStoreInventory[storeId] = list.map((it) =>
      (it.product_id || it.productId) === productId ? { ...it, min_stock: Number(minStock), minStock: Number(minStock) } : it
    );
    return Promise.resolve({
      storeId,
      productId,
      minStock: Number(minStock),
      store_id: storeId,
      product_id: productId,
      min_stock: Number(minStock),
    });
  }
  const res = await apiClient.patch(`/stores/${storeId}/inventory/${productId}`, { min_stock: Number(minStock) });
  const normalizedMin = Number(res?.min_stock ?? res?.minStock ?? minStock);
  return {
    storeId: res?.store_id ?? res?.storeId ?? storeId,
    productId: res?.product_id ?? res?.productId ?? productId,
    minStock: normalizedMin,
    store_id: res?.store_id ?? storeId,
    product_id: res?.product_id ?? productId,
    min_stock: normalizedMin,
  };
}

export async function fetchStoreMovements(storeId) {
  if (!getAccessToken()) {
    return Promise.resolve((memoryStoreMovements[storeId] || []).map(normalizeStoreMovement));
  }
  const rows = await apiClient.get(`/stores/${storeId}/movements`);
  return (rows || []).map(normalizeStoreMovement);
}
