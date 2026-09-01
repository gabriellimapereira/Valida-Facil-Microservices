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

  const handleDaysKeyDown = (e) => {
    if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleDaysChange = (e) => {
    const digits = e.target.value.replace(/\D/g, "");
    if (digits === "") {
      setExpiryWindowDays("");
      return;
    }
    const num = Number(digits);
    if (num > 365) {
      setExpiryWindowDays(365);
    } else {
      setExpiryWindowDays(num);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (usesDateRange && dateFrom && dateTo) {
      if (dateFrom > dateTo) {
        setError("A data inicial não pode ser posterior à data final.");
        return;
      }
    }

    if (usesExpiryWindow) {
      const days = Number(expiryWindowDays);
      if (!days || isNaN(days) || days < 1 || days > 365) {
        setError("Informe uma janela de validade válida entre 1 e 365 dias.");
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({
        reportType,
        format: "pdf",
        dateFrom: usesDateRange && dateFrom ? dateFrom : undefined,
        dateTo: usesDateRange && dateTo ? dateTo : undefined,
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
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy text-white flex items-center justify-center shadow-sm">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Gerar Relatório em PDF</h3>
              <p className="text-xs text-slate-500">Documento formatado oficial para impressão ou download</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition p-1 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X size={18} />
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
                    onClick={() => {
                      setReportType(t.id);
                      setError("");
                    }}
                    className={`text-left px-3.5 py-2.5 rounded-xl border transition cursor-pointer ${
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
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data Inicial</label>
                <DatePicker
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setError("");
                  }}
                  placeholder="Data inicial"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Data Final</label>
                <DatePicker
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setError("");
                  }}
                  placeholder="Data final"
                />
              </div>
            </div>
          )}

          {usesExpiryWindow && (
            <div className="pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Janela de análise (próximos dias)
                </label>
                <span className="text-[10px] text-slate-400 font-mono">1 a 365 dias</span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={expiryWindowDays}
                  onKeyDown={handleDaysKeyDown}
                  onChange={handleDaysChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition"
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
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
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
