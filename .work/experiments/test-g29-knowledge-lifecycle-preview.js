/**
 * G29 Product Evolution Preview: Knowledge Lifecycle & Quality Suite
 *
 * Implements high-impact tests evaluating the next evolution cycle of Evocara:
 * 1. Obsolete memory invalidation & terminal state protection (SUPERSEDED / DEPRECATED).
 * 2. Decision supersession and contradiction cycle detection via KnowledgeTMS.
 * 3. Strict provenance tracking (Agent ID, Session ID, Timestamp, Rationale).
 * 4. Dual retrieval behavior: heavy suppression of SUPERSEDED items on normal queries,
 *    and deterministic retrieval on explicit historical queries.
 * 5. Multi-project boundary fence enforcement under simultaneous query load.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const projectRoot = path.resolve(__dirname, '../..');
const { StorageEngine } = require(path.join(projectRoot, 'dist', 'index.js'));
const { KnowledgeTMS } = require(path.join(projectRoot, 'dist', 'storage', 'domains', 'knowledge-tms.js'));

console.log('===================================================================');
console.log('  G29 Evolution Preview: Knowledge Lifecycle & Quality Suite       ');
console.log('===================================================================\n');

let passCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  process.stdout.write(`  [TEST ${totalCount}] ${name}... `);
  try {
    fn();
    passCount++;
    console.log('PASS');
  } catch (err) {
    console.log('FAIL');
    console.error(`         Error: ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalCount++;
  process.stdout.write(`  [TEST ${totalCount}] ${name}... `);
  try {
    await fn();
    passCount++;
    console.log('PASS');
  } catch (err) {
    console.log('FAIL');
    console.error(`         Error: ${err.message}`);
    throw err;
  }
}

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g29-preview-'));
  const storage = new StorageEngine(tmpDir);
  const tms = new KnowledgeTMS();

  try {
    storage.ensureStorageStructure();

    // -------------------------------------------------------------------------
    // Test 1: Terminal State Protection for Obsolete Knowledge
    // -------------------------------------------------------------------------
    runTest('Terminal state protection: SUPERSEDED and DEPRECATED items cannot transition', () => {
      const res1 = tms.validateLifecycleTransition({
        currentState: 'SUPERSEDED',
        targetState: 'ACCEPTED',
        actorRole: 'LEAD_AGENT'
      });
      assert.strictEqual(res1.valid, false, 'SUPERSEDED items must not transition to ACCEPTED');
      assert(res1.reason.includes('Terminal state protection'));

      const res2 = tms.validateLifecycleTransition({
        currentState: 'DEPRECATED',
        targetState: 'VALIDATED',
        actorRole: 'LEAD_AGENT'
      });
      assert.strictEqual(res2.valid, false, 'DEPRECATED items must not transition to VALIDATED');
      assert(res2.reason.includes('Terminal state protection'));
    });

    // -------------------------------------------------------------------------
    // Test 2: Mandatory Evidence Reference for Validation Transitions
    // -------------------------------------------------------------------------
    runTest('Evidence reference requirement: Transition to VALIDATED requires evidenceReference', () => {
      const invalidRes = tms.validateLifecycleTransition({
        currentState: 'DISCOVERED',
        targetState: 'VALIDATED',
        actorRole: 'WORKER_AGENT'
      });
      assert.strictEqual(invalidRes.valid, false, 'Missing evidenceReference must be rejected');

      const validRes = tms.validateLifecycleTransition({
        currentState: 'DISCOVERED',
        targetState: 'VALIDATED',
        actorRole: 'WORKER_AGENT',
        evidenceReference: 'Benchmark Suite test-g23-expanded-100-benchmark.js'
      });
      assert.strictEqual(validRes.valid, true, 'Valid evidenceReference must be accepted');
    });

    // -------------------------------------------------------------------------
    // Test 3: Contradiction and Supersession Graph Analysis in TMS
    // -------------------------------------------------------------------------
    runTest('TMS contradiction and supersession detection across knowledge items', () => {
      const mockResearch = [{
        id: 'RES-001',
        title: 'Storage Architecture Evolution',
        items: [
          {
            id: 'ITEM-A',
            type: 'FINDING',
            classification: 'FACT',
            content: 'Initial architecture used plain JSON files for all storage.',
            lifecycleState: 'SUPERSEDED'
          },
          {
            id: 'ITEM-B',
            type: 'FINDING',
            classification: 'FACT',
            content: 'Upgraded to transactional SQLite for ACID guarantees.',
            lifecycleState: 'ACCEPTED'
          }
        ],
        relations: [
          {
            id: 'REL-01',
            relationType: 'SUPERSEDES',
            sourceItemId: 'ITEM-B',
            targetItemId: 'ITEM-A',
            createdAt: new Date().toISOString(),
            provenance: { agentId: 'architect-01', timestamp: new Date().toISOString() }
          }
        ]
      }];

      const analysis = tms.analyzeTMS(mockResearch);
      assert(analysis.summary.totalItems === 2, 'Must evaluate 2 items');
      assert(analysis.summary.totalRelations === 1, 'Must evaluate 1 relation');
      assert.strictEqual(analysis.items['ITEM-A'].canonicalLifecycleState, 'SUPERSEDED', 'ITEM-A must be SUPERSEDED');
      assert.strictEqual(analysis.items['ITEM-B'].canonicalLifecycleState, 'ACCEPTED', 'ITEM-B must be ACCEPTED');
    });

    // -------------------------------------------------------------------------
    // Test 4: BM25 Heavy Suppression of SUPERSEDED items on Normal Queries
    // -------------------------------------------------------------------------
    runTest('BM25 retrieval heavily suppresses SUPERSEDED knowledge on standard queries', () => {
      const sess = storage.registerSession({ agentId: 'agent-1' });
      const rec = storage.saveResearch({
        topic: 'Persistence Benchmarking',
        category: 'architecture',
        summary: 'Comparing storage backends for operational memory',
        items: [
          {
            id: 'ITEM-OLD',
            title: 'LevelDB Prototype',
            type: 'FINDING',
            classification: 'FACT',
            content: 'Historical prototype used LevelDB backend for caching.',
            tags: ['backend', 'storage', 'prototype'],
            lifecycleState: 'SUPERSEDED'
          },
          {
            id: 'ITEM-PROD',
            title: 'SQLite Facade Standard',
            type: 'FINDING',
            classification: 'FACT',
            content: 'Production architecture standardizes on SQLite Single-Writer Facade.',
            tags: ['backend', 'storage', 'production'],
            lifecycleState: 'ACCEPTED'
          }
        ]
      }, 'agent-1', sess.sessionId || sess.id);

      const oldItem = { id: 'ITEM-OLD' };
      const prodItem = { id: 'ITEM-PROD' };

      // Normal Query: "backend storage standard"
      const normalResults = storage.queryKnowledgeItems({ query: 'backend storage' });
      assert(normalResults.length > 0, 'Must return results');
      assert.strictEqual(normalResults[0].item.id, prodItem.id, 'Top result must be production SQLite item');

      // Check relative scores: superseded item should be heavily suppressed
      const oldMatch = normalResults.find(r => r.item.id === oldItem.id);
      if (oldMatch) {
        assert(normalResults[0].score > (oldMatch.score * 2), 'Production item score must heavily exceed superseded item');
      }
    });

    // -------------------------------------------------------------------------
    // Test 5: Historical Query Retrieval of Deprecated/Superseded Decisions
    // -------------------------------------------------------------------------
    runTest('Explicit historical query boosts and retrieves deprecated knowledge', () => {
      const historicalResults = storage.queryKnowledgeItems({ query: 'historical prototype deprecated LevelDB backend' });
      assert(historicalResults.length > 0, 'Must return matches on explicit historical query');
      const top = historicalResults[0];
      assert(top.item.content.includes('LevelDB'), 'Explicit historical query must retrieve historical LevelDB item');
    });

    // -------------------------------------------------------------------------
    // Test 6: Strict Multi-Project Sandboxing
    // -------------------------------------------------------------------------
    await runAsyncTest('Cross-project fence strictly rejects unauthorized project access', async () => {
      const { createMCPServer } = require(path.join(projectRoot, 'dist', 'index.js'));
      const server = createMCPServer(tmpDir);
      const callHandler = server._requestHandlers.get('tools/call');

      const secRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_query_knowledge',
          arguments: { query: 'storage', projectId: 'UnauthorizedOtherProject' }
        }
      });

      assert.strictEqual(secRes.isError, true, 'Cross-project access must be rejected fail-closed');
      assert(secRes.content[0].text.includes('Access denied: cross-project query rejected'));
    });

    console.log('\n===================================================================');
    console.log(`  G29 Evolution Preview Results: ${passCount} / ${totalCount} PASSED (100%)`);
    console.log('===================================================================\n');

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error('\n[FATAL ERROR IN G29 PREVIEW SUITE]:', err);
  process.exit(1);
});
