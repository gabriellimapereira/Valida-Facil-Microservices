import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockStorageFrom = vi.fn(() => ({
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
}));

vi.mock("../lib/supabaseClient", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (...args) => mockFrom(...args),
    storage: {
      from: (...args) => mockStorageFrom(...args),
    },
  },
}));

const mockApiPost = vi.fn();
vi.mock("../lib/apiClient", () => ({
  apiClient: { post: (...args) => mockApiPost(...args) },
}));

import { fetchCompany, updateCompany, createCompany, uploadCompanyLogo, removeCompanyLogo } from "./companyService";

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
  mockUpload.mockReset();
  mockGetPublicUrl.mockReset();
  mockStorageFrom.mockClear();
});

describe("fetchCompany", () => {
  it("mapeia notification_email -> notificationEmail e logo_url -> logoUrl", async () => {
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
          logo_url: "https://supabase.co/storage/v1/object/public/logos/c1/logo.png",
        },
        error: null,
      })
    );

    const result = await fetchCompany("company-1");

    expect(result.notificationEmail).toBe("estoque@empresa.com");
    expect(result.name).toBe("Empório Boa Safra");
    expect(result.logoUrl).toBe("https://supabase.co/storage/v1/object/public/logos/c1/logo.png");
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
  it("converte notificationEmail -> notification_email e logoUrl -> logo_url no payload", async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: {
          id: "company-1",
          name: "Novo Nome",
          notification_email: "novo@empresa.com",
          logo_url: "https://url.com/logo.png",
        },
        error: null,
      })
    );

    const result = await updateCompany("company-1", {
      name: "Novo Nome",
      notificationEmail: "novo@empresa.com",
      logoUrl: "https://url.com/logo.png",
    });

    expect(result.notificationEmail).toBe("novo@empresa.com");
    expect(result.name).toBe("Novo Nome");
    expect(result.logoUrl).toBe("https://url.com/logo.png");
  });

  it("ignora chaves que não existem no mapeamento (evita enviar lixo pro banco)", async () => {
    mockFrom.mockReturnValue(makeChain({ data: { id: "company-1", name: "X" }, error: null }));

    await updateCompany("company-1", { name: "X", campoQueNaoExiste: "deveria sumir" });

    expect(mockFrom).toHaveBeenCalledWith("companies");
  });
});

describe("uploadCompanyLogo", () => {
  it("bloqueia formato de arquivo não suportado", async () => {
    const invalidFile = new File(["dummy"], "teste.exe", { type: "application/x-msdownload" });
    await expect(uploadCompanyLogo("company-1", invalidFile)).rejects.toThrow("Formato inválido");
  });

  it("bloqueia arquivo maior que 3MB", async () => {
    const bigFile = new File([new ArrayBuffer(4 * 1024 * 1024)], "foto.png", { type: "image/png" });
    await expect(uploadCompanyLogo("company-1", bigFile)).rejects.toThrow("máximo 3MB");
  });

  it("faz upload no bucket logos e atualiza a empresa", async () => {
    const file = new File(["dummy"], "minha-logo.png", { type: "image/png" });
    mockUpload.mockResolvedValue({ data: { path: "company-1/logo.png" }, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://storage.fake/logos/company-1/logo.png" } });

    mockFrom.mockReturnValue(
      makeChain({
        data: { id: "company-1", name: "Empresa", logo_url: "https://storage.fake/logos/company-1/logo.png" },
        error: null,
      })
    );

    const result = await uploadCompanyLogo("company-1", file);

    expect(mockStorageFrom).toHaveBeenCalledWith("logos");
    expect(mockUpload).toHaveBeenCalled();
    expect(result.logoUrl).toBe("https://storage.fake/logos/company-1/logo.png");
  });
});

describe("removeCompanyLogo", () => {
  it("chama updateCompany com logoUrl nulo", async () => {
    mockFrom.mockReturnValue(
      makeChain({
        data: { id: "company-1", name: "Empresa", logo_url: null },
        error: null,
      })
    );

    const result = await removeCompanyLogo("company-1");

    expect(result.logoUrl).toBeNull();
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
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.notificationEmail).toBe("estoque@empresa.com");
  });

  it("propaga erro do backend (ex: usuário já tem empresa)", async () => {
    mockApiPost.mockRejectedValue(new Error("Este usuário já está vinculado a uma empresa."));

    await expect(createCompany({ name: "X", notificationEmail: "a@b.com", initials: "X" })).rejects.toThrow(
      "Este usuário já está vinculado a uma empresa."
    );
  });
});
