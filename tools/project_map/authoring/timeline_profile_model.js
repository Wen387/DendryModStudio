// @ts-check
(function initProjectMapTimelineProfileModel(global) {
  'use strict';

  const MODES = ['year_month', 'turn', 'chapter', 'phase', 'source_order', 'chain_order'];
  const PRESETS = {
    year_month: {mode: 'year_month', unitLabel: 'Year', laneLabel: 'Year'},
    turn: {mode: 'turn', unitLabel: 'Turn', laneLabel: 'Turn'},
    chapter: {mode: 'chapter', unitLabel: 'Chapter', laneLabel: 'Chapter'},
    phase: {mode: 'phase', unitLabel: 'Phase', laneLabel: 'Phase'},
    source_order: {mode: 'source_order', unitLabel: 'Source order', laneLabel: 'Source'},
    chain_order: {mode: 'chain_order', unitLabel: 'Story chain', laneLabel: 'Chain'}
  };

  function buildProfile(projectIndex, options) {
    const opts = isObject(options) ? options : {};
    const explicit = normalizeProfile(opts.profile || projectProfile(projectIndex), 'project');
    if (explicit) {
      return explicit;
    }
    return inferProfile(projectIndex);
  }

  function normalizeProfile(input, source) {
    if (!isObject(input)) {
      return null;
    }
    const mode = normalizeMode(input.mode || input.type || input.timelineMode);
    if (!mode) {
      return null;
    }
    const preset = PRESETS[mode] || PRESETS.source_order;
    return {
      schemaVersion: String(input.schemaVersion || '0.1'),
      mode,
      unitLabel: String(input.unitLabel || preset.unitLabel),
      laneLabel: String(input.laneLabel || preset.laneLabel || preset.unitLabel),
      source: source || 'project',
      inferred: source !== 'project' && source !== 'option',
      lanes: normalizeLanes(input.lanes),
      rules: normalizeRules(input.rules),
      explanation: String(input.explanation || input.summary || '')
    };
  }

  function inferProfile(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const evidence = evidenceCounts(index);
    if (evidence.yearMonth > 0) {
      return inferred('year_month', 'Found year/month evidence in scene or news timing.');
    }
    if (evidence.turn > 0) {
      return inferred('turn', 'Found turn fields or turn conditions.');
    }
    if (evidence.chapter > 0) {
      return inferred('chapter', 'Found chapter fields on story objects.');
    }
    if (evidence.phase > 0) {
      return inferred('phase', 'Found phase fields on story objects.');
    }
    if (ensureArray(index.edges).length > 0) {
      return inferred('chain_order', 'No timeline values found; using ProjectIndex story edges.');
    }
    return inferred('source_order', 'No timeline values found; using ProjectIndex source order.');
  }

  function projectProfile(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const project = isObject(index.project) ? index.project : {};
    const metadata = isObject(index.metadata) ? index.metadata : {};
    const studio = isObject(index.studio) ? index.studio : {};
    return index.timelineProfile ||
      index.timeline ||
      project.timelineProfile ||
      project.timeline ||
      metadata.timelineProfile ||
      metadata.timeline ||
      studio.timelineProfile ||
      studio.timeline ||
      null;
  }

  function evidenceCounts(projectIndex) {
    const scenes = ensureArray(projectIndex && projectIndex.scenes);
    const newsItems = ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.news && projectIndex.semantic.news.items);
    const all = scenes.concat(newsItems);
    return all.reduce((counts, item) => {
      const text = timingText(item);
      if (field(item, ['year', 'when.year', 'metadata.year']) || /\byear\s*(?:={1,3}|>=|<=)\s*\d{3,4}/.test(text)) {
        counts.yearMonth += 1;
      }
      if (field(item, ['turn', 'when.turn', 'metadata.turn']) || /\bturn\s*(?:={1,3}|>=|<=)\s*\d+/.test(text)) {
        counts.turn += 1;
      }
      if (field(item, ['chapter', 'metadata.chapter', 'when.chapter'])) {
        counts.chapter += 1;
      }
      if (field(item, ['phase', 'metadata.phase', 'when.phase'])) {
        counts.phase += 1;
      }
      return counts;
    }, {yearMonth: 0, turn: 0, chapter: 0, phase: 0});
  }

  function inferred(mode, explanation) {
    const profile = normalizeProfile({mode, explanation}, 'inferred');
    profile.inferred = true;
    return profile;
  }

  function normalizeMode(value) {
    const text = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
    if (text === 'year' || text === 'calendar' || text === 'year_month') {
      return 'year_month';
    }
    if (text === 'source' || text === 'source_order') {
      return 'source_order';
    }
    if (text === 'chain' || text === 'chain_order') {
      return 'chain_order';
    }
    return MODES.includes(text) ? text : '';
  }

  function normalizeLanes(lanes) {
    return ensureArray(lanes).map((lane, index) => {
      if (!isObject(lane)) {
        return {id: safeId(lane), label: String(lane || ''), order: index};
      }
      return {
        id: safeId(lane.id || lane.key || lane.value || lane.label || index + 1),
        value: lane.value !== undefined ? lane.value : lane.id,
        label: String(lane.label || lane.title || lane.id || lane.key || lane.value || ''),
        order: Number.isFinite(Number(lane.order)) ? Number(lane.order) : index
      };
    }).filter((lane) => lane.id);
  }

  function normalizeRules(rules) {
    return ensureArray(rules).map((rule) => {
      if (!isObject(rule)) {
        return null;
      }
      return {
        source: String(rule.source || '').trim(),
        path: String(rule.path || rule.field || '').trim(),
        name: String(rule.name || '').trim(),
        match: String(rule.match || '').trim(),
        lane: safeId(rule.lane || rule.value || rule.id || ''),
        label: String(rule.label || '')
      };
    }).filter(Boolean);
  }

  function timingText(item) {
    const value = isObject(item) ? item : {};
    return String([
      value.viewIf,
      value.chooseIf,
      value.requires,
      value.condition,
      value.when && JSON.stringify(value.when)
    ].filter(Boolean).join(' ')).toLowerCase();
  }

  function field(object, paths) {
    for (let index = 0; index < paths.length; index += 1) {
      const value = readPath(object, paths[index]);
      if (value !== undefined && value !== null && String(value).trim()) {
        return value;
      }
    }
    return '';
  }

  function readPath(object, path) {
    return String(path || '').split('.').reduce((value, part) => {
      if (!isObject(value)) {
        return undefined;
      }
      return value[part];
    }, object);
  }

  function safeId(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9_:-]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {
    MODES,
    PRESETS,
    buildProfile,
    normalizeProfile,
    inferProfile,
    projectProfile,
    evidenceCounts
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapTimelineProfileModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
