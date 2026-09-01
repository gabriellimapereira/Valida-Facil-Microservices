import React from "react";
import { ChevronDown, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { CATEGORIES } from "../../data/categories";
import DatePicker from "../ui/DatePicker";
import { fmtDate } from "../../utils/formatters";

export default function ProductFilters({
  filters,
  setFilters,
  filtersOpen,
  setFiltersOpen,
  activeFilterCount,
  clearFilters,
}) {
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const categoryLabel = CATEGORIES.find((c) => c.id === filters.category)?.label;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3.5">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Buscar por nome ou código do produto..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200/90 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => set("search", "")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md transition"
              title="Limpar busca"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition select-none cursor-pointer ${
            filtersOpen || activeFilterCount > 0
              ? "border-amber-500/50 bg-amber-50/50 text-amber-900"
              : "border-slate-200 text-slate-700 hover:bg-slate-50"
          }`}
        >
          <SlidersHorizontal size={16} className={activeFilterCount > 0 ? "text-amber-600" : "text-slate-500"} />
          Filtros avançados
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            size={15}
            className={`transition-transform duration-200 ${filtersOpen ? "rotate-180 text-amber-600" : "text-slate-400"}`}
          />
        </button>
      </div>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-medium text-slate-400">Filtros ativos:</span>
          {filters.category !== "all" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              Categoria: {categoryLabel}
              <button
                type="button"
                onClick={() => set("category", "all")}
                className="hover:text-red-600 transition"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {filters.dateFrom && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              De: {fmtDate(filters.dateFrom)}
              <button
                type="button"
                onClick={() => set("dateFrom", "")}
                className="hover:text-red-600 transition"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {filters.dateTo && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              Até: {fmtDate(filters.dateTo)}
              <button
                type="button"
                onClick={() => set("dateTo", "")}
                className="hover:text-red-600 transition"
              >
                <X size={12} />
              </button>
            </span>
          )}
          {filters.sortPrice !== "none" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
              Preço: {filters.sortPrice === "asc" ? "Menor primeiro" : "Maior primeiro"}
              <button
                type="button"
                onClick={() => set("sortPrice", "none")}
                className="hover:text-red-600 transition"
              >
                <X size={12} />
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 transition ml-1"
          >
            <RotateCcw size={12} />
            Limpar todos
          </button>
        </div>
      )}

      {/* Advanced Filter Collapsible Area */}
      {filtersOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 pt-3.5 border-t border-slate-100 animate-in fade-in duration-150">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Categoria / Segmento</label>
            <select
              value={filters.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
            >
              <option value="all">Todas as categorias</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Validade – a partir de</label>
            <DatePicker
              value={filters.dateFrom}
              onChange={(e) => set("dateFrom", e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Validade – até</label>
            <DatePicker
              value={filters.dateTo}
              onChange={(e) => set("dateTo", e.target.value)}
              placeholder="dd/mm/aaaa"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Ordenar por valor</label>
            <select
              value={filters.sortPrice}
              onChange={(e) => set("sortPrice", e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
            >
              <option value="none">Padrão</option>
              <option value="asc">Menor preço primeiro</option>
              <option value="desc">Maior preço primeiro</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
