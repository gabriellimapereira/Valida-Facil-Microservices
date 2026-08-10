import React, { createContext, useContext, useEffect, useState } from "react";
import * as productService from "../services/productService";

const ProductContext = createContext(null);

const DEMO_COMPANY_ID = "company-demo-1";

export function ProductProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    productService.fetchProducts(DEMO_COMPANY_ID).then((data) => {
      setProducts(data);
      setLoading(false);
    });
  }, []);

  const addProduct = async (product) => {
    const created = await productService.createProduct({ ...product, companyId: DEMO_COMPANY_ID });
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

  return (
    <ProductContext.Provider value={{ products, loading, addProduct, editProduct, removeProduct }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error("useProducts deve ser usado dentro de <ProductProvider>");
  return ctx;
}
