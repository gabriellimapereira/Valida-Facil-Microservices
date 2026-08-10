import React from "react";
import { Trash2 } from "lucide-react";

export default function ConfirmDeleteModal({ product, onClose, onConfirm }) {
  if (!product) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <Trash2 size={20} className="text-red-500" />
        </div>
        <h3 className="font-semibold text-slate-900 mb-1">Excluir produto?</h3>
        <p className="text-sm text-slate-500 mb-6">
          Tem certeza que deseja excluir <span className="font-medium text-slate-700">{product.name}</span>? Essa ação não pode ser desfeita.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">
            Cancelar
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition">
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}
