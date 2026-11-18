import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const mockAuthState = { role: "admin", storeId: null };
const mockRefreshProducts = vi.fn().mockResolvedValue([]);
const mockAddToast = vi.fn();

const mockFetchRequisitions = vi.fn();
const mockUpdateRequisitionStatus = vi.fn();
const mockFetchStores = vi.fn();

vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockAuthState,
}));

vi.mock("../context/ProductContext", () => ({
  useProducts: () => ({
    products: [{ id: "p1", code: "LAT-01", name: "Leite", quantity: 100 }],
    refreshProducts: mockRefreshProducts,
  }),
}));

vi.mock("../context/ToastContext", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock("../services/requisitionService", () => ({
  fetchRequisitions: (...args) => mockFetchRequisitions(...args),
  createRequisition: vi.fn(),
  updateRequisitionStatus: (...args) => mockUpdateRequisitionStatus(...args),
  fetchWarehouseAvailability: vi.fn().mockResolvedValue([]),
}));

vi.mock("../services/storeService", () => ({
  fetchStores: (...args) => mockFetchStores(...args),
}));

import RequisitionsPage from "./RequisitionsPage";

beforeEach(() => {
  mockAuthState.role = "admin";
  mockAuthState.storeId = null;
  mockRefreshProducts.mockClear();
  mockAddToast.mockClear();
  mockFetchRequisitions.mockReset();
  mockUpdateRequisitionStatus.mockReset();
  mockFetchStores.mockReset();
  mockFetchStores.mockResolvedValue([{ id: "store-1", name: "Filial Centro", code: "C01" }]);
});

describe("RequisitionsPage (Workflow & SAGA)", () => {
  it("permite ao Admin ajustar quantidades aprovadas e despachar/estornar com compensação SAGA", async () => {
    const reqPendente = {
      id: "req-1",
      storeId: "store-1",
      storeName: "Filial Centro",
      requestedByName: "Jorge Miguel",
      status: "pendente",
      createdAt: "2026-11-10T10:00:00Z",
      items: [
        {
          id: "it-1",
          productId: "p1",
          productCode: "LAT-01",
          productName: "Leite Integral",
          expiry: null,
          quantityRequested: 20,
          quantityApproved: null,
        },
      ],
    };

    mockFetchRequisitions.mockResolvedValue([reqPendente]);
    mockUpdateRequisitionStatus
      .mockResolvedValueOnce({
        ...reqPendente,
        status: "aprovada",
        items: [{ ...reqPendente.items[0], quantityApproved: 12 }],
      })
      .mockResolvedValueOnce({
        ...reqPendente,
        status: "despachada",
        items: [{ ...reqPendente.items[0], quantityApproved: 12 }],
      })
      .mockResolvedValueOnce({
        ...reqPendente,
        status: "cancelada",
        items: [{ ...reqPendente.items[0], quantityApproved: 12 }],
      });

    render(<RequisitionsPage />);

    await waitFor(() => expect(screen.getByText("Leite Integral")).toBeInTheDocument());

    // Admin ajusta quantidade para 12
    fireEvent.click(screen.getByRole("button", { name: /Ajustar Qtds/i }));
    const qtyInput = screen.getByLabelText(/Quantidade aprovada de Leite Integral/i);
    fireEvent.change(qtyInput, { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar Aprovação/i }));

    await waitFor(() => {
      expect(mockUpdateRequisitionStatus).toHaveBeenCalledWith("req-1", {
        status: "aprovada",
        itemsApproved: [{ productId: "p1", quantityApproved: 12 }],
      });
    });

    // Admin despacha do armazém (SAGA)
    fireEvent.click(screen.getByRole("button", { name: /Despachar do Armazém/i }));
    await waitFor(() => {
      expect(mockUpdateRequisitionStatus).toHaveBeenCalledWith("req-1", {
        status: "despachada",
        itemsApproved: undefined,
      });
      expect(mockRefreshProducts).toHaveBeenCalledTimes(1);
    });

    // Admin estorna despacho -> abre ConfirmationModal com compensação SAGA
    fireEvent.click(screen.getByRole("button", { name: /Estornar Despacho/i }));
    expect(screen.getByText(/compensação SAGA/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Estornar e Cancelar/i }));

    await waitFor(() => {
      expect(mockUpdateRequisitionStatus).toHaveBeenCalledWith("req-1", {
        status: "cancelada",
        itemsApproved: undefined,
      });
      expect(mockRefreshProducts).toHaveBeenCalledTimes(2);
    });
  });

  it("restringe confirmação de recebimento quando operador pertence a outra filial", async () => {
    mockAuthState.role = "operador";
    mockAuthState.storeId = "store-2";

    mockFetchRequisitions.mockResolvedValue([
      {
        id: "req-other",
        storeId: "store-1",
        storeName: "Filial Centro",
        requestedByName: "Outro",
        status: "despachada",
        createdAt: "2026-11-10T10:00:00Z",
        items: [{ id: "i1", productId: "p1", productName: "Arroz", quantityRequested: 5, quantityApproved: 5 }],
      },
    ]);

    render(<RequisitionsPage />);
    await waitFor(() => expect(screen.getByText("Arroz")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Confirmar Recebimento na Loja/i })).not.toBeInTheDocument();
  });
});
