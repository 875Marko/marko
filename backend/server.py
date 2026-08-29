from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from passlib.context import CryptContext
import os
import re
import json
import uuid
import secrets
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime, timezone, timedelta

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# Verified on every failed login (even when the username doesn't exist) so that
# a missing user and a wrong password take the same amount of time.
_DUMMY_HASH = pwd_context.hash(secrets.token_urlsafe(16))

LOGIN_MAX_ATTEMPTS = 8
LOGIN_LOCKOUT_MINUTES = 15

RarityType = Literal["common", "uncommon", "rare", "epic", "legendary"]
RARITY_POINTS = {"common": 10, "uncommon": 25, "rare": 75, "epic": 200, "legendary": 500}

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,24}$")


class User(BaseModel):
    user_id: str
    username: str
    name: str
    picture: Optional[str] = None
    total_points: int = 0
    scan_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RegisterBody(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None


class LoginBody(BaseModel):
    username: str
    password: str


class ScanCreate(BaseModel):
    image_base64: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None


class CarScan(BaseModel):
    scan_id: str
    user_id: str
    make: str
    model: str
    year: Optional[str] = None
    color: Optional[str] = None
    rarity: RarityType
    points: int
    reason: str
    image_base64: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class FriendAction(BaseModel):
    friend_username: str


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session.get("expires_at")
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def _issue_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc),
    })
    return token


@api_router.get("/")
async def root():
    return {"message": "Car Spotter API"}


@api_router.post("/auth/register")
async def register(body: RegisterBody):
    username = body.username.strip().lower()
    if not USERNAME_RE.match(username):
        raise HTTPException(status_code=400, detail="Username must be 3-24 chars (letters, numbers, . _ -)")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    existing = await db.users.find_one({"username": username}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "username": username,
        "name": (body.display_name or username).strip()[:40],
        "picture": None,
        "password_hash": pwd_context.hash(body.password),
        "total_points": 0,
        "scan_count": 0,
        "friends": [],
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(user_doc)
    token = await _issue_session(user_id)
    user_pub = {k: v for k, v in user_doc.items() if k not in ("password_hash", "_id")}
    return {"session_token": token, "user": user_pub}


@api_router.post("/auth/login")
async def login(body: LoginBody):
    username = body.username.strip().lower()
    now = datetime.now(timezone.utc)

    attempts = await db.login_attempts.find_one({"username": username}, {"_id": 0})
    if attempts and attempts.get("locked_until"):
        locked_until = attempts["locked_until"]
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if locked_until > now:
            raise HTTPException(status_code=429, detail="Too many failed attempts. Try again later.")

    user = await db.users.find_one({"username": username}, {"_id": 0})
    # Always run a bcrypt verify, even for an unknown username, so that
    # "no such user" and "wrong password" take the same amount of time.
    if user and user.get("password_hash"):
        valid = pwd_context.verify(body.password, user["password_hash"])
    else:
        pwd_context.verify(body.password, _DUMMY_HASH)
        valid = False

    if not valid:
        result = await db.login_attempts.find_one_and_update(
            {"username": username},
            {
                "$inc": {"fail_count": 1},
                "$set": {"last_fail_at": now, "expires_at": now + timedelta(hours=24)},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        if result["fail_count"] >= LOGIN_MAX_ATTEMPTS:
            await db.login_attempts.update_one(
                {"username": username},
                {"$set": {"locked_until": now + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)}},
            )
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    await db.login_attempts.delete_one({"username": username})
    token = await _issue_session(user["user_id"])
    user_pub = {k: v for k, v in user.items() if k != "password_hash"}
    return {"session_token": token, "user": user_pub}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


SCAN_SYSTEM_PROMPT = (
    "You are an expert automotive identification assistant. Given a photo, identify the most prominent car in it. "
    "Return ONLY a JSON object with keys: make (string), model (string), year (string or 'Unknown'), "
    "color (one simple lowercase word: red, blue, green, yellow, orange, white, black, silver, grey, brown, purple, pink, gold, beige), "
    "body_type (one lowercase token from: sedan, hatchback, suv, truck, coupe, convertible, wagon, van, sports, other), "
    "tags (array of 1-6 lowercase short tags such as 'vintage','electric','jdm','muscle','luxury','tuner','off-road','classic','italian','german','american','japanese'), "
    "country_origin (country where the make is headquartered, e.g. 'Italy', 'Japan', 'Germany', or 'Unknown'), "
    "production_years (string like '2014-2019' or 'Unknown'), "
    "engine (short string like 'V8 5.2L NA' or '3.0L Twin-Turbo I6' or 'Electric Dual Motor', or 'Unknown'), "
    "top_speed_kmh (integer km/h estimate or 0 if unknown), "
    "fun_fact (one short interesting sentence about the car, max 140 chars), "
    "rarity (one of: common, uncommon, rare, epic, legendary), reason (one sentence on rarity).\n"
    "Rarity tiers reference:\n"
    "- common: mass-market everyday cars (Toyota Corolla, Honda Civic, Ford Focus).\n"
    "- uncommon: popular performance trims, mid-range SUVs, Tesla Model 3.\n"
    "- rare: enthusiast cars (BMW M3, Audi RS, Porsche 911 base, Mustang GT500).\n"
    "- epic: supercars (Lamborghini Huracan, Ferrari 488, McLaren 720S, GT-R Nismo).\n"
    "- legendary: hypercars or extremely rare classics (Bugatti, Pagani, Koenigsegg, Ferrari LaFerrari, Porsche 918, 1 of <100).\n"
    "If the image clearly does NOT contain a car, return JSON with make='None', model='No car detected', rarity='common', reason='No car detected'.\n"
    "Output ONLY valid JSON, no markdown fences."
)


def _extract_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ValueError("No JSON object found")
    return json.loads(m.group(0))


DAILY_SCAN_LIMIT = 10
MAX_IMAGE_B64_CHARS = 12_000_000  # ~9MB decoded — generous headroom for a phone photo


async def _reserve_daily_scan_slot(user_id: str, day_key: str) -> None:
    """Atomically claim one of today's scan slots. Raises 429 if the cap is hit.

    Uses an upserted counter document (rather than counting existing scan docs)
    so concurrent requests can't all pass the check before any of them insert.
    """
    counter = await db.scan_counters.find_one_and_update(
        {"user_id": user_id, "day": day_key},
        {"$inc": {"count": 1}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if counter["count"] > DAILY_SCAN_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit reached ({DAILY_SCAN_LIMIT} scans). Come back tomorrow!",
        )


async def _release_daily_scan_slot(user_id: str, day_key: str) -> None:
    """Give back a reserved slot after a failed/no-car attempt so only
    successful identifications count against the daily cap."""
    await db.scan_counters.update_one(
        {"user_id": user_id, "day": day_key},
        {"$inc": {"count": -1}},
    )


@api_router.post("/scan")
async def scan_car(body: ScanCreate, user: dict = Depends(get_current_user)):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")

    image_b64 = body.image_base64
    if "," in image_b64 and image_b64.startswith("data:"):
        image_b64 = image_b64.split(",", 1)[1]
    if len(image_b64) > MAX_IMAGE_B64_CHARS:
        raise HTTPException(status_code=413, detail="Image too large")

    now = datetime.now(timezone.utc)
    day_key = now.strftime("%Y-%m-%d")
    await _reserve_daily_scan_slot(user["user_id"], day_key)
    slot_reserved = True

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"scan_{uuid.uuid4().hex[:8]}",
            system_message=SCAN_SYSTEM_PROMPT,
        ).with_model("openai", "gpt-5.2")

        msg = UserMessage(
            text="Identify the car in this image and respond with the JSON schema only.",
            file_contents=[ImageContent(image_base64=image_b64)],
        )

        try:
            response_text = await chat.send_message(msg)
        except Exception as e:
            logger.exception("LLM error")
            raise HTTPException(status_code=502, detail=f"AI identify failed: {e}") from e

        try:
            data = _extract_json(response_text)
        except Exception as e:
            logger.error("Bad LLM JSON: %s", response_text)
            raise HTTPException(status_code=502, detail="Bad AI response") from e

        make = str(data.get("make", "Unknown")).strip() or "Unknown"
        model = str(data.get("model", "Unknown")).strip() or "Unknown"
        year = str(data.get("year", "")).strip() or None
        color = str(data.get("color", "")).strip() or None
        rarity_raw = str(data.get("rarity", "common")).strip().lower()
        if rarity_raw not in RARITY_POINTS:
            rarity_raw = "common"
        reason = str(data.get("reason", "")).strip()
        body_type = str(data.get("body_type", "other")).strip().lower() or "other"
        tags_raw = data.get("tags") or []
        tags = [str(t).strip().lower() for t in tags_raw if t][:6] if isinstance(tags_raw, list) else []
        country_origin = str(data.get("country_origin", "")).strip() or None
        production_years = str(data.get("production_years", "")).strip() or None
        engine = str(data.get("engine", "")).strip() or None
        try:
            top_speed = int(data.get("top_speed_kmh") or 0)
        except Exception:
            top_speed = 0
        fun_fact = str(data.get("fun_fact", "")).strip()[:200] or None

        if make.lower() == "none" or model.lower().startswith("no car"):
            raise HTTPException(status_code=422, detail="No car detected in this image. Try again with a clear car photo.")

        points = RARITY_POINTS[rarity_raw]
        scan_doc = {
            "scan_id": f"scan_{uuid.uuid4().hex[:12]}",
            "user_id": user["user_id"],
            "make": make, "model": model, "year": year, "color": color,
            "body_type": body_type, "tags": tags,
            "country_origin": country_origin,
            "production_years": production_years,
            "engine": engine,
            "top_speed_kmh": top_speed,
            "fun_fact": fun_fact,
            "rarity": rarity_raw, "points": points, "reason": reason,
            "image_base64": image_b64,
            "latitude": body.latitude, "longitude": body.longitude,
            "country": (body.country or "").strip() or None,
            "country_code": (body.country_code or "").strip().upper() or None,
            "region": (body.region or "").strip() or None,
            "city": (body.city or "").strip() or None,
            "created_at": datetime.now(timezone.utc),
        }
        await db.scans.insert_one(scan_doc)

        # Achievements
        completed, bonus = await _award_achievements(user["user_id"], scan_doc)
        total_points = points + bonus

        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$inc": {"total_points": total_points, "scan_count": 1}},
        )
        slot_reserved = False
        return {**{k: v for k, v in scan_doc.items() if k != "_id"},
                "completed_achievements": completed, "bonus_points": bonus}
    finally:
        # Only successful identifications count against the daily cap — give
        # the slot back on any error or "no car detected" result.
        if slot_reserved:
            await _release_daily_scan_slot(user["user_id"], day_key)


# ============== Achievements ==============
ACHIEVEMENTS_DAILY = [
    {"id": "d_blue",    "title": "Blue Mood",        "desc": "Spot a blue car",         "criteria": {"color": "blue"},     "bonus": 30},
    {"id": "d_red",     "title": "Seeing Red",       "desc": "Spot a red car",          "criteria": {"color": "red"},      "bonus": 30},
    {"id": "d_white",   "title": "Pure White",       "desc": "Spot a white car",        "criteria": {"color": "white"},    "bonus": 30},
    {"id": "d_black",   "title": "Blackout",         "desc": "Spot a black car",        "criteria": {"color": "black"},    "bonus": 30},
    {"id": "d_silver",  "title": "Silver Surfer",    "desc": "Spot a silver car",       "criteria": {"color": "silver"},   "bonus": 30},
    {"id": "d_suv",     "title": "Tall Order",       "desc": "Spot an SUV",             "criteria": {"body_type": "suv"},  "bonus": 30},
    {"id": "d_truck",   "title": "Heavy Duty",       "desc": "Spot a truck",            "criteria": {"body_type": "truck"}, "bonus": 30},
]

ACHIEVEMENTS_WEEKLY = [
    {"id": "w_convertible", "title": "Top Down",     "desc": "Spot a convertible",      "criteria": {"body_type": "convertible"}, "bonus": 150},
    {"id": "w_coupe",       "title": "Two-Door Club","desc": "Spot a coupe",            "criteria": {"body_type": "coupe"},        "bonus": 120},
    {"id": "w_sports",      "title": "Track Ready",  "desc": "Spot a sports car",       "criteria": {"body_type": "sports"},       "bonus": 150},
    {"id": "w_electric",    "title": "Silent Hunter","desc": "Spot an electric car",    "criteria": {"tag": "electric"},           "bonus": 130},
    {"id": "w_classic",     "title": "Old Soul",     "desc": "Spot a classic/vintage car","criteria": {"tag": "classic"},          "bonus": 160},
    {"id": "w_epic",        "title": "Big Game",     "desc": "Catch an epic or legendary","criteria": {"min_rarity": "epic"},      "bonus": 200},
]

_RARITY_ORDER = {"common": 0, "uncommon": 1, "rare": 2, "epic": 3, "legendary": 4}


def _period_keys(now: datetime) -> dict:
    d = now.astimezone(timezone.utc)
    daily_key = d.strftime("%Y-%m-%d")
    iso = d.isocalendar()
    weekly_key = f"{iso.year}-W{iso.week:02d}"
    return {"daily": daily_key, "weekly": weekly_key}


def _current_achievements(now: Optional[datetime] = None):
    now = now or datetime.now(timezone.utc)
    keys = _period_keys(now)
    day_idx = int(now.strftime("%j")) % len(ACHIEVEMENTS_DAILY)
    iso = now.isocalendar()
    week_idx = iso.week % len(ACHIEVEMENTS_WEEKLY)
    return {
        "daily": {**ACHIEVEMENTS_DAILY[day_idx], "period": "daily", "period_key": keys["daily"]},
        "weekly": {**ACHIEVEMENTS_WEEKLY[week_idx], "period": "weekly", "period_key": keys["weekly"]},
    }


def _matches(scan: dict, criteria: dict) -> bool:
    if "color" in criteria and (scan.get("color") or "").lower() != criteria["color"]:
        return False
    if "body_type" in criteria and (scan.get("body_type") or "").lower() != criteria["body_type"]:
        return False
    if "tag" in criteria and criteria["tag"] not in (scan.get("tags") or []):
        return False
    if "min_rarity" in criteria:
        if _RARITY_ORDER.get(scan.get("rarity", "common"), 0) < _RARITY_ORDER.get(criteria["min_rarity"], 99):
            return False
    return True


async def _award_achievements(user_id: str, scan: dict):
    current = _current_achievements()
    completed, bonus = [], 0
    for ach in (current["daily"], current["weekly"]):
        if not _matches(scan, ach["criteria"]):
            continue
        comp_id = f"{user_id}:{ach['id']}:{ach['period_key']}"
        # comp_id is uniquely indexed (see on_start), so a duplicate insert from
        # a concurrent request fails instead of silently double-awarding the bonus.
        try:
            await db.achievement_completions.insert_one({
                "comp_id": comp_id, "user_id": user_id, "ach_id": ach["id"],
                "period": ach["period"], "period_key": ach["period_key"],
                "scan_id": scan["scan_id"], "bonus": ach["bonus"],
                "created_at": datetime.now(timezone.utc),
            })
        except DuplicateKeyError:
            continue
        completed.append({"id": ach["id"], "title": ach["title"], "period": ach["period"], "bonus": ach["bonus"]})
        bonus += ach["bonus"]
    return completed, bonus


@api_router.get("/achievements")
async def get_achievements(user: dict = Depends(get_current_user)):
    current = _current_achievements()
    out = []
    for slot in ("daily", "weekly"):
        ach = current[slot]
        comp_id = f"{user['user_id']}:{ach['id']}:{ach['period_key']}"
        done = await db.achievement_completions.find_one({"comp_id": comp_id}, {"_id": 0})
        out.append({
            "id": ach["id"], "title": ach["title"], "desc": ach["desc"],
            "period": ach["period"], "bonus": ach["bonus"],
            "completed": bool(done),
            "completed_at": done.get("created_at") if done else None,
        })
    return {"achievements": out}


# ============== Atlas (locations) ==============
@api_router.get("/atlas")
async def get_atlas(user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user["user_id"], "country": {"$nin": [None, ""]}}},
        {"$group": {
            "_id": {"country": "$country", "code": "$country_code"},
            "count": {"$sum": 1},
            "top_rarity": {"$max": "$rarity"},
            "last_at": {"$max": "$created_at"},
        }},
        {"$sort": {"count": -1}},
        {"$limit": 100},
    ]
    rows = await db.scans.aggregate(pipeline).to_list(200)
    countries = [{
        "country": r["_id"]["country"],
        "code": r["_id"].get("code"),
        "count": r["count"],
        "last_at": r.get("last_at"),
    } for r in rows]

    recent = await db.scans.find(
        {"user_id": user["user_id"], "latitude": {"$ne": None}},
        {"_id": 0, "image_base64": 0},
    ).sort("created_at", -1).limit(60).to_list(60)

    total_scans = await db.scans.count_documents({"user_id": user["user_id"]})
    located = await db.scans.count_documents({"user_id": user["user_id"], "latitude": {"$ne": None}})

    return {
        "countries": countries,
        "country_count": len(countries),
        "located_count": located,
        "total_scans": total_scans,
        "recent": recent,
    }


GLOBE_PIN_PROJECTION = {
    "_id": 0, "scan_id": 1, "user_id": 1, "make": 1, "model": 1,
    "rarity": 1, "latitude": 1, "longitude": 1, "country": 1, "created_at": 1,
}
GLOBE_PIN_LIMIT = 300


@api_router.get("/atlas/globe")
async def atlas_globe(user: dict = Depends(get_current_user)):
    """Located scans for the globe view: the current user's pins plus their
    friends' pins, so a viewer can see where their circle has been spotting."""
    mine = await db.scans.find(
        {"user_id": user["user_id"], "latitude": {"$ne": None}, "longitude": {"$ne": None}},
        GLOBE_PIN_PROJECTION,
    ).sort("created_at", -1).limit(GLOBE_PIN_LIMIT).to_list(GLOBE_PIN_LIMIT)

    friend_ids = user.get("friends") or []
    friends_pins = []
    if friend_ids:
        friends_pins = await db.scans.find(
            {"user_id": {"$in": friend_ids}, "latitude": {"$ne": None}, "longitude": {"$ne": None}},
            GLOBE_PIN_PROJECTION,
        ).sort("created_at", -1).limit(GLOBE_PIN_LIMIT).to_list(GLOBE_PIN_LIMIT)

        friend_user_ids = list({p["user_id"] for p in friends_pins})
        friend_users = await db.users.find(
            {"user_id": {"$in": friend_user_ids}}, {"_id": 0, "user_id": 1, "username": 1, "name": 1}
        ).to_list(200)
        by_id = {u["user_id"]: u for u in friend_users}
        for p in friends_pins:
            u = by_id.get(p["user_id"], {})
            p["username"] = u.get("username")
            p["name"] = u.get("name")

    return {"mine": mine, "friends": friends_pins}


# ============== Spot of the Week ==============
def _week_key(d: datetime) -> str:
    iso = d.astimezone(timezone.utc).isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def _week_range(week_key: str):
    year, w = week_key.split("-W")
    monday = datetime.fromisocalendar(int(year), int(w), 1).replace(tzinfo=timezone.utc)
    return monday, monday + timedelta(days=7)


async def _compute_spot_for_week(week_key: str):
    cached = await db.spot_winners.find_one({"week_key": week_key}, {"_id": 0})
    if cached:
        return cached
    start, end = _week_range(week_key)
    pipeline = [
        {"$match": {"created_at": {"$gte": start, "$lt": end}}},
        {"$addFields": {"r_order": {
            "$indexOfArray": [["common", "uncommon", "rare", "epic", "legendary"], "$rarity"]
        }}},
        {"$sort": {"r_order": -1, "created_at": -1}},
        {"$limit": 1},
    ]
    docs = await db.scans.aggregate(pipeline).to_list(1)
    if not docs:
        return None
    top = docs[0]
    winner_user = await db.users.find_one({"user_id": top["user_id"]}, {"_id": 0, "password_hash": 0})
    record = {
        "week_key": week_key,
        "scan_id": top["scan_id"],
        "user_id": top["user_id"],
        "username": winner_user.get("username") if winner_user else None,
        "name": winner_user.get("name") if winner_user else None,
        "make": top["make"],
        "model": top["model"],
        "rarity": top["rarity"],
        "points": top["points"],
        "image_base64": top.get("image_base64"),
        "country": top.get("country"),
        "created_at": datetime.now(timezone.utc),
    }
    # Only freeze the winner once the week is fully past, otherwise return the leader live.
    now = datetime.now(timezone.utc)
    if end <= now:
        try:
            await db.spot_winners.insert_one({**record})
        except DuplicateKeyError:
            # Another concurrent request already froze this week's winner.
            cached = await db.spot_winners.find_one({"week_key": week_key}, {"_id": 0})
            if cached:
                return cached
    return record


@api_router.get("/spot-of-the-week")
async def spot_of_the_week(user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    this_week = _week_key(now)
    last_week_dt = now - timedelta(days=7)
    last_week = _week_key(last_week_dt)
    current = await _compute_spot_for_week(this_week)
    last = await _compute_spot_for_week(last_week)
    my_badges = await db.spot_winners.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("week_key", -1).to_list(50)
    return {
        "current_leader": current,
        "last_week_winner": last,
        "my_badges": my_badges,
    }


@api_router.get("/garage")
async def get_garage(
    user: dict = Depends(get_current_user),
    limit: int = Query(30, ge=1, le=100),
    skip: int = Query(0, ge=0),
):
    # Paginated: each scan embeds a full base64 image, so returning hundreds
    # of them in one response is a multi-hundred-MB payload risk.
    scans = await db.scans.find({"user_id": user["user_id"]}, {"_id": 0}) \
        .sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.scans.count_documents({"user_id": user["user_id"]})
    user_fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"user": user_fresh, "scans": scans, "total": total, "limit": limit, "skip": skip}


@api_router.get("/leaderboard/global")
async def leaderboard_global(user: dict = Depends(get_current_user)):
    top = await db.users.find(
        {"$or": [{"scan_count": {"$gt": 0}}, {"user_id": user["user_id"]}]},
        {"_id": 0, "password_hash": 0},
    ).sort("total_points", -1).limit(100).to_list(100)
    return {"users": top}


@api_router.get("/leaderboard/friends")
async def leaderboard_friends(user: dict = Depends(get_current_user)):
    friend_ids = user.get("friends", [])
    ids = list(set(friend_ids + [user["user_id"]]))
    rows = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).sort("total_points", -1).to_list(200)
    return {"users": rows}


@api_router.post("/friends/add")
async def add_friend(body: FriendAction, user: dict = Depends(get_current_user)):
    friend = await db.users.find_one({"username": body.friend_username.strip().lower()}, {"_id": 0, "password_hash": 0})
    if not friend:
        raise HTTPException(status_code=404, detail="No Car Spotter player with that username")
    if friend["user_id"] == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot add yourself")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$addToSet": {"friends": friend["user_id"]}},
    )
    return {"ok": True, "friend": friend}


@api_router.post("/friends/remove")
async def remove_friend(body: FriendAction, user: dict = Depends(get_current_user)):
    friend = await db.users.find_one({"username": body.friend_username.strip().lower()}, {"_id": 0})
    if not friend:
        return {"ok": True}
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$pull": {"friends": friend["user_id"]}},
    )
    return {"ok": True}


# ============== Discover / Country / Stats ==============
@api_router.get("/discover")
async def discover(user: dict = Depends(get_current_user)):
    """Recent global rare/epic/legendary spots from all players."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    rows = await db.scans.find(
        {"created_at": {"$gte": cutoff}, "rarity": {"$in": ["rare", "epic", "legendary"]}},
        {"_id": 0},
    ).sort([("rarity", -1), ("created_at", -1)]).limit(40).to_list(40)
    # attach hunter username
    ids = list({r["user_id"] for r in rows})
    users = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "user_id": 1, "username": 1, "name": 1}).to_list(200)
    by_id = {u["user_id"]: u for u in users}
    for r in rows:
        u = by_id.get(r["user_id"], {})
        r["hunter_username"] = u.get("username")
        r["hunter_name"] = u.get("name")
    return {"spots": rows}


@api_router.get("/country/{code}")
async def country_detail(code: str, user: dict = Depends(get_current_user)):
    code = code.upper().strip()
    spots = await db.scans.find(
        {"country_code": code},
        {"_id": 0},
    ).sort([("rarity", -1), ("created_at", -1)]).limit(120).to_list(120)
    ids = list({s["user_id"] for s in spots})
    users = await db.users.find({"user_id": {"$in": ids}}, {"_id": 0, "user_id": 1, "username": 1, "name": 1}).to_list(200)
    by_id = {u["user_id"]: u for u in users}
    country_name = None
    for s in spots:
        u = by_id.get(s["user_id"], {})
        s["hunter_username"] = u.get("username")
        s["is_mine"] = s["user_id"] == user["user_id"]
        if not country_name and s.get("country"):
            country_name = s["country"]
    mine = sum(1 for s in spots if s["is_mine"])
    return {
        "country": country_name,
        "country_code": code,
        "total": len(spots),
        "mine": mine,
        "hunters": len(ids),
        "spots": spots,
    }


async def _profile_stats_for(user_id: str, member_since: Optional[datetime]) -> dict:
    """Shared by /profile/stats (self) and /profile/public/{user_id} so viewing
    someone else's profile carries the same depth as your own."""
    rb_pipe = [{"$match": {"user_id": user_id}}, {"$group": {"_id": "$rarity", "count": {"$sum": 1}}}]
    rb_rows = await db.scans.aggregate(rb_pipe).to_list(20)
    rarity_breakdown = {k: 0 for k in RARITY_POINTS.keys()}
    for r in rb_rows:
        if r["_id"] in rarity_breakdown:
            rarity_breakdown[r["_id"]] = r["count"]

    def _top(field):
        return [
            {"$match": {"user_id": user_id, field: {"$nin": [None, "", "Unknown"]}}},
            {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 1},
        ]

    async def _one(field):
        rows = await db.scans.aggregate(_top(field)).to_list(1)
        return rows[0] if rows else None

    top_make = await _one("make")
    top_body = await _one("body_type")
    top_color = await _one("color")
    top_origin = await _one("country_origin")

    countries_count = len(await db.scans.distinct("country", {"user_id": user_id, "country": {"$nin": [None, ""]}}))
    badge_count = await db.spot_winners.count_documents({"user_id": user_id})
    achievement_count = await db.achievement_completions.count_documents({"user_id": user_id})

    # Best scan (highest rarity, then most recent)
    best_rows = await db.scans.aggregate([
        {"$match": {"user_id": user_id}},
        {"$addFields": {"r_order": {"$indexOfArray": [["common", "uncommon", "rare", "epic", "legendary"], "$rarity"]}}},
        {"$sort": {"r_order": -1, "created_at": -1}},
        {"$limit": 1},
        {"$project": {"_id": 0, "make": 1, "model": 1, "rarity": 1, "year": 1, "points": 1}},
    ]).to_list(1)
    best_scan = best_rows[0] if best_rows else None

    # Bonus points from achievements (sum of bonuses)
    bonus_rows = await db.achievement_completions.aggregate([
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "sum": {"$sum": "$bonus"}}},
    ]).to_list(1)
    bonus_points_total = int(bonus_rows[0]["sum"]) if bonus_rows else 0

    days_since = None
    if member_since:
        ms = member_since if member_since.tzinfo else member_since.replace(tzinfo=timezone.utc)
        days_since = max(1, (datetime.now(timezone.utc) - ms).days + 1)

    return {
        "rarity_breakdown": rarity_breakdown,
        "top_make": {"name": top_make["_id"], "count": top_make["count"]} if top_make else None,
        "top_body": {"name": top_body["_id"], "count": top_body["count"]} if top_body else None,
        "top_color": {"name": top_color["_id"], "count": top_color["count"]} if top_color else None,
        "top_origin": {"name": top_origin["_id"], "count": top_origin["count"]} if top_origin else None,
        "countries_count": countries_count,
        "badge_count": badge_count,
        "achievement_count": achievement_count,
        "best_scan": best_scan,
        "bonus_points_total": bonus_points_total,
        "days_since_joined": days_since,
    }


@api_router.get("/profile/stats")
async def profile_stats(user: dict = Depends(get_current_user)):
    uid = user["user_id"]
    stats = await _profile_stats_for(uid, user.get("created_at"))

    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = await db.scans.count_documents({"user_id": uid, "created_at": {"$gte": day_start}})
    scans_remaining_today = max(0, DAILY_SCAN_LIMIT - today_count)

    return {**stats, "scans_remaining_today": scans_remaining_today, "daily_limit": DAILY_SCAN_LIMIT}


@api_router.get("/profile/public/{user_id}")
async def public_profile(user_id: str, user: dict = Depends(get_current_user)):
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Player not found")

    stats = await _profile_stats_for(user_id, target.get("created_at"))
    recent = await db.scans.find(
        {"user_id": user_id},
        {"_id": 0, "image_base64": 1, "scan_id": 1, "make": 1, "model": 1, "rarity": 1, "points": 1, "country_code": 1},
    ).sort("created_at", -1).limit(12).to_list(12)
    is_friend = user_id in (user.get("friends") or [])
    return {
        "user_id": target["user_id"],
        "username": target.get("username"),
        "name": target.get("name"),
        "picture": target.get("picture"),
        "total_points": target.get("total_points", 0),
        "scan_count": target.get("scan_count", 0),
        **stats,
        "recent": recent,
        "is_friend": is_friend,
        "is_self": user_id == user["user_id"],
    }


@api_router.post("/friends/add_by_id")
async def add_friend_by_id(body: dict, user: dict = Depends(get_current_user)):
    target_id = (body or {}).get("user_id", "")
    if not target_id or target_id == user["user_id"]:
        raise HTTPException(status_code=400, detail="Invalid user_id")
    friend = await db.users.find_one({"user_id": target_id}, {"_id": 0, "password_hash": 0})
    if not friend:
        raise HTTPException(status_code=404, detail="Player not found")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$addToSet": {"friends": target_id}},
    )
    return {"ok": True, "friend": friend}


@api_router.post("/friends/remove_by_id")
async def remove_friend_by_id(body: dict, user: dict = Depends(get_current_user)):
    target_id = (body or {}).get("user_id", "")
    if not target_id:
        return {"ok": True}
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$pull": {"friends": target_id}},
    )
    return {"ok": True}


app.include_router(api_router)
# Auth is a Bearer token header, not a cookie, so credentialed CORS isn't
# needed here — and the spec disallows allow_origins=["*"] together with
# allow_credentials=True anyway (browsers reject that combination).
app.add_middleware(
    CORSMiddleware, allow_credentials=False,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("startup")
async def on_start():
    try:
        # Drop legacy unique email index if present (migrating from Google Auth)
        try:
            await db.users.drop_index("email_1")
        except Exception:
            pass
        await db.users.create_index("username", unique=True, sparse=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
        await db.scans.create_index([("user_id", 1), ("created_at", -1)])
        await db.scans.create_index([("country", 1)])
        await db.scans.create_index([("user_id", 1), ("latitude", 1)])
        await db.spot_winners.create_index("week_key", unique=True)
        await db.scan_counters.create_index([("user_id", 1), ("day", 1)], unique=True)
        await db.achievement_completions.create_index("comp_id", unique=True)
        await db.login_attempts.create_index("username", unique=True)
        await db.login_attempts.create_index("expires_at", expireAfterSeconds=0)
    except Exception as e:
        logger.warning("Index create failed: %s", e)


@app.on_event("shutdown")
async def on_stop():
    client.close()
