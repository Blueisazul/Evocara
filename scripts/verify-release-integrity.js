/**
 * Automated Release Integrity and Packaging Reproducibility Verifier (P0.6)
 *
 * Verifies:
 * 1. Candidate artifact presence and cryptographic SHA-256 hash.
 * 2. Allowed files whitelist and strict exclusion of sources/tests/scratch.
 * 3. All required core distribution files and public exports.
 * 4. Independent double-packaging bit-for-bit reproducibility.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');

console.log('======================================================');
console.log('=== OPENMEMORY RELEASE INTEGRITY & REPRODUCIBILITY ===');
console.log('======================================================\n');

const projectRoot = path.resolve(__dirname, '..');
const pkgPath = path.join(projectRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

console.log('[CHECK 1] Verifying package version: ' + pkg.version);
const expectedVersion = '0.3.14-rc4';
if (pkg.version !== expectedVersion) {
  console.error('FAIL: Expected package version ' + expectedVersion + ', got ' + pkg.version);
  process.exit(1);
}
console.log('  [PASS] package.json version matches ' + expectedVersion);

// Artifact Check
const tarballPath = path.join(projectRoot, '.work', 'artifacts', 'openmemory-' + pkg.version + '.tgz');
console.log('\n[CHECK 2] Verifying candidate tarball: ' + path.basename(tarballPath));
if (!fs.existsSync(tarballPath)) {
  console.error('FAIL: Tarball not found at ' + tarballPath);
  process.exit(1);
}

const tarballBuf = fs.readFileSync(tarballPath);
const tarballSize = tarballBuf.length;
const tarballHash = crypto.createHash('sha256').update(tarballBuf).digest('hex');

const EXPECTED_HASH = 'af88fae90107dfda797c7f6bcc982cf6bbd7ef53fd9a5d887c9bf77185a35f6e';
const EXPECTED_SIZE = 167133;

console.log('  Size:   ' + tarballSize + ' bytes (Expected: ' + EXPECTED_SIZE + ')');
console.log('  SHA256: ' + tarballHash + ' (Expected: ' + EXPECTED_HASH + ')');

if (tarballSize !== EXPECTED_SIZE || tarballHash !== EXPECTED_HASH) {
  console.error('FAIL: Tarball metric mismatch!');
  process.exit(1);
}
console.log('  [PASS] Tarball identity verified cryptographically.');

// Content and Whitelist Check
console.log('\n[CHECK 3] Verifying package contents and strict whitelist...');
const inspectTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'om-verify-content-'));
try {
  execSync(`tar -xzf "${tarballPath}" -C "${inspectTmp}"`);
  const pkgDir = path.join(inspectTmp, 'package');

  function scanRel(dir, rel = '') {
    let files = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      const r = path.join(rel, ent.name).replace(/\\/g, '/');
      if (ent.isDirectory()) {
        files = files.concat(scanRel(full, r));
      } else {
        files.push(r);
      }
    }
    return files;
  }

  const packedFiles = scanRel(pkgDir);
  console.log('  Total packaged files: ' + packedFiles.length);

  if (packedFiles.length !== 69) {
    console.error('FAIL: Expected exactly 69 files in package, found ' + packedFiles.length);
    process.exit(1);
  }

  const REQUIRED_CORE_FILES = [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/storage.js',
    'dist/storage.d.ts',
    'dist/mcp.js',
    'dist/mcp.d.ts',
    'dist/storage/core/path-security.js',
    'dist/storage/core/path-security.d.ts',
    'dist/storage/core/persistence-engine.js',
    'dist/storage/core/persistence-engine.d.ts',
    'dist/storage/domains/backup-manager.js',
    'dist/storage/domains/backup-manager.d.ts',
    'dist/installer.js',
    'dist/stage-engine.js',
    'dist/cli.js',
  ];

  for (const req of REQUIRED_CORE_FILES) {
    if (!packedFiles.includes(req)) {
      console.error('FAIL: Missing required core file: ' + req);
      process.exit(1);
    }
  }
  console.log('  [PASS] All 15 required core distribution files present.');

  // Strict Exclusions Check
  const LEAK_PATTERNS = ['src/', '.work/', 'tests/', 'scripts/', 'scratch/'];
  for (const f of packedFiles) {
    for (const leak of LEAK_PATTERNS) {
      if (f.startsWith(leak)) {
        console.error('FAIL: Leaked unauthorized file: ' + f);
        process.exit(1);
      }
    }
  }
  console.log('  [PASS] Zero source, test, script, or scratch files leaked.');
} finally {
  fs.rmSync(inspectTmp, { recursive: true, force: true });
}

// Reproducibility Check
console.log('\n[CHECK 4] Testing independent double-packaging bit-for-bit reproducibility...');
const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'om-repro-test-A-'));
const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), 'om-repro-test-B-'));

try {
  const outA = execSync(`npm pack "${projectRoot}" --pack-destination="${tmpA}"`, { encoding: 'utf8' }).trim();
  const fileA = path.join(tmpA, outA.split('\n').pop().trim());

  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);

  const outB = execSync(`npm pack "${projectRoot}" --pack-destination="${tmpB}"`, { encoding: 'utf8' }).trim();
  const fileB = path.join(tmpB, outB.split('\n').pop().trim());

  const hashA = crypto.createHash('sha256').update(fs.readFileSync(fileA)).digest('hex');
  const hashB = crypto.createHash('sha256').update(fs.readFileSync(fileB)).digest('hex');

  console.log('  Independent Pack A SHA-256: ' + hashA);
  console.log('  Independent Pack B SHA-256: ' + hashB);

  if (hashA !== hashB || hashA !== EXPECTED_HASH) {
    console.error('FAIL: Non-deterministic packaging detected!');
    process.exit(1);
  }
  console.log('  [PASS] Packaging is 100% bit-for-bit deterministic and matches RC4 hash!');
} finally {
  fs.rmSync(tmpA, { recursive: true, force: true });
  fs.rmSync(tmpB, { recursive: true, force: true });
}

console.log('\n======================================================');
console.log('=== ALL RELEASE INTEGRITY CHECKS PASSED (100%) ===');
console.log('======================================================\n');
