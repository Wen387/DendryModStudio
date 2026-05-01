'use strict';

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 3500;
const DISABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);
const SEVERITIES = new Set(['info', 'warning', 'critical']);

function readPackageJson(options) {
  const desktopDir = path.resolve((options && options.desktopDir) || __dirname);
  const packagePath = path.join(desktopDir, 'package.json');
  try {
    return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch (_err) {
    return {};
  }
}

function configuredManifestUrl(options) {
  const explicit = options && typeof options.manifestUrl === 'string'
    ? options.manifestUrl.trim()
    : '';
  if (explicit) {
    return explicit;
  }
  const env = options && options.env ? options.env : process.env;
  const envUrl = env && typeof env.DMS_UPDATE_MANIFEST_URL === 'string'
    ? env.DMS_UPDATE_MANIFEST_URL.trim()
    : '';
  if (envUrl) {
    return envUrl;
  }
  const pkg = readPackageJson(options);
  return pkg && pkg.dendryModStudio && typeof pkg.dendryModStudio.updateManifestUrl === 'string'
    ? pkg.dendryModStudio.updateManifestUrl.trim()
    : '';
}

function updateChecksDisabled(options) {
  const env = options && options.env ? options.env : process.env;
  const value = env && typeof env.DMS_UPDATE_NOTICE_DISABLED === 'string'
    ? env.DMS_UPDATE_NOTICE_DISABLED.trim().toLowerCase()
    : '';
  return DISABLED_VALUES.has(value);
}

function normalizeVersion(version) {
  return String(version || '')
    .trim()
    .replace(/^v/i, '')
    .split(/[+-]/)[0]
    .split('.')
    .map((part) => {
      const number = Number.parseInt(part, 10);
      return Number.isFinite(number) ? number : 0;
    });
}

function compareVersions(left, right) {
  const a = normalizeVersion(left);
  const b = normalizeVersion(right);
  const length = Math.max(a.length, b.length, 3);
  for (let index = 0; index < length; index += 1) {
    const av = a[index] || 0;
    const bv = b[index] || 0;
    if (av > bv) {
      return 1;
    }
    if (av < bv) {
      return -1;
    }
  }
  return 0;
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch (_err) {
    return false;
  }
}

function validateLocalizedTextMap(manifest, key, diagnostics) {
  const value = manifest[key];
  if (value === undefined) {
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    diagnostics.push(key + ' must be an object when present');
    return;
  }
  Object.keys(value).forEach((locale) => {
    if (typeof value[locale] !== 'string') {
      diagnostics.push(key + '.' + locale + ' must be a string');
    }
  });
}

function validateManifest(manifest) {
  const diagnostics = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return {ok: false, diagnostics: ['manifest must be a JSON object']};
  }
  if (Number(manifest.schemaVersion) !== 1) {
    diagnostics.push('schemaVersion must be 1');
  }
  if (manifest.latestVersion !== undefined && typeof manifest.latestVersion !== 'string') {
    diagnostics.push('latestVersion must be a string when present');
  }
  if (manifest.minimumRecommendedVersion !== undefined && typeof manifest.minimumRecommendedVersion !== 'string') {
    diagnostics.push('minimumRecommendedVersion must be a string when present');
  }
  if (manifest.severity !== undefined && !SEVERITIES.has(String(manifest.severity))) {
    diagnostics.push('severity must be info, warning, or critical');
  }
  if (manifest.announcementOnly !== undefined && typeof manifest.announcementOnly !== 'boolean') {
    diagnostics.push('announcementOnly must be a boolean when present');
  }
  validateLocalizedTextMap(manifest, 'titleLocalized', diagnostics);
  validateLocalizedTextMap(manifest, 'bodyLocalized', diagnostics);
  ['downloadUrl', 'releaseNotesUrl'].forEach((key) => {
    if (manifest[key] !== undefined && manifest[key] !== '' && !isHttpUrl(manifest[key])) {
      diagnostics.push(key + ' must be an http(s) URL');
    }
  });
  return {ok: diagnostics.length === 0, diagnostics};
}

function noticeIdForManifest(manifest) {
  return String(
    manifest.noticeId ||
    [
      manifest.channel || 'default',
      manifest.latestVersion || 'announcement',
      manifest.publishedAt || '',
      manifest.title || ''
    ].join(':')
  );
}

function evaluateManifest(manifest, options) {
  const currentVersion = String((options && options.currentVersion) || '');
  const validation = validateManifest(manifest);
  if (!validation.ok) {
    return {
      ok: false,
      configured: true,
      currentVersion,
      diagnostics: validation.diagnostics,
      message: 'Update notice manifest is invalid: ' + validation.diagnostics.join('; ')
    };
  }
  const latestVersion = String(manifest.latestVersion || '').trim();
  const minimumRecommendedVersion = String(manifest.minimumRecommendedVersion || '').trim();
  const updateAvailable = Boolean(latestVersion && compareVersions(currentVersion, latestVersion) < 0);
  const belowRecommended = Boolean(minimumRecommendedVersion && compareVersions(currentVersion, minimumRecommendedVersion) < 0);
  const announcement = Boolean((manifest.title || manifest.body) && manifest.announcementOnly === true);
  const shouldNotify = Boolean(updateAvailable || belowRecommended || announcement || manifest.severity === 'critical');
  return {
    ok: true,
    configured: true,
    currentVersion,
    channel: String(manifest.channel || 'dev-preview'),
    latestVersion,
    minimumRecommendedVersion,
    updateAvailable,
    belowRecommended,
    shouldNotify,
    severity: String(manifest.severity || (belowRecommended ? 'warning' : 'info')),
    title: String(manifest.title || (updateAvailable ? 'Dendry Mod Studio update available' : 'Dendry Mod Studio notice')),
    body: String(manifest.body || ''),
    titleLocalized: manifest.titleLocalized && typeof manifest.titleLocalized === 'object' && !Array.isArray(manifest.titleLocalized)
      ? Object.assign({}, manifest.titleLocalized)
      : {},
    bodyLocalized: manifest.bodyLocalized && typeof manifest.bodyLocalized === 'object' && !Array.isArray(manifest.bodyLocalized)
      ? Object.assign({}, manifest.bodyLocalized)
      : {},
    downloadUrl: String(manifest.downloadUrl || ''),
    releaseNotesUrl: String(manifest.releaseNotesUrl || ''),
    publishedAt: String(manifest.publishedAt || ''),
    noticeId: noticeIdForManifest(manifest),
    manifest
  };
}

function fetchJson(url, options) {
  const timeoutMs = Number(options && options.timeoutMs) || DEFAULT_TIMEOUT_MS;
  const transport = String(url).startsWith('https:') ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'DendryModStudioUpdateNotice/1'
      }
    }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error('Update notice request returned HTTP ' + response.statusCode));
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
        if (body.length > 256 * 1024) {
          request.destroy(new Error('Update notice manifest is too large.'));
        }
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error('Update notice manifest is not valid JSON: ' + err.message));
        }
      });
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error('Update notice check timed out.'));
    });
    request.on('error', reject);
  });
}

async function checkForUpdate(options) {
  const opts = options || {};
  const currentVersion = String(opts.currentVersion || readPackageJson(opts).version || '');
  if (updateChecksDisabled(opts)) {
    return {
      ok: true,
      configured: false,
      disabled: true,
      currentVersion,
      shouldNotify: false,
      message: 'Update notices are disabled by DMS_UPDATE_NOTICE_DISABLED.'
    };
  }
  const manifestUrl = configuredManifestUrl(opts);
  if (!manifestUrl) {
    return {
      ok: true,
      configured: false,
      currentVersion,
      shouldNotify: false,
      message: 'No update notice manifest URL is configured.'
    };
  }
  if (!isHttpUrl(manifestUrl)) {
    return {
      ok: false,
      configured: true,
      currentVersion,
      manifestUrl,
      shouldNotify: false,
      message: 'Update notice manifest URL must be http(s).'
    };
  }
  try {
    const manifest = opts.manifest || await fetchJson(manifestUrl, opts);
    return Object.assign(evaluateManifest(manifest, {currentVersion}), {
      manifestUrl,
      checkedAt: new Date().toISOString()
    });
  } catch (err) {
    return {
      ok: false,
      configured: true,
      currentVersion,
      manifestUrl,
      shouldNotify: false,
      checkedAt: new Date().toISOString(),
      message: err && err.message ? err.message : String(err)
    };
  }
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  configuredManifestUrl,
  updateChecksDisabled,
  compareVersions,
  validateManifest,
  evaluateManifest,
  fetchJson,
  checkForUpdate
};
