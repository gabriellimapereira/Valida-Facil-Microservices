import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import StockPage from "./StockPage";

const { mockUseProducts } = vi.hoisted(() => ({
  mockUseProducts: vi.fn(),
}));

vi.mock("../context/ProductContext", () => ({
  useProducts: mockUseProducts,
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

describe("StockPage usability", () => {
  it("uses a dashboard search link as an initial filter and lets the user clear it", async () => {
    mockUseProducts.mockReturnValue({
      products: [
        {
          id: "milk-1",
          name: "Leite Integral",
          code: "LEI-001",
          category: "perecivel",
          price: 5.5,
          quantity: 3,
          minStock: 8,
          expiry: null,
        },
        {
          id: "coffee-1",
          name: "Café Torrado",
          code: "CAF-001",
          category: "outros",
          price: 12,
          quantity: 20,
          minStock: 5,
          expiry: null,
        },
      ],
      addProduct: vi.fn(),
      editProduct: vi.fn(),
      removeProduct: vi.fn(),
      syncProductQuantity: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/estoque?search=Leite%20Integral"]}>
        <StockPage />
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText("Buscar por nome ou código do produto...")).toHaveValue("Leite Integral");
    expect(screen.getByText("1 produto(s) encontrado(s)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpar busca" }));

    expect(screen.getByText("2 produto(s) encontrado(s)")).toBeInTheDocument();
  });
});
