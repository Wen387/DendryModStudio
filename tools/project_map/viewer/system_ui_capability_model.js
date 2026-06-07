(function initProjectMapSystemUiCapabilityModel(global) {
  'use strict';

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;

  const VERSION = '0.1';
  const GENERATED_ONLY = 'generated_only';
  const SOURCE_BACKED = 'source_backed';
  const RUNTIME_CUSTOM = 'runtime_custom';
  const AMBIGUOUS = 'ambiguous';
  const BLOCKED = 'blocked';

  const REGION_FALLBACK_OWNERS = {
    layout_frame: owner('workspace_layout', 'workspace_layout', 'Screen shell', 'layout'),
    screen_header: owner('project', 'project_metadata', 'Game Info', 'header'),
    main_content: owner('entry', 'entry_sidebar', 'Entry & Sidebar', 'main'),
    main_options: owner('entry', 'entry_sidebar', 'Entry & Sidebar', 'route'),
    workspace_hand: owner('play_surface', 'play_surface', 'Playable Surface', 'hand'),
    deck_lane: owner('workspace_layout', 'workspace_layout', 'Workspace Layout', 'deck'),
    action_card: owner('workspace_layout', 'workspace_layout', 'Workspace Layout', 'card'),
    advisor_lane: owner('play_surface', 'play_surface', 'Playable Surface', 'advisor'),
    sidebar_status: owner('sidebar_status', 'sidebar_status', 'Sidebar / Status', 'sidebar'),
    right_sidebar: owner('workspace_layout', 'workspace_layout', 'Right sidebar', 'right'),
    election_results_frame: owner('election_results', 'election_results', 'Election Results', 'frame'),
    election_results_chart: owner('election_results', 'election_results', 'Election Results', 'seat chart'),
    election_results_table: owner('election_results', 'election_results', 'Election Results', 'party table'),
    election_results_coalitions: owner('election_results', 'election_results', 'Election Results', 'coalitions'),
    election_results_choices: owner('election_results', 'election_results', 'Election Results', 'choices')
  };

  const MANUAL_REGION_REASONS = {
    election_results_chart: 'D3/SVG chart targets and party seat formulas remain runtime-observed and manual-review only.',
    election_results_table: 'Party table data may be derived from custom renderer logic, so only exact source-backed text can be guarded.',
    election_results_coalitions: 'Coalition rendering may be project-specific; exact source text can be guarded, renderer wiring remains manual.',
    layout_frame: 'Runtime layout structure and CSS selectors are observed for diagnosis, not rewritten automatically.',
    deck_lane: 'Deck lane creation is supported through source-backed layout drafts; runtime geometry remains manual.',
    action_card: 'Starter card copy is source-backed when a draft owns it; runtime card geometry remains manual.',
    sidebar_status: 'Generated or custom sidebar output needs exact source anchors before guarded apply.',
    right_sidebar: 'The right sidebar is a net-new extensible part; it writes the mod-owned HTML template, so it stays manual review until the apply step is wired.'
  };

  const THEME_LAYOUT_REGIONS = new Set([
    'layout_frame',
    'screen_header',
    'main_content',
    'main_options',
    'sidebar_status',
    'deck_lane',
    'action_card',
    'workspace_hand'
  ]);

  function buildCapabilityMatrix(screen, options) {
    const model = isObject(screen) ? screen : {};
    const opts = isObject(options) ? options : {};
    const runtimeVisualSurface = normalizeRuntimeVisualSurface(opts.runtimeVisualSurface || model.runtimeVisualSurface);
    const aggregateRuntimeState = aggregateRuntimeEvidenceState(runtimeVisualSurface);
    const capabilities = ensureArray(model.regions).map((region) => capabilityForRegion(region, {
      screen: model,
      runtimeVisualSurface,
      aggregateRuntimeState
    }));
    const byRegion = {};
    capabilities.forEach((item) => {
      byRegion[item.regionKey] = item;
    });
    return {
      schemaVersion: VERSION,
      kind: 'system_ui_capability_matrix',
      template: String(model.template || ''),
      runtimeEvidenceState: aggregateRuntimeState,
      regions: capabilities,
      byRegion
    };
  }

  function capabilityForRegion(region, options) {
    const opts = isObject(options) ? options : {};
    const value = isObject(region) ? region : {};
    const key = String(value.key || '').trim();
    const ownerInfo = ownerForRegion(value);
    const sourceEvidence = sourceEvidenceForRegion(value);
    const runtime = runtimeEvidenceForRegion(key, opts.runtimeVisualSurface, opts.aggregateRuntimeState);
    const fields = supportedEditFields(value.fields, sourceEvidence);
    const evidenceState = runtime.state === BLOCKED
      ? BLOCKED
      : runtime.state && runtime.state !== RUNTIME_CUSTOM
        ? runtime.state
        : sourceEvidenceState(sourceEvidence, fields);
    const safety = installSafetyFor({region: value, evidenceState, fields, sourceEvidence});
    const manualReason = manualReasonFor({region: value, evidenceState, fields, sourceEvidence, runtime, safety});
    const themeLayoutCandidate = themeLayoutCandidateFor(value, sourceEvidence, fields, evidenceState);

    return {
      schemaVersion: VERSION,
      kind: 'system_ui_region_capability',
      regionKey: key,
      ownerTemplate: ownerInfo.template,
      ownerKind: ownerInfo.kind,
      ownerSlot: ownerInfo.slot,
      supportedEditFields: fields,
      sourceEvidence,
      installSafety: safety,
      runtimeEvidenceState: evidenceState,
      runtimeEvidenceSummary: runtime.summary,
      themeLayoutCandidate,
      manualReason
    };
  }

  function ownerForRegion(region) {
    const key = String(region && region.key || '').trim();
    const fallback = REGION_FALLBACK_OWNERS[key] || owner('', '', '', '');
    return {
      template: String(region && region.ownerTemplate || fallback.template || ''),
      kind: String(region && region.ownerKind || fallback.kind || ''),
      fallback: String(region && region.ownerFallback || fallback.fallback || ''),
      slot: String(region && region.ownerSlot || fallback.slot || '')
    };
  }

  function sourceEvidenceForRegion(region) {
    const rows = [];
    ensureArray(region && region.sourceEvidence).forEach((row) => pushSourceEvidence(rows, row, row && row.label));
    ensureArray(region && region.fields).forEach((field) => {
      const source = field && field.source || {};
      if (source && source.path) {
        pushSourceEvidence(rows, source, field && (field.label || field.id), field && (field.status || field.editability));
      }
    });
    return rows.slice(0, 8);
  }

  function supportedEditFields(fields, evidenceRows) {
    const evidence = ensureArray(evidenceRows);
    return ensureArray(fields).map((field) => {
      const value = isObject(field) ? field : {};
      const source = sourceRef(value.source || {});
      const matched = source.path ? source : evidence.find((row) => sourceBackedPath(row.path)) || {};
      const sourceState = sourceStateFor(matched);
      return {
        id: String(value.id || ''),
        label: String(value.label || value.id || ''),
        editability: String(value.editability || value.status || 'guarded'),
        inputType: String(value.inputType || ''),
        source: sourceRef(matched),
        sourceEvidenceState: sourceState,
        installSafety: sourceState === SOURCE_BACKED ? 'guarded_apply' : 'manual_review'
      };
    }).filter((field) => field.id);
  }

  function runtimeEvidenceForRegion(regionKey, visualSurface, aggregateRuntimeState) {
    const surface = normalizeRuntimeVisualSurface(visualSurface);
    if (aggregateRuntimeState === BLOCKED || surface.status === BLOCKED) {
      return {
        state: BLOCKED,
        summary: {
          status: BLOCKED,
          visible: false,
          matchedCandidates: 0,
          sourceBacked: false,
          generatedOnly: false,
          manualOnly: true,
          reason: 'Runtime Lens is blocked for this screen.'
        }
      };
    }
    const candidates = ensureArray(surface.candidates).filter((candidate) => candidateMatchesRegion(regionKey, candidate));
    if (!candidates.length) {
      return {
        state: '',
        summary: {
          status: surface.status || '',
          visible: false,
          matchedCandidates: 0,
          sourceBacked: false,
          generatedOnly: false,
          manualOnly: false,
          reason: 'No runtime DOM evidence was matched to this System UI region yet.'
        }
      };
    }
    const states = candidates.map(runtimeStateForCandidate);
    const state = preferredRuntimeState(states);
    return {
      state,
      summary: {
        status: surface.status || '',
        visible: true,
        matchedCandidates: candidates.length,
        sourceBacked: states.includes(SOURCE_BACKED),
        generatedOnly: states.includes(GENERATED_ONLY),
        manualOnly: !states.includes(SOURCE_BACKED),
        reason: firstNonEmpty(candidates.map((candidate) => candidate.reason || candidate.action && candidate.action.reason))
      }
    };
  }

  function aggregateRuntimeEvidenceState(visualSurface) {
    const surface = normalizeRuntimeVisualSurface(visualSurface);
    if (surface.status === BLOCKED) {
      return BLOCKED;
    }
    const states = ensureArray(surface.candidates).map(runtimeStateForCandidate);
    return preferredRuntimeState(states) || '';
  }

  function runtimeStateForCandidate(candidate) {
    const value = isObject(candidate) ? candidate : {};
    const explicit = String(value.runtimeEvidenceState || value.systemUiEvidenceState || '').trim();
    if (explicit) {
      return normalizeEvidenceState(explicit);
    }
    const editability = String(value.editability || '').trim();
    if (editability === GENERATED_ONLY) {
      return GENERATED_ONLY;
    }
    if (editability === 'draftable') {
      return SOURCE_BACKED;
    }
    if (/ambiguous|multiple/i.test(String(value.reason || value.action && value.action.reason || ''))) {
      return AMBIGUOUS;
    }
    if (sourceBackedPath(value.source && value.source.path)) {
      return editability === 'manual_review' || editability === 'proposal_only' ? AMBIGUOUS : SOURCE_BACKED;
    }
    if (generatedPath(value.source && value.source.path)) {
      return GENERATED_ONLY;
    }
    return RUNTIME_CUSTOM;
  }

  function preferredRuntimeState(states) {
    const rows = ensureArray(states).map(normalizeEvidenceState).filter(Boolean);
    if (!rows.length) {
      return '';
    }
    if (rows.includes(BLOCKED)) {
      return BLOCKED;
    }
    if (rows.includes(SOURCE_BACKED)) {
      return SOURCE_BACKED;
    }
    if (rows.includes(AMBIGUOUS)) {
      return AMBIGUOUS;
    }
    if (rows.includes(GENERATED_ONLY)) {
      return GENERATED_ONLY;
    }
    return RUNTIME_CUSTOM;
  }

  function sourceEvidenceState(sourceEvidence, fields) {
    const rows = ensureArray(sourceEvidence);
    const fieldRows = ensureArray(fields).map((field) => field && field.source || {});
    const all = rows.concat(fieldRows);
    if (all.some((row) => sourceBackedPath(row && row.path))) {
      return SOURCE_BACKED;
    }
    if (all.some((row) => generatedPath(row && row.path))) {
      return GENERATED_ONLY;
    }
    return RUNTIME_CUSTOM;
  }

  function installSafetyFor(input) {
    const value = isObject(input) ? input : {};
    if (value.evidenceState === BLOCKED || value.evidenceState === GENERATED_ONLY || value.evidenceState === AMBIGUOUS) {
      return 'manual_review';
    }
    if (value.evidenceState === SOURCE_BACKED && ensureArray(value.fields).length) {
      return 'guarded_apply';
    }
    if (value.evidenceState === SOURCE_BACKED && ensureArray(value.sourceEvidence).length) {
      return 'guarded_apply';
    }
    return 'manual_review';
  }

  function manualReasonFor(input) {
    const value = isObject(input) ? input : {};
    const region = value.region || {};
    const key = String(region.key || '');
    if (value.evidenceState === BLOCKED) {
      return 'Runtime Lens is blocked; use manual review until a DOM snapshot is available.';
    }
    if (value.evidenceState === GENERATED_ONLY) {
      return 'Evidence points only at generated/runtime output; Studio does not auto-edit generated files.';
    }
    if (value.evidenceState === AMBIGUOUS) {
      return 'Evidence is ambiguous and needs manual review before any source operation is generated.';
    }
    if (value.safety === 'guarded_apply') {
      return '';
    }
    return MANUAL_REGION_REASONS[key] || 'This region is visible for diagnosis, but no exact source-backed edit field is available yet.';
  }

  function themeLayoutCandidateFor(region, sourceEvidence, fields, evidenceState) {
    const key = String(region && region.key || '');
    const sourceBacked = evidenceState === SOURCE_BACKED;
    const safeToken = ensureArray(fields).some((field) => {
      const id = String(field && field.id || '').toLowerCase();
      const input = String(field && field.inputType || '').toLowerCase();
      return input === 'color' || /title|heading|label|body|intro|copy|route|category/.test(id);
    });
    return {
      supported: THEME_LAYOUT_REGIONS.has(key) && sourceBacked && safeToken,
      scope: THEME_LAYOUT_REGIONS.has(key) ? 'limited_source_backed' : 'manual_runtime_observed',
      allowedTokens: THEME_LAYOUT_REGIONS.has(key)
        ? ['safe_color_value', 'single_label_or_copy_text', 'source_backed_layout_route']
        : [],
      manualOnly: !THEME_LAYOUT_REGIONS.has(key) || !sourceBacked,
      reason: THEME_LAYOUT_REGIONS.has(key)
        ? sourceBacked
          ? 'Limited source-backed theme/layout tokens may be edited when they map to a field.'
          : 'Theme/layout support needs a non-generated source anchor before guarded apply.'
        : 'Runtime selectors, classes, SVG geometry, and custom renderer code remain manual review.'
    };
  }

  function candidateMatchesRegion(regionKey, candidate) {
    const key = String(regionKey || '').replace(/^ui:/, '');
    if (!key || !isObject(candidate)) {
      return false;
    }
    const target = candidate.action && candidate.action.target || candidate.route && candidate.route.target || {};
    const selected = String(target.selectedRegion || target.regionKey || '').replace(/^ui:/, '');
    if (selected === key) {
      return true;
    }
    const template = String(target.internalTemplate || target.template || '');
    if (template && defaultRegionForTemplate(template) === key) {
      return true;
    }
    const haystack = [
      candidate.id,
      candidate.role,
      candidate.selector,
      candidate.label,
      candidate.currentValue
    ].join(' ').toLowerCase();
    return haystack.indexOf(key.toLowerCase()) >= 0;
  }

  function defaultRegionForTemplate(template) {
    return {
      entry: 'main_content',
      project: 'screen_header',
      play_surface: 'workspace_hand',
      workspace_layout: 'layout_frame',
      sidebar_status: 'sidebar_status',
      election_results: 'election_results_chart'
    }[String(template || '')] || '';
  }

  function normalizeRuntimeVisualSurface(value) {
    const surface = isObject(value) ? value : {};
    return {
      status: normalizeEvidenceState(surface.status) === BLOCKED ? BLOCKED : String(surface.status || ''),
      candidates: ensureArray(surface.candidates)
    };
  }

  function normalizeEvidenceState(value) {
    const text = String(value || '').trim();
    if (text === 'ready' || text === 'draftable') {
      return SOURCE_BACKED;
    }
    if (text === 'generated' || text === 'generated_runtime_output') {
      return GENERATED_ONLY;
    }
    if (text === 'manual_review' || text === 'proposal_only') {
      return AMBIGUOUS;
    }
    return [SOURCE_BACKED, GENERATED_ONLY, RUNTIME_CUSTOM, AMBIGUOUS, BLOCKED].includes(text) ? text : text;
  }

  function sourceStateFor(source) {
    const path = source && source.path || '';
    if (sourceBackedPath(path)) {
      return SOURCE_BACKED;
    }
    if (generatedPath(path)) {
      return GENERATED_ONLY;
    }
    return RUNTIME_CUSTOM;
  }

  function pushSourceEvidence(rows, source, label, status) {
    const ref = sourceRef(source || {});
    if (!ref.path) {
      return;
    }
    const key = [ref.path, ref.line || '', ref.anchorText || '', label || ''].join('\n');
    if (rows.some((row) => [row.path, row.line || '', row.anchorText || '', row.label || ''].join('\n') === key)) {
      return;
    }
    rows.push(Object.assign(ref, {
      label: String(label || ''),
      status: String(status || source.status || 'evidence'),
      evidenceState: sourceStateFor(ref)
    }));
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const line = numberOrNull(value.line || value.startLine);
    return {
      path: normalizePath(value.path || value.sourcePath || ''),
      line,
      startLine: line,
      endLine: numberOrNull(value.endLine || value.line || value.startLine),
      anchorText: String(value.anchorText || ''),
      endAnchorText: String(value.endAnchorText || '')
    };
  }

  function sourceBackedPath(path) {
    const rel = normalizePath(path);
    return rel === 'source/info.dry' ||
      rel.startsWith('source/scenes/') ||
      rel.startsWith('source/qdisplays/') ||
      rel.startsWith('source/styles/') ||
      rel.startsWith('source/css/');
  }

  function generatedPath(path) {
    const rel = normalizePath(path);
    return rel === 'out/game.json' ||
      rel.startsWith('out/') ||
      rel.startsWith('dist/') ||
      rel.startsWith('build/');
  }

  function normalizePath(path) {
    return String(path || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
  }

  function firstNonEmpty(values) {
    const rows = Array.isArray(values) ? values : Array.prototype.slice.call(arguments);
    for (let index = 0; index < rows.length; index += 1) {
      const text = String(rows[index] || '').trim();
      if (text) {
        return text;
      }
    }
    return '';
  }

  function owner(template, kind, fallback, slot) {
    return {template, kind, fallback, slot};
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? Math.floor(number) : null;
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {
    buildCapabilityMatrix,
    capabilityForRegion,
    runtimeStateForCandidate,
    constants: {
      SOURCE_BACKED,
      GENERATED_ONLY,
      RUNTIME_CUSTOM,
      AMBIGUOUS,
      BLOCKED
    }
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSystemUiCapabilityModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
