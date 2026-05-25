// @ts-check
(function initProjectMapAuthoringContextLens(global) {
  'use strict';

  const VERSION = '0.1';

  const api = {
    buildForAction,
    buildForField,
    buildForParityRole,
    buildForOperation,
    normalizeLens
  };

  function buildForAction(action, options) {
    const opts = options || {};
    const value = action && action.editAction || action || {};
    const t = translator(opts.translate);
    const kind = normalizeKind(opts.entryKind || value.entryKind || value.role || 'entry');
    const source = sourceRef(value.source || {});
    const safety = safetyInfo(value.installSafety || value.safety || value.reviewSafety || '', source, t);
    const lens = baseLens(kind, t, {
      context: actionContext(value, kind, t),
      source: sourceLabel(source, t),
      editRoute: editRouteLabel(value.actionKind, value.routeClass, kind, t),
      safety: safety.label,
      safetyClass: safety.key,
      safetyReason: safety.reason,
      usageRule: usageRule(kind, t),
      evidenceState: source.path ? 'source' : 'derived'
    });
    lens.actionKind = String(value.actionKind || '');
    lens.routeClass = String(value.routeClass || '');
    lens.targetView = String(value.targetView || '');
    lens.targetId = String(value.targetId || '');
    lens.fieldId = String(value.fieldId || value.valueKey || '');
    lens.role = String(value.role || kind || '');
    return finalize(lens, t);
  }

  function buildForField(field, options) {
    const opts = options || {};
    const t = translator(opts.translate);
    const value = field && typeof field === 'object' ? field : {};
    const kind = normalizeKind(opts.entryKind || opts.role || value.semanticRole || value.role || 'field');
    const source = sourceRef(value.source || {});
    const actionKind = value.structureAction ? 'draft_structure_field' : 'open_object_field';
    const safety = safetyInfo(value.installSafety || value.applySafety || value.reviewSafety || value.status || '', source, t);
    const lens = baseLens(kind, t, {
      context: fieldContext(value, kind, t),
      source: sourceLabel(source, t),
      editRoute: editRouteLabel(actionKind, value.routeClass || '', kind, t),
      safety: safety.label,
      safetyClass: safety.key,
      safetyReason: safety.reason,
      usageRule: usageRule(kind, t),
      evidenceState: source.path ? 'source' : 'draft'
    });
    lens.actionKind = actionKind;
    lens.fieldId = String(value.id || value.fieldId || '');
    lens.role = String(opts.role || value.semanticRole || value.role || kind || '');
    return finalize(lens, t);
  }

  function buildForParityRole(row, options) {
    const opts = options || {};
    const t = translator(opts.translate);
    const role = normalizeKind(row && row.role || opts.role || 'parity');
    const blocking = Boolean(row && row.blocking);
    const lens = baseLens(role, t, {
      meaning: t('contextLens.meaning.parity', 'Parsed-to-draft parity check'),
      context: t('contextLens.context.parity', 'Parsed {parsed} / draft {draft} / missing {missing}')
        .replace('{parsed}', String(row && row.parsed || 0))
        .replace('{draft}', String(row && row.draft || 0))
        .replace('{missing}', String(row && row.missing || 0)),
      source: t('contextLens.source.derived', 'Derived from parser evidence; no single source anchor.'),
      editRoute: blocking
        ? t('contextLens.route.repairPending', 'Repair workflow required before Review & Apply')
        : t('contextLens.route.reviewWarning', 'Review warning; no repair route required yet'),
      safety: blocking ? t('contextLens.safety.manualReview', 'Manual review') : t('contextLens.safety.guardedApply', 'Guarded'),
      safetyClass: blocking ? 'manual_review' : 'guarded_apply',
      safetyReason: blocking
        ? t('contextLens.safetyReason.parityBlocking', 'Review & Apply stays blocked because supported content would be lost.')
        : t('contextLens.safetyReason.parityWarning', 'This gap should be reviewed, but it is not currently blocking.'),
      usageRule: t('contextLens.rule.parity', 'Do not install a copied draft until visible and behavioral parity is preserved or honestly reviewed.'),
      evidenceState: 'derived'
    });
    lens.role = String(row && row.role || role);
    lens.missing = Number(row && row.missing || 0);
    return finalize(lens, t);
  }

  function buildForOperation(operation, options) {
    const opts = options || {};
    const t = translator(opts.translate);
    const value = operation || {};
    const source = sourceRef({
      path: value.path,
      line: value.line || value.startLine,
      startLine: value.startLine || value.line,
      endLine: value.endLine || value.line,
      anchorText: value.anchorText || value.search || value.before
    });
    const safety = safetyInfo(value.safety || opts.status || '', source, t);
    const lens = baseLens('operation', t, {
      meaning: operationMeaning(value, t),
      context: operationContext(value, t),
      source: sourceLabel(source, t),
      editRoute: t('contextLens.route.installOperation', 'Review & Apply operation'),
      safety: safety.label,
      safetyClass: safety.key,
      safetyReason: opts.reason || value.description || safety.reason,
      usageRule: t('contextLens.rule.operation', 'Apply only after source, safety class, and dry-run evidence look right.'),
      evidenceState: source.path ? 'source' : 'derived'
    });
    lens.operationId = String(value.id || '');
    lens.operationType = String(value.type || '');
    return finalize(lens, t);
  }

  function normalizeLens(lens, options) {
    const t = translator(options && options.translate);
    return finalize(Object.assign({}, lens || {}), t);
  }

  function baseLens(kind, t, fields) {
    const normalized = normalizeKind(kind);
    return Object.assign({
      schemaVersion: VERSION,
      kind: 'authoring_context_lens',
      subjectKind: normalized,
      meaning: meaningLabel(normalized, t),
      context: '',
      source: '',
      editRoute: '',
      safety: '',
      safetyClass: 'unknown',
      safetyReason: '',
      usageRule: usageRule(normalized, t),
      evidenceState: 'unknown'
    }, fields || {});
  }

  function finalize(lens, t) {
    const value = lens && typeof lens === 'object' ? lens : {};
    const rows = [
      row(t('contextLens.field.meaning', 'Meaning'), value.meaning),
      row(t('contextLens.field.context', 'Context'), value.context),
      row(t('contextLens.field.source', 'Source'), value.source),
      row(t('contextLens.field.editRoute', 'Edit route'), value.editRoute),
      row(t('contextLens.field.safety', 'Safety'), [value.safety, value.safetyReason].filter(Boolean).join(' - ')),
      row(t('contextLens.field.usageRule', 'Rule of use'), value.usageRule)
    ].filter((item) => item.value);
    return Object.assign({}, value, {
      schemaVersion: VERSION,
      kind: 'authoring_context_lens',
      rows,
      summary: [value.meaning, value.editRoute, value.safety].filter(Boolean).join(' / ')
    });
  }

  function row(label, value) {
    return {label: String(label || ''), value: String(value || '')};
  }

  function normalizeKind(kind) {
    const text = String(kind || 'entry').trim();
    const lowered = text.replace(/^option_/, 'option-').replace(/_/g, '-').toLowerCase();
    if (/choice/.test(lowered)) {
      return 'option';
    }
    if (/route|target/.test(lowered)) {
      return 'route';
    }
    if (/condition|choose-if|view-if|unavailable/.test(lowered)) {
      return 'condition';
    }
    if (/effect|impact|trigger|background/.test(lowered)) {
      return 'effect';
    }
    if (/variable|q\./.test(lowered)) {
      return 'variable';
    }
    if (/metadata|tag|new-page/.test(lowered)) {
      return 'metadata';
    }
    if (/asset|visual/.test(lowered)) {
      return 'asset';
    }
    if (/result|branch|section/.test(lowered)) {
      return 'result';
    }
    if (/body|title|subtitle|heading|text|field|headline|description/.test(lowered)) {
      return 'text';
    }
    if (/operation|install/.test(lowered)) {
      return 'operation';
    }
    return lowered || 'entry';
  }

  function meaningLabel(kind, t) {
    return {
      text: t('contextLens.meaning.text', 'Player-facing text'),
      option: t('contextLens.meaning.option', 'Player choice'),
      result: t('contextLens.meaning.result', 'Choice result or follow-up text'),
      route: t('contextLens.meaning.route', 'Route target'),
      condition: t('contextLens.meaning.condition', 'Conditional visibility or routing'),
      effect: t('contextLens.meaning.effect', 'State effect'),
      variable: t('contextLens.meaning.variable', 'State variable'),
      metadata: t('contextLens.meaning.metadata', 'Authoring metadata'),
      asset: t('contextLens.meaning.asset', 'Referenced asset'),
      operation: t('contextLens.meaning.operation', 'Install operation')
    }[kind] || t('contextLens.meaning.entry', 'Authoring entry');
  }

  function actionContext(action, kind, t) {
    const parts = [
      action.targetView ? viewLabel(action.targetView, t) : '',
      action.targetId || '',
      action.optionId ? t('contextLens.context.option', 'option {id}').replace('{id}', action.optionId) : '',
      action.role ? roleLabel(action.role) : '',
      action.fieldId ? t('contextLens.context.field', 'field {id}').replace('{id}', action.fieldId) : ''
    ].filter(Boolean);
    return parts.length ? parts.join(' / ') : t('contextLens.context.rendered', 'Rendered {kind} entry').replace('{kind}', meaningLabel(kind, t));
  }

  function fieldContext(field, kind, t) {
    const parts = [
      field.sectionId ? t('contextLens.context.section', 'section {id}').replace('{id}', field.sectionId) : '',
      field.optionId ? t('contextLens.context.option', 'option {id}').replace('{id}', field.optionId) : '',
      field.label || field.id || '',
      field.structureAction ? t('contextLens.context.structureAction', 'draft structure action') : ''
    ].filter(Boolean);
    return parts.length ? parts.join(' / ') : t('contextLens.context.fieldGeneric', 'Editable {kind} field').replace('{kind}', meaningLabel(kind, t));
  }

  function operationContext(operation, t) {
    const parts = [
      operation.type || '',
      operation.path || '',
      operation.id ? t('contextLens.context.operationId', 'operation {id}').replace('{id}', operation.id) : ''
    ].filter(Boolean);
    return parts.length ? parts.join(' / ') : t('contextLens.context.operation', 'Install-plan operation');
  }

  function operationMeaning(operation, t) {
    const type = String(operation && operation.type || '');
    return {
      create_file: t('contextLens.meaning.operationCreateFile', 'Create source file'),
      replace_text: t('contextLens.meaning.operationReplaceText', 'Replace source text'),
      replace_section: t('contextLens.meaning.operationReplaceSection', 'Replace source section'),
      insert_text: t('contextLens.meaning.operationInsertText', 'Insert source text'),
      copy_asset_file: t('contextLens.meaning.operationCopyAsset', 'Copy asset file'),
      manual_snippet: t('contextLens.meaning.operationManualSnippet', 'Manual source snippet')
    }[type] || t('contextLens.meaning.operation', 'Install operation');
  }

  function viewLabel(view, t) {
    const text = String(view || '');
    return {
      events: t('contextLens.view.events', 'events'),
      cards: t('contextLens.view.cards', 'cards'),
      news: t('contextLens.view.news', 'news'),
      variables: t('contextLens.view.variables', 'variables')
    }[text] || text;
  }

  function editRouteLabel(actionKind, routeClass, kind, t) {
    const action = String(actionKind || '');
    if (action === 'open_object_field') {
      return t('contextLens.route.fieldEditor', 'Object field editor');
    }
    if (action === 'open_object_section') {
      return t('contextLens.route.sectionEditor', 'Object section editor');
    }
    if (action === 'open_route_editor') {
      return t('contextLens.route.routeEditor', 'Route / condition editor');
    }
    if (action === 'open_effect_editor') {
      return t('contextLens.route.effectEditor', 'Effect editor');
    }
    if (action === 'open_variable_editor') {
      return t('contextLens.route.variableWorkspace', 'Variable workspace');
    }
    if (action === 'open_source_slice') {
      return t('contextLens.route.sourceSlice', 'Source Slice fallback');
    }
    if (action === 'open_advanced_source_patch') {
      return t('contextLens.route.advancedSourcePatch', 'Advanced source patch');
    }
    if (action === 'draft_structure_field') {
      return t('contextLens.route.draftStructure', 'Draft structure builder');
    }
    if (String(routeClass || '').includes('source_slice')) {
      return t('contextLens.route.sourceSlice', 'Source Slice fallback');
    }
    return kind === 'operation'
      ? t('contextLens.route.installOperation', 'Review & Apply operation')
      : t('contextLens.route.visibleEntry', 'Visible authoring entry');
  }

  function safetyInfo(value, source, t) {
    const text = String(value || '').trim();
    const path = String(source && source.path || '').toLowerCase();
    const key = /refused/.test(text) ? 'refused'
      : /manual/.test(text) ? 'manual_review'
        : /advanced|protected|router/.test(text) || /(?:router|post_event|root)\b/.test(path) ? 'advanced_apply'
          : /safe_apply|safe/.test(text) ? 'safe_apply'
            : /guarded|replace|source|draft/.test(text) ? 'guarded_apply'
              : 'unknown';
    const labels = {
      safe_apply: t('contextLens.safety.safeApply', 'Safe apply'),
      guarded_apply: t('contextLens.safety.guardedApply', 'Guarded apply'),
      advanced_apply: t('contextLens.safety.advancedApply', 'Advanced apply'),
      manual_review: t('contextLens.safety.manualReview', 'Manual review'),
      refused: t('contextLens.safety.refused', 'Refused'),
      unknown: t('contextLens.safety.unknown', 'Unknown')
    };
    const reasons = {
      safe_apply: t('contextLens.safetyReason.safeApply', 'Generated or isolated operation; still reviewed before apply.'),
      guarded_apply: t('contextLens.safetyReason.guardedApply', 'Source-backed edit requires the original anchor to still match.'),
      advanced_apply: t('contextLens.safetyReason.advancedApply', 'Sensitive source or protected boundary requires explicit advanced review.'),
      manual_review: t('contextLens.safetyReason.manualReview', 'Studio can explain this path but should not apply it automatically.'),
      refused: t('contextLens.safetyReason.refused', 'This operation is outside Studio automatic-apply boundaries.'),
      unknown: t('contextLens.safetyReason.unknown', 'Safety evidence is incomplete; review before proceeding.')
    };
    return {key, label: labels[key], reason: reasons[key]};
  }

  function usageRule(kind, t) {
    return {
      text: t('contextLens.rule.text', 'Changing this affects player-facing prose when the source anchor remains stable.'),
      option: t('contextLens.rule.option', 'Changing this changes the choice label players click.'),
      result: t('contextLens.rule.result', 'Changing this changes what players read after a choice or branch.'),
      route: t('contextLens.rule.route', 'Changing this changes where the player goes next; confirm the target exists.'),
      condition: t('contextLens.rule.condition', 'Changing this can hide or reveal content; review affected routes.'),
      effect: t('contextLens.rule.effect', 'Changing this writes game state; review shared-line and variable impact.'),
      variable: t('contextLens.rule.variable', 'Changing this may affect every reader and writer of the variable.'),
      metadata: t('contextLens.rule.metadata', 'Changing this can affect rendering or classification, not only prose.'),
      asset: t('contextLens.rule.asset', 'Changing this affects a referenced visual or audio file.'),
      operation: t('contextLens.rule.operation', 'Apply only after source, safety class, and dry-run evidence look right.')
    }[kind] || t('contextLens.rule.entry', 'Review meaning, source, and safety before editing.');
  }

  function sourceLabel(source, t) {
    const value = sourceRef(source);
    if (!value.path) {
      return t('contextLens.source.derived', 'Derived from parser evidence; no single source anchor.');
    }
    const line = value.startLine || value.line || '';
    const end = value.endLine && value.endLine !== line ? '-' + value.endLine : '';
    return value.path + (line ? ':' + line + end : '');
  }

  function sourceRef(source) {
    const value = source && typeof source === 'object' ? source : {};
    return {
      path: String(value.path || '').trim(),
      line: numberOrNull(value.line || value.startLine),
      startLine: numberOrNull(value.startLine || value.line),
      endLine: numberOrNull(value.endLine || value.line || value.startLine),
      anchorText: String(value.anchorText || value.text || '').trim()
    };
  }

  function numberOrNull(value) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  function roleLabel(value) {
    return String(value || '').replace(/[_-]+/g, ' ').replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }

  function translator(fn) {
    return typeof fn === 'function' ? fn : (_key, fallback) => fallback;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapAuthoringContextLens = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
