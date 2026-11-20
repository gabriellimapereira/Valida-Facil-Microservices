import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, Minus, Plus, X } from "lucide-react";
import TactileButton from "../ui/TactileButton";

const TYPES = [
  { id: "entrada", label: "Entrada", icon: ArrowUpCircle, hint: "Quantidade recebida ou reposta (+)" },
  { id: "saida", label: "Saída", icon: ArrowDownCircle, hint: "Quantidade vendida ou consumida (-)" },
];

export default function MovementModal({ product, onClose, onSubmit }) {
  const [type, setType] = useState("entrada");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const numAmount = Number(amount) || 0;
  const delta = type === "saida" ? -Math.abs(numAmount) : Math.abs(numAmount);
  const projectedQuantity = amount !== "" ? product.quantity + delta : product.quantity;

  const handleIncrement = () => {
    const current = Number(amount) || 0;
    setAmount(String(current + 1));
    setError("");
  };

  const handleDecrement = () => {
    const current = Number(amount) || 0;
    if (current > 1) {
      setAmount(String(current - 1));
      setError("");
    } else {
      setAmount("");
      setError("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      handleIncrement();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      handleDecrement();
      return;
    }
    if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleAmountChange = (e) => {
    let val = e.target.value;
    if (val === "") {
      setAmount("");
      setError("");
      return;
    }

    val = val.replace(/\D/g, "");
    const num = Number(val);
    val = val === "" ? "" : `${num}`;

    setAmount(val);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = Number(amount);

    if (amount === "" || Number.isNaN(value) || value <= 0) {
      setError("Informe uma quantidade válida maior que zero.");
      return;
    }

    if (projectedQuantity < 0) {
      setError(`Quantidade insuficiente em estoque (atual: ${product.quantity}, saída solicitada: ${Math.abs(delta)}).`);
      return;
    }

    if (note.length > 250) {
      setError("A observação deve ter no máximo 250 caracteres.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await onSubmit({ movementType: type, quantityDelta: delta, note: note.trim() || undefined });
    } catch (err) {
      setError(err.message || "Não foi possível registrar a movimentação.");
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5 sm:p-6 border border-slate-200/80" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center shadow-sm">
              <ArrowLeftRight size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{product.name}</h3>
              <p className="text-xs text-slate-500 font-mono">Código: {product.code}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Projected Stock Box */}
        <div className={`my-4 p-3.5 rounded-xl border transition-colors ${
          projectedQuantity < 0
            ? "bg-red-50/80 border-red-200"
            : "bg-slate-50 border-slate-200/80"
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 block">Estoque atual</span>
              <span className="text-base font-bold text-slate-800 font-mono">{product.quantity} un.</span>
            </div>
            <div className="text-slate-300 font-bold">→</div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Novo estoque previsto</span>
              <span className={`text-base font-bold font-mono ${projectedQuantity < 0 ? "text-red-600 font-extrabold" : "text-teal-700"}`}>
                {projectedQuantity} un.
              </span>
            </div>
          </div>
          {projectedQuantity < 0 && (
            <div className="mt-2.5 pt-2 border-t border-red-200/80 flex items-center gap-1.5 text-xs text-red-600 font-semibold">
              <span>⚠️ Saldo insuficiente para retirada (máx: {product.quantity} un.)</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Tipo de movimentação</label>
            <div className="grid grid-cols-2 gap-2.5">
              {TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setType(t.id);
                      setError("");
                    }}
                    className={`flex flex-col items-center gap-1.5 py-3 px-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                      isSelected
                        ? "border-amber-500 bg-amber-50/80 text-amber-900 font-bold shadow-xs ring-1 ring-amber-500/20"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <Icon size={20} className={isSelected ? "text-amber-600" : "text-slate-400"} />
                    <span className="text-sm font-semibold">{t.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">{TYPES.find((t) => t.id === type)?.hint}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="movement-amount-input" className="block text-xs font-semibold text-slate-700">
                Quantidade da operação
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={numAmount <= 0}
                aria-label="Diminuir quantidade"
                title="Diminuir (ou tecla ↓)"
                className="w-11 h-11 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-35 disabled:cursor-not-allowed transition cursor-pointer active:scale-95 shadow-2xs select-none shrink-0"
              >
                <Minus size={18} />
              </button>
              <input
                id="movement-amount-input"
                type="text"
                inputMode="numeric"
                value={amount}
                onKeyDown={handleKeyDown}
                onChange={handleAmountChange}
                placeholder="0"
                className="flex-1 h-11 px-3.5 text-center rounded-xl border border-slate-200 text-base text-slate-900 font-bold font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
              />
              <button
                type="button"
                onClick={handleIncrement}
                aria-label="Aumentar quantidade"
                title="Aumentar (ou tecla ↑)"
                className="w-11 h-11 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:border-slate-300 disabled:opacity-35 disabled:cursor-not-allowed transition cursor-pointer active:scale-95 shadow-2xs select-none shrink-0"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Observação (opcional)</label>
            <input
              value={note}
              maxLength={250}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: NF 12345, Reposição semanal, Venda..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
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
              {submitting ? "Registrando..." : "Registrar movimentação"}
            </TactileButton>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
}
