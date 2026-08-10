// Camada de acesso a dados de produtos.
// Enquanto o Supabase não estiver configurado (.env vazio), opera sobre um
// array em memória (dados de src/data/mockData.js). Quando VITE_SUPABASE_URL
// e VITE_SUPABASE_ANON_KEY estiverem definidos, troque os blocos marcados
// com "TODO Supabase" pela chamada real — a assinatura das funções já é
// assíncrona para essa migração ser transparente para os componentes.

import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import { MOCK_PRODUCTS } from "../data/mockData";

let memoryProducts = [...MOCK_PRODUCTS];

export async function fetchProducts(companyId) {
  if (isSupabaseConfigured) {
    // TODO Supabase: substituir pela consulta real, ex.:
    // const { data, error } = await supabase
    //   .from("products")
    //   .select("*")
    //   .eq("company_id", companyId)
    //   .order("created_at", { ascending: false });
    // if (error) throw error;
    // return data;
  }
  return Promise.resolve([...memoryProducts]);
}

export async function createProduct(product) {
  if (isSupabaseConfigured) {
    // TODO Supabase:
    // const { data, error } = await supabase.from("products").insert(product).select().single();
    // if (error) throw error;
    // return data;
  }
  const nextId = String(Date.now());
  const created = { id: nextId, ...product };
  memoryProducts = [created, ...memoryProducts];
  return Promise.resolve(created);
}

export async function updateProduct(id, changes) {
  if (isSupabaseConfigured) {
    // TODO Supabase:
    // const { data, error } = await supabase.from("products").update(changes).eq("id", id).select().single();
    // if (error) throw error;
    // return data;
  }
  memoryProducts = memoryProducts.map((p) => (p.id === id ? { ...p, ...changes } : p));
  return Promise.resolve(memoryProducts.find((p) => p.id === id));
}

export async function deleteProduct(id) {
  if (isSupabaseConfigured) {
    // TODO Supabase:
    // const { error } = await supabase.from("products").delete().eq("id", id);
    // if (error) throw error;
  }
  memoryProducts = memoryProducts.filter((p) => p.id !== id);
  return Promise.resolve(true);
}
