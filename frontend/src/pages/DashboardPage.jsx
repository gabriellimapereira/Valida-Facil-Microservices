import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Boxes, CheckCircle2, Layers, Plus, ShieldAlert, TrendingUp } from "lucide-react";
import MetricCard from "../components/ui/MetricCard";
import ExpiryBadge from "../components/ui/ExpiryBadge";
import TactileButton from "../components/ui/TactileButton";
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
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 sm:p-7 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <p className="text-xs sm:text-sm font-semibold text-amber-600 capitalize mb-1">{todayLabel}</p>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">
            {greeting}, {company.name.split(" ").slice(0, 2).join(" ")}
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5 sm:mt-1">
            Aqui está o resumo do seu estoque hoje.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <TactileButton
            onClick={() => navigate("/estoque?novo=1")}
            variant="amber"
            padding="10px 20px"
            rounded={12}
            className="w-full sm:w-auto"
          >
            <Plus size={17} className="mr-1.5" />
            Novo produto
          </TactileButton>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <MetricCard
          icon={Boxes}
          label="Total de produtos"
          value={totalProducts}
          accent="navy"
          sub={`${activeCategories} categorias ativas`}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Perto de vencer"
          value={expiringSoon.length}
          accent="gold"
          sub="Nos próximos 15 dias"
        />
        <MetricCard
          icon={Layers}
          label="Categorias ativas"
          value={activeCategories}
          accent="teal"
          sub="Segmentos cadastrados"
        />
        <MetricCard
          icon={TrendingUp}
          label="Patrimônio em estoque"
          value={brl(totalValue)}
          accent="emerald"
          sub={`${lowStockItems.length} item(ns) em nível baixo`}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Expiring Soon List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-5 sm:py-6 border-b border-slate-100 bg-slate-50/40">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100/80 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base leading-snug">Produtos próximos do vencimento</h3>
                <p className="text-xs text-slate-500 mt-0.5">Classificados por ordem de urgência</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/estoque")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 transition py-1 px-2 rounded-lg hover:bg-teal-50 cursor-pointer"
            >
              Ver estoque completo
              <ArrowRight size={13} />
            </button>
          </div>

          {expiringSoon.length === 0 ? (
            <div className="p-12 text-center my-auto">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-3 border border-teal-100">
                <CheckCircle2 size={24} />
              </div>
              <p className="text-sm font-semibold text-slate-800">Nenhum produto a vencer nos próximos 15 dias</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                Seu estoque está saudável e com as validades rigorosamente em dia.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
              {expiringSoon.map((p) => {
                const urgency = expiryUrgency(p.expiry);
                const days = daysUntil(p.expiry);
                return (
                  <li
                    key={p.id}
                    onClick={() => navigate("/estoque")}
                    className="flex items-center gap-4 px-6 py-5 hover:bg-slate-50/80 transition cursor-pointer group"
                  >
                    <span className={`w-3 h-3 rounded-full shrink-0 ${urgency.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <p className="text-base font-bold text-slate-900 group-hover:text-amber-700 transition truncate leading-normal">
                          {p.name}
                        </p>
                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/70">
                          {p.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 mt-1.5 text-xs">
                        <span className="text-slate-500 font-medium">{p.quantity} unidades</span>
                        <span className="text-slate-300">•</span>
                        <span className={`font-semibold ${days <= 3 ? "text-red-600" : days <= 7 ? "text-amber-600" : "text-slate-500"}`}>
                          {days < 0 ? `Vencido há ${Math.abs(days)}d` : days === 0 ? "Vence hoje!" : `Vence em ${days} dia(s)`}
                        </span>
                      </div>
                    </div>
                    <ExpiryBadge urgency={urgency} size="md" />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Right Column: Low Stock & Category Distribution */}
        <div className="space-y-6 flex flex-col">
          {/* Low Stock Alert Box */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Alerta de estoque baixo</h3>
                <p className="text-xs text-slate-400 mt-0.5">Itens que precisam de reposição</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                lowStockItems.length > 0 ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-teal-50 text-teal-800 border-teal-200"
              }`}>
                {lowStockItems.length} {lowStockItems.length === 1 ? "item" : "itens"}
              </span>
            </div>

            {lowStockItems.length === 0 ? (
              <div className="py-7 px-4 text-center bg-teal-50/40 rounded-2xl border border-teal-100/60 my-auto">
                <div className="w-10 h-10 rounded-xl bg-teal-100/80 text-teal-700 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">Estoque em conformidade</p>
                <p className="text-xs text-slate-500 mt-0.5">Todos os itens estão acima do mínimo.</p>
              </div>
            ) : (
              <ul className="space-y-3 my-auto">
                {lowStockItems.slice(0, 4).map((p) => {
                  const isOutOfStock = p.quantity === 0;
                  const pct = Math.min(100, Math.round((p.quantity / (p.minStock || 1)) * 100));
                  return (
                    <li
                      key={p.id}
                      onClick={() => navigate("/estoque")}
                      className="p-3 rounded-xl hover:bg-slate-50 transition cursor-pointer border border-transparent hover:border-slate-200/80 group"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1.5">
                        <span className="truncate pr-2 group-hover:text-amber-700 transition-colors">{p.name}</span>
                        <span className={`shrink-0 font-mono text-[11px] px-2 py-0.5 rounded-md font-bold ${
                          isOutOfStock ? "bg-red-100 text-red-700 border border-red-200" : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}>
                          {isOutOfStock ? "Esgotado (0)" : `${p.quantity} / ${p.minStock} un`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOutOfStock ? "bg-red-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.max(8, pct)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Category Distribution Box */}
          <div className="bg-navy rounded-2xl p-6 text-white shadow-sm border border-slate-800 flex-1">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-white">Distribuição por categoria</h3>
                <p className="text-xs text-slate-400 mt-0.5">Participação no estoque</p>
              </div>
              <span className="text-xs font-mono text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-md border border-white/10">
                {totalProducts} produtos
              </span>
            </div>
            <ul className="space-y-4">
              {CATEGORIES.map((c) => {
                const count = products.filter((p) => p.category === c.id).length;
                const pct = totalProducts ? Math.round((count / totalProducts) * 100) : 0;
                return (
                  <li key={c.id}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-300 font-medium">{c.label}</span>
                      <span className="text-slate-400 font-mono">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
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
