import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export const MIN_PASSWORD_LENGTH = 8;

export default function PasswordRequirementHint({ value, min = MIN_PASSWORD_LENGTH }) {
  if (!value) return null;
  const isValid = value.length >= min;

  return (
    <p className={`text-xs mt-1 flex items-center gap-1 ${isValid ? "text-teal-600" : "text-red-500"}`}>
      {isValid ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
      {isValid ? `Senha com ${value.length} caracteres.` : `Mínimo de ${min} caracteres (faltam ${min - value.length}).`}
    </p>
  );
}
