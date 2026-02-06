# database.py
import os
import certifi
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase


# Global client/db handles
_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


def _get_env(name: str, default: Optional[str] = None) -> str:
    val = os.environ.get(name, default)
    if not val:
        raise RuntimeError(f"{name} is not set")
    return val


async def init_db() -> AsyncIOMotorDatabase:
    """
    Initialize MongoDB connection (MongoDB Atlas friendly).
    Call this once at app startup.
    """
    global _client, _db

    mongo_uri = _get_env("MONGO_URI")
    db_name = os.environ.get("MONGO_DB", "patrol_db")

    # Create client with TLS CA bundle to avoid SSL handshake issues on some hosts
    _client = AsyncIOMotorClient(
        mongo_uri,
        tls=True,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=30000,
        connectTimeoutMS=20000,
        socketTimeoutMS=20000,
        retryWrites=True,
    )

    # Force a real connection test so errors show at startup
    await _client.admin.command("ping")

    _db = _client[db_name]
    return _db


def get_db() -> AsyncIOMotorDatabase:
    """
    Get DB handle after init_db() succeeded.
    """
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() at startup.")
    return _db


async def close_db() -> None:
    """
    Close Mongo client gracefully (call on shutdown).
    """
    global _client
    if _client is not None:
        _client.close()
        _client = None
