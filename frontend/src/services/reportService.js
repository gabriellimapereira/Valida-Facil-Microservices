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
    // Usar blob local garante compatibilidade com Firefox e Chrome,
    // permitindo o download com o nome exato sem ser bloqueado pelo bloqueador de popups.
    const response = await fetch(url);
    if (!response.ok) throw new Error("Erro ao obter arquivo gerado");
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename || "relatorio.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
  } catch (err) {
    console.warn("Download via blob falhou, tentando navegação direta:", err);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "relatorio.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}
