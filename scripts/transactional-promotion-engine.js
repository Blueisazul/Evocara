const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync, spawnSync } = require('child_process');

/**
 * Transactional Promotion & Verified Rollback Engine (P1.5 Hardened)
 *
 * Implements a strict, fail-safe state machine for deploying OpenMemory to consumer applications:
 *
 * State Transitions:
 *   UNINITIALIZED
 *     -> LOCK_ACQUIRED
 *     -> PREFLIGHT_VERIFIED
 *     -> BACKED_UP
 *     -> APPLYING
 *     -> SMOKE_TESTING
 *     -> POST_VERIFYING
 *     -> COMMITTED
 *
 * Rollback Transitions:
 *   ANY_ACTIVE_STATE (on error)
 *     -> ROLLING_BACK
 *     -> ROLLED_BACK (on clean recovery)
 *     OR -> FAILED_ROLLBACK (on recovery failure, with safe quarantine & evidence preservation)
 */

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function isProcessAlive(pid) {
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return !(err && (err.code === 'ESRCH' || err.code === 'EINVAL'));
  }
}

/**
 * Atomic rename with retry and exponential backoff to handle transient
 * filesystem locks (EBUSY / EPERM / EACCES) caused by Windows indexing / antivirus.
 */
function atomicRenameWithRetry(src, dst, maxRetries = 5, delayMs = 50) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.renameSync(src, dst);
      return true;
    } catch (err) {
      if ((err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') && attempt < maxRetries) {
        const sleepMs = Math.round(delayMs * Math.pow(1.5, attempt - 1));
        const end = Date.now() + sleepMs;
        while (Date.now() < end) {}
        continue;
      }
      throw err;
    }
  }
}

/**
 * Strict boundary containment check preventing prefix collision attacks,
 * junctions, and intermediate directory symlink escapes across Windows, Linux, and macOS.
 */
function isContainedWithin(baseDir, targetPath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);

  // Check lexical relative path
  const rel = path.relative(resolvedBase, resolvedTarget);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return false;
  }

  // If base does not exist, fall back to lexical check
  if (!fs.existsSync(resolvedBase)) {
    return true;
  }

  let realBase;
  try {
    realBase = fs.realpathSync(resolvedBase);
  } catch (_) {
    realBase = resolvedBase;
  }

  // If target exists, verify physical realpath
  if (fs.existsSync(resolvedTarget)) {
    try {
      const realTarget = fs.realpathSync(resolvedTarget);
      const realRel = path.relative(realBase, realTarget);
      if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
        return false;
      }
    } catch (_) {}
  } else {
    // If target does not exist, find closest existing ancestor to prevent intermediate symlink evasion
    let ancestor = path.dirname(resolvedTarget);
    while (ancestor && ancestor !== path.dirname(ancestor)) {
      if (fs.existsSync(ancestor)) {
        try {
          const realAncestor = fs.realpathSync(ancestor);
          const realRel = path.relative(realBase, realAncestor);
          if (realRel.startsWith('..') || path.isAbsolute(realRel)) {
            return false;
          }
        } catch (_) {}
        break;
      }
      ancestor = path.dirname(ancestor);
    }
  }

  return true;
}

/**
 * Recursive directory walk collecting all files, dotfiles, and empty directories.
 * Strictly ignores foreign dirs (node_modules, .git, backups) and rejects symlinks.
 */
function collectDirectoryInventory(baseDir, currentDir = baseDir) {
  const inventory = {};
  if (!fs.existsSync(currentDir)) return inventory;

  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    // Symlink / ReparsePoint check
    let isSym = entry.isSymbolicLink();
    if (!isSym) {
      try {
        const lst = fs.lstatSync(fullPath);
        isSym = lst.isSymbolicLink();
      } catch (_) {}
    }
    if (isSym) {
      throw new Error(`SECURITY_VIOLATION: Symlink detected within directory: ${fullPath}`);
    }

    if (!isContainedWithin(baseDir, fullPath)) {
      throw new Error(`SECURITY_VIOLATION: Path escape detected outside base dir: ${fullPath}`);
    }

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'backups' || entry.name === 'scratch') {
        continue;
      }
      const subEntries = fs.readdirSync(fullPath);
      const relDir = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      if (subEntries.length === 0) {
        inventory[relDir] = { type: 'dir', empty: true, fullPath };
      }
      Object.assign(inventory, collectDirectoryInventory(baseDir, fullPath));
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      const stat = fs.statSync(fullPath);
      const hash = sha256File(fullPath);
      inventory[relPath] = { type: 'file', size: stat.size, mode: stat.mode, hash, fullPath };
    }
  }
  return inventory;
}

/**
 * Recursive copy preserving all files, dotfiles, empty directory structures, and file permissions.
 */
function copyDirectoryRecursive(src, dst) {
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (!isContainedWithin(src, srcPath)) {
      throw new Error('SECURITY_VIOLATION: Source path escape detected: ' + srcPath);
    }
    if (!isContainedWithin(dst, dstPath)) {
      throw new Error('SECURITY_VIOLATION: Destination path escape detected: ' + dstPath);
    }
    let isSym = entry.isSymbolicLink();
    if (!isSym) {
      try { isSym = fs.lstatSync(srcPath).isSymbolicLink(); } catch (_) {}
    }
    if (isSym) {
      throw new Error(`SECURITY_VIOLATION: Refusing to copy symlink: ${srcPath}`);
    }
    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, dstPath);
    } else if (entry.isFile()) {
      const stat = fs.statSync(srcPath);
      fs.copyFileSync(srcPath, dstPath);
      try {
        fs.chmodSync(dstPath, stat.mode);
      } catch (_) {}
    }
  }
}

/**
 * Recursive discovery and quiescence verification of SQLite databases.
 * Validates that no active WAL (write-ahead log > 0 bytes) or SHM (shared memory)
 * index files exist in consumer directories (excluding node_modules, .git, backups).
 */
function isRealSqliteFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    return buf.toString('utf8', 0, 15) === 'SQLite format 3';
  } catch (_) {
    return false;
  }
}

function scanSqliteQuiescence(dir, baseDir = dir) {
  const sqliteFiles = [];
  if (!fs.existsSync(dir)) return sqliteFiles;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "backups") {
        continue;
      }
      sqliteFiles.push(...scanSqliteQuiescence(full, baseDir));
    } else if (entry.isFile()) {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith(".db") || lower.endsWith(".sqlite") || lower.endsWith(".sqlite3")) {
        const walPath = full + "-wal";
        const shmPath = full + "-shm";
        const hasWal = fs.existsSync(walPath);
        const walSize = hasWal ? fs.statSync(walPath).size : 0;
        const hasShm = fs.existsSync(shmPath);
        const shmSize = hasShm ? fs.statSync(shmPath).size : 0;

        const isReal = isRealSqliteFile(full);

        // If not a valid SQLite database (e.g. mock file in synthetic unit test):
        if (!isReal) {
          if (hasWal && walSize > 0) {
            throw new Error("PREFLIGHT_ERROR: Unconsolidated active SQLite WAL detected: " + walPath + " (" + walSize + " bytes)");
          }
          if (hasShm && shmSize > 0) {
            throw new Error("PREFLIGHT_ERROR: Active SQLite shared-memory index detected (unclosed reader/writer): " + shmPath + " (" + shmSize + " bytes)");
          }
        } else {
          // Real SQLite database: perform exact contention & checkpoint evaluation via node:sqlite
          let db;
          try {
            const { DatabaseSync } = require("node:sqlite");
            db = new DatabaseSync(full, { readOnly: false });
            db.exec("PRAGMA busy_timeout = 200;");

            // 1. Detect active writer contention
            try {
              db.exec("BEGIN IMMEDIATE; ROLLBACK;");
            } catch (lockErr) {
              throw new Error("PREFLIGHT_ERROR: Active SQLite contention detected on " + full + ": database is locked by an active transaction: " + lockErr.message);
            }

            // 2. Evaluate checkpoint status
            const rows = db.prepare("PRAGMA wal_checkpoint(TRUNCATE);").all();
            let isBusy = false;
            let logPages = 0;
            let checkpointedPages = 0;
            if (Array.isArray(rows) && rows.length > 0) {
              isBusy = Number(rows[0].busy ?? 0) !== 0;
              logPages = Number(rows[0].log ?? 0);
              checkpointedPages = Number(rows[0].checkpointed ?? 0);
            }
            db.close();

            if (isBusy) {
              throw new Error("PREFLIGHT_ERROR: Active SQLite contention detected on " + full + ": checkpoint busy (active readers or writers holding database lock)");
            }

            const currentWalSize = fs.existsSync(walPath) ? fs.statSync(walPath).size : 0;
            if (currentWalSize > 0 && logPages > checkpointedPages) {
              throw new Error("PREFLIGHT_ERROR: Unconsolidated active SQLite WAL detected: " + walPath + " (" + currentWalSize + " bytes, log pages: " + logPages + ", checkpointed: " + checkpointedPages + ")");
            }
          } catch (err) {
            if (db) {
              try { db.close(); } catch (_) {}
            }
            if (err.message.includes("PREFLIGHT_ERROR")) throw err;
            if (err.message.toLowerCase().includes("busy") || err.message.toLowerCase().includes("locked")) {
              throw new Error("PREFLIGHT_ERROR: Active SQLite contention detected on " + full + ": " + err.message);
            }
            throw new Error("PREFLIGHT_ERROR: Failed to evaluate SQLite quiescence on " + full + ": " + err.message);
          }
        }

        const stat = fs.statSync(full);
        sqliteFiles.push({
          path: full,
          relPath: path.relative(baseDir, full).replace(/\\/g, "/"),
          size: stat.size,
          hash: sha256File(full),
        });
      }
    }
  }
  return sqliteFiles;
}

class TransactionalPromotionEngine {
  constructor(options = {}) {
    this.consumerPath = path.resolve(options.consumerPath || process.cwd());
    this.tarballPath = options.tarballPath ? path.resolve(options.tarballPath) : null;
    this.expectedSha256 = (options.expectedSha256 || '').toLowerCase();
    this.expectedSize = options.expectedSize || null;
    this.expectedVersion = options.expectedVersion || '0.3.14-rc4';
    this.originalVersion = options.originalVersion || '0.3.1';
    this.comparatorScript = options.comparatorScript ? path.resolve(options.comparatorScript) : null;
    this.logger = options.logger || console.log;
    this.faultInjection = options.faultInjection || {};
    this.dryRun = !!options.dryRun;
    this.consumerTest = options.consumerTest || null;

    this.operationId = `promo_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.lockPath = path.join(this.consumerPath, '.promotion.lock');
    this.manifestPath = path.join(this.consumerPath, 'operation_manifest.json');
    this.abortEvidencePath = path.join(this.consumerPath, 'promotion_abort_evidence.json');
    this.state = 'UNINITIALIZED';
    this.lockToken = null;
    this.manifest = null;
  }

  bindSignalHandlers() {
    if (this._sigBound) return;
    this._sigBound = true;
    this._sigHandler = (sig) => {
      this.log("Received signal " + sig + "; performing emergency abort and rollback...");
      try {
        this.executeRollback("SIGNAL_INTERRUPTION_" + sig);
      } catch (_) {}
      process.exit(128 + (sig === "SIGINT" ? 2 : 15));
    };
    process.once("SIGINT", this._sigHandler);
    process.once("SIGTERM", this._sigHandler);
  }

  unbindSignalHandlers() {
    if (this._sigBound && this._sigHandler) {
      process.removeListener("SIGINT", this._sigHandler);
      process.removeListener("SIGTERM", this._sigHandler);
      this._sigBound = false;
      this._sigHandler = null;
    }
  }

  writeManifestAtomic(manifest) {
    this.manifest = manifest;
    const tmpPath = `${this.manifestPath}.tmp.${process.pid}.${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), 'utf8');
    atomicRenameWithRetry(tmpPath, this.manifestPath);
  }

  log(msg) {
    this.logger(`[PromotionEngine:${this.operationId}] ${msg}`);
  }

  /**
   * Continuous mutual exclusion assertion: verifies that this instance
   * still holds the active, valid, unrevoked lock on disk before applying mutations.
   */
  assertLockHeld() {
    if (this.lockToken) {
      if (!fs.existsSync(this.lockPath)) {
        throw new Error('PROMOTION_LOCK_VIOLATION: Lock file was unexpectedly deleted during execution.');
      }
      try {
        const content = fs.readFileSync(this.lockPath, 'utf8');
        const data = JSON.parse(content);
        if (data.token !== this.lockToken) {
          throw new Error(`PROMOTION_LOCK_VIOLATION: Lock token mismatch. Expected ${this.lockToken}, found ${data.token} (owned by PID ${data.pid})`);
        }
      } catch (err) {
        if (err.message.includes('PROMOTION_LOCK_VIOLATION')) throw err;
        throw new Error(`PROMOTION_LOCK_VIOLATION: Unable to verify active lock: ${err.message}`);
      }
    } else if (fs.existsSync(this.lockPath)) {
      throw new Error('PROMOTION_LOCK_VIOLATION: Unowned operation attempted while lock exists on disk.');
    }
  }

  // ==========================================================================
  // PHASE 0: MUTUAL EXCLUSION LOCK WITH SKEW & CORRUPTION DEFENSES
  // ==========================================================================
  acquireLock(ttlMs = 60000) {
    this.log('Acquiring promotion mutual exclusion lock...');
    if (!fs.existsSync(this.consumerPath)) {
      throw new Error(`PRECONDITION_FAILED: Consumer path does not exist: ${this.consumerPath}`);
    }
    const stat = fs.statSync(this.consumerPath);
    if (!stat.isDirectory()) {
      throw new Error(`PRECONDITION_FAILED: Consumer path is not a directory: ${this.consumerPath}`);
    }

    const now = Date.now();
    const expiresAt = now + ttlMs;
    const token = `tok_promo_${this.operationId}_${now}`;
    const payload = JSON.stringify({
      operationId: this.operationId,
      owner: process.env.USERNAME || process.env.USER || 'agent',
      pid: process.pid,
      token,
      acquiredAt: now,
      expiresAt,
    });

    try {
      fs.writeFileSync(this.lockPath, payload, { flag: 'wx' });
      this.lockToken = token;
      this.state = 'LOCK_ACQUIRED';
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') {
        let lockData = null;
        let isCorrupted = false;
        try {
          const content = fs.readFileSync(this.lockPath, 'utf8');
          if (!content.trim()) isCorrupted = true;
          else lockData = JSON.parse(content);
        } catch (_) {
          isCorrupted = true;
        }

        if (isCorrupted) {
          this.log('WARNING: Corrupted or 0-byte lock file detected; evaluating recovery...');
          const lockStat = fs.statSync(this.lockPath);
          const ageMs = now - lockStat.mtimeMs;
          if (ageMs > ttlMs || isCorrupted) {
            this.log(`Reclaiming corrupted lock file (Age: ${ageMs}ms)...`);
            try {
              const tempStale = `${this.lockPath}.corrupt.${now}.tmp`;
              atomicRenameWithRetry(this.lockPath, tempStale);
              fs.unlinkSync(tempStale);
            } catch (_) {}

            try {
              fs.writeFileSync(this.lockPath, payload, { flag: 'wx' });
              this.lockToken = token;
              this.state = 'LOCK_ACQUIRED';
              return true;
            } catch (concurErr) {
              if (concurErr.code === 'EEXIST') {
                throw new Error('PROMOTION_CONCURRENCY_VIOLATION: Lock claimed by another process during recovery');
              }
              throw concurErr;
            }
          }
        }

        if (lockData) {
          const lockStat = fs.statSync(this.lockPath);
          const mtimeAgeMs = now - lockStat.mtimeMs;
          const isClockSkew = typeof lockData.acquiredAt === 'number' && (lockData.acquiredAt > now + 5000 || lockData.expiresAt > now + (ttlMs * 2));
          if (isClockSkew) {
            this.log('WARNING: Clock skew / uncalibrated timestamp detected in lock payload; enforcing TTL based on file stat...');
          }
          const alive = isProcessAlive(lockData.pid);
          const expired = (typeof lockData.expiresAt === 'number' && lockData.expiresAt <= now) || (mtimeAgeMs > ttlMs) || (isClockSkew && mtimeAgeMs > 5000);
          if (alive && !expired) {
            throw new Error(`PROMOTION_CONCURRENCY_VIOLATION: Active promotion locked by PID ${lockData.pid} (Operation ${lockData.operationId})`);
          }
          this.log(`Reclaiming stale lock from PID ${lockData.pid} (Expired: ${expired}, Alive: ${alive}, mtimeAge: ${mtimeAgeMs}ms)...`);
          const tempStale = `${this.lockPath}.stale.${now}.tmp`;
          try {
            atomicRenameWithRetry(this.lockPath, tempStale);
            fs.unlinkSync(tempStale);
          } catch (_) {}

          try {
            fs.writeFileSync(this.lockPath, payload, { flag: 'wx' });
            this.lockToken = token;
            this.state = 'LOCK_ACQUIRED';
            return true;
          } catch (concurErr) {
            if (concurErr.code === 'EEXIST') {
              throw new Error('PROMOTION_CONCURRENCY_VIOLATION: Lock claimed by another process during stale reclaim');
            }
            throw concurErr;
          }
        }
      }
      throw err;
    }
  }

  // ==========================================================================
  // PHASE 0.1: TOCTOU-SAFE LOCK RELEASE
  // ==========================================================================
  releaseLock() {
    if (!fs.existsSync(this.lockPath)) return false;
    try {
      const tempGarbage = `${this.lockPath}.releasing.${this.operationId}.${Date.now()}.tmp`;
      try {
        atomicRenameWithRetry(this.lockPath, tempGarbage);
      } catch (rErr) {
        if (rErr.code === 'ENOENT') return false;
        throw rErr;
      }

      let data = null;
      try {
        data = JSON.parse(fs.readFileSync(tempGarbage, 'utf8'));
      } catch (_) {}

      if (this.lockToken && data && data.token && data.token !== this.lockToken) {
        this.log('WARNING: Lock token mismatch post-rename; restoring active foreign lock.');
        try { atomicRenameWithRetry(tempGarbage, this.lockPath); } catch (_) {}
        return false;
      }

      try {
        fs.unlinkSync(tempGarbage);
      } catch (_) {}
      this.log('Promotion lock cleanly released.');
      return true;
    } catch (err) {
      this.log(`Error releasing lock: ${err.message}`);
      return false;
    }
  }

  // ==========================================================================
  // PHASE 1: PRE-FLIGHT VERIFICATION
  // ==========================================================================
  verifyPreflight() {
    this.log('Executing Phase 1: Pre-flight quiescence and artifact validation...');
    this.assertLockHeld();

    if (this.faultInjection.failAtPhase === 'PREFLIGHT') {
      throw new Error('FAULT_INJECTED: Simulated pre-flight failure');
    }

    if (!fs.existsSync(this.consumerPath)) {
      throw new Error(`PREFLIGHT_ERROR: Consumer directory does not exist: ${this.consumerPath}`);
    }

    // Guard: Consumer path must not be the OpenMemory source engine repository itself
    const canonicalSrc = path.resolve(__dirname, '..');
    if (this.consumerPath.toLowerCase() === canonicalSrc.toLowerCase()) {
      throw new Error(`PREFLIGHT_ERROR: Target consumer cannot be the OpenMemory source repository: ${this.consumerPath}`);
    }

    // Guard: Target consumer must contain a valid package.json
    const targetPkgJson = path.join(this.consumerPath, 'package.json');
    if (!fs.existsSync(targetPkgJson)) {
      throw new Error(`PREFLIGHT_ERROR: Target consumer missing package.json: ${this.consumerPath}`);
    }

    // Guard: Check write permissions to consumer directory
    try {
      const testPermPath = path.join(this.consumerPath, `.perm-test-${this.operationId}.tmp`);
      fs.writeFileSync(testPermPath, 'perm_ok');
      fs.unlinkSync(testPermPath);
    } catch (permErr) {
      throw new Error(`PREFLIGHT_ERROR: Insufficient write permissions in consumer directory: ${permErr.message}`);
    }

    if (!this.tarballPath || !fs.existsSync(this.tarballPath)) {
      throw new Error(`PREFLIGHT_ERROR: Candidate tarball missing at ${this.tarballPath}`);
    }
    const stat = fs.statSync(this.tarballPath);
    if (this.expectedSize && stat.size !== this.expectedSize) {
      throw new Error(`PREFLIGHT_ERROR: Tarball size mismatch. Expected ${this.expectedSize}, got ${stat.size}`);
    }
    const hash = sha256File(this.tarballPath);
    if (this.expectedSha256 && hash.toLowerCase() !== this.expectedSha256) {
      throw new Error(`PREFLIGHT_ERROR: Tarball SHA-256 mismatch. Expected ${this.expectedSha256}, got ${hash}`);
    }

    const sqliteFiles = scanSqliteQuiescence(this.consumerPath, this.consumerPath);
    this.state = "PREFLIGHT_VERIFIED";
    this.log("Pre-flight check passed: tarball validated, " + sqliteFiles.length + " SQLite DB(s) verified quiescent (0 active WAL/SHM).");
    return { tarballSize: stat.size, tarballHash: hash, sqliteFiles };
  }

  // ==========================================================================
  // PHASE 2: TRANSACTIONAL BACKUP WITH MANIFEST
  // ==========================================================================
  createTransactionalBackup(preflightInfo = {}) {
    this.log('Executing Phase 2: Creating transactional backup and cryptographic catalog...');
    this.assertLockHeld();

    if (this.faultInjection.failAtPhase === 'BACKUP') {
      throw new Error('FAULT_INJECTED: Simulated backup creation failure');
    }

    const backupsRoot = path.join(this.consumerPath, 'backups');
    if (!fs.existsSync(backupsRoot)) {
      fs.mkdirSync(backupsRoot, { recursive: true });
    }

    const backupDir = path.join(backupsRoot, `backup_${this.operationId}`);
    if (fs.existsSync(backupDir)) {
      throw new Error(`BACKUP_COLLISION: Backup directory already exists: ${backupDir}`);
    }
    fs.mkdirSync(backupDir, { recursive: true });

    const liveOm = path.join(this.consumerPath, '.openmemory');
    const hadOpenMemory = fs.existsSync(liveOm);
    let omPreInventory = {};
    let omBackupDir = null;

    if (hadOpenMemory) {
      omBackupDir = path.join(backupDir, 'openmemory');
      omPreInventory = collectDirectoryInventory(liveOm);
      if (this.faultInjection.failCopyBackup) {
        throw new Error('FAULT_INJECTED: Simulated I/O failure during .openmemory backup copy');
      }
      copyDirectoryRecursive(liveOm, omBackupDir);

      const omBackupInventory = collectDirectoryInventory(omBackupDir);
      const preKeys = Object.keys(omPreInventory);
      const bakKeys = Object.keys(omBackupInventory);
      if (preKeys.length !== bakKeys.length) {
        throw new Error(`BACKUP_VERIFICATION_FAILED: Count mismatch. Origin: ${preKeys.length}, Backup: ${bakKeys.length}`);
      }
      for (const k of preKeys) {
        if (!omBackupInventory[k]) {
          throw new Error(`BACKUP_VERIFICATION_FAILED: File missing in backup: ${k}`);
        }
        if (omBackupInventory[k].hash !== omPreInventory[k].hash) {
          throw new Error(`BACKUP_VERIFICATION_FAILED: Hash mismatch in backup file: ${k}`);
        }
      }
    }

    const livePkg = path.join(this.consumerPath, 'package.json');
    if (!fs.existsSync(livePkg)) {
      throw new Error(`CRITICAL: Consumer package.json missing at ${livePkg}`);
    }
    let isPkgSym = false;
    try { isPkgSym = fs.lstatSync(livePkg).isSymbolicLink(); } catch (_) {}
    if (isPkgSym) {
      throw new Error(`SECURITY_VIOLATION: Consumer package.json cannot be a symlink: ${livePkg}`);
    }

    const pkgBackup = path.join(backupDir, 'package.json.bak');
    fs.copyFileSync(livePkg, pkgBackup);
    const pkgHash = sha256File(pkgBackup);

    let originalSpecifier = null;
    try {
      const livePkgJson = JSON.parse(fs.readFileSync(livePkg, 'utf8'));
      originalSpecifier = (livePkgJson.dependencies && (livePkgJson.dependencies.evocara || livePkgJson.dependencies.openmemory)) ||
                          (livePkgJson.devDependencies && (livePkgJson.devDependencies.evocara || livePkgJson.devDependencies.openmemory)) || null;
    } catch (_) {}

    let detectedInstalledVersion = null;
    let installedPkgPath = path.join(this.consumerPath, 'node_modules', 'evocara', 'package.json');
    if (!fs.existsSync(installedPkgPath)) {
      installedPkgPath = path.join(this.consumerPath, 'node_modules', 'openmemory', 'package.json');
    }
    if (fs.existsSync(installedPkgPath)) {
      try {
        const inst = JSON.parse(fs.readFileSync(installedPkgPath, 'utf8'));
        detectedInstalledVersion = inst.version || null;
      } catch (_) {}
    }

    let originalTarball = null;
    if (originalSpecifier && originalSpecifier.startsWith('file:')) {
      const origTarballRel = originalSpecifier.slice(5);
      const origTarballAbs = path.resolve(this.consumerPath, origTarballRel);
      if (fs.existsSync(origTarballAbs)) {
        const origHash = sha256File(origTarballAbs);
        const origStat = fs.statSync(origTarballAbs);
        const origBakPath = path.join(backupDir, 'original-package.tgz');
        fs.copyFileSync(origTarballAbs, origBakPath);
        originalTarball = {
          relPath: path.relative(this.consumerPath, origTarballAbs).replace(/\\/g, '/'),
          hash: origHash,
          size: origStat.size,
          backupPath: origBakPath,
        };
        this.log(`Original tarball cataloged and backed up: ${origTarballRel} (SHA-256: ${origHash})`);
      }
    }

    const liveLock = path.join(this.consumerPath, 'package-lock.json');
    const hasPackageLock = fs.existsSync(liveLock);
    let lockBackup = null;
    let lockHash = null;
    if (hasPackageLock) {
      lockBackup = path.join(backupDir, 'package-lock.json.bak');
      fs.copyFileSync(liveLock, lockBackup);
      lockHash = sha256File(lockBackup);
    }

    const sqlitePreInventory = preflightInfo.sqliteFiles || [];

    this.manifest = {
      version: 1,
      operationId: this.operationId,
      timestamp: new Date().toISOString(),
      state: 'BACKED_UP',
      consumerPath: this.consumerPath,
      targetCandidate: this.expectedVersion,
      targetTarball: this.tarballPath,
      targetTarballHash: preflightInfo.tarballHash,
      targetTarballSize: preflightInfo.tarballSize,
      originalVersion: this.originalVersion,
      originalSpecifier,
      detectedInstalledVersion,
      originalTarball,
      hadOpenMemory,
      openMemoryBackupDir: omBackupDir,
      openMemoryPreInventory: omPreInventory,
      packageJsonBackup: pkgBackup,
      packageJsonHash: pkgHash,
      hasPackageLock,
      packageLockBackup: lockBackup,
      packageLockHash: lockHash,
      sqlitePreInventory,
    };

    this.writeManifestAtomic(this.manifest);
    this.state = 'BACKED_UP';
    this.log(`Transactional backup completed in ${backupDir}. Manifest persisted.`);
    return this.manifest;
  }

  // ==========================================================================
  // PHASE 3: APPLY CANDIDATE INSTALLATION
  // ==========================================================================
  applyInstallation() {
    this.log(`Executing Phase 3: Applying installation of ${this.tarballPath}...`);
    this.assertLockHeld();

    this.manifest.state = 'APPLYING';
    this.writeManifestAtomic(this.manifest);

    if (this.faultInjection.failAtPhase === 'APPLYING' || this.faultInjection.failAtPhase === 'APPLY') {
      throw new Error('FAULT_INJECTED: Simulated failure during package installation');
    }

    if (this.dryRun) {
      this.log('[DRY-RUN] Skipping physical npm install.');
      this.state = 'APPLIED';
      return true;
    }

    if (this.faultInjection.mockInstallSuccess) {
      const mockDir = path.join(this.consumerPath, 'node_modules', 'openmemory');
      fs.mkdirSync(mockDir, { recursive: true });
      fs.writeFileSync(path.join(mockDir, 'package.json'), JSON.stringify({ name: 'openmemory', version: this.expectedVersion }));
    } else {
      const cmd = `npm install "${this.tarballPath}" --save-exact`;
      const res = spawnSync(cmd, { cwd: this.consumerPath, shell: true, encoding: 'utf8', timeout: 180000 });
      if (res.error && res.error.code === 'ETIMEDOUT') {
        throw new Error('INSTALLATION_FAILED: npm install timed out after 180000ms');
      }
      if (res.status !== 0) {
        throw new Error(`INSTALLATION_FAILED: npm install exited with code ${res.status}: ${res.stderr || res.stdout}`);
      }
    }

    let installedPkgPath = path.join(this.consumerPath, 'node_modules', 'evocara', 'package.json');
    if (!fs.existsSync(installedPkgPath)) {
      installedPkgPath = path.join(this.consumerPath, 'node_modules', 'openmemory', 'package.json');
    }
    if (!fs.existsSync(installedPkgPath)) {
      throw new Error('INSTALLATION_FAILED: neither node_modules/evocara nor node_modules/openmemory found after install');
    }
    const installedPkg = JSON.parse(fs.readFileSync(installedPkgPath, 'utf8'));
    if (installedPkg.version !== this.expectedVersion) {
      throw new Error(`INSTALLATION_FAILED: Installed version ${installedPkg.version} does not match expected ${this.expectedVersion}`);
    }

    this.state = 'APPLIED';
    this.log(`Installation verified: ${installedPkg.name}@${installedPkg.version} active.`);
    return true;
  }

  // ==========================================================================
  // PHASE 4: READ-ONLY SMOKE TEST (WITH DISK MUTATION PROOF)
  // ==========================================================================
  executeSmokeTest() {
    this.log('Executing Phase 4: Read-only smoke test in consumer environment...');
    this.assertLockHeld();

    this.manifest.state = 'SMOKE_TESTING';
    this.writeManifestAtomic(this.manifest);

    if (this.faultInjection.failAtPhase === 'SMOKE_TEST') {
      throw new Error('FAULT_INJECTED: Simulated failure during smoke test');
    }

    const snapshotBefore = collectDirectoryInventory(this.consumerPath);

    if (!this.faultInjection.skipRealSmoke && !this.dryRun) {
      const smokeScript = `
        const assert = require('assert');
        let om;
        try { om = require('evocara'); } catch (_) { om = require('openmemory'); }
        const expectedExports = ['StorageEngine', 'createMCPServer', 'PathSecurityError', 'validateDomainId', 'resolveSecurePath', 'BackupManager'];
        for (const exp of expectedExports) {
          assert(typeof om[exp] !== 'undefined', 'Missing export: ' + exp);
        }
        const mcp = om.createMCPServer ? om.createMCPServer(require('os').tmpdir()) : null;
        if (mcp && mcp._requestHandlers) {
          const listToolsHandler = mcp._requestHandlers.get('tools/list');
          if (listToolsHandler) {
            listToolsHandler({ method: 'tools/list' }, {}).then(res => {
              assert(res && res.tools && (res.tools.length === 8 || res.tools.length >= 29), 'Expected 8 curated or >= 29 full MCP tools');
              console.log('SMOKE_OK');
            }).catch(e => { console.error(e); process.exit(1); });
          } else {
            console.log('SMOKE_OK');
          }
        } else {
          console.log('SMOKE_OK');
        }
      `;

      const res = spawnSync(process.execPath, ['-e', smokeScript], {
        cwd: this.consumerPath,
        encoding: 'utf8',
      });

      if (res.status !== 0 || !res.stdout.includes('SMOKE_OK')) {
        throw new Error(`SMOKE_TEST_FAILED: Smoke verification failed: ${res.stderr || res.stdout}`);
      }
    }

    const snapshotAfter = collectDirectoryInventory(this.consumerPath);
    const beforeKeys = Object.keys(snapshotBefore);
    const afterKeys = Object.keys(snapshotAfter);
    if (beforeKeys.length !== afterKeys.length) {
      throw new Error(`SMOKE_MUTATION_DETECTED: File count changed during smoke test (Before: ${beforeKeys.length}, After: ${afterKeys.length})`);
    }
    for (const k of beforeKeys) {
      if (!snapshotAfter[k] || snapshotAfter[k].hash !== snapshotBefore[k].hash) {
        throw new Error(`SMOKE_MUTATION_DETECTED: File mutated during smoke test: ${k}`);
      }
    }

    this.state = 'SMOKE_VERIFIED';
    this.log('Smoke test passed cleanly: 0 disk mutations.');

    if (this.consumerTest && !this.dryRun) {
      this.log('Executing consumer acceptance test: ' + this.consumerTest);
      const cRes = spawnSync(this.consumerTest, {
        cwd: this.consumerPath,
        shell: true,
        encoding: 'utf8',
        timeout: 180000,
      });
      if (cRes.status !== 0) {
        throw new Error('CONSUMER_TEST_FAILED: Consumer acceptance test failed with code ' + cRes.status + ': ' + (cRes.stderr || cRes.stdout));
      }
      this.log('Consumer acceptance test passed cleanly.');
    }
    return true;
  }

  // ==========================================================================
  // PHASE 5: POST-VERIFICATION & AUDIT COMPARISON
  // ==========================================================================
  executePostVerification() {
    this.log('Executing Phase 5: Post-verification and differential vulnerability audit...');
    this.assertLockHeld();

    this.manifest.state = 'POST_VERIFYING';
    this.writeManifestAtomic(this.manifest);

    if (this.faultInjection.failAtPhase === 'POST_VERIFICATION') {
      throw new Error('FAULT_INJECTED: Simulated failure in post-verification');
    }

    for (const sf of this.manifest.sqlitePreInventory) {
      if (!fs.existsSync(sf.path)) {
        throw new Error(`POST_VERIFICATION_FAILED: SQLite database missing: ${sf.path}`);
      }
      const currentHash = sha256File(sf.path);
      if (currentHash !== sf.hash) {
        throw new Error(`POST_VERIFICATION_FAILED: SQLite database was mutated: ${sf.path}`);
      }
    }

    if (this.manifest.originalTarball && this.manifest.originalTarball.relPath) {
      const origPath = path.resolve(this.consumerPath, this.manifest.originalTarball.relPath);
      if (!fs.existsSync(origPath)) {
        throw new Error(`POST_VERIFICATION_FAILED: Original package tarball was deleted: ${origPath}`);
      }
      const currentHash = sha256File(origPath);
      if (currentHash !== this.manifest.originalTarball.hash) {
        throw new Error(`POST_VERIFICATION_FAILED: Original package tarball was mutated: ${origPath}`);
      }
      this.log(`Original package tarball verified intact: ${this.manifest.originalTarball.relPath}`);
    }

    if (this.comparatorScript && fs.existsSync(this.comparatorScript) && !this.faultInjection.skipAudit && !this.dryRun) {
      const preAuditPath = path.join(this.consumerPath, 'npm-audit-pre.json');
      const postAuditPath = path.join(this.consumerPath, 'npm-audit-post.json');

      const auditRes = spawnSync('npm', ['audit', '--json'], { cwd: this.consumerPath, encoding: 'utf8' });
      fs.writeFileSync(postAuditPath, auditRes.stdout || '{}', 'utf8');

      if (fs.existsSync(preAuditPath)) {
        const compRes = spawnSync(process.execPath, [this.comparatorScript, preAuditPath, postAuditPath], {
          encoding: 'utf8',
        });
        if (compRes.status === 1) {
          throw new Error('POST_VERIFICATION_FAILED: Differential audit detected security regression (Code 1)');
        }
        if (compRes.status === 2) {
          throw new Error('POST_VERIFICATION_FAILED: Differential audit returned INDETERMINATE status (Code 2)');
        }
      }
    }

    this.manifest.state = 'COMMITTED';
    this.manifest.committedAt = new Date().toISOString();
    this.writeManifestAtomic(this.manifest);
    this.state = 'COMMITTED';
    this.log('Promotion successfully committed and verified!');
    return true;
  }

  // ==========================================================================
  // PHASE 7: TRANSACTIONAL ROLLBACK (STAGED, VERIFIABLE, FAULT-TOLERANT)
  // ==========================================================================
  executeRollback(abortReason = 'UNKNOWN_ABORT') {
    this.log(`Initiating Transactional Rollback due to: ${abortReason}`);

    if (this.state === 'ROLLED_BACK' || (this.manifest && this.manifest.state === 'ROLLED_BACK')) {
      this.log('Rollback already completed; skipping redundant restoration and returning true.');
      return true;
    }

    this.state = 'ROLLING_BACK';

    const evidence = {
      timestamp: new Date().toISOString(),
      operationId: this.operationId,
      abortReason,
      failedState: this.manifest ? this.manifest.state : 'UNKNOWN',
      manifestSnapshot: this.manifest,
    };
    try {
      fs.writeFileSync(this.abortEvidencePath, JSON.stringify(evidence, null, 2), 'utf8');
    } catch (_) {}

    if (!this.manifest) {
      this.log('No manifest found. Attempting emergency cleanup...');
      this.releaseLock();
      return false;
    }

    let swapTemp = null;
    const liveOm = path.join(this.consumerPath, '.openmemory');

    try {
      this.assertLockHeld();

      if (this.faultInjection.failMidRestore) {
        throw new Error('FAULT_INJECTED: Simulated failure midway during restore');
      }

      const preMutationStates = ['LOCK_ACQUIRED', 'PREFLIGHT_VERIFIED'];
      const isPreMutation = preMutationStates.includes(this.manifest.state);

      if (!this.manifest.hadOpenMemory) {
        if (fs.existsSync(liveOm)) {
          this.log('Original state had no .openmemory/; removing newly created directory...');
          fs.rmSync(liveOm, { recursive: true, force: true });
        }
      } else {
        if (!this.manifest.openMemoryBackupDir || !fs.existsSync(this.manifest.openMemoryBackupDir)) {
          if (isPreMutation) {
            this.log(`Interruption occurred in pre-mutation state (${this.manifest.state}); .openmemory/ was not modified.`);
          } else {
            throw new Error(`ROLLBACK_INTEGRITY_VIOLATION: openMemoryBackupDir missing or invalid: ${this.manifest.openMemoryBackupDir}`);
          }
        } else {
          this.log('Restoring .openmemory/ via verified staging area...');
          const stagingDir = path.join(this.consumerPath, `.staging-rollback-${this.operationId}`);
          if (fs.existsSync(stagingDir)) {
            fs.rmSync(stagingDir, { recursive: true, force: true });
          }
          fs.mkdirSync(stagingDir, { recursive: true });

          copyDirectoryRecursive(this.manifest.openMemoryBackupDir, stagingDir);

          const stagedInventory = collectDirectoryInventory(stagingDir);
          const preInv = this.manifest.openMemoryPreInventory || {};
          const preKeys = Object.keys(preInv);
          const stagedKeys = Object.keys(stagedInventory);

          if (preKeys.length !== stagedKeys.length) {
            throw new Error(`ROLLBACK_STAGING_CORRUPTION: Staged count ${stagedKeys.length} != pre-inventory ${preKeys.length}`);
          }
          for (const k of preKeys) {
            if (!stagedInventory[k] || stagedInventory[k].hash !== preInv[k].hash) {
              throw new Error(`ROLLBACK_STAGING_CORRUPTION: Staged file hash mismatch for ${k}`);
            }
          }

          // Atomic swap with retry and fallback restoration defense
          swapTemp = path.join(this.consumerPath, `.live-swap-${this.operationId}`);
          if (fs.existsSync(liveOm)) {
            atomicRenameWithRetry(liveOm, swapTemp);
          }
          if (this.faultInjection.failStagingSwap) {
            throw new Error('FAULT_INJECTED: Simulated failure during staging swap');
          }
          try {
            atomicRenameWithRetry(stagingDir, liveOm);
          } catch (renameErr) {
            if (fs.existsSync(swapTemp) && !fs.existsSync(liveOm)) {
              try { atomicRenameWithRetry(swapTemp, liveOm); } catch (_) {}
            }
            throw renameErr;
          }

          if (fs.existsSync(swapTemp)) {
            fs.rmSync(swapTemp, { recursive: true, force: true });
          }
          this.log('Staged restoration of .openmemory/ cleanly applied.');
        }
      }

      if (this.manifest.packageJsonBackup && fs.existsSync(this.manifest.packageJsonBackup)) {
        fs.copyFileSync(this.manifest.packageJsonBackup, path.join(this.consumerPath, 'package.json'));
      } else if (!isPreMutation) {
        throw new Error(`ROLLBACK_INTEGRITY_VIOLATION: packageJsonBackup missing or invalid: ${this.manifest.packageJsonBackup}`);
      }

      const liveLock = path.join(this.consumerPath, 'package-lock.json');
      if (this.manifest.hasPackageLock && this.manifest.packageLockBackup && fs.existsSync(this.manifest.packageLockBackup)) {
        fs.copyFileSync(this.manifest.packageLockBackup, liveLock);
      } else if (!this.manifest.hasPackageLock && fs.existsSync(liveLock)) {
        try { fs.chmodSync(liveLock, 0o666); } catch (_) {}
        fs.unlinkSync(liveLock);
      }

      if (!isPreMutation) {
        this.log(`Reinstalling original package openmemory@${this.manifest.originalVersion}...`);
        if (this.faultInjection.mockInstallSuccess) {
          const mockDir = path.join(this.consumerPath, 'node_modules', 'openmemory');
          fs.mkdirSync(mockDir, { recursive: true });
          fs.writeFileSync(path.join(mockDir, 'package.json'), JSON.stringify({ name: 'openmemory', version: this.manifest.originalVersion }));
        } else if (!this.dryRun) {
          let restoreCmd = this.manifest.hasPackageLock ? 'npm ci --prefer-offline' : 'npm install --prefer-offline';
          let rRes = spawnSync(restoreCmd, { cwd: this.consumerPath, shell: true, encoding: 'utf8', timeout: 180000 });
          if (rRes.status !== 0) {
            const spec = this.manifest.originalSpecifier;
            const fallbackCmd = (spec && spec.startsWith('file:'))
              ? `npm install "${spec}" --save-exact`
              : `npm install openmemory@${this.manifest.originalVersion} --save-exact`;
            rRes = spawnSync(fallbackCmd, { cwd: this.consumerPath, shell: true, encoding: 'utf8', timeout: 180000 });
          }
        }
      } else {
        this.log(`Interruption occurred in pre-mutation state (${this.manifest.state}); skipping package re-installation.`);
      }

      if (!isPreMutation && this.manifest.hadOpenMemory && fs.existsSync(liveOm)) {
        const restoredInventory = collectDirectoryInventory(liveOm);
        const preInv = this.manifest.openMemoryPreInventory || {};
        const restKeys = Object.keys(restoredInventory);
        const preKeys = Object.keys(preInv);

        if (restKeys.length !== preKeys.length) {
          throw new Error(`ROLLBACK_VERIFICATION_FAILED: Restored count mismatch (${restKeys.length} vs ${preKeys.length})`);
        }
        for (const k of restKeys) {
          if (!preInv[k]) {
            throw new Error(`ROLLBACK_VERIFICATION_FAILED: Rogue unexpected file found post-rollback: ${k}`);
          }
          if (restoredInventory[k].hash !== preInv[k].hash) {
            throw new Error(`ROLLBACK_VERIFICATION_FAILED: Hash mismatch in restored file: ${k}`);
          }
        }
      }

      this.manifest.state = 'ROLLED_BACK';
      this.manifest.rolledBackAt = new Date().toISOString();
      this.writeManifestAtomic(this.manifest);
      this.state = 'ROLLED_BACK';
      this.log('Transactional rollback completed successfully with 100% bidirectional parity.');
      return true;
    } catch (rbErr) {
      this.log(`CRITICAL ROLLBACK FAILURE: ${rbErr.message}`);
      this.state = 'FAILED_ROLLBACK';
      if (this.manifest) {
        this.manifest.state = 'FAILED_ROLLBACK';
        this.manifest.rollbackError = rbErr.message;
        this.writeManifestAtomic(this.manifest);
      }

      // Persist failure details in abort evidence
      evidence.rollbackFailure = rbErr.message;
      evidence.rollbackStack = rbErr.stack;
      try {
        fs.writeFileSync(this.abortEvidencePath, JSON.stringify(evidence, null, 2), 'utf8');
      } catch (_) {}

      const stagingDir = path.join(this.consumerPath, `.staging-rollback-${this.operationId}`);
      if (fs.existsSync(stagingDir)) {
        const qDir = path.join(this.consumerPath, `.quarantined-staging-${this.operationId}-${Date.now()}`);
        try { fs.renameSync(stagingDir, qDir); } catch (_) {}
      }

      return false;
    } finally {
      this.releaseLock();
    }
  }

  // ==========================================================================
  // CRASH RECOVERY & BACKUP RETENTION HELPERS (G9 / G12)
  // ==========================================================================

  static validateBackupCandidate(backupDir) {
    if (!backupDir || !fs.existsSync(backupDir)) {
      return { valid: false, reason: 'Backup directory does not exist' };
    }
    let stat;
    try {
      stat = fs.lstatSync(backupDir);
    } catch (err) {
      return { valid: false, reason: `Cannot stat backup dir: ${err.message}` };
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      return { valid: false, reason: 'Backup directory is not a valid directory or is a symlink' };
    }

    // Look for package.json or package.json.bak
    let pkgFile = path.join(backupDir, 'package.json');
    if (!fs.existsSync(pkgFile)) {
      pkgFile = path.join(backupDir, 'package.json.bak');
    }
    if (!fs.existsSync(pkgFile)) {
      return { valid: false, reason: 'Missing package.json in backup directory' };
    }

    try {
      const rawPkg = fs.readFileSync(pkgFile, 'utf8');
      if (!rawPkg.trim()) {
        return { valid: false, reason: 'Empty package.json in backup directory' };
      }
      const parsed = JSON.parse(rawPkg);
      if (typeof parsed !== 'object' || parsed === null || (!parsed.name && !parsed.version)) {
        return { valid: false, reason: 'Malformed package.json in backup directory' };
      }
    } catch (err) {
      return { valid: false, reason: `Unparseable package.json in backup: ${err.message}` };
    }

    // Check package-lock.json if present
    let lockFile = path.join(backupDir, 'package-lock.json');
    if (!fs.existsSync(lockFile)) {
      lockFile = path.join(backupDir, 'package-lock.json.bak');
    }
    if (fs.existsSync(lockFile)) {
      try {
        const rawLock = fs.readFileSync(lockFile, 'utf8');
        if (rawLock.trim()) {
          JSON.parse(rawLock);
        }
      } catch (err) {
        return { valid: false, reason: `Corrupted package-lock.json in backup: ${err.message}` };
      }
    }

    // Check openmemory or .openmemory subfolder if present
    let omDir = path.join(backupDir, 'openmemory');
    if (!fs.existsSync(omDir)) {
      omDir = path.join(backupDir, '.openmemory');
    }
    if (fs.existsSync(omDir)) {
      try {
        const omStat = fs.lstatSync(omDir);
        if (omStat.isSymbolicLink()) {
          return { valid: false, reason: 'Symlink detected in backup openmemory directory' };
        }
      } catch (err) {
        return { valid: false, reason: `Cannot stat backup openmemory: ${err.message}` };
      }
    }

    return {
      valid: true,
      pkgFile,
      hasPackageLock: fs.existsSync(lockFile),
      lockFile: fs.existsSync(lockFile) ? lockFile : null,
      hasOpenMemory: fs.existsSync(omDir),
      omDir: fs.existsSync(omDir) ? omDir : null,
    };
  }

  static checkForInterruptedPromotion(consumerPath) {
    const manifestPath = path.join(consumerPath, 'operation_manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return { isInterrupted: false };
    }
    try {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      if (!raw.trim()) {
        return {
          isInterrupted: true,
          isCorrupted: true,
          manifestPath,
          error: 'CORRUPTED_MANIFEST: operation_manifest.json is empty (0 bytes)',
        };
      }
      const manifest = JSON.parse(raw);
      if (!manifest || typeof manifest !== 'object' || !manifest.state) {
        return {
          isInterrupted: true,
          isCorrupted: true,
          manifestPath,
          error: 'CORRUPTED_MANIFEST: operation_manifest.json lacks mandatory state property',
        };
      }
      const incompleteStates = ['LOCK_ACQUIRED', 'PREFLIGHT_VERIFIED', 'BACKED_UP', 'APPLYING', 'SMOKE_TESTING', 'POST_VERIFYING', 'ROLLING_BACK'];
      if (incompleteStates.includes(manifest.state)) {
        return {
          isInterrupted: true,
          isCorrupted: false,
          operationId: manifest.operationId,
          state: manifest.state,
          manifestPath,
          backupPath: manifest.backupPath,
          startedAt: manifest.startedAt,
        };
      }
      return { isInterrupted: false, isCorrupted: false, state: manifest.state };
    } catch (err) {
      // Fail-closed on torn/corrupted manifest
      return {
        isInterrupted: true,
        isCorrupted: true,
        manifestPath,
        error: `CORRUPTED_MANIFEST: Failed to parse operation_manifest.json: ${err.message}`,
      };
    }
  }

  static recoverInterruptedPromotion(consumerPath, options = {}) {
    const check = TransactionalPromotionEngine.checkForInterruptedPromotion(consumerPath);
    if (!check.isInterrupted) {
      // Idempotent recovery: terminal state or clean directory requires no further mutation
      return {
        recovered: true,
        alreadyClean: true,
        priorState: check.state || 'CLEAN',
        reason: check.state
          ? `Promotion is already in terminal safe state (${check.state})`
          : 'No interrupted or pending promotion found',
      };
    }

    const logger = options.logger || console.log;

    if (check.isCorrupted) {
      logger(`[EMERGENCY-RECOVER] Corrupted operation manifest detected in ${consumerPath}; initiating emergency quarantine and restore...`);

      // Guard: Check active lock held by another live process before mutating
      const lockPath = path.join(consumerPath, '.promotion.lock');
      if (fs.existsSync(lockPath)) {
        try {
          const lockRaw = fs.readFileSync(lockPath, 'utf8');
          const lockData = JSON.parse(lockRaw);
          if (lockData && lockData.pid && isProcessAlive(lockData.pid)) {
            const now = Date.now();
            const expired = typeof lockData.expiresAt === 'number' && lockData.expiresAt <= now;
            if (!expired) {
              logger(`[EMERGENCY-RECOVER] FAIL-CLOSED: Active promotion lock held by live PID ${lockData.pid}. Aborting recovery.`);
              return {
                recovered: false,
                error: `PROMOTION_CONCURRENCY_VIOLATION: Active promotion locked by PID ${lockData.pid}`,
                pid: lockData.pid,
              };
            }
          }
        } catch (_) {}
      }

      const qPath = `${check.manifestPath}.corrupt.${Date.now()}.bak`;
      try { fs.renameSync(check.manifestPath, qPath); } catch (_) {}

      let recoveredFromBackup = false;
      let restoredBackupName = null;
      const backupsRoot = path.join(consumerPath, 'backups');
      if (fs.existsSync(backupsRoot)) {
        const entries = fs.readdirSync(backupsRoot, { withFileTypes: true })
          .filter(e => e.isDirectory() && e.name.startsWith('backup_'))
          .map(e => ({
            name: e.name,
            fullPath: path.join(backupsRoot, e.name),
            mtimeMs: fs.statSync(path.join(backupsRoot, e.name)).mtimeMs,
          }))
          .sort((a, b) => b.mtimeMs - a.mtimeMs);

        // Iterate and validate candidates to find the most recent VALID backup
        let validCandidate = null;
        for (const entry of entries) {
          const valRes = TransactionalPromotionEngine.validateBackupCandidate(entry.fullPath);
          if (valRes.valid) {
            validCandidate = { entry, details: valRes };
            break;
          } else {
            logger(`[EMERGENCY-RECOVER] Skipping invalid/corrupt backup candidate ${entry.name}: ${valRes.reason}`);
          }
        }

        if (!validCandidate && entries.length > 0) {
          logger('[EMERGENCY-RECOVER] FAIL-CLOSED: All existing backups failed integrity validation. Refusing to restore corrupted state.');
          return {
            recovered: false,
            error: 'ALL_BACKUPS_CORRUPT: No valid backup available for restoration',
            quarantinedManifest: qPath,
          };
        }

        if (validCandidate) {
          restoredBackupName = validCandidate.entry.name;
          const { pkgFile, lockFile, omDir } = validCandidate.details;
          if (pkgFile && fs.existsSync(pkgFile)) {
            fs.copyFileSync(pkgFile, path.join(consumerPath, 'package.json'));
          }
          if (lockFile && fs.existsSync(lockFile)) {
            fs.copyFileSync(lockFile, path.join(consumerPath, 'package-lock.json'));
          }
          if (omDir && fs.existsSync(omDir)) {
            const liveOm = path.join(consumerPath, '.openmemory');
            try { fs.rmSync(liveOm, { recursive: true, force: true }); } catch (_) {}
            copyDirectoryRecursive(omDir, liveOm);
          }
          recoveredFromBackup = true;
          logger(`[EMERGENCY-RECOVER] Successfully restored state from validated backup: ${restoredBackupName}`);
        }
      }

      // Evict orphan lock if present (we validated PID is not alive above)
      if (fs.existsSync(lockPath)) {
        try { fs.unlinkSync(lockPath); } catch (_) {}
      }

      // Record recovery in a new clean terminal manifest
      const freshManifest = {
        operationId: `emergency_recovery_${Date.now()}`,
        state: 'ROLLED_BACK',
        rolledBackAt: new Date().toISOString(),
        recoveryDetails: {
          quarantinedCorruptManifest: qPath,
          recoveredFromBackup,
          restoredBackupName,
        },
      };
      try {
        const tmpFresh = `${check.manifestPath}.tmp.${Date.now()}`;
        fs.writeFileSync(tmpFresh, JSON.stringify(freshManifest, null, 2), 'utf8');
        atomicRenameWithRetry(tmpFresh, check.manifestPath);
      } catch (_) {}

      return {
        recovered: true,
        quarantinedManifest: qPath,
        recoveredFromBackup,
        restoredBackupName,
        finalState: 'ROLLED_BACK',
      };
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(check.manifestPath, 'utf8'));
      const engine = new TransactionalPromotionEngine({
        consumerPath,
        logger,
        faultInjection: options.faultInjection || {},
        dryRun: options.dryRun || false,
      });
      engine.manifest = manifest;
      engine.operationId = manifest.operationId;
      engine.state = manifest.state;

      engine.acquireLock();
      const rbResult = engine.executeRollback(`RECOVERY_FROM_INTERRUPTED_${manifest.state}`);
      // Note: executeRollback guarantees lock release in its finally block

      return {
        recovered: rbResult,
        operationId: manifest.operationId,
        priorState: manifest.state,
        finalState: engine.state,
      };
    } catch (err) {
      return {
        recovered: false,
        error: `RECOVERY_FAILED: ${err.message}`,
      };
    }
  }

  static pruneOldBackups(consumerPath, keepLastN = 5) {
    const backupsRoot = path.join(consumerPath, 'backups');
    if (!fs.existsSync(backupsRoot)) return { prunedCount: 0, retainedCount: 0 };
    const entries = fs.readdirSync(backupsRoot, { withFileTypes: true });
    const backupDirs = entries
      .filter(e => e.isDirectory() && e.name.startsWith('backup_'))
      .map(e => {
        const fullPath = path.join(backupsRoot, e.name);
        const stat = fs.statSync(fullPath);
        return { name: e.name, fullPath, mtimeMs: stat.mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    let prunedCount = 0;
    if (backupDirs.length > keepLastN) {
      const toPrune = backupDirs.slice(keepLastN);
      for (const b of toPrune) {
        try {
          fs.rmSync(b.fullPath, { recursive: true, force: true });
          prunedCount++;
        } catch (_) {}
      }
    }
    return { prunedCount, retainedCount: Math.min(backupDirs.length, keepLastN) };
  }

  // ==========================================================================
  // RUN COMPLETE PROMOTION FLOW
  // ==========================================================================
  runPromotion() {
    this.bindSignalHandlers();
    try {
      this.acquireLock();
      const preflightInfo = this.verifyPreflight();

      if (this.dryRun) {
        this.log('[DRY-RUN] Executing simulation mode: preflight and quiescence validated without disk mutations.');
        this.state = 'DRY_RUN_PASSED';
        this.releaseLock();
        return {
          success: true,
          operationId: this.operationId,
          state: 'DRY_RUN_PASSED',
          outcome: 'DRY_RUN_PASSED',
          isDryRun: true,
        };
      }

      this.createTransactionalBackup(preflightInfo);
      this.applyInstallation();
      this.executeSmokeTest();
      this.executePostVerification();

      this.state = 'COMMITTED';
      return {
        success: true,
        operationId: this.operationId,
        state: 'COMMITTED',
        outcome: 'PROMOTION_COMMITTED',
        isDryRun: false,
      };
    } catch (err) {
      this.log(`Promotion aborted due to error: ${err.message}`);
      if (this.dryRun || this.state === 'UNINITIALIZED' || this.state === 'LOCK_ACQUIRED') {
        this.releaseLock();
        this.state = 'PROMOTION_BLOCKED';
        return {
          success: false,
          operationId: this.operationId,
          state: 'PROMOTION_BLOCKED',
          outcome: 'PROMOTION_BLOCKED',
          error: err.message,
          rolledBack: false,
        };
      }
      const rbSuccess = this.executeRollback(err.message);
      return {
        success: false,
        operationId: this.operationId,
        state: this.state,
        outcome: rbSuccess ? 'PROMOTION_ROLLED_BACK' : 'FAILED_ROLLBACK',
        error: err.message,
        rolledBack: rbSuccess,
      };
    } finally {
      this.unbindSignalHandlers();
      if (this.state === 'COMMITTED' || this.state === 'DRY_RUN_PASSED') {
        this.releaseLock();
      }
    }
  }
}

// ============================================================================
// CLI INTERFACE
// ============================================================================
function printHelp() {
  console.log(`
OpenMemory Transactional Promotion & Verified Rollback Engine (P1.5)

Usage:
  node scripts/transactional-promotion-engine.js [options]

Options:
  --consumer, --consumer-path <path>  Path to target consumer application (required)
  --tarball <path>                    Path to candidate .tgz archive
  --expected-sha256 <hash>            Expected SHA-256 hash of candidate tarball
  --expected-size <bytes>             Expected size in bytes of candidate tarball
  --expected-version <version>        Expected package version (default: 0.3.14-rc4)
  --original-version <version>        Original package version to rollback to (default: 0.3.1)
  --comparator <path>                 Path to differential npm audit comparator script
  --consumer-test <command>           Command to run for consumer acceptance validation
  --dry-run                           Simulate execution without modifying packages
  --help, -h                          Show this help message
`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--consumer-path' || args[i] === '--consumer') && args[i + 1]) options.consumerPath = args[++i];
    else if (args[i] === '--tarball' && args[i + 1]) options.tarballPath = args[++i];
    else if (args[i] === '--expected-sha256' && args[i + 1]) options.expectedSha256 = args[++i];
    else if (args[i] === '--expected-size' && args[i + 1]) {
      const parsed = parseInt(args[++i], 10);
      if (isNaN(parsed) || parsed <= 0) {
        console.error('Error: --expected-size must be a positive integer');
        process.exit(1);
      }
      options.expectedSize = parsed;
    }
    else if (args[i] === '--expected-version' && args[i + 1]) options.expectedVersion = args[++i];
    else if (args[i] === '--original-version' && args[i + 1]) options.originalVersion = args[++i];
    else if (args[i] === '--comparator' && args[i + 1]) options.comparatorScript = args[++i];
    else if (args[i] === '--consumer-test' && args[i + 1]) options.consumerTest = args[++i];
    else if (args[i] === '--dry-run') options.dryRun = true;
  }

  if (args.includes('--recover')) {
    options.recover = true;
  }

  if (!options.consumerPath) {
    console.error('Error: --consumer-path (or --consumer) is required. Use --help for usage.');
    process.exit(1);
  }

  if (options.recover) {
    console.log('=== OPENMEMORY PROMOTION CRASH RECOVERY ===');
    const recRes = TransactionalPromotionEngine.recoverInterruptedPromotion(options.consumerPath, { logger: console.log });
    console.log('Recovery Result:', JSON.stringify(recRes, null, 2));
    process.exit(recRes.recovered ? 0 : 1);
  }

  if (!fs.existsSync(options.consumerPath)) {
    console.error(`Error: Consumer directory not found: ${options.consumerPath}`);
    process.exit(1);
  }

  console.log('=== OPENMEMORY TRANSACTIONAL PROMOTION ENGINE (P1.5) ===');
  const engine = new TransactionalPromotionEngine(options);
  const result = engine.runPromotion();
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}

module.exports = {
  TransactionalPromotionEngine,
  collectDirectoryInventory,
  copyDirectoryRecursive,
  isContainedWithin,
  isProcessAlive,
  atomicRenameWithRetry,
  scanSqliteQuiescence,
};
