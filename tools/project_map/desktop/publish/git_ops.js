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

/** Writes the generated housekeeping files into the mod folder before staging. */
function writeHousekeeping(dir, gitignore, gitattributes) {
  if (typeof gitignore === 'string') {
    fs.writeFileSync(path.join(dir, '.gitignore'), gitignore);
  }
  if (typeof gitattributes === 'string') {
    fs.writeFileSync(path.join(dir, '.gitattributes'), gitattributes);
  }
}

/**
 * Initialises a fresh repo (default branch `main`), stages the given
 * repo-relative POSIX paths, and creates the first commit.
 *
 * @param {{dir:string, files:string[], author:{name:string,email:string}, message?:string}} params
 * @returns {Promise<string>} the new commit SHA
 */
async function initCommit(params) {
  const dir = params.dir;
  const files = params.files || [];
  await git.init({ fs: fs, dir: dir, defaultBranch: 'main' });
  const want = Object.create(null);
  for (let i = 0; i < files.length; i += 1) {
    await git.add({ fs: fs, dir: dir, filepath: files[i] });
    want[files[i]] = true;
  }
  // Drop anything still tracked from an earlier attempt that is no longer in the
  // file set (e.g. a .github/workflows file we now exclude) so the new commit
  // reflects exactly `files`. git.remove only unstages — the file stays on disk.
  const tracked = await git.listFiles({ fs: fs, dir: dir });
  for (let r = 0; r < tracked.length; r += 1) {
    if (!want[tracked[r]]) {
      await git.remove({ fs: fs, dir: dir, filepath: tracked[r] });
    }
  }
  // Idempotent retry: if a previous attempt already committed this exact staged
  // tree, reuse that commit instead of stacking duplicate "Initial publish"
  // commits. statusMatrix row = [filepath, HEAD, WORKDIR, STAGE]; a staged
  // change is any row whose STAGE differs from HEAD.
  let head = null;
  try { head = await git.resolveRef({ fs: fs, dir: dir, ref: 'HEAD' }); } catch (_e) { head = null; }
  if (head) {
    const matrix = await git.statusMatrix({ fs: fs, dir: dir });
    const hasStagedChange = matrix.some(function (row) { return row[3] !== row[1]; });
    if (!hasStagedChange) { return head; }
  }
  return git.commit({
    fs: fs,
    dir: dir,
    message: params.message || 'Initial publish from Dendry Mod Studio',
    author: params.author
  });
}

/**
 * Adds `origin` and pushes `main` over HTTPS. GitHub accepts a PAT/OAuth token
 * as the HTTPS username, so the token is supplied through onAuth and never put
 * into the remote URL (which would leak it into config/logs).
 *
 * @param {{dir:string, remoteUrl:string, token:string}} params
 */
async function pushToRemote(params) {
  // force:true so a retry after an earlier half-finished publish overwrites
  // the stale `origin` instead of failing with "remote already exists".
  await git.addRemote({ fs: fs, dir: params.dir, remote: 'origin', url: params.remoteUrl, force: true });
  return git.push({
    fs: fs,
    http: gitHttp,
    dir: params.dir,
    remote: 'origin',
    ref: 'main',
    onAuth: function () { return { username: params.token }; }
  });
}

module.exports = {
  writeHousekeeping: writeHousekeeping,
  initCommit: initCommit,
  pushToRemote: pushToRemote
};
