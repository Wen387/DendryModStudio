(function initProjectMapObjectEditorConditionBuilder(global) {
  'use strict';

  // Object editor condition builder -- structured row editing for flat view-if /
  // choose-if conditions in the object editor modal (preview_object_editor's
  // semantic condition cards).
  //
  // v1 grammar (census-informed): a condition is editable here ONLY when it is a
  // flat chain of clauses joined by a single uniform connector (all "and" or all
  // "or"), where each clause is one of
  //   quality                      (bare truthy check)
  //   not quality                  (bare negation)
  //   quality <op> number          (op: >= <= != == = > <)
  //   quality <op> "string"        (single or double quoted)
  //   quality <op> quality
  // No parentheses, no arithmetic, no magic {! !}, no mixed and/or (Dendry
  // precedence would be ambiguous to re-render), and no "not" before a
  // comparison (Dendry's not-vs-comparison precedence is not verified).
  //
  // HARD SAFETY RULE: the builder only appears when recomposing its parse
  // reproduces the field text BYTE-EXACT (builderState). Anything else leaves
  // the raw-text field untouched -- degrade, never guess. Edits write back by
  // setting the raw field input's value and dispatching 'input', so the
  // already-wired guarded replace_text path fires exactly as if typed; no model
  // or install change, and builder controls carry none of the canvas field
  // attributes (no state pollution). Wired by self-registered, idempotent
  // document listeners (object_authoring_canvas_ui untouched, mirroring
  // object_editor_find / object_editor_inserts). Off-budget sibling.

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const ensureArray = domTextUtils.ensureArray;
  const escapeAttr = domTextUtils.escapeAttr;
  const escapeHtml = domTextUtils.escapeHtml;

  const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const NUMBER = /^-?\d+(?:\.\d+)?$/;
  const STRING = /^"[^"]*"$|^'[^']*'$/;
  // Parse order matters (>= before >); the select shows a friendlier order.
  const OPS = ['>=', '<=', '!=', '==', '=', '>', '<'];
  const OP_CHOICES = ['', '=', '==', '!=', '>', '>=', '<', '<='];

  function valueKind(raw) {
    if (NUMBER.test(raw)) { return 'number'; }
    if (STRING.test(raw)) { return 'string'; }
    if (NAME.test(raw)) { return 'quality'; }
    return '';
  }

  // One clause -> {not, name, op, value:{kind, raw}|null} | null when outside
  // the v1 grammar.
  function parseClause(text) {
    let rest = String(text || '').trim();
    if (!rest) { return null; }
    let not = false;
    const negated = rest.match(/^not\s+(.+)$/);
    if (negated) {
      not = true;
      rest = negated[1];
    }
    const cmp = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(>=|<=|!=|==|=|>|<)\s*(.+)$/);
    if (cmp) {
      if (not) { return null; }
      const raw = cmp[3].trim();
      const kind = valueKind(raw);
      if (!kind) { return null; }
      return {not: false, name: cmp[1], op: cmp[2], value: {kind: kind, raw: raw}};
    }
    if (NAME.test(rest)) {
      return {not: not, name: rest, op: '', value: null};
    }
    return null;
  }

  // Whole condition -> {clauses, connector: 'and'|'or'|''} | null.
  function parseFlatCondition(text) {
    const value = String(text == null ? '' : text);
    const trimmed = value.trim();
    if (!trimmed) { return {clauses: [], connector: ''}; }
    if (trimmed.indexOf('(') >= 0 || trimmed.indexOf(')') >= 0 || trimmed.indexOf('{!') >= 0) { return null; }
    const parts = trimmed.split(/\s+(and|or)\s+/);
    const clauses = [];
    const connectors = [];
    for (let i = 0; i < parts.length; i += 1) {
      if (i % 2 === 1) { connectors.push(parts[i]); continue; }
      const clause = parseClause(parts[i]);
      if (!clause) { return null; }
      clauses.push(clause);
    }
    const unique = connectors.filter((c, i) => connectors.indexOf(c) === i);
    if (unique.length > 1) { return null; }
    return {clauses: clauses, connector: unique[0] || ''};
  }

  // Canonical single-space recompose. Returns null when any clause is invalid
  // or incomplete (the caller then leaves the raw field untouched).
  function recomposeFlatCondition(parsed) {
    if (!parsed) { return null; }
    const texts = [];
    const clauses = ensureArray(parsed.clauses);
    for (let i = 0; i < clauses.length; i += 1) {
      const clause = clauses[i];
      if (!clause || !NAME.test(String(clause.name || ''))) { return null; }
      if (!clause.op) {
        texts.push((clause.not ? 'not ' : '') + clause.name);
        continue;
      }
      if (clause.not || OPS.indexOf(clause.op) < 0) { return null; }
      const raw = String(clause.value && clause.value.raw || '');
      if (!valueKind(raw)) { return null; }
      texts.push(clause.name + ' ' + clause.op + ' ' + raw);
    }
    return texts.join(' ' + (parsed.connector || 'and') + ' ');
  }

  // The byte-exact gate: parse, recompose, and only hand the parse back when
  // recompose(parse(text)) === text. An empty field is eligible (build from
  // scratch).
  function builderState(value) {
    const text = String(value == null ? '' : value);
    const parsed = parseFlatCondition(text);
    if (!parsed) { return null; }
    if (recomposeFlatCondition(parsed) !== text) { return null; }
    return parsed;
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function opOptions(selected) {
    return OP_CHOICES.map((op) => {
      const label = op === '' ? t('previewObjectEditor.conditionBuilder.bare', 'is set (truthy)') : op;
      return '<option value="' + escapeAttr(op) + '"' + (op === (selected || '') ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
    }).join('');
  }

  function renderBuilderRow(fieldId, clause, listId) {
    const common = ' data-object-condition-field="' + escapeAttr(fieldId) + '"';
    const isBare = !clause.op;
    return [
      '<div class="preview-object-condition-builder-row" data-object-condition-row="true">',
      '<label class="preview-object-condition-builder-not"><input type="checkbox" data-object-condition-part="not"' + common + (clause.not ? ' checked' : '') + (isBare ? '' : ' disabled') + '><span>' + escapeHtml(t('previewObjectEditor.conditionBuilder.not', 'not')) + '</span></label>',
      '<input type="text" data-object-condition-part="name"' + common + ' list="' + escapeAttr(listId) + '" value="' + escapeAttr(clause.name || '') + '" placeholder="' + escapeAttr(t('previewObjectEditor.semanticCondition.variable', 'Variable')) + '">',
      '<select data-object-condition-part="op"' + common + '>' + opOptions(clause.op) + '</select>',
      '<input type="text" data-object-condition-part="value"' + common + ' value="' + escapeAttr(clause.value ? clause.value.raw : '') + '"' + (isBare ? ' disabled' : '') + ' placeholder="' + escapeAttr(t('previewObjectEditor.semanticCondition.value', 'Value')) + '">',
      '<button type="button" data-object-condition-action="remove_clause"' + common + ' title="' + escapeAttr(t('previewObjectEditor.conditionBuilder.removeClause', 'Remove row')) + '">&times;</button>',
      '</div>'
    ].join('');
  }

  function renderBuilderFooter(fieldId, parsed) {
    const common = ' data-object-condition-field="' + escapeAttr(fieldId) + '"';
    const connector = parsed.connector || 'and';
    return [
      '<div class="preview-object-condition-builder-footer">',
      '<label class="preview-object-condition-builder-connector"><span>' + escapeHtml(t('previewObjectEditor.semanticCondition.and', 'AND')) + '/' + escapeHtml(t('previewObjectEditor.semanticCondition.or', 'OR')) + '</span>',
      '<select data-object-condition-part="connector"' + common + '>',
      '<option value="and"' + (connector === 'and' ? ' selected' : '') + '>and</option>',
      '<option value="or"' + (connector === 'or' ? ' selected' : '') + '>or</option>',
      '</select></label>',
      '<button type="button" data-object-condition-action="add_clause"' + common + '>' + escapeHtml(t('previewObjectEditor.conditionBuilder.addClause', 'Add condition row')) + '</button>',
      '</div>'
    ].join('');
  }

  // The injected entry point. Renders nothing for read-only or id-less fields
  // and for any text the byte-exact gate rejects.
  function renderConditionBuilder(field, value, opts) {
    const options = opts || {};
    const id = String(field && field.id || '');
    if (!id || options.readOnly) { return ''; }
    const parsed = builderState(value);
    if (!parsed) { return ''; }
    const names = ensureArray(field && field.variablePicker && field.variablePicker.candidates)
      .map((candidate) => String(candidate && (candidate.insertValue || candidate.name) || ''))
      .filter((name) => NAME.test(name));
    const unique = names.filter((name, index) => names.indexOf(name) === index).slice(0, 50);
    const listId = 'object_condition_builder_vars_' + id.replace(/[^A-Za-z0-9_-]/g, '_');
    return [
      '<details class="preview-object-condition-builder" data-object-condition-builder="' + escapeAttr(id) + '">',
      '<summary>' + escapeHtml(t('previewObjectEditor.conditionBuilder.title', 'Edit by parts')) + '</summary>',
      '<div class="preview-object-condition-builder-body">',
      '<div class="preview-object-condition-builder-rows" data-object-condition-rows="' + escapeAttr(id) + '">',
      parsed.clauses.map((clause) => renderBuilderRow(id, clause, listId)).join(''),
      '</div>',
      renderBuilderFooter(id, parsed),
      '<datalist id="' + escapeAttr(listId) + '">' + unique.map((name) => '<option value="' + escapeAttr(name) + '"></option>').join('') + '</datalist>',
      '</div>',
      '</details>'
    ].join('');
  }

  // --- DOM wiring (browser only) ---

  function rowPart(row, part) {
    return row.querySelector('[data-object-condition-part="' + part + '"]');
  }

  function findByAttribute(host, attribute, value) {
    const nodes = host.document.querySelectorAll('[' + attribute + ']');
    for (let i = 0; i < nodes.length; i += 1) {
      if (nodes[i].getAttribute(attribute) === value) { return nodes[i]; }
    }
    return null;
  }

  // Read the parse back out of the builder's DOM. Returns null while any row is
  // incomplete (empty name, bad value) -- the raw field is then left alone.
  function collectParsed(builderEl) {
    const rows = builderEl.querySelectorAll('[data-object-condition-row="true"]');
    const clauses = [];
    for (let i = 0; i < rows.length; i += 1) {
      const name = String(rowPart(rows[i], 'name').value || '').trim();
      const op = String(rowPart(rows[i], 'op').value || '');
      const not = Boolean(rowPart(rows[i], 'not').checked);
      const raw = String(rowPart(rows[i], 'value').value || '').trim();
      if (!NAME.test(name)) { return null; }
      if (!op) {
        clauses.push({not: not, name: name, op: '', value: null});
        continue;
      }
      if (not || !valueKind(raw)) { return null; }
      clauses.push({not: false, name: name, op: op, value: {kind: valueKind(raw), raw: raw}});
    }
    const connectorEl = builderEl.querySelector('[data-object-condition-part="connector"]');
    return {clauses: clauses, connector: connectorEl && connectorEl.value === 'or' ? 'or' : 'and'};
  }

  // While the builder writes the raw field, its own field-sync listener must not
  // rebuild the rows out from under the control being typed in.
  let suppressFieldSync = '';

  function writeBack(host, fieldId, builderEl) {
    const parsed = collectParsed(builderEl);
    if (!parsed) { return; }
    const text = parsed.clauses.length ? recomposeFlatCondition(parsed) : '';
    if (text === null) { return; }
    const target = findByAttribute(host, 'data-object-canvas-field', fieldId);
    if (!target || target.value === text) { return; }
    target.value = text;
    suppressFieldSync = fieldId;
    try {
      // 'input' drives the live preview; 'change' is what makes the canvas
      // controller capture values into the proposal (collectValues runs on
      // change, mirroring a user finishing an edit and blurring the field).
      target.dispatchEvent(new host.InputEvent('input', {bubbles: true}));
      target.dispatchEvent(new host.Event('change', {bubbles: true}));
    } finally {
      suppressFieldSync = '';
    }
  }

  // Direct edits to the raw input keep the builder honest: rebuild its rows
  // when the new text still passes the gate, hide it (degrade) when not.
  function syncBuilderFromField(host, target) {
    const fieldId = target.getAttribute('data-object-canvas-field') || '';
    if (!fieldId || suppressFieldSync === fieldId) { return; }
    const builderEl = findByAttribute(host, 'data-object-condition-builder', fieldId);
    if (!builderEl) { return; }
    const parsed = builderState(target.value);
    if (!parsed) {
      builderEl.classList.add('is-ineligible');
      return;
    }
    builderEl.classList.remove('is-ineligible');
    const rowsEl = builderEl.querySelector('[data-object-condition-rows]');
    const datalist = builderEl.querySelector('datalist');
    if (rowsEl) {
      rowsEl.innerHTML = parsed.clauses.map((clause) => renderBuilderRow(fieldId, clause, datalist ? datalist.id : '')).join('');
    }
    const connectorEl = builderEl.querySelector('[data-object-condition-part="connector"]');
    if (connectorEl && parsed.connector) { connectorEl.value = parsed.connector; }
  }

  // Bare clauses negate; comparisons do not (precedence unverified), so the op
  // choice drives which of the not-checkbox / value-input is live.
  function applyRowState(row) {
    const op = String(rowPart(row, 'op').value || '');
    const notEl = rowPart(row, 'not');
    const valueEl = rowPart(row, 'value');
    if (op) {
      notEl.checked = false;
      notEl.disabled = true;
      valueEl.disabled = false;
    } else {
      notEl.disabled = false;
      valueEl.disabled = true;
    }
  }

  function onBuilderEvent(event) {
    const host = typeof window !== 'undefined' ? window : null;
    if (!host) { return; }
    const target = event.target;
    if (!target || typeof target.getAttribute !== 'function') { return; }
    if (target.hasAttribute && target.hasAttribute('data-object-condition-part')) {
      const fieldId = target.getAttribute('data-object-condition-field') || '';
      const builderEl = fieldId ? findByAttribute(host, 'data-object-condition-builder', fieldId) : null;
      if (!builderEl) { return; }
      if (target.getAttribute('data-object-condition-part') === 'op') {
        const row = target.closest('[data-object-condition-row="true"]');
        if (row) { applyRowState(row); }
      }
      writeBack(host, fieldId, builderEl);
      return;
    }
    if (event.type === 'input' && target.hasAttribute && target.hasAttribute('data-object-canvas-field')) {
      syncBuilderFromField(host, target);
    }
  }

  function onBuilderClick(event) {
    const host = typeof window !== 'undefined' ? window : null;
    if (!host) { return; }
    const button = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-object-condition-action]')
      : null;
    if (!button) { return; }
    const action = button.getAttribute('data-object-condition-action');
    const fieldId = button.getAttribute('data-object-condition-field') || '';
    const builderEl = fieldId ? findByAttribute(host, 'data-object-condition-builder', fieldId) : null;
    if (!builderEl) { return; }
    if (action === 'add_clause') {
      const rowsEl = builderEl.querySelector('[data-object-condition-rows]');
      const datalist = builderEl.querySelector('datalist');
      if (rowsEl) {
        // A fresh row starts incomplete (empty name) so nothing is written back
        // until the author names the quality.
        rowsEl.insertAdjacentHTML('beforeend', renderBuilderRow(fieldId, {not: false, name: '', op: '=', value: {kind: 'number', raw: '1'}}, datalist ? datalist.id : ''));
      }
      return;
    }
    if (action === 'remove_clause') {
      const row = button.closest('[data-object-condition-row="true"]');
      if (row) { row.remove(); }
      writeBack(host, fieldId, builderEl);
    }
  }

  function ensureWired(host) {
    if (!host || !host.document || host.__objectEditorConditionBuilderWired) {
      return;
    }
    host.__objectEditorConditionBuilderWired = true;
    host.document.addEventListener('input', onBuilderEvent, true);
    host.document.addEventListener('change', onBuilderEvent, true);
    host.document.addEventListener('click', onBuilderClick, true);
  }

  ensureWired(global);

  const api = {parseFlatCondition, recomposeFlatCondition, builderState, renderConditionBuilder};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectEditorConditionBuilder = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
