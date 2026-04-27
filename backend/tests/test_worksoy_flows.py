"""
WorkSoy full hiring-loop + admin + messaging + stripe integration tests.
Covers briefs, proposals, accept/reject, contracts, milestones, payments,
messages, expert profile, admin endpoints.
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

CLIENT_EMAIL = "alice@worksoy.com"
CLIENT_PASSWORD = "Passw0rd!"
ADMIN_EMAIL = "admin@worksoy.com"
ADMIN_PASSWORD = "WorkSoy!Admin2026"


def _register_or_login(email, password, name="Test", role="client"):
    """Register or fall back to login if email already exists."""
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


# -------- session fixtures shared across tests ---------
@pytest.fixture(scope="module")
def client_token():
    return _register_or_login(CLIENT_EMAIL, CLIENT_PASSWORD, name="Alice", role="client")


@pytest.fixture(scope="module")
def expert_token():
    # Fresh expert each run so duplicate-proposal guard doesn't block us
    email = f"TEST_expert_{uuid.uuid4().hex[:8]}@worksoy.com"
    return _register_or_login(email, "Passw0rd!", name="Test Expert", role="expert")


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["session_token"]


# -------- Admin auth seeding --------
class TestAdminAuth:
    def test_admin_login_ok(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(admin_token), timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"


# -------- Expert profile upsert --------
class TestExpertProfile:
    def test_upsert_expert_profile_and_role_upgrade(self, expert_token):
        payload = {
            "headline": "Full-stack engineer TEST",
            "category": "Engineering",
            "specialties": ["React", "FastAPI"],
            "hourlyRate": 120,
            "location": "Remote",
            "yearsExperience": 6,
            "bio": "TEST expert bio — TEST expert bio — TEST expert bio.",
        }
        r = requests.post(f"{BASE_URL}/api/experts/me", json=payload, headers=_h(expert_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["headline"] == payload["headline"]
        assert data["hourlyRate"] == 120
        g = requests.get(f"{BASE_URL}/api/experts/me", headers=_h(expert_token), timeout=15)
        assert g.status_code == 200
        assert g.json()["id"] == data["id"]
        # role upgraded
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(expert_token), timeout=15).json()
        assert me["role"] == "expert"


# -------- Briefs CRUD + filters --------
class TestBriefs:
    brief_id = None

    def test_create_brief_ok(self, client_token):
        payload = {
            "title": "TEST Redesign checkout flow",
            "description": "We need a modern checkout flow — details and acceptance criteria go here.",
            "category": "Design & UX",
            "required_skills": ["Figma", "UX"],
            "budget_min": 2000,
            "budget_max": 5000,
            "engagement_type": "fixed",
            "duration_weeks": 4,
        }
        r = requests.post(f"{BASE_URL}/api/briefs", json=payload, headers=_h(client_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "open"
        assert data["proposal_count"] == 0
        assert data["budget_max"] >= data["budget_min"]
        TestBriefs.brief_id = data["id"]

    def test_create_brief_rejects_bad_budget(self, client_token):
        payload = {
            "title": "TEST bad budget",
            "description": "A brief with a broken budget range " * 2,
            "category": "Engineering",
            "required_skills": [],
            "budget_min": 9000,
            "budget_max": 100,
            "engagement_type": "fixed",
            "duration_weeks": 2,
        }
        r = requests.post(f"{BASE_URL}/api/briefs", json=payload, headers=_h(client_token), timeout=15)
        assert r.status_code == 400

    def test_create_brief_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/briefs", json={}, timeout=15)
        assert r.status_code == 401

    def test_list_open_briefs(self):
        r = requests.get(f"{BASE_URL}/api/briefs", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert all(b["status"] == "open" for b in data)

    def test_filter_by_category(self):
        r = requests.get(f"{BASE_URL}/api/briefs?category=Design%20%26%20UX", timeout=15)
        assert r.status_code == 200
        for b in r.json():
            assert b["category"] == "Design & UX"

    def test_filter_by_q(self):
        r = requests.get(f"{BASE_URL}/api/briefs?q=TEST", timeout=15)
        assert r.status_code == 200
        assert any("TEST" in b["title"] for b in r.json())

    def test_mine_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/briefs/mine", timeout=15)
        assert r.status_code == 401

    def test_mine_returns_current_user_briefs(self, client_token):
        r = requests.get(f"{BASE_URL}/api/briefs/mine", headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        ids = [b["id"] for b in r.json()]
        assert TestBriefs.brief_id in ids

    def test_get_brief_by_id(self):
        r = requests.get(f"{BASE_URL}/api/briefs/{TestBriefs.brief_id}", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == TestBriefs.brief_id

    def test_get_brief_404(self):
        r = requests.get(f"{BASE_URL}/api/briefs/brf_does_not_exist", timeout=15)
        assert r.status_code == 404


# -------- Proposals --------
class TestProposals:
    proposal_id = None

    def test_cannot_propose_to_own_brief(self, client_token):
        body = {"cover_letter": "TEST — I'd love to work on this brief." * 2,
                "proposed_rate": 4000, "rate_type": "fixed", "estimated_duration_weeks": 4}
        r = requests.post(f"{BASE_URL}/api/briefs/{TestBriefs.brief_id}/proposals",
                          json=body, headers=_h(client_token), timeout=15)
        assert r.status_code == 400

    def test_expert_submits_proposal(self, expert_token):
        body = {"cover_letter": "TEST proposal by expert — enough content to pass min_length.",
                "proposed_rate": 4000, "rate_type": "fixed", "estimated_duration_weeks": 3}
        r = requests.post(f"{BASE_URL}/api/briefs/{TestBriefs.brief_id}/proposals",
                          json=body, headers=_h(expert_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "pending"
        TestProposals.proposal_id = d["id"]
        # proposal_count bumped
        b = requests.get(f"{BASE_URL}/api/briefs/{TestBriefs.brief_id}", timeout=15).json()
        assert b["proposal_count"] >= 1

    def test_duplicate_proposal_rejected(self, expert_token):
        body = {"cover_letter": "TEST duplicate proposal — same expert, same brief again.",
                "proposed_rate": 3500, "rate_type": "fixed", "estimated_duration_weeks": 3}
        r = requests.post(f"{BASE_URL}/api/briefs/{TestBriefs.brief_id}/proposals",
                          json=body, headers=_h(expert_token), timeout=15)
        assert r.status_code == 400

    def test_owner_only_sees_proposals(self, client_token, expert_token):
        # Expert cannot list proposals for a brief they don't own
        r_expert = requests.get(f"{BASE_URL}/api/briefs/{TestBriefs.brief_id}/proposals",
                                headers=_h(expert_token), timeout=15)
        assert r_expert.status_code == 403
        # Owner can
        r_owner = requests.get(f"{BASE_URL}/api/briefs/{TestBriefs.brief_id}/proposals",
                               headers=_h(client_token), timeout=15)
        assert r_owner.status_code == 200
        assert len(r_owner.json()) >= 1


# -------- Accept proposal → contract + milestones + conversation --------
class TestAcceptFlow:
    contract_id = None

    def test_non_owner_cannot_accept(self, expert_token):
        r = requests.post(f"{BASE_URL}/api/proposals/{TestProposals.proposal_id}/accept",
                          headers=_h(expert_token), timeout=15)
        assert r.status_code == 403

    def test_owner_accepts_creates_contract(self, client_token):
        r = requests.post(f"{BASE_URL}/api/proposals/{TestProposals.proposal_id}/accept",
                          headers=_h(client_token), timeout=15)
        assert r.status_code == 200, r.text
        contract = r.json()
        TestAcceptFlow.contract_id = contract["id"]
        assert contract["status"] == "active"
        # brief flipped to awarded
        b = requests.get(f"{BASE_URL}/api/briefs/{TestBriefs.brief_id}", timeout=15).json()
        assert b["status"] == "awarded"

    def test_contract_has_two_milestones_25_75(self, client_token):
        r = requests.get(f"{BASE_URL}/api/contracts/{TestAcceptFlow.contract_id}",
                         headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        ms = data["milestones"]
        assert len(ms) == 2
        total = data["contract"]["total_amount"]
        # 25 / 75 split
        amts = sorted([m["amount"] for m in ms])
        assert abs(amts[0] - round(total * 0.25, 2)) < 0.05
        assert abs(amts[1] - round(total * 0.75, 2)) < 0.05
        for m in ms:
            assert m["status"] == "pending"

    def test_contracts_mine_includes_for_both_parties(self, client_token, expert_token):
        rc = requests.get(f"{BASE_URL}/api/contracts/mine", headers=_h(client_token), timeout=15)
        re = requests.get(f"{BASE_URL}/api/contracts/mine", headers=_h(expert_token), timeout=15)
        assert rc.status_code == 200 and re.status_code == 200
        assert TestAcceptFlow.contract_id in [c["id"] for c in rc.json()]
        assert TestAcceptFlow.contract_id in [c["id"] for c in re.json()]

    def test_contract_detail_forbidden_for_outsider(self):
        stranger = _register_or_login(
            f"TEST_stranger_{uuid.uuid4().hex[:6]}@worksoy.com", "Passw0rd!", "Stranger"
        )
        r = requests.get(f"{BASE_URL}/api/contracts/{TestAcceptFlow.contract_id}",
                         headers=_h(stranger), timeout=15)
        assert r.status_code == 403


# -------- Stripe checkout authZ + payment status --------
class TestPayments:
    session_id = None

    def test_checkout_only_client_can_fund(self, expert_token, client_token):
        # Get first milestone id
        data = requests.get(f"{BASE_URL}/api/contracts/{TestAcceptFlow.contract_id}",
                            headers=_h(client_token), timeout=15).json()
        milestone_id = data["milestones"][0]["id"]

        # Expert attempts checkout → 403
        r_e = requests.post(f"{BASE_URL}/api/payments/checkout/milestone",
                            json={"milestone_id": milestone_id, "origin_url": BASE_URL},
                            headers=_h(expert_token), timeout=20)
        assert r_e.status_code == 403

        # Client attempts checkout → 200 with url + session_id
        r_c = requests.post(f"{BASE_URL}/api/payments/checkout/milestone",
                            json={"milestone_id": milestone_id, "origin_url": BASE_URL},
                            headers=_h(client_token), timeout=30)
        assert r_c.status_code == 200, r_c.text
        body = r_c.json()
        assert body.get("url", "").startswith("https://checkout.stripe.com")
        assert body.get("session_id")
        TestPayments.session_id = body["session_id"]

    def test_payment_status_authz_and_response(self, client_token, expert_token):
        # Outsider (expert who isn't payer) → 403
        r_forbidden = requests.get(
            f"{BASE_URL}/api/payments/status/{TestPayments.session_id}",
            headers=_h(expert_token), timeout=30,
        )
        assert r_forbidden.status_code == 403
        # Owner sees payment status
        r_ok = requests.get(
            f"{BASE_URL}/api/payments/status/{TestPayments.session_id}",
            headers=_h(client_token), timeout=30,
        )
        assert r_ok.status_code == 200, r_ok.text
        data = r_ok.json()
        assert "status" in data and "payment_status" in data


# -------- Milestone submit / release authZ --------
class TestMilestoneTransitions:
    def test_submit_requires_funded(self, expert_token, client_token):
        data = requests.get(f"{BASE_URL}/api/contracts/{TestAcceptFlow.contract_id}",
                            headers=_h(client_token), timeout=15).json()
        milestone_id = data["milestones"][0]["id"]
        # milestone is still 'pending' since we haven't completed payment
        r = requests.post(f"{BASE_URL}/api/milestones/{milestone_id}/submit",
                          headers=_h(expert_token), timeout=15)
        assert r.status_code == 400

    def test_submit_forbidden_for_non_expert(self, client_token):
        data = requests.get(f"{BASE_URL}/api/contracts/{TestAcceptFlow.contract_id}",
                            headers=_h(client_token), timeout=15).json()
        milestone_id = data["milestones"][0]["id"]
        r = requests.post(f"{BASE_URL}/api/milestones/{milestone_id}/submit",
                          headers=_h(client_token), timeout=15)
        assert r.status_code == 403

    def test_release_forbidden_for_non_client(self, expert_token, client_token):
        data = requests.get(f"{BASE_URL}/api/contracts/{TestAcceptFlow.contract_id}",
                            headers=_h(client_token), timeout=15).json()
        milestone_id = data["milestones"][0]["id"]
        r = requests.post(f"{BASE_URL}/api/milestones/{milestone_id}/release",
                          headers=_h(expert_token), timeout=15)
        assert r.status_code == 403

    def test_release_requires_funded_or_submitted(self, client_token):
        data = requests.get(f"{BASE_URL}/api/contracts/{TestAcceptFlow.contract_id}",
                            headers=_h(client_token), timeout=15).json()
        milestone_id = data["milestones"][0]["id"]
        r = requests.post(f"{BASE_URL}/api/milestones/{milestone_id}/release",
                          headers=_h(client_token), timeout=15)
        assert r.status_code == 400


# -------- Messages --------
class TestMessages:
    def test_conversations_mine(self, client_token, expert_token):
        rc = requests.get(f"{BASE_URL}/api/conversations/mine", headers=_h(client_token), timeout=15)
        re = requests.get(f"{BASE_URL}/api/conversations/mine", headers=_h(expert_token), timeout=15)
        assert rc.status_code == 200 and re.status_code == 200
        assert any(c.get("brief_title") and "TEST" in c["brief_title"] for c in rc.json())
        assert len(re.json()) >= 1

    def test_send_and_read_message(self, client_token, expert_token):
        convs = requests.get(f"{BASE_URL}/api/conversations/mine",
                             headers=_h(client_token), timeout=15).json()
        # pick conv for our brief
        conv = next((c for c in convs if c.get("brief_title") and "TEST" in c["brief_title"]), convs[0])
        conv_id = conv["id"]
        # Send
        r = requests.post(f"{BASE_URL}/api/conversations/{conv_id}/messages",
                          json={"body": "TEST hello expert"},
                          headers=_h(client_token), timeout=15)
        assert r.status_code == 200, r.text
        # Read as expert
        r2 = requests.get(f"{BASE_URL}/api/conversations/{conv_id}/messages",
                          headers=_h(expert_token), timeout=15)
        assert r2.status_code == 200
        bodies = [m["body"] for m in r2.json()]
        assert "TEST hello expert" in bodies

    def test_messages_require_participant(self, client_token):
        convs = requests.get(f"{BASE_URL}/api/conversations/mine",
                             headers=_h(client_token), timeout=15).json()
        conv_id = convs[0]["id"]
        stranger = _register_or_login(
            f"TEST_stranger2_{uuid.uuid4().hex[:6]}@worksoy.com", "Passw0rd!", "Stranger2"
        )
        r = requests.get(f"{BASE_URL}/api/conversations/{conv_id}/messages",
                         headers=_h(stranger), timeout=15)
        # Backend hides existence with 404 for non-participants (also valid); 403 also acceptable
        assert r.status_code in (403, 404)


# -------- Admin --------
class TestAdmin:
    def test_stats_requires_admin(self, client_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=_h(client_token), timeout=15)
        assert r.status_code == 403

    def test_stats_ok_for_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        for k in ("briefs_open", "briefs_awarded", "experts", "contracts_active"):
            assert k in data, f"missing {k} in {data}"

    def test_list_experts_and_vetting_queue(self, admin_token):
        r_all = requests.get(f"{BASE_URL}/api/admin/experts", headers=_h(admin_token), timeout=15)
        assert r_all.status_code == 200
        r_pending = requests.get(f"{BASE_URL}/api/admin/experts?verified=false",
                                 headers=_h(admin_token), timeout=15)
        assert r_pending.status_code == 200
        assert all(e.get("verified") is False for e in r_pending.json())

    def test_verify_and_unverify_expert(self, admin_token):
        pending = requests.get(f"{BASE_URL}/api/admin/experts?verified=false",
                               headers=_h(admin_token), timeout=15).json()
        if not pending:
            pytest.skip("no unverified expert to toggle")
        eid = pending[0]["id"]
        r1 = requests.post(f"{BASE_URL}/api/admin/experts/{eid}/verify",
                           headers=_h(admin_token), timeout=15)
        assert r1.status_code == 200
        r2 = requests.post(f"{BASE_URL}/api/admin/experts/{eid}/unverify",
                           headers=_h(admin_token), timeout=15)
        assert r2.status_code == 200

    def test_admin_list_briefs(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/admin/briefs", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# -------- Reject proposal side-case --------
class TestRejectProposal:
    def test_reject_is_owner_only(self, client_token, expert_token):
        # Build a fresh brief + proposal to reject
        brief_payload = {
            "title": "TEST reject flow",
            "description": "A brief used to test proposal rejection path. " * 2,
            "category": "Engineering",
            "required_skills": ["Python"],
            "budget_min": 500,
            "budget_max": 1500,
            "engagement_type": "fixed",
            "duration_weeks": 2,
        }
        b = requests.post(f"{BASE_URL}/api/briefs", json=brief_payload,
                          headers=_h(client_token), timeout=15).json()
        prop_payload = {"cover_letter": "TEST reject proposal body content of sufficient length",
                        "proposed_rate": 800, "rate_type": "fixed", "estimated_duration_weeks": 2}
        p = requests.post(f"{BASE_URL}/api/briefs/{b['id']}/proposals", json=prop_payload,
                          headers=_h(expert_token), timeout=15).json()

        # Non-owner rejection attempt
        r_forbidden = requests.post(f"{BASE_URL}/api/proposals/{p['id']}/reject",
                                    headers=_h(expert_token), timeout=15)
        assert r_forbidden.status_code == 403
        # Owner rejection
        r_ok = requests.post(f"{BASE_URL}/api/proposals/{p['id']}/reject",
                             headers=_h(client_token), timeout=15)
        assert r_ok.status_code == 200
