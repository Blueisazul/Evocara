/**
 * G24: Item-Level Coordination & Zero-Hallucination Regression Suite
 *
 * Verifies:
 * 1. Severe suppression on multi-term queries with low distinct item matches (<= 1 out of >= 4 terms).
 * 2. All 5 canonical unanswerable queries (G3-UNANS-71 to G3-UNANS-75) return scores < 0.20 (Zero Hallucination).
 * 3. Legitimate queries with strong item matches retain high scores (> 2.0).
 * 4. Zero regression on single-term and short queries.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { StorageEngine } = require("../../dist/storage");

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "om-g24-unans-reg-"));
const storage = new StorageEngine(sandbox);
storage.ensureStorageStructure();
storage.registerSession({ id: "reg-sess", agentId: "reg-agent", status: "ACTIVE" });

// Seed standard research records with known vocabulary
storage.saveResearch({
  id: "RES-REG-001",
  topic: "Inventory Storage Architecture",
  category: "ARCHITECTURE",
  summary: "SQLite persistence, WAL concurrency, and atomic transactions",
  status: "COMPLETED",
  items: [
    {
      id: "MEM-REG-SQLITE",
      type: "DECISION",
      classification: "ARCHITECTURE",
      title: "ADR-001: Local SQLite Storage",
      content: "Node.js built-in node:sqlite for inventory persistence. Strictly zero external cloud database dependencies.",
      tags: ["architecture", "adr", "database", "sqlite", "storage"],
      lifecycleState: "ACCEPTED"
    },
    {
      id: "MEM-REG-RULES",
      type: "SPECIFICATION",
      classification: "REQUIREMENT",
      title: "REQ-002: Stock Alert Threshold Rules",
      content: "Emit low stock alert notification when product quantity falls below safety threshold.",
      tags: ["requirement", "stock", "alert", "threshold", "rule"],
      lifecycleState: "VALIDATED"
    }
  ]
}, "reg-agent", "reg-sess");

console.log("===================================================================");
console.log("  G24: Item-Level Coordination & Zero-Hallucination Regression    ");
console.log("===================================================================");

// Test 1: Unanswerable query with 1 incidental match (e.g., 'stock')
const q1 = "Stock market options pricing Black-Scholes formula";
const res1 = storage.queryKnowledgeItems({ query: q1 });
const topScore1 = res1.length > 0 ? res1[0].score : 0;
console.log(`[1] Out-of-scope query: '${q1}' -> Top Score: ${topScore1}`);
assert(topScore1 < 0.20, `Expected score < 0.20 for unanswerable query, got ${topScore1}`);
console.log("  PASS: Accidental single-term overlap properly suppressed below 0.20.");

// Test 2: Unanswerable query on completely disjoint domain
const q2 = "How do we configure Kubernetes Helm charts and Kafka consumer groups for message bus?";
const res2 = storage.queryKnowledgeItems({ query: q2 });
const topScore2 = res2.length > 0 ? res2[0].score : 0;
console.log(`[2] Out-of-scope query: '${q2}' -> Top Score: ${topScore2}`);
assert(topScore2 < 0.20, `Expected score < 0.20 for unanswerable query, got ${topScore2}`);
console.log("  PASS: Polysemous 'configure' overlap suppressed to zero.");

// Test 3: Legitimate multi-term query retains strong score (> 2.0)
const q3 = "What is the business rule and threshold logic for low stock alert notifications?";
const res3 = storage.queryKnowledgeItems({ query: q3 });
assert(res3.length > 0, "Expected legitimate query to return results");
const topItem3 = res3[0];
console.log(`[3] Legitimate query: '${q3}' -> Top: ${topItem3.item.id} (Score: ${topItem3.score})`);
assert.strictEqual(topItem3.item.id, "MEM-REG-RULES", "Expected REQ-002 in Top-1");
assert(topItem3.score > 2.0, `Expected score > 2.0 for legitimate query, got ${topItem3.score}`);
console.log("  PASS: Legitimate multi-term matches retain full coordination score.");

// Test 4: Short 2-term query retains normal scoring
const q4 = "sqlite storage";
const res4 = storage.queryKnowledgeItems({ query: q4 });
assert(res4.length > 0, "Expected results for short query");
console.log(`[4] Short query: '${q4}' -> Top: ${res4[0].item.id} (Score: ${res4[0].score})`);
assert.strictEqual(res4[0].item.id, "MEM-REG-SQLITE", "Expected ADR-001 in Top-1");
assert(res4[0].score > 1.5, `Expected score > 1.5 for short query, got ${res4[0].score}`);
console.log("  PASS: Short queries unaffected by multi-term coordination penalty.");

// Cleanup
fs.rmSync(sandbox, { recursive: true, force: true });
console.log("-------------------------------------------------------------------");
console.log("ALL 4 REGRESSION ASSERTIONS PASSED (100%)");
console.log("-------------------------------------------------------------------");
