# TaskFlow Orchestrator — Enterprise Multi-Tenant Task Architecture

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-red.svg)](https://www.sqlalchemy.org/)
[![Pydantic](https://img.shields.io/badge/Pydantic-v2-e92063.svg)](https://docs.pydantic.dev/)
[![Alembic](https://img.shields.io/badge/Alembic-Migrations-orange.svg)](https://alembic.sqlalchemy.org/)
[![Architecture](https://img.shields.io/badge/Architecture-ADR--002-purple.svg)](#architecture--adr-002)
[![Governance](https://img.shields.io/badge/Governance-Phase%201%20Audited-emerald.svg)](#project-status--verification-matrix)

**Principal Architect**: Rayhan Badsha  
**Brand**: Rayhan AI Architecture  
**Role**: Applied AI Systems Architect & Senior Backend Engineer  
**Professional Links**: [LinkedIn](https://www.linkedin.com/in/rayhan-badsha-a71662294) | [GitHub](https://github.com/rayhan-ai-architect) | [Curizx AI Employee](https://github.com/rayhan-ai-architect/curizx-ai-employee) | [AI Engineering Masterclass](https://youtube.com/playlist?list=PLbIePX5F-An4)

---

## 1. Project Overview

**TaskFlow Orchestrator** is an enterprise-grade multi-tenant task and workflow management platform. It is engineered with architectural rigor: prioritizing data isolation, defense-in-depth security, and strict separation of concerns over superficial AI wrappers.

### Core Problems Addressed:
1. **Multi-Tenant Data Leakage**: Eliminating IDOR (Insecure Direct Object Reference) and cross-tenant data exposure through application-level predicate isolation (`user_id == current_user.id`).
2. **Database Performance & Connection Overhead**: Avoiding the heavy connection-pooling penalties of Supabase Row-Level Security (RLS) by leveraging a single, high-throughput SQLAlchemy 2.x pooled connection.
3. **Deterministic Schema Evolution**: Eliminating runtime schema auto-generation (`create_all`) in favor of explicit, auditable, version-controlled Alembic migrations.
4. **Future AI & Distributed Extensibility**: Decoupling future Celery/Redis asynchronous workers (Phase 3) and Model Context Protocol (MCP) tool-calling AI agents (Phase 4) so they interact solely through authenticated application service layers rather than bypassing tenant authorization.

---

## 2. System Architecture & ADR-002

The platform is designed as a **Modular Monolith** organized into distinct, decoupled subsystems.

```
                      +---------------------------------------+
                      |       Client Applications / SPA       |
                      +---------------------------------------+
                                          |  HTTPS / JWT Bearer
                                          v
+---------------------------------------------------------------------------------+
|                        FastAPI Modular Monolith Boundary                        |
|                                                                                 |
|  [Ingress & Middleware]                                                         |
|  - CORS & Rate Limiting                                                         |
|  - Strict PyJWT HS256 Engine (sub, exp=30m, iat, iss, aud, type="access")       |
|                                                                                 |
|  [Auth Subsystem]                 [Task Domain Subsystem]                       |
|  - Passlib Bcrypt (12 rounds)     - Pydantic v2 Schema Validation               |
|  - /api/v1/auth/register, login   - ADR-002 Ownership Enforcement               |
|                                     (WHERE tasks.user_id = current_user.id)     |
|                                                                                 |
|  [Infrastructure & Data Tier]                                                   |
|  - SQLAlchemy 2.x Privileged Pool (pool_size=10, max_overflow=20)              |
|  - Alembic Explicit DDL Migrations (No startup create_all)                      |
+---------------------------------------------------------------------------------+
           |                                                      |
           | Privileged TCP (Port 5432)                           | Authenticated MCP Tool Call
           v                                                      v
+------------------------+                             +------------------------+
|    PostgreSQL 16+      |                             | Phase 4 Autonomous AI  |
|  (Users & Tasks with   |                             |   (Agent Host / MCP    |
|   UUIDv4 & UTC Times)  |                             |    Tenant Constrained) |
+------------------------+                             +------------------------+
           ^
           | Async Jobs (Phase 3 Planned)
+------------------------------------+
|  Phase 3 Asynchronous Worker Pool |
|         (Redis + Celery)           |
+------------------------------------+
```

### Architectural Decision Record (ADR-002): Backend Privileged Connection vs. Supabase RLS

| Dimension | ADR-002 (TaskFlow Implementation) | Supabase / Database RLS |
| :--- | :--- | :--- |
| **Connection Pooling** | **Optimal**: Shared connection pool (`pool_size=10, max_overflow=20`) via PgBouncer or SQLAlchemy engine. | **Heavy Penalty**: Requires executing `SET LOCAL role` or session variables per transaction. |
| **Vendor Portability** | **100% Vendor Agnostic**: Compatible with AWS RDS, Google Cloud SQL, Azure, self-hosted Docker PostgreSQL. | **Vendor Locked**: Coupled to proprietary Supabase authentication schemas and extensions. |
| **Auditability** | **Explicit in Python**: Filters (`Task.user_id == current_user.id`) are inspectable in unit and API test suites. | **Opaque in SQL**: Policies live in database catalogs; harder to debug and regression-test. |
| **Tenant Isolation** | **Enforced**: Unauthorized cross-user requests return `404 Not Found` to prevent enumeration probing. | Direct database connection or misconfigured policy leaks all tenant data. |

---

## 3. Technology Stack

- **Runtime**: Python 3.11+
- **API Framework**: FastAPI 0.111+ (ASGI modular routers, dependency injection)
- **Data Modeling & ORM**: SQLAlchemy 2.0 (Typed `Mapped[]`, `DeclarativeBase`)
- **Schema Validation**: Pydantic v2 (Strict type checking, `exclude_unset=True` for PATCH semantics)
- **Database Engine**: PostgreSQL 16+ (UUID primary keys, timezone-aware UTC timestamps)
- **Database Migrations**: Alembic 1.13+ (Version-controlled DDL scripts)
- **Security & Cryptography**: Passlib 1.7.4 (Bcrypt hashing, 12 rounds), PyJWT 2.8+ (Strict HS256 validation with 6 mandatory claims)
- **Testing Framework**: Pytest 8.2+ with `httpx` (`TestClient`) and in-memory SQLite isolation

---

## 4. Project File Tree

```
taskflow-orchestrator/
├── START_HERE.html                   # Offline interactive master viewer with embedded Mermaid JS
├── EVIDENCE_PACKAGE_MANIFEST.json   # Phase 1 governance audit manifest & file integrity data
├── কিভাবে_ওপেন_করবেন.txt             # বাংলা কুইকস্টার্ট নির্দেশিকা (Offline Visual Guide)
├── HOW_TO_OPEN.txt                   # English quickstart guide
├── README.md                         # This comprehensive technical documentation
├── requirements.txt                  # Locked Python dependencies
├── alembic.ini                       # Alembic database migration configuration
├── .env.example                      # Environment variable templates
│
├── docs/                             # Phase 1 Architecture Specifications (9 Documents)
│   ├── api/
│   │   └── api-contract.md           # REST endpoints, JWT contract (30m expiry), schemas, HTTP codes
│   ├── architecture/
│   │   ├── system-architecture.md    # System context, modular monolith, sequence, queue/AI boundaries
│   │   └── database-er-diagram.md    # Users & Tasks ER model, UUID PKs, justified composite indexes
│   ├── decisions/
│   │   ├── ADR-001-modular-monolith.md  # Modular monolith architecture decision
│   │   └── ADR-002-database-security.md # Backend Privileged Connection without Supabase RLS
│   ├── security/
│   │   └── threat-model.md           # STRIDE analysis, token theft, tenant leakage, rate limiting
│   ├── testing/
│   │   └── test-plan.md              # Test strategy: In-memory SQLite vs Dockerized PostgreSQL 16+
│   ├── phase-reports/
│   │   ├── phase-01-review.md        # Requirements Traceability Matrix (REQ-01 to REQ-15)
│   │   └── phase-01-audit-report.md  # Tripartite verification audit report
│   └── diagrams/                     # 7 Mermaid Source Files (.mmd) & 7 Standalone Viewers (.html)
│       ├── 01-system-context.mmd        & 01-system-context.html
│       ├── 02-modular-monolith.mmd      & 02-modular-monolith.html
│       ├── 03-request-sequence.mmd      & 03-request-sequence.html
│       ├── 04-queue-worker-boundary.mmd & 04-queue-worker-boundary.html
│       ├── 05-ai-mcp-boundary.mmd       & 05-ai-mcp-boundary.html
│       ├── 06-database-er.mmd           & 06-database-er.html
│       └── 07-task-status-fsm.mmd       & 07-task-status-fsm.html
│
├── app/                              # Phase 2 Modular Monolith Backend Implementation
│   ├── __init__.py                   # Package initialization (v0.2.0)
│   ├── config.py                     # Pydantic v2 Settings (environment variables)
│   ├── database.py                   # SQLAlchemy 2.x engine, SessionLocal, get_db dependency
│   ├── models.py                     # SQLAlchemy 2.x typed models (User, Task)
│   ├── schemas.py                    # Pydantic v2 validation & serialization schemas
│   ├── auth.py                       # Bcrypt password hashing & PyJWT token signing/verification
│   ├── main.py                       # FastAPI application entry point, CORS, health checks
│   └── routers/
│       ├── __init__.py
│       ├── auth.py                   # /api/v1/auth (POST /register, POST /login, GET /me)
│       └── tasks.py                  # /api/v1/tasks (CRUD + strict ADR-002 ownership filtering)
│
├── alembic/                          # Database Migrations
│   ├── env.py                        # Alembic migration runner
│   ├── script.py.mako                # Migration template
│   └── versions/
│       └── 001_initial_schema.py     # Initial DDL: users and tasks tables with composite indexes
│
└── tests/                            # Test Suite
    ├── __init__.py
    ├── conftest.py                   # In-memory SQLite engine, TestClient, User A/B test fixtures
    ├── test_auth.py                  # Auth tests (registration, login, JWT claims, token expiry)
    └── test_tasks.py                 # Task CRUD, partial update, and cross-user isolation tests
```

---

## 5. Local Setup & Execution Guide

### Prerequisites
- Python 3.11 or higher
- PostgreSQL 16+ (for production or migration testing)
- `pip` and `virtualenv`

### Step 1: Clone & Create Virtual Environment
```bash
git clone https://github.com/rayhan-ai-architect/taskflow-orchestrator.git
cd taskflow-orchestrator
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

### Step 2: Install Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables
```bash
cp .env.example .env
```
Key configuration parameters:
- `DATABASE_URL`: `postgresql://postgres:postgres@localhost:5432/taskflow_db`
- `JWT_SECRET_KEY`: High-entropy 256-bit secret (generate with `openssl rand -hex 32`)
- `JWT_ALGORITHM`: `HS256`
- `ACCESS_TOKEN_EXPIRE_MINUTES`: `30` (Strict Phase 1 audit baseline)

### Step 4: Run Database Migrations (PostgreSQL)
Ensure your PostgreSQL database is reachable, then execute:
```bash
alembic upgrade head
```

### Step 5: Start the API Server
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Interactive API docs are available at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **Health Check**: `http://localhost:8000/health`

### Step 6: Execute the Test Suite (Planned)
The test suite utilizes an in-memory SQLite database configured in `tests/conftest.py`:
```bash
pytest -v tests/
```

---

## 6. Project Status & Verification Matrix

In strict adherence to engineering governance and transparent reporting, the project distinguishes between **what has actually been executed and verified** versus **what is designed, authored, and planned for execution upon formal sign-off**:

```
+----------------------------------------------------------------------------------------------------+
|                                    PROJECT VERIFICATION MATRIX                                     |
+-----------------------------------+--------------------+-------------------------------------------+
| Component / Deliverable           | Status             | Verification Evidence & Notes             |
+-----------------------------------+--------------------+-------------------------------------------+
| Phase 1: Architecture Specs (9)   | AUDITED & READY    | All 9 Markdown files verified & consistent|
| Phase 1: Architectural Diagrams(7)| AUDITED & READY    | 7 Mermaid .mmd + 7 .html viewers rendered |
| Phase 1: Requirements Matrix      | AUDITED & READY    | REQ-01 through REQ-15 traced in review doc|
| Phase 1: JWT Contract (30m, 6 clm)| AUDITED & READY    | Consistent across API spec & threat model |
| Phase 2: Python Codebase Syntax   | COMPILED & CLEAN   | `python3 -m py_compile` passed (0 errors) |
| Phase 2: Database Schema (Alembic)| AUTHORED (PLANNED) | Migration script written; DB run pending  |
| Phase 2: Pytest Suite Execution   | AUTHORED (PLANNED) | Test files authored; live run pending     |
| Live PostgreSQL 16+ Migrations    | NOT YET EXECUTED   | Requires project owner env provisioning   |
| Live Production Deployment        | NOT YET EXECUTED   | Production deployment not yet performed   |
+-----------------------------------+--------------------+-------------------------------------------+
```

### Clarification on Verification & Demonstration Data:
1. **Phase 2 Tests & Backend Execution**:
   - The Python codebase is **100% syntactically valid and compiles cleanly** (`python3 -m py_compile` passed on all 12 modules).
   - However, **live runtime execution of the Pytest suite against a running PostgreSQL 16+ container has NOT yet been executed in production**. The tests remain marked as `PLANNED` until formal project owner sign-off and environment configuration.
2. **Phase 2 Alembic Migrations**:
   - The initial migration file (`alembic/versions/001_initial_schema.py`) is fully authored and structured with composite indexes and UUID types, but **live migration execution against an external production PostgreSQL database has not been run**.
3. **No Mock Data Presented as Live Production**:
   - The interactive status distribution chart in the companion web portal is a **mock visualization component** designed using Recharts to demonstrate how future Task API telemetry will be rendered. It represents **zero live production metrics or fabricated database records**.

---

## 7. Phase Roadmap

- **Phase 1: Architecture, Threat Modeling & Governance** *(Status: Audited & Complete — Pending Sign-off)*
  - System context, Modular Monolith demarcation, ADR-001, ADR-002, 6-claim JWT spec, STRIDE threat model, tripartite audit report.
- **Phase 2: Core Engine & Multi-Tenant Authorization** *(Status: Codebase Authored & Syntactically Validated — Runtime Execution Planned)*
  - FastAPI modular routers, Pydantic v2 schemas, SQLAlchemy 2.x models, Alembic migrations, Pytest suite.
- **Phase 3: Asynchronous Worker Queue & Event Processing** *(Status: Deferred & Planned)*
  - Distributed background task execution using Redis and Celery, event streaming, and scheduled tasks.
- **Phase 4: Autonomous AI Planner & MCP Tool Host** *(Status: Deferred & Planned)*
  - Model Context Protocol (MCP) host, agentic task planning, tool calling strictly constrained to authenticated API service boundaries.

---

## 8. Preserved Phase 1 Evidence & Download Packages

The repository preserves the complete Phase 1 evidence package in multiple accessible formats:

1. **Master Offline Viewer (`START_HERE.html`)**:
   - Double-clicking `START_HERE.html` in the root folder opens an interactive, zero-dependency offline portal in any web browser.
   - Automatically renders all 7 Mermaid diagrams graphically and allows interactive browsing of all 9 specification documents.
2. **Evidence Package Archive**:
   - `taskflow-phase1-evidence-package.zip`: Contains all 9 documentation specs, 7 `.mmd` source files, 7 `.html` visual diagram viewers, manifest, and quickstart guides.
3. **Complete Project Archive**:
   - `taskflow-orchestrator-full-project.zip`: Bundles the complete Phase 1 documentation package alongside the entire Phase 2 FastAPI codebase, Alembic migrations, and test files.

---

*Authored with strict architectural discipline by **Rayhan Badsha** (Rayhan AI Architecture).*
