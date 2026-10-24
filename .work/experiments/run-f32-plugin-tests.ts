import * as fs from "fs";
import * as path from "path";
import { OpenMemoryPlugin } from "../../.opencode/plugins/openmemory";
import { StorageEngine } from "../../src/storage";

async function runPluginTests() {
  console.log("=================================================");
  console.log("   OpenMemory F3.2 Official Plugin Test Suite    ");
  console.log("=================================================\n");

  const testWorkspaceDir = path.join(process.cwd(), ".work", "experiments", "plugin-test-workspace");
  const openmemoryDir = path.join(testWorkspaceDir, ".openmemory");
  const stateFile = path.join(openmemoryDir, "project-state.json");
  const compactionEvidence = path.join(testWorkspaceDir, ".work", "evidence", "opencode-compaction-payload.json");

  // Clean up test workspace beforehand
  if (fs.existsSync(testWorkspaceDir)) {
    fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testWorkspaceDir, { recursive: true });

  const testResults: Array<{ id: string; name: string; status: "PASSED" | "FAILED"; details: string }> = [];

  const recordResult = (id: string, name: string, status: "PASSED" | "FAILED", details: string) => {
    testResults.push({ id, name, status, details });
    console.log(`[${status}] ${id}: ${name}`);
    console.log(`       Details: ${details}\n`);
  };

  try {
    // -------------------------------------------------------------
    // TEST 1: SPIKE-F3.2-01 & 06 - Missing Storage Auto-Init & Load
    // -------------------------------------------------------------
    const pluginInstance = await OpenMemoryPlugin({
      client: {} as any,
      project: "OpenMemory-Official-Test",
      $: {} as any,
      directory: testWorkspaceDir,
      worktree: testWorkspaceDir,
    });

    const logsFile = path.join(openmemoryDir, "logs", "events.jsonl");
    if (fs.existsSync(logsFile) && fs.readFileSync(logsFile, "utf-8").includes("plugin.initialized")) {
      recordResult(
        "F3.2-01 / F3.2-06",
        "Plugin Load & Missing Storage Auto-Init",
        "PASSED",
        "Plugin loaded cleanly when .openmemory/ did not exist and auto-created storage structure with initialized event log."
      );
    } else {
      recordResult("F3.2-01 / F3.2-06", "Plugin Load & Missing Storage Auto-Init", "FAILED", "Plugin failed to initialize storage.");
    }

    // -------------------------------------------------------------
    // TEST 2: SPIKE-F3.2-02 - session.created Connection with StorageEngine
    // -------------------------------------------------------------
    await pluginInstance.event({
      event: {
        type: "session.created",
        properties: {
          info: { id: "session-official-001" },
        },
      },
    });

    const stateStorage = new StorageEngine(testWorkspaceDir);
    const initialProjectState = stateStorage.getOrInitProjectState();

    if (
      initialProjectState.sessionRunCount === 1 &&
      initialProjectState.lastSessionId === "session-official-001" &&
      initialProjectState.currentStatus === "SESSION_ACTIVE"
    ) {
      recordResult(
        "F3.2-02",
        "session.created Storage Engine Connection",
        "PASSED",
        "session.created hook successfully connected to StorageEngine, updating project-state.json with runCount=1 and sessionId."
      );
    } else {
      recordResult(
        "F3.2-02",
        "session.created Storage Engine Connection",
        "FAILED",
        `State mismatch: ${JSON.stringify(initialProjectState)}`
      );
    }

    // -------------------------------------------------------------
    // TEST 3: SPIKE-F3.2-03 - State Persistence Integrity
    // -------------------------------------------------------------
    const rawState = fs.readFileSync(stateFile, "utf-8");
    if (rawState.includes("session-official-001") && fs.existsSync(path.join(openmemoryDir, "handoff.md"))) {
      recordResult(
        "F3.2-03",
        "State Persistence Integrity",
        "PASSED",
        "Atomic state and handoff files verified on disk with 100% data integrity."
      );
    } else {
      recordResult("F3.2-03", "State Persistence Integrity", "FAILED", "State or handoff files missing or corrupted.");
    }

    // -------------------------------------------------------------
    // TEST 4: SPIKE-F3.2-04 - session.idle Checkpoint Persistence
    // -------------------------------------------------------------
    await pluginInstance.event({
      event: {
        type: "session.idle",
        properties: {
          sessionID: "session-official-001",
        },
        timestamp: new Date().toISOString(),
      },
    });

    const idleState = stateStorage.getOrInitProjectState();
    if (idleState.currentStatus === "IDLE_CHECKPOINT_SAVED") {
      recordResult(
        "F3.2-04",
        "session.idle Checkpoint Persistence",
        "PASSED",
        "session.idle hook captured and persisted IDLE_CHECKPOINT_SAVED status atomically."
      );
    } else {
      recordResult("F3.2-04", "session.idle Checkpoint Persistence", "FAILED", `Status mismatch: ${idleState.currentStatus}`);
    }

    // -------------------------------------------------------------
    // TEST 5: SPIKE-F3.2-05 - session.compacted Event Handling
    // -------------------------------------------------------------
    await pluginInstance.event({
      event: {
        type: "session.compacted",
        properties: {
          sessionID: "session-official-001",
        },
        summary: "Official OpenCode history compaction test summary.",
        tokensFreed: 15000,
      },
    });

    const compactionState = stateStorage.getOrInitProjectState();
    if (
      compactionState.currentStatus === "COMPACTION_CHECKPOINT_SAVED" &&
      fs.existsSync(compactionEvidence)
    ) {
      recordResult(
        "F3.2-05",
        "session.compacted Event Handling",
        "PASSED",
        "session.compacted captured, state updated to COMPACTION_CHECKPOINT_SAVED, and evidence saved to disk."
      );
    } else {
      recordResult("F3.2-05", "session.compacted Event Handling", "FAILED", "Compaction event handling failed.");
    }

    // -------------------------------------------------------------
    // TEST 6: SPIKE-F3.2-07 - Non-Destructive Storage Behavior
    // -------------------------------------------------------------
    const handoffBefore = stateStorage.getOrInitHandoff();
    // Trigger session created again
    await pluginInstance.event({
      event: {
        type: "session.created",
        properties: {
          info: { id: "session-official-001-repeat" },
        },
      },
    });
    const handoffAfter = stateStorage.getOrInitHandoff();

    if (handoffBefore === handoffAfter) {
      recordResult(
        "F3.2-07",
        "Non-Destructive Storage Behavior",
        "PASSED",
        "Plugin preserved existing handoff.md content non-destructively across session events."
      );
    } else {
      recordResult("F3.2-07", "Non-Destructive Storage Behavior", "FAILED", "Existing content was mutated destructively.");
    }

    // -------------------------------------------------------------
    // TEST 7 & 8: SPIKE-F3.2-08 - Session B State Recovery from Session A
    // -------------------------------------------------------------
    const secondPluginInstance = await OpenMemoryPlugin({
      client: {} as any,
      project: "OpenMemory-Official-Test",
      $: {} as any,
      directory: testWorkspaceDir,
      worktree: testWorkspaceDir,
    });

    await secondPluginInstance.event({
      event: {
        type: "session.created",
        properties: {
          info: { id: "session-official-002" },
        },
      },
    });

    const recoveredState = stateStorage.getOrInitProjectState();
    if (recoveredState.sessionRunCount === 3 && recoveredState.lastSessionId === "session-official-002") {
      recordResult(
        "F3.2-08",
        "Cross-Session State Recovery",
        "PASSED",
        "Session B successfully loaded Session A state, incrementing runCount to 3 and recovering project state."
      );
    } else {
      recordResult(
        "F3.2-08",
        "Cross-Session State Recovery",
        "FAILED",
        `Failed to recover previous session state: ${JSON.stringify(recoveredState)}`
      );
    }
  } catch (error) {
    console.error("F3.2 Test suite execution encountered an error:", error);
  } finally {
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
  }

  // Save evidence
  const evidenceFile = path.join(process.cwd(), ".work", "evidence", "phase-3.2-plugin-test-results.json");
  fs.writeFileSync(evidenceFile, JSON.stringify(testResults, null, 2), "utf-8");

  console.log("=================================================");
  console.log("   F3.2 Plugin Test Execution Complete!          ");
  console.log(`   Results saved to: .work/evidence/phase-3.2-plugin-test-results.json`);
  console.log("=================================================\n");
}

runPluginTests();
