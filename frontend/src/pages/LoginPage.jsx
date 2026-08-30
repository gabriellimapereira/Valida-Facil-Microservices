import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Boxes, CheckCircle2, Eye, EyeOff, Lock, Mail, Sparkles, ShieldCheck, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import * as authService from "../services/authService";
import PasswordRequirementHint, { MIN_PASSWORD_LENGTH } from "../components/ui/PasswordRequirementHint";
import TactileButton from "../components/ui/TactileButton";

const Logo = ({ dark }) => (
  <div className={`flex items-center gap-3 ${dark ? "" : "lg:hidden mb-10 justify-center"}`}>
    <div className="w-10 h-10 rounded-xl bg-amber-600 flex items-center justify-center">
      <Boxes size={22} className="text-white" />
    </div>
    <span className={`font-semibold text-lg ${dark ? "text-white tracking-tight" : "text-slate-900"}`}>Valida Fácil</span>
  </div>
);

function BrandPanel() {
  return (
    <div className="hidden lg:flex lg:w-1/2 bg-navy relative overflow-hidden flex-col justify-between p-12">
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-amber-600/10" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-teal-500/10 -mb-24 -ml-24" />
      <div className="relative"><Logo dark /></div>

      <div className="relative">
        <p className="text-amber-400 text-sm font-medium mb-3 tracking-wide uppercase">Gestão de estoque multi-empresa</p>
        <h1 className="text-white text-4xl font-bold leading-tight mb-4">
          Controle total do seu estoque, para qualquer tipo de negócio.
        </h1>
        <p className="text-slate-400 text-base leading-relaxed max-w-md">
          Alimentos, moda, livros ou eletrônicos: acompanhe validade, preços e quantidades de
          atacado e varejo em um único painel.
        </p>
      </div>

      <div className="relative flex items-center gap-6 text-slate-400 text-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-teal-400" />
          Dados protegidos
        </div>
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-amber-400" />
          Alertas de validade
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
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto">
          <CheckCircle2 size={24} />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Verifique seu e-mail</h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          Enviamos um link de recuperação para <strong className="text-slate-800">{email}</strong>.
          Clique no link recebido para cadastrar sua nova senha.
        </p>
        <p className="text-xs text-slate-400">
          Não recebeu? Verifique a caixa de spam ou tente novamente em alguns minutos.
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-semibold text-amber-600 hover:text-amber-700"
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
      <p className="text-slate-500 text-sm mb-8">
        Digite o e-mail cadastrado e enviaremos as instruções para você redefinir sua chave de acesso.
      </p>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail cadastrado</label>
          <div className="relative">
            <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@empresa.com"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition"
            />
          </div>
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
          {submitting ? "Enviando..." : "Enviar link de redefinição"}
        </TactileButton>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
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
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Bem-vindo de volta</h2>
      <p className="text-slate-500 text-sm mb-8">Acesse o painel da sua empresa para continuar.</p>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Usuário ou e-mail</label>
          <div className="relative">
            <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={email}
              disabled={isLocked}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@empresa.com"
              className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition ${isLocked ? "bg-slate-50 opacity-60 cursor-not-allowed" : ""}`}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-700">Senha (Key)</label>
            <button type="button" onClick={onForgotPassword} className="text-xs font-medium text-teal-600 hover:text-teal-700">
              Esqueci minha senha
            </button>
          </div>
          <div className="relative">
            <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type={showPw ? "text" : "password"}
              value={password}
              disabled={isLocked}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition ${isLocked ? "bg-slate-50 opacity-60 cursor-not-allowed" : ""}`}
            />
            <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <PasswordRequirementHint value={password} />
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
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-600 select-none">
          <input type="checkbox" defaultChecked className="rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
          Manter-me conectado
        </label>

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

      <p className="text-center text-xs text-slate-400 mt-8">
        Sem Supabase configurado? Qualquer usuário/senha preenchidos entram no modo demonstração.
      </p>
    </>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // "login" | "forgot"

  return (
    <div className="min-h-screen w-full flex bg-slate-100">
      <BrandPanel />

      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
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
