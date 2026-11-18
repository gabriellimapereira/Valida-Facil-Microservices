import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  PackageCheck,
  Plus,
  SlidersHorizontal,
  Truck,
  XCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductContext";
import { useToast } from "../context/ToastContext";
import * as requisitionService from "../services/requisitionService";
import * as storeService from "../services/storeService";
import { fmtDate } from "../utils/formatters";
import RequisitionModal from "../components/requisitions/RequisitionModal";
import ConfirmationModal from "../components/ui/ConfirmationModal";
import ExpiryBadge from "../components/ui/ExpiryBadge";
import TactileButton from "../components/ui/TactileButton";

const STATUS_CONFIG = {
  pendente: { label: "Pendente", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: Clock },
  aprovada: { label: "Aprovada", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: CheckCircle2 },
  despachada: { label: "Em Trânsito / Despachada", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", icon: Truck },
  recebida: { label: "Recebida na Loja", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: PackageCheck },
  cancelada: { label: "Cancelada", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: XCircle },
};

const STOCK_SYNC_STATUSES = new Set(["despachada", "recebida", "cancelada"]);

export default function RequisitionsPage() {
  const { role, storeId: userStoreId } = useAuth();
  const { products, refreshProducts } = useProducts();
  const { addToast } = useToast();
  const isAdmin = role === "admin";

  const [requisitions, setRequisitions] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [editingApprovalId, setEditingApprovalId] = useState(null);
  const [approvalDrafts, setApprovalDrafts] = useState({});
  const [reqToCancel, setReqToCancel] = useState(null);

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

  const handleStatusChange = async (reqId, newStatus, itemsApproved = undefined) => {
    try {
      setActionLoadingId(reqId);
      const updated = await requisitionService.updateRequisitionStatus(reqId, {
        status: newStatus,
        itemsApproved,
      });
      setRequisitions((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, ...updated, status: updated?.status || newStatus } : r))
      );
      if (editingApprovalId === reqId) {
        setEditingApprovalId(null);
        setApprovalDrafts({});
      }
      setReqToCancel(null);

      if (STOCK_SYNC_STATUSES.has(newStatus) && typeof refreshProducts === "function") {
        await refreshProducts();
      }
      addToast(
        `Status da requisição alterado para '${STATUS_CONFIG[newStatus]?.label || newStatus}'!`,
        "success"
      );
    } catch (err) {
      addToast(err.message || "Não foi possível atualizar o status.", "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  const openApprovalEditor = (req) => {
    const draft = {};
    for (const it of req.items || []) {
      draft[it.productId] = String(it.quantityApproved ?? it.quantityRequested);
    }
    setApprovalDrafts(draft);
    setEditingApprovalId(req.id);
  };

  const handleConfirmCustomApproval = async (req) => {
    const itemsApproved = [];
    for (const it of req.items || []) {
      const raw = approvalDrafts[it.productId];
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isInteger(parsed) || parsed < 0) {
        addToast("Informe quantidades aprovadas válidas (>= 0).", "error");
        return;
      }
      itemsApproved.push({ productId: it.productId, quantityApproved: parsed });
    }
    if (itemsApproved.length > 0 && itemsApproved.every((x) => x.quantityApproved === 0)) {
      addToast("Aprove ao menos uma unidade de algum item ou cancele a requisição.", "error");
      return;
    }
    await handleStatusChange(req.id, "aprovada", itemsApproved);
  };

  const statusCounts = useMemo(() => {
    const counts = { all: requisitions.length, pendente: 0, aprovada: 0, despachada: 0, recebida: 0, cancelada: 0 };
    for (const r of requisitions) {
      if (counts[r.status] !== undefined) counts[r.status] += 1;
    }
    return counts;
  }, [requisitions]);

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
            Fluxo de solicitação, aprovação, despacho SAGA no Armazém Central e recebimento nas Lojas
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
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer inline-flex items-center gap-1.5 ${
              statusFilter === tab.id
                ? "bg-navy text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                statusFilter === tab.id ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-600"
              }`}
            >
              {statusCounts[tab.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Lista de Requisições */}
      <div className="space-y-3.5">
        {filteredRequisitions.map((r) => {
          const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.pendente;
          const Icon = cfg.icon;
          const isBusy = actionLoadingId === r.id;
          const canActOnStore = isAdmin || !userStoreId || userStoreId === r.storeId;
          const isEditingThis = editingApprovalId === r.id;

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
                    <div className="flex items-center gap-2 flex-wrap">
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
                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && r.status === "pendente" && !isEditingThis && (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openApprovalEditor(r)}
                        className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-semibold rounded-lg transition cursor-pointer inline-flex items-center gap-1"
                      >
                        <SlidersHorizontal size={12} />
                        Ajustar Qtds
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleStatusChange(r.id, "aprovada")}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold rounded-lg border border-blue-200 transition cursor-pointer disabled:opacity-50"
                      >
                        {isBusy ? "Processando..." : "Aprovar Requisição"}
                      </button>
                    </>
                  )}

                  {isAdmin && r.status === "pendente" && isEditingThis && (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setEditingApprovalId(null);
                          setApprovalDrafts({});
                        }}
                        className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 text-xs font-semibold rounded-lg transition cursor-pointer"
                      >
                        Cancelar Ajuste
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleConfirmCustomApproval(r)}
                        className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-500 text-xs font-bold rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
                      >
                        {isBusy ? "Salvando..." : "Confirmar Aprovação"}
                      </button>
                    </>
                  )}

                  {isAdmin && r.status === "aprovada" && (
                    <button
                      type="button"
                      disabled={isBusy}
                      title="Deduz as quantidades aprovadas do Armazém Central e coloca em trânsito"
                      onClick={() => handleStatusChange(r.id, "despachada")}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold rounded-lg border border-indigo-200 transition cursor-pointer disabled:opacity-50"
                    >
                      {isBusy ? "Despachando..." : "Despachar do Armazém"}
                    </button>
                  )}

                  {r.status === "despachada" && canActOnStore && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleStatusChange(r.id, "recebida")}
                      className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-500 text-xs font-bold rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {isBusy ? "Confirmando..." : "Confirmar Recebimento na Loja"}
                    </button>
                  )}

                  {((r.status === "pendente" && canActOnStore) ||
                    (isAdmin && (r.status === "aprovada" || r.status === "despachada"))) && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        if (r.status === "pendente") {
                          handleStatusChange(r.id, "cancelada");
                        } else {
                          setReqToCancel(r);
                        }
                      }}
                      className="px-2.5 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      {r.status === "despachada" ? "Estornar Despacho" : "Cancelar"}
                    </button>
                  )}
                </div>
              </div>

              {/* Itens da Requisição */}
              <div className="mt-3.5">
                <p className="text-xs font-semibold text-slate-600 mb-2">Itens Solicitados:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(r.items || []).map((it) => {
                    const showApprovedDiff =
                      r.status !== "pendente" &&
                      it.quantityApproved != null &&
                      it.quantityApproved !== it.quantityRequested;

                    return (
                      <div
                        key={it.id}
                        className="flex items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl text-xs border border-slate-100"
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-[10px] text-slate-400 block">
                            {it.productCode || "SKU"}
                            {it.expiry ? ` • Val: ${fmtDate(it.expiry)}` : ""}
                          </span>
                          <span className="font-semibold text-slate-800 block truncate">
                            {it.productName || "Produto"}
                          </span>
                          {it.expiry && (
                            <div className="mt-1">
                              <ExpiryBadge date={it.expiry} size="sm" />
                            </div>
                          )}
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          {isEditingThis ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="text-[10px] text-slate-400">Sol: {it.quantityRequested}</span>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                aria-label={`Quantidade aprovada de ${it.productName || it.productId}`}
                                value={approvalDrafts[it.productId] ?? String(it.quantityRequested)}
                                onChange={(e) =>
                                  setApprovalDrafts((prev) => ({
                                    ...prev,
                                    [it.productId]: e.target.value,
                                  }))
                                }
                                className="w-20 px-2 py-1 text-center font-mono font-bold text-slate-900 bg-white rounded-md border border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                              />
                            </div>
                          ) : (
                            <>
                              <span className="inline-block font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                {r.status !== "pendente" && it.quantityApproved != null
                                  ? `${it.quantityApproved} un`
                                  : `${it.quantityRequested} un`}
                              </span>
                              {showApprovedDiff && (
                                <span className="block text-[10px] text-slate-400 font-mono">
                                  Sol: {it.quantityRequested}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
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
          userStoreId={userStoreId}
          role={role}
          onClose={() => setModalOpen(false)}
          onSave={handleCreateRequisition}
        />
      )}

      {reqToCancel && (
        <ConfirmationModal
          isOpen={!!reqToCancel}
          onClose={() => actionLoadingId !== reqToCancel.id && setReqToCancel(null)}
          onConfirm={() => handleStatusChange(reqToCancel.id, "cancelada")}
          loading={actionLoadingId === reqToCancel.id}
          title={
            reqToCancel.status === "despachada"
              ? "Estornar despacho e cancelar requisição?"
              : "Cancelar requisição aprovada?"
          }
          description={
            reqToCancel.status === "despachada" ? (
              <>
                Esta requisição para <strong className="text-slate-800">{reqToCancel.storeName}</strong> já foi despachada. Ao cancelar, o MS Stores acionará o MS Warehouse (compensação SAGA) para devolver as unidades ao Armazém Central automaticamente.
              </>
            ) : (
              <>
                Tem certeza que deseja cancelar a requisição para <strong className="text-slate-800">{reqToCancel.storeName}</strong>?
              </>
            )
          }
          confirmText={reqToCancel.status === "despachada" ? "Estornar e Cancelar" : "Cancelar Requisição"}
          cancelText="Voltar"
          variant="danger"
        />
      )}
    </div>
  );
}
