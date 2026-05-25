"""
Iteration-4 backend tests — Toptal-style 5-stage vetting gauntlet,
hard gate on /api/experts directory + proposal submission, expert earnings/
invoices, client shortlists, and saved searches.

Run:  pytest /app/backend/tests/test_worksoy_vetting.py -v --tb=short \\
            --junitxml=/app/test_reports/pytest/worksoy_vetting.xml
"""
from __future__ import annotations

import os
import time
import uuid
from typing import Optional

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://skill-review-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@worksoy.com"
ADMIN_PASSWORD = "WorkSoy!Admin2026"

RUN_ID = uuid.uuid4().hex[:6]


# ----------------------------- helpers ---------------------------------------

def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _register(role: str, label: str) -> dict:
    """Register a fresh user and return {token, user, email, password}."""
    email = f"TEST_{label}_{RUN_ID}_{uuid.uuid4().hex[:4]}@worksoy.com"
    password = "Passw0rd!42"
    r = requests.post(
        f"{API}/auth/register",
        json={"email": email, "password": password, "name": f"TEST {label} {RUN_ID}", "role": role},
        timeout=20,
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    return {
        "token": body["session_token"],
        "user": body["user"],
        "email": email,
        "password": password,
    }


def _login(email: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["session_token"]


def _create_expert_profile(token: str, headline_suffix: str = "") -> dict:
    payload = {
        "headline": f"TEST Vetting Expert {RUN_ID} {headline_suffix}".strip(),
        "category": "Engineering",
        "specialties": ["python", "fastapi"],
        "hourlyRate": 120,
        "location": "Remote",
        "yearsExperience": 6,
        "bio": "Test bio for vetting integration tests — at least thirty characters required.",
        "image": None,
        "languages": ["English"],
        "certifications": [],
        "availability": "Available now",
    }
    r = requests.post(f"{API}/experts/me", headers=_auth_headers(token), json=payload, timeout=20)
    assert r.status_code == 200, f"create expert profile failed: {r.status_code} {r.text}"
    return r.json()


# ----------------------------- module fixtures -------------------------------

@pytest.fixture(scope="module")
def admin_token() -> str:
    return _login(ADMIN_EMAIL, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def fresh_expert() -> dict:
    """Fresh expert user + profile + vetting application (stage=language_personality)."""
    bundle = _register("expert", "exp")
    profile = _create_expert_profile(bundle["token"], headline_suffix="A")
    bundle["expert_id"] = profile["id"]
    return bundle


@pytest.fixture(scope="module")
def fresh_client() -> dict:
    return _register("client", "cli")


@pytest.fixture(scope="module")
def open_brief(fresh_client) -> dict:
    """Open brief owned by fresh_client so the fresh_expert can attempt to propose on it."""
    payload = {
        "title": f"TEST Vetting Gauntlet Brief {RUN_ID}",
        "description": "Need a senior Python engineer for two weeks of API work. Vetting hard-gate test brief.",
        "category": "Engineering",
        "required_skills": ["python", "fastapi"],
        "budget_min": 1000,
        "budget_max": 5000,
        "currency": "USD",
        "engagement_type": "fixed",
        "duration_weeks": 4,
        "remote_ok": True,
        "location": "Remote",
    }
    r = requests.post(f"{API}/briefs", headers=_auth_headers(fresh_client["token"]), json=payload, timeout=20)
    assert r.status_code == 200, f"create brief failed: {r.status_code} {r.text}"
    return r.json()


# ============================ TESTS ==========================================

# --- Smoke ----------------------------------------------------------------------
class TestSmoke:
    def test_health(self):
        r = requests.get(f"{API}/health", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 0

    def test_register_and_login_roundtrip(self, fresh_expert):
        # Confirm we can re-login with the same creds and receive a new token
        token2 = _login(fresh_expert["email"], fresh_expert["password"])
        assert isinstance(token2, str) and len(token2) > 0


# --- Public experts directory --------------------------------------------------
class TestExpertsDirectory:
    def test_lists_25_approved_experts(self):
        r = requests.get(f"{API}/experts", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # 25 from seed.py — fresh unverified experts must NOT be present.
        assert len(data) >= 25, f"expected ≥25 approved experts, got {len(data)}"
        for e in data:
            assert e.get("verified") is True, f"experts list contains unverified expert: {e.get('id')}"

    def test_unverified_expert_hidden(self, fresh_expert):
        r = requests.get(f"{API}/experts", timeout=15)
        ids = {e["id"] for e in r.json()}
        assert fresh_expert["expert_id"] not in ids, "unverified expert leaked into public directory"


# --- Vetting flow happy path ---------------------------------------------------
class TestVettingFlow:
    def test_get_my_vetting_when_no_profile_returns_404(self):
        # Register a brand-new user with no expert profile yet.
        bundle = _register("expert", "novp")
        r = requests.get(f"{API}/vetting/me", headers=_auth_headers(bundle["token"]), timeout=15)
        assert r.status_code == 404

    def test_upsert_profile_starts_application(self, fresh_expert):
        # Profile already created via fixture; just confirm GET /api/vetting/me returns it at language_personality.
        r = requests.get(f"{API}/vetting/me", headers=_auth_headers(fresh_expert["token"]), timeout=15)
        assert r.status_code == 200, r.text
        app = r.json()
        assert app["stage"] == "language_personality"
        assert app["user_id"] == fresh_expert["user"]["user_id"]
        assert app["expert_id"] == fresh_expert["expert_id"]

    def test_profile_isPublished_false_and_verified_false(self, fresh_expert, admin_token):
        # Use admin list to inspect raw flags
        r = requests.get(f"{API}/admin/experts", headers=_auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        rec = next((e for e in r.json() if e["id"] == fresh_expert["expert_id"]), None)
        assert rec is not None, "fresh expert missing from admin list"
        assert rec.get("verified") is False
        assert rec.get("isPublished") is False
        assert rec.get("vetting_stage") == "language_personality"

    def test_submit_language(self, fresh_expert):
        payload = {
            "timezone": "America/New_York",
            "weekly_hours": 40,
            "english_self_rating": 5,
            "communication_style": "Async-first, concise, daily status updates with screenshots and metrics.",
            "why_worksoy": "I want to work with vetted clients on impactful problems and grow my portfolio steadily.",
        }
        r = requests.post(f"{API}/vetting/language", headers=_auth_headers(fresh_expert["token"]), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["stage"] == "skill_quiz"

    def test_submit_skill(self, fresh_expert):
        payload = {
            "case_study": (
                "Migrated a monolithic Django service to a FastAPI + Mongo stack handling 2k rps, "
                "reducing p95 from 400ms to 90ms and cutting infra cost by ~38% over one quarter."
            ),
            "portfolio_url": "https://example.com/portfolio",
            "methodology": (
                "I start with a measurable hypothesis, ship small reversible changes, and instrument every "
                "release with structured logs and SLO dashboards before scaling traffic."
            ),
        }
        r = requests.post(f"{API}/vetting/skill", headers=_auth_headers(fresh_expert["token"]), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["stage"] == "screening_call"

    def test_admin_lists_screening_applications(self, fresh_expert, admin_token):
        r = requests.get(
            f"{API}/admin/vetting/applications",
            headers=_auth_headers(admin_token),
            params={"stage": "screening_call"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        match = next((row for row in data if row["application"]["user_id"] == fresh_expert["user"]["user_id"]), None)
        assert match is not None, "expert not listed in screening_call admin queue"
        # Backend normalises emails to lowercase on register — compare case-insensitively
        assert match["user"]["email"].lower() == fresh_expert["email"].lower()
        assert match["expert"] is not None
        assert match["expert"]["id"] == fresh_expert["expert_id"]

    def test_admin_record_screening_call(self, fresh_expert, admin_token):
        # Find application id from admin list
        r = requests.get(f"{API}/admin/vetting/applications",
                         headers=_auth_headers(admin_token), timeout=15)
        assert r.status_code == 200
        row = next(row for row in r.json() if row["application"]["user_id"] == fresh_expert["user"]["user_id"])
        app_id = row["application"]["id"]
        fresh_expert["app_id"] = app_id

        r = requests.post(
            f"{API}/admin/vetting/{app_id}/screening-call",
            headers=_auth_headers(admin_token),
            json={"scheduled_at": "2026-02-15T10:00:00Z", "notes": "TEST screening — solid communication.", "passed": True},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["screening_passed"] is True
        assert body["screening_notes"].startswith("TEST screening")

    def test_admin_assign_test_project(self, fresh_expert, admin_token):
        app_id = fresh_expert["app_id"]
        payload = {
            "title": f"TEST Vetting Project {RUN_ID}",
            "description": "Build a small CRUD endpoint with tests demonstrating async patterns and validation.",
            "deliverables": ["Repo URL", "Loom walkthrough"],
            "due_at": None,
        }
        r = requests.post(
            f"{API}/admin/vetting/{app_id}/assign-test-project",
            headers=_auth_headers(admin_token),
            json=payload,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        tp = r.json()
        assert tp["status"] == "assigned"
        assert tp["title"].startswith("TEST Vetting Project")
        fresh_expert["test_project_id"] = tp["id"]

        # Expert can fetch their assigned project
        r2 = requests.get(f"{API}/vetting/test-project", headers=_auth_headers(fresh_expert["token"]), timeout=15)
        assert r2.status_code == 200, r2.text
        assert r2.json()["id"] == tp["id"]

        # Application stage advanced to test_project
        r3 = requests.get(f"{API}/vetting/me", headers=_auth_headers(fresh_expert["token"]), timeout=15)
        assert r3.json()["stage"] == "test_project"

    def test_expert_submit_test_project(self, fresh_expert):
        r = requests.post(
            f"{API}/vetting/test-project/submit",
            headers=_auth_headers(fresh_expert["token"]),
            json={"submission_note": "Submitted the repo + Loom link — see attached.", "file_ids": []},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "submitted"

        # Resubmitting should now 400 (already submitted)
        r2 = requests.post(
            f"{API}/vetting/test-project/submit",
            headers=_auth_headers(fresh_expert["token"]),
            json={"submission_note": "Trying to resubmit which should fail.", "file_ids": []},
            timeout=15,
        )
        assert r2.status_code == 400

    def test_admin_review_test_project_passed(self, fresh_expert, admin_token):
        app_id = fresh_expert["app_id"]
        r = requests.post(
            f"{API}/admin/vetting/{app_id}/test-project/review",
            headers=_auth_headers(admin_token),
            params={"passed": "true"},
            json={"note": "TEST passed review"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "passed"

    def test_admin_advance_to_approved(self, fresh_expert, admin_token):
        app_id = fresh_expert["app_id"]
        # Currently at test_project — one advance should land on approved.
        r = requests.post(
            f"{API}/admin/vetting/{app_id}/advance",
            headers=_auth_headers(admin_token),
            json={"note": "All good — approving."},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["stage"] == "approved"

        # Advancing past approved must 400
        r2 = requests.post(
            f"{API}/admin/vetting/{app_id}/advance",
            headers=_auth_headers(admin_token),
            json={"note": "should fail"},
            timeout=15,
        )
        assert r2.status_code == 400

    def test_approved_expert_now_in_directory(self, fresh_expert):
        r = requests.get(f"{API}/experts", timeout=15)
        ids = {e["id"] for e in r.json()}
        assert fresh_expert["expert_id"] in ids, "approved expert not in public directory"


# --- Hard gate on proposals ----------------------------------------------------
class TestHardGate:
    def test_unverified_expert_cannot_propose(self, open_brief):
        """Register another fresh expert (still at language_personality) and try to propose — must 403."""
        gated = _register("expert", "gate")
        _create_expert_profile(gated["token"], headline_suffix="B")
        r = requests.post(
            f"{API}/briefs/{open_brief['id']}/proposals",
            headers=_auth_headers(gated["token"]),
            json={
                "cover_letter": "I'd love to take this on — I match every required skill listed in the brief.",
                "proposed_rate": 100,
                "rate_type": "fixed",
                "estimated_duration_weeks": 3,
            },
            timeout=15,
        )
        assert r.status_code == 403, f"expected 403 hard gate, got {r.status_code} {r.text}"
        detail = (r.json().get("detail") or "").lower()
        assert "vetting" in detail, f"403 detail did not mention vetting: {detail}"

    def test_approved_expert_can_propose(self, fresh_expert, open_brief):
        r = requests.post(
            f"{API}/briefs/{open_brief['id']}/proposals",
            headers=_auth_headers(fresh_expert["token"]),
            json={
                "cover_letter": "Approved expert proposal — happy to start next Monday on the FastAPI work.",
                "proposed_rate": 130,
                "rate_type": "fixed",
                "estimated_duration_weeks": 3,
            },
            timeout=15,
        )
        assert r.status_code == 200, f"approved expert proposal failed: {r.status_code} {r.text}"
        body = r.json()
        assert body["brief_id"] == open_brief["id"]
        assert body["status"] == "pending"


# --- Reject path ---------------------------------------------------------------
class TestRejectPath:
    def test_admin_reject_application(self, admin_token):
        # Create a fully separate expert, push to skill_quiz then reject.
        reject_bundle = _register("expert", "rej")
        _create_expert_profile(reject_bundle["token"], headline_suffix="R")
        # Submit language to advance to skill_quiz so the app exists with some history
        requests.post(
            f"{API}/vetting/language",
            headers=_auth_headers(reject_bundle["token"]),
            json={
                "timezone": "UTC",
                "weekly_hours": 30,
                "english_self_rating": 4,
                "communication_style": "Async first with daily standups, written summaries, and weekly demos.",
                "why_worksoy": "Looking for a curated marketplace with high-quality briefs and trustworthy operators.",
            },
            timeout=15,
        )
        my_app = requests.get(f"{API}/vetting/me", headers=_auth_headers(reject_bundle["token"]), timeout=15).json()
        r = requests.post(
            f"{API}/admin/vetting/{my_app['id']}/reject",
            headers=_auth_headers(admin_token),
            json={"note": "TEST rejection — insufficient case study depth."},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["stage"] == "rejected"

        # The rejected expert MUST stay hidden from /api/experts
        ids = {e["id"] for e in requests.get(f"{API}/experts", timeout=15).json()}
        # we need the expert_id — pull from admin list
        admin_experts = requests.get(f"{API}/admin/experts", headers=_auth_headers(admin_token), timeout=15).json()
        rec = next((e for e in admin_experts if e.get("user_id") == reject_bundle["user"]["user_id"]), None)
        assert rec is not None
        assert rec["vetting_stage"] == "rejected"
        assert rec["isPublished"] is False
        assert rec["id"] not in ids


# --- Admin authZ ---------------------------------------------------------------
class TestAdminAuthZ:
    def test_non_admin_blocked(self, fresh_client):
        r = requests.get(
            f"{API}/admin/vetting/applications",
            headers=_auth_headers(fresh_client["token"]),
            timeout=15,
        )
        assert r.status_code == 403

    def test_unauth_blocked(self):
        r = requests.get(f"{API}/admin/vetting/applications", timeout=15)
        assert r.status_code in (401, 403)


# --- Earnings + invoices -------------------------------------------------------
class TestEarningsInvoices:
    def test_earnings_zero_for_fresh_expert(self, fresh_expert):
        r = requests.get(f"{API}/me/earnings", headers=_auth_headers(fresh_expert["token"]), timeout=15)
        assert r.status_code == 200, r.text
        e = r.json()
        for k in ("lifetime_released", "in_escrow", "pending", "active_contracts", "completed_contracts"):
            assert k in e, f"missing key {k} in earnings response"
        assert e["lifetime_released"] == 0.0
        assert e["in_escrow"] == 0.0
        assert e["pending"] == 0.0
        assert e["active_contracts"] == 0
        assert e["completed_contracts"] == 0

    def test_invoices_empty_for_fresh_expert(self, fresh_expert):
        r = requests.get(f"{API}/me/invoices", headers=_auth_headers(fresh_expert["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json() == []


# --- Shortlists ----------------------------------------------------------------
class TestShortlists:
    def test_initial_empty(self, fresh_client):
        r = requests.get(f"{API}/me/shortlists", headers=_auth_headers(fresh_client["token"]), timeout=15)
        assert r.status_code == 200
        assert r.json() == []

    def test_add_and_get(self, fresh_client):
        # pick a seeded approved expert
        experts = requests.get(f"{API}/experts", timeout=15).json()
        assert experts, "no seeded experts"
        target = experts[0]["id"]
        fresh_client["shortlist_expert_id"] = target

        r = requests.post(
            f"{API}/me/shortlists",
            headers=_auth_headers(fresh_client["token"]),
            json={"expert_id": target, "note": "TEST shortlist note"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["expert_id"] == target
        assert body["expert"] is not None
        assert body["expert"]["id"] == target

        r2 = requests.get(f"{API}/me/shortlists", headers=_auth_headers(fresh_client["token"]), timeout=15)
        assert r2.status_code == 200
        items = r2.json()
        assert any(it["expert_id"] == target for it in items)

    def test_duplicate_blocked(self, fresh_client):
        target = fresh_client["shortlist_expert_id"]
        r = requests.post(
            f"{API}/me/shortlists",
            headers=_auth_headers(fresh_client["token"]),
            json={"expert_id": target},
            timeout=15,
        )
        assert r.status_code == 400

    def test_delete(self, fresh_client):
        target = fresh_client["shortlist_expert_id"]
        r = requests.delete(f"{API}/me/shortlists/{target}", headers=_auth_headers(fresh_client["token"]), timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/me/shortlists", headers=_auth_headers(fresh_client["token"]), timeout=15)
        assert all(it["expert_id"] != target for it in r2.json())


# --- Saved searches ------------------------------------------------------------
class TestSavedSearches:
    def test_full_crud(self, fresh_client):
        r = requests.get(f"{API}/me/saved-searches", headers=_auth_headers(fresh_client["token"]), timeout=15)
        assert r.status_code == 200
        initial = r.json()

        payload = {"name": f"TEST search {RUN_ID}", "query": "python", "category": "Engineering", "sort": "top_rated"}
        c = requests.post(
            f"{API}/me/saved-searches",
            headers=_auth_headers(fresh_client["token"]),
            json=payload,
            timeout=15,
        )
        assert c.status_code == 200, c.text
        body = c.json()
        sid = body["id"]
        assert body["name"] == payload["name"]
        assert body["query"] == payload["query"]
        assert body["category"] == payload["category"]
        assert body["sort"] == payload["sort"]

        # Listed
        r2 = requests.get(f"{API}/me/saved-searches", headers=_auth_headers(fresh_client["token"]), timeout=15)
        assert any(s["id"] == sid for s in r2.json())
        assert len(r2.json()) == len(initial) + 1

        # Delete
        d = requests.delete(
            f"{API}/me/saved-searches/{sid}",
            headers=_auth_headers(fresh_client["token"]),
            timeout=15,
        )
        assert d.status_code == 200

        r3 = requests.get(f"{API}/me/saved-searches", headers=_auth_headers(fresh_client["token"]), timeout=15)
        assert all(s["id"] != sid for s in r3.json())
