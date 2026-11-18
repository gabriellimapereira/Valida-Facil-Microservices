import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import SetPasswordPage from "./SetPasswordPage";
import * as authService from "../services/authService";

vi.mock("../services/authService", () => ({
  validateActionToken: vi.fn(),
  updatePassword: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

describe("SetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra erro de convite inválido quando o token expirou", async () => {
    authService.validateActionToken.mockResolvedValue(false);

    render(
      <MemoryRouter initialEntries={["/definir-senha?token=invite-token"]}>
        <SetPasswordPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Convite expirado ou inválido")).toBeInTheDocument();
    });
  });

  it("com token válido, renderiza 'Defina sua senha' com os campos de senha", async () => {
    authService.validateActionToken.mockResolvedValue(true);

    render(
      <MemoryRouter initialEntries={["/definir-senha?token=invite-token"]}>
        <SetPasswordPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Defina sua senha")).toBeInTheDocument();
    });

    expect(screen.queryByText(/defina sua nova senha/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cadastrar senha e acessar/i })).toBeInTheDocument();
  });

  it("bloqueia quando as senhas não coincidem", async () => {
    authService.validateActionToken.mockResolvedValue(true);

    render(
      <MemoryRouter initialEntries={["/definir-senha?token=invite-token"]}>
        <SetPasswordPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Defina sua senha")).toBeInTheDocument();
    });

    const inputs = screen.getAllByPlaceholderText("••••••••");
    fireEvent.change(inputs[0], { target: { value: "senhaForte123@" } });
    fireEvent.change(inputs[1], { target: { value: "outraSenha123@" } });

    fireEvent.click(screen.getByRole("button", { name: /cadastrar senha e acessar/i }));

    await waitFor(() => {
      expect(screen.getByText("As senhas não coincidem.")).toBeInTheDocument();
    });
    expect(authService.updatePassword).not.toHaveBeenCalled();
  });
});
