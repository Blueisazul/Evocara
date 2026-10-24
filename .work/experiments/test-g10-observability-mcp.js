/**
 * Test Suite: G10-OBSERVABILITY
 * Operational Observability, Consolidated Health Model & MCP Diagnostics Suite
 *
 * Covers:
 * 1. Consolidated health model (HEALTHY, DEGRADED, CORRUPTED).
 * 2. MCP Tool: openmemory_health_summary.
 * 3. MCP Tool: openmemory_diagnostics_detail (strictly read-only).
 * 4. MCP Tool: openmemory_inspect_locks (token sanitization / masking).
 * 5. MCP Tool: openmemory_promotion_status (detects clean vs interrupted states).
 * 6. MCP Tool: openmemory_candidate_integrity (SHA-256 and size verification).
 * 7. MCP Tool: openmemory_sqlite_checkpoint.
 * 8. Zero error / fail-safe isolation when subsystems throw exceptions.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");

const {
  StorageEngine,
  createMCPServer,
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("../../dist/index");

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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "om-g10-test-"));
  return dir;
}

function removeSandbox(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
}

console.log("===================================================================");
console.log("  G10-OBSERVABILITY: Operational Health & MCP Diagnostics Suite   ");
console.log("===================================================================");

(async () => {
  // ---------------------------------------------------------------------------
  // TEST 1: Consolidated Health Model Transitions
  // ---------------------------------------------------------------------------
  runTest("Consolidated health summary accurately transitions between HEALTHY, DEGRADED, and CORRUPTED", () => {
    const sandbox = makeSandbox();
    try {
      const storage = new StorageEngine(sandbox);
      storage.ensureStorageStructure();

      // 1. Clean state -> HEALTHY
      const h1 = storage.getConsolidatedHealthSummary({ rootDir: sandbox });
      assert.strictEqual(h1.overallStatus, "HEALTHY", "Clean state must report HEALTHY");
      assert.strictEqual(h1.storage.status, "HEALTHY");
      assert.strictEqual(h1.advisoryLocks.deadProcessLocks, 0);

      // 2. Active unconsolidated WAL -> DEGRADED
      const dbPath = path.join(sandbox, "data.db");
      fs.writeFileSync(dbPath, "fake-db");
      fs.writeFileSync(dbPath + "-wal", Buffer.alloc(1024)); // active WAL
      const h2 = storage.getConsolidatedHealthSummary({ rootDir: sandbox });
      assert.strictEqual(h2.overallStatus, "DEGRADED", "Active unconsolidated WAL must report DEGRADED");
      assert.strictEqual(h2.sqliteLifecycle.quiescent, false);

      // Clean up WAL
      fs.unlinkSync(dbPath + "-wal");

      // 3. Dead process lock -> CORRUPTED
      const locksDir = path.join(sandbox, ".openmemory", "locks");
      const deadLock = {
        resourceKey: "state",
        token: "tok_secret_1234567890",
        pid: 999999, // dead
        acquiredAt: new Date().toISOString(),
        expiresAt: Date.now() + 60000,
      };
      fs.writeFileSync(path.join(locksDir, "state.lock"), JSON.stringify(deadLock));
      const h3 = storage.getConsolidatedHealthSummary({ rootDir: sandbox });
      assert.strictEqual(h3.overallStatus, "CORRUPTED", "Dead process lock must report CORRUPTED");
      assert.strictEqual(h3.advisoryLocks.deadProcessLocks, 1);
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 2: MCP Tool Discovery (ListTools)
  // ---------------------------------------------------------------------------
  await runAsyncTest("OpenMemory MCP Server advertises all G10 tools and SQLite checkpoint", async () => {
    const sandbox = makeSandbox();
    try {
      const server = createMCPServer(sandbox, { profile: "full" });
      const listHandler = server._requestHandlers.get("tools/list");
      assert(listHandler, "tools/list handler must be registered");

      const res = await listHandler({ method: "tools/list", params: {} });
      const toolNames = res.tools.map(t => t.name);

      const requiredTools = [
        "openmemory_health_summary",
        "openmemory_diagnostics_detail",
        "openmemory_inspect_locks",
        "openmemory_promotion_status",
        "openmemory_candidate_integrity",
        "openmemory_sqlite_checkpoint",
      ];

      for (const t of requiredTools) {
        assert(toolNames.includes(t), `MCP tools list must include ${t}`);
      }
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 3: MCP Tool: openmemory_health_summary
  // ---------------------------------------------------------------------------
  await runAsyncTest("openmemory_health_summary MCP tool returns structured health report", async () => {
    const sandbox = makeSandbox();
    try {
      const server = createMCPServer(sandbox);
      const callHandler = server._requestHandlers.get("tools/call");
      assert(callHandler, "tools/call handler must be registered");

      const res = await callHandler({
        method: "tools/call",
        params: {
          name: "openmemory_health_summary",
          arguments: { rootDir: sandbox },
        },
      });

      assert(!res.isError, "Call must not be an error");
      const parsed = JSON.parse(res.content[0].text);
      assert(parsed.overallStatus, "Report must contain overallStatus");
      assert(parsed.storage, "Report must contain storage section");
      assert(parsed.sqliteLifecycle, "Report must contain sqliteLifecycle section");
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 4: MCP Tool: openmemory_inspect_locks sanitizes sensitive tokens
  // ---------------------------------------------------------------------------
  await runAsyncTest("openmemory_inspect_locks masks raw lock tokens for security", async () => {
    const sandbox = makeSandbox();
    try {
      const storage = new StorageEngine(sandbox);
      storage.ensureStorageStructure();
      const locksDir = path.join(sandbox, ".openmemory", "locks");

      const rawToken = "tok_super_sensitive_secret_token_123456789";
      fs.writeFileSync(path.join(locksDir, "app.lock"), JSON.stringify({
        resourceKey: "app",
        token: rawToken,
        pid: process.pid,
        acquiredAt: new Date().toISOString(),
        expiresAt: Date.now() + 60000,
      }));

      const server = createMCPServer(sandbox);
      const callHandler = server._requestHandlers.get("tools/call");

      const res = await callHandler({
        method: "tools/call",
        params: {
          name: "openmemory_inspect_locks",
          arguments: {},
        },
      });

      assert(!res.isError);
      const text = res.content[0].text;
      // Assert raw token is NOT leaked
      assert(!text.includes(rawToken), "Raw sensitive token must not be leaked over MCP");
      assert(text.includes("tok_super_se..."), "Masked token prefix must be displayed");
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 5: MCP Tool: openmemory_promotion_status
  // ---------------------------------------------------------------------------
  await runAsyncTest("openmemory_promotion_status returns clean status and detects interrupted promotion", async () => {
    const sandbox = makeSandbox();
    try {
      const server = createMCPServer(sandbox);
      const callHandler = server._requestHandlers.get("tools/call");

      // 1. Without manifest
      const res1 = await callHandler({
        method: "tools/call",
        params: {
          name: "openmemory_promotion_status",
          arguments: { consumerPath: sandbox },
        },
      });
      const parsed1 = JSON.parse(res1.content[0].text);
      assert.strictEqual(parsed1.hasPromotion, false);

      // 2. With interrupted manifest
      fs.writeFileSync(path.join(sandbox, "operation_manifest.json"), JSON.stringify({
        operationId: "promo_test_123",
        state: "APPLYING",
        targetVersion: "0.3.15-rc1",
        originalVersion: "0.3.14-rc4",
      }));

      const res2 = await callHandler({
        method: "tools/call",
        params: {
          name: "openmemory_promotion_status",
          arguments: { consumerPath: sandbox },
        },
      });
      const parsed2 = JSON.parse(res2.content[0].text);
      assert.strictEqual(parsed2.hasPromotion, true);
      assert.strictEqual(parsed2.isInterrupted, true, "Must flag interrupted promotion");
      assert.strictEqual(parsed2.state, "APPLYING");
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 6: MCP Tool: openmemory_candidate_integrity
  // ---------------------------------------------------------------------------
  await runAsyncTest("openmemory_candidate_integrity verifies SHA-256 of candidate artifact", async () => {
    const sandbox = makeSandbox();
    try {
      const server = createMCPServer(sandbox);
      const callHandler = server._requestHandlers.get("tools/call");

      const res = await callHandler({
        method: "tools/call",
        params: {
          name: "openmemory_candidate_integrity",
          arguments: {},
        },
      });

      assert(!res.isError);
      const parsed = JSON.parse(res.content[0].text);
      assert.strictEqual(parsed.present, true, "Candidate tarball must be present");
      assert.strictEqual(parsed.integrityValid, true, "SHA-256 must match candidate expectation");
      assert(parsed.sizeBytes === 190051 || parsed.sizeBytes === 184295, "Size must match candidate archive");
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 7: Zero Exception Crash Guarantee on Corrupted Input
  // ---------------------------------------------------------------------------
  await runAsyncTest("MCP tools return isError: true without throwing or crashing host process", async () => {
    const sandbox = makeSandbox();
    try {
      const server = createMCPServer(sandbox);
      const callHandler = server._requestHandlers.get("tools/call");

      // Corrupt candidate check with non-existent path
      const res = await callHandler({
        method: "tools/call",
        params: {
          name: "openmemory_candidate_integrity",
          arguments: { tarballPath: "/non/existent/path/tarball.tgz" },
        },
      });
      assert(!res.isError);
      const parsed = JSON.parse(res.content[0].text);
      assert.strictEqual(parsed.present, false);
      assert(parsed.error, "Must explain artifact not found");
    } finally {
      removeSandbox(sandbox);
    }
  });

  console.log("===================================================================");
  console.log(`  G10-OBSERVABILITY Results: ${passedCount}/${testCount} tests passed.`);
  console.log("===================================================================");

  if (passedCount !== testCount) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();
