"""Iteration-8 blog backend tests.

Adds coverage for:
- /api/blog/posts list strips content_html
- Single GET still returns full content_html
- Bleach sanitization on admin POST + PATCH
- FAQ strict typing (FaqItem -> 422 on malformed; 200 on valid)
- View-count throttle (same IP no double-count; bot UA suppressed)
- Newsletter rate-limit bucket independence from auth bucket
- /api/blog/posts/{slug}/related-experts shape + 404
- Router-split URL surface sanity check (every iter-7 path still 200/401)
"""

import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://wysiwyg-cms.preview.emergentagent.com"
).rstrip("/")

ADMIN_EMAIL = "admin@worksoy.com"
ADMIN_PASSWORD = "WorkSoyAdmin2026!"

XSS_HTML = (
    "<p>ok</p>"
    "<script>alert(1)</script>"
    '<img src="x" onerror="evil()">'
    '<a href="javascript:bad()">x</a>'
    "<iframe src='http://evil'></iframe>"
)


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:120]}")
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def admin(admin_token):
    s = requests.Session()
    s.headers.update(
        {"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"}
    )
    return s


@pytest.fixture(scope="module")
def created_post_ids():
    ids: list[str] = []
    yield ids
    # teardown: cleanup
    try:
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=15,
        )
        if r.status_code == 200:
            tok = r.json()["session_token"]
            h = {"Authorization": f"Bearer {tok}"}
            for pid in ids:
                try:
                    requests.delete(
                        f"{BASE_URL}/api/admin/blog/posts/{pid}", headers=h, timeout=10
                    )
                except Exception:
                    pass
    except Exception:
        pass


# ---------------- List strips content_html ----------------
class TestListProjection:
    def test_list_does_not_include_full_content_html(self, api):
        r = api.get(f"{BASE_URL}/api/blog/posts", timeout=15)
        assert r.status_code == 200
        posts = r.json()["posts"]
        assert len(posts) >= 1
        for p in posts:
            ch = p.get("content_html")
            # either absent or explicitly null
            assert ch in (None, "", []), (
                f"List endpoint must not return full content_html "
                f"(slug={p.get('slug')}, got {len(ch) if isinstance(ch, str) else ch})"
            )

    def test_single_get_returns_full_content_html(self, api):
        r = api.get(f"{BASE_URL}/api/blog/posts", timeout=15)
        slug = r.json()["posts"][0]["slug"]
        r2 = api.get(f"{BASE_URL}/api/blog/posts/{slug}", timeout=15)
        assert r2.status_code == 200
        post = r2.json()["post"]
        assert isinstance(post.get("content_html"), str) and len(post["content_html"]) > 0


# ---------------- Bleach sanitization ----------------
class TestBleachSanitization:
    def test_post_create_strips_xss(self, admin, created_post_ids):
        payload = {
            "title": f"TEST_XSS_{uuid.uuid4().hex[:6]}",
            "content_html": XSS_HTML + "<p>safe paragraph content here.</p>",
            "status": "draft",
        }
        r = admin.post(f"{BASE_URL}/api/admin/blog/posts", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_post_ids.append(d["id"])
        body = d.get("content_html", "")
        for bad in ("<script", "onerror=", "javascript:", "<iframe"):
            assert bad.lower() not in body.lower(), f"XSS '{bad}' survived sanitization in POST: {body!r}"
        # safe content survives
        assert "<p>ok</p>" in body or "ok" in body

    def test_post_patch_strips_xss(self, admin, created_post_ids):
        # create clean post first
        title = f"TEST_XSS_Patch_{uuid.uuid4().hex[:6]}"
        cr = admin.post(
            f"{BASE_URL}/api/admin/blog/posts",
            json={
                "title": title,
                "content_html": "<p>clean</p>",
                "status": "draft",
            },
            timeout=20,
        )
        assert cr.status_code == 200
        pid = cr.json()["id"]
        created_post_ids.append(pid)

        r = admin.patch(
            f"{BASE_URL}/api/admin/blog/posts/{pid}",
            json={"title": title, "content_html": XSS_HTML + "<p>after patch</p>"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json().get("content_html", "")
        for bad in ("<script", "onerror=", "javascript:", "<iframe"):
            assert bad.lower() not in body.lower(), f"XSS '{bad}' survived sanitization in PATCH"


# ---------------- FAQ strict typing ----------------
class TestFaqStrictTyping:
    def test_invalid_faq_returns_422(self, admin):
        payload = {
            "title": f"TEST_FAQ_bad_{uuid.uuid4().hex[:6]}",
            "content_html": "<p>body</p>",
            "status": "draft",
            "faq": [{"question": 123}],  # wrong type + missing answer
        }
        r = admin.post(f"{BASE_URL}/api/admin/blog/posts", json=payload, timeout=15)
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text[:200]}"

    def test_valid_faq_persists(self, admin, api, created_post_ids):
        payload = {
            "title": f"TEST_FAQ_good_{uuid.uuid4().hex[:6]}",
            "content_html": "<p>body</p>",
            "status": "published",
            "faq": [
                {"question": "What is fractional?", "answer": "Part-time senior leader."},
                {"question": "How fast?", "answer": "Usually 7-14 days."},
            ],
        }
        r = admin.post(f"{BASE_URL}/api/admin/blog/posts", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_post_ids.append(d["id"])
        faq = d.get("faq")
        assert isinstance(faq, list) and len(faq) == 2
        assert faq[0]["question"] == "What is fractional?"

        # verify via public single GET as well
        slug = d["slug"]
        r2 = api.get(f"{BASE_URL}/api/blog/posts/{slug}", timeout=15)
        assert r2.status_code == 200
        faq2 = r2.json()["post"].get("faq")
        assert isinstance(faq2, list) and len(faq2) == 2


# ---------------- View-count throttle + bot suppression ----------------
class TestViewCountThrottle:
    def _make_session(self, ua: str, fwd_ip: str | None = None):
        s = requests.Session()
        h = {"User-Agent": ua}
        if fwd_ip:
            h["X-Forwarded-For"] = fwd_ip
        s.headers.update(h)
        return s

    def test_no_double_increment_same_ip(self, api):
        # get a slug
        slug = api.get(f"{BASE_URL}/api/blog/posts").json()["posts"][0]["slug"]
        ip = f"10.99.{int(time.time()) % 255}.{uuid.uuid4().int % 255}"
        s = self._make_session("Mozilla/5.0 (iter8-throttle-test)", fwd_ip=ip)
        # Note: handler returns PRE-increment view_count, so we need 3 calls.
        # call#1 -> N (returned), then $inc -> N+1
        # call#2 -> N+1 (returned), throttled -> stays N+1
        # call#3 -> N+1 (returned), throttled -> stays N+1
        # So v2 must equal v3 (no double-increment on 2nd hit).
        r1 = s.get(f"{BASE_URL}/api/blog/posts/{slug}", timeout=15)
        assert r1.status_code == 200
        r2 = s.get(f"{BASE_URL}/api/blog/posts/{slug}", timeout=15)
        r3 = s.get(f"{BASE_URL}/api/blog/posts/{slug}", timeout=15)
        v2 = r2.json()["post"].get("view_count", 0)
        v3 = r3.json()["post"].get("view_count", 0)
        assert v2 == v3, f"View count incremented on throttled call: v2={v2} v3={v3}"

    def test_bot_user_agent_no_increment(self, api):
        slug = api.get(f"{BASE_URL}/api/blog/posts").json()["posts"][0]["slug"]
        # baseline using a fresh IP browser
        ip = f"10.88.{int(time.time()) % 255}.{uuid.uuid4().int % 255}"
        baseline_s = self._make_session("Mozilla/5.0 (baseline-bot-test)", fwd_ip=ip)
        v_before = baseline_s.get(
            f"{BASE_URL}/api/blog/posts/{slug}", timeout=15
        ).json()["post"].get("view_count", 0)

        for ua in ("GPTBot/1.0", "Googlebot/2.1", "Mozilla/5.0 (compatible; ClaudeBot)"):
            bot_ip = f"10.77.{uuid.uuid4().int % 255}.{uuid.uuid4().int % 255}"
            bs = self._make_session(ua, fwd_ip=bot_ip)
            r = bs.get(f"{BASE_URL}/api/blog/posts/{slug}", timeout=15)
            assert r.status_code == 200
            v_now = r.json()["post"].get("view_count", 0)
            assert v_now == v_before, (
                f"Bot UA '{ua}' incremented view_count: {v_before} -> {v_now}"
            )


# ---------------- Newsletter bucket independence ----------------
class TestNewsletterBucket:
    def test_five_subscribes_succeed(self, api):
        for _ in range(5):
            email = f"test_bucket_{uuid.uuid4().hex[:8]}@example.com"
            r = api.post(
                f"{BASE_URL}/api/blog/subscribe", json={"email": email}, timeout=15
            )
            assert r.status_code == 200, f"Subscribe should not be rate-limited yet: {r.status_code} {r.text[:80]}"

    def test_auth_login_independent_of_subscribe_bucket(self, api):
        # blast a few subscribes
        for _ in range(6):
            api.post(
                f"{BASE_URL}/api/blog/subscribe",
                json={"email": f"t_{uuid.uuid4().hex[:6]}@example.com"},
                timeout=10,
            )
        # then attempt auth login — must NOT be over auth rate-limit because of subscribe bucket
        r = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
            timeout=15,
        )
        # We expect either 200 (success) or 401 (wrong creds in some env) but NOT 429
        assert r.status_code != 429, (
            f"Auth login was rate-limited after subscribes — buckets are NOT independent: {r.status_code}"
        )


# ---------------- Related experts endpoint ----------------
class TestRelatedExperts:
    SEEDED_SLUG = "the-3-lie-what-toptal-style-vetting-really-filters-for"

    def test_returns_array_for_seeded_post(self, api):
        r = api.get(
            f"{BASE_URL}/api/blog/posts/{self.SEEDED_SLUG}/related-experts", timeout=15
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Accept either bare array or {experts: [...]}
        items = data if isinstance(data, list) else data.get("experts") or data.get("items") or []
        assert isinstance(items, list)
        assert 1 <= len(items) <= 2, f"Expected 1-2 experts, got {len(items)}"
        for ex in items:
            for k in ("id", "name", "headline", "category", "specialties", "image", "hourlyRate", "rating", "reviewCount"):
                assert k in ex, f"Missing key '{k}' in expert: {list(ex.keys())}"

    def test_returns_array_for_first_seeded(self, api):
        # pick any seeded slug from the public list and assert endpoint returns 0-2
        slug = api.get(f"{BASE_URL}/api/blog/posts").json()["posts"][0]["slug"]
        r = api.get(f"{BASE_URL}/api/blog/posts/{slug}/related-experts", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        items = data if isinstance(data, list) else data.get("experts") or data.get("items") or []
        assert isinstance(items, list)
        assert 0 <= len(items) <= 2

    def test_404_for_missing_slug(self, api):
        r = api.get(
            f"{BASE_URL}/api/blog/posts/this-slug-does-not-exist-iter8/related-experts",
            timeout=15,
        )
        assert r.status_code == 404


# ---------------- Router-split URL surface sanity ----------------
class TestRouterSplitSurface:
    """Every iter-7 endpoint must still respond at the same path."""

    def test_public_paths(self, api):
        public_get_ok = [
            "/api/blog/posts",
            "/api/blog/categories",
            "/api/blog/tags",
            "/api/sitemap.xml",
            "/api/robots.txt",
        ]
        for path in public_get_ok:
            r = api.get(f"{BASE_URL}{path}", timeout=15)
            assert r.status_code == 200, f"{path} -> {r.status_code}"

        # single post
        slug = api.get(f"{BASE_URL}/api/blog/posts").json()["posts"][0]["slug"]
        r = api.get(f"{BASE_URL}/api/blog/posts/{slug}", timeout=15)
        assert r.status_code == 200

    def test_admin_paths_require_auth(self):
        # Use a fresh session to avoid cookie pollution from earlier login calls.
        fresh = requests.Session()
        fresh.headers.update({"Content-Type": "application/json"})
        # Must return 401/403, never 404
        admin_paths = [
            ("GET", "/api/admin/blog/posts"),
            ("GET", "/api/admin/blog/comments"),
            ("GET", "/api/admin/blog/subscribers"),
        ]
        for method, path in admin_paths:
            r = fresh.request(method, f"{BASE_URL}{path}", timeout=15)
            assert r.status_code in (401, 403), f"{method} {path} -> {r.status_code}"

    def test_admin_paths_with_auth(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/blog/posts", timeout=15)
        assert r.status_code == 200
        r = admin.get(f"{BASE_URL}/api/admin/blog/comments", timeout=15)
        assert r.status_code == 200
        r = admin.get(f"{BASE_URL}/api/admin/blog/subscribers", timeout=15)
        assert r.status_code == 200
