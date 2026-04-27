"""WorkSoy backend API regression tests — health, experts, auth."""
import os
import uuid
import urllib.parse
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to frontend/.env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except FileNotFoundError:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

REQUIRED_EXPERT_FIELDS = {
    "id", "name", "headline", "category", "specialties", "hourlyRate",
    "rating", "reviewCount", "availability", "image", "bio",
    "location", "yearsExperience", "languages", "certifications",
    "verified", "topRated", "currency",
}

SEEDED_EMAIL = "alice@worksoy.com"
SEEDED_PASSWORD = "Passw0rd!"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# -------- Health --------
class TestHealth:
    def test_health_ok(self, api):
        r = api.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}


# -------- Experts --------
class TestExperts:
    def test_list_returns_25_with_required_fields(self, api):
        r = api.get(f"{BASE_URL}/api/experts", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 25, f"expected 25 experts, got {len(data)}"
        for e in data:
            missing = REQUIRED_EXPERT_FIELDS - set(e.keys())
            assert not missing, f"missing fields on expert {e.get('id')}: {missing}"
            assert isinstance(e["specialties"], list) and len(e["specialties"]) > 0
            assert isinstance(e["hourlyRate"], int)
            assert e["availability"] in {"Available now", "Available next week", "Available in 2 weeks"}

    def test_filter_by_category_design_ux(self, api):
        cat = urllib.parse.quote("Design & UX")
        r = api.get(f"{BASE_URL}/api/experts?category={cat}", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 5, f"Design & UX expected 5, got {len(data)}"
        for e in data:
            assert e["category"] == "Design & UX"

    def test_search_q_tax(self, api):
        r = api.get(f"{BASE_URL}/api/experts?q=tax", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data) > 0, "expected experts matching 'tax'"
        for e in data:
            blob = (e["name"] + " " + e["headline"] + " " + " ".join(e["specialties"])).lower()
            assert "tax" in blob

    def test_sort_rate_asc_and_desc(self, api):
        r_asc = api.get(f"{BASE_URL}/api/experts?sort=rate_asc", timeout=15)
        r_desc = api.get(f"{BASE_URL}/api/experts?sort=rate_desc", timeout=15)
        assert r_asc.status_code == 200 and r_desc.status_code == 200
        asc_rates = [e["hourlyRate"] for e in r_asc.json()]
        desc_rates = [e["hourlyRate"] for e in r_desc.json()]
        assert asc_rates == sorted(asc_rates)
        assert desc_rates == sorted(desc_rates, reverse=True)

    def test_categories_aggregation(self, api):
        r = api.get(f"{BASE_URL}/api/experts/categories", timeout=15)
        assert r.status_code == 200
        data = r.json()
        by_cat = {d["category"]: d["count"] for d in data}
        # 5 + 4 + 5 + 5 + 3 + 3 = 25
        assert by_cat.get("Design & UX") == 5
        assert by_cat.get("Accounting & Tax") == 5
        assert by_cat.get("Engineering") == 5
        assert by_cat.get("Consulting", 0) >= 4
        assert sum(by_cat.values()) == 25

    def test_get_expert_by_id_and_404(self, api):
        listing = api.get(f"{BASE_URL}/api/experts", timeout=15).json()
        eid = listing[0]["id"]
        r = api.get(f"{BASE_URL}/api/experts/{eid}", timeout=15)
        assert r.status_code == 200
        assert r.json()["id"] == eid

        r404 = api.get(f"{BASE_URL}/api/experts/exp_does_not_exist_xyz", timeout=15)
        assert r404.status_code == 404


# -------- Auth --------
class TestAuth:
    @pytest.fixture(scope="class")
    def new_user(self):
        suffix = uuid.uuid4().hex[:8]
        return {
            "email": f"TEST_user_{suffix}@worksoy.com",
            "password": "Passw0rd!",
            "name": f"Test User {suffix}",
        }

    def test_register_creates_user_returns_token(self, api, new_user):
        r = api.post(f"{BASE_URL}/api/auth/register", json=new_user, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "session_token" in data and isinstance(data["session_token"], str)
        assert data["user"]["email"] == new_user["email"].lower()
        assert data["user"]["name"] == new_user["name"]
        assert data["user"]["provider"] == "jwt"
        pytest.shared_token = data["session_token"]
        pytest.shared_email = new_user["email"]

    def test_register_existing_email_400(self, api, new_user):
        r = api.post(f"{BASE_URL}/api/auth/register", json=new_user, timeout=15)
        assert r.status_code == 400

    def test_login_seeded_user_or_register(self, api):
        # Ensure seeded user exists
        login = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SEEDED_EMAIL, "password": SEEDED_PASSWORD},
            timeout=15,
        )
        if login.status_code != 200:
            reg = api.post(
                f"{BASE_URL}/api/auth/register",
                json={"email": SEEDED_EMAIL, "password": SEEDED_PASSWORD, "name": "Alice"},
                timeout=15,
            )
            assert reg.status_code in (200, 400)
            login = api.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": SEEDED_EMAIL, "password": SEEDED_PASSWORD},
                timeout=15,
            )
        assert login.status_code == 200, login.text
        assert "session_token" in login.json()

    def test_login_wrong_password_401(self, api):
        r = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SEEDED_EMAIL, "password": "wrong-password-xyz"},
            timeout=15,
        )
        assert r.status_code == 401

    def test_me_with_bearer(self, api):
        token = getattr(pytest, "shared_token", None)
        assert token, "register test must run first"
        r = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == pytest.shared_email.lower()

    def test_me_without_token_401(self, api):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401

    def test_logout_invalidates_session(self, api):
        token = getattr(pytest, "shared_token", None)
        assert token
        r = requests.post(
            f"{BASE_URL}/api/auth/logout",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r.status_code == 200
        # After logout, /me with same bearer should be 401
        r2 = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r2.status_code == 401
