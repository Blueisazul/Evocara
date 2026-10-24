# Evocara (formerly OpenMemory)

> Deterministic operational memory & stage governance framework for OpenCode and AI developer agents.

**Evocara** provides a clean-room, local-first, MIT-licensed state management, session continuity, Truth Maintenance System (TMS), ADR governance, BM25 retrieval, and Model Context Protocol (MCP) server adapter framework for AI-assisted software development.

Evocara v0.4.0 establishes the official product brand identity while preserving **100% backwards compatibility** with all existing OpenMemory tooling, scripts, and MCP consumers.

---

## 🚀 Quick Start

### Installation

Install via npm:

```bash
npm install evocara
# or backwards-compatible alias:
npm install openmemory
```

Or run directly using `npx`:

```bash
npx evocara install
# or backwards-compatible alias:
npx openmemory install
```

---

## 📋 Features

- **Deterministic BM25 Retrieval Engine:** Pure TypeScript BM25 retrieval (`k1=1.2`, `b=0.75`) with exact token coordination, domain ranking, and zero external vector DB dependencies.
- **Truth Maintenance System (TMS):** Read-time dependency graph tracking, cycle detection, conflict analysis, and non-canonical diagnostic telemetry.
- **Session Continuity Handoff Engine (`.openmemory/handoff.md`):** Automatically captures progress summaries, architectural decisions, and uncommitted work across AI session compactions with sub-50ms handoff latency.
- **Structured Project State (`.openmemory/project-state.json`):** Tracks active goals, phases, and task execution lists.
- **Architectural Decision Records (`.openmemory/adrs/`):** Programmatic creation, indexing, and retrieval of ADRs.
- **Model Context Protocol (MCP) Adapter:** Built-in MCP server support for STDIO integration with Cursor, Claude Desktop, and OpenCode tools.
  - **Curated 8-Tool Profile (Default):** ~1,450 tokens context footprint exposing essential developer agent operations.
  - **Dual Naming Support:** Transparently invokes tools via both `evocara_*` and `openmemory_*` aliases with identical authorization and persistence guarantees.
  - **Full 42-Tool Catalog:** Accessible via `--profile full`.
- **Non-Destructive Repository Installer:** Injects delimited pointer blocks into `AGENTS.md` with pre-modification atomic backups (`.openmemory/backups/`).
- **OpenCode Plugin Lifecycle Integration:** Hooks natively into `session.created`, `session.idle`, `session.compacted`, and `experimental.session.compacting`.

---

## 💻 CLI Commands

Evocara provides dual executable binaries: `evocara` and `openmemory`. Both binaries support identical commands:

```bash
# Display project context summary
npx evocara status

# Non-destructive repository installation
npx evocara install

# Query project knowledge via BM25
npx evocara query -q "storage architecture"

# Analyze knowledge Truth Maintenance System (TMS)
npx evocara tms analyze

# Create atomic state backup
npx evocara backup [label]

# List available backups
npx evocara list-backups

# Restore state from backup snapshot
npx evocara restore <backup-id>

# Run storage engine diagnostics and auto-recovery
npx evocara diagnostics

# Clean up temporary files
npx evocara cleanup

# Print version information
npx evocara version
```

---

## 🔌 Programmatic Usage

```typescript
import {
  StorageEngine,
  createEvocaraMCPServer,
  createMCPServer,
  installEvocara,
  installOpenMemory,
  CURATED_MCP_TOOLS,
  EVOCARA_CURATED_MCP_TOOLS
} from "evocara";

// Initialize storage engine
const storage = new StorageEngine();
const summary = storage.formatProjectContextSummary();
console.log(summary);

// Run non-destructive repository installer
const result = installEvocara({ targetDir: process.cwd() });
console.log(`Installed: ${result.success}`);
```

---

## 🔄 Dual-Brand Compatibility Matrix

| Feature | Evocara Canonical (v0.4.0) | OpenMemory Compatibility |
|---|---|---|
| Package Name | `evocara` | `openmemory` |
| CLI Binary | `evocara` | `openmemory` |
| MCP Curated Status | `evocara_status` | `openmemory_status` |
| MCP Knowledge Query | `evocara_query_knowledge` | `openmemory_query_knowledge` |
| MCP Record Knowledge | `evocara_record_knowledge` | `openmemory_record_knowledge` |
| MCP Get ADR | `evocara_get_adr` | `openmemory_get_adr` |
| MCP Save ADR | `evocara_save_adr` | `openmemory_save_adr` |
| MCP Get Handoff | `evocara_get_handoff` | `openmemory_get_handoff` |
| MCP Update Handoff | `evocara_update_handoff` | `openmemory_update_handoff` |
| MCP Analyze TMS | `evocara_analyze_knowledge_tms` | `openmemory_analyze_knowledge_tms` |

---

## 📜 License

[MIT License](LICENSE) © 2026 Evocara / OpenMemory Contributors
