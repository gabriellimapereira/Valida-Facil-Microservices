import React, { useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, ClipboardList, Clock, PackageCheck, Plus, Send, Truck, XCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductContext";
import { useToast } from "../context/ToastContext";
import * as requisitionService from "../services/requisitionService";
import * as storeService from "../services/storeService";
import RequisitionModal from "../components/requisitions/RequisitionModal";
import TactileButton from "../components/ui/TactileButton";

const STATUS_CONFIG = {
  pendente: { label: "Pendente", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: Clock },
  aprovada: { label: "Aprovada", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: CheckCircle2 },
  despachada: { label: "Em Trânsito / Despachada", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", icon: Truck },
  recebida: { label: "Recebida na Loja", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: PackageCheck },
  cancelada: { label: "Cancelada", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: XCircle },
};

export default function RequisitionsPage() {
  const { role } = useAuth();
  const { products } = useProducts();
  const { addToast } = useToast();
  const isAdmin = role === "admin";

  const [requisitions, setRequisitions] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqs, storeList] = await Promise.all([
        requisitionService.fetchRequisitions(),
        storeService.fetchStores(),
      ]);
      setRequisitions(reqs || []);
      setStores(storeList || []);
    } catch (err) {
      addToast(err.message || "Erro ao carregar dados.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRequisition = async (payload) => {
    const created = await requisitionService.createRequisition(payload);
    addToast("Requisição emitida com sucesso!", "success");
    setRequisitions((prev) => [created, ...prev]);
  };

  const handleStatusChange = async (reqId, newStatus) => {
    try {
      setActionLoading(true);
      await requisitionService.updateRequisitionStatus(reqId, { status: newStatus });
      addToast(`Status da requisição alterado para '${STATUS_CONFIG[newStatus]?.label || newStatus}'!`, "success");
      setRequisitions((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      addToast(err.message || "Não foi possível atualizar o status.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredRequisitions = requisitions.filter((r) => {
    if (statusFilter === "all") return true;
    return r.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <ClipboardList className="text-navy" size={26} />
            Requisições de Reposição
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Fluxo de solicitação, aprovação e transferência de itens do Armazém Central para as Lojas
          </p>
        </div>

        <TactileButton onClick={() => setModalOpen(true)} className="self-start sm:self-auto">
          <Plus size={16} className="mr-1.5" />
          Nova Requisição
        </TactileButton>
      </div>

      {/* Filtro por Abas */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/80">
        {[
          { id: "all", label: "Todas" },
          { id: "pendente", label: "Pendentes" },
          { id: "aprovada", label: "Aprovadas" },
          { id: "despachada", label: "Em Trânsito" },
          { id: "recebida", label: "Recebidas" },
          { id: "cancelada", label: "Canceladas" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              statusFilter === tab.id
                ? "bg-navy text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Lista de Requisições */}
      <div className="space-y-3.5">
        {filteredRequisitions.map((r) => {
          const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pendente;
          const Icon = cfg.icon;

          return (
            <div
              key={r.id}
              className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${cfg.bg} ${cfg.text}`}>
                    <Icon size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{r.storeName || "Filial"}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Solicitado por {r.requestedByName || "Colaborador"} • {new Date(r.createdAt || Date.now()).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>

                {/* Ações de Transição de Status */}
                <div className="flex items-center gap-2">
                  {isAdmin && r.status === "pendente" && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleStatusChange(r.id, "aprovada")}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-lg border border-blue-200 transition cursor-pointer"
                    >
                      Aprovar Requisição
                    </button>
                  )}

                  {isAdmin && r.status === "aprovada" && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleStatusChange(r.id, "despachada")}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-lg border border-indigo-200 transition cursor-pointer"
                    >
                      Despachar do Armazém
                    </button>
                  )}

                  {r.status === "despachada" && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleStatusChange(r.id, "recebida")}
                      className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
                    >
                      Confirmar Recebimento na Loja
                    </button>
                  )}

                  {r.status === "pendente" && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleStatusChange(r.id, "cancelada")}
                      className="px-2.5 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs rounded-lg transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>

              {/* Itens da Requisição */}
              <div className="mt-3.5">
                <p className="text-xs font-semibold text-slate-600 mb-2">Itens Solicitados:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(r.items || []).map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl text-xs border border-slate-100"
                    >
                      <div>
                        <span className="font-mono text-[10px] text-slate-400 block">{it.productCode || "SKU"}</span>
                        <span className="font-semibold text-slate-800">{it.productName || "Produto"}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                        {it.quantityRequested} un
                      </span>
                    </div>
                  ))}
                </div>

                {r.notes && (
                  <p className="text-xs text-slate-500 mt-2.5 italic">
                    Obs: {r.notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {filteredRequisitions.length === 0 && !loading && (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <ClipboardList className="mx-auto text-slate-400 mb-2" size={32} />
            <p className="text-sm font-semibold text-slate-700">Nenhuma requisição encontrada</p>
            <p className="text-xs text-slate-500 mt-1">
              {statusFilter === "all"
                ? "Emita a primeira requisição para abastecer uma filial."
                : `Nenhuma requisição no status '${statusFilter}'.`}
            </p>
          </div>
        )}
      </div>

      {modalOpen && (
        <RequisitionModal
          stores={stores}
          products={products}
          onClose={() => setModalOpen(false)}
          onSave={handleCreateRequisition}
        />
      )}
    </div>
  );
}
