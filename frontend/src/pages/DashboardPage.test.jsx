import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import DashboardPage from "./DashboardPage";

const { mockUseProducts, mockUseCompany } = vi.hoisted(() => ({
  mockUseProducts: vi.fn(),
  mockUseCompany: vi.fn(),
}));

vi.mock("../context/ProductContext", () => ({
  useProducts: mockUseProducts,
}));

vi.mock("../context/CompanyContext", () => ({
  useCompany: mockUseCompany,
}));

function LocationSearch() {
  const { search } = useLocation();
  return <output>{search}</output>;
}

describe("DashboardPage usability", () => {
  it("allows keyboard users to open an expiring product in a pre-filtered stock list", async () => {
    const user = userEvent.setup();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const expiry = tomorrow.toISOString().slice(0, 10);

    mockUseProducts.mockReturnValue({
      products: [{
        id: "milk-1",
        name: "Leite Integral",
        code: "LEI-001",
        category: "perecivel",
        price: 5.5,
        quantity: 3,
        minStock: 8,
        expiry,
      }],
    });
    mockUseCompany.mockReturnValue({ company: { name: "Mercado Central" } });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/estoque" element={<LocationSearch />} />
        </Routes>
      </MemoryRouter>
    );

    const locateProduct = screen.getAllByRole("button", { name: "Localizar Leite Integral no estoque" })[0];
    locateProduct.focus();
    expect(locateProduct).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("?search=Leite%20Integral")).toBeInTheDocument();
  });
});
