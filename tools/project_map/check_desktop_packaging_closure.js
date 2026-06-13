#!/usr/bin/env node
'use strict';

// Guards the desktop launch-crash class that shipped in v0.98.5-preview.1:
// a main-process module the runtime require()s — directly, or via the
// dev/packaged candidate-path helper — that electron-builder's build.files
// forgot to include, so the packaged app dies on launch with
// "Cannot find module". (That release omitted object_playtest_host.js and
// object_playtest_engine_model.js.)
//
// The check enumerates the source files build.files would actually ship, then
// asserts that (1) every top-level desktop/*.js main-process module and
// (2) every project_map-level module the desktop code loads via a literal
// `require('../x')` or a `requireProjectMapModule('a','b')` candidate helper is
// in that shipped set.
//
// Scope/limits: it follows static, literal references only. Dynamic requires
// built from runtime variables (e.g. runtime_lens.js's path.join(..., fileName))
// are not traced — but those targets live under the fully-mapped
// project_map/authoring tree, which ships wholesale, so they are not a gap.

const fs = require('fs');
const path = require('path');
const {assert} = require('./check_harness.js');

const PROJECT_MAP_DIR = __dirname;
const DESKTOP_DIR = path.join(PROJECT_MAP_DIR, 'desktop');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function walkFiles(dir, out) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      walkFiles(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

// Minimal glob -> RegExp for the filter shapes electron-builder uses here:
// "**/*", "**/*.pyc", "!**/foo/**", and exact names like "parse_dry_project.js".
function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if ('.+?^${}()|[]\\/'.includes(c)) {
      re += '\\' + c;
    } else {
      re += c;
    }
  }
  return new RegExp('^' + re + '$');
}

// Does posix `rel` (relative to an object entry's `from`) survive `filter`?
function matchesFilter(rel, filter) {
  if (!filter || !filter.length) {
    return true;
  }
  const positives = filter.filter((p) => typeof p === 'string' && !p.startsWith('!'));
  let included = positives.length === 0; // negation-only filters default-include
  for (const pat of filter) {
    if (typeof pat !== 'string') {
      continue;
    }
    if (pat.startsWith('!')) {
      if (globToRegExp(pat.slice(1)).test(rel)) {
        included = false;
      }
    } else if (globToRegExp(pat).test(rel)) {
      included = true;
    }
  }
  return included;
}

// Enumerate the set of source files (absolute paths) build.files would ship.
function computeIncludedFiles(buildFiles) {
  const included = new Set();
  for (const entry of buildFiles) {
    if (typeof entry === 'string') {
      const globIdx = entry.indexOf('*');
      if (globIdx === -1) {
        const abs = path.resolve(DESKTOP_DIR, entry);
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
          included.add(abs);
        }
      } else {
        const base = path.resolve(DESKTOP_DIR, entry.slice(0, globIdx));
        for (const f of walkFiles(base, [])) {
          included.add(f);
        }
      }
    } else if (entry && typeof entry === 'object' && entry.from) {
      // Bundled third-party deps are out of scope for the source closure.
      if (typeof entry.to === 'string' && entry.to.startsWith('node_modules')) {
        continue;
      }
      const base = path.resolve(DESKTOP_DIR, entry.from);
      const filter = entry.filter || ['**/*'];
      const hasGlob = filter.some((p) => typeof p === 'string' && !p.startsWith('!') && p.includes('*'));
      if (hasGlob) {
        for (const f of walkFiles(base, [])) {
          const rel = path.relative(base, f).split(path.sep).join('/');
          if (matchesFilter(rel, filter)) {
            included.add(f);
          }
        }
      } else {
        for (const pat of filter) {
          if (typeof pat !== 'string' || pat.startsWith('!')) {
            continue;
          }
          const abs = path.resolve(base, pat);
          if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
            included.add(abs);
          }
        }
      }
    }
  }
  return included;
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

function main() {
  const pkg = JSON.parse(read(path.join(DESKTOP_DIR, 'package.json')));
  const buildFiles = (pkg.build && pkg.build.files) || [];
  assert(Array.isArray(buildFiles) && buildFiles.length > 0,
    'desktop package.json build.files must be a non-empty array');

  const included = computeIncludedFiles(buildFiles);
  const desktopJs = fs.readdirSync(DESKTOP_DIR)
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(DESKTOP_DIR, f))
    .filter((f) => fs.statSync(f).isFile());

  const missing = [];

  // (1) Every top-level desktop/*.js ships at the asar root and must be included.
  for (const abs of desktopJs) {
    if (!included.has(abs)) {
      missing.push({
        file: 'desktop/' + path.basename(abs),
        reason: 'top-level desktop main-process module not included by build.files'
      });
    }
  }

  // (2) project_map-level modules loaded by desktop code (literal ../ requires
  //     and requireProjectMapModule('a','b') candidate-helper calls).
  for (const file of desktopJs) {
    const src = read(file);
    const here = path.basename(file);

    const reqRe = /require\((['"])(\.\.?\/[^'"]+)\1\)/g;
    let m;
    while ((m = reqRe.exec(src)) !== null) {
      const target = resolveRel(path.dirname(file), m[2]);
      if (target
        && target.startsWith(PROJECT_MAP_DIR + path.sep)
        && !target.startsWith(DESKTOP_DIR + path.sep)
        && !included.has(target)) {
        missing.push({
          file: path.relative(PROJECT_MAP_DIR, target),
          reason: 'project_map module require()d by ' + here + ' not included by build.files'
        });
      }
    }

    const helperRe = /requireProjectMapModule\(\s*([^)]*)\)/g;
    while ((m = helperRe.exec(src)) !== null) {
      const parts = [...m[1].matchAll(/(['"])([^'"]+)\1/g)].map((x) => x[2]);
      if (parts.length === 0) {
        continue;
      }
      const target = resolveRel(PROJECT_MAP_DIR, parts.join('/'));
      if (target && !included.has(target)) {
        missing.push({
          file: path.relative(PROJECT_MAP_DIR, target),
          reason: 'project_map module loaded via requireProjectMapModule in ' + here + ' not included by build.files'
        });
      }
    }
  }

  assert(missing.length === 0,
    'desktop main-process modules are missing from electron-builder build.files; '
    + 'the packaged app would crash on launch with "Cannot find module"',
    missing);

  process.stdout.write(JSON.stringify({
    ok: true,
    shippedSourceFiles: included.size,
    desktopModulesChecked: desktopJs.length
  }, null, 2) + '\n');
}

main();
