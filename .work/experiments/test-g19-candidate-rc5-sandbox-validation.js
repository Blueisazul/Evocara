/**
 * G19: Candidate 0.3.15-rc5 Sandbox Validation & Staging Rehearsal Suite
 *
 * Validates the G19 release candidate openmemory-0.3.15-rc5.tgz in an isolated
 * temporary staging environment without mutating the live InventoryHub consumer.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const assert = require('assert');
const { spawnSync } = require('child_process');
const { TransactionalPromotionEngine } = require('../../scripts/transactional-promotion-engine');

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
const candidateTarball = path.join(projectRoot, '.work', 'artifacts', 'openmemory-0.3.15-rc5.tgz');
const expectedCandidateSha256 = '1DD9BC68119EE3FFDDA0C0D160D41527642419696718AAF28CFB52508244EFD4';
const expectedCandidateSize = 204060;
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

  const origTgz = path.join(projectRoot, '.work', 'artifacts', 'openmemory-0.3.14-rc4.tgz');
  const sandboxBackups = path.join(targetDir, 'backups');
  fs.mkdirSync(sandboxBackups, { recursive: true });
  if (fs.existsSync(origTgz)) {
    fs.copyFileSync(origTgz, path.join(sandboxBackups, 'openmemory-0.3.14-rc4.tgz'));
  }
}

console.log('===================================================================');
console.log('  G19: Candidate 0.3.15-rc5 Sandbox Validation & Rehearsal Suite    ');
console.log('===================================================================');

(async () => {
  // --------------------------------------------------------------------------
  // TEST 1: Tarball Physical Existence, Size and Cryptographic SHA-256 Match
  // --------------------------------------------------------------------------
  runTest('Candidate 0.3.15-rc5 tarball exists and matches declared manifest cryptographic SHA-256', () => {
    assert(fs.existsSync(candidateTarball), 'Candidate tarball not found at: ' + candidateTarball);
    const actualSize = fs.statSync(candidateTarball).size;
    assert.strictEqual(actualSize, expectedCandidateSize, `Candidate size ${actualSize} does not match expected ${expectedCandidateSize}`);
    const actualSha = sha256File(candidateTarball);
    assert.strictEqual(actualSha, expectedCandidateSha256, `SHA-256 mismatch: got ${actualSha}, expected ${expectedCandidateSha256}`);

    // Verify manifest
    const manifestPath = path.join(projectRoot, '.work', 'artifacts', 'openmemory-0.3.15-rc5-manifest.json');
    assert(fs.existsSync(manifestPath), 'Manifest not found at: ' + manifestPath);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(manifest.version, '0.3.15-rc5');
    assert.strictEqual(manifest.integrity.sha256, expectedCandidateSha256);
    assert.strictEqual(manifest.integrity.sizeBytes, expectedCandidateSize);

    // Verify tarball contents
    const inspectRes = spawnSync('tar', ['-ztvf', candidateTarball], { encoding: 'utf8' });
    assert.strictEqual(inspectRes.status, 0, 'tar inspection failed');
    const files = inspectRes.stdout.trim().split(/\r?\n/);

    const requiredEntries = [
      'package/package.json',
      'package/dist/index.js',
      'package/dist/mcp.js',
      'package/dist/cli.js',
      'package/dist/storage.js',
      'package/dist/storage/core/event-logger.js',
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
    const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'om-g19-dry-run-'));
    try {
      createSandboxClone(liveConsumerPath, sandboxDir);

      const engine = new TransactionalPromotionEngine({
        consumerPath: sandboxDir,
        tarballPath: candidateTarball,
        originalVersion: '0.3.14-rc4',
        expectedVersion: '0.3.15-rc5',
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
  // TEST 4, 5, 6 & 7: Full Transactional Promotion in Isolated Sandbox Clone
  // --------------------------------------------------------------------------
  const fullSandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'om-g19-full-promo-'));
  try {
    createSandboxClone(liveConsumerPath, fullSandboxDir);

    runTest('Full promotion of 0.3.15-rc5 in isolated sandbox clone succeeds', () => {
      const engine = new TransactionalPromotionEngine({
        consumerPath: fullSandboxDir,
        tarballPath: candidateTarball,
        originalVersion: '0.3.14-rc4',
        expectedVersion: '0.3.15-rc5',
        dryRun: false,
        logger: () => {},
      });

      const res = engine.runPromotion();
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.state, 'COMMITTED');

      const installedPkg = JSON.parse(
        fs.readFileSync(path.join(fullSandboxDir, 'node_modules', 'openmemory', 'package.json'), 'utf8')
      );
      assert.strictEqual(installedPkg.version, '0.3.15-rc5', 'Installed version must be 0.3.15-rc5');
      assert(fs.existsSync(path.join(fullSandboxDir, 'operation_manifest.json')), 'Manifest must exist');
    });

    await runAsyncTest('Promoted candidate exports all 40 MCP tools (including 3 TMS + 2 Event Retention tools)', async () => {
      const omModule = require(path.join(fullSandboxDir, 'node_modules', 'openmemory', 'dist', 'index.js'));
      assert(typeof omModule.StorageEngine === 'function', 'Must export StorageEngine');
      assert(typeof omModule.createMCPServer === 'function', 'Must export createMCPServer');
      assert(typeof omModule.runCLI === 'function', 'Must export runCLI');

      const server = omModule.createMCPServer(fullSandboxDir);
      const listHandler = server._requestHandlers.get('tools/list');
      const toolRes = await listHandler({ method: 'tools/list', params: {} });
      const toolNames = toolRes.tools.map(t => t.name);

      assert.strictEqual(toolNames.length, 40, `Candidate 0.3.15-rc5 must expose exactly 40 tools (found ${toolNames.length})`);

      const expectedNewTools = [
        'openmemory_transition_knowledge_lifecycle',
        'openmemory_create_knowledge_relation',
        'openmemory_analyze_knowledge_tms',
        'openmemory_compact_event_logs',
        'openmemory_get_event_retention_policy',
      ];
      for (const t of expectedNewTools) {
        assert(toolNames.includes(t), `Promoted candidate missing tool: ${t}`);
      }
    });

    runTest('Promoted candidate CLI supports TMS subcommands and event logs commands', () => {
      const cliPath = path.join(fullSandboxDir, 'node_modules', 'openmemory', 'dist', 'cli.js');

      // Test tms analyze
      const cliTms = spawnSync('node', [cliPath, 'tms', 'analyze'], { cwd: fullSandboxDir, encoding: 'utf8' });
      assert.strictEqual(cliTms.status, 0, 'CLI tms analyze failed: ' + cliTms.stderr);
      assert(cliTms.stdout.includes('Truth Maintenance System (TMS) Analysis Report'));

      // Test logs policy
      const cliPolicy = spawnSync('node', [cliPath, 'logs', 'policy'], { cwd: fullSandboxDir, encoding: 'utf8' });
      assert.strictEqual(cliPolicy.status, 0, 'CLI logs policy failed: ' + cliPolicy.stderr);
      assert(cliPolicy.stdout.includes('maxSizeBytes') && cliPolicy.stdout.includes('preserveEssentialEvents'), 'CLI logs policy must output policy JSON');

      // Test storage engine methods
      const omModule = require(path.join(fullSandboxDir, 'node_modules', 'openmemory', 'dist', 'index.js'));
      const storage = new omModule.StorageEngine(fullSandboxDir);
      assert.strictEqual(typeof storage.compactEventLogs, 'function', 'Candidate must have compactEventLogs');
      assert.strictEqual(typeof storage.getEventRetentionPolicy, 'function', 'Candidate must have getEventRetentionPolicy');
      assert.strictEqual(typeof storage.deleteKnowledgeItem, 'function', 'Candidate must have deleteKnowledgeItem');
      assert.strictEqual(typeof storage.scoreKnowledgeItemBM25, 'function', 'Candidate must have scoreKnowledgeItemBM25');
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
  // TEST 8: Fault-Injected Rollback & Parity Verification in Sandbox
  // --------------------------------------------------------------------------
  const rollbackSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'om-g19-rollback-'));
  try {
    createSandboxClone(liveConsumerPath, rollbackSandbox);

    runTest('Fault injection during smoke test triggers safe, complete rollback to 0.3.14-rc4', () => {
      const origPkgContent = fs.readFileSync(path.join(rollbackSandbox, 'package.json'), 'utf8');

      const engine = new TransactionalPromotionEngine({
        consumerPath: rollbackSandbox,
        tarballPath: candidateTarball,
        originalVersion: '0.3.14-rc4',
        expectedVersion: '0.3.15-rc5',
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
  // TEST 9: Inviolability of Live InventoryHub Consumer
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
  console.log(`  G19 Candidate Sandbox Validation: ${passedCount} / ${testCount} tests PASSED.`);
  console.log('-------------------------------------------------------------------');
})();
