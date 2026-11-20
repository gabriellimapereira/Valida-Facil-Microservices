import React from "react";

export default function CharCounter({ value, max }) {
  const length = value?.length || 0;
  const isNearLimit = max > 0 && length >= max * 0.9;

  return (
    <p className={`text-xs mt-1 text-right ${isNearLimit ? "text-amber-600 font-medium" : "text-slate-400"}`}>
      {length}/{max}
    </p>
  );
}
