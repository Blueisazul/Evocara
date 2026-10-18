import * as fs from "fs";
import * as path from "path";
import { LockResult } from "../types";
import { EventLogger } from "./event-logger";

export interface PersistenceEnginePaths {
  openmemoryDir: string;
  adrsDir: string;
  backupsDir: string;
  logsDir: string;
  knowledgeDir: string;
  researchesDir: string;
  ossEvaluationsDir: string;
  locksDir: string;
}

export interface LockStateInfo {
  resourceKey: string;
  lockFileName: string;
  isLocked: boolean;
  isStale: boolean;
  owner?: string;
  token?: string;
  pid?: number;
  acquiredAt?: string;
  expiresAt?: string;
  ttlRemainingMs?: number;
}

// Single allocation SharedArrayBuffer for zero-CPU OS-level synchronous sleep (PERSIST-001)
const sharedSleepBuffer = new SharedArrayBuffer(4);
const sharedSleepInt32 = new Int32Array(sharedSleepBuffer);

function sleepSync(ms: number): void {
  if (ms <= 0) return;
  Atomics.wait(sharedSleepInt32, 0, 0, ms);
}

export function isProcessDead(pid: number | undefined): boolean {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return false; // Process exists and is alive
  } catch (err: any) {
    return err && (err.code === "ESRCH" || err.code === "EINVAL");
  }
}

export class PersistenceEngine {
  private paths: PersistenceEnginePaths;
  private currentTransactionToken: string | null = null;
  private eventLogger?: EventLogger;

  constructor(paths: PersistenceEnginePaths, eventLogger?: EventLogger) {
    this.paths = paths;
    this.eventLogger = eventLogger;
  }

  public setEventLogger(eventLogger: EventLogger): void {
    this.eventLogger = eventLogger;
  }

  public ensureStorageStructure(): void {
    const dirs = [
      this.paths.openmemoryDir,
      this.paths.adrsDir,
      this.paths.backupsDir,
      this.paths.logsDir,
      this.paths.knowledgeDir,
      this.paths.researchesDir,
      this.paths.ossEvaluationsDir,
      this.paths.locksDir,
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Atomic File Writer (F3.1 - Prevents corruption on process exit)
   * Single-file atomic replacement mechanism: content -> temp file -> fs.renameSync
   * Hardened for Windows EPERM/EBUSY/EACCES retry without CPU spin-lock (PERSIST-001)
   */
  public atomicWriteFileSync(targetPath: string, content: string): void {
    this.ensureStorageStructure();
    const tempPath = `${targetPath}.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
    try {
      const fd = fs.openSync(tempPath, "w");
      try {
        fs.writeFileSync(fd, content, "utf-8");
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      let attempts = 0;
      while (true) {
        try {
          fs.renameSync(tempPath, targetPath);
          break;
        } catch (err: any) {
          attempts++;
          const retryable = err && (err.code === "EPERM" || err.code === "EBUSY" || err.code === "EACCES");
          if (attempts >= 25 || !retryable) {
            throw err;
          }
          // Non-blocking OS sleep for Windows retry (replaces busy while loop)
          sleepSync(15);
        }
      }

      // Flush directory metadata where supported (POSIX durability guarantee)
      try {
        const dirFd = fs.openSync(path.dirname(targetPath), "r");
        try {
          fs.fsyncSync(dirFd);
        } finally {
          fs.closeSync(dirFd);
        }
      } catch (_) {
        // Ignored on Windows / platforms where directory fsync is unsupported (EISDIR/EPERM)
      }
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (_) {}
      }
      throw new Error(`Atomic write failed for target ${targetPath}: ${(err as Error).message}`);
    }
  }

  /**
   * Detailed advisory lock acquisition with atomic stale lock recovery & token generation (F12.3-E)
   */
  public tryAcquireLockDetailed(resourceKey: string, agentId: string, ttlMs: number = 5000): LockResult {
    this.ensureStorageStructure();
    const sanitizedKey = resourceKey.replace(/[^a-zA-Z0-9_-]/g, "_");
    const lockFileName = `${sanitizedKey}.lock`;
    const lockPath = path.join(this.paths.locksDir, lockFileName);
    const now = Date.now();
    const expiresAt = now + ttlMs;
    const randUuid = Math.random().toString(36).substring(2, 10);
    const token = `tok_${agentId}_${now}_${randUuid}`;
    const payload = JSON.stringify({ owner: agentId, token, pid: process.pid, acquiredAt: now, expiresAt });

    const acquireEventType = resourceKey === "project-state-transaction" ? "lock.transaction_acquired" : "lock.acquired";
    try {
      fs.writeFileSync(lockPath, payload, { flag: "wx" });
      if (this.eventLogger) {
        this.eventLogger.logEvent(acquireEventType, { resourceKey, agentId, token, ttlMs, expiresAt }, agentId);
      }
      return { acquired: true, token, expiresAt };
    } catch (_) {
      // Direct acquisition failed: lock file already exists
    }

    try {
      if (fs.existsSync(lockPath)) {
        let isStale = false;
        let stat: fs.Stats | null = null;
        try {
          stat = fs.statSync(lockPath);
        } catch (_) {
          return { acquired: false, reason: "Lock file in transition" };
        }

        try {
          const content = fs.readFileSync(lockPath, "utf-8");
          const lockData = JSON.parse(content);
          let exp = typeof lockData.expiresAt === "number" ? lockData.expiresAt : undefined;
          if (exp === undefined) {
            const baseTime = typeof lockData.acquiredAt === "number" ? lockData.acquiredAt :
                             typeof lockData.timestamp === "number" ? lockData.timestamp :
                             typeof lockData.acquiredAt === "string" ? new Date(lockData.acquiredAt).getTime() : undefined;
            const ttl = typeof lockData.staleThresholdMs === "number" ? lockData.staleThresholdMs :
                        typeof lockData.ttlMs === "number" ? lockData.ttlMs : ttlMs;
            if (baseTime) {
              exp = baseTime + ttl;
            }
          }
          const deadProcess = isProcessDead(lockData.pid);
          if ((exp !== undefined && exp <= now) || deadProcess) {
            isStale = true;
          } else if (exp === undefined && stat && (now - stat.mtimeMs >= ttlMs) && (lockData.pid === undefined || deadProcess)) {
            isStale = true;
          }
        } catch (_) {
          // If read or parse failed, only consider stale if the physical file is at least ttlMs old.
          // This prevents deleting an active process's lock while it is being written.
          if (stat && (now - stat.mtimeMs >= ttlMs)) {
            isStale = true;
          }
        }

        if (isStale) {
          const tempGarbagePath = path.join(this.paths.locksDir, `${sanitizedKey}.stale.${now}.${randUuid}.tmp`);
          try {
            fs.renameSync(lockPath, tempGarbagePath);
            try { fs.unlinkSync(tempGarbagePath); } catch (__) {}

            try {
              fs.writeFileSync(lockPath, payload, { flag: "wx" });
              const staleAcquireEventType = resourceKey === "project-state-transaction" ? "lock.transaction_acquired_stale_recovered" : "lock.acquired_stale_recovered";
              if (this.eventLogger) {
                this.eventLogger.logEvent(staleAcquireEventType, { resourceKey, agentId, token, ttlMs, expiresAt }, agentId);
              }
              return { acquired: true, token, expiresAt };
            } catch (__) {
              return { acquired: false, reason: "Lock contention during stale re-acquisition" };
            }
          } catch (_) {
            return { acquired: false, reason: "Stale lock cleanup race lost" };
          }
        }
      }
    } catch (_) {}

    return { acquired: false, reason: "Lock actively held" };
  }

  public tryAcquireLock(resourceKey: string, agentId: string, ttlMs: number = 5000): boolean {
    const res = this.tryAcquireLockDetailed(resourceKey, agentId, ttlMs);
    return res.acquired;
  }

  public releaseLockDetailed(resourceKey: string, agentId: string, token?: string): boolean {
    this.ensureStorageStructure();
    const sanitizedKey = resourceKey.replace(/[^a-zA-Z0-9_-]/g, "_");
    const lockFileName = `${sanitizedKey}.lock`;
    const lockPath = path.join(this.paths.locksDir, lockFileName);

    if (!fs.existsSync(lockPath)) {
      return false;
    }

    try {
      const content = fs.readFileSync(lockPath, "utf-8");
      const lockData = JSON.parse(content);

      if (token) {
        if (lockData.token !== token) {
          return false;
        }
      } else {
        if (lockData.owner !== agentId) {
          return false;
        }
        if (lockData.expiresAt <= Date.now()) {
          return false;
        }
      }

      fs.unlinkSync(lockPath);
      const releaseEventType = resourceKey === "project-state-transaction" ? "lock.transaction_released" : "lock.released";
      if (this.eventLogger) {
        this.eventLogger.logEvent(releaseEventType, { resourceKey, agentId, token: lockData.token }, agentId);
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  public releaseLock(resourceKey: string, agentId: string): boolean {
    return this.releaseLockDetailed(resourceKey, agentId);
  }

  /**
   * Synchronous Transactional State Lock (PERSIST-001 Hardened)
   * Eliminates CPU spin-lock using OS thread sleep (Atomics.wait) and adaptive exponential backoff.
   */
  public withStateLock<T>(fn: () => T, agentId: string = "system", options?: { maxWaitMs?: number }): T {
    const lockKey = "project-state-transaction";

    if (this.currentTransactionToken !== null) {
      return fn();
    }

    const maxWaitMs = options?.maxWaitMs ?? 5000;
    const start = Date.now();
    let lockRes: LockResult | null = null;
    let attempt = 0;

    while (Date.now() - start <= maxWaitMs) {
      lockRes = this.tryAcquireLockDetailed(lockKey, agentId, 5000);
      if (lockRes.acquired) break;

      attempt++;
      // Exponential backoff with jitter: 5ms, 8ms, 12ms, 18ms... capped at 50ms + jitter
      const baseWait = Math.min(50, Math.floor(5 * Math.pow(1.3, attempt)));
      const jitter = Math.floor(Math.random() * 10);
      const sleepMs = baseWait + jitter;

      // Yield CPU slice to OS (zero-CPU active wait)
      sleepSync(sleepMs);
    }

    if (!lockRes || !lockRes.acquired || !lockRes.token) {
      throw new Error(`State transaction lock contention: Could not acquire '${lockKey}' lock within ${maxWaitMs}ms.`);
    }

    this.currentTransactionToken = lockRes.token;
    try {
      return fn();
    } finally {
      this.currentTransactionToken = null;
      this.releaseLockDetailed(lockKey, agentId, lockRes.token);
    }
  }

  /**
   * Asynchronous Transactional State Lock (PERSIST-001)
   * For async execution contexts using standard non-blocking timers.
   */
  public async withStateLockAsync<T>(fn: () => Promise<T> | T, agentId: string = "system", options?: { maxWaitMs?: number }): Promise<T> {
    const lockKey = "project-state-transaction";

    if (this.currentTransactionToken !== null) {
      return await fn();
    }

    const maxWaitMs = options?.maxWaitMs ?? 5000;
    const start = Date.now();
    let lockRes: LockResult | null = null;
    let attempt = 0;

    while (Date.now() - start <= maxWaitMs) {
      lockRes = this.tryAcquireLockDetailed(lockKey, agentId, 5000);
      if (lockRes.acquired) break;

      attempt++;
      const baseWait = Math.min(50, Math.floor(5 * Math.pow(1.3, attempt)));
      const jitter = Math.floor(Math.random() * 10);
      const sleepMs = baseWait + jitter;

      await new Promise(resolve => setTimeout(resolve, sleepMs));
    }

    if (!lockRes || !lockRes.acquired || !lockRes.token) {
      throw new Error(`State transaction lock contention: Could not acquire '${lockKey}' lock within ${maxWaitMs}ms.`);
    }

    this.currentTransactionToken = lockRes.token;
    try {
      return await fn();
    } finally {
      this.currentTransactionToken = null;
      this.releaseLockDetailed(lockKey, agentId, lockRes.token);
    }
  }

  /**
   * Diagnostic inspection of active locks in locksDir
   */
  public inspectLocks(): LockStateInfo[] {
    this.ensureStorageStructure();
    if (!fs.existsSync(this.paths.locksDir)) return [];
    const now = Date.now();
    const results: LockStateInfo[] = [];

    const files = fs.readdirSync(this.paths.locksDir);
    for (const file of files) {
      if (!file.endsWith(".lock")) continue;
      const lockPath = path.join(this.paths.locksDir, file);
      const resourceKey = file.slice(0, -5);
      try {
        const content = fs.readFileSync(lockPath, "utf-8");
        const lockData = JSON.parse(content);
        let exp = typeof lockData.expiresAt === "number" ? lockData.expiresAt : undefined;
        if (exp === undefined) {
          const baseTime = typeof lockData.acquiredAt === "number" ? lockData.acquiredAt :
                           typeof lockData.timestamp === "number" ? lockData.timestamp :
                           typeof lockData.acquiredAt === "string" ? new Date(lockData.acquiredAt).getTime() : undefined;
          const ttl = typeof lockData.staleThresholdMs === "number" ? lockData.staleThresholdMs :
                      typeof lockData.ttlMs === "number" ? lockData.ttlMs : 5000;
          if (baseTime) {
            exp = baseTime + ttl;
          }
        }
        const isStale = exp === undefined || exp <= now;
        results.push({
          resourceKey,
          lockFileName: file,
          isLocked: !isStale,
          isStale,
          owner: lockData.owner,
          token: lockData.token,
          pid: lockData.pid,
          acquiredAt: lockData.acquiredAt ? new Date(lockData.acquiredAt).toISOString() : undefined,
          expiresAt: exp ? new Date(exp).toISOString() : undefined,
          ttlRemainingMs: isStale ? 0 : Math.max(0, exp - now),
        });
      } catch (_) {
        results.push({
          resourceKey,
          lockFileName: file,
          isLocked: false,
          isStale: true,
        });
      }
    }
    return results;
  }

  public cleanupStaleLocks(olderThanMs: number = 5000): number {
    this.ensureStorageStructure();
    if (!fs.existsSync(this.paths.locksDir)) return 0;

    let cleaned = 0;
    const now = Date.now();
    const files = fs.readdirSync(this.paths.locksDir);

    for (const file of files) {
      const filePath = path.join(this.paths.locksDir, file);
      try {
        if (file.endsWith(".tmp")) {
          fs.unlinkSync(filePath);
          cleaned++;
          continue;
        }
        if (file.endsWith(".lock")) {
          const content = fs.readFileSync(filePath, "utf-8");
          const lockData = JSON.parse(content);
          let exp = typeof lockData.expiresAt === "number" ? lockData.expiresAt : undefined;
          if (exp === undefined) {
            const baseTime = typeof lockData.acquiredAt === "number" ? lockData.acquiredAt :
                             typeof lockData.timestamp === "number" ? lockData.timestamp :
                             typeof lockData.acquiredAt === "string" ? new Date(lockData.acquiredAt).getTime() : undefined;
            const ttl = typeof lockData.staleThresholdMs === "number" ? lockData.staleThresholdMs :
                        typeof lockData.ttlMs === "number" ? lockData.ttlMs : 5000;
            if (baseTime) {
              exp = baseTime + ttl;
            }
          }
          const deadProcess = isProcessDead(lockData.pid);
          let isExpired = false;
          if (typeof exp === "number" && exp <= now) {
            isExpired = true;
          } else if (deadProcess) {
            isExpired = true;
          } else if (exp === undefined) {
            try {
              const stat = fs.statSync(filePath);
              if (now - stat.mtimeMs >= olderThanMs && (lockData.pid === undefined || deadProcess)) {
                isExpired = true;
              }
            } catch (_) {}
          }
          if (isExpired) {
            fs.unlinkSync(filePath);
            cleaned++;
          }
        }
      } catch (_) {
        try {
          if (file.endsWith(".lock")) {
            // Guard against deleting in-flight locks: only delete unparseable locks older than 5000ms
            const stat = fs.statSync(filePath);
            if (now - stat.mtimeMs >= 5000) {
              fs.unlinkSync(filePath);
              cleaned++;
            }
          } else {
            fs.unlinkSync(filePath);
            cleaned++;
          }
        } catch (__) {}
      }
    }

    if (cleaned > 0 && this.eventLogger) {
      this.eventLogger.logEvent("locks.cleaned", { cleanedCount: cleaned });
    }

    return cleaned;
  }

  public cleanupTempFiles(): number {
    this.ensureStorageStructure();
    let count = 0;
    const searchDirs = [this.paths.openmemoryDir, this.paths.adrsDir, this.paths.knowledgeDir, this.paths.researchesDir];
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir);
          for (const f of files) {
            if (f.endsWith(".tmp")) {
              try {
                fs.unlinkSync(path.join(dir, f));
                count++;
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
    }
    return count;
  }
}
