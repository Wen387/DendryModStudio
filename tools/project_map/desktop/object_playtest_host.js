'use strict';

/**
 * Object play-test host (desktop/node side).
 *
 * Bridges the IPC layer to the real-engine play-test model
 * (../object_playtest_engine_model.js). Responsibilities:
 *
 *  - Read the active project's .dry sources.
 *  - Reflect UNSAVED edits: when the viewer passes the Object Editor's pending
 *    install plan, apply it with the real install-plan applier against a
 *    throwaway copy of `source/` so the compiled game matches exactly what the
 *    author is editing -- without writing anything back to their project.
 *  - Compile the game (cached by a content signature so repeated interactions
 *    in one session do not recompile).
 *  - Dispatch start/advance to the stateless engine model.
 *
 * The play STATE lives on the client; the host only caches the compiled game
 * keyed by a token so `advance` need not resend or recompile sources.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const model = require('../object_playtest_engine_model.js');

let installPlan = null;
try {
  installPlan = require('../authoring/install_plan.js');
} catch (err) {
  installPlan = null;
}

// Small LRU of compiled games keyed by source signature.
const GAME_CACHE = new Map();
const GAME_CACHE_MAX = 8;

function isSupported() {
  return model.isSupported();
}

function sourceDir(projectRoot) {
  return path.join(projectRoot, 'source');
}

function cacheGet(token) {
  if (!token || !GAME_CACHE.has(token)) {
    return null;
  }
  const game = GAME_CACHE.get(token);
  // refresh recency
  GAME_CACHE.delete(token);
  GAME_CACHE.set(token, game);
  return game;
}

function cachePut(token, game) {
  GAME_CACHE.set(token, game);
  while (GAME_CACHE.size > GAME_CACHE_MAX) {
    const oldest = GAME_CACHE.keys().next().value;
    GAME_CACHE.delete(oldest);
  }
}

function collectDryFiles(rootSourceDir, current, out) {
  const dir = current || rootSourceDir;
  const result = out || [];
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    return result;
  }
  entries.forEach((name) => {
    const full = path.join(dir, name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch (err) {
      return;
    }
    if (stat.isDirectory()) {
      collectDryFiles(rootSourceDir, full, result);
    } else if (/\.dry$/.test(name)) {
      result.push({
        name: path.relative(rootSourceDir, full).replace(/\\/g, '/'),
        contents: fs.readFileSync(full, 'utf8')
      });
    }
  });
  return result;
}

function signatureOf(dryFiles) {
  const hash = crypto.createHash('sha1');
  dryFiles
    .slice()
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .forEach((file) => {
      hash.update(file.name);
      hash.update('\0');
      hash.update(file.contents || '');
      hash.update('\0');
    });
  return hash.digest('hex');
}

function copyDryTree(srcDir, dstDir) {
  fs.mkdirSync(dstDir, {recursive: true});
  let entries;
  try {
    entries = fs.readdirSync(srcDir);
  } catch (err) {
    return;
  }
  entries.forEach((name) => {
    const src = path.join(srcDir, name);
    const dst = path.join(dstDir, name);
    let stat;
    try {
      stat = fs.statSync(src);
    } catch (err) {
      return;
    }
    if (stat.isDirectory()) {
      copyDryTree(src, dst);
    } else if (/\.dry$/.test(name)) {
      fs.copyFileSync(src, dst);
    }
  });
}

function removeTree(target) {
  try {
    fs.rmSync(target, {recursive: true, force: true});
  } catch (err) {
    /* best effort */
  }
}

function planHasOperations(plan) {
  return !!(plan && Array.isArray(plan.operations) && plan.operations.length);
}

/**
 * Resolve the effective .dry sources for compilation, applying the pending
 * install plan (unsaved edits) against a throwaway copy when present.
 */
function resolveDryFiles(projectRoot, plan) {
  if (planHasOperations(plan) && installPlan && installPlan.applyInstallPlan) {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-playtest-'));
    try {
      copyDryTree(sourceDir(projectRoot), path.join(tempRoot, 'source'));
      let applyResult = null;
      try {
        applyResult = installPlan.applyInstallPlan(plan, {
          projectRoot: tempRoot,
          dryRun: false,
          allowAdvanced: true
        });
      } catch (err) {
        applyResult = {ok: false, message: String((err && err.message) || err)};
      }
      if (applyResult && applyResult.ok) {
        return {dryFiles: collectDryFiles(path.join(tempRoot, 'source')), edited: true};
      }
      // The pending edit could not be applied cleanly (e.g. anchors moved):
      // fall back to the saved on-disk source so the play-test still runs,
      // flagged so the UI can note the unsaved edit was not reflected.
      return {dryFiles: collectDryFiles(sourceDir(projectRoot)), edited: false, editFailed: true};
    } finally {
      removeTree(tempRoot);
    }
  }
  return {dryFiles: collectDryFiles(sourceDir(projectRoot)), edited: false};
}

/**
 * The scenes worth offering as play-test entry points. The compiled game also
 * holds generated option sub-scenes (dotted ids like `event.choice`) and the
 * engine's untitled navigation specials (jumpScene, returnScene, ...); neither
 * is a meaningful place to begin a play-test. We surface only authored
 * top-level scenes -- no dot in the id and a real title -- sorted for a stable
 * picker. The viewer still guarantees the edited object's own scene is
 * selectable even if it falls outside this set.
 */
function listScenes(game) {
  const scenes = (game && game.scenes) || {};
  return Object.keys(scenes)
    .filter((id) => id.indexOf('.') === -1 && scenes[id] && scenes[id].title)
    .sort()
    .map((id) => ({id: id, title: typeof scenes[id].title === 'string' ? scenes[id].title : null}));
}

/**
 * Make a result safe to cross the Electron IPC boundary, which serialises with
 * structured clone. Compiled scene content can carry predicate FUNCTIONS (e.g.
 * conditional/styled titles), and structured clone rejects those outright
 * ("An object could not be cloned"). A JSON round-trip drops anything that is
 * not plain serialisable data, so the response always crosses cleanly.
 */
function toCloneable(value) {
  try {
    return JSON.parse(JSON.stringify(value === undefined ? null : value));
  } catch (err) {
    return {ok: false, error: 'serialize-error', message: String((err && err.message) || err)};
  }
}

// ---- art asset inlining ---------------------------------------------------
// The play-test renders inside the main file:// window, so a scene's relative
// image refs (e.g. `img/events/foo.svg`) cannot be loaded as URLs the way the
// full-game http preview can. Instead the host reads the referenced file from
// the project's source/ tree and hands the renderer a self-contained data: URI.
// Audio is intentionally NOT inlined here (base64 music would bloat the IPC
// payload); that arrives in a later phase via a streamed origin.

const ASSET_MAX_INLINE_BYTES = 4 * 1024 * 1024;

const IMAGE_MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif'
};

// Pull a bare path out of a CSS `url("...")` wrapper, else return the ref as-is.
function assetPathFromRef(ref) {
  const match = /^\s*url\(\s*["']?([^"')]+)["']?\s*\)\s*$/i.exec(String(ref || ''));
  return (match ? match[1] : String(ref || '')).trim();
}

function looksLikeImageRef(ref) {
  const lower = assetPathFromRef(ref).toLowerCase();
  return Object.keys(IMAGE_MIME_BY_EXT).some((ext) => lower.endsWith(ext));
}

// The roots a scene's relative asset ref may resolve against, in priority order.
// Refs in .dry are written relative to the GAME HTML root (e.g.
// `img/portraits/x.jpg`); the actual file may live under the editable `source/`
// tree OR only in the built `out/html/` output. The runtime preview serves both
// (it copies source/img over a copy of out/html), so the play-test must resolve
// against the same roots -- otherwise art that exists only in the build is
// invisible here even though the real runtime shows it. source/ wins ties so the
// editable copy is preferred over a possibly-stale build.
function assetRoots(projectRoot) {
  return [sourceDir(projectRoot), path.join(projectRoot, 'out', 'html')];
}

// Resolve a relative asset ref to an absolute, EXISTING file path inside one of
// the allowed roots. Returns null for empty refs, absolute URLs/data: refs, any
// path that escapes every root (traversal guard), or refs that match no file.
function resolveSourceAsset(projectRoot, ref) {
  const rel = assetPathFromRef(ref);
  if (!rel || /^[a-z][a-z0-9+.-]*:/i.test(rel) || rel.charAt(0) === '/') {
    return null;
  }
  const roots = assetRoots(projectRoot);
  for (let i = 0; i < roots.length; i += 1) {
    const base = path.resolve(roots[i]);
    const full = path.resolve(base, rel);
    if (full !== base && !full.startsWith(base + path.sep)) {
      continue; // escapes this root -- try the next
    }
    try {
      if (fs.statSync(full).isFile()) {
        return full;
      }
    } catch (err) {
      /* not present under this root; fall through to the next */
    }
  }
  return null;
}

// Turn a local image ref into a data: URI, or null when it cannot/should not be
// inlined (missing, oversized, unknown type, or outside the source tree).
function inlineImageRef(projectRoot, ref) {
  const full = resolveSourceAsset(projectRoot, ref);
  if (!full) {
    return null;
  }
  const mime = IMAGE_MIME_BY_EXT[path.extname(full).toLowerCase()];
  if (!mime) {
    return null;
  }
  let stat;
  try {
    stat = fs.statSync(full);
  } catch (err) {
    return null;
  }
  if (!stat.isFile() || stat.size > ASSET_MAX_INLINE_BYTES) {
    return null;
  }
  try {
    return 'data:' + mime + ';base64,' + fs.readFileSync(full).toString('base64');
  } catch (err) {
    return null;
  }
}

// Rewrite a captured view's image refs to data URIs in place. A background that
// is a CSS colour/gradient/keyword (not an image path) passes through untouched
// for the renderer to apply directly.
function resolveViewAssets(view, projectRoot) {
  if (!view || typeof view !== 'object' || !projectRoot) {
    return view;
  }
  if (typeof view.bg === 'string' && looksLikeImageRef(view.bg)) {
    view.bg = inlineImageRef(projectRoot, view.bg);
  }
  if (typeof view.faceImage === 'string') {
    view.faceImage = inlineImageRef(projectRoot, view.faceImage);
  }
  if (typeof view.cardImage === 'string') {
    view.cardImage = inlineImageRef(projectRoot, view.cardImage);
  }
  if (Array.isArray(view.sprites)) {
    view.sprites = view.sprites
      .map((sprite) => {
        const dataUri = sprite && inlineImageRef(projectRoot, sprite.image);
        return dataUri ? {location: sprite.location, image: dataUri} : null;
      })
      .filter(Boolean);
  }
  // Pictures referenced by display/arrival code (the model extracted the refs).
  if (Array.isArray(view.contentImages)) {
    view.contentImages = view.contentImages
      .map((ref) => inlineImageRef(projectRoot, ref))
      .filter(Boolean);
    if (!view.contentImages.length) {
      view.contentImages = null;
    }
  }
  // A raw <img src="img/..."> embedded directly in scene prose: rewrite its src
  // to a data URI too, so it loads in the file:// window like the declared art.
  if (typeof view.contentHtml === 'string' && view.contentHtml.indexOf('<img') !== -1) {
    view.contentHtml = view.contentHtml.replace(
      /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']*)\2/gi,
      (full, pre, quote, src) => {
        const dataUri = inlineImageRef(projectRoot, src);
        return dataUri ? pre + quote + dataUri + quote : full;
      }
    );
  }
  return view;
}

async function prepareGame(projectRoot, plan) {
  const resolved = resolveDryFiles(projectRoot, plan);
  if (!resolved.dryFiles || !resolved.dryFiles.length) {
    return {ok: false, error: 'no-source'};
  }
  const token = signatureOf(resolved.dryFiles);
  let game = cacheGet(token);
  if (!game) {
    game = await model.compileGameFromDryFiles(resolved.dryFiles);
    cachePut(token, game);
  }
  return {ok: true, game: game, token: token, edited: resolved.edited, editFailed: resolved.editFailed === true};
}

async function start(options) {
  options = options || {};
  if (!isSupported()) {
    return {ok: false, error: 'unsupported'};
  }
  if (!options.projectRoot) {
    return {ok: false, error: 'no-project'};
  }
  let prepared;
  try {
    prepared = await prepareGame(options.projectRoot, options.plan);
  } catch (err) {
    return {ok: false, error: 'compile-error', message: String((err && err.message) || err)};
  }
  if (!prepared.ok) {
    return prepared;
  }
  const result = model.start({
    game: prepared.game,
    entrySceneId: options.entrySceneId,
    startState: options.startState,
    seed: options.seed
  });
  if (result.ok) {
    result.token = prepared.token;
    result.edited = prepared.edited;
    result.editFailed = prepared.editFailed;
    result.scenes = listScenes(prepared.game);
  }
  return result;
}

async function advance(options) {
  options = options || {};
  if (!isSupported()) {
    return {ok: false, error: 'unsupported'};
  }
  let game = cacheGet(options.token);
  let token = options.token;
  let edited;
  if (!game) {
    // Cache miss (e.g. host restarted): recompile from sources to recover.
    if (!options.projectRoot) {
      return {ok: false, error: 'stale-game'};
    }
    let prepared;
    try {
      prepared = await prepareGame(options.projectRoot, options.plan);
    } catch (err) {
      return {ok: false, error: 'compile-error', message: String((err && err.message) || err)};
    }
    if (!prepared.ok) {
      return prepared;
    }
    game = prepared.game;
    token = prepared.token;
    edited = prepared.edited;
  }
  const result = model.advance({
    game: game,
    state: options.state,
    choiceIndex: options.choiceIndex
  });
  if (result.ok) {
    result.token = token;
    if (edited !== undefined) {
      result.edited = edited;
    }
  }
  return result;
}

/**
 * Single IPC entry point. Dispatches by `action` ('start' | 'advance').
 */
async function handle(options) {
  options = options || {};
  const result = options.action === 'advance' ? await advance(options) : await start(options);
  if (result && result.ok && result.view) {
    // Inline the scene's art (bg / sprites / face·card images) as data URIs so
    // the file:// play-test window can show them. Runs before toCloneable so the
    // data URIs (plain strings) cross IPC normally.
    resolveViewAssets(result.view, options.projectRoot);
  }
  return toCloneable(result);
}

module.exports = {
  isSupported: isSupported,
  handle: handle,
  start: start,
  advance: advance,
  // Exposed for checks.
  collectDryFiles: collectDryFiles,
  signatureOf: signatureOf,
  resolveDryFiles: resolveDryFiles,
  resolveViewAssets: resolveViewAssets,
  _clearCache: function () {
    GAME_CACHE.clear();
  }
};
