/**
 * SQLite Lifecycle & Safe Maintenance Manager (G7.2 / G8)
 *
 * Implements:
 * 1. Explicit registration of managed SQLite databases (distinguishing internal vs external).
 * 2. Deterministic WAL checkpointing via PRAGMA wal_checkpoint(TRUNCATE).
 * 3. Exact interpretation of busy status (never treats a busy/incomplete checkpoint as successful).
 * 4. Mutual exclusion during maintenance via advisory locks (withStateLock).
 * 5. Zero manual deletion of -wal or -shm files.
 * 6. Structured reporting with execution duration, page metrics, and before/after WAL sizes.
 * 7. Graceful degradation when running on runtimes without native node:sqlite.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { PersistenceEngine } from "./persistence-engine";
import { EventLogger } from "./event-logger";

export interface ManagedSQLiteDatabase {
  dbPath: string;
  name: string;
  registeredAt: string;
  isManaged: boolean;
  lastCheckpointAt?: string;
  lastCheckpointResult?: SQLiteCheckpointResult;
  connection?: any;
}

export interface SQLiteCheckpointOptions {
  mode?: "PASSIVE" | "FULL" | "RESTART" | "TRUNCATE";
  timeoutMs?: number;
}

export interface SQLiteCheckpointResult {
  dbPath: string;
  mode: "PASSIVE" | "FULL" | "RESTART" | "TRUNCATE";
  success: boolean;
  busy: boolean;
  logPages?: number;
  checkpointedPages?: number;
  walBytesBefore: number;
  walBytesAfter: number;
  durationMs: number;
  timestamp: string;
  error?: string;
}

export interface SQLiteBatchMaintenanceReport {
  totalDatabases: number;
  successfulCheckpoints: number;
  busyCheckpoints: number;
  failedCheckpoints: number;
  results: SQLiteCheckpointResult[];
  durationMs: number;
  timestamp: string;
}

export class SQLiteLifecycleManager {
  private baseDir: string;
  private managedDatabases: Map<string, ManagedSQLiteDatabase> = new Map();
  private persistenceEngine?: PersistenceEngine;
  private eventLogger?: EventLogger;

  constructor(
    baseDir: string,
    persistenceEngine?: PersistenceEngine,
    eventLogger?: EventLogger
  ) {
    this.baseDir = baseDir;
    this.persistenceEngine = persistenceEngine;
    this.eventLogger = eventLogger;
  }

  /**
   * Check if native SQLite driver is available in the current Node.js runtime.
   */
  public isSQLiteSupported(): boolean {
    try {
      const sqlite = require("node:sqlite");
      return typeof sqlite.DatabaseSync === "function";
    } catch (_) {
      return false;
    }
  }

  /**
   * Register a database as an OpenMemory-managed persistent store.
   */
  public registerDatabase(
    dbPath: string,
    options?: { name?: string; connection?: any }
  ): ManagedSQLiteDatabase {
    const absPath = path.isAbsolute(dbPath) ? path.normalize(dbPath) : path.resolve(this.baseDir, dbPath);
    const name = options?.name || path.basename(absPath, path.extname(absPath));

    const record: ManagedSQLiteDatabase = {
      dbPath: absPath,
      name,
      registeredAt: new Date().toISOString(),
      isManaged: true,
      connection: options?.connection,
    };

    this.managedDatabases.set(absPath, record);

    if (this.eventLogger) {
      this.eventLogger.logEvent("sqlite.database_registered", {
        dbPath: path.relative(this.baseDir, absPath),
        name,
        timestamp: new Date().toISOString(),
      });
    }

    return record;
  }

  /**
   * Unregister a database from managed maintenance.
   */
  public unregisterDatabase(dbPath: string): boolean {
    const absPath = path.isAbsolute(dbPath) ? path.normalize(dbPath) : path.resolve(this.baseDir, dbPath);
    return this.managedDatabases.delete(absPath);
  }

  /**
   * Get all registered managed databases.
   */
  public getManagedDatabases(): ManagedSQLiteDatabase[] {
    return Array.from(this.managedDatabases.values());
  }

  /**
   * Check if a given database path is explicitly managed.
   */
  public isManagedDatabase(dbPath: string): boolean {
    const absPath = path.isAbsolute(dbPath) ? path.normalize(dbPath) : path.resolve(this.baseDir, dbPath);
    return this.managedDatabases.has(absPath);
  }

  /**
   * Safely checkpoint a SQLite database in WAL mode using PRAGMA wal_checkpoint.
   * Never deletes -wal or -shm files directly.
   */
  public checkpoint(
    dbPath: string,
    options?: SQLiteCheckpointOptions
  ): SQLiteCheckpointResult {
    const startTime = Date.now();
    const absPath = path.isAbsolute(dbPath) ? path.normalize(dbPath) : path.resolve(this.baseDir, dbPath);
    const mode = options?.mode || "TRUNCATE";
    const timeoutMs = options?.timeoutMs || 5000;
    const walPath = absPath + "-wal";

    let walBytesBefore = 0;
    if (fs.existsSync(walPath)) {
      try {
        walBytesBefore = fs.statSync(walPath).size;
      } catch (_) {}
    }

    if (!fs.existsSync(absPath)) {
      return {
        dbPath: absPath,
        mode,
        success: false,
        busy: false,
        walBytesBefore,
        walBytesAfter: 0,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: `Database file does not exist: ${absPath}`,
      };
    }

    const managedEntry = this.managedDatabases.get(absPath);
    const existingConn = managedEntry?.connection;

    if (!existingConn && !this.isSQLiteSupported()) {
      return {
        dbPath: absPath,
        mode,
        success: false,
        busy: false,
        walBytesBefore,
        walBytesAfter: walBytesBefore,
        durationMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        error: `Native SQLite driver (node:sqlite) is not available in runtime ${process.version} (requires Node >= 22.5.0)`,
      };
    }

    // Acquire mutual exclusion lock for SQLite maintenance
    const lockKey = "sqlite-maint-" + crypto.createHash("sha256").update(absPath).digest("hex").slice(0, 16);

    const executeCheckpoint = (): SQLiteCheckpointResult => {
      let dbInstance: any = existingConn;
      let ownConnection = false;

      try {
        if (!dbInstance) {
          const { DatabaseSync } = require("node:sqlite");
          dbInstance = new DatabaseSync(absPath);
          ownConnection = true;
          try {
            dbInstance.exec(`PRAGMA busy_timeout = ${timeoutMs};`);
          } catch (_) {}
        }

        const pragmaStmt = `PRAGMA wal_checkpoint(${mode});`;
        const rows = dbInstance.prepare(pragmaStmt).all();

        let busyFlag = 0;
        let logPages = 0;
        let checkpointedPages = 0;

        if (Array.isArray(rows) && rows.length > 0) {
          const first = rows[0];
          busyFlag = Number(first.busy ?? 0);
          logPages = Number(first.log ?? 0);
          checkpointedPages = Number(first.checkpointed ?? 0);
        }

        let walBytesAfter = walBytesBefore;
        if (fs.existsSync(walPath)) {
          try {
            walBytesAfter = fs.statSync(walPath).size;
          } catch (_) {}
        } else {
          walBytesAfter = 0;
        }

        const isBusy = busyFlag !== 0;
        // In TRUNCATE mode, success requires not busy AND (walBytesAfter === 0 OR logPages === 0)
        const isSuccess = !isBusy && (mode !== "TRUNCATE" || walBytesAfter === 0 || checkpointedPages >= logPages);

        const result: SQLiteCheckpointResult = {
          dbPath: absPath,
          mode,
          success: isSuccess,
          busy: isBusy,
          logPages,
          checkpointedPages,
          walBytesBefore,
          walBytesAfter,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          error: isBusy ? "Checkpoint incomplete: active SQLite readers or writers held database lock" : undefined,
        };

        if (managedEntry) {
          managedEntry.lastCheckpointAt = result.timestamp;
          managedEntry.lastCheckpointResult = result;
        }

        if (this.eventLogger) {
          this.eventLogger.logEvent(isSuccess ? "sqlite.checkpoint_success" : "sqlite.checkpoint_busy", {
            db: path.relative(this.baseDir, absPath),
            mode,
            busy: isBusy,
            walBefore: walBytesBefore,
            walAfter: walBytesAfter,
            durationMs: result.durationMs,
          });
        }

        return result;
      } catch (err: any) {
        let walBytesAfter = walBytesBefore;
        if (fs.existsSync(walPath)) {
          try {
            walBytesAfter = fs.statSync(walPath).size;
          } catch (_) {}
        }
        const errorResult: SQLiteCheckpointResult = {
          dbPath: absPath,
          mode,
          success: false,
          busy: false,
          walBytesBefore,
          walBytesAfter,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          error: err.message || String(err),
        };

        if (this.eventLogger) {
          this.eventLogger.logEvent("sqlite.checkpoint_error", {
            db: path.relative(this.baseDir, absPath),
            error: errorResult.error,
          });
        }

        return errorResult;
      } finally {
        if (ownConnection && dbInstance) {
          try {
            dbInstance.close();
          } catch (_) {}
        }
      }
    };

    if (this.persistenceEngine) {
      try {
        return this.persistenceEngine.withStateLock(executeCheckpoint, "sqlite-maint", {
          maxWaitMs: timeoutMs,
        });
      } catch (lockErr: any) {
        // If state lock acquisition timed out, report busy/contention without crashing
        return {
          dbPath: absPath,
          mode,
          success: false,
          busy: true,
          walBytesBefore,
          walBytesAfter: walBytesBefore,
          durationMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          error: `Could not acquire maintenance lock: ${lockErr.message}`,
        };
      }
    } else {
      return executeCheckpoint();
    }
  }

  /**
   * Execute checkpoint on all registered managed databases.
   */
  public checkpointAllManaged(options?: SQLiteCheckpointOptions): SQLiteBatchMaintenanceReport {
    const startTime = Date.now();
    const results: SQLiteCheckpointResult[] = [];
    let successfulCheckpoints = 0;
    let busyCheckpoints = 0;
    let failedCheckpoints = 0;

    for (const entry of this.managedDatabases.values()) {
      const res = this.checkpoint(entry.dbPath, options);
      results.push(res);
      if (res.success) {
        successfulCheckpoints++;
      } else if (res.busy) {
        busyCheckpoints++;
      } else {
        failedCheckpoints++;
      }
    }

    return {
      totalDatabases: results.length,
      successfulCheckpoints,
      busyCheckpoints,
      failedCheckpoints,
      results,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Safely discover and checkpoint SQLite databases across a workspace.
   */
  public checkpointWorkspace(
    scanRoot?: string,
    options?: SQLiteCheckpointOptions
  ): SQLiteBatchMaintenanceReport {
    const root = scanRoot || this.baseDir;
    const startTime = Date.now();
    const dbPaths: string[] = [];

    const scanDir = (dir: string, depth: number = 0) => {
      if (depth > 5) return;
      if (!fs.existsSync(dir)) return;
      let entries: string[] = [];
      try {
        entries = fs.readdirSync(dir);
      } catch (_) {
        return;
      }

      for (const entry of entries) {
        if (entry === "node_modules" || entry === ".git" || entry === "backups" || entry === "scratch") continue;
        const fullPath = path.join(dir, entry);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch (_) {
          continue;
        }

        if (stat.isDirectory()) {
          scanDir(fullPath, depth + 1);
        } else if (stat.isFile() && (entry.endsWith(".db") || entry.endsWith(".sqlite"))) {
          dbPaths.push(fullPath);
        }
      }
    };

    scanDir(root, 0);

    const results: SQLiteCheckpointResult[] = [];
    let successfulCheckpoints = 0;
    let busyCheckpoints = 0;
    let failedCheckpoints = 0;

    for (const p of dbPaths) {
      const res = this.checkpoint(p, options);
      results.push(res);
      if (res.success) {
        successfulCheckpoints++;
      } else if (res.busy) {
        busyCheckpoints++;
      } else {
        failedCheckpoints++;
      }
    }

    return {
      totalDatabases: dbPaths.length,
      successfulCheckpoints,
      busyCheckpoints,
      failedCheckpoints,
      results,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}
