# backend/database.py
import os
import certifi
from motor.motor_asyncio import AsyncIOMotorClient

_client: AsyncIOMotorClient | None = None
_db = None

def get_db():
    if _db is None:
        raise RuntimeError("Database not initialized. Call init_db() first.")
    return _db

async def init_db():
    global _client, _db

    mongo_uri = os.environ.get("MONGO_URI")
    db_name = os.environ.get("MONGO_DB", "patrol_db")

    if not mongo_uri:
        raise RuntimeError("MONGO_URI is not set in environment variables")

    # Important TLS / SSL settings for MongoDB Atlas
    _client = AsyncIOMotorClient(
        mongo_uri,
        tls=True,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=20000,
        connectTimeoutMS=20000,
        socketTimeoutMS=20000,
        retryWrites=True,
    )

    _db = _client[db_name]

    # Force a ping to verify connection at startup
    await _db.command("ping")
    return True

async def close_db():
    global _client, _db
    if _client:
        _client.close()
    _client = None
    _db = None
