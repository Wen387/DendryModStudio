'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
const DEFAULT_KEEP_RECENT = 20;
const STUDIO_RUNTIME_KINDS = new Set([
  'dendry_mod_studio_runtime_preview',
  'dendry_mod_studio_runtime_lens'
]);

function pruneRuntimeSessionRoots(roots, options) {
  const results = [];
  ensureArray(roots).forEach((root) => {
    results.push(pruneRuntimeSessions(root, options));
  });
  return {
    ok: results.every((result) => result.ok),
    roots: results,
    removed: results.reduce((sum, result) => sum + result.removed.length, 0),
    diagnostics: results.flatMap((result) => result.diagnostics)
  };
}

function pruneRuntimeSessions(root, options) {
  const opts = options || {};
  const sessionRoot = path.resolve(String(root || ''));
  const nowMs = nowTime(opts.now);
  const maxAgeMs = finiteNumber(opts.maxAgeMs, DEFAULT_MAX_AGE_MS);
  const keepRecent = Math.max(0, Math.floor(finiteNumber(opts.keepRecent, DEFAULT_KEEP_RECENT)));
  const result = {ok: true, root: sessionRoot, removed: [], kept: [], diagnostics: []};

  if (!root || !fs.existsSync(sessionRoot)) {
    return result;
  }
  let rootStat;
  try {
    rootStat = fs.lstatSync(sessionRoot);
  } catch (err) {
    result.ok = false;
    result.diagnostics.push(diagnostic('error', 'runtime_cleanup.root_stat_failed', err.message));
    return result;
  }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    result.kept.push({path: sessionRoot, reason: 'root_not_directory'});
    return result;
  }

  const candidates = [];
  fs.readdirSync(sessionRoot).forEach((name) => {
    const entryPath = path.join(sessionRoot, name);
    const info = inspectSession(entryPath);
    if (!info.prunable) {
      result.kept.push({path: entryPath, reason: info.reason});
      return;
    }
    candidates.push(info);
  });

  candidates.sort((left, right) => right.createdAtMs - left.createdAtMs);
  candidates.forEach((candidate, index) => {
    const ageMs = nowMs - candidate.createdAtMs;
    if (index < keepRecent || ageMs < maxAgeMs) {
      result.kept.push({path: candidate.path, reason: index < keepRecent ? 'recent_slot' : 'within_age'});
      return;
    }
    try {
      fs.rmSync(candidate.path, {recursive: true, force: true});
      result.removed.push({path: candidate.path, sessionId: candidate.sessionId, ageMs});
    } catch (err) {
      result.ok = false;
      result.diagnostics.push(diagnostic('error', 'runtime_cleanup.remove_failed', err.message, candidate.path));
    }
  });

  return result;
}

function inspectSession(entryPath) {
  let stat;
  try {
    stat = fs.lstatSync(entryPath);
  } catch (_err) {
    return {path: entryPath, prunable: false, reason: 'stat_failed'};
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    return {path: entryPath, prunable: false, reason: 'not_directory'};
  }
  const metadataPath = path.join(entryPath, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    return {path: entryPath, prunable: false, reason: 'metadata_missing'};
  }
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  } catch (_err) {
    return {path: entryPath, prunable: false, reason: 'metadata_invalid'};
  }
  if (!metadata || !STUDIO_RUNTIME_KINDS.has(String(metadata.kind || ''))) {
    return {path: entryPath, prunable: false, reason: 'metadata_not_runtime'};
  }
  const createdAtMs = Date.parse(String(metadata.createdAt || ''));
  return {
    path: entryPath,
    prunable: true,
    sessionId: String(metadata.sessionId || path.basename(entryPath)),
    createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : stat.mtimeMs
  };
}

function nowTime(now) {
  if (now instanceof Date) {
    return now.getTime();
  }
  if (typeof now === 'number' && Number.isFinite(now)) {
    return now;
  }
  if (typeof now === 'function') {
    return nowTime(now());
  }
  return Date.now();
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function diagnostic(severity, code, message, targetPath) {
  return {
    severity,
    code,
    message,
    path: targetPath || '',
    confidence: 'exact'
  };
}

function ensureArray(value) {
  return Array.isArray(value) ? value : (value ? [value] : []);
}

module.exports = {
  DEFAULT_MAX_AGE_MS,
  DEFAULT_KEEP_RECENT,
  STUDIO_RUNTIME_KINDS,
  pruneRuntimeSessions,
  pruneRuntimeSessionRoots
};

