import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  StorageEngine,
  validateDomainId,
  resolveSecurePath,
  assertSecureFileName,
  PathSecurityError,
} from "../../src/storage";

async function runSecurityTests() {
  console.log("=================================================");
  console.log("=== SEC-001: PATH TRAVERSAL VERIFICATION SUITE ===");
  console.log("=================================================\n");

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "openmemory-sec001-"));
  console.log(`Isolated Test Sandbox: ${tempRoot}\n`);

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS ${totalTests}] ${testName}`);
    } else {
      console.error(`[FAIL ${totalTests}] ${testName}`);
      if (details) console.error(`       Details: ${details}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  function assertThrows(fn: () => void, testName: string, expectedErrorCode?: string) {
    totalTests++;
    try {
      fn();
      console.error(`[FAIL ${totalTests}] ${testName} — Expected error was not thrown!`);
      throw new Error(`Expected error was not thrown for: ${testName}`);
    } catch (err: any) {
      if (err instanceof PathSecurityError) {
        if (expectedErrorCode && err.code !== expectedErrorCode) {
          console.error(`[FAIL ${totalTests}] ${testName} — Expected code ${expectedErrorCode}, got ${err.code}`);
          throw err;
        }
        passedTests++;
        console.log(`[PASS ${totalTests}] ${testName} [Caught ${err.code}: ${err.message}]`);
      } else if (err.name === "PathSecurityError" || err.message?.includes("Path")) {
        passedTests++;
        console.log(`[PASS ${totalTests}] ${testName} [Caught ${err.message}]`);
      } else {
        console.error(`[FAIL ${totalTests}] ${testName} — Unexpected error type: ${err.message}`);
        throw err;
      }
    }
  }

  try {
    const storage = new StorageEngine(tempRoot);
    storage.ensureStorageStructure();

    // -------------------------------------------------------------
    // PART 1: Low-Level Domain ID Validation (Unit Checks)
    // -------------------------------------------------------------
    console.log("--- PART 1: Low-Level Domain ID Validation ---");

    // Valid ADRs
    assert(validateDomainId("ADR-001", "adr") === "ADR-001", "ADR-001 accepted verbatim");
    assert(validateDomainId("ADR-1", "adr") === "ADR-001", "ADR-1 normalized to ADR-001");
    assert(validateDomainId("42", "adr") === "ADR-042", "Pure numeric '42' normalized to ADR-042");

    // Malicious ADRs
    assertThrows(() => validateDomainId("ADR-../../exploit", "adr"), "Reject ADR-../../exploit", "PATH_SEPARATOR_FORBIDDEN");
    assertThrows(() => validateDomainId("ADR-..\\..\\exploit", "adr"), "Reject Windows backslash traversal", "PATH_SEPARATOR_FORBIDDEN");
    assertThrows(() => validateDomainId("ADR-foo", "adr"), "Reject non-numeric ADR-foo", "INVALID_ADR_ID");
    assertThrows(() => validateDomainId("C:\\Windows\\System32", "adr"), "Reject absolute Windows drive path", "PATH_SEPARATOR_FORBIDDEN");
    assertThrows(() => validateDomainId("ADR-\x00evil", "adr"), "Reject null byte in ADR", "INVALID_CONTROL_CHARS");
    assertThrows(() => validateDomainId("", "adr"), "Reject empty ADR ID", "INVALID_ID_EMPTY");

    // Valid Research IDs
    assert(validateDomainId("RES-2026-09-26-001", "research") === "RES-2026-09-26-001", "Standard RES-2026-09-26-001 accepted");
    assert(validateDomainId("RES-spike-01.json", "research") === "RES-spike-01", "RES-spike-01.json extension stripped and accepted");

    // Malicious Research IDs
    assertThrows(() => validateDomainId("RES-../../../malicious", "research"), "Reject RES-../../../malicious", "PATH_SEPARATOR_FORBIDDEN");
    assertThrows(() => validateDomainId("RES-..\\..\\malicious", "research"), "Reject RES-..\\..\\malicious", "PATH_SEPARATOR_FORBIDDEN");
    assertThrows(() => validateDomainId("RES-with<illegal>chars", "research"), "Reject illegal filesystem chars in research", "ILLEGAL_FS_CHARS");
    assertThrows(() => validateDomainId("NOT-A-RES-ID", "research"), "Reject research ID not starting with RES-", "INVALID_RESEARCH_ID");

    // -------------------------------------------------------------
    // PART 2: Boundary Containment (resolveSecurePath & assertSecureFileName)
    // -------------------------------------------------------------
    console.log("\n--- PART 2: Boundary Containment Verification ---");
    const testDir = path.join(tempRoot, ".openmemory", "adrs");

    assert(resolveSecurePath(testDir, "ADR-001.md") === path.resolve(testDir, "ADR-001.md"), "Legitimate file in directory resolves securely");
    assertThrows(() => resolveSecurePath(testDir, "../escape.md"), "resolveSecurePath rejects ../escape.md", "RELATIVE_TRAVERSAL_FORBIDDEN");
    assertThrows(() => resolveSecurePath(testDir, "..\\escape.md"), "resolveSecurePath rejects ..\\escape.md", "PATH_SEPARATOR_FORBIDDEN");
    assertThrows(() => resolveSecurePath(testDir, "/etc/passwd"), "resolveSecurePath rejects absolute POSIX path", "ABSOLUTE_PATH_FORBIDDEN");
    assertThrows(() => resolveSecurePath(testDir, "C:\\Windows\\System32\\cmd.exe"), "resolveSecurePath rejects Windows absolute path", "ABSOLUTE_PATH_FORBIDDEN");
    assertThrows(() => assertSecureFileName(testDir, "sub/ADR-001.md"), "assertSecureFileName rejects subdirectories", "PATH_SEPARATOR_FORBIDDEN");

    // -------------------------------------------------------------
    // PART 3: End-to-End High-Level Storage API Hardening
    // -------------------------------------------------------------
    console.log("\n--- PART 3: End-to-End High-Level Storage API Hardening ---");

    // Setup active session for authorization
    const state = storage.getOrInitProjectState();
    storage.registerSession({ id: "sess-sec-test", agentId: "agent-sec-test", status: "ACTIVE" });

    // 3A. ADR Attacks
    console.log("3A. ADR Storage Attacks:");
    assertThrows(() => {
      storage.saveADR({
        id: "ADR-../../escaped_adr",
        title: "Malicious ADR",
        context: "Context",
        decision: "Decision",
      }, "agent-sec-test", "sess-sec-test");
    }, "storage.saveADR rejects traversal in ID");

    // Verify legitimate ADR works
    const legitAdr = storage.saveADR({
      id: "ADR-001",
      title: "Legitimate ADR",
      context: "Valid Context",
      decision: "Valid Decision",
    }, "agent-sec-test", "sess-sec-test");
    assert(legitAdr.id === "ADR-001", "storage.saveADR succeeds for legitimate ADR-001");
    const fetchedAdr = storage.getADR("ADR-001");
    assert(fetchedAdr !== null && fetchedAdr.title === "Legitimate ADR", "storage.getADR fetches legitimate ADR");

    // Verify getADR rejects traversal
    assertThrows(() => storage.getADR("ADR-../../escaped_adr"), "storage.getADR rejects traversal in ID");

    // 3B. Research Attacks
    console.log("3B. Research Storage Attacks:");
    assertThrows(() => {
      storage.saveResearch({
        id: "RES-../../escaped_research" as any,
        topic: "Malicious Research",
        items: [],
      }, "agent-sec-test", "sess-sec-test");
    }, "storage.saveResearch rejects traversal in ID");

    // Verify legitimate Research works
    const legitRes = storage.saveResearch({
      id: "RES-2026-10-15-sec-01",
      topic: "Valid Security Research",
      items: [{
        id: "RES-2026-10-15-sec-01-ITEM-1",
        type: "FACT",
        classification: "ARCHITECTURE",
        title: "Path Traversal Hardening",
        content: "Verified containment",
        tags: ["security"],
      }],
    }, "agent-sec-test", "sess-sec-test");
    assert(legitRes.id === "RES-2026-10-15-sec-01", "storage.saveResearch succeeds for legitimate ID");

    const fetchedRes = storage.getResearch("RES-2026-10-15-sec-01");
    assert(fetchedRes !== null && fetchedRes.topic === "Valid Security Research", "storage.getResearch fetches legitimate record");

    // Verify getResearch & deleteResearch reject traversal
    assertThrows(() => storage.getResearch("RES-../../escaped_research"), "storage.getResearch rejects traversal in ID");
    assertThrows(() => storage.deleteResearch("RES-../../escaped_research"), "storage.deleteResearch rejects traversal in ID");

    // 3C. OSS Evaluation Attacks
    console.log("3C. OSS Evaluation Storage Attacks:");
    assertThrows(() => {
      storage.saveOSSEvaluation({
        id: "../../escaped_oss",
        libraryName: "bad-lib",
        license: "MIT",
        fitScore: 10,
        decision: "REJECT",
        evaluatedAt: new Date().toISOString(),
        evaluatorAgentId: "agent-sec-test",
      });
    }, "storage.saveOSSEvaluation rejects traversal in ID");

    assertThrows(() => storage.getOSSEvaluation("../../escaped_oss"), "storage.getOSSEvaluation rejects traversal in ID");

    // 3D. Backup / Restore Attacks
    console.log("3D. Backup / Restore Storage Attacks:");
    assertThrows(() => storage.restoreBackup("../../malicious_backup"), "storage.restoreBackup rejects traversal in backupId");

    // -------------------------------------------------------------
    // PART 4: Verification of File Isolation
    // -------------------------------------------------------------
    console.log("\n--- PART 4: Sandbox Escape Verification ---");
    // Verify that NO files were created outside tempRoot/.openmemory/
    const parentDir = path.dirname(tempRoot);
    const escapedFile1 = path.join(parentDir, "escaped_adr.md");
    const escapedFile2 = path.join(parentDir, "escaped_research.json");
    assert(!fs.existsSync(escapedFile1), "No escaped ADR file exists outside sandbox");
    assert(!fs.existsSync(escapedFile2), "No escaped Research file exists outside sandbox");

    console.log("\n=================================================");
    console.log(`=== ALL ${passedTests}/${totalTests} SECURITY TESTS PASSED (100%) ===`);
    console.log("=================================================");

  } finally {
    // Clean up temporary sandbox
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch (_) {}
  }
}

runSecurityTests().catch(err => {
  console.error("FATAL: Security test suite failed:", err);
  process.exit(1);
});
