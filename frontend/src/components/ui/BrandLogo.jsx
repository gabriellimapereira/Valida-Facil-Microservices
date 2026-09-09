import React from "react";

const SIZES = {
  xs: 24,
  sm: 28,
  md: 36,
  lg: 42,
  xl: 48,
  "2xl": 56,
};

export default function BrandLogo({
  size = "md",
  variant = "circle",
  className = "",
  alt = "Valida Fácil",
  ...props
}) {
  const pixelSize = typeof size === "number" ? size : SIZES[size] || 36;
  const src = variant === "square" ? "/logo.png" : "/logo-circle.png";

  return (
    <img
      src={src}
      alt={alt}
      width={pixelSize}
      height={pixelSize}
      className={"object-contain select-none shrink-0 transition-transform " + className}
      style={{
        width: `${pixelSize}px`,
        height: `${pixelSize}px`,
      }}
      loading="eager"
      decoding="async"
      {...props}
    />
  );
}
