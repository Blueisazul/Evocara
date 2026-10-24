import {
  ResearchRecord,
  KnowledgeItem,
  KnowledgeRelation,
  KnowledgeRelationType,
  KnowledgeLifecycleState,
  ActorRole,
  AcceptanceBasis,
  KnowledgeItemTMSView,
  TMSAnalysisResult,
  EpistemicStatus,
  getEpistemicStatus,
  TemporalContradictionReport,
  LineageNode,
  LineageEdge,
  LineageContradiction,
  DecisionSynthesis,
  DecisionLineageResult,
  DecisionLineageParams,
} from "../types";

export interface LifecycleTransitionResult {
  valid: boolean;
  reason?: string;
  acceptanceBasis?: AcceptanceBasis;
  evaluationRationale?: string;
}

export interface RelationValidationResult {
  valid: boolean;
  reason?: string;
  isDuplicate?: boolean;
  existingRelation?: KnowledgeRelation;
}

export class KnowledgeTMS {
  /**
   * Pure validation rules for KnowledgeItem lifecycle state transitions (F13.1-B)
   */
  public validateLifecycleTransition(params: {
    currentState: KnowledgeLifecycleState;
    targetState: KnowledgeLifecycleState;
    actorRole?: ActorRole;
    evaluationRationale?: string;
    acceptanceBasis?: AcceptanceBasis;
    evidenceReference?: string;
  }): LifecycleTransitionResult {
    const { currentState, targetState } = params;

    // Terminal State Protection: SUPERSEDED and DEPRECATED are terminal
    if (currentState === "SUPERSEDED" || currentState === "DEPRECATED") {
      return {
        valid: false,
        reason: `Terminal state protection: KnowledgeItem is in terminal state '${currentState}' and cannot be resurrected or modified.`,
      };
    }

    const role = params.actorRole || "WORKER_AGENT";
    const isLeadOrHuman = role === "HUMAN_OPERATOR" || role === "LEAD_AGENT";

    if (targetState === "VALIDATED") {
      if (
        !params.evidenceReference ||
        typeof params.evidenceReference !== "string" ||
        params.evidenceReference.trim().length < 3
      ) {
        return {
          valid: false,
          reason: "Validation rejected: evidenceReference (min 3 chars) is mandatory for transition to VALIDATED.",
        };
      }
    } else if (targetState === "ACCEPTED") {
      if (!isLeadOrHuman) {
        return {
          valid: false,
          reason: `Unauthorized acceptance: caller role '${role}' is not authorized to transition KnowledgeItem to ACCEPTED. Must be HUMAN_OPERATOR or LEAD_AGENT.`,
        };
      }

      if (currentState === "LEGACY_UNEVALUATED") {
        const basis = params.acceptanceBasis || "OPERATIONAL_ADOPTION";
        if (basis !== "OPERATIONAL_ADOPTION") {
          return {
            valid: false,
            reason: "Acceptance rejected: direct legacy acceptance must specify acceptanceBasis = 'OPERATIONAL_ADOPTION'.",
          };
        }
        if (!params.evaluationRationale || params.evaluationRationale.trim().length < 15) {
          return {
            valid: false,
            reason: "Acceptance rejected: direct legacy acceptance requires an evaluationRationale of at least 15 characters.",
          };
        }
      } else if (currentState === "VALIDATED") {
        if (!params.evaluationRationale || params.evaluationRationale.trim().length < 1) {
          return {
            valid: false,
            reason: "Acceptance rejected: evaluationRationale is mandatory for transition to ACCEPTED.",
          };
        }
      } else if (currentState === "CREATED") {
        return {
          valid: false,
          reason: "Acceptance rejected: item in state 'CREATED' must be VALIDATED prior to acceptance unless adopting legacy knowledge.",
        };
      }
    } else if (targetState === "SUPERSEDED") {
      if (!isLeadOrHuman) {
        return {
          valid: false,
          reason: `Unauthorized: caller role '${role}' is not authorized to set KnowledgeItem to SUPERSEDED. Must be HUMAN_OPERATOR or LEAD_AGENT.`,
        };
      }
      if (!params.evaluationRationale || params.evaluationRationale.trim().length === 0) {
        return {
          valid: false,
          reason: "Supersede rejected: evaluationRationale is mandatory.",
        };
      }
    } else if (targetState === "DEPRECATED") {
      if (!isLeadOrHuman) {
        return {
          valid: false,
          reason: `Unauthorized: caller role '${role}' is not authorized to set KnowledgeItem to DEPRECATED. Must be HUMAN_OPERATOR or LEAD_AGENT.`,
        };
      }
      if (!params.evaluationRationale || params.evaluationRationale.trim().length === 0) {
        return {
          valid: false,
          reason: "Deprecation rejected: evaluationRationale is mandatory.",
        };
      }
    }

    const defaultBasis =
      params.acceptanceBasis ||
      (targetState === "ACCEPTED"
        ? currentState === "LEGACY_UNEVALUATED"
          ? "OPERATIONAL_ADOPTION"
          : "EVIDENCE_VALIDATED"
        : "EVIDENCE_VALIDATED");

    return {
      valid: true,
      acceptanceBasis: defaultBasis,
      evaluationRationale: params.evaluationRationale || `Transitioned to ${targetState}`,
    };
  }

  /**
   * Pure validation rules and supersession cycle detection for KnowledgeRelation creation (F13.2-A)
   */
  public validateRelationCreation(
    existingRelations: Array<KnowledgeRelation & { owningResearchRecordId: string }>,
    params: {
      relationType: KnowledgeRelationType;
      sourceItemId: string;
      targetItemId: string;
      sourceItemExistsInRecord: boolean;
    }
  ): RelationValidationResult {
    const validTypes: KnowledgeRelationType[] = [
      "SUPPORTS",
      "CONTRADICTS",
      "SUPERSEDES",
      "DERIVED_FROM",
      "QUALIFIES",
    ];

    if (!validTypes.includes(params.relationType)) {
      return {
        valid: false,
        reason: `Invalid relationType '${params.relationType}'. Must be one of SUPPORTS, CONTRADICTS, SUPERSEDES, DERIVED_FROM, QUALIFIES.`,
      };
    }

    if (params.sourceItemId === params.targetItemId) {
      return {
        valid: false,
        reason: `Self-relation rejected: item cannot relate to itself ('${params.sourceItemId}').`,
      };
    }

    if (!params.targetItemId || typeof params.targetItemId !== "string" || params.targetItemId.trim().length === 0) {
      return {
        valid: false,
        reason: "Invalid relation rejected: targetItemId must be a non-empty string.",
      };
    }

    if (!params.sourceItemExistsInRecord) {
      return {
        valid: false,
        reason: `Source ownership mismatch: sourceItemId '${params.sourceItemId}' not found in research record. Canonical ownership rule requires relation to be stored in the ResearchRecord containing sourceItemId.`,
      };
    }

    // Supersession Cycle Guard for NEW relations
    if (params.relationType === "SUPERSEDES") {
      const supersedesEdges = existingRelations.filter(r => r.relationType === "SUPERSEDES");
      const visited = new Set<string>();
      const queue = [params.targetItemId];
      let createsCycle = false;

      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr === params.sourceItemId) {
          createsCycle = true;
          break;
        }
        if (visited.has(curr)) continue;
        visited.add(curr);

        for (const edge of supersedesEdges) {
          if (edge.sourceItemId === curr && !visited.has(edge.targetItemId)) {
            queue.push(edge.targetItemId);
          }
        }
      }

      if (createsCycle) {
        return {
          valid: false,
          reason: `Supersession cycle rejected: adding SUPERSEDES relation from '${params.sourceItemId}' to '${params.targetItemId}' would create a cycle.`,
        };
      }
    }

    // Duplicate detection
    const duplicate = existingRelations.find(
      r =>
        r.sourceItemId === params.sourceItemId &&
        r.targetItemId === params.targetItemId &&
        r.relationType === params.relationType
    );

    if (duplicate) {
      return {
        valid: true,
        isDuplicate: true,
        existingRelation: duplicate,
      };
    }

    return { valid: true };
  }

  /**
   * Bi-temporal Interval Validation (Hito G30)
   * Enforces ISO 8601 formatting, parseability, and interval consistency (validFrom <= validUntil).
   * Open-ended intervals (validUntil null/undefined) are valid.
   */
  public validateTemporalInterval(validFrom?: string, validUntil?: string): { valid: boolean; reason?: string } {
    let tFrom: number | undefined;
    let tUntil: number | undefined;

    if (validFrom !== undefined && validFrom !== null && validFrom !== "") {
      tFrom = Date.parse(validFrom);
      if (isNaN(tFrom)) {
        return {
          valid: false,
          reason: `Invalid validFrom: '${validFrom}' cannot be parsed as an ISO 8601 date string.`,
        };
      }
    }

    if (validUntil !== undefined && validUntil !== null && validUntil !== "") {
      tUntil = Date.parse(validUntil);
      if (isNaN(tUntil)) {
        return {
          valid: false,
          reason: `Invalid validUntil: '${validUntil}' cannot be parsed as an ISO 8601 date string.`,
        };
      }
    }

    if (tFrom !== undefined && tUntil !== undefined) {
      if (tFrom > tUntil) {
        return {
          valid: false,
          reason: `Inverted validity interval rejected: validFrom (${validFrom}) cannot be after validUntil (${validUntil}).`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Evaluates if a KnowledgeItem was valid at a specific point in domain time (asOfValidTime).
   * Semantics: half-open interval [validFrom, validUntil).
   * If validUntil is omitted, interval is open-ended towards the future.
   */
  public isItemValidAtDomainTime(
    item: KnowledgeItem,
    targetTimeIso: string,
    options?: { strict?: boolean }
  ): boolean {
    const tTarget = Date.parse(targetTimeIso);
    if (isNaN(tTarget)) return false;

    const hasExplicitFrom = item.validFrom !== undefined && item.validFrom !== null && item.validFrom !== "";
    const hasExplicitUntil = item.validUntil !== undefined && item.validUntil !== null && item.validUntil !== "";

    if (hasExplicitFrom) {
      const tFrom = Date.parse(item.validFrom!);
      if (!isNaN(tFrom) && tTarget < tFrom) {
        return false;
      }
    }

    if (hasExplicitUntil) {
      const tUntil = Date.parse(item.validUntil!);
      if (!isNaN(tUntil) && tTarget >= tUntil) {
        return false;
      }
    }

    if (!hasExplicitFrom && !hasExplicitUntil) {
      if (options?.strict) {
        return false;
      }
      // Non-strict legacy fallback: if item has acceptedAt or creation provenance, must not precede it
      const fallbackStart = item.acceptedAt || item.provenance?.timestamp;
      if (fallbackStart) {
        const tStart = Date.parse(fallbackStart);
        if (!isNaN(tStart) && tTarget < tStart) {
          return false;
        }
      }
      // If superseded, domain validity fallback ended when it was superseded
      if (item.supersededAt) {
        const tSup = Date.parse(item.supersededAt);
        if (!isNaN(tSup) && tTarget >= tSup) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Evaluates if a KnowledgeItem was recorded and known to Evocara at a specific system/transaction time.
   */
  public wasItemKnownAtSystemTime(item: KnowledgeItem, systemTimeIso: string): boolean {
    const tSystem = Date.parse(systemTimeIso);
    if (isNaN(tSystem)) return false;

    const recStr = item.recordedAt || item.provenance?.timestamp || item.acceptedAt || item.validatedAt;
    if (!recStr) return true; // Legacy items without timestamp assumed known

    const tRec = Date.parse(recStr);
    if (isNaN(tRec)) return true;

    return tRec <= tSystem;
  }

  /**
   * Evaluates if a KnowledgeItem was superseded/invalidated at or before a specific system/transaction time.
   */
  public wasItemSupersededAtSystemTime(item: KnowledgeItem, systemTimeIso: string): boolean {
    const tSystem = Date.parse(systemTimeIso);
    if (isNaN(tSystem)) return false;

    if (item.lifecycleState !== "SUPERSEDED" && item.lifecycleState !== "DEPRECATED") {
      return false;
    }

    const supStr = item.supersededAtSystem || item.supersededAt || item.deprecatedAt;
    if (!supStr) return false;

    const tSup = Date.parse(supStr);
    if (isNaN(tSup)) return false;

    return tSup <= tSystem;
  }

  /**
   * Comprehensive bi-temporal evaluation of a KnowledgeItem at specified domain and system coordinates.
   */
  public evaluateBiTemporalItem(
    item: KnowledgeItem,
    asOfValidTime?: string,
    asOfSystemTime?: string,
    options?: { strict?: boolean }
  ): {
    knownAtSystemTime: boolean;
    supersededAtSystemTime: boolean;
    validAtDomainTime: boolean;
    effectiveLifecycleState: KnowledgeLifecycleState;
    effectiveEpistemicStatus: EpistemicStatus;
  } {
    const knownAtSystemTime = asOfSystemTime ? this.wasItemKnownAtSystemTime(item, asOfSystemTime) : true;
    const supersededAtSystemTime = asOfSystemTime
      ? this.wasItemSupersededAtSystemTime(item, asOfSystemTime)
      : (item.lifecycleState === "SUPERSEDED" || item.lifecycleState === "DEPRECATED");
    const validAtDomainTime = asOfValidTime ? this.isItemValidAtDomainTime(item, asOfValidTime, options) : true;

    let effectiveLifecycleState: KnowledgeLifecycleState = item.lifecycleState || "LEGACY_UNEVALUATED";

    if (asOfValidTime && validAtDomainTime) {
      // At this domain valid time, the item was actively within its validity window
      if (item.lifecycleState === "SUPERSEDED" || item.lifecycleState === "DEPRECATED") {
        effectiveLifecycleState = "ACCEPTED";
      }
    } else if (asOfSystemTime && knownAtSystemTime && !supersededAtSystemTime) {
      // At this historical system time, the item had not yet been superseded or deprecated!
      if (item.lifecycleState === "SUPERSEDED" || item.lifecycleState === "DEPRECATED") {
        effectiveLifecycleState = "ACCEPTED";
      }
    }

    // Evaluate effective epistemic status
    const effectiveEpistemicStatus = getEpistemicStatus({
      ...item,
      lifecycleState: effectiveLifecycleState,
    });

    return {
      knownAtSystemTime,
      supersededAtSystemTime,
      validAtDomainTime,
      effectiveLifecycleState,
      effectiveEpistemicStatus,
    };
  }

  /**
   * Detects temporal contradictions in the knowledge base.
   * Two items linked by CONTRADICTS only create an active epistemic conflict if their domain validity intervals overlap.
   */
  public detectTemporalContradictions(researches: ResearchRecord[]): TemporalContradictionReport {
    const itemMap = new Map<string, KnowledgeItem>();
    const relations: KnowledgeRelation[] = [];

    for (const r of researches) {
      for (const item of r.items) {
        itemMap.set(item.id, item);
      }
      if (Array.isArray(r.relations)) {
        relations.push(...r.relations);
      }
    }

    const contradictsRelations = relations.filter(r => r.relationType === "CONTRADICTS");
    const overlappingPairs: Array<{
      sourceItemId: string;
      targetItemId: string;
      overlapFrom: string;
      overlapUntil: string;
      reason: string;
    }> = [];
    const diagnostics: string[] = [];

    for (const rel of contradictsRelations) {
      const source = itemMap.get(rel.sourceItemId);
      const target = itemMap.get(rel.targetItemId);
      if (!source || !target) continue;

      const sFrom = source.validFrom ? Date.parse(source.validFrom) : 0;
      const sUntil = source.validUntil ? Date.parse(source.validUntil) : Infinity;
      const tFrom = target.validFrom ? Date.parse(target.validFrom) : 0;
      const tUntil = target.validUntil ? Date.parse(target.validUntil) : Infinity;

      if (!isNaN(sFrom) && !isNaN(sUntil) && !isNaN(tFrom) && !isNaN(tUntil)) {
        const overlapStart = Math.max(sFrom, tFrom);
        const overlapEnd = Math.min(sUntil, tUntil);

        if (overlapStart < overlapEnd) {
          const fromIso = overlapStart === 0 ? "Epoch" : new Date(overlapStart).toISOString();
          const untilIso = overlapEnd === Infinity ? "Infinity" : new Date(overlapEnd).toISOString();
          const msg = `Temporal contradiction: items '${source.id}' and '${target.id}' have overlapping validity windows [${fromIso} -> ${untilIso}) with active CONTRADICTS relation.`;
          diagnostics.push(msg);
          overlappingPairs.push({
            sourceItemId: source.id,
            targetItemId: target.id,
            overlapFrom: fromIso,
            overlapUntil: untilIso,
            reason: msg,
          });
        }
      }
    }

    return {
      contradictionsFound: overlappingPairs.length,
      diagnostics,
      overlappingPairs,
    };
  }

  /**
   * Identifies all active and historical temporal contradictions affecting items in the knowledge base.
   * G31 Implementation:
   * - Detects explicit CONTRADICTS relations with overlapping [validFrom, validUntil) intervals.
   * - Detects structural mutual exclusion anomalies in supersession chains.
   * - Detects competing active decisions bound to the same relatedAdrId.
   * - Categorizes unverified temporal overlaps cleanly without hallucinating false contradictions.
   */
  public findItemContradictions(
    researches: ResearchRecord[],
    targetItemId?: string,
    asOfValidTime?: string
  ): LineageContradiction[] {
    const itemMap = new Map<string, { item: KnowledgeItem; research: ResearchRecord }>();
    const relations: KnowledgeRelation[] = [];

    for (const r of researches) {
      for (const item of r.items) {
        itemMap.set(item.id, { item, research: r });
      }
      if (Array.isArray(r.relations)) {
        relations.push(...r.relations);
      }
    }

    const contradictions: LineageContradiction[] = [];
    const seenPairs = new Set<string>();

    const targetDateMs = asOfValidTime ? Date.parse(asOfValidTime) : undefined;
    const nowMs = Date.now();
    const effectiveEvalTime = targetDateMs !== undefined && !isNaN(targetDateMs) ? targetDateMs : nowMs;

    const getInterval = (item: KnowledgeItem) => {
      const from = item.validFrom ? Date.parse(item.validFrom) : 0;
      const until = item.validUntil ? Date.parse(item.validUntil) : Infinity;
      return {
        from: isNaN(from) ? 0 : from,
        until: isNaN(until) ? Infinity : until,
        isOpenEnded: !item.validUntil,
      };
    };

    // 1. Explicit CONTRADICTS relations
    for (const rel of relations) {
      if (rel.relationType !== "CONTRADICTS") continue;
      if (targetItemId && rel.sourceItemId !== targetItemId && rel.targetItemId !== targetItemId) {
        continue;
      }

      const pairKey = [rel.sourceItemId, rel.targetItemId].sort().join("<->");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const sourceEntry = itemMap.get(rel.sourceItemId);
      const targetEntry = itemMap.get(rel.targetItemId);
      if (!sourceEntry || !targetEntry) continue;

      const sInt = getInterval(sourceEntry.item);
      const tInt = getInterval(targetEntry.item);

      const overlapStart = Math.max(sInt.from, tInt.from);
      const overlapEnd = Math.min(sInt.until, tInt.until);

      if (overlapStart < overlapEnd) {
        const fromIso = overlapStart === 0 ? (sourceEntry.item.validFrom || targetEntry.item.validFrom || "1970-01-01T00:00:00.000Z") : new Date(overlapStart).toISOString();
        const untilIso = overlapEnd === Infinity ? "+inf" : new Date(overlapEnd).toISOString();

        // Active at requested target date?
        const activeAtTime = effectiveEvalTime >= overlapStart && effectiveEvalTime < overlapEnd;
        const otherEntry = targetItemId === rel.sourceItemId ? targetEntry : sourceEntry;

        contradictions.push({
          conflictType: "EXPLICIT_CONTRADICTION",
          conflictingItemId: otherEntry.item.id,
          conflictingItemTitle: otherEntry.item.title,
          conflictingResearchRecordId: otherEntry.research.id,
          overlapWindow: {
            validFrom: fromIso,
            validUntil: untilIso,
          },
          relationId: rel.id,
          activeAtTargetValidTime: activeAtTime,
          status: activeAtTime ? "ACTIVE_CONFLICT" : "HISTORICAL_RESOLVED",
          severity: activeAtTime ? "HIGH" : "LOW",
          description: `Explicit contradiction: items '${sourceEntry.item.id}' and '${targetEntry.item.id}' have active CONTRADICTS relation with overlapping validity [${fromIso} .. ${untilIso}).`,
          requiresHumanReview: activeAtTime,
        });
      }
    }

    // 2. Structural conflict: Mutual exclusion in supersession anomaly
    for (const rel of relations) {
      if (rel.relationType !== "SUPERSEDES") continue;
      if (targetItemId && rel.sourceItemId !== targetItemId && rel.targetItemId !== targetItemId) {
        continue;
      }

      const supersedingEntry = itemMap.get(rel.sourceItemId);
      const supersededEntry = itemMap.get(rel.targetItemId);
      if (!supersedingEntry || !supersededEntry) continue;

      const newInt = getInterval(supersedingEntry.item);
      const oldInt = getInterval(supersededEntry.item);

      if (oldInt.until > newInt.from && oldInt.from < newInt.until) {
        const overlapStart = Math.max(oldInt.from, newInt.from);
        const overlapEnd = Math.min(oldInt.until, newInt.until);
        const fromIso = new Date(overlapStart).toISOString();
        const untilIso = overlapEnd === Infinity ? "+inf" : new Date(overlapEnd).toISOString();
        const activeAtTime = effectiveEvalTime >= overlapStart && effectiveEvalTime < overlapEnd;
        const otherEntry = targetItemId === supersedingEntry.item.id ? supersededEntry : supersedingEntry;

        const pairKey = `SUPERSEDE_ANOMALY:${rel.sourceItemId}:${rel.targetItemId}`;
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          contradictions.push({
            conflictType: "MUTUAL_EXCLUSIVE_SAME_TOPIC",
            conflictingItemId: otherEntry.item.id,
            conflictingItemTitle: otherEntry.item.title,
            conflictingResearchRecordId: otherEntry.research.id,
            overlapWindow: { validFrom: fromIso, validUntil: untilIso },
            relationId: rel.id,
            activeAtTargetValidTime: activeAtTime,
            status: activeAtTime ? "ACTIVE_CONFLICT" : "HISTORICAL_RESOLVED",
            severity: "HIGH",
            description: `Supersession boundary overlap anomaly: Old item '${supersededEntry.item.id}' and superseding item '${supersedingEntry.item.id}' both claim validity within [${fromIso} .. ${untilIso}).`,
            requiresHumanReview: activeAtTime,
          });
        }
      }
    }

    // 3. Structural conflict: Same relatedAdrId active concurrently without supersession
    const itemsByAdr = new Map<string, Array<{ item: KnowledgeItem; research: ResearchRecord }>>();
    for (const entry of itemMap.values()) {
      const adrId = entry.research.relatedAdrId;
      if (adrId && entry.item.lifecycleState === "ACCEPTED") {
        if (!itemsByAdr.has(adrId)) itemsByAdr.set(adrId, []);
        itemsByAdr.get(adrId)!.push(entry);
      }
    }

    for (const [adrId, adrItems] of itemsByAdr.entries()) {
      if (adrItems.length <= 1) continue;
      for (let i = 0; i < adrItems.length; i++) {
        for (let j = i + 1; j < adrItems.length; j++) {
          const a = adrItems[i];
          const b = adrItems[j];
          if (targetItemId && a.item.id !== targetItemId && b.item.id !== targetItemId) continue;

          const hasSup = relations.some(
            r => r.relationType === "SUPERSEDES" &&
            ((r.sourceItemId === a.item.id && r.targetItemId === b.item.id) ||
             (r.sourceItemId === b.item.id && r.targetItemId === a.item.id))
          );
          if (hasSup) continue;

          const aInt = getInterval(a.item);
          const bInt = getInterval(b.item);
          if (aInt.from < bInt.until && bInt.from < aInt.until) {
            const overlapStart = Math.max(aInt.from, bInt.from);
            const overlapEnd = Math.min(aInt.until, bInt.until);
            const fromIso = new Date(overlapStart).toISOString();
            const untilIso = overlapEnd === Infinity ? "+inf" : new Date(overlapEnd).toISOString();
            const activeAtTime = effectiveEvalTime >= overlapStart && effectiveEvalTime < overlapEnd;
            const other = targetItemId === a.item.id ? b : a;

            const pairKey = `ADR_CONFLICT:${a.item.id}:${b.item.id}`;
            if (!seenPairs.has(pairKey)) {
              seenPairs.add(pairKey);
              contradictions.push({
                conflictType: "MUTUAL_EXCLUSIVE_SAME_TOPIC",
                conflictingItemId: other.item.id,
                conflictingItemTitle: other.item.title,
                conflictingResearchRecordId: other.research.id,
                overlapWindow: { validFrom: fromIso, validUntil: untilIso },
                activeAtTargetValidTime: activeAtTime,
                status: activeAtTime ? "ACTIVE_CONFLICT" : "HISTORICAL_RESOLVED",
                severity: "MEDIUM",
                description: `Multiple active decisions link to '${adrId}' with overlapping validity [${fromIso} .. ${untilIso}) without a supersession relation.`,
                requiresHumanReview: activeAtTime,
              });
            }
          }
        }
      }
    }

    return contradictions.sort((a, b) => {
      if (a.severity === "HIGH" && b.severity !== "HIGH") return -1;
      if (b.severity === "HIGH" && a.severity !== "HIGH") return 1;
      return a.conflictingItemId.localeCompare(b.conflictingItemId);
    });
  }

  /**
   * Explain Decision Lineage (Hito G31):
   * Recursively traverses forward and backward through SUPERSEDES and DERIVED_FROM relations.
   * Produces structured lineage, cycle detection, broken reference tolerance, and contextual synthesis.
   */
  public explainDecisionLineage(
    researches: ResearchRecord[],
    params: DecisionLineageParams
  ): DecisionLineageResult {
    const nowIso = new Date().toISOString();
    const maxDepth = params.maxDepth && params.maxDepth > 0 ? params.maxDepth : 10;
    const maxNodes = params.maxNodes && params.maxNodes > 0 ? params.maxNodes : 50;

    // 1. Build Item & Relation indices
    const itemMap = new Map<string, { item: KnowledgeItem; research: ResearchRecord }>();
    const relations: KnowledgeRelation[] = [];

    for (const r of researches) {
      for (const item of r.items) {
        itemMap.set(item.id, { item, research: r });
      }
      if (Array.isArray(r.relations)) {
        relations.push(...r.relations);
      }
    }

    // 2. Locate Target Item
    const targetEntry = itemMap.get(params.itemId);
    if (!targetEntry) {
      return {
        targetItemId: params.itemId,
        targetFound: false,
        projectId: params.projectId || "unknown",
        scope: params.scope,
        nodes: [],
        edges: [],
        rootPredecessors: [],
        terminalSuccessors: [],
        cyclesDetected: [],
        contradictions: [],
        synthesis: {
          currentEffectiveState: "LEGACY_UNEVALUATED",
          currentEpistemicStatus: "UNVALIDATED_OBSERVATION",
          summaryNarrative: `Target knowledge item '${params.itemId}' not found in accessible research records.`,
          predecessorsCount: 0,
          successorsCount: 0,
          derivationsCount: 0,
          activeConflictsCount: 0,
          hasActiveContradiction: false,
          hasPendingReview: false,
          uncertainties: ["Item ID not found or outside authorized scope."],
          actionableRecommendations: ["Verify item ID spelling or check project authorization boundary."],
        },
        truncated: false,
        queryTimestamp: nowIso,
        errorReason: `Target knowledge item '${params.itemId}' not found in accessible research records.`,
      };
    }

    const { item: targetItem } = targetEntry;

    // Helper to format LineageNode
    const createLineageNode = (
      itemId: string,
      depth: number,
      isTarget: boolean
    ): LineageNode => {
      const entry = itemMap.get(itemId);
      if (!entry) {
        return {
          itemId,
          researchRecordId: "UNKNOWN",
          title: `[BROKEN REFERENCE: ${itemId}]`,
          type: "FINDING",
          classification: "OBSERVATION",
          lifecycleState: "LEGACY_UNEVALUATED",
          epistemicStatus: "UNVALIDATED_OBSERVATION",
          validityWindow: { isOpenEnded: false },
          provenance: { agentId: "unknown", timestamp: new Date(0).toISOString() },
          isTarget,
          depth,
          isBroken: true,
        };
      }

      const it = entry.item;
      let effectiveLifecycle = it.lifecycleState || "LEGACY_UNEVALUATED";
      let effectiveEpistemic = getEpistemicStatus(it);

      if (params.asOfValidTime || params.asOfSystemTime) {
        const evalRes = this.evaluateBiTemporalItem(
          it,
          params.asOfValidTime,
          params.asOfSystemTime
        );
        effectiveLifecycle = evalRes.effectiveLifecycleState;
        effectiveEpistemic = evalRes.effectiveEpistemicStatus;
      }

      return {
        itemId: it.id,
        researchRecordId: entry.research.id,
        topic: entry.research.topic,
        title: it.title,
        type: it.type,
        classification: it.classification,
        lifecycleState: effectiveLifecycle,
        epistemicStatus: effectiveEpistemic,
        validityWindow: {
          validFrom: it.validFrom,
          validUntil: it.validUntil,
          isOpenEnded: !it.validUntil,
        },
        recordedAt: it.recordedAt || it.provenance?.timestamp,
        supersededAtSystem: it.supersededAtSystem,
        provenance: it.provenance,
        evaluation: it.evaluation,
        isTarget,
        depth,
        isBroken: false,
      };
    };

    const visitedNodes = new Map<string, LineageNode>();
    const edges: LineageEdge[] = [];
    const cyclesDetected: string[][] = [];
    let truncated = false;
    let maxDepthReached = false;

    // Seed target node at depth 0
    const targetNode = createLineageNode(targetItem.id, 0, true);
    visitedNodes.set(targetItem.id, targetNode);

    // Backward Traversal (Predecessors)
    const traverseBackward = (currentId: string, currentDepth: number, currentPath: string[]) => {
      if (Math.abs(currentDepth) >= maxDepth) {
        maxDepthReached = true;
        return;
      }
      if (visitedNodes.size >= maxNodes) {
        truncated = true;
        return;
      }

      for (const rel of relations) {
        if (rel.sourceItemId !== currentId) continue;
        if (rel.relationType !== "SUPERSEDES" && rel.relationType !== "DERIVED_FROM") continue;

        const nextId = rel.targetItemId;
        const edgeDirection: "PREDECESSOR" | "DERIVATION_SOURCE" =
          rel.relationType === "SUPERSEDES" ? "PREDECESSOR" : "DERIVATION_SOURCE";

        edges.push({
          relationId: rel.id,
          relationType: rel.relationType,
          sourceItemId: rel.sourceItemId,
          targetItemId: rel.targetItemId,
          rationale: rel.rationale,
          createdAt: rel.createdAt,
          validFrom: rel.validFrom,
          recordedAt: rel.recordedAt,
          direction: edgeDirection,
        });

        if (currentPath.includes(nextId)) {
          cyclesDetected.push([...currentPath, nextId]);
          continue;
        }

        if (!visitedNodes.has(nextId)) {
          const nextNode = createLineageNode(nextId, currentDepth - 1, false);
          visitedNodes.set(nextId, nextNode);
          traverseBackward(nextId, currentDepth - 1, [...currentPath, nextId]);
        }
      }
    };

    // Forward Traversal (Successors)
    const traverseForward = (currentId: string, currentDepth: number, currentPath: string[]) => {
      if (currentDepth >= maxDepth) {
        maxDepthReached = true;
        return;
      }
      if (visitedNodes.size >= maxNodes) {
        truncated = true;
        return;
      }

      for (const rel of relations) {
        if (rel.targetItemId !== currentId) continue;
        if (rel.relationType !== "SUPERSEDES" && rel.relationType !== "DERIVED_FROM") continue;

        const nextId = rel.sourceItemId;
        const edgeDirection: "SUCCESSOR" | "DERIVATION_TARGET" =
          rel.relationType === "SUPERSEDES" ? "SUCCESSOR" : "DERIVATION_TARGET";

        edges.push({
          relationId: rel.id,
          relationType: rel.relationType,
          sourceItemId: rel.sourceItemId,
          targetItemId: rel.targetItemId,
          rationale: rel.rationale,
          createdAt: rel.createdAt,
          validFrom: rel.validFrom,
          recordedAt: rel.recordedAt,
          direction: edgeDirection,
        });

        if (currentPath.includes(nextId)) {
          cyclesDetected.push([...currentPath, nextId]);
          continue;
        }

        if (!visitedNodes.has(nextId)) {
          const nextNode = createLineageNode(nextId, currentDepth + 1, false);
          visitedNodes.set(nextId, nextNode);
          traverseForward(nextId, currentDepth + 1, [...currentPath, nextId]);
        }
      }
    };

    traverseBackward(targetItem.id, 0, [targetItem.id]);
    traverseForward(targetItem.id, 0, [targetItem.id]);

    // Deduplicate edges & Sort deterministically
    const uniqueEdgesMap = new Map<string, LineageEdge>();
    for (const e of edges) {
      uniqueEdgesMap.set(e.relationId, e);
    }
    const sortedEdges = Array.from(uniqueEdgesMap.values()).sort((a, b) => a.relationId.localeCompare(b.relationId));

    const sortedNodes = Array.from(visitedNodes.values()).sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.itemId.localeCompare(b.itemId);
    });

    const allPredecessorIds = sortedNodes.filter(n => n.depth < 0).map(n => n.itemId);
    const allSuccessorIds = sortedNodes.filter(n => n.depth > 0).map(n => n.itemId);

    const rootPredecessors = allPredecessorIds.filter(id => {
      return !sortedEdges.some(e => e.sourceItemId === id && (e.relationType === "SUPERSEDES" || e.relationType === "DERIVED_FROM"));
    });

    const terminalSuccessors = allSuccessorIds.filter(id => {
      return !sortedEdges.some(e => e.targetItemId === id && (e.relationType === "SUPERSEDES" || e.relationType === "DERIVED_FROM"));
    });

    const contradictions = params.includeContradictions !== false
      ? this.findItemContradictions(researches, targetItem.id, params.asOfValidTime)
      : [];

    const predecessorsCount = allPredecessorIds.length;
    const successorsCount = allSuccessorIds.length;
    const derivationsCount = sortedEdges.filter(e => e.relationType === "DERIVED_FROM").length;
    const activeConflicts = contradictions.filter(c => c.activeAtTargetValidTime);
    const hasActiveContradiction = activeConflicts.length > 0;
    const hasPendingReview = contradictions.some(c => c.requiresHumanReview);

    const uncertainties: string[] = [];
    if (sortedNodes.some(n => !n.validityWindow.validFrom && !n.validityWindow.validUntil && !n.isBroken)) {
      uncertainties.push("Lineage contains legacy knowledge items without explicit domain validity intervals.");
    }
    if (sortedNodes.some(n => n.isBroken)) {
      uncertainties.push("Lineage contains broken references to deleted or missing knowledge items.");
    }
    if (cyclesDetected.length > 0) {
      uncertainties.push(`Cyclic relations detected and safely bounded: ${cyclesDetected.length} cycle(s).`);
    }

    const actionableRecommendations: string[] = [];
    if (hasActiveContradiction) {
      actionableRecommendations.push(
        `Critical: ${activeConflicts.length} active contradiction(s) detected. Reconcile or supersede conflicting decisions.`
      );
    }
    if (targetNode.lifecycleState === "SUPERSEDED" && terminalSuccessors.length > 0) {
      actionableRecommendations.push(
        `Notice: Target decision '${targetNode.itemId}' is SUPERSEDED. Consult terminal active successor(s): ${terminalSuccessors.join(", ")}.`
      );
    }
    if (sortedNodes.some(n => n.isBroken)) {
      actionableRecommendations.push(
        "Audit and repair broken knowledge relations referencing unresolvable items."
      );
    }

    const predStr = predecessorsCount > 0 ? `${predecessorsCount} predecessor(s)` : "no recorded predecessors (root origin)";
    const succStr = successorsCount > 0 ? `${successorsCount} successor(s)` : "no recorded successors (terminal active)";
    const confStr = hasActiveContradiction ? `⚠️ ACTIVE CONFLICTS DETECTED (${activeConflicts.length})` : "no active conflicts";

    const summaryNarrative = [
      `Decision '${targetNode.title}' [${targetNode.itemId}] (Lifecycle: ${targetNode.lifecycleState}, Epistemic: ${targetNode.epistemicStatus}).`,
      `Lineage: Traced to ${predStr} and ${succStr}. Derivations: ${derivationsCount}.`,
      `Temporal Contradictions: ${confStr}.`,
    ].join(" ");

    const synthesis: DecisionSynthesis = {
      currentEffectiveState: targetNode.lifecycleState,
      currentEpistemicStatus: targetNode.epistemicStatus,
      summaryNarrative,
      predecessorsCount,
      successorsCount,
      derivationsCount,
      activeConflictsCount: activeConflicts.length,
      hasActiveContradiction,
      hasPendingReview,
      uncertainties,
      actionableRecommendations,
    };

    return {
      targetItemId: targetItem.id,
      targetFound: true,
      projectId: params.projectId || "unknown",
      scope: params.scope,
      targetNode,
      nodes: sortedNodes,
      edges: sortedEdges,
      rootPredecessors,
      terminalSuccessors,
      cyclesDetected,
      contradictions,
      synthesis,
      truncated,
      maxDepthReached,
      queryTimestamp: nowIso,
    };
  }

  /**
   * Pure Truth Maintenance System (TMS) graph analysis (Tier A - F13.2-B)
   */
  public analyzeTMS(
    researches: ResearchRecord[],
    filter?: {
      researchId?: string;
      itemId?: string;
    }
  ): TMSAnalysisResult {
    const itemMap = new Map<string, { item: KnowledgeItem; researchId: string }>();

    for (const r of researches) {
      for (const item of r.items) {
        itemMap.set(item.id, { item, researchId: r.id });
      }
    }

    const overallDiagnostics: string[] = [];
    let isOverallDegraded = false;
    let totalRelationsCount = 0;
    let targetNotFoundCount = 0;

    const viewsMap = new Map<string, KnowledgeItemTMSView>();

    // Initialize views for all items
    for (const [itemId, { item, researchId }] of itemMap.entries()) {
      viewsMap.set(itemId, {
        itemId,
        researchRecordId: researchId,
        canonicalLifecycleState: item.lifecycleState || "LEGACY_UNEVALUATED",
        derivedConflictState: "CONSISTENT",
        derivedLineageStatus: "NONE",
        diagnostics: [],
        relations: [],
      });
    }

    const validTypes: KnowledgeRelationType[] = [
      "SUPPORTS",
      "CONTRADICTS",
      "SUPERSEDES",
      "DERIVED_FROM",
      "QUALIFIES",
    ];

    interface ValidatedRelation {
      rel: KnowledgeRelation;
      owningResearchRecordId: string;
      targetStatus: "EXISTS" | "TARGET_NOT_FOUND";
    }

    const validRelations: ValidatedRelation[] = [];

    // 1. Inspect and validate relations
    for (const r of researches) {
      const recordRelations = r.relations || [];
      for (const rel of recordRelations) {
        totalRelationsCount++;

        let isMalformed = false;
        let malformedReason = "";

        if (!rel || typeof rel !== "object") {
          isMalformed = true;
          malformedReason = "Relation object is null or not an object.";
        } else if (!rel.id || typeof rel.id !== "string") {
          isMalformed = true;
          malformedReason = "Relation missing valid string 'id'.";
        } else if (!rel.relationType || !validTypes.includes(rel.relationType)) {
          isMalformed = true;
          malformedReason = `Relation '${rel?.id || "unknown"}' has invalid relationType '${rel?.relationType}'.`;
        } else if (
          !rel.sourceItemId ||
          typeof rel.sourceItemId !== "string" ||
          !rel.targetItemId ||
          typeof rel.targetItemId !== "string"
        ) {
          isMalformed = true;
          malformedReason = `Relation '${rel?.id || "unknown"}' has missing or empty sourceItemId or targetItemId.`;
        } else if (!rel.createdAt || !rel.provenance || !rel.provenance.agentId) {
          isMalformed = true;
          malformedReason = `Relation '${rel?.id || "unknown"}' has missing or malformed provenance/createdAt metadata.`;
        }

        if (isMalformed) {
          isOverallDegraded = true;
          const diagMsg = `Malformed relation detected in ResearchRecord '${r.id}': ${malformedReason}`;
          overallDiagnostics.push(diagMsg);

          if (rel?.sourceItemId && viewsMap.has(rel.sourceItemId)) {
            const v = viewsMap.get(rel.sourceItemId)!;
            v.isDegraded = true;
            v.diagnostics.push(`Degraded relation '${rel?.id || "unknown"}': ${malformedReason}`);
          }
          continue;
        }

        const targetExists = itemMap.has(rel.targetItemId);
        if (!targetExists) {
          targetNotFoundCount++;
        }

        validRelations.push({
          rel,
          owningResearchRecordId: r.id,
          targetStatus: targetExists ? "EXISTS" : "TARGET_NOT_FOUND",
        });
      }
    }

    // 2. Populate source relations lists
    for (const vr of validRelations) {
      const { rel, owningResearchRecordId, targetStatus } = vr;
      if (viewsMap.has(rel.sourceItemId)) {
        const sourceView = viewsMap.get(rel.sourceItemId)!;
        sourceView.relations.push({
          ...rel,
          owningResearchRecordId,
          targetStatus,
        });
      }
    }

    // 3. Process CONTRADICTS relations symmetrically
    for (const vr of validRelations) {
      const { rel, owningResearchRecordId } = vr;
      if (rel.relationType === "CONTRADICTS") {
        const sourceView = viewsMap.get(rel.sourceItemId);
        const targetView = viewsMap.get(rel.targetItemId);

        if (sourceView) {
          sourceView.derivedConflictState = "CONFLICTED";
          sourceView.diagnostics.push(`Contradiction detected with target item '${rel.targetItemId}'.`);
        }

        if (targetView) {
          targetView.derivedConflictState = "CONFLICTED";
          targetView.diagnostics.push(`Contradiction detected with source item '${rel.sourceItemId}'.`);

          const hasSymmetric = targetView.relations.some(r => r.id === rel.id && r.isSymmetric);
          if (!hasSymmetric) {
            targetView.relations.push({
              ...rel,
              owningResearchRecordId,
              targetStatus: sourceView ? "EXISTS" : "TARGET_NOT_FOUND",
              isSymmetric: true,
            });
          }
        }
      }
    }

    // 4. SUPERSEDES Graph Analysis & Cycle Detection
    const supersedesEdges = validRelations.filter(vr => vr.rel.relationType === "SUPERSEDES");

    const supersedesAdj = new Map<string, string[]>();
    for (const vr of supersedesEdges) {
      const s = vr.rel.sourceItemId;
      const t = vr.rel.targetItemId;
      if (!supersedesAdj.has(s)) supersedesAdj.set(s, []);
      supersedesAdj.get(s)!.push(t);
    }

    const cycleNodes = new Set<string>();
    for (const startNode of itemMap.keys()) {
      const outgoing = supersedesAdj.get(startNode) || [];
      let foundCycle = false;
      for (const firstHop of outgoing) {
        const bfsQueue = [firstHop];
        const bfsVisited = new Set<string>([firstHop]);

        while (bfsQueue.length > 0) {
          const curr = bfsQueue.shift()!;
          if (curr === startNode) {
            foundCycle = true;
            break;
          }
          for (const nextNode of supersedesAdj.get(curr) || []) {
            if (!bfsVisited.has(nextNode)) {
              bfsVisited.add(nextNode);
              bfsQueue.push(nextNode);
            }
          }
        }
        if (foundCycle) break;
      }

      if (foundCycle) {
        cycleNodes.add(startNode);
      }
    }

    for (const node of cycleNodes) {
      const v = viewsMap.get(node);
      if (v) {
        v.derivedConflictState = "UNRESOLVED";
        v.diagnostics.push(`Supersession cycle detected involving item '${node}'. Derived supersession blocked.`);
      }
    }

    for (const vr of supersedesEdges) {
      const sId = vr.rel.sourceItemId;
      const tId = vr.rel.targetItemId;

      if (cycleNodes.has(sId) || cycleNodes.has(tId)) {
        continue;
      }

      const sourceView = viewsMap.get(sId);
      const targetView = viewsMap.get(tId);

      if (sourceView && sourceView.canonicalLifecycleState === "ACCEPTED") {
        if (sourceView.derivedLineageStatus !== "SUPERSEDED_BY_ACCEPTED_SOURCE") {
          sourceView.derivedLineageStatus = "SUPERSEDING";
        }
        if (targetView) {
          targetView.derivedLineageStatus = "SUPERSEDED_BY_ACCEPTED_SOURCE";
        }
      }
    }

    // 5. SUPPORTS Cycles Detection
    const supportsEdges = validRelations.filter(vr => vr.rel.relationType === "SUPPORTS");
    const supportsAdj = new Map<string, string[]>();
    for (const vr of supportsEdges) {
      const s = vr.rel.sourceItemId;
      const t = vr.rel.targetItemId;
      if (!supportsAdj.has(s)) supportsAdj.set(s, []);
      supportsAdj.get(s)!.push(t);
    }

    for (const startNode of itemMap.keys()) {
      const outgoing = supportsAdj.get(startNode) || [];
      let foundCycle = false;
      for (const firstHop of outgoing) {
        const bfsQueue = [firstHop];
        const bfsVisited = new Set<string>([firstHop]);

        while (bfsQueue.length > 0) {
          const curr = bfsQueue.shift()!;
          if (curr === startNode) {
            foundCycle = true;
            break;
          }
          for (const nextNode of supportsAdj.get(curr) || []) {
            if (!bfsVisited.has(nextNode)) {
              bfsVisited.add(nextNode);
              bfsQueue.push(nextNode);
            }
          }
        }
        if (foundCycle) break;
      }

      if (foundCycle) {
        const v = viewsMap.get(startNode);
        if (v) {
          v.diagnostics.push(`Structurally permitted SUPPORT cycle detected involving item '${startNode}'. No truth inferred.`);
        }
      }
    }

    // 6. Bi-temporal Contradiction Detection (Hito G30)
    const temporalReport = this.detectTemporalContradictions(researches);
    for (const diag of temporalReport.diagnostics) {
      overallDiagnostics.push(diag);
    }

    const itemsResult: Record<string, KnowledgeItemTMSView> = {};
    let consistentCount = 0;
    let conflictedCount = 0;
    let unresolvedCount = 0;
    let degradedCount = 0;

    for (const [id, view] of viewsMap.entries()) {
      if (filter?.researchId && view.researchRecordId !== filter.researchId) {
        continue;
      }
      if (filter?.itemId && id !== filter.itemId) {
        continue;
      }

      itemsResult[id] = view;

      if (view.isDegraded) degradedCount++;
      if (view.derivedConflictState === "UNRESOLVED") unresolvedCount++;
      else if (view.derivedConflictState === "CONFLICTED") conflictedCount++;
      else consistentCount++;
    }

    let overallStatus: "CONSISTENT" | "CONFLICTED" | "UNRESOLVED" | "DEGRADED" = "CONSISTENT";
    if (isOverallDegraded || degradedCount > 0) {
      overallStatus = "DEGRADED";
    } else if (unresolvedCount > 0) {
      overallStatus = "UNRESOLVED";
    } else if (conflictedCount > 0) {
      overallStatus = "CONFLICTED";
    }

    return {
      overallStatus,
      diagnostics: overallDiagnostics,
      items: itemsResult,
      summary: {
        totalItems: Object.keys(itemsResult).length,
        totalRelations: totalRelationsCount,
        consistentCount,
        conflictedCount,
        unresolvedCount,
        degradedCount,
        targetNotFoundCount,
      },
    };
  }
}
