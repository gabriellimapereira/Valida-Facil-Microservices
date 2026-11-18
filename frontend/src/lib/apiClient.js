// Cliente HTTP do Gateway. Tokens de sessão são JWTs emitidos pelo MS Identity.

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? "/api" : "http://localhost:8000");

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("valida_facil_token");
}

async function request(path, { method = "GET", body, params, authenticated = true } = {}) {
  const token = authenticated ? getAccessToken() : null;
  if (authenticated && !token) {
    throw new Error("Sessão expirada. Faça login novamente para continuar.");
  }

  const base = API_BASE_URL.startsWith("http://") || API_BASE_URL.startsWith("https://")
    ? API_BASE_URL.replace(/\/$/, "")
    : (typeof window !== "undefined" && window.location?.origin ? window.location.origin : "http://localhost:8000") + (API_BASE_URL.startsWith("/") ? API_BASE_URL : `/${API_BASE_URL}`).replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(base + cleanPath);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, value);
      }
    });
  }

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
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
    let message = `Erro ${response.status} no servidor.`;
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail) && detail.length > 0) {
      message = detail.map((err) => err.msg || JSON.stringify(err)).join("; ");
    } else if (payload?.message) {
      message = payload.message;
    }
    throw new Error(message);
  }

  return payload;
}

export const apiClient = {
  get: (path, params) => request(path, { method: "GET", params }),
  getPublic: (path, params) => request(path, { method: "GET", params, authenticated: false }),
  post: (path, body, params) => request(path, { method: "POST", body, params }),
  postPublic: (path, body, params) => request(path, { method: "POST", body, params, authenticated: false }),
  postFormData: (path, formData, params) => request(path, { method: "POST", body: formData, params }),
  patch: (path, body, params) => request(path, { method: "PATCH", body, params }),
  delete: (path, params) => request(path, { method: "DELETE", params }),
};
