import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BrandLogo from "./BrandLogo";

describe("BrandLogo", () => {
  it("renderiza o logotipo circular com atributos corretos por padrão", () => {
    render(<BrandLogo />);
    const img = screen.getByRole("img", { name: /Valida Fácil/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/logo-circle.png");
    expect(img).toHaveAttribute("width", "36");
    expect(img).toHaveAttribute("height", "36");
  });

  it("suporta variante square e tamanho numérico", () => {
    render(<BrandLogo variant="square" size={48} />);
    const img = screen.getByRole("img", { name: /Valida Fácil/i });
    expect(img).toHaveAttribute("src", "/logo.png");
    expect(img).toHaveAttribute("width", "48");
    expect(img).toHaveAttribute("height", "48");
  });
});
