'use strict';

/**
 * Object play-test (real engine) model.
 *
 * Phase 2 of the Object Editor play-test: instead of the in-browser
 * approximate simulator (object_play_simulator_model.js), this drives the real
 * vendored DendryEngine so authors see true engine semantics -- full action
 * language, qdisplays, choice priority/filtering, real cross-scene traversal,
 * decks/cards with reproducible randomness, and faithful text-effect rendering
 * via the engine's own content->HTML converter.
 *
 * This module is NODE-ONLY (it requires the vendored dendrynexus runtime), so
 * it is never loaded into the browser bundle. The desktop layer exposes it to
 * the viewer over IPC; the viewer holds only the small exportable `state` and
 * renders the returned `view`.
 *
 * Design: stateless replay. Each interaction reconstructs an engine from the
 * compiled `game` plus an exportable `state`, applies one action, and returns
 * the next `view` + `state`. No long-lived engine session lives in the host, so
 * the behaviour is deterministic and unit-testable as a pure function.
 */

let compiler = null;
let DendryEngine = null;
let contentToHTML = null;
try {
  compiler = require('dendrynexus/lib/parsers/compiler');
  DendryEngine = require('dendrynexus/lib/engine').DendryEngine;
  contentToHTML = require('dendrynexus/lib/ui/content/html');
} catch (err) {
  // dendrynexus runtime unavailable; isSupported() reports false and callers
  // fall back to the approximate in-browser simulator.
  compiler = compiler || null;
  DendryEngine = DendryEngine || null;
  contentToHTML = contentToHTML || null;
}

// A fixed seed keeps a play-test reproducible across start/advance replays so
// the same clicks always yield the same outcome. Randomness variety can be a
// later affordance (re-roll button feeding different seeds).
const DEFAULT_SEED = ['dendry-mod-studio-playtest'];

function isSupported() {
  return !!(compiler && DendryEngine && contentToHTML);
}

function safeConvertLine(value) {
  if (value === undefined || value === null) {
    return '';
  }
  try {
    return contentToHTML.convertLine(value);
  } catch (err) {
    return String(value);
  }
}

function safeConvertParagraphs(paragraphs) {
  try {
    return contentToHTML.convert(paragraphs);
  } catch (err) {
    return '';
  }
}

function coerceValue(value) {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }
  if (/^[-+]?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return value;
}

function cloneState(state) {
  if (!state) {
    return null;
  }
  try {
    return JSON.parse(JSON.stringify(state));
  } catch (err) {
    return null;
  }
}

/**
 * A capturing UserInterface. The engine pushes display calls here; we collect
 * just enough to render the play panel. Using a plain object with a noop
 * default keeps us resilient to engine UI calls we do not specialise.
 */
function createCapture() {
  const view = {
    sceneId: null,
    title: null,
    contentHtml: '',
    choices: [],
    gameOver: false,
    bg: null,
    sprites: null,
    spriteStyles: null,
    faceImage: null,
    cardImage: null,
    contentImages: null,
    signals: [],
    hand: null,
    decks: null,
    qualities: {}
  };
  let pendingContent = [];

  function resetTurn() {
    pendingContent = [];
    view.choices = [];
    view.signals = [];
  }

  const ui = {
    beginGame: function () {},
    beginOutput: function () {
      // A goToScene begins here; drop content captured from a prior turn so the
      // finalised view holds only the latest scene's freshly rendered output.
      pendingContent = [];
    },
    endOutput: function () {},
    newPage: function () {
      pendingContent = [];
    },
    displayContent: function (paragraphs) {
      if (paragraphs === undefined || paragraphs === null) {
        return;
      }
      pendingContent.push(safeConvertParagraphs(paragraphs));
    },
    displayChoices: function (choices) {
      view.choices = (choices || []).map(function (choice, index) {
        return {
          index: index,
          id: choice && choice.id,
          titleHtml: safeConvertLine(choice && choice.title),
          canChoose: !choice || choice.canChoose !== false,
          subtitle: choice && choice.subtitle ? safeConvertLine(choice.subtitle) : null
        };
      });
    },
    removeChoices: function () {
      view.choices = [];
    },
    displayGameOver: function () {
      view.gameOver = true;
    },
    setStyle: function () {},
    setBg: function (image) {
      view.bg = image || null;
    },
    setSprites: function (data) {
      // The engine passes an array of [location, image] pairs, or the strings
      // 'none'/'clear' to drop all sprites. Normalise to a plain {location,
      // image} list (clone-safe); the host later inlines each image, the
      // renderer places it in its corner.
      if (!data || data === 'none' || data === 'clear') {
        view.sprites = [];
        return;
      }
      view.sprites = (Array.isArray(data) ? data : [])
        .map(function (entry) {
          if (Array.isArray(entry)) {
            return {location: entry[0], image: entry[1]};
          }
          if (entry && typeof entry === 'object') {
            return {location: entry.location, image: entry.image || entry.img || entry.src};
          }
          return null;
        })
        .filter(function (sprite) {
          return sprite && sprite.location && typeof sprite.image === 'string';
        });
    },
    setSpriteStyle: function (location, style) {
      if (!location) {
        return;
      }
      view.spriteStyles = view.spriteStyles || {};
      view.spriteStyles[String(location)] = style;
    },
    signal: function (data) {
      if (data) {
        view.signals.push(data);
      }
    },
    audio: function () {},
    displayDecks: function (decks) {
      view.decks = Array.isArray(decks)
        ? decks.map(function (deck) {
            return {id: deck && deck.id, canChoose: !deck || deck.canChoose !== false};
          })
        : null;
    },
    displayHand: function (hand, maxCards) {
      view.hand = {count: Array.isArray(hand) ? hand.length : 0, maxCards: maxCards};
    },
    displayPinnedCards: function () {}
  };

  function finalize() {
    view.contentHtml = pendingContent.join('\n');
    return view;
  }

  return {ui: ui, view: view, finalize: finalize, resetTurn: resetTurn};
}

function snapshotQualities(engine) {
  const out = {};
  const qualities = engine && engine.state && engine.state.qualities;
  if (qualities) {
    for (const key in qualities) {
      out[key] = qualities[key];
    }
  }
  return out;
}

function applyStartState(engine, startState) {
  if (!startState || typeof startState !== 'object') {
    return;
  }
  Object.keys(startState).forEach(function (key) {
    const value = coerceValue(startState[key]);
    if (value === undefined) {
      return;
    }
    // Assigning through state.qualities runs the engine's own setter, so
    // min/max clamping and isValid predicates apply exactly as in play.
    engine.state.qualities[key] = value;
  });
}

// Some games attach a scene illustration imperatively -- e.g. an `on-display`
// `{! ... image.src = "img/foo.jpg" ... !}` block that builds an <img> in the
// live page DOM. That code cannot run in the headless play-test (no `document`),
// so the engine swallows it and the picture never appears, even though the real
// runtime shows it. We cannot run the code, but we can READ it: scan the scene's
// compiled action sources for image-path string literals so the host can inline
// them and the panel can show them with the prose.

function collectActionSources(action, out) {
  if (!action) {
    return;
  }
  if (typeof action === 'function') {
    out.push(action.toString());
  } else if (Array.isArray(action)) {
    action.forEach(function (entry) {
      collectActionSources(entry, out);
    });
  } else if (typeof action === 'object') {
    Object.keys(action).forEach(function (key) {
      if (typeof action[key] === 'function') {
        out.push(action[key].toString());
      }
    });
  }
}

function extractActionImageRefs(scene) {
  const sources = [];
  collectActionSources(scene && scene.onDisplay, sources);
  collectActionSources(scene && scene.onArrival, sources);
  if (!sources.length) {
    return [];
  }
  const joined = sources.join('\n');
  // Local (not module-level) so its global-flag lastIndex can never leak between
  // calls -- a fresh regex per scan keeps extraction stateless.
  const imageRefRe = /["']([^"'\s]+\.(?:png|jpe?g|gif|webp|svg|bmp|avif))["']/gi;
  const refs = [];
  const seen = {};
  let match;
  while ((match = imageRefRe.exec(joined)) !== null) {
    if (!seen[match[1]]) {
      seen[match[1]] = true;
      refs.push(match[1]);
    }
  }
  return refs;
}

function finishTurn(capture, engine) {
  const view = capture.finalize();
  const scene = (engine.game.scenes && engine.game.scenes[engine.state.sceneId]) || {};
  view.sceneId = engine.state.sceneId;
  // Keep only a plain-string title. A styled/conditional title compiles to a
  // content structure carrying predicate functions, which would later break the
  // structured-clone IPC hop; the scene body still renders via contentHtml.
  view.title = typeof scene.title === 'string' ? scene.title : null;
  // Per-scene portrait / card art. These are plain string refs on the scene
  // (relative asset paths); the host inlines them to data URIs before the view
  // crosses IPC, the renderer shows them beside the content.
  view.faceImage = typeof scene.faceImage === 'string' ? scene.faceImage : null;
  view.cardImage = typeof scene.cardImage === 'string' ? scene.cardImage : null;
  // Pictures injected by display/arrival code (read statically, never executed).
  const codeImages = extractActionImageRefs(scene);
  view.contentImages = codeImages.length ? codeImages : null;
  view.gameOver = engine.isGameOver();
  view.qualities = snapshotQualities(engine);
  return {ok: true, view: view, state: cloneState(engine.getExportableState())};
}

/**
 * Compile an array of {name, contents} .dry sources into a runnable game.
 * Returns a Promise so callers can await the async compiler.
 */
function compileGameFromDryFiles(dryFiles) {
  return new Promise(function (resolve, reject) {
    if (!isSupported()) {
      reject(new Error('dendrynexus runtime is not available'));
      return;
    }
    if (!Array.isArray(dryFiles) || dryFiles.length === 0) {
      reject(new Error('no .dry sources provided'));
      return;
    }
    try {
      compiler.compileGame(dryFiles, function (err, game) {
        if (err) {
          reject(err);
        } else {
          resolve(game);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Overlay edited file contents onto the on-disk source set. This is how
 * "reflect unsaved edits" works: the host passes the editor's current .dry text
 * for the touched file(s), replacing (or adding) those entries before compile.
 */
function applyFileOverrides(dryFiles, overrides) {
  const byName = {};
  (dryFiles || []).forEach(function (file) {
    if (file && file.name != null) {
      byName[file.name] = {name: file.name, contents: file.contents};
    }
  });
  if (overrides && typeof overrides === 'object') {
    Object.keys(overrides).forEach(function (name) {
      byName[name] = {name: name, contents: overrides[name]};
    });
  }
  return Object.keys(byName).map(function (name) {
    return byName[name];
  });
}

/**
 * Begin a play-test. Initialises a fresh game (running the root scene once so
 * qualities take their initial values), applies the author's starting-state
 * overrides, then jumps to the edited object's scene and renders it.
 */
function start(options) {
  options = options || {};
  if (!isSupported()) {
    return {ok: false, error: 'unsupported'};
  }
  const game = options.game;
  if (!game || !game.scenes) {
    return {ok: false, error: 'no-game'};
  }
  const entrySceneId = options.entrySceneId || null;
  const seed = Array.isArray(options.seed) && options.seed.length ? options.seed : DEFAULT_SEED;
  if (entrySceneId && !game.scenes[entrySceneId]) {
    return {ok: false, error: 'unknown-scene', sceneId: entrySceneId};
  }
  const capture = createCapture();
  const engine = new DendryEngine(capture.ui, game);
  try {
    engine.beginGame(seed.slice());
    applyStartState(engine, options.startState);
    if (entrySceneId) {
      // Always re-arrive at the requested scene so starting-state overrides are
      // in place when its on-arrival actions run.
      engine.goToScene(entrySceneId);
    }
  } catch (err) {
    return {ok: false, error: 'engine-error', message: String((err && err.message) || err)};
  }
  return finishTurn(capture, engine);
}

/**
 * Advance a play-test by committing one choice. Reconstructs the engine from
 * the exportable state, validates the choice, applies it, and returns the next
 * view + state.
 */
function advance(options) {
  options = options || {};
  if (!isSupported()) {
    return {ok: false, error: 'unsupported'};
  }
  const game = options.game;
  if (!game || !game.scenes) {
    return {ok: false, error: 'no-game'};
  }
  const inState = cloneState(options.state);
  if (!inState) {
    return {ok: false, error: 'no-state'};
  }
  const choiceIndex = options.choiceIndex;
  const capture = createCapture();
  const engine = new DendryEngine(capture.ui, game);
  try {
    engine.setState(inState);
    const choices = engine.getCurrentChoices() || [];
    if (typeof choiceIndex !== 'number' || choiceIndex < 0 || choiceIndex >= choices.length) {
      return {ok: false, error: 'bad-choice-index', available: choices.length};
    }
    if (choices[choiceIndex] && choices[choiceIndex].canChoose === false) {
      return {ok: false, error: 'choice-unavailable', choiceIndex: choiceIndex};
    }
    // Discard the restored (pre-choice) page so the finalised view holds only
    // the scene we land on after committing the choice.
    capture.resetTurn();
    engine.choose(choiceIndex);
  } catch (err) {
    return {ok: false, error: 'engine-error', message: String((err && err.message) || err)};
  }
  return finishTurn(capture, engine);
}

module.exports = {
  isSupported: isSupported,
  compileGameFromDryFiles: compileGameFromDryFiles,
  applyFileOverrides: applyFileOverrides,
  start: start,
  advance: advance,
  // Exposed for checks.
  _createCapture: createCapture,
  DEFAULT_SEED: DEFAULT_SEED
};
