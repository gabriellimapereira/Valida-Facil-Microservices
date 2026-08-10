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
