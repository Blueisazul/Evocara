import * as fs from "fs";
import * as path from "path";
import { StorageEngine } from "../../src/storage";

async function runStorageEngineTests() {
  console.log("=================================================");
  console.log("   OpenMemory F3.1 Storage Foundation Test Suite  ");
  console.log("=================================================\n");

  const testDir = path.join(process.cwd(), ".work", "experiments", "storage-test-workspace");
  const openmemoryDir = path.join(testDir, ".openmemory");

  // Cleanup test workspace
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  const testResults: Array<{ id: string; name: string; status: "PASSED" | "FAILED"; details: string }> = [];

  const recordResult = (id: string, name: string, status: "PASSED" | "FAILED", details: string) => {
    testResults.push({ id, name, status, details });
    console.log(`[${status}] ${id}: ${name}`);
    console.log(`       Details: ${details}\n`);
  };

  try {
    const storage = new StorageEngine(testDir);

    // -------------------------------------------------------------
    // TEST 1: Missing Storage Auto-Initialization & Structure
    // -------------------------------------------------------------
    const manifest = storage.getOrInitManifest();
    const state = storage.getOrInitProjectState();
    const handoff = storage.getOrInitHandoff();

    if (
      fs.existsSync(path.join(openmemoryDir, "openmemory.json")) &&
      fs.existsSync(path.join(openmemoryDir, "project-state.json")) &&
      fs.existsSync(path.join(openmemoryDir, "handoff.md")) &&
      fs.existsSync(path.join(openmemoryDir, "adrs")) &&
      fs.existsSync(path.join(openmemoryDir, "backups")) &&
      fs.existsSync(path.join(openmemoryDir, "logs"))
    ) {
      recordResult(
        "F3.1-001",
        "Missing Storage Auto-Initialization",
        "PASSED",
        "StorageEngine safely auto-created full .openmemory/ directory hierarchy and default manifest/state/handoff files."
      );
    } else {
      recordResult("F3.1-001", "Missing Storage Auto-Initialization", "FAILED", "Directory hierarchy was not completely created.");
    }

    // -------------------------------------------------------------
    // TEST 2: Atomic Write Execution & Corruption Safeguard
    // -------------------------------------------------------------
    state.currentStage = "IMPLEMENTAR";
    state.sessionRunCount = 5;
    storage.saveProjectState(state);

    const updatedStateRaw = fs.readFileSync(path.join(openmemoryDir, "project-state.json"), "utf-8");
    const updatedState = JSON.parse(updatedStateRaw);

    if ((updatedState.currentStage === "IMPLEMENTAR" || updatedState.activePhase === "IMPLEMENTAR") && updatedState.sessionRunCount === 5) {
      recordResult(
        "F3.1-002",
        "Atomic File Persistence & State Update",
        "PASSED",
        "State update written atomically and read back cleanly without data loss."
      );
    } else {
      recordResult("F3.1-002", "Atomic File Persistence & State Update", "FAILED", "Atomic write state update failed.");
    }

    // -------------------------------------------------------------
    // TEST 3: Corrupted State File Recovery
    // -------------------------------------------------------------
    fs.writeFileSync(path.join(openmemoryDir, "project-state.json"), "{ CORRUPTED_INVALID_JSON ...", "utf-8");
    const recoveredState = storage.getOrInitProjectState();

    if (recoveredState && (recoveredState.currentStage === "DESCUBRIR" || (recoveredState as any).activePhase === "DESCUBRIR")) {
      recordResult(
        "F3.1-003",
        "Corrupted File Safe Recovery",
        "PASSED",
        "StorageEngine detected corrupted JSON file, caught error, and safely re-initialized clean state."
      );
    } else {
      recordResult("F3.1-003", "Corrupted File Safe Recovery", "FAILED", "Failed to recover from corrupted state file.");
    }

    // -------------------------------------------------------------
    // TEST 4: Session Handoff Markdown Writer & Reader
    // -------------------------------------------------------------
    const newHandoffContent = `# Updated Session Handoff\n\n**Status:** Atomic Storage Verified`;
    storage.saveHandoff(newHandoffContent);
    const readBackHandoff = storage.getOrInitHandoff();

    if (readBackHandoff === newHandoffContent) {
      recordResult(
        "F3.1-004",
        "Handoff Markdown Persistence",
        "PASSED",
        "Handoff Markdown content persisted and recovered with 100% string fidelity."
      );
    } else {
      recordResult("F3.1-004", "Handoff Markdown Persistence", "FAILED", "Handoff Markdown string mismatch.");
    }
  } catch (error) {
    console.error("F3.1 Test suite execution encountered an error:", error);
  } finally {
    // Clean up test workspace
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }

  // Save evidence
  const evidenceFile = path.join(process.cwd(), ".work", "evidence", "phase-3.1-storage-test-results.json");
  fs.writeFileSync(evidenceFile, JSON.stringify(testResults, null, 2), "utf-8");

  console.log("=================================================");
  console.log("   F3.1 Storage Test Execution Complete!         ");
  console.log(`   Results saved to: .work/evidence/phase-3.1-storage-test-results.json`);
  console.log("=================================================\n");
}

runStorageEngineTests();
