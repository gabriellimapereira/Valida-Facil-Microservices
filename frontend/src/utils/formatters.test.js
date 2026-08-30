import { describe, it, expect } from "vitest";
import { brl, fmtDate, daysUntil, expiryUrgency, isLowStock, catInfo, formatCnpj, isValidCnpj, formatPhone } from "./formatters";

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

describe("formatCnpj", () => {
  it("aplica a máscara progressivamente conforme digita", () => {
    expect(formatCnpj("1")).toBe("1");
    expect(formatCnpj("12")).toBe("12");
    expect(formatCnpj("123")).toBe("12.3");
    expect(formatCnpj("12345678")).toBe("12.345.678");
    expect(formatCnpj("123456780001")).toBe("12.345.678/0001");
    expect(formatCnpj("12345678000190")).toBe("12.345.678/0001-90");
  });

  it("nunca ultrapassa 14 dígitos, mesmo digitando mais", () => {
    expect(formatCnpj("123456780001909999")).toBe("12.345.678/0001-90");
  });

  it("ignora caracteres não numéricos digitados no meio", () => {
    expect(formatCnpj("12.345.678/0001-90")).toBe("12.345.678/0001-90");
    expect(formatCnpj("abc12345678000190xyz")).toBe("12.345.678/0001-90");
  });

  it("lida com valor vazio ou nulo sem quebrar", () => {
    expect(formatCnpj("")).toBe("");
    expect(formatCnpj(null)).toBe("");
    expect(formatCnpj(undefined)).toBe("");
  });
});

describe("isValidCnpj", () => {
  it("aceita CNPJs matematicamente válidos (dígitos verificadores corretos)", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.444.777/0001-61")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true); // sem pontuação também funciona
  });

  it("rejeita CNPJ com dígitos verificadores errados", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false); // último dígito trocado
    expect(isValidCnpj("12.345.678/0001-90")).toBe(false); // sequência aleatória
  });

  it("rejeita CNPJ com todos os dígitos iguais", () => {
    expect(isValidCnpj("11.111.111/1111-11")).toBe(false);
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
  });

  it("rejeita quando não tem 14 dígitos", () => {
    expect(isValidCnpj("11.222.333/0001-8")).toBe(false);
    expect(isValidCnpj("")).toBe(false);
    expect(isValidCnpj(null)).toBe(false);
    expect(isValidCnpj(undefined)).toBe(false);
  });
});

describe("formatPhone", () => {
  it("aplica a máscara progressivamente conforme digita", () => {
    expect(formatPhone("8")).toBe("(8");
    expect(formatPhone("89")).toBe("(89");
    expect(formatPhone("8932")).toBe("(89) 32");
  });

  it("formata como telefone fixo com 10 dígitos", () => {
    expect(formatPhone("8932224455")).toBe("(89) 3222-4455");
  });

  it("formata como celular com 11 dígitos", () => {
    expect(formatPhone("89987654321")).toBe("(89) 98765-4321");
  });

  it("nunca ultrapassa 11 dígitos, mesmo digitando mais", () => {
    expect(formatPhone("899876543219999")).toBe("(89) 98765-4321");
  });

  it("ignora caracteres não numéricos", () => {
    expect(formatPhone("(89) 98765-4321")).toBe("(89) 98765-4321");
  });

  it("lida com valor vazio ou nulo sem quebrar", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone(null)).toBe("");
    expect(formatPhone(undefined)).toBe("");
  });
});
