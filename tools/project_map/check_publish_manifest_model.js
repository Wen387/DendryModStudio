#!/usr/bin/env node
'use strict';

// Public CI coverage for the Publish-to-GitHub manifest logic
// (desktop/publish/manifest.js): which files a publish uploads, the housekeeping
// it generates, and the repo-name normalization that keeps create/lookup in
// sync. Pure module — no fs / git / electron — so it runs in the plain check:ci
// gate. The git_ops / github_api layers need isomorphic-git / network mocks and
// stay covered by the desktop-side spike harness.

const manifest = require('./desktop/publish/manifest.js');
const {assert} = require('./check_harness.js');

let n = 0;
function check(cond, message) { assert(cond, message); n += 1; }

// --- isIgnored: segment-name ignores ---
check(manifest.isIgnored('node_modules/x.js'), 'node_modules is ignored');
check(manifest.isIgnored('a/.git/config'), '.git anywhere in the path is ignored');
check(manifest.isIgnored('.studio-local/note.md'), '.studio-local is ignored');
check(!manifest.isIgnored('scene/start.dry'), 'normal content is not ignored');

// --- isIgnored: .github/workflows path rule (PAT workflow-scope avoidance) ---
check(manifest.isIgnored('.github/workflows/build.yaml'), '.github/workflows file is ignored');
check(manifest.isIgnored('.github/workflows'), 'the .github/workflows dir itself is ignored');
check(!manifest.isIgnored('.github/FUNDING.yml'), 'other .github files are kept');
check(!manifest.isIgnored('workflows/start.dry'), 'a top-level workflows/ folder is NOT treated as CI');

// --- buildManifest ---
const m = manifest.buildManifest([
  {path: 'info.dry', bytes: 100},
  {path: 'scene/start.dry', bytes: 50},
  {path: 'node_modules/junk.js', bytes: 10},
  {path: '.github/workflows/ci.yaml', bytes: 20}
]);
check(m.included.length === 2, 'buildManifest includes only the two content files');
check(m.excluded.length === 2, 'buildManifest excludes node_modules + workflow');
check(m.totalBytes === 150, 'totalBytes sums included bytes only');
check(m.included[0].path === 'info.dry', 'included entries are sorted by path');

const big = manifest.buildManifest([{path: 'art.png', bytes: manifest.LARGE_FILE_WARN_BYTES}]);
check(big.warnings.some((w) => w.code === 'large_file'), 'a file at the large-file threshold warns');

const empty = manifest.buildManifest([null, {path: '', bytes: 5}, {bytes: 5}]);
check(empty.included.length === 0, 'entries without a path are skipped');

// --- normalizeRepoName: identical for create and lookup so retries match ---
check(manifest.normalizeRepoName('Demo Mod') === 'Demo-Mod', 'spaces become dashes');
check(manifest.normalizeRepoName('  Spaced  ') === 'Spaced', 'edges are trimmed');
check(manifest.normalizeRepoName('a/b\\c') === 'a-b-c', 'slashes become dashes');
check(manifest.normalizeRepoName('a   b') === 'a-b', 'runs collapse to a single dash');
check(manifest.normalizeRepoName('--weird--') === 'weird', 'leading/trailing dashes are stripped');
check(manifest.normalizeRepoName('keep_me.v2-ok') === 'keep_me.v2-ok', 'legal characters are preserved');
check(manifest.normalizeRepoName('') === 'mod', 'empty name falls back to "mod"');
check(manifest.normalizeRepoName('???') === 'mod', 'all-illegal name falls back to "mod"');
check(manifest.normalizeRepoName(null) === 'mod', 'null name falls back to "mod"');

// --- housekeeping contents ---
const gi = manifest.gitignoreContents();
check(/node_modules\//.test(gi), '.gitignore lists node_modules/');
check(/\.studio-local\//.test(gi), '.gitignore lists .studio-local/');
const ga = manifest.gitattributesContents();
check(/text=auto/.test(ga), '.gitattributes sets text=auto for cross-platform diffs');

// --- noreplyEmail ---
check(manifest.noreplyEmail({login: 'awen', id: 42}) === '42+awen@users.noreply.github.com', 'noreply email uses id+login');
check(manifest.noreplyEmail(null) === '0+user@users.noreply.github.com', 'noreply email has safe defaults');

console.log('PASS: publish manifest model (' + n + ' assertions)');
