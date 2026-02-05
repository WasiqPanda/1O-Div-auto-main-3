from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import os
from dotenv import load_dotenv
import certifi

load_dotenv()

# Environment variables expected in Render:
# - MONGO_URL: MongoDB Atlas URI (recommended format: mongodb+srv://.../<db>?retryWrites=true&w=majority)
# - DB_NAME:  Database name (e.g., patrol_db)
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

# Optional (debug only): set to "true" to allow invalid certs if you are diagnosing TLS issues.
MONGO_TLS_INSECURE = os.environ.get("MONGO_TLS_INSECURE", "false").strip().lower() in ("1", "true", "yes")

client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None


async def init_db():
    global client, db

    if not MONGO_URL:
        raise RuntimeError("MONGO_URL environment variable is not set.")
    if not DB_NAME:
        raise RuntimeError("DB_NAME environment variable is not set.")

    try:
        # MongoDB Atlas requires TLS. certifi provides the CA bundle for verification.
        # Timeouts prevent the app from hanging forever during startup.
        client = AsyncIOMotorClient(
            MONGO_URL,
            tls=True,
            tlsCAFile=certifi.where(),
            tlsAllowInvalidCertificates=MONGO_TLS_INSECURE,
            serverSelectionTimeoutMS=30000,
            connectTimeoutMS=20000,
            socketTimeoutMS=20000,
        )

        db = client[DB_NAME]

        # Create indexes
        await db.patrols.create_index("id", unique=True)
        await db.patrols.create_index("leader_email")
        await db.patrols.create_index("status")
        await db.patrols.create_index("hq_id")  # Index for HQ filtering

        await db.hq_users.create_index("hq_id", unique=True)
        await db.hq_users.create_index("username", unique=True)

        await db.soldiers.create_index("id", unique=True)
        await db.soldiers.create_index("email", unique=True)

        await db.locations.create_index("patrol_id")
        await db.locations.create_index("timestamp")
        await db.locations.create_index([("location", "2dsphere")])

        await db.trails.create_index("patrol_id")

        await db.access_codes.create_index("code", unique=True)
        await db.access_codes.create_index("patrol_id")
        await db.access_codes.create_index("expires_at")

        await db.sos_alerts.create_index("patrol_id")
        await db.sos_alerts.create_index("timestamp")

        print("Database connected successfully")
    except Exception as e:
        print(f"Error connecting to database: {e}")
        raise


async def close_db():
    global client
    if client:
        client.close()
        print("Database connection closed")


def get_db():
    return db
