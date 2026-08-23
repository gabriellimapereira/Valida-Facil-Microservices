import React from "react";
import { ArrowLeftRight, ArrowUpDown, ChevronLeft, ChevronRight, PackageSearch, Pencil, Trash2 } from "lucide-react";
import CategoryBadge from "../ui/CategoryBadge";
import { brl, fmtDate, expiryUrgency, isLowStock } from "../../utils/formatters";

function StatusChips({ p }) {
  const urgency = expiryUrgency(p.expiry);
  const low = isLowStock(p);
  if (!urgency && !low) {
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-teal-50 text-teal-700 border-teal-200">Ok</span>;
  }
  return (
    <>
      {urgency && <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${urgency.chip}`}>{urgency.label}</span>}
      {low && (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
          Estoque baixo
        </span>
      )}
    </>
  );
}

function EmptyState() {
  return (
    <div className="px-5 py-16 text-center">
      <PackageSearch size={32} className="mx-auto text-slate-300 mb-3" />
      <p className="text-sm font-medium text-slate-600">Nenhum produto encontrado</p>
      <p className="text-xs text-slate-400 mt-1">Ajuste os filtros ou cadastre um novo produto.</p>
    </div>
  );
}

function Pagination({ page, totalPages, totalCount, pageSize, setPage }) {
  if (totalCount === 0) return null;
  return (
    <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-t border-slate-100">
      <p className="text-xs text-slate-500">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} de {totalCount}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
          className="w-9 h-9 rounded-lg flex items-center justify-center border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs font-medium text-slate-600 px-2">{page} / {totalPages}</span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="w-9 h-9 rounded-lg flex items-center justify-center border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

export default function ProductTable({ items, page, totalPages, totalCount, pageSize, setPage, onEdit, onDelete, onMovement }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Telas >= md: tabela completa. 7 colunas ficam apertadas demais
         abaixo disso — vira lista de cards em vez de forçar rolagem
         horizontal, que é ruim de usar no celular. */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <th className="text-left font-semibold px-5 py-3">Produto</th>
              <th className="text-left font-semibold px-5 py-3">Categoria</th>
              <th className="text-right font-semibold px-5 py-3">
                <span className="inline-flex items-center gap-1 justify-end w-full">Preço <ArrowUpDown size={12} /></span>
              </th>
              <th className="text-center font-semibold px-5 py-3">Qtd.</th>
              <th className="text-left font-semibold px-5 py-3">Validade</th>
              <th className="text-left font-semibold px-5 py-3">Status</th>
              <th className="text-right font-semibold px-5 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50/70 transition">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.code}</p>
                </td>
                <td className="px-5 py-3.5"><CategoryBadge id={p.category} /></td>
                <td className="px-5 py-3.5 text-right font-medium text-slate-900">{brl(p.price)}</td>
                <td className="px-5 py-3.5 text-center">
                  <span className={isLowStock(p) ? "text-red-600 font-semibold" : "text-slate-700"}>{p.quantity}</span>
                </td>
                <td className="px-5 py-3.5 text-slate-600">{fmtDate(p.expiry)}</td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-col gap-1 items-start"><StatusChips p={p} /></div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => onMovement(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition" title="Registrar movimentação">
                      <ArrowLeftRight size={15} />
                    </button>
                    <button onClick={() => onEdit(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-teal-50 hover:text-teal-600 transition" title="Editar">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => onDelete(p)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-600 transition" title="Excluir">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7}><EmptyState /></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Telas < md: lista de cards, com botões grandes o bastante pro
         toque (alvo mínimo recomendado ~40-44px). */}
      <div className="md:hidden divide-y divide-slate-100">
        {items.map((p) => (
          <div key={p.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-slate-900 truncate">{p.name}</p>
                <p className="text-xs text-slate-400">{p.code}</p>
              </div>
              <p className="font-semibold text-slate-900 shrink-0">{brl(p.price)}</p>
            </div>

            <div className="flex items-center justify-between">
              <CategoryBadge id={p.category} />
              <span className={`text-sm ${isLowStock(p) ? "text-red-600 font-semibold" : "text-slate-700"}`}>
                {p.quantity} un. {p.expiry && <span className="text-slate-400 font-normal">· vence {fmtDate(p.expiry)}</span>}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5"><StatusChips p={p} /></div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => onMovement(p)}
                className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 active:bg-amber-50 active:text-amber-600 transition"
              >
                <ArrowLeftRight size={15} /> Mover
              </button>
              <button
                onClick={() => onEdit(p)}
                className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 active:bg-teal-50 active:text-teal-600 transition"
              >
                <Pencil size={15} /> Editar
              </button>
              <button
                onClick={() => onDelete(p)}
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-red-50 active:text-red-600 transition"
                title="Excluir"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <EmptyState />}
      </div>

      <Pagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={pageSize} setPage={setPage} />
    </div>
  );
}
