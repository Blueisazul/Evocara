import type { Plugin } from "@opencode-ai/plugin" with { "resolution-mode": "import" };
import * as fs from "fs";
import * as path from "path";
import { StorageEngine } from "./storage";
import { StageEngine } from "./stage-engine";

/**
 * Official OpenMemory OpenCode Lifecycle Plugin (v0.1.0 + Stage Governance)
 *
 * Integrates OpenCode native session lifecycle events (session.created, session.idle, session.compacted)
 * with OpenMemory's zero-dependency StorageEngine & Master Prompt StageEngine.
 *
 * Principles:
 * 1. Zero Core Modification.
 * 2. Non-Destructive Storage Management.
 * 3. Atomic Disk Persistence.
 * 4. Master Prompt Governance & Human Gate Enforcement.
 */
export const OpenMemoryPlugin: Plugin = async ({ client, project, $, directory, worktree }) => {
  const rootDir = directory || worktree || process.cwd();
  const storage = new StorageEngine(rootDir);
  const stageEngine = new StageEngine(rootDir);

  // Initialize storage structure non-destructively on plugin load
  storage.ensureStorageStructure();
  stageEngine.getStageState();
  const manifest = storage.getOrInitManifest();

  // Cleanup orphaned temp files on plugin startup
  const cleanedTempFiles = storage.cleanupTempFiles();

  storage.logEvent("plugin.initialized", {
    message: "Official OpenMemory Plugin with Master Prompt Stage Engine loaded",
    project: project || manifest.projectName || "OpenMemory",
    cleanedTempFiles,
  });

  return {
    // -------------------------------------------------------------
    // PLUGIN DISPOSE HOOK (F12.3-D)
    // Non-mutating cleanup telemetry. ZERO session status mutation.
    // -------------------------------------------------------------
    dispose: async () => {
      storage.logEvent("plugin.disposed", { timestamp: new Date().toISOString() });
    },

    // -------------------------------------------------------------
    // PROGRESSIVE ENHANCEMENT: experimental.chat.system.transform
    // Injects Master Prompt Governance & Knowledge Index summary into system prompt.
    // Mutates output.system in-place as expected by OpenCode Hooks API.
    // -------------------------------------------------------------
    "experimental.chat.system.transform": async (
      input: { sessionID?: string; model?: any },
      output?: { system: string[] }
    ) => {
      try {
        const knowledgeIndex = storage.formatKnowledgeIndexSummary();
        const stagePromptContext = stageEngine.formatSystemPromptContext();
        const combinedContext = `${stagePromptContext}\n\n${knowledgeIndex}`;

        if (output && Array.isArray(output.system)) {
          output.system.push(combinedContext);
        }
        storage.logEvent("experimental.chat.system.transform", {
          message: "Injected Stage Engine Governance & Knowledge Index into system prompt",
          sessionID: input?.sessionID,
        });
      } catch (err) {
        console.warn("[OpenMemory Plugin] experimental.chat.system.transform fallback triggered:", err);
      }
    },

    // -------------------------------------------------------------
    // PROGRESSIVE ENHANCEMENT: experimental.session.compacting
    // Safely appends handoff context, stage state, and Knowledge Index summary.
    // Mutates output.context / output.prompt in-place as expected by OpenCode Hooks API.
    // -------------------------------------------------------------
    "experimental.session.compacting": async (
      input: { sessionID?: string; prompt?: string },
      output?: { context: string[]; prompt?: string }
    ) => {
      try {
        const handoffContent = storage.getOrInitHandoff();
        const knowledgeIndex = storage.formatKnowledgeIndexSummary();
        const stageState = stageEngine.getStageState();
        const injectedContext = `[OpenMemory Context Handoff] - Fase ${stageState.currentPhase}\n${handoffContent}\n\n${knowledgeIndex}`;

        if (output) {
          if (Array.isArray(output.context)) {
            output.context.push(injectedContext);
          }
          const basePrompt = output.prompt || input?.prompt || "";
          output.prompt = basePrompt ? `${basePrompt}\n\n${injectedContext}` : injectedContext;
        }

        storage.logEvent("experimental.session.compacting", {
          message: "Injected handoff, stage state, and knowledge index into compaction context",
          handoffWords: handoffContent.split(/\s+/).length,
          currentPhase: stageState.currentPhase,
        });
      } catch (err) {
        console.warn("[OpenMemory Plugin] experimental.session.compacting fallback triggered:", err);
      }
    },

    // -------------------------------------------------------------
    // EVENT STREAM LISTENER (F12.3-D Session Lifecycle Synchronization)
    // Stateless per-event session identity resolution with StorageEngine facade.
    // -------------------------------------------------------------
    event: async ({ event }: { event: { type: string; [key: string]: unknown } }) => {
      const eventType = event.type;
      const props = ((event as any).properties || event) as Record<string, any>;

      // -------------------------------------------------------------
      // HOOK 1: session.created -> registerSession(ACTIVE)
      // Canonical identity extraction path: event.properties.info.id
      // -------------------------------------------------------------
      if (eventType === "session.created") {
        const sessionId = props?.info?.id;
        if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
          storage.logEvent("session.identity_missing", { eventType, eventPayload: event });
          return;
        }

        // 1. Register canonical session in StorageEngine session registry
        storage.registerSession({
          id: sessionId,
          agentId: "opencode",
          status: "ACTIVE",
        });

        // 2. Legacy top-level ProjectState updates for backwards compatibility
        const currentState = storage.getOrInitProjectState();
        const stageState = stageEngine.getStageState();

        const isRecovery = currentState.sessionRunCount > 1;
        currentState.activePhase = stageState.currentPhase;
        currentState.activeGoal = stageState.activeGoal || currentState.activeGoal;

        if (currentState.activeTasks && currentState.activeTasks.length > 0 && (!stageState.activeTasks || stageState.activeTasks.length === 0)) {
          stageState.activeTasks = currentState.activeTasks;
        } else if (stageState.activeTasks && stageState.activeTasks.length > 0) {
          currentState.activeTasks = stageState.activeTasks;
        }

        stageState.lastSessionId = sessionId;
        stageEngine.saveStageState(stageState);

        currentState.currentStatus = "SESSION_ACTIVE";
        storage.saveProjectState(currentState);

        const handoffContent = storage.getOrInitHandoff();
        const contextSummary = storage.formatProjectContextSummary();

        storage.logEvent(
          "session.created",
          {
            sessionId,
            sessionRunCount: currentState.sessionRunCount,
            activePhase: stageState.currentPhase,
            isRecovery,
            handoffWords: handoffContent.split(/\s+/).length,
            contextSummary,
            eventPayload: event,
          },
          "opencode",
          sessionId
        );
        return;
      }

      // -------------------------------------------------------------
      // HOOK 2: session.status -> busy (ACTIVE) / idle (IDLE) / retry (refresh lastActiveAt)
      // Canonical identity extraction path: event.properties.sessionID
      // -------------------------------------------------------------
      if (eventType === "session.status") {
        const sessionId = props?.sessionID;
        if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
          storage.logEvent("session.identity_missing", { eventType, eventPayload: event });
          return;
        }

        const sess = storage.getSession(sessionId);
        if (!sess) {
          storage.logEvent("session.not_found", { eventType, sessionId });
          return;
        }

        const TERMINAL_STATES = ["COMPLETED", "FAILED", "ABORTED"];
        if (TERMINAL_STATES.includes(sess.status)) {
          storage.logEvent("session.terminal_ignored", { eventType, sessionId, status: sess.status });
          return;
        }

        const statusType = props?.status?.type;
        if (statusType === "busy") {
          storage.updateSessionStatus(sessionId, "ACTIVE");
        } else if (statusType === "idle") {
          storage.updateSessionStatus(sessionId, "IDLE");
        } else if (statusType === "retry") {
          // Touch lastActiveAt without mutating logical SessionStatus
          storage.updateSessionStatus(sessionId, sess.status);
        }
        return;
      }

      // -------------------------------------------------------------
      // HOOK 3: session.idle -> IDLE
      // Canonical identity extraction path: event.properties.sessionID
      // -------------------------------------------------------------
      if (eventType === "session.idle") {
        const sessionId = props?.sessionID;
        if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
          storage.logEvent("session.identity_missing", { eventType, eventPayload: event });
          return;
        }

        const sess = storage.getSession(sessionId);
        if (sess) {
          const TERMINAL_STATES = ["COMPLETED", "FAILED", "ABORTED"];
          if (!TERMINAL_STATES.includes(sess.status)) {
            storage.updateSessionStatus(sessionId, "IDLE");
          }
        }

        // Legacy top-level state checkpoint update
        const currentState = storage.getOrInitProjectState();
        if (currentState.currentStatus !== "IDLE_CHECKPOINT_SAVED") {
          currentState.currentStatus = "IDLE_CHECKPOINT_SAVED";
          storage.saveProjectState(currentState);
        }

        // Auto handoff on idle if configured
        const manifest = storage.getOrInitManifest();
        if (manifest.config.autoHandoffOnIdle !== false) {
          const stageState = stageEngine.getStageState();
          const activePhase =
            currentState.activePhase ||
            stageState.currentPhase ||
            currentState.roadmap?.phases.find((p) => p.id === currentState.roadmap?.activePhaseId)?.name ||
            currentState.roadmap?.activePhaseId ||
            "Fase 1";
          const activeGoal = stageState.activeGoal || currentState.activeGoal || "Inicialización del proyecto";
          const completedTasks = (stageState.activeTasks || [])
            .filter((t) => t.status === "COMPLETED")
            .map((t) => `${t.id}: ${t.description}`);

          storage.updateHandoff(
            {
              activeGoal,
              activePhase,
              progressSummary:
                completedTasks.length > 0
                  ? completedTasks
                  : [`Fase activa: ${stageState.currentPhase} (${stageState.phaseStatus})`],
              nextSteps: [
                stageState.approvalRequired
                  ? `Solicitar aprobación del usuario para pasar a la siguiente fase (${stageState.nextPhase || "FIN"}).`
                  : `Completar entregables y DoD de la fase ${stageState.currentPhase}.`,
              ],
            },
            "opencode",
            sessionId
          );
        }

        storage.logEvent("session.idle", { checkpointSaved: true, eventPayload: event }, "opencode", sessionId);
        return;
      }

      // -------------------------------------------------------------
      // HOOK 4: session.compacted -> milestone update
      // Canonical identity extraction path: event.properties.sessionID
      // -------------------------------------------------------------
      if (eventType === "session.compacted") {
        const sessionId = props?.sessionID;
        if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
          storage.logEvent("session.identity_missing", { eventType, eventPayload: event });
          return;
        }

        // Updates compactionCount, lastCompactedAt, preserves ACTIVE/IDLE status
        storage.updateSessionStatus(sessionId, "COMPACTED");

        // Legacy compaction handoff & evidence generation
        const currentState = storage.getOrInitProjectState();
        const stageState = stageEngine.getStageState();

        currentState.currentStatus = "COMPACTION_CHECKPOINT_SAVED";
        storage.saveProjectState(currentState);

        const completedTasks = (stageState.activeTasks || [])
          .filter((t) => t.status === "COMPLETED")
          .map((t) => `${t.id}: ${t.description}`);

        const inProgressTasks = (stageState.activeTasks || [])
          .filter((t) => t.status !== "COMPLETED")
          .map((t) => `${t.id}: ${t.description}`);

        const projectNameStr = typeof project === "string" ? project : (project as any)?.name || (stageState.projectName !== "OpenMemory" ? stageState.projectName : undefined);
        const isInternalOpenMemoryProject = Boolean(typeof projectNameStr === "string" && projectNameStr.toLowerCase().includes("openmemory"));

        const baselineProgress = isInternalOpenMemoryProject
          ? ["F3.1 Storage Engine, F3.2 Plugin, and F3.3 Handoff Engine active."]
          : [];

        const progressSummary = [
          ...baselineProgress,
          ...(completedTasks.length > 0
            ? completedTasks
            : [`Fase activa: ${stageState.currentPhase} (${stageState.phaseStatus})`]),
        ];

        storage.updateHandoff(
          {
            activeGoal: stageState.activeGoal || currentState.activeGoal,
            activePhase: stageState.currentPhase,
            progressSummary,
            nextSteps:
              inProgressTasks.length > 0
                ? inProgressTasks
                : [
                    stageState.approvalRequired
                      ? `Solicitar aprobación del usuario para pasar a la siguiente fase (${stageState.nextPhase || "FIN"}).`
                      : `Completar entregables y DoD de la fase ${stageState.currentPhase}.`,
                  ],
          },
          "opencode",
          sessionId
        );

        try {
          const evidenceDir = path.join(rootDir, ".work", "evidence");
          if (!fs.existsSync(evidenceDir)) {
            fs.mkdirSync(evidenceDir, { recursive: true });
          }
          const compactionEvidenceFile = path.join(evidenceDir, "opencode-compaction-payload.json");
          fs.writeFileSync(
            compactionEvidenceFile,
            JSON.stringify(
              {
                observedAt: new Date().toISOString(),
                eventType: "session.compacted",
                payload: event,
              },
              null,
              2
            ),
            "utf-8"
          );
        } catch (err) {
          console.error("[OpenMemory Plugin] Failed to write compaction evidence:", err);
        }

        storage.logEvent("session.compacted", { eventPayload: event, compactionHandled: true, handoffUpdated: true }, "opencode", sessionId);
        return;
      }

      // -------------------------------------------------------------
      // HOOK 5: session.updated -> touch lastActiveAt if active/idle
      // Canonical identity extraction path: event.properties.info.id
      // -------------------------------------------------------------
      if (eventType === "session.updated") {
        const sessionId = props?.info?.id;
        if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
          storage.logEvent("session.identity_missing", { eventType, eventPayload: event });
          return;
        }

        const sess = storage.getSession(sessionId);
        if (sess) {
          const TERMINAL_STATES = ["COMPLETED", "FAILED", "ABORTED"];
          if (!TERMINAL_STATES.includes(sess.status)) {
            storage.updateSessionStatus(sessionId, sess.status);
          }
        }
        storage.logEvent("session.updated", { eventPayload: event }, "opencode", sessionId);
        return;
      }

      // -------------------------------------------------------------
      // HOOK 6: session.deleted -> telemetry log ONLY (ZERO status mutation)
      // Canonical identity extraction path: event.properties.info.id
      // -------------------------------------------------------------
      if (eventType === "session.deleted") {
        const sessionId = props?.info?.id;
        if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
          storage.logEvent("session.identity_missing", { eventType, eventPayload: event });
          return;
        }
        storage.logEvent("session.deleted", { info: props?.info }, "opencode", sessionId);
        return;
      }

      // -------------------------------------------------------------
      // HOOK 7: session.error -> telemetry log ONLY (ZERO status mutation to FAILED)
      // Canonical identity extraction path: event.properties.sessionID
      // -------------------------------------------------------------
      if (eventType === "session.error") {
        const sessionId = props?.sessionID;
        storage.logEvent("session.error", { error: props?.error, sessionID: sessionId }, "opencode", typeof sessionId === "string" ? sessionId : undefined);
        return;
      }
    },
  };
};

export default OpenMemoryPlugin;
