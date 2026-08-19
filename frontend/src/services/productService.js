// Camada de acesso a dados de produtos. Faz a "tradução" entre o formato
// do banco (snake_case: min_stock, company_id) e o formato usado no resto
// do front (camelCase: minStock) — assim nenhum componente precisa saber
// como a coluna se chama no Postgres.

import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
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
  if (!isSupabaseConfigured) {
    return Promise.resolve([...memoryProducts]);
  }
  if (!companyId) return [];

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []).map(fromDb);
}

export async function createProduct(product) {
  if (!isSupabaseConfigured) {
    const nextId = String(Date.now());
    const created = { id: nextId, ...product };
    memoryProducts = [created, ...memoryProducts];
    return Promise.resolve(created);
  }

  const payload = { ...toDb(product), company_id: product.companyId };
  const { data, error } = await supabase.from("products").insert(payload).select().single();

  if (error) throw error;
  return fromDb(data);
}

export async function updateProduct(id, changes) {
  if (!isSupabaseConfigured) {
    memoryProducts = memoryProducts.map((p) => (p.id === id ? { ...p, ...changes } : p));
    return Promise.resolve(memoryProducts.find((p) => p.id === id));
  }

  const { data, error } = await supabase
    .from("products")
    .update(toDb(changes))
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return fromDb(data);
}

export async function deleteProduct(id) {
  if (!isSupabaseConfigured) {
    memoryProducts = memoryProducts.filter((p) => p.id !== id);
    return Promise.resolve(true);
  }

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
  return true;
}
