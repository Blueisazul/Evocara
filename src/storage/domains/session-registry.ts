import {
  SessionRecord,
  SessionStatus,
  SessionProvenanceSnapshot,
  ReconcileOptions,
  ReconcileCandidate,
  ReconcileResult,
  AgentTask,
  ADRRecord,
  ResearchRecord,
  ProjectState,
} from "../types";

export type EventLogCallback = (
  eventType: string,
  payload: Record<string, unknown>,
  agentId?: string,
  sessionId?: string
) => void;

export type UpdateHandoffCallback = (update: { progressSummary?: string[] }) => void;

/**
 * SessionRegistry Domain Module (F13.3.2-A)
 * Pure domain handler for agent session lifecycles and session queries.
 * Does NOT perform file I/O, does NOT manage locks, does NOT persist state directly.
 */
export class SessionRegistry {
  /**
   * Session Registry: Registers a new active or historical agent session (F10 & F12.2)
   */
  public registerSession(
    state: ProjectState,
    sessionData: Partial<SessionRecord> & { agentId: string },
    logEvent?: EventLogCallback
  ): SessionRecord {
    let sessions = state.sessions || [];
    const now = new Date().toISOString();
    const id =
      sessionData.id ||
      `sess-${sessionData.agentId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    // Optional provenance snapshot at creation time (written ONCE, never updated)
    let provenance: SessionProvenanceSnapshot | undefined = sessionData.provenance;
    if (!provenance && (state.currentStage || state.roadmap?.activePhaseId)) {
      provenance = {};
      if (state.currentStage) provenance.workflowStageAtCreation = state.currentStage;
      if (state.roadmap?.activePhaseId) provenance.roadmapPhaseAtCreation = state.roadmap.activePhaseId;
    }

    const record: SessionRecord = {
      id,
      agentId: sessionData.agentId,
      hostId: sessionData.hostId || undefined,
      status: (sessionData.status &&
      ["ACTIVE", "IDLE", "COMPLETED", "FAILED", "ABORTED"].includes(sessionData.status as string)
        ? sessionData.status
        : "ACTIVE") as SessionStatus,
      startedAt: sessionData.startedAt || now,
      lastActiveAt: now,
      completedAt: sessionData.completedAt || undefined,
      lastCompactedAt: sessionData.lastCompactedAt || undefined,
      compactionCount: sessionData.compactionCount || undefined,
      provenance: provenance && Object.keys(provenance).length > 0 ? provenance : undefined,
      metadata: sessionData.metadata || {},
    };

    sessions.push(record);

    // Limit sessions array to 100 max (F10 - Condition 3)
    if (sessions.length > 100) {
      const activeOrNewer = sessions.filter(s => s.status === "ACTIVE");
      const inactive = sessions.filter(s => s.status !== "ACTIVE");
      inactive.sort(
        (a, b) => new Date(a.lastActiveAt).getTime() - new Date(b.lastActiveAt).getTime()
      );

      while (sessions.length > 100 && inactive.length > 0) {
        const purged = inactive.shift();
        if (purged) {
          sessions = sessions.filter(s => s.id !== purged.id);
          if (logEvent) {
            logEvent(
              "session.purged",
              { purgedSessionId: purged.id, agentId: purged.agentId },
              purged.agentId,
              purged.id
            );
          }
        }
      }

      while (sessions.length > 100) {
        const purged = sessions.shift();
        if (purged) {
          if (logEvent) {
            logEvent(
              "session.purged",
              { purgedSessionId: purged.id, agentId: purged.agentId },
              purged.agentId,
              purged.id
            );
          }
        }
      }
    }

    state.sessions = sessions;
    state.lastSessionId = record.id;
    state.sessionRunCount = (state.sessionRunCount || 0) + 1;

    if (logEvent) {
      logEvent(
        "session.registered",
        { id: record.id, agentId: record.agentId, status: record.status },
        record.agentId,
        record.id
      );
    }
    return record;
  }

  /**
   * Session Registry: Update existing session status/metadata (F10 & F12.2)
   */
  public updateSessionStatus(
    state: ProjectState,
    id: string,
    status: SessionStatus | "COMPACTED",
    metadata?: Record<string, unknown>,
    logEvent?: EventLogCallback
  ): SessionRecord | null {
    const sessions = state.sessions || [];
    const sess = sessions.find(s => s.id === id);
    if (!sess) return null;

    const TERMINAL_STATES: SessionStatus[] = ["COMPLETED", "FAILED", "ABORTED"];

    // Invariant B8: Terminal state protection
    if (TERMINAL_STATES.includes(sess.status) && (status === "ACTIVE" || status === "IDLE")) {
      throw new Error(
        `Cannot transition session '${id}' from terminal status '${sess.status}' back to '${status}'. Register a new session instead.`
      );
    }

    const now = new Date().toISOString();

    if ((status as string) === "COMPACTED") {
      sess.lastCompactedAt = now;
      sess.compactionCount = (sess.compactionCount || 0) + 1;
      if (!sess.status) sess.status = "ACTIVE";
    } else {
      sess.status = status as SessionStatus;
      if (TERMINAL_STATES.includes(status as SessionStatus)) {
        sess.completedAt = sess.completedAt || now;
      }
    }

    sess.lastActiveAt = now;
    if (metadata) {
      sess.metadata = { ...(sess.metadata || {}), ...metadata };
    }

    state.sessions = sessions;

    if (logEvent) {
      logEvent("session.updated", { id: sess.id, status: sess.status }, sess.agentId, sess.id);
    }
    return sess;
  }

  /**
   * Session Reconciliation: Explicitly identify and reconcile stale active sessions (F12.3-A)
   */
  public reconcileSessions(
    state: ProjectState,
    options: ReconcileOptions,
    logEvent?: EventLogCallback,
    updateHandoff?: UpdateHandoffCallback
  ): ReconcileResult {
    const thresholdMs = options.thresholdMs;
    const logEvidence: string[] = [];

    const dryRun = options.dryRun !== false;
    const confirm = options.confirm === true;
    const isMutation = !dryRun && confirm;
    const maxLimit = Math.min(options.maxLimit || 100, 100);
    const agentId = options.agentId || "system-reconciler";

    const sessions = state.sessions || [];
    const tasks = state.coordinationTasks || [];
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const candidates: ReconcileCandidate[] = [];
    let reconciledCount = 0;
    let totalTasksReleasedCount = 0;
    let totalTasksWouldReleaseCount = 0;
    const allReleasedTaskIds: string[] = [];
    const allWouldReleaseTaskIds: string[] = [];

    for (const s of sessions) {
      if (candidates.length >= maxLimit) break;

      // Terminal Protection (Invariant B8): strictly ignore COMPLETED, FAILED, ABORTED, and IDLE sessions
      if (s.status !== "ACTIVE") {
        continue;
      }

      const lastActiveMs = Date.parse(s.lastActiveAt);
      if (isNaN(lastActiveMs)) {
        logEvidence.push(`Invalid timestamp on session '${s.id}': '${s.lastActiveAt}'. Skipped.`);
        continue;
      }

      if (lastActiveMs > nowMs) {
        logEvidence.push(`Future timestamp on session '${s.id}': '${s.lastActiveAt}' > now. Skipped.`);
        continue;
      }

      const inactiveDurationMs = nowMs - lastActiveMs;
      if (inactiveDurationMs >= thresholdMs) {
        // Find orphan tasks assigned to this session in IN_PROGRESS state
        const orphanTasks = tasks.filter(
          t => t.assignedSessionId === s.id && t.status === "IN_PROGRESS"
        );
        const orphanTaskIds = orphanTasks.map(t => t.id);

        if (isMutation) {
          // Apply mutation: ACTIVE -> ABORTED
          s.status = "ABORTED";
          s.completedAt = s.completedAt || nowIso;
          s.lastActiveAt = nowIso;
          s.metadata = {
            ...(s.metadata || {}),
            reconciliation: {
              method: "EXPLICIT_RECONCILIATION",
              reason: "STALE_INACTIVITY_THRESHOLD",
              thresholdMs,
              reconciledAt: nowIso,
              reconciledBy: agentId,
            },
          };

          // Task Orphan Recovery: IN_PROGRESS -> PENDING, unassigned
          for (const task of orphanTasks) {
            task.status = "PENDING";
            delete task.assignedAgentId;
            delete task.assignedSessionId;
            task.updatedAt = nowIso;
            task.metadata = {
              ...(task.metadata || {}),
              orphanRecovery: {
                recoveredFromSessionId: s.id,
                recoveredFromAgentId: s.agentId,
                recoveredAt: nowIso,
                reason: "STALE_SESSION_ABORTED",
              },
            };
            if (logEvent) {
              logEvent(
                "task.recovered",
                { taskId: task.id, recoveredFromSessionId: s.id, recoveredFromAgentId: s.agentId },
                agentId,
                s.id
              );
            }
          }

          reconciledCount++;
          totalTasksReleasedCount += orphanTasks.length;
          allReleasedTaskIds.push(...orphanTaskIds);

          candidates.push({
            sessionId: s.id,
            agentId: s.agentId,
            hostId: s.hostId,
            lastActiveAt: s.lastActiveAt,
            inactiveDurationMs,
            action: "RECONCILED",
            releasedTasksCount: orphanTasks.length,
            releasedTaskIds: orphanTaskIds,
          });
        } else {
          // Analysis / Dry-run mode: ZERO disk mutations
          totalTasksWouldReleaseCount += orphanTasks.length;
          allWouldReleaseTaskIds.push(...orphanTaskIds);

          candidates.push({
            sessionId: s.id,
            agentId: s.agentId,
            hostId: s.hostId,
            lastActiveAt: s.lastActiveAt,
            inactiveDurationMs,
            action: "WOULD_RECONCILE",
            wouldReleaseTasksCount: orphanTasks.length,
            wouldReleaseTaskIds: orphanTaskIds,
          });
        }
      }
    }

    if (isMutation && reconciledCount > 0) {
      state.sessions = sessions;
      state.coordinationTasks = tasks;
      if (logEvent) {
        logEvent(
          "session.reconciled",
          { reconciledCount, tasksReleasedCount: totalTasksReleasedCount, thresholdMs, agentId },
          agentId
        );
      }

      if (updateHandoff) {
        const reconciliationNotices = candidates
          .filter(c => c.action === "RECONCILED")
          .map(
            c =>
              `[SYSTEM RECONCILIATION] Session '${c.sessionId}' aborted due to inactivity; ${c.releasedTasksCount || 0} task(s) returned to PENDING.`
          );
        updateHandoff({
          progressSummary: reconciliationNotices,
        });
      }
    }

    return {
      dryRun: !isMutation,
      thresholdMs,
      candidatesFound: candidates.length,
      reconciledCount,
      tasksReleasedCount: isMutation ? totalTasksReleasedCount : undefined,
      tasksWouldReleaseCount: !isMutation ? totalTasksWouldReleaseCount : undefined,
      releasedTaskIds: isMutation ? allReleasedTaskIds : undefined,
      wouldReleaseTaskIds: !isMutation ? allWouldReleaseTaskIds : undefined,
      candidates,
      logEvidence,
    };
  }

  /**
   * Session Registry: List sessions with optional filters (F10 - Capability 1)
   */
  public listSessions(
    state: ProjectState,
    filters?: { agentId?: string; status?: string }
  ): SessionRecord[] {
    let list = state.sessions || [];
    if (filters?.agentId) {
      list = list.filter(s => s.agentId === filters.agentId);
    }
    if (filters?.status) {
      list = list.filter(s => s.status === filters.status);
    }
    return list;
  }

  /**
   * Session Registry: Get session by ID (F10 - Capability 1)
   */
  public getSession(state: ProjectState, id: string): SessionRecord | null {
    return (state.sessions || []).find(s => s.id === id) || null;
  }

  /**
   * Derived query: Find all tasks assigned to a specific session (F12.2)
   */
  public getTasksForSession(state: ProjectState, sessionId: string): AgentTask[] {
    return (state.coordinationTasks || []).filter(t => t.assignedSessionId === sessionId);
  }

  /**
   * Derived query: Find all ADRs created during a specific session (F12.2)
   */
  public getADRsForSession(adrs: ADRRecord[], sessionId: string): ADRRecord[] {
    return adrs.filter(a => a.sessionId === sessionId);
  }

  /**
   * Derived query: Find all research records created during a specific session (F12.2)
   */
  public getResearchesForSession(researches: ResearchRecord[], sessionId: string): ResearchRecord[] {
    return researches.filter(r => r.sessionId === sessionId);
  }
}
