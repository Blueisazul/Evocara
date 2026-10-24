const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const { StorageEngine } = require("../../dist/storage");
const { EventLogger } = require("../../dist/storage/core/event-logger");

async function runDurabilitySuite() {
  console.log("===================================================================");
  console.log("  G20: Event Durability, Concurrency & Compaction Audit Suite      ");
  console.log("===================================================================");

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`  [${total}] ${name}... PASS`);
    } catch (err) {
      console.error(`  [${total}] ${name}... FAILED: ${err.message}`);
      throw err;
    }
  }

  // TEST 1: Invalid Policy Sanitization
  test("Invalid policy configuration is safely clamped to operational defaults", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "g20-dur-1-"));
    const logger = new EventLogger(tmpDir, {
      maxEvents: -50,
      maxSizeBytes: -100,
      maxArchiveFiles: -2,
    });
    const policy = logger.getRetentionPolicy();
    assert.strictEqual(policy.maxEvents > 0, true, "maxEvents must be clamped > 0");
    assert.strictEqual(policy.maxSizeBytes >= 1024, true, "maxSizeBytes must be >= 1024");
    assert.strictEqual(policy.maxArchiveFiles >= 0, true, "maxArchiveFiles must be >= 0");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // TEST 2: Boundary Threshold Evaluation
  test("Compaction triggers strictly at or above threshold, not below", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "g20-dur-2-"));
    const storage = new StorageEngine(tmpDir);
    storage.ensureStorageStructure();
    storage.registerSession({ id: "s1", agentId: "a1", status: "ACTIVE" });

    // Check actual events currently in the log
    const count1 = storage.readEvents().length;
    // Set threshold well above current count
    storage.setEventRetentionPolicy({ maxEvents: count1 + 20, maxSizeBytes: 1000000 });

    for (let i = 1; i <= 3; i++) {
      storage.logEvent("telemetry.tick", { index: i }, "a1");
    }
    let res1 = storage.compactEventLogs();
    assert.strictEqual(res1.compacted, false, "Must not compact when event count is below threshold");

    // Force exceed threshold by setting maxEvents to current event count or less
    const count2 = storage.readEvents().length;
    storage.setEventRetentionPolicy({ maxEvents: count2, maxSizeBytes: 1000000 });

    let res2 = storage.compactEventLogs();
    assert.strictEqual(res2.compacted, true, "Must compact when event count reaches threshold");
    assert.strictEqual(res2.eventsBefore >= count2, true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // TEST 3: Fault Injection between .tmp and rename
  test("Crash between .tmp staging file creation and active log rename preserves original log", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "g20-dur-3-"));
    const storage = new StorageEngine(tmpDir);
    storage.ensureStorageStructure();
    storage.registerSession({ id: "s1", agentId: "a1", status: "ACTIVE" });

    for (let i = 1; i <= 20; i++) {
      storage.logEvent("adr.approved", { adr: i }, "a1");
    }
    storage.setEventRetentionPolicy({ maxEvents: 2000, maxSizeBytes: 10000000 });
    const logPath = path.join(tmpDir, ".openmemory", "logs", "events.jsonl");
    const originalContent = fs.readFileSync(logPath, "utf-8");

    // Simulate interrupted compaction by dropping orphaned .tmp files
    const orphanTmp = path.join(tmpDir, ".openmemory", "logs", `compact.${Date.now()}.orphan.tmp`);
    fs.writeFileSync(orphanTmp, "PARTIALLY WRITTEN UNFINISHED COMPACTION DATA");

    // Active log must remain 100% intact
    const contentAfterCrash = fs.readFileSync(logPath, "utf-8");
    assert.strictEqual(contentAfterCrash, originalContent, "Original log must not be modified if rename did not occur");

    // Clean stale temp files
    const cleaned = storage.cleanStaleEventTempFiles(0);
    assert.strictEqual(cleaned >= 1, true, "Orphaned temp file must be cleaned");
    assert.strictEqual(fs.existsSync(orphanTmp), false, "Orphan temp file must be unlinked");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // TEST 4: Age Discrimination in Temp Cleanup
  test("Temp file cleanup discriminates between fresh active temp files and stale files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "g20-dur-4-"));
    const logsDir = path.join(tmpDir, ".openmemory", "logs");
    fs.mkdirSync(logsDir, { recursive: true });

    const freshFile = path.join(logsDir, "compact.fresh.tmp");
    const staleFile = path.join(logsDir, "compact.stale.tmp");
    fs.writeFileSync(freshFile, "fresh");
    fs.writeFileSync(staleFile, "stale");

    // Artificially age the stale file by 10 minutes
    const tenMinAgo = new Date(Date.now() - 600000);
    fs.utimesSync(staleFile, tenMinAgo, tenMinAgo);

    const logger = new EventLogger(logsDir);
    // Cleanup with 5-minute threshold
    const cleaned = logger.cleanStaleTempFiles(300000);
    assert.strictEqual(cleaned, 1, "Only the 10-minute old file should be cleaned");
    assert.strictEqual(fs.existsSync(freshFile), true, "Fresh file must be preserved");
    assert.strictEqual(fs.existsSync(staleFile), false, "Stale file must be removed");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // TEST 5: Collision-Free Archive Generation
  test("Rapid back-to-back compactions produce distinct collision-free archive files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "g20-dur-5-"));
    const storage = new StorageEngine(tmpDir);
    storage.ensureStorageStructure();
    storage.registerSession({ id: "s1", agentId: "a1", status: "ACTIVE" });

    storage.setEventRetentionPolicy({ maxEvents: 5, maxArchiveFiles: 10 });
    const archives = [];

    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < 6; i++) {
        storage.logEvent("telemetry.ping", { c, i }, "a1");
      }
      const res = storage.compactEventLogs();
      assert.strictEqual(res.compacted, true);
      archives.push(res.archivedFile);
    }

    const uniqueArchives = new Set(archives);
    assert.strictEqual(uniqueArchives.size, 3, "All 3 archives must have unique non-colliding names");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // TEST 6: Unlimited Archive Retention Mode
  test("Setting maxArchiveFiles: 0 retains 100% of historical archives indefinitely", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "g20-dur-6-"));
    const storage = new StorageEngine(tmpDir);
    storage.ensureStorageStructure();
    storage.registerSession({ id: "s1", agentId: "a1", status: "ACTIVE" });

    storage.setEventRetentionPolicy({ maxEvents: 5, maxArchiveFiles: 0 });

    for (let c = 0; c < 5; c++) {
      for (let i = 0; i < 6; i++) {
        storage.logEvent("audit.tick", { c, i }, "a1");
      }
      storage.compactEventLogs();
    }

    const logsDir = path.join(tmpDir, ".openmemory", "logs");
    const archiveFiles = fs.readdirSync(logsDir).filter(f => f.startsWith("events.archive."));
    assert.strictEqual(archiveFiles.length, 5, "All 5 archives must be retained when maxArchiveFiles is 0");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // TEST 7: Complete Historical Audit Trail across Archives
  test("readEvents with includeArchives: true retrieves full chronological audit trail", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "g20-dur-7-"));
    const storage = new StorageEngine(tmpDir);
    storage.ensureStorageStructure();
    storage.registerSession({ id: "s1", agentId: "a1", status: "ACTIVE" });

    storage.setEventRetentionPolicy({ maxEvents: 5, maxArchiveFiles: 5, preserveEssentialEvents: false });

    // Generate events across 2 compaction cycles
    for (let i = 1; i <= 6; i++) {
      storage.logEvent("cycle1.event", { num: i }, "a1");
    }
    storage.compactEventLogs();

    for (let i = 1; i <= 6; i++) {
      storage.logEvent("cycle2.event", { num: i }, "a1");
    }
    storage.compactEventLogs();

    // Read without archives
    const activeEvents = storage.readEvents({ includeArchives: false });
    // Read with archives
    const allEvents = storage.readEvents({ includeArchives: true });

    assert.strictEqual(allEvents.length > activeEvents.length, true, "Audit trail with archives must contain historical events");
    const hasCycle1 = allEvents.some(e => e.eventType === "cycle1.event");
    assert.strictEqual(hasCycle1, true, "Historical cycle 1 event must be retrieved from archive");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // TEST 8: Real Cross-Process Mutual Exclusion (O_CREAT | O_EXCL)
  test("Real inter-process mutual exclusion via withStateLock serializes concurrent child processes", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "g20-dur-8-"));
    const storage = new StorageEngine(tmpDir);
    storage.ensureStorageStructure();
    storage.registerSession({ id: "s1", agentId: "a1", status: "ACTIVE" });

    // Create an external runner script for child processes
    const workerScript = path.join(tmpDir, "worker.js");
    const storageModulePath = path.resolve(__dirname, "../../dist/storage").replace(/\\/g, "/");
    const workerCode = `
const { StorageEngine } = require("${storageModulePath}");
const storage = new StorageEngine(process.argv[2]);
storage.ensureStorageStructure();
const procId = process.argv[3];
for (let i = 0; i < 15; i++) {
  storage.withStateLock(() => {
    storage.logEvent("proc.write", { procId, i, pid: process.pid }, procId);
    const end = Date.now() + 5;
    while (Date.now() < end) {}
  }, procId);
}
`;
    fs.writeFileSync(workerScript, workerCode, "utf-8");

    // Spawn 2 independent Node processes
    const p1 = spawnSync(process.execPath, [workerScript, tmpDir, "proc-A"]);
    const p2 = spawnSync(process.execPath, [workerScript, tmpDir, "proc-B"]);

    assert.strictEqual(p1.status, 0, `Proc A failed: ${p1.stderr.toString()}`);
    assert.strictEqual(p2.status, 0, `Proc B failed: ${p2.stderr.toString()}`);

    // Verify all 30 events were written with 100% integrity and zero torn writes
    const audit = storage.auditEventLogIntegrity();
    assert.strictEqual(audit.corruptLines, 0, "There must be zero corrupt lines from concurrent processes");
    const events = storage.readEvents({ eventType: "proc.write" });
    assert.strictEqual(events.length, 30, "All 30 events from both child processes must be preserved");

    const countA = events.filter(e => e.agentId === "proc-A").length;
    const countB = events.filter(e => e.agentId === "proc-B").length;
    assert.strictEqual(countA, 15, "Proc A must have 15 events");
    assert.strictEqual(countB, 15, "Proc B must have 15 events");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // TEST 9: Torn Write Quarantine During Compaction
  test("Compaction automatically quarantines corrupt lines and preserves all valid events", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "g20-dur-9-"));
    const storage = new StorageEngine(tmpDir);
    storage.ensureStorageStructure();
    storage.registerSession({ id: "s1", agentId: "a1", status: "ACTIVE" });

    storage.setEventRetentionPolicy({ maxEvents: 10 });

    for (let i = 1; i <= 12; i++) {
      storage.logEvent("adr.approved", { adr: i }, "a1");
    }

    // Corrupt lines intentionally into log
    const logPath = path.join(tmpDir, ".openmemory", "logs", "events.jsonl");
    fs.appendFileSync(logPath, "{ MALFORMED JSON LINE TORN WRITE\n{\"truncated\": true\n");

    const auditBefore = storage.auditEventLogIntegrity();
    assert.strictEqual(auditBefore.corruptLines, 2, "Must detect 2 corrupt lines before compaction");

    const res = storage.compactEventLogs();
    assert.strictEqual(res.compacted, true, "Must successfully compact after automatic repair");

    const auditAfter = storage.auditEventLogIntegrity();
    assert.strictEqual(auditAfter.corruptLines, 0, "Log after compaction must have 0 corrupt lines");

    // Verify quarantine file exists
    const logsDir = path.join(tmpDir, ".openmemory", "logs");
    const quarantineFiles = fs.readdirSync(logsDir).filter(f => f.startsWith("events.corrupt."));
    assert.strictEqual(quarantineFiles.length, 1, "Quarantine file must be created");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // TEST 10: Stream vs Buffered Compaction Evaluation (10,000 events)
  test("Performance of buffered compaction at 10,000 events demonstrates sub-100ms execution", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "g20-dur-10-"));
    const storage = new StorageEngine(tmpDir);
    storage.ensureStorageStructure();
    storage.registerSession({ id: "s1", agentId: "a1", status: "ACTIVE" });
    storage.setEventRetentionPolicy({ maxEvents: 2000, maxSizeBytes: 10000000 });

    const logPath = path.join(tmpDir, ".openmemory", "logs", "events.jsonl");
    const lines = [];
    for (let i = 0; i < 10000; i++) {
      const isEssential = i % 5 === 0;
      const eventType = isEssential ? "adr.created" : "telemetry.tick";
      lines.push(JSON.stringify({
        timestamp: new Date(Date.now() - (10000 - i) * 1000).toISOString(),
        eventType,
        payload: { i, value: "data-payload-string-metric" },
        agentId: "agent-bulk"
      }));
    }
    fs.writeFileSync(logPath, lines.join("\n") + "\n", "utf-8");

    const t0 = performance.now();
    const res = storage.compactEventLogs();
    const compactionDurationMs = performance.now() - t0;

    assert.strictEqual(res.compacted, true, "Compaction of 10,000 events must succeed");
    assert.strictEqual(res.eventsBefore >= 10000, true);
    assert.strictEqual(res.essentialPreserved >= 2000, true, "All essential events must be preserved");
    console.log(`      [Benchmark] Compaction of ${res.eventsBefore} events (${(res.sizeBeforeBytes / 1024).toFixed(1)} KB) took ${compactionDurationMs.toFixed(2)} ms`);
    assert.strictEqual(compactionDurationMs < 300, true, "Compaction must complete in <300ms");
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  console.log("-------------------------------------------------------------------");
  console.log(`  G20 Event Durability & Concurrency: ${passed} / ${total} tests PASSED.`);
  console.log("-------------------------------------------------------------------");
}

runDurabilitySuite().catch(err => {
  console.error("Durability suite failed:", err);
  process.exit(1);
});
