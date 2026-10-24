/**
 * Diagnostic Health Coordinator (G7.2 / G8)
 *
 * Implements:
 * 1. Safe periodic health auditing with configurable interval (conservative default: 60s).
 * 2. Overlap prevention: single concurrent execution per coordinator instance.
 * 3. Explicit lifecycle: clean start() and stop() with timer unref to prevent hanging host process.
 * 4. Read-only by default: repair is NEVER executed automatically on periodic intervals.
 * 5. Exception isolation: diagnostic failures never terminate or destabilize the host application.
 * 6. Alert throttling & state transition detection: suppresses repetitive log spamming.
 * 7. Zero background execution on module import (requires explicit instantiation and start()).
 */

import { DiagnosticReport } from "../types";

export interface HealthCoordinatorConfig {
  /**
   * Interval between diagnostic cycles in milliseconds (default: 60,000 ms, min: 1,000 ms).
   */
  intervalMs?: number;

  /**
   * Whether the periodic health coordinator is enabled (default: true).
   */
  enabled?: boolean;

  /**
   * Minimum time in milliseconds between repeated unchanged alerts (default: 300,000 ms / 5 min).
   */
  alertThrottleMs?: number;

  /**
   * Optional custom workspace root directory for scanning.
   */
  rootDir?: string;

  /**
   * Callback invoked when system diagnostic status transitions (e.g. HEALTHY -> CORRUPTED).
   */
  onStatusChange?: (
    newStatus: "HEALTHY" | "REPAIRED" | "CORRUPTED" | "UNKNOWN",
    previousStatus: "HEALTHY" | "REPAIRED" | "CORRUPTED" | "UNKNOWN" | null,
    report: DiagnosticReport
  ) => void;

  /**
   * Callback invoked on every completed diagnostic cycle.
   */
  onCheckCompleted?: (report: DiagnosticReport) => void;

  /**
   * Callback invoked if the diagnostic cycle encounters an unhandled exception.
   */
  onError?: (error: Error) => void;
}

export interface HealthCoordinatorStatus {
  running: boolean;
  enabled: boolean;
  intervalMs: number;
  lastExecutionAt?: string;
  lastStatus?: "HEALTHY" | "REPAIRED" | "CORRUPTED" | "UNKNOWN";
  lastDurationMs?: number;
  totalExecutions: number;
  totalFailures: number;
  totalSkippedDueToOverlap: number;
}

export class DiagnosticHealthCoordinator {
  private storageEngine: any;
  private config: Required<Omit<HealthCoordinatorConfig, "rootDir" | "onStatusChange" | "onCheckCompleted" | "onError">> & {
    rootDir?: string;
    onStatusChange?: HealthCoordinatorConfig["onStatusChange"];
    onCheckCompleted?: HealthCoordinatorConfig["onCheckCompleted"];
    onError?: HealthCoordinatorConfig["onError"];
  };

  private timer: NodeJS.Timeout | null = null;
  private isExecuting: boolean = false;
  private running: boolean = false;
  private lastStatus: "HEALTHY" | "REPAIRED" | "CORRUPTED" | "UNKNOWN" | null = null;
  private lastAlertTimestamp: number = 0;
  private totalExecutions: number = 0;
  private totalFailures: number = 0;
  private totalSkippedDueToOverlap: number = 0;
  private lastExecutionAt?: string;
  private lastDurationMs?: number;

  constructor(storageEngine: any, config?: HealthCoordinatorConfig) {
    if (!storageEngine || typeof storageEngine.runDiagnostics !== "function") {
      throw new Error("[HealthCoordinator] Invalid StorageEngine instance provided (must have runDiagnostics method)");
    }

    this.storageEngine = storageEngine;
    const intervalMs = Math.max(1000, Number(config?.intervalMs ?? 60000));
    const alertThrottleMs = Math.max(5000, Number(config?.alertThrottleMs ?? 300000));

    this.config = {
      intervalMs,
      enabled: config?.enabled !== false,
      alertThrottleMs,
      rootDir: config?.rootDir,
      onStatusChange: config?.onStatusChange,
      onCheckCompleted: config?.onCheckCompleted,
      onError: config?.onError,
    };
  }

  /**
   * Start the periodic health coordinator.
   */
  public start(): boolean {
    if (!this.config.enabled) {
      return false;
    }

    if (this.running) {
      return true;
    }

    this.running = true;
    this.timer = setInterval(() => {
      this.executeCycle();
    }, this.config.intervalMs);

    // Prevent timer from holding the Node.js event loop open upon shutdown
    if (this.timer && typeof this.timer.unref === "function") {
      this.timer.unref();
    }

    return true;
  }

  /**
   * Orderly stop of the periodic health coordinator and timer release.
   */
  public stop(): boolean {
    if (!this.running) {
      return false;
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.running = false;
    return true;
  }

  /**
   * Trigger an immediate single read-only diagnostic cycle.
   */
  public executeNow(): DiagnosticReport | null {
    return this.executeCycle();
  }

  public async triggerNow(): Promise<DiagnosticReport | null> {
    if (this.isExecuting) {
      this.totalSkippedDueToOverlap++;
      return null;
    }
    return this.executeCycle();
  }

  /**
   * Get current operational status and telemetry summary.
   */
  public getStatus(): HealthCoordinatorStatus {
    return {
      running: this.running,
      enabled: this.config.enabled,
      intervalMs: this.config.intervalMs,
      lastExecutionAt: this.lastExecutionAt,
      lastStatus: this.lastStatus || undefined,
      lastDurationMs: this.lastDurationMs,
      totalExecutions: this.totalExecutions,
      totalFailures: this.totalFailures,
      totalSkippedDueToOverlap: this.totalSkippedDueToOverlap,
    };
  }

  /**
   * Internal execution cycle with overlap protection and fail-safe boundaries.
   */
  private executeCycle(): DiagnosticReport | null {
    if (this.isExecuting) {
      this.totalSkippedDueToOverlap++;
      return null;
    }

    this.isExecuting = true;
    const cycleStart = Date.now();

    try {
      // Periodic coordinator is strictly READ-ONLY (repair: false)
      const report: DiagnosticReport = this.storageEngine.runDiagnostics({
        repair: false,
        rootDir: this.config.rootDir,
      });

      const now = Date.now();
      const durationMs = now - cycleStart;
      this.totalExecutions++;
      this.lastExecutionAt = new Date(now).toISOString();
      this.lastDurationMs = durationMs;

      const previousStatus = this.lastStatus;
      const currentStatus = report.status;
      this.lastStatus = currentStatus;

      // Status transition detection
      if (previousStatus !== null && previousStatus !== currentStatus) {
        if (typeof this.config.onStatusChange === "function") {
          try {
            this.config.onStatusChange(currentStatus, previousStatus, report);
          } catch (_) {}
        }

        // Log transition event
        if (typeof this.storageEngine.logEvent === "function") {
          try {
            this.storageEngine.logEvent("health.status_transition", {
              previousStatus,
              newStatus: currentStatus,
              durationMs,
              failedChecksCount: report.checks.filter(c => !c.passed).length,
              timestamp: this.lastExecutionAt,
            });
          } catch (_) {}
        }
        this.lastAlertTimestamp = now;
      } else if (currentStatus === "CORRUPTED" && now - this.lastAlertTimestamp >= this.config.alertThrottleMs) {
        // Throttled recurring alert for persistent failure state
        if (typeof this.storageEngine.logEvent === "function") {
          try {
            this.storageEngine.logEvent("health.recurring_corruption_alert", {
              status: currentStatus,
              durationMs,
              failedChecks: report.checks.filter(c => !c.passed).map(c => c.name),
              timestamp: this.lastExecutionAt,
            });
          } catch (_) {}
        }
        this.lastAlertTimestamp = now;
      }

      if (typeof this.config.onCheckCompleted === "function") {
        try {
          this.config.onCheckCompleted(report);
        } catch (_) {}
      }

      return report;
    } catch (err: any) {
      this.totalFailures++;
      const errorObj = err instanceof Error ? err : new Error(String(err));

      if (typeof this.config.onError === "function") {
        try {
          this.config.onError(errorObj);
        } catch (_) {}
      }

      if (typeof this.storageEngine.logEvent === "function") {
        try {
          this.storageEngine.logEvent("health.coordinator_exception", {
            error: errorObj.message,
            timestamp: new Date().toISOString(),
          });
        } catch (_) {}
      }

      return null;
    } finally {
      this.isExecuting = false;
    }
  }
}
