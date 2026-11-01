# System Architecture Specification

**Project**: TaskFlow Orchestrator  
**Phase**: 1 — Requirements, Architecture & Design  
**Document Status**: Reviewed & Corrected Baseline  
**Lead Architect**: Senior Backend Architect (Rayhan AI Architecture)

---

## 1. Executive Summary & System Context

TaskFlow Orchestrator is a multi-tenant task and workflow management platform engineered to deliver deterministic operational task tracking, strict multi-tenant boundary isolation, and forward-compatible extensibility for asynchronous job workers and autonomous AI planning agents.

### 1.1 System Context Diagram (C4 Level 1)

```mermaid
graph TD
    ClientApp["Client Applications\n(SPA / Mobile / Third-Party REST)"]
    API["TaskFlow Orchestrator API\n(Modular Monolith - FastAPI)"]
    DB[("Relational Database\n(PostgreSQL 16+)")]
    FutureQueue[("Message Broker & Task Queue\n(Phase 3 - Redis / Celery)")]
    FutureAI["Autonomous AI Agent Host\n(Phase 4 - MCP / LLM Planner)"]

    ClientApp -->|"HTTPS / REST / JWT Bearer"| API
    API -->|"Privileged TCP Connection Pool\n(SQLAlchemy 2.x / Port 5432)"| DB
    API -.->|"Publish Async Job Events\n(Phase 3 Planned)"| FutureQueue
    FutureQueue -.->|"Consume & Execute Jobs\n(Phase 3 Planned)"| DB
    FutureAI -.->|"Authenticated Tool Calls (MCP)\n(Phase 4 Planned - Tenant Scoped)"| API

    classDef primary fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#ffffff;
    classDef storage fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef planned fill:#1e293b,stroke:#f59e0b,stroke-width:1px,stroke-dasharray: 5 5,color:#cbd5e1;

    class API primary;
    class DB storage;
    class FutureQueue,FutureAI planned;
```

### 1.2 System Boundary & Lifecycle Scopes
- **Phase 1 (Current Baseline)**: Architecture, formal domain modeling, API contracts, security threat modeling, and test planning.
- **Phase 2 (Immediate Next)**: Core modular monolith implementation, FastAPI routes, SQLAlchemy 2.x declarative models, Alembic migrations, PyJWT authentication, and cross-tenant isolation test suites.
- **Phase 3 (Future Decoupled Extension)**: Asynchronous background worker queue (Redis / Celery or ARQ) for non-blocking task processing and cron scheduling.
- **Phase 4 (Future Decoupled Extension)**: Model Context Protocol (MCP) server and autonomous LLM planning agent integration.

---

## 2. Modular Monolith Component Architecture

TaskFlow Orchestrator is structured as an in-process **Modular Monolith** organized into distinct domain and infrastructure packages. Modules interact through strongly typed interfaces and FastAPI dependency injection, eliminating premature microservice operational overhead while maintaining strict internal boundaries.

```mermaid
flowchart TD
    subgraph EdgeBoundary["Edge & Ingress Boundary"]
        Client["HTTP Client (Browser / Mobile / Script)"]
        TLS["TLS 1.3 Termination & Reverse Proxy"]
    end

    subgraph FastAPIApp["Modular Monolith Boundary (FastAPI Process)"]
        subgraph GatewayModule["Ingress & Middleware (app.main)"]
            CORS["CORS Middleware"]
            RateLimit["Sliding-Window Rate Limiter"]
            RouterAuth["Auth Router (/api/v1/auth)"]
            RouterTasks["Tasks Router (/api/v1/tasks)"]
            HealthCheck["System Health (/health, /api/v1/health)"]
        end

        subgraph AuthModule["Identity & Security Subsystem (app.auth)"]
            TokenVerifier["Strict PyJWT HS256 Engine\n(sub, exp, iat, iss, aud, type)"]
            BcryptContext["Passlib Bcrypt Hasher\n(Rounds: 12)"]
            AuthDependency["FastAPI get_current_user Dependency"]
        end

        subgraph TaskModule["Task Domain Subsystem (app.routers.tasks)"]
            SchemaValidator["Pydantic v2 Schema Engine\n(TaskCreate, TaskUpdate, TaskResponse)"]
            OwnershipGuard["ADR-002 Ownership Enforcement\n(Task.user_id == current_user.id)"]
        end

        subgraph CoreInfra["Shared Infrastructure & Data Access"]
            ConfigSubsystem["Central Settings (app.config)\nPydantic Settings v2"]
            SessionManager["Session Factory (app.database)\nget_db Dependency"]
            PoolEngine["SQLAlchemy 2.x Engine\npool_size=10, max_overflow=20"]
            AlembicEngine["Alembic Migration Runner\n(Explicit DDL Scripts)"]
        end
    end

    subgraph DataStorage["Data Persistence Tier"]
        Postgres[(PostgreSQL 16+ Engine\nUsers & Tasks Tables)]
    end

    Client -->|"HTTPS / JSON"| TLS
    TLS --> CORS
    CORS --> RateLimit
    RateLimit --> RouterAuth
    RateLimit --> RouterTasks
    RateLimit --> HealthCheck

    RouterAuth --> BcryptContext
    RouterAuth --> TokenVerifier
    RouterAuth --> SessionManager

    RouterTasks --> AuthDependency
    AuthDependency --> TokenVerifier
    AuthDependency --> SessionManager

    RouterTasks --> SchemaValidator
    SchemaValidator --> OwnershipGuard
    OwnershipGuard --> SessionManager

    ConfigSubsystem -.-> PoolEngine
    ConfigSubsystem -.-> TokenVerifier
    SessionManager --> PoolEngine
    PoolEngine -->|"Privileged TCP Pool (Port 5432)"| Postgres
    AlembicEngine -.->|"Schema DDL Migrations"| Postgres

    classDef comp fill:#0f172a,stroke:#818cf8,stroke-width:1px,color:#f8fafc;
    class CORS,RateLimit,RouterAuth,RouterTasks,HealthCheck,TokenVerifier,BcryptContext,AuthDependency,SchemaValidator,OwnershipGuard,ConfigSubsystem,SessionManager,PoolEngine,AlembicEngine comp;
```

---

## 3. End-to-End Request Lifecycle & Authorization Sequence

The following sequence details the full execution path for a protected task mutation request (`POST /api/v1/tasks`), demonstrating the exact validation checks for claims, active status, and ADR-002 ownership binding.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Authenticated Client
    participant Proxy as Reverse Proxy / CORS
    participant Router as Task Router (app.routers.tasks)
    participant Auth as Auth Dependency (get_current_user)
    participant JWT as PyJWT Validator (app.auth)
    participant DB as SQLAlchemy Session & Postgres

    Client->>Proxy: POST /api/v1/tasks (Header: Authorization: Bearer <token>)
    Proxy->>Router: Forward Request Payload & Headers
    Router->>Auth: Invoke Depends(get_current_user)
    Auth->>JWT: Verify Token (HS256, Secret, Algorithms)
    JWT->>JWT: Validate Claims (sub, exp=1800s, iat, iss="taskflow", aud="taskflow-api", type="access")
    
    alt Missing or Expired or Invalid Claim
        JWT-->>Auth: ClaimVerificationError / ExpiredSignatureError
        Auth-->>Client: HTTP 401 Unauthorized (WWW-Authenticate: Bearer error="invalid_token")
    else Claims Cryptographically Valid
        JWT-->>Auth: Return Validated Claims Payload (sub=user_uuid)
        Auth->>DB: SELECT * FROM users WHERE id = user_uuid AND is_active = true
        DB-->>Auth: User Record Found & Active
        Auth-->>Router: Injected current_user Entity
    end

    Router->>Router: Pydantic v2 Validate Body (title, description, status, priority, due_date)
    alt Invalid Input Schema (e.g., empty title, invalid enum)
        Router-->>Client: HTTP 422 Unprocessable Entity
    else Valid Payload
        Router->>Router: Bind Task.user_id = current_user.id
        Router->>DB: INSERT INTO tasks (id, user_id, title, status, priority, ...) VALUES (...)
        DB-->>Router: Insert Acknowledged
        Router->>DB: Commit Transaction
        Router-->>Client: HTTP 201 Created (Serialized TaskResponse)
    end
```

---

## 4. Future Queue / Worker Architecture (Phase 3 Planned)

Phase 3 introduces asynchronous background execution without breaking modular monolith boundaries. Synchronous HTTP endpoints never block on heavy operations; instead, jobs are dispatched to a Redis-backed message broker.

```mermaid
graph TD
    subgraph MonolithCore["TaskFlow API (Modular Monolith)"]
        TaskEndpoint["Task Mutation / Schedule Route"]
        EventDispatcher["Job Dispatcher Interface\n(app.tasks.queue)"]
    end

    subgraph BrokerQueue["Message Broker Tier (Phase 3)"]
        RedisQueue[("Redis Broker\nTask Event Queues")]
        DeadLetter[("Redis DLQ\nFailed Jobs")]
    end

    subgraph WorkerPool["Asynchronous Worker Tier (Phase 3)"]
        WorkerProcess1["Celery / ARQ Worker 1\n(Task Runner)"]
        WorkerProcess2["Celery / ARQ Worker 2\n(Notification Runner)"]
        CronScheduler["Beat / Periodic Scheduler\n(Recurring Tasks)"]
    end

    subgraph DataStore["Persistence Tier"]
        Postgres[("PostgreSQL 16+\nShared Models & State")]
    end

    TaskEndpoint -->|"Enqueue Job Payload"| EventDispatcher
    EventDispatcher -->|"LPUSH / AMQP Message"| RedisQueue
    CronScheduler -->|"Publish Scheduled Event"| RedisQueue

    RedisQueue -->|"BRPOP Job"| WorkerProcess1
    RedisQueue -->|"BRPOP Job"| WorkerProcess2
    WorkerProcess1 -.->|"Exceeded Max Retries"| DeadLetter

    WorkerProcess1 -->|"Read / Update Task State\n(Using Same SQLAlchemy Models)"| Postgres
    WorkerProcess2 -->|"Log Execution Audit"| Postgres

    classDef core fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#ffffff;
    classDef broker fill:#0f172a,stroke:#f59e0b,stroke-width:1.5px,color:#ffffff;
    classDef worker fill:#0f172a,stroke:#10b981,stroke-width:1.5px,color:#ffffff;
    classDef db fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;

    class TaskEndpoint,EventDispatcher core;
    class RedisQueue,DeadLetter broker;
    class WorkerProcess1,WorkerProcess2,CronScheduler worker;
    class Postgres db;
```

---

## 5. Future AI Planner & MCP Integration Architecture (Phase 4 Planned)

Phase 4 introduces autonomous task planning via the **Model Context Protocol (MCP)**. 

### Mandatory Multi-Tenant Security Guarantee:
AI agents and LLM planners **NEVER** receive direct database connection strings and **CANNOT** execute raw SQL queries. Every tool interaction routes through the authenticated application service layer, strictly binding tool execution to the verified tenant identity (`user_id`).

```mermaid
flowchart TD
    subgraph LLMClient["Autonomous AI Agent Host (Phase 4)"]
        PlannerAgent["LLM Task Planner\n(Gemini / Claude Agent)"]
    end

    subgraph MCPBoundary["MCP Service Interface Boundary"]
        MCPServer["Model Context Protocol Server\n(FastMCP / SSE Transport)"]
        TenantContextInjector["Tenant Security Context Injector\n(Binds API Key / Token -> tenant_id)"]
    end

    subgraph CoreApplication["TaskFlow Modular Monolith"]
        ToolRegistry["Registered Tool Handlers:\n- create_task_tool()\n- list_tasks_tool()\n- update_task_status_tool()"]
        AppServiceLayer["Application Service Layer\n(Enforces user_id == tenant_id)"]
        Persistence["SQLAlchemy 2.x Session Engine"]
    end

    subgraph Storage["PostgreSQL Database"]
        DB[(Tenant Scoped Records)]
    end

    PlannerAgent -->|"1. Request Tool Call (JSON-RPC)"| MCPServer
    MCPServer -->|"2. Extract Tenant Credentials"| TenantContextInjector
    TenantContextInjector -->|"3. Injected Authorized Context"| ToolRegistry
    ToolRegistry -->|"4. Execute Service with Bound tenant_id"| AppServiceLayer
    AppServiceLayer -->|"5. Scoped Query: WHERE user_id = tenant_id"| Persistence
    Persistence -->|"6. Query Execution"| DB
    DB -->> Persistence: Tenant Data Only
    Persistence -->> AppServiceLayer: Entity Result
    AppServiceLayer -->> ToolRegistry: Sanitized DTO
    ToolRegistry -->> MCPServer: Formatted Tool Result
    MCPServer -->> PlannerAgent: LLM Context Feed

    classDef agent fill:#1e1b4b,stroke:#a855f7,stroke-width:2px,color:#ffffff;
    classDef mcp fill:#0f172a,stroke:#10b981,stroke-width:1.5px,color:#ffffff;
    classDef core fill:#0f172a,stroke:#6366f1,stroke-width:1.5px,color:#ffffff;
    classDef storage fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;

    class PlannerAgent agent;
    class MCPServer,TenantContextInjector mcp;
    class ToolRegistry,AppServiceLayer,Persistence core;
    class DB storage;
```

---

## 6. Technology Choices & Trade-Off Matrix

| Technology Component | Approved Selection | Evaluated Alternatives | Technical Rationale & Architectural Trade-Offs |
| :--- | :--- | :--- | :--- |
| **Language & Framework** | **Python 3.11+ with FastAPI** | Node.js (NestJS), Go (Gin/Echo), Django | Rapid iteration, first-class asynchronous support (`asyncio`), native integration with Pydantic v2 validation, automatic OpenAPI 3.1 documentation, and immediate alignment with Python's AI/MCP ecosystem for Phase 4. |
| **Persistence Engine** | **PostgreSQL 16+** | MongoDB, MySQL, SQLite | Strong relational ACID guarantees, native UUID storage, robust composite B-Tree indexes, JSONB support for future tool telemetry, and native `pgvector` capability for semantic embeddings in Phase 4. |
| **ORM & Persistence** | **SQLAlchemy 2.x** | Tortoise ORM, Peewee, Raw asyncpg | SQLAlchemy 2.0 provides fully typed `Mapped` declarations, mature thread-safe connection pooling, explicit transaction control, and seamless Alembic migration integration. |
| **Schema Evolution** | **Alembic** | Flyway, Liquibase, Django Migrations | Native integration with SQLAlchemy models; enforces deterministic, version-controlled DDL script execution. Runtime `create_all` is prohibited. |
| **Multi-Tenant Security** | **ADR-002: Backend Privileged + App-Level** | PostgreSQL / Supabase Row-Level Security (RLS) | High connection pool performance, zero session variable contamination in pooling proxies, 100% vendor portability across clouds, and sub-second in-memory SQLite unit/API test suites. |
| **Authentication Standard** | **PyJWT (HS256) + Passlib (Bcrypt)** | External OAuth Providers (Auth0, Clerk) | Self-contained, zero external runtime network dependencies, complete architectural control over token claims and cryptographic verification parameters. |
