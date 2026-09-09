import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Compass, LayoutDashboard, PackageSearch } from "lucide-react";
import BrandLogo from "../components/ui/BrandLogo";
import TactileButton from "../components/ui/TactileButton";

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-navy relative overflow-hidden p-6 sm:p-12 select-none">
      {/* Luzes de fundo com blur elegante */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-amber-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-teal-500/15 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-600/5 blur-3xl pointer-events-none" />

      {/* Topo: Logo Oficial */}
      <div className="relative z-10 flex items-center justify-center sm:justify-start gap-3">
        <BrandLogo size={40} className="shadow-lg shadow-black/20 rounded-full shrink-0" />
        <span className="text-white font-bold text-xl tracking-tight">Valida Fácil</span>
      </div>

      {/* Centro: Ilustração 404 e Conteúdo */}
      <div className="relative z-10 max-w-lg mx-auto text-center my-auto py-10">
        {/* Badge 404 */}
        <div className="relative inline-flex items-center justify-center mb-6">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl">
            <PackageSearch size={48} className="text-amber-400 animate-pulse" />
          </div>
          <span className="absolute -top-2.5 -right-3 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-extrabold text-xs tracking-wider uppercase shadow-md">
            Erro 404
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-3">
          Página não encontrada
        </h1>

        <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-8 max-w-md mx-auto">
          O endereço que você tentou acessar não existe, foi movido ou está temporariamente indisponível.
        </p>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <TactileButton
            variant="amber"
            onClick={() => navigate("/dashboard")}
            padding="12px 24px"
            rounded={12}
            className="w-full sm:w-auto"
          >
            <div className="flex items-center justify-center gap-2">
              <LayoutDashboard size={17} />
              <span>Ir para o Dashboard</span>
            </div>
          </TactileButton>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-white/15 text-slate-200 text-sm font-semibold hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Voltar página</span>
          </button>
        </div>
      </div>

      {/* Rodapé institucional */}
      <div className="relative z-10 text-center text-xs text-slate-400 pt-6">
        © {new Date().getFullYear()} Valida Fácil • Gestão Empresarial de Estoque
      </div>
    </div>
  );
}
