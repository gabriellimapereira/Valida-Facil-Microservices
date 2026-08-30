import React from "react";

const ACCENTS = {
  navy: "bg-navy text-white shadow-md shadow-navy/20",
  gold: "bg-amber-600 text-white shadow-md shadow-amber-600/20",
  teal: "bg-teal-600 text-white shadow-md shadow-teal-600/20",
  light: "bg-white text-slate-900 border border-slate-200/90 shadow-sm ring-1 ring-slate-900/5",
};

export default function MetricCard({ icon: Icon, label, value, accent = "light", sub }) {
  const isLight = accent === "light";
  return (
    <div className={`rounded-2xl p-5 ${ACCENTS[accent]} flex flex-col gap-3 transition-transform hover:-translate-y-0.5 duration-150`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wider ${isLight ? "text-slate-600" : "text-white/80"}`}>
          {label}
        </span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isLight ? "bg-slate-100 text-slate-700" : "bg-white/20 text-white"}`}>
          <Icon size={18} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className={`text-xs mt-1 font-medium ${isLight ? "text-slate-500" : "text-white/80"}`}>{sub}</p>}
      </div>
    </div>
  );
}
