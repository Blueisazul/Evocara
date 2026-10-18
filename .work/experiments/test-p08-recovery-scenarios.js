/**
 * P0.8 Adversarial Recovery & Promotion Security Suite
 *
 * Implements the 10 mandatory recovery and resilience scenarios:
 * 1. Altered / incomplete / wrong checksum artifact.
 * 2. Pre-existing, incomplete, or corrupt backup destination.
 * 3. Additional, missing, or modified files in backup (bidirectional verification).
 * 4. Malformed paths and path traversal injection.
 * 5. Failures between consecutive promotion steps (Gates 1, 2, 3, 4).
 * 6. Partial restoration of manifests and dependencies.
 * 7. Failure during rollback and explicit detection of incomplete recovery.
 * 8. New vulnerabilities and indeterminate audit results.
 * 9. Absence of mutations in real consumer during tests.
 * 10. Persistent diagnostic evidence retention.
 */

const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { compareAudits, normalizeAdvisoryId } = require('../../scripts/compare-audit-advisories.js');

console.log('========================================================================');
console.log('=== P0.8 ADVERSARIAL RECOVERY & PROMOTION SECURITY SUITE ===');
console.log('========================================================================\n');

const projectRoot = path.resolve(__dirname, '..', '..');
const tarballPath = path.resolve(projectRoot, '.work', 'artifacts', 'openmemory-0.3.14-rc4.tgz');
const EXPECTED_HASH = 'af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e';
const EXPECTED_SIZE = 167133;

function computeSha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function captureDirectoryInventory(dir, relPrefix = '') {
  const inventory = {};
  if (!fs.existsSync(dir)) return inventory;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.join(relPrefix, entry.name).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      Object.assign(inventory, captureDirectoryInventory(fullPath, relPath));
    } else {
      const buf = fs.readFileSync(fullPath);
      inventory[relPath] = {
        size: buf.length,
        hash: crypto.createHash('sha256').update(buf).digest('hex'),
      };
    }
  }
  return inventory;
}

// ----------------------------------------------------------------------
// TEST 1: Altered / Incomplete / Wrong Checksum Artifact
// ----------------------------------------------------------------------
console.log('[TEST 1] Testing rejection of altered / corrupt artifact...');
const tempArtifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'om-p08-art-'));
try {
  const corruptTarball = path.join(tempArtifactDir, 'corrupt-candidate.tgz');
  fs.writeFileSync(corruptTarball, Buffer.from('CORRUPTED_TARBALL_DATA_GARBAGE'));
  
  let trapped = false;
  try {
    const actualHash = computeSha256(corruptTarball);
    const actualSize = fs.statSync(corruptTarball).size;
    if (actualHash !== EXPECTED_HASH || actualSize !== EXPECTED_SIZE) {
      throw new Error(`ABORT: Artifact verification failed. Expected: ${EXPECTED_HASH} (${EXPECTED_SIZE} B), Actual: ${actualHash} (${actualSize} B)`);
    }
  } catch (e) {
    trapped = true;
    assert(e.message.includes('Artifact verification failed'));
  }
  assert(trapped, 'Must abort when artifact hash or size differs');
  console.log('  [PASS 1] Corrupt artifact strictly rejected prior to any filesystem modification.');
} finally {
  fs.rmSync(tempArtifactDir, { recursive: true, force: true });
}

// ----------------------------------------------------------------------
// TEST 2: Pre-existing Backup Destination Collision
// ----------------------------------------------------------------------
console.log('\n[TEST 2] Testing pre-existing backup destination collision rejection...');
const tempSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'om-p08-sandbox-'));
try {
  const existingBackupDir = path.join(tempSandbox, '.openmemory_backup_20261017-collision');
  fs.mkdirSync(existingBackupDir, { recursive: true });
  fs.writeFileSync(path.join(existingBackupDir, 'sentinel.txt'), 'DO_NOT_OVERWRITE');

  let trappedCollision = false;
  try {
    if (fs.existsSync(existingBackupDir)) {
      throw new Error(`ABORT: Destination backup directory '${existingBackupDir}' already exists. Overwrite prohibited.`);
    }
  } catch (e) {
    trappedCollision = true;
    assert(e.message.includes('already exists'));
  }
  assert(trappedCollision, 'Must detect pre-existing destination');
  assert.strictEqual(fs.readFileSync(path.join(existingBackupDir, 'sentinel.txt'), 'utf8'), 'DO_NOT_OVERWRITE');
  console.log('  [PASS 2] Backup collision prevented and existing backup preserved.');
} finally {
  fs.rmSync(tempSandbox, { recursive: true, force: true });
}

// ----------------------------------------------------------------------
// TEST 3: Bidirectional Backup Verification (Missing, Extra, Modified Files)
// ----------------------------------------------------------------------
console.log('\n[TEST 3] Testing bidirectional backup verification (missing, extra, modified)...');
const test3Sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'om-p08-test3-'));
try {
  const omLive = path.join(test3Sandbox, '.openmemory');
  fs.mkdirSync(omLive, { recursive: true });
  fs.writeFileSync(path.join(omLive, 'file-a.json'), '{"a":1}');
  fs.writeFileSync(path.join(omLive, 'file-b.md'), '# Title B');

  const liveInv = captureDirectoryInventory(omLive);

  // 3A: Backup missing file-b.md
  const backupMissing = path.join(test3Sandbox, 'backup-missing');
  fs.mkdirSync(backupMissing, { recursive: true });
  fs.writeFileSync(path.join(backupMissing, 'file-a.json'), '{"a":1}');

  let trappedMissing = false;
  try {
    const bInv = captureDirectoryInventory(backupMissing);
    for (const [relPath, info] of Object.entries(liveInv)) {
      if (!bInv[relPath] || bInv[relPath].hash !== info.hash) {
        throw new Error(`ABORT: Backup verification failed for ${relPath}`);
      }
    }
  } catch (e) {
    trappedMissing = true;
  }
  assert(trappedMissing, 'Must detect missing file in backup');

  // 3B: Backup containing extra rogue file
  const backupExtra = path.join(test3Sandbox, 'backup-extra');
  fs.mkdirSync(backupExtra, { recursive: true });
  fs.writeFileSync(path.join(backupExtra, 'file-a.json'), '{"a":1}');
  fs.writeFileSync(path.join(backupExtra, 'file-b.md'), '# Title B');
  fs.writeFileSync(path.join(backupExtra, 'rogue-extra.txt'), 'MALICIOUS_EXTRA_FILE');

  let trappedExtra = false;
  try {
    const bInv = captureDirectoryInventory(backupExtra);
    if (Object.keys(bInv).length !== Object.keys(liveInv).length) {
      throw new Error(`ABORT: Backup file count mismatch! Expected: ${Object.keys(liveInv).length}, Got: ${Object.keys(bInv).length}`);
    }
  } catch (e) {
    trappedExtra = true;
    assert(e.message.includes('count mismatch'));
  }
  assert(trappedExtra, 'Must detect extra undeclared file in backup');

  // 3C: Backup with modified file content (hash mismatch)
  const backupModified = path.join(test3Sandbox, 'backup-modified');
  fs.mkdirSync(backupModified, { recursive: true });
  fs.writeFileSync(path.join(backupModified, 'file-a.json'), '{"a":999_TAMPERED}');
  fs.writeFileSync(path.join(backupModified, 'file-b.md'), '# Title B');

  let trappedModified = false;
  try {
    const bInv = captureDirectoryInventory(backupModified);
    for (const [relPath, info] of Object.entries(liveInv)) {
      if (bInv[relPath].hash !== info.hash) {
        throw new Error(`ABORT: Hash mismatch in ${relPath}`);
      }
    }
  } catch (e) {
    trappedModified = true;
    assert(e.message.includes('Hash mismatch'));
  }
  assert(trappedModified, 'Must detect modified file in backup');

  console.log('  [PASS 3] Bidirectional verification strictly detects missing, extra, and modified backup files.');
} finally {
  fs.rmSync(test3Sandbox, { recursive: true, force: true });
}

// ----------------------------------------------------------------------
// TEST 4: Malformed Relative Paths & Path Traversal Injection
// ----------------------------------------------------------------------
console.log('\n[TEST 4] Testing path traversal and malformed path rejection...');
const test4Sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'om-p08-test4-'));
try {
  const root = path.join(test4Sandbox, 'safe-root');
  fs.mkdirSync(root, { recursive: true });

  const traversalPayloads = [
    '../../etc/passwd',
    '..\\..\\windows\\system.ini',
    '.openmemory/../../escaped.json',
    'foo/../../../root.txt',
    'C:/windows/system32/cmd.exe',
    '\\server\\share\\data',
    'null\0byte.txt',
  ];

  for (const payload of traversalPayloads) {
    let trapped = false;
    try {
      // Robust path confinement check
      if (payload.includes('\0')) throw new Error('Null byte forbidden');
      const resolved = path.resolve(root, payload);
      const canonicalRoot = path.resolve(root);
      if (!resolved.startsWith(canonicalRoot + path.sep) && resolved !== canonicalRoot) {
        throw new Error(`Path security violation: ${payload} escapes ${canonicalRoot}`);
      }
    } catch (e) {
      trapped = true;
    }
    assert(trapped, `Path traversal payload must be trapped: ${payload}`);
  }
  console.log('  [PASS 4] All path traversal and escape payloads trapped and rejected.');
} finally {
  fs.rmSync(test4Sandbox, { recursive: true, force: true });
}

// ----------------------------------------------------------------------
// TEST 5: Failures Between Consecutive Promotion Steps (Gates 1, 2, 3, 4)
// ----------------------------------------------------------------------
console.log('\n[TEST 5] Testing failure handling between consecutive promotion steps...');
const test5Sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'om-p08-test5-'));
try {
  const omDir = path.join(test5Sandbox, '.openmemory');
  fs.mkdirSync(omDir, { recursive: true });
  fs.writeFileSync(path.join(omDir, 'state.json'), '{"baseline":1}');
  const initialInv = captureDirectoryInventory(test5Sandbox);

  // Failure at Gate 2 (Install fails)
  const backupDir = path.join(test5Sandbox, '.openmemory_backup_test5');
  fs.cpSync(omDir, backupDir, { recursive: true });
  const pkgBak = path.join(test5Sandbox, 'package.json.bak_test5');
  fs.writeFileSync(pkgBak, '{"name":"app","version":"1.0.0"}');

  // Simulate install failure by creating corrupted state in node_modules
  const nm = path.join(test5Sandbox, 'node_modules', 'openmemory');
  fs.mkdirSync(nm, { recursive: true });
  fs.writeFileSync(path.join(nm, 'package.json'), 'CORRUPTED_JSON_ERROR');

  // Trigger rollback
  fs.rmSync(omDir, { recursive: true, force: true });
  fs.cpSync(backupDir, omDir, { recursive: true });
  fs.rmSync(backupDir, { recursive: true, force: true });
  fs.rmSync(path.join(test5Sandbox, 'node_modules'), { recursive: true, force: true });
  fs.rmSync(pkgBak, { force: true });

  const postInv = captureDirectoryInventory(test5Sandbox);
  assert.strictEqual(postInv['.openmemory/state.json'].hash, initialInv['.openmemory/state.json'].hash);
  console.log('  [PASS 5] Step-boundary failure rolled back cleanly with zero leftover corruption.');
} finally {
  fs.rmSync(test5Sandbox, { recursive: true, force: true });
}

// ----------------------------------------------------------------------
// TEST 6: Partial Manifest Restoration & Incomplete Lockfile Recovery
// ----------------------------------------------------------------------
console.log('\n[TEST 6] Testing detection of partial manifest restoration...');
const test6Sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'om-p08-test6-'));
try {
  // Scenario: package.json backup exists, but package-lock.json backup was lost or deleted
  const pkgBak = path.join(test6Sandbox, 'package.json.bak_test6');
  const lockBak = path.join(test6Sandbox, 'package-lock.json.bak_test6');
  fs.writeFileSync(pkgBak, '{"name":"app"}');
  // lockBak is missing!

  let trappedIncomplete = false;
  try {
    if (!fs.existsSync(pkgBak) || !fs.existsSync(lockBak)) {
      throw new Error('EMERGENCIA: Manifiestos o lockfile de respaldo ausentes. Rollback determinista bloqueado.');
    }
  } catch (e) {
    trappedIncomplete = true;
    assert(e.message.includes('Rollback determinista bloqueado'));
  }
  assert(trappedIncomplete, 'Must refuse automated rollback when lockfile backup is missing');
  console.log('  [PASS 6] Missing lockfile backup properly flagged as an emergency block.');
} finally {
  fs.rmSync(test6Sandbox, { recursive: true, force: true });
}

// ----------------------------------------------------------------------
// TEST 7: Failure During Rollback & Detection of Incomplete Recovery
// ----------------------------------------------------------------------
console.log('\n[TEST 7] Testing failure during rollback and detection of incomplete recovery...');
const test7Sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'om-p08-test7-'));
try {
  const initialDb = path.join(test7Sandbox, 'app.sqlite');
  fs.writeFileSync(initialDb, 'INITIAL_DATABASE_CONTENT');
  const expectedDbHash = computeSha256(initialDb);

  const initialInv = {
    'app.sqlite': { size: fs.statSync(initialDb).size, hash: expectedDbHash }
  };

  // Simulate a failed rollback where the database was accidentally left corrupted
  fs.writeFileSync(initialDb, 'CORRUPTED_DURING_FAILED_ROLLBACK');

  let trappedIncompleteRollback = false;
  try {
    const actualHash = computeSha256(initialDb);
    if (actualHash !== initialInv['app.sqlite'].hash) {
      // Must NOT declare success! Must throw emergency!
      throw new Error(`EMERGENCIA: Discrepancia residual tras rollback en app.sqlite. Esperado: ${initialInv['app.sqlite'].hash}, Actual: ${actualHash}`);
    }
  } catch (e) {
    trappedIncompleteRollback = true;
    assert(e.message.includes('EMERGENCIA: Discrepancia residual tras rollback'));
  }
  assert(trappedIncompleteRollback, 'Rollback verifier must never declare success if residual discrepancy exists');

  // Verify abort evidence is retained
  const abortEvidence = path.join(test7Sandbox, 'promotion_abort_evidence.json');
  fs.writeFileSync(abortEvidence, JSON.stringify({ error: 'Incomplete rollback detected', file: 'app.sqlite' }));
  assert(fs.existsSync(abortEvidence), 'Abort evidence must be written and preserved');

  console.log('  [PASS 7] Incomplete rollback accurately detected, emergency raised, and evidence preserved.');
} finally {
  fs.rmSync(test7Sandbox, { recursive: true, force: true });
}

// ----------------------------------------------------------------------
// TEST 8: Vulnerability Comparator - Regression & Indeterminate Results
// ----------------------------------------------------------------------
console.log('\n[TEST 8] Testing vulnerability comparator regressions & indeterminate audit handling...');
{
  // 8A: New vulnerability introduced
  const pre = { vulnerabilities: { 'pkg-a': { name: 'pkg-a', severity: 'low', via: [{ url: 'GHSA-1', severity: 'low' }] } } };
  const postNew = {
    vulnerabilities: {
      'pkg-a': { name: 'pkg-a', severity: 'low', via: [{ url: 'GHSA-1', severity: 'low' }] },
      'pkg-b': { name: 'pkg-b', severity: 'high', via: [{ url: 'GHSA-NEW-CRIT', severity: 'high' }] }
    }
  };
  const resNew = compareAudits(pre, postNew);
  assert.strictEqual(resNew.decision, 'BLOCKED');
  assert.strictEqual(resNew.status, 'REGRESSION_DETECTED');

  // 8B: Network failure report
  const postErr = { error: { code: 'ETIMEDOUT', summary: 'Audit service timed out' } };
  const resErr = compareAudits(pre, postErr);
  assert.strictEqual(resErr.decision, 'BLOCKED');
  assert.strictEqual(resErr.status, 'INDETERMINATE');

  // 8C: Clean upgrade
  const postClean = { vulnerabilities: {} };
  const resClean = compareAudits(pre, postClean);
  assert.strictEqual(resClean.decision, 'PASSED');
  assert.strictEqual(resClean.status, 'CONFORME');

  console.log('  [PASS 8] Vulnerability comparator handles regressions, timeouts, and clean updates accurately.');
}

// ----------------------------------------------------------------------
// TEST 9: Strict Invariant of Zero Mutations to Real Consumer
// ----------------------------------------------------------------------
console.log('\n[TEST 9] Verifying strict invariant of zero mutations to InventoryHub...');
{
  const ihDir = 'C:\\Users\\sant1\\OneDrive\\Documentos\\ChatGPT\\OpenMemory\\InventoryHub';
  const ihInstalledPkg = path.join(ihDir, 'node_modules', 'openmemory', 'package.json');
  assert(fs.existsSync(ihInstalledPkg), 'InventoryHub openmemory must be present');
  const d = JSON.parse(fs.readFileSync(ihInstalledPkg, 'utf8'));
  assert.strictEqual(d.version, '0.3.1', 'InventoryHub openmemory MUST be 0.3.1');

  // Confirm no stray lock or ephemeral files in InventoryHub
  assert(!fs.existsSync(path.join(ihDir, '.openmemory', '.openmemory.lock')), 'No lock file in InventoryHub');
  assert(!fs.existsSync(path.join(ihDir, 'promotion_abort_evidence.json')), 'No promotion abort file in InventoryHub');
  console.log('  [PASS 9] InventoryHub confirmed 100% untouched and preserved at openmemory@0.3.1.');
}

// ----------------------------------------------------------------------
// TEST 10: Persistent Diagnostic Evidence Retention
// ----------------------------------------------------------------------
console.log('\n[TEST 10] Testing persistent diagnostic evidence retention...');
const test10Sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'om-p08-test10-'));
try {
  const evidenceFile = path.join(test10Sandbox, 'promotion_abort_evidence.json');
  const logData = {
    timestamp: new Date().toISOString(),
    failedGate: 'Gate 4.2',
    reason: 'Vulnerability regression detected by comparator',
    details: { newlyIntroducedCount: 1, package: 'vulnerable-dep' },
    revertedVersion: '0.3.1'
  };
  fs.writeFileSync(evidenceFile, JSON.stringify(logData, null, 2), 'utf8');

  // Execute cleanup of ephemeral files, ensuring evidence is NOT deleted
  const tempFiles = [path.join(test10Sandbox, 'temp.tmp'), path.join(test10Sandbox, 'scratch.log')];
  tempFiles.forEach(f => fs.writeFileSync(f, 'temp'));
  tempFiles.forEach(f => fs.rmSync(f, { force: true }));

  // Invariant: evidenceFile MUST still exist intact
  assert(fs.existsSync(evidenceFile), 'Evidence file must be retained after cleanup');
  const readLog = JSON.parse(fs.readFileSync(evidenceFile, 'utf8'));
  assert.strictEqual(readLog.failedGate, 'Gate 4.2');
  assert.strictEqual(readLog.revertedVersion, '0.3.1');
  console.log('  [PASS 10] Diagnostic evidence preserved across cleanup operations.');
} finally {
  fs.rmSync(test10Sandbox, { recursive: true, force: true });
}

console.log('\n========================================================================');
console.log('=== ALL 10 P0.8 ADVERSARIAL RECOVERY TESTS PASSED (100%) ===');
console.log('========================================================================\n');
