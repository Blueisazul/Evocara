/**
 * Granular Vulnerability Advisory Differential Comparator for OpenMemory Promotion Gates (P0.9 Hardened)
 *
 * Implements granular, advisory-level and dependency-aware differential comparison
 * between pre-promotion and post-promotion npm audit JSON reports.
 *
 * Capabilities:
 * 1. Normalizes advisory identifiers (extracts GHSA / CVE / source IDs from URLs).
 * 2. Normalizes package names, version ranges, and severity levels.
 * 3. Handles duplicate advisories and deduplicates dependency graph cycles.
 * 4. Distinguishes:
 *    - newlyIntroducedAdvisories: new advisory IDs introduced by candidate
 *    - newlyVulnerablePackages: packages previously clean now exhibiting vulnerabilities
 *    - resolvedAdvisories: advisories fixed or eliminated
 *    - severityChanged: advisories with modified severity (flagging regressions)
 *    - indeterminate: network errors, offline registry, truncated or corrupt JSON reports
 * 5. Strict blocking on any security regression or indeterminate state.
 * 6. Deterministic process exit codes:
 *    - Exit 0: PASSED (Conforme)
 *    - Exit 1: BLOCKED (Security regression or severity worsened)
 *    - Exit 2: INDETERMINATE (Corrupt/truncated JSON, network/registry error)
 */

const fs = require("fs");
const path = require("path");

const SEVERITY_LEVELS = {
  info: 1,
  low: 2,
  moderate: 3,
  medium: 3,
  high: 4,
  critical: 5,
};

function normalizeSeverity(sev) {
  if (!sev) return "low";
  const s = String(sev).toLowerCase().trim();
  return SEVERITY_LEVELS[s] ? s : "low";
}

function normalizeAdvisoryId(idOrUrl) {
  if (!idOrUrl) return "unknown-advisory";
  const str = String(idOrUrl).trim();
  // Extract GHSA if in URL
  const ghsaMatch = str.match(/GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/i);
  if (ghsaMatch) return ghsaMatch[0].toUpperCase();
  // Extract CVE if in URL
  const cveMatch = str.match(/CVE-\d{4}-\d+/i);
  if (cveMatch) return cveMatch[0].toUpperCase();
  // Strip URL protocol and domain if generic URL
  try {
    const u = new URL(str);
    return u.pathname.replace(/^\/+/g, "").replace(/\/+$/g, "");
  } catch (_) {
    return str;
  }
}

function parseAuditReport(reportInput) {
  if (reportInput === undefined || reportInput === null || reportInput === "") {
    return { valid: false, error: "Empty or null audit input" };
  }

  let data;
  if (typeof reportInput === "string") {
    const trimmed = reportInput.trim();
    if (!trimmed) {
      return { valid: false, error: "Whitespace-only audit input" };
    }
    try {
      data = JSON.parse(trimmed);
    } catch (e) {
      return { valid: false, error: `Invalid or truncated JSON syntax: ${e.message}` };
    }
  } else if (typeof reportInput === "object") {
    data = reportInput;
  } else {
    return { valid: false, error: "Unsupported report input type (expected string or object)" };
  }

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, error: "Audit report root must be a non-null object" };
  }

  // Detect npm audit network/registry error structures
  if (data.error) {
    const errCode = data.error.code || data.error.summary || JSON.stringify(data.error);
    return {
      valid: false,
      error: `npm audit error encountered: ${errCode}`,
    };
  }

  // Detect direct error payload from npm or registry (e.g. ENOTFOUND, ECONNREFUSED, ETIMEDOUT)
  if (data.code && (typeof data.code === "string" || typeof data.code === "number")) {
    return {
      valid: false,
      error: `npm registry error response: ${data.code} ${data.message || ""}`.trim(),
    };
  }

  if (data.statusCode && data.statusCode >= 400) {
    return {
      valid: false,
      error: `npm registry HTTP error ${data.statusCode}: ${data.message || data.error || ""}`.trim(),
    };
  }

  const advisories = new Map();
  const vulnerablePackages = new Set();

  if (data.vulnerabilities && typeof data.vulnerabilities === "object" && !Array.isArray(data.vulnerabilities)) {
    // npm v7+ / v8 / v9 / v10 schema
    for (const [rawPkgName, vuln] of Object.entries(data.vulnerabilities)) {
      if (!vuln || typeof vuln !== "object" || Array.isArray(vuln)) continue;

      const pkgName = rawPkgName.toLowerCase().trim();
      vulnerablePackages.add(pkgName);

      const topSeverity = normalizeSeverity(vuln.severity);
      const isDirect = Boolean(vuln.isDirect);
      const range = vuln.range || "*";

      if (Array.isArray(vuln.via) && vuln.via.length > 0) {
        for (const viaItem of vuln.via) {
          if (typeof viaItem === "object" && viaItem !== null) {
            const advId = normalizeAdvisoryId(viaItem.url || viaItem.source || viaItem.title || `${pkgName}-${range}`);
            const key = `${pkgName}::${advId}`;
            if (!advisories.has(key)) {
              advisories.set(key, {
                key,
                package: pkgName,
                advisoryId: advId,
                severity: normalizeSeverity(viaItem.severity || topSeverity),
                title: viaItem.title || `Vulnerability in ${pkgName}`,
                url: viaItem.url || null,
                range: viaItem.range || range,
                isDirect,
              });
            }
          } else if (typeof viaItem === "string") {
            const depName = viaItem.toLowerCase().trim();
            const key = `${pkgName}::via-${depName}`;
            if (!advisories.has(key)) {
              advisories.set(key, {
                key,
                package: pkgName,
                advisoryId: `transitive-via-${depName}`,
                severity: topSeverity,
                title: `Transitive vulnerability inherited from ${depName}`,
                url: null,
                range,
                isDirect,
              });
            }
          }
        }
      } else {
        const key = `${pkgName}::${topSeverity}::${range}`;
        advisories.set(key, {
          key,
          package: pkgName,
          advisoryId: key,
          severity: topSeverity,
          title: `Vulnerability in ${pkgName}`,
          url: null,
          range,
          isDirect,
        });
      }
    }
  } else if (data.advisories && typeof data.advisories === "object" && !Array.isArray(data.advisories)) {
    // npm v6 legacy schema
    for (const [rawAdvId, adv] of Object.entries(data.advisories)) {
      if (!adv || typeof adv !== "object" || Array.isArray(adv)) continue;
      const pkgName = String(adv.module_name || "").toLowerCase().trim();
      vulnerablePackages.add(pkgName);
      const advId = normalizeAdvisoryId(adv.cves?.[0] || adv.github_advisory_id || rawAdvId);
      const key = `${pkgName}::${advId}`;
      advisories.set(key, {
        key,
        package: pkgName,
        advisoryId: advId,
        severity: normalizeSeverity(adv.severity),
        title: adv.title || "Advisory",
        url: adv.url || null,
        range: adv.vulnerable_versions || "*",
        isDirect: false,
      });
    }
  } else if (data.metadata?.vulnerabilities && typeof data.metadata.vulnerabilities === "object") {
    // Clean metadata report with 0 vulnerabilities
    const total = Object.values(data.metadata.vulnerabilities).reduce((acc, v) => acc + (typeof v === "number" ? v : 0), 0);
    if (total > 0 && advisories.size === 0) {
      return { valid: false, error: "Audit report indicates vulnerabilities in metadata but lacks vulnerability details" };
    }
  } else {
    return { valid: false, error: "Unrecognized, empty, or truncated audit report schema" };
  }

  return {
    valid: true,
    advisories,
    vulnerablePackages,
    metadata: data.metadata || null,
    totalCount: advisories.size,
  };
}

function isSeverityWorse(oldSev, newSev) {
  const o = SEVERITY_LEVELS[normalizeSeverity(oldSev)] || 0;
  const n = SEVERITY_LEVELS[normalizeSeverity(newSev)] || 0;
  return n > o;
}

function compareAudits(preInput, postInput) {
  const parsedPre = parseAuditReport(preInput);
  const parsedPost = parseAuditReport(postInput);

  if (!parsedPre.valid) {
    return {
      status: "INDETERMINATE",
      decision: "BLOCKED",
      reason: `Pre-promotion audit is invalid or unavailable: ${parsedPre.error}`,
      pre: null,
      post: null,
    };
  }

  if (!parsedPost.valid) {
    return {
      status: "INDETERMINATE",
      decision: "BLOCKED",
      reason: `Post-promotion audit is invalid or unavailable: ${parsedPost.error}`,
      pre: parsedPre,
      post: null,
    };
  }

  const preMap = parsedPre.advisories;
  const postMap = parsedPost.advisories;

  const preExisting = [];
  const newlyIntroduced = [];
  const resolved = [];
  const severityChanged = [];
  const newlyVulnerablePackages = [];

  // Check newly vulnerable packages
  for (const pkg of parsedPost.vulnerablePackages) {
    if (!parsedPre.vulnerablePackages.has(pkg)) {
      newlyVulnerablePackages.push(pkg);
    }
  }

  // Check post advisories against pre
  for (const [key, postAdv] of postMap.entries()) {
    if (preMap.has(key)) {
      const preAdv = preMap.get(key);
      if (preAdv.severity !== postAdv.severity) {
        severityChanged.push({
          package: postAdv.package,
          advisoryId: postAdv.advisoryId,
          oldSeverity: preAdv.severity,
          newSeverity: postAdv.severity,
          title: postAdv.title,
        });
      } else {
        preExisting.push(postAdv);
      }
    } else {
      newlyIntroduced.push(postAdv);
    }
  }

  // Check resolved pre advisories
  for (const [key, preAdv] of preMap.entries()) {
    if (!postMap.has(key)) {
      resolved.push(preAdv);
    }
  }

  const hasNewVulns = newlyIntroduced.length > 0;
  const hasNewVulnerablePkgs = newlyVulnerablePackages.length > 0;
  const hasSeverityIncrease = severityChanged.some((s) => isSeverityWorse(s.oldSeverity, s.newSeverity));

  let decision = "PASSED";
  let status = "CONFORME";
  const blockingReasons = [];

  if (hasNewVulns) {
    decision = "BLOCKED";
    status = "REGRESSION_DETECTED";
    blockingReasons.push(`Introduced ${newlyIntroduced.length} new vulnerability advisory(ies).`);
  }

  if (hasNewVulnerablePkgs) {
    decision = "BLOCKED";
    status = "REGRESSION_DETECTED";
    blockingReasons.push(`Introduced vulnerabilities into previously clean packages: ${newlyVulnerablePackages.join(", ")}.`);
  }

  if (hasSeverityIncrease) {
    decision = "BLOCKED";
    status = "SEVERITY_WORSENED";
    blockingReasons.push("One or more existing vulnerabilities worsened in severity.");
  }

  return {
    status,
    decision,
    blockingReasons,
    metrics: {
      preTotal: parsedPre.advisories.size,
      postTotal: parsedPost.advisories.size,
      preExistingCount: preExisting.length,
      newlyIntroducedCount: newlyIntroduced.length,
      newlyVulnerablePackagesCount: newlyVulnerablePackages.length,
      resolvedCount: resolved.length,
      severityChangedCount: severityChanged.length,
    },
    details: {
      newlyIntroduced,
      newlyVulnerablePackages,
      resolved,
      severityChanged,
      preExisting,
    },
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: node scripts/compare-audit-advisories.js <pre-audit.json> <post-audit.json> [--json] [--out-json <path>]");
    process.exit(1);
  }

  const prePath = path.resolve(args[0]);
  const postPath = path.resolve(args[1]);
  const asJson = args.includes("--json");
  const outJsonIdx = args.indexOf("--out-json");
  const outJsonPath = outJsonIdx !== -1 && args[outJsonIdx + 1] ? path.resolve(args[outJsonIdx + 1]) : null;

  if (!fs.existsSync(prePath)) {
    console.error(`Pre-audit file not found: ${prePath}`);
    process.exit(2);
  }
  if (!fs.existsSync(postPath)) {
    console.error(`Post-audit file not found: ${postPath}`);
    process.exit(2);
  }

  let preRaw, postRaw;
  try {
    preRaw = fs.readFileSync(prePath, "utf8");
    postRaw = fs.readFileSync(postPath, "utf8");
  } catch (err) {
    console.error(`I/O error reading audit files: ${err.message}`);
    process.exit(2);
  }

  const result = compareAudits(preRaw, postRaw);

  if (outJsonPath) {
    try {
      fs.writeFileSync(outJsonPath, JSON.stringify(result, null, 2), "utf8");
    } catch (err) {
      console.error(`Failed to write output JSON to ${outJsonPath}: ${err.message}`);
    }
  }

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("=================================================");
    console.log("=== VULNERABILITY ADVISORY DIFFERENTIAL REPORT ===");
    console.log("=================================================");
    console.log(`Decision: ${result.decision} (Status: ${result.status})`);
    if (result.blockingReasons && result.blockingReasons.length > 0) {
      console.log(`Blocking Reasons: ${result.blockingReasons.join("; ")}`);
    }
    if (result.reason) {
      console.log(`Reason: ${result.reason}`);
    }
    if (result.metrics) {
      console.log(`Pre Total:                  ${result.metrics.preTotal}`);
      console.log(`Post Total:                 ${result.metrics.postTotal}`);
      console.log(`Newly Introduced Advisories: ${result.metrics.newlyIntroducedCount} (Must be 0)`);
      console.log(`Newly Vulnerable Packages:  ${result.metrics.newlyVulnerablePackagesCount} (Must be 0)`);
      console.log(`Resolved Advisories:        ${result.metrics.resolvedCount}`);
      console.log(`Severity Changed:           ${result.metrics.severityChangedCount}`);
      console.log(`Pre-existing Advisories:    ${result.metrics.preExistingCount}`);
    }
    if (result.details?.newlyIntroduced?.length > 0) {
      console.log("\n--- NEWLY INTRODUCED ADVISORIES (BLOCKERS) ---");
      for (const adv of result.details.newlyIntroduced) {
        console.log(`  - [${adv.severity.toUpperCase()}] ${adv.package}: ${adv.title} (${adv.advisoryId})`);
      }
    }
    if (result.details?.resolved?.length > 0) {
      console.log("\n--- RESOLVED ADVISORIES ---");
      for (const adv of result.details.resolved) {
        console.log(`  + [${adv.severity.toUpperCase()}] ${adv.package}: ${adv.title}`);
      }
    }
    console.log("=================================================");
  }

  // Unequivocal exit codes: 0 = PASSED, 1 = BLOCKED (regression), 2 = INDETERMINATE (audit unavailable/corrupt)
  if (result.decision === "PASSED") {
    process.exit(0);
  } else if (result.status === "INDETERMINATE") {
    process.exit(2);
  } else {
    process.exit(1);
  }
}

module.exports = {
  normalizeAdvisoryId,
  normalizeSeverity,
  parseAuditReport,
  compareAudits,
};
