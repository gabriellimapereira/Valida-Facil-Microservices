import React from "react";
import { ArrowLeftRight, ArrowUpDown, ChevronLeft, ChevronRight, PackageSearch, Pencil, Trash2 } from "lucide-react";
import CategoryBadge from "../ui/CategoryBadge";
import { brl, fmtDate, expiryUrgency, isLowStock } from "../../utils/formatters";

export default function ProductTable({ items, page, totalPages, totalCount, pageSize, setPage, onEdit, onDelete, onMovement }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
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
            {items.map((p) => {
              const urgency = expiryUrgency(p.expiry);
              const low = isLowStock(p);
              return (
                <tr key={p.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.code}</p>
                  </td>
                  <td className="px-5 py-3.5"><CategoryBadge id={p.category} /></td>
                  <td className="px-5 py-3.5 text-right font-medium text-slate-900">{brl(p.price)}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={low ? "text-red-600 font-semibold" : "text-slate-700"}>{p.quantity}</span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{fmtDate(p.expiry)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1 items-start">
                      {urgency && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${urgency.chip}`}>{urgency.label}</span>
                      )}
                      {low && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
                          Estoque baixo
                        </span>
                      )}
                      {!urgency && !low && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full border bg-teal-50 text-teal-700 border-teal-200">Ok</span>
                      )}
                    </div>
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
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <PackageSearch size={32} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-medium text-slate-600">Nenhum produto encontrado</p>
                  <p className="text-xs text-slate-400 mt-1">Ajuste os filtros ou cadastre um novo produto.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalCount > 0 && (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} de {totalCount}
          </p>
          <div className="flex items-center gap-1.5">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition">
              <ChevronLeft size={15} />
            </button>
            <span className="text-xs font-medium text-slate-600 px-2">{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 text-slate-500 disabled:opacity-40 hover:bg-slate-50 transition">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
