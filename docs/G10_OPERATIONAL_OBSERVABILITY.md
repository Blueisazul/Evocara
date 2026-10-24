# OpenMemory G10 Operational Observability & MCP Diagnostics Specification

## 1. Executive Summary

The **G10 Operational Observability** subsystem provides OpenMemory with unified, zero-overhead, real-time operational visibility. It exposes a consolidated health model across all core subsystems (storage integrity, SQLite lifecycle, advisory locks, periodic health coordinator, promotion transactions, and release candidate artifacts), accessible through both the CLI (`openmemory health`) and Model Context Protocol (MCP) server tools.

---

## 2. Consolidated Operational Health Model

The consolidated model integrates multiple diagnostic and operational inputs into a single structured report governed by deterministic severity transitions:

```
[Storage Diagnostics] ──┐
[SQLite Quiescence]   ──┼──>  ConsolidatedHealthReport  ──>  overallStatus:
[Advisory Locks]       ──┤                                      - HEALTHY
[Health Coordinator]  ──┤                                      - DEGRADED
[Promotion State]     ──┤                                      - CORRUPTED
[Candidate Artifact]  ──┘                                      - UNKNOWN
```

### 2.1 Severity Level Determinism

| Level | Criteria / Triggers | Operational Meaning |
| :--- | :--- | :--- |
| `HEALTHY` | All storage files valid, 0 torn log lines, SQLite fully quiescent (0 WAL/SHM active), 0 dead locks, 0 interrupted promotions, candidate valid. | System is in normal, non-degraded operating condition. |
| `DEGRADED` | Active SQLite WAL/SHM (unconsolidated transactions), stale advisory locks from live or unknown PIDs, or health coordinator execution skips. | Non-corrupt transient state. Operations succeed, but maintenance/checkpointing is advised. |
| `CORRUPTED` | Critical storage failure (invalid JSON in manifest, project state, task graph, ADRs), dead-process advisory locks (`pidDead === true`), torn telemetry log lines, or uncommitted interrupted promotion transaction (`APPLYING`, `SMOKE_TESTING`, etc.). | System integrity is compromised or in inconsistent transactional state. Immediate auto-repair or `--recover` required. |
| `UNKNOWN` | Subsystem diagnostic threw an unhandled exception or storage directory is unreadable. | Operational state cannot be determined safely. |

---

## 3. Storage Engine API: `getConsolidatedHealthSummary`

Exported by `StorageEngine.prototype.getConsolidatedHealthSummary(options?: { rootDir?: string })`:

```typescript
export interface ConsolidatedHealthReport {
  overallStatus: HealthSeverity; // "HEALTHY" | "DEGRADED" | "CORRUPTED" | "UNKNOWN"
  timestamp: string;
  storage: {
    status: DiagnosticStatus;
    orphanedTempFilesRemoved: number;
    subsystems?: Record<string, { status: "PASS" | "WARN" | "FAIL"; checksCount: number }>;
  };
  sqliteLifecycle: {
    quiescent: boolean;
    managedCount: number;
    activeDatabases: string[];
  };
  advisoryLocks: {
    total: number;
    active: number;
    stale: number;
    deadProcessLocks: number;
  };
  healthCoordinator: {
    running: boolean;
    enabled: boolean;
    intervalMs: number;
    lastExecutionAt?: string;
    totalExecutions: number;
    totalFailures: number;
    totalSkippedDueToOverlap: number;
  };
  promotion: {
    isInterrupted: boolean;
    lastOperationId?: string;
    lastState?: string;
    lastCommittedAt?: string;
  };
  candidateArtifact: {
    version: string;
    present: boolean;
    sha256?: string;
    sizeBytes?: number;
  };
}
```

---

## 4. MCP Tools Registry (G10 Extended)

The MCP server exposes 6 dedicated read-only and maintenance tools conforming to `@modelcontextprotocol/sdk`:

### 4.1 `openmemory_health_summary`
- **Description**: Returns consolidated health report across storage, SQLite, locks, coordinator, and candidate artifact.
- **Parameters**: `rootDir` (optional string).
- **Semantics**: Strictly read-only (`repair: false`).

### 4.2 `openmemory_diagnostics_detail`
- **Description**: Returns detailed breakdown of all 11 storage subsystem checks (Manifest, Project State, Handoff, ADRs, TMS, Sessions, Task Graph, Advisory Locks, Event Logs, SQLite Quiescence, Disaster Recovery).
- **Parameters**: `rootDir` (optional string).
- **Semantics**: Strictly read-only (`repair: false`).

### 4.3 `openmemory_inspect_locks`
- **Description**: Inspects all active, stale, and dead-process file advisory locks.
- **Security Policy**: Sensitive lock tokens are masked with prefix (`tok_abc123...`) to prevent credential/token leakage over JSON-RPC.

### 4.4 `openmemory_promotion_status`
- **Description**: Inspects transaction state of consumer deployment (`operation_manifest.json`), detecting interrupted states (`APPLYING`, `SMOKE_TESTING`, `ROLLING_BACK`).
- **Parameters**: `consumerPath` (optional string).

### 4.5 `openmemory_candidate_integrity`
- **Description**: Verifies presence, file size (184,295 bytes), and SHA-256 (`8b3df7e15222cfcce93d33044efc817e2c10564aa996af389a9603b66595d716`) of the candidate tarball.
- **Parameters**: `tarballPath` (optional string, defaults to `.work/artifacts/openmemory-0.3.15-rc1.tgz`).

### 4.6 `openmemory_sqlite_checkpoint`
- **Description**: Explicit checkpoint action (`PRAGMA wal_checkpoint(TRUNCATE)`) on a managed or workspace database.
- **Parameters**: `dbPath` (string), `mode` (string: `"TRUNCATE"` | `"FULL"` | `"PASSIVE"` | `"RESTART"`).

---

## 5. Security & Isolation Guarantees

1. **Read-Only Invariant**: All diagnostics tools run with `repair: false` when called via health or diagnostics queries.
2. **Token Masking**: Raw cryptographic lock tokens (`token` field) are never transmitted in cleartext.
3. **Fail-Safe Crash Immunity**: In accordance with Test 7 (`MCP tools return isError: true without throwing or crashing host process`), unexpected errors return formatted JSON errors (`isError: true` or `{ error: ... }`) instead of unhandled promise rejections that could crash host agents.
4. **Zero SQLite File Deletion**: No direct unlinking of `-wal` or `-shm` files; all quiescence is achieved strictly through native SQLite WAL checkpointing.

---

## 6. Verification Evidence

The test suite `G10-OBSERVABILITY` (`.work/experiments/test-g10-observability-mcp.js`) executes 7 deterministic tests:
- `[PASS]` Consolidated health summary transitions (HEALTHY, DEGRADED, CORRUPTED).
- `[PASS]` Tool discovery in `tools/list`.
- `[PASS]` `openmemory_health_summary` structured output.
- `[PASS]` Token sanitization in `openmemory_inspect_locks`.
- `[PASS]` Interrupted promotion detection in `openmemory_promotion_status`.
- `[PASS]` Candidate SHA-256 verification in `openmemory_candidate_integrity`.
- `[PASS]` Host crash immunity on corrupted/missing input.
