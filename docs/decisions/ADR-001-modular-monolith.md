# ADR-001: Modular Monolith Architecture Pattern

**Status**: Approved  
**Date**: 2026-10-31  
**Authors**: Senior Backend Architect (Rayhan AI Architecture)  
**Stakeholders**: Engineering Team, System Architects

---

## 1. Context & Problem Statement

TaskFlow Orchestrator requires an architectural foundation that supports rapid feature delivery, strict ACID transactional boundaries, low operational complexity, and seamless multi-tenant isolation. 

The system must also support future evolutionary phases:
- **Phase 3**: Integration of asynchronous worker queues and background job dispatch.
- **Phase 4**: Autonomous AI planning agents executing through tool-calling interfaces (MCP).

A premature decomposition into microservices introduces distributed transaction hazards, network latency, deployment overhead, service-mesh complexity, and high cognitive load for small-to-medium engineering teams. Conversely, an unstructured "spaghetti" monolith degrades into tightly coupled code that cannot be scaled or modularized later.

---

## 2. Decision

We will structure TaskFlow Orchestrator as a **Modular Monolith** using **Python 3.11+ and FastAPI**.

The codebase will be strictly organized into domain-oriented packages with defined boundaries:
1. `app/auth`: Credential validation, token issuance, and cryptographic hashing.
2. `app/routers`: Explicit HTTP endpoint routing with input validation schemas.
3. `app/models`: Declarative persistence schemas and entity relationships.
4. `app/database`: Connection pooling, engine configuration, and transaction lifecycle.
5. `app/config`: Centralized, typed environment settings via Pydantic v2.

### Internal Communication Rules
- In-process module interactions must occur via typed interfaces or dependency injection.
- Direct raw cross-table mutations without going through domain constraints are prohibited.
- Shared persistence is mediated via standard SQLAlchemy 2.x sessions within a single transactional boundary per HTTP request.

---

## 3. Alternatives Considered

### Alternative A: Microservices from Day 1
- **Description**: Separate Auth Service, Task Service, and Notification Service into distinct network-accessible repositories and deployable containers.
- **Why Rejected**: Microservices require distributed transaction coordination (Saga pattern or 2PC), independent CI/CD pipelines, API gateway routing, and container orchestration (Kubernetes). At this stage, distributed microservices would drastically reduce engineering velocity without providing performance or organizational benefits.

### Alternative B: Traditional Layered (N-Tier) Monolith
- **Description**: Traditional horizontal layering (`controllers/`, `services/`, `models/`, `views/`).
- **Why Rejected**: Lacks vertical domain boundaries. Inevitably results in circular dependencies between services and prevents isolated testing or future extraction of specific bounded contexts (such as extracting the Task execution engine into a worker process in Phase 3).

### Alternative C: Serverless Functions (AWS Lambda / Cloud Functions)
- **Description**: Expose each route as an individual serverless function.
- **Why Rejected**: Introduces cold-start latency, connection pooling bottlenecks with relational databases (exhausting PostgreSQL connection limits without external proxy layers like AWS RDS Proxy), and complicated local test setups.

---

## 4. Consequences

### Positive Consequences
- **Unified Deployment**: A single deployable artifact (Docker container) that can be run on any cloud platform or container runner.
- **Transactional Integrity**: Atomic database transactions spanning user updates and task operations without distributed lock overhead.
- **High Developer Velocity**: Single codebase with instant local execution and rapid in-memory Pytest test runs.
- **Future-Proof Extraction**: Domain modules (e.g., Task execution engine) are already isolated behind clean interfaces, making future extraction into worker processes in Phase 3 straightforward.

### Negative Consequences & Mitigations
- **Shared Memory Space**: A memory leak or unhandled exception in one module could theoretically impact the entire process.
  - *Mitigation*: Comprehensive automated test suites, request timeouts, and process-level health checks.
- **Discipline Required**: Developers may be tempted to bypass domain boundaries.
  - *Mitigation*: Static code analysis, strict module import hierarchies, and peer code reviews.
