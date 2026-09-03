import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { apiClient } from "../lib/apiClient";
import { MOCK_COMPANY, MOCK_MEMBERS } from "../data/mockData";

let memoryCompany = { ...MOCK_COMPANY };

// O banco usa snake_case (notification_email, logo_url), o front usa camelCase
// (notificationEmail, logoUrl) — isso mantém a "tradução" isolada aqui, então
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
    logoUrl: row.logo_url || null,
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
  logoUrl: "logo_url",
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

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export async function uploadCompanyLogo(companyId, file) {
  if (!file) throw new Error("Nenhum arquivo selecionado.");

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Formato inválido. Por favor, envie uma imagem PNG, JPG, WebP ou SVG.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("A imagem deve ter no máximo 3MB.");
  }

  if (!isSupabaseConfigured) {
    const localUrl = URL.createObjectURL(file);
    memoryCompany = { ...memoryCompany, logoUrl: localUrl };
    return { ...memoryCompany };
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${companyId}/logo_${Date.now()}.${ext}`;

  // 1. Upload da imagem para o bucket "logos"
  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(path, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: "3600",
    });

  if (uploadError) throw new Error(`Falha ao fazer upload da imagem: ${uploadError.message}`);

  // 2. Obter a URL pública permanente
  const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
  const publicUrl = urlData?.publicUrl;

  if (!publicUrl) throw new Error("Não foi possível gerar a URL pública da imagem.");

  // 3. Atualizar o registro da empresa no banco
  return updateCompany(companyId, { logoUrl: publicUrl });
}

export async function removeCompanyLogo(companyId) {
  return updateCompany(companyId, { logoUrl: null });
}

let memoryMembers = [...MOCK_MEMBERS];

export async function fetchCompanyMembers(companyId) {
  if (!isSupabaseConfigured) {
    return Promise.resolve([...memoryMembers]);
  }
  return apiClient.get("/companies/members");
}

export async function inviteTeamMember({ email, fullName, role = "operador" }) {
  if (!isSupabaseConfigured) {
    const newMember = {
      id: `user-demo-${Date.now()}`,
      fullName,
      email,
      role,
      createdAt: new Date().toISOString(),
    };
    memoryMembers.push(newMember);
    return Promise.resolve(newMember);
  }
  return apiClient.post("/companies/invite", { email, full_name: fullName, role });
}

export async function updateMemberRole(memberId, role) {
  if (!isSupabaseConfigured) {
    memoryMembers = memoryMembers.map((m) => (m.id === memberId ? { ...m, role } : m));
    return Promise.resolve(memoryMembers.find((m) => m.id === memberId));
  }
  return apiClient.patch(`/companies/members/${memberId}`, { role });
}

export async function removeMember(memberId) {
  if (!isSupabaseConfigured) {
    memoryMembers = memoryMembers.filter((m) => m.id !== memberId);
    return Promise.resolve();
  }
  return apiClient.delete(`/companies/members/${memberId}`);
}

