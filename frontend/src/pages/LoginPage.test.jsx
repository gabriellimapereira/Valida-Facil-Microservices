import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./LoginPage";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";

// authService/profileService são os únicos pontos que tocariam o Supabase
// de verdade — substituímos os dois por dublês controlados pelo teste.
vi.mock("../services/authService", () => ({
  getSessionUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  login: vi.fn(),
  logout: vi.fn().mockResolvedValue(true),
  requestPasswordReset: vi.fn().mockResolvedValue(true),
}));

vi.mock("../services/profileService", () => ({
  fetchProfile: vi.fn(),
}));

import * as authService from "../services/authService";
import * as profileService from "../services/profileService";

function renderLoginPage() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>Tela do dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simula "sem sessão salva" — o app começa deslogado, mostrando o form.
    authService.getSessionUser.mockResolvedValue(null);
    authService.onAuthStateChange.mockReturnValue({ unsubscribe: () => {} });
  });

  it("faz login com sucesso e navega para o dashboard", async () => {
    authService.login.mockResolvedValue({ id: "user-1", email: "contato@empresa.com" });
    profileService.fetchProfile.mockResolvedValue({
      company_id: "company-1",
      role: "admin",
      full_name: "Teste",
    });
    const user = userEvent.setup();

    renderLoginPage();

    // Espera a checagem de sessão inicial terminar (botão sai de "Entrando...")
    await waitFor(() => expect(screen.getByRole("button", { name: /^entrar$/i })).not.toBeDisabled());

    const emailInput = screen.getByPlaceholderText("seuemail@empresa.com");
    await user.clear(emailInput);
    await user.type(emailInput, "contato@empresa.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "senha-123");
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    await waitFor(() => expect(screen.getByText("Tela do dashboard")).toBeInTheDocument());
    expect(authService.login).toHaveBeenCalledWith("contato@empresa.com", "senha-123");
  });

  it("mostra mensagem de erro quando as credenciais estão erradas, sem navegar", async () => {
    authService.login.mockRejectedValue(new Error("Credenciais inválidas."));
    const user = userEvent.setup();

    renderLoginPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /^entrar$/i })).not.toBeDisabled());

    await user.type(screen.getByPlaceholderText("••••••••"), "senha-errada");
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    expect(await screen.findByText("Credenciais inválidas.")).toBeInTheDocument();
    expect(screen.queryByText("Tela do dashboard")).not.toBeInTheDocument();
  });

  it("não deixa enviar o formulário sem preencher e-mail ou senha", async () => {
    authService.login.mockRejectedValue(new Error("Informe usuário/e-mail e senha para continuar."));
    const user = userEvent.setup();

    renderLoginPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /^entrar$/i })).not.toBeDisabled());

    // Limpa o e-mail pré-preenchido e tenta enviar sem senha.
    await user.clear(screen.getByPlaceholderText("seuemail@empresa.com"));
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    expect(await screen.findByText(/informe usuário\/e-mail e senha/i)).toBeInTheDocument();
  });
});
