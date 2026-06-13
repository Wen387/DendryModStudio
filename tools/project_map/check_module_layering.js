#!/usr/bin/env node
'use strict';

// Guards two structural properties that keep the codebase navigable and that
// were, until this gate, healthy but UNENFORCED — nothing failed when logic
// reached up into the UI, or when a require() cycle formed:
//
//   1. Layer direction. First-party layers, lowest to highest, may only depend
//      DOWN or sideways:
//        authoring/  pure logic core   (rank 0)
//        viewer/     browser UI        (rank 1)
//        desktop/    Electron shell    (rank 2)
//      So authoring/ must not require viewer/ or desktop/, and viewer/ must not
//      require desktop/. Pre-existing upward edges are baselined in EXCEPTIONS
//      (keep that list SHRINKING); any NEW upward edge fails.
//   2. Acyclicity. No first-party require() cycle among the layered modules.
//
// Scope/limit: follows static, literal relative require() targets — the Node
// resolution path of the dual-environment `global.X || require('./x')` modules.
// Edges expressed ONLY through the browser global registry are not traced, but a
// new upward dependency added the normal way carries a require() and is caught.

const fs = require('fs');
const path = require('path');
const {assert} = require('./check_harness.js');

const PROJECT_MAP_DIR = __dirname;
const LAYER_DIRS = ['authoring', 'viewer', 'desktop'];
const LAYER_RANK = {authoring: 0, viewer: 1, desktop: 2};

// Accepted pre-existing cross-layer edges. Each is debt to retire, not a slot to
// fill — every entry should eventually be removed by relocating the dependency.
const EXCEPTIONS = [
  {
    from: 'authoring/object_authoring_canvas_model.js',
    to: 'viewer/card_board_perf.js',
    reason: 'Model lazily requires the viewer card-board perf helper. Candidate: relocate card_board_perf.js to a neutral shared layer, then drop this exception.',
    since: '2026-06-13'
  }
];

function listLayerJs(dir) {
  const abs = path.join(PROJECT_MAP_DIR, dir);
  if (!fs.existsSync(abs)) {
    return [];
  }
  return fs.readdirSync(abs)
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(abs, f))
    .filter((f) => fs.statSync(f).isFile());
}

function rel(abs) {
  return path.relative(PROJECT_MAP_DIR, abs).split(path.sep).join('/');
}

function resolveRel(fromDir, spec) {
  const base = path.resolve(fromDir, spec);
  for (const cand of [base, base + '.js', path.join(base, 'index.js')]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      return cand;
    }
  }
  return null;
}

function requireTargets(file) {
  const src = fs.readFileSync(file, 'utf8');
  const out = [];
  const re = /require\((['"])(\.\.?\/[^'"]+)\1\)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const target = resolveRel(path.dirname(file), m[2]);
    if (target) {
      out.push(target);
    }
  }
  return out;
}

function layerOf(relPath) {
  return LAYER_DIRS.find((d) => relPath.startsWith(d + '/')) || null;
}

function isException(fromRel, toRel) {
  return EXCEPTIONS.some((e) => e.from === fromRel && e.to === toRel);
}

function main() {
  const files = [];
  for (const d of LAYER_DIRS) {
    files.push(...listLayerJs(d));
  }
  const fileSet = new Set(files);

  // (1) Layer direction.
  const violations = [];
  const usedExceptions = new Set();
  for (const file of files) {
    const fromRel = rel(file);
    const fromLayer = layerOf(fromRel);
    if (!fromLayer) {
      continue;
    }
    for (const target of requireTargets(file)) {
      const toRel = rel(target);
      const toLayer = layerOf(toRel);
      if (!toLayer) {
        continue; // require into root/shared modules is unlayered and allowed
      }
      if (LAYER_RANK[toLayer] > LAYER_RANK[fromLayer]) {
        if (isException(fromRel, toRel)) {
          usedExceptions.add(fromRel + ' -> ' + toRel);
          continue;
        }
        violations.push({
          from: fromRel,
          to: toRel,
          reason: fromLayer + '/ must not depend upward on ' + toLayer + '/'
        });
      }
    }
  }

  // (2) Acyclicity over the layered require graph.
  const adj = new Map();
  for (const file of files) {
    adj.set(file, requireTargets(file).filter((t) => fileSet.has(t)));
  }
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map(files.map((f) => [f, WHITE]));
  const cycles = [];
  function dfs(u, stack) {
    color.set(u, GRAY);
    stack.push(u);
    for (const v of adj.get(u) || []) {
      if (color.get(v) === GRAY) {
        cycles.push(stack.slice(stack.indexOf(v)).concat(v).map(rel).join(' -> '));
      } else if (color.get(v) === WHITE) {
        dfs(v, stack);
      }
    }
    stack.pop();
    color.set(u, BLACK);
  }
  for (const f of files) {
    if (color.get(f) === WHITE) {
      dfs(f, []);
    }
  }

  // Stale exceptions (no longer matching a real edge) must be pruned, so the
  // baseline can only shrink.
  const staleExceptions = EXCEPTIONS
    .filter((e) => !usedExceptions.has(e.from + ' -> ' + e.to))
    .map((e) => e.from + ' -> ' + e.to);

  assert(violations.length === 0,
    'first-party layer direction violated: a lower layer requires upward '
    + '(authoring < viewer < desktop), eroding the pure-core / UI / shell separation',
    violations);
  assert(cycles.length === 0,
    'first-party require() cycle detected among layered modules',
    cycles);
  assert(staleExceptions.length === 0,
    'stale layering EXCEPTIONS no longer match a real edge — remove them from check_module_layering.js',
    staleExceptions);

  process.stdout.write(JSON.stringify({
    ok: true,
    layeredModules: files.length,
    exceptionsBaselined: EXCEPTIONS.length,
    cyclesFound: cycles.length
  }, null, 2) + '\n');
}

main();
