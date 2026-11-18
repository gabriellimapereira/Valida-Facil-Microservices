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

  it("permite vincular o operador a uma filial específica quando há lojas", async () => {
    const onInvite = vi.fn().mockResolvedValue({ success: true });
    render(
      <InviteMemberModal
        onClose={vi.fn()}
        onInvite={onInvite}
        stores={[
          { id: "store-1", name: "Filial Centro", code: "CENTRO-01" },
          { id: "store-2", name: "Filial Norte", code: "NORTE-02" },
        ]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Ex: João Pedro Santos/i), {
      target: { value: "Jorge Miguel" },
    });
    fireEvent.change(screen.getByPlaceholderText(/colaborador@suaempresa.com/i), {
      target: { value: "jorge@empresa.com" },
    });

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "store-2" } });

    fireEvent.click(screen.getByRole("button", { name: /Enviar convite/i }));

    await waitFor(() => {
      expect(onInvite).toHaveBeenCalledWith({
        fullName: "Jorge Miguel",
        email: "jorge@empresa.com",
        role: "operador",
        storeId: "store-2",
      });
    });
  });
});

