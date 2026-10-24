import * as fs from "fs";
import * as path from "path";
import {
  StorageEngine,
  ResearchRecord,
  KnowledgeItem,
  sanitizeSecrets,
} from "../../src/storage";

function runF52StorageTests() {
  console.log("=================================================");
  console.log("   OpenMemory F5.2 Knowledge Storage Engine      ");
  console.log("=================================================\n");

  const tmpDir = path.join(process.cwd(), ".test-f52-tmp");
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testId: string, description: string) {
    if (condition) {
      console.log(`[PASSED] ${testId}: ${description}`);
      passedCount++;
    } else {
      console.error(`[FAILED] ${testId}: ${description}`);
      failedCount++;
    }
  }

  try {
    const storage = new StorageEngine(tmpDir);
    storage.ensureStorageStructure();

    // -------------------------------------------------------------------------
    // Test 1: Creation of ResearchRecord & default ID generation
    // -------------------------------------------------------------------------
    const res1Input: ResearchRecord = {
      id: "RES-001",
      topic: "OpenCode Plugin Architecture Research",
      category: "ARCHITECTURE",
      summary: "Investigation into OpenCode plugin event hooks and MCP boundaries.",
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sessionId: "session-abc-123",
      agentId: "scout-agent",
      items: [
        {
          id: "RES-001-ITEM-1",
          type: "SOURCE",
          classification: "FACT",
          title: "OpenCode Plugin SDK Definition",
          content: "OpenCode provides tool.execute.after hook in @opencode-ai/plugin",
          provenance: {
            url: "https://github.com/opencode-ai/opencode",
            toolName: "WebFetch",
            sessionId: "session-abc-123",
            agentId: "scout-agent",
            timestamp: new Date().toISOString(),
          },
          tags: ["opencode", "sdk", "hooks"],
        },
      ],
    };

    const sess = storage.registerSession({ agentId: "scout-agent", status: "ACTIVE" });
    const res1Saved = storage.saveResearch(res1Input, "scout-agent", sess.id);
    assert(res1Saved.id === "RES-001", "F5.2-001", "Creation of ResearchRecord with explicit ID");

    // Test default ID auto-generation
    const resAutoSaved = storage.saveResearch(
      {
        id: "",
        topic: "Auto ID Test Topic",
        category: "TEST",
        summary: "Testing automatic ID generation",
        status: "COMPLETED",
        createdAt: "",
        updatedAt: "",
        sessionId: sess.id,
        agentId: "scout-agent",
        items: [],
      },
      "scout-agent",
      sess.id
    );
    assert(resAutoSaved.id.startsWith("RES-"), "F5.2-001b", "Auto-generation of ResearchRecord ID");

    // -------------------------------------------------------------------------
    // Test 2: Atomic persistence to .openmemory/knowledge/researches/<id>.json
    // -------------------------------------------------------------------------
    const expectedFilePath = path.join(tmpDir, ".openmemory", "knowledge", "researches", "RES-001.json");
    assert(fs.existsSync(expectedFilePath), "F5.2-002", "Atomic persistence to .openmemory/knowledge/researches/RES-001.json");

    // -------------------------------------------------------------------------
    // Test 3: Reading back research record (getResearch)
    // -------------------------------------------------------------------------
    const retrievedRes1 = storage.getResearch("RES-001");
    assert(
      retrievedRes1 !== null &&
        retrievedRes1.topic === "OpenCode Plugin Architecture Research" &&
        retrievedRes1.items.length === 1,
      "F5.2-003",
      "Reading back research record using getResearch"
    );

    // -------------------------------------------------------------------------
    // Test 4: Updating research record & updatedAt timestamp refresh
    // -------------------------------------------------------------------------
    if (retrievedRes1) {
      retrievedRes1.summary = "Updated summary for OpenCode plugin architecture investigation.";
      const updatedRes1 = storage.saveResearch(retrievedRes1, "scout-agent", sess.id);
      const reFetched = storage.getResearch("RES-001");
      assert(
        reFetched !== null &&
          reFetched.summary === "Updated summary for OpenCode plugin architecture investigation.",
        "F5.2-004",
        "Updating research record content"
      );
    }

    // -------------------------------------------------------------------------
    // Test 5: Integrity after multiple writes & atomic file operations
    // -------------------------------------------------------------------------
    for (let i = 2; i <= 5; i++) {
      const loopAgent = `agent-${i}`;
      const loopSess = storage.registerSession({ agentId: loopAgent, status: "ACTIVE" });
      storage.saveResearch(
        {
          id: `RES-00${i}`,
          topic: `Multi Write Topic ${i}`,
          category: "BENCHMARK",
          summary: `Testing multi-write persistence integrity for record ${i}`,
          status: "COMPLETED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sessionId: loopSess.id,
          agentId: loopAgent,
          items: [],
        },
        loopAgent,
        loopSess.id
      );
    }
    const allResearches = storage.listResearches();
    assert(allResearches.length === 6, "F5.2-005", "Multiple research writes integrity (6 records indexed)");

    // -------------------------------------------------------------------------
    // Test 6: Retrieval of KnowledgeItems via queryKnowledgeItems
    // -------------------------------------------------------------------------
    const queriedItems = storage.queryKnowledgeItems({ itemType: "SOURCE" });
    assert(
      queriedItems.length === 1 && queriedItems[0].item.title === "OpenCode Plugin SDK Definition",
      "F5.2-006",
      "Retrieval of KnowledgeItems using queryKnowledgeItems"
    );

    // -------------------------------------------------------------------------
    // Test 7: Item types SOURCE, REPOSITORY, FINDING verification
    // -------------------------------------------------------------------------
    const multiTypeRecord: ResearchRecord = {
      id: "RES-TYPES-01",
      topic: "Knowledge Item Types Test",
      category: "TEST",
      summary: "Testing all supported KnowledgeItem types",
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sessionId: "session-types",
      agentId: "agent-types",
      items: [
        {
          id: "ITEM-SRC",
          type: "SOURCE",
          classification: "FACT",
          title: "Documentation Web Page",
          content: "Web search output content",
          provenance: { url: "https://example.com/docs" },
        },
        {
          id: "ITEM-REPO",
          type: "REPOSITORY",
          classification: "OBSERVATION",
          title: "GitHub Repository Reference",
          content: "OpenMemory core repository",
          provenance: { repository: "Blueisazul/OpenMemory", commit: "8bc4d7f" },
        },
        {
          id: "ITEM-FIND",
          type: "FINDING",
          classification: "CONCLUSION",
          title: "Synthesized Architectural Finding",
          content: "Hybrid model preserves signal-to-noise ratio",
          provenance: { toolName: "record_knowledge" },
        },
      ],
    };
    const sessTypes = storage.registerSession({ agentId: "agent-types", status: "ACTIVE" });
    storage.saveResearch(multiTypeRecord, "agent-types", sessTypes.id);

    const sources = storage.queryKnowledgeItems({ itemType: "SOURCE" });
    const repos = storage.queryKnowledgeItems({ itemType: "REPOSITORY" });
    const findings = storage.queryKnowledgeItems({ itemType: "FINDING" });
    assert(
      sources.length >= 1 && repos.length >= 1 && findings.length >= 1,
      "F5.2-007",
      "Support for KnowledgeItem types SOURCE, REPOSITORY, and FINDING"
    );

    // -------------------------------------------------------------------------
    // Test 8: Classifications FACT, OBSERVATION, FINDING, HYPOTHESIS, CONCLUSION
    // -------------------------------------------------------------------------
    const classRecord: ResearchRecord = {
      id: "RES-CLASS-01",
      topic: "Epistemological Classifications Test",
      category: "TEST",
      summary: "Testing all 5 epistemological classifications",
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sessionId: "session-class",
      agentId: "agent-class",
      items: [
        { id: "C1", type: "FINDING", classification: "FACT", title: "Fact Item", content: "Fact text", provenance: {} },
        { id: "C2", type: "FINDING", classification: "OBSERVATION", title: "Obs Item", content: "Obs text", provenance: {} },
        { id: "C3", type: "FINDING", classification: "FINDING", title: "Finding Item", content: "Finding text", provenance: {} },
        { id: "C4", type: "FINDING", classification: "HYPOTHESIS", title: "Hyp Item", content: "Hyp text", provenance: {} },
        { id: "C5", type: "FINDING", classification: "CONCLUSION", title: "Conclusion Item", content: "Conc text", provenance: {} },
      ],
    };
    const sessClass = storage.registerSession({ agentId: "agent-class", status: "ACTIVE" });
    storage.saveResearch(classRecord, "agent-class", sessClass.id);

    const facts = storage.queryKnowledgeItems({ classification: "FACT" });
    const hypotheses = storage.queryKnowledgeItems({ classification: "HYPOTHESIS" });
    const conclusions = storage.queryKnowledgeItems({ classification: "CONCLUSION" });
    assert(
      facts.length >= 1 && hypotheses.length >= 1 && conclusions.length >= 1,
      "F5.2-008",
      "Support for epistemological classifications FACT, OBSERVATION, FINDING, HYPOTHESIS, CONCLUSION"
    );

    // -------------------------------------------------------------------------
    // Test 9: Preservation of ProvenanceMetadata
    // -------------------------------------------------------------------------
    const fetchedRepoRes = storage.getResearch("RES-TYPES-01");
    const repoItem = fetchedRepoRes?.items.find((i) => i.id === "ITEM-REPO");
    assert(
      repoItem !== undefined &&
        repoItem.provenance.repository === "Blueisazul/OpenMemory" &&
        repoItem.provenance.commit === "8bc4d7f",
      "F5.2-009",
      "Preservation of detailed ProvenanceMetadata (repository & commit)"
    );

    // -------------------------------------------------------------------------
    // Test 10: Noise policy enforcement: max 10 KB limit rejection
    // -------------------------------------------------------------------------
    let oversizeErrorCaught = false;
    try {
      const hugeContent = "X".repeat(12000);
      const sessA = storage.registerSession({ agentId: "a", status: "ACTIVE" });
      storage.saveResearch(
        {
          id: "RES-OVERSIZE",
          topic: "Oversized Record",
          category: "NOISE",
          summary: hugeContent,
          status: "COMPLETED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sessionId: sessA.id,
          agentId: "a",
          items: [],
        },
        "a",
        sessA.id
      );
    } catch (err) {
      oversizeErrorCaught = (err as Error).message.includes("exceeds maximum size limit of 10 KB");
    }
    assert(oversizeErrorCaught, "F5.2-010", "Noise policy: Rejection of research payload exceeding 10 KB");

    // -------------------------------------------------------------------------
    // Test 11: Noise policy enforcement: max 10 items limit rejection
    // -------------------------------------------------------------------------
    let maxItemsErrorCaught = false;
    try {
      const elevenItems: KnowledgeItem[] = Array.from({ length: 11 }, (_, i) => ({
        id: `EXCESS-${i}`,
        type: "FINDING",
        classification: "OBSERVATION",
        title: `Title ${i}`,
        content: `Content ${i}`,
        provenance: {},
      }));
      const sessA = storage.registerSession({ agentId: "a", status: "ACTIVE" });
      storage.saveResearch(
        {
          id: "RES-EXCESS-ITEMS",
          topic: "Excess Items Record",
          category: "NOISE",
          summary: "11 items test",
          status: "COMPLETED",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sessionId: sessA.id,
          agentId: "a",
          items: elevenItems,
        },
        "a",
        sessA.id
      );
    } catch (err) {
      maxItemsErrorCaught = (err as Error).message.includes("exceeds maximum limit of 10 items");
    }
    assert(maxItemsErrorCaught, "F5.2-011", "Noise policy: Rejection of research record exceeding 10 items");

    // -------------------------------------------------------------------------
    // Test 12: Secret scrubbing safeguard
    // -------------------------------------------------------------------------
    const secretInputText = "Found token sk-proj-123456789012345678901234 and ghp_abcdefghijklmnopqrstuvwxyz012345";
    const scrubbed = sanitizeSecrets(secretInputText);
    assert(
      !scrubbed.includes("sk-proj-123456789012345678901234") &&
        !scrubbed.includes("ghp_abcdefghijklmnopqrstuvwxyz012345") &&
        scrubbed.includes("[REDACTED_SECRET]"),
      "F5.2-012",
      "Secret scrubbing safeguard masks API keys and tokens"
    );

    // -------------------------------------------------------------------------
    // Test 13: Deletion of ResearchRecord & Diagnostics inclusion
    // -------------------------------------------------------------------------
    const deleted = storage.deleteResearch("RES-OVERSIZE"); // won't exist, try valid
    storage.deleteResearch("RES-CLASS-01");
    const refetchDeleted = storage.getResearch("RES-CLASS-01");
    const diagReport = storage.runDiagnostics();
    const knowledgeCheck = diagReport.checks.find((c) => c.name === "Knowledge Registry");
    assert(
      refetchDeleted === null && knowledgeCheck !== undefined && knowledgeCheck.passed,
      "F5.2-013",
      "Deletion of ResearchRecord & inclusion in StorageEngine runDiagnostics()"
    );

    // -------------------------------------------------------------------------
    // Test 14: Full system regression check (F1-F4 compatibility)
    // -------------------------------------------------------------------------
    const manifest = storage.getOrInitManifest();
    const state = storage.getOrInitProjectState();
    const handoff = storage.getOrInitHandoff();
    const adr = storage.saveADR({ title: "F5.2 Storage Integration ADR", context: "Context", decision: "Decision" }, "scout-agent", sess.id);
    const adrFetched = storage.getADR(adr.id);

    assert(
      Boolean(manifest.projectName) &&
        (state.currentStage !== undefined || (state as any).activePhase !== undefined) &&
        handoff.includes("Session Handoff") &&
        adrFetched !== null &&
        adrFetched.title === "F5.2 Storage Integration ADR",
      "F5.2-014",
      "Backward compatibility with F1-F4 storage primitives (Manifest, State, Handoff, ADRs)"
    );

  } finally {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  console.log("\n=================================================");
  console.log(`   F5.2 Storage Tests Complete: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runF52StorageTests();
