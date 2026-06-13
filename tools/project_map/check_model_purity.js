#!/usr/bin/env node
'use strict';

// Guards the purity of the authoring/ model layer — the keystone that makes the
// dense Node-side check suite affordable. Each authoring/*model.js is require()d
// directly by checks and must compute over plain data only: NO filesystem,
// process, network, or DOM capability in its own source. I/O is either injected
// through a `context` object (e.g. context.fs in install_plan) or lives in the
// desktop shell. Until this gate, a stray require('fs') or document.* in a model
// would silently make it un-loadable in a plain Node check without mocking the
// world — quietly dissolving the property the whole test suite leans on.
//
// Allowed: pure helpers like `path` (string math, no I/O) and the injected
// `context.fs` / `context.path` dependency pattern (a property access, not a
// bare global). Forbidden: direct require() of a Node I/O builtin, and bare
// DOM/network globals (document./window./fetch(/...).

const fs = require('fs');
const path = require('path');
const {assert} = require('./check_harness.js');

const MODELS_DIR = path.join(__dirname, 'authoring');

const FORBIDDEN_BUILTINS = new Set([
  'fs', 'fs/promises', 'child_process', 'net', 'http', 'https', 'http2',
  'dns', 'tls', 'dgram', 'cluster', 'worker_threads', 'readline', 'electron'
]);

// Bare DOM/network globals. The negative lookbehind `(?<![.\w])` excludes
// property access like `context.window` / `ctx.document`, so the injected
// pattern is not falsely flagged; the trailing `.` / `(` anchors to real use.
const FORBIDDEN_GLOBALS = [
  {re: /(?<![.\w])document\./, name: 'document (DOM)'},
  {re: /(?<![.\w])window\./, name: 'window (DOM)'},
  {re: /(?<![.\w])localStorage\b/, name: 'localStorage (DOM)'},
  {re: /(?<![.\w])sessionStorage\b/, name: 'sessionStorage (DOM)'},
  {re: /(?<![.\w])fetch\s*\(/, name: 'fetch (network)'},
  {re: /(?<![.\w])XMLHttpRequest\b/, name: 'XMLHttpRequest (network)'}
];

// Strip comments so a forbidden token mentioned in a comment is not flagged.
// (Over-stripping a `//` inside a string can only hide a real use, never invent
// one — the safe direction for a zero-false-positive gate.)
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function modelFiles() {
  if (!fs.existsSync(MODELS_DIR)) {
    return [];
  }
  return fs.readdirSync(MODELS_DIR)
    .filter((f) => /model\.js$/.test(f))
    .map((f) => path.join(MODELS_DIR, f))
    .filter((f) => fs.statSync(f).isFile());
}

function main() {
  const files = modelFiles();
  assert(files.length > 0, 'expected authoring/*model.js files to scan; found none');

  const violations = [];
  for (const file of files) {
    const base = 'authoring/' + path.basename(file);
    const src = stripComments(fs.readFileSync(file, 'utf8'));

    const reqRe = /require\(\s*(['"])([^'"]+)\1\s*\)/g;
    let m;
    while ((m = reqRe.exec(src)) !== null) {
      if (FORBIDDEN_BUILTINS.has(m[2])) {
        violations.push({
          file: base,
          kind: "require('" + m[2] + "')",
          detail: 'model must not import the I/O builtin ' + m[2]
        });
      }
    }
    for (const g of FORBIDDEN_GLOBALS) {
      if (g.re.test(src)) {
        violations.push({file: base, kind: g.name, detail: 'model must not touch ' + g.name});
      }
    }
  }

  assert(violations.length === 0,
    'authoring/*model.js purity violated: a model reaches a filesystem/process/network/DOM '
    + 'capability directly. Inject it via the context object or move the logic to the desktop shell',
    violations);

  process.stdout.write(JSON.stringify({
    ok: true,
    modelsScanned: files.length
  }, null, 2) + '\n');
}

main();
