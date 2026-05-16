(function initCardDraft(global) {
  'use strict';

  const CARD_DRAFT_VERSION = '0.1';
  const CARD_KIND = 'card';
  const CARD_KINDS = new Set(['action_card', 'advisor_like']);
  const CARD_SHAPES = new Set(['choice_card', 'menu_card', 'pinned_text_card']);
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const EFFECT_OPS = new Set(['=', '+=', '-=']);

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function normalizeDraft(input) {
    const draft = isObject(input) ? clone(input) : {};
    draft.schemaVersion = String(draft.schemaVersion || CARD_DRAFT_VERSION);
    draft.kind = String(draft.kind || CARD_KIND);
    draft.id = String(draft.id || '').trim();
    draft.title = String(draft.title || '').trim();
    draft.cardKind = String(draft.cardKind || 'action_card').trim();
    draft.cardShape = normalizeCardShape(draft.cardShape || draft.shape, draft);
    draft.tags = normalizeStringList(draft.tags);
    draft.viewIf = String(draft.viewIf || '').trim();
    draft.priority = numberOrNull(draft.priority);
    draft.frequency = numberOrNull(draft.frequency);
    draft.maxVisits = numberOrNull(draft.maxVisits);
    draft.heading = String(draft.heading || draft.title || '').trim();
    draft.subtitle = String(draft.subtitle || '').trim();
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

  function normalizeCardShape(value, draft) {
    const text = String(value || '').trim();
    if (CARD_SHAPES.has(text)) {
      return text;
    }
    if (ensureArray(draft && draft.sections).length) {
      return 'menu_card';
    }
    if (!ensureArray(draft && draft.options).length) {
      return 'pinned_text_card';
    }
    return 'choice_card';
  }

  function normalizeOption(option, index) {
    const value = isObject(option) ? option : {};
    return {
      id: String(value.id || ('option_' + (index + 1))).trim(),
      label: String(value.label || '').trim(),
      title: String(value.title || '').trim(),
      subtitle: String(value.subtitle || '').trim(),
      chooseIf: String(value.chooseIf || '').trim(),
      unavailableText: String(value.unavailableText || '').trim(),
      effects: ensureArray(value.effects).map(normalizeEffect),
      narrativeParagraphs: normalizeTextList(value.narrativeParagraphs),
      gotoAfter: String(value.gotoAfter || 'root').trim()
    };
  }

  function normalizeSection(section, index) {
    const value = isObject(section) ? section : {};
    return {
      id: String(value.id || ('section_' + (index + 1))).trim(),
      title: String(value.title || '').trim(),
      condition: String(value.condition || '').trim(),
      paragraphs: normalizeTextList(value.paragraphs || value.body || value.text),
      effects: ensureArray(value.effects).map(normalizeEffect),
      options: ensureArray(value.options).map(normalizeOption),
      exitTarget: String(value.exitTarget || 'root').trim()
    };
  }

  function normalizeEffect(effect) {
    const value = isObject(effect) ? effect : {};
    return {
      variable: String(value.variable || '').trim(),
      op: String(value.op || '').trim(),
      value: value.value,
      condition: String(value.condition || value.if || '').trim()
    };
  }

  function normalizeStringList(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
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

    if (draft.schemaVersion !== CARD_DRAFT_VERSION) {
      diag(diagnostics, 'error', 'card_draft.schema_version', 'CardDraft schemaVersion must be "0.1".');
    }
    if (draft.kind !== CARD_KIND) {
      diag(diagnostics, 'error', 'card_draft.kind', 'Only kind "card" is supported in v0.65.');
    }
    if (!ID_RE.test(draft.id)) {
      diag(diagnostics, 'error', 'card_draft.id', 'Card id must match /^[A-Za-z_][A-Za-z0-9_]*$/.');
    }
    if (draft.id && scenes.has(draft.id)) {
      diag(diagnostics, 'error', 'card_draft.duplicate_scene_id', 'Scene id already exists in the loaded ProjectIndex: ' + draft.id);
    }
    if (!draft.title) {
      diag(diagnostics, 'error', 'card_draft.title', 'Title is required.');
    }
    if (!draft.heading) {
      diag(diagnostics, 'error', 'card_draft.heading', 'Heading is required.');
    }
    if (!CARD_KINDS.has(draft.cardKind)) {
      diag(diagnostics, 'error', 'card_draft.card_kind', 'cardKind must be "action_card" or "advisor_like".');
    }
    if (!CARD_SHAPES.has(draft.cardShape)) {
      diag(diagnostics, 'error', 'card_draft.card_shape', 'cardShape must be "choice_card", "menu_card", or "pinned_text_card".');
    }
    if (draft.priority !== null && !Number.isInteger(draft.priority)) {
      diag(diagnostics, 'error', 'card_draft.priority', 'Priority must be an integer.');
    }
    if (draft.frequency !== null && (!Number.isInteger(draft.frequency) || draft.frequency < 0)) {
      diag(diagnostics, 'error', 'card_draft.frequency', 'Frequency must be a non-negative integer.');
    }
    if (draft.maxVisits !== null && (!Number.isInteger(draft.maxVisits) || draft.maxVisits < 1)) {
      diag(diagnostics, 'error', 'card_draft.max_visits', 'max-visits must be a positive integer.');
    }
    checkConditionText(draft.viewIf, diagnostics, 'card_draft.view_if');

    const optionIds = new Set();
    if (draft.cardShape === 'choice_card' && draft.options.length < 2) {
      diag(diagnostics, 'error', 'card_draft.choice_count', 'Choice card drafts must contain at least 2 choices.');
    }
    if (draft.cardShape === 'pinned_text_card' && draft.options.length) {
      diag(diagnostics, 'error', 'card_draft.pinned_text_options', 'Pinned text cards must not contain standard choices.');
    }
    if (draft.cardShape === 'menu_card' && !ensureArray(draft.sections).length) {
      diag(diagnostics, 'error', 'card_draft.menu_sections', 'Menu card drafts must contain at least one section.');
    }
    draft.options.forEach((option, index) => {
      validateOption(option, index, variables, optionIds, diagnostics, 'Option');
    });
    ensureArray(draft.sections).forEach((section, index) => validateSection(section, index, variables, optionIds, diagnostics));
    draft.introParagraphs.forEach((paragraph) => checkFakeInlineOption(paragraph, diagnostics));

    return {draft, diagnostics, ok: diagnostics.every((item) => item.severity !== 'error')};
  }

  function validateSection(section, index, variables, anchors, diagnostics) {
    if (!ID_RE.test(section.id)) {
      diag(diagnostics, 'error', 'card_draft.section_id', 'Section ' + (index + 1) + ' id must be a valid anchor id.');
    }
    if (anchors.has(section.id)) {
      diag(diagnostics, 'error', 'card_draft.duplicate_option_id', 'Duplicate card anchor id: ' + section.id);
    }
    anchors.add(section.id);
    checkConditionText(section.condition, diagnostics, 'card_draft.section_condition');
    if (section.exitTarget && !ID_RE.test(section.exitTarget)) {
      diag(diagnostics, 'error', 'card_draft.section_exit_target', 'Section exit target must be a plain scene or anchor id.');
    }
    section.effects.forEach((effect) => validateEffect(effect, variables, diagnostics));
    section.paragraphs.forEach((paragraph) => checkFakeInlineOption(paragraph, diagnostics));
    section.options.forEach((option, optionIndex) => validateOption(option, optionIndex, variables, anchors, diagnostics, 'Section option'));
  }

  function validateOption(option, index, variables, anchors, diagnostics, label) {
    if (!ID_RE.test(option.id)) {
      diag(diagnostics, 'error', 'card_draft.option_id', label + ' ' + (index + 1) + ' id must be a valid anchor id.');
    }
    if (anchors.has(option.id)) {
      diag(diagnostics, 'error', 'card_draft.duplicate_option_id', 'Duplicate card anchor id: ' + option.id);
    }
    anchors.add(option.id);
    const returnAnchor = optionReturnAnchor(option);
    if (option.narrativeParagraphs.length && returnAnchor) {
      if (anchors.has(returnAnchor)) {
        diag(diagnostics, 'error', 'card_draft.duplicate_option_id', 'Duplicate generated card return anchor: ' + returnAnchor);
      }
      anchors.add(returnAnchor);
    }
    if (!option.label) {
      diag(diagnostics, 'error', 'card_draft.option_label', label + ' ' + option.id + ' needs a label.');
    }
    checkConditionText(option.chooseIf, diagnostics, 'card_draft.choose_if');
    if (option.unavailableText && !option.chooseIf) {
      diag(diagnostics, 'warning', 'card_draft.unavailable_without_choose_if', 'unavailableText only matters when chooseIf is set: ' + option.id);
    }
    if (option.gotoAfter && !ID_RE.test(option.gotoAfter)) {
      diag(diagnostics, 'error', 'card_draft.goto_after', 'Option gotoAfter must be a plain scene or anchor id.');
    }
    option.effects.forEach((effect) => validateEffect(effect, variables, diagnostics));
    option.narrativeParagraphs.forEach((paragraph) => checkFakeInlineOption(paragraph, diagnostics));
  }

  function validateEffect(effect, variables, diagnostics) {
    if (!ID_RE.test(effect.variable)) {
      diag(diagnostics, 'error', 'card_draft.effect_variable', 'Effect variable must be a valid Q variable name.');
      return;
    }
    if (!EFFECT_OPS.has(effect.op)) {
      diag(diagnostics, 'error', 'card_draft.effect_op', 'Effect op must be one of =, +=, -=.');
    }
    if (variables && !variables.has(effect.variable)) {
      diag(diagnostics, 'error', 'card_draft.missing_variable', 'Effect variable is not in the loaded ProjectIndex: ' + effect.variable);
    }
    if (effect.op !== '=' && typeof effect.value !== 'number') {
      diag(diagnostics, 'error', 'card_draft.effect_value', 'Delta effect value must be numeric for ' + effect.variable + '.');
    }
  }

  function checkConditionText(text, diagnostics, code) {
    if (!text) {
      return;
    }
    if (/['"][^'"\n]*[\u4e00-\u9fff][^'"\n]*['"]/.test(text)) {
      diag(diagnostics, 'error', code || 'card_draft.chinese_string_comparison', 'Dendry conditionals must not compare Chinese strings.');
    }
    if (/(?:^|;)\s*go-to\s*:|\s+if\s+/i.test(text)) {
      diag(diagnostics, 'warning', 'card_draft.conditional_goto', 'Conditional go-to syntax is not supported in CardDraft conditions.');
    }
  }

  function checkFakeInlineOption(text, diagnostics) {
    if (/\[\?\s*if[\s\S]*-\s*@/.test(String(text || ''))) {
      diag(diagnostics, 'error', 'card_draft.fake_inline_option', 'Inline conditional options are not valid Dendry authoring.');
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

  function renderSceneDry(input, projectIndex) {
    const validation = validateDraft(input, projectIndex);
    const draft = validation.draft;
    const lines = [];
    lines.push('title: ' + draft.title);
    lines.push('new-page: true');
    lines.push(draft.cardKind === 'advisor_like' ? 'is-pinned-card: true' : 'is-card: true');
    if (draft.tags.length) {
      lines.push('tags: ' + draft.tags.join(', '));
    }
    if (draft.viewIf) {
      lines.push('view-if: ' + draft.viewIf);
    }
    if (draft.priority !== null) {
      lines.push('priority: ' + draft.priority);
    }
    if (draft.frequency !== null) {
      lines.push('frequency: ' + draft.frequency);
    }
    if (draft.maxVisits !== null) {
      lines.push('max-visits: ' + draft.maxVisits);
    }
    if (draft.subtitle) {
      lines.push('subtitle: ' + draft.subtitle);
    }
    lines.push('');
    lines.push('= ' + draft.heading);
    lines.push('');
    appendParagraphs(lines, draft.introParagraphs);
    if (draft.options.length) {
      draft.options.forEach((option) => {
        lines.push('- @' + option.id + ': ' + option.label);
      });
      lines.push('');
      draft.options.forEach((option, index) => {
        if (index > 0) {
          lines.push('');
        }
        appendOption(lines, option);
      });
    }
    ensureArray(draft.sections).forEach((section) => appendSection(lines, section));
    return lines.join('\n') + '\n';
  }

  function appendOption(lines, option) {
    lines.push('@' + option.id);
    if (option.title) {
      lines.push('title: ' + option.title);
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
    if (option.effects.length) {
      lines.push('on-arrival: {!');
      option.effects.forEach((effect) => lines.push(renderEffect(effect)));
      lines.push('!}');
    }
    lines.push('');
    appendParagraphs(lines, option.narrativeParagraphs);
    if (option.narrativeParagraphs.length) {
      const returnAnchor = optionReturnAnchor(option);
      lines.push('- @' + returnAnchor + ': Continue');
      lines.push('');
      lines.push('@' + returnAnchor);
      lines.push('go-to: ' + (option.gotoAfter || 'root'));
      return;
    }
    lines.push('go-to: ' + (option.gotoAfter || 'root'));
  }

  function optionReturnAnchor(option) {
    const id = String(option && option.id || '').trim();
    return ID_RE.test(id) ? 'return_' + id : '';
  }

  function appendSection(lines, section) {
    lines.push('');
    lines.push('@' + section.id);
    if (section.title) {
      lines.push('= ' + section.title);
      lines.push('');
    }
    if (section.effects.length) {
      lines.push('on-arrival: {!');
      section.effects.forEach((effect) => lines.push(renderEffect(effect)));
      lines.push('!}');
      lines.push('');
    }
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
      appendOption(lines, option);
    });
    if (!section.options.length && section.exitTarget) {
      lines.push('go-to: ' + section.exitTarget);
    }
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

  function buildExportBundle(input, projectIndex) {
    const validation = validateDraft(input, projectIndex);
    const draft = validation.draft;
    const scene = renderSceneDry(draft, projectIndex);
    const draftJson = JSON.stringify(draft, null, 2) + '\n';
    const lane = draft.cardKind === 'advisor_like' ? 'Advisor-like' : 'Action card';
    const suggestedPath = suggestedCardPath(draft, projectIndex);
    const wiring = cardWiringProposal(draft, projectIndex, suggestedPath);
    const installApi = installPlanApi();
    const plan = installApi.cardInstallPlan({
      id: draft.id,
      title: draft.title,
      cardKind: draft.cardKind,
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
      suggestedPath,
      scene,
      wiringPath: wiring.path,
      wiringProposal: wiring.content,
      wiringOperation: wiring.operation,
      skipWiringManual: wiring.autoRouted,
      assetInstallRequests: draft.assetInstallRequests
    });
    const installPlanJson = installApi.renderInstallPlanJson(plan);
    const patchPreview = installApi.renderPatchPreview(plan);
    const installChecklist = installApi.renderOperationChecklist(plan);
    const files = [
      {path: draft.id + '.scene.dry', content: scene, kind: 'scene'},
      {path: draft.id + '.card-draft.json', content: draftJson, kind: 'draft'},
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
      '- Review ' + draft.id + '.scene.dry as a new ' + lane + ' scene.',
      '- Keep ' + draft.id + '.card-draft.json if you want to reopen this draft later.',
      '- Review ' + draft.id + '.patch-preview.diff before applying any safe operation.',
      '- Review the install operation checklist before deciding what to apply.',
      '',
      'Where to copy/paste:',
      '- Suggested source path: ' + suggestedPath,
      wiring.autoRouted
        ? '- Existing tag route: #' + wiring.route.tag + ' at ' + sourceLabel(wiring.route.source) + '. No hand/deck/sidebar edit is needed.'
        : wiring.operation
        ? '- Structured wiring operation: ' + wiring.operation.path + ' after ' + sourceLabel({path: wiring.operation.path, line: wiring.operation.line}) + '.'
        : '- Wiring review path: ' + wiring.path,
      wiring.autoRouted
        ? '- The generated scene uses an already-routed tag, so Studio can install the file without a manual wiring step.'
        : wiring.operation
        ? '- Studio can add a guarded source-backed tag route for this card.'
        : '- Wire the scene into the matching hand/deck/sidebar flow by hand.',
      '',
      'Variables/init/migration:',
      '- No new Q variables are generated by CardDraft v0.1. Unknown effect variables are rejected before export.',
      '',
      'Validation command:',
      'bash tools/build_and_validate.sh --skip-build --errors-only',
      '',
      'Studio source review:',
      wiring.autoRouted
        ? '- No manual hand/deck/sidebar wiring step was generated because the ProjectIndex already routes this tag.'
        : wiring.operation
        ? '- No manual hand/deck/sidebar wiring step was generated because Studio found an exact source anchor for a guarded tag route.'
        : '- Install Assistant can dry-run safe create-file operations, but hand/deck/sidebar wiring remains manual review.',
      wiring.autoRouted ? '' : '- Wiring proposal:',
      wiring.autoRouted ? '' : indent(wiring.content.trim(), '  '),
      '- Use the source path above as a proposal until the card flow is wired.'
    ].filter((line) => line !== '').join('\n') + '\n';
    files[4].content = installNotes;
    return {
      draft,
      diagnostics: validation.diagnostics,
      ok: validation.ok,
      files,
      scene,
      draftJson,
      rootSnippet: '',
      migrationSnippet: '',
      installPlan: plan,
      installPlanJson,
      patchPreview,
      installChecklist,
      installNotes,
      wiringProposal: wiring
    };
  }

  function cardWiringProposal(draft, projectIndex, suggestedPath) {
    const hands = ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.hands);
    const handPath = (hands[0] && hands[0].path) || 'source/scenes/main.scene.dry';
    const label = advisorLikeLabel(projectIndex);
    const primaryTag = draft.tags[0] || (draft.cardKind === 'advisor_like' ? 'circle' : 'cards');
    const route = existingTagRoute(draft, projectIndex, primaryTag);
    const operation = !route && draft.tags.length
      ? cardWiringOperation(draft, projectIndex, primaryTag)
      : null;
    const lines = [
      'Card wiring proposal',
      'New card id: ' + draft.id,
      'Scene proposal: ' + suggestedPath,
      'Manual review path: ' + handPath,
      ''
    ];
    if (route) {
      lines.push(
        'Existing tag route found: #' + route.tag,
        'Route evidence: ' + sourceLabel(route.source),
        'No manual hand/deck/sidebar wiring step is needed as long as the generated scene keeps this tag.'
      );
      return {path: route.source.path || handPath, content: lines.join('\n') + '\n', autoRouted: true, route};
    }
    if (operation) {
      lines.push(
        operation.kind === 'advisor_tag_route'
          ? 'Lane: pinned ' + label.plural + ' / advisor-like cards.'
          : 'Lane: action-card deck tag route.',
        'Structured operation: insert ' + operation.content.trim() + ' into ' + operation.path + '.',
        'Route evidence: ' + sourceLabel({path: operation.path, line: operation.line}),
        'Studio can guarded-apply this source-backed wiring after checking the anchor and dedupe token.'
      );
      return {path: operation.path, content: lines.join('\n') + '\n', autoRouted: false, route: null, operation};
    }
    if (draft.cardKind === 'advisor_like') {
      lines.push(
        'Lane: pinned ' + label.plural + ' / advisor-like cards.',
        'Review the hand scene and keep this card in the pinned/advisor lane.',
        'Search for the existing pinned-card lane marker:',
        '- #circle',
        '',
        'If this project uses a different advisor-like lane name, add the generated scene to that lane by hand.'
      );
    } else {
      lines.push(
        'Lane: action-card hand/deck entry.',
        'Review the hand scene and add the generated scene to the matching tag/deck lane.',
        'Suggested tag/deck evidence from this draft:',
        '- #' + primaryTag,
        '',
        'If the card should appear directly in hand instead of through a tag/deck, add:',
        '- @' + draft.id
      );
    }
    return {path: handPath, content: lines.join('\n') + '\n', autoRouted: false, route: null};
  }

  function cardWiringOperation(draft, projectIndex, primaryTag) {
    return draft.cardKind === 'advisor_like'
      ? advisorTagRouteOperation(draft, projectIndex, primaryTag)
      : deckTagRouteOperation(draft, projectIndex, primaryTag);
  }

  function deckTagRouteOperation(draft, projectIndex, primaryTag) {
    const deck = firstSourceBackedDeck(projectIndex);
    const anchor = lastSourceBackedOption(deck) || sourceEndAnchor(deck);
    if (!deck || !anchor || !primaryTag) {
      return null;
    }
    const content = '- #' + primaryTag + '\n';
    return {
      id: 'card_deck_tag_route',
      type: 'insert_text',
      path: anchor.path,
      line: anchor.line,
      anchorText: anchor.anchorText,
      position: 'after',
      content,
      dedupeSearch: '- #' + primaryTag,
      safety: 'guarded_apply',
      kind: 'deck_tag_route',
      description: 'Wire the generated card into the source-backed deck by inserting its tag route after the detected deck anchor.'
    };
  }

  function advisorTagRouteOperation(draft, projectIndex, primaryTag) {
    const hand = firstSourceBackedHand(projectIndex);
    const anchor = advisorHandAnchor(hand);
    if (!hand || !anchor || !primaryTag) {
      return null;
    }
    const content = '- #' + primaryTag + ': ' + advisorRouteLabel(draft) + '\n';
    return {
      id: 'card_advisor_tag_route',
      type: 'insert_text',
      path: anchor.path,
      line: anchor.line,
      anchorText: anchor.anchorText,
      position: anchor.position,
      content,
      dedupeSearch: '- #' + primaryTag,
      safety: 'guarded_apply',
      kind: 'advisor_tag_route',
      description: 'Wire the generated advisor-like card into the source-backed hand by inserting its tag route near the detected advisor lane.'
    };
  }

  function firstSourceBackedDeck(projectIndex) {
    const deckIds = ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.decks)
      .map((deck) => String(deck && deck.id || '').trim())
      .filter(Boolean);
    const scenes = ensureArray(projectIndex && projectIndex.scenes);
    return scenes.find((scene) => scene && deckIds.includes(String(scene.id || '')) && scene.path) ||
      scenes.find((scene) => scene && String(scene.type || '') === 'deck' && scene.path) ||
      null;
  }

  function firstSourceBackedHand(projectIndex) {
    const handIds = ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.hands)
      .map((hand) => String(hand && hand.id || '').trim())
      .filter(Boolean);
    const scenes = ensureArray(projectIndex && projectIndex.scenes);
    return scenes.find((scene) => scene && handIds.includes(String(scene.id || '')) && scene.path) ||
      scenes.find((scene) => scene && String(scene.type || '') === 'hand' && scene.path) ||
      null;
  }

  function lastSourceBackedOption(scene) {
    const options = ensureArray(scene && scene.options).filter((option) => optionSourceAnchor(option));
    return options.length ? optionSourceAnchor(options[options.length - 1]) : null;
  }

  function advisorHandAnchor(hand) {
    const tagOptions = ensureArray(hand && hand.options)
      .filter((option) => option && option.target && option.target.kind === 'tag')
      .map(optionSourceAnchor)
      .filter(Boolean);
    if (tagOptions.length) {
      return Object.assign({}, tagOptions[tagOptions.length - 1], {position: 'after'});
    }
    const rootOption = ensureArray(hand && hand.options).find((option) => option && option.target && option.target.kind === 'scene' && option.target.id === 'root');
    const rootAnchor = optionSourceAnchor(rootOption);
    if (rootAnchor) {
      return Object.assign({}, rootAnchor, {position: 'before'});
    }
    const endAnchor = sourceEndAnchor(hand);
    return endAnchor ? Object.assign({}, endAnchor, {position: 'after'}) : null;
  }

  function optionSourceAnchor(option) {
    const source = option && option.sourceSpan;
    const path = String(source && source.path || '').trim();
    const line = Number(source && (source.line || source.startLine) || 0);
    const anchorText = String(source && source.anchorText || '').trim();
    if (!path || !Number.isInteger(line) || line < 1 || !anchorText) {
      return null;
    }
    return {path, line, anchorText, position: 'after'};
  }

  function sourceEndAnchor(scene) {
    const source = scene && scene.sourceSpan;
    const path = String(source && source.path || scene && scene.path || '').trim();
    const line = Number(source && (source.endLine || source.line || source.startLine) || 0);
    const anchorText = String(source && (source.endAnchorText || source.anchorText) || '').trim();
    if (!path || !Number.isInteger(line) || line < 1 || !anchorText) {
      return null;
    }
    return {path, line, anchorText, position: 'after'};
  }

  function advisorRouteLabel(draft) {
    return 'Review ' + (draft.title || draft.heading || draft.id || 'advisor');
  }

  function suggestedCardPath(draft, projectIndex) {
    const existingLane = matchingLaneScene(draft, projectIndex);
    const existingDir = sceneDirectory(existingLane && existingLane.path);
    if (existingDir) {
      return existingDir + '/' + draft.id + '.scene.dry';
    }
    return draft.cardKind === 'advisor_like'
      ? 'source/scenes/circles/' + draft.id + '.scene.dry'
      : 'source/scenes/cards/' + draft.id + '.scene.dry';
  }

  function matchingLaneScene(draft, projectIndex) {
    const tags = new Set((draft.tags || []).map(String).filter(Boolean));
    if (!tags.size) {
      return null;
    }
    const wantedTypes = draft.cardKind === 'advisor_like'
      ? new Set(['pinned_card', 'advisor', 'circle'])
      : new Set(['card']);
    return ensureArray(projectIndex && projectIndex.scenes).find((scene) => {
      if (!scene || !scene.path || !String(scene.path).startsWith('source/scenes/')) {
        return false;
      }
      const sceneType = String(scene.type || '');
      if (!wantedTypes.has(sceneType)) {
        return false;
      }
      return ensureArray(scene.tags).some((tag) => tags.has(String(tag)));
    }) || null;
  }

  function sceneDirectory(sourcePath) {
    const normalized = String(sourcePath || '').replace(/\\/g, '/');
    const match = normalized.match(/^(source\/scenes\/.+)\/[^/]+\.scene\.dry$/);
    return match ? match[1] : '';
  }

  function existingTagRoute(draft, projectIndex, fallbackTag) {
    const tags = new Set((draft.tags.length ? draft.tags : [fallbackTag]).map(String).filter(Boolean));
    const scenes = ensureArray(projectIndex && projectIndex.scenes);
    for (const scene of scenes) {
      const option = findTagOption(scene, tags);
      if (option) {
        return option;
      }
    }
    return null;
  }

  function findTagOption(scene, tags) {
    const buckets = [scene].concat(ensureArray(scene && scene.sections));
    for (const bucket of buckets) {
      for (const option of ensureArray(bucket && bucket.options)) {
        const target = option && option.target;
        const tag = target && target.kind === 'tag' ? String(target.id || '') : '';
        if (tag && tags.has(tag)) {
          return {tag, source: option.sourceSpan || bucket.sourceSpan || scene.sourceSpan || {path: scene.path || ''}};
        }
      }
    }
    return null;
  }

  function advisorLikeLabel(projectIndex) {
    const defaults = {singular: 'Advisor', plural: 'Advisors'};
    const activeIds = new Set(ensureArray(projectIndex && projectIndex.project && projectIndex.project.profileIds).map(String));
    return ensureArray(projectIndex && projectIndex.profiles).reduce((labels, profile) => {
      if (activeIds.size && !activeIds.has(String(profile.id || ''))) {
        return labels;
      }
      const uiLabels = isObject(profile.uiLabels) ? profile.uiLabels : {};
      return {
        singular: uiLabels.advisorLikeSingular || labels.singular,
        plural: uiLabels.advisorLikePlural || labels.plural
      };
    }, defaults);
  }

  function indent(text, prefix) {
    return String(text || '').split('\n').map((line) => prefix + line).join('\n');
  }

  function sourceLabel(source) {
    const ref = isObject(source) ? source : {};
    const path = String(ref.path || '').trim();
    const line = ref.startLine || ref.line;
    return path + (line ? ':' + line : '');
  }

  const api = {
    CARD_DRAFT_VERSION,
    normalizeDraft,
    validateDraft,
    renderSceneDry,
    buildExportBundle,
    build: buildExportBundle,
    generate: buildExportBundle,
    cardWiringProposal,
    renderEffect
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapCardDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
