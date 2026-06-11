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
# Overridable so CI/tests can point payout calls at a stub.
STRIPE_API_BASE = os.environ.get("STRIPE_API_BASE", "https://api.stripe.com/v1").rstrip("/")
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
# Upload allowlist — business documents, images, archives and design files.
# Anything else (executables, scripts, raw binaries) is rejected to limit the
# malware surface. Keyed on file extension since clients can spoof MIME types.
ALLOWED_UPLOAD_EXTENSIONS = {
    # Documents
    ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx",
    ".csv", ".txt", ".md", ".rtf", ".odt", ".ods", ".odp", ".pages", ".key",
    # Images
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".heic", ".svg",
    # Archives
    ".zip",
    # Design
    ".fig", ".sketch", ".xd", ".ai", ".psd",
}
# Public app URL used for links inside transactional emails (no trailing slash).
APP_BASE_URL = os.environ.get("APP_BASE_URL", "https://worksoy.com").rstrip("/")
PASSWORD_RESET_TTL_MINUTES = int(os.environ.get("PASSWORD_RESET_TTL_MINUTES", "60"))
# Platform service fee applied to released milestones (expert's invoice).
# Configurable so the rate can be tuned without a code change.
PLATFORM_FEE_RATE = float(os.environ.get("PLATFORM_FEE_RATE", "0.15"))

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("worksoy")

# =========================================================================
# Production hardening guards
# =========================================================================
_IS_PROD = ENVIRONMENT not in ("development", "dev", "local", "test")
# Known weak/placeholder secrets that must never reach a real deployment.
_WEAK_JWT_SECRETS = {
    "replace-me-with-a-long-random-string",
    "dev",
    "development",
    "secret",
    "changeme",
    "change-me",
}
_jwt_is_weak = JWT_SECRET in _WEAK_JWT_SECRETS or len(JWT_SECRET) < 32
if _IS_PROD and _jwt_is_weak:
    raise RuntimeError(
        "JWT_SECRET is a placeholder or too short for a non-development "
        "environment. Generate a strong value with "
        '`python -c "import secrets; print(secrets.token_urlsafe(48))"` '
        "and set it before starting."
    )
if _jwt_is_weak:
    log.warning("JWT_SECRET is weak/placeholder — acceptable for development only.")

# Local-disk uploads are wiped when an ephemeral container restarts. Warn
# loudly in production so operators mount a persistent volume (or point
# UPLOADS_DIR at one) before real files are lost.
if _IS_PROD and str(UPLOADS_DIR).startswith("/app"):
    log.warning(
        "UPLOADS_DIR=%s is on the ephemeral container filesystem; uploaded "
        "files will be LOST on container restart. Mount a persistent volume "
        "and point UPLOADS_DIR at it.",
        UPLOADS_DIR,
    )

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
# Message-send limiter — separate, more generous bucket so normal chatting is
# never throttled but bulk spam is. Keyed per-user (see send endpoints).
MSG_RL_MAX = int(os.environ.get("MESSAGE_RATE_LIMIT_MAX", "30"))
MSG_RL_WINDOW = int(os.environ.get("MESSAGE_RATE_LIMIT_WINDOW_SECONDS", "60"))
_auth_attempts: dict[str, tuple[int, float]] = {}


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limit(
    request: Request,
    bucket: str,
    *,
    max_attempts: Optional[int] = None,
    window: Optional[int] = None,
) -> None:
    """Raise 429 if the caller has exceeded the bucket limit in the window.

    Defaults to the auth limit; pass max_attempts/window to override (e.g. the
    more generous message-send bucket).
    """
    max_attempts = AUTH_RL_MAX if max_attempts is None else max_attempts
    window = AUTH_RL_WINDOW if window is None else window
    key = f"{bucket}:{_client_ip(request)}"
    now = _now().timestamp()
    count, window_start = _auth_attempts.get(key, (0, now))
    if now - window_start > window:
        count, window_start = 0, now
    count += 1
    _auth_attempts[key] = (count, window_start)
    if count > max_attempts:
        retry_after = int(window - (now - window_start))
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
    topic: Literal["general", "bench", "apply", "press", "managed"] = "general"
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


async def _resolve_user_optional(request: Request) -> Optional[User]:
    """Like get_current_user but returns None instead of raising on missing/invalid
    session. Lets public-facing checks (e.g. /api/auth/me) respond 200 with a null
    body rather than a 401 that floods the browser console on every public page."""
    token = _extract_token(request)
    if not token:
        return None
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        return None
    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < _now():
        return None
    udoc = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0, "password_hash": 0})
    if not udoc:
        return None
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
async def me(request: Request):
    # Returns the user when authenticated, or null (200) when not. Returning a
    # 200 here — instead of 401 — keeps the browser console clean on public
    # pages where an anonymous visitor has no session cookie.
    user = await _resolve_user_optional(request)
    return user.model_dump() if user else None


@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    token = _extract_token(request)
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# =========================================================================
# Account settings — profile + password
# =========================================================================
class UpdateMeIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    picture: Optional[str] = Field(default=None, max_length=2000)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


@app.patch("/api/me")
async def update_me(payload: UpdateMeIn, user: User = Depends(get_current_user)):
    updates: dict = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.picture is not None:
        updates["picture"] = payload.picture.strip() or None
    if updates:
        await db.users.update_one({"user_id": user.user_id}, {"$set": updates})
    u = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "password_hash": 0})
    return User(**u).model_dump()


@app.post("/api/me/password")
async def change_password(
    payload: ChangePasswordIn,
    request: Request,
    user: User = Depends(get_current_user),
):
    u = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    if not u or not u.get("password_hash"):
        # OAuth-only accounts (e.g. Google sign-in) have no password to change.
        raise HTTPException(
            status_code=400,
            detail="This account signs in without a password (e.g. Google). Password change is unavailable.",
        )
    if not _verify(payload.current_password, u["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$set": {"password_hash": _hash(payload.new_password)}},
    )
    # Invalidate every other session, but keep the caller signed in.
    current = _extract_token(request)
    await db.user_sessions.delete_many(
        {"user_id": user.user_id, "session_token": {"$ne": current}}
    )
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
    if doc["topic"] == "managed":
        who = doc["name"] + (f" · {doc['company']}" if doc["company"] else "")
        await _notify_admins(
            "managed.lead",
            "New managed service lead",
            body=f"{who} ({doc['email']}) requested a consultation.",
            entity_id=doc["id"],
            email_subject=f"WorkSoy managed lead: {who}",
            email_html=(
                f"<h2>New managed service lead</h2>"
                f"<p><strong>{doc['name']}</strong> ({doc['email']})"
                f"{' — ' + doc['company'] if doc['company'] else ''}</p>"
                f"<p style='white-space:pre-wrap'>{doc['message']}</p>"
                f"<p>Review it in the <a href='{APP_BASE_URL}/admin'>admin panel</a>.</p>"
            ),
        )
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
    # Hard gate: only fully-vetted experts (vetting_stage='approved' or legacy
    # `verified=True` seeded entries) appear in the public directory.
    query: dict = {
        "isPublished": True,
        "$or": [{"vetting_stage": "approved"}, {"verified": True}],
    }
    if category and category.lower() != "all":
        query["category"] = category
    if q:
        query["$and"] = [
            {"$or": [
                {"name": {"$regex": q, "$options": "i"}},
                {"headline": {"$regex": q, "$options": "i"}},
                {"specialties": {"$regex": q, "$options": "i"}},
            ]}
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
    existing = await db.experts.find_one({"user_id": user.user_id}, {"_id": 0, "id": 1, "vetting_stage": 1, "verified": 1})
    base = {
        **payload.model_dump(),
        "name": user.name,
        "user_id": user.user_id,
        "currency": "USD",
        "image": payload.image or user.picture or f"https://randomuser.me/api/portraits/lego/{abs(hash(user.user_id)) % 9}.jpg",
        "rating": 0.0,
        "reviewCount": 0,
        "topRated": False,
        # Vetting gate: new profiles start unverified + hidden until they pass
        # the gauntlet. Preserve existing flags when re-saving.
        "verified": bool((existing or {}).get("verified", False)),
        "vetting_stage": (existing or {}).get("vetting_stage", "language_personality"),
        "isPublished": bool((existing or {}).get("verified", False)),
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
    # Kick off vetting application if one doesn't exist yet.
    app_doc = await db.vetting_applications.find_one({"user_id": user.user_id}, {"_id": 0, "id": 1})
    if not app_doc:
        await db.vetting_applications.insert_one({
            "id": f"vap_{uuid.uuid4().hex[:10]}",
            "user_id": user.user_id,
            "expert_id": eid,
            "stage": "language_personality",
            "language_answers": None,
            "skill_answers": None,
            "screening_scheduled_at": None,
            "screening_notes": None,
            "screening_passed": None,
            "test_project_id": None,
            "decision_note": None,
            "history": [{"stage": "language_personality", "at": _now().isoformat(), "by": "system"}],
            "created_at": _now(),
            "updated_at": _now(),
        })
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
    # Hard gate: only fully-vetted experts may submit proposals.
    profile = await db.experts.find_one({"user_id": user.user_id}, {"_id": 0})
    if not profile:
        raise HTTPException(status_code=403, detail="Create your expert profile first")
    stage = profile.get("vetting_stage") or ("approved" if profile.get("verified") else "not_started")
    if stage != "approved":
        raise HTTPException(
            status_code=403,
            detail="You must complete WorkSoy vetting before sending proposals. Open /vetting to continue.",
        )
    dup = await db.proposals.find_one(
        {"brief_id": brief_id, "expert_user_id": user.user_id, "status": {"$ne": "withdrawn"}},
        {"_id": 0, "id": 1},
    )
    if dup:
        raise HTTPException(status_code=400, detail="You already submitted a proposal for this brief")
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


@app.post("/api/proposals/{proposal_id}/withdraw")
async def withdraw_proposal(proposal_id: str, user: User = Depends(get_current_user)):
    prop = await db.proposals.find_one({"id": proposal_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if prop["expert_user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="You can only withdraw your own proposal")
    if prop["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"A {prop['status']} proposal cannot be withdrawn")
    await db.proposals.update_one({"id": proposal_id}, {"$set": {"status": "withdrawn"}})
    # Keep the brief's visible proposal count accurate (submit incremented it).
    await db.briefs.update_one(
        {"id": prop["brief_id"], "proposal_count": {"$gt": 0}},
        {"$inc": {"proposal_count": -1}},
    )
    brief = await db.briefs.find_one({"id": prop["brief_id"]}, {"_id": 0})
    if brief:
        await _notify(
            brief["user_id"],
            type="proposal.withdrawn",
            title="A proposal was withdrawn",
            body=f"{prop.get('expert_name', 'An expert')} withdrew their proposal on \u201c{brief['title']}\u201d.",
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


@app.post("/api/contracts/{contract_id}/complete")
async def complete_contract(contract_id: str, user: User = Depends(get_current_user)):
    """Manual completion fallback. Auto-completion runs on the final milestone
    release, but this lets either party close out a contract whose milestones
    are all released should the auto-detect ever miss — which also unlocks
    reviews. Idempotent: completing an already-completed contract is a no-op."""
    c = await db.contracts.find_one({"id": contract_id}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Contract not found")
    if user.user_id not in (c["client_user_id"], c["expert_user_id"]) and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not a party to this contract")
    if c["status"] == "completed":
        return {"ok": True, "status": "completed"}
    remaining = await db.milestones.count_documents(
        {"contract_id": contract_id, "status": {"$ne": "released"}}
    )
    if remaining > 0:
        raise HTTPException(
            status_code=400,
            detail="All milestones must be released before completing the contract.",
        )
    await db.contracts.update_one({"id": contract_id}, {"$set": {"status": "completed"}})
    for uid in (c["client_user_id"], c["expert_user_id"]):
        await _notify(
            uid,
            type="contract.completed",
            title="Contract complete — leave a review",
            body=f"“{c['brief_title']}” has been fully delivered. Share your experience.",
            href=f"/contracts/{contract_id}",
            entity_id=contract_id,
        )
    return {"ok": True, "status": "completed"}


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
    # Move the expert's cut to their connected account (or queue it until
    # they finish payout onboarding). Never blocks the release itself.
    try:
        await _queue_payout_for_milestone(ms, contract)
    except Exception as e:  # noqa: BLE001
        log.error("payout queueing failed for milestone %s: %s", milestone_id, e)
        await _notify_admins(
            type="payout.error",
            title="Payout queueing failed",
            body=f"Milestone {milestone_id}: {e}. Reconcile manually from the admin payouts panel.",
            href="/admin",
        )
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


class DirectConversationIn(BaseModel):
    expert_id: str


@app.post("/api/conversations/direct")
async def start_direct_conversation(payload: DirectConversationIn, user: User = Depends(get_current_user)):
    """Open (or reuse) a 1:1 conversation with an expert. Powers the
    "Message" CTA on the expert profile."""
    expert = await db.experts.find_one({"id": payload.expert_id}, {"_id": 0, "user_id": 1})
    if not expert:
        raise HTTPException(status_code=404, detail="Expert not found")
    expert_user_id = expert.get("user_id")
    if not expert_user_id:
        raise HTTPException(status_code=400, detail="This expert isn't reachable for messages yet")
    if expert_user_id == user.user_id:
        raise HTTPException(status_code=400, detail="You can't message yourself")
    participants = sorted([user.user_id, expert_user_id])
    # One thread per pair: reuse an existing conversation (brief-scoped or direct).
    existing = await db.conversations.find_one({"participants": participants}, {"_id": 0, "id": 1})
    if existing:
        return {"id": existing["id"]}
    conv_id = f"cnv_{uuid.uuid4().hex[:10]}"
    await db.conversations.insert_one({
        "id": conv_id,
        "brief_id": None,
        "brief_title": None,
        "proposal_id": None,
        "contract_id": None,
        "participants": participants,
        "last_body": None,
        "last_at": _now(),
        "read_by": {},
    })
    await _notify(
        expert_user_id,
        type="message.new",
        title=f"{user.name} wants to connect",
        body="You have a new message thread on WorkSoy.",
        href="/messages",
        entity_id=conv_id,
    )
    return {"id": conv_id}


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
async def send_message(conv_id: str, payload: MessageIn, request: Request, user: User = Depends(get_current_user)):
    _rate_limit(request, f"msg:{user.user_id}", max_attempts=MSG_RL_MAX, window=MSG_RL_WINDOW)
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
    """Create an in-app notification for a user. When email_subject/email_html
    are given and an email provider is configured, also sends the email."""
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
    managed_task_id: Optional[str] = None
    created_at: datetime


async def _authorize_file_scope(
    user: User,
    conversation_id: Optional[str],
    contract_id: Optional[str],
    milestone_id: Optional[str],
    dispute_id: Optional[str] = None,
    managed_task_id: Optional[str] = None,
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
    if managed_task_id:
        t = await db.managed_tasks.find_one(
            {"id": managed_task_id}, {"_id": 0, "client_user_id": 1, "assignee_user_id": 1}
        )
        if not t:
            raise HTTPException(status_code=404, detail="Task not found")
        if user.role != "admin" and user.user_id not in (t.get("client_user_id"), t.get("assignee_user_id")):
            raise HTTPException(status_code=403, detail="Not a party to this managed task")


@app.post("/api/files/upload", response_model=FileMeta)
async def upload_file(
    file: UploadFile = File(...),
    conversation_id: Optional[str] = Form(None),
    contract_id: Optional[str] = Form(None),
    milestone_id: Optional[str] = Form(None),
    dispute_id: Optional[str] = Form(None),
    managed_task_id: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
):
    await _authorize_file_scope(user, conversation_id, contract_id, milestone_id, dispute_id, managed_task_id)
    # Content-type / extension allowlist — reject anything that isn't a known
    # document, image, archive or design file before writing it to disk.
    ext = _Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=(
                "Unsupported file type. Allowed: documents, images, archives "
                "and design files (e.g. PDF, DOCX, XLSX, PNG, JPG, ZIP, FIG)."
            ),
        )
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
        "managed_task_id": managed_task_id,
        "managed_deliverable_id": None,
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
    await _authorize_file_scope(
        user, f.get("conversation_id"), f.get("contract_id"), f.get("milestone_id"),
        f.get("dispute_id"), f.get("managed_task_id"),
    )
    # Deliverable files reach the managed client only after admin approval —
    # being a party to the task is not enough.
    if f.get("managed_task_id") and f.get("managed_deliverable_id") and user.role != "admin":
        t = await db.managed_tasks.find_one(
            {"id": f["managed_task_id"]}, {"_id": 0, "client_user_id": 1, "assignee_user_id": 1}
        )
        if t and user.user_id == t.get("client_user_id") and user.user_id != t.get("assignee_user_id"):
            d = await db.managed_deliverables.find_one(
                {"id": f["managed_deliverable_id"]}, {"_id": 0, "status": 1}
            )
            if not d or d["status"] != "approved":
                raise HTTPException(status_code=403, detail="This deliverable has not been released yet")
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
    request: Request,
    user: User = Depends(get_current_user),
):
    _rate_limit(request, f"msg:{user.user_id}", max_attempts=MSG_RL_MAX, window=MSG_RL_WINDOW)
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
            title="New evidence on dispute",
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
        try:
            await _queue_payout_for_milestone(ms, c)
        except Exception as e:  # noqa: BLE001
            log.error("payout queueing failed for disputed milestone %s: %s", ms["id"], e)
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
# Vetting (5-stage Toptal-style gauntlet)
# =========================================================================
VETTING_STAGES = [
    "not_started",
    "language_personality",
    "skill_quiz",
    "screening_call",
    "test_project",
    "approved",
    "rejected",
]
# Order used to "advance" the application one step. Approved/rejected are
# terminal so they don't appear here.
STAGE_ORDER = [
    "language_personality",
    "skill_quiz",
    "screening_call",
    "test_project",
    "approved",
]


def _next_stage(current: str) -> str:
    if current == "not_started":
        return "language_personality"
    if current in ("approved", "rejected"):
        return current
    try:
        idx = STAGE_ORDER.index(current)
        return STAGE_ORDER[idx + 1] if idx + 1 < len(STAGE_ORDER) else "approved"
    except ValueError:
        return "language_personality"


class VettingApplication(BaseModel):
    id: str
    user_id: str
    expert_id: Optional[str] = None
    stage: str
    language_answers: Optional[dict] = None
    skill_answers: Optional[dict] = None
    screening_scheduled_at: Optional[datetime] = None
    screening_notes: Optional[str] = None
    screening_passed: Optional[bool] = None
    test_project_id: Optional[str] = None
    decision_note: Optional[str] = None
    history: List[dict] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class TestProject(BaseModel):
    id: str
    application_id: str
    user_id: str
    title: str
    description: str
    deliverables: List[str] = Field(default_factory=list)
    due_at: Optional[datetime] = None
    status: str  # assigned | submitted | passed | failed
    submitted_at: Optional[datetime] = None
    reviewer_notes: Optional[str] = None
    file_ids: List[str] = Field(default_factory=list)
    submission_note: Optional[str] = None
    created_at: datetime


# --- Schemas
class LanguageTestIn(BaseModel):
    timezone: str = Field(min_length=2, max_length=80)
    weekly_hours: int = Field(ge=1, le=80)
    english_self_rating: int = Field(ge=1, le=5)
    communication_style: str = Field(min_length=20, max_length=2000)
    why_worksoy: str = Field(min_length=20, max_length=2000)


class SkillTestIn(BaseModel):
    case_study: str = Field(min_length=80, max_length=4000)
    portfolio_url: Optional[str] = Field(default=None, max_length=500)
    methodology: str = Field(min_length=50, max_length=3000)


class TestProjectAssignIn(BaseModel):
    title: str = Field(min_length=4, max_length=160)
    description: str = Field(min_length=40, max_length=4000)
    deliverables: List[str] = Field(default_factory=list)
    due_at: Optional[datetime] = None


class TestProjectSubmitIn(BaseModel):
    submission_note: str = Field(min_length=10, max_length=4000)
    file_ids: List[str] = Field(default_factory=list)


class AdminVettingActionIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=2000)


class ScreeningCallIn(BaseModel):
    scheduled_at: Optional[datetime] = None
    notes: Optional[str] = Field(default=None, max_length=2000)
    passed: Optional[bool] = None


async def _get_or_make_application(user_id: str) -> dict:
    doc = await db.vetting_applications.find_one({"user_id": user_id}, {"_id": 0})
    if doc:
        return doc
    profile = await db.experts.find_one({"user_id": user_id}, {"_id": 0, "id": 1})
    aid = f"vap_{uuid.uuid4().hex[:10]}"
    now = _now()
    new_doc = {
        "id": aid,
        "user_id": user_id,
        "expert_id": profile["id"] if profile else None,
        "stage": "language_personality",
        "language_answers": None,
        "skill_answers": None,
        "screening_scheduled_at": None,
        "screening_notes": None,
        "screening_passed": None,
        "test_project_id": None,
        "decision_note": None,
        "history": [{"stage": "language_personality", "at": now.isoformat(), "by": "system"}],
        "created_at": now,
        "updated_at": now,
    }
    await db.vetting_applications.insert_one(new_doc)
    return new_doc


async def _set_stage(app_id: str, new_stage: str, actor: str, note: Optional[str] = None) -> dict:
    update = {"stage": new_stage, "updated_at": _now()}
    if note:
        update["decision_note"] = note
    await db.vetting_applications.update_one(
        {"id": app_id},
        {
            "$set": update,
            "$push": {"history": {"stage": new_stage, "at": _now().isoformat(), "by": actor, "note": note}},
        },
    )
    return await db.vetting_applications.find_one({"id": app_id}, {"_id": 0})


async def _sync_expert_verification(app: dict) -> None:
    """When an application is approved/rejected, mirror onto the expert doc."""
    if not app.get("expert_id"):
        return
    if app["stage"] == "approved":
        await db.experts.update_one(
            {"id": app["expert_id"]},
            {"$set": {"verified": True, "vetting_stage": "approved", "isPublished": True}},
        )
    elif app["stage"] == "rejected":
        await db.experts.update_one(
            {"id": app["expert_id"]},
            {"$set": {"verified": False, "vetting_stage": "rejected", "isPublished": False}},
        )
    else:
        await db.experts.update_one(
            {"id": app["expert_id"]},
            {"$set": {"vetting_stage": app["stage"], "verified": False, "isPublished": False}},
        )


@app.get("/api/vetting/me", response_model=VettingApplication)
async def my_vetting(user: User = Depends(get_current_user)):
    profile = await db.experts.find_one({"user_id": user.user_id}, {"_id": 0, "id": 1})
    if not profile:
        raise HTTPException(status_code=404, detail="Create your expert profile first")
    doc = await _get_or_make_application(user.user_id)
    return VettingApplication(**doc)


@app.post("/api/vetting/language", response_model=VettingApplication)
async def submit_language(payload: LanguageTestIn, user: User = Depends(get_current_user)):
    profile = await db.experts.find_one({"user_id": user.user_id}, {"_id": 0, "id": 1})
    if not profile:
        raise HTTPException(status_code=404, detail="Create your expert profile first")
    app_doc = await _get_or_make_application(user.user_id)
    if app_doc["stage"] not in ("language_personality",):
        raise HTTPException(status_code=400, detail=f"Cannot submit language test from stage '{app_doc['stage']}'")
    await db.vetting_applications.update_one(
        {"id": app_doc["id"]},
        {"$set": {
            "language_answers": payload.model_dump(),
            "stage": "skill_quiz",
            "updated_at": _now(),
        },
        "$push": {"history": {"stage": "skill_quiz", "at": _now().isoformat(), "by": "expert"}}},
    )
    await _notify_admins("vetting.new_submission", "Vetting: language test submitted",
                         body=f"{user.name} finished the language & personality screen.",
                         href="/admin", entity_id=app_doc["id"])
    doc = await db.vetting_applications.find_one({"id": app_doc["id"]}, {"_id": 0})
    return VettingApplication(**doc)


@app.post("/api/vetting/skill", response_model=VettingApplication)
async def submit_skill(payload: SkillTestIn, user: User = Depends(get_current_user)):
    app_doc = await _get_or_make_application(user.user_id)
    if app_doc["stage"] != "skill_quiz":
        raise HTTPException(status_code=400, detail=f"Cannot submit skill quiz from stage '{app_doc['stage']}'")
    await db.vetting_applications.update_one(
        {"id": app_doc["id"]},
        {"$set": {
            "skill_answers": payload.model_dump(),
            "stage": "screening_call",
            "updated_at": _now(),
        },
        "$push": {"history": {"stage": "screening_call", "at": _now().isoformat(), "by": "expert"}}},
    )
    await _notify_admins("vetting.new_submission", "Vetting: skill quiz submitted",
                         body=f"{user.name} is ready for a screening call.",
                         href="/admin", entity_id=app_doc["id"])
    doc = await db.vetting_applications.find_one({"id": app_doc["id"]}, {"_id": 0})
    return VettingApplication(**doc)


@app.get("/api/vetting/test-project", response_model=Optional[TestProject])
async def my_test_project(user: User = Depends(get_current_user)):
    app_doc = await db.vetting_applications.find_one({"user_id": user.user_id}, {"_id": 0})
    if not app_doc or not app_doc.get("test_project_id"):
        return None
    tp = await db.test_projects.find_one({"id": app_doc["test_project_id"]}, {"_id": 0})
    return TestProject(**tp) if tp else None


@app.post("/api/vetting/test-project/submit", response_model=TestProject)
async def submit_test_project(payload: TestProjectSubmitIn, user: User = Depends(get_current_user)):
    app_doc = await db.vetting_applications.find_one({"user_id": user.user_id}, {"_id": 0})
    if not app_doc or app_doc["stage"] != "test_project" or not app_doc.get("test_project_id"):
        raise HTTPException(status_code=400, detail="No test project assigned yet")
    tp = await db.test_projects.find_one({"id": app_doc["test_project_id"]}, {"_id": 0})
    if not tp:
        raise HTTPException(status_code=404, detail="Test project missing")
    if tp["status"] not in ("assigned",):
        raise HTTPException(status_code=400, detail=f"Test project already {tp['status']}")
    await db.test_projects.update_one(
        {"id": tp["id"]},
        {"$set": {
            "status": "submitted",
            "submitted_at": _now(),
            "submission_note": payload.submission_note,
            "file_ids": payload.file_ids,
        }},
    )
    await _notify_admins("vetting.test_submitted", "Vetting: test project delivered",
                         body=f"{user.name} delivered the test project '{tp['title']}'.",
                         href="/admin", entity_id=app_doc["id"])
    tp = await db.test_projects.find_one({"id": tp["id"]}, {"_id": 0})
    return TestProject(**tp)


async def _notify_admins(
    type: str,
    title: str,
    body: str,
    href: str = "/admin",
    entity_id: Optional[str] = None,
    email_subject: Optional[str] = None,
    email_html: Optional[str] = None,
) -> None:
    async for a in db.users.find({"role": "admin"}, {"_id": 0, "user_id": 1}):
        await _notify(
            a["user_id"], type=type, title=title, body=body, href=href,
            entity_id=entity_id, email_subject=email_subject, email_html=email_html,
        )


# --- Admin endpoints ---
@app.get("/api/admin/vetting/applications")
async def admin_list_vetting(stage: Optional[str] = None, _: User = Depends(require_admin)):
    q: dict = {}
    if stage:
        q["stage"] = stage
    docs = await db.vetting_applications.find(q, {"_id": 0}).sort("updated_at", -1).to_list(length=500)
    out = []
    for d in docs:
        u = await db.users.find_one({"user_id": d["user_id"]}, {"_id": 0, "name": 1, "email": 1, "picture": 1})
        exp = await db.experts.find_one({"user_id": d["user_id"]}, {"_id": 0, "headline": 1, "category": 1, "hourlyRate": 1, "image": 1, "id": 1}) if d.get("expert_id") else None
        tp = None
        if d.get("test_project_id"):
            tp = await db.test_projects.find_one({"id": d["test_project_id"]}, {"_id": 0})
        out.append({"application": d, "user": u, "expert": exp, "test_project": tp})
    return out


@app.post("/api/admin/vetting/{app_id}/advance", response_model=VettingApplication)
async def admin_advance_stage(app_id: str, payload: AdminVettingActionIn, admin: User = Depends(require_admin)):
    app_doc = await db.vetting_applications.find_one({"id": app_id}, {"_id": 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    if app_doc["stage"] in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Application is already finalised")
    new_stage = _next_stage(app_doc["stage"])
    updated = await _set_stage(app_id, new_stage, actor=f"admin:{admin.user_id}", note=payload.note)
    await _sync_expert_verification(updated)
    # Notify expert
    title_map = {
        "skill_quiz": "Stage passed — ready for the skill quiz",
        "screening_call": "Stage passed — screening call up next",
        "test_project": "Stage passed — your test project is being prepared",
        "approved": "Welcome to the WorkSoy roster",
        "rejected": "Vetting decision",
    }
    body_map = {
        "skill_quiz": "Your language & personality screen passed. Continue with the skill questionnaire.",
        "screening_call": "Your skill quiz passed. We'll reach out to schedule a screening call.",
        "test_project": "Screening call passed. A paid test project will be assigned shortly.",
        "approved": "You are now a verified expert. You can submit proposals and appear in the public roster.",
        "rejected": "After review, we couldn't move forward this round. See your dashboard for notes.",
    }
    await _notify(
        app_doc["user_id"],
        type="vetting.advanced",
        title=title_map.get(new_stage, "Vetting status updated"),
        body=body_map.get(new_stage),
        href="/vetting",
        entity_id=app_id,
        email_subject=title_map.get(new_stage, "Vetting status updated"),
        email_html=f"<p>{body_map.get(new_stage, '')}</p>"
                   f"<p><a href=\"{APP_BASE_URL}/vetting\">Open your vetting dashboard</a></p>",
    )
    return VettingApplication(**updated)


@app.post("/api/admin/vetting/{app_id}/reject", response_model=VettingApplication)
async def admin_reject(app_id: str, payload: AdminVettingActionIn, admin: User = Depends(require_admin)):
    app_doc = await db.vetting_applications.find_one({"id": app_id}, {"_id": 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    updated = await _set_stage(app_id, "rejected", actor=f"admin:{admin.user_id}", note=payload.note)
    await _sync_expert_verification(updated)
    await _notify(
        app_doc["user_id"],
        type="vetting.rejected",
        title="Vetting decision",
        body=payload.note or "Application not advanced.",
        href="/vetting",
        entity_id=app_id,
        email_subject="WorkSoy vetting decision",
        email_html=f"<p>{payload.note or 'Application not advanced.'}</p>",
    )
    return VettingApplication(**updated)


@app.post("/api/admin/vetting/{app_id}/screening-call", response_model=VettingApplication)
async def admin_update_screening(app_id: str, payload: ScreeningCallIn, admin: User = Depends(require_admin)):
    app_doc = await db.vetting_applications.find_one({"id": app_id}, {"_id": 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    update = {"updated_at": _now()}
    if payload.scheduled_at:
        update["screening_scheduled_at"] = payload.scheduled_at
    if payload.notes is not None:
        update["screening_notes"] = payload.notes
    if payload.passed is not None:
        update["screening_passed"] = payload.passed
    await db.vetting_applications.update_one({"id": app_id}, {"$set": update})
    doc = await db.vetting_applications.find_one({"id": app_id}, {"_id": 0})
    return VettingApplication(**doc)


@app.post("/api/admin/vetting/{app_id}/assign-test-project", response_model=TestProject)
async def admin_assign_test_project(app_id: str, payload: TestProjectAssignIn, admin: User = Depends(require_admin)):
    app_doc = await db.vetting_applications.find_one({"id": app_id}, {"_id": 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Application not found")
    if app_doc["stage"] not in ("screening_call", "test_project"):
        raise HTTPException(status_code=400, detail=f"Cannot assign test project from stage '{app_doc['stage']}'")
    tid = f"tpr_{uuid.uuid4().hex[:10]}"
    tp = {
        "id": tid,
        "application_id": app_id,
        "user_id": app_doc["user_id"],
        "title": payload.title,
        "description": payload.description,
        "deliverables": payload.deliverables,
        "due_at": payload.due_at,
        "status": "assigned",
        "submitted_at": None,
        "reviewer_notes": None,
        "file_ids": [],
        "submission_note": None,
        "created_at": _now(),
    }
    await db.test_projects.insert_one(tp)
    await db.vetting_applications.update_one(
        {"id": app_id},
        {"$set": {"test_project_id": tid, "stage": "test_project", "updated_at": _now()},
         "$push": {"history": {"stage": "test_project", "at": _now().isoformat(), "by": f"admin:{admin.user_id}"}}},
    )
    await _notify(
        app_doc["user_id"],
        type="vetting.test_assigned",
        title=f"Test project assigned: {payload.title}",
        body="Open your vetting dashboard for the brief and to submit your deliverables.",
        href="/vetting",
        entity_id=tid,
        email_subject=f"WorkSoy — test project assigned: {payload.title}",
        email_html=f"<p>Your paid test project has been assigned.</p>"
                   f"<p><a href=\"{APP_BASE_URL}/vetting\">Open your vetting dashboard</a></p>",
    )
    return TestProject(**tp)


@app.post("/api/admin/vetting/{app_id}/test-project/review")
async def admin_review_test_project(
    app_id: str,
    body: AdminVettingActionIn,
    passed: bool = True,
    admin: User = Depends(require_admin),
):
    app_doc = await db.vetting_applications.find_one({"id": app_id}, {"_id": 0})
    if not app_doc or not app_doc.get("test_project_id"):
        raise HTTPException(status_code=404, detail="No test project")
    tp = await db.test_projects.find_one({"id": app_doc["test_project_id"]}, {"_id": 0})
    if not tp or tp["status"] != "submitted":
        raise HTTPException(status_code=400, detail="Test project not in 'submitted' state")
    new_status = "passed" if passed else "failed"
    await db.test_projects.update_one(
        {"id": tp["id"]},
        {"$set": {"status": new_status, "reviewer_notes": body.note}},
    )
    return {"ok": True, "status": new_status}


# =========================================================================
# Earnings + Invoices (expert)
# =========================================================================
class Invoice(BaseModel):
    id: str
    milestone_id: str
    contract_id: str
    brief_title: str
    client_name: str
    expert_name: str
    amount: float
    currency: str = "USD"
    issued_at: datetime


@app.get("/api/me/earnings")
async def my_earnings(user: User = Depends(get_current_user)):
    contracts = await db.contracts.find(
        {"expert_user_id": user.user_id}, {"_id": 0}
    ).to_list(length=500)
    contract_ids = [c["id"] for c in contracts]
    if not contract_ids:
        return {"lifetime_released": 0.0, "in_escrow": 0.0, "pending": 0.0, "active_contracts": 0, "completed_contracts": 0}
    released = await db.milestones.aggregate([
        {"$match": {"contract_id": {"$in": contract_ids}, "status": "released"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(length=1)
    funded = await db.milestones.aggregate([
        {"$match": {"contract_id": {"$in": contract_ids}, "status": {"$in": ["funded", "submitted"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(length=1)
    pending = await db.milestones.aggregate([
        {"$match": {"contract_id": {"$in": contract_ids}, "status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(length=1)
    return {
        "lifetime_released": float(released[0]["total"]) if released else 0.0,
        "in_escrow": float(funded[0]["total"]) if funded else 0.0,
        "pending": float(pending[0]["total"]) if pending else 0.0,
        "active_contracts": sum(1 for c in contracts if c["status"] == "active"),
        "completed_contracts": sum(1 for c in contracts if c["status"] == "completed"),
    }


@app.get("/api/me/invoices", response_model=List[Invoice])
async def my_invoices(user: User = Depends(get_current_user)):
    """One invoice per RELEASED milestone for the current expert."""
    contracts = await db.contracts.find(
        {"expert_user_id": user.user_id}, {"_id": 0}
    ).to_list(length=500)
    by_id = {c["id"]: c for c in contracts}
    if not by_id:
        return []
    ms = await db.milestones.find(
        {"contract_id": {"$in": list(by_id.keys())}, "status": "released"},
        {"_id": 0},
    ).sort("released_at", -1).to_list(length=500)
    out = []
    for m in ms:
        c = by_id[m["contract_id"]]
        out.append(Invoice(
            id=f"inv_{m['id']}",
            milestone_id=m["id"],
            contract_id=c["id"],
            brief_title=c["brief_title"],
            client_name=c["client_name"],
            expert_name=c["expert_name"],
            amount=float(m["amount"]),
            currency=c.get("currency", "USD"),
            issued_at=m.get("released_at") or _now(),
        ))
    return out


def _render_invoice_pdf(inv: dict) -> bytes:
    """Render a one-page branded invoice/receipt PDF. reportlab is imported
    lazily so the app still boots if the dependency is missing in a given
    environment (the endpoint then returns 503)."""
    try:
        from io import BytesIO
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import LETTER
        from reportlab.lib.units import inch
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        )
    except ImportError as e:  # pragma: no cover - depends on deploy image
        raise RuntimeError(
            "PDF generation is unavailable (reportlab not installed)."
        ) from e

    ink = colors.HexColor("#1A1A1A")
    sun = colors.HexColor("#FFC83D")
    muted = colors.HexColor("#6B6B6B")
    line = colors.HexColor("#E2E0DA")

    currency = (inv.get("currency") or "USD").upper()
    issued = inv.get("issued_at") or ""
    try:
        issued_disp = datetime.fromisoformat(issued).strftime("%B %d, %Y") if issued else ""
    except (ValueError, TypeError):
        issued_disp = str(issued)

    def money(v: float) -> str:
        return f"{currency} {v:,.2f}"

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Title"], textColor=ink, fontSize=24, spaceAfter=2, alignment=0)
    label = ParagraphStyle("label", parent=styles["Normal"], textColor=muted, fontSize=8, leading=11, fontName="Helvetica")
    value = ParagraphStyle("value", parent=styles["Normal"], textColor=ink, fontSize=10.5, leading=14, fontName="Helvetica")
    small = ParagraphStyle("small", parent=styles["Normal"], textColor=muted, fontSize=8, leading=12)

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=LETTER,
        leftMargin=0.85 * inch, rightMargin=0.85 * inch,
        topMargin=0.85 * inch, bottomMargin=0.7 * inch,
        title=f"WorkSoy Invoice {inv['id']}",
    )
    story: list = []

    # Header: wordmark + invoice meta
    header = Table(
        [[
            Paragraph('worksoy<font color="#FFC83D">.</font>', h1),
            Paragraph(
                f'<font color="#6B6B6B" size="8">INVOICE</font><br/>'
                f'<font size="11">{inv["id"]}</font><br/>'
                f'<font color="#6B6B6B" size="8">Issued {issued_disp}</font>',
                ParagraphStyle("right", parent=value, alignment=2),
            ),
        ]],
        colWidths=[3.4 * inch, 3.0 * inch],
    )
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story += [header, Spacer(1, 6)]
    story += [Table([[""]], colWidths=[6.4 * inch], style=TableStyle([
        ("LINEABOVE", (0, 0), (-1, -1), 1.2, sun),
    ])), Spacer(1, 16)]

    # Parties
    parties = Table(
        [[
            Paragraph("FROM", label), Paragraph("BILLED TO", label),
        ], [
            Paragraph(f'{inv["expert_name"]}<br/><font color="#6B6B6B" size="8">Independent contractor · via WorkSoy</font>', value),
            Paragraph(f'{inv["client_name"]}', value),
        ]],
        colWidths=[3.2 * inch, 3.2 * inch],
    )
    parties.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
    ]))
    story += [parties, Spacer(1, 18)]

    # Line items
    rows = [
        [Paragraph("DESCRIPTION", label), Paragraph("AMOUNT", ParagraphStyle("r", parent=label, alignment=2))],
        [
            Paragraph(f'{inv["milestone_title"]}<br/><font color="#6B6B6B" size="8">{inv["brief_title"]} · contract {inv["contract_id"]}</font>', value),
            Paragraph(money(inv["amount"]), ParagraphStyle("rv", parent=value, alignment=2)),
        ],
    ]
    items = Table(rows, colWidths=[4.6 * inch, 1.8 * inch])
    items.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, line),
        ("LINEBELOW", (0, 1), (-1, 1), 0.6, line),
        ("TOPPADDING", (0, 1), (-1, 1), 8),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 8),
    ]))
    story += [items, Spacer(1, 12)]

    # Totals
    totals = Table(
        [
            [Paragraph("Subtotal", value), Paragraph(money(inv["amount"]), ParagraphStyle("r", parent=value, alignment=2))],
            [Paragraph(f'WorkSoy platform fee ({PLATFORM_FEE_RATE * 100:.1f}%)', value),
             Paragraph(f'− {money(inv["platform_fee"])}', ParagraphStyle("r", parent=value, alignment=2))],
            [Paragraph("<b>Net to expert</b>", value),
             Paragraph(f'<b>{money(inv["net_to_expert"])}</b>', ParagraphStyle("r", parent=value, alignment=2))],
        ],
        colWidths=[4.6 * inch, 1.8 * inch],
    )
    totals.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEABOVE", (0, 2), (-1, 2), 1, ink),
        ("TOPPADDING", (0, 2), (-1, 2), 8),
    ]))
    story += [totals, Spacer(1, 28)]

    story += [Paragraph(
        "Paid via WorkSoy escrow on milestone release. This document is a receipt of payment "
        "for the work described above. WorkSoy Networks, Inc. facilitates payment between the "
        "client and the expert and is not a party to the underlying engagement.",
        small,
    )]
    story += [Spacer(1, 8), Paragraph(
        "Questions? billing@worksoy.com", small,
    )]

    doc.build(story)
    return buf.getvalue()


async def _resolve_invoice(invoice_id: str, user: User) -> dict:
    """Shared invoice assembly + access check for the JSON and PDF endpoints."""
    if not invoice_id.startswith("inv_"):
        raise HTTPException(status_code=404, detail="Invoice not found")
    milestone_id = invoice_id[len("inv_"):]
    m = await db.milestones.find_one({"id": milestone_id, "status": "released"}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Invoice not found")
    c = await db.contracts.find_one({"id": m["contract_id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if user.user_id not in (c["client_user_id"], c["expert_user_id"]) and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorised")
    issued = m.get("released_at") or _now()
    amount = float(m["amount"])
    fee = round(amount * PLATFORM_FEE_RATE, 2)
    return {
        "id": invoice_id,
        "milestone_id": m["id"],
        "milestone_title": m["title"],
        "contract_id": c["id"],
        "brief_title": c["brief_title"],
        "client_name": c["client_name"],
        "expert_name": c["expert_name"],
        "amount": amount,
        "currency": c.get("currency", "USD"),
        "issued_at": issued.isoformat() if isinstance(issued, datetime) else issued,
        "platform_fee": fee,
        "net_to_expert": round(amount - fee, 2),
    }


@app.get("/api/invoices/{invoice_id}")
async def get_invoice(invoice_id: str, user: User = Depends(get_current_user)):
    return await _resolve_invoice(invoice_id, user)


@app.get("/api/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(invoice_id: str, user: User = Depends(get_current_user)):
    inv = await _resolve_invoice(invoice_id, user)
    try:
        pdf = _render_invoice_pdf(inv)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    filename = f"worksoy-invoice-{invoice_id}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =========================================================================
# Expert payouts (Stripe Connect)
# =========================================================================
class StripeApiError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"Stripe API error ({status_code}): {message}")


async def _stripe_request(
    method: str,
    path: str,
    data: Optional[dict] = None,
    idempotency_key: Optional[str] = None,
) -> dict:
    headers = {}
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    async with httpx.AsyncClient(timeout=20.0) as cx:
        r = await cx.request(
            method,
            f"{STRIPE_API_BASE}{path}",
            data=data,
            headers=headers,
            auth=(STRIPE_API_KEY, ""),
        )
    try:
        body = r.json()
    except ValueError:
        body = {}
    if r.status_code >= 400:
        msg = (body.get("error") or {}).get("message") or "unknown error"
        raise StripeApiError(r.status_code, msg)
    return body


class Payout(BaseModel):
    id: str
    milestone_id: str
    contract_id: str
    expert_user_id: str
    milestone_title: Optional[str] = None
    brief_title: Optional[str] = None
    gross_amount: float
    platform_fee: float
    net_amount: float
    currency: str = "usd"
    status: str  # queued | paid | failed
    stripe_transfer_id: Optional[str] = None
    error: Optional[str] = None
    attempts: int = 0
    created_at: datetime
    updated_at: datetime
    paid_at: Optional[datetime] = None


async def _attempt_transfer(payout: dict, stripe_account_id: str) -> dict:
    """Try to move a payout's net amount to the expert's connected account.
    Updates the payout document in place and returns the merged result. Never
    raises — a failed transfer leaves the payout in 'failed' for admin retry."""
    attempt = int(payout.get("attempts", 0)) + 1
    try:
        tr = await _stripe_request(
            "POST",
            "/transfers",
            {
                "amount": int(round(payout["net_amount"] * 100)),
                "currency": payout.get("currency", "usd"),
                "destination": stripe_account_id,
                "transfer_group": payout["contract_id"],
                "metadata[payout_id]": payout["id"],
                "metadata[milestone_id]": payout["milestone_id"],
            },
            # Attempt-scoped key: dedupes redeliveries of one attempt while
            # still letting an admin retry after a failure.
            idempotency_key=f"payout-{payout['id']}-{attempt}",
        )
        update = {
            "status": "paid",
            "stripe_transfer_id": tr.get("id"),
            "error": None,
            "attempts": attempt,
            "paid_at": _now(),
            "updated_at": _now(),
        }
        log.info("payout %s paid via transfer %s", payout["id"], tr.get("id"))
        await _notify(
            payout["expert_user_id"],
            type="payout.paid",
            title="Payout sent 💸",
            body=f"${payout['net_amount']:,.2f} for “{payout.get('milestone_title') or 'a milestone'}” is on its way to your bank.",
            href="/dashboard",
            entity_id=payout["id"],
            email_subject="Your WorkSoy payout is on its way",
            email_html=(
                f"<p>We just sent ${payout['net_amount']:,.2f} to your connected payout "
                f"account for &ldquo;{payout.get('milestone_title') or 'a milestone'}&rdquo;.</p>"
                f"<p>Depending on your bank, funds typically arrive within 2 business days.</p>"
                f"<p><a href=\"{APP_BASE_URL}/dashboard\">View your earnings</a></p>"
            ),
        )
    except (StripeApiError, httpx.HTTPError) as e:
        update = {"status": "failed", "error": str(e), "attempts": attempt, "updated_at": _now()}
        log.warning("payout %s transfer failed: %s", payout["id"], e)
        await _notify_admins(
            type="payout.failed",
            title="Expert payout failed",
            body=f"Transfer of ${payout['net_amount']:,.2f} for “{payout.get('milestone_title') or payout['milestone_id']}” failed: {e}",
            href="/admin",
        )
    await db.payouts.update_one({"id": payout["id"]}, {"$set": update})
    return {**payout, **update}


async def _queue_payout_for_milestone(ms: dict, contract: dict) -> Optional[dict]:
    """Create the payout record for a released milestone and pay it out
    immediately when the expert's Stripe account is ready. Idempotent on
    milestone_id so a double release never double-pays."""
    gross = float(ms["amount"])
    fee = round(gross * PLATFORM_FEE_RATE, 2)
    doc = {
        "id": f"po_{uuid.uuid4().hex[:10]}",
        "milestone_id": ms["id"],
        "contract_id": contract["id"],
        "expert_user_id": contract["expert_user_id"],
        "milestone_title": ms.get("title"),
        "brief_title": contract.get("brief_title"),
        "gross_amount": gross,
        "platform_fee": fee,
        "net_amount": round(gross - fee, 2),
        "currency": "usd",
        "status": "queued",
        "stripe_transfer_id": None,
        "error": None,
        "attempts": 0,
        "created_at": _now(),
        "updated_at": _now(),
        "paid_at": None,
    }
    try:
        await db.payouts.insert_one(dict(doc))
    except Exception:  # duplicate milestone_id → payout already queued/paid
        return await db.payouts.find_one({"milestone_id": ms["id"]}, {"_id": 0})
    udoc = await db.users.find_one(
        {"user_id": contract["expert_user_id"]}, {"_id": 0, "stripe_account_id": 1}
    )
    acct_id = (udoc or {}).get("stripe_account_id")
    if acct_id:
        try:
            acct = await _stripe_request("GET", f"/accounts/{acct_id}")
        except (StripeApiError, httpx.HTTPError) as e:
            # Leave it queued; the status-endpoint flush or an admin retry
            # will pick it up once Stripe is reachable again.
            log.warning("payout %s: account lookup failed, staying queued: %s", doc["id"], e)
            return doc
        if acct.get("payouts_enabled"):
            return await _attempt_transfer(doc, acct_id)
    await _notify(
        contract["expert_user_id"],
        type="payout.queued",
        title="Set up payouts to receive your earnings",
        body=f"${doc['net_amount']:,.2f} is waiting for you. Connect a payout account from your dashboard to receive it.",
        href="/dashboard",
        entity_id=doc["id"],
        email_subject="Action needed — set up payouts to receive your earnings",
        email_html=(
            f"<p>A client just released ${doc['net_amount']:,.2f} to you for "
            f"&ldquo;{doc.get('milestone_title') or 'a milestone'}&rdquo;.</p>"
            f"<p>Connect a payout account to receive the funds.</p>"
            f"<p><a href=\"{APP_BASE_URL}/dashboard\">Set up payouts</a></p>"
        ),
    )
    return doc


async def _flush_queued_payouts(expert_user_id: str, stripe_account_id: str, limit: int = 20) -> int:
    """Pay out any queued payouts for an expert whose account just became
    transfer-ready. Returns the number successfully paid."""
    queued = await db.payouts.find(
        {"expert_user_id": expert_user_id, "status": "queued"}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=limit)
    paid = 0
    for p in queued:
        result = await _attempt_transfer(p, stripe_account_id)
        if result.get("status") == "paid":
            paid += 1
    return paid


@app.post("/api/me/payouts/onboard")
async def start_payout_onboarding(user: User = Depends(get_current_user)):
    """Create (or reuse) the expert's Stripe Express account and hand back a
    hosted onboarding link."""
    profile = await db.experts.find_one({"user_id": user.user_id}, {"_id": 0, "id": 1})
    if not profile:
        raise HTTPException(status_code=403, detail="Only experts can set up payouts")
    udoc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "stripe_account_id": 1})
    acct_id = (udoc or {}).get("stripe_account_id")
    try:
        if not acct_id:
            acct = await _stripe_request(
                "POST",
                "/accounts",
                {
                    "type": "express",
                    "email": user.email,
                    "capabilities[transfers][requested]": "true",
                    "metadata[user_id]": user.user_id,
                },
            )
            acct_id = acct["id"]
            await db.users.update_one(
                {"user_id": user.user_id}, {"$set": {"stripe_account_id": acct_id}}
            )
        link = await _stripe_request(
            "POST",
            "/account_links",
            {
                "account": acct_id,
                "refresh_url": f"{APP_BASE_URL}/dashboard?payouts=refresh",
                "return_url": f"{APP_BASE_URL}/dashboard?payouts=return",
                "type": "account_onboarding",
            },
        )
    except StripeApiError as e:
        log.warning("payout onboarding failed for %s: %s", user.user_id, e)
        raise HTTPException(status_code=502, detail="Could not reach Stripe to start onboarding. Try again shortly.")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach Stripe to start onboarding. Try again shortly.")
    return {"url": link["url"]}


@app.get("/api/me/payouts/status")
async def my_payout_status(user: User = Depends(get_current_user)):
    udoc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "stripe_account_id": 1})
    acct_id = (udoc or {}).get("stripe_account_id")
    queued = await db.payouts.aggregate([
        {"$match": {"expert_user_id": user.user_id, "status": "queued"}},
        {"$group": {"_id": None, "total": {"$sum": "$net_amount"}, "count": {"$sum": 1}}},
    ]).to_list(length=1)
    out = {
        "connected": bool(acct_id),
        "payouts_enabled": False,
        "details_submitted": False,
        "queued_count": int(queued[0]["count"]) if queued else 0,
        "queued_net_amount": float(queued[0]["total"]) if queued else 0.0,
    }
    if acct_id:
        try:
            acct = await _stripe_request("GET", f"/accounts/{acct_id}")
            out["payouts_enabled"] = bool(acct.get("payouts_enabled"))
            out["details_submitted"] = bool(acct.get("details_submitted"))
        except (StripeApiError, httpx.HTTPError) as e:
            log.warning("payout status lookup failed for %s: %s", user.user_id, e)
        # Self-healing: the moment the account can receive transfers, drain
        # anything that queued up while the expert was onboarding.
        if out["payouts_enabled"] and out["queued_count"] > 0:
            flushed = await _flush_queued_payouts(user.user_id, acct_id)
            out["queued_count"] -= flushed
    return out


@app.get("/api/me/payouts", response_model=List[Payout])
async def my_payouts(user: User = Depends(get_current_user)):
    docs = await db.payouts.find(
        {"expert_user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=200)
    return [Payout(**d) for d in docs]


@app.get("/api/admin/payouts", response_model=List[Payout])
async def admin_list_payouts(status: Optional[str] = None, user: User = Depends(require_admin)):
    q = {"status": status} if status else {}
    docs = await db.payouts.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return [Payout(**d) for d in docs]


@app.post("/api/admin/payouts/{payout_id}/retry", response_model=Payout)
async def admin_retry_payout(payout_id: str, user: User = Depends(require_admin)):
    p = await db.payouts.find_one({"id": payout_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Payout not found")
    if p["status"] == "paid":
        raise HTTPException(status_code=400, detail="Payout already paid")
    udoc = await db.users.find_one(
        {"user_id": p["expert_user_id"]}, {"_id": 0, "stripe_account_id": 1}
    )
    acct_id = (udoc or {}).get("stripe_account_id")
    if not acct_id:
        raise HTTPException(status_code=400, detail="Expert has not connected a payout account yet")
    result = await _attempt_transfer(p, acct_id)
    return Payout(**result)


# =========================================================================
# Shortlists + Saved searches (client convenience)
# =========================================================================
class ShortlistIn(BaseModel):
    expert_id: str
    note: Optional[str] = Field(default=None, max_length=500)


class ShortlistOut(BaseModel):
    id: str
    user_id: str
    expert_id: str
    note: Optional[str] = None
    created_at: datetime
    expert: Optional[dict] = None


@app.get("/api/me/shortlists", response_model=List[ShortlistOut])
async def list_shortlists(user: User = Depends(get_current_user)):
    docs = await db.shortlists.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    out: List[ShortlistOut] = []
    for d in docs:
        exp = await db.experts.find_one({"id": d["expert_id"]}, {"_id": 0})
        out.append(ShortlistOut(**d, expert=exp))
    return out


@app.post("/api/me/shortlists", response_model=ShortlistOut)
async def add_shortlist(payload: ShortlistIn, user: User = Depends(get_current_user)):
    exp = await db.experts.find_one({"id": payload.expert_id}, {"_id": 0})
    if not exp:
        raise HTTPException(status_code=404, detail="Expert not found")
    dup = await db.shortlists.find_one({"user_id": user.user_id, "expert_id": payload.expert_id}, {"_id": 0, "id": 1})
    if dup:
        raise HTTPException(status_code=400, detail="Already shortlisted")
    sid = f"sl_{uuid.uuid4().hex[:10]}"
    doc = {
        "id": sid,
        "user_id": user.user_id,
        "expert_id": payload.expert_id,
        "note": payload.note,
        "created_at": _now(),
    }
    await db.shortlists.insert_one(doc)
    return ShortlistOut(**doc, expert=exp)


@app.delete("/api/me/shortlists/{expert_id}")
async def remove_shortlist(expert_id: str, user: User = Depends(get_current_user)):
    r = await db.shortlists.delete_one({"user_id": user.user_id, "expert_id": expert_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not in shortlist")
    return {"ok": True}


class SavedSearchIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    query: Optional[str] = Field(default=None, max_length=200)
    category: Optional[str] = Field(default=None, max_length=80)
    sort: Optional[str] = Field(default=None, max_length=40)


class SavedSearch(SavedSearchIn):
    id: str
    user_id: str
    created_at: datetime


@app.get("/api/me/saved-searches", response_model=List[SavedSearch])
async def list_saved_searches(user: User = Depends(get_current_user)):
    docs = await db.saved_searches.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return [SavedSearch(**d) for d in docs]


@app.post("/api/me/saved-searches", response_model=SavedSearch)
async def save_search(payload: SavedSearchIn, user: User = Depends(get_current_user)):
    sid = f"sav_{uuid.uuid4().hex[:10]}"
    doc = {"id": sid, "user_id": user.user_id, "created_at": _now(), **payload.model_dump()}
    await db.saved_searches.insert_one(doc)
    return SavedSearch(**doc)


@app.delete("/api/me/saved-searches/{search_id}")
async def delete_saved_search(search_id: str, user: User = Depends(get_current_user)):
    r = await db.saved_searches.delete_one({"id": search_id, "user_id": user.user_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# =========================================================================
# Public process / transparency stats (no auth — feeds the /process page)
# =========================================================================
# Minimum sample sizes before we promote internal stats to the public page.
# Below these thresholds we return ``null`` and the marketing page falls back
# to its aspirational defaults (e.g. "≈ 3%").
MIN_DECISIONS_FOR_RATE = int(os.environ.get("PROCESS_MIN_DECISIONS", "30"))
MIN_REACHED_FOR_STAGE_RATE = int(os.environ.get("PROCESS_MIN_STAGE_REACHED", "10"))


@app.get("/api/process/stats")
async def process_stats():
    """Anonymised vetting funnel stats for the public transparency page.

    All counts are honest aggregates — but any *rate* that doesn't yet have a
    statistically defensible sample is suppressed (returned as ``null``).
    The frontend renders an aspirational fallback in that case.
    """
    apps = await db.vetting_applications.find(
        {}, {"_id": 0, "stage": 1, "history": 1, "created_at": 1, "updated_at": 1}
    ).to_list(length=10000)

    by_stage: dict[str, int] = {}
    for a in apps:
        by_stage[a["stage"]] = by_stage.get(a["stage"], 0) + 1

    in_progress = sum(
        by_stage.get(s, 0)
        for s in ("language_personality", "skill_quiz", "screening_call", "test_project")
    )
    approved = by_stage.get("approved", 0)
    rejected = by_stage.get("rejected", 0)
    terminal = approved + rejected

    # Overall acceptance rate — only public once we have enough decisions.
    rate_pct = (
        round((approved / terminal) * 100, 1)
        if terminal >= MIN_DECISIONS_FOR_RATE
        else None
    )

    # Per-stage pass rates derived from each application's history. For a given
    # stage S, "reached" = applications whose journey ever touched S; "passed" =
    # applications that subsequently reached *any* later stage (incl. approved).
    # Suppressed below the minimum sample so we don't publish noise.
    ordered_stages = ["language_personality", "skill_quiz", "screening_call", "test_project"]
    stage_pass_rates: dict[str, Optional[float]] = {}
    stage_reached: dict[str, int] = {}
    for i, s in enumerate(ordered_stages):
        later = set(ordered_stages[i + 1 :]) | {"approved"}
        reached = 0
        passed = 0
        for a in apps:
            touched = {h.get("stage") for h in a.get("history", []) if h}
            touched.add(a["stage"])
            if s in touched:
                reached += 1
                if touched & later:
                    passed += 1
        stage_reached[s] = reached
        stage_pass_rates[s] = (
            round((passed / reached) * 100, 1)
            if reached >= MIN_REACHED_FOR_STAGE_RATE
            else None
        )

    roster_size = await db.experts.count_documents(
        {"isPublished": True, "vetting_stage": "approved"}
    )

    # Median days from first stage to approval (last 200 approvals) — same
    # threshold rule as the headline acceptance rate.
    median_days = None
    if approved >= MIN_DECISIONS_FOR_RATE:
        durations: list[float] = []
        for a in apps:
            if a["stage"] != "approved":
                continue
            if a.get("updated_at") and a.get("created_at"):
                durations.append(
                    (a["updated_at"] - a["created_at"]).total_seconds() / 86400
                )
        durations.sort()
        if durations:
            median_days = round(durations[len(durations) // 2], 1)

    return {
        "total_applications": sum(by_stage.values()),
        "in_progress": in_progress,
        "approved": approved,
        "rejected": rejected,
        "acceptance_rate_pct": rate_pct,
        "roster_size": roster_size,
        "median_days_to_decision": median_days,
        "decision_sample_size": terminal,
        "min_sample_size": MIN_DECISIONS_FOR_RATE,
        "stage_pass_rates": stage_pass_rates,
        "stage_reached": stage_reached,
        "min_stage_reached": MIN_REACHED_FOR_STAGE_RATE,
        "by_stage": by_stage,
    }


# =========================================================================
# Managed service — back-office contractor / subscription model.
# Companies on a managed plan never hire directly: admins curate a pool of
# vetted freelancers, take task requests from managed clients, assign pool
# members, review deliverables before release and log off-platform charges.
# =========================================================================
MANAGED_TASK_STATUSES = {
    "requested", "accepted", "assigned", "in_progress", "submitted",
    "revision_requested", "delivered", "completed", "on_hold", "cancelled",
}
# Allowed transitions; on_hold resumes are handled separately because the
# target comes from the task's stored hold_resume_status.
_MANAGED_TRANSITIONS: dict[str, set] = {
    "requested": {"accepted", "cancelled"},
    "accepted": {"assigned", "on_hold", "cancelled"},
    "assigned": {"in_progress", "accepted", "on_hold", "cancelled"},
    "in_progress": {"submitted", "on_hold", "cancelled"},
    "submitted": {"delivered", "revision_requested", "cancelled"},
    "revision_requested": {"submitted", "on_hold", "cancelled"},
    "delivered": {"completed", "revision_requested", "cancelled"},
    "on_hold": {"cancelled"},
    "completed": set(),
    "cancelled": set(),
}
_MANAGED_STATUS_TIMESTAMPS = {
    "accepted": "accepted_at",
    "assigned": "assigned_at",
    "submitted": "submitted_at",
    "delivered": "delivered_at",
    "completed": "completed_at",
    "cancelled": "cancelled_at",
}


def _managed_client_status(status: str) -> str:
    """Collapse back-office statuses into what the client portal shows.
    Clients see queue/progress/delivery — not the internal review machinery
    (submitted, revision_requested etc. all read as work in progress)."""
    if status in ("assigned", "in_progress", "submitted", "revision_requested"):
        return "in_progress"
    if status == "accepted":
        return "queued"
    return status


# --- Input schemas
class ManagedPoolAddIn(BaseModel):
    expert_id: str
    cost_rate: float = Field(gt=0)
    cost_rate_type: Literal["hourly", "per_task"] = "hourly"
    currency: str = "USD"
    internal_notes: Optional[str] = Field(default=None, max_length=2000)


class ManagedPoolUpdateIn(BaseModel):
    cost_rate: Optional[float] = Field(default=None, gt=0)
    cost_rate_type: Optional[Literal["hourly", "per_task"]] = None
    currency: Optional[str] = None
    internal_notes: Optional[str] = Field(default=None, max_length=2000)


class ManagedPoolStatusIn(BaseModel):
    status: Literal["active", "suspended", "removed"]


class PoolApplicationIn(BaseModel):
    skills: str = Field(min_length=2, max_length=500)
    rate_expectation: Optional[str] = Field(default=None, max_length=120)
    note: Optional[str] = Field(default=None, max_length=2000)


class PoolApplicationStatusIn(BaseModel):
    status: Literal["pending", "reviewed", "dismissed"]


class ManagedClientCreateIn(BaseModel):
    owner_email: EmailStr
    company_name: str = Field(min_length=2, max_length=140)
    contact_name: Optional[str] = Field(default=None, max_length=120)
    contact_email: Optional[EmailStr] = None
    plan_type: Literal["monthly_retainer", "per_task"] = "monthly_retainer"
    plan_rate: float = Field(gt=0)
    currency: str = "USD"
    plan_notes: Optional[str] = Field(default=None, max_length=2000)
    internal_notes: Optional[str] = Field(default=None, max_length=2000)


class ManagedClientUpdateIn(BaseModel):
    company_name: Optional[str] = Field(default=None, min_length=2, max_length=140)
    contact_name: Optional[str] = Field(default=None, max_length=120)
    contact_email: Optional[EmailStr] = None
    plan_type: Optional[Literal["monthly_retainer", "per_task"]] = None
    plan_rate: Optional[float] = Field(default=None, gt=0)
    currency: Optional[str] = None
    plan_notes: Optional[str] = Field(default=None, max_length=2000)
    internal_notes: Optional[str] = Field(default=None, max_length=2000)
    status: Optional[Literal["active", "paused", "churned"]] = None


class ManagedChargeIn(BaseModel):
    description: str = Field(min_length=2, max_length=300)
    amount: float = Field(gt=0)
    currency: str = "USD"
    due_date: Optional[datetime] = None
    task_id: Optional[str] = None


class ManagedChargeStatusIn(BaseModel):
    status: Literal["unpaid", "paid"]


class ManagedTaskIn(BaseModel):
    title: str = Field(min_length=3, max_length=140)
    description: str = Field(min_length=10, max_length=8000)
    priority: Literal["low", "normal", "high"] = "normal"
    due_date: Optional[datetime] = None


class ManagedAssignIn(BaseModel):
    pool_member_id: str


class ManagedHoldIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=2000)


class ManagedDeliverableIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=4000)
    file_ids: List[str] = Field(min_length=1)


class ManagedDeliverableReviewIn(BaseModel):
    action: Literal["approve", "reject"]
    note: Optional[str] = Field(default=None, max_length=2000)


class ManagedCommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    visibility: Literal["client", "internal"] = "client"


class ManagedRevisionIn(BaseModel):
    note: str = Field(min_length=3, max_length=2000)


class ManagedRateIn(BaseModel):
    score: int = Field(ge=1, le=5)
    notes: Optional[str] = Field(default=None, max_length=2000)


# --- Helpers
async def _get_managed_client_for(user: User) -> Optional[dict]:
    return await db.managed_clients.find_one(
        {"owner_user_id": user.user_id, "status": {"$in": ["active", "paused"]}}, {"_id": 0}
    )


async def _get_pool_membership(user: User) -> Optional[dict]:
    return await db.pool_members.find_one(
        {"user_id": user.user_id, "status": "active"}, {"_id": 0}
    )


async def _managed_task_or_404(task_id: str) -> dict:
    t = await db.managed_tasks.find_one({"id": task_id}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Task not found")
    return t


async def _file_summaries(file_ids: List[str]) -> List[dict]:
    out = []
    for fid in file_ids:
        f = await db.files.find_one(
            {"id": fid}, {"_id": 0, "id": 1, "filename": 1, "size": 1, "content_type": 1}
        )
        if f:
            out.append(f)
    return out


async def _managed_event(
    task_id: str,
    author: User,
    kind: str,
    visibility: str,
    body: Optional[str] = None,
    meta: Optional[dict] = None,
) -> dict:
    doc = {
        "id": f"mte_{uuid.uuid4().hex[:10]}",
        "task_id": task_id,
        "author_id": author.user_id,
        "author_name": author.name,
        "kind": kind,  # comment | status_change | assignment | deliverable
        "visibility": visibility,  # client (all parties) | internal (admin + freelancer)
        "body": body,
        "meta": meta,
        "created_at": _now(),
    }
    await db.managed_task_events.insert_one(doc)
    doc.pop("_id", None)
    return doc


async def _managed_set_status(
    task: dict,
    to_status: str,
    actor: User,
    *,
    event_visibility: str = "client",
    event_body: Optional[str] = None,
    extra_set: Optional[dict] = None,
    force: bool = False,
) -> dict:
    frm = task["status"]
    if not force and to_status not in _MANAGED_TRANSITIONS.get(frm, set()):
        raise HTTPException(status_code=400, detail=f"Cannot move task from '{frm}' to '{to_status}'")
    update: dict = {"status": to_status, "updated_at": _now()}
    ts_field = _MANAGED_STATUS_TIMESTAMPS.get(to_status)
    if ts_field:
        update[ts_field] = _now()
    if extra_set:
        update.update(extra_set)
    await db.managed_tasks.update_one(
        {"id": task["id"]},
        {
            "$set": update,
            "$push": {"history": {"from": frm, "to": to_status, "at": _now().isoformat(), "by": actor.user_id}},
        },
    )
    await _managed_event(
        task["id"], actor, "status_change", event_visibility,
        body=event_body, meta={"from_status": frm, "to_status": to_status},
    )
    return await db.managed_tasks.find_one({"id": task["id"]}, {"_id": 0})


async def _recalc_pool_performance(pool_member_id: str) -> None:
    pipeline = [
        {"$match": {"pool_member_id": pool_member_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$score"}, "count": {"$sum": 1}}},
    ]
    res = await db.pool_ratings.aggregate(pipeline).to_list(length=1)
    if not res:
        return
    await db.pool_members.update_one(
        {"id": pool_member_id},
        {"$set": {"performance_score": round(float(res[0]["avg"]), 2), "performance_count": int(res[0]["count"])}},
    )


async def _managed_request_attachments(task: dict) -> List[dict]:
    """Brief files the client attached to the request (deliverable files are
    stamped with managed_deliverable_id at submit time and excluded here)."""
    docs = await db.files.find(
        {
            "managed_task_id": task["id"],
            "managed_deliverable_id": None,
            "owner_user_id": task["client_user_id"],
        },
        {"_id": 0, "id": 1, "filename": 1, "size": 1, "content_type": 1},
    ).sort("created_at", 1).to_list(length=100)
    return docs


def _client_event_shape(e: dict) -> dict:
    meta = e.get("meta") or None
    if meta and e.get("kind") == "status_change":
        meta = {
            "from_status": _managed_client_status(meta.get("from_status", "")),
            "to_status": _managed_client_status(meta.get("to_status", "")),
        }
    return {
        "id": e["id"],
        "author_name": e["author_name"],
        "kind": e["kind"],
        "body": e.get("body"),
        "meta": meta,
        "created_at": e["created_at"],
    }


async def _client_task_shape(task: dict, *, detail: bool = False) -> dict:
    assignee_name = None
    if task.get("assignee_user_id"):
        u = await db.users.find_one({"user_id": task["assignee_user_id"]}, {"_id": 0, "name": 1})
        assignee_name = u["name"] if u else None
    out = {
        "id": task["id"],
        "title": task["title"],
        "description": task["description"],
        "priority": task.get("priority", "normal"),
        "due_date": task.get("due_date"),
        "status": _managed_client_status(task["status"]),
        "assignee_name": assignee_name,
        "created_at": task["created_at"],
        "delivered_at": task.get("delivered_at"),
        "completed_at": task.get("completed_at"),
    }
    if detail:
        out["attachments"] = await _managed_request_attachments(task)
        delivs = await db.managed_deliverables.find(
            {"task_id": task["id"], "status": "approved"}, {"_id": 0}
        ).sort("version", 1).to_list(length=50)
        out["deliverables"] = [
            {
                "id": d["id"],
                "note": d.get("note"),
                "version": d["version"],
                "files": await _file_summaries(d.get("file_ids", [])),
                "created_at": d["created_at"],
            }
            for d in delivs
        ]
        events = await db.managed_task_events.find(
            {"task_id": task["id"], "visibility": "client"}, {"_id": 0}
        ).sort("created_at", 1).to_list(length=500)
        out["events"] = [_client_event_shape(e) for e in events]
    return out


# --- Admin: freelancer pool
@app.get("/api/admin/managed/pool")
async def admin_list_pool(status: Optional[str] = None, _: User = Depends(require_admin)):
    q: dict = {"status": status} if status else {"status": {"$ne": "removed"}}
    docs = await db.pool_members.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    out = []
    for d in docs:
        u = await db.users.find_one({"user_id": d["user_id"]}, {"_id": 0, "name": 1, "email": 1, "picture": 1})
        exp = None
        if d.get("expert_id"):
            exp = await db.experts.find_one(
                {"id": d["expert_id"]},
                {"_id": 0, "id": 1, "headline": 1, "category": 1, "image": 1, "rating": 1, "reviewCount": 1},
            )
        open_tasks = await db.managed_tasks.count_documents(
            {"assignee_pool_member_id": d["id"], "status": {"$nin": ["completed", "cancelled"]}}
        )
        out.append({"member": d, "user": u, "expert": exp, "open_tasks": open_tasks})
    return out


@app.get("/api/admin/managed/pool/eligible")
async def admin_list_pool_eligible(_: User = Depends(require_admin)):
    existing = await db.pool_members.find(
        {"status": {"$in": ["active", "suspended"]}}, {"_id": 0, "user_id": 1}
    ).to_list(length=1000)
    exclude = [m["user_id"] for m in existing]
    docs = await db.experts.find(
        {"verified": True, "user_id": {"$exists": True, "$nin": exclude + [None]}},
        {"_id": 0, "id": 1, "user_id": 1, "name": 1, "headline": 1, "category": 1,
         "hourlyRate": 1, "image": 1, "rating": 1, "reviewCount": 1},
    ).sort("rating", -1).to_list(length=500)
    return docs


@app.get("/api/admin/managed/pool/applications")
async def admin_list_pool_applications(status: Optional[str] = None, _: User = Depends(require_admin)):
    q: dict = {"status": status} if status else {}
    return await db.pool_applications.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=500)


@app.post("/api/admin/managed/pool/applications/{app_id}/status")
async def admin_set_pool_application_status(
    app_id: str, payload: PoolApplicationStatusIn, _: User = Depends(require_admin)
):
    r = await db.pool_applications.update_one(
        {"id": app_id}, {"$set": {"status": payload.status, "updated_at": _now()}}
    )
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")
    return await db.pool_applications.find_one({"id": app_id}, {"_id": 0})


@app.post("/api/admin/managed/pool")
async def admin_add_pool_member(payload: ManagedPoolAddIn, admin: User = Depends(require_admin)):
    exp = await db.experts.find_one({"id": payload.expert_id}, {"_id": 0})
    if not exp:
        raise HTTPException(status_code=404, detail="Expert not found")
    if not exp.get("user_id"):
        raise HTTPException(status_code=400, detail="Expert has no login account and cannot work managed tasks")
    if not exp.get("verified"):
        raise HTTPException(status_code=400, detail="Only vetted (verified) experts can join the managed pool")
    dup = await db.pool_members.find_one(
        {"user_id": exp["user_id"], "status": {"$in": ["active", "suspended"]}}, {"_id": 0, "id": 1}
    )
    if dup:
        raise HTTPException(status_code=400, detail="This expert is already in the pool")
    doc = {
        "id": f"pm_{uuid.uuid4().hex[:10]}",
        "user_id": exp["user_id"],
        "expert_id": exp["id"],
        "status": "active",
        "cost_rate": payload.cost_rate,
        "cost_rate_type": payload.cost_rate_type,
        "currency": payload.currency,
        "internal_notes": payload.internal_notes,
        "added_by": admin.user_id,
        "performance_score": 0.0,
        "performance_count": 0,
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.pool_members.insert_one(doc)
    doc.pop("_id", None)
    await _notify(
        exp["user_id"],
        type="managed.pool_added",
        title="You joined the WorkSoy managed pool",
        body="An account manager can now assign you managed client tasks.",
        href="/pool/tasks",
        entity_id=doc["id"],
    )
    return doc


@app.patch("/api/admin/managed/pool/{member_id}")
async def admin_update_pool_member(member_id: str, payload: ManagedPoolUpdateIn, _: User = Depends(require_admin)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    update["updated_at"] = _now()
    r = await db.pool_members.update_one({"id": member_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pool member not found")
    return await db.pool_members.find_one({"id": member_id}, {"_id": 0})


@app.post("/api/admin/managed/pool/{member_id}/status")
async def admin_set_pool_member_status(member_id: str, payload: ManagedPoolStatusIn, _: User = Depends(require_admin)):
    m = await db.pool_members.find_one({"id": member_id}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Pool member not found")
    await db.pool_members.update_one(
        {"id": member_id}, {"$set": {"status": payload.status, "updated_at": _now()}}
    )
    # In-flight tasks stay assigned on suspend/remove so delivery isn't dropped
    # silently; surface the count so the admin can reassign deliberately.
    in_flight = await db.managed_tasks.count_documents(
        {"assignee_pool_member_id": member_id, "status": {"$nin": ["completed", "cancelled"]}}
    )
    return {"ok": True, "in_flight_tasks": in_flight}


@app.get("/api/admin/managed/pool/{member_id}")
async def admin_get_pool_member(member_id: str, _: User = Depends(require_admin)):
    m = await db.pool_members.find_one({"id": member_id}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Pool member not found")
    u = await db.users.find_one({"user_id": m["user_id"]}, {"_id": 0, "name": 1, "email": 1, "picture": 1})
    exp = None
    if m.get("expert_id"):
        exp = await db.experts.find_one(
            {"id": m["expert_id"]},
            {"_id": 0, "id": 1, "headline": 1, "category": 1, "image": 1, "rating": 1, "reviewCount": 1},
        )
    ratings = await db.pool_ratings.find(
        {"pool_member_id": member_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=200)
    for r in ratings:
        t = await db.managed_tasks.find_one({"id": r["task_id"]}, {"_id": 0, "title": 1})
        r["task_title"] = t["title"] if t else None
    tasks = await db.managed_tasks.find(
        {"assignee_pool_member_id": member_id},
        {"_id": 0, "id": 1, "title": 1, "status": 1, "client_id": 1, "created_at": 1, "completed_at": 1},
    ).sort("created_at", -1).to_list(length=200)
    return {"member": m, "user": u, "expert": exp, "ratings": ratings, "tasks": tasks}


# --- Admin: managed clients & billing
@app.get("/api/admin/managed/clients")
async def admin_list_managed_clients(_: User = Depends(require_admin)):
    docs = await db.managed_clients.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    charge_agg = await db.managed_charges.aggregate([
        {"$group": {
            "_id": {"client_id": "$client_id", "status": "$status"},
            "total": {"$sum": "$amount"},
        }},
    ]).to_list(length=2000)
    billing: dict[str, dict] = {}
    for row in charge_agg:
        cid = row["_id"]["client_id"]
        b = billing.setdefault(cid, {"billed": 0.0, "paid": 0.0, "unpaid": 0.0})
        b["billed"] += row["total"]
        b[row["_id"]["status"]] = b.get(row["_id"]["status"], 0.0) + row["total"]
    task_agg = await db.managed_tasks.aggregate([
        {"$match": {"status": {"$nin": ["completed", "cancelled"]}}},
        {"$group": {"_id": "$client_id", "count": {"$sum": 1}}},
    ]).to_list(length=2000)
    open_tasks = {row["_id"]: row["count"] for row in task_agg}
    out = []
    for d in docs:
        u = await db.users.find_one({"user_id": d["owner_user_id"]}, {"_id": 0, "name": 1, "email": 1})
        out.append({
            "client": d,
            "owner": u,
            "billing": billing.get(d["id"], {"billed": 0.0, "paid": 0.0, "unpaid": 0.0}),
            "open_tasks": open_tasks.get(d["id"], 0),
        })
    return out


@app.post("/api/admin/managed/clients")
async def admin_create_managed_client(payload: ManagedClientCreateIn, admin: User = Depends(require_admin)):
    owner = await db.users.find_one({"email": payload.owner_email.lower()}, {"_id": 0, "user_id": 1, "name": 1})
    if not owner:
        raise HTTPException(
            status_code=404,
            detail="No WorkSoy account with that email. Ask the client to sign up first.",
        )
    dup = await db.managed_clients.find_one(
        {"owner_user_id": owner["user_id"], "status": {"$in": ["active", "paused"]}}, {"_id": 0, "id": 1}
    )
    if dup:
        raise HTTPException(status_code=400, detail="This user already owns a managed client account")
    doc = {
        "id": f"mc_{uuid.uuid4().hex[:10]}",
        "owner_user_id": owner["user_id"],
        "company_name": payload.company_name,
        "contact_name": payload.contact_name,
        "contact_email": payload.contact_email,
        "plan_type": payload.plan_type,
        "plan_rate": payload.plan_rate,
        "currency": payload.currency,
        "plan_notes": payload.plan_notes,
        "status": "active",
        "internal_notes": payload.internal_notes,
        "created_by": admin.user_id,
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.managed_clients.insert_one(doc)
    doc.pop("_id", None)
    await _notify(
        owner["user_id"],
        type="managed.client_created",
        title="Your managed service is live",
        body=f"{payload.company_name} is set up on the WorkSoy managed plan. Submit your first task.",
        href="/portal",
        entity_id=doc["id"],
    )
    return doc


@app.patch("/api/admin/managed/clients/{client_id}")
async def admin_update_managed_client(client_id: str, payload: ManagedClientUpdateIn, _: User = Depends(require_admin)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    update["updated_at"] = _now()
    r = await db.managed_clients.update_one({"id": client_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Managed client not found")
    return await db.managed_clients.find_one({"id": client_id}, {"_id": 0})


@app.get("/api/admin/managed/clients/{client_id}/charges")
async def admin_list_charges(client_id: str, _: User = Depends(require_admin)):
    docs = await db.managed_charges.find(
        {"client_id": client_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=500)
    return docs


@app.post("/api/admin/managed/clients/{client_id}/charges")
async def admin_add_charge(client_id: str, payload: ManagedChargeIn, admin: User = Depends(require_admin)):
    c = await db.managed_clients.find_one({"id": client_id}, {"_id": 0, "id": 1})
    if not c:
        raise HTTPException(status_code=404, detail="Managed client not found")
    doc = {
        "id": f"mch_{uuid.uuid4().hex[:10]}",
        "client_id": client_id,
        "description": payload.description,
        "amount": payload.amount,
        "currency": payload.currency,
        "due_date": payload.due_date,
        "status": "unpaid",
        "paid_at": None,
        "task_id": payload.task_id,
        "created_by": admin.user_id,
        "created_at": _now(),
    }
    await db.managed_charges.insert_one(doc)
    doc.pop("_id", None)
    return doc


@app.patch("/api/admin/managed/charges/{charge_id}")
async def admin_update_charge_status(charge_id: str, payload: ManagedChargeStatusIn, _: User = Depends(require_admin)):
    update = {"status": payload.status, "paid_at": _now() if payload.status == "paid" else None}
    r = await db.managed_charges.update_one({"id": charge_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Charge not found")
    return await db.managed_charges.find_one({"id": charge_id}, {"_id": 0})


@app.delete("/api/admin/managed/charges/{charge_id}")
async def admin_delete_charge(charge_id: str, _: User = Depends(require_admin)):
    r = await db.managed_charges.delete_one({"id": charge_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Charge not found")
    return {"ok": True}


# --- Admin: task board & delivery flow
@app.get("/api/admin/managed/tasks")
async def admin_list_managed_tasks(
    status: Optional[str] = None,
    client_id: Optional[str] = None,
    assignee: Optional[str] = None,
    _: User = Depends(require_admin),
):
    q: dict = {}
    if status:
        q["status"] = status
    if client_id:
        q["client_id"] = client_id
    if assignee:
        q["assignee_pool_member_id"] = assignee
    docs = await db.managed_tasks.find(q, {"_id": 0}).sort("created_at", -1).to_list(length=500)
    client_ids = {d["client_id"] for d in docs}
    clients = {
        c["id"]: c
        async for c in db.managed_clients.find(
            {"id": {"$in": list(client_ids)}}, {"_id": 0, "id": 1, "company_name": 1}
        )
    }
    assignee_ids = {d["assignee_user_id"] for d in docs if d.get("assignee_user_id")}
    users = {
        u["user_id"]: u
        async for u in db.users.find(
            {"user_id": {"$in": list(assignee_ids)}}, {"_id": 0, "user_id": 1, "name": 1}
        )
    }
    out = []
    for d in docs:
        d.pop("history", None)
        client = clients.get(d["client_id"])
        assignee_user = users.get(d.get("assignee_user_id") or "")
        out.append({
            "task": d,
            "company_name": client["company_name"] if client else None,
            "assignee_name": assignee_user["name"] if assignee_user else None,
        })
    return out


async def _admin_task_detail(task: dict) -> dict:
    client = await db.managed_clients.find_one({"id": task["client_id"]}, {"_id": 0})
    assignee = None
    if task.get("assignee_pool_member_id"):
        m = await db.pool_members.find_one({"id": task["assignee_pool_member_id"]}, {"_id": 0})
        if m:
            u = await db.users.find_one({"user_id": m["user_id"]}, {"_id": 0, "name": 1, "email": 1, "picture": 1})
            assignee = {"member": m, "user": u}
    delivs = await db.managed_deliverables.find(
        {"task_id": task["id"]}, {"_id": 0}
    ).sort("version", 1).to_list(length=50)
    for d in delivs:
        d["files"] = await _file_summaries(d.get("file_ids", []))
    events = await db.managed_task_events.find(
        {"task_id": task["id"]}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=500)
    rating = await db.pool_ratings.find_one({"task_id": task["id"]}, {"_id": 0})
    return {
        "task": task,
        "client": client,
        "assignee": assignee,
        "attachments": await _managed_request_attachments(task),
        "deliverables": delivs,
        "events": events,
        "rating": rating,
    }


@app.get("/api/admin/managed/tasks/{task_id}")
async def admin_get_managed_task(task_id: str, _: User = Depends(require_admin)):
    task = await _managed_task_or_404(task_id)
    return await _admin_task_detail(task)


@app.post("/api/admin/managed/tasks/{task_id}/accept")
async def admin_accept_task(task_id: str, admin: User = Depends(require_admin)):
    task = await _managed_task_or_404(task_id)
    updated = await _managed_set_status(task, "accepted", admin, event_body="Task accepted into the delivery queue.")
    await _notify(
        task["client_user_id"],
        type="managed.task_accepted",
        title="Task accepted",
        body=f"“{task['title']}” was accepted and queued for delivery.",
        href=f"/portal/tasks/{task_id}",
        entity_id=task_id,
    )
    return updated


@app.post("/api/admin/managed/tasks/{task_id}/assign")
async def admin_assign_task(task_id: str, payload: ManagedAssignIn, admin: User = Depends(require_admin)):
    task = await _managed_task_or_404(task_id)
    member = await db.pool_members.find_one({"id": payload.pool_member_id}, {"_id": 0})
    if not member or member["status"] != "active":
        raise HTTPException(status_code=400, detail="Pool member not found or not active")
    u = await db.users.find_one({"user_id": member["user_id"]}, {"_id": 0, "name": 1})
    updated = await _managed_set_status(
        task, "assigned", admin,
        extra_set={"assignee_pool_member_id": member["id"], "assignee_user_id": member["user_id"]},
    )
    await _managed_event(
        task_id, admin, "assignment", "client",
        body=f"{u['name'] if u else 'A specialist'} was assigned to this task.",
    )
    await _notify(
        member["user_id"],
        type="managed.task_assigned",
        title="New managed task assigned",
        body=f"You were assigned “{task['title']}”.",
        href=f"/pool/tasks/{task_id}",
        entity_id=task_id,
    )
    return updated


@app.post("/api/admin/managed/tasks/{task_id}/unassign")
async def admin_unassign_task(task_id: str, admin: User = Depends(require_admin)):
    task = await _managed_task_or_404(task_id)
    if task["status"] != "assigned":
        raise HTTPException(status_code=400, detail="Only tasks awaiting a start can be unassigned")
    prev_assignee = task.get("assignee_user_id")
    updated = await _managed_set_status(
        task, "accepted", admin,
        event_visibility="internal",
        extra_set={"assignee_pool_member_id": None, "assignee_user_id": None},
    )
    if prev_assignee:
        await _notify(
            prev_assignee,
            type="managed.task_unassigned",
            title="Task unassigned",
            body=f"You were unassigned from “{task['title']}”.",
            href="/pool/tasks",
            entity_id=task_id,
        )
    return updated


@app.post("/api/admin/managed/tasks/{task_id}/hold")
async def admin_hold_task(task_id: str, payload: ManagedHoldIn, admin: User = Depends(require_admin)):
    task = await _managed_task_or_404(task_id)
    return await _managed_set_status(
        task, "on_hold", admin,
        event_body=payload.note or "Task placed on hold.",
        extra_set={"hold_resume_status": task["status"]},
    )


@app.post("/api/admin/managed/tasks/{task_id}/resume")
async def admin_resume_task(task_id: str, admin: User = Depends(require_admin)):
    task = await _managed_task_or_404(task_id)
    if task["status"] != "on_hold":
        raise HTTPException(status_code=400, detail="Task is not on hold")
    target = task.get("hold_resume_status") or "accepted"
    return await _managed_set_status(
        task, target, admin,
        event_body="Task resumed.",
        extra_set={"hold_resume_status": None},
        force=True,
    )


@app.post("/api/admin/managed/tasks/{task_id}/cancel")
async def admin_cancel_task(task_id: str, admin: User = Depends(require_admin)):
    task = await _managed_task_or_404(task_id)
    updated = await _managed_set_status(task, "cancelled", admin, event_body="Task cancelled.")
    await _notify(
        task["client_user_id"],
        type="managed.task_cancelled",
        title="Task cancelled",
        body=f"“{task['title']}” was cancelled. Your account manager will follow up.",
        href=f"/portal/tasks/{task_id}",
        entity_id=task_id,
    )
    if task.get("assignee_user_id"):
        await _notify(
            task["assignee_user_id"],
            type="managed.task_cancelled",
            title="Task cancelled",
            body=f"“{task['title']}” was cancelled.",
            href="/pool/tasks",
            entity_id=task_id,
        )
    return updated


@app.post("/api/admin/managed/tasks/{task_id}/complete")
async def admin_complete_task(task_id: str, admin: User = Depends(require_admin)):
    task = await _managed_task_or_404(task_id)
    updated = await _managed_set_status(task, "completed", admin, event_body="Task completed.")
    if task.get("assignee_user_id"):
        await _notify(
            task["assignee_user_id"],
            type="managed.task_completed",
            title="Task completed",
            body=f"“{task['title']}” was marked completed. Nice work.",
            href=f"/pool/tasks/{task_id}",
            entity_id=task_id,
        )
    return updated


@app.post("/api/admin/managed/deliverables/{deliverable_id}/review")
async def admin_review_deliverable(deliverable_id: str, payload: ManagedDeliverableReviewIn, admin: User = Depends(require_admin)):
    d = await db.managed_deliverables.find_one({"id": deliverable_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    if d["status"] != "pending_review":
        raise HTTPException(status_code=400, detail="Deliverable already reviewed")
    task = await _managed_task_or_404(d["task_id"])
    if task["status"] != "submitted":
        raise HTTPException(status_code=400, detail="Task is not awaiting review")
    if payload.action == "reject" and not (payload.note or "").strip():
        raise HTTPException(status_code=400, detail="A note is required when requesting changes")
    new_status = "approved" if payload.action == "approve" else "rejected"
    await db.managed_deliverables.update_one(
        {"id": deliverable_id},
        {"$set": {
            "status": new_status,
            "reviewed_by": admin.user_id,
            "reviewed_at": _now(),
            "review_note": payload.note,
        }},
    )
    if payload.action == "approve":
        await _managed_event(
            task["id"], admin, "deliverable", "client",
            body=payload.note or "A deliverable is ready for you.",
            meta={"deliverable_id": deliverable_id},
        )
        await _managed_set_status(task, "delivered", admin, event_visibility="internal")
        await _notify(
            task["client_user_id"],
            type="managed.deliverable_ready",
            title="Deliverable ready",
            body=f"A deliverable for “{task['title']}” is ready to review.",
            href=f"/portal/tasks/{task['id']}",
            entity_id=task["id"],
        )
        if task.get("assignee_user_id"):
            await _notify(
                task["assignee_user_id"],
                type="managed.deliverable_approved",
                title="Deliverable approved",
                body=f"Your deliverable on “{task['title']}” was approved and released to the client.",
                href=f"/pool/tasks/{task['id']}",
                entity_id=task["id"],
            )
    else:
        await _managed_set_status(
            task, "revision_requested", admin,
            event_visibility="internal", event_body=payload.note,
        )
        if task.get("assignee_user_id"):
            await _notify(
                task["assignee_user_id"],
                type="managed.revision_requested",
                title="Changes requested",
                body=f"Please revise your deliverable on “{task['title']}”.",
                href=f"/pool/tasks/{task['id']}",
                entity_id=task["id"],
            )
    return await db.managed_deliverables.find_one({"id": deliverable_id}, {"_id": 0})


@app.post("/api/admin/managed/tasks/{task_id}/rate")
async def admin_rate_task(task_id: str, payload: ManagedRateIn, admin: User = Depends(require_admin)):
    task = await _managed_task_or_404(task_id)
    if task["status"] != "completed":
        raise HTTPException(status_code=400, detail="Only completed tasks can be rated")
    if not task.get("assignee_pool_member_id"):
        raise HTTPException(status_code=400, detail="Task has no assigned pool member")
    dup = await db.pool_ratings.find_one({"task_id": task_id}, {"_id": 0, "id": 1})
    if dup:
        raise HTTPException(status_code=400, detail="This task was already rated")
    doc = {
        "id": f"prt_{uuid.uuid4().hex[:10]}",
        "pool_member_id": task["assignee_pool_member_id"],
        "task_id": task_id,
        "rated_by": admin.user_id,
        "score": payload.score,
        "notes": payload.notes,
        "created_at": _now(),
    }
    await db.pool_ratings.insert_one(doc)
    doc.pop("_id", None)
    await _recalc_pool_performance(task["assignee_pool_member_id"])
    return doc


@app.get("/api/admin/managed/stats")
async def admin_managed_stats(_: User = Depends(require_admin)):
    unpaid_agg = await db.managed_charges.aggregate([
        {"$match": {"status": "unpaid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(length=1)
    paid_agg = await db.managed_charges.aggregate([
        {"$match": {"status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(length=1)
    return {
        "pool_active": await db.pool_members.count_documents({"status": "active"}),
        "clients_active": await db.managed_clients.count_documents({"status": "active"}),
        "tasks_requested": await db.managed_tasks.count_documents({"status": "requested"}),
        "tasks_submitted": await db.managed_tasks.count_documents({"status": "submitted"}),
        "tasks_in_flight": await db.managed_tasks.count_documents(
            {"status": {"$nin": ["completed", "cancelled", "requested"]}}
        ),
        "revenue_unpaid": unpaid_agg[0]["total"] if unpaid_agg else 0.0,
        "revenue_paid": paid_agg[0]["total"] if paid_agg else 0.0,
    }


# --- Client portal
@app.get("/api/managed/me")
async def managed_me(request: Request):
    """Returns the caller's managed-client account, or null when they are not
    a managed client (200 + null keeps public nav checks quiet, like /auth/me)."""
    user = await _resolve_user_optional(request)
    if not user:
        return None
    c = await _get_managed_client_for(user)
    if not c:
        return None
    c.pop("internal_notes", None)
    c.pop("created_by", None)
    return c


@app.post("/api/managed/tasks")
async def create_managed_task(payload: ManagedTaskIn, user: User = Depends(get_current_user)):
    client = await _get_managed_client_for(user)
    if not client:
        raise HTTPException(status_code=403, detail="Not a managed client")
    if client["status"] != "active":
        raise HTTPException(status_code=400, detail="Your managed plan is paused. Contact your account manager.")
    now = _now()
    doc = {
        "id": f"mt_{uuid.uuid4().hex[:10]}",
        "client_id": client["id"],
        "client_user_id": user.user_id,
        "title": payload.title,
        "description": payload.description,
        "priority": payload.priority,
        "due_date": payload.due_date,
        "status": "requested",
        "assignee_pool_member_id": None,
        "assignee_user_id": None,
        "hold_resume_status": None,
        "admin_notes": None,
        "history": [{"from": None, "to": "requested", "at": now.isoformat(), "by": user.user_id}],
        "created_at": now,
        "updated_at": now,
    }
    await db.managed_tasks.insert_one(doc)
    doc.pop("_id", None)
    await _notify_admins(
        "managed.task_requested",
        "Managed task requested",
        body=f"{client['company_name']} requested “{payload.title}”.",
        href="/admin",
        entity_id=doc["id"],
    )
    return await _client_task_shape(doc)


@app.get("/api/managed/tasks")
async def list_my_managed_tasks(user: User = Depends(get_current_user)):
    client = await _get_managed_client_for(user)
    if not client:
        raise HTTPException(status_code=403, detail="Not a managed client")
    docs = await db.managed_tasks.find(
        {"client_id": client["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=500)
    return [await _client_task_shape(d) for d in docs]


@app.get("/api/managed/tasks/{task_id}")
async def get_my_managed_task(task_id: str, user: User = Depends(get_current_user)):
    client = await _get_managed_client_for(user)
    if not client:
        raise HTTPException(status_code=403, detail="Not a managed client")
    task = await _managed_task_or_404(task_id)
    if task["client_id"] != client["id"]:
        raise HTTPException(status_code=403, detail="Not your task")
    return await _client_task_shape(task, detail=True)


@app.post("/api/managed/tasks/{task_id}/cancel")
async def cancel_my_managed_task(task_id: str, user: User = Depends(get_current_user)):
    client = await _get_managed_client_for(user)
    if not client:
        raise HTTPException(status_code=403, detail="Not a managed client")
    task = await _managed_task_or_404(task_id)
    if task["client_id"] != client["id"]:
        raise HTTPException(status_code=403, detail="Not your task")
    if task["status"] != "requested":
        raise HTTPException(status_code=400, detail="Only requests that haven't been accepted can be cancelled. Contact your account manager.")
    updated = await _managed_set_status(task, "cancelled", user, event_body="Request withdrawn by client.")
    return await _client_task_shape(updated)


@app.post("/api/managed/tasks/{task_id}/request-revision")
async def request_managed_revision(task_id: str, payload: ManagedRevisionIn, user: User = Depends(get_current_user)):
    client = await _get_managed_client_for(user)
    if not client:
        raise HTTPException(status_code=403, detail="Not a managed client")
    task = await _managed_task_or_404(task_id)
    if task["client_id"] != client["id"]:
        raise HTTPException(status_code=403, detail="Not your task")
    if task["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Revisions can only be requested on delivered work")
    updated = await _managed_set_status(task, "revision_requested", user, event_body=payload.note)
    await _notify_admins(
        "managed.client_revision",
        "Client requested changes",
        body=f"{client['company_name']} requested changes on “{task['title']}”.",
        href="/admin",
        entity_id=task_id,
    )
    if task.get("assignee_user_id"):
        await _notify(
            task["assignee_user_id"],
            type="managed.revision_requested",
            title="Changes requested",
            body=f"The client requested changes on “{task['title']}”.",
            href=f"/pool/tasks/{task_id}",
            entity_id=task_id,
        )
    return await _client_task_shape(updated)


@app.post("/api/managed/tasks/{task_id}/complete")
async def confirm_managed_completion(task_id: str, user: User = Depends(get_current_user)):
    client = await _get_managed_client_for(user)
    if not client:
        raise HTTPException(status_code=403, detail="Not a managed client")
    task = await _managed_task_or_404(task_id)
    if task["client_id"] != client["id"]:
        raise HTTPException(status_code=403, detail="Not your task")
    if task["status"] != "delivered":
        raise HTTPException(status_code=400, detail="Only delivered tasks can be confirmed complete")
    updated = await _managed_set_status(task, "completed", user, event_body="Client confirmed completion.")
    if task.get("assignee_user_id"):
        await _notify(
            task["assignee_user_id"],
            type="managed.task_completed",
            title="Task completed",
            body=f"“{task['title']}” was confirmed complete by the client.",
            href=f"/pool/tasks/{task_id}",
            entity_id=task_id,
        )
    return await _client_task_shape(updated)


@app.post("/api/managed/tasks/{task_id}/comments")
async def add_managed_task_comment_client(task_id: str, payload: ManagedCommentIn, user: User = Depends(get_current_user)):
    client = await _get_managed_client_for(user)
    if not client:
        raise HTTPException(status_code=403, detail="Not a managed client")
    task = await _managed_task_or_404(task_id)
    if task["client_id"] != client["id"]:
        raise HTTPException(status_code=403, detail="Not your task")
    # Clients always post client-visible comments regardless of payload.
    event = await _managed_event(task_id, user, "comment", "client", body=payload.body)
    await _notify_admins(
        "managed.client_comment",
        "Client commented on a task",
        body=f"{client['company_name']} commented on “{task['title']}”.",
        href="/admin",
        entity_id=task_id,
    )
    if task.get("assignee_user_id"):
        await _notify(
            task["assignee_user_id"],
            type="managed.task_comment",
            title="New comment",
            body=f"New client comment on “{task['title']}”.",
            href=f"/pool/tasks/{task_id}",
            entity_id=task_id,
        )
    return _client_event_shape(event)


@app.get("/api/managed/billing")
async def my_managed_billing(user: User = Depends(get_current_user)):
    client = await _get_managed_client_for(user)
    if not client:
        raise HTTPException(status_code=403, detail="Not a managed client")
    docs = await db.managed_charges.find(
        {"client_id": client["id"]},
        {"_id": 0, "created_by": 1, "id": 1, "description": 1, "amount": 1,
         "currency": 1, "due_date": 1, "status": 1, "paid_at": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(length=500)
    for d in docs:
        d.pop("created_by", None)
    return docs


# --- Freelancer (pool) task workspace
@app.get("/api/pool/me")
async def pool_me(request: Request):
    """Returns the caller's active pool membership, or null (200) when they are
    not in the managed pool — same quiet-check contract as /api/managed/me."""
    user = await _resolve_user_optional(request)
    if not user:
        return None
    m = await _get_pool_membership(user)
    if not m:
        return None
    m.pop("internal_notes", None)
    m.pop("added_by", None)
    m.pop("performance_score", None)
    m.pop("performance_count", None)
    return m


@app.get("/api/pool/my-application")
async def pool_my_application(request: Request):
    """Quiet check — returns the caller's most recent pool application or null."""
    user = await _resolve_user_optional(request)
    if not user:
        return None
    return await db.pool_applications.find_one(
        {"user_id": user.user_id}, {"_id": 0}, sort=[("created_at", -1)]
    )


@app.post("/api/pool/apply")
async def pool_apply(payload: PoolApplicationIn, user: User = Depends(get_current_user)):
    member = await db.pool_members.find_one(
        {"user_id": user.user_id, "status": {"$in": ["active", "suspended"]}}, {"_id": 0, "id": 1}
    )
    if member:
        raise HTTPException(status_code=400, detail="You are already in the managed pool")
    pending = await db.pool_applications.find_one(
        {"user_id": user.user_id, "status": "pending"}, {"_id": 0, "id": 1}
    )
    if pending:
        raise HTTPException(status_code=400, detail="You already have a pending pool application")
    expert = await db.experts.find_one(
        {"user_id": user.user_id}, {"_id": 0, "id": 1, "verified": 1}
    )
    doc = {
        "id": f"pa_{uuid.uuid4().hex[:10]}",
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "expert_id": expert["id"] if expert else None,
        "expert_verified": bool(expert and expert.get("verified")),
        "skills": payload.skills,
        "rate_expectation": payload.rate_expectation,
        "note": payload.note,
        "status": "pending",
        "created_at": _now(),
        "updated_at": _now(),
    }
    await db.pool_applications.insert_one(doc)
    doc.pop("_id", None)
    log.info("pool_application user=%s email=%s", user.user_id, user.email)
    vetted = "vetted expert — fast-track" if doc["expert_verified"] else "not yet vetted"
    await _notify_admins(
        "managed.pool_application",
        "New managed pool application",
        body=f"{user.name} ({user.email}) applied to the pool ({vetted}): {payload.skills}",
        entity_id=doc["id"],
        email_subject=f"WorkSoy pool application: {user.name}",
        email_html=(
            f"<h2>New managed pool application</h2>"
            f"<p><strong>{user.name}</strong> ({user.email}) — {vetted}</p>"
            f"<p><strong>Skills:</strong> {payload.skills}</p>"
            + (f"<p><strong>Rate expectation:</strong> {payload.rate_expectation}</p>" if payload.rate_expectation else "")
            + (f"<p style='white-space:pre-wrap'>{payload.note}</p>" if payload.note else "")
            + f"<p>Review it in the <a href='{APP_BASE_URL}/admin'>admin panel</a> (Managed service &rarr; Pool).</p>"
        ),
    )
    return doc


def _pool_task_shape(task: dict, company_name: Optional[str]) -> dict:
    out = dict(task)
    out.pop("admin_notes", None)
    out.pop("history", None)
    out["company_name"] = company_name
    return out


@app.get("/api/pool/tasks")
async def list_pool_tasks(user: User = Depends(get_current_user)):
    m = await _get_pool_membership(user)
    if not m:
        raise HTTPException(status_code=403, detail="Not an active pool member")
    docs = await db.managed_tasks.find(
        {"assignee_user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(length=500)
    client_ids = {d["client_id"] for d in docs}
    clients = {
        c["id"]: c
        async for c in db.managed_clients.find(
            {"id": {"$in": list(client_ids)}}, {"_id": 0, "id": 1, "company_name": 1}
        )
    }
    return [
        _pool_task_shape(d, clients.get(d["client_id"], {}).get("company_name"))
        for d in docs
    ]


@app.get("/api/pool/tasks/{task_id}")
async def get_pool_task(task_id: str, user: User = Depends(get_current_user)):
    m = await _get_pool_membership(user)
    if not m:
        raise HTTPException(status_code=403, detail="Not an active pool member")
    task = await _managed_task_or_404(task_id)
    if task.get("assignee_user_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Not your assignment")
    client = await db.managed_clients.find_one(
        {"id": task["client_id"]}, {"_id": 0, "company_name": 1}
    )
    delivs = await db.managed_deliverables.find(
        {"task_id": task_id}, {"_id": 0}
    ).sort("version", 1).to_list(length=50)
    for d in delivs:
        d["files"] = await _file_summaries(d.get("file_ids", []))
    events = await db.managed_task_events.find(
        {"task_id": task_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(length=500)
    return {
        "task": _pool_task_shape(task, client["company_name"] if client else None),
        "attachments": await _managed_request_attachments(task),
        "deliverables": delivs,
        "events": events,
    }


@app.post("/api/pool/tasks/{task_id}/start")
async def start_pool_task(task_id: str, user: User = Depends(get_current_user)):
    m = await _get_pool_membership(user)
    if not m:
        raise HTTPException(status_code=403, detail="Not an active pool member")
    task = await _managed_task_or_404(task_id)
    if task.get("assignee_user_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Not your assignment")
    updated = await _managed_set_status(task, "in_progress", user, event_visibility="internal", event_body="Work started.")
    client = await db.managed_clients.find_one({"id": task["client_id"]}, {"_id": 0, "company_name": 1})
    return _pool_task_shape(updated, client["company_name"] if client else None)


@app.post("/api/pool/tasks/{task_id}/deliverables")
async def submit_pool_deliverable(task_id: str, payload: ManagedDeliverableIn, user: User = Depends(get_current_user)):
    m = await _get_pool_membership(user)
    if not m:
        raise HTTPException(status_code=403, detail="Not an active pool member")
    task = await _managed_task_or_404(task_id)
    if task.get("assignee_user_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Not your assignment")
    if task["status"] not in ("in_progress", "revision_requested"):
        raise HTTPException(status_code=400, detail=f"Cannot submit a deliverable from status '{task['status']}'")
    for fid in payload.file_ids:
        f = await db.files.find_one({"id": fid}, {"_id": 0, "managed_task_id": 1, "owner_user_id": 1})
        if not f or f.get("managed_task_id") != task_id or f.get("owner_user_id") != user.user_id:
            raise HTTPException(status_code=400, detail="Each file must be uploaded by you against this task")
    version = await db.managed_deliverables.count_documents({"task_id": task_id}) + 1
    doc = {
        "id": f"md_{uuid.uuid4().hex[:10]}",
        "task_id": task_id,
        "uploaded_by": user.user_id,
        "note": payload.note,
        "file_ids": payload.file_ids,
        "status": "pending_review",
        "version": version,
        "reviewed_by": None,
        "reviewed_at": None,
        "review_note": None,
        "created_at": _now(),
    }
    await db.managed_deliverables.insert_one(doc)
    doc.pop("_id", None)
    # Stamp the files so they stop counting as request attachments and so the
    # download gate can require deliverable approval for client access.
    await db.files.update_many(
        {"id": {"$in": payload.file_ids}}, {"$set": {"managed_deliverable_id": doc["id"]}}
    )
    await _managed_set_status(task, "submitted", user, event_visibility="internal", event_body="Deliverable submitted for review.")
    await _notify_admins(
        "managed.deliverable_submitted",
        "Deliverable awaiting review",
        body=f"A deliverable (v{version}) on “{task['title']}” needs review.",
        href="/admin",
        entity_id=task_id,
    )
    doc["files"] = await _file_summaries(payload.file_ids)
    return doc


@app.post("/api/pool/tasks/{task_id}/comments")
async def add_managed_task_comment_pool(task_id: str, payload: ManagedCommentIn, user: User = Depends(get_current_user)):
    m = await _get_pool_membership(user)
    if not m:
        raise HTTPException(status_code=403, detail="Not an active pool member")
    task = await _managed_task_or_404(task_id)
    if task.get("assignee_user_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Not your assignment")
    event = await _managed_event(task_id, user, "comment", payload.visibility, body=payload.body)
    await _notify_admins(
        "managed.pool_comment",
        "Freelancer commented on a task",
        body=f"New comment on “{task['title']}”.",
        href="/admin",
        entity_id=task_id,
    )
    if payload.visibility == "client":
        await _notify(
            task["client_user_id"],
            type="managed.task_comment",
            title="New comment",
            body=f"New comment on “{task['title']}”.",
            href=f"/portal/tasks/{task_id}",
            entity_id=task_id,
        )
    return event


# Admin comments go through one endpoint with full visibility control.
@app.post("/api/admin/managed/tasks/{task_id}/comments")
async def add_managed_task_comment_admin(task_id: str, payload: ManagedCommentIn, admin: User = Depends(require_admin)):
    task = await _managed_task_or_404(task_id)
    event = await _managed_event(task_id, admin, "comment", payload.visibility, body=payload.body)
    if payload.visibility == "client":
        await _notify(
            task["client_user_id"],
            type="managed.task_comment",
            title="New comment",
            body=f"New comment on “{task['title']}”.",
            href=f"/portal/tasks/{task_id}",
            entity_id=task_id,
        )
    if task.get("assignee_user_id"):
        await _notify(
            task["assignee_user_id"],
            type="managed.task_comment",
            title="New comment",
            body=f"New comment on “{task['title']}”.",
            href=f"/pool/tasks/{task_id}",
            entity_id=task_id,
        )
    return event


@app.patch("/api/admin/managed/tasks/{task_id}/notes")
async def admin_update_task_notes(task_id: str, payload: ManagedHoldIn, _: User = Depends(require_admin)):
    await _managed_task_or_404(task_id)
    await db.managed_tasks.update_one(
        {"id": task_id}, {"$set": {"admin_notes": payload.note, "updated_at": _now()}}
    )
    return {"ok": True}


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

    # Vetting + shortlists + saved searches + test projects
    await db.vetting_applications.create_index("id", unique=True)
    await db.vetting_applications.create_index("user_id", unique=True)
    await db.vetting_applications.create_index("stage")
    await db.test_projects.create_index("id", unique=True)
    await db.test_projects.create_index("application_id")
    await db.test_projects.create_index("user_id")
    await db.shortlists.create_index([("user_id", 1), ("expert_id", 1)], unique=True)
    await db.shortlists.create_index("user_id")
    await db.saved_searches.create_index("id", unique=True)
    await db.saved_searches.create_index("user_id")

    # Expert payouts — one payout per milestone, ever.
    await db.payouts.create_index("id", unique=True)
    await db.payouts.create_index("milestone_id", unique=True)
    await db.payouts.create_index("expert_user_id")
    await db.payouts.create_index("status")

    # Managed service (pool, clients, tasks, deliverables, events, ratings)
    await db.pool_members.create_index("id", unique=True)
    await db.pool_members.create_index("user_id")
    await db.pool_members.create_index("status")
    await db.managed_clients.create_index("id", unique=True)
    await db.managed_clients.create_index("owner_user_id")
    await db.managed_clients.create_index("status")
    await db.managed_charges.create_index("id", unique=True)
    await db.managed_charges.create_index("client_id")
    await db.managed_charges.create_index("status")
    await db.managed_tasks.create_index("id", unique=True)
    await db.managed_tasks.create_index("client_id")
    await db.managed_tasks.create_index("client_user_id")
    await db.managed_tasks.create_index("assignee_user_id", sparse=True)
    await db.managed_tasks.create_index("status")
    await db.managed_deliverables.create_index("id", unique=True)
    await db.managed_deliverables.create_index("task_id")
    await db.managed_task_events.create_index("id", unique=True)
    await db.managed_task_events.create_index("task_id")
    await db.pool_ratings.create_index("id", unique=True)
    await db.pool_ratings.create_index("pool_member_id")
    await db.pool_ratings.create_index("task_id", unique=True)

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
