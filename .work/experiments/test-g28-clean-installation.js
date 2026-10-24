/**
 * G28 Bloque C: Clean Installation Acceptance Test from evocara-0.4.0.tgz
 *
 * Verifies that the packaged tarball can be installed cleanly into an isolated
 * sandbox environment, without any build tools, git, or development dependencies.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '../..');
const tarballPath = path.join(projectRoot, '.work', 'artifacts', 'evocara-0.4.0.tgz');

console.log('===================================================================');
console.log('  G28 Bloque C: Clean Installation Test from evocara-0.4.0.tgz');
console.log('===================================================================\n');

assert(fs.existsSync(tarballPath), `Tarball missing: ${tarballPath}`);

const tmpSandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'g28-clean-install-'));
console.log('  Sandbox Directory:', tmpSandbox);

try {
  // 1. Create clean consumer package.json
  const consumerPkg = {
    name: 'clean-consumer-test',
    version: '1.0.0',
    description: 'Clean consumer verifying evocara-0.4.0.tgz installation',
    main: 'index.js'
  };
  fs.writeFileSync(path.join(tmpSandbox, 'package.json'), JSON.stringify(consumerPkg, null, 2), 'utf8');

  // 2. Execute npm install <tarball>
  console.log('\n[STEP 1] Installing evocara-0.4.0.tgz via npm install...');
  const installRes = spawnSync(`npm install "${tarballPath}" --save-exact`, {
    cwd: tmpSandbox,
    shell: true,
    encoding: 'utf8',
    timeout: 120000
  });

  assert.strictEqual(installRes.status, 0, `npm install failed: ${installRes.stderr || installRes.stdout}`);
  console.log('  [PASS] npm install exited with code 0.');

  // 3. Verify node_modules structure
  console.log('\n[STEP 2] Verifying installed package layout...');
  const installedPkgJsonPath = path.join(tmpSandbox, 'node_modules', 'evocara', 'package.json');
  assert(fs.existsSync(installedPkgJsonPath), 'node_modules/evocara/package.json must exist');

  const installedPkg = JSON.parse(fs.readFileSync(installedPkgJsonPath, 'utf8'));
  assert.strictEqual(installedPkg.name, 'evocara', 'Installed package name must be evocara');
  assert.strictEqual(installedPkg.version, '0.4.0', 'Installed version must be 0.4.0');
  console.log(`  [PASS] evocara@${installedPkg.version} verified in node_modules.`);

  // 4. Verify programmatic module imports
  console.log('\n[STEP 3] Testing programmatic module imports from installed package...');
  const testScript = `
    const assert = require('assert');
    const evocara = require('evocara');

    assert(typeof evocara.StorageEngine === 'function', 'Must export StorageEngine');
    assert(typeof evocara.createMCPServer === 'function', 'Must export createMCPServer');
    assert(typeof evocara.createEvocaraMCPServer === 'function', 'Must export createEvocaraMCPServer');
    assert(typeof evocara.installEvocara === 'function', 'Must export installEvocara');
    assert(typeof evocara.installOpenMemory === 'function', 'Must export installOpenMemory');

    const storage = new evocara.StorageEngine('${tmpSandbox.replace(/\\/g, '\\\\')}');
    storage.ensureStorageStructure();
    const summary = storage.formatProjectContextSummary();
    assert(typeof summary === 'string', 'Summary must be string');

    const mcp = evocara.createEvocaraMCPServer('${tmpSandbox.replace(/\\/g, '\\\\')}');
    assert(mcp !== null, 'MCP server initialized');
    console.log('IMPORT_VERIFIED_OK');
  `;

  const scriptRes = spawnSync(process.execPath, ['-e', testScript], {
    cwd: tmpSandbox,
    encoding: 'utf8',
    timeout: 30000
  });

  assert.strictEqual(scriptRes.status, 0, `Script execution failed: ${scriptRes.stderr || scriptRes.stdout}`);
  assert(scriptRes.stdout.includes('IMPORT_VERIFIED_OK'), 'Must output IMPORT_VERIFIED_OK');
  console.log('  [PASS] Programmatic API functional in installed package.');

  // 5. Test CLI binaries (evocara and openmemory)
  console.log('\n[STEP 4] Testing CLI binaries via npx / direct node...');
  const cliPath = path.join(tmpSandbox, 'node_modules', 'evocara', 'dist', 'cli.js');

  const cliVerEvo = spawnSync(process.execPath, [cliPath, 'version'], { cwd: tmpSandbox, encoding: 'utf8' });
  assert.strictEqual(cliVerEvo.status, 0);
  assert(cliVerEvo.stdout.includes('Evocara (formerly OpenMemory) v0.4.0 (package: evocara@0.4.0)'));
  console.log('  [PASS] CLI version verified:', cliVerEvo.stdout.trim());

  const cliHelp = spawnSync(process.execPath, [cliPath, 'help'], { cwd: tmpSandbox, encoding: 'utf8' });
  assert.strictEqual(cliHelp.status, 0);
  assert(cliHelp.stdout.includes('evocara <command>'));
  assert(cliHelp.stdout.includes('openmemory <command>'));
  console.log('  [PASS] CLI help verified dual invocation.');

  console.log('\n===================================================================');
  console.log('  Clean Installation Acceptance Test: ALL CHECKS PASSED (100%)');
  console.log('===================================================================\n');

} finally {
  try {
    fs.rmSync(tmpSandbox, { recursive: true, force: true });
  } catch (_) {}
}
