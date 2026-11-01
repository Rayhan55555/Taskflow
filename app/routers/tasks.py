"""Task Management Router.

Adheres strictly to ADR-002: Backend Privileged Connection with Application-Level Authorization.
CRITICAL OWNERSHIP ENFORCEMENT:
Every database query (SELECT, UPDATE, DELETE) MUST include `Task.user_id == current_user.id`.
Cross-user access attempts resolve to 404 Not Found to prevent resource enumeration attacks.
"""

from datetime import datetime, timezone
from typing import Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from app.auth import get_current_user
from app.database import get_db
from app.models import Task, User
from app.schemas import (
    TaskCreate,
    TaskListResponse,
    TaskPriority,
    TaskResponse,
    TaskStatus,
    TaskUpdate,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new task under current user ownership",
)
def create_task(
    payload: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Task:
    """Create a new task. The owner user_id is automatically bound from current_user."""
    new_task = Task(
        user_id=current_user.id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        status=payload.status.value,
        priority=payload.priority.value,
        due_date=payload.due_date,
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task


@router.get(
    "",
    response_model=TaskListResponse,
    status_code=status.HTTP_200_OK,
    summary="List tasks owned by current user with optional filtering",
)
def list_tasks(
    status_filter: Optional[TaskStatus] = Query(None, alias="status", description="Filter by task status"),
    priority_filter: Optional[TaskPriority] = Query(None, alias="priority", description="Filter by priority"),
    limit: int = Query(20, ge=1, le=100, description="Page size limit"),
    offset: int = Query(0, ge=0, description="Page offset"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TaskListResponse:
    """List all tasks belonging to the current user.
    
    ADR-002: Base query is strictly scoped to current_user.id.
    """
    # Base filter strictly constrained to authenticated user
    base_query = select(Task).where(Task.user_id == current_user.id)
    count_query = select(func.count()).select_from(Task).where(Task.user_id == current_user.id)

    # Optional query filters
    if status_filter:
        base_query = base_query.where(Task.status == status_filter.value)
        count_query = count_query.where(Task.status == status_filter.value)

    if priority_filter:
        base_query = base_query.where(Task.priority == priority_filter.value)
        count_query = count_query.where(Task.priority == priority_filter.value)

    # Calculate total matching count for current user
    total = db.scalar(count_query) or 0

    # Paginate and order by newest first
    paginated_query = (
        base_query
        .order_by(Task.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    tasks = db.scalars(paginated_query).all()

    return TaskListResponse(
        items=[TaskResponse.model_validate(t) for t in tasks],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve a specific task by ID with ownership verification",
)
def get_task_by_id(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Task:
    """Retrieve single task.
    
    ADR-002: Query MUST match both task_id AND current_user.id.
    Returns 404 if the task belongs to another user (prevents enumeration).
    """
    task = db.scalar(
        select(Task).where(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    return task


@router.patch(
    "/{task_id}",
    response_model=TaskResponse,
    status_code=status.HTTP_200_OK,
    summary="Partially update a task with ownership verification",
)
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Task:
    """Partially update task fields.
    
    ADR-002: Query MUST match both task_id AND current_user.id.
    Returns 404 if the task belongs to another user.
    """
    task = db.scalar(
        select(Task).where(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    # Extract only explicitly provided fields
    update_data = payload.model_dump(exclude_unset=True)

    if not update_data:
        return task

    for field, value in update_data.items():
        if field == "title" and value is not None:
            task.title = value.strip()
        elif field == "description":
            task.description = value.strip() if value else None
        elif field == "status" and value is not None:
            task.status = value.value if hasattr(value, "value") else str(value)
        elif field == "priority" and value is not None:
            task.priority = value.value if hasattr(value, "value") else str(value)
        elif field == "due_date":
            task.due_date = value

    task.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    return task


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a task with ownership verification",
)
def delete_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete a task owned by the current user.
    
    ADR-002: Query MUST match both task_id AND current_user.id.
    Returns 404 if the task belongs to another user.
    """
    task = db.scalar(
        select(Task).where(
            Task.id == task_id,
            Task.user_id == current_user.id,
        )
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    db.delete(task)
    db.commit()
    return None
