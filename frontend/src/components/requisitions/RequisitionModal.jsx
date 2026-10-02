import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ClipboardList, Plus, Trash2, X } from "lucide-react";
import TactileButton from "../ui/TactileButton";

export default function RequisitionModal({ stores, products, onClose, onSave }) {
  const [storeId, setStoreId] = useState(stores[0]?.id || "");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([
    { productId: products[0]?.id || "", quantityRequested: 10 },
  ]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { productId: products[0]?.id || "", quantityRequested: 10 }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!storeId) {
      setError("Selecione a filial solicitante.");
      return;
    }
    if (items.length === 0) {
      setError("Adicione ao menos um produto na requisição.");
      return;
    }

    for (const it of items) {
      if (!it.productId) {
        setError("Selecione todos os produtos da lista.");
        return;
      }
      const qty = Number(it.quantityRequested);
      if (isNaN(qty) || qty <= 0) {
        setError("A quantidade de cada produto deve ser maior que zero.");
        return;
      }
    }

    setError("");
    setSubmitting(true);
    try {
      await onSave({
        storeId,
        notes: notes.trim() || null,
        items: items.map((it) => ({
          productId: it.productId,
          quantityRequested: Number(it.quantityRequested),
        })),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Falha ao emitir requisição.");
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto border border-slate-200/80 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 pt-5 sm:pt-7 pb-4 sm:pb-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-navy text-white flex items-center justify-center shadow-sm shrink-0">
              <ClipboardList size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg tracking-tight leading-tight">Nova Requisição</h3>
              <p className="text-xs text-slate-500 mt-1">Solicite reabastecimento de produtos ao Armazém Central</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-200/80">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Filial Solicitante *</label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Produtos Solicitados *</label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-navy font-bold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Plus size={14} /> Adicionar Item
              </button>
            </div>

            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={it.productId}
                    onChange={(e) => handleItemChange(idx, "productId", e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name} (Disp: {p.quantity})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={it.quantityRequested}
                    onChange={(e) => handleItemChange(idx, "quantityRequested", e.target.value)}
                    className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
                    placeholder="Qtd"
                  />

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Observações (opcional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Motivo da requisição, urgência ou especificações..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancelar
            </button>
            <TactileButton type="submit" disabled={submitting}>
              {submitting ? "Enviando..." : "Emitir Requisição"}
            </TactileButton>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}
