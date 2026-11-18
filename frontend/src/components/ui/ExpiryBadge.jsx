import React from "react";
import { expiryUrgency } from "../../utils/formatters";

/**
 * ExpiryBadge — status de validade com contraste e cor proporcionais à urgência.
 */
export default function ExpiryBadge({ date, urgency: urgencyProp, className = "", size = "md" }) {
  const urgency = urgencyProp || (date ? expiryUrgency(date) : null);
  if (!urgency) return null;

  const { level, label } = urgency;

  const NEON_CONFIGS = {
    critical: {
      bg: "bg-red-50 text-red-700",
      border: "border-red-500",
      dot: "bg-red-600",
    },
    high: {
      bg: "bg-amber-50 text-amber-800",
      border: "border-amber-500",
      dot: "bg-amber-600",
    },
    medium: {
      bg: "bg-teal-50 text-teal-800",
      border: "border-teal-400",
      dot: "bg-teal-600",
    },
    low: {
      bg: "bg-slate-50 text-slate-600",
      border: "border-slate-200",
      dot: "bg-slate-400",
    },
  };

  const config = NEON_CONFIGS[level] || NEON_CONFIGS.low;

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 font-semibold transition-all duration-300 select-none
        ${size === "sm" ? "px-2 py-0.5 text-[11px] rounded-full" : "px-2.5 py-1 text-xs rounded-full"}
        ${config.bg} ${config.border} border ${className}`}
    >
      <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${config.dot}`} />
      </span>
      <span className="tracking-tight whitespace-nowrap">{label}</span>
    </span>
  );
}
