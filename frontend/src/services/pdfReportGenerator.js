import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const CATEGORY_LABELS = {
  alimentos: "Perecíveis & Alimentos",
  eletronicos: "Eletrônicos",
  moda: "Moda & Vestuário",
  livros: "Livros & Papelaria",
  outros: "Outros",
};

export function formatBRL(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatQty(value) {
  const num = Number(value) || 0;
  return `${num.toLocaleString("pt-BR")} un.`;
}

export function formatDate(isoStr) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr.length <= 10 ? `${isoStr}T12:00:00` : isoStr);
    if (isNaN(d.getTime())) return "—";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "—";
  }
}

export function formatDateTime(isoStr) {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "—";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return "—";
  }
}

/**
 * Desenha o cabeçalho institucional oficial do Valida Fácil (idêntico ao base.html)
 */
function drawHeader(doc, company, reportMeta) {
  const leftX = 34;
  const centerX = 297.6;
  const rightX = 561;
  let topY = 32;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  const companyName = (company?.name || "SUA EMPRESA").toUpperCase();
  doc.text(companyName, leftX, topY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  let curY = topY + 11;
  const cnpjText = `CNPJ: ${company?.cnpj || "Não informado"}`;
  doc.text(cnpjText, leftX, curY);

  curY += 9;
  const contactText = `Tel: ${company?.phone || "—"} • E-mail: ${company?.email || company?.notification_email || "—"}`;
  doc.text(contactText, leftX, curY);

  if (company?.address) {
    curY += 9;
    const addr = doc.splitTextToSize(`End.: ${company.address}`, 180);
    doc.text(addr[0], leftX, curY);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(reportMeta.title.toUpperCase(), centerX, topY, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(reportMeta.subtitle, centerX, topY + 12, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(reportMeta.filterInfo, centerX, topY + 22, { align: "center" });

  const badgeText = "VALIDA FÁCIL";
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(rightX - 65, topY - 8, 65, 12, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(146, 64, 14);
  doc.text(badgeText, rightX - 32.5, topY, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const emitDate = formatDateTime(new Date().toISOString());
  doc.text(`Emissão: ${emitDate}`, rightX, topY + 12, { align: "right" });
  doc.text(`Resp.: ${reportMeta.responsibleName || "Responsável pelo Estoque"}`, rightX, topY + 22, { align: "right" });

  const barY = 66;
  doc.setFillColor(15, 23, 42);
  doc.rect(leftX, barY, 527, 2.5, "F");
  doc.setFillColor(217, 119, 6);
  doc.rect(leftX, barY, 55, 2.5, "F");

  return barY + 9;
}

/**
 * Desenha os 2 cartões de resumo (KPIs) lado a lado
 */
function drawSummaryCards(doc, startY, leftCardData, rightCardData) {
  const cardWidth = 258;
  const cardHeight = 68;
  const leftX = 34;
  const rightX = 303;

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(leftX, startY, cardWidth, cardHeight, 4, 4, "FD");

  doc.setFillColor(241, 245, 249);
  doc.rect(leftX, startY, cardWidth, 14, "F");
  doc.line(leftX, startY + 14, leftX + cardWidth, startY + 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(leftCardData.title.toUpperCase(), leftX + 8, startY + 10);

  let rowY = startY + 24;
  leftCardData.rows.forEach((row) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(row.label, leftX + 8, rowY);

    doc.setFont("helvetica", "bold");
    if (row.color) {
      doc.setTextColor(row.color[0], row.color[1], row.color[2]);
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(String(row.value), leftX + cardWidth - 8, rowY, { align: "right" });
    rowY += 9.5;
  });

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(rightX, startY, cardWidth, cardHeight, 4, 4, "FD");

  doc.setFillColor(241, 245, 249);
  doc.rect(rightX, startY, cardWidth, 14, "F");
  doc.line(rightX, startY + 14, rightX + cardWidth, startY + 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(rightCardData.title.toUpperCase(), rightX + 8, startY + 10);

  const centerX = rightX + cardWidth / 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(rightCardData.label.toUpperCase(), centerX, startY + 26, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  if (rightCardData.valueColor) {
    doc.setTextColor(rightCardData.valueColor[0], rightCardData.valueColor[1], rightCardData.valueColor[2]);
  } else {
    doc.setTextColor(15, 23, 42);
  }
  doc.text(rightCardData.value, centerX, startY + 44, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(rightCardData.hint, centerX, startY + 56, { align: "center" });

  return startY + cardHeight + 8;
}

/**
 * Aplica o rodapé oficial em todas as páginas do PDF
 */
function applyFooters(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageHeight = 841.89;

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(34, pageHeight - 25, 561, pageHeight - 25);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Valida Fácil • Gestão Inteligente de Estoque", 34, pageHeight - 14);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(`Página ${i} de ${pageCount}`, 561, pageHeight - 14, { align: "right" });
  }
}

function buildStockSnapshotPdf(doc, company, responsibleName, products) {
  const todayFmt = formatDate(new Date().toISOString());
  const reportMeta = {
    title: "Relatório de Estoque Atual",
    subtitle: `Data de Referência: ${todayFmt}`,
    filterInfo: "Tipo de Estoque: Todos os itens cadastrados",
    responsibleName,
  };

  const startY = drawHeader(doc, company, reportMeta);

  const totalProducts = products.length;
  let itemsInStock = 0;
  let itemsOutOfStock = 0;
  let lowStockCount = 0;
  let totalQty = 0;
  let totalValue = 0;

  const tableBody = products.map((p) => {
    const qty = Number(p.quantity) || 0;
    const minStock = Number(p.min_stock) || 0;
    const price = Number(p.price) || 0;
    const total = qty * price;
    const isLow = qty <= minStock;

    if (qty > 0) itemsInStock++;
    else itemsOutOfStock++;
    if (isLow) lowStockCount++;

    totalQty += qty;
    totalValue += total;

    return [
      p.code || "—",
      p.name || "—",
      CATEGORY_LABELS[p.category] || p.category || "—",
      formatDate(p.expiry),
      formatQty(qty),
      formatBRL(price),
      formatBRL(total),
    ];
  });

  const leftCard = {
    title: "Resumo Geral",
    rows: [
      { label: "Total de Itens Cadastrados:", value: totalProducts },
      { label: "Total de Itens com Estoque:", value: itemsInStock },
      { label: "Total de Itens sem Estoque:", value: itemsOutOfStock },
      { label: "Itens com Estoque Baixo:", value: lowStockCount, color: lowStockCount > 0 ? [180, 83, 9] : null },
      { label: "Total de Unidades Físicas:", value: formatQty(totalQty) },
    ],
  };

  const rightCard = {
    title: "Valor Total do Estoque",
    label: "Patrimônio em Mercadoria",
    value: formatBRL(totalValue),
    hint: "Baseado no preço unitário de cadastro",
  };

  const tableStartY = drawSummaryCards(doc, startY, leftCard, rightCard);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: 34, right: 34, top: 34, bottom: 38 },
    theme: "grid",
    head: [["Código", "Descrição do Produto", "Categoria", "Validade", "Qtd.", "Valor Unit.", "Valor Total"]],
    body: tableBody.length > 0 ? tableBody : [["—", "Nenhum produto cadastrado no estoque até o momento.", "—", "—", "—", "—", "—"]],
    foot: tableBody.length > 0 ? [["Total Geral:", "", "", "", formatQty(totalQty), "—", formatBRL(totalValue)]] : undefined,
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.2,
      halign: "left",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 7.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.8,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 50, font: "courier", fontStyle: "bold" },
      1: { halign: "left", fontStyle: "bold" },
      2: { halign: "left", cellWidth: 90 },
      3: { halign: "center", cellWidth: 60 },
      4: { halign: "right", cellWidth: 50, fontStyle: "bold" },
      5: { halign: "right", cellWidth: 60 },
      6: { halign: "right", cellWidth: 68, fontStyle: "bold" },
    },
  });

  applyFooters(doc);
}

function buildExpiryPdf(doc, company, responsibleName, products, windowDays = 15) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + Number(windowDays));
  const cutoffFmt = formatDate(cutoffDate.toISOString());

  const reportMeta = {
    title: "Relatório de Produtos a Vencer",
    subtitle: `Janela de Análise: Próximos ${windowDays} dias`,
    filterInfo: `Itens perecíveis com validade até ${cutoffFmt}`,
    responsibleName,
  };

  const startY = drawHeader(doc, company, reportMeta);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const eligible = [];
  products.forEach((p) => {
    if (!p.expiry) return;
    const expDate = new Date(`${p.expiry.slice(0, 10)}T12:00:00`);
    if (isNaN(expDate.getTime())) return;

    if (expDate <= cutoffDate) {
      const diffMs = expDate.getTime() - today.getTime();
      const daysLeft = Math.max(Math.ceil(diffMs / (1000 * 60 * 60 * 24)), 0);
      const qty = Number(p.quantity) || 0;
      const price = Number(p.price) || 0;
      eligible.push({
        code: p.code || "—",
        name: p.name || "—",
        category: CATEGORY_LABELS[p.category] || p.category || "—",
        expiryFmt: formatDate(p.expiry),
        qty,
        qtyFmt: formatQty(qty),
        totalFmt: formatBRL(qty * price),
        totalNum: qty * price,
        daysLeft,
      });
    }
  });

  eligible.sort((a, b) => a.daysLeft - b.daysLeft);

  let criticalCount = 0;
  let warningCount = 0;
  let totalQty = 0;
  let totalRiskValue = 0;

  const tableBody = eligible.map((p) => {
    if (p.daysLeft <= 3) criticalCount++;
    else if (p.daysLeft <= 7) warningCount++;

    totalQty += p.qty;
    totalRiskValue += p.totalNum;

    let urgencyText = `${p.daysLeft} dia(s)`;
    if (p.daysLeft === 0) urgencyText = "Vence Hoje / Vencido";

    return [
      p.code,
      p.name,
      p.category,
      p.expiryFmt,
      p.qtyFmt,
      p.totalFmt,
      urgencyText,
    ];
  });

  const leftCard = {
    title: "Resumo de Validade",
    rows: [
      { label: "Total de Itens na Janela:", value: eligible.length },
      { label: "Crítico (≤ 3 dias / Vencidos):", value: criticalCount, color: [185, 28, 28] },
      { label: "Alerta (≤ 7 dias):", value: warningCount, color: [180, 83, 9] },
      { label: "Janela Selecionada:", value: `Próximos ${windowDays} dias` },
    ],
  };

  const rightCard = {
    title: "Valor em Risco",
    label: "Impacto Financeiro Potencial",
    value: formatBRL(totalRiskValue),
    valueColor: [185, 28, 28],
    hint: "Soma do valor de produtos na janela",
  };

  const tableStartY = drawSummaryCards(doc, startY, leftCard, rightCard);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: 34, right: 34, top: 34, bottom: 38 },
    theme: "grid",
    head: [["Código", "Produto", "Categoria", "Vencimento", "Qtd.", "Valor Total", "Urgência"]],
    body: tableBody.length > 0 ? tableBody : [["—", `Nenhum produto a vencer na janela de ${windowDays} dias.`, "—", "—", "—", "—", "—"]],
    foot: tableBody.length > 0 ? [["Total em Risco:", "", "", "", formatQty(totalQty), formatBRL(totalRiskValue), "—"]] : undefined,
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.2,
      halign: "left",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 7.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.8,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 55, font: "courier", fontStyle: "bold" },
      1: { halign: "left", fontStyle: "bold" },
      2: { halign: "left", cellWidth: 85 },
      3: { halign: "center", cellWidth: 60, fontStyle: "bold" },
      4: { halign: "right", cellWidth: 50 },
      5: { halign: "right", cellWidth: 65, fontStyle: "bold" },
      6: { halign: "center", cellWidth: 70, fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        const text = String(data.cell.raw);
        if (text.includes("Vencido") || text.includes("Hoje") || text.startsWith("1 ") || text.startsWith("2 ") || text.startsWith("3 ")) {
          data.cell.styles.textColor = [185, 28, 28];
        } else if (text.startsWith("4 ") || text.startsWith("5 ") || text.startsWith("6 ") || text.startsWith("7 ")) {
          data.cell.styles.textColor = [180, 83, 9];
        } else {
          data.cell.styles.textColor = [15, 118, 110];
        }
      }
    },
  });

  applyFooters(doc);
}

function buildMovementsPdf(doc, company, responsibleName, movements, dateFrom, dateTo) {
  let periodStr = "Histórico completo de movimentações";
  if (dateFrom || dateTo) {
    const dFrom = dateFrom ? formatDate(dateFrom) : "Início";
    const dTo = dateTo ? formatDate(dateTo) : "Hoje";
    periodStr = `Período: ${dFrom} até ${dTo}`;
  }

  const reportMeta = {
    title: "Relatório de Movimentações",
    subtitle: periodStr,
    filterInfo: "Entradas, saídas e ajustes de estoque",
    responsibleName,
  };

  const startY = drawHeader(doc, company, reportMeta);

  let totalIn = 0;
  let totalOut = 0;
  let totalAdjust = 0;
  let netUnits = 0;

  const tableBody = movements.map((m) => {
    const delta = Number(m.quantity_delta) || 0;
    netUnits += delta;

    let typeLabel = "Ajuste";
    if (m.movement_type === "entrada") {
      totalIn++;
      typeLabel = "Entrada";
    } else if (m.movement_type === "saida") {
      totalOut++;
      typeLabel = "Saída";
    } else {
      totalAdjust++;
    }

    const prod = m.products || {};
    const deltaFmt = `${delta > 0 ? "+" : ""}${formatQty(delta)}`;

    return [
      formatDateTime(m.created_at),
      prod.code || m.product_code || "—",
      prod.name || m.product_name || "—",
      typeLabel,
      deltaFmt,
      m.note || "—",
    ];
  });

  const leftCard = {
    title: "Resumo do Período",
    rows: [
      { label: "Total de Movimentações:", value: movements.length },
      { label: "Registros de Entrada:", value: totalIn, color: [15, 118, 110] },
      { label: "Registros de Saída:", value: totalOut, color: [185, 28, 28] },
      { label: "Registros de Ajuste:", value: totalAdjust, color: [180, 83, 9] },
    ],
  };

  const netColor = netUnits >= 0 ? [15, 118, 110] : [185, 28, 28];
  const rightCard = {
    title: "Saldo de Movimentação",
    label: "Variação Líquida de Unidades",
    value: `${netUnits > 0 ? "+" : ""}${formatQty(netUnits)}`,
    valueColor: netColor,
    hint: "Entradas vs Saídas & Ajustes",
  };

  const tableStartY = drawSummaryCards(doc, startY, leftCard, rightCard);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: 34, right: 34, top: 34, bottom: 38 },
    theme: "grid",
    head: [["Data / Hora", "Código", "Produto", "Tipo", "Variação", "Observação"]],
    body: tableBody.length > 0 ? tableBody : [["—", "—", "Nenhuma movimentação registrada no período selecionado.", "—", "—", "—"]],
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.2,
      halign: "left",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 80, textColor: [71, 85, 105] },
      1: { halign: "center", cellWidth: 55, font: "courier", fontStyle: "bold" },
      2: { halign: "left", fontStyle: "bold" },
      3: { halign: "center", cellWidth: 60, fontStyle: "bold" },
      4: { halign: "right", cellWidth: 65, fontStyle: "bold" },
      5: { halign: "left", cellWidth: 100, fontSize: 7, textColor: [71, 85, 105] },
    },
    didParseCell: (data) => {
      if (data.section === "body") {
        if (data.column.index === 3) {
          const val = String(data.cell.raw);
          if (val === "Entrada") data.cell.styles.textColor = [15, 118, 110];
          else if (val === "Saída") data.cell.styles.textColor = [185, 28, 28];
          else data.cell.styles.textColor = [180, 83, 9];
        }
        if (data.column.index === 4) {
          const val = String(data.cell.raw);
          if (val.startsWith("+")) data.cell.styles.textColor = [15, 118, 110];
          else if (val.startsWith("-")) data.cell.styles.textColor = [185, 28, 28];
        }
      }
    },
  });

  applyFooters(doc);
}

function buildTurnoverPdf(doc, company, responsibleName, movements, dateFrom, dateTo) {
  let periodStr = "Histórico consolidado de saídas";
  if (dateFrom || dateTo) {
    const dFrom = dateFrom ? formatDate(dateFrom) : "Início";
    const dTo = dateTo ? formatDate(dateTo) : "Hoje";
    periodStr = `Período: ${dFrom} até ${dTo}`;
  }

  const reportMeta = {
    title: "Relatório de Giro de Estoque",
    subtitle: periodStr,
    filterInfo: "Curva de rotatividade e ranking de produtos",
    responsibleName,
  };

  const startY = drawHeader(doc, company, reportMeta);

  const totals = {};
  movements.forEach((m) => {
    if (m.movement_type !== "saida") return;
    const prod = m.products || {};
    const key = m.product_id || prod.name || "desconhecido";
    if (!totals[key]) {
      totals[key] = {
        name: prod.name || m.product_name || "—",
        code: prod.code || m.product_code || "—",
        totalOut: 0,
      };
    }
    totals[key].totalOut += Math.abs(Number(m.quantity_delta) || 0);
  });

  const ranking = Object.values(totals).sort((a, b) => b.totalOut - a.totalOut);
  const totalUnits = ranking.reduce((acc, r) => acc + r.totalOut, 0);

  const tableBody = ranking.map((r, idx) => {
    const share = totalUnits > 0 ? ((r.totalOut / totalUnits) * 100).toFixed(1) : "0.0";
    return [
      `#${idx + 1}`,
      r.code,
      r.name,
      formatQty(r.totalOut),
      `${share}%`,
    ];
  });

  const leftCard = {
    title: "Resumo de Rotatividade",
    rows: [
      { label: "Produtos com Movimentação:", value: ranking.length },
      { label: "Total de Unidades Expedidas:", value: formatQty(totalUnits) },
      { label: "Média por Item Movimentado:", value: ranking.length > 0 ? `${(totalUnits / ranking.length).toFixed(1)} un.` : "0 un." },
      { label: "Item com Maior Saída:", value: ranking[0]?.name ? (ranking[0].name.length > 18 ? ranking[0].name.slice(0, 18) + "..." : ranking[0].name) : "—", color: [15, 118, 110] },
    ],
  };

  const rightCard = {
    title: "Volume de Saídas",
    label: "Total Expedido no Período",
    value: formatQty(totalUnits),
    hint: "Unidades físicas que saíram do estoque",
  };

  const tableStartY = drawSummaryCards(doc, startY, leftCard, rightCard);

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: 34, right: 34, top: 34, bottom: 38 },
    theme: "grid",
    head: [["Posição", "Código", "Descrição do Produto", "Saídas (Un.)", "Participação"]],
    body: tableBody.length > 0 ? tableBody : [["—", "—", "Nenhuma saída registrada para os produtos no período selecionado.", "—", "—"]],
    foot: tableBody.length > 0 ? [["Total Geral de Saídas:", "", "", formatQty(totalUnits), "100.0%"]] : undefined,
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.2,
      halign: "left",
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 7.8,
      lineColor: [203, 213, 225],
      lineWidth: 0.8,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 45, fontStyle: "bold", textColor: [71, 85, 105] },
      1: { halign: "center", cellWidth: 65, font: "courier", fontStyle: "bold" },
      2: { halign: "left", fontStyle: "bold" },
      3: { halign: "right", cellWidth: 80, fontStyle: "bold" },
      4: { halign: "right", cellWidth: 70, textColor: [71, 85, 105] },
    },
  });

  applyFooters(doc);
}

/**
 * Ponto de entrada unificado para gerar qualquer um dos 4 relatórios em PDF no frontend.
 * Retorna o objeto jsPDF pronto.
 */
export function generatePdfDocument({
  reportType,
  company,
  responsibleName,
  products = [],
  movements = [],
  dateFrom,
  dateTo,
  expiryWindowDays = 15,
}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  if (reportType === "estoque_atual") {
    buildStockSnapshotPdf(doc, company, responsibleName, products);
  } else if (reportType === "produtos_a_vencer") {
    buildExpiryPdf(doc, company, responsibleName, products, expiryWindowDays);
  } else if (reportType === "movimentacoes") {
    buildMovementsPdf(doc, company, responsibleName, movements, dateFrom, dateTo);
  } else if (reportType === "giro_estoque") {
    buildTurnoverPdf(doc, company, responsibleName, movements, dateFrom, dateTo);
  } else {
    throw new Error(`Tipo de relatório desconhecido: ${reportType}`);
  }

  return doc;
}
