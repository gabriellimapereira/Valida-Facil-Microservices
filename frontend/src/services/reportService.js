import { MOCK_PRODUCTS, MOCK_COMPANY } from "../data/mockData";
import { apiClient, getAccessToken } from "../lib/apiClient";

export async function generateReport({
  reportType,
  format = "pdf",
  dateFrom,
  dateTo,
  expiryWindowDays = 15,
}) {
  if (format === "xlsx") {
    const result = await apiClient.post("/reports/generate", {
      report_type: reportType,
      format,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      expiry_window_days: expiryWindowDays,
    });
    return { url: result.url, filename: result.filename, expiresInSeconds: result.expires_in_seconds };
  }

  let company = { name: "Valida Fácil", cnpj: "", phone: "", email: "", address: "" };
  let responsibleName = "Responsável pelo Estoque";
  let products = [];
  let movements = [];

  if (getAccessToken()) {
    const [companyData, userData, productData, movementData] = await Promise.all([
      apiClient.get("/companies/me"),
      apiClient.get("/auth/me"),
      reportType === "estoque_atual" || reportType === "produtos_a_vencer"
        ? apiClient.get("/products")
        : Promise.resolve([]),
      reportType === "movimentacoes" || reportType === "giro_estoque"
        ? apiClient.get("/movements", { date_from: dateFrom, date_to: dateTo })
        : Promise.resolve([]),
    ]);
    company = companyData;
    responsibleName = userData.full_name || userData.email || responsibleName;
    products = productData || [];
    movements = movementData || [];
  } else {
    company = MOCK_COMPANY;
    products = MOCK_PRODUCTS || [];
    movements = [];
  }

  const { generatePdfDocument } = await import("./pdfReportGenerator");
  const doc = generatePdfDocument({
    reportType,
    company,
    responsibleName,
    products,
    movements,
    dateFrom,
    dateTo,
    expiryWindowDays,
  });

  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `${reportType}-${timestamp}.pdf`;

  return {
    url: blobUrl,
    filename,
    expiresInSeconds: 3600,
  };
}

/**
 * Executa o download direto do arquivo no navegador sem redirecionamento de tela
 */
export async function downloadFile(url, filename) {
  if (!url) return;

  if (url.startsWith("blob:")) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "relatorio.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch (err) {
        console.debug("Aviso ao revogar URL temporária do relatório:", err);
      }
    }, 15000);
    return;
  }

  try {
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
