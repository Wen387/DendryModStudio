'use strict';

/**
 * git_ops.js — isomorphic-git operations for the publish flow.
 *
 * Pure-JS git (no system `git` binary, no native build): a mod author who only
 * ever used the GitHub website almost certainly has no git installed, so we
 * bundle the implementation instead of shelling out.
 */

const fs = require('fs');
const path = require('path');
const git = require('isomorphic-git');
const gitHttp = require('isomorphic-git/http/node');

/**
 * Writes the generated housekeeping files into the mod folder before staging.
 * Only creates each file when it is missing, so an author who has hand-edited
 * their own .gitignore / .gitattributes never has it silently overwritten.
 */
function writeHousekeeping(dir, gitignore, gitattributes) {
  const ignorePath = path.join(dir, '.gitignore');
  if (typeof gitignore === 'string' && !fs.existsSync(ignorePath)) {
    fs.writeFileSync(ignorePath, gitignore);
  }
  const attrPath = path.join(dir, '.gitattributes');
  if (typeof gitattributes === 'string' && !fs.existsSync(attrPath)) {
    fs.writeFileSync(attrPath, gitattributes);
  }
}

/**
 * Stages exactly `files` (repo-relative POSIX paths): adds each, then unstages
 * anything still tracked that is no longer in the set. So the index ends up
 * reflecting EXACTLY the given list — which doubles as delete detection on an
 * update (a file removed locally is removed on the remote too). git.remove only
 * unstages; the on-disk file is untouched.
 */
async function stageWorkingTree(dir, files) {
  const want = Object.create(null);
  for (let i = 0; i < files.length; i += 1) {
    await git.add({ fs: fs, dir: dir, filepath: files[i] });
    want[files[i]] = true;
  }
  const tracked = await git.listFiles({ fs: fs, dir: dir });
  for (let r = 0; r < tracked.length; r += 1) {
    if (!want[tracked[r]]) {
      await git.remove({ fs: fs, dir: dir, filepath: tracked[r] });
    }
  }
}

/**
 * Commits the staged index, but ONLY if it differs from HEAD. Returns the new
 * (or, when nothing changed, the existing) commit oid plus whether a commit was
 * actually created — so first-publish stays idempotent on retry and an update
 * can report "nothing to publish".
 *
 * statusMatrix row = [filepath, HEAD, WORKDIR, STAGE]; a staged change is any
 * row whose STAGE differs from HEAD.
 *
 * @returns {Promise<{sha:string|null, committed:boolean}>}
 */
async function commitStaged(params) {
  const dir = params.dir;
  let head = null;
  try { head = await git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }); } catch (_e) { head = null; }
  if (head) {
    const matrix = await git.statusMatrix({ fs: fs, dir: dir });
    const hasStagedChange = matrix.some(function (row) { return row[3] !== row[1]; });
    if (!hasStagedChange) { return { sha: head, committed: false }; }
  }
  const sha = await git.commit({
    fs: fs,
    dir: dir,
    message: params.message,
    author: params.author
  });
  return { sha: sha, committed: true };
}

/**
 * Initialises a fresh repo (default branch `main`), stages the given
 * repo-relative POSIX paths, and creates the first commit. Idempotent: rerunning
 * with the same staged tree reuses the existing commit.
 *
 * @param {{dir:string, files:string[], author:{name:string,email:string}, message?:string}} params
 * @returns {Promise<string>} the commit SHA
 */
async function initCommit(params) {
  const dir = params.dir;
  const files = params.files || [];
  await git.init({ fs: fs, dir: dir, defaultBranch: 'main' });
  await stageWorkingTree(dir, files);
  const result = await commitStaged({
    dir: dir,
    message: params.message || 'Initial publish from Dendry Mod Studio',
    author: params.author
  });
  return result.sha;
}

/**
 * Classifies whether a push failure / result is a non-fast-forward rejection
 * (the remote moved ahead of us). isomorphic-git throws a PushRejectedError; a
 * resolved result may instead carry ok:false / an error string. Either way this
 * is the signal to tell the user to sync first (rather than blaming the push).
 */
function isNonFastForward(errOrResult) {
  if (!errOrResult) { return false; }
  if (errOrResult.code === 'PushRejectedError') { return true; }
  const msg = String(errOrResult.message || errOrResult.error || '');
  return /not\s+a?\s*(simple\s+)?fast-?forward|fast-?forward|rejected/i.test(msg);
}

/**
 * Reads the LOCAL git state of a mod folder — no network. The update/sync UI
 * keys off real git facts (is this a repo, does it track an origin, is the
 * worktree clean) rather than any marker we wrote, so a folder cloned elsewhere
 * updates here just the same.
 *
 * @param {{dir:string}} params
 * @returns {Promise<{hasGit:boolean, branch:string|null, headOid:string|null,
 *   dirty:boolean, hasOrigin:boolean, originUrl:string}>}
 */
async function readStatus(params) {
  const dir = params.dir;
  const out = { hasGit: false, branch: null, headOid: null, dirty: false, hasOrigin: false, originUrl: '' };
  try {
    out.headOid = await git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' });
    out.hasGit = true;
  } catch (_e) {
    // No HEAD yet (fresh init, or simply not a repo) — fall back to the marker dir.
    out.hasGit = fs.existsSync(path.join(dir, '.git'));
  }
  if (!out.hasGit) {
    return out;
  }
  try {
    out.branch = await git.currentBranch({ fs: fs, dir: dir, fullname: false }) || null;
  } catch (_e) {
    out.branch = null;
  }
  // Dirty = any deviation from a fully-clean tracked tree. A pristine committed
  // file is [path, HEAD=1, WORKDIR=1, STAGE=1]; anything else (modified, staged,
  // deleted, or untracked content) means the worktree carries uncommitted work.
  try {
    const matrix = await git.statusMatrix({ fs: fs, dir: dir });
    out.dirty = matrix.some(function (row) {
      return !(row[1] === 1 && row[2] === 1 && row[3] === 1);
    });
  } catch (_e) {
    out.dirty = false;
  }
  try {
    const remotes = await git.listRemotes({ fs: fs, dir: dir });
    for (let i = 0; i < remotes.length; i += 1) {
      if (remotes[i] && remotes[i].remote === 'origin') {
        out.hasOrigin = true;
        out.originUrl = remotes[i].url || '';
        break;
      }
    }
  } catch (_e) { /* no remotes */ }
  return out;
}

/** Returns up to `depth` commit oids reachable from `ref` (newest first). */
async function logOids(dir, ref, depth) {
  if (!ref) { return []; }
  try {
    const commits = await git.log({ fs: fs, dir: dir, ref: ref, depth: depth || 500 });
    return commits.map(function (c) { return c.oid; });
  } catch (_e) {
    return [];
  }
}

/**
 * Fetches origin/main and computes how far local `main` is ahead/behind it.
 * Networked: the token is supplied through onAuth (never the URL) so private
 * repos work too. Returns {offline:true} when GitHub is unreachable rather than
 * throwing, so the panel can degrade to a local-only view.
 *
 * @param {{dir:string, token:string}} params
 * @returns {Promise<{ahead:number, behind:number, remoteOid:string|null,
 *   localOid:string|null}|{offline:true}>}
 */
async function fetchAheadBehind(params) {
  const dir = params.dir;
  const token = params.token;
  let result;
  try {
    result = await git.fetch({
      fs: fs,
      http: gitHttp,
      dir: dir,
      remote: 'origin',
      ref: 'main',
      singleBranch: true,
      tags: false,
      onAuth: function () { return { username: token }; }
    });
  } catch (_e) {
    return { offline: true };
  }

  let localOid = null;
  try { localOid = await git.resolveRef({ fs: fs, dir: dir, ref: 'refs/heads/main' }); } catch (_e) { localOid = null; }

  let remoteOid = result && result.fetchHead ? result.fetchHead : null;
  if (!remoteOid) {
    try { remoteOid = await git.resolveRef({ fs: fs, dir: dir, ref: 'refs/remotes/origin/main' }); } catch (_e) { remoteOid = null; }
  }

  return computeAheadBehind(dir, localOid, remoteOid);
}

/**
 * Computes ahead/behind between two commits by diffing their reachable-commit
 * sets. Local-only (reads existing objects, no network), so it is unit-testable
 * against a repo whose origin/main ref was populated by any means.
 *
 * @returns {Promise<{ahead:number, behind:number, remoteOid:string|null, localOid:string|null}>}
 */
async function computeAheadBehind(dir, localOid, remoteOid) {
  if (!remoteOid) {
    // Remote has no `main` yet (e.g. a still-empty repo) — treat local as ahead.
    return { ahead: localOid ? 1 : 0, behind: 0, remoteOid: null, localOid: localOid || null };
  }
  if (localOid && localOid === remoteOid) {
    return { ahead: 0, behind: 0, remoteOid: remoteOid, localOid: localOid };
  }

  const localOids = await logOids(dir, localOid);
  const remoteOids = await logOids(dir, remoteOid);
  const localSet = {};
  for (let i = 0; i < localOids.length; i += 1) { localSet[localOids[i]] = true; }
  const remoteSet = {};
  for (let j = 0; j < remoteOids.length; j += 1) { remoteSet[remoteOids[j]] = true; }

  let ahead = 0;
  for (let a = 0; a < localOids.length; a += 1) { if (!remoteSet[localOids[a]]) { ahead += 1; } }
  let behind = 0;
  for (let b = 0; b < remoteOids.length; b += 1) { if (!localSet[remoteOids[b]]) { behind += 1; } }

  return { ahead: ahead, behind: behind, remoteOid: remoteOid, localOid: localOid || null };
}

/**
 * Pushes `main` over HTTPS. GitHub accepts a PAT/OAuth token as the HTTPS
 * username, so the token is supplied through onAuth and never put into the remote
 * URL (which would leak it into config/logs).
 *
 * `remoteUrl` is set on first publish (origin doesn't exist yet); on an update
 * origin already exists, so it can be omitted. `force` is the opt-in override for
 * the divergence "overwrite remote" escape hatch — defaults OFF.
 *
 * @param {{dir:string, remoteUrl?:string, token:string, force?:boolean}} params
 */
async function pushToRemote(params) {
  if (params.remoteUrl) {
    // force:true on addRemote so a retry after an earlier half-finished publish
    // overwrites the stale `origin` instead of failing with "remote exists".
    await git.addRemote({ fs: fs, dir: params.dir, remote: 'origin', url: params.remoteUrl, force: true });
  }
  return git.push({
    fs: fs,
    http: gitHttp,
    dir: params.dir,
    remote: 'origin',
    ref: 'main',
    force: Boolean(params.force),
    onAuth: function () { return { username: params.token }; }
  });
}

/**
 * True when local `main` and the cached `origin/main` tracking ref point at the
 * same commit — i.e. there is nothing to push. Checked locally against the ref
 * left by the last status fetch (no network), so an update can tell "nothing to
 * publish" apart from "unpushed commits still to send".
 */
async function localMatchesRemote(dir) {
  let localOid = null;
  let remoteOid = null;
  try { localOid = await git.resolveRef({ fs: fs, dir: dir, ref: 'refs/heads/main' }); } catch (_e) { localOid = null; }
  try { remoteOid = await git.resolveRef({ fs: fs, dir: dir, ref: 'refs/remotes/origin/main' }); } catch (_e) { remoteOid = null; }
  return Boolean(localOid && remoteOid && localOid === remoteOid);
}

/**
 * Fast-forward pull: fetch origin/main and advance local main to it, updating
 * the working tree. ONLY runs on a clean worktree (a dirty tree returns
 * {code:'dirty'} without touching anything — we never overwrite local edits),
 * and ONLY fast-forwards (a non-FF returns {code:'not_fast_forward'} rather than
 * creating a merge commit). git.fastForward = fetch + merge(ff-only) + checkout.
 *
 * @param {{dir:string, token:string}} params
 * @returns {Promise<{ok:true, oid:string|null}|{ok:false, code:string, message?:string}>}
 */
async function ffPull(params) {
  const dir = params.dir;
  const token = params.token;
  const status = await readStatus({ dir: dir });
  if (status.dirty) {
    return { ok: false, code: 'dirty' };
  }
  try {
    await git.fastForward({
      fs: fs,
      http: gitHttp,
      dir: dir,
      ref: 'main',
      singleBranch: true,
      onAuth: function () { return { username: token }; }
    });
  } catch (err) {
    if (err && (err.code === 'FastForwardError' || err.code === 'MergeNotSupportedError')) {
      return { ok: false, code: 'not_fast_forward', message: err.message };
    }
    return { ok: false, code: 'sync_failed', message: err && err.message ? err.message : String(err) };
  }
  let oid = null;
  try { oid = await git.resolveRef({ fs: fs, dir: dir, ref: 'refs/heads/main' }); } catch (_e) { oid = null; }
  return { ok: true, oid: oid };
}

/**
 * Lists the commits reachable from `headOid` but NOT from `baseOid` (newest
 * first), returning the one-line message + author date for each. Local object
 * reads only — after a status fetch the remote commits are already in the object
 * store, so the panel can show "what is in this update" without another network
 * round-trip. Degrades to [] on any read hiccup.
 *
 * @returns {Promise<Array<{oid:string, message:string, date:number|null}>>}
 */
async function commitsBetween(dir, baseOid, headOid, depth) {
  if (!headOid) { return []; }
  const cap = depth || 200;
  let headCommits = [];
  try {
    headCommits = await git.log({ fs: fs, dir: dir, ref: headOid, depth: cap });
  } catch (_e) {
    return [];
  }
  const baseSet = Object.create(null);
  if (baseOid) {
    const baseOids = await logOids(dir, baseOid, cap);
    for (let i = 0; i < baseOids.length; i += 1) { baseSet[baseOids[i]] = true; }
  }
  const out = [];
  for (let j = 0; j < headCommits.length; j += 1) {
    const entry = headCommits[j];
    if (!entry || baseSet[entry.oid]) { continue; }
    const commit = entry.commit || {};
    const line = String(commit.message || '').split('\n')[0].trim();
    const ts = commit.author && commit.author.timestamp ? commit.author.timestamp * 1000 : null;
    out.push({ oid: entry.oid, message: line, date: ts });
  }
  return out;
}

/**
 * Diffs two commit trees into a flat per-file change list (add / modify /
 * delete), sorted by path. Local object reads only (git.walk over TREE
 * snapshots). When `fromOid` is missing every file in `toOid` is reported as an
 * add. Degrades to whatever was collected on error.
 *
 * @returns {Promise<Array<{path:string, change:'add'|'modify'|'delete'}>>}
 */
async function changedFiles(dir, fromOid, toOid) {
  if (!toOid) { return []; }
  const out = [];
  const trees = fromOid
    ? [git.TREE({ ref: fromOid }), git.TREE({ ref: toOid })]
    : [git.TREE({ ref: toOid })];
  try {
    await git.walk({
      fs: fs,
      dir: dir,
      trees: trees,
      map: async function (filepath, entries) {
        if (filepath === '.') { return undefined; }
        if (!fromOid) {
          const only = entries[0];
          if (only && (await only.type()) === 'blob') { out.push({ path: filepath, change: 'add' }); }
          return undefined;
        }
        const a = entries[0];
        const b = entries[1];
        const aType = a ? await a.type() : null;
        const bType = b ? await b.type() : null;
        if (aType === 'tree' || bType === 'tree') { return undefined; }
        if (!a && b) { out.push({ path: filepath, change: 'add' }); return undefined; }
        if (a && !b) { out.push({ path: filepath, change: 'delete' }); return undefined; }
        if (a && b) {
          const ao = await a.oid();
          const bo = await b.oid();
          if (ao !== bo) { out.push({ path: filepath, change: 'modify' }); }
        }
        return undefined;
      }
    });
  } catch (_e) {
    return out;
  }
  out.sort(function (x, y) { return x.path.localeCompare(y.path); });
  return out;
}

/**
 * Classifies the uncommitted worktree into a per-file change list by comparing
 * each statusMatrix row's WORKDIR to HEAD (add / modify / delete). `isIgnored`
 * (optional) drops files a publish would not upload, so the list matches what an
 * Update actually sends. Local only.
 *
 * @returns {Promise<Array<{path:string, change:'add'|'modify'|'delete'}>>}
 */
async function workingTreeChanges(dir, isIgnored) {
  const out = [];
  let matrix;
  try { matrix = await git.statusMatrix({ fs: fs, dir: dir }); } catch (_e) { return out; }
  for (let i = 0; i < matrix.length; i += 1) {
    const row = matrix[i];
    const filepath = row[0];
    const head = row[1];
    const workdir = row[2];
    if (head === 1 && workdir === 1) { continue; } // unmodified
    if (head === 0 && workdir === 0) { continue; } // absent both sides
    if (typeof isIgnored === 'function' && isIgnored(filepath)) { continue; }
    let change = 'modify';
    if (head === 0) { change = 'add'; }
    else if (workdir === 0) { change = 'delete'; }
    out.push({ path: filepath, change: change });
  }
  out.sort(function (x, y) { return x.path.localeCompare(y.path); });
  return out;
}

/**
 * High-level "what has changed locally vs the remote" summary for the panel:
 * committed-but-unpushed file changes (origin/main -> local main) plus the
 * uncommitted worktree changes. Local object reads only (uses the origin/main
 * ref the last status fetch left behind), so it is unit-testable offline.
 *
 * @returns {Promise<{committedChanges:Array, workingChanges:Array}>}
 */
async function localChangeSummary(dir, isIgnored) {
  let localOid = null;
  let remoteOid = null;
  try { localOid = await git.resolveRef({ fs: fs, dir: dir, ref: 'refs/heads/main' }); } catch (_e) { localOid = null; }
  try { remoteOid = await git.resolveRef({ fs: fs, dir: dir, ref: 'refs/remotes/origin/main' }); } catch (_e) { remoteOid = null; }
  const committedChanges = await changedFiles(dir, remoteOid, localOid);
  const workingChanges = await workingTreeChanges(dir, isIgnored);
  return { committedChanges: committedChanges, workingChanges: workingChanges };
}

/**
 * Severs the link between a folder and its GitHub repo by removing the `origin`
 * remote. LOCAL-ONLY and deliberately non-destructive: it does NOT delete .git,
 * the commit history, or any working file, and it never touches the repo on
 * GitHub — it only removes the remote, after which readStatus reports no origin
 * and publishStatus reclassifies the folder as a first_publish. Idempotent: a
 * folder that already has no origin succeeds as a no-op ({removed:false}).
 *
 * @returns {Promise<{ok:true, removed:boolean}>}
 */
async function unlinkRemote(dir) {
  let hadOrigin = false;
  try {
    const remotes = await git.listRemotes({ fs: fs, dir: dir });
    hadOrigin = remotes.some(function (r) { return r && r.remote === 'origin'; });
  } catch (_e) {
    hadOrigin = false;
  }
  if (!hadOrigin) {
    return { ok: true, removed: false };
  }
  await git.deleteRemote({ fs: fs, dir: dir, remote: 'origin' });
  return { ok: true, removed: true };
}

module.exports = {
  writeHousekeeping: writeHousekeeping,
  stageWorkingTree: stageWorkingTree,
  commitStaged: commitStaged,
  initCommit: initCommit,
  isNonFastForward: isNonFastForward,
  pushToRemote: pushToRemote,
  readStatus: readStatus,
  fetchAheadBehind: fetchAheadBehind,
  computeAheadBehind: computeAheadBehind,
  localMatchesRemote: localMatchesRemote,
  ffPull: ffPull,
  commitsBetween: commitsBetween,
  changedFiles: changedFiles,
  workingTreeChanges: workingTreeChanges,
  localChangeSummary: localChangeSummary,
  unlinkRemote: unlinkRemote
};
