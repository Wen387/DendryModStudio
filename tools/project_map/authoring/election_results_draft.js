(function initProjectMapElectionResultsDraft(global) {
  'use strict';

  const VERSION = '0.1';
  const KIND = 'election_results';
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

  const DEFAULT_PARTIES = [
    party('spd', 'SPD', '#d9341f', '28.7', '2.7', '29.8', '3.3', '153'),
    party('kpd', 'KPD', '#7a1708', '10.5', '1.5', '10.9', '1.8', '56'),
    party('ddp', 'DDP', '#d6cd54', '4.5', '-1.8', '4.7', '-1.8', '24'),
    party('z', 'Z', '#000000', '11.9', '-1.7', '12.4', '-2.3', '64'),
    party('bvp', 'BVP', '#b8e2eb', '3.0', '-0.7', '3.1', '-0.8', '16'),
    party('dvp', 'DVP', '#d6b339', '8.5', '-1.6', '8.9', '-1.4', '46'),
    party('others', 'Others', '#9b9b9b', '14.0', '6.2', '10.5', '4.6', '54'),
    party('dnvp', 'DNVP', '#5a8fbd', '14.9', '-5.6', '15.5', '-5.4', '80'),
    party('nsdap', 'NSDAP', '#85500e', '4.1', '1.1', '4.3', '1.3', '22')
  ];

  const DEFAULT_COALITIONS = [
    coalition('weimar', 'Weimar Coalition', 'SPD + Z + DDP', '46.9'),
    coalition('grand', 'Grand Coalition', 'SPD + Z + BVP + DDP + DVP', '58.9'),
    coalition('bourgeois', 'Bourgeois Coalition', 'Z + BVP + DDP + DVP + Others', '39.6'),
    coalition('right_wing', 'Right-wing Coalition', 'Z + BVP + DVP + Others + DNVP', '50.4')
  ];

  const DEFAULT_CHOICES = [
    choice('grand', 'We can form a Grand Coalition.', 'SPD + Z + BVP + DDP + DVP (58.9%)', false, '', 'A grand coalition government is formed.', []),
    choice('popular_front', 'A new "Popular Front" coalition?', 'SPD + KPD + Z + DDP (57.8%) - relations are not good enough.', true, 'kpd_relations >= 50', '', []),
    choice('refuse', 'Refuse to form a government, so that a right-wing coalition may be formed.', 'Z + BVP + DVP + Others + DNVP (50.4%)', false, '', 'A right-wing coalition may attempt to form a government.', [])
  ];

  function defaultDraft(projectIndex) {
    const electionEvents = collectElectionEvents(projectIndex);
    const selected = electionEvents[0] || null;
    return normalizeDraft({
      schemaVersion: VERSION,
      kind: KIND,
      id: 'election_results_update',
      title: 'Election Results',
      subtitle: selected && selected.subtitle || 'Reichstag election results',
      intro: 'There are some potential coalition arrangements.',
      seatsTotal: '515',
      targetSceneId: selected && selected.id || '',
      electionKind: selected && selected.electionKind || 'reichstag',
      year: selected && selected.year || '',
      month: selected && selected.month || '',
      viewIf: selected && selected.viewIf || '',
      resultText: 'Use this area for the consequence text shown after a coalition choice.',
      conditionText: selected && selected.conditionText || '',
      sourcePath: selected && selected.path || 'source/scenes/events/election_results.scene.dry',
      chartElementId: selected && selected.chartElementId || 'reichstag_results',
      useD3Parliament: selected ? selected.usesD3Parliament !== false : true,
      parties: DEFAULT_PARTIES,
      coalitions: DEFAULT_COALITIONS,
      choices: DEFAULT_CHOICES,
      effects: [],
      electionEvents,
      evidence: {}
    }, projectIndex);
  }

  function normalizeDraft(input, projectIndex) {
    const draft = isObject(input) ? clone(input) : {};
    const electionEvents = ensureArray(draft.electionEvents).length ? normalizeElectionEvents(draft.electionEvents) : collectElectionEvents(projectIndex);
    const selected = selectElectionEvent(draft.targetSceneId, electionEvents);
    draft.schemaVersion = String(draft.schemaVersion || VERSION);
    draft.kind = KIND;
    draft.id = safeId(draft.id || 'election_results_update');
    draft.title = singleLine(draft.title || 'Election Results');
    draft.subtitle = singleLine(draft.subtitle || 'Reichstag election results');
    draft.intro = String(draft.intro || '').trim();
    draft.seatsTotal = numericText(draft.seatsTotal || '515', '515');
    draft.targetSceneId = String(draft.targetSceneId || selected && selected.id || '').trim();
    draft.electionKind = safeId(draft.electionKind || selected && selected.electionKind || 'reichstag').toLowerCase();
    draft.year = String(draft.year || selected && selected.year || '').trim();
    draft.month = String(draft.month || selected && selected.month || '').trim();
    draft.viewIf = String(draft.viewIf || selected && selected.viewIf || '').trim();
    draft.resultText = String(draft.resultText || '').trim();
    draft.conditionText = String(draft.conditionText || '').trim();
    draft.sourcePath = String(draft.sourcePath || selected && selected.path || 'source/scenes/events/election_results.scene.dry').trim();
    draft.chartElementId = String(draft.chartElementId || selected && selected.chartElementId || 'reichstag_results').trim();
    draft.useD3Parliament = booleanValue(draft.useD3Parliament !== undefined ? draft.useD3Parliament : true);
    draft.parties = normalizeRows(draft.parties, DEFAULT_PARTIES, normalizeParty);
    draft.coalitions = normalizeRows(draft.coalitions, DEFAULT_COALITIONS, normalizeCoalition);
    draft.choices = normalizeRows(draft.choices, DEFAULT_CHOICES, normalizeChoice);
    draft.effects = normalizeEffects(draft.effects);
    draft.electionEvents = electionEvents;
    draft.evidence = isObject(draft.evidence) ? draft.evidence : {};
    return draft;
  }

  function validateDraft(input, projectIndex) {
    const draft = normalizeDraft(input, projectIndex);
    const diagnostics = [];
    if (!ID_RE.test(draft.id)) {
      diagnostic(diagnostics, 'error', 'election_results.id', 'Election Results draft id must be file-safe.');
    }
    if (!draft.title) {
      diagnostic(diagnostics, 'error', 'election_results.title', 'Election Results title is required.');
    }
    if (!draft.parties.some((row) => Number(row.seats) > 0 || Number(row.seatsShare) > 0)) {
      diagnostic(diagnostics, 'warning', 'election_results.empty_parties', 'No party seat data is available for the chart.');
    }
    if (!draft.targetSceneId && draft.electionEvents.length) {
      diagnostic(diagnostics, 'warning', 'election_results.no_target_event', 'Choose which election event this results screen modifies.');
    }
    if (draft.useD3Parliament && !draft.chartElementId) {
      diagnostic(diagnostics, 'warning', 'election_results.no_chart_target', 'D3 parliament charts need an SVG element id such as reichstag_results or thuringia_landtag.');
    }
    return {ok: diagnostics.every((item) => item.severity !== 'error'), draft, diagnostics};
  }

  function buildExportBundle(input, projectIndex, options) {
    const validation = validateDraft(input, projectIndex);
    const draft = validation.draft;
    const installApi = installPlanApi();
    const plan = buildInstallPlan(draft, projectIndex);
    const draftJson = JSON.stringify(draft, null, 2) + '\n';
    const playerPreview = renderPlayerPreview(draft);
    const installPlanJson = installApi.renderInstallPlanJson(plan);
    const patchPreview = installApi.renderPatchPreview(plan);
    const installChecklist = installApi.renderOperationChecklist(plan, options || {});
    const installNotes = renderInstallNotes(draft);
    return {
      ok: validation.ok,
      draft,
      diagnostics: validation.diagnostics,
      files: [
        {path: draft.id + '.election-results-draft.json', content: draftJson, kind: 'draft'},
        {path: draft.id + '.election-results-preview.txt', content: playerPreview, kind: 'preview'},
        {path: draft.id + '.install-plan.json', content: installPlanJson, kind: 'install_plan'},
        {path: draft.id + '.patch-preview.diff', content: patchPreview, kind: 'patch_preview'},
        {path: draft.id + '.install-notes.txt', content: installNotes, kind: 'notes'}
      ],
      playerPreview,
      previewText: playerPreview,
      draftJson,
      installPlan: plan,
      installPlanJson,
      patchPreview,
      installChecklist,
      installNotes
    };
  }

  function buildInstallPlan(input, projectIndex) {
    const draft = normalizeDraft(input, projectIndex);
    const installApi = installPlanApi();
    return installApi.buildInstallPlan({
      id: draft.id,
      draftKind: KIND,
      title: draft.title || draft.id,
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
      operations: [{
        id: 'election_results_manual_review',
        type: 'manual_snippet',
        path: draft.sourcePath || 'source/scenes/events/election_results.scene.dry',
        content: JSON.stringify({
          targetSceneId: draft.targetSceneId,
          electionKind: draft.electionKind,
          viewIf: draft.viewIf,
          chartElementId: draft.chartElementId,
          useD3Parliament: draft.useD3Parliament,
          title: draft.title,
          subtitle: draft.subtitle,
          resultText: draft.resultText,
          conditionText: draft.conditionText,
          parties: draft.parties,
          coalitions: draft.coalitions,
          choices: draft.choices,
          effects: draft.effects
        }, null, 2) + '\n',
        safety: 'manual_review',
        role: 'election_results',
        description: 'Review how this election-results UI is wired into the project-specific event renderer.'
      }]
    });
  }

  function renderPlayerPreview(draft) {
    const lines = [
      draft.title,
      draft.subtitle,
      'Source: ' + (draft.sourcePath || '(new election event)'),
      'Chart: ' + (draft.useD3Parliament ? 'd3.parliament -> #' + (draft.chartElementId || '(missing target)') : 'custom/manual chart'),
      draft.viewIf ? 'Condition: ' + draft.viewIf : '',
      '',
      'Parties:'
    ].filter((line) => line !== '');
    draft.parties.forEach((row) => {
      lines.push('- ' + row.name + ': ' + row.voteShare + '% vote / ' + row.seatsShare + '% seats');
    });
    lines.push('', 'Potential coalitions:');
    draft.coalitions.forEach((row) => {
      lines.push('- ' + row.name + ' (' + row.parties + '): ' + row.share + '%');
    });
    lines.push('', 'Player choices:');
    draft.choices.forEach((row) => {
      lines.push('- ' + row.label + (row.disabled ? ' [disabled]' : ''));
      if (row.condition) {
        lines.push('  if: ' + row.condition);
      }
      if (row.detail) {
        lines.push('  ' + row.detail);
      }
      if (row.resultText) {
        lines.push('  result: ' + row.resultText);
      }
      ensureArray(row.effects).forEach((effect) => lines.push('  effect: ' + effectLine(effect)));
    });
    if (draft.resultText || draft.conditionText || draft.effects.length) {
      lines.push('', 'Conditions and consequences:');
      if (draft.conditionText) {
        lines.push('- conditional text: ' + draft.conditionText);
      }
      if (draft.resultText) {
        lines.push('- result text: ' + draft.resultText);
      }
      draft.effects.forEach((effect) => lines.push('- effect: ' + effectLine(effect)));
    }
    return lines.join('\n') + '\n';
  }

  function renderInstallNotes(draft) {
    return [
      'Election Results UI draft: ' + draft.id,
      '',
      'This is a System UI authoring draft for a player-facing election-results event.',
      'The current install plan is manual-review only because election-result renderers are project-specific.',
      '',
      'Suggested source target:',
      draft.sourcePath || 'source/scenes/events/election_results.scene.dry',
      '',
      'D3 parliament target:',
      draft.useD3Parliament ? ('#' + (draft.chartElementId || '(missing id)')) : 'D3 disabled for this draft',
      '',
      'Use the WYSIWYG preview to adjust party colors, vote/seat values, coalitions, and player choices before wiring it into the event chain.'
    ].join('\n') + '\n';
  }

  function normalizeRows(rows, defaults, normalizer) {
    const source = Array.isArray(rows) && rows.length ? rows : defaults;
    const length = Math.max(defaults.length, source.length);
    return Array.from({length}).map((_, index) => {
      const fallback = defaults[index] || defaults[defaults.length - 1] || {};
      return normalizer(source[index] || fallback, fallback, index);
    });
  }

  function normalizeParty(input, fallback, index) {
    const value = isObject(input) ? input : {};
    return party(
      safeId(value.key || fallback.key || 'party_' + (index + 1)).toLowerCase(),
      singleLine(value.name || fallback.name || 'Party ' + (index + 1)),
      safeColor(value.color || fallback.color || '#999999'),
      numericText(value.voteShare, fallback.voteShare),
      signedNumericText(value.voteChange, fallback.voteChange),
      numericText(value.seatsShare, fallback.seatsShare),
      signedNumericText(value.seatsChange, fallback.seatsChange),
      numericText(value.seats, fallback.seats)
    );
  }

  function normalizeCoalition(input, fallback, index) {
    const value = isObject(input) ? input : {};
    return coalition(
      safeId(value.key || fallback.key || 'coalition_' + (index + 1)).toLowerCase(),
      singleLine(value.name || fallback.name || 'Coalition ' + (index + 1)),
      singleLine(value.parties || fallback.parties || ''),
      numericText(value.share, fallback.share),
      String(value.description || fallback.description || '').trim()
    );
  }

  function normalizeChoice(input, fallback, index) {
    const value = isObject(input) ? input : {};
    return choice(
      safeId(value.key || fallback.key || 'choice_' + (index + 1)).toLowerCase(),
      singleLine(value.label || fallback.label || 'Choice ' + (index + 1)),
      String(value.detail || fallback.detail || '').trim(),
      booleanValue(value.disabled !== undefined ? value.disabled : fallback.disabled),
      String(value.condition || fallback.condition || '').trim(),
      String(value.resultText || fallback.resultText || '').trim(),
      normalizeEffects(value.effects || fallback.effects)
    );
  }

  function party(key, name, color, voteShare, voteChange, seatsShare, seatsChange, seats) {
    return {key, name, color, voteShare, voteChange, seatsShare, seatsChange, seats};
  }

  function coalition(key, name, parties, share, description) {
    return {key, name, parties, share, description: description || ''};
  }

  function choice(key, label, detail, disabled, condition, resultText, effects) {
    return {key, label, detail, disabled: Boolean(disabled), condition: condition || '', resultText: resultText || '', effects: ensureArray(effects)};
  }

  function normalizeEffects(effects) {
    return ensureArray(effects).map((effect, index) => {
      const value = isObject(effect) ? effect : {};
      const variable = String(value.variable || value.name || '').trim();
      const op = String(value.op || value.operator || '+=').trim() || '+=';
      const rawValue = value.value === undefined || value.value === null ? (index === 0 ? '1' : '') : value.value;
      return {
        variable,
        op,
        value: String(rawValue).trim(),
        condition: String(value.condition || '').trim(),
        hook: String(value.hook || '').trim()
      };
    }).filter((effect) => effect.variable || effect.value || effect.condition);
  }

  function collectElectionEvents(projectIndex) {
    const scenes = ensureArray(projectIndex && projectIndex.scenes);
    const rows = scenes.map(electionEventFromScene).filter(Boolean);
    rows.sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)));
    return rows.map((row) => {
      const copy = Object.assign({}, row);
      delete copy.score;
      return copy;
    }).slice(0, 40);
  }

  function electionEventFromScene(scene) {
    if (!isObject(scene)) {
      return null;
    }
    const haystack = sceneSearchText(scene);
    const score = electionScore(scene, haystack);
    if (score <= 0) {
      return null;
    }
    const source = scene.sourceSpan || scene.topLevelSpan || {};
    const path = String(scene.path || source.path || scene.sourcePath || '').trim();
    const title = singleLine(scene.title || scene.name || scene.id || path || 'Election event');
    return {
      id: String(scene.id || scene.name || safeId(title)).trim(),
      title,
      subtitle: inferElectionSubtitle(title, path, haystack),
      path,
      line: Number(source.startLine || source.line || 1) || 1,
      electionKind: inferElectionKind(title, path, haystack),
      year: inferYear(title + ' ' + path),
      month: '',
      viewIf: metadataLine(scene, 'viewIf') || metadataLine(scene, 'requires') || '',
      conditionText: inferConditionText(haystack),
      chartElementId: inferChartElementId(haystack),
      usesD3Parliament: /\bd3\.parliament\b/i.test(haystack),
      reason: score >= 8 ? 'd3_parliament' : 'election_text',
      score
    };
  }

  function sceneSearchText(scene) {
    const chunks = [
      scene.id,
      scene.name,
      scene.title,
      scene.path,
      ensureArray(scene.tags).join(' '),
      scene.sourceSpan && scene.sourceSpan.excerpt,
      scene.topLevelSpan && scene.topLevelSpan.excerpt
    ];
    ensureArray(scene.sections).forEach((section) => {
      chunks.push(section && section.id, section && section.title, section && section.subtitle, section && section.sourceSpan && section.sourceSpan.excerpt);
    });
    ensureArray(scene.options).forEach((option) => chunks.push(option && option.title, option && option.sourceSpan && option.sourceSpan.excerpt));
    return chunks.filter(Boolean).join('\n');
  }

  function electionScore(scene, text) {
    const lower = String(text || '').toLowerCase();
    let score = 0;
    if (/\bd3\.parliament\b/.test(lower)) {
      score += 10;
    }
    if (/election|elections|wahl|landtag|reichstag|parliament|seat chart|results/.test(lower)) {
      score += 3;
    }
    if (/election|landtag|reichstag/.test(String(scene && scene.path || '').toLowerCase())) {
      score += 3;
    }
    if (/election|results|landtag|reichstag/.test(String(scene && scene.title || '').toLowerCase())) {
      score += 2;
    }
    return score;
  }

  function inferChartElementId(text) {
    const source = String(text || '');
    const d3 = source.match(/d3\.select\(\s*["']#([^"']+)["']\s*\)/);
    if (d3 && d3[1]) {
      return d3[1];
    }
    const svg = source.match(/<svg[^>]+id=["']([^"']+)["']/i);
    return svg && svg[1] || '';
  }

  function inferElectionKind(title, path, text) {
    const source = String([title, path, text].join(' ')).toLowerCase();
    if (/landtag|thuringia|prussia|state/.test(source)) {
      return 'state';
    }
    if (/reichstag|parliament/.test(source)) {
      return 'reichstag';
    }
    return 'election';
  }

  function inferElectionSubtitle(title, path, text) {
    const kind = inferElectionKind(title, path, text);
    if (kind === 'state') {
      const state = String(title || path || '').match(/(Thuringia|Prussia|Bavaria|Saxony|Hesse|Hamburg|Berlin)/i);
      return state ? state[1] + ' election results' : 'State election results';
    }
    if (kind === 'reichstag') {
      return 'Reichstag election results';
    }
    return 'Election results';
  }

  function inferYear(text) {
    const match = String(text || '').match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : '';
  }

  function inferConditionText(text) {
    const match = String(text || '').match(/\[\?\s*if\s+([^:\]]+)/i);
    return match ? match[1].trim() : '';
  }

  function metadataLine(scene, key) {
    const metadata = isObject(scene && scene.metadata) ? scene.metadata : {};
    const value = metadata[key] || metadata[key.replace(/[A-Z]/g, (char) => '-' + char.toLowerCase())];
    if (!isObject(value)) {
      return '';
    }
    return String(value.value || value.raw || value.excerpt || '').trim();
  }

  function normalizeElectionEvents(rows) {
    return ensureArray(rows).map((row) => {
      const value = isObject(row) ? row : {};
      return {
        id: String(value.id || '').trim(),
        title: singleLine(value.title || value.id || 'Election event'),
        subtitle: singleLine(value.subtitle || ''),
        path: String(value.path || '').trim(),
        line: Number(value.line || 0) || null,
        electionKind: safeId(value.electionKind || 'election').toLowerCase(),
        year: String(value.year || '').trim(),
        month: String(value.month || '').trim(),
        viewIf: String(value.viewIf || '').trim(),
        conditionText: String(value.conditionText || '').trim(),
        chartElementId: String(value.chartElementId || '').trim(),
        usesD3Parliament: booleanValue(value.usesD3Parliament !== undefined ? value.usesD3Parliament : false),
        reason: String(value.reason || '').trim()
      };
    }).filter((row) => row.id);
  }

  function selectElectionEvent(id, rows) {
    const key = String(id || '').trim();
    return ensureArray(rows).find((row) => row.id === key) || ensureArray(rows)[0] || null;
  }

  function effectLine(effect) {
    const row = isObject(effect) ? effect : {};
    return [row.hook || '', row.variable || '', row.op || '', row.value === undefined ? '' : row.value, row.condition ? 'if ' + row.condition : ''].filter(Boolean).join(' ');
  }

  function installPlanApi() {
    if (global && global.ProjectMapInstallPlan) {
      return global.ProjectMapInstallPlan;
    }
    if (typeof require === 'function') {
      return require('./install_plan.js');
    }
    return null;
  }

  function safeId(value) {
    const text = String(value || '').trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    return /^[A-Za-z_]/.test(text) ? text : 'item_' + (text || '1');
  }

  function safeColor(value) {
    const text = String(value || '').trim();
    return /^#[0-9A-Fa-f]{6}$/.test(text) ? text.toUpperCase() : '#999999';
  }

  function numericText(value, fallback) {
    const text = String(value === undefined || value === null || value === '' ? fallback : value).trim();
    const parsed = Number(text);
    return Number.isFinite(parsed) ? String(parsed) : String(fallback || '0');
  }

  function signedNumericText(value, fallback) {
    const text = numericText(value, fallback);
    return text === '-0' ? '0' : text;
  }

  function singleLine(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function booleanValue(value) {
    if (typeof value === 'boolean') {
      return value;
    }
    return /^(1|true|yes|on|disabled)$/i.test(String(value || '').trim());
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function diagnostic(diagnostics, severity, code, message) {
    diagnostics.push({severity, level: severity, code, message, confidence: 'static'});
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {defaultDraft, normalizeDraft, validateDraft, buildExportBundle, buildInstallPlan, collectElectionEvents};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapElectionResultsDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
