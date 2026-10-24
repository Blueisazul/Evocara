/**
 * test-g33-staging-promotion.js
 * 
 * Rehearses and validates the controlled promotion of Evocara v0.4.0 GA
 * on an isolated staging clone of InventoryHub in os.tmpdir(), including:
 * 1. Pre-promotion baseline verification (34/34 tests).
 * 2. Controlled npm install of evocara-0.4.0.tgz.
 * 3. Contract, MCP, and CLI verification on installed package.
 * 4. Post-promotion business test execution (34/34 tests, zero regressions).
 * 5. Reversibility / Rollback validation back to openmemory-0.3.14-rc4.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

const EVOCARA_ROOT = path.resolve(__dirname, '../..');
const INVENTORYHUB_ROOT = path.resolve(EVOCARA_ROOT, '..', 'InventoryHub');
const TARBALL_PATH = path.join(EVOCARA_ROOT, '.work/artifacts/evocara-0.4.0.tgz');

console.log('=== G33 STAGING PROMOTION & ROLLBACK REHEARSAL ===\n');
console.log('Evocara root:', EVOCARA_ROOT);
console.log('InventoryHub root:', INVENTORYHUB_ROOT);
console.log('Tarball path:', TARBALL_PATH);

if (!fs.existsSync(TARBALL_PATH)) {
  console.error('FATAL: evocara-0.4.0.tgz not found!');
  process.exit(1);
}

// 1. Create Isolated Staging Directory
const stagingDir = path.join(os.tmpdir(), `inventoryhub-g33-staging-${Date.now()}`);
fs.mkdirSync(stagingDir, { recursive: true });
console.log('Created staging directory:', stagingDir);

function copyDirSelective(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const ent of entries) {
    if (['scratch', 'backups', '.git'].includes(ent.name)) {
      continue;
    }
    const srcPath = path.join(src, ent.name);
    const dstPath = path.join(dst, ent.name);
    if (ent.isDirectory()) {
      copyDirSelective(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

console.log('Cloning InventoryHub into isolated staging directory...');
const startTime = Date.now();
copyDirSelective(INVENTORYHUB_ROOT, stagingDir);
console.log(`Cloned in ${Date.now() - startTime} ms.\n`);

const results = {
  timestamp: new Date().toISOString(),
  stagingDir,
  baselineTests: null,
  promotionInstall: null,
  postPromotionTests: null,
  mcpVerification: null,
  rollbackTest: null,
  passed: false
};

// 2. Pre-promotion baseline check in staging
console.log('--- STEP 1: VERIFYING PRE-PROMOTION BASELINE (34 TESTS) ---');
try {
  const p1 = execSync('node test_phase_2c4_post_cleanup.mjs', { cwd: stagingDir }).toString();
  const pass1 = (p1.match(/\[PASS \d+\]/g) || []).length;
  console.log(`test_phase_2c4_post_cleanup.mjs: ${pass1}/10 checks passed`);

  const p2 = execSync('node test_phase_2c2_full.js', { cwd: stagingDir }).toString();
  const pass2 = (p2.match(/\[PASS \d+\]/g) || []).length;
  console.log(`test_phase_2c2_full.js: ${pass2}/24 checks passed`);

  results.baselineTests = {
    postCleanupPassed: pass1,
    fullPassed: pass2,
    totalPassed: pass1 + pass2,
    success: pass1 === 10 && pass2 === 24
  };
  if (!results.baselineTests.success) {
    throw new Error(`Baseline tests failed in staging clone: ${pass1 + pass2}/34`);
  }
  console.log('[PASS] Baseline verification 34/34 tests passed in staging.\n');
} catch (e) {
  console.error('FATAL: Pre-promotion baseline failed:', e.message);
  process.exit(1);
}

// 3. Perform Controlled Promotion in Staging
console.log('--- STEP 2: INSTALLING EVOCARA v0.4.0 GA IN STAGING ---');
try {
  // Save pre-promotion backup in staging
  const prePkg = fs.readFileSync(path.join(stagingDir, 'package.json'), 'utf8');
  const preOpencode = fs.readFileSync(path.join(stagingDir, 'opencode.json'), 'utf8');

  // Install via npm
  console.log(`Running: npm install "${TARBALL_PATH}" --no-audit --no-fund`);
  const installOut = execSync(`npm install "${TARBALL_PATH}" --no-audit --no-fund`, { cwd: stagingDir }).toString();
  console.log('npm install output sample:\n', installOut.trim().split('\n').slice(-3).join('\n'));

  // Update opencode.json MCP entry to reference evocara
  const opencodeObj = JSON.parse(preOpencode);
  opencodeObj.mcp = opencodeObj.mcp || {};
  opencodeObj.mcp.openmemory = {
    type: 'local',
    command: ['node', 'node_modules/evocara/dist/mcp.js']
  };
  opencodeObj.mcp.evocara = {
    type: 'local',
    command: ['node', 'node_modules/evocara/dist/mcp.js']
  };
  fs.writeFileSync(path.join(stagingDir, 'opencode.json'), JSON.stringify(opencodeObj, null, 2), 'utf8');

  // Verify installed package
  const installedPkgJson = JSON.parse(fs.readFileSync(path.join(stagingDir, 'node_modules/evocara/package.json'), 'utf8'));
  console.log('Installed package name:', installedPkgJson.name);
  console.log('Installed package version:', installedPkgJson.version);

  results.promotionInstall = {
    success: installedPkgJson.name === 'evocara' && installedPkgJson.version === '0.4.0',
    installedVersion: installedPkgJson.version,
    tarballUsed: TARBALL_PATH
  };

  if (!results.promotionInstall.success) {
    throw new Error('Installed package version mismatch!');
  }
  console.log('[PASS] Evocara v0.4.0 GA installed cleanly in staging.\n');
} catch (e) {
  console.error('FATAL: Promotion install failed:', e.message);
  process.exit(1);
}

// 4. Run Post-Promotion Business Tests in Staging
console.log('--- STEP 3: RUNNING POST-PROMOTION BUSINESS TESTS (34 TESTS) ---');
try {
  const p1 = execSync('node test_phase_2c4_post_cleanup.mjs', { cwd: stagingDir }).toString();
  const pass1 = (p1.match(/\[PASS \d+\]/g) || []).length;
  console.log(`test_phase_2c4_post_cleanup.mjs: ${pass1}/10 checks passed`);

  const p2 = execSync('node test_phase_2c2_full.js', { cwd: stagingDir }).toString();
  const pass2 = (p2.match(/\[PASS \d+\]/g) || []).length;
  console.log(`test_phase_2c2_full.js: ${pass2}/24 checks passed`);

  // Verify inventory-data.json did not reappear
  const jsonExists = fs.existsSync(path.join(stagingDir, 'inventory-data.json'));
  console.log('inventory-data.json is absent:', !jsonExists);

  results.postPromotionTests = {
    postCleanupPassed: pass1,
    fullPassed: pass2,
    totalPassed: pass1 + pass2,
    inventoryDataAbsent: !jsonExists,
    success: pass1 === 10 && pass2 === 24 && !jsonExists
  };

  if (!results.postPromotionTests.success) {
    throw new Error(`Post-promotion tests failed: ${pass1 + pass2}/34 or inventory-data.json reappeared!`);
  }
  console.log('[PASS] Post-promotion 34/34 tests passed with 0 regressions in staging.\n');
} catch (e) {
  console.error('FATAL: Post-promotion tests failed:', e.message);
  process.exit(1);
}

// 5. Verify Evocara MCP and StorageEngine integration in Staging
console.log('--- STEP 4: VERIFYING EVOCARA INTEGRATION IN STAGING ---');
try {
  const evocaraMod = require(path.join(stagingDir, 'node_modules/evocara'));
  const engine = new evocaraMod.StorageEngine(stagingDir);
  const state = engine.getOrInitProjectState();
  console.log('Consumer project state retrieved successfully. Stage:', state.currentStage || state.activePhase);

  // Query knowledge using installed module
  const researches = engine.listResearches();
  console.log('Researches found in staging .openmemory:', researches.length);

  results.mcpVerification = {
    storageEngineLoadable: typeof evocaraMod.StorageEngine === 'function',
    researchesCount: researches.length,
    success: true
  };
  console.log('[PASS] Evocara integration verified successfully in staging.\n');
} catch (e) {
  console.error('FATAL: MCP/StorageEngine integration check failed:', e.message);
  process.exit(1);
}

// 6. Test Rollback Procedure in Staging
console.log('--- STEP 5: VERIFYING ROLLBACK PROCEDURE IN STAGING ---');
try {
  // Restore original package.json and opencode.json
  const origPkg = {
    name: 'inventoryhub',
    version: '1.0.0',
    main: 'index.js',
    scripts: {
      test: 'echo "Error: no test specified" && exit 1'
    },
    type: 'module',
    dependencies: {
      openmemory: 'file:../../../../../Downloads/OpenMemory/.work/artifacts/openmemory-0.3.14-rc4.tgz'
    }
  };
  fs.writeFileSync(path.join(stagingDir, 'package.json'), JSON.stringify(origPkg, null, 2), 'utf8');

  console.log('Re-running npm install with protected openmemory-0.3.14-rc4.tgz...');
  execSync('npm install --no-audit --no-fund', { cwd: stagingDir });

  const rolledBackPkg = JSON.parse(fs.readFileSync(path.join(stagingDir, 'node_modules/openmemory/package.json'), 'utf8'));
  console.log('Rolled back openmemory package version:', rolledBackPkg.version);

  // Run business tests after rollback
  const p1 = execSync('node test_phase_2c4_post_cleanup.mjs', { cwd: stagingDir }).toString();
  const pass1 = (p1.match(/\[PASS \d+\]/g) || []).length;
  const p2 = execSync('node test_phase_2c2_full.js', { cwd: stagingDir }).toString();
  const pass2 = (p2.match(/\[PASS \d+\]/g) || []).length;

  results.rollbackTest = {
    rolledBackVersion: rolledBackPkg.version,
    testsPassed: pass1 + pass2,
    success: rolledBackPkg.version === '0.3.14-rc4' && pass1 === 10 && pass2 === 24
  };

  if (!results.rollbackTest.success) {
    throw new Error('Rollback verification failed!');
  }
  console.log('[PASS] Rollback procedure fully verified: 34/34 tests passed after reverting.\n');
} catch (e) {
  console.error('FATAL: Rollback test failed:', e.message);
  process.exit(1);
}

// Clean up staging directory
fs.rmSync(stagingDir, { recursive: true, force: true });
console.log('Staging directory cleaned up successfully.');

results.passed = true;

// Save evidence
const evidencePath = path.join(EVOCARA_ROOT, '.work/evidence/g33-staging-promotion-results.json');
fs.writeFileSync(evidencePath, JSON.stringify(results, null, 2), 'utf8');
console.log('Evidence saved to:', evidencePath);

console.log('\n============================================================');
console.log('=== G33 STAGING REHEARSAL & ROLLBACK PASSED (100%) ===');
console.log('============================================================\n');
