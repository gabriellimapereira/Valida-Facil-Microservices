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

  return (
    <div className="h-screen bg-slate-100 flex overflow-hidden">
      <Sidebar
        company={company}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopHeader
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setMobileOpen(true)}
          company={company}
          alertCount={alertCount}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
