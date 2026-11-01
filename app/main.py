"""FastAPI Main Application Entry Point.

Architecture: Modular Monolith under ADR-002.
Integrates Auth and Task routers under /api/v1 namespace.
Configures CORS middleware and exposes system health checks.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, tasks

# Initialize FastAPI instance
app = FastAPI(
    title=settings.APP_NAME,
    version="0.2.0",
    description=(
        "TaskFlow Orchestrator Phase 2: Production-grade task management engine "
        "built with FastAPI, SQLAlchemy 2.x, Alembic, and strict ADR-002 application-level authorization."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Policy Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Modular Routers under /api/v1 prefix
app.include_router(auth.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")


@app.get(
    "/health",
    tags=["System"],
    summary="Health check endpoint",
)
def health_check():
    """Verify application service health and architectural state."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "phase": 2,
        "version": "0.2.0",
        "architecture": "ADR-002 (Backend Privileged Connection with App-Level Authorization)",
    }


@app.get(
    "/api/v1/health",
    tags=["System"],
    summary="API v1 Health check endpoint",
)
def api_v1_health_check():
    """Versioned health check endpoint for monitoring probes."""
    return health_check()
