import {
  AgentTask,
  ProjectState,
  TaskCycleDiagnostic,
  detectTaskGraphCycles,
} from "../types";

export type EventLogCallback = (
  eventType: string,
  payload: Record<string, unknown>,
  agentId?: string,
  sessionId?: string
) => void;

/**
 * TaskDAG Domain Module (F13.3.2-B)
 * Pure domain handler for task coordination DAG, cycle detection, state transitions, and graph repairs.
 * Does NOT perform file I/O, does NOT manage locks, does NOT persist state directly.
 */
export class TaskDAG {
  /**
   * Coordination Tasks: Create a new multi-agent task (F10 & F12.5)
   */
  public createTask(
    state: ProjectState,
    taskData: {
      title: string;
      description: string;
      createdAgentId: string;
      assignedAgentId?: string;
      dependsOn?: string[];
    },
    logEvent?: EventLogCallback
  ): AgentTask {
    let tasks = state.coordinationTasks || [];
    const now = new Date().toISOString();
    const id = `TASK-${String(tasks.length + 1).padStart(3, "0")}-${Math.random().toString(36).substring(2, 6)}`;

    const dependsOn = Array.isArray(taskData.dependsOn) ? taskData.dependsOn : undefined;

    if (dependsOn && dependsOn.length > 0) {
      for (const depId of dependsOn) {
        if (depId === id) {
          throw new Error(`Task creation rejected: task cannot depend on itself ('${depId}')`);
        }
        const exists = tasks.some(t => t.id === depId);
        if (!exists) {
          throw new Error(`Task creation rejected: dependency task '${depId}' does not exist.`);
        }
      }
    }

    const record: AgentTask = {
      id,
      title: taskData.title,
      description: taskData.description,
      status: "PENDING",
      createdAgentId: taskData.createdAgentId,
      assignedAgentId: taskData.assignedAgentId,
      createdAt: now,
      updatedAt: now,
      dependsOn: dependsOn && dependsOn.length > 0 ? dependsOn : undefined,
    };

    // Pre-persistence DFS cycle prevention (F13.1-A)
    const candidateTasks = [...tasks, record];
    const cycleDiagnostic = detectTaskGraphCycles(candidateTasks);
    if (cycleDiagnostic.hasCycle) {
      throw new Error(
        `Task creation rejected: adding task '${id}' creates a cyclic dependency graph (${cycleDiagnostic.cyclePath?.join(" -> ")})`
      );
    }

    tasks.push(record);

    // Limit coordinationTasks array to 200 max (F10 - Condition 3)
    if (tasks.length > 200) {
      const inactive = tasks.filter(t => t.status === "COMPLETED" || t.status === "FAILED" || t.status === "CANCELLED");
      inactive.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

      while (tasks.length > 200 && inactive.length > 0) {
        const purged = inactive.shift();
        if (purged) {
          tasks = tasks.filter(t => t.id !== purged.id);
          if (logEvent) {
            logEvent("task.purged", { purgedTaskId: purged.id, title: purged.title }, purged.createdAgentId);
          }
        }
      }

      while (tasks.length > 200) {
        const purged = tasks.shift();
        if (purged) {
          if (logEvent) {
            logEvent("task.purged", { purgedTaskId: purged.id, title: purged.title }, purged.createdAgentId);
          }
        }
      }
    }

    state.coordinationTasks = tasks;

    if (logEvent) {
      logEvent(
        "task.created",
        { id: record.id, title: record.title, createdAgentId: record.createdAgentId, dependsOn: record.dependsOn },
        record.createdAgentId
      );
    }
    return record;
  }

  /**
   * Coordination Tasks: List tasks with filters (F10 - Capability 3)
   */
  public listTasks(
    state: ProjectState,
    filters?: {
      status?: string;
      assignedAgentId?: string;
      createdAgentId?: string;
    }
  ): AgentTask[] {
    let list = state.coordinationTasks || [];
    if (filters?.status) {
      list = list.filter(t => t.status === filters.status);
    }
    if (filters?.assignedAgentId) {
      list = list.filter(t => t.assignedAgentId === filters.assignedAgentId);
    }
    if (filters?.createdAgentId) {
      list = list.filter(t => t.createdAgentId === filters.createdAgentId);
    }
    return list;
  }

  /**
   * Coordination Tasks: Claim a pending task atomically using session ownership authorization (F10, F12.4-A & F12.5)
   */
  public claimTask(
    state: ProjectState,
    taskId: string,
    agentId: string,
    sessionId: string,
    logEvent?: EventLogCallback
  ): { success: boolean; task?: AgentTask; reason?: string } {
    if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
      return { success: false, reason: "Missing required sessionId for claimCoordinationTask: sessionId must be provided as a non-empty string" };
    }

    const tasks = state.coordinationTasks || [];
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      return { success: false, reason: `Task '${taskId}' not found` };
    }

    if (task.status !== "PENDING") {
      return { success: false, reason: `Task '${taskId}' is currently '${task.status}', only 'PENDING' tasks can be claimed` };
    }

    // Session validation (F12.5 - Block B)
    const sessions = state.sessions || [];
    const session = sessions.find(s => s.id === sessionId);

    if (!session) {
      return { success: false, reason: `Claim authorization failed: session '${sessionId}' not found in session registry` };
    }

    if (session.agentId !== agentId) {
      return { success: false, reason: `Claim authorization failed: caller agent '${agentId}' does not match session assigned agent '${session.agentId}'` };
    }

    if (session.status !== "ACTIVE" && session.status !== "IDLE") {
      return { success: false, reason: `Claim authorization failed: session '${sessionId}' is in terminal/unauthorized status '${session.status}' (must be ACTIVE or IDLE)` };
    }

    // Task Graph Cycle Guard (F13.1-A): block claim if task is involved in a cycle
    const cycleDiagnostic = detectTaskGraphCycles(tasks);
    if (cycleDiagnostic.hasCycle && cycleDiagnostic.cyclicTaskIds.includes(taskId)) {
      return {
        success: false,
        reason: `Claim rejected: task '${taskId}' is involved in an invalid cyclic dependency graph (${cycleDiagnostic.cyclePath?.join(" -> ")}). Claim blocked until explicit graph repair.`,
      };
    }

    // Dependency validation guard (F12.5 - Block A)
    if (task.dependsOn && task.dependsOn.length > 0) {
      for (const depId of task.dependsOn) {
        const depTask = tasks.find(t => t.id === depId);
        if (!depTask) {
          return { success: false, reason: `Claim rejected: dependency task '${depId}' referenced by '${taskId}' does not exist` };
        }
        if (depTask.status !== "COMPLETED") {
          return { success: false, reason: `Claim rejected: dependency task '${depId}' is '${depTask.status}' (must be COMPLETED)` };
        }
      }
    }

    const now = new Date().toISOString();
    task.status = "IN_PROGRESS";
    task.assignedAgentId = agentId;
    task.assignedSessionId = sessionId;
    task.updatedAt = now;

    state.coordinationTasks = tasks;

    if (logEvent) {
      logEvent("task.claimed", { taskId, agentId, sessionId }, agentId, sessionId);
    }
    return { success: true, task };
  }

  /**
   * Coordination Tasks: Update coordination task status and result summary with mandatory ownership verification (F12.4-A)
   */
  public updateStatus(
    state: ProjectState,
    taskId: string,
    status: "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED",
    agentId: string,
    sessionId: string,
    resultSummary?: string,
    logEvent?: EventLogCallback
  ): AgentTask {
    const tasks = state.coordinationTasks || [];
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task with id '${taskId}' not found`);
    }

    // Terminal state protection: terminal tasks are immutable
    if (task.status === "COMPLETED" || task.status === "FAILED" || task.status === "CANCELLED") {
      throw new Error(`Task '${taskId}' is in terminal state '${task.status}' and cannot be modified.`);
    }

    // Ownership authorization protection: assignedAgentId and assignedSessionId must match
    if (task.assignedAgentId !== agentId || task.assignedSessionId !== sessionId) {
      throw new Error(
        `Ownership authorization failed for task '${taskId}': caller agent '${agentId}' / session '${sessionId}' does not match assigned agent '${task.assignedAgentId}' / session '${task.assignedSessionId}'.`
      );
    }

    const now = new Date().toISOString();
    task.status = status;
    task.updatedAt = now;
    if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
      task.completedAt = now;
    }
    if (resultSummary !== undefined) {
      task.resultSummary = resultSummary;
    }

    state.coordinationTasks = tasks;

    if (logEvent) {
      logEvent("task.updated", { taskId, status, agentId, sessionId, resultSummary }, agentId, sessionId);
    }
    return task;
  }

  /**
   * Task Graph DAG: Analyze active coordination tasks for cyclic dependencies. (F13.1-A)
   */
  public getGraphStatus(state: ProjectState): TaskCycleDiagnostic {
    const tasks = state.coordinationTasks || [];
    return detectTaskGraphCycles(tasks);
  }

  /**
   * Task Graph DAG: Explicitly repair an invalid task graph by removing a dependency edge (F13.1-A).
   */
  public removeDependency(
    state: ProjectState,
    taskId: string,
    dependencyTaskId: string,
    actorId: string,
    sessionId: string,
    repairRationale: string,
    actorRole?: "HUMAN_OPERATOR" | "LEAD_AGENT" | "WORKER_AGENT",
    logEvent?: EventLogCallback
  ): { success: boolean; task?: AgentTask; reason?: string } {
    if (!repairRationale || typeof repairRationale !== "string" || repairRationale.trim().length === 0) {
      return { success: false, reason: "Repair rejected: repairRationale is mandatory and cannot be empty." };
    }

    const tasks = state.coordinationTasks || [];
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      return { success: false, reason: `Task '${taskId}' not found.` };
    }

    if (!task.dependsOn || !task.dependsOn.includes(dependencyTaskId)) {
      return { success: false, reason: `Task '${taskId}' does not depend on '${dependencyTaskId}'.` };
    }

    // Authority Check: HUMAN_OPERATOR, LEAD_AGENT, or Task Owner
    const isOwner = task.createdAgentId === actorId || task.assignedAgentId === actorId;
    const isAuthorizedRole = actorRole === "HUMAN_OPERATOR" || actorRole === "LEAD_AGENT";

    if (!isAuthorizedRole && !isOwner) {
      return {
        success: false,
        reason: `Unauthorized repair: caller '${actorId}' (role '${actorRole || "WORKER_AGENT"}') is not authorized to repair task '${taskId}'. Must be HUMAN_OPERATOR, LEAD_AGENT, or Task Owner.`,
      };
    }

    // Form candidate tasks array with dependency removed
    const newDependsOn = task.dependsOn.filter(d => d !== dependencyTaskId);
    const updatedTask: AgentTask = {
      ...task,
      dependsOn: newDependsOn.length > 0 ? newDependsOn : undefined,
      updatedAt: new Date().toISOString(),
    };

    const candidateTasks = tasks.map(t => (t.id === taskId ? updatedTask : t));

    // Post-removal DFS cycle validation
    const postDiagnostic = detectTaskGraphCycles(candidateTasks);
    if (postDiagnostic.hasCycle) {
      return {
        success: false,
        reason: `Repair rejected: task graph remains cyclic after removing dependency '${dependencyTaskId}' (${postDiagnostic.cyclePath?.join(" -> ")}).`,
      };
    }

    // Record audit-only metadata
    if (!updatedTask.metadata) {
      updatedTask.metadata = {};
    }
    const repairedHistory = Array.isArray(updatedTask.metadata.repairedDependencies)
      ? updatedTask.metadata.repairedDependencies
      : [];
    repairedHistory.push({
      removedDependencyId: dependencyTaskId,
      repairedAt: updatedTask.updatedAt,
      repairedByActorId: actorId,
      repairedInSessionId: sessionId,
      actorRole: actorRole || (isOwner ? "TASK_OWNER" : "WORKER_AGENT"),
      rationale: repairRationale,
    });
    updatedTask.metadata.repairedDependencies = repairedHistory;

    // Persist updated task array in state tree
    state.coordinationTasks = candidateTasks;

    if (logEvent) {
      logEvent(
        "task.dependency_repaired",
        {
          taskId,
          removedDependencyId: dependencyTaskId,
          actorId,
          sessionId,
          actorRole,
          rationale: repairRationale,
        },
        actorId,
        sessionId
      );
    }

    return { success: true, task: updatedTask };
  }

  /**
   * Task Graph DAG: Add a dependency edge to an existing coordination task (F13.1-A).
   */
  public addDependency(
    state: ProjectState,
    taskId: string,
    dependencyTaskId: string,
    actorId: string,
    sessionId: string,
    logEvent?: EventLogCallback
  ): { success: boolean; task?: AgentTask; reason?: string } {
    const tasks = state.coordinationTasks || [];
    const task = tasks.find(t => t.id === taskId);

    if (!task) {
      return { success: false, reason: `Task '${taskId}' not found.` };
    }

    if (taskId === dependencyTaskId) {
      return { success: false, reason: `Task dependency rejected: task cannot depend on itself ('${taskId}')` };
    }

    const depTask = tasks.find(t => t.id === dependencyTaskId);
    if (!depTask) {
      return { success: false, reason: `Dependency task '${dependencyTaskId}' does not exist.` };
    }

    const currentDeps = task.dependsOn || [];
    if (currentDeps.includes(dependencyTaskId)) {
      return { success: true, task }; // Already dependent
    }

    const newDependsOn = [...currentDeps, dependencyTaskId];
    const updatedTask: AgentTask = {
      ...task,
      dependsOn: newDependsOn,
      updatedAt: new Date().toISOString(),
    };

    const candidateTasks = tasks.map(t => (t.id === taskId ? updatedTask : t));

    // DFS Cycle Prevention
    const diagnostic = detectTaskGraphCycles(candidateTasks);
    if (diagnostic.hasCycle) {
      return {
        success: false,
        reason: `Task dependency rejected: adding dependency '${dependencyTaskId}' creates a cyclic graph (${diagnostic.cyclePath?.join(" -> ")})`,
      };
    }

    state.coordinationTasks = candidateTasks;

    if (logEvent) {
      logEvent("task.dependency_added", { taskId, dependencyTaskId, actorId, sessionId }, actorId, sessionId);
    }

    return { success: true, task: updatedTask };
  }
}
