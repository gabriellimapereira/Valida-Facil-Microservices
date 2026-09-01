import React from "react";
import { ArrowLeftRight, ArrowUpDown, ChevronLeft, ChevronRight, PackageSearch, Pencil, Trash2 } from "lucide-react";
import CategoryBadge from "../ui/CategoryBadge";
import ExpiryBadge from "../ui/ExpiryBadge";
import { brl, fmtDate, expiryUrgency, isLowStock } from "../../utils/formatters";

function StatusChips({ p }) {
  const urgency = expiryUrgency(p.expiry);
  const low = isLowStock(p);
  if (!urgency && !low) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border bg-teal-50 text-teal-700 border-teal-200">
        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
        Em dia
      </span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {urgency && <ExpiryBadge urgency={urgency} size="sm" />}
      {low && (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Estoque baixo
        </span>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-6 py-20 text-center">
      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3.5 border border-amber-100 shadow-sm">
        <PackageSearch size={24} />
      </div>
      <p className="text-sm font-semibold text-slate-800">Nenhum produto encontrado</p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
        Tente ajustar ou limpar os filtros de busca para visualizar os itens do estoque.
      </p>
    </div>
  );
}

function Pagination({ page, totalPages, totalCount, pageSize, setPage }) {
  if (totalCount === 0) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
      <p className="text-xs text-slate-500">
        Mostrando <strong className="text-slate-700 font-medium">{(page - 1) * pageSize + 1}</strong> a{" "}
        <strong className="text-slate-700 font-medium">{Math.min(page * pageSize, totalCount)}</strong> de{" "}
        <strong className="text-slate-700 font-medium">{totalCount}</strong> produtos
      </p>
      <div className="flex items-center gap-1.5">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-white hover:border-slate-300 hover:text-slate-700 transition cursor-pointer disabled:cursor-not-allowed"
          title="Página anterior"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs font-semibold text-slate-700 px-2 py-1 bg-white rounded-md border border-slate-200">
          {page} / {totalPages}
        </span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-white hover:border-slate-300 hover:text-slate-700 transition cursor-pointer disabled:cursor-not-allowed"
          title="Próxima página"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

export default function ProductTable({
  items,
  page,
  totalPages,
  totalCount,
  pageSize,
  setPage,
  onEdit,
  onDelete,
  onMovement,
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Telas >= md: tabela completa */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/80 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b border-slate-100">
              <th className="text-left px-5 py-3.5">Produto</th>
              <th className="text-left px-5 py-3.5">Categoria</th>
              <th className="text-right px-5 py-3.5">
                <span className="inline-flex items-center gap-1 justify-end w-full">
                  Preço unit.
                </span>
              </th>
              <th className="text-center px-5 py-3.5">Qtd. em estoque</th>
              <th className="text-left px-5 py-3.5">Validade</th>
              <th className="text-left px-5 py-3.5">Status</th>
              <th className="text-right px-5 py-3.5">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/90">
            {items.map((p) => {
              const low = isLowStock(p);
              return (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-900 leading-snug">{p.name}</p>
                    <p className="text-xs font-mono text-slate-400 mt-0.5 tracking-tight">{p.code}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <CategoryBadge id={p.category} />
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-900 font-mono">
                    {brl(p.price)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <div className="inline-flex flex-col items-center">
                      <span className={`font-semibold font-mono ${low ? "text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200" : "text-slate-800"}`}>
                        {p.quantity}
                      </span>
                      {p.minStock > 0 && (
                        <span className="text-[10px] text-slate-400 mt-0.5 font-mono">
                          mín. {p.minStock}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600 font-medium">
                    {fmtDate(p.expiry)}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusChips p={p} />
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onMovement(p)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-amber-50 hover:text-amber-700 hover:border hover:border-amber-200 transition cursor-pointer"
                        title="Registrar movimentação (Entrada/Saída/Ajuste)"
                      >
                        <ArrowLeftRight size={15} />
                      </button>
                      <button
                        onClick={() => onEdit(p)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-teal-50 hover:text-teal-700 hover:border hover:border-teal-200 transition cursor-pointer"
                        title="Editar detalhes do produto"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => onDelete(p)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border hover:border-red-200 transition cursor-pointer"
                        title="Excluir produto"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Telas < md: lista de cards otimizados para touch */}
      <div className="md:hidden divide-y divide-slate-100">
        {items.map((p) => (
          <div key={p.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{p.name}</p>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{p.code}</p>
              </div>
              <p className="font-bold text-slate-900 shrink-0 font-mono">{brl(p.price)}</p>
            </div>

            <div className="flex items-center justify-between">
              <CategoryBadge id={p.category} />
              <span className={`text-sm ${isLowStock(p) ? "text-red-600 font-bold" : "text-slate-700 font-medium"}`}>
                {p.quantity} un. {p.expiry && <span className="text-slate-400 font-normal">· vence {fmtDate(p.expiry)}</span>}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <StatusChips p={p} />
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              <button
                onClick={() => onMovement(p)}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 active:bg-amber-50 active:text-amber-700 transition"
              >
                <ArrowLeftRight size={14} /> Mover
              </button>
              <button
                onClick={() => onEdit(p)}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 active:bg-teal-50 active:text-teal-700 transition"
              >
                <Pencil size={14} /> Editar
              </button>
              <button
                onClick={() => onDelete(p)}
                className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 active:bg-red-50 active:text-red-600 transition"
                title="Excluir"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <EmptyState />}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        setPage={setPage}
      />
    </div>
  );
}
