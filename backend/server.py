"""WorkSoy FastAPI backend — auth + experts (MongoDB)."""
from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List

import jwt
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Response, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

load_dotenv()

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
EMERGENT_AUTH_URL = os.environ["EMERGENT_AUTH_URL"]

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

api = FastAPI()  # not used; keep single app with /api prefix below


# ---------- Models ----------
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    provider: str  # "jwt" | "google"
    role: str = "client"  # "client" | "expert" | "admin"
    created_at: datetime


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)


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
    availability: str  # "Available now" | "Available next week" | "Available in 2 weeks"
    topRated: bool
    verified: bool
    image: str
    bio: str
    yearsExperience: int
    languages: List[str]
    certifications: List[str]


# ---------- Helpers ----------
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


# ---------- Auth endpoints ----------
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
            "role": "client",
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
    """Exchange Emergent session_id for our session_token + user."""
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
        {
            "$setOnInsert": {
                "user_id": user_id,
                "session_token": token,
                "expires_at": _now() + timedelta(days=7),
                "created_at": _now(),
            }
        },
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


# ---------- Experts ----------
@app.get("/api/experts", response_model=List[Expert])
async def list_experts(
    q: Optional[str] = None,
    category: Optional[str] = None,
    sort: str = "top",  # "top" | "rate_asc" | "rate_desc" | "newest"
):
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


@app.get("/api/experts/{expert_id}", response_model=Expert)
async def get_expert(expert_id: str):
    doc = await db.experts.find_one({"id": expert_id, "isPublished": True}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Expert not found")
    return Expert(**doc)


# ---------- Startup indexes ----------
@app.on_event("startup")
async def _startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.experts.create_index("id", unique=True)
    await db.experts.create_index("category")
    await db.experts.create_index([("rating", -1), ("reviewCount", -1)])
    log.info("WorkSoy API ready")
