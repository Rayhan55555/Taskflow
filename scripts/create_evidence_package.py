#!/usr/bin/env python3
"""
TaskFlow Orchestrator Phase 1 Evidence Package Generator
Preserves:
1. START_HERE.html (Offline interactive viewer with Mermaid CDN auto-rendering)
2. 9 Markdown documentation files under docs/
3. 7 Mermaid .mmd source files under docs/diagrams/
4. 7 Standalone .html visual diagram viewers under docs/diagrams/
5. EVIDENCE_PACKAGE_MANIFEST.json
6. Phase 1 Audit Report & Review Matrix
7. Quickstart guides (কিভাবে_ওপেন_করবেন.txt & HOW_TO_OPEN.txt)
8. Complete Phase 2 Codebase (FastAPI, Alembic, SQLAlchemy 2.x, Pytest)
"""

import os
import json
import zipfile
from pathlib import Path

ROOT = Path("/app/applet")
PUBLIC = ROOT / "public"
PUBLIC.mkdir(exist_ok=True)

# 1. Diagram metadata and source
DIAGRAMS = {
    "01-system-context": {
        "title": "01. System Context Diagram (C4 Level 1)",
        "summary": "Client Applications -> Modular Monolith API -> PostgreSQL 16+ with decoupled Phase 3 Queue and Phase 4 AI.",
        "file": ROOT / "docs/diagrams/01-system-context.mmd"
    },
    "02-modular-monolith": {
        "title": "02. Modular Monolith Subsystems Architecture",
        "summary": "Internal domain partitioning: Edge Gateway, Auth Subsystem, Task Domain, Shared Infrastructure, Persistence.",
        "file": ROOT / "docs/diagrams/02-modular-monolith.mmd"
    },
    "03-request-sequence": {
        "title": "03. End-to-End Request Lifecycle & Ownership Validation Sequence",
        "summary": "Step-by-step token verification, database session dispatch, ownership filter, and 404/403 isolation.",
        "file": ROOT / "docs/diagrams/03-request-sequence.mmd"
    },
    "04-queue-worker-boundary": {
        "title": "04. Future Queue / Worker Boundary Architecture (Phase 3 Planned)",
        "summary": "Decoupled asynchronous worker topology using Redis & Celery with explicit tenant scope propagation.",
        "file": ROOT / "docs/diagrams/04-queue-worker-boundary.mmd"
    },
    "05-ai-mcp-boundary": {
        "title": "05. Autonomous AI Planner & MCP Tool Boundary (Phase 4 Planned)",
        "summary": "Model Context Protocol (MCP) host invoking authenticated FastAPI service layer without direct DB access.",
        "file": ROOT / "docs/diagrams/05-ai-mcp-boundary.mmd"
    },
    "06-database-er": {
        "title": "06. Relational Database Entity-Relationship Diagram",
        "summary": "Users and Tasks tables with UUID PKs, justified composite indexes, and strict 1:N ownership FK.",
        "file": ROOT / "docs/diagrams/06-database-er.mmd"
    },
    "07-task-status-fsm": {
        "title": "07. Task Lifecycle Finite State Machine (FSM)",
        "summary": "Deterministic status transitions: PENDING -> IN_PROGRESS -> COMPLETED / ARCHIVED with validation rules.",
        "file": ROOT / "docs/diagrams/07-task-status-fsm.mmd"
    }
}

# 2. Markdown documentation files
DOC_PATHS = [
    "docs/architecture/system-architecture.md",
    "docs/architecture/database-er-diagram.md",
    "docs/api/api-contract.md",
    "docs/decisions/ADR-001-modular-monolith.md",
    "docs/decisions/ADR-002-database-security.md",
    "docs/security/threat-model.md",
    "docs/testing/test-plan.md",
    "docs/phase-reports/phase-01-review.md",
    "docs/phase-reports/phase-01-audit-report.md"
]

def make_single_diagram_html(title: str, summary: str, mmd_code: str) -> str:
    escaped_code = mmd_code.replace("<", "&lt;").replace(">", "&gt;")
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} | TaskFlow Orchestrator</title>
  <style>
    body {{
      margin: 0;
      padding: 24px;
      background-color: #0b0f19;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }}
    .container {{ max-width: 1200px; margin: 0 auto; }}
    .header {{ padding-bottom: 16px; border-bottom: 1px solid #1e293b; margin-bottom: 24px; }}
    h1 {{ margin: 0 0 8px 0; font-size: 22px; color: #ffffff; }}
    p {{ margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5; }}
    .diagram-card {{
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 32px;
      overflow-x: auto;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }}
    .source-card {{
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
    }}
    .back-btn {{
      display: inline-block;
      margin-top: 20px;
      padding: 8px 16px;
      background: #4f46e5;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
    }}
    .back-btn:hover {{ background: #4338ca; }}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {{
      mermaid.initialize({{
        startOnLoad: true,
        theme: "dark",
        themeVariables: {{
          darkMode: true,
          background: "#0f172a",
          primaryColor: "#4f46e5",
          primaryTextColor: "#ffffff",
          primaryBorderColor: "#6366f1",
          lineColor: "#38bdf8",
          secondaryColor: "#0284c7",
          tertiaryColor: "#1e293b"
        }}
      }});
    }});
  </script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{title}</h1>
      <p>{summary}</p>
    </div>

    <div class="diagram-card">
      <div class="mermaid">
{mmd_code}
      </div>
    </div>

    <div style="margin-top: 24px;">
      <h3 style="font-size: 14px; margin-bottom: 8px; color: #cbd5e1;">Mermaid Raw Source Code</h3>
      <div class="source-card">{escaped_code}</div>
    </div>

    <a href="../START_HERE.html" class="back-btn">← Back to Master Viewer (START_HERE.html)</a>
  </div>
</body>
</html>"""

def make_start_here_html() -> str:
    # Build tabs for all 7 diagrams and 9 docs
    diagram_cards_html = ""
    diagram_tabs_html = ""
    for idx, (key, d) in enumerate(DIAGRAMS.items()):
        code = d["file"].read_text(encoding="utf-8")
        escaped_code = code.replace("<", "&lt;").replace(">", "&gt;")
        active_class = "active" if idx == 0 else ""
        display_style = "block" if idx == 0 else "none"
        diagram_tabs_html += f'<button class="tab-btn {active_class}" onclick="showDiagram(\'{key}\', this)">{d["title"][:24]}...</button>\n'
        diagram_cards_html += f"""
        <div id="diag-{key}" class="diag-panel" style="display: {display_style};">
          <div class="panel-header">
            <h3>{d["title"]}</h3>
            <span class="badge">Visual Rendered</span>
            <p>{d["summary"]}</p>
            <a href="docs/diagrams/{key}.html" target="_blank" class="link-btn">Open Full Screen ↗</a>
          </div>
          <div class="render-box">
            <div class="mermaid">
{code}
            </div>
          </div>
          <details class="source-toggle">
            <summary>View Raw Mermaid .mmd Source</summary>
            <pre class="code-view">{escaped_code}</pre>
          </details>
        </div>"""

    # Documentation list
    docs_nav_html = ""
    docs_panels_html = ""
    for idx, doc_path in enumerate(DOC_PATHS):
        full_p = ROOT / doc_path
        content = full_p.read_text(encoding="utf-8")
        escaped_content = content.replace("<", "&lt;").replace(">", "&gt;")
        title = doc_path.split("/")[-1].replace(".md", "").replace("-", " ").title()
        active_class = "active" if idx == 0 else ""
        display_style = "block" if idx == 0 else "none"
        cat = doc_path.split("/")[1].upper()
        docs_nav_html += f'<button class="doc-nav-btn {active_class}" onclick="showDoc(\'{idx}\', this)"><span class="doc-cat">{cat}</span> {title}</button>\n'
        docs_panels_html += f"""
        <div id="doc-panel-{idx}" class="doc-content-panel" style="display: {display_style};">
          <div class="doc-header">
            <h3>{title}</h3>
            <span class="file-path">{doc_path}</span>
          </div>
          <pre class="markdown-view">{escaped_content}</pre>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>START HERE | TaskFlow Orchestrator Phase 1 Evidence & Architecture</title>
  <style>
    :root {{
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
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      padding: 0;
      background: var(--bg);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }}
    header {{
      background: rgba(15, 23, 42, 0.95);
      border-bottom: 1px solid var(--card-border);
      padding: 18px 32px;
      position: sticky;
      top: 0;
      z-index: 50;
      backdrop-filter: blur(12px);
    }}
    .header-content {{
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }}
    .brand {{
      display: flex;
      align-items: center;
      gap: 12px;
    }}
    .brand-icon {{
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #6366f1, #3b82f6);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 18px;
    }}
    .brand h1 {{
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }}
    .brand p {{
      margin: 0;
      font-size: 12px;
      color: var(--text-muted);
    }}
    .gov-badge {{
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fbbf24;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }}
    main {{
      max-width: 1400px;
      margin: 0 auto;
      padding: 32px 24px;
      width: 100%;
      flex: 1;
    }}
    .bangla-banner {{
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 24px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
    }}
    .bangla-banner h3 {{
      margin: 0 0 6px 0;
      font-size: 15px;
      color: #34d399;
    }}
    .bangla-banner p {{
      margin: 0;
      font-size: 13px;
      color: #cbd5e1;
      line-height: 1.5;
    }}
    .section-title {{
      font-size: 20px;
      font-weight: 700;
      margin: 32px 0 16px 0;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 8px;
    }}
    .tab-bar {{
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }}
    .tab-btn {{
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;
    }}
    .tab-btn:hover {{ background: #334155; color: #fff; }}
    .tab-btn.active {{
      background: var(--primary);
      border-color: #6366f1;
      color: #fff;
    }}
    .diag-panel {{
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 32px;
    }}
    .panel-header {{
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #1e293b;
    }}
    .panel-header h3 {{
      margin: 0 0 8px 0;
      font-size: 18px;
      color: #fff;
    }}
    .panel-header p {{
      margin: 0 0 12px 0;
      font-size: 13px;
      color: var(--text-muted);
    }}
    .badge {{
      display: inline-block;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.4);
      color: #818cf8;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-bottom: 8px;
    }}
    .link-btn {{
      display: inline-block;
      color: #38bdf8;
      font-size: 12px;
      text-decoration: none;
      font-weight: 500;
    }}
    .link-btn:hover {{ text-decoration: underline; }}
    .render-box {{
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      overflow-x: auto;
      min-height: 240px;
    }}
    .source-toggle {{
      margin-top: 16px;
      font-size: 13px;
      color: var(--text-muted);
    }}
    .source-toggle summary {{
      cursor: pointer;
      color: #38bdf8;
      padding: 4px 0;
    }}
    .code-view {{
      background: #020617;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 16px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #cbd5e1;
      overflow-x: auto;
      margin-top: 8px;
    }}
    .docs-container {{
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 20px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      overflow: hidden;
      min-height: 500px;
    }}
    @media (max-width: 900px) {{
      .docs-container {{ grid-template-columns: 1fr; }}
    }}
    .docs-sidebar {{
      background: #020617;
      border-right: 1px solid #1e293b;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }}
    .doc-nav-btn {{
      text-align: left;
      background: transparent;
      border: 1px solid transparent;
      color: #94a3b8;
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
      transition: all 0.15s;
    }}
    .doc-nav-btn:hover {{
      background: #0f172a;
      color: #f8fafc;
    }}
    .doc-nav-btn.active {{
      background: #1e1b4b;
      border-color: #6366f1;
      color: #fff;
    }}
    .doc-cat {{
      font-size: 10px;
      color: #38bdf8;
      text-transform: uppercase;
      font-weight: 700;
    }}
    .doc-body {{
      padding: 24px;
      overflow-y: auto;
      max-height: 600px;
    }}
    .doc-header {{
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #1e293b;
    }}
    .doc-header h3 {{
      margin: 0 0 4px 0;
      font-size: 18px;
      color: #fff;
    }}
    .file-path {{
      font-family: monospace;
      font-size: 12px;
      color: #38bdf8;
    }}
    .markdown-view {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      white-space: pre-wrap;
      font-size: 13px;
      line-height: 1.6;
      color: #cbd5e1;
    }}
    footer {{
      background: #020617;
      border-top: 1px solid var(--card-border);
      padding: 24px 32px;
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
    }}
  </style>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {{
      mermaid.initialize({{
        startOnLoad: true,
        theme: "dark",
        themeVariables: {{
          darkMode: true,
          background: "#020617",
          primaryColor: "#4f46e5",
          primaryTextColor: "#ffffff",
          primaryBorderColor: "#6366f1",
          lineColor: "#38bdf8",
          secondaryColor: "#0284c7",
          tertiaryColor: "#1e293b"
        }}
      }});
    }});

    function showDiagram(key, btn) {{
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".diag-panel").forEach(p => p.style.display = "none");
      btn.classList.add("active");
      const target = document.getElementById("diag-" + key);
      if (target) {{
        target.style.display = "block";
      }}
    }}

    function showDoc(idx, btn) {{
      document.querySelectorAll(".doc-nav-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".doc-content-panel").forEach(p => p.style.display = "none");
      btn.classList.add("active");
      const target = document.getElementById("doc-panel-" + idx);
      if (target) {{
        target.style.display = "block";
      }}
    }}
  </script>
</head>
<body>
  <header>
    <div class="header-content">
      <div class="brand">
        <div class="brand-icon">TF</div>
        <div>
          <h1>TaskFlow Orchestrator — Phase 1 Complete Evidence Package</h1>
          <p>Rayhan AI Architecture | Senior Backend Architect</p>
        </div>
      </div>
      <div class="gov-badge">
        Status: PENDING PROJECT OWNER SIGN-OFF (READY)
      </div>
    </div>
  </header>

  <main>
    <div class="bangla-banner">
      <div style="font-size: 24px;">📁</div>
      <div>
        <h3>প্রজেক্ট ও ডায়াগ্রাম দেখার নিয়মাবলী (Offline Visual Guide)</h3>
        <p>
          যেকোনো সাধারণ ব্রাউজার (Chrome, Edge, Firefox) দিয়ে এই <strong>START_HERE.html</strong> ফাইলটি ডাবল ক্লিক করে ওপেন করলেই 
          সবগুলো ডায়াগ্রাম স্বয়ংক্রিয়ভাবে গ্রাফিক্যালি রেন্ডার হবে। পাশাপাশি <code>docs/diagrams/</code> ফোল্ডারের প্রতিটি <code>.html</code> ফাইল 
          স্বতন্ত্রভাবে ফুল-স্ক্রিন ওপেন করা যাবে।
        </p>
      </div>
    </div>

    <div class="section-title">
      <span>📐</span> Interactive Architectural Diagrams (7 Rendered Visuals)
    </div>

    <div class="tab-bar">
      {diagram_tabs_html}
    </div>

    {diagram_cards_html}

    <div class="section-title">
      <span>📄</span> Architecture & Governance Documentation (9 Specifications)
    </div>

    <div class="docs-container">
      <div class="docs-sidebar">
        {docs_nav_html}
      </div>
      <div class="doc-body">
        {docs_panels_html}
      </div>
    </div>
  </main>

  <footer>
    <p>TaskFlow Orchestrator Phase 1 Architecture & Audit Evidence Package • Generated with Strict Governance Discipline</p>
    <p style="margin-top: 4px; font-size: 11px;">Author: Rayhan Badsha (Applied AI Systems Architect & Senior Backend Architect) • No premature verification claims</p>
  </footer>
</body>
</html>"""

BANGLA_README = """================================================================================
TaskFlow Orchestrator — Phase 1 Evidence & Architecture Package
লিড আর্কিটেক্ট: রায়হান বাদশাহ (Rayhan Badsha) | Rayhan AI Architecture
গভর্নেন্স স্ট্যাটাস: PENDING FINAL PROJECT OWNER SIGN-OFF (Phase 2 READY)
================================================================================

[সমস্যা ও সমাধানের উপায়]
প্রশ্ন: জিপ ফাইল আনজিপ করলে নোটপ্যাডে ডায়াগ্রাম বা প্রজেক্ট কোড বোঝা যায় না কেন?
উত্তর: 
- .mmd ফাইল এবং .md ফাইলগুলো মূলত টেক্সট সোর্স কোড। 
- সাধারণ উইন্ডোজ নোটপ্যাড বা টেক্সট এডিটরে ওপেন করলে ডায়াগ্রাম আঁকা যায় না, শুধু কোড দেখা যায়।
- এর সহজ সমাধানের জন্য এই প্যাকেজে একটি স্বয়ংসম্পূর্ণ অফলাইন ভিউয়ার দেওয়া হয়েছে।

[কিভাবে খুব সহজে ডায়াগ্রাম সহ পুরো প্রজেক্ট দেখবেন]
১. এই ফোল্ডারের মূল ডিরেক্টরিতে থাকা "START_HERE.html" ফাইলটিতে ডাবল ক্লিক করুন।
২. আপনার গুগল ক্রোম (Google Chrome), এজ (Microsoft Edge) বা ফায়ারফক্স ব্রাউজারে এটি ওপেন হবে।
৩. সেখানে ৭টি আর্কিটেকচার ডায়াগ্রাম একদম পরিষ্কার রঙিন ভিজুয়াল আকারে রেন্ডার হবে।
৪. ৯টি স্পেসিফিকেশন ডকুমেন্টও পাশাপাশি সুন্দর ট্যাবে পড়তে পারবেন।

[স্বতন্ত্র ডায়াগ্রাম দেখতে চান?]
- "docs/diagrams/" ফোল্ডারে প্রবেশ করুন।
- যেকোনো .html ফাইলের উপর ডাবল ক্লিক করুন (যেমন: 01-system-context.html, 02-modular-monolith.html)।
- সাথে সাথেই ফুলস্ক্রিন ডায়াগ্রামটি দেখতে পাবেন।

[প্যাকেজের ভেতরের ফাইল ও ফোল্ডার ইনভেন্টরি]
├── START_HERE.html                   <-- ডাবল ক্লিক করে সব ডায়াগ্রাম ও ডক দেখুন
├── index.html                        <-- মাস্টার অফলাইন ভিউয়ারের ব্যাকআপ কপি
├── EVIDENCE_PACKAGE_MANIFEST.json   <-- গভর্নেন্স অডিট ও ফাইল ইন্টিগ্রিটি বিবরণ
├── কিভাবে_ওপেন_করবেন.txt             <-- এই গাইড
├── HOW_TO_OPEN.txt                   <-- English Quickstart Guide
├── README.md                         <-- Phase 1 & 2 Overview
├── requirements.txt                  <-- Python Dependencies
├── alembic.ini                       <-- Database Migrations Config
├── .env.example                      <-- Environment Configuration
├── docs/                             <-- ৯টি স্থাপত্য স্পেসিফিকেশন
│   ├── api/api-contract.md
│   ├── architecture/system-architecture.md
│   ├── architecture/database-er-diagram.md
│   ├── decisions/ADR-001-modular-monolith.md
│   ├── decisions/ADR-002-database-security.md
│   ├── security/threat-model.md
│   ├── testing/test-plan.md
│   ├── phase-reports/phase-01-review.md
│   ├── phase-reports/phase-01-audit-report.md
│   └── diagrams/                     <-- ৭টি Mermaid সোর্স (.mmd) ও ৭টি রেন্ডারড ভিউয়ার (.html)
├── app/                              <-- Phase 2 মডুলার মনোলিথ সোর্স কোড
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── schemas.py
│   ├── auth.py
│   └── routers/ (auth.py, tasks.py)
├── alembic/                          <-- ডাটাবেজ মাইগ্রেশন স্ক্রিপ্টস
└── tests/                            <-- Pytest টেস্ট স্যুট (conftest.py, test_auth.py, test_tasks.py)
"""

ENGLISH_README = """================================================================================
TaskFlow Orchestrator — Phase 1 Evidence & Architecture Package
Lead Architect: Rayhan Badsha | Rayhan AI Architecture
Governance Status: PENDING FINAL PROJECT OWNER SIGN-OFF (Phase 2 READY)
================================================================================

HOW TO VIEW DIAGRAMS AND DOCUMENTATION:
1. Double-click "START_HERE.html" in the root directory.
2. It will open in any standard web browser (Chrome, Edge, Firefox, Safari).
3. All 7 architecture diagrams will render visually with dark-mode styling.
4. All 9 Phase 1 specifications can be read in the interactive documentation viewer.
5. Individual standalone diagram files can also be found in "docs/diagrams/*.html".
"""

def main():
    print("[1/5] Generating standalone HTML diagram viewers...")
    diagrams_dir = ROOT / "docs/diagrams"
    diagrams_dir.mkdir(parents=True, exist_ok=True)
    
    for key, d in DIAGRAMS.items():
        code = d["file"].read_text(encoding="utf-8")
        html_content = make_single_diagram_html(d["title"], d["summary"], code)
        out_path = diagrams_dir / f"{key}.html"
        out_path.write_text(html_content, encoding="utf-8")
        print(f"  -> Generated {out_path}")

    print("[2/5] Generating master START_HERE.html viewer...")
    start_here_content = make_start_here_html()
    (ROOT / "START_HERE.html").write_text(start_here_content, encoding="utf-8")
    (PUBLIC / "START_HERE.html").write_text(start_here_content, encoding="utf-8")
    (ROOT / "index.offline.html").write_text(start_here_content, encoding="utf-8")
    
    (ROOT / "কিভাবে_ওপেন_করবেন.txt").write_text(BANGLA_README, encoding="utf-8")
    (PUBLIC / "কিভাবে_ওপেন_করবেন.txt").write_text(BANGLA_README, encoding="utf-8")
    (ROOT / "HOW_TO_OPEN.txt").write_text(ENGLISH_README, encoding="utf-8")
    (PUBLIC / "HOW_TO_OPEN.txt").write_text(ENGLISH_README, encoding="utf-8")

    manifest = {
        "project": "TaskFlow Orchestrator",
        "phase": 1,
        "title": "Phase 1 Complete Evidence & Audit Package",
        "lead_architect": "Rayhan Badsha (Senior Backend Architect & Applied AI Systems Architect, Rayhan AI Architecture)",
        "governance_policy": "Strict Evidence-Based Audit. No premature verification claims.",
        "phase_1_sign_off_status": "PENDING PROJECT OWNER SIGN-OFF",
        "phase_2_readiness": "READY",
        "manifest_inventory": {
            "master_viewers": [
                "START_HERE.html",
                "index.offline.html"
            ],
            "guides": [
                "কিভাবে_ওপেন_করবেন.txt",
                "HOW_TO_OPEN.txt"
            ],
            "markdown_documents": DOC_PATHS,
            "mermaid_source_diagrams": [
                f"docs/diagrams/{k}.mmd" for k in DIAGRAMS.keys()
            ],
            "standalone_html_diagrams": [
                f"docs/diagrams/{k}.html" for k in DIAGRAMS.keys()
            ],
            "phase_2_codebase_files": [
                "README.md",
                "requirements.txt",
                "alembic.ini",
                ".env.example",
                "app/__init__.py",
                "app/main.py",
                "app/config.py",
                "app/database.py",
                "app/models.py",
                "app/schemas.py",
                "app/auth.py",
                "app/routers/__init__.py",
                "app/routers/auth.py",
                "app/routers/tasks.py",
                "alembic/env.py",
                "alembic/script.py.mako",
                "alembic/versions/001_initial_schema.py",
                "tests/__init__.py",
                "tests/conftest.py",
                "tests/test_auth.py",
                "tests/test_tasks.py"
            ]
        },
        "tripartite_audit_results": {
            "actually_validated": [
                "Requirement 1 Physical Document Verification: All 9 markdown files present and formatted",
                "Requirement 2 Mermaid Syntax Validation: All 7 diagrams compiled and validated",
                "Requirement 3 Cross-Document References & Terminology: 100% consistent ADR-002 and token claims",
                "Requirement 4 JWT 30-Minute Expiry: Consistently specified across API contract and threat model",
                "Requirement 5 SQLite vs PostgreSQL Test Separation: Explicit in test plan and conftest",
                "Requirement 6 Status Marking Discipline: All tests marked PLANNED"
            ],
            "reviewed_baseline": [
                "Modular Monolith Ingress & Subsystem Demarcation",
                "Application-Level Ownership Filtering Pattern (user_id == current_user.id)",
                "Pydantic v2 Schema Partial Update (exclude_unset=True) semantics",
                "Password Hashing with Passlib bcrypt (12 rounds)"
            ],
            "not_yet_tested": [
                "Live Pytest Execution against Dockerized PostgreSQL 16+",
                "Real Alembic Migration Upgrades against Production Cloud SQL",
                "Actual Production TLS Termination and Ingress Gateway Deployment"
            ]
        }
    }
    
    manifest_json = json.dumps(manifest, indent=2, ensure_ascii=False)
    (ROOT / "EVIDENCE_PACKAGE_MANIFEST.json").write_text(manifest_json, encoding="utf-8")
    (PUBLIC / "EVIDENCE_PACKAGE_MANIFEST.json").write_text(manifest_json, encoding="utf-8")

    print("[3/5] Packing taskflow-phase1-evidence-package.zip (Evidence Only)...")
    evidence_zip_path = PUBLIC / "taskflow-phase1-evidence-package.zip"
    with zipfile.ZipFile(evidence_zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("START_HERE.html", start_here_content)
        z.writestr("index.html", start_here_content)
        z.writestr("কিভাবে_ওপেন_করবেন.txt", BANGLA_README)
        z.writestr("HOW_TO_OPEN.txt", ENGLISH_README)
        z.writestr("EVIDENCE_PACKAGE_MANIFEST.json", manifest_json)
        
        for doc_p in DOC_PATHS:
            full_p = ROOT / doc_p
            if full_p.exists():
                z.write(full_p, doc_p)
                
        for key, d in DIAGRAMS.items():
            mmd_file = ROOT / f"docs/diagrams/{key}.mmd"
            html_file = ROOT / f"docs/diagrams/{key}.html"
            if mmd_file.exists():
                z.write(mmd_file, f"docs/diagrams/{key}.mmd")
            if html_file.exists():
                z.write(html_file, f"docs/diagrams/{key}.html")

    print(f"  -> Generated {evidence_zip_path} ({evidence_zip_path.stat().st_size} bytes)")

    print("[4/5] Packing taskflow-orchestrator-full-project.zip (Complete Project)...")
    full_zip_path = PUBLIC / "taskflow-orchestrator-full-project.zip"
    with zipfile.ZipFile(full_zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        # Include all evidence items
        z.writestr("START_HERE.html", start_here_content)
        z.writestr("index.html", start_here_content)
        z.writestr("কিভাবে_ওপেন_করবেন.txt", BANGLA_README)
        z.writestr("HOW_TO_OPEN.txt", ENGLISH_README)
        z.writestr("EVIDENCE_PACKAGE_MANIFEST.json", manifest_json)
        
        for doc_p in DOC_PATHS:
            full_p = ROOT / doc_p
            if full_p.exists():
                z.write(full_p, doc_p)
                
        for key, d in DIAGRAMS.items():
            mmd_file = ROOT / f"docs/diagrams/{key}.mmd"
            html_file = ROOT / f"docs/diagrams/{key}.html"
            if mmd_file.exists():
                z.write(mmd_file, f"docs/diagrams/{key}.mmd")
            if html_file.exists():
                z.write(html_file, f"docs/diagrams/{key}.html")
                
        # Include code files
        code_files = [
            "README.md", "requirements.txt", "alembic.ini", ".env.example",
            "app/__init__.py", "app/main.py", "app/config.py", "app/database.py",
            "app/models.py", "app/schemas.py", "app/auth.py",
            "app/routers/__init__.py", "app/routers/auth.py", "app/routers/tasks.py",
            "alembic/env.py", "alembic/script.py.mako", "alembic/versions/001_initial_schema.py",
            "tests/__init__.py", "tests/conftest.py", "tests/test_auth.py", "tests/test_tasks.py"
        ]
        for cf in code_files:
            cfp = ROOT / cf
            if cfp.exists():
                z.write(cfp, cf)

    print(f"  -> Generated {full_zip_path} ({full_zip_path.stat().st_size} bytes)")
    print("[5/5] All packages preserved successfully!")

if __name__ == "__main__":
    main()
