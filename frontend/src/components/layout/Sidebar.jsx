import React from "react";
import { NavLink } from "react-router-dom";
import { Boxes, ChevronLeft, ChevronRight, LayoutDashboard, LogOut, Package, Settings, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import CompanyLogo from "../ui/CompanyLogo";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/estoque", label: "Estoque", icon: Package },
  { to: "/perfil", label: "Perfil & Config.", icon: Settings },
];

export default function Sidebar({ company, mobileOpen, setMobileOpen, collapsed, setCollapsed }) {
  const { signOut } = useAuth();

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className={`fixed lg:static top-0 left-0 h-full bg-navy flex flex-col z-40 shrink-0
        transition-[width,transform] duration-200 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        ${collapsed ? "w-64 lg:w-20" : "w-64"}`}
      >
        {/* Floating collapse/expand toggle (desktop only) */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className="hidden lg:flex absolute -right-3 top-20 w-7 h-7 rounded-full bg-white border border-slate-200
          shadow-md items-center justify-center text-slate-500 hover:text-amber-600 hover:border-amber-300
          transition z-50"
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>

        <div className={`flex items-center gap-3 h-16 border-b border-white/10 shrink-0 ${collapsed ? "lg:justify-center px-6 lg:px-0" : "px-6"}`}>
          <div className="w-9 h-9 rounded-lg bg-amber-600 flex items-center justify-center shrink-0">
            <Boxes size={18} className="text-white" />
          </div>
          <span className={`text-white font-semibold tracking-tight whitespace-nowrap ${collapsed ? "lg:hidden" : ""}`}>
            Valida Fácil
          </span>
          <button className="ml-auto lg:hidden text-slate-400" onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {company && (
          <div className={`pt-5 pb-2 ${collapsed ? "lg:px-3 px-4" : "px-4"}`}>
            <div className={`flex items-center gap-3 py-2.5 rounded-xl bg-white/5 ${collapsed ? "lg:justify-center lg:px-0 px-2" : "px-2"}`}>
              <CompanyLogo company={company} size="md" bgClass="bg-amber-600" />
              <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
                <p className="text-white text-sm font-medium truncate">{company.name}</p>
                <p className="text-slate-400 text-xs truncate">{company.segment}</p>
              </div>
            </div>
          </div>
        )}

        <nav className={`flex-1 py-4 space-y-1 ${collapsed ? "lg:px-3 px-4" : "px-4"}`}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              title={item.label}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium transition
                ${collapsed ? "lg:justify-center lg:px-0 px-3" : "px-3"}
                ${isActive ? "bg-amber-600 text-white shadow-sm" : "text-slate-300 hover:bg-white/5 hover:text-white"}`
              }
            >
              <item.icon size={18} className="shrink-0" />
              <span className={`whitespace-nowrap ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={`pb-5 ${collapsed ? "lg:px-3 px-4" : "px-4"}`}>
          <button
            onClick={signOut}
            title="Sair"
            className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition
            ${collapsed ? "lg:justify-center lg:px-0 px-3" : "px-3"}`}
          >
            <LogOut size={18} className="shrink-0" />
            <span className={`whitespace-nowrap ${collapsed ? "lg:hidden" : ""}`}>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
