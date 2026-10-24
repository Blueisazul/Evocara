/**
 * Test Suite: G7 Observability, Subsystem Diagnostics & Host Failure Resilience
 *
 * Verifies:
 * 1. Clean baseline diagnostics across all 11 core subsystems.
 * 2. Detection of torn/malformed lines in events.jsonl from abrupt host termination.
 * 3. Automated isolation and repair of corrupted log lines to quarantine files.
 * 4. Detection of orphaned advisory lock files left by terminated processes.
 * 5. Automated reclamation of expired advisory locks via self-healing.
 * 6. Detection of unquiescent SQLite databases with active unconsolidated WAL files.
 * 7. Detection of cyclic dependencies in the Task DAG.
 * 8. CLI integration with --json and --repair flags.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const { StorageEngine } = require("../../dist/index.js");

console.log("========================================================================");
console.log("=== TEST SUITE: G7 OBSERVABILITY, DIAGNOSTICS & HOST RESILIENCE ===");
console.log("========================================================================\n");

const baseSandbox = fs.mkdtempSync(path.join(os.tmpdir(), "om-g7-diag-suite-"));

try {
  // --------------------------------------------------------------------------
  // TEST 1: Baseline Diagnostics on Pristine Storage
  // --------------------------------------------------------------------------
  console.log("[TEST 1] Testing baseline diagnostics on clean environment...");
  const t1Dir = path.join(baseSandbox, "t1-clean");
  fs.mkdirSync(t1Dir, { recursive: true });

  const storage1 = new StorageEngine(t1Dir);
  const report1 = storage1.runDiagnostics({ rootDir: t1Dir });

  assert.strictEqual(report1.status, "HEALTHY", `Expected HEALTHY status, got ${report1.status}`);
  assert(report1.checks.length >= 11, `Expected >= 11 checks, got ${report1.checks.length}`);
  assert(report1.checks.every(c => c.passed), "Expected all baseline checks to pass");
  assert.strictEqual(report1.tornLogLinesCount, 0);
  assert.strictEqual(report1.activeLocksCount, 0);
  assert.strictEqual(report1.sqliteQuiescent, true);
  console.log(`  [PASS 1] Clean baseline verified across ${report1.checks.length} checks (status: HEALTHY).`);

  // --------------------------------------------------------------------------
  // TEST 2: Detection of Torn/Malformed Lines in Telemetry Logs
  // --------------------------------------------------------------------------
  console.log("[TEST 2] Testing detection of torn/truncated JSON line in events.jsonl...");
  const t2Dir = path.join(baseSandbox, "t2-torn-log");
  fs.mkdirSync(t2Dir, { recursive: true });

  const storage2 = new StorageEngine(t2Dir);
  const logsDir2 = path.join(t2Dir, ".openmemory", "logs");
  fs.mkdirSync(logsDir2, { recursive: true });
  const logFile2 = path.join(logsDir2, "events.jsonl");

  // Valid lines + 1 truncated / torn line simulating SIGKILL during append
  const validEntry = JSON.stringify({ timestamp: new Date().toISOString(), eventType: "test.init", payload: {} });
  const tornLine = '{"timestamp":"2026-10-18T16:00:00.000Z","eventType":"test.crash","payload":{"truncated":tr';
  fs.writeFileSync(logFile2, `${validEntry}\n${tornLine}\n${validEntry}\n`, "utf8");

  const report2 = storage2.runDiagnostics({ repair: false, rootDir: t2Dir });
  assert.strictEqual(report2.status, "CORRUPTED", `Expected CORRUPTED status, got ${report2.status}`);
  assert.strictEqual(report2.tornLogLinesCount, 1, `Expected 1 torn line, got ${report2.tornLogLinesCount}`);

  const logCheck2 = report2.checks.find(c => c.name === "Telemetry Event Logs");
  assert(logCheck2, "Telemetry check missing");
  assert.strictEqual(logCheck2.passed, false, "Expected telemetry check to fail");
  assert(logCheck2.details.includes("1 torn/malformed"), `Unexpected details: ${logCheck2.details}`);
  console.log("  [PASS 2] Torn telemetry write detected and flagged as CORRUPTED.");

  // --------------------------------------------------------------------------
  // TEST 3: Auto-Repair and Quarantine of Torn Log Lines
  // --------------------------------------------------------------------------
  console.log("[TEST 3] Testing auto-repair and quarantine of corrupted log lines...");
  const report3 = storage2.runDiagnostics({ repair: true, rootDir: t2Dir });
  assert.strictEqual(report3.status, "REPAIRED", `Expected REPAIRED status, got ${report3.status}`);

  const logCheck3 = report3.checks.find(c => c.name === "Telemetry Event Logs");
  assert(logCheck3 && logCheck3.passed, "Expected telemetry check to pass after repair");
  assert(logCheck3.repaired, "Expected check to be flagged as repaired");
  assert(logCheck3.details.includes("Quarantined 1 torn log line"), `Unexpected repair details: ${logCheck3.details}`);

  // Verify quarantine file was created and log is now valid
  const logFilesAfter = fs.readdirSync(logsDir2);
  const quarantineFile = logFilesAfter.find(f => f.startsWith("events.corrupt."));
  assert(quarantineFile, "Quarantine file missing in logs dir");
  const quarantinedContent = fs.readFileSync(path.join(logsDir2, quarantineFile), "utf8");
  assert(quarantinedContent.includes("test.crash"), "Quarantined content mismatch");

  // Subsequent diagnostics on repaired storage should be HEALTHY
  const report3b = storage2.runDiagnostics({ repair: false, rootDir: t2Dir });
  assert.strictEqual(report3b.status, "HEALTHY", "Expected HEALTHY status after repair");
  console.log("  [PASS 3] Torn log lines quarantined cleanly; log restored to HEALTHY state.");

  // --------------------------------------------------------------------------
  // TEST 4: Detection of Orphaned / Expired Advisory Lock
  // --------------------------------------------------------------------------
  console.log("[TEST 4] Testing detection of orphaned/stale lock token...");
  const t4Dir = path.join(baseSandbox, "t4-stale-lock");
  fs.mkdirSync(t4Dir, { recursive: true });

  const storage4 = new StorageEngine(t4Dir);
  const locksDir4 = path.join(t4Dir, ".openmemory", "locks");
  fs.mkdirSync(locksDir4, { recursive: true });

  // Create an expired lock file with past timestamp
  const expiredLockPayload = {
    resourceKey: "orphan-task",
    owner: "dead-agent-9999",
    pid: 999999999,
    token: "expired-token-123",
    acquiredAt: Date.now() - 60000,
    expiresAt: Date.now() - 30000,
  };
  fs.writeFileSync(path.join(locksDir4, "orphan-task.lock"), JSON.stringify(expiredLockPayload), "utf8");

  const report4 = storage4.runDiagnostics({ repair: false, rootDir: t4Dir });
  assert.strictEqual(report4.status, "CORRUPTED");
  const lockCheck4 = report4.checks.find(c => c.name === "Advisory Locks");
  assert(lockCheck4 && !lockCheck4.passed);
  assert(lockCheck4.details.includes("stale/expired"), `Unexpected details: ${lockCheck4.details}`);
  console.log("  [PASS 4] Orphaned/expired lock detected and flagged as CORRUPTED.");

  // --------------------------------------------------------------------------
  // TEST 5: Auto-Repair of Stale Advisory Locks
  // --------------------------------------------------------------------------
  console.log("[TEST 5] Testing auto-repair / reclamation of stale locks...");
  const report5 = storage4.runDiagnostics({ repair: true, rootDir: t4Dir });
  assert.strictEqual(report5.status, "REPAIRED");
  const lockCheck5 = report5.checks.find(c => c.name === "Advisory Locks");
  assert(lockCheck5 && lockCheck5.passed && lockCheck5.repaired);

  // Verify file was cleaned
  assert(!fs.existsSync(path.join(locksDir4, "orphan-task.lock")), "Stale lock file was not removed");
  console.log("  [PASS 5] Stale lock reclaimed cleanly; self-healing confirmed.");

  // --------------------------------------------------------------------------
  // TEST 6: Detection of Unquiescent SQLite Database (Active WAL)
  // --------------------------------------------------------------------------
  console.log("[TEST 6] Testing detection of unquiescent SQLite database with active WAL...");
  const t6Dir = path.join(baseSandbox, "t6-sqlite-wal");
  fs.mkdirSync(t6Dir, { recursive: true });

  const storage6 = new StorageEngine(t6Dir);
  // Create simulated SQLite DB with active WAL (>0 bytes)
  const dbFile = path.join(t6Dir, "inventory.db");
  const walFile = path.join(t6Dir, "inventory.db-wal");
  fs.writeFileSync(dbFile, "SQLITE_HEADER_DUMMY");
  fs.writeFileSync(walFile, "UNCOMMITTED_TRANSACTION_WAL_BYTES");

  const report6 = storage6.runDiagnostics({ repair: false, rootDir: t6Dir });
  assert.strictEqual(report6.status, "CORRUPTED");
  assert.strictEqual(report6.sqliteQuiescent, false);
  const sqliteCheck6 = report6.checks.find(c => c.name === "SQLite Storage Quiescence");
  assert(sqliteCheck6 && !sqliteCheck6.passed);
  assert(sqliteCheck6.details.includes("inventory.db"), `Expected inventory.db in details, got: ${sqliteCheck6.details}`);
  console.log("  [PASS 6] Active SQLite WAL detected in consumer workspace and blocked.");

  // --------------------------------------------------------------------------
  // TEST 7: Detection of Cyclic Dependencies in Task DAG
  // --------------------------------------------------------------------------
  console.log("[TEST 7] Testing detection of cyclic dependency in Task DAG...");
  const t7Dir = path.join(baseSandbox, "t7-task-dag");
  fs.mkdirSync(t7Dir, { recursive: true });

  const storage7 = new StorageEngine(t7Dir);
  // Inject cycle in project-state.json tasks: TASK-1 depends on TASK-2, TASK-2 depends on TASK-1
  const state7 = storage7.getOrInitProjectState();
  state7.coordinationTasks = [
    { id: "TASK-1", title: "Task 1", description: "d1", status: "PENDING", createdAgentId: "a1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), dependsOn: ["TASK-2"] },
    { id: "TASK-2", title: "Task 2", description: "d2", status: "PENDING", createdAgentId: "a1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), dependsOn: ["TASK-1"] },
  ];
  fs.writeFileSync(path.join(t7Dir, ".openmemory", "project-state.json"), JSON.stringify(state7), "utf8");

  const report7 = storage7.runDiagnostics({ repair: false, rootDir: t7Dir });
  assert.strictEqual(report7.status, "CORRUPTED");
  const dagCheck7 = report7.checks.find(c => c.name === "Task Graph Consistency");
  assert(dagCheck7 && !dagCheck7.passed);
  assert(dagCheck7.details.includes("Cycle detected"), `Expected cycle detected in details: ${dagCheck7.details}`);
  console.log("  [PASS 7] Task DAG cyclic dependency detected and diagnosed.");

  // --------------------------------------------------------------------------
  // TEST 8: CLI Diagnostics Integration with --json and --repair
  // --------------------------------------------------------------------------
  console.log("[TEST 8] Testing CLI diagnostics integration with --json and --repair...");
  const cliScript = path.resolve(__dirname, "../../dist/cli.js");

  const cliResJson = spawnSync("node", [cliScript, "diagnostics", "--json"], {
    cwd: t1Dir,
    encoding: "utf8",
  });
  assert.strictEqual(cliResJson.status, 0, "CLI diagnostics --json failed: " + cliResJson.stderr);
  const parsedJson = JSON.parse(cliResJson.stdout.trim());
  assert.strictEqual(parsedJson.status, "HEALTHY");
  assert(parsedJson.subsystems && parsedJson.subsystems.manifest);

  const cliResText = spawnSync("node", [cliScript, "diagnostics", "--repair"], {
    cwd: t1Dir,
    encoding: "utf8",
  });
  assert.strictEqual(cliResText.status, 0, "CLI diagnostics --repair failed: " + cliResText.stderr);
  assert(cliResText.stdout.includes("[OpenMemory CLI] Storage Diagnostic Report"));
  assert(cliResText.stdout.includes("[Subsystems Overview]:"));
  console.log("  [PASS 8] CLI diagnostics executed cleanly with --json and --repair flags.");

  console.log("\n========================================================================");
  console.log("=== ALL 8 G7 OBSERVABILITY & DIAGNOSTICS TESTS PASSED (100%) ===");
  console.log("========================================================================");
} finally {
  try {
    fs.rmSync(baseSandbox, { recursive: true, force: true });
  } catch (_) {}
}
