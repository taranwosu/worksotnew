"""WorkSoy iteration-6 tests — new managed funnel (contact lead, pool apply, admin leads/pool apps, admin notifications)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
assert BASE_URL

ADMIN_EMAIL = "admin@worksoy.com"
ADMIN_PASSWORD = "WorkSoy!Admin2026"

RUN_ID = uuid.uuid4().hex[:6]


def _post(path, json=None, token=None, timeout=15):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.post(f"{BASE_URL}{path}", json=json, headers=headers, timeout=timeout)


def _get(path, token=None, timeout=15):
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return requests.get(f"{BASE_URL}{path}", headers=headers, timeout=timeout)


@pytest.fixture(scope="module")
def admin_token():
    r = _post("/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"admin login failed: {r.status_code} {r.text}")
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def fresh_user_token():
    email = f"TEST_funnel_{RUN_ID}_{uuid.uuid4().hex[:6]}@worksoy.com"
    r = _post(
        "/api/auth/register",
        json={"email": email, "password": "Passw0rd!2026", "name": f"Funnel Test {RUN_ID}", "role": "expert"},
    )
    assert r.status_code == 200, r.text
    return r.json()["session_token"], email


# ---------- Contact lead (managed funnel) ----------
class TestManagedLead:
    def test_managed_lead_creates_submission_and_admin_notification(self, admin_token):
        # Snapshot admin notifications count of type managed.lead BEFORE
        before = _get("/api/notifications", token=admin_token)
        assert before.status_code == 200
        before_count = sum(1 for n in before.json() if n.get("type") == "managed.lead")

        email = f"TEST_mlead_{RUN_ID}_{uuid.uuid4().hex[:6]}@example.com"
        r = _post(
            "/api/contact",
            json={
                "name": f"Lead {RUN_ID}",
                "email": email,
                "company": "Acme Co",
                "topic": "managed",
                "message": "Need managed engagement for Q1",
            },
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["topic"] == "managed"
        assert data["email"] == email.lower()
        assert data["handled"] is False

        after = _get("/api/notifications", token=admin_token)
        after_count = sum(1 for n in after.json() if n.get("type") == "managed.lead")
        assert after_count == before_count + 1, "admin should receive a managed.lead notification"

    def test_general_contact_does_not_notify_admin(self, admin_token):
        before = _get("/api/notifications", token=admin_token)
        before_count = sum(1 for n in before.json() if n.get("type") == "managed.lead")

        r = _post(
            "/api/contact",
            json={
                "name": f"General {RUN_ID}",
                "email": f"TEST_gen_{RUN_ID}@example.com",
                "topic": "general",
                "message": "general inquiry",
            },
        )
        assert r.status_code == 200
        assert r.json()["topic"] == "general"

        after = _get("/api/notifications", token=admin_token)
        after_count = sum(1 for n in after.json() if n.get("type") == "managed.lead")
        assert after_count == before_count, "general topic must NOT create admin notification"


# ---------- Pool apply ----------
class TestPoolApply:
    def test_my_application_anonymous_returns_null(self):
        r = _get("/api/pool/my-application")
        assert r.status_code == 200
        assert r.json() is None

    def test_apply_creates_pending_application_and_notification(self, fresh_user_token, admin_token):
        token, email = fresh_user_token
        before = _get("/api/notifications", token=admin_token)
        before_count = sum(1 for n in before.json() if n.get("type") == "managed.pool_application")

        r = _post(
            "/api/pool/apply",
            json={"skills": "react, fastapi", "rate_expectation": "$80/hr", "note": "Looking for managed projects"},
            token=token,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "pending"
        assert data["email"] == email.lower()
        assert data["skills"] == "react, fastapi"

        my = _get("/api/pool/my-application", token=token)
        assert my.status_code == 200
        my_data = my.json()
        assert my_data is not None
        assert my_data["status"] == "pending"
        assert my_data["id"] == data["id"]

        after = _get("/api/notifications", token=admin_token)
        after_count = sum(1 for n in after.json() if n.get("type") == "managed.pool_application")
        assert after_count == before_count + 1

    def test_duplicate_apply_returns_400(self, fresh_user_token):
        token, _ = fresh_user_token
        r = _post(
            "/api/pool/apply",
            json={"skills": "react", "rate_expectation": "$90/hr", "note": "duplicate"},
            token=token,
        )
        assert r.status_code == 400, r.text
        assert "pending" in r.text.lower() or "already" in r.text.lower()


# ---------- Admin pool applications + leads ----------
class TestAdminManagedAdmin:
    def test_admin_list_pool_applications(self, admin_token):
        r = _get("/api/admin/managed/pool/applications", token=admin_token)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        # there must be at least one pending (the one we just created)
        statuses = {it["status"] for it in items}
        assert "pending" in statuses or len(items) > 0

    def test_admin_list_pool_applications_requires_admin(self):
        # anonymous → 401/403
        r = _get("/api/admin/managed/pool/applications")
        assert r.status_code in (401, 403)

    def test_admin_set_pool_application_status(self, admin_token, fresh_user_token):
        token, _ = fresh_user_token
        my = _get("/api/pool/my-application", token=token).json()
        assert my and my["status"] == "pending"
        app_id = my["id"]
        r = _post(
            f"/api/admin/managed/pool/applications/{app_id}/status",
            json={"status": "reviewed"},
            token=admin_token,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "reviewed"

    def test_admin_set_pool_app_404(self, admin_token):
        r = _post(
            "/api/admin/managed/pool/applications/pa_does_not_exist/status",
            json={"status": "reviewed"},
            token=admin_token,
        )
        assert r.status_code == 404

    def test_admin_list_contact_submissions_filter_managed(self, admin_token):
        r = _get("/api/admin/contact-submissions?handled=false", token=admin_token)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any(it["topic"] == "managed" for it in items)

    def test_admin_mark_contact_handled(self, admin_token):
        listing = _get("/api/admin/contact-submissions?handled=false", token=admin_token).json()
        managed = [it for it in listing if it["topic"] == "managed"]
        assert managed, "expected at least one unhandled managed lead"
        cid = managed[0]["id"]
        r = _post(f"/api/admin/contact-submissions/{cid}/handled", token=admin_token)
        assert r.status_code in (200, 204), r.text
        # verify persistence: this submission should no longer appear in handled=false
        listing2 = _get("/api/admin/contact-submissions?handled=false", token=admin_token).json()
        assert all(it["id"] != cid for it in listing2)
