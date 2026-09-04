import React, { useContext, useState } from "react";
import { createPortal } from "react-dom";
import { Boxes, PackagePlus, Sparkles, X } from "lucide-react";
import { CATEGORIES } from "../../data/categories";
import { ProductContext } from "../../context/ProductContext";
import TactileButton from "../ui/TactileButton";
import DatePicker from "../ui/DatePicker";

const MAX_VALUE = 1_000_000;

export const CATEGORY_PREFIXES = {
  perecivel: "ALM",
  eletronicos: "ELE",
  moda: "MOD",
  livros: "LIV",
  outros: "PRD",
};

export function generateNextProductCode(category = "perecivel", existingProducts = []) {
  const prefix = CATEGORY_PREFIXES[category] || "PRD";
  const regex = new RegExp(`^${prefix}-(\\d+)$`, "i");

  let maxNum = 0;
  const existingSet = new Set();

  for (const p of existingProducts || []) {
    if (!p?.code) continue;
    existingSet.add(p.code.toUpperCase());
    const match = p.code.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  let candidate = maxNum + 1;
  let code = `${prefix}-${String(candidate).padStart(4, "0")}`;
  while (existingSet.has(code.toUpperCase())) {
    candidate++;
    code = `${prefix}-${String(candidate).padStart(4, "0")}`;
  }

  return code;
}

export default function ProductModal({ product, onClose, onSave, existingProducts = [] }) {
  const isEdit = Boolean(product);
  const productContext = useContext(ProductContext);
  const allProducts = existingProducts.length > 0 ? existingProducts : (productContext?.products || []);

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

  const handleGenerateCode = () => {
    const nextCode = generateNextProductCode(form.category, allProducts);
    set("code", nextCode);
  };

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) {
      setErrors((e) => ({ ...e, [k]: null }));
    }
  };

  // Previne digitação de caracteres não numéricos em campos inteiros
  const handleIntegerKeyDown = (e) => {
    if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
      e.preventDefault();
    }
  };

  // Previne 'e', 'E', '+' em campo de preço decimal
  const handlePriceKeyDown = (e) => {
    if (["e", "E", "+", "-"].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handlePriceChange = (e) => {
    let val = e.target.value;
    if (val === "") {
      set("price", "");
      return;
    }
    // Remove qualquer caractere inválido
    val = val.replace(/[^0-9.,]/g, "").replace(",", ".");
    const num = Number(val);
    if (!isNaN(num)) {
      if (num > MAX_VALUE) {
        val = String(MAX_VALUE);
      }
      set("price", val);
    }
  };

  const handleIntegerChange = (field, e) => {
    let val = e.target.value;
    if (val === "") {
      set(field, "");
      return;
    }
    // Apenas dígitos
    val = val.replace(/\D/g, "");
    const num = Number(val);
    if (!isNaN(num)) {
      if (num > MAX_VALUE) {
        val = String(MAX_VALUE);
      }
      set(field, val);
    }
  };

  const validate = () => {
    const e = {};
    const trimmedName = form.name.trim();
    const trimmedCode = form.code.trim();

    if (!trimmedName) {
      e.name = "Informe o nome do produto.";
    } else if (trimmedName.length > 150) {
      e.name = "O nome do produto deve ter no máximo 150 caracteres.";
    }

    if (!trimmedCode) {
      e.code = "Informe um código/ID.";
    } else if (trimmedCode.length > 50) {
      e.code = "O código/ID deve ter no máximo 50 caracteres.";
    }

    const priceNum = Number(form.price);
    if (form.price === "" || isNaN(priceNum) || priceNum < 0) {
      e.price = "Informe um valor unitário válido.";
    } else if (priceNum > MAX_VALUE) {
      e.price = `O valor unitário não pode ultrapassar R$ ${MAX_VALUE.toLocaleString("pt-BR")},00.`;
    }

    const qtyNum = Number(form.quantity);
    if (form.quantity === "" || isNaN(qtyNum) || qtyNum < 0 || !Number.isInteger(qtyNum)) {
      e.quantity = "Informe uma quantidade válida (número inteiro).";
    } else if (qtyNum > MAX_VALUE) {
      e.quantity = `A quantidade não pode ultrapassar ${MAX_VALUE.toLocaleString("pt-BR")} unidades.`;
    }

    const minStockNum = Number(form.minStock) || 0;
    if (minStockNum < 0 || !Number.isInteger(minStockNum)) {
      e.minStock = "O estoque mínimo deve ser um número inteiro positivo.";
    } else if (minStockNum > MAX_VALUE) {
      e.minStock = `O estoque mínimo não pode ultrapassar ${MAX_VALUE.toLocaleString("pt-BR")} unidades.`;
    }

    if (form.supplier && form.supplier.length > 150) {
      e.supplier = "O fornecedor deve ter no máximo 150 caracteres.";
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      ...form,
      name: form.name.trim(),
      code: form.code.trim(),
      price: Math.round(Number(form.price) * 100) / 100,
      quantity: Math.floor(Number(form.quantity)),
      minStock: Math.floor(Number(form.minStock)) || 0,
      expiry: form.expiry || null,
      supplier: form.supplier?.trim() || "",
    });
  };

  const inputCls = (err) =>
    `w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 transition ${
      err ? "border-red-300 focus:ring-red-200" : "border-slate-200 focus:ring-amber-500/30 focus:border-amber-500"
    }`;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden border border-slate-200/80" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-navy text-white flex items-center justify-center shadow-sm">
              {isEdit ? <Boxes size={18} /> : <PackagePlus size={18} />}
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{isEdit ? "Editar produto" : "Cadastrar novo produto"}</h3>
              <p className="text-xs text-slate-500">{isEdit ? "Atualize as informações do item" : "Preencha os dados do item no estoque"}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Código / ID <span className="text-amber-600">*</span>
                </label>
                {!isEdit && (
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-0.5 rounded-md transition select-none cursor-pointer"
                    title="Atribuir código sequencial automático para este produto"
                  >
                    <Sparkles size={12} className="text-amber-600" />
                    <span>Gerar automático</span>
                  </button>
                )}
              </div>
              <input
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
                maxLength={50}
                placeholder="Ex: FRT-0012"
                className={inputCls(errors.code)}
              />
              {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code}</p>}
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Categoria / Segmento <span className="text-amber-600">*</span></label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls(false)}>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nome do produto <span className="text-amber-600">*</span></label>
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                maxLength={150}
                placeholder="Ex: Maçã Gala (caixa 10kg)"
                className={inputCls(errors.name)}
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">Preço unitário (R$) <span className="text-amber-600">*</span></label>
                <span className="text-[10px] text-slate-400 font-mono">máx 1.000.000</span>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                max={MAX_VALUE}
                value={form.price}
                onKeyDown={handlePriceKeyDown}
                onChange={handlePriceChange}
                placeholder="0,00"
                className={inputCls(errors.price)}
              />
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Quantidade {isEdit ? <span className="text-slate-400 font-normal">(estoque inicial)</span> : <span className="text-amber-600">*</span>}
                </label>
                <span className="text-[10px] text-slate-400 font-mono">máx 1.000.000</span>
              </div>
              <input
                type="number"
                min="0"
                max={MAX_VALUE}
                step="1"
                value={form.quantity}
                onKeyDown={handleIntegerKeyDown}
                onChange={(e) => handleIntegerChange("quantity", e)}
                placeholder="0"
                disabled={isEdit}
                className={`${inputCls(errors.quantity)} ${isEdit ? "bg-slate-50 text-slate-400 cursor-not-allowed" : ""}`}
              />
              {isEdit ? (
                <p className="text-[11px] text-slate-400 mt-1">
                  Para alterar a quantidade, use "Registrar movimentação" na tabela.
                </p>
              ) : (
                errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">Estoque mínimo</label>
                <span className="text-[10px] text-slate-400 font-mono">máx 1.000.000</span>
              </div>
              <input
                type="number"
                min="0"
                max={MAX_VALUE}
                step="1"
                value={form.minStock}
                onKeyDown={handleIntegerKeyDown}
                onChange={(e) => handleIntegerChange("minStock", e)}
                placeholder="0"
                className={inputCls(errors.minStock)}
              />
              {errors.minStock && <p className="text-xs text-red-500 mt-1">{errors.minStock}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Data de validade <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <DatePicker value={form.expiry} onChange={(e) => set("expiry", e.target.value)} placeholder="Selecione a data" />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fornecedor ou Fabricante</label>
              <input
                value={form.supplier}
                onChange={(e) => set("supplier", e.target.value)}
                maxLength={150}
                placeholder="Ex: Distribuidora Central Ltda"
                className={inputCls(errors.supplier)}
              />
              {errors.supplier && <p className="text-xs text-red-500 mt-1">{errors.supplier}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
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
              className="flex-1"
              padding="10px 16px"
              rounded={12}
            >
              {isEdit ? "Salvar alterações" : "Cadastrar produto"}
            </TactileButton>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
}
