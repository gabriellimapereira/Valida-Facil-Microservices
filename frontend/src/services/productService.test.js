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

import { fetchProducts, createProduct, updateProduct, deleteProduct } from "./productService";

beforeEach(() => {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
  mockApiPatch.mockReset();
  mockApiDelete.mockReset();
});

describe("productService via API Gateway", () => {
  it("normalizes the list returned by MS Warehouse", async () => {
    mockApiGet.mockResolvedValue([
      { id: "p1", name: "Maçã", price: "4.5", quantity: 5, min_stock: 2 },
    ]);

    await expect(fetchProducts("company-1")).resolves.toEqual([
      {
        id: "p1",
        code: undefined,
        name: "Maçã",
        category: undefined,
        price: 4.5,
        quantity: 5,
        minStock: 2,
        expiry: undefined,
        supplier: undefined,
      },
    ]);
    expect(mockApiGet).toHaveBeenCalledWith("/products");
  });

  it("sends creates and updates through the Gateway", async () => {
    mockApiPost.mockResolvedValue({ id: "p1", name: "Camiseta", min_stock: 5, price: 39.9 });
    const created = await createProduct({ name: "Camiseta", minStock: 5, price: 39.9 });
    expect(mockApiPost).toHaveBeenCalledWith("/products", {
      name: "Camiseta",
      min_stock: 5,
      price: 39.9,
    });
    expect(created.minStock).toBe(5);

    mockApiPatch.mockResolvedValue({ id: "p1", quantity: 3, min_stock: 5 });
    await expect(updateProduct("p1", { quantity: 3 })).resolves.toMatchObject({ quantity: 3 });
    expect(mockApiPatch).toHaveBeenCalledWith("/products/p1", { quantity: 3 });
  });

  it("deletes through the Gateway and propagates errors", async () => {
    mockApiDelete.mockResolvedValue(null);
    await expect(deleteProduct("p1")).resolves.toBe(true);
    expect(mockApiDelete).toHaveBeenCalledWith("/products/p1");

    mockApiDelete.mockRejectedValue(new Error("permission denied"));
    await expect(deleteProduct("p1")).rejects.toThrow("permission denied");
  });
});
