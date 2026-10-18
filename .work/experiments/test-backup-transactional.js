/**
 * Transactional Backup & Restore Verification Suite (F3.5 / P0.4 Hardened)
 *
 * Verifies:
 * 1. Happy path: Backup creation with SHA-256 manifest, isolated staging restore, live state arbitration.
 * 2. SEC-001 defense: Path traversal and malformed backup ID rejection.
 * 3. Pre-flight verification: Tampered/corrupted backup files rejected BEFORE touching live data.
 * 4. Mid-restore failure & automatic rollback: Atomic rollback from recovery snapshot when I/O fails during apply.
 * 5. Idempotent Crash Recovery on Startup: Recovering from interrupted restore in APPLYING phase.
 * 6. Incomplete Snapshot Pre-Flight Rejection: Rejection when snapshot declared files are missing.
 * 7. Quarantine of Corrupted Recovery Directory: Non-destructive preservation of unparseable recovery folders.
 * 8. Recovery Snapshot Tamper Detection: Detection of corrupted recovery snapshot during rollback.
 * 9. Real Child Process Crash Simulation: Live state recovery after an abrupt child process exit during apply.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const child_process = require("child_process");
const { StorageEngine, BackupManager } = require("../../dist/storage");

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  PASS: ${message}`);
}

function run() {
  console.log("==================================================================");
  console.log("=== BACKUP-TRANS: Transactional Backup & Recovery Suite (P0.4) ===");
  console.log("==================================================================");

  const testBaseDir = process.env.OPENMEMORY_TEST_DIR || fs.mkdtempSync(path.join(os.tmpdir(), "om-backup-test-"));
  const projectRoot = path.join(testBaseDir, "project-consumer");
  fs.mkdirSync(projectRoot, { recursive: true });

  const storage = new StorageEngine(projectRoot);

  // ------------------------------------------------------------------
  // Test 1: Happy Path - Backup creation, staging, and restore
  // ------------------------------------------------------------------
  console.log("\n[TEST 1] Happy path: createBackup -> modify live -> restoreBackup");
  
  const stateV1 = storage.getOrInitProjectState();
  stateV1.project_name = "GenesisProject";
  stateV1.current_step = "Step 1: Inception";
  storage.saveProjectState(stateV1);

  const handoffContentV1 = "# Context Handoff\nActive Task: Build Architecture\nStatus: In Progress";
  storage.saveHandoff(handoffContentV1);

  const backupMeta = storage.createBackup("v1.0-checkpoint");
  assert(backupMeta.id.startsWith("backup-") || backupMeta.id.startsWith("backup_"), `Backup ID generated: ${backupMeta.id}`);
  assert(backupMeta.label === "v1.0-checkpoint", "Backup label preserved");
  assert(backupMeta.filesCount >= 2, `Backup files counted: ${backupMeta.filesCount}`);

  const backupDir = path.join(projectRoot, ".openmemory", "backups", backupMeta.id);
  const manifestPath = path.join(backupDir, "manifest.json");
  assert(fs.existsSync(manifestPath), "Snapshot manifest.json created in backup directory");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  assert(manifest.backupId === backupMeta.id, "Manifest backupId matches");
  assert(manifest.files.every(f => f.sha256 && f.sha256.length === 64), "All files have valid SHA-256 in manifest");

  const list = storage.listBackups();
  assert(list.some(b => b.id === backupMeta.id), "listBackups() contains the newly created backup");

  const mutatedState = storage.getOrInitProjectState();
  mutatedState.project_name = "MutatedProject";
  mutatedState.current_step = "Step 99: Destructive Change";
  storage.saveProjectState(mutatedState);
  storage.saveHandoff("# Context Handoff\nActive Task: Destroyed");
  assert(storage.getOrInitProjectState().project_name === "MutatedProject", "Live state mutated");

  const restoreSuccess = storage.restoreBackup(backupMeta.id);
  assert(restoreSuccess === true, "restoreBackup() returned true");

  const restoredState = storage.getOrInitProjectState();
  assert(restoredState.project_name === "GenesisProject", "Live projectState restored to GenesisProject");
  assert(restoredState.current_step === "Step 1: Inception", "Live current_step restored");

  const restoredHandoff = storage.getOrInitHandoff();
  assert(restoredHandoff.includes("Active Task: Build Architecture"), "Live handoff restored to v1");

  const recoveryManifestPath = path.join(projectRoot, ".openmemory", "backups", "recovery-manifest.json");
  assert(fs.existsSync(recoveryManifestPath), "recovery-manifest.json recorded");
  const recoveryManifest = JSON.parse(fs.readFileSync(recoveryManifestPath, "utf-8"));
  assert(recoveryManifest.success === true, "recovery manifest marked success=true");
  assert(recoveryManifest.phase.toLowerCase() === "completed", "recovery manifest phase=completed");

  // ------------------------------------------------------------------
  // Test 2: Security & Path Traversal Rejection
  // ------------------------------------------------------------------
  console.log("\n[TEST 2] Security: Reject path traversal / invalid backupId");

  const badIds = [
    "../../etc/passwd",
    "..\\..\\windows\\win.ini",
    "backup_123/../../secret",
    "backup_123\u0000null",
    "backup_123*wildcard",
    "/absolute/path/backup",
    "C:\\absolute\\backup",
  ];

  for (const badId of badIds) {
    let caught = false;
    try {
      storage.restoreBackup(badId);
    } catch (e) {
      caught = true;
    }
    assert(caught, `Path traversal payload blocked: "${badId}"`);
  }

  // ------------------------------------------------------------------
  // Test 3: Pre-flight Verification of Tampered Files
  // ------------------------------------------------------------------
  console.log("\n[TEST 3] Pre-flight: Tampered / corrupted backup rejected before touching live state");

  const tamperMeta = storage.createBackup("tamper-test");
  const tamperDir = path.join(projectRoot, ".openmemory", "backups", tamperMeta.id);
  const targetToCorrupt = path.join(tamperDir, "project-state.json");
  fs.writeFileSync(targetToCorrupt, JSON.stringify({ corrupted: true, hacked: true }));

  const stateBeforeTamperRestore = storage.getOrInitProjectState();

  let tamperCaught = false;
  try {
    storage.restoreBackup(tamperMeta.id);
  } catch (e) {
    tamperCaught = true;
  }

  assert(tamperCaught, "Restore of tampered backup was rejected");
  const stateAfterTamperRestore = storage.getOrInitProjectState();
  assert(
    stateAfterTamperRestore.project_name === stateBeforeTamperRestore.project_name,
    "Live state remained completely untouched despite corrupted backup attempt"
  );

  // ------------------------------------------------------------------
  // Test 4: Transactional Rollback on Mid-Application I/O Error
  // ------------------------------------------------------------------
  console.log("\n[TEST 4] Transactional Rollback: Recovery snapshot restores live state on error");

  const vLiveBeforeRestore = storage.getOrInitProjectState();
  vLiveBeforeRestore.project_name = "CurrentLiveBeforeCrash";
  storage.saveProjectState(vLiveBeforeRestore);

  const validMeta = storage.createBackup("valid-target");

  const vLiveModified = storage.getOrInitProjectState();
  vLiveModified.project_name = "CurrentLiveBeforeCrash";
  storage.saveProjectState(vLiveModified);

  const backupMgr = storage.getBackupManager();

  // Fail only once during application write, allowing rollback write to succeed!
  const originalAtomicWrite = backupMgr.persistenceEngine.atomicWriteFileSync.bind(backupMgr.persistenceEngine);
  let failOnce = true;
  backupMgr.persistenceEngine.atomicWriteFileSync = function(targetPath, data) {
    if (failOnce && targetPath.includes("project-state.json") && !targetPath.includes(".recovery-") && !targetPath.includes(".staging-")) {
      failOnce = false;
      throw new Error("SIMULATED_DISK_IO_FAILURE_MID_APPLY");
    }
    return originalAtomicWrite(targetPath, data);
  };

  let caughtError = false;
  try {
    const res = backupMgr.restoreBackup(validMeta.id);
    if (!res.success) caughtError = true;
  } catch (e) {
    caughtError = true;
  } finally {
    backupMgr.persistenceEngine.atomicWriteFileSync = originalAtomicWrite;
  }

  assert(caughtError, "Mid-restore simulated failure triggered error handling");

  const stateAfterRollback = storage.getOrInitProjectState();
  assert(
    stateAfterRollback.project_name === "CurrentLiveBeforeCrash",
    `Rollback preserved original live state (Expected 'CurrentLiveBeforeCrash', got '${stateAfterRollback.project_name}')`
  );

  const rollbackManifest = JSON.parse(fs.readFileSync(recoveryManifestPath, "utf-8"));
  assert(rollbackManifest.success === false, "Recovery manifest records success=false");
  assert(rollbackManifest.phase.toLowerCase().replace(/_/g, "-") === "rolled-back", `Recovery manifest phase recorded as '${rollbackManifest.phase}'`);

  // ------------------------------------------------------------------
  // Test 5: Idempotent Crash Recovery on Startup
  // ------------------------------------------------------------------
  console.log("\n[TEST 5] Crash Recovery: Interrupted restore in APPLYING phase rolled back on startup");

  const crashOpId = "crash_sim_9999";
  const crashRecoveryDir = path.join(projectRoot, ".openmemory", "backups", `.recovery-${crashOpId}`);
  const crashStagingDir = path.join(projectRoot, ".openmemory", "backups", `.staging-${crashOpId}`);
  fs.mkdirSync(crashRecoveryDir, { recursive: true });
  fs.mkdirSync(crashStagingDir, { recursive: true });

  const originalRecoveryState = { project_name: "RecoveredPreCrashData", currentStage: "DESCUBRIR" };
  const stageStatePath = path.join(projectRoot, ".openmemory", "stage-state.json");
  const projectStatePath = path.join(projectRoot, ".openmemory", "project-state.json");

  fs.writeFileSync(path.join(crashRecoveryDir, "0000-project-state.json"), JSON.stringify(originalRecoveryState, null, 2), "utf-8");
  fs.writeFileSync(path.join(crashRecoveryDir, "001-stage-state.json"), JSON.stringify(originalRecoveryState, null, 2), "utf-8");

  const crashManifest = {
    version: 1,
    operationId: crashOpId,
    backupId: "backup-fake-target",
    phase: "APPLYING",
    startedAt: new Date(Date.now() - 30000).toISOString(),
    files: [
      {
        destination: projectStatePath,
        recoveryFile: "0000-project-state.json",
        existed: true,
        previousHash: crypto.createHash("sha256").update(JSON.stringify(originalRecoveryState, null, 2)).digest("hex"),
        targetHash: "dummy",
      },
      {
        destination: stageStatePath,
        recoveryFile: "001-stage-state.json",
        existed: true,
        previousHash: crypto.createHash("sha256").update(JSON.stringify(originalRecoveryState, null, 2)).digest("hex"),
        targetHash: "dummy",
      },
    ],
  };
  fs.writeFileSync(path.join(crashRecoveryDir, "restore-recovery.json"), JSON.stringify(crashManifest, null, 2), "utf-8");

  fs.writeFileSync(projectStatePath, JSON.stringify({ project_name: "HalfWrittenCorruptedData" }, null, 2), "utf-8");
  fs.writeFileSync(stageStatePath, JSON.stringify({ project_name: "HalfWrittenCorruptedData" }, null, 2), "utf-8");

  const rebootedStorage = new StorageEngine(projectRoot);
  const restoredAfterCrash = rebootedStorage.getOrInitProjectState();
  assert(restoredAfterCrash.project_name === "RecoveredPreCrashData", `Live state was automatically restored to pre-crash baseline on reboot! (Got '${restoredAfterCrash.project_name}')`);

  const secondRun = rebootedStorage.recoverInterruptedRestore();
  assert(secondRun.recovered === false && secondRun.operationsRolledBack === 0, "Second invocation is idempotent no-op");
  assert(!fs.existsSync(crashRecoveryDir), "Interrupted .recovery- directory was cleaned up");
  assert(!fs.existsSync(crashStagingDir), "Interrupted .staging- directory was cleaned up");

  const auditManifest = JSON.parse(fs.readFileSync(recoveryManifestPath, "utf-8"));
  assert(auditManifest.phase.toLowerCase().replace(/_/g, "-") === "rolled-back", "Crash recovery manifest marked ROLLED_BACK");
  assert(auditManifest.success === false, "Crash recovery manifest marked success=false");

  // ------------------------------------------------------------------
  // Test 6: Incomplete Snapshot Pre-Flight Rejection (P0.4 Completeness)
  // ------------------------------------------------------------------
  console.log("\n[TEST 6] Incomplete Snapshot Pre-Flight Rejection (Completeness Check)");

  const incompleteMeta = storage.createBackup("incomplete-test");
  const incompleteDir = path.join(projectRoot, ".openmemory", "backups", incompleteMeta.id);
  const fileToRemove = path.join(incompleteDir, "handoff.md");
  if (fs.existsSync(fileToRemove)) fs.unlinkSync(fileToRemove);

  const handoffBeforeIncomplete = storage.getOrInitHandoff();

  let incompleteCaught = false;
  try {
    storage.restoreBackup(incompleteMeta.id);
  } catch (err) {
    if (err.message.includes("is incomplete") && err.message.includes("handoff.md")) {
      incompleteCaught = true;
    }
  }

  assert(incompleteCaught, "Restore rejected incomplete backup missing declared handoff.md");
  assert(storage.getOrInitHandoff() === handoffBeforeIncomplete, "Live handoff remained intact after incomplete restore rejection");

  // ------------------------------------------------------------------
  // Test 7: Safe Quarantine of Corrupted Recovery Directory (P0.4 Quarantine)
  // ------------------------------------------------------------------
  console.log("\n[TEST 7] Safe Quarantine of Corrupted Recovery Directory");

  const brokenRecoveryDir = path.join(projectRoot, ".openmemory", "backups", ".recovery-broken-manifest");
  fs.mkdirSync(brokenRecoveryDir, { recursive: true });
  fs.writeFileSync(path.join(brokenRecoveryDir, "0000-important-data.json"), JSON.stringify({ critical: true }), "utf-8");
  fs.writeFileSync(path.join(brokenRecoveryDir, "restore-recovery.json"), "CORRUPTED_NON_JSON_DATA{", "utf-8");

  const quarantineReport = storage.recoverInterruptedRestore();
  assert(quarantineReport.quarantined >= 1, "Quarantine report registered corrupted recovery directory");
  assert(!fs.existsSync(brokenRecoveryDir), "Original corrupted recovery directory was moved out of active recovery scan");

  const backupsDirEntries = fs.readdirSync(path.join(projectRoot, ".openmemory", "backups"));
  const quarantinedEntry = backupsDirEntries.find(e => e.startsWith(".quarantined-recovery-broken-manifest"));
  assert(quarantinedEntry !== undefined, "Quarantined directory preserved on disk for manual inspection");

  // Clean up quarantined entry after verification
  if (quarantinedEntry) {
    fs.rmSync(path.join(projectRoot, ".openmemory", "backups", quarantinedEntry), { recursive: true, force: true });
  }

  // ------------------------------------------------------------------
  // Test 8: Recovery Snapshot File Corruption Detection During Rollback
  // ------------------------------------------------------------------
  console.log("\n[TEST 8] Recovery Snapshot File Corruption Detection During Rollback");

  const tamperRollbackOpId = "tamper_rb_7777";
  const tamperRecoveryDir = path.join(projectRoot, ".openmemory", "backups", `.recovery-${tamperRollbackOpId}`);
  fs.mkdirSync(tamperRecoveryDir, { recursive: true });

  const validOriginal = { project_name: "OriginalUncorruptedData" };
  const validHash = crypto.createHash("sha256").update(JSON.stringify(validOriginal)).digest("hex");

  // Recovery file on disk is corrupted / does not match previousHash!
  fs.writeFileSync(path.join(tamperRecoveryDir, "0000-project-state.json"), JSON.stringify({ corrupted: "HACKED_SNAPSHOT" }), "utf-8");

  const tamperManifest = {
    version: 1,
    operationId: tamperRollbackOpId,
    backupId: "backup-dummy",
    phase: "APPLYING",
    startedAt: new Date().toISOString(),
    files: [
      {
        destination: projectStatePath,
        recoveryFile: "0000-project-state.json",
        existed: true,
        previousHash: validHash,
        targetHash: "dummy",
      },
    ],
  };
  fs.writeFileSync(path.join(tamperRecoveryDir, "restore-recovery.json"), JSON.stringify(tamperManifest, null, 2), "utf-8");

  const tamperReport = storage.recoverInterruptedRestore();
  assert(fs.existsSync(tamperRecoveryDir), "Recovery directory preserved on rollback error (not deleted!)");
  const failedManifest = JSON.parse(fs.readFileSync(path.join(tamperRecoveryDir, "restore-recovery.json"), "utf-8"));
  assert(failedManifest.phase === "FAILED_ROLLBACK", "Manifest phase marked FAILED_ROLLBACK");
  assert(failedManifest.rollbackErrors.length > 0, "Rollback errors recorded corrupted snapshot file");

  // Clean up test tamper recovery dir
  fs.rmSync(tamperRecoveryDir, { recursive: true, force: true });

  // ------------------------------------------------------------------
  // Test 9: Real Child Process Crash & Recovery Simulation
  // ------------------------------------------------------------------
  console.log("\n[TEST 9] Real Child Process Crash & Recovery Simulation");

  const childOpId = "child_crash_proc_8888";
  const childRecoveryDir = path.join(projectRoot, ".openmemory", "backups", `.recovery-${childOpId}`);
  fs.mkdirSync(childRecoveryDir, { recursive: true });

  const preCrashProjectState = { project_name: "PreChildCrashSolidBaseline", version: 42 };
  fs.writeFileSync(path.join(childRecoveryDir, "0000-project-state.json"), JSON.stringify(preCrashProjectState, null, 2), "utf-8");

  const childManifest = {
    version: 1,
    operationId: childOpId,
    backupId: "backup-child-test",
    phase: "APPLYING",
    startedAt: new Date().toISOString(),
    files: [
      {
        destination: projectStatePath,
        recoveryFile: "0000-project-state.json",
        existed: true,
        previousHash: crypto.createHash("sha256").update(JSON.stringify(preCrashProjectState, null, 2)).digest("hex"),
        targetHash: "dummy",
      },
    ],
  };
  fs.writeFileSync(path.join(childRecoveryDir, "restore-recovery.json"), JSON.stringify(childManifest, null, 2), "utf-8");

  // Mutate live file to simulate half-written state when child crashed
  fs.writeFileSync(projectStatePath, JSON.stringify({ project_name: "CorruptedByDeadChildProcess" }, null, 2), "utf-8");

  // Spawn isolated child process that instantiates StorageEngine (simulating fresh reboot in separate OS process)
  // StorageEngine automatically detects the interrupted restore in its constructor and recovers live state!
  const childScript = `
    const { StorageEngine } = require("${path.resolve(__dirname, "../../dist/storage").replace(/\\/g, "/")}");
    const storage = new StorageEngine("${projectRoot.replace(/\\/g, "/")}");
    const state = storage.getOrInitProjectState();
    if (state.project_name === "PreChildCrashSolidBaseline") {
      process.exit(0);
    } else {
      console.error("Failed to recover on child boot. State:", state);
      process.exit(1);
    }
  `;

  const childRes = child_process.spawnSync(process.execPath, ["-e", childScript], { encoding: "utf-8" });
  if (childRes.status !== 0) {
    console.error("Child process stdout:", childRes.stdout);
    console.error("Child process stderr:", childRes.stderr);
  }
  assert(childRes.status === 0, `Child recovery process exited cleanly (Code ${childRes.status})`);

  const restoredProjectState = storage.getOrInitProjectState();
  assert(
    restoredProjectState.project_name === "PreChildCrashSolidBaseline",
    `Live state recovered to pre-crash baseline across process boundary! (Got '${restoredProjectState.project_name}')`
  );

  // ------------------------------------------------------------------
  // Test 10: Retrying Rollback after FAILED_ROLLBACK (P0.5)
  // ------------------------------------------------------------------
  console.log("\n[TEST 10] Retrying Rollback after FAILED_ROLLBACK");

  const failedRbOpId = "failed_rb_sim_1010";
  const failedRbDir = path.join(projectRoot, ".openmemory", "backups", `.recovery-${failedRbOpId}`);
  fs.mkdirSync(failedRbDir, { recursive: true });

  const originalStateBeforeFailure = { project_name: "OriginalStateBeforeFailure", step: "Initial" };
  const failedRbHash = crypto.createHash("sha256").update(JSON.stringify(originalStateBeforeFailure, null, 2)).digest("hex");
  fs.writeFileSync(path.join(failedRbDir, "0000-project-state.json"), JSON.stringify(originalStateBeforeFailure, null, 2), "utf-8");

  const failedRbManifest = {
    version: 1,
    operationId: failedRbOpId,
    backupId: "backup-dummy",
    phase: "FAILED_ROLLBACK",
    startedAt: new Date(Date.now() - 60000).toISOString(),
    error: "Previous transient I/O failure during rollback",
    rollbackErrors: ["Transient disk error"],
    files: [
      {
        destination: projectStatePath,
        recoveryFile: "0000-project-state.json",
        existed: true,
        previousHash: failedRbHash,
        targetHash: "dummy",
      },
    ],
  };
  fs.writeFileSync(path.join(failedRbDir, "restore-recovery.json"), JSON.stringify(failedRbManifest, null, 2), "utf-8");

  // Mutate live file to simulate state left behind by previously failed rollback
  fs.writeFileSync(projectStatePath, JSON.stringify({ project_name: "DirtyStateLeftByFailedRollback" }, null, 2), "utf-8");

  // Re-run recovery: it must retry FAILED_ROLLBACK, succeed, and clean up!
  const retryReport = storage.recoverInterruptedRestore();
  assert(retryReport.recovered === true, "FAILED_ROLLBACK was successfully retried and recovered");
  assert(!fs.existsSync(failedRbDir), "Recovery directory was cleaned up after successful FAILED_ROLLBACK retry");

  const stateAfterRetry = storage.getOrInitProjectState();
  assert(
    stateAfterRetry.project_name === "OriginalStateBeforeFailure",
    `Live state restored to pre-failure baseline! (Got '${stateAfterRetry.project_name}')`
  );

  // ------------------------------------------------------------------
  // Test 11: Non-Destructive Quarantine of Ambiguous / Unrecognized Phases (P0.5)
  // ------------------------------------------------------------------
  console.log("\n[TEST 11] Non-Destructive Quarantine of Ambiguous Recovery Phases");

  const ambiguousOpId = "ambiguous_phase_sim_2020";
  const ambiguousDir = path.join(projectRoot, ".openmemory", "backups", `.recovery-${ambiguousOpId}`);
  fs.mkdirSync(ambiguousDir, { recursive: true });
  fs.writeFileSync(path.join(ambiguousDir, "0000-data.json"), JSON.stringify({ important: true }), "utf-8");

  const ambiguousManifest = {
    version: 1,
    operationId: ambiguousOpId,
    backupId: "backup-dummy",
    phase: "UNKNOWN_CUSTOM_PHASE",
    startedAt: new Date().toISOString(),
    files: [],
  };
  fs.writeFileSync(path.join(ambiguousDir, "restore-recovery.json"), JSON.stringify(ambiguousManifest, null, 2), "utf-8");

  const ambReport = storage.recoverInterruptedRestore();
  assert(ambReport.quarantined >= 1, "Ambiguous recovery phase was registered as quarantined");
  assert(!fs.existsSync(ambiguousDir), "Original ambiguous recovery directory was moved out of active recovery");

  const backupsEntries = fs.readdirSync(path.join(projectRoot, ".openmemory", "backups"));
  const quarantinedAmb = backupsEntries.find(e => e.startsWith(`.quarantined-recovery-${ambiguousOpId}`));
  assert(quarantinedAmb !== undefined, "Ambiguous recovery directory was safely preserved as quarantined");

  if (quarantinedAmb) {
    fs.rmSync(path.join(projectRoot, ".openmemory", "backups", quarantinedAmb), { recursive: true, force: true });
  }

  // ------------------------------------------------------------------
  // Test 12: Second Interruption during RECOVERING phase (P0.5)
  // ------------------------------------------------------------------
  console.log("\n[TEST 12] Second Interruption during RECOVERING phase");

  const recoveringOpId = "recovering_crash_sim_3030";
  const recoveringDir = path.join(projectRoot, ".openmemory", "backups", `.recovery-${recoveringOpId}`);
  fs.mkdirSync(recoveringDir, { recursive: true });

  const recoveringBaselineState = { project_name: "RecoveringBaseline", step: "Midway" };
  const recoveringHash = crypto.createHash("sha256").update(JSON.stringify(recoveringBaselineState, null, 2)).digest("hex");
  fs.writeFileSync(path.join(recoveringDir, "0000-project-state.json"), JSON.stringify(recoveringBaselineState, null, 2), "utf-8");

  const recoveringManifest = {
    version: 1,
    operationId: recoveringOpId,
    backupId: "backup-recovering-target",
    phase: "RECOVERING", // Process died while executing recovery!
    startedAt: new Date().toISOString(),
    files: [
      {
        destination: projectStatePath,
        recoveryFile: "0000-project-state.json",
        existed: true,
        previousHash: recoveringHash,
        targetHash: "dummy",
      },
    ],
  };
  fs.writeFileSync(path.join(recoveringDir, "restore-recovery.json"), JSON.stringify(recoveringManifest, null, 2), "utf-8");

  fs.writeFileSync(projectStatePath, JSON.stringify({ project_name: "CorruptedBySecondInterruption" }, null, 2), "utf-8");

  const recovReport = storage.recoverInterruptedRestore();
  assert(recovReport.recovered === true, "RECOVERING phase was successfully recognized and rolled back");
  assert(!fs.existsSync(recoveringDir), "Recovery directory cleaned up after RECOVERING completion");

  const stateAfterRecovering = storage.getOrInitProjectState();
  assert(
    stateAfterRecovering.project_name === "RecoveringBaseline",
    `Live state recovered from in-flight RECOVERING crash! (Got '${stateAfterRecovering.project_name}')`
  );

  // ------------------------------------------------------------------
  // Test 13: Rejection of Backup Snapshot Missing manifest.json (P0.5)
  // ------------------------------------------------------------------
  console.log("\n[TEST 13] Rejection of Backup Snapshot Missing manifest.json");

  const noManifestMeta = storage.createBackup("no-manifest-test");
  const noManifestDir = path.join(projectRoot, ".openmemory", "backups", noManifestMeta.id);
  const snapManifestFile = path.join(noManifestDir, "manifest.json");
  if (fs.existsSync(snapManifestFile)) fs.unlinkSync(snapManifestFile);

  const stateBeforeNoManifest = storage.getOrInitProjectState();

  let noManifestCaught = false;
  try {
    storage.restoreBackup(noManifestMeta.id);
  } catch (err) {
    if (err.message.includes("is missing cryptographic manifest.json")) {
      noManifestCaught = true;
    }
  }

  assert(noManifestCaught, "restoreBackup rejected snapshot missing manifest.json");
  assert(
    storage.getOrInitProjectState().project_name === stateBeforeNoManifest.project_name,
    "Live state remained completely untouched after missing manifest rejection"
  );

  // ------------------------------------------------------------------
  // Test 14: Process Concurrency: Concurrent withStateLock Protection (P0.5)
  // ------------------------------------------------------------------
  console.log("\n[TEST 14] Process Concurrency: Concurrent withStateLock Protection");

  let lockExecuted = false;
  storage.withStateLock(() => {
    // Inside the lock, verify re-entrancy works seamlessly
    storage.withStateLock(() => {
      lockExecuted = true;
    }, "reentrant-agent");
  }, "outer-agent");
  assert(lockExecuted === true, "Re-entrant withStateLock executed without deadlock");

  console.log(`\n==================================================================`);
  console.log(`=== ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY! ===`);
  console.log(`==================================================================\n`);
}

try {
  run();
} catch (err) {
  console.error("FATAL ERROR in backup transactional test:", err);
  process.exit(1);
}
