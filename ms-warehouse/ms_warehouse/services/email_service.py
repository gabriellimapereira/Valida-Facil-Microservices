"""
Envio de e-mail via SMTP. Se o SMTP não estiver configurado no .env,
a função apenas loga um aviso em vez de falhar — assim o resto da API
continua funcionando normalmente em ambiente de desenvolvimento.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from shared.config import settings

logger = logging.getLogger("valida_facil.email")


def send_email(to: str, subject: str, html_body: str) -> bool:
    if not settings.is_smtp_configured:
        logger.warning(
            "SMTP não configurado (.env incompleto) — e-mail para %s NÃO enviado. "
            "Assunto: %s",
            to,
            subject,
        )
        return False

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    message["To"] = to
    message.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            server.starttls()
            server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(settings.smtp_from_email, [to], message.as_string())
        return True
    except Exception:
        logger.exception("Falha ao enviar e-mail para %s", to)
        return False
