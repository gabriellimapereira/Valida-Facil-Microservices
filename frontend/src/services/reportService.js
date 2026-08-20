// Geração de relatório também passa pelo backend: agrega dados com pandas,
// monta o PDF/Excel e devolve um link assinado (temporário) do Storage.

import { apiClient } from "../lib/apiClient";

export async function generateReport({ reportType, format = "pdf", dateFrom, dateTo, expiryWindowDays }) {
  const result = await apiClient.post("/reports/generate", {
    report_type: reportType,
    format,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    expiry_window_days: expiryWindowDays,
  });

  return { url: result.url, filename: result.filename, expiresInSeconds: result.expires_in_seconds };
}
