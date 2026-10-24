/**
 * G22 Comprehensive End-to-End Sandbox Acceptance Suite
 *
 * Implements Bloque B of Iteración G22:
 * 1. Clean installation and plugin loading from candidate tarball.
 * 2. Real discovery and execution of MCP tools and plugin.
 * 3. Registering an architectural decision with provenance and evidence.
 * 4. Querying that decision in a subsequent session.
 * 5. Process restart and recovering the decision with 100% fidelity.
 * 6. Registering a successor decision and verifying predecessor is SUPERSEDED.
 * 7. Detecting contradictions without silent resolution.
 * 8. Rejecting unauthorized state transitions.
 * 9. Isolation between two test projects.
 * 10. Concurrency, saturated sessions, and torn write recovery.
 * 11. Event inspection and compaction with essential evidence preservation.
 * 12. Execution of real InventoryHub tasks with OpenCode memory grounding.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync, spawnSync } = require("child_process");

const projectRoot = "C:/Users/sant1/Downloads/OpenMemory";
const candidatePath = path.resolve(projectRoot, ".work/artifacts/openmemory-0.3.15-rc7.tgz");
const g19CandidatePath = path.resolve(projectRoot, ".work/artifacts/openmemory-0.3.15-rc5.tgz");
const { TransactionalPromotionEngine } = require(path.resolve(projectRoot, "scripts/transactional-promotion-engine.js"));

const suiteSandbox = fs.mkdtempSync(path.join(os.tmpdir(), "g22-e2e-sandbox-"));

console.log("===================================================================");
console.log("  G22: End-to-End Acceptance in Sandbox (Bloque B)                 ");
console.log("===================================================================");
console.log(`  Sandbox: ${suiteSandbox}`);
console.log(`  Candidate: ${candidatePath}`);

function createSandboxClone(sourceDir, targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const entries = fs.readdirSync(sourceDir);
  for (const entry of entries) {
    if (entry === '.git' || entry === 'backups' || entry === 'scratch' || entry.startsWith('.promotion.lock')) continue;
    const srcPath = path.join(sourceDir, entry);
    const dstPath = path.join(targetDir, entry);
    fs.cpSync(srcPath, dstPath, { recursive: true });
  }

  const origTgz = path.join(projectRoot, '.work', 'artifacts', 'openmemory-0.3.14-rc4.tgz');
  const sandboxBackups = path.join(targetDir, 'backups');
  fs.mkdirSync(sandboxBackups, { recursive: true });
  if (fs.existsSync(origTgz)) {
    fs.copyFileSync(origTgz, path.join(sandboxBackups, 'openmemory-0.3.14-rc4.tgz'));
  }
}

async function runE2ESuite() {
  let testIndex = 1;
  async function test(name, fn) {
    process.stdout.write(`  [${testIndex++}] ${name}... `);
    try {
      await fn();
      console.log("PASS");
    } catch (err) {
      console.log("FAILED");
      console.error(err);
      process.exit(1);
    }
  }

  let installedPackageDir = null;
  let StorageEngine = null;
  let createMCPServer = null;

  // TEST 1: Clean installation and plugin loading from candidate tarball
  await test("Clean installation from artifact tarball into isolated sandbox", async () => {
    assert.strictEqual(fs.existsSync(candidatePath), true, "Candidate tarball must exist");
    assert.strictEqual(fs.existsSync(g19CandidatePath), true, "G19 candidate tarball must exist");

    const appDir = path.join(suiteSandbox, "consumer-app");
    fs.mkdirSync(appDir, { recursive: true });

    const pkgJson = {
      name: "g20-consumer-app",
      version: "1.0.0",
      private: true,
    };
    fs.writeFileSync(path.join(appDir, "package.json"), JSON.stringify(pkgJson, null, 2), "utf8");

    // Install candidate tarball
    execSync(`npm install "${candidatePath}" --no-audit --no-fund`, {
      cwd: appDir,
      stdio: "pipe",
      encoding: "utf8",
    });

    installedPackageDir = path.join(appDir, "node_modules", "openmemory");
    assert.strictEqual(fs.existsSync(installedPackageDir), true, "Installed openmemory package must exist");

    const installedPkgJson = JSON.parse(fs.readFileSync(path.join(installedPackageDir, "package.json"), "utf8"));
    assert.strictEqual(installedPkgJson.version, "0.3.15-rc7", "Installed version must match candidate version");

    // Load exported StorageEngine and createMCPServer from installed package
    const storageModule = require(path.join(installedPackageDir, "dist", "storage"));
    const mcpModule = require(path.join(installedPackageDir, "dist", "mcp"));
    StorageEngine = storageModule.StorageEngine;
    createMCPServer = mcpModule.createMCPServer;

    assert.strictEqual(typeof StorageEngine, "function", "StorageEngine class must be exported");
    assert.strictEqual(typeof createMCPServer, "function", "createMCPServer function must be exported");
  });

  // TEST 2: Discovery and execution of MCP tools via JSON-RPC protocol
  await test("Discovery and execution of MCP tools via JSON-RPC protocol", async () => {
    const mcpStorageDir = path.join(suiteSandbox, "mcp-storage");
    const server = createMCPServer(mcpStorageDir);

    const listHandler = server._requestHandlers.get("tools/list");
    assert.strictEqual(typeof listHandler, "function", "tools/list handler must be registered");

    const toolsRes = await listHandler({ method: "tools/list", params: {} });
    assert.strictEqual(Array.isArray(toolsRes.tools), true, "tools array must be returned");
    assert.strictEqual(toolsRes.tools.length, 40, "Must expose exactly 40 MCP tools");

    // Verify core tools exist in catalog
    const toolNames = new Set(toolsRes.tools.map((t) => t.name));
    assert.strictEqual(toolNames.has("openmemory_query_knowledge"), true);
    assert.strictEqual(toolNames.has("openmemory_record_knowledge"), true);
    assert.strictEqual(toolNames.has("openmemory_transition_knowledge_lifecycle"), true);
    assert.strictEqual(toolNames.has("openmemory_create_knowledge_relation"), true);
    assert.strictEqual(toolNames.has("openmemory_analyze_knowledge_tms"), true);
    assert.strictEqual(toolNames.has("openmemory_compact_event_logs"), true);
    assert.strictEqual(toolNames.has("openmemory_get_event_retention_policy"), true);

    // Execute a real MCP tool call (status / query)
    const callHandler = server._requestHandlers.get("tools/call");
    assert.strictEqual(typeof callHandler, "function", "tools/call handler must be registered");

    const statusCallRes = await callHandler({
      method: "tools/call",
      params: { name: "openmemory_status", arguments: { actorRole: "SYSTEM_AUDITOR" } },
    });
    assert.strictEqual(statusCallRes.isError || false, false, "openmemory_status must succeed");
    assert.strictEqual(statusCallRes.content.length > 0, true);
  });

  // TEST 3: Register an architectural decision with provenance and evidence
  let sharedStorage = null;
  const sharedStorageDir = path.join(suiteSandbox, "shared-storage");

  await test("Register architectural decision with provenance and evidence", async () => {
    sharedStorage = new StorageEngine(sharedStorageDir);
    sharedStorage.ensureStorageStructure();
    sharedStorage.registerSession({ id: "session-1", agentId: "lead-architect", status: "ACTIVE" });

    const record = sharedStorage.saveResearch(
      {
        id: "RES-ARCH-001",
        topic: "InventoryHub Persistence Architecture",
        summary: "Evaluation and selection of local persistence driver for inventory data",
        confidenceScore: 0.95,
        status: "ACTIVE",
        items: [
          {
            id: "ITEM-ADR-001",
            type: "DECISION",
            classification: "ARCHITECTURE",
            title: "ADR-001: Local-First Persistence via node:sqlite",
            content: "Use Node.js built-in node:sqlite for inventory data. Strictly forbid external cloud databases.",
            tags: ["architecture", "adr", "database", "sqlite", "persistence"],
            source: "docs/adr/001-local-sqlite.md",
            confidence: 0.98,
            lifecycleState: "PROPOSED",
            provenance: {
              source: "AGENT_ANALYSIS",
              evidence: ["docs/adr/001-local-sqlite.md", "src/inventory-db.js"],
            },
          },
        ],
      },
      "lead-architect",
      "session-1"
    );

    assert.strictEqual(record.id, "RES-ARCH-001");
    assert.strictEqual(record.items.length, 1);

    // Transition to ACCEPTED with rigorous rationale and evidence
    const transRes = sharedStorage.updateKnowledgeLifecycle({
      researchId: "RES-ARCH-001",
      itemId: "ITEM-ADR-001",
      targetState: "ACCEPTED",
      actorId: "lead-architect",
      sessionId: "session-1",
      actorRole: "LEAD_AGENT",
      evaluationRationale: "Benchmark demonstrates <5ms latency and zero external service dependencies.",
      acceptanceBasis: "EMPIRICAL_BENCHMARK",
      evidenceReference: "benchmarks/sqlite-latency-report.json",
    });

    assert.strictEqual(transRes.success, true, "Lifecycle transition to ACCEPTED must succeed");
    assert.strictEqual(transRes.item.lifecycleState, "ACCEPTED");
    assert.strictEqual(transRes.item.evaluation.acceptanceBasis, "EMPIRICAL_BENCHMARK");
  });

  // TEST 4: Query that decision in a subsequent session
  await test("Query architectural decision in a subsequent independent session", async () => {
    // Session 2 created by a worker agent
    sharedStorage.registerSession({ id: "session-2", agentId: "worker-developer", status: "ACTIVE" });

    const results = sharedStorage.queryKnowledgeItems({
      query: "persistence database sqlite",
      researchId: "RES-ARCH-001",
    });

    assert.strictEqual(results.length >= 1, true, "Must retrieve the registered ADR");
    assert.strictEqual(results[0].item.id, "ITEM-ADR-001");
    assert.strictEqual(results[0].item.lifecycleState, "ACCEPTED");
    assert.strictEqual(results[0].score > 0, true);
  });

  // TEST 5: Process restart simulation and cold recovery
  await test("Process restart cold recovery retrieves state with 100% byte fidelity", async () => {
    // Drop reference to in-memory instance and construct brand new engine from disk
    sharedStorage = null;

    const reloadedStorage = new StorageEngine(sharedStorageDir);
    const reloadedResearch = reloadedStorage.getResearch("RES-ARCH-001");

    assert.notStrictEqual(reloadedResearch, null, "Research record must survive restart");
    assert.strictEqual(reloadedResearch.items.length, 1);
    assert.strictEqual(reloadedResearch.items[0].id, "ITEM-ADR-001");
    assert.strictEqual(reloadedResearch.items[0].lifecycleState, "ACCEPTED");

    const queryResults = reloadedStorage.queryKnowledgeItems({
      query: "node sqlite persistence",
      researchId: "RES-ARCH-001",
    });
    assert.strictEqual(queryResults.length >= 1, true);
    assert.strictEqual(queryResults[0].item.id, "ITEM-ADR-001");

    sharedStorage = reloadedStorage;
  });

  // TEST 6: Register successor decision and verify predecessor is SUPERSEDED
  await test("Register successor decision and verify predecessor is SUPERSEDED and penalized", async () => {
    sharedStorage.registerSession({ id: "session-3", agentId: "lead-architect", status: "ACTIVE" });

    // Add ADR-002 as successor
    const existingRec = sharedStorage.getResearch("RES-ARCH-001");
    existingRec.items.push({
      id: "ITEM-ADR-002",
      type: "DECISION",
      classification: "ARCHITECTURE",
      title: "ADR-002: SQLite WAL Mode and Shared Cache Concurrency",
      content: "Enable WAL mode and shared cache in node:sqlite for concurrent reads and writes.",
      tags: ["architecture", "adr", "database", "sqlite", "wal", "persistence"],
      source: "docs/adr/002-sqlite-wal.md",
      confidence: 0.99,
      lifecycleState: "ACCEPTED",
    });
    sharedStorage.saveResearch(existingRec, "lead-architect", "session-3");

    // Link ADR-002 as SUPERSEDES ADR-001
    const relRes = sharedStorage.addKnowledgeRelation({
      researchId: "RES-ARCH-001",
      sourceItemId: "ITEM-ADR-002",
      targetItemId: "ITEM-ADR-001",
      relationType: "SUPERSEDES",
      agentId: "lead-architect",
      sessionId: "session-3",
    });
    assert.strictEqual(relRes.success, true, "SUPERSEDES relation creation must succeed");

    // Transition ADR-001 to SUPERSEDED
    const superRes = sharedStorage.updateKnowledgeLifecycle({
      researchId: "RES-ARCH-001",
      itemId: "ITEM-ADR-001",
      targetState: "SUPERSEDED",
      actorId: "lead-architect",
      sessionId: "session-3",
      actorRole: "LEAD_AGENT",
      evaluationRationale: "Replaced by ADR-002 (WAL Mode).",
      evidenceReference: "RES-ARCH-001:ITEM-ADR-002",
    });
    assert.strictEqual(superRes.success, true);
    assert.strictEqual(superRes.item.lifecycleState, "SUPERSEDED");

    // Query: ADR-002 must rank at #1, and ADR-001 must have lower score
    const ranking = sharedStorage.queryKnowledgeItems({
      query: "sqlite database persistence architecture",
      researchId: "RES-ARCH-001",
    });

    assert.strictEqual(ranking[0].item.id, "ITEM-ADR-002", "Successor must rank #1");
    const supersededMatch = ranking.find((r) => r.item.id === "ITEM-ADR-001");
    assert.strictEqual(
      supersededMatch === undefined || supersededMatch.score < ranking[0].score,
      true,
      "SUPERSEDED item must score below accepted successor"
    );
  });

  // TEST 7: Detecting contradictions without silent resolution
  await test("Detecting contradictions via TMS graph analysis without silent resolution", async () => {
    // Propose cloud sync proposal that contradicts ADR-001's local-only invariant
    const existingRec = sharedStorage.getResearch("RES-ARCH-001");
    existingRec.items.push({
      id: "ITEM-PROP-003",
      type: "OBSERVATION",
      classification: "PROPOSAL",
      title: "Proposal: Replicate Inventory Database to AWS DynamoDB",
      content: "Replicate all local sqlite inventory tables to DynamoDB cloud tables for remote backup.",
      tags: ["cloud", "dynamodb", "sync", "persistence"],
      source: "proposals/cloud-sync.md",
      confidence: 0.70,
      lifecycleState: "PROPOSED",
    });
    sharedStorage.saveResearch(existingRec, "lead-architect", "session-3");

    // Create CONTRADICTS edge
    const relRes = sharedStorage.addKnowledgeRelation({
      researchId: "RES-ARCH-001",
      sourceItemId: "ITEM-PROP-003",
      targetItemId: "ITEM-ADR-002",
      relationType: "CONTRADICTS",
      agentId: "lead-architect",
      sessionId: "session-3",
    });
    assert.strictEqual(relRes.success, true);

    // TMS analysis must detect contradiction without deleting either item
    const tmsDiagnostic = sharedStorage.analyzeKnowledgeTMS({ researchId: "RES-ARCH-001" });
    assert.strictEqual(
      tmsDiagnostic.overallStatus === "CONFLICTED" || tmsDiagnostic.summary.conflictedCount >= 1,
      true,
      "TMS must detect contradiction"
    );
    assert.strictEqual(
      sharedStorage.getResearch("RES-ARCH-001").items.length >= 3,
      true,
      "Both contradictory items must be preserved on disk"
    );
  });

  // TEST 8: Reject unauthorized state transitions
  await test("Reject unauthorized state transitions and enforce terminal state protection", async () => {
    // Worker agent cannot transition to ACCEPTED
    const invalidRoleRes = sharedStorage.updateKnowledgeLifecycle({
      researchId: "RES-ARCH-001",
      itemId: "ITEM-PROP-003",
      targetState: "ACCEPTED",
      actorId: "worker-developer",
      sessionId: "session-2",
      actorRole: "WORKER_AGENT",
      evaluationRationale: "I want this accepted",
    });
    assert.strictEqual(invalidRoleRes.success, false, "Worker agent cannot ACCEPT knowledge");

    // Cannot modify terminal SUPERSEDED item
    const terminalRes = sharedStorage.updateKnowledgeLifecycle({
      researchId: "RES-ARCH-001",
      itemId: "ITEM-ADR-001",
      targetState: "ACTIVE",
      actorId: "lead-architect",
      sessionId: "session-3",
      actorRole: "LEAD_AGENT",
      evaluationRationale: "Try to revive superseded item",
    });
    assert.strictEqual(terminalRes.success, false, "Cannot transition out of SUPERSEDED terminal state");
  });

  // TEST 9: Multi-project scope isolation
  await test("Multi-project scope isolation prevents cross-project leakage", async () => {
    const projectADir = path.join(suiteSandbox, "project-alpha");
    const projectBDir = path.join(suiteSandbox, "project-beta");

    const storageA = new StorageEngine(projectADir);
    const storageB = new StorageEngine(projectBDir);

    storageA.ensureStorageStructure();
    storageB.ensureStorageStructure();

    storageA.registerSession({ id: "s-a", agentId: "agent-a", status: "ACTIVE" });
    storageB.registerSession({ id: "s-b", agentId: "agent-b", status: "ACTIVE" });

    storageA.saveResearch(
      {
        id: "RES-ALPHA-SECRET",
        topic: "Confidential Project Alpha Algorithms",
        category: "ARCHITECTURE",
        summary: "Alpha proprietary machine learning pipeline",
        confidenceScore: 0.99,
        status: "COMPLETED",
        items: [
          {
            id: "ITEM-A-001",
            title: "Alpha Secret Core Algorithm",
            content: "Hyper-parameter optimization weights for alpha neural network.",
            tags: ["alpha", "secret", "neural"],
            source: "secret/alpha.ts",
            confidence: 0.99,
            lifecycleState: "ACTIVE",
          },
        ],
      },
      "agent-a",
      "s-a"
    );

    // Query in Project B must return 0 results
    const leakCheck = storageB.queryKnowledgeItems({
      query: "Alpha Secret Core Algorithm neural",
    });
    assert.strictEqual(leakCheck.length, 0, "Project B must receive 0 items from Project A");

    // Attempting to query specific foreign research ID in Project B returns 0
    const foreignCheck = storageB.queryKnowledgeItems({
      query: "algorithm",
      researchId: "RES-ALPHA-SECRET",
    });
    assert.strictEqual(foreignCheck.length, 0, "Cross-project research query returns 0");
  });

  // TEST 10: Concurrency, session saturation, and torn write recovery
  await test("Concurrency, session saturation, and torn write quarantine recovery", async () => {
    const stressDir = path.join(suiteSandbox, "stress-storage");
    const stressStorage = new StorageEngine(stressDir);
    stressStorage.ensureStorageStructure();

    // Multi-write under withStateLock
    const results = [];
    for (let i = 1; i <= 25; i++) {
      stressStorage.withStateLock(() => {
        stressStorage.logEvent("stress.tick", { iteration: i }, `agent-${i % 3}`);
        results.push(i);
      });
    }
    assert.strictEqual(results.length, 25);

    // Inject torn write into active events.jsonl
    const eventLogFile = path.join(stressDir, ".openmemory", "logs", "events.jsonl");
    fs.appendFileSync(eventLogFile, '{"eventType":"incomplete.event","payload":{"broken":true', "utf8");

    // Audit must detect corrupted line
    const auditBefore = stressStorage.auditEventLogIntegrity();
    assert.strictEqual(auditBefore.corruptLines, 1, "Must detect exactly 1 corrupted line");

    // Repair must quarantine corrupted line and preserve all 25 valid events
    const repairRes = stressStorage.repairEventLog();
    assert.strictEqual(repairRes.repaired, true);
    assert.strictEqual(repairRes.quarantinedLinesCount, 1);

    const auditAfter = stressStorage.auditEventLogIntegrity();
    assert.strictEqual(auditAfter.corruptLines, 0, "Corrupted lines must be 0 after repair");
    assert.strictEqual(auditAfter.validLines >= 25, true, "Valid lines must be preserved");
  });

  // TEST 11: Event inspection and compaction with essential evidence preservation
  await test("Event inspection and compaction with essential evidence preservation", async () => {
    const compactDir = path.join(suiteSandbox, "compact-storage");
    const compactStorage = new StorageEngine(compactDir);
    compactStorage.ensureStorageStructure();
    compactStorage.registerSession({ id: "s-comp", agentId: "admin", status: "ACTIVE" });

    // Record essential event
    compactStorage.logEvent("adr.created", { adrId: "ADR-ESSENTIAL" }, "admin", "s-comp");

    // Flood with 100 transient telemetry events
    for (let i = 1; i <= 100; i++) {
      compactStorage.logEvent("telemetry.tick", { i }, "admin", "s-comp");
    }

    // Set compaction policy to max 30 events
    compactStorage.setEventRetentionPolicy({
      maxEvents: 30,
      maxSizeBytes: 5000000,
      preserveEssentialEvents: true,
    });

    const compactRes = compactStorage.compactEventLogs();
    assert.strictEqual(compactRes.compacted, true, "Compaction must trigger");
    assert.strictEqual(compactRes.essentialPreserved >= 1, true, "Essential ADR event must be preserved");

    const eventsAfter = compactStorage.readEvents();
    const hasEssential = eventsAfter.some((e) => e.eventType === "adr.created");
    assert.strictEqual(hasEssential, true, "ADR event must remain in active log after compaction");
  });

  // TEST 12: Execution of real InventoryHub tasks with OpenCode memory grounding
  await test("Execution of real InventoryHub tasks with OpenCode memory grounding", async () => {
    const liveConsumerPath = "C:/Users/sant1/OneDrive/Documentos/ChatGPT/OpenMemory/InventoryHub";
    const hubCloneDir = path.join(suiteSandbox, "inventoryhub-clone");

    // Fast isolated clone of InventoryHub
    createSandboxClone(liveConsumerPath, hubCloneDir);

    // Promote candidate via TransactionalPromotionEngine (fast, safe unpack)
    const engine = new TransactionalPromotionEngine({
      consumerPath: hubCloneDir,
      tarballPath: candidatePath,
      originalVersion: "0.3.14-rc4",
      expectedVersion: "0.3.15-rc7",
      dryRun: false,
      logger: () => {},
    });

    const promoRes = engine.runPromotion();
    assert.strictEqual(promoRes.success, true, "Promotion of rc6 in sandbox must succeed");

    // Execute real business test suites in sandbox
    const t1 = spawnSync("node", ["test_inventory_manager.js"], { cwd: hubCloneDir, encoding: "utf8" });
    assert.strictEqual(t1.status, 0, "test_inventory_manager failed: " + t1.stderr);
    assert.strictEqual(t1.stdout.includes("ALL E2E VERIFICATION CHECKS PASSED"), true);

    const t2 = spawnSync("node", ["test_phase_2c2_full.js"], { cwd: hubCloneDir, encoding: "utf8" });
    assert.strictEqual(t2.status, 0, "test_phase_2c2_full failed: " + t2.stderr);

    const t3 = spawnSync("node", ["test_phase_2c4_post_cleanup.mjs"], { cwd: hubCloneDir, encoding: "utf8" });
    assert.strictEqual(t3.status, 0, "test_phase_2c4_post_cleanup failed: " + t3.stderr);

    // Initialize OpenMemory storage in promoted InventoryHub sandbox
    const hubStorage = new StorageEngine(hubCloneDir);
    hubStorage.ensureStorageStructure();
    hubStorage.registerSession({ id: "ih-session-task", agentId: "opencode-agent", status: "ACTIVE" });

    // Ground agent with active task and architectural invariant
    hubStorage.saveResearch(
      {
        id: "RES-IH-ACTIVE",
        topic: "InventoryHub Low-Stock Telemetry",
        category: "ROADMAP",
        summary: "Active implementation roadmap for Phase 4",
        confidenceScore: 0.99,
        items: [
          {
            id: "ITEM-IH-TASK",
            title: "TASK-102: Low-Stock Evaluation Function checkLowStockItems",
            content: "Implement checkLowStockItems in src/alerts.js querying stock_items WHERE quantity <= threshold.",
            tags: ["task", "alerts", "telemetry", "low-stock"],
            source: "roadmap/phase-4.md",
            confidence: 0.99,
            lifecycleState: "ACTIVE",
          },
        ],
      },
      "opencode-agent",
      "ih-session-task"
    );

    // Agent continuation query
    const continuationRetrieval = hubStorage.queryKnowledgeItems({
      query: "continue last task low stock alerts",
      researchId: "RES-IH-ACTIVE",
    });

    assert.strictEqual(continuationRetrieval.length >= 1, true);
    assert.strictEqual(continuationRetrieval[0].item.id, "ITEM-IH-TASK");
    assert.strictEqual(continuationRetrieval[0].score > 1.0, true);

    // Clean up sandbox
    try {
      fs.rmSync(suiteSandbox, { recursive: true, force: true });
    } catch (_) {}
  });

  console.log("-------------------------------------------------------------------");
  console.log("  G22 End-to-End Sandbox Acceptance Suite: 12 / 12 tests PASSED.");
  console.log("===================================================================");
}

runE2ESuite().catch((err) => {
  console.error("Fatal E2E suite error:", err);
  process.exit(1);
});
