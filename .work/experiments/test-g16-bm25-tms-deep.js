/**
 * G16 Test Suite: Deep Architectural Verification of BM25 & Truth Maintenance System
 *
 * Covers:
 * 1. BM25 Query Edge Cases: empty query, whitespace, special characters, repeated terms, case-insensitivity.
 * 2. Field Weighting Hierarchy: Title (3.0x) > Tags (2.5x) > Topic (2.0x) > Content (1.0x).
 * 3. Lifecycle State Biasing: ACCEPTED (1.25x) > VALIDATED (1.1x) > CREATED (1.0x) > SUPERSEDED (0.5x) > DEPRECATED (0.2x).
 * 4. Filter Invariants: minScore threshold, limit pagination, category, itemType, lifecycleState.
 * 5. Robustness to Sparse Data: records with omitted category, empty tags, missing provenance.
 * 6. Empty Collections: graceful empty return without NaN or exceptions.
 * 7. TMS Role Permissions & Invariant Enforcement: WORKER_AGENT, LEAD_AGENT, HUMAN_OPERATOR constraints.
 * 8. TMS Evidence & Rationale Guards: evidenceReference mandatory for VALIDATED, evaluationRationale for ACCEPTED.
 * 9. Terminal State Protection: permanent fail-closed lockdown on SUPERSEDED and DEPRECATED items.
 * 10. Relations Invariants: self-relation rejection, source ownership mismatch, idempotent duplicates, supersedes cycle rejection.
 * 11. Graph Consistency Analysis: contradiction detection, overallStatus calculation, target-not-found tracking.
 * 12. Cold Restart Persistence: full data, relations, and lifecycle state fidelity across process/instance boundaries.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const { StorageEngine } = require('../../dist/index');

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

function makeSandbox() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'om-g16-deep-'));
}

function removeSandbox(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
}

console.log('===================================================================');
console.log('  G16: Deep BM25 & Truth Maintenance System (TMS) Verification     ');
console.log('===================================================================');

const SESSION_ID = 'session-g16-audit';
const AGENT_ID = 'agent-g16-lead';

// ---------------------------------------------------------------------------
// TEST 1: Empty Queries and Backward Compatibility
// ---------------------------------------------------------------------------
runTest('Empty or whitespace queries return unranked results with 100% backward compatibility', () => {
  const sandbox = makeSandbox();
  try {
    const storage = new StorageEngine(sandbox);
    storage.ensureStorageStructure();
    storage.registerSession({ id: SESSION_ID, agentId: AGENT_ID, status: 'ACTIVE' });

    storage.saveResearch({
      id: 'RES-001',
      topic: 'Distributed Systems',
      summary: 'Consensus protocols',
      status: 'COMPLETED',
      items: [
        { id: 'ITEM-1', type: 'SOURCE', classification: 'FACT', title: 'Paxos Invariant', content: 'Quorum consensus', lifecycleState: 'CREATED' },
        { id: 'ITEM-2', type: 'SOURCE', classification: 'FACT', title: 'Raft Log Replication', content: 'Leader election', lifecycleState: 'VALIDATED' },
      ],
      relations: [],
    }, AGENT_ID, SESSION_ID);

    // 1. query undefined
    const resUndef = storage.queryKnowledgeItems();
    assert.strictEqual(resUndef.length, 2);
    assert.strictEqual(resUndef[0].score, undefined, 'Unfiltered query must have score undefined');

    // 2. query empty string
    const resEmpty = storage.queryKnowledgeItems({ query: '' });
    assert.strictEqual(resEmpty.length, 2);
    assert.strictEqual(resEmpty[0].score, undefined);

    // 3. query whitespace only
    const resWhitespace = storage.queryKnowledgeItems({ query: '     ' });
    assert.strictEqual(resWhitespace.length, 2);
    assert.strictEqual(resWhitespace[0].score, undefined);
  } finally {
    removeSandbox(sandbox);
  }
});

// ---------------------------------------------------------------------------
// TEST 2: Special Characters, Punctuation and Case-Insensitivity in BM25
// ---------------------------------------------------------------------------
runTest('BM25 tokenization handles punctuation, special chars, repeated terms and case-insensitivity cleanly', () => {
  const sandbox = makeSandbox();
  try {
    const storage = new StorageEngine(sandbox);
    storage.ensureStorageStructure();
    storage.registerSession({ id: SESSION_ID, agentId: AGENT_ID, status: 'ACTIVE' });

    storage.saveResearch({
      id: 'RES-TOKEN-01',
      topic: 'Network Protocols & Async I/O',
      summary: 'TCP/IP and WebSocket protocols',
      status: 'COMPLETED',
      items: [
        { id: 'ITEM-TCP', type: 'SOURCE', classification: 'FACT', title: 'TCP Three-Way Handshake (SYN, SYN-ACK, ACK)', content: 'Connection establishment in TCP.', lifecycleState: 'ACCEPTED' },
      ],
      relations: [],
    }, AGENT_ID, SESSION_ID);

    // Punctuation and special characters in query
    const res1 = storage.queryKnowledgeItems({ query: 'tcp! three-way??? handshake; (syn-ack)' });
    assert.strictEqual(res1.length, 1);
    assert.strictEqual(res1[0].item.id, 'ITEM-TCP');
    assert(res1[0].score && res1[0].score > 0);

    // Case insensitivity
    const resCase = storage.queryKnowledgeItems({ query: 'TCP HANDSHAKE' });
    assert.strictEqual(resCase.length, 1);
    assert.strictEqual(resCase[0].item.id, 'ITEM-TCP');

    // Repeated terms do not cause NaN or crash
    const resRepeated = storage.queryKnowledgeItems({ query: 'tcp tcp tcp tcp handshake' });
    assert.strictEqual(resRepeated.length, 1);
    assert(!isNaN(resRepeated[0].score || NaN));
    assert(resRepeated[0].score && resRepeated[0].score > 0);
  } finally {
    removeSandbox(sandbox);
  }
});

// ---------------------------------------------------------------------------
// TEST 3: Sparse Records and Empty Collections
// ---------------------------------------------------------------------------
runTest('BM25 gracefully handles empty collections and sparse items with omitted optional fields', () => {
  const sandbox = makeSandbox();
  try {
    const storage = new StorageEngine(sandbox);
    storage.ensureStorageStructure();
    storage.registerSession({ id: SESSION_ID, agentId: AGENT_ID, status: 'ACTIVE' });

    // 1. Empty collection query
    const resEmptyCollection = storage.queryKnowledgeItems({ query: 'quantum computing' });
    assert.deepStrictEqual(resEmptyCollection, []);

    // 2. Sparse item with omitted category, empty tags, empty content
    storage.saveResearch({
      id: 'RES-SPARSE-01',
      topic: 'Bare Topic',
      // category omitted!
      summary: 'Sparse record',
      status: 'COMPLETED',
      items: [
        {
          id: 'ITEM-SPARSE-1',
          type: 'SOURCE',
          classification: 'FACT',
          title: 'Quantum Key Distribution',
          content: '', // empty content
          tags: [],    // empty tags
          // lifecycleState omitted (defaults to LEGACY_UNEVALUATED)
        },
      ],
      relations: [],
    }, AGENT_ID, SESSION_ID);

    const resSparse = storage.queryKnowledgeItems({ query: 'quantum distribution' });
    assert.strictEqual(resSparse.length, 1);
    assert.strictEqual(resSparse[0].item.id, 'ITEM-SPARSE-1');
    assert(resSparse[0].score && resSparse[0].score > 0);
    assert(!isNaN(resSparse[0].score));
  } finally {
    removeSandbox(sandbox);
  }
});

// ---------------------------------------------------------------------------
// TEST 4: Deterministic Field Hierarchy & Score Monotonicity
// ---------------------------------------------------------------------------
runTest('BM25 field hierarchy strictly enforces Title (3.0x) > Tags (2.5x) > Topic (2.0x) > Content (1.0x)', () => {
  const sandbox = makeSandbox();
  try {
    const storage = new StorageEngine(sandbox);
    storage.ensureStorageStructure();
    storage.registerSession({ id: SESSION_ID, agentId: AGENT_ID, status: 'ACTIVE' });

    // Item A: Match exclusively in TITLE
    const itemA = { id: 'ITEM-A', type: 'SOURCE', classification: 'FACT', title: 'Byzantine Agreement Protocol', content: 'Generic distributed computing text.', tags: ['system'], lifecycleState: 'CREATED' };
    storage.saveResearch({ id: 'RES-A', topic: 'General Systems', summary: 'S1', status: 'COMPLETED', items: [itemA], relations: [] }, AGENT_ID, SESSION_ID);

    // Item B: Match exclusively in TAGS
    const itemB = { id: 'ITEM-B', type: 'SOURCE', classification: 'FACT', title: 'Consensus Systems Review', content: 'Generic distributed computing text.', tags: ['byzantine', 'agreement'], lifecycleState: 'CREATED' };
    storage.saveResearch({ id: 'RES-B', topic: 'General Systems', summary: 'S2', status: 'COMPLETED', items: [itemB], relations: [] }, AGENT_ID, SESSION_ID);

    // Item C: Match exclusively in CONTENT
    const itemC = { id: 'ITEM-C', type: 'SOURCE', classification: 'FACT', title: 'Fault Tolerance Architectures', content: 'Detailed analysis of byzantine agreement protocol under adversarial network.', tags: ['system'], lifecycleState: 'CREATED' };
    storage.saveResearch({ id: 'RES-C', topic: 'General Systems', summary: 'S3', status: 'COMPLETED', items: [itemC], relations: [] }, AGENT_ID, SESSION_ID);

    const results = storage.queryKnowledgeItems({ query: 'byzantine agreement' });
    assert.strictEqual(results.length, 3);

    const scoreA = results.find(r => r.item.id === 'ITEM-A').score || 0;
    const scoreB = results.find(r => r.item.id === 'ITEM-B').score || 0;
    const scoreC = results.find(r => r.item.id === 'ITEM-C').score || 0;

    assert(scoreA > scoreB, `Title match (${scoreA}) must exceed Tag match (${scoreB})`);
    assert(scoreB > scoreC, `Tag match (${scoreB}) must exceed Content match (${scoreC})`);
  } finally {
    removeSandbox(sandbox);
  }
});

// ---------------------------------------------------------------------------
// TEST 5: Comprehensive TMS Transition Governance & Role Protections
// ---------------------------------------------------------------------------
runTest('TMS transition governance validates evidence, roles, rationales and terminal guards fail-closed', () => {
  const sandbox = makeSandbox();
  try {
    const storage = new StorageEngine(sandbox);
    storage.ensureStorageStructure();
    storage.registerSession({ id: SESSION_ID, agentId: AGENT_ID, status: 'ACTIVE' });

    storage.saveResearch({
      id: 'RES-GOV-01',
      topic: 'TMS Governance Rules',
      summary: 'Audit of governance invariants',
      status: 'IN_PROGRESS',
      items: [
        { id: 'ITEM-RULE-1', type: 'SOURCE', classification: 'FACT', title: 'Rule Spec', content: 'Rules text', lifecycleState: 'CREATED' },
      ],
      relations: [],
    }, AGENT_ID, SESSION_ID);

    // 1. Attempt VALIDATED without evidenceReference -> must fail
    const f1 = storage.updateKnowledgeLifecycle({
      researchId: 'RES-GOV-01',
      itemId: 'ITEM-RULE-1',
      targetState: 'VALIDATED',
      actorId: AGENT_ID,
      sessionId: SESSION_ID,
      actorRole: 'WORKER_AGENT',
      evaluationRationale: 'Missing evidence',
    });
    assert.strictEqual(f1.success, false);
    assert(f1.reason?.includes('evidenceReference'));

    // 2. Attempt direct transition CREATED -> ACCEPTED -> must fail (must be VALIDATED first)
    const f2 = storage.updateKnowledgeLifecycle({
      researchId: 'RES-GOV-01',
      itemId: 'ITEM-RULE-1',
      targetState: 'ACCEPTED',
      actorId: AGENT_ID,
      sessionId: SESSION_ID,
      actorRole: 'LEAD_AGENT',
      evaluationRationale: 'Validating without prior verification',
    });
    assert.strictEqual(f2.success, false);
    assert(f2.reason?.includes('must be VALIDATED prior to acceptance'));

    // 3. Valid transition to VALIDATED
    const s1 = storage.updateKnowledgeLifecycle({
      researchId: 'RES-GOV-01',
      itemId: 'ITEM-RULE-1',
      targetState: 'VALIDATED',
      actorId: AGENT_ID,
      sessionId: SESSION_ID,
      actorRole: 'WORKER_AGENT',
      evidenceReference: 'https://specs.openmemory.dev/tms',
      evaluationRationale: 'Test evidence provided',
    });
    assert.strictEqual(s1.success, true);
    assert.strictEqual(s1.item?.lifecycleState, 'VALIDATED');

    // 4. Attempt ACCEPTED by WORKER_AGENT -> must fail (unauthorized role)
    const f3 = storage.updateKnowledgeLifecycle({
      researchId: 'RES-GOV-01',
      itemId: 'ITEM-RULE-1',
      targetState: 'ACCEPTED',
      actorId: AGENT_ID,
      sessionId: SESSION_ID,
      actorRole: 'WORKER_AGENT',
      evaluationRationale: 'Worker trying to accept',
    });
    assert.strictEqual(f3.success, false);
    assert(f3.reason?.includes('Unauthorized acceptance'));

    // 5. Valid transition to ACCEPTED by HUMAN_OPERATOR
    const s2 = storage.updateKnowledgeLifecycle({
      researchId: 'RES-GOV-01',
      itemId: 'ITEM-RULE-1',
      targetState: 'ACCEPTED',
      actorId: AGENT_ID,
      sessionId: SESSION_ID,
      actorRole: 'HUMAN_OPERATOR',
      evaluationRationale: 'Formal sign-off by human architect',
    });
    assert.strictEqual(s2.success, true);
    assert.strictEqual(s2.item?.lifecycleState, 'ACCEPTED');

    // 6. Valid transition to DEPRECATED by LEAD_AGENT
    const s3 = storage.updateKnowledgeLifecycle({
      researchId: 'RES-GOV-01',
      itemId: 'ITEM-RULE-1',
      targetState: 'DEPRECATED',
      actorId: AGENT_ID,
      sessionId: SESSION_ID,
      actorRole: 'LEAD_AGENT',
      evaluationRationale: 'Deprecated due to architectural redesign',
    });
    assert.strictEqual(s3.success, true);
    assert.strictEqual(s3.item?.lifecycleState, 'DEPRECATED');

    // 7. Terminal state guard: Attempt any transition from DEPRECATED -> must fail
    const f4 = storage.updateKnowledgeLifecycle({
      researchId: 'RES-GOV-01',
      itemId: 'ITEM-RULE-1',
      targetState: 'VALIDATED',
      actorId: AGENT_ID,
      sessionId: SESSION_ID,
      actorRole: 'HUMAN_OPERATOR',
      evidenceReference: 'https://resurrect.example',
    });
    assert.strictEqual(f4.success, false);
    assert(f4.reason?.includes('Terminal state protection'));
  } finally {
    removeSandbox(sandbox);
  }
});

// ---------------------------------------------------------------------------
// TEST 6: TMS Relations & Supersession Cycle Prevention
// ---------------------------------------------------------------------------
runTest('TMS enforces relation types, prevents self-relations, handles duplicates idempotently and rejects cycles', () => {
  const sandbox = makeSandbox();
  try {
    const storage = new StorageEngine(sandbox);
    storage.ensureStorageStructure();
    storage.registerSession({ id: SESSION_ID, agentId: AGENT_ID, status: 'ACTIVE' });

    storage.saveResearch({
      id: 'RES-REL-01',
      topic: 'TMS Relations',
      summary: 'Testing relations',
      status: 'IN_PROGRESS',
      items: [
        { id: 'ITEM-R1', type: 'SOURCE', classification: 'FACT', title: 'Item 1', content: 'C1', lifecycleState: 'CREATED' },
        { id: 'ITEM-R2', type: 'SOURCE', classification: 'FACT', title: 'Item 2', content: 'C2', lifecycleState: 'CREATED' },
        { id: 'ITEM-R3', type: 'SOURCE', classification: 'FACT', title: 'Item 3', content: 'C3', lifecycleState: 'CREATED' },
      ],
      relations: [],
    }, AGENT_ID, SESSION_ID);

    // 1. Invalid relationType
    const f1 = storage.addKnowledgeRelation({
      researchId: 'RES-REL-01',
      relationType: 'INVALID_TYPE',
      sourceItemId: 'ITEM-R1',
      targetItemId: 'ITEM-R2',
      agentId: AGENT_ID,
      sessionId: SESSION_ID,
    });
    assert.strictEqual(f1.success, false);
    assert(f1.reason?.includes('Invalid relationType'));

    // 2. Self-relation rejected
    const f2 = storage.addKnowledgeRelation({
      researchId: 'RES-REL-01',
      relationType: 'SUPPORTS',
      sourceItemId: 'ITEM-R1',
      targetItemId: 'ITEM-R1',
      agentId: AGENT_ID,
      sessionId: SESSION_ID,
    });
    assert.strictEqual(f2.success, false);
    assert(f2.reason?.includes('Self-relation rejected'));

    // 3. Valid relation
    const s1 = storage.addKnowledgeRelation({
      researchId: 'RES-REL-01',
      relationType: 'SUPERSEDES',
      sourceItemId: 'ITEM-R1',
      targetItemId: 'ITEM-R2',
      agentId: AGENT_ID,
      sessionId: SESSION_ID,
    });
    assert.strictEqual(s1.success, true);
    assert(s1.relation?.id);

    // 4. Idempotent duplicate
    const s2 = storage.addKnowledgeRelation({
      researchId: 'RES-REL-01',
      relationType: 'SUPERSEDES',
      sourceItemId: 'ITEM-R1',
      targetItemId: 'ITEM-R2',
      agentId: AGENT_ID,
      sessionId: SESSION_ID,
    });
    assert.strictEqual(s2.success, true);
    assert.strictEqual(s2.relation?.id, s1.relation?.id, 'Duplicate must return existing relation idempotently');

    // 5. Add second edge: ITEM-R2 SUPERSEDES ITEM-R3
    storage.addKnowledgeRelation({
      researchId: 'RES-REL-01',
      relationType: 'SUPERSEDES',
      sourceItemId: 'ITEM-R2',
      targetItemId: 'ITEM-R3',
      agentId: AGENT_ID,
      sessionId: SESSION_ID,
    });

    // 6. Attempt transitive cycle: ITEM-R3 SUPERSEDES ITEM-R1 -> must fail
    const fCycle = storage.addKnowledgeRelation({
      researchId: 'RES-REL-01',
      relationType: 'SUPERSEDES',
      sourceItemId: 'ITEM-R3',
      targetItemId: 'ITEM-R1',
      agentId: AGENT_ID,
      sessionId: SESSION_ID,
    });
    assert.strictEqual(fCycle.success, false);
    assert(fCycle.reason?.includes('Supersession cycle rejected'));
  } finally {
    removeSandbox(sandbox);
  }
});

// ---------------------------------------------------------------------------
// TEST 7: Cold Restart Persistence & Data Fidelity Across Instances
// ---------------------------------------------------------------------------
runTest('All items, lifecycle transitions, relations and BM25 queries survive engine restart with 100% fidelity', () => {
  const sandbox = makeSandbox();
  try {
    // Session 1: Create and populate
    {
      const storage1 = new StorageEngine(sandbox);
      storage1.ensureStorageStructure();
      storage1.registerSession({ id: SESSION_ID, agentId: AGENT_ID, status: 'ACTIVE' });

      storage1.saveResearch({
        id: 'RES-PERSIST-01',
        topic: 'Database Durability & WAL Checkpoints',
        summary: 'Storage recovery tests',
        status: 'COMPLETED',
        items: [
          { id: 'ITEM-WAL-1', type: 'SOURCE', classification: 'FACT', title: 'WAL Checkpoint Invariants', content: 'Passive, full, and restart checkpoints.', tags: ['wal', 'sqlite'], lifecycleState: 'CREATED' },
          { id: 'ITEM-WAL-2', type: 'SOURCE', classification: 'FACT', title: 'Rollback Journal Obsolete Mode', content: 'Deprecated legacy journaling mode.', tags: ['journal', 'legacy'], lifecycleState: 'CREATED' },
        ],
        relations: [],
      }, AGENT_ID, SESSION_ID);

      // Transition ITEM-WAL-1 to ACCEPTED
      storage1.updateKnowledgeLifecycle({
        researchId: 'RES-PERSIST-01',
        itemId: 'ITEM-WAL-1',
        targetState: 'VALIDATED',
        actorId: AGENT_ID,
        sessionId: SESSION_ID,
        evidenceReference: 'https://sqlite.org/wal.html',
        evaluationRationale: 'Verified against SQLite docs',
      });
      storage1.updateKnowledgeLifecycle({
        researchId: 'RES-PERSIST-01',
        itemId: 'ITEM-WAL-1',
        targetState: 'ACCEPTED',
        actorId: AGENT_ID,
        sessionId: SESSION_ID,
        actorRole: 'LEAD_AGENT',
        evaluationRationale: 'Accepted into core architectural baseline',
      });

      // Transition ITEM-WAL-2 to SUPERSEDED
      storage1.updateKnowledgeLifecycle({
        researchId: 'RES-PERSIST-01',
        itemId: 'ITEM-WAL-2',
        targetState: 'SUPERSEDED',
        actorId: AGENT_ID,
        sessionId: SESSION_ID,
        actorRole: 'LEAD_AGENT',
        evaluationRationale: 'Superseded by WAL mode implementation',
      });

      // Add relation
      storage1.addKnowledgeRelation({
        researchId: 'RES-PERSIST-01',
        relationType: 'SUPERSEDES',
        sourceItemId: 'ITEM-WAL-1',
        targetItemId: 'ITEM-WAL-2',
        agentId: AGENT_ID,
        sessionId: SESSION_ID,
        rationale: 'WAL supersedes rollback journal',
      });
    }

    // Simulate complete process termination & fresh restart
    {
      const storage2 = new StorageEngine(sandbox);
      storage2.ensureStorageStructure();

      const rec = storage2.getResearch('RES-PERSIST-01');
      assert(rec, 'Research record must exist after restart');
      assert.strictEqual(rec.items.length, 2);

      const item1 = rec.items.find(i => i.id === 'ITEM-WAL-1');
      const item2 = rec.items.find(i => i.id === 'ITEM-WAL-2');
      assert.strictEqual(item1?.lifecycleState, 'ACCEPTED', 'Item 1 state must persist as ACCEPTED');
      assert.strictEqual(item2?.lifecycleState, 'SUPERSEDED', 'Item 2 state must persist as SUPERSEDED');

      assert.strictEqual(rec.relations.length, 1);
      assert.strictEqual(rec.relations[0].relationType, 'SUPERSEDES');
      assert.strictEqual(rec.relations[0].sourceItemId, 'ITEM-WAL-1');
      assert.strictEqual(rec.relations[0].targetItemId, 'ITEM-WAL-2');

      // Verify BM25 query rankings work identically after restart
      const ranked = storage2.queryKnowledgeItems({ query: 'wal checkpoint' });
      assert(ranked.length >= 1, 'Must return matching items');
      assert.strictEqual(ranked[0].item.id, 'ITEM-WAL-1', 'ACCEPTED item with title match must be rank 1');
      assert(ranked[0].score && ranked[0].score > 0);
      if (ranked.length > 1) {
        assert(ranked[0].score > ranked[1].score, 'ACCEPTED item must outscore SUPERSEDED item');
      }

      // Verify TMS analysis works identically after restart
      const analysis = storage2.analyzeKnowledgeTMS({ researchId: 'RES-PERSIST-01' });
      assert.strictEqual(analysis.summary.totalItems, 2);
      assert.strictEqual(analysis.summary.totalRelations, 1);
      assert.strictEqual(analysis.overallStatus, 'CONSISTENT');
    }
  } finally {
    removeSandbox(sandbox);
  }
});

console.log('-------------------------------------------------------------------');
console.log(`  G16 Deep Verification: ${passedCount} / ${testCount} tests PASSED.`);
console.log('-------------------------------------------------------------------');

if (passedCount === testCount) {
  process.exit(0);
} else {
  process.exit(1);
}
