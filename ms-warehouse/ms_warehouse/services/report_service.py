"""
Geração de relatórios (PDF via WeasyPrint / Excel via pandas).

As consultas usam o cliente PostgreSQL do MS Warehouse recebido pelo router;
este módulo formata, agrega e transforma os resultados em arquivo.
"""

from datetime import date, datetime, timedelta
from io import BytesIO
from typing import Any

import pandas as pd
from ms_warehouse.data.categories import CATEGORY_LABELS
from ms_warehouse.schemas.report import ReportFormat, ReportRequest, ReportType
from ms_warehouse.utils.templating import render
from shared.database import DatabaseClient

CONTENT_TYPES = {
    ReportFormat.pdf: "application/pdf",
    ReportFormat.xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _brl(value: float) -> str:
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_qty(qty: int | float) -> str:
    if isinstance(qty, int) or qty.is_integer():
        return f"{int(qty):,}".replace(",", ".")
    return f"{qty:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_date(iso: str | None) -> str:
    if not iso:
        return "—"
    return datetime.fromisoformat(iso[:10]).strftime("%d/%m/%Y")


def _fmt_datetime(iso: str | None) -> str:
    if not iso:
        return "—"
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    return dt.strftime("%d/%m/%Y %H:%M")


# --------------------------------------------------------------------- #
# Coleta de dados (PostgreSQL)                                          #
# --------------------------------------------------------------------- #


def _fetch_products(client: DatabaseClient) -> list[dict]:
    return (
        client.table("products")
        .select("name, code, category, quantity, min_stock, price, expiry")
        .order("name")
        .execute()
        .data
        or []
    )


def _fetch_movements(
    client: DatabaseClient, date_from: date | None, date_to: date | None
) -> list[dict]:
    query = (
        client.table("stock_movements")
        .select(
            "id, movement_type, quantity_delta, note, created_at, product_id, products(name, code)"
        )
        .order("created_at", desc=True)
    )
    if date_from:
        query = query.gte("created_at", date_from.isoformat())
    if date_to:
        query = query.lte("created_at", (date_to + timedelta(days=1)).isoformat())
    return query.execute().data or []


# --------------------------------------------------------------------- #
# Construção de cada tipo de relatório                                  #
# --------------------------------------------------------------------- #


def _build_stock_snapshot(
    client: DatabaseClient, company_name: str
) -> tuple[pd.DataFrame, dict]:
    products = _fetch_products(client)
    rows = []
    for p in products:
        price = float(p.get("price") or 0)
        qty = int(p.get("quantity") or 0)
        min_stock = int(p.get("min_stock") or 0)
        total = price * qty
        low_stock = qty <= min_stock
        rows.append(
            {
                "name": p.get("name") or "—",
                "code": p.get("code") or "—",
                "category_label": CATEGORY_LABELS.get(
                    p.get("category", ""), p.get("category", "")
                ),
                "quantity": qty,
                "quantity_fmt": _fmt_qty(qty),
                "min_stock": min_stock,
                "low_stock": low_stock,
                "price": price,
                "price_fmt": _brl(price),
                "total": total,
                "total_fmt": _brl(total),
                "expiry_fmt": _fmt_date(p.get("expiry")),
            }
        )

    total_products = len(rows)
    items_in_stock_count = sum(1 for r in rows if r["quantity"] > 0)
    items_out_of_stock_count = sum(1 for r in rows if r["quantity"] == 0)
    low_stock_count = sum(1 for r in rows if r["low_stock"])
    total_quantity = sum(r["quantity"] for r in rows)
    total_value_num = sum(r["total"] for r in rows)

    context = {
        "products": rows,
        "total_products": total_products,
        "items_in_stock_count": items_in_stock_count,
        "items_out_of_stock_count": items_out_of_stock_count,
        "low_stock_count": low_stock_count,
        "total_quantity": total_quantity,
        "total_quantity_fmt": _fmt_qty(total_quantity),
        "total_value": _brl(total_value_num),
        "title": "Relatório de Estoque Atual",
        "subtitle": f"Data de Referência: {datetime.now().strftime('%d/%m/%Y')}",
        "filter_info": "Tipo de Estoque: Todos os itens cadastrados",
    }

    df = pd.DataFrame(
        [
            {
                "Produto": r["name"],
                "Código": r["code"],
                "Categoria": r["category_label"],
                "Quantidade": r["quantity"],
                "Preço unitário (R$)": r["price"],
                "Valor total (R$)": r["total"],
                "Validade": r["expiry_fmt"],
            }
            for r in rows
        ]
    )

    return df, context


def _build_movements(
    client: DatabaseClient,
    company_name: str,
    date_from: date | None,
    date_to: date | None,
) -> tuple[pd.DataFrame, dict]:
    movements = _fetch_movements(client, date_from, date_to)
    rows = []
    for m in movements:
        product = m.get("products") or {}
        delta = int(m.get("quantity_delta") or 0)
        rows.append(
            {
                "date_fmt": _fmt_datetime(m.get("created_at")),
                "product_name": product.get("name", "—"),
                "product_code": product.get("code", "—"),
                "movement_type": m.get("movement_type", "ajuste"),
                "delta_val": delta,
                "delta_fmt": f"{'+' if delta > 0 else ''}{_fmt_qty(delta)}",
                "note": m.get("note"),
            }
        )

    period_str = ""
    if date_from or date_to:
        d_from = date_from.strftime("%d/%m/%Y") if date_from else "Início"
        d_to = date_to.strftime("%d/%m/%Y") if date_to else "Hoje"
        period_str = f"Período: {d_from} até {d_to}"

    total_in = sum(1 for r in rows if r["movement_type"] == "entrada")
    total_out = sum(1 for r in rows if r["movement_type"] == "saida")
    total_adjust = sum(1 for r in rows if r["movement_type"] == "ajuste")
    net_units = sum(r["delta_val"] for r in rows)

    context = {
        "movements": rows,
        "total_movements": len(rows),
        "total_in": total_in,
        "total_out": total_out,
        "total_adjust": total_adjust,
        "net_units": net_units,
        "net_units_fmt": f"{'+' if net_units > 0 else ''}{_fmt_qty(net_units)}",
        "title": "Relatório de Movimentações",
        "subtitle": period_str or "Histórico completo de movimentações",
        "filter_info": "Entradas, saídas e ajustes de estoque",
    }

    df = pd.DataFrame(
        [
            {
                "Data": r["date_fmt"],
                "Produto": r["product_name"],
                "Código": r["product_code"],
                "Tipo": r["movement_type"],
                "Variação": r["delta_fmt"],
                "Observação": r["note"] or "",
            }
            for r in rows
        ]
    )

    return df, context


def _build_expiry(
    client: DatabaseClient, company_name: str, window_days: int
) -> tuple[pd.DataFrame, dict]:
    products = _fetch_products(client)
    cutoff = date.today() + timedelta(days=window_days)
    rows = []
    for p in products:
        if not p.get("expiry"):
            continue
        expiry_date = date.fromisoformat(p["expiry"][:10])
        if expiry_date > cutoff:
            continue
        price = float(p.get("price") or 0)
        qty = int(p.get("quantity") or 0)
        total = price * qty
        days_left = max((expiry_date - date.today()).days, 0)
        rows.append(
            {
                "name": p.get("name") or "—",
                "code": p.get("code") or "—",
                "category_label": CATEGORY_LABELS.get(
                    p.get("category", ""), p.get("category", "")
                ),
                "quantity": qty,
                "quantity_fmt": _fmt_qty(qty),
                "price": price,
                "total": total,
                "total_fmt": _brl(total),
                "expiry_fmt": _fmt_date(p.get("expiry")),
                "days_left": days_left,
            }
        )

    rows.sort(key=lambda r: r["days_left"])

    critical_count = sum(1 for r in rows if r["days_left"] <= 3)
    warning_count = sum(1 for r in rows if 3 < r["days_left"] <= 7)
    total_qty = sum(r["quantity"] for r in rows)
    total_risk_val = sum(r["total"] for r in rows)

    context = {
        "products": rows,
        "total": len(rows),
        "critical_count": critical_count,
        "warning_count": warning_count,
        "total_quantity": total_qty,
        "total_quantity_fmt": _fmt_qty(total_qty),
        "total_risk_value": _brl(total_risk_val),
        "window_days": window_days,
        "title": "Relatório de Produtos a Vencer",
        "subtitle": f"Janela de Análise: Próximos {window_days} dias",
        "filter_info": f"Itens perecíveis com validade até {cutoff.strftime('%d/%m/%Y')}",
    }

    df = pd.DataFrame(
        [
            {
                "Produto": r["name"],
                "Código": r["code"],
                "Quantidade": r["quantity"],
                "Vencimento": r["expiry_fmt"],
                "Dias restantes": r["days_left"],
            }
            for r in rows
        ]
    )

    return df, context


def _build_turnover(
    client: DatabaseClient,
    company_name: str,
    date_from: date | None,
    date_to: date | None,
) -> tuple[pd.DataFrame, dict]:
    movements = _fetch_movements(client, date_from, date_to)
    totals: dict[str, dict] = {}
    for m in movements:
        if m.get("movement_type") != "saida":
            continue
        product = m.get("products") or {}
        key = m.get("product_id") or product.get("name")
        entry = totals.setdefault(
            key,
            {
                "name": product.get("name", "—"),
                "code": product.get("code", "—"),
                "total_out": 0,
            },
        )
        entry["total_out"] += abs(int(m.get("quantity_delta") or 0))

    ranking = sorted(totals.values(), key=lambda r: r["total_out"], reverse=True)
    total_units = sum(r["total_out"] for r in ranking)

    for item in ranking:
        item["total_out_fmt"] = _fmt_qty(item["total_out"])
        item["share_pct"] = (
            round((item["total_out"] / total_units * 100), 1)
            if total_units > 0
            else 0.0
        )

    period_str = ""
    if date_from or date_to:
        d_from = date_from.strftime("%d/%m/%Y") if date_from else "Início"
        d_to = date_to.strftime("%d/%m/%Y") if date_to else "Hoje"
        period_str = f"Período: {d_from} até {d_to}"

    context = {
        "ranking": ranking,
        "total_products": len(ranking),
        "total_units": total_units,
        "total_units_fmt": _fmt_qty(total_units),
        "avg_units_per_product": round(total_units / len(ranking), 1)
        if ranking
        else 0.0,
        "top_product_name": ranking[0]["name"] if ranking else "—",
        "title": "Relatório de Giro de Estoque",
        "subtitle": period_str or "Histórico consolidado de saídas",
        "filter_info": "Curva de rotatividade e ranking de produtos",
    }

    df = pd.DataFrame(
        [
            {
                "Produto": r["name"],
                "Código": r["code"],
                "Total de saídas": r["total_out"],
                "Participação (%)": r["share_pct"],
            }
            for r in ranking
        ]
    )

    return df, context


BUILDERS = {
    ReportType.stock_snapshot: ("reports/stock_snapshot.html", _build_stock_snapshot),
    ReportType.expiry: ("reports/expiry.html", _build_expiry),
}


# --------------------------------------------------------------------- #
# Ponto de entrada                                                       #
# --------------------------------------------------------------------- #


def generate_report(
    client: DatabaseClient,
    company: str | dict[str, Any],
    request: ReportRequest,
) -> tuple[bytes, str, str]:
    if isinstance(company, dict):
        company_name = company.get("name") or "Empresa"
        company_data = company
        responsible_name = company.get("responsible_name") or "Responsável pelo Estoque"
    else:
        company_name = str(company)
        company_data = {"name": company_name}
        responsible_name = "Responsável pelo Estoque"

    generated_at = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    if request.report_type == ReportType.stock_snapshot:
        df, ctx = _build_stock_snapshot(client, company_name)
        template = "reports/stock_snapshot.html"
    elif request.report_type == ReportType.movements:
        df, ctx = _build_movements(
            client, company_name, request.date_from, request.date_to
        )
        template = "reports/movements.html"
    elif request.report_type == ReportType.expiry:
        df, ctx = _build_expiry(client, company_name, request.expiry_window_days)
        template = "reports/expiry.html"
    elif request.report_type == ReportType.turnover:
        df, ctx = _build_turnover(
            client, company_name, request.date_from, request.date_to
        )
        template = "reports/turnover.html"
    else:
        raise ValueError(f"Tipo de relatório desconhecido: {request.report_type}")

    ctx["company"] = company_data
    ctx["company_name"] = company_name
    ctx["responsible_name"] = responsible_name
    ctx["generated_at"] = generated_at

    slug = request.report_type.value
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    if request.format == ReportFormat.pdf:
        try:
            from weasyprint import HTML
        except Exception as err:
            raise RuntimeError(
                f"Biblioteca de geração de PDF indisponível no ambiente de execução: {err}"
            ) from err
        html_string = render(template, **ctx)
        content = HTML(string=html_string).write_pdf()
        filename = f"{slug}-{timestamp}.pdf"
    else:
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name=slug[:31])
        content = buffer.getvalue()
        filename = f"{slug}-{timestamp}.xlsx"

    return content, filename, CONTENT_TYPES[request.format]
