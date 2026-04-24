"""
WorkSoy Iteration-3 tests: in-app notifications, file uploads on
contracts/messages, reviews gated by contract completion, and the
admin-resolved dispute workflow.

Runs end-to-end against REACT_APP_BACKEND_URL.
"""
import io
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
assert BASE_URL, "REACT_APP_BACKEND_URL not set"

CLIENT_EMAIL = "alice@worksoy.com"
CLIENT_PASSWORD = "Passw0rd!"
ADMIN_EMAIL = "admin@worksoy.com"
ADMIN_PASSWORD = "WorkSoy!Admin2026"


# ---------- helpers ----------
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


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- shared fixtures ----------
@pytest.fixture(scope="module")
def client_token():
    return _register_or_login(CLIENT_EMAIL, CLIENT_PASSWORD, "Alice", "client")


@pytest.fixture(scope="module")
def expert_token():
    email = f"TEST_iter3_expert_{uuid.uuid4().hex[:8]}@worksoy.com"
    tok = _register_or_login(email, "Passw0rd!", "Iter3 Expert", "expert")
    # Publish expert profile so they can take proposals
    requests.post(f"{BASE_URL}/api/experts/me", json={
        "headline": "TEST iter3 engineer",
        "category": "Engineering",
        "specialties": ["Python"],
        "hourlyRate": 100,
        "location": "Remote",
        "yearsExperience": 3,
        "bio": "TEST iter3 expert bio " * 4,
    }, headers=_h(tok), timeout=15)
    return tok


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def contract_ctx(client_token, expert_token):
    """Create a brief, submit a proposal, accept it → active contract."""
    brief = requests.post(f"{BASE_URL}/api/briefs", headers=_h(client_token), json={
        "title": f"TEST iter3 contract {uuid.uuid4().hex[:6]}",
        "description": "A brief used to exercise notifications, files, reviews, disputes. " * 2,
        "category": "Engineering",
        "required_skills": ["Python"],
        "budget_min": 1000,
        "budget_max": 3000,
        "engagement_type": "fixed",
        "duration_weeks": 2,
    }, timeout=15).json()
    prop = requests.post(f"{BASE_URL}/api/briefs/{brief['id']}/proposals",
                         headers=_h(expert_token), json={
        "cover_letter": "TEST iter3 expert proposal cover letter content goes here.",
        "proposed_rate": 1500,
        "rate_type": "fixed",
        "estimated_duration_weeks": 2,
    }, timeout=15).json()
    contract = requests.post(f"{BASE_URL}/api/proposals/{prop['id']}/accept",
                             headers=_h(client_token), timeout=15).json()
    detail = requests.get(f"{BASE_URL}/api/contracts/{contract['id']}",
                          headers=_h(client_token), timeout=15).json()
    return {
        "brief_id": brief["id"],
        "proposal_id": prop["id"],
        "contract_id": contract["id"],
        "milestones": detail["milestones"],
        "contract": detail["contract"],
    }


# ==========================================================================
# Notifications — list, unread-count, mark-read, mark-all-read, triggers
# ==========================================================================
class TestNotifications:
    def test_auth_required(self):
        assert requests.get(f"{BASE_URL}/api/notifications", timeout=10).status_code == 401
        assert requests.get(f"{BASE_URL}/api/notifications/unread-count", timeout=10).status_code == 401

    def test_proposal_new_triggers_client_notification(self, client_token, contract_ctx):
        r = requests.get(f"{BASE_URL}/api/notifications", headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        types = [n["type"] for n in r.json()]
        assert "proposal.new" in types, f"expected proposal.new notif, got {types[:10]}"

    def test_proposal_accepted_triggers_expert_notification(self, expert_token, contract_ctx):
        r = requests.get(f"{BASE_URL}/api/notifications", headers=_h(expert_token), timeout=15)
        assert r.status_code == 200
        types = [n["type"] for n in r.json()]
        assert "proposal.accepted" in types, f"expected proposal.accepted, got {types[:10]}"

    def test_unread_count_shape(self, client_token):
        r = requests.get(f"{BASE_URL}/api/notifications/unread-count",
                         headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "count" in data and isinstance(data["count"], int)
        assert data["count"] >= 0

    def test_mark_single_read(self, client_token):
        notifs = requests.get(f"{BASE_URL}/api/notifications",
                              headers=_h(client_token), timeout=15).json()
        unread = next((n for n in notifs if not n["read"]), None)
        if not unread:
            pytest.skip("no unread notifs")
        r = requests.post(f"{BASE_URL}/api/notifications/{unread['id']}/read",
                          headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        # verify persistence
        after = requests.get(f"{BASE_URL}/api/notifications",
                             headers=_h(client_token), timeout=15).json()
        match = next((n for n in after if n["id"] == unread["id"]), None)
        assert match and match["read"] is True

    def test_mark_read_404_for_unknown_or_other_user(self, client_token, expert_token):
        r = requests.post(f"{BASE_URL}/api/notifications/ntf_doesnotexist/read",
                          headers=_h(client_token), timeout=15)
        assert r.status_code == 404
        # try to mark an expert's notif as client
        expert_notifs = requests.get(f"{BASE_URL}/api/notifications",
                                     headers=_h(expert_token), timeout=15).json()
        if expert_notifs:
            r2 = requests.post(
                f"{BASE_URL}/api/notifications/{expert_notifs[0]['id']}/read",
                headers=_h(client_token), timeout=15)
            assert r2.status_code == 404

    def test_mark_all_read(self, client_token):
        r = requests.post(f"{BASE_URL}/api/notifications/read-all",
                          headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        c = requests.get(f"{BASE_URL}/api/notifications/unread-count",
                         headers=_h(client_token), timeout=15).json()
        assert c["count"] == 0

    def test_rejected_proposal_notifies_expert(self, client_token, expert_token):
        # Build a brand new brief + proposal, then reject it
        brief = requests.post(f"{BASE_URL}/api/briefs", headers=_h(client_token), json={
            "title": "TEST iter3 reject notif",
            "description": "A brief for testing reject notifications. " * 3,
            "category": "Engineering",
            "required_skills": [],
            "budget_min": 500, "budget_max": 1500,
            "engagement_type": "fixed", "duration_weeks": 1,
        }, timeout=15).json()
        prop = requests.post(f"{BASE_URL}/api/briefs/{brief['id']}/proposals",
                             headers=_h(expert_token), json={
            "cover_letter": "TEST iter3 reject proposal body of sufficient length goes here.",
            "proposed_rate": 700, "rate_type": "fixed", "estimated_duration_weeks": 1,
        }, timeout=15).json()
        r = requests.post(f"{BASE_URL}/api/proposals/{prop['id']}/reject",
                          headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        notifs = requests.get(f"{BASE_URL}/api/notifications",
                              headers=_h(expert_token), timeout=15).json()
        assert any(n["type"] == "proposal.rejected" for n in notifs)


# ==========================================================================
# File uploads + download authZ
# ==========================================================================
class TestFileUpload:
    def test_upload_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/files/upload",
                          files={"file": ("x.txt", b"hi")}, timeout=15)
        assert r.status_code == 401

    def test_upload_rejects_stranger_scope(self, contract_ctx):
        stranger = _register_or_login(
            f"TEST_iter3_stranger_{uuid.uuid4().hex[:6]}@worksoy.com",
            "Passw0rd!", "Stranger", "client")
        r = requests.post(
            f"{BASE_URL}/api/files/upload",
            headers=_auth(stranger),
            data={"contract_id": contract_ctx["contract_id"]},
            files={"file": ("x.txt", b"hello", "text/plain")},
            timeout=15,
        )
        assert r.status_code == 403

    def test_upload_and_download_happy_path(self, client_token, expert_token, contract_ctx):
        # Find conversation for this brief
        convs = requests.get(f"{BASE_URL}/api/conversations/mine",
                             headers=_h(client_token), timeout=15).json()
        conv = next((c for c in convs if c.get("brief_id") == contract_ctx["brief_id"]), None)
        if conv is None:
            # fall back: contract path also works
            conv = convs[0]
        conv_id = conv["id"]

        payload_bytes = b"hello-worksoy-iter3-file-content"
        r = requests.post(
            f"{BASE_URL}/api/files/upload",
            headers=_auth(client_token),
            data={"conversation_id": conv_id},
            files={"file": ("hello.txt", payload_bytes, "text/plain")},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        meta = r.json()
        assert meta["filename"] == "hello.txt"
        assert meta["size"] == len(payload_bytes)
        assert meta["conversation_id"] == conv_id
        fid = meta["id"]

        # Expert (the other participant) can download
        d = requests.get(f"{BASE_URL}/api/files/{fid}",
                         headers=_auth(expert_token), timeout=30)
        assert d.status_code == 200
        assert d.content == payload_bytes

        # Stranger cannot
        stranger = _register_or_login(
            f"TEST_iter3_stranger2_{uuid.uuid4().hex[:6]}@worksoy.com",
            "Passw0rd!", "S2", "client")
        d2 = requests.get(f"{BASE_URL}/api/files/{fid}",
                          headers=_auth(stranger), timeout=30)
        assert d2.status_code == 403

    def test_attach_file_to_message(self, client_token, expert_token, contract_ctx):
        convs = requests.get(f"{BASE_URL}/api/conversations/mine",
                             headers=_h(client_token), timeout=15).json()
        conv = next((c for c in convs if c.get("brief_id") == contract_ctx["brief_id"]), convs[0])
        conv_id = conv["id"]
        # upload with same conversation scope
        r = requests.post(
            f"{BASE_URL}/api/files/upload",
            headers=_auth(client_token),
            data={"conversation_id": conv_id},
            files={"file": ("attach.bin", b"1234567890", "application/octet-stream")},
            timeout=30,
        )
        assert r.status_code == 200
        fid = r.json()["id"]

        # Send message with attachment
        m = requests.post(f"{BASE_URL}/api/conversations/{conv_id}/messages",
                          headers=_h(client_token),
                          json={"body": "TEST iter3 attachment", "file_id": fid},
                          timeout=15)
        assert m.status_code == 200, m.text
        out = m.json()
        assert out.get("file_id") == fid
        assert out.get("file_name") == "attach.bin"
        assert out.get("file_size") == 10

        # Invalid file_id → 400
        bad = requests.post(f"{BASE_URL}/api/conversations/{conv_id}/messages",
                            headers=_h(client_token),
                            json={"body": "bad attach", "file_id": "fil_doesnotexist"},
                            timeout=15)
        assert bad.status_code == 400

    def test_too_large_upload_returns_413(self, client_token, contract_ctx):
        # Stream ~26MB of zeros to exceed 25MB cap
        big = io.BytesIO(b"0" * (26 * 1024 * 1024))
        r = requests.post(
            f"{BASE_URL}/api/files/upload",
            headers=_auth(client_token),
            data={"contract_id": contract_ctx["contract_id"]},
            files={"file": ("big.bin", big, "application/octet-stream")},
            timeout=120,
        )
        assert r.status_code == 413, f"expected 413, got {r.status_code}: {r.text[:200]}"


# ==========================================================================
# Reviews — only on completed contracts
# ==========================================================================
class TestReviews:
    def test_cannot_review_active_contract(self, client_token, contract_ctx):
        r = requests.post(
            f"{BASE_URL}/api/contracts/{contract_ctx['contract_id']}/reviews",
            headers=_h(client_token),
            json={"rating": 5, "comment": "Great work on this active contract."},
            timeout=15,
        )
        assert r.status_code == 400

    def test_review_after_admin_forces_completion(self, client_token, expert_token, admin_token, contract_ctx):
        """Drive contract to 'completed' using the dispute → admin release flow on all milestones."""
        contract_id = contract_ctx["contract_id"]
        milestones = contract_ctx["milestones"]

        # For each milestone: force funded via direct DB would be cleaner, but without mongosh
        # we instead use the dispute-resolve admin path which requires status in
        # ('funded', 'submitted'). Since we can't fund without real Stripe, we use a
        # direct-to-mongo workaround via pytest-mongo? Not available. So we SKIP if
        # we can't move the contract to completed.
        #
        # Workaround: call the admin resolve endpoint after manually flipping statuses
        # via an insert of a dispute? That still requires funded status.
        # The only supported path without Stripe is: manipulate db directly.
        # We try motor via backend's own Mongo. Failing that, skip.
        try:
            from pymongo import MongoClient
            mc = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            dbn = os.environ.get("DB_NAME", "worksoy")
            mdb = mc[dbn]
            mdb.milestones.update_many(
                {"contract_id": contract_id},
                {"$set": {"status": "released"}},
            )
            mdb.contracts.update_one(
                {"id": contract_id},
                {"$set": {"status": "completed"}},
            )
        except Exception as e:
            pytest.skip(f"mongo direct not available: {e}")

        # Non-party forbidden
        stranger = _register_or_login(
            f"TEST_iter3_rev_stranger_{uuid.uuid4().hex[:6]}@worksoy.com",
            "Passw0rd!", "RevStr", "client")
        r_forbidden = requests.post(
            f"{BASE_URL}/api/contracts/{contract_id}/reviews",
            headers=_h(stranger),
            json={"rating": 5, "comment": "not a party"},
            timeout=15,
        )
        assert r_forbidden.status_code == 403

        # Client leaves review → expert becomes reviewee
        r = requests.post(
            f"{BASE_URL}/api/contracts/{contract_id}/reviews",
            headers=_h(client_token),
            json={"rating": 5, "comment": "TEST iter3 excellent delivery, highly recommend."},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        review = r.json()
        assert review["rating"] == 5
        assert review["contract_id"] == contract_id

        # Duplicate → 400
        dup = requests.post(
            f"{BASE_URL}/api/contracts/{contract_id}/reviews",
            headers=_h(client_token),
            json={"rating": 4, "comment": "duplicate attempt blocked"},
            timeout=15,
        )
        assert dup.status_code == 400

        # Expert profile rating should be recomputed
        # Find expert_id via contract detail
        detail = requests.get(f"{BASE_URL}/api/contracts/{contract_id}",
                              headers=_h(client_token), timeout=15).json()
        expert_user_id = detail["contract"]["expert_user_id"]
        # The public expert endpoint lists by id, and reviews endpoint uses expert.id;
        # find that expert id from GET /api/experts
        experts = requests.get(f"{BASE_URL}/api/experts", timeout=15).json()
        exp = next((e for e in experts if e.get("user_id") == expert_user_id), None)
        if exp:
            pub = requests.get(f"{BASE_URL}/api/experts/{exp['id']}/reviews", timeout=15)
            assert pub.status_code == 200
            assert any(rv["contract_id"] == contract_id for rv in pub.json())


# ==========================================================================
# Disputes — open, admin list, resolve (release + refund)
# ==========================================================================
class TestDisputes:
    def test_cannot_dispute_pending_milestone(self, client_token, expert_token):
        """Create a fresh contract and try to dispute — milestone is still pending → 400."""
        brief = requests.post(f"{BASE_URL}/api/briefs", headers=_h(client_token), json={
            "title": f"TEST iter3 disp {uuid.uuid4().hex[:6]}",
            "description": "Dispute test brief body. " * 3,
            "category": "Engineering",
            "required_skills": [],
            "budget_min": 500, "budget_max": 1500,
            "engagement_type": "fixed", "duration_weeks": 1,
        }, timeout=15).json()
        prop = requests.post(f"{BASE_URL}/api/briefs/{brief['id']}/proposals",
                             headers=_h(expert_token), json={
            "cover_letter": "TEST iter3 dispute proposal of sufficient length OK here.",
            "proposed_rate": 700, "rate_type": "fixed",
            "estimated_duration_weeks": 1,
        }, timeout=15).json()
        contract = requests.post(f"{BASE_URL}/api/proposals/{prop['id']}/accept",
                                 headers=_h(client_token), timeout=15).json()
        detail = requests.get(f"{BASE_URL}/api/contracts/{contract['id']}",
                              headers=_h(client_token), timeout=15).json()
        ms = detail["milestones"][0]
        r = requests.post(f"{BASE_URL}/api/milestones/{ms['id']}/dispute",
                          headers=_h(client_token),
                          json={"reason": "milestone not ready — still pending status"},
                          timeout=15)
        assert r.status_code == 400
        # save for later tests
        TestDisputes.contract_id = contract["id"]
        TestDisputes.milestone_id = ms["id"]

    def test_dispute_release_flow(self, client_token, expert_token, admin_token):
        # Force first milestone to 'funded' via direct mongo
        try:
            from pymongo import MongoClient
            mc = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            mdb = mc[os.environ.get("DB_NAME", "worksoy")]
            mdb.milestones.update_one({"id": TestDisputes.milestone_id},
                                      {"$set": {"status": "funded"}})
        except Exception as e:
            pytest.skip(f"mongo not available: {e}")

        # Expert files the dispute
        r = requests.post(f"{BASE_URL}/api/milestones/{TestDisputes.milestone_id}/dispute",
                          headers=_h(expert_token),
                          json={"reason": "TEST iter3 dispute: client unresponsive, funds held."},
                          timeout=15)
        assert r.status_code == 200, r.text
        dispute = r.json()
        assert dispute["status"] == "open"
        assert dispute["milestone_id"] == TestDisputes.milestone_id
        TestDisputes.dispute_id = dispute["id"]

        # Milestone now 'disputed'
        detail = requests.get(f"{BASE_URL}/api/contracts/{TestDisputes.contract_id}",
                              headers=_h(client_token), timeout=15).json()
        ms = next(m for m in detail["milestones"] if m["id"] == TestDisputes.milestone_id)
        assert ms["status"] == "disputed"

        # Non-admin cannot list
        r_na = requests.get(f"{BASE_URL}/api/admin/disputes",
                            headers=_h(client_token), timeout=15)
        assert r_na.status_code == 403

        # Admin lists disputes
        r_a = requests.get(f"{BASE_URL}/api/admin/disputes",
                           headers=_h(admin_token), timeout=15)
        assert r_a.status_code == 200
        assert any(d["id"] == TestDisputes.dispute_id for d in r_a.json())

        # Non-admin cannot resolve
        r_na2 = requests.post(
            f"{BASE_URL}/api/admin/disputes/{TestDisputes.dispute_id}/resolve",
            headers=_h(client_token),
            json={"action": "release", "note": "client attempt"},
            timeout=15)
        assert r_na2.status_code == 403

        # Admin resolves with release
        r_res = requests.post(
            f"{BASE_URL}/api/admin/disputes/{TestDisputes.dispute_id}/resolve",
            headers=_h(admin_token),
            json={"action": "release", "note": "TEST iter3 release"},
            timeout=15)
        assert r_res.status_code == 200, r_res.text
        resolved = r_res.json()
        assert resolved["status"] == "resolved"
        assert resolved["resolution_action"] == "release"

        # Milestone flipped to 'released'
        detail2 = requests.get(f"{BASE_URL}/api/contracts/{TestDisputes.contract_id}",
                               headers=_h(client_token), timeout=15).json()
        ms2 = next(m for m in detail2["milestones"] if m["id"] == TestDisputes.milestone_id)
        assert ms2["status"] == "released"

        # Double-resolve → 400
        r_dup = requests.post(
            f"{BASE_URL}/api/admin/disputes/{TestDisputes.dispute_id}/resolve",
            headers=_h(admin_token),
            json={"action": "release"}, timeout=15)
        assert r_dup.status_code == 400

    def test_dispute_refund_flow(self, client_token, expert_token, admin_token):
        # Use second milestone of the same contract (from first test)
        detail = requests.get(f"{BASE_URL}/api/contracts/{TestDisputes.contract_id}",
                              headers=_h(client_token), timeout=15).json()
        remaining = [m for m in detail["milestones"] if m["id"] != TestDisputes.milestone_id]
        if not remaining:
            pytest.skip("only one milestone available")
        m2 = remaining[0]
        # flip to funded
        try:
            from pymongo import MongoClient
            mc = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
            mdb = mc[os.environ.get("DB_NAME", "worksoy")]
            mdb.milestones.update_one({"id": m2["id"]}, {"$set": {"status": "funded"}})
        except Exception as e:
            pytest.skip(f"mongo not available: {e}")

        d = requests.post(f"{BASE_URL}/api/milestones/{m2['id']}/dispute",
                          headers=_h(client_token),
                          json={"reason": "TEST iter3 dispute refund: expert abandoned work."},
                          timeout=15).json()

        r = requests.post(
            f"{BASE_URL}/api/admin/disputes/{d['id']}/resolve",
            headers=_h(admin_token),
            json={"action": "refund", "note": "TEST iter3 refund"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["resolution_action"] == "refund"

        detail2 = requests.get(f"{BASE_URL}/api/contracts/{TestDisputes.contract_id}",
                               headers=_h(client_token), timeout=15).json()
        m2_after = next(m for m in detail2["milestones"] if m["id"] == m2["id"])
        assert m2_after["status"] == "pending"

        # Both parties got dispute.resolved notifications
        cn = requests.get(f"{BASE_URL}/api/notifications",
                          headers=_h(client_token), timeout=15).json()
        en = requests.get(f"{BASE_URL}/api/notifications",
                          headers=_h(expert_token), timeout=15).json()
        assert any(n["type"] == "dispute.resolved" for n in cn)
        assert any(n["type"] == "dispute.resolved" for n in en)
