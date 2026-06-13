#!/usr/bin/env node
'use strict';

// Zero-dependency generic-hygiene ratchet for first-party JavaScript, in the
// same spirit as check_css_hardcoded_colors.js. This project deliberately uses
// bespoke checks instead of an ESLint/Prettier toolchain, so this guards the two
// lint sediments that otherwise accrue unnoticed in hand-written code:
//
//   - `var` declarations (should be `let`/`const`).
//   - Loose equality `==` / `!=` (should be `===` / `!==`). The deliberate
//     `== null` / `!= null` (and undefined) idiom is excluded from the count, so
//     only genuinely suspect loose comparisons are tracked.
//
// It is a BASELINE RATCHET: current counts are grandfathered in
// source_hygiene_baseline.json and the check fails only when a file gains NEW
// occurrences. Clean a file up and re-run with --update-baseline to ratchet the
// number down — it can only fall. New files must start clean (baseline 0).
//
// Scope: hand-written first-party .js under viewer/ (excluding the i18n string
// catalogs), authoring/, desktop/, and the root-level tools (checks included).
// Sample/fixture/template/profile trees are not hand-maintained product code and
// are skipped. Comments are stripped before counting; string-literal noise is
// rare here and is absorbed by the baseline.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const BASELINE_FILE = path.join(ROOT, 'source_hygiene_baseline.json');

const SKIP_SEGMENTS = new Set([
  'i18n', 'node_modules', '__pycache__', 'fixtures', 'qa', 'templates',
  'profiles', 'assets', 'styles'
]);

function walkJs(dir, out) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_SEGMENTS.has(name)) {
      continue;
    }
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      walkJs(full, out);
    } else if (name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function collectFiles() {
  const out = [];
  // Recurse the three layered subsystems.
  for (const d of ['viewer', 'authoring', 'desktop']) {
    walkJs(path.join(ROOT, d), out);
  }
  // Root-level *.js only (do not re-walk subdirectories already handled / skipped).
  for (const name of fs.readdirSync(ROOT)) {
    if (name.endsWith('.js')) {
      out.push(path.join(ROOT, name));
    }
  }
  return out.sort();
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function countHygiene(src) {
  const text = stripComments(src);
  const varCount = (text.match(/(?<![.\w])var\s+(?=[A-Za-z_$[{])/g) || []).length;
  const looseAll = (text.match(/(?<![=!<>])(?:==|!=)(?!=)/g) || []).length;
  const idiom = (text.match(/(?<![=!<>])(?:==|!=)(?!=)\s*(?:null|undefined)\b/g) || []).length;
  return {var: varCount, looseEq: looseAll - idiom};
}

function scan() {
  const counts = {};
  for (const file of collectFiles()) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const c = countHygiene(fs.readFileSync(file, 'utf8'));
    if (c.var > 0 || c.looseEq > 0) {
      counts[rel] = c;
    }
  }
  return counts;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
}

function writeBaseline(counts) {
  const payload = {
    note: 'Baseline ratchet for var / loose-equality in first-party JS. Fail only on NEW additions; clean up and re-run with --update-baseline to tighten. Counts may only fall.',
    counts
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + '\n');
}

function allowedFor(baseline, rel) {
  if (Object.prototype.hasOwnProperty.call(baseline.counts, rel)) {
    return baseline.counts[rel];
  }
  return {var: 0, looseEq: 0};
}

function main() {
  const update = process.argv.includes('--update-baseline');
  const counts = scan();

  if (update) {
    writeBaseline(counts);
    process.stdout.write('Updated source hygiene baseline.\n');
    process.stdout.write(JSON.stringify({ok: true, updated: true, files: Object.keys(counts).length}, null, 2) + '\n');
    return;
  }

  const baseline = loadBaseline();
  if (!baseline || !baseline.counts) {
    process.stderr.write('FAIL: missing source_hygiene_baseline.json. Run with --update-baseline to seed it.\n');
    process.exit(1);
  }

  const violations = [];
  const improvements = [];
  for (const rel of Object.keys(counts)) {
    const current = counts[rel];
    const allowed = allowedFor(baseline, rel);
    if (current.var > allowed.var) {
      violations.push({file: rel, metric: 'var', baseline: allowed.var, current: current.var, hint: 'use let/const'});
    }
    if (current.looseEq > allowed.looseEq) {
      violations.push({file: rel, metric: 'looseEq', baseline: allowed.looseEq, current: current.looseEq, hint: 'use === / !== (== null is exempt)'});
    }
    if (current.var < allowed.var || current.looseEq < allowed.looseEq) {
      improvements.push(rel);
    }
  }

  if (violations.length) {
    process.stderr.write('FAIL: new var / loose-equality added to first-party JS (baseline ratchet).\n');
    for (const v of violations) {
      process.stderr.write(
        '  ' + v.file + ': ' + v.metric + ' ' + v.current + ' > baseline ' + v.baseline + ' — ' + v.hint + '\n');
    }
    process.stderr.write('Fix the new occurrence, or re-baseline a genuine drop with --update-baseline.\n');
    process.exit(1);
  }

  for (const rel of improvements) {
    process.stdout.write('note: ' + rel + ' improved below baseline — run --update-baseline to ratchet down.\n');
  }

  const totals = Object.values(counts).reduce(
    (acc, c) => ({var: acc.var + c.var, looseEq: acc.looseEq + c.looseEq}),
    {var: 0, looseEq: 0});
  process.stdout.write(JSON.stringify({
    ok: true,
    filesWithFindings: Object.keys(counts).length,
    totalVar: totals.var,
    totalLooseEq: totals.looseEq
  }, null, 2) + '\n');
}

main();
