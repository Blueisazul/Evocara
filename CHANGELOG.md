# Changelog

All notable changes to OpenMemory are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.2] - 2026-10-09

### Fixed
* **MCP Knowledge Query `summary` Robustness**: Added defensive check (`res.summary ? String(res.summary).toLowerCase().includes(queryText) : false`) in `src/mcp.ts`, `src/cli.ts`, and `src/storage.ts` when filtering knowledge items by query text. Prevents `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` when stored knowledge records omit the optional `summary` field.

## [0.3.1] - 2026-10-05

### Release Status
**Consumer-Ready Verified** (`openmemory-0.3.1.tgz`)

### Added
* **Lab & Empirical Validation Suite:**
  * End-to-end v0.3.1 release lab test suite (`.work/experiments/run-v031-release-lab.ts`) validating package resolution, non-destructive installation, OpenCode plugin hooks, MCP STDIO lifecycle, process restart persistence, and clean uninstallation against `openmemory-0.3.1.tgz`.
  * Contract closure and clean consumer lab test suites (`.work/experiments/run-v030-contract-closure-tests.ts` and `run-consumer-lab-validation.ts`).
  * Formal technical audit and release validation documentation (`docs/AUDIT-DOCUMENTATION-0.3.1.md` and `docs/VALIDATION-0.3.1.md`).

### Fixed
* **Plugin & Stage Engine Integration:**
  * Fixed `autoHandoffOnIdle` handling in `session.idle` hook in `src/plugin.ts` to properly resolve `activePhase` and prevent fallback issues.
  * Fixed fallback resolution in `StorageEngine.getOrInitHandoff()` to prevent rendering `Active Phase: undefined` or `undefined` in `.openmemory/handoff.md` and system prompt contexts.
  * Enforced terminal session state immutability (`COMPLETED`, `FAILED`, `ABORTED`) when processing `session.status` and `session.idle` events.

### Documentation
* Comprehensive update of `README.md` to reflect OpenMemory v0.3.1, complete CLI command reference (23 command groups/subcommands), all 29 MCP STDIO tools, and complete 10-hook OpenCode plugin lifecycle event stream.
* Updated `docs/ARCHITECTURE.md` and `docs/CONTRACTS.md` for v0.3.1 consistency while retaining `docs/VALIDATION-0.3.0.md` as historical release evidence.
* Standardized installation documentation to clearly differentiate npm package installation, tarball deployment (`openmemory-0.3.1.tgz`), and source repository development.

---

## [0.3.0] - 2026-10-04

### Release Status
**Consumer-Ready Verified** (`openmemory-0.3.0.tgz`)

### Added
* **Core Engine:**
  * Single Writer architecture facade (`StorageEngine`) orchestrating process concurrency and atomic storage mutations.
  * Modularized domain authorities (`SessionRegistry`, `TaskDAG`, `ADRGovernance`, `KnowledgeTMS`, `HandoffContinuity`).

* **Adapters & Distribution:**
  * **OpenCode Plugin Adapter (`openmemory/plugin`):** Native plugin shim supporting OpenCode lifecycle events (`session.created`, `session.idle`, `session.compacted`, `experimental.chat.system.transform`, `experimental.session.compacting`, `dispose`).
  * **MCP Server Adapter (`openmemory/mcp`):** STDIO Model Context Protocol server exposing 20 operational tools for status inspection, ADR voting, knowledge recording/querying, task DAG coordination, and stage management.
  * **Consumer Installer (`openmemory/installer`):** Non-destructive consumer installer (`npx openmemory install`) and uninstaller (`npx openmemory uninstall`). Deploys local shims, configures `opencode.json`, and manages delimited pointer blocks in `AGENTS.md`.
  * **CLI Engine (`openmemory/cli`):** Terminal command runner supporting status, installation, uninstallation, backup snapshot management, and diagnostics.

* **Persistence:**
  * Atomic write-then-rename persistence engine (`PersistenceEngine`) preventing partial file corruption on process kill.
  * Advisory file lock manager (`.openmemory/locks/`) with TTL auto-expiration for concurrency control.
  * Structural backup creation (`.openmemory/backups/`) and snapshot recovery CLI commands.
  * Append-only event telemetry logger (`.openmemory/logs/events.jsonl`).

* **Sessions & Task DAG:**
  * Canonical session registry tracking active/idle/compacted agent sessions, identity resolution, and inactivity reconciliation.
  * Multi-agent coordination Task DAG with atomic task claiming, dependency graphs, and status updates.

* **Knowledge & ADR Governance:**
  * Research knowledge storage (`KnowledgeTMS`) with category filtering, provenance tracking, keyword querying, and conflict resolution.
  * MADR decision records (`ADRGovernance`) supporting status transitions (`PROPOSED` -> `ACCEPTED` / `REJECTED`), multi-agent voting consensus, and explicit supersession.
  * Conflict governance flow (`CONTRADICTS` -> `CONFLICTED` -> `EXCLUDE_BOTH` -> `GOVERNANCE NOTICE` -> `SUPERSEDES`).

* **Validation & Documentation:**
  * End-to-end integration validation harness for real consumer project testing (`run-consumer-e2e-tests.ts`).
  * Formal technical documentation (`docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, `docs/VALIDATION-0.3.0.md`).

### Fixed
* Fixed fallback resolution for `activePhase` in `StorageEngine.getOrInitHandoff()` to prevent rendering `Current Phase: undefined` in `.openmemory/handoff.md`.
* Fixed package export boundaries in `package.json` to cleanly export public entrypoints (`.`, `./storage`, `./stage-engine`, `./plugin`, `./mcp`, `./installer`, `./cli`) while encapsulating internal private modules.
