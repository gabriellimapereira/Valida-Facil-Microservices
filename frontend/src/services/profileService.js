import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";

// Perfil "de demonstração" — usado só quando o Supabase não está
// configurado, pra manter o app navegável sem banco nenhum.
const DEMO_PROFILE = {
  company_id: "company-demo-1",
  role: "admin",
  full_name: "Usuário Demonstração",
};

// A trigger `handle_new_user` (ver supabase/schema.sql) cria essa linha
// automaticamente quando alguém se cadastra no Supabase Auth — aqui só
// lemos o resultado. Se company_id vier null, é porque o onboarding de
// empresa ainda não foi feito para esse usuário.
export async function fetchProfile(userId) {
  if (!isSupabaseConfigured) {
    return { id: userId, ...DEMO_PROFILE };
  }
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, company_id, role, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}
