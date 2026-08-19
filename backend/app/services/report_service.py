"""
Geração de relatórios (PDF via WeasyPrint / Excel via pandas).

Todas as consultas aqui usam o `client` recebido de fora — que é o client
autenticado do usuário que pediu o relatório (ver routers/reports.py). Ou
seja, o RLS do Postgres já garante que só vêm dados da empresa dele; este
arquivo só formata, agrega e transforma em arquivo.
"""
from datetime import date, datetime, timedelta
from io import BytesIO

import pandas as pd
from supabase import Client
from weasyprint import HTML

from app.data.categories import CATEGORY_LABELS
from app.schemas.report import ReportFormat, ReportRequest, ReportType
from app.utils.templating import render

CONTENT_TYPES = {
    ReportFormat.pdf: "application/pdf",
    ReportFormat.xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _brl(value: float) -> str:
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_date(iso: str | None) -> str:
    if not iso:
        return "—"
    return datetime.fromisoformat(iso[:10]).strftime("%d/%m/%Y")


# --------------------------------------------------------------------- #
# Coleta de dados (Supabase)                                            #
# --------------------------------------------------------------------- #

def _fetch_products(client: Client) -> list[dict]:
    return client.table("products").select("*").order("name").execute().data or []


def _fetch_movements(client: Client, date_from: date | None, date_to: date | None) -> list[dict]:
    query = client.table("stock_movements").select(
        "id, movement_type, quantity_delta, note, created_at, product_id, products(name, code)"
    ).order("created_at", desc=True)
    if date_from:
        query = query.gte("created_at", date_from.isoformat())
    if date_to:
        query = query.lte("created_at", (date_to + timedelta(days=1)).isoformat())
    return query.execute().data or []


# --------------------------------------------------------------------- #
# Construção de cada tipo de relatório                                  #
# --------------------------------------------------------------------- #

def _build_stock_snapshot(client: Client, company_name: str) -> tuple[pd.DataFrame, dict]:
    products = _fetch_products(client)
    rows = []
    for p in products:
        total = p["price"] * p["quantity"]
        rows.append({
            "name": p["name"], "code": p["code"],
            "category_label": CATEGORY_LABELS.get(p["category"], p["category"]),
            "quantity": p["quantity"], "low_stock": p["quantity"] <= p["min_stock"],
            "price_fmt": _brl(p["price"]), "total_fmt": _brl(total),
            "expiry_fmt": _fmt_date(p.get("expiry")),
            "price": p["price"], "total": total,
        })
    context = {
        "products": rows,
        "total_products": len(rows),
        "total_value": _brl(sum(r["total"] for r in rows)),
        "low_stock_count": sum(1 for r in rows if r["low_stock"]),
        "title": "Relatório de Estoque Atual",
        "subtitle": "Fotografia completa do estoque no momento da geração.",
    }
    df = pd.DataFrame([{
        "Produto": r["name"], "Código": r["code"], "Categoria": r["category_label"],
        "Quantidade": r["quantity"], "Preço unitário (R$)": r["price"], "Valor total (R$)": r["total"],
        "Validade": r["expiry_fmt"],
    } for r in rows])
    return df, context


def _build_movements(client: Client, company_name: str, date_from, date_to) -> tuple[pd.DataFrame, dict]:
    movements = _fetch_movements(client, date_from, date_to)
    rows = []
    for m in movements:
        product = m.get("products") or {}
        rows.append({
            "date_fmt": datetime.fromisoformat(m["created_at"].replace("Z", "+00:00")).strftime("%d/%m/%Y %H:%M"),
            "product_name": product.get("name", "—"), "product_code": product.get("code", "—"),
            "movement_type": m["movement_type"],
            "delta_fmt": f"{'+' if m['quantity_delta'] > 0 else ''}{m['quantity_delta']}",
            "note": m.get("note"),
        })
    period = ""
    if date_from or date_to:
        period = f"Período: {date_from.strftime('%d/%m/%Y') if date_from else '—'} até {date_to.strftime('%d/%m/%Y') if date_to else 'hoje'}"
    context = {
        "movements": rows, "total_movements": len(rows),
        "total_in": sum(1 for r in rows if r["movement_type"] == "entrada"),
        "total_out": sum(1 for r in rows if r["movement_type"] == "saida"),
        "title": "Relatório de Movimentações",
        "subtitle": period or "Todo o histórico disponível.",
    }
    df = pd.DataFrame([{
        "Data": r["date_fmt"], "Produto": r["product_name"], "Código": r["product_code"],
        "Tipo": r["movement_type"], "Variação": r["delta_fmt"], "Observação": r["note"] or "",
    } for r in rows])
    return df, context


def _build_expiry(client: Client, company_name: str, window_days: int) -> tuple[pd.DataFrame, dict]:
    products = _fetch_products(client)
    cutoff = date.today() + timedelta(days=window_days)
    rows = []
    for p in products:
        if not p.get("expiry"):
            continue
        expiry_date = date.fromisoformat(p["expiry"][:10])
        if expiry_date > cutoff:
            continue
        rows.append({
            "name": p["name"], "code": p["code"], "quantity": p["quantity"],
            "expiry_fmt": _fmt_date(p["expiry"]),
            "days_left": max((expiry_date - date.today()).days, 0),
        })
    rows.sort(key=lambda r: r["days_left"])
    context = {
        "products": rows, "total": len(rows), "window_days": window_days,
        "title": "Relatório de Produtos a Vencer",
        "subtitle": f"Produtos que vencem nos próximos {window_days} dias.",
    }
    df = pd.DataFrame([{
        "Produto": r["name"], "Código": r["code"], "Quantidade": r["quantity"],
        "Vencimento": r["expiry_fmt"], "Dias restantes": r["days_left"],
    } for r in rows])
    return df, context


def _build_turnover(client: Client, company_name: str, date_from, date_to) -> tuple[pd.DataFrame, dict]:
    movements = _fetch_movements(client, date_from, date_to)
    totals: dict[str, dict] = {}
    for m in movements:
        if m["movement_type"] != "saida":
            continue
        product = m.get("products") or {}
        key = m["product_id"]
        entry = totals.setdefault(key, {"name": product.get("name", "—"), "code": product.get("code", "—"), "total_out": 0})
        entry["total_out"] += abs(m["quantity_delta"])

    ranking = sorted(totals.values(), key=lambda r: r["total_out"], reverse=True)
    context = {
        "ranking": ranking, "total_products": len(ranking),
        "total_units": sum(r["total_out"] for r in ranking),
        "title": "Relatório de Giro de Estoque",
        "subtitle": "Produtos com mais saídas no período — ajuda a identificar os itens de maior rotatividade.",
    }
    df = pd.DataFrame([{
        "Produto": r["name"], "Código": r["code"], "Total de saídas": r["total_out"],
    } for r in ranking])
    return df, context


BUILDERS = {
    ReportType.stock_snapshot: ("reports/stock_snapshot.html", _build_stock_snapshot),
    ReportType.expiry: ("reports/expiry.html", _build_expiry),
}


# --------------------------------------------------------------------- #
# Ponto de entrada                                                       #
# --------------------------------------------------------------------- #

def generate_report(client: Client, company_name: str, request: ReportRequest) -> tuple[bytes, str, str]:
    generated_at = datetime.now().strftime("%d/%m/%Y %H:%M")

    if request.report_type == ReportType.stock_snapshot:
        df, ctx = _build_stock_snapshot(client, company_name)
        template = "reports/stock_snapshot.html"
    elif request.report_type == ReportType.movements:
        df, ctx = _build_movements(client, company_name, request.date_from, request.date_to)
        template = "reports/movements.html"
    elif request.report_type == ReportType.expiry:
        df, ctx = _build_expiry(client, company_name, request.expiry_window_days)
        template = "reports/expiry.html"
    elif request.report_type == ReportType.turnover:
        df, ctx = _build_turnover(client, company_name, request.date_from, request.date_to)
        template = "reports/turnover.html"
    else:
        raise ValueError(f"Tipo de relatório desconhecido: {request.report_type}")

    ctx["company_name"] = company_name
    ctx["generated_at"] = generated_at

    slug = request.report_type.value
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    if request.format == ReportFormat.pdf:
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
