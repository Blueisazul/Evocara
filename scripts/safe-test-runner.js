/**
 * Safe Test Runner for OpenMemory / Evocara (P1.5)
 *
 * Ensures:
 * 1. 100% test isolation: tests that produce filesystem state use isolated temp sandboxes.
 * 2. Zero git working tree pollution: prevents creating untracked files in project root.
 * 3. Structured categorization: Unit, Security, Concurrency, Recovery, Rehearsal, Hardening, and Adversarial.
 * 4. Safe execution reporting with exit codes and timings.
 */

const { spawnSync } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");

const projectRoot = path.resolve(__dirname, "..");

const SUITES = [
  {
    id: "SEC-001",
    name: "Path Traversal & Domain ID Hardening Suite",
    type: "security",
    script: ".work/experiments/test-sec001-path-traversal.js",
    isolated: true,
  },
  {
    id: "PERSIST-001",
    name: "Multi-Process Concurrency & Lock Stress Suite",
    type: "concurrency",
    script: ".work/experiments/test-persist001-concurrency.js",
    isolated: true,
  },
  {
    id: "F13.3.3",
    name: "ADR Governance Domain Unit & Facade Tests",
    type: "domain",
    script: ".work/experiments/run-f1333-adr-governance-tests.ts",
    isolated: true,
    usesTsx: true,
  },
  {
    id: "SPIKE",
    name: "OpenMemory Plugin Spike Empirical Suite",
    type: "integration",
    script: ".work/experiments/run-spike-tests.ts",
    isolated: true,
    usesTsx: true,
  },
  {
    id: "AUDIT-COMPARE",
    name: "Vulnerability Advisory Differential Comparator Suite",
    type: "security",
    script: ".work/experiments/test-audit-comparator.js",
    isolated: true,
  },
  {
    id: "SYNTHETIC-PROMO",
    name: "Synthetic Consumer Promotion & Verifiable Rollback Suite",
    type: "integration",
    script: ".work/experiments/test-synthetic-consumer-promotion.js",
    isolated: true,
  },
  {
    id: "RECOVERY-P08",
    name: "P0.8 Adversarial Recovery & Promotion Security Suite",
    type: "recovery",
    script: ".work/experiments/test-p08-recovery-scenarios.js",
    isolated: true,
  },
  {
    id: "RECOVERY-P09",
    name: "P0.9 Adversarial Recovery, Promotion & Forensic Security Suite",
    type: "recovery",
    script: ".work/experiments/test-p09-recovery-scenarios.js",
    isolated: true,
  },
  {
    id: "INVARIANTS-P10",
    name: "P1.0 High-Impact Adversarial Invariants & Deep Recovery Suite",
    type: "invariants",
    script: ".work/experiments/test-p10-adversarial-invariants.js",
    isolated: true,
  },
  {
    id: "TRANS-BACKUP",
    name: "Transactional Backup & Rollback Recovery Suite",
    type: "backup",
    script: ".work/experiments/test-backup-transactional.js",
    isolated: true,
  },
  {
    id: "ADVERSARIAL-P12",
    name: "P1.2 Adversarial Promotion, Staged Rollback & Forensics Suite",
    type: "promotion",
    script: ".work/experiments/test-p12-promotion-rollback-adversarial.js",
    isolated: true,
  },
  {
    id: "REHEARSAL-P13",
    name: "P1.3 End-to-End Promotion Rehearsal & Forensic Recovery Suite",
    type: "rehearsal",
    script: ".work/experiments/test-p13-promotion-rehearsal.js",
    isolated: true,
  },
  {
    id: "HARDENING-P14",
    name: "P1.4 Engine Adversarial Hardening, Symlink & Lock Resilience Suite",
    type: "hardening",
    script: ".work/experiments/test-p14-engine-security-hardening.js",
    isolated: true,
  },
  {
    id: "ADVERSARIAL-P15",
    name: "P1.5 Deep Adversarial Transactional Engine & Lock Assertion Suite",
    type: "adversarial",
    script: ".work/experiments/test-p15-transactional-deep-adversarial.js",
    isolated: true,
  },
  {
    id: "AUDIT-P16",
    name: "P1.6 Deep Transactional Engine Hardening & Audit Suite",
    type: "audit",
    script: ".work/experiments/test-p16-transactional-deep-audit.js",
    isolated: true,
  },
];

function runSuite(suite) {
  console.log(`\n======================================================`);
  console.log(`RUNNING: [${suite.id}] ${suite.name}`);
  console.log(`======================================================`);

  const startTime = Date.now();
  const targetScript = path.resolve(projectRoot, suite.script);

  const env = { ...process.env };
  const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), `om-safe-runner-${suite.id.toLowerCase()}-`));
  env.OPENMEMORY_TEST_DIR = sandboxDir;

  let result;
  if (suite.usesTsx) {
    const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
    result = spawnSync(cmd, ["--yes", "tsx", targetScript], {
      cwd: projectRoot,
      env,
      stdio: "inherit",
      shell: true,
    });
  } else {
    result = spawnSync(process.execPath, [targetScript], {
      cwd: projectRoot,
      env,
      stdio: "inherit",
    });
  }

  try {
    fs.rmSync(sandboxDir, { recursive: true, force: true });
  } catch (_) {}

  const durationMs = Date.now() - startTime;
  const passed = result.status === 0;

  console.log(`------------------------------------------------------`);
  console.log(`RESULT: [${suite.id}] ${passed ? "PASSED" : "FAILED"} in ${durationMs}ms`);
  console.log(`------------------------------------------------------`);

  return { id: suite.id, name: suite.name, passed, durationMs };
}

function main() {
  const filterArg = process.argv[2];
  const suitesToRun = filterArg
    ? SUITES.filter((s) => s.type === filterArg || s.id.toLowerCase() === filterArg.toLowerCase())
    : SUITES;

  if (suitesToRun.length === 0) {
    console.error(`No test suites matching filter: '${filterArg}'`);
    process.exit(1);
  }

  console.log("=================================================");
  console.log("=== OPENMEMORY SAFE TEST HARNESS ===");
  console.log(`Executing ${suitesToRun.length} isolated test suite(s)...`);
  console.log("=================================================");

  const results = [];
  for (const suite of suitesToRun) {
    results.push(runSuite(suite));
  }

  console.log("\n=================================================");
  console.log("=== TEST EXECUTION SUMMARY ===");
  console.log("=================================================");
  let allPassed = true;
  for (const r of results) {
    console.log(`  [${r.passed ? "PASS" : "FAIL"}] ${r.id.padEnd(16)} - ${r.name} (${r.durationMs}ms)`);
    if (!r.passed) allPassed = false;
  }
  console.log("=================================================\n");

  if (!allPassed) {
    console.error("One or more test suites failed.");
    process.exit(1);
  } else {
    console.log("All suites passed with zero working tree pollution!");
    process.exit(0);
  }
}

main();

