import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./LoginPage";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";

// authService/profileService fazem chamadas de API — substituímos ambos por
// dublês controlados pelo teste.
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

    await user.type(screen.getByLabelText("E-mail corporativo"), "contato@empresa.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "senha-errada");
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciais inválidas.");
    expect(screen.queryByText("Tela do dashboard")).not.toBeInTheDocument();
  });

  it("associa rótulos aos campos e mantém a ordem de foco por teclado", async () => {
    const user = userEvent.setup();

    renderLoginPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /^entrar$/i })).not.toBeDisabled());

    const email = screen.getByLabelText("E-mail corporativo");
    const password = screen.getByLabelText("Senha");
    expect(email).toHaveAttribute("autocomplete", "username");
    expect(password).toHaveAttribute("autocomplete", "current-password");

    email.focus();
    expect(email).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: /esqueci minha senha/i })).toHaveFocus();
    await user.tab();
    expect(password).toHaveFocus();
  });

  it("permite conferir e ocultar a senha usando um controle acessível", async () => {
    const user = userEvent.setup();

    renderLoginPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /^entrar$/i })).not.toBeDisabled());

    const password = screen.getByLabelText("Senha");
    await user.type(password, "senha-segura");
    expect(password).toHaveAttribute("type", "password");

    const showPassword = screen.getByRole("button", { name: "Mostrar senha" });
    await user.click(showPassword);
    expect(password).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar senha" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "Ocultar senha" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("usa validação nativa para não enviar campos obrigatórios vazios", async () => {
    const user = userEvent.setup();

    renderLoginPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /^entrar$/i })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    expect(screen.getByLabelText("E-mail corporativo")).toBeInvalid();
    expect(screen.getByLabelText("Senha")).toBeInvalid();
    expect(authService.login).not.toHaveBeenCalled();
  });
});

describe("LoginPage — esqueci minha senha", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authService.getSessionUser.mockResolvedValue(null);
    authService.onAuthStateChange.mockReturnValue({ unsubscribe: () => {} });
  });

  it("clicar em 'Esqueci minha senha' troca pro formulário de recuperação e envia o e-mail certo", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await waitFor(() => expect(screen.getByRole("button", { name: /^entrar$/i })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: /esqueci minha senha/i }));

    expect(screen.getByText(/esqueceu sua senha\?/i)).toBeInTheDocument();

    const emailInput = screen.getByPlaceholderText("seuemail@empresa.com");
    await user.type(emailInput, "usuario@empresa.com");
    await user.click(screen.getByRole("button", { name: /enviar link de redefinição/i }));

    await waitFor(() => expect(screen.getByText(/verifique seu e-mail/i)).toBeInTheDocument());
    expect(authService.requestPasswordReset).toHaveBeenCalledWith("usuario@empresa.com");
  });

  it("não envia sem preencher o e-mail", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await waitFor(() => expect(screen.getByRole("button", { name: /^entrar$/i })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: /esqueci minha senha/i }));
    await user.click(screen.getByRole("button", { name: /enviar link de redefinição/i }));

    expect(screen.getByLabelText("E-mail cadastrado")).toBeInvalid();
    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("botão 'Voltar para o login' retorna ao formulário original", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await waitFor(() => expect(screen.getByRole("button", { name: /^entrar$/i })).not.toBeDisabled());
    await user.click(screen.getByRole("button", { name: /esqueci minha senha/i }));
    await user.click(screen.getByRole("button", { name: /voltar para o login/i }));

    expect(screen.getByText(/acesse sua conta/i)).toBeInTheDocument();
  });
});

describe("LoginPage — validação de senha mínima", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authService.getSessionUser.mockResolvedValue(null);
    authService.onAuthStateChange.mockReturnValue({ unsubscribe: () => {} });
  });

  it("bloqueia o login com senha curta sem nem chamar o servidor", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await waitFor(() => expect(screen.getByRole("button", { name: /^entrar$/i })).not.toBeDisabled());
    await user.type(screen.getByLabelText("E-mail corporativo"), "teste@empresa.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "1234567"); // 7 caracteres
    await user.click(screen.getByRole("button", { name: /^entrar$/i }));

    expect(await screen.findByText(/pelo menos 8 caracteres/i)).toBeInTheDocument();
    expect(authService.login).not.toHaveBeenCalled();
  });

  it("mostra a dica em tempo real conforme digita", async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await waitFor(() => expect(screen.getByRole("button", { name: /^entrar$/i })).not.toBeDisabled());
    const passwordInput = screen.getByPlaceholderText("••••••••");

    await user.type(passwordInput, "1234567");
    expect(await screen.findByText(/faltam 1/i)).toBeInTheDocument();

    await user.type(passwordInput, "8");
    expect(await screen.findByText(/senha com 8 caracteres/i)).toBeInTheDocument();
  });
});
