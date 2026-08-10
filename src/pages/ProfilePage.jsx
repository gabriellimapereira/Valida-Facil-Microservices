import React, { useEffect, useState } from "react";
import { AlertTriangle, Building2, ImagePlus, Lock, Mail, Phone } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import * as authService from "../services/authService";

export default function ProfilePage() {
  const { company, saveCompany } = useCompany();
  const { addToast } = useToast();
  const [form, setForm] = useState(null);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErr, setPwErr] = useState("");

  useEffect(() => {
    if (company) setForm({ ...company });
  }, [company]);

  if (!form) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    await saveCompany(form);
    addToast("Dados da empresa atualizados.");
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!pw.current || !pw.next || !pw.confirm) {
      setPwErr("Preencha todos os campos de senha.");
      return;
    }
    if (pw.next.length < 8) {
      setPwErr("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwErr("A confirmação não coincide com a nova senha.");
      return;
    }
    setPwErr("");
    try {
      await authService.requestPasswordReset(company.notificationEmail);
      setPw({ current: "", next: "", confirm: "" });
      addToast("Enviamos um e-mail de confirmação para concluir a troca de senha.");
    } catch (err) {
      addToast(err.message || "Não foi possível iniciar a troca de senha.", "error");
    }
  };

  const inputCls = "w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition";

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Perfil da empresa & configurações</h2>
        <p className="text-sm text-slate-500 mt-0.5">Gerencie os dados corporativos e a segurança da sua conta.</p>
      </div>

      <form onSubmit={handleSaveCompany} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-4 pb-1">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-xl font-bold shrink-0">
            {form.initials}
          </div>
          <button type="button" className="inline-flex items-center gap-2 text-xs font-semibold text-teal-600 hover:text-teal-700 border border-teal-200 bg-teal-50 px-3 py-2 rounded-lg">
            <ImagePlus size={14} />
            Alterar logotipo
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nome da empresa</label>
            <div className="relative">
              <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">E-mail principal (notificações)</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="email" value={form.notificationEmail} onChange={(e) => set("notificationEmail", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Telefone</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Endereço</label>
            <input value={form.address} onChange={(e) => set("address", e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition" />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition shadow-sm shadow-amber-600/20">
            Salvar alterações
          </button>
        </div>
      </form>

      <form onSubmit={handleSavePassword} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
            <Lock size={16} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Segurança</p>
            <p className="text-xs text-slate-500">Altere sua senha de acesso</p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Por segurança, a alteração de senha só será concluída após a confirmação enviada para o seu e-mail cadastrado.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Senha atual</label>
            <input type="password" value={pw.current} onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nova senha</label>
            <input type="password" value={pw.next} onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" placeholder="Mín. 8 caracteres" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirmar nova senha</label>
            <input type="password" value={pw.confirm} onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" placeholder="••••••••" />
          </div>
        </div>

        {pwErr && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={15} className="shrink-0" />
            {pwErr}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition">
            Alterar senha
          </button>
        </div>
      </form>
    </div>
  );
}
