import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { isValidCnpj } from "../../utils/formatters";

export default function CnpjValidityHint({ value }) {
  const digitCount = (value || "").replace(/\D/g, "").length;
  if (digitCount === 0 || digitCount < 14) return null;

  const isValid = isValidCnpj(value);
  return (
    <p className={`text-xs mt-1 flex items-center gap-1 ${isValid ? "text-teal-600" : "text-red-500"}`}>
      {isValid ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
      {isValid ? "CNPJ válido." : "CNPJ inválido — confira os dígitos."}
    </p>
  );
}
