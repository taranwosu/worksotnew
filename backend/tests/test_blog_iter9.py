"""Iteration-9 blog backend tests.

Covers:
- Post-increment view_count
- PATCH partial payloads (BlogPostPatch with exclude_unset)
- POST /api/admin/blog/upload-cover (auth, ext validation, size limit)
- GET /api/blog/assets/{fid} (public, cache, regex)
- GET /api/blog/rss.xml (RSS 2.0 structure)
"""

import io
import os
import re
import struct
import uuid
import zlib
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL", "https://wysiwyg-cms.preview.emergentagent.com"
).rstrip("/")

ADMIN_EMAIL = "admin@worksoy.com"
ADMIN_PASSWORD = "WorkSoyAdmin2026!"

UA = "Mozilla/5.0 (iter9-tests)"


# 1x1 transparent PNG bytes (well-formed)
def _make_png_bytes() -> bytes:
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0)
    ihdr = b"IHDR" + ihdr_data
    ihdr_chunk = struct.pack(">I", len(ihdr_data)) + ihdr + struct.pack(">I", zlib.crc32(ihdr))
    raw = b"\x00\x00\x00\x00\x00"
    comp = zlib.compress(raw)
    idat = b"IDAT" + comp
    idat_chunk = struct.pack(">I", len(comp)) + idat + struct.pack(">I", zlib.crc32(idat))
    iend = b"IEND"
    iend_chunk = struct.pack(">I", 0) + iend + struct.pack(">I", zlib.crc32(iend))
    return sig + ihdr_chunk + idat_chunk + iend_chunk


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
    s.headers.update(
        {"Authorization": f"Bearer {admin_token}", "User-Agent": UA}
    )
    return s


@pytest.fixture(scope="module")
def created_ids():
    ids: list[str] = []
    yield ids
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


# ---------------- (1) POST-increment view_count ----------------
class TestPostIncrementViews:
    SLUG = "wysiwyg-cms"  # may not exist; fall back to first published

    def _slug(self, api):
        # try requested slug, else first published
        r = api.get(f"{BASE_URL}/api/blog/posts/{self.SLUG}", timeout=15)
        if r.status_code == 200:
            return self.SLUG
        return api.get(f"{BASE_URL}/api/blog/posts").json()["posts"][0]["slug"]

    def test_two_different_ips_increment(self, api):
        slug = self._slug(api)
        h1 = {"X-Forwarded-For": f"198.51.100.{uuid.uuid4().int % 250 + 1}", "User-Agent": UA}
        h2 = {"X-Forwarded-For": f"198.51.100.{uuid.uuid4().int % 250 + 1}", "User-Agent": UA}
        v1 = api.get(f"{BASE_URL}/api/blog/posts/{slug}", headers=h1, timeout=15).json()["post"]["view_count"]
        v2 = api.get(f"{BASE_URL}/api/blog/posts/{slug}", headers=h2, timeout=15).json()["post"]["view_count"]
        # Post-increment semantics: v2 should be v1+1 (each request counts its own increment)
        assert v2 == v1 + 1, f"Expected post-increment v2==v1+1; v1={v1} v2={v2}"

    def test_same_ip_no_double_inc(self, api):
        slug = self._slug(api)
        ip = f"198.51.101.{uuid.uuid4().int % 250 + 1}"
        h = {"X-Forwarded-For": ip, "User-Agent": UA}
        v1 = api.get(f"{BASE_URL}/api/blog/posts/{slug}", headers=h, timeout=15).json()["post"]["view_count"]
        v2 = api.get(f"{BASE_URL}/api/blog/posts/{slug}", headers=h, timeout=15).json()["post"]["view_count"]
        assert v2 == v1, f"Throttle should suppress same-IP repeat; v1={v1} v2={v2}"


# ---------------- (2) PATCH partial payloads ----------------
class TestPatchPartial:
    def _create_post(self, admin, created_ids):
        payload = {
            "title": f"TEST_PATCH_{uuid.uuid4().hex[:6]}",
            "content_html": "<p>original body content for patch testing.</p>",
            "status": "draft",
            "category": "Testing",
        }
        r = admin.post(f"{BASE_URL}/api/admin/blog/posts",
                       json=payload,
                       headers={"Content-Type": "application/json"},
                       timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        created_ids.append(d["id"])
        return d

    def test_patch_only_tldr_preserves_other(self, admin, created_ids):
        orig = self._create_post(admin, created_ids)
        pid = orig["id"]
        r = admin.patch(
            f"{BASE_URL}/api/admin/blog/posts/{pid}",
            json={"tldr": "tldr-only-patch"},
            headers={"Content-Type": "application/json"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["tldr"] == "tldr-only-patch"
        assert d["title"] == orig["title"], "title must be preserved on partial PATCH"
        assert d["status"] == orig["status"], "status must be preserved"
        assert d["content_html"] == orig["content_html"], "content_html must be preserved"

    def test_patch_empty_is_noop_200(self, admin, created_ids):
        orig = self._create_post(admin, created_ids)
        pid = orig["id"]
        r = admin.patch(
            f"{BASE_URL}/api/admin/blog/posts/{pid}",
            json={},
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == orig["title"]
        assert d["content_html"] == orig["content_html"]

    def test_patch_invalid_faq_422(self, admin, created_ids):
        orig = self._create_post(admin, created_ids)
        pid = orig["id"]
        r = admin.patch(
            f"{BASE_URL}/api/admin/blog/posts/{pid}",
            json={"faq": [{"question": 1}]},
            headers={"Content-Type": "application/json"},
            timeout=15,
        )
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text[:200]}"


# ---------------- (3) Cover image upload ----------------
class TestCoverUpload:
    def test_upload_requires_auth(self, api):
        png = _make_png_bytes()
        files = {"file": ("a.png", io.BytesIO(png), "image/png")}
        # Use fresh session (no JSON content-type)
        s = requests.Session()
        s.headers.update({"User-Agent": UA})
        r = s.post(f"{BASE_URL}/api/admin/blog/upload-cover", files=files, timeout=20)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"

    def test_upload_png_success(self, admin):
        png = _make_png_bytes()
        files = {"file": ("test_cover.png", io.BytesIO(png), "image/png")}
        # Don't send JSON Content-Type when posting multipart — use fresh session
        s = requests.Session()
        s.headers.update({k: v for k, v in admin.headers.items() if k.lower() == "authorization"})
        s.headers["User-Agent"] = UA
        r = s.post(f"{BASE_URL}/api/admin/blog/upload-cover", files=files, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["id"].startswith("blogimg_"), d
        assert d["url"].startswith("/api/blog/assets/"), d
        assert d["size"] > 0
        # fetch the asset
        r2 = requests.get(f"{BASE_URL}{d['url']}", timeout=15)
        assert r2.status_code == 200
        ct = r2.headers.get("content-type", "")
        assert "image" in ct.lower(), f"Expected image content-type, got {ct}"
        cc = r2.headers.get("cache-control", "")
        assert "max-age" in cc.lower() and "immutable" in cc.lower(), f"Cache header missing: {cc}"

    def test_upload_invalid_ext_415(self, admin):
        s = requests.Session()
        s.headers.update({k: v for k, v in admin.headers.items() if k.lower() == "authorization"})
        s.headers["User-Agent"] = UA
        files = {"file": ("evil.exe", io.BytesIO(b"MZ\x00\x00bad"), "application/octet-stream")}
        r = s.post(f"{BASE_URL}/api/admin/blog/upload-cover", files=files, timeout=20)
        assert r.status_code == 415, f"Expected 415, got {r.status_code}: {r.text[:200]}"

    def test_upload_too_large_413(self, admin):
        s = requests.Session()
        s.headers.update({k: v for k, v in admin.headers.items() if k.lower() == "authorization"})
        s.headers["User-Agent"] = UA
        # 9 MB of PNG-prefixed garbage to exceed 8 MB limit
        big = b"\x89PNG\r\n\x1a\n" + (b"\x00" * (9 * 1024 * 1024))
        files = {"file": ("big.png", io.BytesIO(big), "image/png")}
        r = s.post(f"{BASE_URL}/api/admin/blog/upload-cover", files=files, timeout=60)
        assert r.status_code == 413, f"Expected 413, got {r.status_code}"

    def test_invalid_fid_pattern_404(self, api):
        # Path traversal attempt — FastAPI/Starlette normalises, but the
        # regex guard inside the handler must still reject any non-matching fid.
        r = api.get(f"{BASE_URL}/api/blog/assets/notavalidid", timeout=10)
        assert r.status_code == 404

    def test_missing_asset_404(self, api):
        r = api.get(f"{BASE_URL}/api/blog/assets/blogimg_deadbeefcafe", timeout=10)
        assert r.status_code == 404


# ---------------- (4) RSS feed ----------------
class TestRss:
    def test_rss_xml_valid(self, api):
        r = api.get(f"{BASE_URL}/api/blog/rss.xml", timeout=15)
        assert r.status_code == 200, r.text[:200]
        ct = r.headers.get("content-type", "").lower()
        assert "application/rss+xml" in ct, f"Wrong content-type: {ct}"
        body = r.text
        assert '<?xml' in body
        assert '<rss version="2.0"' in body
        assert "<title>WorkSoy Journal</title>" in body
        assert 'rel="self"' in body and 'application/rss+xml' in body, "atom:link self missing"
        assert "xmlns:dc=" in body, "dc namespace missing"
        # at least one <item>
        assert "<item>" in body, "RSS contains no items"
        # RFC-822 pubDate format: "Day, DD Mon YYYY HH:MM:SS GMT"
        assert re.search(
            r"<pubDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT</pubDate>",
            body,
        ), "No RFC-822 pubDate found"
        # Each published slug appears
        posts = api.get(f"{BASE_URL}/api/blog/posts").json()["posts"]
        for p in posts[:5]:
            assert f"/blog/{p['slug']}" in body, f"Missing slug in RSS: {p['slug']}"
        # dc:creator present at least once
        assert "<dc:creator>" in body
