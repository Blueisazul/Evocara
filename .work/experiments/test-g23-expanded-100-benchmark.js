/**
 * G23: Expanded 100+ Scenario Robustness and Retrieval Benchmark
 *
 * Implements Bloques B, C & D of Iteración G23:
 * Evaluates OpenMemory / Evocara retrieval across 105 reproducible evaluation scenarios:
 *
 * Groups:
 *   1. GROUNDED_REAL (35 scenarios) - Real InventoryHub engineering decisions, requirements, QA, conventions.
 *   2. SYNTHETIC    (30 scenarios) - Paraphrasing, ambiguous terms, TMS states, duplicate resolution.
 *   3. ADVERSARIAL  (25 scenarios) - Lexical distractors, unanswerable zero-hallucination, cross-project isolation.
 *   4. EXPLORATORY  (15 scenarios) - Extreme query lengths, rare vocabulary, incomplete metadata, exploratory.
 *
 * Compares:
 *   - Candidate rc6 retrieval logic (G20 Baseline)
 *   - Candidate rc7 retrieval logic (G22 Hardened BM25 V2 + TMS + Category Affinity)
 *
 * Computes:
 *   Success@1, Precision@1, Precision@3, Recall@3, MRR, Obsolete in Top-1, Obsolete in Top-3,
 *   False Discovery Rate on Unanswerable queries, and Latency p50 / p95.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const projectRoot = process.env.OPENMEMORY_ROOT || path.resolve(__dirname, "../..");
const { StorageEngine } = require(path.resolve(projectRoot, "dist/storage"));

// -----------------------------------------------------------------------------
// 1. Comprehensive Multi-Domain Corpus (Grounded + Multi-Project + Synthetic)
// -----------------------------------------------------------------------------

const EXPANDED_CORPUS = [
  // --- INVENTORYHUB ARCHITECTURE ---
  {
    id: "RES-IH-ADRS",
    topic: "InventoryHub Architectural Decisions",
    category: "ARCHITECTURE",
    summary: "Canonical architectural decision records governing local-first persistence, WAL concurrency, and zero external dependencies",
    status: "COMPLETED",
    items: [
      {
        id: "MEM-ADR-001",
        type: "DECISION",
        classification: "ARCHITECTURE",
        title: "ADR-001: Local-First Persistence via node:sqlite",
        content: "Use Node.js built-in node:sqlite for inventory data. Strictly forbid external cloud databases (PostgreSQL, MongoDB, MySQL) to keep zero external dependencies.",
        tags: ["architecture", "adr", "database", "sqlite", "persistence", "local-first", "storage"],
        source: "docs/adr/001-local-sqlite.md",
        confidence: 0.99,
        lifecycleState: "ACCEPTED",
      },
      {
        id: "MEM-ADR-002",
        type: "DECISION",
        classification: "ARCHITECTURE",
        title: "ADR-002: SQLite WAL Mode and Shared Cache Concurrency",
        content: "Enable WAL mode and shared cache in node:sqlite for concurrent reads and safe serialized writes with busy timeout.",
        tags: ["architecture", "adr", "database", "sqlite", "wal", "concurrency", "cache", "store"],
        source: "docs/adr/002-sqlite-wal.md",
        confidence: 0.99,
        lifecycleState: "ACCEPTED",
      },
      {
        id: "MEM-ADR-004",
        type: "DECISION",
        classification: "ARCHITECTURE",
        title: "ADR-004: Filesystem Authority and Rejection of Cloud Sync",
        content: "The local filesystem remains the sole source of truth for inventory records. Cloud bucket replication is strictly prohibited.",
        tags: ["architecture", "adr", "authority", "filesystem", "cloud", "sync", "storage"],
        source: "docs/adr/004-filesystem-authority.md",
        confidence: 0.98,
        lifecycleState: "ACCEPTED",
      },
      {
        id: "MEM-ADR-005",
        type: "DECISION",
        classification: "ARCHITECTURE",
        title: "ADR-005: Idempotent Inventory Mutation Transactions",
        content: "All product stock mutations must be wrapped in atomic SQLite transactions with strict rollback on failure.",
        tags: ["architecture", "adr", "transaction", "mutation", "atomic", "rollback"],
        source: "docs/adr/005-atomic-transactions.md",
        confidence: 0.99,
        lifecycleState: "ACCEPTED",
      },
      {
        id: "MEM-PROP-005",
        type: "OBSERVATION",
        classification: "PROPOSAL",
        title: "Proposal: Migrate Inventory Data to MongoDB Atlas Cloud Cluster",
        content: "Historical proposal to migrate all inventory schema and product tables to MongoDB Atlas cluster for cloud scaling.",
        tags: ["mongodb", "atlas", "cloud", "database", "cluster", "migration"],
        source: "proposals/mongodb-migration.md",
        confidence: 0.60,
        lifecycleState: "SUPERSEDED",
      },
      {
        id: "MEM-PROP-009",
        type: "OBSERVATION",
        classification: "PROPOSAL",
        title: "Proposal: Sync Local SQLite to S3 Bucket Replica",
        content: "Proposal to replicate local SQLite files to Amazon S3 bucket on interval. Rejected by ADR-004.",
        tags: ["cloud", "s3", "bucket", "sync", "backup", "replication"],
        source: "proposals/s3-sync.md",
        confidence: 0.50,
        lifecycleState: "SUPERSEDED",
      },
      {
        id: "MEM-DRAFT-008",
        type: "OBSERVATION",
        classification: "DRAFT",
        title: "Draft RFC: PostgreSQL for Inventory Scale",
        content: "Early draft exploring PostgreSQL relational database storage for high concurrency inventory tracking.",
        tags: ["database", "postgres", "storage", "scale", "concurrency"],
        source: "drafts/postgres-rfc.md",
        confidence: 0.40,
        lifecycleState: "DRAFT",
      },
      {
        id: "MEM-HIST-010",
        type: "OBSERVATION",
        classification: "HISTORICAL",
        title: "Historical Record: Legacy JSON File Storage Protocol (2024)",
        content: "Original flat JSON file storage protocol used prior to the adoption of node:sqlite in ADR-001.",
        tags: ["historical", "legacy", "json", "filesystem", "flat-file"],
        source: "archive/legacy-json-storage.md",
        confidence: 0.90,
        lifecycleState: "DEPRECATED",
      }
    ],
    relations: [
      { sourceItemId: "MEM-PROP-005", targetItemId: "MEM-ADR-001", relationType: "SUPERSEDED_BY" },
      { sourceItemId: "MEM-PROP-009", targetItemId: "MEM-ADR-004", relationType: "CONTRADICTS" },
      { sourceItemId: "MEM-DRAFT-008", targetItemId: "MEM-ADR-001", relationType: "PROPOSES" },
      { sourceItemId: "MEM-HIST-010", targetItemId: "MEM-ADR-001", relationType: "SUPERSEDED_BY" }
    ],
  },

  // --- INVENTORYHUB REQUIREMENTS ---
  {
    id: "RES-IH-REQ",
    topic: "InventoryHub Business Requirements",
    category: "REQUIREMENTS",
    summary: "Product inventory threshold rules, low stock alerting, and batch auditing",
    status: "COMPLETED",
    items: [
      {
        id: "MEM-REQ-002",
        type: "SPECIFICATION",
        classification: "REQUIREMENT",
        title: "REQ-002: Automated Low-Stock Alerting Rule",
        content: "When available quantity of any SKU falls strictly below threshold (default 10 units), an automated ALERT event must trigger immediately with critical severity.",
        tags: ["requirement", "rules", "alert", "threshold", "stock", "warehouse", "notification"],
        source: "specs/low-stock-alert.md",
        confidence: 0.95,
        lifecycleState: "VALIDATED",
      },
      {
        id: "MEM-REQ-006",
        type: "SPECIFICATION",
        classification: "REQUIREMENT",
        title: "REQ-006: Batch Expiration and Quarantine Protocol",
        content: "Perishable items within 7 days of expiration date must be automatically quarantined from pick lists.",
        tags: ["requirement", "batch", "expiration", "quarantine", "pick-list", "warehouse"],
        source: "specs/batch-expiration.md",
        confidence: 0.95,
        lifecycleState: "VALIDATED",
      },
      {
        id: "MEM-REQ-007",
        type: "SPECIFICATION",
        classification: "REQUIREMENT",
        title: "REQ-007: Multi-Currency Price Calculation",
        content: "Product inventory valuations must calculate dynamically against daily currency exchange rates.",
        tags: ["requirement", "pricing", "currency", "valuation", "finance"],
        source: "specs/pricing-rules.md",
        confidence: 0.90,
        lifecycleState: "VALIDATED",
      }
    ],
    relations: [],
  },

  // --- INVENTORYHUB CONVENTIONS & STANDARDS ---
  {
    id: "RES-IH-CONV",
    topic: "InventoryHub Conventions and Code Standards",
    category: "STANDARDS",
    summary: "Engineering rules, strict zero external dependencies, ESLint standards",
    status: "COMPLETED",
    items: [
      {
        id: "MEM-CONV-001",
        type: "STANDARD",
        classification: "CONVENTION",
        title: "CONV-001: Zero External Runtime Dependencies Standard",
        content: "InventoryHub core modules must rely solely on Node.js built-ins. All external production npm packages are strictly prohibited to ensure maximum portability.",
        tags: ["standard", "convention", "dependencies", "zero-deps", "node", "runtime"],
        source: "docs/conventions/zero-deps.md",
        confidence: 0.99,
        lifecycleState: "ACCEPTED",
      },
      {
        id: "MEM-CONV-002",
        type: "STANDARD",
        classification: "CONVENTION",
        title: "CONV-002: Deterministic Error Handling and Exit Codes",
        content: "CLI and background tools must terminate with deterministic numeric exit codes: 0 for success, 1 for fatal errors, 2 for validation failure.",
        tags: ["standard", "convention", "cli", "exit-codes", "error-handling"],
        source: "docs/conventions/exit-codes.md",
        confidence: 0.95,
        lifecycleState: "ACCEPTED",
      }
    ],
    relations: [],
  },

  // --- INVENTORYHUB QA & TEST RESULTS ---
  {
    id: "RES-IH-QA",
    topic: "InventoryHub Verification and QA Reports",
    category: "QA",
    summary: "Empirical verification test suites, latency benchmarks, and regression coverage",
    status: "COMPLETED",
    items: [
      {
        id: "MEM-TEST-003",
        type: "EVIDENCE",
        classification: "TEST",
        title: "QA-003: Phase 2c2 Inventory Manager E2E Verification Report",
        content: "Executed 34 automated business tests against inventory manager. 100% pass rate. Average query latency p50 was 0.42ms, p95 1.15ms. Zero database corruptions.",
        tags: ["test", "verification", "latency", "benchmark", "pass", "e2e", "qa"],
        source: "reports/qa/phase-2c2-results.md",
        confidence: 0.99,
        lifecycleState: "VALIDATED",
      },
      {
        id: "MEM-TEST-006",
        type: "EVIDENCE",
        classification: "TEST",
        title: "QA-006: High-Concurrency Lock Contention Stress Test",
        content: "Simulated 50 concurrent writer processes against node:sqlite in WAL mode. Zero torn writes, zero SQLITE_BUSY deadlocks observed.",
        tags: ["test", "concurrency", "lock", "stress", "sqlite", "wal", "qa"],
        source: "reports/qa/stress-test-wal.md",
        confidence: 0.95,
        lifecycleState: "VALIDATED",
      }
    ],
    relations: [],
  },

  // --- INVENTORYHUB RESEARCH & FINDINGS ---
  {
    id: "RES-IH-RESEARCH",
    topic: "InventoryHub Research and Technical Findings",
    category: "RESEARCH",
    summary: "Investigations into database locks, memory limits, and process lifecycle",
    status: "COMPLETED",
    items: [
      {
        id: "MEM-RES-004",
        type: "OBSERVATION",
        classification: "RESEARCH",
        title: "RES-004: node:sqlite WAL Concurrency and Shared Cache Limitations",
        content: "Benchmark finding: node:sqlite WAL mode scales up to 100 concurrent readers without latency degradation. Serialized writes require busy timeout set to at least 3000ms.",
        tags: ["research", "concurrency", "locking", "wal", "sqlite", "benchmark", "finding"],
        source: "research/sqlite-concurrency-findings.md",
        confidence: 0.92,
        lifecycleState: "VALIDATED",
      },
      {
        id: "MEM-RES-008",
        type: "OBSERVATION",
        classification: "RESEARCH",
        title: "RES-008: Windows NTFS Timestamp Granularity in Temporary Files",
        content: "Empirical discovery: Windows NTFS stat.mtimeMs can exhibit fractional sub-millisecond precision ahead of Date.now(), requiring explicit maxAgeMs <= 0 purge rules.",
        tags: ["research", "ntfs", "windows", "filesystem", "timestamps", "mtime", "finding"],
        source: "research/ntfs-timestamps.md",
        confidence: 0.96,
        lifecycleState: "VALIDATED",
      }
    ],
    relations: [],
  },

  // --- TELEMETRY & MONITORING (VOCABULARY OVERLAP FIXTURE) ---
  {
    id: "RES-IH-TELEMETRY",
    topic: "InventoryHub Telemetry and Metrics",
    category: "OPERATIONS",
    summary: "Real-time Prometheus telemetry exporters and logging for low-stock alerts",
    status: "COMPLETED",
    items: [
      {
        id: "MEM-TEL-007",
        type: "OBSERVATION",
        classification: "TELEMETRY",
        title: "TEL-007: Real-Time Prometheus Low-Stock Telemetry Gauge",
        content: "Prometheus gauge inventory_low_stock_count published every 60s. Emits alerting metric when inventory items fall below safety threshold.",
        tags: ["telemetry", "prometheus", "alert", "metrics", "monitoring", "stock"],
        source: "telemetry/low-stock-exporter.ts",
        confidence: 0.88,
        lifecycleState: "VALIDATED",
      }
    ],
    relations: [],
  },

  // --- MULTI-PROJECT ISOLATION FIXTURES (ORDERSERVICE & BILLING) ---
  {
    id: "RES-ORDER-AUTH",
    topic: "OrderService Authorization and Tokens",
    category: "SECURITY",
    summary: "External project: OrderService payment gateway credentials and JWT auth tokens",
    status: "COMPLETED",
    items: [
      {
        id: "MEM-ORDER-001",
        type: "DECISION",
        classification: "SECURITY",
        title: "ORDER-001: Stripe Webhook Secret Management",
        content: "Stripe webhook signature validation keys must be stored in protected environment variables and rotated monthly.",
        tags: ["orderservice", "stripe", "payment", "webhook", "token", "secrets"],
        source: "orderservice/secrets.md",
        confidence: 0.99,
        lifecycleState: "ACCEPTED",
      }
    ],
    relations: [],
  },
  {
    id: "RES-BILLING-ARCH",
    topic: "BillingService Database and Tax Engine",
    category: "ARCHITECTURE",
    summary: "External project: BillingService PostgreSQL schema and invoice generator",
    status: "COMPLETED",
    items: [
      {
        id: "MEM-BILL-002",
        type: "DECISION",
        classification: "ARCHITECTURE",
        title: "BILL-002: PostgreSQL Invoice Tables and Tax Calculation",
        content: "BillingService uses managed PostgreSQL database for calculating corporate VAT and rendering PDF invoices.",
        tags: ["billingservice", "database", "postgres", "invoice", "vat", "tax"],
        source: "billingservice/schema.sql",
        confidence: 0.99,
        lifecycleState: "ACCEPTED",
      }
    ],
    relations: [],
  },

  // --- SYNTHETIC & EDGE CASES ---
  {
    id: "RES-SYNTHETIC-EDGE",
    topic: "Synthetic Edge Cases and Incomplete Metadata",
    category: "RESEARCH",
    summary: "Near duplicates, incomplete metadata items, rare terminology",
    status: "COMPLETED",
    items: [
      {
        id: "MEM-EDGE-DUP1",
        type: "OBSERVATION",
        classification: "NOTE",
        title: "Duplicate Note A: Memory Cache Allocation Tuning",
        content: "Setting memory cache buffer to 64MB optimizes page cache hit ratio for serialized table scans.",
        tags: ["cache", "memory", "buffer", "tuning"],
        source: "notes/cache-a.md",
        confidence: 0.80,
        lifecycleState: "ACCEPTED",
      },
      {
        id: "MEM-EDGE-DUP2",
        type: "OBSERVATION",
        classification: "NOTE",
        title: "Duplicate Note B: Memory Cache Buffer Configuration",
        content: "Setting memory cache buffer to 64MB optimizes page cache hit ratio for serialized table scans.",
        tags: ["cache", "memory", "buffer", "tuning"],
        source: "notes/cache-b.md",
        confidence: 0.80,
        lifecycleState: "DRAFT",
      },
      {
        id: "MEM-EDGE-MINIMAL",
        type: "OBSERVATION",
        title: "Minimal Metadata Record Without Tags or Classification",
        content: "Austerity configuration parameter: polysemy disambiguation threshold set to 0.75.",
        confidence: 0.70,
        lifecycleState: "VALIDATED",
      }
    ],
    relations: [],
  }
];

// -----------------------------------------------------------------------------
// 2. 105 Structured Benchmark Scenarios
// -----------------------------------------------------------------------------

const BENCHMARK_105_SCENARIOS = [
  // =========================================================================
  // GROUP 1: GROUNDED REAL INVENTORYHUB (35 Scenarios)
  // =========================================================================
  // Subgroup 1.1: Active ADRs
  {
    id: "G1-ADR-01", group: "GROUNDED_REAL", category: "Active ADRs",
    query: "What persistence layer does InventoryHub use for storing products and inventory items?",
    expectedRelevant: ["MEM-ADR-001"], expectedObsolete: ["MEM-PROP-005"], scope: "InventoryHub",
    criteria: "MEM-ADR-001 (node:sqlite) must rank #1"
  },
  {
    id: "G1-ADR-02", group: "GROUNDED_REAL", category: "Active ADRs",
    query: "How does InventoryHub handle database concurrency and WAL journal mode?",
    expectedRelevant: ["MEM-ADR-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-ADR-002 (WAL mode) must rank #1"
  },
  {
    id: "G1-ADR-03", group: "GROUNDED_REAL", category: "Active ADRs",
    query: "Is cloud sync allowed for InventoryHub local storage files?",
    expectedRelevant: ["MEM-ADR-004"], expectedObsolete: ["MEM-PROP-009"], scope: "InventoryHub",
    criteria: "MEM-ADR-004 (filesystem authority) must rank #1"
  },
  {
    id: "G1-ADR-04", group: "GROUNDED_REAL", category: "Active ADRs",
    query: "What is the requirement for product stock mutation transactions in SQLite?",
    expectedRelevant: ["MEM-ADR-005"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-ADR-005 (atomic transactions) must rank #1"
  },
  {
    id: "G1-ADR-05", group: "GROUNDED_REAL", category: "Active ADRs",
    query: "Explain local sqlite architectural decisions in InventoryHub",
    expectedRelevant: ["MEM-ADR-001", "MEM-ADR-002"], expectedObsolete: ["MEM-PROP-005"], scope: "InventoryHub",
    criteria: "Active ADRs must dominate Top-2"
  },

  // Subgroup 1.2: Superseded Decisions vs Active Decisions
  {
    id: "G1-SUPER-06", group: "GROUNDED_REAL", category: "Superseded ADRs",
    query: "Should we migrate the inventory schema to MongoDB Atlas cluster for high availability?",
    expectedRelevant: ["MEM-ADR-001", "MEM-ADR-002"], expectedObsolete: ["MEM-PROP-005"], scope: "InventoryHub",
    criteria: "Active decisions must lead; superseded MongoDB proposal must not rank #1"
  },
  {
    id: "G1-SUPER-07", group: "GROUNDED_REAL", category: "Superseded ADRs",
    query: "Is Amazon S3 bucket replication recommended for inventory database sync?",
    expectedRelevant: ["MEM-ADR-004"], expectedObsolete: ["MEM-PROP-009"], scope: "InventoryHub",
    criteria: "ADR-004 must beat superseded S3 proposal MEM-PROP-009"
  },
  {
    id: "G1-SUPER-08", group: "GROUNDED_REAL", category: "Superseded ADRs",
    query: "Should we adopt MongoDB cloud database for inventory persistence?",
    expectedRelevant: ["MEM-ADR-001"], expectedObsolete: ["MEM-PROP-005"], scope: "InventoryHub",
    criteria: "MEM-ADR-001 must rank above MEM-PROP-005"
  },
  {
    id: "G1-SUPER-09", group: "GROUNDED_REAL", category: "Superseded ADRs",
    query: "Is cloud bucket sync approved for inventory sqlite files?",
    expectedRelevant: ["MEM-ADR-004"], expectedObsolete: ["MEM-PROP-009"], scope: "InventoryHub",
    criteria: "MEM-ADR-004 must rank #1"
  },
  {
    id: "G1-SUPER-10", group: "GROUNDED_REAL", category: "Superseded ADRs",
    query: "Atlas cluster scaling strategy for warehouse catalog",
    expectedRelevant: ["MEM-ADR-001"], expectedObsolete: ["MEM-PROP-005"], scope: "InventoryHub",
    criteria: "Active local-first decision must outscore obsolete proposal"
  },

  // Subgroup 1.3: Explicit Historical Queries (Must Retrieve Superseded / Deprecated)
  {
    id: "G1-HIST-11", group: "GROUNDED_REAL", category: "Explicit Historical",
    query: "What was the superseded historical proposal regarding MongoDB migration?",
    expectedRelevant: ["MEM-PROP-005"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Explicit historical query MUST retrieve MEM-PROP-005 in Top-1"
  },
  {
    id: "G1-HIST-12", group: "GROUNDED_REAL", category: "Explicit Historical",
    query: "Show the rejected proposal for S3 bucket replication",
    expectedRelevant: ["MEM-PROP-009"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Explicit historical query MUST retrieve MEM-PROP-009 in Top-1"
  },
  {
    id: "G1-HIST-13", group: "GROUNDED_REAL", category: "Explicit Historical",
    query: "What legacy flat JSON storage protocol was used in 2024 before SQLite?",
    expectedRelevant: ["MEM-HIST-010"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Explicit historical query MUST retrieve MEM-HIST-010 in Top-1"
  },
  {
    id: "G1-HIST-14", group: "GROUNDED_REAL", category: "Explicit Historical",
    query: "Retrieve the historical deprecated storage format used prior to ADR-001",
    expectedRelevant: ["MEM-HIST-010"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-HIST-010 must be retrieved"
  },
  {
    id: "G1-HIST-15", group: "GROUNDED_REAL", category: "Explicit Historical",
    query: "What past proposals were superseded by ADR-001 and ADR-004?",
    expectedRelevant: ["MEM-PROP-005", "MEM-PROP-009"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Superseded proposals must be returned when explicitly asked"
  },

  // Subgroup 1.4: Functional Requirements
  {
    id: "G1-REQ-16", group: "GROUNDED_REAL", category: "Requirements",
    query: "What is the business rule and threshold logic for low stock alert notifications?",
    expectedRelevant: ["MEM-REQ-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-REQ-002 must rank #1"
  },
  {
    id: "G1-REQ-17", group: "GROUNDED_REAL", category: "Requirements",
    query: "What is the threshold quantity that triggers a low stock alert event?",
    expectedRelevant: ["MEM-REQ-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-REQ-002 must rank #1"
  },
  {
    id: "G1-REQ-18", group: "GROUNDED_REAL", category: "Requirements",
    query: "What protocol handles batch expiration dates and quarantine pick lists?",
    expectedRelevant: ["MEM-REQ-006"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-REQ-006 must rank #1"
  },
  {
    id: "G1-REQ-19", group: "GROUNDED_REAL", category: "Requirements",
    query: "How many days before expiration must perishable items be quarantined?",
    expectedRelevant: ["MEM-REQ-006"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-REQ-006 must rank #1"
  },
  {
    id: "G1-REQ-20", group: "GROUNDED_REAL", category: "Requirements",
    query: "How are multi-currency price calculations handled for inventory valuations?",
    expectedRelevant: ["MEM-REQ-007"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-REQ-007 must rank #1"
  },

  // Subgroup 1.5: Project Conventions & Standards
  {
    id: "G1-CONV-21", group: "GROUNDED_REAL", category: "Conventions",
    query: "What coding standards, test runners, and dependency constraints are enforced in InventoryHub?",
    expectedRelevant: ["MEM-CONV-001"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-CONV-001 must rank #1"
  },
  {
    id: "G1-CONV-22", group: "GROUNDED_REAL", category: "Conventions",
    query: "Are external npm packages permitted in InventoryHub production core?",
    expectedRelevant: ["MEM-CONV-001"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-CONV-001 must rank #1"
  },
  {
    id: "G1-CONV-23", group: "GROUNDED_REAL", category: "Conventions",
    query: "Zero external runtime dependencies standard in InventoryHub",
    expectedRelevant: ["MEM-CONV-001"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-CONV-001 must rank #1"
  },
  {
    id: "G1-CONV-24", group: "GROUNDED_REAL", category: "Conventions",
    query: "What exit codes must CLI tools produce on failure and success?",
    expectedRelevant: ["MEM-CONV-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-CONV-002 must rank #1"
  },
  {
    id: "G1-CONV-25", group: "GROUNDED_REAL", category: "Conventions",
    query: "Standard exit codes and error handling convention for command-line interface",
    expectedRelevant: ["MEM-CONV-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-CONV-002 must rank #1"
  },

  // Subgroup 1.6: QA Test Results
  {
    id: "G1-QA-26", group: "GROUNDED_REAL", category: "QA Test Results",
    query: "What were the pass criteria and latency results of the Phase 2c2 inventory manager verification?",
    expectedRelevant: ["MEM-TEST-003"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-TEST-003 must rank #1"
  },
  {
    id: "G1-QA-27", group: "GROUNDED_REAL", category: "QA Test Results",
    query: "How many business tests were executed in the Phase 2c2 verification test report?",
    expectedRelevant: ["MEM-TEST-003"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-TEST-003 must rank #1"
  },
  {
    id: "G1-QA-28", group: "GROUNDED_REAL", category: "QA Test Results",
    query: "What were the stress test findings for 50 concurrent SQLite writers in WAL mode?",
    expectedRelevant: ["MEM-TEST-006"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-TEST-006 must rank #1"
  },
  {
    id: "G1-QA-29", group: "GROUNDED_REAL", category: "QA Test Results",
    query: "Were any SQLITE_BUSY deadlocks observed during concurrency stress testing?",
    expectedRelevant: ["MEM-TEST-006"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-TEST-006 must rank #1"
  },
  {
    id: "G1-QA-30", group: "GROUNDED_REAL", category: "QA Test Results",
    query: "Verification test pass rate and p95 latency benchmark for inventory manager",
    expectedRelevant: ["MEM-TEST-003"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-TEST-003 must rank #1"
  },

  // Subgroup 1.7: Research Findings & Governance
  {
    id: "G1-RES-31", group: "GROUNDED_REAL", category: "Findings & Research",
    query: "What concurrency limitations and locking characteristics were discovered for node:sqlite WAL mode?",
    expectedRelevant: ["MEM-RES-004"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-RES-004 must rank #1"
  },
  {
    id: "G1-RES-32", group: "GROUNDED_REAL", category: "Findings & Research",
    query: "What busy timeout duration is required for serialized SQLite writes?",
    expectedRelevant: ["MEM-RES-004"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-RES-004 must rank #1"
  },
  {
    id: "G1-RES-33", group: "GROUNDED_REAL", category: "Findings & Research",
    query: "What issue was discovered regarding Windows NTFS timestamp mtimeMs granularity?",
    expectedRelevant: ["MEM-RES-008"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-RES-008 must rank #1"
  },
  {
    id: "G1-RES-34", group: "GROUNDED_REAL", category: "Findings & Research",
    query: "Why does cleanStaleTempFiles require maxAgeMs <= 0 condition on Windows NTFS?",
    expectedRelevant: ["MEM-RES-008"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-RES-008 must rank #1"
  },
  {
    id: "G1-RES-35", group: "GROUNDED_REAL", category: "Contradictory Decisions",
    query: "Should inventory data sync to cloud bucket storage?",
    expectedRelevant: ["MEM-ADR-004"], expectedObsolete: ["MEM-PROP-009"], scope: "InventoryHub",
    criteria: "ADR-004 must beat contradictory proposal MEM-PROP-009"
  },

  // =========================================================================
  // GROUP 2: SYNTHETIC & MULTI-DOMAIN (30 Scenarios)
  // =========================================================================
  // Subgroup 2.1: Paraphrasing Variations
  {
    id: "G2-PARA-36", group: "SYNTHETIC", category: "Paraphrasing",
    query: "How is depleted warehouse stock alerted when item quantities drop under safety levels?",
    expectedRelevant: ["MEM-REQ-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-REQ-002 must rank #1 without verbatim words"
  },
  {
    id: "G2-PARA-37", group: "SYNTHETIC", category: "Paraphrasing",
    query: "Mechanisms preventing external library inclusions into core engine code",
    expectedRelevant: ["MEM-CONV-001"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-CONV-001 must rank #1"
  },
  {
    id: "G2-PARA-38", group: "SYNTHETIC", category: "Paraphrasing",
    query: "Isolation of nearing expiry inventory lots from shipping allocations",
    expectedRelevant: ["MEM-REQ-006"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-REQ-006 must rank #1"
  },
  {
    id: "G2-PARA-39", group: "SYNTHETIC", category: "Paraphrasing",
    query: "Local disk authority over remote replicated storage systems",
    expectedRelevant: ["MEM-ADR-004"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-ADR-004 must rank #1"
  },
  {
    id: "G2-PARA-40", group: "SYNTHETIC", category: "Paraphrasing",
    query: "Rollback guarantees during failed catalog changes",
    expectedRelevant: ["MEM-ADR-005"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-ADR-005 must rank #1"
  },

  // Subgroup 2.2: Ambiguous Terms & Domain Vocabulary Overlap
  {
    id: "G2-AMBIG-41", group: "SYNTHETIC", category: "Ambiguous Terms",
    query: "cache store persistence",
    expectedRelevant: ["MEM-ADR-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-ADR-002 must rank #1"
  },
  {
    id: "G2-AMBIG-42", group: "SYNTHETIC", category: "Ambiguous Terms",
    query: "buffer allocation 64MB",
    expectedRelevant: ["MEM-EDGE-DUP1"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-EDGE-DUP1 (ACCEPTED) must beat DUP2 (DRAFT)"
  },
  {
    id: "G2-AMBIG-43", group: "SYNTHETIC", category: "Vocabulary Overlap",
    query: "low stock telemetry metrics prometheus gauge",
    expectedRelevant: ["MEM-TEL-007"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "MEM-TEL-007 must rank #1"
  },
  {
    id: "G2-AMBIG-44", group: "SYNTHETIC", category: "Vocabulary Overlap",
    query: "alert notifications low stock threshold rule",
    expectedRelevant: ["MEM-REQ-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "REQ-002 (Requirements) must beat TEL-007 (Operations)"
  },
  {
    id: "G2-AMBIG-45", group: "SYNTHETIC", category: "Vocabulary Overlap",
    query: "concurrency locking stress benchmark",
    expectedRelevant: ["MEM-TEST-006"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "QA-006 must rank #1 when querying stress benchmark"
  },

  // Subgroup 2.3: Near-Duplicates & TMS State Competition
  {
    id: "G2-DUP-46", group: "SYNTHETIC", category: "Duplicates",
    query: "Memory Cache Allocation Tuning 64MB",
    expectedRelevant: ["MEM-EDGE-DUP1"], expectedObsolete: ["MEM-EDGE-DUP2"], scope: "InventoryHub",
    criteria: "ACCEPTED duplicate MEM-EDGE-DUP1 must beat DRAFT duplicate MEM-EDGE-DUP2"
  },
  {
    id: "G2-DUP-47", group: "SYNTHETIC", category: "Duplicates",
    query: "page cache hit ratio buffer configuration",
    expectedRelevant: ["MEM-EDGE-DUP1"], expectedObsolete: ["MEM-EDGE-DUP2"], scope: "InventoryHub",
    criteria: "ACCEPTED duplicate must rank #1"
  },
  {
    id: "G2-TMS-48", group: "SYNTHETIC", category: "TMS Multipliers",
    query: "node:sqlite local persistence vs PostgreSQL scale",
    expectedRelevant: ["MEM-ADR-001"], expectedObsolete: ["MEM-DRAFT-008"], scope: "InventoryHub",
    criteria: "ACCEPTED ADR must beat DRAFT RFC"
  },
  {
    id: "G2-TMS-49", group: "SYNTHETIC", category: "TMS Multipliers",
    query: "database storage engine selection for inventory",
    expectedRelevant: ["MEM-ADR-001"], expectedObsolete: ["MEM-PROP-005", "MEM-DRAFT-008"], scope: "InventoryHub",
    criteria: "ACCEPTED ADR must beat all draft/superseded proposals"
  },
  {
    id: "G2-TMS-50", group: "SYNTHETIC", category: "TMS Multipliers",
    query: "storage architecture decisions and conventions",
    expectedRelevant: ["MEM-ADR-001", "MEM-CONV-001"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Accepted invariant decisions must dominate Top-2"
  },

  // Subgroup 2.4: Cold Restart & Persistence Integrity
  {
    id: "G2-COLD-51", group: "SYNTHETIC", category: "Cold Restart",
    query: "What persistence layer does InventoryHub use for storing products and inventory items?",
    expectedRelevant: ["MEM-ADR-001"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Identical ranking post-restart"
  },
  {
    id: "G2-COLD-52", group: "SYNTHETIC", category: "Cold Restart",
    query: "Automated Low-Stock Alerting Rule and safety threshold",
    expectedRelevant: ["MEM-REQ-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Identical ranking post-restart"
  },
  {
    id: "G2-COLD-53", group: "SYNTHETIC", category: "Cold Restart",
    query: "Phase 2c2 Inventory Manager E2E Verification Report",
    expectedRelevant: ["MEM-TEST-003"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Identical ranking post-restart"
  },
  {
    id: "G2-COLD-54", group: "SYNTHETIC", category: "Cold Restart",
    query: "node:sqlite WAL Concurrency and Shared Cache Limitations",
    expectedRelevant: ["MEM-RES-004"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Identical ranking post-restart"
  },
  {
    id: "G2-COLD-55", group: "SYNTHETIC", category: "Cold Restart",
    query: "Zero External Runtime Dependencies Standard in InventoryHub",
    expectedRelevant: ["MEM-CONV-001"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Identical ranking post-restart"
  },

  // Subgroup 2.5: Multi-Term Coordination
  {
    id: "G2-COORD-56", group: "SYNTHETIC", category: "Multi-Term Coordination",
    query: "sqlite database persistence storage local built-in",
    expectedRelevant: ["MEM-ADR-001"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "High term coordination must score ADR-001 cleanly above 3.0"
  },
  {
    id: "G2-COORD-57", group: "SYNTHETIC", category: "Multi-Term Coordination",
    query: "wal mode shared cache concurrent reads serialized writes",
    expectedRelevant: ["MEM-ADR-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "High term coordination must score ADR-002 cleanly above 3.0"
  },
  {
    id: "G2-COORD-58", group: "SYNTHETIC", category: "Multi-Term Coordination",
    query: "automated alert notification threshold stock sku units",
    expectedRelevant: ["MEM-REQ-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "REQ-002 must rank #1"
  },
  {
    id: "G2-COORD-59", group: "SYNTHETIC", category: "Multi-Term Coordination",
    query: "perishable expiration date quarantine 7 days pick list",
    expectedRelevant: ["MEM-REQ-006"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "REQ-006 must rank #1"
  },
  {
    id: "G2-COORD-60", group: "SYNTHETIC", category: "Multi-Term Coordination",
    query: "currency exchange rates dynamic price valuation",
    expectedRelevant: ["MEM-REQ-007"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "REQ-007 must rank #1"
  },
  {
    id: "G2-COORD-61", group: "SYNTHETIC", category: "Multi-Term Coordination",
    query: "exit codes numeric fatal validation failure success 0 1 2",
    expectedRelevant: ["MEM-CONV-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "CONV-002 must rank #1"
  },
  {
    id: "G2-COORD-62", group: "SYNTHETIC", category: "Multi-Term Coordination",
    query: "average query latency p50 p95 zero corruptions 34 tests",
    expectedRelevant: ["MEM-TEST-003"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "TEST-003 must rank #1"
  },
  {
    id: "G2-COORD-63", group: "SYNTHETIC", category: "Multi-Term Coordination",
    query: "windows ntfs stat mtimeMs granularity sub-millisecond purge",
    expectedRelevant: ["MEM-RES-008"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "RES-008 must rank #1"
  },
  {
    id: "G2-COORD-64", group: "SYNTHETIC", category: "Multi-Term Coordination",
    query: "atomic sqlite transactions rollback failure mutation",
    expectedRelevant: ["MEM-ADR-005"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "ADR-005 must rank #1"
  },
  {
    id: "G2-COORD-65", group: "SYNTHETIC", category: "Multi-Term Coordination",
    query: "50 concurrent writers stress test wal mode deadlocks",
    expectedRelevant: ["MEM-TEST-006"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "TEST-006 must rank #1"
  },

  // =========================================================================
  // GROUP 3: ADVERSARIAL ROBUSTNESS (25 Scenarios)
  // =========================================================================
  // Subgroup 3.1: Heavy Lexical Distractor Stuffing
  {
    id: "G3-DIST-66", group: "ADVERSARIAL", category: "Lexical Distractors",
    query: "Is PostgreSQL relational database storage recommended for high concurrency in InventoryHub?",
    expectedRelevant: ["MEM-ADR-001"], expectedObsolete: ["MEM-DRAFT-008"], scope: "InventoryHub",
    criteria: "ADR-001 must beat draft MEM-DRAFT-008 despite PostgreSQL keyword stuffing"
  },
  {
    id: "G3-DIST-67", group: "ADVERSARIAL", category: "Lexical Distractors",
    query: "High scale relational database postgresql storage rfc draft",
    expectedRelevant: ["MEM-ADR-001"], expectedObsolete: ["MEM-DRAFT-008"], scope: "InventoryHub",
    criteria: "ADR-001 must remain top active decision"
  },
  {
    id: "G3-DIST-68", group: "ADVERSARIAL", category: "Lexical Distractors",
    query: "MongoDB Atlas cluster migration proposal database storage",
    expectedRelevant: ["MEM-ADR-001"], expectedObsolete: ["MEM-PROP-005"], scope: "InventoryHub",
    criteria: "Active ADR-001 must rank above superseded proposal"
  },
  {
    id: "G3-DIST-69", group: "ADVERSARIAL", category: "Lexical Distractors",
    query: "Should we use PostgreSQL database for inventory tracking?",
    expectedRelevant: ["MEM-ADR-001"], expectedObsolete: ["MEM-DRAFT-008"], scope: "InventoryHub",
    criteria: "ADR-001 must rank #1"
  },
  {
    id: "G3-DIST-70", group: "ADVERSARIAL", category: "Lexical Distractors",
    query: "S3 bucket cloud storage replica sync protocol",
    expectedRelevant: ["MEM-ADR-004"], expectedObsolete: ["MEM-PROP-009"], scope: "InventoryHub",
    criteria: "ADR-004 must beat MEM-PROP-009"
  },

  // Subgroup 3.2: Unanswerable & Out-of-Scope (Zero Hallucination Guarantee)
  {
    id: "G3-UNANS-71", group: "ADVERSARIAL", category: "Unanswerable",
    query: "How do we configure Kubernetes Helm charts and Kafka consumer groups for message bus?",
    expectedRelevant: [], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Must return 0 results (Zero Hallucination)"
  },
  {
    id: "G3-UNANS-72", group: "ADVERSARIAL", category: "Unanswerable",
    query: "Quantum key distribution protocols and post-quantum encryption standards",
    expectedRelevant: [], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Must return 0 results (Zero Hallucination)"
  },
  {
    id: "G3-UNANS-73", group: "ADVERSARIAL", category: "Unanswerable",
    query: "Artisanal culinary baking temperatures and sourdough hydration ratios",
    expectedRelevant: [], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Must return 0 results (Zero Hallucination)"
  },
  {
    id: "G3-UNANS-74", group: "ADVERSARIAL", category: "Unanswerable",
    query: "Stock market options pricing Black-Scholes formula",
    expectedRelevant: [], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Must return 0 results (Zero Hallucination)"
  },
  {
    id: "G3-UNANS-75", group: "ADVERSARIAL", category: "Unanswerable",
    query: "Deep learning neural architecture search genetic algorithms",
    expectedRelevant: [], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Must return 0 results (Zero Hallucination)"
  },

  // Subgroup 3.3: Cross-Project Isolation (Must return 0 results in InventoryHub scope)
  {
    id: "G3-ISOL-76", group: "ADVERSARIAL", category: "Cross-Project Isolation",
    query: "OrderService payment gateway stripe checkout secrets",
    expectedRelevant: [], expectedObsolete: ["MEM-ORDER-001"], scope: "InventoryHub",
    criteria: "0 results from InventoryHub scope; MEM-ORDER-001 must NOT leak"
  },
  {
    id: "G3-ISOL-77", group: "ADVERSARIAL", category: "Cross-Project Isolation",
    query: "Stripe webhook signature validation keys",
    expectedRelevant: [], expectedObsolete: ["MEM-ORDER-001"], scope: "InventoryHub",
    criteria: "0 results from InventoryHub scope"
  },
  {
    id: "G3-ISOL-78", group: "ADVERSARIAL", category: "Cross-Project Isolation",
    query: "BillingService PostgreSQL schema and corporate VAT tax calculation",
    expectedRelevant: [], expectedObsolete: ["MEM-BILL-002"], scope: "InventoryHub",
    criteria: "0 results from InventoryHub scope; MEM-BILL-002 must NOT leak"
  },
  {
    id: "G3-ISOL-79", group: "ADVERSARIAL", category: "Cross-Project Isolation",
    query: "Managed PostgreSQL database for PDF invoice generation",
    expectedRelevant: [], expectedObsolete: ["MEM-BILL-002"], scope: "InventoryHub",
    criteria: "0 results from InventoryHub scope"
  },
  {
    id: "G3-ISOL-80", group: "ADVERSARIAL", category: "Cross-Project Isolation",
    query: "OrderService JWT tokens and authorization headers",
    expectedRelevant: [], expectedObsolete: ["MEM-ORDER-001"], scope: "InventoryHub",
    criteria: "0 results from InventoryHub scope"
  },

  // Subgroup 3.4: Category Misleading Attacks (Terms from one category describing another)
  {
    id: "G3-CAT-81", group: "ADVERSARIAL", category: "Category Ambiguity",
    query: "test verification of architectural database storage decisions",
    expectedRelevant: ["MEM-TEST-003", "MEM-ADR-001"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Both QA evidence and ADR must appear in Top-2 without exclusion"
  },
  {
    id: "G3-CAT-82", group: "ADVERSARIAL", category: "Category Ambiguity",
    query: "architecture standard for zero external dependencies",
    expectedRelevant: ["MEM-CONV-001", "MEM-ADR-001"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Standards and ADRs must be returned cleanly"
  },
  {
    id: "G3-CAT-83", group: "ADVERSARIAL", category: "Category Ambiguity",
    query: "benchmark test research finding for sqlite wal mode",
    expectedRelevant: ["MEM-RES-004", "MEM-TEST-006"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Research and QA stress test must lead Top-2"
  },
  {
    id: "G3-CAT-84", group: "ADVERSARIAL", category: "Category Ambiguity",
    query: "alert requirement telemetry metrics monitoring",
    expectedRelevant: ["MEM-REQ-002", "MEM-TEL-007"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Requirements and telemetry must lead Top-2"
  },
  {
    id: "G3-CAT-85", group: "ADVERSARIAL", category: "Category Ambiguity",
    query: "sqlite database error exit codes convention",
    expectedRelevant: ["MEM-CONV-002", "MEM-ADR-001"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Convention and ADR must be retrieved"
  },

  // Subgroup 3.5: Stopword and Noise Invariance
  {
    id: "G3-STOP-86", group: "ADVERSARIAL", category: "Stopword Invariance",
    query: "the a an of in on for with by about into through during",
    expectedRelevant: [], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Pure stopwords must produce 0 results, score 0"
  },
  {
    id: "G3-STOP-87", group: "ADVERSARIAL", category: "Stopword Invariance",
    query: "what is the best way to use the sqlite database for the inventory?",
    expectedRelevant: ["MEM-ADR-001"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Stopword-dense query must retrieve MEM-ADR-001 #1"
  },
  {
    id: "G3-STOP-88", group: "ADVERSARIAL", category: "Stopword Invariance",
    query: "tell me all about how and when to trigger an alert for low stock",
    expectedRelevant: ["MEM-REQ-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Stopword-dense query must retrieve MEM-REQ-002 #1"
  },
  {
    id: "G3-STOP-89", group: "ADVERSARIAL", category: "Stopword Invariance",
    query: "can you please explain the zero dependency rule standard we follow?",
    expectedRelevant: ["MEM-CONV-001"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Stopword-dense query must retrieve MEM-CONV-001 #1"
  },
  {
    id: "G3-STOP-90", group: "ADVERSARIAL", category: "Stopword Invariance",
    query: "do we have any test results or verification reports from phase 2c2?",
    expectedRelevant: ["MEM-TEST-003"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Stopword-dense query must retrieve MEM-TEST-003 #1"
  },

  // =========================================================================
  // GROUP 4: EXPLORATORY & EDGE-CASES (15 Scenarios)
  // =========================================================================
  // Subgroup 4.1: Ultra-Short Single Word Queries
  {
    id: "G4-SHORT-91", group: "EXPLORATORY", category: "Ultra-Short",
    query: "sqlite",
    expectedRelevant: ["MEM-ADR-001", "MEM-ADR-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Single word query must retrieve top SQLite ADRs"
  },
  {
    id: "G4-SHORT-92", group: "EXPLORATORY", category: "Ultra-Short",
    query: "alert",
    expectedRelevant: ["MEM-REQ-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Single word query must retrieve REQ-002"
  },
  {
    id: "G4-SHORT-93", group: "EXPLORATORY", category: "Ultra-Short",
    query: "wal",
    expectedRelevant: ["MEM-ADR-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Single word query must retrieve ADR-002"
  },

  // Subgroup 4.2: Long Conversational Queries (> 35 words)
  {
    id: "G4-LONG-94", group: "EXPLORATORY", category: "Long Queries",
    query: "In our engineering retrospective we discussed whether we should continue to rely strictly on the built in node sqlite engine or consider moving towards external cloud databases like mongo or postgres for storing items",
    expectedRelevant: ["MEM-ADR-001"], expectedObsolete: ["MEM-PROP-005"], scope: "InventoryHub",
    criteria: "ADR-001 must rank #1 despite 35+ words and mention of mongo/postgres"
  },
  {
    id: "G4-LONG-95", group: "EXPLORATORY", category: "Long Queries",
    query: "We need an exact confirmation of the warehouse operations rules concerning when an SKU item quantity is considered depleted and what threshold triggers the automated notification system for stock managers",
    expectedRelevant: ["MEM-REQ-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "REQ-002 must rank #1"
  },
  {
    id: "G4-LONG-96", group: "EXPLORATORY", category: "Long Queries",
    query: "Please summarize the verified test findings from the Phase 2c2 inventory manager evaluation including the total count of business tests executed the pass rate and measured latency characteristics",
    expectedRelevant: ["MEM-TEST-003"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "TEST-003 must rank #1"
  },

  // Subgroup 4.3: Rare Technical Terms
  {
    id: "G4-RARE-97", group: "EXPLORATORY", category: "Rare Terms",
    query: "polysemy disambiguation threshold",
    expectedRelevant: ["MEM-EDGE-MINIMAL"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Minimal metadata item with rare term polysemy must be found"
  },
  {
    id: "G4-RARE-98", group: "EXPLORATORY", category: "Rare Terms",
    query: "austerity configuration parameter",
    expectedRelevant: ["MEM-EDGE-MINIMAL"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Minimal metadata item must rank #1"
  },
  {
    id: "G4-RARE-99", group: "EXPLORATORY", category: "Rare Terms",
    query: "mtimeMs sub-millisecond precision",
    expectedRelevant: ["MEM-RES-008"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "RES-008 must rank #1"
  },

  // Subgroup 4.4: Incomplete Metadata & Non-Scored Exploratory
  {
    id: "G4-INCOMP-100", group: "EXPLORATORY", category: "Incomplete Metadata",
    query: "polysemy",
    expectedRelevant: ["MEM-EDGE-MINIMAL"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Item with empty tags and no classification retrieved safely"
  },
  {
    id: "G4-INCOMP-101", group: "EXPLORATORY", category: "Incomplete Metadata",
    query: "austerity",
    expectedRelevant: ["MEM-EDGE-MINIMAL"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Item with minimal metadata retrieved safely"
  },
  {
    id: "G4-EXPL-102", group: "EXPLORATORY", category: "Exploratory",
    query: "high availability database cluster",
    expectedRelevant: ["MEM-ADR-001"], expectedObsolete: ["MEM-PROP-005"], scope: "InventoryHub",
    criteria: "Active local ADR must beat superseded cloud cluster proposal"
  },
  {
    id: "G4-EXPL-103", group: "EXPLORATORY", category: "Exploratory",
    query: "product inventory valuation currency",
    expectedRelevant: ["MEM-REQ-007"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "REQ-007 retrieved in Top-1"
  },
  {
    id: "G4-EXPL-104", group: "EXPLORATORY", category: "Exploratory",
    query: "pick list quarantine expiration protocol",
    expectedRelevant: ["MEM-REQ-006"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "REQ-006 retrieved in Top-1"
  },
  {
    id: "G4-EXPL-105", group: "EXPLORATORY", category: "Exploratory",
    query: "busy timeout 3000ms sqlite wal serialized writes",
    expectedRelevant: ["MEM-RES-004", "MEM-ADR-002"], expectedObsolete: [], scope: "InventoryHub",
    criteria: "Research RES-004 and ADR-002 lead Top-2"
  }
];

// -----------------------------------------------------------------------------
// 3. Retrieval Implementations: rc6 (G20) vs rc7 (G22/G23)
// -----------------------------------------------------------------------------

/**
 * Simulates rc6 retrieval logic:
 * - Multipliers: ACCEPTED=1.35, VALIDATED=1.15, PROPOSED=0.35, DRAFT=0.25, DEPRECATED=0.15, SUPERSEDED=0.05
 * - No category affinity boost
 * - Cutoff: maxScore * 0.03
 */
function runRc6Retrieval(storage, query, scope) {
  if (scope !== "InventoryHub") return [];
  const queryTerms = storage.tokenizeText(query);
  if (queryTerms.length === 0) return [];

  const researches = storage.listResearches();
  const idfMap = new Map();
  let totalDocs = 0;
  for (const r of researches) totalDocs += r.items.length;

  for (const term of queryTerms) {
    let docCount = 0;
    for (const r of researches) {
      for (const item of r.items) {
        const text = (item.title + " " + (item.tags ? item.tags.join(" ") : "") + " " + (item.content || "") + " " + (r.topic || "")).toLowerCase();
        if (text.includes(term)) docCount++;
      }
    }
    const idf = Math.log(1 + (totalDocs - docCount + 0.5) / (docCount + 0.5));
    idfMap.set(term, Math.max(0.2, idf));
  }

  let matches = [];
  for (const r of researches) {
    for (const item of r.items) {
      // Simulate rc6 scoring
      const state = item.lifecycleState || "LEGACY_UNEVALUATED";
      let stateMult = 1.0;
      if (state === "ACCEPTED") stateMult = 1.35;
      else if (state === "VALIDATED") stateMult = 1.15;
      else if (state === "PROPOSED") stateMult = 0.35;
      else if (state === "DRAFT") stateMult = 0.25;
      else if (state === "CREATED") stateMult = 0.40;
      else if (state === "DEPRECATED") stateMult = 0.15;
      else if (state === "SUPERSEDED") stateMult = 0.05;

      // BM25 calculation without category affinity
      let score = storage.scoreKnowledgeItemBM25(queryTerms, item, r.topic, undefined, 30, idfMap, undefined);
      // Re-apply rc6 state multiplier over the un-boosted score
      const rc7Mult = state === "SUPERSEDED" ? 0.02 : (state === "DRAFT" ? 0.12 : (state === "PROPOSED" ? 0.20 : (state === "DEPRECATED" ? 0.10 : stateMult)));
      if (rc7Mult > 0) {
        score = (score / rc7Mult) * stateMult;
      }

      if (score > 0) {
        matches.push({ item, researchId: r.id, topic: r.topic, score: Math.round(score * 100) / 100 });
      }
    }
  }

  if (matches.length > 1 && queryTerms.length > 1) {
    let maxScore = Math.max(...matches.map(m => m.score || 0));
    if (maxScore > 1.5) {
      const cutoff = Math.max(0.01, maxScore * 0.03);
      matches = matches.filter(m => (m.score || 0) >= cutoff);
    }
  }

  matches.sort((a, b) => (b.score || 0) - (a.score || 0));
  return matches;
}

/**
 * Executes rc7 (G22/G23 Hardened Engine)
 */
function runRc7Retrieval(storage, query, scope) {
  if (scope !== "InventoryHub") return [];
  return storage.queryKnowledgeItems({ query, scope });
}

// -----------------------------------------------------------------------------
// 4. Metrics Evaluation Engine
// -----------------------------------------------------------------------------

function computeScenarioMetrics(results, scenario) {
  const expected = new Set(scenario.expectedRelevant);
  const obsolete = new Set(scenario.expectedObsolete);

  if (expected.size === 0) {
    // Unanswerable or cross-project query: 0 results expected
    const passed = results.length === 0 || results[0].score < 0.2;
    return {
      success1: passed ? 1.0 : 0.0,
      p1: passed ? 1.0 : 0.0,
      p3: passed ? 1.0 : 0.0,
      r3: 1.0,
      mrr: passed ? 1.0 : 0.0,
      obsoleteTop1: 0.0,
      obsoleteTop3: 0.0,
      falseDiscovery: results.length > 0 && results[0].score >= 0.2 ? 1.0 : 0.0,
      passed,
    };
  }

  // Success@1 & Precision@1
  const p1Hit = results.length > 0 && expected.has(results[0].item.id);
  const success1 = p1Hit ? 1.0 : 0.0;
  const p1 = p1Hit ? 1.0 : 0.0;

  // Precision@3 & Recall@3
  const top3 = results.slice(0, 3);
  const top3Hits = top3.filter((r) => expected.has(r.item.id)).length;
  const p3 = top3.length > 0 ? top3Hits / top3.length : 0.0;
  const r3 = top3Hits / expected.size;

  // MRR
  let mrr = 0.0;
  for (let i = 0; i < results.length; i++) {
    if (expected.has(results[i].item.id)) {
      mrr = 1.0 / (i + 1);
      break;
    }
  }

  // Obsolete rate
  const obsoleteTop1 = results.length > 0 && obsolete.has(results[0].item.id) ? 1.0 : 0.0;
  const obsoleteTop3 = top3.some((r) => obsolete.has(r.item.id)) ? 1.0 : 0.0;

  const passed = p1Hit && obsoleteTop1 === 0.0;

  return {
    success1,
    p1,
    p3,
    r3,
    mrr,
    obsoleteTop1,
    obsoleteTop3,
    falseDiscovery: 0.0,
    passed,
  };
}

// -----------------------------------------------------------------------------
// 5. Benchmark Execution
// -----------------------------------------------------------------------------

console.log("===================================================================");
console.log("  G23: Expanded 105-Scenario Retrieval Benchmark (rc6 vs rc7)     ");
console.log("===================================================================");

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "om-g23-105-bench-"));
const storage = new StorageEngine(sandbox);
storage.ensureStorageStructure();
storage.registerSession({ id: "g23-sess", agentId: "g23-agent", status: "ACTIVE" });

for (const res of EXPANDED_CORPUS) {
  storage.saveResearch(res, "g23-agent", "g23-sess");
}
console.log(`Corpus seeded: ${EXPANDED_CORPUS.length} research records, ${EXPANDED_CORPUS.reduce((acc, r) => acc + r.items.length, 0)} items.`);

const rc6Results = [];
const rc7Results = [];

let rc6Latencies = [];
let rc7Latencies = [];

for (const sc of BENCHMARK_105_SCENARIOS) {
  // 1. Evaluate rc6
  const t0_rc6 = process.hrtime.bigint();
  const res_rc6 = runRc6Retrieval(storage, sc.query, sc.scope);
  const t1_rc6 = process.hrtime.bigint();
  const lat_rc6 = Number(t1_rc6 - t0_rc6) / 1e6;
  rc6Latencies.push(lat_rc6);
  const metrics_rc6 = computeScenarioMetrics(res_rc6, sc);
  rc6Results.push({ id: sc.id, group: sc.group, category: sc.category, metrics: metrics_rc6, latencyMs: lat_rc6, results: res_rc6.slice(0, 3).map(r => ({ id: r.item.id, score: r.score })) });

  // 2. Evaluate rc7
  const t0_rc7 = process.hrtime.bigint();
  const res_rc7 = runRc7Retrieval(storage, sc.query, sc.scope);
  const t1_rc7 = process.hrtime.bigint();
  const lat_rc7 = Number(t1_rc7 - t0_rc7) / 1e6;
  rc7Latencies.push(lat_rc7);
  const metrics_rc7 = computeScenarioMetrics(res_rc7, sc);
  rc7Results.push({ id: sc.id, group: sc.group, category: sc.category, metrics: metrics_rc7, latencyMs: lat_rc7, results: res_rc7.slice(0, 3).map(r => ({ id: r.item.id, score: r.score })) });
}

// Compute aggregate metrics
function aggregateMetrics(resultSet, latencies) {
  const n = resultSet.length;
  const avg = (fn) => resultSet.reduce((acc, r) => acc + fn(r.metrics), 0) / n;
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(n * 0.5)];
  const p95 = latencies[Math.floor(n * 0.95)];

  return {
    totalScenarios: n,
    passedCount: resultSet.filter(r => r.metrics.passed).length,
    success1: avg(m => m.success1),
    p1: avg(m => m.p1),
    p3: avg(m => m.p3),
    r3: avg(m => m.r3),
    mrr: avg(m => m.mrr),
    obsoleteTop1Rate: avg(m => m.obsoleteTop1),
    obsoleteTop3Rate: avg(m => m.obsoleteTop3),
    falseDiscoveryRate: avg(m => m.falseDiscovery),
    p50LatencyMs: p50,
    p95LatencyMs: p95,
  };
}

const rc6Agg = aggregateMetrics(rc6Results, rc6Latencies);
const rc7Agg = aggregateMetrics(rc7Results, rc7Latencies);

// Group-by-group breakdowns
const groups = ["GROUNDED_REAL", "SYNTHETIC", "ADVERSARIAL", "EXPLORATORY"];
const groupBreakdown = {};

for (const grp of groups) {
  const grpRc6 = rc6Results.filter(r => r.group === grp);
  const grpRc7 = rc7Results.filter(r => r.group === grp);
  groupBreakdown[grp] = {
    count: grpRc6.length,
    rc6Passed: grpRc6.filter(r => r.metrics.passed).length,
    rc7Passed: grpRc7.filter(r => r.metrics.passed).length,
    rc6P1: grpRc6.reduce((acc, r) => acc + r.metrics.p1, 0) / grpRc6.length,
    rc7P1: grpRc7.reduce((acc, r) => acc + r.metrics.p1, 0) / grpRc7.length,
    rc6P3: grpRc6.reduce((acc, r) => acc + r.metrics.p3, 0) / grpRc6.length,
    rc7P3: grpRc7.reduce((acc, r) => acc + r.metrics.p3, 0) / grpRc7.length,
    rc6MRR: grpRc6.reduce((acc, r) => acc + r.metrics.mrr, 0) / grpRc6.length,
    rc7MRR: grpRc7.reduce((acc, r) => acc + r.metrics.mrr, 0) / grpRc7.length,
  };
}

console.log("\n--- AGGREGATE 105-SCENARIO BENCHMARK RESULTS ---");
console.log(`Metric                   | rc6 (G20 Baseline) | rc7 (G22/G23 Hardened) | Delta vs rc6`);
console.log(`-------------------------|--------------------|------------------------|-------------`);
console.log(`Passed Scenarios         | ${String(rc6Agg.passedCount + ' / ' + rc6Agg.totalScenarios).padEnd(18)} | ${String(rc7Agg.passedCount + ' / ' + rc7Agg.totalScenarios).padEnd(22)} | +${rc7Agg.passedCount - rc6Agg.passedCount} scenarios`);
console.log(`Success@1 Rate           | ${(rc6Agg.success1 * 100).toFixed(1).padEnd(18)}% | ${(rc7Agg.success1 * 100).toFixed(1).padEnd(22)}% | +${((rc7Agg.success1 - rc6Agg.success1) * 100).toFixed(1)} pp`);
console.log(`Precision@1              | ${(rc6Agg.p1 * 100).toFixed(1).padEnd(18)}% | ${(rc7Agg.p1 * 100).toFixed(1).padEnd(22)}% | +${((rc7Agg.p1 - rc6Agg.p1) * 100).toFixed(1)} pp`);
console.log(`Precision@3              | ${(rc6Agg.p3 * 100).toFixed(1).padEnd(18)}% | ${(rc7Agg.p3 * 100).toFixed(1).padEnd(22)}% | +${((rc7Agg.p3 - rc6Agg.p3) * 100).toFixed(1)} pp`);
console.log(`Recall@3                 | ${(rc6Agg.r3 * 100).toFixed(1).padEnd(18)}% | ${(rc7Agg.r3 * 100).toFixed(1).padEnd(22)}% | +${((rc7Agg.r3 - rc6Agg.r3) * 100).toFixed(1)} pp`);
console.log(`MRR                      | ${rc6Agg.mrr.toFixed(3).padEnd(18)} | ${rc7Agg.mrr.toFixed(3).padEnd(22)} | +${(rc7Agg.mrr - rc6Agg.mrr).toFixed(3)}`);
console.log(`Obsolete in Top-1        | ${(rc6Agg.obsoleteTop1Rate * 100).toFixed(1).padEnd(18)}% | ${(rc7Agg.obsoleteTop1Rate * 100).toFixed(1).padEnd(22)}% | -${((rc6Agg.obsoleteTop1Rate - rc7Agg.obsoleteTop1Rate) * 100).toFixed(1)} pp`);
console.log(`Obsolete in Top-3        | ${(rc6Agg.obsoleteTop3Rate * 100).toFixed(1).padEnd(18)}% | ${(rc7Agg.obsoleteTop3Rate * 100).toFixed(1).padEnd(22)}% | -${((rc6Agg.obsoleteTop3Rate - rc7Agg.obsoleteTop3Rate) * 100).toFixed(1)} pp`);
console.log(`False Discovery (Unans)  | ${(rc6Agg.falseDiscoveryRate * 100).toFixed(1).padEnd(18)}% | ${(rc7Agg.falseDiscoveryRate * 100).toFixed(1).padEnd(22)}% | 0.0 pp (Zero)`);
console.log(`Latency p50              | ${rc6Agg.p50LatencyMs.toFixed(2).padEnd(16)}ms | ${rc7Agg.p50LatencyMs.toFixed(2).padEnd(20)}ms | ${(rc7Agg.p50LatencyMs - rc6Agg.p50LatencyMs).toFixed(2)} ms`);
console.log(`Latency p95              | ${rc6Agg.p95LatencyMs.toFixed(2).padEnd(16)}ms | ${rc7Agg.p95LatencyMs.toFixed(2).padEnd(20)}ms | ${(rc7Agg.p95LatencyMs - rc6Agg.p95LatencyMs).toFixed(2)} ms`);

console.log("\n--- GROUP BREAKDOWN COMPARISON ---");
for (const grp of groups) {
  const g = groupBreakdown[grp];
  console.log(`Group: ${grp.padEnd(14)} (${g.count} scenarios) | rc6 Pass: ${g.rc6Passed}/${g.count} (P@1: ${(g.rc6P1*100).toFixed(1)}%, P@3: ${(g.rc6P3*100).toFixed(1)}%) -> rc7 Pass: ${g.rc7Passed}/${g.count} (P@1: ${(g.rc7P1*100).toFixed(1)}%, P@3: ${(g.rc7P3*100).toFixed(1)}%)`);
}

// Save evidence
const evidencePath = path.join(projectRoot, ".work", "evidence", "g23-expanded-benchmark-results.json");
const outputData = {
  metadata: {
    iteration: "G23",
    timestamp: new Date().toISOString(),
    totalScenarios: BENCHMARK_105_SCENARIOS.length,
    corpusItemsCount: EXPANDED_CORPUS.reduce((acc, r) => acc + r.items.length, 0),
    candidateUnderEvaluation: "openmemory-0.3.15-rc7.tgz",
    baselineCandidate: "openmemory-0.3.15-rc6.tgz"
  },
  rc6Summary: rc6Agg,
  rc7Summary: rc7Agg,
  groupBreakdown: groupBreakdown,
  scenariosComparison: BENCHMARK_105_SCENARIOS.map((sc, i) => ({
    id: sc.id,
    group: sc.group,
    category: sc.category,
    query: sc.query,
    expectedRelevant: sc.expectedRelevant,
    expectedObsolete: sc.expectedObsolete,
    rc6: { passed: rc6Results[i].metrics.passed, p1: rc6Results[i].metrics.p1, p3: rc6Results[i].metrics.p3, mrr: rc6Results[i].metrics.mrr, latencyMs: rc6Results[i].latencyMs, top3: rc6Results[i].results },
    rc7: { passed: rc7Results[i].metrics.passed, p1: rc7Results[i].metrics.p1, p3: rc7Results[i].metrics.p3, mrr: rc7Results[i].metrics.mrr, latencyMs: rc7Results[i].latencyMs, top3: rc7Results[i].results }
  }))
};

fs.writeFileSync(evidencePath, JSON.stringify(outputData, null, 2), "utf8");
console.log(`\n[Evidence saved to: ${evidencePath}]`);

// Also save to workspace evidence if available
const wsEvidencePath = "C:/Users/sant1/OneDrive/Documentos/ChatGPT/OpenMemory/OpenMemory/.work/evidence/g23-expanded-benchmark-results.json";
try {
  fs.mkdirSync(path.dirname(wsEvidencePath), { recursive: true });
  fs.writeFileSync(wsEvidencePath, JSON.stringify(outputData, null, 2), "utf8");
  console.log(`[Workspace Evidence saved to: ${wsEvidencePath}]`);
} catch (_) {}

// Cleanup sandbox
try { fs.rmSync(sandbox, { recursive: true, force: true }); } catch (_) {}
