import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Building2, ImagePlus, Lock, Mail, Phone, Send, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import * as authService from "../services/authService";
import * as alertService from "../services/alertService";
import * as companyService from "../services/companyService";
import { formatPhone } from "../utils/formatters";
import CharCounter from "../components/ui/CharCounter";
import PasswordRequirementHint, { MIN_PASSWORD_LENGTH } from "../components/ui/PasswordRequirementHint";
import TactileButton from "../components/ui/TactileButton";
import CompanyLogo from "../components/ui/CompanyLogo";

const FIELD_LIMITS = { name: 200, address: 300 };

export default function ProfilePage() {
  const { user } = useAuth();
  const { company, saveCompany } = useCompany();
  const { addToast } = useToast();
  const [form, setForm] = useState(null);
  const [pw, setPw] = useState({ current: "" });
  const [pwErr, setPwErr] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (company) setForm({ ...company });
  }, [company]);

  if (!form) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    try {
      await saveCompany(form);
      addToast("Dados da empresa atualizados.");
    } catch (err) {
      addToast(err.message || "Não foi possível salvar os dados da empresa.", "error");
    }
  };

  const handleLogoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const updated = await companyService.uploadCompanyLogo(company.id, file);
      await saveCompany(updated);
      setForm((f) => ({ ...f, ...updated }));
      addToast("Logotipo da empresa atualizado com sucesso!");
    } catch (err) {
      addToast(err.message || "Falha ao enviar logotipo.", "error");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    try {
      const updated = await companyService.removeCompanyLogo(company.id);
      await saveCompany(updated);
      setForm((f) => ({ ...f, logoUrl: null }));
      addToast("Logotipo removido. As iniciais da empresa serão exibidas.");
    } catch (err) {
      addToast(err.message || "Falha ao remover logotipo.", "error");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleTestAlertEmail = async () => {
    setTestingAlert(true);
    try {
      const res = await alertService.triggerExpiryCheck(15);
      if (res.notified) {
        addToast(`E-mail de alerta enviado para ${res.email} (${res.count} produto(s) listados).`);
      } else if (res.reason) {
        addToast(`Aviso: ${res.reason} (${res.count ?? 0} produto(s) analisados).`, "error");
      } else if (res.count === 0) {
        addToast(`Nenhum produto próximo do vencimento nos próximos 15 dias.`);
      } else {
        addToast(`Checagem concluída: ${res.count} produto(s) encontrados.`);
      }
    } catch (err) {
      addToast(err.message || "Não foi possível testar o envio de alertas.", "error");
    } finally {
      setTestingAlert(false);
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (pwSubmitting) return; // evita clique duplo disparando 2 pedidos seguidos
    if (!pw.current) {
      setPwErr("Informe sua senha atual.");
      return;
    }
    if (pw.current.length < MIN_PASSWORD_LENGTH) {
      setPwErr(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    setPwErr("");
    setPwSubmitting(true);
    try {
      const isCurrentPasswordValid = await authService.verifyCurrentPassword(user.email, pw.current);
      if (!isCurrentPasswordValid) {
        setPwErr("Senha atual incorreta.");
        return;
      }
      await authService.requestPasswordReset(user.email);
      setPw({ current: "" });
      addToast(`Enviamos um link de troca de senha para ${user.email}.`);
    } catch (err) {
      addToast(err.message || "Não foi possível iniciar a troca de senha.", "error");
    } finally {
      setPwSubmitting(false);
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
          <CompanyLogo company={form} size="xl" bgClass="bg-navy" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoSelect}
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="inline-flex items-center gap-2 text-xs font-semibold text-teal-700 hover:text-teal-800 border border-teal-200 bg-teal-50 hover:bg-teal-100/80 px-3.5 py-2 rounded-xl transition disabled:opacity-60 select-none cursor-pointer"
              >
                {uploadingLogo ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    Enviando imagem...
                  </>
                ) : (
                  <>
                    <ImagePlus size={14} />
                    {form.logoUrl ? "Alterar logotipo" : "Adicionar logotipo"}
                  </>
                )}
              </button>
              {form.logoUrl && !uploadingLogo && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 border border-red-200 bg-red-50 hover:bg-red-100/80 px-3 py-2 rounded-xl transition cursor-pointer"
                >
                  <Trash2 size={13} />
                  Remover
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">PNG, JPG, WebP ou SVG (máx. 3MB)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Nome da empresa</label>
            <div className="relative">
              <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={FIELD_LIMITS.name} className={inputCls} />
            </div>
            <CharCounter value={form.name} max={FIELD_LIMITS.name} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-600">E-mail principal (notificações)</label>
              <button
                type="button"
                onClick={handleTestAlertEmail}
                disabled={testingAlert}
                className="text-xs font-semibold text-amber-600 hover:text-amber-700 disabled:text-slate-400 inline-flex items-center gap-1 transition select-none cursor-pointer"
                title="Dispara um teste imediato de alerta de produtos a vencer"
              >
                <Send size={11} />
                {testingAlert ? "Testando..." : "Testar envio de alerta"}
              </button>
            </div>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="email" value={form.notificationEmail} onChange={(e) => set("notificationEmail", e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Telefone</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={form.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} inputMode="numeric" maxLength={15} placeholder="(00) 00000-0000" className={inputCls} />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Endereço</label>
            <input value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={FIELD_LIMITS.address} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition" />
            <CharCounter value={form.address} max={FIELD_LIMITS.address} />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <TactileButton type="submit" variant="amber" padding="10px 20px" rounded={12}>
            Salvar alterações
          </TactileButton>
        </div>
      </form>

      <form onSubmit={handleSavePassword} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-navy flex items-center justify-center">
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
            Confirme sua senha atual e enviaremos um link para o seu e-mail cadastrado — é lá que você define a
            senha nova.
          </p>
        </div>

        <div className="max-w-xs">
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Senha atual</label>
          <input type="password" value={pw.current} onChange={(e) => setPw({ current: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" placeholder="••••••••" />
          <PasswordRequirementHint value={pw.current} />
        </div>

        {pwErr && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={15} className="shrink-0" />
            {pwErr}
          </div>
        )}

        <div className="flex justify-end pt-1">
          <TactileButton
            type="submit"
            variant="navy"
            disabled={pwSubmitting}
            padding="10px 20px"
            rounded={12}
          >
            {pwSubmitting ? "Enviando..." : "Enviar link de troca de senha"}
          </TactileButton>
        </div>
      </form>
    </div>
  );
}
