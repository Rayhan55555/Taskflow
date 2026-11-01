"""Database Connection & Session Management Module.

Adheres to ADR-002: Backend Privileged Connection.
The application connects via a single privileged connection pool.
Multi-tenant isolation and ownership checks are explicitly enforced in application logic.
Tables are managed exclusively via Alembic migrations (no Base.metadata.create_all at runtime).
"""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from app.config import settings


# SQLAlchemy 2.0 Base Class
class Base(DeclarativeBase):
    """Declarative Base class for all domain models."""
    pass


# Privileged Connection Pool Engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=settings.DB_POOL_PRE_PING,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    echo=settings.DEBUG,
)

# Thread-local Session Factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI Dependency for database session lifecycle management.

    Ensures transactions are safely opened, committed or rolled back,
    and the connection is returned to the pool after the request terminates.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
