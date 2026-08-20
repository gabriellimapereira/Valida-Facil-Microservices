import { apiClient } from "../lib/apiClient";

export async function triggerExpiryCheck(windowDays = 15) {
  return apiClient.post("/alerts/check-expiry", undefined, { window_days: windowDays });
}
