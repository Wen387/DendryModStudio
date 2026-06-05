'use strict';

/**
 * sync_state.js — pure, environment-free decision logic for the publish
 * update/sync flow.
 *
 * Given the observed git/network facts about a mod folder, decide which action
 * the publish panel should offer. No fs / git / network / electron here: the
 * desktop layer gathers the raw facts (does .git exist, is there an origin, is
 * the worktree dirty, how far ahead/behind is the remote, did the fetch fail)
 * and hands them in as plain values, so the branching that drives the UI stays
 * trivially unit-testable in plain Node — mirroring manifest.js.
 */

/**
 * Sync states the UI branches on. `dirty` is intentionally NOT folded into the
 * state — it is an orthogonal flag the panel surfaces alongside the state (e.g.
 * "you have local changes; they'll be sent when you Update"), and it gates the
 * pull action at action time rather than changing which primary state we are in.
 */
const SYNC_STATES = {
  FIRST_PUBLISH: 'first_publish', // no git / no origin -> run the first-publish form
  OFFLINE: 'offline',             // tracks an origin but the remote was unreachable
  IN_SYNC: 'in_sync',             // local and remote point at the same commit
  LOCAL_AHEAD: 'local_ahead',     // local has commits the remote lacks -> Update
  REMOTE_AHEAD: 'remote_ahead',   // remote has commits we lack -> fast-forward pull
  DIVERGED: 'diverged'            // both sides moved -> needs force-push override
};

/**
 * Classify the publish folder into one primary sync state.
 *
 * @param {{hasGit?:boolean, hasOrigin?:boolean, dirty?:boolean,
 *          ahead?:number, behind?:number, offline?:boolean}} facts
 * @returns {string} one of SYNC_STATES
 */
function classify(facts) {
  const f = facts || {};
  // A folder we can update/sync must already be a git repo that tracks origin.
  // Anything else is a first publish (decoupled: we key off real git state, not
  // a marker we wrote, so a folder cloned elsewhere updates here too).
  if (!f.hasGit || !f.hasOrigin) {
    return SYNC_STATES.FIRST_PUBLISH;
  }
  // We track an origin but couldn't reach GitHub to compare; show local info
  // only and let the user retry rather than guessing ahead/behind.
  if (f.offline) {
    return SYNC_STATES.OFFLINE;
  }
  const ahead = Number(f.ahead) || 0;
  const behind = Number(f.behind) || 0;
  if (ahead > 0 && behind > 0) {
    return SYNC_STATES.DIVERGED;
  }
  if (ahead > 0) {
    return SYNC_STATES.LOCAL_AHEAD;
  }
  if (behind > 0) {
    return SYNC_STATES.REMOTE_AHEAD;
  }
  return SYNC_STATES.IN_SYNC;
}

/**
 * Convenience predicates the UI uses to decide which buttons to enable. Kept
 * pure so they can be asserted directly.
 */
function canUpdate(state, dirty) {
  // An Update push makes sense whenever local is (or could become) ahead: the
  // user has either unpushed commits or uncommitted local edits to send.
  return state === SYNC_STATES.LOCAL_AHEAD
    || (state === SYNC_STATES.IN_SYNC && Boolean(dirty));
}

function canFastForward(state, dirty) {
  // A fast-forward pull is only safe with a clean worktree, and only when the
  // remote is strictly ahead (no local divergence to clobber).
  return state === SYNC_STATES.REMOTE_AHEAD && !dirty;
}

function needsForceToPush(state) {
  return state === SYNC_STATES.DIVERGED;
}

/**
 * Derive the human-facing repository URL from a git remote URL, so an Update
 * success can link to the repo without a network round-trip. Handles the common
 * HTTPS form (with/without the trailing ".git") and the scp-like SSH form.
 * Returns '' when nothing usable can be parsed.
 */
function webUrlFromRemote(remoteUrl) {
  let url = String(remoteUrl == null ? '' : remoteUrl).trim();
  if (!url) {
    return '';
  }
  // scp-like SSH: git@github.com:owner/repo(.git) -> https://github.com/owner/repo
  const sshMatch = url.match(/^[^@]+@([^:]+):(.+)$/);
  if (sshMatch) {
    url = 'https://' + sshMatch[1] + '/' + sshMatch[2];
  }
  // ssh:// or git:// -> https://
  url = url.replace(/^ssh:\/\/(?:[^@]+@)?/, 'https://').replace(/^git:\/\//, 'https://');
  url = url.replace(/\.git$/, '').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(url)) {
    return '';
  }
  return url;
}

/**
 * Splits a repository web URL (as produced by webUrlFromRemote) into its
 * {owner, repo}. Tolerates a trailing ".git" / slash. Returns empty strings when
 * the URL is not a recognizable host/owner/repo path, so a caller can skip the
 * (optional) metadata fetch rather than calling the API with junk. Pure.
 */
function ownerRepoFromWebUrl(webUrl) {
  const url = String(webUrl == null ? '' : webUrl)
    .trim()
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
  const m = url.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/]+)$/);
  if (!m) {
    return { owner: '', repo: '' };
  }
  return { owner: m[1], repo: m[2] };
}

const api = {
  SYNC_STATES: SYNC_STATES,
  classify: classify,
  canUpdate: canUpdate,
  canFastForward: canFastForward,
  needsForceToPush: needsForceToPush,
  webUrlFromRemote: webUrlFromRemote,
  ownerRepoFromWebUrl: ownerRepoFromWebUrl
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
