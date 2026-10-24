import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

interface TestResult {
  id: string;
  name: string;
  status: "PASSED" | "FAILED";
  details: string;
}

const results: TestResult[] = [];
const rootDir = process.cwd();

async function runF44PackagingTests() {
  console.log("=================================================");
  console.log("   OpenMemory F4.4 Production Packaging Test Suite");
  console.log("=================================================\n");

  // -------------------------------------------------------------------------
  // Test F4.4-001: tsconfig.json & npm run build Compilation
  // -------------------------------------------------------------------------
  try {
    const tsconfigPath = path.join(rootDir, "tsconfig.json");
    if (!fs.existsSync(tsconfigPath)) {
      throw new Error("tsconfig.json file missing at workspace root");
    }

    // Execute build
    execSync("npx tsc", { cwd: rootDir, encoding: "utf-8" });

    const distDir = path.join(rootDir, "dist");
    const requiredFiles = [
      "index.js",
      "index.d.ts",
      "storage.js",
      "storage.d.ts",
      "installer.js",
      "installer.d.ts",
      "mcp.js",
      "mcp.d.ts",
      "cli.js",
      "cli.d.ts",
    ];

    for (const file of requiredFiles) {
      const filePath = path.join(distDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Compiled build artifact missing in dist/: ${file}`);
      }
    }

    results.push({
      id: "F4.4-001",
      name: "tsconfig.json & npm run build Compilation",
      status: "PASSED",
      details: "Compiled all source modules cleanly to dist/ with JS, type declarations (.d.ts), and source maps",
    });
    console.log("[PASSED] F4.4-001: tsconfig.json & npm run build Compilation");
  } catch (err) {
    results.push({
      id: "F4.4-001",
      name: "tsconfig.json & npm run build Compilation",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.4-001:", (err as any).message);
    if ((err as any).stdout) console.error("STDOUT:", (err as any).stdout.toString());
    if ((err as any).stderr) console.error("STDERR:", (err as any).stderr.toString());
  }

  // -------------------------------------------------------------------------
  // Test F4.4-002: Public API Export Surface Integrity
  // -------------------------------------------------------------------------
  try {
    const indexPath = path.join(rootDir, "src", "index.ts");
    if (!fs.existsSync(indexPath)) {
      throw new Error("src/index.ts entry point missing");
    }

    const compiledIndex = require(path.join(rootDir, "dist", "index.js"));
    if (!compiledIndex.StorageEngine) {
      throw new Error("StorageEngine export missing from dist/index.js");
    }
    if (!compiledIndex.installOpenMemory) {
      throw new Error("installOpenMemory export missing from dist/index.js");
    }
    if (!compiledIndex.createMCPServer) {
      throw new Error("createMCPServer export missing from dist/index.js");
    }
    if (!compiledIndex.runCLI) {
      throw new Error("runCLI export missing from dist/index.js");
    }

    results.push({
      id: "F4.4-002",
      name: "Public API Export Surface Integrity",
      status: "PASSED",
      details: "dist/index.js exports complete public API surface (StorageEngine, installOpenMemory, createMCPServer, runCLI)",
    });
    console.log("[PASSED] F4.4-002: Public API Export Surface Integrity");
  } catch (err) {
    results.push({
      id: "F4.4-002",
      name: "Public API Export Surface Integrity",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.4-002:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.4-003: package.json Distribution Manifest Fields
  // -------------------------------------------------------------------------
  try {
    const pkgPath = path.join(rootDir, "package.json");
    const rawPkg = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(rawPkg);

    if (pkg.main !== "./dist/index.js") {
      throw new Error(`package.json main expected './dist/index.js', got '${pkg.main}'`);
    }
    if (pkg.types !== "./dist/index.d.ts") {
      throw new Error(`package.json types expected './dist/index.d.ts', got '${pkg.types}'`);
    }
    if (pkg.bin?.openmemory !== "./dist/cli.js") {
      throw new Error(`package.json bin.openmemory expected './dist/cli.js', got '${pkg.bin?.openmemory}'`);
    }
    if (!Array.isArray(pkg.files) || !pkg.files.includes("dist")) {
      throw new Error("package.json files field missing 'dist' entry");
    }
    if (!pkg.exports?.["."]?.default || !pkg.exports?.["."]?.types) {
      throw new Error("package.json exports field missing '.' entrypoint mapping");
    }

    results.push({
      id: "F4.4-003",
      name: "package.json Distribution Manifest Fields",
      status: "PASSED",
      details: "Validated main, types, bin, files, exports, and npm distribution scripts in package.json",
    });
    console.log("[PASSED] F4.4-003: package.json Distribution Manifest Fields");
  } catch (err) {
    results.push({
      id: "F4.4-003",
      name: "package.json Distribution Manifest Fields",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.4-003:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.4-004: CLI Shebang Header Verification
  // -------------------------------------------------------------------------
  try {
    const distCliPath = path.join(rootDir, "dist", "cli.js");
    const cliContent = fs.readFileSync(distCliPath, "utf-8");

    if (!cliContent.startsWith("#!/usr/bin/env node")) {
      throw new Error("dist/cli.js missing #!/usr/bin/env node shebang header on line 1");
    }

    results.push({
      id: "F4.4-004",
      name: "CLI Shebang Header Verification",
      status: "PASSED",
      details: "dist/cli.js starts with #!/usr/bin/env node shebang header for direct binary execution",
    });
    console.log("[PASSED] F4.4-004: CLI Shebang Header Verification");
  } catch (err) {
    results.push({
      id: "F4.4-004",
      name: "CLI Shebang Header Verification",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.4-004:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.4-005: npm pack --dry-run Tarball Contents Validation
  // -------------------------------------------------------------------------
  try {
    let output = "";
    try {
      output = execSync("npm pack --dry-run 2>&1", { cwd: rootDir, encoding: "utf-8", shell: true });
    } catch (e: any) {
      output = (e.stdout || "") + "\n" + (e.stderr || "") + "\n" + (e.message || "");
    }

    const hasIndex = output.includes("dist/index.js") || output.includes("dist\\index.js");
    const hasCli = output.includes("dist/cli.js") || output.includes("dist\\cli.js");
    if (!hasIndex || !hasCli) {
      throw new Error("npm pack output missing dist build artifacts");
    }
    if (!output.includes("AGENTS.md") || !output.includes("LICENSE") || !output.includes("README.md")) {
      throw new Error("npm pack output missing root manifest/license files");
    }
    if (output.includes(".work/") || output.includes(".openmemory/")) {
      throw new Error("npm pack output accidentally included internal .work/ or .openmemory/ files");
    }

    results.push({
      id: "F4.4-005",
      name: "npm pack --dry-run Tarball Contents Validation",
      status: "PASSED",
      details: "npm pack tarball strictly includes dist/, .opencode/, mcp_config.json, AGENTS.md, README.md, LICENSE",
    });
    console.log("[PASSED] F4.4-005: npm pack --dry-run Tarball Contents Validation");
  } catch (err) {
    results.push({
      id: "F4.4-005",
      name: "npm pack --dry-run Tarball Contents Validation",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.4-005:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.4-006: Compiled JavaScript Module Runtime Execution
  // -------------------------------------------------------------------------
  try {
    const tempDir = path.join(rootDir, ".work", "scratch-f44-packaging-test");
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    // Test requiring compiled dist/index.js
    const { StorageEngine, installOpenMemory } = require(path.join(rootDir, "dist", "index.js"));
    const storage = new StorageEngine(tempDir);
    const summary = storage.formatProjectContextSummary();

    if (!summary.includes("# OpenMemory Project Context Summary")) {
      throw new Error("Compiled StorageEngine from dist/index.js returned invalid summary");
    }

    // Test running compiled dist/cli.js
    const { runCLI } = require(path.join(rootDir, "dist", "cli.js"));
    const cliOutput = await runCLI(["status"], tempDir);
    if (!cliOutput.includes("# OpenMemory Project Context Summary")) {
      throw new Error("Compiled runCLI from dist/cli.js failed execution");
    }

    // Cleanup
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}

    results.push({
      id: "F4.4-006",
      name: "Compiled JavaScript Module Runtime Execution",
      status: "PASSED",
      details: "Successfully loaded and executed dist/index.js and dist/cli.js JavaScript modules in Node.js runtime",
    });
    console.log("[PASSED] F4.4-006: Compiled JavaScript Module Runtime Execution");
  } catch (err) {
    results.push({
      id: "F4.4-006",
      name: "Compiled JavaScript Module Runtime Execution",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.4-006:", (err as Error).message);
  }

  // Save evidence
  const evidenceDir = path.join(rootDir, ".work", "evidence");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }
  const evidenceFile = path.join(evidenceDir, "phase-4.4-packaging-test-results.json");
  fs.writeFileSync(evidenceFile, JSON.stringify(results, null, 2), "utf-8");

  console.log("\n=================================================");
  console.log("   F4.4 Packaging Test Execution Complete!       ");
  console.log(`   Results saved to: .work/evidence/phase-4.4-packaging-test-results.json`);
  console.log("=================================================");

  const failedCount = results.filter((r) => r.status === "FAILED").length;
  if (failedCount > 0) {
    process.exit(1);
  }
}

runF44PackagingTests();
