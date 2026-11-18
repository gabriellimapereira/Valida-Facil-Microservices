import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileDown, Info, Plus } from "lucide-react";
import ProductFilters from "../components/products/ProductFilters";
import ProductTable from "../components/products/ProductTable";
import ProductModal from "../components/products/ProductModal";
import ConfirmDeleteModal from "../components/products/ConfirmDeleteModal";
import MovementModal from "../components/products/MovementModal";
import ReportModal from "../components/products/ReportModal";
import TactileButton from "../components/ui/TactileButton";
import { useAuth } from "../context/AuthContext";
import { useProducts } from "../context/ProductContext";
import { useToast } from "../context/ToastContext";
import * as movementService from "../services/movementService";
import * as reportService from "../services/reportService";

const PAGE_SIZE = 8;
const DEFAULT_FILTERS = { search: "", category: "all", dateFrom: "", dateTo: "", sortPrice: "none" };

export default function StockPage() {
  const { storeId: userStoreId } = useAuth();
  const isBranchOperator = Boolean(userStoreId);

  const { products, addProduct, editProduct, removeProduct, syncProductQuantity } = useProducts();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState(() => ({
    ...DEFAULT_FILTERS,
    search: searchParams.get("search") || "",
  }));
  const [sortField, setSortField] = useState("none");
  const [sortOrder, setSortOrder] = useState("asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [movingProduct, setMovingProduct] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Abre o modal de cadastro automaticamente ao chegar via /estoque?novo=1 (exceto se for operador de filial)
  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      if (!isBranchOperator) {
        setEditing(null);
        setModalOpen(true);
      }
      searchParams.delete("novo");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBranchOperator]);

  // Sincroniza sortPrice de filters com sortField
  useEffect(() => {
    if (filters.sortPrice !== "none") {
      setSortField("price");
      setSortOrder(filters.sortPrice);
    } else if (sortField === "price") {
      setSortField("none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.sortPrice]);

  const handleSort = (field) => {
    if (sortField !== field) {
      setSortField(field);
      setSortOrder("asc");
      if (field === "price") setFilters((f) => ({ ...f, sortPrice: "asc" }));
      else setFilters((f) => ({ ...f, sortPrice: "none" }));
    } else if (sortOrder === "asc") {
      setSortOrder("desc");
      if (field === "price") setFilters((f) => ({ ...f, sortPrice: "desc" }));
    } else {
      setSortField("none");
      setSortOrder("asc");
      if (field === "price") setFilters((f) => ({ ...f, sortPrice: "none" }));
    }
  };

  const filtered = useMemo(() => {
    let list = [...products];
    const { search, category, dateFrom, dateTo } = filters;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => (p.name || "").toLowerCase().includes(q) || (p.code || "").toLowerCase().includes(q));
    }
    if (category !== "all") list = list.filter((p) => p.category === category);
    if (dateFrom) list = list.filter((p) => p.expiry && p.expiry >= dateFrom);
    if (dateTo) list = list.filter((p) => p.expiry && p.expiry <= dateTo);

    if (sortField === "name") {
      list.sort((a, b) => sortOrder === "asc" ? (a.name || "").localeCompare(b.name || "") : (b.name || "").localeCompare(a.name || ""));
    } else if (sortField === "price") {
      list.sort((a, b) => sortOrder === "asc" ? a.price - b.price : b.price - a.price);
    } else if (sortField === "quantity") {
      list.sort((a, b) => sortOrder === "asc" ? a.quantity - b.quantity : b.quantity - a.quantity);
    } else if (sortField === "expiry") {
      list.sort((a, b) => {
        if (!a.expiry) return 1;
        if (!b.expiry) return -1;
        return sortOrder === "asc" ? a.expiry.localeCompare(b.expiry) : b.expiry.localeCompare(a.expiry);
      });
    }

    return list;
  }, [products, filters, sortField, sortOrder]);

  useEffect(() => setPage(1), [filters, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = [
    filters.category !== "all",
    filters.dateFrom,
    filters.dateTo,
    filters.sortPrice !== "none",
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0 || Boolean(filters.search.trim()) || sortField !== "none";

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSortField("none");
    setSortOrder("asc");
  };

  const handleSave = async (data) => {
    if (isBranchOperator) {
      addToast("Operadores de filial têm acesso somente leitura ao armazém central.", "error");
      return;
    }
    try {
      if (editing) {
        await editProduct(editing.id, data);
        addToast("Produto atualizado.");
      } else {
        await addProduct(data);
        addToast("Produto cadastrado.");
      }
      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      addToast(err.message || "Não foi possível salvar o produto.", "error");
    }
  };

  const handleDelete = async () => {
    if (isBranchOperator) {
      addToast("Operadores de filial têm acesso somente leitura ao armazém central.", "error");
      setDeleting(null);
      return;
    }
    try {
      await removeProduct(deleting.id);
      addToast(`"${deleting.name}" removido do estoque.`);
    } catch (err) {
      addToast(err.message || "Não foi possível excluir o produto.", "error");
    } finally {
      setDeleting(null);
    }
  };

  // Passa pelo backend (POST /movements): atualiza a quantidade + grava o
  // histórico numa transação só, e decide lá se dispara e-mail de estoque
  // baixo — por isso não editamos products.quantity diretamente no frontend.
  const handleMovementSubmit = async ({ movementType, quantityDelta, note }) => {
    if (isBranchOperator) {
      addToast("Operadores de filial não podem lançar movimentações no armazém central.", "error");
      setMovingProduct(null);
      return;
    }
    const result = await movementService.recordMovement({
      productId: movingProduct.id,
      movementType,
      quantityDelta,
      note,
    });
    syncProductQuantity(result.productId, result.newQuantity);
    addToast(
      result.crossedLowStock
        ? `Movimentação registrada. Estoque abaixo do mínimo — alerta enviado por e-mail.`
        : "Movimentação registrada."
    );
    setMovingProduct(null);
  };

  const handleGenerateReport = async (params) => {
    const { url, filename } = await reportService.generateReport(params);
    await reportService.downloadFile(url, filename);
    addToast(`Relatório "${filename}" baixado com sucesso.`);
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Gestão de estoque</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{filtered.length} produto(s) encontrado(s)</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <TactileButton
            variant="secondary"
            onClick={() => setReportModalOpen(true)}
            padding="10px 20px"
            rounded={12}
            className="w-full sm:w-auto"
          >
            <FileDown size={17} className="mr-1.5 shrink-0" />
            Gerar relatório
          </TactileButton>
          {!isBranchOperator && (
            <TactileButton
              variant="amber"
              onClick={() => { setEditing(null); setModalOpen(true); }}
              padding="10px 20px"
              rounded={12}
              className="w-full sm:w-auto"
            >
              <Plus size={17} className="mr-1.5 shrink-0" />
              Novo produto
            </TactileButton>
          )}
        </div>
      </div>

      {isBranchOperator && (
        <div className="flex items-start gap-3 p-3.5 sm:p-4 rounded-xl border border-amber-200/90 bg-amber-50/80 text-amber-950 text-xs sm:text-sm shadow-xs">
          <Info size={19} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-900">
              Armazém Central (Modo Leitura / Consulta)
            </p>
            <p className="text-amber-800 leading-relaxed">
              Como operador de filial, você possui acesso de consulta aos produtos do CD. Para abastecer o armazém da sua loja, faça uma solicitação através da aba <strong className="font-medium underline decoration-amber-400">Requisições</strong>.
            </p>
          </div>
        </div>
      )}

      <ProductFilters
        filters={filters}
        setFilters={setFilters}
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        activeFilterCount={activeFilterCount}
        clearFilters={clearFilters}
      />

      <ProductTable
        items={pageItems}
        page={page}
        totalPages={totalPages}
        totalCount={filtered.length}
        pageSize={PAGE_SIZE}
        setPage={setPage}
        readOnly={isBranchOperator}
        onEdit={isBranchOperator ? undefined : (p) => { setEditing(p); setModalOpen(true); }}
        onDelete={isBranchOperator ? undefined : (p) => setDeleting(p)}
        onMovement={isBranchOperator ? undefined : (p) => setMovingProduct(p)}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        onClearFilters={clearFilters}
        onNewProduct={isBranchOperator ? undefined : () => { setEditing(null); setModalOpen(true); }}
        hasActiveFilters={hasActiveFilters}
      />

      {modalOpen && (
        <ProductModal
          key={editing?.id || "new"}
          product={editing}
          existingProducts={products}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
      <ConfirmDeleteModal product={deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} />

      {movingProduct && (
        <MovementModal
          product={movingProduct}
          onClose={() => setMovingProduct(null)}
          onSubmit={handleMovementSubmit}
        />
      )}

      {reportModalOpen && (
        <ReportModal onClose={() => setReportModalOpen(false)} onSubmit={handleGenerateReport} />
      )}
    </div>
  );
}
