import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  FileSpreadsheet,
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
    <aside className="relative isolate hidden h-screen w-1/2 shrink-0 overflow-hidden border-r border-white/10 bg-[#102238] text-white lg:flex">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "linear-gradient(135deg, black, transparent 78%)",
        }}
      />
      <div aria-hidden="true" className="absolute -right-36 top-1/4 h-[32rem] w-[32rem] rounded-full border border-amber-400/10" />
      <div aria-hidden="true" className="absolute -right-20 top-[30%] h-[24rem] w-[24rem] rounded-full border border-amber-400/10" />

      <div className="relative z-10 flex min-h-screen w-full flex-col justify-between p-10 xl:p-14">
        <Logo dark />

        <div className="my-auto max-w-2xl py-10">
          <div className="mb-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">
            <span className="h-px w-7 bg-amber-400" />
            Visibilidade para agir antes
          </div>

          <h1 className="max-w-xl text-4xl font-extrabold leading-[1.08] tracking-tight xl:text-5xl">
            Cada item no prazo.
            <span className="mt-1 block text-amber-300">Reposição no ponto.</span>
          </h1>

          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-300 xl:text-base">
            Acompanhe validades, níveis de estoque e movimentações da sua operação em um painel claro e rastreável.
          </p>

          <div className="mt-9 grid max-w-xl grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
              <ShieldCheck size={19} className="mb-3 text-teal-300" />
              <p className="text-sm font-bold text-white">Validade monitorada</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Encontre primeiro o que precisa de atenção.</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.05] p-4">
              <FileSpreadsheet size={19} className="mb-3 text-amber-300" />
              <p className="text-sm font-bold text-white">Movimentação rastreável</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">Consulte alterações e gere relatórios da operação.</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-[11px] font-medium text-slate-400">
            <span>Armazém central</span>
            <span className="h-1 w-1 rounded-full bg-amber-400" />
            <span>Lojas e filiais</span>
            <span className="h-1 w-1 rounded-full bg-amber-400" />
            <span>Reposições</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-5 text-xs text-slate-400">
          <span>© {new Date().getFullYear()} Valida Fácil</span>
          <a
            href="https://wa.me/558894672031"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            <MessageCircle size={15} className="text-emerald-300" />
            Precisa de ajuda?
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </aside>
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

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="recovery-email" className="block text-xs font-semibold text-slate-700 mb-2">
            E-mail cadastrado
          </label>
          <div className="relative">
            <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="recovery-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@empresa.com"
              className="w-full min-h-11 pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
            />
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
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
      <p className="text-slate-500 text-sm mb-5">Entre para acompanhar o estoque da sua empresa.</p>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-2">
            E-mail corporativo
          </label>
          <div className="relative">
            <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              disabled={isLocked}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@empresa.com"
              className={`w-full min-h-11 pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition ${
                isLocked ? "bg-slate-50 opacity-60 cursor-not-allowed" : ""
              }`}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2.5">
            <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
              Senha
            </label>
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs font-semibold text-amber-700 hover:text-amber-800 transition cursor-pointer"
            >
              Esqueci minha senha
            </button>
          </div>
          <div className="relative">
            <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="login-password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              disabled={isLocked}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full min-h-11 pl-11 pr-11 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition ${
                isLocked ? "bg-slate-50 opacity-60 cursor-not-allowed" : ""
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPw}
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
          <div role="alert" className="flex items-center gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5">
            <ShieldAlert size={18} className="shrink-0 text-red-600" />
            <div className="text-xs">
              <p className="font-semibold">Proteção contra tentativas excessivas ativada</p>
              <p className="text-red-600 mt-0.5">Aguarde <strong>{lockoutSeconds}s</strong> para tentar novamente.</p>
            </div>
          </div>
        )}

        {error && !isLocked && (
          <div role="alert" className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
            <AlertTriangle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        <TactileButton
          type="submit"
          variant="amber"
          disabled={loading || isLocked}
          className="w-full"
          padding="12px 20px"
          rounded={12}
        >
          {loading ? "Entrando..." : isLocked ? `Aguarde (${lockoutSeconds}s)` : "Entrar"}
        </TactileButton>
      </form>

      <p className="text-center text-xs text-slate-400 mt-5">
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
      <div className="flex-1 min-h-screen lg:h-screen lg:overflow-y-auto flex flex-col items-center justify-center px-4 py-5 sm:p-8 lg:p-12 bg-slate-100">
        <div className="w-full max-w-md my-auto py-1 sm:py-3">
          
          {/* Mobile & Tablet Header (Intro text before login card) */}
          <div className="lg:hidden text-center mb-5 sm:mb-7 px-2">
            <Logo />
            <h1 className="text-slate-900 text-xl sm:text-2xl font-extrabold tracking-tight leading-tight">
              Estoque seguro. Validade sob controle.
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm mt-2 max-w-sm mx-auto leading-relaxed">
              Acompanhe produtos, vencimentos e reposições em um só lugar.
            </p>
          </div>

          {/* White Login / Reset Card */}
          <div className="w-full bg-white p-5 sm:p-7 lg:p-9 rounded-2xl border border-slate-200 shadow-lg shadow-slate-300/30">
            <div className="hidden lg:block">
              <Logo />
            </div>

            {mode === "login" ? (
              <LoginForm onForgotPassword={() => setMode("forgot")} />
            ) : (
              <ForgotPasswordForm onBack={() => setMode("login")} />
            )}
          </div>

          <div className="lg:hidden mt-4 flex justify-center">
            <a
              href="https://wa.me/558894672031"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-slate-600 hover:bg-white hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
            >
              <MessageCircle size={15} className="text-emerald-700" />
              Precisa de ajuda? Fale com a equipe
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
