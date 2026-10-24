/**
 * Test Suite: G7.2-LIFECYCLE
 * SQLite Lifecycle, Checkpointing & Periodic Health Resilience Suite
 *
 * Covers:
 * 1. Safe SQLite WAL checkpointing with PRAGMA wal_checkpoint(TRUNCATE) and data preservation.
 * 2. Concurrency: active transaction / busy writer detection (no false positive success).
 * 3. Workspace multi-database discovery and batch checkpointing.
 * 4. SQLite Quiescence Audit: elimination of false positive -shm alerts.
 * 5. Dead process PID detection in advisory locks & TOCTOU-safe cleanup.
 * 6. Periodic DiagnosticHealthCoordinator: start/stop lifecycle, timer unref, overlap prevention, exception tolerance.
 * 7. StorageEngine integration & graceful shutdown hook.
 * 8. Ephemeral sandbox cleanup and zero git pollution.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");

// Import compiled dist modules
const {
  StorageEngine,
  SQLiteLifecycleManager,
  DiagnosticHealthCoordinator,
  PersistenceEngine,
  isProcessDead,
} = require("../../dist/index");

const { DatabaseSync } = require("node:sqlite");

let testCount = 0;
let passedCount = 0;

function runTest(name, fn) {
  testCount++;
  process.stdout.write(`  [${testCount}] ${name}... `);
  try {
    fn();
    passedCount++;
    console.log("PASS");
  } catch (err) {
    console.log("FAIL");
    console.error(`      Error: ${err.message}`);
    if (err.stack) {
      const trace = err.stack.split("\n").slice(1, 4).join("\n");
      console.error(trace);
    }
  }
}

async function runAsyncTest(name, fn) {
  testCount++;
  process.stdout.write(`  [${testCount}] ${name}... `);
  try {
    await fn();
    passedCount++;
    console.log("PASS");
  } catch (err) {
    console.log("FAIL");
    console.error(`      Error: ${err.message}`);
    if (err.stack) {
      const trace = err.stack.split("\n").slice(1, 4).join("\n");
      console.error(trace);
    }
  }
}

function makeSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "om-g72-test-"));
  return dir;
}

function removeSandbox(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
}

console.log("===================================================================");
console.log("  G7.2-LIFECYCLE: SQLite Lifecycle, Observability & Resilience Suite");
console.log("===================================================================");

(async () => {
  // ---------------------------------------------------------------------------
  // TEST 1: WAL Checkpoint TRUNCATE & Data Integrity
  // ---------------------------------------------------------------------------
  runTest("SQLite WAL checkpoint (TRUNCATE) successfully consolidates WAL to 0 bytes", () => {
    const sandbox = makeSandbox();
    let db = null;
    try {
      const dbPath = path.join(sandbox, "test_app.db");
      db = new DatabaseSync(dbPath);
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("CREATE TABLE records (id INTEGER PRIMARY KEY, content TEXT);");
      const insert = db.prepare("INSERT INTO records (content) VALUES (?)");
      for (let i = 0; i < 200; i++) {
        insert.run(`Record item payload #${i} - ${Date.now()}`);
      }

      // In WAL mode, while connection is open, WAL file accumulates writes
      const walPath = dbPath + "-wal";
      assert.strictEqual(fs.existsSync(walPath), true, "WAL file must exist while connection is open");
      const walBefore = fs.statSync(walPath).size;
      assert(walBefore > 0, "WAL size before checkpoint must be > 0 bytes");

      const storage = new StorageEngine(sandbox);
      const res = storage.checkpointDatabase(dbPath, { mode: "TRUNCATE" });

      assert.strictEqual(res.success, true, "Checkpoint must report success = true");
      assert.strictEqual(res.busy, false, "Checkpoint must report busy = false");
      assert.strictEqual(res.mode, "TRUNCATE");
      assert(res.walBytesBefore > 0, "walBytesBefore must record original size");
      assert.strictEqual(res.walBytesAfter, 0, "walBytesAfter must be 0 after TRUNCATE");

      // Verify WAL file exists on disk and is truncated to 0 bytes
      assert.strictEqual(fs.existsSync(walPath), true, "WAL file must exist on disk");
      assert.strictEqual(fs.statSync(walPath).size, 0, "WAL size must be exactly 0 after TRUNCATE");

      // Verify data integrity
      const rowCount = db.prepare("SELECT count(*) as cnt FROM records").get();
      assert.strictEqual(rowCount.cnt, 200, "All 200 committed rows must survive checkpoint");
    } finally {
      if (db) {
        try { db.close(); } catch (_) {}
      }
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Active Transaction Concurrency & Busy Detection
  // ---------------------------------------------------------------------------
  runTest("SQLite WAL checkpoint during active transaction reports busy: true (no false success)", () => {
    const sandbox = makeSandbox();
    let writerDb = null;
    try {
      const dbPath = path.join(sandbox, "concurrent.sqlite");
      writerDb = new DatabaseSync(dbPath);
      writerDb.exec("PRAGMA journal_mode = WAL;");
      writerDb.exec("CREATE TABLE ledger (id INTEGER PRIMARY KEY, amount REAL);");
      writerDb.exec("INSERT INTO ledger (amount) VALUES (100.50);");

      // Open an exclusive transaction on writer connection
      writerDb.exec("BEGIN EXCLUSIVE TRANSACTION;");
      writerDb.exec("INSERT INTO ledger (amount) VALUES (200.75);");

      const storage = new StorageEngine(sandbox);
      // Attempt checkpoint while exclusive transaction is in-flight
      const busyRes = storage.checkpointDatabase(dbPath, { mode: "TRUNCATE", timeoutMs: 300 });

      // In SQLite, an exclusive lock from another connection causes wal_checkpoint to return busy: 1
      assert.strictEqual(busyRes.busy, true, "Checkpoint must report busy = true during active transaction");
      assert.strictEqual(busyRes.success, false, "Checkpoint must NOT report success when busy");

      // Now commit the transaction and retry
      writerDb.exec("COMMIT;");

      const successRes = storage.checkpointDatabase(dbPath, { mode: "TRUNCATE" });
      assert.strictEqual(successRes.success, true, "Checkpoint must succeed once transaction is committed");
      assert.strictEqual(successRes.busy, false, "Checkpoint must not be busy once committed");
      assert.strictEqual(successRes.walBytesAfter, 0, "WAL must be truncated after commit");
    } finally {
      if (writerDb) {
        try { writerDb.close(); } catch (_) {}
      }
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 3: Recursive Workspace Multi-DB Discovery & Batch Maintenance
  // ---------------------------------------------------------------------------
  runTest("Workspace SQLite checkpoint discovers and checkpoints nested databases", () => {
    const sandbox = makeSandbox();
    const conns = [];
    try {
      const subDir = path.join(sandbox, "packages", "service-a");
      fs.mkdirSync(subDir, { recursive: true });

      const db1 = path.join(sandbox, "root.db");
      const db2 = path.join(subDir, "service.sqlite");

      for (const d of [db1, db2]) {
        const conn = new DatabaseSync(d);
        conn.exec("PRAGMA journal_mode = WAL;");
        conn.exec("CREATE TABLE t (x INT); INSERT INTO t VALUES (42);");
        conns.push(conn);
        assert(fs.statSync(d + "-wal").size > 0, "WAL before must have data");
      }

      const storage = new StorageEngine(sandbox);
      const report = storage.checkpointWorkspace(sandbox, { mode: "TRUNCATE" });

      assert.strictEqual(report.totalDatabases, 2, "Must discover exactly 2 SQLite databases");
      assert.strictEqual(report.successfulCheckpoints, 2, "All 2 databases must succeed checkpoint");
      assert.strictEqual(report.busyCheckpoints, 0, "0 busy checkpoints");
      assert.strictEqual(report.failedCheckpoints, 0, "0 failed checkpoints");

      for (const res of report.results) {
        assert.strictEqual(res.success, true);
        assert.strictEqual(res.walBytesAfter, 0);
      }
    } finally {
      for (const c of conns) {
        try { c.close(); } catch (_) {}
      }
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 4: SQLite Quiescence Audit - Elimination of False Positive -shm Reports
  // ---------------------------------------------------------------------------
  runTest("Storage diagnostics accurately distinguishes quiescent -shm from active WAL", () => {
    const sandbox = makeSandbox();
    try {
      const storage = new StorageEngine(sandbox);
      storage.ensureStorageStructure();

      // Create a quiescent database with a 32 KB -shm file and a 0-byte or non-existent -wal
      const dbPath = path.join(sandbox, "quiescent.db");
      fs.writeFileSync(dbPath, "fake-sqlite-header-32bytes-padding");
      fs.writeFileSync(dbPath + "-shm", Buffer.alloc(32768)); // 32KB standard SQLite SHM allocation

      // Run diagnostics: must report QUIESCENT because wal does not exist or has size 0
      const diag1 = storage.runDiagnostics({ rootDir: sandbox });
      assert.strictEqual(diag1.sqliteQuiescent, true, "Residual -shm alone must NOT trigger active transaction alert");
      const check1 = diag1.checks.find(c => c.name === "SQLite Storage Quiescence");
      assert(check1 && check1.passed, "SQLite Storage Quiescence check must pass");

      // Now create a -wal with actual pending uncommitted data
      fs.writeFileSync(dbPath + "-wal", Buffer.alloc(1024));
      const diag2 = storage.runDiagnostics({ rootDir: sandbox });
      assert.strictEqual(diag2.sqliteQuiescent, false, "WAL with size > 0 must trigger unconsolidated transaction alert");
      const check2 = diag2.checks.find(c => c.name === "SQLite Storage Quiescence");
      assert(check2 && !check2.passed, "SQLite check must fail when wal.size > 0");
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 5: Dead Process Advisory Lock Detection & TOCTOU-Safe Cleanup
  // ---------------------------------------------------------------------------
  runTest("Advisory lock inspector marks dead PIDs as stale and cleanup is TOCTOU-safe", () => {
    const sandbox = makeSandbox();
    try {
      const storage = new StorageEngine(sandbox);
      storage.ensureStorageStructure();
      const locksDir = path.join(sandbox, ".openmemory", "locks");

      // Verify dead PID detection function
      assert.strictEqual(isProcessDead(process.pid), false, "Current process PID must be reported alive");
      assert.strictEqual(isProcessDead(999999), true, "Non-existent PID 999999 must be reported dead");

      // 1. Create a lock with dead PID and future TTL
      const deadLockData = {
        resourceKey: "dead-resource",
        token: "tok-dead-123",
        owner: "dead-agent",
        pid: 999999, // dead
        acquiredAt: new Date().toISOString(),
        expiresAt: Date.now() + 60000, // 60s in the future
      };
      fs.writeFileSync(path.join(locksDir, "dead-resource.lock"), JSON.stringify(deadLockData));

      // 2. Create a lock with current live PID and future TTL
      const liveLockData = {
        resourceKey: "live-resource",
        token: "tok-live-456",
        owner: "live-agent",
        pid: process.pid, // alive
        acquiredAt: new Date().toISOString(),
        expiresAt: Date.now() + 60000,
      };
      fs.writeFileSync(path.join(locksDir, "live-resource.lock"), JSON.stringify(liveLockData));

      // Inspect locks
      const lockInfos = storage.inspectLocks();
      const deadInfo = lockInfos.find(l => l.resourceKey === "dead-resource");
      const liveInfo = lockInfos.find(l => l.resourceKey === "live-resource");

      assert(deadInfo, "Dead lock must be present in inspection results");
      assert.strictEqual(deadInfo.deadProcess, true, "Dead lock must have deadProcess = true");
      assert.strictEqual(deadInfo.isStale, true, "Dead lock must be marked isStale = true despite future TTL");
      assert.strictEqual(deadInfo.isLocked, false, "Dead lock must not be considered active lock");

      assert(liveInfo, "Live lock must be present in inspection results");
      assert.strictEqual(liveInfo.deadProcess, false, "Live lock must have deadProcess = false");
      assert.strictEqual(liveInfo.isStale, false, "Live lock must be marked isStale = false");
      assert.strictEqual(liveInfo.isLocked, true, "Live lock must be considered active lock");

      // Clean up stale locks (olderThanMs = 0)
      const cleaned = storage.cleanupStaleLocks();
      assert.strictEqual(cleaned, 1, "Exactly 1 stale lock (the dead PID lock) must be cleaned");
      assert.strictEqual(fs.existsSync(path.join(locksDir, "dead-resource.lock")), false, "Dead lock file must be removed");
      assert.strictEqual(fs.existsSync(path.join(locksDir, "live-resource.lock")), true, "Live lock file must be preserved");
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 6: Periodic DiagnosticHealthCoordinator Lifecycle & Overlap Prevention
  // ---------------------------------------------------------------------------
  await runAsyncTest("DiagnosticHealthCoordinator manages timer lifecycle, avoids overlap, and tolerates errors", async () => {
    const sandbox = makeSandbox();
    try {
      const storage = new StorageEngine(sandbox);
      storage.ensureStorageStructure();

      let transitionCalls = 0;
      let checkCompletedCalls = 0;

      const coordinator = new DiagnosticHealthCoordinator(storage, {
        intervalMs: 1000,
        alertThrottleMs: 5000,
        onStatusChange: () => { transitionCalls++; },
        onCheckCompleted: () => { checkCompletedCalls++; },
      });

      // Status before start
      const st0 = coordinator.getStatus();
      assert.strictEqual(st0.running, false);
      assert.strictEqual(st0.totalExecutions, 0);

      // Start coordinator
      coordinator.start();
      const st1 = coordinator.getStatus();
      assert.strictEqual(st1.running, true);

      // Execute explicitly once
      const report1 = coordinator.executeNow();
      assert(report1, "executeNow must return diagnostic report");
      assert.strictEqual(report1.status, "HEALTHY");
      assert.strictEqual(coordinator.getStatus().totalExecutions, 1);
      assert.strictEqual(checkCompletedCalls, 1);

      // Overlap prevention test
      coordinator.isExecuting = true;
      const skipReport = coordinator.executeNow();
      assert.strictEqual(skipReport, null);
      assert.strictEqual(coordinator.getStatus().totalSkippedDueToOverlap, 1);
      coordinator.isExecuting = false;

      // Exception tolerance test: if runDiagnostics throws, coordinator catches and emits onError
      let caughtError = null;
      coordinator.config.onError = (err) => { caughtError = err; };
      const originalDiag = storage.runDiagnostics;
      storage.runDiagnostics = () => { throw new Error("Simulated storage failure"); };

      coordinator.executeNow();
      assert(caughtError, "Coordinator must catch error and invoke onError hook");
      assert.strictEqual(caughtError.message, "Simulated storage failure");
      assert.strictEqual(coordinator.getStatus().totalFailures, 1);

      // Restore method and stop
      storage.runDiagnostics = originalDiag;
      coordinator.stop();
      assert.strictEqual(coordinator.getStatus().running, false);
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 7: StorageEngine Lifecycle Integration & Graceful Shutdown
  // ---------------------------------------------------------------------------
  runTest("StorageEngine starts, stops, and executes shutdown maintenance cleanly", () => {
    const sandbox = makeSandbox();
    let db = null;
    try {
      const storage = new StorageEngine(sandbox);
      storage.ensureStorageStructure();

      // Register and create a managed SQLite database
      const dbPath = path.join(sandbox, "managed.db");
      db = new DatabaseSync(dbPath);
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("CREATE TABLE accounts (id INT); INSERT INTO accounts VALUES (1);");

      storage.getSQLiteLifecycle().registerDatabase(dbPath, "test-managed");
      assert.strictEqual(storage.getSQLiteLifecycle().isManagedDatabase(dbPath), true);

      // Start health coordinator via storage facade
      const coordinator = storage.startHealthCoordinator({ intervalMs: 2000 });
      assert.strictEqual(coordinator.getStatus().running, true);
      assert.strictEqual(storage.getHealthCoordinator() !== undefined, true);

      // Perform shutdown with checkpoint: true
      storage.shutdown({ checkpoint: true, checkpointOptions: { mode: "TRUNCATE" } });

      // Verify coordinator was stopped
      assert.strictEqual(coordinator.getStatus().running, false);
      assert.strictEqual(storage.getHealthCoordinator(), undefined);

      // Verify managed database was checkpointed to 0 bytes
      assert.strictEqual(fs.statSync(dbPath + "-wal").size, 0);
    } finally {
      if (db) {
        try { db.close(); } catch (_) {}
      }
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 8: Zero Sandbox Pollution Assertion
  // ---------------------------------------------------------------------------
  runTest("All temporary sandboxes were ephemeral and left 0 residual files in workspace", () => {
    // Assert working tree has no untracked database files in project root
    const rootEntries = fs.readdirSync(path.resolve(__dirname, "../.."));
    const polluted = rootEntries.filter(e => e.endsWith(".db") || e.endsWith(".sqlite") || e.endsWith(".lock"));
    assert.strictEqual(polluted.length, 0, `No db/sqlite/lock files should exist in project root: ${polluted.join(", ")}`);
  });

  console.log("===================================================================");
  console.log(`  G7.2-LIFECYCLE Results: ${passedCount}/${testCount} tests passed.`);
  console.log("===================================================================");

  if (passedCount !== testCount) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
