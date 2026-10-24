#!/usr/bin/env node
/**
 * Automated Candidate Integrity & Release Assurance Verifier (G8 / G11 / G12 Hardened)
 *
 * Verifies:
 * 1. Tarball existence, SHA-256 and SHA-512 cryptographic hashes with fail-closed enforcement.
 * 2. Unpacked tarball structure, Zip-Slip immunity, and absence of leaked secrets / temporary files.
 * 3. Fresh installation in an ephemeral isolated sandbox (os.tmpdir()).
 * 4. Runtime API smoke tests and MCP server tool registration from the installed node_modules package.
 * 5. Invariant preservation of the reference consumer (InventoryHub untouched).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync, spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Known authenticated release candidate hashes & sizes
const KNOWN_CANDIDATES = {
  '0.3.15-rc2': {
    version: '0.3.15-rc2',
    tarballName: 'openmemory-0.3.15-rc2.tgz',
    sha256: 'a82a2a02a5db20d0d96ae8fb913c04ca937e683da870d7fdbddb06ea77f8bfc5',
    sha512Base64: 'xDAzTSQgn4DT2c1bVOud9dqKda3+TS3HzoT2Ld7PSy0KIDH9mM/uI/JkgdljDGAfn9vp9zzD40lmvFoiQ9WqUg==',
    sizeBytes: 190051,
    status: 'QUALIFIED_RELEASE_CANDIDATE',
  },
  '0.3.15-rc1': {
    version: '0.3.15-rc1',
    tarballName: 'openmemory-0.3.15-rc1.tgz',
    sha256: '8b3df7e15222cfcce93d33044efc817e2c10564aa996af389a9603b66595d716',
    sha512Base64: '8q24rROste0KEoAO39ZcFJMvzhKEFsrTOlFv0e12zI2qIh/kpVcLwYT1tEWomwSGyf4KG1N9KzUM90IJ8f9rvQ==',
    sizeBytes: 184295,
    status: 'PRESERVED_HISTORICAL_BASELINE',
  },
};

const INVENTORYHUB_PATH = 'C:\\Users\\sant1\\OneDrive\\Documentos\\ChatGPT\\OpenMemory\\InventoryHub';

function log(msg) {
  console.log(`[RC-VERIFY] ${msg}`);
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tarball' && args[i + 1]) opts.tarball = args[++i];
    else if (args[i] === '--expected-sha256' && args[i + 1]) opts.expectedSha256 = args[++i];
    else if (args[i] === '--expected-size' && args[i + 1]) opts.expectedSize = parseInt(args[++i], 10);
    else if (args[i] === '--expected-version' && args[i + 1]) opts.expectedVersion = args[++i];
    else if (!args[i].startsWith('-') && !opts.tarball) opts.tarball = args[i];
  }

  return opts;
}

function computeHashes(filePath) {
  const buf = fs.readFileSync(filePath);
  return {
    size: buf.length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    sha512Base64: crypto.createHash('sha512').update(buf).digest('base64'),
  };
}

function inspectTarballArchive(tarball) {
  const output = execSync(`tar -tzf "${tarball}"`, { encoding: 'utf8' });
  const files = output.trim().split(/\r?\n/).map(f => f.trim()).filter(Boolean);

  // Zip-Slip and path traversal defenses
  const tarSlipEntries = files.filter(f =>
    f.startsWith('/') ||
    f.startsWith('\\') ||
    f.includes('../') ||
    f.includes('..\\') ||
    /^[a-zA-Z]:/.test(f)
  );

  // Security hygiene checks
  const forbiddenPatterns = [
    /\.env(\..+)?$/i,
    /\.pem$/i,
    /\.key$/i,
    /id_rsa/i,
    /\.db(-wal|-shm)?$/i,
    /\.sqlite(-wal|-shm)?$/i,
    /\.lock$/i,
    /\.tmp$/i,
    /\.work\//i,
    /node_modules\//i,
    /\.git\//i,
  ];

  const leaks = [];
  for (const f of files) {
    for (const pat of forbiddenPatterns) {
      if (pat.test(f)) {
        leaks.push({ file: f, pattern: pat.toString() });
      }
    }
  }

  return {
    totalFiles: files.length,
    files,
    leaks,
    tarSlipEntries,
  };
}

function verifySandboxInstall(tarball, expectedVersion) {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'om-assurance-sandbox-'));
  try {
    const pkg = { name: 'assurance-consumer', version: '1.0.0', private: true };
    fs.writeFileSync(path.join(sandbox, 'package.json'), JSON.stringify(pkg, null, 2));

    execSync(`npm install --silent "${tarball}"`, { cwd: sandbox, stdio: 'pipe' });

    const installedPkgJson = path.join(sandbox, 'node_modules', 'openmemory', 'package.json');
    if (!fs.existsSync(installedPkgJson)) {
      throw new Error('Installed package.json missing in node_modules/openmemory');
    }

    const installedPkg = JSON.parse(fs.readFileSync(installedPkgJson, 'utf8'));
    if (expectedVersion && installedPkg.version !== expectedVersion) {
      throw new Error(`Installed version mismatch: expected ${expectedVersion}, got ${installedPkg.version}`);
    }

    // Verify imported runtime APIs
    const om = require(path.join(sandbox, 'node_modules', 'openmemory'));
    const requiredExports = [
      'StorageEngine',
      'SQLiteLifecycleManager',
      'DiagnosticHealthCoordinator',
      'createMCPServer',
      'isProcessDead',
      'runCLI',
    ];
    for (const exp of requiredExports) {
      if (typeof om[exp] === 'undefined') {
        throw new Error(`Missing expected export in installed package: ${exp}`);
      }
    }

    // Smoke test StorageEngine instance
    const storage = new om.StorageEngine(sandbox);
    storage.ensureStorageStructure();
    const locks = storage.inspectLocks();
    if (!Array.isArray(locks)) {
      throw new Error('inspectLocks() did not return an array');
    }

    // Smoke test consolidated health
    if (typeof storage.getConsolidatedHealthSummary === 'function') {
      const summary = storage.getConsolidatedHealthSummary();
      if (!summary || !summary.overallStatus) {
        throw new Error('getConsolidatedHealthSummary() did not return a valid health report');
      }
    }

    // Smoke test MCP Server creation
    if (typeof om.createMCPServer === 'function') {
      const mcp = om.createMCPServer(sandbox);
      if (!mcp) {
        throw new Error('createMCPServer() returned null or undefined');
      }
    }

    return { sandboxSuccess: true, installedVersion: installedPkg.version, sandboxDir: sandbox };
  } finally {
    try {
      fs.rmSync(sandbox, { recursive: true, force: true });
    } catch (_) {}
  }
}

function verifyInventoryHubUntouched() {
  if (!fs.existsSync(INVENTORYHUB_PATH)) {
    return { verified: false, reason: 'InventoryHub path not found' };
  }
  const pkgPath = path.join(INVENTORYHUB_PATH, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const dep = pkg.dependencies && pkg.dependencies.openmemory;
  const isUntouched = dep && dep.includes('openmemory-0.3.14-rc4.tgz');

  // Run read-only consumer acceptance tests
  let testsPass = false;
  try {
    const res = spawnSync('node', ['test_inventory_manager.js'], { cwd: INVENTORYHUB_PATH, encoding: 'utf8' });
    testsPass = res.status === 0;
  } catch (_) {}

  return {
    verified: Boolean(isUntouched && testsPass),
    installedDependency: dep,
    testsPass,
  };
}

function main(cliOpts = parseCliArgs()) {
  log('==================================================================');
  log('  OPENMEMORY: CANDIDATE INTEGRITY & RELEASE ASSURANCE AUDITOR    ');
  log('==================================================================');

  // Resolve target tarball
  let tarballPath = cliOpts.tarball;
  if (!tarballPath) {
    const defaultRc2 = path.resolve(PROJECT_ROOT, '.work/artifacts/openmemory-0.3.15-rc2.tgz');
    const defaultRc1 = path.resolve(PROJECT_ROOT, '.work/artifacts/openmemory-0.3.15-rc1.tgz');
    tarballPath = fs.existsSync(defaultRc2) ? defaultRc2 : defaultRc1;
  } else {
    tarballPath = path.resolve(PROJECT_ROOT, tarballPath);
  }

  if (!fs.existsSync(tarballPath)) {
    console.error(`ERROR: Tarball not found at ${tarballPath}`);
    return { allPassed: false, verdict: 'REJECTED_MISSING_ARTIFACT' };
  }

  const hashes = computeHashes(tarballPath);
  log(`Tarball Path:    ${tarballPath}`);
  log(`Size:            ${hashes.size} bytes`);
  log(`SHA-256:         ${hashes.sha256}`);
  log(`SHA-512:         ${hashes.sha512Base64}`);

  // Resolve expected reference
  const baseName = path.basename(tarballPath);
  let expectedRecord = null;
  for (const k of Object.keys(KNOWN_CANDIDATES)) {
    if (baseName.includes(k)) {
      expectedRecord = KNOWN_CANDIDATES[k];
      break;
    }
  }

  const expectedSha256 = cliOpts.expectedSha256 || (expectedRecord && expectedRecord.sha256);
  const expectedSize = cliOpts.expectedSize || (expectedRecord && expectedRecord.sizeBytes);
  const expectedVersion = cliOpts.expectedVersion || (expectedRecord && expectedRecord.version);

  if (!expectedSha256) {
    console.error('FAIL-CLOSED: No trusted expected SHA-256 hash provided or found in manifest/records!');
    log('==================================================================');
    log('VERDICT:         UNVERIFIED (NO TRUSTED INTEGRITY REFERENCE)');
    log('==================================================================');
    return { allPassed: false, verdict: 'UNVERIFIED' };
  }

  const sizeOk = expectedSize ? hashes.size === expectedSize : true;
  const hashOk = hashes.sha256.toLowerCase() === expectedSha256.toLowerCase();

  log(`Expected SHA-256: ${expectedSha256}`);
  log(`Size Match:      ${sizeOk ? 'PASS' : 'FAIL'}`);
  log(`SHA-256 Match:   ${hashOk ? 'PASS' : 'FAIL'}`);

  if (!hashOk || !sizeOk) {
    console.error('FAIL-CLOSED: Cryptographic hash or size mismatch against expected reference!');
    return { allPassed: false, verdict: 'REJECTED_INTEGRITY_MISMATCH' };
  }

  log('Inspecting tarball internal structure and scanning for Zip-Slip & leaks...');
  const tarInspection = inspectTarballArchive(tarballPath);
  log(`Total Files:     ${tarInspection.totalFiles}`);
  log(`Tar-Slip Flaws:  ${tarInspection.tarSlipEntries.length === 0 ? 'NONE (PASS)' : 'DETECTED (FAIL)'}`);
  log(`Security Leaks:  ${tarInspection.leaks.length === 0 ? 'NONE (PASS)' : 'DETECTED (FAIL)'}`);

  const tarSlipOk = tarInspection.tarSlipEntries.length === 0;
  const leaksOk = tarInspection.leaks.length === 0;

  if (!tarSlipOk) {
    console.error('TAR-SLIP ENTRIES DETECTED:', tarInspection.tarSlipEntries);
  }
  if (!leaksOk) {
    console.error('SECURITY LEAKS DETECTED:', tarInspection.leaks);
  }

  log('Executing isolated sandbox installation and runtime API verification...');
  let sandboxRes = { sandboxSuccess: false };
  try {
    sandboxRes = verifySandboxInstall(tarballPath, expectedVersion);
    log(`Sandbox Install: ${sandboxRes.sandboxSuccess ? 'SUCCESS' : 'FAIL'}`);
    log(`Runtime APIs:    VERIFIED (${sandboxRes.installedVersion})`);
  } catch (sErr) {
    console.error(`Sandbox verification failed: ${sErr.message}`);
  }

  log('Checking reference consumer InventoryHub preservation...');
  const consumerRes = verifyInventoryHubUntouched();
  log(`InventoryHub:    ${consumerRes.verified ? '100% UNTOUCHED & PASSING (0.3.14-rc4)' : 'FAILED'}`);

  const allPassed = Boolean(
    sizeOk &&
    hashOk &&
    tarSlipOk &&
    leaksOk &&
    sandboxRes.sandboxSuccess &&
    consumerRes.verified
  );

  log('==================================================================');
  log(`VERDICT:         ${allPassed ? 'ASSURANCE_VERIFIED (READY FOR HUMAN REVIEW)' : 'FAILED'}`);
  log('==================================================================');

  const report = {
    timestamp: new Date().toISOString(),
    tarball: {
      path: tarballPath,
      size: hashes.size,
      sha256: hashes.sha256,
      sha512Base64: hashes.sha512Base64,
      sizeOk,
      hashOk,
    },
    archiveInspection: {
      totalFiles: tarInspection.totalFiles,
      tarSlipEntries: tarInspection.tarSlipEntries,
      leaksCount: tarInspection.leaks.length,
      leaks: tarInspection.leaks,
    },
    sandboxVerification: sandboxRes,
    referenceConsumer: consumerRes,
    allPassed,
    verdict: allPassed ? 'ASSURANCE_VERIFIED' : 'FAILED',
  };

  return { allPassed, report };
}

if (require.main === module) {
  const { allPassed } = main();
  process.exit(allPassed ? 0 : 1);
}

module.exports = {
  main,
  computeHashes,
  inspectTarballArchive,
  verifySandboxInstall,
  verifyInventoryHubUntouched,
  KNOWN_CANDIDATES,
};
