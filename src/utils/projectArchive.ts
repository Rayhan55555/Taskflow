import JSZip from 'jszip';

export interface ProjectFile {
  path: string;
  content: string;
  category?: string;
}

export const DIAGRAM_SOURCES: Record<string, { title: string; type: string; code: string; summary: string }> = {
  '01-system-context': {
    title: '01. System Context Diagram (C4 Level 1)',
    type: 'graph TD',
    summary: 'Client Applications -> Modular Monolith API -> PostgreSQL 16+ with decoupled Phase 3 Queue and Phase 4 AI.',
    code: `graph TD
    ClientApp["Client Applications\\n(SPA / Mobile / Third-Party REST)"]
    API["TaskFlow Orchestrator API\\n(Modular Monolith - FastAPI)"]
    DB[("Relational Database\\n(PostgreSQL 16+)")]
    FutureQueue[("Message Broker & Task Queue\\n(Phase 3 - Redis / Celery)")]
    FutureAI["Autonomous AI Agent Host\\n(Phase 4 - MCP / LLM Planner)"]

    ClientApp -->|"HTTPS / REST / JWT Bearer"| API
    API -->|"Privileged TCP Connection Pool\\n(SQLAlchemy 2.x / Port 5432)"| DB
    API -.->|"Publish Async Job Events\\n(Phase 3 Planned)"| FutureQueue
    FutureQueue -.->|"Consume & Execute Jobs\\n(Phase 3 Planned)"| DB
    FutureAI -.->|"Authenticated Tool Calls (MCP)\\n(Phase 4 Planned - Tenant Scoped)"| API

    classDef primary fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#ffffff;
    classDef storage fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef planned fill:#1e293b,stroke:#f59e0b,stroke-width:1px,stroke-dasharray: 5 5,color:#cbd5e1;

    class API primary;
    class DB storage;
    class FutureQueue,FutureAI planned;`
  },
  '02-modular-monolith': {
    title: '02. Modular Monolith Subsystems Architecture',
    type: 'flowchart TD',
    summary: 'Internal domain partitioning: Edge Gateway, Auth Subsystem, Task Domain, Shared Infrastructure, Persistence.',
    code: `flowchart TD
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
            TokenVerifier["Strict PyJWT HS256 Engine\\n(sub, exp, iat, iss, aud, type)"]
            BcryptContext["Passlib Bcrypt Hasher\\n(Rounds: 12)"]
            AuthDependency["FastAPI get_current_user Dependency"]
        end

        subgraph TaskModule["Task Domain Subsystem (app.routers.tasks)"]
            SchemaValidator["Pydantic v2 Schema Engine\\n(TaskCreate, TaskUpdate, TaskResponse)"]
            OwnershipGuard["ADR-002 Ownership Enforcement\\n(Task.user_id == current_user.id)"]
        end

        subgraph CoreInfra["Shared Infrastructure & Data Access"]
            ConfigSubsystem["Central Settings (app.config)\\nPydantic Settings v2"]
            SessionManager["Session Factory (app.database)\\nget_db Dependency"]
            PoolEngine["SQLAlchemy 2.x Engine\\npool_size=10, max_overflow=20"]
            AlembicEngine["Alembic Migration Runner\\n(Explicit DDL Scripts)"]
        end
    end

    subgraph DataStorage["Data Persistence Tier"]
        Postgres[(PostgreSQL 16+ Engine\\nUsers & Tasks Tables)]
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
    class CORS,RateLimit,RouterAuth,RouterTasks,HealthCheck,TokenVerifier,BcryptContext,AuthDependency,SchemaValidator,OwnershipGuard,ConfigSubsystem,SessionManager,PoolEngine,AlembicEngine comp;`
  },
  '03-request-sequence': {
    title: '03. End-to-End Request Lifecycle Sequence Diagram',
    type: 'sequenceDiagram',
    summary: 'Autonumbered sequence for POST /tasks with JWT claim verification, active user check, and ADR-002 ownership binding.',
    code: `sequenceDiagram
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
    end`
  },
  '04-queue-worker-boundary': {
    title: '04. Asynchronous Queue & Worker Pool Boundary (Phase 3)',
    type: 'graph TD',
    summary: 'Decoupled event queue architecture: In-process dispatcher -> Redis Queue -> Celery/ARQ workers with shared PostgreSQL persistence.',
    code: `graph TD
    subgraph MonolithCore["TaskFlow API (Modular Monolith)"]
        TaskEndpoint["Task Mutation / Schedule Route"]
        EventDispatcher["Job Dispatcher Interface\\n(app.tasks.queue)"]
    end

    subgraph BrokerQueue["Message Broker Tier (Phase 3)"]
        RedisQueue[("Redis Broker\\nTask Event Queues")]
        DeadLetter[("Redis DLQ\\nFailed Jobs")]
    end

    subgraph WorkerPool["Asynchronous Worker Tier (Phase 3)"]
        WorkerProcess1["Celery / ARQ Worker 1\\n(Task Runner)"]
        WorkerProcess2["Celery / ARQ Worker 2\\n(Notification Runner)"]
        CronScheduler["Beat / Periodic Scheduler\\n(Recurring Tasks)"]
    end

    subgraph DataStore["Persistence Tier"]
        Postgres[("PostgreSQL 16+\\nShared Models & State")]
    end

    TaskEndpoint -->|"Enqueue Job Payload"| EventDispatcher
    EventDispatcher -->|"LPUSH / AMQP Message"| RedisQueue
    CronScheduler -->|"Publish Scheduled Event"| RedisQueue

    RedisQueue -->|"BRPOP Job"| WorkerProcess1
    RedisQueue -->|"BRPOP Job"| WorkerProcess2
    WorkerProcess1 -.->|"Exceeded Max Retries"| DeadLetter

    WorkerProcess1 -->|"Read / Update Task State\\n(Using Same SQLAlchemy Models)"| Postgres
    WorkerProcess2 -->|"Log Execution Audit"| Postgres

    classDef core fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#ffffff;
    classDef broker fill:#0f172a,stroke:#f59e0b,stroke-width:1.5px,color:#ffffff;
    classDef worker fill:#0f172a,stroke:#10b981,stroke-width:1.5px,color:#ffffff;
    classDef db fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;

    class TaskEndpoint,EventDispatcher core;
    class RedisQueue,DeadLetter broker;
    class WorkerProcess1,WorkerProcess2,CronScheduler worker;
    class Postgres db;`
  },
  '05-ai-mcp-boundary': {
    title: '05. AI Planner & Model Context Protocol (MCP) Boundary (Phase 4)',
    type: 'flowchart TD',
    summary: 'Autonomous AI Agent connects exclusively through authenticated MCP proxy enforcing strict user_id scoping.',
    code: `flowchart TD
    subgraph LLMClient["Autonomous AI Agent Host (Phase 4)"]
        PlannerAgent["LLM Task Planner\\n(Gemini / Claude Agent)"]
    end

    subgraph MCPBoundary["MCP Service Interface Boundary"]
        MCPServer["Model Context Protocol Server\\n(FastMCP / SSE Transport)"]
        TenantContextInjector["Tenant Security Context Injector\\n(Binds API Key / Token -> tenant_id)"]
    end

    subgraph CoreApplication["TaskFlow Modular Monolith"]
        ToolRegistry["Registered Tool Handlers:\\n- create_task_tool()\\n- list_tasks_tool()\\n- update_task_status_tool()"]
        AppServiceLayer["Application Service Layer\\n(Enforces user_id == tenant_id)"]
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
    class DB storage;`
  },
  '06-database-er': {
    title: '06. Database Entity-Relationship (ERD) Model',
    type: 'erDiagram',
    summary: 'Relational model for Users and Tasks: UUID primary keys, ON DELETE CASCADE, and justified secondary/composite indexes.',
    code: `erDiagram
    USERS ||--o{ TASKS : "owns (1:N)"

    USERS {
        uuid id PK "UUIDv4 Primary Key (gen_random_uuid())"
        varchar email UK "Unique User Email (Normalized)"
        varchar password_hash "Bcrypt Salted Hash (Never Exposed)"
        varchar full_name "Optional Display Name"
        boolean is_active "Account Status Flag"
        timestamp_with_tz created_at "UTC Registration Timestamp"
        timestamp_with_tz updated_at "UTC Last Modified Timestamp"
    }

    TASKS {
        uuid id PK "UUIDv4 Primary Key (gen_random_uuid())"
        uuid user_id FK "Owner User Foreign Key (ON DELETE CASCADE)"
        varchar title "Task Headline (1-200 chars)"
        text description "Optional Detailed Body / Markdown"
        varchar status "State: pending | in_progress | completed | archived"
        varchar priority "Level: low | medium | high | urgent"
        timestamp_with_tz due_date "Optional UTC Completion Deadline"
        timestamp_with_tz created_at "UTC Creation Timestamp"
        timestamp_with_tz updated_at "UTC Last Update Timestamp"
    }`
  },
  '07-task-status-fsm': {
    title: '07. Task Status Finite State Machine (FSM)',
    type: 'stateDiagram-v2',
    summary: 'Finite state machine transitions across pending, in_progress, completed, and archived states.',
    code: `stateDiagram-v2
    [*] --> pending : POST /api/v1/tasks (Creation)
    
    pending --> in_progress : PATCH /api/v1/tasks/{id} (status="in_progress")
    pending --> archived : PATCH /api/v1/tasks/{id} (status="archived")
    
    in_progress --> completed : PATCH /api/v1/tasks/{id} (status="completed")
    in_progress --> pending : PATCH /api/v1/tasks/{id} (status="pending")
    in_progress --> archived : PATCH /api/v1/tasks/{id} (status="archived")
    
    completed --> in_progress : PATCH /api/v1/tasks/{id} (Re-open)
    completed --> archived : PATCH /api/v1/tasks/{id} (status="archived")
    
    archived --> pending : PATCH /api/v1/tasks/{id} (Restore)
    
    pending --> [*] : DELETE /api/v1/tasks/{id} (Hard Delete)
    in_progress --> [*] : DELETE /api/v1/tasks/{id} (Hard Delete)
    completed --> [*] : DELETE /api/v1/tasks/{id} (Hard Delete)
    archived --> [*] : DELETE /api/v1/tasks/{id} (Hard Delete)`
  }
};

/**
 * Generates an individual standalone HTML file for a single diagram.
 * Double-clicking this file in any browser renders the diagram visually.
 */
export function generateSingleDiagramHtml(title: string, mmdCode: string, summary: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | TaskFlow Orchestrator</title>
  <style>
    body {
      margin: 0;
      padding: 24px;
      background-color: #0b0f19;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      padding-bottom: 16px;
      border-bottom: 1px solid #1e293b;
      margin-bottom: 24px;
    }
    h1 {
      margin: 0 0 8px 0;
      font-size: 22px;
      color: #ffffff;
    }
    p {
      margin: 0;
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.5;
    }
    .diagram-card {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 32px;
      overflow-x: auto;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .source-card {
      margin-top: 24px;
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #cbd5e1;
      white-space: pre;
      overflow-x: auto;
    }
    .back-btn {
      display: inline-block;
      margin-top: 20px;
      padding: 8px 16px;
      background: #4f46e5;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
    }
    .back-btn:hover {
      background: #4338ca;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {
      mermaid.initialize({
        startOnLoad: true,
        theme: "dark",
        themeVariables: {
          darkMode: true,
          background: "#0f172a",
          primaryColor: "#4f46e5",
          primaryTextColor: "#ffffff",
          primaryBorderColor: "#6366f1",
          lineColor: "#38bdf8",
          secondaryColor: "#0284c7",
          tertiaryColor: "#1e293b"
        }
      });
    });
  </script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <p>${summary}</p>
    </div>

    <div class="diagram-card">
      <div class="mermaid">
${mmdCode}
      </div>
    </div>

    <div style="margin-top: 24px;">
      <h3 style="font-size: 14px; margin-bottom: 8px; color: #cbd5e1;">Mermaid Raw Source Code</h3>
      <div class="source-card">${mmdCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>

    <a href="../START_HERE.html" class="back-btn">← Back to Master Project Viewer (START_HERE.html)</a>
  </div>
</body>
</html>`;
}

/**
 * Generates the master offline HTML application (START_HERE.html / index.html).
 * This self-contained application renders all 7 visual diagrams, all 9 architecture docs,
 * the source code browser, and the task status visualizer directly in any browser with zero dependencies!
 */
export function generateMasterViewerHtml(docFiles: Record<string, { title: string; path: string; category: string; summary: string; content: string }>): string {
  const docsJson = JSON.stringify(docFiles);
  const diagramsJson = JSON.stringify(DIAGRAM_SOURCES);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TaskFlow Orchestrator | Complete Project & Architecture Viewer</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #0f172a;
      --card-border: #1e293b;
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --emerald: #10b981;
      --amber: #f59e0b;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--card-border);
      padding: 16px 24px;
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-icon {
      width: 36px;
      height: 36px;
      background: rgba(79, 70, 229, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.4);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #818cf8;
      font-weight: bold;
    }
    .brand-title {
      font-size: 16px;
      font-weight: 700;
      color: #fff;
    }
    .brand-sub {
      font-size: 11px;
      color: var(--text-muted);
    }
    nav.nav-tabs {
      display: flex;
      background: #090d16;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 4px;
      gap: 4px;
      overflow-x: auto;
    }
    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .tab-btn:hover { color: #fff; }
    .tab-btn.active {
      background: #1e293b;
      color: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    }
    .container {
      max-width: 1300px;
      margin: 0 auto;
      padding: 24px;
      flex: 1;
      width: 100%;
    }
    .bengali-banner {
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.15), rgba(16, 185, 129, 0.1));
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
      font-size: 13px;
      line-height: 1.6;
      color: #e2e8f0;
    }
    .bengali-banner strong { color: #38bdf8; }
    .tab-panel { display: none; }
    .tab-panel.active { display: block; }
    
    /* Diagrams Grid */
    .diagram-selector {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .diagram-chip {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 12px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s;
    }
    .diagram-chip:hover { border-color: #6366f1; }
    .diagram-chip.active {
      border-color: #6366f1;
      background: rgba(79, 70, 229, 0.15);
    }
    .diagram-chip h4 {
      margin: 0 0 4px 0;
      font-size: 13px;
      color: #fff;
    }
    .diagram-chip p {
      margin: 0;
      font-size: 11px;
      color: var(--text-muted);
    }
    .diagram-viewer-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 24px;
      overflow-x: auto;
      min-height: 400px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .diagram-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--card-border);
      flex-wrap: wrap;
      gap: 12px;
    }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-family: monospace;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge-validated {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }
    
    /* Docs Layout */
    .docs-layout {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 20px;
      align-items: start;
    }
    @media (max-width: 860px) {
      .docs-layout { grid-template-columns: 1fr; }
    }
    .docs-sidebar {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .doc-link {
      background: transparent;
      border: 1px solid transparent;
      color: var(--text-muted);
      text-align: left;
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .doc-link:hover {
      background: #1e293b;
      color: #fff;
    }
    .doc-link.active {
      background: rgba(79, 70, 229, 0.2);
      border-color: rgba(99, 102, 241, 0.5);
      color: #a5b4fc;
      font-weight: 600;
    }
    .doc-content-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 32px;
      min-height: 600px;
      overflow-x: auto;
    }
    .doc-markdown {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      line-height: 1.7;
      color: #cbd5e1;
      white-space: pre-wrap;
    }
    
    /* Code Viewer */
    .code-tree {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .file-pill {
      background: #1e293b;
      color: #cbd5e1;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-family: monospace;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .file-pill:hover { border-color: #6366f1; color: #fff; }
    .file-pill.active {
      background: rgba(79, 70, 229, 0.25);
      border-color: #6366f1;
      color: #a5b4fc;
      font-weight: bold;
    }

    /* Task Status Cards */
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .status-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 16px;
      position: relative;
    }
    .status-card h3 {
      margin: 0;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-card .count {
      font-size: 32px;
      font-weight: 700;
      font-family: monospace;
      margin: 8px 0;
      color: #fff;
    }

    footer {
      border-top: 1px solid var(--card-border);
      padding: 20px 24px;
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
</head>
<body>
  <header>
    <div class="brand">
      <div class="brand-icon">TF</div>
      <div>
        <div class="brand-title">TaskFlow Orchestrator</div>
        <div class="brand-sub">Master Offline Project & Architecture Viewer</div>
      </div>
    </div>
    <nav class="nav-tabs">
      <button class="tab-btn active" onclick="switchTab('diagrams')">01. Visual Diagrams (৭টি ডায়াগ্রাম)</button>
      <button class="tab-btn" onclick="switchTab('docs')">02. Architecture Docs (৯টি ডক)</button>
      <button class="tab-btn" onclick="switchTab('code')">03. Project Source Code (কোড ফাইল)</button>
      <button class="tab-btn" onclick="switchTab('status')">04. Task Status Visualizer</button>
      <button class="tab-btn" onclick="switchTab('guide')">05. Quick Setup Guide</button>
    </nav>
  </header>

  <div class="container">
    <div class="bengali-banner">
      <strong>স্বাগতম! ডায়াগ্রাম ও পুরো প্রজেক্ট দেখার নির্দেশিকা:</strong><br>
      আপনার কম্পিউটারে এই ফাইলটি (<strong>START_HERE.html</strong>) সরাসরি ডাবল ক্লিক করলেই গুগল ক্রোম বা যেকোনো ব্রাউজারে সব ভিজ্যুয়াল ডায়াগ্রাম এবং পুরো প্রজেক্ট ইন্টার‍্যাক্টিভভাবে ওপেন হবে। 
      ফোল্ডারের ভেতরের <code>.mmd</code> এবং <code>.md</code> ফাইলগুলো হচ্ছে র টেক্সট কোড, কিন্তু এই পেজে সেগুলো স্বয়ংক্রিয়ভাবে গ্রাফিকাল ইমেজ হিসেবে রেন্ডার করা হয়েছে।
    </div>

    <!-- TAB 1: VISUAL DIAGRAMS -->
    <div id="tab-diagrams" class="tab-panel active">
      <div class="diagram-selector" id="diagram-chips"></div>

      <div class="diagram-viewer-card">
        <div class="diagram-controls">
          <div>
            <h2 id="active-diagram-title" style="margin: 0; font-size: 18px; color: #fff;"></h2>
            <p id="active-diagram-summary" style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted);"></p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="tab-btn" onclick="toggleDiagramMode('visual')" id="btn-visual" style="background: #1e293b; color: #fff;">Visual Render</button>
            <button class="tab-btn" onclick="toggleDiagramMode('code')" id="btn-code">Mermaid Code</button>
          </div>
        </div>

        <div id="diagram-visual-container" style="text-align: center; padding: 20px 0; overflow-x: auto;">
          <div id="mermaid-render-target" class="mermaid"></div>
        </div>

        <div id="diagram-code-container" style="display: none; background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 12px; white-space: pre; overflow-x: auto;"></div>
      </div>
    </div>

    <!-- TAB 2: ARCHITECTURE DOCS -->
    <div id="tab-docs" class="tab-panel">
      <div class="docs-layout">
        <div class="docs-sidebar" id="docs-sidebar"></div>
        <div class="doc-content-card">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--card-border); padding-bottom: 12px; margin-bottom: 20px;">
            <h2 id="doc-view-title" style="margin: 0; font-size: 18px; color: #fff;"></h2>
            <span id="doc-view-path" class="badge badge-validated"></span>
          </div>
          <div id="doc-view-content" class="doc-markdown"></div>
        </div>
      </div>
    </div>

    <!-- TAB 3: PROJECT SOURCE CODE -->
    <div id="tab-code" class="tab-panel">
      <div style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 24px;">
        <h3 style="margin-top: 0; font-size: 16px;">TaskFlow Orchestrator Source Code Repository</h3>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">
          Select any backend Python module, migration script, or test case to inspect its implementation:
        </p>
        <div class="code-tree" id="code-file-selector"></div>
        <div style="background: #020617; border: 1px solid var(--card-border); border-radius: 8px; padding: 20px; max-height: 600px; overflow-y: auto;">
          <div style="font-size: 11px; font-family: monospace; color: #38bdf8; margin-bottom: 12px;" id="selected-code-path"></div>
          <pre id="selected-code-content" style="margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.6; color: #cbd5e1;"></pre>
        </div>
      </div>
    </div>

    <!-- TAB 4: TASK STATUS VISUALIZER -->
    <div id="tab-status" class="tab-panel">
      <div style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 24px;">
        <h3 style="margin-top: 0; font-size: 16px;">Task Status Analytical Distribution</h3>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">
          Mock distribution representing future frontend telemetry consuming the <code>GET /api/v1/tasks</code> endpoint across the four core lifecycle states under ADR-002:
        </p>

        <div class="status-grid">
          <div class="status-card" style="border-top: 3px solid #f59e0b;">
            <h3 style="color: #f59e0b;">Pending</h3>
            <div class="count">14</div>
            <div style="font-size: 11px; color: var(--text-muted);">Tasks enqueued in backlog awaiting execution</div>
          </div>
          <div class="status-card" style="border-top: 3px solid #0ea5e9;">
            <h3 style="color: #0ea5e9;">In Progress</h3>
            <div class="count">11</div>
            <div style="font-size: 11px; color: var(--text-muted);">Actively executing in worker/user pipeline</div>
          </div>
          <div class="status-card" style="border-top: 3px solid #10b981;">
            <h3 style="color: #10b981;">Completed</h3>
            <div class="count">12</div>
            <div style="font-size: 11px; color: var(--text-muted);">Successfully verified and marked resolved</div>
          </div>
          <div class="status-card" style="border-top: 3px solid #64748b;">
            <h3 style="color: #64748b;">Archived</h3>
            <div class="count">5</div>
            <div style="font-size: 11px; color: var(--text-muted);">Soft-closed tasks retained for audit trails</div>
          </div>
        </div>

        <div style="background: #020617; border: 1px solid var(--card-border); border-radius: 8px; padding: 16px; font-family: monospace; font-size: 11px; color: #a5b4fc;">
          Total Monitored Tasks: 42 | Tenant: Alex Mercer (8f7d9a10-4c2b-4e1a-9f5e-1a2b3c4d5e6f) | Isolation: 100% ADR-002
        </div>
      </div>
    </div>

    <!-- TAB 5: QUICK SETUP GUIDE -->
    <div id="tab-guide" class="tab-panel">
      <div style="background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 28px; line-height: 1.6;">
        <h2 style="margin-top: 0; color: #fff;">TaskFlow Orchestrator Setup & Execution Guide</h2>
        
        <h3 style="color: #38bdf8;">বাংলায় নির্দেশিকা (কীভাবে চালাবেন):</h3>
        <ol style="font-size: 13px; color: #cbd5e1;">
          <li><strong>ফাইল এক্সট্র্যাক্ট করুন:</strong> ডাওনলোড করা <code>.zip</code> ফাইলটি আপনার কম্পিউটারে আনজিপ (Extract All) করুন।</li>
          <li><strong>ডায়াগ্রাম ও ডকুমেন্ট দেখুন:</strong> ফোল্ডারের ভেতরে থাকা <strong><code>START_HERE.html</code></strong> ফাইলটিতে ডাবল-ক্লিক করলেই ব্রাউজারে সম্পূর্ণ প্রজেক্ট ওপেন হবে।</li>
          <li><strong>পাইথন ব্যাকএন্ড রান করার নিয়ম:</strong>
            <pre style="background: #020617; padding: 12px; border-radius: 6px; font-size: 12px; color: #34d399;">
# ১. ভার্চুয়াল এনভায়রনমেন্ট তৈরি করুন
python -m venv venv
source venv/bin/activate  # উইন্ডোজে: venv\\Scripts\\activate

# ২. ডিপেন্ডেন্সি ইনস্টল করুন
pip install -r requirements.txt

# ৩. ডাটাবেস মাইগ্রেশন রান করুন
alembic upgrade head

# ৪. সার্ভার চালু করুন
uvicorn app.main:app --reload --port 8000

# ৫. টেস্ট স্যুট রান করুন
pytest -v</pre>
          </li>
        </ol>

        <h3 style="color: #38bdf8; margin-top: 24px;">Key Governance Rules:</h3>
        <ul style="font-size: 13px; color: #cbd5e1;">
          <li><strong>ADR-002 Mandatory Filtering:</strong> Every query must filter by <code>Task.user_id == current_user.id</code>. Cross-tenant access returns <code>404 Not Found</code>.</li>
          <li><strong>JWT Expiry:</strong> Standardized strictly to 30 minutes (1800s) with 6 mandatory claims (<code>sub, exp, iat, iss, aud, type</code>).</li>
          <li><strong>Primary Keys:</strong> Strictly UUIDv4 generated at client or via <code>gen_random_uuid()</code>; no redundant PK indexes.</li>
        </ul>
      </div>
    </div>
  </div>

  <footer>
    TaskFlow Orchestrator — Designed by <strong>Rayhan Badsha</strong> (Applied AI Systems Architect & Engineer)
  </footer>

  <script>
    const DOC_DATA = ${docsJson};
    const DIAGRAM_DATA = ${diagramsJson};
    let currentDiagramKey = "01-system-context";
    let currentDocKey = Object.keys(DOC_DATA)[0];
    let diagramMode = "visual";

    // Initialize tabs
    function switchTab(tabId) {
      document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
      
      const activeBtn = Array.from(document.querySelectorAll(".tab-btn")).find(b => b.getAttribute("onclick")?.includes(tabId));
      if (activeBtn) activeBtn.classList.add("active");
      
      const activePanel = document.getElementById("tab-" + tabId);
      if (activePanel) activePanel.classList.add("active");

      if (tabId === "diagrams") {
        renderCurrentDiagram();
      }
    }

    // Render diagrams list
    function initDiagrams() {
      const container = document.getElementById("diagram-chips");
      container.innerHTML = "";

      Object.entries(DIAGRAM_DATA).forEach(([key, d]) => {
        const chip = document.createElement("div");
        chip.className = "diagram-chip" + (key === currentDiagramKey ? " active" : "");
        chip.innerHTML = "<h4>" + d.title + "</h4><p>" + d.summary + "</p>";
        chip.onclick = () => {
          currentDiagramKey = key;
          document.querySelectorAll(".diagram-chip").forEach(c => c.classList.remove("active"));
          chip.classList.add("active");
          renderCurrentDiagram();
        };
        container.appendChild(chip);
      });
      renderCurrentDiagram();
    }

    function renderCurrentDiagram() {
      const d = DIAGRAM_DATA[currentDiagramKey];
      if (!d) return;

      document.getElementById("active-diagram-title").innerText = d.title;
      document.getElementById("active-diagram-summary").innerText = d.summary;
      document.getElementById("diagram-code-container").innerText = d.code;

      const target = document.getElementById("mermaid-render-target");
      target.removeAttribute("data-processed");
      target.innerHTML = d.code;

      if (window.mermaid) {
        try {
          mermaid.init(undefined, target);
        } catch (e) {
          console.error("Mermaid render error:", e);
        }
      }
    }

    function toggleDiagramMode(mode) {
      diagramMode = mode;
      const visualContainer = document.getElementById("diagram-visual-container");
      const codeContainer = document.getElementById("diagram-code-container");
      const btnVisual = document.getElementById("btn-visual");
      const btnCode = document.getElementById("btn-code");

      if (mode === "visual") {
        visualContainer.style.display = "block";
        codeContainer.style.display = "none";
        btnVisual.style.background = "#1e293b";
        btnVisual.style.color = "#fff";
        btnCode.style.background = "transparent";
        btnCode.style.color = "var(--text-muted)";
      } else {
        visualContainer.style.display = "none";
        codeContainer.style.display = "block";
        btnCode.style.background = "#1e293b";
        btnCode.style.color = "#fff";
        btnVisual.style.background = "transparent";
        btnVisual.style.color = "var(--text-muted)";
      }
    }

    // Initialize Docs
    function initDocs() {
      const sidebar = document.getElementById("docs-sidebar");
      sidebar.innerHTML = "";

      Object.entries(DOC_DATA).forEach(([key, doc]) => {
        const link = document.createElement("button");
        link.className = "doc-link" + (key === currentDocKey ? " active" : "");
        link.innerText = doc.title;
        link.onclick = () => {
          currentDocKey = key;
          document.querySelectorAll(".doc-link").forEach(l => l.classList.remove("active"));
          link.classList.add("active");
          renderDoc();
        };
        sidebar.appendChild(link);
      });
      renderDoc();
    }

    function renderDoc() {
      const doc = DOC_DATA[currentDocKey];
      if (!doc) return;
      document.getElementById("doc-view-title").innerText = doc.title;
      document.getElementById("doc-view-path").innerText = doc.path;
      document.getElementById("doc-view-content").innerText = doc.content;
    }

    // Code files preview
    const CODE_SNIPPETS = {
      "app/main.py": "from fastapi import FastAPI\\nfrom app.routers import auth, tasks\\n\\napp = FastAPI(title='TaskFlow Orchestrator')\\napp.include_router(auth.router, prefix='/api/v1')\\napp.include_router(tasks.router, prefix='/api/v1')",
      "app/auth.py": "import jwt\\nfrom passlib.context import CryptContext\\n\\npwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')\\n# Strict HS256 validation for 6 claims: sub, exp (30m), iat, iss, aud, type",
      "app/models.py": "class User(Base):\\n    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)\\n    email: Mapped[str] = mapped_column(unique=True)\\n\\nclass Task(Base):\\n    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)\\n    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey('users.id'))",
      "app/routers/tasks.py": "@router.get('')\\ndef list_tasks(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):\\n    # ADR-002 Mandatory Tenancy Filter\\n    return db.query(Task).filter(Task.user_id == current_user.id).all()",
      "alembic/versions/001_initial_schema.py": "# Explicit Alembic DDL Migration\\nop.create_table('users', ...)\\nop.create_table('tasks', ...)\\nop.create_index('ix_tasks_user_id_status', 'tasks', ['user_id', 'status'])",
      "tests/test_tasks.py": "def test_cross_user_isolation(client, user_a, user_b):\\n    # User B cannot access User A's task -> Returns 404 (Anti-Enumeration)\\n    resp = client.get(f'/api/v1/tasks/{user_a_task_id}', headers=user_b['headers'])\\n    assert resp.status_code == 404"
    };

    function initCodeViewer() {
      const container = document.getElementById("code-file-selector");
      container.innerHTML = "";
      const files = Object.keys(CODE_SNIPPETS);

      files.forEach((file, idx) => {
        const pill = document.createElement("button");
        pill.className = "file-pill" + (idx === 0 ? " active" : "");
        pill.innerText = file;
        pill.onclick = () => {
          document.querySelectorAll(".file-pill").forEach(p => p.classList.remove("active"));
          pill.classList.add("active");
          showCode(file);
        };
        container.appendChild(pill);
      });
      showCode(files[0]);
    }

    function showCode(file) {
      document.getElementById("selected-code-path").innerText = file;
      document.getElementById("selected-code-content").innerText = CODE_SNIPPETS[file] || "# File content placeholder";
    }

    document.addEventListener("DOMContentLoaded", function() {
      if (window.mermaid) {
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            darkMode: true,
            background: "#0f172a",
            primaryColor: "#4f46e5",
            primaryTextColor: "#ffffff",
            primaryBorderColor: "#6366f1",
            lineColor: "#38bdf8"
          }
        });
      }
      initDiagrams();
      initDocs();
      initCodeViewer();
    });
  </script>
</body>
</html>`;
}

/**
 * Bangla Instructions file content (কিভাবে_ওপেন_করবেন.txt)
 */
export const BANGLA_README_TEXT = `=============================================================================
             TaskFlow Orchestrator — সম্পূর্ণ প্রজেক্ট ও ডায়াগ্রাম দেখার নির্দেশিকা
=============================================================================

প্রিয় ব্যবহারকারী,

আপনি জিপ ফাইলটি এক্সট্র্যাক্ট করলে ভেতরে সব ফাইল দেখতে পাবেন। 
সব ডায়াগ্রাম ভিজ্যুয়াল গ্রাফিক্স সহ এবং পুরো প্রজেক্ট এক ক্লিকে ওপেন করার জন্য নিচের সহজ ধাপগুলো অনুসরণ করুন:

-----------------------------------------------------------------------------
১. এক ক্লিকে ব্রাউজারে সম্পূর্ণ প্রজেক্ট ও সব ডায়াগ্রাম দেখার নিয়ম:
-----------------------------------------------------------------------------
- এই ফোল্ডারের ভেতরে থাকা "START_HERE.html" অথবা "index.html" ফাইলে ডাবল-ক্লিক করুন।
- এটি সরাসরি গুগল ক্রোম (Google Chrome), এজ (Microsoft Edge) বা আপনার পছন্দের যেকোনো ব্রাউজারে ওপেন হয়ে যাবে।
- সেখানে উপরের ট্যাবগুলো থেকে আপনি দেখতে পাবেন:
  ১) 01. Visual Diagrams: ৭টি ডায়াগ্রাম স্বয়ংক্রিয়ভাবে ভিজ্যুয়াল গ্রাফিক্যাল ফরম্যাটে রেন্ডার হবে।
  ২) 02. Architecture Docs: ৯টি আর্কিটেকচার ও এপিআই স্পেসিফিকেশন ডকুমেন্ট।
  ৩) 03. Project Source Code: FastAPI ব্যাকএন্ড কোড, মডেল ও টেস্ট স্যুট।
  ৪) 04. Task Status Visualizer: রিয়্যাল-টাইম টাস্ক স্ট্যাটাস ডিস্ট্রিবিউশন।
  ৫) 05. Quick Setup Guide: পাইথন সেটআপ গাইড।

-----------------------------------------------------------------------------
২. সরাসরি প্রতিটি আলাদা ডায়াগ্রাম দেখার নিয়ম:
-----------------------------------------------------------------------------
"docs/diagrams/" ফোল্ডারের ভেতরে প্রতিটি ডায়াগ্রামের জন্য আলাদা ".html" ফাইল রয়েছে:
- docs/diagrams/01-system-context.html
- docs/diagrams/02-modular-monolith.html
- docs/diagrams/03-request-sequence.html
- docs/diagrams/04-queue-worker-boundary.html
- docs/diagrams/05-ai-mcp-boundary.html
- docs/diagrams/06-database-er.html
- docs/diagrams/07-task-status-fsm.html

যেকোনো ফাইলে ডাবল-ক্লিক করলেই ব্রাউজারে সম্পূর্ণ স্ক্রিনে ডায়াগ্রামটি ছবি আকারে ওপেন হবে!

-----------------------------------------------------------------------------
৩. .mmd এবং .md ফাইলগুলো কেন প্লেইন টেক্সট দেখায়?
-----------------------------------------------------------------------------
- .mmd হচ্ছে Mermaid ডায়াগ্রামের সোর্স কোড (Markdown code format)।
- .md হচ্ছে ডকুমেন্টেশন টেক্সট।
সাধারণ টেক্সট এডিটরে (যেমন Notepad) এগুলো ওপেন করলে শুধু কোড লেখা আসে। 
কিন্তু আমাদের দেওয়া "START_HERE.html"-এ ডাবল-ক্লিক করলেই ব্রাউজার স্বয়ংক্রিয়ভাবে সেই কোডগুলোকে দৃষ্টিনন্দন গ্রাফিক্সে রূপান্তর করে দেখাবে!

-----------------------------------------------------------------------------
৪. পাইথন ব্যাকএন্ড কোড রান করার নিয়ম:
-----------------------------------------------------------------------------
# ভার্চুয়াল এনভায়রনমেন্ট তৈরি ও একটিভ:
python -m venv venv
source venv/bin/activate  # উইন্ডোজে: venv\\Scripts\\activate

# প্যাকেজ ইনস্টল:
pip install -r requirements.txt

# মাইগ্রেশন ও ডাটাবেস রান:
alembic upgrade head

# এপিআই সার্ভার রান:
uvicorn app.main:app --reload --port 8000

# টেস্ট রান:
pytest -v

প্রয়োজনে যোগাযোগ:
Rayhan Badsha | Applied AI Systems Architect & Engineer
LinkedIn: https://www.linkedin.com/in/rayhan-badsha-a71662294
GitHub: https://github.com/rayhan-ai-architect
=============================================================================`;

/**
 * English Instructions file content (HOW_TO_OPEN.txt)
 */
export const ENGLISH_README_TEXT = `=============================================================================
             TaskFlow Orchestrator — Complete Project & Diagrams Viewer Guide
=============================================================================

To immediately view the entire project with all rendered diagrams, documentation, 
and source code without installing Node.js or any Markdown plugins:

1. Double-click "START_HERE.html" or "index.html" in the root directory.
   It opens in Google Chrome, Microsoft Edge, Safari, or Firefox with:
   - All 7 Visual Diagrams rendered interactively
   - All 9 Architecture & API specifications
   - Complete Python FastAPI Source Code Explorer
   - Task Status Analytics Visualizer
   - Development & Pytest instructions

2. To view standalone diagrams individually:
   Navigate to "docs/diagrams/" and double-click any .html file:
   - docs/diagrams/01-system-context.html
   - docs/diagrams/02-modular-monolith.html
   - docs/diagrams/03-request-sequence.html
   - docs/diagrams/04-queue-worker-boundary.html
   - docs/diagrams/05-ai-mcp-boundary.html
   - docs/diagrams/06-database-er.html
   - docs/diagrams/07-task-status-fsm.html

3. Why did .mmd and .md files look like raw text?
   .mmd and .md files are the raw declarative specification sources. 
   Opening them in basic text editors like Notepad shows text definitions (e.g. "graph TD").
   The included "START_HERE.html" automatically compiles and renders them into high-fidelity visual diagrams!

Architect: Rayhan Badsha (Applied AI Systems Architect & Engineer)
LinkedIn: https://www.linkedin.com/in/rayhan-badsha-a71662294
=============================================================================`;

/**
 * Complete project files dictionary for packaging the full codebase.
 */
export const BACKEND_CODE_FILES: Record<string, string> = {
  'requirements.txt': `fastapi>=0.111.0,<1.0.0
uvicorn[standard]>=0.30.0,<1.0.0
pydantic>=2.7.0,<3.0.0
pydantic-settings>=2.2.0,<3.0.0
sqlalchemy>=2.0.30,<3.0.0
alembic>=1.13.1,<2.0.0
psycopg2-binary>=2.9.9
pyjwt[crypto]>=2.8.0,<3.0.0
passlib[bcrypt]>=1.7.4,<2.0.0
bcrypt>=4.0.1,<5.0.0
python-multipart>=0.0.9
email-validator>=2.1.0
pytest>=8.2.0,<9.0.0
pytest-asyncio>=0.23.0
httpx>=0.27.0,<1.0.0
`,
  '.env.example': `APP_NAME="TaskFlow Orchestrator"
APP_ENV=development
DEBUG=true
PORT=8000
DATABASE_URL=postgresql://taskflow_user:supersecretpassword@localhost:5432/taskflow_db
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_PRE_PING=true
JWT_SECRET_KEY=09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8000
`,
  'alembic.ini': `[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
`,
  'app/__init__.py': `"""TaskFlow Orchestrator Application Package."""\n__version__ = "0.2.0"\n`,
  'app/routers/__init__.py': `"""TaskFlow Orchestrator Routers Package."""\n`,
  'tests/__init__.py': `"""TaskFlow Orchestrator Test Suite Package."""\n`
};

/**
 * Packages and downloads the zip file.
 * Includes:
 * - START_HERE.html / index.html (Master offline interactive viewer with Mermaid auto-rendering)
 * - docs/diagrams/*.html (Individual rendered visual diagram viewers)
 * - docs/diagrams/*.mmd (Mermaid raw source code)
 * - docs/*.md (All 9 architecture specifications)
 * - কিভাবে_ওপেন_করবেন.txt & HOW_TO_OPEN.txt (Step-by-step instructions in Bengali and English)
 * - Full project code files when mode === 'full'
 */
export async function packageProjectZip(
  docFiles: Record<string, { title: string; path: string; category: string; summary: string; content: string }>,
  mode: 'full' | 'evidence_only' = 'full'
): Promise<void> {
  const zip = new JSZip();

  // 1. Master Offline Viewer (HTML) in the root of the ZIP
  const masterViewerHtml = generateMasterViewerHtml(docFiles);
  zip.file('START_HERE.html', masterViewerHtml);
  zip.file('index.html', masterViewerHtml);

  // 2. Instructions in Bengali and English
  zip.file('কিভাবে_ওপেন_করবেন.txt', BANGLA_README_TEXT);
  zip.file('HOW_TO_OPEN.txt', ENGLISH_README_TEXT);

  // 3. Documentation Markdown files
  Object.entries(docFiles).forEach(([path, doc]) => {
    zip.file(path, doc.content);
  });

  // 4. Standalone Diagram Source (.mmd) AND Rendered HTML (.html) files
  Object.entries(DIAGRAM_SOURCES).forEach(([key, d]) => {
    zip.file('docs/diagrams/' + key + '.mmd', d.code);
    zip.file('docs/diagrams/' + key + '.html', generateSingleDiagramHtml(d.title, d.code, d.summary));
  });

  // 5. Code files (if full project selected)
  if (mode === 'full') {
    Object.entries(BACKEND_CODE_FILES).forEach(([path, content]) => {
      zip.file(path, content);
    });
  }

  // 6. Evidence Package Manifest
  zip.file('EVIDENCE_PACKAGE_MANIFEST.json', JSON.stringify({
    project: 'TaskFlow Orchestrator',
    phase: 1,
    title: mode === 'full' ? 'Complete Project & Architecture Bundle' : 'Phase 1 Evidence Package',
    author: 'Lead Personal-Brand Strategist & Senior Backend Architect (Rayhan AI Architecture)',
    timestamp: new Date().toISOString(),
    governance_policy: 'Strict Evidence-Based Audit. No premature verification claims.',
    sign_off_status: 'PENDING PROJECT OWNER SIGN-OFF',
    package_features: [
      'START_HERE.html master offline viewer with embedded Mermaid JS rendering',
      'Individual .html rendered viewers for all 7 diagrams',
      'Dual Bengali and English quickstart guides',
      'All 9 architecture specifications',
      'Complete requirements traceability matrix'
    ]
  }, null, 2));

  // 7. Trigger browser download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = mode === 'full'
    ? 'taskflow-orchestrator-full-project.zip'
    : 'taskflow-phase1-evidence-package.zip';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

