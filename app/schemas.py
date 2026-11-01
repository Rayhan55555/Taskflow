"""Pydantic v2 Data Validation & Serialization Schemas.

Enforces:
1. Strict type checking and sanitization.
2. Complete absence of sensitive fields (such as password_hash) from all serialization models.
3. Enum-based status and priority constraints.
4. Partial update semantics (PATCH) using Optional fields with exclude_unset support.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ==========================================
# Enums
# ==========================================

class TaskStatus(str, Enum):
    """Permitted task lifecycle states."""
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    archived = "archived"


class TaskPriority(str, Enum):
    """Permitted task priority levels."""
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


# ==========================================
# User & Auth Schemas
# ==========================================

class UserRegisterRequest(BaseModel):
    """Payload for POST /api/v1/auth/register."""
    email: EmailStr = Field(
        ...,
        description="Valid, unique email address for authentication",
        examples=["alice@example.com"],
    )
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Raw user password (minimum 8 characters)",
        examples=["SecurePassw0rd!123"],
    )
    full_name: Optional[str] = Field(
        None,
        max_length=255,
        description="Optional full name or display handle",
        examples=["Alice Engineer"],
    )


class UserLoginRequest(BaseModel):
    """Payload for POST /api/v1/auth/login."""
    email: EmailStr = Field(..., description="Registered account email")
    password: str = Field(..., description="Account password")


class UserResponse(BaseModel):
    """Public user identity representation.
    
    Security Guarantee: Never leaks password_hash or internal secrets.
    """
    id: uuid.UUID
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    """JWT bearer token issuance model."""
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    user: UserResponse


class TokenPayload(BaseModel):
    """Decoded internal JWT claim set."""
    sub: str  # user UUID in string representation
    exp: int  # UTC expiration epoch seconds
    iat: int  # Issued at epoch seconds
    type: str = "access"


# ==========================================
# Task Schemas
# ==========================================

class TaskCreate(BaseModel):
    """Payload for POST /api/v1/tasks."""
    title: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Task title (cannot be empty)",
        examples=["Implement ADR-002 ownership tests"],
    )
    description: Optional[str] = Field(
        None,
        max_length=5000,
        description="Optional detailed description or markdown notes",
        examples=["Write pytest matrix verifying User A cannot mutate User B tasks."],
    )
    status: TaskStatus = Field(
        default=TaskStatus.pending,
        description="Initial workflow state",
    )
    priority: TaskPriority = Field(
        default=TaskPriority.medium,
        description="Relative urgency level",
    )
    due_date: Optional[datetime] = Field(
        None,
        description="Optional ISO-8601 UTC timestamp for task deadline",
    )


class TaskUpdate(BaseModel):
    """Payload for PATCH /api/v1/tasks/{id}.
    
    Supports partial atomic updates. Any unset field remains unmodified.
    """
    title: Optional[str] = Field(
        None,
        min_length=1,
        max_length=200,
        description="Updated task title",
    )
    description: Optional[str] = Field(
        None,
        max_length=5000,
        description="Updated task description",
    )
    status: Optional[TaskStatus] = Field(
        None,
        description="New lifecycle status",
    )
    priority: Optional[TaskPriority] = Field(
        None,
        description="New priority classification",
    )
    due_date: Optional[datetime] = Field(
        None,
        description="New deadline timestamp",
    )


class TaskResponse(BaseModel):
    """Task model returned to authenticated client."""
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: Optional[str] = None
    status: TaskStatus
    priority: TaskPriority
    due_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TaskListResponse(BaseModel):
    """Paginated list of task resources."""
    items: List[TaskResponse]
    total: int
    limit: int
    offset: int
