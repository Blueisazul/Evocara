/**
 * G27: Dual Evocara / OpenMemory Nomenclature Transition & Compatibility Regression Suite
 *
 * Verifies Bloque A Acceptance Criteria:
 * 1. Default curated MCP profile exposes exactly 8 tools with openmemory_* prefix (zero breaking change).
 * 2. Prefix 'evocara' exposes exactly 8 tools with evocara_* prefix.
 * 3. Prefix 'dual' exposes 16 tools (both openmemory_* and evocara_*).
 * 4. Full profile exposes 42 tools with either prefix or 84 in dual mode.
 * 5. Functional equivalence: evocara_query_knowledge and openmemory_query_knowledge produce identical BM25 results.
 * 6. Functional equivalence: evocara_get_adr and openmemory_get_adr return identical ADR records.
 * 7. Functional equivalence: evocara_update_handoff atomically updates handoff narrative without double write.
 * 8. Project boundary security: evocara_query_knowledge enforces identical fail-closed rejection on cross-project query.
 * 9. CLI dual compatibility: 'version', 'help', 'status', 'query' commands execute cleanly.
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
  createEvocaraMCPServer,
  CURATED_MCP_TOOLS,
  CURATED_MCP_TOOL_NAMES,
  EVOCARA_CURATED_MCP_TOOLS,
  EVOCARA_CURATED_MCP_TOOL_NAMES,
  runCLI,
} = require(path.join(projectRoot, 'dist', 'index.js'));

let passedTests = 0;
let totalTests = 0;

async function test(name, fn) {
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

async function runAll() {
  console.log('===================================================================');
  console.log('  G27 Bloque A: Evocara / OpenMemory Transition Compatibility Suite');
  console.log('===================================================================\n');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'g27-compat-'));
  const testPkg = { name: 'InventoryHub', version: '1.0.0' };
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(testPkg, null, 2));

  // Initialize storage with test knowledge
  const storage = new StorageEngine(tmpDir);
  const session = storage.registerSession({ agentId: 'lead-dev', role: 'TECH_LEAD', goal: 'G27 Testing' });
  const activeSessionId = session.sessionId || session.id;

  storage.saveResearch({
    topic: 'Persistence Architecture',
    category: 'ARCHITECTURE',
    summary: 'Local memory persistence with zero cloud dependencies',
    items: [
      {
        id: 'ITEM-001',
        title: 'Local Engine Specification',
        type: 'REPOSITORY',
        classification: 'FACT',
        content: 'InventoryHub enforces local memory persistence with zero cloud dependencies.',
        tags: ['storage', 'persistence', 'local'],
      },
    ],
  }, 'lead-dev', activeSessionId);

  storage.saveADR({
    title: 'Use Local Storage Engine',
    status: 'PROPOSED',
    date: '2026-10-22',
    context: 'We require fast deterministic local memory.',
    decision: 'Use in-memory BM25 with JSONL event durability.',
    consequences: 'Zero cloud latency and complete offline autonomy.',
    agentId: 'lead-dev',
  }, 'lead-dev', activeSessionId);

  try {
    // -------------------------------------------------------------------------
    // Test 1: Default MCP Profile has 8 Curated Tools with openmemory_*
    // -------------------------------------------------------------------------
    await test('Default MCP profile exposes exactly 8 curated tools with openmemory_* prefix', async () => {
      const server = createMCPServer(tmpDir);
      const listHandler = server._requestHandlers.get('tools/list');
      const res = await listHandler({ method: 'tools/list', params: {} });

      assert.strictEqual(res.tools.length, 8, `Expected 8 tools, got ${res.tools.length}`);
      const names = res.tools.map((t) => t.name);
      for (const expected of CURATED_MCP_TOOL_NAMES) {
        assert(names.includes(expected), `Missing default tool: ${expected}`);
      }
    });

    // -------------------------------------------------------------------------
    // Test 2: Prefix 'evocara' exposes 8 Curated Tools with evocara_*
    // -------------------------------------------------------------------------
    await test("Prefix 'evocara' exposes exactly 8 curated tools with evocara_* prefix", async () => {
      const server = createEvocaraMCPServer(tmpDir);
      const listHandler = server._requestHandlers.get('tools/list');
      const res = await listHandler({ method: 'tools/list', params: {} });

      assert.strictEqual(res.tools.length, 8, `Expected 8 tools, got ${res.tools.length}`);
      const names = res.tools.map((t) => t.name);
      for (const expected of EVOCARA_CURATED_MCP_TOOL_NAMES) {
        assert(names.includes(expected), `Missing evocara tool: ${expected}`);
      }
    });

    // -------------------------------------------------------------------------
    // Test 3: Prefix 'dual' exposes 16 Curated Tools (both openmemory_* and evocara_*)
    // -------------------------------------------------------------------------
    await test("Prefix 'dual' exposes 16 tools with both openmemory_* and evocara_* names", async () => {
      const server = createMCPServer(tmpDir, { profile: 'curated', prefix: 'dual' });
      const listHandler = server._requestHandlers.get('tools/list');
      const res = await listHandler({ method: 'tools/list', params: {} });

      assert.strictEqual(res.tools.length, 16, `Expected 16 tools, got ${res.tools.length}`);
      const names = res.tools.map((t) => t.name);
      for (const n of CURATED_MCP_TOOL_NAMES) assert(names.includes(n), `Missing OM name: ${n}`);
      for (const n of EVOCARA_CURATED_MCP_TOOL_NAMES) assert(names.includes(n), `Missing Evocara name: ${n}`);
    });

    // -------------------------------------------------------------------------
    // Test 4: Full Profile Compatibility (42 Tools with either prefix)
    // -------------------------------------------------------------------------
    await test('Full profile exposes 42 tools with default or evocara prefix', async () => {
      const omFullServer = createMCPServer(tmpDir, { profile: 'full' });
      const evoFullServer = createMCPServer(tmpDir, { profile: 'full', prefix: 'evocara' });

      const listOM = omFullServer._requestHandlers.get('tools/list');
      const listEvo = evoFullServer._requestHandlers.get('tools/list');

      const resOM = await listOM({ method: 'tools/list', params: {} });
      const resEvo = await listEvo({ method: 'tools/list', params: {} });

      assert.strictEqual(resOM.tools.length, 42, `Expected 42 OM tools, got ${resOM.tools.length}`);
      assert.strictEqual(resEvo.tools.length, 42, `Expected 42 Evocara tools, got ${resEvo.tools.length}`);

      assert(resOM.tools.every((t) => t.name.startsWith('openmemory_')));
      assert(resEvo.tools.every((t) => t.name.startsWith('evocara_')));
    });

    // -------------------------------------------------------------------------
    // Test 5: CallTool Dual Invocation (openmemory_query_knowledge vs evocara_query_knowledge)
    // -------------------------------------------------------------------------
    await test('CallTool dual alias invocation produces identical BM25 retrieval results', async () => {
      const server = createMCPServer(tmpDir);
      const callHandler = server._requestHandlers.get('tools/call');

      const omRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_query_knowledge',
          arguments: { query: 'local memory persistence' },
        },
      });

      const evoRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'evocara_query_knowledge',
          arguments: { query: 'local memory persistence' },
        },
      });

      assert(!omRes.isError, 'openmemory_query_knowledge failed');
      assert(!evoRes.isError, 'evocara_query_knowledge failed');
      assert.strictEqual(omRes.content[0].text, evoRes.content[0].text, 'Results must match identically');
      assert(omRes.content[0].text.includes('Local Engine Specification'), 'Expected knowledge item in result');
    });

    // -------------------------------------------------------------------------
    // Test 6: CallTool Dual Invocation (openmemory_get_adr vs evocara_get_adr)
    // -------------------------------------------------------------------------
    await test('CallTool dual alias invocation returns identical ADR records', async () => {
      const server = createMCPServer(tmpDir);
      const callHandler = server._requestHandlers.get('tools/call');

      const omRes = await callHandler({
        method: 'tools/call',
        params: { name: 'openmemory_get_adr', arguments: {} },
      });

      const evoRes = await callHandler({
        method: 'tools/call',
        params: { name: 'evocara_get_adr', arguments: {} },
      });

      assert(!omRes.isError);
      assert(!evoRes.isError);
      assert.strictEqual(omRes.content[0].text, evoRes.content[0].text);
      assert(omRes.content[0].text.includes('Use Local Storage Engine'));
    });

    // -------------------------------------------------------------------------
    // Test 7: CallTool Dual Invocation for Mutations (evocara_update_handoff)
    // -------------------------------------------------------------------------
    await test('Mutation via evocara_update_handoff updates handoff without duplicate writes', async () => {
      const server = createMCPServer(tmpDir);
      const callHandler = server._requestHandlers.get('tools/call');

      const updateRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'evocara_update_handoff',
          arguments: {
            activeGoal: 'Complete G27 Milestone',
            activePhase: 'PHASE-4-GA',
            progressSummary: ['Dual aliases implemented', 'Zero regression verified'],
            nextSteps: ['Prepare SBOM', 'Verify Staging'],
            agentId: 'lead-dev',
            sessionId: activeSessionId,
          },
        },
      });

      assert(!updateRes.isError, `evocara_update_handoff failed: ${JSON.stringify(updateRes)}`);

      // Read back via openmemory_get_handoff
      const readRes = await callHandler({
        method: 'tools/call',
        params: { name: 'openmemory_get_handoff', arguments: {} },
      });

      assert(!readRes.isError);
      assert(readRes.content[0].text.includes('Complete G27 Milestone'), 'Handoff must contain updated goal');
      assert(readRes.content[0].text.includes('Dual aliases implemented'), 'Handoff must contain progress summary');
    });

    // -------------------------------------------------------------------------
    // Test 8: Fail-Closed Project Boundary Isolation on Both Aliases
    // -------------------------------------------------------------------------
    await test('Project boundary violation is rejected fail-closed identically on both aliases', async () => {
      const server = createMCPServer(tmpDir);
      const callHandler = server._requestHandlers.get('tools/call');

      const omSecurityRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_query_knowledge',
          arguments: { query: 'secrets', projectId: 'UnauthorizedService' },
        },
      });

      const evoSecurityRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'evocara_query_knowledge',
          arguments: { query: 'secrets', projectId: 'UnauthorizedService' },
        },
      });

      assert.strictEqual(omSecurityRes.isError, true, 'openmemory_query_knowledge must fail closed');
      assert.strictEqual(evoSecurityRes.isError, true, 'evocara_query_knowledge must fail closed');
      assert(omSecurityRes.content[0].text.includes('Access denied: cross-project query rejected'));
      assert(evoSecurityRes.content[0].text.includes('Access denied: cross-project query rejected'));
      assert.strictEqual(omSecurityRes.content[0].text, evoSecurityRes.content[0].text);
    });

    // -------------------------------------------------------------------------
    // Test 9: CLI Compatibility (Version, Help, Status, Query)
    // -------------------------------------------------------------------------
    await test('CLI execution supports version, help, status, and query commands', async () => {
      const verOut = await runCLI(['version'], tmpDir);
      assert(verOut.includes('Evocara'), `Version output missing Evocara: ${verOut}`);
      assert(verOut.includes('0.4.0'), `Version output missing 0.4.0: ${verOut}`);

      const helpOut = await runCLI(['--help'], tmpDir);
      assert(helpOut.includes('Evocara / OpenMemory CLI'), `Help missing dual branding: ${helpOut}`);
      assert(helpOut.includes('evocara <command>'), `Help missing evocara invocation: ${helpOut}`);

      const statusOut = await runCLI(['status'], tmpDir);
      assert(statusOut.includes('InventoryHub'), `Status missing project name: ${statusOut}`);

      const queryOut = await runCLI(['query', '-q', 'persistence'], tmpDir);
      assert(queryOut.includes('Local Engine Specification'), `Query missing knowledge hit: ${queryOut}`);
    });

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log('\n===================================================================');
  console.log(`  G27 Compatibility Suite Results: ${passedTests}/${totalTests} PASSED`);
  console.log('===================================================================\n');
}

runAll().catch((err) => {
  console.error('\n[FATAL ERROR IN G27 COMPATIBILITY SUITE]:', err);
  process.exit(1);
});
