import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import MovementModal from "./MovementModal";

describe("MovementModal", () => {
  const mockProduct = {
    id: "prod-1",
    name: "Café Especial 500g",
    code: "CFE-01",
    quantity: 20,
    minStock: 5,
  };

  it("calcula previsão de estoque para entrada", () => {
    render(<MovementModal product={mockProduct} onClose={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getAllByText("20 un.").length).toBeGreaterThanOrEqual(1);

    const amountInput = screen.getByPlaceholderText("0");
    fireEvent.change(amountInput, { target: { value: "10" } });

    // Novo estoque previsto: 20 + 10 = 30
    expect(screen.getByText("30 un.")).toBeInTheDocument();
  });

  it("calcula previsão de estoque para saída", () => {
    render(<MovementModal product={mockProduct} onClose={vi.fn()} onSubmit={vi.fn()} />);

    const saidaBtn = screen.getByRole("button", { name: /Saída/i });
    fireEvent.click(saidaBtn);

    const amountInput = screen.getByPlaceholderText("0");
    fireEvent.change(amountInput, { target: { value: "5" } });

    // Novo estoque previsto: 20 - 5 = 15
    expect(screen.getByText("15 un.")).toBeInTheDocument();
  });

  it("impede saída superior ao estoque atual", async () => {
    const onSubmit = vi.fn();
    render(<MovementModal product={mockProduct} onClose={vi.fn()} onSubmit={onSubmit} />);

    const saidaBtn = screen.getByRole("button", { name: /Saída/i });
    fireEvent.click(saidaBtn);

    const amountInput = screen.getByPlaceholderText("0");
    fireEvent.change(amountInput, { target: { value: "25" } });

    const submitBtn = screen.getByRole("button", { name: /Registrar movimentação/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Quantidade insuficiente em estoque/i)).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("limita a quantidade digitada a no máximo 1.000.000 unidades", () => {
    render(<MovementModal product={mockProduct} onClose={vi.fn()} onSubmit={vi.fn()} />);

    const amountInput = screen.getByPlaceholderText("0");
    fireEvent.change(amountInput, { target: { value: "9999999" } });

    expect(amountInput.value).toBe("1000000");
  });

  it("envia payload correto no submit", async () => {
    const onSubmit = vi.fn().mockResolvedValue({ success: true });
    render(<MovementModal product={mockProduct} onClose={vi.fn()} onSubmit={onSubmit} />);

    const amountInput = screen.getByPlaceholderText("0");
    fireEvent.change(amountInput, { target: { value: "10" } });

    const noteInput = screen.getByPlaceholderText(/Ex: NF 12345/i);
    fireEvent.change(noteInput, { target: { value: "Reposição lote novo" } });

    const submitBtn = screen.getByRole("button", { name: /Registrar movimentação/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        movementType: "entrada",
        quantityDelta: 10,
        note: "Reposição lote novo",
      });
    });
  });

  it("não exibe a opção de ajuste, contendo apenas Entrada e Saída", () => {
    render(<MovementModal product={mockProduct} onClose={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Entrada/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Saída/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ajuste/i })).not.toBeInTheDocument();
  });

  it("permite alterar a quantidade através dos botões de sobe e desce", () => {
    render(<MovementModal product={mockProduct} onClose={vi.fn()} onSubmit={vi.fn()} />);

    const incBtn = screen.getByRole("button", { name: /Aumentar quantidade/i });
    const decBtn = screen.getByRole("button", { name: /Diminuir quantidade/i });
    const amountInput = screen.getByPlaceholderText("0");

    // Começa vazio, botão de diminuir deve estar desabilitado
    expect(decBtn).toBeDisabled();

    // Clica para aumentar
    fireEvent.click(incBtn);
    expect(amountInput.value).toBe("1");
    expect(decBtn).not.toBeDisabled();

    fireEvent.click(incBtn);
    expect(amountInput.value).toBe("2");

    // Clica para diminuir
    fireEvent.click(decBtn);
    expect(amountInput.value).toBe("1");

    fireEvent.click(decBtn);
    expect(amountInput.value).toBe("");
    expect(decBtn).toBeDisabled();
  });

  it("permite alterar quantidade usando as setas do teclado (ArrowUp / ArrowDown)", () => {
    render(<MovementModal product={mockProduct} onClose={vi.fn()} onSubmit={vi.fn()} />);

    const amountInput = screen.getByPlaceholderText("0");

    fireEvent.keyDown(amountInput, { key: "ArrowUp" });
    expect(amountInput.value).toBe("1");

    fireEvent.keyDown(amountInput, { key: "ArrowUp" });
    expect(amountInput.value).toBe("2");

    fireEvent.keyDown(amountInput, { key: "ArrowDown" });
    expect(amountInput.value).toBe("1");
  });
});

