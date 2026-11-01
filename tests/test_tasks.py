"""Task CRUD & Strict ADR-002 Cross-User Ownership Isolation Tests.

Verifies:
1. Standard Task CRUD operations for authenticated owners.
2. Input validation rules (min length on title, enum bounds).
3. ADR-002 Compliance: Proves User A cannot be accessed, modified, or deleted by User B.
   Returns 404 on cross-tenant access to prevent resource enumeration.
"""

import uuid
from fastapi.testclient import TestClient


def test_create_task_success(client: TestClient, user_a: dict):
    """Test creating a task assigns ownership to the authenticated user."""
    payload = {
        "title": "Set up PostgreSQL read-replicas",
        "description": "Architect read pool for ADR-002 high concurrency",
        "status": "pending",
        "priority": "high",
    }
    response = client.post("/api/v1/tasks", json=payload, headers=user_a["headers"])
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == payload["title"]
    assert data["description"] == payload["description"]
    assert data["status"] == "pending"
    assert data["priority"] == "high"
    assert data["user_id"] == str(user_a["user"].id)
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_task_empty_title_validation(client: TestClient, user_a: dict):
    """Test validation failure when task title is empty or missing."""
    response = client.post(
        "/api/v1/tasks",
        json={"title": "", "status": "pending"},
        headers=user_a["headers"],
    )
    assert response.status_code == 422


def test_create_task_invalid_status_enum(client: TestClient, user_a: dict):
    """Test validation failure when status is not an approved enum value."""
    response = client.post(
        "/api/v1/tasks",
        json={"title": "Invalid Status Task", "status": "unsupported_status"},
        headers=user_a["headers"],
    )
    assert response.status_code == 422


def test_list_tasks_pagination_and_filtering(client: TestClient, user_a: dict):
    """Test listing tasks with pagination and status filtering."""
    # Create 3 tasks under User A
    for i in range(3):
        client.post(
            "/api/v1/tasks",
            json={
                "title": f"Task {i}",
                "status": "completed" if i == 0 else "pending",
                "priority": "medium",
            },
            headers=user_a["headers"],
        )

    # Fetch all tasks for User A
    response = client.get("/api/v1/tasks", headers=user_a["headers"])
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["items"]) == 3

    # Filter by completed status
    filtered = client.get("/api/v1/tasks?status=completed", headers=user_a["headers"])
    assert filtered.status_code == 200
    filtered_data = filtered.json()
    assert filtered_data["total"] == 1
    assert filtered_data["items"][0]["title"] == "Task 0"


def test_get_task_by_id(client: TestClient, user_a: dict):
    """Test retrieving an owned task by UUID."""
    create_res = client.post(
        "/api/v1/tasks",
        json={"title": "Single Task Verification"},
        headers=user_a["headers"],
    )
    task_id = create_res.json()["id"]

    get_res = client.get(f"/api/v1/tasks/{task_id}", headers=user_a["headers"])
    assert get_res.status_code == 200
    assert get_res.json()["id"] == task_id


def test_patch_task_partial_update(client: TestClient, user_a: dict):
    """Test atomic partial update with PATCH."""
    create_res = client.post(
        "/api/v1/tasks",
        json={
            "title": "Initial Title",
            "description": "Original Description",
            "status": "pending",
            "priority": "low",
        },
        headers=user_a["headers"],
    )
    task_id = create_res.json()["id"]

    # Update only title and status
    patch_res = client.patch(
        f"/api/v1/tasks/{task_id}",
        json={"title": "Updated Title", "status": "in_progress"},
        headers=user_a["headers"],
    )
    assert patch_res.status_code == 200
    patched_data = patch_res.json()
    assert patched_data["title"] == "Updated Title"
    assert patched_data["status"] == "in_progress"
    assert patched_data["description"] == "Original Description"  # Retained
    assert patched_data["priority"] == "low"  # Retained


def test_delete_task(client: TestClient, user_a: dict):
    """Test deleting an owned task returns 204 and removes the record."""
    create_res = client.post(
        "/api/v1/tasks",
        json={"title": "Task to delete"},
        headers=user_a["headers"],
    )
    task_id = create_res.json()["id"]

    delete_res = client.delete(f"/api/v1/tasks/{task_id}", headers=user_a["headers"])
    assert delete_res.status_code == 204

    # Subsequent GET returns 404
    get_res = client.get(f"/api/v1/tasks/{task_id}", headers=user_a["headers"])
    assert get_res.status_code == 404


# =========================================================================
# CRITICAL ADR-002 CROSS-USER ISOLATION TESTS
# =========================================================================

def test_cross_user_isolation_read(client: TestClient, user_a: dict, user_b: dict):
    """SECURITY TEST: User B cannot read User A's task (returns 404)."""
    # User A creates a sensitive task
    create_res = client.post(
        "/api/v1/tasks",
        json={
            "title": "User A Private Architectural Blueprint",
            "description": "Confidential system design details",
        },
        headers=user_a["headers"],
    )
    assert create_res.status_code == 201
    task_a_id = create_res.json()["id"]

    # User B attempts to read User A's task
    unauthorized_get = client.get(
        f"/api/v1/tasks/{task_a_id}",
        headers=user_b["headers"],
    )
    assert unauthorized_get.status_code == 404
    assert unauthorized_get.json()["detail"] == "Task not found"


def test_cross_user_isolation_patch(client: TestClient, user_a: dict, user_b: dict):
    """SECURITY TEST: User B cannot modify User A's task (returns 404)."""
    # User A creates a task
    create_res = client.post(
        "/api/v1/tasks",
        json={"title": "User A Original State", "status": "pending"},
        headers=user_a["headers"],
    )
    task_a_id = create_res.json()["id"]

    # User B attempts to mutate User A's task
    unauthorized_patch = client.patch(
        f"/api/v1/tasks/{task_a_id}",
        json={"title": "Hacked Title by User B", "status": "completed"},
        headers=user_b["headers"],
    )
    assert unauthorized_patch.status_code == 404

    # Verify User A's task was NOT modified
    verify_res = client.get(f"/api/v1/tasks/{task_a_id}", headers=user_a["headers"])
    assert verify_res.status_code == 200
    assert verify_res.json()["title"] == "User A Original State"
    assert verify_res.json()["status"] == "pending"


def test_cross_user_isolation_delete(client: TestClient, user_a: dict, user_b: dict):
    """SECURITY TEST: User B cannot delete User A's task (returns 404)."""
    # User A creates a task
    create_res = client.post(
        "/api/v1/tasks",
        json={"title": "Indelible Task by User A"},
        headers=user_a["headers"],
    )
    task_a_id = create_res.json()["id"]

    # User B attempts to delete User A's task
    unauthorized_delete = client.delete(
        f"/api/v1/tasks/{task_a_id}",
        headers=user_b["headers"],
    )
    assert unauthorized_delete.status_code == 404

    # Verify User A's task still exists
    verify_res = client.get(f"/api/v1/tasks/{task_a_id}", headers=user_a["headers"])
    assert verify_res.status_code == 200
    assert verify_res.json()["title"] == "Indelible Task by User A"


def test_cross_user_isolation_list(client: TestClient, user_a: dict, user_b: dict):
    """SECURITY TEST: User B listing tasks sees zero of User A's tasks."""
    # User A creates 2 tasks
    client.post("/api/v1/tasks", json={"title": "A Task 1"}, headers=user_a["headers"])
    client.post("/api/v1/tasks", json={"title": "A Task 2"}, headers=user_a["headers"])

    # User B creates 1 task
    client.post("/api/v1/tasks", json={"title": "B Task 1"}, headers=user_b["headers"])

    # User B lists tasks
    user_b_list = client.get("/api/v1/tasks", headers=user_b["headers"]).json()
    assert user_b_list["total"] == 1
    assert len(user_b_list["items"]) == 1
    assert user_b_list["items"][0]["title"] == "B Task 1"

    # User A lists tasks
    user_a_list = client.get("/api/v1/tasks", headers=user_a["headers"]).json()
    assert user_a_list["total"] == 2
    assert len(user_a_list["items"]) == 2
