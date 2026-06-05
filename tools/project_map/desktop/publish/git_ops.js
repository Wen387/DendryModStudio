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
  ffPull: ffPull
};
