(function initWorkspaceLayoutDraft(global) {
  'use strict';

  const WORKSPACE_LAYOUT_VERSION = '0.2';
  const WORKSPACE_LAYOUT_KIND = 'workspace_layout';
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const HAND_INSERT_MODES = new Set(['auto', 'before_root', 'after_last', 'before_option', 'after_option']);
  const SIDEBAR_INSERT_MODES = new Set(['auto', 'before_politics', 'before_category', 'after_category']);

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function installPlanApi() {
    if (global && global.ProjectMapInstallPlan) {
      return global.ProjectMapInstallPlan;
    }
    if (typeof require === 'function') {
      try {
        return require('./install_plan.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function buildLayoutModel(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const scenes = ensureArray(index.scenes);
    const hand = sceneSummary(firstScene(scenes, ['hand']) || sceneBySemantic(index, scenes, 'hands'));
    const status = sceneSummary(statusScene(index, scenes));
    const decks = scenes.filter((scene) => isSceneType(scene, ['deck'])).map(sceneSummary).filter((scene) => scene.exists);
    const handInsert = handInsertEvidence(hand);
    const sidebarInsert = sidebarInsertEvidence(status);
    return {
      schemaVersion: WORKSPACE_LAYOUT_VERSION,
      kind: 'workspace_layout_model',
      project: index.project || null,
      hand,
      status,
      decks,
      handInsert,
      sidebarInsert,
      handInsertChoices: handInsertChoices(hand),
      sidebarInsertChoices: sidebarInsertChoices(status),
      sceneIds: scenes.map((scene) => String(scene.id || '')).filter(Boolean),
      sidebarCategoryIds: status.sections.map((section) => section.anchorId).filter(Boolean),
      variableIds: variableIds(index),
      readiness: [
        readinessRow('hand', hand.exists && handInsert, 'Hand route anchor', hand.exists ? 'Source-backed hand scene detected.' : 'No source-backed hand scene detected.'),
        readinessRow('status', status.exists && sidebarInsert, 'Sidebar category anchor', status.exists ? 'Source-backed sidebar/status scene detected.' : 'No source-backed sidebar/status scene detected.')
      ]
    };
  }

  function defaultDraft(projectIndex) {
    const model = buildLayoutModel(projectIndex);
    return normalizeDraft({
      id: 'workspace_layout_update',
      title: 'Workspace Layout Update',
      deckId: 'policy_deck',
      deckTitle: 'Policy Deck',
      deckSubtitle: 'Repeatable policy work',
      deckTag: 'policy_action',
      handOptionLabel: 'Open policy deck',
      handInsertMode: 'before_root',
      handAnchorId: '',
      sidebarCategoryId: 'policy',
      sidebarHeading: 'Policy Desk',
      sidebarBody: 'Use this section for policy lanes, campaign promises, research, or issue-specific work.',
      sidebarStatusLines: '[? if policy_momentum > 0 : Policy work has started moving through the deck. ?]',
      sidebarInsertMode: 'before_category',
      sidebarAnchorId: 'politics',
      createStarterCard: true,
      starterCardId: 'policy_starter_card',
      starterCardTitle: 'Policy Starter Card',
      starterCardHeading: 'Plan the first policy push',
      starterCardBody: 'The team chooses whether to turn capacity into public momentum or save it for later work.',
      starterCardOption0Label: 'Build public momentum',
      starterCardOption0Variable: 'policy_momentum',
      starterCardOption0Delta: '1',
      starterCardOption1Label: 'Save capacity',
      starterCardOption1Variable: 'policy_capacity',
      starterCardOption1Delta: '1',
      starterCardReturnTarget: model.hand && model.hand.id || 'main',
      evidence: model
    });
  }

  function normalizeDraft(input) {
    const draft = isObject(input) ? clone(input) : {};
    draft.schemaVersion = String(draft.schemaVersion || WORKSPACE_LAYOUT_VERSION);
    draft.kind = WORKSPACE_LAYOUT_KIND;
    draft.id = safeId(draft.id || 'workspace_layout_update');
    draft.title = String(draft.title || 'Workspace Layout Update').trim();
    [
      'deckId',
      'deckTitle',
      'deckSubtitle',
      'deckTag',
      'handOptionLabel',
      'handAnchorId',
      'sidebarCategoryId',
      'sidebarHeading',
      'sidebarBody',
      'sidebarStatusLines',
      'sidebarAnchorId',
      'starterCardId',
      'starterCardTitle',
      'starterCardHeading',
      'starterCardBody',
      'starterCardOption0Label',
      'starterCardOption0Variable',
      'starterCardOption0Delta',
      'starterCardOption1Label',
      'starterCardOption1Variable',
      'starterCardOption1Delta',
      'starterCardReturnTarget'
    ].forEach((key) => {
      draft[key] = String(draft[key] || '').trim();
    });
    draft.handInsertMode = normalizeChoice(draft.handInsertMode, HAND_INSERT_MODES, 'auto');
    draft.sidebarInsertMode = normalizeChoice(draft.sidebarInsertMode, SIDEBAR_INSERT_MODES, 'auto');
    draft.createStarterCard = booleanValue(draft.createStarterCard);
    if (!draft.starterCardId) {
      draft.starterCardId = draft.deckId ? draft.deckId + '_starter_card' : 'starter_action_card';
    }
    if (!draft.starterCardTitle) {
      draft.starterCardTitle = draft.deckTitle ? draft.deckTitle + ' Starter Card' : 'Starter Card';
    }
    if (!draft.starterCardHeading) {
      draft.starterCardHeading = draft.starterCardTitle;
    }
    if (!draft.starterCardBody) {
      draft.starterCardBody = 'Choose how this new workspace lane changes the project state.';
    }
    if (!draft.starterCardOption0Label) {
      draft.starterCardOption0Label = 'Take action';
    }
    if (!draft.starterCardOption0Variable) {
      draft.starterCardOption0Variable = draft.sidebarCategoryId ? draft.sidebarCategoryId + '_progress' : 'workspace_progress';
    }
    if (!draft.starterCardOption0Delta) {
      draft.starterCardOption0Delta = '1';
    }
    if (!draft.starterCardOption1Label) {
      draft.starterCardOption1Label = 'Hold capacity';
    }
    if (!draft.starterCardOption1Variable) {
      draft.starterCardOption1Variable = draft.sidebarCategoryId ? draft.sidebarCategoryId + '_capacity' : 'workspace_capacity';
    }
    if (!draft.starterCardOption1Delta) {
      draft.starterCardOption1Delta = '1';
    }
    if (!draft.starterCardReturnTarget) {
      draft.starterCardReturnTarget = 'main';
    }
    draft.evidence = isObject(draft.evidence) ? draft.evidence : {};
    return draft;
  }

  function validateDraft(input, projectIndex) {
    const draft = normalizeDraft(input);
    const evidence = usableEvidence(draft.evidence) ? draft.evidence : buildLayoutModel(projectIndex);
    const diagnostics = [];
    if (!ID_RE.test(draft.id)) {
      diagnostic(diagnostics, 'error', 'workspace_layout.id', 'Workspace Layout draft id must be file-safe.');
    }
    if (!ID_RE.test(draft.deckId)) {
      diagnostic(diagnostics, 'error', 'workspace_layout.deck_id', 'Deck id must be a valid scene id.');
    }
    if (!ID_RE.test(draft.deckTag)) {
      diagnostic(diagnostics, 'error', 'workspace_layout.deck_tag', 'Deck tag must be a valid tag id.');
    }
    if (!ID_RE.test(draft.sidebarCategoryId)) {
      diagnostic(diagnostics, 'error', 'workspace_layout.sidebar_category_id', 'Sidebar category id must be a valid section id.');
    }
    if (!draft.title) {
      diagnostic(diagnostics, 'error', 'workspace_layout.title', 'Draft title is required.');
    }
    if (!draft.deckTitle) {
      diagnostic(diagnostics, 'error', 'workspace_layout.deck_title', 'Deck title is required.');
    }
    if (!draft.handOptionLabel) {
      diagnostic(diagnostics, 'error', 'workspace_layout.hand_option', 'Hand option label is required.');
    }
    if (!draft.sidebarHeading) {
      diagnostic(diagnostics, 'warning', 'workspace_layout.sidebar_heading', 'Sidebar category heading is empty.');
    }
    const sceneIds = new Set(ensureArray(evidence.sceneIds).map(String));
    if (sceneIds.has(draft.deckId)) {
      diagnostic(diagnostics, 'error', 'workspace_layout.duplicate_deck', 'Deck scene id already exists: ' + draft.deckId);
    }
    const categoryIds = new Set(ensureArray(evidence.sidebarCategoryIds).map(String));
    if (categoryIds.has(draft.sidebarCategoryId)) {
      diagnostic(diagnostics, 'error', 'workspace_layout.duplicate_sidebar_category', 'Sidebar category already exists: ' + draft.sidebarCategoryId);
    }
    const selectedHandInsert = selectHandInsertEvidence(evidence, draft);
    const selectedSidebarInsert = selectSidebarInsertEvidence(evidence, draft);
    if (!isObject(evidence.hand) || !evidence.hand.exists || !selectedHandInsert) {
      diagnostic(diagnostics, 'warning', 'workspace_layout.hand_missing', 'No source-backed hand insertion anchor was detected.');
    }
    if (!isObject(evidence.status) || !evidence.status.exists || !selectedSidebarInsert) {
      diagnostic(diagnostics, 'warning', 'workspace_layout.sidebar_missing', 'No source-backed sidebar category insertion anchor was detected.');
    }
    if (draft.createStarterCard) {
      if (!ID_RE.test(draft.starterCardId)) {
        diagnostic(diagnostics, 'error', 'workspace_layout.starter_card_id', 'Starter card id must be a valid scene id.');
      }
      if (draft.starterCardId === draft.deckId || sceneIds.has(draft.starterCardId)) {
        diagnostic(diagnostics, 'error', 'workspace_layout.duplicate_starter_card', 'Starter card scene id already exists: ' + draft.starterCardId);
      }
      if (!draft.starterCardTitle) {
        diagnostic(diagnostics, 'error', 'workspace_layout.starter_card_title', 'Starter card title is required.');
      }
      if (!draft.starterCardOption0Label || !draft.starterCardOption1Label) {
        diagnostic(diagnostics, 'error', 'workspace_layout.starter_card_options', 'Starter card options need player-facing labels.');
      }
      validateStarterEffect(draft.starterCardOption0Variable, draft.starterCardOption0Delta, 'option 1', diagnostics);
      validateStarterEffect(draft.starterCardOption1Variable, draft.starterCardOption1Delta, 'option 2', diagnostics);
      if (!ID_RE.test(draft.starterCardReturnTarget)) {
        diagnostic(diagnostics, 'error', 'workspace_layout.starter_card_return', 'Starter card return target must be a valid scene id.');
      }
    }
    draft.evidence = evidence;
    return {ok: diagnostics.every((item) => item.severity !== 'error'), draft, diagnostics};
  }

  function buildExportBundle(input, projectIndex) {
    const validation = validateDraft(input, projectIndex);
    const draft = validation.draft;
    const plan = buildInstallPlan(draft, projectIndex);
    const installApi = installPlanApi();
    const installPlanJson = installApi.renderInstallPlanJson(plan);
    const patchPreview = installApi.renderPatchPreview(plan);
    const installChecklist = installApi.renderOperationChecklist(plan);
    const draftJson = JSON.stringify(draft, null, 2) + '\n';
    const playerPreview = renderPlayerPreview(draft);
    const installNotes = renderInstallNotes(draft, plan);
    const files = [
      {path: draft.id + '.workspace-layout-draft.json', content: draftJson, kind: 'draft'},
      {path: draft.deckId + '.scene.dry', content: renderDeckScene(draft), kind: 'scene'}
    ];
    if (draft.createStarterCard) {
      files.push({path: draft.starterCardId + '.scene.dry', content: renderStarterCardScene(draft), kind: 'scene'});
    }
    files.push(
      {path: draft.id + '.install-plan.json', content: installPlanJson, kind: 'install_plan'},
      {path: draft.id + '.patch-preview.diff', content: patchPreview, kind: 'patch_preview'},
      {path: draft.id + '.install-notes.txt', content: installNotes, kind: 'notes'}
    );
    return {
      ok: validation.ok,
      draft,
      diagnostics: validation.diagnostics,
      files,
      playerPreview,
      previewText: playerPreview,
      deckScene: renderDeckScene(draft),
      starterCardScene: draft.createStarterCard ? renderStarterCardScene(draft) : '',
      sidebarCategory: renderSidebarCategory(draft),
      draftJson,
      installPlan: plan,
      installPlanJson,
      patchPreview,
      installChecklist,
      installNotes
    };
  }

  function buildInstallPlan(input, projectIndex) {
    const installApi = installPlanApi();
    const draft = normalizeDraft(input);
    const evidence = usableEvidence(draft.evidence) ? draft.evidence : buildLayoutModel(projectIndex);
    const handInsert = selectHandInsertEvidence(evidence, draft);
    const sidebarInsert = selectSidebarInsertEvidence(evidence, draft);
    const operations = [];
    operations.push({
      id: 'create_deck_scene',
      type: 'create_file',
      path: 'source/scenes/decks/' + draft.deckId + '.scene.dry',
      content: renderDeckScene(draft),
      safety: 'safe_apply',
      role: 'workspace_layout.deck',
      description: 'Create a new source-backed deck lane.'
    });
    if (draft.createStarterCard) {
      operations.push({
        id: 'create_starter_card',
        type: 'create_file',
        path: 'source/scenes/cards/' + draft.starterCardId + '.scene.dry',
        content: renderStarterCardScene(draft),
        safety: 'safe_apply',
        role: 'workspace_layout.starter_card',
        description: 'Create a first card tagged for the new deck lane.'
      });
    }
    if (handInsert && handInsert.path && handInsert.anchorText) {
      operations.push({
        id: 'hand_deck_route',
        type: 'insert_text',
        path: handInsert.path,
        anchorText: handInsert.anchorText,
        position: handInsert.position || 'before',
        content: '- @' + draft.deckId + ': ' + draft.handOptionLabel + '\n',
        dedupeSearch: '@' + draft.deckId,
        safety: 'guarded_apply',
        role: 'workspace_layout.hand_deck',
        description: 'Insert the new deck route into the source-backed hand scene after matching an exact option anchor.'
      });
    } else {
      operations.push({
        id: 'hand_deck_route_manual',
        type: 'manual_snippet',
        path: evidence.hand && evidence.hand.path || 'source/scenes/main.scene.dry',
        content: '- @' + draft.deckId + ': ' + draft.handOptionLabel + '\n',
        safety: 'manual_review',
        role: 'workspace_layout.hand_deck',
        description: 'Review the hand scene and add the new deck route manually.'
      });
    }
    if (sidebarInsert && sidebarInsert.path && sidebarInsert.anchorText) {
      operations.push({
        id: 'sidebar_category',
        type: 'insert_text',
        path: sidebarInsert.path,
        anchorText: sidebarInsert.anchorText,
        position: sidebarInsert.position || 'before',
        content: renderSidebarCategory(draft),
        dedupeSearch: '@' + draft.sidebarCategoryId,
        safety: 'guarded_apply',
        role: 'workspace_layout.sidebar_category',
        description: 'Insert the new sidebar/status category next to source-backed status sections.'
      });
    } else {
      operations.push({
        id: 'sidebar_category_manual',
        type: 'manual_snippet',
        path: evidence.status && evidence.status.path || 'source/scenes/status.scene.dry',
        content: renderSidebarCategory(draft),
        safety: 'manual_review',
        role: 'workspace_layout.sidebar_category',
        description: 'Review the status/sidebar scene and add the category manually.'
      });
    }
    return installApi.buildInstallPlan({
      id: draft.id,
      draftKind: WORKSPACE_LAYOUT_KIND,
      title: draft.title || draft.id,
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
      operations
    });
  }

  function renderDeckScene(draft) {
    const lines = [
      'title: ' + draft.deckTitle,
      draft.deckSubtitle ? 'subtitle: ' + draft.deckSubtitle : '',
      'is-deck: true',
      '',
      '- #' + draft.deckTag
    ].filter((line, index) => index === 1 ? Boolean(line) : true);
    return lines.join('\n') + '\n';
  }

  function renderStarterCardScene(draft) {
    const lines = [
      'title: ' + draft.starterCardTitle,
      'new-page: true',
      'is-card: true',
      'tags: ' + draft.deckTag,
      'frequency: 100',
      'priority: 0',
      '',
      '= ' + draft.starterCardHeading,
      '',
      draft.starterCardBody,
      '',
      '- @take_action: ' + draft.starterCardOption0Label,
      '- @hold_capacity: ' + draft.starterCardOption1Label,
      ''
    ];
    appendStarterCardChoice(lines, 'take_action', draft.starterCardOption0Label, draft.starterCardOption0Variable, draft.starterCardOption0Delta, draft.starterCardReturnTarget);
    appendStarterCardChoice(lines, 'hold_capacity', draft.starterCardOption1Label, draft.starterCardOption1Variable, draft.starterCardOption1Delta, draft.starterCardReturnTarget);
    return lines.join('\n') + '\n';
  }

  function appendStarterCardChoice(lines, sectionId, label, variable, delta, returnTarget) {
    lines.push('@' + sectionId);
    lines.push('title: ' + label);
    if (variable) {
      lines.push('on-arrival: {!');
      lines.push(renderStarterEffect(variable, delta));
      lines.push('!}');
    }
    lines.push('go-to: ' + (returnTarget || 'main'));
    lines.push('');
    lines.push(label + '.');
    lines.push('');
  }

  function renderStarterEffect(variable, delta) {
    const amount = Number(delta);
    const numericDelta = Number.isFinite(amount) ? amount : 0;
    const op = numericDelta < 0 ? '- ' + Math.abs(numericDelta) : '+ ' + numericDelta;
    return 'Q.' + variable + ' = (Q.' + variable + ' || 0) ' + op + ';';
  }

  function renderSidebarCategory(draft) {
    return [
      '@' + draft.sidebarCategoryId,
      '',
      '= ' + draft.sidebarHeading,
      '',
      draft.sidebarBody,
      '',
      draft.sidebarStatusLines,
      ''
    ].filter((line, index) => index < 6 || String(line || '').trim()).join('\n') + '\n';
  }

  function renderPlayerPreview(draft) {
    return [
      'Workspace layout',
      '',
      'Hand option: ' + draft.handOptionLabel,
      'Deck: ' + draft.deckTitle,
      draft.deckSubtitle || '',
      'Deck tag: #' + draft.deckTag,
      draft.createStarterCard ? 'Starter card: ' + draft.starterCardTitle : '',
      draft.createStarterCard ? '  - ' + draft.starterCardOption0Label + ': ' + starterEffectPreview(draft.starterCardOption0Variable, draft.starterCardOption0Delta) : '',
      draft.createStarterCard ? '  - ' + draft.starterCardOption1Label + ': ' + starterEffectPreview(draft.starterCardOption1Variable, draft.starterCardOption1Delta) : '',
      '',
      'Sidebar category: ' + draft.sidebarHeading,
      draft.sidebarBody || '',
      draft.sidebarStatusLines || ''
    ].filter((line) => line !== '').join('\n') + '\n';
  }

  function renderInstallNotes(draft, plan) {
    const summary = plan && plan.operations ? plan.operations.length : 0;
    return [
      'Install Assistant: workspace layout proposal',
      '',
      'Operations: ' + summary,
      '- Create deck lane: source/scenes/decks/' + draft.deckId + '.scene.dry',
      draft.createStarterCard ? '- Create starter card: source/scenes/cards/' + draft.starterCardId + '.scene.dry' : '',
      '- Add hand route: - @' + draft.deckId + ': ' + draft.handOptionLabel,
      '- Add sidebar category: @' + draft.sidebarCategoryId,
      '',
      'Safety:',
      '- Deck creation is safe only in source/scenes/decks/.',
      '- Hand/sidebar inserts require exact source anchors and dedupe tokens.',
      '- If anchors are missing, Studio keeps the change as manual review.'
    ].filter((line) => line !== '').join('\n') + '\n';
  }

  function firstScene(scenes, types) {
    return ensureArray(scenes).find((scene) => isSceneType(scene, types)) || null;
  }

  function sceneBySemantic(index, scenes, key) {
    const ids = ensureArray(index.semantic && index.semantic[key]).map((item) => String(item && item.id || item || ''));
    return ensureArray(scenes).find((scene) => ids.includes(String(scene.id || ''))) || null;
  }

  function statusScene(index, scenes) {
    return ensureArray(scenes).find((scene) => String(scene.path || '') === 'source/scenes/status.scene.dry') ||
      ensureArray(scenes).find((scene) => /^source\/scenes\/status[_A-Za-z0-9.-]*\.scene\.dry$/.test(String(scene.path || ''))) ||
      sceneBySemantic(index, scenes, 'status') ||
      null;
  }

  function isSceneType(scene, types) {
    const wanted = new Set(types);
    const flags = scene && scene.flags || {};
    const type = String(scene && scene.type || '').toLowerCase();
    return wanted.has(type) ||
      (wanted.has('hand') && flags.isHand) ||
      (wanted.has('deck') && flags.isDeck) ||
      (wanted.has('card') && flags.isCard) ||
      (wanted.has('pinned_card') && flags.isPinnedCard);
  }

  function sceneSummary(scene) {
    if (!scene) {
      return {exists: false, sections: [], options: []};
    }
    const sections = ensureArray(scene.sections).map((section) => {
      const id = String(section.id || '');
      const anchorId = id.includes('.') ? id.split('.').pop() : id;
      return {
        id,
        anchorId,
        path: section.sourceSpan && section.sourceSpan.path || scene.path || '',
        line: section.sourceSpan && section.sourceSpan.startLine || null
      };
    });
    const options = ensureArray(scene.options).map((option) => ({
      id: String(option.id || ''),
      title: String(option.title || ''),
      target: option.target || null,
      path: option.sourceSpan && option.sourceSpan.path || scene.path || '',
      line: option.sourceSpan && option.sourceSpan.startLine || null
    }));
    return {
      exists: true,
      id: String(scene.id || ''),
      title: String(scene.title || ''),
      path: String(scene.path || ''),
      type: String(scene.type || ''),
      sections,
      options
    };
  }

  function handInsertEvidence(hand) {
    if (!hand || !hand.exists || !hand.path || !hand.options.length) {
      return null;
    }
    const backOption = hand.options.find((option) => option.target && option.target.kind === 'scene' && option.target.id === 'root') ||
      hand.options.find((option) => option.id === '@root');
    const target = backOption || hand.options[hand.options.length - 1];
    if (!target || !target.id) {
      return null;
    }
    return {
      path: target.path || hand.path,
      anchorText: optionLine(target),
      position: backOption ? 'before' : 'after',
      sourceLine: target.line || null
    };
  }

  function sidebarInsertEvidence(status) {
    if (!status || !status.exists || !status.path || !status.sections.length) {
      return null;
    }
    const politics = status.sections.find((section) => section.anchorId === 'politics');
    const target = politics || status.sections[status.sections.length - 1];
    if (!target || !target.anchorId) {
      return null;
    }
    return {
      path: target.path || status.path,
      anchorText: '@' + target.anchorId,
      position: politics ? 'before' : 'after',
      sourceLine: target.line || null
    };
  }

  function handInsertChoices(hand) {
    if (!hand || !hand.exists) {
      return [];
    }
    return ensureArray(hand.options).map((option) => ({
      id: option.id,
      title: option.title,
      anchorText: optionLine(option),
      path: option.path || hand.path,
      line: option.line || null,
      isRoot: Boolean(option.target && option.target.kind === 'scene' && option.target.id === 'root') || option.id === '@root'
    })).filter((choice) => choice.id && choice.anchorText);
  }

  function sidebarInsertChoices(status) {
    if (!status || !status.exists) {
      return [];
    }
    return ensureArray(status.sections).map((section) => ({
      id: section.anchorId,
      anchorText: '@' + section.anchorId,
      path: section.path || status.path,
      line: section.line || null
    })).filter((choice) => choice.id);
  }

  function selectHandInsertEvidence(evidence, draft) {
    const mode = normalizeChoice(draft && draft.handInsertMode, HAND_INSERT_MODES, 'auto');
    if (mode === 'auto') {
      return evidence && evidence.handInsert || null;
    }
    const hand = evidence && evidence.hand;
    const options = hand && hand.options || [];
    let target = null;
    let position = 'before';
    if (mode === 'before_root') {
      target = options.find((option) => option.target && option.target.kind === 'scene' && option.target.id === 'root') ||
        options.find((option) => option.id === '@root') ||
        null;
      position = 'before';
    } else if (mode === 'after_last') {
      target = options[options.length - 1] || null;
      position = 'after';
    } else if (mode === 'before_option' || mode === 'after_option') {
      target = options.find((option) => option.id === draft.handAnchorId) || null;
      position = mode === 'before_option' ? 'before' : 'after';
    }
    if (!target || !target.id) {
      return null;
    }
    return {
      path: target.path || hand.path,
      anchorText: optionLine(target),
      position,
      sourceLine: target.line || null
    };
  }

  function selectSidebarInsertEvidence(evidence, draft) {
    const mode = normalizeChoice(draft && draft.sidebarInsertMode, SIDEBAR_INSERT_MODES, 'auto');
    if (mode === 'auto') {
      return evidence && evidence.sidebarInsert || null;
    }
    const status = evidence && evidence.status;
    const sections = status && status.sections || [];
    let target = null;
    if (mode === 'before_politics') {
      target = sections.find((section) => section.anchorId === 'politics') || null;
    } else if (mode === 'before_category') {
      target = sections.find((section) => section.anchorId === draft.sidebarAnchorId) || null;
    } else if (mode === 'after_category') {
      const index = sections.findIndex((section) => section.anchorId === draft.sidebarAnchorId);
      target = index >= 0 && index < sections.length - 1 ? sections[index + 1] : null;
    }
    if (!target || !target.anchorId) {
      return null;
    }
    return {
      path: target.path || status.path,
      anchorText: '@' + target.anchorId,
      position: 'before',
      sourceLine: target.line || null
    };
  }

  function optionLine(option) {
    const id = String(option && option.id || '');
    const title = String(option && option.title || '');
    return title ? '- ' + id + ': ' + title : '- ' + id;
  }

  function readinessRow(id, ready, label, message) {
    return {
      id,
      label,
      status: ready ? 'ready' : 'warning',
      message
    };
  }

  function validateStarterEffect(variable, delta, label, diagnostics) {
    if (!ID_RE.test(variable)) {
      diagnostic(diagnostics, 'error', 'workspace_layout.starter_card_effect_variable', 'Starter card ' + label + ' effect variable must be a valid Q variable name.');
    }
    if (!Number.isFinite(Number(delta))) {
      diagnostic(diagnostics, 'error', 'workspace_layout.starter_card_effect_delta', 'Starter card ' + label + ' effect delta must be numeric.');
    }
  }

  function starterEffectPreview(variable, delta) {
    return variable ? variable + ' ' + signedDelta(delta) : 'no variable change';
  }

  function signedDelta(delta) {
    const amount = Number(delta);
    if (!Number.isFinite(amount)) {
      return '+0';
    }
    return amount < 0 ? String(amount) : '+' + amount;
  }

  function variableIds(index) {
    return ensureArray(index && index.variables)
      .map((variable) => String(variable && variable.name || '').trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }

  function normalizeChoice(value, allowed, fallback) {
    const text = String(value || '').trim();
    return allowed.has(text) ? text : fallback;
  }

  function booleanValue(value) {
    return value === true || value === 1 || value === '1' || value === 'true' || value === 'on' || value === 'yes';
  }

  function usableEvidence(value) {
    return isObject(value) && value.kind === 'workspace_layout_model';
  }

  function diagnostic(diagnostics, severity, code, message) {
    diagnostics.push({severity, code, message, confidence: 'exact'});
  }

  function safeId(value) {
    let text = String(value || 'workspace_layout_update')
      .trim()
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!text) {
      text = 'workspace_layout_update';
    }
    if (/^[0-9]/.test(text)) {
      text = 'layout_' + text;
    }
    return ID_RE.test(text) ? text : 'workspace_layout_update';
  }

  const api = {
    WORKSPACE_LAYOUT_VERSION,
    WORKSPACE_LAYOUT_KIND,
    buildLayoutModel,
    defaultDraft,
    normalizeDraft,
    validateDraft,
    buildInstallPlan,
    buildExportBundle,
    renderDeckScene,
    renderStarterCardScene,
    renderSidebarCategory
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapWorkspaceLayoutDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
