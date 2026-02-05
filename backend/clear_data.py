import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

async def clear_all_data():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("Clearing all existing data...")
    
    # Clear all collections
    await db.patrols.delete_many({})
    print("✓ Cleared patrols")
    
    await db.locations.delete_many({})
    print("✓ Cleared locations")
    
    await db.trails.delete_many({})
    print("✓ Cleared trails")
    
    await db.access_codes.delete_many({})
    print("✓ Cleared access codes")
    
    await db.soldiers.delete_many({})
    print("✓ Cleared soldiers")
    
    await db.sos_alerts.delete_many({})
    print("✓ Cleared SOS alerts")
    
    await db.hq_users.delete_many({})
    print("✓ Cleared HQ users")
    
    print("\n✓ All data cleared successfully!")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(clear_all_data())
