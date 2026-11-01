"""Application Configuration Module.

Loads environment variables with Pydantic Settings v2.
Enforces typed settings for PostgreSQL database pooling, JWT cryptographic parameters,
and CORS policies.
"""

from functools import lru_cache
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized application configuration."""

    # Application Metadata
    APP_NAME: str = "TaskFlow Orchestrator"
    APP_ENV: str = "development"
    DEBUG: bool = False
    PORT: int = 8000

    # Database Configuration (ADR-002: Backend Privileged Connection)
    DATABASE_URL: str = Field(
        default="postgresql://taskflow_user:supersecretpassword@localhost:5432/taskflow_db",
        description="PostgreSQL connection string with pooling support",
    )
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_PRE_PING: bool = True

    # Security & Cryptography
    JWT_SECRET_KEY: str = Field(
        default="09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7",
        description="Cryptographically secure 256-bit secret key for JWT signing",
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # CORS Configuration
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:8000"

    @property
    def cors_origins(self) -> List[str]:
        """Parse comma-separated origins into a list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """Return cached singleton instance of application settings."""
    return Settings()


settings = get_settings()
