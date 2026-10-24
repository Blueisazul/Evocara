import { MasterPhaseId, MASTER_PHASE_ORDER } from "../master-prompt";

export interface OpenMemoryManifest {
  version: string;
  projectName: string;
  createdAt: string;
  updatedAt: string;
  config: {
    autoHandoffOnCompaction: boolean;
    autoHandoffOnIdle: boolean;
    maxHandoffWords: number;
    nonDestructiveAgentsMd: boolean;
  };
}

export interface TaskState {
  id: string;
  description: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
}

export type SessionStatus =
  | "ACTIVE"
  | "IDLE"
  | "COMPLETED"
  | "FAILED"
  | "ABORTED";

export interface SessionProvenanceSnapshot {
  workflowStageAtCreation?: MasterPhaseId;
  roadmapPhaseAtCreation?: string;
}

export interface SessionRecord {
  id: string;
  agentId: string;
  hostId?: string;
  status: SessionStatus;
  startedAt: string;
  lastActiveAt: string;
  completedAt?: string;
  lastCompactedAt?: string;
  compactionCount?: number;
  provenance?: SessionProvenanceSnapshot;
  metadata?: Record<string, unknown>;
}

export type SessionRecordV2 = SessionRecord;

export interface ReconcileOptions {
  thresholdMs: number;
  dryRun?: boolean;
  confirm?: boolean;
  maxLimit?: number;
  agentId?: string;
}

export interface ReconcileCandidate {
  sessionId: string;
  agentId: string;
  hostId?: string;
  lastActiveAt: string;
  inactiveDurationMs: number;
  action: "WOULD_RECONCILE" | "RECONCILED" | "SKIPPED";
  releasedTasksCount?: number;
  releasedTaskIds?: string[];
  wouldReleaseTasksCount?: number;
  wouldReleaseTaskIds?: string[];
}

export interface ReconcileResult {
  dryRun: boolean;
  thresholdMs: number;
  candidatesFound: number;
  reconciledCount: number;
  tasksReleasedCount?: number;
  tasksWouldReleaseCount?: number;
  releasedTaskIds?: string[];
  wouldReleaseTaskIds?: string[];
  candidates: ReconcileCandidate[];
  logEvidence: string[];
}

export interface AgentTask {
  id: string;
  title: string;
  description: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  assignedAgentId?: string;
  assignedSessionId?: string;
  createdAgentId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  resultSummary?: string;
  metadata?: Record<string, any>;
  dependsOn?: string[];
}

export interface CrossAgentContextSummary {
  timestamp: string;
  requestingAgentId: string;
  queryTopic?: string;
  activeSessionsCount: number;
  sessions: SessionRecord[];
  researchesCount: number;
  researches: ResearchRecord[];
  adrsCount: number;
  adrs: ADRRecord[];
  handoffNarrative: string;
  assembledContextMarkdown: string;
}

export interface ProjectState {
  version?: string;
  currentStage?: MasterPhaseId;
  currentStatus: string;
  activeGoal: string;
  activeTasks: TaskState[];
  sessionRunCount: number;
  lastSessionId: string | null;
  lastUpdated: string;
  definitionOfDone?: any[];
  phaseReport?: any | null;
  approvalRequired?: boolean;
  approvalReceived?: boolean;
  nextPhase?: string | null;
  roadmap?: RoadmapState;
  sessions?: SessionRecord[];
  coordinationTasks?: AgentTask[];
  history?: Array<{
    timestamp: string;
    phase: string;
    action: string;
    notes?: string;
  }>;
  activePhase?: string;
  currentPhase?: string;
}

export interface HandoffSection {
  title: string;
  content: string;
  isAutoOwned: boolean;
}

export interface ADRVote {
  agentId: string;
  sessionId?: string;
  decision: "APPROVE" | "REJECT";
  timestamp: string;
  rationale?: string;
}

export interface ADRRecord {
  id: string;
  title: string;
  status?: "PROPOSED" | "IN_REVIEW" | "ACCEPTED" | "REJECTED" | "SUPERSEDE" | "DEPRECATED";
  date: string;
  context: string;
  decision: string;
  consequences?: string;
  proposedByAgentId?: string;
  requiredVotes?: number;
  votes?: ADRVote[];
  sessionId?: string;
}

export interface BackupMetadata {
  id: string;
  timestamp: string;
  label: string;
  filesCount: number;
  backupPath: string;
}

export interface DiagnosticCheck {
  name: string;
  passed: boolean;
  details: string;
  subsystem?: string;
  repaired?: boolean;
}

export interface DiagnosticReport {
  status: "HEALTHY" | "REPAIRED" | "CORRUPTED" | "UNKNOWN";
  timestamp: string;
  checks: DiagnosticCheck[];
  orphanedTempFilesRemoved: number;
  subsystems?: Record<string, { status: "PASS" | "WARN" | "FAIL"; checksCount: number }>;
  quarantineCount?: number;
  activeLocksCount?: number;
  tornLogLinesCount?: number;
  sqliteQuiescent?: boolean;
}

export type HealthSeverity = "HEALTHY" | "DEGRADED" | "CORRUPTED" | "UNKNOWN";

export interface ConsolidatedHealthReport {
  overallStatus: HealthSeverity;
  timestamp: string;
  storage: {
    status: "HEALTHY" | "REPAIRED" | "CORRUPTED" | "UNKNOWN";
    orphanedTempFilesRemoved: number;
    subsystems?: Record<string, { status: "PASS" | "WARN" | "FAIL"; checksCount: number }>;
  };
  sqliteLifecycle: {
    quiescent: boolean;
    managedCount: number;
    activeDatabases: string[];
  };
  advisoryLocks: {
    total: number;
    active: number;
    stale: number;
    deadProcessLocks: number;
  };
  healthCoordinator: {
    running: boolean;
    enabled: boolean;
    intervalMs?: number;
    lastExecutionAt?: string;
    totalExecutions: number;
    totalFailures: number;
    totalSkippedDueToOverlap: number;
  };
  promotion: {
    isInterrupted: boolean;
    lastOperationId?: string;
    lastState?: string;
    lastCommittedAt?: string;
  };
  candidateArtifact: {
    version: string;
    present: boolean;
    sha256?: string;
    sizeBytes?: number;
    role?: "QUALIFIED_RELEASE_CANDIDATE" | "PRESERVED_HISTORICAL_BASELINE" | "CUSTOM_ARTIFACT";
    status?: "PRESENT" | "INTEGRITY_VERIFIED" | "UNVERIFIED" | "MISSING";
  };
}

export type KnowledgeItemType = "SOURCE" | "REPOSITORY" | "FINDING";

export type KnowledgeClassification =
  | "FACT"
  | "OBSERVATION"
  | "FINDING"
  | "HYPOTHESIS"
  | "CONCLUSION";

export interface ProvenanceMetadata {
  url?: string;
  repository?: string;
  commit?: string;
  version?: string;
  agentId?: string;
  sessionId?: string;
  toolName?: string;
  timestamp?: string;
}

export type KnowledgeLifecycleState =
  | "LEGACY_UNEVALUATED"
  | "CREATED"
  | "VALIDATED"
  | "ACCEPTED"
  | "SUPERSEDED"
  | "DEPRECATED";

export type AcceptanceBasis =
  | "EVIDENCE_VALIDATED"
  | "OPERATIONAL_ADOPTION";

export type ActorRole =
  | "HUMAN_OPERATOR"
  | "LEAD_AGENT"
  | "WORKER_AGENT"
  | "SYSTEM_AUDITOR";

export interface KnowledgeEvaluation {
  evaluatedByAgentId: string;
  evaluatedInSessionId: string;
  evaluatedAt: string;
  evaluationRationale: string;
  acceptanceBasis: AcceptanceBasis;
  evidenceReference?: string;
  actorRole?: ActorRole;
}

export interface KnowledgeItem {
  id: string;
  type: KnowledgeItemType;
  classification: KnowledgeClassification;
  title: string;
  content: string;
  provenance: ProvenanceMetadata;
  tags?: string[];
  lifecycleState?: KnowledgeLifecycleState;
  evaluation?: KnowledgeEvaluation;
  validatedAt?: string;
  acceptedAt?: string;
  supersededAt?: string;
  deprecatedAt?: string;
  // Bi-temporal dimensions (Hito G30):
  validFrom?: string;          // ISO 8601 UTC: Domain validity start (inclusive)
  validUntil?: string;         // ISO 8601 UTC: Domain validity end (exclusive). null/undefined = open-ended
  recordedAt?: string;         // ISO 8601 UTC: System transaction time when recorded in Evocara
  supersededAtSystem?: string; // ISO 8601 UTC: System transaction time when supersession was recorded
}

export type KnowledgeRelationType =
  | "SUPPORTS"
  | "CONTRADICTS"
  | "SUPERSEDES"
  | "DERIVED_FROM"
  | "QUALIFIES";

export interface KnowledgeRelation {
  id: string;
  relationType: KnowledgeRelationType;
  sourceItemId: string;
  targetItemId: string;
  targetResearchRecordId?: string;
  rationale?: string;
  createdAt: string;
  provenance: ProvenanceMetadata;
  // Bi-temporal dimensions (Hito G30):
  validFrom?: string;
  validUntil?: string;
  recordedAt?: string;
}

export type DerivedConflictState = "CONSISTENT" | "CONFLICTED" | "UNRESOLVED";

export type DerivedLineageStatus =
  | "NONE"
  | "SUPERSEDING"
  | "SUPERSEDED_BY_ACCEPTED_SOURCE";

export interface KnowledgeItemTMSView {
  itemId: string;
  researchRecordId: string;
  canonicalLifecycleState: KnowledgeLifecycleState;
  derivedConflictState: DerivedConflictState;
  derivedLineageStatus: DerivedLineageStatus;
  isDegraded?: boolean;
  diagnostics: string[];
  relations: Array<KnowledgeRelation & {
    owningResearchRecordId: string;
    targetStatus: "EXISTS" | "TARGET_NOT_FOUND";
    isSymmetric?: boolean;
  }>;
}

export interface TMSAnalysisResult {
  overallStatus: "CONSISTENT" | "CONFLICTED" | "UNRESOLVED" | "DEGRADED";
  diagnostics: string[];
  items: Record<string, KnowledgeItemTMSView>;
  summary: {
    totalItems: number;
    totalRelations: number;
    consistentCount: number;
    conflictedCount: number;
    unresolvedCount: number;
    degradedCount: number;
    targetNotFoundCount: number;
  };
}

export interface ResearchRecord {
  id: string;
  topic: string;
  category: string;
  summary: string;
  status: "DRAFT" | "COMPLETED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  sessionId: string;
  agentId: string;
  items: KnowledgeItem[];
  relations?: KnowledgeRelation[];
  relatedAdrId?: string;
}

export interface ResearchFilter {
  researchId?: string;
  topic?: string;
  category?: string;
  status?: ResearchRecord["status"];
  itemType?: KnowledgeItemType;
  classification?: KnowledgeClassification;
  lifecycleState?: KnowledgeLifecycleState;
  agentId?: string;
  sessionId?: string;
  query?: string;
  minScore?: number;
  limit?: number;
  projectId?: string;
  scope?: string;
  includeObsolete?: boolean;
  // Bi-temporal point-in-time query parameters (Hito G30):
  asOfValidTime?: string;      // Domain valid time point (ISO 8601 string)
  asOfSystemTime?: string;     // System transaction time point (ISO 8601 string)
  strictTemporal?: boolean;    // If true, items without explicit validity windows are excluded
}

export type EpistemicStatus =
  | "VERIFIED_FACT"
  | "WORKING_HYPOTHESIS"
  | "UNVALIDATED_OBSERVATION"
  | "HISTORICAL_DECISION";

export function getEpistemicStatus(item: KnowledgeItem): EpistemicStatus {
  if (!item) return "UNVALIDATED_OBSERVATION";
  const state = item.lifecycleState || "LEGACY_UNEVALUATED";
  if (state === "SUPERSEDED" || state === "DEPRECATED") {
    return "HISTORICAL_DECISION";
  }
  const hasEvidence = Boolean(
    item.evaluation?.evidenceReference &&
    typeof item.evaluation.evidenceReference === "string" &&
    item.evaluation.evidenceReference.trim().length >= 3
  );
  const isAcceptedOrValidated = state === "ACCEPTED" || state === "VALIDATED";
  const isFactOrConclusion =
    item.classification === "FACT" ||
    item.classification === "CONCLUSION" ||
    (item as any).type === "DECISION";

  if (isAcceptedOrValidated && (hasEvidence || state === "ACCEPTED") && isFactOrConclusion) {
    return "VERIFIED_FACT";
  }
  if (item.classification === "HYPOTHESIS" || state === "CREATED") {
    return "WORKING_HYPOTHESIS";
  }
  return "UNVALIDATED_OBSERVATION";
}

export interface SupersedeKnowledgeParams {
  oldItemId: string;
  newItem: {
    id?: string;
    title: string;
    content: string;
    type?: KnowledgeItemType;
    classification?: KnowledgeClassification;
    tags?: string[];
    evidenceReference?: string;
    provenance?: ProvenanceMetadata;
    validFrom?: string;        // Domain validity start of new decision (ISO 8601)
    validUntil?: string;       // Domain validity end (null/undefined for open-ended)
    recordedAt?: string;       // System transaction time (defaults to now)
  };
  effectiveDate?: string;      // Domain effective date of supersession (defaults to validFrom or now)
  recordedAt?: string;         // System transaction time of supersession (defaults to now)
  researchId?: string;
  topic?: string;
  category?: string;
  evaluationRationale: string;
  evidenceReference?: string;
  actorRole?: ActorRole;
  agentId: string;
  sessionId: string;
}

export interface SupersedeKnowledgeResult {
  success: boolean;
  reason?: string;
  supersededItemId?: string;
  newItemId?: string;
  researchId?: string;
  relationId?: string;
  effectiveDate?: string;
  recordedAt?: string;
}

export interface PointInTimeQueryParams {
  asOfValidTime?: string;      // Domain valid time point (ISO 8601 string)
  asOfSystemTime?: string;     // System transaction time point (ISO 8601 string)
  query?: string;
  category?: string;
  itemType?: KnowledgeItemType;
  classification?: KnowledgeClassification;
  projectId?: string;
  scope?: string;
  minScore?: number;
  limit?: number;
  strictTemporal?: boolean;
}

export interface PointInTimeItemResult {
  item: KnowledgeItem;
  researchId: string;
  topic: string;
  score?: number;
  effectiveLifecycleState: KnowledgeLifecycleState;
  effectiveEpistemicStatus: EpistemicStatus;
  validityWindow: {
    validFrom?: string;
    validUntil?: string;
    isOpenEnded: boolean;
  };
  knownAtSystemTime: boolean;
  supersededAtSystemTime: boolean;
}

export interface PointInTimeQueryResult {
  asOfValidTime: string;
  asOfSystemTime: string;
  queryTimestamp: string;
  items: PointInTimeItemResult[];
  confidence: "HIGH" | "INCONCLUSIVE" | "UNANSWERABLE";
  unanswerableReason?: string;
  summary: string;
  activeContradictions?: LineageContradiction[];
  activeAlerts?: string[];
}

export interface RetroactiveCorrectionParams {
  itemId: string;
  correctedValidFrom?: string;
  correctedValidUntil?: string;
  correctedTitle?: string;
  correctedContent?: string;
  correctionRationale: string;
  evidenceReference?: string;
  agentId: string;
  sessionId: string;
  actorRole?: ActorRole;
}

export interface RetroactiveCorrectionResult {
  success: boolean;
  reason?: string;
  originalItemId?: string;
  correctedItemId?: string;
  relationId?: string;
  recordedAt?: string;
  researchId?: string;
}

export interface TemporalContradictionReport {
  contradictionsFound: number;
  diagnostics: string[];
  overlappingPairs: Array<{
    sourceItemId: string;
    targetItemId: string;
    overlapFrom: string;
    overlapUntil: string;
    reason: string;
  }>;
}

// =============================================================================
// G31: Causal Lineage, Temporal Contradictions & Decision Synthesis Types
// =============================================================================

export interface LineageNode {
  itemId: string;
  researchRecordId: string;
  topic?: string;
  title: string;
  type: KnowledgeItemType;
  classification: KnowledgeClassification;
  lifecycleState: KnowledgeLifecycleState;
  epistemicStatus: EpistemicStatus;
  validityWindow: {
    validFrom?: string;
    validUntil?: string;
    isOpenEnded: boolean;
  };
  recordedAt?: string;
  supersededAtSystem?: string;
  provenance: ProvenanceMetadata;
  evaluation?: KnowledgeEvaluation;
  isTarget: boolean;
  depth: number;
  isBroken?: boolean;
}

export interface LineageEdge {
  relationId: string;
  relationType: KnowledgeRelationType;
  sourceItemId: string;
  targetItemId: string;
  rationale?: string;
  createdAt: string;
  validFrom?: string;
  recordedAt?: string;
  direction: "PREDECESSOR" | "SUCCESSOR" | "DERIVATION_SOURCE" | "DERIVATION_TARGET";
}

export interface LineageContradiction {
  conflictType: "EXPLICIT_CONTRADICTION" | "MUTUAL_EXCLUSIVE_SAME_TOPIC" | "UNVERIFIED_TEMPORAL_OVERLAP";
  conflictingItemId: string;
  conflictingItemTitle: string;
  conflictingResearchRecordId: string;
  overlapWindow: {
    validFrom: string;
    validUntil: string;
  };
  relationId?: string;
  activeAtTargetValidTime: boolean;
  status: "ACTIVE_CONFLICT" | "HISTORICAL_RESOLVED" | "INCONCLUSIVE";
  severity: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  requiresHumanReview: boolean;
}

export interface DecisionSynthesis {
  currentEffectiveState: KnowledgeLifecycleState;
  currentEpistemicStatus: EpistemicStatus;
  summaryNarrative: string;
  predecessorsCount: number;
  successorsCount: number;
  derivationsCount: number;
  activeConflictsCount: number;
  hasActiveContradiction: boolean;
  hasPendingReview: boolean;
  uncertainties: string[];
  actionableRecommendations: string[];
}

export interface DecisionLineageResult {
  targetItemId: string;
  targetFound: boolean;
  projectId: string;
  scope?: string;
  targetNode?: LineageNode;
  nodes: LineageNode[];
  edges: LineageEdge[];
  rootPredecessors: string[];
  terminalSuccessors: string[];
  cyclesDetected: string[][];
  contradictions: LineageContradiction[];
  synthesis: DecisionSynthesis;
  truncated: boolean;
  maxDepthReached?: boolean;
  queryTimestamp: string;
  errorReason?: string;
}

export interface DecisionLineageParams {
  itemId: string;
  projectId?: string;
  scope?: string;
  maxDepth?: number;
  maxNodes?: number;
  asOfValidTime?: string;
  asOfSystemTime?: string;
  includeContradictions?: boolean;
  agentId?: string;
  sessionId?: string;
}

export interface RankedKnowledgeMatch {
  item: KnowledgeItem;
  researchId: string;
  topic: string;
  score?: number;
}

export function normalizeKnowledgeItem(item: KnowledgeItem): KnowledgeItem {
  if (!item) return item;
  return {
    ...item,
    lifecycleState: item.lifecycleState || "LEGACY_UNEVALUATED",
  };
}

export function normalizeResearchRecord(record: ResearchRecord): ResearchRecord {
  if (!record || !Array.isArray(record.items)) return record;
  return {
    ...record,
    items: record.items.map(normalizeKnowledgeItem),
  };
}

export interface OSSAlternative {
  name: string;
  repositoryUrl?: string;
  license?: string;
  maintenanceStatus?: string;
  technicalSuitability?: string;
  integrationEffort?: string;
  limitations?: string;
  rationale: string;
}

export interface OSSEvaluationRecord {
  id: string;
  capabilityName: string;
  phaseId?: string;
  decision: "ADOPT_EXISTING" | "BUILD_CUSTOM" | "HYBRID";
  investigatedAlternatives: OSSAlternative[];
  customBuildJustification?: string;
  approvedByHuman?: boolean;
  createdAt: string;
  updatedAt: string;
  sessionId?: string;
  relatedAdrId?: string;
}

export interface RoadmapPhase {
  id: string;
  name: string;
  description: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "AWAITING_HUMAN_APPROVAL" | "COMPLETED" | "REJECTED";
  currentStage: string;
  stageStatus: string;
  activeGoal: string;
  activeTasks: TaskState[];
  deliverables: string[];
  risksOrUncertainties: string[];
  nextPhaseProposed: string | null;
  ossEvidenceRequired?: boolean;
  ossEvidenceId?: string;
  createdTimestamp: string;
  completedTimestamp?: string;
}

export interface RoadmapState {
  activePhaseId: string;
  phases: RoadmapPhase[];
  updatedAt: string;
}

export type MigrationClassification =
  | "CANONICAL"
  | "LEGACY_EQUIVALENT"
  | "AMBIGUOUS"
  | "CONTRADICTORY"
  | "INVALID"
  | "ROADMAP_KNOWN_STAGE_UNKNOWN"
  | "WORKFLOW_STAGE_UNINITIALIZED";

export interface MigrationNormalizationResult {
  state: ProjectState;
  classification: MigrationClassification;
  logEvidence: string[];
}

export function normalizeProjectState(raw: any): MigrationNormalizationResult {
  const logEvidence: string[] = [];
  const validMasterStages: string[] = MASTER_PHASE_ORDER;

  if (!raw || typeof raw !== "object") {
    logEvidence.push("Raw input state is null or non-object. Initializing default state.");
    return {
      state: {
        currentStage: "DESCUBRIR",
        currentStatus: "INITIALIZED",
        activeGoal: "Inicialización del proyecto",
        activeTasks: [],
        sessionRunCount: 0,
        lastSessionId: null,
        lastUpdated: new Date().toISOString(),
        roadmap: {
          activePhaseId: "PHASE-1",
          phases: [
            {
              id: "PHASE-1",
              name: "Fase 1: Alcance e Inicialización del Proyecto",
              description: "Fase inicial",
              status: "IN_PROGRESS",
              currentStage: "DESCUBRIR",
              stageStatus: "IN_PROGRESS",
              activeGoal: "Inicialización del proyecto",
              activeTasks: [],
              deliverables: [],
              risksOrUncertainties: [],
              nextPhaseProposed: "PHASE-2",
              createdTimestamp: new Date().toISOString(),
            },
          ],
          updatedAt: new Date().toISOString(),
        },
      },
      classification: "WORKFLOW_STAGE_UNINITIALIZED",
      logEvidence,
    };
  }

  const rawState = JSON.parse(JSON.stringify(raw));

  const rawCurrentStage = typeof rawState.currentStage === "string" && rawState.currentStage.trim().length > 0 ? rawState.currentStage.trim() : undefined;
  const rawCurrentPhase = typeof rawState.currentPhase === "string" && rawState.currentPhase.trim().length > 0 ? rawState.currentPhase.trim() : undefined;
  const rawActivePhase = typeof rawState.activePhase === "string" && rawState.activePhase.trim().length > 0 ? rawState.activePhase.trim() : undefined;

  let roadmapActivePhaseId = rawState.roadmap?.activePhaseId;

  const isValidStage = (val: string | undefined): val is MasterPhaseId =>
    Boolean(val && validMasterStages.includes(val));

  const stageCandValid = isValidStage(rawCurrentStage);
  const phaseCandValid = isValidStage(rawCurrentPhase);
  const activeCandValid = isValidStage(rawActivePhase);

  let finalCurrentStage: MasterPhaseId | undefined;
  let classification: MigrationClassification = "CANONICAL";

  if (stageCandValid && !rawCurrentPhase && !rawActivePhase) {
    finalCurrentStage = rawCurrentStage as MasterPhaseId;
    classification = "CANONICAL";
  } else if (stageCandValid) {
    finalCurrentStage = rawCurrentStage as MasterPhaseId;

    const conflictingPhase = (phaseCandValid && rawCurrentPhase !== rawCurrentStage) ? rawCurrentPhase
      : (activeCandValid && rawActivePhase !== rawCurrentStage) ? rawActivePhase
      : undefined;

    if (conflictingPhase) {
      classification = "CONTRADICTORY";
      logEvidence.push(`Contradiction detected: canonical valid currentStage='${rawCurrentStage}' vs legacy field='${conflictingPhase}'. Preserving canonical valid currentStage='${rawCurrentStage}'.`);
    } else {
      classification = "LEGACY_EQUIVALENT";
      logEvidence.push(`Legacy field(s) present (currentPhase='${rawCurrentPhase}', activePhase='${rawActivePhase}'), matching currentStage='${rawCurrentStage}'. Legacy fields pruned.`);
    }

    if (rawActivePhase && !activeCandValid && !roadmapActivePhaseId) {
      roadmapActivePhaseId = rawActivePhase;
    }
  } else if (rawCurrentStage && !stageCandValid) {
    classification = "INVALID";
    logEvidence.push(`Invalid currentStage detected: '${rawCurrentStage}' is not a valid MasterPhaseId.`);

    if (phaseCandValid) {
      finalCurrentStage = rawCurrentPhase as MasterPhaseId;
      logEvidence.push(`Recovered valid currentStage='${finalCurrentStage}' from legacy currentPhase.`);
    } else if (activeCandValid) {
      finalCurrentStage = rawActivePhase as MasterPhaseId;
      logEvidence.push(`Recovered valid currentStage='${finalCurrentStage}' from legacy activePhase.`);
    } else {
      if (rawActivePhase && !activeCandValid && !roadmapActivePhaseId) {
        roadmapActivePhaseId = rawActivePhase;
      }
      if (rawState.roadmap?.phases && Array.isArray(rawState.roadmap.phases)) {
        const targetPId = roadmapActivePhaseId || rawState.roadmap.activePhaseId;
        const phaseMatch = rawState.roadmap.phases.find((p: any) => p.id === targetPId);
        if (phaseMatch && isValidStage(phaseMatch.currentStage)) {
          finalCurrentStage = phaseMatch.currentStage;
          logEvidence.push(`Recovered valid currentStage='${finalCurrentStage}' from roadmap phase '${targetPId}'.`);
        }
      }
    }
  } else if (phaseCandValid || activeCandValid) {
    if (phaseCandValid && activeCandValid && rawCurrentPhase !== rawActivePhase) {
      classification = "CONTRADICTORY";
      finalCurrentStage = rawCurrentPhase as MasterPhaseId;
      logEvidence.push(`Contradiction between legacy fields: currentPhase='${rawCurrentPhase}' vs activePhase='${rawActivePhase}'. Selected '${finalCurrentStage}'.`);
    } else {
      finalCurrentStage = (phaseCandValid ? rawCurrentPhase : rawActivePhase) as MasterPhaseId;
      classification = "LEGACY_EQUIVALENT";
      logEvidence.push(`Migrated legacy stage '${finalCurrentStage}' into canonical currentStage.`);
    }

    if (rawActivePhase && !activeCandValid && !roadmapActivePhaseId) {
      roadmapActivePhaseId = rawActivePhase;
    }
  } else if (rawActivePhase && !activeCandValid) {
    roadmapActivePhaseId = rawActivePhase;
    let resolvedFromRoadmap = false;
    if (rawState.roadmap?.phases && Array.isArray(rawState.roadmap.phases)) {
      const phaseMatch = rawState.roadmap.phases.find((p: any) => p.id === rawActivePhase);
      if (phaseMatch && isValidStage(phaseMatch.currentStage)) {
        finalCurrentStage = phaseMatch.currentStage;
        classification = "LEGACY_EQUIVALENT";
        resolvedFromRoadmap = true;
        logEvidence.push(`Resolved currentStage='${finalCurrentStage}' from Roadmap phase '${rawActivePhase}'.`);
      }
    }
    if (!resolvedFromRoadmap) {
      classification = "ROADMAP_KNOWN_STAGE_UNKNOWN";
      logEvidence.push(`Roadmap phase '${rawActivePhase}' is known, but currentStage is unknown.`);
    }
  } else {
    classification = "WORKFLOW_STAGE_UNINITIALIZED";
    logEvidence.push("No workflow stage or roadmap phase candidate found.");
  }

  const canonicalState: ProjectState = {
    ...rawState,
    currentStage: finalCurrentStage,
  };

  if (roadmapActivePhaseId || !canonicalState.roadmap) {
    if (!canonicalState.roadmap) {
      canonicalState.roadmap = {
        activePhaseId: roadmapActivePhaseId || "PHASE-1",
        phases: [
          {
            id: roadmapActivePhaseId || "PHASE-1",
            name: `Fase ${roadmapActivePhaseId || "PHASE-1"}`,
            description: "Fase de Roadmap",
            status: "IN_PROGRESS",
            currentStage: finalCurrentStage || "DESCUBRIR",
            stageStatus: canonicalState.currentStatus || "IN_PROGRESS",
            activeGoal: canonicalState.activeGoal || "",
            activeTasks: canonicalState.activeTasks || [],
            deliverables: [],
            risksOrUncertainties: [],
            nextPhaseProposed: "PHASE-2",
            createdTimestamp: canonicalState.lastUpdated || new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      };
    } else if (roadmapActivePhaseId) {
      canonicalState.roadmap.activePhaseId = roadmapActivePhaseId;
    }
  }

  if (Array.isArray(canonicalState.sessions)) {
    const validStatuses = ["ACTIVE", "IDLE", "COMPLETED", "FAILED", "ABORTED"];
    canonicalState.sessions = canonicalState.sessions.map((s: any) => {
      let status: SessionStatus = "ACTIVE";
      let lastCompactedAt = s.lastCompactedAt;
      let compactionCount = s.compactionCount;

      if (validStatuses.includes(s.status)) {
        status = s.status;
      } else if (s.status === "COMPACTED") {
        status = s.completedAt ? "COMPLETED" : "ACTIVE";
        if (!lastCompactedAt && s.completedAt) {
          lastCompactedAt = s.completedAt;
        }
        if (!compactionCount) {
          compactionCount = 1;
        }
      }

      const normalizedSession: SessionRecord = {
        id: s.id,
        agentId: s.agentId,
        hostId: s.hostId || undefined,
        status,
        startedAt: s.startedAt || s.lastActiveAt || new Date().toISOString(),
        lastActiveAt: s.lastActiveAt || new Date().toISOString(),
        completedAt: s.completedAt || undefined,
        lastCompactedAt,
        compactionCount,
        provenance: s.provenance || undefined,
        metadata: s.metadata || {},
      };

      delete (normalizedSession as any).currentStage;
      delete (normalizedSession as any).activePhaseId;
      delete (normalizedSession as any).assignedTaskId;
      delete (normalizedSession as any).adrsCreated;
      delete (normalizedSession as any).researchesCreated;
      delete (normalizedSession as any).locksAcquired;
      delete (normalizedSession as any).parentSessionId;
      delete (normalizedSession as any).forkDepth;

      return normalizedSession;
    });
  }

  delete (canonicalState as any).activePhase;
  delete (canonicalState as any).currentPhase;

  return {
    state: canonicalState,
    classification,
    logEvidence,
  };
}

export function sanitizeSecrets(text: string): string {
  if (!text) return text;
  return text
    .replace(/(sk-[a-zA-Z0-9._-]{16,})/g, "[REDACTED_SECRET]")
    .replace(/(ghp_[a-zA-Z0-9._-]{16,})/g, "[REDACTED_SECRET]")
    .replace(/(bearer\s+[a-zA-Z0-9._-]{16,})/gi, "Bearer [REDACTED_SECRET]")
    .replace(/(password|secret|api_key|apikey)=([^\s&]+)/gi, "$1=[REDACTED_SECRET]");
}

export interface LockResult {
  acquired: boolean;
  token?: string;
  expiresAt?: number;
  reason?: string;
}

export interface TaskCycleDiagnostic {
  hasCycle: boolean;
  status: "VALID" | "INVALID_DAG_CYCLE_DETECTED";
  cyclePath?: string[];
  cyclicTaskIds: string[];
}

export function detectTaskGraphCycles(tasks: AgentTask[]): TaskCycleDiagnostic {
  const taskMap = new Map<string, AgentTask>();
  for (const t of tasks) {
    taskMap.set(t.id, t);
  }

  const adjacencyMap = new Map<string, string[]>();
  for (const t of tasks) {
    const deps = (t.dependsOn || []).filter(depId => taskMap.has(depId));
    adjacencyMap.set(t.id, deps);
  }

  const visitedState = new Map<string, number>();
  for (const t of tasks) {
    visitedState.set(t.id, 0);
  }

  const pathStack: string[] = [];
  const cyclicTaskIdsSet = new Set<string>();
  let firstCyclePath: string[] | undefined = undefined;

  function dfs(nodeId: string) {
    visitedState.set(nodeId, 1);
    pathStack.push(nodeId);

    const neighbors = adjacencyMap.get(nodeId) || [];
    for (const neighborId of neighbors) {
      const state = visitedState.get(neighborId) || 0;
      if (state === 1) {
        const startIndex = pathStack.indexOf(neighborId);
        if (startIndex !== -1) {
          const cyclePath = pathStack.slice(startIndex).concat(neighborId);
          if (!firstCyclePath) {
            firstCyclePath = cyclePath;
          }
          for (const id of cyclePath) {
            cyclicTaskIdsSet.add(id);
          }
        }
      } else if (state === 0) {
        dfs(neighborId);
      }
    }

    pathStack.pop();
    visitedState.set(nodeId, 2);
  }

  for (const t of tasks) {
    if (visitedState.get(t.id) === 0) {
      dfs(t.id);
    }
  }

  const hasCycle = cyclicTaskIdsSet.size > 0;
  return {
    hasCycle,
    status: hasCycle ? "INVALID_DAG_CYCLE_DETECTED" : "VALID",
    cyclePath: firstCyclePath,
    cyclicTaskIds: Array.from(cyclicTaskIdsSet),
  };
}
