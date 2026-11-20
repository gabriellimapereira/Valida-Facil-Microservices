function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const RAW_PRODUCTS = [
  { code: "FRT-0012", name: "Maçã Gala (caixa 10kg)", category: "perecivel", price: 42.9, quantity: 18, minStock: 10, expiry: addDays(2), supplier: "Fazenda Boa Vista" },
  { code: "FRT-0045", name: "Banana Prata (caixa 20kg)", category: "perecivel", price: 55.0, quantity: 6, minStock: 8, expiry: addDays(4), supplier: "Sítio Três Irmãos" },
  { code: "LAT-0231", name: "Leite Integral 1L (fardo)", category: "perecivel", price: 68.4, quantity: 32, minStock: 15, expiry: addDays(9), supplier: "Laticínios Sertão" },
  { code: "PAO-0087", name: "Pão de Forma Integral", category: "perecivel", price: 8.9, quantity: 40, minStock: 20, expiry: addDays(1), supplier: "Panificadora Central" },
  { code: "IOG-0056", name: "Iogurte Natural (pack 6un)", category: "perecivel", price: 21.5, quantity: 24, minStock: 10, expiry: addDays(15), supplier: "Laticínios Sertão" },
  { code: "CAR-0099", name: "Filé de Frango Congelado 1kg", category: "perecivel", price: 24.9, quantity: 50, minStock: 20, expiry: addDays(45), supplier: "Frigorífico Nordeste" },
  { code: "MOD-1001", name: "Camiseta Básica Algodão", category: "moda", price: 39.9, quantity: 120, minStock: 30, expiry: null, supplier: "Confecções Piauí" },
  { code: "MOD-1032", name: "Calça Jeans Skinny", category: "moda", price: 129.9, quantity: 8, minStock: 15, expiry: null, supplier: "Jeans & Cia" },
  { code: "MOD-1075", name: "Jaqueta Corta-Vento", category: "moda", price: 189.0, quantity: 22, minStock: 10, expiry: null, supplier: "Confecções Piauí" },
  { code: "MOD-1090", name: "Tênis Casual Unissex", category: "moda", price: 219.9, quantity: 14, minStock: 12, expiry: null, supplier: "Calçados Nordeste" },
  { code: "LIV-2001", name: "Dom Casmurro - Ed. Especial", category: "livros", price: 34.5, quantity: 45, minStock: 10, expiry: null, supplier: "Distribuidora Letras" },
  { code: "LIV-2044", name: "Clean Code (Robert C. Martin)", category: "livros", price: 98.0, quantity: 5, minStock: 6, expiry: null, supplier: "Editora Alta Books" },
  { code: "LIV-2077", name: "Agenda Planner 2026", category: "livros", price: 45.9, quantity: 60, minStock: 20, expiry: null, supplier: "Papelaria Union" },
  { code: "ELE-3010", name: "Fone Bluetooth TWS", category: "eletronicos", price: 149.9, quantity: 33, minStock: 15, expiry: null, supplier: "TechImport" },
  { code: "ELE-3055", name: "Carregador Turbo 33W", category: "eletronicos", price: 59.9, quantity: 4, minStock: 10, expiry: null, supplier: "TechImport" },
  { code: "ELE-3088", name: "Smartwatch Fit Pro", category: "eletronicos", price: 349.0, quantity: 11, minStock: 8, expiry: null, supplier: "GlobalTech" },
  { code: "ELE-3099", name: "Caixa de Som Portátil", category: "eletronicos", price: 189.9, quantity: 19, minStock: 10, expiry: null, supplier: "GlobalTech" },
  { code: "OUT-4001", name: "Vela Aromática Lavanda", category: "outros", price: 27.9, quantity: 28, minStock: 10, expiry: addDays(200), supplier: "Casa & Aroma" },
  { code: "OUT-4022", name: "Kit Organizador de Gavetas", category: "outros", price: 62.9, quantity: 16, minStock: 8, expiry: null, supplier: "Casa & Aroma" },
  { code: "FRT-0060", name: "Morango Bandeja 300g", category: "perecivel", price: 14.9, quantity: 12, minStock: 10, expiry: addDays(0), supplier: "Sítio Três Irmãos" },
];

export const MOCK_PRODUCTS = RAW_PRODUCTS.map((p, i) => ({ id: String(i + 1), ...p }));

export const MOCK_COMPANY = {
  id: "company-demo-1",
  name: "Empório Boa Safra Distribuidora",
  segment: "Atacado & Varejo Multi-categoria",
  email: "contato@emporioboasafra.com.br",
  notificationEmail: "estoque@emporioboasafra.com.br",
  phone: "(89) 3222-4455",
  cnpj: "12.345.678/0001-90",
  address: "Av. Nossa Senhora de Fátima, 1200 – Picos, PI",
  initials: "EB",
};

export const MOCK_MEMBERS = [
  { id: "user-demo-1", fullName: "Carlos Silva (Proprietário)", email: "carlos.admin@emporioboasafra.com.br", role: "admin", storeId: null, storeName: null, createdAt: "2026-01-15T10:00:00Z" },
  { id: "user-demo-2", fullName: "Mariana Souza", email: "mariana.operacoes@emporioboasafra.com.br", role: "operador", storeId: "store-demo-1", storeName: "Filial Centro", createdAt: "2026-02-01T14:30:00Z" },
  { id: "user-demo-3", fullName: "João Pedro Santos", email: "joao.estoque@emporioboasafra.com.br", role: "operador", storeId: "store-demo-2", storeName: "Filial Shopping Picos", createdAt: "2026-02-10T09:15:00Z" },
];

export const MOCK_STORES = [
  { id: "store-demo-1", companyId: "company-demo-1", name: "Filial Centro", code: "CENTRO-01", address: "Rua do Comércio, 120", phone: "(89) 3222-1100", createdAt: "2026-01-20T10:00:00Z" },
  { id: "store-demo-2", companyId: "company-demo-1", name: "Filial Shopping Picos", code: "SHOP-02", address: "Av. Severo Eulálio, 500", phone: "(89) 3222-2200", createdAt: "2026-02-05T14:00:00Z" },
];

export const MOCK_REQUISITIONS = [
  {
    id: "req-demo-1",
    companyId: "company-demo-1",
    storeId: "store-demo-1",
    storeName: "Filial Centro",
    requestedBy: "user-demo-2",
    requestedByName: "Mariana Souza",
    status: "pendente",
    notes: "Reposição de perecíveis para o final de semana",
    createdAt: "2026-02-15T09:30:00Z",
    updatedAt: "2026-02-15T09:30:00Z",
    items: [
      { id: "item-1", productId: "3", productName: "Leite Integral 1L (fardo)", productCode: "LAT-0231", quantityRequested: 15, quantityApproved: 15 },
      { id: "item-2", productId: "4", productName: "Pão de Forma Integral", productCode: "PAO-0087", quantityRequested: 20, quantityApproved: 20 },
    ],
  },
  {
    id: "req-demo-2",
    companyId: "company-demo-1",
    storeId: "store-demo-2",
    storeName: "Filial Shopping Picos",
    requestedBy: "user-demo-3",
    requestedByName: "João Pedro Santos",
    status: "despachada",
    notes: "Reposição de eletrônicos",
    createdAt: "2026-02-14T16:00:00Z",
    updatedAt: "2026-02-14T17:30:00Z",
    items: [
      { id: "item-3", productId: "14", productName: "Fone Bluetooth TWS", productCode: "ELE-3010", quantityRequested: 10, quantityApproved: 10 },
    ],
  },
];

