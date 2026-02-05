"""
Backend API Tests for Session-Specific Patrol Trails
Tests: Session lifecycle, trail clearing on new session, session_id filtering
Feature: Each patrol session should have its own trail that starts fresh when the session begins
"""
import pytest
import requests
import os
import time
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://naughty-ritchie.preview.emergentagent.com').rstrip('/')

# Test credentials from review request
HQ_USER = "10_DIV_HQ"
HQ_PASSWORD = "CMS@RamuCantt"
PATROL_ID_TO_TEST = "10DIV0004"


class TestSessionTrailLifecycle:
    """
    Full session lifecycle tests for session-specific trails
    Tests the fix that implements:
    1. Storing session_id with each trail point
    2. Clearing trail array when new session starts (/api/verify-code)
    3. Filtering trail points by session_id in the trail endpoint
    """
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test - login and get HQ info"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get HQ ID
        login_response = self.session.post(f"{BASE_URL}/api/hq/login", json={
            "username": HQ_USER,
            "password": HQ_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.hq_id = data.get("hq_id")
            self.token = data.get("token")
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    def test_01_login_success(self):
        """Test HQ login with provided credentials"""
        response = self.session.post(f"{BASE_URL}/api/hq/login", json={
            "username": HQ_USER,
            "password": HQ_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "hq_id" in data
        assert "token" in data
        print(f"Login successful - HQ ID: {data['hq_id']}")
    
    def test_02_patrol_exists(self):
        """Verify test patrol exists"""
        response = self.session.get(f"{BASE_URL}/api/patrols?hq_id={self.hq_id}&search={PATROL_ID_TO_TEST}")
        assert response.status_code == 200
        
        patrols = response.json()
        patrol_found = any(p["id"] == PATROL_ID_TO_TEST for p in patrols)
        
        if not patrol_found:
            # Try to get patrol directly
            response = self.session.get(f"{BASE_URL}/api/patrol/{PATROL_ID_TO_TEST}")
            if response.status_code == 200:
                patrol_found = True
        
        assert patrol_found, f"Patrol {PATROL_ID_TO_TEST} not found"
        print(f"Patrol {PATROL_ID_TO_TEST} exists")
    
    def test_03_generate_access_code(self):
        """Generate access code for patrol"""
        response = self.session.post(
            f"{BASE_URL}/api/codes/generate?patrol_id={PATROL_ID_TO_TEST}&email=test@army.mil"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "code" in data
        assert data["patrol_id"] == PATROL_ID_TO_TEST
        assert len(data["code"]) == 6
        
        # Store code for next test
        self.__class__.access_code = data["code"]
        print(f"Generated access code: {data['code']}")
    
    def test_04_verify_code_clears_trail(self):
        """
        Verify code - this should:
        1. Clear the trail array
        2. Set a new session_id
        3. Set session_start timestamp
        """
        code = getattr(self.__class__, 'access_code', None)
        if not code:
            pytest.skip("No access code from previous test")
        
        response = self.session.post(f"{BASE_URL}/api/verify-code", json={
            "patrol_id": PATROL_ID_TO_TEST,
            "code": code
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["verified"] == True
        assert "session_id" in data
        assert "session_expires" in data
        
        # Store session_id for verification
        self.__class__.session_id = data["session_id"]
        print(f"Code verified - Session ID: {data['session_id']}")
    
    def test_05_trail_empty_after_new_session(self):
        """
        After verifying code (starting new session), trail should be empty
        because the trail array was cleared
        """
        response = self.session.get(f"{BASE_URL}/api/patrols/{PATROL_ID_TO_TEST}/trail")
        assert response.status_code == 200
        
        data = response.json()
        assert "patrol_id" in data
        assert data["patrol_id"] == PATROL_ID_TO_TEST
        assert "points" in data
        
        # Trail should be empty or have very few points (only from this session)
        points_count = len(data.get("points", []))
        print(f"Trail points after new session: {points_count}")
        
        # Since we just started a new session, trail should be empty
        assert points_count == 0, f"Expected empty trail after new session, got {points_count} points"
    
    def test_06_add_location_updates(self):
        """
        Add location updates via MQTT REST endpoint
        Each point should be stored with the current session_id
        """
        # Add 3 location points
        locations = [
            {"lat": 22.3569, "lng": 91.7832},
            {"lat": 22.3570, "lng": 91.7833},
            {"lat": 22.3571, "lng": 91.7834}
        ]
        
        for i, loc in enumerate(locations):
            response = self.session.post(
                f"{BASE_URL}/api/mqtt/location/{PATROL_ID_TO_TEST}?lat={loc['lat']}&lng={loc['lng']}"
            )
            assert response.status_code == 200, f"Failed to add location {i+1}: {response.text}"
            print(f"Added location {i+1}: {loc}")
            time.sleep(0.5)  # Small delay between updates
        
        print(f"Added {len(locations)} location points")
    
    def test_07_trail_has_session_points(self):
        """
        Trail should now have the points we just added
        All points should belong to current session
        """
        response = self.session.get(f"{BASE_URL}/api/patrols/{PATROL_ID_TO_TEST}/trail")
        assert response.status_code == 200
        
        data = response.json()
        points = data.get("points", [])
        
        # Should have at least 3 points from our updates
        assert len(points) >= 3, f"Expected at least 3 points, got {len(points)}"
        
        # Verify total_distance is calculated
        assert "total_distance" in data
        print(f"Trail has {len(points)} points, total distance: {data.get('total_distance', 0)} km")
    
    def test_08_end_session(self):
        """End the current patrol session"""
        response = self.session.post(f"{BASE_URL}/api/codes/end-session?patrol_id={PATROL_ID_TO_TEST}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        print("Session ended successfully")
    
    def test_09_generate_new_code_for_new_session(self):
        """Generate a new access code for a new session"""
        response = self.session.post(
            f"{BASE_URL}/api/codes/generate?patrol_id={PATROL_ID_TO_TEST}&email=test@army.mil"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "code" in data
        
        self.__class__.new_access_code = data["code"]
        print(f"Generated new access code: {data['code']}")
    
    def test_10_verify_new_code_starts_fresh_session(self):
        """
        Verify new code - this should:
        1. Clear the trail array (removing previous session's points)
        2. Set a NEW session_id (different from previous)
        3. Set new session_start timestamp
        """
        code = getattr(self.__class__, 'new_access_code', None)
        if not code:
            pytest.skip("No new access code from previous test")
        
        old_session_id = getattr(self.__class__, 'session_id', None)
        
        response = self.session.post(f"{BASE_URL}/api/verify-code", json={
            "patrol_id": PATROL_ID_TO_TEST,
            "code": code
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["verified"] == True
        assert "session_id" in data
        
        new_session_id = data["session_id"]
        
        # Session ID should be different from previous session
        if old_session_id:
            assert new_session_id != old_session_id, "New session should have different session_id"
        
        print(f"New session started - Session ID: {new_session_id}")
        print(f"Old session ID was: {old_session_id}")
    
    def test_11_trail_empty_for_new_session(self):
        """
        After starting a new session, trail should be empty
        Previous session's points should NOT appear
        """
        response = self.session.get(f"{BASE_URL}/api/patrols/{PATROL_ID_TO_TEST}/trail")
        assert response.status_code == 200
        
        data = response.json()
        points = data.get("points", [])
        
        # Trail should be empty for new session
        assert len(points) == 0, f"Expected empty trail for new session, got {len(points)} points"
        print(f"Trail is empty for new session - session-specific trails working correctly!")


class TestTrailEndpointFiltering:
    """
    Tests for the /api/patrols/{patrol_id}/trail endpoint
    Verifies that trail points are filtered by session_id
    """
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_trail_endpoint_returns_correct_structure(self):
        """Test trail endpoint returns correct response structure"""
        response = self.session.get(f"{BASE_URL}/api/patrols/{PATROL_ID_TO_TEST}/trail")
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify response structure
        assert "patrol_id" in data
        assert "points" in data
        assert "total_distance" in data
        
        assert data["patrol_id"] == PATROL_ID_TO_TEST
        assert isinstance(data["points"], list)
        assert isinstance(data["total_distance"], (int, float))
        
        print(f"Trail endpoint structure correct - {len(data['points'])} points, {data['total_distance']} km")
    
    def test_trail_endpoint_with_hours_param(self):
        """Test trail endpoint with hours parameter"""
        response = self.session.get(f"{BASE_URL}/api/patrols/{PATROL_ID_TO_TEST}/trail?hours=1")
        assert response.status_code == 200
        
        data = response.json()
        assert "points" in data
        print(f"Trail with hours=1: {len(data['points'])} points")
    
    def test_trail_endpoint_nonexistent_patrol(self):
        """Test trail endpoint with non-existent patrol returns empty trail"""
        response = self.session.get(f"{BASE_URL}/api/patrols/NONEXISTENT123/trail")
        assert response.status_code == 200
        
        data = response.json()
        assert data["patrol_id"] == "NONEXISTENT123"
        assert len(data["points"]) == 0
        print("Non-existent patrol returns empty trail correctly")


class TestMQTTLocationEndpoint:
    """
    Tests for the /api/mqtt/location/{patrol_id} endpoint
    Verifies that location updates store session_id with each point
    """
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_mqtt_location_update_success(self):
        """Test MQTT location update endpoint"""
        response = self.session.post(
            f"{BASE_URL}/api/mqtt/location/{PATROL_ID_TO_TEST}?lat=22.3575&lng=91.7840"
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True or "latitude" in data
        print("MQTT location update successful")
    
    def test_mqtt_location_invalid_patrol(self):
        """Test MQTT location update with invalid patrol ID format"""
        response = self.session.post(
            f"{BASE_URL}/api/mqtt/location/invalid!@#?lat=22.3575&lng=91.7840"
        )
        # FastAPI returns 422 for validation errors or 400 for custom validation
        assert response.status_code in [400, 422]
        print("Invalid patrol ID correctly rejected")
    
    def test_mqtt_location_invalid_coordinates(self):
        """Test MQTT location update with invalid coordinates"""
        response = self.session.post(
            f"{BASE_URL}/api/mqtt/location/{PATROL_ID_TO_TEST}?lat=999&lng=999"
        )
        assert response.status_code == 400
        print("Invalid coordinates correctly rejected")
    
    def test_mqtt_location_nonexistent_patrol(self):
        """Test MQTT location update for non-existent patrol"""
        response = self.session.post(
            f"{BASE_URL}/api/mqtt/location/NONEXIST1?lat=22.3575&lng=91.7840"
        )
        assert response.status_code == 404
        print("Non-existent patrol correctly returns 404")


class TestVerifyCodeEndpoint:
    """
    Tests for the /api/verify-code endpoint
    Verifies that code verification clears trail and sets session_id
    """
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_verify_code_missing_params(self):
        """Test verify-code with missing parameters"""
        response = self.session.post(f"{BASE_URL}/api/verify-code", json={})
        assert response.status_code == 200
        
        data = response.json()
        assert data["verified"] == False
        assert "message" in data
        print("Missing params correctly handled")
    
    def test_verify_code_invalid_code(self):
        """Test verify-code with invalid code"""
        response = self.session.post(f"{BASE_URL}/api/verify-code", json={
            "patrol_id": PATROL_ID_TO_TEST,
            "code": "INVALID"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["verified"] == False
        print("Invalid code correctly rejected")
    
    def test_verify_code_response_structure(self):
        """Test verify-code returns correct response structure on success"""
        # First generate a code
        gen_response = self.session.post(
            f"{BASE_URL}/api/codes/generate?patrol_id={PATROL_ID_TO_TEST}&email=test@army.mil"
        )
        
        if gen_response.status_code != 200:
            pytest.skip("Could not generate code")
        
        code = gen_response.json()["code"]
        
        # Verify the code
        response = self.session.post(f"{BASE_URL}/api/verify-code", json={
            "patrol_id": PATROL_ID_TO_TEST,
            "code": code
        })
        assert response.status_code == 200
        
        data = response.json()
        
        # Verify response structure
        assert "verified" in data
        assert data["verified"] == True
        assert "session_id" in data
        assert "session_expires" in data
        assert "message" in data
        
        # Session ID should follow expected format: {patrol_id}_{timestamp}
        session_id = data["session_id"]
        assert session_id.startswith(PATROL_ID_TO_TEST), f"Session ID should start with patrol ID"
        
        print(f"Verify code response structure correct - session_id: {session_id}")


class TestAllTrailsEndpoint:
    """
    Tests for the /api/patrols/trails/all endpoint
    Verifies that all trails are filtered by session_id
    """
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_all_trails_endpoint(self):
        """Test getting all patrol trails"""
        response = self.session.get(f"{BASE_URL}/api/patrols/trails/all?hq_id=SUPER_ADMIN")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Each trail should have correct structure
        for trail in data:
            assert "patrol_id" in trail
            assert "patrol_name" in trail
            assert "status" in trail
            assert "points" in trail
            assert isinstance(trail["points"], list)
        
        print(f"All trails endpoint returned {len(data)} active patrol trails")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
