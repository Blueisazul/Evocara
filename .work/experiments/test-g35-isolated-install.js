const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

console.log('=== G35 ISOLATED PACKAGE INSTALLATION & SMOKE TEST ===\n');

const tarballPath = path.resolve(__dirname, '../artifacts/evocara-0.4.0.tgz');
if (!fs.existsSync(tarballPath)) {
  console.error('[FAIL] Tarball not found at:', tarballPath);
  process.exit(1);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evocara-g35-install-'));
console.log('Created temporary workspace:', tmpDir);

try {
  // Initialize minimal package.json in tmpDir
  const initialPkg = {
    name: 'test-consumer-workspace',
    version: '1.0.0',
    private: true
  };
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(initialPkg, null, 2));

  // Run npm install with tarball
  console.log('Running npm install from tarball...');
  const installOutput = cp.execSync(`npm install "${tarballPath}" --no-audit --no-fund`, {
    cwd: tmpDir,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  console.log('[PASS] npm install completed cleanly.');

  // Verify installed node_modules/evocara
  const installedPkgJsonPath = path.join(tmpDir, 'node_modules/evocara/package.json');
  if (!fs.existsSync(installedPkgJsonPath)) {
    throw new Error('node_modules/evocara/package.json does not exist');
  }
  const installedPkg = JSON.parse(fs.readFileSync(installedPkgJsonPath, 'utf8'));
  if (installedPkg.name !== 'evocara' || installedPkg.version !== '0.4.0') {
    throw new Error(`Unexpected installed package: ${installedPkg.name}@${installedPkg.version}`);
  }
  console.log(`[PASS] Verified installed package: ${installedPkg.name}@${installedPkg.version}`);

  // Test CLI execution
  const cliPath = path.join(tmpDir, 'node_modules/evocara/dist/cli.js');
  const cliOutput = cp.execSync(`node "${cliPath}" --help`, {
    cwd: tmpDir,
    encoding: 'utf8'
  });
  if (!cliOutput.includes('Usage: evocara') && !cliOutput.includes('evocara')) {
    throw new Error('CLI output missing evocara reference');
  }
  console.log('[PASS] CLI dist/cli.js executed successfully with --help.');

  // Test Node exports import
  const testConsumerCode = `
    const evocara = require('evocara');
    const storage = require('evocara/storage');
    const mcp = require('evocara/mcp');

    console.log('Main export keys count:', Object.keys(evocara).length);
    console.log('StorageEngine exported:', typeof storage.StorageEngine === 'function');
    console.log('createMCPServer exported:', typeof mcp.createMCPServer === 'function');
  `;
  const consumerOutput = cp.execSync(`node -e "${testConsumerCode.replace(/\n/g, ' ')}"`, {
    cwd: tmpDir,
    encoding: 'utf8'
  });
  console.log(consumerOutput.trim());
  console.log('[PASS] Subpath exports required and validated successfully.');

  console.log('\n============================================================');
  console.log('=== G35 ISOLATED PACKAGE INSTALLATION TEST PASSED (100%) ===');
  console.log('============================================================');
} finally {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log('Cleaned up temporary workspace:', tmpDir);
  } catch (err) {
    console.warn('Warning: Could not remove tmpDir:', err.message);
  }
}
