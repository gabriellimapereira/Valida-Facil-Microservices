import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, X } from "lucide-react";
import TactileButton from "../ui/TactileButton";

const TYPES = [
  { id: "entrada", label: "Entrada", icon: ArrowUpCircle, hint: "Quantidade recebida ou reposta" },
  { id: "saida", label: "Saída", icon: ArrowDownCircle, hint: "Quantidade vendida ou consumida" },
  { id: "ajuste", label: "Ajuste", icon: SlidersHorizontal, hint: "Correção manual — pode ser positiva ou negativa" },
];

export default function MovementModal({ product, onClose, onSubmit }) {
  const [type, setType] = useState("entrada");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = Number(amount);

    if (amount === "" || Number.isNaN(value)) {
      setError("Informe uma quantidade válida.");
      return;
    }
    if (type !== "ajuste" && value <= 0) {
      setError("Para entrada/saída, informe um número maior que zero.");
      return;
    }

    const delta = type === "saida" ? -Math.abs(value) : type === "entrada" ? Math.abs(value) : value;

    setError("");
    setSubmitting(true);
    try {
      await onSubmit({ movementType: type, quantityDelta: delta, note: note || undefined });
    } catch (err) {
      setError(err.message || "Não foi possível registrar a movimentação.");
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-900">{product.name}</h3>
            <p className="text-xs text-slate-500">Estoque atual: {product.quantity} un.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Tipo de movimentação</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition ${
                      isSelected
                        ? "border-amber-500 bg-amber-50/60 text-amber-700 font-semibold"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={18} />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-slate-400 mt-2">{TYPES.find((t) => t.id === type)?.hint}</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              {type === "ajuste" ? "Quantidade do ajuste (+ ou -)" : "Quantidade"}
            </label>
            <input
              type="number"
              min={type === "ajuste" ? undefined : "1"}
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={type === "ajuste" ? "Ex: -3 ou 5" : "0"}
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Observação (opcional)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Reposição de estoque, venda balcão..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <TactileButton
              variant="secondary"
              onClick={onClose}
              className="flex-1"
              padding="10px 16px"
              rounded={12}
            >
              Cancelar
            </TactileButton>
            <TactileButton
              type="submit"
              variant="amber"
              disabled={submitting}
              className="flex-1"
              padding="10px 16px"
              rounded={12}
            >
              {submitting ? "Registrando..." : "Registrar"}
            </TactileButton>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
}
