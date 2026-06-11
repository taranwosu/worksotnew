"""
Expert payouts (Stripe Connect) — API surface, authorization and zero-state
tests. Full transfer execution requires a completed Stripe checkout + a fully
onboarded Express account, which can't run in an automated suite, so (like
the funding tests) these cover everything reachable over HTTP without
completing a real payment: status reporting, history, onboarding gating and
the admin panel endpoints.

Run:  pytest /app/backend/tests/test_worksoy_payouts.py -v --tb=short
"""
from __future__ import annotations

import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://wysiwyg-cms.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@worksoy.com"
ADMIN_PASSWORD = "WorkSoy!Admin2026"

RUN_ID = uuid.uuid4().hex[:6]


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _register(role: str, label: str) -> dict:
    email = f"TEST_{label}_{RUN_ID}_{uuid.uuid4().hex[:4]}@worksoy.com"
    password = "Passw0rd!42"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": password, "name": f"TEST {label} {RUN_ID}", "role": role},
        timeout=20,
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return {"token": r.json()["session_token"], "email": email, "password": password}


@pytest.fixture(scope="module")
def admin_token() -> str:
    r = requests.post(
        f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def fresh_expert() -> dict:
    bundle = _register("expert", "payexp")
    payload = {
        "headline": f"TEST Payout Expert {RUN_ID}",
        "category": "Engineering",
        "specialties": ["python", "fastapi"],
        "hourlyRate": 120,
        "location": "Remote",
        "yearsExperience": 6,
        "bio": "Test bio for payout integration tests — at least thirty characters required.",
        "image": None,
        "languages": ["English"],
        "certifications": [],
        "availability": "Available now",
    }
    r = requests.post(f"{API}/experts/me", headers=_auth_headers(bundle["token"]), json=payload, timeout=20)
    assert r.status_code == 200, f"create expert profile failed: {r.status_code} {r.text}"
    return bundle


@pytest.fixture(scope="module")
def fresh_client() -> dict:
    return _register("client", "paycli")


class TestPayoutStatus:
    def test_requires_auth(self):
        r = requests.get(f"{API}/me/payouts/status", timeout=15)
        assert r.status_code == 401

    def test_fresh_expert_not_connected(self, fresh_expert):
        r = requests.get(f"{API}/me/payouts/status", headers=_auth_headers(fresh_expert["token"]), timeout=15)
        assert r.status_code == 200, r.text
        s = r.json()
        for k in ("connected", "payouts_enabled", "details_submitted", "queued_count", "queued_net_amount"):
            assert k in s, f"missing key {k} in payout status"
        assert s["connected"] is False
        assert s["payouts_enabled"] is False
        assert s["queued_count"] == 0
        assert s["queued_net_amount"] == 0.0


class TestPayoutHistory:
    def test_requires_auth(self):
        r = requests.get(f"{API}/me/payouts", timeout=15)
        assert r.status_code == 401

    def test_empty_for_fresh_expert(self, fresh_expert):
        r = requests.get(f"{API}/me/payouts", headers=_auth_headers(fresh_expert["token"]), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json() == []


class TestPayoutOnboarding:
    def test_requires_auth(self):
        r = requests.post(f"{API}/me/payouts/onboard", timeout=15)
        assert r.status_code == 401

    def test_client_without_expert_profile_403(self, fresh_client):
        r = requests.post(f"{API}/me/payouts/onboard", headers=_auth_headers(fresh_client["token"]), timeout=15)
        assert r.status_code == 403

    def test_expert_gets_onboarding_link_or_clean_502(self, fresh_expert):
        # With a live Stripe (test) key this returns a hosted onboarding URL.
        # In environments with a placeholder key the endpoint must degrade to
        # a clean 502 — never a 500.
        r = requests.post(f"{API}/me/payouts/onboard", headers=_auth_headers(fresh_expert["token"]), timeout=30)
        assert r.status_code in (200, 502), r.text
        if r.status_code == 200:
            url = r.json().get("url", "")
            assert url.startswith("https://"), f"unexpected onboarding url: {url}"


class TestAdminPayouts:
    def test_list_requires_admin(self, fresh_expert):
        r = requests.get(f"{API}/admin/payouts", headers=_auth_headers(fresh_expert["token"]), timeout=15)
        assert r.status_code == 403

    def test_list_ok_for_admin(self, admin_token):
        r = requests.get(f"{API}/admin/payouts", headers=_auth_headers(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_list_filters_by_status(self, admin_token):
        r = requests.get(f"{API}/admin/payouts?status=queued", headers=_auth_headers(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        for p in r.json():
            assert p["status"] == "queued"

    def test_retry_requires_admin(self, fresh_expert):
        r = requests.post(
            f"{API}/admin/payouts/po_doesnotexist/retry",
            headers=_auth_headers(fresh_expert["token"]),
            timeout=15,
        )
        assert r.status_code == 403

    def test_retry_unknown_payout_404(self, admin_token):
        r = requests.post(
            f"{API}/admin/payouts/po_doesnotexist/retry",
            headers=_auth_headers(admin_token),
            timeout=15,
        )
        assert r.status_code == 404
