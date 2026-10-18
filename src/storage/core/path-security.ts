import * as path from "path";
import * as fs from "fs";

/**
 * Domain types for identifier validation in OpenMemory / Evocara
 */
export type StorageDomain =
  | "adr"
  | "research"
  | "knowledgeItem"
  | "knowledgeRelation"
  | "ossEval"
  | "backup"
  | "task"
  | "session";

/**
 * Path Security Violation Error (SEC-001)
 */
export class PathSecurityError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = "PATH_SECURITY_VIOLATION") {
    super(message);
    this.name = "PathSecurityError";
    this.code = code;
    Object.setPrototypeOf(this, PathSecurityError.prototype);
  }
}

const DOS_DEVICE_NAMES = new Set([
  "CON", "PRN", "AUX", "NUL",
  "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
  "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
]);

export function isDosDeviceName(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const base = name.split(".")[0].toUpperCase().trim();
  return DOS_DEVICE_NAMES.has(base);
}

/**
 * Validates domain identifiers strictly against path traversal, control characters,
 * illegal Windows/POSIX characters, and domain-specific format rules.
 *
 * @param id The raw identifier supplied by caller
 * @param domain The target storage domain
 * @returns The sanitized, validated (and normalized where appropriate) identifier
 * @throws PathSecurityError if the identifier contains illegal characters or fails domain rules
 */
export function validateDomainId(id: string, domain: StorageDomain): string {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new PathSecurityError(`Invalid identifier: identifier must be a non-empty string.`, "INVALID_ID_EMPTY");
  }

  const trimmed = id.trim();

  // 1. Universal Prohibitions (No null bytes, control chars, path separators, drive letters)
  if (/[\x00-\x1f\x7f]/.test(trimmed)) {
    throw new PathSecurityError(`Path traversal attempt detected: identifier contains control characters.`, "INVALID_CONTROL_CHARS");
  }

  if (trimmed.includes("/") || trimmed.includes("\\")) {
    throw new PathSecurityError(`Path traversal attempt detected: identifier '${trimmed}' contains directory separators ('/' or '\\').`, "PATH_SEPARATOR_FORBIDDEN");
  }

  if (trimmed.includes("..")) {
    throw new PathSecurityError(`Path traversal attempt detected: identifier '${trimmed}' contains relative segment '..'.`, "RELATIVE_TRAVERSAL_FORBIDDEN");
  }

  if (/^[a-zA-Z]:/.test(trimmed) || trimmed.startsWith("\\\\") || trimmed.startsWith("//")) {
    throw new PathSecurityError(`Path traversal attempt detected: identifier '${trimmed}' contains drive or UNC prefix.`, "ABSOLUTE_PATH_FORBIDDEN");
  }

  // Windows-reserved file characters: < > : " | ? * (also blocks NTFS Alternate Data Streams)
  if (/[<>:"|?*]/.test(trimmed)) {
    throw new PathSecurityError(`Path security violation: identifier '${trimmed}' contains illegal filesystem characters (< > : " | ? *).`, "ILLEGAL_FS_CHARS");
  }

  // Windows-reserved DOS device names (CON, PRN, AUX, NUL, COM1..9, LPT1..9)
  if (isDosDeviceName(trimmed)) {
    throw new PathSecurityError(`Path security violation: identifier '${trimmed}' is a reserved Windows device name.`, "DOS_DEVICE_NAME_FORBIDDEN");
  }

  // Disallow trailing dots or spaces which cause Win32 path aliasing
  if (trimmed.endsWith(".") || trimmed.endsWith(" ")) {
    throw new PathSecurityError(`Path security violation: identifier '${trimmed}' must not end with a dot or space.`, "TRAILING_DOT_OR_SPACE_FORBIDDEN");
  }

  // 2. Domain-Specific Rules
  switch (domain) {
    case "adr": {
      // Allowed: "ADR-001", "ADR-1", "ADR-123", or pure numeric string "1", "002"
      if (/^\d+$/.test(trimmed)) {
        return `ADR-${trimmed.padStart(3, "0")}`;
      }
      const adrMatch = trimmed.match(/^ADR-(\d+)$/i);
      if (!adrMatch) {
        throw new PathSecurityError(`Invalid ADR identifier format '${trimmed}'. Must be 'ADR-XXX' or numeric.`, "INVALID_ADR_ID");
      }
      return `ADR-${adrMatch[1].padStart(3, "0")}`;
    }

    case "research": {
      // Must start with RES- followed strictly by alphanumeric, hyphens, and underscores
      // e.g. RES-2026-09-26T14-30-00-000Z-a1b2 or RES-spike-01
      // Strip trailing .json if caller included it
      const clean = trimmed.endsWith(".json") ? trimmed.slice(0, -5) : trimmed;
      if (!/^RES-[a-zA-Z0-9_-]+$/.test(clean)) {
        throw new PathSecurityError(`Invalid Research identifier format '${trimmed}'. Must start with 'RES-' and contain only alphanumeric, hyphens or underscores.`, "INVALID_RESEARCH_ID");
      }
      if (clean.length > 128) {
        throw new PathSecurityError(`Research identifier '${clean}' exceeds maximum allowed length of 128 characters.`, "ID_TOO_LONG");
      }
      return clean;
    }

    case "knowledgeItem": {
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        throw new PathSecurityError(`Invalid KnowledgeItem identifier '${trimmed}'. Must contain only alphanumeric, hyphens or underscores.`, "INVALID_KNOWLEDGE_ITEM_ID");
      }
      return trimmed;
    }

    case "knowledgeRelation": {
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        throw new PathSecurityError(`Invalid KnowledgeRelation identifier '${trimmed}'. Must contain only alphanumeric, hyphens or underscores.`, "INVALID_KNOWLEDGE_RELATION_ID");
      }
      return trimmed;
    }

    case "ossEval": {
      const clean = trimmed.endsWith(".json") ? trimmed.slice(0, -5) : trimmed;
      if (!/^[a-zA-Z0-9_-]+$/.test(clean)) {
        throw new PathSecurityError(`Invalid OSS Evaluation identifier '${trimmed}'. Must contain only alphanumeric, hyphens or underscores.`, "INVALID_OSS_EVAL_ID");
      }
      return clean;
    }

    case "backup": {
      // Must contain only alphanumeric, hyphens, dots or underscores
      if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
        throw new PathSecurityError(`Invalid Backup identifier '${trimmed}'. Must contain only alphanumeric, hyphens, dots or underscores.`, "INVALID_BACKUP_ID");
      }
      return trimmed;
    }

    case "task": {
      if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
        throw new PathSecurityError(`Invalid Task identifier '${trimmed}'. Must contain only alphanumeric, hyphens or underscores.`, "INVALID_TASK_ID");
      }
      return trimmed;
    }

    case "session": {
      if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
        throw new PathSecurityError(`Invalid Session identifier '${trimmed}'. Must contain only alphanumeric, hyphens, dots or underscores.`, "INVALID_SESSION_ID");
      }
      return trimmed;
    }

    default:
      throw new PathSecurityError(`Unsupported storage domain: '${domain}'`, "UNSUPPORTED_DOMAIN");
  }
}

/**
 * Resolves a file or relative path securely inside baseDir and enforces boundary containment.
 *
 * @param baseDir The canonical root directory (e.g. adrsDir, researchesDir)
 * @param relativeOrFileName The target file name or relative path
 * @returns The absolute, normalized path strictly verified to be inside baseDir
 * @throws PathSecurityError if the resolved path escapes baseDir
 */
export function resolveSecurePath(baseDir: string, relativeOrFileName: string): string {
  if (typeof baseDir !== "string" || !baseDir.trim()) {
    throw new PathSecurityError("Base directory must be a non-empty string.", "INVALID_BASE_DIR");
  }
  if (typeof relativeOrFileName !== "string" || !relativeOrFileName.trim()) {
    throw new PathSecurityError("Target path must be a non-empty string.", "INVALID_TARGET_PATH");
  }

  // Check for control characters / null bytes
  if (/[\x00-\x1f\x7f]/.test(relativeOrFileName)) {
    throw new PathSecurityError(`Path security violation: target path contains control characters.`, "INVALID_CONTROL_CHARS");
  }

  // Disallow absolute paths passed as relative targets or leading slashes
  if (
    path.isAbsolute(relativeOrFileName) ||
    /^[a-zA-Z]:/.test(relativeOrFileName) ||
    relativeOrFileName.startsWith("\\\\") ||
    relativeOrFileName.startsWith("//") ||
    relativeOrFileName.startsWith("/") ||
    relativeOrFileName.startsWith("\\")
  ) {
    throw new PathSecurityError(`Path traversal violation: target path '${relativeOrFileName}' is an absolute or root-relative path.`, "ABSOLUTE_PATH_FORBIDDEN");
  }

  // Validate individual path components for DOS device names, illegal chars, ADS, and illegal suffixes
  const parts = relativeOrFileName.split(/[/\\]+/);
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      throw new PathSecurityError(`Path traversal violation: target path contains '..'.`, "RELATIVE_TRAVERSAL_FORBIDDEN");
    }
    // Reject NTFS Alternate Data Streams and illegal characters
    if (/[<>:"|?*]/.test(part)) {
      throw new PathSecurityError(`Path security violation: path component '${part}' contains illegal filesystem characters (< > : " | ? *).`, "ILLEGAL_FS_CHARS");
    }
    if (isDosDeviceName(part)) {
      throw new PathSecurityError(`Path security violation: path component '${part}' is a reserved Windows device name.`, "DOS_DEVICE_NAME_FORBIDDEN");
    }
    if (part.endsWith(".") || part.endsWith(" ")) {
      throw new PathSecurityError(`Path security violation: path component '${part}' must not end with a dot or space.`, "TRAILING_DOT_OR_SPACE_FORBIDDEN");
    }
  }

  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(resolvedBase, relativeOrFileName);

  // Boundary verification via path.relative
  const rel = path.relative(resolvedBase, resolvedTarget);

  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new PathSecurityError(
      `Path traversal violation: resolved path '${resolvedTarget}' escapes base directory '${resolvedBase}'.`,
      "PATH_TRAVERSAL_ESCAPED"
    );
  }

  // Deepest existing ancestor path check (defense against symlink escapes even for non-existent target files)
  let currentCheck = resolvedTarget;
  while (currentCheck && !fs.existsSync(currentCheck)) {
    const parent = path.dirname(currentCheck);
    if (parent === currentCheck) break;
    currentCheck = parent;
  }

  if (currentCheck && fs.existsSync(currentCheck)) {
    try {
      const realBase = fs.existsSync(resolvedBase) ? fs.realpathSync(resolvedBase) : resolvedBase;
      const realExisting = fs.realpathSync(currentCheck);
      const realRel = path.relative(realBase, realExisting);
      if (realRel.startsWith("..") || path.isAbsolute(realRel)) {
        throw new PathSecurityError(
          `Symlink traversal violation: ancestor path '${realExisting}' escapes base directory '${realBase}'.`,
          "SYMLINK_ESCAPE_FORBIDDEN"
        );
      }
    } catch (err) {
      if (err instanceof PathSecurityError) throw err;
    }
  }

  // Symlink & physical canonicalization check if target itself exists
  if (fs.existsSync(resolvedTarget)) {
    try {
      const realBase = fs.existsSync(resolvedBase) ? fs.realpathSync(resolvedBase) : resolvedBase;
      const realTarget = fs.realpathSync(resolvedTarget);
      const realRel = path.relative(realBase, realTarget);
      if (realRel.startsWith("..") || path.isAbsolute(realRel)) {
        throw new PathSecurityError(
          `Symlink traversal violation: realpath '${realTarget}' escapes base directory '${realBase}'.`,
          "SYMLINK_ESCAPE_FORBIDDEN"
        );
      }
    } catch (err) {
      if (err instanceof PathSecurityError) throw err;
      // If realpathSync fails due to platform permissions, fallback to lexical validation
    }
  }

  return resolvedTarget;
}

/**
 * Asserts that a pure filename (no directory components) is safe and resolves it within baseDir.
 *
 * @param baseDir The authorized directory
 * @param fileName The single filename without path separators
 * @returns The secure resolved path
 */
export function assertSecureFileName(baseDir: string, fileName: string): string {
  if (fileName.includes("/") || fileName.includes("\\")) {
    throw new PathSecurityError(`Filename '${fileName}' must not contain path separators.`, "PATH_SEPARATOR_FORBIDDEN");
  }
  return resolveSecurePath(baseDir, fileName);
}
