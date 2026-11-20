import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Converte porcentagem de arredondamento para pixels com base no menor lado
 * (100% = formato pílula perfeito, 0% = cantos retos).
 */
const radiusFromPercent = (w, h, pct) =>
  (Math.min(w, h) / 2) * (Math.max(0, Math.min(100, pct)) / 100);

const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Presets oficiais do Valida Fácil
 */
const PRESETS = {
  amber: {
    fill: "#B45309",
    hoverFill: "#92400E",
    baseColor: "#78350F",
    textColor: "#FFFFFF",
    hoverTextColor: "#FFFFFF",
    offsetX: 0,
    offsetY: 4,
  },
  primary: {
    fill: "#B45309",
    hoverFill: "#92400E",
    baseColor: "#78350F",
    textColor: "#FFFFFF",
    hoverTextColor: "#FFFFFF",
    offsetX: 0,
    offsetY: 4,
  },
  navy: {
    fill: "#162846",
    hoverFill: "#1F355B",
    baseColor: "#0F1C32",
    textColor: "#FFFFFF",
    hoverTextColor: "#FFFFFF",
    offsetX: 0,
    offsetY: 4,
  },
  blue: {
    fill: "#162846",
    hoverFill: "#1F355B",
    baseColor: "#0F1C32",
    textColor: "#FFFFFF",
    hoverTextColor: "#FFFFFF",
    offsetX: 0,
    offsetY: 4,
  },
  secondary: {
    fill: "#FFFFFF",
    hoverFill: "#F8FAFC",
    baseColor: "#CBD5E1",
    textColor: "#334155",
    hoverTextColor: "#0F172A",
    border: { border: "1px solid #E2E8F0" },
    offsetX: 0,
    offsetY: 3,
  },
  teal: {
    fill: "#0D9488",
    hoverFill: "#0F766E",
    baseColor: "#115E59",
    textColor: "#FFFFFF",
    hoverTextColor: "#FFFFFF",
    offsetX: 0,
    offsetY: 4,
  },
  danger: {
    fill: "#DC2626",
    hoverFill: "#B91C1C",
    baseColor: "#991B1B",
    textColor: "#FFFFFF",
    hoverTextColor: "#FFFFFF",
    offsetX: 0,
    offsetY: 4,
  },
};

/**
 * TactileButton — Botão tátil 3D inspirado no design Originkit
 * com acabamento e paleta de cores oficial do Valida Fácil.
 */
export default function TactileButton(props) {
  const {
    variant = "primary",
    label = "Botão",
    children,
    font,
    showText = true,
    padding = "10px 20px",
    rounded = 12,
    fill: fillProp,
    textColor: textColorProp,
    colors,
    addIcon = false,
    icon = { side: "left", size: 18, type: "symbol", color: "#FFFFFF", symbol: "→" },
    gap = 8,
    border: borderProp,
    hover = {},
    base = {},
    shadowColor: shadowColorLegacy,
    shadowSide: shadowSideLegacy,
    shadowDistance: shadowDistanceLegacy,
    link,
    newTab = false,
    style,
    className = "",
    disabled = false,
    onClick,
    type = "button",
    ...restProps
  } = props;

  const preset = PRESETS[variant] || PRESETS.primary;

  const fill = colors?.fill ?? fillProp ?? preset.fill;
  const textColor = colors?.textColor ?? textColorProp ?? preset.textColor;
  const hoverFill = hover.fill ?? colors?.hoverFill ?? preset.hoverFill;
  const hoverTextColor = hover.textColor ?? colors?.hoverTextColor ?? preset.hoverTextColor;

  const baseColor = base.color ?? shadowColorLegacy ?? preset.baseColor;
  const baseDepth = base.depth ?? shadowDistanceLegacy ?? preset.offsetY ?? 4;
  const dx = Math.round(base.offsetX ?? (shadowSideLegacy === "left" ? -baseDepth : (preset.offsetX ?? 0)));
  const dy = Math.round(base.offsetY ?? baseDepth);
  const border = borderProp ?? preset.border ?? {};

  const scopeRef = useRef(null);
  const [radiusBox, setRadiusBox] = useState({ w: 0, h: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  useIsoLayoutEffect(() => {
    const el = scopeRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => {
      setRadiusBox((prev) =>
        prev.w === el.offsetWidth && prev.h === el.offsetHeight
          ? prev
          : { w: el.offsetWidth, h: el.offsetHeight }
      );
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const getRadius = () => {
    if (typeof rounded === "string") {
      if (rounded === "full" || rounded === "pill") return "9999px";
      if (rounded === "xl") return "12px";
      if (rounded === "2xl") return "16px";
      if (rounded === "lg") return "8px";
      if (rounded.endsWith("px") || rounded.endsWith("%") || rounded.endsWith("rem")) return rounded;
    }
    if (typeof rounded === "number") {
      if (rounded === 100) return "9999px";
      return `${rounded}px`;
    }
    return "12px";
  };
  const radiusPx = getRadius();

  useEffect(() => {
    const release = () => setIsPressed(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
  }, []);

  const iconSymbol = icon.symbol || "→";
  const iconSrc = typeof icon.image === "string" ? icon.image : icon.image?.src || "";
  const isImageIcon = icon.type === "image" && iconSrc;
  const iconSize = icon.size || 18;
  const iconColor = isHovered ? (icon.hoverColor || icon.color || textColor) : (icon.color || textColor);

  const renderedIcon = addIcon ? (
    isImageIcon ? (
      <img
        src={iconSrc}
        alt=""
        aria-hidden
        draggable={false}
        style={{
          width: iconSize,
          height: iconSize,
          objectFit: "contain",
          pointerEvents: "none",
        }}
      />
    ) : (
      <span
        aria-hidden
        style={{
          fontSize: iconSize,
          lineHeight: 1,
          color: iconColor,
          display: "inline-flex",
          alignItems: "center",
          pointerEvents: "none",
          transition: "color 0.15s ease",
        }}
      >
        {iconSymbol}
      </span>
    )
  ) : null;

  const isLink = typeof link === "string" && link.length > 0;
  const Tag = isLink ? "a" : "button";
  const tagProps = isLink
    ? { href: link, target: newTab ? "_blank" : undefined, rel: newTab ? "noopener noreferrer" : undefined }
    : { type, disabled, onClick };

  const currentBg = disabled ? "#94A3B8" : isHovered ? hoverFill : fill;
  const currentTextColor = disabled ? "#F1F5F9" : isHovered ? hoverTextColor : textColor;
  const currentBaseColor = disabled ? "#64748B" : baseColor;

  const isShifted = isPressed && !disabled;
  const isFull = className.includes("w-full");

  return (
    <div
      style={{
        display: isFull ? "block" : "inline-block",
        width: isFull ? "100%" : undefined,
        boxSizing: "border-box",
        paddingTop: Math.max(0, -dy),
        paddingBottom: Math.max(0, dy),
        paddingLeft: Math.max(0, -dx),
        paddingRight: Math.max(0, dx),
        opacity: disabled ? 0.65 : 1,
        ...style,
      }}
      className={className}
    >
      <div
        ref={scopeRef}
        style={{
          position: "relative",
          display: isFull ? "flex" : "inline-flex",
          width: "100%",
          height: "100%",
        }}
      >
        {/* Base 3D fixa */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            transform: `translate(${dx}px, ${dy}px)`,
            borderRadius: radiusPx,
            backgroundColor: currentBaseColor,
            boxSizing: "border-box",
            pointerEvents: "none",
            transition: "background-color 0.15s ease",
            ...border,
          }}
        />

        {/* Tecla / Top Cap */}
        <Tag
          {...tagProps}
          {...restProps}
          onPointerEnter={() => !disabled && setIsHovered(true)}
          onPointerLeave={() => {
            setIsHovered(false);
            setIsPressed(false);
          }}
          onPointerDown={() => !disabled && setIsPressed(true)}
          onPointerUp={() => setIsPressed(false)}
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            padding,
            borderRadius: radiusPx,
            backgroundColor: currentBg,
            color: currentTextColor,
            transform: isShifted ? `translate(${dx}px, ${dy}px)` : "translate(0px, 0px)",
            transition: isShifted
              ? "transform 0.05s ease-out, background-color 0.15s ease, color 0.15s ease"
              : "transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.15s ease, color 0.15s ease",
            cursor: disabled ? "not-allowed" : "pointer",
            boxSizing: "border-box",
            userSelect: "none",
            whiteSpace: "nowrap",
            textAlign: "center",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
            WebkitTapHighlightColor: "transparent",
            ...border,
            ...(font || {}),
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: (renderedIcon && (showText || children)) ? gap : 0,
              flexDirection: icon.side === "right" ? "row-reverse" : "row",
            }}
          >
            {renderedIcon}
            {children ? children : (showText && <span>{label}</span>)}
          </span>
        </Tag>
      </div>
    </div>
  );
}
