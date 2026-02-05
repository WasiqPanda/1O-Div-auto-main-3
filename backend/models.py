from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from enum import Enum

class PatrolStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    ASSIGNED = "assigned"
    SOS = "sos"

class LocationPoint(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    timestamp: datetime

class Soldier(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    name: str
    email: str
    rank: Optional[str] = None
    unit: Optional[str] = None

class PatrolCreate(BaseModel):
    name: str
    camp_name: str
    unit: str
    leader_email: str
    phone_number: Optional[str] = None  # Mobile number for direct contact
    assigned_area: str
    soldier_ids: List[str]
    hq_id: str  # Added HQ association

class PatrolUpdate(BaseModel):
    latitude: float
    longitude: float
    status: Optional[PatrolStatus] = None
    accuracy: Optional[float] = None

class PatrolResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    name: str
    camp_name: str
    unit: str
    latitude: float
    longitude: float
    status: str  # Changed from PatrolStatus to str to allow 'finished'
    assigned_area: str
    leader_email: str
    phone_number: Optional[str] = None  # Mobile number
    soldier_count: int = 0  # Made optional with default
    last_update: datetime
    is_tracking: bool = False
    is_approved: bool = False
    code_verified: bool = False
    session_ended: Optional[str] = None
    hq_id: str  # Added HQ association

class TrailPoint(BaseModel):
    latitude: float
    longitude: float
    timestamp: datetime

class PatrolTrailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    patrol_id: str
    points: List[TrailPoint]
    total_distance: float

class AccessCode(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    code: str
    patrol_id: str
    email: str
    created_at: datetime
    expires_at: datetime
    is_used: bool = False

class CodeVerification(BaseModel):
    code: str
    email: str

class HQCreate(BaseModel):
    username: str
    password: str
    hq_name: str
    location: str

class HQResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    hq_id: str
    username: str
    hq_name: str
    location: str
    created_at: datetime

class HQLogin(BaseModel):
    username: str
    password: str

class HQLoginResponse(BaseModel):
    success: bool
    token: str
    hq_id: str
    hq_name: str
    role: str

class SOSAlert(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    patrol_id: str
    latitude: float
    longitude: float
    message: Optional[str] = "EMERGENCY SOS"
    timestamp: Optional[datetime] = None
    resolved: bool = False
    auto_triggered: bool = False  # True if triggered by inactivity detection


# Message Types
class MessageType(str, Enum):
    DIRECT = "direct"  # HQ to specific patrol or patrol to HQ
    BROADCAST = "broadcast"  # HQ to all patrols


class MessageCreate(BaseModel):
    """Create a new message"""
    content: str
    recipient_patrol_id: Optional[str] = None  # None for broadcast
    message_type: MessageType = MessageType.DIRECT


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: str
    content: str
    sender_id: str  # HQ ID or Patrol ID
    sender_name: str
    sender_type: str  # "hq" or "patrol"
    recipient_patrol_id: Optional[str] = None
    hq_id: str
    message_type: str
    timestamp: datetime
    read: bool = False
    read_at: Optional[datetime] = None


class InactivityConfig(BaseModel):
    """Configuration for inactivity-based SOS detection"""
    enabled: bool = True
    threshold_minutes: int = 30  # Trigger SOS if no movement for this duration
    hq_id: str