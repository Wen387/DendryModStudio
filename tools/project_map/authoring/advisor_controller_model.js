(function initProjectMapAdvisorControllerModel(global) {
  'use strict';

  const MODEL_VERSION = '0.1';

  function buildAdvisorControllerModel(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const advisorControllers = buildAdvisorControllers(index);
    return {
      schemaVersion: MODEL_VERSION,
      kind: 'advisor_controller_model',
      project: index.project || null,
      advisorControllers,
      controllerIds: advisorControllers.map((controller) => controller.id),
      metrics: {
        controllerCount: advisorControllers.length,
        rosterItemCount: advisorControllers.reduce((total, controller) => total + ensureArray(controller.roster).length, 0),
        partialCount: advisorControllers.filter((controller) => controller.confidence !== 'exact').length
      }
    };
  }

  function buildAdvisorControllers(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const explicit = ensureArray(index.semantic && index.semantic.advisorControllers);
    if (explicit.length) {
      return explicit.map((controller) => normalizeAdvisorController(controller)).filter((controller) => controller.id);
    }
    const scenes = ensureArray(index.scenes);
    const advisorCards = advisorPinnedCards(scenes);
    const advisorVariables = advisorCards.map((card) => advisorVariableFromViewIf(card.viewIf)).filter(Boolean);
    const variableSet = new Set(advisorVariables);
    const controllers = scenes
      .filter((scene) => isCardScene(scene) && !isPinnedScene(scene))
      .map((scene) => controllerFromScene(scene, scenes, advisorCards, variableSet))
      .filter((controller) => controller && controller.roster.length);
    return controllers.sort((left, right) => String(left.title || left.id).localeCompare(String(right.title || right.id)));
  }

  function controllerFromScene(scene, scenes, advisorCards, advisorVariables) {
    const effects = ensureArray(scene.effects);
    const advisorEffects = effects.filter((effect) => advisorVariables.has(String(effect && effect.variable || '')));
    if (advisorEffects.filter((effect) => String(effect.value || '') === '1').length < 1 ||
        advisorEffects.filter((effect) => String(effect.value || '') === '0').length < 1) {
      return null;
    }
    const sectionsById = new Map(ensureArray(scene.sections).map((section) => [String(section && section.id || ''), section]));
    const pinnedEntry = pinnedEntryForController(scene, scenes);
    const roster = advisorCards
      .map((card) => rosterItemForAdvisor(scene, card, advisorEffects, sectionsById))
      .filter((row) => row && row.activeVariable);
    const exactCount = roster.filter((row) => row.confidence === 'exact').length;
    const confidence = exactCount === roster.length && pinnedEntry && pinnedEntry.id ? 'exact' : exactCount ? 'partial' : 'manual';
    return {
      schemaVersion: MODEL_VERSION,
      kind: 'advisor_controller',
      confidence,
      id: String(scene.id || ''),
      key: laneKeyForControllerId(scene.id),
      title: String(scene.title || scene.id || 'Advisor controller'),
      controllerSceneId: String(scene.id || ''),
      path: normalizePath(scene.path || ''),
      pinnedEntry,
      roster,
      capacityGate: capacityGateForScene(scene),
      sourceAnchor: sourceRef(scene.sourceSpan || scene.topLevelSpan || {path: scene.path}),
      manualBoundary: confidence === 'exact' ? '' : 'Advisor flow contains missing or partial add/remove evidence; review before applying edits.'
    };
  }

  function rosterItemForAdvisor(controllerScene, advisorCard, advisorEffects, sectionsById) {
    const variable = advisorVariableFromViewIf(advisorCard.viewIf);
    if (!variable) {
      return null;
    }
    const addEffect = advisorEffects.find((effect) => String(effect.variable || '') === variable && String(effect.value || '') === '1') || null;
    const removeEffect = advisorEffects.find((effect) => String(effect.variable || '') === variable && String(effect.value || '') === '0') || null;
    const addSection = addEffect ? sectionsById.get(String(addEffect.sectionId || '')) || null : null;
    const removeSection = removeEffect ? sectionsById.get(String(removeEffect.sectionId || '')) || null : null;
    const categoryTags = ensureArray(advisorCard.tags).map(String).filter((tag) => tag && tag !== 'advisor');
    const confidence = addEffect && removeEffect && addSection && removeSection ? 'exact' : addEffect || removeEffect ? 'partial' : 'manual';
    return {
      advisorId: String(advisorCard.id || ''),
      title: String(advisorCard.title || advisorCard.id || ''),
      activeVariable: variable,
      categoryTags,
      pinnedCardSceneId: String(advisorCard.id || ''),
      addSectionId: String(addSection && addSection.id || addEffect && addEffect.sectionId || ''),
      removeSectionId: String(removeSection && removeSection.id || removeEffect && removeEffect.sectionId || ''),
      addLabel: String(addSection && addSection.title || ''),
      removeLabel: String(removeSection && removeSection.title || ''),
      confidence,
      sourceAnchors: {
        pinnedCard: sourceRef(advisorCard.sourceSpan || advisorCard.topLevelSpan || {path: advisorCard.path}),
        viewIf: sourceRef(advisorCard.metadata && advisorCard.metadata.viewIf || {}),
        tags: sourceRef(advisorCard.metadata && advisorCard.metadata.tags || {}),
        addEffect: sourceRef(addEffect && addEffect.source || {}),
        removeEffect: sourceRef(removeEffect && removeEffect.source || {}),
        addSection: sourceRef(addSection && addSection.sourceSpan || {}),
        removeSection: sourceRef(removeSection && removeSection.sourceSpan || {})
      },
      controllerSceneId: String(controllerScene.id || '')
    };
  }

  function advisorPinnedCards(scenes) {
    return ensureArray(scenes).filter((scene) => {
      if (!isPinnedScene(scene)) {
        return false;
      }
      const tags = ensureArray(scene.tags).map(String);
      return tags.includes('advisor') || Boolean(advisorVariableFromViewIf(scene.viewIf));
    }).sort((left, right) => String(left.title || left.id).localeCompare(String(right.title || right.id)));
  }

  function advisorVariableFromViewIf(viewIf) {
    const text = String(viewIf || '').trim();
    const match = text.match(/\b([A-Za-z_][A-Za-z0-9_]*_advisor)\s*(?:=|==|===)\s*1\b/);
    return match ? match[1] : '';
  }

  function pinnedEntryForController(controller, scenes) {
    const controllerId = String(controller && controller.id || '');
    const candidates = ensureArray(scenes).filter(isPinnedScene);
    const found = candidates.find((scene) => {
      return ensureArray(scene.routes && scene.routes.goTo).some((route) => String(route && route.id || route && route.raw || '').indexOf(controllerId) === 0);
    }) || null;
    return found ? {
      id: String(found.id || ''),
      title: String(found.title || found.id || ''),
      viewIf: String(found.viewIf || ''),
      targetSceneId: controllerId,
      source: sourceRef(found.sourceSpan || found.topLevelSpan || {path: found.path}),
      routeSource: sourceRef(found.metadata && found.metadata.goTo || {})
    } : null;
  }

  function capacityGateForScene(scene) {
    const gates = [];
    ensureArray(scene && scene.sections).forEach((section) => {
      const viewIf = String(section && (section.viewIf || section.chooseIf || section.condition) || '');
      if (viewIf.indexOf('n_advisors') >= 0) {
        gates.push({sectionId: String(section.id || ''), expression: viewIf, source: sourceRef(section.sourceSpan || {})});
      }
    });
    ensureArray(scene && scene.effects).forEach((effect) => {
      if (String(effect && effect.variable || '') === 'n_advisors') {
        gates.push({
          sectionId: String(effect.sectionId || ''),
          expression: String(effect.sourceExpression || effect.expression || ''),
          source: sourceRef(effect.source || {})
        });
      }
    });
    return {
      variable: gates.length ? 'n_advisors' : '',
      gates
    };
  }

  function normalizeAdvisorController(controller) {
    const value = isObject(controller) ? controller : {};
    const id = String(value.id || value.controllerSceneId || '');
    return {
      schemaVersion: MODEL_VERSION,
      kind: 'advisor_controller',
      confidence: normalizeConfidence(value.confidence),
      id,
      key: String(value.key || laneKeyForControllerId(id)),
      title: String(value.title || id || 'Advisor controller'),
      controllerSceneId: String(value.controllerSceneId || id),
      path: normalizePath(value.path || ''),
      pinnedEntry: isObject(value.pinnedEntry) ? Object.assign({}, value.pinnedEntry, {source: sourceRef(value.pinnedEntry.source || {})}) : null,
      roster: ensureArray(value.roster).map(normalizeRosterItem).filter((row) => row.advisorId),
      capacityGate: isObject(value.capacityGate) ? value.capacityGate : {variable: '', gates: []},
      sourceAnchor: sourceRef(value.sourceAnchor || value.source || {}),
      manualBoundary: String(value.manualBoundary || '')
    };
  }

  function normalizeRosterItem(item) {
    const value = isObject(item) ? item : {};
    return {
      advisorId: String(value.advisorId || value.id || ''),
      title: String(value.title || value.advisorId || value.id || ''),
      activeVariable: String(value.activeVariable || ''),
      categoryTags: ensureArray(value.categoryTags || value.tags).map(String).filter(Boolean),
      pinnedCardSceneId: String(value.pinnedCardSceneId || value.advisorId || value.id || ''),
      addSectionId: String(value.addSectionId || ''),
      removeSectionId: String(value.removeSectionId || ''),
      addLabel: String(value.addLabel || ''),
      removeLabel: String(value.removeLabel || ''),
      confidence: normalizeConfidence(value.confidence),
      sourceAnchors: isObject(value.sourceAnchors) ? value.sourceAnchors : {},
      controllerSceneId: String(value.controllerSceneId || '')
    };
  }

  function normalizeConfidence(value) {
    const text = String(value || '').trim();
    return text === 'exact' || text === 'partial' || text === 'manual' ? text : 'manual';
  }

  function isCardScene(scene) {
    const type = String(scene && scene.type || '');
    const flags = scene && scene.flags || {};
    return type === 'card' || type === 'pinned_card' || type === 'advisor' || flags.isCard || flags.isPinnedCard;
  }

  function isPinnedScene(scene) {
    const type = String(scene && scene.type || '');
    const flags = scene && scene.flags || {};
    return type === 'pinned_card' || type === 'advisor' || flags.isPinnedCard;
  }

  function laneKeyForController(controller) {
    return laneKeyForControllerId(controller && controller.id || controller);
  }

  function laneKeyForControllerId(id) {
    return 'advisor_controller:' + String(id || '').trim();
  }

  function idFromLaneKey(key) {
    return String(key || '').replace(/^advisor_controller:/, '');
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const path = normalizePath(value.path || value.sourcePath || '');
    if (!path) {
      return {};
    }
    const line = numberOrNull(value.line || value.startLine);
    return {
      path,
      line,
      startLine: numberOrNull(value.startLine || line),
      endLine: numberOrNull(value.endLine || line),
      anchorText: String(value.anchorText || ''),
      endAnchorText: String(value.endAnchorText || ''),
      rawAnchorText: String(value.rawAnchorText || ''),
      rawEndAnchorText: String(value.rawEndAnchorText || '')
    };
  }

  function normalizePath(value) {
    return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
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

  const api = {
    buildAdvisorControllerModel,
    buildAdvisorControllers,
    laneKeyForController,
    idFromLaneKey
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapAdvisorControllerModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
