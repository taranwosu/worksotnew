"""
WorkSoy managed contractor service tests.
Covers the back-office pool, managed clients & charge ledger, the full task
delivery loop (request -> accept -> assign -> in_progress -> submitted ->
delivered -> completed, with an admin-rejected revision in the middle),
client-visibility rules and internal performance ratings.
"""
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

RUN = uuid.uuid4().hex[:8]
CLIENT_EMAIL = f"TEST_managed_client_{RUN}@worksoy.com"
POOL_EMAIL = f"TEST_pool_expert_{RUN}@worksoy.com"


def _register_or_login(email, password, name="Test", role="client"):
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": password, "name": name, "role": role},
        timeout=15,
    )
    if r.status_code == 200:
        return r.json()["session_token"]
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    return _register_or_login(ADMIN_EMAIL, ADMIN_PASSWORD, name="Admin")


@pytest.fixture(scope="module")
def client_token():
    return _register_or_login(CLIENT_EMAIL, "Passw0rd!", name="Managed Client", role="client")


@pytest.fixture(scope="module")
def pool_token():
    return _register_or_login(POOL_EMAIL, "Passw0rd!", name="Pool Expert", role="expert")


@pytest.fixture(scope="module")
def state():
    return {}


def test_01_pool_member_setup(admin_token, pool_token, state):
    # Expert profile + verification is the eligibility gate for the pool.
    r = requests.post(
        f"{BASE_URL}/api/experts/me",
        headers=_h(pool_token),
        json={
            "headline": "Managed pool test expert",
            "category": "Design & UX",
            "specialties": ["Brand"],
            "hourlyRate": 120,
            "location": "Remote",
            "yearsExperience": 8,
            "bio": "Managed-service test expert profile, long enough bio text.",
        },
        timeout=15,
    )
    assert r.status_code == 200, r.text
    expert_id = r.json()["id"]
    r = requests.post(f"{BASE_URL}/api/admin/experts/{expert_id}/verify", headers=_h(admin_token), timeout=15)
    assert r.status_code == 200, r.text

    r = requests.get(f"{BASE_URL}/api/admin/managed/pool/eligible", headers=_h(admin_token), timeout=15)
    assert r.status_code == 200, r.text
    assert any(e["id"] == expert_id for e in r.json())

    r = requests.post(
        f"{BASE_URL}/api/admin/managed/pool",
        headers=_h(admin_token),
        json={"expert_id": expert_id, "cost_rate": 60, "cost_rate_type": "hourly", "internal_notes": "test"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    state["pool_member_id"] = r.json()["id"]

    # duplicate active membership is rejected
    r = requests.post(
        f"{BASE_URL}/api/admin/managed/pool",
        headers=_h(admin_token),
        json={"expert_id": expert_id, "cost_rate": 60},
        timeout=15,
    )
    assert r.status_code == 400

    # the freelancer can see their membership, without internal fields
    r = requests.get(f"{BASE_URL}/api/pool/me", headers=_h(pool_token), timeout=15)
    assert r.status_code == 200 and r.json() and r.json()["id"] == state["pool_member_id"]
    assert "internal_notes" not in r.json()


def test_02_managed_client_setup(admin_token, client_token, state):
    r = requests.post(
        f"{BASE_URL}/api/admin/managed/clients",
        headers=_h(admin_token),
        json={
            "owner_email": CLIENT_EMAIL,
            "company_name": f"Test Co {RUN}",
            "plan_type": "monthly_retainer",
            "plan_rate": 4000,
            "internal_notes": "internal",
        },
        timeout=15,
    )
    assert r.status_code == 200, r.text
    state["client_id"] = r.json()["id"]

    r = requests.get(f"{BASE_URL}/api/managed/me", headers=_h(client_token), timeout=15)
    assert r.status_code == 200 and r.json()["id"] == state["client_id"]
    assert "internal_notes" not in r.json()


def test_03_task_request_and_assignment(admin_token, client_token, pool_token, state):
    r = requests.post(
        f"{BASE_URL}/api/managed/tasks",
        headers=_h(client_token),
        json={"title": f"Test task {RUN}", "description": "Managed delivery loop test task.", "priority": "high"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    state["task_id"] = r.json()["id"]
    assert r.json()["status"] == "requested"

    tid = state["task_id"]
    # assign before accept is an illegal transition
    r = requests.post(
        f"{BASE_URL}/api/admin/managed/tasks/{tid}/assign",
        headers=_h(admin_token),
        json={"pool_member_id": state["pool_member_id"]},
        timeout=15,
    )
    assert r.status_code == 400

    r = requests.post(f"{BASE_URL}/api/admin/managed/tasks/{tid}/accept", headers=_h(admin_token), timeout=15)
    assert r.status_code == 200 and r.json()["status"] == "accepted"
    r = requests.post(
        f"{BASE_URL}/api/admin/managed/tasks/{tid}/assign",
        headers=_h(admin_token),
        json={"pool_member_id": state["pool_member_id"]},
        timeout=15,
    )
    assert r.status_code == 200 and r.json()["status"] == "assigned"

    r = requests.get(f"{BASE_URL}/api/pool/tasks", headers=_h(pool_token), timeout=15)
    assert r.status_code == 200
    mine = [t for t in r.json() if t["id"] == tid]
    assert mine and "admin_notes" not in mine[0]

    r = requests.post(f"{BASE_URL}/api/pool/tasks/{tid}/start", headers=_h(pool_token), timeout=15)
    assert r.status_code == 200 and r.json()["status"] == "in_progress"


def _upload(tok, tid, name, content):
    r = requests.post(
        f"{BASE_URL}/api/files/upload",
        headers={"Authorization": f"Bearer {tok}"},
        files={"file": (name, content, "image/png")},
        data={"managed_task_id": tid},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _submit(tok, tid, fid, note=None):
    r = requests.post(
        f"{BASE_URL}/api/pool/tasks/{tid}/deliverables",
        headers=_h(tok),
        json={"note": note, "file_ids": [fid]},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_04_deliverable_review_gate(admin_token, client_token, pool_token, state):
    tid = state["task_id"]
    f1 = _upload(pool_token, tid, "v1.png", b"\x89PNG v1")
    d1 = _submit(pool_token, tid, f1, "first pass")
    assert d1["version"] == 1

    # client must not see the unreleased deliverable or its file
    r = requests.get(f"{BASE_URL}/api/managed/tasks/{tid}", headers=_h(client_token), timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "in_progress"  # back-office statuses collapsed
    assert body["deliverables"] == []
    r = requests.get(f"{BASE_URL}/api/files/{f1}", headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
    assert r.status_code == 403

    # admin rejects -> freelancer sees the note, client sees nothing internal
    r = requests.post(
        f"{BASE_URL}/api/admin/managed/deliverables/{d1['id']}/review",
        headers=_h(admin_token),
        json={"action": "reject", "note": "fix spacing"},
        timeout=15,
    )
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    r = requests.get(f"{BASE_URL}/api/pool/tasks/{tid}", headers=_h(pool_token), timeout=15)
    assert r.json()["deliverables"][0]["review_note"] == "fix spacing"
    r = requests.get(f"{BASE_URL}/api/managed/tasks/{tid}", headers=_h(client_token), timeout=15)
    assert all(e.get("visibility") != "internal" for e in r.json()["events"])

    # resubmit and approve -> released to client
    f2 = _upload(pool_token, tid, "v2.png", b"\x89PNG v2")
    d2 = _submit(pool_token, tid, f2)
    r = requests.post(
        f"{BASE_URL}/api/admin/managed/deliverables/{d2['id']}/review",
        headers=_h(admin_token),
        json={"action": "approve"},
        timeout=15,
    )
    assert r.status_code == 200 and r.json()["status"] == "approved"

    r = requests.get(f"{BASE_URL}/api/managed/tasks/{tid}", headers=_h(client_token), timeout=15)
    body = r.json()
    assert body["status"] == "delivered"
    assert len(body["deliverables"]) == 1
    r = requests.get(f"{BASE_URL}/api/files/{f2}", headers={"Authorization": f"Bearer {client_token}"}, timeout=15)
    assert r.status_code == 200

    state["file_v2"] = f2


def test_05_completion_and_rating(admin_token, client_token, state):
    tid = state["task_id"]
    r = requests.post(f"{BASE_URL}/api/managed/tasks/{tid}/complete", headers=_h(client_token), timeout=15)
    assert r.status_code == 200 and r.json()["status"] == "completed"

    r = requests.post(
        f"{BASE_URL}/api/admin/managed/tasks/{tid}/rate",
        headers=_h(admin_token),
        json={"score": 5, "notes": "great"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    # one rating per task
    r = requests.post(
        f"{BASE_URL}/api/admin/managed/tasks/{tid}/rate",
        headers=_h(admin_token),
        json={"score": 4},
        timeout=15,
    )
    assert r.status_code == 400

    r = requests.get(
        f"{BASE_URL}/api/admin/managed/pool/{state['pool_member_id']}", headers=_h(admin_token), timeout=15
    )
    assert r.status_code == 200
    assert r.json()["member"]["performance_count"] >= 1


def test_06_charges_ledger(admin_token, client_token, state):
    cid = state["client_id"]
    r = requests.post(
        f"{BASE_URL}/api/admin/managed/clients/{cid}/charges",
        headers=_h(admin_token),
        json={"description": "Test retainer", "amount": 4000},
        timeout=15,
    )
    assert r.status_code == 200 and r.json()["status"] == "unpaid"
    ch_id = r.json()["id"]

    r = requests.get(f"{BASE_URL}/api/managed/billing", headers=_h(client_token), timeout=15)
    assert r.status_code == 200 and any(ch["id"] == ch_id for ch in r.json())

    r = requests.patch(
        f"{BASE_URL}/api/admin/managed/charges/{ch_id}",
        headers=_h(admin_token),
        json={"status": "paid"},
        timeout=15,
    )
    assert r.status_code == 200 and r.json()["paid_at"]

    r = requests.get(f"{BASE_URL}/api/admin/managed/clients", headers=_h(admin_token), timeout=15)
    row = next(x for x in r.json() if x["client"]["id"] == cid)
    assert row["billing"]["paid"] >= 4000

    # cleanup so reruns don't inflate revenue stats
    r = requests.delete(f"{BASE_URL}/api/admin/managed/charges/{ch_id}", headers=_h(admin_token), timeout=15)
    assert r.status_code == 200


def test_07_admin_only_endpoints(client_token):
    for path in ("pool", "clients", "tasks", "stats"):
        r = requests.get(f"{BASE_URL}/api/admin/managed/{path}", headers=_h(client_token), timeout=15)
        assert r.status_code == 403, f"{path}: {r.status_code}"
