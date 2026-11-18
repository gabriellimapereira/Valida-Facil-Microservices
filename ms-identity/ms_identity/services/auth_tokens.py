"""Single-use tokens and SMTP delivery for Identity account actions."""

import hashlib
import secrets
import smtplib
from email.message import EmailMessage
from typing import Optional

from shared.config import settings


def issue_action_token(client, user_id: str, purpose: str) -> str:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with client.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO auth_action_tokens (token_hash, user_id, purpose, expires_at)
                VALUES (%s, %s, %s, NOW() + INTERVAL '1 hour')
                """,
                (token_hash, user_id, purpose),
            )
    return token


def validate_action_token(client, token: str, purpose: str) -> Optional[str]:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with client.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id::text AS user_id
                FROM auth_action_tokens
                WHERE token_hash = %s
                  AND purpose = %s
                  AND consumed_at IS NULL
                  AND expires_at > NOW()
                """,
                (token_hash, purpose),
            )
            row = cur.fetchone()
    return row["user_id"] if row else None


def consume_action_token(
    client, token: str, purpose: str, password_hash: str
) -> Optional[str]:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    with client.get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id::text AS user_id
                FROM auth_action_tokens
                WHERE token_hash = %s
                  AND purpose = %s
                  AND consumed_at IS NULL
                  AND expires_at > NOW()
                FOR UPDATE
                """,
                (token_hash, purpose),
            )
            row = cur.fetchone()
            if not row:
                return None

            cur.execute(
                "UPDATE users SET password_hash = %s, updated_at = NOW() WHERE id = %s",
                (password_hash, row["user_id"]),
            )
            cur.execute(
                "UPDATE auth_action_tokens SET consumed_at = NOW() WHERE token_hash = %s",
                (token_hash,),
            )
    return row["user_id"]


def send_action_email(to: str, subject: str, action_url: str) -> None:
    if not settings.is_smtp_configured:
        raise RuntimeError(
            "SMTP deve estar configurado para enviar convites e recuperação de senha."
        )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    message["To"] = to
    message.set_content(f"Acesse este link, válido por uma hora: {action_url}")
    message.add_alternative(
        f'<p>Acesse o link abaixo. Ele é válido por uma hora:</p><p><a href="{action_url}">Continuar</a></p>',
        subtype="html",
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)


def issue_and_send_action_email(client, user_id: str, email: str, purpose: str) -> None:
    token = issue_action_token(client, user_id, purpose)
    path = "/definir-senha" if purpose == "invitation" else "/redefinir-senha"
    action_url = f"{settings.frontend_url.rstrip('/')}{path}?token={token}"
    subject = (
        "Convite para Valida Fácil"
        if purpose == "invitation"
        else "Redefinição de senha do Valida Fácil"
    )
    try:
        send_action_email(email, subject, action_url)
    except Exception:
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        with client.get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM auth_action_tokens WHERE token_hash = %s",
                    (token_hash,),
                )
        raise
