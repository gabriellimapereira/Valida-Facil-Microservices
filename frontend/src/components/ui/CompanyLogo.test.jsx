import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import CompanyLogo from "./CompanyLogo";

describe("CompanyLogo", () => {
  it("renderiza imagem do logotipo quando logoUrl está presente", () => {
    const company = { name: "Empório Teste", logoUrl: "https://example.com/logo.png" };
    render(<CompanyLogo company={company} size="md" />);

    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/logo.png");
    expect(img).toHaveAttribute("alt", "Logotipo Empório Teste");
  });

  it("renderiza as iniciais da empresa quando não há logotipo", () => {
    const company = { name: "Empório Boa Safra", logoUrl: null };
    render(<CompanyLogo company={company} size="md" />);

    expect(screen.getByText("EB")).toBeInTheDocument();
  });

  it("renderiza as duas primeiras letras quando a empresa tem apenas uma palavra", () => {
    const company = { name: "Valida", logoUrl: null };
    render(<CompanyLogo company={company} size="md" />);

    expect(screen.getByText("VA")).toBeInTheDocument();
  });

  it("troca para iniciais caso a imagem falhe ao carregar (onError)", () => {
    const company = { name: "Padaria Central", logoUrl: "https://broken-url.com/logo.png" };
    render(<CompanyLogo company={company} size="md" />);

    const img = screen.getByRole("img");
    fireEvent.error(img);

    expect(screen.getByText("PC")).toBeInTheDocument();
  });

  it("aplica classes de tamanho corretas", () => {
    const { container } = render(<CompanyLogo company={{ name: "Teste" }} size="xl" />);
    expect(container.firstChild).toHaveClass("w-16");
    expect(container.firstChild).toHaveClass("h-16");
  });
});

