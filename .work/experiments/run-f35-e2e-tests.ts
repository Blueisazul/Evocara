import * as fs from "fs";
import * as path from "path";
import { StorageEngine } from "../../src/storage";
import { runCLI } from "../../src/cli";
import { OpenMemoryPlugin } from "../../.opencode/plugins/openmemory";

interface TestResult {
  id: string;
  name: string;
  status: "PASSED" | "FAILED";
  details: string;
}

const results: TestResult[] = [];

// Setup isolated temp workspace for F3.5 E2E tests
const tempDir = path.join(process.cwd(), ".work", "scratch-f35-e2e-test");
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

async function runF35E2ETests() {
  console.log("=================================================");
  console.log("   OpenMemory F3.5 Multi-Session & E2E Test Suite ");
  console.log("=================================================\n");

  const storage = new StorageEngine(tempDir);
  storage.ensureStorageStructure();

  // -------------------------------------------------------------------------
  // Test F3.5-001: Orphaned .tmp File Cleanup
  // -------------------------------------------------------------------------
  try {
    const openmemoryDir = path.join(tempDir, ".openmemory");
    const orphanTmp1 = path.join(openmemoryDir, "stale-state.12345.tmp");
    const orphanTmp2 = path.join(openmemoryDir, "adrs", "stale-adr.67890.tmp");

    fs.mkdirSync(path.dirname(orphanTmp2), { recursive: true });
    fs.writeFileSync(orphanTmp1, "orphaned state temp content");
    fs.writeFileSync(orphanTmp2, "orphaned adr temp content");

    const removedCount = storage.cleanupTempFiles();
    if (removedCount < 2) {
      throw new Error(`Expected at least 2 orphaned temp files removed, got ${removedCount}`);
    }
    if (fs.existsSync(orphanTmp1) || fs.existsSync(orphanTmp2)) {
      throw new Error("Orphaned temp files still exist on disk after cleanup");
    }

    results.push({
      id: "F3.5-001",
      name: "Orphaned .tmp File Cleanup",
      status: "PASSED",
      details: `cleanupTempFiles successfully unlinked ${removedCount} orphaned .tmp files`,
    });
    console.log("[PASSED] F3.5-001: Orphaned .tmp File Cleanup");
  } catch (err) {
    results.push({
      id: "F3.5-001",
      name: "Orphaned .tmp File Cleanup",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.5-001:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F3.5-002: Atomic Backup Creation
  // -------------------------------------------------------------------------
  let backupId = "";
  try {
    storage.getOrInitManifest();
    storage.getOrInitProjectState();
    storage.getOrInitHandoff();
    const sess = storage.registerSession({ agentId: "agent-e2e", status: "ACTIVE" });
    storage.saveADR(
      {
        title: "E2E Backup Strategy Verification",
        date: "2026-09-25",
        context: "Verify pre-modification atomic backups.",
        decision: "Copy state files to timestamped backup directory.",
      },
      "agent-e2e",
      sess.id
    );

    const backupMeta = storage.createBackup("e2e-test-label");
    backupId = backupMeta.id;

    if (!fs.existsSync(backupMeta.backupPath)) {
      throw new Error(`Backup directory ${backupMeta.backupPath} does not exist`);
    }
    const metaFile = path.join(backupMeta.backupPath, "backup-metadata.json");
    if (!fs.existsSync(metaFile)) {
      throw new Error("backup-metadata.json missing in snapshot directory");
    }

    results.push({
      id: "F3.5-002",
      name: "Atomic Backup Creation",
      status: "PASSED",
      details: `createBackup created snapshot '${backupId}' containing ${backupMeta.filesCount} files`,
    });
    console.log("[PASSED] F3.5-002: Atomic Backup Creation");
  } catch (err) {
    results.push({
      id: "F3.5-002",
      name: "Atomic Backup Creation",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.5-002:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F3.5-003: Backup Listing & Metadata Retrieval
  // -------------------------------------------------------------------------
  try {
    const backups = storage.listBackups();
    if (backups.length === 0) {
      throw new Error("listBackups returned empty array");
    }
    const targetBackup = backups.find((b) => b.id === backupId);
    if (!targetBackup) {
      throw new Error(`Target backup '${backupId}' not found in listBackups results`);
    }
    if (targetBackup.label !== "e2e-test-label") {
      throw new Error(`Backup label mismatch: ${targetBackup.label}`);
    }

    results.push({
      id: "F3.5-003",
      name: "Backup Listing & Metadata Retrieval",
      status: "PASSED",
      details: `listBackups enumerated ${backups.length} snapshot(s) with valid metadata`,
    });
    console.log("[PASSED] F3.5-003: Backup Listing & Metadata Retrieval");
  } catch (err) {
    results.push({
      id: "F3.5-003",
      name: "Backup Listing & Metadata Retrieval",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.5-003:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F3.5-004: Safe State Recovery from Backup Snapshot
  // -------------------------------------------------------------------------
  try {
    // Corrupt state artificially
    const projectStateFile = path.join(tempDir, ".openmemory", "project-state.json");
    fs.writeFileSync(projectStateFile, "BAD_CORRUPTED_CONTENT");

    // Restore from backup
    const success = storage.restoreBackup(backupId);
    if (!success) {
      throw new Error("restoreBackup returned false");
    }

    const restoredState = storage.getOrInitProjectState();
    if (!restoredState.currentStage || (restoredState as any).activePhase === "CORRUPTED") {
      throw new Error("Restored state failed to parse or was invalid");
    }

    results.push({
      id: "F3.5-004",
      name: "Safe State Recovery from Backup Snapshot",
      status: "PASSED",
      details: `restoreBackup successfully restored corrupted state from snapshot '${backupId}'`,
    });
    console.log("[PASSED] F3.5-004: Safe State Recovery from Backup Snapshot");
  } catch (err) {
    results.push({
      id: "F3.5-004",
      name: "Safe State Recovery from Backup Snapshot",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.5-004:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F3.5-005: Storage Diagnostic Engine & Self-Healing
  // -------------------------------------------------------------------------
  try {
    const report = storage.runDiagnostics();
    if (report.status !== "HEALTHY" && report.status !== "REPAIRED") {
      throw new Error(`Diagnostic status was ${report.status}`);
    }
    if (report.checks.length < 4) {
      throw new Error(`Expected at least 4 diagnostic checks, got ${report.checks.length}`);
    }

    results.push({
      id: "F3.5-005",
      name: "Storage Diagnostic Engine & Self-Healing",
      status: "PASSED",
      details: `runDiagnostics completed with status ${report.status} across ${report.checks.length} checks`,
    });
    console.log("[PASSED] F3.5-005: Storage Diagnostic Engine & Self-Healing");
  } catch (err) {
    results.push({
      id: "F3.5-005",
      name: "Storage Diagnostic Engine & Self-Healing",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.5-005:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F3.5-006: Programmatic CLI Commands Execution
  // -------------------------------------------------------------------------
  try {
    const statusOut = await runCLI(["status"], tempDir);
    const backupOut = await runCLI(["backup", "cli-test"], tempDir);
    const listOut = await runCLI(["list-backups"], tempDir);
    const diagOut = await runCLI(["diagnostics"], tempDir);
    const cleanOut = await runCLI(["cleanup"], tempDir);

    if (!statusOut.includes("OpenMemory Project Context Summary")) {
      throw new Error("CLI 'status' output format invalid");
    }
    if (!backupOut.includes("Backup created successfully")) {
      throw new Error("CLI 'backup' output format invalid");
    }
    if (!listOut.includes("Available Backups")) {
      throw new Error("CLI 'list-backups' output format invalid");
    }
    if (!diagOut.includes("Storage Diagnostic Report")) {
      throw new Error("CLI 'diagnostics' output format invalid");
    }
    if (!cleanOut.includes("Temp file cleanup complete")) {
      throw new Error("CLI 'cleanup' output format invalid");
    }

    results.push({
      id: "F3.5-006",
      name: "Programmatic CLI Commands Execution",
      status: "PASSED",
      details: "CLI commands status, backup, list-backups, diagnostics, and cleanup executed cleanly",
    });
    console.log("[PASSED] F3.5-006: Programmatic CLI Commands Execution");
  } catch (err) {
    results.push({
      id: "F3.5-006",
      name: "Programmatic CLI Commands Execution",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.5-006:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F3.5-007: Simulated Crash Recovery Across Multi-Session Execution
  // -------------------------------------------------------------------------
  try {
    // Session A initializes state and writes active task
    const storageA = new StorageEngine(tempDir);
    const taskA = storageA.addTask("Pre-crash pending task", "IN_PROGRESS");
    storageA.setActiveGoal("Phase 3 Multi-Session Verification", "PHASE_3_TEST");

    // Simulate abrupt crash by placing incomplete temp file and unhandled crash marker
    const crashTmp = path.join(tempDir, ".openmemory", "project-state.json.12345.tmp");
    fs.writeFileSync(crashTmp, "unwritten binary tail");

    // Session B starts (simulating recovery)
    const pluginB = await OpenMemoryPlugin({
      client: {} as any,
      project: "CrashRecoveryProject",
      directory: tempDir,
      worktree: tempDir,
      $: {} as any,
    });

    await pluginB.event({
      event: {
        type: "session.created",
        properties: {
          info: { id: "session-post-crash-001" },
        },
      },
    });

    const storageB = new StorageEngine(tempDir);
    const recoveredState = storageB.getOrInitProjectState();

    if (recoveredState.activeGoal !== "Phase 3 Multi-Session Verification") {
      throw new Error("Active goal lost after crash recovery");
    }
    if (!recoveredState.activeTasks.some((t) => t.id === taskA.id)) {
      throw new Error("Active task lost after crash recovery");
    }
    if (fs.existsSync(crashTmp)) {
      throw new Error("Crash temp file was not cleaned up during Session B startup");
    }

    results.push({
      id: "F3.5-007",
      name: "Simulated Crash Recovery Across Multi-Session Execution",
      status: "PASSED",
      details: "Session B successfully cleaned up crash artifacts and recovered Session A state intact",
    });
    console.log("[PASSED] F3.5-007: Simulated Crash Recovery Across Multi-Session Execution");
  } catch (err) {
    results.push({
      id: "F3.5-007",
      name: "Simulated Crash Recovery Across Multi-Session Execution",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.5-007:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F3.5-008: Full End-to-End System Lifecycle Verification
  // -------------------------------------------------------------------------
  try {
    const pluginE2E = await OpenMemoryPlugin({
      client: {} as any,
      project: "OpenMemory-E2E",
      directory: tempDir,
      worktree: tempDir,
      $: {} as any,
    });

    // 1. Session created
    await pluginE2E.event({
      event: {
        type: "session.created",
        properties: {
          info: { id: "e2e-sess-001" },
        },
      },
    });

    // 2. Session idle
    await pluginE2E.event({
      event: {
        type: "session.idle",
        properties: {
          sessionID: "e2e-sess-001",
        },
        timestamp: new Date().toISOString(),
      },
    });

    // 3. Session compacted
    await pluginE2E.event({
      event: {
        type: "session.compacted",
        properties: {
          sessionID: "e2e-sess-001",
        },
        summary: "Context compressed during E2E run",
      },
    });

    const finalStorage = new StorageEngine(tempDir);
    const finalState = finalStorage.getOrInitProjectState();
    const finalHandoff = finalStorage.getOrInitHandoff();

    if (finalState.currentStatus !== "COMPACTION_CHECKPOINT_SAVED") {
      throw new Error(`Expected COMPACTION_CHECKPOINT_SAVED status, got ${finalState.currentStatus}`);
    }
    if (!finalHandoff.includes("Session Handoff")) {
      throw new Error("Handoff header missing in final state");
    }

    results.push({
      id: "F3.5-008",
      name: "Full End-to-End System Lifecycle Verification",
      status: "PASSED",
      details: "Validated session.created -> session.idle -> session.compacted full lifecycle end-to-end",
    });
    console.log("[PASSED] F3.5-008: Full End-to-End System Lifecycle Verification");
  } catch (err) {
    results.push({
      id: "F3.5-008",
      name: "Full End-to-End System Lifecycle Verification",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F3.5-008:", (err as Error).message);
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
  const evidenceFile = path.join(evidenceDir, "phase-3.5-e2e-test-results.json");
  fs.writeFileSync(evidenceFile, JSON.stringify(results, null, 2), "utf-8");

  console.log("\n=================================================");
  console.log("   F3.5 E2E Test Execution Complete!             ");
  console.log(`   Results saved to: .work/evidence/phase-3.5-e2e-test-results.json`);
  console.log("=================================================");

  const failedCount = results.filter((r) => r.status === "FAILED").length;
  if (failedCount > 0) {
    process.exit(1);
  }
}

runF35E2ETests();
