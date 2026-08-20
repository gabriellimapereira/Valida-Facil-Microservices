import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { apiClient } from "../lib/apiClient";
import { MOCK_COMPANY } from "../data/mockData";

let memoryCompany = { ...MOCK_COMPANY };

// O banco usa snake_case (notification_email), o front usa camelCase
// (notificationEmail) — isso mantém a "tradução" isolada aqui, então
// nenhum componente precisa saber como a coluna se chama no Postgres.
function fromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    segment: row.segment,
    email: row.email,
    notificationEmail: row.notification_email,
    phone: row.phone,
    cnpj: row.cnpj,
    address: row.address,
    initials: row.initials,
  };
}

const FIELD_TO_COLUMN = {
  name: "name",
  segment: "segment",
  email: "email",
  notificationEmail: "notification_email",
  phone: "phone",
  cnpj: "cnpj",
  address: "address",
  initials: "initials",
};

function toDb(fields) {
  const payload = {};
  for (const [key, value] of Object.entries(fields)) {
    const column = FIELD_TO_COLUMN[key];
    if (column && value !== undefined) payload[column] = value;
  }
  return payload;
}

export async function fetchCompany(companyId) {
  if (!isSupabaseConfigured) {
    return Promise.resolve({ ...memoryCompany });
  }
  if (!companyId) return null;

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();

  if (error) throw error;
  return fromDb(data);
}

// Criar empresa precisa da chave service_role (o usuário ainda não tem
// company_id, então o RLS bloquearia legitimamente a escrita) — por isso
// essa chamada específica passa pelo backend, não vai direto ao Supabase.
export async function createCompany(fields) {
  const payload = toDb(fields);
  const data = await apiClient.post("/companies", payload);
  return fromDb(data);
}

export async function updateCompany(companyId, changes) {
  if (!isSupabaseConfigured) {
    memoryCompany = { ...memoryCompany, ...changes };
    return Promise.resolve({ ...memoryCompany });
  }

  const { data, error } = await supabase
    .from("companies")
    .update(toDb(changes))
    .eq("id", companyId)
    .select()
    .single();

  if (error) throw error;
  return fromDb(data);
}
