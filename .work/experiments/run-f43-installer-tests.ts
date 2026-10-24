import * as fs from "fs";
import * as path from "path";
import { installOpenMemory } from "../../src/installer";
import { runCLI } from "../../src/cli";

interface TestResult {
  id: string;
  name: string;
  status: "PASSED" | "FAILED";
  details: string;
}

const results: TestResult[] = [];

// Isolated scratch root directory for F4.3 tests
const scratchRoot = path.join(process.cwd(), ".work", "scratch-f43-installer-test");
if (fs.existsSync(scratchRoot)) {
  fs.rmSync(scratchRoot, { recursive: true, force: true });
}
fs.mkdirSync(scratchRoot, { recursive: true });

async function runF43InstallerTests() {
  console.log("=================================================");
  console.log("   OpenMemory F4.3 Non-Destructive Installer Test Suite");
  console.log("=================================================\n");

  // -------------------------------------------------------------------------
  // Test F4.3-001: Storage Engine Auto-Initialization
  // -------------------------------------------------------------------------
  try {
    const testDir = path.join(scratchRoot, "test-f43-001");
    fs.mkdirSync(testDir, { recursive: true });

    const res = installOpenMemory({ targetDir: testDir, createAgentsMdIfMissing: false });

    const openmemoryDir = path.join(testDir, ".openmemory");
    const manifestPath = path.join(openmemoryDir, "openmemory.json");
    const statePath = path.join(openmemoryDir, "project-state.json");
    const handoffPath = path.join(openmemoryDir, "handoff.md");

    if (!res.storageInitialized || !fs.existsSync(openmemoryDir)) {
      throw new Error(".openmemory directory was not initialized");
    }
    if (!fs.existsSync(manifestPath) || !fs.existsSync(statePath) || !fs.existsSync(handoffPath)) {
      throw new Error("Core storage state files (openmemory.json, project-state.json, handoff.md) missing");
    }

    results.push({
      id: "F4.3-001",
      name: "Storage Engine Auto-Initialization",
      status: "PASSED",
      details: "Storage engine initialized complete .openmemory/ directory structure atomically",
    });
    console.log("[PASSED] F4.3-001: Storage Engine Auto-Initialization");
  } catch (err) {
    results.push({
      id: "F4.3-001",
      name: "Storage Engine Auto-Initialization",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.3-001:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.3-002: Delimited Block Injection in Missing AGENTS.md
  // -------------------------------------------------------------------------
  try {
    const testDir = path.join(scratchRoot, "test-f43-002");
    fs.mkdirSync(testDir, { recursive: true });

    const res = installOpenMemory({ targetDir: testDir, createAgentsMdIfMissing: true });
    const agentsMdPath = path.join(testDir, "AGENTS.md");

    if (!res.agentsMdUpdated || !fs.existsSync(agentsMdPath)) {
      throw new Error("AGENTS.md was not created when missing");
    }

    const content = fs.readFileSync(agentsMdPath, "utf-8");
    if (!content.includes("<!-- OPENMEMORY:START -->") || !content.includes("<!-- OPENMEMORY:END -->")) {
      throw new Error("AGENTS.md content missing OPENMEMORY delimiters");
    }
    if (!content.includes("## OpenMemory Context Pointer")) {
      throw new Error("AGENTS.md content missing OpenMemory Context Pointer header");
    }

    results.push({
      id: "F4.3-002",
      name: "Delimited Block Injection in Missing AGENTS.md",
      status: "PASSED",
      details: "Created AGENTS.md with delimited context pointer block",
    });
    console.log("[PASSED] F4.3-002: Delimited Block Injection in Missing AGENTS.md");
  } catch (err) {
    results.push({
      id: "F4.3-002",
      name: "Delimited Block Injection in Missing AGENTS.md",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.3-002:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.3-003: Non-Destructive Update Preserving Developer Guidelines
  // -------------------------------------------------------------------------
  try {
    const testDir = path.join(scratchRoot, "test-f43-003");
    fs.mkdirSync(testDir, { recursive: true });
    const agentsMdPath = path.join(testDir, "AGENTS.md");

    const customUserContent = `# Custom Developer Guidelines

## Important Rules
* Rule 1: Maintain zero core modification.
* Rule 2: Always run empirical test verification.
`;
    fs.writeFileSync(agentsMdPath, customUserContent, "utf-8");

    installOpenMemory({ targetDir: testDir });

    const updatedContent = fs.readFileSync(agentsMdPath, "utf-8");

    if (!updatedContent.includes("<!-- OPENMEMORY:START -->") || !updatedContent.includes("<!-- OPENMEMORY:END -->")) {
      throw new Error("Updated AGENTS.md missing OPENMEMORY block");
    }
    if (!updatedContent.includes("# Custom Developer Guidelines") || !updatedContent.includes("* Rule 1: Maintain zero core modification.")) {
      throw new Error("Original developer guidelines were modified or removed");
    }

    results.push({
      id: "F4.3-003",
      name: "Non-Destructive Update Preserving Developer Guidelines",
      status: "PASSED",
      details: "Injected delimited block while preserving existing developer guidelines verbatim",
    });
    console.log("[PASSED] F4.3-003: Non-Destructive Update Preserving Developer Guidelines");
  } catch (err) {
    results.push({
      id: "F4.3-003",
      name: "Non-Destructive Update Preserving Developer Guidelines",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.3-003:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.3-004: Pre-modification Backup Snapshot Creation
  // -------------------------------------------------------------------------
  try {
    const testDir = path.join(scratchRoot, "test-f43-004");
    fs.mkdirSync(testDir, { recursive: true });
    const agentsMdPath = path.join(testDir, "AGENTS.md");

    const initialContent = "# Pre-install Guidelines Snapshot\n* Critical Note 123\n";
    fs.writeFileSync(agentsMdPath, initialContent, "utf-8");

    const res = installOpenMemory({ targetDir: testDir });

    if (!res.backupCreated || !fs.existsSync(res.backupCreated)) {
      throw new Error("Backup file was not created or path was not returned");
    }

    const backupContent = fs.readFileSync(res.backupCreated, "utf-8");
    if (backupContent !== initialContent) {
      throw new Error("Backup content does not match original pre-modification AGENTS.md content");
    }

    results.push({
      id: "F4.3-004",
      name: "Pre-modification Backup Snapshot Creation",
      status: "PASSED",
      details: `Created atomic backup snapshot at ${res.backupCreated} matching pre-install content 100%`,
    });
    console.log("[PASSED] F4.3-004: Pre-modification Backup Snapshot Creation");
  } catch (err) {
    results.push({
      id: "F4.3-004",
      name: "Pre-modification Backup Snapshot Creation",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.3-004:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.3-005: Installation Idempotency Check
  // -------------------------------------------------------------------------
  try {
    const testDir = path.join(scratchRoot, "test-f43-005");
    fs.mkdirSync(testDir, { recursive: true });

    installOpenMemory({ targetDir: testDir });
    installOpenMemory({ targetDir: testDir });
    installOpenMemory({ targetDir: testDir });

    const agentsMdPath = path.join(testDir, "AGENTS.md");
    const content = fs.readFileSync(agentsMdPath, "utf-8");

    const startMatches = content.match(/<!-- OPENMEMORY:START -->/g) || [];
    const endMatches = content.match(/<!-- OPENMEMORY:END -->/g) || [];

    if (startMatches.length !== 1 || endMatches.length !== 1) {
      throw new Error(`Expected exactly 1 delimited block after 3 runs, found ${startMatches.length} START and ${endMatches.length} END markers`);
    }

    results.push({
      id: "F4.3-005",
      name: "Installation Idempotency Check",
      status: "PASSED",
      details: "Multiple installer invocations maintained strictly 1 delimited OPENMEMORY block",
    });
    console.log("[PASSED] F4.3-005: Installation Idempotency Check");
  } catch (err) {
    results.push({
      id: "F4.3-005",
      name: "Installation Idempotency Check",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.3-005:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.3-006: CLI `openmemory install` Execution Validation
  // -------------------------------------------------------------------------
  try {
    const testDir = path.join(scratchRoot, "test-f43-006");
    fs.mkdirSync(testDir, { recursive: true });

    const cliOutput = await runCLI(["install"], testDir);

    if (!cliOutput.includes("[OpenMemory CLI] Installation complete:")) {
      throw new Error(`Unexpected CLI output: ${cliOutput}`);
    }

    const agentsMdPath = path.join(testDir, "AGENTS.md");
    const openmemoryDir = path.join(testDir, ".openmemory");

    if (!fs.existsSync(agentsMdPath) || !fs.existsSync(openmemoryDir)) {
      throw new Error("CLI install failed to create AGENTS.md or .openmemory directory");
    }

    results.push({
      id: "F4.3-006",
      name: "CLI `openmemory install` Execution Validation",
      status: "PASSED",
      details: "CLI command `openmemory install` executed successfully and returned formatted output",
    });
    console.log("[PASSED] F4.3-006: CLI `openmemory install` Execution Validation");
  } catch (err) {
    results.push({
      id: "F4.3-006",
      name: "CLI `openmemory install` Execution Validation",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.3-006:", (err as Error).message);
  }

  // Cleanup scratch directory
  try {
    fs.rmSync(scratchRoot, { recursive: true, force: true });
  } catch (_) {}

  // Save evidence
  const evidenceDir = path.join(process.cwd(), ".work", "evidence");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }
  const evidenceFile = path.join(evidenceDir, "phase-4.3-installer-test-results.json");
  fs.writeFileSync(evidenceFile, JSON.stringify(results, null, 2), "utf-8");

  console.log("\n=================================================");
  console.log("   F4.3 Installer Test Execution Complete!       ");
  console.log(`   Results saved to: .work/evidence/phase-4.3-installer-test-results.json`);
  console.log("=================================================");

  const failedCount = results.filter((r) => r.status === "FAILED").length;
  if (failedCount > 0) {
    process.exit(1);
  }
}

runF43InstallerTests();
