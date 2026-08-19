import React from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useToast } from "../../context/ToastContext";

export default function ToastStack() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 w-[320px] max-w-[90vw]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm animate-[fadeIn_.2s_ease] ${
            t.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-white border-teal-200 text-slate-700"
          }`}
        >
          {t.type === "error" ? (
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
          ) : (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-teal-600" />
          )}
          <p className="flex-1 leading-snug">{t.message}</p>
          <button onClick={() => removeToast(t.id)} className="text-slate-400 hover:text-slate-600">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}
