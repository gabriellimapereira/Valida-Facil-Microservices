import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

// Login por e-mail/senha. Com o Supabase configurado, usa Supabase Auth de
// verdade; caso contrário, simula uma autenticação bem-sucedida para permitir
// o teste visual completo do front-end sem back-end.
export async function login(email, password) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }
  if (!email || !password) {
    throw new Error("Informe usuário/e-mail e senha para continuar.");
  }
  await new Promise((r) => setTimeout(r, 450));
  return { id: "demo-user", email };
}

export async function logout() {
  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
  return true;
}

export async function requestPasswordReset(email) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return true;
  }
  await new Promise((r) => setTimeout(r, 300));
  return true;
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
