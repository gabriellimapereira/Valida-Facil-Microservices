import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Boxes, CheckCircle2, Eye, EyeOff, Lock, Mail, ShieldAlert, Layers } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import * as authService from "../services/authService";
import PasswordRequirementHint, { MIN_PASSWORD_LENGTH } from "../components/ui/PasswordRequirementHint";
import TactileButton from "../components/ui/TactileButton";

const Logo = ({ dark }) => (
  <div className={`flex items-center gap-3 ${dark ? "" : "lg:hidden mb-8 justify-center"}`}>
    <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center shadow-sm">
      <Boxes size={22} className="text-white" />
    </div>
    <span className={`font-bold text-xl ${dark ? "text-white tracking-tight" : "text-slate-900"}`}>Valida Fácil</span>
  </div>
);

function BrandPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 bg-navy relative overflow-hidden flex-col justify-between p-12 lg:p-16 border-r border-slate-800">
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-600/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-teal-500/10 blur-3xl -mb-20 -ml-20 pointer-events-none" />
      
      <div className="relative z-10"><Logo dark /></div>

      <div className="relative z-10 max-w-lg">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-5">
          <Layers size={13} />
          Plataforma Multi-Empresa
        </div>
        <h1 className="text-white text-4xl font-bold leading-tight tracking-tight mb-4">
          Controle inteligente de validade e estoque para sua empresa.
        </h1>
        <p className="text-slate-300 text-base leading-relaxed">
          Evite perdas financeiras, gerencie produtos por categorias e acompanhe movimentações de estoque em um único painel corporativo.
        </p>
      </div>

      <div className="relative z-10 text-slate-400 text-xs">
        © {new Date().getFullYear()} Valida Fácil • Gestão Empresarial de Estoque
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
  const [email, setEmail] = useState("contato@emporioboasafra.com.br");
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
      <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mb-1">Bem-vindo de volta</h2>
      <p className="text-slate-500 text-sm mb-7">Acesse o painel da sua empresa para gerenciar o estoque.</p>

      <form onSubmit={submit} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2.5">Usuário ou e-mail corporativo</label>
          <div className="relative">
            <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
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
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition cursor-pointer"
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
    <div className="min-h-screen w-full flex bg-slate-100">
      <BrandPanel />

      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12">
        <div className="w-full max-w-md sm:bg-white sm:p-8 lg:p-10 sm:rounded-3xl sm:border sm:border-slate-200/80 sm:shadow-lg sm:shadow-slate-200/50">
          <Logo />
          {mode === "login" ? (
            <LoginForm onForgotPassword={() => setMode("forgot")} />
          ) : (
            <ForgotPasswordForm onBack={() => setMode("login")} />
          )}
        </div>
      </div>
    </div>
  );
}
