import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

// Supabase devolve mensagens de erro em inglês por padrão — traduzimos as
// mais comuns pra não deixar o usuário sem entender o que aconteceu.
function translateAuthError(error) {
  const raw = (error?.message || "").toLowerCase();
  if (raw.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (raw.includes("email not confirmed")) {
    return "Este e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
  }
  if (raw.includes("user not found")) {
    return "Não encontramos uma conta com esse e-mail.";
  }
  if (raw.includes("rate limit")) {
    return "Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.";
  }
  return error?.message || "Não foi possível entrar. Verifique suas credenciais.";
}

// Login por e-mail/senha. Com o Supabase configurado, usa Supabase Auth de
// verdade; caso contrário, simula uma autenticação bem-sucedida para permitir
// o teste visual completo do front-end sem back-end.
export async function login(email, password) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(translateAuthError(error));
    return data.user;
  }
  if (!email || !password) {
    throw new Error("Informe usuário/e-mail e senha para continuar.");
  }
  await new Promise((r) => setTimeout(r, 450));
  return { id: "demo-user", email };
}

// scope "local" (padrão) desloga só esta aba/sessão. scope "global" revoga
// a sessão em TODOS os dispositivos/abas logados com essa conta — é o que
// usamos depois de trocar a senha, pra nenhuma aba antiga continuar
// "logada" com a senha velha.
export async function logout(scope = "local") {
  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.signOut({ scope });
    if (error) throw error;
  }
  return true;
}

export async function requestPasswordReset(email) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    if (error) throw error;
    return true;
  }
  await new Promise((r) => setTimeout(r, 300));
  return true;
}

// Chamada pela tela que o link do e-mail abre (/redefinir-senha). Nesse
// ponto o usuário já tem uma sessão de recuperação válida (o supabase-js
// processa o token da URL sozinho ao carregar a página), então só falta
// definir a senha nova de fato.
export async function updatePassword(newPassword) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return true;
  }
  await new Promise((r) => setTimeout(r, 300));
  return true;
}

// Confirma que a senha atual digitada está correta ANTES de disparar o
// e-mail de troca de senha — tenta logar de novo com as mesmas
// credenciais; se rejeitar, a senha atual está errada.
export async function verifyCurrentPassword(email, password) {
  if (!isSupabaseConfigured) return true; // modo demonstração, sem como verificar de verdade
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}

// Restaura a sessão salva pelo supabase-js (localStorage) ao recarregar a
// página. Em modo demonstração não há sessão real para restaurar — o app
// sempre começa deslogado nesse caso.
export async function getSessionUser() {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session?.user ?? null;
}

// Mantém o app em sincronia com o Supabase Auth (login em outra aba, token
// renovado, logout por expiração etc). Retorna um "unsubscribe" — chame
// dentro do cleanup de um useEffect.
export function onAuthStateChange(callback) {
  if (!isSupabaseConfigured) {
    return { unsubscribe() {} };
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return data.subscription;
}
