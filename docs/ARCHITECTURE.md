# OpenMemory Architecture (v0.3.2)

> **Status:** Consumer-Ready Verified<br>
> **Package Version:** `0.3.2`<br>
> **License:** MIT

OpenMemory is a host-independent, zero-dependency operational memory and stage governance framework designed for OpenCode, AI developer agents, and multi-agent workflows.

---

## 🏛️ High-Level System Architecture

```text
               Host / Client Application
        (OpenCode 1.18.34, Cursor, CLI, IDEs)
                         │
                         ▼
        ┌────────────────────────────────┐
        │       Integration Adapters     │
        ├────────────┬───────────┬───────┤
        │ CLI Engine │ MCP Server│ Plugin│
        │(cli.js)    │ (mcp.js)  │(plg.js│
        └─────┬──────┴─────┬─────┴───┬───┘
              │            │         │
              └────────────┼─────────┘
                           ▼
        ┌────────────────────────────────┐
        │          StageEngine           │
        │ (12-Phase Stage Governance)    │
        └────────────────┬───────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │     StorageEngine Facade       │
        │    (Single Writer Authority)   │
        └────────────────┬───────────────┘
                         │
          ┌──────────────┼──────────────┬──────────────┬──────────────┐
          ▼              ▼              ▼              ▼              ▼
   ┌─────────────┐┌─────────────┐┌─────────────┐┌─────────────┐┌─────────────┐
   │ Session     ││ Task DAG    ││ ADR         ││ Knowledge   ││ Handoff     │
   │ Registry    ││ Coordination││ Governance  ││ TMS         ││ Continuity  │
   └──────┬──────┘└──────┬──────┘└──────┬──────┘└──────┬──────┘└──────┬──────┘
          │              │              │              │              │
          └──────────────┴──────┬───────┴──────────────┴──────────────┘
                                ▼
        ┌─────────────────────────────────────────────────────────────┐
        │                   Core Persistence                          │
        ├──────────────────────────────┬──────────────────────────────┤
        │      PersistenceEngine       │         EventLogger          │
        │(Atomic writes, Lock Manager) │ (Append-only JSONL Stream)   │
        └──────────────────────────────┴──────────────────────────────┘
                                │
                                ▼
        ┌─────────────────────────────────────────────────────────────┐
        │                   .openmemory/ Disk Storage                 │
        │ project-state.json │ handoff.md │ adrs/ │ knowledge/ │ logs/ │
        └─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Core Architectural Invariants

### 1. Host Independence
OpenMemory executes within standard Node.js runtimes without requiring proprietary IDE extensions, global system daemons, or OS-level hypervisors. All state is maintained locally within the repository's `.openmemory/` directory.

### 2. Single Writer Architecture
To guarantee state consistency during concurrent multi-agent executions, all write mutations pass through the `StorageEngine` facade. Advisory file locks (`.openmemory/locks/`) with TTL auto-expiration provide process concurrency protection.

### 3. Atomic Disk Persistence
All file writes in `PersistenceEngine` utilize atomic write-then-rename operations (`.tmp.[pid].[timestamp]` -> target path). This guarantees that crash-recovers or abrupt process kills never result in partial or corrupt state files.

### 4. Adapter Isolation
Integration adapters (`CLI`, `MCP Server`, `OpenCode Plugin`) contain zero business state. They act strictly as transport translators between host protocols and the underlying `StageEngine` and `StorageEngine`.

### 5. Soft Governance Boundary vs Hard OS Sandbox
`StageEngine` provides protocol-level and prompt-level soft governance (e.g., restricting production code edits until validation phases). OpenMemory does **not** act as a hardware sandbox; system write permissions and terminal isolation remain host IDE responsibilities.

---

## 🧩 Component Breakdown

### Integration Adapters (`src/`)
* **`cli.ts` (`npx openmemory`):** Terminal entrypoint supporting workspace initialization (`install`), uninstallation (`uninstall`), status diagnostics, backups, sessions, tasks, ADRs, knowledge, logs, and migrations (23 command groups).
* **`plugin.ts` (`openmemory/plugin`):** OpenCode lifecycle adapter. Hooks into 10 event/transformation channels (`session.created`, `session.status`, `session.idle`, `session.compacted`, `session.updated`, `session.deleted`, `session.error`, `experimental.chat.system.transform`, `experimental.session.compacting`, `dispose`).
* **`mcp.ts` (`openmemory/mcp`):** Model Context Protocol STDIO server exposing 29 operational tools for status inspection, roadmap governance, ADR voting, knowledge recording/querying, task DAG coordination, session reconciliation, and storage administration.
* **`installer.ts` (`openmemory/installer`):** Non-destructive consumer installer. Deploys local shims, configures `opencode.json`, and manages delimited pointer blocks in `AGENTS.md`.

### Core Engine & Domains (`src/storage/`)
* **`storage.ts`:** Unified `StorageEngine` facade exposing atomic methods for state management, diagnostics, and context summary formatting.
* **`stage-engine.ts` & `master-prompt.ts`:** 12-phase operational state machine enforcing DoD criteria and human approval gates (`DESCUBRIR` -> `PREPARAR_CONTINUIDAD`).
* **`domains/session-registry.ts`:** Manages agent session lifecycles, active session tracking, identity resolution, and stale session reconciliation.
* **`domains/task-dag.ts`:** Multi-agent task registry supporting dependency graphs (DAG), atomic task claims, and status updates.
* **`domains/adr-governance.ts`:** MADR decision tracking with voting consensus, status transitions (`PROPOSED` -> `ACCEPTED` / `REJECTED`), and explicit supersession.
* **`domains/knowledge-tms.ts`:** Synthesized research knowledge storage with category filters, provenance metadata, keyword queries, and conflict governance.
* **`domains/handoff-continuity.ts`:** Cross-session narrative handoff generator (`.openmemory/handoff.md`).

---

## 🚫 Non-Breakable Boundaries

1. **Zero Core Modifications to Host:** OpenMemory MUST NOT modify OpenCode core binaries or internal runtime files.
2. **No Automatic Truth Resolution:** Contradictory knowledge items MUST trigger a `CONFLICTED` state requiring explicit resolution or voting rather than silent overwriting.
3. **Storage Preservation:** Running `npx openmemory uninstall` MUST revert configuration shims and pointers while preserving `.openmemory/` historical data intact.
