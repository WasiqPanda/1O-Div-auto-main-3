"""
Backend API Tests for Military Patrol Tracking Application
Tests: Authentication, Patrols CRUD, Stats, Filters, SOS, Access Codes
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://naughty-ritchie.preview.emergentagent.com').rstrip('/')

# Test credentials
SUPER_ADMIN_USERNAME = "Wahid_Al_Towsif"
SUPER_ADMIN_PASSWORD = "1@mH@ppy"
DEMO_HQ_USERNAME = "hq_demo"
DEMO_HQ_PASSWORD = "demo123"


class TestHealthAndRoot:
    """Basic health check tests"""
    
    def test_root_endpoint(self):
        """Test root API endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        # Root may not exist, but we check if API is reachable
        assert response.status_code in [200, 404, 405]
    
    def test_api_reachable(self):
        """Test that API is reachable via stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/stats?hq_id=SUPER_ADMIN")
        assert response.status_code == 200


class TestAuthentication:
    """HQ Login authentication tests"""
    
    def test_super_admin_login_success(self):
        """Test super admin login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/hq/login", json={
            "username": SUPER_ADMIN_USERNAME,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert data["hq_id"] == "SUPER_ADMIN"
        assert data["is_super_admin"] == True
        assert "token" in data
        assert data["role"] == "super_admin"
    
    def test_demo_hq_login_success(self):
        """Test demo HQ login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/hq/login", json={
            "username": DEMO_HQ_USERNAME,
            "password": DEMO_HQ_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] == True
        assert "hq_id" in data
        assert "token" in data
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/hq/login", json={
            "username": "invalid_user",
            "password": "wrong_password"
        })
        assert response.status_code == 401
        
        data = response.json()
        assert "detail" in data


class TestPatrolsAPI:
    """Patrol CRUD operations tests"""
    
    def test_get_all_patrols_super_admin(self):
        """Test fetching all patrols as super admin"""
        response = requests.get(f"{BASE_URL}/api/patrols?hq_id=SUPER_ADMIN")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0  # Should have patrols
        
        # Verify patrol structure
        patrol = data[0]
        assert "id" in patrol
        assert "name" in patrol
        assert "camp_name" in patrol
        assert "status" in patrol
        assert "latitude" in patrol
        assert "longitude" in patrol
    
    def test_get_patrols_with_search(self):
        """Test patrol search functionality"""
        response = requests.get(f"{BASE_URL}/api/patrols?hq_id=SUPER_ADMIN&search=PTL")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        # All results should contain PTL in name or other fields
        for patrol in data:
            search_fields = [
                patrol.get("name", "").lower(),
                patrol.get("camp_name", "").lower(),
                patrol.get("unit", "").lower(),
                patrol.get("id", "").lower()
            ]
            assert any("ptl" in field for field in search_fields)
    
    def test_get_patrols_with_status_filter(self):
        """Test patrol status filter"""
        response = requests.get(f"{BASE_URL}/api/patrols?hq_id=SUPER_ADMIN&status=active")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        for patrol in data:
            assert patrol["status"] == "active"
    
    def test_get_patrols_with_camp_filter(self):
        """Test patrol camp filter"""
        response = requests.get(f"{BASE_URL}/api/patrols?hq_id=SUPER_ADMIN&camp_name=Boroma%20Army%20Camp")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        for patrol in data:
            assert patrol["camp_name"] == "Boroma Army Camp"
    
    def test_create_patrol(self):
        """Test creating a new patrol"""
        unique_name = f"TEST_Patrol_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": unique_name,
            "camp_name": "Test Camp",
            "unit": "Test Unit",
            "leader_email": "test@army.mil",
            "assigned_area": "Test Area",
            "soldier_ids": [],
            "hq_id": "SUPER_ADMIN"
        }
        
        response = requests.post(f"{BASE_URL}/api/patrols", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == unique_name
        assert data["camp_name"] == "Test Camp"
        assert "id" in data
        
        # Store patrol_id for cleanup
        patrol_id = data["id"]
        
        # Verify patrol was created by fetching it
        get_response = requests.get(f"{BASE_URL}/api/patrols?hq_id=SUPER_ADMIN&search={unique_name}")
        assert get_response.status_code == 200
        patrols = get_response.json()
        assert len(patrols) >= 1
        
        # Cleanup - delete the test patrol
        delete_response = requests.delete(f"{BASE_URL}/api/patrols/{patrol_id}?hq_id=SUPER_ADMIN")
        assert delete_response.status_code == 200
    
    def test_update_patrol_details(self):
        """Test updating patrol details"""
        # First create a patrol
        unique_name = f"TEST_Update_{uuid.uuid4().hex[:6]}"
        create_payload = {
            "name": unique_name,
            "camp_name": "Original Camp",
            "unit": "Original Unit",
            "leader_email": "original@army.mil",
            "assigned_area": "Original Area",
            "soldier_ids": [],
            "hq_id": "SUPER_ADMIN"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/patrols", json=create_payload)
        assert create_response.status_code == 200
        patrol_id = create_response.json()["id"]
        
        # Update the patrol
        update_payload = {
            "name": f"{unique_name}_Updated",
            "camp_name": "Updated Camp",
            "unit": "Updated Unit"
        }
        
        update_response = requests.put(f"{BASE_URL}/api/patrols/{patrol_id}/details", json=update_payload)
        assert update_response.status_code == 200
        
        updated_data = update_response.json()
        assert updated_data["name"] == f"{unique_name}_Updated"
        assert updated_data["camp_name"] == "Updated Camp"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/patrols/{patrol_id}?hq_id=SUPER_ADMIN")
    
    def test_delete_patrol(self):
        """Test deleting a patrol"""
        # Create a patrol to delete
        unique_name = f"TEST_Delete_{uuid.uuid4().hex[:6]}"
        create_payload = {
            "name": unique_name,
            "camp_name": "Delete Test Camp",
            "unit": "Delete Test Unit",
            "leader_email": "delete@army.mil",
            "assigned_area": "Delete Area",
            "soldier_ids": [],
            "hq_id": "SUPER_ADMIN"
        }
        
        create_response = requests.post(f"{BASE_URL}/api/patrols", json=create_payload)
        assert create_response.status_code == 200
        patrol_id = create_response.json()["id"]
        
        # Delete the patrol
        delete_response = requests.delete(f"{BASE_URL}/api/patrols/{patrol_id}?hq_id=SUPER_ADMIN")
        assert delete_response.status_code == 200
        
        data = delete_response.json()
        assert data["success"] == True
        
        # Verify patrol is deleted
        get_response = requests.get(f"{BASE_URL}/api/patrols?hq_id=SUPER_ADMIN&search={unique_name}")
        patrols = get_response.json()
        assert not any(p["id"] == patrol_id for p in patrols)


class TestFilterOptions:
    """Filter options API tests"""
    
    def test_get_filter_options(self):
        """Test getting filter options (camps and units)"""
        response = requests.get(f"{BASE_URL}/api/patrols/filters/options?hq_id=SUPER_ADMIN")
        assert response.status_code == 200
        
        data = response.json()
        assert "camps" in data
        assert "units" in data
        assert isinstance(data["camps"], list)
        assert isinstance(data["units"], list)
        assert len(data["camps"]) > 0
        assert len(data["units"]) > 0


class TestStatsAPI:
    """Stats API tests"""
    
    def test_get_stats_super_admin(self):
        """Test getting stats as super admin"""
        response = requests.get(f"{BASE_URL}/api/stats?hq_id=SUPER_ADMIN")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_patrols" in data
        assert "active_patrols" in data
        assert "approved_patrols" in data
        assert "notifications" in data
        assert "active_sos" in data
        assert "connected_clients" in data
        
        # Verify counts are non-negative
        assert data["total_patrols"] >= 0
        assert data["active_patrols"] >= 0
        assert data["approved_patrols"] >= 0


class TestSOSAPI:
    """SOS alerts API tests"""
    
    def test_get_sos_alerts(self):
        """Test getting SOS alerts"""
        response = requests.get(f"{BASE_URL}/api/sos")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_resolved_sos_alerts(self):
        """Test getting resolved SOS alerts"""
        response = requests.get(f"{BASE_URL}/api/sos?resolved=true")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)


class TestAccessCodes:
    """Access code generation tests"""
    
    def test_generate_access_code(self):
        """Test generating access code for a patrol"""
        # First get a patrol
        patrols_response = requests.get(f"{BASE_URL}/api/patrols?hq_id=SUPER_ADMIN")
        patrols = patrols_response.json()
        
        if len(patrols) > 0:
            patrol = patrols[0]
            patrol_id = patrol["id"]
            email = patrol.get("leader_email", "test@army.mil")
            
            response = requests.post(f"{BASE_URL}/api/codes/generate?patrol_id={patrol_id}&email={email}")
            assert response.status_code == 200
            
            data = response.json()
            assert "code" in data
            assert data["patrol_id"] == patrol_id
            assert "expires_at" in data
            assert len(data["code"]) == 6  # 6-digit code
    
    def test_generate_code_invalid_patrol(self):
        """Test generating code for non-existent patrol"""
        response = requests.post(f"{BASE_URL}/api/codes/generate?patrol_id=INVALID_ID&email=test@army.mil")
        assert response.status_code == 404


class TestPatrolTrails:
    """Patrol trail API tests"""
    
    def test_get_patrol_trail(self):
        """Test getting patrol trail"""
        # Get a patrol first
        patrols_response = requests.get(f"{BASE_URL}/api/patrols?hq_id=SUPER_ADMIN")
        patrols = patrols_response.json()
        
        if len(patrols) > 0:
            patrol_id = patrols[0]["id"]
            response = requests.get(f"{BASE_URL}/api/patrols/{patrol_id}/trail")
            # Trail endpoint may return 200 or 404 depending on data
            assert response.status_code in [200, 404]


class TestPatrolHistory:
    """Patrol history API tests"""
    
    def test_get_patrol_history(self):
        """Test getting patrol history for a date"""
        response = requests.get(f"{BASE_URL}/api/patrols/history?hq_id=SUPER_ADMIN&date=2026-02-02")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_patrol_history_invalid_date(self):
        """Test getting patrol history with invalid date falls back to current date"""
        response = requests.get(f"{BASE_URL}/api/patrols/history?hq_id=SUPER_ADMIN&date=invalid")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
