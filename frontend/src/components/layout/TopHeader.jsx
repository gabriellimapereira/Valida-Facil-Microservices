import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, Menu } from "lucide-react";
import CompanyLogo from "../ui/CompanyLogo";

export default function TopHeader({
  title,
  subtitle,
  onMenuClick,
  company,
  alertCount = 0,
  isDarkTheme = false,
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    if (!notifOpen) return;
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [notifOpen]);

  return (
    <header
      className={`h-16 shrink-0 flex items-center gap-4 px-4 sm:px-6 transition-all duration-700 ease-in-out relative z-30 ${
        isDarkTheme
          ? "bg-transparent border-b border-transparent"
          : "bg-slate-100/90 backdrop-blur-sm border-b border-slate-200/60"
      }`}
    >
      <button
        className={`lg:hidden transition-colors duration-500 cursor-pointer ${
          isDarkTheme ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-800"
        }`}
        onClick={onMenuClick}
        aria-label="Abrir menu"
      >
        <Menu size={22} />
      </button>

      <div className="min-w-0">
        <h1
          className={`font-semibold text-base sm:text-lg truncate transition-colors duration-500 ${
            isDarkTheme ? "text-white" : "text-slate-900"
          }`}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={`text-xs hidden sm:block transition-colors duration-500 ${
              isDarkTheme ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>

      <div ref={notifRef} className="ml-auto flex items-center gap-3 relative">
        <button
          onClick={() => setNotifOpen((o) => !o)}
          aria-label="Alertas de validade"
          className={`relative w-10 h-10 rounded-full flex items-center justify-center transition cursor-pointer ${
            isDarkTheme
              ? "text-slate-200 hover:bg-white/10"
              : "text-slate-600 hover:bg-slate-200/60"
          }`}
        >
          <Bell size={19} />
          {alertCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
              {alertCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-12 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-900">
            <p className="text-sm font-bold text-slate-900 mb-1">Alertas de validade</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              {alertCount > 0
                ? `${alertCount} produto(s) precisam de atenção.`
                : "Nenhum produto próximo do vencimento."}
            </p>
            {alertCount > 0 && (
              <Link
                to="/dashboard"
                onClick={() => setNotifOpen(false)}
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100/80 px-3 py-1.5 rounded-lg border border-amber-200 transition"
              >
                <span>Ver alertas no Dashboard</span>
                <ArrowRight size={13} />
              </Link>
            )}
          </div>
        )}

        {company && (
          <div
            className={`hidden md:flex items-center gap-2.5 pl-3 border-l transition-colors duration-500 ${
              isDarkTheme ? "border-white/15" : "border-slate-200"
            }`}
          >
            <CompanyLogo company={company} size="sm" bgClass={isDarkTheme ? "bg-amber-600" : "bg-navy"} />
            <span
              className={`text-sm font-medium max-w-[140px] truncate transition-colors duration-500 ${
                isDarkTheme ? "text-slate-200" : "text-slate-700"
              }`}
            >
              {company.name}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
