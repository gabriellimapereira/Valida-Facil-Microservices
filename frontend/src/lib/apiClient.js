// Cliente HTTP para o backend (FastAPI). Diferente do supabaseClient (que
// fala direto com o Postgres via RLS), aqui sempre mandamos o JWT da
// sessão atual no header Authorization — o backend usa esse mesmo token
// pra criar um client Supabase "amarrado" ao usuário, então o RLS
// continua valendo mesmo passando pelo backend (ver core/security.py lá).

import { supabase, isSupabaseConfigured } from "./supabaseClient";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function getAccessToken() {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data?.session?.access_token ?? null;
}

async function request(path, { method = "GET", body, params } = {}) {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Essa ação depende do backend + Supabase configurados. Preencha o .env e tente novamente."
    );
  }

  const token = await getAccessToken();
  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente para continuar.");
  }

  const base = API_BASE_URL.startsWith("http://") || API_BASE_URL.startsWith("https://")
    ? API_BASE_URL.replace(/\/$/, "")
    : (typeof window !== "undefined" && window.location?.origin ? window.location.origin : "http://localhost:8000") + (API_BASE_URL.startsWith("/") ? API_BASE_URL : `/${API_BASE_URL}`).replace(/\/$/, "");
  const url = new URL(base + path);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
  }

  let response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new Error(
      `Não foi possível conectar ao servidor (${API_BASE_URL}). Ele está rodando?`
    );
  }

  if (response.status === 204) {
    return null;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const detail = payload?.detail;
    const message = typeof detail === "string" ? detail : `Erro ${response.status} no servidor.`;
    throw new Error(message);
  }

  return payload;
}

export const apiClient = {
  get: (path, params) => request(path, { method: "GET", params }),
  post: (path, body, params) => request(path, { method: "POST", body, params }),
  patch: (path, body, params) => request(path, { method: "PATCH", body, params }),
  delete: (path, params) => request(path, { method: "DELETE", params }),
};
