import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import InviteMemberModal from "./InviteMemberModal";

describe("InviteMemberModal", () => {
  it("valida campos obrigatórios ao enviar formulário vazio", async () => {
    const onInvite = vi.fn();
    render(<InviteMemberModal onClose={vi.fn()} onInvite={onInvite} />);

    const submitBtn = screen.getByRole("button", { name: /Enviar convite/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Informe o nome completo do colaborador/i)).toBeInTheDocument();
    expect(onInvite).not.toHaveBeenCalled();
  });

  it("envia dados corretos ao preencher o formulário", async () => {
    const onInvite = vi.fn().mockResolvedValue({ success: true });
    render(<InviteMemberModal onClose={vi.fn()} onInvite={onInvite} />);

    const nameInput = screen.getByPlaceholderText(/Ex: João Pedro Santos/i);
    fireEvent.change(nameInput, { target: { value: "Mariana Souza" } });

    const emailInput = screen.getByPlaceholderText(/colaborador@suaempresa.com/i);
    fireEvent.change(emailInput, { target: { value: "mariana@suaempresa.com" } });

    const submitBtn = screen.getByRole("button", { name: /Enviar convite/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onInvite).toHaveBeenCalledWith({
        fullName: "Mariana Souza",
        email: "mariana@suaempresa.com",
        role: "operador",
      });
    });
  });
});

