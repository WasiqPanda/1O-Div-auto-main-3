"""
MQTT Bridge Service for Low-Network Patrol Location Updates
Bridges MQTT messages to WebSocket for real-time dashboard updates
"""
import asyncio
import json
import os
from datetime import datetime, timezone
from typing import Dict, Set
import paho.mqtt.client as mqtt
from motor.motor_asyncio import AsyncIOMotorClient

# Configuration
MQTT_BROKER_HOST = os.environ.get('MQTT_BROKER_HOST', 'localhost')
MQTT_BROKER_PORT = int(os.environ.get('MQTT_BROKER_PORT', '1883'))
MQTT_USERNAME = os.environ.get('MQTT_USERNAME', 'patrol_bridge')
MQTT_PASSWORD = os.environ.get('MQTT_PASSWORD', '')  # Empty string if not set - allows anonymous
MQTT_TOPIC_LOCATION = 'patrol/+/location'  # patrol/{patrol_id}/location
MQTT_TOPIC_SOS = 'patrol/+/sos'  # patrol/{patrol_id}/sos
MQTT_TOPIC_STATUS = 'patrol/+/status'  # patrol/{patrol_id}/status

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# WebSocket clients to broadcast to (shared with server.py)
websocket_clients: Dict[str, Set] = {}

class MQTTBridge:
    def __init__(self):
        self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="patrol_bridge")
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect
        
        # Set authentication only if password is provided
        if MQTT_PASSWORD:
            self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
        
        self.db = None
        self.loop = None
        
    async def init_db(self):
        """Initialize database connection"""
        mongo_client = AsyncIOMotorClient(MONGO_URL)
        self.db = mongo_client[DB_NAME]
        
    def on_connect(self, client, userdata, flags, rc, properties=None):
        """Called when connected to MQTT broker"""
        print(f"MQTT Connected with result code {rc}")
        # Subscribe to patrol topics
        client.subscribe(MQTT_TOPIC_LOCATION)
        client.subscribe(MQTT_TOPIC_SOS)
        client.subscribe(MQTT_TOPIC_STATUS)
        print(f"Subscribed to: {MQTT_TOPIC_LOCATION}, {MQTT_TOPIC_SOS}, {MQTT_TOPIC_STATUS}")
        
    def on_disconnect(self, client, userdata, rc, properties=None, reason_code=None):
        """Called when disconnected from MQTT broker"""
        print(f"MQTT Disconnected with result code {rc}")
        
    def on_message(self, client, userdata, msg):
        """Handle incoming MQTT messages"""
        try:
            topic_parts = msg.topic.split('/')
            if len(topic_parts) < 3:
                return
                
            patrol_id = topic_parts[1]
            message_type = topic_parts[2]
            
            payload = json.loads(msg.payload.decode('utf-8'))
            
            # Process message in async context
            if self.loop:
                asyncio.run_coroutine_threadsafe(
                    self.process_message(patrol_id, message_type, payload),
                    self.loop
                )
        except Exception as e:
            print(f"Error processing MQTT message: {e}")
            
    async def process_message(self, patrol_id: str, message_type: str, payload: dict):
        """Process MQTT message and update database/broadcast to WebSocket"""
        try:
            timestamp = datetime.now(timezone.utc).isoformat()
            
            if message_type == 'location':
                # Update patrol location in database
                latitude = payload.get('lat') or payload.get('latitude')
                longitude = payload.get('lng') or payload.get('longitude')
                
                if latitude and longitude:
                    # Calculate session date using Bangladesh timezone (UTC+6)
                    now_utc = datetime.now(timezone.utc)
                    BD_OFFSET = timedelta(hours=6)
                    now_bd = now_utc + BD_OFFSET
                    session_date = now_bd.strftime('%Y-%m-%d')
                    
                    # Get patrol's current session info
                    patrol = await self.db.patrols.find_one({'id': patrol_id}, {'session_date': 1})
                    patrol_session_date = patrol.get('session_date') if patrol else session_date
                    
                    await self.db.patrols.update_one(
                        {'id': patrol_id},
                        {
                            '$set': {
                                'latitude': float(latitude),
                                'longitude': float(longitude),
                                'last_update': timestamp,
                                'last_location_time': timestamp,
                                'is_tracking': True,
                                'tracking_stopped': False,
                                'session_date': patrol_session_date or session_date
                            },
                            '$push': {
                                'trail': {
                                    '$each': [{
                                        'lat': float(latitude), 
                                        'lng': float(longitude), 
                                        'timestamp': timestamp, 
                                        'session_date': patrol_session_date or session_date
                                    }],
                                    '$slice': -5000
                                }
                            }
                        }
                    )
                    
                    # Broadcast to WebSocket clients
                    await self.broadcast_location_update(patrol_id, latitude, longitude, timestamp)
                    
            elif message_type == 'sos':
                # Handle SOS alert
                message = payload.get('message', 'SOS ALERT')
                latitude = payload.get('lat') or payload.get('latitude')
                longitude = payload.get('lng') or payload.get('longitude')
                
                # Get patrol info for HQ ID
                patrol = await self.db.patrols.find_one({'id': patrol_id})
                if patrol:
                    # Create notification
                    notification = {
                        'id': f'SOS_{patrol_id}_{int(datetime.now().timestamp())}',
                        'hq_id': patrol.get('hq_id'),
                        'patrol_id': patrol_id,
                        'message': f"SOS from {patrol.get('name', patrol_id)}: {message}",
                        'level': 'critical',
                        'latitude': latitude,
                        'longitude': longitude,
                        'timestamp': timestamp,
                        'read': False
                    }
                    await self.db.notifications.insert_one(notification)
                    
                    # Broadcast SOS alert
                    await self.broadcast_sos_alert(patrol.get('hq_id'), patrol_id, message, latitude, longitude, timestamp)
                    
            elif message_type == 'status':
                # Update patrol status
                status = payload.get('status', 'active')
                await self.db.patrols.update_one(
                    {'id': patrol_id},
                    {'$set': {'status': status, 'last_update': timestamp}}
                )
                
        except Exception as e:
            print(f"Error processing {message_type} message for {patrol_id}: {e}")
            
    async def broadcast_location_update(self, patrol_id: str, latitude: float, longitude: float, timestamp: str):
        """Broadcast location update to all connected WebSocket clients"""
        # Get patrol to find HQ ID
        patrol = await self.db.patrols.find_one({'id': patrol_id})
        if not patrol:
            return
            
        hq_id = patrol.get('hq_id')
        message = json.dumps({
            'type': 'patrol_location',
            'patrol_id': patrol_id,
            'latitude': latitude,
            'longitude': longitude,
            'timestamp': timestamp
        })
        
        # Broadcast to HQ WebSocket clients (if connected)
        from server import connected_clients
        for client_id, client_data in list(connected_clients.items()):
            if client_id.startswith(hq_id):
                try:
                    ws = client_data['ws'] if isinstance(client_data, dict) else client_data
                    await ws.send_text(message)
                except Exception as e:
                    print(f"WebSocket broadcast error to {client_id}: {e}")
                    
    async def broadcast_sos_alert(self, hq_id: str, patrol_id: str, message: str, latitude: float, longitude: float, timestamp: str):
        """Broadcast SOS alert to all connected WebSocket clients for the HQ"""
        alert_message = json.dumps({
            'type': 'sos_alert',
            'patrol_id': patrol_id,
            'message': message,
            'latitude': latitude,
            'longitude': longitude,
            'timestamp': timestamp
        })
        
        from server import connected_clients
        for client_id, client_data in list(connected_clients.items()):
            if client_id.startswith(hq_id):
                try:
                    ws = client_data['ws'] if isinstance(client_data, dict) else client_data
                    await ws.send_text(alert_message)
                except Exception as e:
                    print(f"SOS broadcast error to {client_id}: {e}")
                    
    def start(self, loop):
        """Start MQTT client"""
        self.loop = loop
        try:
            self.client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, 60)
            self.client.loop_start()
            print(f"MQTT Bridge started, connecting to {MQTT_BROKER_HOST}:{MQTT_BROKER_PORT}")
        except Exception as e:
            print(f"Failed to connect to MQTT broker: {e}")
            print("MQTT bridge will retry on next message")
            
    def stop(self):
        """Stop MQTT client"""
        self.client.loop_stop()
        self.client.disconnect()
        print("MQTT Bridge stopped")

# Global instance
mqtt_bridge = MQTTBridge()

async def start_mqtt_bridge():
    """Start the MQTT bridge service"""
    await mqtt_bridge.init_db()
    loop = asyncio.get_event_loop()
    mqtt_bridge.start(loop)
    
def stop_mqtt_bridge():
    """Stop the MQTT bridge service"""
    mqtt_bridge.stop()
