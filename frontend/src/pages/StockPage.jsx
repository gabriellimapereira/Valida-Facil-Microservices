import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileDown, Plus } from "lucide-react";
import ProductFilters from "../components/products/ProductFilters";
import ProductTable from "../components/products/ProductTable";
import ProductModal from "../components/products/ProductModal";
import ConfirmDeleteModal from "../components/products/ConfirmDeleteModal";
import MovementModal from "../components/products/MovementModal";
import ReportModal from "../components/products/ReportModal";
import TactileButton from "../components/ui/TactileButton";
import { useProducts } from "../context/ProductContext";
import { useToast } from "../context/ToastContext";
import * as movementService from "../services/movementService";
import * as reportService from "../services/reportService";

const PAGE_SIZE = 8;
const DEFAULT_FILTERS = { search: "", category: "all", dateFrom: "", dateTo: "", sortPrice: "none" };

export default function StockPage() {
  const { products, addProduct, editProduct, removeProduct, syncProductQuantity } = useProducts();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [movingProduct, setMovingProduct] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  // Abre o modal de cadastro automaticamente ao chegar via /estoque?novo=1
  useEffect(() => {
    if (searchParams.get("novo") === "1") {
      setEditing(null);
      setModalOpen(true);
      searchParams.delete("novo");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let list = [...products];
    const { search, category, dateFrom, dateTo, sortPrice } = filters;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    }
    if (category !== "all") list = list.filter((p) => p.category === category);
    if (dateFrom) list = list.filter((p) => p.expiry && p.expiry >= dateFrom);
    if (dateTo) list = list.filter((p) => p.expiry && p.expiry <= dateTo);
    if (sortPrice === "asc") list.sort((a, b) => a.price - b.price);
    if (sortPrice === "desc") list.sort((a, b) => b.price - a.price);
    return list;
  }, [products, filters]);

  useEffect(() => setPage(1), [filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = [
    filters.category !== "all",
    filters.dateFrom,
    filters.dateTo,
    filters.sortPrice !== "none",
  ].filter(Boolean).length;

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const handleSave = async (data) => {
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
  // baixo — por isso não editamos products.quantity direto pelo Supabase.
  const handleMovementSubmit = async ({ movementType, quantityDelta, note }) => {
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
    <div className="p-4 sm:p-6 lg:p-8 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Gestão de estoque</h2>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length} produto(s) encontrado(s)</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <TactileButton
            variant="secondary"
            onClick={() => setReportModalOpen(true)}
            padding="9px 16px"
            rounded={12}
          >
            <div className="flex items-center gap-2">
              <FileDown size={17} />
              <span>Gerar relatório</span>
            </div>
          </TactileButton>
          <TactileButton
            variant="amber"
            onClick={() => { setEditing(null); setModalOpen(true); }}
            padding="9px 16px"
            rounded={12}
          >
            <div className="flex items-center gap-2">
              <Plus size={17} />
              <span>Novo produto</span>
            </div>
          </TactileButton>
        </div>
      </div>

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
        onEdit={(p) => { setEditing(p); setModalOpen(true); }}
        onDelete={(p) => setDeleting(p)}
        onMovement={(p) => setMovingProduct(p)}
      />

      {modalOpen && (
        <ProductModal
          key={editing?.id || "new"}
          product={editing}
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
