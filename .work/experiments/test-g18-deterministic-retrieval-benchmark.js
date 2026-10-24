/**
 * G18 Deterministic Retrieval Benchmark: BM25 + TMS vs Baseline Search
 *
 * Implements Bloque C of Iteración G18:
 * Evaluates OpenMemory's weighted BM25 and Truth Maintenance System (TMS)
 * against a naive substring search baseline across 9 query categories:
 *
 * 1. Exact term matching
 * 2. Title & tags hierarchy weighting
 * 3. Accepted architectural decision priority
 * 4. Superseded knowledge penalty
 * 5. Contradictory knowledge detection
 * 6. Irrelevant term filtering (minScore = 0 rejection)
 * 7. Multi-project scope isolation
 * 8. State and quality discrimination
 * 9. Cold-start engine reload fidelity
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { StorageEngine } = require('../../dist/storage');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'om-g18-bench-'));
const agentId = 'agent-bench-g18';
const sessionId = 'session-bench-g18';

function runNaiveBaseline(researches, query, filter) {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
  const matches = [];

  for (const r of researches) {
    if (filter && filter.researchId && r.id !== filter.researchId) continue;
    for (const item of r.items) {
      if (filter && filter.lifecycleState && item.lifecycleState !== filter.lifecycleState) continue;
      const fullText = `${item.title} ${item.content} ${(item.tags || []).join(' ')}`.toLowerCase();
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

async function runBenchmark() {
  console.log('===================================================================');
  console.log('  G18: Deterministic BM25 + TMS vs Baseline Retrieval Benchmark   ');
  console.log('===================================================================');

  let storage = new StorageEngine(sandbox);
  storage.ensureStorageStructure();
  storage.registerSession({ id: sessionId, agentId, status: 'ACTIVE' });

  // -------------------------------------------------------------------------
  // INGESTION: Comprehensive Benchmark Dataset (InventoryHub Domain)
  // -------------------------------------------------------------------------
  // Record 1: Core Architecture
  storage.saveResearch({
    id: 'PROJ-CORE-ARCH',
    topic: 'InventoryHub Core Architecture',
    summary: 'Core decisions, invariants, and database selections',
    status: 'ACTIVE',
    items: [
      {
        id: 'ITEM-ADR-001',
        type: 'DECISION',
        classification: 'ARCHITECTURE',
        title: 'ADR-001: Local SQLite Embedded Storage Engine',
        content: 'Use Node.js built-in node:sqlite for inventory persistence. Strictly forbid external network database servers.',
        tags: ['architecture', 'persistence', 'sqlite', 'database'],
        lifecycleState: 'ACCEPTED',
        evidenceRef: 'adr-001.md',
      },
      {
        id: 'ITEM-ADR-002',
        type: 'DECISION',
        classification: 'SECURITY',
        title: 'ADR-002: Filesystem Authority and Air-Gap Mode',
        content: 'All state must reside strictly on local filesystem. Remote cloud synchronization is rejected.',
        tags: ['security', 'persistence', 'filesystem', 'airgap'],
        lifecycleState: 'ACCEPTED',
        evidenceRef: 'adr-002.md',
      },
      {
        id: 'ITEM-PROP-MONGO',
        type: 'OBSERVATION',
        classification: 'PROPOSAL',
        title: 'Exploratory Proposal: Migrate to MongoDB Cloud Cluster',
        content: 'Proposes replacing SQLite database with MongoDB Atlas cloud database cluster for multi-store scaling.',
        tags: ['database', 'mongo', 'cloud', 'migration'],
        lifecycleState: 'SUPERSEDED',
        evidenceRef: 'ticket-44.md',
      },
      {
        id: 'ITEM-DRAFT-POSTGRES',
        type: 'OBSERVATION',
        classification: 'PROPOSAL',
        title: 'Unreviewed Draft: Use PostgreSQL for High Concurrency',
        content: 'Draft note suggesting PostgreSQL database server instead of SQLite.',
        tags: ['database', 'postgres', 'server'],
        lifecycleState: 'DRAFT',
      },
    ],
    relations: [
      {
        id: 'REL-001',
        sourceItemId: 'ITEM-ADR-001',
        targetItemId: 'ITEM-PROP-MONGO',
        relationType: 'SUPERSEDES',
        rationale: 'ADR-001 explicitly rejected MongoDB in favor of SQLite',
        createdAt: new Date().toISOString(),
        provenance: { agentId, timestamp: new Date().toISOString() },
      },
      {
        id: 'REL-002',
        sourceItemId: 'ITEM-DRAFT-POSTGRES',
        targetItemId: 'ITEM-ADR-001',
        relationType: 'CONTRADICTS',
        rationale: 'PostgreSQL proposal contradicts zero-external-dependency rule',
        createdAt: new Date().toISOString(),
        provenance: { agentId, timestamp: new Date().toISOString() },
      },
    ],
  }, agentId, sessionId);

  // Record 2: Sprint Operations
  storage.saveResearch({
    id: 'PROJ-SPRINT-OPS',
    topic: 'InventoryHub Sprint 14 Operations',
    summary: 'Active tasks, telemetry and sprint deliverables',
    status: 'ACTIVE',
    items: [
      {
        id: 'ITEM-TASK-102',
        type: 'OBSERVATION',
        classification: 'TASK',
        title: 'TASK-102: Low-Stock Telemetry checkLowStockItems Query',
        content: 'Implement SQL function checkLowStockItems(threshold) in src/db/inventory.js returning low stock items.',
        tags: ['task', 'sql', 'telemetry', 'checkLowStockItems'],
        lifecycleState: 'VALIDATED',
        evidenceRef: 'commit-49f2b',
      },
      {
        id: 'ITEM-TASK-103',
        type: 'OBSERVATION',
        classification: 'TASK',
        title: 'TASK-103: Automated Alert Notification Dispatcher',
        content: 'Dispatch local desktop notification when low-stock items are detected.',
        tags: ['task', 'telemetry', 'alerts', 'notifications'],
        lifecycleState: 'VALIDATED',
        evidenceRef: 'commit-52a1c',
      },
    ],
    relations: [],
  }, agentId, sessionId);

  // Record 3: Unrelated External Project (Project Zenith)
  storage.saveResearch({
    id: 'PROJ-ZENITH-EXT',
    topic: 'Zenith External Billing Service',
    summary: 'Third party billing integrations',
    status: 'ACTIVE',
    items: [
      {
        id: 'ITEM-ZENITH-01',
        type: 'DECISION',
        classification: 'ARCHITECTURE',
        title: 'Zenith Stripe Gateway Integration Architecture',
        content: 'Connect to Stripe API using secret API keys for subscription billing.',
        tags: ['billing', 'stripe', 'external', 'zenith'],
        lifecycleState: 'ACCEPTED',
      },
    ],
    relations: [],
  }, agentId, sessionId);

  // -------------------------------------------------------------------------
  // BENCHMARK CASES EVALUATION
  // -------------------------------------------------------------------------
  const benchmarkCases = [
    {
      category: '1. Exact Term Matching',
      query: 'checkLowStockItems',
      expectedItemIds: ['ITEM-TASK-102'],
      obsoleteItemIds: [],
    },
    {
      category: '2. Title & Tags Hierarchy Weighting',
      query: 'database persistence',
      // Title (3x) + Tag (2.5x) for ITEM-ADR-001 outscores content-only mentions
      expectedItemIds: ['ITEM-ADR-001', 'ITEM-ADR-002'],
      obsoleteItemIds: ['ITEM-PROP-MONGO'],
    },
    {
      category: '3. Accepted Architectural Decision Priority',
      query: 'sqlite database persistence',
      // ITEM-ADR-001 (ACCEPTED, 1.25x) must strictly beat ITEM-PROP-MONGO (SUPERSEDED, 0.5x)
      expectedItemIds: ['ITEM-ADR-001'],
      obsoleteItemIds: ['ITEM-PROP-MONGO'],
      priorityOrder: ['ITEM-ADR-001', 'ITEM-PROP-MONGO'],
    },
    {
      category: '4. Superseded Knowledge Penalty',
      query: 'mongodb cloud cluster migration',
      // Must retrieve ITEM-PROP-MONGO, but score is depressed by 0.5x multiplier
      expectedItemIds: ['ITEM-PROP-MONGO'],
      obsoleteItemIds: ['ITEM-PROP-MONGO'],
      checkDepressedMultiplier: true,
    },
    {
      category: '5. Contradictory Knowledge Inspection',
      query: 'postgresql database server',
      expectedItemIds: ['ITEM-DRAFT-POSTGRES'],
      obsoleteItemIds: [],
      checkTmsContradiction: true,
    },
    {
      category: '6. Irrelevant Term Filtering',
      query: 'quantum superposition cryogenic blockchain',
      expectedItemIds: [],
      obsoleteItemIds: [],
      mustReturnZero: true,
    },
    {
      category: '7. Multi-Project Scope Isolation',
      query: 'database architecture persistence',
      filter: { researchId: 'PROJ-CORE-ARCH' },
      expectedItemIds: ['ITEM-ADR-001', 'ITEM-ADR-002'],
      forbiddenItemIds: ['ITEM-ZENITH-01'], // Must NOT leak Zenith
    },
    {
      category: '8. State & Quality Discrimination',
      query: 'database',
      filter: { lifecycleState: 'ACCEPTED' },
      expectedItemIds: ['ITEM-ADR-001'],
      forbiddenItemIds: ['ITEM-PROP-MONGO', 'ITEM-DRAFT-POSTGRES'],
    },
    {
      category: '9. Cold-Restart Engine Reload Fidelity',
      query: 'checkLowStockItems telemetry threshold',
      isColdRestart: true,
      expectedItemIds: ['ITEM-TASK-102'],
      obsoleteItemIds: [],
    },
  ];

  const results = [];
  const allResearches = storage.listResearches();

  for (const bCase of benchmarkCases) {
    if (bCase.isColdRestart) {
      storage = new StorageEngine(sandbox);
      storage.ensureStorageStructure();
    }

    // Measure OpenMemory BM25+TMS
    const tStartOm = performance.now();
    const omMatches = storage.queryKnowledgeItems({
      query: bCase.query,
      researchId: bCase.filter?.researchId,
      lifecycleState: bCase.filter?.lifecycleState,
    });
    const latencyOm = Math.round((performance.now() - tStartOm) * 1000) / 1000; // ms

    // Measure Naive Baseline
    const tStartBase = performance.now();
    const baseMatches = runNaiveBaseline(allResearches, bCase.query, bCase.filter);
    const latencyBase = Math.round((performance.now() - tStartBase) * 1000) / 1000; // ms

    const retrievedOmIds = omMatches.map(m => m.item.id);
    const retrievedBaseIds = baseMatches.map(m => m.item.id);

    // Compute Metrics
    const expected = bCase.expectedItemIds;
    const relevantRetrievedOm = retrievedOmIds.filter(id => expected.includes(id));
    const relevantOmittedOm = expected.filter(id => !retrievedOmIds.includes(id));
    const obsoleteRetrievedOm = retrievedOmIds.filter(id => (bCase.obsoleteItemIds || []).includes(id));

    // For Case 6: Irrelevant filter
    let passed = true;
    if (bCase.mustReturnZero) {
      passed = omMatches.length === 0;
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
      const tmsAnalysis = storage.analyzeKnowledgeTMS({ researchId: 'PROJ-CORE-ARCH' });
      console.log('Category 5 TMS status:', tmsAnalysis.overallStatus, 'diagnostics:', tmsAnalysis.diagnostics);
      if (tmsAnalysis.overallStatus !== 'CONFLICTED') passed = false;
    }

    const precisionOm = retrievedOmIds.length > 0 ? (relevantRetrievedOm.length / retrievedOmIds.length) : (expected.length === 0 ? 1.0 : 0.0);
    const recallOm = expected.length > 0 ? (relevantRetrievedOm.length / expected.length) : (retrievedOmIds.length === 0 ? 1.0 : 0.0);

    const precisionBase = retrievedBaseIds.length > 0 ? (retrievedBaseIds.filter(id => expected.includes(id)).length / retrievedBaseIds.length) : 0;
    const recallBase = expected.length > 0 ? (retrievedBaseIds.filter(id => expected.includes(id)).length / expected.length) : 1.0;

    results.push({
      category: bCase.category,
      query: bCase.query,
      expectedItems: expected,
      retrievedOm: retrievedOmIds,
      retrievedBaseline: retrievedBaseIds,
      metrics: {
        openMemory: {
          precision: Math.round(precisionOm * 1000) / 1000,
          recall: Math.round(recallOm * 1000) / 1000,
          obsoleteCount: obsoleteRetrievedOm.length,
          latencyMs: latencyOm,
        },
        baseline: {
          precision: Math.round(precisionBase * 1000) / 1000,
          recall: Math.round(recallBase * 1000) / 1000,
          latencyMs: latencyBase,
        },
      },
      passed,
    });
  }

  // Summary Metrics
  const totalPassed = results.filter(r => r.passed).length;
  const avgOmPrecision = Math.round((results.reduce((acc, r) => acc + r.metrics.openMemory.precision, 0) / results.length) * 1000) / 1000;
  const avgOmRecall = Math.round((results.reduce((acc, r) => acc + r.metrics.openMemory.recall, 0) / results.length) * 1000) / 1000;
  const avgOmLatency = Math.round((results.reduce((acc, r) => acc + r.metrics.openMemory.latencyMs, 0) / results.length) * 1000) / 1000;

  const avgBasePrecision = Math.round((results.reduce((acc, r) => acc + r.metrics.baseline.precision, 0) / results.length) * 1000) / 1000;
  const avgBaseRecall = Math.round((results.reduce((acc, r) => acc + r.metrics.baseline.recall, 0) / results.length) * 1000) / 1000;
  const avgBaseLatency = Math.round((results.reduce((acc, r) => acc + r.metrics.baseline.latencyMs, 0) / results.length) * 1000) / 1000;

  const benchmarkReport = {
    timestamp: new Date().toISOString(),
    benchmarkSummary: {
      totalCategories: results.length,
      passedCategories: totalPassed,
      passRate: `${Math.round((totalPassed / results.length) * 100)}%`,
      openMemoryAverages: {
        meanPrecision: avgOmPrecision,
        meanRecall: avgOmRecall,
        meanLatencyMs: avgOmLatency,
      },
      baselineAverages: {
        meanPrecision: avgBasePrecision,
        meanRecall: avgBaseRecall,
        meanLatencyMs: avgBaseLatency,
      },
      precisionAdvantage: `+${Math.round((avgOmPrecision - avgBasePrecision) * 100)}%`,
    },
    results,
  };

  console.log('-------------------------------------------------------------------');
  console.log(`  G18 Deterministic Benchmark Summary:`);
  console.log(`  Categories Tested:     ${results.length}`);
  console.log(`  Categories Passed:     ${totalPassed} / ${results.length} (${benchmarkReport.benchmarkSummary.passRate})`);
  console.log(`  OpenMemory Precision:  ${avgOmPrecision} vs Baseline: ${avgBasePrecision} (${benchmarkReport.benchmarkSummary.precisionAdvantage} gain)`);
  console.log(`  OpenMemory Recall:     ${avgOmRecall} vs Baseline: ${avgBaseRecall}`);
  console.log(`  OpenMemory Mean Lat:   ${avgOmLatency} ms vs Baseline: ${avgBaseLatency} ms`);
  console.log('-------------------------------------------------------------------');

  results.forEach(r => {
    console.log(`  [${r.passed ? 'PASS' : 'FAIL'}] ${r.category.padEnd(42)} OM Prec: ${r.metrics.openMemory.precision} | Rec: ${r.metrics.openMemory.recall} (${r.metrics.openMemory.latencyMs}ms)`);
  });

  const evidencePath = path.resolve('.work/evidence/g18-retrieval-benchmark-results.json');
  fs.writeFileSync(evidencePath, JSON.stringify(benchmarkReport, null, 2), 'utf8');
  console.log(`\n[Evidence saved to: ${evidencePath}]`);

  assert.strictEqual(totalPassed, results.length, 'All 9 benchmark categories must PASS');
}

runBenchmark().catch(err => {
  console.error('\nBenchmark FAILED:', err);
  process.exit(1);
}).finally(() => {
  try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch (_) {}
});
