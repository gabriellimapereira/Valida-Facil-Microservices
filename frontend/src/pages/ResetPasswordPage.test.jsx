import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ResetPasswordPage from "./ResetPasswordPage";
import { ToastProvider } from "../context/ToastContext";

vi.mock("../services/authService", () => ({
  getSessionUser: vi.fn(),
  updatePassword: vi.fn(),
  logout: vi.fn().mockResolvedValue(true),
  onAuthStateChange: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
}));

import * as authService from "../services/authService";

function renderPage() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/redefinir-senha"]}>
        <Routes>
          <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
          <Route path="/login" element={<div>Tela de login</div>} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra erro de link inválido quando não há sessão de recuperação", async () => {
    authService.getSessionUser.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByText(/link inválido ou expirado/i)).toBeInTheDocument();
  });

  it("com sessão de recuperação válida, permite definir a nova senha", async () => {
    authService.getSessionUser.mockResolvedValue({ id: "user-1", email: "a@empresa.com" });
    authService.updatePassword.mockResolvedValue(true);
    const user = userEvent.setup();

    renderPage();

    await waitFor(() => expect(screen.getByText(/defina sua nova senha/i)).toBeInTheDocument());

    const [newPw, confirmPw] = screen.getAllByPlaceholderText("••••••••");
    await user.type(newPw, "senhaNova123");
    await user.type(confirmPw, "senhaNova123");
    await user.click(screen.getByRole("button", { name: /salvar nova senha/i }));

    await waitFor(() => expect(screen.getByText(/senha alterada/i)).toBeInTheDocument());
    expect(authService.updatePassword).toHaveBeenCalledWith("senhaNova123");
    expect(authService.logout).toHaveBeenCalled();
  });

  it("bloqueia senha curta antes de chamar o backend", async () => {
    authService.getSessionUser.mockResolvedValue({ id: "user-1", email: "a@empresa.com" });
    const user = userEvent.setup();

    renderPage();
    await waitFor(() => expect(screen.getByText(/defina sua nova senha/i)).toBeInTheDocument());

    const [newPw, confirmPw] = screen.getAllByPlaceholderText("••••••••");
    await user.type(newPw, "123");
    await user.type(confirmPw, "123");
    await user.click(screen.getByRole("button", { name: /salvar nova senha/i }));

    expect(await screen.findByText(/a nova senha deve ter pelo menos 8 caracteres/i)).toBeInTheDocument();
    expect(authService.updatePassword).not.toHaveBeenCalled();
  });

  it("bloqueia quando as senhas não coincidem", async () => {
    authService.getSessionUser.mockResolvedValue({ id: "user-1", email: "a@empresa.com" });
    const user = userEvent.setup();

    renderPage();
    await waitFor(() => expect(screen.getByText(/defina sua nova senha/i)).toBeInTheDocument());

    const [newPw, confirmPw] = screen.getAllByPlaceholderText("••••••••");
    await user.type(newPw, "senhaNova123");
    await user.type(confirmPw, "outraSenha456");
    await user.click(screen.getByRole("button", { name: /salvar nova senha/i }));

    expect(await screen.findByText("As senhas não coincidem.")).toBeInTheDocument();
    expect(authService.updatePassword).not.toHaveBeenCalled();
  });
});
