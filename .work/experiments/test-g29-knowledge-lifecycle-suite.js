/**
 * G29: Comprehensive Knowledge Lifecycle & Epistemic Quality Test Suite
 *
 * Validates the 7 critical knowledge lifecycle capabilities of Evocara / OpenMemory:
 * Scenario 1: Decision Registration and Cross-Session Retrieval.
 * Scenario 2: Atomic Decision Supersession and Obsolete Deprecation.
 * Scenario 3: Epistemic Status Differentiation (Verified Fact vs Working Hypothesis).
 * Scenario 4: Complete Provenance & Audit Trail Recovery.
 * Scenario 5: Multi-Project Sandboxing & Fail-Closed Boundary.
 * Scenario 6: Durability & Restart Integrity Across Cold Reboots.
 * Scenario 7: Terminal State Protection and Non-Destructive Invalidation.
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
console.log("  G29: Knowledge Lifecycle & Epistemic Quality Suite              ");
console.log("===================================================================\n");

let passCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  process.stdout.write(`  [TEST ${totalCount}] ${name}... `);
  try {
    fn();
    passCount++;
    console.log("PASS");
  } catch (err) {
    console.log("FAIL");
    console.error(`         Error: ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalCount++;
  process.stdout.write(`  [TEST ${totalCount}] ${name}... `);
  try {
    await fn();
    passCount++;
    console.log("PASS");
  } catch (err) {
    console.log("FAIL");
    console.error(`         Error: ${err.message}`);
    throw err;
  }
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "g29-lifecycle-"));
  const storage = new StorageEngine(tmpDir);
  const tms = new KnowledgeTMS();

  try {
    storage.ensureStorageStructure();

    // -------------------------------------------------------------------------
    // Scenario 1: Decision Registration and Cross-Session Retrieval
    // -------------------------------------------------------------------------
    runTest("Scenario 1: Decision Registration and Cross-Session Retrieval", () => {
      // Session 1: Register initial decision
      const sess1 = storage.registerSession({ agentId: "architect-lead", hostId: "workstation-1" });
      const record1 = storage.saveResearch(
        {
          id: "RES-ARCH-001",
          topic: "Inventory Persistence Architecture",
          category: "ARCHITECTURE",
          summary: "Initial decision on storage layer technology",
          status: "COMPLETED",
          items: [
            {
              id: "DEC-001",
              type: "FINDING",
              classification: "FACT",
              title: "ADR-001: Local-First Persistence via node:sqlite",
              content: "Standardize on Node.js built-in node:sqlite for zero external dependency local-first persistence.",
              tags: ["architecture", "storage", "database", "sqlite"],
              lifecycleState: "ACCEPTED",
              evaluation: {
                evaluatedByAgentId: "architect-lead",
                evaluatedInSessionId: sess1.sessionId || sess1.id,
                evaluatedAt: new Date().toISOString(),
                evaluationRationale: "Validated via 105 canonical benchmarks with zero external dependencies.",
                acceptanceBasis: "EVIDENCE_VALIDATED",
                evidenceReference: "test-g23-expanded-100-benchmark.js",
                actorRole: "LEAD_AGENT",
              },
            },
          ],
        },
        "architect-lead",
        sess1.sessionId || sess1.id
      );

      assert.strictEqual(record1.id, "RES-ARCH-001");
      storage.updateSessionStatus(sess1.sessionId || sess1.id, "COMPLETED");

      // Session 2: Fresh session retrieves decision
      const sess2 = storage.registerSession({ agentId: "developer-agent", hostId: "workstation-2" });
      const matches = storage.queryKnowledgeItems({ query: "sqlite persistence storage architecture" });

      assert(matches.length > 0, "Must retrieve decision in session 2");
      assert.strictEqual(matches[0].item.id, "DEC-001", "Top match must be DEC-001");
      assert.strictEqual(matches[0].item.lifecycleState, "ACCEPTED");
      assert.strictEqual(matches[0].item.evaluation?.evidenceReference, "test-g23-expanded-100-benchmark.js");
    });

    // -------------------------------------------------------------------------
    // Scenario 2: Atomic Decision Supersession and Obsolete Deprecation
    // -------------------------------------------------------------------------
    runTest("Scenario 2: Atomic Decision Supersession and Obsolete Deprecation", () => {
      const sess3 = storage.registerSession({ agentId: "architect-lead", hostId: "workstation-1" });

      // Atomic Supersession: Supersede DEC-001 with DEC-002
      const supersedeResult = storage.supersedeKnowledgeDecision({
        oldItemId: "DEC-001",
        newItem: {
          id: "DEC-002",
          title: "ADR-002: SQLite Single-Writer Facade with WAL Mode",
          content: "Upgrade persistence to Single-Writer Facade with WAL mode and shared cache for crash safety and high concurrency.",
          type: "FINDING",
          classification: "FACT",
          tags: ["architecture", "storage", "database", "sqlite", "wal", "facade"],
          evidenceReference: "test-f71-single-writer-facade-tests.ts",
        },
        evaluationRationale: "Superseding DEC-001 to mandate WAL concurrency and transactional single-writer facade.",
        evidenceReference: "test-f71-single-writer-facade-tests.ts",
        actorRole: "LEAD_AGENT",
        agentId: "architect-lead",
        sessionId: sess3.sessionId || sess3.id,
      });

      assert.strictEqual(supersedeResult.success, true, "Atomic supersession must succeed");
      assert.strictEqual(supersedeResult.supersededItemId, "DEC-001");
      assert.strictEqual(supersedeResult.newItemId, "DEC-002");

      // Verify that old item is now SUPERSEDED
      const updatedRes = storage.getResearch("RES-ARCH-001");
      const oldItem = updatedRes.items.find((it) => it.id === "DEC-001");
      const newItem = updatedRes.items.find((it) => it.id === "DEC-002");

      assert.strictEqual(oldItem.lifecycleState, "SUPERSEDED", "Old item must be marked SUPERSEDED");
      assert.strictEqual(newItem.lifecycleState, "ACCEPTED", "New item must be marked ACCEPTED");

      // Verify canonical SUPERSEDES relation exists
      const relations = storage.getKnowledgeRelations({ relationType: "SUPERSEDES" });
      const supRel = relations.find((r) => r.sourceItemId === "DEC-002" && r.targetItemId === "DEC-001");
      assert(supRel, "Canonical SUPERSEDES relation must link DEC-002 -> DEC-001");

      // Standard Query: returns only active decision DEC-002
      const activeMatches = storage.queryKnowledgeItems({ query: "sqlite persistence storage architecture" });
      assert(activeMatches.length > 0);
      assert.strictEqual(activeMatches[0].item.id, "DEC-002", "Active query must return new decision DEC-002");

      // Query with includeObsolete: false completely excludes superseded item
      const cleanMatches = storage.queryKnowledgeItems({
        query: "sqlite persistence storage",
        includeObsolete: false,
      });
      const foundOld = cleanMatches.some((m) => m.item.id === "DEC-001");
      assert.strictEqual(foundOld, false, "includeObsolete: false must completely exclude DEC-001");

      // Explicit Historical Query: retrieves DEC-001 with historical context
      const historicalMatches = storage.queryKnowledgeItems({ query: "superseded sqlite architecture ADR-001" });
      assert(historicalMatches.length > 0, "Must return matches on explicit historical query");
      assert.strictEqual(historicalMatches[0].item.id, "DEC-001", "Explicit historical query must retrieve DEC-001");
    });

    // -------------------------------------------------------------------------
    // Scenario 3: Epistemic Status Differentiation (Fact vs Hypothesis vs Observation)
    // -------------------------------------------------------------------------
    runTest("Scenario 3: Epistemic Status Differentiation", () => {
      const sess4 = storage.registerSession({ agentId: "qa-lead", hostId: "workstation-1" });

      storage.saveResearch(
        {
          id: "RES-EPISTEMIC-001",
          topic: "Epistemic Knowledge Categorization",
          category: "QA",
          summary: "Demonstrating verified facts vs working hypotheses",
          status: "COMPLETED",
          items: [
            {
              id: "ITEM-FACT-1",
              type: "FINDING",
              classification: "FACT",
              title: "Verified Fact: Benchmark P50 Latency Sub-4ms",
              content: "P50 latency measured at 3.39ms across 105 canonical benchmark scenarios.",
              lifecycleState: "ACCEPTED",
              evaluation: {
                evaluatedByAgentId: "qa-lead",
                evaluatedInSessionId: sess4.sessionId || sess4.id,
                evaluatedAt: new Date().toISOString(),
                evaluationRationale: "Direct empirical telemetry.",
                acceptanceBasis: "EVIDENCE_VALIDATED",
                evidenceReference: "test-g23-expanded-100-benchmark.js",
                actorRole: "LEAD_AGENT",
              },
            },
            {
              id: "ITEM-HYPO-1",
              type: "FINDING",
              classification: "HYPOTHESIS",
              title: "Working Hypothesis: Vector Indexing Boosts Long-Tail Recall",
              content: "Speculation that introducing HNSW vector indexing might improve rare query recall.",
              lifecycleState: "CREATED",
            },
            {
              id: "ITEM-OBS-1",
              type: "SOURCE",
              classification: "OBSERVATION",
              title: "Raw Observation: Developer feedback note",
              content: "A developer noted that query tokenization takes 0.2ms.",
              lifecycleState: "LEGACY_UNEVALUATED",
            },
          ],
        },
        "qa-lead",
        sess4.sessionId || sess4.id
      );

      const res = storage.getResearch("RES-EPISTEMIC-001");
      const factItem = res.items.find((i) => i.id === "ITEM-FACT-1");
      const hypoItem = res.items.find((i) => i.id === "ITEM-HYPO-1");
      const obsItem = res.items.find((i) => i.id === "ITEM-OBS-1");

      assert.strictEqual(getEpistemicStatus(factItem), "VERIFIED_FACT");
      assert.strictEqual(getEpistemicStatus(hypoItem), "WORKING_HYPOTHESIS");
      assert.strictEqual(getEpistemicStatus(obsItem), "UNVALIDATED_OBSERVATION");
    });

    // -------------------------------------------------------------------------
    // Scenario 4: Provenance Tracking & Audit Trail Recovery via MCP
    // -------------------------------------------------------------------------
    await runAsyncTest("Scenario 4: Complete Provenance & Audit Trail Recovery via MCP", async () => {
      const server = createMCPServer(tmpDir);
      const callHandler = server._requestHandlers.get("tools/call");

      const queryRes = await callHandler({
        method: "tools/call",
        params: {
          name: "openmemory_query_knowledge",
          arguments: { query: "Benchmark P50 Latency" },
        },
      });

      assert.strictEqual(queryRes.isError, undefined);
      const outputText = queryRes.content[0].text;

      // Verify enriched epistemic and provenance markdown
      assert(outputText.includes("🟢 [VERIFIED FACT]"), "Must render VERIFIED FACT badge");
      assert(outputText.includes("Agent: qa-lead"), "Must render originating agentId");
      assert(outputText.includes("**Evidence Reference:** `test-g23-expanded-100-benchmark.js`"), "Must render evidence reference");
    });

    // -------------------------------------------------------------------------
    // Scenario 5: Multi-Project Sandboxing & Fail-Closed Boundary
    // -------------------------------------------------------------------------
    await runAsyncTest("Scenario 5: Multi-Project Sandboxing & Fail-Closed Boundary", async () => {
      const server = createMCPServer(tmpDir);
      const callHandler = server._requestHandlers.get("tools/call");

      // Attempt cross-project access to unauthorized project scope
      const crossProjectRes = await callHandler({
        method: "tools/call",
        params: {
          name: "openmemory_query_knowledge",
          arguments: {
            query: "persistence",
            projectId: "ForeignCustomerProjectX",
          },
        },
      });

      assert.strictEqual(crossProjectRes.isError, true, "Cross-project access must fail closed");
      assert(crossProjectRes.content[0].text.includes("Access denied: cross-project query rejected"));
    });

    // -------------------------------------------------------------------------
    // Scenario 6: Durability & Restart Integrity Across Cold Reboots
    // -------------------------------------------------------------------------
    runTest("Scenario 6: Durability & Restart Integrity Across Cold Reboots", () => {
      // Create brand new StorageEngine instance pointing to same tmpDir
      const rebootStorage = new StorageEngine(tmpDir);
      rebootStorage.ensureStorageStructure();

      const reloadedRes1 = rebootStorage.getResearch("RES-ARCH-001");
      assert(reloadedRes1, "Research record must survive reboot");
      assert.strictEqual(reloadedRes1.items.length, 2, "Must retain both items");

      const reloadedOld = reloadedRes1.items.find((i) => i.id === "DEC-001");
      const reloadedNew = reloadedRes1.items.find((i) => i.id === "DEC-002");

      assert.strictEqual(reloadedOld.lifecycleState, "SUPERSEDED");
      assert.strictEqual(reloadedNew.lifecycleState, "ACCEPTED");

      // Verify TMS graph analysis persists across reboot
      const tmsAnalysis = rebootStorage.analyzeKnowledgeTMS();
      assert.strictEqual(tmsAnalysis.summary.totalItems, 5); // 2 from RES-ARCH-001, 3 from RES-EPISTEMIC-001
      assert.strictEqual(tmsAnalysis.items["DEC-001"].canonicalLifecycleState, "SUPERSEDED");
      assert.strictEqual(tmsAnalysis.items["DEC-002"].canonicalLifecycleState, "ACCEPTED");
      assert.strictEqual(tmsAnalysis.items["DEC-001"].derivedLineageStatus, "SUPERSEDED_BY_ACCEPTED_SOURCE");
      assert.strictEqual(tmsAnalysis.items["DEC-002"].derivedLineageStatus, "SUPERSEDING");
    });

    // -------------------------------------------------------------------------
    // Scenario 7: Terminal State Protection and Non-Destructive Invalidation
    // -------------------------------------------------------------------------
    runTest("Scenario 7: Terminal State Protection and Non-Destructive Invalidation", () => {
      const sess5 = storage.registerSession({ agentId: "rogue-agent", hostId: "workstation-1" });

      // Attempt to resurrect SUPERSEDED DEC-001 back to VALIDATED
      const invalidResurrect = storage.updateKnowledgeLifecycle({
        researchId: "RES-ARCH-001",
        itemId: "DEC-001",
        targetState: "VALIDATED",
        actorId: "rogue-agent",
        sessionId: sess5.sessionId || sess5.id,
        evidenceReference: "bogus-evidence",
        evaluationRationale: "Attempting resurrection",
      });

      assert.strictEqual(invalidResurrect.success, false, "Must reject resurrection of SUPERSEDED item");
      assert(invalidResurrect.reason.includes("Terminal state protection"));

      // Attempt to supersede an already SUPERSEDED item
      const invalidDoubleSupersede = storage.supersedeKnowledgeDecision({
        oldItemId: "DEC-001",
        newItem: {
          title: "Double Supersede Attempt",
          content: "Should fail.",
        },
        evaluationRationale: "Invalid attempt",
        agentId: "rogue-agent",
        sessionId: sess5.sessionId || sess5.id,
      });

      assert.strictEqual(invalidDoubleSupersede.success, false, "Must reject double supersession of terminal item");
      assert(invalidDoubleSupersede.reason.includes("Terminal state protection"));

      // Non-destructive preservation: verify DEC-001 still exists in storage
      const res = storage.getResearch("RES-ARCH-001");
      const item = res.items.find((i) => i.id === "DEC-001");
      assert(item, "DEC-001 must remain preserved for audit compliance");
    });

    console.log("\n===================================================================");
    console.log(`  G29 Knowledge Lifecycle Results: ${passCount} / ${totalCount} PASSED (100%)`);
    console.log("===================================================================\n");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("\n[FATAL ERROR IN G29 KNOWLEDGE LIFECYCLE SUITE]:", err);
  process.exit(1);
});
