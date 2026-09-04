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

  it("bloqueia a seleção de dataTo se for anterior a dateFrom", () => {
    const setFilters = vi.fn();
    render(
      <ProductFilters
        filters={{ ...defaultFilters, dateFrom: "2026-09-15" }}
        setFilters={setFilters}
        filtersOpen={true}
        setFiltersOpen={vi.fn()}
        activeFilterCount={1}
        clearFilters={vi.fn()}
      />
    );

    // Abre o DatePicker de 'Validade – até'
    const triggers = screen.getAllByText("dd/mm/aaaa");
    fireEvent.click(triggers[0]);

    // O dia 10 de setembro (anterior a 15/09/2026) deve estar desabilitado
    const day10Buttons = screen.getAllByRole("button", { name: "10" });
    const disabledDay10 = day10Buttons.find((btn) => btn.disabled);
    expect(disabledDay10).toBeDefined();

    fireEvent.click(disabledDay10);
    expect(setFilters).not.toHaveBeenCalled();
  });

  it("limpa dateTo automaticamente caso o usuário selecione um dateFrom posterior", () => {
    let currentFilters = { ...defaultFilters, dateFrom: "2026-09-10", dateTo: "2026-09-15" };
    const setFilters = vi.fn((updater) => {
      if (typeof updater === "function") {
        currentFilters = updater(currentFilters);
      }
    });

    render(
      <ProductFilters
        filters={currentFilters}
        setFilters={setFilters}
        filtersOpen={true}
        setFiltersOpen={vi.fn()}
        activeFilterCount={2}
        clearFilters={vi.fn()}
      />
    );

    // Clica no trigger de dateFrom (10/09/2026)
    const fromTrigger = screen.getByText("10/09/2026");
    fireEvent.click(fromTrigger);

    // Clica no dia 20 (posterior a 15/09/2026)
    const day20Buttons = screen.getAllByRole("button", { name: "20" });
    const enabledDay20 = day20Buttons.find((btn) => !btn.disabled);
    expect(enabledDay20).toBeDefined();

    fireEvent.click(enabledDay20);

    expect(setFilters).toHaveBeenCalled();
    expect(currentFilters.dateFrom).toBe("2026-09-20");
    expect(currentFilters.dateTo).toBe("");
  });
});

