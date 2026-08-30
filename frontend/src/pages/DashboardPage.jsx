import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Boxes, Layers, Plus, ShieldAlert, TrendingUp } from "lucide-react";
import MetricCard from "../components/ui/MetricCard";
import ExpiryBadge from "../components/ui/ExpiryBadge";
import { useProducts } from "../context/ProductContext";
import { useCompany } from "../context/CompanyContext";
import { CATEGORIES } from "../data/categories";
import { brl, daysUntil, expiryUrgency, isLowStock } from "../utils/formatters";

export default function DashboardPage() {
  const { products } = useProducts();
  const { company } = useCompany();
  const navigate = useNavigate();

  const totalProducts = products.length;
  const totalValue = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const activeCategories = new Set(products.map((p) => p.category)).size;
  const lowStockItems = products.filter(isLowStock);

  const expiringSoon = products
    .filter((p) => p.expiry && daysUntil(p.expiry) <= 15)
    .sort((a, b) => daysUntil(a.expiry) - daysUntil(b.expiry));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const todayLabel = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  if (!company) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-sm text-amber-600 font-medium capitalize">{todayLabel}</p>
          <h2 className="text-2xl font-bold text-slate-900 mt-0.5">
            {greeting}, {company.name.split(" ").slice(0, 2).join(" ")}
          </h2>
          <p className="text-slate-500 text-sm mt-1">Aqui está um resumo do seu estoque hoje.</p>
        </div>
        <button
          onClick={() => navigate("/estoque?novo=1")}
          className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-sm shadow-amber-600/20 w-fit"
        >
          <Plus size={17} />
          Novo produto
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={Boxes} label="Total de produtos" value={totalProducts} accent="navy" sub={`${activeCategories} categorias ativas`} />
        <MetricCard icon={AlertTriangle} label="Perto de vencer" value={expiringSoon.length} accent="gold" sub="Nos próximos 15 dias" />
        <MetricCard icon={Layers} label="Categorias ativas" value={activeCategories} accent="teal" sub="Tipos de produto distintos" />
        <MetricCard icon={TrendingUp} label="Valor em estoque" value={brl(totalValue)} accent="light" sub={`${lowStockItems.length} item(ns) com estoque baixo`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
                <ShieldAlert size={17} className="text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 text-sm">Produtos próximos do vencimento</p>
                <p className="text-xs text-slate-500">Ordenados por urgência</p>
              </div>
            </div>
            <button onClick={() => navigate("/estoque")} className="text-xs font-semibold text-teal-600 hover:text-teal-700">
              Ver tudo
            </button>
          </div>

          {expiringSoon.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Nenhum produto perecível próximo do vencimento. Tudo em dia!
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
              {expiringSoon.map((p) => {
                const urgency = expiryUrgency(p.expiry);
                return (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${urgency.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">{p.code}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-500">{p.quantity} un.</span>
                      </div>
                    </div>
                    <ExpiryBadge urgency={urgency} size="md" />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="font-semibold text-slate-900 text-sm mb-3">Estoque baixo</p>
            {lowStockItems.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum item abaixo do estoque mínimo.</p>
            ) : (
              <ul className="space-y-3">
                {lowStockItems.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-700 truncate">{p.name}</span>
                    <span className="text-xs font-semibold text-red-600 shrink-0">{p.quantity}/{p.minStock}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-navy rounded-2xl p-5 text-white shadow-sm">
            <p className="font-semibold text-sm mb-3">Distribuição por categoria</p>
            <ul className="space-y-2.5">
              {CATEGORIES.map((c) => {
                const count = products.filter((p) => p.category === c.id).length;
                const pct = totalProducts ? Math.round((count / totalProducts) * 100) : 0;
                return (
                  <li key={c.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">{c.label}</span>
                      <span className="text-slate-400">{count}</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
