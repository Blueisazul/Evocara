import * as fs from "fs";
import * as path from "path";
import { StorageEngine, TaskState, RoadmapPhase, RoadmapState, OSSEvaluationRecord } from "./storage";
import {
  MasterPhaseId,
  MASTER_PHASE_ORDER,
  PHASE_DEFINITIONS,
  PhaseDefinition,
  loadMasterPromptMarkdown,
} from "./master-prompt";

export type StageStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED";

export interface DefinitionOfDoneItem {
  id: string;
  criterion: string;
  met: boolean;
}

export interface PhaseReport {
  phaseId: MasterPhaseId;
  generatedAt: string;
  summary: string;
  activitiesDone: string[];
  evidenceProduced: string[];
  pendingItems: string[];
  dodVerified: boolean;
  dodDetails: DefinitionOfDoneItem[];
  ossEvaluationEvidence?: OSSEvaluationRecord[];
}

export interface StageState {
  projectName: string;
  currentStage: MasterPhaseId; // Primary canonical property
  phaseStatus: StageStatus;
  activeGoal: string;
  activeTasks: TaskState[];
  definitionOfDone: DefinitionOfDoneItem[];
  phaseReport: PhaseReport | null;
  approvalRequired: boolean;
  approvalReceived: boolean;
  nextPhase: MasterPhaseId | null;
  lastSessionId: string | null;
  lastUpdated: string;
  roadmap?: RoadmapState;
  history: Array<{
    timestamp: string;
    phase: MasterPhaseId | string;
    action: string;
    notes?: string;
  }>;
  /** @deprecated Backward compatibility getter for currentStage */
  currentPhase?: MasterPhaseId;
}

export class StageEngine {
  private baseDir: string;
  private storage: StorageEngine;
  private stageStatePath: string;
  private reportsDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.cwd();
    this.storage = new StorageEngine(this.baseDir);
    const openmemoryDir = path.join(this.baseDir, ".openmemory");
    this.stageStatePath = path.join(openmemoryDir, "stage-state.json");
    this.reportsDir = path.join(openmemoryDir, "reports");
  }

  public ensureReportsDirectory(): void {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  private attachCompatibilityGetter(state: StageState): StageState {
    if (state && !Object.getOwnPropertyDescriptor(state, "currentPhase")) {
      Object.defineProperty(state, "currentPhase", {
        get() {
          return this.currentStage;
        },
        set(val: MasterPhaseId) {
          this.currentStage = val;
        },
        enumerable: true,
        configurable: true,
      });
    }
    return state;
  }

  /**
   * Reads or initializes current StageState
   */
  public getStageState(): StageState {
    this.storage.ensureStorageStructure();
    this.ensureReportsDirectory();

    const manifest = this.storage.getOrInitManifest();
    const existingProjectState = this.storage.getOrInitProjectState();

    let state: StageState | null = null;

    // 1. Check if legacy stage-state.json exists and compare timestamps if project-state is not updated
    let legacyState: any = null;
    if (fs.existsSync(this.stageStatePath)) {
      try {
        const raw = fs.readFileSync(this.stageStatePath, "utf-8");
        const parsed = JSON.parse(raw);
        const stageCand = parsed.currentStage || parsed.currentPhase;
        if (parsed && MASTER_PHASE_ORDER.includes(stageCand)) {
          legacyState = parsed;
          legacyState.currentStage = stageCand;
        }
      } catch (err) {
        console.warn("[StageEngine] Corrupted stage state detected during legacy check, ignoring...");
      }
    }

    // 2. Determine whether to use canonical project-state.json or legacy stage-state.json
    const projectUpdated = existingProjectState.lastUpdated ? new Date(existingProjectState.lastUpdated).getTime() : 0;
    const legacyUpdated = legacyState?.lastUpdated ? new Date(legacyState.lastUpdated).getTime() : 0;

    if (legacyState && legacyUpdated > projectUpdated && !existingProjectState.roadmap) {
      state = legacyState;
    } else if (existingProjectState.currentStage || existingProjectState.activePhase || (existingProjectState as any).currentPhase) {
      const activeStage = (existingProjectState.currentStage || existingProjectState.activePhase || (existingProjectState as any).currentPhase) as MasterPhaseId;
      const phaseDef = PHASE_DEFINITIONS[activeStage] || PHASE_DEFINITIONS["DESCUBRIR"];
      const validStageStatuses: StageStatus[] = ["NOT_STARTED", "IN_PROGRESS", "AWAITING_APPROVAL", "APPROVED", "REJECTED", "COMPLETED"];
      const phaseStatus: StageStatus = validStageStatuses.includes(existingProjectState.currentStatus as StageStatus)
        ? (existingProjectState.currentStatus as StageStatus)
        : "IN_PROGRESS";

      state = {
        projectName: manifest.projectName || "DefaultProject",
        currentStage: activeStage,
        phaseStatus: phaseStatus,
        activeGoal: existingProjectState.activeGoal || `Fase ${activeStage}: ${phaseDef.objective}`,
        activeTasks: existingProjectState.activeTasks || [],
        definitionOfDone: existingProjectState.definitionOfDone || phaseDef.definitionOfDone.map((criterion, idx) => ({
          id: `DOD-${activeStage}-${idx + 1}`,
          criterion,
          met: false,
        })),
        phaseReport: existingProjectState.phaseReport || null,
        approvalRequired: existingProjectState.approvalRequired || false,
        approvalReceived: existingProjectState.approvalReceived || false,
        nextPhase: (existingProjectState.nextPhase as any) || phaseDef.nextPhase,
        lastSessionId: existingProjectState.lastSessionId || null,
        lastUpdated: existingProjectState.lastUpdated || new Date().toISOString(),
        roadmap: existingProjectState.roadmap,
        history: existingProjectState.history || [],
      };
    } else if (legacyState) {
      state = legacyState;
    }

    // 3. Fallback default initialization if neither state exists
    if (!state) {
      const initialPhase: MasterPhaseId = "DESCUBRIR";
      const phaseDef = PHASE_DEFINITIONS[initialPhase];
      const now = new Date().toISOString();

      state = {
        projectName: manifest.projectName || "DefaultProject",
        currentStage: initialPhase,
        phaseStatus: "IN_PROGRESS",
        activeGoal: `Fase ${initialPhase}: ${phaseDef.objective}`,
        activeTasks: [],
        definitionOfDone: phaseDef.definitionOfDone.map((criterion, idx) => ({
          id: `DOD-${initialPhase}-${idx + 1}`,
          criterion,
          met: false,
        })),
        phaseReport: null,
        approvalRequired: false,
        approvalReceived: false,
        nextPhase: phaseDef.nextPhase,
        lastSessionId: null,
        lastUpdated: now,
        history: [
          {
            timestamp: now,
            phase: initialPhase,
            action: "STAGE_ENGINE_INITIALIZED",
            notes: `Project ${manifest.projectName} stage engine initialized in phase ${initialPhase}`,
          },
        ],
      };
    }

    // 4. Ensure roadmap structure is present
    if (!state.roadmap) {
      const now = state.lastUpdated || new Date().toISOString();
      const activeStage = state.currentStage;
      const activeStatus = state.phaseStatus || "IN_PROGRESS";

      state.roadmap = {
        activePhaseId: "PHASE-1",
        phases: [
          {
            id: "PHASE-1",
            name: "Fase 1: Alcance e Inicialización del Proyecto",
            description: "Fase inicial auto-migrada desde estado previo",
            status: activeStatus === "COMPLETED" ? "AWAITING_HUMAN_APPROVAL" : "IN_PROGRESS",
            currentStage: activeStage,
            stageStatus: activeStatus,
            activeGoal: state.activeGoal || "",
            activeTasks: state.activeTasks || [],
            deliverables: [],
            risksOrUncertainties: [],
            nextPhaseProposed: "PHASE-2",
            createdTimestamp: state.lastUpdated || now,
          },
        ],
        updatedAt: now,
      };
      this.saveStageState(state);
    }

    return this.attachCompatibilityGetter(state);
  }

  /**
   * Persists StageState via StorageEngine Single Writer Facade
   */
  public saveStageState(state: StageState): void {
    state.currentStage = state.currentStage || (state as any).currentPhase || "DESCUBRIR";
    state.lastUpdated = new Date().toISOString();

    if (!state.roadmap) {
      state.roadmap = {
        activePhaseId: "PHASE-1",
        phases: [
          {
            id: "PHASE-1",
            name: "Fase 1: Alcance e Inicialización del Proyecto",
            description: "Fase inicial del proyecto",
            status: state.phaseStatus === "COMPLETED" ? "AWAITING_HUMAN_APPROVAL" : "IN_PROGRESS",
            currentStage: state.currentStage,
            stageStatus: state.phaseStatus,
            activeGoal: state.activeGoal,
            activeTasks: state.activeTasks,
            deliverables: [],
            risksOrUncertainties: [],
            nextPhaseProposed: "PHASE-2",
            createdTimestamp: state.lastUpdated,
          },
        ],
        updatedAt: state.lastUpdated,
      };
    }

    const activeRoadmapPhase = state.roadmap.phases.find((p) => p.id === state.roadmap?.activePhaseId);
    if (activeRoadmapPhase) {
      activeRoadmapPhase.currentStage = state.currentStage;
      activeRoadmapPhase.stageStatus = state.phaseStatus;
      activeRoadmapPhase.activeGoal = state.activeGoal;
      activeRoadmapPhase.activeTasks = state.activeTasks;
    }

    // Delegate persistence to StorageEngine Single Writer Facade
    this.storage.saveCanonicalState(state);
  }

  /**
   * Returns current RoadmapState
   */
  public getRoadmap(): RoadmapState {
    const state = this.getStageState();
    return state.roadmap!;
  }

  /**
   * Retrieves definition for a phase
   */
  public getPhaseDefinition(phaseId?: MasterPhaseId): PhaseDefinition {
    const target = phaseId || this.getStageState().currentStage || "DESCUBRIR";
    return PHASE_DEFINITIONS[target] || PHASE_DEFINITIONS["DESCUBRIR"];
  }

  /**
   * Check if production code modifications are currently allowed
   */
  public canModifyProductionCode(): boolean {
    const state = this.getStageState();
    const activeRoadmapPhase = state.roadmap?.phases.find((p) => p.id === state.roadmap?.activePhaseId);

    // Block if RoadmapPhase is not IN_PROGRESS
    if (activeRoadmapPhase && activeRoadmapPhase.status !== "IN_PROGRESS") {
      return false;
    }

    return state.currentStage === "IMPLEMENTAR" && state.phaseStatus === "IN_PROGRESS";
  }

  /**
   * Verifies OSS evaluation records for new custom capabilities in a specific Phase context
   */
  public verifyOSSEvaluation(capabilityName?: string, phaseId?: string): { verified: boolean; record?: OSSEvaluationRecord; message: string } {
    let evals = this.storage.listOSSEvaluations();
    const state = this.getStageState();
    const targetPhaseId = phaseId || state.roadmap?.activePhaseId;

    if (evals.length === 0) {
      return {
        verified: false,
        message: "No OSS evaluation records found. Investigate existing open source solutions before building custom code.",
      };
    }

    if (targetPhaseId) {
      const phaseEvals = evals.filter((e) => !e.phaseId || e.phaseId === targetPhaseId);
      if (phaseEvals.length > 0) {
        evals = phaseEvals;
      }
    }

    const matching = capabilityName
      ? evals.find((e) => e.capabilityName.toLowerCase().includes(capabilityName.toLowerCase()))
      : evals[evals.length - 1];

    if (!matching) {
      return {
        verified: false,
        message: `No OSS evaluation record found matching capability '${capabilityName}'.`,
      };
    }

    if (matching.phaseId && targetPhaseId && matching.phaseId !== targetPhaseId) {
      return {
        verified: false,
        record: matching,
        message: `OSS evaluation record '${matching.id}' belongs to phase '${matching.phaseId}' and cannot satisfy phase '${targetPhaseId}'.`,
      };
    }

    if (matching.decision === "BUILD_CUSTOM" && !matching.customBuildJustification) {
      return {
        verified: false,
        record: matching,
        message: `OSS evaluation '${matching.id}' selected BUILD_CUSTOM but lacks required customBuildJustification.`,
      };
    }
    return {
      verified: true,
      record: matching,
      message: `OSS evaluation '${matching.id}' verified for decision '${matching.decision}'.`,
    };
  }

  /**
   * Start or resume a stage
   */
  public startStage(targetPhaseId?: MasterPhaseId): StageState {
    const state = this.getStageState();
    const desiredPhase = targetPhaseId || state.currentStage;

    if (targetPhaseId && !MASTER_PHASE_ORDER.includes(targetPhaseId)) {
      throw new Error(`MasterPhaseId inválida: '${targetPhaseId}'. Fases válidas: ${MASTER_PHASE_ORDER.join(", ")}`);
    }

    const activePhaseCheck = state.roadmap?.phases.find((p) => p.id === state.roadmap?.activePhaseId);
    if (activePhaseCheck) {
      if (activePhaseCheck.status === "AWAITING_HUMAN_APPROVAL" && desiredPhase !== state.currentStage) {
        throw new Error(`Transición no permitida: La Phase '${activePhaseCheck.id}' se encuentra en AWAITING_HUMAN_APPROVAL. Se requiere aprobación explícita para cambiar de etapa.`);
      }
      if (activePhaseCheck.status === "COMPLETED") {
        throw new Error(`Transición no permitida: La Phase '${activePhaseCheck.id}' ya fue completada.`);
      }
    }

    // Validate transition if changing phase manually
    if (desiredPhase !== state.currentStage) {
      const currentIndex = MASTER_PHASE_ORDER.indexOf(state.currentStage);
      const targetIndex = MASTER_PHASE_ORDER.indexOf(desiredPhase);

      // Prevent jumping forward without passing intermediate approval
      if (targetIndex > currentIndex + 1) {
        throw new Error(
          `Transición no permitida: No se puede saltar directamente de ${state.currentStage} a ${desiredPhase}. El ciclo debe seguir el orden secuencial.`
        );
      }
      if (targetIndex > currentIndex && !state.approvalReceived) {
        throw new Error(
          `Transición bloqueada: Para avanzar de ${state.currentStage} a ${desiredPhase} se requiere aprobación humana explícita.`
        );
      }
    }

    const phaseDef = PHASE_DEFINITIONS[desiredPhase];
    state.currentStage = desiredPhase;
    state.phaseStatus = "IN_PROGRESS";
    state.approvalRequired = false;
    state.approvalReceived = false;
    state.nextPhase = phaseDef.nextPhase;

    const activeRoadmapPhase = state.roadmap?.phases.find((p) => p.id === state.roadmap?.activePhaseId);
    if (activeRoadmapPhase && activeRoadmapPhase.status !== "COMPLETED") {
      activeRoadmapPhase.status = "IN_PROGRESS";
      activeRoadmapPhase.stageStatus = "IN_PROGRESS";
    }

    // Reset DoD for the phase if changing phase
    state.definitionOfDone = phaseDef.definitionOfDone.map((criterion: string, idx: number) => ({
      id: `DOD-${desiredPhase}-${idx + 1}`,
      criterion,
      met: false,
    }));

    state.history.push({
      timestamp: new Date().toISOString(),
      phase: desiredPhase,
      action: "STAGE_STARTED",
      notes: `Fase ${desiredPhase} iniciada`,
    });

    this.saveStageState(state);
    return state;
  }

  /**
   * Complete stage, generate phase report, verify DoD, and enter AWAITING_APPROVAL
   */
  public completeStage(reportInput: {
    summary: string;
    activitiesDone?: string[];
    evidenceProduced?: string[];
    pendingItems?: string[];
  }): StageState {
    const state = this.getStageState();
    const activeRoadmapPhaseCheck = state.roadmap?.phases.find((p) => p.id === state.roadmap?.activePhaseId);
    if (activeRoadmapPhaseCheck) {
      if (activeRoadmapPhaseCheck.status === "AWAITING_HUMAN_APPROVAL") {
        throw new Error(`Etapa no completable: La Phase '${activeRoadmapPhaseCheck.id}' se encuentra en AWAITING_HUMAN_APPROVAL. Se requiere aprobación o rechazo explícito del usuario.`);
      }
      if (activeRoadmapPhaseCheck.status === "COMPLETED") {
        throw new Error(`Etapa no completable: La Phase '${activeRoadmapPhaseCheck.id}' ya está completada.`);
      }
    }

    const phaseDef = PHASE_DEFINITIONS[state.currentStage];

    // Mark all DoD criteria as met for completed stage
    state.definitionOfDone.forEach((item: DefinitionOfDoneItem) => (item.met = true));

    const ossEvals = this.storage.listOSSEvaluations();

    const report: PhaseReport = {
      phaseId: state.currentStage,
      generatedAt: new Date().toISOString(),
      summary: reportInput.summary,
      activitiesDone: reportInput.activitiesDone || phaseDef.allowedActivities,
      evidenceProduced: reportInput.evidenceProduced || [],
      pendingItems: reportInput.pendingItems || [],
      dodVerified: true,
      dodDetails: state.definitionOfDone,
      ossEvaluationEvidence: ossEvals.length > 0 ? ossEvals : undefined,
    };

    state.phaseReport = report;
    state.phaseStatus = "AWAITING_APPROVAL";
    state.approvalRequired = true;
    state.approvalReceived = false;

    const activeRoadmapPhase = state.roadmap?.phases.find((p) => p.id === state.roadmap?.activePhaseId);

    // If completing the last stage of internal workflow (PREPARAR_CONTINUIDAD), set RoadmapPhase to AWAITING_HUMAN_APPROVAL
    if (state.currentStage === "PREPARAR_CONTINUIDAD" && activeRoadmapPhase) {
      activeRoadmapPhase.status = "AWAITING_HUMAN_APPROVAL";
      state.history.push({
        timestamp: new Date().toISOString(),
        phase: activeRoadmapPhase.id,
        action: "ROADMAP_PHASE_WORKFLOW_COMPLETED_AWAITING_HUMAN_APPROVAL",
        notes: `Fase de Roadmap ${activeRoadmapPhase.id} completó su workflow interno. Detenido en esperada de APROBACIÓN HUMANA para avanzar a la siguiente Phase.`,
      });
    } else {
      state.history.push({
        timestamp: new Date().toISOString(),
        phase: state.currentStage,
        action: "STAGE_COMPLETED_AWAITING_APPROVAL",
        notes: `Stage ${state.currentStage} completado. Esperando confirmación para avanzar a ${phaseDef.nextPhase || "FIN"}.`,
      });
    }

    // Save report artifact to .openmemory/reports/
    this.ensureReportsDirectory();
    const reportPath = path.join(this.reportsDir, `phase-${state.currentStage.toLowerCase()}-report.json`);
    this.storage.atomicWriteFileSync(reportPath, JSON.stringify(report, null, 2));

    this.saveStageState(state);
    return state;
  }

  /**
   * Request user approval for phase transition
   */
  public requestApproval(): { message: string; state: StageState } {
    const state = this.getStageState();
    const phaseDef = PHASE_DEFINITIONS[state.currentStage];
    const activeRoadmapPhase = state.roadmap?.phases.find((p) => p.id === state.roadmap?.activePhaseId);

    if (state.phaseStatus !== "AWAITING_APPROVAL") {
      state.phaseStatus = "AWAITING_APPROVAL";
      state.approvalRequired = true;
      state.approvalReceived = false;
      this.saveStageState(state);
    }

    const nextPhaseName = phaseDef.nextPhase ? PHASE_DEFINITIONS[phaseDef.nextPhase].name : "Finalización de Ciclo";

    const ossMessage = activeRoadmapPhase?.ossEvidenceId
      ? `Evidencia OSS Registrada: ${activeRoadmapPhase.ossEvidenceId}`
      : "Evidencia OSS: " + (this.storage.listOSSEvaluations().length > 0 ? "✅ Investigada" : "⚠️ No registrada");

    const message = [
      `🛑 GATE DE TRANSICIÓN HUMANA — ${activeRoadmapPhase?.id || "PHASE"} EN ESPERA DE APROBACIÓN`,
      `Fase de Roadmap: ${activeRoadmapPhase?.name || activeRoadmapPhase?.id} (Estado: ${activeRoadmapPhase?.status})`,
      `Stage del Workflow Interno: ${phaseDef.name} (${state.currentStage})`,
      `Resumen de Avances: ${state.phaseReport?.summary || "Fase completada por el agente."}`,
      `Evidencias Producidas: ${state.phaseReport?.evidenceProduced.join(", ") || "Artefactos registrados."}`,
      `Definition of Done: ${state.definitionOfDone.every((d: DefinitionOfDoneItem) => d.met) ? "✅ 100% Verificado" : "⚠️ En revisión"}`,
      `${ossMessage}`,
      `Siguiente Phase Propuesta: ${activeRoadmapPhase?.nextPhaseProposed || nextPhaseName}`,
      ``,
      `Solicitud al usuario: ¿Autorizas concluir la Phase ${activeRoadmapPhase?.id} y avanzar a la siguiente Phase del Roadmap?`,
      `Usa la herramienta openmemory_approve_stage / openmemory_approve_phase para conceder la autorización explícita.`,
    ].join("\n");

    return { message, state };
  }

  /**
   * Human Gate Approval: Approve transition to next phase
   */
  public approveStage(notes?: string): StageState {
    const state = this.getStageState();
    const currentPhaseDef = PHASE_DEFINITIONS[state.currentStage];
    const activeRoadmapPhase = state.roadmap?.phases.find((p) => p.id === state.roadmap?.activePhaseId);

    // If approving at PREPARAR_CONTINUIDAD or when RoadmapPhase is AWAITING_HUMAN_APPROVAL:
    if (state.currentStage === "PREPARAR_CONTINUIDAD" || activeRoadmapPhase?.status === "AWAITING_HUMAN_APPROVAL") {
      return this.approvePhase(undefined, notes);
    }

    if (!currentPhaseDef.nextPhase) {
      state.phaseStatus = "COMPLETED";
      state.approvalReceived = true;
      state.approvalRequired = false;
      if (activeRoadmapPhase) activeRoadmapPhase.status = "COMPLETED";
      state.history.push({
        timestamp: new Date().toISOString(),
        phase: state.currentStage,
        action: "FINAL_CYCLE_APPROVED",
        notes: notes || "Ciclo completo aprobado por el usuario.",
      });
      this.saveStageState(state);
      return state;
    }

    const nextPhaseId = currentPhaseDef.nextPhase;
    const nextPhaseDef = PHASE_DEFINITIONS[nextPhaseId];

    state.history.push({
      timestamp: new Date().toISOString(),
      phase: state.currentStage,
      action: "TRANSITION_APPROVED",
      notes: notes || `Aprobado por el usuario el paso de ${state.currentStage} a ${nextPhaseId}.`,
    });

    state.currentStage = nextPhaseId;
    state.phaseStatus = "IN_PROGRESS";
    state.activeGoal = `Fase ${nextPhaseId}: ${nextPhaseDef.objective}`;
    state.approvalRequired = false;
    state.approvalReceived = false;
    state.nextPhase = nextPhaseDef.nextPhase;
    state.phaseReport = null;

    if (activeRoadmapPhase && activeRoadmapPhase.status !== "COMPLETED") {
      activeRoadmapPhase.status = "IN_PROGRESS";
      activeRoadmapPhase.stageStatus = "IN_PROGRESS";
    }

    state.definitionOfDone = nextPhaseDef.definitionOfDone.map((criterion: string, idx: number) => ({
      id: `DOD-${nextPhaseId}-${idx + 1}`,
      criterion,
      met: false,
    }));

    this.saveStageState(state);
    return state;
  }

  /**
   * Approves transition to the next Roadmap Phase
   */
  public approvePhase(phaseId?: string, notes?: string): StageState {
    const state = this.getStageState();
    if (!state.roadmap) {
      return this.approveStage(notes);
    }

    const targetPhaseId = phaseId || state.roadmap.activePhaseId;
    const currentPhaseIdx = state.roadmap.phases.findIndex((p) => p.id === targetPhaseId);
    if (currentPhaseIdx < 0) {
      throw new Error(`Transición no permitida: La Phase '${targetPhaseId}' no existe en el Roadmap.`);
    }
    const activePhase = state.roadmap.phases[currentPhaseIdx];

    if (activePhase.status === "COMPLETED") {
      throw new Error(`Transición no permitida: La Phase '${activePhase.id}' ya fue aprobada y completada previamente.`);
    }

    activePhase.status = "COMPLETED";
    activePhase.completedTimestamp = new Date().toISOString();

    const nextPhaseNum = currentPhaseIdx + 2; // e.g. PHASE-2
    const nextPhaseId = `PHASE-${nextPhaseNum}`;

    let nextRoadmapPhase = state.roadmap.phases.find((p) => p.id === nextPhaseId);
    if (!nextRoadmapPhase) {
      nextRoadmapPhase = {
        id: nextPhaseId,
        name: `Fase ${nextPhaseNum}: Alcance Siguiente del Roadmap`,
        description: `Segunda entrega del proyecto`,
        status: "IN_PROGRESS",
        currentStage: "DESCUBRIR",
        stageStatus: "IN_PROGRESS",
        activeGoal: `Fase ${nextPhaseNum}: Ejecución de entregables`,
        activeTasks: [],
        deliverables: [],
        risksOrUncertainties: [],
        nextPhaseProposed: `PHASE-${nextPhaseNum + 1}`,
        createdTimestamp: new Date().toISOString(),
      };
      state.roadmap.phases.push(nextRoadmapPhase);
    } else {
      nextRoadmapPhase.status = "IN_PROGRESS";
      nextRoadmapPhase.currentStage = "DESCUBRIR";
      nextRoadmapPhase.stageStatus = "IN_PROGRESS";
    }

    state.roadmap.activePhaseId = nextPhaseId;
    state.currentStage = "DESCUBRIR";
    state.phaseStatus = "IN_PROGRESS";
    state.approvalRequired = false;
    state.approvalReceived = true;
    state.nextPhase = PHASE_DEFINITIONS["DESCUBRIR"].nextPhase;
    state.activeGoal = nextRoadmapPhase.activeGoal;
    state.phaseReport = null;

    state.definitionOfDone = PHASE_DEFINITIONS["DESCUBRIR"].definitionOfDone.map((criterion: string, idx: number) => ({
      id: `DOD-DESCUBRIR-${idx + 1}`,
      criterion,
      met: false,
    }));

    state.history.push({
      timestamp: new Date().toISOString(),
      phase: nextPhaseId,
      action: "ROADMAP_PHASE_TRANSITION_APPROVED",
      notes: notes || `Aprobada transición de Roadmap a ${nextPhaseId}. Workflow interno reiniciado en DESCUBRIR.`,
    });

    this.saveStageState(state);
    return state;
  }

  /**
   * Rejects transition of Roadmap Phase, placing it back in rework mode
   */
  public rejectPhase(phaseId?: string, reason?: string): StageState {
    const state = this.getStageState();
    const targetPhaseId = phaseId || state.roadmap?.activePhaseId;
    const activeRoadmapPhase = state.roadmap?.phases.find((p) => p.id === targetPhaseId);

    if (!activeRoadmapPhase) {
      throw new Error(`Transición no permitida: La Phase '${targetPhaseId}' no existe en el Roadmap.`);
    }
    if (activeRoadmapPhase.status === "COMPLETED") {
      throw new Error(`Transición no permitida: La Phase '${activeRoadmapPhase.id}' ya se encuentra completada y no puede ser rechazada.`);
    }

    activeRoadmapPhase.status = "REJECTED";
    activeRoadmapPhase.stageStatus = "REJECTED";

    state.phaseStatus = "REJECTED";
    state.approvalRequired = false;
    state.approvalReceived = false;

    state.definitionOfDone.forEach((item: DefinitionOfDoneItem) => (item.met = false));

    state.history.push({
      timestamp: new Date().toISOString(),
      phase: activeRoadmapPhase.id || state.currentStage,
      action: "ROADMAP_PHASE_TRANSITION_REJECTED",
      notes: reason || "Transición de Phase rechazada por el usuario. Retrabajo requerido.",
    });

    this.saveStageState(state);
    return state;
  }

  /**
   * Human Gate Rejection: Reject stage transition and return to stage rework
   */
  public rejectStage(reason?: string): StageState {
    return this.rejectPhase(undefined, reason);
  }

  /**
   * Starts or creates a Roadmap Phase explicitly
   */
  public startPhase(phaseId: string, name?: string, description?: string): StageState {
    const state = this.getStageState();
    if (!state.roadmap) {
      this.getStageState(); // Ensures initialization
    }

    let targetPhase = state.roadmap!.phases.find((p) => p.id === phaseId);
    if (!targetPhase) {
      const createdPhase: RoadmapPhase = {
        id: phaseId,
        name: name || `Fase ${phaseId}`,
        description: description || `Alcance de ${phaseId}`,
        status: "IN_PROGRESS",
        currentStage: "DESCUBRIR",
        stageStatus: "IN_PROGRESS",
        activeGoal: `Fase ${phaseId}: Inicialización`,
        activeTasks: [],
        deliverables: [],
        risksOrUncertainties: [],
        nextPhaseProposed: null,
        createdTimestamp: new Date().toISOString(),
      };
      targetPhase = createdPhase;
      state.roadmap!.phases.push(createdPhase);
    } else {
      targetPhase.status = "IN_PROGRESS";
    }

    state.roadmap!.activePhaseId = phaseId;
    state.currentStage = (targetPhase.currentStage as MasterPhaseId) || "DESCUBRIR";
    state.phaseStatus = "IN_PROGRESS";
    state.activeGoal = targetPhase.activeGoal;

    state.history.push({
      timestamp: new Date().toISOString(),
      phase: phaseId,
      action: "ROADMAP_PHASE_STARTED",
      notes: `Fase de Roadmap ${phaseId} iniciada`,
    });

    this.saveStageState(state);
    return state;
  }

  /**
   * Formats System Prompt Context for injection into OpenCode LLM Agent
   */
  public formatSystemPromptContext(): string {
    const state = this.getStageState();
    const phaseDef = PHASE_DEFINITIONS[state.currentStage];
    const canCode = this.canModifyProductionCode();
    const activeRoadmapPhase = state.roadmap?.phases.find((p) => p.id === state.roadmap?.activePhaseId);

    const masterPromptText = loadMasterPromptMarkdown(this.baseDir);
    const ossEvals = this.storage.listOSSEvaluations();
    const ossSummary = ossEvals.length > 0 ? `✅ Evaluaciones OSS Registradas (${ossEvals.length})` : "⚠️ Ninguna evaluación OSS registrada aún";

    return `
=================================================================
🏛️ OPENMEMORY + OPENCODE ROADMAP, PHASE & STAGE GOVERNANCE
=================================================================

[ESTADO DEL PROYECTO & ROADMAP]
Proyecto: ${state.projectName}
Phase de Roadmap Activa: ${activeRoadmapPhase?.name || activeRoadmapPhase?.id} (${activeRoadmapPhase?.id})
Estado de la Phase: ${activeRoadmapPhase?.status}
Stage del Workflow Interno: ${phaseDef.name} (${state.currentStage})
Estado del Stage: ${state.phaseStatus}
Objetivo Actual: ${state.activeGoal}
Modificación de Código de Producción Permitida: ${canCode ? "✅ SÍ (Fase IN_PROGRESS & Stage IMPLEMENTAR)" : "❌ PROHIBIDO (No estás en IMPLEMENTAR o Phase no está IN_PROGRESS)"}
Gobernanza OSS: ${ossSummary}

[ACTIVIDADES PERMITIDAS EN STAGE ${state.currentStage}]
${phaseDef.allowedActivities.map((a: string) => `• ${a}`).join("\n")}

[ACTIVIDADES PROHIBIDAS EN STAGE ${state.currentStage}]
${phaseDef.prohibitedActivities.map((p: string) => `⚠️ ${p}`).join("\n")}

[DEFINITION OF DONE DEL STAGE]
${state.definitionOfDone.map((d: DefinitionOfDoneItem) => `[${d.met ? "X" : " "}] ${d.criterion}`).join("\n")}

[REGLAS IMPERATIVAS DE GOBERNANZA]
1. AUTONOMÍA DENTRO DEL WORKFLOW INTERNO: Puedes avanzar los 12 stages operativos dentro de la Phase activa.
2. GOBERNANZA OSS OBLIGATORIA: Antes de diseñar/construir una nueva capacidad propia, investiga alternativas Open Source existentes y registra la evidencia/decisión mediante saveOSSEvaluation.
3. RESTRICCIÓN DE CÓDIGO: Si el stage actual NO es "IMPLEMENTAR" o la Phase no está "IN_PROGRESS", TIENES PROHIBIDO crear o editar código de producción.
4. HUMAN GATE DE TRANSICIÓN DE PHASE: Al terminar el workflow en PREPARAR_CONTINUIDAD, la Phase entra en AWAITING_HUMAN_APPROVAL. DEBES solicitar confirmación humana explícita antes de iniciar la siguiente Phase del Roadmap. NO avanzas automáticamente.

[RESUMEN DEL PROMPT MAESTRO]
${masterPromptText.slice(0, 1200)}...
=================================================================
`.trim();
  }
}
