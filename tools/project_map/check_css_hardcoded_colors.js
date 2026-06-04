#!/usr/bin/env node
'use strict';

// Maintenance guard for the theming effort. Raw color literals (hex / rgb / rgba)
// that live outside the palette definition do not adapt to light/dark, so each
// one is a future dual-theme liability. This check is a baseline ratchet: it
// grandfathers the colors that already exist (recorded in
// css_hardcoded_color_baseline.json) and fails only when a file gains NEW raw
// colors. The single sanctioned home for raw colors is the palette block in
// base.css (:root and :root[data-theme="dark"]), which is stripped before
// counting. Lower a file's count and re-run with --update-baseline to ratchet.

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const STYLES_DIR = path.join(ROOT, 'viewer', 'styles');
const BASELINE_FILE = path.join(ROOT, 'css_hardcoded_color_baseline.json');

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const RGB = /\brgba?\(/gi;

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

// The palette lives in base.css's :root blocks; those are the only place raw
// colors are allowed, so remove them before counting. The blocks contain no
// nested braces, so a non-greedy brace match is safe.
function stripPaletteBlocks(css) {
  return css.replace(/:root(\[data-theme="[^"]*"\])?\s*\{[^}]*\}/g, '');
}

function countColors(css, isBaseCss) {
  let text = stripComments(css);
  if (isBaseCss) {
    text = stripPaletteBlocks(text);
  }
  const hex = text.match(HEX) || [];
  const rgb = text.match(RGB) || [];
  return hex.length + rgb.length;
}

function scan() {
  const counts = {};
  fs.readdirSync(STYLES_DIR)
    .filter((name) => name.endsWith('.css'))
    .sort()
    .forEach((name) => {
      const css = fs.readFileSync(path.join(STYLES_DIR, name), 'utf8');
      counts[name] = countColors(css, name === 'base.css');
    });
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
    note: 'Baseline ratchet for raw CSS color literals. Fail only on NEW additions; lower counts and re-run with --update-baseline to tighten.',
    counts
  };
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2) + '\n');
}

function main() {
  const update = process.argv.includes('--update-baseline');
  const counts = scan();

  if (update) {
    writeBaseline(counts);
    process.stdout.write('Updated CSS hardcoded-color baseline.\n');
    process.stdout.write(JSON.stringify({ok: true, updated: true, files: Object.keys(counts).length}, null, 2) + '\n');
    return;
  }

  const baseline = loadBaseline();
  if (!baseline || !baseline.counts) {
    process.stderr.write('FAIL: missing css_hardcoded_color_baseline.json. Run with --update-baseline to seed it.\n');
    process.exit(1);
  }

  const violations = [];
  const suggestions = [];
  Object.keys(counts).forEach((name) => {
    const current = counts[name];
    const allowed = Object.prototype.hasOwnProperty.call(baseline.counts, name)
      ? baseline.counts[name]
      : 0;
    if (current > allowed) {
      violations.push({file: name, baseline: allowed, current});
    } else if (current < allowed) {
      suggestions.push({file: name, baseline: allowed, current});
    }
  });

  if (violations.length) {
    process.stderr.write('FAIL: new raw CSS color literals added outside the palette.\n');
    violations.forEach((v) => {
      process.stderr.write(
        '  ' + v.file + ': ' + v.current + ' raw colors (baseline ' + v.baseline + '). '
        + 'Use a semantic var (add a token to base.css light + dark) instead of a raw hex/rgb.\n');
    });
    process.exit(1);
  }

  suggestions.forEach((s) => {
    process.stdout.write(
      'note: ' + s.file + ' dropped to ' + s.current + ' raw colors (baseline ' + s.baseline
      + '). Run check_css_hardcoded_colors.js --update-baseline to ratchet down.\n');
  });

  const total = Object.keys(counts).reduce((sum, name) => sum + counts[name], 0);
  process.stdout.write(JSON.stringify({ok: true, files: Object.keys(counts).length, totalRawColors: total}, null, 2) + '\n');
}

main();
