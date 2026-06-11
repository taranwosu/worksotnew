"""Blog router — public + admin + AI CMS + sitemap + robots.

Exposes a single `register_blog(app, *, db, require_admin, _rate_limit, _now,
EMERGENT_LLM_KEY, APP_BASE_URL, log)` function so this module stays decoupled
from `server.py` (no circular imports).
"""
from __future__ import annotations

import re
import time
import uuid
from typing import Any, Optional, List, Literal

import bleach
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import PlainTextResponse, Response
from pydantic import BaseModel, EmailStr, Field


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


class CommentIn(BaseModel):
    post_id: str
    author_name: str = Field(min_length=1, max_length=80)
    author_email: EmailStr
    body: str = Field(min_length=2, max_length=4000)


class SubscribeIn(BaseModel):
    email: EmailStr
    source: Optional[str] = "blog"


class AiMetaIn(BaseModel):
    title: str
    content_html: str
    mode: Literal["meta", "summary", "faq", "keywords"] = "meta"


def _post_summary(doc: dict) -> dict:
    """List-shape: no content_html (perf)."""
    return {
        "id": doc["id"],
        "title": doc["title"],
        "slug": doc["slug"],
        "excerpt": doc.get("excerpt") or "",
        "cover_image": doc.get("cover_image"),
        "category": doc.get("category"),
        "tags": doc.get("tags") or [],
        "status": doc.get("status", "draft"),
        "author_name": doc.get("author_name") or "WorkSoy Editorial",
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
            .sort("created_at", -1)
            .limit(50)
        )
        comments = await comments_cur.to_list(length=50)
        return {
            "post": _post_detail(doc),
            "related": [_post_summary(r) for r in related],
            "comments": [
                {
                    "id": c["id"],
                    "author_name": c["author_name"],
                    "body": c["body"],
                    "created_at": c["created_at"],
                }
                for c in comments
            ],
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
        cid = f"cm_{uuid.uuid4().hex[:12]}"
        body = payload.body.strip()
        is_spam = bool(re.search(r"https?://\S+", body)) and len(body) < 60
        # Bleach comment body too — kill any HTML the user pasted.
        body = bleach.clean(body, tags=[], strip=True)
        doc = {
            "id": cid,
            "post_id": payload.post_id,
            "author_name": payload.author_name.strip(),
            "author_email": payload.author_email.lower(),
            "body": body,
            "status": "pending" if is_spam else "approved",
            "created_at": _now().isoformat(),
        }
        await db.blog_comments.insert_one(doc)
        return {"id": cid, "status": doc["status"]}

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
    async def admin_blog_update(pid: str, payload: BlogPostIn, _: Any = Depends(require_admin)):
        existing = await db.blog_posts.find_one({"id": pid}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Post not found")
        base_slug = _slugify(payload.slug or payload.title)
        slug = await _ensure_unique_slug(base_slug, ignore_id=pid)
        clean_html = sanitize_html(payload.content_html)
        excerpt = (payload.excerpt or _strip_html(clean_html)[:200] + "…").strip()
        update = {
            "title": payload.title.strip(),
            "slug": slug,
            "excerpt": excerpt,
            "content_html": clean_html,
            "cover_image": payload.cover_image,
            "category": (payload.category or "").strip() or None,
            "tags": [t.strip() for t in (payload.tags or []) if t.strip()],
            "status": payload.status,
            "reading_time_min": _reading_time(clean_html),
            "seo_title": payload.seo_title,
            "seo_description": payload.seo_description,
            "canonical_url": payload.canonical_url,
            "faq": [f.model_dump() for f in (payload.faq or [])],
            "tldr": payload.tldr,
            "keywords": [k.strip() for k in (payload.keywords or []) if k.strip()],
            "updated_at": _now().isoformat(),
        }
        if payload.status == "published" and not existing.get("published_at"):
            update["published_at"] = _now().isoformat()
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
