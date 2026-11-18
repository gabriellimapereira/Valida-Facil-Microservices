import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("apiClient", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requires a native session for protected calls", async () => {
    const { apiClient } = await import("./apiClient");
    await expect(apiClient.get("/companies/me")).rejects.toThrow(/sessão expirada/i);
  });

  it("sends the stored native JWT and JSON body", async () => {
    localStorage.setItem("valida_facil_token", "token-123");
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ ok: true }),
    });
    const { apiClient } = await import("./apiClient");

    await expect(apiClient.post("/movements", { quantity_delta: -5 })).resolves.toEqual({ ok: true });
    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("/movements");
    expect(options.headers.Authorization).toBe("Bearer token-123");
    expect(JSON.parse(options.body)).toEqual({ quantity_delta: -5 });
  });

  it("allows unauthenticated auth endpoints without adding an authorization header", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ valid: true }),
    });
    const { apiClient } = await import("./apiClient");

    await expect(apiClient.getPublic("/auth/password-reset/validate", { token: "reset-token" }))
      .resolves.toEqual({ valid: true });
    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toContain("token=reset-token");
    expect(options.headers.Authorization).toBeUndefined();
  });

  it("surfaces API errors and network errors", async () => {
    localStorage.setItem("valida_facil_token", "token-123");
    const { apiClient } = await import("./apiClient");
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => "application/json" },
      json: async () => ({ detail: "Invalid request." }),
    });
    await expect(apiClient.get("/companies/me")).rejects.toThrow("Invalid request.");

    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiClient.get("/companies/me")).rejects.toThrow(/não foi possível conectar/i);
  });
});
