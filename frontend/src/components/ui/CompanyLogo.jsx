import React, { useState } from "react";

const SIZES = {
  sm: "w-8 h-8 rounded-full text-xs",
  md: "w-9 h-9 rounded-full text-xs",
  lg: "w-12 h-12 rounded-xl text-base",
  xl: "w-16 h-16 rounded-2xl text-xl",
};

export default function CompanyLogo({
  company,
  size = "md",
  className = "",
  bgClass = "bg-navy",
}) {
  const [imgError, setImgError] = useState(false);

  const sizeClass = SIZES[size] || SIZES.md;
  const hasLogo = Boolean(company?.logoUrl) && !imgError;

  if (hasLogo) {
    return (
      <div
        className={`${sizeClass} overflow-hidden shrink-0 border border-slate-200/80 bg-white flex items-center justify-center shadow-sm ${className}`}
      >
        <img
          src={company.logoUrl}
          alt={company?.name || "Logotipo da empresa"}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} ${bgClass} text-white flex items-center justify-center font-bold shrink-0 select-none shadow-sm ${className}`}
    >
      {company?.initials || company?.name?.slice(0, 2)?.toUpperCase() || "VF"}
    </div>
  );
}

