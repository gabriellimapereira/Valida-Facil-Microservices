import React from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import TactileButton from "../ui/TactileButton";

export default function ConfirmDeleteModal({ product, onClose, onConfirm }) {
  if (!product) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <Trash2 size={20} className="text-red-500" />
        </div>
        <h3 className="font-semibold text-slate-900 mb-1">Excluir produto?</h3>
        <p className="text-sm text-slate-500 mb-6">
          Tem certeza que deseja excluir <span className="font-medium text-slate-700">{product.name}</span>? Essa ação não pode ser desfeita.
        </p>
        <div className="flex items-center gap-3">
          <TactileButton
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            padding="10px 16px"
            rounded={12}
          >
            Cancelar
          </TactileButton>
          <TactileButton
            variant="danger"
            onClick={onConfirm}
            className="flex-1"
            padding="10px 16px"
            rounded={12}
          >
            Excluir
          </TactileButton>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modalContent, document.body) : modalContent;
}
