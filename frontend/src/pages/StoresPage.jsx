import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  Building2,
  Check,
  History,
  MapPin,
  PackageCheck,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import * as storeService from "../services/storeService";
import { fmtDate } from "../utils/formatters";
import StoreModal from "../components/stores/StoreModal";
import StoreMovementModal from "../components/stores/StoreMovementModal";
import TactileButton from "../components/ui/TactileButton";
import CategoryBadge from "../components/ui/CategoryBadge";
import ExpiryBadge from "../components/ui/ExpiryBadge";
import ConfirmationModal from "../components/ui/ConfirmationModal";

const MOVEMENT_TYPE_LABELS = {
  entrada: { label: "Entrada Local", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  saida: { label: "Saída / Venda", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  recebimento_requisicao: { label: "Recebimento CD", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  ajuste: { label: "Ajuste", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

export default function StoresPage() {
  const { role, storeId: userStoreId } = useAuth();
  const { addToast } = useToast();
  const isAdmin = role === "admin";

  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("inventory");
  const [searchTerm, setSearchTerm] = useState("");

  const [storeModalState, setStoreModalState] = useState(null);
  const [movementModalState, setMovementModalState] = useState(null);
  const [storeToDelete, setStoreToDelete] = useState(null);
  const [deletingStore, setDeletingStore] = useState(false);

  const [editingMinStock, setEditingMinStock] = useState(null);
  const [savingMinStock, setSavingMinStock] = useState(false);

  const canManageSelectedStore = Boolean(
    selectedStore && (isAdmin || !userStoreId || userStoreId === selectedStore.id)
  );

  const loadStores = async () => {
    try {
      setLoading(true);
      const data = await storeService.fetchStores();
      const list = data || [];
      setStores(list);
      if (list.length > 0) {
        setSelectedStore((prev) => {
          if (prev) {
            const match = list.find((s) => s.id === prev.id);
            if (match) return match;
          }
          if (userStoreId) {
            const assigned = list.find((s) => s.id === userStoreId);
            if (assigned) return assigned;
          }
          return list[0];
        });
      } else {
        setSelectedStore(null);
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

  const loadMovements = async (storeId) => {
    if (!storeId) return;
    try {
      setMovementsLoading(true);
      const data = await storeService.fetchStoreMovements(storeId);
      setMovements(data || []);
    } catch {
      setMovements([]);
    } finally {
      setMovementsLoading(false);
    }
  };

  useEffect(() => {
    loadStores();
  }, [userStoreId]);

  useEffect(() => {
    if (selectedStore?.id) {
      setEditingMinStock(null);
      loadInventory(selectedStore.id);
      loadMovements(selectedStore.id);
    } else {
      setInventory([]);
      setMovements([]);
    }
  }, [selectedStore?.id]);

  const filteredInventory = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(
      (item) =>
        (item.productName || "").toLowerCase().includes(q) ||
        (item.productCode || "").toLowerCase().includes(q)
    );
  }, [inventory, searchTerm]);

  const handleSaveStore = async (storeData) => {
    if (storeModalState?.mode === "edit" && storeModalState.store) {
      const updated = await storeService.updateStore(storeModalState.store.id, storeData);
      addToast("Filial atualizada com sucesso!");
      setStores((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      if (selectedStore?.id === updated.id) {
        setSelectedStore(updated);
      }
      return;
    }

    const created = await storeService.createStore(storeData);
    addToast("Filial cadastrada com sucesso!");
    setStores((prev) => [...prev, created]);
    setSelectedStore(created);
  };

  const handleConfirmDeleteStore = async () => {
    if (!storeToDelete) return;
    setDeletingStore(true);
    try {
      await storeService.deleteStore(storeToDelete.id);
      addToast("Filial removida com sucesso!");
      const remaining = stores.filter((s) => s.id !== storeToDelete.id);
      setStores(remaining);
      if (selectedStore?.id === storeToDelete.id) {
        setSelectedStore(remaining[0] || null);
      }
      setStoreToDelete(null);
    } catch (err) {
      addToast(err.message || "Falha ao remover filial.", "error");
    } finally {
      setDeletingStore(false);
    }
  };

  const handleRecordMovement = async (payload) => {
    if (!selectedStore) return;
    await storeService.recordStoreMovement(selectedStore.id, payload);
    addToast("Movimentação local registrada com sucesso!");
    await Promise.all([loadInventory(selectedStore.id), loadMovements(selectedStore.id)]);
  };

  const handleSaveMinStock = async (item) => {
    if (!selectedStore || !editingMinStock) return;
    const parsed = Number.parseInt(editingMinStock.value, 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
      addToast("O estoque mínimo deve ser um número inteiro maior ou igual a zero.", "error");
      return;
    }
    setSavingMinStock(true);
    try {
      const updated = await storeService.updateStoreMinStock(
        selectedStore.id,
        item.productId,
        parsed
      );
      setInventory((prev) =>
        prev.map((inv) =>
          inv.productId === item.productId
            ? { ...inv, minStock: updated?.minStock ?? parsed }
            : inv
        )
      );
      setEditingMinStock(null);
      addToast("Estoque mínimo atualizado!");
    } catch (err) {
      addToast(err.message || "Falha ao atualizar estoque mínimo.", "error");
    } finally {
      setSavingMinStock(false);
    }
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
            Gestão das unidades físicas, controle de estoque local e histórico por filial
          </p>
        </div>

        {isAdmin && (
          <TactileButton
            onClick={() => setStoreModalState({ mode: "create" })}
            className="self-start sm:self-auto"
          >
            <Plus size={16} className="mr-1.5" />
            Nova Filial
          </TactileButton>
        )}
      </div>

      {/* Grid de Seleção de Lojas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stores.map((s) => {
          const isSelected = selectedStore?.id === s.id;
          const isMyUnit = Boolean(userStoreId && userStoreId === s.id);
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
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-block text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold tracking-wider ${
                        isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {s.code}
                    </span>
                    {isMyUnit && (
                      <span
                        className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          isSelected
                            ? "bg-amber-400/20 text-amber-200 border border-amber-300/30"
                            : "bg-teal-50 text-teal-700 border border-teal-200"
                        }`}
                      >
                        Minha Unidade
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-base mt-2 truncate">{s.name}</h3>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        title="Editar filial"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStoreModalState({ mode: "edit", store: s });
                        }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? "text-white/75 hover:text-white hover:bg-white/15"
                            : "text-slate-400 hover:text-navy hover:bg-slate-100"
                        }`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title="Excluir filial"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStoreToDelete(s);
                        }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? "text-white/75 hover:text-red-200 hover:bg-red-500/20"
                            : "text-slate-400 hover:text-red-600 hover:bg-red-50"
                        }`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isSelected ? "bg-white/10 text-white" : "bg-slate-50 text-slate-400"
                    }`}
                  >
                    <Building2 size={18} />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-current/10 space-y-1.5 text-xs opacity-90">
                {s.address && (
                  <p className="flex items-center gap-1.5 truncate">
                    <MapPin size={13} className="shrink-0" />
                    <span className="truncate">{s.address}</span>
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

      {/* Painel da Filial Selecionada */}
      {selectedStore && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-slate-50/50">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PackageCheck size={18} className="text-teal-600" />
                Estoque Local — {selectedStore.name} ({selectedStore.code})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Tabs */}
              <div className="inline-flex bg-slate-200/70 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab("inventory")}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "inventory"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <PackageCheck size={13} />
                  Estoque ({inventory.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("movements")}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "movements"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <History size={13} />
                  Histórico ({movements.length})
                </button>
              </div>

              {canManageSelectedStore && (
                <TactileButton
                  onClick={() => setMovementModalState({ initialItem: null })}
                  padding="8px 14px"
                  rounded={10}
                >
                  <ArrowDownUp size={14} className="mr-1.5" />
                  Movimentar Loja
                </TactileButton>
              )}
            </div>
          </div>

          {!canManageSelectedStore && (
            <div className="px-6 py-2.5 bg-amber-50/80 border-b border-amber-200/80 flex items-center gap-2 text-xs text-amber-800">
              <ShieldAlert size={15} className="shrink-0 text-amber-600" />
              <span>
                Você está vinculado a outra unidade; a visualização está liberada, mas alterações neste estoque local são restritas.
              </span>
            </div>
          )}

          {activeTab === "inventory" ? (
            <>
              <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                <div className="relative w-full max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por código ou produto..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3">Código</th>
                      <th className="px-5 py-3">Produto</th>
                      <th className="px-5 py-3">Validade</th>
                      <th className="px-5 py-3">Categoria</th>
                      <th className="px-5 py-3 text-center">Saldo em Loja</th>
                      <th className="px-5 py-3 text-center">Estoque Mínimo</th>
                      {canManageSelectedStore && <th className="px-5 py-3 text-right">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInventory.map((item) => {
                      const lowStock = item.quantity <= (item.minStock || 0);
                      const isEditingMin = editingMinStock?.productId === item.productId;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-5 py-3.5 font-mono text-slate-500 font-medium">
                            {item.productCode || "—"}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-slate-800">
                            {item.productName || "Produto"}
                          </td>
                          <td className="px-5 py-3.5">
                            {item.expiry ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-slate-600">{fmtDate(item.expiry)}</span>
                                <ExpiryBadge date={item.expiry} size="sm" />
                              </div>
                            ) : (
                              <span className="text-slate-400">Sem validade</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            {item.category ? <CategoryBadge id={item.category} /> : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span
                              className={`font-mono font-bold text-sm px-2 py-0.5 rounded-md ${
                                lowStock ? "bg-amber-50 text-amber-700 border border-amber-200" : "text-slate-900"
                              }`}
                            >
                              {item.quantity}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-center font-mono text-slate-600">
                            {isEditingMin ? (
                              <div className="inline-flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  value={editingMinStock.value}
                                  onChange={(e) =>
                                    setEditingMinStock((prev) => ({ ...prev, value: e.target.value }))
                                  }
                                  className="w-16 px-2 py-1 text-center text-xs bg-white border border-navy rounded-lg font-mono"
                                />
                                <button
                                  type="button"
                                  disabled={savingMinStock}
                                  onClick={() => handleSaveMinStock(item)}
                                  className="p-1 text-teal-600 hover:bg-teal-50 rounded cursor-pointer"
                                  title="Salvar estoque mínimo"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  type="button"
                                  disabled={savingMinStock}
                                  onClick={() => setEditingMinStock(null)}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                                  title="Cancelar"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1.5">
                                <span>{item.minStock || 0}</span>
                                {canManageSelectedStore && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingMinStock({
                                        productId: item.productId,
                                        value: String(item.minStock || 0),
                                      })
                                    }
                                    className="p-1 text-slate-400 hover:text-navy hover:bg-slate-100 rounded cursor-pointer"
                                    title="Editar estoque mínimo"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                          {canManageSelectedStore && (
                            <td className="px-5 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => setMovementModalState({ initialItem: item })}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-navy hover:text-white text-slate-700 font-semibold transition cursor-pointer inline-flex items-center gap-1"
                              >
                                <ArrowDownUp size={12} />
                                Movimentar
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}

                    {filteredInventory.length === 0 && !inventoryLoading && (
                      <tr>
                        <td colSpan={canManageSelectedStore ? 7 : 6} className="px-6 py-10 text-center text-slate-400">
                          {searchTerm
                            ? "Nenhum produto encontrado para este filtro na filial."
                            : "Nenhum item alocado no estoque local desta filial ainda. Faça uma requisição ao armazém central ou registre uma entrada local."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Data</th>
                    <th className="px-5 py-3">Tipo</th>
                    <th className="px-5 py-3">Produto</th>
                    <th className="px-5 py-3 text-center">Variação</th>
                    <th className="px-5 py-3 text-center">Saldo</th>
                    <th className="px-5 py-3">Responsável / Observação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((mv) => {
                    const badge = MOVEMENT_TYPE_LABELS[mv.movementType] || {
                      label: mv.movementType || "Movimentação",
                      cls: "bg-slate-100 text-slate-700 border-slate-200",
                    };
                    const deltaPositive = mv.quantityDelta > 0;
                    return (
                      <tr key={mv.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                          {mv.createdAt ? new Date(mv.createdAt).toLocaleString("pt-BR") : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-mono text-slate-400 mr-1.5">{mv.productCode || ""}</span>
                          <span className="font-bold text-slate-800">{mv.productName || "Produto"}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center font-mono font-bold">
                          <span className={deltaPositive ? "text-teal-700" : "text-rose-600"}>
                            {deltaPositive ? `+${mv.quantityDelta}` : mv.quantityDelta}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center font-mono text-slate-600">
                          {mv.previousQuantity} → <strong className="text-slate-900">{mv.newQuantity}</strong>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">
                          <div className="font-semibold text-slate-700">{mv.changedByName || "Sistema"}</div>
                          {mv.note && <div className="text-[11px] text-slate-400">{mv.note}</div>}
                        </td>
                      </tr>
                    );
                  })}

                  {movements.length === 0 && !movementsLoading && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                        Nenhuma movimentação registrada ainda para esta filial.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {storeModalState && (
        <StoreModal
          store={storeModalState.mode === "edit" ? storeModalState.store : null}
          onClose={() => setStoreModalState(null)}
          onSave={handleSaveStore}
        />
      )}

      {movementModalState && selectedStore && (
        <StoreMovementModal
          store={selectedStore}
          inventory={inventory}
          initialItem={movementModalState.initialItem}
          onClose={() => setMovementModalState(null)}
          onSave={handleRecordMovement}
        />
      )}

      {storeToDelete && (
        <ConfirmationModal
          isOpen={!!storeToDelete}
          onClose={() => !deletingStore && setStoreToDelete(null)}
          onConfirm={handleConfirmDeleteStore}
          loading={deletingStore}
          title="Remover filial?"
          description={
            <>
              Tem certeza que deseja excluir <strong className="text-slate-800 font-semibold">{storeToDelete.name}</strong>? O estoque local e requisições vinculadas a esta unidade serão removidos.
            </>
          }
          confirmText="Excluir filial"
          cancelText="Cancelar"
          variant="danger"
        />
      )}
    </div>
  );
}
