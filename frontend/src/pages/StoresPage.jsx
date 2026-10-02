import React, { useEffect, useState } from "react";
import { Building2, MapPin, PackageCheck, Phone, Plus, Store } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import * as storeService from "../services/storeService";
import StoreModal from "../components/stores/StoreModal";
import TactileButton from "../components/ui/TactileButton";
import CategoryBadge from "../components/ui/CategoryBadge";

export default function StoresPage() {
  const { role } = useAuth();
  const { addToast } = useToast();
  const isAdmin = role === "admin";

  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const loadStores = async () => {
    try {
      setLoading(true);
      const data = await storeService.fetchStores();
      setStores(data || []);
      if (data && data.length > 0 && !selectedStore) {
        setSelectedStore(data[0]);
      }
    } catch (err) {
      addToast(err.message || "Erro ao carregar lojas.", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async (storeId) => {
    if (!storeId) return;
    try {
      setInventoryLoading(true);
      const data = await storeService.fetchStoreInventory(storeId);
      setInventory(data || []);
    } catch (err) {
      addToast(err.message || "Erro ao carregar estoque da filial.", "error");
    } finally {
      setInventoryLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  useEffect(() => {
    if (selectedStore?.id) {
      loadInventory(selectedStore.id);
    }
  }, [selectedStore]);

  const handleCreateStore = async (storeData) => {
    const created = await storeService.createStore(storeData);
    addToast("Filial cadastrada com sucesso!", "success");
    setStores((prev) => [...prev, created]);
    setSelectedStore(created);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Store className="text-navy" size={26} />
            Lojas & Filiais
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestão das unidades físicas e controle de estoque local por filial
          </p>
        </div>

        {isAdmin && (
          <TactileButton onClick={() => setModalOpen(true)} className="self-start sm:self-auto">
            <Plus size={16} className="mr-1.5" />
            Nova Filial
          </TactileButton>
        )}
      </div>

      {/* Grid de Seleção de Lojas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores.map((s) => {
          const isSelected = selectedStore?.id === s.id;
          return (
            <div
              key={s.id}
              onClick={() => setSelectedStore(s)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer select-none ${
                isSelected
                  ? "bg-navy text-white border-navy shadow-md ring-2 ring-navy/20"
                  : "bg-white text-slate-900 border-slate-200/80 hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span
                    className={`inline-block text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold tracking-wider ${
                      isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {s.code}
                  </span>
                  <h3 className="font-bold text-base mt-2">{s.name}</h3>
                </div>
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    isSelected ? "bg-white/10 text-white" : "bg-slate-50 text-slate-400"
                  }`}
                >
                  <Building2 size={18} />
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-current/10 space-y-1.5 text-xs opacity-90">
                {s.address && (
                  <p className="flex items-center gap-1.5 truncate">
                    <MapPin size={13} className="shrink-0" />
                    <span>{s.address}</span>
                  </p>
                )}
                {s.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone size={13} className="shrink-0" />
                    <span>{s.phone}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {stores.length === 0 && !loading && (
          <div className="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200">
            <Store className="mx-auto text-slate-400 mb-2" size={32} />
            <p className="text-sm font-semibold text-slate-700">Nenhuma filial cadastrada</p>
            <p className="text-xs text-slate-500 mt-1">Cadastre a primeira loja para monitorar seu estoque local.</p>
          </div>
        )}
      </div>

      {/* Seção de Estoque da Filial Selecionada */}
      {selectedStore && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PackageCheck size={18} className="text-teal-600" />
                Estoque Local — {selectedStore.name} ({selectedStore.code})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Saldo físico disponível nas gôndolas desta filial</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Código</th>
                  <th className="px-5 py-3">Produto</th>
                  <th className="px-5 py-3">Categoria</th>
                  <th className="px-5 py-3 text-center">Saldo em Loja</th>
                  <th className="px-5 py-3 text-center">Estoque Mínimo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3.5 font-mono text-slate-500 font-medium">{item.product_code || "—"}</td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">{item.product_name || "Produto"}</td>
                    <td className="px-5 py-3.5">
                      {item.category && <CategoryBadge id={item.category} />}
                    </td>
                    <td className="px-5 py-3.5 text-center font-mono font-bold text-slate-900 text-sm">
                      {item.quantity}
                    </td>
                    <td className="px-5 py-3.5 text-center font-mono text-slate-500">
                      {item.min_stock || 0}
                    </td>
                  </tr>
                ))}

                {inventory.length === 0 && !inventoryLoading && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-slate-400">
                      Nenhum item alocado no estoque local desta filial ainda. Faça uma requisição ao armazém central para abastecer.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <StoreModal onClose={() => setModalOpen(false)} onSave={handleCreateStore} />
      )}
    </div>
  );
}
