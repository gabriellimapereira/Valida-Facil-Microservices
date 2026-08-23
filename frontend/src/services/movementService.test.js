import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPost = vi.fn();
const mockGet = vi.fn();
vi.mock("../lib/apiClient", () => ({
  apiClient: { post: (...args) => mockPost(...args), get: (...args) => mockGet(...args) },
}));

import { recordMovement, fetchLowStock } from "./movementService";

beforeEach(() => {
  mockPost.mockReset();
  mockGet.mockReset();
});

describe("recordMovement", () => {
  it("envia o payload em snake_case pro backend", async () => {
    mockPost.mockResolvedValue({
      company_id: "company-1",
      product_id: "p1",
      product_name: "Maçã Gala",
      previous_quantity: 20,
      new_quantity: 15,
      min_stock: 10,
      crossed_low_stock: false,
    });

    await recordMovement({ productId: "p1", movementType: "saida", quantityDelta: -5, note: "Venda balcão" });

    expect(mockPost).toHaveBeenCalledWith("/movements", {
      product_id: "p1",
      movement_type: "saida",
      quantity_delta: -5,
      note: "Venda balcão",
    });
  });

  it("manda note como null quando não informada (nunca undefined)", async () => {
    mockPost.mockResolvedValue({
      product_id: "p1",
      product_name: "X",
      previous_quantity: 1,
      new_quantity: 2,
      min_stock: 1,
      crossed_low_stock: false,
    });

    await recordMovement({ productId: "p1", movementType: "entrada", quantityDelta: 1 });

    expect(mockPost.mock.calls[0][1].note).toBeNull();
  });

  it("remapeia a resposta do backend pra camelCase", async () => {
    mockPost.mockResolvedValue({
      company_id: "company-1",
      product_id: "p1",
      product_name: "Maçã Gala",
      previous_quantity: 12,
      new_quantity: 5,
      min_stock: 10,
      crossed_low_stock: true,
    });

    const result = await recordMovement({ productId: "p1", movementType: "saida", quantityDelta: -7 });

    expect(result).toEqual({
      productId: "p1",
      productName: "Maçã Gala",
      previousQuantity: 12,
      newQuantity: 5,
      minStock: 10,
      crossedLowStock: true,
    });
  });

  it("propaga erro do backend (ex: quantidade insuficiente)", async () => {
    mockPost.mockRejectedValue(new Error("Quantidade insuficiente em estoque para essa movimentação."));

    await expect(
      recordMovement({ productId: "p1", movementType: "saida", quantityDelta: -999 })
    ).rejects.toThrow("Quantidade insuficiente em estoque para essa movimentação.");
  });
});

describe("fetchLowStock", () => {
  it("devolve a lista de itens", async () => {
    mockGet.mockResolvedValue({ items: [{ id: "p1" }, { id: "p2" }] });

    const result = await fetchLowStock();

    expect(mockGet).toHaveBeenCalledWith("/movements/low-stock");
    expect(result).toEqual([{ id: "p1" }, { id: "p2" }]);
  });

  it("devolve lista vazia se a resposta não tiver 'items'", async () => {
    mockGet.mockResolvedValue({});

    const result = await fetchLowStock();

    expect(result).toEqual([]);
  });
});
