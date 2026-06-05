'use strict';

/**
 * publish/index.js — orchestration + IPC wiring for the "Publish to GitHub" flow.
 *
 * This is the only file the rest of the desktop app touches: main.js calls
 * register({ipcMain, app, shell}) once, and everything else lives inside this
 * folder. The subsystem depends on nothing from Studio's domain models — it
 * only needs a folder path, a file list, and the token it owns in the keychain.
 */

const fs = require('fs');
const path = require('path');
const manifest = require('./manifest');
const auth = require('./auth');
const githubApi = require('./github_api');
const gitOps = require('./git_ops');
const syncState = require('./sync_state');

/** Walks a mod folder into {path, bytes} entries, skipping ignored subtrees. */
function walkFiles(rootDir) {
  const out = [];
  (function walk(rel) {
    let names;
    try {
      names = fs.readdirSync(path.join(rootDir, rel));
    } catch (_err) {
      return;
    }
    names.forEach(function (name) {
      const childRel = rel ? (rel + '/' + name) : name;
      if (manifest.isIgnored(childRel)) {
        return;
      }
      let stat;
      try {
        stat = fs.statSync(path.join(rootDir, childRel));
      } catch (_err) {
        return;
      }
      if (stat.isDirectory()) {
        walk(childRel);
      } else if (stat.isFile()) {
        out.push({ path: childRel, bytes: stat.size });
      }
    });
  })('');
  return out;
}

/**
 * Publish a local mod folder to a brand-new GitHub repo.
 * Pass {dryRun:true} to get the manifest preview without creating anything.
 */
async function publishMod(options) {
  const opts = options || {};
  const dir = opts.projectRoot;
  if (!dir || !fs.existsSync(dir)) {
    return { ok: false, code: 'no_project', message: 'Open a mod folder before publishing.' };
  }

  const token = auth.loadToken();
  if (!token) {
    return { ok: false, code: 'no_token', message: 'Connect a GitHub account before publishing.' };
  }

  let user;
  try {
    user = await githubApi.getAuthenticatedUser(token);
  } catch (err) {
    return { ok: false, code: err.code || 'auth_failed', message: err.message };
  }

  const preview = manifest.buildManifest(walkFiles(dir));

  if (opts.dryRun) {
    return { ok: true, dryRun: true, login: user.login, manifest: preview };
  }

  // Housekeeping files become part of the published repo, so write them before
  // re-deriving the staged file list.
  gitOps.writeHousekeeping(dir, manifest.gitignoreContents(), manifest.gitattributesContents());
  const stagedManifest = manifest.buildManifest(walkFiles(dir));
  const stagedPaths = stagedManifest.included.map(function (entry) { return entry.path; });

  let sha;
  try {
    sha = await gitOps.initCommit({
      dir: dir,
      files: stagedPaths,
      author: { name: user.login, email: manifest.noreplyEmail(user) },
      message: opts.message || 'Initial publish from Dendry Mod Studio'
    });
  } catch (err) {
    return { ok: false, code: 'commit_failed', message: err.message };
  }

  const repoName = manifest.normalizeRepoName(opts.name || path.basename(dir));
  let repo;
  try {
    repo = await githubApi.createRepo(token, {
      name: repoName,
      description: opts.description || '',
      private: Boolean(opts.private)
    });
  } catch (err) {
    // Retry-friendliness: an earlier attempt may have already created the repo.
    // Reuse it ONLY when it is still empty, so we never overwrite real content.
    if (err.code === 'repo_exists') {
      let existing = null;
      try {
        existing = await githubApi.getRepo(token, user.login, repoName);
      } catch (_e) {
        existing = null;
      }
      if (existing && existing.size === 0) {
        repo = existing;
      } else {
        return { ok: false, code: 'repo_exists', message: err.message };
      }
    } else {
      return { ok: false, code: err.code || 'create_failed', message: err.message };
    }
  }

  try {
    await gitOps.pushToRemote({ dir: dir, remoteUrl: repo.clone_url, token: token });
  } catch (err) {
    // The repo exists but the push failed; surface its URL so the user can retry.
    return { ok: false, code: 'push_failed', message: err.message, repoUrl: repo.html_url };
  }

  return {
    ok: true,
    sha: sha,
    login: user.login,
    repoUrl: repo.html_url,
    manifest: stagedManifest
  };
}

/**
 * Probe a mod folder's publish/sync state: is it a git repo, does it track an
 * origin, is the worktree dirty, and (if reachable) how far ahead/behind the
 * remote is. Drives whether the UI shows the first-publish form or a sync panel.
 * Network failure degrades to {offline:true} rather than erroring.
 */
async function publishStatus(options) {
  const opts = options || {};
  const dir = opts.projectRoot;
  if (!dir || !fs.existsSync(dir)) {
    return { ok: false, code: 'no_project', message: 'Open a mod folder before publishing.' };
  }

  const status = await gitOps.readStatus({ dir: dir });
  const result = {
    ok: true,
    hasGit: status.hasGit,
    hasOrigin: status.hasOrigin,
    originUrl: status.originUrl,
    repoUrl: syncState.webUrlFromRemote(status.originUrl),
    branch: status.branch,
    dirty: status.dirty,
    ahead: 0,
    behind: 0,
    offline: false
  };

  if (!status.hasGit || !status.hasOrigin) {
    result.state = syncState.classify({ hasGit: status.hasGit, hasOrigin: status.hasOrigin });
    return result;
  }

  // Comparing against the remote needs the token (private repos). With no token
  // we behave like offline — the local-only panel still renders.
  const token = auth.loadToken();
  let counts = { offline: true };
  if (token) {
    counts = await gitOps.fetchAheadBehind({ dir: dir, token: token });
  }
  if (counts.offline) {
    result.offline = true;
  } else {
    result.ahead = counts.ahead;
    result.behind = counts.behind;
    // Commit lists are local object reads (the fetch above populated the
    // objects), so they are cheap and degrade to empty on any read hiccup. They
    // turn "↑3 to upload" into the actual commit messages behind it.
    try {
      if (result.ahead > 0) {
        result.aheadCommits = await gitOps.commitsBetween(dir, counts.remoteOid, counts.localOid);
      }
      if (result.behind > 0) {
        result.behindCommits = await gitOps.commitsBetween(dir, counts.localOid, counts.remoteOid);
      }
    } catch (_e) { /* commit lists are best-effort */ }
  }

  // Repo metadata (public/private, description, last push) is a best-effort REST
  // read: a failure just omits the card detail rather than breaking the panel.
  if (token && !result.offline) {
    const ids = syncState.ownerRepoFromWebUrl(result.repoUrl);
    if (ids.owner && ids.repo) {
      try {
        const repo = await githubApi.getRepo(token, ids.owner, ids.repo);
        if (repo) {
          result.repoMeta = {
            private: Boolean(repo.private),
            description: repo.description || '',
            defaultBranch: repo.default_branch || 'main',
            pushedAt: repo.pushed_at || '',
            htmlUrl: repo.html_url || result.repoUrl
          };
        }
      } catch (_e) { /* metadata is best-effort */ }
    }
  }

  result.state = syncState.classify({
    hasGit: status.hasGit,
    hasOrigin: status.hasOrigin,
    dirty: status.dirty,
    ahead: result.ahead,
    behind: result.behind,
    offline: result.offline
  });
  return result;
}

/**
 * Lists the concrete file-level changes behind an update: committed-but-unpushed
 * changes (origin/main -> local main) and the uncommitted worktree edits an
 * Update would commit. Local object reads only (no network), so the panel can
 * lazy-load it cheaply when the author expands "view changed files". The
 * manifest ignore filter is applied so the list matches what a publish uploads.
 */
async function publishChanges(options) {
  const opts = options || {};
  const dir = opts.projectRoot;
  if (!dir || !fs.existsSync(dir)) {
    return { ok: false, code: 'no_project', message: 'Open a mod folder before publishing.' };
  }
  const status = await gitOps.readStatus({ dir: dir });
  if (!status.hasGit) {
    return { ok: false, code: 'not_tracked', message: 'This folder is not linked to a GitHub repository yet.' };
  }
  const summary = await gitOps.localChangeSummary(dir, function (rel) { return manifest.isIgnored(rel); });
  return { ok: true, committedChanges: summary.committedChanges, workingChanges: summary.workingChanges };
}

/**
 * Push local changes to an already-published repo. Commits the current file set
 * with the user's message, then pushes origin/main. `force:true` is the opt-in
 * "overwrite remote" override for divergence (M3-b) — OFF by default, in which
 * case a remote that moved ahead returns `remote_ahead` instead of clobbering.
 */
async function publishUpdate(options) {
  const opts = options || {};
  const force = Boolean(opts.force);
  const dir = opts.projectRoot;
  if (!dir || !fs.existsSync(dir)) {
    return { ok: false, code: 'no_project', message: 'Open a mod folder before publishing.' };
  }
  // A normal update needs a message (it commits the author's edits). The force
  // override may have nothing new to commit (it overwrites with existing
  // commits), so a message is optional there.
  const message = String(opts.message || '').trim();
  if (!force && !message) {
    return { ok: false, code: 'no_message', message: 'Describe what changed before updating.' };
  }
  const token = auth.loadToken();
  if (!token) {
    return { ok: false, code: 'no_token', message: 'Connect a GitHub account before publishing.' };
  }

  const status = await gitOps.readStatus({ dir: dir });
  if (!status.hasGit || !status.hasOrigin) {
    return { ok: false, code: 'not_tracked', message: 'This folder is not linked to a GitHub repository yet.' };
  }

  let user;
  try {
    user = await githubApi.getAuthenticatedUser(token);
  } catch (err) {
    return { ok: false, code: err.code || 'auth_failed', message: err.message };
  }

  // Keep housekeeping current (writeHousekeeping only writes missing files), then
  // re-derive the staged list and commit the author's changes.
  gitOps.writeHousekeeping(dir, manifest.gitignoreContents(), manifest.gitattributesContents());
  const stagedManifest = manifest.buildManifest(walkFiles(dir));
  const stagedPaths = stagedManifest.included.map(function (entry) { return entry.path; });

  let commit;
  try {
    await gitOps.stageWorkingTree(dir, stagedPaths);
    commit = await gitOps.commitStaged({
      dir: dir,
      author: { name: user.login, email: manifest.noreplyEmail(user) },
      message: message || 'Update from Dendry Mod Studio'
    });
  } catch (err) {
    return { ok: false, code: 'commit_failed', message: err.message };
  }
  // No new commit doesn't necessarily mean nothing to do: a prior update may have
  // committed but failed to push (unpushed commits still to send). Only bail when
  // local also matches the remote tracking ref. Force never bails — it overwrites.
  if (!commit.committed && !force) {
    const upToDate = await gitOps.localMatchesRemote(dir);
    if (upToDate) {
      return { ok: false, code: 'nothing_to_commit', message: 'There are no changes to publish.' };
    }
  }

  let pushResult;
  try {
    pushResult = await gitOps.pushToRemote({ dir: dir, token: token, force: force });
  } catch (err) {
    // The commit is safely on disk; only the network step failed. A non-FF
    // rejection means the remote moved — guide to re-check/sync rather than blame.
    if (!force && gitOps.isNonFastForward(err)) {
      return { ok: false, code: 'remote_ahead', message: 'GitHub changed since you last checked. Re-check and sync first.' };
    }
    return { ok: false, code: 'push_failed', message: err.message, repoUrl: syncState.webUrlFromRemote(status.originUrl) };
  }
  if (pushResult && pushResult.ok === false) {
    if (!force && gitOps.isNonFastForward(pushResult)) {
      return { ok: false, code: 'remote_ahead', message: 'GitHub changed since you last checked. Re-check and sync first.' };
    }
    return { ok: false, code: 'push_failed', message: String(pushResult.error || 'Push failed.'), repoUrl: syncState.webUrlFromRemote(status.originUrl) };
  }

  return {
    ok: true,
    sha: commit.sha,
    login: user.login,
    repoUrl: syncState.webUrlFromRemote(status.originUrl),
    forced: force,
    manifest: stagedManifest
  };
}

/**
 * Pull remote changes into a clean worktree via fast-forward only. Returns the
 * new HEAD oid on success so the renderer can rebuild the Studio index (the
 * on-disk content changed). Refuses on a dirty worktree or a non-fast-forward.
 */
async function publishSync(options) {
  const opts = options || {};
  const dir = opts.projectRoot;
  if (!dir || !fs.existsSync(dir)) {
    return { ok: false, code: 'no_project', message: 'Open a mod folder before publishing.' };
  }
  const token = auth.loadToken();
  if (!token) {
    return { ok: false, code: 'no_token', message: 'Connect a GitHub account before publishing.' };
  }
  const status = await gitOps.readStatus({ dir: dir });
  if (!status.hasGit || !status.hasOrigin) {
    return { ok: false, code: 'not_tracked', message: 'This folder is not linked to a GitHub repository yet.' };
  }

  const result = await gitOps.ffPull({ dir: dir, token: token });
  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message || '' };
  }
  return { ok: true, oid: result.oid, repoUrl: syncState.webUrlFromRemote(status.originUrl) };
}

/**
 * Updates the published repo's settings (visibility and/or description) through
 * the GitHub REST API. owner/repo are derived from the local origin URL with the
 * pure sync_state helpers, so this needs no Studio state — only the folder and
 * the token it owns. Best-effort: any failure returns {ok:false, code} (surfaced
 * as an in-place flash) rather than throwing. On success it returns the refreshed
 * repoMeta so the dashboard can reflect the change without a full re-probe.
 */
async function publishConfig(options) {
  const opts = options || {};
  const dir = opts.projectRoot;
  if (!dir || !fs.existsSync(dir)) {
    return { ok: false, code: 'no_project', message: 'Open a mod folder before publishing.' };
  }
  const token = auth.loadToken();
  if (!token) {
    return { ok: false, code: 'no_token', message: 'Connect a GitHub account before publishing.' };
  }
  const status = await gitOps.readStatus({ dir: dir });
  if (!status.hasGit || !status.hasOrigin) {
    return { ok: false, code: 'not_tracked', message: 'This folder is not linked to a GitHub repository yet.' };
  }
  const ids = syncState.ownerRepoFromWebUrl(syncState.webUrlFromRemote(status.originUrl));
  if (!ids.owner || !ids.repo) {
    return { ok: false, code: 'no_remote_id', message: 'Could not determine the GitHub repository from this folder.' };
  }
  const patch = {};
  if (typeof opts.private === 'boolean') { patch.private = opts.private; }
  if (typeof opts.description === 'string') { patch.description = opts.description; }
  if (Object.keys(patch).length === 0) {
    return { ok: false, code: 'no_changes', message: 'There is nothing to change.' };
  }

  let repo;
  try {
    repo = await githubApi.updateRepo(token, ids.owner, ids.repo, patch);
  } catch (err) {
    return { ok: false, code: err.code || 'update_failed', message: err.message };
  }
  return {
    ok: true,
    repoMeta: {
      private: Boolean(repo.private),
      description: repo.description || '',
      defaultBranch: repo.default_branch || 'main',
      pushedAt: repo.pushed_at || '',
      htmlUrl: repo.html_url || syncState.webUrlFromRemote(status.originUrl)
    }
  };
}

/**
 * Disconnects a folder from its GitHub repo by removing the local `origin`
 * remote. Local-only and non-destructive: .git history and every working file
 * stay on disk and the GitHub repo is untouched — only the link is severed, so
 * the next publishStatus sees a first_publish folder again and the UI returns to
 * the publish form. The destructive-sounding name is intentional; the operation
 * itself is safe and reversible (re-publishing recreates the remote).
 */
async function publishUnlink(options) {
  const opts = options || {};
  const dir = opts.projectRoot;
  if (!dir || !fs.existsSync(dir)) {
    return { ok: false, code: 'no_project', message: 'Open a mod folder before publishing.' };
  }
  const status = await gitOps.readStatus({ dir: dir });
  if (!status.hasGit) {
    return { ok: false, code: 'not_tracked', message: 'This folder is not linked to a GitHub repository yet.' };
  }
  try {
    const result = await gitOps.unlinkRemote(dir);
    return { ok: true, removed: result.removed };
  } catch (err) {
    return { ok: false, code: 'unlink_failed', message: err && err.message ? err.message : String(err) };
  }
}

/** Wire the publish IPC handlers. Called once from main.js. */
function register(deps) {
  const ipcMain = deps.ipcMain;
  const resolveRoot = typeof deps.getProjectRoot === 'function' ? deps.getProjectRoot : function () { return ''; };

  ipcMain.handle('dendry:publish-auth-status', function () {
    return { ok: true, connected: auth.hasToken() };
  });

  ipcMain.handle('dendry:publish-set-token', async function (_event, options) {
    const token = options && options.token;
    try {
      const user = await githubApi.getAuthenticatedUser(token);
      auth.storeToken(token);
      return { ok: true, login: user.login };
    } catch (err) {
      return { ok: false, code: err.code || 'auth_failed', message: err.message };
    }
  });

  ipcMain.handle('dendry:publish-clear-token', function () {
    auth.clearToken();
    return { ok: true };
  });

  ipcMain.handle('dendry:publish-mod', async function (_event, options) {
    const opts = Object.assign({}, options || {});
    if (!opts.projectRoot) {
      opts.projectRoot = resolveRoot();
    }
    return publishMod(opts);
  });

  ipcMain.handle('dendry:publish-status', async function (_event, options) {
    const opts = Object.assign({}, options || {});
    if (!opts.projectRoot) {
      opts.projectRoot = resolveRoot();
    }
    return publishStatus(opts);
  });

  ipcMain.handle('dendry:publish-update', async function (_event, options) {
    const opts = Object.assign({}, options || {});
    if (!opts.projectRoot) {
      opts.projectRoot = resolveRoot();
    }
    return publishUpdate(opts);
  });

  ipcMain.handle('dendry:publish-sync', async function (_event, options) {
    const opts = Object.assign({}, options || {});
    if (!opts.projectRoot) {
      opts.projectRoot = resolveRoot();
    }
    return publishSync(opts);
  });

  ipcMain.handle('dendry:publish-changes', async function (_event, options) {
    const opts = Object.assign({}, options || {});
    if (!opts.projectRoot) {
      opts.projectRoot = resolveRoot();
    }
    return publishChanges(opts);
  });

  ipcMain.handle('dendry:publish-config', async function (_event, options) {
    const opts = Object.assign({}, options || {});
    if (!opts.projectRoot) {
      opts.projectRoot = resolveRoot();
    }
    return publishConfig(opts);
  });

  ipcMain.handle('dendry:publish-unlink', async function (_event, options) {
    const opts = Object.assign({}, options || {});
    if (!opts.projectRoot) {
      opts.projectRoot = resolveRoot();
    }
    return publishUnlink(opts);
  });
}

module.exports = {
  register: register,
  publishMod: publishMod,
  publishStatus: publishStatus,
  publishUpdate: publishUpdate,
  publishSync: publishSync,
  publishChanges: publishChanges,
  publishConfig: publishConfig,
  publishUnlink: publishUnlink,
  walkFiles: walkFiles
};
