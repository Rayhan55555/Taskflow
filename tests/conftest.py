"""Pytest Configuration and Isolated Database Fixtures.

Configures an isolated in-memory SQLite database session using StaticPool.
Overrides FastAPI's `get_db` dependency to ensure total test isolation.
Provides fixtures for authenticated test users (User A and User B).
"""

import uuid
from typing import Dict, Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.auth import create_access_token, get_password_hash
from app.database import Base, get_db
from app.main import app
from app.models import User

# In-memory isolated SQLite database engine for high-speed deterministic tests
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
    expire_on_commit=False,
)


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """Provide a pristine database schema and session for each individual test."""
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session: Session) -> Generator[TestClient, None, None]:
    """Provide a TestClient with overridden get_db dependency pointing to the test session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def user_a(db_session: Session) -> Dict:
    """Fixture providing User A with pre-seeded database record and valid Auth header."""
    user = User(
        id=uuid.uuid4(),
        email="alice@example.com",
        password_hash=get_password_hash("PasswordAlice123!"),
        full_name="Alice Architect",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(user_id=user.id)
    return {
        "user": user,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture(scope="function")
def user_b(db_session: Session) -> Dict:
    """Fixture providing User B with pre-seeded database record and valid Auth header."""
    user = User(
        id=uuid.uuid4(),
        email="bob@example.com",
        password_hash=get_password_hash("PasswordBob123!"),
        full_name="Bob Builder",
        is_active=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    token = create_access_token(user_id=user.id)
    return {
        "user": user,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }
