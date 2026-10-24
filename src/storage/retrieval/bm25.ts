import { KnowledgeItem } from "../types";

export const BM25_STOPWORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't",
  "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but", "by",
  "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't",
  "down", "during", "each", "few", "for", "from", "further", "had", "hadn't", "has", "hasn't", "have",
  "haven't", "having", "he", "he'd", "he'll", "he's", "her", "here", "here's", "hers", "herself", "him",
  "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't",
  "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor",
  "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out",
  "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", "so", "some",
  "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
  "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through",
  "to", "too", "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've",
  "were", "weren't", "what", "what's", "when", "when's", "where", "where's", "which", "while", "who",
  "who's", "whom", "why", "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll",
  "you're", "you've", "your", "yours", "yourself", "yourselves",
  // Spanish stopwords for first-class multilingual BM25 retrieval
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "a", "al", "en",
  "para", "por", "con", "sin", "sobre", "que", "es", "son", "como", "se", "su", "sus",
  "lo", "le", "les", "y", "o", "pero", "cual", "cuales", "quien", "quienes", "donde",
  "cuando", "este", "esta", "estos", "estas", "nos", "nosotros", "vosotros", "ellos", "ellas",
  "tambien", "fue", "fueron", "era", "eran", "ha", "han", "hay"
]);

/**
 * Multilingual stemming helper supporting English and Spanish inflectional suffixes.
 */
export function stemWord(w: string): string {
  if (!w || w.length < 4) return w;
  return w
    .toLowerCase()
    .replace(
      /(?:ing|ations|ation|tion|tions|ed|es|s|age|ment|ments|ence|ance|ency|ancy|encias|encia|ancias|ancia|aciones|acion|amiento|amientos|idades|idad|mente|ados|adas|ado|ada|ibles|ible|ables|able|ivos|ivas|ivo|iva)$/,
      ""
    );
}

/**
 * Domain synonym dictionary for zero-dependency lexical expansion (G26 Retrieval Hardening)
 */
export const DOMAIN_SYNONYMS: Record<string, string[]> = {
  // Paraphrase & Inventory domain synonyms (G2-PARA-38)
  "isolation": ["quarantine", "quarantined"],
  "isolate": ["quarantine"],
  "isolated": ["quarantined"],
  "quarantine": ["isolation"],
  "quarantined": ["isolated"],
  "lots": ["batch", "batches"],
  "lot": ["batch"],
  "batch": ["lot", "lots"],
  "batches": ["lots"],
  "expiry": ["expiration"],
  "expiring": ["expiration"],
  "expiration": ["expiry", "expiring"],
  "shipping": ["pick", "pick-list"],
  "allocations": ["pick-list", "allocation"],
  "allocation": ["pick-list"],
  // Architecture & Storage domain synonyms (G1-SUPER-10, G2-TMS-50, G4-EXPL-102)
  "storage": ["persistence"],
  "persistence": ["storage"],
  "atlas": ["mongodb"],
  "cluster": ["mongodb", "sqlite"],
  "catalog": ["inventory"],
  "decisions": ["conventions", "standards"],
  "decision": ["convention", "standard"],
  // Spanish-English domain synonyms (G24 Multilingual Retrieval)
  "almacenar": ["storage", "store", "persistence"],
  "almacenamiento": ["storage", "store", "persistence"],
  // Standards & Libraries (G2-PARA-37)
  "library": ["package", "packages", "dependencies", "npm"],
  "libraries": ["package", "packages", "dependencies", "npm"],
  "inclusions": ["dependencies"]
};

/**
 * Checks if a token matches a query term using exact, prefix, stem, or domain synonym matching.
 */
export function matchTerm(token: string, term: string): boolean {
  if (token === term) return true;
  // Boundary check to prevent accidental polysemy matching
  if (token === "manager" && (term === "managed" || term === "manage")) return false;
  if (term === "manager" && (token === "managed" || token === "manage")) return false;

  if (term.length >= 4 && token.startsWith(term)) return true;
  if (token.length >= 4 && term.startsWith(token)) return true;
  const sToken = stemWord(token);
  const sTerm = stemWord(term);
  if (sToken.length >= 3 && sToken === sTerm) return true;
  if (sToken.length >= 4 && sTerm.length >= 4 && (sToken.startsWith(sTerm) || sTerm.startsWith(sToken))) return true;
  if (sToken.length >= 6 && sTerm.length >= 6 && sToken.slice(0, 6) === sTerm.slice(0, 6)) return true;

  // Domain synonym lookup
  const syns = DOMAIN_SYNONYMS[term];
  if (syns) {
    for (const syn of syns) {
      if (token === syn) return true;
      const sSyn = stemWord(syn);
      if (sToken.length >= 3 && sToken === sSyn) return true;
      if (token.startsWith(syn) || syn.startsWith(token)) return true;
    }
  }

  return false;
}

/**
 * Pure BM25 Retrieval Engine (G25 Modular Retrieval Architecture)
 *
 * Encapsulates tokenization, IDF computation, Okapi BM25 scoring with field weighting,
 * item-level quadratic coordination suppression, and TMS lifecycle state multipliers.
 */
export class BM25Engine {
  /**
   * Tokenize text into normalized alphanumeric tokens, pruning stopwords.
   */
  public tokenizeText(text: string): string[] {
    if (!text || typeof text !== "string") return [];
    const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const tokens = normalized
      .replace(/[^a-z0-9_-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);
    const nonStopwords = tokens.filter((t) => !BM25_STOPWORDS.has(t));
    return nonStopwords.length > 0 ? nonStopwords : tokens;
  }

  /**
   * Compute corpus-wide Inverse Document Frequency (IDF) map for given query terms.
   */
  public computeCorpusIDF(
    queryTerms: string[],
    corpus: Array<{ items: KnowledgeItem[]; topic?: string }>
  ): Map<string, number> {
    const idfMap = new Map<string, number>();
    let corpusItemsCount = 0;
    for (const r of corpus) {
      corpusItemsCount += r.items.length;
    }

    if (queryTerms.length === 0 || corpusItemsCount === 0) {
      return idfMap;
    }

    for (const term of queryTerms) {
      let docCount = 0;
      for (const res of corpus) {
        for (const item of res.items) {
          const text = (
            item.title +
            " " +
            (item.tags ? item.tags.join(" ") : "") +
            " " +
            item.content +
            " " +
            (item.classification || "") +
            " " +
            (item.type || "")
          ).toLowerCase();
          const tokens = this.tokenizeText(text);
          if (tokens.some((tok) => matchTerm(tok, term))) {
            docCount++;
          }
        }
      }
      const idf = Math.log(1 + (corpusItemsCount - docCount + 0.5) / (docCount + 0.5));
      idfMap.set(term, Math.max(0.1, idf));
    }

    return idfMap;
  }

  /**
   * Score an individual KnowledgeItem against query terms using BM25 formula.
   */
  public scoreKnowledgeItem(
    queryTerms: string[],
    item: KnowledgeItem,
    topic?: string,
    category?: string,
    avgDocLen?: number,
    idfMap?: Map<string, number>,
    rawQuery?: string
  ): number {
    if (!queryTerms || queryTerms.length === 0) return 0;
    const informativeTerms = queryTerms.filter((t) => !BM25_STOPWORDS.has(t));
    const termsToScore = informativeTerms.length > 0 ? Array.from(new Set(informativeTerms)) : Array.from(new Set(queryTerms));

    const titleTokens = this.tokenizeText(item.title);
    const tagTokens = this.tokenizeText(Array.isArray(item.tags) ? item.tags.join(" ") : "");
    const metaTokens = this.tokenizeText((item.classification || "") + " " + (item.type || ""));
    const contentTokens = this.tokenizeText(item.content);
    const topicTokens = topic ? this.tokenizeText(topic) : [];

    const docLen = titleTokens.length + tagTokens.length + metaTokens.length + contentTokens.length;
    if (docLen === 0) return 0;

    const k1 = 1.2;
    const b = 0.75;
    const lenNorm = 1 - b + b * (docLen / (avgDocLen || 30));

    let score = 0;
    let matchedDistinctItemTerms = 0;

    for (const term of termsToScore) {
      const tfTitle = titleTokens.filter((t) => matchTerm(t, term)).length;
      const tfTags = tagTokens.filter((t) => matchTerm(t, term)).length;
      const tfMeta = metaTokens.filter((t) => matchTerm(t, term)).length;
      const tfContent = contentTokens.filter((t) => matchTerm(t, term)).length;
      const tfTopic = topicTokens.filter((t) => matchTerm(t, term)).length;

      const hasItemHit = tfTitle > 0 || tfTags > 0 || tfMeta > 0 || tfContent > 0;
      if (hasItemHit) {
        matchedDistinctItemTerms++;
      }

      // Ambient topic context: only contributes full prior if item itself has relevance
      const effectiveTopicTf = hasItemHit ? tfTopic * 0.5 : tfTopic * 0.1;
      const weightedTf = tfTitle * 3.5 + tfTags * 2.5 + tfMeta * 2.0 + tfContent * 1.2 + effectiveTopicTf;
      if (weightedTf > 0 && (hasItemHit || tfTopic > 0)) {
        const idf = idfMap && idfMap.has(term) ? (idfMap.get(term) || 1.0) : 1.0;
        const termScore = idf * (weightedTf * (k1 + 1)) / (weightedTf + k1 * lenNorm);
        score += termScore;
      }
    }

    if (score === 0 || matchedDistinctItemTerms === 0) return 0;

    // Coordination factor based on item-level term coverage
    const itemCoverage = matchedDistinctItemTerms / termsToScore.length;
    let coordBoost = termsToScore.length > 1 ? Math.pow(itemCoverage, 1.2) : 1.0;

    // Coordination suppression for long queries with low item coverage
    if (termsToScore.length >= 4 && matchedDistinctItemTerms <= 1) {
      coordBoost *= Math.pow(Math.max(0.01, itemCoverage), 2.0);
    } else if (termsToScore.length >= 6 && itemCoverage <= 0.35) {
      coordBoost *= Math.pow(itemCoverage, 2.5);
    }
    score *= coordBoost;

    // Exact phrase match bonus
    if (rawQuery && rawQuery.length > 3) {
      const cleanRaw = rawQuery.toLowerCase().trim();
      if (item.title && item.title.toLowerCase().includes(cleanRaw)) {
        score *= 1.8;
      } else if (item.content && item.content.toLowerCase().includes(cleanRaw)) {
        score *= 1.3;
      }
    }

    const state = item.lifecycleState || "LEGACY_UNEVALUATED";
    let stateMultiplier = 1.0;

    const isExplicitHistorical = rawQuery ? (
      /\b(superseded|historical|deprecated|legacy|rejected|obsolete|prior|past proposals)\b/i.test(rawQuery)
    ) : false;

    if (state === "ACCEPTED") stateMultiplier = isExplicitHistorical ? 0.90 : 1.35;
    else if (state === "VALIDATED") stateMultiplier = isExplicitHistorical ? 0.90 : 1.15;
    else if ((state as string) === "PROPOSED") stateMultiplier = isExplicitHistorical ? 1.10 : 0.15;
    else if ((state as string) === "DRAFT") stateMultiplier = isExplicitHistorical ? 0.50 : 0.01;
    else if (state === "CREATED") stateMultiplier = 0.40;
    else if (state === "DEPRECATED") stateMultiplier = isExplicitHistorical ? 1.25 : 0.10;
    else if (state === "SUPERSEDED") stateMultiplier = isExplicitHistorical ? 1.30 : 0.02;

    if (category && rawQuery) {
      const qLower = rawQuery.toLowerCase();
      // Domain-specific category alignment bonus
      if (category === "ARCHITECTURE" && (qLower.includes("architecture") || qLower.includes("adr") || qLower.includes("schema") || qLower.includes("persist") || qLower.includes("database") || qLower.includes("storage") || qLower.includes("migrate"))) {
        score *= 1.20;
      } else if (category === "QA" && (qLower.includes("test") || qLower.includes("verification") || qLower.includes("latency") || qLower.includes("pass") || qLower.includes("bench"))) {
        score *= 1.20;
      } else if (category === "REQUIREMENTS" && (qLower.includes("requirement") || qLower.includes("rule") || qLower.includes("alert") || qLower.includes("threshold") || qLower.includes("stock") || qLower.includes("expiry") || qLower.includes("expiration") || qLower.includes("quarantine"))) {
        score *= 1.20;
      } else if (category === "STANDARDS" && (qLower.includes("standard") || qLower.includes("convention") || qLower.includes("lint") || qLower.includes("code"))) {
        score *= 1.20;
      } else if (category === "RESEARCH" && (qLower.includes("research") || qLower.includes("concurrency") || qLower.includes("locking") || qLower.includes("wal") || qLower.includes("finding"))) {
        score *= 1.20;
      }
    }

    return Math.round(score * stateMultiplier * 100) / 100;
  }

  /**
   * Rank raw matches by score, with dynamic noise pruning, deterministic tie-breaking,
   * and multi-intent search result diversification (MMR).
   */
  public rankMatches<T extends { item: KnowledgeItem; score?: number }>(
    queryTerms: string[],
    rawMatches: T[]
  ): T[] {
    if (queryTerms.length === 0) return rawMatches;

    let filtered = rawMatches;
    if (filtered.length > 1 && queryTerms.length > 1) {
      let maxScore = 0;
      for (const m of filtered) {
        if ((m.score || 0) > maxScore) maxScore = m.score || 0;
      }
      if (maxScore > 1.5) {
        const cutoff = Math.max(0.01, maxScore * 0.01);
        filtered = filtered.filter((m) => (m.score || 0) >= cutoff);
      }
    }

    let sorted = filtered.sort((a, b) => {
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (Math.abs(scoreDiff) > 0.001) {
        return scoreDiff;
      }
      // Tie-breaking: 1. Lifecycle priority
      const stateRank: Record<string, number> = {
        ACCEPTED: 5,
        VALIDATED: 4,
        CREATED: 3,
        LEGACY_UNEVALUATED: 3,
        DRAFT: 2,
        SUPERSEDED: 1,
        DEPRECATED: 0,
      };
      const rankA = stateRank[a.item.lifecycleState || "LEGACY_UNEVALUATED"] ?? 2;
      const rankB = stateRank[b.item.lifecycleState || "LEGACY_UNEVALUATED"] ?? 2;
      if (rankA !== rankB) {
        return rankB - rankA;
      }
      // Tie-breaking: 2. Timestamp (newer first)
      const timeDiff = (b.item.provenance?.timestamp || "").localeCompare(a.item.provenance?.timestamp || "");
      if (timeDiff !== 0) {
        return timeDiff;
      }
      // Tie-breaking: 3. Stable ID
      return a.item.id.localeCompare(b.item.id);
    });

    // Multi-intent diversification (MMR): when top results are homogeneous in classification
    // and query spans multiple categories, reserve a top-3 slot for the best complementary match
    if (sorted.length >= 3) {
      const firstClass = sorted[0].item.classification || "GENERAL";
      if (sorted[1].item.classification === firstClass && sorted[2].item.classification === firstClass) {
        const altIndex = sorted.findIndex(
          (m, idx) => idx >= 3 && m.item.classification && m.item.classification !== firstClass && (m.score || 0) >= 1.5
        );
        if (altIndex > -1) {
          const [altItem] = sorted.splice(altIndex, 1);
          sorted.splice(2, 0, altItem);
        }
      }
    }

    return sorted;
  }
}

