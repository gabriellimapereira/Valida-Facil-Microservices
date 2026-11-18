import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();

vi.mock("../lib/apiClient", () => ({
  getAccessToken: () => "test-token",
  apiClient: {
    get: (...args) => mockApiGet(...args),
    post: (...args) => mockApiPost(...args),
    patch: (...args) => mockApiPatch(...args),
  },
}));

import {
  fetchRequisitions,
  createRequisition,
  updateRequisitionStatus,
  fetchWarehouseAvailability,
} from "./requisitionService";

beforeEach(() => {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
});

describe("requisitionService (MS Stores & MS Warehouse FEFO)", () => {
  it("normaliza lista de requisições e itens (snake_case -> camelCase)", async () => {
    mockApiGet.mockResolvedValue([
      {
        id: "req-1",
        company_id: "comp-1",
        store_id: "store-1",
        store_name: "Filial Centro",
        requested_by: "user-1",
        requested_by_name: "Mariana",
        status: "despachada",
        notes: "Urgente",
        created_at: "2026-11-01T10:00:00Z",
        updated_at: "2026-11-01T11:00:00Z",
        items: [
          {
            id: "it-1",
            product_id: "prod-1",
            product_name: "Iogurte",
            product_code: "LAT-09",
            expiry: "2026-11-20",
            quantity_requested: 20,
            quantity_approved: 15,
          },
        ],
      },
    ]);

    const reqs = await fetchRequisitions({ storeId: "store-1", status: "despachada" });
    expect(mockApiGet).toHaveBeenCalledWith("/requisitions", { store_id: "store-1", status: "despachada" });
    expect(reqs[0]).toMatchObject({
      id: "req-1",
      storeId: "store-1",
      storeName: "Filial Centro",
      requestedByName: "Mariana",
      status: "despachada",
    });
    expect(reqs[0].items[0]).toEqual({
      id: "it-1",
      productId: "prod-1",
      productName: "Iogurte",
      productCode: "LAT-09",
      expiry: "2026-11-20",
      quantityRequested: 20,
      quantityApproved: 15,
    });
  });

  it("envia createRequisition e aprovação parcial (items_approved) corretamente", async () => {
    mockApiPost.mockResolvedValue({
      id: "req-2",
      store_id: "store-1",
      status: "pendente",
      items: [{ id: "i1", product_id: "p1", quantity_requested: 1200000 }],
    });

    const created = await createRequisition({
      storeId: "store-1",
      notes: "Sem limite",
      items: [{ productId: "p1", quantityRequested: 1200000 }],
    });
    expect(mockApiPost).toHaveBeenCalledWith("/requisitions", {
      store_id: "store-1",
      notes: "Sem limite",
      items: [{ product_id: "p1", quantity_requested: 1200000 }],
    });
    expect(created.items[0].quantityRequested).toBe(1200000);

    mockApiPatch.mockResolvedValue({
      id: "req-2",
      store_id: "store-1",
      status: "aprovada",
      items: [{ id: "i1", product_id: "p1", quantity_requested: 1200000, quantity_approved: 900000 }],
    });

    const approved = await updateRequisitionStatus("req-2", {
      status: "aprovada",
      itemsApproved: [{ productId: "p1", quantityApproved: 900000 }],
    });
    expect(mockApiPatch).toHaveBeenCalledWith("/requisitions/req-2/status", {
      status: "aprovada",
      items_approved: [{ product_id: "p1", quantity_approved: 900000 }],
    });
    expect(approved.items[0].quantityApproved).toBe(900000);
  });

  it("consulta disponibilidade FEFO do Armazém Central", async () => {
    mockApiGet.mockResolvedValue([
      {
        id: "p-fefo",
        code: "PER-01",
        name: "Queijo Minas",
        category: "perecivel",
        quantity: 12,
        min_stock: 5,
        expiry: "2026-11-14",
        days_to_expiry: 3,
        expiry_status: "critico",
        low_stock: false,
      },
    ]);

    const list = await fetchWarehouseAvailability();
    expect(mockApiGet).toHaveBeenCalledWith("/warehouse/products/availability");
    expect(list[0]).toEqual({
      id: "p-fefo",
      code: "PER-01",
      name: "Queijo Minas",
      category: "perecivel",
      quantity: 12,
      minStock: 5,
      expiry: "2026-11-14",
      daysToExpiry: 3,
      expiryStatus: "critico",
      lowStock: false,
    });
  });
});
