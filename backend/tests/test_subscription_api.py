"""
Backend API Tests for Subscription Enforcement Features
Tests: Subscription status, patrol limits, expired subscription handling
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
EXPIRED_HQ_USERNAME = "test_expired"
EXPIRED_HQ_PASSWORD = "test123"


class TestSubscriptionStatus:
    """Subscription status endpoint tests"""
    
    def test_subscription_status_super_admin(self):
        """Test subscription status for super admin"""
        response = requests.get(f"{BASE_URL}/api/subscription/status?hq_id=SUPER_ADMIN")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "active"
        assert data["plan"] == "pro"
        assert data["is_super_admin"] == True
        assert "limits" in data
        assert "usage" in data
    
    def test_subscription_status_active_user(self):
        """Test subscription status for active user (hq_demo)"""
        # First login to get hq_id
        login_response = requests.post(f"{BASE_URL}/api/hq/login", json={
            "username": DEMO_HQ_USERNAME,
            "password": DEMO_HQ_PASSWORD
        })
        assert login_response.status_code == 200
        hq_id = login_response.json()["hq_id"]
        
        # Get subscription status
        response = requests.get(f"{BASE_URL}/api/subscription/status?hq_id={hq_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "active"
        assert data["plan"] == "normal"
        assert data["is_super_admin"] == False
        assert "limits" in data
        assert "usage" in data
        assert "can_create_patrol" in data
        assert "can_start_tracking" in data
        assert data["limits"]["max_patrols"] == 50
    
    def test_subscription_status_expired_user(self):
        """Test subscription status for expired user"""
        # First login to get hq_id
        login_response = requests.post(f"{BASE_URL}/api/hq/login", json={
            "username": EXPIRED_HQ_USERNAME,
            "password": EXPIRED_HQ_PASSWORD
        })
        assert login_response.status_code == 200
        hq_id = login_response.json()["hq_id"]
        
        # Get subscription status
        response = requests.get(f"{BASE_URL}/api/subscription/status?hq_id={hq_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "expired"
        assert data["plan"] == "trial"
        assert data["is_super_admin"] == False
        assert data["limits"]["max_patrols"] == 3
        assert data["usage"]["patrols"] == 3
        assert data["can_create_patrol"] == False  # At limit


class TestLoginSubscriptionCheck:
    """Login endpoint subscription check tests"""
    
    def test_login_returns_subscription_info(self):
        """Test that login returns subscription info"""
        response = requests.post(f"{BASE_URL}/api/hq/login", json={
            "username": DEMO_HQ_USERNAME,
            "password": DEMO_HQ_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "subscription" in data
        assert data["subscription"]["plan"] == "normal"
        assert data["subscription"]["status"] == "active"
    
    def test_login_expired_user_returns_expired_status(self):
        """Test that login for expired user returns expired status"""
        response = requests.post(f"{BASE_URL}/api/hq/login", json={
            "username": EXPIRED_HQ_USERNAME,
            "password": EXPIRED_HQ_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "subscription" in data
        assert data["subscription"]["status"] == "expired"
    
    def test_super_admin_login_no_subscription_restrictions(self):
        """Test that super admin login has no subscription restrictions"""
        response = requests.post(f"{BASE_URL}/api/hq/login", json={
            "username": SUPER_ADMIN_USERNAME,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        
        data = response.json()
        assert data["is_super_admin"] == True
        assert data["hq_id"] == "SUPER_ADMIN"


class TestPatrolLimitEnforcement:
    """Patrol limit enforcement tests"""
    
    def test_create_patrol_blocked_for_expired_user(self):
        """Test that creating patrol is blocked for expired user"""
        # First login to get hq_id
        login_response = requests.post(f"{BASE_URL}/api/hq/login", json={
            "username": EXPIRED_HQ_USERNAME,
            "password": EXPIRED_HQ_PASSWORD
        })
        hq_id = login_response.json()["hq_id"]
        
        # Try to create patrol
        payload = {
            "name": f"TEST_Blocked_{uuid.uuid4().hex[:6]}",
            "camp_name": "Test Camp",
            "unit": "Test Unit",
            "leader_email": "test@army.mil",
            "assigned_area": "Test Area",
            "soldier_ids": [],
            "hq_id": hq_id
        }
        
        response = requests.post(f"{BASE_URL}/api/patrols", json=payload)
        # Should be blocked due to expired subscription
        assert response.status_code == 403
        
        data = response.json()
        assert "expired" in data["detail"].lower() or "limit" in data["detail"].lower()
    
    def test_create_patrol_allowed_for_active_user(self):
        """Test that creating patrol is allowed for active user"""
        # First login to get hq_id
        login_response = requests.post(f"{BASE_URL}/api/hq/login", json={
            "username": DEMO_HQ_USERNAME,
            "password": DEMO_HQ_PASSWORD
        })
        hq_id = login_response.json()["hq_id"]
        
        # Create patrol
        unique_name = f"TEST_Allowed_{uuid.uuid4().hex[:6]}"
        payload = {
            "name": unique_name,
            "camp_name": "Test Camp",
            "unit": "Test Unit",
            "leader_email": "test@army.mil",
            "assigned_area": "Test Area",
            "soldier_ids": [],
            "hq_id": hq_id
        }
        
        response = requests.post(f"{BASE_URL}/api/patrols", json=payload)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == unique_name
        patrol_id = data["id"]
        
        # Cleanup - delete the test patrol
        delete_response = requests.delete(f"{BASE_URL}/api/patrols/{patrol_id}?hq_id={hq_id}")
        assert delete_response.status_code == 200
    
    def test_super_admin_can_always_create_patrol(self):
        """Test that super admin can always create patrols"""
        unique_name = f"TEST_SuperAdmin_{uuid.uuid4().hex[:6]}"
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
        patrol_id = data["id"]
        
        # Cleanup
        delete_response = requests.delete(f"{BASE_URL}/api/patrols/{patrol_id}?hq_id=SUPER_ADMIN")
        assert delete_response.status_code == 200


class TestGetPatrolsSubscriptionCheck:
    """Get patrols endpoint subscription check tests"""
    
    def test_get_patrols_blocked_for_expired_user(self):
        """Test that getting patrols is blocked for expired user"""
        # First login to get hq_id
        login_response = requests.post(f"{BASE_URL}/api/hq/login", json={
            "username": EXPIRED_HQ_USERNAME,
            "password": EXPIRED_HQ_PASSWORD
        })
        hq_id = login_response.json()["hq_id"]
        
        # Try to get patrols
        response = requests.get(f"{BASE_URL}/api/patrols?hq_id={hq_id}")
        # Should be blocked due to expired subscription
        assert response.status_code == 403
        
        data = response.json()
        assert "expired" in data["detail"].lower()
    
    def test_get_patrols_allowed_for_active_user(self):
        """Test that getting patrols is allowed for active user"""
        # First login to get hq_id
        login_response = requests.post(f"{BASE_URL}/api/hq/login", json={
            "username": DEMO_HQ_USERNAME,
            "password": DEMO_HQ_PASSWORD
        })
        hq_id = login_response.json()["hq_id"]
        
        # Get patrols
        response = requests.get(f"{BASE_URL}/api/patrols?hq_id={hq_id}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
    
    def test_super_admin_can_always_get_patrols(self):
        """Test that super admin can always get patrols"""
        response = requests.get(f"{BASE_URL}/api/patrols?hq_id=SUPER_ADMIN")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)


class TestAdminEndpoints:
    """Admin endpoints tests"""
    
    def test_admin_hq_list(self):
        """Test admin HQ list endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/hq-list")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Check that HQs have subscription info
        for hq in data:
            assert "hq_id" in hq
            assert "hq_name" in hq
            assert "patrol_count" in hq
    
    def test_admin_stats(self):
        """Test admin stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_hqs" in data
        assert "pending_requests" in data
        assert "active_hqs" in data
        assert "expired_hqs" in data
        assert "monthly_revenue" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
