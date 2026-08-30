import { CATEGORIES } from "../data/categories";

export const catInfo = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

export const brl = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDate = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

export const daysUntil = (iso) => {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${iso}T00:00:00`);
  return Math.round((target - today) / 86400000);
};

export function expiryUrgency(iso) {
  const d = daysUntil(iso);
  if (d === null) return null;
  if (d <= 2) {
    return {
      level: "critical",
      label: d < 0 ? "Vencido" : d === 0 ? "Vence hoje" : `Vence em ${d} dia${d === 1 ? "" : "s"}`,
      dot: "bg-red-500",
      chip: "bg-red-50 text-red-700 border-red-200",
    };
  }
  if (d <= 7) {
    return { level: "high", label: `Vence em ${d} dias`, dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  if (d <= 15) {
    return { level: "medium", label: `Vence em ${d} dias`, dot: "bg-teal-500", chip: "bg-teal-50 text-teal-700 border-teal-200" };
  }
  return { level: "low", label: `Vence em ${d} dias`, dot: "bg-slate-300", chip: "bg-slate-50 text-slate-600 border-slate-200" };
}

export const isLowStock = (p) => p.quantity <= p.minStock;

// Aplica a máscara 00.000.000/0000-00 progressivamente enquanto digita, e
// SEMPRE corta em 14 dígitos — não tem como digitar CNPJ maior que isso.
export function formatCnpj(value) {
  const digits = (value || "").replace(/\D/g, "").slice(0, 14);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 8), digits.slice(8, 12), digits.slice(12, 14)];
  let result = parts[0];
  if (parts[1]) result += `.${parts[1]}`;
  if (parts[2]) result += `.${parts[2]}`;
  if (parts[3]) result += `/${parts[3]}`;
  if (parts[4]) result += `-${parts[4]}`;
  return result;
}

// Valida o CNPJ de verdade (dígitos verificadores, módulo 11) — não só a
// quantidade de dígitos. Impede cadastrar um CNPJ que tem 14 dígitos mas
// é matematicamente inválido (ex: inventado ou digitado errado).
export function isValidCnpj(value) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false; // todos os dígitos iguais nunca é válido

  const calcCheckDigit = (base) => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.split("").reduce((acc, digit, i) => acc + Number(digit) * weights[i], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const base = digits.slice(0, 12);
  const digit1 = calcCheckDigit(base);
  const digit2 = calcCheckDigit(base + digit1);

  return digits === base + String(digit1) + String(digit2);
}

// Máscara progressiva de telefone brasileiro — reconhece sozinho se é fixo
// (10 dígitos, "(00) 0000-0000") ou celular (11 dígitos, "(00) 00000-0000")
// conforme a quantidade digitada, e corta em 11 dígitos no máximo.
export function formatPhone(value) {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
