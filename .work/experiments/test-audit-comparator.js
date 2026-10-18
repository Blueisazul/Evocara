/**
 * Test Suite for Vulnerability Advisory Differential Comparator (P0.9 Hardened)
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const { compareAudits, normalizeAdvisoryId, normalizeSeverity, parseAuditReport } = require('../../scripts/compare-audit-advisories.js');

console.log('=== TEST SUITE: VULNERABILITY ADVISORY COMPARATOR (P0.9) ===\n');

// Test 1: Both clean
{
  const pre = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } };
  const post = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } };
  const res = compareAudits(pre, post);
  assert.strictEqual(res.decision, 'PASSED');
  assert.strictEqual(res.status, 'CONFORME');
  assert.strictEqual(res.metrics.newlyIntroducedCount, 0);
  console.log('[PASS] Test 1: Clean pre and post reports pass');
}

// Test 2: Net decrease but new critical vulnerability introduced
{
  const pre = {
    vulnerabilities: {
      'pkg-a': { name: 'pkg-a', severity: 'low', via: [{ url: 'GHSA-1111-2222-3333', severity: 'low' }] },
      'pkg-b': { name: 'pkg-b', severity: 'low', via: [{ url: 'GHSA-4444-5555-6666', severity: 'low' }] },
    }
  };
  const post = {
    vulnerabilities: {
      'pkg-a': { name: 'pkg-a', severity: 'low', via: [{ url: 'GHSA-1111-2222-3333', severity: 'low' }] },
      'malicious-pkg': { name: 'malicious-pkg', severity: 'critical', via: [{ url: 'https://github.com/advisories/GHSA-9999-8888-7777', severity: 'critical', title: 'RCE' }] },
    }
  };
  const res = compareAudits(pre, post);
  assert.strictEqual(res.decision, 'BLOCKED');
  assert.strictEqual(res.status, 'REGRESSION_DETECTED');
  assert.strictEqual(res.metrics.newlyIntroducedCount, 1);
  assert.strictEqual(res.details.newlyIntroduced[0].advisoryId, 'GHSA-9999-8888-7777');
  console.log('[PASS] Test 2: Net decrease with new critical vulnerability successfully BLOCKED');
}

// Test 3: Existing vulnerability worsened in severity (moderate -> critical)
{
  const pre = {
    vulnerabilities: {
      'dep-x': { name: 'dep-x', severity: 'moderate', via: [{ url: 'GHSA-XXXX-YYYY-ZZZZ', severity: 'moderate' }] }
    }
  };
  const post = {
    vulnerabilities: {
      'dep-x': { name: 'dep-x', severity: 'critical', via: [{ url: 'GHSA-XXXX-YYYY-ZZZZ', severity: 'critical' }] }
    }
  };
  const res = compareAudits(pre, post);
  assert.strictEqual(res.decision, 'BLOCKED');
  assert.strictEqual(res.status, 'SEVERITY_WORSENED');
  assert.strictEqual(res.metrics.severityChangedCount, 1);
  console.log('[PASS] Test 3: Severity worsening (moderate -> critical) successfully BLOCKED');
}

// Test 4: Offline / network error or invalid JSON
{
  const pre = { error: { code: 'ENOTFOUND', summary: 'Could not connect to registry' } };
  const post = { vulnerabilities: {} };
  const res = compareAudits(pre, post);
  assert.strictEqual(res.decision, 'BLOCKED');
  assert.strictEqual(res.status, 'INDETERMINATE');
  console.log('[PASS] Test 4: Network error report correctly categorized as INDETERMINATE & BLOCKED');
}

// Test 5: All vulnerabilities resolved
{
  const pre = {
    vulnerabilities: {
      'dep-old': { name: 'dep-old', severity: 'low', via: [{ url: 'GHSA-OLD1-OLD2-OLD3', severity: 'low' }] }
    }
  };
  const post = {
    vulnerabilities: {}
  };
  const res = compareAudits(pre, post);
  assert.strictEqual(res.decision, 'PASSED');
  assert.strictEqual(res.status, 'CONFORME');
  assert.strictEqual(res.metrics.resolvedCount, 1);
  assert.strictEqual(res.metrics.newlyIntroducedCount, 0);
  console.log('[PASS] Test 5: Clean resolution of vulnerabilities passes successfully');
}

// Test 6: Normalization: URL vs bare GHSA ID
{
  const idFromUrl = normalizeAdvisoryId('https://github.com/advisories/GHSA-abcd-ef01-2345');
  const idBare = normalizeAdvisoryId('GHSA-abcd-ef01-2345');
  assert.strictEqual(idFromUrl, 'GHSA-ABCD-EF01-2345');
  assert.strictEqual(idBare, 'GHSA-ABCD-EF01-2345');
  assert.strictEqual(idFromUrl, idBare);
  console.log('[PASS] Test 6: URL vs bare GHSA ID normalized identically');
}

// Test 7: Previously clean package becomes vulnerable (newly vulnerable package)
{
  const pre = {
    vulnerabilities: {
      'existing-vuln': { name: 'existing-vuln', severity: 'low', via: [{ url: 'GHSA-1234-1234-1234', severity: 'low' }] }
    }
  };
  const post = {
    vulnerabilities: {
      'existing-vuln': { name: 'existing-vuln', severity: 'low', via: [{ url: 'GHSA-1234-1234-1234', severity: 'low' }] },
      'new-clean-now-broken': { name: 'new-clean-now-broken', severity: 'low', via: [{ url: 'GHSA-5678-5678-5678', severity: 'low' }] }
    }
  };
  const res = compareAudits(pre, post);
  assert.strictEqual(res.decision, 'BLOCKED');
  assert.strictEqual(res.status, 'REGRESSION_DETECTED');
  assert(res.details.newlyVulnerablePackages.includes('new-clean-now-broken'));
  console.log('[PASS] Test 7: Newly vulnerable package correctly detected and BLOCKED');
}

// Test 8: Deduplication of duplicate via items
{
  const pre = { vulnerabilities: {} };
  const post = {
    vulnerabilities: {
      'pkg-dup': {
        name: 'pkg-dup',
        severity: 'high',
        via: [
          { url: 'GHSA-AAAA-BBBB-CCCC', severity: 'high' },
          { url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc', severity: 'high' } // duplicate URL variant
        ]
      }
    }
  };
  const res = compareAudits(pre, post);
  assert.strictEqual(res.metrics.newlyIntroducedCount, 1, 'Duplicate via entries must be deduplicated to 1');
  console.log('[PASS] Test 8: Duplicate via entries correctly deduplicated');
}

// Test 9 (P0.9): Truncated JSON string rejection
{
  const truncated = '{"vulnerabilities": {"pkg": {"severity": "high"';
  const clean = { vulnerabilities: {} };
  const res = compareAudits(truncated, clean);
  assert.strictEqual(res.decision, 'BLOCKED');
  assert.strictEqual(res.status, 'INDETERMINATE');
  assert(res.reason.includes('truncated') || res.reason.includes('Invalid'));
  console.log('[PASS] Test 9 (P0.9): Truncated JSON string detected and BLOCKED as INDETERMINATE');
}

// Test 10 (P0.9): Empty object without required schema rejection
{
  const emptyObj = {};
  const clean = { vulnerabilities: {} };
  const res = compareAudits(emptyObj, clean);
  assert.strictEqual(res.decision, 'BLOCKED');
  assert.strictEqual(res.status, 'INDETERMINATE');
  console.log('[PASS] Test 10 (P0.9): Empty object without schema detected and BLOCKED as INDETERMINATE');
}

// Test 11 (P0.9): Direct registry error payload (HTTP status / timeout / ECONNREFUSED)
{
  const regError = { code: 'ECONNREFUSED', message: 'connection refused by registry:443' };
  const clean = { vulnerabilities: {} };
  const res = compareAudits(clean, regError);
  assert.strictEqual(res.decision, 'BLOCKED');
  assert.strictEqual(res.status, 'INDETERMINATE');
  assert(res.reason.includes('ECONNREFUSED'));
  console.log('[PASS] Test 11 (P0.9): Registry connection error detected and BLOCKED as INDETERMINATE');
}

// Test 12 (P0.9): CLI exit code verification (0 for PASS, 1 for REGRESSION, 2 for INDETERMINATE)
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-cli-test-'));
  try {
    const cleanFile = path.join(tmpDir, 'clean.json');
    const regressionFile = path.join(tmpDir, 'regression.json');
    const corruptFile = path.join(tmpDir, 'corrupt.json');
    const outJsonFile = path.join(tmpDir, 'differential-report.json');

    fs.writeFileSync(cleanFile, JSON.stringify({ vulnerabilities: {} }));
    fs.writeFileSync(regressionFile, JSON.stringify({
      vulnerabilities: { 'bad-pkg': { severity: 'critical', via: [{ url: 'GHSA-XXXX-YYYY-ZZZZ', severity: 'critical' }] } }
    }));
    fs.writeFileSync(corruptFile, '{"broken": ');

    const scriptPath = path.resolve(__dirname, '..', '..', 'scripts', 'compare-audit-advisories.js');

    // Case 1: PASS -> Exit code 0
    let codePass = 0;
    try {
      execSync(`node "${scriptPath}" "${cleanFile}" "${cleanFile}" --out-json "${outJsonFile}"`, { stdio: 'pipe' });
    } catch (e) {
      codePass = e.status;
    }
    assert.strictEqual(codePass, 0, 'Clean comparison must exit with code 0');
    assert(fs.existsSync(outJsonFile), 'Report JSON must be written to disk when --out-json is provided');

    // Case 2: REGRESSION -> Exit code 1
    let codeRegression = 0;
    try {
      execSync(`node "${scriptPath}" "${cleanFile}" "${regressionFile}"`, { stdio: 'pipe' });
    } catch (e) {
      codeRegression = e.status;
    }
    assert.strictEqual(codeRegression, 1, 'Regression must exit with code 1');

    // Case 3: INDETERMINATE -> Exit code 2
    let codeIndeterminate = 0;
    try {
      execSync(`node "${scriptPath}" "${cleanFile}" "${corruptFile}"`, { stdio: 'pipe' });
    } catch (e) {
      codeIndeterminate = e.status;
    }
    assert.strictEqual(codeIndeterminate, 2, 'Corrupt/indeterminate audit must exit with code 2');

    console.log('[PASS] Test 12 (P0.9): CLI exit codes verified: 0 (PASSED), 1 (REGRESSION), 2 (INDETERMINATE)');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

console.log('\n=== ALL 12 AUDIT COMPARATOR TESTS PASSED! ===');
