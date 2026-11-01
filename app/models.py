"""SQLAlchemy 2.x Declarative Domain Models.

Enforces:
1. Native UUIDv4 primary keys for distributed identity safety without sequential leaks.
2. Timezone-aware UTC datetimes for all audit timestamps.
3. Explicit foreign key indexes (ix_tasks_user_id) for index scans on tenant-scoped queries.
4. Cascading deletes and explicit relationships.
"""

import uuid
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


def utc_now() -> datetime:
    """Generate timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


class User(Base):
    """User account entity.
    
    Stores authentication credentials and account metadata.
    The password_hash is strictly segregated and never exposed in API schemas.
    """
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
        doc="Unique UUID identifier for the user account",
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
        doc="Normalized user email address (unique)",
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="Bcrypt salted hash of user password (never exposed via API)",
    )
    full_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        doc="User display name",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="Active status flag for account deactivation without deletion",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        doc="UTC timestamp when account was registered",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
        doc="UTC timestamp when account was last updated",
    )

    # Relationships
    tasks: Mapped[List["Task"]] = relationship(
        "Task",
        back_populates="owner",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', is_active={self.is_active})>"


class Task(Base):
    """Task entity for the workflow orchestrator.
    
    Adheres to ADR-002: Every task is bound to a specific user_id foreign key.
    Indexed for fast multi-tenant filtering.
    """
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
        doc="Unique UUID identifier for the task",
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        doc="Foreign key to the owner user (indexed for ADR-002 ownership filtering)",
    )
    title: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True,
        doc="Concise title or headline of the task",
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
        doc="Detailed specification or notes for the task",
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False,
        index=True,
        doc="Lifecycle state: pending, in_progress, completed, archived",
    )
    priority: Mapped[str] = mapped_column(
        String(50),
        default="medium",
        nullable=False,
        doc="Priority classification: low, medium, high, urgent",
    )
    due_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        doc="Optional deadline for task completion (timezone-aware UTC)",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        nullable=False,
        doc="UTC timestamp of task creation",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
        doc="UTC timestamp of last task modification",
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="tasks")

    # Composite indexes for high-throughput query optimization
    __table_args__ = (
        Index("ix_tasks_user_id_status", "user_id", "status"),
        Index("ix_tasks_user_id_created_at", "user_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Task(id={self.id}, user_id={self.user_id}, title='{self.title[:20]}', status='{self.status}')>"
