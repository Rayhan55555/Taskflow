# ADR-002: Backend Privileged Connection with Application-Level Authorization (No Supabase RLS)

**Status**: Approved  
**Date**: 2026-10-31  
**Authors**: Senior Backend Architect (Rayhan AI Architecture)  
**Stakeholders**: Security Engineering, Backend Architecture

---

## 1. Context & Problem Statement

TaskFlow Orchestrator is a multi-tenant platform where user data must be strictly isolated. A critical architectural choice is whether to enforce multi-tenant authorization at the **Database Row-Level Security (RLS)** layer (e.g., Supabase Postgres RLS policies) or at the **Application / Service Layer** via a backend privileged connection pool.

The system requires:
1. High-throughput connection pooling without session state thrashing.
2. Complete portability across any cloud-managed PostgreSQL provider (AWS RDS, GCP Cloud SQL, Azure, self-hosted Docker, Neon).
3. Fast, deterministic automated testing without requiring a live, external Postgres container with custom RLS extensions in every test run.
4. Prevention of tenant data leakage and ID enumeration attacks.

---

## 2. Decision

We approve and mandate **ADR-002: Backend Privileged Connection with Application-Level Authorization**.  
We explicitly **reject Supabase / Database-Level Row-Level Security (RLS)**.

### Architectural Rules:
1. **Privileged Backend Connection Pool**:
   - The application connects to PostgreSQL using a single privileged database user role (`taskflow_user`) managed by an SQLAlchemy 2.x connection pool (`pool_size=10, max_overflow=20, pool_pre_ping=True`).
2. **Mandatory Application-Level `user_id` Filtering**:
   - Every database query (SELECT, INSERT, UPDATE, DELETE) against user-owned resources MUST explicitly include `user_id == current_user.id`.
   - Creating tasks binds `user_id = current_user.id` automatically from the verified JWT identity context (`sub` claim).
3. **Anti-Enumeration 404 Status Code**:
   - Cross-user access attempts (e.g., User B attempting to read, update, or delete User A's task by UUID) MUST return **HTTP 404 Not Found** (rather than 403 Forbidden).
   - This prevents attackers from enumerating valid task UUIDs across tenants.
4. **Explicit Migration Ownership**:
   - All DDL operations execute via version-controlled **Alembic** migrations. Runtime `Base.metadata.create_all()` is strictly forbidden in production.

---

## 3. Detailed Comparison & Rationale

| Dimension | ADR-002: Application-Level Authorization | Supabase / Database-Level RLS |
| :--- | :--- | :--- |
| **Connection Pooling** | **Highly Efficient**: Connections are recycled across requests without transaction-level state manipulation. | **Poor Scalability**: Requires issuing `SET LOCAL role` or `SET request.jwt.claim` on every transaction, causing session variable pollution in connection pool proxies (PgBouncer). |
| **Cloud Portability** | **100% Portability**: Runs identically on any standard PostgreSQL instance without proprietary extensions. | **Vendor Lock-In**: Coupled to Supabase auth schemas, PostgreSQL procedural functions, and proprietary JWT parsing extensions. |
| **Testability & Speed** | **High Velocity**: Business rules can be thoroughly tested against high-speed in-memory SQLite sessions in sub-second test runs. | **Slow / Fragile**: In-memory SQLite cannot execute PostgreSQL RLS policies; tests require provisioning live Postgres Docker containers in CI. |
| **Observability** | **Explicit in Code**: Authorization constraints are directly visible in Python code and traceable via APM query logs. | **Opaque in SQL**: Authorization policies reside inside database migrations and system catalogs; debugging silent empty query returns is notoriously difficult. |
| **Defense-in-Depth** | **Gateway Protection**: Identity tokens are cryptographically verified and validated for revocation before any database thread is allocated. | Database must parse and decode JWT claims on every query, increasing CPU overhead inside the database cluster. |

---

## 4. Risks and Mitigations

### 4.1 Risk: Developer Omits `user_id` Filter in a Future Query
- **Threat**: A developer writes `select(Task).where(Task.id == task_id)` without checking `Task.user_id == current_user.id`, inadvertently exposing cross-tenant data.
- **Architectural Mitigations**:
  1. **Automated Cross-Tenant Pytest Suite**: Mandatory integration tests asserting that User B receives `404 Not Found` when requesting User A's resources across every endpoint (`SEC-ISO-01` through `SEC-ISO-04`).
  2. **Repository Abstraction Pattern**: Encapsulate queries inside scoped repository methods that require `user_id` as a non-optional parameter.
  3. **Automated CI/CD Lint Checks**: AST-based static analysis flagging unscoped queries against tenant-bound models.

### 4.2 Risk: Backend Credential Compromise
- **Threat**: If the backend database credentials (`DATABASE_URL`) are leaked, the attacker gains access to all tenant records because connections run with privileged rights.
- **Architectural Mitigations**:
  1. Database credentials are injected via runtime environment variables and secrets managers (never committed to version control).
  2. Network security: The PostgreSQL port (5432) is bound to an isolated private VPC subnet with zero ingress from the public internet. Only the application container IP can establish TCP connections.
