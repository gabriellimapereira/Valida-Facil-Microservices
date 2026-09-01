import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import ProductTable from "./ProductTable";

describe("ProductTable", () => {
  const mockProducts = [
    {
      id: "prod-1",
      code: "FRT-001",
      name: "Maçã Fuji",
      category: "perecivel",
      price: 9.5,
      quantity: 50,
      minStock: 10,
      expiry: "2026-12-31",
    },
    {
      id: "prod-2",
      code: "LCT-002",
      name: "Leite Integral",
      category: "perecivel",
      price: 5.2,
      quantity: 4,
      minStock: 10,
      expiry: "2026-08-30",
    },
  ];

  it("renderiza a lista de produtos com colunas corretas", () => {
    render(
      <ProductTable
        items={mockProducts}
        page={1}
        totalPages={1}
        totalCount={2}
        pageSize={10}
        setPage={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onMovement={vi.fn()}
      />
    );

    expect(screen.getAllByText("Maçã Fuji")[0]).toBeInTheDocument();
    expect(screen.getAllByText("FRT-001")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Leite Integral")[0]).toBeInTheDocument();
  });

  it("dispara callbacks de movimentação, edição e exclusão", () => {
    const onMovement = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <ProductTable
        items={mockProducts}
        page={1}
        totalPages={1}
        totalCount={2}
        pageSize={10}
        setPage={vi.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
        onMovement={onMovement}
      />
    );

    const moveBtns = screen.getAllByTitle(/Registrar movimentação/i);
    fireEvent.click(moveBtns[0]);
    expect(onMovement).toHaveBeenCalledWith(mockProducts[0]);

    const editBtns = screen.getAllByTitle(/Editar detalhes do produto/i);
    fireEvent.click(editBtns[0]);
    expect(onEdit).toHaveBeenCalledWith(mockProducts[0]);

    const deleteBtns = screen.getAllByTitle(/Excluir produto/i);
    fireEvent.click(deleteBtns[0]);
    expect(onDelete).toHaveBeenCalledWith(mockProducts[0]);
  });

  it("renderiza estado vazio quando não há itens", () => {
    render(
      <ProductTable
        items={[]}
        page={1}
        totalPages={1}
        totalCount={0}
        pageSize={10}
        setPage={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onMovement={vi.fn()}
      />
    );

    expect(screen.getAllByText(/Nenhum produto encontrado/i)[0]).toBeInTheDocument();
  });
});

