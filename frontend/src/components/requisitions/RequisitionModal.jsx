import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ClipboardList, Plus, Trash2, X } from "lucide-react";
import * as requisitionService from "../../services/requisitionService";
import { fmtDate } from "../../utils/formatters";
import ExpiryBadge from "../ui/ExpiryBadge";
import TactileButton from "../ui/TactileButton";

function sortByFefo(list) {
  return [...(list || [])].sort((a, b) => {
    const aHas = Boolean(a.expiry);
    const bHas = Boolean(b.expiry);
    if (aHas !== bHas) return aHas ? -1 : 1;
    const cmpExp = String(a.expiry || "9999-12-31").localeCompare(String(b.expiry || "9999-12-31"));
    if (cmpExp !== 0) return cmpExp;
    return String(a.name || "").localeCompare(String(b.name || ""), "pt-BR");
  });
}

export default function RequisitionModal({
  stores = [],
  products = [],
  userStoreId = null,
  role = "operador",
  onClose,
  onSave,
}) {
  const lockedStoreId = role !== "admin" && userStoreId ? userStoreId : null;
  const fallbackCatalog = useMemo(() => sortByFefo(products), [products]);
  const [catalog, setCatalog] = useState(fallbackCatalog);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [storeId, setStoreId] = useState(lockedStoreId || stores[0]?.id || "");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState(() =>
    fallbackCatalog[0]?.id ? [{ productId: fallbackCatalog[0].id, quantityRequested: 10 }] : []
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!storeId && (lockedStoreId || stores[0]?.id)) {
      setStoreId(lockedStoreId || stores[0]?.id || "");
    }
  }, [lockedStoreId, stores, storeId]);

  useEffect(() => {
    let active = true;
    setLoadingCatalog(true);
    requisitionService
      .fetchWarehouseAvailability()
      .then((rows) => {
        if (!active || !Array.isArray(rows)) return;
        if (rows.length > 0 || fallbackCatalog.length === 0) {
          setCatalog(rows);
          setItems((prev) =>
            prev.length > 0 ? prev : rows[0]?.id ? [{ productId: rows[0].id, quantityRequested: 10 }] : []
          );
        }
      })
      .catch(() => {
        if (active) setCatalog(fallbackCatalog);
      })
      .finally(() => {
        if (active) setLoadingCatalog(false);
      });
    return () => {
      active = false;
    };
  }, [fallbackCatalog]);

  const catalogById = useMemo(() => {
    const map = new Map();
    for (const p of catalog) {
      map.set(p.id, p);
    }
    return map;
  }, [catalog]);

  const selectedProductIds = useMemo(
    () => new Set(items.map((it) => it.productId).filter(Boolean)),
    [items]
  );

  const nextAvailableProduct = useMemo(
    () => catalog.find((p) => !selectedProductIds.has(p.id)) || null,
    [catalog, selectedProductIds]
  );

  const handleAddItem = () => {
    if (!nextAvailableProduct) return;
    setItems((prev) => [...prev, { productId: nextAvailableProduct.id, quantityRequested: 10 }]);
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

    const seen = new Set();
    for (const it of items) {
      if (!it.productId) {
        setError("Selecione todos os produtos da lista.");
        return;
      }
      if (seen.has(it.productId)) {
        setError("Não repita o mesmo produto na mesma requisição.");
        return;
      }
      seen.add(it.productId);

      const qty = Number(it.quantityRequested);
      if (!Number.isInteger(qty) || qty <= 0) {
        setError("A quantidade de cada produto deve ser um número inteiro maior que zero.");
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

  const canSubmit = !submitting && stores.length > 0 && catalog.length > 0 && items.length > 0;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto border border-slate-200/80 select-none"
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
              <p className="text-xs text-slate-500 mt-1">
                Catálogo de produtos do Armazém Central
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-4">
          {error && (
            <div className="p-3.5 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-200/80">
              {error}
            </div>
          )}

          {stores.length === 0 && (
            <div className="p-3.5 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200">
              Nenhuma filial cadastrada. Cadastre uma loja antes de emitir requisições.
            </div>
          )}

          {!loadingCatalog && catalog.length === 0 && (
            <div className="p-3.5 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200">
              Nenhum produto disponível no Armazém Central para solicitar.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Filial Solicitante *</label>
            <select
              value={storeId}
              disabled={Boolean(lockedStoreId) || stores.length === 0}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition disabled:opacity-70"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            {lockedStoreId && (
              <p className="text-[11px] text-slate-400 mt-1">
                Selecionado automaticamente conforme a filial vinculada ao seu perfil.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Produtos Solicitados *</label>
              <button
                type="button"
                disabled={!nextAvailableProduct}
                onClick={handleAddItem}
                className="text-xs text-navy font-bold flex items-center gap-1 hover:underline cursor-pointer disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
              >
                <Plus size={14} /> Adicionar Item
              </button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {items.map((it, idx) => {
                const selectedProd = catalogById.get(it.productId);
                const reqQty = Number(it.quantityRequested) || 0;
                const exceedsCentral = selectedProd && reqQty > selectedProd.quantity;

                return (
                  <div key={idx} className="p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={it.productId}
                        onChange={(e) => handleItemChange(idx, "productId", e.target.value)}
                        className="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
                      >
                        {catalog.map((p) => {
                          const usedElsewhere =
                            p.id !== it.productId && selectedProductIds.has(p.id);
                          return (
                            <option key={p.id} value={p.id} disabled={usedElsewhere}>
                              {p.code ? `${p.code} - ` : ""}
                              {p.name} (CD: {p.quantity}
                              {p.expiry ? ` | Val: ${fmtDate(p.expiry)}` : ""})
                            </option>
                          );
                        })}
                      </select>

                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={it.quantityRequested}
                        onChange={(e) => handleItemChange(idx, "quantityRequested", e.target.value)}
                        className="w-24 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
                        placeholder="Qtd"
                      />

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          aria-label="Remover item"
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer shrink-0"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>

                    {selectedProd && (
                      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-slate-500">
                        <div className="flex items-center gap-2">
                          <span>
                            Disponível no CD: <strong className="font-mono text-slate-700">{selectedProd.quantity} un</strong>
                          </span>
                          {selectedProd.expiry && <ExpiryBadge date={selectedProd.expiry} size="sm" />}
                        </div>
                        {exceedsCentral && (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                            <AlertTriangle size={12} />
                            Acima do saldo atual do CD
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              Cancelar
            </button>
            <TactileButton type="submit" disabled={!canSubmit}>
              {submitting ? "Enviando..." : "Emitir Requisição"}
            </TactileButton>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : null;
}
