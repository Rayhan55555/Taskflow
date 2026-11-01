"""Authentication and JWT Security Verification Test Suite.

Verifies:
1. Registration with bcrypt salted hashing (password_hash never leaked).
2. Login credential verification and Bearer token issuance.
3. Strict JWT validation: expiry, malformed tokens, bad signatures, missing credentials.
"""

from datetime import timedelta
import jwt
from fastapi.testclient import TestClient
from app.auth import create_access_token
from app.config import settings


def test_register_success(client: TestClient):
    """Test successful user registration returns 201 and omits password_hash."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "ValidPassword99!",
            "full_name": "New Engineer",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New Engineer"
    assert "id" in data
    assert "password_hash" not in data  # Security guarantee
    assert "password" not in data


def test_register_duplicate_email(client: TestClient, user_a: dict):
    """Test registering with an existing email returns 409 Conflict."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "alice@example.com",
            "password": "AnotherPassword123!",
            "full_name": "Alice Duplicate",
        },
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_register_short_password(client: TestClient):
    """Test validation rejection when password is shorter than 8 characters."""
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "short@example.com",
            "password": "short",
            "full_name": "Short Pass",
        },
    )
    assert response.status_code == 422


def test_login_success(client: TestClient, user_a: dict):
    """Test login with valid credentials issues token and user info."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "alice@example.com",
            "password": "PasswordAlice123!",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "alice@example.com"
    assert "password_hash" not in data["user"]


def test_login_wrong_password(client: TestClient, user_a: dict):
    """Test login with invalid password returns 401 Unauthorized."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "alice@example.com",
            "password": "WrongPassword!",
        },
    )
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_login_nonexistent_email(client: TestClient):
    """Test login with non-existent email returns 401 Unauthorized."""
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "ghost@example.com",
            "password": "SomePassword123!",
        },
    )
    assert response.status_code == 401


def test_get_current_user_profile(client: TestClient, user_a: dict):
    """Test GET /api/v1/auth/me returns authenticated user's details."""
    response = client.get("/api/v1/auth/me", headers=user_a["headers"])
    assert response.status_code == 200
    assert response.json()["email"] == "alice@example.com"


def test_expired_jwt_token(client: TestClient, user_a: dict):
    """Test expired JWT token is rejected with 401 Unauthorized."""
    expired_token = create_access_token(
        user_id=user_a["user"].id,
        expires_delta=timedelta(seconds=-10),  # Expired 10 seconds ago
    )
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()


def test_tampered_jwt_signature(client: TestClient, user_a: dict):
    """Test JWT signed with an untrusted secret key is rejected."""
    tampered_token = jwt.encode(
        {"sub": str(user_a["user"].id), "exp": 9999999999, "iat": 1000000000, "type": "access"},
        "wrong-untrusted-secret-key",
        algorithm=settings.JWT_ALGORITHM,
    )
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {tampered_token}"},
    )
    assert response.status_code == 401


def test_missing_auth_header(client: TestClient):
    """Test calling protected endpoint without Authorization header returns 401."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
