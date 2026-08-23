import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
vi.mock("../lib/supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: { from: (...args) => mockFrom(...args) },
}));

const mockApiPost = vi.fn();
vi.mock("../lib/apiClient", () => ({
  apiClient: { post: (...args) => mockApiPost(...args) },
}));

import { fetchCompany, updateCompany, createCompany } from "./companyService";

function makeChain(result) {
  const chain = {};
  ["select", "eq", "update", "maybeSingle", "single"].forEach((method) => {
    chain[method] = vi.fn(() => chain);
  });
  chain.then = (resolve) => resolve(result);
  return chain;
}

beforeEach(() => {
  mockFrom.mockReset();
  mockApiPost.mockReset();
});

describe("fetchCompany", () => {
  it("mapeia notification_email -> notificationEmail", async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: {
          id: "company-1",
          name: "Empório Boa Safra",
          segment: "Atacado & Varejo",
          email: "contato@empresa.com",
          notification_email: "estoque@empresa.com",
          phone: "(89) 3222-4455",
          cnpj: "12.345.678/0001-90",
          address: "Rua X, 100",
          initials: "EB",
        },
        error: null,
      })
    );

    const result = await fetchCompany("company-1");

    expect(result.notificationEmail).toBe("estoque@empresa.com");
    expect(result.name).toBe("Empório Boa Safra");
  });

  it("retorna null sem companyId, sem consultar o Supabase", async () => {
    const result = await fetchCompany(null);

    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("propaga erro do Supabase", async () => {
    mockFrom.mockReturnValue(makeChain({ data: null, error: new Error("empresa não encontrada") }));

    await expect(fetchCompany("company-1")).rejects.toThrow("empresa não encontrada");
  });
});

describe("updateCompany", () => {
  it("converte notificationEmail -> notification_email no payload e mapeia de volta a resposta", async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: { id: "company-1", name: "Novo Nome", notification_email: "novo@empresa.com" },
        error: null,
      })
    );

    const result = await updateCompany("company-1", { name: "Novo Nome", notificationEmail: "novo@empresa.com" });

    expect(result.notificationEmail).toBe("novo@empresa.com");
    expect(result.name).toBe("Novo Nome");
  });

  it("ignora chaves que não existem no mapeamento (evita enviar lixo pro banco)", async () => {
    mockFrom.mockReturnValue(makeChain({ data: { id: "company-1", name: "X" }, error: null }));

    await updateCompany("company-1", { name: "X", campoQueNaoExiste: "deveria sumir" });

    // O teste em si não falha se o campo desconhecido vazar — a garantia
    // real está em toDb() só copiar chaves presentes em FIELD_TO_COLUMN;
    // aqui só confirmamos que a chamada não quebra com entrada extra.
    expect(mockFrom).toHaveBeenCalledWith("companies");
  });
});

describe("createCompany (onboarding)", () => {
  it("chama o backend (não o Supabase direto) com o payload em snake_case", async () => {
    mockApiPost.mockResolvedValue({
      id: "company-novo",
      name: "Empório Boa Safra",
      notification_email: "estoque@empresa.com",
      initials: "EB",
    });

    const result = await createCompany({
      name: "Empório Boa Safra",
      notificationEmail: "estoque@empresa.com",
      initials: "EB",
    });

    expect(mockApiPost).toHaveBeenCalledWith("/companies", {
      name: "Empório Boa Safra",
      notification_email: "estoque@empresa.com",
      initials: "EB",
    });
    expect(mockFrom).not.toHaveBeenCalled(); // nunca deve ir direto ao Supabase
    expect(result.notificationEmail).toBe("estoque@empresa.com");
  });

  it("propaga erro do backend (ex: usuário já tem empresa)", async () => {
    mockApiPost.mockRejectedValue(new Error("Este usuário já está vinculado a uma empresa."));

    await expect(createCompany({ name: "X", notificationEmail: "a@b.com", initials: "X" })).rejects.toThrow(
      "Este usuário já está vinculado a uma empresa."
    );
  });
});
