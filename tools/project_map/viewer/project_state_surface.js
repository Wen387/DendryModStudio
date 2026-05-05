(function initProjectMapProjectStateSurface(global) {
  'use strict';

  function render(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const selected = String(opts.selected || 'object');
    const rows = variableRows(opts.projectIndex, model);
    const selectedVariable = selected.indexOf('variable:') === 0
      ? rows.find((row) => row.name === selected.slice('variable:'.length))
      : rows[0] || null;
    return [
      '<section class="object-canvas-stage project-state-surface" data-object-canvas-stage="true" data-project-state-surface="true" data-object-canvas-workspace="project_state" aria-label="' + escapeAttr(t('projectState.surfaceAria', 'Project State Dependency Board')) + '">',
      '<header class="object-canvas-stage-toolbar">',
      '<div><div class="template-eyebrow">' + escapeHtml(t('authoring.surface.projectStateBoard', 'Project State Board')) + '</div><h3>' + escapeHtml(model.title || t('authoring.workspace.projectState', 'Project State')) + '</h3></div>',
      '<div class="object-canvas-zoom-controls"><button type="button" data-object-canvas-action="legacy_form">' + escapeHtml(t('objectCanvas.legacyForm', 'Advanced Form')) + '</button></div>',
      '</header>',
      '<div class="project-state-layout">',
      renderVariableBoard(rows, selectedVariable),
      renderStateInspector(model, selectedVariable),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderVariableBoard(rows, selected) {
    const items = rows.length ? rows : [emptyVariable()];
    return [
      '<section class="project-state-board" data-project-state-board="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('projectState.variables', 'Variables')) + '</div>',
      '<div class="project-state-table" role="table">',
      '<div class="project-state-row project-state-row-head" role="row">',
      '<span>' + escapeHtml(t('projectState.variable', 'Variable')) + '</span>',
      '<span>' + escapeHtml(t('projectState.reads', 'Reads')) + '</span>',
      '<span>' + escapeHtml(t('projectState.writes', 'Writes')) + '</span>',
      '<span>' + escapeHtml(t('projectState.diagnostic', 'Diagnostic')) + '</span>',
      '</div>',
      items.map((row) => renderVariableRow(row, selected)).join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderVariableRow(row, selected) {
    const active = selected && selected.name === row.name;
    return [
      '<button type="button" class="project-state-row' + (active ? ' is-selected' : '') + '" data-object-canvas-graph-node="variable:' + escapeAttr(row.name) + '" data-project-state-variable-row="' + escapeAttr(row.name) + '" role="row">',
      '<strong>Q.' + escapeHtml(row.name || '') + '</strong>',
      '<span>' + escapeHtml(String(row.readCount || 0)) + '</span>',
      '<span>' + escapeHtml(String(row.writeCount || 0)) + '</span>',
      '<em>' + escapeHtml(row.diagnostic) + '</em>',
      '</button>'
    ].join('');
  }

  function renderStateInspector(model, variable) {
    return [
      '<aside class="project-state-inspector" data-project-state-inspector="true">',
      variable ? renderVariableInspector(variable) : renderProjectInspector(model),
      renderEditorFields(model),
      renderActions(),
      '</aside>'
    ].join('');
  }

  function renderVariableInspector(variable) {
    return [
      '<section class="object-canvas-inspector-card" data-project-state-consumers="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('projectState.consumerMap', 'Consumer map')) + '</div>',
      '<h3>Q.' + escapeHtml(variable.name) + '</h3>',
      '<p>' + escapeHtml(variable.diagnostic) + '</p>',
      '<div class="project-state-consumer-columns">',
      renderRefs(t('projectState.readBy', 'Read by'), variable.reads),
      renderRefs(t('projectState.writtenBy', 'Written by'), variable.writes),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderProjectInspector(model) {
    const source = model.source || {};
    return [
      '<section class="object-canvas-inspector-card" data-project-state-metadata="true">',
      '<div class="template-eyebrow">' + escapeHtml(t('projectState.metadata', 'Project metadata')) + '</div>',
      '<h3>' + escapeHtml(model.title || t('create.gameInfo', 'Game Info')) + '</h3>',
      '<p>' + escapeHtml(source.path ? source.path + (source.line ? ':' + source.line : '') : t('projectState.noSource', 'No source evidence loaded.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderRefs(title, refs) {
    const items = ensureArray(refs);
    return [
      '<div class="project-state-ref-list">',
      '<strong>' + escapeHtml(title) + '</strong>',
      items.length
        ? items.slice(0, 8).map((ref) => '<span>' + escapeHtml(sourceLabel(ref)) + '</span>').join('')
        : '<span>' + escapeHtml(t('projectState.noRefs', 'No source-backed references.')) + '</span>',
      '</div>'
    ].join('');
  }

  function renderEditorFields(model) {
    const body = model.eventBody || {};
    const fields = [body.title, body.heading].filter(Boolean)
      .concat(ensureArray(body.sections))
      .concat(ensureArray(body.metaFields));
    return [
      '<section class="object-event-body" data-object-canvas-event-body="true">',
      '<div class="template-eyebrow">' + escapeHtml(body.bodyEyebrow || t('projectState.editDefinition', 'Edit definition')) + '</div>',
      fields.length
        ? fields.map(renderField).join('')
        : '<p class="editing-empty">' + escapeHtml(t('objectCanvas.noBodyFields', 'No player-facing body fields are available yet.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderField(field) {
    const value = String(field && field.value !== undefined ? field.value : field && field.original || '');
    const id = field && field.id || '';
    return [
      '<label class="object-inline-field">',
      '<span>' + escapeHtml(field && field.label || id || '') + '</span>',
      '<input type="text" class="object-inline-input" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '" value="' + escapeAttr(value) + '"' + (field && field.readOnly ? ' readonly' : '') + '>',
      '</label>'
    ].join('');
  }

  function renderActions() {
    return [
      '<div class="editing-actions object-canvas-actions">',
      '<button type="button" data-object-canvas-action="refresh">' + escapeHtml(t('existingScene.refresh', 'Refresh proposal')) + '</button>',
      '<button type="button" data-object-canvas-action="save">' + escapeHtml(t('editing.saveToChanges', 'Save to My Changes')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review">' + escapeHtml(t('existingScene.review', 'Review & Apply')) + '</button>',
      '</div>'
    ].join('');
  }

  function variableRows(projectIndex, model) {
    const byName = {};
    ensureArray(projectIndex && projectIndex.variables).forEach((variable) => {
      const name = String(variable && variable.name || '').trim();
      if (!name) {
        return;
      }
      byName[name] = normalizeVariable(variable);
    });
    ensureArray(model && model.contextBoard && model.contextBoard.variables).forEach((variable) => {
      const name = String(variable && variable.name || '').trim();
      if (name && !byName[name]) {
        byName[name] = normalizeVariable(variable);
      }
    });
    const draftName = model && model.changeState && model.changeState.draft && model.changeState.draft.variableName;
    if (draftName && !byName[draftName]) {
      byName[draftName] = normalizeVariable({name: draftName, reads: [], writes: []});
    }
    return Object.keys(byName).sort().map((name) => withDiagnostic(byName[name]));
  }

  function normalizeVariable(variable) {
    const reads = ensureArray(variable.reads);
    const writes = ensureArray(variable.writes);
    return {
      name: String(variable.name || ''),
      reads,
      writes,
      readCount: Number(variable.readCount || reads.length || 0),
      writeCount: Number(variable.writeCount || writes.length || 0)
    };
  }

  function withDiagnostic(row) {
    let diagnostic = t('projectState.diagnostic.ok', 'Used');
    if (!row.readCount && !row.writeCount) {
      diagnostic = t('projectState.diagnostic.orphan', 'Orphan');
    } else if (!row.readCount) {
      diagnostic = t('projectState.diagnostic.writeOnly', 'Write-only');
    } else if (!row.writeCount) {
      diagnostic = t('projectState.diagnostic.readOnly', 'Read-only');
    }
    return Object.assign({}, row, {diagnostic});
  }

  function emptyVariable() {
    return withDiagnostic({name: 'new_variable', reads: [], writes: [], readCount: 0, writeCount: 0});
  }

  function sourceLabel(ref) {
    const value = ref && typeof ref === 'object' ? ref : {};
    return value.path ? value.path + (value.line ? ':' + value.line : '') : t('projectState.noSource', 'No source evidence loaded.');
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
    global.ProjectMapProjectStateSurface = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
