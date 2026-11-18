"""
Varredura de produtos próximos do vencimento — MS Warehouse.

Duas formas de uso:
  1) Sob demanda, para a empresa do usuário logado (client já respeita RLS).
  2) Pelo agendador (scheduler.py), varrendo empresas com produtos a vencer —
     nesse caso busca os IDs no catálogo do warehouse ou S2S com MS Identity.
"""

from datetime import date, timedelta
import logging
from typing import Any

from ms_warehouse.services.email_service import send_email
from ms_warehouse.utils.templating import render
from shared.config import settings
from shared.database import get_db

logger = logging.getLogger("valida_facil.expiry")


def _get_warehouse_client() -> Any:
    """Retorna o client para varredura do banco exclusivo do MS Warehouse."""
    return get_db("warehouse")


def _days_left(expiry_iso: str) -> int:
    expiry_date = date.fromisoformat(expiry_iso)
    return (expiry_date - date.today()).days


def _fetch_company_meta(client: Any, company_id: str) -> dict:
    """Busca os metadados da empresa no MS Identity, sem acessar seu banco."""
    import httpx

    url = f"{settings.identity_service_url.rstrip('/')}/internal/companies/{company_id}"
    try:
        response = httpx.get(
            url,
            headers={
                "X-Internal-Service-Token": settings.internal_service_secret,
                "X-Source-Service": "warehouse",
            },
            timeout=3.0,
        )
    except httpx.HTTPError as exc:
        logger.exception(
            "Falha ao consultar empresa %s via S2S no MS Identity.", company_id
        )
        raise RuntimeError(
            "Não foi possível consultar os dados da empresa no MS Identity."
        ) from exc

    if response.status_code == 404:
        return {}
    if response.status_code != 200:
        logger.error(
            "MS Identity respondeu HTTP %s ao consultar empresa %s.",
            response.status_code,
            company_id,
        )
        raise RuntimeError("MS Identity não conseguiu fornecer os dados da empresa.")
    return response.json()


def check_and_notify_company(
    client: Any, company_id: str, window_days: int = 15
) -> dict:
    cutoff = (date.today() + timedelta(days=window_days)).isoformat()

    resp = (
        client.table("products")
        .select("name, code, expiry")
        .eq("company_id", company_id)
        .not_.is_("expiry", "null")
        .lte("expiry", cutoff)
        .order("expiry")
        .execute()
    )
    rows = resp.data or []
    if not rows:
        return {"notified": False, "count": 0}

    company = _fetch_company_meta(client, company_id)
    notification_email = company.get("notification_email")
    if not notification_email:
        return {
            "notified": False,
            "count": len(rows),
            "reason": "empresa sem e-mail de notificação cadastrado",
        }

    products = [{**r, "days_left": max(_days_left(r["expiry"]), 0)} for r in rows]

    html = render(
        "emails/expiry_alert.html",
        company_name=company.get("name", ""),
        products=products,
        window_days=window_days,
    )
    sent = send_email(
        to=notification_email,
        subject=f"⏰ {len(products)} produto(s) vencendo em breve — {company.get('name', '')}",
        html_body=html,
    )
    return {
        "notified": sent,
        "count": len(products),
        "email": notification_email,
        "reason": (
            None
            if sent
            else (
                "SMTP não configurado no .env do backend"
                if not settings.is_smtp_configured
                else "Falha no envio de e-mail"
            )
        ),
    }


def run_expiry_check_all_companies(window_days: int = 15) -> list[dict]:
    """Job do scheduler — roda para empresas cadastradas no armazém."""
    client = _get_warehouse_client()
    prod_resp = client.table("products").select("company_id").execute()
    raw = prod_resp.data or []
    unique_ids = list({str(p["company_id"]) for p in raw if p.get("company_id")})
    companies = [{"id": cid} for cid in unique_ids]

    results = []
    logger.info("Iniciando varredura de validade para %d empresa(s).", len(companies))
    for company in companies:
        try:
            result = check_and_notify_company(
                client, company["id"], window_days=window_days
            )
            logger.info("Empresa %s: %s", company["id"], result)
            results.append({"company_id": company["id"], **result})
        except Exception as exc:
            logger.exception("Falha ao checar validade da empresa %s", company["id"])
            results.append(
                {"company_id": company["id"], "notified": False, "error": str(exc)}
            )
    return results
