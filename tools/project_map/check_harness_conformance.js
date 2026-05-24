#!/usr/bin/env node
// @ts-check
'use strict';

const fs = require('fs');
const path = require('path');
const {failJson, assert} = require('./check_harness.js');

const PROJECT_MAP_DIR = __dirname;

/**
 * Check files explicitly exempt from the shared harness.
 *
 * Each entry must justify its exception in a way that survives review:
 * - **harness**: defines the API the rest of the suite imports
 * - **helper**: re-usable utility, never asserts on its own
 * - **node-assert**: uses Node's built-in `require('assert')` with
 *   `strictEqual` / `deepEqual` / etc. — different API surface
 * - **direct-exit**: short scripts that print to stderr and call
 *   `process.exit(1)` inline; no shared assert needed
 */
const EXEMPT_FILES = new Set([
  // harness
  'check_harness.js',
  // helper
  'check_python_command.js',
  'check_viewer_assets.js',
  // node-assert
  'check_desktop_capabilities_model.js',
  'check_event_source_unit_model.js',
  'check_event_workbench_model.js',
  'check_sidebar_status_model.js',
  'check_workspace_layout_model.js',
  // direct-exit
  'check_governance_parity.js',
  'check_project_map_fixture.js',
  'check_source_complexity.js'
]);

const FAIL_DEFINITION = /^function fail\(/m;
const ASSERT_DEFINITION = /^function assert\(/m;

function main() {
  const files = fs.readdirSync(PROJECT_MAP_DIR)
    .filter((f) => /^check_.+\.js$/.test(f))
    .sort();

  const inlineDefinitions = [];
  const staleExemptions = [];

  for (const file of files) {
    if (EXEMPT_FILES.has(file)) {
      continue;
    }
    const content = fs.readFileSync(path.join(PROJECT_MAP_DIR, file), 'utf8');
    const hasFail = FAIL_DEFINITION.test(content);
    const hasAssert = ASSERT_DEFINITION.test(content);
    if (hasFail || hasAssert) {
      inlineDefinitions.push({
        file,
        definesFail: hasFail,
        definesAssert: hasAssert
      });
    }
  }

  // Detect exempted files that no longer exist (stale entries) and exempted
  // files that have since adopted the harness (entries that could be removed).
  for (const exempt of EXEMPT_FILES) {
    const full = path.join(PROJECT_MAP_DIR, exempt);
    if (!fs.existsSync(full)) {
      staleExemptions.push({file: exempt, reason: 'file does not exist'});
      continue;
    }
    const content = fs.readFileSync(full, 'utf8');
    if (exempt === 'check_harness.js') continue;
    if (content.includes("require('./check_harness.js')")) {
      staleExemptions.push({file: exempt, reason: 'now uses harness; remove from exempt list'});
    }
  }

  assert(inlineDefinitions.length === 0,
    'Check files must use fail/assert from check_harness.js instead of defining them inline.',
    {
      offenders: inlineDefinitions,
      hint: 'Replace inline `function fail(...)` / `function assert(...)` with `const {fail, assert} = require(\'./check_harness.js\');` (or `failJson` / `assertJson` for JSON-only output).'
    });

  assert(staleExemptions.length === 0,
    'EXEMPT_FILES in check_harness_conformance.js contains stale entries.',
    {staleExemptions});

  const enforced = files.length - EXEMPT_FILES.size;
  process.stdout.write(JSON.stringify({
    ok: true,
    totalCheckFiles: files.length,
    exemptCount: EXEMPT_FILES.size,
    enforcedCount: enforced
  }, null, 2) + '\n');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    failJson('check_harness_conformance crashed', {error: err && err.message});
  }
} else {
  module.exports = {main, EXEMPT_FILES};
}
