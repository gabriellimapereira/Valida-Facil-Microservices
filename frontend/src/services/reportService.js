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

/**
 * Executa o download direto do arquivo no navegador sem redirecionamento de tela
 */
export async function downloadFile(url, filename) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Erro na resposta do servidor");
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
  } catch (err) {
    // Fallback caso ocorra restrição de fetch direto
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.target = "_self";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
