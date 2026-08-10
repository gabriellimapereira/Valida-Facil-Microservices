import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { MOCK_COMPANY } from "../data/mockData";

let memoryCompany = { ...MOCK_COMPANY };

export async function fetchCompany(companyId) {
  if (isSupabaseConfigured) {
    // TODO Supabase:
    // const { data, error } = await supabase.from("companies").select("*").eq("id", companyId).single();
    // if (error) throw error;
    // return data;
  }
  return Promise.resolve({ ...memoryCompany });
}

export async function updateCompany(companyId, changes) {
  if (isSupabaseConfigured) {
    // TODO Supabase:
    // const { data, error } = await supabase.from("companies").update(changes).eq("id", companyId).select().single();
    // if (error) throw error;
    // return data;
  }
  memoryCompany = { ...memoryCompany, ...changes };
  return Promise.resolve({ ...memoryCompany });
}
