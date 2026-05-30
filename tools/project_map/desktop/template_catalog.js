'use strict';

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const path = require('path');
const {spawnSync} = require('child_process');

const CATALOG_MARKER = '.dendry-studio-catalog-template.json';
const MAX_REDIRECTS = 5;
const DOWNLOAD_TIMEOUT_MS = 3 * 60 * 1000;
const DOWNLOAD_CONNECT_TIMEOUT_MS = 15000;
const RELEASE_CHECK_TIMEOUT_MS = 5000;

function loadBundledCatalog(options) {
  const desktopDir = path.resolve((options && options.desktopDir) || __dirname);
  const catalogPath = path.join(desktopDir, 'template_catalog.json');
  try {
    return JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  } catch (_err) {
    return {schemaVersion: 1, templates: []};
  }
}

function validateCatalog(catalog) {
  const diagnostics = [];
  if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
    return {ok: false, diagnostics: ['catalog must be a JSON object']};
  }
  if (Number(catalog.schemaVersion) !== 1) {
    diagnostics.push('schemaVersion must be 1');
  }
  if (!Array.isArray(catalog.templates)) {
    diagnostics.push('templates must be an array');
    return {ok: diagnostics.length === 0, diagnostics};
  }
  catalog.templates.forEach(function (entry, index) {
    validateTemplateEntry(entry, index, diagnostics);
  });
  return {ok: diagnostics.length === 0, diagnostics};
}

function validateTemplateEntry(entry, index, diagnostics) {
  var prefix = 'templates[' + index + ']';
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    diagnostics.push(prefix + ' must be an object');
    return;
  }
  ['id', 'title', 'repo', 'assetName'].forEach(function (key) {
    if (typeof entry[key] !== 'string' || !entry[key].trim()) {
      diagnostics.push(prefix + '.' + key + ' is required and must be a non-empty string');
    }
  });
  if (typeof entry.id === 'string' && entry.id.trim() && !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(entry.id)) {
    diagnostics.push(prefix + '.id must contain only letters, digits, hyphens, and underscores');
  }
  ['description', 'author', 'releaseTag', 'indexAssetName', 'excerptIndexAssetName', 'assetsAssetName', 'minStudioVersion'].forEach(function (key) {
    if (entry[key] !== undefined && typeof entry[key] !== 'string') {
      diagnostics.push(prefix + '.' + key + ' must be a string when present');
    }
  });
  ['estimatedSizeMB', 'assetsEstimatedSizeMB'].forEach(function (key) {
    if (entry[key] !== undefined && (typeof entry[key] !== 'number' || entry[key] < 0)) {
      diagnostics.push(prefix + '.' + key + ' must be a non-negative number when present');
    }
  });
  if (entry.prebuiltIndex !== undefined && typeof entry.prebuiltIndex !== 'boolean') {
    diagnostics.push(prefix + '.prebuiltIndex must be a boolean when present');
  }
  validateLocalizedMap(entry, 'titleLocalized', prefix, diagnostics);
  validateLocalizedMap(entry, 'descriptionLocalized', prefix, diagnostics);
}

function validateLocalizedMap(entry, key, prefix, diagnostics) {
  var value = entry[key];
  if (value === undefined) {
    return;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    diagnostics.push(prefix + '.' + key + ' must be an object when present');
    return;
  }
  Object.keys(value).forEach(function (locale) {
    if (typeof value[locale] !== 'string') {
      diagnostics.push(prefix + '.' + key + '.' + locale + ' must be a string');
    }
  });
}

function resolveLocalizedText(base, localizedMap, locale) {
  if (!locale || !localizedMap || typeof localizedMap !== 'object') {
    return base || '';
  }
  var langTag = String(locale).toLowerCase();
  if (localizedMap[locale]) {
    return localizedMap[locale];
  }
  var keys = Object.keys(localizedMap);
  for (var i = 0; i < keys.length; i += 1) {
    if (keys[i].toLowerCase() === langTag || langTag.startsWith(keys[i].toLowerCase())) {
      return localizedMap[keys[i]];
    }
  }
  return base || '';
}

function normalizeVersion(version) {
  return String(version || '')
    .trim()
    .replace(/^v/i, '')
    .split(/[+-]/)[0]
    .split('.')
    .map(function (part) {
      var n = Number.parseInt(part, 10);
      return Number.isFinite(n) ? n : 0;
    });
}

function compareVersions(left, right) {
  var a = normalizeVersion(left);
  var b = normalizeVersion(right);
  var length = Math.max(a.length, b.length, 3);
  for (var i = 0; i < length; i += 1) {
    var av = a[i] || 0;
    var bv = b[i] || 0;
    if (av > bv) { return 1; }
    if (av < bv) { return -1; }
  }
  return 0;
}

function evaluateCatalog(catalog, options) {
  var opts = options || {};
  var currentVersion = String(opts.currentVersion || '');
  var locale = String(opts.locale || '');
  var validation = validateCatalog(catalog);
  if (!validation.ok) {
    return {ok: false, templates: [], diagnostics: validation.diagnostics};
  }
  var templates = (catalog.templates || [])
    .filter(function (entry) {
      if (!entry.minStudioVersion) { return true; }
      return compareVersions(currentVersion, entry.minStudioVersion) >= 0;
    })
    .map(function (entry) {
      return {
        id: entry.id,
        title: resolveLocalizedText(entry.title, entry.titleLocalized, locale),
        description: resolveLocalizedText(entry.description, entry.descriptionLocalized, locale),
        author: entry.author || '',
        repo: entry.repo,
        releaseTag: entry.releaseTag || 'latest',
        assetName: entry.assetName,
        estimatedSizeMB: entry.estimatedSizeMB || 0,
        prebuiltIndex: entry.prebuiltIndex === true,
        indexAssetName: entry.indexAssetName || '',
        excerptIndexAssetName: entry.excerptIndexAssetName || '',
        assetsAssetName: entry.assetsAssetName || '',
        assetsEstimatedSizeMB: entry.assetsEstimatedSizeMB || 0,
        minStudioVersion: entry.minStudioVersion || ''
      };
    });
  return {ok: true, templates: templates};
}

function resolveReleaseAssetUrl(template, assetField) {
  var repo = template.repo;
  var tag = template.releaseTag || 'latest';
  var asset = template[assetField || 'assetName'] || '';
  if (!repo || !asset) { return ''; }
  if (tag === 'latest') {
    return 'https://github.com/' + repo + '/releases/latest/download/' + asset;
  }
  return 'https://github.com/' + repo + '/releases/download/' + tag + '/' + asset;
}

function templateInstallDir(templatesRoot, templateId) {
  return path.join(templatesRoot, templateId);
}

function markerPath(installDir) {
  return path.join(installDir, CATALOG_MARKER);
}

function readMarker(installDir) {
  var mp = markerPath(installDir);
  if (!fs.existsSync(mp)) { return null; }
  try {
    return JSON.parse(fs.readFileSync(mp, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function writeMarker(installDir, data) {
  fs.writeFileSync(markerPath(installDir), JSON.stringify(Object.assign({
    installedAt: new Date().toISOString()
  }, data), null, 2), 'utf8');
}

function checkTemplateStatus(templatesRoot, templateId) {
  var installDir = templateInstallDir(templatesRoot, templateId);
  if (!fs.existsSync(installDir)) {
    return 'not-installed';
  }
  var marker = readMarker(installDir);
  if (!marker) {
    return 'corrupted';
  }
  var hasSource = fs.existsSync(path.join(installDir, 'source', 'info.dry')) ||
    fs.existsSync(path.join(installDir, 'source'));
  return hasSource ? 'ready' : 'corrupted';
}

function preflightCheck(url, _redirectsLeft) {
  var remaining = typeof _redirectsLeft === 'number' ? _redirectsLeft : MAX_REDIRECTS;
  return new Promise(function (resolve) {
    var request = https.request(url, {method: 'HEAD'}, function (response) {
      response.resume();
      var location = response.headers.location;
      if ([301, 302, 303, 307, 308].indexOf(response.statusCode) >= 0 && location) {
        if (remaining <= 0) {
          resolve({ok: false, statusCode: response.statusCode, reason: 'too-many-redirects'});
          return;
        }
        preflightCheck(new URL(location, url).toString(), remaining - 1).then(resolve);
        return;
      }
      resolve({ok: response.statusCode === 200, statusCode: response.statusCode});
    });
    request.setTimeout(DOWNLOAD_CONNECT_TIMEOUT_MS, function () {
      request.destroy();
      resolve({ok: false, statusCode: 0, reason: 'timeout'});
    });
    request.on('error', function () { resolve({ok: false, statusCode: 0, reason: 'network'}); });
    request.end();
  });
}

function download(url, dest, redirectsLeft, onProgress) {
  return new Promise(function (resolve, reject) {
    var connected = false;
    var request = https.get(url, function (response) {
      connected = true;
      var location = response.headers.location;
      if ([301, 302, 303, 307, 308].indexOf(response.statusCode) >= 0 && location) {
        response.resume();
        if (redirectsLeft <= 0) {
          reject(new Error('Too many redirects while downloading template.'));
          return;
        }
        download(new URL(location, url).toString(), dest, redirectsLeft - 1, onProgress)
          .then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error('Download failed with HTTP ' + response.statusCode + ': ' + url));
        return;
      }
      var total = Number(response.headers['content-length']) || 0;
      var received = 0;
      fs.mkdirSync(path.dirname(dest), {recursive: true});
      var file = fs.createWriteStream(dest);
      response.on('data', function (chunk) {
        received += chunk.length;
        if (typeof onProgress === 'function') {
          onProgress(received, total);
        }
      });
      response.pipe(file);
      response.on('error', function (err) { file.destroy(); reject(err); });
      file.on('finish', function () { file.close(resolve); });
      file.on('error', reject);
    });
    request.setTimeout(DOWNLOAD_CONNECT_TIMEOUT_MS, function () {
      if (!connected) {
        request.destroy(new Error('Template download connection timed out. The release may not exist yet.'));
      }
    });
    request.on('socket', function (socket) {
      socket.setTimeout(DOWNLOAD_TIMEOUT_MS);
      socket.on('timeout', function () {
        request.destroy(new Error('Template download timed out.'));
      });
    });
    request.on('error', reject);
  });
}

function extractTarGz(archivePath, targetDir) {
  fs.mkdirSync(targetDir, {recursive: true});
  var result = spawnSync('tar', ['-xzf', archivePath, '-C', targetDir], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60 * 1000
  });
  if (result.error) {
    throw new Error('Failed to extract template archive: ' + result.error.message);
  }
  if (result.status !== 0) {
    throw new Error('tar extraction failed: ' + (result.stderr || result.stdout));
  }
}

function checkDiskSpace(targetDir, requiredBytes) {
  if (!requiredBytes || typeof fs.statfsSync !== 'function') { return; }
  try {
    var dir = fs.existsSync(targetDir) ? targetDir : path.dirname(targetDir);
    var stat = fs.statfsSync(dir);
    var availableBytes = stat.bavail * stat.bsize;
    if (availableBytes < requiredBytes) {
      throw new Error('Insufficient disk space: need ' +
        Math.ceil(requiredBytes / 1048576) + ' MB, have ' +
        Math.ceil(availableBytes / 1048576) + ' MB.');
    }
  } catch (err) {
    if (err && err.message && err.message.indexOf('Insufficient disk space') === 0) { throw err; }
  }
}

function moveDir(src, dest) {
  try {
    fs.renameSync(src, dest);
  } catch (err) {
    if (err.code === 'EXDEV') {
      fs.cpSync(src, dest, {recursive: true});
      fs.rmSync(src, {recursive: true, force: true});
    } else {
      throw err;
    }
  }
}

function downloadAndExtract(url, installDir, options) {
  var opts = options || {};
  var tmpDir = path.join(path.dirname(installDir), '.tmp-' + path.basename(installDir));
  var archivePath = tmpDir + '.tar.gz';
  var stashDir = installDir + '.updating';
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  }
  if (fs.existsSync(archivePath)) {
    fs.rmSync(archivePath, {force: true});
  }
  if (fs.existsSync(stashDir)) {
    fs.rmSync(stashDir, {recursive: true, force: true});
  }
  return preflightCheck(url)
    .then(function (check) {
      if (!check.ok) {
        var reason = check.reason === 'timeout'
          ? 'Connection timed out — the release may not exist yet.'
          : 'Release asset not found (HTTP ' + check.statusCode + '). Ensure the repository has a published release.';
        throw new Error(reason);
      }
    })
    .then(function () {
      if (opts.estimatedSizeMB) {
        checkDiskSpace(path.dirname(installDir), opts.estimatedSizeMB * 2 * 1048576);
      }
      return download(url, archivePath, MAX_REDIRECTS, opts.onProgress);
    })
    .then(function () {
      extractTarGz(archivePath, tmpDir);
      if (fs.existsSync(installDir)) {
        moveDir(installDir, stashDir);
      }
      try {
        moveDir(tmpDir, installDir);
      } catch (renameErr) {
        try {
          if (fs.existsSync(stashDir) && !fs.existsSync(installDir)) {
            moveDir(stashDir, installDir);
          }
        } catch (_rollback) { /* best effort */ }
        throw renameErr;
      }
      if (fs.existsSync(stashDir)) {
        fs.rmSync(stashDir, {recursive: true, force: true});
      }
      fs.rmSync(archivePath, {force: true});
    })
    .catch(function (err) {
      try { fs.rmSync(archivePath, {force: true}); } catch (_e) { /* best effort */ }
      try { fs.rmSync(tmpDir, {recursive: true, force: true}); } catch (_e) { /* best effort */ }
      try { fs.rmSync(stashDir, {recursive: true, force: true}); } catch (_e) { /* best effort */ }
      throw err;
    });
}

function downloadFile(url, destPath) {
  return download(url, destPath, MAX_REDIRECTS, null);
}

function downloadPrebuiltIndex(template, installDir) {
  var promises = [];
  if (template.indexAssetName) {
    var indexUrl = resolveReleaseAssetUrl(template, 'indexAssetName');
    var indexDest = path.join(installDir, 'project-index.json');
    if (indexUrl && !fs.existsSync(indexDest)) {
      promises.push(downloadFile(indexUrl, indexDest));
    }
  }
  if (template.excerptIndexAssetName) {
    var excerptUrl = resolveReleaseAssetUrl(template, 'excerptIndexAssetName');
    var excerptDest = path.join(installDir, 'project-index-excerpts.json');
    if (excerptUrl && !fs.existsSync(excerptDest)) {
      promises.push(downloadFile(excerptUrl, excerptDest));
    }
  }
  return Promise.all(promises);
}

function downloadAssets(template, installDir, options) {
  var assetName = template.assetsAssetName;
  if (!assetName) { return Promise.resolve({skipped: true}); }
  var url = resolveReleaseAssetUrl(template, 'assetsAssetName');
  if (!url) { return Promise.resolve({skipped: true}); }
  var opts = options || {};
  var archivePath = path.join(path.dirname(installDir), '.tmp-assets-' + path.basename(installDir) + '.tar.gz');
  if (fs.existsSync(archivePath)) {
    fs.rmSync(archivePath, {force: true});
  }
  return preflightCheck(url)
    .then(function (check) {
      if (!check.ok) {
        return {skipped: true, reason: 'preflight-failed', statusCode: check.statusCode};
      }
      if (opts.estimatedSizeMB) {
        checkDiskSpace(path.dirname(installDir), opts.estimatedSizeMB * 2 * 1048576);
      }
      return download(url, archivePath, MAX_REDIRECTS, opts.onProgress)
        .then(function () {
          extractTarGz(archivePath, installDir);
          fs.rmSync(archivePath, {force: true});
          return {skipped: false};
        });
    })
    .catch(function (err) {
      try { fs.rmSync(archivePath, {force: true}); } catch (_e) { /* best effort */ }
      throw err;
    });
}

function loadTemplateIndex(installDir, includeExcerpts) {
  var excerptPath = path.join(installDir, 'project-index-excerpts.json');
  var indexPath = path.join(installDir, 'project-index.json');
  var preferredPath = includeExcerpts && fs.existsSync(excerptPath)
    ? excerptPath
    : indexPath;
  if (!fs.existsSync(preferredPath)) {
    return {ok: false, code: 'catalog_index_missing', indexPath: preferredPath};
  }
  try {
    var index = JSON.parse(fs.readFileSync(preferredPath, 'utf8'));
    return {
      ok: true,
      indexPath: preferredPath,
      includeExcerpts: preferredPath === excerptPath,
      index: index
    };
  } catch (err) {
    return {
      ok: false,
      code: 'catalog_index_invalid',
      indexPath: preferredPath,
      message: err && err.message ? err.message : String(err)
    };
  }
}

function fetchLatestReleaseTag(repo) {
  var url = 'https://api.github.com/repos/' + repo + '/releases/latest';
  return new Promise(function (resolve, reject) {
    var request = https.get(url, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'DendryModStudioCatalog/1'
      }
    }, function (response) {
      if (response.statusCode === 301 || response.statusCode === 302) {
        response.resume();
        resolve(null);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        resolve(null);
        return;
      }
      var body = '';
      response.setEncoding('utf8');
      response.on('data', function (chunk) {
        body += chunk;
        if (body.length > 64 * 1024) {
          request.destroy();
        }
      });
      response.on('end', function () {
        try {
          var data = JSON.parse(body);
          resolve({
            tagName: data.tag_name || '',
            publishedAt: data.published_at || '',
            name: data.name || ''
          });
        } catch (_err) {
          resolve(null);
        }
      });
    });
    request.setTimeout(RELEASE_CHECK_TIMEOUT_MS, function () {
      request.destroy();
      resolve(null);
    });
    request.on('error', function () { resolve(null); });
  });
}

function checkUpdateAvailable(templatesRoot, template) {
  var installDir = templateInstallDir(templatesRoot, template.id);
  var marker = readMarker(installDir);
  if (!marker) {
    return Promise.resolve({updateAvailable: false});
  }
  return fetchLatestReleaseTag(template.repo).then(function (release) {
    if (!release || !release.tagName) {
      return {updateAvailable: false, reason: 'could-not-check'};
    }
    var localTag = marker.releaseTag || '';
    var localInstalledAt = marker.installedAt || '';
    var remotePublishedAt = release.publishedAt || '';
    var tagChanged = localTag && localTag !== 'latest' && release.tagName !== localTag;
    var newerPublish = false;
    if (remotePublishedAt && localInstalledAt) {
      var remoteMs = new Date(remotePublishedAt).getTime();
      var localMs = new Date(localInstalledAt).getTime();
      newerPublish = remoteMs > localMs && !isNaN(remoteMs) && !isNaN(localMs);
    }
    return {
      updateAvailable: tagChanged || newerPublish,
      localTag: localTag,
      remoteTag: release.tagName,
      remotePublishedAt: remotePublishedAt,
      localInstalledAt: localInstalledAt
    };
  }).catch(function () {
    return {updateAvailable: false, reason: 'check-failed'};
  });
}

function removeTemplate(installDir) {
  if (!fs.existsSync(installDir)) {
    return {ok: true, message: 'Template was not installed.'};
  }
  var marker = readMarker(installDir);
  if (!marker) {
    return {ok: false, message: 'Directory does not appear to be a catalog template.'};
  }
  fs.rmSync(installDir, {recursive: true, force: true});
  return {ok: true, message: 'Template removed.'};
}

function snapshotSourceFiles(installDir) {
  var sourceDir = path.join(installDir, 'source');
  if (!fs.existsSync(sourceDir)) { return []; }
  var snapshot = [];
  (function walk(dir) {
    var entries;
    try { entries = fs.readdirSync(dir, {withFileTypes: true}); } catch (_e) { return; }
    for (var i = 0; i < entries.length; i++) {
      var full = path.join(dir, entries[i].name);
      if (entries[i].isDirectory()) { walk(full); }
      else if (entries[i].isFile()) {
        try {
          var stat = fs.statSync(full);
          var content = fs.readFileSync(full);
          var hash = crypto.createHash('sha256').update(content).digest('hex');
          snapshot.push({
            rel: path.relative(installDir, full).replace(/\\/g, '/'),
            size: stat.size,
            mtimeMs: Math.round(stat.mtimeMs),
            sha256: hash
          });
        } catch (_e) { /* skip unreadable */ }
      }
    }
  })(sourceDir);
  return snapshot;
}

function detectLocalEdits(installDir) {
  var marker = readMarker(installDir);
  if (!marker || !Array.isArray(marker.fileSnapshot)) {
    return {hasEdits: false, reason: 'no-snapshot'};
  }
  var snapshotMap = {};
  var snap = marker.fileSnapshot;
  for (var i = 0; i < snap.length; i++) { snapshotMap[snap[i].rel] = snap[i]; }
  var current = snapshotSourceFiles(installDir);
  var currentMap = {};
  for (var j = 0; j < current.length; j++) { currentMap[current[j].rel] = current[j]; }
  var added = [];
  var modified = [];
  var removed = [];
  var rel;
  for (rel in currentMap) {
    if (!snapshotMap[rel]) {
      added.push(rel);
    } else if (snapshotMap[rel].sha256
      ? currentMap[rel].sha256 !== snapshotMap[rel].sha256
      : (currentMap[rel].size !== snapshotMap[rel].size ||
         currentMap[rel].mtimeMs !== snapshotMap[rel].mtimeMs)) {
      modified.push(rel);
    }
  }
  for (rel in snapshotMap) {
    if (!currentMap[rel]) { removed.push(rel); }
  }
  var hasEdits = added.length > 0 || modified.length > 0 || removed.length > 0;
  return {
    hasEdits: hasEdits,
    added: added,
    modified: modified,
    removed: removed,
    summary: hasEdits
      ? (modified.length + ' modified, ' + added.length + ' added, ' + removed.length + ' removed')
      : 'no changes'
  };
}

function backupModifiedFiles(installDir, edits) {
  if (!edits || !edits.hasEdits) { return {ok: true, backupDir: ''}; }
  var id = path.basename(installDir);
  var ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  var backupsRoot = path.join(path.dirname(installDir), '.backups');
  var backupDir = path.join(backupsRoot, id + '-' + ts);
  fs.mkdirSync(backupDir, {recursive: true});
  var files = (edits.modified || []).concat(edits.added || []);
  var copied = 0;
  for (var i = 0; i < files.length; i++) {
    var src = path.join(installDir, files[i]);
    var dest = path.join(backupDir, files[i]);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dest), {recursive: true});
      fs.copyFileSync(src, dest);
      copied++;
    }
  }
  return {ok: true, backupDir: backupDir, fileCount: copied};
}

module.exports = {
  CATALOG_MARKER: CATALOG_MARKER,
  loadBundledCatalog: loadBundledCatalog,
  validateCatalog: validateCatalog,
  evaluateCatalog: evaluateCatalog,
  resolveReleaseAssetUrl: resolveReleaseAssetUrl,
  templateInstallDir: templateInstallDir,
  checkTemplateStatus: checkTemplateStatus,
  downloadAndExtract: downloadAndExtract,
  downloadPrebuiltIndex: downloadPrebuiltIndex,
  downloadAssets: downloadAssets,
  loadTemplateIndex: loadTemplateIndex,
  removeTemplate: removeTemplate,
  readMarker: readMarker,
  writeMarker: writeMarker,
  compareVersions: compareVersions,
  resolveLocalizedText: resolveLocalizedText,
  fetchLatestReleaseTag: fetchLatestReleaseTag,
  checkUpdateAvailable: checkUpdateAvailable,
  preflightCheck: preflightCheck,
  snapshotSourceFiles: snapshotSourceFiles,
  detectLocalEdits: detectLocalEdits,
  backupModifiedFiles: backupModifiedFiles,
  checkDiskSpace: checkDiskSpace
};
