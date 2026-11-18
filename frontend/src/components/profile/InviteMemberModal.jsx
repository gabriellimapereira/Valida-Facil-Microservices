import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Building2, Mail, UserPlus, X } from "lucide-react";
import TactileButton from "../ui/TactileButton";

export default function InviteMemberModal({ onClose, onInvite, stores = [] }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [storeId, setStoreId] = useState("");
  const role = "operador";
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Informe o nome completo do colaborador.");
      return;
    }
    if (trimmedName.length > 150) {
      setError("O nome deve ter no máximo 150 caracteres.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError("Informe um e-mail corporativo ou pessoal válido.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      const invitePayload = { email: trimmedEmail, fullName: trimmedName, role };
      if (storeId) invitePayload.storeId = storeId;
      await onInvite(invitePayload);
      onClose();
    } catch (err) {
      setError(err.message || "Não foi possível enviar o convite.");
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto border border-slate-200/80 select-none" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 pt-5 sm:pt-7 pb-4 sm:pb-5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-navy text-white flex items-center justify-center shadow-sm shrink-0">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg tracking-tight leading-tight">Convidar Colaborador</h3>
              <p className="text-xs text-slate-500 mt-1">Adicione um novo usuário à equipe da empresa</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-xl hover:bg-slate-200/60 cursor-pointer"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nome completo <span className="text-amber-600">*</span></label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={150}
              placeholder="Ex: João Pedro Santos"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">E-mail do colaborador <span className="text-amber-600">*</span></label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colaborador@suaempresa.com"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">O colaborador usará este e-mail pessoal/corporativo para realizar o login.</p>
          </div>

          {stores.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Unidade de Atuação (Armazém ou Filial)</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <select
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
                >
                  <option value="">Armazém Central (Acesso Geral)</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code ? `${s.code} — ` : ""}{s.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Operadores vinculados a uma filial gerenciam apenas o estoque e pedidos daquela loja.</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Perfil de Acesso</label>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
              <div className="flex items-center mb-1">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500" />
                  Operador de Estoque
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Novos colaboradores acessam como operadores para consultar produtos e registrar entradas e saídas. A empresa possui uma única conta de Administrador.
              </p>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
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
              {submitting ? "Enviando convite..." : "Enviar convite"}
            </TactileButton>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
}

