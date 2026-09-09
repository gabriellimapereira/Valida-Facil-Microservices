import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import BrandLogo from "../components/ui/BrandLogo";
import { useToast } from "../context/ToastContext";
import * as authService from "../services/authService";
import PasswordRequirementHint, { MIN_PASSWORD_LENGTH } from "../components/ui/PasswordRequirementHint";
import TactileButton from "../components/ui/TactileButton";

// Tela que o link do e-mail de "trocar senha" abre. O supabase-js processa
// sozinho o token que vem na URL (hash) assim que a página carrega e
// estabelece uma sessão de recuperação temporária — por isso não
// recebemos nada explícito por props/params aqui, só checamos se essa
// sessão existe.
export default function ResetPasswordPage() {
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

    // Checa a sessão imediatamente caso o token já tenha sido processado
    authService.getSessionUser().then((user) => {
      if (mounted && user) {
        setLinkValid(true);
        setCheckingLink(false);
      }
    }).catch(() => {});

    // Escuta eventos de autenticação caso o token da URL ainda esteja sendo validado
    const subscription = authService.onAuthStateChange
      ? authService.onAuthStateChange((user) => {
          if (mounted && user) {
            setLinkValid(true);
            setCheckingLink(false);
          }
        })
      : null;

    // Fallback de timeout para o caso de link inválido/ausente
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
      setError("Preencha a nova senha nos dois campos.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
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
      // Desloga de propósito: força um login explícito com a senha nova,
      // em vez de deixar a sessão de recuperação "virar" uma sessão normal
      // silenciosamente.
      // "global": revoga a sessão em qualquer outra aba/dispositivo que
      // ainda esteja logado com a senha antiga — não só esta aba aqui.
      await authService.logout("global");
      addToast("Senha alterada com sucesso! Faça login com a nova senha.");
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err) {
      setError(err.message || "Não foi possível alterar a senha. O link pode ter expirado.");
    } finally {
      setSubmitting(false);
    }
  };

  const Logo = (
    <div className="flex items-center gap-3 mb-8 justify-center">
      <BrandLogo size={42} className="shadow-md shadow-black/20 rounded-full shrink-0" />
      <span className="text-slate-900 font-bold text-xl tracking-tight">Valida Fácil</span>
    </div>
  );

  if (checkingLink) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-sm text-center">
          {Logo}
          <p className="text-sm text-slate-500">Verificando link...</p>
        </div>
      </div>
    );
  }

  if (!linkValid) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-sm text-center">
          {Logo}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Link inválido ou expirado</h2>
            <p className="text-sm text-slate-500 mb-6">
              Esse link de troca de senha não é mais válido. Solicite um novo na tela de login.
            </p>
            <TactileButton
              variant="amber"
              onClick={() => navigate("/login", { replace: true })}
              className="w-full"
              padding="12px 20px"
              rounded={12}
            >
              Voltar para o login
            </TactileButton>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-6">
        <div className="w-full max-w-sm text-center">
          {Logo}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={22} className="text-teal-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Senha alterada!</h2>
            <p className="text-sm text-slate-500">Redirecionando para o login...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-sm">
        {Logo}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Defina sua nova senha</h2>
          <p className="text-sm text-slate-500 mb-6">Escolha uma senha com pelo menos 8 caracteres.</p>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nova senha</label>
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar nova senha</label>
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
              {submitting ? "Salvando..." : "Salvar nova senha"}
            </TactileButton>
          </form>
        </div>
      </div>
    </div>
  );
}
