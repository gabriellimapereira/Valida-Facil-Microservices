import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  History,
  Lock,
  Mail,
  MessageCircle,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import BrandLogo from "../components/ui/BrandLogo";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import * as authService from "../services/authService";
import PasswordRequirementHint, { MIN_PASSWORD_LENGTH } from "../components/ui/PasswordRequirementHint";
import TactileButton from "../components/ui/TactileButton";

const Logo = ({ dark }) => (
  <div className={`flex items-center gap-3 ${dark ? "" : "mb-6 justify-center"}`}>
    <BrandLogo size={40} className="shadow-md shadow-black/20 rounded-full shrink-0" />
    <span className={`font-bold text-xl ${dark ? "text-white tracking-tight" : "text-slate-900"}`}>Valida Fácil</span>
  </div>
);

function BrandPanel() {
  return (
    <div className="hidden lg:block lg:w-1/2 h-screen overflow-y-auto bg-navy relative border-r border-slate-800 scroll-smooth">
      {/* Dynamic ambient blur glows */}
      <div className="sticky top-0 h-0 z-0 pointer-events-none">
        <div className="absolute top-12 right-12 w-96 h-96 rounded-full bg-amber-600/10 blur-3xl" />
        <div className="absolute top-96 left-12 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute top-[800px] right-8 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 p-10 lg:p-14">
        {/* Section 1: Hero */}
        <div className="min-h-[82vh] flex flex-col justify-between pt-2 pb-16">
          <div><Logo dark /></div>

          <div className="max-w-lg my-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/10 text-amber-400 text-xs font-medium backdrop-blur-md">
              <HelpCircle size={14} />
              Tá precisando de ajuda para gerenciar seu estoque?
            </div>

            <h1 className="text-white text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
              Controle inteligente de validade e estoque para sua empresa.
            </h1>

            <p className="text-slate-300 text-base leading-relaxed">
              Evite perdas financeiras por produtos vencidos, gerencie categorias e acompanhe movimentações de estoque em um único painel corporativo.
            </p>

            <div className="pt-2 flex items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-teal-400" />
                <span>Multi-usuários & RBAC</span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
              <div className="flex items-center gap-1.5">
                <FileSpreadsheet size={16} className="text-amber-400" />
                <span>Relatórios PDF & Excel</span>
              </div>
            </div>
          </div>

          <div className="text-slate-400 text-xs flex items-center gap-2 pt-6">
            <span>Role para conhecer mais recursos</span>
            <ArrowDown size={14} className="animate-bounce text-amber-400" />
          </div>
        </div>

        {/* Section 2: Relatórios & Auditoria */}
        <div className="pt-16 pb-20">
          <div className="max-w-lg mr-auto space-y-5 text-left bg-white/5 border border-white/10 p-7 rounded-3xl backdrop-blur-md shadow-xl transition transform hover:border-teal-500/30">
            <h2 className="text-white text-2xl font-bold leading-snug">
              Controle rigoroso de movimentações.
            </h2>

            <p className="text-slate-300 text-sm leading-relaxed">
              Tenha rastreabilidade em todas as operações de estoque. O sistema registra automaticamente qual colaborador realizou cada entrada, saída ou ajuste, mantendo o histórico de auditoria transparente e confiável.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                <History className="text-amber-400 mb-2" size={20} />
                <h4 className="text-xs font-bold text-white">Rastreabilidade Total</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">Saiba exatamente quem alterou cada produto e a quantidade.</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition">
                <FileSpreadsheet className="text-teal-400 mb-2" size={20} />
                <h4 className="text-xs font-bold text-white">Exportação Executiva</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-normal">Relatórios em PDF e Excel prontos para reuniões e fiscos.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 3: WhatsApp Contact (Com espaçamento equilibrado de 176px) */}
        <div className="pt-44 pb-16">
          <div className="max-w-lg ml-auto space-y-5 text-right bg-gradient-to-br from-emerald-950/40 to-slate-900/60 border border-emerald-500/20 p-7 rounded-3xl backdrop-blur-md shadow-xl transition transform hover:border-emerald-500/40">
            <h2 className="text-white text-2xl font-bold leading-snug">
              Fale com nossa equipe no WhatsApp.
            </h2>

            <p className="text-slate-300 text-sm leading-relaxed">
              Quer ajuda no cadastro da sua empresa, um plano sob medida ou esclarecer dúvidas operacionais? Atendemos você de forma rápida e direta.
            </p>

            <div className="pt-2 flex justify-end">
              <a
                href="https://wa.me/558894672031"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/50 transition transform hover:-translate-y-0.5 active:translate-y-0 select-none cursor-pointer"
              >
                <MessageCircle size={18} />
                <span>Entrar em contato: (88) 94672-031</span>
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-16 border-t border-white/10 text-slate-400 text-xs flex items-center justify-between">
          <span>© {new Date().getFullYear()} Valida Fácil</span>
          <span>Gestão Empresarial de Estoque</span>
        </div>
      </div>
    </div>
  );
}

function ForgotPasswordForm({ onBack }) {
  const { addToast } = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Informe o e-mail da sua conta.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await authService.requestPasswordReset(email.trim());
      setSent(true);
      addToast("E-mail de recuperação enviado!");
    } catch (err) {
      setError(err.message || "Não foi possível enviar o e-mail.");
      addToast(err.message || "Não foi possível enviar o e-mail.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center space-y-4 py-2">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto border border-teal-100 shadow-sm">
          <CheckCircle2 size={26} />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Verifique seu e-mail</h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          Enviamos um link de recuperação para <strong className="text-slate-800 font-semibold">{email}</strong>.
          Clique no link recebido para cadastrar sua nova senha.
        </p>
        <p className="text-xs text-slate-400">
          Não recebeu? Verifique a pasta de spam ou tente novamente em alguns minutos.
        </p>
        <div className="pt-3">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-semibold text-amber-600 hover:text-amber-700 transition cursor-pointer"
          >
            Voltar para o login
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Esqueceu sua senha?</h2>
      <p className="text-slate-500 text-sm mb-7">
        Digite o e-mail cadastrado e enviaremos as instruções para você redefinir sua chave de acesso.
      </p>

      <form onSubmit={submit} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2.5">E-mail cadastrado</label>
          <div className="relative">
            <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@empresa.com"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
            <AlertTriangle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        <TactileButton
          type="submit"
          variant="amber"
          disabled={submitting}
          className="w-full"
          padding="13px 20px"
          rounded={12}
        >
          {submitting ? "Enviando..." : "Enviar link de redefinição"}
        </TactileButton>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            ← Voltar para o login
          </button>
        </div>
      </form>
    </>
  );
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

function LoginForm({ onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const { signIn, loading } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((s) => {
        if (s <= 1) {
          clearInterval(timer);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const isLocked = lockoutSeconds > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (isLocked) {
      addToast(`Aguarde ${lockoutSeconds}s antes de tentar novamente.`, "error");
      return;
    }
    setError("");
    if (password.length > 0 && password.length < MIN_PASSWORD_LENGTH) {
      const message = `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
      setError(message);
      addToast(message, "error");
      return;
    }
    try {
      await signIn(email, password);
      setFailedAttempts(0);
      addToast("Login realizado com sucesso!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        setLockoutSeconds(LOCKOUT_SECONDS);
        const lockMsg = `Muitas tentativas incorretas. Acesso temporariamente bloqueado por ${LOCKOUT_SECONDS} segundos.`;
        setError(lockMsg);
        addToast(lockMsg, "error");
      } else {
        const message = err.message || "Não foi possível entrar. Verifique suas credenciais.";
        setError(message);
        addToast(message, "error");
      }
    }
  };

  return (
    <>
      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-1">Acesse sua conta</h2>
      <p className="text-slate-500 text-sm mb-7">Acesse o painel da sua empresa para gerenciar o estoque.</p>

      <form onSubmit={submit} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2.5">E-mail corporativo</label>
          <div className="relative">
            <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              value={email}
              disabled={isLocked}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@empresa.com"
              className={`w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition ${
                isLocked ? "bg-slate-50 opacity-60 cursor-not-allowed" : ""
              }`}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label className="block text-xs font-semibold text-slate-700">Chave de acesso / Senha</label>
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs font-semibold text-red-600 hover:text-red-700 transition cursor-pointer"
            >
              Esqueci minha senha
            </button>
          </div>
          <div className="relative">
            <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type={showPw ? "text" : "password"}
              value={password}
              disabled={isLocked}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full pl-11 pr-11 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition ${
                isLocked ? "bg-slate-50 opacity-60 cursor-not-allowed" : ""
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded transition cursor-pointer"
            >
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <div className="mt-2">
            <PasswordRequirementHint value={password} />
          </div>
        </div>

        {isLocked && (
          <div className="flex items-center gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5 animate-pulse">
            <ShieldAlert size={18} className="shrink-0 text-red-600" />
            <div className="text-xs">
              <p className="font-semibold">Proteção contra tentativas excessivas ativada</p>
              <p className="text-red-600 mt-0.5">Aguarde <strong>{lockoutSeconds}s</strong> para tentar novamente.</p>
            </div>
          </div>
        )}

        {error && !isLocked && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
            <AlertTriangle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 select-none cursor-pointer">
          <input type="checkbox" defaultChecked className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer" />
          Manter-me conectado nesta máquina
        </label>

        <TactileButton
          type="submit"
          variant="amber"
          disabled={loading || isLocked}
          className="w-full"
          padding="13px 20px"
          rounded={12}
        >
          {loading ? "Entrando..." : isLocked ? `Aguarde (${lockoutSeconds}s)` : "Entrar"}
        </TactileButton>
      </form>

      <p className="text-center text-xs text-slate-400 mt-6">
        Valida Fácil • Gestão Empresarial de Estoque
      </p>
    </>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // "login" | "forgot"

  return (
    <div className="min-h-screen w-full flex bg-slate-100 overflow-x-hidden">
      {/* Desktop side panel */}
      <BrandPanel />

      {/* Main form container (Scrollable on mobile/tablet, centered on desktop) */}
      <div className="flex-1 min-h-screen lg:h-screen lg:overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 bg-slate-100">
        <div className="w-full max-w-md my-auto py-6 sm:py-8">
          
          {/* Mobile & Tablet Header (Intro text before login card) */}
          <div className="lg:hidden text-center mb-8 px-2 space-y-3">
            <Logo />
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs font-semibold mx-auto">
              <HelpCircle size={14} className="shrink-0 text-amber-600" />
              <span>Tá precisando de ajuda para gerenciar seu estoque?</span>
            </div>

            <h1 className="text-slate-900 text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
              Controle inteligente de validade e estoque
            </h1>

            <p className="text-slate-600 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
              Evite perdas por vencimentos e acompanhe movimentações corporativas em tempo real.
            </p>
          </div>

          {/* White Login / Reset Card */}
          <div className="w-full bg-white p-6 sm:p-8 lg:p-10 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50">
            <div className="hidden lg:block">
              <Logo />
            </div>

            {mode === "login" ? (
              <LoginForm onForgotPassword={() => setMode("forgot")} />
            ) : (
              <ForgotPasswordForm onBack={() => setMode("login")} />
            )}
          </div>

          {/* Mobile & Tablet Feature Showcase Cards (Visible below login card on mobile) */}
          <div className="lg:hidden mt-8 space-y-4 px-1">
            <div className="bg-white/80 border border-slate-200/80 p-5 rounded-2xl shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-1">Controle rigoroso de movimentações</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                Rastreabilidade de colaboradores em entradas, saídas e ajustes, além de relatórios executivos em PDF e Excel.
              </p>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1"><History size={13} className="text-amber-600" /> Histórico auditável</span>
                <span>•</span>
                <span className="flex items-center gap-1"><FileSpreadsheet size={13} className="text-teal-600" /> Exportação 1-clique</span>
              </div>
            </div>

            <div className="bg-emerald-900/90 text-white p-5 rounded-2xl shadow-md border border-emerald-800">
              <h3 className="text-sm font-bold text-white mb-1">Fale com nossa equipe no WhatsApp</h3>
              <p className="text-xs text-emerald-100/90 leading-relaxed mb-3">
                Dúvidas ou precisa de um plano sob medida para seu negócio? Atendimento direto e rápido.
              </p>
              <a
                href="https://wa.me/558894672031"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition active:scale-95 cursor-pointer"
              >
                <MessageCircle size={15} />
                <span>WhatsApp: (88) 94672-031</span>
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
