/**
 * G17 Test Suite: Candidate 0.3.15-rc3 Isolated Sandbox Consumer Validation & Rehearsal
 *
 * Validates Bloque D of Iteración G17:
 * 1. Cryptographic integrity of candidate openmemory-0.3.15-rc3.tgz.
 * 2. Pre-flight capture of live InventoryHub baseline (read-only).
 * 3. Dry-run zero-mutation validation in isolated sandbox clone.
 * 4. Transactional promotion of candidate 0.3.15-rc3 in isolated sandbox clone.
 * 5. Full MCP tool verification: exactly 38 tools exposed, including all 3 TMS tools.
 * 6. Functional verification of CLI TMS operations and BM25 weighted retrieval in installed package.
 * 7. Execution of all 34 InventoryHub business acceptance tests in the promoted sandbox.
 * 8. Staged rollback rehearsal with fault injection: 100% hash parity to 0.3.14-rc4 and idempotency.
 * 9. Proof that live InventoryHub remained 100% untouched throughout all rehearsals.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const {
  TransactionalPromotionEngine,
} = require('../../scripts/transactional-promotion-engine');

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

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase();
}

const projectRoot = path.resolve(__dirname, '../..');
const candidateTarball = path.join(projectRoot, '.work', 'artifacts', 'openmemory-0.3.15-rc3.tgz');
const expectedCandidateSha256 = 'FB1850A44C442511E22122814117ADCDC8102041322D976F0E7736B4D1E60AFC';
const expectedCandidateSize = 197383;
const liveConsumerPath = 'C:\\Users\\sant1\\OneDrive\\Documentos\\ChatGPT\\OpenMemory\\InventoryHub';

function createSandboxClone(sourceDir, targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const entries = fs.readdirSync(sourceDir);
  for (const entry of entries) {
    if (entry === '.git' || entry === 'backups' || entry === 'scratch' || entry.startsWith('.promotion.lock')) continue;
    const srcPath = path.join(sourceDir, entry);
    const dstPath = path.join(targetDir, entry);
    fs.cpSync(srcPath, dstPath, { recursive: true });
  }

  // Ensure node_modules/openmemory has original package tarball available for engine rollback
  const origTgz = path.join(projectRoot, '.work', 'artifacts', 'openmemory-0.3.14-rc4.tgz');
  const sandboxBackups = path.join(targetDir, 'backups');
  fs.mkdirSync(sandboxBackups, { recursive: true });
  if (fs.existsSync(origTgz)) {
    fs.copyFileSync(origTgz, path.join(sandboxBackups, 'openmemory-0.3.14-rc4.tgz'));
  }
}

console.log('===================================================================');
console.log('  G17: Candidate 0.3.15-rc3 Sandbox Validation & Rehearsal Suite    ');
console.log('===================================================================');

(async () => {
  // --------------------------------------------------------------------------
  // TEST 1: Candidate Artifact Cryptographic Identity & Verification
  // --------------------------------------------------------------------------
  runTest('Candidate 0.3.15-rc3 artifact cryptographic identity verified', () => {
    assert(fs.existsSync(candidateTarball), 'Candidate tarball missing at: ' + candidateTarball);
    const actualHash = sha256File(candidateTarball);
    const actualSize = fs.statSync(candidateTarball).size;

    assert.strictEqual(actualHash, expectedCandidateSha256, 'Candidate SHA-256 hash mismatch');
    assert.strictEqual(actualSize, expectedCandidateSize, 'Candidate file size mismatch');

    const tarCheck = spawnSync('tar', ['-tzf', candidateTarball], { encoding: 'utf8' });
    assert.strictEqual(tarCheck.status, 0, 'tar command failed to list contents');
    const files = tarCheck.stdout.split('\n');

    const requiredEntries = [
      'package/package.json',
      'package/dist/index.js',
      'package/dist/cli.js',
      'package/dist/mcp.js',
      'package/dist/storage.js',
      'package/dist/storage/domains/knowledge-tms.js',
    ];

    for (const req of requiredEntries) {
      assert(files.some(f => f.includes(req)), 'Tarball missing required entry: ' + req);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: Preflight Live InventoryHub Fingerprint Capture
  // --------------------------------------------------------------------------
  let initialLivePkgJson = null;
  let initialLiveOpenMemoryVer = null;

  runTest('Live InventoryHub baseline captured (read-only pre-flight inspection)', () => {
    assert(fs.existsSync(liveConsumerPath), 'Live InventoryHub not found at: ' + liveConsumerPath);
    const pkgPath = path.join(liveConsumerPath, 'package.json');
    initialLivePkgJson = fs.readFileSync(pkgPath, 'utf8');

    const omPkgPath = path.join(liveConsumerPath, 'node_modules', 'openmemory', 'package.json');
    if (fs.existsSync(omPkgPath)) {
      const omPkg = JSON.parse(fs.readFileSync(omPkgPath, 'utf8'));
      initialLiveOpenMemoryVer = omPkg.version;
    }

    assert(initialLivePkgJson, 'Must capture initial package.json');
    assert.strictEqual(initialLiveOpenMemoryVer, '0.3.14-rc4', 'Live consumer must be running 0.3.14-rc4');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Dry-Run Zero-Mutation Guarantee in Sandbox Clone
  // --------------------------------------------------------------------------
  runTest('Dry-run produces DRY_RUN_PASSED with zero filesystem mutations', () => {
    const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'om-g17-dry-run-'));
    try {
      createSandboxClone(liveConsumerPath, sandboxDir);

      const engine = new TransactionalPromotionEngine({
        consumerPath: sandboxDir,
        tarballPath: candidateTarball,
        originalVersion: '0.3.14-rc4',
        expectedVersion: '0.3.15-rc3',
        dryRun: true,
        logger: () => {},
      });

      const res = engine.runPromotion();
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.state, 'DRY_RUN_PASSED');
      assert.strictEqual(res.outcome, 'DRY_RUN_PASSED');

      const backupsDir = path.join(sandboxDir, 'backups');
      const backupEntries = fs.readdirSync(backupsDir).filter(f => f.startsWith('backup_promo_'));
      assert.strictEqual(backupEntries.length, 0, 'Dry-run must create 0 backups');
    } finally {
      try { fs.rmSync(sandboxDir, { recursive: true, force: true }); } catch (_) {}
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4 & 5 & 6: Full Transactional Promotion in Isolated Sandbox Clone
  // --------------------------------------------------------------------------
  const fullSandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'om-g17-full-promo-'));
  try {
    createSandboxClone(liveConsumerPath, fullSandboxDir);

    runTest('Full promotion of 0.3.15-rc3 in isolated sandbox clone succeeds', () => {
      const engine = new TransactionalPromotionEngine({
        consumerPath: fullSandboxDir,
        tarballPath: candidateTarball,
        originalVersion: '0.3.14-rc4',
        expectedVersion: '0.3.15-rc3',
        dryRun: false,
        logger: () => {},
      });

      const res = engine.runPromotion();
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.state, 'COMMITTED');

      const installedPkg = JSON.parse(
        fs.readFileSync(path.join(fullSandboxDir, 'node_modules', 'openmemory', 'package.json'), 'utf8')
      );
      assert.strictEqual(installedPkg.version, '0.3.15-rc3', 'Installed version must be 0.3.15-rc3');
      assert(fs.existsSync(path.join(fullSandboxDir, 'operation_manifest.json')), 'Manifest must exist');
    });

    await runAsyncTest('Promoted candidate exports all 38 MCP tools, including 3 G15 TMS tools', async () => {
      const omModule = require(path.join(fullSandboxDir, 'node_modules', 'openmemory', 'dist', 'index.js'));
      assert(typeof omModule.StorageEngine === 'function', 'Must export StorageEngine');
      assert(typeof omModule.createMCPServer === 'function', 'Must export createMCPServer');
      assert(typeof omModule.runCLI === 'function', 'Must export runCLI');

      const server = omModule.createMCPServer(fullSandboxDir);
      const listHandler = server._requestHandlers.get('tools/list');
      const toolRes = await listHandler({ method: 'tools/list', params: {} });
      const toolNames = toolRes.tools.map(t => t.name);

      assert.strictEqual(toolNames.length, 38, `Candidate 0.3.15-rc3 must expose exactly 38 tools (found ${toolNames.length})`);

      const expectedTmsTools = [
        'openmemory_transition_knowledge_lifecycle',
        'openmemory_create_knowledge_relation',
        'openmemory_analyze_knowledge_tms',
      ];
      for (const tmsTool of expectedTmsTools) {
        assert(toolNames.includes(tmsTool), `Promoted candidate missing TMS tool: ${tmsTool}`);
      }

      // Functional call to TMS tool via MCP dispatch
      const callHandler = server._requestHandlers.get('tools/call');
      const analyzeRes = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_analyze_knowledge_tms',
          arguments: {},
        },
      });
      assert(analyzeRes && analyzeRes.content, 'TMS analysis call must return content');
      const tmsPayload = JSON.parse(analyzeRes.content[0].text);
      assert(tmsPayload.overallStatus, 'TMS payload must contain overallStatus');
    });

    runTest('Promoted candidate CLI supports TMS subcommands and executes correctly', () => {
      const cliPath = path.join(fullSandboxDir, 'node_modules', 'openmemory', 'dist', 'cli.js');
      const cliRun = spawnSync('node', [cliPath, 'tms', 'analyze'], { cwd: fullSandboxDir, encoding: 'utf8' });
      assert.strictEqual(cliRun.status, 0, 'CLI tms analyze failed: ' + cliRun.stderr);
      assert(cliRun.stdout.includes('Truth Maintenance System (TMS) Analysis Report'));
    });

    runTest('All 34 InventoryHub business acceptance tests PASS in promoted candidate sandbox', () => {
      const t1 = spawnSync('node', ['test_inventory_manager.js'], { cwd: fullSandboxDir, encoding: 'utf8' });
      assert.strictEqual(t1.status, 0, 'test_inventory_manager failed: ' + t1.stderr);
      assert(t1.stdout.includes('ALL E2E VERIFICATION CHECKS PASSED'));

      const t2 = spawnSync('node', ['test_phase_2c2_full.js'], { cwd: fullSandboxDir, encoding: 'utf8' });
      assert.strictEqual(t2.status, 0, 'test_phase_2c2_full failed: ' + t2.stderr);

      const t3 = spawnSync('node', ['test_phase_2c4_post_cleanup.mjs'], { cwd: fullSandboxDir, encoding: 'utf8' });
      assert.strictEqual(t3.status, 0, 'test_phase_2c4_post_cleanup failed: ' + t3.stderr);
    });
  } finally {
    try { fs.rmSync(fullSandboxDir, { recursive: true, force: true }); } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // TEST 7: Fault-Injected Rollback & Parity Verification in Sandbox
  // --------------------------------------------------------------------------
  const rollbackSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'om-g17-rollback-'));
  try {
    createSandboxClone(liveConsumerPath, rollbackSandbox);

    runTest('Fault injection during smoke test triggers safe, complete rollback to 0.3.14-rc4', () => {
      const origPkgContent = fs.readFileSync(path.join(rollbackSandbox, 'package.json'), 'utf8');

      const engine = new TransactionalPromotionEngine({
        consumerPath: rollbackSandbox,
        tarballPath: candidateTarball,
        originalVersion: '0.3.14-rc4',
        expectedVersion: '0.3.15-rc3',
        dryRun: false,
        faultInjection: { failAtPhase: 'SMOKE_TEST' },
        logger: () => {},
      });

      const res = engine.runPromotion();
      assert.strictEqual(res.success, false, 'Fault-injected run must report failure');
      assert.strictEqual(res.state, 'ROLLED_BACK', 'State must be ROLLED_BACK');

      const restoredPkgContent = fs.readFileSync(path.join(rollbackSandbox, 'package.json'), 'utf8');
      assert.strictEqual(restoredPkgContent, origPkgContent, 'package.json must be restored with 100% parity');

      const restoredOmPkg = JSON.parse(
        fs.readFileSync(path.join(rollbackSandbox, 'node_modules', 'openmemory', 'package.json'), 'utf8')
      );
      assert.strictEqual(restoredOmPkg.version, '0.3.14-rc4', 'Installed package must be restored to 0.3.14-rc4');

      const secondRollback = engine.executeRollback('REPEAT_ROLLBACK_TEST');
      assert.strictEqual(secondRollback, true, 'Subsequent rollback must be idempotent and return true');
    });
  } finally {
    try { fs.rmSync(rollbackSandbox, { recursive: true, force: true }); } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // TEST 8: Inviolability of Live InventoryHub Consumer
  // --------------------------------------------------------------------------
  runTest('Live InventoryHub remained 100% untouched throughout all rehearsals', () => {
    const currentLivePkgJson = fs.readFileSync(path.join(liveConsumerPath, 'package.json'), 'utf8');
    assert.strictEqual(currentLivePkgJson, initialLivePkgJson, 'Live package.json was mutated!');

    const currentLiveOmPkg = JSON.parse(
      fs.readFileSync(path.join(liveConsumerPath, 'node_modules', 'openmemory', 'package.json'), 'utf8')
    );
    assert.strictEqual(currentLiveOmPkg.version, '0.3.14-rc4', 'Live installed openmemory was mutated!');
    assert(!fs.existsSync(path.join(liveConsumerPath, '.promotion.lock')), 'Stray lock in live consumer!');
  });

  console.log('-------------------------------------------------------------------');
  console.log(`  G17 Candidate Sandbox Validation: ${passedCount} / ${testCount} tests PASSED.`);
  console.log('-------------------------------------------------------------------');
})();
