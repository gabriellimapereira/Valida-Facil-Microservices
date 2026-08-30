"""
Varredura de produtos próximos do vencimento.

Duas formas de uso:
  1) Sob demanda, para a empresa do usuário logado (client já respeita RLS).
  2) Pelo agendador (scheduler.py), varrendo TODAS as empresas de uma vez —
     nesse caso usa-se o service_client (ignora RLS por necessidade, já que
     não há usuário logado), e por isso aqui SEMPRE filtramos
     explicitamente por company_id a cada iteração, nunca devolvendo dados
     de uma empresa misturados com os de outra.
"""
import logging
from datetime import date, timedelta

from supabase import Client

from app.config import settings
from app.core.supabase_client import service_client
from app.services.email_service import send_email
from app.utils.templating import render

logger = logging.getLogger("valida_facil.expiry")


def _days_left(expiry_iso: str) -> int:
    expiry_date = date.fromisoformat(expiry_iso)
    return (expiry_date - date.today()).days


def check_and_notify_company(client: Client, company_id: str, window_days: int = 15) -> dict:
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

    company_resp = client.table("companies").select("name, notification_email").eq("id", company_id).maybe_single().execute()
    company = company_resp.data or {}
    notification_email = company.get("notification_email")
    if not notification_email:
        return {"notified": False, "count": len(rows), "reason": "empresa sem e-mail de notificação cadastrado"}

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
        "reason": None if sent else ("SMTP não configurado no .env do backend" if not settings.is_smtp_configured else "Falha no envio de e-mail"),
    }


def run_expiry_check_all_companies(window_days: int = 15) -> None:
    """Job do scheduler — roda para todas as empresas cadastradas."""
    client = service_client()
    companies_resp = client.table("companies").select("id").execute()
    companies = companies_resp.data or []

    logger.info("Iniciando varredura de validade para %d empresa(s).", len(companies))
    for company in companies:
        try:
            result = check_and_notify_company(client, company["id"], window_days=window_days)
            logger.info("Empresa %s: %s", company["id"], result)
        except Exception:
            logger.exception("Falha ao checar validade da empresa %s", company["id"])
