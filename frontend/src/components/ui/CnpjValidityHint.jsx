import React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { isValidCnpj } from "../../utils/formatters";

// Feedback em tempo real conforme digita o CNPJ — só aparece depois que a
// pessoa já digitou os 14 dígitos, pra não mostrar "inválido" no meio da
// digitação (o que seria falso alarme).
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
