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

  let repo;
  try {
    repo = await githubApi.createRepo(token, {
      name: opts.name || path.basename(dir),
      description: opts.description || '',
      private: Boolean(opts.private)
    });
  } catch (err) {
    return { ok: false, code: err.code || 'create_failed', message: err.message };
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

/** Wire the publish IPC handlers. Called once from main.js. */
function register(deps) {
  const ipcMain = deps.ipcMain;

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
    return publishMod(options || {});
  });
}

module.exports = {
  register: register,
  publishMod: publishMod,
  walkFiles: walkFiles
};
