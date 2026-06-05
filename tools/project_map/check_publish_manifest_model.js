#!/usr/bin/env node
'use strict';

// Public CI coverage for the Publish-to-GitHub pure logic: the manifest layer
// (desktop/publish/manifest.js) — which files a publish uploads, the
// housekeeping it generates, and the repo-name normalization that keeps
// create/lookup in sync — and the update/sync decision layer
// (desktop/publish/sync_state.js) — which action the panel offers given the
// observed git/network facts. Both are pure modules (no fs / git / electron),
// so they run in the plain check:ci gate. The git_ops / github_api layers need
// isomorphic-git / network mocks and stay covered by the desktop-side spike
// harness.

const manifest = require('./desktop/publish/manifest.js');
const syncState = require('./desktop/publish/sync_state.js');
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

// --- sync_state.classify: which action the panel offers ---
const S = syncState.SYNC_STATES;
check(syncState.classify({hasGit: false, hasOrigin: false}) === S.FIRST_PUBLISH, 'no git -> first publish');
check(syncState.classify({hasGit: true, hasOrigin: false}) === S.FIRST_PUBLISH, 'git but no origin -> first publish');
check(syncState.classify({hasGit: true, hasOrigin: true, offline: true}) === S.OFFLINE, 'origin but unreachable -> offline');
check(syncState.classify({hasGit: true, hasOrigin: true, ahead: 0, behind: 0}) === S.IN_SYNC, 'same commit -> in sync');
check(syncState.classify({hasGit: true, hasOrigin: true, ahead: 2, behind: 0}) === S.LOCAL_AHEAD, 'local ahead -> local_ahead');
check(syncState.classify({hasGit: true, hasOrigin: true, ahead: 0, behind: 3}) === S.REMOTE_AHEAD, 'remote ahead -> remote_ahead');
check(syncState.classify({hasGit: true, hasOrigin: true, ahead: 1, behind: 1}) === S.DIVERGED, 'both moved -> diverged');
check(syncState.classify({hasGit: true, hasOrigin: true, offline: true, ahead: 5, behind: 5}) === S.OFFLINE, 'offline wins over stale counts');

// --- sync_state action predicates ---
check(syncState.canUpdate(S.LOCAL_AHEAD, false) === true, 'local_ahead can update');
check(syncState.canUpdate(S.IN_SYNC, true) === true, 'in_sync with dirty edits can update');
check(syncState.canUpdate(S.IN_SYNC, false) === false, 'in_sync clean has nothing to update');
check(syncState.canUpdate(S.REMOTE_AHEAD, false) === false, 'remote_ahead cannot update (would be rejected)');
check(syncState.canFastForward(S.REMOTE_AHEAD, false) === true, 'remote_ahead clean can fast-forward');
check(syncState.canFastForward(S.REMOTE_AHEAD, true) === false, 'remote_ahead dirty cannot fast-forward');
check(syncState.canFastForward(S.DIVERGED, false) === false, 'diverged cannot fast-forward');
check(syncState.needsForceToPush(S.DIVERGED) === true, 'diverged needs force to push');
check(syncState.needsForceToPush(S.LOCAL_AHEAD) === false, 'local_ahead does not need force');

// --- sync_state.webUrlFromRemote: link without a network round-trip ---
check(syncState.webUrlFromRemote('https://github.com/awen/mod.git') === 'https://github.com/awen/mod', 'https remote drops .git');
check(syncState.webUrlFromRemote('https://github.com/awen/mod') === 'https://github.com/awen/mod', 'https remote without .git is kept');
check(syncState.webUrlFromRemote('git@github.com:awen/mod.git') === 'https://github.com/awen/mod', 'scp-like ssh remote becomes https');
check(syncState.webUrlFromRemote('ssh://git@github.com/awen/mod.git') === 'https://github.com/awen/mod', 'ssh:// remote becomes https');
check(syncState.webUrlFromRemote('') === '', 'empty remote yields empty url');
check(syncState.webUrlFromRemote(null) === '', 'null remote yields empty url');

// --- sync_state.ownerRepoFromWebUrl: split a web url for the metadata fetch ---
const orHttps = syncState.ownerRepoFromWebUrl('https://github.com/awen/mod');
check(orHttps.owner === 'awen' && orHttps.repo === 'mod', 'owner/repo parsed from a https web url');
check(syncState.ownerRepoFromWebUrl('https://github.com/awen/mod.git').repo === 'mod', 'trailing .git is tolerated');
check(syncState.ownerRepoFromWebUrl('https://github.com/awen/mod/').owner === 'awen', 'trailing slash is tolerated');
check(syncState.ownerRepoFromWebUrl('').owner === '' && syncState.ownerRepoFromWebUrl('').repo === '', 'empty url yields empty owner/repo');
check(syncState.ownerRepoFromWebUrl('not a url').owner === '', 'junk url yields empty owner');
check(syncState.ownerRepoFromWebUrl('https://github.com/awen').owner === '', 'a url without a repo segment yields empty owner');

console.log('PASS: publish manifest + sync-state model (' + n + ' assertions)');
