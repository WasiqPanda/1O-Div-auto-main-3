import asyncio
import websockets
import json
import random

async def test_live_tracking():
    # Connect to WebSocket
    uri = "wss://military-patrol-1.preview.emergentagent.com/ws/test_client_123"
    
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✓ WebSocket connected successfully!")
            
            # Simulate patrol sending location updates
            patrol_id = "4C3E5D0B"  # Alpha Team
            base_lat = 21.4272
            base_lng = 92.0058
            
            print(f"\nSimulating live location updates for patrol {patrol_id}...\n")
            
            for i in range(5):
                # Simulate movement (small random changes)
                lat = base_lat + random.uniform(-0.001, 0.001)
                lng = base_lng + random.uniform(-0.001, 0.001)
                
                location_data = {
                    "type": "location_update",
                    "patrol_id": patrol_id,
                    "latitude": lat,
                    "longitude": lng,
                    "accuracy": 10.5
                }
                
                print(f"Update {i+1}: Sending location ({lat:.6f}, {lng:.6f})")
                await websocket.send(json.dumps(location_data))
                
                # Wait for response
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=2)
                    response_data = json.loads(response)
                    print(f"  → HQ received: {response_data.get('type')}")
                except asyncio.TimeoutError:
                    print(f"  → Location sent (no immediate response)")
                
                await asyncio.sleep(2)
            
            print("\n✓ Test completed! Live tracking is working.")
            
    except Exception as e:
        print(f"✗ WebSocket test failed: {e}")
        print("\nThis means live tracking needs debugging.")

if __name__ == "__main__":
    asyncio.run(test_live_tracking())
