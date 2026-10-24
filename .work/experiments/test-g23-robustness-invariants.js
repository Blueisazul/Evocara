/**
 * G23 Block D: Robustness and Ranking Invariants Test Suite
 * 
 * Deterministic verification of 10 fundamental information retrieval and
 * durability invariants for OpenMemory/Evocara storage engine.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { StorageEngine } = require(path.resolve(__dirname, '../../dist/storage.js'));

console.log("===================================================================");
console.log("  G23: Formal Robustness & Ranking Invariants Test Suite           ");
console.log("===================================================================");

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "om-g23-invariants-"));
const storage = new StorageEngine(sandbox);
storage.ensureStorageStructure();
storage.registerSession({ id: "inv-sess", agentId: "inv-agent", status: "ACTIVE" });

let passedCount = 0;
let totalCount = 0;

function runInvariant(id, name, testFn) {
  totalCount++;
  try {
    testFn();
    passedCount++;
    console.log(`  [PASS] ${id}: ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${id}: ${name}`);
    console.error(`         Error: ${err.message}`);
  }
}

// Seed sandbox with reference knowledge items
const refResearch = {
  id: "RES-INV-001",
  topic: "Inventory Architecture and QA Invariants",
  category: "ARCHITECTURE",
  tags: ["architecture", "invariants"],
  summary: "Reference research for invariant testing",
  status: "COMPLETED",
  items: [
    {
      id: "INV-ADR-ACTIVE",
      type: "DECISION",
      classification: "ARCHITECTURE",
      title: "ADR-010: Adopt Node SQLite for Inventory Persistence",
      content: "Official accepted standard: use node:sqlite for inventory persistence.",
      tags: ["sqlite", "database", "persistence"],
      lifecycleState: "ACCEPTED",
      confidence: 0.99
    },
    {
      id: "INV-ADR-STUFFED-SUPERSEDED",
      type: "OBSERVATION",
      classification: "PROPOSAL",
      title: "Proposal: PostgreSQL persistence database storage persistence database",
      content: "PostgreSQL persistence database storage persistence database storage persistence database storage for inventory persistence.",
      tags: ["postgresql", "database", "persistence", "storage"],
      lifecycleState: "SUPERSEDED",
      confidence: 0.90
    },
    {
      id: "INV-HISTORICAL-DOC",
      type: "DECISION",
      classification: "ARCHITECTURE",
      title: "Historical Architecture: Deprecated flat-file CSV catalog storage",
      content: "Prior to SQLite, InventoryHub stored all inventory records in flat CSV files on disk.",
      tags: ["historical", "deprecated", "csv", "catalog"],
      lifecycleState: "DEPRECATED",
      confidence: 0.85
    },
    {
      id: "INV-QA-EVIDENCE",
      type: "DISCOVERY",
      classification: "QA",
      title: "QA Verification: Phase 2c2 Latency Benchmarks and Stress Test",
      content: "Phase 2c2 test verification passed with 34/34 tests, p50 latency 1.2ms, p95 4.8ms under 100 concurrent requests.",
      tags: ["qa", "test", "verification", "latency", "benchmark"],
      lifecycleState: "VALIDATED",
      confidence: 0.98
    },
    {
      id: "INV-IRRELEVANT-ARCH",
      type: "NOTE",
      classification: "ARCHITECTURE",
      title: "CSS Stylesheet Guidelines for Dark Mode Theme",
      content: "Button borders should use 1px solid slate-800 with 4px border radius for high contrast dark mode.",
      tags: ["css", "styling", "ui"],
      lifecycleState: "ACCEPTED",
      confidence: 0.95
    }
  ]
};

storage.saveResearch(refResearch, "inv-agent", "inv-sess");

// -----------------------------------------------------------------------------
// Invariant Tests
// -----------------------------------------------------------------------------

// 1. INV-01: Active accepted decision over term-stuffed superseded proposal
runInvariant("INV-01", "Accepted decision outranks term-stuffed superseded proposal", () => {
  const query = "What persistence database storage does inventory use?";
  const hits = storage.queryKnowledgeItems({ query });
  assert(hits.length > 0, "Expected search results");
  assert.strictEqual(hits[0].item.id, "INV-ADR-ACTIVE", `Expected INV-ADR-ACTIVE #1, got ${hits[0].item.id}`);
  const supersededHit = hits.find(h => h.item.id === "INV-ADR-STUFFED-SUPERSEDED");
  if (supersededHit) {
    assert(hits[0].score > supersededHit.score * 2.0, "Active score must be > 2x superseded score despite term stuffing");
  }
});

// 2. INV-02: Explicit historical intent retrieves superseded/deprecated doc
runInvariant("INV-02", "Explicit historical query retrieves deprecated/superseded record #1", () => {
  const query = "Retrieve historical deprecated catalog storage format prior to SQLite";
  const hits = storage.queryKnowledgeItems({ query });
  assert(hits.length > 0, "Expected search results");
  assert.strictEqual(hits[0].item.id, "INV-HISTORICAL-DOC", `Expected INV-HISTORICAL-DOC #1, got ${hits[0].item.id}`);
});

// 3. INV-03: QA query prioritizes validated QA evidence
runInvariant("INV-03", "QA query prioritizes validated test and benchmark evidence", () => {
  const query = "What were the QA latency benchmarks and test verification results?";
  const hits = storage.queryKnowledgeItems({ query });
  assert(hits.length > 0, "Expected search results");
  assert.strictEqual(hits[0].item.id, "INV-QA-EVIDENCE", `Expected INV-QA-EVIDENCE #1, got ${hits[0].item.id}`);
  assert.strictEqual(hits[0].item.lifecycleState, "VALIDATED");
});

// 4. INV-04: Zero hallucination on unanswerable queries
runInvariant("INV-04", "Unanswerable out-of-domain query produces zero hallucinated top results", () => {
  const query = "Kubernetes Helm charts and Apache Kafka distributed event bus configuration";
  const hits = storage.queryKnowledgeItems({ query });
  const strongHits = hits.filter(h => h.score >= 0.5);
  assert.strictEqual(strongHits.length, 0, `Expected 0 strong hits, got ${strongHits.length}`);
});

// 5. INV-05: Category affinity alone cannot lift completely irrelevant item
runInvariant("INV-05", "Category affinity alone cannot promote an item with no lexical overlap", () => {
  const query = "sqlite database persistence storage";
  const hits = storage.queryKnowledgeItems({ query });
  const irrelevantInTop2 = hits.slice(0, 2).some(h => h.item.id === "INV-IRRELEVANT-ARCH");
  assert.strictEqual(irrelevantInTop2, false, "INV-IRRELEVANT-ARCH should not be in Top-2 despite ARCHITECTURE category");
});

// 6. INV-06: Strict Cross-Project Isolation
runInvariant("INV-06", "Strict project boundary isolation between separate storage sandboxes", () => {
  const sandboxB = fs.mkdtempSync(path.join(os.tmpdir(), "om-g23-proj-b-"));
  const storageB = new StorageEngine(sandboxB);
  storageB.ensureStorageStructure();
  storageB.registerSession({ id: "sess-b", agentId: "agent-b", status: "ACTIVE" });
  storageB.saveResearch({
    id: "RES-PROJ-B",
    topic: "Billing & Order Payments Service",
    category: "BILLING",
    summary: "OrderService Stripe tokens",
    status: "COMPLETED",
    items: [{
      id: "ORDER-SECRET-01",
      type: "SECRET",
      classification: "SECURITY",
      title: "Stripe Production API Keys and Webhook Secret",
      content: "sk_live_stripe_secret_key_prohibited_cross_leak",
      lifecycleState: "VALIDATED"
    }]
  }, "agent-b", "sess-b");

  // Query project A for secrets
  const hitsA = storage.queryKnowledgeItems({ query: "Stripe Production API Keys" });
  assert.strictEqual(hitsA.filter(h => h.item.id === "ORDER-SECRET-01").length, 0, "Project A leaked Project B secrets!");

  // Query project B for sqlite
  const hitsB = storageB.queryKnowledgeItems({ query: "node:sqlite persistence database" });
  assert.strictEqual(hitsB.filter(h => h.item.id === "INV-ADR-ACTIVE").length, 0, "Project B leaked Project A records!");

  fs.rmSync(sandboxB, { recursive: true, force: true });
});

// 7. INV-07: Cold-start recovery and byte-level state fidelity
runInvariant("INV-07", "Cold-start recovery maintains identical ranking and score fidelity", () => {
  // Query warm storage
  const warmHits = storage.queryKnowledgeItems({ query: "node sqlite persistence" });

  // Re-instantiate cold storage from same disk path
  const coldStorage = new StorageEngine(sandbox);
  const coldHits = coldStorage.queryKnowledgeItems({ query: "node sqlite persistence" });

  assert.strictEqual(warmHits.length, coldHits.length, "Hit counts must match across cold start");
  for (let i = 0; i < warmHits.length; i++) {
    assert.strictEqual(warmHits[i].item.id, coldHits[i].item.id, `Rank #${i+1} ID mismatch after cold start`);
    assert.strictEqual(warmHits[i].score, coldHits[i].score, `Rank #${i+1} score mismatch after cold start`);
  }
});

// 8. INV-08: Strict Ranking Determinism across 50 iterations
runInvariant("INV-08", "Strict ranking determinism across 50 repeat queries", () => {
  const query = "What persistence database storage does inventory use?";
  const baseline = storage.queryKnowledgeItems({ query });
  
  for (let iter = 0; iter < 50; iter++) {
    const run = storage.queryKnowledgeItems({ query });
    assert.strictEqual(run.length, baseline.length, `Iteration ${iter}: result count mismatch`);
    for (let i = 0; i < baseline.length; i++) {
      assert.strictEqual(run[i].item.id, baseline[i].item.id, `Iteration ${iter}: rank ${i} mismatch`);
      assert.strictEqual(run[i].score, baseline[i].score, `Iteration ${iter}: score ${i} mismatch`);
    }
  }
});

// 9. INV-09: Concurrent Append and Query Safety
runInvariant("INV-09", "Concurrent append operations and interleaved queries execute safely", () => {
  const asyncQueries = [];
  for (let i = 0; i < 20; i++) {
    // Interleave a write
    storage.saveResearch({
      id: `RES-CONCUR-${i}`,
      topic: `Concurrent Research Batch ${i}`,
      category: "CONCURRENCY",
      summary: `Test concurrent batch ${i}`,
      status: "COMPLETED",
      items: [{
        id: `CONCUR-ITEM-${i}`,
        type: "OBSERVATION",
        classification: "METRICS",
        title: `Concurrent Observation ${i}`,
        content: `Concurrent content stream chunk ${i} with sqlite verification`,
        lifecycleState: "VALIDATED"
      }]
    }, "inv-agent", "inv-sess");

    // Interleave a read
    const qHits = storage.queryKnowledgeItems({ query: "sqlite verification" });
    assert(Array.isArray(qHits), "Query must return array during concurrent writes");
  }
});

// 10. INV-10: Incomplete Metadata and Graceful Degradation
runInvariant("INV-10", "Graceful degradation when handling items with undefined or minimal metadata", () => {
  storage.saveResearch({
    id: "RES-BARE-001",
    topic: "Bare Minimal Research",
    category: undefined,
    summary: undefined,
    status: "COMPLETED",
    items: [
      {
        id: "BARE-ITEM-01",
        type: undefined,
        classification: undefined,
        title: "Bare Minimal Item Without Tags or Metadata",
        content: "Minimal text for sqlite queries",
        lifecycleState: undefined
      }
    ]
  }, "inv-agent", "inv-sess");

  const hits = storage.queryKnowledgeItems({ query: "Minimal text for sqlite" });
  assert(hits.length > 0, "Must successfully score bare items without crashing");
  assert.strictEqual(hits[0].item.id, "BARE-ITEM-01");
});

console.log("-------------------------------------------------------------------");
console.log(`Invariant Test Results: ${passedCount} / ${totalCount} PASSED`);
console.log("-------------------------------------------------------------------");

// Clean up sandbox
fs.rmSync(sandbox, { recursive: true, force: true });

if (passedCount !== totalCount) {
  process.exit(1);
}
console.log("All ranking and robustness invariants VERIFIED.");
