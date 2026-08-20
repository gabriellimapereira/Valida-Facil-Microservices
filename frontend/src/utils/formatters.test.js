import { describe, it, expect } from "vitest";
import { brl, fmtDate, daysUntil, expiryUrgency, isLowStock, catInfo } from "./formatters";

describe("brl", () => {
  // O Intl do Node formata moeda pt-BR com um espaço "não-quebrável"
  // (U+00A0) depois do "R$", não um espaço comum — normalizamos aqui pra
  // o teste não depender de detalhe de formatação do motor JS.
  const normalize = (s) => s.replace(/\u00A0/g, " ");

  it("formata número como moeda brasileira", () => {
    expect(normalize(brl(1234.5))).toBe("R$ 1.234,50");
  });

  it("trata valores ausentes como zero", () => {
    expect(normalize(brl(undefined))).toBe("R$ 0,00");
    expect(normalize(brl(null))).toBe("R$ 0,00");
  });
});

describe("fmtDate", () => {
  it("converte ISO (yyyy-mm-dd) para dd/mm/yyyy", () => {
    expect(fmtDate("2026-08-25")).toBe("25/08/2026");
  });

  it("retorna travessão quando não há data", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate(undefined)).toBe("—");
  });
});

describe("daysUntil", () => {
  it("retorna null quando não há data", () => {
    expect(daysUntil(null)).toBeNull();
  });

  it("calcula quantos dias faltam a partir de hoje", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + 5);
    const iso = future.toISOString().slice(0, 10);

    expect(daysUntil(iso)).toBe(5);
  });

  it("retorna número negativo para datas já vencidas", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const past = new Date(today);
    past.setDate(past.getDate() - 3);
    const iso = past.toISOString().slice(0, 10);

    expect(daysUntil(iso)).toBe(-3);
  });
});

describe("expiryUrgency", () => {
  const isoInDays = (days) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  it("retorna null quando o produto não tem validade", () => {
    expect(expiryUrgency(null)).toBeNull();
  });

  it("classifica como crítico quando vence hoje ou em até 2 dias", () => {
    expect(expiryUrgency(isoInDays(0)).level).toBe("critical");
    expect(expiryUrgency(isoInDays(2)).level).toBe("critical");
  });

  it("classifica como vencido quando a data já passou", () => {
    const result = expiryUrgency(isoInDays(-1));
    expect(result.level).toBe("critical");
    expect(result.label).toBe("Vencido");
  });

  it("classifica como alto entre 3 e 7 dias", () => {
    expect(expiryUrgency(isoInDays(5)).level).toBe("high");
  });

  it("classifica como médio entre 8 e 15 dias", () => {
    expect(expiryUrgency(isoInDays(10)).level).toBe("medium");
  });

  it("classifica como baixo acima de 15 dias", () => {
    expect(expiryUrgency(isoInDays(30)).level).toBe("low");
  });
});

describe("isLowStock", () => {
  it("é true quando a quantidade é igual ou menor que o mínimo", () => {
    expect(isLowStock({ quantity: 5, minStock: 10 })).toBe(true);
    expect(isLowStock({ quantity: 10, minStock: 10 })).toBe(true);
  });

  it("é false quando a quantidade está acima do mínimo", () => {
    expect(isLowStock({ quantity: 11, minStock: 10 })).toBe(false);
  });
});

describe("catInfo", () => {
  it("encontra a categoria pelo id", () => {
    expect(catInfo("perecivel").label).toBe("Perecível (Alimentos)");
  });

  it("cai no fallback (última categoria) quando o id não existe", () => {
    expect(catInfo("categoria-inexistente")).toEqual(catInfo("outros"));
  });
});
