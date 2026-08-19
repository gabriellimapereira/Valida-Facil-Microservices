import React from "react";
import { catInfo } from "../../utils/formatters";

const COLOR_MAP = {
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  gray: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function CategoryBadge({ id }) {
  const c = catInfo(id);
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${COLOR_MAP[c.color]}`}>
      {c.label}
    </span>
  );
}
