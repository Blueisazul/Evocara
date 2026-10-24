import * as fs from "fs";
import * as path from "path";
import { StorageEngine } from "./storage";
import { MASTER_PHASE_ORDER } from "./master-prompt";

export interface InstallationOptions {
  targetDir?: string;
  createAgentsMdIfMissing?: boolean;
  setupPlugin?: boolean;
  setupMcp?: boolean;
}

export interface InstallationResult {
  success: boolean;
  storageInitialized: boolean;
  agentsMdUpdated: boolean;
  pluginShimCreated: boolean;
  mcpConfigured: boolean;
  backupCreated: string | null;
  mcpBackupCreated: string | null;
  targetAgentsMdPath: string;
  targetPluginPath: string;
  targetMcpConfigPath: string;
}

export interface UninstallResult {
  success: boolean;
  agentsMdCleaned: boolean;
  pluginShimRemoved: boolean;
  mcpConfigRemoved: boolean;
  storagePreserved: boolean;
}

export const OPENMEMORY_DELIMITED_BLOCK = `<!-- OPENMEMORY:START -->
## OpenMemory Context Pointer & Knowledge SOP
* Active Session Handoff: \`.openmemory/handoff.md\`
* Active Project State Index: \`.openmemory/project-state.json\`
* Core Storage Engine: \`src/storage.ts\`
* Governance Boundary Note: StageEngine \`canModifyProductionCode()\` provides protocol/prompt Soft Governance. Hard I/O write sandboxing remains a host IDE policy.
* Research & Knowledge Capture: When research (via Scout, Explore, WebSearch, WebFetch, etc.) yields findings, repository architecture, dependencies, or decisions of future value, synthesize findings and record them via MCP tool \`openmemory_record_knowledge\`. Query past knowledge via \`openmemory_query_knowledge\`.
<!-- OPENMEMORY:END -->`;

export const SHIM_HEADER_MARKER = "// OPENMEMORY MANAGED SHIM - DO NOT EDIT MANUALLY";
export const OPENCODE_SHIM_CONTENT = `${SHIM_HEADER_MARKER}
import { OpenMemoryPlugin } from "openmemory/plugin";

export default OpenMemoryPlugin;
`;

export function setupOpenCodePlugin(targetDir: string): { created: boolean; updated: boolean; targetPath: string } {
  const pluginDir = path.join(targetDir, ".opencode", "plugins");
  const targetPath = path.join(pluginDir, "openmemory.ts");
  const storage = new StorageEngine(targetDir);

  if (fs.existsSync(targetPath)) {
    const existing = fs.readFileSync(targetPath, "utf-8");
    if (!existing.includes(SHIM_HEADER_MARKER)) {
      // User has custom plugin file with same name; preserve it!
      return { created: false, updated: false, targetPath };
    }
    if (existing.trim() === OPENCODE_SHIM_CONTENT.trim()) {
      return { created: false, updated: false, targetPath };
    }
  }

  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir, { recursive: true });
  }

  storage.atomicWriteFileSync(targetPath, OPENCODE_SHIM_CONTENT);
  return { created: true, updated: true, targetPath };
}

export function setupMCPServer(targetDir: string): { configured: boolean; backupPath: string | null; targetPath: string } {
  const rootConfigPath = path.join(targetDir, "opencode.json");
  const localConfigPath = path.join(targetDir, ".opencode", "opencode.json");
  const storage = new StorageEngine(targetDir);

  let targetPath = rootConfigPath;
  if (!fs.existsSync(rootConfigPath) && fs.existsSync(localConfigPath)) {
    targetPath = localConfigPath;
  }

  let existingConfig: Record<string, any> = {};
  let backupPath: string | null = null;

  if (fs.existsSync(targetPath)) {
    try {
      const raw = fs.readFileSync(targetPath, "utf-8");
      existingConfig = JSON.parse(raw);

      // Create pre-modification atomic backup
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupsDir = path.join(targetDir, ".openmemory", "backups");
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }
      backupPath = path.join(backupsDir, `${path.basename(targetPath)}.${timestamp}.bak`);
      storage.atomicWriteFileSync(backupPath, raw);
    } catch (_) {
      existingConfig = {};
    }
  }

  const mcpEntry = {
    command: "node",
    args: ["node_modules/openmemory/dist/mcp.js"],
    description: "OpenMemory Zero-Dependency Operational Memory Framework MCP Adapter",
  };

  const mcpServers = existingConfig.mcpServers || {};
  mcpServers.openmemory = mcpEntry;
  existingConfig.mcpServers = mcpServers;

  if (!existingConfig["$schema"]) {
    existingConfig["$schema"] = "https://opencode.ai/config.json";
  }

  storage.atomicWriteFileSync(targetPath, JSON.stringify(existingConfig, null, 2) + "\n");
  return { configured: true, backupPath, targetPath };
}

export function installOpenMemory(options?: InstallationOptions): InstallationResult {
  const targetDir = options?.targetDir || process.cwd();
  const createIfMissing = options?.createAgentsMdIfMissing ?? true;
  const doSetupPlugin = options?.setupPlugin ?? true;
  const doSetupMcp = options?.setupMcp ?? true;

  const targetAgentsMdPath = path.join(targetDir, "AGENTS.md");

  const storage = new StorageEngine(targetDir);
  storage.ensureStorageStructure();
  storage.getOrInitManifest();
  storage.getOrInitProjectState();
  storage.getOrInitHandoff();

  let backupCreated: string | null = null;
  let agentsMdUpdated = false;

  const agentsMdExists = fs.existsSync(targetAgentsMdPath);

  if (agentsMdExists) {
    const existingContent = fs.readFileSync(targetAgentsMdPath, "utf-8");

    // 1. Create pre-modification atomic backup snapshot
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupsDir = path.join(targetDir, ".openmemory", "backups");
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    const backupPath = path.join(backupsDir, `AGENTS.md.${timestamp}.bak`);
    backupCreated = backupPath;
    storage.atomicWriteFileSync(backupPath, existingContent);

    // 2. Idempotent block insertion / update
    const blockRegex = /<!-- OPENMEMORY:START -->[\s\S]*?<!-- OPENMEMORY:END -->/;
    let newContent: string;

    if (blockRegex.test(existingContent)) {
      newContent = existingContent.replace(blockRegex, OPENMEMORY_DELIMITED_BLOCK);
    } else {
      const cleanExisting = existingContent.trimEnd();
      newContent = cleanExisting ? `${cleanExisting}\n\n${OPENMEMORY_DELIMITED_BLOCK}\n` : `${OPENMEMORY_DELIMITED_BLOCK}\n`;
    }

    storage.atomicWriteFileSync(targetAgentsMdPath, newContent);
    agentsMdUpdated = true;
  } else if (createIfMissing) {
    const defaultContent = `# Project Agent Guidelines\n\n${OPENMEMORY_DELIMITED_BLOCK}\n`;
    storage.atomicWriteFileSync(targetAgentsMdPath, defaultContent);
    agentsMdUpdated = true;
  }

  let pluginRes = { created: false, targetPath: path.join(targetDir, ".opencode", "plugins", "openmemory.ts") };
  if (doSetupPlugin) {
    pluginRes = setupOpenCodePlugin(targetDir);
  }

  let mcpRes = { configured: false, backupPath: null as string | null, targetPath: path.join(targetDir, "opencode.json") };
  if (doSetupMcp) {
    mcpRes = setupMCPServer(targetDir);
  }

  return {
    success: true,
    storageInitialized: true,
    agentsMdUpdated,
    pluginShimCreated: pluginRes.created,
    mcpConfigured: mcpRes.configured,
    backupCreated,
    mcpBackupCreated: mcpRes.backupPath,
    targetAgentsMdPath,
    targetPluginPath: pluginRes.targetPath,
    targetMcpConfigPath: mcpRes.targetPath,
  };
}

export function uninstallOpenMemory(options?: { targetDir?: string }): UninstallResult {
  const targetDir = options?.targetDir || process.cwd();
  const storage = new StorageEngine(targetDir);

  let agentsMdCleaned = false;
  let pluginShimRemoved = false;
  let mcpConfigRemoved = false;

  // 1. Clean AGENTS.md block
  const targetAgentsMdPath = path.join(targetDir, "AGENTS.md");
  if (fs.existsSync(targetAgentsMdPath)) {
    const existing = fs.readFileSync(targetAgentsMdPath, "utf-8");
    const blockRegex = /\n?\n?<!-- OPENMEMORY:START -->[\s\S]*?<!-- OPENMEMORY:END -->\n?/;
    if (blockRegex.test(existing)) {
      const cleaned = existing.replace(blockRegex, "").trimEnd() + "\n";
      storage.atomicWriteFileSync(targetAgentsMdPath, cleaned);
      agentsMdCleaned = true;
    }
  }

  // 2. Remove Plugin Shim ONLY IF managed by OpenMemory
  const targetPluginPath = path.join(targetDir, ".opencode", "plugins", "openmemory.ts");
  if (fs.existsSync(targetPluginPath)) {
    const existing = fs.readFileSync(targetPluginPath, "utf-8");
    if (existing.includes(SHIM_HEADER_MARKER)) {
      fs.unlinkSync(targetPluginPath);
      pluginShimRemoved = true;
    }
  }

  // 3. Remove MCP Server entry from opencode.json
  const rootConfigPath = path.join(targetDir, "opencode.json");
  const localConfigPath = path.join(targetDir, ".opencode", "opencode.json");
  const targetConfigPath = fs.existsSync(rootConfigPath) ? rootConfigPath : (fs.existsSync(localConfigPath) ? localConfigPath : null);

  if (targetConfigPath && fs.existsSync(targetConfigPath)) {
    try {
      const raw = fs.readFileSync(targetConfigPath, "utf-8");
      const config = JSON.parse(raw);
      if (config.mcpServers && config.mcpServers.openmemory) {
        delete config.mcpServers.openmemory;
        if (Object.keys(config.mcpServers).length === 0) {
          delete config.mcpServers;
        }
        mcpConfigRemoved = true;
        storage.atomicWriteFileSync(targetConfigPath, JSON.stringify(config, null, 2) + "\n");
      }
    } catch (_) {}
  }

  return {
    success: true,
    agentsMdCleaned,
    pluginShimRemoved,
    mcpConfigRemoved,
    storagePreserved: fs.existsSync(path.join(targetDir, ".openmemory")),
  };
}

export interface InteractiveInitResult extends InstallationResult {
  discoveredProjectName: string;
  inferredGoal: string;
  inferredPhase: string;
  unknownsIdentified: string[];
  userConfirmed: boolean;
  userAnswers?: {
    projectName: string;
    activeGoal: string;
    activePhase: string;
  };
}

/**
 * F11.1 Interactive /init Wizard
 * Flow: DISCOVER -> INFER -> IDENTIFY UNKNOWN -> ASK -> CONFIRM -> PERSIST
 */
export async function runInteractiveInitWizard(options?: InstallationOptions & {
  answersProvider?: (promptText: string, defaultValue: string) => Promise<string>;
  confirmProvider?: (summaryText: string) => Promise<boolean>;
}): Promise<InteractiveInitResult> {
  const targetDir = options?.targetDir || process.cwd();
  const storage = new StorageEngine(targetDir);

  // 1. DISCOVER & INFER
  let discoveredProjectName = path.basename(targetDir);
  const pkgPath = path.join(targetDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.name) discoveredProjectName = pkg.name;
    } catch (_) {}
  }

  const isInternalOpenMemory = discoveredProjectName.toLowerCase().includes("openmemory");
  const inferredGoal = isInternalOpenMemory
    ? "Implement OpenMemory v0.3 Core Engine & Orchestration"
    : `Inicialización del proyecto ${discoveredProjectName}`;
  const inferredPhase = isInternalOpenMemory ? "PHASE_3_IMPLEMENTATION" : "DESCUBRIR";

  // 2. IDENTIFY UNKNOWN
  const unknownsIdentified: string[] = [];
  const agentsMdPath = path.join(targetDir, "AGENTS.md");
  if (!fs.existsSync(agentsMdPath)) {
    unknownsIdentified.push("AGENTS.md no existe en la raíz del repositorio.");
  }
  if (!fs.existsSync(path.join(targetDir, ".openmemory"))) {
    unknownsIdentified.push("Directorio de memoria de OpenMemory (.openmemory) no inicializado.");
  }
  if (!fs.existsSync(pkgPath)) {
    unknownsIdentified.push("package.json no detectado; nombre de proyecto derivado de la carpeta.");
  }

  // 3. ASK (Interactive Prompting)
  const defaultAsk = async (promptText: string, defaultValue: string): Promise<string> => {
    return new Promise((resolve) => {
      const readline = require("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(`${promptText} [Default: "${defaultValue}"]: `, (answer: string) => {
        rl.close();
        resolve(answer.trim() || defaultValue);
      });
    });
  };

  const ask = options?.answersProvider || defaultAsk;

  const finalProjectName = await ask("DISCOVER: Nombre del proyecto", discoveredProjectName);
  const finalActiveGoal = await ask("INFER: Meta activa del proyecto", inferredGoal);
  const finalActivePhase = await ask("INFER: Fase inicial", inferredPhase);

  // 4. CONFIRM
  const summaryText = [
    `=== OpenMemory /init Wizard Summary ===`,
    `Proyecto: ${finalProjectName}`,
    `Meta Activa: ${finalActiveGoal}`,
    `Fase Inicial: ${finalActivePhase}`,
    `Incertidumbres Identificadas (${unknownsIdentified.length}):`,
    ...unknownsIdentified.map((u) => `  - ${u}`),
    `¿Confirmar y persistir inicialización?`,
  ].join("\n");

  const defaultConfirm = async (text: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const readline = require("readline");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(`${text} (y/N): `, (answer: string) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes");
      });
    });
  };

  const confirm = options?.confirmProvider || defaultConfirm;
  const userConfirmed = await confirm(summaryText);

  // Cancellation Safeguard: If not confirmed, return without persisting state or modifying disk!
  if (!userConfirmed) {
    return {
      success: false,
      storageInitialized: false,
      agentsMdUpdated: false,
      pluginShimCreated: false,
      mcpConfigured: false,
      backupCreated: null,
      mcpBackupCreated: null,
      targetAgentsMdPath: agentsMdPath,
      targetPluginPath: path.join(targetDir, ".opencode", "plugins", "openmemory.ts"),
      targetMcpConfigPath: path.join(targetDir, "opencode.json"),
      discoveredProjectName,
      inferredGoal,
      inferredPhase,
      unknownsIdentified,
      userConfirmed: false,
      userAnswers: {
        projectName: finalProjectName,
        activeGoal: finalActiveGoal,
        activePhase: finalActivePhase,
      },
    };
  }

  // 5. PERSIST (Via StorageEngine Single Writer Facade & Adapters Installer)
  const installRes = installOpenMemory({
    targetDir,
    createAgentsMdIfMissing: options?.createAgentsMdIfMissing,
    setupPlugin: options?.setupPlugin,
    setupMcp: options?.setupMcp,
  });

  // Update storage state with user-confirmed answers and resolve phase ID correctly
  const state = storage.getOrInitProjectState();
  if (finalActivePhase) {
    if ((MASTER_PHASE_ORDER as string[]).includes(finalActivePhase)) {
      state.currentStage = finalActivePhase as any;
      if (!state.roadmap) {
        state.roadmap = { activePhaseId: "PHASE-1", phases: [], updatedAt: new Date().toISOString() };
      } else {
        const matchingPhase = state.roadmap.phases.find(
          (p) => p.currentStage === finalActivePhase || p.id === finalActivePhase
        );
        state.roadmap.activePhaseId = matchingPhase ? matchingPhase.id : (state.roadmap.phases[0]?.id || "PHASE-1");
        state.activePhase = matchingPhase ? matchingPhase.name : finalActivePhase;
      }
    } else {
      if (!state.roadmap) {
        state.roadmap = { activePhaseId: finalActivePhase, phases: [], updatedAt: new Date().toISOString() };
      } else {
        state.roadmap.activePhaseId = finalActivePhase;
      }
    }
  }
  storage.saveProjectState(state);
  const initSess = storage.registerSession({ agentId: "agent-init", status: "ACTIVE" });
  storage.updateHandoff({ activeGoal: finalActiveGoal, activePhase: state.activePhase }, "agent-init", initSess.id);

  // Update manifest if project name changed
  const manifest = storage.getOrInitManifest();
  if (finalProjectName && manifest.projectName !== finalProjectName) {
    manifest.projectName = finalProjectName;
    manifest.updatedAt = new Date().toISOString();
    storage.atomicWriteFileSync(path.join(targetDir, ".openmemory", "openmemory.json"), JSON.stringify(manifest, null, 2));
  }

  storage.logEvent(
    "init.interactive_completed",
    {
      projectName: finalProjectName,
      activeGoal: finalActiveGoal,
      currentStage: state.currentStage,
      unknownsCount: unknownsIdentified.length,
    },
    "agent-init"
  );

  return {
    ...installRes,
    discoveredProjectName,
    inferredGoal,
    inferredPhase,
    unknownsIdentified,
    userConfirmed: true,
    userAnswers: {
      projectName: finalProjectName,
      activeGoal: finalActiveGoal,
      activePhase: finalActivePhase,
    },
  };
}

// Evocara Dual Identity Alias Exports
export const installEvocara = installOpenMemory;
export const uninstallEvocara = uninstallOpenMemory;
export const initEvocaraInteractive = runInteractiveInitWizard;
