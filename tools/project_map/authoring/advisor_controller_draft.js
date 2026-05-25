(function initProjectMapAdvisorControllerDraft(global) {
  'use strict';

  const DRAFT_VERSION = '0.1';

  function defaultDraft(projectIndex) {
    const controllers = advisorControllerModel(projectIndex).advisorControllers || [];
    return controllers[0] ? draftFromController(controllers[0], projectIndex) : normalizeDraft({
      schemaVersion: DRAFT_VERSION,
      kind: 'advisor_controller',
      id: 'advisor_controller_update',
      controllerId: '',
      entryLabel: 'Advisor Controller',
      roster: [],
      authoringStatus: 'partial',
      authoringBlockers: ['No advisor controller semantic evidence is available.']
    });
  }

  function draftForController(projectIndex, controllerId) {
    const model = advisorControllerModel(projectIndex);
    const controller = ensureArray(model.advisorControllers).find((item) => String(item.id || '') === String(controllerId || '')) || ensureArray(model.advisorControllers)[0];
    return controller ? draftFromController(controller, projectIndex) : defaultDraft(projectIndex);
  }

  function draftFromController(controller, projectIndex) {
    const value = isObject(controller) ? controller : {};
    const pinnedEntryScene = sceneById(projectIndex, value.pinnedEntry && value.pinnedEntry.id);
    return normalizeDraft({
      schemaVersion: DRAFT_VERSION,
      kind: 'advisor_controller',
      id: 'advisor_controller_' + safeId(value.id || 'update'),
      controllerId: String(value.id || ''),
      controllerSceneId: String(value.controllerSceneId || value.id || ''),
      title: String(value.title || value.id || 'Advisor controller'),
      entryLabel: String(value.pinnedEntry && value.pinnedEntry.title || value.title || value.id || 'Advisor controller'),
      originalEntryLabel: String(value.pinnedEntry && value.pinnedEntry.title || value.title || value.id || 'Advisor controller'),
      pinnedEntryId: String(value.pinnedEntry && value.pinnedEntry.id || ''),
      pinnedEntryTargetSceneId: String(value.pinnedEntry && value.pinnedEntry.targetSceneId || ''),
      capacityGate: clone(value.capacityGate || {}),
      roster: ensureArray(value.roster).map((item) => rosterDraftItem(item, projectIndex)),
      addAdvisorId: '',
      removeAdvisorId: '',
      evidence: {
        sourceAnchor: sourceRef(value.sourceAnchor || {}),
        pinnedEntryTitle: sourceRef(pinnedEntryScene && pinnedEntryScene.metadata && pinnedEntryScene.metadata.title || value.pinnedEntry && value.pinnedEntry.source || {}),
        pinnedEntryRoute: sourceRef(value.pinnedEntry && value.pinnedEntry.routeSource || {})
      },
      confidence: String(value.confidence || 'partial'),
      authoringStatus: value.confidence === 'exact' ? 'ready' : 'partial',
      authoringBlockers: value.manualBoundary ? [String(value.manualBoundary)] : []
    });
  }

  function rosterDraftItem(item, projectIndex) {
    const value = isObject(item) ? item : {};
    const card = sceneById(projectIndex, value.pinnedCardSceneId || value.advisorId);
    const tags = ensureArray(card && card.tags).map(String).filter(Boolean);
    const categories = ensureArray(value.categoryTags).length ? ensureArray(value.categoryTags).map(String) : tags.filter((tag) => tag !== 'advisor');
    const addEffect = sourceRef(value.sourceAnchors && value.sourceAnchors.addEffect || {});
    const removeEffect = sourceRef(value.sourceAnchors && value.sourceAnchors.removeEffect || {});
    return {
      advisorId: String(value.advisorId || value.pinnedCardSceneId || ''),
      title: String(value.title || value.advisorId || ''),
      originalTitle: String(value.title || value.advisorId || ''),
      activeVariable: String(value.activeVariable || ''),
      originalActiveVariable: String(value.activeVariable || ''),
      category: categories.join(', '),
      originalCategory: categories.join(', '),
      pinnedCardSceneId: String(value.pinnedCardSceneId || value.advisorId || ''),
      addSectionId: String(value.addSectionId || ''),
      removeSectionId: String(value.removeSectionId || ''),
      addLabel: String(value.addLabel || ''),
      originalAddLabel: String(value.addLabel || ''),
      removeLabel: String(value.removeLabel || ''),
      originalRemoveLabel: String(value.removeLabel || ''),
      addEffectText: addEffect.anchorText || '',
      originalAddEffectText: addEffect.anchorText || '',
      removeEffectText: removeEffect.anchorText || '',
      originalRemoveEffectText: removeEffect.anchorText || '',
      confidence: String(value.confidence || 'manual'),
      sourceAnchors: normalizeSourceAnchors(value.sourceAnchors || {})
    };
  }

  function normalizeDraft(input) {
    const value = isObject(input) ? input : {};
    return {
      schemaVersion: String(value.schemaVersion || DRAFT_VERSION),
      kind: 'advisor_controller',
      id: safeId(value.id || 'advisor_controller_update'),
      controllerId: String(value.controllerId || value.id || ''),
      controllerSceneId: String(value.controllerSceneId || value.controllerId || ''),
      title: String(value.title || value.entryLabel || 'Advisor controller'),
      entryLabel: String(value.entryLabel || value.title || 'Advisor controller'),
      originalEntryLabel: String(value.originalEntryLabel || value.entryLabel || value.title || 'Advisor controller'),
      pinnedEntryId: String(value.pinnedEntryId || ''),
      pinnedEntryTargetSceneId: String(value.pinnedEntryTargetSceneId || ''),
      capacityGate: clone(value.capacityGate || {}),
      roster: ensureArray(value.roster).map((item) => ({
        advisorId: String(item && item.advisorId || ''),
        title: String(item && item.title || ''),
        originalTitle: String(item && (item.originalTitle || item.title) || ''),
        activeVariable: String(item && item.activeVariable || ''),
        originalActiveVariable: String(item && (item.originalActiveVariable || item.activeVariable) || ''),
        category: String(item && item.category || ''),
        originalCategory: String(item && (item.originalCategory || item.category) || ''),
        pinnedCardSceneId: String(item && item.pinnedCardSceneId || item && item.advisorId || ''),
        addSectionId: String(item && item.addSectionId || ''),
        removeSectionId: String(item && item.removeSectionId || ''),
        addLabel: String(item && item.addLabel || ''),
        originalAddLabel: String(item && (item.originalAddLabel || item.addLabel) || ''),
        removeLabel: String(item && item.removeLabel || ''),
        originalRemoveLabel: String(item && (item.originalRemoveLabel || item.removeLabel) || ''),
        addEffectText: String(item && item.addEffectText || ''),
        originalAddEffectText: String(item && (item.originalAddEffectText || item.addEffectText) || ''),
        removeEffectText: String(item && item.removeEffectText || ''),
        originalRemoveEffectText: String(item && (item.originalRemoveEffectText || item.removeEffectText) || ''),
        confidence: String(item && item.confidence || 'manual'),
        sourceAnchors: normalizeSourceAnchors(item && item.sourceAnchors || {})
      })).filter((item) => item.advisorId),
      addAdvisorId: String(value.addAdvisorId || ''),
      removeAdvisorId: String(value.removeAdvisorId || ''),
      evidence: {
        sourceAnchor: sourceRef(value.evidence && value.evidence.sourceAnchor || {}),
        pinnedEntryTitle: sourceRef(value.evidence && value.evidence.pinnedEntryTitle || {}),
        pinnedEntryRoute: sourceRef(value.evidence && value.evidence.pinnedEntryRoute || {})
      },
      confidence: String(value.confidence || 'partial'),
      authoringStatus: String(value.authoringStatus || (value.confidence === 'exact' ? 'ready' : 'partial')) === 'partial' ? 'partial' : 'ready',
      authoringBlockers: ensureArray(value.authoringBlockers).map(String).filter(Boolean)
    };
  }

  function buildExportBundle(input, projectIndex) {
    const draft = normalizeDraft(input);
    const operations = draft.authoringStatus === 'partial'
      ? [manualOperation('advisor_controller_partial_boundary', 'advisor_controller.manual_boundary', draft.authoringBlockers.join(' ') || 'Advisor controller requires manual review before automatic edits.')]
      : advisorControllerOperations(draft, projectIndex);
    if (!operations.length) {
      operations.push(manualOperation('advisor_controller_review_boundary', 'advisor_controller.noop', 'No advisor controller changes were requested.'));
    }
    const installApi = installPlanApi();
    const plan = installApi.buildInstallPlan({
      id: draft.id,
      draftKind: 'advisor_controller',
      title: draft.entryLabel || draft.controllerId,
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
      operations
    });
    const installPlanJson = installApi.renderInstallPlanJson(plan);
    const patchPreview = installApi.renderPatchPreview(plan);
    const installChecklist = installApi.renderOperationChecklist(plan);
    const draftJson = JSON.stringify(draft, null, 2) + '\n';
    return {
      ok: draft.authoringStatus !== 'partial',
      draft,
      diagnostics: draft.authoringStatus === 'partial' ? [{level: 'warning', code: 'advisor_controller.partial_boundary', message: draft.authoringBlockers.join(' ') || 'Advisor controller requires manual review.'}] : [],
      previewText: advisorControllerPreview(draft),
      proposal: advisorControllerPreview(draft),
      draftJson,
      installPlan: plan,
      installPlanJson,
      patchPreview,
      installChecklist,
      installNotes: advisorControllerNotes(draft, operations)
    };
  }

  function advisorControllerOperations(draft, projectIndex) {
    const operations = [];
    if (draft.entryLabel !== draft.originalEntryLabel) {
      operations.push(textLineOperation('advisor_controller_update_entry', 'advisor_controller.update_entry', draft.evidence.pinnedEntryTitle, 'title: ' + draft.originalEntryLabel, 'title: ' + draft.entryLabel, 'Update the advisor controller pinned entry title.'));
    }
    ensureArray(draft.roster).forEach((item) => {
      operations.push(...rosterItemOperations(item, projectIndex, draft));
    });
    if (draft.addAdvisorId) {
      operations.push(groupedManualOperation('advisor_controller_add_roster_item_' + safeId(draft.addAdvisorId), 'advisor_controller.add_roster_item', 'Add advisor candidate ' + draft.addAdvisorId + ' after reviewing pinned card, controller add flow, remove flow, and category route.', draft));
    }
    if (draft.removeAdvisorId) {
      operations.push(groupedManualOperation('advisor_controller_remove_roster_item_' + safeId(draft.removeAdvisorId), 'advisor_controller.remove_roster_item', 'Remove advisor candidate ' + draft.removeAdvisorId + ' only after explicit review; Studio will not delete controller sections automatically.', draft));
    }
    return operations.filter(Boolean);
  }

  function rosterItemOperations(item, projectIndex, draft) {
    const operations = [];
    const card = sceneById(projectIndex, item.pinnedCardSceneId || item.advisorId);
    if (item.title !== item.originalTitle) {
      const source = sourceRef(card && card.metadata && card.metadata.title || item.sourceAnchors.pinnedCard || {});
      operations.push(textLineOperation('advisor_controller_title_' + safeId(item.advisorId), 'advisor_controller.update_roster_item', source, 'title: ' + item.originalTitle, 'title: ' + item.title, 'Update advisor display card title.', draft, item.advisorId));
    }
    if (item.category !== item.originalCategory) {
      const source = sourceRef(card && card.metadata && card.metadata.tags || item.sourceAnchors.tags || {});
      const beforeTags = categoryTagsLine(item.originalCategory);
      const afterTags = categoryTagsLine(item.category);
      operations.push(textLineOperation('advisor_controller_category_' + safeId(item.advisorId), 'advisor_controller.update_roster_item', source, beforeTags, afterTags, 'Update advisor category/faction tags.', draft, item.advisorId));
    }
    if (item.activeVariable !== item.originalActiveVariable) {
      const source = sourceRef(card && card.metadata && card.metadata.viewIf || item.sourceAnchors.viewIf || {});
      operations.push(textLineOperation('advisor_controller_variable_' + safeId(item.advisorId), 'advisor_controller.update_roster_item', source, 'view-if: ' + item.originalActiveVariable + ' = 1', 'view-if: ' + item.activeVariable + ' = 1', 'Update advisor visibility variable.', draft, item.advisorId));
    }
    if (item.addLabel !== item.originalAddLabel) {
      operations.push(groupedManualOperation('advisor_controller_add_label_' + safeId(item.advisorId), 'advisor_controller.update_roster_item', 'Update add label for ' + item.advisorId + ' after reviewing the add section source.', draft, item.advisorId));
    }
    if (item.removeLabel !== item.originalRemoveLabel) {
      operations.push(groupedManualOperation('advisor_controller_remove_label_' + safeId(item.advisorId), 'advisor_controller.update_roster_item', 'Update remove label for ' + item.advisorId + ' after reviewing the remove section source.', draft, item.advisorId));
    }
    if (item.addEffectText !== item.originalAddEffectText) {
      operations.push(textLineOperation('advisor_controller_add_effect_' + safeId(item.advisorId), 'advisor_controller.update_roster_item', item.sourceAnchors.addEffect, item.originalAddEffectText, item.addEffectText, 'Update advisor add effect.', draft, item.advisorId));
    }
    if (item.removeEffectText !== item.originalRemoveEffectText) {
      operations.push(textLineOperation('advisor_controller_remove_effect_' + safeId(item.advisorId), 'advisor_controller.update_roster_item', item.sourceAnchors.removeEffect, item.originalRemoveEffectText, item.removeEffectText, 'Update advisor remove effect.', draft, item.advisorId));
    }
    return operations;
  }

  function textLineOperation(id, semanticOperation, sourceInput, search, replace, description, draft, advisorId) {
    const source = sourceRef(sourceInput || {});
    if (source.path && source.line && String(search || '').trim() && String(replace || '').trim()) {
      return {
        id,
        type: 'replace_text',
        path: source.path,
        line: source.line,
        search,
        replace,
        safety: 'guarded_apply',
        role: semanticOperation,
        semanticOperation,
        groupId: draft ? 'advisor_controller:' + draft.controllerId : '',
        reviewSummary: advisorId ? 'Advisor roster item: ' + advisorId : 'Advisor controller entry',
        description
      };
    }
    return groupedManualOperation(id, semanticOperation, description + ' Exact source evidence is missing.', draft, advisorId);
  }

  function manualOperation(id, semanticOperation, message) {
    return {
      id,
      type: 'manual_snippet',
      path: '',
      content: message + '\n',
      safety: 'manual_review',
      role: semanticOperation,
      semanticOperation,
      description: message
    };
  }

  function groupedManualOperation(id, semanticOperation, message, draft, advisorId) {
    return Object.assign(manualOperation(id, semanticOperation, message), {
      groupId: draft ? 'advisor_controller:' + draft.controllerId : '',
      reviewSummary: advisorId ? 'Advisor roster item: ' + advisorId : 'Advisor controller roster change'
    });
  }

  function categoryTagsLine(value) {
    const tags = ['advisor'].concat(splitList(value));
    return 'tags: ' + unique(tags).join(', ');
  }

  function advisorControllerPreview(draft) {
    return [
      'Advisor controller: ' + (draft.entryLabel || draft.controllerId),
      'Pinned entry: ' + (draft.pinnedEntryId || 'none'),
      'Roster items: ' + String(draft.roster.length),
      draft.addAdvisorId ? 'Add candidate: ' + draft.addAdvisorId : '',
      draft.removeAdvisorId ? 'Remove candidate: ' + draft.removeAdvisorId : ''
    ].filter(Boolean).join('\n') + '\n';
  }

  function advisorControllerNotes(draft, operations) {
    return ['Advisor Controller install proposal', '', advisorControllerPreview(draft).trim(), '', 'Operations:', ...operations.map((operation) => '- ' + operation.role + ': ' + operation.description)].join('\n') + '\n';
  }

  function normalizeSourceAnchors(value) {
    const source = isObject(value) ? value : {};
    return {
      pinnedCard: sourceRef(source.pinnedCard || {}),
      viewIf: sourceRef(source.viewIf || {}),
      tags: sourceRef(source.tags || {}),
      addEffect: sourceRef(source.addEffect || {}),
      removeEffect: sourceRef(source.removeEffect || {}),
      addSection: sourceRef(source.addSection || {}),
      removeSection: sourceRef(source.removeSection || {})
    };
  }

  function sceneById(projectIndex, id) {
    return ensureArray(projectIndex && projectIndex.scenes).find((scene) => String(scene && scene.id || '') === String(id || '')) || null;
  }

  function advisorControllerModel(projectIndex) {
    const api = advisorControllerModelApi();
    if (api && typeof api.buildAdvisorControllerModel === 'function') {
      return api.buildAdvisorControllerModel(projectIndex);
    }
    return {advisorControllers: []};
  }

  function advisorControllerModelApi() {
    if (global && global.ProjectMapAdvisorControllerModel) {
      return global.ProjectMapAdvisorControllerModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./advisor_controller_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function installPlanApi() {
    if (global && global.ProjectMapInstallPlan) {
      return global.ProjectMapInstallPlan;
    }
    if (typeof require === 'function') {
      return require('./install_plan.js');
    }
    throw new Error('ProjectMapInstallPlan is required before advisor_controller_draft.js');
  }

  function sourceRef(input) {
    const source = isObject(input) ? input : {};
    return {
      path: String(source.path || '').replace(/\\/g, '/'),
      line: numberOrNull(source.line || source.startLine),
      startLine: numberOrNull(source.startLine || source.line),
      endLine: numberOrNull(source.endLine || source.line || source.startLine),
      anchorText: String(source.anchorText || source.rawAnchorText || ''),
      rawAnchorText: String(source.rawAnchorText || source.anchorText || '')
    };
  }

  function splitList(value) {
    return String(value || '').split(',').map((item) => item.trim()).filter(Boolean);
  }

  function unique(values) {
    return Array.from(new Set(ensureArray(values).map(String).filter(Boolean)));
  }

  function safeId(value) {
    const text = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    return /^[a-z_]/.test(text) ? text : 'advisor_controller_' + (text || 'update');
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  const api = {DRAFT_VERSION, defaultDraft, draftForController, normalizeDraft, buildExportBundle, build: buildExportBundle};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapAdvisorControllerDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
