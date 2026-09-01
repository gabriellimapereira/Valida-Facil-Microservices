import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import NotFoundPage from "./NotFoundPage";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("NotFoundPage", () => {
  it("renderiza os elementos visuais da página 404", () => {
    render(
      <BrowserRouter>
        <NotFoundPage />
      </BrowserRouter>
    );

    expect(screen.getByText("Erro 404")).toBeInTheDocument();
    expect(screen.getByText("Página não encontrada")).toBeInTheDocument();
    expect(
      screen.getByText(/O endereço que você tentou acessar não existe/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Ir para o Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Voltar página")).toBeInTheDocument();
  });

  it("navega para o dashboard ao clicar no botão principal", () => {
    render(
      <BrowserRouter>
        <NotFoundPage />
      </BrowserRouter>
    );

    const dashBtn = screen.getByRole("button", { name: /Ir para o Dashboard/i });
    fireEvent.click(dashBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
  });

  it("chama navigate(-1) ao clicar no botão voltar", () => {
    render(
      <BrowserRouter>
        <NotFoundPage />
      </BrowserRouter>
    );

    const backBtn = screen.getByRole("button", { name: /Voltar página/i });
    fireEvent.click(backBtn);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });
});

