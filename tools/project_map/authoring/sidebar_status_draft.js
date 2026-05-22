(function initSidebarStatusDraft(global) {
  'use strict';

  const SIDEBAR_STATUS_VERSION = '0.1';
  const SIDEBAR_STATUS_KIND = 'sidebar_status';
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const MAIN_SECTION_ID = '__main';

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

  function buildSidebarModel(projectIndex) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const scenes = ensureArray(index.scenes);
    const status = statusScene(index, scenes);
    const textRows = ensureArray(index.semantic && index.semantic.textCorpus && index.semantic.textCorpus.items);
    const surfaceRows = ensureArray(index.semantic && index.semantic.surfaceText && index.semantic.surfaceText.items);
    const statusRows = status ? statusTextRows(status, textRows, surfaceRows) : [];
    const sections = status ? sidebarSections(status, statusRows) : [];
    const suggestions = variableSuggestionsApi();
    const variableCandidates = suggestions && typeof suggestions.buildVariableCandidates === 'function'
      ? suggestions.buildVariableCandidates(index, {limit: 32})
      : ensureArray(index.variables).map((variable) => ({name: variable && variable.name || '', reason: 'ProjectIndex variable'}));
    const generatedOnly = !status && generatedSurfaceSources(index);
    return {
      schemaVersion: SIDEBAR_STATUS_VERSION,
      kind: 'sidebar_status_model',
      project: index.project || null,
      status: status ? {
        exists: true,
        id: String(status.id || 'status'),
        title: String(status.title || 'Status'),
        path: normalizedPath(status.path || 'source/scenes/status.scene.dry'),
        titleLine: sourceLine(status.metadata && status.metadata.title)
      } : {
        exists: false,
        id: 'status',
        title: 'Status',
        path: 'source/scenes/status.scene.dry',
        titleLine: null
      },
      hasGeneratedSidebarOnly: generatedOnly,
      sections,
      variables: variableCandidates.map((candidate) => ({
        name: String(candidate && candidate.name || '').trim(),
        reason: String(candidate && (candidate.reason || candidate.summary || candidate.meaning) || '').trim()
      })).filter((candidate) => candidate.name).slice(0, 32),
      readiness: [
        readinessRow(
          'status_scene',
          status ? 'ready' : (generatedOnly ? 'manual' : 'warning'),
          'Sidebar/status scene',
          status ? 'Source-backed status/sidebar scene detected.' : (generatedOnly ? 'Generated/custom sidebar needs manual review.' : 'No status/sidebar scene was detected.')
        ),
        readinessRow(
          'editable_section',
          sections.some((section) => section.evidence) ? 'ready' : (sections.length ? 'manual' : 'warning'),
          'Editable sidebar section',
          sections.some((section) => section.evidence)
            ? 'At least one sidebar section has exact source anchors.'
            : (sections.length ? 'Sidebar text exists but needs manual review.' : 'No sidebar display section was detected.')
        )
      ]
    };
  }

  function defaultDraft(projectIndex) {
    const model = buildSidebarModel(projectIndex);
    const section = defaultSection(model.sections);
    return normalizeDraft({
      id: 'sidebar_status_update',
      title: 'Sidebar / Status Update',
      statusTitle: model.status && model.status.title || 'Status',
      sectionId: section && section.id || MAIN_SECTION_ID,
      sectionHeading: section && section.heading || 'Status',
      sectionBody: section && section.body || '',
      sectionStatusLines: section && section.statusLines || '',
      evidence: model
    });
  }

  function normalizeDraft(input) {
    const draft = isObject(input) ? clone(input) : {};
    draft.schemaVersion = String(draft.schemaVersion || SIDEBAR_STATUS_VERSION);
    draft.kind = SIDEBAR_STATUS_KIND;
    draft.id = safeId(draft.id || 'sidebar_status_update');
    draft.title = String(draft.title || 'Sidebar / Status Update').trim();
    draft.statusTitle = String(draft.statusTitle || 'Status').trim();
    draft.sectionId = normalizeSectionId(draft.sectionId || MAIN_SECTION_ID);
    draft.sectionHeading = String(draft.sectionHeading || '').trim();
    draft.sectionBody = String(draft.sectionBody || '').trim();
    draft.sectionStatusLines = String(draft.sectionStatusLines || '').trim();
    draft.operationMode = String(draft.operationMode || '').trim() === 'delete' ? 'delete' : 'edit';
    draft.deleteConfirm = booleanValue(draft.deleteConfirm);
    draft.evidence = isObject(draft.evidence) ? draft.evidence : {};
    return draft;
  }

  function validateDraft(input, projectIndex) {
    const draft = normalizeDraft(input);
    const evidence = usableEvidence(draft.evidence) ? draft.evidence : buildSidebarModel(projectIndex);
    const diagnostics = [];
    if (!ID_RE.test(draft.id)) {
      diagnostic(diagnostics, 'error', 'sidebar_status.id', 'Sidebar / Status draft id must be file-safe.');
    }
    if (!draft.title) {
      diagnostic(diagnostics, 'error', 'sidebar_status.title', 'Draft title is required.');
    }
    if (!draft.statusTitle) {
      diagnostic(diagnostics, 'warning', 'sidebar_status.status_title', 'Status scene title is empty.');
    }
    if (!draft.sectionId) {
      diagnostic(diagnostics, 'error', 'sidebar_status.section_id', 'Select a sidebar section.');
    }
    if (!draft.sectionHeading) {
      diagnostic(diagnostics, 'warning', 'sidebar_status.section_heading', 'Sidebar section heading is empty.');
    }
    if (evidence.hasGeneratedSidebarOnly) {
      diagnostic(diagnostics, 'warning', 'sidebar_status.generated_only', 'This project appears to use generated/custom sidebar UI; Studio will keep the change manual review.');
    }
    if (evidence.status && evidence.status.exists && !selectSection(evidence, draft.sectionId)) {
      diagnostic(diagnostics, 'warning', 'sidebar_status.section_missing', 'Selected sidebar section was not found in the current index.');
    }
    const selected = selectSection(evidence, draft.sectionId);
    if (draft.operationMode === 'delete') {
      if (!draft.deleteConfirm) {
        diagnostic(diagnostics, 'error', 'sidebar_status.delete_confirm', 'Confirm deletion before Review & Apply can remove a sidebar category.');
      }
      if (!selected || !selected.deleteEvidence) {
        diagnostic(diagnostics, 'error', 'sidebar_status.delete_evidence', 'Selected sidebar category cannot be deleted automatically because exact source anchors are missing.');
      }
      if (selected && selected.id === MAIN_SECTION_ID) {
        diagnostic(diagnostics, 'error', 'sidebar_status.delete_main', 'The main sidebar display cannot be deleted automatically.');
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
    return {
      ok: validation.ok,
      draft,
      diagnostics: validation.diagnostics,
      files: [
        {path: draft.id + '.sidebar-status-draft.json', content: draftJson, kind: 'draft'},
        {path: draft.id + '.sidebar-status-preview.txt', content: playerPreview, kind: 'preview'},
        {path: draft.id + '.install-plan.json', content: installPlanJson, kind: 'install_plan'},
        {path: draft.id + '.patch-preview.diff', content: patchPreview, kind: 'patch_preview'},
        {path: draft.id + '.install-notes.txt', content: installNotes, kind: 'notes'}
      ],
      playerPreview,
      previewText: playerPreview,
      sidebarSection: renderSidebarSection(draft),
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
    const evidence = usableEvidence(draft.evidence) ? draft.evidence : buildSidebarModel(projectIndex);
    const status = isObject(evidence.status) ? evidence.status : {};
    const selected = selectSection(evidence, draft.sectionId);
    const operations = [];
    const deleteMode = draft.operationMode === 'delete';
    const sectionChanged = !selected ||
      draft.sectionHeading !== selected.heading ||
      draft.sectionBody !== selected.body ||
      draft.sectionStatusLines !== selected.statusLines;
    const statusPath = normalizedPath(status.path || 'source/scenes/status.scene.dry');

    if (evidence.hasGeneratedSidebarOnly) {
      operations.push({
        id: 'sidebar_status_generated_manual',
        type: 'manual_snippet',
        path: statusPath || 'out/html/index.html',
        content: deleteMode ? renderSidebarDeleteManual(draft) : renderSidebarSection(draft),
        safety: 'manual_review',
        role: deleteMode ? 'sidebar_status.delete_section' : 'sidebar_status.section',
        description: 'Generated/custom sidebar evidence needs manual review before editing UI-owned files.'
      });
    } else if (status.exists) {
      if (!deleteMode && status.title && draft.statusTitle && draft.statusTitle !== status.title && status.titleLine) {
        operations.push({
          id: 'sidebar_status_title',
          type: 'replace_text',
          path: statusPath,
          line: status.titleLine,
          search: 'title: ' + status.title,
          replace: 'title: ' + draft.statusTitle,
          safety: 'guarded_apply',
          role: 'sidebar_status.title',
          description: 'Replace the source-backed status scene title after exact line evidence matches.'
        });
      }
      if (deleteMode && selected && selected.deleteEvidence && selected.id !== MAIN_SECTION_ID) {
        operations.push({
          id: 'sidebar_status_delete_section',
          type: 'replace_section',
          path: selected.deleteEvidence.path || statusPath,
          anchorText: selected.deleteEvidence.anchorText,
          endAnchorText: selected.deleteEvidence.endAnchorText,
          content: '',
          dedupeSearch: selected.deleteEvidence.anchorText,
          startLine: selected.deleteEvidence.startLine,
          endLine: selected.deleteEvidence.endLine,
          allowEmptyReplace: true,
          destructive: true,
          safety: 'guarded_apply',
          role: 'sidebar_status.delete_section',
          description: 'Delete the source-backed sidebar/status category between exact tab and content anchors.'
        });
      } else if (deleteMode) {
        operations.push({
          id: 'sidebar_status_delete_manual',
          type: 'manual_snippet',
          path: statusPath,
          content: renderSidebarDeleteManual(draft),
          safety: 'manual_review',
          role: 'sidebar_status.delete_section',
          description: 'Selected sidebar category lacks exact delete anchors; review the status scene manually.'
        });
      } else if (selected && selected.evidence && sectionChanged) {
        operations.push({
          id: 'sidebar_status_section',
          type: 'replace_section',
          path: selected.evidence.path || statusPath,
          anchorText: selected.evidence.anchorText,
          endAnchorText: selected.evidence.endAnchorText,
          content: renderSidebarSection(draft),
          dedupeSearch: renderSidebarSection(draft).trim(),
          startLine: selected.evidence.startLine,
          endLine: selected.evidence.endLine,
          safety: 'guarded_apply',
          role: 'sidebar_status.section',
          description: 'Replace the source-backed sidebar/status section between exact visible-text anchors.'
        });
      } else if (sectionChanged) {
        operations.push({
          id: 'sidebar_status_section_manual',
          type: 'manual_snippet',
          path: statusPath,
          content: renderSidebarSection(draft),
          safety: 'manual_review',
          role: 'sidebar_status.section',
          description: 'Selected sidebar section lacks exact source anchors; review the status scene manually.'
        });
      }
    } else {
      operations.push({
        id: 'sidebar_status_create_status_scene',
        type: 'create_file',
        path: 'source/scenes/status.scene.dry',
        content: renderStatusScene(draft),
        safety: 'safe_apply',
        role: 'sidebar_status.status_scene',
        description: 'Create a source-backed status/sidebar scene for a generic Dendry project.'
      });
    }

    if (!operations.length) {
      operations.push({
        id: 'sidebar_status_noop',
        type: 'manual_snippet',
        path: statusPath || 'source/scenes/status.scene.dry',
        content: 'No Sidebar / Status fields changed.\n',
        safety: 'manual_review',
        role: 'sidebar_status.noop',
        description: 'No installable Sidebar / Status change was generated.'
      });
    }

    return installApi.buildInstallPlan({
      id: draft.id,
      draftKind: SIDEBAR_STATUS_KIND,
      title: draft.title || draft.id,
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
      operations
    });
  }

  function sidebarSections(status, statusRows) {
    const rows = ensureArray(statusRows)
      .filter((row) => ['heading', 'body', 'conditional_body', 'status_line'].includes(String(row.role || '')))
      .sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
    const sections = [];
    const mainRows = rows.filter((row) => !String(row.owner && row.owner.sectionId || '').trim());
    if (mainRows.length) {
      sections.push(sectionFromRows({
        id: MAIN_SECTION_ID,
        anchorId: '',
        label: 'Main sidebar display',
        path: status.path,
        line: sourceLine(mainRows[0] && mainRows[0].source)
      }, mainRows));
    }
    ensureArray(status.sections).forEach((section) => {
      const id = String(section.id || '');
      const anchorId = id.includes('.') ? id.split('.').pop() : id;
      const sectionRows = rows.filter((row) => String(row.owner && row.owner.sectionId || '') === id);
      sections.push(sectionFromRows({
        id: anchorId || id,
        anchorId,
        label: anchorId || id,
        path: normalizedPath(section.sourceSpan && section.sourceSpan.path || status.path || ''),
        line: sourceLine(section.sourceSpan || section.metadata)
      }, sectionRows));
    });
    return sections.filter((section) => section && section.id);
  }

  function statusTextRows(status, textRows, surfaceRows) {
    const statusId = String(status && status.id || 'status');
    const rows = ensureArray(textRows)
      .filter((row) => row && row.owner && String(row.owner.sceneId || '') === statusId)
      .filter((row) => ['heading', 'body', 'conditional_body'].includes(String(row.role || '')));
    return uniqueStatusRows(rows.concat(statusSurfaceRows(status, surfaceRows)))
      .sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
  }

  function statusSurfaceRows(status, surfaceRows) {
    const statusId = String(status && status.id || 'status');
    const statusPath = normalizedPath(status && status.path || 'source/scenes/status.scene.dry');
    return ensureArray(surfaceRows).map((row) => {
      const source = row && row.source || {};
      const line = sourceLine(source);
      const path = normalizedPath(source.path || '');
      if (!line || path !== statusPath) {
        return null;
      }
      const original = String(row.originalText || row.label || '').trim();
      if (!original) {
        return null;
      }
      const section = sectionForLine(status, line);
      const heading = /^=+\s*/.test(original);
      return {
        id: row.id || ('surface_status_' + line),
        role: heading ? 'heading' : 'status_line',
        text: heading ? cleanSurfaceText(row.label || original) : original,
        originalText: original,
        owner: {
          kind: 'scene',
          sceneId: statusId,
          sectionId: section && section.id || '',
          sceneType: status.type || 'status'
        },
        source: Object.assign({}, source, {
          startLine: line,
          endLine: sourceEndLine(source) || line,
          anchorText: original,
          endAnchorText: original
        }),
        confidence: row.confidence || 'static',
        editability: row.editability || 'draft_exportable',
        surfaceText: true
      };
    }).filter(Boolean);
  }

  function sectionForLine(status, line) {
    const lineNumber = Number(line || 0);
    if (!lineNumber) {
      return null;
    }
    return ensureArray(status && status.sections).find((section) => {
      const span = section && section.sourceSpan || {};
      const start = Number(span.startLine || span.line || 0);
      const end = Number(span.endLine || span.startLine || span.line || 0);
      return start && end && start <= lineNumber && lineNumber <= end;
    }) || null;
  }

  function uniqueStatusRows(rows) {
    const seen = new Set();
    return ensureArray(rows).filter((row) => {
      const key = [
        String(row && row.role || ''),
        String(sourceLine(row && row.source) || ''),
        String(sourceAnchor(row))
      ].join('|');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function sectionFromRows(section, rows) {
    const textRows = ensureArray(rows).sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
    const heading = firstText(textRows, 'heading') || titleCase(section.label || section.id || 'Status');
    const body = bodyText(textRows);
    const statusLines = conditionalStatusLines(textRows);
    return {
      id: normalizeSectionId(section.id || section.anchorId || MAIN_SECTION_ID),
      anchorId: String(section.anchorId || ''),
      label: String(section.label || heading || section.id || ''),
      heading,
      body,
      statusLines,
      path: normalizedPath(section.path || ''),
      line: section.line || null,
      evidence: sectionEvidence(textRows),
      deleteEvidence: deleteSectionEvidence(section, textRows)
    };
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
    const startLine = sourceLine(first.source);
    const endLine = sourceEndLine(last.source);
    if (!anchorText || !endAnchorText || !startLine || !endLine) {
      return null;
    }
    return {
      path: normalizedPath(first.source && first.source.path),
      anchorText,
      endAnchorText,
      startLine,
      endLine
    };
  }

  function deleteSectionEvidence(section, rows) {
    const anchorId = normalizeSectionId(section && section.anchorId || section && section.id || '');
    if (!anchorId || anchorId === MAIN_SECTION_ID) {
      return null;
    }
    const line = Number(section && section.line || 0);
    const path = normalizedPath(section && section.path || '');
    const contentEvidence = sectionEvidence(rows);
    if (!line || !path || !contentEvidence || !contentEvidence.endAnchorText || !contentEvidence.endLine) {
      return null;
    }
    return {
      path,
      anchorText: '@' + anchorId,
      endAnchorText: contentEvidence.endAnchorText,
      startLine: line,
      endLine: contentEvidence.endLine
    };
  }

  function defaultSection(sections) {
    const list = ensureArray(sections);
    return list.find((section) => section.id === 'organization') ||
      list.find((section) => section.id !== MAIN_SECTION_ID) ||
      list[0] ||
      null;
  }

  function selectSection(model, sectionId) {
    const id = normalizeSectionId(sectionId || MAIN_SECTION_ID);
    return ensureArray(model && model.sections).find((section) => normalizeSectionId(section.id) === id) || null;
  }

  function renderSidebarSection(draft) {
    const lines = ['= ' + (draft.sectionHeading || 'Status')];
    if (draft.sectionBody) {
      lines.push('', draft.sectionBody);
    }
    if (draft.sectionStatusLines) {
      lines.push('', draft.sectionStatusLines);
    }
    return lines.join('\n').replace(/\n+$/, '') + '\n';
  }

  function renderSidebarDeleteManual(draft) {
    return [
      'Manual sidebar deletion review',
      '',
      'Delete category: ' + (draft.sectionId || MAIN_SECTION_ID),
      'Heading: ' + (draft.sectionHeading || ''),
      '',
      'Only remove this source section after checking routes or links that depend on this sidebar category.'
    ].join('\n') + '\n';
  }

  function renderStatusScene(draft) {
    return [
      'title: ' + (draft.statusTitle || 'Status'),
      'new-page: true',
      'is-special: true',
      '',
      renderSidebarSection(draft).trimEnd(),
      ''
    ].join('\n');
  }

  function renderPlayerPreview(draft) {
    if (draft.operationMode === 'delete') {
      return [
        'Sidebar / Status',
        '',
        'Delete sidebar category: ' + (draft.sectionId || MAIN_SECTION_ID),
        'Heading: ' + (draft.sectionHeading || 'Status'),
        '',
        'Review & Apply will remove only the source-backed sidebar section when exact anchors still match.'
      ].join('\n') + '\n';
    }
    return [
      'Sidebar / Status',
      '',
      'Scene: ' + (draft.statusTitle || 'Status'),
      'Section: ' + (draft.sectionId || MAIN_SECTION_ID),
      '',
      draft.sectionHeading || 'Status',
      '',
      draft.sectionBody || '(no sidebar body)',
      draft.sectionStatusLines ? '\n' + draft.sectionStatusLines : ''
    ].join('\n').replace(/\n+$/, '\n');
  }

  function renderInstallNotes(draft, plan) {
    return [
      'Install Assistant: Sidebar / Status proposal',
      '',
      'Draft: ' + draft.id,
      'Section: ' + draft.sectionId,
      draft.operationMode === 'delete' ? 'Operation: delete sidebar category' : 'Operation: edit sidebar category',
      '',
      'Generated operations:',
      ensureArray(plan && plan.operations).map((op) => '- ' + op.type + ' ' + op.path + ' (' + op.safety + ')').join('\n') || '- none',
      '',
      'Safety:',
      '- Existing sidebar edits require exact visible-text start/end anchors.',
      '- Category anchors such as @organization are preserved outside the replacement range.',
      '- Generated/custom sidebar UI remains manual review.'
    ].join('\n') + '\n';
  }

  function statusScene(index, scenes) {
    return ensureArray(scenes).find((scene) => normalizedPath(scene && scene.path) === 'source/scenes/status.scene.dry') ||
      ensureArray(scenes).find((scene) => /^source\/scenes\/status[_A-Za-z0-9.-]*\.scene\.dry$/.test(normalizedPath(scene && scene.path))) ||
      sceneBySemantic(index, scenes, 'status') ||
      ensureArray(scenes).find((scene) => String(scene && scene.id || '') === 'status') ||
      null;
  }

  function sceneBySemantic(index, scenes, key) {
    const ids = ensureArray(index.semantic && index.semantic[key]).map((item) => String(item && item.id || item || ''));
    return ensureArray(scenes).find((scene) => ids.includes(String(scene.id || ''))) || null;
  }

  function firstText(rows, role) {
    const found = ensureArray(rows).find((row) => String(row.role || '') === role && String(row.text || '').trim());
    return found ? cleanSurfaceText(found.text) : '';
  }

  function bodyText(rows) {
    return ensureArray(rows)
      .filter((row) => !['heading', 'conditional_body', 'status_line'].includes(String(row.role || '')))
      .map((row) => cleanSurfaceText(row.text || row.originalText || ''))
      .filter(Boolean)
      .join('\n');
  }

  function conditionalStatusLines(rows) {
    return ensureArray(rows)
      .filter((row) => ['conditional_body', 'status_line'].includes(String(row.role || '')))
      .map((row) => sourceAnchor(row))
      .filter(Boolean)
      .join('\n');
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

  function cleanSurfaceText(value) {
    return String(value || '').replace(/^=\s*/, '').trim();
  }

  function sourceLine(source) {
    const line = Number(source && (source.line || source.startLine || source.$line) || 0);
    return Number.isFinite(line) && line > 0 ? Math.floor(line) : null;
  }

  function sourceEndLine(source) {
    const line = Number(source && (source.endLine || source.line || source.startLine || source.$line) || 0);
    return Number.isFinite(line) && line > 0 ? Math.floor(line) : null;
  }

  function generatedSurfaceSources(index) {
    const sources = ensureArray(index.semantic && index.semantic.surfaceText && index.semantic.surfaceText.sources);
    return sources.some((source) => normalizedPath(source).startsWith('out/html/'));
  }

  function readinessRow(id, status, label, message) {
    return {id, status, label, message};
  }

  function diagnostic(diagnostics, severity, code, message) {
    diagnostics.push({severity, code, message, confidence: 'exact'});
  }

  function titleCase(value) {
    return String(value || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  }

  function booleanValue(value) {
    return value === true || value === 1 || /^(1|true|yes|on)$/i.test(String(value || '').trim());
  }

  function normalizeSectionId(value) {
    const text = String(value || MAIN_SECTION_ID).trim();
    if (text === 'main' || text === 'root' || text === '__main') {
      return MAIN_SECTION_ID;
    }
    return text.replace(/^status\./, '').replace(/^@/, '') || MAIN_SECTION_ID;
  }

  function normalizedPath(value) {
    return String(value || '').replace(/\\/g, '/');
  }

  function usableEvidence(value) {
    return isObject(value) && value.kind === 'sidebar_status_model';
  }

  function safeId(value) {
    let text = String(value || 'sidebar_status_update')
      .trim()
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!text) {
      text = 'sidebar_status_update';
    }
    if (/^[0-9]/.test(text)) {
      text = 'sidebar_status_' + text;
    }
    return ID_RE.test(text) ? text : 'sidebar_status_update';
  }

  const api = {
    SIDEBAR_STATUS_VERSION,
    SIDEBAR_STATUS_KIND,
    MAIN_SECTION_ID,
    buildSidebarModel,
    defaultDraft,
    normalizeDraft,
    validateDraft,
    buildInstallPlan,
    buildExportBundle,
    renderSidebarSection,
    renderStatusScene
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSidebarStatusDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
