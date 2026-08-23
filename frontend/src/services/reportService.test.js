import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPost = vi.fn();
vi.mock("../lib/apiClient", () => ({
  apiClient: { post: (...args) => mockPost(...args) },
}));

import { generateReport } from "./reportService";

beforeEach(() => {
  mockPost.mockReset();
});

describe("generateReport", () => {
  it("envia o payload certo e usa 'pdf' como formato padrão", async () => {
    mockPost.mockResolvedValue({ url: "https://storage.fake/x.pdf", filename: "x.pdf", expires_in_seconds: 600 });

    await generateReport({ reportType: "estoque_atual" });

    expect(mockPost).toHaveBeenCalledWith("/reports/generate", {
      report_type: "estoque_atual",
      format: "pdf",
      date_from: undefined,
      date_to: undefined,
      expiry_window_days: undefined,
    });
  });

  it("repassa datas e janela de validade quando informadas", async () => {
    mockPost.mockResolvedValue({ url: "u", filename: "f", expires_in_seconds: 600 });

    await generateReport({
      reportType: "movimentacoes",
      format: "xlsx",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-20",
      expiryWindowDays: 30,
    });

    expect(mockPost).toHaveBeenCalledWith("/reports/generate", {
      report_type: "movimentacoes",
      format: "xlsx",
      date_from: "2026-08-01",
      date_to: "2026-08-20",
      expiry_window_days: 30,
    });
  });

  it("remapeia a resposta pra camelCase", async () => {
    mockPost.mockResolvedValue({
      url: "https://storage.fake/relatorio.pdf",
      filename: "estoque_atual-20260820.pdf",
      expires_in_seconds: 600,
    });

    const result = await generateReport({ reportType: "estoque_atual" });

    expect(result).toEqual({
      url: "https://storage.fake/relatorio.pdf",
      filename: "estoque_atual-20260820.pdf",
      expiresInSeconds: 600,
    });
  });

  it("propaga erro do backend", async () => {
    mockPost.mockRejectedValue(new Error("Falha ao gerar relatório: sem dados no período."));

    await expect(generateReport({ reportType: "movimentacoes" })).rejects.toThrow(
      "Falha ao gerar relatório: sem dados no período."
    );
  });
});
