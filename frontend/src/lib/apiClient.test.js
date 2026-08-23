import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// apiClient.js decide seu comportamento com base em duas coisas que vêm
// de "./supabaseClient": se o Supabase está configurado, e a sessão atual
// (via supabase.auth.getSession()). Usamos vi.doMock + import dinâmico
// (em vez de vi.mock estático) porque cada teste precisa de uma
// combinação diferente dessas duas variáveis.
describe("apiClient", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  async function loadApiClient({ configured, token = null, sessionError = null } = {}) {
    vi.doMock("./supabaseClient", () => ({
      isSupabaseConfigured: configured,
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue(
            sessionError
              ? { data: null, error: sessionError }
              : { data: { session: token ? { access_token: token } : null }, error: null }
          ),
        },
      },
    }));
    const mod = await import("./apiClient");
    return mod.apiClient;
  }

  it("recusa a chamada quando o Supabase não está configurado", async () => {
    const apiClient = await loadApiClient({ configured: false });

    await expect(apiClient.get("/health")).rejects.toThrow(/backend \+ Supabase configurados/i);
  });

  it("recusa a chamada quando não há sessão ativa (token nulo)", async () => {
    const apiClient = await loadApiClient({ configured: true, token: null });

    await expect(apiClient.get("/health")).rejects.toThrow(/sessão expirada/i);
  });

  it("propaga o erro quando o Supabase falha ao restaurar a sessão", async () => {
    const apiClient = await loadApiClient({ configured: true, sessionError: new Error("sessão corrompida") });

    await expect(apiClient.get("/health")).rejects.toThrow("sessão corrompida");
  });

  it("envia o token no header e o corpo em JSON numa chamada bem-sucedida", async () => {
    const apiClient = await loadApiClient({ configured: true, token: "token-123" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true }),
    });

    const result = await apiClient.post("/movements", { product_id: "p1", quantity_delta: -5 });

    expect(result).toEqual({ ok: true });
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain("/movements");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer token-123");
    expect(JSON.parse(options.body)).toEqual({ product_id: "p1", quantity_delta: -5 });
  });

  it("monta a query string e ignora valores vazios/indefinidos", async () => {
    const apiClient = await loadApiClient({ configured: true, token: "token-123" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => [],
    });

    await apiClient.get("/movements/low-stock", { window_days: 15, vazio: "", indefinido: undefined });

    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain("window_days=15");
    expect(url).not.toContain("vazio=");
    expect(url).not.toContain("indefinido=");
  });

  it("lança o texto de 'detail' devolvido pelo backend quando a resposta não é ok", async () => {
    const apiClient = await loadApiClient({ configured: true, token: "token-123" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => "application/json" },
      json: async () => ({ detail: "Quantidade insuficiente em estoque." }),
    });

    await expect(apiClient.post("/movements", {})).rejects.toThrow("Quantidade insuficiente em estoque.");
  });

  it("usa mensagem genérica quando o erro não vem com 'detail' em texto", async () => {
    const apiClient = await loadApiClient({ configured: true, token: "token-123" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => "application/json" },
      json: async () => ({}),
    });

    await expect(apiClient.get("/health")).rejects.toThrow("Erro 500 no servidor.");
  });

  it("lança mensagem amigável quando o fetch falha por rede", async () => {
    const apiClient = await loadApiClient({ configured: true, token: "token-123" });
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiClient.get("/health")).rejects.toThrow(/não foi possível conectar ao servidor/i);
  });

  it("não quebra quando a resposta não é JSON", async () => {
    const apiClient = await loadApiClient({ configured: true, token: "token-123" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "text/plain" },
      json: async () => {
        throw new Error("não deveria chamar json() aqui");
      },
    });

    await expect(apiClient.get("/health")).resolves.toBeNull();
  });
});
