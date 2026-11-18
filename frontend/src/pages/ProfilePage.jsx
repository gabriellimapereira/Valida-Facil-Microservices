import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  ImagePlus,
  Lock,
  Mail,
  Phone,
  Send,
  Shield,
  ShieldCheck,
  Store,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import * as authService from "../services/authService";
import * as alertService from "../services/alertService";
import * as companyService from "../services/companyService";
import * as storeService from "../services/storeService";
import { formatPhone, fmtDate } from "../utils/formatters";
import CharCounter from "../components/ui/CharCounter";
import PasswordRequirementHint, { MIN_PASSWORD_LENGTH } from "../components/ui/PasswordRequirementHint";
import TactileButton from "../components/ui/TactileButton";
import CompanyLogo from "../components/ui/CompanyLogo";
import InviteMemberModal from "../components/profile/InviteMemberModal";
import ConfirmationModal from "../components/ui/ConfirmationModal";

const FIELD_LIMITS = { name: 200, address: 300 };

export default function ProfilePage() {
  const { user, profile, role } = useAuth();
  const { company, saveCompany } = useCompany();
  const { addToast } = useToast();

  const isAdmin = role === "admin";

  const [form, setForm] = useState(null);
  const [pw, setPw] = useState({ current: "", newPassword: "", confirm: "" });
  const [showPw, setShowPw] = useState({ current: false, newPassword: false, confirm: false });
  const [pwErr, setPwErr] = useState("");
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [members, setMembers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [removingMember, setRemovingMember] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (company) {
      setForm({ ...company });
      loadMembers(company.id);
      loadStores();
    }
  }, [company]);

  const loadStores = async () => {
    try {
      const list = await storeService.fetchStores();
      setStores(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Falha ao carregar unidades:", err);
    }
  };

  const loadMembers = async (companyId) => {
    if (!companyId) return;
    setLoadingMembers(true);
    try {
      const list = await companyService.fetchCompanyMembers(companyId);
      setMembers(list);
    } catch (err) {
      console.error("Falha ao carregar colaboradores:", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  if (!form) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    const trimmedName = form.name?.trim();
    if (!trimmedName) {
      addToast("Informe a Razão Social da empresa.", "error");
      return;
    }
    if (trimmedName.length > 200) {
      addToast("A Razão Social deve ter no máximo 200 caracteres.", "error");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const trimmedEmail = form.notificationEmail?.trim();
    if (trimmedEmail && !emailRegex.test(trimmedEmail)) {
      addToast("Informe um e-mail de notificações válido (exemplo@empresa.com).", "error");
      return;
    }

    const phoneDigits = form.phone ? form.phone.replace(/\D/g, "") : "";
    if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
      addToast("Telefone incompleto — informe DDD + 8 ou 9 dígitos.", "error");
      return;
    }

    if (form.address && form.address.length > 300) {
      addToast("O endereço deve ter no máximo 300 caracteres.", "error");
      return;
    }

    try {
      await saveCompany({
        ...form,
        name: trimmedName,
        notificationEmail: trimmedEmail || form.notificationEmail,
        address: form.address?.trim() || "",
      });
      addToast("Dados corporativos atualizados com sucesso!");
    } catch (err) {
      addToast(err.message || "Não foi possível salvar os dados da empresa.", "error");
    }
  };

  const handleLogoSelect = async (e) => {
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    setUploadingLogo(true);
    try {
      const updated = await companyService.removeCompanyLogo();
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
    if (pwSubmitting) return;

    if (!pw.current) {
      setPwErr("Informe sua senha atual.");
      return;
    }
    if (!pw.newPassword) {
      setPwErr("Informe a nova senha.");
      return;
    }
    if (pw.newPassword.length < MIN_PASSWORD_LENGTH) {
      setPwErr(`A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (pw.newPassword !== pw.confirm) {
      setPwErr("A confirmação da nova senha não confere.");
      return;
    }

    setPwErr("");
    setPwSubmitting(true);
    try {
      await authService.changePassword(pw.current, pw.newPassword);
      setPw({ current: "", newPassword: "", confirm: "" });
      addToast("Sua senha foi alterada com sucesso!");
    } catch (err) {
      addToast(err.message || "Não foi possível alterar sua senha.", "error");
    } finally {
      setPwSubmitting(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (sendingResetEmail) return;
    setSendingResetEmail(true);
    try {
      await authService.requestPasswordReset(user.email);
      addToast(`Enviamos um link de recuperação para ${user.email}.`);
    } catch (err) {
      addToast(err.message || "Não foi possível enviar o link de recuperação.", "error");
    } finally {
      setSendingResetEmail(false);
    }
  };

  const handleInviteMember = async (payload) => {
    try {
      await companyService.inviteTeamMember(payload);
      addToast(`Convite enviado com sucesso para ${payload.email}!`);
      await loadMembers(company.id);
    } catch (err) {
      addToast(err.message || "Falha ao enviar convite.", "error");
      throw err;
    }
  };

  const handleChangeMemberStore = async (member, nextStoreId) => {
    if (!isAdmin || member.role === "admin") return;
    const normalizedStoreId = nextStoreId || null;
    if ((member.storeId || null) === normalizedStoreId) return;

    setUpdatingMemberId(member.id);
    try {
      const updated = await companyService.updateMember(member.id, {
        storeId: normalizedStoreId,
      });
      const resolvedStoreName = normalizedStoreId
        ? stores.find((s) => s.id === normalizedStoreId)?.name || updated?.storeName || null
        : null;
      setMembers((prev) =>
        prev.map((m) =>
          m.id === member.id
            ? { ...m, storeId: normalizedStoreId, storeName: resolvedStoreName }
            : m
        )
      );
      addToast("Unidade de atuação atualizada com sucesso!");
    } catch (err) {
      addToast(err.message || "Falha ao atualizar unidade do colaborador.", "error");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!isAdmin || !memberToRemove) return;
    setRemovingMember(true);
    try {
      await companyService.removeMember(memberToRemove.id);
      addToast("Colaborador removido da empresa.");
      setMemberToRemove(null);
      await loadMembers(company.id);
    } catch (err) {
      addToast(err.message || "Falha ao remover colaborador.", "error");
    } finally {
      setRemovingMember(false);
    }
  };

  const inputCls = (disabled) =>
    `w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm transition ${
      disabled
        ? "bg-slate-900/60 text-slate-500 border-slate-700/60 cursor-not-allowed"
        : "bg-[#0B1322] text-white border-slate-700/80 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
    }`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header Info Card */}
      <div className="bg-[#122038]/90 backdrop-blur-md rounded-3xl border border-slate-700/60 shadow-2xl shadow-black/40 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isAdmin ? "bg-amber-500/15 border border-amber-500/30 text-amber-300" : "bg-teal-500/15 border border-teal-500/30 text-teal-300"
            }`}>
              <ShieldCheck size={13} className={isAdmin ? "text-amber-400" : "text-teal-400"} />
              {isAdmin ? "Perfil Administrador" : "Perfil Operador"}
            </span>
            {user?.email && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 border border-slate-700/70 text-slate-300">
                <User size={12} className="text-slate-400" />
                Conta conectada: <strong className="text-white font-semibold">{user.email}</strong>
              </span>
            )}
            {form.cnpj && <span className="text-xs text-slate-400 font-mono">CNPJ: {form.cnpj}</span>}
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">{form.name}</h2>
          <p className="text-sm text-slate-400 mt-0.5">Segmento: {form.segment || "Comércio Geral"}</p>
        </div>

        <div className="flex items-center gap-4 border-t sm:border-t-0 sm:border-l border-slate-700/60 pt-4 sm:pt-0 sm:pl-6">
          <CompanyLogo company={form} size="xl" bgClass="bg-amber-600" />
          {isAdmin && (
            <div className="space-y-1.5">
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
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200 hover:text-white border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3.5 py-2 rounded-xl transition disabled:opacity-60 select-none cursor-pointer"
              >
                {uploadingLogo ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
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
                  className="block text-[11px] font-semibold text-red-400 hover:text-red-300 transition cursor-pointer"
                >
                  Remover logotipo atual
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Company Form */}
      <form onSubmit={handleSaveCompany} className="bg-[#122038]/90 backdrop-blur-md rounded-3xl border border-slate-700/60 shadow-2xl shadow-black/40 p-5 sm:p-8 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
          <div>
            <h3 className="font-bold text-white text-base">Dados Corporativos</h3>
            <p className="text-xs text-slate-400">Informações visíveis em relatórios e cabeçalhos oficiais</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Razão Social / Nome da Empresa</label>
            <div className="relative">
              <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={form.name}
                disabled={!isAdmin}
                onChange={(e) => set("name", e.target.value)}
                maxLength={FIELD_LIMITS.name}
                className={inputCls(!isAdmin)}
              />
            </div>
            {isAdmin && <CharCounter value={form.name} max={FIELD_LIMITS.name} />}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">E-mail de Notificações</label>
              <button
                type="button"
                onClick={handleTestAlertEmail}
                disabled={testingAlert}
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 disabled:text-slate-500 inline-flex items-center gap-1 transition select-none cursor-pointer"
                title="Dispara um teste imediato de alerta de produtos a vencer"
              >
                <Send size={11} />
                {testingAlert ? "Testando..." : "Testar envio de alerta"}
              </button>
            </div>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={form.notificationEmail}
                disabled={!isAdmin}
                onChange={(e) => set("notificationEmail", e.target.value)}
                className={inputCls(!isAdmin)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Telefone de Contato</label>
            <div className="relative">
              <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={form.phone}
                disabled={!isAdmin}
                onChange={(e) => set("phone", formatPhone(e.target.value))}
                inputMode="numeric"
                maxLength={15}
                placeholder="(00) 00000-0000"
                className={inputCls(!isAdmin)}
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Endereço Comercial</label>
            <input
              value={form.address}
              disabled={!isAdmin}
              onChange={(e) => set("address", e.target.value)}
              maxLength={FIELD_LIMITS.address}
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition ${
                !isAdmin
                  ? "bg-slate-900/60 text-slate-500 border-slate-700/60 cursor-not-allowed"
                  : "bg-[#0B1322] text-white border-slate-700/80 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              }`}
            />
            {isAdmin && <CharCounter value={form.address} max={FIELD_LIMITS.address} />}
          </div>
        </div>

        {isAdmin && (
          <div className="flex justify-end pt-2 border-t border-slate-700/60">
            <TactileButton type="submit" variant="amber" padding="10px 22px" rounded={12} className="w-full sm:w-auto">
              Salvar alterações corporativas
            </TactileButton>
          </div>
        )}
      </form>

      {/* Team Management Section */}
      <div className="bg-[#122038]/90 backdrop-blur-md rounded-3xl border border-slate-700/60 shadow-2xl shadow-black/40 p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-light text-white flex items-center justify-center shadow-sm border border-white/10">
              <Users size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Equipe & Colaboradores</h3>
              <p className="text-xs text-slate-400">Membros cadastrados com acesso ao estoque da empresa</p>
            </div>
          </div>

          {isAdmin && (
            <TactileButton
              variant="amber"
              onClick={() => setShowInviteModal(true)}
              padding="8px 16px"
              rounded={10}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold">
                <UserPlus size={15} />
                <span>Convidar Colaborador</span>
              </div>
            </TactileButton>
          )}
        </div>

        {loadingMembers ? (
          <div className="py-6 text-center text-xs text-slate-400 animate-pulse">Carregando membros da equipe...</div>
        ) : members.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">Nenhum outro colaborador vinculado à empresa.</div>
        ) : (
          <div className="divide-y divide-slate-700/40">
            {members.map((m) => {
              const name = m.fullName || m.full_name || m.email || "Colaborador";
              const initials = name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0].toUpperCase())
                .join("") || "US";
              const isMemAdmin = m.role === "admin";

              return (
                <div key={m.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 text-slate-200 font-bold text-xs flex items-center justify-center border border-slate-700 shrink-0">
                      {initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white">{name}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isMemAdmin
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              : "bg-teal-500/15 text-teal-300 border border-teal-500/30"
                          }`}
                        >
                          {isMemAdmin ? <Shield size={10} className="text-amber-400" /> : <UserCheck size={10} className="text-teal-400" />}
                          {isMemAdmin ? "Administrador" : "Operador"}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800/90 text-slate-300 border border-slate-700/80">
                          <Store size={10} className="text-amber-400" />
                          {isMemAdmin
                            ? "Todas as unidades"
                            : m.storeId
                            ? m.storeName || stores.find((s) => s.id === m.storeId)?.name || "Filial vinculada"
                            : "Armazém Central"}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{m.email}</span>
                    </div>
                  </div>

                  {isAdmin && m.id !== user?.id && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {!isMemAdmin && (
                        <select
                          aria-label={`Unidade de atuação de ${name}`}
                          value={m.storeId || ""}
                          disabled={updatingMemberId === m.id}
                          onChange={(e) => handleChangeMemberStore(m, e.target.value)}
                          className="bg-[#0B1322] text-slate-200 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 disabled:opacity-50"
                        >
                          <option value="">Armazém Central</option>
                          {stores.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} {s.code ? `(${s.code})` : ""}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="button"
                        onClick={() => setMemberToRemove(m)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                        title="Remover colaborador da equipe"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security Form */}
      <form onSubmit={handleSavePassword} className="bg-[#122038]/90 backdrop-blur-md rounded-3xl border border-slate-700/60 shadow-2xl shadow-black/40 p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-700/60">
          <div className="w-10 h-10 rounded-xl bg-navy-light text-white flex items-center justify-center shadow-sm border border-white/10">
            <Lock size={18} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Segurança & Acesso Pessoal</h3>
            <p className="text-xs text-slate-400">
              Altere a senha da sua conta de acesso {user?.email && <span className="text-slate-300 font-mono">({user.email})</span>}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Senha atual</label>
            <div className="relative">
              <input
                type={showPw.current ? "text" : "password"}
                value={pw.current}
                onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-700/80 bg-[#0B1322] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => ({ ...s, current: !s.current }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                tabIndex={-1}
              >
                {showPw.current ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Nova senha</label>
            <div className="relative">
              <input
                type={showPw.newPassword ? "text" : "password"}
                value={pw.newPassword}
                onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-700/80 bg-[#0B1322] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => ({ ...s, newPassword: !s.newPassword }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                tabIndex={-1}
              >
                {showPw.newPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <PasswordRequirementHint value={pw.newPassword} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Confirmar nova senha</label>
            <div className="relative">
              <input
                type={showPw.confirm ? "text" : "password"}
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-700/80 bg-[#0B1322] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => ({ ...s, confirm: !s.confirm }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
                tabIndex={-1}
              >
                {showPw.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        {pwErr && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/40 border border-red-500/30 rounded-xl px-3.5 py-2.5">
            <AlertTriangle size={15} className="shrink-0" />
            {pwErr}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-700/60">
          <button
            type="button"
            onClick={handleSendResetEmail}
            disabled={sendingResetEmail}
            className="text-xs text-slate-400 hover:text-amber-400 transition underline disabled:opacity-50 cursor-pointer"
          >
            {sendingResetEmail ? "Enviando e-mail..." : `Esqueceu a senha atual? Enviar link de redefinição para ${user?.email || "seu e-mail"}`}
          </button>

          <TactileButton
            type="submit"
            variant="amber"
            disabled={pwSubmitting}
            padding="10px 22px"
            rounded={12}
            className="w-full sm:w-auto"
          >
            {pwSubmitting ? "Atualizando..." : "Salvar nova senha"}
          </TactileButton>
        </div>
      </form>

      {showInviteModal && (
        <InviteMemberModal
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInviteMember}
          stores={stores}
        />
      )}

      {memberToRemove && (
        <ConfirmationModal
          isOpen={!!memberToRemove}
          onClose={() => !removingMember && setMemberToRemove(null)}
          onConfirm={handleConfirmRemoveMember}
          loading={removingMember}
          title="Remover colaborador da equipe?"
          description={
            <>
              Tem certeza que deseja remover <strong className="text-slate-800 font-semibold">{memberToRemove.fullName || memberToRemove.email}</strong> da empresa? Essa ação revogará o acesso dele ao estoque.
            </>
          }
          confirmText="Remover colaborador"
          cancelText="Cancelar"
          variant="danger"
        />
      )}
    </div>
  );
}
