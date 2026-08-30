import React from "react";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { CATEGORIES } from "../../data/categories";
import DatePicker from "../ui/DatePicker";

export default function ProductFilters({ filters, setFilters, filtersOpen, setFiltersOpen, activeFilterCount, clearFilters }) {
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Buscar por nome ou código do produto..."
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition relative select-none"
        >
          <SlidersHorizontal size={16} />
          Filtros avançados
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown size={15} className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {filtersOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Categoria / Tipo</label>
            <select value={filters.category} onChange={(e) => set("category", e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30">
              <option value="all">Todas as categorias</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Validade – de</label>
            <DatePicker value={filters.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} placeholder="De dd/mm/aaaa" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Validade – até</label>
            <DatePicker value={filters.dateTo} onChange={(e) => set("dateTo", e.target.value)} placeholder="Até dd/mm/aaaa" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Ordenar por preço</label>
            <select value={filters.sortPrice} onChange={(e) => set("sortPrice", e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30">
              <option value="none">Padrão</option>
              <option value="asc">Menor preço primeiro</option>
              <option value="desc">Maior preço primeiro</option>
            </select>
          </div>
          {activeFilterCount > 0 && (
            <button type="button" onClick={clearFilters} className="xl:col-span-4 text-xs font-semibold text-teal-600 hover:text-teal-700 text-left">
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
