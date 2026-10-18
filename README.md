# OpenMemory

> **Zero-Dependency Operational Memory & Stage Governance Framework for OpenCode and AI Developer Agents**

[![Release Status](https://img.shields.io/badge/Release%20Status-Consumer--Ready%20Verified-blue.svg)](#-release-status)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.3.2-informational.svg)](package.json)

---

## 📌 Release Status

* **OpenMemory Version:** `0.3.2`
* **Status:** `Consumer-Ready Verified`
* **Packaged Artifact:** `openmemory-0.3.2.tgz`
* **Target Environment:** OpenCode 1.18.34, Node.js v22.15.0+, local Git repositories.

OpenMemory v0.3.2 has completed formal empirical end-to-end release verification in clean consumer laboratories (`OpenMemory-v0.3.1-Release-Lab`) using the compiled release tarball (`openmemory-0.3.2.tgz`).

---

## 💡 What OpenMemory Is

OpenMemory is a host-independent, zero-dependency local operational memory, session continuity, research knowledge, ADR tracking, and stage governance framework for AI coding assistants.

It provides:
* **Persistent Memory Layer:** Local repository state persistence across agent session resets and context compactions.
* **Project Continuity Layer:** Structured narrative handoffs (`.openmemory/handoff.md`) preserving active goals, phase progress, and uncommitted work.
* **Knowledge & Evidence Persistence Layer:** Synthesized research knowledge (`KnowledgeTMS`) and architectural decisions (`ADRGovernance`) recorded with provenance metadata.
* **Governance & Context Infrastructure:** 12-phase Master Prompt state machine (`StageEngine`) enforcing Definition of Done (DoD) criteria and human approval gates.
* **Host Independence:** Runs locally in standard Node.js environments without requiring custom IDE daemons, proprietary extensions, or cloud dependencies.

---

## 🎯 Problem OpenMemory Solves

When developing software using AI agents (such as OpenCode or Cursor):
1. **Context Loss on Compaction:** When LLM context windows fill up and compact, crucial architectural decisions, uncommitted task context, and active goals are lost.
2. **Session Discontinuity:** Starting a new chat session wipes out past progress summary and forces developers to re-explain project state manually.
3. **Uncoordinated Multi-Agent Work:** Simultaneous or sequential agent executions risk overwriting files or ignoring past decisions.
4. **Lack of Stage Governance:** Agents frequently attempt premature implementation before completing discovery or architecture design phases.

OpenMemory solves these problems by providing an automated, zero-dependency local storage engine and adapter suite that manages repository memory and stage governance directly on disk.

---

## 🛑 What OpenMemory Is NOT

To maintain clear architectural boundaries, OpenMemory is explicitly **NOT**:
* **NOT Another Agent or Orchestrator:** OpenMemory does not execute code, call LLM models directly, or make autonomous planning decisions.
* **NOT a Replacement for OpenCode or ADA:** OpenMemory is context and state infrastructure *for* OpenCode/ADA, not a competitor.
* **NOT a Vector Database by Default:** OpenMemory uses zero-dependency local JSON/Markdown disk files, avoiding external vector databases or native C++ binaries.
* **NOT a Microservices Architecture:** Runs embedded in process within the Node.js runtime.
* **NOT a Hard OS Sandbox:** Stage governance enforces prompt and protocol soft boundaries (`canModifyProductionCode()`). Hard file write permissions remain host IDE policies.
* **NOT a Transcript Replay Engine:** OpenMemory stores structured project state and synthesized knowledge, not raw line-by-line conversation transcripts.

---

## 🏗️ Architecture & Component Overview

```text
Host / Agent (OpenCode 1.18.34, Cursor, CLI)
  ↓
Adapters (CLI | MCP Server | OpenCode Plugin)
  ↓
StageEngine (12-Phase Master Prompt State Machine)
  ↓
StorageEngine Facade (Single Writer Architecture)
  ↓
Domain Authorities (Sessions, TaskDAG, ADRs, Knowledge, Handoff)
  ↓
PersistenceEngine (Atomic writes & Advisory Lock Manager)
  ↓
.openmemory/ Local Disk Storage
```

### Core Components
1. **`StorageEngine` Facade:** Unified Single Writer authority managing atomic disk writes, locks, backups, and state queries.
2. **`StageEngine` & Master Prompt:** Operational state machine defining 12 project phases (`DESCUBRIR`, `DEFINIR`, `INVESTIGAR`, `COMPARAR`, `DISEÑAR`, `PLANIFICAR`, `IMPLEMENTAR`, `VALIDAR`, `EVALUAR`, `CONSOLIDAR`, `ACTUALIZAR_MEMORIA`, `PREPARAR_CONTINUIDAD`).
3. **`SessionRegistry`:** Persistent registry tracking agent sessions, active statuses (`ACTIVE`, `IDLE`, `COMPACTED`, `COMPLETED`, `ABORTED`), and inactivity reconciliation.
4. **`TaskDAG`:** Multi-agent coordination task manager supporting task dependencies, atomic claims, and status updates.
5. **`ADRGovernance`:** MADR Architecture Decision Record authority with multi-agent voting consensus and explicit supersession.
6. **`KnowledgeTMS`:** Research knowledge repository storing synthesized findings with provenance metadata and query filters.
7. **`HandoffContinuity`:** Generates structured `.openmemory/handoff.md` narrative summaries.

---

## 🔄 Lifecycle & Session Model

OpenMemory synchronizes natively with OpenCode's session lifecycle event stream:

| Event / Hook | Target Action in OpenMemory |
| :--- | :--- |
| `session.created` | Registers active session record in `SessionRegistry` and updates `project-state.json`. |
| `session.status` | Synchronizes active session state (`ACTIVE` / `IDLE`), ignoring terminal states. |
| `session.idle` | Saves checkpoint to `project-state.json` and updates `.openmemory/handoff.md`. |
| `session.compacted` | Records compaction milestone and appends handoff narrative context. |
| `session.updated` | Refreshes `lastActiveAt` timestamp for active session tracking. |
| `session.deleted` | Logs telemetry event safely without mutating logical session state. |
| `session.error` | Logs error telemetry safely without mutating logical session state. |
| `experimental.chat.system.transform` | Injects Stage Engine governance and Knowledge Index into system prompt. |
| `experimental.session.compacting` | Appends handoff narrative and stage state to compaction context. |
| `dispose` | Logs plugin disposition telemetry on process exit. |

---

## 💾 Storage & Project State Structure

When installed in a consumer repository, OpenMemory initializes the following directory structure:

```text
my-project/
├── .openmemory/
│   ├── openmemory.json        # Manifest configuration
│   ├── project-state.json     # Global state index (stage, goal, sessions, roadmap)
│   ├── handoff.md             # Active cross-session narrative handoff
│   ├── adrs/                  # Architectural Decision Records (MADR format)
│   ├── knowledge/             # Indexed research knowledge JSON files
│   ├── logs/
│   │   └── events.jsonl       # Append-only structured event telemetry stream
│   ├── locks/                 # Temporary process advisory locks
│   └── backups/               # Atomic snapshot backups
├── .opencode/
│   └── plugins/
│       └── openmemory.ts      # OpenCode local plugin shim
├── opencode.json              # Configured MCP server definition
└── AGENTS.md                  # Delimited OpenMemory pointer block
```

---

## ⚖️ Conflict Governance & Context Assembly

When research knowledge or ADR proposals conflict with existing repository records:
1. **Contradiction Detection:** OpenMemory flags conflicting items with a `CONFLICTED` state.
2. **Safety Exclusion (`EXCLUDE_BOTH`):** Both conflicting items are temporarily excluded from system prompt context assembly to prevent LLM hallucinations.
3. **Governance Alert:** OpenMemory issues a governance notification requesting human intervention or formal ADR voting.
4. **Explicit Supersession:** When resolved, the old record is updated to `SUPERSEDED` and linked to the new authoritative record.

---

## 🚀 Installation & Distribution Modes

OpenMemory supports three distinct installation methods depending on your environment:

### Mode A: Published Package (npm)

Install from npm in your target consumer project:

```bash
npm install openmemory
npx openmemory install
```

### Mode B: Packaged Tarball (`openmemory-0.3.2.tgz`)

Install directly from the compiled release tarball:

```bash
npm install ./path/to/openmemory-0.3.1.tgz
npx openmemory install
```

### Mode C: Source Repository Development

Clone and compile from source:

```bash
git clone https://github.com/Blueisazul/OpenMemory.git
cd OpenMemory
npm install
npm run build
npm pack
```

### Consumer Setup & Teardown Commands

#### 1. Setup Integration (`npx openmemory install`)

Runs the non-destructive consumer installer:
```bash
npx openmemory install [--interactive | -i]
```

This command automatically:
* Initializes `.openmemory/` storage structure.
* Injects pointer blocks into `AGENTS.md`.
* Deploys `.opencode/plugins/openmemory.ts` plugin shim.
* Configures `opencode.json` with the OpenMemory STDIO MCP server.

#### 2. Revert Integration (`npx openmemory uninstall`)

To remove integration shims while preserving historical project memory:
```bash
npx openmemory uninstall
```

This command removes `.opencode/plugins/openmemory.ts`, cleans `opencode.json`, and removes the `AGENTS.md` block while keeping `.openmemory/` historical data completely intact.

---

## 💻 CLI Command Reference

The `openmemory` CLI supports 23 command groups and subcommands:

```bash
# --- Core Status & Stage Governance ---
npx openmemory status                         # View context summary & stage status
npx openmemory stage                          # Inspect Stage Engine state & code mutation permissions
npx openmemory approve [notes]                # Approve current stage transition (Human Gate)
npx openmemory report                         # View current phase report & DoD details
npx openmemory roadmap                        # View complete project roadmap JSON
npx openmemory phase                          # View active phase
npx openmemory phase approve <phaseId>        # Approve roadmap phase advancement
npx openmemory phase reject <phaseId> [reason]# Reject roadmap phase advancement

# --- Integration & Lifecycle ---
npx openmemory install [--interactive | -i]   # Non-destructive consumer setup
npx openmemory uninstall                      # Revert shims, preserve .openmemory/ data

# --- Backup & Disaster Recovery ---
npx openmemory backup [label]                 # Create atomic snapshot backup
npx openmemory list-backups                   # List available snapshot backups
npx openmemory restore <backup-id>           # Restore state from backup snapshot

# --- Diagnostics & Maintenance ---
npx openmemory diagnostics                   # Run storage health checks & auto-heal
npx openmemory cleanup                       # Remove orphaned temporary files
npx openmemory locks cleanup                 # Clean stale advisory locks
npx openmemory logs rotate [--max-size B]    # Rotate event telemetry logs

# --- Knowledge & ADR Management ---
npx openmemory query [--query Q] [--category C] [--type T] [--json] # Search research knowledge
npx openmemory record --topic T --summary S --agent-id A --session-id S # Record research knowledge
npx openmemory adr list                      # List Architecture Decision Records
npx openmemory adr vote --id ID --vote APPROVE|REJECT --agent-id A --session-id S # Vote on ADR
npx openmemory oss                           # List Open Source Software evaluations

# --- Multi-Agent Sessions & Tasks ---
npx openmemory sessions list [--agent-id A] [--status S] # List agent sessions
npx openmemory sessions register --agent-id A [--id ID] # Register session
npx openmemory sessions reconcile --threshold-hours 24 --confirm # Reconcile stale sessions
npx openmemory context assemble [agentId] [--query Q]   # Assemble cross-agent context
npx openmemory task list [--status S]        # List multi-agent coordination tasks
npx openmemory task create --title T --created-by A     # Create coordination task
npx openmemory task claim --id ID --agent-id A --session-id S # Atomically claim task
npx openmemory task update --id ID --status S --agent-id A --session-id S # Update task status

# --- System ---
npx openmemory migrate [--dry-run] [--rollback ID]     # Run schema migrations
```

---

## 🔌 Model Context Protocol (MCP) Tools

OpenMemory exposes **29 MCP tools** over STDIO when configured in OpenCode, Cursor, or Claude Desktop:

| Category | Tools | Description |
| :--- | :--- | :--- |
| **Status & Handoff** | `openmemory_status`<br>`openmemory_get_handoff` | Query project context summary & narrative handoff |
| **Stage & Roadmap Governance** | `openmemory_get_stage`<br>`openmemory_start_stage`<br>`openmemory_complete_stage`<br>`openmemory_request_approval`<br>`openmemory_approve_stage`<br>`openmemory_reject_stage`<br>`openmemory_get_phase_report`<br>`openmemory_get_roadmap`<br>`openmemory_approve_phase`<br>`openmemory_reject_phase` | Manage 12-phase Master Prompt state machine, roadmap phases, DoD verification, and human gates |
| **Research Knowledge TMS** | `openmemory_record_knowledge`<br>`openmemory_query_knowledge` | Record & query synthesized research knowledge with provenance metadata |
| **ADR Governance** | `openmemory_save_adr`<br>`openmemory_vote_adr` | Create MADR decision records & cast multi-agent consensus votes |
| **OSS Evaluation** | `openmemory_save_oss_evaluation` | Record OSS build-vs-buy evaluation matrices |
| **Session Registry & Reconciliation** | `openmemory_register_session`<br>`openmemory_list_sessions`<br>`openmemory_reconcile_sessions` | Register agent sessions, list sessions, and reconcile stale active sessions |
| **Context Assembly** | `openmemory_assemble_cross_context` | Synthesize cross-agent context summary with relevance scoring |
| **Multi-Agent Task DAG** | `openmemory_create_coordination_task`<br>`openmemory_list_coordination_tasks`<br>`openmemory_claim_coordination_task`<br>`openmemory_update_coordination_task` | Manage multi-agent task coordination graphs, atomic task claims, and status updates |
| **Storage Admin & Maintenance** | `openmemory_cleanup_locks`<br>`openmemory_create_backup`<br>`openmemory_run_diagnostics`<br>`openmemory_rotate_event_logs` | Clean advisory locks, create backups, run health checks, and rotate event logs |

---

## ⚠️ Known Limitations

1. **Local Repository Scope:** OpenMemory v0.3.2 stores memory locally within `.openmemory/`. Remote multi-repository cloud sync is deferred to future releases.
2. **Process Concurrency Boundaries:** Advisory file locks protect concurrent local processes on the same machine. High-frequency network-distributed multi-region writes require a centralized database.
3. **Soft Governance Boundaries:** Stage governance enforces rules via prompt engineering and protocol responses. File system write permissions depend on the host IDE.

---

## 📜 Documentation Index

* [Documentary Audit Report (`docs/AUDIT-DOCUMENTATION-0.3.1.md`)](docs/AUDIT-DOCUMENTATION-0.3.1.md)
* [v0.3.1 Validation & Release Report (`docs/VALIDATION-0.3.1.md`)](docs/VALIDATION-0.3.1.md)
* [v0.3.0 Historical Validation Report (`docs/VALIDATION-0.3.0.md`)](docs/VALIDATION-0.3.0.md)
* [Architecture Overview (`docs/ARCHITECTURE.md`)](docs/ARCHITECTURE.md)
* [Conceptual & Domain Contracts (`docs/CONTRACTS.md`)](docs/CONTRACTS.md)
* [Changelog (`CHANGELOG.md`)](CHANGELOG.md)

---

## 📄 License

[MIT License](LICENSE) © 2026 OpenMemory Contributors
