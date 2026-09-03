import React from "react";
import ConfirmationModal from "../ui/ConfirmationModal";

export default function ConfirmDeleteModal({ product, onClose, onConfirm, loading = false }) {
  if (!product) return null;

  return (
    <ConfirmationModal
      isOpen={Boolean(product)}
      onClose={onClose}
      onConfirm={onConfirm}
      loading={loading}
      title="Excluir produto?"
      description={
        <>
          Tem certeza que deseja excluir <strong className="text-slate-800 font-semibold">{product.name}</strong>? Essa ação não pode ser desfeita e removerá o item do estoque.
        </>
      }
      confirmText="Excluir produto"
      cancelText="Cancelar"
      variant="danger"
    />
  );
}
