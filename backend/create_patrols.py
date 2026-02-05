import asyncio
import random
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone
import uuid

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']

# Cox's Bazar area coordinates
COX_BAZAR_BASE_LAT = 21.4272
COX_BAZAR_BASE_LNG = 92.0058

# Camp names in Cox's Bazar area
CAMPS = [
    "Cox's Bazar Base Camp",
    "Himchari Military Camp",
    "Inani Coastal Camp",
    "Teknaf Border Camp",
    "Ramu Strategic Camp",
    "Ukhiya Forward Camp",
    "Marine Drive Camp",
    "Chakaria Camp",
    "Maheshkhali Island Camp",
    "Kutubdia Naval Camp"
]

# Units
UNITS = [
    "10 Infantry Division",
    "24 Infantry Brigade",
    "36 Infantry Brigade", 
    "Bangladesh Rifles (BGB)",
    "Coast Guard Unit",
    "Military Police Battalion",
    "Engineering Corps",
    "Signals Battalion",
    "Artillery Regiment",
    "Armored Corps"
]

# Patrol areas
AREAS = [
    "Beach Sector Alpha",
    "Beach Sector Bravo",
    "Border Zone Charlie",
    "Border Zone Delta",
    "Coastal Road East",
    "Coastal Road West",
    "Hill Sector North",
    "Hill Sector South",
    "Marine Drive Route",
    "Downtown Patrol Zone",
    "Market Area Sector",
    "Residential Zone A",
    "Residential Zone B",
    "Industrial Area",
    "Port Security Zone"
]

# Patrol names
PATROL_NAMES = [
    "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel",
    "India", "Juliet", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa",
    "Quebec", "Romeo", "Sierra", "Tango", "Uniform", "Victor", "Whiskey", "X-ray",
    "Yankee", "Zulu"
]

async def clear_and_create_patrols():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("Clearing existing patrols...")
    await db.patrols.delete_many({})
    await db.locations.delete_many({})
    await db.trails.delete_many({})
    print("✓ Cleared existing data")
    
    print(f"\nCreating 229 patrols...")
    
    patrols = []
    for i in range(229):
        patrol_num = i + 1
        patrol_id = str(uuid.uuid4())[:8].upper()
        
        # Create varied names
        name_prefix = PATROL_NAMES[i % len(PATROL_NAMES)]
        name_suffix = f"Team {(i // len(PATROL_NAMES)) + 1}" if i >= len(PATROL_NAMES) else "Team"
        patrol_name = f"{name_prefix} {name_suffix}"
        
        # Assign camp and unit
        camp = CAMPS[i % len(CAMPS)]
        unit = UNITS[i % len(UNITS)]
        area = AREAS[i % len(AREAS)]
        
        # Generate location around Cox's Bazar (within ~30km radius)
        lat_offset = random.uniform(-0.27, 0.27)  # ~30km variation
        lng_offset = random.uniform(-0.27, 0.27)
        latitude = COX_BAZAR_BASE_LAT + lat_offset
        longitude = COX_BAZAR_BASE_LNG + lng_offset
        
        # Random status
        status_list = ['active', 'inactive', 'assigned']
        status = random.choice(status_list)
        
        patrol = {
            'id': patrol_id,
            'name': patrol_name,
            'camp_name': camp,
            'unit': unit,
            'leader_email': f"leader{patrol_num}@army.mil",
            'assigned_area': area,
            'soldier_ids': [],
            'soldier_count': random.randint(5, 15),
            'latitude': latitude,
            'longitude': longitude,
            'status': status,
            'last_update': datetime.now(timezone.utc).isoformat(),
            'is_tracking': status == 'active'
        }
        
        patrols.append(patrol)
        
        if (i + 1) % 50 == 0:
            print(f"  Created {i + 1} patrols...")
    
    # Insert all patrols
    await db.patrols.insert_many(patrols)
    print(f"✓ Successfully created {len(patrols)} patrols!")
    
    # Print summary
    print("\n=== SUMMARY ===")
    print(f"Total Patrols: {len(patrols)}")
    active = sum(1 for p in patrols if p['status'] == 'active')
    inactive = sum(1 for p in patrols if p['status'] == 'inactive')
    assigned = sum(1 for p in patrols if p['status'] == 'assigned')
    print(f"Active: {active}, Inactive: {inactive}, Assigned: {assigned}")
    
    # Show first 5 as examples
    print("\n=== SAMPLE PATROLS ===")
    for patrol in patrols[:5]:
        print(f"ID: {patrol['id']}")
        print(f"  Name: {patrol['name']}")
        print(f"  Camp: {patrol['camp_name']}")
        print(f"  Unit: {patrol['unit']}")
        print(f"  Area: {patrol['assigned_area']}")
        print(f"  Location: ({patrol['latitude']:.4f}, {patrol['longitude']:.4f})")
        print(f"  Status: {patrol['status']}")
        print()
    
    client.close()

if __name__ == "__main__":
    asyncio.run(clear_and_create_patrols())
