(function initEventDraft(global) {
  'use strict';

  const EVENT_DRAFT_VERSION = '0.1';
  const EVENT_KIND = 'world_event';
  const EVENT_SHAPES = new Set(['choice_event', 'linear_choice_event', 'pure_event']);
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const EFFECT_OPS = new Set(['=', '+=', '-=']);
  const RESULT_MODES = new Set(['continue', 'native']);
  const RESERVED_PRIORITY = 4;
  const CONDITION_KEYWORDS = new Set([
    'and', 'or', 'not', 'if', 'else', 'true', 'false', 'null', 'undefined',
    'in', 'is', 'Q', 'Math'
  ]);
  const CONDITION_BUILTINS = new Set(['year', 'month', 'week', 'time']);

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function normalizeDraft(input) {
    const draft = isObject(input) ? clone(input) : {};
    const explicitOptions = Object.prototype.hasOwnProperty.call(draft, 'options');
    draft.schemaVersion = String(draft.schemaVersion || EVENT_DRAFT_VERSION);
    draft.kind = String(draft.kind || EVENT_KIND);
    draft.id = String(draft.id || '').trim();
    draft.eventShape = normalizeEventShape(draft.eventShape || draft.shape, explicitOptions ? draft.options : null);
    draft.title = String(draft.title || '').trim();
    draft.subtitle = String(draft.subtitle || '').trim();
    draft.heading = String(draft.heading || draft.title || '').trim();
    draft.tags = normalizeTags(draft.tags, draft.eventShape);
    draft.newPage = normalizeBoolean(draft.newPage, true);
    draft.rawViewIf = String(draft.rawViewIf || draft.viewIf || '').trim();
    draft.maxVisits = numberOrNull(draft.maxVisits);
    draft.frequency = numberOrNull(draft.frequency);
    draft.setJump = String(draft.setJump || draft.jumpTarget || '').trim();
    draft.calls = normalizeLineList(draft.calls || draft.callTargets || draft.callScenes);
    draft.rawRoutes = normalizeLineList(draft.rawRoutes || draft.routeClauses || draft.advancedRoutes);
    draft.useSeenFlag = normalizeBoolean(draft.useSeenFlag, choiceLikeEventShape(draft.eventShape));
    draft.seenFlag = String(draft.useSeenFlag ? (draft.seenFlag || (draft.id ? draft.id + '_seen' : '')) : (draft.seenFlag || '')).trim();
    draft.when = normalizeWhen(draft.when);
    draft.effectsOnTrigger = ensureArray(draft.effectsOnTrigger).map(normalizeEffect);
    draft.rawEffectsOnTrigger = concatRawLines(draft.rawEffectsOnTrigger, draft.rawTriggerEffects, draft.advancedEffectsOnTrigger, draft.rawOnArrival);
    draft.rawOnDisplay = normalizeLineList(draft.rawOnDisplay || draft.rawDisplayHook || draft.advancedOnDisplay);
    draft.rawOnDeparture = normalizeLineList(draft.rawOnDeparture || draft.rawDepartureHook || draft.advancedOnDeparture);
    draft.introParagraphs = normalizeTextList(draft.introParagraphs);
    draft.conditionalParagraphs = normalizeConditionalParagraphs(draft.conditionalParagraphs || draft.conditionalBody || draft.conditionalText);
    draft.assetRefs = ensureArray(draft.assetRefs).map(normalizeAssetRef);
    draft.assetPlacements = ensureArray(draft.assetPlacements).map(normalizeAssetPlacement).filter((asset) => asset.path);
    draft.assetInstallRequests = ensureArray(draft.assetInstallRequests).map(normalizeAssetInstallRequest);
    draft.anchorResolution = normalizeAnchorResolution(draft.anchorResolution);
    draft.options = ensureArray(draft.options).map(normalizeOption);
    const sections = ensureArray(draft.sections).map(normalizeSection).filter((section) => section.id);
    if (sections.length) {
      draft.sections = sections;
    } else {
      delete draft.sections;
    }
    distributeAssetPlacements(draft);
    return draft;
  }

  function normalizeEventShape(value, options) {
    const text = String(value || '').trim();
    if (EVENT_SHAPES.has(text)) {
      return text;
    }
    if (Array.isArray(options) && options.length === 0) {
      return 'pure_event';
    }
    if (Array.isArray(options) && options.length === 1) {
      return 'linear_choice_event';
    }
    return 'choice_event';
  }

  function choiceLikeEventShape(shape) {
    return shape === 'choice_event' || shape === 'linear_choice_event';
  }

  function normalizeWhen(when) {
    const value = isObject(when) ? when : {};
    return {
      year: numberOrNull(value.year),
      monthStart: numberOrNull(value.monthStart),
      monthEnd: numberOrNull(value.monthEnd),
      requires: String(value.requires || '').trim(),
      priority: numberOrNull(value.priority) ?? 0
    };
  }

  function normalizeOption(option, index) {
    const value = isObject(option) ? option : {};
    const id = String(value.id || ('option_' + (index + 1))).trim();
    const hasGotoAfter = Object.prototype.hasOwnProperty.call(value, 'gotoAfter') ||
      Object.prototype.hasOwnProperty.call(value, 'afterResultTarget');
    const fallbackGotoAfter = 'continue_' + id;
    const explicitGotoAfter = hasGotoAfter ? String(
      Object.prototype.hasOwnProperty.call(value, 'gotoAfter')
        ? value.gotoAfter
        : Object.prototype.hasOwnProperty.call(value, 'afterResultTarget')
          ? value.afterResultTarget
          : ''
    ).trim() : '';
    const resultMode = normalizeResultMode(value.resultMode || value.routeMode || value.continuationMode, hasGotoAfter ? explicitGotoAfter : fallbackGotoAfter);
    return {
      id,
      sourceAnchorId: String(value.sourceAnchorId || '').trim(),
      renderAnchorId: String(value.renderAnchorId || '').trim(),
      label: String(value.label || '').trim(),
      subtitle: String(value.subtitle || '').trim(),
      chooseIf: String(value.chooseIf || '').trim(),
      unavailableText: String(value.unavailableText || '').trim(),
      effects: ensureArray(value.effects).map(normalizeEffect),
      rawEffects: rawEffectLines(value.rawEffects || value.rawOptionEffects || value.advancedEffects),
      rawRoutes: normalizeLineList(value.rawRoutes || value.routeClauses || value.advancedRoutes),
      calls: normalizeLineList(value.calls || value.callTargets || value.callScenes),
      setJump: String(value.setJump || value.jumpTarget || '').trim(),
      narrativeParagraphs: normalizeTextList(value.narrativeParagraphs),
      assetPlacements: ensureArray(value.assetPlacements).map(normalizeAssetPlacement).filter((asset) => asset.path),
      variants: ensureArray(value.variants).map(normalizeVariant),
      resultMode,
      gotoAfter: resultMode === 'continue' ? (explicitGotoAfter || fallbackGotoAfter) : explicitGotoAfter,
      returnTarget: String(value.returnTarget || value.afterReturnTarget || (resultMode === 'continue' ? 'root' : '')).trim()
    };
  }

  function normalizeResultMode(value, gotoAfter) {
    const text = String(value || '').trim();
    if (RESULT_MODES.has(text)) {
      return text;
    }
    if (text === 'direct' || text === 'inline' || text === 'section') {
      return 'native';
    }
    if (text === 'continuation' || text === 'result_section') {
      return 'continue';
    }
    return String(gotoAfter || '').trim() ? 'continue' : 'native';
  }

  function normalizeEffect(effect) {
    const value = isObject(effect) ? effect : {};
    return {
      variable: String(value.variable || '').trim(),
      op: String(value.op || '').trim(),
      value: value.value,
      valueKind: String(value.valueKind || value.kind || '').trim(),
      condition: String(value.condition || '').trim(),
      hook: String(value.hook || '').trim()
    };
  }

  function rawEffectLines(value) {
    if (Array.isArray(value)) {
      return value.reduce((rows, item) => rows.concat(rawEffectLines(item)), []);
    }
    return String(value || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function concatRawLines() {
    return Array.prototype.slice.call(arguments).reduce((rows, value) => rows.concat(rawEffectLines(value)), []);
  }

  function normalizeLineList(value) {
    return rawEffectLines(value);
  }

  function normalizeTags(value, shape) {
    const fallback = shape === 'pure_event' ? ['event'] : ['event', 'world'];
    if (Array.isArray(value)) {
      const tags = value.map((item) => String(item || '').trim()).filter(Boolean);
      return tags.length ? unique(tags) : fallback;
    }
    if (typeof value === 'string' && value.trim()) {
      const tags = value.split(',').map((item) => item.trim()).filter(Boolean);
      return tags.length ? unique(tags) : fallback;
    }
    return fallback;
  }

  function normalizeBoolean(value, fallback) {
    if (value === undefined || value === null || value === '') {
      return Boolean(fallback);
    }
    if (typeof value === 'boolean') {
      return value;
    }
    return /^(1|true|yes|on)$/i.test(String(value).trim());
  }

  function unique(values) {
    const seen = new Set();
    const out = [];
    values.forEach((value) => {
      const text = String(value || '').trim();
      if (text && !seen.has(text)) {
        seen.add(text);
        out.push(text);
      }
    });
    return out;
  }

  function normalizeSection(section, index) {
    const value = isObject(section) ? section : {};
    const id = String(value.id || ('section_' + (index + 1))).trim();
    return {
      id,
      sourceAnchorId: String(value.sourceAnchorId || '').trim(),
      renderAnchorId: String(value.renderAnchorId || '').trim(),
      title: String(value.title || value.heading || '').trim(),
      condition: String(value.condition || value.viewIf || value.chooseIf || '').trim(),
      paragraphs: normalizeTextList(value.paragraphs || value.narrativeParagraphs || value.body || value.text),
      conditionalParagraphs: normalizeConditionalParagraphs(value.conditionalParagraphs || value.conditionalBody || value.conditionalText),
      assetPlacements: ensureArray(value.assetPlacements).map(normalizeAssetPlacement).filter((asset) => asset.path),
      effects: ensureArray(value.effects).map(normalizeEffect),
      rawEffects: rawEffectLines(value.rawEffects || value.rawSectionEffects || value.advancedEffects),
      rawRoutes: normalizeLineList(value.rawRoutes || value.routeClauses || value.advancedRoutes),
      calls: normalizeLineList(value.calls || value.callTargets || value.callScenes),
      setJump: String(value.setJump || value.jumpTarget || '').trim(),
      rawOnDisplay: normalizeLineList(value.rawOnDisplay || value.rawDisplayHook || value.advancedOnDisplay),
      rawOnDeparture: normalizeLineList(value.rawOnDeparture || value.rawDepartureHook || value.advancedOnDeparture),
      options: ensureArray(value.options).map(normalizeOption),
      exitTarget: String(value.exitTarget || value.returnTarget || 'root').trim()
    };
  }

  function normalizeVariant(variant) {
    const value = isObject(variant) ? variant : {};
    return {
      condition: String(value.condition || '').trim(),
      text: String(value.text || '').trim()
    };
  }

  function normalizeTextList(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
  }

  function normalizeConditionalParagraphs(value) {
    if (Array.isArray(value)) {
      return value.map(normalizeConditionalParagraph).filter((row) => row.raw || row.condition || row.text);
    }
    if (typeof value === 'string') {
      return value.split(/\n\s*\n/).map((item) => normalizeConditionalParagraph(item)).filter((row) => row.raw || row.condition || row.text);
    }
    return [];
  }

  function normalizeConditionalParagraph(value) {
    const row = isObject(value) ? value : {raw: value};
    const raw = String(row.raw || row.sourceText || '').trim();
    const parsed = parseSimpleConditionalBody(raw);
    return {
      condition: String(row.condition || row.if || parsed.condition || '').trim(),
      text: String(row.text || row.body || parsed.text || (!raw ? value : '') || '').trim(),
      raw,
      sourceRole: String(row.sourceRole || row.role || 'conditional_body').trim()
    };
  }

  function parseSimpleConditionalBody(raw) {
    const match = String(raw || '').trim().match(/^\[\?\s*if\s+([\s\S]*?)\s*:\s*([\s\S]*?)\s*\?\]$/);
    return match ? {condition: match[1].trim(), text: match[2].trim()} : {condition: '', text: ''};
  }

  function normalizeAnchorResolution(value) {
    const row = isObject(value) ? value : {};
    const rewrites = ensureArray(row.rewrites).map((rewrite) => {
      const item = isObject(rewrite) ? rewrite : {};
      return {
        source: String(item.source || item.from || '').trim(),
        render: String(item.render || item.to || '').trim(),
        owner: String(item.owner || '').trim(),
        kind: String(item.kind || '').trim()
      };
    }).filter((rewrite) => rewrite.source || rewrite.render);
    const unresolvedRoutes = ensureArray(row.unresolvedRoutes || row.unresolvedTargets).map((target) => {
      const item = isObject(target) ? target : {target};
      return {
        target: String(item.target || '').trim(),
        owner: String(item.owner || '').trim(),
        reason: String(item.reason || '').trim()
      };
    }).filter((target) => target.target || target.owner);
    return rewrites.length || unresolvedRoutes.length
      ? {version: String(row.version || '0.1'), rewrites, unresolvedRoutes}
      : null;
  }

  function normalizeAssetRef(asset) {
    const value = isObject(asset) ? asset : {path: asset};
    const path = String(value.path || value.src || value.url || '').trim();
    return {
      path,
      type: String(value.type || inferAssetType(path) || 'asset').trim(),
      label: String(value.label || value.name || fileName(path) || '').trim(),
      directive: String(value.directive || value.assetDirective || '').trim(),
      role: String(value.role || '').trim()
    };
  }

  function normalizeAssetPlacement(asset) {
    const ref = normalizeAssetRef(asset);
    const value = isObject(asset) ? asset : {};
    return Object.assign({}, ref, {
      placementId: String(value.placementId || value.id || '').trim(),
      placementKind: String(value.placementKind || value.kind || 'opening_visual').trim(),
      sectionId: String(value.sectionId || '').trim(),
      optionId: String(value.optionId || '').trim(),
      branchKind: String(value.branchKind || '').trim(),
      displayLocation: String(value.displayLocation || value.placementLabel || '').trim(),
      directive: String(value.directive || value.assetDirective || ref.directive || 'inline-image').trim() || 'inline-image'
    });
  }

  function distributeAssetPlacements(draft) {
    const placements = ensureArray(draft.assetPlacements);
    if (!placements.length) {
      return;
    }
    draft.options = ensureArray(draft.options).map((option) => {
      const optionId = String(option && option.id || '');
      const scoped = placements.filter((asset) => asset.optionId && asset.optionId === optionId);
      return scoped.length ? Object.assign({}, option, {
        assetPlacements: dedupeAssetPlacements(ensureArray(option.assetPlacements).concat(scoped))
      }) : option;
    });
    if (Array.isArray(draft.sections)) {
      draft.sections = ensureArray(draft.sections).map((section) => {
        const sectionId = String(section && section.id || '');
        const scoped = placements.filter((asset) => asset.sectionId && asset.sectionId === sectionId);
        return scoped.length ? Object.assign({}, section, {
          assetPlacements: dedupeAssetPlacements(ensureArray(section.assetPlacements).concat(scoped))
        }) : section;
      });
    }
    draft.assetPlacements = placements.filter((asset) => !asset.optionId && !asset.sectionId);
  }

  function dedupeAssetPlacements(placements) {
    const seen = new Set();
    return ensureArray(placements).filter((asset) => {
      const key = [asset && asset.path, asset && asset.optionId, asset && asset.sectionId, asset && asset.placementKind].join('|');
      if (!asset || !asset.path || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function normalizeAssetInstallRequest(input) {
    const value = isObject(input) ? input : {sourceName: input};
    const targetPath = String(value.targetPath || value.target || value.path || '').trim();
    return {
      sourceName: String(value.sourceName || value.fileName || value.name || fileName(value.sourcePath || '') || '').trim(),
      sourcePath: String(value.sourcePath || '').trim(),
      targetPath,
      type: String(value.type || inferAssetType(targetPath || value.sourceName || '') || 'asset').trim(),
      label: String(value.label || value.sourceName || fileName(targetPath) || '').trim(),
      directive: String(value.directive || value.assetDirective || '').trim(),
      role: String(value.role || '').trim()
    };
  }

  function inferAssetType(path) {
    const text = String(path || '').toLowerCase();
    if (/\.(png|jpe?g|gif|webp|svg)(?:[?#].*)?$/.test(text)) {
      return 'image';
    }
    if (/\.(mp3|ogg|wav|flac|m4a)(?:[?#].*)?$/.test(text)) {
      return 'audio';
    }
    return '';
  }

  function fileName(path) {
    const parts = String(path || '').split(/[\\/]/);
    return parts[parts.length - 1] || '';
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function installPlanApi() {
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      return require('./install_plan.js');
    }
    return global ? global.ProjectMapInstallPlan : null;
  }

  function assetContractApi() {
    if (global && global.ProjectMapAssetContractModel) {
      return global.ProjectMapAssetContractModel;
    }
    if (typeof require === 'function') {
      try { return require('./asset_contract_model.js'); } catch (_err) { /* optional */ }
    }
    return null;
  }

  function validateDraft(input, projectIndex) {
    const draft = normalizeDraft(input);
    const diagnostics = [];
    const variables = variableSet(projectIndex);
    const scenes = sceneSet(projectIndex);

    if (draft.schemaVersion !== EVENT_DRAFT_VERSION) {
      diag(diagnostics, 'error', 'event_draft.schema_version', 'EventDraft schemaVersion must be "0.1".');
    }
    if (draft.kind !== EVENT_KIND) {
      diag(diagnostics, 'error', 'event_draft.kind', 'Only kind "world_event" is supported in v0.4.');
    }
    if (!EVENT_SHAPES.has(draft.eventShape)) {
      diag(diagnostics, 'error', 'event_draft.event_shape', 'eventShape must be "choice_event", "linear_choice_event", or "pure_event".');
    }
    if (!ID_RE.test(draft.id)) {
      diag(diagnostics, 'error', 'event_draft.id', 'Event id must match /^[A-Za-z_][A-Za-z0-9_]*$/.');
    }
    if (draft.id && scenes.has(draft.id)) {
      diag(diagnostics, 'error', 'event_draft.duplicate_scene_id', 'Scene id already exists in the loaded ProjectIndex: ' + draft.id);
    }
    if (draft.useSeenFlag && !ID_RE.test(draft.seenFlag)) {
      diag(diagnostics, 'error', 'event_draft.seen_flag', 'seenFlag must be a valid Q variable name.');
    }
    if (draft.maxVisits !== null && (!Number.isInteger(draft.maxVisits) || draft.maxVisits < 1)) {
      diag(diagnostics, 'error', 'event_draft.max_visits', 'max-visits must be a positive integer.');
    }
    if (draft.frequency !== null && (!Number.isInteger(draft.frequency) || draft.frequency < 1)) {
      diag(diagnostics, 'error', 'event_draft.frequency', 'frequency must be a positive integer.');
    }
    if (draft.setJump) {
      checkRouteTarget(draft.setJump, diagnostics, 'event_draft.set_jump');
    }
    if (!draft.title) {
      diag(diagnostics, 'error', 'event_draft.title', 'Title is required.');
    }
    if (!draft.heading) {
      diag(diagnostics, 'error', 'event_draft.heading', 'Heading is required.');
    }
    validateWhen(draft.when, diagnostics);
    checkConditionText(draft.when.requires, diagnostics, 'event_draft.requires', variables, draft.seenFlag);
    checkConditionText(draft.rawViewIf, diagnostics, 'event_draft.view_if', variables, draft.seenFlag);
    validateConditionalParagraphs(draft.conditionalParagraphs, diagnostics, variables, draft.seenFlag, 'event_draft.conditional_body');
    validateAnchorResolution(draft.anchorResolution, diagnostics);

    const optionIds = new Set();
    const renderedAnchors = new Set(draft.id ? [draft.id] : []);
    const sectionIds = new Set(ensureArray(draft.sections).map((section) => String(section && section.id || '')).filter(Boolean));
    const linkTargetIds = optionLinkTargetIds(sectionIds, scenes);
    if (draft.eventShape === 'choice_event' && draft.options.length < 2) {
      diag(diagnostics, 'error', 'event_draft.choice_count', 'World event drafts must contain at least 2 choices.');
    }
    if (draft.eventShape === 'linear_choice_event' && draft.options.length !== 1) {
      diag(diagnostics, 'error', 'event_draft.linear_choice_count', 'Linear choice event drafts must contain exactly 1 root choice.');
    }
    if (draft.eventShape === 'pure_event' && draft.options.length) {
      diag(diagnostics, 'error', 'event_draft.pure_event_options', 'Pure text event drafts must not contain root player choices; switch to choice_event first.');
    }
    draft.options.forEach((option, index) => {
      if (!ID_RE.test(option.id)) {
        diag(diagnostics, 'error', 'event_draft.option_id', 'Option ' + (index + 1) + ' id must be a valid anchor id.');
      }
      if (optionIds.has(option.id)) {
        diag(diagnostics, 'error', 'event_draft.duplicate_option_id', 'Duplicate option id: ' + option.id);
      }
      optionIds.add(option.id);
      const linkedTarget = optionLinksExistingTarget(option, linkTargetIds);
      if (!linkedTarget) {
        recordRenderedAnchor(renderedAnchors, option.id, diagnostics);
      }
      if (!option.label) {
        diag(diagnostics, 'error', 'event_draft.option_label', 'Option ' + option.id + ' needs a label.');
      }
      checkConditionText(option.chooseIf, diagnostics, 'event_draft.choose_if', variables, draft.seenFlag);
      if (option.unavailableText && !option.chooseIf) {
        diag(diagnostics, 'warning', 'event_draft.unavailable_without_choose_if', 'unavailableText only matters when chooseIf is set: ' + option.id);
      }
      if (!linkedTarget && option.resultMode !== 'native') {
        checkGotoAfter(option.gotoAfter, diagnostics);
        recordRenderedAnchor(renderedAnchors, option.gotoAfter, diagnostics);
      }
      if (!linkedTarget && option.returnTarget) {
        checkRouteTarget(option.returnTarget, diagnostics, 'event_draft.return_target');
      }
      if (option.setJump) {
        checkRouteTarget(option.setJump, diagnostics, 'event_draft.set_jump');
      }
      option.effects.forEach((effect) => validateEffect(effect, variables, draft.seenFlag, diagnostics));
      option.variants.forEach((variant) => {
        checkConditionText(variant.condition, diagnostics, 'event_draft.variant_condition', variables, draft.seenFlag);
        checkFakeInlineOption(variant.text, diagnostics);
      });
      option.narrativeParagraphs.forEach((paragraph) => checkFakeInlineOption(paragraph, diagnostics));
    });
    draft.effectsOnTrigger.forEach((effect) => validateEffect(effect, variables, draft.seenFlag, diagnostics));
    draft.introParagraphs.forEach((paragraph) => checkFakeInlineOption(paragraph, diagnostics));
    ensureArray(draft.sections).forEach((section) => validateSection(section, variables, draft.seenFlag, renderedAnchors, linkTargetIds, diagnostics));
    validateResolvedRouteTargets(draft, renderedAnchors, scenes, diagnostics);

    return {draft, diagnostics, ok: diagnostics.every((item) => item.severity !== 'error')};
  }

  function validateSection(section, variables, seenFlag, renderedAnchors, linkTargetIds, diagnostics) {
    if (!ID_RE.test(section.id)) {
      diag(diagnostics, 'error', 'event_draft.section_id', 'Section id must be a valid anchor id.');
    }
    recordRenderedAnchor(renderedAnchors, section.id, diagnostics);
    checkConditionText(section.condition, diagnostics, 'event_draft.section_condition', variables, seenFlag);
    validateConditionalParagraphs(section.conditionalParagraphs, diagnostics, variables, seenFlag, 'event_draft.section_conditional_body');
    checkRouteTarget(section.exitTarget, diagnostics, 'event_draft.section_exit_target');
    section.effects.forEach((effect) => validateEffect(effect, variables, '', diagnostics));
    if (section.setJump) {
      checkRouteTarget(section.setJump, diagnostics, 'event_draft.set_jump');
    }
    section.paragraphs.forEach((paragraph) => checkFakeInlineOption(paragraph, diagnostics));
    const optionIds = new Set();
    section.options.forEach((option, index) => {
      if (!ID_RE.test(option.id)) {
        diag(diagnostics, 'error', 'event_draft.section_option_id', 'Section option ' + (index + 1) + ' id must be a valid anchor id.');
      }
      if (optionIds.has(option.id)) {
        diag(diagnostics, 'error', 'event_draft.duplicate_option_id', 'Duplicate section option id: ' + option.id);
      }
      optionIds.add(option.id);
      const linkedTarget = optionLinksExistingTarget(option, linkTargetIds);
      if (!linkedTarget) {
        recordRenderedAnchor(renderedAnchors, option.id, diagnostics);
      }
      if (!option.label) {
        diag(diagnostics, 'error', 'event_draft.section_option_label', 'Section option ' + option.id + ' needs a label.');
      }
      checkConditionText(option.chooseIf, diagnostics, 'event_draft.choose_if', variables, seenFlag);
      if (option.unavailableText && !option.chooseIf) {
        diag(diagnostics, 'warning', 'event_draft.unavailable_without_choose_if', 'unavailableText only matters when chooseIf is set: ' + option.id);
      }
      if (!linkedTarget && option.resultMode !== 'native') {
        checkGotoAfter(option.gotoAfter, diagnostics);
        recordRenderedAnchor(renderedAnchors, option.gotoAfter, diagnostics);
      }
      if (!linkedTarget && option.returnTarget) {
        checkRouteTarget(option.returnTarget, diagnostics, 'event_draft.return_target');
      }
      option.effects.forEach((effect) => validateEffect(effect, variables, '', diagnostics));
      option.variants.forEach((variant) => {
        checkConditionText(variant.condition, diagnostics, 'event_draft.variant_condition', variables, seenFlag);
        checkFakeInlineOption(variant.text, diagnostics);
      });
      option.narrativeParagraphs.forEach((paragraph) => checkFakeInlineOption(paragraph, diagnostics));
    });
  }

  function validateWhen(when, diagnostics) {
    if (!Number.isInteger(when.year) || when.year < 1) {
      diag(diagnostics, 'error', 'event_draft.year', 'Year must be a positive integer.');
    }
    if (!Number.isInteger(when.monthStart) || when.monthStart < 1 || when.monthStart > 12) {
      diag(diagnostics, 'error', 'event_draft.month_start', 'monthStart must be an integer from 1 to 12.');
    }
    if (!Number.isInteger(when.monthEnd) || when.monthEnd < 1 || when.monthEnd > 12) {
      diag(diagnostics, 'error', 'event_draft.month_end', 'monthEnd must be an integer from 1 to 12.');
    }
    if (Number.isInteger(when.monthStart) && Number.isInteger(when.monthEnd) && when.monthStart > when.monthEnd) {
      diag(diagnostics, 'error', 'event_draft.invalid_month_range', 'monthStart must be <= monthEnd.');
    }
    if (!Number.isInteger(when.priority)) {
      diag(diagnostics, 'error', 'event_draft.priority', 'Priority must be an integer.');
    } else if (when.priority === RESERVED_PRIORITY) {
      diag(diagnostics, 'warning', 'event_draft.reserved_priority', 'Priority 4 is reserved; choose another tier.');
    }
  }

  function validateEffect(effect, variables, seenFlag, diagnostics) {
    if (!ID_RE.test(effect.variable)) {
      diag(diagnostics, 'error', 'event_draft.effect_variable', 'Effect variable must be a valid Q variable name.');
      return;
    }
    if (!EFFECT_OPS.has(effect.op)) {
      diag(diagnostics, 'error', 'event_draft.effect_op', 'Effect op must be one of =, +=, -=.');
    }
    if (variables && effect.variable !== seenFlag && !variables.has(effect.variable)) {
      diag(diagnostics, 'warning', 'event_draft.missing_variable', 'Effect variable is not in the loaded ProjectIndex; Studio will prepare an init operation: ' + effect.variable);
    }
    if (effect.op !== '=' && typeof effect.value !== 'number' && !isNumericLiteral(effect.value) && !isSafeNumericExpression(effect.value)) {
      diag(diagnostics, 'error', 'event_draft.effect_value', 'Delta effect value must be numeric for ' + effect.variable + '.');
    }
  }

  function validateConditionalParagraphs(rows, diagnostics, variables, seenFlag, code) {
    ensureArray(rows).forEach((row, index) => {
      const raw = String(row && row.raw || '').trim();
      const condition = String(row && row.condition || '').trim();
      const text = String(row && row.text || '').trim();
      if (!raw && (!condition || !text)) {
        diag(diagnostics, 'error', code || 'event_draft.conditional_body', 'Conditional body row ' + (index + 1) + ' needs raw text or both condition and text.');
      }
      if (!raw) {
        checkConditionText(condition, diagnostics, code || 'event_draft.conditional_body', variables, seenFlag);
      }
      if (text) {
        checkFakeInlineOption(text, diagnostics);
      }
    });
  }

  function validateAnchorResolution(anchorResolution, diagnostics) {
    ensureArray(anchorResolution && anchorResolution.unresolvedRoutes).forEach((item) => {
      const target = String(item && item.target || '').trim();
      const owner = String(item && item.owner || '').trim();
      diag(diagnostics, 'error', 'event_draft.unresolved_anchor_mapping', 'Anchor mapping could not safely resolve route target "' + target + '"' + (owner ? ' from ' + owner : '') + '.');
    });
  }

  function isNumericLiteral(value) {
    return /^-?\d+(?:\.\d+)?$/.test(String(value === undefined || value === null ? '' : value).trim());
  }

  function isSafeNumericExpression(value) {
    const text = String(value === undefined || value === null ? '' : value).trim();
    return Boolean(text && /^[A-Za-z0-9_().+\-*/\s]+$/.test(text) && /[A-Za-z_()+\-*/]/.test(text));
  }

  function checkConditionText(text, diagnostics, code, variables, seenFlag) {
    if (!text) {
      return;
    }
    if (/(?:^|;)\s*go-to\s*:|;\s*[A-Za-z_][A-Za-z0-9_]*\s+if\s+/i.test(text)) {
      diag(diagnostics, 'warning', 'event_draft.conditional_goto', 'Conditional go-to syntax is not supported in EventDraft conditions.');
    }
    if (/['"][^'"\n]*[\u4e00-\u9fff][^'"\n]*['"]/.test(text)) {
      diag(diagnostics, 'error', code || 'event_draft.chinese_string_comparison', 'Dendry conditionals must not compare Chinese strings.');
    }
    unknownConditionVariables(text, variables, seenFlag).forEach((name) => {
      diag(diagnostics, 'warning', 'event_draft.unknown_condition_variable', 'Condition variable is not in the loaded ProjectIndex: ' + name);
    });
  }

  function unknownConditionVariables(text, variables, seenFlag) {
    if (!variables) {
      return [];
    }
    const unknown = new Set();
    const stripped = String(text || '').replace(/(['"])(?:\\.|(?!\1)[\s\S])*\1/g, ' ');
    const re = /(?:^|[^.A-Za-z0-9_])(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\b/g;
    let match;
    while ((match = re.exec(stripped))) {
      const name = match[1];
      if (
        !name ||
        name === seenFlag ||
        CONDITION_KEYWORDS.has(name) ||
        CONDITION_BUILTINS.has(name) ||
        variables.has(name)
      ) {
        continue;
      }
      unknown.add(name);
    }
    return Array.from(unknown).sort();
  }

  function checkGotoAfter(value, diagnostics) {
    const text = String(value || '');
    if (!ID_RE.test(text)) {
      diag(diagnostics, 'error', 'event_draft.goto_after', 'Option gotoAfter must be a valid anchor id.');
    }
    if (/\s+if\s+|;/.test(text)) {
      diag(diagnostics, 'warning', 'event_draft.conditional_goto', 'Option gotoAfter must be a plain anchor id in v0.4.');
    }
  }

  function checkRouteTarget(value, diagnostics, code) {
    const text = String(value || 'root').trim();
    if (!ID_RE.test(text)) {
      diag(diagnostics, 'error', code || 'event_draft.route_target', 'Route target must be root or a valid anchor id.');
    }
    if (/\s+if\s+|;/.test(text)) {
      diag(diagnostics, 'warning', 'event_draft.conditional_goto', 'Route target must be a plain anchor id in EventDraft.');
    }
  }

  function validateResolvedRouteTargets(draft, renderedAnchors, scenes, diagnostics) {
    const targets = rawRouteTargets(draft.rawRoutes, 'event raw route');
    ensureArray(draft.options).forEach((option) => {
      rawRouteTargets(option.rawRoutes, 'option raw route ' + option.id).forEach((item) => targets.push(item));
      if (option.returnTarget) {
        targets.push({target: option.returnTarget, owner: 'option ' + option.id});
      }
    });
    ensureArray(draft.sections).forEach((section) => {
      targets.push({target: section.exitTarget, owner: 'section ' + section.id});
      rawRouteTargets(section.rawRoutes, 'section raw route ' + section.id).forEach((item) => targets.push(item));
      ensureArray(section.options).forEach((option) => {
        rawRouteTargets(option.rawRoutes, 'section option raw route ' + option.id).forEach((item) => targets.push(item));
        if (option.returnTarget) {
          targets.push({target: option.returnTarget, owner: 'section option ' + option.id});
        }
      });
    });
    targets.forEach((item) => {
      const target = String(item.target || 'root').trim();
      if (!target || target === 'root' || !ID_RE.test(target)) {
        return;
      }
      if (!renderedAnchors.has(target) && !(scenes && scenes.has(target))) {
        diag(diagnostics, 'error', 'event_draft.missing_route_target', 'Route target "' + target + '" from ' + item.owner + ' does not resolve to this event.');
      }
    });
  }

  function rawRouteTargets(rawRoutes, owner) {
    const targets = [];
    ensureArray(rawRoutes).forEach((line) => {
      const target = staticRawRouteTarget(line);
      if (target) {
        targets.push({target, owner});
      }
    });
    return targets;
  }

  function staticRawRouteTarget(line) {
    const match = String(line || '').trim().match(/^(?:go-to|check-success-go-to|check-failure-go-to)\s*:\s*[@#]?([A-Za-z_][A-Za-z0-9_.-]*)\b/i);
    if (!match) {
      return '';
    }
    const target = String(match[1] || '').trim();
    return ID_RE.test(target) ? target : '';
  }

  function recordRenderedAnchor(anchors, anchorId, diagnostics) {
    if (!anchorId) {
      return;
    }
    if (anchors.has(anchorId)) {
      diag(diagnostics, 'error', 'event_draft.duplicate_anchor', 'Rendered anchor would be duplicated: ' + anchorId);
    }
    anchors.add(anchorId);
  }

  function optionLinkTargetIds(sectionIds, sceneIds) {
    const out = new Set();
    if (sectionIds && typeof sectionIds.forEach === 'function') {
      sectionIds.forEach((id) => out.add(id));
    }
    if (sceneIds && typeof sceneIds.forEach === 'function') {
      sceneIds.forEach((id) => out.add(id));
    }
    return out;
  }

  function optionLinksExistingTarget(option, targetIds) {
    return Boolean(
      option &&
      targetIds &&
      targetIds.has(option.id) &&
      !optionHasInlineResultContent(option)
    );
  }

  function optionHasInlineResultContent(option) {
    const value = isObject(option) ? option : {};
    return Boolean(
      String(value.title || '').trim() ||
      String(value.subtitle || '').trim() ||
      String(value.chooseIf || '').trim() ||
      String(value.unavailableText || '').trim() ||
      String(value.setJump || '').trim() ||
      ensureArray(value.effects).length ||
      ensureArray(value.rawEffects).length ||
      ensureArray(value.rawRoutes).length ||
      ensureArray(value.calls).length ||
      ensureArray(value.narrativeParagraphs).length ||
      ensureArray(value.assetPlacements).length ||
      ensureArray(value.variants).length
    );
  }

  function checkFakeInlineOption(text, diagnostics) {
    if (/\[\?\s*if[\s\S]*-\s*@/.test(String(text || ''))) {
      diag(diagnostics, 'error', 'event_draft.fake_inline_option', 'Inline conditional options are not valid Dendry authoring.');
    }
  }

  function variableSet(projectIndex) {
    if (!projectIndex || !Array.isArray(projectIndex.variables)) {
      return null;
    }
    return new Set(projectIndex.variables.map((variable) => String(variable.name || '')).filter(Boolean));
  }

  function sceneSet(projectIndex) {
    if (!projectIndex || !Array.isArray(projectIndex.scenes)) {
      return new Set();
    }
    return new Set(projectIndex.scenes.map((scene) => String(scene.id || '')).filter(Boolean));
  }

  function diag(diagnostics, severity, code, message) {
    diagnostics.push({severity, code, message, confidence: 'exact'});
  }

  function renderSceneDry(input, projectIndex, options) {
    const result = validateDraft(input, projectIndex);
    const draft = result.draft;
    const continueLabel = defaultContinueLabel(options);
    const lines = [];
    lines.push('title: ' + draft.title);
    if (draft.subtitle) {
      lines.push('subtitle: ' + draft.subtitle);
    }
    if (draft.newPage) {
      lines.push('new-page: true');
    }
    if (choiceLikeEventShape(draft.eventShape)) {
      lines.push('is-card: true');
    }
    if (ensureArray(draft.tags).length) {
      lines.push('tags: ' + ensureArray(draft.tags).join(', '));
    }
    appendAssetReferenceLines(lines, draft.assetRefs, 'event');
    const viewIf = renderViewIf(draft);
    if (viewIf) {
      lines.push('view-if: ' + viewIf);
    }
    lines.push('priority: ' + draft.when.priority);
    if (draft.maxVisits !== null || draft.useSeenFlag) {
      lines.push('max-visits: ' + (draft.maxVisits !== null ? draft.maxVisits : 1));
    }
    if (draft.frequency !== null) {
      lines.push('frequency: ' + draft.frequency);
    }
    if (draft.setJump) {
      lines.push('set-jump: ' + draft.setJump);
    }
    appendCallLines(lines, draft.calls);
    appendRawDirectiveLines(lines, draft.rawRoutes);
    if (draft.useSeenFlag || draft.effectsOnTrigger.length || draft.rawEffectsOnTrigger.length) {
      lines.push('on-arrival: {!');
      if (draft.useSeenFlag) {
        lines.push('Q.' + draft.seenFlag + ' = 1;');
      }
      draft.effectsOnTrigger.forEach((effect) => lines.push(renderEffect(effect)));
      draft.rawEffectsOnTrigger.forEach((line) => lines.push(renderRawEffect(line)));
      lines.push('!}');
    }
    appendRawHookBlock(lines, 'on-display', draft.rawOnDisplay);
    appendRawHookBlock(lines, 'on-departure', draft.rawOnDeparture);
    lines.push('');
    lines.push('= ' + draft.heading);
    lines.push('');
    appendParagraphs(lines, draft.introParagraphs);
    appendConditionalParagraphs(lines, draft.conditionalParagraphs);
    appendAssetPlacementLines(lines, draft.assetPlacements, {placementKind: 'opening_visual'});
    const sectionIds = new Set(ensureArray(draft.sections).map((section) => String(section && section.id || '')).filter(Boolean));
    const linkTargetIds = optionLinkTargetIds(sectionIds, sceneSet(projectIndex));
    if (draft.options.length) {
      draft.options.forEach((option) => {
        lines.push('- @' + option.id + ': ' + option.label);
      });
      lines.push('');
      draft.options.forEach((option, index) => {
        if (index > 0) {
          lines.push('');
        }
        if (!optionLinksExistingTarget(option, linkTargetIds)) {
          appendOption(lines, option, continueLabel, draft);
        }
      });
    }
    ensureArray(draft.sections).forEach((section) => appendSection(lines, section, continueLabel, draft, linkTargetIds));
    return lines.join('\n') + '\n';
  }

  function appendAssetReferenceLines(lines, assetRefs, target) {
    ensureArray(assetRefs).forEach((asset) => {
      const directive = assetDirectiveForRef(asset, target);
      const path = String(asset && asset.path || '').trim();
      if (directive && path) {
        lines.push(directive + ': ' + path);
      }
    });
  }

  function assetDirectiveForRef(asset, target) {
    const value = isObject(asset) ? asset : {};
    const explicit = normalizeAssetDirective(value.directive || value.assetDirective);
    if (explicit) {
      return explicit;
    }
    const role = String(value.role || '').trim();
    if (role === 'event_portrait') {
      return 'face-image';
    }
    if (role === 'event_illustration' || role === 'event_background') {
      return 'set-bg';
    }
    if (role === 'event_audio' || String(value.type || '').trim() === 'audio') {
      return 'audio';
    }
    return target === 'event' && String(value.type || '').trim() === 'image' ? 'set-bg' : '';
  }

  function normalizeAssetDirective(value) {
    const api = assetContractApi();
    if (api && typeof api.normalizeAssetDirective === 'function') {
      return api.normalizeAssetDirective(value);
    }
    const text = String(value || '').trim().toLowerCase();
    return text === 'face-image' || text === 'card-image' || text === 'set-bg' || text === 'set-music' || text === 'audio' ? text : '';
  }

  function defaultContinueLabel(options) {
    const value = options && (options.defaultContinueLabel || options.continueLabel);
    const label = String(value || 'Continue').replace(/\s+/g, ' ').trim();
    return label || 'Continue';
  }

  function renderViewIf(draft) {
    if (draft.rawViewIf) {
      const parts = [draft.rawViewIf];
      if (draft.useSeenFlag && draft.seenFlag) {
        parts.push(draft.seenFlag + ' = 0');
      }
      return parts.join(' and ');
    }
    const parts = [];
    if (Number.isInteger(draft.when.year)) {
      parts.push('year = ' + draft.when.year);
    }
    if (Number.isInteger(draft.when.monthStart)) {
      parts.push('month >= ' + draft.when.monthStart);
    }
    if (Number.isInteger(draft.when.monthEnd)) {
      parts.push('month <= ' + draft.when.monthEnd);
    }
    if (draft.useSeenFlag && draft.seenFlag) {
      parts.push(draft.seenFlag + ' = 0');
    }
    if (draft.when.requires) {
      parts.push(draft.when.requires);
    }
    return parts.join(' and ');
  }

  function appendOption(lines, option, continueLabel, draft) {
    const nativeResult = option.resultMode === 'native';
    lines.push('@' + option.id);
    if (option.label) {
      lines.push('title: ' + option.label);
    }
    if (option.subtitle) {
      lines.push('subtitle: ' + option.subtitle);
    }
    if (option.chooseIf) {
      lines.push('choose-if: ' + option.chooseIf);
    }
    if (option.unavailableText) {
      lines.push('unavailable-subtitle: ' + option.unavailableText);
    }
    if (option.effects.length || option.rawEffects.length) {
      lines.push('on-arrival: {!');
      option.effects.forEach((effect) => lines.push(renderEffect(effect)));
      option.rawEffects.forEach((line) => lines.push(renderRawEffect(line)));
      lines.push('!}');
    }
    if (option.setJump) {
      lines.push('set-jump: ' + option.setJump);
    }
    appendCallLines(lines, option.calls);
    appendRawDirectiveLines(lines, option.rawRoutes);
    if (nativeResult && option.returnTarget) {
      lines.push('go-to: ' + renderRouteTarget(draft, option.returnTarget));
    }
    lines.push('');
    if (!nativeResult && option.label) {
      lines.push('= ' + option.label);
      lines.push('');
    }
    appendParagraphs(lines, option.narrativeParagraphs);
    appendAssetPlacementLines(lines, option.assetPlacements, {optionId: option.id});
    option.variants.forEach((variant) => {
      lines.push('[? if ' + variant.condition + ' : ' + variant.text + ' ?]');
      lines.push('');
    });
    if (nativeResult) {
      return;
    }
    lines.push('- @' + option.gotoAfter + ': ' + continueLabel);
    lines.push('');
    lines.push('@' + option.gotoAfter);
    lines.push('go-to: ' + renderRouteTarget(draft, option.returnTarget || 'root'));
  }

  function appendSection(lines, section, continueLabel, draft, linkTargetIds) {
    lines.push('');
    lines.push('@' + section.id);
    if (section.title) {
      lines.push('title: ' + section.title);
    }
    if (section.condition) {
      lines.push('view-if: ' + section.condition);
    }
    if (section.effects.length || section.rawEffects.length) {
      lines.push('on-arrival: {!');
      section.effects.forEach((effect) => lines.push(renderEffect(effect)));
      section.rawEffects.forEach((line) => lines.push(renderRawEffect(line)));
      lines.push('!}');
    }
    appendRawHookBlock(lines, 'on-display', section.rawOnDisplay);
    appendRawHookBlock(lines, 'on-departure', section.rawOnDeparture);
    if (section.setJump) {
      lines.push('set-jump: ' + section.setJump);
    }
    appendCallLines(lines, section.calls);
    appendRawDirectiveLines(lines, section.rawRoutes);
    lines.push('');
    if (section.title) {
      lines.push('= ' + section.title);
      lines.push('');
    }
    appendParagraphs(lines, section.paragraphs);
    appendConditionalParagraphs(lines, section.conditionalParagraphs);
    appendAssetPlacementLines(lines, section.assetPlacements, {sectionId: section.id});
    section.options.forEach((option) => {
      lines.push('- @' + option.id + ': ' + option.label);
    });
    if (section.options.length) {
      lines.push('');
    }
    section.options.forEach((option, index) => {
      if (index > 0) {
        lines.push('');
      }
      if (!optionLinksExistingTarget(option, linkTargetIds)) {
        appendOption(lines, option, continueLabel, draft);
      }
    });
    if (!section.options.length && section.exitTarget) {
      lines.push('go-to: ' + renderRouteTarget(draft, section.exitTarget));
    }
  }

  function renderRouteTarget(draft, target) {
    const text = String(target || '').trim();
    if (text === 'root') {
      return String(draft && draft.id || 'root').trim() || 'root';
    }
    return text || 'root';
  }

  function appendCallLines(lines, calls) {
    ensureArray(calls).forEach((target) => {
      const text = String(target || '').trim();
      if (text) {
        lines.push('call: ' + text);
      }
    });
  }

  function appendRawDirectiveLines(lines, rawLines) {
    ensureArray(rawLines).forEach((line) => {
      const text = String(line || '').trim();
      if (text) {
        lines.push(text);
      }
    });
  }

  function appendRawHookBlock(lines, directive, rawLines) {
    const rows = ensureArray(rawLines).map((line) => String(line || '').trim()).filter(Boolean);
    if (!rows.length) {
      return;
    }
    lines.push(directive + ': {!');
    rows.forEach((line) => lines.push(renderRawEffect(line)));
    lines.push('!}');
  }

  function appendParagraphs(lines, paragraphs) {
    ensureArray(paragraphs).forEach((paragraph) => {
      lines.push(paragraph);
      lines.push('');
    });
  }

  function appendConditionalParagraphs(lines, rows) {
    ensureArray(rows).forEach((row) => {
      const line = renderConditionalParagraph(row);
      if (line) {
        lines.push(line);
        lines.push('');
      }
    });
  }

  function renderConditionalParagraph(row) {
    const value = normalizeConditionalParagraph(row);
    if (value.raw) {
      return value.raw;
    }
    if (value.condition && value.text) {
      return '[? if ' + value.condition + ' : ' + value.text + ' ?]';
    }
    return value.text || '';
  }

  function appendAssetPlacementLines(lines, placements, scope) {
    ensureArray(placements).forEach((asset) => {
      const line = assetPlacementLine(asset, scope);
      if (line) {
        lines.push(line);
        lines.push('');
      }
    });
  }

  function assetPlacementLine(asset, scope) {
    const item = normalizeAssetPlacement(asset || {});
    if (!item.path || item.type === 'audio') {
      return '';
    }
    const directive = assetPlacementDirective(item, scope);
    return directive ? directive + ': ' + item.path : '';
  }

  function assetPlacementDirective(asset, scope) {
    const explicit = normalizeAssetDirective(asset && (asset.directive || asset.assetDirective));
    if (explicit) {
      return explicit;
    }
    const raw = String(asset && (asset.directive || asset.assetDirective) || '').trim().toLowerCase();
    if (raw === 'inline-image' || raw === 'inline-asset') {
      return 'face-image';
    }
    const scoped = scope && (scope.optionId || scope.sectionId);
    if (!scoped && String(asset && asset.role || '').trim() === 'event_background') {
      return 'set-bg';
    }
    return 'face-image';
  }

  function renderEffect(effect) {
    return 'Q.' + effect.variable + ' ' + effect.op + ' ' + renderEffectValue(effect.value) + (effect.condition ? ' if ' + effect.condition : '') + ';';
  }

  function renderRawEffect(line) {
    return String(line || '').trim();
  }

  function renderEffectValue(value) {
    if (typeof value === 'number') {
      return String(value);
    }
    if (typeof value === 'boolean') {
      return value ? '1' : '0';
    }
    if (value === null || value === undefined || value === '') {
      return '0';
    }
    if (/^-?\d+(?:\.\d+)?$/.test(String(value)) || isSafeNumericExpression(value)) {
      return String(value);
    }
    return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }

  function buildExportBundle(input, projectIndex, options) {
    const validation = validateDraft(input, projectIndex);
    const draft = validation.draft;
    const scene = renderSceneDry(draft, projectIndex, options);
    const draftJson = JSON.stringify(draft, null, 2) + '\n';
    const rootSnippet = draft.useSeenFlag ? 'Q.' + draft.seenFlag + ' = 0;\n' : '';
    const migrationSnippet = draft.useSeenFlag ? 'if (Q.' + draft.seenFlag + ' === undefined) Q.' + draft.seenFlag + ' = 0;\n' : '';
    const installApi = installPlanApi();
    const anchors = installAnchorsForProject(projectIndex);
    const plan = installApi.eventInstallPlan({
      id: draft.id,
      title: draft.title,
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
      scene,
      rootSnippet,
      migrationSnippet,
      rootAnchorText: anchors.rootAnchorText,
      migrationAnchorText: anchors.migrationAnchorText,
      routerRegistration: routerInstallHint(draft, projectIndex, anchors),
      variableInitRequests: missingEffectVariables(draft, projectIndex).map((name) => ({
        name,
        initialValue: '0',
        anchorText: anchors.rootAnchorText
      })),
      assetInstallRequests: draft.assetInstallRequests
    });
    const installPlanJson = installApi.renderInstallPlanJson(plan);
    const patchPreview = installApi.renderPatchPreview(plan);
    const installChecklist = installApi.renderOperationChecklist(plan);
    const files = [
      {path: draft.id + '.scene.dry', content: scene, kind: 'scene'},
      {path: draft.id + '.event-draft.json', content: draftJson, kind: 'draft'},
      draft.useSeenFlag ? {path: draft.id + '.root-init.snippet.dry', content: rootSnippet, kind: 'root_init'} : null,
      draft.useSeenFlag ? {path: draft.id + '.post-event-migration.snippet.js', content: migrationSnippet, kind: 'migration'} : null,
      {path: draft.id + '.install-plan.json', content: installPlanJson, kind: 'install_plan'},
      {path: draft.id + '.patch-preview.diff', content: patchPreview, kind: 'patch_preview'},
      {path: draft.id + '.install-notes.txt', content: '', kind: 'notes'}
    ].filter(Boolean);
    const installNotes = [
      'Install Assistant: proposal only / not installed',
      '',
      'Export bundle files:',
      ...files.filter((file) => file.kind !== 'notes').map((file) => '- ' + file.path),
      '- ' + draft.id + '.install-notes.txt',
      '',
      'Generated files:',
      '- Review ' + draft.id + '.scene.dry as a new world event scene.',
      '- Keep ' + draft.id + '.event-draft.json if you want to reopen this draft later.',
      '- Review ' + draft.id + '.patch-preview.diff before applying any safe operation.',
      '- Review the install operation checklist before deciding what to apply.',
      '- Review the root init and post_event migration snippets before copying them.',
      '- Review any profile-aware router registration in Review & Apply.',
      '',
      'Where to copy/paste:',
      '- Suggested source path: source/scenes/events/' + draft.id + '.scene.dry',
      routerInstallHint(draft, projectIndex, anchors)
        ? '- Studio generated a profile-aware router registration operation for Review & Apply.'
        : '- Router registration is pending because this profile has no known monthly event router anchor.',
      '',
      'Variables/init/migration:',
      draft.useSeenFlag
        ? '- Studio generated root init and post_event migration snippets for the optional seen flag.'
        : '- This text event does not enable a seen flag by default; no seen-flag root/migration snippet is generated.',
      '',
      'Validation command:',
      'bash tools/build_and_validate.sh --skip-build --errors-only',
      '',
      'Studio source review:',
      '- Review & Apply can dry-run and apply the scene file plus guarded root/post_event snippets when the project anchors still match.',
      '- If a guarded anchor is missing or duplicated, Review & Apply stops and asks for a source anchor or profile rule before applying.',
      '- SDAAH-style projects route tags:event scenes through the monthly #event popup lane; other project styles need a profile router rule before Studio can wire them automatically.'
    ].join('\n') + '\n';
    const notesFile = files.find((file) => file.kind === 'notes');
    if (notesFile) {
      notesFile.content = installNotes;
    }
    return {
      draft,
      diagnostics: validation.diagnostics,
      ok: validation.ok,
      files,
      scene,
      draftJson,
      rootSnippet,
      migrationSnippet,
      installPlan: plan,
      installPlanJson,
      patchPreview,
      installChecklist,
      installNotes
    };
  }

  function installAnchorsForProject(projectIndex) {
    const profiles = projectProfileIds(projectIndex);
    if (projectHasAnchorPreview(projectIndex, '// ====== U. EVENT SEEN FLAGS ======')) {
      return {
        rootAnchorText: '// ====== U. EVENT SEEN FLAGS ======',
        migrationAnchorText: '// Save compatibility: post_event split (post_event_news)'
      };
    }
    if (projectHasAnchorPreview(projectIndex, 'Q.started = 1;') || hasStrongSdaahProfile(projectIndex, profiles)) {
      return {
        rootAnchorText: 'Q.started = 1;',
        migrationAnchorText: 'Q.last_advisor_action = 0;'
      };
    }
    return {
      rootAnchorText: '// ====== U. EVENT SEEN FLAGS ======',
      migrationAnchorText: '// Save compatibility: post_event split (post_event_news)'
    };
  }

  function projectHasAnchorPreview(projectIndex, anchorText) {
    const needle = String(anchorText || '').trim();
    if (!needle) {
      return false;
    }
    return ensureArray(projectIndex && projectIndex.scenes).some((scene) => {
      return ensureArray(scene && scene.opaqueJsBlocks).some((block) => {
        return String(block && block.rawPreview || '').includes(needle);
      });
    });
  }

  function hasStrongSdaahProfile(projectIndex, profiles) {
    if (profiles.has('islands-sunrise')) {
      return true;
    }
    const detectionProfiles = ensureArray(projectIndex && projectIndex.project && projectIndex.project.detection && projectIndex.project.detection.profiles)
      .concat(ensureArray(projectIndex && projectIndex.profiles));
    const sdaah = detectionProfiles.find((profile) => String(profile && profile.id || '') === 'sdaah-style');
    if (!sdaah) {
      return profiles.has('sdaah-style');
    }
    const confidence = Number(sdaah.confidence || 0);
    const evidence = ensureArray(sdaah.evidence).map(String);
    const hasSpecificFileEvidence = evidence.some((item) => {
      return /election_algorithm|political_terrain|STATE_MAP|collective_graph|founding_deliberation_path_manifest/.test(item);
    });
    return confidence >= 0.5 || hasSpecificFileEvidence;
  }

  function routerInstallHint(draft, projectIndex, anchors) {
    const profiles = projectProfileIds(projectIndex);
    const known = profiles.has('generic-dendry') || profiles.has('sdaah-style');
    if (!known) {
      return null;
    }
    const anchor = routerAnchor(projectIndex, anchors);
    if (!anchor.anchorText) {
      return null;
    }
    return {
      path: 'source/scenes/post_event.scene.dry',
      anchorText: anchor.anchorText,
      position: anchor.position,
      dedupeSearch: '- #event',
      safety: 'advanced_apply',
      content: '- #event: Monthly event popups\n',
      description: 'Register the monthly event tag lane for new tags:event world event scenes.'
    };
  }

  function routerAnchor(projectIndex, anchors) {
    const parserEvidence = projectIndex && projectIndex.semantic && projectIndex.semantic.parserEvidence || {};
    const table = ensureArray(parserEvidence.monthlyPopupRouterTable);
    const first = table.find((row) => row && row.router && row.router.source && row.router.source.anchorText);
    if (first) {
      return {anchorText: first.router.source.anchorText, position: 'after'};
    }
    const scenes = ensureArray(projectIndex && projectIndex.scenes);
    const postEvent = scenes.find((scene) => String(scene && scene.path || '').replace(/\\/g, '/') === 'source/scenes/post_event.scene.dry');
    if (postEvent) {
      const rootChoice = ensureArray(postEvent.options || postEvent.choices).find((option) => {
        const source = option && option.sourceSpan || option && option.source || {};
        const anchorText = String(source.anchorText || source.endAnchorText || '').trim();
        return /^-\s*@root\b/.test(anchorText);
      });
      const source = rootChoice && (rootChoice.sourceSpan || rootChoice.source || {});
      const anchorText = String(source && (source.anchorText || source.endAnchorText) || '').trim();
      if (anchorText) {
        return {anchorText, position: 'before'};
      }
    }
    return {anchorText: '', position: 'after'};
  }

  function projectProfileIds(projectIndex) {
    const ids = new Set();
    const projectProfiles = projectIndex && projectIndex.project && Array.isArray(projectIndex.project.profileIds)
      ? projectIndex.project.profileIds
      : [];
    projectProfiles.forEach((profile) => {
      if (profile) {
        ids.add(String(profile));
      }
    });
    ensureArray(projectIndex && projectIndex.profiles).forEach((profile) => {
      if (profile && profile.id) {
        ids.add(String(profile.id));
      }
    });
    return ids;
  }

  function missingEffectVariables(draft, projectIndex) {
    const variables = variableSet(projectIndex);
    if (!variables) {
      return [];
    }
    const names = new Set();
    collectEffects(draft).forEach((effect) => {
      const name = effect && effect.variable;
      if (name && (!draft.useSeenFlag || name !== draft.seenFlag) && !variables.has(name)) {
        names.add(name);
      }
    });
    return Array.from(names).sort();
  }

  function collectEffects(draft) {
    const effects = [];
    ensureArray(draft.effectsOnTrigger).forEach((effect) => effects.push(effect));
    ensureArray(draft.options).forEach((option) => {
      ensureArray(option.effects).forEach((effect) => effects.push(effect));
    });
    ensureArray(draft.sections).forEach((section) => {
      ensureArray(section.effects).forEach((effect) => effects.push(effect));
      ensureArray(section.options).forEach((option) => {
        ensureArray(option.effects).forEach((effect) => effects.push(effect));
      });
    });
    return effects;
  }

  function parsedToDraftApi() {
    if (global && global.ProjectMapParsedToDraft) {
      return global.ProjectMapParsedToDraft;
    }
    if (typeof require === 'function') {
      try {
        return require('./parsed_to_draft.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function fromExistingScene(projectIndex, sceneId, options) {
    const opts = isObject(options) ? options : {};
    const parsedToDraft = parsedToDraftApi();
    if (parsedToDraft && typeof parsedToDraft.buildDraftFromParsed === 'function') {
      try {
        const result = parsedToDraft.buildDraftFromParsed(projectIndex, {
          view: 'events',
          itemId: sceneId,
          newId: opts.newId || opts.id,
          sourceEntry: 'event_draft.fromExistingScene'
        });
        if (result && result.draft) {
          return normalizeDraft(result.draft);
        }
      } catch (_err) {
        // Keep the legacy extraction path available if the canonical bridge is not loaded.
      }
    }
    const scene = findScene(projectIndex, sceneId);
    if (!scene) {
      return normalizeDraft({eventShape: 'pure_event', id: safeDraftId(sceneId || 'new_text_event'), title: String(sceneId || 'New text event'), options: []});
    }
    const id = safeDraftId(opts.id || opts.newId || scene.id + '_copy');
    const rows = textRowsForScene(projectIndex, scene.id);
    const roleText = (role) => firstText(rows, role);
    const bodyRows = rows.filter((row) => {
      const role = String(row && row.role || row && row.semanticRole || '').trim();
      return ['body', 'content', 'visible_text', 'monthly_popup_excerpt'].includes(role);
    });
    const body = bodyRows.length
      ? bodyRows.map((row) => String(row && (row.text || row.value || row.original) || '').trim()).filter(Boolean)
      : normalizeTextList(scene.body || scene.text || '');
    const optionsRows = ensureArray(scene.options || scene.choices);
    const eventShape = optionsRows.length > 1 ? 'choice_event' : optionsRows.length === 1 ? 'linear_choice_event' : 'pure_event';
    return normalizeDraft({
      schemaVersion: EVENT_DRAFT_VERSION,
      kind: EVENT_KIND,
      eventShape,
      id,
      title: String(scene.title || roleText('title') || humanTitle(scene.id)).trim(),
      subtitle: String(scene.subtitle || roleText('subtitle') || '').trim(),
      heading: String(roleText('heading') || scene.heading || scene.title || humanTitle(scene.id)).trim(),
      tags: scene.tags || roleText('tags') || (eventShape === 'pure_event' ? ['event'] : ['event', 'world']),
      newPage: scene.newPage === undefined ? booleanFromText(roleText('newPage'), true) : scene.newPage,
      rawViewIf: String(scene.viewIf || scene.view_if || roleText('viewIf') || '').trim(),
      maxVisits: scene.maxVisits || scene.max_visits || null,
      frequency: scene.frequency || null,
      calls: scene.calls || scene.callTargets || [],
      setJump: scene.setJump || scene.set_jump || scene.jumpTarget || '',
      rawRoutes: scene.rawRoutes || scene.routeClauses || [],
      rawOnDisplay: scene.rawOnDisplay || scene.onDisplay || [],
      rawOnDeparture: scene.rawOnDeparture || scene.onDeparture || [],
      useSeenFlag: choiceLikeEventShape(eventShape),
      seenFlag: choiceLikeEventShape(eventShape) ? id + '_seen' : '',
      when: {
        year: numberOrNull(scene.year) || 1936,
        monthStart: numberOrNull(scene.monthStart || scene.month_start) || 1,
        monthEnd: numberOrNull(scene.monthEnd || scene.month_end) || 12,
        requires: '',
        priority: numberOrNull(scene.priority) ?? 0
      },
      introParagraphs: body.length ? body : normalizeTextList(scene.intro || scene.description || scene.title || ''),
      effectsOnTrigger: sceneEffectsForDraft(scene),
      rawEffectsOnTrigger: scene.rawEffectsOnTrigger || scene.rawOnArrival || scene.onArrival || [],
      assetRefs: assetRefsForScene(scene),
      options: optionsRows.map(optionFromScene)
    });
  }

  function findScene(projectIndex, sceneId) {
    const id = String(sceneId || '').trim();
    return ensureArray(projectIndex && projectIndex.scenes).find((scene) => String(scene && scene.id || '').trim() === id) || null;
  }

  function textRowsForScene(projectIndex, sceneId) {
    const rows = ensureArray(projectIndex && projectIndex.textCorpus)
      .concat(ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.textCorpus && projectIndex.semantic.textCorpus.items));
    const seen = new Set();
    return rows.filter((row) => {
      return String(row && (row.sceneId || row.ownerSceneId || row.owner && row.owner.sceneId) || '').trim() === String(sceneId || '').trim();
    }).filter((row) => {
      const key = [
        row && row.id,
        row && row.role || row && row.semanticRole,
        row && (row.text || row.value || row.original),
        row && row.source && row.source.path,
        row && row.source && (row.source.line || row.source.startLine)
      ].join('|');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function firstText(rows, role) {
    const wanted = String(role || '').toLowerCase();
    const row = ensureArray(rows).find((item) => {
      return String(item && (item.role || item.semanticRole || item.kind) || '').toLowerCase() === wanted;
    });
    return String(row && (row.text || row.value || row.original) || '').trim();
  }

  function sceneEffectsForDraft(scene) {
    return ensureArray(scene && scene.effects).map((effect) => {
      const value = isObject(effect) ? effect : {};
      const variable = String(value.variable || value.name || '').replace(/^Q\./, '').trim();
      const op = String(value.op || value.operator || '=').trim();
      return normalizeEffect({
        variable,
        op: EFFECT_OPS.has(op) ? op : '+=',
        value: value.value === undefined ? value.amount : value.value,
        valueKind: value.valueKind || (typeof value.value === 'string' && isSafeNumericExpression(value.value) ? 'expression' : ''),
        condition: value.condition || value.if || '',
        hook: value.hook || value.timing || 'on-arrival'
      });
    }).filter((effect) => effect.variable);
  }

  function optionFromScene(option, index) {
    const value = isObject(option) ? option : {};
    const id = safeDraftId(value.id || value.targetId || value.rawTargetId || 'option_' + (index + 1));
    return normalizeOption({
      id,
      label: value.label || value.text || value.title || 'Option ' + (index + 1),
      subtitle: value.subtitle || '',
      chooseIf: value.chooseIf || value.condition || '',
      unavailableText: value.unavailableText || value.unavailable || '',
      narrativeParagraphs: value.narrativeParagraphs || value.body || value.resultText || '',
      effects: value.effects || [],
      variants: value.variants || [],
      gotoAfter: value.gotoAfter || value.targetId || value.rawTargetId || 'continue_' + id,
      returnTarget: value.returnTarget || value.afterResultTarget || 'root'
    }, index);
  }

  function assetRefsForScene(scene) {
    return ensureArray(scene && (scene.assets || scene.assetRefs)).map(normalizeAssetRef).filter((asset) => asset.path);
  }

  function booleanFromText(value, fallback) {
    const text = String(value === undefined || value === null ? '' : value).trim();
    if (!text) {
      return Boolean(fallback);
    }
    return /^(1|true|yes|on)$/i.test(text);
  }

  function safeDraftId(value) {
    const text = String(value || '').trim()
      .replace(/^[@#]/, '')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return /^[A-Za-z_]/.test(text) ? text : 'event_' + (text || 'draft');
  }

  function humanTitle(value) {
    return String(value || 'Text event').replace(/[_-]+/g, ' ').replace(/\b[a-z]/g, (char) => char.toUpperCase());
  }

  const api = {
    EVENT_DRAFT_VERSION,
    normalizeDraft,
    validateDraft,
    renderSceneDry,
    buildExportBundle,
    build: buildExportBundle,
    generate: buildExportBundle,
    renderEffect,
    routerInstallHint,
    fromExistingScene
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapEventDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
