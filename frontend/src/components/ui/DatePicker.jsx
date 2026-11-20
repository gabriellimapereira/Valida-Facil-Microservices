import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Formata YYYY-MM-DD para DD/MM/AAAA para exibição amigável
 */
function formatDisplayDate(iso) {
  if (!iso || typeof iso !== "string" || !iso.includes("-")) return "";
  const [y, m, d] = iso.split("-");
  return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${y}`;
}

/**
 * DatePicker customizado do Valida Fácil
 * - Abre diretamente ancorado no botão (sem pulo diagonal)
 * - Renderiza via Portal no document.body para não ser cortado por modais
 * - Auto-posicionamento para cima ou para baixo conforme o espaço em tela
 */
export default function DatePicker({
  value = "",
  onChange,
  placeholder = "dd/mm/aaaa",
  disabled = false,
  min,
  max,
  className = "",
  id,
  name,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, openUpward: false });

  const getInitialViewDate = () => {
    if (value && typeof value === "string" && value.includes("-")) {
      const d = new Date(`${value}T00:00:00`);
      if (!isNaN(d.getTime())) return d;
    }
    if (min && typeof min === "string" && min.includes("-")) {
      const minDate = new Date(`${min}T00:00:00`);
      const now = new Date();
      if (!isNaN(minDate.getTime()) && now < minDate) {
        return minDate;
      }
    }
    return new Date();
  };

  const initialDate = getInitialViewDate();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear() || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth() || new Date().getMonth());

  useEffect(() => {
    if (value && typeof value === "string" && value.includes("-")) {
      const [y, m] = value.split("-").map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    } else if (min && typeof min === "string" && min.includes("-")) {
      const [minY, minM] = min.split("-").map(Number);
      if (!isNaN(minY) && !isNaN(minM)) {
        if (viewYear < minY || (viewYear === minY && viewMonth < minM - 1)) {
          setViewYear(minY);
          setViewMonth(minM - 1);
        }
      }
    }
  }, [value, min]);

  const computePosition = () => {
    if (!triggerRef.current) return null;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 276;
    const popoverHeight = 300;
    const gap = 6;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < popoverHeight && rect.top > popoverHeight;

    let top = openUpward ? rect.top - popoverHeight - gap : rect.bottom + gap;
    let left = rect.left;

    if (left + popoverWidth > window.innerWidth - 12) {
      left = Math.max(12, rect.right - popoverWidth);
    }

    return { top, left, openUpward };
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    if (disabled) return;

    if (!isOpen) {
      const pos = computePosition();
      if (pos) setCoords(pos);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  useIsoLayoutEffect(() => {
    if (isOpen) {
      const handleReposition = () => {
        const pos = computePosition();
        if (pos) setCoords(pos);
      };
      window.addEventListener("scroll", handleReposition, true);
      window.addEventListener("resize", handleReposition);
      return () => {
        window.removeEventListener("scroll", handleReposition, true);
        window.removeEventListener("resize", handleReposition);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  let isPrevMonthDisabled = false;
  if (min && typeof min === "string" && min.includes("-")) {
    const [minY, minM] = min.split("-").map(Number);
    if (!isNaN(minY) && !isNaN(minM)) {
      if (viewYear < minY || (viewYear === minY && viewMonth <= minM - 1)) {
        isPrevMonthDisabled = true;
      }
    }
  }

  let isNextMonthDisabled = false;
  if (max && typeof max === "string" && max.includes("-")) {
    const [maxY, maxM] = max.split("-").map(Number);
    if (!isNaN(maxY) && !isNaN(maxM)) {
      if (viewYear > maxY || (viewYear === maxY && viewMonth >= maxM - 1)) {
        isNextMonthDisabled = true;
      }
    }
  }

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (isPrevMonthDisabled) return;
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (isNextMonthDisabled) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDate = (year, month, day) => {
    const isoString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (min && isoString < min) return;
    if (max && isoString > max) return;
    if (onChange) {
      onChange({ target: { value: isoString, name, id } });
    }
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange({ target: { value: "", name, id } });
    }
    setIsOpen(false);
  };

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const isTodayDisabled = Boolean((min && todayIso < min) || (max && todayIso > max));

  const handleSelectToday = (e) => {
    e.stopPropagation();
    if (isTodayDisabled) return;
    const isoString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (min && isoString < min) return;
    if (max && isoString > max) return;
    if (onChange) {
      onChange({ target: { value: isoString, name, id } });
    }
    setIsOpen(false);
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const days = [];

  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    days.push({
      day: daysInPrevMonth - i,
      month: viewMonth === 0 ? 11 : viewMonth - 1,
      year: viewMonth === 0 ? viewYear - 1 : viewYear,
      isCurrentMonth: false,
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      day: i,
      month: viewMonth,
      year: viewYear,
      isCurrentMonth: true,
    });
  }

  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      day: i,
      month: viewMonth === 11 ? 0 : viewMonth + 1,
      year: viewMonth === 11 ? viewYear + 1 : viewYear,
      isCurrentMonth: false,
    });
  }

  const displayValue = formatDisplayDate(value);

  const popoverContent = isOpen && typeof document !== "undefined" ? (
    createPortal(
      <div
        ref={popoverRef}
        style={{
          position: "fixed",
          top: coords.top,
          left: coords.left,
          width: 276,
          zIndex: 99999,
        }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-3.5 select-none"
      >
        {/* Cabeçalho do Mês */}
        <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
          <button
            type="button"
            disabled={isPrevMonthDisabled}
            onClick={handlePrevMonth}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
              isPrevMonthDisabled
                ? "text-slate-200 cursor-not-allowed"
                : "text-slate-600 hover:bg-slate-100 hover:text-navy cursor-pointer"
            }`}
            title="Mês anterior"
          >
            <ChevronLeft size={17} />
          </button>
          <div className="text-center font-bold text-sm text-navy">
            {MONTH_NAMES[viewMonth]} <span className="text-amber-600 font-semibold">{viewYear}</span>
          </div>
          <button
            type="button"
            disabled={isNextMonthDisabled}
            onClick={handleNextMonth}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
              isNextMonthDisabled
                ? "text-slate-200 cursor-not-allowed"
                : "text-slate-600 hover:bg-slate-100 hover:text-navy cursor-pointer"
            }`}
            title="Próximo mês"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        {/* Dias da Semana */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {WEEK_DAYS.map((wd, i) => (
            <span
              key={wd}
              className={`text-[10px] font-semibold uppercase tracking-wider py-0.5 ${i === 0 || i === 6 ? "text-amber-700" : "text-slate-400"}`}
            >
              {wd}
            </span>
          ))}
        </div>

        {/* Grade de Dias */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {days.map((d, index) => {
            const currentIso = `${d.year}-${String(d.month + 1).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
            const isSelected = value === currentIso;
            const isToday = todayIso === currentIso;
            const isDisabledDate = Boolean((min && currentIso < min) || (max && currentIso > max));

            return (
              <button
                key={index}
                type="button"
                disabled={isDisabledDate}
                onClick={isDisabledDate ? undefined : () => handleSelectDate(d.year, d.month, d.day)}
                title={
                  isDisabledDate
                    ? currentIso < min
                      ? `Data anterior ao mínimo (${formatDisplayDate(min)})`
                      : `Data posterior ao máximo (${formatDisplayDate(max)})`
                    : undefined
                }
                className={`h-7 w-7 mx-auto rounded-lg flex items-center justify-center text-xs font-medium transition-all
                  ${isDisabledDate
                    ? "text-slate-300 bg-slate-50/40 cursor-not-allowed opacity-35 select-none line-through"
                    : !d.isCurrentMonth
                      ? "text-slate-300 hover:text-slate-500 hover:bg-slate-50 cursor-pointer"
                      : "text-slate-700 cursor-pointer"
                  }
                  ${isSelected && !isDisabledDate ? "bg-amber-600 text-white font-bold shadow-sm shadow-amber-600/30 hover:bg-amber-700 !text-white" : !isDisabledDate ? "hover:bg-amber-50 hover:text-amber-900" : ""}
                  ${isToday && !isSelected && !isDisabledDate ? "border border-teal-500 font-bold text-teal-700 bg-teal-50/50" : ""}`}
              >
                {d.day}
              </button>
            );
          })}
        </div>

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-xs">
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-700 font-medium px-2 py-1 rounded hover:bg-slate-100 transition cursor-pointer"
          >
            Limpar
          </button>
          <button
            type="button"
            disabled={isTodayDisabled}
            onClick={handleSelectToday}
            className={`font-semibold px-2 py-1 rounded transition ${
              isTodayDisabled
                ? "text-slate-300 cursor-not-allowed opacity-50"
                : "text-amber-600 hover:text-amber-700 hover:bg-amber-50 cursor-pointer"
            }`}
          >
            Hoje
          </button>
        </div>
      </div>,
      document.body
    )
  ) : null;

  return (
    <div className={`relative ${className}`}>
      {/* Campo de gatilho */}
      <div
        ref={triggerRef}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition select-none
          ${disabled ? "bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200" : "bg-white text-slate-900 cursor-pointer border-slate-200 hover:border-amber-400"}
          ${isOpen ? "ring-2 ring-amber-500/30 border-amber-500 shadow-sm" : ""}`}
      >
        <span className={displayValue ? "text-slate-900 font-medium" : "text-slate-400"}>
          {displayValue || placeholder}
        </span>
        <div className="flex items-center gap-1.5 text-amber-600">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
              title="Limpar data"
            >
              <X size={14} />
            </button>
          )}
          <CalendarIcon size={16} className={disabled ? "text-slate-400" : "text-amber-600"} />
        </div>
      </div>

      {popoverContent}
    </div>
  );
}
