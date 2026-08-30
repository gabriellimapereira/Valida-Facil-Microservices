import React, { useState } from "react";
import { Bell, Menu } from "lucide-react";
import CompanyLogo from "../ui/CompanyLogo";

export default function TopHeader({ title, subtitle, onMenuClick, company, alertCount = 0 }) {
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="h-16 shrink-0 bg-slate-100 border-b border-slate-200/60 flex items-center gap-4 px-4 sm:px-6">
      <button className="lg:hidden text-slate-500" onClick={onMenuClick}>
        <Menu size={22} />
      </button>
      <div className="min-w-0">
        <h1 className="text-slate-900 font-semibold text-base sm:text-lg truncate">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 hidden sm:block">{subtitle}</p>}
      </div>

      <div className="ml-auto flex items-center gap-3 relative">
        <button
          onClick={() => setNotifOpen((o) => !o)}
          className="relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-200/60 text-slate-600 transition"
        >
          <Bell size={19} />
          {alertCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
              {alertCount}
            </span>
          )}
        </button>
        {notifOpen && (
          <div className="absolute right-0 top-12 w-72 bg-white rounded-xl shadow-lg border border-slate-200 p-3 z-20">
            <p className="text-sm font-semibold text-slate-900 mb-1">Alertas de validade</p>
            <p className="text-xs text-slate-500">
              {alertCount > 0
                ? `${alertCount} produto(s) precisam de atenção. Veja o painel no Dashboard.`
                : "Nenhum produto próximo do vencimento."}
            </p>
          </div>
        )}
        {company && (
          <div className="hidden sm:flex items-center gap-2.5 pl-3 border-l border-slate-200">
            <CompanyLogo company={company} size="sm" bgClass="bg-navy" />
            <span className="text-sm font-medium text-slate-700 max-w-[140px] truncate">{company.name}</span>
          </div>
        )}
      </div>
    </header>
  );
}
