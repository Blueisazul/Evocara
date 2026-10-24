/**
 * G20 Scaled Deterministic Retrieval Benchmark: BM25 + TMS vs Baseline Search
 *
 * Implements Section 5 of Iteraci�n G20:
 * 1. Methodological rigor:
 *    - Strict separation of absolute gain (percentage points) vs relative gain (%)
 *    - Warmup execution to eliminate JIT/cache variance
 *    - Percentile latency calculation (mean, p50, p95)
 *    - Ground-truth evaluation: Precision@k, Recall@k, MRR (Mean Reciprocal Rank)
 * 2. Multi-Scale Evaluation:
 *    - Scale S: Small (20 items, 2 records)
 *    - Scale M: Medium (100 items, 10 records)
 *    - Scale L: Large (1,000 items, 100 records)
 * 3. Challenging query scenarios:
 *    - Exact term matching
 *    - Field hierarchy weighting (Title 3x > Tags 2.5x > Content 1x)
 *    - Active ADR priority over superseded proposals
 *    - Obsolete knowledge penalty
 *    - Symmetrical contradiction inspection
 *    - Hard negatives / decoys rejection
 *    - False positive resistance (zero-result query)
 *    - Multi-project / researchId scope isolation
 *    - Lifecycle state filtering
 *    - Cold-restart engine reload fidelity
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { performance } = require("perf_hooks");

const { StorageEngine } = require("../../dist/storage");

function calcPercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, index)] * 1000) / 1000;
}

function calcPrecisionAtK(retrievedIds, expectedIds, k) {
  if (expectedIds.length === 0) return retrievedIds.length === 0 ? 1.0 : 0.0;
  const topK = retrievedIds.slice(0, k);
  if (topK.length === 0) return 0.0;
  const hits = topK.filter(id => expectedIds.includes(id)).length;
  return hits / topK.length;
}

function calcRecallAtK(retrievedIds, expectedIds, k) {
  if (expectedIds.length === 0) return retrievedIds.length === 0 ? 1.0 : 0.0;
  const topK = retrievedIds.slice(0, k);
  const hits = topK.filter(id => expectedIds.includes(id)).length;
  return hits / expectedIds.length;
}

function calcObsoleteRateAtK(retrievedIds, obsoleteIds, k) {
  if (!obsoleteIds || obsoleteIds.length === 0) return 0.0;
  const topK = retrievedIds.slice(0, k);
  if (topK.length === 0) return 0.0;
  const hits = topK.filter(id => obsoleteIds.includes(id)).length;
  return hits / topK.length;
}

function calcMRR(retrievedIds, expectedIds) {
  if (!expectedIds || expectedIds.length === 0) return 1.0;
  for (let i = 0; i < retrievedIds.length; i++) {
    if (expectedIds.includes(retrievedIds[i])) {
      return Math.round((1 / (i + 1)) * 1000) / 1000;
    }
  }
  return 0.0;
}

function runNaiveBaseline(researches, query, filter) {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
  const matches = [];

  for (const r of researches) {
    if (filter && filter.researchId && r.id !== filter.researchId) continue;
    for (const item of r.items) {
      if (filter && filter.lifecycleState && (item.lifecycleState || "LEGACY_UNEVALUATED") !== filter.lifecycleState) continue;
      const fullText = `${item.title} ${item.content} ${(item.tags || []).join(" ")}`.toLowerCase();
      let matchCount = 0;
      for (const t of terms) {
        if (fullText.includes(t)) matchCount++;
      }
      if (matchCount > 0) {
        matches.push({ item, score: matchCount, researchId: r.id });
      }
    }
  }

  // Naive sort purely by term occurrence count, no field weighting, no TMS lifecycle multiplier
  matches.sort((a, b) => b.score - a.score);
  return matches;
}

function buildSyntheticDataset(targetItemCount) {
  const records = [];
  const itemsPerRecord = 10;
  const numRecords = Math.ceil(targetItemCount / itemsPerRecord);

  // Record 0: Core Architecture
  records.push({
    id: "PROJ-CORE-ARCH",
    topic: "InventoryHub Core Architecture",
    summary: "Foundational decisions, database engine invariants and air-gap persistence",
    status: "ACTIVE",
    items: [
      {
        id: "ITEM-ADR-001",
        type: "DECISION",
        classification: "ARCHITECTURE",
        title: "ADR-001: Local SQLite Embedded Storage Engine",
        content: "Use Node.js built-in node:sqlite for inventory persistence. Strictly forbid external network database servers.",
        tags: ["architecture", "persistence", "sqlite", "database"],
        lifecycleState: "ACCEPTED",
        evidenceRef: "adr-001.md",
      },
      {
        id: "ITEM-ADR-002",
        type: "DECISION",
        classification: "SECURITY",
        title: "ADR-002: Filesystem Authority and Air-Gap Mode",
        content: "All state must reside strictly on local filesystem. Remote cloud synchronization is rejected.",
        tags: ["security", "persistence", "filesystem", "airgap"],
        lifecycleState: "ACCEPTED",
        evidenceRef: "adr-002.md",
      },
      {
        id: "ITEM-PROP-MONGO",
        type: "OBSERVATION",
        classification: "PROPOSAL",
        title: "Exploratory Proposal: Migrate to MongoDB Cloud Cluster",
        content: "Proposes replacing SQLite database with MongoDB Atlas cloud database cluster for multi-store scaling.",
        tags: ["database", "mongo", "cloud", "migration"],
        lifecycleState: "SUPERSEDED",
        evidenceRef: "ticket-44.md",
      },
      {
        id: "ITEM-DRAFT-POSTGRES",
        type: "OBSERVATION",
        classification: "PROPOSAL",
        title: "Unreviewed Draft: Use PostgreSQL for High Concurrency",
        content: "Draft note suggesting PostgreSQL database server instead of SQLite.",
        tags: ["database", "postgres", "server"],
        lifecycleState: "DRAFT",
      },
      {
        id: "ITEM-TASK-102",
        type: "TASK",
        classification: "IMPLEMENTATION",
        title: "TASK-102: Real-time Low-Stock Telemetry Pipeline",
        content: "Implementation of checkLowStockItems telemetry threshold alert evaluator.",
        tags: ["telemetry", "lowstock", "pipeline", "alerts"],
        lifecycleState: "VALIDATED",
        evidenceRef: "test-run-102.log",
      },
      {
        id: "ITEM-DECOY-001",
        type: "NOTE",
        classification: "DOCUMENTATION",
        title: "Database UI Configuration Dialog Styling",
        content: "Frontend CSS guidelines for rendering database modal dialog button colors in administrative settings.",
        tags: ["ui", "styling", "css", "dialog"],
        lifecycleState: "VALIDATED",
      },
      {
        id: "ITEM-DECOY-002",
        type: "NOTE",
        classification: "DOCUMENTATION",
        title: "Scraper Logs for SQLite Documentation",
        content: "Automated crawl output of external third-party documentation pages for sqlite syntax reference.",
        tags: ["scraper", "docs", "external"],
        lifecycleState: "DRAFT",
      },
      {
        id: "ITEM-REPLICA-NOTE",
        type: "NOTE",
        classification: "ARCHITECTURE",
        title: "PostgreSQL Replication Clustering Analysis",
        content: "Investigates standby replication mechanisms for postgresql clustering servers.",
        tags: ["clustering", "replication", "postgres"],
        lifecycleState: "DRAFT",
      },
      {
        id: "ITEM-AUDIT-GUIDE",
        type: "PROCEDURE",
        classification: "QUALITY",
        title: "Safe Promotion Audit Procedure",
        content: "Step by step procedure for certifying package tarball hashes before sandbox rehearsal.",
        tags: ["procedure", "audit", "security"],
        lifecycleState: "ACCEPTED",
      },
      {
        id: "ITEM-CLEANUP-POLICY",
        type: "PROCEDURE",
        classification: "MAINTENANCE",
        title: "Stale File Cleanup Policy",
        content: "Rules for identifying and deleting temporary scratch files older than retention threshold.",
        tags: ["maintenance", "cleanup", "retention"],
        lifecycleState: "VALIDATED",
      },
    ],
    relations: [
      {
        id: "REL-001",
        sourceItemId: "ITEM-ADR-001",
        targetItemId: "ITEM-PROP-MONGO",
        relationType: "SUPERSEDES",
        rationale: "ADR-001 formally rejected and superseded the MongoDB cloud proposal.",
        createdAt: "2026-10-19T00:00:00.000Z",
        provenance: { agentId: "lead-architect", timestamp: "2026-10-19T00:00:00.000Z" },
      },
      {
        id: "REL-002",
        sourceItemId: "ITEM-ADR-001",
        targetItemId: "ITEM-DRAFT-POSTGRES",
        relationType: "CONTRADICTS",
        rationale: "PostgreSQL proposal contradicts ADR-001 local SQLite embedded mandate.",
        createdAt: "2026-10-19T00:00:00.000Z",
        provenance: { agentId: "lead-architect", timestamp: "2026-10-19T00:00:00.000Z" },
      },
    ],
  });

  // Record 1: External Isolation Record (Zenith)
  records.push({
    id: "PROJ-ZENITH-EXT",
    topic: "Zenith Cloud Platform (Foreign Project)",
    summary: "External cloud microservices specifications that must never leak into InventoryHub",
    status: "ACTIVE",
    items: [
      {
        id: "ITEM-ZENITH-01",
        type: "DECISION",
        classification: "ARCHITECTURE",
        title: "Zenith Microservices Architecture and Database",
        content: "Zenith utilizes distributed Cassandra database cluster across AWS regions.",
        tags: ["zenith", "database", "cassandra", "cloud"],
        lifecycleState: "ACCEPTED",
      },
      {
        id: "ITEM-ZENITH-02",
        type: "TASK",
        classification: "INFRASTRUCTURE",
        title: "Zenith Kubernetes Helm Deployment",
        content: "Deploy Zenith ingress controller using Helm chart templates.",
        tags: ["kubernetes", "helm", "zenith"],
        lifecycleState: "VALIDATED",
      },
    ],
  });

  // Procedural filler records for scale M and L
  const domains = ["Billing", "Catalog", "Notifications", "Shipping", "Warehousing", "Analytics", "Discounts", "Suppliers", "Compliance", "Returns"];
  for (let r = 2; r < numRecords; r++) {
    const domain = domains[r % domains.length];
    const recItems = [];
    for (let i = 0; i < itemsPerRecord; i++) {
      const state = i % 3 === 0 ? "ACCEPTED" : (i % 3 === 1 ? "VALIDATED" : "DRAFT");
      recItems.push({
        id: `ITEM-${domain.toUpperCase()}-${r}-${i}`,
        type: i === 0 ? "DECISION" : "TASK",
        classification: "DOMAIN",
        title: `${domain} Module Component ${r}.${i} Specification`,
        content: `Detailed specifications for ${domain.toLowerCase()} tracking, handling order lifecycle and transaction guarantees ${r} ${i}.`,
        tags: [domain.toLowerCase(), "spec", `v${r}`],
        lifecycleState: state,
      });
    }
    records.push({
      id: `PROJ-${domain.toUpperCase()}-${r}`,
      topic: `${domain} Subsystem Automation ${r}`,
      summary: `Automated management of ${domain.toLowerCase()} domain logic`,
      status: "ACTIVE",
      items: recItems,
    });
  }

  return records;
}

const BENCHMARK_QUERIES = [
  {
    id: "Q1_EXACT_MATCH",
    name: "1. Exact Term Matching",
    query: "node:sqlite embedded storage engine",
    expectedItemIds: ["ITEM-ADR-001"],
    obsoleteItemIds: [],
  },
  {
    id: "Q2_FIELD_WEIGHTING",
    name: "2. Title & Tags Hierarchy Weighting",
    query: "telemetry lowstock alerts",
    expectedItemIds: ["ITEM-TASK-102"],
    obsoleteItemIds: [],
  },
  {
    id: "Q3_ACTIVE_ADR_PRIORITY",
    name: "3. Active ADR Priority Over Superseded",
    query: "database persistence engine",
    expectedItemIds: ["ITEM-ADR-001"],
    obsoleteItemIds: ["ITEM-PROP-MONGO"],
    priorityOrder: ["ITEM-ADR-001", "ITEM-PROP-MONGO"],
  },
  {
    id: "Q4_OBSOLETE_PENALTY",
    name: "4. Superseded Knowledge Penalty",
    query: "mongodb cloud cluster migration",
    expectedItemIds: ["ITEM-PROP-MONGO"],
    obsoleteItemIds: ["ITEM-PROP-MONGO"],
  },
  {
    id: "Q5_CONTRADICTION",
    name: "5. Contradictory Knowledge Inspection",
    query: "postgresql database server",
    expectedItemIds: ["ITEM-DRAFT-POSTGRES"],
    obsoleteItemIds: [],
    checkTmsContradiction: true,
  },
  {
    id: "Q6_ZERO_RESULT",
    name: "6. False Positive Resistance (Zero-Result)",
    query: "quantum cryogenic blockchain ledger",
    expectedItemIds: [],
    obsoleteItemIds: [],
    mustReturnZero: true,
  },
  {
    id: "Q7_DECOY_REJECTION",
    name: "7. Hard Negative / Decoy Ranking",
    query: "database storage architecture",
    expectedItemIds: ["ITEM-ADR-001"],
    // Core database ADR must outrank superficial UI decoy
    priorityOrder: ["ITEM-ADR-001", "ITEM-DECOY-001"],
  },
  {
    id: "Q8_SCOPE_ISOLATION",
    name: "8. Multi-Project Scope Isolation",
    query: "database architecture",
    filter: { researchId: "PROJ-CORE-ARCH" },
    expectedItemIds: ["ITEM-ADR-001", "ITEM-ADR-002"],
    forbiddenItemIds: ["ITEM-ZENITH-01"],
  },
  {
    id: "Q9_STATE_FILTER",
    name: "9. Lifecycle State Filtering (ACCEPTED Only)",
    query: "database",
    filter: { lifecycleState: "ACCEPTED" },
    expectedItemIds: ["ITEM-ADR-001"],
    forbiddenItemIds: ["ITEM-PROP-MONGO", "ITEM-DRAFT-POSTGRES"],
  },
  {
    id: "Q10_COLD_RELOAD",
    name: "10. Cold-Restart Engine Reload Fidelity",
    query: "checkLowStockItems telemetry threshold",
    isColdRestart: true,
    expectedItemIds: ["ITEM-TASK-102"],
    obsoleteItemIds: [],
  },
];

async function evaluateScale(scaleName, targetItemCount) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `om-g20-bench-${scaleName.toLowerCase()}-`));
  try {
    let storage = new StorageEngine(tmpDir);
    storage.ensureStorageStructure();
    storage.registerSession({ id: `sess-${scaleName}`, agentId: `agent-${scaleName}`, status: "ACTIVE" });

    const dataset = buildSyntheticDataset(targetItemCount);
    let totalItems = 0;
    for (const rec of dataset) {
      storage.saveResearch(rec, `agent-${scaleName}`, `sess-${scaleName}`);
      totalItems += rec.items.length;
    }

    const allResearches = storage.listResearches();

    // 1. Warmup passes (3 iterations per query)
    for (let w = 0; w < 3; w++) {
      for (const q of BENCHMARK_QUERIES) {
        storage.queryKnowledgeItems({ query: q.query, researchId: q.filter?.researchId, lifecycleState: q.filter?.lifecycleState });
        runNaiveBaseline(allResearches, q.query, q.filter);
      }
    }

    // 2. Timed measurement passes
    const queryResults = [];
    const NUM_RUNS = 5;

    for (const bCase of BENCHMARK_QUERIES) {
      if (bCase.isColdRestart) {
        storage = new StorageEngine(tmpDir);
        storage.ensureStorageStructure();
      }

      const omLatencies = [];
      let lastOmMatches = [];
      for (let r = 0; r < NUM_RUNS; r++) {
        const t0 = performance.now();
        lastOmMatches = storage.queryKnowledgeItems({
          query: bCase.query,
          researchId: bCase.filter?.researchId,
          lifecycleState: bCase.filter?.lifecycleState,
        });
        omLatencies.push(performance.now() - t0);
      }

      const baseLatencies = [];
      let lastBaseMatches = [];
      for (let r = 0; r < NUM_RUNS; r++) {
        const t0 = performance.now();
        lastBaseMatches = runNaiveBaseline(allResearches, bCase.query, bCase.filter);
        baseLatencies.push(performance.now() - t0);
      }

      const retrievedOmIds = lastOmMatches.map(m => m.item.id);
      const retrievedBaseIds = lastBaseMatches.map(m => m.item.id);

      const expected = bCase.expectedItemIds;
      const relevantRetrievedOm = retrievedOmIds.filter(id => expected.includes(id));
      const relevantOmittedOm = expected.filter(id => !retrievedOmIds.includes(id));
      const obsoleteRetrievedOm = retrievedOmIds.filter(id => (bCase.obsoleteItemIds || []).includes(id));

      let passed = true;
      if (bCase.mustReturnZero) {
        passed = lastOmMatches.length === 0;
      } else {
        passed = relevantOmittedOm.length === 0;
      }

      if (bCase.forbiddenItemIds) {
        for (const forb of bCase.forbiddenItemIds) {
          if (retrievedOmIds.includes(forb)) passed = false;
        }
      }

      if (bCase.priorityOrder) {
        const idx0 = retrievedOmIds.indexOf(bCase.priorityOrder[0]);
        const idx1 = retrievedOmIds.indexOf(bCase.priorityOrder[1]);
        if (idx0 === -1 || (idx1 !== -1 && idx0 > idx1)) passed = false;
      }

      if (bCase.checkTmsContradiction) {
        const tmsAnalysis = storage.analyzeKnowledgeTMS({ researchId: "PROJ-CORE-ARCH" });
        if (tmsAnalysis.overallStatus !== "CONFLICTED") passed = false;
      }

      const precisionOm = retrievedOmIds.length > 0
        ? (relevantRetrievedOm.length / retrievedOmIds.length)
        : (expected.length === 0 ? 1.0 : 0.0);
      const recallOm = expected.length > 0
        ? (relevantRetrievedOm.length / expected.length)
        : (retrievedOmIds.length === 0 ? 1.0 : 0.0);
      const mrrOm = calcMRR(retrievedOmIds, expected);

      const relevantRetrievedBase = retrievedBaseIds.filter(id => expected.includes(id));
      const precisionBase = retrievedBaseIds.length > 0
        ? (relevantRetrievedBase.length / retrievedBaseIds.length)
        : (expected.length === 0 ? 1.0 : 0.0);
      const recallBase = expected.length > 0
        ? (relevantRetrievedBase.length / expected.length)
        : (retrievedBaseIds.length === 0 ? 1.0 : 0.0);
      const mrrBase = calcMRR(retrievedBaseIds, expected);

      const pAt3Om = calcPrecisionAtK(retrievedOmIds, expected, 3);
      const pAt5Om = calcPrecisionAtK(retrievedOmIds, expected, 5);
      const rAt3Om = calcRecallAtK(retrievedOmIds, expected, 3);
      const rAt5Om = calcRecallAtK(retrievedOmIds, expected, 5);
      const obsAt3Om = calcObsoleteRateAtK(retrievedOmIds, bCase.obsoleteItemIds || [], 3);

      const pAt3Base = calcPrecisionAtK(retrievedBaseIds, expected, 3);
      const pAt5Base = calcPrecisionAtK(retrievedBaseIds, expected, 5);
      const rAt3Base = calcRecallAtK(retrievedBaseIds, expected, 3);
      const rAt5Base = calcRecallAtK(retrievedBaseIds, expected, 5);
      const obsAt3Base = calcObsoleteRateAtK(retrievedBaseIds, bCase.obsoleteItemIds || [], 3);

      const meanLatencyOm = Math.round((omLatencies.reduce((a, b) => a + b, 0) / NUM_RUNS) * 1000) / 1000;
      const p50LatencyOm = calcPercentile(omLatencies, 50);
      const p95LatencyOm = calcPercentile(omLatencies, 95);

      const meanLatencyBase = Math.round((baseLatencies.reduce((a, b) => a + b, 0) / NUM_RUNS) * 1000) / 1000;
      const p50LatencyBase = calcPercentile(baseLatencies, 50);
      const p95LatencyBase = calcPercentile(baseLatencies, 95);

      queryResults.push({
        id: bCase.id,
        name: bCase.name,
        query: bCase.query,
        expected: expected,
        openMemory: {
          retrieved: retrievedOmIds,
          precision: Math.round(precisionOm * 1000) / 1000,
          recall: Math.round(recallOm * 1000) / 1000,
          mrr: mrrOm,
          precisionAt3: Math.round(pAt3Om * 1000) / 1000,
          precisionAt5: Math.round(pAt5Om * 1000) / 1000,
          recallAt3: Math.round(rAt3Om * 1000) / 1000,
          recallAt5: Math.round(rAt5Om * 1000) / 1000,
          obsoleteRateAt3: Math.round(obsAt3Om * 1000) / 1000,
          obsoleteCount: obsoleteRetrievedOm.length,
          latency: { mean: meanLatencyOm, p50: p50LatencyOm, p95: p95LatencyOm },
        },
        baseline: {
          retrieved: retrievedBaseIds,
          precision: Math.round(precisionBase * 1000) / 1000,
          recall: Math.round(recallBase * 1000) / 1000,
          mrr: mrrBase,
          precisionAt3: Math.round(pAt3Base * 1000) / 1000,
          precisionAt5: Math.round(pAt5Base * 1000) / 1000,
          recallAt3: Math.round(rAt3Base * 1000) / 1000,
          recallAt5: Math.round(rAt5Base * 1000) / 1000,
          obsoleteRateAt3: Math.round(obsAt3Base * 1000) / 1000,
          latency: { mean: meanLatencyBase, p50: p50LatencyBase, p95: p95LatencyBase },
        },
        passed,
      });
    }

    const passedQueries = queryResults.filter(q => q.passed).length;
    const meanOmPrecision = Math.round((queryResults.reduce((a, q) => a + q.openMemory.precision, 0) / queryResults.length) * 1000) / 1000;
    const meanOmRecall = Math.round((queryResults.reduce((a, q) => a + q.openMemory.recall, 0) / queryResults.length) * 1000) / 1000;
    const meanOmMRR = Math.round((queryResults.reduce((a, q) => a + q.openMemory.mrr, 0) / queryResults.length) * 1000) / 1000;
    const meanOmPAt3 = Math.round((queryResults.reduce((a, q) => a + q.openMemory.precisionAt3, 0) / queryResults.length) * 1000) / 1000;
    const meanOmPAt5 = Math.round((queryResults.reduce((a, q) => a + q.openMemory.precisionAt5, 0) / queryResults.length) * 1000) / 1000;
    const meanOmRAt3 = Math.round((queryResults.reduce((a, q) => a + q.openMemory.recallAt3, 0) / queryResults.length) * 1000) / 1000;
    const meanOmRAt5 = Math.round((queryResults.reduce((a, q) => a + q.openMemory.recallAt5, 0) / queryResults.length) * 1000) / 1000;
    const meanOmObsAt3 = Math.round((queryResults.reduce((a, q) => a + q.openMemory.obsoleteRateAt3, 0) / queryResults.length) * 1000) / 1000;

    const meanBasePAt3 = Math.round((queryResults.reduce((a, q) => a + q.baseline.precisionAt3, 0) / queryResults.length) * 1000) / 1000;
    const meanBasePAt5 = Math.round((queryResults.reduce((a, q) => a + q.baseline.precisionAt5, 0) / queryResults.length) * 1000) / 1000;
    const meanBaseRAt3 = Math.round((queryResults.reduce((a, q) => a + q.baseline.recallAt3, 0) / queryResults.length) * 1000) / 1000;
    const meanBaseRAt5 = Math.round((queryResults.reduce((a, q) => a + q.baseline.recallAt5, 0) / queryResults.length) * 1000) / 1000;
    const meanBaseObsAt3 = Math.round((queryResults.reduce((a, q) => a + q.baseline.obsoleteRateAt3, 0) / queryResults.length) * 1000) / 1000;
    const meanOmLatency = Math.round((queryResults.reduce((a, q) => a + q.openMemory.latency.mean, 0) / queryResults.length) * 1000) / 1000;
    const p95OmLatency = calcPercentile(queryResults.map(q => q.openMemory.latency.p95), 95);

    const meanBasePrecision = Math.round((queryResults.reduce((a, q) => a + q.baseline.precision, 0) / queryResults.length) * 1000) / 1000;
    const meanBaseRecall = Math.round((queryResults.reduce((a, q) => a + q.baseline.recall, 0) / queryResults.length) * 1000) / 1000;
    const meanBaseMRR = Math.round((queryResults.reduce((a, q) => a + q.baseline.mrr, 0) / queryResults.length) * 1000) / 1000;
    const meanBaseLatency = Math.round((queryResults.reduce((a, q) => a + q.baseline.latency.mean, 0) / queryResults.length) * 1000) / 1000;

    const absoluteGainPP = Math.round((meanOmPrecision - meanBasePrecision) * 1000) / 10; // percentage points
    const relativeGainPct = meanBasePrecision > 0
      ? Math.round(((meanOmPrecision - meanBasePrecision) / meanBasePrecision) * 1000) / 10
      : 0;

    return {
      scale: scaleName,
      totalItems,
      totalRecords: dataset.length,
      passedQueries,
      totalQueries: queryResults.length,
      passRate: `${Math.round((passedQueries / queryResults.length) * 100)}%`,
      openMemory: {
        precision: meanOmPrecision,
        recall: meanOmRecall,
        mrr: meanOmMRR,
        precisionAt3: meanOmPAt3,
        precisionAt5: meanOmPAt5,
        recallAt3: meanOmRAt3,
        recallAt5: meanOmRAt5,
        obsoleteRateAt3: meanOmObsAt3,
        meanLatencyMs: meanOmLatency,
        p95LatencyMs: p95OmLatency,
      },
      baseline: {
        precision: meanBasePrecision,
        recall: meanBaseRecall,
        mrr: meanBaseMRR,
        precisionAt3: meanBasePAt3,
        precisionAt5: meanBasePAt5,
        recallAt3: meanBaseRAt3,
        recallAt5: meanBaseRAt5,
        obsoleteRateAt3: meanBaseObsAt3,
        meanLatencyMs: meanBaseLatency,
      },
      gain: {
        absolutePointsPP: absoluteGainPP,
        relativePercent: relativeGainPct,
      },
      queries: queryResults,
    };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

async function runMainBenchmark() {
  console.log("===================================================================");
  console.log("  G20: Scaled Deterministic Retrieval Benchmark (BM25+TMS vs Baseline)");
  console.log("===================================================================");

  const scalesToTest = [
    { name: "Scale-S (Small)", count: 20 },
    { name: "Scale-M (Medium)", count: 100 },
    { name: "Scale-L (Large)", count: 1000 },
  ];

  const scaleReports = [];
  for (const s of scalesToTest) {
    process.stdout.write(`Evaluating ${s.name} (${s.count} items)... `);
    const rep = await evaluateScale(s.name, s.count);
    scaleReports.push(rep);
    console.log(`DONE. Pass: ${rep.passedQueries}/${rep.totalQueries} | OM Prec: ${rep.openMemory.precision} vs Base: ${rep.baseline.precision} (+${rep.gain.absolutePointsPP} pp / +${rep.gain.relativePercent}%) | Lat: ${rep.openMemory.meanLatencyMs}ms`);
  }

  const finalReport = {
    benchmarkVersion: "G20-SCALED-DETERMINISTIC-BENCHMARK-V2",
    timestamp: new Date().toISOString(),
    methodologyNotes: {
      formulaPrecision: "Retrieved relevant items / Total retrieved items",
      formulaRecall: "Retrieved relevant items / Expected relevant items",
      formulaMRR: "1 / Rank of first relevant item in retrieved set",
      absoluteGainDefinition: "Difference in percentage points (OM Precision - Baseline Precision) * 100",
      relativeGainDefinition: "((OM Precision - Baseline Precision) / Baseline Precision) * 100",
      warmup: "3 warmup passes executed prior to measurement",
      runsPerQuery: 5,
    },
    scales: scaleReports,
  };

  const evidencePath = path.resolve(__dirname, "../evidence/g20-retrieval-benchmark-results.json");
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, JSON.stringify(finalReport, null, 2), "utf8");
  console.log(`\n[Evidence saved to: ${evidencePath}]`);

  console.log("-------------------------------------------------------------------");
  console.log("  G20 Retrieval Benchmark Scale Summary:");
  for (const s of scaleReports) {
    console.log(`  - ${s.scale.padEnd(20)}: ${s.totalItems} items | Prec: ${s.openMemory.precision} vs ${s.baseline.precision} (+${s.gain.absolutePointsPP} pp, +${s.gain.relativePercent}%) | Lat p50: ${s.openMemory.meanLatencyMs}ms | p95: ${s.openMemory.p95LatencyMs}ms`);
    assert.strictEqual(s.passedQueries, s.totalQueries, `All queries must pass in scale ${s.scale}`);
  }
  console.log("-------------------------------------------------------------------");
}

runMainBenchmark().catch(err => {
  console.error("\nScaled Benchmark FAILED:", err);
  process.exit(1);
});
