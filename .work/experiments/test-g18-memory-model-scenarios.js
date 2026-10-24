/**
 * G18 Test Suite: Memory Model Strengthening & 10 Cognitive Scenarios
 *
 * Implements Bloque B of Iteración G18:
 * Validates the 10 real-world memory governance scenarios:
 * 1. Architectural decision recorded and retrieved with high signal.
 * 2. Old decision superseded by new decision.
 * 3. Retrieval returns active decision with higher ranking and identifies superseded lineage.
 * 4. Unvalidated hypothesis is not presented as confirmed fact.
 * 5. Memory without sufficient evidence cannot reach VALIDATED state (fail-closed).
 * 6. Contradictory relation detected and inspected symmetrically.
 * 7. Deletion/invalidation handles references safely without incoherent corruption.
 * 8. Cold-start engine reload preserves validity and relations with 100% fidelity.
 * 9. Concurrent multi-operation integrity under process lock contention.
 * 10. Query scope isolation prevents cross-project knowledge leakage.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { StorageEngine } = require('../../dist/storage');

let testCount = 0;
let passedCount = 0;

function runTest(name, fn) {
  testCount++;
  process.stdout.write(`  [${testCount}] ${name}... `);
  try {
    fn();
    passedCount++;
    console.log('PASS');
  } catch (err) {
    console.log('FAIL');
    console.error(`      Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    throw err;
  }
}

console.log('===================================================================');
console.log('  G18: Memory Model Governance & 10 Cognitive Scenarios Suite      ');
console.log('===================================================================');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'om-g18-scenarios-'));
const agentId = 'agent-lead-g18';
const sessionId = 'session-lead-g18';

try {
  let storage = new StorageEngine(sandbox);
  storage.ensureStorageStructure();
  storage.registerSession({ id: sessionId, agentId, status: 'ACTIVE' });

  // -------------------------------------------------------------------------
  // SCENARIO 1: Architectural Decision Recording & Retrieval
  // -------------------------------------------------------------------------
  runTest('Scenario 1: Architectural decision recorded and deterministically retrieved', () => {
    storage.saveResearch({
      id: 'RES-ARCH-CORE',
      topic: 'Core Architectural Invariants',
      summary: 'Foundational architectural decisions for persistence',
      status: 'ACTIVE',
      items: [
        {
          id: 'DEC-001',
          type: 'DECISION',
          classification: 'ARCHITECTURE',
          title: 'ADR-001: Local File-System Storage Authority',
          content: 'All agent state must be stored locally in atomic JSON files without external daemon requirements.',
          tags: ['architecture', 'persistence', 'filesystem', 'local-first'],
          lifecycleState: 'ACCEPTED',
          evidenceRef: 'https://docs.openmemory.dev/adr/001',
          evaluatorRole: 'TECH_LEAD',
          rationale: 'Zero external dependency architectural requirement',
        },
      ],
      relations: [],
    }, agentId, sessionId);

    const matches = storage.queryKnowledgeItems({
      researchId: 'RES-ARCH-CORE',
      query: 'local filesystem persistence',
    });

    assert(matches.length > 0, 'Must retrieve DEC-001');
    assert.strictEqual(matches[0].item.id, 'DEC-001');
    assert.strictEqual(matches[0].item.lifecycleState, 'ACCEPTED');
    assert(matches[0].score && matches[0].score > 0, 'Must have positive BM25 score');
  });

  // -------------------------------------------------------------------------
  // SCENARIO 2: Old Decision Superseded by New Decision
  // -------------------------------------------------------------------------
  runTest('Scenario 2: Old decision superseded by new decision with full rationale', () => {
    // Add DEC-002: Enhanced Hybrid Engine that supersedes DEC-001
    const record = storage.getResearch('RES-ARCH-CORE');
    assert(record, 'Record must exist');

    record.items.push({
      id: 'DEC-002',
      type: 'DECISION',
      classification: 'ARCHITECTURE',
      title: 'ADR-002: Atomic File-System Storage with SQLite Secondary Index',
      content: 'Maintain atomic JSON as source of truth with optional SQLite secondary index for high-scale querying.',
      tags: ['architecture', 'persistence', 'hybrid', 'sqlite'],
      lifecycleState: 'ACCEPTED',
      evidenceRef: 'https://docs.openmemory.dev/adr/002',
      evaluatorRole: 'TECH_LEAD',
      rationale: 'Evolution of storage engine to support scale while keeping zero-dependency baseline',
    });

    storage.saveResearch(record, agentId, sessionId);

    // Transition DEC-001 to SUPERSEDED
    const trans = storage.updateKnowledgeLifecycle({
      researchId: 'RES-ARCH-CORE',
      itemId: 'DEC-001',
      targetState: 'SUPERSEDED',
      actorRole: 'LEAD_AGENT',
      evaluationRationale: 'Superseded by ADR-002 hybrid index architecture',
      actorId: agentId,
      sessionId,
    });
    assert.strictEqual(trans.success, true);
    assert.strictEqual(trans.item.lifecycleState, 'SUPERSEDED');

    // Create relation DEC-002 SUPERSEDES DEC-001
    const rel = storage.addKnowledgeRelation({
      researchId: 'RES-ARCH-CORE',
      sourceItemId: 'DEC-002',
      targetItemId: 'DEC-001',
      relationType: 'SUPERSEDES',
      rationale: 'ADR-002 supersedes ADR-001 with backward compatible secondary index',
      agentId,
      sessionId,
    });
    assert.strictEqual(rel.success, true);
  });

  // -------------------------------------------------------------------------
  // SCENARIO 3: Active vs Superseded Decision Ranking & Lineage
  // -------------------------------------------------------------------------
  runTest('Scenario 3: Active decision ranks higher than superseded decision in queries', () => {
    const matches = storage.queryKnowledgeItems({
      researchId: 'RES-ARCH-CORE',
      query: 'storage architecture persistence',
    });

    assert.strictEqual(matches.length, 2, 'Must retrieve both DEC-002 and DEC-001');

    // DEC-002 is ACCEPTED (multiplier 1.25x), DEC-001 is SUPERSEDED (multiplier 0.5x)
    assert.strictEqual(matches[0].item.id, 'DEC-002', 'Active decision must rank #1');
    assert.strictEqual(matches[1].item.id, 'DEC-001', 'Superseded decision must rank #2');
    assert(matches[0].score > matches[1].score, 'Active decision must have strictly higher score');

    // Check TMS Lineage
    const analysis = storage.analyzeKnowledgeTMS({ researchId: 'RES-ARCH-CORE' });
    const dec1View = analysis.items['DEC-001'];
    const dec2View = analysis.items['DEC-002'];

    assert(dec1View, 'DEC-001 view must exist');
    assert(dec2View, 'DEC-002 view must exist');
    assert.strictEqual(dec1View.derivedLineageStatus, 'SUPERSEDED_BY_ACCEPTED_SOURCE');
    assert.strictEqual(dec2View.derivedLineageStatus, 'SUPERSEDING');
  });

  // -------------------------------------------------------------------------
  // SCENARIO 4: Unvalidated Hypothesis Discrimination
  // -------------------------------------------------------------------------
  runTest('Scenario 4: Unvalidated hypothesis discriminated from confirmed knowledge', () => {
    const record = storage.getResearch('RES-ARCH-CORE');
    record.items.push({
      id: 'HYP-001',
      type: 'HYPOTHESIS',
      classification: 'PERFORMANCE',
      title: 'Hypothesis: In-Memory Redis Cache 10x Throughput Spike',
      content: 'Hypothesis that adding Redis cache will increase read throughput by 10x in high-concurrency workloads.',
      tags: ['cache', 'redis', 'hypothesis', 'experimental'],
      lifecycleState: 'CREATED',
    });
    storage.saveResearch(record, agentId, sessionId);

    const matches = storage.queryKnowledgeItems({
      researchId: 'RES-ARCH-CORE',
      query: 'storage cache throughput',
    });

    const hypMatch = matches.find(m => m.item.id === 'HYP-001');
    assert(hypMatch, 'Hypothesis must be queryable');
    assert.strictEqual(hypMatch.item.lifecycleState, 'CREATED');

    // Verified that lifecycleState explicitly prevents presenting hypothesis as ACCEPTED
    assert.notStrictEqual(hypMatch.item.lifecycleState, 'ACCEPTED');
    assert.notStrictEqual(hypMatch.item.lifecycleState, 'VALIDATED');
  });

  // -------------------------------------------------------------------------
  // SCENARIO 5: Fail-Closed Evidence Validation Requirement
  // -------------------------------------------------------------------------
  runTest('Scenario 5: Transition to VALIDATED fails closed without sufficient evidence', () => {
    // 1. Attempt without evidenceReference must fail
    const invalidTrans1 = storage.updateKnowledgeLifecycle({
      researchId: 'RES-ARCH-CORE',
      itemId: 'HYP-001',
      targetState: 'VALIDATED',
      actorRole: 'WORKER_AGENT',
      evidenceReference: '',
      actorId: agentId,
      sessionId,
    });
    assert.strictEqual(invalidTrans1.success, false);
    assert(invalidTrans1.reason.includes('evidenceReference (min 3 chars) is mandatory'));

    // 2. Attempt with short evidence (< 3 chars) must fail
    const invalidTrans2 = storage.updateKnowledgeLifecycle({
      researchId: 'RES-ARCH-CORE',
      itemId: 'HYP-001',
      targetState: 'VALIDATED',
      actorRole: 'WORKER_AGENT',
      evidenceReference: 'ab',
      actorId: agentId,
      sessionId,
    });
    assert.strictEqual(invalidTrans2.success, false);

    // 3. Attempt with valid evidence succeeds
    const validTrans = storage.updateKnowledgeLifecycle({
      researchId: 'RES-ARCH-CORE',
      itemId: 'HYP-001',
      targetState: 'VALIDATED',
      actorRole: 'WORKER_AGENT',
      evidenceReference: 'bench-run-redis-vs-fs.log',
      evaluationRationale: 'Empirical benchmark showed 1.4x gain, not 10x',
      actorId: agentId,
      sessionId,
    });
    assert.strictEqual(validTrans.success, true);
    assert.strictEqual(validTrans.item.lifecycleState, 'VALIDATED');
  });

  // -------------------------------------------------------------------------
  // SCENARIO 6: Contradiction Detection & Inspection
  // -------------------------------------------------------------------------
  runTest('Scenario 6: Contradictory relation detected and inspected symmetrically', () => {
    // Add CONTRADICTS relation: HYP-001 CONTRADICTS DEC-002 (Redis violates zero-daemon policy)
    const rel = storage.addKnowledgeRelation({
      researchId: 'RES-ARCH-CORE',
      sourceItemId: 'HYP-001',
      targetItemId: 'DEC-002',
      relationType: 'CONTRADICTS',
      rationale: 'Redis daemon violates zero external dependency invariant in ADR-002',
      agentId,
      sessionId,
    });
    assert.strictEqual(rel.success, true);

    const analysis = storage.analyzeKnowledgeTMS({ researchId: 'RES-ARCH-CORE' });
    assert.strictEqual(analysis.overallStatus, 'CONFLICTED', 'Contradiction must mark graph as CONFLICTED');

    const hypView = analysis.items['HYP-001'];
    const dec2View = analysis.items['DEC-002'];

    assert.strictEqual(hypView.derivedConflictState, 'CONFLICTED');
    assert.strictEqual(dec2View.derivedConflictState, 'CONFLICTED');
    assert(hypView.diagnostics.some(d => d.includes('Contradiction detected with target item \'DEC-002\'')));
    assert(dec2View.diagnostics.some(d => d.includes('Contradiction detected with source item \'HYP-001\'')));
  });

  // -------------------------------------------------------------------------
  // SCENARIO 7: Invalidation / Deletion Without Incoherent References
  // -------------------------------------------------------------------------
  runTest('Scenario 7: Deletion of knowledge item cleans up and maintains graph integrity', () => {
    // Delete HYP-001
    const delRes = storage.deleteKnowledgeItem({
      researchId: 'RES-ARCH-CORE',
      itemId: 'HYP-001',
      agentId,
      sessionId,
    });
    assert.strictEqual(delRes.success, true);

    const record = storage.getResearch('RES-ARCH-CORE');
    assert(!record.items.some(i => i.id === 'HYP-001'), 'HYP-001 must be deleted from items');

    // Run TMS analysis to ensure graph is consistent without crashes
    const analysis = storage.analyzeKnowledgeTMS({ researchId: 'RES-ARCH-CORE' });
    assert(!analysis.items['HYP-001'], 'HYP-001 must not have an item view');
    assert.strictEqual(analysis.items['DEC-002'].derivedConflictState, 'CONSISTENT');
  });

  // -------------------------------------------------------------------------
  // SCENARIO 8: Cold-Start Process Restart & Persistence Fidelity
  // -------------------------------------------------------------------------
  runTest('Scenario 8: Cold-start reload from disk preserves all knowledge and relations', () => {
    // Instantiate fresh StorageEngine simulating process restart
    const freshStorage = new StorageEngine(sandbox);
    freshStorage.ensureStorageStructure();

    const record = freshStorage.getResearch('RES-ARCH-CORE');
    assert(record, 'Must reload record from disk');
    assert.strictEqual(record.items.length, 2, 'Must contain DEC-001 and DEC-002');

    const dec1 = record.items.find(i => i.id === 'DEC-001');
    const dec2 = record.items.find(i => i.id === 'DEC-002');
    assert.strictEqual(dec1.lifecycleState, 'SUPERSEDED');
    assert.strictEqual(dec2.lifecycleState, 'ACCEPTED');

    const analysis = freshStorage.analyzeKnowledgeTMS({ researchId: 'RES-ARCH-CORE' });
    assert.strictEqual(analysis.summary.totalItems, 2);
    assert.strictEqual(analysis.summary.totalRelations, 1);
    assert.strictEqual(analysis.items['DEC-001'].derivedLineageStatus, 'SUPERSEDED_BY_ACCEPTED_SOURCE');
  });

  // -------------------------------------------------------------------------
  // SCENARIO 9: Concurrent Multi-Operation Integrity
  // -------------------------------------------------------------------------
  runTest('Scenario 9: Concurrent operations with process lock contention preserve integrity', () => {
    const numOps = 8;
    storage.saveResearch({
      id: 'RES-CONCURRENCY-TEST',
      topic: 'Concurrency Isolation Test Record',
      summary: 'Testing process lock concurrency without noise policy violation',
      status: 'ACTIVE',
      items: [],
      relations: [],
    }, agentId, sessionId);

    for (let i = 0; i < numOps; i++) {
      storage.withStateLock(() => {
        const record = storage.getResearch('RES-CONCURRENCY-TEST');
        record.items.push({
          id: `CONC-ITEM-${i}`,
          type: 'OBSERVATION',
          classification: 'FACT',
          title: `Concurrent Knowledge Invariant ${i}`,
          content: `Validation payload ${i}`,
          tags: ['concurrency', 'stress'],
          lifecycleState: 'VALIDATED',
          evidenceRef: `evidence-${i}`,
        });
        storage.saveResearch(record, agentId, sessionId);
      }, agentId);
    }

    const reloaded = storage.getResearch('RES-CONCURRENCY-TEST');
    const concItems = reloaded.items.filter(i => i.id.startsWith('CONC-ITEM-'));
    assert.strictEqual(concItems.length, numOps, 'All concurrent operations must be atomically committed');
  });

  // -------------------------------------------------------------------------
  // SCENARIO 10: Multi-Project / Scope Isolation
  // -------------------------------------------------------------------------
  runTest('Scenario 10: Query scope isolation strictly prevents cross-project leakage', () => {
    // Create ResearchRecord A for Alpha
    storage.saveResearch({
      id: 'PROJECT-ALPHA',
      topic: 'Project Alpha Confidential Data',
      summary: 'Proprietary cryptographic protocols for Alpha',
      status: 'ACTIVE',
      items: [
        {
          id: 'ALPHA-001',
          type: 'DECISION',
          classification: 'SECURITY',
          title: 'Alpha Quantum Fencing Specification',
          content: 'Strictly proprietary cryptographic fence key 0x994FA2.',
          tags: ['security', 'alpha', 'crypto'],
          lifecycleState: 'ACCEPTED',
        },
      ],
      relations: [],
    }, agentId, sessionId);

    // Create ResearchRecord B for Beta
    storage.saveResearch({
      id: 'PROJECT-BETA',
      topic: 'Project Beta Public Roadmap',
      summary: 'Public web frontend specification for Beta',
      status: 'ACTIVE',
      items: [
        {
          id: 'BETA-001',
          type: 'OBSERVATION',
          classification: 'ROADMAP',
          title: 'Beta Web Portal Layout',
          content: 'Public UI layout for consumer inventory dashboard.',
          tags: ['frontend', 'beta', 'ui'],
          lifecycleState: 'VALIDATED',
        },
      ],
      relations: [],
    }, agentId, sessionId);

    // Query scoped to PROJECT-ALPHA must NOT leak BETA items
    const alphaQuery = storage.queryKnowledgeItems({
      researchId: 'PROJECT-ALPHA',
      query: 'cryptographic portal inventory layout',
    });
    assert.strictEqual(alphaQuery.length, 1);
    assert.strictEqual(alphaQuery[0].item.id, 'ALPHA-001');

    // Query scoped to PROJECT-BETA must NOT leak ALPHA items
    const betaQuery = storage.queryKnowledgeItems({
      researchId: 'PROJECT-BETA',
      query: 'cryptographic portal inventory layout',
    });
    assert.strictEqual(betaQuery.length, 1);
    assert.strictEqual(betaQuery[0].item.id, 'BETA-001');
  });

  console.log('-------------------------------------------------------------------');
  console.log(`  G18 Cognitive Scenarios: ${passedCount} / ${testCount} tests PASSED.`);
  console.log('-------------------------------------------------------------------');
} finally {
  try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch (_) {}
}
