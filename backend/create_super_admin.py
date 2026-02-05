import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

async def create_super_admin():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("Creating super admin account...")
    
    # Check if already exists
    existing = await db.hq_users.find_one({'username': 'Wahid_Al_Towsif'})
    if existing:
        print("✓ Super admin already exists")
        client.close()
        return
    
    super_admin = {
        'hq_id': 'SUPER_ADMIN',
        'username': 'Wahid_Al_Towsif',
        'password': '1@mH@ppy',
        'hq_name': 'System Administrator',
        'location': 'Central Command',
        'is_super_admin': True,
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    
    await db.hq_users.insert_one(super_admin)
    print("✓ Super admin account created successfully!")
    print(f"   Username: Wahid_Al_Towsif")
    print(f"   Password: 1@mH@ppy")
    print(f"   Role: Super Administrator (Can view all HQs)")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(create_super_admin())
