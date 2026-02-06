# database.py
import os
import certifi
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase


_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


def _get_env(name: str, default: Optional[str] = None) -> str:
    val = os.environ.get(name, default)
    if not val:
        raise RuntimeError(f"{name} is not set")
    return val


def _bool_env(name: str, default: str = "false") -> bool:
    return os.environ.get(name, default).lower() in ("1", "true", "yes", "y", "on")


async def init_db() -> AsyncIOMotorDatabase:
    """
    Initialize MongoDB connection (MongoDB Atlas friendly).
    Call this once at app startup.
    """
    global _client, _db

    mongo_uri = _get_env("MONGO_URI")
    db_name = os.environ.get("MONGO_DB", "patrol_db")

    # Optional toggles (keep false in production)
    tls_insecure = _bool_env("MONGO_TLS_INSECURE", "false")  # troubleshooting only
    allow_invalid_hostnames = _bool_env("MONGO_TLS_ALLOW_INVALID_HOSTNAMES", "false")

    # ---- Attempt 1: Strict TLS with CA bundle (recommended) ----
    try:
        _client = AsyncIOMotorClient(
            mongo_uri,
            tls=True,
            tlsCAFile=certifi.where(),
            tlsAllowInvalidCertificates=tls_insecure,
            tlsAllowInvalidHostnames=allow_invalid_hostnames,
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=20000,
            socketTimeoutMS=20000,
            retryWrites=True,
            appName=os.environ.get("APP_NAME", "patrol-tracking-render"),
        )
        await _client.admin.command("ping")
        _db = _client[db_name]
        return _db
    except Exception as e1:
        # Close the failed client cleanly
        try:
            if _client:
                _client.close()
        except Exception:
            pass
        _client = None

        # ---- Attempt 2: Let URI drive TLS (some SRV URIs work better this way) ----
        # This avoids forcing tls=True if Atlas SRV already negotiates it.
        _client = AsyncIOMotorClient(
            mongo_uri,
            tlsCAFile=certifi.where(),
            tlsAllowInvalidCertificates=tls_insecure,
            tlsAllowInvalidHostnames=allow_invalid_hostnames,
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=20000,
            socketTimeoutMS=20000,
            retryWrites=True,
            appName=os.environ.get("APP_NAME", "patrol-tracking-render"),
        )
        try:
            await _client.admin.command("ping")
        except Exception as e2:
            # Raise the clearest combined error for logs
            raise RuntimeError(
                f"MongoDB connection failed.\n"
                f"Attempt-1 error: {repr(e1)}\n"
                f"Attempt-2 error: {repr(e2)}\n"
                f"Check Atlas Network Access + MONGO_URI format."
            )

        _db = _client[db_name]
        return _db


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() at startup.")
    return _db


async def close_db() -> None:
    global _client, _db
    if _client is not None:
        _client.close()
    _client = None
    _db = None
