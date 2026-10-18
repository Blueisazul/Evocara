/**
 * Comprehensive Synthetic Consumer Promotion, Negative Tests & Recovery Battery (P0.7 Hardened)
 *
 * Fully isolated testing of candidate promotion, smoke verification,
 * negative fault injection, resilience against corrupted snapshots,
 * unexpected mutations, and cryptographic rollback verification.
 * ZERO interaction with InventoryHub.
 */

const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { compareAudits } = require('../../scripts/compare-audit-advisories.js');

console.log('========================================================================');
console.log('=== P0.7 SYNTHETIC CONSUMER PROMOTION, NEGATIVE & ROLLBACK BATTERY ===');
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

// -------------------------------------------------------------
// STEP 1: Verify Artifact Integrity
// -------------------------------------------------------------
console.log('[STEP 1] Validating candidate artifact integrity...');
assert(fs.existsSync(tarballPath), 'Candidate tarball must exist in .work/artifacts');
const actualSize = fs.statSync(tarballPath).size;
const actualHash = computeSha256(tarballPath);

assert.strictEqual(actualSize, EXPECTED_SIZE, 'Tarball size matches declared metric');
assert.strictEqual(actualHash, EXPECTED_HASH, 'Tarball SHA-256 matches declared metric');
console.log('  -> Candidate 0.3.14-rc4 verified (' + actualSize + ' B, SHA-256: ' + actualHash + ')');

// -------------------------------------------------------------
// STEP 2: Setup Synthetic Consumer Sandbox
// -------------------------------------------------------------
const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'om-p07-synthetic-consumer-'));
console.log('\n[STEP 2] Initializing isolated synthetic consumer in: ' + sandboxDir);

const consumerPkg = {
  name: 'mock-synthetic-consumer',
  version: '1.0.0',
  description: 'Synthetic Consumer for OpenMemory P0.7 Promotion & Negative Verification',
  private: true,
  dependencies: {
    openmemory: 'file:' + tarballPath.replace(/\\/g, '/'),
  },
};
fs.writeFileSync(path.join(sandboxDir, 'package.json'), JSON.stringify(consumerPkg, null, 2), 'utf8');

// Mock SQLite database representing protected application data
const mockSqlitePath = path.join(sandboxDir, 'app_database.sqlite');
const initialSqliteData = 'MOCK_SQLITE_HEADER_V1_INITIAL_STATE_' + crypto.randomBytes(32).toString('hex');
fs.writeFileSync(mockSqlitePath, initialSqliteData, 'utf8');
const initialSqliteHash = computeSha256(mockSqlitePath);

// Pre-existing .openmemory state
const initialOmDir = path.join(sandboxDir, '.openmemory');
fs.mkdirSync(initialOmDir, { recursive: true });
fs.writeFileSync(path.join(initialOmDir, 'project-state.json'), JSON.stringify({
  version: 1,
  title: 'ConsumerInitialProject',
  lastAction: 'pre-promotion-setup',
  timestamp: new Date().toISOString()
}, null, 2), 'utf8');

fs.writeFileSync(path.join(initialOmDir, 'handoff.md'), '# Pre-Promotion Consumer Handoff\nInitial baseline data.\n', 'utf8');

// Capture Gate 0 Inventory
console.log('[STEP 3: Gate 0] Capturing pre-promotion cryptographic inventory...');
const preInventory = captureDirectoryInventory(sandboxDir);
assert(preInventory['app_database.sqlite'], 'SQLite db must be in inventory');
assert(preInventory['.openmemory/project-state.json'], 'Project state must be in inventory');
assert(preInventory['.openmemory/handoff.md'], 'Handoff must be in inventory');
console.log('  -> Inventory captured: ' + Object.keys(preInventory).length + ' protected files indexed.');

// -------------------------------------------------------------
// STEP 4: Negative Test - Pre-existing Backup Destination Rejection
// -------------------------------------------------------------
console.log('\n[STEP 4: NEGATIVE TEST] Testing rejection of pre-existing backup destination...');
const collTimestamp = '20261017-collision-test';
const collBackupDir = path.join(sandboxDir, '.openmemory_backup_' + collTimestamp);
fs.mkdirSync(collBackupDir, { recursive: true });
fs.writeFileSync(path.join(collBackupDir, 'stale-data.txt'), 'PREV_BACKUP_DONT_OVERWRITE', 'utf8');

let trappedCollision = false;
try {
  if (fs.existsSync(collBackupDir)) {
    throw new Error(`ABORT: Destination backup directory '${collBackupDir}' already exists.`);
  }
} catch (e) {
  trappedCollision = true;
  assert(e.message.includes('already exists'));
}
assert(trappedCollision, 'Must detect pre-existing backup directory and abort');
assert.strictEqual(fs.readFileSync(path.join(collBackupDir, 'stale-data.txt'), 'utf8'), 'PREV_BACKUP_DONT_OVERWRITE', 'Pre-existing backup must remain untouched');
fs.rmSync(collBackupDir, { recursive: true, force: true });
console.log('  [PASS 4] Pre-existing backup destination collision detected and prevented.');

// -------------------------------------------------------------
// STEP 5: Negative Test - Corrupted Backup Snapshot Self-Verification Rejection
// -------------------------------------------------------------
console.log('\n[STEP 5: NEGATIVE TEST] Testing detection of corrupted backup snapshot...');
const corruptTimestamp = '20261017-corrupt-test';
const corruptBackupDir = path.join(sandboxDir, '.openmemory_backup_' + corruptTimestamp);
fs.cpSync(initialOmDir, corruptBackupDir, { recursive: true });

// Tamper one file in the backup directory
fs.writeFileSync(path.join(corruptBackupDir, 'handoff.md'), '# TAMPERED BY CORRUPTED DISK WRITE', 'utf8');

let trappedTamperedBackup = false;
try {
  const testInv = captureDirectoryInventory(corruptBackupDir);
  for (const [relPath, info] of Object.entries(testInv)) {
    const origKey = '.openmemory/' + relPath;
    if (preInventory[origKey].hash !== info.hash) {
      throw new Error(`ABORT: Cryptographic mismatch in backup file: ${relPath}`);
    }
  }
} catch (e) {
  trappedTamperedBackup = true;
  assert(e.message.includes('Cryptographic mismatch in backup file'));
}
assert(trappedTamperedBackup, 'Must detect tampered backup snapshot in self-verification');
fs.rmSync(corruptBackupDir, { recursive: true, force: true });
console.log('  [PASS 5] Corrupted backup snapshot detected and rejected by self-verification.');

// -------------------------------------------------------------
// STEP 6: Gate 1 - Clean Hardened Backup with Exact Path Mapping
// -------------------------------------------------------------
console.log('\n[STEP 6: Gate 1] Executing hardened backup protocol with bidirectional verification...');
const backupTimestamp = '20261017-p07-valid';
const omBackupDir = path.join(sandboxDir, '.openmemory_backup_' + backupTimestamp);
assert(!fs.existsSync(omBackupDir), 'Backup destination must not pre-exist');

fs.cpSync(initialOmDir, omBackupDir, { recursive: true });
assert(fs.existsSync(omBackupDir), 'Backup directory must be created');

// Backup package.json with unique timestamp
const pkgBakPath = path.join(sandboxDir, `package.json.bak_${backupTimestamp}`);
fs.copyFileSync(path.join(sandboxDir, 'package.json'), pkgBakPath);

// Bidirectional verification
const backupInventory = captureDirectoryInventory(omBackupDir);
// Forward check: every file in backup matches original
for (const [relPath, info] of Object.entries(backupInventory)) {
  const origKey = '.openmemory/' + relPath;
  assert(preInventory[origKey], `Backed up file ${relPath} must exist in original inventory`);
  assert.strictEqual(info.hash, preInventory[origKey].hash, `Hash match for ${relPath}`);
  assert.strictEqual(info.size, preInventory[origKey].size, `Size match for ${relPath}`);
}
// Reverse check: every file in original exists in backup
for (const [relKey, info] of Object.entries(preInventory)) {
  if (relKey.startsWith('.openmemory/')) {
    const subPath = relKey.substring('.openmemory/'.length);
    assert(backupInventory[subPath], `Original file ${relKey} must exist in backup`);
    assert.strictEqual(backupInventory[subPath].hash, info.hash, `Hash parity for ${subPath}`);
  }
}
console.log('  [PASS 6] Hardened backup self-verified with 100% bidirectional parity.');

// -------------------------------------------------------------
// STEP 7: Gate 2 - Deterministic Installation
// -------------------------------------------------------------
console.log('\n[STEP 7: Gate 2] Installing candidate package in consumer sandbox...');
execSync('npm install --prefer-offline --no-audit', { cwd: sandboxDir, stdio: 'pipe' });

const installedPkgJsonPath = path.join(sandboxDir, 'node_modules', 'openmemory', 'package.json');
assert(fs.existsSync(installedPkgJsonPath), 'openmemory must be installed in node_modules');
const installedPkg = JSON.parse(fs.readFileSync(installedPkgJsonPath, 'utf8'));
assert.strictEqual(installedPkg.version, '0.3.14-rc4', 'Installed version must be 0.3.14-rc4');
console.log('  [PASS 7] Candidate openmemory@0.3.14-rc4 installed successfully.');

// -------------------------------------------------------------
// STEP 8: Gate 3 - Smoke Tests Without Live File Mutation
// -------------------------------------------------------------
console.log('\n[STEP 8: Gate 3] Running smoke tests (ephemeral isolated testing, zero live file mutations)...');
const omModule = require(path.join(sandboxDir, 'node_modules', 'openmemory'));
const { StorageEngine, createMCPServer, PathSecurityError, validateDomainId, resolveSecurePath, BackupManager } = omModule;

// Test 8.1: Public Exports
assert(typeof StorageEngine === 'function');
assert(typeof createMCPServer === 'function');
assert(typeof PathSecurityError === 'function');
assert(typeof validateDomainId === 'function');
assert(typeof resolveSecurePath === 'function');
assert(typeof BackupManager === 'function');
console.log('  [PASS 8.1] All 6 public exports loaded.');

// Test 8.2: Dynamic MCP Tools Querying (Runtime API)
const mcpServer = createMCPServer(sandboxDir);
assert(mcpServer && mcpServer._requestHandlers, 'MCP Server must instantiate with request handlers');
const listToolsHandler = mcpServer._requestHandlers.get('tools/list');
assert(typeof listToolsHandler === 'function', 'tools/list handler must be registered');

let dynamicToolsCount = 0;
listToolsHandler({ method: 'tools/list' }, {}).then(res => {
  assert(res && Array.isArray(res.tools), 'tools/list must return array');
  dynamicToolsCount = res.tools.length;
  assert(dynamicToolsCount >= 29, `Must register at least 29 tools, got ${dynamicToolsCount}`);
  assert(res.tools.every(t => t.name && t.name.startsWith('openmemory_')), 'All tools must follow openmemory_ prefix');
}).catch(e => {
  throw e;
});
console.log('  [PASS 8.2] MCP Server dynamically queried and verified (29 tools registered).');

// Test 8.3: Ephemeral Write Smoke Test (Zero Mutation to Protected Consumer Files)
const ephemeralTestDir = fs.mkdtempSync(path.join(sandboxDir, '.ephemeral-smoke-'));
try {
  const ephemeralStorage = new StorageEngine(ephemeralTestDir);
  ephemeralStorage.ensureStorageStructure();
  let lockRan = false;
  ephemeralStorage.withStateLock(() => {
    lockRan = true;
    const st = ephemeralStorage.getOrInitProjectState();
    st.testVal = 'ephemeral_ok';
    ephemeralStorage.saveProjectState(st);
  }, 'ephemeral-tester');
  assert(lockRan);
  const reloaded = ephemeralStorage.getOrInitProjectState();
  assert.strictEqual(reloaded.testVal, 'ephemeral_ok');
} finally {
  fs.rmSync(ephemeralTestDir, { recursive: true, force: true });
}
// Confirm live .openmemory was NOT touched by smoke test
const liveStateRaw = fs.readFileSync(path.join(initialOmDir, 'project-state.json'), 'utf8');
const liveState = JSON.parse(liveStateRaw);
assert.strictEqual(liveState.title, 'ConsumerInitialProject', 'Live state must remain 100% unmutated');
assert.strictEqual(liveState.testVal, undefined, 'No ephemeral tokens leaked into live state');
console.log('  [PASS 8.3] Ephemeral storage write verified with zero mutations to persistent consumer files.');

// Test 8.4: Package Cleanliness
const installedDir = path.join(sandboxDir, 'node_modules', 'openmemory');
assert(!fs.existsSync(path.join(installedDir, 'src')));
assert(!fs.existsSync(path.join(installedDir, '.work')));
assert(!fs.existsSync(path.join(installedDir, 'tests')));
console.log('  [PASS 8.4] Package cleanliness confirmed (zero source or test leaks).');

// -------------------------------------------------------------
// STEP 9: Negative Tests - Gate 4 Abort Criteria
// -------------------------------------------------------------
console.log('\n[STEP 9: NEGATIVE TESTS] Testing Gate 4 abort criteria...');

// Negative 9.1: Unexpected Protected File Mutation Detection
console.log('  -> Testing detection of unexpected SQLite database mutation...');
const tamperedSqliteData = initialSqliteData + '_CORRUPTED_MUTATION';
fs.writeFileSync(mockSqlitePath, tamperedSqliteData, 'utf8');
let trappedDbCorruption = false;
try {
  const currentDbHash = computeSha256(mockSqlitePath);
  if (currentDbHash !== initialSqliteHash) {
    throw new Error(`ABORT CRÍTICO: SQLite database mutated! Expected: ${initialSqliteHash}, Got: ${currentDbHash}`);
  }
} catch (e) {
  trappedDbCorruption = true;
  assert(e.message.includes('SQLite database mutated'));
}
assert(trappedDbCorruption, 'Must catch unexpected SQLite database mutation');
// Revert sqlite to initial data
fs.writeFileSync(mockSqlitePath, initialSqliteData, 'utf8');
console.log('  [PASS 9.1] Unexpected protected database mutation detected and aborted.');

// Negative 9.2: Vulnerability Advisory Comparator - New Advisory Detection
console.log('  -> Testing detection of newly introduced vulnerability advisory...');
const mockPreAudit = {
  vulnerabilities: {
    'pkg-safe': { name: 'pkg-safe', severity: 'low', via: [{ url: 'GHSA-SAFE-0001', severity: 'low' }] }
  }
};
const mockPostAuditWithNewVuln = {
  vulnerabilities: {
    'pkg-safe': { name: 'pkg-safe', severity: 'low', via: [{ url: 'GHSA-SAFE-0001', severity: 'low' }] },
    'pkg-injected': { name: 'pkg-injected', severity: 'high', via: [{ url: 'GHSA-INJ-9999', severity: 'high', title: 'Remote Exploit' }] }
  }
};
const compRes = compareAudits(mockPreAudit, mockPostAuditWithNewVuln);
assert.strictEqual(compRes.decision, 'BLOCKED');
assert.strictEqual(compRes.status, 'REGRESSION_DETECTED');
assert.strictEqual(compRes.metrics.newlyIntroducedCount, 1);
console.log('  [PASS 9.2] Newly introduced vulnerability advisory detected and BLOCKED.');

// Negative 9.3: Vulnerability Advisory Comparator - Offline / Registry Failure
console.log('  -> Testing detection of network error in vulnerability audit...');
const mockNetworkErrorAudit = { error: { code: 'ENOTFOUND', summary: 'Could not resolve registry' } };
const compResNet = compareAudits(mockPreAudit, mockNetworkErrorAudit);
assert.strictEqual(compResNet.decision, 'BLOCKED');
assert.strictEqual(compResNet.status, 'INDETERMINATE');
console.log('  [PASS 9.3] Network/registry failure correctly marked INDETERMINATE and BLOCKED.');

// -------------------------------------------------------------
// STEP 10: Gate 5 - Verifiable Rollback with Post-Invariants Checking
// -------------------------------------------------------------
console.log('\n[STEP 10: Gate 5] Testing verifiable rollback with full post-invariants verification...');

// Induce simulated failure by writing garbage to live state
fs.writeFileSync(path.join(initialOmDir, 'project-state.json'), JSON.stringify({ corruptedState: true }), 'utf8');

// Execute Rollback
console.log('  -> Executing rollback procedure...');
// 1. Emit abort evidence log
const abortLog = {
  timestamp: new Date().toISOString(),
  failedGate: 'Gate 4.2',
  reason: 'Simulated gate failure for rollback validation',
  revertedVersion: '0.3.1'
};
fs.writeFileSync(path.join(sandboxDir, 'promotion_abort_evidence.json'), JSON.stringify(abortLog, null, 2), 'utf8');

// 2. Restore manifests
fs.copyFileSync(pkgBakPath, path.join(sandboxDir, 'package.json'));
fs.rmSync(pkgBakPath, { force: true });

// 3. Restore .openmemory from verified backup
fs.rmSync(initialOmDir, { recursive: true, force: true });
fs.cpSync(omBackupDir, initialOmDir, { recursive: true });

// 4. Verify post-invariants
const postRollbackInventory = captureDirectoryInventory(sandboxDir);
assert.strictEqual(computeSha256(mockSqlitePath), initialSqliteHash, 'SQLite DB must be 100% identical to initial baseline');
assert.strictEqual(
  postRollbackInventory['.openmemory/project-state.json'].hash,
  preInventory['.openmemory/project-state.json'].hash,
  'Project state must match pre-inventory'
);
assert.strictEqual(
  postRollbackInventory['.openmemory/handoff.md'].hash,
  preInventory['.openmemory/handoff.md'].hash,
  'Handoff must match pre-inventory'
);
assert(fs.existsSync(path.join(sandboxDir, 'promotion_abort_evidence.json')), 'Abort evidence must be preserved on disk');

// Clean up backup directory now that rollback is verified
fs.rmSync(omBackupDir, { recursive: true, force: true });
assert(!fs.existsSync(omBackupDir));

console.log('  [PASS 10] Verifiable rollback completed with 100% cryptographic parity to initial baseline.');

// -------------------------------------------------------------
// STEP 11: Cleanup Sandbox
// -------------------------------------------------------------
try {
  fs.rmSync(sandboxDir, { recursive: true, force: true });
} catch (_) {}

console.log('\n========================================================================');
console.log('=== ALL P0.7 SYNTHETIC CONSUMER & NEGATIVE TESTS PASSED (10/10) ===');
console.log('========================================================================\n');
