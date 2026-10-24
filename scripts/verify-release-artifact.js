#!/usr/bin/env node
/**
 * Release Artifact & Supply Chain Verifier (Phase D, G11 & G12 Hardened)
 * Verifies tarball integrity, hash parity, manifest concordance, tar-slip security, and environment constraints.
 * Implements strict fail-closed enforcement: rejects any artifact lacking a trusted manifest or explicit expected hash.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

const customTarball = getArg('--tarball');
const customManifest = getArg('--manifest');
const explicitExpectedSha256 = getArg('--expected-sha256');
const explicitExpectedSize = getArg('--expected-size') ? parseInt(getArg('--expected-size'), 10) : null;

// Default to rc2 candidate if present, otherwise rc1
const defaultTarball = fs.existsSync(path.resolve(PROJECT_ROOT, '.work/artifacts/openmemory-0.3.15-rc2.tgz'))
  ? path.resolve(PROJECT_ROOT, '.work/artifacts/openmemory-0.3.15-rc2.tgz')
  : path.resolve(PROJECT_ROOT, '.work/artifacts/openmemory-0.3.15-rc1.tgz');

const TARBALL_PATH = customTarball ? path.resolve(PROJECT_ROOT, customTarball) : defaultTarball;

let defaultManifest;
if (TARBALL_PATH.includes('rc1')) {
  defaultManifest = path.resolve(PROJECT_ROOT, 'docs/G8_RELEASE_ASSURANCE_MANIFEST.json');
} else if (fs.existsSync(path.resolve(PROJECT_ROOT, 'docs/G14_EVIDENCE_MANIFEST.json'))) {
  defaultManifest = path.resolve(PROJECT_ROOT, 'docs/G14_EVIDENCE_MANIFEST.json');
} else if (fs.existsSync(path.resolve(PROJECT_ROOT, 'docs/G13_EVIDENCE_MANIFEST.json'))) {
  defaultManifest = path.resolve(PROJECT_ROOT, 'docs/G13_EVIDENCE_MANIFEST.json');
} else if (fs.existsSync(path.resolve(PROJECT_ROOT, 'docs/G12_EVIDENCE_MANIFEST.json'))) {
  defaultManifest = path.resolve(PROJECT_ROOT, 'docs/G12_EVIDENCE_MANIFEST.json');
} else {
  defaultManifest = path.resolve(PROJECT_ROOT, 'docs/G11_EVIDENCE_MANIFEST.json');
}

const MANIFEST_PATH = customManifest ? path.resolve(PROJECT_ROOT, customManifest) : defaultManifest;

function run() {
  console.log("=================================================");
  console.log("=== OPENMEMORY SUPPLY CHAIN ARTIFACT VERIFIER ===");
  console.log("=================================================");

  if (!fs.existsSync(TARBALL_PATH)) {
    console.error(`FAIL: Release artifact tarball not found: ${TARBALL_PATH}`);
    process.exit(1);
  }

  const tarballBuf = fs.readFileSync(TARBALL_PATH);
  const calculatedSha256 = crypto.createHash('sha256').update(tarballBuf).digest('hex');
  const calculatedSha512 = crypto.createHash('sha512').update(tarballBuf).digest('base64');
  const calculatedSize = tarballBuf.length;

  console.log(`Artifact:             ${TARBALL_PATH}`);
  console.log(`Size (bytes):         ${calculatedSize}`);
  console.log(`SHA-256:              ${calculatedSha256}`);
  console.log(`SHA-512 (base64):     ${calculatedSha512}`);

  let passed = true;
  let referenceFound = false;

  // 1. Verify against explicit CLI expected hash if provided
  if (explicitExpectedSha256) {
    referenceFound = true;
    console.log(`Explicit SHA-256:     ${explicitExpectedSha256}`);
    if (calculatedSha256.toLowerCase() !== explicitExpectedSha256.toLowerCase()) {
      console.error("FAIL: SHA-256 mismatch with explicit expected hash!");
      passed = false;
    } else {
      console.log("[PASS] SHA-256 cryptographic match with explicit hash verified.");
    }
    if (explicitExpectedSize !== null) {
      if (calculatedSize !== explicitExpectedSize) {
        console.error(`FAIL: Size mismatch with explicit expected size (expected ${explicitExpectedSize}, got ${calculatedSize})!`);
        passed = false;
      } else {
        console.log("[PASS] Size bytes exact match with explicit size verified.");
      }
    }
  }

  // 2. Verify against manifest if it exists
  if (fs.existsSync(MANIFEST_PATH)) {
    referenceFound = true;
    try {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      const expected = manifest.targetArtifact || (manifest.historicalBaseline && TARBALL_PATH.includes('rc1') ? manifest.historicalBaseline : null);
      if (!expected) {
        console.error(`FAIL: Manifest at ${MANIFEST_PATH} does not describe a valid targetArtifact or matching baseline!`);
        passed = false;
      } else {
        console.log(`Manifest:             ${MANIFEST_PATH}`);
        console.log(`Declared SHA-256:     ${expected.sha256}`);
        console.log(`Declared Size:        ${expected.sizeBytes}`);

        if (calculatedSha256.toLowerCase() !== expected.sha256.toLowerCase()) {
          console.error("FAIL: SHA-256 mismatch with manifest!");
          passed = false;
        } else {
          console.log("[PASS] SHA-256 cryptographic match with manifest verified.");
        }

        if (calculatedSize !== expected.sizeBytes) {
          console.error(`FAIL: Size mismatch with manifest (expected ${expected.sizeBytes}, got ${calculatedSize})!`);
          passed = false;
        } else {
          console.log("[PASS] Size bytes exact match with manifest verified.");
        }

        if (expected.sha512Base64 && calculatedSha512 !== expected.sha512Base64) {
          console.error("FAIL: SHA-512 mismatch with manifest!");
          passed = false;
        } else if (expected.sha512Base64) {
          console.log("[PASS] SHA-512 cryptographic match with manifest verified.");
        }
      }
    } catch (parseErr) {
      console.error(`FAIL: Unable to parse manifest ${MANIFEST_PATH}: ${parseErr.message}`);
      passed = false;
    }
  } else if (!explicitExpectedSha256) {
    // FAIL-CLOSED: No reference available
    console.error(`FAIL-CLOSED: Expected manifest not found at ${MANIFEST_PATH} and no --expected-sha256 provided!`);
    passed = false;
  }

  if (!referenceFound) {
    console.error("FAIL-CLOSED: No trusted reference (manifest or authenticated parameter) available to verify integrity!");
    passed = false;
  }

  // 3. Inspect tarball contents and defense against tar-slip / path traversal
  const tarList = execSync(`tar -tzf "${TARBALL_PATH}"`, { encoding: 'utf8' })
    .trim()
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);

  console.log(`Packaged files count: ${tarList.length}`);
  const slipEntries = tarList.filter(f =>
    f.startsWith('/') ||
    f.startsWith('\\') ||
    f.includes('../') ||
    f.includes('..\\') ||
    /^[a-zA-Z]:/.test(f)
  );

  if (slipEntries.length > 0) {
    console.error(`FAIL: Path traversal entries detected in tarball: ${slipEntries.join(', ')}`);
    passed = false;
  } else {
    console.log("[PASS] Tarball free of path traversal entries (Zip-Slip safe).");
  }

  // 4. Check Git current commit
  try {
    const gitHead = execSync('git rev-parse HEAD', { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
    console.log(`Git HEAD commit:      ${gitHead}`);
  } catch (_) {}

  console.log("=================================================");
  if (!passed) {
    console.error("SUPPLY CHAIN VERIFICATION FAILED (EXIT 1)");
    process.exit(1);
  } else {
    console.log("SUPPLY CHAIN ARTIFACT INTEGRITY VERIFIED (EXIT 0)");
    process.exit(0);
  }
}

run();
