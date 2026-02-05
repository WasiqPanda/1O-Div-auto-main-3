"""
Security Module for Military Patrol Tracker
Implements authentication, authorization, and protection against common attacks
"""
import os
import re
import hashlib
import secrets
import bleach
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from functools import wraps

import bcrypt
from jose import JWTError, jwt
from fastapi import HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# =============================================================================
# CONFIGURATION
# =============================================================================

# JWT Configuration
JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_HOURS = 24
JWT_REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password Configuration
PASSWORD_MIN_LENGTH = 8
PASSWORD_REQUIRE_UPPERCASE = True
PASSWORD_REQUIRE_LOWERCASE = True
PASSWORD_REQUIRE_DIGIT = True
PASSWORD_REQUIRE_SPECIAL = False

# Rate Limiting (handled by slowapi in server.py)
LOGIN_RATE_LIMIT = "5/minute"
API_RATE_LIMIT = "100/minute"
SOS_RATE_LIMIT = "10/minute"

# Session Configuration
MAX_FAILED_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

# Input Sanitization
ALLOWED_HTML_TAGS = []  # No HTML allowed
ALLOWED_HTML_ATTRS = {}

# Security Headers
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://meet.jit.si; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:; frame-src https://meet.jit.si;",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(self), microphone=(self), camera=(self)"
}

# =============================================================================
# PASSWORD HASHING
# =============================================================================

def hash_password(password: str) -> str:
    """Hash password using bcrypt with salt"""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash"""
    try:
        # Handle legacy plain text passwords (for migration)
        if not hashed_password.startswith('$2'):
            return plain_password == hashed_password
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def validate_password_strength(password: str) -> tuple[bool, str]:
    """Validate password meets security requirements"""
    if len(password) < PASSWORD_MIN_LENGTH:
        return False, f"Password must be at least {PASSWORD_MIN_LENGTH} characters"
    
    if PASSWORD_REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if PASSWORD_REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if PASSWORD_REQUIRE_DIGIT and not re.search(r'\d', password):
        return False, "Password must contain at least one digit"
    
    if PASSWORD_REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"
    
    # Check for common weak passwords
    weak_passwords = ['password', '12345678', 'qwerty', 'admin123', 'letmein']
    if password.lower() in weak_passwords:
        return False, "Password is too common. Please choose a stronger password"
    
    return True, "Password meets requirements"

# =============================================================================
# JWT TOKEN MANAGEMENT
# =============================================================================

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=JWT_ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access"
    })
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def create_refresh_token(data: dict) -> str:
    """Create JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh"
    })
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    """Decode and validate JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None

def verify_token(token: str, token_type: str = "access") -> Optional[dict]:
    """Verify token and check type"""
    payload = decode_token(token)
    if payload and payload.get("type") == token_type:
        return payload
    return None

# =============================================================================
# INPUT SANITIZATION
# =============================================================================

def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent XSS and injection attacks"""
    if not text:
        return text
    
    # Remove HTML tags
    cleaned = bleach.clean(text, tags=ALLOWED_HTML_TAGS, attributes=ALLOWED_HTML_ATTRS, strip=True)
    
    # Remove potential NoSQL injection patterns
    cleaned = re.sub(r'[\$\{\}]', '', cleaned)
    
    # Limit length to prevent DoS
    return cleaned[:10000]

def sanitize_dict(data: dict) -> dict:
    """Sanitize all string values in a dictionary"""
    sanitized = {}
    for key, value in data.items():
        if isinstance(value, str):
            sanitized[key] = sanitize_input(value)
        elif isinstance(value, dict):
            sanitized[key] = sanitize_dict(value)
        elif isinstance(value, list):
            sanitized[key] = [sanitize_input(v) if isinstance(v, str) else v for v in value]
        else:
            sanitized[key] = value
    return sanitized

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_patrol_id(patrol_id: str) -> bool:
    """Validate patrol ID format (alphanumeric only)"""
    return bool(re.match(r'^[a-zA-Z0-9_-]+$', patrol_id))

def validate_coordinates(lat: float, lng: float) -> bool:
    """Validate GPS coordinates"""
    return -90 <= lat <= 90 and -180 <= lng <= 180

# =============================================================================
# ACCOUNT LOCKOUT
# =============================================================================

# In-memory storage for failed login attempts (use Redis in production)
_failed_attempts: Dict[str, Dict[str, Any]] = {}

def record_failed_login(username: str) -> None:
    """Record a failed login attempt"""
    now = datetime.now(timezone.utc)
    if username not in _failed_attempts:
        _failed_attempts[username] = {"count": 0, "first_attempt": now, "locked_until": None}
    
    _failed_attempts[username]["count"] += 1
    _failed_attempts[username]["last_attempt"] = now
    
    if _failed_attempts[username]["count"] >= MAX_FAILED_LOGIN_ATTEMPTS:
        _failed_attempts[username]["locked_until"] = now + timedelta(minutes=LOCKOUT_DURATION_MINUTES)

def clear_failed_attempts(username: str) -> None:
    """Clear failed login attempts after successful login"""
    if username in _failed_attempts:
        del _failed_attempts[username]

def is_account_locked(username: str) -> tuple[bool, Optional[int]]:
    """Check if account is locked due to failed attempts"""
    if username not in _failed_attempts:
        return False, None
    
    record = _failed_attempts[username]
    if record.get("locked_until"):
        now = datetime.now(timezone.utc)
        if now < record["locked_until"]:
            remaining = int((record["locked_until"] - now).total_seconds() / 60)
            return True, remaining
        else:
            # Lockout expired, clear record
            del _failed_attempts[username]
    
    return False, None

def get_remaining_attempts(username: str) -> int:
    """Get remaining login attempts before lockout"""
    if username not in _failed_attempts:
        return MAX_FAILED_LOGIN_ATTEMPTS
    return max(0, MAX_FAILED_LOGIN_ATTEMPTS - _failed_attempts[username]["count"])

# =============================================================================
# SECURITY LOGGING
# =============================================================================

def log_security_event(event_type: str, details: dict, request: Optional[Request] = None) -> None:
    """Log security-related events"""
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "details": details
    }
    
    if request:
        log_entry["ip"] = request.client.host if request.client else "unknown"
        log_entry["user_agent"] = request.headers.get("user-agent", "unknown")
        log_entry["path"] = str(request.url.path)
    
    # In production, send to proper logging service
    print(f"[SECURITY] {log_entry}")

# =============================================================================
# AUTHORIZATION HELPERS
# =============================================================================

class JWTBearer(HTTPBearer):
    """JWT Bearer token authentication"""
    
    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)
    
    async def __call__(self, request: Request) -> Optional[dict]:
        credentials: HTTPAuthorizationCredentials = await super().__call__(request)
        if credentials:
            if credentials.scheme != "Bearer":
                raise HTTPException(status_code=403, detail="Invalid authentication scheme")
            
            payload = verify_token(credentials.credentials)
            if not payload:
                raise HTTPException(status_code=403, detail="Invalid or expired token")
            
            return payload
        raise HTTPException(status_code=403, detail="Invalid authorization code")

def require_hq_access(payload: dict, hq_id: str) -> bool:
    """Check if token has access to specific HQ"""
    token_hq_id = payload.get("hq_id")
    is_super_admin = payload.get("is_super_admin", False)
    return is_super_admin or token_hq_id == hq_id

def require_super_admin(payload: dict) -> bool:
    """Check if token belongs to super admin"""
    return payload.get("is_super_admin", False)

# =============================================================================
# CSRF PROTECTION
# =============================================================================

def generate_csrf_token() -> str:
    """Generate CSRF token"""
    return secrets.token_urlsafe(32)

def validate_csrf_token(token: str, stored_token: str) -> bool:
    """Validate CSRF token"""
    return secrets.compare_digest(token, stored_token)

# =============================================================================
# API KEY GENERATION
# =============================================================================

def generate_api_key() -> str:
    """Generate secure API key"""
    return f"mpt_{secrets.token_urlsafe(32)}"

def hash_api_key(api_key: str) -> str:
    """Hash API key for storage"""
    return hashlib.sha256(api_key.encode()).hexdigest()
