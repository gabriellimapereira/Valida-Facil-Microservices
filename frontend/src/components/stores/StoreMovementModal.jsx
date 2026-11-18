import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDownLeft, ArrowUpRight, Package, X } from "lucide-react";
import { useProducts } from "../../context/ProductContext";
import { fmtDate } from "../../utils/formatters";
import TactileButton from "../ui/TactileButton";

/**
 * StoreMovementModal — Modal para movimentar (entrada ou saída local) produtos em uma filial.
 * Sem limite artificial máximo de quantidade, sincronizado com o MS Stores.
 */
export default function StoreMovementModal({
  store,
  inventory = [],
  initialItem = null,
  onClose,
  onSave,
}) {
  const { products } = useProducts();

  const productOptions = useMemo(() => {
    const byId = new Map();
    for (const inv of inventory) {
      if (!inv?.productId) continue;
      byId.set(inv.productId, {
        productId: inv.productId,
        productName: inv.productName || "Produto",
        productCode: inv.productCode || "",
        expiry: inv.expiry || null,
        storeQuantity: Number(inv.quantity) || 0,
      });
    }
    for (const prod of products) {
      if (!prod?.id) continue;
      const existing = byId.get(prod.id);
      if (existing) {
        if (!existing.expiry && prod.expiry) existing.expiry = prod.expiry;
        if (!existing.productCode && prod.code) existing.productCode = prod.code;
        if (existing.productName === "Produto" && prod.name) existing.productName = prod.name;
      } else {
        byId.set(prod.id, {
          productId: prod.id,
          productName: prod.name || "Produto",
          productCode: prod.code || "",
          expiry: prod.expiry || null,
          storeQuantity: 0,
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      String(a.productName).localeCompare(String(b.productName), "pt-BR")
    );
  }, [inventory, products]);

  const [productId, setProductId] = useState(
    initialItem?.productId || productOptions[0]?.productId || ""
  );
  const [mode, setMode] = useState("entrada");
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedOption = useMemo(
    () => productOptions.find((opt) => opt.productId === productId) || null,
    [productOptions, productId]
  );

  const currentQty = selectedOption?.storeQuantity ?? (Number(initialItem?.quantity) || 0);
  const parsedAmount = Number.parseInt(amount, 10);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const previewBalance =
    mode === "entrada" ? currentQty + validAmount : Math.max(0, currentQty - validAmount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!productId) {
      setError("Selecione um produto para movimentar.");
      return;
    }
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      setError("Informe uma quantidade inteira maior que zero.");
      return;
    }
    if (mode === "saida" && parsedAmount > currentQty) {
      setError(`Quantidade de saída excede o saldo disponível na loja (${currentQty}).`);
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await onSave({
        productId,
        quantityDelta: mode === "entrada" ? parsedAmount : -parsedAmount,
        note: note.trim() || null,
        productName: selectedOption?.productName || initialItem?.productName || null,
        productCode: selectedOption?.productCode || initialItem?.productCode || null,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Não foi possível registrar a movimentação na filial.");
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/55 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto border border-slate-200/80"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 sm:px-7 pt-5 sm:pt-7 pb-4 sm:pb-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-navy text-white flex items-center justify-center shadow-sm shrink-0">
              <Package size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg tracking-tight leading-tight">
                Movimentar Estoque da Loja
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {store?.name} ({store?.code})
              </p>
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

        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-200/80">
              {error}
            </div>
          )}

          {/* Tipo de Movimentação */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setMode("entrada")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                mode === "entrada"
                  ? "bg-teal-50 border-teal-500 text-teal-800 shadow-xs"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <ArrowDownLeft size={15} />
              Entrada Local
            </button>
            <button
              type="button"
              onClick={() => setMode("saida")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                mode === "saida"
                  ? "bg-rose-50 border-rose-500 text-rose-800 shadow-xs"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <ArrowUpRight size={15} />
              Saída / Venda
            </button>
          </div>

          {/* Produto */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Produto *</label>
            {initialItem ? (
              <div className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-800 font-semibold">
                {initialItem.productCode ? `[${initialItem.productCode}] ` : ""}
                {initialItem.productName}
              </div>
            ) : (
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
              >
                <option value="">Selecione um produto...</option>
                {productOptions.map((opt) => (
                  <option key={opt.productId} value={opt.productId}>
                    {opt.productCode ? `[${opt.productCode}] ` : ""}
                    {opt.productName} (Loja: {opt.storeQuantity}
                    {opt.expiry ? ` | Val: ${fmtDate(opt.expiry)}` : ""})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quantidade + Preview */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Quantidade *</label>
              <input
                type="number"
                min={1}
                step={1}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
              />
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Saldo atual:</span>
                <strong className="font-mono text-slate-800">{currentQty}</strong>
              </div>
              <div className="flex justify-between text-slate-600 mt-0.5">
                <span>Saldo previsto:</span>
                <strong
                  className={`font-mono ${
                    mode === "saida" && validAmount > currentQty
                      ? "text-red-600"
                      : mode === "entrada"
                      ? "text-teal-700"
                      : "text-navy"
                  }`}
                >
                  {previewBalance}
                </strong>
              </div>
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Observação (opcional)</label>
            <input
              type="text"
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === "entrada"
                  ? "Ex: Ajuste de conferência ou entrada direta"
                  : "Ex: Venda em loja, consumo interno ou descarte"
              }
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancelar
            </button>
            <TactileButton type="submit" disabled={submitting || !productId}>
              {submitting ? "Registrando..." : "Confirmar Movimentação"}
            </TactileButton>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}
