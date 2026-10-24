#!/usr/bin/env node
/**
 * OpenMemory Promotion Engine CLI & API Forwarder
 *
 * Canonical forwarder to transactional-promotion-engine.js
 * Ensures backwards compatibility and unified entry point for G6 Promotion.
 */

const engine = require('./transactional-promotion-engine');

module.exports = engine;

if (require.main === module) {
  // When run directly as CLI, delegate execution to transactional-promotion-engine
  // by requiring it or running its CLI entry.
  // Note: transactional-promotion-engine checks `require.main === module`.
  // Since transactional-promotion-engine is imported as a module here,
  // we invoke its CLI logic directly if this forwarder was the entry point.
  const { TransactionalPromotionEngine } = engine;
  const fs = require('fs');
  const path = require('path');

  const args = process.argv.slice(2);
  const options = {};

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
OpenMemory Promotion Engine Forwarder (G6)

Usage:
  node scripts/promotion-engine.js [options]

Options:
  --consumer, --consumer-path <path>  Path to target consumer application (required)
  --tarball <path>                    Path to candidate .tgz archive
  --expected-sha256 <hash>            Expected SHA-256 hash of candidate tarball
  --expected-size <bytes>             Expected size in bytes of candidate tarball
  --expected-version <version>        Expected package version (default: 0.3.14-rc4)
  --original-version <version>        Original package version to rollback to (default: 0.3.1)
  --comparator <path>                 Path to differential npm audit comparator script
  --consumer-test <command>           Command to run for consumer acceptance validation
  --dry-run                           Simulate execution without modifying packages
  --help, -h                          Show this help message
`);
    process.exit(0);
  }

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--consumer-path' || args[i] === '--consumer') && args[i + 1]) options.consumerPath = args[++i];
    else if (args[i] === '--tarball' && args[i + 1]) options.tarballPath = args[++i];
    else if (args[i] === '--expected-sha256' && args[i + 1]) options.expectedSha256 = args[++i];
    else if (args[i] === '--expected-size' && args[i + 1]) {
      const parsed = parseInt(args[++i], 10);
      if (isNaN(parsed) || parsed <= 0) {
        console.error('Error: --expected-size must be a positive integer');
        process.exit(1);
      }
      options.expectedSize = parsed;
    }
    else if (args[i] === '--expected-version' && args[i + 1]) options.expectedVersion = args[++i];
    else if (args[i] === '--original-version' && args[i + 1]) options.originalVersion = args[++i];
    else if (args[i] === '--comparator' && args[i + 1]) options.comparatorScript = args[++i];
    else if (args[i] === '--consumer-test' && args[i + 1]) options.consumerTest = args[++i];
    else if (args[i] === '--dry-run') options.dryRun = true;
  }

  if (!options.consumerPath) {
    console.error('Error: --consumer-path (or --consumer) is required. Use --help for usage.');
    process.exit(1);
  }

  if (!fs.existsSync(options.consumerPath)) {
    console.error(`Error: Consumer directory not found: ${options.consumerPath}`);
    process.exit(1);
  }

  console.log('=== OPENMEMORY PROMOTION ENGINE (G6) ===');
  const promoEngine = new TransactionalPromotionEngine(options);
  const result = promoEngine.runPromotion();
  console.log('Result:', JSON.stringify(result, null, 2));
  process.exit(result.success ? 0 : 1);
}
