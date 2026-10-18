/**
 * Test Suite: P1.6 Deep Transactional Engine & Adversarial Regression
 *
 * Verifies P1.6 architectural fixes:
 * 1. Recursive SQLite quiescence (WAL & SHM detection in subdirectories).
 * 2. Clock-skew and far-future expiresAt bounded TTL enforcement.
 * 3. Double-fault staging quarantine and forensic preservation.
 * 4. Continuous mutual exclusion token assertions across state transitions.
 * 5. Corrupted lock recovery with bounded age.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const {
  TransactionalPromotionEngine,
  scanSqliteQuiescence,
  isContainedWithin,
} = require('../../scripts/transactional-promotion-engine');

console.log('========================================================================');
console.log('=== TEST SUITE: P1.6 DEEP TRANSACTIONAL ENGINE HARDENING & AUDIT ===');
console.log('========================================================================\n');

const testSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'om-p16-suite-'));

try {
  // --------------------------------------------------------------------------
  // TEST 1: Recursive SQLite WAL Detection in Subdirectories
  // --------------------------------------------------------------------------
  console.log('[TEST 1] Testing recursive SQLite WAL detection in subdirectories...');
  const t1Dir = path.join(testSandbox, 't1-consumer');
  const subDataDir = path.join(t1Dir, '.openmemory', 'storage');
  fs.mkdirSync(subDataDir, { recursive: true });

  const dbPath = path.join(subDataDir, 'app_context.db');
  fs.writeFileSync(dbPath, 'SQLITE_HEADER_MOCK');
  const walPath = `${dbPath}-wal`;
  fs.writeFileSync(walPath, 'UNCHECKPOINTED_WAL_DATA');

  assert.throws(
    () => {
      scanSqliteQuiescence(t1Dir, t1Dir);
    },
    /Unconsolidated active SQLite WAL detected/,
    'Must detect and reject active WAL inside subdirectories'
  );
  console.log('  [PASS 1] Active SQLite WAL in subdirectories detected and blocked.');

  // Clean up WAL for next test
  fs.unlinkSync(walPath);

  // --------------------------------------------------------------------------
  // TEST 2: Recursive SQLite SHM Detection in Subdirectories
  // --------------------------------------------------------------------------
  console.log('\n[TEST 2] Testing recursive SQLite SHM detection (active readers/writers)...');
  const shmPath = `${dbPath}-shm`;
  fs.writeFileSync(shmPath, 'ACTIVE_SHM_INDEX_BYTES');

  assert.throws(
    () => {
      scanSqliteQuiescence(t1Dir, t1Dir);
    },
    /Active SQLite shared-memory index detected/,
    'Must detect and reject active SHM inside subdirectories'
  );
  console.log('  [PASS 2] Active SQLite SHM in subdirectories detected and blocked.');
  fs.unlinkSync(shmPath);

  // Verify clean state passes
  const cleanFiles = scanSqliteQuiescence(t1Dir, t1Dir);
  assert.strictEqual(cleanFiles.length, 1, 'Should cleanly index 1 quiescent DB');
  assert.strictEqual(cleanFiles[0].relPath, '.openmemory/storage/app_context.db');
  console.log('  [PASS 2b] Quiescent DB in subdirectory indexed with correct relative path.');

  // --------------------------------------------------------------------------
  // TEST 3: Bounded Lock Expiration on Clock Skew / Distant Future expiresAt
  // --------------------------------------------------------------------------
  console.log('\n[TEST 3] Testing bounded lock expiration against clock skew / distant future expiresAt...');
  const t3Dir = path.join(testSandbox, 't3-consumer');
  fs.mkdirSync(t3Dir, { recursive: true });

  const lockFile = path.join(t3Dir, '.promotion.lock');
  const now = Date.now();
  // Malicious / clock-skewed payload claiming expiration in year 2099
  const skewedPayload = JSON.stringify({
    operationId: 'skewed_op',
    pid: 999999999, // non-existent PID
    token: 'tok_skewed',
    acquiredAt: now + 86400000,
    expiresAt: now + 31536000000, // 1 year in future
  });
  fs.writeFileSync(lockFile, skewedPayload, 'utf8');

  // Backdate lock file mtime to simulate stale lock > TTL
  const pastTime = new Date(now - 120000);
  fs.utimesSync(lockFile, pastTime, pastTime);

  const engine = new TransactionalPromotionEngine({ consumerPath: t3Dir });
  const acquired = engine.acquireLock(60000);
  assert.strictEqual(acquired, true, 'Engine must reclaim lock despite distant future expiresAt due to stat age');
  engine.releaseLock();
  console.log('  [PASS 3] Distant future / clock-skewed lock reclaimed via bounded stat age.');

  // --------------------------------------------------------------------------
  // TEST 4: Continuous Token Defense (assertLockHeld)
  // --------------------------------------------------------------------------
  console.log('\n[TEST 4] Testing assertLockHeld defenses against token tampering and missing lock...');
  const t4Dir = path.join(testSandbox, 't4-consumer');
  fs.mkdirSync(t4Dir, { recursive: true });

  const t4Engine = new TransactionalPromotionEngine({ consumerPath: t4Dir });
  t4Engine.acquireLock();
  assert.doesNotThrow(() => t4Engine.assertLockHeld(), 'Valid lock holder must pass assertLockHeld');

  // Overwrite lock with foreign token
  fs.writeFileSync(
    path.join(t4Dir, '.promotion.lock'),
    JSON.stringify({ operationId: 'foreign', token: 'foreign_tok', pid: process.pid }),
    'utf8'
  );
  assert.throws(
    () => t4Engine.assertLockHeld(),
    /PROMOTION_LOCK_VIOLATION: Lock token mismatch/,
    'Foreign lock token must trigger immediate violation'
  );

  // Delete lock
  fs.unlinkSync(path.join(t4Dir, '.promotion.lock'));
  assert.throws(
    () => t4Engine.assertLockHeld(),
    /PROMOTION_LOCK_VIOLATION: Lock file was unexpectedly deleted/,
    'Deleted lock file must trigger immediate violation'
  );
  console.log('  [PASS 4] assertLockHeld enforced across token tampering and missing lock.');

  // --------------------------------------------------------------------------
  // TEST 5: Quarantining of Staging Directory on Double-Fault Failure
  // --------------------------------------------------------------------------
  console.log('\n[TEST 5] Testing staging directory quarantine on double-fault rollback failure...');
  const t5Dir = path.join(testSandbox, 't5-consumer');
  fs.mkdirSync(t5Dir, { recursive: true });
  fs.writeFileSync(path.join(t5Dir, 'package.json'), '{"name":"t5","dependencies":{"openmemory":"0.3.1"}}');
  const t5Om = path.join(t5Dir, '.openmemory');
  fs.mkdirSync(t5Om, { recursive: true });
  fs.writeFileSync(path.join(t5Om, 'data.json'), '{"preserved":true}');

  const dummyTarball = path.join(testSandbox, 'dummy.tgz');
  fs.writeFileSync(dummyTarball, 'MOCK_TARBALL_DATA');

  const t5Engine = new TransactionalPromotionEngine({
    consumerPath: t5Dir,
    tarballPath: dummyTarball,
    faultInjection: {
      failStagingSwap: true, // trigger staging swap failure with stagingDir present
      mockInstallSuccess: true,
    },
  });

  t5Engine.acquireLock();
  const pre = t5Engine.verifyPreflight();
  t5Engine.createTransactionalBackup(pre);
  const rollbackOk = t5Engine.executeRollback('TEST_INDUCED_ABORT');
  assert.strictEqual(rollbackOk, false, 'Double-fault rollback must return false');
  assert.strictEqual(t5Engine.state, 'FAILED_ROLLBACK');

  // Verify staging directory was quarantined
  const t5Entries = fs.readdirSync(t5Dir);
  const quarantinedDir = t5Entries.find((e) => e.startsWith('.quarantined-staging-'));
  assert(quarantinedDir, 'A .quarantined-staging-* directory must exist to preserve forensic data');

  // Verify abort evidence was persisted with stack trace
  const evidenceFile = path.join(t5Dir, 'promotion_abort_evidence.json');
  assert(fs.existsSync(evidenceFile), 'Abort evidence must be preserved on disk');
  const evData = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
  assert(evData.rollbackFailure.includes('Simulated failure during staging swap'));
  assert(evData.rollbackStack, 'Stack trace must be preserved in abort evidence');
  console.log('  [PASS 5] Double-fault safely quarantined staging and recorded full forensics.');

  // --------------------------------------------------------------------------
  // TEST 6: Signal Handler Binding & Unbinding
  // --------------------------------------------------------------------------
  console.log('\n[TEST 6] Testing signal handler lifecycle...');
  const t6Engine = new TransactionalPromotionEngine({ consumerPath: t5Dir });
  const sigIntBefore = process.listenerCount('SIGINT');
  t6Engine.bindSignalHandlers();
  assert.strictEqual(process.listenerCount('SIGINT'), sigIntBefore + 1, 'SIGINT listener must be attached');
  t6Engine.unbindSignalHandlers();
  assert.strictEqual(process.listenerCount('SIGINT'), sigIntBefore, 'SIGINT listener must be cleanly detached');
  console.log('  [PASS 6] Signal handler binding and detachment verified with zero listener leaks.');

  console.log('\n========================================================================');
  console.log('=== ALL 6 P1.6 TRANSACTIONAL AUDIT TESTS PASSED (100%) ===');
  console.log('========================================================================\n');
} finally {
  fs.rmSync(testSandbox, { recursive: true, force: true });
}
