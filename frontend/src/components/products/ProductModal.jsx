import React, { useState } from "react";
import { X } from "lucide-react";
import { CATEGORIES } from "../../data/categories";

export default function ProductModal({ product, onClose, onSave }) {
  const isEdit = Boolean(product);
  const [form, setForm] = useState({
    code: product?.code || "",
    name: product?.name || "",
    category: product?.category || "perecivel",
    price: product?.price ?? "",
    quantity: product?.quantity ?? "",
    minStock: product?.minStock ?? "",
    expiry: product?.expiry || "",
    supplier: product?.supplier || "",
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Informe o nome do produto.";
    if (!form.code.trim()) e.code = "Informe um código/ID.";
    if (form.price === "" || Number(form.price) < 0) e.price = "Informe um valor válido.";
    if (form.quantity === "" || Number(form.quantity) < 0) e.quantity = "Informe uma quantidade válida.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      ...form,
      price: Number(form.price),
      quantity: Number(form.quantity),
      minStock: Number(form.minStock) || 0,
      expiry: form.expiry || null,
    });
  };

  const inputCls = (err) =>
    `w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
      err ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-amber-500/30 focus:border-amber-500"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-semibold text-slate-900">{isEdit ? "Editar produto" : "Cadastrar novo produto"}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Código / ID</label>
              <input value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="Ex: FRT-0012" className={inputCls(errors.code)} />
              {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code}</p>}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Categoria / Tipo</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls(false)}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Nome do produto</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Maçã Gala (caixa 10kg)" className={inputCls(errors.name)} />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Preço (R$)</label>
              <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0,00" className={inputCls(errors.price)} />
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Quantidade {isEdit && <span className="text-slate-400 font-normal">(estoque inicial)</span>}
              </label>
              <input
                type="number"
                min="0"
                value={form.quantity}
                onChange={(e) => set("quantity", e.target.value)}
                placeholder="0"
                disabled={isEdit}
                className={`${inputCls(errors.quantity)} ${isEdit ? "bg-slate-50 text-slate-400 cursor-not-allowed" : ""}`}
              />
              {isEdit ? (
                <p className="text-xs text-slate-400 mt-1">
                  Para alterar a quantidade, use "Registrar movimentação" na tabela — assim o histórico fica auditável.
                </p>
              ) : (
                errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Estoque mínimo</label>
              <input type="number" min="0" value={form.minStock} onChange={(e) => set("minStock", e.target.value)} placeholder="0" className={inputCls(false)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Data de validade <span className="text-slate-400 font-normal">(se aplicável)</span>
              </label>
              <input type="date" value={form.expiry} onChange={(e) => set("expiry", e.target.value)} className={inputCls(false)} />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Fornecedor</label>
              <input value={form.supplier} onChange={(e) => set("supplier", e.target.value)} placeholder="Ex: Fazenda Boa Vista" className={inputCls(false)} />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">
              Cancelar
            </button>
            <button type="submit" className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition shadow-sm shadow-amber-600/20">
              {isEdit ? "Salvar alterações" : "Cadastrar produto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
