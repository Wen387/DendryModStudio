// @ts-check
(function initRuntimePreviewDebugModel(global) {
  'use strict';

  const MODEL_VERSION = '0.1';
  const MAX_STRING_LENGTH = 80;
  const DEFAULT_VARIABLE_LIMIT = 2000;
  const DEFAULT_SCENE_LIMIT = 1000;
  const DEFAULT_LINK_LIMIT = 1000;

  function buildDebugControls(projectIndex, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    return {
      schemaVersion: MODEL_VERSION,
      kind: 'runtime_preview_debug_controls',
      projectName: String(index.project && index.project.name || ''),
      selectedSceneId: String(opts.selectedSceneId || ''),
      variables: buildVariableControls(index, opts),
      scenes: buildSceneControls(index, opts),
      links: buildLinkControls(index, opts.selectedSceneId, opts),
      diagnostics: []
    };
  }

  function buildVariableControls(index, options) {
    const suggestions = variableSuggestionsApi();
    const candidates = suggestions && typeof suggestions.buildVariableCandidates === 'function'
      ? suggestions.buildVariableCandidates(index, options || {})
      : ensureArray(index.variables).map(fallbackVariableCandidate);
    const limit = positiveInteger(options && options.variableLimit, DEFAULT_VARIABLE_LIMIT);
    return candidates
      .map((candidate) => normalizeVariableControl(candidate))
      .filter(Boolean)
      .slice(0, limit);
  }

  function normalizeVariableControl(candidate) {
    const name = String(candidate && candidate.name || '').trim();
    if (!isSafeIdentifier(name)) {
      return null;
    }
    return {
      name,
      label: String(candidate.label || name),
      valueType: inferValueType(name, candidate),
      meaning: String(candidate.meaning || inferMeaning(name)),
      reason: String(candidate.reason || candidate.summary || candidate.meaning || inferMeaning(name)),
      summary: String(candidate.summary || ''),
      sourceHints: ensureArray(candidate.sourceHints).map(String).filter(Boolean).slice(0, 3),
      tags: ensureArray(candidate.tags).map(String).filter(Boolean).slice(0, 6)
    };
  }

  function fallbackVariableCandidate(variable) {
    const name = String(variable && variable.name || '').trim();
    const tags = ensureArray(variable && variable.tags).map(String).filter(Boolean);
    const reads = ensureArray(variable && variable.reads);
    const writes = ensureArray(variable && variable.writes);
    const sourceHints = reads.concat(writes)
      .slice(0, 3)
      .map((source) => source && source.path ? source.path + (source.line ? ':' + source.line : '') : '')
      .filter(Boolean);
    return {
      name,
      label: name,
      tags,
      sourceHints,
      meaning: inferMeaning(name),
      summary: [inferMeaning(name), sourceHints[0] || ''].filter(Boolean).join(' · ')
    };
  }

  function buildSceneControls(index, options) {
    const opts = isObject(options) ? options : {};
    const rows = new Map();
    ensureArray(index.scenes).forEach((scene) => addSceneControl(rows, scene, scene && scene.type));
    ensureArray(index.semantic && index.semantic.events).forEach((scene) => addSceneControl(rows, scene, 'event'));
    ensureArray(index.semantic && index.semantic.news).forEach((scene) => addSceneControl(rows, scene, 'news'));
    ensureArray(index.semantic && index.semantic.newsItems).forEach((scene) => addSceneControl(rows, scene, 'news'));
    ensureArray(index.semantic && index.semantic.cards).forEach((scene) => addSceneControl(rows, scene, 'card'));
    ensureArray(index.semantic && index.semantic.hands).forEach((scene) => addSceneControl(rows, scene, 'hand'));
    ensureArray(index.semantic && index.semantic.decks).forEach((scene) => addSceneControl(rows, scene, 'deck'));
    ensureArray(index.semantic && index.semantic.pinnedCards).forEach((scene) => addSceneControl(rows, scene, 'card'));
    ensureArray(index.semantic && index.semantic.eventPopups).forEach((scene) => addSceneControl(rows, scene, 'event'));
    const limit = positiveInteger(opts.sceneLimit, DEFAULT_SCENE_LIMIT);
    return Array.from(rows.values())
      .sort((a, b) => sceneRank(a) - sceneRank(b) || a.id.localeCompare(b.id))
      .slice(0, limit);
  }

  function addSceneControl(rows, scene, fallbackType) {
    const id = String(scene && scene.id || '').trim();
    if (!id || !isSafeSceneId(id)) {
      return;
    }
    const current = rows.get(id) || {};
    const sourcePath = sourcePathFor(scene) || current.sourcePath || '';
    rows.set(id, {
      id,
      title: String(scene.title || current.title || id),
      type: String(scene.type || current.type || fallbackType || 'scene'),
      sourcePath,
      tags: unique(ensureArray(current.tags).concat(ensureArray(scene.tags).map(String))).slice(0, 6)
    });
  }

  function buildLinkControls(index, selectedSceneId, options) {
    const opts = isObject(options) ? options : {};
    const selected = String(selectedSceneId || '').trim();
    return ensureArray(index.edges)
      .filter((edge) => {
        if (!edge || !edge.from || !edge.to) {
          return false;
        }
        return selected ? String(edge.from) === selected || String(edge.to) === selected : true;
      })
      .map((edge) => ({
        from: String(edge.from || ''),
        to: String(edge.to || ''),
        label: String(edge.label || edge.kind || '')
      }))
      .filter((edge) => isSafeSceneId(edge.from) && isSafeSceneId(edge.to))
      .slice(0, positiveInteger(opts.linkLimit, DEFAULT_LINK_LIMIT));
  }

  function validateVariableCommand(controls, requestedVariables) {
    const byName = new Map(ensureArray(controls && controls.variables).map((item) => [item.name, item]));
    const variables = [];
    const diagnostics = [];
    ensureArray(requestedVariables).forEach((request) => {
      const name = String(request && request.name || '').trim();
      const control = byName.get(name);
      if (!control) {
        diagnostics.push(diagnostic('error', 'runtime_preview_debug.unknown_variable', 'Unknown preview variable: ' + name));
        return;
      }
      const coerced = coerceValue(control, request && request.value);
      if (!coerced.ok) {
        diagnostics.push(coerced.diagnostic);
        return;
      }
      variables.push({name, value: coerced.value, valueType: control.valueType});
    });
    return {
      ok: diagnostics.length === 0,
      type: 'applyVariables',
      variables,
      diagnostics
    };
  }

  function validateJumpCommand(controls, command) {
    const sceneId = String(command && command.sceneId || '').trim();
    const scene = ensureArray(controls && controls.scenes).find((item) => item && item.id === sceneId);
    if (!scene) {
      return {
        ok: false,
        type: 'jumpScene',
        diagnostics: [diagnostic('error', 'runtime_preview_debug.unknown_scene', 'Unknown preview scene: ' + sceneId)]
      };
    }
    return {ok: true, type: 'jumpScene', scene, diagnostics: []};
  }

  function commandHistoryEntry(command, result, options) {
    const now = options && typeof options.now === 'function' ? options.now() : new Date();
    const type = String(command && command.type || 'unknown');
    const entry = {
      schemaVersion: MODEL_VERSION,
      timestamp: now.toISOString(),
      type,
      ok: Boolean(result && result.ok)
    };
    if (type === 'applyVariables' || type === 'applyFocusPreset') {
      entry.variableNames = ensureArray(command.variables).map((item) => String(item && item.name || '')).filter(Boolean);
    }
    if (type === 'jumpScene' || type === 'jumpToScene' || type === 'applyFocusPreset') {
      entry.sceneId = String(command && command.sceneId || (command.scene && command.scene.id) || '');
    }
    return entry;
  }

  function coerceValue(control, value) {
    if (isObject(value) || Array.isArray(value) || typeof value === 'function') {
      return {ok: false, diagnostic: diagnostic('error', 'runtime_preview_debug.invalid_value_type', 'Preview variables only accept string, number, or boolean values.')};
    }
    const valueType = control.valueType || 'string';
    if (valueType === 'booleanNumber') {
      const number = Number(value);
      if (number === 0 || number === 1) {
        return {ok: true, value: number};
      }
      return {ok: false, diagnostic: diagnostic('error', 'runtime_preview_debug.invalid_boolean_number', 'Boolean-like preview variables accept only 0 or 1: ' + control.name)};
    }
    if (valueType === 'number') {
      const number = Number(value);
      if (Number.isFinite(number)) {
        return {ok: true, value: number};
      }
      return {ok: false, diagnostic: diagnostic('error', 'runtime_preview_debug.invalid_number', 'Numeric preview variable needs a finite number: ' + control.name)};
    }
    const text = String(value == null ? '' : value);
    if (text.length > MAX_STRING_LENGTH) {
      return {ok: false, diagnostic: diagnostic('error', 'runtime_preview_debug.string_too_long', 'Preview string is too long: ' + control.name)};
    }
    return {ok: true, value: text};
  }

  function inferValueType(name, candidate) {
    const text = [name].concat(ensureArray(candidate && candidate.tags), [candidate && candidate.meaning]).join(' ').toLowerCase();
    if (/_seen$/.test(name) || /^has_/.test(name) || /^is_/.test(name) || text.includes('flag')) {
      return 'booleanNumber';
    }
    if (text.includes('time') || text.includes('gate') || text.includes('year') || text.includes('month') ||
      text.includes('support') || text.includes('approval') || text.includes('trust') || text.includes('resource') ||
      text.includes('capacity') || text.includes('pressure') || text.includes('score')) {
      return 'number';
    }
    return 'string';
  }

  function inferMeaning(name) {
    const text = String(name || '').toLowerCase();
    if (/_seen$/.test(text) || text.includes('flag')) {
      return 'event flag';
    }
    if (text.includes('year') || text.includes('month') || text.includes('date')) {
      return 'time gate';
    }
    if (text.includes('support') || text.includes('approval') || text.includes('trust')) {
      return 'relationship or support';
    }
    if (text.includes('resource') || text.includes('capacity')) {
      return 'resource or capacity';
    }
    return 'game state';
  }

  function sourcePathFor(scene) {
    if (!scene) {
      return '';
    }
    if (scene.path) {
      return String(scene.path);
    }
    if (scene.sourceSpan && scene.sourceSpan.path) {
      return String(scene.sourceSpan.path);
    }
    if (scene.source && scene.source.path) {
      return String(scene.source.path);
    }
    return '';
  }

  function sceneRank(scene) {
    const type = String(scene && scene.type || '').toLowerCase();
    if (type === 'event' || type === 'world_event') return 0;
    if (type === 'news' || type === 'news_item') return 1;
    if (type === 'card' || type === 'advisor') return 2;
    if (type === 'hand') return 3;
    if (type === 'deck') return 4;
    return 5;
  }

  function variableSuggestionsApi() {
    if (global && global.ProjectMapVariableSuggestions) {
      return global.ProjectMapVariableSuggestions;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('./variable_suggestions.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message, confidence: 'exact'};
  }

  function positiveInteger(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function isSafeIdentifier(value) {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(String(value || ''));
  }

  function isSafeSceneId(value) {
    const text = String(value || '');
    return text.length > 0 && text.length <= 160 && !/[<>"'\\]/.test(text);
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  const GROUP_ORDER = ['event flag', 'time gate', 'relationship or support', 'resource or capacity', 'game state'];
  const GROUP_LABELS = {
    'event flag': 'Event Flags',
    'time gate': 'Time & Gates',
    'relationship or support': 'Relationships',
    'resource or capacity': 'Resources',
    'game state': 'Game State'
  };

  function groupVariables(variables) {
    const groups = {};
    ensureArray(variables).forEach((v) => {
      const key = String(v && v.meaning || 'game state');
      if (!groups[key]) { groups[key] = {key, label: GROUP_LABELS[key] || key, variables: []}; }
      groups[key].variables.push(v);
    });
    var ordered = GROUP_ORDER.filter((k) => groups[k]).map((k) => groups[k]);
    Object.keys(groups).forEach((k) => { if (GROUP_ORDER.indexOf(k) < 0) ordered.push(groups[k]); });
    return ordered;
  }

  var MAX_KNOWN_VALUES = 40;
  var MAX_WRITE_LOCATIONS = 200;
  var STRING_LITERAL_PATTERN = /=\s*"([^"]{1,80})"/g;

  function enrichVariablesWithKnownValues(controls, indexVariables, readSourceLine) {
    if (typeof readSourceLine !== 'function') {
      return controls;
    }
    const variables = ensureArray(controls && controls.variables);
    const indexByName = new Map(ensureArray(indexVariables).map((v) => [String(v && v.name || ''), v]));
    variables.forEach((control) => {
      if (control.valueType !== 'string') {
        return;
      }
      const meta = indexByName.get(control.name);
      const writes = ensureArray(meta && meta.writes).slice(0, MAX_WRITE_LOCATIONS);
      if (!writes.length) {
        return;
      }
      const seen = new Set();
      for (var i = 0; i < writes.length && seen.size < MAX_KNOWN_VALUES; i++) {
        const loc = writes[i];
        const line = readSourceLine(loc && loc.path, loc && loc.line);
        if (!line) {
          continue;
        }
        var match;
        STRING_LITERAL_PATTERN.lastIndex = 0;
        while ((match = STRING_LITERAL_PATTERN.exec(line)) !== null) {
          var left = line.slice(0, match.index).trim();
          if (left.endsWith(control.name) || left.endsWith(control.name + ' ')) {
            seen.add(match[1]);
          }
        }
      }
      if (seen.size) {
        control.knownValues = Array.from(seen).sort();
      }
    });
    return controls;
  }

  const api = {
    buildDebugControls,
    enrichVariablesWithKnownValues,
    validateVariableCommand,
    validateJumpCommand,
    commandHistoryEntry,
    groupVariables,
    GROUP_ORDER,
    GROUP_LABELS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  global.ProjectMapRuntimePreviewDebugModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
