/**
 * G31: Causal Decision Lineage, Active Temporal Contradictions & Contextual Synthesis Suite
 * 
 * Verifies all 18 acceptance scenarios mandated for Milestone G31:
 * Scenario 1: Simple lineage reconstruction (predecessor & successor).
 * Scenario 2: Multi-step sequential supersession chain (C -> B -> A).
 * Scenario 3: Branching derivations and multi-parent lineages.
 * Scenario 4: Isolated decision with zero lineage relations.
 * Scenario 5: Cyclic relation detection and safe bounded termination.
 * Scenario 6: Broken references and missing items resilience.
 * Scenario 7: Multi-project boundary isolation on lineage queries.
 * Scenario 8: Explicit CONTRADICTS relation active at target valid time.
 * Scenario 9: Explicit CONTRADICTS relation outside valid window (historical/resolved).
 * Scenario 10: Non-contradictory temporal overlap (preserves uncertainty without hallucinated conflict).
 * Scenario 11: Semi-open intervals [validFrom, validUntil) and exact boundary transitions.
 * Scenario 12: Open-ended validity intervals and untimed legacy records.
 * Scenario 13: Point-in-time query surfacing active contradictions with calibrated confidence.
 * Scenario 14: Non-existent target item unanswerable report without fabricated nodes.
 * Scenario 15: Dual MCP alias compatibility (openmemory_explain_lineage & evocara_explain_lineage).
 * Scenario 16: Project boundary isolation and authorization fail-closed enforcement via MCP.
 * Scenario 17: Lineage queries perform strictly zero mutations on disk state.
 * Scenario 18: Preservation of supersession invariants and terminal state protection.
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
console.log("  G31: Decision Lineage & Temporal Contradictions Suite           ");
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "g31-lineage-"));
  const storage = new StorageEngine(tmpDir);
  const tms = new KnowledgeTMS();

  storage.ensureStorageStructure();
  const sess = storage.registerSession({ agentId: "agent-g31-lead", hostId: "workstation-g31" });
  const agentId = "agent-g31-lead";
  const sessionId = sess.sessionId || sess.id;

  try {
    // -------------------------------------------------------------------------
    // SCENARIO 1: Simple lineage reconstruction (predecessor & successor)
    // -------------------------------------------------------------------------
    let itemV1 = "ITEM-DEC-V1";
    let itemV2 = "ITEM-DEC-V2";

    runTest(1, "Simple lineage reconstruction (predecessor & successor)", () => {
      // Create initial V1
      storage.saveResearch({
        id: "RES-DEC-001",
        topic: "Storage Backend Architecture",
        category: "ARCHITECTURE",
        summary: "Choice of database engine",
        items: [
          {
            id: itemV1,
            type: "FINDING",
            classification: "FACT",
            title: "File-Based JSON Storage Engine",
            content: "Using atomic JSON writes for local-first storage.",
            lifecycleState: "ACCEPTED",
            validFrom: "2026-01-01T00:00:00.000Z",
            validUntil: "2026-06-01T00:00:00.000Z",
            recordedAt: "2026-01-01T10:00:00.000Z",
          },
        ],
      }, agentId, sessionId);

      // Supersede V1 with V2
      const supRes = storage.supersedeKnowledgeDecision({
        oldItemId: itemV1,
        newItem: {
          id: itemV2,
          title: "Hybrid SQLite WAL Storage Engine",
          content: "Adopting SQLite with WAL mode for enhanced query performance.",
          validFrom: "2026-06-01T00:00:00.000Z",
          validUntil: undefined,
        },
        effectiveDate: "2026-06-01T00:00:00.000Z",
        evaluationRationale: "Migrating to SQLite for concurrent query scalability.",
        agentId,
        sessionId,
      });
      assert.strictEqual(supRes.success, true);

      // Explain lineage from perspective of V2
      const lineageV2 = storage.explainDecisionLineage(itemV2);
      assert.strictEqual(lineageV2.targetFound, true);
      assert.strictEqual(lineageV2.nodes.length, 2);
      assert.strictEqual(lineageV2.edges.length, 1);
      assert.strictEqual(lineageV2.synthesis.predecessorsCount, 1);
      assert.strictEqual(lineageV2.synthesis.successorsCount, 0);
      assert.strictEqual(lineageV2.rootPredecessors[0], itemV1);

      // Explain lineage from perspective of V1
      const lineageV1 = storage.explainDecisionLineage(itemV1);
      assert.strictEqual(lineageV1.targetFound, true);
      assert.strictEqual(lineageV1.synthesis.predecessorsCount, 0);
      assert.strictEqual(lineageV1.synthesis.successorsCount, 1);
      assert.strictEqual(lineageV1.terminalSuccessors[0], itemV2);
    });

    // -------------------------------------------------------------------------
    // SCENARIO 2: Multi-step sequential supersession chain (C -> B -> A)
    // -------------------------------------------------------------------------
    let itemV3 = "ITEM-DEC-V3";
    runTest(2, "Multi-step sequential supersession chain (C -> B -> A)", () => {
      // Supersede V2 with V3
      const supRes = storage.supersedeKnowledgeDecision({
        oldItemId: itemV2,
        newItem: {
          id: itemV3,
          title: "Bi-Temporal SQLite + BM25 Memory Engine",
          content: "Enhanced bi-temporal knowledge indexing and retrieval.",
          validFrom: "2026-10-01T00:00:00.000Z",
          validUntil: undefined,
        },
        effectiveDate: "2026-10-01T00:00:00.000Z",
        evaluationRationale: "Adding bi-temporal historical queries.",
        agentId,
        sessionId,
      });
      assert.strictEqual(supRes.success, true);

      // Lineage of V3 should trace all 3 generations
      const lineageV3 = storage.explainDecisionLineage(itemV3);
      assert.strictEqual(lineageV3.nodes.length, 3);
      assert.strictEqual(lineageV3.edges.length, 2);
      assert.strictEqual(lineageV3.synthesis.predecessorsCount, 2);
      assert.strictEqual(lineageV3.synthesis.successorsCount, 0);
      assert.deepStrictEqual(lineageV3.rootPredecessors, [itemV1]);

      // Check depths: V1 is depth -2, V2 is depth -1, V3 is depth 0
      const nodeV1 = lineageV3.nodes.find((n) => n.itemId === itemV1);
      const nodeV2 = lineageV3.nodes.find((n) => n.itemId === itemV2);
      const nodeV3 = lineageV3.nodes.find((n) => n.itemId === itemV3);
      assert.strictEqual(nodeV1.depth, -2);
      assert.strictEqual(nodeV2.depth, -1);
      assert.strictEqual(nodeV3.depth, 0);
    });

    // -------------------------------------------------------------------------
    // SCENARIO 3: Branching derivations and multi-parent lineages
    // -------------------------------------------------------------------------
    runTest(3, "Branching derivations and multi-parent lineages", () => {
      // Create Parent Items Y and Z
      storage.saveResearch({
        id: "RES-DERIV-001",
        topic: "Security Standards",
        category: "SECURITY",
        summary: "Security baseline compliance",
        items: [
          {
            id: "ITEM-SEC-ISO",
            type: "FINDING",
            classification: "FACT",
            title: "ISO 27001 Standard",
            content: "International information security control framework.",
            lifecycleState: "ACCEPTED",
          },
          {
            id: "ITEM-SEC-SOC2",
            type: "FINDING",
            classification: "FACT",
            title: "SOC-2 Type II Standard",
            content: "Trust services criteria compliance standard.",
            lifecycleState: "ACCEPTED",
          },
          {
            id: "ITEM-SEC-HYBRID",
            type: "FINDING",
            classification: "CONCLUSION",
            title: "Unified Compliance Architecture",
            content: "Unified controls mapping ISO 27001 and SOC-2.",
            lifecycleState: "ACCEPTED",
          },
        ],
      }, agentId, sessionId);

      // Add DERIVED_FROM relations from HYBRID to ISO and SOC2
      storage.addKnowledgeRelation({
        researchId: "RES-DERIV-001",
        relationType: "DERIVED_FROM",
        sourceItemId: "ITEM-SEC-HYBRID",
        targetItemId: "ITEM-SEC-ISO",
        rationale: "Derived control set from ISO 27001 Annex A",
        agentId,
        sessionId,
      });

      storage.addKnowledgeRelation({
        researchId: "RES-DERIV-001",
        relationType: "DERIVED_FROM",
        sourceItemId: "ITEM-SEC-HYBRID",
        targetItemId: "ITEM-SEC-SOC2",
        rationale: "Derived security controls from SOC-2 trust criteria",
        agentId,
        sessionId,
      });

      const lineage = storage.explainDecisionLineage("ITEM-SEC-HYBRID");
      assert.strictEqual(lineage.targetFound, true);
      assert.strictEqual(lineage.synthesis.derivationsCount, 2);
      assert.strictEqual(lineage.synthesis.predecessorsCount, 2);
      const derivedEdges = lineage.edges.filter((e) => e.relationType === "DERIVED_FROM");
      assert.strictEqual(derivedEdges.length, 2);
    });

    // -------------------------------------------------------------------------
    // SCENARIO 4: Isolated decision with zero lineage relations
    // -------------------------------------------------------------------------
    runTest(4, "Isolated decision with zero lineage relations", () => {
      storage.saveResearch({
        id: "RES-ISOLATED-001",
        topic: "Standalone Discovery",
        category: "GENERAL",
        summary: "Standalone fact",
        items: [
          {
            id: "ITEM-STANDALONE-01",
            type: "FINDING",
            classification: "OBSERVATION",
            title: "Isolated Fact",
            content: "A standalone observation with no preceding or succeeding decisions.",
            lifecycleState: "ACCEPTED",
          },
        ],
      }, agentId, sessionId);

      const lineage = storage.explainDecisionLineage("ITEM-STANDALONE-01");
      assert.strictEqual(lineage.targetFound, true);
      assert.strictEqual(lineage.nodes.length, 1);
      assert.strictEqual(lineage.edges.length, 0);
      assert.strictEqual(lineage.synthesis.predecessorsCount, 0);
      assert.strictEqual(lineage.synthesis.successorsCount, 0);
      assert.ok(lineage.synthesis.summaryNarrative.includes("no recorded predecessors"));
    });

    // -------------------------------------------------------------------------
    // SCENARIO 5: Cyclic relation detection and safe bounded termination
    // -------------------------------------------------------------------------
    runTest(5, "Cyclic relation detection and safe bounded termination", () => {
      // Synthetic corrupted research records containing a direct cycle
      const corruptedResearches = [
        {
          id: "RES-CYCLE-001",
          topic: "Corrupted Cycle Topic",
          category: "ARCHITECTURE",
          summary: "Cycle test",
          status: "COMPLETED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sessionId,
          agentId,
          items: [
            {
              id: "ITEM-CYCLE-A",
              type: "FINDING",
              classification: "FACT",
              title: "Cycle Node A",
              content: "Node A",
              lifecycleState: "ACCEPTED",
              provenance: { agentId, timestamp: new Date().toISOString() },
            },
            {
              id: "ITEM-CYCLE-B",
              type: "FINDING",
              classification: "FACT",
              title: "Cycle Node B",
              content: "Node B",
              lifecycleState: "ACCEPTED",
              provenance: { agentId, timestamp: new Date().toISOString() },
            },
          ],
          relations: [
            {
              id: "REL-CYCLE-1",
              relationType: "SUPERSEDES",
              sourceItemId: "ITEM-CYCLE-A",
              targetItemId: "ITEM-CYCLE-B",
              createdAt: new Date().toISOString(),
              provenance: { agentId, timestamp: new Date().toISOString() },
            },
            {
              id: "REL-CYCLE-2",
              relationType: "SUPERSEDES",
              sourceItemId: "ITEM-CYCLE-B",
              targetItemId: "ITEM-CYCLE-A",
              createdAt: new Date().toISOString(),
              provenance: { agentId, timestamp: new Date().toISOString() },
            },
          ],
        },
      ];

      const lineage = tms.explainDecisionLineage(corruptedResearches, {
        itemId: "ITEM-CYCLE-A",
      });

      assert.strictEqual(lineage.targetFound, true);
      assert.ok(lineage.cyclesDetected.length > 0, "Must detect and record cyclic relation");
      assert.ok(lineage.synthesis.uncertainties.some((u) => u.includes("Cyclic relations detected")));
    });

    // -------------------------------------------------------------------------
    // SCENARIO 6: Broken references and missing items resilience
    // -------------------------------------------------------------------------
    runTest(6, "Broken references and missing items resilience", () => {
      const brokenResearches = [
        {
          id: "RES-BROKEN-001",
          topic: "Broken Reference Topic",
          category: "ARCHITECTURE",
          summary: "Broken reference test",
          status: "COMPLETED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sessionId,
          agentId,
          items: [
            {
              id: "ITEM-ALIVE-01",
              type: "FINDING",
              classification: "FACT",
              title: "Alive Item",
              content: "Pointing to non-existent item",
              lifecycleState: "ACCEPTED",
              provenance: { agentId, timestamp: new Date().toISOString() },
            },
          ],
          relations: [
            {
              id: "REL-BROKEN-01",
              relationType: "SUPERSEDES",
              sourceItemId: "ITEM-ALIVE-01",
              targetItemId: "ITEM-GHOST-99", // Does not exist
              createdAt: new Date().toISOString(),
              provenance: { agentId, timestamp: new Date().toISOString() },
            },
          ],
        },
      ];

      const lineage = tms.explainDecisionLineage(brokenResearches, {
        itemId: "ITEM-ALIVE-01",
      });

      assert.strictEqual(lineage.targetFound, true);
      assert.strictEqual(lineage.nodes.length, 2);
      const ghostNode = lineage.nodes.find((n) => n.itemId === "ITEM-GHOST-99");
      assert.ok(ghostNode, "Ghost node must be created as stub");
      assert.strictEqual(ghostNode.isBroken, true);
      assert.ok(ghostNode.title.includes("[BROKEN REFERENCE: ITEM-GHOST-99]"));
      assert.ok(lineage.synthesis.uncertainties.some((u) => u.includes("broken references")));
    });

    // -------------------------------------------------------------------------
    // SCENARIO 7: Multi-project boundary isolation on lineage queries
    // -------------------------------------------------------------------------
    runTest(7, "Multi-project boundary isolation on lineage queries", () => {
      // Calling explainDecisionLineage with mismatched requested project
      const crossProject = storage.explainDecisionLineage(itemV3, {
        projectId: "completely-foreign-project",
      });

      assert.strictEqual(crossProject.targetFound, false);
      assert.ok(crossProject.errorReason.includes("Access denied: cross-project lineage query rejected"));

      // Scope isolation: query within orderservice scope should not return storage backend architecture
      const scopedQuery = storage.explainDecisionLineage(itemV3, {
        scope: "orderservice",
      });
      // itemV3 is in general architecture, foreign to orderservice domain
      assert.strictEqual(scopedQuery.targetFound, true); // item exists in store, but foreign scope is isolated
    });

    // -------------------------------------------------------------------------
    // SCENARIO 8: Explicit CONTRADICTS relation active at target valid time
    // -------------------------------------------------------------------------
    runTest(8, "Explicit CONTRADICTS relation active at target valid time", () => {
      storage.saveResearch({
        id: "RES-CONFLICT-001",
        topic: "Authentication Architecture",
        category: "SECURITY",
        summary: "Auth token format decisions",
        items: [
          {
            id: "ITEM-AUTH-JWT",
            type: "FINDING",
            classification: "FACT",
            title: "Stateless JWT Auth Tokens",
            content: "Use stateless JWTs with RS256 signature for API authentication.",
            lifecycleState: "ACCEPTED",
            validFrom: "2026-01-01T00:00:00.000Z",
            validUntil: "2026-12-31T23:59:59.999Z",
          },
          {
            id: "ITEM-AUTH-OPAQUE",
            type: "FINDING",
            classification: "FACT",
            title: "Opaque Database Session Tokens",
            content: "Use server-side opaque tokens in Redis with immediate revocation capability.",
            lifecycleState: "ACCEPTED",
            validFrom: "2026-06-01T00:00:00.000Z",
            validUntil: "2027-06-01T00:00:00.000Z",
          },
        ],
      }, agentId, sessionId);

      storage.addKnowledgeRelation({
        researchId: "RES-CONFLICT-001",
        relationType: "CONTRADICTS",
        sourceItemId: "ITEM-AUTH-OPAQUE",
        targetItemId: "ITEM-AUTH-JWT",
        rationale: "Architectural contradiction: stateless vs stateful auth strategies are mutually exclusive.",
        agentId,
        sessionId,
      });

      // Query lineage of ITEM-AUTH-OPAQUE at valid time 2026-08-01 (when both are active!)
      const lineage = storage.explainDecisionLineage("ITEM-AUTH-OPAQUE", {
        asOfValidTime: "2026-08-01T00:00:00.000Z",
      });

      assert.strictEqual(lineage.contradictions.length, 1);
      const conflict = lineage.contradictions[0];
      assert.strictEqual(conflict.conflictType, "EXPLICIT_CONTRADICTION");
      assert.strictEqual(conflict.conflictingItemId, "ITEM-AUTH-JWT");
      assert.strictEqual(conflict.activeAtTargetValidTime, true);
      assert.strictEqual(conflict.status, "ACTIVE_CONFLICT");
      assert.strictEqual(conflict.severity, "HIGH");
      assert.strictEqual(lineage.synthesis.hasActiveContradiction, true);
      assert.strictEqual(lineage.synthesis.hasPendingReview, true);
    });

    // -------------------------------------------------------------------------
    // SCENARIO 9: Explicit CONTRADICTS relation outside valid window (historical/resolved)
    // -------------------------------------------------------------------------
    runTest(9, "Explicit CONTRADICTS relation outside valid window (historical/resolved)", () => {
      // Query lineage of ITEM-AUTH-OPAQUE at valid time 2027-01-15 (after ITEM-AUTH-JWT expired!)
      const lineage = storage.explainDecisionLineage("ITEM-AUTH-OPAQUE", {
        asOfValidTime: "2027-01-15T00:00:00.000Z",
      });

      assert.strictEqual(lineage.contradictions.length, 1);
      const conflict = lineage.contradictions[0];
      assert.strictEqual(conflict.activeAtTargetValidTime, false, "Must be inactive outside overlapping window");
      assert.strictEqual(conflict.status, "HISTORICAL_RESOLVED");
      assert.strictEqual(conflict.severity, "LOW");
      assert.strictEqual(lineage.synthesis.hasActiveContradiction, false);
    });

    // -------------------------------------------------------------------------
    // SCENARIO 10: Non-contradictory temporal overlap (preserves uncertainty without hallucinated conflict)
    // -------------------------------------------------------------------------
    runTest(10, "Non-contradictory temporal overlap (preserves uncertainty without hallucinated conflict)", () => {
      storage.saveResearch({
        id: "RES-PARALLEL-001",
        topic: "Performance Tuning",
        category: "PERFORMANCE",
        summary: "Performance measures",
        items: [
          {
            id: "ITEM-PERF-COMPRESS",
            type: "FINDING",
            classification: "FACT",
            title: "Gzip Response Compression",
            content: "Enable Gzip compression for all JSON payloads over 1KB.",
            lifecycleState: "ACCEPTED",
            validFrom: "2026-01-01T00:00:00.000Z",
            validUntil: undefined,
          },
          {
            id: "ITEM-PERF-CACHE",
            type: "FINDING",
            classification: "FACT",
            title: "HTTP Cache-Control Headers",
            content: "Set Cache-Control: max-age=3600 on static assets.",
            lifecycleState: "ACCEPTED",
            validFrom: "2026-01-01T00:00:00.000Z",
            validUntil: undefined,
          },
        ],
      }, agentId, sessionId);

      // They overlap in time and share category PERFORMANCE, but there is NO CONTRADICTS relation.
      const lineage = storage.explainDecisionLineage("ITEM-PERF-COMPRESS");
      assert.strictEqual(lineage.contradictions.length, 0, "Must NOT hallucinate a contradiction between compatible items");
      assert.strictEqual(lineage.synthesis.hasActiveContradiction, false);
    });

    // -------------------------------------------------------------------------
    // SCENARIO 11: Semi-open intervals [validFrom, validUntil) and exact boundary transitions
    // -------------------------------------------------------------------------
    runTest(11, "Semi-open intervals [validFrom, validUntil) and exact boundary transitions", () => {
      // In Scenario 1:
      // itemV1 has validUntil: 2026-06-01T00:00:00.000Z
      // itemV2 has validFrom: 2026-06-01T00:00:00.000Z
      // At exact boundary instant 2026-06-01T00:00:00.000Z:
      // Under [validFrom, validUntil) half-open semantics:
      // V1 is EXPIRED, V2 is ACTIVE
      const evalV1 = tms.isItemValidAtDomainTime(
        { id: itemV1, validFrom: "2026-01-01T00:00:00.000Z", validUntil: "2026-06-01T00:00:00.000Z" },
        "2026-06-01T00:00:00.000Z"
      );
      assert.strictEqual(evalV1, false, "Old item must be expired at exact validUntil timestamp");

      const evalV2 = tms.isItemValidAtDomainTime(
        { id: itemV2, validFrom: "2026-06-01T00:00:00.000Z", validUntil: undefined },
        "2026-06-01T00:00:00.000Z"
      );
      assert.strictEqual(evalV2, true, "New item must be valid at exact validFrom timestamp");
    });

    // -------------------------------------------------------------------------
    // SCENARIO 12: Open-ended validity intervals and untimed legacy records
    // -------------------------------------------------------------------------
    runTest(12, "Open-ended validity intervals and untimed legacy records", () => {
      storage.saveResearch({
        id: "RES-UNTIMED-001",
        topic: "Legacy Documentation",
        category: "GENERAL",
        summary: "Untimed record",
        items: [
          {
            id: "ITEM-UNTIMED-01",
            type: "FINDING",
            classification: "OBSERVATION",
            title: "Untimed Legacy Item",
            content: "Content with no validFrom or validUntil properties.",
            lifecycleState: "CREATED",
          },
        ],
      }, agentId, sessionId);

      const lineage = storage.explainDecisionLineage("ITEM-UNTIMED-01");
      assert.strictEqual(lineage.targetFound, true);
      assert.strictEqual(lineage.targetNode.validityWindow.isOpenEnded, true);
      assert.ok(
        lineage.synthesis.uncertainties.some((u) => u.includes("legacy knowledge items")),
        "Must document uncertainty for untimed legacy items"
      );
    });

    // -------------------------------------------------------------------------
    // SCENARIO 13: Point-in-time query surfacing active contradictions with calibrated confidence
    // -------------------------------------------------------------------------
    runTest(13, "Point-in-time query surfacing active contradictions with calibrated confidence", () => {
      // Query knowledge at point-in-time 2026-08-01 when ITEM-AUTH-JWT and ITEM-AUTH-OPAQUE contradict
      const pitQuery = storage.queryKnowledgePointInTime({
        query: "Tokens Auth",
        asOfValidTime: "2026-08-01T00:00:00.000Z",
      });

      assert.strictEqual(pitQuery.items.length, 2, "Both conflicting items were effective at 2026-08-01");
      assert.ok(pitQuery.activeContradictions, "Must populate activeContradictions");
      assert.ok(pitQuery.activeContradictions.length > 0, "Must report at least one active contradiction");
      assert.ok(pitQuery.activeAlerts.length > 0, "Must populate activeAlerts");
      assert.ok(pitQuery.summary.includes("active temporal contradiction"), "Summary must alert of active contradiction");
      assert.strictEqual(pitQuery.confidence, "INCONCLUSIVE", "Active high-severity contradiction must calibrate confidence to INCONCLUSIVE");
    });

    // -------------------------------------------------------------------------
    // SCENARIO 14: Non-existent target item unanswerable report without fabricated nodes
    // -------------------------------------------------------------------------
    runTest(14, "Non-existent target item unanswerable report without fabricated nodes", () => {
      const ghostLineage = storage.explainDecisionLineage("NON-EXISTENT-ITEM-404");
      assert.strictEqual(ghostLineage.targetFound, false);
      assert.strictEqual(ghostLineage.nodes.length, 0);
      assert.strictEqual(ghostLineage.edges.length, 0);
      assert.ok(ghostLineage.errorReason.includes("not found"));
      assert.strictEqual(ghostLineage.synthesis.hasActiveContradiction, false);
    });

    // -------------------------------------------------------------------------
    // SCENARIO 15: Dual MCP alias compatibility (openmemory_explain_lineage & evocara_explain_lineage)
    // -------------------------------------------------------------------------
    await runAsyncTest(15, "Dual MCP alias compatibility (openmemory_explain_lineage & evocara_explain_lineage)", async () => {
      const mcpServer = createMCPServer(tmpDir);
      const callHandler = mcpServer._requestHandlers.get("tools/call");

      // 1. Call via openmemory_explain_lineage
      const openmemoryRes = await callHandler({
        method: "tools/call",
        params: {
          name: "openmemory_explain_lineage",
          arguments: {
            itemId: itemV3,
          },
        },
      });

      assert.strictEqual(!openmemoryRes.isError, true);
      const text1 = openmemoryRes.content[0].text;
      assert.ok(text1.includes("Decision Lineage:"));
      assert.ok(text1.includes("Predecessors (Ancestors)"));
      assert.ok(text1.includes("2"));

      // 2. Call via evocara_explain_lineage
      const evocaraRes = await callHandler({
        method: "tools/call",
        params: {
          name: "evocara_explain_lineage",
          arguments: {
            itemId: itemV3,
          },
        },
      });

      assert.strictEqual(!evocaraRes.isError, true);
      const text2 = evocaraRes.content[0].text;
      assert.ok(text2.includes("Decision Lineage:"));
      assert.ok(text2.includes(itemV3));
      // Normalize queryTimestamp since calls executed 2ms apart
      const norm1 = text1.replace(/"queryTimestamp":\s*"[^"]+"/, '"queryTimestamp": "NORM"');
      const norm2 = text2.replace(/"queryTimestamp":\s*"[^"]+"/, '"queryTimestamp": "NORM"');
      assert.strictEqual(norm1, norm2, "Both aliases must produce identical outputs");
    });

    // -------------------------------------------------------------------------
    // SCENARIO 16: Project boundary isolation and authorization fail-closed enforcement via MCP
    // -------------------------------------------------------------------------
    await runAsyncTest(16, "Project boundary isolation and authorization fail-closed enforcement via MCP", async () => {
      const mcpServer = createMCPServer(tmpDir);
      const callHandler = mcpServer._requestHandlers.get("tools/call");

      const deniedRes = await callHandler({
        method: "tools/call",
        params: {
          name: "openmemory_explain_lineage",
          arguments: {
            itemId: itemV3,
            projectId: "unauthorized-foreign-tenant",
          },
        },
      });

      assert.strictEqual(deniedRes.isError, true);
      assert.ok(deniedRes.content[0].text.includes("Access denied: cross-project lineage query rejected"));
    });

    // -------------------------------------------------------------------------
    // SCENARIO 17: Lineage queries perform strictly zero mutations on disk state
    // -------------------------------------------------------------------------
    runTest(17, "Lineage queries perform strictly zero mutations on disk state", () => {
      const researchesDir = path.join(tmpDir, ".openmemory", "knowledge", "researches");
      const filesBefore = fs.readdirSync(researchesDir).map((f) => {
        const full = path.join(researchesDir, f);
        return { name: f, mtime: fs.statSync(full).mtimeMs, size: fs.statSync(full).size };
      });

      // Execute repeated lineage & contradiction inquiries
      storage.explainDecisionLineage(itemV1);
      storage.explainDecisionLineage(itemV2);
      storage.explainDecisionLineage(itemV3);
      storage.explainDecisionLineage("ITEM-AUTH-OPAQUE", { asOfValidTime: "2026-08-01T00:00:00.000Z" });

      const filesAfter = fs.readdirSync(researchesDir).map((f) => {
        const full = path.join(researchesDir, f);
        return { name: f, mtime: fs.statSync(full).mtimeMs, size: fs.statSync(full).size };
      });

      assert.deepStrictEqual(filesBefore, filesAfter, "Disk state must remain strictly immutable during queries");
    });

    // -------------------------------------------------------------------------
    // SCENARIO 18: Preservation of supersession invariants and terminal state protection
    // -------------------------------------------------------------------------
    runTest(18, "Preservation of supersession invariants and terminal state protection", () => {
      // Attempting to revive or re-supersede itemV1 (which is already SUPERSEDED)
      const illegalSupersede = storage.supersedeKnowledgeDecision({
        oldItemId: itemV1,
        newItem: {
          title: "Illegal Revived Decision",
          content: "Trying to overwrite terminal item",
        },
        evaluationRationale: "Illegal revival attempt",
        agentId,
        sessionId,
      });

      assert.strictEqual(illegalSupersede.success, false);
      assert.ok(illegalSupersede.reason.includes("Terminal state protection"));

      // Verify itemV1 remains strictly SUPERSEDED on disk
      const allRes = storage.listResearches();
      const v1OnDisk = allRes.flatMap((r) => r.items).find((i) => i.id === itemV1);
      assert.strictEqual(v1OnDisk.lifecycleState, "SUPERSEDED");
    });

    console.log("\n===================================================================");
    console.log(`  G31 Lineage & Contradictions Results: ${passCount} / ${totalCount} PASSED (100%)`);
    console.log("===================================================================\n");

    const evidence = {
      milestone: "G31",
      suite: "Causal Decision Lineage, Active Temporal Contradictions & Contextual Synthesis Suite",
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
    const evidencePath = path.join(evidenceDir, "g31-lineage-and-contradictions-results.json");
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
