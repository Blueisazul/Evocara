# OpenMemory Conceptual & Domain Contracts (v0.3.2)

> **Status:** Consumer-Ready Verified<br>
> **Package Version:** `0.3.2`

This document formalizes the domain contracts, structural distinctions, authority principles, and conflict resolution models governing OpenMemory v0.3.1.

---

## 📐 Key Domain Contracts

| Contract Domain | Definition & Purpose | Key Data Fields |
| :--- | :--- | :--- |
| **Project State** | Global container representing the repository's operational memory and stage progression. | `currentStage`, `currentStatus`, `activeGoal`, `roadmap`, `sessions` |
| **Roadmap** | Multi-phase milestone planning structure containing sequence of major project goals. | `activePhaseId`, `phases[]`, `updatedAt` |
| **Phase** | Macro milestone within a Roadmap representing a deliverable feature or system boundary. | `id`, `name`, `status` (`IN_PROGRESS`, `COMPLETED`), `deliverables[]` |
| **Stage** | Operational step within the 12-phase Master Prompt state machine (`DESCUBRIR` -> `PREPARAR_CONTINUIDAD`). | `currentStage`, `phaseStatus`, `approvalRequired`, `canModifyCode` |
| **Session Record** | Persistent metadata tracking an agent's participation, run count, status, and timestamps. | `id`, `agentId`, `status` (`ACTIVE`, `IDLE`, `COMPACTED`, `COMPLETED`, `ABORTED`), `lastActiveAt` |
| **Session Runtime** | Ephemeral process execution context managed by the host IDE (e.g. OpenCode conversation thread). | `sessionID`, environment, memory handles |
| **Task DAG** | Coordination task unit supporting dependencies, status tracking, and atomic claim ownership. | `id`, `title`, `status`, `assignedAgentId`, `assignedSessionId`, `dependsOn[]` |
| **Knowledge Record** | Synthesized research knowledge artifact containing provenance, classification, and items. | `id`, `topic`, `category`, `summary`, `items[]`, `relatedAdrId` |
| **ADR (Decision)** | MADR-formatted Architecture Decision Record subject to multi-agent consensus governance. | `id`, `title`, `status` (`PROPOSED`, `ACCEPTED`, `REJECTED`, `SUPERSEDED`), `votes[]` |
| **Handoff** | Structured Markdown narrative (`.openmemory/handoff.md`) capturing cross-session continuity. | `activeGoal`, `activePhase`, `progressSummary[]`, `nextSteps[]` |

---

## 🔍 Structural Distinctions

### 1. `Roadmap` ≠ `Phase`
A **Roadmap** represents the entire macro progression plan of a project, whereas a **Phase** is an individual high-level milestone (`PHASE-1`, `PHASE-2`) within that roadmap.

### 2. `Phase` ≠ `Stage`
A **Phase** defines *what feature or system milestone* is being built. A **Stage** defines *the operational governance step* (`DESCUBRIR`, `DISEÑAR`, `IMPLEMENTAR`, `VALIDAR`) of the Master Prompt cycle being executed.

### 3. `Session Runtime` ≠ `Session Record`
The **Session Runtime** is the short-lived process managed by OpenCode/Host IDE. The **Session Record** is the persistent identity stored in `.openmemory/project-state.json` allowing multi-agent coordination and cross-session auditability.

### 4. Conversational Compaction ≠ Persistent Memory Extraction
Conversational compaction is the LLM context-window truncation mechanism. Persistent memory extraction is OpenMemory's process of capturing structured knowledge, ADRs, and handoff narratives to disk before or during compaction.

---

## ⚖️ Authority & Epistemological Rules

OpenMemory enforces strict principles regarding truth, recency, and authority:

* **`AUTHORITY != TRUTH`:** Being created by a primary agent does not automatically make an assertion true.
* **`FRESHNESS != TRUTH`:** A newer timestamp does not invalidate an established architectural decision without explicit supersession.
* **`EVIDENCE != AUTHORITY`:** Raw log outputs or search snippets are evidence, not binding architectural consensus.
* **`CONFLICT != AUTOMATIC SUPERSESSION`:** When two knowledge records or decisions contradict each other, OpenMemory does **not** automatically overwrite the existing record.

---

## ⚔️ Conflict Governance Flow

When contradictory knowledge items or conflicting architectural proposals are detected during knowledge recording or query assembly:

```text
  [ Incoming Knowledge / ADR Proposal ]
                     │
                     ▼
          Does it contradict existing
             accepted knowledge/ADR?
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
       [ NO ]                 [ YES ]
         │                       │
         ▼                       ▼
  [ Save Record ]       [ Mark CONFLICTED ]
                         │
                         ▼
                [ EXCLUDE_BOTH ]
            (Exclude from prompt context
              to prevent hallucination)
                         │
                         ▼
              [ GOVERNANCE NOTICE ]
             (Issue alert via status)
                         │
                         ▼
              [ Explicit Resolution ]
         (Human Gate Approval / ADR Vote)
                         │
                         ▼
               [ SUPERSEDES Status ]
           (Archive old record safely)
```

1. **`CONTRADICTS`:** Detected contradiction during synthesis.
2. **`CONFLICTED`:** Record is flagged with conflict state metadata.
3. **`EXCLUDE_BOTH`:** Both conflicting items are temporarily excluded from automated prompt injection to protect agent reasoning.
4. **`GOVERNANCE NOTICE`:** OpenMemory issues a warning report to the user/agent.
5. **`Explicit Resolution`:** Human approval or formal ADR vote resolves the contradiction.
6. **`SUPERSEDES`:** The superseded record status is updated to `SUPERSEDED` and linked to the new authoritative decision.
