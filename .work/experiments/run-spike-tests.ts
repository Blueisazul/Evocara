import * as fs from "fs";
import * as path from "path";
import { OpenMemorySpikePlugin } from "../../.opencode/plugins/openmemory-spike";

/**
 * Phase 2 Empirical Test Runner for OpenMemory Plugin Spike
 * Runs tests for SPIKE-001 through SPIKE-007 and records empirical findings.
 */
async function runSpikeTests() {
  console.log("=================================================");
  console.log("   OpenMemory Phase 2 Empirical Plugin Spike Test   ");
  console.log("=================================================\n");

  const workspaceDir = process.env.OPENMEMORY_TEST_DIR || process.cwd();
  const spikeDir = path.join(workspaceDir, ".openmemory", "spike");
  const stateFile = path.join(spikeDir, "state.json");
  const eventsFile = path.join(spikeDir, "events.jsonl");

  const testResults: Array<{ id: string; name: string; status: "PASSED" | "FAILED"; details: string }> = [];

  // Helper to append test result
  const recordResult = (id: string, name: string, status: "PASSED" | "FAILED", details: string) => {
    testResults.push({ id, name, status, details });
    console.log(`[${status}] ${id}: ${name}`);
    console.log(`       Details: ${details}\n`);
  };

  // -------------------------------------------------------------
  // TEST 1: SPIKE-006 - Missing Storage Auto-Initialization
  // -------------------------------------------------------------
  if (fs.existsSync(spikeDir)) {
    fs.rmSync(spikeDir, { recursive: true, force: true });
  }

  try {
    const pluginInstance = await OpenMemorySpikePlugin({
      client: {} as any,
      project: "scratch-test",
      $: {} as any,
      directory: workspaceDir,
      worktree: workspaceDir,
    });

    if (fs.existsSync(eventsFile)) {
      recordResult(
        "SPIKE-006",
        "Missing Storage Handling",
        "PASSED",
        "Plugin initialized safely without errors when .openmemory/ did not exist, and auto-created the storage directory."
      );
    } else {
      recordResult("SPIKE-006", "Missing Storage Handling", "FAILED", "Storage directory was not auto-created.");
    }

    // -------------------------------------------------------------
    // TEST 2: SPIKE-001 - Plugin Discovery & Initialization
    // -------------------------------------------------------------
    const eventsContent = fs.readFileSync(eventsFile, "utf-8");
    if (eventsContent.includes("plugin.initialized")) {
      recordResult(
        "SPIKE-001",
        "Plugin Discovery & Load",
        "PASSED",
        "Plugin exported valid lifecycle object and registered startup event."
      );
    } else {
      recordResult("SPIKE-001", "Plugin Discovery & Load", "FAILED", "plugin.initialized event not found in logs.");
    }

    // -------------------------------------------------------------
    // TEST 3: SPIKE-002 - session.created Event Payload & Recovery Init
    // -------------------------------------------------------------
    await pluginInstance.event({
      event: {
        type: "session.created",
        session: { id: "session-empirical-001", createdAt: new Date().toISOString() },
      },
    });

    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
      if (state.lastSessionId === "session-empirical-001" && state.sessionRunCount === 1) {
        recordResult(
          "SPIKE-002",
          "session.created Event",
          "PASSED",
          `Captured session.created payload successfully. State written to disk with sessionRunCount=1.`
        );
      } else {
        recordResult("SPIKE-002", "session.created Event", "FAILED", `State payload unexpected: ${JSON.stringify(state)}`);
      }
    } else {
      recordResult("SPIKE-002", "session.created Event", "FAILED", "state.json file was not created.");
    }

    // -------------------------------------------------------------
    // TEST 4: SPIKE-003 - session.idle Event & Checkpoint Persistence
    // -------------------------------------------------------------
    await pluginInstance.event({
      event: {
        type: "session.idle",
        timestamp: new Date().toISOString(),
      },
    });

    const idleState = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    if (idleState.status === "IDLE_CHECKPOINT_SAVED" && idleState.lastIdleTimestamp) {
      recordResult(
        "SPIKE-003",
        "session.idle Event",
        "PASSED",
        `session.idle captured successfully and saved checkpoint timestamp at ${idleState.lastIdleTimestamp}`
      );
    } else {
      recordResult("SPIKE-003", "session.idle Event", "FAILED", "session.idle checkpoint was not written to state.");
    }

    // -------------------------------------------------------------
    // TEST 5: SPIKE-004 - session.compacted Event
    // -------------------------------------------------------------
    await pluginInstance.event({
      event: {
        type: "session.compacted",
        summary: "Context was compressed during active developer session.",
        previousMessageCount: 45,
      },
    });

    const compactionEvidence = path.join(workspaceDir, ".work", "evidence", "opencode-compaction-payload.json");
    if (fs.existsSync(compactionEvidence)) {
      recordResult(
        "SPIKE-004",
        "session.compacted Event",
        "PASSED",
        `session.compacted payload captured and recorded to .work/evidence/opencode-compaction-payload.json`
      );
    } else {
      recordResult("SPIKE-004", "session.compacted Event", "FAILED", "Compaction evidence file was not created.");
    }

    // -------------------------------------------------------------
    // TEST 6: SPIKE-005 & SPIKE-007 - State Persistence Across Session Restarts
    // -------------------------------------------------------------
    // Simulate Session B (Re-instantiating plugin with existing storage)
    const secondPluginInstance = await OpenMemorySpikePlugin({
      client: {} as any,
      project: "scratch-test",
      $: {} as any,
      directory: workspaceDir,
      worktree: workspaceDir,
    });

    await secondPluginInstance.event({
      event: {
        type: "session.created",
        session: { id: "session-empirical-002", createdAt: new Date().toISOString() },
      },
    });

    const recoveredState = JSON.parse(fs.readFileSync(stateFile, "utf-8"));
    if (recoveredState.sessionRunCount === 2 && recoveredState.recoveredState === true) {
      recordResult(
        "SPIKE-005 / SPIKE-007",
        "State Recovery & Existing Storage",
        "PASSED",
        `Session B successfully recovered state from Session A. sessionRunCount incremented to 2, recoveredState=true.`
      );
    } else {
      recordResult(
        "SPIKE-005 / SPIKE-007",
        "State Recovery & Existing Storage",
        "FAILED",
        `Failed to recover previous session state: ${JSON.stringify(recoveredState)}`
      );
    }
  } catch (error) {
    console.error("Test execution encountered an error:", error);
  }

  // -------------------------------------------------------------
  // Summary Evidence Generation
  // -------------------------------------------------------------
  const evidenceDir = path.join(workspaceDir, ".work", "evidence");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }
  const summaryEvidenceFile = path.join(evidenceDir, "phase-2-spike-results.json");
  fs.writeFileSync(summaryEvidenceFile, JSON.stringify(testResults, null, 2), "utf-8");

  console.log("=================================================");
  console.log("   Spike Empirical Testing Complete!             ");
  console.log(`   Results saved to: .work/evidence/phase-2-spike-results.json`);
  console.log("=================================================\n");
}

runSpikeTests();
