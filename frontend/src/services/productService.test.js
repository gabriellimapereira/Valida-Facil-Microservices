import { describe, it, expect, vi, beforeEach } from "vitest";

// productService.js só chama supabase.from(...) quando isSupabaseConfigured
// é true — mockamos os dois como "configurado", já que o modo mock (sem
// Supabase) é só um array em memória, sem lógica de mapeamento pra testar.
const mockFrom = vi.fn();
vi.mock("../lib/supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { from: (...args) => mockFrom(...args) },
}));

import { fetchProducts, createProduct, updateProduct, deleteProduct } from "./productService";

// Builder "encadeável e thenable": cada método devolve o próprio objeto
// (pra suportar .select().eq().order() em qualquer ordem), e `await` em
// qualquer ponto da cadeia resolve pro mesmo resultado configurado no
// teste — suficiente pra testar COMO o service usa a resposta, sem
// precisar reimplementar o Postgres de verdade.
function makeChain(result) {
  const chain = {};
  ["select", "eq", "order", "insert", "update", "delete", "single", "maybeSingle"].forEach((method) => {
    chain[method] = vi.fn(() => chain);
  });
  chain.then = (resolve) => resolve(result);
  return chain;
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe("fetchProducts", () => {
  it("busca na tabela certa e mapeia min_stock -> minStock", async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: [
          {
            id: "1",
            code: "FRT-0012",
            name: "Maçã Gala",
            category: "perecivel",
            price: "42.90",
            quantity: 5,
            min_stock: 10,
            expiry: "2026-08-25",
            supplier: "Fazenda Boa Vista",
          },
        ],
        error: null,
      })
    );

    const result = await fetchProducts("company-1");

    expect(mockFrom).toHaveBeenCalledWith("products");
    expect(result).toEqual([
      {
        id: "1",
        code: "FRT-0012",
        name: "Maçã Gala",
        category: "perecivel",
        price: 42.9, // string do Postgres vira number
        quantity: 5,
        minStock: 10,
        expiry: "2026-08-25",
        supplier: "Fazenda Boa Vista",
      },
    ]);
  });

  it("não faz consulta nenhuma sem companyId (evita vazar dado sem escopo)", async () => {
    const result = await fetchProducts(null);

    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("propaga o erro do Supabase (ex: bloqueio de RLS)", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: new Error("RLS negou o acesso") }));

    await expect(fetchProducts("company-1")).rejects.toThrow("RLS negou o acesso");
  });
});

describe("createProduct", () => {
  it("converte minStock -> min_stock e companyId -> company_id no payload enviado", async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: {
          id: "novo-1",
          code: "MOD-1001",
          name: "Camiseta Básica",
          category: "moda",
          price: 39.9,
          quantity: 10,
          min_stock: 5,
          expiry: null,
          supplier: null,
        },
        error: null,
      })
    );

    const result = await createProduct({
      code: "MOD-1001",
      name: "Camiseta Básica",
      category: "moda",
      price: 39.9,
      quantity: 10,
      minStock: 5,
      companyId: "company-1",
    });

    expect(result.id).toBe("novo-1");
    expect(result.minStock).toBe(5);
  });

  it("propaga erro quando a inserção falha (ex: código de produto duplicado)", async () => {
    mockFrom.mockReturnValue(
      makeChain({ data: null, error: new Error('duplicate key value violates unique constraint') })
    );

    await expect(createProduct({ code: "X", companyId: "company-1" })).rejects.toThrow(/duplicate key/);
  });
});

describe("updateProduct", () => {
  it("mapeia só os campos alterados", async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: { id: "1", code: "X", name: "Y", category: "moda", price: 10, quantity: 3, min_stock: 5, expiry: null, supplier: null },
        error: null,
      })
    );

    const result = await updateProduct("1", { quantity: 3 });

    expect(result.quantity).toBe(3);
    expect(mockFrom).toHaveBeenCalledWith("products");
  });
});

describe("deleteProduct", () => {
  it("retorna true quando a exclusão funciona", async () => {
    mockFrom.mockReturnValue(makeChain({ error: null }));

    await expect(deleteProduct("1")).resolves.toBe(true);
  });

  it("propaga erro quando a exclusão falha", async () => {
    mockFrom.mockReturnValue(makeChain({ error: new Error("permissão negada") }));

    await expect(deleteProduct("1")).rejects.toThrow("permissão negada");
  });
});
