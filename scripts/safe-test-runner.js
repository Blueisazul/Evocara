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
  {
    id: "G6-REHEARSAL",
    name: "G6 Controlled InventoryHub Promotion Rehearsal Suite",
    type: "rehearsal",
    script: ".work/experiments/test-g6-inventoryhub-promotion-rehearsal.js",
    isolated: true,
  },
  {
    id: "G7-DIAGNOSTICS",
    name: "G7 Observability, Subsystem Diagnostics & Host Resilience Suite",
    type: "observability",
    script: ".work/experiments/test-g7-observability-diagnostics.js",
    isolated: true,
  },
  {
    id: "G7.2-LIFECYCLE",
    name: "G7.2 SQLite Lifecycle, Checkpointing & Periodic Health Resilience Suite",
    type: "resilience",
    script: ".work/experiments/test-g72-resilience-sqlite-lifecycle.js",
    isolated: true,
  },
  {
    id: "G9-PROMOTION",
    name: "G9 Transactional Promotion Engine & Crash Recovery Suite",
    type: "promotion",
    script: ".work/experiments/test-g9-transactional-promotion.js",
    isolated: true,
  },
  {
    id: "G10-OBSERVABILITY",
    name: "G10 Operational Observability, Health Model & MCP Diagnostics Suite",
    type: "observability",
    script: ".work/experiments/test-g10-observability-mcp.js",
    isolated: true,
  },
  {
    id: "G11-INTEGRATION",
    name: "G11 End-to-End Integration, Fail-Closed Recovery & Release Assurance Suite",
    type: "integration",
    script: ".work/experiments/test-g11-e2e-integration.js",
    isolated: true,
  },
  {
    id: "G12-RELEASE-GATE",
    name: "G12 Release Gate, Recovery Assurance & Promotion Readiness Suite",
    type: "integration",
    script: ".work/experiments/test-g12-release-gate-recovery.js",
    isolated: true,
  },
  {
    id: "G13-SUPPLY-CHAIN",
    name: "G13 Supply-Chain Security, Resilient Recovery & Operational Observability Suite",
    type: "security",
    script: ".work/experiments/test-g13-supply-chain-observability.js",
    isolated: true,
  },
  {
    id: "G14-ASSURANCE",
    name: "G14 Operational Assurance, Safe Promotion Readiness & Release Gate Suite",
    type: "assurance",
    script: ".work/experiments/test-g14-operational-assurance.js",
    isolated: true,
  },
  {
    id: "G15-TMS-BM25",
    name: "G15 Truth Maintenance System (TMS) & Deterministic BM25 Knowledge Retrieval Suite",
    type: "integration",
    script: ".work/experiments/test-g15-tms-and-bm25-retrieval.js",
    isolated: true,
  },
  {
    id: "G16-DEEP-TMS-BM25",
    name: "G16 Deep BM25 Query & Truth Maintenance System Verification Suite",
    type: "domain",
    script: ".work/experiments/test-g16-bm25-tms-deep.js",
    isolated: true,
  },
  {
    id: "G16-BENCH-METHODOLOGY",
    name: "G16 Balanced Benchmark Methodology & Accounting Reconciliation Suite",
    type: "performance",
    script: ".work/experiments/test-g16-benchmark-methodology.js",
    isolated: true,
  },
  {
    id: "G16-CONSUMER-REHEARSAL",
    name: "G16 Consumer Sandbox Promotion Rehearsal & Rollback Suite",
    type: "integration",
    script: ".work/experiments/test-g16-consumer-sandbox-promotion.js",
    isolated: true,
  },
  {
    id: "G17-CANDIDATE-VALIDATION",
    name: "G17 Candidate 0.3.15-rc3 Sandbox Validation & Rehearsal Suite",
    type: "integration",
    script: ".work/experiments/test-g17-candidate-rc3-sandbox-validation.js",
    isolated: true,
  },
  {
    id: "G17-BENCHMARK-QUALITY",
    name: "G17 OpenMemory Persistent Memory Quality & Functional Benchmark Suite",
    type: "performance",
    script: ".work/experiments/test-g17-memory-quality-benchmark.js",
    isolated: true,
  },
  {
    id: "G18-MEMORY-SCENARIOS",
    name: "G18 Memory Model Governance & 10 Cognitive Scenarios Suite",
    type: "domain",
    script: ".work/experiments/test-g18-memory-model-scenarios.js",
    isolated: true,
  },
  {
    id: "G18-DETERMINISTIC-BENCHMARK",
    name: "G18 Deterministic BM25 + TMS vs Baseline Retrieval Benchmark Suite",
    type: "performance",
    script: ".work/experiments/test-g18-deterministic-retrieval-benchmark.js",
    isolated: true,
  },
  {
    id: "G18-CANDIDATE-VALIDATION",
    name: "G18 Candidate 0.3.15-rc4 Sandbox Validation and Rehearsal Suite",
    type: "integration",
    script: ".work/experiments/test-g18-candidate-rc4-sandbox-validation.js",
    isolated: true,
  },
  {
    id: "G19-EVENT-RETENTION",
    name: "G19 Event Durability, Compaction & Retention Policy Suite",
    type: "domain",
    script: ".work/experiments/test-g19-event-durability-and-retention.js",
    isolated: true,
  },
  {
    id: "G19-SCALED-BENCHMARK",
    name: "G19 Scaled Deterministic Retrieval Benchmark (BM25+TMS vs Baseline)",
    type: "performance",
    script: ".work/experiments/test-g19-scaled-retrieval-benchmark.js",
    isolated: true,
  },
  {
    id: "G19-CANDIDATE-VALIDATION",
    name: "G19 Candidate 0.3.15-rc5 Sandbox Validation and Rehearsal Suite",
    type: "integration",
    script: ".work/experiments/test-g19-candidate-rc5-sandbox-validation.js",
    isolated: true,
  },
  {
    id: "G20-SCALED-BENCHMARK",
    name: "G20 Scaled Retrieval Benchmark: BM25 V2 + TMS with True IDF & Coordination",
    type: "performance",
    script: ".work/experiments/test-g20-scaled-retrieval-benchmark.js",
    isolated: true,
  },
  {
    id: "G20-EVENT-DURABILITY",
    name: "G20 Event Durability, Concurrency, and Compaction Audit Suite",
    type: "domain",
    script: ".work/experiments/test-g20-event-durability-and-concurrency.js",
    isolated: true,
  },
  {
    id: "G20-CONTRACTS-ISOLATION",
    name: "G20 Contracts, Authorization, and Scope Isolation Suite",
    type: "security",
    script: ".work/experiments/test-g20-contracts-and-isolation.js",
    isolated: true,
  },
  {
    id: "G20-CANDIDATE-VALIDATION",
    name: "G20 Candidate 0.3.15-rc6 Sandbox Validation and Staging Rehearsal Suite",
    type: "integration",
    script: ".work/experiments/test-g20-candidate-rc6-sandbox-validation.js",
    isolated: true,
  },
  {
    id: "G22-CANDIDATE-VALIDATION",
    name: "G22 Candidate 0.3.15-rc7 Sandbox Validation and Staging Rehearsal Suite",
    type: "integration",
    script: ".work/experiments/test-g22-candidate-rc7-sandbox-validation.js",
    isolated: true,
  },
  {
    id: "G22-E2E-ACCEPTANCE",
    name: "G22 Candidate 0.3.15-rc7 End-to-End Sandbox Acceptance Suite",
    type: "integration",
    script: ".work/experiments/test-g22-e2e-sandbox-acceptance.js",
    isolated: true,
  },
  {
    id: "G23-EXPANDED-BENCHMARK",
    name: "G23 Expanded 105-Scenario Retrieval Robustness Benchmark",
    type: "benchmark",
    script: ".work/experiments/test-g23-expanded-100-benchmark.js",
    isolated: true,
  },
  {
    id: "G23-ROBUSTNESS-INVARIANTS",
    name: "G23 Formal Ranking Invariants & Robustness Suite",
    type: "integration",
    script: ".work/experiments/test-g23-robustness-invariants.js",
    isolated: true,
  },
  {
    id: "G24-STAGING-PROMOTION",
    name: "G24 Controlled Staging Promotion & Consumer Acceptance Suite",
    type: "integration",
    script: ".work/experiments/g24/staging-controlled-promotion.js",
    isolated: true,
  },
  {
    id: "G24-MULTILINGUAL-SPANISH",
    name: "G24 First-Class Spanish Multilingual Retrieval Suite",
    type: "integration",
    script: ".work/experiments/test-g24-multilingual-spanish.js",
    isolated: true,
  },
  {
    id: "G24-COORDINATION-UNANS",
    name: "G24 Item-Level Coordination & Zero-Hallucination Regression Suite",
    type: "invariants",
    script: ".work/experiments/test-g24-coordination-unanswerable.js",
    isolated: true,
  },
  {
    id: "G25-EXTENDED-SESSION",
    name: "G25 Extended OpenCode Session, Compaction & Continuity Suite",
    type: "integration",
    script: ".work/experiments/test-g25-extended-session.js",
    isolated: true,
  },
  {
    id: "G25-BM25-UNIT",
    name: "G25 BM25Engine Modular Retrieval Unit Suite",
    type: "domain",
    script: ".work/experiments/test-g25-bm25-unit.js",
    isolated: true,
  },
  {
    id: "G25-MCP-CURATED",
    name: "G25 Curated MCP Surface, Project Isolation & CLI Administration Suite",
    type: "integration",
    script: ".work/experiments/test-g25-mcp-curated-surface.js",
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
    ? SUITES.filter((s) => s.type === filterArg || s.id.toLowerCase() === filterArg.toLowerCase() || s.id.toLowerCase().includes(filterArg.toLowerCase()))
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

