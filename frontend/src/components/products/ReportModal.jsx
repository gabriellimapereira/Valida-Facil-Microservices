import React, { useState } from "react";
import { FileSpreadsheet, FileText, X } from "lucide-react";

const REPORT_TYPES = [
  { id: "estoque_atual", label: "Estoque atual", hint: "Fotografia completa do estoque agora" },
  { id: "movimentacoes", label: "Movimentações", hint: "Entradas, saídas e ajustes do período" },
  { id: "produtos_a_vencer", label: "Produtos a vencer", hint: "Janela de dias configurável" },
  { id: "giro_estoque", label: "Giro de estoque", hint: "Produtos com mais saídas no período" },
];

export default function ReportModal({ onClose, onSubmit }) {
  const [reportType, setReportType] = useState("estoque_atual");
  const [format, setFormat] = useState("pdf");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expiryWindowDays, setExpiryWindowDays] = useState(15);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const usesDateRange = reportType === "movimentacoes" || reportType === "giro_estoque";
  const usesExpiryWindow = reportType === "produtos_a_vencer";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({
        reportType,
        format,
        dateFrom: usesDateRange ? dateFrom : undefined,
        dateTo: usesDateRange ? dateTo : undefined,
        expiryWindowDays: usesExpiryWindow ? Number(expiryWindowDays) : undefined,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Não foi possível gerar o relatório.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Gerar relatório</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Tipo de relatório</label>
            <div className="grid grid-cols-1 gap-2">
              {REPORT_TYPES.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setReportType(t.id)}
                  className={`text-left px-3.5 py-2.5 rounded-xl border transition ${
                    reportType === t.id
                      ? "border-amber-500 bg-amber-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className={`text-sm font-medium ${reportType === t.id ? "text-amber-700" : "text-slate-700"}`}>
                    {t.label}
                  </p>
                  <p className="text-xs text-slate-400">{t.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {usesDateRange && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">De</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Até</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
              </div>
            </div>
          )}

          {usesExpiryWindow && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Janela de dias</label>
              <input
                type="number"
                min="1"
                max="365"
                value={expiryWindowDays}
                onChange={(e) => setExpiryWindowDays(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Formato</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition ${
                  format === "pdf" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <FileText size={16} /> PDF
              </button>
              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition ${
                  format === "xlsx" ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                <FileSpreadsheet size={16} /> Excel
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold transition">
              {submitting ? "Gerando..." : "Gerar e baixar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
