/**
 * promote-inventoryhub-g33.js
 * 
 * Executes the controlled local promotion of InventoryHub to Evocara v0.4.0 GA:
 * 1. Creates an atomic backup point in InventoryHub/backups/backup_g33_pre_promotion_<timestamp>/.
 * 2. Runs npm install with the exact local tarball evocara-0.4.0.tgz.
 * 3. Updates opencode.json MCP configuration to evocara.
 * 4. Executes the 34 business tests of InventoryHub.
 * 5. Writes operation_manifest.json with complete provenance and rollback instructions.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const EVOCARA_ROOT = path.resolve(__dirname, '../..');
const INVENTORYHUB_ROOT = path.resolve(EVOCARA_ROOT, '..', 'InventoryHub');
const TARBALL_PATH = path.join(EVOCARA_ROOT, '.work/artifacts/evocara-0.4.0.tgz');

console.log('=== G33 CONTROLLED PROMOTION OF INVENTORYHUB TO EVOCARA v0.4.0 GA ===\n');

function hashFile(filepath) {
  const buf = fs.readFileSync(filepath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// 1. Verify GA Tarball
const tarballHash = hashFile(TARBALL_PATH);
const EXPECTED_HASH = '70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a';
if (tarballHash !== EXPECTED_HASH) {
  console.error('FATAL: Tarball checksum mismatch before promotion!');
  process.exit(1);
}
console.log('[PASS] GA tarball verified:', tarballHash);

// 2. Create Pre-promotion Backup in InventoryHub
const timestamp = Date.now();
const backupDir = path.join(INVENTORYHUB_ROOT, 'backups', `backup_g33_promo_${timestamp}`);
fs.mkdirSync(backupDir, { recursive: true });

const filesToBackup = ['package.json', 'package-lock.json', 'opencode.json', 'operation_manifest.json'];
for (const file of filesToBackup) {
  const src = path.join(INVENTORYHUB_ROOT, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(backupDir, file));
  }
}
console.log('[PASS] Pre-promotion backup created in:', backupDir);

// 3. Execute npm install in InventoryHub
console.log('Installing Evocara v0.4.0 GA tarball via npm...');
const relTarball = 'file:../OpenMemory/.work/artifacts/evocara-0.4.0.tgz';

// We run npm install with the local tarball path
execSync(`npm install "${TARBALL_PATH}" --no-audit --no-fund`, { cwd: INVENTORYHUB_ROOT, stdio: 'inherit' });

// Ensure package.json uses clean relative path
const pkgPath = path.join(INVENTORYHUB_ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
delete pkg.dependencies.openmemory;
pkg.dependencies.evocara = 'file:../OpenMemory/.work/artifacts/evocara-0.4.0.tgz';
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// Update opencode.json MCP entry
const opencodePath = path.join(INVENTORYHUB_ROOT, 'opencode.json');
const opencode = JSON.parse(fs.readFileSync(opencodePath, 'utf8'));
opencode.mcp = opencode.mcp || {};
opencode.mcp.openmemory = {
  type: 'local',
  command: ['node', 'node_modules/evocara/dist/mcp.js']
};
opencode.mcp.evocara = {
  type: 'local',
  command: ['node', 'node_modules/evocara/dist/mcp.js']
};
fs.writeFileSync(opencodePath, JSON.stringify(opencode, null, 2) + '\n', 'utf8');

// 4. Verify installed module
const installedPkgPath = path.join(INVENTORYHUB_ROOT, 'node_modules/evocara/package.json');
if (!fs.existsSync(installedPkgPath)) {
  console.error('FATAL: node_modules/evocara not found after npm install!');
  process.exit(1);
}
const installedPkg = JSON.parse(fs.readFileSync(installedPkgPath, 'utf8'));
console.log(`[PASS] Installed package confirmed: ${installedPkg.name}@${installedPkg.version}`);

// 5. Execute 34 Business Tests in InventoryHub
console.log('\n--- EXECUTING POST-PROMOTION BUSINESS TESTS ON INVENTORYHUB ---');
const out1 = execSync('node test_phase_2c4_post_cleanup.mjs', { cwd: INVENTORYHUB_ROOT }).toString();
const pass1 = (out1.match(/\[PASS \d+\]/g) || []).length;
console.log(`test_phase_2c4_post_cleanup.mjs: ${pass1}/10 checks passed`);

const out2 = execSync('node test_phase_2c2_full.js', { cwd: INVENTORYHUB_ROOT }).toString();
const pass2 = (out2.match(/\[PASS \d+\]/g) || []).length;
console.log(`test_phase_2c2_full.js: ${pass2}/24 checks passed`);

// Check inventory-data.json
const legacyJsonExists = fs.existsSync(path.join(INVENTORYHUB_ROOT, 'inventory-data.json'));
console.log('inventory-data.json is absent (mandatory):', !legacyJsonExists);

if (pass1 !== 10 || pass2 !== 24 || legacyJsonExists) {
  console.error('FATAL: Business tests regression detected on promoted environment!');
  process.exit(1);
}

// 6. Record operation manifest in InventoryHub
const manifest = {
  version: 1,
  operationId: `promo_g33_${timestamp}`,
  timestamp: new Date().toISOString(),
  state: 'COMMITTED',
  consumerPath: INVENTORYHUB_ROOT,
  targetCandidate: '0.4.0',
  targetTarball: TARBALL_PATH,
  targetTarballHash: tarballHash,
  targetTarballSize: 209910,
  installedPackage: 'evocara',
  installedVersion: '0.4.0',
  previousDependency: 'openmemory-0.3.14-rc4',
  previousDependencySpecifier: 'file:../../../../../Downloads/OpenMemory/.work/artifacts/openmemory-0.3.14-rc4.tgz',
  backupDirectory: backupDir,
  testResults: {
    test_phase_2c4_post_cleanup: `${pass1}/10`,
    test_phase_2c2_full: `${pass2}/24`,
    total: `${pass1 + pass2}/34`,
    legacyJsonAbsent: !legacyJsonExists
  },
  rollbackInstructions: {
    step1: `cp "${path.join(backupDir, 'package.json')}" "${pkgPath}"`,
    step2: `cp "${path.join(backupDir, 'opencode.json')}" "${opencodePath}"`,
    step3: `cd "${INVENTORYHUB_ROOT}" && npm install`
  }
};

fs.writeFileSync(path.join(INVENTORYHUB_ROOT, 'operation_manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('[PASS] Operation manifest written to InventoryHub/operation_manifest.json');

// Save evidence in OpenMemory/.work/evidence/
const evidencePath = path.join(EVOCARA_ROOT, '.work/evidence/g33-inventoryhub-promotion-results.json');
fs.writeFileSync(evidencePath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('[PASS] Evidence written to OpenMemory/.work/evidence/g33-inventoryhub-promotion-results.json');

console.log('\n============================================================');
console.log('=== INVENTORYHUB PROMOTION TO EVOCARA v0.4.0 COMPLETE (34/34 PASS) ===');
console.log('============================================================\n');
