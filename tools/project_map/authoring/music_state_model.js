// @ts-check
/**
 * Music state propagation model.
 *
 * Computes inherited music state for each scene by forward-traversing the
 * route graph.  Scenes that set `set-music:` or use `audio: … clear`
 * produce state boundaries.  State propagates along edges using BFS; when
 * a scene is reachable from multiple paths with different music, it is
 * flagged as ambiguous.
 */
(function initProjectMapMusicStateModel(global) {
  'use strict';

  /**
   * @param {unknown} projectIndex
   * @returns {Map<string, MusicStateEntry>}
   *
   * @typedef {{
   *   activeTrack: {name: string, path: string, directive: string, modifiers: string[]} | null,
   *   source: 'local' | 'inherited' | 'none',
   *   inheritedFrom: string,
   *   ambiguous: boolean,
   *   cleared: boolean
   * }} MusicStateEntry
   */
  function computeMusicState(projectIndex) {
    var index = isObject(projectIndex) ? projectIndex : {};
    var scenes = ensureArray(index.scenes);
    // Build a set of known scene IDs for robust node-to-scene resolution
    var sceneIdSet = new Set();
    for (var si = 0; si < scenes.length; si++) {
      var sid = String(scenes[si] && scenes[si].id || '');
      if (sid) { sceneIdSet.add(sid); }
    }
    var resolveNode = function (nodeId) { return resolveSceneId(nodeId, sceneIdSet); };
    var graph = buildForwardGraph(ensureArray(index.edges), resolveNode);
    var localMusic = buildLocalMusicMap(scenes);
    var result = new Map();

    // Identify entry-point scenes: those that have no incoming edges or are
    // explicitly marked as root/entry.
    var incomingSet = new Set();
    ensureArray(index.edges).forEach(function (edge) {
      if (edge && edge.to) { incomingSet.add(resolveNode(String(edge.to))); }
    });
    var entryScenes = scenes.filter(function (scene) {
      var id = String(scene && scene.id || '');
      return id && !incomingSet.has(id);
    });
    // If no clear entry points, fall back to all scenes with music directives
    if (!entryScenes.length) {
      entryScenes = scenes.filter(function (scene) {
        return localMusic.has(String(scene && scene.id || ''));
      });
    }

    // BFS from every entry scene
    var queue = [];
    entryScenes.forEach(function (scene) {
      var id = String(scene && scene.id || '');
      if (!id) { return; }
      var local = localMusic.get(id) || null;
      var entry = {
        activeTrack: local ? local.track : null,
        source: local ? 'local' : 'none',
        inheritedFrom: '',
        ambiguous: false,
        cleared: local ? local.cleared : false
      };
      result.set(id, entry);
      queue.push(id);
    });

    // Scale iteration limit with graph size to support large games (3000+ scenes)
    var MAX_ITERATIONS = Math.max(10000, scenes.length * 5);
    var iterations = 0;
    while (queue.length && iterations < MAX_ITERATIONS) {
      iterations++;
      var currentId = queue.shift();
      var currentState = result.get(currentId);
      if (!currentState) { continue; }

      var neighbours = graph.get(currentId) || [];
      for (var i = 0; i < neighbours.length; i++) {
        var targetId = resolveSceneId(neighbours[i], sceneIdSet);
        if (!targetId) { continue; }

        var targetLocal = localMusic.get(targetId) || null;
        var inherited;

        if (targetLocal) {
          // Scene sets its own music — local takes priority
          inherited = {
            activeTrack: targetLocal.track,
            source: 'local',
            inheritedFrom: '',
            ambiguous: false,
            cleared: targetLocal.cleared
          };
        } else if (currentState.cleared) {
          // Upstream cleared music — silence propagates
          inherited = {
            activeTrack: null,
            source: 'inherited',
            inheritedFrom: currentId,
            ambiguous: false,
            cleared: true
          };
        } else {
          // Inherit upstream's active track
          inherited = {
            activeTrack: currentState.activeTrack,
            source: currentState.activeTrack ? 'inherited' : 'none',
            inheritedFrom: currentState.source === 'local' ? currentId : currentState.inheritedFrom,
            ambiguous: false,
            cleared: false
          };
        }

        var existing = result.get(targetId);
        if (existing) {
          // Already visited — check for ambiguity
          if (!existing.ambiguous && !musicStateEqual(existing, inherited)) {
            existing.ambiguous = true;
          }
          continue;
        }
        result.set(targetId, inherited);
        queue.push(targetId);
      }
    }

    return result;
  }

  /**
   * Build a forward adjacency map from scene-level edges.
   * Keyed by scene ID (not section), values are arrays of target scene IDs.
   */
  function buildForwardGraph(edges, resolveNode) {
    var map = new Map();
    for (var i = 0; i < edges.length; i++) {
      var edge = edges[i];
      if (!edge) { continue; }
      var from = resolveNode(String(edge.from || ''));
      var to = resolveNode(String(edge.to || ''));
      if (!from || !to || from === to) { continue; }
      var list = map.get(from);
      if (!list) {
        list = [];
        map.set(from, list);
      }
      if (list.indexOf(to) < 0) {
        list.push(to);
      }
    }
    return map;
  }

  /**
   * Build a map of scene ID → local music directive info.
   * Tracks the first `set-music` or `audio: … clear` per scene.
   */
  function buildLocalMusicMap(scenes) {
    var map = new Map();
    for (var i = 0; i < scenes.length; i++) {
      var scene = scenes[i];
      var id = String(scene && scene.id || '');
      if (!id) { continue; }
      var refs = ensureArray(scene && scene.assetRefs);
      for (var j = 0; j < refs.length; j++) {
        var ref = refs[j];
        if (!isObject(ref)) { continue; }
        var directive = String(ref.directive || ref.assetDirective || '').trim().toLowerCase();
        if (directive !== 'set-music' && directive !== 'audio') { continue; }
        var modifiers = ensureArray(ref.audioModifiers);
        var hasClear = modifiers.indexOf('clear') >= 0 ||
          modifiers.indexOf('null') >= 0 ||
          modifiers.indexOf('none') >= 0;
        var path = String(ref.path || ref.src || '').trim();
        var parts = path.split(/[\\/]/);
        var name = parts[parts.length - 1] || path;
        if (directive === 'set-music' || hasClear || !map.has(id)) {
          map.set(id, {
            track: hasClear && !path ? null : {
              name: name,
              path: path,
              directive: directive,
              modifiers: modifiers
            },
            cleared: hasClear
          });
        }
        // set-music is the primary music setter — break after first
        if (directive === 'set-music') { break; }
      }
    }
    return map;
  }

  function musicStateEqual(a, b) {
    if (!a || !b) { return false; }
    if (a.cleared !== b.cleared) { return false; }
    if (!a.activeTrack && !b.activeTrack) { return true; }
    if (!a.activeTrack || !b.activeTrack) { return false; }
    return a.activeTrack.path === b.activeTrack.path;
  }

  /**
   * Resolve a graph node ID to a scene-level ID.
   * Edge endpoints can be "sceneId.sectionId". Since scene IDs may themselves
   * contain dots (e.g. "chapters.intro"), we check the known scene ID set
   * for the longest matching prefix before falling back to first-dot split.
   */
  function resolveSceneId(nodeId, sceneIdSet) {
    var text = String(nodeId || '').trim();
    if (!text) { return ''; }
    // Fast path: exact match
    if (sceneIdSet.has(text)) { return text; }
    // Try progressively shorter dot-separated prefixes
    var lastDot = text.lastIndexOf('.');
    while (lastDot > 0) {
      var prefix = text.slice(0, lastDot);
      if (sceneIdSet.has(prefix)) { return prefix; }
      lastDot = prefix.lastIndexOf('.');
    }
    // Fallback: first segment (original naive approach)
    var firstDot = text.indexOf('.');
    return firstDot >= 0 ? text.slice(0, firstDot) : text;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  var api = {
    computeMusicState: computeMusicState
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapMusicStateModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
