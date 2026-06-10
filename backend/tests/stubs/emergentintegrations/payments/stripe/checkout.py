"""CI-only stand-in for the emergentintegrations Stripe checkout wrapper.

The real package is provided by the deployment platform and is not on public
PyPI, so CI can't install it. This stub mimics its surface closely enough to
boot the API and exercise every code path that doesn't require completing a
real payment: sessions are fabricated in memory, status lookups always come
back unpaid, and webhook handling always fails signature verification (CI
can't sign Stripe events anyway).

Activated by putting backend/tests/stubs on PYTHONPATH. Never ship this in a
deployment image — the real package must win there.
"""
from __future__ import annotations

import uuid

_SESSIONS: dict[str, "CheckoutSessionRequest"] = {}


class CheckoutSessionRequest:
    def __init__(self, amount, currency, success_url=None, cancel_url=None, metadata=None, **kwargs):
        self.amount = amount
        self.currency = currency
        self.success_url = success_url
        self.cancel_url = cancel_url
        self.metadata = metadata or {}


class CheckoutSessionResponse:
    def __init__(self, session_id: str, url: str):
        self.session_id = session_id
        self.url = url


class CheckoutStatusResponse:
    def __init__(self, status: str, payment_status: str, amount_total: int, currency: str):
        self.status = status
        self.payment_status = payment_status
        self.amount_total = amount_total
        self.currency = currency


class StripeCheckout:
    def __init__(self, api_key: str, webhook_url: str | None = None, **kwargs):
        self.api_key = api_key
        self.webhook_url = webhook_url

    async def create_checkout_session(self, req: CheckoutSessionRequest) -> CheckoutSessionResponse:
        session_id = f"cs_test_stub_{uuid.uuid4().hex}"
        _SESSIONS[session_id] = req
        return CheckoutSessionResponse(session_id, f"https://checkout.stripe.com/c/pay/{session_id}")

    async def get_checkout_status(self, session_id: str) -> CheckoutStatusResponse:
        req = _SESSIONS.get(session_id)
        if req is None:
            raise ValueError(f"unknown checkout session {session_id}")
        return CheckoutStatusResponse(
            status="open",
            payment_status="unpaid",
            amount_total=int(round(float(req.amount) * 100)),
            currency=req.currency,
        )

    async def handle_webhook(self, body: bytes, signature: str):
        raise ValueError("stub cannot verify webhook signatures")
