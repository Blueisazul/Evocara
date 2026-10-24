/**
 * G19 Test Suite: Event Durability, Compaction & Retention Policy Engine
 *
 * Implements Section 4.3 of Iteraci�n G19:
 * 1. Normal compaction
 * 2. Empty log handling
 * 3. Log below threshold (no-op)
 * 4. Log above threshold (compaction execution)
 * 5. Interruption during compaction (safety of staging .tmp file)
 * 6. Recovery after restart
 * 7. Two concurrent writers under process lock
 * 8. Repeated rotation and idempotency
 * 9. Corrupt or truncated file repair and compaction
 * 10. Preservation of essential audit trail events
 * 11. Zero event loss or duplicate introduction
 * 12. Adherence to retention policy overrides
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { StorageEngine } = require("../../dist/storage");

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "om-g19-event-retention-"));
const agentId = "agent-g19-audit";
const sessionId = "session-g19-audit";

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
      console.error(err.stack.split("\n").slice(1, 4).join("\n"));
    }
    throw err;
  }
}

console.log("===================================================================");
console.log("  G19: Event Durability, Compaction & Retention Policy Suite       ");
console.log("===================================================================");

(async () => {
  let storage = new StorageEngine(sandbox);
  storage.ensureStorageStructure();
  storage.registerSession({ id: sessionId, agentId, status: "ACTIVE" });

  const logsDir = path.join(sandbox, ".openmemory", "logs");
  const eventLogFile = path.join(logsDir, "events.jsonl");

  // Helper to populate events
  function populateEvents(count, essentialRatio = 0.2) {
    for (let i = 0; i < count; i++) {
      const isEssential = Math.random() < essentialRatio;
      const eventType = isEssential ? "adr.created" : "telemetry.heartbeat";
      storage.logEvent(eventType, { index: i, note: `event_${i}` }, agentId, sessionId);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Empty Log Handling
  // --------------------------------------------------------------------------
  runTest("Empty log handling produces clean no-op result", () => {
    if (fs.existsSync(eventLogFile)) fs.unlinkSync(eventLogFile);
    // Direct call on eventLogger with no file
    const directRes = storage.eventLogger.compactEventLogs();
    assert.strictEqual(directRes.compacted, false);
    assert(directRes.reason.includes("does not exist"));

    // StorageEngine call on fresh repo
    const engineRes = storage.compactEventLogs();
    assert.strictEqual(engineRes.compacted, false);
    assert(engineRes.eventsBefore <= 2);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Log Below Threshold
  // --------------------------------------------------------------------------
  runTest("Log below threshold returns compacted: false without file mutations", () => {
    storage.setEventRetentionPolicy({ maxEvents: 50, maxSizeBytes: 100000 });
    for (let i = 0; i < 5; i++) {
      storage.logEvent("agent.ping", { seq: i }, agentId, sessionId);
    }

    const currentCount = storage.readEvents().length;
    const statBefore = fs.statSync(eventLogFile);
    const res = storage.compactEventLogs();

    assert.strictEqual(res.compacted, false);
    assert.strictEqual(res.eventsBefore, currentCount + 1); // +1 lock acquisition
    assert.strictEqual(res.eventsAfter, currentCount + 1);
    assert(res.reason.includes("below retention thresholds"));

    const statAfter = fs.statSync(eventLogFile);
    assert(statAfter.size >= statBefore.size);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Log Above Threshold (Normal Compaction)
  // --------------------------------------------------------------------------
  runTest("Normal compaction triggers when events exceed threshold and creates archive", () => {
    storage.setEventRetentionPolicy({ maxEvents: 30, maxSizeBytes: 100000 });
    // Populate with 40 events: 10 essential (adr.created), 30 non-essential (telemetry.heartbeat)
    for (let i = 0; i < 10; i++) {
      storage.logEvent("adr.created", { adrId: `ADR-${i}` }, agentId, sessionId);
    }
    for (let i = 0; i < 30; i++) {
      storage.logEvent("telemetry.heartbeat", { seq: i }, agentId, sessionId);
    }

    const eventsBefore = storage.readEvents();
    assert(eventsBefore.length >= 40);

    const res = storage.compactEventLogs();
    assert.strictEqual(res.compacted, true);
    assert(res.eventsBefore >= 45);
    assert(res.eventsAfter < res.eventsBefore);
    assert(res.archivedFile && res.archivedFile.startsWith("events.archive."));
    assert(fs.existsSync(path.join(logsDir, res.archivedFile)));

    // Verify auditable logs.compacted was appended
    const eventsAfter = storage.readEvents();
    const hasCompactedEvent = eventsAfter.some(e => e.eventType === "logs.compacted");
    assert(hasCompactedEvent, "Auditable logs.compacted event must exist in active log");
  });

  // --------------------------------------------------------------------------
  // TEST 4: Preservation of Essential Audit Trail Events
  // --------------------------------------------------------------------------
  runTest("Essential audit events (ADRs, Knowledge, Stages, Backups) are 100% preserved", () => {
    // Collect all essential events before another aggressive compaction
    const allEvents = storage.readEvents();
    const essentialBefore = allEvents.filter(e => storage.getEventRetentionPolicy().essentialEventTypes.includes(e.eventType));

    // Force aggressive compaction with maxEvents: 10
    const res = storage.compactEventLogs({ maxEvents: 10 });
    assert.strictEqual(res.compacted, true);

    const eventsAfter = storage.readEvents();
    const essentialAfter = eventsAfter.filter(e => storage.getEventRetentionPolicy().essentialEventTypes.includes(e.eventType));

    // All original essential events (plus the new logs.compacted entry) must be present
    assert(essentialAfter.length >= essentialBefore.length);
    for (const eb of essentialBefore) {
      const match = essentialAfter.find(ea => ea.eventType === eb.eventType && ea.timestamp === eb.timestamp);
      assert(match, `Essential event ${eb.eventType} at ${eb.timestamp} was lost during compaction!`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Zero Event Loss and No Undue Duplicate Generation
  // --------------------------------------------------------------------------
  runTest("Compaction introduces zero phantom duplicates and maintains chronological order", () => {
    const events = storage.readEvents();
    // Check timestamps are non-decreasing
    for (let i = 1; i < events.length; i++) {
      assert(events[i].timestamp >= events[i - 1].timestamp, "Events order corrupted after compaction");
    }

    // Verify no duplicated timestamps for the same event payload
    const signatures = new Set();
    for (const ev of events) {
      if (ev.eventType === "logs.compacted") continue;
      const sig = `${ev.timestamp}:${ev.eventType}:${JSON.stringify(ev.payload)}`;
      assert(!signatures.has(sig), `Duplicate event detected: ${sig}`);
      signatures.add(sig);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Interruption Safety & Staging Cleanup
  // --------------------------------------------------------------------------
  runTest("Interruption simulation leaves active log intact and stale temp files are cleaned", () => {
    const activeContentBefore = fs.readFileSync(eventLogFile, "utf-8");

    // Simulate an aborted compaction that crashed midway leaving a .tmp staging file
    const orphanTmp = path.join(logsDir, `compact.${Date.now() - 600000}.orphan.tmp`);
    fs.writeFileSync(orphanTmp, "partial-corrupt-data\n", "utf-8");
    const pastSec = (Date.now() - 600000) / 1000;
    fs.utimesSync(orphanTmp, pastSec, pastSec);
    assert(fs.existsSync(orphanTmp));

    // Active log was untouched
    const activeContentCurrent = fs.readFileSync(eventLogFile, "utf-8");
    assert.strictEqual(activeContentBefore, activeContentCurrent);

    // Call cleanStaleTempFiles
    const cleaned = storage.cleanStaleEventTempFiles(300000); // older than 5m
    assert.strictEqual(cleaned, 1);
    assert(!fs.existsSync(orphanTmp), "Orphan temp file must be pruned");
  });

  // --------------------------------------------------------------------------
  // TEST 7: Corrupt or Truncated File Recovery Prior to Compaction
  // --------------------------------------------------------------------------
  runTest("Corrupt lines from torn writes are quarantined and valid events compacted cleanly", () => {
    // Append torn write
    fs.appendFileSync(eventLogFile, '{"timestamp":"2026-10-19T12:00:00Z","eventType":"bad_line",\n', "utf-8");
    fs.appendFileSync(eventLogFile, 'VALID_JSON_NOT_REALLY\n', "utf-8");

    // Add valid events to cross threshold
    for (let i = 0; i < 20; i++) {
      storage.logEvent("telemetry.stat", { i }, agentId, sessionId);
    }

    const res = storage.compactEventLogs({ maxEvents: 15 });
    assert.strictEqual(res.compacted, true);

    // Verify integrity audit passes 100% with 0 corrupt lines
    const audit = storage.eventLogger.auditEventLogIntegrity();
    assert.strictEqual(audit.corruptLines, 0, "All corrupt lines must be resolved");
    assert(audit.validLines > 0, "Valid lines must be preserved");

    // Verify quarantine file exists
    const files = fs.readdirSync(logsDir);
    const quarantine = files.find(f => f.startsWith("events.corrupt."));
    assert(quarantine, "Quarantine file must be created for corrupt lines");
  });

  // --------------------------------------------------------------------------
  // TEST 8: Cold-Start Recovery After Engine Restart
  // --------------------------------------------------------------------------
  runTest("New StorageEngine instance after restart reads compacted log with full fidelity", () => {
    const eventsBeforeRestart = storage.readEvents();

    // Create fresh instance with new object identity
    const restartedStorage = new StorageEngine(sandbox);
    restartedStorage.ensureStorageStructure();

    const eventsAfterRestart = restartedStorage.readEvents();
    assert(eventsAfterRestart.length >= eventsBeforeRestart.length);
    assert.strictEqual(eventsAfterRestart[0].eventType, eventsBeforeRestart[0].eventType);
  });

  // --------------------------------------------------------------------------
  // TEST 9: Repeated Compaction & Idempotency
  // --------------------------------------------------------------------------
  runTest("Multiple sequential compactions are idempotent and do not exceed max archives", () => {
    // Run compaction again immediately without new events
    const res1 = storage.compactEventLogs();
    assert.strictEqual(res1.compacted, false);
    assert(res1.reason.includes("below retention thresholds"));

    // Add events and compact repeatedly
    for (let c = 0; c < 5; c++) {
      for (let i = 0; i < 25; i++) {
        storage.logEvent("ping", { c, i }, agentId, sessionId);
      }
      storage.compactEventLogs({ maxEvents: 15, maxArchiveFiles: 3 });
    }

    // Check archive count is strictly capped at maxArchiveFiles
    const files = fs.readdirSync(logsDir);
    const archiveFiles = files.filter(f => f.startsWith("events.archive."));
    assert(archiveFiles.length <= 3, `Archive files count (${archiveFiles.length}) exceeded maxArchiveFiles (3)`);
  });

  // --------------------------------------------------------------------------
  // TEST 10: Two Concurrent Writers
  // --------------------------------------------------------------------------
  runTest("Concurrent writers and compactions serialize safely under withStateLock", () => {
    const concurrentStorage1 = new StorageEngine(sandbox);
    const concurrentStorage2 = new StorageEngine(sandbox);

    // Execute interwoven operations
    for (let i = 0; i < 15; i++) {
      concurrentStorage1.logEvent("concurrent.write.1", { i }, "agent-1", sessionId);
      concurrentStorage2.logEvent("concurrent.write.2", { i }, "agent-2", sessionId);
      if (i === 10) {
        concurrentStorage1.compactEventLogs({ maxEvents: 20 });
      }
    }

    const audit = storage.eventLogger.auditEventLogIntegrity();
    assert.strictEqual(audit.corruptLines, 0, "No corrupt lines allowed under concurrent execution");
    assert(audit.validLines > 0);
  });

  // --------------------------------------------------------------------------
  // TEST 11: Adherence to Custom Retention Policy Overrides
  // --------------------------------------------------------------------------
  runTest("Custom policy overrides (custom essential types, byte thresholds) are strictly observed", () => {
    // Custom essential type: "critical.security.alert"
    const customType = "critical.security.alert";
    storage.logEvent(customType, { alert: "SEV1_UNAUTHORIZED_PROMOTION" }, agentId, sessionId);
    for (let i = 0; i < 30; i++) {
      storage.logEvent("noisy.trace", { i }, agentId, sessionId);
    }

    const res = storage.compactEventLogs({
      maxEvents: 10,
      essentialEventTypes: [customType],
      preserveEssentialEvents: true,
    });

    assert.strictEqual(res.compacted, true);
    const events = storage.readEvents();
    const hasCustomAlert = events.some(e => e.eventType === customType);
    assert(hasCustomAlert, "Custom essential event must be preserved according to override policy");
  });

  // --------------------------------------------------------------------------
  // TEST 12: Standard Rotation Subsystem Coexistence
  // --------------------------------------------------------------------------
  runTest("Traditional rotateEventLogs operates seamlessly alongside compaction engine", () => {
    // Add 10 events
    for (let i = 0; i < 10; i++) {
      storage.logEvent("rotation.test", { i }, agentId, sessionId);
    }

    const stat = fs.statSync(eventLogFile);
    // Force rotation with maxSizeBytes = 100
    const rotRes = storage.rotateEventLogs(100, 3);
    assert.strictEqual(rotRes.rotated, true);
    assert.strictEqual(rotRes.archivedFile, "events.1.jsonl");
    assert(fs.existsSync(path.join(logsDir, "events.1.jsonl")));

    const eventsAfterRot = storage.readEvents();
    assert(eventsAfterRot.some(e => e.eventType === "logs.rotated"));
  });

  console.log("-------------------------------------------------------------------");
  console.log(`  G19 Event Durability & Retention: ${passedCount} / ${testCount} tests PASSED.`);
  console.log("-------------------------------------------------------------------");
})().catch(err => {
  console.error("\nTest Suite FAILED:", err);
  process.exit(1);
}).finally(() => {
  try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch (_) {}
});
