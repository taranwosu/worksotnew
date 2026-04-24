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

load_dotenv()

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_AUTH_URL = os.environ["EMERGENT_AUTH_URL"]
STRIPE_API_KEY = os.environ["STRIPE_API_KEY"]
ADMIN_EMAIL = "admin@worksoy.com"
ADMIN_PASSWORD = "WorkSoy!Admin2026"

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("worksoy")

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="WorkSoy API")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_user_id: str
    sender_name: str
    body: str
    created_at: datetime


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
async def register(payload: RegisterIn, response: Response):
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
    return {"session_token": token, "user": User(**user).model_dump()}


@app.post("/api/auth/login")
async def login(payload: LoginIn, response: Response):
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
async def google_session(payload: GoogleSessionIn, response: Response):
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
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    host_url = str(request.base_url)
    stripe = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{host_url}api/webhook/stripe")
    try:
        evt = await stripe.handle_webhook(body, sig)
    except Exception as e:
        log.warning("stripe webhook error: %s", e)
        return {"ok": False}
    if evt.session_id and evt.payment_status == "paid":
        tx = await db.payment_transactions.find_one({"session_id": evt.session_id}, {"_id": 0})
        if tx and tx.get("payment_status") != "paid":
            await db.payment_transactions.update_one(
                {"session_id": evt.session_id},
                {"$set": {"status": "complete", "payment_status": "paid", "updated_at": _now()}},
            )
            await db.milestones.update_one(
                {"id": tx["milestone_id"], "status": "pending"},
                {"$set": {"status": "funded", "funded_at": _now()}},
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
    doc = {
        "id": mid,
        "conversation_id": conv_id,
        "sender_user_id": user.user_id,
        "sender_name": user.name,
        "body": payload.body,
        "created_at": _now(),
        "read_by": {user.user_id: _now()},
    }
    await db.messages.insert_one(doc)
    await db.conversations.update_one(
        {"id": conv_id},
        {"$set": {"last_body": payload.body, "last_at": _now()}},
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

    # Seed admin
    existing = await db.users.find_one({"email": ADMIN_EMAIL}, {"_id": 0, "user_id": 1})
    if not existing:
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
