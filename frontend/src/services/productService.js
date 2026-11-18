// Camada de acesso a dados de produtos. Faz a "tradução" entre o formato
// do banco (snake_case: min_stock, company_id) e o formato usado no resto
// do front (camelCase: minStock) — assim nenhum componente precisa saber
// como a coluna se chama no Postgres.

import { apiClient, getAccessToken } from "../lib/apiClient";
import { MOCK_PRODUCTS } from "../data/mockData";

let memoryProducts = [...MOCK_PRODUCTS];

function fromDb(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    quantity: row.quantity,
    minStock: row.min_stock,
    expiry: row.expiry,
    supplier: row.supplier,
  };
}

const FIELD_TO_COLUMN = {
  code: "code",
  name: "name",
  category: "category",
  price: "price",
  quantity: "quantity",
  minStock: "min_stock",
  expiry: "expiry",
  supplier: "supplier",
};

function toDb(fields) {
  const payload = {};
  for (const [key, value] of Object.entries(fields)) {
    const column = FIELD_TO_COLUMN[key];
    if (column && value !== undefined) payload[column] = value;
  }
  return payload;
}

export async function fetchProducts(companyId) {
  if (!getAccessToken()) {
    return Promise.resolve([...memoryProducts]);
  }
  if (!companyId) return [];
  return (await apiClient.get("/products")).map(fromDb);
}

export async function createProduct(product) {
  if (!getAccessToken()) {
    const nextId = String(Date.now());
    const created = { id: nextId, ...product };
    memoryProducts = [created, ...memoryProducts];
    return Promise.resolve(created);
  }

  return fromDb(await apiClient.post("/products", toDb(product)));
}

export async function updateProduct(id, changes) {
  if (!getAccessToken()) {
    memoryProducts = memoryProducts.map((p) => (p.id === id ? { ...p, ...changes } : p));
    return Promise.resolve(memoryProducts.find((p) => p.id === id));
  }

  return fromDb(await apiClient.patch(`/products/${id}`, toDb(changes)));
}

export async function deleteProduct(id) {
  if (!getAccessToken()) {
    memoryProducts = memoryProducts.filter((p) => p.id !== id);
    return Promise.resolve(true);
  }

  await apiClient.delete(`/products/${id}`);
  return true;
}
