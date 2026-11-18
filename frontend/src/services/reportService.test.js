import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPost = vi.fn();
vi.mock("../lib/apiClient", () => ({
  getAccessToken: () => null,
  apiClient: { post: (...args) => mockPost(...args) },
}));

import { generateReport } from "./reportService";

beforeEach(() => {
  mockPost.mockReset();
  globalThis.URL.createObjectURL = vi.fn(() => "blob:http://localhost/fake-pdf");
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe("generateReport", () => {
  it("gera PDF 100% no frontend por padrão sem chamar o backend", async () => {
    const result = await generateReport({ reportType: "estoque_atual" });

    expect(mockPost).not.toHaveBeenCalled();
    expect(result.url).toMatch(/^blob:/);
    expect(result.filename).toMatch(/^estoque_atual-.*\.pdf$/);
    expect(result.expiresInSeconds).toBe(3600);
  });

  it("gera relatório de produtos_a_vencer no frontend", async () => {
    const result = await generateReport({
      reportType: "produtos_a_vencer",
      expiryWindowDays: 30,
    });

    expect(mockPost).not.toHaveBeenCalled();
    expect(result.filename).toMatch(/^produtos_a_vencer-.*\.pdf$/);
  });

  it("gera relatórios de movimentações e giro de estoque no frontend", async () => {
    const resultMov = await generateReport({
      reportType: "movimentacoes",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-20",
    });
    expect(resultMov.filename).toMatch(/^movimentacoes-.*\.pdf$/);

    const resultGiro = await generateReport({
      reportType: "giro_estoque",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-20",
    });
    expect(resultGiro.filename).toMatch(/^giro_estoque-.*\.pdf$/);
  });

  it("repassa formato xlsx para o backend quando solicitado", async () => {
    mockPost.mockResolvedValue({
      url: "https://storage.fake/mov.xlsx",
      filename: "mov.xlsx",
      expires_in_seconds: 600,
    });

    const result = await generateReport({
      reportType: "movimentacoes",
      format: "xlsx",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-20",
    });

    expect(mockPost).toHaveBeenCalledWith("/reports/generate", {
      report_type: "movimentacoes",
      format: "xlsx",
      date_from: "2026-08-01",
      date_to: "2026-08-20",
      expiry_window_days: 15,
    });
    expect(result.filename).toBe("mov.xlsx");
  });
});
