# RUNBOOK: OPERATIONAL PROMOTION & VERIFIED RECOVERY (OPENMEMORY G13)

## 1. Executive Summary & Objective

This runbook establishes the exact, deterministic, and verifiable operational procedure for promoting the qualified candidate `openmemory@0.3.15-rc2` into the production reference consumer `InventoryHub` (`C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub`), transitioning from `openmemory@0.3.14-rc4`.

This document adheres strictly to the governance constraints established across milestones G6 through G13. **Do not execute this promotion without explicit human authorization.**

---

## 2. Preconditions & Authorization Checklist

Before initiating promotion, verify all of the following:

- [ ] **Governance Authorization**: Operator has granted explicit authorization for physical modification of `InventoryHub`.
- [ ] **Clean Working Tree**: OpenMemory repository is on `fix/p0-security-concurrency-hardening` with clean working tree.
- [ ] **Artifact Presence & Hash Integrity**: Candidate artifact exists and matches exact cryptographic signatures:
  - Tarball: `.work/artifacts/openmemory-0.3.15-rc2.tgz`
  - Size: `190,051` bytes
  - SHA-256: `a82a2a02a5db20d0d96ae8fb913c04ca937e683da870d7fdbddb06ea77f8bfc5`
  - SHA-512 (base64): `xDAzTSQgn4DT2c1bVOud9dqKda3+TS3HzoT2Ld7PSy0KIDH9mM/uI/JkgdljDGAfn9vp9zzD40lmvFoiQ9WqUg==`
- [ ] **InventoryHub Baseline Status**:
  - `package.json` declares dependency on `openmemory-0.3.14-rc4.tgz`.
  - No active lock (`.promotion.lock`) exists.
  - No active SQLite WAL/SHM files exist (`*-wal`, `*-shm` files are 0 bytes or absent).
  - All 34 baseline acceptance assertions pass.

---

## 3. Step-by-Step Promotion Procedure

### Step 0: Cryptographic Supply-Chain Verification

Validate the candidate artifact against the canonical G13 Evidence Manifest:

```bash
cd C:\Users\sant1\Downloads\OpenMemory
node scripts/verify-release-artifact.js \
  --tarball .work/artifacts/openmemory-0.3.15-rc2.tgz \
  --manifest docs/G13_EVIDENCE_MANIFEST.json
```
**Expected Outcome:** `SUPPLY CHAIN ARTIFACT INTEGRITY VERIFIED (EXIT 0)`.

---

### Step 1: Preflight Quiescence & Zero-Mutation Dry-Run

Execute a dry-run against `InventoryHub` to verify locks, permissions, and quiescence without modifying files:

```bash
cd C:\Users\sant1\Downloads\OpenMemory
node scripts/transactional-promotion-engine.js \
  --consumer "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub" \
  --tarball ".work/artifacts/openmemory-0.3.15-rc2.tgz" \
  --expected-sha256 "a82a2a02a5db20d0d96ae8fb913c04ca937e683da870d7fdbddb06ea77f8bfc5" \
  --expected-size 190051 \
  --expected-version "0.3.15-rc2" \
  --original-version "0.3.14-rc4" \
  --dry-run
```
**Expected Outcome:** `Promotion successfully committed and verified!` with 0 physical package mutations.

---

### Step 2: Live Transactional Promotion

Execute the physical promotion with full cryptographic cataloging, mutual exclusion locks, and staged verification:

```bash
cd C:\Users\sant1\Downloads\OpenMemory
node scripts/transactional-promotion-engine.js \
  --consumer "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub" \
  --tarball ".work/artifacts/openmemory-0.3.15-rc2.tgz" \
  --expected-sha256 "a82a2a02a5db20d0d96ae8fb913c04ca937e683da870d7fdbddb06ea77f8bfc5" \
  --expected-size 190051 \
  --expected-version "0.3.15-rc2" \
  --original-version "0.3.14-rc4" \
  --consumer-test "node test_inventory_manager.js && node test_phase_2c2_full.js && node test_phase_2c4_post_cleanup.mjs"
```
**Internal Engine Transitions:**
1. `UNINITIALIZED -> LOCK_ACQUIRED` (exclusive `.promotion.lock` with TTL and PID).
2. `LOCK_ACQUIRED -> PREFLIGHT_VERIFIED` (tarball hash check, SQLite quiescence).
3. `PREFLIGHT_VERIFIED -> BACKED_UP` (atomic catalog of `.openmemory/`, `package.json`, and lockfile).
4. `BACKED_UP -> APPLYING` (atomic write of `operation_manifest.json`, `npm install`).
5. `APPLYING -> SMOKE_TESTING` (read-only export check, 0 disk mutation validation).
6. `SMOKE_TESTING -> POST_VERIFYING` (consumer acceptance test suite execution).
7. `POST_VERIFYING -> COMMITTED` (manifest finalized, lock cleanly released).

---

### Step 3: Post-Promotion Verification & Acceptance

Confirm consumer application stability:

```bash
cd C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub
node test_inventory_manager.js
node test_phase_2c2_full.js
node test_phase_2c4_post_cleanup.mjs
```
**Expected Outcome:** All 34 assertions pass cleanly with exit code 0.

Check promotion status via MCP tooling:

```bash
cd C:\Users\sant1\Downloads\OpenMemory
node -e "
const { createMCPServer } = require('./dist/mcp.js');
const mcp = createMCPServer();
const handler = mcp._requestHandlers.get('tools/call');
handler({
  method: 'tools/call',
  params: {
    name: 'openmemory_promotion_status',
    arguments: { consumerPath: 'C:\\Users\\sant1\\OneDrive\\Documentos\\ChatGPT\\OpenMemory\\InventoryHub' }
  }
}, {}).then(res => console.log(res.content[0].text));
"
```
**Expected Outcome:** JSON output declaring `state: "COMMITTED"`, `isInterrupted: false`, `isCorrupted: false`.

---

## 4. Abort Criteria & Emergency Recovery Procedures

### Abort Criteria (Automatic Rollback)

The engine automatically halts and executes an immediate rollback if:
- Candidate tarball size or SHA-256 does not match expected cryptographic values.
- An unquiescent SQLite database with an active WAL (`> 0 bytes`) or SHM index is detected.
- Target `package.json` is missing or is an insecure symlink.
- `npm install` times out (`> 180s`) or returns non-zero.
- The installed `node_modules/openmemory/package.json` version does not match `0.3.15-rc2`.
- Any file outside `.openmemory/` or `node_modules/` is mutated during smoke testing.
- Any of the consumer acceptance test suites return exit code != 0.

---

### Manual Emergency Rollback

If the operator decides to abort during or immediately after promotion:

```bash
cd C:\Users\sant1\Downloads\OpenMemory
node scripts/transactional-promotion-engine.js \
  --consumer "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub" \
  --rollback "OPERATOR_MANUAL_ABORT"
```

---

### Crash Recovery (Interrupted Operation / Power Outage / SIGKILL)

If a promotion process was killed abruptly (e.g., terminal closed, power loss), the engine leaves an active or torn `operation_manifest.json`.

Execute crash recovery:

```bash
cd C:\Users\sant1\Downloads\OpenMemory
node scripts/transactional-promotion-engine.js \
  --consumer "C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub" \
  --recover
```

**Recovery Behaviors:**
1. **Intelligent Backup Selection**: Validates all candidate backups under `backups/backup_*`, rejects any corrupted/empty backups, and restores from the most recent valid backup.
2. **Corrupted Manifest Quarantine**: Quarantines broken/truncated manifests to `.bak` before proceeding.
3. **Pre-Mutation Interruption Safety**: If the crash occurred in `LOCK_ACQUIRED` or `PREFLIGHT_VERIFIED`, recognizes that no mutations were made to consumer files and restores clean state without attempting null-pointer restores.
4. **Active Process Lock Defense**: Will NOT steal or abort a lock held by a live, active PID.
5. **Fail-Closed Safety**: If all backups are corrupt, aborts with `ALL_BACKUPS_CORRUPT` without overwriting disk state.

---

## 5. Post-Rollback Parity Verification

Following any rollback or recovery:

```bash
cd C:\Users\sant1\OneDrive\Documentos\ChatGPT\OpenMemory\InventoryHub
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const omDep = pkg.dependencies.openmemory;
console.log('Restored dependency:', omDep);
if (!omDep.includes('0.3.14-rc4')) {
  console.error('FAIL: Expected 0.3.14-rc4');
  process.exit(1);
}
console.log('PASS: Exact version restored');
"
node test_inventory_manager.js
node test_phase_2c2_full.js
node test_phase_2c4_post_cleanup.mjs
```