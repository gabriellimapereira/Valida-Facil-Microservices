import { apiClient, getAccessToken } from "../lib/apiClient";
import { MOCK_PRODUCTS, MOCK_REQUISITIONS } from "../data/mockData";

let memoryRequisitions = [...MOCK_REQUISITIONS];

function normalizeRequisitionItem(item) {
  return {
    id: item.id,
    productId: item.product_id ?? item.productId,
    productName: item.product_name ?? item.productName ?? "Produto",
    productCode: item.product_code ?? item.productCode ?? "SKU",
    expiry: item.expiry || null,
    quantityRequested: Number(item.quantity_requested ?? item.quantityRequested ?? 0),
    quantityApproved:
      item.quantity_approved !== undefined && item.quantity_approved !== null
        ? Number(item.quantity_approved)
        : item.quantityApproved !== undefined && item.quantityApproved !== null
          ? Number(item.quantityApproved)
          : null,
  };
}

function normalizeRequisition(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id ?? row.companyId,
    storeId: row.store_id ?? row.storeId,
    storeName: row.store_name ?? row.storeName ?? "Filial",
    requestedBy: row.requested_by ?? row.requestedBy ?? null,
    requestedByName: row.requested_by_name ?? row.requestedByName ?? "Colaborador",
    status: row.status,
    notes: row.notes || "",
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    items: (row.items || []).map(normalizeRequisitionItem),
  };
}

export async function fetchRequisitions({ storeId, status } = {}) {
  if (!getAccessToken()) {
    let list = memoryRequisitions.map(normalizeRequisition);
    if (storeId) list = list.filter((r) => r.storeId === storeId);
    if (status) list = list.filter((r) => r.status === status);
    return Promise.resolve(list);
  }
  const params = {};
  if (storeId) params.store_id = storeId;
  if (status) params.status = status;
  const rows = await apiClient.get("/requisitions", params);
  return (rows || []).map(normalizeRequisition);
}

export async function createRequisition({ storeId, notes, items }) {
  if (!getAccessToken()) {
    const created = normalizeRequisition({
      id: `req-demo-${Date.now()}`,
      company_id: "company-demo-1",
      store_id: storeId,
      store_name: "Filial Selecionada",
      requested_by: "user-demo-1",
      requested_by_name: "Usuário Logado",
      status: "pendente",
      notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: items.map((it, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        product_id: it.productId,
        product_name: it.productName || "Produto",
        product_code: it.productCode || "SKU",
        quantity_requested: it.quantityRequested,
        quantity_approved: null,
      })),
    });
    memoryRequisitions = [created, ...memoryRequisitions];
    return Promise.resolve(created);
  }
  const row = await apiClient.post("/requisitions", {
    store_id: storeId,
    notes,
    items: items.map((it) => ({
      product_id: it.productId,
      quantity_requested: it.quantityRequested,
    })),
  });
  return normalizeRequisition(row);
}

export async function updateRequisitionStatus(requisitionId, { status, itemsApproved, notes }) {
  if (!getAccessToken()) {
    memoryRequisitions = memoryRequisitions.map((r) => {
      if (r.id !== requisitionId) return r;
      const updatedItems = (r.items || []).map((it) => {
        const match = (itemsApproved || []).find((a) => (a.productId || a.product_id) === (it.productId || it.product_id));
        if (match) {
          return { ...it, quantityApproved: Number(match.quantityApproved ?? match.quantity_approved) };
        }
        return status === "aprovada" && (it.quantityApproved == null)
          ? { ...it, quantityApproved: it.quantityRequested ?? it.quantity_requested }
          : it;
      });
      return { ...r, status, items: updatedItems, updatedAt: new Date().toISOString() };
    });
    return Promise.resolve(normalizeRequisition(memoryRequisitions.find((r) => r.id === requisitionId)));
  }

  const payload = { status };
  if (itemsApproved && itemsApproved.length > 0) {
    payload.items_approved = itemsApproved.map((it) => ({
      product_id: it.productId || it.product_id,
      quantity_approved: Number(it.quantityApproved ?? it.quantity_approved),
    }));
  }
  if (notes !== undefined) {
    payload.notes = notes;
  }
  const row = await apiClient.patch(`/requisitions/${requisitionId}/status`, payload);
  return normalizeRequisition(row);
}

export async function fetchWarehouseAvailability() {
  if (!getAccessToken()) {
    return Promise.resolve(
      [...MOCK_PRODUCTS]
        .sort((a, b) => (a.expiry || "9999-12-31").localeCompare(b.expiry || "9999-12-31"))
        .map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          category: p.category,
          quantity: p.quantity,
          minStock: p.minStock,
          expiry: p.expiry,
          expiryStatus: p.expiry ? "normal" : "sem_validade",
        }))
    );
  }
  const rows = await apiClient.get("/warehouse/products/availability");
  return (rows || []).map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    category: r.category,
    quantity: Number(r.quantity ?? 0),
    minStock: Number(r.min_stock ?? 0),
    expiry: r.expiry || null,
    daysToExpiry: r.days_to_expiry ?? null,
    expiryStatus: r.expiry_status || "sem_validade",
    lowStock: Boolean(r.low_stock),
  }));
}
