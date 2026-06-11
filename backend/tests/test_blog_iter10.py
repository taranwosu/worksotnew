"""Iteration-10 blog backend tests.

Covers:
- GET /api/blog/og/{slug}.png (Pillow PNG generation + cache)
- GET /api/blog/authors (list aggregation)
- GET /api/blog/authors/{author_slug} (single author + posts)
- _post_summary now includes author_slug
"""

import io
import os
import time
import uuid
import pytest
import requests

try:
    from PIL import Image  # type: ignore
    PIL_OK = True
except Exception:
    PIL_OK = False

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://wysiwyg-cms.preview.emergentagent.com"
).rstrip("/")

ADMIN_EMAIL = "admin@worksoy.com"
ADMIN_PASSWORD = "WorkSoyAdmin2026!"
UA = "Mozilla/5.0 (iter10-tests)"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json", "User-Agent": UA})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code}")
    return r.json()["session_token"]


@pytest.fixture(scope="module")
def admin(admin_token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {admin_token}", "User-Agent": UA})
    return s


@pytest.fixture(scope="module")
def first_published_slug(api):
    r = api.get(f"{BASE_URL}/api/blog/posts", timeout=15)
    assert r.status_code == 200
    posts = r.json().get("posts", [])
    if not posts:
        pytest.skip("No published posts to test against")
    return posts[0]["slug"]


# ---------- OG image endpoint ----------
class TestOgImage:
    def test_og_png_returns_image(self, api, first_published_slug):
        url = f"{BASE_URL}/api/blog/og/{first_published_slug}.png"
        r = api.get(url, timeout=30)
        assert r.status_code == 200, f"status={r.status_code} body={r.text[:200]}"
        ct = r.headers.get("content-type", "").lower()
        assert "image/png" in ct, f"Wrong content-type: {ct}"
        assert len(r.content) > 5 * 1024, f"PNG too small: {len(r.content)} bytes"

    def test_og_dimensions_1200x630(self, api, first_published_slug):
        if not PIL_OK:
            pytest.skip("Pillow not installed locally")
        url = f"{BASE_URL}/api/blog/og/{first_published_slug}.png"
        r = api.get(url, timeout=30)
        assert r.status_code == 200
        img = Image.open(io.BytesIO(r.content))
        assert img.size == (1200, 630), f"Wrong size: {img.size}"
        assert img.mode in ("RGB", "RGBA"), f"Mode: {img.mode}"

    def test_og_cached_second_hit_faster(self, api, first_published_slug):
        url = f"{BASE_URL}/api/blog/og/{first_published_slug}.png"
        # warm
        r1 = api.get(url, timeout=30)
        assert r1.status_code == 200
        t0 = time.time()
        r2 = api.get(url, timeout=30)
        elapsed = time.time() - t0
        assert r2.status_code == 200
        assert len(r2.content) == len(r1.content), "Cached size should match"
        # Cached response should be quick (<3s; network jitter tolerant)
        assert elapsed < 3.0, f"Cached fetch unexpectedly slow: {elapsed:.2f}s"

    def test_og_unknown_slug_404(self, api):
        url = f"{BASE_URL}/api/blog/og/this-slug-does-not-exist-{uuid.uuid4().hex[:6]}.png"
        r = api.get(url, timeout=15)
        assert r.status_code == 404, f"Expected 404, got {r.status_code}"

    def test_og_draft_slug_404(self, api, admin):
        # Create a draft post and ensure OG returns 404 for it
        title = f"TEST_OG_DRAFT_{uuid.uuid4().hex[:6]}"
        r = admin.post(
            f"{BASE_URL}/api/admin/blog/posts",
            json={
                "title": title,
                "content_html": "<p>draft body</p>",
                "status": "draft",
                "category": "Testing",
            },
            headers={"Content-Type": "application/json"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        pid = d["id"]
        slug = d["slug"]
        try:
            og = api.get(f"{BASE_URL}/api/blog/og/{slug}.png", timeout=15)
            assert og.status_code == 404, f"Draft OG should 404, got {og.status_code}"
        finally:
            admin.delete(f"{BASE_URL}/api/admin/blog/posts/{pid}", timeout=15)


# ---------- Authors endpoints ----------
class TestAuthors:
    def test_authors_list_shape(self, api):
        r = api.get(f"{BASE_URL}/api/blog/authors", timeout=15)
        assert r.status_code == 200, r.text[:200]
        body = r.json()
        # Accept either list directly or {"authors": [...]}
        authors = body if isinstance(body, list) else body.get("authors", [])
        assert isinstance(authors, list)
        assert len(authors) >= 1, "Expected at least one author"
        a = authors[0]
        for key in ("slug", "name", "post_count"):
            assert key in a, f"Missing {key} in author: {a}"
        # Sorted desc by post_count
        counts = [x.get("post_count", 0) for x in authors]
        assert counts == sorted(counts, reverse=True), f"Authors not sorted desc: {counts}"
        # total_views should be exposed too
        assert "total_views" in a

    def test_author_detail_worksoy_admin(self, api):
        # admin name "WorkSoy Admin" → "worksoy-admin"
        r = api.get(f"{BASE_URL}/api/blog/authors/worksoy-admin", timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:200]}"
        d = r.json()
        assert "author" in d and "posts" in d, d.keys()
        author = d["author"]
        posts = d["posts"]
        assert author.get("slug") == "worksoy-admin"
        assert author.get("post_count", 0) >= 1
        assert isinstance(posts, list) and len(posts) >= 1
        # Posts should not include content_html
        first = posts[0]
        # _post_summary explicitly sets content_html=None to keep payload shape stable.
        assert first.get("content_html") in (None, ""), (
            "author posts must be summary-shaped (content_html nulled)"
        )
        assert "slug" in first and "title" in first
        # author_slug round-trips
        assert first.get("author_slug") == "worksoy-admin"

    def test_author_detail_404(self, api):
        r = api.get(f"{BASE_URL}/api/blog/authors/no-such-author-xyz", timeout=15)
        assert r.status_code == 404


# ---------- _post_summary now exposes author_slug ----------
class TestAuthorSlugInSummary:
    def test_list_includes_author_slug(self, api):
        r = api.get(f"{BASE_URL}/api/blog/posts", timeout=15)
        assert r.status_code == 200
        posts = r.json()["posts"]
        assert posts, "Need at least one published post"
        for p in posts:
            assert "author_slug" in p, f"author_slug missing from list summary: {list(p.keys())}"
            assert isinstance(p["author_slug"], str) and p["author_slug"]

    def test_detail_includes_author_slug(self, api, first_published_slug):
        r = api.get(f"{BASE_URL}/api/blog/posts/{first_published_slug}", timeout=15)
        assert r.status_code == 200
        post = r.json()["post"]
        assert "author_slug" in post, f"author_slug missing from detail: {list(post.keys())}"
        assert post["author_slug"]
