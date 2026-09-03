import React from "react";

const PILL_ACCENTS = {
  navy: {
    pill: "bg-navy/10 text-navy border border-navy/15",
  },
  gold: {
    pill: "bg-amber-500/15 text-amber-700 border border-amber-500/25",
  },
  teal: {
    pill: "bg-teal-500/15 text-teal-700 border border-teal-500/25",
  },
  emerald: {
    pill: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/25",
  },
  light: {
    pill: "bg-slate-100 text-slate-700 border border-slate-200",
  },
};

export default function MetricCard({ icon: Icon, label, value, accent = "navy", sub }) {
  const theme = PILL_ACCENTS[accent] || PILL_ACCENTS.navy;

  return (
    <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200/85 shadow-sm hover:shadow-md hover:border-slate-300 flex flex-col justify-between gap-2.5 sm:gap-3 transition-all duration-200 group">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-700 transition-colors truncate">
          {label}
        </span>
        <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${theme.pill} transition-transform group-hover:scale-105 duration-200`}>
          <Icon size={16} className="sm:w-[18px] sm:h-[18px]" />
        </div>
      </div>
      <div>
        <p className="text-xl sm:text-2xl lg:text-[26px] font-extrabold tracking-tight text-slate-900 leading-none truncate">
          {value}
        </p>
        {sub && <p className="text-[10px] sm:text-xs mt-1.5 sm:mt-2 font-medium text-slate-500 leading-normal truncate">{sub}</p>}
      </div>
    </div>
  );
}
