import React from "react";
import { Loader2 } from "lucide-react";

export default function FullScreenLoader({ label = "Carregando..." }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 gap-3">
      <Loader2 size={28} className="animate-spin text-amber-600" />
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
