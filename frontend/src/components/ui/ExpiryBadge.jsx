import React from "react";
import { expiryUrgency } from "../../utils/formatters";

/**
 * ExpiryBadge — Badge de urgência com borda e efeito de brilho Neon Glow
 * inspirado na paleta do Valida Fácil e com intensidade proporcional à urgência:
 * - Vencido / Vence hoje / 1-2 dias: Neon Vermelho pulsante com ponto em ping
 * - 3-7 dias: Neon Âmbar vibrante
 * - 8-15 dias: Neon Teal sofisticado
 * - > 15 dias: Neutro
 */
export default function ExpiryBadge({ date, urgency: urgencyProp, className = "", size = "md" }) {
  const urgency = urgencyProp || (date ? expiryUrgency(date) : null);
  if (!urgency) return null;

  const { level, label } = urgency;

  const NEON_CONFIGS = {
    critical: {
      bg: "bg-red-50 text-red-700",
      border: "border-red-500",
      glowClass: "neon-glow-critical",
      dot: "bg-red-600",
      pulse: true,
      textGlow: "0 0 10px rgba(239, 68, 68, 0.4)",
    },
    high: {
      bg: "bg-amber-50 text-amber-800",
      border: "border-amber-500",
      glowClass: "neon-glow-high",
      dot: "bg-amber-600",
      pulse: false,
      textGlow: "0 0 8px rgba(245, 158, 11, 0.35)",
    },
    medium: {
      bg: "bg-teal-50 text-teal-800",
      border: "border-teal-400",
      glowClass: "neon-glow-medium",
      dot: "bg-teal-600",
      pulse: false,
      textGlow: "none",
    },
    low: {
      bg: "bg-slate-50 text-slate-600",
      border: "border-slate-200",
      glowClass: "",
      dot: "bg-slate-400",
      pulse: false,
      textGlow: "none",
    },
  };

  const config = NEON_CONFIGS[level] || NEON_CONFIGS.low;

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 font-semibold transition-all duration-300 select-none
        ${size === "sm" ? "px-2 py-0.5 text-[11px] rounded-full" : "px-2.5 py-1 text-xs rounded-full"}
        ${config.bg} ${config.border} border ${config.glowClass} ${className}`}
      style={{ textShadow: config.textGlow }}
    >
      {/* Ponto indicador animado */}
      <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
        {config.pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${config.dot}`} />
      </span>
      <span className="tracking-tight whitespace-nowrap">{label}</span>
    </span>
  );
}
