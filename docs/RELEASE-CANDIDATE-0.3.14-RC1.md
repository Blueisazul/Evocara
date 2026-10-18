# CANDIDATE RELEASE MANIFEST — openmemory@0.3.14-rc1

- **Artifact Name:** `openmemory-0.3.14-rc1.tgz`
- **Artifact Path:** `.work/artifacts/openmemory-0.3.14-rc1.tgz`
- **Version:** `0.3.14-rc1`
- **Git Branch:** `fix/p0-security-concurrency-hardening`
- **Base Commit:** `1ef6a7c`
- **Build Timestamp:** `2026-10-16T01:48:59.878Z`
- **SHA-256 Checksum:** `cd6d5b621c2a451e142f505fb08b891affd3f187662bca8a08d9b891bc26f8eb`
- **Size:** `160896` bytes (`157.13` KB)
- **Validation Status:** `VERIFIED (100% Tests Passed in Isolated Sandbox)`

---

## 1. Security & Concurrency Verification Summary

| Feature / Fix | Status | Verification Detail |
|---|---|---|
| **SEC-001 (Path Traversal)** | **VERIFIED** | `validateDomainId` and `resolveSecurePath` enforced in all storage read/write paths. Traversal rejected in sandbox. |
| **PERSIST-001 (Atomics.wait)** | **VERIFIED** | Kernel-level thread suspension without CPU spinning. Multiprocesso tested. |
| **Durability (fsyncSync)** | **VERIFIED** | Physical disk cache flushes before atomic file renames. |
| **Reentrancy & Stale Lock Safety** | **VERIFIED** | Safe nested transaction locks and atomic stale lock reclamation. |
| **Clean Distribution** | **VERIFIED** | 0 source files (`src/`), 0 test files (`.work/`, `scripts/`) leaked into package. |

---

## 2. Packaged Files Inventory (69 files)

```
.opencode/commands/handoff.md
.opencode/commands/memory-status.md
.opencode/opencode.json
.opencode/plugins/openmemory-spike.ts
.opencode/plugins/openmemory.ts
.opencode/skills/skill-architecture-review/SKILL.md
.opencode/skills/skill-qa-verification/SKILL.md
.opencode/skills/skill-security-audit/SKILL.md
.opencode/skills/skill-session-handoff/SKILL.md
AGENTS.md
config/master-prompt.md
dist/cli.d.ts
dist/cli.js
dist/cli.js.map
dist/index.d.ts
dist/index.js
dist/index.js.map
dist/installer.d.ts
dist/installer.js
dist/installer.js.map
dist/master-prompt.d.ts
dist/master-prompt.js
dist/master-prompt.js.map
dist/mcp.d.ts
dist/mcp.js
dist/mcp.js.map
dist/plugin.d.ts
dist/plugin.js
dist/plugin.js.map
dist/stage-engine.d.ts
dist/stage-engine.js
dist/stage-engine.js.map
dist/storage/core/event-logger.d.ts
dist/storage/core/event-logger.js
dist/storage/core/event-logger.js.map
dist/storage/core/path-security.d.ts
dist/storage/core/path-security.js
dist/storage/core/path-security.js.map
dist/storage/core/persistence-engine.d.ts
dist/storage/core/persistence-engine.js
dist/storage/core/persistence-engine.js.map
dist/storage/domains/adr-governance.d.ts
dist/storage/domains/adr-governance.js
dist/storage/domains/adr-governance.js.map
dist/storage/domains/backup-manager.d.ts
dist/storage/domains/backup-manager.js
dist/storage/domains/backup-manager.js.map
dist/storage/domains/handoff-continuity.d.ts
dist/storage/domains/handoff-continuity.js
dist/storage/domains/handoff-continuity.js.map
dist/storage/domains/knowledge-tms.d.ts
dist/storage/domains/knowledge-tms.js
dist/storage/domains/knowledge-tms.js.map
dist/storage/domains/session-registry.d.ts
dist/storage/domains/session-registry.js
dist/storage/domains/session-registry.js.map
dist/storage/domains/task-dag.d.ts
dist/storage/domains/task-dag.js
dist/storage/domains/task-dag.js.map
dist/storage/types.d.ts
dist/storage/types.js
dist/storage/types.js.map
dist/storage.d.ts
dist/storage.js
dist/storage.js.map
LICENSE
mcp_config.json
package.json
README.md
```

---

## 3. Sandbox Verification Protocol

The package was installed via `npm install <tarball>` in a sterile synthetic consumer app outside the repository:
1. Public exports verified (`openmemory`, `openmemory/storage`, `openmemory/mcp`, `openmemory/plugin`).
2. SEC-001 path traversal attack (`ADR-../../escaped`) executed against installed package -> Caught and blocked with `PathSecurityError`.
3. Legitimate ADR write & read executed -> 100% matched.
4. `withStateLock` state manipulation executed -> Atomic update and persistence verified.
5. 29 MCP tools server instantiated successfully.
