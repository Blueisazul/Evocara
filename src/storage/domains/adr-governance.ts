import { ADRRecord, ADRVote } from "../types";

/**
 * ADRGovernance Domain Module (F13.3.3)
 * Pure domain handler for Architectural Decision Records (ADRs).
 * Manages Markdown parsing/formatting, consensus evaluation, vote application, and ID formatting.
 * Does NOT perform file I/O, does NOT manage locks, does NOT log events directly.
 */
export class ADRGovernance {
  /**
   * Parse ADR Markdown file content into structured ADRRecord
   */
  public parseADRMarkdown(content: string, filename: string): ADRRecord {
    const cleanFilename = filename.replace(/^.*[\\/]/, "");
    const fallbackId = cleanFilename.endsWith(".md") ? cleanFilename.slice(0, -3) : cleanFilename;
    const lines = content.split("\n");

    let id = fallbackId;
    let title = fallbackId;
    let status: ADRRecord["status"] = "ACCEPTED";
    let date = new Date().toISOString().split("T")[0];
    let proposedByAgentId: string | undefined;
    let requiredVotes: number | undefined;
    let votes: ADRVote[] = [];

    // Check for structured JSON comments <!-- ADRData: {...} -->
    const jsonMatches = Array.from(content.matchAll(/<!-- ADRData:\s*(\{[\s\S]*?\})\s*-->/g));
    if (jsonMatches.length > 0) {
      const lastMatch = jsonMatches[jsonMatches.length - 1];
      try {
        const parsedData = JSON.parse(lastMatch[1]);
        if (parsedData.proposedByAgentId) proposedByAgentId = parsedData.proposedByAgentId;
        if (parsedData.requiredVotes !== undefined) requiredVotes = parsedData.requiredVotes;
        if (Array.isArray(parsedData.votes)) votes = parsedData.votes;
      } catch (_) {}
    }

    const headerLine = lines.find((l) => l.startsWith("# "));
    if (headerLine) {
      const headerText = headerLine.substring(2).trim();
      const match = headerText.match(/^(ADR-\d+):\s*(.*)$/);
      if (match) {
        id = match[1];
        title = match[2];
      } else {
        title = headerText;
      }
    }

    const statusLine = lines.find((l) => l.includes("**Status:**"));
    if (statusLine) {
      const match = statusLine.match(/\*\*Status:\*\*\s*(\w+)/);
      if (match) {
        status = match[1] as ADRRecord["status"];
      }
    }

    const dateLine = lines.find((l) => l.includes("**Date:**"));
    if (dateLine) {
      const match = dateLine.match(/\*\*Date:\*\*\s*([\d-]+)/);
      if (match) {
        date = match[1];
      }
    }

    const proposedByLine = lines.find((l) => l.includes("**Proposed By:**"));
    if (proposedByLine && !proposedByAgentId) {
      const match = proposedByLine.match(/\*\*Proposed By:\*\*\s*(.+)/);
      if (match) proposedByAgentId = match[1].trim();
    }

    const requiredVotesLine = lines.find((l) => l.includes("**Required Votes:**"));
    if (requiredVotesLine && requiredVotes === undefined) {
      const match = requiredVotesLine.match(/\*\*Required Votes:\*\*\s*(\d+)/);
      if (match) requiredVotes = parseInt(match[1], 10);
    }

    let currentSection = "";
    let contextLines: string[] = [];
    let decisionLines: string[] = [];
    let consequencesLines: string[] = [];

    for (const line of lines) {
      if (line.trim().startsWith("<!--")) {
        continue;
      }
      if (line.startsWith("## ")) {
        currentSection = line.substring(3).trim().toLowerCase();
        continue;
      }
      if (currentSection === "context") {
        contextLines.push(line);
      } else if (currentSection === "decision") {
        decisionLines.push(line);
      } else if (currentSection === "consequences") {
        consequencesLines.push(line);
      }
    }

    return {
      id,
      title,
      status,
      date,
      context: contextLines.join("\n").trim(),
      decision: decisionLines.join("\n").trim(),
      consequences: consequencesLines.length > 0 ? consequencesLines.join("\n").trim() : undefined,
      proposedByAgentId,
      requiredVotes: requiredVotes !== undefined ? requiredVotes : 2,
      votes,
    };
  }

  /**
   * Format ADRRecord into canonical Markdown string representation
   */
  public formatADRMarkdown(record: ADRRecord): string {
    const cleanSection = (text: string) => text.replace(/<!-- ADRData:[\s\S]*?-->/g, "").trim();

    let metadataHeader = `**Status:** ${record.status}  \n**Date:** ${record.date}  \n`;
    if (record.proposedByAgentId) {
      metadataHeader += `**Proposed By:** ${record.proposedByAgentId}  \n`;
    }
    if (record.requiredVotes !== undefined) {
      metadataHeader += `**Required Votes:** ${record.requiredVotes}  \n`;
    }

    let votesSection = "";
    if (record.votes && record.votes.length > 0) {
      votesSection =
        `\n## Votes\n` +
        record.votes
          .map(
            (v) =>
              `- **${v.agentId}**${v.sessionId ? ` [${v.sessionId}]` : ""}: ${v.decision} (${v.timestamp})${v.rationale ? ` - ${v.rationale}` : ""}`
          )
          .join("\n") +
        "\n";
    }

    const dataPayload = {
      proposedByAgentId: record.proposedByAgentId,
      requiredVotes: record.requiredVotes,
      votes: record.votes,
    };

    const cleanContext = cleanSection(record.context);
    const cleanDecision = cleanSection(record.decision);
    const cleanConsequences = record.consequences ? cleanSection(record.consequences) : undefined;

    return `# ${record.id}: ${record.title}\n\n${metadataHeader}\n## Context\n${cleanContext.trim()}\n\n## Decision\n${cleanDecision.trim()}\n${
      cleanConsequences ? `\n## Consequences\n${cleanConsequences.trim()}\n` : ""
    }${votesSection}\n<!-- ADRData: ${JSON.stringify(dataPayload)} -->\n`;
  }

  /**
   * Evaluate multi-agent ADR voting consensus deterministically (F9.2)
   */
  public evaluateConsensus(adr: ADRRecord): ADRRecord["status"] {
    if (adr.status === "SUPERSEDE" || adr.status === "DEPRECATED") {
      return adr.status;
    }

    const requiredVotes = adr.requiredVotes || 2;
    const votes = adr.votes || [];

    if (votes.length === 0) {
      return adr.status || "PROPOSED";
    }

    const approveCount = votes.filter((v) => v.decision === "APPROVE").length;
    const rejectCount = votes.filter((v) => v.decision === "REJECT").length;

    if (approveCount >= requiredVotes && rejectCount === 0) {
      return "ACCEPTED";
    }

    if (rejectCount >= requiredVotes || (rejectCount >= 1 && approveCount + rejectCount >= requiredVotes)) {
      return "REJECTED";
    }

    return "IN_REVIEW";
  }

  /**
   * Validate that direct status mutation via saveADR does not bypass consensus voting
   */
  public validateDirectStatusMutation(status?: ADRRecord["status"]): void {
    if (status === "ACCEPTED" || status === "REJECTED") {
      throw new Error(
        `Direct mutation of ADR status to '${status}' via saveADR is forbidden. Status transitions must occur through consensus voting via voteADR().`
      );
    }
  }

  /**
   * Apply vote to ADR record and re-evaluate consensus status
   */
  public applyVote(
    adr: ADRRecord,
    vote: ADRVote
  ): { updatedADR: ADRRecord; newStatus: ADRRecord["status"] } {
    const votes = Array.isArray(adr.votes) ? [...adr.votes] : [];
    const existingIndex = votes.findIndex((v) => v.agentId === vote.agentId);

    if (existingIndex >= 0) {
      votes[existingIndex] = vote;
    } else {
      votes.push(vote);
    }

    const updatedADR: ADRRecord = {
      ...adr,
      votes,
    };

    const newStatus = this.evaluateConsensus(updatedADR);
    updatedADR.status = newStatus;

    return { updatedADR, newStatus };
  }

  /**
   * Generate next sequential ADR ID preserving legacy length + 1 rule
   */
  public generateNextId(existingIds: string[]): string {
    const nextNum = existingIds.length + 1;
    return `ADR-${String(nextNum).padStart(3, "0")}`;
  }
}
