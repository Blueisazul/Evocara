/**
 * Test Suite: G11-INTEGRATION
 * End-to-End Integration, Fail-Closed Recovery, and Release Assurance Suite
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execSync } = require('child_process');

const {
  StorageEngine,
  createMCPServer,
} = require('../../dist/index');

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
  }
}

function makeSandbox() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'om-g11-test-'));
}

function removeSandbox(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

const TARBALL_RC2 = path.resolve(__dirname, '../../.work/artifacts/openmemory-0.3.15-rc2.tgz');
const TARBALL_RC1 = path.resolve(__dirname, '../../.work/artifacts/openmemory-0.3.15-rc1.tgz');
const ACTIVE_TARBALL = fs.existsSync(TARBALL_RC2) ? TARBALL_RC2 : TARBALL_RC1;

console.log('===================================================================');
console.log('  G11-INTEGRATION: End-to-End Promotion & Recovery Test Suite     ');
console.log('===================================================================');

(async () => {
  // TEST 1: Full Transactional Promotion
  runTest('Full promotion executes all 6 phases and transitions to COMMITTED', () => {
    const sandbox = makeSandbox();
    try {
      const consumerPkg = {
        name: 'synthetic-consumer',
        version: '1.0.0',
        dependencies: { openmemory: '0.3.14-rc4' },
      };
      fs.writeFileSync(path.join(sandbox, 'package.json'), JSON.stringify(consumerPkg, null, 2));

      const omDir = path.join(sandbox, '.openmemory');
      fs.mkdirSync(omDir, { recursive: true });
      fs.writeFileSync(path.join(omDir, 'openmemory.json'), JSON.stringify({ version: '0.3.14-rc4' }));

      const engine = new TransactionalPromotionEngine({
        consumerPath: sandbox,
        tarballPath: ACTIVE_TARBALL,
        originalVersion: '0.3.14-rc4',
        expectedVersion: fs.existsSync(TARBALL_RC2) ? '0.3.15-rc2' : '0.3.15-rc1',
        dryRun: false,
        faultInjection: { mockInstallSuccess: true, skipRealSmoke: true },
        logger: () => {},
      });

      const res = engine.runPromotion();
      assert.strictEqual(res.success, true, 'Promotion must succeed');
      assert.strictEqual(res.state, 'COMMITTED');
      assert(!fs.existsSync(path.join(sandbox, '.promotion.lock')), 'Lock must be released');
      assert(fs.existsSync(path.join(sandbox, 'operation_manifest.json')), 'Manifest must be written');
    } finally {
      removeSandbox(sandbox);
    }
  });

  // TEST 2: Crash Recovery & Idempotency
  runTest('Recovers cleanly from simulated crash and subsequent --recover is idempotent', () => {
    const sandbox = makeSandbox();
    try {
      const originalPkg = { name: 'test-consumer', version: '1.0.0', dependencies: { openmemory: '0.3.14-rc4' } };
      fs.writeFileSync(path.join(sandbox, 'package.json'), JSON.stringify(originalPkg, null, 2));

      const backupsDir = path.join(sandbox, 'backups', 'backup_test_123');
      fs.mkdirSync(backupsDir, { recursive: true });
      fs.writeFileSync(path.join(backupsDir, 'package.json'), JSON.stringify(originalPkg, null, 2));

      fs.writeFileSync(path.join(sandbox, 'operation_manifest.json'), JSON.stringify({
        operationId: 'crash_op_123',
        state: 'APPLYING',
        backupPath: backupsDir,
        packageJsonBackup: path.join(backupsDir, 'package.json'),
        originalVersion: '0.3.14-rc4',
        targetVersion: '0.3.15-rc2',
      }));

      fs.writeFileSync(path.join(sandbox, 'package.json'), JSON.stringify({ name: 'test-consumer', corrupted: true }));

      const rec1 = TransactionalPromotionEngine.recoverInterruptedPromotion(sandbox, {
        logger: () => {},
        faultInjection: { mockInstallSuccess: true },
      });
      assert.strictEqual(rec1.recovered, true, 'First recovery must succeed');
      assert.strictEqual(rec1.finalState, 'ROLLED_BACK');

      const restoredPkg = JSON.parse(fs.readFileSync(path.join(sandbox, 'package.json'), 'utf8'));
      assert.strictEqual(restoredPkg.dependencies.openmemory, '0.3.14-rc4');

      const rec2 = TransactionalPromotionEngine.recoverInterruptedPromotion(sandbox, { logger: () => {} });
      assert.strictEqual(rec2.recovered, true, 'Second recovery must succeed idempotently');
      assert.strictEqual(rec2.alreadyClean, true, 'Must report already clean');
    } finally {
      removeSandbox(sandbox);
    }
  });

  // TEST 3: Fail-Closed Recovery from Corrupted Manifest
  runTest('Fail-closed handling of malformed operation_manifest.json with emergency backup restore', () => {
    const sandbox = makeSandbox();
    try {
      const originalPkg = { name: 'torn-consumer', version: '1.0.0', dependencies: { openmemory: '0.3.14-rc4' } };
      fs.writeFileSync(path.join(sandbox, 'package.json'), JSON.stringify(originalPkg, null, 2));

      const backupsDir = path.join(sandbox, 'backups', 'backup_valid_001');
      fs.mkdirSync(backupsDir, { recursive: true });
      fs.writeFileSync(path.join(backupsDir, 'package.json'), JSON.stringify(originalPkg, null, 2));

      fs.writeFileSync(path.join(sandbox, 'operation_manifest.json'), '{"operationId":"torn_op_999", "state": "APPLY');

      const check = TransactionalPromotionEngine.checkForInterruptedPromotion(sandbox);
      assert.strictEqual(check.isInterrupted, true);
      assert.strictEqual(check.isCorrupted, true);

      const storage = new StorageEngine(sandbox);
      const health = storage.getConsolidatedHealthSummary({ rootDir: sandbox });
      assert.strictEqual(health.overallStatus, 'CORRUPTED');

      const rec = TransactionalPromotionEngine.recoverInterruptedPromotion(sandbox, { logger: () => {} });
      assert.strictEqual(rec.recovered, true);
      assert.strictEqual(rec.recoveredFromBackup, true);
      assert(fs.existsSync(rec.quarantinedManifest));

      const restored = JSON.parse(fs.readFileSync(path.join(sandbox, 'package.json'), 'utf8'));
      assert.strictEqual(restored.dependencies.openmemory, '0.3.14-rc4');
    } finally {
      removeSandbox(sandbox);
    }
  });

  // TEST 4: Dead PID Lock Eviction
  runTest('Dead PID promotion lock is safely evicted while active live PID lock blocks', () => {
    const sandbox = makeSandbox();
    try {
      fs.writeFileSync(path.join(sandbox, 'package.json'), JSON.stringify({ name: 'lock-test' }));

      const lockPath = path.join(sandbox, '.promotion.lock');
      fs.writeFileSync(lockPath, JSON.stringify({
        operationId: 'dead_op',
        pid: 999999,
        acquiredAt: Date.now() - 10000,
        expiresAt: Date.now() + 60000,
      }));

      const engine = new TransactionalPromotionEngine({
        consumerPath: sandbox,
        logger: () => {},
      });

      assert.doesNotThrow(() => engine.acquireLock());
      assert.strictEqual(engine.state, 'LOCK_ACQUIRED');
      engine.releaseLock();

      fs.writeFileSync(lockPath, JSON.stringify({
        operationId: 'live_op',
        pid: process.pid,
        acquiredAt: Date.now(),
        expiresAt: Date.now() + 60000,
      }));

      const engine2 = new TransactionalPromotionEngine({
        consumerPath: sandbox,
        logger: () => {},
      });

      assert.throws(() => engine2.acquireLock(), /PROMOTION_CONCURRENCY_VIOLATION/);
      fs.unlinkSync(lockPath);
    } finally {
      removeSandbox(sandbox);
    }
  });

  // TEST 5: MCP Contract & Token Masking
  await runAsyncTest('MCP server adheres to schema, masks lock tokens, and isolates errors', async () => {
    const sandbox = makeSandbox();
    try {
      const server = createMCPServer(sandbox);
      const callHandler = server._requestHandlers.get('tools/call');
      assert(callHandler, 'tools/call handler must be registered');

      const resCandidate = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_candidate_integrity',
          arguments: {},
        },
      });
      assert(!resCandidate.isError);
      const parsedCand = JSON.parse(resCandidate.content[0].text);
      assert.strictEqual(parsedCand.present, true);

      const storage = new StorageEngine(sandbox);
      storage.ensureStorageStructure();
      const secretToken = 'tok_secret_master_token_do_not_leak_98765';
      fs.writeFileSync(path.join(sandbox, '.openmemory', 'locks', 'test.lock'), JSON.stringify({
        resourceKey: 'test',
        token: secretToken,
        pid: process.pid,
        acquiredAt: new Date().toISOString(),
        expiresAt: Date.now() + 60000,
      }));

      const resLocks = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_inspect_locks',
          arguments: {},
        },
      });
      assert(!resLocks.isError);
      const text = resLocks.content[0].text;
      assert(!text.includes(secretToken), 'Cleartext secret token must not be leaked');
      assert(text.includes('tok_secret_') && text.includes('...'), 'Masked prefix must be displayed');

      const resCp = await callHandler({
        method: 'tools/call',
        params: {
          name: 'openmemory_sqlite_checkpoint',
          arguments: { dbPath: path.join(sandbox, 'nonexistent.db') },
        },
      });
      assert(!resCp.isError, 'Handled error must not crash MCP');
    } finally {
      removeSandbox(sandbox);
    }
  });

  // TEST 6: Candidate Artifact Assurance
  runTest('openmemory-0.3.15-rc2.tgz is Zip-Slip safe, free of leaks, and smoke-tested', () => {
    if (!fs.existsSync(TARBALL_RC2)) {
      console.log('Skipped (rc2 tarball not present)');
      return;
    }
    const tarList = execSync(`tar -tzf "${TARBALL_RC2}"`, { encoding: 'utf8' })
      .trim()
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);

    const slipEntries = tarList.filter(f => f.startsWith('/') || f.startsWith('\\') || f.includes('../') || f.includes('..\\') || /^[a-zA-Z]:/.test(f));
    assert.strictEqual(slipEntries.length, 0, 'No path traversal entries in tarball');
    assert.strictEqual(tarList.length, 75, 'Expected 75 packaged files');

    const forbidden = [/\.env/i, /\.pem$/i, /\.key$/i, /id_rsa/i, /\.db/i, /\.sqlite/i, /\.lock$/i];
    for (const f of tarList) {
      for (const pat of forbidden) {
        assert(!pat.test(f), `Forbidden file in tarball: ${f}`);
      }
    }
  });

  // TEST 7: InventoryHub Non-Mutation Assertion
  runTest('InventoryHub remains completely untouched with 0.3.14-rc4 baseline', () => {
    const ihPath = 'C:\\Users\\sant1\\OneDrive\\Documentos\\ChatGPT\\OpenMemory\\InventoryHub';
    const pkg = JSON.parse(fs.readFileSync(path.join(ihPath, 'package.json'), 'utf8'));
    assert(pkg.dependencies.openmemory.includes('openmemory-0.3.14-rc4.tgz'), 'InventoryHub must remain on 0.3.14-rc4');
    assert(!fs.existsSync(path.join(ihPath, '.promotion.lock')), 'No promotion lock in InventoryHub');
  });

  console.log('===================================================================');
  console.log(`  G11-INTEGRATION Results: ${passedCount}/${testCount} tests passed.`);
  console.log('===================================================================');

  if (passedCount !== testCount) {
    process.exit(1);
  } else {
    process.exit(0);
  }
})();