import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Boxes, CheckCircle2, Eye, EyeOff, Lock, Mail, Sparkles, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import * as authService from "../services/authService";
import PasswordRequirementHint, { MIN_PASSWORD_LENGTH } from "../components/ui/PasswordRequirementHint";

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
    <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden flex-col justify-between p-12">
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
      addToast(`Enviamos um link de redefinição para ${email}.`);
    } catch (err) {
      setError(err.message || "Não foi possível enviar o e-mail. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={22} className="text-teal-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">Verifique seu e-mail</h2>
        <p className="text-sm text-slate-500 mb-6">
          Se existir uma conta com o e-mail <span className="font-medium text-slate-700">{email}</span>, um link de
          redefinição foi enviado. Pode levar alguns minutos para chegar — confira o spam também.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-teal-600 hover:text-teal-700"
        >
          ← Voltar para o login
        </button>
      </div>
    );
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Esqueceu sua senha?</h2>
      <p className="text-slate-500 text-sm mb-8">Informe seu e-mail e enviaremos um link para redefinir a senha.</p>

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

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-70 text-white font-semibold text-sm py-3 rounded-xl transition shadow-sm shadow-amber-600/20"
        >
          {submitting ? "Enviando..." : "Enviar link de redefinição"}
        </button>

        <button type="button" onClick={onBack} className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700">
          ← Voltar para o login
        </button>
      </form>
    </>
  );
}

function LoginForm({ onForgotPassword }) {
  const [email, setEmail] = useState("contato@emporioboasafra.com.br");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const { signIn, loading } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length > 0 && password.length < MIN_PASSWORD_LENGTH) {
      const message = `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
      setError(message);
      addToast(message, "error");
      return;
    }
    try {
      await signIn(email, password);
      addToast("Login realizado com sucesso!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message = err.message || "Não foi possível entrar. Verifique suas credenciais.";
      setError(message);
      addToast(message, "error");
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
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@empresa.com"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition"
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
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition"
            />
            <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <PasswordRequirementHint value={password} />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle size={15} className="shrink-0" />
            {error}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-600 select-none">
          <input type="checkbox" defaultChecked className="rounded border-slate-300 text-amber-600 focus:ring-amber-500" />
          Manter-me conectado
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-70 text-white font-semibold text-sm py-3 rounded-xl transition shadow-sm shadow-amber-600/20"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
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
