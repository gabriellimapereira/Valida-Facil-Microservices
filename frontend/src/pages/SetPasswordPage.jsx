import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import BrandLogo from "../components/ui/BrandLogo";
import { useToast } from "../context/ToastContext";
import * as authService from "../services/authService";
import PasswordRequirementHint, { MIN_PASSWORD_LENGTH } from "../components/ui/PasswordRequirementHint";
import TactileButton from "../components/ui/TactileButton";

/**
 * SetPasswordPage — Tela de primeiro acesso para novos colaboradores convidados.
 * Utiliza fundo azul (navy corporativo do Valida Fácil) e linguagem voltada
 * à ativação de conta ("Defina sua senha" em vez de "nova senha").
 */
export default function SetPasswordPage() {
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [checkingLink, setCheckingLink] = useState(true);
  const [linkValid, setLinkValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;

    authService.getSessionUser().then((user) => {
      if (mounted && user) {
        setLinkValid(true);
        setCheckingLink(false);
      }
    }).catch(() => {});

    const subscription = authService.onAuthStateChange
      ? authService.onAuthStateChange((user) => {
          if (mounted && user) {
            setLinkValid(true);
            setCheckingLink(false);
          }
        })
      : null;

    const timer = setTimeout(async () => {
      try {
        const user = await authService.getSessionUser();
        if (mounted) {
          setLinkValid(Boolean(user));
          setCheckingLink(false);
        }
      } catch {
        if (mounted) {
          setLinkValid(false);
          setCheckingLink(false);
        }
      }
    }, 450);

    return () => {
      mounted = false;
      if (subscription?.unsubscribe) subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!password || !confirm) {
      setError("Preencha a senha nos dois campos.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await authService.updatePassword(password);
      setDone(true);
      await authService.logout("global");
      addToast("Senha cadastrada com sucesso! Faça login para começar.");
      setTimeout(() => navigate("/login", { replace: true }), 1600);
    } catch (err) {
      setError(err.message || "Não foi possível cadastrar a senha. O link pode ter expirado.");
    } finally {
      setSubmitting(false);
    }
  };

  const Logo = (
    <div className="flex items-center gap-3 mb-8 justify-center">
      <BrandLogo size={48} className="shadow-lg shadow-black/20 rounded-full shrink-0" />
      <span className="text-white font-bold text-2xl tracking-tight">Valida Fácil</span>
    </div>
  );

  if (checkingLink) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-navy-900 p-6 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="w-full max-w-sm text-center relative z-10">
          {Logo}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 text-slate-200 text-sm">
            Verificando link de convite...
          </div>
        </div>
      </div>
    );
  }

  if (!linkValid) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-navy-900 p-6 relative overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
        <div className="w-full max-w-md text-center relative z-10">
          {Logo}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 text-left">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-4 border border-red-100">
              <AlertTriangle size={24} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Convite expirado ou inválido</h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              Esse link de convite não é mais válido ou já foi utilizado. Peça ao administrador da sua empresa para reenviar o convite.
            </p>
            <TactileButton
              variant="amber"
              onClick={() => navigate("/login", { replace: true })}
              className="w-full"
              padding="12px 20px"
              rounded={12}
            >
              Ir para tela de login
            </TactileButton>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-navy-900 p-6 relative overflow-hidden">
        <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="w-full max-w-md text-center relative z-10">
          {Logo}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4 border border-teal-100">
              <CheckCircle2 size={28} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Conta ativada com sucesso!</h2>
            <p className="text-sm text-slate-500 mb-2">Sua senha foi definida. Você já faz parte da equipe.</p>
            <p className="text-xs text-amber-600 font-semibold">Redirecionando para o login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-navy-900 p-6 relative overflow-hidden">
      {/* Luzes decorativas sutis no fundo azul */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {Logo}

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">Defina sua senha</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Cadastre uma senha de acesso com pelo menos 8 caracteres para entrar na sua conta do Valida Fácil.
          </p>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Senha</label>
              <div className="relative">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <PasswordRequirementHint value={password} />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Confirmar senha</label>
              <div className="relative">
                <Lock size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPw ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition"
                />
              </div>
              {confirm && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${confirm === password ? "text-teal-600" : "text-red-500"}`}>
                  {confirm === password ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                  {confirm === password ? "As senhas coincidem." : "As senhas ainda não coincidem."}
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                <AlertTriangle size={15} className="shrink-0" />
                {error}
              </div>
            )}

            <div className="pt-2">
              <TactileButton
                type="submit"
                variant="amber"
                disabled={submitting}
                className="w-full"
                padding="12px 20px"
                rounded={12}
              >
                {submitting ? "Cadastrando..." : "Cadastrar senha e acessar"}
              </TactileButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

