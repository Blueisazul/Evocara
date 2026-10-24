import { HandoffSection } from "../types";

export interface HandoffContext {
  projectName?: string;
  activeGoal?: string;
  activePhase?: string;
  currentStatus?: string;
  maxWords: number;
  isInternalOpenMemory: boolean;
}

export interface HandoffUpdates {
  activeGoal?: string;
  activePhase?: string;
  progressSummary?: string[];
  nextSteps?: string[];
}

export class HandoffContinuity {
  /**
   * Parse Markdown Handoff into sections delimited by '## ' headers (F3.3-001)
   */
  public parseSections(markdown: string): HandoffSection[] {
    const lines = markdown.split("\n");
    const sections: HandoffSection[] = [];
    let currentTitle = "";
    let currentContent: string[] = [];

    const autoOwnedTitles = [
      "Progress Summary",
      "Uncommitted Work & Next Steps",
      "Uncommitted Work and Next Steps",
    ];

    for (const line of lines) {
      if (line.startsWith("## ")) {
        if (currentContent.length > 0 || currentTitle !== "") {
          sections.push({
            title: currentTitle,
            content: currentContent.join("\n"),
            isAutoOwned: currentTitle === "" ? true : autoOwnedTitles.includes(currentTitle.trim()),
          });
        }
        currentTitle = line.substring(3).trim();
        currentContent = [line];
      } else {
        currentContent.push(line);
      }
    }

    if (currentContent.length > 0) {
      sections.push({
        title: currentTitle,
        content: currentContent.join("\n"),
        isAutoOwned: currentTitle === "" ? true : autoOwnedTitles.includes(currentTitle.trim()),
      });
    }

    return sections;
  }

  /**
   * Word count ceiling safeguard (F3.3-003)
   */
  public truncateWords(markdown: string, maxWords: number): string {
    const words = markdown.split(/\s+/);
    if (words.length <= maxWords) {
      return markdown;
    }
    // Truncate narrative while keeping valid file trailing notice
    const truncatedWords = words.slice(0, maxWords);
    return truncatedWords.join(" ") + "\n\n*(Truncated to maxHandoffWords limit)*\n";
  }

  /**
   * Generate default handoff content according to project configuration
   */
  public formatDefaultHandoff(context: {
    projectName?: string;
    activeGoal?: string;
    activePhase?: string;
    currentStatus?: string;
    isInternalOpenMemory: boolean;
  }): string {
    const { projectName, activeGoal, activePhase, currentStatus, isInternalOpenMemory } = context;

    return isInternalOpenMemory
      ? `# OpenMemory Session Handoff

**Active Goal:** Implement OpenMemory v0.1 Core Engine\n**Current Phase:** Phase 3 — Implementation\n**Last Updated:** ${new Date().toISOString()}\n
## Progress Summary
* Phase 1, 1.5, 2, and 2.5 research & spike completed cleanly.
* F3.1 Storage Foundation and F3.2 Official Plugin implemented and tested.

## Key Architectural Decisions
* Zero-dependency native OpenCode TypeScript plugin.
* Markdown + Structured JSON State Engine with atomic file writers (\`.tmp\` + \`fs.renameSync\`).

## Uncommitted Work & Next Steps
1. Complete F3.3 Session Handoff & Continuity Engine test suite.
2. Register native slash commands /memory-status and /handoff (F3.4).
`
      : `# Session Handoff — ${projectName}

**Active Goal:** ${activeGoal}\n**Current Phase:** ${activePhase}\n**Last Updated:** ${new Date().toISOString()}\n
## Progress Summary
* Proyecto ${projectName} inicializado de forma limpia con el framework OpenMemory.
* Fase activa: ${activePhase} (${currentStatus}).

## Key Architectural Decisions
* Gobernanza de OpenMemory activada con salvaguarda de código de producción.

## Uncommitted Work & Next Steps
1. Completar la inspección del dominio y aclaración de requerimientos.
2. Definir los entregables de la fase ${activePhase}.
`;
  }

  /**
   * Updates auto-owned sections while preserving human-owned sections verbatim (F12.4-B)
   */
  public composeUpdate(
    rawHandoff: string,
    updates: HandoffUpdates,
    context: HandoffContext
  ): string {
    const parsedSections = this.parseSections(rawHandoff);
    const {
      projectName,
      activeGoal: stateActiveGoal,
      activePhase: stateActivePhase,
      currentStatus,
      maxWords,
      isInternalOpenMemory,
    } = context;

    const updatedSections: string[] = [];

    // Header block (before first ## header)
    const activeGoal =
      updates.activeGoal ||
      stateActiveGoal ||
      (isInternalOpenMemory
        ? "Implement OpenMemory v0.1 Core Engine"
        : `Inicialización del proyecto ${projectName}`);
    const activePhase =
      updates.activePhase ||
      stateActivePhase ||
      (isInternalOpenMemory ? "Phase 3 — Implementation" : "DESCUBRIR");
    const newHeader = isInternalOpenMemory
      ? `# OpenMemory Session Handoff\n\n**Active Goal:** ${activeGoal}  \n**Current Phase:** ${activePhase}  \n**Last Updated:** ${new Date().toISOString()}  \n`
      : `# Session Handoff — ${projectName}\n\n**Active Goal:** ${activeGoal}  \n**Current Phase:** ${activePhase}  \n**Last Updated:** ${new Date().toISOString()}  \n`;

    updatedSections.push(newHeader);

    // Track which auto sections were updated
    let progressSummaryAdded = false;
    let nextStepsAdded = false;

    for (const section of parsedSections) {
      if (section.title === "") {
        // Top header block already replaced by newHeader
        continue;
      }

      if (section.title.trim() === "Progress Summary") {
        const summaryItems =
          updates.progressSummary ||
          (isInternalOpenMemory
            ? [
                "Phase 1, 1.5, 2, and 2.5 research & spike completed cleanly.",
                "F3.1 Storage Foundation, F3.2 Plugin, and F3.3 Handoff Engine active.",
              ]
            : [`Fase activa: ${activePhase} (${currentStatus}).`]);
        const newProgressSection = `## Progress Summary\n${summaryItems.map((item) => `* ${item}`).join("\n")}\n`;
        updatedSections.push(newProgressSection);
        progressSummaryAdded = true;
      } else if (
        section.title.trim() === "Uncommitted Work & Next Steps" ||
        section.title.trim() === "Uncommitted Work and Next Steps"
      ) {
        const stepItems =
          updates.nextSteps ||
          (isInternalOpenMemory
            ? [
                "Complete F3.3 Session Handoff & Continuity Engine test suite.",
                "Implement slash commands /memory-status and /handoff (F3.4).",
              ]
            : [`Completar entregables y Definition of Done de la fase ${activePhase}.`]);
        const newNextStepsSection = `## Uncommitted Work & Next Steps\n${stepItems
          .map((item, i) => `${i + 1}. ${item}`)
          .join("\n")}\n`;
        updatedSections.push(newNextStepsSection);
        nextStepsAdded = true;
      } else {
        // Human-owned or custom section: PRESERVE VERBATIM (F3.3-006 & F12.4-B)
        updatedSections.push(section.content.trim() + "\n");
      }
    }

    // Add auto-sections if they didn't exist in original handoff
    if (!progressSummaryAdded && updates.progressSummary) {
      updatedSections.push(
        `## Progress Summary\n${updates.progressSummary.map((item) => `* ${item}`).join("\n")}\n`
      );
    }
    if (!nextStepsAdded && updates.nextSteps) {
      updatedSections.push(
        `## Uncommitted Work & Next Steps\n${updates.nextSteps.map((item, i) => `${i + 1}. ${item}`).join("\n")}\n`
      );
    }

    let finalMarkdown = updatedSections.join("\n").trim() + "\n";

    // Enforce word ceiling
    finalMarkdown = this.truncateWords(finalMarkdown, maxWords);

    return finalMarkdown;
  }
}
