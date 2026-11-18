"""
Lógica de movimentação de estoque.

A escrita em si (atualizar `products.quantity` + inserir em
`stock_movements`) acontece dentro de uma função do próprio Postgres
(`apply_stock_movement`, criada em `database/warehouse/init.sql`) para garantir que as
duas operações aconteçam de forma atômica — nunca fica um registro de
movimentação "órfão" sem a quantidade ter sido de fato atualizada, e
vice-versa. Esse arquivo só chama essa função via RPC e decide o que fazer
com o resultado (ex.: dispara e-mail se cruzou o estoque mínimo).
"""

import logging

from ms_warehouse.schemas.movement import MovementCreate, MovementResult
from ms_warehouse.services.email_service import send_email
from ms_warehouse.utils.templating import render
from shared.database import DatabaseClient

logger = logging.getLogger("valida_facil.stock")


def apply_movement(client: DatabaseClient, payload: MovementCreate) -> MovementResult:
    response = client.rpc(
        "apply_stock_movement",
        {
            "p_product_id": str(payload.product_id),
            "p_movement_type": payload.movement_type,
            "p_quantity_delta": payload.quantity_delta,
            "p_note": payload.note,
        },
    ).execute()

    data = response.data
    # O banco pode retornar a RPC como lista ou objeto único — normalizamos ambos.
    if isinstance(data, list):
        data = data[0] if data else {}

    if not data:
        raise ValueError("Não foi possível registrar a movimentação de estoque.")

    return MovementResult(**data)


def notify_low_stock_if_needed(result: MovementResult, company_name: str) -> None:
    if not result.crossed_low_stock or not result.notification_email:
        return

    html = render(
        "emails/low_stock.html",
        product_name=result.product_name,
        new_quantity=result.new_quantity,
        min_stock=result.min_stock,
        company_name=company_name,
    )
    send_email(
        to=result.notification_email,
        subject=f"⚠️ Estoque baixo — {result.product_name}",
        html_body=html,
    )


def list_low_stock(client: DatabaseClient) -> list[dict]:
    """Retorna os produtos da empresa do usuário logado (RLS aplica)
    que já estão em quantidade <= estoque mínimo."""
    resp = client.table("products").select("*").execute()
    products = resp.data or []
    return [p for p in products if p["quantity"] <= p["min_stock"]]
