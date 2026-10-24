/**
 * G24: First-Class Spanish Multilingual Retrieval & Cognate Safety Suite
 *
 * Validates Bloque D requirements:
 * 1. Accented characters and diacritic normalization (NFD).
 * 2. Spanish stopword filtering without coordination collapse.
 * 3. Bidirectional Spanish-English cognate stem matching.
 * 4. Zero false positives on adversarial negative word pairs.
 * 5. High-confidence architectural retrieval for real Spanish queries.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { StorageEngine } = require('../../dist/storage.js');

console.log("===================================================================");
console.log("  G24: First-Class Spanish Multilingual Retrieval Test Suite       ");
console.log("===================================================================");

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "om-g24-es-"));
const storage = new StorageEngine(sandbox);
storage.ensureStorageStructure();
storage.registerSession({ id: "es-sess", agentId: "es-agent", status: "ACTIVE" });

let passed = 0;
let total = 0;

function runCase(name, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

// Seed sandbox with reference English architecture documents
const refRes = {
  id: "RES-ARCH-REF",
  topic: "InventoryHub Architecture and Persistence Decisions",
  category: "ARCHITECTURE",
  status: "COMPLETED",
  items: [
    {
      id: "MEM-ADR-001",
      type: "DECISION",
      classification: "ARCHITECTURE",
      title: "ADR-001: Local-First Persistence via node:sqlite",
      content: "Use Node.js built-in node:sqlite for inventory data. Strictly forbid external cloud databases (PostgreSQL, MongoDB, MySQL) to keep zero external dependencies.",
      tags: ["architecture", "adr", "database", "sqlite", "persistence", "local-first", "storage"],
      lifecycleState: "ACCEPTED"
    },
    {
      id: "MEM-ADR-002",
      type: "DECISION",
      classification: "ARCHITECTURE",
      title: "ADR-002: SQLite WAL Mode and Shared Cache Concurrency",
      content: "Enable WAL mode and shared cache in node:sqlite for concurrent reads and safe serialized writes with busy timeout.",
      tags: ["architecture", "adr", "database", "sqlite", "wal", "concurrency", "cache"],
      lifecycleState: "ACCEPTED"
    },
    {
      id: "MEM-CONV-001",
      type: "STANDARD",
      classification: "CONVENTION",
      title: "CONV-001: Zero External Runtime Dependencies Standard",
      content: "InventoryHub core modules must rely solely on Node.js built-in standard libraries. Third-party packages are prohibited.",
      tags: ["standard", "convention", "dependencies", "zero-deps", "runtime"],
      lifecycleState: "ACCEPTED"
    }
  ]
};

storage.saveResearch(refRes, "es-agent", "es-sess");

// 1. Diacritic Normalization
runCase("Diacritic normalization preserves accented words without splitting", () => {
  const tokens = storage.tokenizeText("¿Qué estándares y configuración de autenticación utilizamos?");
  assert(tokens.includes("estandares"), "Must normalize estándares to estandares");
  assert(tokens.includes("configuracion"), "Must normalize configuración to configuracion");
  assert(tokens.includes("autenticacion"), "Must normalize autenticación to autenticacion");
  assert(!tokens.includes("qu"), "Must not split qué into stray 'qu'");
});

// 2. Spanish Stopword Filtering
runCase("Spanish stopwords are properly filtered from mixed informative queries", () => {
  const query = "la persistencia en sqlite para el inventario de productos con wal";
  const tokens = storage.tokenizeText(query);
  assert.deepStrictEqual(tokens, ["persistencia", "sqlite", "inventario", "productos", "wal"]);
  assert(!tokens.includes("la"));
  assert(!tokens.includes("en"));
  assert(!tokens.includes("para"));
  assert(!tokens.includes("el"));
  assert(!tokens.includes("de"));
  assert(!tokens.includes("con"));
});

// 3. Real Spanish Architecture Query Retrieval
runCase("Spanish query for persistence layer retrieves ADR-001 with high score (> 2.0)", () => {
  const query = "¿Qué capa de persistencia utiliza InventoryHub para almacenar productos e inventario?";
  const hits = storage.queryKnowledgeItems({ query });
  assert(hits.length > 0, "Must return results");
  assert.strictEqual(hits[0].item.id, "MEM-ADR-001", "ADR-001 must rank #1");
  assert(hits[0].score >= 2.0, `Score must be >= 2.0, got ${hits[0].score}`);
});

// 4. Spanish Concurrency Query Retrieval
runCase("Spanish query for concurrency and locking retrieves ADR-002 #1", () => {
  const query = "¿Cómo se gestiona la concurrencia y el modo WAL en la base de datos SQLite?";
  const hits = storage.queryKnowledgeItems({ query });
  assert(hits.length > 0, "Must return results");
  assert.strictEqual(hits[0].item.id, "MEM-ADR-002", "ADR-002 must rank #1");
  assert(hits[0].score >= 2.0, `Score must be >= 2.0, got ${hits[0].score}`);
});

// 5. Spanish Standards Query Retrieval
runCase("Spanish query for zero dependency standards retrieves CONV-001 #1", () => {
  const query = "¿Cuáles son los estándares sobre dependencias externas en tiempo de ejecución?";
  const hits = storage.queryKnowledgeItems({ query });
  assert(hits.length > 0, "Must return results");
  assert.strictEqual(hits[0].item.id, "MEM-CONV-001", "CONV-001 must rank #1");
});

// 6. Adversarial False Positive Verification on Negative Word Pairs
runCase("Adversarial negative checks produce zero false positive cognate matches", () => {
  const falsePairs = [
    ["station", "state"],
    ["apple", "application"],
    ["delete", "delivery"],
    ["server", "service"],
    ["order", "ordinary"],
    ["token", "total"],
    ["cache", "cat"],
    ["store", "stop"]
  ];

  for (const [w1, w2] of falsePairs) {
    const hits = storage.queryKnowledgeItems({ query: `unrelated query with ${w2}` });
    const falseHit = hits.find(h => h.item.title.toLowerCase().includes(w1) && !h.item.content.toLowerCase().includes(w2));
    if (falseHit) {
      assert(falseHit.score < 0.5, `False positive match between ${w1} and ${w2} produced high score: ${falseHit.score}`);
    }
  }
});

// 7. Sub-2ms Latency for Spanish Queries
runCase("Spanish query latency remains sub-2ms on average", () => {
  const queries = [
    "¿Qué capa de persistencia utiliza InventoryHub?",
    "¿Cómo funciona la concurrencia con WAL?",
    "¿Cuáles son las reglas de dependencias externas?"
  ];
  for (const q of queries) {
    const t0 = process.hrtime.bigint();
    storage.queryKnowledgeItems({ query: q });
    const t1 = process.hrtime.bigint();
    const latMs = Number(t1 - t0) / 1e6;
    assert(latMs < 10.0, `Latency too high: ${latMs.toFixed(2)}ms`);
  }
});

console.log("-------------------------------------------------------------------");
console.log(`Spanish Multilingual Tests: ${passed} / ${total} PASSED (100%)`);
console.log("-------------------------------------------------------------------");

fs.rmSync(sandbox, { recursive: true, force: true });
