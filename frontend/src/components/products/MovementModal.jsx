import React, { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, SlidersHorizontal, X } from "lucide-react";
import TactileButton from "../ui/TactileButton";

const MAX_AMOUNT = 1_000_000;

const TYPES = [
  { id: "entrada", label: "Entrada", icon: ArrowUpCircle, hint: "Quantidade recebida ou reposta (+)" },
  { id: "saida", label: "Saída", icon: ArrowDownCircle, hint: "Quantidade vendida ou consumida (-)" },
  { id: "ajuste", label: "Ajuste", icon: SlidersHorizontal, hint: "Correção manual (delta positivo ou negativo)" },
];

export default function MovementModal({ product, onClose, onSubmit }) {
  const [type, setType] = useState("entrada");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const numAmount = Number(amount) || 0;
  const delta = type === "saida" ? -Math.abs(numAmount) : type === "entrada" ? Math.abs(numAmount) : numAmount;
  const projectedQuantity = amount !== "" ? product.quantity + delta : product.quantity;

  const handleKeyDown = (e) => {
    if (type === "ajuste") {
      // Ajuste pode ter sinal negativo, mas não expoentes nem decimais
      if (["e", "E", "+", ".", ","].includes(e.key)) {
        e.preventDefault();
      }
    } else {
      // Entrada e saída só aceitam dígitos positivos
      if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
        e.preventDefault();
      }
    }
  };

  const handleAmountChange = (e) => {
    let val = e.target.value;
    if (val === "") {
      setAmount("");
      setError("");
      return;
    }

    if (type === "ajuste") {
      // Permite sinal negativo apenas no início
      const isNeg = val.startsWith("-");
      const digits = val.replace(/\D/g, "");
      let num = Number(digits);
      if (num > MAX_AMOUNT) num = MAX_AMOUNT;
      val = digits === "" ? (isNeg ? "-" : "") : isNeg ? `-${num}` : `${num}`;
    } else {
      val = val.replace(/\D/g, "");
      let num = Number(val);
      if (num > MAX_AMOUNT) num = MAX_AMOUNT;
      val = val === "" ? "" : `${num}`;
    }

    setAmount(val);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = Number(amount);

    if (amount === "" || amount === "-" || Number.isNaN(value)) {
      setError("Informe uma quantidade válida.");
      return;
    }

    if (type !== "ajuste" && value <= 0) {
      setError("Para entrada ou saída, informe um número inteiro maior que zero.");
      return;
    }

    if (Math.abs(value) > MAX_AMOUNT) {
      setError(`A quantidade não pode ultrapassar ${MAX_AMOUNT.toLocaleString("pt-BR")} unidades.`);
      return;
    }

    if (projectedQuantity < 0) {
      setError(`Quantidade insuficiente em estoque (atual: ${product.quantity}, saída solicitada: ${Math.abs(delta)}).`);
      return;
    }

    if (projectedQuantity > MAX_AMOUNT) {
      setError(`O estoque resultante (${projectedQuantity.toLocaleString("pt-BR")} un.) ultrapassa o limite do sistema.`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200/80" onClick={(e) => e.stopPropagation()}>
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
        <div className="my-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 block">Estoque atual</span>
            <span className="text-base font-bold text-slate-800 font-mono">{product.quantity} un.</span>
          </div>
          <div className="text-slate-300 font-bold">→</div>
          <div className="text-right">
            <span className="text-xs text-slate-500 block">Novo estoque previsto</span>
            <span className={`text-base font-bold font-mono ${projectedQuantity < 0 ? "text-red-600" : "text-teal-700"}`}>
              {projectedQuantity} un.
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">Tipo de movimentação</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = type === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setType(t.id);
                      setAmount("");
                      setError("");
                    }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition cursor-pointer ${
                      isSelected
                        ? "border-amber-500 bg-amber-50/80 text-amber-900 font-bold shadow-xs"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <Icon size={18} className={isSelected ? "text-amber-600" : "text-slate-400"} />
                    {t.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">{TYPES.find((t) => t.id === type)?.hint}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                {type === "ajuste" ? "Quantidade do ajuste (+ ou -)" : "Quantidade da operação"}
              </label>
              <span className="text-[10px] text-slate-400 font-mono">máx 1.000.000</span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onKeyDown={handleKeyDown}
              onChange={handleAmountChange}
              placeholder={type === "ajuste" ? "Ex: -3 ou 5" : "0"}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
            />
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
