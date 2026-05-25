(function initProjectMapElectionResultsSurface(global) {
  'use strict';

  function render(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const draft = normalizedDraft(model, opts.projectIndex);
    const sourceRows = sourceEventRows(draft, opts.projectIndex);
    const selectedSource = selectedSourceRow(draft, sourceRows);
    const body = model && model.eventBody || {};
    const collapsed = Boolean(opts.boardChromeCollapsed);
    return [
      '<section class="object-canvas-stage election-results-surface" data-object-canvas-stage="true" data-election-results-surface="true" data-object-canvas-workspace="system_ui" aria-label="' + escapeAttr(t('electionResults.surfaceAria', 'Election Results Workspace')) + '">',
      renderToolbar(draft, sourceRows, selectedSource, collapsed),
      '<div class="election-results-layout">',
      renderPreview(draft, selectedSource),
      renderEditor(model, draft, body, sourceRows, selectedSource),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderToolbar(draft, sourceRows, selectedSource, collapsed) {
    return [
      '<header class="object-canvas-stage-toolbar election-results-toolbar' + (collapsed ? ' is-collapsed' : '') + '" data-board-stage-toolbar="true" data-board-toolbar-collapsed="' + (collapsed ? 'true' : 'false') + '">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('authoring.surface.electionResultsBoard', 'Election Results Workspace')) + '</div>',
      '<h3>' + escapeHtml(draft.title || t('create.electionResults', 'Election Results')) + '</h3>',
      '<p>' + escapeHtml(t('electionResults.intent', 'Inspect a source-backed election results screen, tune the chart/table draft, and open the source event when you need direct event editing.')) + '</p>',
      '<div class="election-results-metrics" data-election-results-metrics="true">',
      '<span>' + escapeHtml(String(sourceRows.length)) + ' ' + escapeHtml(t('electionResults.metric.events', 'D3 sources')) + '</span>',
      '<span>' + escapeHtml(String(ensureArray(draft.parties).length)) + ' ' + escapeHtml(t('electionResults.metric.parties', 'parties')) + '</span>',
      '<span>' + escapeHtml(String(ensureArray(draft.effects).length + choiceEffects(draft).length)) + ' ' + escapeHtml(t('electionResults.metric.effects', 'effects')) + '</span>',
      selectedSource && selectedSource.usesD3Parliament ? '<span data-election-results-d3-source="true">d3.parliament</span>' : '',
      '</div>',
      '</div>',
      '<div class="object-canvas-zoom-controls election-results-toolbar-actions">',
      '<button type="button" data-object-canvas-action="open_selected_election_event"' + (selectedSource ? '' : ' disabled') + '>' + escapeHtml(t('electionResults.openSourceEvent', 'Open source event editor')) + '</button>',
      '<button type="button" data-object-canvas-action="create_election_event">' + escapeHtml(t('electionResults.createElectionEvent', 'New linked event draft')) + '</button>',
      '<button type="button" data-object-canvas-action="toggle_board_chrome">' + escapeHtml(collapsed ? t('objectCanvas.expandBoardChrome', 'Expand board details') : t('objectCanvas.collapseBoardChrome', 'Collapse board details')) + '</button>',
      '</div>',
      '</header>'
    ].join('');
  }

  function renderPreview(draft, selectedSource) {
    return [
      '<section class="election-results-preview-panel" data-election-results-preview="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.preview', 'Live preview')) + '</div>',
      '<article class="election-results-paper">',
      '<header class="election-results-paper-header">',
      '<span>' + escapeHtml(t('electionResults.frameLabel', 'Election results frame')) + '</span>',
      '<h1>' + escapeHtml(draft.title || '') + '</h1>',
      '<p>' + escapeHtml(draft.subtitle || '') + '</p>',
      '</header>',
      '<section class="election-results-chart-card">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.region.electionChart', 'Seat chart')) + '</div>',
      renderChart(draft),
      '<small>' + escapeHtml(String(draft.seatsTotal || partySeatTotal(draft.parties) || '') + ' ' + t('systemUi.electionSeats', 'seats')) + '</small>',
      '</section>',
      renderPartyTable(draft.parties),
      renderCoalitions(draft),
      renderPreviewTextBlocks(draft),
      renderChoices(draft.choices),
      '</article>',
      renderSourceSummary(selectedSource, draft),
      '</section>'
    ].join('');
  }

  function renderEditor(model, draft, body, sourceRows, selectedSource) {
    return [
      '<aside class="election-results-editor" data-election-results-editor="true">',
      renderActions(),
      renderSelector(draft, sourceRows, selectedSource),
      renderFieldGroups(body),
      renderChangeSummary(model),
      '</aside>'
    ].join('');
  }

  function renderSelector(draft, sourceRows, selectedSource) {
    return [
      '<section class="object-canvas-inspector-card election-results-source-selector" data-election-results-source-selector="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('electionResults.selectedEvent', 'Selected D3 source')) + '</div>',
      '<label class="object-inline-field">',
      '<span>' + escapeHtml(t('electionResults.eventSelector', 'D3 parliament source')) + '</span>',
      '<select class="object-inline-input" data-object-canvas-field="election.targetSceneId" data-editing-field="election.targetSceneId">',
      sourceRows.length ? sourceRows.map((row) => '<option value="' + escapeAttr(row.id) + '"' + (row.id === draft.targetSceneId ? ' selected' : '') + '>' + escapeHtml(row.title || row.id) + '</option>').join('') : '<option value="">' + escapeHtml(t('electionResults.noElectionEvents', 'No indexed D3 parliament source')) + '</option>',
      '</select>',
      '<small>' + escapeHtml(t('electionResults.eventSelectorHelp', 'Switch which source event supplies d3.parliament seat-chart and party-table evidence for this draft.')) + '</small>',
      '</label>',
      selectedSource ? renderSourceDetails(selectedSource) : '<p class="editing-empty">' + escapeHtml(t('electionResults.noSourceEventHelp', 'Create a linked event draft or enter a source target manually.')) + '</p>',
      '<button type="button" data-object-canvas-action="open_selected_election_event"' + (selectedSource ? '' : ' disabled') + '>' + escapeHtml(t('electionResults.openSourceEvent', 'Open source event editor')) + '</button>',
      '<button type="button" data-object-canvas-action="create_election_event">' + escapeHtml(t('electionResults.createElectionEvent', 'New linked event draft')) + '</button>',
      '</section>'
    ].join('');
  }

  function renderFieldGroups(body) {
    const fields = [body.title, body.heading].filter(Boolean).concat(ensureArray(body.sections));
    return [
      '<section class="object-event-body election-results-fields" data-object-canvas-event-body="true">',
      '<div class="template-eyebrow">' + escapeHtml(body.bodyEyebrow || t('electionResults.editDefinition', 'Election definition')) + '</div>',
      fields.length ? fields.map(renderField).join('') : '<p class="editing-empty">' + escapeHtml(t('objectCanvas.noBodyFields', 'No player-facing body fields are available yet.')) + '</p>',
      renderEffectGroup(body.effects, t('electionResults.effects', 'Event effects')),
      renderOptions(body.options, body.optionEffects),
      renderMetaFields(body.metaFields, body.metaLabel),
      '</section>'
    ].join('');
  }

  function renderEffectGroup(fields, label) {
    const items = ensureArray(fields);
    if (!items.length) {
      return '';
    }
    return [
      '<details class="object-event-meta election-results-effect-editor" open>',
      '<summary>' + escapeHtml(label) + '</summary>',
      '<div class="object-event-meta-grid">',
      items.map(renderField).join(''),
      '</div>',
      '</details>'
    ].join('');
  }

  function renderOptions(options, optionEffects) {
    const rows = ensureArray(options);
    const effectRows = ensureArray(optionEffects);
    if (!rows.length) {
      return '<p class="editing-empty">' + escapeHtml(t('objectCanvas.noOptions', 'No options found for this object.')) + '</p>';
    }
    return [
      '<section class="object-event-options election-results-choice-editor">',
      '<h3>' + escapeHtml(t('electionResults.choices', 'Player choices')) + '</h3>',
      rows.map((option, index) => renderOption(option, effectRows[index], index)).join(''),
      '</section>'
    ].join('');
  }

  function renderOption(option, effectGroup, index) {
    const fields = ensureArray(option && option.fields);
    return [
      '<article class="object-event-option election-results-choice-edit">',
      '<div class="object-event-option-index">' + escapeHtml(String(index + 1)) + '</div>',
      '<div class="object-event-option-fields">',
      fields.map(renderField).join(''),
      effectGroup ? renderEffectGroup(effectGroup.fields, t('electionResults.choiceEffects', 'Choice effects')) : '',
      '</div>',
      '</article>'
    ].join('');
  }

  function renderMetaFields(fields, label) {
    const items = ensureArray(fields);
    if (!items.length) {
      return '';
    }
    return [
      '<details class="object-event-meta election-results-meta" open>',
      '<summary>' + escapeHtml(label || t('objectCanvas.advancedFields', 'Timing and advanced fields')) + '</summary>',
      '<div class="object-event-meta-grid">',
      items.map(renderField).join(''),
      '</div>',
      '</details>'
    ].join('');
  }

  function renderField(field) {
    const value = String(field && field.value !== undefined ? field.value : field && field.original || '');
    const id = field && field.id || '';
    const inputType = String(field && (field.inputType || field.control) || '').trim();
    const readOnly = field && (field.readOnly || !id);
    if (inputType === 'checkbox') {
      return [
        '<label class="object-inline-field object-inline-field-checkbox object-inline-field-' + escapeAttr(field && field.status || 'guarded') + '">',
        '<input type="checkbox" class="object-inline-input" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '"' + (isChecked(value) ? ' checked' : '') + (readOnly ? ' disabled' : '') + '>',
        '<span>' + escapeHtml(field && field.label || id || '') + '</span>',
        field && field.help ? '<small>' + escapeHtml(field.help) + '</small>' : '',
        '</label>'
      ].join('');
    }
    if (inputType === 'select' && Array.isArray(field && field.options)) {
      return [
        '<label class="object-inline-field object-inline-field-' + escapeAttr(field && field.status || 'guarded') + '">',
        '<span>' + escapeHtml(field && field.label || id || '') + '</span>',
        '<select class="object-inline-input" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '"' + (readOnly ? ' disabled' : '') + '>',
        field.options.map((option) => renderOptionValue(option, value)).join(''),
        '</select>',
        field && field.help ? '<small>' + escapeHtml(field.help) + '</small>' : '',
        '</label>'
      ].join('');
    }
    const tag = inputType === 'textarea' || value.indexOf('\n') >= 0 || value.length > 96 || /body|text|intro|result|condition|effect|source/i.test(id + ' ' + (field && field.label || '')) ? 'textarea' : 'input';
    return [
      '<label class="object-inline-field object-inline-field-' + escapeAttr(field && field.status || 'guarded') + '">',
      '<span>' + escapeHtml(field && field.label || id || '') + '</span>',
      tag === 'textarea'
        ? '<textarea rows="' + rowsFor(value) + '" class="object-inline-input" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '"' + (readOnly ? ' readonly' : '') + '>' + escapeHtml(value) + '</textarea>'
        : '<input type="' + escapeAttr(inputType === 'color' || inputType === 'number' ? inputType : 'text') + '" class="object-inline-input" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '" value="' + escapeAttr(value) + '"' + (readOnly ? ' readonly' : '') + '>',
      field && field.help ? '<small>' + escapeHtml(field.help) + '</small>' : '',
      '</label>'
    ].join('');
  }

  function renderOptionValue(option, current) {
    const value = typeof option === 'string' ? option : String(option && option.value || '');
    const label = typeof option === 'string' ? option : String(option && (option.label || option.value) || '');
    return '<option value="' + escapeAttr(value) + '"' + (value === current ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
  }

  function renderChart(draft) {
    const chart = chartApi();
    if (chart && typeof chart.render === 'function') {
      return chart.render(draft.parties, {
        seatsTotal: Number(draft.seatsTotal) || partySeatTotal(draft.parties),
        label: draft.subtitle || draft.title || 'Election results',
        innerRadiusCoef: 0.4
      });
    }
    return '<div class="editing-empty">' + escapeHtml(t('electionResults.chartMissing', 'Seat chart renderer is unavailable.')) + '</div>';
  }

  function renderPartyTable(parties) {
    const rows = ensureArray(parties);
    return [
      '<section class="election-results-table-card" data-election-results-party-table="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('systemUi.region.electionTable', 'Party result table')) + '</div>',
      '<div class="system-election-table">',
      '<div class="system-election-table-head"><span>' + escapeHtml(t('systemUi.party', 'Party')) + '</span><span>' + escapeHtml(t('systemUi.voteShare', 'Vote share')) + '</span><span>' + escapeHtml(t('systemUi.change', '% Change')) + '</span><span>' + escapeHtml(t('systemUi.seatsShare', 'Reichstag Seats')) + '</span><span>' + escapeHtml(t('systemUi.change', '% Change')) + '</span></div>',
      rows.map((party) => '<div class="system-election-table-row"><strong class="system-election-party-cell"><span class="system-election-swatch" style="--party-color: ' + escapeAttr(party.color || '#999999') + ';"></span>' + escapeHtml(party.name || '') + '</strong><span>' + escapeHtml(formatPercent(party.voteShare)) + '</span>' + renderDelta(party.voteChange) + '<span>' + escapeHtml(formatPercent(party.seatsShare)) + '</span>' + renderDelta(party.seatsChange) + '</div>').join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderCoalitions(draft) {
    const rows = ensureArray(draft.coalitions);
    return [
      '<section class="election-results-coalition-card" data-election-results-coalitions="true">',
      '<h2>' + escapeHtml(t('systemUi.potentialCoalitions', 'Potential coalitions')) + '</h2>',
      draft.intro ? '<p>' + renderInline(draft.intro) + '</p>' : '',
      rows.map((coalition) => '<div class="system-election-coalition-row"><strong>' + escapeHtml(coalition.name || '') + '</strong><span>(' + renderPartyFormula(coalition.parties, draft.parties) + '): ' + escapeHtml(formatPercent(coalition.share)) + '</span>' + (coalition.description ? '<small>' + escapeHtml(coalition.description) + '</small>' : '') + '</div>').join(''),
      '</section>'
    ].join('');
  }

  function renderPreviewTextBlocks(draft) {
    const conditions = String(draft.viewIf || draft.conditionText || '').trim();
    const result = String(draft.resultText || '').trim();
    const effects = ensureArray(draft.effects);
    if (!conditions && !result && !effects.length) {
      return '';
    }
    return [
      '<section class="election-results-logic-card" data-election-results-logic="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('electionResults.logicAndConsequences', 'Conditions and consequences')) + '</div>',
      conditions ? '<article><span>' + escapeHtml(t('electionResults.conditions', 'Conditions')) + '</span><code>' + escapeHtml(conditions) + '</code></article>' : '',
      result ? '<article><span>' + escapeHtml(t('electionResults.resultText', 'Result text')) + '</span><p>' + renderInline(result) + '</p></article>' : '',
      effects.length ? '<article><span>' + escapeHtml(t('electionResults.effects', 'Effects')) + '</span>' + effects.map((effect) => '<code>' + escapeHtml(formatEffect(effect)) + '</code>').join('') + '</article>' : '',
      '</section>'
    ].join('');
  }

  function renderChoices(choices) {
    const rows = ensureArray(choices);
    return [
      '<section class="system-election-choice-list" data-election-results-choices="true">',
      rows.map((choice, index) => [
        '<article class="system-election-choice' + (choice.disabled ? ' is-disabled' : '') + '">',
        '<span class="system-election-choice-index">' + escapeHtml(String(index + 1)) + '</span>',
        '<div>',
        '<strong>' + renderInline(choice.label || '') + '</strong>',
        choice.detail ? '<em>' + renderInline(choice.detail) + '</em>' : '',
        choice.condition ? '<code>' + escapeHtml(t('electionResults.conditionPrefix', 'if') + ' ' + choice.condition) + '</code>' : '',
        choice.resultText ? '<p>' + renderInline(choice.resultText) + '</p>' : '',
        ensureArray(choice.effects).length ? '<div class="election-results-effect-chips">' + ensureArray(choice.effects).map((effect) => '<span>' + escapeHtml(formatEffect(effect)) + '</span>').join('') + '</div>' : '',
        '</div>',
        '</article>'
      ].join('')).join(''),
      '</section>'
    ].join('');
  }

  function renderSourceSummary(source, draft) {
    return [
      '<section class="election-results-source-card" data-election-results-source-summary="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('electionResults.sourceEvidence', 'Election source evidence')) + '</div>',
      '<h3>' + escapeHtml(source && source.title || draft.title || '') + '</h3>',
      '<p><code>' + escapeHtml(source && source.path || draft.sourcePath || '') + '</code></p>',
      '<p>' + escapeHtml(source && source.usesD3Parliament ? t('electionResults.usesD3Parliament', 'This source uses d3.parliament with an SVG target.') : t('electionResults.d3CompatiblePreview', 'Preview uses the d3.parliament data contract for the seat chart.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderSourceDetails(source) {
    return [
      '<dl class="election-results-source-facts">',
      '<dt>' + escapeHtml(t('objectCanvas.identity.id', 'ID')) + '</dt><dd>' + escapeHtml(source.id || '') + '</dd>',
      '<dt>' + escapeHtml(t('objectCanvas.identity.source', 'Source')) + '</dt><dd><code>' + escapeHtml(source.path ? source.path + (source.line ? ':' + source.line : '') : '') + '</code></dd>',
      '<dt>' + escapeHtml(t('electionResults.chartTarget', 'Chart target')) + '</dt><dd>' + escapeHtml(source.chartElementId || '') + '</dd>',
      '<dt>D3</dt><dd>' + escapeHtml(source.usesD3Parliament ? 'd3.parliament' : t('electionResults.notDetected', 'not detected')) + '</dd>',
      '</dl>'
    ].join('');
  }

  function renderActions() {
    return [
      '<section class="object-canvas-command-dock election-results-command-dock" data-object-canvas-command-dock="true">',
      '<div class="object-canvas-command-head">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('objectCanvas.changeTitle', 'Change and safety')) + '</div>',
      '<h3>' + escapeHtml(t('electionResults.editDefinition', 'Election definition')) + '</h3>',
      '</div>',
      '</div>',
      '<div class="editing-actions object-canvas-actions">',
      '<button type="button" data-object-canvas-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button type="button" data-object-canvas-action="save">' + escapeHtml(t('editing.saveToChanges', 'Save to My Changes')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      '</div>',
      '</section>'
    ].join('');
  }

  function renderChangeSummary(model) {
    const change = model && model.changeState || {};
    const summary = change.operationSummary || {};
    return [
      '<section class="editing-summary election-results-summary">',
      '<h3>' + escapeHtml(t('objectCanvas.changeTitle', 'Change and safety')) + '</h3>',
      '<div class="editing-summary-grid">',
      summaryBox(t('editing.summary.guarded', 'Guarded'), summary.guardedApply),
      summaryBox(t('editing.summary.manual', 'Manual'), summary.manualReview),
      summaryBox(t('objectCanvas.changedFields', 'Changed'), change.changedCount),
      '</div>',
      '</section>'
    ].join('');
  }

  function summaryBox(label, value) {
    return '<div class="editing-summary-box"><strong>' + escapeHtml(String(Number(value || 0))) + '</strong><span>' + escapeHtml(label) + '</span></div>';
  }

  function normalizedDraft(model, projectIndex) {
    const source = model && model.changeState && (model.changeState.draft || model.changeState.proposal) || {};
    const api = draftApi();
    if (api && typeof api.normalizeDraft === 'function') {
      try {
        return api.normalizeDraft(source, projectIndex);
      } catch (_err) {
        return source || {};
      }
    }
    return source || {};
  }

  function sourceEventRows(draft, projectIndex) {
    const api = draftApi();
    const rows = ensureArray(draft && draft.electionEvents);
    const collected = api && typeof api.collectElectionEvents === 'function'
      ? api.collectElectionEvents(projectIndex)
      : [];
    const merged = [];
    const seen = new Set();
    rows.concat(collected).forEach((row) => {
      const id = String(row && row.id || '').trim();
      if (!id || seen.has(id)) {
        return;
      }
      seen.add(id);
      merged.push(row);
    });
    return merged;
  }

  function selectedSourceRow(draft, rows) {
    return ensureArray(rows).find((row) => row && row.id === draft.targetSceneId) || ensureArray(rows)[0] || null;
  }

  function draftApi() {
    return global.ProjectMapElectionResultsDraft || null;
  }

  function chartApi() {
    return global.ProjectMapElectionResultsChart || null;
  }

  function richTextApi() {
    return global.ProjectMapVisibleTextRenderer || null;
  }

  function renderInline(value) {
    const renderer = richTextApi();
    return renderer && typeof renderer.renderInline === 'function'
      ? renderer.renderInline(value)
      : escapeHtml(value);
  }

  function renderPartyFormula(value, parties) {
    return String(value || '').split('+').map((part) => {
      const name = part.trim();
      const party = ensureArray(parties).find((row) => row && row.name && row.name.toLowerCase() === name.toLowerCase());
      const color = party && party.color || '#3f3522';
      return '<span class="system-election-party-name" style="--party-color: ' + escapeAttr(color) + ';">' + escapeHtml(name) + '</span>';
    }).join(' <span class="system-election-plus">+</span> ');
  }

  function renderDelta(value) {
    const parsed = Number(value);
    const className = parsed >= 0 ? 'is-positive' : 'is-negative';
    const symbol = parsed >= 0 ? '&#9650;' : '&#9660;';
    return '<span class="system-election-delta ' + className + '"><span aria-hidden="true">' + symbol + '</span> ' + escapeHtml(Math.abs(Number.isFinite(parsed) ? parsed : 0)) + '</span>';
  }

  function formatPercent(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(parsed).replace(/\.0$/, '') + '%' : String(value || '');
  }

  function formatEffect(effect) {
    const row = effect && typeof effect === 'object' ? effect : {};
    return [row.hook || '', row.variable || '', row.op || '', row.value === undefined ? '' : row.value, row.condition ? 'if ' + row.condition : ''].filter(Boolean).join(' ');
  }

  function choiceEffects(draft) {
    return ensureArray(draft && draft.choices).reduce((all, choice) => all.concat(ensureArray(choice && choice.effects)), []);
  }

  function partySeatTotal(parties) {
    return ensureArray(parties).reduce((total, party) => total + (Number(party && party.seats) || 0), 0);
  }

  function rowsFor(value) {
    const text = String(value || '');
    return String(Math.max(3, Math.min(10, text.split('\n').length + Math.floor(text.length / 120))));
  }

  function isChecked(value) {
    return /^(1|true|yes|on)$/i.test(String(value || '').trim());
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  const api = {render};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapElectionResultsSurface = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
