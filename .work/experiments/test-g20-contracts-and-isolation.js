const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const { StorageEngine } = require("../../dist/storage");
const { createMCPServer } = require("../../dist/mcp");

async function runContractsSuite() {
  console.log("===================================================================");
  console.log("  G20: Contracts, Authorization & Scope Isolation Suite           ");
  console.log("===================================================================");

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`  [${total}] ${name}... PASS`);
    } catch (err) {
      console.error(`  [${total}] ${name}... FAILED: ${err.message}`);
      throw err;
    }
  }

  // Setup sandbox storage engine and MCP server
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "g20-contracts-"));
  const storage = new StorageEngine(tmpDir);
  storage.ensureStorageStructure();
  storage.registerSession({ id: "sess-lead", agentId: "lead-architect", status: "ACTIVE" });

  const mcpServer = createMCPServer(tmpDir);
  const callMcpTool = (name, args) => {
    const handler = mcpServer._requestHandlers.get("tools/call");
    return handler({
      method: "tools/call",
      params: { name, arguments: args }
    });
  };

  // Seed research 1: Core Architecture
  storage.saveResearch({
    id: "RES-CORE-ARCH",
    topic: "InventoryHub Core Architecture",
    summary: "Air-gap SQLite engine invariants",
    status: "ACTIVE",
    items: [
      {
        id: "ITEM-ADR-001",
        type: "DECISION",
        classification: "ARCHITECTURE",
        title: "ADR-001: Local SQLite Storage",
        content: "Use node:sqlite embedded storage.",
        tags: ["architecture", "persistence"],
        lifecycleState: "ACCEPTED",
      },
      {
        id: "ITEM-PROP-001",
        type: "OBSERVATION",
        classification: "PROPOSAL",
        title: "Proposal: Cloud DB",
        content: "Migrate to MongoDB Atlas cloud.",
        tags: ["cloud", "database"],
        lifecycleState: "CREATED",
      }
    ]
  }, "lead-architect", "sess-lead");

  // Seed research 2: Zenith External (Foreign Scope)
  storage.saveResearch({
    id: "RES-ZENITH-EXT",
    topic: "Zenith Microservices",
    summary: "Foreign cloud services",
    status: "ACTIVE",
    items: [
      {
        id: "ITEM-ZENITH-001",
        type: "DECISION",
        classification: "ARCHITECTURE",
        title: "Zenith Cloud Architecture",
        content: "Distributed Cassandra on AWS.",
        tags: ["zenith", "cloud"],
        lifecycleState: "ACCEPTED",
      }
    ]
  }, "lead-architect", "sess-lead");

  // TEST 1: MCP query_knowledge scope isolation
  await test("MCP openmemory_query_knowledge strictly respects researchId scope filter", async () => {
    const res = await callMcpTool("openmemory_query_knowledge", { researchId: "RES-CORE-ARCH" });

    assert.strictEqual(res.isError || false, false);
    const text = res.content[0].text;
    assert.strictEqual(text.includes("RES-CORE-ARCH"), true);
    assert.strictEqual(text.includes("RES-ZENITH-EXT"), false, "Foreign research RES-ZENITH-EXT must never leak into RES-CORE-ARCH query");
    assert.strictEqual(text.includes("ITEM-ZENITH-001"), false, "Foreign item ITEM-ZENITH-001 must not leak");
  });

  // TEST 2: Cross-Research Item Mutation Prevention
  await test("Attempting to modify an item under wrong researchId is rejected", async () => {
    const res = await callMcpTool("openmemory_transition_knowledge_lifecycle", {
      researchId: "RES-CORE-ARCH",
      itemId: "ITEM-ZENITH-001",
      targetState: "SUPERSEDED",
      actorId: "lead-architect",
      sessionId: "sess-lead",
    });

    assert.strictEqual(res.isError, true, "Must return isError: true when item does not belong to specified researchId");
    assert.strictEqual(res.content[0].text.includes("not found") || res.content[0].text.includes("Error"), true);
  });

  // TEST 3: Malformed MCP Request (Missing Mandatory Lifecycle Parameters)
  await test("MCP openmemory_transition_knowledge_lifecycle rejects missing mandatory fields", async () => {
    const res = await callMcpTool("openmemory_transition_knowledge_lifecycle", {
      researchId: "RES-CORE-ARCH",
    });

    assert.strictEqual(res.isError, true, "Must return isError: true for missing parameters");
    assert.strictEqual(res.content[0].text.includes("Missing required parameters"), true);
  });

  // TEST 4: Invalid TMS Lifecycle Transition (Terminal State Protection)
  await test("Invalid TMS lifecycle transition is rejected under Terminal State Protection", async () => {
    // Transition ITEM-PROP-001 to terminal SUPERSEDED
    await callMcpTool("openmemory_transition_knowledge_lifecycle", {
      researchId: "RES-CORE-ARCH",
      itemId: "ITEM-PROP-001",
      targetState: "SUPERSEDED",
      actorId: "lead-architect",
      sessionId: "sess-lead",
      actorRole: "LEAD_AGENT",
      evaluationRationale: "Superseded by local SQLite ADR",
    });

    // Attempt illegal transition from terminal SUPERSEDED to VALIDATED
    const res = await callMcpTool("openmemory_transition_knowledge_lifecycle", {
      researchId: "RES-CORE-ARCH",
      itemId: "ITEM-PROP-001",
      targetState: "VALIDATED",
      actorId: "lead-architect",
      sessionId: "sess-lead",
      evidenceReference: "test-evidence.log",
    });

    assert.strictEqual(res.isError, true, "Cannot transition terminal SUPERSEDED knowledge");
    assert.strictEqual(res.content[0].text.includes("Terminal state protection"), true);
  });

  // TEST 5: MCP Knowledge Relation Validation
  await test("MCP openmemory_create_knowledge_relation enforces valid relation types", async () => {
    const res = await callMcpTool("openmemory_create_knowledge_relation", {
      researchId: "RES-CORE-ARCH",
      sourceItemId: "ITEM-ADR-001",
      targetItemId: "ITEM-PROP-001",
      relationType: "INVALID_RELATION_TYPE",
      agentId: "lead-architect",
      sessionId: "sess-lead",
    });

    assert.strictEqual(res.isError, true, "Invalid relationType must be rejected");
  });

  // TEST 6: TMS Analysis Contradiction Detection
  await test("MCP openmemory_analyze_knowledge_tms detects contradictions and supersessions", async () => {
    const relRes = await callMcpTool("openmemory_create_knowledge_relation", {
      researchId: "RES-CORE-ARCH",
      sourceItemId: "ITEM-ADR-001",
      targetItemId: "ITEM-PROP-001",
      relationType: "SUPERSEDES",
      rationale: "ADR-001 embedded SQLite mandates superseding remote cloud database",
      agentId: "lead-architect",
      sessionId: "sess-lead",
    });
    assert.strictEqual(relRes.isError || false, false, "Relation creation must succeed");

    const res = await callMcpTool("openmemory_analyze_knowledge_tms", { researchId: "RES-CORE-ARCH" });

    assert.strictEqual(res.isError || false, false);
    assert.strictEqual(res.content[0].text.includes("SUPERSEDES"), true);
  });

  // TEST 7: Event Compaction MCP Tool Integration
  await test("MCP openmemory_compact_event_logs executes with formatted output", async () => {
    const res = await callMcpTool("openmemory_compact_event_logs", { maxEvents: 50 });

    assert.strictEqual(res.isError || false, false);
    assert.strictEqual(res.content[0].text.includes("Event log compaction"), true);
  });

  // TEST 8: Retention Policy Retrieval MCP Tool
  await test("MCP openmemory_get_event_retention_policy returns valid configuration", async () => {
    const res = await callMcpTool("openmemory_get_event_retention_policy", {});

    assert.strictEqual(res.isError || false, false);
    assert.strictEqual(res.content[0].text.includes("maxEvents"), true);
    assert.strictEqual(res.content[0].text.includes("maxSizeBytes"), true);
  });

  // TEST 9: CLI logs compact Execution
  await test("CLI logs compact executes deterministically and exits with code 0", async () => {
    const cliPath = path.resolve(__dirname, "../../dist/cli.js");
    const result = spawnSync(process.execPath, [cliPath, "logs", "compact", "--root", tmpDir]);
    assert.strictEqual(result.status, 0, `CLI logs compact must exit 0: ${result.stderr.toString()}`);
    assert.strictEqual(result.stdout.toString().includes("Event Logs Compaction"), true);
  });

  // TEST 10: CLI tms analyze Execution
  await test("CLI tms analyze executes deterministically and displays relation graph", async () => {
    const cliPath = path.resolve(__dirname, "../../dist/cli.js");
    const result = spawnSync(process.execPath, [cliPath, "tms", "analyze", "RES-CORE-ARCH", "--root", tmpDir]);
    assert.strictEqual(result.status, 0, `CLI tms analyze must exit 0: ${result.stderr.toString()}`);
    assert.strictEqual(result.stdout.toString().includes("Truth Maintenance System"), true);
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log("-------------------------------------------------------------------");
  console.log(`  G20 Contracts & Isolation: ${passed} / ${total} tests PASSED.`);
  console.log("-------------------------------------------------------------------");
}

runContractsSuite().catch(err => {
  console.error("Contracts suite failed:", err);
  process.exit(1);
});
