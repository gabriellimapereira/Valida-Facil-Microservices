import React, { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Building2 } from "lucide-react";
import Sidebar from "./Sidebar";
import TopHeader from "./TopHeader";
import { useAuth } from "../../context/AuthContext";
import { useCompany } from "../../context/CompanyContext";
import { useProducts } from "../../context/ProductContext";
import { daysUntil } from "../../utils/formatters";

const TITLES = {
  "/dashboard": ["Dashboard", "Visão geral do seu estoque"],
  "/estoque": ["Estoque", "Consulte, cadastre e edite seus produtos"],
  "/perfil": ["Configurações", "Perfil da empresa e segurança"],
};

const COLLAPSE_STORAGE_KEY = "estoquepro:sidebar-collapsed";

function OnboardingPendingNotice() {
  return (
    <div className="p-6 sm:p-10 flex flex-col items-center text-center max-w-md mx-auto mt-16">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-5">
        <Building2 size={26} className="text-amber-600" />
      </div>
      <h2 className="text-lg font-bold text-slate-900 mb-2">Nenhuma empresa vinculada</h2>
      <p className="text-sm text-slate-500 leading-relaxed">
        Seu login funcionou, mas essa conta ainda não está associada a nenhuma empresa. O cadastro
        de empresa pelo próprio app ainda está sendo implementado — por enquanto, peça a um
        administrador para vincular sua conta via SQL Editor no Supabase.
      </p>
    </div>
  );
}

export default function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1";
  });
  const { needsOnboarding } = useAuth();
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
          {/* Centraliza todo o conteúdo das telas internas, com um teto de
             largura confortável para leitura em monitores ultrawide. */}
          <div className="max-w-7xl mx-auto w-full">
            {needsOnboarding ? <OnboardingPendingNotice /> : <Outlet />}
          </div>
        </main>
      </div>
    </div>
  );
}
