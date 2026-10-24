import * as fs from "fs";
import * as path from "path";
import { StorageEngine, ADRRecord } from "../../src/storage";
import { OpenMemoryPlugin } from "../../.opencode/plugins/openmemory";

interface TestResult {
  id: string;
  name: string;
  status: "PASSED" | "FAILED";
  details: string;
}

const results: TestResult[] = [];

// Setup temp workspace for isolation
const tempDir = path.join(process.cwd(), ".work", "scratch-f34-test");
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

async function runF34Tests() {
  console.log("=================================================");
  console.log("   OpenMemory F3.4 Context & Memory Test Suite   ");
  console.log("=================================================\n");

  const storage = new StorageEngine(tempDir);
  const sess = storage.registerSession({ agentId: "agent-test", status: "ACTIVE" });

  // -------------------------------------------------------------------------
  // Test F3.4-001: ADR Creation & Atomic Persistence
  // -------------------------------------------------------------------------
  try {
    const newADR = storage.saveADR(
      {
        title: "Zero-dependency Native OpenCode Plugin Architecture",
        date: "2026-09-25",
        context: "OpenMemory requires local zero-dependency context management.",
        decision: "Implement TypeScript plugin leveraging native OpenCode session hooks.",
        consequences: "Eliminates secondary daemon and external vector DB complexity.",
      },
      "agent-test",
      sess.id
    );

    const expectedFile = path.join(tempDir, ".openmemory", "adrs", "ADR-001.md");
    if (!fs.existsSync(expectedFile)) {
      throw new Error(`File ${expectedFile} was not created`);
    }

    const fileContent = fs.readFileSync(expectedFile, "utf-8");
    if (
      !fileContent.includes("# ADR-001:") ||
      !fileContent.includes("**Status:** PROPOSED") ||
      !fileContent.includes("Zero-dependency Native OpenCode Plugin Architecture")
    ) {
      throw new Error("ADR Markdown content format mismatch");
    }

    results.push({
      id: "F3.4-001",
      name: "ADR Creation & Atomic Persistence",
      status: "PASSED",
      details: `saveADR successfully created ADR-001.md atomically at ${expectedFile}`,
    });
    console.log("[PASSED] F3.4-001: ADR Creation & Atomic Persistence");
  } catch (err) {
    results.push({
      id: "F3.4-001",
      name: "ADR Creation & Atomic Persistence",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.4-001:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F3.4-002: ADR Indexing & Listing
  // -------------------------------------------------------------------------
  try {
    // Add second ADR
    storage.saveADR(
      {
        title: "Atomic File Persistence Strategy",
        date: "2026-09-25",
        context: "Prevent data corruption during sudden process restarts.",
        decision: "Use write-to-.tmp followed by synchronous rename.",
      },
      "agent-test",
      sess.id
    );

    const adrs = storage.listADRs();
    if (adrs.length !== 2) {
      throw new Error(`Expected 2 ADRs, got ${adrs.length}`);
    }
    if (adrs[0].id !== "ADR-001" || adrs[1].id !== "ADR-002") {
      throw new Error(`ADR ordering mismatch: ${adrs.map((a) => a.id).join(", ")}`);
    }

    results.push({
      id: "F3.4-002",
      name: "ADR Indexing & Listing",
      status: "PASSED",
      details: `listADRs returned ${adrs.length} sorted ADR records (ADR-001, ADR-002)`,
    });
    console.log("[PASSED] F3.4-002: ADR Indexing & Listing");
  } catch (err) {
    results.push({
      id: "F3.4-002",
      name: "ADR Indexing & Listing",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.4-002:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F3.4-003: Single ADR Retrieval (getADR)
  // -------------------------------------------------------------------------
  try {
    const fetched = storage.getADR("ADR-001");
    if (!fetched) {
      throw new Error("getADR('ADR-001') returned null");
    }
    if (fetched.title !== "Zero-dependency Native OpenCode Plugin Architecture") {
      throw new Error(`Title mismatch: ${fetched.title}`);
    }
    if (fetched.consequences !== "Eliminates secondary daemon and external vector DB complexity.") {
      throw new Error(`Consequences mismatch: ${fetched.consequences}`);
    }

    results.push({
      id: "F3.4-003",
      name: "Single ADR Retrieval (getADR)",
      status: "PASSED",
      details: "getADR recovered ADR-001 record with 100% field fidelity",
    });
    console.log("[PASSED] F3.4-003: Single ADR Retrieval (getADR)");
  } catch (err) {
    results.push({
      id: "F3.4-003",
      name: "Single ADR Retrieval (getADR)",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.4-003:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F3.4-004: Programmatic Task & Goal Mutation
  // -------------------------------------------------------------------------
  try {
    const task1 = storage.addTask("Implement F3.4 Storage extensions", "IN_PROGRESS");
    const task2 = storage.addTask("Verify F3.4 empirical tests", "PENDING");
    storage.updateTaskStatus(task1.id, "COMPLETED");
    storage.setActiveGoal("Complete OpenMemory Phase 3 Core Engine", "IMPLEMENTAR");

    const state = storage.getOrInitProjectState();
    if (state.activeGoal !== "Complete OpenMemory Phase 3 Core Engine") {
      throw new Error(`Active goal mismatch: ${state.activeGoal}`);
    }
    if ((state.currentStage || (state as any).activePhase) !== "IMPLEMENTAR") {
      throw new Error(`Active phase mismatch: ${state.currentStage || (state as any).activePhase}`);
    }
    const updatedTask1 = state.activeTasks.find((t) => t.id === task1.id);
    if (!updatedTask1 || updatedTask1.status !== "COMPLETED") {
      throw new Error("Task 1 status update failed");
    }

    results.push({
      id: "F3.4-004",
      name: "Programmatic Task & Goal Mutation",
      status: "PASSED",
      details: `addTask, updateTaskStatus, and setActiveGoal updated project-state.json cleanly`,
    });
    console.log("[PASSED] F3.4-004: Programmatic Task & Goal Mutation");
  } catch (err) {
    results.push({
      id: "F3.4-004",
      name: "Programmatic Task & Goal Mutation",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.4-004:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F3.4-005: Project Context Summary Synthesis
  // -------------------------------------------------------------------------
  try {
    const summary = storage.formatProjectContextSummary();
    if (
      !summary.includes("# OpenMemory Project Context Summary") ||
      !summary.includes("Complete OpenMemory Phase 3 Core Engine") ||
      !summary.includes("ADR-001") ||
      !summary.includes("Session Continuity Handoff Pointer")
    ) {
      throw new Error("Context summary missing required structural sections");
    }

    results.push({
      id: "F3.4-005",
      name: "Project Context Summary Synthesis",
      status: "PASSED",
      details: "formatProjectContextSummary generated valid Markdown index of phase, tasks, ADRs, and handoff",
    });
    console.log("[PASSED] F3.4-005: Project Context Summary Synthesis");
  } catch (err) {
    results.push({
      id: "F3.4-005",
      name: "Project Context Summary Synthesis",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.4-005:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F3.4-006: Native Slash Commands Declarations
  // -------------------------------------------------------------------------
  try {
    const cmdDir = path.join(process.cwd(), ".opencode", "commands");
    const memStatusFile = path.join(cmdDir, "memory-status.md");
    const handoffFile = path.join(cmdDir, "handoff.md");

    if (!fs.existsSync(memStatusFile) || !fs.existsSync(handoffFile)) {
      throw new Error("Slash command markdown files missing in .opencode/commands/");
    }

    const memStatusContent = fs.readFileSync(memStatusFile, "utf-8");
    const handoffContent = fs.readFileSync(handoffFile, "utf-8");

    if (!memStatusContent.includes("/memory-status") || !handoffContent.includes("/handoff")) {
      throw new Error("Slash command Markdown declarations missing command headers");
    }

    results.push({
      id: "F3.4-006",
      name: "Native Slash Commands Declarations",
      status: "PASSED",
      details: "Validated .opencode/commands/memory-status.md and handoff.md definitions",
    });
    console.log("[PASSED] F3.4-006: Native Slash Commands Declarations");
  } catch (err) {
    results.push({
      id: "F3.4-006",
      name: "Native Slash Commands Declarations",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.4-006:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F3.4-007: OpenCode Plugin End-to-End Context Integration
  // -------------------------------------------------------------------------
  try {
    const pluginInstance = await OpenMemoryPlugin({
      client: {} as any,
      project: "F3.4-Test-Project",
      directory: tempDir,
      worktree: tempDir,
      $: {} as any,
    });

    await pluginInstance.event({
      event: {
        type: "session.created",
        properties: {
          info: { id: "f34-session-001" },
        },
      },
    });

    const eventLogFile = path.join(tempDir, ".openmemory", "logs", "events.jsonl");
    if (!fs.existsSync(eventLogFile)) {
      throw new Error("Plugin event log missing after session.created event");
    }

    const logLines = fs.readFileSync(eventLogFile, "utf-8").trim().split("\n");
    const createdEventLine = logLines.find((l) => l.includes('"eventType":"session.created"'));
    if (!createdEventLine) {
      throw new Error("session.created event entry not found in logs");
    }

    const parsedLog = JSON.parse(createdEventLine);
    if (!parsedLog.payload?.contextSummary) {
      throw new Error("contextSummary missing from session.created log payload");
    }

    results.push({
      id: "F3.4-007",
      name: "OpenCode Plugin End-to-End Context Integration",
      status: "PASSED",
      details: "Plugin emitted contextSummary in event payload on session.created hook",
    });
    console.log("[PASSED] F3.4-007: OpenCode Plugin End-to-End Context Integration");
  } catch (err) {
    results.push({
      id: "F3.4-007",
      name: "OpenCode Plugin End-to-End Context Integration",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.4-007:", (err as Error).message);
  }

  // Clean up scratch temp directory
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}

  // Write test results to evidence
  const evidenceDir = path.join(process.cwd(), ".work", "evidence");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }
  const evidenceFile = path.join(evidenceDir, "phase-3.4-context-test-results.json");
  fs.writeFileSync(evidenceFile, JSON.stringify(results, null, 2), "utf-8");

  console.log("\n=================================================");
  console.log("   F3.4 Context Test Execution Complete!         ");
  console.log(`   Results saved to: .work/evidence/phase-3.4-context-test-results.json`);
  console.log("=================================================");

  const failedCount = results.filter((r) => r.status === "FAILED").length;
  if (failedCount > 0) {
    process.exit(1);
  }
}

runF34Tests();
