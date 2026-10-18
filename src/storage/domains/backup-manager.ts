/**
 * BackupManager: Transactional Staging & Rollback Engine for OpenMemory (F3.5 / R2-R3 Reconciled)
 *
 * Implements:
 * 1. Strict domain ID and path traversal validation.
 * 2. Pre-flight verification of backup metadata and source files with completeness enforcement.
 * 3. Isolated staging before touching live storage.
 * 4. Recovery snapshotting of existing live files prior to replacement.
 * 5. Two-phase application with automatic reverse-rollback on failure.
 * 6. RestoreRecoveryManifest recording operations, phases, and SHA-256 hashes.
 * 7. Clean post-restore arbitration of project state.
 * 8. Cryptographic verification of recovery snapshot files during rollback.
 * 9. Safe quarantine of unparseable recovery directories (never delete evidence).
 * 10. Process-wide mutual exclusion via withStateLock.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { validateDomainId, resolveSecurePath, assertSecureFileName, PathSecurityError } from "../core/path-security";
import { BackupMetadata, ProjectState } from "../types";
import { PersistenceEngine } from "../core/persistence-engine";
import { EventLogger } from "../core/event-logger";

export interface RestoreRecoveryManifest {
  version: 1;
  operationId: string;
  backupId: string;
  phase: "PREPARED" | "APPLYING" | "RECOVERING" | "COMPLETED" | "ROLLED_BACK" | "FAILED_ROLLBACK";
  startedAt: string;
  completedAt?: string;
  success?: boolean;
  error?: string;
  rollbackErrors?: string[];
  files: Array<{
    destination: string;
    recoveryFile: string;
    existed: boolean;
    previousHash: string | null;
    targetHash: string;
  }>;
}

export interface RestoreResult {
  success: boolean;
  backupId: string;
  operationId: string;
  filesRestored: number;
  rolledBack?: boolean;
  error?: string;
}

export class BackupManager {
  private backupsDir: string;
  private openmemoryDir: string;
  private adrsDir: string;
  private manifestPath: string;
  private projectStatePath: string;
  private handoffPath: string;
  private persistenceEngine: PersistenceEngine;
  private eventLogger?: EventLogger;

  constructor(
    paths: {
      backupsDir: string;
      openmemoryDir: string;
      adrsDir: string;
      manifestPath: string;
      projectStatePath: string;
      handoffPath: string;
    },
    persistenceEngine: PersistenceEngine,
    eventLogger?: EventLogger
  ) {
    this.backupsDir = paths.backupsDir;
    this.openmemoryDir = paths.openmemoryDir;
    this.adrsDir = paths.adrsDir;
    this.manifestPath = paths.manifestPath;
    this.projectStatePath = paths.projectStatePath;
    this.handoffPath = paths.handoffPath;
    this.persistenceEngine = persistenceEngine;
    this.eventLogger = eventLogger;

    // Automatic crash recovery on startup: detect and roll back any interrupted restores
    try {
      this.recoverInterruptedRestore();
    } catch (_) {}
  }

  /**
   * Idempotent Crash Recovery Protocol (F3.5-Durable / P0.4 Hardened)
   *
   * Detects and safely rolls back any incomplete restore operations left in
   * .recovery-<opId> directories following an unhandled process termination or power loss.
   * Guaranteed thread/process safety via withStateLock.
   */
  public recoverInterruptedRestore(): { recovered: boolean; operationsRolledBack: number; details: string[]; quarantined?: number } {
    return this.persistenceEngine.withStateLock(() => {
      return this.doRecoverInterruptedRestore();
    }, "backup-crash-recovery");
  }

  private doRecoverInterruptedRestore(): { recovered: boolean; operationsRolledBack: number; details: string[]; quarantined?: number } {
    if (!fs.existsSync(this.backupsDir)) {
      return { recovered: false, operationsRolledBack: 0, details: [], quarantined: 0 };
    }

    const entries = fs.readdirSync(this.backupsDir);
    let operationsRolledBack = 0;
    let quarantinedCount = 0;
    const details: string[] = [];

    for (const entry of entries) {
      if (entry.startsWith(".recovery-")) {
        const recoveryDir = path.join(this.backupsDir, entry);
        const manifestPath = path.join(recoveryDir, "restore-recovery.json");

        if (!fs.existsSync(manifestPath)) {
          // Check if recovery dir contains files other than the missing manifest
          const dirFiles = fs.readdirSync(recoveryDir);
          if (dirFiles.length > 0) {
            // QUARANTINE: Do not delete recovery snapshot files! Preserve for manual forensics.
            const quarantineName = `.quarantined-${entry.replace(/^\./, "")}-${Date.now()}`;
            const quarantinePath = path.join(this.backupsDir, quarantineName);
            try {
              fs.renameSync(recoveryDir, quarantinePath);
              quarantinedCount++;
              details.push(`Quarantined unparseable recovery directory '${entry}' with ${dirFiles.length} files to '${quarantineName}'.`);
            } catch (_) {}
          } else {
            try { fs.rmSync(recoveryDir, { recursive: true, force: true }); } catch (_) {}
          }
          continue;
        }

        let manifest: RestoreRecoveryManifest;
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
          if (!manifest || !manifest.phase || !Array.isArray(manifest.files)) {
            throw new Error("Invalid manifest schema");
          }
        } catch (e: any) {
          // QUARANTINE corrupt manifest directory to prevent data loss
          const dirFiles = fs.readdirSync(recoveryDir);
          const quarantineName = `.quarantined-${entry.replace(/^\./, "")}-${Date.now()}`;
          const quarantinePath = path.join(this.backupsDir, quarantineName);
          try {
            fs.renameSync(recoveryDir, quarantinePath);
            quarantinedCount++;
            details.push(`Quarantined corrupt recovery manifest in '${entry}' to '${quarantineName}': ${e.message}`);
          } catch (_) {}
          continue;
        }

        // If the operation was in APPLYING or RECOVERING phase, live files were potentially partially modified.
        // Execute reverse compensatory rollback from the recovery snapshot.
        if (manifest.phase === "APPLYING" || manifest.phase === "RECOVERING" || manifest.phase === "FAILED_ROLLBACK") {
          // Durable intermediate state before executing compensatory writes
          manifest.phase = "RECOVERING";
          this.writeRecoveryManifest(recoveryDir, manifest);

          const rollbackErrors: string[] = [];
          for (const fileItem of manifest.files.slice().reverse()) {
            try {
              if (fileItem.existed) {
                const recFilePath = path.join(recoveryDir, fileItem.recoveryFile);
                if (!fs.existsSync(recFilePath)) {
                  rollbackErrors.push(`Recovery snapshot file missing: '${fileItem.recoveryFile}' for '${fileItem.destination}'`);
                  continue;
                }
                const originalContent = fs.readFileSync(recFilePath, "utf-8");
                // Cryptographic validation of snapshot file integrity
                if (fileItem.previousHash) {
                  const checkHash = this.sha256(originalContent);
                  if (checkHash !== fileItem.previousHash) {
                    rollbackErrors.push(`Recovery snapshot file corrupted: '${fileItem.recoveryFile}' (expected ${fileItem.previousHash}, got ${checkHash})`);
                    continue;
                  }
                }
                this.persistenceEngine.atomicWriteFileSync(fileItem.destination, originalContent);
              } else if (!fileItem.existed && fs.existsSync(fileItem.destination)) {
                fs.unlinkSync(fileItem.destination);
              }
            } catch (rErr: any) {
              rollbackErrors.push(`Failed to revert '${fileItem.destination}': ${rErr.message}`);
            }
          }

          if (rollbackErrors.length > 0) {
            manifest.phase = "FAILED_ROLLBACK";
            manifest.completedAt = new Date().toISOString();
            manifest.success = false;
            manifest.error = `CRASH_RECOVERY_FAILED: Rollback encountered ${rollbackErrors.length} errors.`;
            manifest.rollbackErrors = rollbackErrors;
            this.writeRecoveryManifest(recoveryDir, manifest);
            details.push(`Operation '${manifest.operationId}' rollback failed: ${rollbackErrors.join("; ")}. Directory preserved for manual inspection.`);
            continue; // PRESERVE recoveryDir for forensics!
          }

          manifest.phase = "ROLLED_BACK";
          manifest.completedAt = new Date().toISOString();
          manifest.success = false;
          manifest.error = "CRASH_RECOVERY: Interrupted restore operation rolled back on startup.";
          manifest.rollbackErrors = [];

          // Record persistent audit manifest
          try {
            const auditManifestPath = path.join(this.backupsDir, "recovery-manifest.json");
            this.persistenceEngine.atomicWriteFileSync(auditManifestPath, JSON.stringify(manifest, null, 2));
          } catch (_) {}

          if (this.eventLogger) {
            this.eventLogger.logEvent("backup.crash_recovered", {
              operationId: manifest.operationId,
              backupId: manifest.backupId,
              rollbackErrorsCount: 0,
            });
          }

          operationsRolledBack++;
          details.push(`Operation '${manifest.operationId}' rolled back successfully.`);

          // Cleanup the recovery directory ONLY after successful rollback
          try { fs.rmSync(recoveryDir, { recursive: true, force: true }); } catch (_) {}
        } else if (manifest.phase === "PREPARED" || manifest.phase === "COMPLETED" || manifest.phase === "ROLLED_BACK") {
          // Terminal consistent states: safe to clean up residual folder
          try { fs.rmSync(recoveryDir, { recursive: true, force: true }); } catch (_) {}
        } else {
          // Ambiguous or unknown phase -> QUARANTINE! Never destroy unconfirmed state!
          const quarantineName = `.quarantined-${entry.replace(/^\./, "")}-${Date.now()}`;
          const quarantinePath = path.join(this.backupsDir, quarantineName);
          try {
            fs.renameSync(recoveryDir, quarantinePath);
            quarantinedCount++;
            details.push(`Quarantined unrecognized recovery phase '${manifest.phase}' in '${entry}' to '${quarantineName}'.`);
          } catch (_) {}
        }
      } else if (entry.startsWith(".staging-")) {
        // Cleanup orphaned staging directories from previous interrupted runs
        const stagingDir = path.join(this.backupsDir, entry);
        try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch (_) {}
      }
    }

    return {
      recovered: operationsRolledBack > 0,
      operationsRolledBack,
      quarantined: quarantinedCount,
      details,
    };
  }

  /**
   * Create an atomic snapshot of current state files.
   * Process-wide exclusion guaranteed via withStateLock.
   */
  public createBackup(label?: string, metadataExtension?: Record<string, any>): BackupMetadata {
    return this.persistenceEngine.withStateLock(() => {
      return this.doCreateBackup(label, metadataExtension);
    }, "backup-create");
  }

  private doCreateBackup(label?: string, metadataExtension?: Record<string, any>): BackupMetadata {
    const timestamp = new Date();
    const isoString = timestamp.toISOString();
    const id = `backup-${isoString.replace(/[:.]/g, "-")}`;
    const targetDir = path.join(this.backupsDir, id);

    fs.mkdirSync(targetDir, { recursive: true });

    let filesCount = 0;
    const stageStatePath = path.join(this.openmemoryDir, "stage-state.json");

    const coreFiles = [
      { name: "openmemory.json", path: this.manifestPath },
      { name: "project-state.json", path: this.projectStatePath },
      { name: "stage-state.json", path: stageStatePath },
      { name: "handoff.md", path: this.handoffPath },
    ];

    const filesManifest: { name: string; sha256: string; size: number }[] = [];

    for (const file of coreFiles) {
      if (fs.existsSync(file.path)) {
        const dest = path.join(targetDir, file.name);
        fs.copyFileSync(file.path, dest);
        filesCount++;
        const content = fs.readFileSync(dest);
        filesManifest.push({
          name: file.name,
          sha256: crypto.createHash("sha256").update(content).digest("hex"),
          size: content.length,
        });
      }
    }

    if (fs.existsSync(this.adrsDir)) {
      const adrFiles = fs.readdirSync(this.adrsDir).filter((f) => f.endsWith(".md"));
      if (adrFiles.length > 0) {
        const adrTargetDir = path.join(targetDir, "adrs");
        fs.mkdirSync(adrTargetDir, { recursive: true });
        for (const adrFile of adrFiles) {
          const dest = path.join(adrTargetDir, adrFile);
          fs.copyFileSync(path.join(this.adrsDir, adrFile), dest);
          filesCount++;
          const content = fs.readFileSync(dest);
          filesManifest.push({
            name: `adrs/${adrFile}`,
            sha256: crypto.createHash("sha256").update(content).digest("hex"),
            size: content.length,
          });
        }
      }
    }

    const metadata: BackupMetadata = {
      id,
      timestamp: isoString,
      label: label || `Snapshot ${id}`,
      filesCount,
      backupPath: targetDir,
      ...metadataExtension,
    };

    this.persistenceEngine.atomicWriteFileSync(
      path.join(targetDir, "backup-metadata.json"),
      JSON.stringify(metadata, null, 2)
    );

    this.persistenceEngine.atomicWriteFileSync(
      path.join(targetDir, "manifest.json"),
      JSON.stringify({ backupId: id, timestamp: isoString, label: metadata.label, files: filesManifest }, null, 2)
    );

    if (this.eventLogger) {
      this.eventLogger.logEvent("backup.created", { id, label: metadata.label, filesCount }, "system");
    }

    return metadata;
  }

  /**
   * List available backups sorted descending by timestamp.
   */
  public listBackups(): BackupMetadata[] {
    if (!fs.existsSync(this.backupsDir)) {
      return [];
    }

    const entries = fs.readdirSync(this.backupsDir, { withFileTypes: true });
    const backups: BackupMetadata[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const metaPath = path.join(this.backupsDir, entry.name, "backup-metadata.json");
        if (fs.existsSync(metaPath)) {
          try {
            const raw = fs.readFileSync(metaPath, "utf-8");
            backups.push(JSON.parse(raw));
          } catch (_) {}
        }
      }
    }

    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Transactional Restore with Staging, Completeness Pre-flight, and Automatic Rollback
   * Synchronized via withStateLock to guarantee single-writer exclusion.
   */
  public restoreBackup(backupId: string, simulateFailureMidApplication: boolean = false): RestoreResult {
    return this.persistenceEngine.withStateLock(() => {
      return this.doRestoreBackup(backupId, simulateFailureMidApplication);
    }, "backup-restore");
  }

  private doRestoreBackup(backupId: string, simulateFailureMidApplication: boolean = false): RestoreResult {
    const validBackupId = validateDomainId(backupId, "backup");
    const backupDir = resolveSecurePath(this.backupsDir, validBackupId);

    if (!fs.existsSync(backupDir)) {
      throw new Error(`Restore failed: Backup snapshot '${backupId}' does not exist.`);
    }

    // Pre-flight check: verify backup metadata
    const metaPath = path.join(backupDir, "backup-metadata.json");
    if (!fs.existsSync(metaPath)) {
      throw new Error(`Restore failed: Backup '${backupId}' is missing backup-metadata.json.`);
    }

    let backupMeta: BackupMetadata;
    try {
      backupMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (!backupMeta.id || !backupMeta.timestamp) {
        throw new Error("Invalid metadata structure");
      }
    } catch (err: any) {
      throw new Error(`Restore failed: Corrupted backup metadata in '${backupId}': ${err.message}`);
    }

    // Check if snapshot manifest.json exists for cryptographic preflight verification
    const snapshotManifestPath = path.join(backupDir, "manifest.json");
    if (!fs.existsSync(snapshotManifestPath)) {
      throw new Error(`Restore failed: Backup '${backupId}' is missing cryptographic manifest.json.`);
    }

    let manifestHashMap: Map<string, string> | null = null;
    let declaredManifestFiles: string[] = [];

    if (fs.existsSync(snapshotManifestPath)) {
      try {
        const manifestObj = JSON.parse(fs.readFileSync(snapshotManifestPath, "utf-8"));
        if (Array.isArray(manifestObj.files)) {
          manifestHashMap = new Map();
          for (const item of manifestObj.files) {
            // Path security check on manifest entries
            if (typeof item.name !== "string" || item.name.includes("..") || path.isAbsolute(item.name)) {
              throw new Error(`Invalid or escaping file path in manifest: '${item.name}'`);
            }
            manifestHashMap.set(item.name, item.sha256);
            declaredManifestFiles.push(item.name);
          }
        }
      } catch (err: any) {
        throw new Error(`Restore failed: Corrupted manifest.json in '${backupId}': ${err.message}`);
      }
    }

    // COMPLETENESS CHECK: If manifest declares files, verify that EVERY declared file is physically present in snapshot
    if (manifestHashMap && declaredManifestFiles.length > 0) {
      for (const declaredFile of declaredManifestFiles) {
        const physicalPath = path.join(backupDir, declaredFile);
        if (!fs.existsSync(physicalPath)) {
          throw new Error(`Restore pre-flight check failed: Backup '${backupId}' is incomplete; declared file '${declaredFile}' is missing from snapshot.`);
        }
      }
    }

    // Collect all files to be restored
    interface CandidateFile {
      name: string;
      sourcePath: string;
      destinationPath: string;
      content: string;
      hash: string;
    }

    const candidates: CandidateFile[] = [];
    const stageStatePath = path.join(this.openmemoryDir, "stage-state.json");

    const coreFiles = [
      { name: "openmemory.json", path: this.manifestPath },
      { name: "project-state.json", path: this.projectStatePath },
      { name: "stage-state.json", path: stageStatePath },
      { name: "handoff.md", path: this.handoffPath },
    ];

    for (const file of coreFiles) {
      const srcPath = path.join(backupDir, file.name);
      if (fs.existsSync(srcPath)) {
        try {
          const content = fs.readFileSync(srcPath, "utf-8");
          // Validate JSON integrity for json files
          if (file.name.endsWith(".json")) {
            JSON.parse(content);
          }
          const hash = this.sha256(content);
          if (manifestHashMap && manifestHashMap.has(file.name)) {
            const expectedHash = manifestHashMap.get(file.name);
            if (expectedHash !== hash) {
              throw new Error(`SHA-256 integrity mismatch on '${file.name}' (expected ${expectedHash}, got ${hash})`);
            }
          }
          candidates.push({
            name: file.name,
            sourcePath: srcPath,
            destinationPath: file.path,
            content,
            hash,
          });
        } catch (err: any) {
          throw new Error(`Restore pre-flight check failed on '${file.name}': ${err.message}`);
        }
      }
    }

    // Collect ADRs
    const adrSrcDir = path.join(backupDir, "adrs");
    if (fs.existsSync(adrSrcDir)) {
      const adrFiles = fs.readdirSync(adrSrcDir).filter((f) => f.endsWith(".md"));
      for (const adrFile of adrFiles) {
        // Enforce path security on backup ADR filenames
        assertSecureFileName(this.adrsDir, adrFile);
        const srcPath = path.join(adrSrcDir, adrFile);
        const content = fs.readFileSync(srcPath, "utf-8");
        const hash = this.sha256(content);
        if (manifestHashMap && manifestHashMap.has(`adrs/${adrFile}`)) {
          const expectedHash = manifestHashMap.get(`adrs/${adrFile}`);
          if (expectedHash !== hash) {
            throw new Error(`SHA-256 integrity mismatch on 'adrs/${adrFile}' (expected ${expectedHash}, got ${hash})`);
          }
        }
        candidates.push({
          name: `adrs/${adrFile}`,
          sourcePath: srcPath,
          destinationPath: path.join(this.adrsDir, adrFile),
          content,
          hash,
        });
      }
    }

    if (candidates.length === 0) {
      throw new Error(`Restore failed: Backup '${backupId}' contains zero valid files to restore.`);
    }

    // Generate unique operation ID
    const operationId = `restore_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const stagingDir = path.join(this.backupsDir, `.staging-${operationId}`);
    const recoveryDir = path.join(this.backupsDir, `.recovery-${operationId}`);

    fs.mkdirSync(stagingDir, { recursive: true });
    fs.mkdirSync(recoveryDir, { recursive: true });

    let appliedDestinations: Array<{
      destinationPath: string;
      existed: boolean;
      recoveryPath?: string;
      previousHash?: string | null;
      targetHash: string;
    }> = [];

    const recoveryManifest: RestoreRecoveryManifest = {
      version: 1,
      operationId,
      backupId,
      phase: "PREPARED",
      startedAt: new Date().toISOString(),
      files: [],
    };

    try {
      // -------------------------------------------------------------
      // STAGE 1: Isolated Staging
      // -------------------------------------------------------------
      for (const c of candidates) {
        const stagedFilePath = path.join(stagingDir, c.name.replace("/", "_"));
        this.persistenceEngine.atomicWriteFileSync(stagedFilePath, c.content);
        const readBackHash = this.sha256File(stagedFilePath);
        if (readBackHash !== c.hash) {
          throw new Error(`Staging verification failed for '${c.name}': hash mismatch.`);
        }
      }

      // -------------------------------------------------------------
      // STAGE 2: Recovery Snapshotting of Current Live Files
      // -------------------------------------------------------------
      const manifestFiles: RestoreRecoveryManifest["files"] = [];

      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const existed = fs.existsSync(c.destinationPath);
        const recFileName = `${String(i).padStart(4, "0")}-${path.basename(c.destinationPath)}`;
        const recFilePath = path.join(recoveryDir, recFileName);

        let previousHash: string | null = null;
        if (existed) {
          const liveContent = fs.readFileSync(c.destinationPath, "utf-8");
          this.persistenceEngine.atomicWriteFileSync(recFilePath, liveContent);
          previousHash = this.sha256(liveContent);
        }

        manifestFiles.push({
          destination: c.destinationPath,
          recoveryFile: recFileName,
          existed,
          previousHash,
          targetHash: c.hash,
        });
      }

      recoveryManifest.files = manifestFiles;
      this.writeRecoveryManifest(recoveryDir, recoveryManifest);

      // -------------------------------------------------------------
      // STAGE 3: Application Phase
      // -------------------------------------------------------------
      recoveryManifest.phase = "APPLYING";
      this.writeRecoveryManifest(recoveryDir, recoveryManifest);

      for (let i = 0; i < candidates.length; i++) {
        // Controlled injection for testing rollback
        if (simulateFailureMidApplication && i === Math.floor(candidates.length / 2)) {
          throw new Error("Simulated mid-restore catastrophic I/O failure");
        }

        const c = candidates[i];
        const mf = manifestFiles[i];

        appliedDestinations.push({
          destinationPath: c.destinationPath,
          existed: mf.existed,
          recoveryPath: mf.existed ? path.join(recoveryDir, mf.recoveryFile) : undefined,
          previousHash: mf.previousHash,
          targetHash: c.hash,
        });

        // Ensure target directory exists (e.g. adrsDir)
        fs.mkdirSync(path.dirname(c.destinationPath), { recursive: true });
        this.persistenceEngine.atomicWriteFileSync(c.destinationPath, c.content);

        // Verify applied hash
        const appliedHash = this.sha256File(c.destinationPath);
        if (appliedHash !== c.hash) {
          throw new Error(`Verification failed on applied file '${c.name}'`);
        }
      }

      // -------------------------------------------------------------
      // STAGE 4: Completion Confirmation & Cleanup
      // -------------------------------------------------------------
      recoveryManifest.phase = "COMPLETED";
      recoveryManifest.completedAt = new Date().toISOString();
      recoveryManifest.success = true;
      this.writeRecoveryManifest(recoveryDir, recoveryManifest);

      // Record persistent audit recovery manifest in backups directory
      try {
        const auditManifestPath = path.join(this.backupsDir, "recovery-manifest.json");
        this.persistenceEngine.atomicWriteFileSync(auditManifestPath, JSON.stringify(recoveryManifest, null, 2));
      } catch (_) {}

      // Clean up temporary directories
      try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch (_) {}
      try { fs.rmSync(recoveryDir, { recursive: true, force: true }); } catch (_) {}

      if (this.eventLogger) {
        this.eventLogger.logEvent("backup.restored", { backupId, operationId, filesRestored: candidates.length }, "system");
      }

      return {
        success: true,
        backupId,
        operationId,
        filesRestored: candidates.length,
      };
    } catch (err: any) {
      // -------------------------------------------------------------
      // ROLLBACK PHASE: Reverse application of all touched files
      // -------------------------------------------------------------
      console.warn(`[BackupManager] Restore failed for operation '${operationId}': ${err.message}. Initiating rollback...`);

      let rollbackErrors: string[] = [];
      for (const item of appliedDestinations.slice().reverse()) {
        try {
          if (item.existed && item.recoveryPath && fs.existsSync(item.recoveryPath)) {
            const originalContent = fs.readFileSync(item.recoveryPath, "utf-8");
            // Cryptographic verification before applying rollback
            if (item.previousHash) {
              const checkHash = this.sha256(originalContent);
              if (checkHash !== item.previousHash) {
                rollbackErrors.push(`Recovery snapshot file corrupted for '${item.destinationPath}' (expected ${item.previousHash}, got ${checkHash})`);
                continue;
              }
            }
            this.persistenceEngine.atomicWriteFileSync(item.destinationPath, originalContent);
          } else if (!item.existed && fs.existsSync(item.destinationPath)) {
            fs.unlinkSync(item.destinationPath);
          }
        } catch (rbErr: any) {
          rollbackErrors.push(`Failed to revert '${item.destinationPath}': ${rbErr.message}`);
        }
      }

      recoveryManifest.phase = rollbackErrors.length > 0 ? "FAILED_ROLLBACK" : "ROLLED_BACK";
      recoveryManifest.completedAt = new Date().toISOString();
      recoveryManifest.success = false;
      recoveryManifest.error = err.message;
      recoveryManifest.rollbackErrors = rollbackErrors;

      // Persist the updated status inside recoveryDir
      this.writeRecoveryManifest(recoveryDir, recoveryManifest);

      // Record persistent audit recovery manifest on failure
      try {
        const auditManifestPath = path.join(this.backupsDir, "recovery-manifest.json");
        this.persistenceEngine.atomicWriteFileSync(auditManifestPath, JSON.stringify(recoveryManifest, null, 2));
      } catch (_) {}

      // Clean up staging directory
      try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch (_) {}

      // Keep recovery directory on rollback failure for forensics, otherwise remove
      if (rollbackErrors.length === 0) {
        try { fs.rmSync(recoveryDir, { recursive: true, force: true }); } catch (_) {}
      }

      const totalError = `Restore failed: ${err.message}. Rollback executed${
        rollbackErrors.length > 0 ? ` with errors: ${rollbackErrors.join("; ")}` : " successfully (original state preserved)"
      }.`;

      return {
        success: false,
        backupId,
        operationId,
        filesRestored: 0,
        rolledBack: true,
        error: totalError,
      };
    }
  }

  private writeRecoveryManifest(dir: string, manifest: RestoreRecoveryManifest): void {
    const manifestPath = path.join(dir, "restore-recovery.json");
    this.persistenceEngine.atomicWriteFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  private sha256(content: string | Buffer): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private sha256File(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex");
  }
}
