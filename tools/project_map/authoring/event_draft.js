(function initEventDraft(global) {
  'use strict';

  const EVENT_DRAFT_VERSION = '0.1';
  const EVENT_KIND = 'world_event';
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const EFFECT_OPS = new Set(['=', '+=', '-=']);
  const RESERVED_PRIORITY = 4;

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function normalizeDraft(input) {
    const draft = isObject(input) ? clone(input) : {};
    draft.schemaVersion = String(draft.schemaVersion || EVENT_DRAFT_VERSION);
    draft.kind = String(draft.kind || EVENT_KIND);
    draft.id = String(draft.id || '').trim();
    draft.title = String(draft.title || '').trim();
    draft.heading = String(draft.heading || draft.title || '').trim();
    draft.seenFlag = String(draft.seenFlag || (draft.id ? draft.id + '_seen' : '')).trim();
    draft.when = normalizeWhen(draft.when);
    draft.effectsOnTrigger = ensureArray(draft.effectsOnTrigger).map(normalizeEffect);
    draft.introParagraphs = normalizeTextList(draft.introParagraphs);
    draft.assetRefs = ensureArray(draft.assetRefs).map(normalizeAssetRef);
    draft.assetInstallRequests = ensureArray(draft.assetInstallRequests).map(normalizeAssetInstallRequest);
    draft.options = ensureArray(draft.options).map(normalizeOption);
    const sections = ensureArray(draft.sections).map(normalizeSection).filter((section) => section.id);
    if (sections.length) {
      draft.sections = sections;
    } else {
      delete draft.sections;
    }
    return draft;
  }

  function normalizeWhen(when) {
    const value = isObject(when) ? when : {};
    return {
      year: numberOrNull(value.year),
      monthStart: numberOrNull(value.monthStart),
      monthEnd: numberOrNull(value.monthEnd),
      requires: String(value.requires || 'founding_complete = 1').trim(),
      priority: numberOrNull(value.priority) ?? 0
    };
  }

  function normalizeOption(option, index) {
    const value = isObject(option) ? option : {};
    const id = String(value.id || ('option_' + (index + 1))).trim();
    return {
      id,
      label: String(value.label || '').trim(),
      subtitle: String(value.subtitle || '').trim(),
      chooseIf: String(value.chooseIf || '').trim(),
      unavailableText: String(value.unavailableText || '').trim(),
      effects: ensureArray(value.effects).map(normalizeEffect),
      narrativeParagraphs: normalizeTextList(value.narrativeParagraphs),
      variants: ensureArray(value.variants).map(normalizeVariant),
      gotoAfter: String(value.gotoAfter || ('continue_' + id)).trim()
    };
  }

  function normalizeEffect(effect) {
    const value = isObject(effect) ? effect : {};
    return {
      variable: String(value.variable || '').trim(),
      op: String(value.op || '').trim(),
      value: value.value,
      condition: String(value.condition || '').trim(),
      hook: String(value.hook || '').trim()
    };
  }

  function normalizeSection(section, index) {
    const value = isObject(section) ? section : {};
    const id = String(value.id || ('section_' + (index + 1))).trim();
    return {
      id,
      title: String(value.title || value.heading || '').trim(),
      condition: String(value.condition || value.viewIf || value.chooseIf || '').trim(),
      paragraphs: normalizeTextList(value.paragraphs || value.narrativeParagraphs || value.body || value.text),
      effects: ensureArray(value.effects).map(normalizeEffect),
      options: ensureArray(value.options).map(normalizeOption)
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

  function normalizeAssetRef(asset) {
    const value = isObject(asset) ? asset : {path: asset};
    const path = String(value.path || value.src || value.url || '').trim();
    return {
      path,
      type: String(value.type || inferAssetType(path) || 'asset').trim(),
      label: String(value.label || value.name || fileName(path) || '').trim(),
      role: String(value.role || '').trim()
    };
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
    if (!ID_RE.test(draft.id)) {
      diag(diagnostics, 'error', 'event_draft.id', 'Event id must match /^[A-Za-z_][A-Za-z0-9_]*$/.');
    }
    if (draft.id && scenes.has(draft.id)) {
      diag(diagnostics, 'error', 'event_draft.duplicate_scene_id', 'Scene id already exists in the loaded ProjectIndex: ' + draft.id);
    }
    if (!ID_RE.test(draft.seenFlag)) {
      diag(diagnostics, 'error', 'event_draft.seen_flag', 'seenFlag must be a valid Q variable name.');
    }
    if (!draft.title) {
      diag(diagnostics, 'error', 'event_draft.title', 'Title is required.');
    }
    if (!draft.heading) {
      diag(diagnostics, 'error', 'event_draft.heading', 'Heading is required.');
    }
    validateWhen(draft.when, diagnostics);
    checkConditionText(draft.when.requires, diagnostics, 'event_draft.requires');

    const optionIds = new Set();
    const renderedAnchors = new Set();
    if (draft.options.length < 2 || draft.options.length > 4) {
      diag(diagnostics, 'error', 'event_draft.choice_count', 'World event drafts must contain 2 to 4 choices.');
    }
    draft.options.forEach((option, index) => {
      if (!ID_RE.test(option.id)) {
        diag(diagnostics, 'error', 'event_draft.option_id', 'Option ' + (index + 1) + ' id must be a valid anchor id.');
      }
      if (optionIds.has(option.id)) {
        diag(diagnostics, 'error', 'event_draft.duplicate_option_id', 'Duplicate option id: ' + option.id);
      }
      optionIds.add(option.id);
      recordRenderedAnchor(renderedAnchors, option.id, diagnostics);
      if (!option.label) {
        diag(diagnostics, 'error', 'event_draft.option_label', 'Option ' + option.id + ' needs a label.');
      }
      checkConditionText(option.chooseIf, diagnostics, 'event_draft.choose_if');
      if (option.unavailableText && !option.chooseIf) {
        diag(diagnostics, 'warning', 'event_draft.unavailable_without_choose_if', 'unavailableText only matters when chooseIf is set: ' + option.id);
      }
      checkGotoAfter(option.gotoAfter, diagnostics);
      recordRenderedAnchor(renderedAnchors, option.gotoAfter, diagnostics);
      option.effects.forEach((effect) => validateEffect(effect, variables, draft.seenFlag, diagnostics));
      option.variants.forEach((variant) => {
        checkConditionText(variant.condition, diagnostics, 'event_draft.variant_condition');
        checkFakeInlineOption(variant.text, diagnostics);
      });
      option.narrativeParagraphs.forEach((paragraph) => checkFakeInlineOption(paragraph, diagnostics));
    });
    draft.effectsOnTrigger.forEach((effect) => validateEffect(effect, variables, draft.seenFlag, diagnostics));
    draft.introParagraphs.forEach((paragraph) => checkFakeInlineOption(paragraph, diagnostics));
    ensureArray(draft.sections).forEach((section) => validateSection(section, variables, renderedAnchors, diagnostics));

    return {draft, diagnostics, ok: diagnostics.every((item) => item.severity !== 'error')};
  }

  function validateSection(section, variables, renderedAnchors, diagnostics) {
    if (!ID_RE.test(section.id)) {
      diag(diagnostics, 'error', 'event_draft.section_id', 'Section id must be a valid anchor id.');
    }
    recordRenderedAnchor(renderedAnchors, section.id, diagnostics);
    checkConditionText(section.condition, diagnostics, 'event_draft.section_condition');
    section.effects.forEach((effect) => validateEffect(effect, variables, '', diagnostics));
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
      recordRenderedAnchor(renderedAnchors, option.id, diagnostics);
      if (!option.label) {
        diag(diagnostics, 'error', 'event_draft.section_option_label', 'Section option ' + option.id + ' needs a label.');
      }
      checkConditionText(option.chooseIf, diagnostics, 'event_draft.choose_if');
      if (option.unavailableText && !option.chooseIf) {
        diag(diagnostics, 'warning', 'event_draft.unavailable_without_choose_if', 'unavailableText only matters when chooseIf is set: ' + option.id);
      }
      checkGotoAfter(option.gotoAfter, diagnostics);
      recordRenderedAnchor(renderedAnchors, option.gotoAfter, diagnostics);
      option.effects.forEach((effect) => validateEffect(effect, variables, '', diagnostics));
      option.variants.forEach((variant) => {
        checkConditionText(variant.condition, diagnostics, 'event_draft.variant_condition');
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
      diag(diagnostics, 'error', 'event_draft.missing_variable', 'Effect variable is not in the loaded ProjectIndex: ' + effect.variable);
    }
    if (effect.op !== '=' && typeof effect.value !== 'number') {
      diag(diagnostics, 'error', 'event_draft.effect_value', 'Delta effect value must be numeric for ' + effect.variable + '.');
    }
  }

  function checkConditionText(text, diagnostics, code) {
    if (!text) {
      return;
    }
    if (/(?:^|;)\s*go-to\s*:|;\s*[A-Za-z_][A-Za-z0-9_]*\s+if\s+/i.test(text)) {
      diag(diagnostics, 'warning', 'event_draft.conditional_goto', 'Conditional go-to syntax is not supported in EventDraft conditions.');
    }
    if (/['"][^'"\n]*[\u4e00-\u9fff][^'"\n]*['"]/.test(text)) {
      diag(diagnostics, 'error', code || 'event_draft.chinese_string_comparison', 'Dendry conditionals must not compare Chinese strings.');
    }
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

  function recordRenderedAnchor(anchors, anchorId, diagnostics) {
    if (!anchorId) {
      return;
    }
    if (anchors.has(anchorId)) {
      diag(diagnostics, 'error', 'event_draft.duplicate_anchor', 'Rendered anchor would be duplicated: ' + anchorId);
    }
    anchors.add(anchorId);
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
    lines.push('new-page: true');
    lines.push('is-card: true');
    lines.push('tags: event, world');
    lines.push('view-if: ' + renderViewIf(draft));
    lines.push('priority: ' + draft.when.priority);
    lines.push('max-visits: 1');
    lines.push('on-arrival: {!');
    lines.push('Q.' + draft.seenFlag + ' = 1;');
    draft.effectsOnTrigger.forEach((effect) => lines.push(renderEffect(effect)));
    lines.push('!}');
    lines.push('');
    lines.push('= ' + draft.heading);
    lines.push('');
    appendParagraphs(lines, draft.introParagraphs);
    draft.options.forEach((option) => {
      lines.push('- @' + option.id + ': ' + option.label);
    });
    lines.push('');
    draft.options.forEach((option, index) => {
      if (index > 0) {
        lines.push('');
      }
      appendOption(lines, option, continueLabel);
    });
    ensureArray(draft.sections).forEach((section) => appendSection(lines, section, continueLabel));
    return lines.join('\n') + '\n';
  }

  function defaultContinueLabel(options) {
    const value = options && (options.defaultContinueLabel || options.continueLabel);
    const label = String(value || 'Continue').replace(/\s+/g, ' ').trim();
    return label || 'Continue';
  }

  function renderViewIf(draft) {
    const parts = [
      'year = ' + draft.when.year,
      'month >= ' + draft.when.monthStart,
      'month <= ' + draft.when.monthEnd,
      draft.seenFlag + ' = 0'
    ];
    if (draft.when.requires) {
      parts.push(draft.when.requires);
    }
    return parts.join(' and ');
  }

  function appendOption(lines, option, continueLabel) {
    lines.push('@' + option.id);
    if (option.subtitle) {
      lines.push('subtitle: ' + option.subtitle);
    }
    if (option.chooseIf) {
      lines.push('choose-if: ' + option.chooseIf);
    }
    if (option.unavailableText) {
      lines.push('unavailable-subtitle: ' + option.unavailableText);
    }
    lines.push('on-arrival: {!');
    option.effects.forEach((effect) => lines.push(renderEffect(effect)));
    lines.push('!}');
    lines.push('');
    appendParagraphs(lines, option.narrativeParagraphs);
    option.variants.forEach((variant) => {
      lines.push('[? if ' + variant.condition + ' : ' + variant.text + ' ?]');
      lines.push('');
    });
    lines.push('- @' + option.gotoAfter + ': ' + continueLabel);
    lines.push('');
    lines.push('@' + option.gotoAfter);
    lines.push('go-to: root');
  }

  function appendSection(lines, section, continueLabel) {
    lines.push('');
    lines.push('@' + section.id);
    if (section.title) {
      lines.push('= ' + section.title);
      lines.push('');
    }
    lines.push('on-arrival: {!');
    section.effects.forEach((effect) => lines.push(renderEffect(effect)));
    lines.push('!}');
    lines.push('');
    if (section.condition) {
      lines.push('[? if ' + section.condition + ' : ' + section.paragraphs.join('\n\n') + ' ?]');
      lines.push('');
    } else {
      appendParagraphs(lines, section.paragraphs);
    }
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
      appendOption(lines, option, continueLabel);
    });
  }

  function appendParagraphs(lines, paragraphs) {
    ensureArray(paragraphs).forEach((paragraph) => {
      lines.push(paragraph);
      lines.push('');
    });
  }

  function renderEffect(effect) {
    return 'Q.' + effect.variable + ' ' + effect.op + ' ' + renderEffectValue(effect.value) + (effect.condition ? ' if ' + effect.condition : '') + ';';
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
    if (/^-?\d+(?:\.\d+)?$/.test(String(value))) {
      return String(value);
    }
    return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  }

  function buildExportBundle(input, projectIndex, options) {
    const validation = validateDraft(input, projectIndex);
    const draft = validation.draft;
    const scene = renderSceneDry(draft, projectIndex, options);
    const draftJson = JSON.stringify(draft, null, 2) + '\n';
    const rootSnippet = 'Q.' + draft.seenFlag + ' = 0;\n';
    const migrationSnippet = 'if (Q.' + draft.seenFlag + ' === undefined) Q.' + draft.seenFlag + ' = 0;\n';
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
      assetInstallRequests: draft.assetInstallRequests
    });
    const installPlanJson = installApi.renderInstallPlanJson(plan);
    const patchPreview = installApi.renderPatchPreview(plan);
    const installChecklist = installApi.renderOperationChecklist(plan);
    const files = [
      {path: draft.id + '.scene.dry', content: scene, kind: 'scene'},
      {path: draft.id + '.event-draft.json', content: draftJson, kind: 'draft'},
      {path: draft.id + '.root-init.snippet.dry', content: rootSnippet, kind: 'root_init'},
      {path: draft.id + '.post-event-migration.snippet.js', content: migrationSnippet, kind: 'migration'},
      {path: draft.id + '.install-plan.json', content: installPlanJson, kind: 'install_plan'},
      {path: draft.id + '.patch-preview.diff', content: patchPreview, kind: 'patch_preview'},
      {path: draft.id + '.install-notes.txt', content: '', kind: 'notes'}
    ];
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
      '',
      'Where to copy/paste:',
      '- Suggested source path: source/scenes/events/' + draft.id + '.scene.dry',
      '- Wire the event into your monthly router/news/event selection flow by hand.',
      '',
      'Variables/init/migration:',
      '- Add root init snippet near EVENT SEEN FLAGS in source/scenes/root.scene.dry.',
      '- Add post_event migration snippet near save compatibility guards in source/scenes/post_event.scene.dry.',
      '',
      'Validation command:',
      'bash tools/build_and_validate.sh --skip-build --errors-only',
      '',
      'Manual IDE steps:',
      '- Review & Apply can dry-run and apply the scene file plus guarded root/post_event snippets when the project anchors still match.',
      '- If a guarded anchor is missing or duplicated, Review & Apply stops and leaves that step for IDE review.',
      '- SDAAH-style projects route tags:event scenes through the monthly #event popup lane; other project styles may still need router review.'
    ].join('\n') + '\n';
    files[6].content = installNotes;
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
    if (profiles.has('sdaah-style')) {
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

  const api = {
    EVENT_DRAFT_VERSION,
    normalizeDraft,
    validateDraft,
    renderSceneDry,
    buildExportBundle,
    build: buildExportBundle,
    generate: buildExportBundle,
    renderEffect
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapEventDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
