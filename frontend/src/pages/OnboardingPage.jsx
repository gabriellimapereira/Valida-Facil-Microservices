import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Building2, Mail, Phone } from "lucide-react";
import BrandLogo from "../components/ui/BrandLogo";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import * as companyService from "../services/companyService";
import { formatCnpj, isValidCnpj, formatPhone } from "../utils/formatters";
import CharCounter from "../components/ui/CharCounter";
import CnpjValidityHint from "../components/ui/CnpjValidityHint";
import TactileButton from "../components/ui/TactileButton";

const FIELD_LIMITS = { name: 200, segment: 100, address: 300 };

const EMPTY_FORM = {
  name: "",
  segment: "",
  notificationEmail: "",
  phone: "",
  cnpj: "",
  address: "",
  initials: "",
};

export default function OnboardingPage() {
  const { needsOnboarding, refreshProfile } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!needsOnboarding) {
    return <Navigate to="/dashboard" replace />;
  }

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.notificationEmail.trim() || !form.initials.trim() || !form.phone.trim() || !form.cnpj.trim()) {
      setError("Preencha nome da empresa, e-mail de notificações, sigla, telefone e CNPJ.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.notificationEmail.trim())) {
      setError("Informe um e-mail de notificações válido (exemplo@empresa.com).");
      return;
    }
    const phoneDigits = form.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setError("Telefone incompleto — informe DDD + número.");
      return;
    }
    if (!isValidCnpj(form.cnpj)) {
      setError("CNPJ inválido. Confira os números digitados.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await companyService.createCompany(form);
      await refreshProfile();
      addToast("Empresa cadastrada! Bem-vindo ao Valida Fácil.");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Não foi possível cadastrar a empresa.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <BrandLogo size={42} className="shadow-md shadow-black/20 rounded-full shrink-0" />
          <span className="text-slate-900 font-bold text-xl tracking-tight">Valida Fácil</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Cadastre sua empresa</h2>
          <p className="text-sm text-slate-500 mb-6">
            Sua conta já está criada — falta só vincular a uma empresa para começar a usar o sistema.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Nome da empresa</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={FIELD_LIMITS.name} placeholder="Ex: Empório Boa Safra" className={inputCls} />
              </div>
              <CharCounter value={form.name} max={FIELD_LIMITS.name} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Segmento</label>
                <input value={form.segment} onChange={(e) => set("segment", e.target.value)} maxLength={FIELD_LIMITS.segment} placeholder="Ex: Atacado & Varejo" className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                <CharCounter value={form.segment} max={FIELD_LIMITS.segment} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Sigla (até 3 letras)</label>
                <input value={form.initials} onChange={(e) => set("initials", e.target.value.toUpperCase().slice(0, 3))} placeholder="Ex: EB" className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">E-mail de notificações</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="email" value={form.notificationEmail} onChange={(e) => set("notificationEmail", e.target.value)} placeholder="estoque@suaempresa.com" className={inputCls} />
              </div>
              <p className="text-xs text-slate-400 mt-1">É pra esse e-mail que os alertas de estoque baixo e validade vão ser enviados.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Telefone</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={form.phone}
                    onChange={(e) => set("phone", formatPhone(e.target.value))}
                    inputMode="numeric"
                    maxLength={15}
                    placeholder="(00) 00000-0000"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">CNPJ</label>
                <input
                  value={form.cnpj}
                  onChange={(e) => set("cnpj", formatCnpj(e.target.value))}
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="00.000.000/0000-00"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                />
                <CnpjValidityHint value={form.cnpj} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Endereço</label>
              <input value={form.address} onChange={(e) => set("address", e.target.value)} maxLength={FIELD_LIMITS.address} placeholder="Rua, número — cidade, UF" className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
              <CharCounter value={form.address} max={FIELD_LIMITS.address} />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle size={15} className="shrink-0" />
                {error}
              </div>
            )}

            <TactileButton
              type="submit"
              variant="amber"
              disabled={submitting}
              className="w-full"
              padding="12px 20px"
              rounded={12}
            >
              {submitting ? "Cadastrando..." : "Cadastrar empresa e continuar"}
            </TactileButton>
          </form>
        </div>
      </div>
    </div>
  );
}
