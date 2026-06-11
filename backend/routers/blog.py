"""Blog router — public + admin + AI CMS + sitemap + robots.

Exposes a single `register_blog(app, *, db, require_admin, _rate_limit, _now,
EMERGENT_LLM_KEY, APP_BASE_URL, log)` function so this module stays decoupled
from `server.py` (no circular imports).
"""
from __future__ import annotations

import io
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any, Optional, List, Literal

import bleach
import httpx
from fastapi import APIRouter, HTTPException, Request, Depends, UploadFile, File
from fastapi.responses import FileResponse, PlainTextResponse, Response
from pydantic import BaseModel, EmailStr, Field
from PIL import Image, ImageDraw, ImageFont


# =========================================================================
# Cover-image upload (public read, admin write)
# =========================================================================
BLOG_ASSETS_DIR = Path(os.environ.get("BLOG_ASSETS_DIR", "/app/backend/uploads/blog"))
BLOG_ASSETS_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
MAX_COVER_BYTES = 8 * 1024 * 1024  # 8 MB

# OG-image cache (avoid re-rendering the same slug+title on every share preview).
OG_CACHE_DIR = Path("/tmp/worksoy-og")
OG_CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _author_slug(name: str) -> str:
    s = (name or "").lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"[\s_]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s[:80] or "anonymous"


def _load_font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Best-effort load of a system serif/sans font. Falls back to PIL default."""
    candidates = [
        # Common locations on Debian/Ubuntu containers.
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf" if bold
        else "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except Exception:
            continue
    return ImageFont.load_default()


def _wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> List[str]:
    """Greedy word-wrap to fit max_width pixels."""
    words = (text or "").split()
    lines: List[str] = []
    line: List[str] = []
    for w in words:
        trial = " ".join(line + [w])
        if draw.textlength(trial, font=font) <= max_width:
            line.append(w)
        else:
            if line:
                lines.append(" ".join(line))
            line = [w]
    if line:
        lines.append(" ".join(line))
    return lines


# =========================================================================
# HTML sanitisation
# =========================================================================
# Tags + attrs that map 1:1 to the WYSIWYG (TipTap StarterKit + Link + Image).
ALLOWED_TAGS = [
    "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
    "strong", "b", "em", "i", "u", "s", "del", "ins",
    "a", "img",
    "ul", "ol", "li",
    "blockquote", "code", "pre", "hr",
    "table", "thead", "tbody", "tr", "th", "td",
    "figure", "figcaption",
    "span", "div",
]
ALLOWED_ATTRS = {
    "a": ["href", "title", "rel", "target"],
    "img": ["src", "alt", "title", "width", "height"],
    "code": ["class"],
    "pre": ["class"],
    "span": ["class"],
    "div": ["class"],
    "th": ["scope"],
}
ALLOWED_PROTOCOLS = ["http", "https", "mailto"]


def sanitize_html(html: str) -> str:
    """Strip XSS-dangerous markup from admin-supplied HTML.

    Cleans <script>, on* handlers, javascript: URLs, and any tag/attr not on
    the allow-list. Idempotent.
    """
    if not html:
        return ""
    cleaned = bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True,
    )
    # Force noopener on anchor targets so we never leak rel=opener.
    cleaned = re.sub(
        r'<a([^>]*?)\stargets?="_blank"([^>]*)>',
        r'<a\1 target="_blank" rel="noopener noreferrer nofollow"\2>',
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned


# =========================================================================
# View-count throttle (in-process, per IP+post)
# =========================================================================
VIEW_TTL_SECONDS = 6 * 60 * 60  # 6h
_view_seen: dict[str, float] = {}
_view_seen_max = 50_000  # soft cap on memory growth


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _should_count_view(post_id: str, request: Request) -> bool:
    """Return True at most once per (IP, post_id) per VIEW_TTL_SECONDS.

    Also drop obvious bots/crawlers by user-agent. Single-instance only — swap
    for Redis when scaling out.
    """
    ua = (request.headers.get("user-agent") or "").lower()
    if not ua:
        return False
    bot_markers = (
        "bot", "spider", "crawl", "preview", "fetch", "monitor",
        "headlesschrome", "phantomjs", "lighthouse", "axios",
    )
    if any(m in ua for m in bot_markers):
        return False
    key = f"{post_id}:{_client_ip(request)}"
    now = time.time()
    # Cheap GC: occasionally drop expired entries.
    if len(_view_seen) > _view_seen_max:
        for k, t in list(_view_seen.items()):
            if now - t > VIEW_TTL_SECONDS:
                _view_seen.pop(k, None)
    last = _view_seen.get(key, 0.0)
    if now - last < VIEW_TTL_SECONDS:
        return False
    _view_seen[key] = now
    return True


# =========================================================================
# Helpers
# =========================================================================
def _slugify(text: str) -> str:
    text = (text or "").lower().strip()
    text = re.sub(r"[^a-z0-9\s_-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text[:80] or f"post-{uuid.uuid4().hex[:6]}"


def _strip_html(html: str) -> str:
    txt = re.sub(r"<[^>]+>", " ", html or "")
    return re.sub(r"\s+", " ", txt).strip()


def _reading_time(html: str) -> int:
    words = len(_strip_html(html).split())
    return max(1, round(words / 220))


# =========================================================================
# Pydantic models
# =========================================================================
class FaqItem(BaseModel):
    question: str = Field(min_length=1, max_length=300)
    answer: str = Field(min_length=1, max_length=2000)


class BlogPostIn(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    slug: Optional[str] = None
    excerpt: Optional[str] = Field(default=None, max_length=500)
    content_html: str
    cover_image: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = []
    status: Literal["draft", "published"] = "draft"
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    canonical_url: Optional[str] = None
    faq: List[FaqItem] = []
    tldr: Optional[str] = None
    keywords: List[str] = []


class BlogPostPatch(BaseModel):
    """Partial update — every field optional. Use `exclude_unset` on the
    Pydantic dump to apply only what the client sent."""
    title: Optional[str] = Field(default=None, min_length=1, max_length=240)
    slug: Optional[str] = None
    excerpt: Optional[str] = Field(default=None, max_length=500)
    content_html: Optional[str] = None
    cover_image: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[Literal["draft", "published"]] = None
    seo_title: Optional[str] = None
    seo_description: Optional[str] = None
    canonical_url: Optional[str] = None
    faq: Optional[List[FaqItem]] = None
    tldr: Optional[str] = None
    keywords: Optional[List[str]] = None


class CommentIn(BaseModel):
    post_id: str
    author_name: str = Field(min_length=1, max_length=80)
    author_email: EmailStr
    body: str = Field(min_length=2, max_length=4000)
    parent_id: Optional[str] = None  # Reply target. Only one level of nesting.


class SubscribeIn(BaseModel):
    email: EmailStr
    source: Optional[str] = "blog"


class AiMetaIn(BaseModel):
    title: str
    content_html: str
    mode: Literal["meta", "summary", "faq", "keywords"] = "meta"


def _post_summary(doc: dict) -> dict:
    """List-shape: no content_html (perf)."""
    author_name = doc.get("author_name") or "WorkSoy Editorial"
    return {
        "id": doc["id"],
        "title": doc["title"],
        "slug": doc["slug"],
        "excerpt": doc.get("excerpt") or "",
        "cover_image": doc.get("cover_image"),
        "category": doc.get("category"),
        "tags": doc.get("tags") or [],
        "status": doc.get("status", "draft"),
        "author_name": author_name,
        "author_slug": _author_slug(author_name),
        "author_picture": doc.get("author_picture"),
        "reading_time_min": doc.get("reading_time_min", 1),
        "view_count": doc.get("view_count", 0),
        "tldr": doc.get("tldr"),
        "keywords": doc.get("keywords") or [],
        "published_at": doc.get("published_at"),
        "updated_at": doc.get("updated_at"),
        "created_at": doc.get("created_at"),
        # Kept null in list payload — front-end card UI never reads it.
        "content_html": None,
        "seo_title": doc.get("seo_title"),
        "seo_description": doc.get("seo_description"),
        "canonical_url": doc.get("canonical_url"),
        "faq": doc.get("faq") or [],
    }


def _post_detail(doc: dict) -> dict:
    """Detail-shape: full body."""
    return {
        **_post_summary(doc),
        "content_html": doc.get("content_html") or "",
    }


# =========================================================================
# Router factory
# =========================================================================
def register_blog(
    app: Any,
    *,
    db: Any,
    require_admin: Any,
    _rate_limit: Any,
    _now: Any,
    EMERGENT_LLM_KEY: str,
    APP_BASE_URL: str,
    log: Any,
) -> None:
    """Mount all blog routes onto `app`. Called once from server startup."""

    router = APIRouter()

    async def _ensure_unique_slug(slug: str, ignore_id: Optional[str] = None) -> str:
        base = slug
        n = 2
        while True:
            q: dict = {"slug": slug}
            if ignore_id:
                q["id"] = {"$ne": ignore_id}
            clash = await db.blog_posts.find_one(q, {"_id": 0, "id": 1})
            if not clash:
                return slug
            slug = f"{base}-{n}"
            n += 1

    # ---- Cover-image upload (admin write, public read) ----
    @router.post("/api/admin/blog/upload-cover")
    async def admin_upload_cover(
        file: UploadFile = File(...),
        _: Any = Depends(require_admin),
    ):
        ext = Path(file.filename or "").suffix.lower()
        if ext not in ALLOWED_IMAGE_EXTS:
            raise HTTPException(
                415,
                "Unsupported image type. Allowed: .png, .jpg, .jpeg, .webp, .gif",
            )
        fid = f"blogimg_{uuid.uuid4().hex[:12]}"
        safe = (file.filename or "cover").replace("/", "_")[:80]
        dest = BLOG_ASSETS_DIR / f"{fid}_{safe}"
        size = 0
        with dest.open("wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_COVER_BYTES:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise HTTPException(
                        413, f"Cover image exceeds {MAX_COVER_BYTES // (1024*1024)} MB"
                    )
                out.write(chunk)
        # Public, no-auth URL. Served below by /api/blog/assets/{fid}.
        url = f"/api/blog/assets/{fid}"
        return {"id": fid, "url": url, "size": size, "content_type": file.content_type}

    @router.get("/api/blog/assets/{fid}")
    async def blog_asset(fid: str):
        if not re.fullmatch(r"blogimg_[a-f0-9]{6,32}", fid):
            raise HTTPException(404, "Asset not found")
        matches = list(BLOG_ASSETS_DIR.glob(f"{fid}_*"))
        if not matches:
            raise HTTPException(404, "Asset not found")
        path = matches[0]
        return FileResponse(
            path,
            headers={"Cache-Control": "public, max-age=604800, immutable"},
        )

    # ---- Open Graph image (1200x630 PNG, per post, cached) ----
    @router.get("/api/blog/og/{slug}.png")
    async def blog_og_image(slug: str):
        post = await db.blog_posts.find_one(
            {"slug": slug, "status": "published"},
            {
                "_id": 0, "title": 1, "category": 1, "author_name": 1,
                "reading_time_min": 1, "cover_image": 1, "updated_at": 1, "id": 1,
            },
        )
        if not post:
            raise HTTPException(404, "Post not found")

        # Cache by post id + updated_at so re-renders happen only on real edits.
        cache_key = f"{post['id']}_{(post.get('updated_at') or '')[:19].replace(':','-')}.png"
        cache_path = OG_CACHE_DIR / cache_key
        if cache_path.exists():
            return FileResponse(
                cache_path,
                media_type="image/png",
                headers={"Cache-Control": "public, max-age=604800, immutable"},
            )

        # WorkSoy brand: cream background, ink text, sun accent.
        W, H = 1200, 630
        CREAM = (250, 245, 235)
        INK = (24, 23, 21)
        INK_60 = (24, 23, 21, 153)
        SUN = (255, 196, 0)
        PAPER = (245, 240, 228)

        img = Image.new("RGB", (W, H), CREAM)
        draw = ImageDraw.Draw(img, "RGBA")

        # Cover image (right ~40% of canvas) — fetched once, masked.
        cover_url = (post.get("cover_image") or "").strip()
        cover_pasted = False
        if cover_url:
            try:
                target_url = cover_url
                # Resolve relative /api/blog/assets/... URLs against APP_BASE_URL.
                if target_url.startswith("/"):
                    target_url = f"{APP_BASE_URL}{target_url}"
                async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
                    r = await client.get(target_url)
                    if r.status_code == 200 and r.headers.get("content-type", "").startswith("image/"):
                        cover = Image.open(io.BytesIO(r.content)).convert("RGB")
                        cw, ch = 460, H
                        cover = cover.resize((cw, ch), Image.LANCZOS)
                        img.paste(cover, (W - cw, 0))
                        # Cream-tinted gradient overlay on the left edge for legibility.
                        overlay = Image.new("RGBA", (200, ch), (250, 245, 235, 0))
                        for x in range(200):
                            alpha = int(255 * (1 - x / 200))
                            for y in range(0, ch, 1):
                                overlay.putpixel((x, y), (250, 245, 235, alpha))
                        img.paste(overlay, (W - cw, 0), overlay)
                        cover_pasted = True
            except Exception:
                log.warning("OG cover fetch failed for %s", slug, exc_info=False)

        # Top brand strip
        draw.rectangle([(0, 0), (W, 8)], fill=SUN)

        # Logo + wordmark (top-left)
        draw.ellipse([(56, 48), (96, 88)], fill=SUN)
        draw.ellipse([(72, 64), (88, 80)], fill=INK)
        wm_font = _load_font(28, bold=True)
        draw.text((108, 52), "worksoy.", font=wm_font, fill=INK)

        # Category eyebrow
        eyebrow_font = _load_font(18, bold=True)
        eyebrow = (post.get("category") or "Journal").upper()
        draw.text((60, 160), f"{eyebrow}  ·  THE WORKSOY JOURNAL", font=eyebrow_font, fill=INK)

        # Title — large display, wrapped to ~700px so it stays clear of cover.
        title = (post.get("title") or "").strip()
        text_width = (W - 120 - (460 if cover_pasted else 0)) + 40
        # Try descending sizes until we fit in ~5 lines.
        title_lines: List[str] = []
        title_font = _load_font(58, bold=True)
        for size in (62, 58, 54, 50, 46, 42, 38):
            f = _load_font(size, bold=True)
            wrapped = _wrap_text(draw, title, f, text_width)
            if len(wrapped) <= 5:
                title_font = f
                title_lines = wrapped
                break
        if not title_lines:
            title_lines = _wrap_text(draw, title, title_font, text_width)[:5]
        y = 210
        ascent, descent = title_font.getmetrics()
        line_height = int((ascent + descent) * 1.1)
        for line in title_lines:
            draw.text((60, y), line, font=title_font, fill=INK)
            y += line_height

        # Footer row: author + reading time + URL
        footer_font = _load_font(20)
        author = post.get("author_name") or "WorkSoy Editorial"
        reading = f"{post.get('reading_time_min', 1)} min read"
        footer_left = f"{author}   ·   {reading}"
        draw.text((60, H - 70), footer_left, font=footer_font, fill=INK_60[:3])
        url_font = _load_font(18, bold=True)
        url_text = f"worksoy.com/blog/{slug[:48]}"
        draw.text((60, H - 40), url_text, font=url_font, fill=INK)

        # Save to cache (best-effort)
        try:
            img.save(cache_path, "PNG", optimize=True)
            return FileResponse(
                cache_path,
                media_type="image/png",
                headers={"Cache-Control": "public, max-age=604800, immutable"},
            )
        except Exception:
            buf = io.BytesIO()
            img.save(buf, "PNG", optimize=True)
            return Response(
                content=buf.getvalue(),
                media_type="image/png",
                headers={"Cache-Control": "public, max-age=604800, immutable"},
            )

    # ---- Authors (public profile + post list) ----
    @router.get("/api/blog/authors/{author_slug}")
    async def blog_author(author_slug: str):
        # Find any published post whose author resolves to this slug, then
        # collect all of their posts. We slugify on the fly so admins don't
        # need to remember stable IDs.
        cur = db.blog_posts.find(
            {"status": "published"},
            {"_id": 0, "content_html": 0},
        ).sort("published_at", -1)
        all_posts = await cur.to_list(length=500)
        matches = [p for p in all_posts if _author_slug(p.get("author_name") or "") == author_slug]
        if not matches:
            raise HTTPException(404, "Author not found")
        # Aggregate stats from the matched set.
        total_views = sum(p.get("view_count", 0) for p in matches)
        categories = sorted({p["category"] for p in matches if p.get("category")})
        first = matches[0]
        author = {
            "slug": author_slug,
            "name": first.get("author_name") or "WorkSoy Editorial",
            "picture": first.get("author_picture"),
            "post_count": len(matches),
            "total_views": total_views,
            "categories": categories,
            "first_published_at": min(
                (p.get("published_at") for p in matches if p.get("published_at")),
                default=None,
            ),
            "latest_published_at": max(
                (p.get("published_at") for p in matches if p.get("published_at")),
                default=None,
            ),
        }
        return {
            "author": author,
            "posts": [_post_summary(p) for p in matches],
        }

    @router.get("/api/blog/authors")
    async def blog_authors_list():
        cur = db.blog_posts.find(
            {"status": "published"},
            {"_id": 0, "author_name": 1, "author_picture": 1, "view_count": 1},
        )
        rows = await cur.to_list(length=2000)
        agg: dict[str, dict] = {}
        for r in rows:
            name = r.get("author_name") or "WorkSoy Editorial"
            slug = _author_slug(name)
            cell = agg.setdefault(
                slug,
                {"slug": slug, "name": name, "picture": r.get("author_picture"), "post_count": 0, "total_views": 0},
            )
            cell["post_count"] += 1
            cell["total_views"] += r.get("view_count", 0) or 0
        return sorted(agg.values(), key=lambda x: x["post_count"], reverse=True)

    # ---- Public ----
    @router.get("/api/blog/posts")
    async def blog_list(
        q: Optional[str] = None,
        category: Optional[str] = None,
        tag: Optional[str] = None,
        limit: int = 24,
        skip: int = 0,
    ):
        f: dict = {"status": "published"}
        if category:
            f["category"] = category
        if tag:
            f["tags"] = tag
        if q:
            f["$or"] = [
                {"title": {"$regex": q, "$options": "i"}},
                {"excerpt": {"$regex": q, "$options": "i"}},
                {"keywords": {"$regex": q, "$options": "i"}},
            ]
        cur = (
            db.blog_posts.find(
                f,
                # Projection: never ship content_html in the list payload.
                {
                    "_id": 0,
                    "content_html": 0,
                },
            )
            .sort("published_at", -1)
            .skip(max(0, skip))
            .limit(min(100, max(1, limit)))
        )
        docs = await cur.to_list(length=100)
        total = await db.blog_posts.count_documents(f)
        return {"posts": [_post_summary(d) for d in docs], "total": total}

    @router.get("/api/blog/posts/{slug}")
    async def blog_get(slug: str, request: Request):
        doc = await db.blog_posts.find_one(
            {"slug": slug, "status": "published"}, {"_id": 0}
        )
        if not doc:
            raise HTTPException(404, "Post not found")
        # Throttled view-count increment (no bots, 6h TTL per IP+slug).
        if _should_count_view(doc["id"], request):
            await db.blog_posts.update_one(
                {"id": doc["id"]}, {"$inc": {"view_count": 1}}
            )
            # Reflect the post-increment value in the response so analytics
            # consumers see the count this request contributed to.
            doc["view_count"] = (doc.get("view_count", 0) or 0) + 1
        related_filter: dict = {"status": "published", "id": {"$ne": doc["id"]}}
        cat = doc.get("category")
        tags = doc.get("tags") or []
        ors = []
        if cat:
            ors.append({"category": cat})
        if tags:
            ors.append({"tags": {"$in": tags}})
        if ors:
            related_filter["$or"] = ors
        related_cur = (
            db.blog_posts.find(
                related_filter, {"_id": 0, "content_html": 0}
            )
            .sort("published_at", -1)
            .limit(4)
        )
        related = await related_cur.to_list(length=4)
        comments_cur = (
            db.blog_comments.find(
                {"post_id": doc["id"], "status": "approved"}, {"_id": 0}
            )
            .sort("created_at", 1)  # oldest first so replies thread naturally
            .limit(200)
        )
        comments_raw = await comments_cur.to_list(length=200)
        # Build a 2-level thread: top-level (parent_id is None) + their replies.
        # Replies to replies collapse to the same thread root (no deep nesting).
        threads: dict[str, dict] = {}
        for c in comments_raw:
            if not c.get("parent_id"):
                threads[c["id"]] = {
                    "id": c["id"],
                    "author_name": c["author_name"],
                    "body": c["body"],
                    "created_at": c["created_at"],
                    "replies": [],
                }
        for c in comments_raw:
            pid = c.get("parent_id")
            if not pid:
                continue
            # Walk up: if the parent is itself a reply, attach to its root.
            root = pid
            while root and root not in threads:
                parent = next((x for x in comments_raw if x["id"] == root), None)
                if not parent:
                    break
                root = parent.get("parent_id")
                if not root:
                    break
            if root in threads:
                threads[root]["replies"].append(
                    {
                        "id": c["id"],
                        "author_name": c["author_name"],
                        "body": c["body"],
                        "created_at": c["created_at"],
                        "parent_id": pid,
                    }
                )
        # Render newest threads first; replies stay oldest-first inside.
        threaded = sorted(
            threads.values(), key=lambda t: t["created_at"], reverse=True
        )
        return {
            "post": _post_detail(doc),
            "related": [_post_summary(r) for r in related],
            "comments": threaded,
        }

    @router.get("/api/blog/posts/{slug}/related-experts")
    async def blog_related_experts(slug: str):
        """Surface 1-2 approved experts matching the post's category/tags.

        Converts long-form reads into marketplace funnel — readers can click
        through and message the expert who can do the work the post describes.
        """
        post = await db.blog_posts.find_one(
            {"slug": slug, "status": "published"}, {"_id": 0, "category": 1, "tags": 1}
        )
        if not post:
            raise HTTPException(404, "Post not found")
        cat = post.get("category")
        tags = post.get("tags") or []
        # Map blog categories to expert categories (loose) — fall back to
        # text search across specialties when no direct match.
        category_map = {
            "Hiring": "Operations",
            "Vetting": "Operations",
            "Fractional": "Finance",
            "Research": "Strategy",
        }
        mapped = category_map.get(cat or "", cat)
        f: dict = {"verified": True, "vetting_stage": "approved"}
        ors = []
        if mapped:
            ors.append({"category": {"$regex": mapped, "$options": "i"}})
        if tags:
            # match any tag against specialties array OR category
            ors.append({"specialties": {"$in": tags}})
            ors.append({"category": {"$in": tags}})
        if ors:
            f["$or"] = ors
        cur = db.experts.find(f, {"_id": 0}).sort("rating", -1).limit(2)
        rows = await cur.to_list(length=2)
        # Fallback — if no match, return top 2 verified experts overall.
        if not rows:
            cur = db.experts.find(
                {"verified": True, "vetting_stage": "approved"}, {"_id": 0}
            ).sort("rating", -1).limit(2)
            rows = await cur.to_list(length=2)
        # Trim to public shape (mirrors ExpertCard expectations).
        return [
            {
                "id": e["id"],
                "name": e.get("name") or "WorkSoy Expert",
                "headline": e.get("headline") or "",
                "category": e.get("category") or "",
                "specialties": e.get("specialties") or [],
                "image": e.get("image") or "",
                "hourlyRate": e.get("hourlyRate") or 0,
                "rating": e.get("rating") or 0,
                "reviewCount": e.get("reviewCount") or 0,
            }
            for e in rows
        ]

    @router.get("/api/blog/categories")
    async def blog_categories():
        pipeline = [
            {"$match": {"status": "published"}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
            {"$match": {"_id": {"$ne": None}}},
            {"$sort": {"count": -1}},
        ]
        rows = await db.blog_posts.aggregate(pipeline).to_list(length=100)
        return [{"category": r["_id"], "count": r["count"]} for r in rows if r["_id"]]

    @router.get("/api/blog/tags")
    async def blog_tags():
        pipeline = [
            {"$match": {"status": "published"}},
            {"$unwind": "$tags"},
            {"$group": {"_id": "$tags", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 60},
        ]
        rows = await db.blog_posts.aggregate(pipeline).to_list(length=60)
        return [{"tag": r["_id"], "count": r["count"]} for r in rows]

    @router.post("/api/blog/comments")
    async def blog_post_comment(payload: CommentIn, request: Request):
        _rate_limit(request, "blog-comment")
        post = await db.blog_posts.find_one({"id": payload.post_id}, {"_id": 0, "id": 1})
        if not post:
            raise HTTPException(404, "Post not found")
        parent_id: Optional[str] = None
        if payload.parent_id:
            parent = await db.blog_comments.find_one(
                {"id": payload.parent_id, "post_id": payload.post_id},
                {"_id": 0, "id": 1, "status": 1},
            )
            if not parent:
                raise HTTPException(404, "Parent comment not found")
            if parent.get("status") not in ("approved", "pending"):
                raise HTTPException(400, "Cannot reply to a removed comment")
            parent_id = payload.parent_id
        cid = f"cm_{uuid.uuid4().hex[:12]}"
        body = payload.body.strip()
        is_spam = bool(re.search(r"https?://\S+", body)) and len(body) < 60
        # Bleach comment body too — kill any HTML the user pasted.
        body = bleach.clean(body, tags=[], strip=True)
        doc = {
            "id": cid,
            "post_id": payload.post_id,
            "parent_id": parent_id,
            "author_name": payload.author_name.strip(),
            "author_email": payload.author_email.lower(),
            "body": body,
            "status": "pending" if is_spam else "approved",
            "created_at": _now().isoformat(),
        }
        await db.blog_comments.insert_one(doc)
        return {"id": cid, "status": doc["status"], "parent_id": parent_id}

    @router.post("/api/blog/subscribe")
    async def blog_subscribe(payload: SubscribeIn, request: Request):
        # Generous dedicated bucket — 20 signups per IP per 10 min is plenty
        # for honest traffic and still catches list-bombing.
        _rate_limit(
            request,
            "blog-subscribe",
            max_attempts=20,
            window=600,
        )
        email = payload.email.lower()
        existing = await db.newsletter_subscribers.find_one(
            {"email": email}, {"_id": 0, "email": 1}
        )
        if existing:
            return {"ok": True, "already_subscribed": True}
        await db.newsletter_subscribers.insert_one(
            {
                "id": f"sub_{uuid.uuid4().hex[:10]}",
                "email": email,
                "source": payload.source or "blog",
                "created_at": _now().isoformat(),
            }
        )
        return {"ok": True, "already_subscribed": False}

    # ---- Sitemap & robots ----
    static_paths = [
        "/", "/experts", "/how-it-works", "/managed-services", "/managed-talent",
        "/pricing", "/for-experts", "/process", "/contact", "/blog",
        "/legal/terms", "/legal/privacy", "/legal/acceptable-use",
    ]

    @router.get("/api/sitemap.xml")
    async def sitemap_xml():
        posts = await db.blog_posts.find(
            {"status": "published"},
            {"_id": 0, "slug": 1, "updated_at": 1, "published_at": 1},
        ).to_list(length=1000)
        urls = []
        for p in static_paths:
            urls.append(
                f"<url><loc>{APP_BASE_URL}{p}</loc>"
                "<changefreq>weekly</changefreq>"
                "<priority>0.7</priority></url>"
            )
        for d in posts:
            lastmod = d.get("updated_at") or d.get("published_at") or ""
            urls.append(
                f"<url><loc>{APP_BASE_URL}/blog/{d['slug']}</loc>"
                + (f"<lastmod>{lastmod[:10]}</lastmod>" if lastmod else "")
                + "<changefreq>monthly</changefreq><priority>0.8</priority></url>"
            )
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "\n".join(urls)
            + "\n</urlset>\n"
        )
        return Response(content=xml, media_type="application/xml")

    @router.get("/api/robots.txt", response_class=PlainTextResponse)
    async def robots_txt():
        return (
            "# WorkSoy — robots.txt (AI + traditional crawlers welcome)\n"
            "User-agent: *\nAllow: /\n"
            "Disallow: /admin\nDisallow: /admin/\n"
            "Disallow: /dashboard\nDisallow: /onboarding/\n"
            "Disallow: /post-request\nDisallow: /briefs/\n"
            "Disallow: /contracts/\nDisallow: /messages\n"
            "Disallow: /settings\n"
            "\n# AI / Answer engines — explicitly welcomed for GEO + AEO\n"
            "User-agent: GPTBot\nAllow: /\n\n"
            "User-agent: ChatGPT-User\nAllow: /\n\n"
            "User-agent: OAI-SearchBot\nAllow: /\n\n"
            "User-agent: ClaudeBot\nAllow: /\n\n"
            "User-agent: Claude-Web\nAllow: /\n\n"
            "User-agent: Google-Extended\nAllow: /\n\n"
            "User-agent: PerplexityBot\nAllow: /\n\n"
            "User-agent: Perplexity-User\nAllow: /\n\n"
            "User-agent: Applebot-Extended\nAllow: /\n\n"
            "User-agent: Bytespider\nAllow: /\n\n"
            "User-agent: CCBot\nAllow: /\n\n"
            f"Sitemap: {APP_BASE_URL}/api/sitemap.xml\n"
        )

    # ---- RSS feed (huge for distribution + AI ingestion) ----
    @router.get("/api/blog/rss.xml")
    async def blog_rss():
        posts = await db.blog_posts.find(
            {"status": "published"},
            {"_id": 0, "content_html": 0},
        ).sort("published_at", -1).limit(50).to_list(length=50)

        def _xml_escape(s: str) -> str:
            return (
                (s or "")
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
                .replace("'", "&apos;")
            )

        def _rss_date(iso: Optional[str]) -> str:
            """Convert ISO-8601 to RFC-822 (RSS spec)."""
            if not iso:
                return ""
            try:
                from datetime import datetime, timezone
                dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.strftime("%a, %d %b %Y %H:%M:%S GMT")
            except Exception:
                return ""

        items: list[str] = []
        for p in posts:
            url = f"{APP_BASE_URL}/blog/{p['slug']}"
            pub_iso = p.get("published_at") or p.get("created_at")
            items.append(
                "<item>"
                f"<title>{_xml_escape(p['title'])}</title>"
                f"<link>{url}</link>"
                f"<guid isPermaLink=\"true\">{url}</guid>"
                f"<pubDate>{_rss_date(pub_iso)}</pubDate>"
                f"<description>{_xml_escape(p.get('excerpt') or '')}</description>"
                f"<dc:creator>{_xml_escape(p.get('author_name') or 'WorkSoy Editorial')}</dc:creator>"
                + (f"<category>{_xml_escape(p['category'])}</category>" if p.get("category") else "")
                + "</item>"
            )

        latest_iso = posts[0].get("published_at") or posts[0].get("created_at") if posts else None
        xml = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" '
            'xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
            "<channel>\n"
            "<title>WorkSoy Journal</title>\n"
            f"<link>{APP_BASE_URL}/blog</link>\n"
            "<description>Field notes on hiring, vetting, and senior talent — from the WorkSoy network.</description>\n"
            "<language>en-us</language>\n"
            f"<lastBuildDate>{_rss_date(latest_iso) or _rss_date(_now().isoformat())}</lastBuildDate>\n"
            f'<atom:link href="{APP_BASE_URL}/api/blog/rss.xml" rel="self" type="application/rss+xml" />\n'
            + "\n".join(items)
            + "\n</channel>\n</rss>\n"
        )
        return Response(content=xml, media_type="application/rss+xml")

    # ---- Admin CMS ----
    @router.get("/api/admin/blog/posts")
    async def admin_blog_list(admin=Depends(require_admin), status: Optional[str] = None):
        f: dict = {}
        if status:
            f["status"] = status
        # Drop content_html on the admin list too — table doesn't need it.
        cur = db.blog_posts.find(f, {"_id": 0, "content_html": 0}).sort("created_at", -1).limit(500)
        docs = await cur.to_list(length=500)
        return [_post_summary(d) for d in docs]

    @router.post("/api/admin/blog/posts")
    async def admin_blog_create(payload: BlogPostIn, admin=Depends(require_admin)):
        pid = f"bp_{uuid.uuid4().hex[:12]}"
        base_slug = _slugify(payload.slug or payload.title)
        slug = await _ensure_unique_slug(base_slug)
        now = _now().isoformat()
        clean_html = sanitize_html(payload.content_html)
        excerpt = (payload.excerpt or _strip_html(clean_html)[:200] + "…").strip()
        doc = {
            "id": pid,
            "title": payload.title.strip(),
            "slug": slug,
            "excerpt": excerpt,
            "content_html": clean_html,
            "cover_image": payload.cover_image,
            "category": (payload.category or "").strip() or None,
            "tags": [t.strip() for t in (payload.tags or []) if t.strip()],
            "status": payload.status,
            "author_user_id": admin.user_id,
            "author_name": admin.name,
            "author_picture": admin.picture,
            "reading_time_min": _reading_time(clean_html),
            "view_count": 0,
            "seo_title": payload.seo_title,
            "seo_description": payload.seo_description,
            "canonical_url": payload.canonical_url,
            "faq": [f.model_dump() for f in (payload.faq or [])],
            "tldr": payload.tldr,
            "keywords": [k.strip() for k in (payload.keywords or []) if k.strip()],
            "created_at": now,
            "updated_at": now,
            "published_at": now if payload.status == "published" else None,
        }
        await db.blog_posts.insert_one(doc)
        return _post_detail(doc)

    @router.patch("/api/admin/blog/posts/{pid}")
    async def admin_blog_update(pid: str, payload: BlogPostPatch, _: Any = Depends(require_admin)):
        existing = await db.blog_posts.find_one({"id": pid}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Post not found")
        # Only apply fields the client explicitly sent. Everything else is
        # preserved from the existing document — true PATCH semantics.
        sent = payload.model_dump(exclude_unset=True)
        update: dict = {"updated_at": _now().isoformat()}

        if "content_html" in sent:
            clean_html = sanitize_html(sent["content_html"])
            update["content_html"] = clean_html
            update["reading_time_min"] = _reading_time(clean_html)
            # Refresh excerpt only if the client did NOT send a fresh one too.
            if "excerpt" not in sent and not existing.get("excerpt"):
                update["excerpt"] = (_strip_html(clean_html)[:200] + "…").strip()

        if "title" in sent or "slug" in sent:
            base_slug = _slugify(sent.get("slug") or sent.get("title") or existing["title"])
            update["slug"] = await _ensure_unique_slug(base_slug, ignore_id=pid)
            if "title" in sent:
                update["title"] = sent["title"].strip()

        if "excerpt" in sent:
            update["excerpt"] = (sent["excerpt"] or "").strip()
        if "cover_image" in sent:
            update["cover_image"] = sent["cover_image"]
        if "category" in sent:
            update["category"] = (sent["category"] or "").strip() or None
        if "tags" in sent:
            update["tags"] = [t.strip() for t in (sent["tags"] or []) if t.strip()]
        if "status" in sent:
            update["status"] = sent["status"]
            if sent["status"] == "published" and not existing.get("published_at"):
                update["published_at"] = _now().isoformat()
        if "seo_title" in sent:
            update["seo_title"] = sent["seo_title"]
        if "seo_description" in sent:
            update["seo_description"] = sent["seo_description"]
        if "canonical_url" in sent:
            update["canonical_url"] = sent["canonical_url"]
        if "faq" in sent:
            update["faq"] = [
                f.model_dump() if hasattr(f, "model_dump") else f
                for f in (sent["faq"] or [])
            ]
        if "tldr" in sent:
            update["tldr"] = sent["tldr"]
        if "keywords" in sent:
            update["keywords"] = [k.strip() for k in (sent["keywords"] or []) if k.strip()]

        await db.blog_posts.update_one({"id": pid}, {"$set": update})
        merged = {**existing, **update}
        return _post_detail(merged)

    @router.delete("/api/admin/blog/posts/{pid}")
    async def admin_blog_delete(pid: str, _: Any = Depends(require_admin)):
        res = await db.blog_posts.delete_one({"id": pid})
        if not res.deleted_count:
            raise HTTPException(404, "Post not found")
        await db.blog_comments.delete_many({"post_id": pid})
        return {"ok": True}

    @router.get("/api/admin/blog/comments")
    async def admin_comments_list(_: Any = Depends(require_admin), status: Optional[str] = None):
        f: dict = {}
        if status:
            f["status"] = status
        cur = db.blog_comments.find(f, {"_id": 0}).sort("created_at", -1).limit(500)
        return await cur.to_list(length=500)

    @router.post("/api/admin/blog/comments/{cid}/status")
    async def admin_comment_status(
        cid: str,
        status: str,
        _: Any = Depends(require_admin),
    ):
        if status not in ("approved", "pending", "spam"):
            raise HTTPException(400, "Invalid status")
        res = await db.blog_comments.update_one({"id": cid}, {"$set": {"status": status}})
        if not res.matched_count:
            raise HTTPException(404, "Comment not found")
        return {"ok": True}

    @router.delete("/api/admin/blog/comments/{cid}")
    async def admin_comment_delete(cid: str, _: Any = Depends(require_admin)):
        await db.blog_comments.delete_one({"id": cid})
        return {"ok": True}

    @router.get("/api/admin/blog/subscribers")
    async def admin_subscribers(_: Any = Depends(require_admin)):
        return await db.newsletter_subscribers.find({}, {"_id": 0}).sort(
            "created_at", -1
        ).to_list(length=2000)

    @router.post("/api/admin/blog/ai/generate")
    async def admin_blog_ai(payload: AiMetaIn, _: Any = Depends(require_admin)):
        if not EMERGENT_LLM_KEY:
            raise HTTPException(503, "AI assist unavailable: EMERGENT_LLM_KEY not configured")
        plain = _strip_html(payload.content_html)[:6000]
        if payload.mode == "meta":
            prompt = (
                "You are an SEO copywriter. Given a blog title and content, write ONE "
                "single SEO meta description, 140-158 characters, action-oriented, "
                "no quotes, no emoji. Output ONLY the description.\n\n"
                f"Title: {payload.title}\nContent: {plain}"
            )
            system = "You output concise, optimised meta descriptions only."
        elif payload.mode == "summary":
            prompt = (
                "Write a tight, 2-3 sentence TL;DR for the post below, written in "
                "the editorial first-person plural ('we', 'our'). No marketing fluff. "
                "Plain text only.\n\n"
                f"Title: {payload.title}\nContent: {plain}"
            )
            system = "You write crisp, factual TL;DRs."
        elif payload.mode == "keywords":
            prompt = (
                "Extract 5 to 8 short SEO keywords from the post below. Return as a "
                "JSON array of strings only, no prose.\n\n"
                f"Title: {payload.title}\nContent: {plain}"
            )
            system = "You extract SEO keywords. Output JSON array only."
        else:  # faq
            prompt = (
                "From the post below, produce 4 AEO-optimised FAQ pairs that a reader "
                "or AI assistant would actually ask. Output as JSON: "
                '[{"question":"...","answer":"..."}]. No prose outside JSON. Each '
                "answer must be 2-3 sentences, self-contained.\n\n"
                f"Title: {payload.title}\nContent: {plain}"
            )
            system = "You produce FAQ JSON for AEO. Output JSON only."

        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"blog-ai-{uuid.uuid4().hex[:8]}",
                system_message=system,
            ).with_model("anthropic", "claude-sonnet-4-6")
            result = await chat.send_message(UserMessage(text=prompt))
            text = (result or "").strip()
        except Exception as e:  # noqa: BLE001
            log.exception("Blog AI generate failed")
            raise HTTPException(500, f"AI request failed: {e}")

        if payload.mode in ("keywords", "faq"):
            import json
            cleaned = re.sub(
                r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE
            ).strip()
            try:
                data = json.loads(cleaned)
                return {"result": data, "mode": payload.mode}
            except Exception:
                return {"result": text, "mode": payload.mode, "raw": True}
        return {"result": text, "mode": payload.mode}

    app.include_router(router)
