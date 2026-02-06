# backend/server.py

from fastapi import (
    FastAPI, APIRouter, HTTPException, UploadFile, File, Form,
    WebSocket, WebSocketDisconnect, Request
)
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import logging
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta
import uuid
from typing import List, Dict, Optional, Any

import io
from PyPDF2 import PdfReader

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from database import init_db, close_db, get_db
from models import (
    PatrolCreate, PatrolUpdate, PatrolResponse, PatrolTrailResponse,
    TrailPoint, CodeVerification, HQLogin, HQCreate, HQResponse, SOSAlert,
    Soldier, InactivityConfig
)
from security import (
    hash_password, verify_password, validate_password_strength,
    create_access_token,
    sanitize_input, validate_patrol_id, validate_coordinates,
    record_failed_login, clear_failed_attempts, is_account_locked, get_remaining_attempts,
    log_security_event, SECURITY_HEADERS
)

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# MQTT flag
MQTT_ENABLED = os.environ.get("MQTT_ENABLED", "false").lower() == "true"

# Subscription plan limits
SUBSCRIPTION_PLANS = {
    "trial": {
        "duration_hours": 48,
        "max_patrols": 3,
        "max_tracking": 3,
        "session_duration_min": 30,
        "trail_history_hours": 6,
        "price": 0,
    },
    "normal": {
        "duration_hours": 30 * 24,
        "max_patrols": 50,
        "max_tracking": 25,
        "session_duration_min": 720,
        "trail_history_hours": 24,
        "price": 25,
    },
    "pro": {
        "duration_hours": 365 * 24,
        "max_patrols": 300,
        "max_tracking": 300,
        "session_duration_min": 1440,
        "trail_history_hours": 168,
        "price": 50,
    },
}

# WebSocket connection manager
# We store {client_id: {"ws": WebSocket, "connected_at": iso_string}}
connected_clients: Dict[str, Dict[str, Any]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        await init_db()
        print("Database initialized")
    except Exception as e:
        print(f"DB init failed, starting server anyway: {e}")

    # Start MQTT bridge if enabled
    if MQTT_ENABLED:
        try:
            from mqtt_bridge import start_mqtt_bridge
            await start_mqtt_bridge()
            print("MQTT Bridge started successfully")
        except Exception as e:
            print(f"Failed to start MQTT bridge: {e}")

    yield  # App runs here

    # Shutdown
    if MQTT_ENABLED:
        try:
            from mqtt_bridge import stop_mqtt_bridge
            stop_mqtt_bridge()
        except Exception:
            pass

    try:
        await close_db()
    except Exception:
        pass


app = FastAPI(
    title="Military Patrol Tracking API",
    description="Real-time patrol tracking system",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if os.environ.get("ENABLE_DOCS", "true").lower() == "true" else None,
    redoc_url="/api/redoc" if os.environ.get("ENABLE_DOCS", "true").lower() == "true" else None,
)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    for header, value in SECURITY_HEADERS.items():
        response.headers[header] = value
    return response

# Request Logging Middleware (for security audit)
@app.middleware("http")
async def log_requests(request: Request, call_next):
    path = request.url.path
    if any(pattern in path.lower() for pattern in ["admin", "login", "password", "token"]):
        log_security_event("api_access", {"path": path, "method": request.method}, request)
    return await call_next(request)


api_router = APIRouter(prefix="/api")


# -------------------------
# WebSocket endpoint
# -------------------------
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    if not client_id or not re.match(r"^[a-zA-Z0-9_-]+$", client_id):
        await websocket.close(code=4001, reason="Invalid client ID format")
        return

    await websocket.accept()
    connected_clients[client_id] = {"ws": websocket, "connected_at": datetime.now(timezone.utc).isoformat()}
    print(f"WebSocket client connected: {client_id}")

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "location_update":
                patrol_id = data.get("patrol_id")
                latitude = data.get("latitude")
                longitude = data.get("longitude")

                # Basic validation (optional)
                if not patrol_id or latitude is None or longitude is None:
                    continue

                now_utc = datetime.now(timezone.utc)
                timestamp = now_utc.isoformat()

                # Session date in BD (UTC+6)
                now_bd = now_utc + timedelta(hours=6)
                session_date = now_bd.strftime("%Y-%m-%d")

                db = get_db()

                # Keep existing session_date if already set today
                patrol = await db.patrols.find_one({"id": patrol_id}, {"session_date": 1})
                patrol_session_date = (patrol or {}).get("session_date") or session_date

                # Update patrol + trail
                await db.patrols.update_one(
                    {"id": patrol_id},
                    {
                        "$set": {
                            "latitude": latitude,
                            "longitude": longitude,
                            "last_update": timestamp,
                            "last_location_time": timestamp,
                            "is_tracking": True,
                            "tracking_stopped": False,
                            "session_date": patrol_session_date,
                        },
                        "$push": {
                            "trail": {
                                "$each": [
                                    {
                                        "lat": latitude,
                                        "lng": longitude,
                                        "timestamp": timestamp,
                                        "session_date": patrol_session_date,
                                    }
                                ],
                                "$slice": -5000,
                            }
                        },
                    },
                    upsert=False,
                )

                # Store in locations for history
                await db.locations.insert_one(
                    {
                        "patrol_id": patrol_id,
                        "location": {"type": "Point", "coordinates": [longitude, latitude]},
                        "latitude": latitude,
                        "longitude": longitude,
                        "timestamp": timestamp,
                        "accuracy": data.get("accuracy"),
                        "session_date": patrol_session_date,
                    }
                )

                # Broadcast
                for cid, info in list(connected_clients.items()):
                    try:
                        await info["ws"].send_json(
                            {
                                "type": "patrol_location",
                                "patrol_id": patrol_id,
                                "latitude": latitude,
                                "longitude": longitude,
                                "timestamp": timestamp,
                            }
                        )
                    except Exception as e:
                        print(f"WS broadcast error to {cid}: {e}")

            elif data.get("type") == "sos_alert":
                patrol_id = data.get("patrol_id")
                latitude = data.get("latitude")
                longitude = data.get("longitude")
                message = data.get("message", "EMERGENCY - SOS ALERT")

                if not patrol_id:
                    continue

                db = get_db()
                alert = {
                    "patrol_id": patrol_id,
                    "latitude": latitude,
                    "longitude": longitude,
                    "message": message,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "resolved": False,
                    "auto_triggered": False,
                }

                await db.sos_alerts.insert_one(alert)
                await db.patrols.update_one({"id": patrol_id}, {"$set": {"status": "sos"}})

                for cid, info in list(connected_clients.items()):
                    try:
                        await info["ws"].send_json({"type": "sos_alert", **alert})
                    except Exception:
                        pass

    except WebSocketDisconnect:
        print(f"WebSocket client disconnected: {client_id}")
        connected_clients.pop(client_id, None)
    except Exception as e:
        print(f"WebSocket error for {client_id}: {e}")
        connected_clients.pop(client_id, None)


# -------------------------
# Subscription helpers
# -------------------------
async def check_subscription(db, hq_id: str, action: str = "access"):
    if hq_id == "SUPER_ADMIN":
        return True, None, {"plan": "pro", "status": "active"}

    hq = await db.hq_users.find_one({"hq_id": hq_id})
    if not hq:
        return False, "HQ not found", None

    subscription = hq.get("subscription", {})
    if not subscription:
        return False, "No subscription", None

    expires_at = subscription.get("expires_at")
    if expires_at:
        expiry = datetime.fromisoformat(expires_at) if isinstance(expires_at, str) else expires_at
        if datetime.now(timezone.utc) > expiry:
            return False, "Subscription expired. Contact admin to renew.", subscription

    return True, None, subscription


async def check_patrol_limit(db, hq_id: str):
    if hq_id == "SUPER_ADMIN":
        return True, None, 999

    hq = await db.hq_users.find_one({"hq_id": hq_id})
    if not hq:
        return False, "HQ not found", 0

    subscription = hq.get("subscription", {})
    limits = subscription.get("limits", SUBSCRIPTION_PLANS["trial"])
    max_patrols = limits.get("max_patrols", 3)

    current_count = await db.patrols.count_documents({"hq_id": hq_id})
    if current_count >= max_patrols:
        plan = subscription.get("plan", "trial")
        return False, f"Patrol limit reached ({current_count}/{max_patrols}). Upgrade your {plan} plan.", max_patrols

    return True, None, max_patrols - current_count


async def check_tracking_limit(db, hq_id: str):
    if hq_id == "SUPER_ADMIN":
        return True, None, 999

    hq = await db.hq_users.find_one({"hq_id": hq_id})
    if not hq:
        return False, "HQ not found", 0

    subscription = hq.get("subscription", {})
    limits = subscription.get("limits", SUBSCRIPTION_PLANS["trial"])
    max_tracking = limits.get("max_tracking", 3)

    current_tracking = await db.patrols.count_documents({"hq_id": hq_id, "is_tracking": True})
    if current_tracking >= max_tracking:
        plan = subscription.get("plan", "trial")
        return False, f"Active tracking limit reached ({current_tracking}/{max_tracking}). Upgrade your {plan} plan.", max_tracking

    return True, None, max_tracking - current_tracking


# -------------------------
# Status derivation
# -------------------------
def derive_patrol_status(patrol: dict) -> str:
    """
    Priority:
    1. SOS active → 'sos'
    2. session_date ≠ today → 'completed'
    3. tracking_stopped=True → 'stopped'
    4. last_location_time ≤2 min → 'active'
    5. 2–15 min → 'paused'
    6. >15 min or no location → 'offline'
    """
    if patrol.get("status") == "sos":
        return "sos"

    now_utc = datetime.now(timezone.utc)
    now_bd = now_utc + timedelta(hours=6)
    today = now_bd.strftime("%Y-%m-%d")

    session_date = patrol.get("session_date", "")
    if session_date and session_date != today:
        return "completed"

    if patrol.get("tracking_stopped"):
        return "stopped"

    last_location_time = patrol.get("last_location_time")
    if not last_location_time:
        return "offline"

    try:
        last_time = (
            datetime.fromisoformat(last_location_time.replace("Z", "+00:00"))
            if isinstance(last_location_time, str)
            else last_location_time
        )
        elapsed = (now_utc - last_time).total_seconds()
        if elapsed <= 120:
            return "active"
        if elapsed <= 900:
            return "paused"
        return "offline"
    except Exception:
        return "offline"


# -------------------------
# Patrol routes
# -------------------------
@api_router.post("/patrols", response_model=PatrolResponse)
async def create_patrol(patrol: PatrolCreate):
    db = get_db()

    is_valid, error, _ = await check_subscription(db, patrol.hq_id)
    if not is_valid:
        raise HTTPException(status_code=403, detail=error)

    can_create, error, _remaining = await check_patrol_limit(db, patrol.hq_id)
    if not can_create:
        raise HTTPException(status_code=403, detail=error)

    patrol_id = str(uuid.uuid4())[:8].upper()

    patrol_doc = {
        "id": patrol_id,
        "name": patrol.name,
        "camp_name": patrol.camp_name,
        "unit": patrol.unit,
        "leader_email": patrol.leader_email,
        "phone_number": patrol.phone_number,
        "assigned_area": patrol.assigned_area,
        "soldier_ids": patrol.soldier_ids,
        "soldier_count": len(patrol.soldier_ids),
        "latitude": 0.0,
        "longitude": 0.0,
        "status": "inactive",
        "last_update": datetime.now(timezone.utc).isoformat(),
        "is_tracking": False,
        "hq_id": patrol.hq_id,
        "session_date": None,
        "tracking_stopped": False,
    }

    await db.patrols.insert_one(patrol_doc)
    patrol_doc.pop("_id", None)
    return PatrolResponse(**patrol_doc)


@api_router.get("/patrols", response_model=List[PatrolResponse])
async def get_all_patrols(
    hq_id: str,
    status: str = None,
    search: str = None,
    camp_name: str = None,
    unit: str = None,
):
    db = get_db()

    if hq_id != "SUPER_ADMIN":
        is_valid, error, _ = await check_subscription(db, hq_id)
        if not is_valid:
            raise HTTPException(status_code=403, detail=error)

    query: Dict[str, Any] = {} if hq_id == "SUPER_ADMIN" else {"hq_id": hq_id}

    if status:
        query["status"] = status
    if camp_name:
        query["camp_name"] = camp_name
    if unit:
        query["unit"] = unit

    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"camp_name": {"$regex": search, "$options": "i"}},
            {"unit": {"$regex": search, "$options": "i"}},
            {"assigned_area": {"$regex": search, "$options": "i"}},
            {"id": {"$regex": search, "$options": "i"}},
            {"leader_email": {"$regex": search, "$options": "i"}},
        ]

    patrols = await db.patrols.find(query, {"_id": 0}).to_list(500)

    for p in patrols:
        # last_update is stored as ISO string; your response_model might accept str or datetime
        p["status"] = derive_patrol_status(p)

    return patrols


@api_router.get("/patrols/filters/options")
async def get_filter_options(hq_id: str):
    db = get_db()
    query = {} if hq_id == "SUPER_ADMIN" else {"hq_id": hq_id}
    camps = await db.patrols.distinct("camp_name", query)
    units = await db.patrols.distinct("unit", query)
    return {"camps": sorted([c for c in camps if c]), "units": sorted([u for u in units if u])}


@api_router.get("/patrols/{patrol_id}", response_model=PatrolResponse)
async def get_patrol(patrol_id: str, hq_id: str):
    db = get_db()
    q = {"id": patrol_id} if hq_id == "SUPER_ADMIN" else {"id": patrol_id, "hq_id": hq_id}
    patrol = await db.patrols.find_one(q, {"_id": 0})
    if not patrol:
        raise HTTPException(status_code=404, detail="Patrol not found")
    patrol["status"] = derive_patrol_status(patrol)
    return patrol


@api_router.patch("/patrols/{patrol_id}", response_model=PatrolResponse)
async def update_patrol(patrol_id: str, update: PatrolUpdate):
    db = get_db()
    update_data = {
        "latitude": update.latitude,
        "longitude": update.longitude,
        "last_update": datetime.now(timezone.utc).isoformat(),
    }
    if update.status:
        update_data["status"] = update.status

    result = await db.patrols.find_one_and_update(
        {"id": patrol_id},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Patrol not found")

    await db.locations.insert_one(
        {
            "patrol_id": patrol_id,
            "location": {"type": "Point", "coordinates": [update.longitude, update.latitude]},
            "latitude": update.latitude,
            "longitude": update.longitude,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "accuracy": getattr(update, "accuracy", None),
        }
    )

    result.pop("_id", None)
    result["status"] = derive_patrol_status(result)
    return result


@api_router.get("/patrols/trails/all")
async def get_all_patrol_trails(hq_id: str, date: str = None):
    db = get_db()

    now_bd = datetime.now(timezone.utc) + timedelta(hours=6)
    session_date = date or now_bd.strftime("%Y-%m-%d")

    query: Dict[str, Any] = {
        "$or": [{"is_tracking": True}, {"session_date": session_date}],
    }
    if hq_id != "SUPER_ADMIN":
        query["hq_id"] = hq_id

    patrols = await db.patrols.find(
        query,
        {
            "_id": 0,
            "id": 1,
            "name": 1,
            "status": 1,
            "trail": 1,
            "session_date": 1,
            "latitude": 1,
            "longitude": 1,
            "session_start": 1,
            "tracking_stopped": 1,
        },
    ).to_list(500)

    all_trails = []
    for patrol in patrols:
        patrol_session = patrol.get("session_date", "")
        trail_points = []
        for pt in patrol.get("trail", []):
            point_session = pt.get("session_date", patrol_session)
            if point_session == session_date or not pt.get("session_date"):
                trail_points.append([pt.get("lat"), pt.get("lng")])

        if trail_points or patrol.get("latitude") is not None:
            all_trails.append(
                {
                    "patrol_id": patrol["id"],
                    "patrol_name": patrol.get("name", ""),
                    "status": derive_patrol_status(patrol),
                    "points": trail_points,
                    "last_location": [patrol.get("latitude", 0), patrol.get("longitude", 0)],
                    "session_start": patrol.get("session_start"),
                    "tracking_stopped": patrol.get("tracking_stopped"),
                }
            )

    return all_trails


@api_router.get("/patrols/{patrol_id}/trail")
async def get_patrol_trail(patrol_id: str, date: str = None):
    db = get_db()

    patrol = await db.patrols.find_one({"id": patrol_id}, {"_id": 0, "trail": 1, "session_date": 1, "status": 1})
    if not patrol:
        return PatrolTrailResponse(patrol_id=patrol_id, points=[], total_distance=0.0)

    now_bd = datetime.now(timezone.utc) + timedelta(hours=6)
    today_session = now_bd.strftime("%Y-%m-%d")
    target_session = date or patrol.get("session_date") or today_session

    locations = []
    for pt in patrol.get("trail", []) or []:
        try:
            point_session = pt.get("session_date", patrol.get("session_date"))
            if point_session == target_session or not pt.get("session_date"):
                locations.append(
                    {
                        "latitude": pt.get("lat"),
                        "longitude": pt.get("lng"),
                        "timestamp": pt.get("timestamp", ""),
                    }
                )
        except Exception:
            continue

    # If requesting history and no trail in patrol doc, try archived sessions
    if not locations and date:
        archived = await db.patrol_sessions.find_one(
            {"patrol_id": patrol_id, "session_date": date},
            {"_id": 0, "archived_trail": 1},
        )
        if archived and archived.get("archived_trail"):
            for pt in archived["archived_trail"]:
                locations.append(
                    {
                        "latitude": pt.get("lat"),
                        "longitude": pt.get("lng"),
                        "timestamp": pt.get("timestamp", ""),
                    }
                )

    points: List[TrailPoint] = []
    for loc in locations:
        try:
            ts = loc.get("timestamp")
            ts_dt = datetime.fromisoformat(ts.replace("Z", "+00:00")) if isinstance(ts, str) and ts else None
            if ts_dt is None:
                ts_dt = datetime.now(timezone.utc)
            points.append(TrailPoint(latitude=loc["latitude"], longitude=loc["longitude"], timestamp=ts_dt))
        except Exception:
            continue

    total_distance = 0.0
    for i in range(1, len(points)):
        lat1, lon1 = points[i - 1].latitude, points[i - 1].longitude
        lat2, lon2 = points[i].latitude, points[i].longitude
        total_distance += ((lat2 - lat1) ** 2 + (lon2 - lon1) ** 2) ** 0.5 * 111

    return PatrolTrailResponse(patrol_id=patrol_id, points=points, total_distance=round(total_distance, 2))


# Public endpoint (Patrol Commander)
@api_router.get("/patrol/{patrol_id}")
async def get_patrol_public(patrol_id: str):
    db = get_db()
    patrol = await db.patrols.find_one({"id": patrol_id}, {"_id": 0})
    if not patrol:
        raise HTTPException(status_code=404, detail="Patrol not found")
    patrol["status"] = derive_patrol_status(patrol)
    return patrol


# -------------------------
# Access code routes
# -------------------------
@api_router.post("/codes/generate")
async def generate_access_code(patrol_id: str, email: str):
    db = get_db()
    patrol = await db.patrols.find_one({"id": patrol_id})
    if not patrol:
        raise HTTPException(status_code=404, detail="Patrol not found")

    code = str(uuid.uuid4().int)[:6]

    # Expiry at 00:01 next day UTC (you can change to BD if needed)
    now = datetime.now(timezone.utc)
    tomorrow = now.replace(hour=0, minute=1, second=0, microsecond=0) + timedelta(days=1)

    access_code = {
        "code": code,
        "patrol_id": patrol_id,
        "email": email,
        "created_at": now.isoformat(),
        "expires_at": tomorrow.isoformat(),
        "is_used": False,
        "session_active": True,
        "last_activity": now.isoformat(),
    }

    await db.access_codes.insert_one(access_code)
    return {
        "code": code,
        "patrol_id": patrol_id,
        "patrol_name": patrol.get("name"),
        "expires_at": access_code["expires_at"],
        "session_expires": tomorrow.isoformat(),
    }


@api_router.post("/codes/verify")
async def verify_access_code(verification: CodeVerification):
    db = get_db()
    code_doc = await db.access_codes.find_one({"code": verification.code, "email": verification.email})
    if not code_doc:
        raise HTTPException(status_code=404, detail="Invalid code or email")

    expires_at = datetime.fromisoformat(code_doc["expires_at"])
    now = datetime.now(timezone.utc)
    if now > expires_at:
        raise HTTPException(status_code=400, detail="Session has expired. Please request a new code.")

    await db.access_codes.update_one(
        {"code": verification.code},
        {"$set": {"last_activity": now.isoformat(), "session_active": True}},
    )

    await db.patrol_sessions.update_one(
        {"patrol_id": code_doc["patrol_id"], "session_date": now.strftime("%Y-%m-%d")},
        {
            "$set": {"last_activity": now.isoformat(), "status": "active"},
            "$setOnInsert": {
                "session_start": now.isoformat(),
                "patrol_id": code_doc["patrol_id"],
                "hq_id": code_doc.get("hq_id", "SUPER_ADMIN"),
            },
        },
        upsert=True,
    )

    patrol = await db.patrols.find_one({"id": code_doc["patrol_id"]}, {"_id": 0})

    await db.patrols.update_one({"id": code_doc["patrol_id"]}, {"$set": {"is_tracking": True, "status": "active"}})

    return {"valid": True, "patrol": patrol, "session_expires": expires_at.isoformat(), "can_continue": True}


@api_router.post("/verify-code")
async def verify_patrol_code(data: dict):
    db = get_db()

    patrol_id = data.get("patrol_id")
    code = sanitize_input(data.get("code", "")).upper().strip()

    if not patrol_id or not code:
        return {"verified": False, "message": "Patrol ID and code are required"}

    code_doc = await db.access_codes.find_one({"patrol_id": patrol_id, "code": code})
    if not code_doc:
        return {"verified": False, "message": "Invalid code. Please contact HQ for the correct code."}

    expires_at = datetime.fromisoformat(code_doc["expires_at"])
    now_utc = datetime.now(timezone.utc)
    if now_utc > expires_at:
        return {"verified": False, "message": "Code has expired. Please request a new code from HQ."}

    now_bd = now_utc + timedelta(hours=6)
    session_date = now_bd.strftime("%Y-%m-%d")

    patrol = await db.patrols.find_one({"id": patrol_id}, {"_id": 0, "session_date": 1, "trail": 1})
    current_session_date = (patrol or {}).get("session_date")

    should_clear_trail = bool(current_session_date and current_session_date != session_date)

    await db.access_codes.update_one(
        {"code": code, "patrol_id": patrol_id},
        {
            "$set": {
                "verified_at": now_utc.isoformat(),
                "session_active": True,
                "session_date": session_date,
                "last_activity": now_utc.isoformat(),
            }
        },
    )

    update_data = {
        "code_verified": True,
        "is_tracking": True,
        "status": "active",
        "verified_at": now_utc.isoformat(),
        "session_date": session_date,
        "session_start": now_utc.isoformat(),
        "tracking_stopped": False,
    }

    if should_clear_trail:
        if patrol and patrol.get("trail"):
            await db.patrol_sessions.update_one(
                {"patrol_id": patrol_id, "session_date": current_session_date},
                {"$set": {"archived_trail": patrol.get("trail"), "archived_at": now_utc.isoformat()}},
                upsert=True,
            )
        update_data["trail"] = []

    await db.patrols.update_one({"id": patrol_id}, {"$set": update_data})

    return {
        "verified": True,
        "message": "Code verified successfully. You can now start tracking.",
        "session_date": session_date,
        "session_expires": expires_at.isoformat(),
    }


@api_router.post("/codes/end-session")
async def end_patrol_session(patrol_id: str):
    """
    Stop live tracking for a patrol.
    - Stops live tracking immediately
    - Trail remains visible until session ends
    """
    db = get_db()
    now_utc = datetime.now(timezone.utc)

    patrol = await db.patrols.find_one(
        {"id": patrol_id},
        {"_id": 0, "session_date": 1, "latitude": 1, "longitude": 1, "trail": 1},
    )
    if not patrol:
        return {"success": False, "message": "Patrol not found"}

    trail = patrol.get("trail", []) or []
    trail_distance = 0.0
    if len(trail) > 1:
        for i in range(1, len(trail)):
            lat1, lon1 = trail[i - 1].get("lat", 0), trail[i - 1].get("lng", 0)
            lat2, lon2 = trail[i].get("lat", 0), trail[i].get("lng", 0)
            trail_distance += ((lat2 - lat1) ** 2 + (lon2 - lon1) ** 2) ** 0.5 * 111

    await db.patrols.update_one(
        {"id": patrol_id},
        {
            "$set": {
                "is_tracking": False,
                "tracking_stopped": True,
                "tracking_stopped_at": now_utc.isoformat(),
                "finished_stats": {
                    "trail_points": len(trail),
                    "trail_distance_km": round(trail_distance, 2),
                    "stopped_at": now_utc.isoformat(),
                },
            }
        },
    )

    return {
        "success": True,
        "message": "Tracking stopped. Trail remains visible until end of session.",
        "stats": {"trail_points": len(trail), "trail_distance_km": round(trail_distance, 2)},
    }


# -------------------------
# Soldier routes
# -------------------------
@api_router.post("/soldiers/upload")
async def upload_soldiers_pdf(file: UploadFile = File(...)):
    db = get_db()
    try:
        content = await file.read()
        pdf_reader = PdfReader(io.BytesIO(content))

        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() or ""

        emails = re.findall(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", text)

        soldiers_added = 0
        for email in emails:
            soldier_id = str(uuid.uuid4())[:8].upper()
            soldier = {
                "id": soldier_id,
                "name": email.split("@")[0].replace(".", " ").title(),
                "email": email,
                "rank": "Soldier",
                "unit": "BD Army 10 Div",
            }
            exists = await db.soldiers.find_one({"email": email})
            if not exists:
                await db.soldiers.insert_one(soldier)
                soldiers_added += 1

        return {"success": True, "soldiers_added": soldiers_added, "emails_found": len(emails)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing PDF: {str(e)}")


@api_router.get("/soldiers", response_model=List[Soldier])
async def get_all_soldiers():
    db = get_db()
    return await db.soldiers.find({}, {"_id": 0}).to_list(500)


# -------------------------
# SOS routes
# -------------------------
@api_router.post("/sos/alert")
async def create_sos_alert(alert_data: dict):
    db = get_db()

    alert = {
        "patrol_id": alert_data.get("patrol_id"),
        "latitude": alert_data.get("latitude"),
        "longitude": alert_data.get("longitude"),
        "message": alert_data.get("message", "EMERGENCY - SOS ALERT"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "resolved": False,
        "auto_triggered": alert_data.get("auto_triggered", False),
    }

    patrol = await db.patrols.find_one({"id": alert_data.get("patrol_id")}, {"hq_id": 1})
    if patrol:
        alert["hq_id"] = patrol.get("hq_id")

    await db.sos_alerts.insert_one(alert)
    alert.pop("_id", None)

    await db.patrols.update_one({"id": alert_data.get("patrol_id")}, {"$set": {"status": "sos"}})
    return {"success": True, "alert": alert}


@api_router.get("/sos", response_model=List[SOSAlert])
async def get_sos_alerts(resolved: bool = False):
    db = get_db()
    alerts = await db.sos_alerts.find({"resolved": resolved}, {"_id": 0}).sort("timestamp", -1).to_list(100)
    return alerts


@api_router.post("/sos/resolve/{patrol_id}")
async def resolve_sos_alert(patrol_id: str):
    db = get_db()

    result = await db.sos_alerts.update_many(
        {"patrol_id": patrol_id, "resolved": False},
        {"$set": {"resolved": True, "resolved_at": datetime.now(timezone.utc).isoformat()}},
    )

    await db.patrols.update_one({"id": patrol_id}, {"$set": {"status": "active"}})

    patrol = await db.patrols.find_one({"id": patrol_id}, {"_id": 0, "hq_id": 1})
    if patrol:
        hq_id = patrol.get("hq_id")
        for client_id, ws_data in list(connected_clients.items()):
            if str(client_id).startswith(str(hq_id)):
                try:
                    await ws_data["ws"].send_json({"type": "sos_resolved", "patrol_id": patrol_id})
                except Exception:
                    pass

    return {"success": True, "resolved_count": result.modified_count}


# -------------------------
# HQ Auth
# -------------------------
@api_router.post("/hq/register", response_model=HQResponse)
async def register_hq(hq_data: HQCreate):
    db = get_db()

    existing = await db.hq_users.find_one({"username": hq_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    ok, message = validate_password_strength(hq_data.password)
    if not ok:
        raise HTTPException(status_code=400, detail=message)

    hq_id = str(uuid.uuid4())[:8].upper()
    hashed_password = hash_password(hq_data.password)

    hq_doc = {
        "hq_id": hq_id,
        "username": sanitize_input(hq_data.username),
        "password": hashed_password,
        "hq_name": sanitize_input(hq_data.hq_name),
        "location": sanitize_input(hq_data.location) if getattr(hq_data, "location", None) else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.hq_users.insert_one(hq_doc)

    hq_doc.pop("_id", None)
    hq_doc.pop("password", None)

    log_security_event("hq_created", {"hq_id": hq_id, "username": hq_data.username})
    return HQResponse(**hq_doc)


@api_router.post("/hq/login")
@limiter.limit("5/minute")
async def hq_login(request: Request, login: HQLogin):
    db = get_db()
    username = sanitize_input(login.username)

    is_locked, remaining_minutes = is_account_locked(username)
    if is_locked:
        log_security_event("login_blocked", {"username": username, "reason": "account_locked"}, request)
        raise HTTPException(status_code=429, detail=f"Account temporarily locked. Try again in {remaining_minutes} minutes.")

    hq = await db.hq_users.find_one({"username": username})

    if not hq or not verify_password(login.password, hq.get("password", "")):
        record_failed_login(username)
        remaining = get_remaining_attempts(username)
        log_security_event("login_failed", {"username": username, "remaining_attempts": remaining}, request)
        if remaining > 0:
            raise HTTPException(status_code=401, detail=f"Invalid credentials. {remaining} attempts remaining.")
        raise HTTPException(status_code=401, detail="Invalid credentials. Account locked.")

    clear_failed_attempts(username)

    is_super_admin = hq.get("is_super_admin", False)

    subscription = hq.get("subscription", {})
    if not is_super_admin and subscription:
        expires_at = subscription.get("expires_at")
        if expires_at:
            expiry = datetime.fromisoformat(expires_at) if isinstance(expires_at, str) else expires_at
            if datetime.now(timezone.utc) > expiry:
                subscription["status"] = "expired"

    token_data = {"hq_id": hq["hq_id"], "username": username, "is_super_admin": is_super_admin}
    access_token = create_access_token(token_data)

    log_security_event("login_success", {"username": username, "hq_id": hq["hq_id"]}, request)

    return {
        "success": True,
        "token": access_token,
        "hq_id": hq["hq_id"],
        "hq_name": hq.get("hq_name", ""),
        "hq_logo": hq.get("logo", ""),
        "role": "super_admin" if is_super_admin else "hq_admin",
        "is_super_admin": is_super_admin,
        "subscription": subscription,
    }


# -------------------------
# Inactivity config/check (auto SOS)
# -------------------------
@api_router.post("/inactivity/config")
async def set_inactivity_config(config: InactivityConfig):
    db = get_db()
    await db.hq_users.update_one(
        {"hq_id": config.hq_id},
        {"$set": {"inactivity_config": {"enabled": config.enabled, "threshold_minutes": config.threshold_minutes}}},
    )
    return {"success": True}


@api_router.get("/inactivity/config/{hq_id}")
async def get_inactivity_config(hq_id: str):
    db = get_db()
    hq = await db.hq_users.find_one({"hq_id": hq_id}, {"_id": 0, "inactivity_config": 1})
    if not hq or not hq.get("inactivity_config"):
        return {"enabled": True, "threshold_minutes": 30}
    return hq["inactivity_config"]


@api_router.get("/inactivity/check")
async def check_patrol_inactivity(hq_id: str):
    db = get_db()

    hq = await db.hq_users.find_one({"hq_id": hq_id}, {"_id": 0, "inactivity_config": 1})
    config = (hq or {}).get("inactivity_config", {"enabled": True, "threshold_minutes": 30})

    if not config.get("enabled", True):
        return {"auto_sos_triggered": [], "inactive_patrols": [], "config": config}

    threshold_minutes = int(config.get("threshold_minutes", 30))
    threshold_time = datetime.now(timezone.utc) - timedelta(minutes=threshold_minutes)

    query = {
        "hq_id": hq_id,
        "is_tracking": True,
        "status": {"$nin": ["sos", "finished", "inactive"]},
    }

    tracking_patrols = await db.patrols.find(query, {"_id": 0}).to_list(500)

    inactive_patrols = []
    auto_sos_triggered = []

    for patrol in tracking_patrols:
        last_update = patrol.get("last_update")
        if isinstance(last_update, str):
            try:
                last_update_dt = datetime.fromisoformat(last_update.replace("Z", "+00:00"))
            except Exception:
                continue
        else:
            last_update_dt = last_update

        if last_update_dt and last_update_dt < threshold_time:
            inactive_minutes = int((datetime.now(timezone.utc) - last_update_dt).total_seconds() / 60)

            inactive_patrols.append(
                {
                    "patrol_id": patrol["id"],
                    "patrol_name": patrol.get("name"),
                    "last_update": patrol.get("last_update"),
                    "inactive_minutes": inactive_minutes,
                }
            )

            existing_sos = await db.sos_alerts.find_one(
                {"patrol_id": patrol["id"], "auto_triggered": True, "resolved": False}
            )

            if not existing_sos:
                sos_doc = {
                    "patrol_id": patrol["id"],
                    "hq_id": hq_id,
                    "message": f"AUTO SOS: No movement detected for {inactive_minutes} minutes",
                    "latitude": patrol.get("latitude", 0),
                    "longitude": patrol.get("longitude", 0),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "resolved": False,
                    "auto_triggered": True,
                }

                await db.sos_alerts.insert_one(sos_doc)
                await db.patrols.update_one({"id": patrol["id"]}, {"$set": {"status": "sos"}})

                auto_sos_triggered.append(
                    {
                        "patrol_id": patrol["id"],
                        "patrol_name": patrol.get("name"),
                        "inactive_minutes": inactive_minutes,
                    }
                )

                for client_id, ws_data in list(connected_clients.items()):
                    if str(client_id).startswith(str(hq_id)):
                        try:
                            await ws_data["ws"].send_json(
                                {
                                    "type": "sos_alert",
                                    "data": {
                                        "patrol_id": patrol["id"],
                                        "patrol_name": patrol.get("name"),
                                        "message": sos_doc["message"],
                                        "latitude": sos_doc["latitude"],
                                        "longitude": sos_doc["longitude"],
                                        "timestamp": sos_doc["timestamp"],
                                        "auto_triggered": True,
                                    },
                                }
                            )
                        except Exception:
                            pass

    return {"auto_sos_triggered": auto_sos_triggered, "inactive_patrols": inactive_patrols, "config": config}


# -------------------------
# Health/Root + router include
# -------------------------
app.include_router(api_router)


@app.get("/")
async def root():
    return {"message": "Military Patrol Tracking API"}


@app.get("/health")
async def health_check():
    return {"status": "operational", "mqtt_enabled": MQTT_ENABLED, "websocket_clients": len(connected_clients)}


logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
