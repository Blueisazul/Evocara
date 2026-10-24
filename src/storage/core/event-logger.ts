import * as fs from "fs";
import * as path from "path";

export interface LogEventEntry {
  timestamp: string;
  eventType: string;
  agentId?: string;
  sessionId?: string;
  payload: Record<string, unknown>;
}

export interface EventLogIntegrityAudit {
  totalLines: number;
  validLines: number;
  corruptLines: number;
  corruptLineNumbers: number[];
}

export interface EventLogRepairResult {
  repaired: boolean;
  quarantinedLinesCount: number;
  quarantineFile?: string;
}

export interface EventRetentionPolicy {
  maxSizeBytes: number;
  maxEvents: number;
  maxArchiveFiles: number;
  preserveEssentialEvents: boolean;
  essentialEventTypes: string[];
  archiveDir?: string;
}

export interface EventCompactionResult {
  compacted: boolean;
  eventsBefore: number;
  eventsAfter: number;
  sizeBeforeBytes: number;
  sizeAfterBytes: number;
  essentialPreserved: number;
  prunedEvents: number;
  archivedFile?: string;
  reason?: string;
}

export interface EventRotationResult {
  rotated: boolean;
  archivedFile?: string;
  reason?: string;
}

export const DEFAULT_ESSENTIAL_EVENT_TYPES: string[] = [
  "adr.created",
  "adr.saved",
  "adr.superseded",
  "adr.voted",
  "knowledge.item_created",
  "knowledge.item_deleted",
  "knowledge.lifecycle_transitioned",
  "knowledge.relation_created",
  "stage.transitioned",
  "session.registered",
  "session.created",
  "session.compacted",
  "backup.created",
  "backup.restored",
  "logs.compacted",
  "logs.rotated",
  "logs.repaired",
];

export const DEFAULT_EVENT_RETENTION_POLICY: EventRetentionPolicy = {
  maxSizeBytes: 1048576, // 1 MB
  maxEvents: 1000,
  maxArchiveFiles: 3,
  preserveEssentialEvents: true,
  essentialEventTypes: [...DEFAULT_ESSENTIAL_EVENT_TYPES],
};

export class EventLogger {
  private logsDir: string;
  private retentionPolicy: EventRetentionPolicy;

  constructor(logsDir: string, policy?: Partial<EventRetentionPolicy>) {
    this.logsDir = logsDir;
    this.retentionPolicy = this.sanitizePolicy({
      ...DEFAULT_EVENT_RETENTION_POLICY,
      ...policy,
    });
  }

  private sanitizePolicy(policy?: Partial<EventRetentionPolicy>): EventRetentionPolicy {
    const current = this.retentionPolicy || DEFAULT_EVENT_RETENTION_POLICY;
    const base = { ...DEFAULT_EVENT_RETENTION_POLICY, ...current, ...policy };
    return {
      maxEvents: typeof base.maxEvents === "number" && base.maxEvents > 0 ? Math.floor(base.maxEvents) : DEFAULT_EVENT_RETENTION_POLICY.maxEvents,
      maxSizeBytes: typeof base.maxSizeBytes === "number" && base.maxSizeBytes >= 1024 ? Math.floor(base.maxSizeBytes) : DEFAULT_EVENT_RETENTION_POLICY.maxSizeBytes,
      archiveDir: typeof base.archiveDir === "string" && base.archiveDir.trim() ? base.archiveDir.trim() : this.logsDir,
      maxArchiveFiles: typeof base.maxArchiveFiles === "number" ? Math.max(0, Math.floor(base.maxArchiveFiles)) : DEFAULT_EVENT_RETENTION_POLICY.maxArchiveFiles,
      preserveEssentialEvents: base.preserveEssentialEvents !== false,
      essentialEventTypes: Array.isArray(base.essentialEventTypes) && base.essentialEventTypes.length > 0
        ? [...new Set(base.essentialEventTypes.filter((t) => typeof t === "string" && t.trim()))]
        : [...DEFAULT_ESSENTIAL_EVENT_TYPES],
    };
  }

  public getRetentionPolicy(): EventRetentionPolicy {
    return {
      ...this.retentionPolicy,
      essentialEventTypes: [...this.retentionPolicy.essentialEventTypes],
    };
  }

  public setRetentionPolicy(policy: Partial<EventRetentionPolicy>): void {
    this.retentionPolicy = this.sanitizePolicy(policy);
  }

  private ensureLogsDir(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Scans and safely removes stale temporary staging files left from interrupted writes or compactions.
   */
  public cleanStaleTempFiles(maxAgeMs: number = 300000): number {
    try {
      this.ensureLogsDir();
      const files = fs.readdirSync(this.logsDir);
      let cleaned = 0;
      const now = Date.now();
      for (const f of files) {
        if (f.endsWith(".tmp") && (f.startsWith("events.") || f.startsWith("compact."))) {
          const fullPath = path.join(this.logsDir, f);
          try {
            const stat = fs.statSync(fullPath);
            if (maxAgeMs <= 0 || (now - stat.mtimeMs) >= maxAgeMs) {
              fs.unlinkSync(fullPath);
              cleaned++;
            }
          } catch (_) {}
        }
      }
      return cleaned;
    } catch (_) {
      return 0;
    }
  }

  /**
   * Enforces retention limit on archived snapshot files.
   */
  private enforceMaxArchives(dir: string, maxArchives: number): void {
    try {
      if (!fs.existsSync(dir)) return;
      const files = fs
        .readdirSync(dir)
        .filter((f) => (f.startsWith("events.archive.") || f.startsWith("events.")) && f.endsWith(".jsonl") && f !== "events.jsonl")
        .map((f) => ({
          name: f,
          path: path.join(dir, f),
          time: fs.statSync(path.join(dir, f)).mtimeMs,
        }))
        .sort((a, b) => b.time - a.time);

      if (maxArchives <= 0 || !Number.isFinite(maxArchives)) {
        return; // 0 or non-positive indicates unlimited archive preservation (no deletion)
      }
      if (files.length > maxArchives) {
        for (let i = maxArchives; i < files.length; i++) {
          try {
            fs.unlinkSync(files[i].path);
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  public internalAppendEventEntry(entry: LogEventEntry): void {
    try {
      this.ensureLogsDir();
      const eventLogFile = path.join(this.logsDir, "events.jsonl");
      fs.appendFileSync(eventLogFile, JSON.stringify(entry) + "\n", "utf-8");
    } catch (_) {
      // Fail-safe logging
    }
  }

  /**
   * Rotates events.jsonl up to maxArchiveFiles without losing events.
   */
  public rotateEventLogsInternal(
    maxSizeBytes: number = 1048576,
    maxArchiveFiles: number = 3
  ): EventRotationResult {
    try {
      this.ensureLogsDir();
      this.cleanStaleTempFiles();
      const eventLogFile = path.join(this.logsDir, "events.jsonl");

      if (!fs.existsSync(eventLogFile)) {
        return { rotated: false, reason: "Log file does not exist" };
      }

      const stat = fs.statSync(eventLogFile);
      if (stat.size < maxSizeBytes) {
        return { rotated: false, reason: "Log size below threshold" };
      }

      for (let i = maxArchiveFiles - 1; i >= 1; i--) {
        const currentName = i === 1 ? "events.1.jsonl" : `events.${i}.jsonl`;
        const nextName = `events.${i + 1}.jsonl`;
        const currentPath = path.join(this.logsDir, currentName);
        const nextPath = path.join(this.logsDir, nextName);

        if (fs.existsSync(currentPath)) {
          if (fs.existsSync(nextPath)) {
            fs.rmSync(nextPath, { force: true });
          }
          fs.renameSync(currentPath, nextPath);
        }
      }

      const archive1Path = path.join(this.logsDir, "events.1.jsonl");
      if (fs.existsSync(archive1Path)) {
        fs.rmSync(archive1Path, { force: true });
      }
      fs.renameSync(eventLogFile, archive1Path);

      fs.writeFileSync(eventLogFile, "", "utf-8");

      this.internalAppendEventEntry({
        timestamp: new Date().toISOString(),
        eventType: "logs.rotated",
        payload: { archivedFile: "events.1.jsonl", timestamp: new Date().toISOString() },
      });

      return { rotated: true, archivedFile: "events.1.jsonl" };
    } catch (err) {
      return { rotated: false, reason: (err as Error).message };
    }
  }

  /**
   * Deterministic Event Compaction Engine (G19 Operational Durability)
   *
   * Enforces retention policy based on both maxSizeBytes and maxEvents.
   * Preserves essential audit trail events (ADRs, Knowledge changes, Backups, Sessions, Compactions)
   * while pruning high-frequency transient telemetry.
   * Interruption-safe via temporary staging file, fsync, and atomic rename.
   */
  public compactEventLogs(policyOverride?: Partial<EventRetentionPolicy>): EventCompactionResult {
    try {
      this.ensureLogsDir();
      this.cleanStaleTempFiles();

      const policy: EventRetentionPolicy = {
        ...this.retentionPolicy,
        ...policyOverride,
        essentialEventTypes: policyOverride?.essentialEventTypes
          ? [...policyOverride.essentialEventTypes]
          : [...this.retentionPolicy.essentialEventTypes],
      };

      const eventLogFile = path.join(this.logsDir, "events.jsonl");
      if (!fs.existsSync(eventLogFile)) {
        return {
          compacted: false,
          eventsBefore: 0,
          eventsAfter: 0,
          sizeBeforeBytes: 0,
          sizeAfterBytes: 0,
          essentialPreserved: 0,
          prunedEvents: 0,
          reason: "Log file does not exist",
        };
      }

      // Repair if torn writes exist
      const audit = this.auditEventLogIntegrity();
      if (audit.corruptLines > 0) {
        this.repairEventLog();
      }

      const statBefore = fs.statSync(eventLogFile);
      const rawContent = fs.readFileSync(eventLogFile, "utf-8");
      const lines = rawContent.split("\n").map((l) => l.trim()).filter(Boolean);
      const totalEvents = lines.length;

      const exceedsSize = statBefore.size >= policy.maxSizeBytes;
      const exceedsCount = totalEvents >= policy.maxEvents;

      if (!exceedsSize && !exceedsCount) {
        return {
          compacted: false,
          eventsBefore: totalEvents,
          eventsAfter: totalEvents,
          sizeBeforeBytes: statBefore.size,
          sizeAfterBytes: statBefore.size,
          essentialPreserved: 0,
          prunedEvents: 0,
          reason: "Log size and event count below retention thresholds",
        };
      }

      const parsedEntries: { raw: string; entry: LogEventEntry }[] = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as LogEventEntry;
          parsedEntries.push({ raw: line, entry });
        } catch (_) {}
      }

      // Partition into essential audit events and standard telemetry events
      const essentialEntries: { raw: string; entry: LogEventEntry }[] = [];
      const standardEntries: { raw: string; entry: LogEventEntry }[] = [];

      for (const item of parsedEntries) {
        const isEssential =
          policy.preserveEssentialEvents &&
          policy.essentialEventTypes.includes(item.entry.eventType);
        if (isEssential) {
          essentialEntries.push(item);
        } else {
          standardEntries.push(item);
        }
      }

      // Retain recent window of standard events (up to half of maxEvents)
      const allowedStandardCount = Math.max(5, Math.floor(policy.maxEvents / 2));
      const keptStandard = standardEntries.slice(-allowedStandardCount);

      // Recombine preserving chronological ordering
      const combined = [...essentialEntries, ...keptStandard].sort((a, b) => {
        return (a.entry.timestamp || "").localeCompare(b.entry.timestamp || "");
      });

      // Archive full historical snapshot before compaction
      const archiveDir = policy.archiveDir || this.logsDir;
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }
      const archiveName = `events.archive.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.jsonl`;
      const archivePath = path.join(archiveDir, archiveName);
      fs.copyFileSync(eventLogFile, archivePath);

      this.enforceMaxArchives(archiveDir, policy.maxArchiveFiles);

      // Interruption-safe staging file write with fsync
      const tempFileName = `compact.${Date.now()}.${Math.random().toString(36).substring(2, 8)}.tmp`;
      const tempPath = path.join(this.logsDir, tempFileName);

      const compactedBody = combined.map((c) => c.raw).join("\n") + (combined.length > 0 ? "\n" : "");
      const fd = fs.openSync(tempPath, "w");
      try {
        fs.writeFileSync(fd, compactedBody, "utf-8");
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }

      // Atomic rename to replace active log
      fs.renameSync(tempPath, eventLogFile);

      // Append auditable logs.compacted entry
      const compactionAuditEntry: LogEventEntry = {
        timestamp: new Date().toISOString(),
        eventType: "logs.compacted",
        payload: {
          archivedFile: archiveName,
          eventsBefore: totalEvents,
          eventsAfter: combined.length + 1,
          sizeBeforeBytes: statBefore.size,
          sizeAfterBytes: fs.statSync(eventLogFile).size,
          essentialPreserved: essentialEntries.length,
          prunedEvents: totalEvents - combined.length,
          timestamp: new Date().toISOString(),
        },
      };
      this.internalAppendEventEntry(compactionAuditEntry);

      const statAfter = fs.statSync(eventLogFile);

      return {
        compacted: true,
        eventsBefore: totalEvents,
        eventsAfter: combined.length + 1,
        sizeBeforeBytes: statBefore.size,
        sizeAfterBytes: statAfter.size,
        essentialPreserved: essentialEntries.length,
        prunedEvents: totalEvents - combined.length,
        archivedFile: archiveName,
      };
    } catch (err) {
      return {
        compacted: false,
        eventsBefore: 0,
        eventsAfter: 0,
        sizeBeforeBytes: 0,
        sizeAfterBytes: 0,
        essentialPreserved: 0,
        prunedEvents: 0,
        reason: (err as Error).message,
      };
    }
  }

  public logEvent(
    eventType: string,
    payload: Record<string, unknown>,
    agentId?: string,
    sessionId?: string,
    maxSizeBytes?: number,
    maxArchiveFiles?: number
  ): void {
    try {
      this.ensureLogsDir();
      const eventLogFile = path.join(this.logsDir, "events.jsonl");

      const thresholdSize = maxSizeBytes || this.retentionPolicy.maxSizeBytes;
      const thresholdArchives = maxArchiveFiles || this.retentionPolicy.maxArchiveFiles;

      if (fs.existsSync(eventLogFile)) {
        const stat = fs.statSync(eventLogFile);
        if (stat.size >= thresholdSize && stat.size > 0) {
          if (this.retentionPolicy.preserveEssentialEvents) {
            this.compactEventLogs();
          } else {
            this.rotateEventLogsInternal(thresholdSize, thresholdArchives);
          }
        }
      }

      const entry: LogEventEntry = {
        timestamp: new Date().toISOString(),
        eventType,
        agentId: agentId || undefined,
        sessionId: sessionId || undefined,
        payload,
      };
      this.internalAppendEventEntry(entry);
    } catch (_) {
      // Fail-safe logging: StorageEngine core operations must never fail due to log append issues
    }
  }

  /**
   * Read events matching optional filter criteria for forensic audit and testing.
   */
  public readEvents(filter?: {
    eventType?: string;
    agentId?: string;
    sessionId?: string;
    sinceTimestamp?: string;
    limit?: number;
    includeArchives?: boolean;
  }): LogEventEntry[] {
    const events: LogEventEntry[] = [];
    const filesToRead: string[] = [];

    if (filter?.includeArchives) {
      try {
        if (fs.existsSync(this.logsDir)) {
          const archiveFiles = fs
            .readdirSync(this.logsDir)
            .filter((f) => (f.startsWith("events.archive.") || f.startsWith("events.")) && f.endsWith(".jsonl") && f !== "events.jsonl")
            .map((f) => ({
              path: path.join(this.logsDir, f),
              time: fs.statSync(path.join(this.logsDir, f)).mtimeMs,
            }))
            .sort((a, b) => a.time - b.time);
          for (const af of archiveFiles) {
            filesToRead.push(af.path);
          }
        }
      } catch (_) {}
    }

    const activeLogFile = path.join(this.logsDir, "events.jsonl");
    if (fs.existsSync(activeLogFile)) {
      filesToRead.push(activeLogFile);
    }

    if (filesToRead.length === 0) return [];

    for (const filePath of filesToRead) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as LogEventEntry;
            if (filter?.eventType && entry.eventType !== filter.eventType) continue;
            if (filter?.agentId && entry.agentId !== filter.agentId) continue;
            if (filter?.sessionId && entry.sessionId !== filter.sessionId) continue;
            if (filter?.sinceTimestamp && (entry.timestamp || "") < filter.sinceTimestamp) continue;
            events.push(entry);
          } catch (_) {}
        }
      } catch (_) {}
    }

    if (filter?.limit && filter.limit > 0) {
      return events.slice(-filter.limit);
    }
    return events;
  }

  /**
   * Audit event log integrity and detect torn writes / malformed lines (G7 Observability).
   */
  public auditEventLogIntegrity(): EventLogIntegrityAudit {
    const eventLogFile = path.join(this.logsDir, "events.jsonl");
    if (!fs.existsSync(eventLogFile)) {
      return { totalLines: 0, validLines: 0, corruptLines: 0, corruptLineNumbers: [] };
    }
    const content = fs.readFileSync(eventLogFile, "utf-8");
    const rawLines = content.split("\n");
    let totalLines = 0;
    let validLines = 0;
    const corruptLineNumbers: number[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;
      totalLines++;
      try {
        JSON.parse(line);
        validLines++;
      } catch (_) {
        corruptLineNumbers.push(i + 1);
      }
    }

    return {
      totalLines,
      validLines,
      corruptLines: corruptLineNumbers.length,
      corruptLineNumbers,
    };
  }

  /**
   * Safely isolate and repair torn/corrupted log entries to quarantine file (G7 Resilience).
   */
  public repairEventLog(): EventLogRepairResult {
    const audit = this.auditEventLogIntegrity();
    if (audit.corruptLines === 0) {
      return { repaired: false, quarantinedLinesCount: 0 };
    }

    const eventLogFile = path.join(this.logsDir, "events.jsonl");
    const content = fs.readFileSync(eventLogFile, "utf-8");
    const rawLines = content.split("\n");
    const validLines: string[] = [];
    const corruptLines: string[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue;
      try {
        JSON.parse(line);
        validLines.push(line);
      } catch (_) {
        corruptLines.push(line);
      }
    }

    const ts = Date.now();
    const quarantineFileName = `events.corrupt.${ts}.jsonl`;
    const quarantinePath = path.join(this.logsDir, quarantineFileName);

    fs.writeFileSync(quarantinePath, corruptLines.join("\n") + "\n", "utf-8");
    fs.writeFileSync(eventLogFile, validLines.length > 0 ? validLines.join("\n") + "\n" : "", "utf-8");

    this.internalAppendEventEntry({
      timestamp: new Date().toISOString(),
      eventType: "logs.repaired",
      payload: {
        quarantineFile: quarantineFileName,
        quarantinedCount: corruptLines.length,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      repaired: true,
      quarantinedLinesCount: corruptLines.length,
      quarantineFile: quarantineFileName,
    };
  }
}
