// @ts-check
(function initRightSidebarDraft(global) {
  'use strict';

  const RIGHT_SIDEBAR_VERSION = '0.1';
  const RIGHT_SIDEBAR_KIND = 'right_sidebar';
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

  // Engine source for the eject/adopt step. The right gutter is already a
  // first-class citizen of this template: `.tools.right` exists in +game.css and
  // the runtime expects a `#stats_sidebar_right` element. We only ever read the
  // engine template from the desktop/export layer (this module stays fs-free).
  const ENGINE_TEMPLATE_NAME = 'default-tabbed-sidebar';
  const ENGINE_TEMPLATE_DIR = 'node_modules/dendrynexus/lib/templates/html/' + ENGINE_TEMPLATE_NAME;
  const ENGINE_TEMPLATE_FILES = ['+index.html', '+game.css'];
  const RIGHT_PANEL_ELEMENT_ID = 'stats_sidebar_right';
  // The left sidebar opening tag is the stable anchor; the right panel is
  // inserted immediately after the `#stats_sidebar` block closes, still inside
  // `#tools_wrapper`.
  const INSERT_ANCHOR = "<div id='stats_sidebar' class='tools left'>";

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

  // Resolve template ownership from the P0 indexer evidence
  // (index.project.templateSource). Old indexes without the field fall back to
  // 'unknown' so the guarded path never fires on stale evidence.
  function resolveTemplateOwnership(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const project = isObject(index.project) ? index.project : {};
    const source = isObject(project.templateSource) ? project.templateSource : null;
    if (!source) {
      return {ownership: 'unknown', source: null, templateDir: recommendTemplateDir(project)};
    }
    if (source.owned) {
      const ownedDir = normalizeTemplateDir(
        (Array.isArray(source.dirs) && source.dirs[0]) ||
        (source.indexPath ? String(source.indexPath).replace(/\/\+index\.html$/, '') : '') ||
        recommendTemplateDir(project)
      );
      return {ownership: 'mod_owned', source, templateDir: ownedDir};
    }
    return {ownership: 'engine_default', source, templateDir: recommendTemplateDir(project)};
  }

  function buildRightSidebarModel(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const project = isObject(index.project) ? index.project : {};
    const owner = resolveTemplateOwnership(projectIndex);
    const recommendedTemplateDir = owner.templateDir;
    // Guarded auto-apply fires when the indexer confirms a mod-owned template
    // (highest confidence the build reads it) or has positively detected the
    // engine-default state (the eject can create ownership in the same pass).
    // 'unknown' (no P0 evidence) stays manual_review.
    const applyMode = owner.ownership === 'unknown' ? 'manual_review' : 'guarded_apply';
    const ownedSource = isObject(owner.source) ? owner.source : {};
    return {
      schemaVersion: RIGHT_SIDEBAR_VERSION,
      kind: 'right_sidebar_model',
      project: index.project || null,
      templateOwnership: owner.ownership,
      templateSource: owner.source
        ? {
            owned: Boolean(ownedSource.owned),
            dirs: ensureArray(ownedSource.dirs).slice(),
            indexPath: ownedSource.indexPath || '',
            hasStatsSidebarAnchor: Boolean(ownedSource.hasStatsSidebarAnchor),
            hasRightPanel: Boolean(ownedSource.hasRightPanel)
          }
        : null,
      recommendedTemplateDir,
      indexTemplatePath: recommendedTemplateDir + '/+index.html',
      cssTemplatePath: recommendedTemplateDir + '/+game.css',
      engineTemplate: {
        name: ENGINE_TEMPLATE_NAME,
        dir: ENGINE_TEMPLATE_DIR,
        files: ENGINE_TEMPLATE_FILES.slice(),
        rightPanelCssReady: true
      },
      rightPanelElementId: RIGHT_PANEL_ELEMENT_ID,
      insertAnchor: INSERT_ANCHOR,
      applyMode,
      readiness: buildReadiness(owner)
    };
  }

  function buildReadiness(owner) {
    const ownership = owner.ownership;
    const rows = [
      readinessRow(
        'engine_template',
        'ready',
        'Engine right-gutter support',
        'The engine template already ships a `.tools.right` column, so the player layout stays responsive without custom CSS.'
      )
    ];
    if (ownership === 'mod_owned') {
      rows.push(readinessRow(
        'mod_template_source',
        'ready',
        'Mod-owned template source',
        'The mod owns ' + owner.templateDir + '/+index.html, so Studio can insert the right panel directly.'
      ));
      rows.push(readinessRow(
        'apply_mode',
        'guarded',
        'Apply mode',
        'Guarded auto-apply: Studio writes the right panel into the mod-owned template and verifies it before committing.'
      ));
    } else if (ownership === 'engine_default') {
      rows.push(readinessRow(
        'mod_template_source',
        'guarded',
        'Mod-owned template source',
        'No mod template yet; guarded apply will eject the engine template into ' + owner.templateDir + ' so the mod owns it.'
      ));
      rows.push(readinessRow(
        'apply_mode',
        'guarded',
        'Apply mode',
        'Guarded auto-apply: Studio ejects the template and inserts the panel. Build with `make-html -t ' + owner.templateDir + '` so your shipped build also reads it (Studio preview does this automatically).'
      ));
    } else {
      rows.push(readinessRow(
        'mod_template_source',
        'manual',
        'Mod-owned template source',
        'Studio cannot confirm the mod owns an editable template; eject the engine +index.html into a mod template directory first.'
      ));
      rows.push(readinessRow(
        'apply_mode',
        'manual',
        'Apply mode',
        'Template writes stay manual review without template evidence; Studio shows the exact patch and an export package to apply by hand.'
      ));
    }
    return rows;
  }

  function recommendTemplateDir(project) {
    const slug = slugify(project && (project.name || project.id || project.title) || 'custom');
    return 'templates/html/' + (slug || 'custom');
  }

  function defaultDraft(projectIndex) {
    const model = buildRightSidebarModel(projectIndex);
    return normalizeDraft({
      id: 'right_sidebar_panel',
      title: 'Right Sidebar Panel',
      panelTitle: 'Notes',
      panelBody: '',
      panelLines: '',
      templateDir: model.recommendedTemplateDir,
      evidence: model
    });
  }

  function normalizeDraft(input) {
    const draft = isObject(input) ? clone(input) : {};
    draft.schemaVersion = String(draft.schemaVersion || RIGHT_SIDEBAR_VERSION);
    draft.kind = RIGHT_SIDEBAR_KIND;
    draft.id = safeId(draft.id || 'right_sidebar_panel');
    draft.title = String(draft.title || 'Right Sidebar Panel').trim();
    draft.panelTitle = String(draft.panelTitle || '').trim();
    draft.panelBody = String(draft.panelBody || '').trim();
    draft.panelLines = String(draft.panelLines || '').trim();
    draft.templateDir = normalizeTemplateDir(draft.templateDir);
    draft.evidence = isObject(draft.evidence) ? draft.evidence : {};
    return draft;
  }

  function validateDraft(input, projectIndex) {
    const draft = normalizeDraft(input);
    const evidence = usableEvidence(draft.evidence) ? draft.evidence : buildRightSidebarModel(projectIndex);
    const diagnostics = [];
    if (!ID_RE.test(draft.id)) {
      diagnostic(diagnostics, 'error', 'right_sidebar.id', 'Right sidebar draft id must be file-safe.');
    }
    if (!draft.title) {
      diagnostic(diagnostics, 'error', 'right_sidebar.title', 'Draft title is required.');
    }
    if (!draft.panelTitle) {
      diagnostic(diagnostics, 'warning', 'right_sidebar.panel_title', 'Right panel heading is empty.');
    }
    if (!draft.panelBody && !draft.panelLines) {
      diagnostic(diagnostics, 'warning', 'right_sidebar.panel_content', 'Right panel has no body text or lines yet.');
    }
    if (!draft.templateDir) {
      diagnostic(diagnostics, 'error', 'right_sidebar.template_dir', 'A mod template directory is required to host the edited +index.html.');
    }
    // Surface the apply mode honestly: guarded auto-apply when the indexer
    // confirms template evidence, manual review otherwise.
    if (isObject(evidence) && evidence.applyMode === 'guarded_apply') {
      diagnostic(diagnostics, 'info', 'right_sidebar.guarded_apply', 'Guarded auto-apply is available: Studio writes the panel into the mod-owned template and verifies it before committing.');
    } else {
      diagnostic(diagnostics, 'info', 'right_sidebar.manual_review', 'Template writes stay manual review; apply the exported patch by hand or with the export package.');
    }
    draft.evidence = evidence;
    return {ok: diagnostics.every((item) => item.severity !== 'error'), draft, diagnostics};
  }

  function buildInstallPlan(input, projectIndex) {
    const installApi = installPlanApi();
    const draft = normalizeDraft(input);
    const evidence = usableEvidence(draft.evidence) ? draft.evidence : buildRightSidebarModel(projectIndex);
    const owner = resolveTemplateOwnership(projectIndex);
    // Prefer the indexer-confirmed owned dir; fall back to the draft's choice
    // when ownership is unknown/engine-default so the author can steer it.
    const templateDir = owner.ownership === 'mod_owned'
      ? owner.templateDir
      : (draft.templateDir || owner.templateDir);
    const indexPath = templateDir + '/+index.html';
    const cssPath = templateDir + '/+game.css';
    const dedupeSearch = "id='" + RIGHT_PANEL_ELEMENT_ID + "'";
    const operations = [];

    if (owner.ownership === 'unknown') {
      // No P0 evidence: keep the honest manual checklist (legacy behavior).
      operations.push({
        id: 'right_sidebar_eject_template',
        type: 'manual_snippet',
        path: indexPath,
        content: renderEjectInstructions(draft, evidence),
        safety: 'manual_review',
        role: 'right_sidebar.eject',
        description: 'Eject the engine ' + ENGINE_TEMPLATE_NAME + ' template into the mod so it owns an editable +index.html / +game.css.'
      });
      operations.push({
        id: 'right_sidebar_insert_panel',
        type: 'manual_snippet',
        path: indexPath,
        content: renderTemplateInsertSnippet(draft),
        safety: 'manual_review',
        role: 'right_sidebar.insert',
        description: 'Insert the right-panel element after the #stats_sidebar block inside #tools_wrapper.'
      });
    } else {
      // Guarded auto-apply. For engine_default the eject creates ownership in
      // the same pass; for mod_owned the eject is a no-op (already_applied),
      // so it is emitted only when the mod does not yet own the template.
      if (owner.ownership === 'engine_default') {
        operations.push({
          id: 'right_sidebar_eject_index',
          type: 'copy_template_file',
          path: indexPath,
          sourceName: '+index.html',
          safety: 'guarded_apply',
          role: 'right_sidebar.eject',
          description: 'Eject the engine ' + ENGINE_TEMPLATE_NAME + ' +index.html into ' + templateDir + ' so the mod owns the layout.'
        });
        operations.push({
          id: 'right_sidebar_eject_css',
          type: 'copy_template_file',
          path: cssPath,
          sourceName: '+game.css',
          safety: 'guarded_apply',
          role: 'right_sidebar.eject',
          description: 'Eject the engine ' + ENGINE_TEMPLATE_NAME + ' +game.css into ' + templateDir + ' (keeps the .tools.right column responsive).'
        });
      }
      operations.push({
        id: 'right_sidebar_insert_panel',
        type: 'insert_html_block',
        path: indexPath,
        content: renderRightSidebarHtml(draft),
        anchorText: INSERT_ANCHOR,
        dedupeSearch: dedupeSearch,
        safety: 'guarded_apply',
        role: 'right_sidebar.insert',
        description: 'Insert the #' + RIGHT_PANEL_ELEMENT_ID + ' panel after the #stats_sidebar block inside #tools_wrapper.'
      });
    }

    return installApi.buildInstallPlan({
      id: draft.id,
      draftKind: RIGHT_SIDEBAR_KIND,
      title: draft.title || draft.id,
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
      operations
    });
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
    const panelHtml = renderRightSidebarHtml(draft);
    const installNotes = renderInstallNotes(draft, plan);
    return {
      ok: validation.ok,
      draft,
      diagnostics: validation.diagnostics,
      files: [
        {path: draft.id + '.right-sidebar-draft.json', content: draftJson, kind: 'draft'},
        {path: draft.id + '.right-sidebar-preview.txt', content: playerPreview, kind: 'preview'},
        {path: draft.id + '.stats-sidebar-right.html', content: panelHtml, kind: 'snippet'},
        {path: draft.id + '.install-plan.json', content: installPlanJson, kind: 'install_plan'},
        {path: draft.id + '.patch-preview.diff', content: patchPreview, kind: 'patch_preview'},
        {path: draft.id + '.install-notes.txt', content: installNotes, kind: 'notes'}
      ],
      playerPreview,
      previewText: playerPreview,
      panelHtml,
      draftJson,
      installPlan: plan,
      installPlanJson,
      patchPreview,
      installChecklist,
      installNotes
    };
  }

  function renderRightSidebarHtml(draft) {
    const lines = [
      "<div id='" + RIGHT_PANEL_ELEMENT_ID + "' class='tools right'>",
      "  <div id='qualities_right'>",
      '    <h1>' + escapeHtml(draft.panelTitle || 'Notes') + '</h1>'
    ];
    paragraphsFromText(draft.panelBody).forEach((paragraph) => {
      lines.push('    <p>' + escapeHtml(paragraph) + '</p>');
    });
    textLines(draft.panelLines).forEach((line) => {
      lines.push('    <p>' + escapeHtml(line) + '</p>');
    });
    lines.push('  </div>', '</div>');
    return lines.join('\n') + '\n';
  }

  function renderTemplateInsertSnippet(draft) {
    return [
      '# Insert this right-panel element inside #tools_wrapper,',
      '# immediately after the #stats_sidebar (.tools.left) block closes.',
      '# Anchor: ' + INSERT_ANCHOR,
      '# The engine .tools.right CSS already lays this column out responsively.',
      '',
      renderRightSidebarHtml(draft).trimEnd()
    ].join('\n') + '\n';
  }

  function renderEjectInstructions(draft, model) {
    const dir = draft.templateDir;
    const source = (model && model.engineTemplate && model.engineTemplate.dir) || ENGINE_TEMPLATE_DIR;
    return [
      'Eject / adopt the mod template source',
      '',
      'If the mod does not already own an editable template:',
      '1. Copy the engine template files into the mod template directory:',
      '   - ' + source + '/+index.html  ->  ' + dir + '/+index.html',
      '   - ' + source + '/+game.css    ->  ' + dir + '/+game.css',
      '2. Point make-html at this template directory so the mod owns the layout.',
      '   The "+" prefix keeps these files from being overwritten on rebuild.',
      '',
      'If the mod already owns ' + dir + '/+index.html, skip this step and apply',
      'the panel insert below to that file.'
    ].join('\n') + '\n';
  }

  function renderPlayerPreview(draft) {
    const rows = [
      'Right Sidebar Panel',
      '',
      'Element: #' + RIGHT_PANEL_ELEMENT_ID + ' (.tools.right)',
      'Template: ' + draft.templateDir + '/+index.html',
      '',
      draft.panelTitle || 'Notes'
    ];
    if (draft.panelBody) {
      rows.push('', draft.panelBody);
    }
    if (draft.panelLines) {
      rows.push('', draft.panelLines);
    }
    if (!draft.panelBody && !draft.panelLines) {
      rows.push('', '(no panel content yet)');
    }
    return rows.join('\n').replace(/\n+$/, '\n');
  }

  function renderInstallNotes(draft, plan) {
    return [
      'Install Assistant: Right Sidebar Panel proposal',
      '',
      'Draft: ' + draft.id,
      'Template directory: ' + draft.templateDir,
      'Panel element: #' + RIGHT_PANEL_ELEMENT_ID,
      '',
      'Generated operations:',
      ensureArray(plan && plan.operations).map((op) => '- ' + op.type + ' ' + op.path + ' (' + op.safety + ')').join('\n') || '- none',
      '',
      'Safety:',
      '- Template writes stay manual review; Studio never auto-edits HTML templates in this step.',
      '- The engine .tools.right column is already responsive, so no custom layout CSS is required.',
      '- Apply by pasting the exported patch, or hand off the export package to import elsewhere.'
    ].join('\n') + '\n';
  }

  function paragraphsFromText(value) {
    return String(value || '')
      .split(/\n{2,}/)
      .map((part) => part.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  function textLines(value) {
    return String(value || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function readinessRow(id, status, label, message) {
    return {id, status, label, message};
  }

  function diagnostic(diagnostics, severity, code, message) {
    diagnostics.push({severity, code, message, confidence: 'exact'});
  }

  function normalizeTemplateDir(value) {
    const raw = String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '').trim();
    if (!raw) {
      return 'templates/html/custom';
    }
    const parts = raw.split('/').filter((part) => part && part !== '.' && part !== '..');
    return parts.join('/') || 'templates/html/custom';
  }

  function slugify(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function usableEvidence(value) {
    return isObject(value) && value.kind === 'right_sidebar_model';
  }

  function safeId(value) {
    let text = String(value || 'right_sidebar_panel')
      .trim()
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!text) {
      text = 'right_sidebar_panel';
    }
    if (/^[0-9]/.test(text)) {
      text = 'right_sidebar_' + text;
    }
    return ID_RE.test(text) ? text : 'right_sidebar_panel';
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  const api = {
    RIGHT_SIDEBAR_VERSION,
    RIGHT_SIDEBAR_KIND,
    ENGINE_TEMPLATE_NAME,
    ENGINE_TEMPLATE_DIR,
    RIGHT_PANEL_ELEMENT_ID,
    INSERT_ANCHOR,
    buildRightSidebarModel,
    defaultDraft,
    normalizeDraft,
    validateDraft,
    buildInstallPlan,
    buildExportBundle,
    renderRightSidebarHtml,
    renderTemplateInsertSnippet,
    renderEjectInstructions
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapRightSidebarDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
