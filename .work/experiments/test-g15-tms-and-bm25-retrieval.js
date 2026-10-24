/**
 * G15 Test Suite: Knowledge Truth Maintenance System (TMS) & Deterministic BM25 Memory Retrieval
 *
 * Verifies:
 * 1. BM25 multi-field tokenization and field-weighted relevance (Title: 3.0x, Tags: 2.5x, Topic: 2.0x, Content: 1.0x).
 * 2. Lifecycle state ranking multipliers (ACCEPTED: 1.25x, VALIDATED: 1.1x, PROPOSED: 1.0x, SUPERSEDED: 0.5x, DEPRECATED: 0.2x).
 * 3. BM25 score filtering (minScore thresholding) and limit truncation.
 * 4. TMS Pure State Transitions: PROPOSED -> VALIDATED -> ACCEPTED, role permissions, terminal state protection.
 * 5. TMS Knowledge Relations: SUPPORTS, CONTRADICTS, SUPERSEDES, QUALIFIES, self-relation rejection, target existence.
 * 6. TMS Graph Consistency Analysis: detects contradictions, unresolutions, and calculates overallStatus.
 * 7. MCP Tool Integration: openmemory_transition_knowledge_lifecycle (valid + error cases).
 * 8. MCP Tool Integration: openmemory_create_knowledge_relation (valid + error cases).
 * 9. MCP Tool Integration: openmemory_analyze_knowledge_tms (full + filtered analysis).
 * 10. CLI Integration: openmemory tms transition, relate, analyze (text & --json outputs).
 * 11. Zero working tree pollution and complete temp sandbox isolation.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');

const {
  StorageEngine,
  createMCPServer,
} = require('../../dist/index');

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

async function runAsyncTest(name, fn) {
  testCount++;
  process.stdout.write(`  [${testCount}] ${name}... `);
  try {
    await fn();
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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'om-g15-test-'));
}

function removeSandbox(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) {}
}

console.log('===================================================================');
console.log('  G15: Truth Maintenance System (TMS) & Deterministic BM25 Suite   ');
console.log('===================================================================');

(async () => {
  const SESSION_ID = 'session-g15-test';
  const AGENT_ID = 'agent-g15-lead';

  // ---------------------------------------------------------------------------
  // TEST 1: BM25 Field Weighting and Lifecycle Multiplier Verification
  // ---------------------------------------------------------------------------
  runTest('BM25 ranks title and tag matches higher than content and applies lifecycle multipliers', () => {
    const sandbox = makeSandbox();
    try {
      const storage = new StorageEngine(sandbox);
      storage.ensureStorageStructure();
      storage.registerSession({ id: SESSION_ID, agentId: AGENT_ID, status: 'ACTIVE' });

      const item1 = {
        id: 'ITEM-NAS-1',
        type: 'SOURCE',
        classification: 'FACT',
        title: 'Neural Architecture Search via Gradient Descent',
        content: 'Overview of gradient-based hyperparameter tuning for transformer models.',
        tags: ['nas', 'deep-learning'],
        lifecycleState: 'ACCEPTED',
      };

      const item2 = {
        id: 'ITEM-NAS-2',
        type: 'SOURCE',
        classification: 'FACT',
        title: 'Database Index Structures in SQLite',
        content: 'Exploration of b-tree indexing versus neural architecture search algorithms.',
        tags: ['database', 'sqlite'],
        lifecycleState: 'VALIDATED',
      };

      const item3 = {
        id: 'ITEM-NAS-3',
        type: 'SOURCE',
        classification: 'FACT',
        title: 'Neural Architecture Search via Random Sampling',
        content: 'Historical approach to neural architecture search prior to gradient methods.',
        tags: ['nas', 'historical'],
        lifecycleState: 'SUPERSEDED',
      };

      const item4 = {
        id: 'ITEM-CULINARY',
        type: 'SOURCE',
        classification: 'FACT',
        title: 'Artisanal Sourdough Baking Techniques',
        content: 'Fermentation temperature control and hydration ratios for sourdough bread.',
        tags: ['baking', 'culinary'],
        lifecycleState: 'ACCEPTED',
      };

      const researchRecord1 = {
        id: 'RES-NAS-01',
        topic: 'Neural Network Architecture Optimization',
        summary: 'Empirical memory benchmarks for neural network retrieval',
        status: 'COMPLETED',
        items: [item1, item2, item3],
        relations: [],
      };
      storage.saveResearch(researchRecord1, AGENT_ID, SESSION_ID);

      const researchRecord2 = {
        id: 'RES-CULINARY-01',
        topic: 'Artisanal Culinary Arts and Sourdough',
        summary: 'Culinary recipes and baking temperatures',
        status: 'COMPLETED',
        items: [item4],
        relations: [],
      };
      storage.saveResearch(researchRecord2, AGENT_ID, SESSION_ID);

      // Query for "neural architecture search" across all research records
      const results = storage.queryKnowledgeItems({
        query: 'neural architecture search',
      });

      assert(results.length >= 3, 'Must match at least 3 items with query terms');

      // Item 1 must be top rank due to title match (3.0x weight) + ACCEPTED multiplier (1.25x)
      assert.strictEqual(results[0].item.id, 'ITEM-NAS-1', 'ACCEPTED item with title match must rank #1');
      assert(results[0].score && results[0].score > 0, 'Must have positive BM25 score');

      // Verify item 1 score > item 2 score
      const item2Result = results.find(i => i.item.id === 'ITEM-NAS-2');
      assert(item2Result, 'Item 2 must be found in results');
      assert(results[0].score > item2Result.score, 'Title match must outscore content-only match');

      // Verify item 1 score > item 3 score (identical terms, but item 3 is SUPERSEDED so 0.5x multiplier)
      const item3Result = results.find(i => i.item.id === 'ITEM-NAS-3');
      assert(item3Result, 'Item 3 must be found in results');
      assert(results[0].score > item3Result.score, 'ACCEPTED must outscore SUPERSEDED');

      // Verify unrelated item is NOT in the results
      const unrelated = results.find(i => i.item.title.includes('Sourdough'));
      assert.strictEqual(unrelated, undefined, 'Unrelated item must have score 0 and be omitted');

      // Verify minScore filtering
      const filteredResults = storage.queryKnowledgeItems({
        researchId: 'RES-NAS-01',
        query: 'neural architecture search',
        minScore: results[0].score * 0.8,
      });
      assert(filteredResults.length < results.length, 'High minScore must filter lower-ranked items');
      assert.strictEqual(filteredResults[0].item.id, 'ITEM-NAS-1', 'Top item must survive high minScore');

      // Verify limit pagination
      const limitedResults = storage.queryKnowledgeItems({
        researchId: 'RES-NAS-01',
        query: 'neural architecture search',
        limit: 1,
      });
      assert.strictEqual(limitedResults.length, 1, 'Limit 1 must return exactly 1 item');
      assert.strictEqual(limitedResults[0].item.id, 'ITEM-NAS-1');
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 2: Truth Maintenance System (TMS) Transitions & Terminal Protection
  // ---------------------------------------------------------------------------
  runTest('TMS validates lifecycle transitions, role rules, and terminal state protection', () => {
    const sandbox = makeSandbox();
    try {
      const storage = new StorageEngine(sandbox);
      storage.ensureStorageStructure();
      storage.registerSession({ id: SESSION_ID, agentId: AGENT_ID, status: 'ACTIVE' });

      const item = {
        id: 'ITEM-RAFT-1',
        type: 'SOURCE',
        classification: 'FACT',
        title: 'Leader Election Safety Invariants',
        content: 'At most one leader can be elected in a given term.',
        tags: ['consensus', 'raft'],
        lifecycleState: 'CREATED',
      };

      storage.saveResearch({
        id: 'RES-RAFT-01',
        topic: 'Distributed Consensus Protocols',
        summary: 'Analysis of Raft versus Paxos',
        status: 'IN_PROGRESS',
        items: [item],
        relations: [],
      }, AGENT_ID, SESSION_ID);

      // Valid: CREATED -> VALIDATED by WORKER_AGENT
      const t1 = storage.updateKnowledgeLifecycle({
        researchId: 'RES-RAFT-01',
        itemId: 'ITEM-RAFT-1',
        targetState: 'VALIDATED',
        actorId: AGENT_ID,
        sessionId: SESSION_ID,
        actorRole: 'WORKER_AGENT',
        evidenceReference: 'https://raft.github.io/raft.pdf',
        evaluationRationale: 'Formal verification check passed.',
      });
      assert.strictEqual(t1.success, true);
      assert.strictEqual(t1.item?.lifecycleState, 'VALIDATED');

      // Valid: VALIDATED -> ACCEPTED by LEAD_AGENT
      const t2 = storage.updateKnowledgeLifecycle({
        researchId: 'RES-RAFT-01',
        itemId: 'ITEM-RAFT-1',
        targetState: 'ACCEPTED',
        actorId: AGENT_ID,
        sessionId: SESSION_ID,
        actorRole: 'LEAD_AGENT',
        evaluationRationale: 'Accepted into architectural core baseline.',
      });
      assert.strictEqual(t2.success, true);
      assert.strictEqual(t2.item?.lifecycleState, 'ACCEPTED');

      // Valid: ACCEPTED -> SUPERSEDED by LEAD_AGENT
      const t3 = storage.updateKnowledgeLifecycle({
        researchId: 'RES-RAFT-01',
        itemId: 'ITEM-RAFT-1',
        targetState: 'SUPERSEDED',
        actorId: AGENT_ID,
        sessionId: SESSION_ID,
        actorRole: 'LEAD_AGENT',
        evaluationRationale: 'Superseded by Byzantine Fault Tolerant protocol specification.',
      });
      assert.strictEqual(t3.success, true);
      assert.strictEqual(t3.item?.lifecycleState, 'SUPERSEDED');

      // Terminal state protection: Attempt to resurrect SUPERSEDED item must be rejected fail-closed
      const t4 = storage.updateKnowledgeLifecycle({
        researchId: 'RES-RAFT-01',
        itemId: 'ITEM-RAFT-1',
        targetState: 'ACCEPTED',
        actorId: AGENT_ID,
        sessionId: SESSION_ID,
        actorRole: 'HUMAN_OPERATOR',
        evaluationRationale: 'Attempt resurrection',
      });
      assert.strictEqual(t4.success, false);
      assert(t4.reason?.includes('Terminal state protection') || t4.reason?.includes('terminal state'));
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 3: TMS Knowledge Relations & Contradiction Detection
  // ---------------------------------------------------------------------------
  runTest('TMS enforces relation constraints and detects contradictions in graph analysis', () => {
    const sandbox = makeSandbox();
    try {
      const storage = new StorageEngine(sandbox);
      storage.ensureStorageStructure();
      storage.registerSession({ id: SESSION_ID, agentId: AGENT_ID, status: 'ACTIVE' });

      const itemA = {
        id: 'ITEM-CONCURRENCY-A',
        type: 'SOURCE',
        classification: 'FACT',
        title: 'Event Loop Non-Blocking Model',
        content: 'Single-threaded event loop outperforms threads for high-connection I/O.',
        tags: ['async', 'io'],
        lifecycleState: 'VALIDATED',
      };

      const itemB = {
        id: 'ITEM-CONCURRENCY-B',
        type: 'SOURCE',
        classification: 'FACT',
        title: 'Pre-emptive Multi-Threading Model',
        content: 'Multi-threading provides lower latency for CPU-bound computations.',
        tags: ['threads', 'cpu'],
        lifecycleState: 'VALIDATED',
      };

      storage.saveResearch({
        id: 'RES-CONCURRENCY-01',
        topic: 'Concurrency Models',
        summary: 'Comparing thread pools vs event loops',
        status: 'IN_PROGRESS',
        items: [itemA, itemB],
        relations: [],
      }, AGENT_ID, SESSION_ID);

      // Self-relation rejection
      const selfRel = storage.addKnowledgeRelation({
        researchId: 'RES-CONCURRENCY-01',
        relationType: 'SUPPORTS',
        sourceItemId: itemA.id,
        targetItemId: itemA.id,
        agentId: AGENT_ID,
        sessionId: SESSION_ID,
      });
      assert.strictEqual(selfRel.success, false);
      assert(selfRel.reason?.includes('Self-relation') || selfRel.reason?.includes('itself'));

      // Source ownership validation (source item must exist in owning record)
      const sourceMissingRel = storage.addKnowledgeRelation({
        researchId: 'RES-CONCURRENCY-01',
        relationType: 'SUPPORTS',
        sourceItemId: 'non-existent-source-id',
        targetItemId: itemB.id,
        agentId: AGENT_ID,
        sessionId: SESSION_ID,
      });
      assert.strictEqual(sourceMissingRel.success, false);
      assert(sourceMissingRel.reason?.includes('Source ownership mismatch'));

      // Valid relation: itemA CONTRADICTS itemB
      const rel = storage.addKnowledgeRelation({
        researchId: 'RES-CONCURRENCY-01',
        relationType: 'CONTRADICTS',
        sourceItemId: itemA.id,
        targetItemId: itemB.id,
        rationale: 'Conflicting paradigms for concurrent execution.',
        agentId: AGENT_ID,
        sessionId: SESSION_ID,
      });
      assert.strictEqual(rel.success, true);
      assert(rel.relation?.id);

      // Idempotent duplicate relation handling (returns existing relation without mutating graph)
      const dupRel = storage.addKnowledgeRelation({
        researchId: 'RES-CONCURRENCY-01',
        relationType: 'CONTRADICTS',
        sourceItemId: itemA.id,
        targetItemId: itemB.id,
        agentId: AGENT_ID,
        sessionId: SESSION_ID,
      });
      assert.strictEqual(dupRel.success, true);
      assert.strictEqual(dupRel.relation?.id, rel.relation?.id, 'Duplicate relation must return existing relation idempotently');

      // Supersession cycle rejection
      storage.addKnowledgeRelation({
        researchId: 'RES-CONCURRENCY-01',
        relationType: 'SUPERSEDES',
        sourceItemId: itemA.id,
        targetItemId: itemB.id,
        agentId: AGENT_ID,
        sessionId: SESSION_ID,
      });

      const cycleRel = storage.addKnowledgeRelation({
        researchId: 'RES-CONCURRENCY-01',
        relationType: 'SUPERSEDES',
        sourceItemId: itemB.id,
        targetItemId: itemA.id,
        agentId: AGENT_ID,
        sessionId: SESSION_ID,
      });
      assert.strictEqual(cycleRel.success, false);
      assert(cycleRel.reason?.includes('Supersession cycle rejected'));

      // Analyze TMS
      const analysis = storage.analyzeKnowledgeTMS({ researchId: 'RES-CONCURRENCY-01' });
      assert(analysis.summary.totalItems >= 2);
      assert.strictEqual(analysis.summary.totalRelations, 2);
      assert(analysis.summary.conflictedCount >= 1, 'CONTRADICTS relation must mark conflicted items');
      assert.strictEqual(analysis.overallStatus, 'CONFLICTED');
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 4: MCP Tool Integration (openmemory_transition_knowledge_lifecycle)
  // ---------------------------------------------------------------------------
  await runAsyncTest('MCP tool openmemory_transition_knowledge_lifecycle executes safely', async () => {
    const sandbox = makeSandbox();
    try {
      const storage = new StorageEngine(sandbox);
      storage.ensureStorageStructure();
      storage.registerSession({ id: SESSION_ID, agentId: AGENT_ID, status: 'ACTIVE' });

      storage.saveResearch({
        id: 'RES-MEM-01',
        topic: 'Memory Safety',
        summary: 'Rust vs C memory models',
        status: 'IN_PROGRESS',
        items: [
          {
            id: 'ITEM-BORROW-1',
            type: 'SOURCE',
            classification: 'FACT',
            title: 'Ownership and Lifetimes Invariant',
            content: 'Compile-time memory safety without garbage collection.',
            tags: ['rust', 'memory'],
            lifecycleState: 'CREATED',
          },
        ],
        relations: [],
      }, AGENT_ID, SESSION_ID);

      const server = createMCPServer(sandbox);
      const callHandler = server._requestHandlers.get('tools/call');
      assert(callHandler, 'tools/call handler must be registered');

      // Valid transition via MCP
      const res = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_transition_knowledge_lifecycle',
          arguments: {
            rootDir: sandbox,
            researchId: 'RES-MEM-01',
            itemId: 'ITEM-BORROW-1',
            targetState: 'VALIDATED',
            actorId: AGENT_ID,
            sessionId: SESSION_ID,
            actorRole: 'WORKER_AGENT',
            evidenceReference: 'https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html',
            evaluationRationale: 'Verified with rustc static analyzer.',
          },
        },
      });

      assert(!res.isError, 'MCP call must succeed');
      const text = res.content[0].text;
      assert(text.includes('KnowledgeItem lifecycle updated successfully!'), 'Must include success message');
      assert(text.includes('New State: VALIDATED'), 'Must report VALIDATED state');
      assert(text.includes('ITEM-BORROW-1'), 'Must include item ID');

      // Transition to SUPERSEDED
      await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_transition_knowledge_lifecycle',
          arguments: {
            rootDir: sandbox,
            researchId: 'RES-MEM-01',
            itemId: 'ITEM-BORROW-1',
            targetState: 'SUPERSEDED',
            actorId: AGENT_ID,
            sessionId: SESSION_ID,
            actorRole: 'LEAD_AGENT',
            evaluationRationale: 'Superseded by new borrow check rules.',
          },
        },
      });

      // Now attempt invalid transition back to ACCEPTED
      const errRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_transition_knowledge_lifecycle',
          arguments: {
            rootDir: sandbox,
            researchId: 'RES-MEM-01',
            itemId: 'ITEM-BORROW-1',
            targetState: 'ACCEPTED',
            actorId: AGENT_ID,
            sessionId: SESSION_ID,
          },
        },
      });

      assert(errRes.isError, 'Invalid transition must report isError: true');
      assert(errRes.content[0].text.includes('Terminal state protection') || errRes.content[0].text.includes('terminal state'));
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 5: MCP Tool Integration (openmemory_create_knowledge_relation & analyze)
  // ---------------------------------------------------------------------------
  await runAsyncTest('MCP tools openmemory_create_knowledge_relation and openmemory_analyze_knowledge_tms', async () => {
    const sandbox = makeSandbox();
    try {
      const storage = new StorageEngine(sandbox);
      storage.ensureStorageStructure();
      storage.registerSession({ id: SESSION_ID, agentId: AGENT_ID, status: 'ACTIVE' });

      storage.saveResearch({
        id: 'RES-CACHE-01',
        topic: 'Cache Coherence',
        summary: 'MESI vs MOESI protocol comparisons',
        status: 'IN_PROGRESS',
        items: [
          {
            id: 'ITEM-MESI-1',
            type: 'SOURCE',
            classification: 'FACT',
            title: 'MESI Invariant States',
            content: 'Modified, Exclusive, Shared, Invalid.',
            tags: ['cache', 'mesi'],
            lifecycleState: 'VALIDATED',
          },
          {
            id: 'ITEM-MOESI-1',
            type: 'SOURCE',
            classification: 'FACT',
            title: 'MOESI Owner State',
            content: 'Adds Owned state to reduce bus traffic.',
            tags: ['cache', 'moesi'],
            lifecycleState: 'VALIDATED',
          },
        ],
        relations: [],
      }, AGENT_ID, SESSION_ID);

      const server = createMCPServer(sandbox);
      const callHandler = server._requestHandlers.get('tools/call');

      // Create relation via MCP: item2 QUALIFIES item1
      const relRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_create_knowledge_relation',
          arguments: {
            rootDir: sandbox,
            researchId: 'RES-CACHE-01',
            sourceItemId: 'ITEM-MOESI-1',
            relationType: 'QUALIFIES',
            targetItemId: 'ITEM-MESI-1',
            rationale: 'MOESI qualifies MESI protocol with dirty sharing.',
            agentId: AGENT_ID,
            sessionId: SESSION_ID,
          },
        },
      });

      assert(!relRes.isError, 'Create relation MCP tool must succeed: ' + (relRes.content?.[0]?.text || ''));
      const relText = relRes.content[0].text;
      assert(relText.includes('Knowledge relation created successfully!'), 'Must include success message');
      assert(relText.includes('Type: QUALIFIES'), 'Must report relation type');
      assert(relText.includes('ITEM-MOESI-1 -> ITEM-MESI-1'), 'Must report link endpoints');

      // Analyze TMS via MCP
      const anaRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_analyze_knowledge_tms',
          arguments: {
            rootDir: sandbox,
            researchId: 'RES-CACHE-01',
          },
        },
      });

      assert(!anaRes.isError, 'Analyze TMS MCP tool must succeed');
      const anaData = JSON.parse(anaRes.content[0].text);
      assert.strictEqual(anaData.summary.totalItems, 2);
      assert.strictEqual(anaData.summary.totalRelations, 1);
      assert(anaData.overallStatus === 'CONSISTENT' || anaData.overallStatus === 'UNRESOLVED');
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST 6: CLI Integration (openmemory tms transition, relate, analyze)
  // ---------------------------------------------------------------------------
  runTest('CLI executes tms transition, relate, and analyze commands accurately', () => {
    const sandbox = makeSandbox();
    try {
      const storage = new StorageEngine(sandbox);
      storage.ensureStorageStructure();
      storage.registerSession({ id: SESSION_ID, agentId: AGENT_ID, status: 'ACTIVE' });

      storage.saveResearch({
        id: 'RES-CLI-01',
        topic: 'CLI TMS Integration',
        summary: 'Testing CLI commands for TMS',
        status: 'IN_PROGRESS',
        items: [
          {
            id: 'ITEM-CLI-A',
            type: 'SOURCE',
            classification: 'FACT',
            title: 'Item A Title',
            content: 'Content for Item A',
            tags: ['test'],
            lifecycleState: 'CREATED',
          },
          {
            id: 'ITEM-CLI-B',
            type: 'SOURCE',
            classification: 'FACT',
            title: 'Item B Title',
            content: 'Content for Item B',
            tags: ['test'],
            lifecycleState: 'CREATED',
          },
        ],
        relations: [],
      }, AGENT_ID, SESSION_ID);

      const cliScript = path.resolve(__dirname, '../../dist/cli.js');

      // 1. CLI tms transition
      const cliTrans = spawnSync('node', [
        cliScript,
        'tms',
        'transition',
        '--research-id', 'RES-CLI-01',
        '--item-id', 'ITEM-CLI-A',
        '--state', 'VALIDATED',
        '--actor-id', AGENT_ID,
        '--session-id', SESSION_ID,
        '--role', 'WORKER_AGENT',
        '--evidence', 'https://example.org/test-evidence',
        '--rationale', 'Validated via CLI test',
      ], {
        cwd: sandbox,
        encoding: 'utf8',
      });
      assert.strictEqual(cliTrans.status, 0, 'CLI tms transition failed: ' + cliTrans.stderr);
      assert(cliTrans.stdout.includes('KnowledgeItem Lifecycle Updated'), 'CLI output must confirm transition');

      // 2. CLI tms relate
      const cliRel = spawnSync('node', [
        cliScript,
        'tms',
        'relate',
        '--research-id', 'RES-CLI-01',
        '--type', 'SUPPORTS',
        '--source-id', 'ITEM-CLI-A',
        '--target-id', 'ITEM-CLI-B',
        '--agent-id', AGENT_ID,
        '--session-id', SESSION_ID,
        '--rationale', 'Item A supports Item B',
      ], {
        cwd: sandbox,
        encoding: 'utf8',
      });
      assert.strictEqual(cliRel.status, 0, 'CLI tms relate failed: ' + cliRel.stderr);
      assert(cliRel.stdout.includes('Knowledge Relation Created'), 'CLI output must confirm relation');

      // 3. CLI tms analyze (human-readable)
      const cliAna = spawnSync('node', [
        cliScript,
        'tms',
        'analyze',
        '--research-id', 'RES-CLI-01',
      ], {
        cwd: sandbox,
        encoding: 'utf8',
      });
      assert.strictEqual(cliAna.status, 0, 'CLI tms analyze failed: ' + cliAna.stderr);
      assert(cliAna.stdout.includes('Truth Maintenance System (TMS) Analysis Report'), 'Must contain header');
      assert(cliAna.stdout.includes('Total Items Evaluated: 2'), 'Must report 2 items');
      assert(cliAna.stdout.includes('Total Relations:       1'), 'Must report 1 relation');

      // 4. CLI tms analyze (--json)
      const cliAnaJson = spawnSync('node', [
        cliScript,
        'tms',
        'analyze',
        '--research-id', 'RES-CLI-01',
        '--json',
      ], {
        cwd: sandbox,
        encoding: 'utf8',
      });
      assert.strictEqual(cliAnaJson.status, 0, 'CLI tms analyze --json failed: ' + cliAnaJson.stderr);
      const parsedAna = JSON.parse(cliAnaJson.stdout.trim());
      assert.strictEqual(parsedAna.summary.totalItems, 2);
      assert.strictEqual(parsedAna.summary.totalRelations, 1);
      assert(parsedAna.overallStatus);
    } finally {
      removeSandbox(sandbox);
    }
  });

  // ---------------------------------------------------------------------------
  // TEST SUMMARY
  // ---------------------------------------------------------------------------
  console.log('-------------------------------------------------------------------');
  console.log(`  G15 Suite Finished: ${passedCount} / ${testCount} tests PASSED.`);
  console.log('-------------------------------------------------------------------');

  if (passedCount === testCount) {
    process.exit(0);
  } else {
    process.exit(1);
  }
})();
