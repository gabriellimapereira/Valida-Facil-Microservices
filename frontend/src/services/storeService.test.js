import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();

vi.mock("../lib/apiClient", () => ({
  getAccessToken: () => "test-token",
  apiClient: {
    get: (...args) => mockApiGet(...args),
    post: (...args) => mockApiPost(...args),
    patch: (...args) => mockApiPatch(...args),
    delete: (...args) => mockApiDelete(...args),
  },
}));

import {
  fetchStores,
  createStore,
  updateStore,
  deleteStore,
  fetchStoreInventory,
  recordStoreMovement,
  updateStoreMinStock,
  fetchStoreMovements,
} from "./storeService";

beforeEach(() => {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();
});

describe("storeService (MS Stores)", () => {
  it("normaliza campos de lojas e suporta CRUD completo", async () => {
    mockApiGet.mockResolvedValue([
      { id: "s1", company_id: "c1", code: "C01", name: "Centro", address: "Rua A", created_at: "2026-01-01" },
    ]);
    const list = await fetchStores();
    expect(mockApiGet).toHaveBeenCalledWith("/stores");
    expect(list[0]).toMatchObject({ id: "s1", companyId: "c1", code: "C01", name: "Centro" });

    mockApiPost.mockResolvedValue({ id: "s2", company_id: "c1", code: "N02", name: "Norte" });
    const created = await createStore({ name: "Norte", code: "n02" });
    expect(mockApiPost).toHaveBeenCalledWith("/stores", { name: "Norte", code: "n02" });
    expect(created.id).toBe("s2");

    mockApiPatch.mockResolvedValue({ id: "s2", company_id: "c1", code: "N02", name: "Norte Atualizada" });
    const updated = await updateStore("s2", { name: "Norte Atualizada" });
    expect(mockApiPatch).toHaveBeenCalledWith("/stores/s2", { name: "Norte Atualizada" });
    expect(updated.name).toBe("Norte Atualizada");

    mockApiDelete.mockResolvedValue(null);
    await deleteStore("s2");
    expect(mockApiDelete).toHaveBeenCalledWith("/stores/s2");
  });

  it("normaliza inventário local com validade (expiry) e estoque mínimo (minStock)", async () => {
    mockApiGet.mockResolvedValue([
      {
        id: "inv-1",
        store_id: "s1",
        product_id: "p1",
        product_name: "Leite UHT",
        product_code: "LAT-01",
        category: "perecivel",
        expiry: "2026-12-10",
        quantity: 45,
        min_stock: 15,
        updated_at: "2026-10-10T00:00:00Z",
      },
    ]);

    const inv = await fetchStoreInventory("s1");
    expect(mockApiGet).toHaveBeenCalledWith("/stores/s1/inventory");
    expect(inv[0]).toMatchObject({
      id: "inv-1",
      storeId: "s1",
      productId: "p1",
      productName: "Leite UHT",
      productCode: "LAT-01",
      category: "perecivel",
      expiry: "2026-12-10",
      quantity: 45,
      minStock: 15,
      updatedAt: "2026-10-10T00:00:00Z",
    });
  });

  it("permite movimentação na loja sem limite artificial de 1 milhão e atualiza min_stock", async () => {
    mockApiPost.mockResolvedValue({ status: "ok", previous_quantity: 0, new_quantity: 2500000 });
    await recordStoreMovement("s1", {
      productId: "p1",
      quantityDelta: 2500000,
      note: "Grande lote",
    });
    expect(mockApiPost).toHaveBeenCalledWith("/stores/s1/inventory/movement", {
      product_id: "p1",
      quantity_delta: 2500000,
      note: "Grande lote",
    });

    mockApiPatch.mockResolvedValue({ store_id: "s1", product_id: "p1", min_stock: 100 });
    const res = await updateStoreMinStock("s1", "p1", 100);
    expect(mockApiPatch).toHaveBeenCalledWith("/stores/s1/inventory/p1", { min_stock: 100 });
    expect(res.minStock).toBe(100);
  });

  it("normaliza histórico de movimentações da loja (store_movements)", async () => {
    mockApiGet.mockResolvedValue([
      {
        id: "m1",
        store_id: "s1",
        product_id: "p1",
        product_name: "Arroz 5kg",
        product_code: "GR-01",
        changed_by: "u1",
        changed_by_name: "Jorge Miguel",
        movement_type: "recebimento_requisicao",
        quantity_delta: 30,
        previous_quantity: 10,
        new_quantity: 40,
        requisition_id: "r1",
        note: "Recebimento CD",
        created_at: "2026-11-10T12:00:00Z",
      },
    ]);

    const history = await fetchStoreMovements("s1");
    expect(mockApiGet).toHaveBeenCalledWith("/stores/s1/movements");
    expect(history[0]).toMatchObject({
      id: "m1",
      productId: "p1",
      productName: "Arroz 5kg",
      changedByName: "Jorge Miguel",
      movementType: "recebimento_requisicao",
      quantityDelta: 30,
      previousQuantity: 10,
      newQuantity: 40,
      requisitionId: "r1",
    });
  });
});
