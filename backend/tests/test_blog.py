"""Blog feature backend regression tests (iteration 7).

Covers:
- Public list/get/categories/tags/comments/subscribe/sitemap/robots
- Admin auth gate + CRUD + AI generation + moderation + subscribers list
"""

import os
import re
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://wysiwyg-cms.preview.emergentagent.com").rstrip("/")

ADMIN_EMAIL = "admin@worksoy.com"
ADMIN_PASSWORD = "WorkSoyAdmin2026!"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(api):
    r = api.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text[:120]}")
    return r.json()["session_token"]


@pytest.fixture(scope="session")
def admin(api, admin_token):
    s = requests.Session()
    s.headers.update(
        {"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}"}
    )
    return s


# ---------------- Public list / categories / tags ----------------
class TestPublicListing:
    def test_blog_posts_returns_only_published(self, api):
        r = api.get(f"{BASE_URL}/api/blog/posts", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "posts" in data and isinstance(data["posts"], list)
        assert "total" in data
        assert len(data["posts"]) >= 3, "Expected at least 3 seeded published posts"
        for p in data["posts"]:
            assert p.get("status") == "published", p.get("slug")
            for k in ("id", "title", "slug", "excerpt", "reading_time_min"):
                assert k in p

    def test_categories_returns_counts(self, api):
        r = api.get(f"{BASE_URL}/api/blog/categories", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # categories may be empty if seed posts have no category; just ensure shape if present
        for row in data:
            assert "category" in row or "_id" in row or "name" in row
            assert "count" in row

    def test_tags_returns_counts(self, api):
        r = api.get(f"{BASE_URL}/api/blog/tags", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for row in data:
            assert "count" in row


# ---------------- Public single post ----------------
class TestPublicSinglePost:
    def test_get_existing_post_increments_views(self, api):
        # pick first published slug from list
        r = api.get(f"{BASE_URL}/api/blog/posts", timeout=15)
        slug = r.json()["posts"][0]["slug"]

        # Use a unique X-Forwarded-For so the iter-8 view-count throttle (6h
        # per IP+slug) does not suppress the increment from a previous run.
        headers = {
            "X-Forwarded-For": f"203.0.113.{uuid.uuid4().int % 255}",
            "User-Agent": "Mozilla/5.0 (regression-test)",
        }
        r1 = api.get(f"{BASE_URL}/api/blog/posts/{slug}", headers=headers, timeout=15)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert "post" in d1 and "related" in d1 and "comments" in d1
        v1 = d1["post"].get("view_count", 0)

        # Different IP -> guaranteed second counted increment.
        headers2 = {
            "X-Forwarded-For": f"203.0.113.{uuid.uuid4().int % 255}",
            "User-Agent": "Mozilla/5.0 (regression-test-2)",
        }
        r2 = api.get(f"{BASE_URL}/api/blog/posts/{slug}", headers=headers2, timeout=15)
        v2 = r2.json()["post"].get("view_count", 0)
        assert v2 >= v1 + 1, f"view_count did not increment: {v1} -> {v2}"
        assert isinstance(d1["related"], list)
        assert isinstance(d1["comments"], list)

    def test_get_missing_slug_returns_404(self, api):
        r = api.get(f"{BASE_URL}/api/blog/posts/this-does-not-exist-xyz", timeout=15)
        assert r.status_code == 404


# ---------------- Public comments ----------------
class TestComments:
    def test_normal_comment_approved(self, api):
        posts = api.get(f"{BASE_URL}/api/blog/posts").json()["posts"]
        post_id = posts[0]["id"]
        body = {
            "post_id": post_id,
            "author_name": "TEST_Reader",
            "author_email": f"test_reader_{uuid.uuid4().hex[:6]}@example.com",
            "body": "Great post, learned a lot about fractional CFO services. Will share with my team!",
        }
        r = api.post(f"{BASE_URL}/api/blog/comments", json=body, timeout=15)
        assert r.status_code == 200, r.text
        out = r.json()
        # Endpoint returns the saved comment or {ok, status}
        status = out.get("status") or (out.get("comment") or {}).get("status")
        assert status == "approved", out

    def test_comment_with_url_short_body_pending(self, api):
        posts = api.get(f"{BASE_URL}/api/blog/posts").json()["posts"]
        post_id = posts[0]["id"]
        body = {
            "post_id": post_id,
            "author_name": "TEST_Spammer",
            "author_email": f"test_spam_{uuid.uuid4().hex[:6]}@example.com",
            "body": "See http://spam.example",
        }
        r = api.post(f"{BASE_URL}/api/blog/comments", json=body, timeout=15)
        assert r.status_code == 200, r.text
        out = r.json()
        status = out.get("status") or (out.get("comment") or {}).get("status")
        assert status == "pending", out

    def test_comment_invalid_email_422(self, api):
        posts = api.get(f"{BASE_URL}/api/blog/posts").json()["posts"]
        post_id = posts[0]["id"]
        body = {
            "post_id": post_id,
            "author_name": "TEST_X",
            "author_email": "not-an-email",
            "body": "Body with enough chars for validation",
        }
        r = api.post(f"{BASE_URL}/api/blog/comments", json=body, timeout=15)
        assert r.status_code == 422


# ---------------- Newsletter subscribe ----------------
class TestSubscribe:
    def test_new_email_then_duplicate(self, api):
        email = f"test_sub_{uuid.uuid4().hex[:8]}@example.com"
        r1 = api.post(f"{BASE_URL}/api/blog/subscribe", json={"email": email}, timeout=15)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1.get("already_subscribed") is False

        r2 = api.post(f"{BASE_URL}/api/blog/subscribe", json={"email": email}, timeout=15)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2.get("already_subscribed") is True

    def test_invalid_email_422(self, api):
        r = api.post(f"{BASE_URL}/api/blog/subscribe", json={"email": "bad"}, timeout=15)
        assert r.status_code == 422


# ---------------- Sitemap + robots ----------------
class TestSitemapRobots:
    def test_sitemap_xml(self, api):
        r = api.get(f"{BASE_URL}/api/sitemap.xml", timeout=15)
        assert r.status_code == 200
        assert "xml" in r.headers.get("content-type", "").lower()
        body = r.text
        assert "<urlset" in body
        # all published slugs included
        posts = api.get(f"{BASE_URL}/api/blog/posts").json()["posts"]
        for p in posts:
            assert f"/blog/{p['slug']}" in body, f"Missing slug in sitemap: {p['slug']}"
        # static routes
        for path in ["/experts", "/process", "/managed-services", "/blog", "/pricing"]:
            assert f"{path}<" in body or f"{path}</loc>" in body

    def test_robots_txt(self, api):
        r = api.get(f"{BASE_URL}/api/robots.txt", timeout=15)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "").lower()
        assert "text/plain" in ct
        body = r.text
        for bot in ["GPTBot", "ChatGPT-User", "ClaudeBot", "PerplexityBot", "Google-Extended"]:
            assert bot in body, f"Missing bot rule: {bot}"
        assert "Sitemap:" in body


# ---------------- Admin auth gate ----------------
class TestAdminAuthGate:
    def test_admin_posts_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/admin/blog/posts", timeout=15)
        assert r.status_code in (401, 403), r.status_code

    def test_admin_subscribers_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/admin/blog/subscribers", timeout=15)
        assert r.status_code in (401, 403)

    def test_admin_ai_requires_auth(self, api):
        r = api.post(
            f"{BASE_URL}/api/admin/blog/ai/generate",
            json={"title": "t", "content_html": "<p>c</p>", "mode": "meta"},
            timeout=15,
        )
        assert r.status_code in (401, 403)


# ---------------- Admin CRUD ----------------
class TestAdminCRUD:
    created_ids: list = []

    def test_create_post_auto_slug(self, admin):
        title = f"TEST_Post_{uuid.uuid4().hex[:6]}"
        payload = {
            "title": title,
            "content_html": "<p>Hello world from regression test. " * 30 + "</p>",
            "category": "Testing",
            "tags": ["test", "regression"],
            "status": "draft",
        }
        r = admin.post(f"{BASE_URL}/api/admin/blog/posts", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == title
        # slug must be a valid kebab-case slug (lowercase alphanumeric + dashes)
        assert re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", d["slug"]), d["slug"]
        assert d["status"] == "draft"
        assert d["reading_time_min"] >= 1
        TestAdminCRUD.created_ids.append(d["id"])

    def test_duplicate_slug_auto_suffix(self, admin):
        title = "TEST_DupTitle"
        payload = {
            "title": title,
            "slug": "test-dup-slug-xyz",
            "content_html": "<p>some content here for word count.</p>",
            "status": "draft",
        }
        r1 = admin.post(f"{BASE_URL}/api/admin/blog/posts", json=payload, timeout=20)
        assert r1.status_code == 200
        s1 = r1.json()["slug"]
        TestAdminCRUD.created_ids.append(r1.json()["id"])

        r2 = admin.post(f"{BASE_URL}/api/admin/blog/posts", json=payload, timeout=20)
        assert r2.status_code == 200
        s2 = r2.json()["slug"]
        TestAdminCRUD.created_ids.append(r2.json()["id"])

        assert s1 == "test-dup-slug-xyz"
        assert s2 == "test-dup-slug-xyz-2", f"Got {s2}"

    def test_patch_post_and_publish(self, admin):
        if not TestAdminCRUD.created_ids:
            pytest.skip("no post created")
        pid = TestAdminCRUD.created_ids[0]
        upd = {
            "title": "TEST_Post_Updated",
            "content_html": "<p>updated body content.</p>",
            "status": "published",
        }
        r = admin.patch(f"{BASE_URL}/api/admin/blog/posts/{pid}", json=upd, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "published"
        assert d["published_at"]

        # Now it should appear on public list
        r2 = admin.get(f"{BASE_URL}/api/blog/posts", timeout=15)
        slugs = [p["slug"] for p in r2.json()["posts"]]
        assert d["slug"] in slugs

    def test_delete_post(self, admin):
        # create a throwaway then delete it
        payload = {
            "title": f"TEST_ToDelete_{uuid.uuid4().hex[:4]}",
            "content_html": "<p>delete me</p>",
            "status": "draft",
        }
        r = admin.post(f"{BASE_URL}/api/admin/blog/posts", json=payload, timeout=20)
        pid = r.json()["id"]
        rd = admin.delete(f"{BASE_URL}/api/admin/blog/posts/{pid}", timeout=15)
        assert rd.status_code == 200
        # verify gone via slug
        slug = r.json()["slug"]
        rg = admin.get(f"{BASE_URL}/api/blog/posts/{slug}", timeout=15)
        assert rg.status_code == 404

    @classmethod
    def teardown_class(cls):
        # Cleanup remaining created ids
        try:
            r = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
                timeout=15,
            )
            if r.status_code != 200:
                return
            tok = r.json()["session_token"]
            h = {"Authorization": f"Bearer {tok}"}
            for pid in cls.created_ids:
                try:
                    requests.delete(
                        f"{BASE_URL}/api/admin/blog/posts/{pid}", headers=h, timeout=10
                    )
                except Exception:
                    pass
        except Exception:
            pass


# ---------------- Admin comment moderation ----------------
class TestAdminCommentModeration:
    def test_status_and_delete(self, api, admin):
        posts = api.get(f"{BASE_URL}/api/blog/posts").json()["posts"]
        post_id = posts[0]["id"]
        # create a comment
        body = {
            "post_id": post_id,
            "author_name": "TEST_ModUser",
            "author_email": f"mod_{uuid.uuid4().hex[:6]}@example.com",
            "body": "A legit comment for moderation flow test.",
        }
        rc = api.post(f"{BASE_URL}/api/blog/comments", json=body, timeout=15)
        assert rc.status_code == 200, rc.text
        out = rc.json()
        cid = out.get("id") or (out.get("comment") or {}).get("id")
        if not cid:
            # fetch via admin list
            r = admin.get(f"{BASE_URL}/api/admin/blog/comments", timeout=15)
            items = r.json()
            match = [c for c in items if c.get("author_name") == "TEST_ModUser"]
            assert match
            cid = match[0]["id"]

        # set status spam
        rs = admin.post(
            f"{BASE_URL}/api/admin/blog/comments/{cid}/status?status=spam", timeout=15
        )
        assert rs.status_code == 200, rs.text

        # delete
        rd = admin.delete(f"{BASE_URL}/api/admin/blog/comments/{cid}", timeout=15)
        assert rd.status_code == 200


# ---------------- Admin subscribers ----------------
class TestAdminSubscribers:
    def test_list_subscribers(self, admin):
        r = admin.get(f"{BASE_URL}/api/admin/blog/subscribers", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)


# ---------------- Admin AI generate ----------------
@pytest.mark.slow
class TestAdminAI:
    SAMPLE_CONTENT = (
        "<p>Hiring engineering leaders is hard. We share our 6-step vetting "
        "playbook: signals, structured interview, take-home, paired session, "
        "references, and final calibration. Our acceptance rate is ~3% which is "
        "why fractional engagements work.</p>"
    )

    def test_ai_meta(self, admin):
        r = admin.post(
            f"{BASE_URL}/api/admin/blog/ai/generate",
            json={"title": "How we vet engineers", "content_html": self.SAMPLE_CONTENT, "mode": "meta"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("mode") == "meta"
        assert isinstance(d.get("result"), str) and len(d["result"]) > 0
        assert len(d["result"]) <= 200, f"Meta too long: {len(d['result'])}"

    def test_ai_summary(self, admin):
        r = admin.post(
            f"{BASE_URL}/api/admin/blog/ai/generate",
            json={"title": "How we vet engineers", "content_html": self.SAMPLE_CONTENT, "mode": "summary"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("mode") == "summary"
        assert isinstance(d.get("result"), str) and len(d["result"]) > 20

    def test_ai_keywords_returns_array(self, admin):
        r = admin.post(
            f"{BASE_URL}/api/admin/blog/ai/generate",
            json={"title": "How we vet engineers", "content_html": self.SAMPLE_CONTENT, "mode": "keywords"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        # result should be a parsed JSON array, or raw string fallback
        assert d.get("mode") == "keywords"
        if not d.get("raw"):
            assert isinstance(d["result"], list)
            assert len(d["result"]) >= 3

    def test_ai_faq_returns_qa_array(self, admin):
        r = admin.post(
            f"{BASE_URL}/api/admin/blog/ai/generate",
            json={"title": "How we vet engineers", "content_html": self.SAMPLE_CONTENT, "mode": "faq"},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("mode") == "faq"
        if not d.get("raw"):
            assert isinstance(d["result"], list)
            assert len(d["result"]) >= 2
            for item in d["result"]:
                assert "question" in item and "answer" in item
