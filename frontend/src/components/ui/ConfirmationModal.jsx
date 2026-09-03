import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Trash2, X } from "lucide-react";
import TactileButton from "./TactileButton";

/**
 * ConfirmationModal — Modal de confirmação com a identidade visual do Valida Fácil.
 * Substitui os window.confirm() nativos por uma experiência tátil, elegante e responsiva.
 */
export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirmar ação?",
  description = "Tem certeza que deseja prosseguir com esta ação? Essa alteração não poderá ser desfeita.",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger", // "danger" | "amber" | "primary"
  icon: CustomIcon,
  loading = false,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !loading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const getIconContainer = () => {
    if (CustomIcon) return CustomIcon;

    if (variant === "danger") {
      return (
        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shadow-xs mb-4">
          <Trash2 size={22} className="text-red-600" />
        </div>
      );
    }

    return (
      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-xs mb-4">
        <AlertTriangle size={22} className="text-amber-600" />
      </div>
    );
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => !loading && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-200/80 p-6 sm:p-7 relative select-none overflow-hidden scale-100 transition transform animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        {/* Ícone */}
        {getIconContainer()}

        {/* Título & Descrição */}
        <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-2">
          {title}
        </h3>
        <div className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6">
          {description}
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
          <TactileButton
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
            padding="10px 18px"
            rounded={12}
          >
            {cancelText}
          </TactileButton>

          <TactileButton
            type="button"
            variant={variant}
            onClick={onConfirm}
            disabled={loading}
            className="flex-1"
            padding="10px 18px"
            rounded={12}
          >
            {loading ? "Processando..." : confirmText}
          </TactileButton>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
}

