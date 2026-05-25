(function initProjectMapSemanticLogicWorkspace(global) {
  'use strict';

  const FIELD_KEY = 'semantic_logic.replacementText';

  const api = {
    FIELD_KEY,
    buildCanvasModel,
    render,
    bind,
    reviewAllowed,
    replacementText
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSemanticLogicWorkspace = api;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function buildCanvasModel(editorModel, values, deps) {
    const editor = editorModel || {};
    const options = deps || {};
    const current = String(editor.currentText || '');
    const replacement = replacementText(values, editor);
    const changed = replacement !== current;
    const semanticApi = options.semanticLogicApi || semanticLogicApi();
    const proposalValues = Object.assign({}, values && typeof values === 'object' ? values : {}, {replacementText: replacement});
    const proposal = changed && semanticApi && typeof semanticApi.buildProposal === 'function'
      ? semanticApi.buildProposal(editor, proposalValues)
      : {ok: Boolean(editor && editor.ok), installPlan: null, operations: [], diagnostics: []};
    const plan = changed ? proposal && proposal.installPlan || null : null;
    const operations = ensureArray(plan && plan.operations || proposal && proposal.operations);
    const title = editor.title || editorLabel(editor.editorKind, options);
    return {
      schemaVersion: '0.1',
      kind: 'object_authoring_canvas_model',
      ok: Boolean(editor && editor.ok),
      mode: 'semantic_logic',
      template: 'semantic_logic',
      templateLabel: editorLabel(editor.editorKind, options),
      objectKind: tr(options, 'semanticLogic.objectKind', 'Semantic source edit'),
      objectId: String(editor.targetId || editor.sceneId || editor.sourcePath || 'semantic_logic'),
      title,
      source: editor.source || {path: editor.sourcePath || ''},
      entry: {source: 'visible_edit_action'},
      contextBoard: {},
      eventBody: {},
      changeState: {
        draft: {
          schemaVersion: '0.1',
          kind: 'semantic_logic_editor',
          title,
          editorKind: editor.editorKind || '',
          targetId: editor.targetId || '',
          source: editor.source || null,
          replacementText: replacement,
          semanticEditor: editor.semanticEditor || null
        },
        proposal,
        output: {
          installPlan: plan,
          playerPreview: replacement,
          previewText: replacement
        },
        installPlan: plan,
        operationSummary: summarizeOperations(operations),
        changedCount: changed ? 1 : 0,
        diagnostics: ensureArray(editor.diagnostics).concat(ensureArray(proposal && proposal.diagnostics)),
        warnings: [],
        semanticLogicChanged: changed,
        semanticLogicBefore: current,
        semanticLogicAfter: replacement
      },
      legacy: {template: 'semantic_logic'},
      rawContext: editor
    };
  }

  function render(model, state, deps) {
    const options = deps || {};
    const viewState = state || {};
    const canvasModel = model || {};
    const editor = viewState.semanticLogicModel || canvasModel.rawContext || {};
    const change = canvasModel.changeState || {};
    const plan = change.installPlan || null;
    const operations = ensureArray(plan && plan.operations || change.proposal && change.proposal.operations);
    const operation = operations[0] || {};
    const replacement = change.draft && Object.prototype.hasOwnProperty.call(change.draft, 'replacementText')
      ? String(change.draft.replacementText || '')
      : replacementText(viewState.values, editor);
    const current = String(editor.currentText || '');
    const changed = replacement !== current || Boolean(change.changedCount);
    const safety = String(editor.installSafety || operation.safety || '');
    const advancedRequired = safety === 'advanced_apply';
    const allowed = reviewAllowed({
      model: canvasModel,
      semanticLogicModel: editor,
      semanticLogicAdvancedConfirmed: Boolean(viewState.semanticLogicAdvancedConfirmed)
    });
    return [
      '<section class="object-canvas-stage semantic-logic-editor source-slice-editor" data-semantic-logic-editor="true">',
      '<div class="object-canvas-stage-toolbar source-slice-toolbar semantic-logic-toolbar">',
      '<div>',
      '<div class="template-eyebrow">' + esc(options, editorLabel(editor.editorKind, options)) + '</div>',
      '<h3>' + esc(options, editor.title || editorLabel(editor.editorKind, options)) + '</h3>',
      '<p>' + esc(options, helperText(editor.editorKind, options)) + '</p>',
      '</div>',
      '<div class="source-slice-badges semantic-logic-badges">',
      '<span>' + esc(options, kindLabel(editor.editorKind, options)) + '</span>',
      '<span>' + esc(options, safetyLabel(safety, options)) + '</span>',
      '<span>' + esc(options, String(operation.type || editor.operationType || 'replace_text')) + '</span>',
      '</div>',
      '</div>',
      '<div class="source-slice-grid semantic-logic-grid">',
      '<section class="editing-panel source-slice-main semantic-logic-main" data-semantic-logic-kind="' + attr(options, editor.editorKind || '') + '">',
      renderSemanticSummary(editor, options),
      renderFieldControls(editor, viewState.values || {}, options),
      '<div class="editing-field editing-field-' + attr(options, advancedRequired ? 'manual' : 'guarded') + '">',
      '<span>' + esc(options, fallbackEditLabel(editor.editorKind, options)) + '</span>',
      '<small>' + esc(options, sourceLabel(editor, options)) + '</small>',
      '<textarea data-object-canvas-field="' + attr(options, FIELD_KEY) + '" data-semantic-logic-textarea="true" data-object-canvas-original="' + attr(options, replacement) + '" rows="12">' + esc(options, replacement) + '</textarea>',
      '</div>',
      advancedRequired ? renderAdvancedToggle(viewState, options) : '',
      '<div class="editing-actions source-slice-actions semantic-logic-actions">',
      '<button type="button" data-object-canvas-action="refresh">' + esc(options, tr(options, 'semanticLogic.preview', 'Preview change')) + '</button>',
      '<button class="primary-action" type="button" data-object-canvas-action="review"' + (allowed ? '' : ' disabled aria-disabled="true"') + '>' + esc(options, tr(options, 'existingScene.review', 'Review & Apply')) + '</button>',
      '</div>',
      '</section>',
      '<aside class="editing-field-panels">',
      renderEvidence(editor, options),
      changed ? renderDiff(current, replacement, options) : renderNoChanges(options),
      changed ? renderPlan(options, plan) : '',
      renderDiagnostics(options, change.diagnostics || []),
      '</aside>',
      '</div>',
      '</section>'
    ].join('');
  }

  function bind(host, state, deps) {
    const root = host || null;
    if (!root || !root.querySelectorAll) {
      return;
    }
    root.querySelectorAll('[data-semantic-logic-advanced-confirm]').forEach((input) => {
      if (input.__dmsSemanticLogicWorkspaceBound) {
        return;
      }
      input.__dmsSemanticLogicWorkspaceBound = true;
      input.addEventListener('change', () => {
        if (state) {
          state.semanticLogicAdvancedConfirmed = Boolean(input.checked);
        }
        if (deps && typeof deps.onAdvancedConfirmed === 'function') {
          deps.onAdvancedConfirmed(Boolean(input.checked));
        }
        syncReviewControls(root, state);
      });
    });
    syncReviewControls(root, state);
  }

  function reviewAllowed(state) {
    const value = state || {};
    const model = value.model || {};
    const editor = value.semanticLogicModel || model.rawContext || {};
    const change = model.changeState || {};
    const changed = Number(change.changedCount || 0) > 0 || Boolean(change.semanticLogicChanged);
    if (!changed) {
      return false;
    }
    const plan = change.installPlan || change.output && change.output.installPlan || null;
    const operation = ensureArray(plan && plan.operations || change.proposal && change.proposal.operations)[0] || {};
    const safety = String(editor.installSafety || operation.safety || '');
    return safety !== 'advanced_apply' || Boolean(value.semanticLogicAdvancedConfirmed || value.advancedConfirmed);
  }

  function replacementText(values, editorModel) {
    const nextValues = values && typeof values === 'object' ? values : {};
    if (Object.prototype.hasOwnProperty.call(nextValues, FIELD_KEY)) {
      return String(nextValues[FIELD_KEY] === undefined || nextValues[FIELD_KEY] === null ? '' : nextValues[FIELD_KEY]);
    }
    const semanticApi = semanticLogicApi();
    if (semanticApi && typeof semanticApi.composeFieldReplacement === 'function') {
      return semanticApi.composeFieldReplacement(editorModel || {}, nextValues);
    }
    return String(editorModel && editorModel.currentText || '');
  }

  function renderSemanticSummary(editor, deps) {
    const evidence = editor && editor.evidence || {};
    const parserBacked = evidence.parserBacked ? tr(deps, 'semanticLogic.parserBacked', 'Parser-backed evidence') : tr(deps, 'semanticLogic.sourceBacked', 'Source-backed editor');
    return [
      '<div class="semantic-logic-summary" data-semantic-logic-summary="true">',
      '<span>' + esc(deps, parserBacked) + '</span>',
      '<strong>' + esc(deps, editor && (editor.sceneId || editor.targetId || editor.role) || '') + '</strong>',
      '<small>' + esc(deps, editor && editor.fieldId || '') + '</small>',
      '</div>'
    ].join('');
  }

  function renderFieldControls(editor, values, deps) {
    const controls = editor && editor.fieldControls || null;
    if (!controls || !controls.mode) {
      return '';
    }
    const title = controlTitle(controls.mode, deps);
    const mode = String(controls.mode || '');
    return [
      '<div class="semantic-logic-field-controls is-' + attr(deps, mode.replace(/_/g, '-')) + '" data-semantic-logic-field-controls="true" data-semantic-logic-field-mode="' + attr(deps, controls.mode) + '">',
      '<div class="semantic-logic-field-controls-header">',
      '<h4>' + esc(deps, title) + '</h4>',
      '<span>' + esc(deps, guidedModeBadge(mode, deps)) + '</span>',
      '</div>',
      renderControlsByMode(controls, values, deps),
      '</div>'
    ].join('');
  }

  function renderControlsByMode(controls, values, deps) {
    if (controls.mode === 'effect') {
      return renderEffectControls(controls, values, deps);
    }
    if (controls.mode === 'utility_pair') {
      return renderUtilityPairControls(controls, values, deps);
    }
    if (controls.mode === 'route_table_binding') {
      return renderRouteTableControls(controls, values, deps);
    }
    if (controls.mode === 'explicit_fallback_helper') {
      return renderFallbackControls(controls, values, deps);
    }
    return renderRouteControls(controls, values, deps);
  }

  function controlTitle(mode, deps) {
    if (mode === 'effect') {
      return tr(deps, 'semanticLogic.guidedEffectFields', 'Guided effect fields');
    }
    if (mode === 'utility_pair') {
      return tr(deps, 'semanticLogic.guidedUtilityPairFields', 'Utility call and return');
    }
    if (mode === 'route_table_binding') {
      return tr(deps, 'semanticLogic.guidedRouteTableFields', 'Route target table');
    }
    if (mode === 'explicit_fallback_helper') {
      return tr(deps, 'semanticLogic.guidedFallbackFields', 'Explicit fallback helper');
    }
    return tr(deps, 'semanticLogic.guidedRouteFields', 'Guided route fields');
  }

  function guidedModeBadge(mode, deps) {
    if (mode === 'utility_pair') {
      return tr(deps, 'semanticLogic.guidedBadgePaired', 'paired edit');
    }
    if (mode === 'route_table_binding') {
      return tr(deps, 'semanticLogic.guidedBadgeLiteralTargets', 'literal targets');
    }
    if (mode === 'explicit_fallback_helper') {
      return tr(deps, 'semanticLogic.guidedBadgeExplicit', 'explicit condition');
    }
    if (mode === 'effect') {
      return tr(deps, 'semanticLogic.guidedBadgeStructured', 'structured');
    }
    return tr(deps, 'semanticLogic.guidedBadgeStructured', 'structured');
  }

  function renderRouteControls(controls, values, deps) {
    return [
      '<div class="semantic-logic-control-grid">',
      renderTextControl('semantic_logic.routeTarget', valueFor(values, 'semantic_logic.routeTarget', controls.target), controls.target, tr(deps, 'semanticLogic.routeTarget', 'Target'), deps, 'route-target'),
      renderTextControl('semantic_logic.routePredicate', valueFor(values, 'semantic_logic.routePredicate', controls.predicate), controls.predicate, tr(deps, 'semanticLogic.routePredicate', 'Predicate'), deps, 'route-predicate'),
      renderTextControl('semantic_logic.routeLabel', valueFor(values, 'semantic_logic.routeLabel', controls.label), controls.label, tr(deps, 'semanticLogic.routeLabel', 'Visible label'), deps, 'route-label'),
      '</div>',
      renderSemanticVariablePicker('semantic_logic.routePredicate', 'js_condition', deps)
    ].join('');
  }

  function renderEffectControls(controls, values, deps) {
    return [
      '<div class="semantic-logic-control-grid">',
      renderTextControl('semantic_logic.effectVariable', valueFor(values, 'semantic_logic.effectVariable', controls.variable), controls.variable, tr(deps, 'semanticLogic.effectVariable', 'Variable'), deps, 'effect-variable'),
      renderOperatorControl(valueFor(values, 'semantic_logic.effectOperator', controls.op || '='), controls.op || '=', deps),
      renderTextControl('semantic_logic.effectValue', valueFor(values, 'semantic_logic.effectValue', controls.value), controls.value, tr(deps, 'semanticLogic.effectValue', 'Value'), deps, 'effect-value'),
      renderTextControl('semantic_logic.effectCondition', valueFor(values, 'semantic_logic.effectCondition', controls.condition), controls.condition, tr(deps, 'semanticLogic.effectCondition', 'Condition'), deps, 'effect-condition'),
      '</div>',
      renderSemanticVariablePicker('semantic_logic.effectVariable', 'effect_variable', deps),
      renderSemanticVariablePicker('semantic_logic.effectCondition', 'js_condition', deps),
      controls.sharedLine || controls.dynamicKey ? '<p class="semantic-logic-control-note">' + esc(deps, controlNote(controls, deps)) + '</p>' : ''
    ].join('');
  }

  function renderUtilityPairControls(controls, values, deps) {
    return [
      '<div class="semantic-logic-control-grid">',
      renderTextControl('semantic_logic.utilitySceneId', valueFor(values, 'semantic_logic.utilitySceneId', controls.utilitySceneId), controls.utilitySceneId, tr(deps, 'semanticLogic.utilityScene', 'Utility scene'), deps, 'utility-scene'),
      renderTextControl('semantic_logic.setJumpTarget', valueFor(values, 'semantic_logic.setJumpTarget', controls.setJumpTarget), controls.setJumpTarget, tr(deps, 'semanticLogic.setJumpTarget', 'Return target'), deps, 'set-jump-target'),
      renderReadonlyControl(tr(deps, 'semanticLogic.returnBinding', 'Return binding'), controls.returnBinding, deps, 'return-binding'),
      '</div>',
      '<p class="semantic-logic-control-note">' + esc(deps, tr(deps, 'semanticLogic.utilityPairNote', 'Both source lines are reviewed together so the utility call and return target stay paired.')) + '</p>'
    ].join('');
  }

  function renderRouteTableControls(controls, values, deps) {
    const rows = ensureArray(controls.rows);
    return [
      '<div class="semantic-logic-control-grid semantic-logic-route-table-grid">',
      rows.map((row, index) => renderTextControl('semantic_logic.routeTable.' + index + '.target', valueFor(values, 'semantic_logic.routeTable.' + index + '.target', row && row.target), row && row.target, row && row.label || tr(deps, 'semanticLogic.routeTableTarget', 'Target'), deps, 'route-table-target')).join(''),
      '</div>',
      '<p class="semantic-logic-control-note">' + esc(deps, tr(deps, 'semanticLogic.routeTableNote', 'Only literal target values are editable here; route variable names, conditions, and keys stay in Source Slice/manual review.')) + '</p>'
    ].join('');
  }

  function renderFallbackControls(controls, values, deps) {
    return [
      '<div class="semantic-logic-control-grid">',
      renderTextControl('semantic_logic.fallbackSuggestedText', valueFor(values, 'semantic_logic.fallbackSuggestedText', controls.suggestedText), controls.suggestedText, tr(deps, 'semanticLogic.fallbackSuggestedText', 'Explicit fallback line'), deps, 'fallback-suggested-text'),
      '</div>',
      controls.predicate ? '<p class="semantic-logic-control-note">' + esc(deps, tr(deps, 'semanticLogic.fallbackNote', 'Trailing unconditional clauses are not fallback in Dendry; this helper makes the fallback condition explicit.')) + '</p>' : ''
    ].join('');
  }

  function renderTextControl(key, value, original, label, deps, marker) {
    return [
      '<label class="semantic-logic-control" data-semantic-logic-control="' + attr(deps, marker) + '">',
      '<span>' + esc(deps, label) + '</span>',
      '<input type="text" data-object-canvas-field="' + attr(deps, key) + '" data-object-canvas-original="' + attr(deps, original || '') + '" value="' + attr(deps, value || '') + '">',
      '</label>'
    ].join('');
  }

  function renderSemanticVariablePicker(targetFieldId, mode, deps) {
    const api = fieldPresentationApi();
    const picker = api && typeof api.buildVariablePicker === 'function'
      ? api.buildVariablePicker(projectIndex(deps), {id: targetFieldId, role: mode}, {
        limit: 6,
        presentation: {
          variablePicker: {enabled: true, mode, targetFieldId}
        }
      })
      : {enabled: false, candidates: []};
    const candidates = ensureArray(picker && picker.candidates);
    if (!picker || !picker.enabled || !candidates.length) {
      return '';
    }
    return [
      '<details class="semantic-logic-variable-picker object-canvas-variable-picker" data-object-canvas-variable-picker="true" data-variable-target-field="' + attr(deps, targetFieldId) + '" data-variable-picker-mode="' + attr(deps, mode) + '" data-variable-picker-limit="12">',
      '<summary>' + esc(deps, tr(deps, 'semanticLogic.variablePicker', 'Variable picker')) + '</summary>',
      '<label class="object-canvas-variable-search"><span>' + esc(deps, tr(deps, 'semanticLogic.variableSearch', 'Search variables')) + '</span><input type="search" data-object-canvas-variable-search="true" placeholder="' + attr(deps, tr(deps, 'semanticLogic.variableSearchPlaceholder', 'type to filter')) + '"></label>',
      '<div class="object-canvas-variable-candidates" data-object-canvas-variable-candidates="true">',
      candidates.map((candidate) => renderSemanticVariableCandidate(candidate, targetFieldId, mode, deps)).join(''),
      '</div>',
      '</details>'
    ].join('');
  }

  function renderSemanticVariableCandidate(candidate, targetFieldId, mode, deps) {
    const value = String(candidate && candidate.insertValue || candidate && candidate.name || '');
    if (!value) {
      return '';
    }
    const search = String(candidate && (candidate.searchText || [candidate.name, candidate.meaning, candidate.summary].join(' ')) || '').toLowerCase();
    return [
      '<button type="button" class="object-canvas-variable-candidate" data-object-canvas-variable-copy="' + attr(deps, value) + '" data-object-canvas-variable-target="' + attr(deps, targetFieldId) + '" data-object-canvas-variable-mode="' + attr(deps, mode || '') + '" data-object-canvas-variable-search-text="' + attr(deps, search) + '">',
      '<strong>' + esc(deps, candidate && (candidate.label || candidate.name) || value) + '</strong>',
      candidate && candidate.meaning ? '<span>' + esc(deps, candidate.meaning) + '</span>' : '',
      candidate && candidate.summary ? '<small>' + esc(deps, candidate.summary) + '</small>' : '',
      '<code>' + esc(deps, value) + '</code>',
      '</button>'
    ].join('');
  }

  function fieldPresentationApi() {
    if (global && global.ProjectMapObjectFieldPresentationModel) {
      return global.ProjectMapObjectFieldPresentationModel;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/object_field_presentation_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function projectIndex(deps) {
    return deps && (deps.projectIndex || deps.state && deps.state.projectIndex) || null;
  }

  function renderReadonlyControl(label, value, deps, marker) {
    return [
      '<label class="semantic-logic-control is-readonly" data-semantic-logic-control="' + attr(deps, marker) + '">',
      '<span>' + esc(deps, label) + '</span>',
      '<input type="text" value="' + attr(deps, value || '') + '" readonly>',
      '</label>'
    ].join('');
  }

  function renderOperatorControl(value, original, deps) {
    const ops = ['=', '+=', '-='];
    return [
      '<label class="semantic-logic-control" data-semantic-logic-control="effect-operator">',
      '<span>' + esc(deps, tr(deps, 'semanticLogic.effectOperator', 'Operator')) + '</span>',
      '<select data-object-canvas-field="semantic_logic.effectOperator" data-object-canvas-original="' + attr(deps, original || '=') + '">',
      ops.map((op) => '<option value="' + attr(deps, op) + '"' + (op === value ? ' selected' : '') + '>' + esc(deps, op) + '</option>').join(''),
      '</select>',
      '</label>'
    ].join('');
  }

  function valueFor(values, key, fallback) {
    const input = values && typeof values === 'object' ? values : {};
    return Object.prototype.hasOwnProperty.call(input, key) ? input[key] : fallback;
  }

  function controlNote(controls, deps) {
    if (controls.dynamicKey) {
      return tr(deps, 'semanticLogic.dynamicFieldNote', 'Dynamic Q evidence is shown; Review & Apply will keep this as an advanced source-backed edit when needed.');
    }
    return tr(deps, 'semanticLogic.sharedLineNote', 'This effect shares a source line; Studio previews the full line before Review & Apply.');
  }

  function renderEvidence(editor, deps) {
    const source = editor && editor.source || {};
    return [
      '<section class="editing-panel source-slice-evidence semantic-logic-evidence">',
      '<h3>' + esc(deps, tr(deps, 'semanticLogic.evidenceTitle', 'Semantic evidence')) + '</h3>',
      '<dl class="editing-meta">',
      '<dt>' + esc(deps, tr(deps, 'existingScene.source', 'Source')) + '</dt><dd>' + esc(deps, source.path || '') + '</dd>',
      '<dt>' + esc(deps, tr(deps, 'sourceSlice.lineRange', 'Line range')) + '</dt><dd>' + esc(deps, sourceLineLabel(editor) || '') + '</dd>',
      '<dt>' + esc(deps, tr(deps, 'semanticLogic.field', 'Field')) + '</dt><dd>' + esc(deps, editor && (editor.fieldId || editor.role) || '') + '</dd>',
      '<dt>' + esc(deps, tr(deps, 'sourceSlice.safety', 'Safety')) + '</dt><dd>' + esc(deps, safetyLabel(editor && editor.installSafety, deps)) + '</dd>',
      '</dl>',
      renderRouteEvidence(editor && editor.routeEvidence, deps),
      renderRouterEvidence(editor && editor.routerEvidence, deps),
      renderEffectEvidence(editor && editor.effectEvidence, deps),
      renderDynamicEvidence(editor && editor.dynamicKeyEvidence, deps),
      '</section>'
    ].join('');
  }

  function renderRouteEvidence(rows, deps) {
    const items = ensureArray(rows);
    if (!items.length) {
      return '';
    }
    return [
      '<div class="semantic-logic-evidence-list" data-route-editor-evidence="true">',
      '<h4>' + esc(deps, tr(deps, 'semanticLogic.routeEvidence', 'Route order')) + '</h4>',
      items.map((group) => {
        const clauses = ensureArray(group && group.clauses).map((clause) => {
          return '<li><strong>' + esc(deps, String(clause.order || '')) + '</strong> ' +
            esc(deps, String(clause.rawTarget || clause.resolvedTarget || '')) +
            (clause.predicate ? ' <small>' + esc(deps, String(clause.predicate || '')) + '</small>' : '') +
            (clause.isFallback ? ' <em>' + esc(deps, tr(deps, 'semanticLogic.fallback', 'fallback')) + '</em>' : '') +
            '</li>';
        }).join('');
        return '<ol>' + clauses + '</ol>';
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderRouterEvidence(rows, deps) {
    const items = ensureArray(rows);
    if (!items.length) {
      return '';
    }
    return [
      '<div class="semantic-logic-evidence-list" data-router-editor-evidence="true">',
      '<h4>' + esc(deps, tr(deps, 'semanticLogic.routerEvidence', 'Router entry')) + '</h4>',
      '<ul>',
      items.map((row) => '<li>' + esc(deps, [row && row.linkedSceneId, row && row.title].filter(Boolean).join(' - ')) + '</li>').join(''),
      '</ul>',
      '</div>'
    ].join('');
  }

  function renderEffectEvidence(rows, deps) {
    const items = ensureArray(rows);
    if (!items.length) {
      return '';
    }
    return [
      '<div class="semantic-logic-evidence-list" data-effect-clause-evidence="true">',
      '<h4>' + esc(deps, tr(deps, 'semanticLogic.effectEvidence', 'Effect clauses')) + '</h4>',
      '<ul>',
      items.map((row) => '<li><strong>' + esc(deps, [row && row.variable, row && row.op, row && row.value].filter(Boolean).join(' ')) + '</strong> <small>' + esc(deps, row && row.sourceExpression || '') + '</small></li>').join(''),
      '</ul>',
      '</div>'
    ].join('');
  }

  function renderDynamicEvidence(rows, deps) {
    const items = ensureArray(rows);
    if (!items.length) {
      return '';
    }
    return [
      '<div class="semantic-logic-evidence-list" data-dynamic-key-evidence="true">',
      '<h4>' + esc(deps, tr(deps, 'semanticLogic.dynamicEvidence', 'Dynamic Q evidence')) + '</h4>',
      '<ul>',
      items.map((row) => '<li><strong>' + esc(deps, row && row.expression || '') + '</strong> <small>' + esc(deps, row && row.classification || '') + '</small></li>').join(''),
      '</ul>',
      '</div>'
    ].join('');
  }

  function renderAdvancedToggle(state, deps) {
    return [
      '<label class="source-slice-advanced-toggle semantic-logic-advanced-toggle">',
      '<input type="checkbox" data-semantic-logic-advanced-confirm="true"' + (state && state.semanticLogicAdvancedConfirmed ? ' checked' : '') + '>',
      '<span>' + esc(deps, tr(deps, 'semanticLogic.advancedConfirm', 'Enable advanced apply for this semantic source edit.')) + '</span>',
      '</label>'
    ].join('');
  }

  function renderNoChanges(deps) {
    return [
      '<section class="editing-panel source-slice-no-changes semantic-logic-no-changes" data-semantic-logic-no-changes="true">',
      '<h3>' + esc(deps, tr(deps, 'sourceSlice.noChangesTitle', 'Preview change')) + '</h3>',
      '<p>' + esc(deps, tr(deps, 'sourceSlice.noChanges', 'No changes yet.')) + '</p>',
      '</section>'
    ].join('');
  }

  function renderDiff(before, after, deps) {
    return [
      '<section class="editing-panel source-slice-diff semantic-logic-diff" data-semantic-logic-diff="true">',
      '<h3>' + esc(deps, tr(deps, 'sourceSlice.diffTitle', 'Before / After')) + '</h3>',
      '<div class="source-slice-diff-grid">',
      '<div><span>' + esc(deps, tr(deps, 'sourceSlice.before', 'Before')) + '</span><pre data-semantic-logic-before="true">' + esc(deps, before) + '</pre></div>',
      '<div><span>' + esc(deps, tr(deps, 'sourceSlice.after', 'After')) + '</span><pre data-semantic-logic-after="true">' + esc(deps, after) + '</pre></div>',
      '</div>',
      '</section>'
    ].join('');
  }

  function renderPlan(deps, plan) {
    return deps && typeof deps.renderPlanPreview === 'function'
      ? deps.renderPlanPreview(plan)
      : '';
  }

  function renderDiagnostics(deps, diagnostics) {
    return deps && typeof deps.renderDiagnostics === 'function'
      ? deps.renderDiagnostics(diagnostics)
      : '';
  }

  function syncReviewControls(root, state) {
    const allowed = reviewAllowed(state || {});
    root.querySelectorAll('[data-object-canvas-action="review"]').forEach((button) => {
      button.disabled = !allowed;
      button.setAttribute('aria-disabled', allowed ? 'false' : 'true');
    });
  }

  function summarizeOperations(operations) {
    const summary = {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 0, refused: 0};
    ensureArray(operations).forEach((operation) => {
      const safety = String(operation && operation.safety || '');
      if (safety === 'safe_apply') {
        summary.safeApply += 1;
      } else if (safety === 'guarded_apply') {
        summary.guardedApply += 1;
      } else if (safety === 'advanced_apply') {
        summary.advancedApply += 1;
      } else if (safety === 'refused') {
        summary.refused += 1;
      } else if (operation) {
        summary.manualReview += 1;
      }
    });
    return summary;
  }

  function editorLabel(kind, deps) {
    if (kind === 'effect_clause') {
      return tr(deps, 'semanticLogic.effectTitle', 'Effect Clause Editor');
    }
    if (kind === 'utility_pair') {
      return tr(deps, 'semanticLogic.utilityPairTitle', 'Utility Pair Editor');
    }
    if (kind === 'route_table_binding') {
      return tr(deps, 'semanticLogic.routeTableTitle', 'Route Table Editor');
    }
    if (kind === 'explicit_fallback_helper') {
      return tr(deps, 'semanticLogic.fallbackHelperTitle', 'Explicit Fallback Helper');
    }
    if (kind === 'variable_provenance') {
      return tr(deps, 'semanticLogic.variableTitle', 'Variable Workspace');
    }
    return tr(deps, 'semanticLogic.routeTitle', 'Route Editor');
  }

  function kindLabel(kind, deps) {
    if (kind === 'effect_clause') {
      return tr(deps, 'semanticLogic.kind.effect', 'Effect');
    }
    if (kind === 'variable_provenance') {
      return tr(deps, 'semanticLogic.kind.variable', 'Variable');
    }
    if (kind === 'utility_pair') {
      return tr(deps, 'semanticLogic.kind.utilityPair', 'Utility pair');
    }
    if (kind === 'route_table_binding') {
      return tr(deps, 'semanticLogic.kind.routeTable', 'Route table');
    }
    if (kind === 'explicit_fallback_helper') {
      return tr(deps, 'semanticLogic.kind.fallback', 'Fallback');
    }
    return tr(deps, 'semanticLogic.kind.route', 'Route');
  }

  function helperText(kind, deps) {
    if (kind === 'effect_clause') {
      return tr(deps, 'semanticLogic.effectBody', 'Edit the effect clause with parser evidence visible beside the source-backed operation.');
    }
    if (kind === 'utility_pair') {
      return tr(deps, 'semanticLogic.utilityPairBody', 'Edit the utility call and set-jump return as one reviewed pair.');
    }
    if (kind === 'route_table_binding') {
      return tr(deps, 'semanticLogic.routeTableBody', 'Edit source-backed literal route targets without changing route variables, keys, or conditions.');
    }
    if (kind === 'explicit_fallback_helper') {
      return tr(deps, 'semanticLogic.fallbackBody', 'Convert a trailing unconditional route into an explicit mutually exclusive condition.');
    }
    return tr(deps, 'semanticLogic.routeBody', 'Edit route target, predicate, or fallback text with route-order evidence visible beside the operation.');
  }

  function fallbackEditLabel(kind, deps) {
    if (kind === 'effect_clause') {
      return tr(deps, 'semanticLogic.sourceFallbackEffect', 'Effect source fallback');
    }
    if (kind === 'utility_pair') {
      return tr(deps, 'semanticLogic.sourceFallbackUtilityPair', 'Utility pair source preview');
    }
    if (kind === 'route_table_binding') {
      return tr(deps, 'semanticLogic.sourceFallbackRouteTable', 'Route table source preview');
    }
    if (kind === 'explicit_fallback_helper') {
      return tr(deps, 'semanticLogic.sourceFallbackExplicitFallback', 'Explicit fallback source preview');
    }
    return tr(deps, 'semanticLogic.sourceFallbackRoute', 'Route source fallback');
  }

  function sourceLabel(editor, deps) {
    const label = [editor && (editor.sourcePath || editor.source && editor.source.path) || '', sourceLineLabel(editor)].filter(Boolean).join(':');
    return label || tr(deps, 'sourceSlice.sourceMissing', 'Studio could not find the source position for this visible content.');
  }

  function safetyLabel(value, deps) {
    const text = String(value || '');
    if (text === 'advanced_apply') {
      return tr(deps, 'sourceSlice.safety.advanced', 'Advanced apply');
    }
    if (text === 'safe_apply') {
      return tr(deps, 'sourceSlice.safety.safe', 'Safe apply');
    }
    return tr(deps, 'sourceSlice.safety.guarded', 'Guarded apply');
  }

  function sourceLineLabel(editor) {
    const source = editor && editor.source || {};
    const start = Number(editor && (editor.startLine || editor.line) || source.startLine || source.line || 0);
    const end = Number(editor && editor.endLine || source.endLine || start || 0);
    if (!start) {
      return '';
    }
    return end && end !== start ? String(start) + '-' + String(end) : String(start);
  }

  function semanticLogicApi() {
    if (global && global.ProjectMapSemanticLogicEditor) {
      return global.ProjectMapSemanticLogicEditor;
    }
    if (typeof require === 'function') {
      try {
        return require('../authoring/semantic_logic_editor_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function tr(deps, key, fallback) {
    return deps && typeof deps.translate === 'function' ? deps.translate(key, fallback) : fallback;
  }

  function esc(deps, value) {
    return deps && typeof deps.escapeHtml === 'function' ? deps.escapeHtml(value) : String(value === undefined || value === null ? '' : value);
  }

  function attr(deps, value) {
    return deps && typeof deps.escapeAttr === 'function' ? deps.escapeAttr(value) : String(value === undefined || value === null ? '' : value).replace(/"/g, '&quot;');
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
