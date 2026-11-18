import React, { createContext, useContext, useEffect, useState } from "react";
import * as productService from "../services/productService";
import { useAuth } from "./AuthContext";

export const ProductContext = createContext(null);

export function ProductProvider({ children }) {
  const { companyId, isAuthenticated } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !companyId) {
      setProducts([]);
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    productService
      .fetchProducts(companyId)
      .then((data) => {
        if (mounted) {
          setProducts(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Erro ao carregar produtos:", err);
        if (mounted) {
          setProducts([]);
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [companyId, isAuthenticated]);

  const addProduct = async (product) => {
    const created = await productService.createProduct({ ...product, companyId });
    setProducts((prev) => [created, ...prev]);
    return created;
  };

  const editProduct = async (id, changes) => {
    const updated = await productService.updateProduct(id, changes);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };

  const removeProduct = async (id) => {
    await productService.deleteProduct(id);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  // Chamado depois de uma movimentação de estoque (POST /movements no
  // backend) — atualiza a quantidade local com o valor confirmado pelo
  // servidor, sem precisar buscar a lista inteira de novo.
  const syncProductQuantity = (id, newQuantity) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, quantity: newQuantity } : p)));
  };

  const refreshProducts = async () => {
    if (!isAuthenticated || !companyId) {
      setProducts([]);
      return [];
    }
    const data = await productService.fetchProducts(companyId);
    setProducts(data);
    return data;
  };

  return (
    <ProductContext.Provider
      value={{ products, loading, addProduct, editProduct, removeProduct, syncProductQuantity, refreshProducts }}
    >
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error("useProducts deve ser usado dentro de <ProductProvider>");
  return ctx;
}
