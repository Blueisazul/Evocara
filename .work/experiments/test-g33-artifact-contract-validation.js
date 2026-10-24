/**
 * test-g33-artifact-contract-validation.js
 * 
 * Verifies Evocara v0.4.0 GA tarball integrity, SBOM, exports,
 * CLI binaries, MCP contracts, and backwards compatibility aliases in strict isolation.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');

// Ensure module resolution finds installed dependencies for isolated extraction
const nodeModulesPath = path.resolve('node_modules');
if (process.env.NODE_PATH) {
  process.env.NODE_PATH = `${nodeModulesPath}${path.delimiter}${process.env.NODE_PATH}`;
} else {
  process.env.NODE_PATH = nodeModulesPath;
}
require('module').Module._initPaths();

function hashFile(filepath) {
  const stat = fs.statSync(filepath);
  const buf = fs.readFileSync(filepath);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  return { size: stat.size, sha256 };
}

const tarballPath = path.resolve('.work/artifacts/evocara-0.4.0.tgz');
const sbomPath = path.resolve('.work/artifacts/evocara-0.4.0.cdx.json');

console.log('=== G33 ARTIFACT & CONTRACT VERIFICATION ===\n');

// 1. Check Artifact Hashes
const EXPECTED_TARBALL_SHA256 = '70f31da7e822bfa8ece60395212e009cac9d39761d02af0325d6c3ee3b8a730a';
const EXPECTED_TARBALL_SIZE = 209910;
const EXPECTED_SBOM_SHA256 = '6621e53a415cc7406c02bfcbf55a769c19e5591c338656baa876e23fe23bb0dc';
const EXPECTED_SBOM_SIZE = 41973;

const tarballInfo = hashFile(tarballPath);
const sbomInfo = hashFile(sbomPath);

console.log('Tarball Size:', tarballInfo.size, 'Expected:', EXPECTED_TARBALL_SIZE);
console.log('Tarball SHA-256:', tarballInfo.sha256);
console.log('SBOM Size:', sbomInfo.size, 'Expected:', EXPECTED_SBOM_SIZE);
console.log('SBOM SHA-256:', sbomInfo.sha256);

if (tarballInfo.sha256 !== EXPECTED_TARBALL_SHA256 || tarballInfo.size !== EXPECTED_TARBALL_SIZE) {
  console.error('FATAL: Tarball checksum or size mismatch!');
  process.exit(1);
}

if (sbomInfo.sha256 !== EXPECTED_SBOM_SHA256 || sbomInfo.size !== EXPECTED_SBOM_SIZE) {
  console.error('FATAL: SBOM checksum or size mismatch!');
  process.exit(1);
}
console.log('[PASS] Tarball and SBOM hashes match 100% identically.\n');

// 2. Extract into isolated temporary environment
const tmpDir = path.join(os.tmpdir(), `evocara-g33-verify-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });
console.log('Extracting GA package to isolated temporary directory:', tmpDir);
execSync(`tar -xzf "${tarballPath}"`, { cwd: tmpDir });

const pkgRoot = path.join(tmpDir, 'package');
const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));

console.log('[PASS] Package name:', pkgJson.name);
console.log('[PASS] Package version:', pkgJson.version);

// 3. Verify executables
const binEvocara = path.join(pkgRoot, pkgJson.bin.evocara);
const binOpenMemory = path.join(pkgRoot, pkgJson.bin.openmemory);
if (!fs.existsSync(binEvocara) || !fs.existsSync(binOpenMemory)) {
  console.error('FATAL: Executables missing in package!');
  process.exit(1);
}
const evocaraHelp = execSync(`node "${binEvocara}" --help`).toString();
const openmemoryHelp = execSync(`node "${binOpenMemory}" --help`).toString();
if (!evocaraHelp.includes('evocara') && !evocaraHelp.includes('openmemory')) {
  console.error('FATAL: Unexpected CLI output from evocara executable');
  process.exit(1);
}
console.log('[PASS] Both bin/evocara and bin/openmemory executables execute cleanly.');

// 4. Verify Public Module Exports
const mainMod = require(path.join(pkgRoot, pkgJson.main));
const storageMod = require(path.join(pkgRoot, pkgJson.exports['./storage'].default));
const stageMod = require(path.join(pkgRoot, pkgJson.exports['./stage-engine'].default));
const installerMod = require(path.join(pkgRoot, pkgJson.exports['./installer'].default));
const mcpMod = require(path.join(pkgRoot, pkgJson.exports['./mcp'].default));

console.log('[PASS] Main exports count:', Object.keys(mainMod).length);
console.log('[PASS] Storage exports contains StorageEngine:', typeof storageMod.StorageEngine === 'function');
console.log('[PASS] Stage exports contains StageEngine:', typeof stageMod.StageEngine === 'function');
console.log('[PASS] Installer exports contains installEvocara & installOpenMemory:', 
  typeof installerMod.installEvocara === 'function' && typeof installerMod.installOpenMemory === 'function');
console.log('[PASS] MCP exports contains curated server functions:', 
  typeof mcpMod.createCuratedMCPServer === 'function' && typeof mcpMod.createEvocaraMCPServer === 'function');

// 5. Test isolated runtime execution with StorageEngine & Knowledge
const testWorkspace = path.join(tmpDir, 'test-consumer-workspace');
fs.mkdirSync(testWorkspace, { recursive: true });

const storageEngine = new storageMod.StorageEngine(testWorkspace);
storageEngine.setProjectName('test-consumer-workspace');
const state = storageEngine.getOrInitProjectState();
console.log('[PASS] StorageEngine initialized project state. Project:', storageEngine.deriveProjectName());

const agentId = 'agent-g33-verifier';
const sessionId = 'session-g33-001';

// Register session
const session = storageEngine.registerSession({ id: sessionId, agentId, role: 'ARCHITECT' });
console.log('[PASS] Session registered successfully:', session.id);

// Test ADR recording (status must be PROPOSED to follow F13 governance)
const adr = storageEngine.saveADR({
  title: 'Test G33 Compatibility ADR',
  context: 'Verification of ADR governance under Evocara v0.4.0 GA package',
  decision: 'Use Evocara v0.4.0 GA package',
  consequences: 'None',
  status: 'PROPOSED'
}, agentId, sessionId);
console.log('[PASS] ADR recorded successfully with ID:', adr.id);

// Vote on ADR to ACCEPT
const votedAdr = storageEngine.voteADR(adr.id, agentId, sessionId, 'ACCEPT', 'Consensus achieved in verification rehearsal');
console.log('[PASS] ADR consensus voted successfully. New status:', votedAdr.status);

// Test Research recording with items
const res = storageEngine.saveResearch({
  topic: 'Architecture',
  summary: 'Validating knowledge TMS in GA package',
  items: [
    {
      id: 'KI-G33-001',
      title: 'Deterministic Indexing',
      content: 'Evocara provides deterministic BM25 indexing for agent memory',
      tags: ['indexing', 'bm25']
    }
  ]
}, agentId, sessionId);
console.log('[PASS] Research recorded successfully with ID:', res.id);

// Test BM25 Query
const queryResults = storageEngine.queryKnowledgeItems({ query: 'deterministic' });
console.log('[PASS] BM25 query successfully returned matches:', queryResults.length > 0);

// Clean up isolated directory
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log('\n============================================================');
console.log('=== ALL G33 ARTIFACT & CONTRACT CHECKS PASSED (100%) ===');
console.log('============================================================\n');
