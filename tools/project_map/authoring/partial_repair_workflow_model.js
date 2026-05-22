(function initProjectMapPartialRepairWorkflow(global) {
  'use strict';

  const VERSION = '0.1';

  const api = {
    buildRepairEntries
  };

  function buildRepairEntries(parity, options) {
    const opts = options || {};
    const t = translator(opts.translate);
    const model = opts.model || {};
    const body = model.eventBody || opts.body || {};
    const roles = parity && parity.roles || {};
    const rows = Object.keys(roles).map((key) => roles[key]).filter((row) => row && Number(row.missing || 0) > 0);
    const entries = rows.map((row) => repairEntryForRole(row, body, model, t));
    blockerRepairEntries(parity && parity.blockers, body, model, t).forEach((entry) => entries.push(entry));
    return entries;
  }

  function blockerRepairEntries(blockers, body, model, t) {
    return ensureArray(blockers).map((item) => sparseChoiceRepairEntry(item, body, model, t)).filter(Boolean);
  }

  function sparseChoiceRepairEntry(blocker, body, model, t) {
    const code = String(blocker && blocker.code || '').trim();
    if (code !== 'parsed_to_draft.choice_event_too_few_options' && code !== 'parsed_to_draft.root_choice_missing') {
      return null;
    }
    const targetView = targetViewForModel(model);
    const targetId = String(model && (model.objectId || model.sceneId) || '').trim();
    const action = {
      actionKind: 'open_object_section',
      routeClass: 'object_structure',
      targetView,
      targetId,
      fieldId: 'structure_add_option',
      valueKey: 'structure_add_option',
      label: t('partialRepair.label.sparseChoice', 'Repair sparse root choices'),
      role: 'sparse_root_choice',
      source: sourceRef(firstStructureSource(body)),
      installSafety: 'guarded_apply',
      draftAction: true
    };
    const entry = {
      schemaVersion: VERSION,
      kind: 'partial_repair_entry',
      id: 'repair_sparse_root_choice',
      role: 'sparse_root_choice',
      repairKind: 'option',
      label: t('partialRepair.label.sparseChoice', 'Repair sparse root choices'),
      description: String(blocker && blocker.message || '') || t('partialRepair.description.sparseChoice', 'Add a visible root option, convert to a text event, or link the existing structure before install.'),
      blocking: true,
      missing: 1,
      parsed: 0,
      draft: 0,
      status: 'blocking',
      repairable: true,
      reviewable: true,
      boundaryKind: '',
      boundaryReason: '',
      repairAction: action,
      routeLabel: t('partialRepair.route.structureEditor', 'Open event structure')
    };
    entry.lens = lensForEntry(entry, {role: 'sparse_root_choice', blocking: true, missing: 1}, t);
    return entry;
  }

  function firstStructureSource(body) {
    return ensureArray(body && body.structureActions).map((field) => field && (field.source || firstUsageSource(field))).find((source) => source && source.path) || {};
  }

  function repairEntryForRole(row, body, model, t) {
    const role = String(row && row.role || '').trim();
    const kind = normalizedRole(role);
    const field = fieldForRole(kind, role, body);
    const targetView = targetViewForModel(model);
    const targetId = String(model && (model.objectId || model.sceneId) || '').trim();
    const blocking = Boolean(row && row.blocking);
    const entry = {
      schemaVersion: VERSION,
      kind: 'partial_repair_entry',
      id: 'repair_' + safeId(role || kind),
      role,
      repairKind: kind,
      label: repairLabel(kind, role, t),
      description: repairDescription(kind, role, blocking, t),
      blocking,
      missing: Number(row && row.missing || 0),
      parsed: Number(row && row.parsed || 0),
      draft: Number(row && row.draft || 0),
      status: blocking ? 'blocking' : 'warning',
      repairable: false,
      reviewable: false,
      boundaryKind: 'manual_source_review',
      boundaryReason: boundaryReason(kind, t),
      repairAction: null
    };
    const action = actionForField(field, kind, {
      targetView,
      targetId,
      role
    });
    if (action) {
      entry.reviewable = true;
      entry.repairable = kind !== 'asset';
      entry.repairAction = action;
      entry.routeLabel = routeLabel(action.actionKind, kind, t);
      if (kind !== 'asset') {
        entry.boundaryKind = '';
        entry.boundaryReason = '';
      } else {
        entry.boundaryKind = 'asset_proposal_required';
        entry.boundaryReason = boundaryReason(kind, t);
      }
    } else {
      entry.routeLabel = boundaryRouteLabel(kind, t);
    }
    entry.lens = lensForEntry(entry, row, t);
    return entry;
  }

  function fieldForRole(kind, role, body) {
    if (!body || typeof body !== 'object') {
      return null;
    }
    if (role === 'title') {
      return body.title || body.heading || null;
    }
    if (role === 'subtitle') {
      return fieldMatching(ensureArray(body.sections), /subtitle/i);
    }
    if (role === 'heading') {
      return body.heading || body.title || null;
    }
    if (kind === 'body') {
      return ensureArray(body.sections).find((field) => field && fieldValue(field)) || body.title || null;
    }
    if (kind === 'option') {
      const option = ensureArray(body.options)[0] || {};
      return ensureArray(option.fields).find((field) => field && fieldValue(field)) || null;
    }
    if (kind === 'section') {
      return ensureArray(body.branchSections).find((field) => field && fieldValue(field)) ||
        ensureArray(body.sections).find((field) => field && fieldValue(field)) || null;
    }
    if (kind === 'condition') {
      return ensureArray(body.metaFields).find((field) => /view|choose|condition|if|route/i.test(String(field && (field.role || field.label || field.id) || ''))) ||
        ensureArray(body.sections).find((field) => ensureArray(field && field.conditions).length) || null;
    }
    if (kind === 'effect') {
      return ensureArray(body.effects).find(Boolean) ||
        ensureArray(body.backgroundEffects).find(Boolean) ||
        ensureArray(body.optionEffects).flatMap((group) => ensureArray(group && group.fields)).find(Boolean) || null;
    }
    if (kind === 'metadata') {
      return ensureArray(body.metaFields).find(Boolean) || null;
    }
    if (kind === 'asset') {
      return ensureArray(body.assets).find((asset) => asset && (asset.path || asset.id || asset.source)) ||
        ensureArray(body.sections).find((field) => String(field && field.role || '') === 'asset_reference') ||
        ensureArray(body.metaFields).find((field) => String(field && field.role || '') === 'asset_reference') ||
        null;
    }
    return null;
  }

  function actionForField(field, kind, context) {
    const value = field && typeof field === 'object' ? field : null;
    if (!value) {
      return null;
    }
    const source = sourceRef(value.source || firstUsageSource(value));
    const fieldId = String(value.id || value.fieldId || '').trim();
    const installSafety = installSafetyFor(value, source);
    const base = {
      entryKind: kind,
      targetView: context.targetView,
      targetId: context.targetId,
      fieldId,
      valueKey: fieldId,
      label: String(value.label || value.id || context.role || kind || '').trim(),
      role: context.role || kind,
      source,
      installSafety,
      draftAction: true
    };
    if (kind === 'condition') {
      return Object.assign(base, {
        actionKind: 'open_route_editor',
        routeClass: installSafety === 'advanced_apply' ? 'advanced_source_patch' : 'route_editor',
        semanticEditor: {kind: 'route_order', sceneId: context.targetId, fieldId, role: context.role || 'condition', source}
      });
    }
    if (kind === 'effect') {
      return Object.assign(base, {
        actionKind: 'open_effect_editor',
        routeClass: installSafety === 'advanced_apply' ? 'advanced_source_patch' : 'effect_clause_editor',
        semanticEditor: {kind: 'effect_clause', sceneId: context.targetId, fieldId, role: context.role || 'effect', source}
      });
    }
    if (kind === 'asset') {
      if (fieldId) {
        return Object.assign(base, {
          actionKind: 'open_object_field',
          routeClass: 'asset_reference',
          draftAction: true
        });
      }
      if (source.path) {
        return Object.assign(base, {
          actionKind: installSafety === 'advanced_apply' ? 'open_advanced_source_patch' : 'open_source_slice',
          routeClass: installSafety === 'advanced_apply' ? 'advanced_source_patch' : 'source_slice_editor',
          draftAction: false
        });
      }
      return null;
    }
    if (!fieldId && source.path) {
      return Object.assign(base, {
        actionKind: installSafety === 'advanced_apply' ? 'open_advanced_source_patch' : 'open_source_slice',
        routeClass: installSafety === 'advanced_apply' ? 'advanced_source_patch' : 'source_slice_editor',
        draftAction: false
      });
    }
    if (!fieldId) {
      return null;
    }
    return Object.assign(base, {
      actionKind: kind === 'body' || kind === 'section' ? 'open_object_section' : 'open_object_field',
      routeClass: 'object_field'
    });
  }

  function lensForEntry(entry, row, t) {
    const contextLens = contextLensApi();
    if (contextLens && typeof contextLens.buildForAction === 'function' && entry.repairAction) {
      const lens = contextLens.buildForAction(entry.repairAction, {entryKind: entry.repairKind, translate: t});
      return Object.assign({}, lens, {
        meaning: entry.label,
        context: entry.description,
        usageRule: repairRule(entry.repairKind, t),
        rows: contextLens.normalizeLens(Object.assign({}, lens, {
          meaning: entry.label,
          context: entry.description,
          usageRule: repairRule(entry.repairKind, t)
        }), {translate: t}).rows
      });
    }
    if (contextLens && typeof contextLens.buildForParityRole === 'function') {
      const lens = contextLens.buildForParityRole(row, {translate: t});
      return Object.assign({}, lens, {
        meaning: entry.label,
        editRoute: entry.routeLabel,
        usageRule: repairRule(entry.repairKind, t),
        rows: contextLens.normalizeLens(Object.assign({}, lens, {
          meaning: entry.label,
          editRoute: entry.routeLabel,
          usageRule: repairRule(entry.repairKind, t)
        }), {translate: t}).rows
      });
    }
    return null;
  }

  function normalizedRole(role) {
    const text = String(role || '').toLowerCase();
    if (/title|subtitle|heading|body/.test(text)) {
      return 'body';
    }
    if (/option/.test(text)) {
      return 'option';
    }
    if (/section/.test(text)) {
      return 'section';
    }
    if (/condition|viewif|view-if|choose/.test(text)) {
      return 'condition';
    }
    if (/effect/.test(text)) {
      return 'effect';
    }
    if (/asset/.test(text)) {
      return 'asset';
    }
    if (/metadata|tag|newpage/.test(text)) {
      return 'metadata';
    }
    return text || 'role';
  }

  function repairLabel(kind, role, t) {
    return {
      body: t('partialRepair.label.body', 'Repair missing visible text'),
      option: t('partialRepair.label.option', 'Repair missing option structure'),
      section: t('partialRepair.label.section', 'Repair missing section structure'),
      condition: t('partialRepair.label.condition', 'Repair missing condition'),
      effect: t('partialRepair.label.effect', 'Repair missing effect'),
      asset: t('partialRepair.label.asset', 'Review missing asset support'),
      metadata: t('partialRepair.label.metadata', 'Review missing metadata')
    }[kind] || t('partialRepair.label.generic', 'Review missing parsed role') + ': ' + role;
  }

  function repairDescription(kind, role, blocking, t) {
    const suffix = blocking
      ? t('partialRepair.description.blocking', 'Review & Apply remains blocked until this is handled.')
      : t('partialRepair.description.warning', 'This should be reviewed before install.');
    const body = {
      body: t('partialRepair.description.body', 'A parsed player-visible text role is not preserved in the draft.'),
      option: t('partialRepair.description.option', 'A parsed option or section-owned option is not preserved in the draft.'),
      section: t('partialRepair.description.section', 'A parsed section or follow-up block is not preserved in the draft.'),
      condition: t('partialRepair.description.condition', 'A parsed condition or view-if route is not preserved in the draft.'),
      effect: t('partialRepair.description.effect', 'A parsed state effect is not preserved in the draft.'),
      asset: t('partialRepair.description.asset', 'A parsed asset reference is not preserved in the draft.'),
      metadata: t('partialRepair.description.metadata', 'Parsed metadata is not fully represented in the draft.')
    }[kind] || t('partialRepair.description.generic', 'Parsed role is not fully represented in the draft.') + ' ' + role;
    return body + ' ' + suffix;
  }

  function repairRule(kind, t) {
    return {
      body: t('partialRepair.rule.body', 'Preserve all player-visible prose before installing a copied draft.'),
      option: t('partialRepair.rule.option', 'Preserve player choices and their targets before install.'),
      section: t('partialRepair.rule.section', 'Preserve follow-up sections and branch text before install.'),
      condition: t('partialRepair.rule.condition', 'Preserve conditions so copied content appears in the same situations.'),
      effect: t('partialRepair.rule.effect', 'Preserve effects so copied content keeps the same state changes.'),
      asset: t('partialRepair.rule.asset', 'Review asset references before install; missing file evidence may need manual setup.'),
      metadata: t('partialRepair.rule.metadata', 'Review metadata because it can affect rendering and classification.')
    }[kind] || t('partialRepair.rule.generic', 'Handle missing parsed content before installing.');
  }

  function routeLabel(actionKind, kind, t) {
    const action = String(actionKind || '');
    if (action === 'open_route_editor') {
      return t('partialRepair.route.conditionEditor', 'Open condition editor');
    }
    if (action === 'open_effect_editor') {
      return t('partialRepair.route.effectEditor', 'Open effect editor');
    }
    if (action === 'open_source_slice' || action === 'open_advanced_source_patch') {
      return t('partialRepair.route.sourceSlice', 'Open source-backed repair');
    }
    if (action === 'open_object_section') {
      return t('partialRepair.route.sectionEditor', 'Open section field');
    }
    if (action === 'open_object_field') {
      if (kind === 'option') {
        return t('partialRepair.route.optionEditor', 'Open option field');
      }
      if (kind === 'asset') {
        return t('partialRepair.route.assetReference', 'Open asset reference review');
      }
      return t('partialRepair.route.fieldEditor', 'Open matching field');
    }
    return t('partialRepair.route.openRepair', 'Open repair path');
  }

  function boundaryRouteLabel(kind, t) {
    return kind === 'asset'
      ? t('partialRepair.route.assetBoundary', 'Prepare an asset proposal or review source manually')
      : t('partialRepair.route.manualBoundary', 'Manual source review required');
  }

  function boundaryReason(kind, t) {
    return kind === 'asset'
      ? t('partialRepair.boundary.asset', 'Studio needs concrete replacement file evidence before it can build an asset copy proposal.')
      : t('partialRepair.boundary.manual', 'No reliable field or source-backed repair anchor is available yet.');
  }

  function targetViewForModel(model) {
    const view = String(model && (model.objectView || model.view || model.targetView) || '');
    if (view) {
      return view;
    }
    const kind = String(model && (model.objectKind || '') || '');
    return kind === 'card' ? 'cards' : kind === 'news' ? 'news' : 'events';
  }

  function installSafetyFor(field, source) {
    const explicit = String(field && (field.installSafety || field.applySafety || field.reviewSafety) || '').trim();
    if (/^(safe_apply|guarded_apply|advanced_apply)$/.test(explicit)) {
      return explicit;
    }
    const status = String(field && (field.status || field.editability || field.routeClass) || '').trim();
    if (/advanced|protected|router|manual/i.test(status)) {
      return 'advanced_apply';
    }
    const path = String(source && source.path || '').toLowerCase();
    if (/(?:router|post_event|root)\b/.test(path)) {
      return 'advanced_apply';
    }
    if (/safe/i.test(status)) {
      return 'safe_apply';
    }
    return 'guarded_apply';
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

  function firstUsageSource(value) {
    return ensureArray(value && value.usageRefs).map((row) => row && row.source).find((source) => source && source.path) || {};
  }

  function numberOrNull(value) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  }

  function fieldValue(field) {
    return String(field && (field.value !== undefined ? field.value : field.text || field.label || '') || '').trim();
  }

  function fieldMatching(fields, pattern) {
    return ensureArray(fields).find((field) => pattern.test(String(field && (field.id || field.label || field.semanticRole || '') || ''))) || null;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeId(value) {
    return String(value || 'role').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
  }

  function translator(fn) {
    return typeof fn === 'function' ? fn : (_key, fallback) => fallback;
  }

  function contextLensApi() {
    if (global && global.ProjectMapAuthoringContextLens) {
      return global.ProjectMapAuthoringContextLens;
    }
    if (typeof require === 'function') {
      try {
        return require('./authoring_context_lens_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapPartialRepairWorkflow = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
