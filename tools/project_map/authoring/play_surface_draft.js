(function initPlaySurfaceDraft(global) {
  'use strict';

  const PLAY_SURFACE_VERSION = '0.1';
  const PLAY_SURFACE_KIND = 'play_surface';
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

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

  function buildSurfaceModel(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const scenes = ensureArray(index.scenes);
    const textRows = ensureArray(index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items);
    const handScene = firstScene(scenes, ['hand']) || sceneBySemantic(index, scenes, 'hands');
    const deckScene = firstScene(scenes, ['deck']) || sceneBySemantic(index, scenes, 'decks');
    const cardScene = firstScene(scenes, ['card']) || sceneBySemantic(index, scenes, 'cards');
    const advisorScene = firstScene(scenes, ['pinned_card', 'circle']) || sceneBySemantic(index, scenes, 'pinnedCards');
    const hand = sceneSurface(handScene, textRows);
    const deck = sceneSurface(deckScene, textRows);
    const card = sceneSurface(cardScene, textRows);
    const advisor = sceneSurface(advisorScene, textRows);

    return {
      schemaVersion: PLAY_SURFACE_VERSION,
      kind: 'play_surface_model',
      project: index.project || null,
      hand,
      deck,
      card,
      advisor,
      readiness: [
        readinessRow('hand', hand, 'Hand scene'),
        readinessRow('deck', deck, 'Deck scene'),
        readinessRow('card', card, 'Action card'),
        readinessRow('advisor', advisor, 'Advisor / pinned card')
      ],
      handDeckOption: selectHandDeckOption(hand, deck),
      handAdvisorOption: selectHandAdvisorOption(hand, advisor)
    };
  }

  function defaultDraft(projectIndex) {
    const model = buildSurfaceModel(projectIndex);
    const handDeckOption = model.handDeckOption || {};
    const handAdvisorOption = model.handAdvisorOption || {};
    const cardOption0 = model.card && model.card.options[0] || {};
    const cardOption1 = model.card && model.card.options[1] || {};
    const advisorOption0 = model.advisor && model.advisor.options[0] || {};
    return normalizeDraft({
      id: 'play_surface_update',
      title: 'Playable Surface Update',
      handTitle: model.hand && model.hand.title || 'Workspace Hand',
      handHeading: model.hand && model.hand.heading || 'Workspace Hand',
      handBody: model.hand && model.hand.body || '',
      handDeckOptionLabel: handDeckOption.title || 'Open deck',
      handAdvisorOptionLabel: handAdvisorOption.title || 'Review advisor',
      deckTitle: model.deck && model.deck.title || 'Starter Deck',
      deckSubtitle: model.deck && model.deck.subtitle || '',
      cardTitle: model.card && model.card.title || 'Starter Action Card',
      cardHeading: model.card && model.card.heading || model.card && model.card.title || 'Action Card',
      cardBody: model.card && model.card.body || '',
      cardOption0Label: cardOption0.title || 'Spend resources',
      cardOption1Label: cardOption1.title || 'Save capacity',
      advisorTitle: model.advisor && model.advisor.title || 'Starter Advisor',
      advisorSubtitle: model.advisor && model.advisor.subtitle || '',
      advisorHeading: model.advisor && model.advisor.heading || model.advisor && model.advisor.title || 'Advisor',
      advisorBody: model.advisor && model.advisor.body || '',
      advisorOption0Label: advisorOption0.title || 'Ask for help',
      evidence: model
    });
  }

  function normalizeDraft(input) {
    const draft = isObject(input) ? clone(input) : {};
    draft.schemaVersion = String(draft.schemaVersion || PLAY_SURFACE_VERSION);
    draft.kind = PLAY_SURFACE_KIND;
    draft.id = safeId(draft.id || 'play_surface_update');
    draft.title = String(draft.title || 'Playable Surface Update').trim();
    [
      'handTitle',
      'handHeading',
      'handBody',
      'handDeckOptionLabel',
      'handAdvisorOptionLabel',
      'deckTitle',
      'deckSubtitle',
      'cardTitle',
      'cardHeading',
      'cardBody',
      'cardOption0Label',
      'cardOption1Label',
      'advisorTitle',
      'advisorSubtitle',
      'advisorHeading',
      'advisorBody',
      'advisorOption0Label'
    ].forEach((key) => {
      draft[key] = String(draft[key] || '').trim();
    });
    draft.evidence = isObject(draft.evidence) ? draft.evidence : {};
    return draft;
  }

  function validateDraft(input) {
    const draft = normalizeDraft(input);
    const diagnostics = [];
    if (!ID_RE.test(draft.id)) {
      diagnostic(diagnostics, 'error', 'play_surface.id', 'Playable surface draft id must be file-safe.');
    }
    if (!draft.title) {
      diagnostic(diagnostics, 'error', 'play_surface.title', 'Draft title is required.');
    }
    if (!draft.handHeading) {
      diagnostic(diagnostics, 'warning', 'play_surface.hand_heading', 'Hand heading is empty.');
    }
    if (!draft.cardHeading) {
      diagnostic(diagnostics, 'warning', 'play_surface.card_heading', 'Action card heading is empty.');
    }
    if (!draft.advisorHeading) {
      diagnostic(diagnostics, 'warning', 'play_surface.advisor_heading', 'Advisor heading is empty.');
    }
    const evidence = isObject(draft.evidence) ? draft.evidence : {};
    if (!isObject(evidence.hand) || !evidence.hand.exists) {
      diagnostic(diagnostics, 'warning', 'play_surface.hand_missing', 'No source-backed hand scene was detected.');
    }
    return {ok: diagnostics.every((item) => item.severity !== 'error'), draft, diagnostics};
  }

  function buildExportBundle(input, projectIndex) {
    const validation = validateDraft(input);
    const draft = validation.draft;
    const plan = buildInstallPlan(draft, projectIndex);
    const installApi = installPlanApi();
    const installPlanJson = installApi.renderInstallPlanJson(plan);
    const patchPreview = installApi.renderPatchPreview(plan);
    const installChecklist = installApi.renderOperationChecklist(plan);
    const draftJson = JSON.stringify(draft, null, 2) + '\n';
    const playerPreview = renderPlayerPreview(draft);
    const installNotes = renderInstallNotes(draft, plan);
    return {
      ok: validation.ok,
      draft,
      diagnostics: validation.diagnostics,
      files: [
        {path: draft.id + '.play-surface-draft.json', content: draftJson, kind: 'draft'},
        {path: draft.id + '.play-surface-preview.txt', content: playerPreview, kind: 'preview'},
        {path: draft.id + '.install-plan.json', content: installPlanJson, kind: 'install_plan'},
        {path: draft.id + '.patch-preview.diff', content: patchPreview, kind: 'patch_preview'},
        {path: draft.id + '.install-notes.txt', content: installNotes, kind: 'notes'}
      ],
      playerPreview,
      previewText: playerPreview,
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
    const evidence = isObject(draft.evidence) ? draft.evidence : {};
    const operations = [];
    const hand = isObject(evidence.hand) ? evidence.hand : {};
    const deck = isObject(evidence.deck) ? evidence.deck : {};
    const card = isObject(evidence.card) ? evidence.card : {};
    const advisor = isObject(evidence.advisor) ? evidence.advisor : {};

    addTitleOperation(operations, 'hand_title', hand, draft.handTitle, 'play_surface.hand_title');
    addOptionOperation(operations, 'hand_deck_option', evidence.handDeckOption, draft.handDeckOptionLabel, 'play_surface.hand_deck_option');
    addOptionOperation(operations, 'hand_advisor_option', evidence.handAdvisorOption, draft.handAdvisorOptionLabel, 'play_surface.hand_advisor_option');
    addOpeningOperation(operations, 'hand_opening', hand, draft.handHeading, draft.handBody, 'play_surface.hand');

    addTitleOperation(operations, 'deck_title', deck, draft.deckTitle, 'play_surface.deck_title');
    addSubtitleOperation(operations, 'deck_subtitle', deck, draft.deckSubtitle, 'play_surface.deck_subtitle');

    addTitleOperation(operations, 'card_title', card, draft.cardTitle, 'play_surface.card_title');
    addOptionOperation(operations, 'card_option_1', card.options && card.options[0], draft.cardOption0Label, 'play_surface.card_option');
    addOptionOperation(operations, 'card_option_2', card.options && card.options[1], draft.cardOption1Label, 'play_surface.card_option');
    addOpeningOperation(operations, 'card_opening', card, draft.cardHeading, draft.cardBody, 'play_surface.card');

    addTitleOperation(operations, 'advisor_title', advisor, draft.advisorTitle, 'play_surface.advisor_title');
    addSubtitleOperation(operations, 'advisor_subtitle', advisor, draft.advisorSubtitle, 'play_surface.advisor_subtitle');
    addOptionOperation(operations, 'advisor_option_1', advisor.options && advisor.options[0], draft.advisorOption0Label, 'play_surface.advisor_option');
    addOpeningOperation(operations, 'advisor_opening', advisor, draft.advisorHeading, draft.advisorBody, 'play_surface.advisor');

    if (!operations.length) {
      operations.push({
        id: 'play_surface_noop',
        type: 'manual_snippet',
        path: hand.path || 'source/scenes/main.scene.dry',
        content: 'No playable-surface fields changed.\n',
        safety: 'manual_review',
        description: 'No installable Playable Surface change was generated.'
      });
    }

    return installApi.buildInstallPlan({
      id: draft.id,
      draftKind: PLAY_SURFACE_KIND,
      title: draft.title || draft.id,
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
      operations
    });
  }

  function addTitleOperation(operations, id, scene, nextTitle, role) {
    if (!scene || !scene.exists || !scene.titleSource || !nextTitle || nextTitle === scene.title) {
      return;
    }
    addReplaceText(operations, id, scene.path, scene.titleSource, 'title: ' + nextTitle, role, 'Replace the playable-surface scene title after exact source evidence matches.');
  }

  function addSubtitleOperation(operations, id, scene, nextSubtitle, role) {
    if (!scene || !scene.exists || !scene.subtitleSource || nextSubtitle === scene.subtitle) {
      return;
    }
    addReplaceText(operations, id, scene.path, scene.subtitleSource, 'subtitle: ' + nextSubtitle, role, 'Replace the playable-surface subtitle after exact source evidence matches.');
  }

  function addOpeningOperation(operations, id, scene, nextHeading, nextBody, role) {
    if (!scene || !scene.exists || !scene.openingEvidence) {
      return;
    }
    if (nextHeading === scene.heading && nextBody === scene.body) {
      return;
    }
    operations.push({
      id,
      type: 'replace_section',
      path: scene.path,
      anchorText: scene.openingEvidence.anchorText,
      endAnchorText: scene.openingEvidence.endAnchorText,
      content: renderOpeningSection(nextHeading || scene.heading || scene.title, nextBody),
      dedupeSearch: String(nextHeading || '') + '\n' + String(nextBody || ''),
      startLine: scene.openingEvidence.startLine,
      endLine: scene.openingEvidence.endLine,
      safety: 'guarded_apply',
      role,
      description: 'Replace the source-backed playable-surface heading/body between exact anchors.'
    });
  }

  function addOptionOperation(operations, id, option, nextLabel, role) {
    if (!option || !option.source || !nextLabel || nextLabel === option.title) {
      return;
    }
    addReplaceText(operations, id, option.path, option.source, '- ' + option.id + ': ' + nextLabel, role, 'Replace the playable-surface option label after exact source evidence matches.');
  }

  function addReplaceText(operations, id, path, source, replacement, role, description) {
    const search = String(source && source.anchorText || '').trim();
    const line = sourceLine(source);
    if (!path || !search || !line) {
      return;
    }
    operations.push({
      id,
      type: 'replace_text',
      path,
      line,
      search,
      replace: replacement,
      safety: 'guarded_apply',
      role,
      description
    });
  }

  function renderOpeningSection(heading, body) {
    const lines = ['= ' + (heading || 'Workspace')];
    const paragraphs = String(body || '').split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
    paragraphs.forEach((paragraph) => lines.push('', paragraph));
    return lines.join('\n') + '\n';
  }

  function renderPlayerPreview(draft) {
    return [
      'Playable Surface',
      '',
      'Hand: ' + (draft.handHeading || draft.handTitle || ''),
      draft.handBody || '',
      '',
      'Hand choices:',
      '- ' + (draft.handDeckOptionLabel || 'Open deck'),
      '- ' + (draft.handAdvisorOptionLabel || 'Review advisor'),
      '',
      'Deck: ' + (draft.deckTitle || ''),
      draft.deckSubtitle || '',
      '',
      'Action card: ' + (draft.cardHeading || draft.cardTitle || ''),
      draft.cardBody || '',
      '- ' + (draft.cardOption0Label || ''),
      '- ' + (draft.cardOption1Label || ''),
      '',
      'Advisor: ' + (draft.advisorHeading || draft.advisorTitle || ''),
      draft.advisorBody || '',
      '- ' + (draft.advisorOption0Label || '')
    ].join('\n').replace(/\n+$/, '\n');
  }

  function renderInstallNotes(draft, plan) {
    return [
      'Install Assistant: proposal only / not installed',
      '',
      'Playable Surface draft: ' + draft.id,
      '',
      'Generated operations:',
      ensureArray(plan && plan.operations).map((op) => '- ' + op.type + ' ' + op.path + ' (' + op.safety + ')').join('\n') || '- none',
      '',
      'Safety:',
      '- Guarded edits only touch source-backed hand/deck/card/advisor text and option labels.',
      '- Root, post_event, generated out/html, and arbitrary router logic are not edited by this workflow.'
    ].join('\n') + '\n';
  }

  function firstScene(scenes, types) {
    const allowed = new Set(types);
    return ensureArray(scenes).find((scene) => scene && allowed.has(String(scene.type || ''))) || null;
  }

  function sceneBySemantic(index, scenes, key) {
    const item = ensureArray(index.semantic && index.semantic[key])[0];
    const id = item && item.id;
    return id ? ensureArray(scenes).find((scene) => scene && scene.id === id) || null : null;
  }

  function sceneSurface(scene, textRows) {
    if (!scene || !scene.id) {
      return {exists: false, id: '', title: '', path: ''};
    }
    const rows = topLevelRows(textRows, scene.id);
    const titleRow = firstRole(rows, 'title');
    const subtitleRow = firstRole(rows, 'subtitle');
    const headingRow = firstRole(rows, 'heading');
    const bodyRows = rows.filter((row) => row && String(row.role || '') === 'body');
    const openingRows = [headingRow].concat(bodyRows).filter(Boolean);
    const options = ensureArray(scene.options).map((option) => optionSurface(option, scene.path)).filter(Boolean);
    const titleSource = sourceWithDefaultAnchor(
      titleRow && titleRow.source || sourceFromMetadata(scene.metadata && scene.metadata.title),
      'title: ' + String(scene.title || titleRow && titleRow.text || scene.id || '')
    );
    const subtitleText = String(subtitleRow && subtitleRow.text || scene.subtitle || '');
    const subtitleSource = sourceWithDefaultAnchor(
      subtitleRow && subtitleRow.source || sourceFromMetadata(scene.metadata && scene.metadata.subtitle),
      subtitleText ? 'subtitle: ' + subtitleText : ''
    );
    return {
      exists: true,
      id: String(scene.id || ''),
      type: String(scene.type || 'scene'),
      title: String(scene.title || titleRow && titleRow.text || scene.id || ''),
      subtitle: String(subtitleRow && subtitleRow.text || ''),
      heading: String(headingRow && headingRow.text || scene.title || ''),
      body: bodyRows.map((row) => cleanText(row.text)).filter(Boolean).join('\n\n'),
      path: normalizedPath(scene.path || ''),
      titleSource,
      subtitleSource,
      openingEvidence: sectionEvidence(openingRows),
      options,
      tags: ensureArray(scene.tags).map(String)
    };
  }

  function optionSurface(option, scenePath) {
    if (!option || !option.id) {
      return null;
    }
    const source = option.sourceSpan || option.source || option.metadata || {};
    return {
      id: String(option.id || ''),
      title: String(option.title || ''),
      target: option.target || null,
      path: normalizedPath(source.path || scenePath || ''),
      source: {
        path: normalizedPath(source.path || scenePath || ''),
        line: sourceLine(source),
        startLine: sourceLine(source),
        endLine: sourceEndLine(source),
        anchorText: source.anchorText || optionAnchor(option),
        endAnchorText: source.endAnchorText || optionAnchor(option)
      }
    };
  }

  function optionAnchor(option) {
    return '- ' + String(option.id || '') + (option.title ? ': ' + option.title : '');
  }

  function selectHandDeckOption(hand, deck) {
    if (!hand || !hand.options || !hand.options.length) {
      return null;
    }
    const deckId = deck && deck.id || '';
    return hand.options.find((option) => option.target && option.target.kind === 'scene' && option.target.id === deckId) ||
      hand.options.find((option) => String(option.id || '').startsWith('@')) ||
      hand.options[0];
  }

  function selectHandAdvisorOption(hand, advisor) {
    if (!hand || !hand.options || !hand.options.length) {
      return null;
    }
    const advisorTags = new Set(ensureArray(advisor && advisor.tags).map(String));
    return hand.options.find((option) => option.target && option.target.kind === 'tag' && advisorTags.has(String(option.target.id || ''))) ||
      hand.options.find((option) => String(option.id || '').startsWith('#')) ||
      hand.options[1] ||
      null;
  }

  function topLevelRows(textRows, sceneId) {
    return ensureArray(textRows)
      .filter((row) => row && row.owner && row.owner.sceneId === sceneId && !row.owner.sectionId)
      .sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
  }

  function firstRole(rows, role) {
    return ensureArray(rows).find((row) => String(row && row.role || '') === role && String(row.text || '').trim()) || null;
  }

  function sectionEvidence(rows) {
    const withSource = ensureArray(rows).filter((row) => sourceLine(row.source));
    if (!withSource.length) {
      return null;
    }
    const first = withSource[0];
    const last = withSource[withSource.length - 1];
    return {
      path: normalizedPath(first.source && first.source.path),
      anchorText: String(first.source && first.source.anchorText || sourceAnchor(first)).trim(),
      endAnchorText: String(last.source && last.source.endAnchorText || sourceAnchor(last)).trim(),
      startLine: sourceLine(first.source),
      endLine: sourceEndLine(last.source)
    };
  }

  function sourceAnchor(row) {
    const text = cleanText(row && row.text || '');
    if (String(row && row.role || '') === 'heading') {
      return '= ' + text;
    }
    return text;
  }

  function sourceFromMetadata(source) {
    if (!source || !source.path || !source.line) {
      return null;
    }
    return {
      path: normalizedPath(source.path),
      line: sourceLine(source),
      startLine: sourceLine(source),
      endLine: sourceEndLine(source)
    };
  }

  function sourceWithDefaultAnchor(source, fallbackAnchor) {
    if (!source) {
      return null;
    }
    const anchor = String(source.anchorText || fallbackAnchor || '').trim();
    return Object.assign({}, source, {
      anchorText: anchor,
      endAnchorText: String(source.endAnchorText || anchor).trim()
    });
  }

  function sourceLine(source) {
    const line = Number(source && (source.line || source.startLine || source.$line) || 0);
    return Number.isFinite(line) && line > 0 ? Math.floor(line) : null;
  }

  function sourceEndLine(source) {
    const line = Number(source && (source.endLine || source.line || source.startLine || source.$line) || 0);
    return Number.isFinite(line) && line > 0 ? Math.floor(line) : null;
  }

  function readinessRow(id, scene, label) {
    return {
      id,
      label,
      status: scene && scene.exists ? 'ready' : 'warning',
      message: scene && scene.exists ? label + ' detected.' : label + ' was not detected.'
    };
  }

  function safeId(value) {
    let text = String(value || 'play_surface_update')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!text) {
      text = 'play_surface_update';
    }
    if (!/^[A-Za-z_]/.test(text)) {
      text = 'surface_' + text;
    }
    return ID_RE.test(text) ? text : 'play_surface_update';
  }

  function diagnostic(diagnostics, severity, code, message) {
    diagnostics.push({severity, code, message, confidence: 'exact'});
  }

  function cleanText(value) {
    return String(value || '').replace(/^=\s*/, '').trim();
  }

  function normalizedPath(value) {
    return String(value || '').replace(/\\/g, '/');
  }

  const api = {
    PLAY_SURFACE_VERSION,
    buildSurfaceModel,
    defaultDraft,
    normalizeDraft,
    validateDraft,
    buildInstallPlan,
    buildExportBundle,
    build: buildExportBundle,
    generate: buildExportBundle,
    renderPlayerPreview
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapPlaySurfaceDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
