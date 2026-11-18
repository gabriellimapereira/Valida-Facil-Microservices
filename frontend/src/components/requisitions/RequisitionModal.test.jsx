import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const mockFetchWarehouseAvailability = vi.fn();

vi.mock("../../services/requisitionService", () => ({
  fetchWarehouseAvailability: (...args) => mockFetchWarehouseAvailability(...args),
}));

import RequisitionModal from "./RequisitionModal";

const STORES = [
  { id: "store-1", name: "Filial Centro", code: "CENTRO-01" },
  { id: "store-2", name: "Filial Shopping", code: "SHOP-02" },
];

const PRODUCTS = [
  { id: "p1", code: "LAT-01", name: "Leite Integral", quantity: 50, expiry: "2026-12-20" },
  { id: "p2", code: "PAO-02", name: "Pão Integral", quantity: 30, expiry: "2026-11-15" },
];

beforeEach(() => {
  mockFetchWarehouseAvailability.mockReset();
  mockFetchWarehouseAvailability.mockResolvedValue([
    { id: "p2", code: "PAO-02", name: "Pão Integral", quantity: 30, expiry: "2026-11-15", expiryStatus: "critico" },
    { id: "p1", code: "LAT-01", name: "Leite Integral", quantity: 50, expiry: "2026-12-20", expiryStatus: "atencao" },
  ]);
});

describe("RequisitionModal", () => {
  it("fixa a filial do operador quando userStoreId está definido e permite quantidade > 1.000.000", async () => {
    const onSave = vi.fn().mockResolvedValue({});
    render(
      <RequisitionModal
        stores={STORES}
        products={PRODUCTS}
        userStoreId="store-2"
        role="operador"
        onClose={vi.fn()}
        onSave={onSave}
      />
    );

    await waitFor(() => expect(mockFetchWarehouseAvailability).toHaveBeenCalled());

    const selects = screen.getAllByRole("combobox");
    const storeSelect = selects[0];
    expect(storeSelect.value).toBe("store-2");
    expect(storeSelect.disabled).toBe(true);

    const qtyInput = screen.getByPlaceholderText("Qtd");
    fireEvent.change(qtyInput, { target: { value: "2500000" } });

    fireEvent.click(screen.getByRole("button", { name: /Emitir Requisição/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        storeId: "store-2",
        notes: null,
        items: [{ productId: "p2", quantityRequested: 2500000 }],
      });
    });
  });

  it("evita duplicação de produtos ao adicionar itens", async () => {
    render(
      <RequisitionModal
        stores={STORES}
        products={PRODUCTS}
        role="admin"
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );

    await waitFor(() => expect(mockFetchWarehouseAvailability).toHaveBeenCalled());

    const addBtn = screen.getByRole("button", { name: /Adicionar Item/i });
    fireEvent.click(addBtn);

    const selects = screen.getAllByRole("combobox");
    // selects[0] = loja, selects[1] = primeiro produto (p2), selects[2] = segundo produto (p1)
    expect(selects).toHaveLength(3);
    expect(selects[1].value).toBe("p2");
    expect(selects[2].value).toBe("p1");
    expect(addBtn.disabled).toBe(true);
  });
});
