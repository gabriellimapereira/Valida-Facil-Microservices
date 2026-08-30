import React, { useState } from "react";
import { createPortal } from "react-dom";
import { FileText, X } from "lucide-react";
import TactileButton from "../ui/TactileButton";
import DatePicker from "../ui/DatePicker";

const REPORT_TYPES = [
  { id: "estoque_atual", label: "Estoque atual", hint: "Fotografia consolidada de todos os produtos cadastrados" },
  { id: "movimentacoes", label: "Movimentações", hint: "Histórico de entradas, saídas e ajustes no período" },
  { id: "produtos_a_vencer", label: "Produtos a vencer", hint: "Itens perecíveis com alerta e cálculo de valor em risco" },
  { id: "giro_estoque", label: "Giro de estoque", hint: "Ranking de produtos por volume de saídas no período" },
];

export default function ReportModal({ onClose, onSubmit }) {
  const [reportType, setReportType] = useState("estoque_atual");
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
        format: "pdf",
        dateFrom: usesDateRange ? dateFrom : undefined,
        dateTo: usesDateRange ? dateTo : undefined,
        expiryWindowDays: usesExpiryWindow ? Number(expiryWindowDays) : undefined,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Não foi possível gerar o relatório em PDF.");
    } finally {
      setSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-base">Gerar Relatório em PDF</h3>
              <p className="text-xs text-slate-500">Documento formatado oficial para impressão ou download</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition p-1">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Selecione o tipo de relatório
            </label>
            <div className="grid grid-cols-1 gap-2">
              {REPORT_TYPES.map((t) => {
                const isSelected = reportType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setReportType(t.id)}
                    className={`text-left px-3.5 py-2.5 rounded-xl border transition ${
                      isSelected
                        ? "border-amber-500 bg-amber-50/60 ring-1 ring-amber-500/20"
                        : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <p className={`text-sm font-semibold ${isSelected ? "text-amber-800" : "text-slate-800"}`}>
                      {t.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${isSelected ? "text-amber-600/80" : "text-slate-400"}`}>
                      {t.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {usesDateRange && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Data Inicial</label>
                <DatePicker
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="Data inicial"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Data Final</label>
                <DatePicker
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="Data final"
                />
              </div>
            </div>
          )}

          {usesExpiryWindow && (
            <div className="pt-1">
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Janela de análise (próximos dias)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={expiryWindowDays}
                  onChange={(e) => setExpiryWindowDays(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                  placeholder="Ex: 15"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-medium pointer-events-none">
                  dias
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Lista todos os itens com data de validade dentro deste intervalo.
              </p>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 flex items-center gap-3 text-xs text-slate-600">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0 font-bold">
              PDF
            </div>
            <span>O arquivo será gerado com o cabeçalho oficial e layout institucional do <strong>Valida Fácil</strong>.</span>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <TactileButton
              variant="secondary"
              onClick={onClose}
              className="flex-1"
              padding="10px 16px"
              rounded={12}
            >
              Cancelar
            </TactileButton>
            <TactileButton
              type="submit"
              variant="amber"
              disabled={submitting}
              className="flex-1"
              padding="10px 16px"
              rounded={12}
            >
              {submitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Gerando PDF...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <FileText size={16} />
                  <span>Gerar e Baixar PDF</span>
                </div>
              )}
            </TactileButton>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
}
