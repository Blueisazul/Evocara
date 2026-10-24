/**
 * test-g34-reconcile-simulation.js
 * 
 * Rehearses and verifies git reconciliation between origin/master (v0.3.1 baseline)
 * and local canonical master (Evocara v0.4.0 GA) on an isolated temporary branch.
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const cwd = path.resolve(__dirname, '../..');
console.log('=== G34 RECONCILIATION SIMULATION ===\n');

const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd }).toString().trim();
console.log('Current branch:', currentBranch);

const TEST_BRANCH = 'test-reconcile-clean';

try {
  // 1. Clean up old test branch
  try {
    execSync(`git branch -D ${TEST_BRANCH}`, { cwd, stdio: 'pipe' });
  } catch (_) {}

  // 2. Identify untracked files that exist in origin/master
  const originFiles = execSync('git ls-tree -r --name-only origin/master', { cwd })
    .toString().split('\n').filter(Boolean);
  const statusLines = execSync('git status --porcelain', { cwd })
    .toString().split('\n');
  const untracked = statusLines
    .filter(l => l.startsWith('?? '))
    .map(l => l.substring(3).trim());

  const overlap = untracked.filter(f => originFiles.includes(f));
  console.log(`Found ${overlap.length} untracked experiment files that belong to origin/master.`);

  // 3. Create test branch
  execSync(`git checkout -b ${TEST_BRANCH} master`, { cwd });
  console.log(`Switched to test branch: ${TEST_BRANCH}`);

  // 4. Stash or stage runtime modified files
  const runtimeFiles = ['.openmemory/project-state.json', '.openmemory/spike/events.jsonl', '.openmemory/spike/state.json', '.work/evidence/g23-expanded-benchmark-results.json', '.work/evidence/g30-bitemporal-suite-results.json', '.work/evidence/g31-lineage-and-contradictions-results.json'];
  for (const rf of runtimeFiles) {
    if (fs.existsSync(rf)) {
      execSync(`git add "${rf}"`, { cwd });
    }
  }
  try {
    execSync('git diff --cached --quiet', { cwd });
  } catch (_) {
    execSync('git commit -m "chore: checkpoint runtime state before reconciliation simulation"', { cwd });
  }

  // 5. Stage overlapping experiment files
  if (overlap.length > 0) {
    for (const f of overlap) {
      execSync(`git add "${f}"`, { cwd });
    }
    execSync('git commit -m "chore: track historical experiment files present in origin/master"', { cwd });
  }

  // 6. Execute merge with -s ours (preserves canonical tree 100% identically)
  console.log('Executing git merge -s ours origin/master...');
  const mergeOutput = execSync('git merge -s ours origin/master -m "merge: reconcile origin/master (OpenMemory v0.3.1) into canonical master (Evocara v0.4.0 GA)"', { cwd }).toString();
  console.log('Merge output sample:\n', mergeOutput.trim().split('\n').slice(0, 10).join('\n'));
  console.log('\n[PASS] Merge with -s ours completed successfully!');

  // 7. Verify compilation
  console.log('\n--- VERIFYING COMPILATION (tsc) ---');
  execSync('npm run build', { cwd, stdio: 'inherit' });
  console.log('[PASS] Compilation successful!');

  // 8. Verify GA artifact and contracts
  console.log('\n--- VERIFYING GA ARTIFACT & PUBLIC CONTRACTS ---');
  execSync('node .work/experiments/test-g33-artifact-contract-validation.js', { cwd, stdio: 'inherit' });
  console.log('[PASS] Contracts and GA tarball verified 100%!');

  // 9. Check commit ancestry
  console.log('\n--- CHECKING ANCESTRY AFTER MERGE ---');
  execSync(`git merge-base --is-ancestor origin/master ${TEST_BRANCH}`, { cwd });
  console.log('[PASS] origin/master is now an official direct ancestor of the reconciled branch!');

  const aheadCount = execSync(`git rev-list --count origin/master..${TEST_BRANCH}`, { cwd }).toString().trim();
  const behindCount = execSync(`git rev-list --count ${TEST_BRANCH}..origin/master`, { cwd }).toString().trim();
  console.log(`Reconciled branch is ahead by ${aheadCount} commits and behind by ${behindCount} commits.`);

} catch (err) {
  console.error('FATAL: Simulation failed:', err.message);
} finally {
  // Always return to original branch
  execSync(`git checkout ${currentBranch}`, { cwd });
  console.log(`Returned to original branch: ${currentBranch}`);
}

console.log('\n=== RECONCILIATION SIMULATION COMPLETED ===\n');
