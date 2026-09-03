import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopHeader from "./TopHeader";
import { useCompany } from "../../context/CompanyContext";
import { useProducts } from "../../context/ProductContext";
import { daysUntil } from "../../utils/formatters";

const TITLES = {
  "/dashboard": ["Dashboard", "Visão geral do seu estoque"],
  "/estoque": ["Estoque", "Consulte, cadastre e edite seus produtos"],
  "/perfil": ["Configurações", "Perfil da empresa e segurança"],
};

const COLLAPSE_STORAGE_KEY = "estoquepro:sidebar-collapsed";

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
  });
  const { company } = useCompany();
  const { products } = useProducts();
  const location = useLocation();

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const [title, subtitle] = TITLES[location.pathname] || ["EstoquePro", ""];
  const alertCount = products.filter((p) => p.expiry && daysUntil(p.expiry) <= 7).length;

  const isProfilePage = location.pathname === "/perfil";

  return (
    <div className="h-screen flex overflow-hidden relative">
      {/* Camada 1: Fundo Azul Noturno com Iluminação Ambiente (Perfil & Configurações) */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out pointer-events-none ${
          isProfilePage ? "opacity-100" : "opacity-0"
        } bg-gradient-to-br from-[#162846] via-[#101F37] to-[#0A1322]`}
      >
        <div className="absolute -top-32 right-1/4 w-[520px] h-[520px] rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-1/3 w-[450px] h-[450px] rounded-full bg-amber-500/5 blur-3xl pointer-events-none" />
      </div>

      {/* Camada 2: Fundo Claro Padrão do Sistema (Dashboard e Estoque) */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out pointer-events-none bg-slate-100 ${
          isProfilePage ? "opacity-0" : "opacity-100"
        }`}
      />

      <Sidebar
        company={company}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <div className="flex-1 flex flex-col min-w-0 relative z-10 w-full overflow-hidden">
        <TopHeader
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setMobileOpen(true)}
          company={company}
          alertCount={alertCount}
          isDarkTheme={isProfilePage}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
