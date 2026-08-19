import React from "react";

const ACCENTS = {
  navy: "bg-slate-900 text-white",
  gold: "bg-amber-600 text-white",
  teal: "bg-teal-600 text-white",
  light: "bg-white text-slate-900 border border-slate-200",
};

export default function MetricCard({ icon: Icon, label, value, accent = "light", sub }) {
  const isLight = accent === "light";
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${ACCENTS[accent]} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium uppercase tracking-wide ${isLight ? "text-slate-500" : "text-white/70"}`}>
          {label}
        </span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isLight ? "bg-slate-100" : "bg-white/15"}`}>
          <Icon size={18} className={isLight ? "text-slate-700" : "text-white"} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className={`text-xs mt-1 ${isLight ? "text-slate-500" : "text-white/70"}`}>{sub}</p>}
      </div>
    </div>
  );
}
