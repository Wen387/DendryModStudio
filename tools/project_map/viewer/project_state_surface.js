(function initProjectMapProjectStateSurface(global) {
  'use strict';

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;
  const escapeHtml = domTextUtils.escapeHtml;
  const escapeAttr = domTextUtils.escapeAttr;

  const DEFAULT_ROW_LIMIT = 120;
  const ROW_LIMIT_STEP = 120;
  const rowCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function render(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const selected = String(opts.selected || 'object');
    const rowModel = variableRowModel(opts.projectIndex, model, {
      selected,
      query: opts.query || opts.variableQuery,
      limit: opts.limit || opts.variableLimit
    });
    const collapsed = Boolean(opts.boardChromeCollapsed);
    return [
      '<section class="object-canvas-stage project-state-surface" data-object-canvas-stage="true" data-project-state-surface="true" data-object-canvas-workspace="project_state" aria-label="' + escapeAttr(t('projectState.surfaceAria', 'Project State Dependency Board')) + '">',
      '<header class="object-canvas-stage-toolbar project-state-toolbar' + (collapsed ? ' is-collapsed' : '') + '" data-board-stage-toolbar="true" data-board-toolbar-collapsed="' + (collapsed ? 'true' : 'false') + '">',
      '<div><div class="template-eyebrow">' + escapeHtml(t('authoring.surface.projectStateBoard', 'Project State Board')) + '</div><h3>' + escapeHtml(model.title || t('authoring.workspace.projectState', 'Project State')) + '</h3></div>',
      '<div class="object-canvas-zoom-controls">',
      '<button type="button" data-object-canvas-action="project_state_new_variable">' + escapeHtml(t('projectState.addVariable', 'Add variable')) + '</button>',
      '<button type="button" data-object-canvas-action="project_state_edit_selected">' + escapeHtml(t('projectState.editSelected', 'Edit selected')) + '</button>',
      '<button class="danger-action" type="button" data-object-canvas-action="project_state_delete_selected">' + escapeHtml(t('projectState.deleteSelected', 'Delete selected')) + '</button>',
      '</div>',
      '</header>',
      '<div class="project-state-layout">',
      renderVariableBoard(rowModel),
      renderStateInspector(model, rowModel.selectedVariable),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderVariableBoard(rowModel) {
    const items = rowModel.visibleRows;
    return [
      '<section class="project-state-board" data-project-state-board="true">',
      '<div class="project-state-board-head">',
      '<div><div class="template-eyebrow">' + escapeHtml(t('projectState.variables', 'Variables')) + '</div>',
      '<p>' + escapeHtml(summaryLabel(rowModel)) + '</p></div>',
      rowModel.query ? '<button type="button" data-object-canvas-action="project_state_clear_search">' + escapeHtml(t('projectState.clearSearch', 'Clear')) + '</button>' : '',
      '</div>',
      '<label class="project-state-search">',
      '<span>' + escapeHtml(t('projectState.search', 'Search variables')) + '</span>',
      '<input type="search" data-project-state-variable-search="true" value="' + escapeAttr(rowModel.query) + '" placeholder="' + escapeAttr(t('projectState.searchPlaceholder', 'name, tag, source...')) + '" autocomplete="off">',
      '</label>',
      '<div class="project-state-table" role="table">',
      '<div class="project-state-row project-state-row-head" role="row">',
      '<span>' + escapeHtml(t('projectState.variable', 'Variable')) + '</span>',
      '<span>' + escapeHtml(t('projectState.reads', 'Reads')) + '</span>',
      '<span>' + escapeHtml(t('projectState.writes', 'Writes')) + '</span>',
      '<span>' + escapeHtml(t('projectState.diagnostic', 'Diagnostic')) + '</span>',
      '</div>',
      items.length
        ? items.map((row) => renderVariableRow(row, rowModel.selectedVariable)).join('')
        : '<div class="project-state-empty">' + escapeHtml(rowModel.query ? t('projectState.noMatches', 'No matching variables.') : t('projectState.noVariables', 'No variables were indexed.')) + '</div>',
      '</div>',
      rowModel.remaining > 0
        ? '<button class="project-state-more" type="button" data-object-canvas-action="project_state_show_more">' + escapeHtml(t('projectState.showMore', 'Show {count} more').replace('{count}', String(Math.min(ROW_LIMIT_STEP, rowModel.remaining)))) + '</button>'
        : '',
      '</section>'
    ].join('');
  }

  function renderVariableRow(row, selected) {
    const active = selected && selected.name === row.name;
    return [
      '<button type="button" class="project-state-row' + (active ? ' is-selected' : '') + '" data-object-canvas-graph-node="variable:' + escapeAttr(row.name) + '" data-project-state-variable-row="' + escapeAttr(row.name) + '" role="row" aria-selected="' + (active ? 'true' : 'false') + '">',
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
      renderActions(),
      variable ? renderVariableInspector(variable) : renderProjectInspector(model),
      renderEditorFields(model),
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

  function renderInspectorCard(model, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const variable = variableForInspector(opts.projectIndex, model, opts.selected);
    return variable ? renderVariableInspector(variable) : renderProjectInspector(model || {});
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
    const inputType = String(field && (field.inputType || field.control) || '').trim();
    if (inputType === 'checkbox') {
      return [
        '<label class="object-inline-field object-inline-field-checkbox">',
        '<input type="checkbox" class="object-inline-input" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '"' + (isChecked(value) ? ' checked' : '') + (field && field.readOnly ? ' disabled' : '') + '>',
        '<span>' + escapeHtml(field && field.label || id || '') + '</span>',
        '</label>'
      ].join('');
    }
    if (inputType === 'select' && Array.isArray(field && field.options)) {
      return [
        '<label class="object-inline-field">',
        '<span>' + escapeHtml(field && field.label || id || '') + '</span>',
        '<select class="object-inline-input" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '"' + (field && field.readOnly ? ' disabled' : '') + '>',
        field.options.map((option) => renderOption(option, value)).join(''),
        '</select>',
        '</label>'
      ].join('');
    }
    const multiline = inputType === 'textarea' || value.indexOf('\n') >= 0 || value.length > 88 || /description|body|text|lines/i.test(field && field.label || id);
    return [
      '<label class="object-inline-field">',
      '<span>' + escapeHtml(field && field.label || id || '') + '</span>',
      multiline
        ? '<textarea rows="' + rowsFor(value) + '" class="object-inline-input" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '"' + (field && field.readOnly ? ' readonly' : '') + '>' + escapeHtml(value) + '</textarea>'
        : '<input type="text" class="object-inline-input" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '" value="' + escapeAttr(value) + '"' + (field && field.readOnly ? ' readonly' : '') + '>',
      '</label>'
    ].join('');
  }

  function renderOption(option, current) {
    const value = typeof option === 'string' ? option : String(option && option.value || '');
    const label = typeof option === 'string' ? option : String(option && (option.label || option.value) || '');
    return '<option value="' + escapeAttr(value) + '"' + (value === current ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
  }

  function rowsFor(value) {
    const text = String(value || '');
    return String(Math.max(3, Math.min(8, text.split('\n').length + Math.floor(text.length / 120))));
  }

  function isChecked(value) {
    return /^(1|true|yes|on)$/i.test(String(value || '').trim());
  }

  function renderActions() {
    return [
      '<section class="object-canvas-command-dock project-state-command-dock" data-object-canvas-command-dock="true">',
      '<div class="object-canvas-command-head">',
      '<div>',
      '<div class="template-eyebrow">' + escapeHtml(t('objectCanvas.changeTitle', 'Change and safety')) + '</div>',
      '<h3>' + escapeHtml(t('authoring.workspace.projectState', 'Project State')) + '</h3>',
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

  function variableRowModel(projectIndex, model, options) {
    const opts = options || {};
    const base = cachedVariableRows(projectIndex);
    const merged = mergeVariableRows(base, model);
    const query = normalizeQuery(opts.query);
    const selectedName = selectedVariableName(opts.selected) || draftVariableName(model);
    const filtered = query ? merged.rows.filter((row) => row.searchTextLower.includes(query)) : merged.rows;
    const selectedCandidate = selectedName ? merged.byName.get(selectedName) : null;
    const selectedMatches = selectedCandidate && (!query || selectedCandidate.searchTextLower.includes(query));
    const selectedBase = selectedMatches ? selectedCandidate : filtered[0] || (!query ? merged.rows[0] : null);
    const limit = Math.max(1, Number(opts.limit) || DEFAULT_ROW_LIMIT);
    const visibleBase = visibleRows(filtered, selectedBase, limit);
    const visibleRowsWithDiagnostics = visibleBase.map(withDiagnostic);
    const selectedVariable = selectedBase ? withDiagnostic(selectedBase) : (visibleRowsWithDiagnostics[0] || null);
    return {
      query,
      totalCount: merged.rows.length,
      matchCount: filtered.length,
      limit,
      remaining: Math.max(0, filtered.length - visibleBase.length),
      visibleRows: visibleRowsWithDiagnostics,
      selectedVariable
    };
  }

  function cachedVariableRows(projectIndex) {
    const index = projectIndex && typeof projectIndex === 'object' ? projectIndex : null;
    if (index && rowCache && rowCache.has(index)) {
      return rowCache.get(index);
    }
    const byName = new Map();
    ensureArray(projectIndex && projectIndex.variables).forEach((variable) => {
      const name = String(variable && variable.name || '').trim();
      if (!name) {
        return;
      }
      byName.set(name, normalizeVariable(variable));
    });
    const rows = Array.from(byName.values()).sort(compareVariableRows);
    const cached = {rows, byName};
    if (index && rowCache) {
      rowCache.set(index, cached);
    }
    return cached;
  }

  function mergeVariableRows(base, model) {
    const extras = [];
    const byName = base && base.byName instanceof Map ? base.byName : new Map();
    const seen = new Set(Array.from(byName.keys()));
    ensureArray(model && model.contextBoard && model.contextBoard.variables).forEach((variable) => {
      const name = String(variable && variable.name || '').trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        extras.push(normalizeVariable(variable));
      }
    });
    const draftName = model && model.changeState && model.changeState.draft && model.changeState.draft.variableName;
    if (draftName && !seen.has(String(draftName))) {
      extras.push(normalizeVariable({name: draftName, reads: [], writes: []}));
    }
    if (!extras.length) {
      return base;
    }
    const mergedByName = new Map(byName);
    extras.forEach((row) => mergedByName.set(row.name, row));
    return {
      rows: (base.rows || []).concat(extras).sort(compareVariableRows),
      byName: mergedByName
    };
  }

  function variableForInspector(projectIndex, model, selected) {
    const selectedName = selectedVariableName(selected) || draftVariableName(model);
    if (!selectedName) {
      return null;
    }
    const base = cachedVariableRows(projectIndex);
    const existing = base && base.byName && base.byName.get(selectedName);
    if (existing) {
      return withDiagnostic(existing);
    }
    const contextual = ensureArray(model && model.contextBoard && model.contextBoard.variables)
      .map(normalizeVariable)
      .find((row) => row.name === selectedName);
    if (contextual) {
      return withDiagnostic(contextual);
    }
    const draftName = draftVariableName(model);
    if (draftName && draftName === selectedName) {
      return withDiagnostic(normalizeVariable({name: draftName, reads: [], writes: []}));
    }
    return null;
  }

  function normalizeVariable(variable) {
    const reads = ensureArray(variable.reads);
    const writes = ensureArray(variable.writes);
    const tags = ensureArray(variable.tags).map(String);
    const scope = String(variable.scope || 'q');
    const name = String(variable.name || '').trim();
    return {
      name,
      scope,
      tags,
      reads,
      writes,
      readCount: Number(variable.readCount || reads.length || 0),
      writeCount: Number(variable.writeCount || writes.length || 0),
      searchTextLower: [
        name,
        scope,
        tags.join(' '),
        sourceSearchText(reads),
        sourceSearchText(writes)
      ].join(' ').toLowerCase()
    };
  }

  function visibleRows(rows, selected, limit) {
    const slice = rows.slice(0, limit);
    if (!selected || slice.some((row) => row.name === selected.name)) {
      return slice;
    }
    if (slice.length >= limit) {
      slice.pop();
    }
    return [selected].concat(slice);
  }

  function selectedVariableName(selected) {
    const value = String(selected || '');
    return value.indexOf('variable:') === 0 ? value.slice('variable:'.length) : '';
  }

  function draftVariableName(model) {
    const name = model && model.changeState && model.changeState.draft && model.changeState.draft.variableName;
    return String(name || '').trim();
  }

  function summaryLabel(rowModel) {
    const shown = String(rowModel.visibleRows.length);
    const total = String(rowModel.totalCount);
    if (rowModel.query) {
      return t('projectState.summaryFiltered', '{shown} shown / {matches} matching / {total} total')
        .replace('{shown}', shown)
        .replace('{matches}', String(rowModel.matchCount))
        .replace('{total}', total);
    }
    return t('projectState.summary', '{shown} shown / {total} total')
      .replace('{shown}', shown)
      .replace('{total}', total);
  }

  function normalizeQuery(value) {
    return String(value || '').trim().toLowerCase();
  }

  function compareVariableRows(left, right) {
    return String(left && left.name || '').localeCompare(String(right && right.name || ''));
  }

  function sourceSearchText(refs) {
    return ensureArray(refs).slice(0, 12).map((ref) => {
      const value = ref && typeof ref === 'object' ? ref : {};
      return [value.path, value.line, value.text].filter(Boolean).join(' ');
    }).join(' ');
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

  function sourceLabel(ref) {
    const value = ref && typeof ref === 'object' ? ref : {};
    return value.path ? value.path + (value.line ? ':' + value.line : '') : t('projectState.noSource', 'No source evidence loaded.');
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  const api = {render, renderInspectorCard};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapProjectStateSurface = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
