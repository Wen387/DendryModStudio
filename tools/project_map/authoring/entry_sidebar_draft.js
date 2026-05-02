(function initEntrySidebarDraft(global) {
  'use strict';

  const ENTRY_SIDEBAR_VERSION = '0.1';
  const ENTRY_SIDEBAR_KIND = 'entry_sidebar';
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

  function variableSuggestionsApi() {
    if (global && global.ProjectMapVariableSuggestions) {
      return global.ProjectMapVariableSuggestions;
    }
    if (typeof require === 'function') {
      try {
        return require('./variable_suggestions.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function buildEntryModel(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const scenes = ensureArray(index.scenes);
    const root = scenes.find((scene) => scene && scene.id === 'root') ||
      scenes.find((scene) => scene && scene.type === 'root') ||
      scenes.find((scene) => normalizedPath(scene.path) === 'source/scenes/root.scene.dry') ||
      null;
    const status = scenes.find((scene) => scene && scene.id === 'status') ||
      scenes.find((scene) => /^source\/scenes\/status(?:[_-][A-Za-z0-9_.-]+)?\.scene\.dry$/.test(normalizedPath(scene.path))) ||
      null;
    const textRows = ensureArray(index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items);
    const surfaceRows = ensureArray(index.semantic && index.semantic.surfaceText && index.semantic.surfaceText.items);
    const rootOpeningRows = rootTextRows(root, textRows, surfaceRows);
    const statusRows = statusTextRows(status, textRows, surfaceRows);
    const firstOption = root && ensureArray(root.options)[0] || null;
    const firstTargetId = firstOption && firstOption.target && firstOption.target.id
      ? stripLeadingDot(firstOption.target.id)
      : stripOptionSigil(firstOption && firstOption.id);
    const playableScenes = scenes
      .filter((scene) => scene && scene.id && (!root || scene.id !== root.id) && (!status || scene.id !== status.id))
      .map((scene) => ({
        id: String(scene.id || ''),
        title: String(scene.title || scene.name || scene.id || ''),
        path: normalizedPath(scene.path || ''),
        type: String(scene.type || 'scene'),
        tags: ensureArray(scene.tags).map(String)
      }))
      .sort((a, b) => sceneRank(a) - sceneRank(b) || a.id.localeCompare(b.id));
    const suggestions = variableSuggestionsApi();
    const variableCandidates = suggestions && typeof suggestions.buildVariableCandidates === 'function'
      ? suggestions.buildVariableCandidates(index, {limit: 24})
      : ensureArray(index.variables).map((variable) => ({name: variable && variable.name || '', reason: 'ProjectIndex variable'}));
    const targetExists = Boolean(firstTargetId && playableScenes.some((scene) => scene.id === firstTargetId));

    return {
      schemaVersion: ENTRY_SIDEBAR_VERSION,
      kind: 'entry_sidebar_model',
      project: index.project || null,
      root: root ? {
        id: root.id,
        title: root.title || '',
        path: normalizedPath(root.path || 'source/scenes/root.scene.dry'),
        titleLine: sourceLine(root.metadata && root.metadata.title),
        heading: firstText(rootOpeningRows, 'heading') || root.title || '',
        intro: bodyText(rootOpeningRows),
        firstOption: firstOption ? {
          id: String(firstOption.id || ''),
          title: String(firstOption.title || ''),
          targetId: firstTargetId,
          line: sourceLine(firstOption.sourceSpan || firstOption.source || firstOption.metadata),
          path: normalizedPath(firstOption.sourceSpan && firstOption.sourceSpan.path || firstOption.source && firstOption.source.path || root.path || 'source/scenes/root.scene.dry')
        } : null,
        openingEvidence: sectionEvidence(rootOpeningRows)
      } : null,
      sidebar: status ? {
        id: status.id,
        title: status.title || '',
        path: normalizedPath(status.path || 'source/scenes/status.scene.dry'),
        exists: true,
        titleLine: sourceLine(status.metadata && status.metadata.title),
        heading: firstText(statusRows, 'heading') || status.title || 'Status',
        body: bodyText(statusRows),
        statusLines: conditionalStatusLines(statusRows),
        evidence: sectionEvidence(statusRows)
      } : {
        id: 'status',
        title: 'Status',
        path: 'source/scenes/status.scene.dry',
        exists: false,
        titleLine: null,
        heading: 'Status',
        body: '',
        evidence: null
      },
      hasGeneratedSidebarOnly: !status && generatedSurfaceSources(index),
      playability: [
        {
          id: 'root',
          status: root ? 'ready' : 'warning',
          label: 'Root scene',
          message: root ? 'Root/start scene detected.' : 'No root/start scene was detected.'
        },
        {
          id: 'first_route',
          status: firstOption && firstTargetId ? 'ready' : 'warning',
          label: 'First route',
          message: firstOption && firstTargetId ? 'First start-menu route detected.' : 'No first playable root route was detected.'
        },
        {
          id: 'first_target',
          status: targetExists ? 'ready' : 'warning',
          label: 'First target',
          message: targetExists ? 'First playable target exists in source.' : 'First target is missing or must be created.'
        },
        {
          id: 'sidebar',
          status: status ? 'ready' : (!status && generatedSurfaceSources(index) ? 'manual' : 'warning'),
          label: 'Sidebar/status',
          message: status ? 'Source-backed status/sidebar scene detected.' : (!status && generatedSurfaceSources(index) ? 'Generated/custom sidebar needs manual review.' : 'No status/sidebar scene detected; Studio can propose one.')
        }
      ],
      playableScenes,
      variables: variableCandidates.map((candidate) => ({
        name: String(candidate && candidate.name || '').trim(),
        reason: String(candidate && (candidate.reason || candidate.summary || candidate.meaning) || '').trim()
      })).filter((candidate) => candidate.name).slice(0, 24)
    };
  }

  function defaultDraft(projectIndex) {
    const model = buildEntryModel(projectIndex);
    const root = model.root || {};
    const sidebar = model.sidebar || {};
    return normalizeDraft({
      id: 'entry_sidebar_update',
      title: 'Entry & Sidebar Update',
      rootTitle: root.title || 'Start',
      rootHeading: root.heading || root.title || 'Start',
      rootIntro: root.intro || '',
      firstOptionTitle: root.firstOption && root.firstOption.title || 'Start',
      firstTargetId: root.firstOption && root.firstOption.targetId || (model.playableScenes[0] && model.playableScenes[0].id) || '',
      sidebarTitle: sidebar.title || 'Status',
      sidebarHeading: sidebar.heading || sidebar.title || 'Status',
      sidebarBody: sidebar.body || '',
      sidebarStatusLines: sidebar.statusLines || '',
      evidence: {
        root,
        sidebar,
        hasGeneratedSidebarOnly: model.hasGeneratedSidebarOnly
      }
    });
  }

  function normalizeDraft(input) {
    const draft = isObject(input) ? clone(input) : {};
    draft.schemaVersion = String(draft.schemaVersion || ENTRY_SIDEBAR_VERSION);
    draft.kind = ENTRY_SIDEBAR_KIND;
    draft.id = safeId(draft.id || 'entry_sidebar_update');
    draft.title = String(draft.title || 'Entry & Sidebar Update').trim();
    draft.rootTitle = String(draft.rootTitle || '').trim();
    draft.rootHeading = String(draft.rootHeading || '').trim();
    draft.rootIntro = String(draft.rootIntro || '').trim();
    draft.firstOptionTitle = String(draft.firstOptionTitle || '').trim();
    draft.firstTargetId = String(draft.firstTargetId || '').trim();
    draft.sidebarTitle = String(draft.sidebarTitle || '').trim();
    draft.sidebarHeading = String(draft.sidebarHeading || '').trim();
    draft.sidebarBody = String(draft.sidebarBody || '').trim();
    draft.sidebarStatusLines = String(draft.sidebarStatusLines || '').trim();
    draft.evidence = isObject(draft.evidence) ? draft.evidence : {};
    return draft;
  }

  function validateDraft(input) {
    const draft = normalizeDraft(input);
    const diagnostics = [];
    if (!ID_RE.test(draft.id)) {
      diagnostic(diagnostics, 'error', 'entry_sidebar.id', 'Entry/Sidebar draft id must be file-safe.');
    }
    if (!draft.rootTitle) {
      diagnostic(diagnostics, 'error', 'entry_sidebar.root_title', 'Start menu title is required.');
    }
    if (!draft.rootHeading) {
      diagnostic(diagnostics, 'error', 'entry_sidebar.root_heading', 'Start menu heading is required.');
    }
    if (!draft.firstOptionTitle) {
      diagnostic(diagnostics, 'error', 'entry_sidebar.first_option', 'First playable option title is required.');
    }
    if (!draft.firstTargetId) {
      diagnostic(diagnostics, 'warning', 'entry_sidebar.first_target', 'No first playable target is selected.');
    }
    if (!draft.sidebarHeading) {
      diagnostic(diagnostics, 'warning', 'entry_sidebar.sidebar_heading', 'Sidebar heading is empty.');
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
        {path: draft.id + '.entry-sidebar-draft.json', content: draftJson, kind: 'draft'},
        {path: draft.id + '.entry-sidebar-preview.txt', content: playerPreview, kind: 'preview'},
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

  function buildInstallPlan(draft, projectIndex) {
    const installApi = installPlanApi();
    const evidence = isObject(draft.evidence) ? draft.evidence : {};
    const root = isObject(evidence.root) ? evidence.root : {};
    const sidebar = isObject(evidence.sidebar) ? evidence.sidebar : {};
    const operations = [];
    const rootPath = normalizedPath(root.path || 'source/scenes/root.scene.dry');
    const sidebarPath = normalizedPath(sidebar.path || 'source/scenes/status.scene.dry');

    if (rootPath && root.title && draft.rootTitle && draft.rootTitle !== root.title && root.titleLine) {
      operations.push({
        id: 'entry_root_title',
        type: 'replace_text',
        path: rootPath,
        line: root.titleLine,
        search: 'title: ' + root.title,
        replace: 'title: ' + draft.rootTitle,
        safety: 'guarded_apply',
        role: 'entry_sidebar.title',
        description: 'Replace the root/start menu source title after exact line evidence matches.'
      });
    }
    if (rootPath && root.openingEvidence && (draft.rootHeading !== root.heading || draft.rootIntro !== root.intro)) {
      operations.push({
        id: 'entry_opening_section',
        type: 'replace_section',
        path: rootPath,
        anchorText: root.openingEvidence.anchorText,
        endAnchorText: root.openingEvidence.endAnchorText,
        content: renderOpeningSection(draft),
        dedupeSearch: draft.rootHeading + '\n\n' + draft.rootIntro,
        startLine: root.openingEvidence.startLine,
        endLine: root.openingEvidence.endLine,
        safety: 'guarded_apply',
        role: 'entry_sidebar.heading',
        description: 'Replace the source-backed start menu heading and opening text between exact anchors.'
      });
    } else if (rootPath && (draft.rootHeading !== root.heading || draft.rootIntro !== root.intro)) {
      operations.push({
        id: 'entry_opening_manual',
        type: 'manual_snippet',
        path: rootPath,
        content: renderOpeningSection(draft),
        safety: 'manual_review',
        role: 'entry_sidebar.heading',
        description: 'Start menu source anchors are not exact enough for guarded apply; review the root opening manually.'
      });
    }
    if (rootPath && root.firstOption && draft.firstOptionTitle && (draft.firstOptionTitle !== root.firstOption.title || draft.firstTargetId !== root.firstOption.targetId)) {
      if (root.firstOption.line) {
        const target = optionTarget(draft.firstTargetId, root.firstOption.id);
        operations.push({
          id: 'entry_first_route',
          type: 'replace_text',
          path: root.firstOption.path || rootPath,
          line: root.firstOption.line,
          search: '- ' + root.firstOption.id + ': ' + root.firstOption.title,
          replace: '- ' + target + ': ' + draft.firstOptionTitle,
          safety: 'guarded_apply',
          role: 'entry_sidebar.option_label',
          description: 'Replace the first start-menu route line after exact source evidence matches.'
        });
      } else {
        operations.push({
          id: 'entry_first_route_manual',
          type: 'manual_snippet',
          path: root.firstOption.path || rootPath,
          content: '- ' + optionTarget(draft.firstTargetId, root.firstOption.id) + ': ' + draft.firstOptionTitle + '\n',
          safety: 'manual_review',
          role: 'entry_sidebar.option_label',
          description: 'First route source line evidence is missing; review the root option manually.'
        });
      }
    }

    if (evidence.hasGeneratedSidebarOnly) {
      operations.push({
        id: 'sidebar_generated_manual',
        type: 'manual_snippet',
        path: sidebarPath || 'out/html/index.html',
        content: renderSidebarSection(draft),
        safety: 'manual_review',
        description: 'Sidebar evidence appears generated or custom; review manually before editing UI-owned files.'
      });
    } else if (sidebarPath && sidebar.exists) {
      if (sidebar.title && draft.sidebarTitle && draft.sidebarTitle !== sidebar.title && sidebar.titleLine) {
        operations.push({
          id: 'sidebar_title',
          type: 'replace_text',
          path: sidebarPath,
          line: sidebar.titleLine,
          search: 'title: ' + sidebar.title,
          replace: 'title: ' + draft.sidebarTitle,
          safety: 'guarded_apply',
          role: 'entry_sidebar.sidebar_title',
          description: 'Replace the source-backed sidebar scene title after exact line evidence matches.'
        });
      }
      if (sidebar.evidence && (draft.sidebarHeading !== sidebar.heading || draft.sidebarBody !== sidebar.body || draft.sidebarStatusLines)) {
        operations.push({
          id: 'sidebar_section',
          type: 'replace_section',
          path: sidebarPath,
          anchorText: sidebar.evidence.anchorText,
          endAnchorText: sidebar.evidence.endAnchorText,
          content: renderSidebarSection(draft),
          dedupeSearch: draft.sidebarHeading + '\n\n' + draft.sidebarBody + '\n' + draft.sidebarStatusLines,
          startLine: sidebar.evidence.startLine,
          endLine: sidebar.evidence.endLine,
          safety: 'guarded_apply',
          role: 'entry_sidebar.sidebar',
          description: 'Replace the source-backed sidebar/status display section between exact anchors.'
        });
      } else if (draft.sidebarHeading !== sidebar.heading || draft.sidebarBody !== sidebar.body || draft.sidebarStatusLines !== (sidebar.statusLines || '')) {
        operations.push({
          id: 'sidebar_section_manual',
          type: 'manual_snippet',
          path: sidebarPath,
          content: renderSidebarSection(draft),
          safety: 'manual_review',
          role: 'entry_sidebar.sidebar',
          description: 'Sidebar source anchors are not exact enough for guarded apply; review the status scene manually.'
        });
      }
    } else {
      operations.push({
        id: 'sidebar_create_status_scene',
        type: 'create_file',
        path: 'source/scenes/status.scene.dry',
        content: 'title: ' + (draft.sidebarTitle || 'Status') + '\n\n' + renderSidebarSection(draft),
        safety: 'safe_apply',
        role: 'entry_sidebar.sidebar',
        description: 'Create a source-backed status/sidebar scene for the default Dendry HTML shell.'
      });
    }

    if (!operations.length) {
      operations.push({
        id: 'entry_sidebar_noop',
        type: 'manual_snippet',
        path: rootPath || sidebarPath || 'source/scenes/root.scene.dry',
        content: 'No Entry/Sidebar fields changed.\n',
        safety: 'manual_review',
        description: 'No installable Entry/Sidebar change was generated.'
      });
    }
    operations.sort((a, b) => operationPriority(a) - operationPriority(b));

    return installApi.buildInstallPlan({
      id: draft.id,
      draftKind: ENTRY_SIDEBAR_KIND,
      title: draft.title || draft.id,
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
      operations
    });
  }

  function operationPriority(operation) {
    const id = String(operation && operation.id || '');
    if (id === 'entry_root_title') {
      return 10;
    }
    if (id === 'entry_first_route') {
      return 20;
    }
    if (id === 'entry_opening_section') {
      return 30;
    }
    if (id.startsWith('sidebar_')) {
      return 40;
    }
    return 50;
  }

  function renderPlayerPreview(draft) {
    return [
      'Start Menu',
      draft.rootHeading || draft.rootTitle,
      '',
      draft.rootIntro || '(no opening text)',
      '',
      '-> ' + (draft.firstOptionTitle || 'Start') + (draft.firstTargetId ? ' [' + draft.firstTargetId + ']' : ''),
      '',
      'Sidebar',
      draft.sidebarHeading || draft.sidebarTitle,
      '',
      draft.sidebarBody || '(no sidebar body)',
      draft.sidebarStatusLines ? '\n' + draft.sidebarStatusLines : ''
    ].join('\n').replace(/\n+$/, '\n');
  }

  function renderInstallNotes(draft, plan) {
    return [
      'Install Assistant: proposal only / not installed',
      '',
      'Entry & Sidebar draft: ' + draft.id,
      '',
      'Generated operations:',
      ensureArray(plan && plan.operations).map((op) => '- ' + op.type + ' ' + op.path + ' (' + op.safety + ')').join('\n') || '- none',
      '',
      'Safety:',
      '- Root edits are limited to exact source-backed Entry/Sidebar text and route lines.',
      '- Sidebar creation is limited to source/scenes/status*.scene.dry.',
      '- Generated/custom UI evidence stays manual review.'
    ].join('\n') + '\n';
  }

  function renderOpeningSection(draft) {
    const lines = ['= ' + (draft.rootHeading || draft.rootTitle || 'Start')];
    if (draft.rootIntro) {
      lines.push('', draft.rootIntro);
    }
    return lines.join('\n') + '\n';
  }

  function renderSidebarSection(draft) {
    const lines = ['= ' + (draft.sidebarHeading || draft.sidebarTitle || 'Status')];
    if (draft.sidebarBody) {
      lines.push('', draft.sidebarBody);
    }
    if (draft.sidebarStatusLines) {
      lines.push('', draft.sidebarStatusLines);
    }
    return lines.join('\n') + '\n';
  }

  function rootTextRows(root, textRows, surfaceRows) {
    const rootId = root && root.id || 'root';
    const rows = textRows.filter((row) => row && row.owner && row.owner.sceneId === rootId)
      .filter((row) => ['heading', 'body'].includes(String(row.role || '')));
    if (rows.length) {
      return rows.sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
    }
    const rootSurface = surfaceRows
      .filter((row) => normalizedPath(row.source && row.source.path) === normalizedPath(root && root.path || 'source/scenes/root.scene.dry'))
      .map((row) => ({
        role: row.area === 'opening_text' ? 'body' : row.role || 'body',
        text: row.label || row.originalText || '',
        source: row.source || {},
        originalText: row.originalText || row.label || ''
      }));
    return rootSurface.sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
  }

  function statusTextRows(status, textRows, surfaceRows) {
    const statusId = status && status.id || 'status';
    const rows = textRows.filter((row) => row && row.owner && row.owner.sceneId === statusId)
      .filter((row) => ['heading', 'body', 'conditional_body'].includes(String(row.role || '')));
    if (rows.length) {
      return rows.sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
    }
    const statusSurface = surfaceRows
      .filter((row) => normalizedPath(row.source && row.source.path) === normalizedPath(status && status.path || 'source/scenes/status.scene.dry'))
      .map((row) => ({
        role: row.area === 'status_scene' ? 'heading' : row.role || 'body',
        text: cleanSurfaceText(row.label || row.originalText || ''),
        source: row.source || {},
        originalText: row.originalText || row.label || ''
      }));
    return statusSurface.sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
  }

  function sectionEvidence(rows) {
    const withSource = ensureArray(rows).filter((row) => sourceLine(row.source));
    if (!withSource.length) {
      return null;
    }
    const first = withSource[0];
    const last = withSource[withSource.length - 1];
    const anchorText = sourceAnchor(first);
    const endAnchorText = sourceEndAnchor(last);
    if (!anchorText || !endAnchorText) {
      return null;
    }
    return {
      path: normalizedPath(first.source && first.source.path),
      anchorText,
      endAnchorText,
      startLine: sourceLine(first.source),
      endLine: sourceEndLine(last.source)
    };
  }

  function sourceAnchor(row) {
    const source = row && row.source || {};
    const exact = String(source.anchorText || '').trim();
    if (exact) {
      return exact;
    }
    const original = String(row && (row.originalText || row.text) || '').trim();
    if (String(row && row.role || '') === 'heading' && !original.startsWith('=')) {
      return '= ' + original;
    }
    if (sourceLine(source) && sourceEndLine(source) && sourceLine(source) !== sourceEndLine(source)) {
      return '';
    }
    return original;
  }

  function sourceEndAnchor(row) {
    const source = row && row.source || {};
    const exact = String(source.endAnchorText || '').trim();
    if (exact) {
      return exact;
    }
    return sourceAnchor(row);
  }

  function firstText(rows, role) {
    const found = ensureArray(rows).find((row) => String(row.role || '') === role && String(row.text || '').trim());
    return found ? cleanSurfaceText(found.text) : '';
  }

  function bodyText(rows) {
    return ensureArray(rows)
      .filter((row) => !['heading', 'conditional_body'].includes(String(row.role || '')))
      .map((row) => cleanSurfaceText(row.text || row.originalText || ''))
      .filter(Boolean)
      .join('\n');
  }

  function conditionalStatusLines(rows) {
    return ensureArray(rows)
      .filter((row) => String(row.role || '') === 'conditional_body')
      .map((row) => sourceAnchor(row))
      .filter(Boolean)
      .join('\n');
  }

  function cleanSurfaceText(value) {
    return String(value || '').replace(/^=\s*/, '').trim();
  }

  function generatedSurfaceSources(index) {
    const sources = ensureArray(index.semantic && index.semantic.surfaceText && index.semantic.surfaceText.sources);
    return sources.some((source) => normalizedPath(source).startsWith('out/html/'));
  }

  function sourceLine(source) {
    const line = Number(source && (source.line || source.startLine || source.$line) || 0);
    return Number.isFinite(line) && line > 0 ? Math.floor(line) : null;
  }

  function sourceEndLine(source) {
    const line = Number(source && (source.endLine || source.line || source.startLine || source.$line) || 0);
    return Number.isFinite(line) && line > 0 ? Math.floor(line) : null;
  }

  function normalizedPath(value) {
    return String(value || '').replace(/\\/g, '/');
  }

  function stripOptionSigil(value) {
    return stripLeadingDot(String(value || '').replace(/^[@#]/, ''));
  }

  function stripLeadingDot(value) {
    return String(value || '').replace(/^\./, '');
  }

  function optionTarget(targetId, fallbackOptionId) {
    const target = stripLeadingDot(targetId);
    if (target) {
      return '@' + target;
    }
    return fallbackOptionId || '@root';
  }

  function sceneRank(scene) {
    return scene.type === 'event' ? 0 : scene.type === 'scene' ? 1 : 2;
  }

  function safeId(value) {
    let text = String(value || 'entry_sidebar_update')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!text) {
      text = 'entry_sidebar_update';
    }
    if (!/^[A-Za-z_]/.test(text)) {
      text = 'entry_' + text;
    }
    return ID_RE.test(text) ? text : 'entry_sidebar_update';
  }

  function diagnostic(diagnostics, severity, code, message) {
    diagnostics.push({severity, code, message, confidence: 'exact'});
  }

  const api = {
    ENTRY_SIDEBAR_VERSION,
    buildEntryModel,
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
    global.ProjectMapEntrySidebarDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
