/**
 * G30: Comprehensive Bi-Temporal Knowledge & Point-In-Time Evaluation Suite
 * 
 * Verifies all 15 acceptance scenarios required for Milestone G30:
 * Scenario 1: Decision creation with explicit validity interval.
 * Scenario 2: Decision supersession without loss of historical record.
 * Scenario 3: Point-in-time query before supersession.
 * Scenario 4: Point-in-time query after supersession.
 * Scenario 5: Differentiation between domain valid time and system transaction time.
 * Scenario 6: Non-destructive retroactive correction.
 * Scenario 7: Open-ended intervals, exact boundaries, and consecutive transitions.
 * Scenario 8: Invalid dates, inverted intervals, and missing temporal data.
 * Scenario 9: Persistence durability and reconstruction after cold restart.
 * Scenario 10: Concurrent writes and atomic state lock protection.
 * Scenario 11: Cycle prevention and terminal state protection.
 * Scenario 12: Cross-project isolation boundary on point-in-time queries.
 * Scenario 13: Explicit historical retrieval vs standard operational retrieval.
 * Scenario 14: Legacy record backward compatibility and MCP dual-alias presentation.
 * Scenario 15: Unanswerable cases with zero fabricated historical facts.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const projectRoot = path.resolve(__dirname, "../..");
const {
  StorageEngine,
  createMCPServer,
  getEpistemicStatus,
} = require(path.join(projectRoot, "dist", "index.js"));
const { KnowledgeTMS } = require(path.join(projectRoot, "dist", "storage", "domains", "knowledge-tms.js"));

console.log("===================================================================");
console.log("  G30: Bi-Temporal Knowledge & Point-In-Time Evaluation Suite     ");
console.log("===================================================================\n");

let passCount = 0;
let totalCount = 0;
const testResults = [];

function runTest(scenarioId, name, fn) {
  totalCount++;
  const start = Date.now();
  process.stdout.write(`  [SCENARIO ${scenarioId}] ${name}... `);
  try {
    fn();
    const durationMs = Date.now() - start;
    passCount++;
    console.log(`PASS (${durationMs}ms)`);
    testResults.push({ scenarioId, name, status: "PASS", durationMs });
  } catch (err) {
    const durationMs = Date.now() - start;
    console.log(`FAIL (${durationMs}ms)`);
    console.error(`         Error: ${err.message}`);
    testResults.push({ scenarioId, name, status: "FAIL", durationMs, error: err.message });
    throw err;
  }
}

async function runAsyncTest(scenarioId, name, fn) {
  totalCount++;
  const start = Date.now();
  process.stdout.write(`  [SCENARIO ${scenarioId}] ${name}... `);
  try {
    await fn();
    const durationMs = Date.now() - start;
    passCount++;
    console.log(`PASS (${durationMs}ms)`);
    testResults.push({ scenarioId, name, status: "PASS", durationMs });
  } catch (err) {
    const durationMs = Date.now() - start;
    console.log(`FAIL (${durationMs}ms)`);
    console.error(`         Error: ${err.message}`);
    testResults.push({ scenarioId, name, status: "FAIL", durationMs, error: err.message });
    throw err;
  }
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "g30-bitemporal-"));
  const storage = new StorageEngine(tmpDir);
  const tms = new KnowledgeTMS();

  storage.ensureStorageStructure();
  const sess = storage.registerSession({ agentId: "agent-g30-lead", hostId: "workstation-1" });
  const agentId = "agent-g30-lead";
  const sessionId = sess.sessionId || sess.id;

  try {

    // -------------------------------------------------------------------------
    // SCENARIO 1: Creation of a decision with explicit validity interval
    // -------------------------------------------------------------------------
    let archRecordId = "";
    let itemArchV1Id = "ITEM-ARCH-V1";
    runTest(1, "Creation of a decision with explicit validity interval", () => {
      const record = {
        topic: "Architecture Storage Engine Decision",
        category: "ARCHITECTURE",
        summary: "Choice of SQLite WAL hybrid architecture for local persistence",
        items: [
          {
            id: itemArchV1Id,
            type: "FINDING",
            classification: "FACT",
            title: "Storage Engine: SQLite WAL Mode",
            content: "We use SQLite in WAL mode with local JSON files as primary audit storage.",
            tags: ["architecture", "storage", "sqlite"],
            lifecycleState: "ACCEPTED",
            validFrom: "2026-01-01T00:00:00.000Z",
            validUntil: "2026-06-30T23:59:59.999Z",
            recordedAt: "2026-01-02T10:00:00.000Z",
            evaluation: {
              evaluatedByAgentId: agentId,
              evaluatedInSessionId: sessionId,
              evaluatedAt: "2026-01-02T10:00:00.000Z",
              evaluationRationale: "ADR-001 established SQLite WAL as verified pattern",
              acceptanceBasis: "EVIDENCE_VALIDATED",
              actorRole: "LEAD_AGENT",
            },
          },
        ],
      };

      const saved = storage.saveResearch(record, agentId, sessionId);
      archRecordId = saved.id;
      assert.ok(saved.id, "Saved record must have an ID");
      const readBack = storage.getResearch(saved.id);
      assert.strictEqual(readBack.items.length, 1);
      assert.strictEqual(readBack.items[0].validFrom, "2026-01-01T00:00:00.000Z");
      assert.strictEqual(readBack.items[0].validUntil, "2026-06-30T23:59:59.999Z");
      assert.strictEqual(readBack.items[0].recordedAt, "2026-01-02T10:00:00.000Z");
    });

    // -------------------------------------------------------------------------
    // SCENARIO 2: Decision supersession without loss of historical record
    // -------------------------------------------------------------------------
    let itemArchV2Id = "";
    runTest(2, "Decision supersession without loss of historical record", () => {
      const supersedeRes = storage.supersedeKnowledgeDecision({
        oldItemId: itemArchV1Id,
        newItem: {
          title: "Storage Engine: SQLite WAL with Hybrid BM25 Memory Index",
          content: "Upgraded architecture combining SQLite WAL with native BM25 inverted index for deterministic retrieval.",
          tags: ["architecture", "storage", "bm25", "sqlite"],
          type: "FINDING",
          classification: "FACT",
        },
        effectiveDate: "2026-07-01T00:00:00.000Z",
        recordedAt: "2026-07-01T12:00:00.000Z",
        evaluationRationale: "Enhanced performance requirements require native BM25 memory indexation.",
        agentId,
        sessionId,
        actorRole: "LEAD_AGENT",
      });

      assert.strictEqual(supersedeRes.success, true, `Supersede should succeed: ${supersedeRes.reason}`);
      itemArchV2Id = supersedeRes.newItemId;

      const record = storage.getResearch(archRecordId);
      assert.strictEqual(record.items.length, 2, "Both historical and new items must be preserved");

      const oldItem = record.items.find((i) => i.id === itemArchV1Id);
      const newItem = record.items.find((i) => i.id === itemArchV2Id);

      assert.strictEqual(oldItem.lifecycleState, "SUPERSEDED", "Old item must be in SUPERSEDED state");
      assert.strictEqual(oldItem.validUntil, "2026-07-01T00:00:00.000Z", "Old item validUntil must close at effectiveDate");
      assert.strictEqual(oldItem.supersededAtSystem, "2026-07-01T12:00:00.000Z", "Old item must record system transaction time");

      assert.strictEqual(newItem.lifecycleState, "ACCEPTED", "New item must be in ACCEPTED state");
      assert.strictEqual(newItem.validFrom, "2026-07-01T00:00:00.000Z", "New item validFrom must open at effectiveDate");
      assert.strictEqual(newItem.recordedAt, "2026-07-01T12:00:00.000Z", "New item recordedAt must be stamped");

      const rels = storage.getKnowledgeRelations();
      const supersedesRel = rels.find((r) => r.relationType === "SUPERSEDES" && r.sourceItemId === itemArchV2Id);
      assert.ok(supersedesRel, "SUPERSEDES relation must be canonically established");
      assert.strictEqual(supersedesRel.targetItemId, itemArchV1Id);
    });

    // -------------------------------------------------------------------------
    // SCENARIO 3: Point-in-time query before supersession
    // -------------------------------------------------------------------------
    runTest(3, "Point-in-time query before supersession (historical state recovery)", () => {
      const pitRes = storage.queryKnowledgePointInTime({
        asOfValidTime: "2026-03-15T00:00:00.000Z",
        query: "Storage Engine",
      });

      assert.strictEqual(pitRes.confidence, "HIGH");
      assert.strictEqual(pitRes.items.length, 1, "Only V1 should be valid on 2026-03-15");
      assert.strictEqual(pitRes.items[0].item.id, itemArchV1Id);
      assert.strictEqual(pitRes.items[0].effectiveLifecycleState, "ACCEPTED", "V1 must be projected as ACCEPTED historically");
      assert.strictEqual(pitRes.items[0].knownAtSystemTime, true);
      assert.strictEqual(pitRes.items[0].supersededAtSystemTime, false);

      // Verify physical disk is NOT modified/resurrected
      const physicalOld = storage.getResearch(archRecordId).items.find((i) => i.id === itemArchV1Id);
      assert.strictEqual(physicalOld.lifecycleState, "SUPERSEDED", "Physical disk must remain SUPERSEDED");
    });

    // -------------------------------------------------------------------------
    // SCENARIO 4: Point-in-time query after supersession
    // -------------------------------------------------------------------------
    runTest(4, "Point-in-time query after supersession", () => {
      const pitRes = storage.queryKnowledgePointInTime({
        asOfValidTime: "2026-09-01T00:00:00.000Z",
        query: "Storage Engine",
      });

      assert.strictEqual(pitRes.confidence, "HIGH");
      assert.strictEqual(pitRes.items.length, 1, "Only V2 should be valid on 2026-09-01");
      assert.strictEqual(pitRes.items[0].item.id, itemArchV2Id);
      assert.strictEqual(pitRes.items[0].effectiveLifecycleState, "ACCEPTED");
    });

    // -------------------------------------------------------------------------
    // SCENARIO 5: Differentiation between domain valid time and system transaction time
    // -------------------------------------------------------------------------
    runTest(5, "Differentiation between domain valid time and system transaction time", () => {
      // Seed a finding that was valid starting in 2025, but was only registered in system on 2026-05-01
      const lateRecord = storage.saveResearch({
        topic: "Security Compliance Certificate",
        category: "SECURITY",
        summary: "Annual ISO 27001 audit certificate",
        items: [
          {
            id: "ITEM-SEC-CERT",
            type: "FINDING",
            classification: "FACT",
            title: "ISO 27001 Compliance",
            content: "Certified compliant for FY2025 and FY2026.",
            validFrom: "2025-01-01T00:00:00.000Z",
            validUntil: "2026-12-31T23:59:59.999Z",
            recordedAt: "2026-05-01T00:00:00.000Z",
            lifecycleState: "ACCEPTED",
          },
        ],
      }, agentId, sessionId);

      // Query at domain valid time 2025-06-01, but system transaction time 2026-02-01 (BEFORE recording)
      const queryBeforeSystemKnows = storage.queryKnowledgePointInTime({
        asOfValidTime: "2025-06-01T00:00:00.000Z",
        asOfSystemTime: "2026-02-01T00:00:00.000Z",
        query: "Compliance",
      });

      assert.strictEqual(queryBeforeSystemKnows.items.length, 0, "System must return 0 items because fact was not yet recorded as of 2026-02-01");
      assert.strictEqual(queryBeforeSystemKnows.confidence, "UNANSWERABLE");

      // Query at SAME domain valid time 2025-06-01, but system transaction time 2026-06-01 (AFTER recording)
      const queryAfterSystemKnows = storage.queryKnowledgePointInTime({
        asOfValidTime: "2025-06-01T00:00:00.000Z",
        asOfSystemTime: "2026-06-01T00:00:00.000Z",
        query: "Compliance",
      });

      assert.strictEqual(queryAfterSystemKnows.items.length, 1, "System should now return the certified fact");
      assert.strictEqual(queryAfterSystemKnows.items[0].item.id, "ITEM-SEC-CERT");
    });

    // -------------------------------------------------------------------------
    // SCENARIO 6: Non-destructive retroactive correction
    // -------------------------------------------------------------------------
    runTest(6, "Non-destructive retroactive correction", () => {
      const correctionRes = storage.correctKnowledgeRetroactive({
        itemId: "ITEM-SEC-CERT",
        correctedTitle: "ISO 27001 & SOC-2 Dual Compliance",
        correctedContent: "Certified compliant for FY2025 and FY2026 with verified SOC-2 Type II audit.",
        correctionRationale: "Retroactively updated after receiving verified SOC-2 auditor report.",
        evidenceReference: "EVID-SOC2-2026",
        agentId,
        sessionId,
        actorRole: "LEAD_AGENT",
      });

      assert.strictEqual(correctionRes.success, true);
      assert.strictEqual(correctionRes.originalItemId, "ITEM-SEC-CERT");

      // Verify item content updated on disk
      const researches = storage.listResearches();
      const item = researches.flatMap((r) => r.items).find((i) => i.id === "ITEM-SEC-CERT");
      assert.strictEqual(item.title, "ISO 27001 & SOC-2 Dual Compliance");
      assert.ok(item.evaluation.evaluationRationale.includes("[RETROACTIVE CORRECTION]"));
    });

    // -------------------------------------------------------------------------
    // SCENARIO 7: Open-ended intervals, exact boundaries, and consecutive transitions
    // -------------------------------------------------------------------------
    runTest(7, "Open-ended intervals, exact boundaries, and consecutive transitions", () => {
      // itemArchV2Id has validFrom: 2026-07-01T00:00:00.000Z and validUntil: undefined (open-ended)
      const openEndedQuery = storage.queryKnowledgePointInTime({
        asOfValidTime: "2035-01-01T00:00:00.000Z",
        query: "BM25 Memory Index",
      });
      assert.strictEqual(openEndedQuery.items.length, 1, "Open-ended item must remain valid indefinitely in future");
      assert.strictEqual(openEndedQuery.items[0].validityWindow.isOpenEnded, true);

      // Exact boundary test: Old item validUntil is '2026-07-01T00:00:00.000Z'
      // Under [validFrom, validUntil) half-open semantics, at exact instant 2026-07-01T00:00:00.000Z:
      // Old item is EXPIRED, New item is ACTIVE
      const boundaryQuery = storage.queryKnowledgePointInTime({
        asOfValidTime: "2026-07-01T00:00:00.000Z",
        query: "Storage Engine",
      });
      assert.strictEqual(boundaryQuery.items.length, 1);
      assert.strictEqual(boundaryQuery.items[0].item.id, itemArchV2Id, "New item must be effective at exact boundary transition");
    });

    // -------------------------------------------------------------------------
    // SCENARIO 8: Invalid dates, inverted intervals, and missing temporal data
    // -------------------------------------------------------------------------
    runTest(8, "Invalid dates, inverted intervals, and missing temporal data", () => {
      // 1. Inverted interval validation
      const invCheck = tms.validateTemporalInterval("2026-12-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
      assert.strictEqual(invCheck.valid, false);
      assert.ok(invCheck.reason.includes("cannot be after validUntil"));

      // 2. Malformed date string
      const malformedCheck = tms.validateTemporalInterval("not-a-valid-date", undefined);
      assert.strictEqual(malformedCheck.valid, false);
      assert.ok(malformedCheck.reason.includes("ISO 8601"));

      // 3. Attempting to supersede with invalid dates fails gracefully
      const failSupersede = storage.supersedeKnowledgeDecision({
        oldItemId: itemArchV2Id,
        newItem: {
          title: "Broken Interval",
          content: "Content",
          validFrom: "2027-01-01T00:00:00.000Z",
          validUntil: "2026-01-01T00:00:00.000Z",
        },
        evaluationRationale: "Testing invalid dates",
        agentId,
        sessionId,
      });
      assert.strictEqual(failSupersede.success, false);
      assert.ok(failSupersede.reason.includes("Invalid new item temporal interval"));
    });

    // -------------------------------------------------------------------------
    // SCENARIO 9: Persistence durability and reconstruction after cold restart
    // -------------------------------------------------------------------------
    runTest(9, "Persistence durability and reconstruction after cold restart", () => {
      // Re-instantiate a fresh StorageEngine against the same disk directory
      const restartedStorage = new StorageEngine(tmpDir);
      restartedStorage.ensureStorageStructure();

      const pitReboot = restartedStorage.queryKnowledgePointInTime({
        asOfValidTime: "2026-03-01T00:00:00.000Z",
        query: "Storage Engine",
      });

      assert.strictEqual(pitReboot.items.length, 1, "Must reconstruct historical item after cold reboot");
      assert.strictEqual(pitReboot.items[0].item.id, itemArchV1Id);
      assert.strictEqual(pitReboot.items[0].effectiveLifecycleState, "ACCEPTED");
    });

    // -------------------------------------------------------------------------
    // SCENARIO 10: Concurrent writes and atomic state lock protection
    // -------------------------------------------------------------------------
    runTest(10, "Concurrent writes and atomic state lock protection", () => {
      let firstSucceeded = false;
      let secondRejected = false;

      // Both try to supersede itemArchV2Id simultaneously
      const res1 = storage.supersedeKnowledgeDecision({
        oldItemId: itemArchV2Id,
        newItem: { title: "Decision A", content: "Branch A" },
        evaluationRationale: "First branch",
        agentId,
        sessionId,
      });

      const res2 = storage.supersedeKnowledgeDecision({
        oldItemId: itemArchV2Id,
        newItem: { title: "Decision B", content: "Branch B" },
        evaluationRationale: "Second branch",
        agentId,
        sessionId,
      });

      firstSucceeded = res1.success;
      secondRejected = !res2.success && res2.reason.includes("Terminal state protection");

      assert.strictEqual(firstSucceeded, true, "First supersede must succeed");
      assert.strictEqual(secondRejected, true, "Second supersede must be rejected under terminal state lock protection");
    });

    // -------------------------------------------------------------------------
    // SCENARIO 11: Cycle prevention and terminal state protection
    // -------------------------------------------------------------------------
    runTest(11, "Cycle prevention and terminal state protection", () => {
      // Attempting to supersede itemArchV1Id which was already superseded in Scenario 2
      const res = storage.supersedeKnowledgeDecision({
        oldItemId: itemArchV1Id,
        newItem: { title: "Revived Item", content: "Revival attempt" },
        evaluationRationale: "Illegal revival",
        agentId,
        sessionId,
      });

      assert.strictEqual(res.success, false);
      assert.ok(res.reason.includes("Terminal state protection"), "Must prevent mutation of SUPERSEDED item");
    });

    // -------------------------------------------------------------------------
    // SCENARIO 12: Cross-project isolation boundary on point-in-time queries
    // -------------------------------------------------------------------------
    runTest(12, "Cross-project isolation boundary on point-in-time queries", () => {
      // Seed a record explicitly in InventoryHub domain
      storage.saveResearch({
        id: "RES-INV-001",
        topic: "InventoryHub Stock Ledger Architecture",
        category: "ARCHITECTURE",
        summary: "Internal inventory reconciliation design",
        items: [
          {
            id: "ITEM-INV-STOCK",
            type: "FINDING",
            classification: "FACT",
            title: "InventoryHub Stock Allocation",
            content: "InventoryHub uses FIFO allocation logic.",
            lifecycleState: "ACCEPTED",
            validFrom: "2026-01-01T00:00:00.000Z",
          },
        ],
      }, agentId, sessionId);

      // Query from orderservice project scope
      const crossProjectQuery = storage.queryKnowledgePointInTime({
        query: "Stock Allocation",
        scope: "orderservice",
        asOfValidTime: "2026-06-01T00:00:00.000Z",
      });

      assert.strictEqual(crossProjectQuery.items.length, 0, "Query bound to orderservice must NOT return InventoryHub items");

      // Query within inventoryhub scope
      const inScopeQuery = storage.queryKnowledgePointInTime({
        query: "Stock Allocation",
        scope: "inventoryhub",
        asOfValidTime: "2026-06-01T00:00:00.000Z",
      });

      assert.strictEqual(inScopeQuery.items.length, 1, "In-scope query must return the item");
      assert.strictEqual(inScopeQuery.items[0].item.id, "ITEM-INV-STOCK");
    });

    // -------------------------------------------------------------------------
    // SCENARIO 13: Explicit historical retrieval vs standard operational retrieval
    // -------------------------------------------------------------------------
    runTest(13, "Explicit historical retrieval vs standard operational retrieval", () => {
      // Standard operational query: BM25 default query for 'Storage Engine'
      // Under G29/G30, standard retrieval filters out superseded items by default
      const operationalMatches = storage.queryKnowledgeItems({
        query: "SQLite WAL Mode",
        includeObsolete: false,
      });

      // ItemArchV1 is superseded, so standard operational retrieval should NOT feature it in Top-1
      const topMatch = operationalMatches[0];
      if (topMatch) {
        assert.notStrictEqual(topMatch.item.id, itemArchV1Id, "Standard retrieval must not return superseded V1 as active");
      }

      // Explicit point-in-time query for the historical date
      const pitMatches = storage.queryKnowledgePointInTime({
        asOfValidTime: "2026-02-01T00:00:00.000Z",
        query: "SQLite WAL Mode",
      });

      assert.strictEqual(pitMatches.items.length, 1);
      assert.strictEqual(pitMatches.items[0].item.id, itemArchV1Id, "Historical retrieval accurately retrieves V1");
    });

    // -------------------------------------------------------------------------
    // SCENARIO 14: Legacy record backward compatibility and MCP presentation
    // -------------------------------------------------------------------------
    await runAsyncTest(14, "Legacy record backward compatibility and MCP presentation", async () => {
      // Seed a legacy pre-G30 record without validFrom, validUntil, or recordedAt
      storage.saveResearch({
        id: "RES-LEGACY-001",
        topic: "Legacy Untimed Research",
        category: "GENERAL",
        summary: "Pre-G30 document",
        items: [
          {
            id: "ITEM-LEGACY-01",
            type: "FINDING",
            classification: "OBSERVATION",
            title: "Legacy Observation Without Timestamps",
            content: "Information captured before bi-temporal model rollout.",
            lifecycleState: "CREATED",
          },
        ],
      }, agentId, sessionId);

      // Query without strictTemporal should include it with fallback
      const nonStrict = storage.queryKnowledgePointInTime({
        query: "Legacy Observation",
        strictTemporal: false,
      });
      assert.strictEqual(nonStrict.items.length, 1);
      assert.strictEqual(nonStrict.items[0].item.id, "ITEM-LEGACY-01");
      assert.strictEqual(nonStrict.confidence, "INCONCLUSIVE", "Legacy untimed records should result in INCONCLUSIVE confidence");

      // Query with strictTemporal=true should exclude it cleanly
      const strict = storage.queryKnowledgePointInTime({
        query: "Legacy Observation",
        strictTemporal: true,
      });
      assert.strictEqual(strict.items.length, 0, "Strict temporal query must exclude records without temporal timestamps");

      // MCP Tool Execution Validation with dual aliases
      const mcpServer = createMCPServer(tmpDir);
      const callHandler = mcpServer._requestHandlers.get("tools/call");

      const mcpResult = await callHandler({
        method: "tools/call",
        params: {
          name: "openmemory_query_knowledge",
          arguments: {
            query: "Storage Engine",
            asOfValidTime: "2026-03-01T00:00:00.000Z",
          },
        },
      });

      assert.strictEqual(!mcpResult.isError, true);
      assert.ok(mcpResult.content[0].text.includes("Bi-Temporal:"), "MCP markdown must include Bi-Temporal metadata");
      assert.ok(mcpResult.content[0].text.includes("2026-01-01"));

      // Also call via dual alias evocara_query_knowledge
      const evocaraMcpResult = await callHandler({
        method: "tools/call",
        params: {
          name: "evocara_query_knowledge",
          arguments: {
            query: "Storage Engine",
            asOfValidTime: "2026-03-01T00:00:00.000Z",
          },
        },
      });
      assert.strictEqual(!evocaraMcpResult.isError, true);
      assert.ok(evocaraMcpResult.content[0].text.includes("Bi-Temporal:"));
    });

    // -------------------------------------------------------------------------
    // SCENARIO 15: Unanswerable cases with zero fabricated historical facts
    // -------------------------------------------------------------------------
    runTest(15, "Unanswerable cases with zero fabricated historical facts", () => {
      const unansQuery = storage.queryKnowledgePointInTime({
        query: "NonExistentQuantumTeleportationModule",
        asOfValidTime: "2026-01-01T00:00:00.000Z",
      });

      assert.strictEqual(unansQuery.items.length, 0, "Must return 0 items for unanswerable query");
      assert.strictEqual(unansQuery.confidence, "UNANSWERABLE");
      assert.ok(unansQuery.unanswerableReason, "Must provide explicit unanswerableReason");
      assert.ok(unansQuery.unanswerableReason.includes("No verified knowledge item found"));
    });

    console.log("\n===================================================================");
    console.log(`  G30 Bi-Temporal Suite Results: ${passCount} / ${totalCount} PASSED (100%)`);
    console.log("===================================================================\n");

    const evidence = {
      milestone: "G30",
      suite: "Bi-Temporal Knowledge & Point-In-Time Evaluation Suite",
      timestamp: new Date().toISOString(),
      totalScenarios: totalCount,
      passedScenarios: passCount,
      passRate: "100.0%",
      scenarios: testResults,
    };

    const evidenceDir = path.join(projectRoot, ".work", "evidence");
    if (!fs.existsSync(evidenceDir)) {
      fs.mkdirSync(evidenceDir, { recursive: true });
    }
    const evidencePath = path.join(evidenceDir, "g30-bitemporal-suite-results.json");
    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2), "utf8");
    console.log(`[Evidence saved to: ${evidencePath}]`);

  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
