import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import ConfirmationModal from "./ConfirmationModal";

describe("ConfirmationModal", () => {
  it("não renderiza nada quando isOpen for falso", () => {
    render(
      <ConfirmationModal
        isOpen={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Deseja excluir?"
      />
    );
    expect(screen.queryByText("Deseja excluir?")).not.toBeInTheDocument();
  });

  it("renderiza título, descrição e botões quando isOpen for verdadeiro", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmationModal
        isOpen={true}
        onClose={onClose}
        onConfirm={onConfirm}
        title="Remover colaborador da equipe?"
        description="Tem certeza que deseja prosseguir?"
        confirmText="Sim, remover"
        cancelText="Voltar"
      />
    );

    expect(screen.getByText("Remover colaborador da equipe?")).toBeInTheDocument();
    expect(screen.getByText("Tem certeza que deseja prosseguir?")).toBeInTheDocument();
    expect(screen.getByText("Sim, remover")).toBeInTheDocument();
    expect(screen.getByText("Voltar")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Sim, remover"));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText("Voltar"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

