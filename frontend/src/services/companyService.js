import { apiClient, getAccessToken } from "../lib/apiClient";
import { MOCK_COMPANY, MOCK_MEMBERS } from "../data/mockData";

let memoryCompany = { ...MOCK_COMPANY };

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
  if (!getAccessToken()) {
    return Promise.resolve({ ...memoryCompany });
  }
  if (!companyId) return null;
  return fromDb(await apiClient.get("/companies/me"));
}

export async function createCompany(fields) {
  const payload = toDb(fields);
  const data = await apiClient.post("/companies", payload);
  return fromDb(data);
}

export async function updateCompany(_companyId, changes) {
  if (!getAccessToken()) {
    memoryCompany = { ...memoryCompany, ...changes };
    return Promise.resolve({ ...memoryCompany });
  }
  return fromDb(await apiClient.patch("/companies/me", toDb(changes)));
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

  if (!getAccessToken()) {
    const localUrl = URL.createObjectURL(file);
    memoryCompany = { ...memoryCompany, logoUrl: localUrl };
    return { ...memoryCompany };
  }

  const formData = new FormData();
  formData.append("file", file);
  return fromDb(await apiClient.postFormData("/companies/logo", formData));
}

export async function removeCompanyLogo() {
  if (!getAccessToken()) {
    memoryCompany = { ...memoryCompany, logoUrl: null };
    return { ...memoryCompany };
  }
  return fromDb(await apiClient.delete("/companies/logo"));
}

let memoryMembers = [...MOCK_MEMBERS];

export async function fetchCompanyMembers(companyId) {
  if (!getAccessToken()) {
    return Promise.resolve([...memoryMembers]);
  }
  if (!companyId) return [];

  const members = await apiClient.get("/companies/members");
  return (members || []).map((row) => ({
    id: row.id,
    fullName: row.full_name || row.fullName || row.email,
    email: row.email,
    role: row.role,
    storeId: row.store_id ?? row.storeId ?? null,
    storeName: row.store_name ?? row.storeName ?? null,
    createdAt: row.created_at || row.createdAt,
  }));
}

export async function inviteTeamMember({ email, fullName, role = "operador", storeId = null }) {
  if (!getAccessToken()) {
    const newMember = {
      id: `user-demo-${Date.now()}`,
      fullName,
      email,
      role,
      storeId: storeId || null,
      createdAt: new Date().toISOString(),
    };
    memoryMembers.push(newMember);
    return Promise.resolve(newMember);
  }
  const payload = { email, full_name: fullName, role };
  if (storeId) payload.store_id = storeId;
  return apiClient.post("/companies/invite", payload);
}

export async function updateMember(memberId, { role, storeId } = {}) {
  if (!getAccessToken()) {
    memoryMembers = memoryMembers.map((m) =>
      m.id === memberId
        ? {
            ...m,
            ...(role !== undefined ? { role } : {}),
            ...(storeId !== undefined ? { storeId } : {}),
          }
        : m
    );
    return Promise.resolve(memoryMembers.find((m) => m.id === memberId));
  }
  const payload = {};
  if (role !== undefined) payload.role = role;
  if (storeId !== undefined) payload.store_id = storeId || null;
  const updated = await apiClient.patch(`/companies/members/${memberId}`, payload);
  return {
    ...updated,
    fullName: updated.full_name || updated.email,
    storeId: updated.store_id ?? null,
    storeName: updated.store_name ?? null,
    createdAt: updated.created_at,
  };
}

export async function updateMemberRole(memberId, role) {
  return updateMember(memberId, { role });
}

export async function removeMember(memberId) {
  if (!getAccessToken()) {
    memoryMembers = memoryMembers.filter((m) => m.id !== memberId);
    return Promise.resolve();
  }
  return apiClient.delete(`/companies/members/${memberId}`);
}
