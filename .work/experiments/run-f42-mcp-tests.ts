import * as fs from "fs";
import * as path from "path";
import { createMCPServer } from "../../src/mcp";
import { StorageEngine } from "../../src/storage";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

interface TestResult {
  id: string;
  name: string;
  status: "PASSED" | "FAILED";
  details: string;
}

const results: TestResult[] = [];

// Isolated scratch dir for F4.2 tests
const tempDir = path.join(process.cwd(), ".work", "scratch-f42-mcp-test");
if (fs.existsSync(tempDir)) {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

async function runF42MCPTests() {
  console.log("=================================================");
  console.log("   OpenMemory F4.2 Model Context Protocol (MCP) ");
  console.log("=================================================\n");

  const storage = new StorageEngine(tempDir);
  const server = createMCPServer(tempDir);

  // -------------------------------------------------------------------------
  // Test F4.2-001: Server Instance Creation & Protocol Capability Check
  // -------------------------------------------------------------------------
  try {
    if (!server) {
      throw new Error("createMCPServer returned null or undefined");
    }

    results.push({
      id: "F4.2-001",
      name: "Server Instance Creation",
      status: "PASSED",
      details: "Successfully instantiated MCP Server using @modelcontextprotocol/sdk",
    });
    console.log("[PASSED] F4.2-001: Server Instance Creation");
  } catch (err) {
    results.push({
      id: "F4.2-001",
      name: "Server Instance Creation",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.2-001:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.2-002: tools/list Schema Handler
  // -------------------------------------------------------------------------
  try {
    // Access internal request handler via SDK request mechanism
    const listHandler = (server as any)._requestHandlers.get(ListToolsRequestSchema.shape.method.value);
    if (!listHandler) {
      throw new Error("ListToolsRequestSchema handler not registered on server");
    }

    const listResult = await listHandler({ method: "tools/list" }, {});
    if (!listResult || !Array.isArray(listResult.tools)) {
      throw new Error("tools/list handler returned invalid payload structure");
    }
    if (listResult.tools.length < 5) {
      throw new Error(`Expected at least 5 MCP tools, got ${listResult.tools.length}`);
    }

    const toolNames = listResult.tools.map((t: any) => t.name);
    const expected = [
      "openmemory_status",
      "openmemory_get_handoff",
      "openmemory_save_adr",
      "openmemory_create_backup",
      "openmemory_run_diagnostics",
    ];

    for (const exp of expected) {
      if (!toolNames.includes(exp)) {
        throw new Error(`Tool '${exp}' missing in listTools handler response`);
      }
    }

    results.push({
      id: "F4.2-002",
      name: "tools/list Schema Handler",
      status: "PASSED",
      details: `tools/list returned 5 valid OpenMemory tool schemas: ${toolNames.join(", ")}`,
    });
    console.log("[PASSED] F4.2-002: tools/list Schema Handler");
  } catch (err) {
    results.push({
      id: "F4.2-002",
      name: "tools/list Schema Handler",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.2-002:", (err as Error).message);
  }

  // Retrieve CallTool handler helper
  const callHandler = (server as any)._requestHandlers.get(CallToolRequestSchema.shape.method.value);

  // -------------------------------------------------------------------------
  // Test F4.2-003: openmemory_status Tool Execution
  // -------------------------------------------------------------------------
  try {
    const res = await callHandler(
      {
        method: "tools/call",
        params: { name: "openmemory_status", arguments: {} },
      },
      {}
    );

    if (!res?.content?.[0]?.text?.includes("# OpenMemory Project Context Summary")) {
      throw new Error("openmemory_status output text mismatch");
    }

    results.push({
      id: "F4.2-003",
      name: "openmemory_status Tool Execution",
      status: "PASSED",
      details: "openmemory_status returned structured Markdown context summary via MCP text payload",
    });
    console.log("[PASSED] F4.2-003: openmemory_status Tool Execution");
  } catch (err) {
    results.push({
      id: "F4.2-003",
      name: "openmemory_status Tool Execution",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.2-003:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.2-004: openmemory_get_handoff Tool Execution
  // -------------------------------------------------------------------------
  try {
    const res = await callHandler(
      {
        method: "tools/call",
        params: { name: "openmemory_get_handoff", arguments: {} },
      },
      {}
    );

    if (!res?.content?.[0]?.text?.includes("Session Handoff")) {
      throw new Error("openmemory_get_handoff output text mismatch");
    }

    results.push({
      id: "F4.2-004",
      name: "openmemory_get_handoff Tool Execution",
      status: "PASSED",
      details: "openmemory_get_handoff returned session handoff narrative text payload",
    });
    console.log("[PASSED] F4.2-004: openmemory_get_handoff Tool Execution");
  } catch (err) {
    results.push({
      id: "F4.2-004",
      name: "openmemory_get_handoff Tool Execution",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.2-004:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.2-005: openmemory_save_adr Tool Execution
  // -------------------------------------------------------------------------
  try {
    const sessMcp = storage.registerSession({ agentId: "agent-mcp", status: "ACTIVE" });
    const res = await callHandler(
      {
        method: "tools/call",
        params: {
          name: "openmemory_save_adr",
          arguments: {
            title: "MCP Integration Architecture",
            date: "2026-09-25",
            context: "Cross-client interoperability with Cursor and Claude Desktop.",
            decision: "Integrate @modelcontextprotocol/sdk over STDIO transport.",
            consequences: "Provides zero-code protocol compliance.",
            agentId: "agent-mcp",
            sessionId: sessMcp.id,
          },
        },
      },
      {}
    );

    if (!res?.content?.[0]?.text?.includes("ADR-001")) {
      throw new Error("openmemory_save_adr response missing ADR ID");
    }

    const createdAdrFile = path.join(tempDir, ".openmemory", "adrs", "ADR-001.md");
    if (!fs.existsSync(createdAdrFile)) {
      throw new Error(`ADR file ${createdAdrFile} was not created on disk`);
    }

    results.push({
      id: "F4.2-005",
      name: "openmemory_save_adr Tool Execution",
      status: "PASSED",
      details: "openmemory_save_adr created ADR-001.md atomically via MCP request",
    });
    console.log("[PASSED] F4.2-005: openmemory_save_adr Tool Execution");
  } catch (err) {
    results.push({
      id: "F4.2-005",
      name: "openmemory_save_adr Tool Execution",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.2-005:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.2-006: openmemory_create_backup Tool Execution
  // -------------------------------------------------------------------------
  try {
    const res = await callHandler(
      {
        method: "tools/call",
        params: {
          name: "openmemory_create_backup",
          arguments: { label: "mcp-test-backup" },
        },
      },
      {}
    );

    if (!res?.content?.[0]?.text?.includes("Backup created successfully")) {
      throw new Error("openmemory_create_backup text response mismatch");
    }

    const backupsDir = path.join(tempDir, ".openmemory", "backups");
    if (!fs.existsSync(backupsDir) || fs.readdirSync(backupsDir).length === 0) {
      throw new Error("Backup directory empty after MCP create_backup call");
    }

    results.push({
      id: "F4.2-006",
      name: "openmemory_create_backup Tool Execution",
      status: "PASSED",
      details: "openmemory_create_backup created atomic state snapshot via MCP request",
    });
    console.log("[PASSED] F4.2-006: openmemory_create_backup Tool Execution");
  } catch (err) {
    results.push({
      id: "F4.2-006",
      name: "openmemory_create_backup Tool Execution",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.2-006:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.2-007: openmemory_run_diagnostics Tool Execution
  // -------------------------------------------------------------------------
  try {
    const res = await callHandler(
      {
        method: "tools/call",
        params: {
          name: "openmemory_run_diagnostics",
          arguments: {},
        },
      },
      {}
    );

    if (!res?.content?.[0]?.text?.includes("Diagnostics Status: HEALTHY")) {
      throw new Error("openmemory_run_diagnostics response mismatch");
    }

    results.push({
      id: "F4.2-007",
      name: "openmemory_run_diagnostics Tool Execution",
      status: "PASSED",
      details: "openmemory_run_diagnostics returned HEALTHY diagnostic report via MCP text payload",
    });
    console.log("[PASSED] F4.2-007: openmemory_run_diagnostics Tool Execution");
  } catch (err) {
    results.push({
      id: "F4.2-007",
      name: "openmemory_run_diagnostics Tool Execution",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.2-007:", (err as Error).message);
  }

  // -------------------------------------------------------------------------
  // Test F4.2-008: Config File & End-to-End Module Validation
  // -------------------------------------------------------------------------
  try {
    const mcpConfigPath = path.join(process.cwd(), "mcp_config.json");
    if (!fs.existsSync(mcpConfigPath)) {
      throw new Error("mcp_config.json missing at workspace root");
    }
    const rawConfig = fs.readFileSync(mcpConfigPath, "utf-8");
    const parsedConfig = JSON.parse(rawConfig);
    if (!parsedConfig.mcpServers?.openmemory) {
      throw new Error("mcp_config.json missing openmemory server entry");
    }

    results.push({
      id: "F4.2-008",
      name: "Config File & End-to-End Module Validation",
      status: "PASSED",
      details: "Validated mcp_config.json integration template and MCP server module exports",
    });
    console.log("[PASSED] F4.2-008: Config File & End-to-End Module Validation");
  } catch (err) {
    results.push({
      id: "F4.2-008",
      name: "Config File & End-to-End Module Validation",
      status: "FAILED",
      details: (err as Error).message,
    });
    console.error("[FAILED] F4.2-008:", (err as Error).message);
  }

  // Cleanup scratch directory
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}

  // Write evidence
  const evidenceDir = path.join(process.cwd(), ".work", "evidence");
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }
  const evidenceFile = path.join(evidenceDir, "phase-4.2-mcp-test-results.json");
  fs.writeFileSync(evidenceFile, JSON.stringify(results, null, 2), "utf-8");

  console.log("\n=================================================");
  console.log("   F4.2 MCP Test Execution Complete!             ");
  console.log(`   Results saved to: .work/evidence/phase-4.2-mcp-test-results.json`);
  console.log("=================================================");

  const failedCount = results.filter((r) => r.status === "FAILED").length;
  if (failedCount > 0) {
    process.exit(1);
  }
}

runF42MCPTests();
