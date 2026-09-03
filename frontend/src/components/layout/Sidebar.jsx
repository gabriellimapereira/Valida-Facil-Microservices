import React, { useLayoutEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Boxes, ChevronLeft, ChevronRight, LayoutDashboard, LogOut, Package, Settings, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import CompanyLogo from "../ui/CompanyLogo";
import ConfirmationModal from "../ui/ConfirmationModal";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/estoque", label: "Estoque", icon: Package },
  { to: "/perfil", label: "Perfil & Config.", icon: Settings },
];

export default function Sidebar({ company, mobileOpen, setMobileOpen, collapsed, setCollapsed }) {
  const { signOut } = useAuth();
  const location = useLocation();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const itemRefs = useRef([]);
  const [pillStyle, setPillStyle] = useState({ top: 16, height: 42, ready: false });

  const activeIndex = NAV_ITEMS.findIndex((item) =>
    location.pathname === item.to || location.pathname.startsWith(item.to + "/")
  );

  useLayoutEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      const el = itemRefs.current[activeIndex];
      setPillStyle({
        top: el.offsetTop,
        height: el.offsetHeight,
        ready: true,
      });
    }
  }, [activeIndex, collapsed]);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
      <aside
        className={`fixed lg:relative top-0 left-0 h-full bg-navy border-r border-slate-800/80 lg:border-white/[0.08] flex flex-col z-50 shrink-0 shadow-2xl
        transition-[width,transform] duration-200 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        ${collapsed ? "w-64 lg:w-20" : "w-64"}`}
      >
        {/* Floating collapse/expand toggle (desktop only) */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
          className="hidden lg:flex absolute -right-3.5 top-20 w-7 h-7 rounded-full bg-[#122038] border border-white/20
          shadow-lg shadow-black/50 items-center justify-center text-slate-300 hover:text-amber-400 hover:border-amber-500/60
          transition-all duration-200 z-50 cursor-pointer"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Brand Header */}
        <div className={`flex items-center gap-3 h-16 border-b border-white/10 shrink-0 ${collapsed ? "lg:justify-center px-6 lg:px-0" : "px-6"}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shrink-0 shadow-md shadow-amber-600/30">
            <Boxes size={18} className="text-white" />
          </div>
          <span className={`text-white font-bold tracking-tight text-base whitespace-nowrap ${collapsed ? "lg:hidden" : ""}`}>
            Valida Fácil
          </span>
          <button className="ml-auto lg:hidden text-slate-400 hover:text-white" onClick={() => setMobileOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Company Card */}
        {company && (
          <div className={`pt-5 pb-2 ${collapsed ? "lg:px-3 px-4" : "px-4"}`}>
            <div className={`flex items-center gap-3 py-2.5 rounded-2xl bg-white/[0.06] border border-white/[0.08] ${collapsed ? "lg:justify-center lg:px-0 px-2.5" : "px-3"}`}>
              <CompanyLogo company={company} size="md" bgClass="bg-amber-600" />
              <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
                <p className="text-white text-sm font-semibold truncate">{company.name}</p>
                <p className="text-slate-400 text-xs truncate">{company.segment || "Varejo"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className={`relative flex-1 py-4 space-y-1.5 ${collapsed ? "lg:px-3 px-4" : "px-4"}`}>
          {/* Indicador deslizante ativo */}
          {activeIndex >= 0 && (
            <div
              className={`absolute rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 shadow-md shadow-amber-600/30 border border-amber-400/30 pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                collapsed ? "lg:left-3 lg:right-3 left-4 right-4" : "left-4 right-4"
              }`}
              style={{
                top: `${pillStyle.top}px`,
                height: `${pillStyle.height}px`,
                opacity: pillStyle.ready ? 1 : 0,
              }}
            />
          )}

          {NAV_ITEMS.map((item, index) => (
            <NavLink
              ref={(el) => (itemRefs.current[index] = el)}
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              title={item.label}
              className={({ isActive }) =>
                `relative z-10 w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-200 select-none
                ${collapsed ? "lg:justify-center lg:px-0 px-3" : "px-3"}
                ${
                  isActive
                    ? "text-white"
                    : "text-slate-300 hover:text-white hover:bg-white/[0.06]"
                }`
              }
            >
              <item.icon size={18} className="shrink-0" />
              <span className={`whitespace-nowrap ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sign Out Button */}
        <div className={`pb-5 ${collapsed ? "lg:px-3 px-4" : "px-4"}`}>
          <button
            onClick={() => setShowLogoutModal(true)}
            title="Sair da conta"
            className={`w-full flex items-center gap-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 cursor-pointer
            ${collapsed ? "lg:justify-center lg:px-0 px-3" : "px-3"}`}
          >
            <LogOut size={18} className="shrink-0" />
            <span className={`whitespace-nowrap ${collapsed ? "lg:hidden" : ""}`}>Sair</span>
          </button>
        </div>
      </aside>

      {/* Confirmação Segura de Logout */}
      <ConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={signOut}
        title="Deseja sair da sua conta?"
        description="Sua sessão será encerrada com segurança e você precisará digitar seu e-mail e senha para acessar novamente."
        confirmText="Sair do sistema"
        cancelText="Permanecer conectado"
        variant="amber"
      />
    </>
  );
}
