// Geração de relatórios diretamente no Frontend via jsPDF + autoTable.
// Isso elimina 100% a dependência de bibliotecas de sistema C (como WeasyPrint/Pango/Cairo no backend),
// permitindo execução instantânea e compatibilidade universal na Vercel/Netlify/Serverless.

import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { generatePdfDocument } from "./pdfReportGenerator";
import { MOCK_PRODUCTS, MOCK_COMPANY } from "../data/mockData";
import { apiClient } from "../lib/apiClient";

export async function generateReport({
  reportType,
  format = "pdf",
  dateFrom,
  dateTo,
  expiryWindowDays = 15,
}) {
  // Se for solicitado formato alternativo no backend (ex: Excel)
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

  // Geração 100% nativa no Frontend em PDF
  let company = { name: "Valida Fácil", cnpj: "", phone: "", email: "", address: "" };
  let responsibleName = "Responsável pelo Estoque";
  let products = [];
  let movements = [];

  if (isSupabaseConfigured && supabase) {
    try {
      // 1. Obter usuário e dados da empresa
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, company_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.full_name) {
          responsibleName = profile.full_name;
        } else if (user.email) {
          responsibleName = user.email;
        }

        if (profile?.company_id) {
          const { data: comp } = await supabase
            .from("companies")
            .select("id, name, cnpj, phone, email, notification_email, address, initials")
            .eq("id", profile.company_id)
            .maybeSingle();
          if (comp) company = comp;
        }
      }

      // 2. Coletar dados necessários por tipo de relatório
      if (reportType === "estoque_atual" || reportType === "produtos_a_vencer") {
        const { data: prods, error: pErr } = await supabase
          .from("products")
          .select("id, name, code, category, quantity, min_stock, price, expiry")
          .order("name");
        if (!pErr && prods) products = prods;
      }

      if (reportType === "movimentacoes" || reportType === "giro_estoque") {
        let query = supabase
          .from("stock_movements")
          .select("id, movement_type, quantity_delta, note, created_at, product_id, products(name, code)")
          .order("created_at", { ascending: false });

        if (dateFrom) {
          query = query.gte("created_at", `${dateFrom}T00:00:00`);
        }
        if (dateTo) {
          query = query.lte("created_at", `${dateTo}T23:59:59`);
        }

        const { data: moves, error: mErr } = await query;
        if (!mErr && moves) movements = moves;
      }
    } catch (err) {
      console.warn("Aviso ao buscar dados no Supabase para relatório:", err);
    }
  } else {
    // Modo demonstração / fallback offline
    company = MOCK_COMPANY;
    products = MOCK_PRODUCTS || [];
    movements = [];
  }

  // 3. Gerar documento PDF no frontend com layout idêntico ao institucional
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

  // Se já for uma URL do tipo blob local, aciona download direto
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
      } catch {}
    }, 15000);
    return;
  }

  // Caso seja URL remota
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
