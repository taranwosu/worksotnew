"""Transactional email sender for WorkSoy.

Supports SendGrid (preferred) or generic SMTP. Both are opt-in via
environment variables; if neither is configured, ``send_email`` logs the
intended message and returns ``False`` so callers can branch on delivery.

Public API:
    await send_email(to, subject, html, text=None)
    is_email_enabled() -> bool

This module never raises on send failure — it logs and returns False — so
that a flaky provider does not break the surrounding business action.
"""
from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage
from typing import Optional

import httpx

log = logging.getLogger("worksoy.mailer")

SENDGRID_API_KEY = os.environ.get("SENDGRID_API_KEY", "").strip()
SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "").strip()
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_USE_TLS = os.environ.get("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes")

EMAIL_FROM = os.environ.get("EMAIL_FROM", "").strip()
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "WorkSoy").strip()


def is_email_enabled() -> bool:
    return bool((SENDGRID_API_KEY or SMTP_HOST) and EMAIL_FROM)


async def send_email(
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
) -> bool:
    """Send a transactional email. Returns True on success."""
    if not is_email_enabled():
        log.info(
            "[email-disabled] to=%s subject=%r (no provider configured)",
            to, subject,
        )
        return False

    text_body = text or _html_to_text(html)
    try:
        if SENDGRID_API_KEY:
            return await _send_via_sendgrid(to, subject, html, text_body)
        return await _send_via_smtp(to, subject, html, text_body)
    except Exception as e:  # noqa: BLE001
        log.exception("email send failed to=%s subject=%r err=%s", to, subject, e)
        return False


async def _send_via_sendgrid(to: str, subject: str, html: str, text: str) -> bool:
    payload = {
        "personalizations": [{"to": [{"email": to}]}],
        "from": {"email": EMAIL_FROM, "name": EMAIL_FROM_NAME},
        "subject": subject,
        "content": [
            {"type": "text/plain", "value": text},
            {"type": "text/html", "value": html},
        ],
    }
    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.post(
            "https://api.sendgrid.com/v3/mail/send",
            json=payload,
            headers={
                "Authorization": f"Bearer {SENDGRID_API_KEY}",
                "Content-Type": "application/json",
            },
        )
    if 200 <= r.status_code < 300:
        log.info("sendgrid sent to=%s subject=%r", to, subject)
        return True
    log.warning(
        "sendgrid rejected to=%s subject=%r status=%s body=%s",
        to, subject, r.status_code, r.text[:500],
    )
    return False


async def _send_via_smtp(to: str, subject: str, html: str, text: str) -> bool:
    msg = EmailMessage()
    msg["From"] = f"{EMAIL_FROM_NAME} <{EMAIL_FROM}>" if EMAIL_FROM_NAME else EMAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")

    # smtplib is sync; run in default loop executor to avoid blocking.
    import asyncio

    def _send_sync() -> bool:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as s:
            if SMTP_USE_TLS:
                s.starttls()
            if SMTP_USER:
                s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
        return True

    ok = await asyncio.get_event_loop().run_in_executor(None, _send_sync)
    if ok:
        log.info("smtp sent to=%s subject=%r", to, subject)
    return ok


def _html_to_text(html: str) -> str:
    """Cheap HTML-to-plain-text fallback. Good enough for transactional mail."""
    import re

    text = re.sub(r"<\s*br\s*/?\s*>", "\n", html, flags=re.IGNORECASE)
    text = re.sub(r"</\s*p\s*>", "\n\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
