'use strict';

/**
 * github_api.js — thin GitHub REST client for the publish flow.
 *
 * Uses node `https` directly, mirroring the existing template_catalog.js style
 * (the project already calls api.github.com this way). Runs only in the Electron
 * main process; the token never leaves here.
 */

const https = require('https');

function request(method, urlPath, token, body) {
  return new Promise(function (resolve, reject) {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'DendryModStudio'
    };
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = https.request(
      { hostname: 'api.github.com', path: urlPath, method: method, headers: headers },
      function (res) {
        let buf = '';
        res.on('data', function (chunk) { buf += chunk; });
        res.on('end', function () {
          let json = null;
          try { json = buf ? JSON.parse(buf) : null; } catch (_err) { json = null; }
          resolve({ status: res.statusCode, json: json });
        });
      }
    );
    req.on('error', reject);
    if (data) { req.write(data); }
    req.end();
  });
}

/** Verifies the token and returns the authenticated user (login, id, ...). */
async function getAuthenticatedUser(token) {
  if (!token) {
    throw new Error('A GitHub token is required.');
  }
  const res = await request('GET', '/user', token);
  if (res.status !== 200) {
    const err = new Error('GitHub authentication failed (HTTP ' + res.status + ').');
    err.code = 'auth_failed';
    throw err;
  }
  return res.json;
}

/**
 * Creates a brand-new EMPTY repo on the authenticated account.
 * auto_init:false is deliberate — it keeps the remote empty so the very first
 * push is a clean fast-forward instead of an immediate divergence.
 */
async function createRepo(token, options) {
  const opts = options || {};
  const res = await request('POST', '/user/repos', token, {
    name: opts.name,
    description: opts.description || '',
    private: Boolean(opts.private),
    auto_init: false
  });
  if (res.status === 201) {
    return res.json;
  }
  if (res.status === 422) {
    const err = new Error('A repository named "' + opts.name + '" already exists on your account.');
    err.code = 'repo_exists';
    throw err;
  }
  if (res.status === 403) {
    // The most common cause is a public_repo-scoped token trying to create a
    // PRIVATE repo, which classic PATs can only do with the full "repo" scope.
    const detail = res.json && res.json.message ? ' (' + res.json.message + ')' : '';
    if (opts.private) {
      const err = new Error('Creating a private repository needs a token with the full "repo" scope.' + detail);
      err.code = 'private_scope';
      throw err;
    }
    const err = new Error('GitHub refused to create the repository (HTTP 403).' + detail);
    err.code = 'forbidden';
    throw err;
  }
  const ghMsg = res.json && res.json.message ? ' (' + res.json.message + ')' : '';
  const err = new Error('Could not create the repository (HTTP ' + res.status + ').' + ghMsg);
  err.code = 'create_failed';
  throw err;
}

module.exports = {
  request: request,
  getAuthenticatedUser: getAuthenticatedUser,
  createRepo: createRepo
};
