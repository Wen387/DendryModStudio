'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');
const {spawnSync} = require('child_process');

const CATALOG_MARKER = '.dendry-studio-catalog-template.json';
const MAX_REDIRECTS = 5;
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
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
  ['description', 'author', 'releaseTag', 'indexAssetName', 'excerptIndexAssetName', 'minStudioVersion'].forEach(function (key) {
    if (entry[key] !== undefined && typeof entry[key] !== 'string') {
      diagnostics.push(prefix + '.' + key + ' must be a string when present');
    }
  });
  if (entry.estimatedSizeMB !== undefined && (typeof entry.estimatedSizeMB !== 'number' || entry.estimatedSizeMB < 0)) {
    diagnostics.push(prefix + '.estimatedSizeMB must be a non-negative number when present');
  }
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

function download(url, dest, redirectsLeft, onProgress) {
  return new Promise(function (resolve, reject) {
    var request = https.get(url, function (response) {
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
      file.on('finish', function () { file.close(resolve); });
      file.on('error', reject);
    });
    request.setTimeout(DOWNLOAD_TIMEOUT_MS, function () {
      request.destroy(new Error('Template download timed out.'));
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

function downloadAndExtract(url, installDir, options) {
  var opts = options || {};
  var tmpDir = path.join(path.dirname(installDir), '.tmp-' + path.basename(installDir));
  var archivePath = tmpDir + '.tar.gz';
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, {recursive: true, force: true});
  }
  if (fs.existsSync(archivePath)) {
    fs.rmSync(archivePath, {force: true});
  }
  return download(url, archivePath, MAX_REDIRECTS, opts.onProgress)
    .then(function () {
      extractTarGz(archivePath, tmpDir);
      if (fs.existsSync(installDir)) {
        fs.rmSync(installDir, {recursive: true, force: true});
      }
      fs.renameSync(tmpDir, installDir);
      fs.rmSync(archivePath, {force: true});
    })
    .catch(function (err) {
      try { fs.rmSync(archivePath, {force: true}); } catch (_e) { /* best effort */ }
      try { fs.rmSync(tmpDir, {recursive: true, force: true}); } catch (_e) { /* best effort */ }
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
    var newerPublish = remotePublishedAt && localInstalledAt && remotePublishedAt > localInstalledAt;
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
  loadTemplateIndex: loadTemplateIndex,
  removeTemplate: removeTemplate,
  readMarker: readMarker,
  writeMarker: writeMarker,
  compareVersions: compareVersions,
  resolveLocalizedText: resolveLocalizedText,
  fetchLatestReleaseTag: fetchLatestReleaseTag,
  checkUpdateAvailable: checkUpdateAvailable
};
