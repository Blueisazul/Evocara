/**
 * G25: Curated MCP Surface, Project Boundary Isolation & Administrative CLI Verification
 *
 * Validates Bloque B & Bloque C criteria:
 * 1. Default MCP server profile exposes exactly 8 curated tools matching capability groups.
 * 2. Full profile exposes all 42 tools for backward compatibility and administrative agents.
 * 3. Execution of openmemory_get_adr (listing and specific ADR retrieval).
 * 4. Execution of openmemory_update_handoff (atomic narrative update with session auth).
 * 5. Project isolation: cross-project queries are rejected fail-closed with security error.
 * 6. Calibrated BM25 + TMS retrieval via MCP (unanswerable queries yield K=0).
 * 7. Administrative operations remain fully available and verified via CLI.
 * 8. Legacy administrative tool calls remain callable via CallTool handler.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const projectRoot = path.resolve(__dirname, '../..');
const {
  StorageEngine,
  createMCPServer,
  createCuratedMCPServer,
  CURATED_MCP_TOOLS,
  CURATED_MCP_TOOL_NAMES,
  runCLI,
} = require(path.join(projectRoot, 'dist', 'index.js'));

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(`         Error: ${err.message}`);
    throw err;
  }
}

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(`         Error: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('======================================================');
  console.log('G25: Curated MCP Surface & Project Isolation Suite');
  console.log('======================================================\n');

  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'om-mcp-curated-test-'));

  try {
    // -------------------------------------------------------------------------
    // Test 1: Curated Profile Tool Count and Group Mapping
    // -------------------------------------------------------------------------
    await testAsync('Curated profile exposes exactly 8 essential memory tools', async () => {
      const server = createMCPServer(testDir);
      const listHandler = server._requestHandlers.get('tools/list');
      assert(typeof listHandler === 'function', 'ListTools handler must be registered');

      const res = await listHandler({ method: 'tools/list', params: {} });
      assert(Array.isArray(res.tools), 'tools must be an array');
      assert.strictEqual(res.tools.length, 8, `Curated profile must have 8 tools, got ${res.tools.length}`);

      const names = res.tools.map((t) => t.name).sort();
      const expected = [
        'openmemory_analyze_knowledge_tms',
        'openmemory_get_adr',
        'openmemory_get_handoff',
        'openmemory_query_knowledge',
        'openmemory_record_knowledge',
        'openmemory_save_adr',
        'openmemory_status',
        'openmemory_update_handoff',
      ].sort();

      assert.deepStrictEqual(names, expected, 'Curated tools list does not match expected 8 essential tools');
    });

    // -------------------------------------------------------------------------
    // Test 2: createCuratedMCPServer factory helper
    // -------------------------------------------------------------------------
    await testAsync('createCuratedMCPServer factory produces 8 curated tools', async () => {
      const server = createCuratedMCPServer(testDir);
      const listHandler = server._requestHandlers.get('tools/list');
      const res = await listHandler({ method: 'tools/list', params: {} });
      assert.strictEqual(res.tools.length, 8, 'Factory must return exactly 8 tools');
    });

    // -------------------------------------------------------------------------
    // Test 3: Full Profile Tool Count (All 42 Tools)
    // -------------------------------------------------------------------------
    await testAsync('Full profile exposes all 42 tools for legacy/admin compatibility', async () => {
      const server = createMCPServer(testDir, { profile: 'full' });
      const listHandler = server._requestHandlers.get('tools/list');
      const res = await listHandler({ method: 'tools/list', params: {} });
      assert.strictEqual(res.tools.length, 42, `Full profile must have 42 tools, got ${res.tools.length}`);

      const toolNames = res.tools.map((t) => t.name);
      assert(toolNames.includes('openmemory_health_summary'), 'Missing health_summary in full tools');
      assert(toolNames.includes('openmemory_inspect_locks'), 'Missing inspect_locks in full tools');
      assert(toolNames.includes('openmemory_get_stage'), 'Missing get_stage in full tools');
      assert(toolNames.includes('openmemory_get_adr'), 'Missing get_adr in full tools');
      assert(toolNames.includes('openmemory_update_handoff'), 'Missing update_handoff in full tools');
    });

    // -------------------------------------------------------------------------
    // Test 4: openmemory_save_adr and openmemory_get_adr Execution
    // -------------------------------------------------------------------------
    await testAsync('openmemory_save_adr and openmemory_get_adr execution via MCP', async () => {
      const server = createMCPServer(testDir);
      const callHandler = server._requestHandlers.get('tools/call');
      const storage = new StorageEngine(testDir);

      // Register session for authorization
      const session = storage.registerSession({ agentId: 'test-agent', id: 'mcp-session-001', purpose: 'testing adr' });

      // 1. List ADRs when none exist
      const listEmptyRes = await callHandler({
        method: 'tools/call',
        params: { name: 'openmemory_get_adr', arguments: {} },
      });
      assert(listEmptyRes.content[0].text.includes('No Architectural Decision Records registered'));

      // 2. Save an ADR
      const saveRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_save_adr',
          arguments: {
            title: 'Use Local BM25 Engine with Sub-word Spanish Stemming',
            status: 'PROPOSED',
            date: '2026-10-21',
            context: 'Deterministic search requires zero-cloud multilingual ranking.',
            decision: 'Deploy pure TypeScript BM25Engine with rule-based Spanish and Porter stemming.',
            consequences: 'Zero remote API latency, 100% offline predictability.',
            agentId: 'test-agent',
            sessionId: session.id,
          },
        },
      });
      assert(!saveRes.isError, `save_adr returned error: ${JSON.stringify(saveRes)}`);
      assert(saveRes.content[0].text.includes('ADR-001'));

      // 3. Retrieve specific ADR
      const getRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_get_adr',
          arguments: { adrId: 'ADR-001' },
        },
      });
      assert(getRes.content[0].text.includes('# ADR-001: Use Local BM25 Engine'));
      assert(getRes.content[0].text.includes('Deploy pure TypeScript BM25Engine'));

      // 4. List ADRs now that one exists
      const listRes = await callHandler({
        method: 'tools/call',
        params: { name: 'openmemory_get_adr', arguments: {} },
      });
      assert(listRes.content[0].text.includes('ADR-001'));
      assert(listRes.content[0].text.includes('Use Local BM25 Engine'));
    });

    // -------------------------------------------------------------------------
    // Test 5: openmemory_update_handoff and openmemory_get_handoff Execution
    // -------------------------------------------------------------------------
    await testAsync('openmemory_update_handoff and openmemory_get_handoff execution via MCP', async () => {
      const server = createMCPServer(testDir);
      const callHandler = server._requestHandlers.get('tools/call');

      // 1. Get initial handoff
      const getRes1 = await callHandler({
        method: 'tools/call',
        params: { name: 'openmemory_get_handoff', arguments: {} },
      });
      assert(getRes1.content[0].text.includes('Current Phase:'));

      // 2. Update handoff narrative
      const updateRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_update_handoff',
          arguments: {
            activeGoal: 'Complete Milestone G25 Certification',
            activePhase: 'Phase 4.1 Production Release Rehearsal',
            progressSummary: [
              'Extended OpenCode session certified (>40 interactions, 1MB compaction).',
              'Modularized BM25Engine into src/storage/retrieval/bm25.ts.',
              'Calibrated BM25 threshold to guarantee K=0 on unanswerable queries.',
            ],
            nextSteps: [
              'Deploy curated 8-tool MCP surface.',
              'Rehearse controlled promotion of InventoryHub in isolated sandbox.',
            ],
            agentId: 'test-agent',
            sessionId: 'mcp-session-001',
          },
        },
      });
      assert(!updateRes.isError, `update_handoff error: ${JSON.stringify(updateRes)}`);
      assert(updateRes.content[0].text.includes('Handoff updated successfully'));

      // 3. Verify get_handoff reflects update
      const getRes2 = await callHandler({
        method: 'tools/call',
        params: { name: 'openmemory_get_handoff', arguments: {} },
      });
      assert(getRes2.content[0].text.includes('Complete Milestone G25 Certification'));
      assert(getRes2.content[0].text.includes('Phase 4.1 Production Release Rehearsal'));
      assert(getRes2.content[0].text.includes('Modularized BM25Engine'));
    });

    // -------------------------------------------------------------------------
    // Test 6: Project Isolation Boundary Validation
    // -------------------------------------------------------------------------
    await testAsync('Project boundary isolation rejects cross-project queries', async () => {
      const server = createMCPServer(testDir);
      const callHandler = server._requestHandlers.get('tools/call');
      const storage = new StorageEngine(testDir);

      const boundProject = storage.deriveProjectName();

      // 1. Legitimate query matching bound project
      const legitRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_query_knowledge',
          arguments: {
            query: 'architecture',
            projectId: boundProject,
          },
        },
      });
      assert(!legitRes.isError, 'Legitimate query should not return isError');

      // 2. Cross-project query requesting different project ID
      const spoofedRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_query_knowledge',
          arguments: {
            query: 'architecture',
            projectId: 'unauthorized-external-project',
          },
        },
      });
      assert(spoofedRes.isError === true, 'Cross-project query MUST return isError: true');
      assert(
        spoofedRes.content[0].text.includes('[OpenMemory MCP Security] Access denied: cross-project query rejected'),
        'Must include explicit access denied message'
      );
      assert(spoofedRes.content[0].text.includes('unauthorized-external-project'));
    });

    // -------------------------------------------------------------------------
    // Test 7: Calibrated BM25 + TMS via MCP (K=0 on Unanswerable)
    // -------------------------------------------------------------------------
    await testAsync('Calibrated retrieval returns K=0 for unanswerable queries via MCP', async () => {
      const server = createMCPServer(testDir);
      const callHandler = server._requestHandlers.get('tools/call');

      // Record a specific domain fact
      await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_record_knowledge',
          arguments: {
            topic: 'Warehouse Inventory Protocol',
            summary: 'Inventory item reorder points and safety stock levels.',
            agentId: 'test-agent',
            sessionId: 'mcp-session-001',
            items: [
              {
                title: 'Reorder Safety Stock Level',
                type: 'FINDING',
                classification: 'FACT',
                content: 'Safety stock level is set to 25 units for primary inventory SKU.',
                tags: ['warehouse', 'inventory', 'sku'],
              },
            ],
          },
        },
      });

      // 1. Relevant query -> finds it
      const matchRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_query_knowledge',
          arguments: { query: 'warehouse inventory safety stock' },
        },
      });
      assert(!matchRes.isError);
      assert(matchRes.content[0].text.includes('Reorder Safety Stock Level'));

      // 2. Completely unrelated/unanswerable query -> K=0
      const unansRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_query_knowledge',
          arguments: { query: 'quantum cryptography entangled photons' },
        },
      });
      assert(!unansRes.isError);
      assert(unansRes.content[0].text.includes('No matching research knowledge records found.'));
    });

    // -------------------------------------------------------------------------
    // Test 8: Legacy Administrative Tools Remain Callable in MCP
    // -------------------------------------------------------------------------
    await testAsync('Legacy administrative tools remain callable via CallTool', async () => {
      const server = createMCPServer(testDir); // curated profile
      const callHandler = server._requestHandlers.get('tools/call');

      // 1. Call openmemory_health_summary
      const healthRes = await callHandler({
        method: 'tools/call',
        params: { name: 'openmemory_health_summary', arguments: {} },
      });
      assert(!healthRes.isError);
      const healthData = JSON.parse(healthRes.content[0].text);
      assert(healthData.overallStatus !== undefined);

      // 2. Call openmemory_inspect_locks
      const locksRes = await callHandler({
        method: 'tools/call',
        params: { name: 'openmemory_inspect_locks', arguments: {} },
      });
      assert(!locksRes.isError);

      // 3. Call openmemory_get_event_retention_policy
      const policyRes = await callHandler({
        method: 'tools/call',
        params: { name: 'openmemory_get_event_retention_policy', arguments: {} },
      });
      assert(!policyRes.isError);
      assert(policyRes.content[0].text.includes('maxSizeBytes'));
    });

    // -------------------------------------------------------------------------
    // Test 9: Administrative CLI Commands Functionality
    // -------------------------------------------------------------------------
    await testAsync('Administrative operations execute successfully via CLI', async () => {
      // 1. status CLI command
      const statusOut = await runCLI(['status'], testDir);
      assert(statusOut.includes('Project Context Summary'));

      // 2. health CLI command
      const healthOut = await runCLI(['health'], testDir);
      assert(healthOut.includes('Consolidated Health Status:'));

      // 3. cleanup CLI command (locks and stale state)
      const cleanupOut = await runCLI(['cleanup'], testDir);
      assert(cleanupOut.includes('cleanup complete'));

      // 4. locks cleanup CLI command
      const locksOut = await runCLI(['locks', 'cleanup'], testDir);
      assert(locksOut.includes('Advisory Locks Cleanup:'));

      // 4. adr list CLI command
      const adrOut = await runCLI(['adr'], testDir);
      assert(adrOut.includes('ADR-001'));

      // 5. logs policy CLI command
      const logsOut = await runCLI(['logs', 'policy'], testDir);
      assert(logsOut.includes('maxSizeBytes'));
    });

    console.log('\n======================================================');
    console.log(`ALL ${passedTests} / ${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log('======================================================');
  } finally {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

main().catch((err) => {
  console.error('\nFatal test failure:', err);
  process.exit(1);
});
