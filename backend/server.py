from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import os
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
import uuid
from typing import List, Dict, Optional, Set
import qrcode
import io
import base64
from PyPDF2 import PdfReader
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from database import init_db, close_db, get_db
from models import (
    PatrolCreate, PatrolUpdate, PatrolResponse, PatrolTrailResponse,
    TrailPoint, AccessCode, CodeVerification, HQLogin, HQCreate, HQResponse, HQLoginResponse, SOSAlert,
    Soldier, PatrolStatus, MessageCreate, MessageResponse, MessageType, InactivityConfig
)
from security import (
    hash_password, verify_password, validate_password_strength,
    create_access_token, verify_token, decode_token,
    sanitize_input, sanitize_dict, validate_email, validate_patrol_id, validate_coordinates,
    record_failed_login, clear_failed_attempts, is_account_locked, get_remaining_attempts,
    log_security_event, SECURITY_HEADERS, JWTBearer
)

ROOT_DIR = Path(__file__).parent
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Rate Limiter
limiter = Limiter(key_func=get_remote_address)

# MQTT Configuration
MQTT_ENABLED = os.environ.get('MQTT_ENABLED', 'false').lower() == 'true'

# Subscription plan limits
SUBSCRIPTION_PLANS = {
    'trial': {
        'duration_hours': 48,
        'max_patrols': 3,
        'max_tracking': 3,
        'session_duration_min': 30,
        'trail_history_hours': 6,
        'price': 0
    },
    'normal': {
        'duration_hours': 30 * 24,  # 30 days
        'max_patrols': 50,
        'max_tracking': 25,
        'session_duration_min': 720,  # 12 hours
        'trail_history_hours': 24,
        'price': 25
    },
    'pro': {
        'duration_hours': 365 * 24,  # 1 year
        'max_patrols': 300,
        'max_tracking': 300,
        'session_duration_min': 1440,  # 24 hours
        'trail_history_hours': 168,  # 7 days
        'price': 50
    }
}

# WebSocket connection manager
connected_clients: Dict[str, WebSocket] = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
    await init_db()
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
    
    yield
    
    # Stop MQTT bridge
    if MQTT_ENABLED:
        try:
            from mqtt_bridge import stop_mqtt_bridge
            stop_mqtt_bridge()
        except:
            pass
    
    await close_db()

app = FastAPI(
    title="Military Patrol Tracking API",
    description="Real-time patrol tracking system - Powered by BA-8993 Major Wahid",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if os.environ.get('ENABLE_DOCS', 'true').lower() == 'true' else None,
    redoc_url="/api/redoc" if os.environ.get('ENABLE_DOCS', 'true').lower() == 'true' else None
)

# Add rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
    # Log potentially suspicious requests
    path = request.url.path
    if any(pattern in path.lower() for pattern in ['admin', 'login', 'password', 'token']):
        log_security_event("api_access", {
            "path": path,
            "method": request.method
        }, request)
    response = await call_next(request)
    return response

api_router = APIRouter(prefix="/api")

# WebSocket endpoint
@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    # Allow HQ IDs and patrol IDs - basic alphanumeric validation
    if not client_id or not re.match(r'^[a-zA-Z0-9_-]+$', client_id):
        await websocket.close(code=4001, reason="Invalid client ID format")
        return
    await websocket.accept()
    connected_clients[client_id] = {'ws': websocket, 'connected_at': datetime.now(timezone.utc)}
    print(f"WebSocket client connected: {client_id}")
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get('type') == 'location_update':
                patrol_id = data.get('patrol_id')
                latitude = data.get('latitude')
                longitude = data.get('longitude')
                now_utc = datetime.now(timezone.utc)
                timestamp = now_utc.isoformat()
                
                # Calculate session date using Bangladesh timezone (UTC+6)
                BD_OFFSET = timedelta(hours=6)
                now_bd = now_utc + BD_OFFSET
                session_date = now_bd.strftime('%Y-%m-%d')
                
                db = get_db()
                
                # Get patrol's current session info
                patrol = await db.patrols.find_one({'id': patrol_id}, {'session_date': 1})
                patrol_session_date = patrol.get('session_date') if patrol else session_date
                
                # Update patrol location and add trail point
                await db.patrols.update_one(
                    {'id': patrol_id},
                    {
                        '$set': {
                            'latitude': latitude,
                            'longitude': longitude,
                            'last_update': timestamp,
                            'last_location_time': timestamp,
                            'is_tracking': True,
                            'tracking_stopped': False,
                            'session_date': patrol_session_date or session_date
                        },
                        '$push': {
                            'trail': {
                                '$each': [{
                                    'lat': latitude, 
                                    'lng': longitude, 
                                    'timestamp': timestamp, 
                                    'session_date': patrol_session_date or session_date
                                }],
                                '$slice': -5000
                            }
                        }
                    }
                )
                
                # Also store in locations collection for historical data
                await db.locations.insert_one({
                    'patrol_id': patrol_id,
                    'location': {
                        'type': 'Point',
                        'coordinates': [longitude, latitude]
                    },
                    'latitude': latitude,
                    'longitude': longitude,
                    'timestamp': timestamp,
                    'accuracy': data.get('accuracy'),
                    'session_date': patrol_session_date or session_date
                })
                
                # Broadcast to all clients
                for cid, client_info in list(connected_clients.items()):
                    try:
                        await client_info['ws'].send_json({
                            'type': 'patrol_location',
                            'patrol_id': patrol_id,
                            'latitude': latitude,
                            'longitude': longitude,
                            'timestamp': timestamp
                        })
                    except Exception as e:
                        print(f"WS broadcast error: {e}")
                        
            elif data.get('type') == 'sos_alert':
                patrol_id = data.get('patrol_id')
                latitude = data.get('latitude')
                longitude = data.get('longitude')
                message = data.get('message', 'EMERGENCY - SOS ALERT')
                
                db = get_db()
                alert = {
                    'patrol_id': patrol_id,
                    'latitude': latitude,
                    'longitude': longitude,
                    'message': message,
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'resolved': False
                }
                
                await db.sos_alerts.insert_one(alert)
                await db.patrols.update_one(
                    {'id': patrol_id},
                    {'$set': {'status': 'sos'}}
                )
                
                # Broadcast to all clients
                for cid, client_info in list(connected_clients.items()):
                    try:
                        await client_info['ws'].send_json({
                            'type': 'sos_alert',
                            **alert
                        })
                    except:
                        pass
                        
    except WebSocketDisconnect:
        print(f"WebSocket client disconnected: {client_id}")
        connected_clients.pop(client_id, None)
    except Exception as e:
        print(f"WebSocket error for {client_id}: {e}")
        connected_clients.pop(client_id, None)

# Subscription enforcement helper
async def check_subscription(db, hq_id: str, action: str = 'access'):
    """
    Check if HQ has valid subscription and can perform the action.
    Returns (is_valid, error_message, subscription_info)
    """
    if hq_id == 'SUPER_ADMIN':
        return True, None, {'plan': 'pro', 'status': 'active'}
    
    hq = await db.hq_users.find_one({'hq_id': hq_id})
    if not hq:
        return False, 'HQ not found', None
    
    subscription = hq.get('subscription', {})
    if not subscription:
        return False, 'No subscription', None
    
    # Check expiry
    expires_at = subscription.get('expires_at')
    if expires_at:
        expiry = datetime.fromisoformat(expires_at) if isinstance(expires_at, str) else expires_at
        if datetime.now(timezone.utc) > expiry:
            return False, 'Subscription expired. Contact endora.dream@gmail.com to renew.', subscription
    
    return True, None, subscription

async def check_patrol_limit(db, hq_id: str):
    """Check if HQ can create more patrols based on subscription"""
    if hq_id == 'SUPER_ADMIN':
        return True, None, 999
    
    hq = await db.hq_users.find_one({'hq_id': hq_id})
    if not hq:
        return False, 'HQ not found', 0
    
    subscription = hq.get('subscription', {})
    limits = subscription.get('limits', SUBSCRIPTION_PLANS['trial'])
    max_patrols = limits.get('max_patrols', 3)
    
    current_count = await db.patrols.count_documents({'hq_id': hq_id})
    
    if current_count >= max_patrols:
        plan = subscription.get('plan', 'trial')
        return False, f'Patrol limit reached ({current_count}/{max_patrols}). Upgrade your {plan} plan to add more.', max_patrols
    
    return True, None, max_patrols - current_count

async def check_tracking_limit(db, hq_id: str):
    """Check if HQ can start more tracking sessions based on subscription"""
    if hq_id == 'SUPER_ADMIN':
        return True, None, 999
    
    hq = await db.hq_users.find_one({'hq_id': hq_id})
    if not hq:
        return False, 'HQ not found', 0
    
    subscription = hq.get('subscription', {})
    limits = subscription.get('limits', SUBSCRIPTION_PLANS['trial'])
    max_tracking = limits.get('max_tracking', 3)
    
    current_tracking = await db.patrols.count_documents({'hq_id': hq_id, 'is_tracking': True})
    
    if current_tracking >= max_tracking:
        plan = subscription.get('plan', 'trial')
        return False, f'Active tracking limit reached ({current_tracking}/{max_tracking}). Upgrade your {plan} plan.', max_tracking
    
    return True, None, max_tracking - current_tracking

# Patrol Routes
@api_router.post("/patrols", response_model=PatrolResponse)
async def create_patrol(patrol: PatrolCreate):
    db = get_db()
    
    # Check subscription
    is_valid, error, _ = await check_subscription(db, patrol.hq_id)
    if not is_valid:
        raise HTTPException(status_code=403, detail=error)
    
    # Check patrol limit
    can_create, error, remaining = await check_patrol_limit(db, patrol.hq_id)
    if not can_create:
        raise HTTPException(status_code=403, detail=error)
    
    patrol_id = str(uuid.uuid4())[:8].upper()
    
    patrol_doc = {
        'id': patrol_id,
        'name': patrol.name,
        'camp_name': patrol.camp_name,
        'unit': patrol.unit,
        'leader_email': patrol.leader_email,
        'phone_number': patrol.phone_number,  # Store mobile number
        'assigned_area': patrol.assigned_area,
        'soldier_ids': patrol.soldier_ids,
        'soldier_count': len(patrol.soldier_ids),
        'latitude': 0.0,
        'longitude': 0.0,
        'status': 'inactive',
        'last_update': datetime.now(timezone.utc).isoformat(),
        'is_tracking': False,
        'hq_id': patrol.hq_id  # Associate with HQ
    }
    
    await db.patrols.insert_one(patrol_doc)
    return PatrolResponse(**{k: v for k, v in patrol_doc.items() if k != '_id'})


def derive_patrol_status(patrol: dict) -> str:
    """
    Derive patrol status based on tracking state and timing.
    
    Priority:
    1. SOS active → 'sos' (flashing red)
    2. session_date ≠ today → 'completed' (grey)
    3. tracking_stopped=True → 'stopped' (blue)
    4. last_location_time ≤2 min ago → 'active' (green)
    5. 2-15 min ago → 'paused' (orange)
    6. >15 min or no location → 'offline' (red)
    """
    from datetime import datetime, timezone, timedelta
    
    # Check SOS first
    if patrol.get('status') == 'sos':
        return 'sos'
    
    # Get today's date in BD timezone
    BD_OFFSET = timedelta(hours=6)
    now_utc = datetime.now(timezone.utc)
    now_bd = now_utc + BD_OFFSET
    today = now_bd.strftime('%Y-%m-%d')
    
    # Check if completed (different day)
    session_date = patrol.get('session_date', '')
    if session_date and session_date != today:
        return 'completed'
    
    # Check if stopped
    if patrol.get('tracking_stopped'):
        return 'stopped'
    
    # Check timing since last location
    last_location_time = patrol.get('last_location_time')
    if not last_location_time:
        return 'offline'
    
    try:
        if isinstance(last_location_time, str):
            last_time = datetime.fromisoformat(last_location_time.replace('Z', '+00:00'))
        else:
            last_time = last_location_time
        
        elapsed = (now_utc - last_time).total_seconds()
        
        if elapsed <= 120:  # ≤2 min
            return 'active'
        elif elapsed <= 900:  # 2-15 min
            return 'paused'
        else:
            return 'offline'
    except:
        return 'offline'


@api_router.get("/patrols", response_model=List[PatrolResponse])
async def get_all_patrols(
    hq_id: str, 
    status: str = None,
    search: str = None,
    camp_name: str = None,
    unit: str = None
):
    db = get_db()
    
    # Check subscription (don't block super admin)
    if hq_id != 'SUPER_ADMIN':
        is_valid, error, _ = await check_subscription(db, hq_id)
        if not is_valid:
            raise HTTPException(status_code=403, detail=error)
    
    # Super admin can see all patrols
    if hq_id == 'SUPER_ADMIN':
        query = {}
    else:
        query = {'hq_id': hq_id}  # Filter by HQ
    
    # Add filters
    if status:
        query['status'] = status
    
    if camp_name:
        query['camp_name'] = camp_name
    
    if unit:
        query['unit'] = unit
    
    # Add search across multiple fields
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'camp_name': {'$regex': search, '$options': 'i'}},
            {'unit': {'$regex': search, '$options': 'i'}},
            {'assigned_area': {'$regex': search, '$options': 'i'}},
            {'id': {'$regex': search, '$options': 'i'}},
            {'leader_email': {'$regex': search, '$options': 'i'}}
        ]
    
    patrols = await db.patrols.find(query, {'_id': 0}).to_list(500)
    
    for patrol in patrols:
        if isinstance(patrol.get('last_update'), str):
            patrol['last_update'] = datetime.fromisoformat(patrol['last_update'])
        # Derive and set status dynamically
        patrol['status'] = derive_patrol_status(patrol)
    
    return patrols

@api_router.get("/patrols/filters/options")
async def get_filter_options(hq_id: str):
    """Get distinct values for filters"""
    db = get_db()
    
    query = {} if hq_id == 'SUPER_ADMIN' else {'hq_id': hq_id}
    
    camps = await db.patrols.distinct('camp_name', query)
    units = await db.patrols.distinct('unit', query)
    
    return {
        'camps': sorted([c for c in camps if c]),
        'units': sorted([u for u in units if u])
    }

@api_router.get("/patrols/history")
async def get_patrol_history(hq_id: str, date: str = None):
    """
    Get patrol session history for a specific date (24-hour session).
    
    Returns all patrols that were active during the specified date,
    including their trails, stats, and status.
    """
    db = get_db()
    
    # Parse the date or use today
    now = datetime.now(timezone.utc)
    if date:
        try:
            session_date = date
        except:
            session_date = now.strftime('%Y-%m-%d')
    else:
        if now.hour == 0 and now.minute < 1:
            session_date = (now - timedelta(days=1)).strftime('%Y-%m-%d')
        else:
            session_date = now.strftime('%Y-%m-%d')
    
    query = {} if hq_id == 'SUPER_ADMIN' else {'hq_id': hq_id}
    
    # Get all patrols that have data for this session date
    patrols_with_trails = await db.patrols.find(
        {**query, 'session_date': session_date},
        {'_id': 0, 'id': 1, 'name': 1, 'assigned_area': 1, 'status': 1, 'trail': 1, 
         'session_date': 1, 'finished_stats': 1, 'latitude': 1, 'longitude': 1}
    ).to_list(500)
    
    history = []
    for patrol in patrols_with_trails:
        # Count trail points for this session
        trail = patrol.get('trail', [])
        session_trail = [pt for pt in trail if pt.get('session_date') == session_date]
        
        # Calculate distance
        trail_distance = 0.0
        if len(session_trail) > 1:
            for i in range(1, len(session_trail)):
                lat1, lon1 = session_trail[i-1].get('lat', 0), session_trail[i-1].get('lng', 0)
                lat2, lon2 = session_trail[i].get('lat', 0), session_trail[i].get('lng', 0)
                trail_distance += ((lat2 - lat1)**2 + (lon2 - lon1)**2)**0.5 * 111
        
        history.append({
            'patrol_id': patrol['id'],
            'patrol_name': patrol.get('name', ''),
            'assigned_area': patrol.get('assigned_area', ''),
            'status': patrol.get('status', 'inactive'),
            'session_date': session_date,
            'trail_points': len(session_trail),
            'trail_distance_km': round(trail_distance, 2),
            'last_location': {
                'lat': patrol.get('latitude', 0),
                'lng': patrol.get('longitude', 0)
            },
            'finished_stats': patrol.get('finished_stats')
        })
    
    # Also check patrol_sessions collection for additional data
    sessions = await db.patrol_sessions.find(
        {**query, 'session_date': session_date},
        {'_id': 0}
    ).to_list(500)
    
    # Merge session data if not already in history
    existing_ids = {h['patrol_id'] for h in history}
    for session in sessions:
        if session.get('patrol_id') not in existing_ids:
            history.append({
                'patrol_id': session.get('patrol_id'),
                'patrol_name': session.get('patrol_name', ''),
                'session_date': session_date,
                'status': session.get('status', 'unknown'),
                'patrol_instances': session.get('patrol_instances', []),
                'finished_instances': session.get('finished_instances', [])
            })
    
    return {
        'session_date': session_date,
        'total_patrols': len(history),
        'patrols': history
    }

@api_router.get("/patrols/{patrol_id}", response_model=PatrolResponse)
async def get_patrol(patrol_id: str, hq_id: str):
    db = get_db()
    patrol = await db.patrols.find_one({'id': patrol_id, 'hq_id': hq_id}, {'_id': 0})
    if not patrol:
        raise HTTPException(status_code=404, detail="Patrol not found")
    
    if isinstance(patrol.get('last_update'), str):
        patrol['last_update'] = datetime.fromisoformat(patrol['last_update'])
    
    return patrol

@api_router.patch("/patrols/{patrol_id}", response_model=PatrolResponse)
async def update_patrol(patrol_id: str, update: PatrolUpdate):
    db = get_db()
    
    update_data = {
        'latitude': update.latitude,
        'longitude': update.longitude,
        'last_update': datetime.now(timezone.utc).isoformat()
    }
    
    if update.status:
        update_data['status'] = update.status
    
    result = await db.patrols.find_one_and_update(
        {'id': patrol_id},
        {'$set': update_data},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Patrol not found")
    
    # Save to location history
    await db.locations.insert_one({
        'patrol_id': patrol_id,
        'location': {
            'type': 'Point',
            'coordinates': [update.longitude, update.latitude]
        },
        'latitude': update.latitude,
        'longitude': update.longitude,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'accuracy': update.accuracy
    })
    
    result.pop('_id', None)
    if isinstance(result.get('last_update'), str):
        result['last_update'] = datetime.fromisoformat(result['last_update'])
    
    return result

@api_router.put("/patrols/{patrol_id}/details")
async def update_patrol_details(patrol_id: str, patrol_data: dict):
    db = get_db()
    
    update_fields = {}
    allowed_fields = ['name', 'camp_name', 'unit', 'leader_email', 'assigned_area', 'status']
    
    for field in allowed_fields:
        if field in patrol_data:
            update_fields[field] = patrol_data[field]
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    update_fields['last_update'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.patrols.find_one_and_update(
        {'id': patrol_id},
        {'$set': update_fields},
        return_document=True
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Patrol not found")
    
    result.pop('_id', None)
    if isinstance(result.get('last_update'), str):
        result['last_update'] = datetime.fromisoformat(result['last_update'])
    
    return result

@api_router.delete("/patrols/{patrol_id}")
async def delete_patrol(patrol_id: str, hq_id: str):
    db = get_db()
    
    # Verify patrol belongs to HQ (unless super admin)
    query = {'id': patrol_id}
    if hq_id != 'SUPER_ADMIN':
        query['hq_id'] = hq_id
    
    patrol = await db.patrols.find_one(query)
    if not patrol:
        raise HTTPException(status_code=404, detail="Patrol not found or access denied")
    
    # Delete patrol and related data
    await db.patrols.delete_one({'id': patrol_id})
    await db.locations.delete_many({'patrol_id': patrol_id})
    await db.trails.delete_many({'patrol_id': patrol_id})
    await db.access_codes.delete_many({'patrol_id': patrol_id})
    await db.sos_alerts.update_many(
        {'patrol_id': patrol_id},
        {'$set': {'resolved': True}}
    )
    
    return {'success': True, 'message': 'Patrol deleted successfully'}

@api_router.get("/patrols/trails/all")
async def get_all_patrol_trails(hq_id: str, date: str = None):
    """
    Get trails for all patrols in current session (0000-2359 hrs BD time).
    
    Session Policy:
    - Shows all patrols active during today's session
    - Includes stopped patrols (trail visible until 2359)
    - Multiple patrols same day shown with accumulated trails
    """
    db = get_db()
    
    # Determine session date (BD timezone)
    BD_OFFSET = timedelta(hours=6)
    now_bd = datetime.now(timezone.utc) + BD_OFFSET
    session_date = date or now_bd.strftime('%Y-%m-%d')
    
    # Get all patrols for this session (active, tracking, or stopped today)
    query = {
        '$or': [
            {'is_tracking': True},
            {'session_date': session_date}  # Includes stopped patrols from today
        ]
    }
    if hq_id != 'SUPER_ADMIN':
        query['hq_id'] = hq_id
    
    patrols = await db.patrols.find(
        query, 
        {'_id': 0, 'id': 1, 'name': 1, 'status': 1, 'trail': 1, 'session_date': 1,
         'latitude': 1, 'longitude': 1, 'session_start': 1, 'tracking_stopped': 1}
    ).to_list(500)
    
    all_trails = []
    
    for patrol in patrols:
        patrol_session = patrol.get('session_date', '')
        
        # Filter trail points by session_date
        trail_points = []
        for pt in patrol.get('trail', []):
            point_session = pt.get('session_date', patrol_session)
            if point_session == session_date or not pt.get('session_date'):
                trail_points.append([pt.get('lat'), pt.get('lng')])
        
        if trail_points or patrol.get('latitude'):
            all_trails.append({
                'patrol_id': patrol['id'],
                'patrol_name': patrol['name'],
                'status': patrol.get('status', 'inactive'),
                'points': trail_points,
                'last_location': [patrol.get('latitude', 0), patrol.get('longitude', 0)],
                'session_start': patrol.get('session_start'),
                'tracking_stopped': patrol.get('tracking_stopped')
            })
    
    return all_trails

@api_router.get("/patrols/{patrol_id}/trail")
async def get_patrol_trail(patrol_id: str, hours: int = 24, date: str = None):
    """
    Get trail for patrol's session.
    
    Session Policy:
    - Default: Returns today's session trail (0000-2359 BD time)
    - With date param: Returns historical trail for that date
    """
    db = get_db()
    
    # Get patrol info
    patrol = await db.patrols.find_one(
        {'id': patrol_id}, 
        {'_id': 0, 'trail': 1, 'session_date': 1, 'status': 1}
    )
    
    if not patrol:
        return PatrolTrailResponse(patrol_id=patrol_id, points=[], total_distance=0.0)
    
    # Determine which session's trail to show
    # Default: current session (today's date in BD time)
    BD_OFFSET = timedelta(hours=6)
    now_bd = datetime.now(timezone.utc) + BD_OFFSET
    today_session = now_bd.strftime('%Y-%m-%d')
    
    target_session = date or patrol.get('session_date') or today_session
    
    # Get all trail points for the session date
    locations = []
    if patrol.get('trail'):
        for pt in patrol.get('trail', []):
            try:
                point_session = pt.get('session_date', patrol.get('session_date'))
                
                # Include points from target session
                if point_session == target_session:
                    locations.append({
                        'latitude': pt.get('lat'),
                        'longitude': pt.get('lng'),
                        'timestamp': pt.get('timestamp', '')
                    })
                elif not pt.get('session_date'):
                    # Legacy points without session_date - include all
                    locations.append({
                        'latitude': pt.get('lat'),
                        'longitude': pt.get('lng'),
                        'timestamp': pt.get('timestamp', '')
                    })
            except:
                continue
    
    # If requesting history, check archived sessions
    if not locations and date:
        archived = await db.patrol_sessions.find_one(
            {'patrol_id': patrol_id, 'session_date': date},
            {'_id': 0, 'archived_trail': 1}
        )
        if archived and archived.get('archived_trail'):
            for pt in archived['archived_trail']:
                locations.append({
                    'latitude': pt.get('lat'),
                    'longitude': pt.get('lng'),
                    'timestamp': pt.get('timestamp', '')
                })
    
    points = []
    for loc in locations:
        try:
            ts = loc.get('timestamp')
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
            points.append(TrailPoint(
                latitude=loc['latitude'],
                longitude=loc['longitude'],
                timestamp=ts
            ))
        except:
            continue
    
    total_distance = 0.0
    for i in range(1, len(points)):
        lat1, lon1 = points[i-1].latitude, points[i-1].longitude
        lat2, lon2 = points[i].latitude, points[i].longitude
        total_distance += ((lat2 - lat1)**2 + (lon2 - lon1)**2)**0.5 * 111
    
    return PatrolTrailResponse(
        patrol_id=patrol_id,
        points=points,
        total_distance=round(total_distance, 2)
    )

# Public endpoint to get patrol by ID (for Patrol Commander)
@api_router.get("/patrol/{patrol_id}")
async def get_patrol_public(patrol_id: str):
    """Get patrol info by ID (public endpoint for Patrol Commander)"""
    db = get_db()
    patrol = await db.patrols.find_one({'id': patrol_id}, {'_id': 0})
    if not patrol:
        raise HTTPException(status_code=404, detail="Patrol not found")
    return patrol

# Access Code Routes
@api_router.post("/codes/generate")
async def generate_access_code(patrol_id: str, email: str):
    db = get_db()
    patrol = await db.patrols.find_one({'id': patrol_id})
    if not patrol:
        raise HTTPException(status_code=404, detail="Patrol not found")
    
    code = str(uuid.uuid4().int)[:6]
    
    # Calculate expiry at 00:01 next day (24-hour session)
    now = datetime.now(timezone.utc)
    tomorrow = now.replace(hour=0, minute=1, second=0, microsecond=0) + timedelta(days=1)
    
    access_code = {
        'code': code,
        'patrol_id': patrol_id,
        'email': email,
        'created_at': now.isoformat(),
        'expires_at': tomorrow.isoformat(),
        'is_used': False,
        'session_active': True,
        'last_activity': now.isoformat()
    }
    
    await db.access_codes.insert_one(access_code)
    
    return {
        'code': code,
        'patrol_id': patrol_id,
        'patrol_name': patrol.get('name'),
        'expires_at': access_code['expires_at'],
        'session_expires': tomorrow.isoformat()
    }

@api_router.post("/codes/verify")
async def verify_access_code(verification: CodeVerification):
    db = get_db()
    code_doc = await db.access_codes.find_one({
        'code': verification.code,
        'email': verification.email
    })
    
    if not code_doc:
        raise HTTPException(status_code=404, detail="Invalid code or email")
    
    expires_at = datetime.fromisoformat(code_doc['expires_at'])
    now = datetime.now(timezone.utc)
    
    # Check if session is still valid (within same day session 0001-0001)
    if now > expires_at:
        raise HTTPException(status_code=400, detail="Session has expired. Please request a new code.")
    
    # Allow session continuation - don't mark as used, update last activity
    await db.access_codes.update_one(
        {'code': verification.code},
        {'$set': {
            'last_activity': now.isoformat(),
            'session_active': True
        }}
    )
    
    # Start session tracking
    await db.patrol_sessions.update_one(
        {'patrol_id': code_doc['patrol_id'], 'session_date': now.strftime('%Y-%m-%d')},
        {
            '$set': {
                'last_activity': now.isoformat(),
                'status': 'active'
            },
            '$setOnInsert': {
                'session_start': now.isoformat(),
                'patrol_id': code_doc['patrol_id'],
                'hq_id': code_doc.get('hq_id', 'SUPER_ADMIN')
            }
        },
        upsert=True
    )
    
    patrol = await db.patrols.find_one({'id': code_doc['patrol_id']}, {'_id': 0})
    
    # Mark patrol as tracking
    await db.patrols.update_one(
        {'id': code_doc['patrol_id']},
        {'$set': {'is_tracking': True, 'status': 'active'}}
    )
    
    return {
        'valid': True,
        'patrol': patrol,
        'session_expires': expires_at.isoformat(),
        'can_continue': True
    }


@api_router.post("/verify-code")
async def verify_patrol_code(data: dict):
    """
    Code verification for patrol commander access.
    
    Session Policy:
    - Session runs 0000 hrs to 2359 hrs (Bangladesh time)
    - Trail starts when location tracking begins (not on verification)
    - Trail only clears at start of NEW DAY (0000 hrs)
    - Multiple patrol missions same day accumulate in same trail
    - Stopped patrols remain visible on map until 2359 hrs
    """
    db = get_db()
    
    patrol_id = data.get('patrol_id')
    code = sanitize_input(data.get('code', '')).upper().strip()
    
    if not patrol_id or not code:
        return {'verified': False, 'message': 'Patrol ID and code are required'}
    
    # Find valid code for this patrol
    code_doc = await db.access_codes.find_one({
        'patrol_id': patrol_id,
        'code': code
    })
    
    if not code_doc:
        return {'verified': False, 'message': 'Invalid code. Please contact HQ for the correct code.'}
    
    # Check expiry
    expires_at = datetime.fromisoformat(code_doc['expires_at'])
    now_utc = datetime.now(timezone.utc)
    
    if now_utc > expires_at:
        return {'verified': False, 'message': 'Code has expired. Please request a new code from HQ.'}
    
    # Calculate session date using Bangladesh timezone (UTC+6)
    # Session: 0000 hrs to 2359 hrs BD time
    BD_OFFSET = timedelta(hours=6)
    now_bd = now_utc + BD_OFFSET
    session_date = now_bd.strftime('%Y-%m-%d')
    
    # Check if patrol's current session_date is different (new day)
    patrol = await db.patrols.find_one({'id': patrol_id}, {'_id': 0, 'session_date': 1, 'trail': 1})
    current_session_date = patrol.get('session_date') if patrol else None
    
    # Only clear trail if it's a NEW DAY
    should_clear_trail = current_session_date and current_session_date != session_date
    
    # Mark code as verified and activate patrol
    await db.access_codes.update_one(
        {'code': code, 'patrol_id': patrol_id},
        {'$set': {
            'verified_at': now_utc.isoformat(),
            'session_active': True,
            'session_date': session_date,
            'last_activity': now_utc.isoformat()
        }}
    )
    
    # Update patrol - clear trail ONLY if new day
    update_data = {
        'code_verified': True,
        'is_tracking': True,
        'status': 'active',
        'verified_at': now_utc.isoformat(),
        'session_date': session_date,
        'session_start': now_utc.isoformat()
    }
    
    if should_clear_trail:
        # Archive previous day's trail before clearing
        if patrol and patrol.get('trail'):
            await db.patrol_sessions.update_one(
                {'patrol_id': patrol_id, 'session_date': current_session_date},
                {'$set': {'archived_trail': patrol.get('trail'), 'archived_at': now_utc.isoformat()}},
                upsert=True
            )
        update_data['trail'] = []  # Clear for new day only
    
    await db.patrols.update_one(
        {'id': patrol_id},
        {'$set': update_data}
    )
    
    return {
        'verified': True,
        'message': 'Code verified successfully. You can now start tracking.',
        'session_date': session_date,
        'session_expires': expires_at.isoformat()
    }


@api_router.post("/codes/end-session")
async def end_patrol_session(patrol_id: str):
    """
    Stop live tracking for a patrol.
    
    Session Policy:
    - Stops live tracking immediately
    - Trail remains visible on map until 2359 hrs (end of session)
    - Patrol marked as 'stopped' but stays on map
    """
    db = get_db()
    now_utc = datetime.now(timezone.utc)
    
    # Get current patrol info
    patrol = await db.patrols.find_one(
        {'id': patrol_id}, 
        {'_id': 0, 'session_date': 1, 'latitude': 1, 'longitude': 1, 'trail': 1}
    )
    
    if not patrol:
        return {'success': False, 'message': 'Patrol not found'}
    
    # Calculate trail stats
    trail = patrol.get('trail', [])
    trail_distance = 0.0
    if len(trail) > 1:
        for i in range(1, len(trail)):
            lat1, lon1 = trail[i-1].get('lat', 0), trail[i-1].get('lng', 0)
            lat2, lon2 = trail[i].get('lat', 0), trail[i].get('lng', 0)
            trail_distance += ((lat2 - lat1)**2 + (lon2 - lon1)**2)**0.5 * 111
    
    # Mark patrol as stopped - trail remains visible
    await db.patrols.update_one(
        {'id': patrol_id},
        {'$set': {
            'is_tracking': False,
            'tracking_stopped': True,
            'tracking_stopped_at': now_utc.isoformat(),
            'finished_stats': {
                'trail_points': len(trail),
                'trail_distance_km': round(trail_distance, 2),
                'stopped_at': now_utc.isoformat()
            }
        }}
    )
    
    return {
        'success': True, 
        'message': 'Tracking stopped. Trail remains visible until end of session.',
        'stats': {
            'trail_points': len(trail),
            'trail_distance_km': round(trail_distance, 2)
        }
    }
    trail = patrol.get('trail', []) if patrol else []
    trail_distance = 0.0
    if len(trail) > 1:
        for i in range(1, len(trail)):
            lat1, lon1 = trail[i-1].get('lat', 0), trail[i-1].get('lng', 0)
            lat2, lon2 = trail[i].get('lat', 0), trail[i].get('lng', 0)
            trail_distance += ((lat2 - lat1)**2 + (lon2 - lon1)**2)**0.5 * 111
    
    # Update session record - mark this patrol instance as finished
    await db.patrol_sessions.update_one(
        {'patrol_id': patrol_id, 'session_date': session_date},
        {
            '$set': {
                'last_activity': now.isoformat(),
                'status': 'has_finished'
            },
            '$push': {
                'finished_instances': {
                    'instance_id': patrol_instance_id,
                    'finished_at': now.isoformat(),
                    'trail_points': len(trail),
                    'trail_distance_km': round(trail_distance, 2),
                    'last_location': {
                        'lat': patrol.get('latitude', 0) if patrol else 0,
                        'lng': patrol.get('longitude', 0) if patrol else 0
                    }
                }
            }
        }
    )
    
    # Mark patrol as finished but KEEP VISIBLE on map
    # Trail and last location are preserved until 00:01 next day
    await db.patrols.update_one(
        {'id': patrol_id},
        {'$set': {
            'is_tracking': False,
            'status': 'finished',
            'code_verified': False,
            'session_ended': now.isoformat(),
            'finished_stats': {
                'trail_points': len(trail),
                'trail_distance_km': round(trail_distance, 2),
                'finished_at': now.isoformat()
            }
        }}
    )
    
    return {
        'success': True, 
        'message': 'Patrol finished. Trail remains visible until 00:01 hrs.',
        'stats': {
            'trail_points': len(trail),
            'trail_distance_km': round(trail_distance, 2)
        }
    }


# Soldier Routes
@api_router.post("/soldiers/upload")
async def upload_soldiers_pdf(file: UploadFile = File(...)):
    db = get_db()
    
    try:
        content = await file.read()
        pdf_reader = PdfReader(io.BytesIO(content))
        
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text()
        
        import re
        emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
        
        soldiers_added = 0
        for email in emails:
            soldier_id = str(uuid.uuid4())[:8].upper()
            soldier = {
                'id': soldier_id,
                'name': email.split('@')[0].replace('.', ' ').title(),
                'email': email,
                'rank': 'Soldier',
                'unit': 'BD Army 10 Div'
            }
            
            exists = await db.soldiers.find_one({'email': email})
            if not exists:
                await db.soldiers.insert_one(soldier)
                soldiers_added += 1
        
        return {
            'success': True,
            'soldiers_added': soldiers_added,
            'emails_found': len(emails)
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing PDF: {str(e)}")

@api_router.get("/soldiers", response_model=List[Soldier])
async def get_all_soldiers():
    db = get_db()
    soldiers = await db.soldiers.find({}, {'_id': 0}).to_list(500)
    return soldiers

# SOS Routes
@api_router.post("/sos/alert")
async def create_sos_alert(alert_data: dict):
    db = get_db()
    
    alert = {
        'patrol_id': alert_data.get('patrol_id'),
        'latitude': alert_data.get('latitude'),
        'longitude': alert_data.get('longitude'),
        'message': alert_data.get('message', 'EMERGENCY - SOS ALERT'),
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'resolved': False,
        'auto_triggered': alert_data.get('auto_triggered', False)
    }
    
    # Get HQ ID from patrol
    patrol = await db.patrols.find_one({'id': alert_data.get('patrol_id')}, {'hq_id': 1})
    if patrol:
        alert['hq_id'] = patrol.get('hq_id')
    
    await db.sos_alerts.insert_one(alert)
    
    # Remove _id before returning (MongoDB adds it)
    alert.pop('_id', None)
    
    await db.patrols.update_one(
        {'id': alert_data.get('patrol_id')},
        {'$set': {'status': 'sos'}}
    )
    
    return {'success': True, 'alert': alert}

@api_router.get("/sos", response_model=List[SOSAlert])
async def get_sos_alerts(resolved: bool = False):
    db = get_db()
    
    alerts = await db.sos_alerts.find(
        {'resolved': resolved},
        {'_id': 0}
    ).sort('timestamp', -1).to_list(100)
    
    for alert in alerts:
        if isinstance(alert.get('timestamp'), str):
            alert['timestamp'] = datetime.fromisoformat(alert['timestamp'])
    
    return alerts

@api_router.patch("/sos/{patrol_id}/resolve")
async def resolve_sos(patrol_id: str):
    db = get_db()
    
    await db.sos_alerts.update_many(
        {'patrol_id': patrol_id, 'resolved': False},
        {'$set': {'resolved': True}}
    )
    
    await db.patrols.update_one(
        {'id': patrol_id},
        {'$set': {'status': 'active'}}
    )
    
    return {'success': True}

# HQ Auth
# HQ Management Routes
@api_router.post("/hq/register", response_model=HQResponse)
async def register_hq(hq_data: HQCreate):
    db = get_db()
    
    # Check if username exists
    existing = await db.hq_users.find_one({'username': hq_data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Validate password strength
    is_valid, message = validate_password_strength(hq_data.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=message)
    
    hq_id = str(uuid.uuid4())[:8].upper()
    
    # Hash password before storing
    hashed_password = hash_password(hq_data.password)
    
    hq_doc = {
        'hq_id': hq_id,
        'username': sanitize_input(hq_data.username),
        'password': hashed_password,
        'hq_name': sanitize_input(hq_data.hq_name),
        'location': sanitize_input(hq_data.location) if hq_data.location else None,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.hq_users.insert_one(hq_doc)
    
    hq_doc.pop('_id')
    hq_doc.pop('password')
    if isinstance(hq_doc.get('created_at'), str):
        hq_doc['created_at'] = datetime.fromisoformat(hq_doc['created_at'])
    
    log_security_event("hq_created", {"hq_id": hq_id, "username": hq_data.username})
    
    return HQResponse(**hq_doc)

@api_router.post("/hq/login")
@limiter.limit("5/minute")
async def hq_login(request: Request, login: HQLogin):
    db = get_db()
    
    # Sanitize input
    username = sanitize_input(login.username)
    
    # Check account lockout
    is_locked, remaining_minutes = is_account_locked(username)
    if is_locked:
        log_security_event("login_blocked", {"username": username, "reason": "account_locked"}, request)
        raise HTTPException(
            status_code=429, 
            detail=f"Account temporarily locked. Try again in {remaining_minutes} minutes."
        )
    
    hq = await db.hq_users.find_one({'username': username})
    
    # Verify password
    if not hq or not verify_password(login.password, hq.get('password', '')):
        # Record failed attempt
        record_failed_login(username)
        remaining = get_remaining_attempts(username)
        log_security_event("login_failed", {"username": username, "remaining_attempts": remaining}, request)
        
        if remaining > 0:
            raise HTTPException(status_code=401, detail=f"Invalid credentials. {remaining} attempts remaining.")
        else:
            raise HTTPException(status_code=401, detail="Invalid credentials. Account locked.")
    
    # Clear failed attempts on successful login
    clear_failed_attempts(username)
    
    is_super_admin = hq.get('is_super_admin', False)
    
    # Check subscription status for non-admin users
    subscription = hq.get('subscription', {})
    if not is_super_admin and subscription:
        expires_at = subscription.get('expires_at')
        if expires_at:
            expiry = datetime.fromisoformat(expires_at) if isinstance(expires_at, str) else expires_at
            if datetime.now(timezone.utc) > expiry:
                subscription['status'] = 'expired'
    
    # Generate JWT token instead of simple UUID
    token_data = {
        "hq_id": hq['hq_id'],
        "username": username,
        "is_super_admin": is_super_admin
    }
    access_token = create_access_token(token_data)
    
    log_security_event("login_success", {"username": username, "hq_id": hq['hq_id']}, request)
    
    return {
        'success': True,
        'token': access_token,
        'hq_id': hq['hq_id'],
        'hq_name': hq['hq_name'],
        'hq_logo': hq.get('logo', ''),
        'role': 'super_admin' if is_super_admin else 'hq_admin',
        'is_super_admin': is_super_admin,
        'subscription': subscription
    }

# Subscription Status Endpoint
@api_router.get("/subscription/status")
async def get_subscription_status(hq_id: str):
    # Validate input
    if not validate_patrol_id(hq_id) and hq_id != 'SUPER_ADMIN':
        raise HTTPException(status_code=400, detail="Invalid HQ ID format")
    
    db = get_db()
    
    if hq_id == 'SUPER_ADMIN':
        return {
            'status': 'active',
            'plan': 'pro',
            'is_super_admin': True,
            'limits': SUBSCRIPTION_PLANS['pro'],
            'usage': {
                'patrols': 0,
                'tracking': 0
            }
        }
    
    hq = await db.hq_users.find_one({'hq_id': hq_id})
    if not hq:
        raise HTTPException(status_code=404, detail="HQ not found")
    
    subscription = hq.get('subscription', {})
    limits = subscription.get('limits', SUBSCRIPTION_PLANS['trial'])
    
    # Check expiry
    status = subscription.get('status', 'pending')
    expires_at = subscription.get('expires_at')
    time_remaining = None
    
    if expires_at:
        expiry = datetime.fromisoformat(expires_at) if isinstance(expires_at, str) else expires_at
        now = datetime.now(timezone.utc)
        
        if now > expiry:
            status = 'expired'
        else:
            diff = expiry - now
            time_remaining = {
                'total_seconds': int(diff.total_seconds()),
                'days': diff.days,
                'hours': int((diff.seconds % 86400) // 3600),
                'minutes': int((diff.seconds % 3600) // 60)
            }
    
    # Get current usage
    patrol_count = await db.patrols.count_documents({'hq_id': hq_id})
    tracking_count = await db.patrols.count_documents({'hq_id': hq_id, 'is_tracking': True})
    
    return {
        'status': status,
        'plan': subscription.get('plan', 'trial'),
        'is_super_admin': False,
        'expires_at': expires_at,
        'time_remaining': time_remaining,
        'limits': {
            'max_patrols': limits.get('max_patrols', 3),
            'max_tracking': limits.get('max_tracking', 3),
            'session_duration_min': limits.get('session_duration_min', 30),
            'trail_history_hours': limits.get('trail_history_hours', 6)
        },
        'usage': {
            'patrols': patrol_count,
            'tracking': tracking_count
        },
        'can_create_patrol': patrol_count < limits.get('max_patrols', 3),
        'can_start_tracking': tracking_count < limits.get('max_tracking', 3)
    }

# HQ Access Request (for new HQs wanting to register)
@api_router.post("/hq/request-access")
async def request_hq_access(
    hq_name: str = Form(...),
    location: str = Form(...),
    contact_email: str = Form(...),
    contact_phone: str = Form(None)
):
    db = get_db()
    
    # Check if request already exists
    existing = await db.hq_requests.find_one({'contact_email': contact_email, 'status': 'pending'})
    if existing:
        raise HTTPException(status_code=400, detail="Request already submitted")
    
    request_doc = {
        'id': str(uuid.uuid4())[:8].upper(),
        'hq_name': hq_name,
        'location': location,
        'contact_email': contact_email,
        'contact_phone': contact_phone,
        'status': 'pending',
        'requested_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.hq_requests.insert_one(request_doc)
    
    return {'success': True, 'message': 'Request submitted'}

# Admin Routes
@api_router.get("/admin/hq-list")
async def admin_get_hq_list():
    db = get_db()
    
    hqs = await db.hq_users.find(
        {'is_super_admin': {'$ne': True}},
        {'_id': 0, 'password': 0}
    ).to_list(500)
    
    # Use aggregation to get patrol counts in a single query (fix N+1 problem)
    patrol_counts = await db.patrols.aggregate([
        {'$group': {'_id': '$hq_id', 'count': {'$sum': 1}}}
    ]).to_list(500)
    count_map = {item['_id']: item['count'] for item in patrol_counts}
    
    for hq in hqs:
        hq['patrol_count'] = count_map.get(hq['hq_id'], 0)
    
    return hqs

@api_router.get("/admin/pending-requests")
async def admin_get_pending_requests():
    db = get_db()
    
    requests = await db.hq_requests.find(
        {'status': 'pending'},
        {'_id': 0}
    ).sort('requested_at', -1).to_list(100)
    
    return requests

@api_router.get("/admin/stats")
async def admin_get_stats():
    db = get_db()
    
    total_hqs = await db.hq_users.count_documents({'is_super_admin': {'$ne': True}})
    pending_requests = await db.hq_requests.count_documents({'status': 'pending'})
    
    # Count active HQs (with valid subscription)
    now = datetime.now(timezone.utc).isoformat()
    active_hqs = await db.hq_users.count_documents({
        'is_super_admin': {'$ne': True},
        'subscription.expires_at': {'$gt': now}
    })
    
    expired_hqs = total_hqs - active_hqs
    
    # Calculate monthly revenue (estimated)
    normal_count = await db.hq_users.count_documents({'subscription.plan': 'normal'})
    pro_count = await db.hq_users.count_documents({'subscription.plan': 'pro'})
    monthly_revenue = (normal_count * 25) + (pro_count * 50)
    
    return {
        'total_hqs': total_hqs,
        'pending_requests': pending_requests,
        'active_hqs': active_hqs,
        'expired_hqs': expired_hqs,
        'monthly_revenue': monthly_revenue
    }

@api_router.post("/admin/approve-hq")
async def admin_approve_hq(
    request_id: str = Form(...),
    username: str = Form(...),
    password: str = Form(...),
    hq_name: str = Form(...),
    plan: str = Form('trial'),
    logo: UploadFile = File(None)
):
    db = get_db()
    
    # Check if request exists
    request = await db.hq_requests.find_one({'id': request_id, 'status': 'pending'})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check if username exists
    existing = await db.hq_users.find_one({'username': username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Save logo if provided
    logo_url = ''
    if logo:
        logo_filename = f"{uuid.uuid4()}.{logo.filename.split('.')[-1]}"
        logo_path = UPLOAD_DIR / logo_filename
        with open(logo_path, 'wb') as f:
            content = await logo.read()
            f.write(content)
        logo_url = f"/uploads/{logo_filename}"
    
    # Calculate subscription expiry
    plan_config = SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS['trial'])
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=plan_config['duration_hours'])
    
    hq_id = str(uuid.uuid4())[:8].upper()
    
    hq_doc = {
        'hq_id': hq_id,
        'username': username,
        'password': password,
        'hq_name': hq_name,
        'location': request['location'],
        'contact_email': request['contact_email'],
        'contact_phone': request.get('contact_phone'),
        'logo': logo_url,
        'subscription': {
            'plan': plan,
            'status': 'active',
            'started_at': now.isoformat(),
            'expires_at': expires_at.isoformat(),
            'limits': plan_config
        },
        'created_at': now.isoformat()
    }
    
    await db.hq_users.insert_one(hq_doc)
    
    # Update request status
    await db.hq_requests.update_one(
        {'id': request_id},
        {'$set': {'status': 'approved', 'approved_at': now.isoformat(), 'assigned_hq_id': hq_id}}
    )
    
    return {'success': True, 'hq_id': hq_id}

@api_router.post("/admin/reject-request")
async def admin_reject_request(data: dict):
    db = get_db()
    
    await db.hq_requests.update_one(
        {'id': data['request_id']},
        {'$set': {'status': 'rejected', 'rejected_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    return {'success': True}

@api_router.post("/admin/update-subscription")
async def admin_update_subscription(data: dict):
    db = get_db()
    
    hq_id = data['hq_id']
    plan = data['plan']
    custom_days = data.get('custom_days')
    
    # Get plan config
    if plan == 'custom' and custom_days:
        duration_hours = custom_days * 24
        plan_config = {**SUBSCRIPTION_PLANS['pro'], 'duration_hours': duration_hours}
    else:
        plan_config = SUBSCRIPTION_PLANS.get(plan, SUBSCRIPTION_PLANS['trial'])
    
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=plan_config['duration_hours'])
    
    await db.hq_users.update_one(
        {'hq_id': hq_id},
        {'$set': {
            'subscription': {
                'plan': plan,
                'status': 'active',
                'started_at': now.isoformat(),
                'expires_at': expires_at.isoformat(),
                'limits': plan_config
            }
        }}
    )
    
    return {'success': True}

@api_router.delete("/admin/hq/{hq_id}")
async def admin_delete_hq(hq_id: str):
    db = get_db()
    
    # Delete HQ user
    await db.hq_users.delete_one({'hq_id': hq_id})
    
    # Delete all patrols for this HQ
    await db.patrols.delete_many({'hq_id': hq_id})
    
    # Delete all locations for this HQ's patrols
    # (would need to track patrol IDs first, simplified here)
    
    return {'success': True}

# Legacy Super Admin Routes (kept for compatibility)
@api_router.get("/admin/hqs")
async def get_all_hqs(admin_hq_id: str):
    db = get_db()
    
    # Verify super admin
    if admin_hq_id != 'SUPER_ADMIN':
        raise HTTPException(status_code=403, detail="Access denied")
    
    hqs = await db.hq_users.find(
        {'hq_id': {'$ne': 'SUPER_ADMIN'}},
        {'_id': 0, 'password': 0}
    ).to_list(100)
    
    return hqs

# Stats
@api_router.get("/stats")
async def get_stats(hq_id: str):
    db = get_db()
    
    # Super admin sees all stats
    if hq_id == 'SUPER_ADMIN':
        query = {}
    else:
        query = {'hq_id': hq_id}
    
    # Total patrols (all created)
    total_patrols = await db.patrols.count_documents(query)
    
    # Approved patrols (code connected/verified)
    approved_query = {**query, '$or': [
        {'is_approved': True},
        {'code_verified': True},
        {'status': {'$in': ['active', 'assigned', 'finished']}}
    ]}
    approved_patrols = await db.patrols.count_documents(approved_query)
    
    # Active tracking (currently tracking)
    active_query = {**query, 'is_tracking': True}
    active_patrols = await db.patrols.count_documents(active_query)
    
    # Notifications count (unread)
    notifications_query = {**query, 'read': False} if hq_id != 'SUPER_ADMIN' else {'read': False}
    unread_notifications = await db.notifications.count_documents(notifications_query)
    
    # Also count active SOS as critical notifications
    sos_query = {'resolved': False}
    if hq_id != 'SUPER_ADMIN':
        sos_query['hq_id'] = hq_id
    active_sos = await db.sos_alerts.count_documents(sos_query)
    
    return {
        'total_patrols': total_patrols,
        'approved_patrols': approved_patrols,
        'active_patrols': active_patrols,
        'notifications': unread_notifications + active_sos,
        'active_sos': active_sos,
        'connected_clients': len(connected_clients)
    }

# Notifications Routes
@api_router.get("/notifications")
async def get_notifications(hq_id: str, limit: int = 50):
    """Get notifications for HQ"""
    db = get_db()
    
    query = {} if hq_id == 'SUPER_ADMIN' else {'$or': [{'hq_id': hq_id}, {'hq_id': None}]}
    
    notifications = await db.notifications.find(
        query,
        {'_id': 0}
    ).sort('timestamp', -1).limit(limit).to_list(limit)
    
    return notifications

@api_router.post("/notifications")
async def create_notification(notification_data: dict):
    """Create a new notification"""
    db = get_db()
    
    notification = {
        'id': str(uuid.uuid4())[:8].upper(),
        'type': notification_data.get('type', 'info'),  # info, warning, alert, success
        'title': notification_data.get('title', 'Notification'),
        'message': notification_data.get('message', ''),
        'hq_id': notification_data.get('hq_id'),  # None for all HQs
        'patrol_id': notification_data.get('patrol_id'),
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'read': False
    }
    
    await db.notifications.insert_one(notification)
    return {'success': True, 'notification': notification}

@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read"""
    db = get_db()
    
    await db.notifications.update_one(
        {'id': notification_id},
        {'$set': {'read': True}}
    )
    
    return {'success': True}

@api_router.patch("/notifications/read-all")
async def mark_all_notifications_read(hq_id: str):
    """Mark all notifications as read for an HQ"""
    db = get_db()
    
    query = {} if hq_id == 'SUPER_ADMIN' else {'hq_id': hq_id}
    await db.notifications.update_many(query, {'$set': {'read': True}})
    
    return {'success': True}

# KML Proxy Endpoint - To bypass CORS for Google Maps KML
@api_router.get("/kml/proxy")
async def kml_proxy(url: str = None):
    """
    Proxy endpoint to fetch KML/KMZ data from Google Maps
    This is needed because Google Maps doesn't allow direct CORS requests
    """
    import httpx
    
    if not url:
        # Default Google Maps KML URL from the uploaded KMZ
        url = "https://www.google.com/maps/d/kml?mid=1aQqIVEKSDv4m631OQJyIzDBtJsdf5U0"
    
    # Validate URL is from Google Maps
    allowed_domains = ['google.com', 'googleapis.com', 'gstatic.com']
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if not any(domain in parsed.netloc for domain in allowed_domains):
        raise HTTPException(status_code=400, detail="Only Google Maps URLs are allowed")
    
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            response = await client.get(url)
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch KML")
            
            content_type = response.headers.get('content-type', 'application/xml')
            
            # Return the KML/KMZ content
            from fastapi.responses import Response
            return Response(
                content=response.content,
                media_type=content_type,
                headers={
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=300'  # Cache for 5 minutes
                }
            )
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch KML: {str(e)}")

# KML to GeoJSON conversion endpoint - parses KML server-side
@api_router.get("/kml/geojson")
async def kml_to_geojson(url: str = None):
    """
    Fetches KML/KMZ from Google Maps and converts to GeoJSON server-side
    This avoids browser XML parsing issues
    """
    import httpx
    import zipfile
    import xml.etree.ElementTree as ET
    from io import BytesIO
    import json
    import re
    
    if not url:
        url = "https://www.google.com/maps/d/kml?mid=1aQqIVEKSDv4m631OQJyIzDBtJsdf5U0"
    
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            response = await client.get(url)
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch KML")
            
            content = response.content
            kml_content = None
            
            # Check if it's a ZIP (KMZ)
            if content[:2] == b'PK':
                # Extract doc.kml from KMZ
                with zipfile.ZipFile(BytesIO(content)) as zf:
                    for name in zf.namelist():
                        if name.endswith('.kml'):
                            kml_content = zf.read(name).decode('utf-8')
                            break
            else:
                kml_content = content.decode('utf-8')
            
            if not kml_content:
                raise HTTPException(status_code=400, detail="No KML content found")
            
            # Parse KML to GeoJSON
            features = []
            
            # Define KML namespace
            ns = {'kml': 'http://www.opengis.net/kml/2.2'}
            
            root = ET.fromstring(kml_content)
            
            # Find all Placemarks
            for placemark in root.iter('{http://www.opengis.net/kml/2.2}Placemark'):
                feature = {'type': 'Feature', 'properties': {}, 'geometry': None}
                
                # Get name
                name_elem = placemark.find('{http://www.opengis.net/kml/2.2}name')
                if name_elem is not None and name_elem.text:
                    feature['properties']['name'] = name_elem.text
                
                # Get description
                desc_elem = placemark.find('{http://www.opengis.net/kml/2.2}description')
                if desc_elem is not None and desc_elem.text:
                    feature['properties']['description'] = desc_elem.text
                
                # Get styleUrl
                style_elem = placemark.find('{http://www.opengis.net/kml/2.2}styleUrl')
                if style_elem is not None and style_elem.text:
                    feature['properties']['styleUrl'] = style_elem.text
                
                # Get Point coordinates
                point = placemark.find('.//{http://www.opengis.net/kml/2.2}Point/{http://www.opengis.net/kml/2.2}coordinates')
                if point is not None and point.text:
                    coords = point.text.strip().split(',')
                    if len(coords) >= 2:
                        feature['geometry'] = {
                            'type': 'Point',
                            'coordinates': [float(coords[0]), float(coords[1])]
                        }
                
                # Get Polygon coordinates
                polygon = placemark.find('.//{http://www.opengis.net/kml/2.2}Polygon')
                if polygon is not None:
                    outer = polygon.find('.//{http://www.opengis.net/kml/2.2}outerBoundaryIs/{http://www.opengis.net/kml/2.2}LinearRing/{http://www.opengis.net/kml/2.2}coordinates')
                    if outer is not None and outer.text:
                        coords_list = []
                        for coord in outer.text.strip().split():
                            parts = coord.split(',')
                            if len(parts) >= 2:
                                coords_list.append([float(parts[0]), float(parts[1])])
                        if coords_list:
                            feature['geometry'] = {
                                'type': 'Polygon',
                                'coordinates': [coords_list]
                            }
                
                # Get LineString coordinates
                linestring = placemark.find('.//{http://www.opengis.net/kml/2.2}LineString/{http://www.opengis.net/kml/2.2}coordinates')
                if linestring is not None and linestring.text:
                    coords_list = []
                    for coord in linestring.text.strip().split():
                        parts = coord.split(',')
                        if len(parts) >= 2:
                            coords_list.append([float(parts[0]), float(parts[1])])
                    if coords_list:
                        feature['geometry'] = {
                            'type': 'LineString',
                            'coordinates': coords_list
                        }
                
                if feature['geometry']:
                    features.append(feature)
            
            geojson = {
                'type': 'FeatureCollection',
                'features': features
            }
            
            return geojson
            
    except ET.ParseError as e:
        raise HTTPException(status_code=400, detail=f"Invalid KML: {str(e)}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch KML: {str(e)}")

# KML File Upload Endpoint
@api_router.post("/kml/upload")
async def upload_kml_file(
    file: UploadFile = File(...),
    hq_id: str = Form(...),
    name: str = Form(...)
):
    """
    Upload a custom KML/KMZ file for an HQ
    """
    import zipfile
    import xml.etree.ElementTree as ET
    from io import BytesIO
    
    db = get_db()
    
    # Validate file type
    if not file.filename.lower().endswith(('.kml', '.kmz')):
        raise HTTPException(status_code=400, detail="Only KML or KMZ files are allowed")
    
    # Read file content
    content = await file.read()
    
    # Parse KML content
    kml_content = None
    try:
        if file.filename.lower().endswith('.kmz'):
            # Extract KML from KMZ
            with zipfile.ZipFile(BytesIO(content)) as zf:
                for fname in zf.namelist():
                    if fname.endswith('.kml'):
                        kml_content = zf.read(fname).decode('utf-8')
                        break
        else:
            kml_content = content.decode('utf-8')
        
        if not kml_content:
            raise HTTPException(status_code=400, detail="No valid KML content found")
        
        # Parse to GeoJSON to validate and count features
        features = []
        root = ET.fromstring(kml_content)
        for placemark in root.iter('{http://www.opengis.net/kml/2.2}Placemark'):
            feature = {'type': 'Feature', 'properties': {}, 'geometry': None}
            name_elem = placemark.find('{http://www.opengis.net/kml/2.2}name')
            if name_elem is not None:
                feature['properties']['name'] = name_elem.text
            
            # Get Point
            point = placemark.find('.//{http://www.opengis.net/kml/2.2}Point/{http://www.opengis.net/kml/2.2}coordinates')
            if point is not None and point.text:
                coords = point.text.strip().split(',')
                if len(coords) >= 2:
                    feature['geometry'] = {'type': 'Point', 'coordinates': [float(coords[0]), float(coords[1])]}
            
            # Get Polygon
            polygon = placemark.find('.//{http://www.opengis.net/kml/2.2}Polygon')
            if polygon is not None:
                outer = polygon.find('.//{http://www.opengis.net/kml/2.2}outerBoundaryIs/{http://www.opengis.net/kml/2.2}LinearRing/{http://www.opengis.net/kml/2.2}coordinates')
                if outer is not None and outer.text:
                    coords_list = [[float(p.split(',')[0]), float(p.split(',')[1])] for p in outer.text.strip().split() if ',' in p]
                    if coords_list:
                        feature['geometry'] = {'type': 'Polygon', 'coordinates': [coords_list]}
            
            if feature['geometry']:
                features.append(feature)
        
        # Store in database
        kml_doc = {
            'id': str(uuid.uuid4())[:8].upper(),
            'hq_id': hq_id,
            'name': name,
            'filename': file.filename,
            'feature_count': len(features),
            'geojson': {'type': 'FeatureCollection', 'features': features},
            'uploaded_at': datetime.now(timezone.utc).isoformat(),
            'active': True
        }
        
        await db.kml_files.insert_one(kml_doc)
        
        return {
            'success': True,
            'id': kml_doc['id'],
            'name': name,
            'feature_count': len(features)
        }
        
    except ET.ParseError as e:
        raise HTTPException(status_code=400, detail=f"Invalid KML format: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

# Get uploaded KML files for an HQ
@api_router.get("/kml/files")
async def get_kml_files(hq_id: str):
    """Get all uploaded KML files for an HQ"""
    db = get_db()
    files = await db.kml_files.find(
        {'hq_id': hq_id, 'active': True},
        {'_id': 0, 'geojson': 0}  # Exclude large geojson from list
    ).to_list(100)
    return files

# Get specific KML file GeoJSON
@api_router.get("/kml/files/{file_id}")
async def get_kml_file_geojson(file_id: str):
    """Get GeoJSON for a specific uploaded KML file"""
    db = get_db()
    kml_file = await db.kml_files.find_one(
        {'id': file_id, 'active': True},
        {'_id': 0}
    )
    if not kml_file:
        raise HTTPException(status_code=404, detail="KML file not found")
    return kml_file.get('geojson', {'type': 'FeatureCollection', 'features': []})

# Delete KML file
@api_router.delete("/kml/files/{file_id}")
async def delete_kml_file(file_id: str):
    """Delete (deactivate) an uploaded KML file"""
    db = get_db()
    result = await db.kml_files.update_one(
        {'id': file_id},
        {'$set': {'active': False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="KML file not found")
    return {'success': True}

# MQTT Status and Configuration Endpoint
@api_router.get("/mqtt/status")
async def get_mqtt_status():
    """Get MQTT broker status and connection info"""
    mqtt_host = os.environ.get('MQTT_BROKER_HOST', 'localhost')
    mqtt_port = int(os.environ.get('MQTT_BROKER_PORT', '1883'))
    
    mqtt_connected = False
    if MQTT_ENABLED:
        try:
            from mqtt_bridge import mqtt_bridge
            mqtt_connected = mqtt_bridge.client.is_connected()
        except:
            pass
    
    return {
        'enabled': MQTT_ENABLED,
        'connected': mqtt_connected,
        'broker': {
            'host': mqtt_host,
            'port': mqtt_port
        },
        'topics': {
            'location': 'patrol/{patrol_id}/location',
            'sos': 'patrol/{patrol_id}/sos',
            'status': 'patrol/{patrol_id}/status'
        },
        'payload_format': {
            'location': {'lat': 'float', 'lng': 'float'},
            'sos': {'message': 'string', 'lat': 'float (optional)', 'lng': 'float (optional)'},
            'status': {'status': 'active|inactive|finished'}
        }
    }

# Generate MQTT credentials for a patrol
@api_router.post("/mqtt/credentials/{patrol_id}")
async def generate_mqtt_credentials(patrol_id: str):
    """Generate unique MQTT credentials for a patrol"""
    import hashlib
    import secrets
    
    db = get_db()
    
    # Check if patrol exists
    patrol = await db.patrols.find_one({'id': patrol_id})
    if not patrol:
        raise HTTPException(status_code=404, detail="Patrol not found")
    
    # Generate credentials
    username = f"patrol_{patrol_id}"
    password = secrets.token_urlsafe(16)
    
    # Store hashed password in database
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    await db.patrols.update_one(
        {'id': patrol_id},
        {'$set': {
            'mqtt_credentials': {
                'username': username,
                'password_hash': password_hash,
                'created_at': datetime.now(timezone.utc).isoformat()
            }
        }}
    )
    
    # Update mosquitto password file
    try:
        import subprocess
        passwd_file = '/app/backend/mosquitto_passwd'
        # Create password entry
        subprocess.run(
            ['mosquitto_passwd', '-b', passwd_file, username, password],
            check=True, capture_output=True
        )
    except Exception as e:
        print(f"Warning: Could not update mosquitto passwd file: {e}")
    
    return {
        'success': True,
        'credentials': {
            'username': username,
            'password': password,  # Only returned once!
            'broker_host': os.environ.get('MQTT_BROKER_HOST', 'localhost'),
            'broker_port': int(os.environ.get('MQTT_BROKER_PORT', '1883')),
            'topics': {
                'location': f'patrol/{patrol_id}/location',
                'sos': f'patrol/{patrol_id}/sos',
                'status': f'patrol/{patrol_id}/status'
            }
        }
    }

# Get MQTT credentials for patrol (without password - just connection info)
@api_router.get("/mqtt/credentials/{patrol_id}")
async def get_mqtt_credentials(patrol_id: str):
    """Get MQTT connection info for a patrol (password not included)"""
    db = get_db()
    
    patrol = await db.patrols.find_one({'id': patrol_id}, {'_id': 0, 'mqtt_credentials': 1, 'name': 1})
    if not patrol:
        raise HTTPException(status_code=404, detail="Patrol not found")
    
    creds = patrol.get('mqtt_credentials', {})
    
    return {
        'patrol_id': patrol_id,
        'patrol_name': patrol.get('name'),
        'has_credentials': bool(creds),
        'username': creds.get('username'),
        'broker_host': os.environ.get('MQTT_BROKER_HOST', 'localhost'),
        'broker_port': int(os.environ.get('MQTT_BROKER_PORT', '1883')),
        'topics': {
            'location': f'patrol/{patrol_id}/location',
            'sos': f'patrol/{patrol_id}/sos',
            'status': f'patrol/{patrol_id}/status'
        }
    }

# Subscription Expiry Warning Check
@api_router.get("/subscription/check-expiry")
async def check_subscription_expiry():
    """
    Check for expiring subscriptions and create warning notifications.
    Should be called periodically (e.g., every hour via cron or scheduler)
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    
    # Warning thresholds
    thresholds = [
        (timedelta(hours=24), '24h', 'warning'),
        (timedelta(hours=6), '6h', 'warning'),
        (timedelta(hours=1), '1h', 'critical')
    ]
    
    notifications_created = []
    
    # Find all active subscriptions
    async for hq in db.hq_users.find({'subscription.status': 'active'}):
        expires_at_str = hq.get('subscription', {}).get('expires_at')
        if not expires_at_str:
            continue
            
        try:
            expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
        except:
            continue
        
        time_remaining = expires_at - now
        
        for threshold, label, level in thresholds:
            # Check if within threshold and notification not already sent
            if timedelta(0) < time_remaining <= threshold:
                notification_key = f"expiry_{label}_{hq['hq_id']}"
                
                # Check if notification already exists
                existing = await db.notifications.find_one({
                    'key': notification_key,
                    'timestamp': {'$gt': (now - timedelta(hours=12)).isoformat()}
                })
                
                if not existing:
                    notification = {
                        'id': str(uuid.uuid4())[:8].upper(),
                        'key': notification_key,
                        'hq_id': hq['hq_id'],
                        'message': f"⚠️ Subscription expires in {label}! Contact admin to renew.",
                        'level': level,
                        'timestamp': now.isoformat(),
                        'read': False,
                        'type': 'subscription_expiry'
                    }
                    await db.notifications.insert_one(notification)
                    notifications_created.append({
                        'hq_id': hq['hq_id'],
                        'hq_name': hq.get('hq_name'),
                        'warning': label,
                        'expires_at': expires_at_str
                    })
                break  # Only create one notification per HQ
    
    return {
        'checked_at': now.isoformat(),
        'notifications_created': len(notifications_created),
        'details': notifications_created
    }

# Session management for Trial plan
@api_router.post("/session/renew")
async def renew_session(hq_id: str):
    """Renew session for Trial plan users (30-minute sessions)"""
    db = get_db()
    
    hq = await db.hq_users.find_one({'hq_id': hq_id})
    if not hq:
        raise HTTPException(status_code=404, detail="HQ not found")
    
    subscription = hq.get('subscription', {})
    plan = subscription.get('plan', 'trial')
    
    # Only Trial plan has session limits
    if plan != 'trial':
        return {
            'success': True,
            'message': 'No session renewal needed for this plan',
            'plan': plan
        }
    
    # Check if subscription is still active
    if subscription.get('status') != 'active':
        raise HTTPException(status_code=403, detail="Subscription is not active")
    
    # Renew session - set new expiry 30 minutes from now
    session_expiry = (datetime.now(timezone.utc) + timedelta(minutes=30)).isoformat()
    
    await db.hq_users.update_one(
        {'hq_id': hq_id},
        {'$set': {'session_expires_at': session_expiry}}
    )
    
    return {
        'success': True,
        'session_expires_at': session_expiry,
        'session_duration_minutes': 30
    }

# Get session status
@api_router.get("/session/status")
async def get_session_status(hq_id: str):
    """Get current session status for an HQ"""
    db = get_db()
    
    hq = await db.hq_users.find_one({'hq_id': hq_id}, {'_id': 0, 'subscription': 1, 'session_expires_at': 1})
    if not hq:
        raise HTTPException(status_code=404, detail="HQ not found")
    
    subscription = hq.get('subscription', {})
    plan = subscription.get('plan', 'trial')
    
    # Non-trial plans don't have session limits
    if plan != 'trial':
        return {
            'has_session_limit': False,
            'plan': plan
        }
    
    session_expires_at = hq.get('session_expires_at')
    now = datetime.now(timezone.utc)
    
    if session_expires_at:
        try:
            expires = datetime.fromisoformat(session_expires_at.replace('Z', '+00:00'))
            remaining_seconds = (expires - now).total_seconds()
            
            return {
                'has_session_limit': True,
                'plan': plan,
                'session_expires_at': session_expires_at,
                'remaining_seconds': max(0, remaining_seconds),
                'remaining_minutes': max(0, remaining_seconds / 60),
                'expired': remaining_seconds <= 0
            }
        except:
            pass
    
    # No session set yet - create one
    session_expiry = (now + timedelta(minutes=30)).isoformat()
    await db.hq_users.update_one(
        {'hq_id': hq_id},
        {'$set': {'session_expires_at': session_expiry}}
    )
    
    return {
        'has_session_limit': True,
        'plan': plan,
        'session_expires_at': session_expiry,
        'remaining_seconds': 30 * 60,
        'remaining_minutes': 30,
        'expired': False
    }

# MQTT Location Update via REST (for testing or fallback)
@api_router.post("/mqtt/location/{patrol_id}")
@limiter.limit("60/minute")
async def mqtt_location_update(request: Request, patrol_id: str, lat: float, lng: float):
    """
    REST endpoint for location updates.
    
    Session Policy:
    - Trail accumulates during session (0000-2359 BD time)
    - Each point tagged with session_date for filtering
    """
    # Validate inputs
    if not validate_patrol_id(patrol_id):
        raise HTTPException(status_code=400, detail="Invalid patrol ID format")
    
    if not validate_coordinates(lat, lng):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    db = get_db()
    now_utc = datetime.now(timezone.utc)
    timestamp = now_utc.isoformat()
    
    # Calculate session date using Bangladesh timezone (UTC+6)
    BD_OFFSET = timedelta(hours=6)
    now_bd = now_utc + BD_OFFSET
    session_date = now_bd.strftime('%Y-%m-%d')
    
    # Get patrol's current session info
    patrol = await db.patrols.find_one({'id': patrol_id}, {'session_date': 1, 'hq_id': 1})
    patrol_session_date = patrol.get('session_date') if patrol else session_date
    
    # Update patrol location with trail point
    result = await db.patrols.update_one(
        {'id': patrol_id},
        {
            '$set': {
                'latitude': lat,
                'longitude': lng,
                'last_update': timestamp,
                'last_location_time': timestamp,
                'is_tracking': True,
                'tracking_stopped': False,
                'session_date': patrol_session_date or session_date
            },
            '$push': {
                'trail': {
                    '$each': [{
                        'lat': lat, 
                        'lng': lng, 
                        'timestamp': timestamp, 
                        'session_date': patrol_session_date or session_date
                    }],
                    '$slice': -5000  # Supports long patrols
                }
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Patrol not found")
    
    # Broadcast to WebSocket clients
    patrol = await db.patrols.find_one({'id': patrol_id})
    if patrol:
        hq_id = patrol.get('hq_id')
        message = {
            'type': 'patrol_location',
            'patrol_id': patrol_id,
            'latitude': lat,
            'longitude': lng,
            'timestamp': timestamp,
            'status': patrol.get('status', 'active')
        }
        
        for client_id, ws_data in list(connected_clients.items()):
            if client_id.startswith(hq_id):
                try:
                    ws = ws_data['ws'] if isinstance(ws_data, dict) else ws_data
                    await ws.send_json(message)
                except Exception as e:
                    print(f"WebSocket broadcast error to {client_id}: {e}")
    
    return {'success': True, 'timestamp': timestamp}

# SOS Alert Endpoint with rate limiting
@api_router.post("/sos")
@limiter.limit("10/minute")
async def send_sos_alert(request: Request, sos: SOSAlert):
    """Send emergency SOS alert"""
    # Validate inputs
    if not validate_patrol_id(sos.patrol_id):
        raise HTTPException(status_code=400, detail="Invalid patrol ID format")
    
    if not validate_coordinates(sos.latitude, sos.longitude):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    db = get_db()
    
    # Get patrol info
    patrol = await db.patrols.find_one({'id': sos.patrol_id})
    if not patrol:
        raise HTTPException(status_code=404, detail="Patrol not found")
    
    # Log security event
    log_security_event("sos_alert", {
        "patrol_id": sos.patrol_id,
        "latitude": sos.latitude,
        "longitude": sos.longitude,
        "message": sanitize_input(sos.message) if sos.message else None
    }, request)
    
    timestamp = datetime.now(timezone.utc).isoformat()
    
    # Store SOS alert
    sos_doc = {
        'patrol_id': sos.patrol_id,
        'hq_id': patrol.get('hq_id'),
        'message': sanitize_input(sos.message) if sos.message else 'EMERGENCY SOS',
        'latitude': sos.latitude,
        'longitude': sos.longitude,
        'timestamp': timestamp,
        'status': 'active',
        'resolved': False
    }
    
    await db.sos_alerts.insert_one(sos_doc)
    
    # Update patrol status to SOS
    await db.patrols.update_one(
        {'id': sos.patrol_id},
        {'$set': {'status': 'sos'}}
    )
    
    # Create notification for HQ
    notification = {
        'type': 'sos',
        'patrol_id': sos.patrol_id,
        'patrol_name': patrol.get('name'),
        'message': sos_doc['message'],
        'latitude': sos.latitude,
        'longitude': sos.longitude,
        'timestamp': timestamp,
        'read': False
    }
    
    await db.hq_users.update_one(
        {'hq_id': patrol.get('hq_id')},
        {'$push': {'notifications': notification}}
    )
    
    # Broadcast to WebSocket
    hq_id = patrol.get('hq_id')
    for client_id, ws_data in list(connected_clients.items()):
        if client_id.startswith(hq_id):
            try:
                ws = ws_data['ws'] if isinstance(ws_data, dict) else ws_data
                await ws.send_json({
                    'type': 'sos_alert',
                    'data': notification
                })
            except Exception as e:
                print(f"SOS broadcast error to {client_id}: {e}")
    
    return {'success': True, 'timestamp': timestamp}


# ==========================================
# SECURE MESSAGING SYSTEM
# ==========================================

@api_router.post("/messages")
async def send_message(message_data: dict):
    """Send a message from HQ to patrol(s) or from patrol to HQ"""
    db = get_db()
    
    content = sanitize_input(message_data.get('content', ''))
    sender_id = message_data.get('sender_id')
    sender_type = message_data.get('sender_type', 'hq')  # 'hq' or 'patrol'
    recipient_patrol_id = message_data.get('recipient_patrol_id')  # None for broadcast
    hq_id = message_data.get('hq_id')
    message_type = message_data.get('message_type', 'direct')  # 'direct' or 'broadcast'
    
    if not content or not sender_id:
        raise HTTPException(status_code=400, detail="Content and sender_id are required")
    
    # Get sender name
    sender_name = "Unknown"
    if sender_type == 'hq':
        hq = await db.hq_users.find_one({'hq_id': sender_id}, {'_id': 0, 'hq_name': 1})
        sender_name = hq.get('hq_name', 'HQ Command') if hq else 'HQ Command'
        if not hq_id:
            hq_id = sender_id
    else:
        patrol = await db.patrols.find_one({'id': sender_id}, {'_id': 0, 'name': 1, 'hq_id': 1})
        sender_name = patrol.get('name', 'Patrol') if patrol else 'Patrol'
        if not hq_id and patrol:
            hq_id = patrol.get('hq_id')
    
    message_id = str(uuid.uuid4())[:8].upper()
    timestamp = datetime.now(timezone.utc).isoformat()
    
    message_doc = {
        'id': message_id,
        'content': content,
        'sender_id': sender_id,
        'sender_name': sender_name,
        'sender_type': sender_type,
        'recipient_patrol_id': recipient_patrol_id,
        'hq_id': hq_id,
        'message_type': message_type,
        'timestamp': timestamp,
        'read': False,
        'read_at': None
    }
    
    await db.messages.insert_one(message_doc)
    
    # Broadcast via WebSocket
    ws_message = {
        'type': 'new_message',
        'message': {k: v for k, v in message_doc.items() if k != '_id'}
    }
    
    # Send to relevant WebSocket clients
    for client_id, ws_data in list(connected_clients.items()):
        should_send = False
        
        if message_type == 'broadcast':
            # Send broadcast to all HQ clients and all patrol clients for this HQ
            should_send = client_id.startswith(hq_id) or client_id.startswith(f'patrol_')
        elif sender_type == 'hq':
            # HQ to patrol - send to patrol and HQ
            should_send = client_id.startswith(hq_id) or client_id == f'patrol_{recipient_patrol_id}'
        else:
            # Patrol to HQ - send to HQ clients
            should_send = client_id.startswith(hq_id)
        
        if should_send:
            try:
                await ws_data['ws'].send_json(ws_message)
            except:
                pass
    
    message_doc.pop('_id', None)
    return {'success': True, 'message': message_doc}


@api_router.get("/messages")
async def get_messages(
    hq_id: str,
    patrol_id: Optional[str] = None,
    unread_only: bool = False,
    limit: int = 100
):
    """Get messages for an HQ or specific patrol"""
    db = get_db()
    
    if patrol_id:
        # Messages for a specific patrol (direct + broadcast)
        query = {
            'hq_id': hq_id,
            '$or': [
                {'recipient_patrol_id': patrol_id},
                {'sender_id': patrol_id},
                {'message_type': 'broadcast'}
            ]
        }
    else:
        # All messages for HQ
        query = {'hq_id': hq_id}
    
    if unread_only:
        query['read'] = False
    
    messages = await db.messages.find(
        query,
        {'_id': 0}
    ).sort('timestamp', -1).limit(limit).to_list(limit)
    
    return messages


@api_router.get("/messages/conversation/{patrol_id}")
async def get_conversation(hq_id: str, patrol_id: str, limit: int = 50):
    """Get conversation between HQ and a specific patrol"""
    db = get_db()
    
    query = {
        'hq_id': hq_id,
        '$or': [
            {'recipient_patrol_id': patrol_id},
            {'sender_id': patrol_id, 'sender_type': 'patrol'}
        ]
    }
    
    messages = await db.messages.find(
        query,
        {'_id': 0}
    ).sort('timestamp', 1).limit(limit).to_list(limit)
    
    return messages


@api_router.patch("/messages/{message_id}/read")
async def mark_message_read(message_id: str):
    """Mark a message as read"""
    db = get_db()
    
    result = await db.messages.update_one(
        {'id': message_id},
        {'$set': {'read': True, 'read_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return {'success': True}


@api_router.patch("/messages/mark-all-read")
async def mark_all_messages_read(hq_id: str, patrol_id: Optional[str] = None):
    """Mark all messages as read for HQ or patrol"""
    db = get_db()
    
    query = {'hq_id': hq_id, 'read': False}
    if patrol_id:
        query['$or'] = [
            {'recipient_patrol_id': patrol_id},
            {'message_type': 'broadcast'}
        ]
    
    result = await db.messages.update_many(
        query,
        {'$set': {'read': True, 'read_at': datetime.now(timezone.utc).isoformat()}}
    )
    
    return {'success': True, 'updated_count': result.modified_count}


@api_router.get("/messages/unread-count")
async def get_unread_count(hq_id: str, patrol_id: Optional[str] = None):
    """Get count of unread messages"""
    db = get_db()
    
    if patrol_id:
        query = {
            'hq_id': hq_id,
            'read': False,
            '$or': [
                {'recipient_patrol_id': patrol_id},
                {'message_type': 'broadcast'}
            ]
        }
    else:
        query = {'hq_id': hq_id, 'read': False, 'sender_type': 'patrol'}
    
    count = await db.messages.count_documents(query)
    return {'unread_count': count}


# ==========================================
# ENHANCED SOS WITH AUTO-DETECTION
# ==========================================

@api_router.get("/sos/active")
async def get_active_sos_alerts(hq_id: str):
    """Get all active SOS alerts for an HQ"""
    db = get_db()
    
    query = {'resolved': False}
    if hq_id != 'SUPER_ADMIN':
        query['hq_id'] = hq_id
    
    alerts = await db.sos_alerts.find(
        query,
        {'_id': 0}
    ).sort('timestamp', -1).to_list(100)
    
    # Enrich with patrol info
    for alert in alerts:
        patrol = await db.patrols.find_one(
            {'id': alert.get('patrol_id')},
            {'_id': 0, 'name': 1, 'unit': 1, 'assigned_area': 1}
        )
        if patrol:
            alert['patrol_name'] = patrol.get('name')
            alert['patrol_unit'] = patrol.get('unit')
            alert['patrol_area'] = patrol.get('assigned_area')
    
    return alerts


@api_router.post("/sos/resolve/{patrol_id}")
async def resolve_sos_alert(patrol_id: str):
    """Resolve an SOS alert"""
    db = get_db()
    
    # Update all unresolved alerts for this patrol
    result = await db.sos_alerts.update_many(
        {'patrol_id': patrol_id, 'resolved': False},
        {'$set': {
            'resolved': True,
            'resolved_at': datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update patrol status back to active
    await db.patrols.update_one(
        {'id': patrol_id},
        {'$set': {'status': 'active'}}
    )
    
    # Broadcast resolution
    patrol = await db.patrols.find_one({'id': patrol_id}, {'_id': 0, 'hq_id': 1})
    if patrol:
        hq_id = patrol.get('hq_id')
        for client_id, ws_data in list(connected_clients.items()):
            if client_id.startswith(hq_id):
                try:
                    await ws_data['ws'].send_json({
                        'type': 'sos_resolved',
                        'patrol_id': patrol_id
                    })
                except:
                    pass
    
    return {'success': True, 'resolved_count': result.modified_count}


@api_router.post("/inactivity/config")
async def set_inactivity_config(config: InactivityConfig):
    """Configure inactivity-based SOS detection for an HQ"""
    db = get_db()
    
    await db.hq_users.update_one(
        {'hq_id': config.hq_id},
        {'$set': {
            'inactivity_config': {
                'enabled': config.enabled,
                'threshold_minutes': config.threshold_minutes
            }
        }}
    )
    
    return {'success': True}


@api_router.get("/inactivity/config/{hq_id}")
async def get_inactivity_config(hq_id: str):
    """Get inactivity configuration for an HQ"""
    db = get_db()
    
    hq = await db.hq_users.find_one({'hq_id': hq_id}, {'_id': 0, 'inactivity_config': 1})
    
    if not hq or not hq.get('inactivity_config'):
        return {
            'enabled': True,
            'threshold_minutes': 30
        }
    
    return hq.get('inactivity_config')


@api_router.get("/inactivity/check")
async def check_patrol_inactivity(hq_id: str):
    """
    Check for inactive patrols and trigger auto SOS if needed.
    Returns list of patrols that triggered auto-SOS.
    """
    db = get_db()
    
    # Get HQ inactivity config
    hq = await db.hq_users.find_one({'hq_id': hq_id}, {'_id': 0, 'inactivity_config': 1})
    config = hq.get('inactivity_config', {'enabled': True, 'threshold_minutes': 30}) if hq else {'enabled': True, 'threshold_minutes': 30}
    
    if not config.get('enabled', True):
        return {'auto_sos_triggered': [], 'inactive_patrols': []}
    
    threshold_minutes = config.get('threshold_minutes', 30)
    threshold_time = datetime.now(timezone.utc) - timedelta(minutes=threshold_minutes)
    
    # Find active tracking patrols with no recent updates
    query = {
        'hq_id': hq_id,
        'is_tracking': True,
        'status': {'$nin': ['sos', 'finished', 'inactive']}
    }
    
    tracking_patrols = await db.patrols.find(query, {'_id': 0}).to_list(500)
    
    inactive_patrols = []
    auto_sos_triggered = []
    
    for patrol in tracking_patrols:
        last_update = patrol.get('last_update')
        if isinstance(last_update, str):
            try:
                last_update = datetime.fromisoformat(last_update.replace('Z', '+00:00'))
            except:
                continue
        
        if last_update and last_update < threshold_time:
            inactive_minutes = int((datetime.now(timezone.utc) - last_update).total_seconds() / 60)
            
            inactive_patrols.append({
                'patrol_id': patrol['id'],
                'patrol_name': patrol.get('name'),
                'last_update': patrol.get('last_update'),
                'inactive_minutes': inactive_minutes
            })
            
            # Check if SOS already triggered for this inactivity
            existing_sos = await db.sos_alerts.find_one({
                'patrol_id': patrol['id'],
                'auto_triggered': True,
                'resolved': False
            })
            
            if not existing_sos:
                # Trigger auto SOS
                sos_doc = {
                    'patrol_id': patrol['id'],
                    'hq_id': hq_id,
                    'message': f'AUTO SOS: No movement detected for {inactive_minutes} minutes',
                    'latitude': patrol.get('latitude', 0),
                    'longitude': patrol.get('longitude', 0),
                    'timestamp': datetime.now(timezone.utc).isoformat(),
                    'resolved': False,
                    'auto_triggered': True
                }
                
                await db.sos_alerts.insert_one(sos_doc)
                await db.patrols.update_one(
                    {'id': patrol['id']},
                    {'$set': {'status': 'sos'}}
                )
                
                auto_sos_triggered.append({
                    'patrol_id': patrol['id'],
                    'patrol_name': patrol.get('name'),
                    'inactive_minutes': inactive_minutes
                })
                
                # Broadcast SOS alert
                for client_id, ws_data in list(connected_clients.items()):
                    if client_id.startswith(hq_id):
                        try:
                            await ws_data['ws'].send_json({
                                'type': 'sos_alert',
                                'data': {
                                    'patrol_id': patrol['id'],
                                    'patrol_name': patrol.get('name'),
                                    'message': sos_doc['message'],
                                    'latitude': sos_doc['latitude'],
                                    'longitude': sos_doc['longitude'],
                                    'timestamp': sos_doc['timestamp'],
                                    'auto_triggered': True
                                }
                            })
                        except:
                            pass
    
    return {
        'auto_sos_triggered': auto_sos_triggered,
        'inactive_patrols': inactive_patrols,
        'config': config
    }


app.include_router(api_router)

@app.get("/")
async def root():
    return {"message": "Military Patrol Tracking API - Powered by BA-8993 Major Wahid"}

@app.get("/health")
async def health_check():
    return {
        "status": "operational",
        "mqtt_enabled": MQTT_ENABLED,
        "websocket_clients": len(connected_clients)
    }

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
