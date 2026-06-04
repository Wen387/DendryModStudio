'use strict';

/**
 * auth.js — local-only GitHub credential storage for the publish flow.
 *
 * The token is encrypted with Electron's built-in safeStorage (OS keychain /
 * libsecret / DPAPI) and the ciphertext is written under userData. It is never
 * stored in plaintext, never written into a mod repo, and never crosses into
 * the renderer — all publish IPC stays in the main process.
 *
 * NOTE: this first cut takes a Personal Access Token. OAuth device flow is the
 * intended friendlier follow-up and slots in behind the same store/load API
 * once a GitHub OAuth App client_id exists.
 */

const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

function tokenFilePath() {
  return path.join(app.getPath('userData'), 'publish-credentials.bin');
}

function hasToken() {
  try {
    return fs.existsSync(tokenFilePath());
  } catch (_err) {
    return false;
  }
}

function storeToken(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('A non-empty GitHub token is required.');
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS secure storage is unavailable, so the token cannot be stored safely.');
  }
  fs.writeFileSync(tokenFilePath(), safeStorage.encryptString(token));
}

function loadToken() {
  if (!hasToken()) {
    return '';
  }
  try {
    return safeStorage.decryptString(fs.readFileSync(tokenFilePath()));
  } catch (_err) {
    return '';
  }
}

function clearToken() {
  try {
    fs.unlinkSync(tokenFilePath());
  } catch (_err) {
    /* already gone */
  }
}

module.exports = {
  hasToken: hasToken,
  storeToken: storeToken,
  loadToken: loadToken,
  clearToken: clearToken
};
