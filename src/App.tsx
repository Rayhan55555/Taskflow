import React, { useState } from 'react';
import JSZip from 'jszip';
import { TaskStatusVisualizer } from './components/TaskStatusVisualizer';
import { packageProjectZip } from './utils/projectArchive';
import {
  ShieldCheck,
  Database,
  Lock,
  Layers,
  FileText,
  Copy,
  Check,
  Download,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Cpu,
  Workflow,
  Server,
  BookOpen,
  Briefcase,
  GitBranch,
  Terminal,
  Activity,
  CheckCircle2,
  FileCode2,
  Search,
  Eye,
  Code2,
  HelpCircle,
  Clock
} from 'lucide-react';

interface DocItem {
  path: string;
  category: string;
  title: string;
  summary: string;
  mermaid?: string;
  content: string;
}

const DOC_FILES: Record<string, DocItem> = {
  'docs/architecture/system-architecture.md': {
    path: 'docs/architecture/system-architecture.md',
    category: 'Architecture',
    title: 'System Architecture Specification',
    summary: 'System context, modular monolith boundaries, request lifecycle, future worker & AI planner demarcation, technology choices.',
    mermaid: `graph TD
    ClientApp["Client Applications (SPA / Web / Mobile / CLI)"]
    API["TaskFlow Orchestrator API (Modular Monolith - FastAPI)"]
    DB[("Relational Database (PostgreSQL 16+)")]
    FutureQueue[("Message Broker & Task Queue (Phase 3 - Redis / Celery)")]
    FutureAI["Autonomous AI Agent Host (Phase 4 - MCP / LLM Planner)"]

    ClientApp -->|"HTTPS / REST / JWT Bearer"| API
    API -->|"Privileged TCP Pool (SQLAlchemy 2.x - Port 5432)"| DB
    API -.->|"Publish Async Job Events (Phase 3 Planned)"| FutureQueue
    FutureQueue -.->|"Consume & Execute Jobs (Phase 3 Planned)"| DB
    FutureAI -.->|"Authenticated Tool Calls (MCP - Tenant Scoped)"| API

    classDef primary fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#ffffff;
    classDef storage fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef planned fill:#1e293b,stroke:#f59e0b,stroke-width:1px,stroke-dasharray: 5 5,color:#cbd5e1;

    class API primary;
    class DB storage;
    class FutureQueue,FutureAI planned;`,
    content: `# System Architecture Specification

**Project**: TaskFlow Orchestrator
**Phase**: 1 — Requirements, Architecture & Design
**Document Status**: Reviewed & Corrected Baseline
**Lead Architect**: Senior Backend Architect (Rayhan AI Architecture)

---

## 1. System Context & Overview
TaskFlow Orchestrator is a multi-tenant task and workflow management platform engineered to deliver deterministic operational task tracking, strict multi-tenant boundary isolation, and forward-compatible extensibility for asynchronous job workers and autonomous AI planning agents.

### Core Architectural Decisions
- Modular Monolith architecture in Python 3.11+ / FastAPI.
- ADR-002: Backend Privileged Connection + Application-Level Authorization (No Supabase RLS).
- Strict JWT authentication with HS256 and mandatory claims: sub, exp (30m baseline), iat, iss, aud, type.
- PostgreSQL 16+ persistence with UUIDv4 primary keys and explicit Alembic migrations.`
  },

  'docs/architecture/database-er-diagram.md': {
    path: 'docs/architecture/database-er-diagram.md',
    category: 'Architecture',
    title: 'Database Entity-Relationship & Schema Specification',
    summary: 'Users and Tasks schema, dual-tier UUID generation, removal of redundant PK indexes, and purpose-justified composite indexes.',
    mermaid: `erDiagram
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
    }`,
    content: `# Database Entity-Relationship & Schema Specification

**Project**: TaskFlow Orchestrator
**Phase**: 1 — Requirements, Architecture & Design
**Document Status**: Reviewed & Corrected Baseline

---

## Key Review Corrections Applied
1. Redundant Primary Key Indexes Removed: Eliminated ix_users_id and ix_tasks_id because PRIMARY KEY declarations in PostgreSQL automatically create unique B-Trees.
2. Index Justifications:
   - ix_users_email (UNIQUE): O(1) login lookup and duplicate registration prevention.
   - ix_tasks_user_id: Foreign key CASCADE checks and join performance.
   - ix_tasks_user_id_status: Scoped multi-tenant status filtering.
   - ix_tasks_user_id_created_at: Scoped paginated timeline sorting.
   - ix_tasks_user_id_title: Scoped tenant title prefix search.
3. Dual-Tier UUID Generation:
   - Application tier: Python uuid.uuid4() client default.
   - Database tier: PostgreSQL server default gen_random_uuid().`
  },

  'docs/api/api-contract.md': {
    path: 'docs/api/api-contract.md',
    category: 'API Specification',
    title: 'API Contract & Endpoint Specification',
    summary: 'REST endpoints, mandatory 6 JWT claims, 30-min expiry baseline, JSON login encoding, and strict PATCH omitted vs null semantics.',
    content: `# API Contract & Endpoint Specification

**Project**: TaskFlow Orchestrator
**Phase**: 1 — Requirements, Architecture & Design
**Base URL**: http://localhost:8000/api/v1
**Authentication**: HTTP Bearer Header (Authorization: Bearer <JWT>)

---

## 1. Strict JWT Claims Contract
- sub: User UUID string.
- exp: Expiration epoch seconds (Strictly 30 minutes / 1800s baseline).
- iat: Issued-at epoch seconds.
- iss: Issuer string ("taskflow-orchestrator").
- aud: Audience string ("taskflow-api").
- type: Classification string ("access").

## 2. PATCH Partial Update Semantics
- Omitted fields: Untouched in database.
- Explicit null on nullable fields (description, due_date): Clears column to NULL.
- Explicit null on non-nullable fields (title, status, priority): Returns 422 Unprocessable Entity.

## 3. Anti-Enumeration Rule
- Cross-tenant requests on tasks owned by other users return HTTP 404 Not Found.`
  },

  'docs/decisions/ADR-001-modular-monolith.md': {
    path: 'docs/decisions/ADR-001-modular-monolith.md',
    category: 'Architecture Decision',
    title: 'ADR-001: Modular Monolith Architecture Pattern',
    summary: 'Adoption of a modular monolith over premature microservices and serverless; clear boundaries for future extraction.',
    content: `# ADR-001: Modular Monolith Architecture Pattern

**Status**: Approved
**Date**: 2026-10-31

## Decision
Adopt a Modular Monolith architecture pattern organized by bounded domain packages (auth, tasks, database, config, routers). In-process modules communicate via typed interfaces and dependency injection.

## Alternatives Rejected
- Microservices from Day 1: Rejected due to distributed transaction overhead, service mesh complexity, and slow developer feedback loops.
- Traditional Layered Monolith: Rejected due to lack of vertical domain cohesion and risk of circular dependencies.`
  },

  'docs/decisions/ADR-002-database-security.md': {
    path: 'docs/decisions/ADR-002-database-security.md',
    category: 'Architecture Decision',
    title: 'ADR-002: Backend Privileged Connection with Application-Level Authorization',
    summary: 'Preserves backend connection pooling; explicitly rejects Supabase RLS; mandates user_id filtering and anti-enumeration 404s.',
    content: `# ADR-002: Backend Privileged Connection with Application-Level Authorization (No Supabase RLS)

**Status**: Approved
**Date**: 2026-10-31

## Core Rules
1. Single privileged database connection pool managed by SQLAlchemy 2.x.
2. Mandatory user_id == current_user.id predicate in every query.
3. Cross-user access returns HTTP 404 Not Found to prevent resource enumeration.
4. Schema evolution controlled exclusively by versioned Alembic migrations.

## Residual Risks & Multi-Layer Mitigations
- Risk: Future developer omits user_id predicate in query.
- Mitigation: Mandatory CI/CD cross-tenant isolation test suite (PLN-ISO-*), base repository encapsulation, and AST static analysis.`
  },

  'docs/security/threat-model.md': {
    path: 'docs/security/threat-model.md',
    category: 'Security',
    title: 'Security Threat Model & Risk Assessment',
    summary: 'STRIDE threat matrix, asset classification, trust boundaries, secret management, sensitive log redaction, and residual risk analysis.',
    content: `# Security Threat Model & Risk Assessment

**Project**: TaskFlow Orchestrator
**Phase**: 1 — Requirements, Architecture & Design
**Methodology**: STRIDE + OWASP Top 10 API Security

---

## Key Mitigations & Security Controls
1. Brute-Force Defense: Bcrypt work factor 12 + sliding-window rate limiting (5 req/min on login).
2. Secret Rotation: Dual-key rotation support (current key + previous key with 30-min grace period).
3. Sensitive Log Redaction: Automatic filter stripping Authorization headers, tokens, and credentials from application logs.
4. Account Enumeration Defense: Uniform error messages ("Incorrect email or password") and 404 anti-enumeration responses on foreign task IDs.`
  },

  'docs/testing/test-plan.md': {
    path: 'docs/testing/test-plan.md',
    category: 'Testing',
    title: 'Test Plan & Verification Strategy',
    summary: 'Dual-environment strategy: fast in-memory SQLite for unit/API tests + PostgreSQL 16+ integration suite for Alembic and native UUIDs.',
    content: `# Test Plan & Verification Strategy

**Project**: TaskFlow Orchestrator
**Phase**: 1 — Requirements, Architecture & Design
**Status**: PLANNED SPECIFICATION (No Tests Executed in Phase 1)

---

## Dual-Environment Testing Model
1. Fast In-Memory SQLite Engine: Used for Unit tests (Tier 1), API contracts (Tier 3), and Cross-tenant isolation (Tier 4) for sub-second developer feedback.
2. Dedicated PostgreSQL 16+ Engine: Used for Alembic migrations (Tier 2), native gen_random_uuid() generation, foreign key CASCADE checks, and TIMESTAMPTZ storage.`
  },

  'docs/phase-reports/phase-01-review.md': {
    path: 'docs/phase-reports/phase-01-review.md',
    category: 'Phase Governance',
    title: 'Phase 1 Review & Architecture Sign-Off Report',
    summary: 'Traceability matrix, open questions, risk register, and phase acceptance checklist with verified evidence criteria.',
    content: `# Phase 1 Review & Architecture Sign-Off Report

**Project**: TaskFlow Orchestrator
**Phase**: 1 — Requirements, Architecture & Design
**Status**: REVIEWED BASELINE — PENDING STAKEHOLDER SIGN-OFF (Pre-Phase 2)

---

## 1. Traceability Matrix Summary
- REQ-01 Modular Monolith -> system-architecture.md -> ADR-001 -> Planned PLN-UT-*
- REQ-02 User Auth -> api-contract.md -> ADR-001 -> Planned PLN-API-01/03
- REQ-03 Bcrypt Hashing -> threat-model.md -> ADR-001 -> Planned PLN-UT-01/02
- REQ-04 Strict JWT (6 claims, HS256, 30m) -> api-contract.md -> ADR-001 -> Planned PLN-UT-03, PLN-API-06/07/08
- REQ-05 Task CRUD -> api-contract.md -> ADR-001 -> Planned PLN-API-01..05
- REQ-06 ADR-002 Isolation -> database-er-diagram.md -> ADR-002 -> Planned PLN-ISO-01..04
- REQ-07 Anti-Enumeration (404) -> api-contract.md -> ADR-002 -> Planned PLN-ISO-01..03
- REQ-08 UUID Primary Keys (No Redundant PK Index) -> database-er-diagram.md -> ADR-002 -> Planned PLN-PG-04
- REQ-09 Alembic Migrations -> database-er-diagram.md -> ADR-002 -> Planned PLN-PG-01..03
- REQ-10 UTC Datetimes -> database-er-diagram.md -> ADR-001 -> Planned PLN-PG-06
- REQ-11 Dual Testing Strategy -> test-plan.md -> ADR-001 -> Full Test Pipeline Execution

## 2. Governance Status
Artifacts REVIEWED. Code implementation and test execution are strictly PENDING Phase 2.`
  },

  'docs/phase-reports/phase-01-audit-report.md': {
    path: 'docs/phase-reports/phase-01-audit-report.md',
    category: 'Phase Governance',
    title: 'Phase 1 Governance Audit & Evidence Package',
    summary: 'Comprehensive evidence compilation: file inventory, validated diagram sources, cross-document matrix, requirement proofs, and three-tier verification boundary.',
    content: `# Phase 1 Governance Audit & Evidence Package

**Project**: TaskFlow Orchestrator
**Phase**: 1 — Requirements, Architecture & Design
**Document Classification**: Formal Evidence Package & Audit Report
**Author**: Lead Personal-Brand Strategist & Senior Backend Architect (Rayhan AI Architecture)
**Governance Policy**: Strict Evidence-Based Audit. No premature verification claims. Final Phase 2 sign-off reserved for Project Owner.

---

## 1. Executive Summary & Verification Boundary

To ensure absolute governance integrity, all aspects of the system are categorized under three mutually exclusive statuses:

- [ACTUALLY VALIDATED]: 8 Markdown docs, 7 Mermaid diagram source files, TypeScript build (clean), static typechecking (tsc clean), Recharts status visualizer rendering.
- [REVIEWED BASELINE]: Architecture, ER indexing design, API contract (6 JWT claims, 30m baseline), ADR-001, ADR-002 (Privileged Connection, No RLS), STRIDE Threat Model, Dual Test Plan.
- [NOT YET TESTED / DEFERRED]: Backend FastAPI runtime execution, Pytest runs (pytest -v), Alembic PostgreSQL 16+ migrations, runtime UUID server defaults, cloud deployment.

---

## 2. Comprehensive File Inventory

- /docs/architecture/system-architecture.md
- /docs/architecture/database-er-diagram.md
- /docs/api/api-contract.md
- /docs/decisions/ADR-001-modular-monolith.md
- /docs/decisions/ADR-002-database-security.md
- /docs/security/threat-model.md
- /docs/testing/test-plan.md
- /docs/phase-reports/phase-01-review.md
- /docs/phase-reports/phase-01-audit-report.md
- /docs/diagrams/01-system-context.mmd
- /docs/diagrams/02-modular-monolith.mmd
- /docs/diagrams/03-request-sequence.mmd
- /docs/diagrams/04-queue-worker-boundary.mmd
- /docs/diagrams/05-ai-mcp-boundary.mmd
- /docs/diagrams/06-database-er.mmd
- /docs/diagrams/07-task-status-fsm.mmd

---

## 3. Governance Gate Decision

Verdict: PHASE 1 COMPLETED & AUDITED — READY FOR STAKEHOLDER SIGN-OFF
Directive: Formal sign-off is reserved for the project owner. Phase 2 backend implementation remains deferred.`
  }
};

const TRACEABILITY_ROWS = [
  { id: 'REQ-01', desc: 'Modular Monolith Architecture', doc: 'system-architecture.md §2', adr: 'ADR-001', test: 'PLN-UT-01 to 06', status: 'REVIEWED' },
  { id: 'REQ-02', desc: 'User Registration & Login Endpoints', doc: 'api-contract.md §2', adr: 'ADR-001', test: 'PLN-API-01 / 03', status: 'REVIEWED' },
  { id: 'REQ-03', desc: 'Bcrypt Salted Hashing (Work Factor 12)', doc: 'threat-model.md §2.1', adr: 'ADR-001', test: 'PLN-UT-01 / 02', status: 'REVIEWED' },
  { id: 'REQ-04', desc: 'Strict PyJWT (sub, exp, iat, iss, aud, type)', doc: 'api-contract.md §1.1', adr: 'ADR-001', test: 'PLN-UT-03, PLN-API-06 to 08', status: 'REVIEWED' },
  { id: 'REQ-05', desc: 'Consistent Token Expiry (30m Baseline)', doc: 'api-contract.md §1.1', adr: 'ADR-001', test: 'PLN-UT-03, PLN-API-06', status: 'REVIEWED' },
  { id: 'REQ-06', desc: 'Task CRUD Operations & Schema Validation', doc: 'api-contract.md §3', adr: 'ADR-001', test: 'PLN-API-01 to 05, PLN-UT-05', status: 'REVIEWED' },
  { id: 'REQ-07', desc: 'ADR-002 Application-Level Authorization', doc: 'ADR-002-database-security.md', adr: 'ADR-002', test: 'PLN-ISO-01 to 04', status: 'REVIEWED' },
  { id: 'REQ-08', desc: 'Anti-Enumeration (404 on Foreign Task)', doc: 'api-contract.md §3.4', adr: 'ADR-002', test: 'PLN-ISO-01 to 03', status: 'REVIEWED' },
  { id: 'REQ-09', desc: 'UUIDv4 Primary Keys & No Redundant Indexes', doc: 'database-er-diagram.md §2', adr: 'ADR-002', test: 'PLN-PG-04', status: 'REVIEWED' },
  { id: 'REQ-10', desc: 'Purpose-Justified Composite Indexes', doc: 'database-er-diagram.md §3', adr: 'ADR-002', test: 'PLN-PG-01', status: 'REVIEWED' },
  { id: 'REQ-11', desc: 'Explicit Alembic Migrations (No create_all)', doc: 'database-er-diagram.md §5', adr: 'ADR-002', test: 'PLN-PG-01 to 03', status: 'REVIEWED' },
  { id: 'REQ-12', desc: 'Timezone-Aware UTC Timestamping (TIMESTAMPTZ)', doc: 'database-er-diagram.md §2', adr: 'ADR-001', test: 'PLN-PG-06', status: 'REVIEWED' },
  { id: 'REQ-13', desc: 'Dual Testing: SQLite Unit + PostgreSQL Suite', doc: 'test-plan.md §1', adr: 'ADR-001', test: 'Dual Test Pipeline', status: 'REVIEWED' },
  { id: 'REQ-14', desc: 'Future Asynchronous Worker Queue Boundary', doc: 'system-architecture.md §4', adr: 'ADR-001', test: 'Phase 3 Scope', status: 'DEFERRED (P3)' },
  { id: 'REQ-15', desc: 'Future AI Planner / MCP Tenant Boundary', doc: 'system-architecture.md §5', adr: 'ADR-002', test: 'Phase 4 Scope', status: 'DEFERRED (P4)' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'docs' | 'diagrams' | 'traceability' | 'adrs' | 'threats' | 'review'>('docs');
  const [selectedDocKey, setSelectedDocKey] = useState<string>('docs/architecture/system-architecture.md');
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [diagramMode, setDiagramMode] = useState<'visual' | 'mermaid'>('visual');
  const [docViewMode, setDocViewMode] = useState<'markdown' | 'visualizer'>('markdown');

  const selectedDoc = DOC_FILES[selectedDocKey] || DOC_FILES['docs/architecture/system-architecture.md'];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPackage = async (mode: 'full' | 'evidence_only' = 'full') => {
    setIsExporting(true);
    try {
      await packageProjectZip(DOC_FILES, mode);
    } catch (err) {
      console.error('Failed to create project package zip:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const downloadAllDocs = () => downloadPackage('full');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-6 py-4 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white">Rayhan AI Architecture</span>
            <span className="hidden sm:inline text-xs text-slate-400 ml-2">TaskFlow Phase 1 Portal</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-xs uppercase tracking-wider font-medium text-slate-400">
          <button
            onClick={() => setActiveTab('docs')}
            className={`transition-colors whitespace-nowrap hover:text-white ${activeTab === 'docs' ? 'text-indigo-400 border-b-2 border-indigo-500 pb-0.5' : ''}`}
          >
            Documentation Library
          </button>
          <button
            onClick={() => setActiveTab('diagrams')}
            className={`transition-colors whitespace-nowrap hover:text-white ${activeTab === 'diagrams' ? 'text-indigo-400 border-b-2 border-indigo-500 pb-0.5' : ''}`}
          >
            Mermaid Diagrams
          </button>
          <button
            onClick={() => setActiveTab('traceability')}
            className={`transition-colors whitespace-nowrap hover:text-white ${activeTab === 'traceability' ? 'text-indigo-400 border-b-2 border-indigo-500 pb-0.5' : ''}`}
          >
            Traceability Matrix
          </button>
          <button
            onClick={() => setActiveTab('adrs')}
            className={`transition-colors whitespace-nowrap hover:text-white ${activeTab === 'adrs' ? 'text-indigo-400 border-b-2 border-indigo-500 pb-0.5' : ''}`}
          >
            ADR Registry
          </button>
          <button
            onClick={() => setActiveTab('threats')}
            className={`transition-colors whitespace-nowrap hover:text-white ${activeTab === 'threats' ? 'text-indigo-400 border-b-2 border-indigo-500 pb-0.5' : ''}`}
          >
            Threat Model
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`transition-colors whitespace-nowrap hover:text-white ${activeTab === 'review' ? 'text-indigo-400 border-b-2 border-indigo-500 pb-0.5' : ''}`}
          >
            Phase 1 Review
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => downloadPackage('full')}
            disabled={isExporting}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-600/30 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Packaging...' : 'সম্পূর্ণ প্রজেক্ট ডাউনলোড (.ZIP)'}</span>
          </button>
          <button
            onClick={() => downloadPackage('evidence_only')}
            disabled={isExporting}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors whitespace-nowrap"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Evidence Only</span>
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="border-b border-slate-800/80 bg-slate-900/40 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-indigo-400 font-semibold">Phase 1: Architecture, Design & Requirements</span>
              <span>·</span>
              <span>Architectural Review & Corrections Applied</span>
              <span>·</span>
              <span className="text-amber-400 font-mono">Status: Reviewed Baseline</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
              TaskFlow Orchestrator: System Architecture & Design
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Authored by <span className="text-white font-semibold">Rayhan Badsha</span> (Senior Backend Architect & Technical Documentation Engineer).
              Strictly reviewed Phase 1 documentation establishing the Modular Monolith, ADR-002 Backend Privileged Database Connection with Application-Level Authorization (No Supabase RLS), UUIDv4 ER Schema, API Contract with strict 6 JWT claims & 30m baseline, STRIDE Threat Model, and Dual-Environment Test Plan.
            </p>

            {/* BENGALI ONE-CLICK VIEWER GUIDE BANNER */}
            <div className="mt-3 p-3 bg-indigo-950/70 border border-indigo-500/40 rounded-xl flex items-start gap-2.5">
              <BookOpen className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-200 leading-relaxed">
                <strong className="text-white">ফাইল ডাওনলোড ও ডায়াগ্রাম দেখার সহজ নিয়ম:</strong> ডাওনলোড করা জিপ ফোল্ডারের ভেতরে থাকা <strong className="text-indigo-300">START_HERE.html</strong> অথবা <strong className="text-indigo-300">index.html</strong> ফাইলে ডাবল-ক্লিক করলেই গুগল ক্রোম বা যেকোনো ব্রাউজারে সব ভিজ্যুয়াল ডায়াগ্রাম, ৯টি ডক এবং সম্পূর্ণ প্রজেক্ট ইন্টার‍্যাক্টিভভাবে ওপেন হবে!
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href="https://github.com/rayhan-ai-architect/curizx-ai-employee"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800/90 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
            >
              <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
              <span>Flagship: Curizx AI Employee</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
            <a
              href="https://www.linkedin.com/in/rayhan-badsha-a71662294"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800/90 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
            >
              <span>LinkedIn Profile</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between overflow-x-auto">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('docs')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'docs' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              01. Documentation Library (9)
            </button>
            <button
              onClick={() => setActiveTab('diagrams')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'diagrams' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              02. Mermaid Diagrams
            </button>
            <button
              onClick={() => setActiveTab('traceability')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'traceability' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              03. Traceability Matrix
            </button>
            <button
              onClick={() => setActiveTab('adrs')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'adrs' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              04. ADR-001 & ADR-002
            </button>
            <button
              onClick={() => setActiveTab('threats')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'threats' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              05. STRIDE Threat Model
            </button>
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${activeTab === 'review' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
            >
              06. Phase 1 Review Report
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400 tabular-nums">
            <span>Phase: 1 (Design Only)</span>
            <span>·</span>
            <span>Token Expiry: 30m Baseline</span>
            <span>·</span>
            <span>Implementation: Deferred to Phase 2</span>
          </div>
        </div>
      </section>

      {/* MAIN VIEWPORT CONTENT */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-8">

        {/* TAB 1: DOCUMENTATION LIBRARY */}
        {activeTab === 'docs' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-4 bg-slate-900/60 rounded-xl border border-slate-800 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Reviewed Documents</span>
                <span className="text-xs font-mono text-slate-500">{Object.keys(DOC_FILES).length} docs</span>
              </div>

              <div className="space-y-1">
                {Object.entries(DOC_FILES).map(([key, doc]) => {
                  const isSelected = selectedDocKey === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedDocKey(key)}
                      className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors ${
                        isSelected
                          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                          : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold text-white truncate">{doc.title}</div>
                      <div className="text-[11px] font-mono text-slate-500 truncate mt-0.5">{doc.path}</div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <button
                  onClick={() => downloadPackage('full')}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>সম্পূর্ণ প্রজেক্ট ও ডায়াগ্রাম (.ZIP)</span>
                </button>
                <button
                  onClick={() => downloadPackage('evidence_only')}
                  disabled={isExporting}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Evidence Package Only (.ZIP)</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-8 bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span>{selectedDoc.title}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">{selectedDoc.path}</div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                    <button
                      onClick={() => setDocViewMode('markdown')}
                      className={`px-2.5 py-1 rounded transition-colors ${
                        docViewMode === 'markdown' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Markdown Spec
                    </button>
                    <button
                      onClick={() => setDocViewMode('visualizer')}
                      className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
                        docViewMode === 'visualizer' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Activity className="w-3 h-3 text-emerald-400" />
                      <span>Task API Visualizer</span>
                    </button>
                  </div>

                  <button
                    onClick={() => copyToClipboard(selectedDoc.content)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition-colors border border-slate-700 shrink-0"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Markdown</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {docViewMode === 'visualizer' ? (
                <div className="p-5 bg-slate-950 overflow-y-auto max-h-[750px]">
                  <TaskStatusVisualizer />
                </div>
              ) : (
                <div className="p-6 bg-slate-950 overflow-x-auto max-h-[680px] font-mono text-xs leading-relaxed text-slate-300 whitespace-pre-wrap selection:bg-indigo-600/40">
                  {selectedDoc.content}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MERMAID DIAGRAMS */}
        {activeTab === 'diagrams' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">System, ER & Boundary Architecture Diagrams</h2>
                <p className="text-xs text-slate-400 mt-0.5">Formal architectural specifications with full syntax validation</p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-lg border border-slate-800">
                <button
                  onClick={() => setDiagramMode('visual')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${diagramMode === 'visual' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Visual Architecture
                </button>
                <button
                  onClick={() => setDiagramMode('mermaid')}
                  className={`px-3 py-1 text-xs rounded transition-colors ${diagramMode === 'mermaid' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  Mermaid Source Code
                </button>
              </div>
            </div>

            {/* Diagram 1: System Context */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400">Diagram 01</span>
                  <h3 className="text-base font-bold text-white">System Context & External Actors</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">C4 Level 1</span>
              </div>

              {diagramMode === 'visual' ? (
                <div className="p-6 bg-slate-950 rounded-lg border border-slate-800 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="p-4 bg-slate-900 rounded-lg border border-slate-700 text-center space-y-2">
                      <div className="w-10 h-10 mx-auto rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                        <Terminal className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-bold text-white">Client Applications</div>
                      <p className="text-[11px] text-slate-400">SPA / Web / Mobile transmitting Bearer JWT (30m expiry)</p>
                    </div>

                    <div className="text-center space-y-1">
                      <div className="h-0.5 bg-indigo-500/50 w-full relative">
                        <ArrowRight className="w-4 h-4 text-indigo-400 absolute right-0 -top-2" />
                      </div>
                      <span className="text-[10px] font-mono text-indigo-300">HTTPS / REST / JWT (HS256)</span>
                    </div>

                    <div className="p-4 bg-slate-900 rounded-lg border border-indigo-500/50 text-center space-y-2 shadow-lg shadow-indigo-950/40">
                      <div className="w-10 h-10 mx-auto rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                        <Server className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-bold text-white">TaskFlow Modular Monolith</div>
                      <p className="text-[11px] text-slate-300">FastAPI + ADR-002 Auth Guard + Pydantic v2 + SQLAlchemy 2.x</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-3.5 bg-slate-900 rounded-lg border border-cyan-800/60 space-y-1.5">
                      <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                        <Database className="w-4 h-4" />
                        <span>PostgreSQL 16+ Database</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Privileged connection pool (TCP 5432). Strictly scoped via application-level user_id filtering.
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-900/60 rounded-lg border border-amber-800/40 border-dashed space-y-1.5">
                      <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold">
                        <Workflow className="w-4 h-4" />
                        <span>Phase 3: Redis / Celery Workers</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Asynchronous message broker & scheduled task runners (Deferred to Phase 3).
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-900/60 rounded-lg border border-purple-800/40 border-dashed space-y-1.5">
                      <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold">
                        <Cpu className="w-4 h-4" />
                        <span>Phase 4: AI Planner / MCP</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Model Context Protocol server strictly bound to tenant service layer (Deferred to Phase 4).
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
                  <pre>{DOC_FILES['docs/architecture/system-architecture.md'].mermaid}</pre>
                </div>
              )}
            </div>

            {/* Diagram 2: ER Diagram */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-indigo-400">Diagram 02</span>
                  <h3 className="text-base font-bold text-white">Database ER Model (No Redundant PK Indexes)</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">1:N Ownership Schema</span>
              </div>

              {diagramMode === 'visual' ? (
                <div className="p-6 bg-slate-950 rounded-lg border border-slate-800 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div className="p-4 bg-slate-900 rounded-lg border border-slate-700 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-white">Entity: USERS</span>
                        <span className="text-[10px] font-mono text-indigo-400">Table: users</span>
                      </div>
                      <div className="space-y-1.5 font-mono text-[11px] text-slate-300">
                        <div className="flex justify-between text-indigo-300">
                          <span>id (PK)</span>
                          <span className="text-slate-500">UUIDv4 (gen_random_uuid())</span>
                        </div>
                        <div className="flex justify-between">
                          <span>email (UK)</span>
                          <span className="text-slate-500">VARCHAR(255)</span>
                        </div>
                        <div className="flex justify-between text-rose-300">
                          <span>password_hash</span>
                          <span className="text-slate-500">VARCHAR(255)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>full_name</span>
                          <span className="text-slate-500">VARCHAR(255)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>is_active</span>
                          <span className="text-slate-500">BOOLEAN</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>created_at</span>
                          <span className="text-slate-500">TIMESTAMPTZ</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>updated_at</span>
                          <span className="text-slate-500">TIMESTAMPTZ</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900 rounded-lg border border-slate-700 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-white">Entity: TASKS</span>
                        <span className="text-[10px] font-mono text-indigo-400">Table: tasks</span>
                      </div>
                      <div className="space-y-1.5 font-mono text-[11px] text-slate-300">
                        <div className="flex justify-between text-indigo-300">
                          <span>id (PK)</span>
                          <span className="text-slate-500">UUIDv4 (gen_random_uuid())</span>
                        </div>
                        <div className="flex justify-between text-cyan-300">
                          <span>user_id (FK)</span>
                          <span className="text-slate-500">UUIDv4 (ON DELETE CASCADE)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>title</span>
                          <span className="text-slate-500">VARCHAR(200)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>description</span>
                          <span className="text-slate-500">TEXT (Nullable)</span>
                        </div>
                        <div className="flex justify-between text-amber-300">
                          <span>status</span>
                          <span className="text-slate-500">VARCHAR(50)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>priority</span>
                          <span className="text-slate-500">VARCHAR(50)</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>due_date</span>
                          <span className="text-slate-500">TIMESTAMPTZ (Nullable)</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>created_at</span>
                          <span className="text-slate-500">TIMESTAMPTZ</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>updated_at</span>
                          <span className="text-slate-500">TIMESTAMPTZ</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900 rounded border border-slate-800 text-xs text-slate-400 space-y-1">
                    <div className="font-semibold text-slate-200">Justified Secondary & Composite Indexes:</div>
                    <p className="font-mono text-[11px] text-indigo-300">
                      CREATE UNIQUE INDEX ix_users_email ON users (email);<br />
                      CREATE INDEX ix_tasks_user_id ON tasks (user_id);<br />
                      CREATE INDEX ix_tasks_user_id_status ON tasks (user_id, status);<br />
                      CREATE INDEX ix_tasks_user_id_created_at ON tasks (user_id, created_at DESC);<br />
                      CREATE INDEX ix_tasks_user_id_title ON tasks (user_id, title);
                    </p>
                    <p className="text-[11px] pt-1">
                      Note: Redundant indexes on primary keys (ix_users_id, ix_tasks_id) were eliminated to avoid buffer cache bloat and write amplification.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto">
                  <pre>{DOC_FILES['docs/architecture/database-er-diagram.md'].mermaid}</pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TRACEABILITY MATRIX */}
        {activeTab === 'traceability' && (
          <div className="space-y-6">
            {/* Task API Data Visualizer Preview */}
            <TaskStatusVisualizer />

            <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">Corrected Requirements Traceability Matrix</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Accurate mapping from requirements to architectural specifications, ADRs, and planned verification tests.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Requirement ID</th>
                      <th className="py-3 px-4 font-semibold">Specification Description</th>
                      <th className="py-3 px-4 font-semibold text-indigo-400">Design Document</th>
                      <th className="py-3 px-4 font-semibold text-cyan-400">Governing ADR</th>
                      <th className="py-3 px-4 font-semibold">Planned Verification Test</th>
                      <th className="py-3 px-4 font-semibold text-emerald-400">Phase 1 Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {TRACEABILITY_ROWS.map(row => (
                      <tr key={row.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-white">{row.id}</td>
                        <td className="py-3 px-4 font-medium text-slate-200">{row.desc}</td>
                        <td className="py-3 px-4 font-mono text-indigo-300">{row.doc}</td>
                        <td className="py-3 px-4 font-mono text-cyan-300">{row.adr}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{row.test}</td>
                        <td className="py-3 px-4">
                          <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                            row.status === 'REVIEWED'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                              : 'bg-amber-950 text-amber-400 border border-amber-800/60'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ADR REGISTRY */}
        {activeTab === 'adrs' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-slate-900/60 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                    ADR-001: APPROVED
                  </span>
                  <span className="text-xs text-slate-500 font-mono">2026-10-31</span>
                </div>
                <h3 className="text-base font-bold text-white">Modular Monolith Architecture Pattern</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Adopt a domain-oriented modular monolith in Python 3.11+ / FastAPI instead of microservices from Day 1.
                </p>
                <div className="space-y-2 text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <p><strong className="text-slate-200">Alternative Rejected:</strong> Microservices (distributed transaction failure modes, excessive operational complexity).</p>
                  <p><strong className="text-slate-200">Key Consequence:</strong> Atomic database transactions without 2PC/Sagas; clean module boundaries ensure effortless extraction of worker processes in Phase 3.</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedDocKey('docs/decisions/ADR-001-modular-monolith.md');
                    setActiveTab('docs');
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 pt-1"
                >
                  <span>Read Full ADR-001 Document</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="p-6 bg-slate-900/60 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    ADR-002: APPROVED
                  </span>
                  <span className="text-xs text-slate-500 font-mono">2026-10-31</span>
                </div>
                <h3 className="text-base font-bold text-white">Backend Privileged Connection with App-Level Authorization</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Mandatory application-level authorization with privileged connection pool. Explicitly rejects Supabase / PostgreSQL Database RLS.
                </p>
                <div className="space-y-2 text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <p><strong className="text-slate-200">Core Decision:</strong> Zero session pollution in connection pooling (PgBouncer); 100% vendor portability; sub-second in-memory SQLite testing.</p>
                  <p><strong className="text-slate-200">Anti-Enumeration Rule:</strong> Cross-tenant access attempts return HTTP 404 Not Found to prevent valid UUID discovery.</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedDocKey('docs/decisions/ADR-002-database-security.md');
                    setActiveTab('docs');
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 pt-1"
                >
                  <span>Read Full ADR-002 Document</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: THREAT MODEL */}
        {activeTab === 'threats' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-4">
              <div>
                <h2 className="text-lg font-bold text-white">STRIDE Threat Modeling & Risk Matrix</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Proactive security analysis addressing spoofing, tampering, repudiation, information disclosure, DoS, and privilege escalation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-rose-400">
                    <span>S: Spoofing Identity</span>
                    <span className="font-mono text-slate-500">S-01, S-02</span>
                  </div>
                  <p className="text-xs text-slate-300">Threat: Forged JWTs or credential brute-forcing.</p>
                  <p className="text-xs text-slate-400">
                    Mitigation: Strict HS256 algorithm enforcement, 256-bit entropy secrets, 6 required claims, Bcrypt work factor 12, sliding-window rate-limiting.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-400">
                    <span>T: Tampering Data</span>
                    <span className="font-mono text-slate-500">T-01, T-02</span>
                  </div>
                  <p className="text-xs text-slate-300">Threat: Cross-tenant task mutation via manipulated IDs.</p>
                  <p className="text-xs text-slate-400">
                    Mitigation: ADR-002 mandatory user_id predicate in query; cryptographic JWT signature verification.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-indigo-400">
                    <span>R: Repudiation</span>
                    <span className="font-mono text-slate-500">R-01</span>
                  </div>
                  <p className="text-xs text-slate-300">Threat: Denying task modifications or deletions.</p>
                  <p className="text-xs text-slate-400">
                    Mitigation: Timezone-aware UTC audit timestamps (created_at, updated_at) and structured application logging.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-cyan-400">
                    <span>I: Information Disclosure</span>
                    <span className="font-mono text-slate-500">I-01, I-02</span>
                  </div>
                  <p className="text-xs text-slate-300">Threat: Leaking password hashes or task existence.</p>
                  <p className="text-xs text-slate-400">
                    Mitigation: Strict Pydantic response models excluding password_hash; HTTP 404 anti-enumeration responses; sensitive log redaction.
                  </p>
                </div>

                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-purple-400">
                    <span>D: Denial of Service</span>
                    <span className="font-mono text-slate-500">D-01, D-02</span>
                  </div>
                  <p className="text-xs text-slate-300">Threat: Deep pagination memory bloat or pool exhaustion.</p>
                  <p className="text-xs text-slate-400">
                    Mitigation: Query pagination capped at 100 items; SQLAlchemy connection pool sizing (pool_size=10, max_overflow=20).
                  </p>
                </div>

                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                    <span>E: Elevation of Privilege</span>
                    <span className="font-mono text-slate-500">E-01, E-02</span>
                  </div>
                  <p className="text-xs text-slate-300">Threat: Deactivated account access or SQL injection.</p>
                  <p className="text-xs text-slate-400">
                    Mitigation: Active status checked against DB on each request; 100% parameterized SQLAlchemy 2.x ORM statements.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: PHASE 1 REVIEW */}
        {activeTab === 'review' && (
          <div className="space-y-6">
            <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-amber-400">Phase 1 Governance Gate</span>
                  <h2 className="text-lg font-bold text-white mt-0.5">Phase 1 Architecture Review & Sign-Off Report</h2>
                </div>
                <span className="text-xs font-mono text-amber-400 bg-amber-950/80 border border-amber-800/80 px-2.5 py-1 rounded">
                  STATUS: REVIEWED BASELINE
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    REVIEWED
                  </span>
                  <div className="text-xs">
                    <span className="font-semibold text-white">System Architecture Document</span>
                    <p className="text-slate-400">Modular monolith, request sequence, queue/worker, and MCP tenant enclosure documented in docs/architecture/system-architecture.md.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    REVIEWED
                  </span>
                  <div className="text-xs">
                    <span className="font-semibold text-white">Database ER Model & Schema Specification</span>
                    <p className="text-slate-400">Redundant PK indexes removed; composite indexes justified; dual-tier UUID generation detailed in docs/architecture/database-er-diagram.md.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    REVIEWED
                  </span>
                  <div className="text-xs">
                    <span className="font-semibold text-white">API Contract & Endpoints Specification</span>
                    <p className="text-slate-400">6 mandatory JWT claims, 30-min baseline expiry, JSON login encoding, PATCH semantics, and status codes in docs/api/api-contract.md.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    REVIEWED
                  </span>
                  <div className="text-xs">
                    <span className="font-semibold text-white">ADR-001 & ADR-002 Decisions</span>
                    <p className="text-slate-400">Modular monolith and Backend Privileged Connection (No Supabase RLS) reviewed and recorded in docs/decisions/.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    REVIEWED
                  </span>
                  <div className="text-xs">
                    <span className="font-semibold text-white">STRIDE Threat Model & Residual Risk Analysis</span>
                    <p className="text-slate-400">Brute-force defenses, secret rotation, sensitive-log redaction, and residual risks recorded in docs/security/threat-model.md.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    REVIEWED
                  </span>
                  <div className="text-xs">
                    <span className="font-semibold text-white">Dual-Environment Test Plan</span>
                    <p className="text-slate-400">In-memory SQLite (fast local unit/API) + PostgreSQL 16+ integration test plan defined in docs/testing/test-plan.md.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0">
                    ACTUALLY VALIDATED
                  </span>
                  <div className="text-xs">
                    <span className="font-semibold text-white">Mermaid Syntaxes, TypeScript Compilation & Typechecks</span>
                    <p className="text-slate-400">All 7 Mermaid diagram sources (.mmd) parsed with 0 syntax errors; Vite build and TypeScript static typecheck (tsc --noEmit) completed cleanly; Recharts Task API status visualizer rendered with interactive state validation.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800 shrink-0">
                    REVIEWED BASELINE
                  </span>
                  <div className="text-xs">
                    <span className="font-semibold text-white">Phase 1 Architecture, Contracts, ADRs, Security & Test Strategy</span>
                    <p className="text-slate-400">Formal specifications reviewed for cross-document consistency: 30m baseline JWT expiry, 6 mandatory claims, ADR-002 application tenancy isolation (No Supabase RLS), justified composite indexes, and dual-tier testing boundaries.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 shrink-0">
                    NOT YET TESTED
                  </span>
                  <div className="text-xs">
                    <span className="font-semibold text-white">Phase 2 Backend Execution, Migrations & Runtime Behavior</span>
                    <p className="text-slate-400">FastAPI backend runtime, Pytest test suites (PLN-AUTH, PLN-TASK, PLN-ISO), PostgreSQL 16+ Alembic migrations, and cloud deployment are strictly deferred to Phase 2. Zero tests have been executed; zero deployment claims are made.</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-lg border border-amber-500/40 text-xs text-slate-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Formal Governance Gate: Phase 1 Final Sign-Off
                  </span>
                  <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider font-semibold">
                    Decision: Reserved for Project Owner
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  All Phase 1 documentation artifacts, diagram sources, and consistency checks are prepared and audited. In strict adherence to governance policies, Phase 1 is marked <strong className="text-white">READY FOR STAKEHOLDER SIGN-OFF</strong>. Final formal sign-off is left for the project owner. Backend code implementation, database migrations, and runtime execution remain deferred until approval is granted.
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => downloadPackage('full')}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Complete Project & Visual Diagrams (.ZIP)</span>
                  </button>
                  <button
                    onClick={() => downloadPackage('evidence_only')}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 rounded-lg hover:bg-slate-700 border border-slate-700 transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Evidence Package Only (.ZIP)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="mt-16 border-t border-slate-800/80 bg-slate-950 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            <span className="font-semibold text-slate-200">TaskFlow Orchestrator — Phase 1 Documentation Package</span>
            <span> · Architected under ADR-001 & ADR-002</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="https://www.linkedin.com/in/rayhan-badsha-a71662294"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-200 transition-colors"
            >
              LinkedIn Profile
            </a>
            <a
              href="https://github.com/rayhan-ai-architect"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-200 transition-colors"
            >
              GitHub Portfolio
            </a>
            <a
              href="https://youtube.com/playlist?list=PLbIePX5F-An4"
              target="_blank"
              rel="noreferrer"
              className="hover:text-slate-200 transition-colors"
            >
              AI Engineering Masterclass
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
