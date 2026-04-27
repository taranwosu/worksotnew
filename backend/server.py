"""WorkSoy FastAPI backend — auth, experts, briefs, proposals, contracts,
milestones (Stripe escrow), messages, expert profiles and admin.

Single-file by design for an MVP. Sections are separated by === banners.
"""
from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Literal

import jwt
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
)
from fastapi import UploadFile, File, Form
from fastapi.responses import FileResponse
from pathlib import Path as _Path
import shutil

import hashlib
import secrets

from mailer import send_email, is_email_enabled
from analytics import track as track_event

load_dotenv()

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_AUTH_URL = os.environ["EMERGENT_AUTH_URL"]
STRIPE_API_KEY = os.environ["STRIPE_API_KEY"]
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@worksoy.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
# Comma-separated list of origins permitted to call the API. Falls back to
# permissive only when ENVIRONMENT is unset or "development" so production
# deployments must opt-in explicitly.
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development").lower()
_cors_raw = os.environ.get("CORS_ORIGINS", "").strip()
CORS_ORIGINS = [o.strip() for o in _cors_raw.split(",") if o.strip()]
UPLOADS_DIR = _Path(os.environ.get("UPLOADS_DIR", "/app/backend/uploads"))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
MAX_FILE_BYTES = 25 * 1024 * 1024  # 25 MB
# Public app URL used for links inside transactional emails (no trailing slash).
APP_BASE_URL = os.environ.get("APP_BASE_URL", "https://worksoy.com").rstrip("/")
PASSWORD_RESET_TTL_MINUTES = int(os.environ.get("PASSWORD_RESET_TTL_MINUTES", "60"))

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("worksoy")

# Opt-in Sentry. The `sentry-sdk` package is intentionally not in
# requirements.txt; install it in the deployment image when SENTRY_DSN is set.
SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
if SENTRY_DSN:
    try:
        import sentry_sdk  # type: ignore[import-not-found]
        from sentry_sdk.integrations.fastapi import FastApiIntegration  # type: ignore[import-not-found]

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=ENVIRONMENT,
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            integrations=[FastApiIntegration()],
            send_default_pii=False,
        )
        log.info("Sentry enabled (env=%s)", ENVIRONMENT)
    except ImportError:
        log.warning("SENTRY_DSN set but sentry-sdk not installed; skipping init")

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="WorkSoy API")
if CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
elif ENVIRONMENT in ("development", "dev", "local", "test"):
    log.warning("CORS_ORIGINS not set; allowing all origins (development only)")
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    raise RuntimeError(
        "CORS_ORIGINS must be set in non-development environments "
        "(comma-separated list of allowed origins)."
    )


# =========================================================================
# Helpers
# =========================================================================
def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash(password: str) -> str:
    return pwd.hash(password)


def _verify(password: str, hashed: str) -> bool:
    return pwd.verify(password, hashed)


async def _issue_session(user_id: str) -> str:
    token = jwt.encode(
        {"sub": user_id, "iat": int(_now().timestamp()), "jti": uuid.uuid4().hex},
        JWT_SECRET,
        algorithm="HS256",
    )
    await db.user_sessions.insert_one(
        {
            "user_id": user_id,
            "session_token": token,
            "expires_at": _now() + timedelta(days=7),
            "created_at": _now(),
        }
    )
    return token


def _set_cookie(resp: Response, token: str) -> None:
    resp.set_cookie(
        key="session_token",
        value=token,
        max_age=7 * 24 * 3600,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
    )


def _extract_token(request: Request) -> Optional[str]:
    tok = request.cookies.get("session_token")
    if tok:
        return tok
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if auth and auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip()
    return None


# =========================================================================
# Auth rate limiter — in-process, fixed-window per IP+bucket.
# Single-instance only; swap for Redis-backed limiter when scaling out.
# =========================================================================
AUTH_RL_MAX = int(os.environ.get("AUTH_RATE_LIMIT_MAX_ATTEMPTS", "5"))
AUTH_RL_WINDOW = int(os.environ.get("AUTH_RATE_LIMIT_WINDOW_SECONDS", "900"))
_auth_attempts: dict[str, tuple[int, float]] = {}


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limit(request: Request, bucket: str) -> None:
    """Raise 429 if the caller has exceeded AUTH_RL_MAX in the current window."""
    key = f"{bucket}:{_client_ip(request)}"
    now = _now().timestamp()
    count, window_start = _auth_attempts.get(key, (0, now))
    if now - window_start > AUTH_RL_WINDOW:
        count, window_start = 0, now
    count += 1
    _auth_attempts[key] = (count, window_start)
    if count > AUTH_RL_MAX:
        retry_after = int(AUTH_RL_WINDOW - (now - window_start))
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please try again later.",
            headers={"Retry-After": str(max(retry_after, 1))},
        )


# =========================================================================
# Models — public shapes
# =========================================================================
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    provider: str
    role: str = "client"  # client | expert | admin
    created_at: datetime


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)
    role: Literal["client", "expert"] = "client"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class PasswordResetConfirmIn(BaseModel):
    token: str = Field(min_length=16, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    company: Optional[str] = Field(default=None, max_length=120)
    topic: Literal["general", "bench", "apply", "press"] = "general"
    message: str = Field(min_length=10, max_length=5000)


class ContactSubmission(BaseModel):
    id: str
    name: str
    email: str
    company: Optional[str] = None
    topic: str
    message: str
    created_at: datetime
    handled: bool = False


class Expert(BaseModel):
    id: str
    name: str
    headline: str
    category: str
    specialties: List[str]
    location: str
    hourlyRate: int
    currency: str = "USD"
    rating: float
    reviewCount: int
    availability: str
    topRated: bool
    verified: bool
    image: str
    bio: str
    yearsExperience: int
    languages: List[str]
    certifications: List[str]


class ExpertProfileIn(BaseModel):
    headline: str = Field(min_length=3, max_length=140)
    category: str
    specialties: List[str] = Field(default_factory=list)
    hourlyRate: int = Field(ge=10, le=2000)
    location: str
    yearsExperience: int = Field(ge=0, le=60)
    bio: str = Field(min_length=30, max_length=2000)
    image: Optional[str] = None
    languages: List[str] = Field(default_factory=lambda: ["English"])
    certifications: List[str] = Field(default_factory=list)
    availability: str = "Available now"


class BriefIn(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=20, max_length=5000)
    category: str
    required_skills: List[str] = Field(default_factory=list)
    budget_min: int = Field(ge=0)
    budget_max: int = Field(ge=0)
    currency: str = "USD"
    engagement_type: Literal["fixed", "hourly", "retainer"] = "fixed"
    duration_weeks: int = Field(ge=1, le=104)
    remote_ok: bool = True
    location: str = "Remote"


class Brief(BriefIn):
    id: str
    user_id: str
    status: str  # open | closed | awarded
    proposal_count: int
    created_at: datetime
    company_name: Optional[str] = None
    contact_email: Optional[str] = None


class ProposalIn(BaseModel):
    cover_letter: str = Field(min_length=20, max_length=4000)
    proposed_rate: float = Field(gt=0)
    rate_type: Literal["hourly", "fixed"] = "fixed"
    estimated_duration_weeks: int = Field(ge=1, le=104)


class Proposal(BaseModel):
    id: str
    brief_id: str
    expert_user_id: str
    expert_name: str
    expert_headline: Optional[str] = None
    expert_image: Optional[str] = None
    cover_letter: str
    proposed_rate: float
    rate_type: str
    estimated_duration_weeks: int
    status: str  # pending | accepted | rejected | withdrawn
    created_at: datetime


class Milestone(BaseModel):
    id: str
    contract_id: str
    title: str
    description: Optional[str] = ""
    amount: float
    status: str  # pending | funded | submitted | released
    order: int
    funded_at: Optional[datetime] = None
    released_at: Optional[datetime] = None


class Contract(BaseModel):
    id: str
    brief_id: str
    brief_title: str
    proposal_id: str
    client_user_id: str
    expert_user_id: str
    expert_name: str
    client_name: str
    total_amount: float
    currency: str = "USD"
    status: str  # active | completed | disputed
    created_at: datetime


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    file_id: Optional[str] = None


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_user_id: str
    sender_name: str
    body: str
    created_at: datetime
    file_id: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    file_content_type: Optional[str] = None


class ConversationSummary(BaseModel):
    id: str
    brief_id: Optional[str]
    brief_title: Optional[str]
    other_user_id: str
    other_user_name: str
    other_user_image: Optional[str]
    last_body: Optional[str]
    last_at: Optional[datetime]
    unread: int


class CheckoutIn(BaseModel):
    milestone_id: str
    origin_url: str


# =========================================================================
# Auth
# =========================================================================
async def get_current_user(request: Request) -> User:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid session")
    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < _now():
        raise HTTPException(status_code=401, detail="Session expired")
    udoc = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
    if not udoc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**udoc)


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/auth/register")
async def register(payload: RegisterIn, request: Request, response: Response):
    _rate_limit(request, "register")
    existing = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0, "user_id": 1})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one(
        {
            "user_id": user_id,
            "email": payload.email.lower(),
            "name": payload.name,
            "picture": None,
            "provider": "jwt",
            "role": payload.role,
            "password_hash": _hash(payload.password),
            "created_at": _now(),
        }
    )
    token = await _issue_session(user_id)
    _set_cookie(response, token)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    next_step = "/onboarding/expert" if payload.role == "expert" else "/post-request"
    await _notify(
        user_id,
        type="welcome",
        title="Welcome to WorkSoy",
        body="Your account is ready. Tell us what you need next.",
        href=next_step,
        email_subject="Welcome to WorkSoy",
        email_html=(
            f"<p>Hi {payload.name},</p>"
            f"<p>Welcome to WorkSoy. Your account is ready.</p>"
            f"<p><a href=\"{APP_BASE_URL}{next_step}\">"
            f"Pick up where you left off</a></p>"
            "<p>— WorkSoy Operations</p>"
        ),
    )
    return {"session_token": token, "user": User(**user).model_dump()}


@app.post("/api/auth/login")
async def login(payload: LoginIn, request: Request, response: Response):
    _rate_limit(request, "login")
    u = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if not u or not u.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not _verify(payload.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = await _issue_session(u["user_id"])
    _set_cookie(response, token)
    u.pop("password_hash", None)
    return {"session_token": token, "user": User(**u).model_dump()}


@app.post("/api/auth/google-session")
async def google_session(payload: GoogleSessionIn, request: Request, response: Response):
    _rate_limit(request, "google-session")
    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": payload.session_id})
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        data = r.json()
    email = (data.get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=400, detail="Emergent session missing email")
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name", existing["name"]), "picture": data.get("picture"), "provider": "google"}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one(
            {
                "user_id": user_id,
                "email": email,
                "name": data.get("name") or email.split("@")[0],
                "picture": data.get("picture"),
                "provider": "google",
                "role": "client",
                "created_at": _now(),
            }
        )
    token = data.get("session_token") or await _issue_session(user_id)
    await db.user_sessions.update_one(
        {"session_token": token},
        {"$setOnInsert": {
            "user_id": user_id,
            "session_token": token,
            "expires_at": _now() + timedelta(days=7),
            "created_at": _now(),
        }},
        upsert=True,
    )
    _set_cookie(response, token)
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"session_token": token, "user": User(**u).model_dump()}


@app.get("/api/auth/me")
async def me(user: User = Depends(get_current_user)):
    return user.model_dump()


@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    token = _extract_token(request)
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# =========================================================================
# Password reset
# =========================================================================
def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _password_reset_email(name: str, link: str, ttl_minutes: int) -> tuple[str, str]:
    subject = "Reset your WorkSoy password"
    html = f"""
    <p>Hi {name or 'there'},</p>
    <p>We received a request to reset the password for your WorkSoy account.
    Click the link below to choose a new one. This link expires in
    {ttl_minutes} minutes.</p>
    <p><a href="{link}">{link}</a></p>
    <p>If you didn't ask for this, you can safely ignore this email — your
    password won't change.</p>
    <p>— WorkSoy Operations</p>
    """.strip()
    return subject, html


@app.post("/api/auth/password-reset/request")
async def password_reset_request(payload: PasswordResetRequestIn, request: Request):
    """Always returns 200 to avoid leaking which emails exist. Sends an
    email only if the address matches an account with a password (i.e. not
    a Google-only account)."""
    _rate_limit(request, "password-reset-request")
    email = payload.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user and user.get("password_hash"):
        # Issue a fresh token; older unused tokens for this user remain valid
        # until they expire (we cap to one active by deleting prior ones).
        await db.password_resets.delete_many(
            {"user_id": user["user_id"], "used": False}
        )
        raw = secrets.token_urlsafe(32)
        await db.password_resets.insert_one({
            "id": f"pr_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "token_hash": _hash_token(raw),
            "expires_at": _now() + timedelta(minutes=PASSWORD_RESET_TTL_MINUTES),
            "used": False,
            "created_at": _now(),
        })
        link = f"{APP_BASE_URL}/reset-password?token={raw}"
        subject, html = _password_reset_email(
            user.get("name", ""), link, PASSWORD_RESET_TTL_MINUTES,
        )
        if is_email_enabled():
            await send_email(email, subject, html)
        else:
            # Visible in server logs so dev environments without a mail
            # provider can still complete the flow manually.
            log.info("[password-reset] no email provider — link=%s", link)
    return {"ok": True}


@app.post("/api/auth/password-reset/confirm")
async def password_reset_confirm(payload: PasswordResetConfirmIn, request: Request):
    _rate_limit(request, "password-reset-confirm")
    rec = await db.password_resets.find_one(
        {"token_hash": _hash_token(payload.token)}, {"_id": 0}
    )
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    exp = rec["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < _now():
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    await db.users.update_one(
        {"user_id": rec["user_id"]},
        {"$set": {"password_hash": _hash(payload.password)}},
    )
    await db.password_resets.update_one(
        {"id": rec["id"]}, {"$set": {"used": True, "used_at": _now()}}
    )
    # Invalidate all existing sessions on password change.
    await db.user_sessions.delete_many({"user_id": rec["user_id"]})
    return {"ok": True}


# =========================================================================
# Contact form
# =========================================================================
@app.post("/api/contact", response_model=ContactSubmission)
async def submit_contact(payload: ContactIn, request: Request):
    _rate_limit(request, "contact")
    doc = {
        "id": f"contact_{uuid.uuid4().hex[:12]}",
        "name": payload.name.strip(),
        "email": payload.email.lower(),
        "company": (payload.company or "").strip() or None,
        "topic": payload.topic,
        "message": payload.message.strip(),
        "created_at": _now(),
        "handled": False,
        "source_ip": _client_ip(request),
    }
    await db.contact_submissions.insert_one(doc)
    log.info("contact_submission topic=%s email=%s", doc["topic"], doc["email"])
    doc.pop("source_ip", None)
    return ContactSubmission(**doc)


@app.get("/api/admin/contact-submissions", response_model=List[ContactSubmission])
async def list_contact_submissions(
    handled: Optional[bool] = None,
    _: User = Depends(require_admin),
):
    query: dict = {}
    if handled is not None:
        query["handled"] = handled
    cursor = db.contact_submissions.find(query, {"_id": 0, "source_ip": 0}).sort("created_at", -1).limit(500)
    return [ContactSubmission(**doc) async for doc in cursor]


@app.post("/api/admin/contact-submissions/{submission_id}/handled")
async def mark_contact_handled(
    submission_id: str,
    _: User = Depends(require_admin),
):
    res = await db.contact_submissions.update_one(
        {"id": submission_id}, {"$set": {"handled": True, "handled_at": _now()}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {"ok": True}


# =========================================================================
# Experts (public directory + per-user profile)
# =========================================================================
@app.get("/api/experts", response_model=List[Expert])
async def list_experts(q: Optional[str] = None, category: Optional[str] = None, sort: str = "top"):
    query: dict = {"isPublished": True}
    if category and category.lower() != "all":
        query["category"] = category
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"headline": {"$regex": q, "$options": "i"}},
            {"specialties": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.experts.find(query, {"_id": 0})
    if sort == "rate_asc":
        cursor = cursor.sort("hourlyRate", 1)
    elif sort == "rate_desc":
        cursor = cursor.sort("hourlyRate", -1)
    elif sort == "newest":
        cursor = cursor.sort("created_at", -1)
    else:
        cursor = cursor.sort([("topRated", -1), ("rating", -1), ("reviewCount", -1)])
    docs = await cursor.to_list(length=200)
    return [Expert(**d) for d in docs]


@app.get("/api/experts/categories")
async def expert_categories():
    pipeline = [
        {"$match": {"isPublished": True}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$project": {"category": "$_id", "count": 1, "_id": 0}},
        {"$sort": {"category": 1}},
    ]
    return await db.experts.aggregate(pipeline).to_list(length=100)


@app.get("/api/experts/me")
async def my_expert_profile(user: User = Depends(get_current_user)):
    doc = await db.experts.find_one({"user_id": user.user_id}, {"_id": 0})
    return doc  # None if missing


@app.post("/api/experts/me", response_model=Expert)
async def upsert_expert_profile(payload: ExpertProfileIn, user: User = Depends(get_current_user)):
    existing = await db.experts.find_one({"user_id": user.user_id}, {"_id": 0, "id": 1})
    base = {
        **payload.model_dump(),
        "name": user.name,
        "user_id": user.user_id,
        "currency": "USD",
        "image": payload.image or user.picture or f"https://randomuser.me/api/portraits/lego/{abs(hash(user.user_id)) % 9}.jpg",
        "rating": 0.0,
        "reviewCount": 0,
        "topRated": False,
        "verified": False,
        "isPublished": True,
        "updated_at": _now(),
    }
    if existing:
        await db.experts.update_one({"id": existing["id"]}, {"$set": base})
        eid = existing["id"]
    else:
        eid = f"exp_{uuid.uuid4().hex[:10]}"
        await db.experts.insert_one({**base, "id": eid, "created_at": _now()})
        # Upgrade user role to expert
        await db.users.update_one({"user_id": user.user_id}, {"$set": {"role": "expert"}})
    doc = await db.experts.find_one({"id": eid}, {"_id": 0})
    return Expert(**doc)


@app.get("/api/experts/{expert_id}", response_model=Expert)
async def get_expert(expert_id: str):
    doc = await db.experts.find_one({"id": expert_id, "isPublished": True}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Expert not found")
    return Expert(**doc)


# =========================================================================
# Briefs + Proposals (the hiring loop)
# =========================================================================
@app.post("/api/briefs", response_model=Brief)
async def create_brief(payload: BriefIn, user: User = Depends(get_current_user)):
    if payload.budget_max < payload.budget_min:
        raise HTTPException(status_code=400, detail="budget_max must be >= budget_min")
    bid = f"brf_{uuid.uuid4().hex[:10]}"
    doc = {
        **payload.model_dump(),
        "id": bid,
        "user_id": user.user_id,
        "status": "open",
        "proposal_count": 0,
        "company_name": None,
        "contact_email": user.email,
        "created_at": _now(),
    }
    await db.briefs.insert_one(doc)
    doc.pop("_id", None)
    return Brief(**doc)


@app.get("/api/briefs", response_model=List[Brief])
async def list_open_briefs(category: Optional[str] = None, q: Optional[str] = None):
    query: dict = {"status": "open"}
    if category and category.lower() != "all":
        query["category"] = category
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"required_skills": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.briefs.find(query, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return [Brief(**d) for d in docs]


@app.get("/api/briefs/mine", response_model=List[Brief])
async def my_briefs(user: User = Depends(get_current_user)):
    docs = await db.briefs.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return [Brief(**d) for d in docs]


@app.get("/api/briefs/{brief_id}", response_model=Brief)
async def get_brief(brief_id: str):
    doc = await db.briefs.find_one({"id": brief_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Brief not found")
    return Brief(**doc)


@app.post("/api/briefs/{brief_id}/proposals", response_model=Proposal)
async def submit_proposal(brief_id: str, payload: ProposalIn, user: User = Depends(get_current_user)):
    brief = await db.briefs.find_one({"id": brief_id}, {"_id": 0})
    if not brief or brief["status"] != "open":
        raise HTTPException(status_code=404, detail="Brief not open")
    if brief["user_id"] == user.user_id:
        raise HTTPException(status_code=400, detail="You cannot propose on your own brief")
    dup = await db.proposals.find_one({"brief_id": brief_id, "expert_user_id": user.user_id}, {"_id": 0, "id": 1})
    if dup:
        raise HTTPException(status_code=400, detail="You already submitted a proposal for this brief")
    profile = await db.experts.find_one({"user_id": user.user_id}, {"_id": 0})
    pid = f"prp_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": pid,
        "brief_id": brief_id,
        "expert_user_id": user.user_id,
        "expert_name": user.name,
        "expert_headline": profile["headline"] if profile else None,
        "expert_image": (profile or {}).get("image") or user.picture,
        **payload.model_dump(),
        "status": "pending",
        "created_at": _now(),
    }
    await db.proposals.insert_one(doc)
    await db.briefs.update_one({"id": brief_id}, {"$inc": {"proposal_count": 1}})
    await _notify(
        brief["user_id"],
        type="proposal.new",
        title=f"New proposal from {user.name}",
        body=f"On \u201c{brief['title']}\u201d · ${payload.proposed_rate}/{payload.rate_type}",
        href=f"/briefs/{brief_id}",
        entity_id=pid,
        email_subject=f"New proposal on {brief['title']}",
        email_html=f"<p>{user.name} just applied to your brief.</p>",
    )
    doc.pop("_id", None)
    return Proposal(**doc)


@app.get("/api/briefs/{brief_id}/proposals", response_model=List[Proposal])
async def proposals_for_brief(brief_id: str, user: User = Depends(get_current_user)):
    brief = await db.briefs.find_one({"id": brief_id}, {"_id": 0})
    if not brief:
        raise HTTPException(status_code=404, detail="Brief not found")
    if brief["user_id"] != user.user_id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the brief owner may view proposals")
    docs = await db.proposals.find({"brief_id": brief_id}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return [Proposal(**d) for d in docs]


@app.get("/api/proposals/mine", response_model=List[Proposal])
async def my_proposals(user: User = Depends(get_current_user)):
    docs = await db.proposals.find({"expert_user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return [Proposal(**d) for d in docs]


@app.post("/api/proposals/{proposal_id}/accept", response_model=Contract)
async def accept_proposal(proposal_id: str, user: User = Depends(get_current_user)):
    prop = await db.proposals.find_one({"id": proposal_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Proposal not found")
    brief = await db.briefs.find_one({"id": prop["brief_id"]}, {"_id": 0})
    if not brief or brief["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the brief owner may accept")
    if prop["status"] != "pending":
        raise HTTPException(status_code=400, detail="Proposal is not pending")
    # Lock the brief, reject siblings
    await db.briefs.update_one({"id": prop["brief_id"]}, {"$set": {"status": "awarded"}})
    await db.proposals.update_many(
        {"brief_id": prop["brief_id"], "id": {"$ne": proposal_id}, "status": "pending"},
        {"$set": {"status": "rejected"}},
    )
    await db.proposals.update_one({"id": proposal_id}, {"$set": {"status": "accepted"}})
    # Create contract with 1 default milestone for full fixed amount
    total = float(prop["proposed_rate"]) * (1 if prop["rate_type"] == "fixed" else int(prop["estimated_duration_weeks"]) * 40)
    cid = f"ctr_{uuid.uuid4().hex[:10]}"
    contract_doc = {
        "id": cid,
        "brief_id": prop["brief_id"],
        "brief_title": brief["title"],
        "proposal_id": proposal_id,
        "client_user_id": user.user_id,
        "expert_user_id": prop["expert_user_id"],
        "expert_name": prop["expert_name"],
        "client_name": user.name,
        "total_amount": round(total, 2),
        "currency": "USD",
        "status": "active",
        "created_at": _now(),
    }
    await db.contracts.insert_one(contract_doc)
    # Create one kickoff milestone (25%) and one final milestone (75%)
    ms = [
        {
            "id": f"ms_{uuid.uuid4().hex[:10]}",
            "contract_id": cid,
            "title": "Kickoff milestone",
            "description": "Initial scoping + kickoff.",
            "amount": round(total * 0.25, 2),
            "status": "pending",
            "order": 1,
            "funded_at": None,
            "released_at": None,
        },
        {
            "id": f"ms_{uuid.uuid4().hex[:10]}",
            "contract_id": cid,
            "title": "Final delivery",
            "description": "Final delivery + handoff.",
            "amount": round(total * 0.75, 2),
            "status": "pending",
            "order": 2,
            "funded_at": None,
            "released_at": None,
        },
    ]
    await db.milestones.insert_many(ms)
    # Open a conversation between the two parties
    conv_id = f"cnv_{uuid.uuid4().hex[:10]}"
    await db.conversations.insert_one({
        "id": conv_id,
        "brief_id": prop["brief_id"],
        "brief_title": brief["title"],
        "proposal_id": proposal_id,
        "contract_id": cid,
        "participants": sorted([user.user_id, prop["expert_user_id"]]),
        "last_body": None,
        "last_at": _now(),
        "read_by": {},
    })
    await _notify(
        prop["expert_user_id"],
        type="proposal.accepted",
        title="Your proposal was accepted 🎉",
        body=f"Contract opened for \u201c{brief['title']}\u201d.",
        href=f"/contracts/{cid}",
        entity_id=cid,
    )
    contract_doc.pop("_id", None)
    return Contract(**contract_doc)


@app.post("/api/proposals/{proposal_id}/reject")
async def reject_proposal(proposal_id: str, user: User = Depends(get_current_user)):
    prop = await db.proposals.find_one({"id": proposal_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Proposal not found")
    brief = await db.briefs.find_one({"id": prop["brief_id"]}, {"_id": 0})
    if not brief or brief["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the brief owner may reject")
    await db.proposals.update_one({"id": proposal_id}, {"$set": {"status": "rejected"}})
    await _notify(
        prop["expert_user_id"],
        type="proposal.rejected",
        title="Proposal not selected",
        body=f"Your proposal on \u201c{brief['title']}\u201d wasn\u2019t picked this time.",
        href=f"/briefs/{brief['id']}",
        entity_id=proposal_id,
    )
    return {"ok": True}


# =========================================================================
# Contracts + Milestones + Stripe escrow
# =========================================================================
@app.get("/api/contracts/mine", response_model=List[Contract])
async def my_contracts(user: User = Depends(get_current_user)):
    docs = await db.contracts.find(
        {"$or": [{"client_user_id": user.user_id}, {"expert_user_id": user.user_id}]},
        {"_id": 0},
    ).sort("created_at", -1).to_list(length=200)
    return [Contract(**d) for d in docs]


@app.get("/api/contracts/{contract_id}")
async def get_contract(contract_id: str, user: User = Depends(get_current_user)):
    c = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    if user.user_id not in (c["client_user_id"], c["expert_user_id"]) and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not a party to this contract")
    ms = await db.milestones.find({"contract_id": contract_id}, {"_id": 0}).sort("order", 1).to_list(length=100)
    return {"contract": Contract(**c).model_dump(), "milestones": [Milestone(**m).model_dump() for m in ms]}


@app.post("/api/payments/checkout/milestone")
async def create_milestone_checkout(payload: CheckoutIn, request: Request, user: User = Depends(get_current_user)):
    ms = await db.milestones.find_one({"id": payload.milestone_id}, {"_id": 0})
    if not ms:
        raise HTTPException(status_code=404, detail="Milestone not found")
    contract = await db.contracts.find_one({"id": ms["contract_id"]}, {"_id": 0})
    if not contract or contract["client_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the client can fund this milestone")
    if ms["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Milestone already {ms['status']}")
    amount = float(ms["amount"])
    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/contracts/{contract['id']}?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/contracts/{contract['id']}"
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    req = CheckoutSessionRequest(
        amount=amount,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "milestone_id": ms["id"],
            "contract_id": contract["id"],
            "user_id": user.user_id,
            "kind": "milestone",
        },
    )
    session = await stripe.create_checkout_session(req)
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user.user_id,
        "milestone_id": ms["id"],
        "contract_id": contract["id"],
        "amount": amount,
        "currency": "usd",
        "status": "initiated",
        "payment_status": "pending",
        "metadata": req.metadata,
        "created_at": _now(),
        "updated_at": _now(),
    })
    return {"url": session.url, "session_id": session.session_id}


@app.get("/api/payments/status/{session_id}")
async def payment_status(session_id: str, request: Request, user: User = Depends(get_current_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Unknown session")
    if tx["user_id"] != user.user_id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not your session")
    host_url = str(request.base_url)
    stripe = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}api/webhook/stripe")
    try:
        st = await stripe.get_checkout_status(session_id)
    except Exception as e:  # noqa: BLE001
        log.warning("stripe status lookup failed for %s: %s", session_id, e)
        return {
            "status": tx.get("status", "pending"),
            "payment_status": tx.get("payment_status", "pending"),
            "amount_total": tx.get("amount_total") or int(float(tx["amount"]) * 100),
            "currency": tx.get("currency", "usd"),
            "cached": True,
        }
    # Idempotent update
    if tx["payment_status"] != "paid" and st.payment_status == "paid":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {
                "status": st.status, "payment_status": st.payment_status,
                "amount_total": st.amount_total, "currency": st.currency,
                "updated_at": _now(),
            }},
        )
        await db.milestones.update_one(
            {"id": tx["milestone_id"], "status": "pending"},
            {"$set": {"status": "funded", "funded_at": _now()}},
        )
    elif tx["payment_status"] != st.payment_status:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"status": st.status, "payment_status": st.payment_status, "updated_at": _now()}},
        )
    return {"status": st.status, "payment_status": st.payment_status, "amount_total": st.amount_total, "currency": st.currency}


@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request, response: Response):
    body = await request.body()
    sig = (
        request.headers.get("Stripe-Signature")
        or request.headers.get("stripe-signature")
        or ""
    )
    if not sig:
        # No signature header — treat as unauthenticated. 400 makes Stripe
        # retry; 200 would silently drop the event.
        log.warning("stripe webhook rejected: missing Stripe-Signature header")
        response.status_code = 400
        return {"ok": False, "error": "missing_signature"}

    host_url = str(request.base_url)
    stripe = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}api/webhook/stripe")
    try:
        evt = await stripe.handle_webhook(body, sig)
    except Exception as e:  # noqa: BLE001
        # Signature failure or malformed payload. Return 400 so Stripe retries
        # rather than silently 200ing.
        log.warning("stripe webhook signature/parse error: %s", e)
        response.status_code = 400
        return {"ok": False, "error": "invalid_signature_or_payload"}

    # Dedupe by event id when available; falls back to session_id+status so we
    # never double-fund a milestone even if the upstream redelivers.
    event_id = getattr(evt, "event_id", None) or getattr(evt, "id", None)
    dedupe_key = event_id or f"{evt.session_id}:{evt.payment_status}"
    try:
        await db.webhook_events.insert_one(
            {"key": dedupe_key, "session_id": evt.session_id,
             "payment_status": evt.payment_status, "received_at": _now()}
        )
    except Exception as e:  # duplicate key → already processed
        log.info("stripe webhook duplicate ignored key=%s err=%s", dedupe_key, e)
        return {"ok": True, "deduped": True}

    if evt.session_id and evt.payment_status == "paid":
        tx = await db.payment_transactions.find_one({"session_id": evt.session_id}, {"_id": 0})
        if not tx:
            log.warning("stripe webhook for unknown session_id=%s", evt.session_id)
            # Tell Stripe we received it; nothing to update on our side.
            return {"ok": True, "unknown_session": True}
        if tx.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": evt.session_id},
                {"$set": {"status": "complete", "payment_status": "paid", "updated_at": _now()}},
            )
            await db.milestones.update_one(
                {"id": tx["milestone_id"], "status": "pending"},
                {"$set": {"status": "funded", "funded_at": _now()}},
            )
            log.info(
                "stripe webhook funded milestone=%s session=%s contract=%s",
                tx.get("milestone_id"), evt.session_id, tx.get("contract_id"),
            )
            await track_event(
                tx["user_id"],
                "milestone.funded",
                {
                    "milestone_id": tx["milestone_id"],
                    "contract_id": tx["contract_id"],
                    "amount": tx.get("amount"),
                    "currency": tx.get("currency", "usd"),
                },
            )
            ms = await db.milestones.find_one({"id": tx["milestone_id"]}, {"_id": 0})
            contract = await db.contracts.find_one(
                {"id": tx["contract_id"]}, {"_id": 0}
            )
            if ms and contract:
                amount_str = f"${ms.get('amount', 0):,}"
                title = ms.get("title", "Milestone")
                href = f"/contracts/{contract['id']}"
                # Notify the expert that escrow is funded.
                await _notify(
                    contract["expert_user_id"],
                    type="milestone.funded",
                    title=f"Milestone funded: {title}",
                    body=f"{amount_str} is in escrow. You can start work.",
                    href=href,
                    entity_id=ms["id"],
                    email_subject=f"Milestone funded — {title}",
                    email_html=(
                        f"<p>Good news — the client funded the &ldquo;{title}&rdquo; "
                        f"milestone for {amount_str}.</p>"
                        f"<p>Funds are held in escrow and released when the work is "
                        f"approved.</p>"
                        f"<p><a href=\"{APP_BASE_URL}{href}\">Open the contract</a></p>"
                    ),
                )
                # Confirmation receipt to the client.
                await _notify(
                    contract["client_user_id"],
                    type="milestone.funded.client",
                    title=f"Payment received: {title}",
                    body=f"{amount_str} is in escrow.",
                    href=href,
                    entity_id=ms["id"],
                    email_subject=f"Payment received — {title}",
                    email_html=(
                        f"<p>We received your payment of {amount_str} for "
                        f"&ldquo;{title}&rdquo;.</p>"
                        f"<p>Funds are held in escrow until you approve the work.</p>"
                        f"<p><a href=\"{APP_BASE_URL}{href}\">View the contract</a></p>"
                    ),
                )
    return {"ok": True}


@app.post("/api/milestones/{milestone_id}/submit")
async def submit_milestone(milestone_id: str, user: User = Depends(get_current_user)):
    ms = await db.milestones.find_one({"id": milestone_id}, {"_id": 0})
    if not ms:
        raise HTTPException(status_code=404, detail="Milestone not found")
    contract = await db.contracts.find_one({"id": ms["contract_id"]}, {"_id": 0})
    if not contract or contract["expert_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the expert can submit work")
    if ms["status"] != "funded":
        raise HTTPException(status_code=400, detail="Milestone must be funded before submission")
    await db.milestones.update_one({"id": milestone_id}, {"$set": {"status": "submitted"}})
    await _notify(
        contract["client_user_id"],
        type="milestone.submitted",
        title="Work submitted for review",
        body=f"{contract['expert_name']} marked \u201c{ms['title']}\u201d as delivered.",
        href=f"/contracts/{contract['id']}",
        entity_id=milestone_id,
    )
    return {"ok": True}


@app.post("/api/milestones/{milestone_id}/release")
async def release_milestone(milestone_id: str, user: User = Depends(get_current_user)):
    ms = await db.milestones.find_one({"id": milestone_id}, {"_id": 0})
    if not ms:
        raise HTTPException(status_code=404, detail="Milestone not found")
    contract = await db.contracts.find_one({"id": ms["contract_id"]}, {"_id": 0})
    if not contract or contract["client_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the client can release funds")
    if ms["status"] not in ("submitted", "funded"):
        raise HTTPException(status_code=400, detail="Milestone cannot be released in its current state")
    await db.milestones.update_one({"id": milestone_id}, {"$set": {"status": "released", "released_at": _now()}})
    # If all milestones released, mark contract completed
    remaining = await db.milestones.count_documents({"contract_id": contract["id"], "status": {"$ne": "released"}})
    if remaining == 0:
        await db.contracts.update_one({"id": contract["id"]}, {"$set": {"status": "completed"}})
    await _notify(
        contract["expert_user_id"],
        type="milestone.released",
        title="Funds released 💸",
        body=f"${ms['amount']:,.2f} for \u201c{ms['title']}\u201d is on its way.",
        href=f"/contracts/{contract['id']}",
        entity_id=milestone_id,
    )
    if remaining == 0:
        for uid in (contract["client_user_id"], contract["expert_user_id"]):
            await _notify(
                uid,
                type="contract.completed",
                title="Contract complete — leave a review",
                body=f"\u201c{contract['brief_title']}\u201d has been fully delivered. Share your experience.",
                href=f"/contracts/{contract['id']}",
                entity_id=contract["id"],
            )
    return {"ok": True}


# =========================================================================
# Messages
# =========================================================================
@app.get("/api/conversations/mine", response_model=List[ConversationSummary])
async def my_conversations(user: User = Depends(get_current_user)):
    convs = await db.conversations.find(
        {"participants": user.user_id}, {"_id": 0}
    ).sort("last_at", -1).to_list(length=200)
    out = []
    for c in convs:
        others = [p for p in c["participants"] if p != user.user_id]
        other_id = others[0] if others else user.user_id
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0, "name": 1, "picture": 1}) or {}
        unread = await db.messages.count_documents({
            "conversation_id": c["id"],
            "sender_user_id": {"$ne": user.user_id},
            f"read_by.{user.user_id}": {"$exists": False},
        })
        out.append(ConversationSummary(
            id=c["id"],
            brief_id=c.get("brief_id"),
            brief_title=c.get("brief_title"),
            other_user_id=other_id,
            other_user_name=other.get("name", "User"),
            other_user_image=other.get("picture"),
            last_body=c.get("last_body"),
            last_at=c.get("last_at"),
            unread=unread,
        ))
    return out


@app.get("/api/conversations/{conv_id}/messages", response_model=List[MessageOut])
async def get_messages(conv_id: str, user: User = Depends(get_current_user)):
    c = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
    if not c or user.user_id not in c["participants"]:
        raise HTTPException(status_code=404, detail="Conversation not found")
    msgs = await db.messages.find({"conversation_id": conv_id}, {"_id": 0}).sort("created_at", 1).to_list(length=500)
    # Mark as read
    await db.messages.update_many(
        {"conversation_id": conv_id, "sender_user_id": {"$ne": user.user_id}},
        {"$set": {f"read_by.{user.user_id}": _now()}},
    )
    return [MessageOut(**m) for m in msgs]


@app.post("/api/conversations/{conv_id}/messages", response_model=MessageOut)
async def send_message(conv_id: str, payload: MessageIn, user: User = Depends(get_current_user)):
    c = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
    if not c or user.user_id not in c["participants"]:
        raise HTTPException(status_code=404, detail="Conversation not found")
    mid = f"msg_{uuid.uuid4().hex[:10]}"
    file_meta: dict = {}
    if payload.file_id:
        f = await db.files.find_one({"id": payload.file_id}, {"_id": 0})
        if not f or f.get("conversation_id") != conv_id:
            raise HTTPException(status_code=400, detail="Invalid file attachment")
        file_meta = {
            "file_id": f["id"],
            "file_name": f["filename"],
            "file_size": f["size"],
            "file_content_type": f["content_type"],
        }
    doc = {
        "id": mid,
        "conversation_id": conv_id,
        "sender_user_id": user.user_id,
        "sender_name": user.name,
        "body": payload.body,
        "created_at": _now(),
        "read_by": {user.user_id: _now()},
        **file_meta,
    }
    await db.messages.insert_one(doc)
    await db.conversations.update_one(
        {"id": conv_id},
        {"$set": {"last_body": payload.body, "last_at": _now()}},
    )
    for uid in c["participants"]:
        if uid != user.user_id:
            await _notify(
                uid,
                type="message.new",
                title=f"New message from {user.name}",
                body=payload.body[:140],
                href="/messages",
                entity_id=conv_id,
            )
    doc.pop("_id", None)
    return MessageOut(**doc)


# =========================================================================
# Admin
# =========================================================================
@app.get("/api/admin/stats")
async def admin_stats(user: User = Depends(require_admin)):
    stats = {
        "users": await db.users.count_documents({}),
        "experts": await db.experts.count_documents({}),
        "pending_vetting": await db.experts.count_documents({"verified": False}),
        "briefs_open": await db.briefs.count_documents({"status": "open"}),
        "briefs_awarded": await db.briefs.count_documents({"status": "awarded"}),
        "contracts_active": await db.contracts.count_documents({"status": "active"}),
        "milestones_funded": await db.milestones.count_documents({"status": "funded"}),
        "milestones_released": await db.milestones.count_documents({"status": "released"}),
    }
    return stats


@app.get("/api/admin/experts")
async def admin_list_experts(verified: Optional[bool] = None, user: User = Depends(require_admin)):
    q: dict = {}
    if verified is not None:
        q["verified"] = verified
    docs = await db.experts.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    return docs


@app.post("/api/admin/experts/{expert_id}/verify")
async def admin_verify_expert(expert_id: str, user: User = Depends(require_admin)):
    r = await db.experts.update_one({"id": expert_id}, {"$set": {"verified": True}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Expert not found")
    return {"ok": True}


@app.post("/api/admin/experts/{expert_id}/unverify")
async def admin_unverify_expert(expert_id: str, user: User = Depends(require_admin)):
    await db.experts.update_one({"id": expert_id}, {"$set": {"verified": False}})
    return {"ok": True}


@app.post("/api/admin/experts/{expert_id}/publish")
async def admin_toggle_publish(expert_id: str, user: User = Depends(require_admin)):
    cur = await db.experts.find_one({"id": expert_id}, {"_id": 0, "isPublished": 1})
    if not cur:
        raise HTTPException(status_code=404, detail="Expert not found")
    await db.experts.update_one({"id": expert_id}, {"$set": {"isPublished": not cur.get("isPublished", True)}})
    return {"ok": True}


@app.get("/api/admin/briefs", response_model=List[Brief])
async def admin_list_briefs(user: User = Depends(require_admin)):
    docs = await db.briefs.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    return [Brief(**d) for d in docs]


# =========================================================================
# Notifications (in-app) + email stub
# =========================================================================
class Notification(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    body: Optional[str] = None
    href: Optional[str] = None
    entity_id: Optional[str] = None
    read: bool = False
    created_at: datetime


async def _notify(
    user_id: str,
    type: str,
    title: str,
    body: Optional[str] = None,
    href: Optional[str] = None,
    entity_id: Optional[str] = None,
    email_subject: Optional[str] = None,
    email_html: Optional[str] = None,
) -> None:
    """Create an in-app notification for a user. Emails are stubbed for now."""
    nid = f"ntf_{uuid.uuid4().hex[:10]}"
    await db.notifications.insert_one({
        "id": nid,
        "user_id": user_id,
        "type": type,
        "title": title,
        "body": body,
        "href": href,
        "entity_id": entity_id,
        "read": False,
        "created_at": _now(),
    })
    if email_subject and email_html:
        if is_email_enabled():
            udoc = await db.users.find_one(
                {"user_id": user_id}, {"_id": 0, "email": 1}
            )
            if udoc and udoc.get("email"):
                await send_email(udoc["email"], email_subject, email_html)
        else:
            log.info("[email-disabled] to=%s subject=%s", user_id, email_subject)


@app.get("/api/notifications", response_model=List[Notification])
async def list_notifications(user: User = Depends(get_current_user)):
    docs = await db.notifications.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(length=100)
    return [Notification(**d) for d in docs]


@app.get("/api/notifications/unread-count")
async def unread_count(user: User = Depends(get_current_user)):
    n = await db.notifications.count_documents({"user_id": user.user_id, "read": False})
    return {"count": n}


@app.post("/api/notifications/{nid}/read")
async def mark_read(nid: str, user: User = Depends(get_current_user)):
    r = await db.notifications.update_one({"id": nid, "user_id": user.user_id}, {"$set": {"read": True}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"ok": True}


@app.post("/api/notifications/read-all")
async def mark_all_read(user: User = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user.user_id, "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# =========================================================================
# File uploads (local disk)
# =========================================================================
class FileMeta(BaseModel):
    id: str
    filename: str
    content_type: str
    size: int
    owner_user_id: str
    conversation_id: Optional[str] = None
    contract_id: Optional[str] = None
    milestone_id: Optional[str] = None
    dispute_id: Optional[str] = None
    created_at: datetime


async def _authorize_file_scope(
    user: User,
    conversation_id: Optional[str],
    contract_id: Optional[str],
    milestone_id: Optional[str],
    dispute_id: Optional[str] = None,
) -> None:
    if conversation_id:
        c = await db.conversations.find_one({"id": conversation_id}, {"_id": 0, "participants": 1})
        if not c or user.user_id not in c.get("participants", []):
            raise HTTPException(status_code=403, detail="Not a participant of this conversation")
    if contract_id:
        c = await db.contracts.find_one({"id": contract_id}, {"_id": 0, "client_user_id": 1, "expert_user_id": 1})
        if not c or user.user_id not in (c["client_user_id"], c["expert_user_id"]):
            raise HTTPException(status_code=403, detail="Not a party to this contract")
    if milestone_id:
        ms = await db.milestones.find_one({"id": milestone_id}, {"_id": 0, "contract_id": 1})
        if not ms:
            raise HTTPException(status_code=404, detail="Milestone not found")
        c = await db.contracts.find_one({"id": ms["contract_id"]}, {"_id": 0, "client_user_id": 1, "expert_user_id": 1})
        if not c or user.user_id not in (c["client_user_id"], c["expert_user_id"]):
            raise HTTPException(status_code=403, detail="Not a party to this contract")
    if dispute_id:
        d = await db.disputes.find_one({"id": dispute_id}, {"_id": 0, "contract_id": 1})
        if not d:
            raise HTTPException(status_code=404, detail="Dispute not found")
        c = await db.contracts.find_one({"id": d["contract_id"]}, {"_id": 0, "client_user_id": 1, "expert_user_id": 1})
        if not c or (user.user_id not in (c["client_user_id"], c["expert_user_id"]) and user.role != "admin"):
            raise HTTPException(status_code=403, detail="Not a party to this dispute")


@app.post("/api/files/upload", response_model=FileMeta)
async def upload_file(
    file: UploadFile = File(...),
    conversation_id: Optional[str] = Form(None),
    contract_id: Optional[str] = Form(None),
    milestone_id: Optional[str] = Form(None),
    dispute_id: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
):
    await _authorize_file_scope(user, conversation_id, contract_id, milestone_id, dispute_id)
    fid = f"fil_{uuid.uuid4().hex[:10]}"
    safe_name = (file.filename or "upload").replace("/", "_")[:120]
    # Preserve extension if present
    dest = UPLOADS_DIR / f"{fid}_{safe_name}"
    size = 0
    with dest.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_FILE_BYTES:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_BYTES} bytes")
            out.write(chunk)
    meta = {
        "id": fid,
        "filename": safe_name,
        "content_type": file.content_type or "application/octet-stream",
        "size": size,
        "owner_user_id": user.user_id,
        "conversation_id": conversation_id,
        "contract_id": contract_id,
        "milestone_id": milestone_id,
        "dispute_id": dispute_id,
        "storage_path": str(dest),
        "created_at": _now(),
    }
    await db.files.insert_one(meta)
    meta.pop("_id", None)
    meta.pop("storage_path", None)
    return FileMeta(**meta)


@app.get("/api/files/{fid}")
async def download_file(fid: str, user: User = Depends(get_current_user)):
    f = await db.files.find_one({"id": fid}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    await _authorize_file_scope(user, f.get("conversation_id"), f.get("contract_id"), f.get("milestone_id"))
    path = _Path(f["storage_path"])
    if not path.exists():
        raise HTTPException(status_code=410, detail="File no longer available")
    return FileResponse(path=str(path), filename=f["filename"], media_type=f["content_type"])


# =========================================================================
# Reviews (post-completion)
# =========================================================================
class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=3, max_length=2000)


class Review(BaseModel):
    id: str
    contract_id: str
    reviewer_user_id: str
    reviewer_name: str
    reviewee_user_id: str
    rating: int
    comment: str
    created_at: datetime


async def _recalc_expert_rating(user_id: str) -> None:
    """Recompute rating + reviewCount on the expert profile for user_id."""
    pipeline = [
        {"$match": {"reviewee_user_id": user_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    res = await db.reviews.aggregate(pipeline).to_list(length=1)
    if not res:
        return
    avg = round(float(res[0]["avg"]), 2)
    count = int(res[0]["count"])
    await db.experts.update_one(
        {"user_id": user_id},
        {"$set": {"rating": avg, "reviewCount": count}},
    )


@app.post("/api/contracts/{contract_id}/reviews", response_model=Review)
async def leave_review(contract_id: str, payload: ReviewIn, user: User = Depends(get_current_user)):
    c = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    if user.user_id not in (c["client_user_id"], c["expert_user_id"]):
        raise HTTPException(status_code=403, detail="Not a party to this contract")
    if c["status"] != "completed":
        raise HTTPException(status_code=400, detail="You can only review a completed contract")
    reviewee = c["expert_user_id"] if user.user_id == c["client_user_id"] else c["client_user_id"]
    dup = await db.reviews.find_one({"contract_id": contract_id, "reviewer_user_id": user.user_id}, {"_id": 0, "id": 1})
    if dup:
        raise HTTPException(status_code=400, detail="You already left a review on this contract")
    rid = f"rev_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": rid,
        "contract_id": contract_id,
        "reviewer_user_id": user.user_id,
        "reviewer_name": user.name,
        "reviewee_user_id": reviewee,
        "rating": payload.rating,
        "comment": payload.comment,
        "created_at": _now(),
    }
    await db.reviews.insert_one(doc)
    await _recalc_expert_rating(reviewee)
    await _notify(
        reviewee,
        type="review.received",
        title=f"New {payload.rating}★ review",
        body=payload.comment[:140],
        href=f"/contracts/{contract_id}",
        entity_id=rid,
    )
    doc.pop("_id", None)
    return Review(**doc)


@app.get("/api/contracts/{contract_id}/reviews", response_model=List[Review])
async def contract_reviews(contract_id: str, user: User = Depends(get_current_user)):
    c = await db.contracts.find_one({"id": contract_id}, {"_id": 0, "client_user_id": 1, "expert_user_id": 1})
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    if user.user_id not in (c["client_user_id"], c["expert_user_id"]) and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not a party to this contract")
    docs = await db.reviews.find({"contract_id": contract_id}, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    return [Review(**d) for d in docs]


@app.get("/api/experts/{expert_id}/reviews", response_model=List[Review])
async def expert_reviews(expert_id: str):
    exp = await db.experts.find_one({"id": expert_id}, {"_id": 0, "user_id": 1})
    if not exp or not exp.get("user_id"):
        return []
    docs = await db.reviews.find({"reviewee_user_id": exp["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    return [Review(**d) for d in docs]


# =========================================================================
# Disputes (simple)
# =========================================================================
class DisputeIn(BaseModel):
    reason: str = Field(min_length=10, max_length=2000)


class DisputeResolve(BaseModel):
    action: Literal["release", "refund"]
    note: Optional[str] = Field(default=None, max_length=2000)


class Dispute(BaseModel):
    id: str
    milestone_id: str
    contract_id: str
    opened_by_user_id: str
    opened_by_name: str
    reason: str
    status: str  # open | resolved
    resolution: Optional[str] = None
    resolution_action: Optional[str] = None
    resolution_note: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolved_by_admin_id: Optional[str] = None
    created_at: datetime


@app.post("/api/milestones/{milestone_id}/dispute", response_model=Dispute)
async def file_dispute(milestone_id: str, payload: DisputeIn, user: User = Depends(get_current_user)):
    ms = await db.milestones.find_one({"id": milestone_id}, {"_id": 0})
    if not ms:
        raise HTTPException(status_code=404, detail="Milestone not found")
    c = await db.contracts.find_one({"id": ms["contract_id"]}, {"_id": 0})
    if not c or user.user_id not in (c["client_user_id"], c["expert_user_id"]):
        raise HTTPException(status_code=403, detail="Not a party to this contract")
    if ms["status"] not in ("funded", "submitted"):
        raise HTTPException(status_code=400, detail="Only funded or submitted milestones can be disputed")
    open_existing = await db.disputes.find_one({"milestone_id": milestone_id, "status": "open"}, {"_id": 0, "id": 1})
    if open_existing:
        raise HTTPException(status_code=400, detail="A dispute is already open on this milestone")
    did = f"dsp_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": did,
        "milestone_id": milestone_id,
        "contract_id": ms["contract_id"],
        "opened_by_user_id": user.user_id,
        "opened_by_name": user.name,
        "reason": payload.reason,
        "status": "open",
        "resolution": None,
        "resolution_action": None,
        "resolution_note": None,
        "resolved_at": None,
        "resolved_by_admin_id": None,
        "created_at": _now(),
    }
    await db.disputes.insert_one(doc)
    await db.milestones.update_one({"id": milestone_id}, {"$set": {"status": "disputed"}})
    other = c["expert_user_id"] if user.user_id == c["client_user_id"] else c["client_user_id"]
    await _notify(other, "dispute.opened", "Milestone dispute opened",
                  body=f"A dispute has been filed on milestone '{ms['title']}'. Our team is reviewing.",
                  href=f"/contracts/{c['id']}", entity_id=did)
    # Notify all admins
    async for a in db.users.find({"role": "admin"}, {"_id": 0, "user_id": 1}):
        await _notify(a["user_id"], "dispute.opened", "Dispute needs admin review",
                      body=f"{user.name} filed a dispute on contract {c['id']}.",
                      href="/admin", entity_id=did)
    doc.pop("_id", None)
    return Dispute(**doc)


class DisputeMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    file_id: Optional[str] = None


class DisputeMessage(BaseModel):
    id: str
    dispute_id: str
    sender_user_id: str
    sender_name: str
    sender_role: str  # client | expert | admin
    body: str
    file_id: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    file_content_type: Optional[str] = None
    created_at: datetime


async def _dispute_access(user: User, dispute_id: str) -> tuple[dict, dict, str]:
    """Return (dispute, contract, sender_role) if user can access this dispute."""
    d = await db.disputes.find_one({"id": dispute_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Dispute not found")
    c = await db.contracts.find_one({"id": d["contract_id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Contract missing")
    if user.role == "admin":
        role = "admin"
    elif user.user_id == c["client_user_id"]:
        role = "client"
    elif user.user_id == c["expert_user_id"]:
        role = "expert"
    else:
        raise HTTPException(status_code=403, detail="Not a party to this dispute")
    return d, c, role


@app.get("/api/disputes/{dispute_id}", response_model=Dispute)
async def get_dispute(dispute_id: str, user: User = Depends(get_current_user)):
    d, _, _ = await _dispute_access(user, dispute_id)
    return Dispute(**d)


@app.get("/api/disputes/{dispute_id}/messages", response_model=List[DisputeMessage])
async def get_dispute_messages(dispute_id: str, user: User = Depends(get_current_user)):
    await _dispute_access(user, dispute_id)
    docs = await db.dispute_messages.find(
        {"dispute_id": dispute_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=500)
    return [DisputeMessage(**d) for d in docs]


@app.post("/api/disputes/{dispute_id}/messages", response_model=DisputeMessage)
async def post_dispute_message(
    dispute_id: str,
    payload: DisputeMessageIn,
    user: User = Depends(get_current_user),
):
    d, c, role = await _dispute_access(user, dispute_id)
    file_meta: dict = {}
    if payload.file_id:
        f = await db.files.find_one({"id": payload.file_id}, {"_id": 0})
        if not f or f.get("dispute_id") != dispute_id:
            raise HTTPException(status_code=400, detail="Invalid file attachment")
        file_meta = {
            "file_id": f["id"],
            "file_name": f["filename"],
            "file_size": f["size"],
            "file_content_type": f["content_type"],
        }
    mid = f"dmg_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": mid,
        "dispute_id": dispute_id,
        "sender_user_id": user.user_id,
        "sender_name": user.name,
        "sender_role": role,
        "body": payload.body,
        "created_at": _now(),
        **file_meta,
    }
    await db.dispute_messages.insert_one(doc)
    # Notify the other parties (not the sender)
    targets: set[str] = set()
    if role != "client":
        targets.add(c["client_user_id"])
    if role != "expert":
        targets.add(c["expert_user_id"])
    if role != "admin":
        async for a in db.users.find({"role": "admin"}, {"_id": 0, "user_id": 1}):
            targets.add(a["user_id"])
    for uid in targets:
        await _notify(
            uid,
            type="dispute.message",
            title=f"New evidence on dispute",
            body=payload.body[:140],
            href=f"/contracts/{c['id']}",
            entity_id=dispute_id,
        )
    doc.pop("_id", None)
    return DisputeMessage(**doc)


@app.get("/api/admin/disputes", response_model=List[Dispute])
async def admin_list_disputes(status: Optional[str] = None, user: User = Depends(require_admin)):
    q: dict = {}
    if status:
        q["status"] = status
    docs = await db.disputes.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return [Dispute(**d) for d in docs]


@app.get("/api/contracts/{contract_id}/disputes", response_model=List[Dispute])
async def contract_disputes(contract_id: str, user: User = Depends(get_current_user)):
    c = await db.contracts.find_one({"id": contract_id}, {"_id": 0, "client_user_id": 1, "expert_user_id": 1})
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    if user.user_id not in (c["client_user_id"], c["expert_user_id"]) and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not a party to this contract")
    docs = await db.disputes.find({"contract_id": contract_id}, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    return [Dispute(**d) for d in docs]


@app.post("/api/admin/disputes/{dispute_id}/resolve", response_model=Dispute)
async def admin_resolve_dispute(dispute_id: str, payload: DisputeResolve, admin: User = Depends(require_admin)):
    d = await db.disputes.find_one({"id": dispute_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Dispute not found")
    if d["status"] != "open":
        raise HTTPException(status_code=400, detail="Dispute already resolved")
    ms = await db.milestones.find_one({"id": d["milestone_id"]}, {"_id": 0})
    c = await db.contracts.find_one({"id": d["contract_id"]}, {"_id": 0})
    if not ms or not c:
        raise HTTPException(status_code=404, detail="Contract/milestone missing")
    resolution = ""
    if payload.action == "release":
        await db.milestones.update_one({"id": ms["id"]}, {"$set": {"status": "released", "released_at": _now()}})
        resolution = "Funds released to expert."
        remaining = await db.milestones.count_documents({"contract_id": c["id"], "status": {"$ne": "released"}})
        if remaining == 0:
            await db.contracts.update_one({"id": c["id"]}, {"$set": {"status": "completed"}})
    else:  # refund
        await db.milestones.update_one({"id": ms["id"]}, {"$set": {"status": "pending", "funded_at": None}})
        resolution = "Funds refunded to client."
        # Audit: write a refund row in the ledger so accounting can trace it.
        # We search for the most-recent paid transaction on this milestone and
        # mirror it with a negative amount and kind=refund.
        last = await db.payment_transactions.find_one(
            {"milestone_id": ms["id"], "payment_status": "paid"},
            {"_id": 0},
            sort=[("updated_at", -1)],
        )
        await db.payment_transactions.insert_one({
            "session_id": f"refund_{uuid.uuid4().hex[:12]}",
            "user_id": c["client_user_id"],
            "milestone_id": ms["id"],
            "contract_id": c["id"],
            "amount": -float(ms["amount"]),
            "currency": (last or {}).get("currency", "usd"),
            "status": "refunded",
            "payment_status": "refunded",
            "kind": "refund",
            "origin_session_id": (last or {}).get("session_id"),
            "resolved_by_admin_id": admin.user_id,
            "dispute_id": dispute_id,
            "metadata": {
                "reason": "admin_dispute_resolution",
                "dispute_id": dispute_id,
                "resolution_note": payload.note,
            },
            "created_at": _now(),
            "updated_at": _now(),
        })
    await db.disputes.update_one(
        {"id": dispute_id},
        {"$set": {
            "status": "resolved",
            "resolution": resolution,
            "resolution_action": payload.action,
            "resolution_note": payload.note,
            "resolved_at": _now(),
            "resolved_by_admin_id": admin.user_id,
        }},
    )
    for uid in (c["client_user_id"], c["expert_user_id"]):
        await _notify(uid, "dispute.resolved", "Dispute resolved", body=resolution,
                      href=f"/contracts/{c['id']}", entity_id=dispute_id)
    updated = await db.disputes.find_one({"id": dispute_id}, {"_id": 0})
    return Dispute(**updated)


# =========================================================================
# Startup
# =========================================================================
@app.on_event("startup")
async def _startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.experts.create_index("id", unique=True)
    await db.experts.create_index("user_id", sparse=True)
    await db.experts.create_index("category")
    await db.briefs.create_index("id", unique=True)
    await db.briefs.create_index("user_id")
    await db.briefs.create_index("status")
    await db.proposals.create_index("id", unique=True)
    await db.proposals.create_index("brief_id")
    await db.proposals.create_index("expert_user_id")
    await db.contracts.create_index("id", unique=True)
    await db.contracts.create_index("client_user_id")
    await db.contracts.create_index("expert_user_id")
    await db.milestones.create_index("id", unique=True)
    await db.milestones.create_index("contract_id")
    await db.conversations.create_index("id", unique=True)
    await db.conversations.create_index("participants")
    await db.messages.create_index("conversation_id")
    await db.payment_transactions.create_index("session_id", unique=True)
    await db.notifications.create_index("user_id")
    await db.notifications.create_index([("user_id", 1), ("read", 1)])
    await db.files.create_index("id", unique=True)
    await db.files.create_index("conversation_id", sparse=True)
    await db.files.create_index("contract_id", sparse=True)
    await db.reviews.create_index("id", unique=True)
    await db.reviews.create_index("contract_id")
    await db.reviews.create_index("reviewee_user_id")
    await db.disputes.create_index("id", unique=True)
    await db.disputes.create_index("status")
    await db.dispute_messages.create_index("id", unique=True)
    await db.dispute_messages.create_index("dispute_id")
    await db.contact_submissions.create_index("id", unique=True)
    await db.contact_submissions.create_index("created_at")
    await db.contact_submissions.create_index("handled")
    # Dedupe Stripe webhook deliveries — unique event id (or session+status fallback).
    await db.webhook_events.create_index("key", unique=True)
    await db.webhook_events.create_index("received_at")
    # Password reset tokens — looked up by hash, expire automatically via TTL.
    await db.password_resets.create_index("id", unique=True)
    await db.password_resets.create_index("token_hash", unique=True)
    await db.password_resets.create_index("user_id")
    await db.password_resets.create_index("expires_at", expireAfterSeconds=0)

    # Seed admin (only if ADMIN_PASSWORD is configured)
    existing = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0, "user_id": 1})
    if not existing:
        if not ADMIN_PASSWORD:
            log.warning(
                "Skipping admin seed: ADMIN_PASSWORD not set. "
                "Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment to seed."
            )
        else:
            await db.users.insert_one({
                "user_id": f"user_admin_{uuid.uuid4().hex[:8]}",
                "email": ADMIN_EMAIL,
                "name": "WorkSoy Admin",
                "picture": None,
                "provider": "jwt",
                "role": "admin",
                "password_hash": _hash(ADMIN_PASSWORD),
                "created_at": _now(),
            })
            log.info("Seeded admin user %s", ADMIN_EMAIL)
    log.info("WorkSoy API ready")
