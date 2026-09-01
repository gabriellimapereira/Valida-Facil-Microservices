import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import ProductFilters from "./ProductFilters";

describe("ProductFilters", () => {
  const defaultFilters = {
    search: "",
    category: "all",
    dateFrom: "",
    dateTo: "",
    sortPrice: "none",
  };

  it("permite digitar na busca e chama setFilters", () => {
    const setFilters = vi.fn();
    render(
      <ProductFilters
        filters={defaultFilters}
        setFilters={setFilters}
        filtersOpen={false}
        setFiltersOpen={vi.fn()}
        activeFilterCount={0}
        clearFilters={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText(/Buscar por nome ou código/i);
    fireEvent.change(input, { target: { value: "Maçã" } });

    expect(setFilters).toHaveBeenCalled();
  });

  it("mostra o botão X para limpar busca quando há termo pesquisado", () => {
    const setFilters = vi.fn();
    render(
      <ProductFilters
        filters={{ ...defaultFilters, search: "Queijo" }}
        setFilters={setFilters}
        filtersOpen={false}
        setFiltersOpen={vi.fn()}
        activeFilterCount={0}
        clearFilters={vi.fn()}
      />
    );

    const clearSearchBtn = screen.getByTitle("Limpar busca");
    expect(clearSearchBtn).toBeInTheDocument();
    fireEvent.click(clearSearchBtn);

    expect(setFilters).toHaveBeenCalled();
  });

  it("mostra chips de filtros ativos e permite limpar todos", () => {
    const clearFilters = vi.fn();
    render(
      <ProductFilters
        filters={{ ...defaultFilters, category: "perecivel", sortPrice: "asc" }}
        setFilters={vi.fn()}
        filtersOpen={false}
        setFiltersOpen={vi.fn()}
        activeFilterCount={2}
        clearFilters={clearFilters}
      />
    );

    expect(screen.getByText(/Filtros ativos:/i)).toBeInTheDocument();
    expect(screen.getByText(/Categoria:/i)).toBeInTheDocument();
    expect(screen.getByText(/Preço: Menor primeiro/i)).toBeInTheDocument();

    const clearAllBtn = screen.getByRole("button", { name: /Limpar todos/i });
    fireEvent.click(clearAllBtn);
    expect(clearFilters).toHaveBeenCalledTimes(1);
  });

  it("alterna visibilidade dos filtros avançados ao clicar no botão", () => {
    const setFiltersOpen = vi.fn();
    render(
      <ProductFilters
        filters={defaultFilters}
        setFilters={vi.fn()}
        filtersOpen={false}
        setFiltersOpen={setFiltersOpen}
        activeFilterCount={0}
        clearFilters={vi.fn()}
      />
    );

    const toggleBtn = screen.getByRole("button", { name: /Filtros avançados/i });
    fireEvent.click(toggleBtn);
    expect(setFiltersOpen).toHaveBeenCalled();
  });
});

