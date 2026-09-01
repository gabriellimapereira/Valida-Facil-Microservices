import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import ProductModal from "./ProductModal";

describe("ProductModal", () => {
  it("valida campos obrigatórios ao submeter formulário vazio", async () => {
    const onSave = vi.fn();
    render(<ProductModal product={null} onClose={vi.fn()} onSave={onSave} />);

    const submitBtn = screen.getByRole("button", { name: /Cadastrar produto/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Informe o nome do produto/i)).toBeInTheDocument();
    expect(screen.getByText(/Informe um código\/ID/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("permite cadastrar novo produto preenchendo os dados válidos", async () => {
    const onSave = vi.fn();
    render(<ProductModal product={null} onClose={vi.fn()} onSave={onSave} />);

    const codeInput = screen.getByPlaceholderText(/Ex: FRT-0012/i);
    fireEvent.change(codeInput, { target: { value: "PROD-999" } });

    const nameInput = screen.getByPlaceholderText(/Ex: Maçã Gala/i);
    fireEvent.change(nameInput, { target: { value: "Uva Thompson" } });

    const priceInput = screen.getByPlaceholderText("0,00");
    fireEvent.change(priceInput, { target: { value: "14.90" } });

    const zeroInputs = screen.getAllByPlaceholderText("0");
    const qtyInput = zeroInputs[0]; // primeiro campo com placeholder 0 é quantidade
    fireEvent.change(qtyInput, { target: { value: "30" } });

    const submitBtn = screen.getByRole("button", { name: /Cadastrar produto/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        code: "PROD-999",
        name: "Uva Thompson",
        category: "perecivel",
        price: 14.9,
        quantity: 30,
        minStock: 0,
        expiry: null,
        supplier: "",
      });
    });
  });

  it("impõe o limite máximo de 1.000.000 no valor do produto", async () => {
    const onSave = vi.fn();
    render(<ProductModal product={null} onClose={vi.fn()} onSave={onSave} />);

    const priceInput = screen.getByPlaceholderText("0,00");
    fireEvent.change(priceInput, { target: { value: "2000000" } });

    // O componente automaticamente corta para 1000000
    expect(priceInput.value).toBe("1000000");
  });

  it("impõe o limite máximo de 1.000.000 na quantidade de produtos", async () => {
    render(<ProductModal product={null} onClose={vi.fn()} onSave={vi.fn()} />);

    const zeroInputs = screen.getAllByPlaceholderText("0");
    const qtyInput = zeroInputs[0];
    fireEvent.change(qtyInput, { target: { value: "5000000" } });

    // O componente corta para 1000000
    expect(qtyInput.value).toBe("1000000");
  });

  it("no modo de edição, desabilita a edição direta do campo quantidade", () => {
    const existing = {
      id: "p1",
      code: "FRT-10",
      name: "Abacaxi Pérola",
      category: "perecivel",
      price: 8.0,
      quantity: 15,
      minStock: 5,
    };
    render(<ProductModal product={existing} onClose={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByText(/Editar produto/i)).toBeInTheDocument();
    const qtyInput = screen.getByDisplayValue("15");
    expect(qtyInput).toBeDisabled();
    expect(
      screen.getByText(/use "Registrar movimentação" na tabela/i)
    ).toBeInTheDocument();
  });
});

