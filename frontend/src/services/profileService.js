import { apiClient, getAccessToken } from "../lib/apiClient";

const DEMO_PROFILE = {
  company_id: "company-demo-1",
  role: "admin",
  full_name: "Usuário Demonstração",
};

export async function fetchProfile(userId) {
  if (!getAccessToken()) {
    return { id: userId, ...DEMO_PROFILE };
  }
  if (!userId) return null;
  const data = await apiClient.get("/auth/me");
  return {
    id: data.id,
    company_id: data.company_id,
    role: data.role,
    full_name: data.full_name,
    store_id: data.store_id,
  };
}
