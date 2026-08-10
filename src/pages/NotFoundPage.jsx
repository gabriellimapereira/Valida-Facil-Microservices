import React from "react";
import { Link } from "react-router-dom";
import { Boxes } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center mb-5">
        <Boxes size={26} className="text-amber-500" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Página não encontrada</h1>
      <p className="text-sm text-slate-500 mb-6">O endereço acessado não existe ou foi movido.</p>
      <Link to="/dashboard" className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition">
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
