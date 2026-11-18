import { apiClient, getAccessToken } from "../lib/apiClient";

const SESSION_EVENT = "valida-facil-session-change";

function notifySessionChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_EVENT));
  }
}

export async function login(email, password) {
  const payload = await apiClient.postPublic("/auth/login", { email, password });
  if (!payload?.access_token || !payload.user) {
    throw new Error("O servidor retornou uma sessão inválida.");
  }
  localStorage.setItem("valida_facil_token", payload.access_token);
  localStorage.setItem("valida_facil_user", JSON.stringify(payload.user));
  notifySessionChange();
  return payload.user;
}

export async function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("valida_facil_token");
    localStorage.removeItem("valida_facil_user");
    notifySessionChange();
  }
  return true;
}

export async function requestPasswordReset(email) {
  await apiClient.postPublic("/auth/password-reset", { email });
  return true;
}

export async function validateActionToken(token, purpose) {
  const path = purpose === "invitation"
    ? "/auth/invitation/validate"
    : "/auth/password-reset/validate";
  const result = await apiClient.getPublic(path, { token });
  return Boolean(result?.valid);
}

export async function updatePassword(token, newPassword, purpose = "password_reset") {
  const path = purpose === "invitation"
    ? "/auth/invitation/accept"
    : "/auth/password-reset/confirm";
  await apiClient.postPublic(path, { token, password: newPassword });
  return true;
}

export async function changePassword(currentPassword, newPassword) {
  await apiClient.post("/auth/password/change", {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return true;
}

export async function verifyCurrentPassword(email, password) {
  const user = await apiClient.postPublic("/auth/login", { email, password });
  return Boolean(user?.access_token);
}

export async function getSessionUser() {
  if (typeof window === "undefined") return null;
  const token = getAccessToken();
  const rawUser = localStorage.getItem("valida_facil_user");
  if (!token || !rawUser) return null;
  try {
    return JSON.parse(rawUser);
  } catch {
    await logout();
    return null;
  }
}

export function onAuthStateChange(callback) {
  if (typeof window === "undefined") return { unsubscribe() {} };
  const listener = () => {
    getSessionUser().then(callback).catch(() => callback(null));
  };
  window.addEventListener(SESSION_EVENT, listener);
  window.addEventListener("storage", listener);
  return {
    unsubscribe() {
      window.removeEventListener(SESSION_EVENT, listener);
      window.removeEventListener("storage", listener);
    },
  };
}
