(function initInstallPlan(global) {
  'use strict';

  const INSTALL_PLAN_VERSION = '0.1';
  const INSTALL_PLAN_KIND = 'dendry_mod_studio_install_plan';
  const DEFAULT_VALIDATION_COMMAND = 'bash tools/build_and_validate.sh --skip-build --errors-only';
  const APPLY_STATUSES = new Set(['safe_apply', 'guarded_apply', 'advanced_apply']);
  const INSTALL_LEVELS = {
    safe_apply: 1,
    guarded_apply: 2,
    advanced_apply: 3,
    manual_review: 4,
    refused: 5
  };

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function buildInstallPlan(input) {
    const value = isObject(input) ? input : {};
    const project = projectProvenance(value.project);
    return {
      schemaVersion: INSTALL_PLAN_VERSION,
      kind: INSTALL_PLAN_KIND,
      id: String(value.id || '').trim(),
      draftKind: String(value.draftKind || '').trim(),
      title: String(value.title || value.id || '').trim(),
      status: 'proposal_only',
      validationCommand: String(value.validationCommand || DEFAULT_VALIDATION_COMMAND),
      project,
      operations: ensureArray(value.operations).map(normalizeOperation)
    };
  }

  function projectProvenance(value) {
    if (!isObject(value)) {
      return null;
    }
    const project = {
      name: String(value.name || '').trim(),
      root: String(value.root || '').trim(),
      schemaVersion: String(value.schemaVersion || '').trim(),
      profileIds: ensureArray(value.profileIds).map((profile) => String(profile || '').trim()).filter(Boolean)
    };
    if (!project.name && !project.root && !project.schemaVersion && !project.profileIds.length) {
      return null;
    }
    return project;
  }

  function projectProvenanceFromIndex(projectIndex) {
    if (!isObject(projectIndex)) {
      return null;
    }
    const project = isObject(projectIndex.project) ? projectIndex.project : {};
    return projectProvenance({
      name: project.name,
      root: project.root,
      schemaVersion: projectIndex.schemaVersion,
      profileIds: project.profileIds
    });
  }

  function normalizeOperation(operation, index) {
    const value = isObject(operation) ? clone(operation) : {};
    value.id = String(value.id || 'op_' + (index + 1)).trim();
    value.type = String(value.type || 'manual_snippet').trim();
    value.path = String(value.path || '').trim();
    value.description = String(value.description || '').trim();
    value.safety = String(value.safety || 'manual_review').trim();
    if (!APPLY_STATUSES.has(value.safety) && value.safety !== 'manual_review') {
      value.safety = 'manual_review';
    }
    value.content = value.content === undefined || value.content === null ? '' : String(value.content);
    value.search = value.search === undefined || value.search === null ? '' : String(value.search);
    value.replace = value.replace === undefined || value.replace === null ? '' : String(value.replace);
    value.anchorText = value.anchorText === undefined || value.anchorText === null ? '' : String(value.anchorText);
    value.endAnchorText = value.endAnchorText === undefined || value.endAnchorText === null ? '' : String(value.endAnchorText);
    value.position = String(value.position || 'after').trim() === 'before' ? 'before' : 'after';
    value.dedupeSearch = value.dedupeSearch === undefined || value.dedupeSearch === null ? '' : String(value.dedupeSearch);
    value.sourceName = value.sourceName === undefined || value.sourceName === null ? '' : String(value.sourceName);
    value.sourcePath = value.sourcePath === undefined || value.sourcePath === null ? '' : String(value.sourcePath);
    value.assetType = value.assetType === undefined || value.assetType === null ? '' : String(value.assetType);
    value.label = value.label === undefined || value.label === null ? '' : String(value.label);
    value.role = value.role === undefined || value.role === null ? '' : String(value.role);
    if (value.line !== undefined && value.line !== null && value.line !== '') {
      const line = Number(value.line);
      value.line = Number.isFinite(line) && line > 0 ? Math.floor(line) : null;
    } else {
      value.line = null;
    }
    value.startLine = numberOrNull(value.startLine);
    value.endLine = numberOrNull(value.endLine);
    return value;
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? Math.floor(number) : null;
  }

  function eventInstallPlan(options) {
    const id = String(options.id || '').trim();
    return buildInstallPlan({
      id,
      draftKind: 'world_event',
      title: options.title || id,
      project: options.project || null,
      operations: [
        {
          id: 'create_scene',
          type: 'create_file',
          path: 'source/scenes/events/' + id + '.scene.dry',
          content: options.scene || '',
          safety: 'safe_apply',
          description: 'Create the exported world event scene.'
        },
        {
          id: 'root_seen_flag',
          type: 'insert_text',
          path: 'source/scenes/root.scene.dry',
          content: options.rootSnippet || '',
          anchorText: options.rootAnchorText || '// ====== U. EVENT SEEN FLAGS ======',
          position: 'after',
          dedupeSearch: options.rootDedupeSearch || options.rootSnippet || '',
          safety: 'guarded_apply',
          description: 'Insert the generated seen flag init near event seen flags after matching the root anchor.'
        },
        {
          id: 'post_event_migration',
          type: 'insert_text',
          path: 'source/scenes/post_event.scene.dry',
          content: options.migrationSnippet || '',
          anchorText: options.migrationAnchorText || '// Save compatibility: post_event split (post_event_news)',
          position: 'after',
          dedupeSearch: options.migrationDedupeSearch || options.migrationSnippet || '',
          safety: 'guarded_apply',
          description: 'Insert the generated old-save migration guard after matching the post_event compatibility anchor.'
        }
      ].concat(assetInstallOperations(options.assetInstallRequests))
    });
  }

  function newsInstallPlan(options) {
    const id = String(options.id || '').trim();
    const router = newsRouterInstallOptions(options.router);
    const operation = router
      ? {
          id: 'post_event_news_snippet',
          type: 'insert_text',
          path: router.path,
          content: options.snippet || '',
          anchorText: router.anchorText,
          position: router.position,
          dedupeSearch: router.dedupeSearch,
          safety: 'guarded_apply',
          description: 'Insert the news snippet into post_event_news after matching a known router anchor and dedupe token.'
        }
      : {
          id: 'post_event_news_snippet',
          type: 'manual_snippet',
          path: 'source/scenes/post_event_news.scene.dry',
          content: options.snippet || '',
          safety: 'manual_review',
          description: 'Paste the news snippet into the matching post_event_news section.'
        };
    return buildInstallPlan({
      id,
      draftKind: 'news_item',
      title: options.title || id,
      project: options.project || null,
      operations: [operation]
    });
  }

  function newsRouterInstallOptions(input) {
    const router = isObject(input) ? input : {};
    const path = String(router.path || '').trim();
    const anchorText = String(router.anchorText || '').trim();
    const dedupeSearch = String(router.dedupeSearch || '').trim();
    if (!path || !anchorText || !dedupeSearch) {
      return null;
    }
    return {
      path,
      anchorText,
      position: String(router.position || 'after').trim() === 'before' ? 'before' : 'after',
      dedupeSearch
    };
  }

  function cardInstallPlan(options) {
    const id = String(options.id || '').trim();
    return buildInstallPlan({
      id,
      draftKind: 'card',
      title: options.title || id,
      project: options.project || null,
      operations: [
        {
          id: 'create_scene',
          type: 'create_file',
          path: options.suggestedPath || 'source/scenes/cards/' + id + '.scene.dry',
          content: options.scene || '',
          safety: 'safe_apply',
          description: 'Create the exported card scene.'
        },
      ].concat(options.skipWiringManual ? [] : [
        {
          id: 'wire_card_flow',
          type: 'manual_snippet',
          path: options.wiringPath || (options.cardKind === 'advisor_like' ? 'source/scenes/circles/' : 'source/scenes/cards/'),
          content: options.wiringProposal || 'Wire this scene into the matching hand/deck/sidebar flow by hand.\n',
          safety: 'manual_review',
          description: 'Review hand/deck/sidebar wiring for this card.'
        }
      ]).concat(assetInstallOperations(options.assetInstallRequests))
    });
  }

  function surfaceTextInstallPlan(draft, options) {
    const opts = isObject(options) ? options : {};
    const id = String(draft.id || '').trim();
    const source = draft.source || {};
    const editability = String(draft.editability || '');
    const singleLineTextProposal = editability === 'text_proposal' && textProposalCanGuard(draft);
    const safety = editability === 'draft_exportable'
      ? 'safe_apply'
      : editability === 'draft_extractable'
        ? 'guarded_apply'
        : singleLineTextProposal
          ? 'guarded_apply'
        : 'manual_review';
    const isTextProposal = editability === 'text_proposal';
    return buildInstallPlan({
      id,
      draftKind: 'surface_text',
      title: id,
      project: opts.project || null,
      operations: [
        safety !== 'manual_review'
          ? {
              id: 'replace_label',
              type: 'replace_text',
              path: source.path || '',
              line: source.line || null,
              search: draft.originalLabel || '',
              replace: draft.replacementLabel || '',
              safety,
              description: isTextProposal
                ? 'Text proposal: replace player-facing prose after matching the indexed original text and exact line evidence.'
                : safety === 'guarded_apply'
                ? 'Replace source scene text after matching the indexed original text and line evidence.'
                : 'Replace a source-backed surface label after matching the original text.'
            }
          : {
              id: 'manual_label_review',
              type: 'manual_snippet',
              path: source.path || '',
              line: source.line || null,
              content: isTextProposal
                ? 'Text proposal: review this proposal-first wording manually before changing source.\n\nOriginal:\n' + (draft.originalLabel || '') + '\n\nSuggested replacement:\n' + (draft.replacementLabel || '') + '\n'
                : 'Replace "' + (draft.originalLabel || '') + '" with "' + (draft.replacementLabel || '') + '" after reviewing the owning source.\n',
              safety: 'manual_review',
              description: isTextProposal
                ? 'Text proposal: proposal-first manual review for Text Corpus prose; do not auto-apply as replace_text.'
                : 'IDE escape hatch: source is generated, runtime-owned, or ambiguous.'
            }
      ]
    });
  }

  function existingSceneEditInstallPlan(proposal, options) {
    const opts = isObject(options) ? options : {};
    const draft = isObject(proposal) ? proposal : {};
    const id = String(draft.id || 'existing_scene_edit').trim();
    const operations = ensureArray(draft.changes).map((change, index) => existingSceneChangeOperation(change, index));
    return buildInstallPlan({
      id,
      draftKind: 'existing_scene_edit',
      title: draft.title || id,
      project: opts.project || draft.project || null,
      operations
    });
  }

  function existingSceneChangeOperation(change, index) {
    const value = isObject(change) ? change : {};
    const source = isObject(value.source) ? value.source : {};
    const path = String(source.path || value.sourcePath || '').trim();
    const line = numberOrNull(source.line || source.startLine);
    const endLine = numberOrNull(source.endLine || value.endLine || source.line || source.startLine);
    const before = String(value.before === undefined || value.before === null ? '' : value.before);
    const after = String(value.after === undefined || value.after === null ? '' : value.after);
    const id = 'replace_existing_' + (index + 1);
    const label = String(value.label || value.role || 'field').trim();
    if (existingSceneSectionCanGuard(value, path, line, endLine, after)) {
      return {
        id,
        type: 'replace_section',
        path,
        anchorText: value.anchorText,
        endAnchorText: value.endAnchorText,
        content: after.endsWith('\n') ? after : after + '\n',
        dedupeSearch: value.dedupeSearch || after.trim(),
        startLine: value.startLine || line,
        endLine: value.endLine || endLine,
        safety: 'guarded_apply',
        role: 'existing_scene.section_text',
        description: 'Replace existing ' + label + ' section text after confirming exact source anchors still match.'
      };
    }
    if (existingSceneChangeCanGuard(path, line, source.endLine || source.line || source.startLine, before, after)) {
      return {
        id,
        type: 'replace_text',
        path,
        line,
        search: before,
        replace: after,
        safety: 'guarded_apply',
        description: 'Replace existing ' + label + ' in the source scene after confirming the original line still matches.'
      };
    }
    return {
      id: 'manual_existing_' + (index + 1),
      type: 'manual_snippet',
      path,
      line,
      content: [
        'Existing scene edit needs IDE review before changing source.',
        'Field: ' + label,
        'Before:',
        before || '(empty)',
        '',
        'After:',
        after || '(empty)'
      ].join('\n') + '\n',
      safety: 'manual_review',
      description: path && isProtectedRouterPath(path)
        ? 'Protected/router scene field requires manual IDE review.'
        : 'Existing scene field lacks exact single-line source evidence for guarded apply.'
    };
  }

  function existingSceneChangeCanGuard(path, line, endLine, before, after) {
    const rel = String(path || '').replace(/\\/g, '/');
    const sourceLine = Number(line || 0);
    const sourceEndLine = Number(endLine || sourceLine || 0);
    return Boolean(
      rel.startsWith('source/scenes/') &&
      rel.endsWith('.scene.dry') &&
      !isProtectedRouterPath(rel) &&
      Number.isInteger(sourceLine) &&
      sourceLine > 0 &&
      (!Number.isInteger(sourceEndLine) || sourceEndLine <= 0 || sourceEndLine === sourceLine) &&
      String(before || '').trim() &&
      String(after || '').trim()
    );
  }

  function existingSceneSectionCanGuard(change, path, line, endLine, after) {
    const value = isObject(change) ? change : {};
    const rel = String(path || '').replace(/\\/g, '/');
    const sourceLine = Number(line || 0);
    const sourceEndLine = Number(endLine || 0);
    return Boolean(
      value.operationType === 'replace_section' &&
      rel.startsWith('source/scenes/') &&
      rel.endsWith('.scene.dry') &&
      !isProtectedRouterPath(rel) &&
      Number.isInteger(sourceLine) &&
      sourceLine > 0 &&
      Number.isInteger(sourceEndLine) &&
      sourceEndLine >= sourceLine &&
      String(value.anchorText || '').trim() &&
      String(value.endAnchorText || '').trim() &&
      String(after || '').trim()
    );
  }

  function textProposalCanGuard(draft) {
    const source = isObject(draft && draft.source) ? draft.source : {};
    const path = String(source.path || '');
    const line = Number(source.line || source.startLine || 0);
    const endLine = Number(source.endLine || line || 0);
    if (!path.startsWith('source/scenes/') || !path.endsWith('.scene.dry')) {
      return false;
    }
    if (isProtectedRouterPath(path)) {
      return false;
    }
    if (!Number.isInteger(line) || line < 1) {
      return false;
    }
    if (Number.isInteger(endLine) && endLine > 0 && endLine !== line) {
      return false;
    }
    return Boolean(String(draft.originalLabel || '').trim() && String(draft.replacementLabel || '').trim());
  }

  function assetInstallOperations(requests) {
    return ensureArray(requests).map(normalizeAssetInstallRequest).filter((request) => request.targetPath).map((request, index) => ({
      id: 'copy_asset_file_' + (index + 1),
      type: 'copy_asset_file',
      path: request.targetPath,
      sourceName: request.sourceName,
      sourcePath: request.sourcePath,
      assetType: request.type,
      label: request.label,
      role: request.role,
      content: [
        'Copy asset file into the project before expecting this draft reference to work.',
        'Source file: ' + (request.sourceName || request.sourcePath || '(select a local file)'),
        'Target path: ' + request.targetPath
      ].join('\n') + '\n',
      safety: request.sourcePath ? 'guarded_apply' : 'manual_review',
      description: 'Asset file install proposal: copy the selected local asset into the project, then review the Event/Card assetRefs path.'
    }));
  }

  function normalizeAssetInstallRequest(input) {
    const value = isObject(input) ? input : {sourceName: input};
    const targetPath = String(value.targetPath || value.target || value.path || '').trim();
    return {
      sourceName: String(value.sourceName || value.fileName || value.name || '').trim(),
      sourcePath: String(value.sourcePath || '').trim(),
      targetPath,
      type: String(value.type || value.assetType || '').trim(),
      label: String(value.label || value.sourceName || '').trim(),
      role: String(value.role || '').trim()
    };
  }

  function renderInstallPlanJson(plan) {
    return JSON.stringify(plan, null, 2) + '\n';
  }

  function classifyOperation(operation) {
    const op = normalizeOperation(operation || {}, 0);
    if (!APPLY_STATUSES.has(op.safety)) {
      return {
        status: 'manual_review',
        label: 'Manual review',
        level: INSTALL_LEVELS.manual_review,
        reason: op.description || 'This operation must be reviewed and installed by hand.',
        operation: op
      };
    }
    const pathCheck = portablePathSafety(op.path);
    if (!pathCheck.ok) {
      return {
        status: 'refused',
        label: 'Protected / refused',
        level: INSTALL_LEVELS.refused,
        reason: pathCheck.message,
        operation: op
      };
    }
    const permission = operationPermission(op, pathCheck.relative, op.safety);
    if (!permission.ok) {
      return {
        status: 'refused',
        label: 'Protected / refused',
        level: INSTALL_LEVELS.refused,
        reason: permission.message,
        operation: op
      };
    }
    const labels = {
      safe_apply: 'Safe apply',
      guarded_apply: 'Guarded install',
      advanced_apply: 'Advanced install'
    };
    return {
      status: op.safety,
      label: labels[op.safety] || 'Installable',
      level: INSTALL_LEVELS[op.safety] || INSTALL_LEVELS.manual_review,
      reason: op.description || permission.message || 'This operation is eligible for guarded apply.',
      operation: op
    };
  }

  function operationSummary(plan) {
    const summary = {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 0, refused: 0, total: 0};
    ensureArray(plan && plan.operations).forEach((operation) => {
      summary.total += 1;
      const classification = classifyOperation(operation);
      if (classification.status === 'safe_apply') {
        summary.safeApply += 1;
      } else if (classification.status === 'guarded_apply') {
        summary.guardedApply += 1;
      } else if (classification.status === 'advanced_apply') {
        summary.advancedApply += 1;
      } else if (classification.status === 'manual_review') {
        summary.manualReview += 1;
      } else {
        summary.refused += 1;
      }
    });
    return summary;
  }

  function renderOperationChecklist(plan) {
    const operations = ensureArray(plan && plan.operations);
    const groups = [
      ['safe_apply', 'Safe apply'],
      ['guarded_apply', 'Guarded install'],
      ['advanced_apply', 'Advanced install'],
      ['manual_review', 'Manual review'],
      ['refused', 'Protected / refused']
    ];
    const classifications = operations.map(classifyOperation);
    const lines = [
      'Install operation checklist',
      'Status: proposal only / not installed',
      ''
    ];
    groups.forEach(([status, title]) => {
      const group = classifications.filter((item) => item.status === status);
      lines.push(title + ' (' + group.length + ')');
      if (!group.length) {
        lines.push('- none');
      } else {
        group.forEach((item) => {
          const op = item.operation;
          lines.push('- ' + op.type + ' ' + (op.path || '(unknown path)') + ' — ' + item.reason);
        });
      }
      lines.push('');
    });
    return lines.join('\n').replace(/\n+$/, '\n');
  }

  function renderPatchPreview(plan) {
    return ensureArray(plan.operations).map(renderOperationPreview).join('\n');
  }

  function renderOperationPreview(operation) {
    const pathLabel = operation.path || '(unknown-path)';
    if (operation.type === 'create_file') {
      return [
        'diff --git a/' + pathLabel + ' b/' + pathLabel,
        'new file mode 100644',
        '--- /dev/null',
        '+++ b/' + pathLabel,
        '@@',
        prefixLines('+', operation.content || '')
      ].join('\n') + '\n';
    }
    if (operation.type === 'replace_text') {
      const lineLabel = operation.line ? ' line ' + operation.line : '';
      return [
        'diff --git a/' + pathLabel + ' b/' + pathLabel,
        '--- a/' + pathLabel,
        '+++ b/' + pathLabel,
        '@@' + lineLabel,
        '-' + (operation.search || ''),
        '+' + (operation.replace || '')
      ].join('\n') + '\n';
    }
    if (operation.type === 'insert_text') {
      return [
        'diff --git a/' + pathLabel + ' b/' + pathLabel,
        '--- a/' + pathLabel,
        '+++ b/' + pathLabel,
        '@@ insert ' + (operation.position || 'after') + ' anchor',
        ' ' + (operation.anchorText || '(missing anchor)'),
        prefixLines('+', operation.content || '')
      ].join('\n') + '\n';
    }
    if (operation.type === 'replace_section') {
      return [
        'diff --git a/' + pathLabel + ' b/' + pathLabel,
        '--- a/' + pathLabel,
        '+++ b/' + pathLabel,
        '@@ replace section',
        ' ' + (operation.anchorText || '(missing start anchor)'),
        ' ' + (operation.endAnchorText || '(missing end anchor)'),
        prefixLines('+', operation.content || '')
      ].join('\n') + '\n';
    }
    if (operation.type === 'copy_asset_file') {
      return [
        'diff --git a/' + pathLabel + ' b/' + pathLabel,
        'new asset file proposal',
        '--- /dev/null',
        '+++ b/' + pathLabel,
        '@@ asset file install proposal',
        '+# source: ' + (operation.sourceName || operation.sourcePath || '(select a local file)'),
        '+# target: ' + pathLabel,
        '+# ' + (operation.description || 'Copy this asset file by hand.')
      ].join('\n') + '\n';
    }
    return [
      'diff --git a/' + pathLabel + ' b/' + pathLabel,
      '--- a/' + pathLabel,
      '+++ b/' + pathLabel,
      '@@ manual review required',
      '+# ' + (operation.description || 'Manual operation'),
      prefixLines('+', operation.content || '')
    ].join('\n') + '\n';
  }

  function prefixLines(prefix, text) {
    const lines = String(text || '').replace(/\n$/, '').split('\n');
    if (lines.length === 1 && lines[0] === '') {
      return prefix;
    }
    return lines.map((line) => prefix + line).join('\n');
  }

  function applyInstallPlan(plan, options) {
    const node = nodeModules();
    if (!node) {
      return {
        ok: false,
        dryRun: Boolean(options && options.dryRun !== false),
        results: [],
        diagnostics: [diagnostic('error', 'install_plan.node_only', 'Applying install plans requires Node.js filesystem access.')]
      };
    }
    const fs = node.fs;
    const path = node.path;
    const opts = isObject(options) ? options : {};
    const dryRun = opts.dryRun !== false;
    const allowAdvanced = opts.allowAdvanced === true;
    const projectRoot = opts.projectRoot ? path.resolve(String(opts.projectRoot)) : '';
    const diagnostics = [];
    const results = [];
    const operations = ensureArray(plan.operations).map(normalizeOperation);
    const summary = operationSummary({operations});

    if (!projectRoot) {
      diagnostics.push(diagnostic('error', 'install_plan.project_root', 'projectRoot is required.'));
      return {ok: false, dryRun, operationSummary: summary, results, diagnostics};
    }
    if (!fs.existsSync(path.join(projectRoot, 'source', 'info.dry'))) {
      diagnostics.push(diagnostic('error', 'install_plan.project_root', 'source/info.dry was not found under projectRoot.'));
      return {ok: false, dryRun, operationSummary: summary, results, diagnostics};
    }
    const provenanceCheck = validateProjectProvenance(plan && plan.project, projectRoot, path);
    if (!provenanceCheck.ok) {
      diagnostics.push(diagnostic('error', 'install_plan.project_mismatch', provenanceCheck.message));
      return {ok: false, dryRun, operationSummary: summary, results, diagnostics};
    }

    operations.forEach((operation) => {
      if (!APPLY_STATUSES.has(operation.safety)) {
        results.push({id: operation.id, type: operation.type, path: operation.path, status: 'manual_review'});
        return;
      }
      if (operation.safety === 'advanced_apply' && !allowAdvanced) {
        results.push({id: operation.id, type: operation.type, path: operation.path, status: 'advanced_review'});
        return;
      }
      const target = resolveSafeTarget(projectRoot, operation.path, path);
      if (!target.ok) {
        diagnostics.push(diagnostic('error', 'install_plan.unsafe_path', target.message, operation));
        results.push({id: operation.id, type: operation.type, path: operation.path, status: 'failed'});
        return;
      }
      const permission = operationPermission(operation, target.relative, operation.safety);
      if (!permission.ok) {
        diagnostics.push(diagnostic('error', 'install_plan.unsafe_path', permission.message, operation));
        results.push({id: operation.id, type: operation.type, path: operation.path, status: 'failed'});
        return;
      }
      if (operation.type === 'create_file') {
        results.push(applyCreateFile(fs, path, target.path, operation, dryRun, diagnostics));
        return;
      }
      if (operation.type === 'replace_text') {
        results.push(applyReplaceText(fs, target.path, operation, dryRun, diagnostics));
        return;
      }
      if (operation.type === 'insert_text') {
        results.push(applyInsertText(fs, target.path, operation, dryRun, diagnostics));
        return;
      }
      if (operation.type === 'replace_section') {
        results.push(applyReplaceSection(fs, target.path, operation, dryRun, diagnostics));
        return;
      }
      if (operation.type === 'copy_asset_file') {
        results.push(applyCopyAssetFile(fs, path, node.crypto, target.path, operation, dryRun, diagnostics));
        return;
      }
      diagnostics.push(diagnostic('error', 'install_plan.unsupported_operation', 'Unsupported safe operation: ' + operation.type, operation));
      results.push({id: operation.id, type: operation.type, path: operation.path, status: 'failed'});
    });

    return {
      ok: diagnostics.every((item) => item.severity !== 'error'),
      dryRun,
      operationSummary: summary,
      results,
      diagnostics
    };
  }

  function nodeModules() {
    if (typeof require !== 'function') {
      return null;
    }
    return {fs: require('fs'), path: require('path'), crypto: require('crypto')};
  }

  function resolveSafeTarget(projectRoot, relPath, path) {
    if (!relPath) {
      return {ok: false, message: 'Operation path is required.'};
    }
    if (path.isAbsolute(relPath)) {
      return {ok: false, message: 'Operation path must be relative to the project root: ' + relPath};
    }
    const target = path.resolve(projectRoot, relPath);
    const relative = path.relative(projectRoot, target);
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
      return {ok: false, message: 'Operation path escapes the project root: ' + relPath};
    }
    if (relative === '.git' || relative.startsWith('.git' + path.sep)) {
      return {ok: false, message: 'Operation path targets .git: ' + relPath};
    }
    const outHtml = path.join('out', 'html');
    if (
      relative === path.join('out', 'game.json') ||
      relative === outHtml ||
      relative.startsWith(outHtml + path.sep)
    ) {
      return {ok: false, message: 'Operation path targets generated/protected output: ' + relPath};
    }
    return {ok: true, path: target, relative: relative.split(path.sep).join('/')};
  }

  function validateProjectProvenance(project, projectRoot, path) {
    const provenance = projectProvenance(project);
    if (!provenance || !provenance.root) {
      return {ok: true};
    }
    const pathApi = path || (nodeModules() && nodeModules().path);
    if (!pathApi) {
      return {ok: true};
    }
    const expectedRoot = pathApi.resolve(String(provenance.root));
    const actualRoot = pathApi.resolve(String(projectRoot));
    if (expectedRoot !== actualRoot) {
      return {
        ok: false,
        message: 'Install plan was generated for a different project root. Plan root: ' + expectedRoot + '; open project root: ' + actualRoot + '.'
      };
    }
    return {ok: true};
  }

  function portablePathSafety(relPath) {
    if (!relPath) {
      return {ok: false, message: 'Operation path is required.'};
    }
    const rel = String(relPath || '').replace(/\\/g, '/');
    if (rel.startsWith('/') || /^[A-Za-z]:\//.test(rel)) {
      return {ok: false, message: 'Operation path must be relative to the project root: ' + relPath};
    }
    const parts = rel.split('/').filter(Boolean);
    if (!parts.length || parts.includes('..')) {
      return {ok: false, message: 'Operation path escapes the project root: ' + relPath};
    }
    if (parts[0] === '.git') {
      return {ok: false, message: 'Operation path targets .git: ' + relPath};
    }
    if (rel === 'out/game.json' || rel === 'out/html' || rel.startsWith('out/html/')) {
      return {ok: false, message: 'Operation path targets generated/protected output: ' + relPath};
    }
    return {ok: true, relative: parts.join('/')};
  }

  function operationPermission(operation, relative, safety) {
    const rel = String(relative || '').replace(/\\/g, '/');
    if (isProtectedRouterPath(rel) && safety !== 'advanced_apply') {
      if (
        operation.type === 'insert_text' &&
        safety === 'guarded_apply' &&
        (
          rel === 'source/scenes/root.scene.dry' ||
          rel === 'source/scenes/post_event.scene.dry' ||
          rel === 'source/scenes/post_event_news.scene.dry'
        ) &&
        operation.anchorText &&
        operation.content &&
        operation.dedupeSearch
      ) {
        return {ok: true, message: 'Guarded insert_text is allowed with an exact anchor and dedupe evidence.'};
      }
      if (
        operation.type === 'replace_text' &&
        safety === 'guarded_apply' &&
        rel === 'source/scenes/root.scene.dry' &&
        isEntrySidebarProtectedReplace(operation)
      ) {
        return {ok: true, message: 'Guarded Entry/Sidebar replacement is allowed with exact root line evidence.'};
      }
      if (
        operation.type === 'replace_section' &&
        safety === 'guarded_apply' &&
        rel === 'source/scenes/root.scene.dry' &&
        isEntrySidebarProtectedSection(operation)
      ) {
        return {ok: true, message: 'Guarded Entry/Sidebar section replacement is allowed with exact root anchors.'};
      }
      return {ok: false, message: 'Operation path is manual-review only: ' + rel};
    }
    if (rel === 'source/info.dry') {
      if (operation.type === 'replace_text' && safety === 'guarded_apply' && isProjectMetadataReplace(operation)) {
        return {ok: true, message: 'Guarded project metadata replacement is allowed with exact info.dry line evidence.'};
      }
      if (operation.type === 'insert_text' && safety === 'guarded_apply' && isProjectMetadataInsert(operation)) {
        return {ok: true, message: 'Guarded project metadata insert is allowed with an exact info.dry anchor and dedupe evidence.'};
      }
      return {ok: false, message: 'source/info.dry edits are limited to guarded project metadata fields.'};
    }
    if (operation.type === 'create_file') {
      if (!rel.endsWith('.scene.dry')) {
        return {ok: false, message: 'create_file safe apply is limited to .scene.dry files: ' + rel};
      }
      if (
        rel.startsWith('source/scenes/events/') ||
        rel.startsWith('source/scenes/decks/') ||
        rel.startsWith('source/scenes/cards/') ||
        rel.startsWith('source/scenes/advisors/') ||
        rel.startsWith('source/scenes/circles/')
      ) {
        return {ok: true};
      }
      if (rel === 'source/scenes/status.scene.dry' || /^source\/scenes\/status_[A-Za-z0-9_.-]+\.scene\.dry$/.test(rel)) {
        return {ok: true, message: 'Safe create_file may add a source-backed status/sidebar scene.'};
      }
      return {ok: false, message: 'create_file safe apply is limited to event/deck/card/advisor/status scene proposal directories: ' + rel};
    }
    if (operation.type === 'replace_text') {
      if (safety === 'advanced_apply') {
        if (isProtectedRouterPath(rel) && operation.line) {
          return {ok: true, message: 'Advanced replace_text is allowed only with exact line evidence.'};
        }
        return {ok: false, message: 'advanced replace_text requires a protected known file and exact line evidence: ' + rel};
      }
      if (safety === 'guarded_apply') {
        if (rel.startsWith('source/scenes/') && rel.endsWith('.scene.dry') && !isProtectedRouterPath(rel)) {
          return {ok: true, message: 'Guarded scene text replacement with source evidence.'};
        }
        if (rel === 'source/scenes/root.scene.dry' && isEntrySidebarProtectedReplace(operation)) {
          return {ok: true, message: 'Guarded Entry/Sidebar replacement with exact root line evidence.'};
        }
        return {ok: false, message: 'guarded replace_text is limited to non-router source scene files: ' + rel};
      }
      if (rel.startsWith('source/qdisplays/') && rel.endsWith('.qdisplay.dry')) {
        return {ok: true};
      }
      if (rel.startsWith('source/scenes/status') && rel.endsWith('.scene.dry')) {
        return {ok: true};
      }
      return {ok: false, message: 'replace_text safe apply is limited to source-backed surface text files: ' + rel};
    }
    if (operation.type === 'insert_text') {
      if (safety === 'guarded_apply' && rel.startsWith('source/scenes/') && rel.endsWith('.scene.dry') && operation.anchorText && operation.dedupeSearch) {
        return {ok: true, message: 'Guarded source insert with anchor and dedupe evidence.'};
      }
      return {ok: false, message: 'insert_text requires guarded source scene evidence: ' + rel};
    }
    if (operation.type === 'replace_section') {
      if (
        safety === 'guarded_apply' &&
        rel.startsWith('source/scenes/') &&
        rel.endsWith('.scene.dry') &&
        operation.anchorText &&
        operation.endAnchorText &&
        operation.content &&
        operation.dedupeSearch &&
        (!isProtectedRouterPath(rel) || (rel === 'source/scenes/root.scene.dry' && isEntrySidebarProtectedSection(operation)))
      ) {
        return {ok: true, message: 'Guarded source section replacement with exact start/end anchors and dedupe evidence.'};
      }
      return {ok: false, message: 'replace_section requires guarded source scene anchors and dedupe evidence: ' + rel};
    }
    if (operation.type === 'copy_asset_file') {
      if (safety !== 'guarded_apply') {
        return {ok: false, message: 'copy_asset_file requires guarded desktop source evidence: ' + rel};
      }
      if (!operation.sourcePath) {
        return {ok: false, message: 'copy_asset_file requires a desktop sourcePath.'};
      }
      if (!isAssetInstallTargetPath(rel)) {
        return {ok: false, message: 'copy_asset_file is limited to project asset folders: ' + rel};
      }
      if (!isKnownAssetExtension(rel) && !isKnownAssetExtension(operation.sourceName || operation.sourcePath)) {
        return {ok: false, message: 'copy_asset_file target must look like an image or audio asset: ' + rel};
      }
      return {ok: true, message: 'Guarded asset file copy with desktop source path and safe project target.'};
    }
    return {ok: false, message: 'Unsupported safe operation type: ' + operation.type};
  }

  function isAssetInstallTargetPath(relPath) {
    const rel = String(relPath || '').replace(/\\/g, '/');
    return rel.startsWith('assets/') ||
      rel.startsWith('img/') ||
      rel.startsWith('images/') ||
      rel.startsWith('music/') ||
      rel.startsWith('audio/') ||
      rel.startsWith('source/assets/');
  }

  function isKnownAssetExtension(value) {
    return /\.(png|jpe?g|gif|webp|svg|mp3|ogg|wav|flac|m4a)$/i.test(String(value || '').split(/[?#]/)[0]);
  }

  function isProtectedRouterPath(relPath) {
    const rel = String(relPath || '').replace(/\\/g, '/');
    return rel === 'source/scenes/root.scene.dry' ||
      rel === 'source/scenes/post_event.scene.dry' ||
      rel === 'source/scenes/post_event_news.scene.dry';
  }

  function safeOperationPermission(operation, relative) {
    return operationPermission(operation, relative, 'safe_apply');
  }

  function applyCreateFile(fs, path, target, operation, dryRun, diagnostics) {
    if (fs.existsSync(target)) {
      diagnostics.push(diagnostic('error', 'install_plan.create_exists', 'Target file already exists: ' + operation.path, operation));
      return {id: operation.id, type: operation.type, path: operation.path, status: 'failed'};
    }
    if (!dryRun) {
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, operation.content || '', 'utf8');
    }
    return {id: operation.id, type: operation.type, path: operation.path, status: dryRun ? 'would_apply' : 'applied'};
  }

  function applyReplaceText(fs, target, operation, dryRun, diagnostics) {
    if (!fs.existsSync(target)) {
      diagnostics.push(diagnostic('error', 'install_plan.replace_missing_file', 'Target file does not exist: ' + operation.path, operation));
      return {id: operation.id, type: operation.type, path: operation.path, status: 'failed'};
    }
    const before = fs.readFileSync(target, 'utf8');
    const after = replaceOnce(before, operation);
    if (!after.ok) {
      diagnostics.push(diagnostic('error', after.code, after.message, operation));
      return {id: operation.id, type: operation.type, path: operation.path, status: 'failed'};
    }
    if (!dryRun) {
      fs.writeFileSync(target, after.text, 'utf8');
    }
    return {id: operation.id, type: operation.type, path: operation.path, status: dryRun ? 'would_apply' : 'applied'};
  }

  function applyInsertText(fs, target, operation, dryRun, diagnostics) {
    if (!fs.existsSync(target)) {
      diagnostics.push(diagnostic('error', 'install_plan.insert_missing_file', 'Target file does not exist: ' + operation.path, operation));
      return {id: operation.id, type: operation.type, path: operation.path, status: 'failed'};
    }
    const before = fs.readFileSync(target, 'utf8');
    const inserted = insertAtAnchor(before, operation);
    if (!inserted.ok) {
      diagnostics.push(diagnostic('error', inserted.code, inserted.message, operation));
      return {id: operation.id, type: operation.type, path: operation.path, status: 'failed'};
    }
    if (inserted.alreadyApplied) {
      return {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied'};
    }
    if (!dryRun) {
      fs.writeFileSync(target, inserted.text, 'utf8');
    }
    return {id: operation.id, type: operation.type, path: operation.path, status: dryRun ? 'would_apply' : 'applied'};
  }

  function applyReplaceSection(fs, target, operation, dryRun, diagnostics) {
    if (!fs.existsSync(target)) {
      diagnostics.push(diagnostic('error', 'install_plan.section_missing_file', 'Target file does not exist: ' + operation.path, operation));
      return {id: operation.id, type: operation.type, path: operation.path, status: 'failed'};
    }
    const before = fs.readFileSync(target, 'utf8');
    const section = replaceSection(before, operation);
    if (!section.ok) {
      diagnostics.push(diagnostic('error', section.code, section.message, operation));
      return {id: operation.id, type: operation.type, path: operation.path, status: 'failed'};
    }
    if (section.alreadyApplied) {
      return {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied'};
    }
    if (!dryRun) {
      fs.writeFileSync(target, section.text, 'utf8');
    }
    return {id: operation.id, type: operation.type, path: operation.path, status: dryRun ? 'would_apply' : 'applied'};
  }

  function applyCopyAssetFile(fs, path, crypto, target, operation, dryRun, diagnostics) {
    const sourcePath = String(operation.sourcePath || '').trim();
    if (!sourcePath) {
      diagnostics.push(diagnostic('error', 'install_plan.copy_source_missing', 'Asset copy sourcePath is required for guarded apply.', operation));
      return {id: operation.id, type: operation.type, path: operation.path, status: 'failed'};
    }
    if (!path.isAbsolute(sourcePath)) {
      diagnostics.push(diagnostic('error', 'install_plan.copy_source_path', 'Asset copy sourcePath must be an absolute desktop file path.', operation));
      return {id: operation.id, type: operation.type, path: operation.path, status: 'failed'};
    }
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      diagnostics.push(diagnostic('error', 'install_plan.copy_source_missing', 'Asset copy source file does not exist: ' + sourcePath, operation));
      return {id: operation.id, type: operation.type, path: operation.path, status: 'failed'};
    }
    const sourceHash = hashFile(fs, crypto, sourcePath);
    if (fs.existsSync(target)) {
      if (!fs.statSync(target).isFile()) {
        diagnostics.push(diagnostic('error', 'install_plan.copy_conflict', 'Asset copy target exists and is not a file: ' + operation.path, operation));
        return {id: operation.id, type: operation.type, path: operation.path, status: 'failed', sourceHash};
      }
      const targetHash = hashFile(fs, crypto, target);
      if (sourceHash === targetHash) {
        return {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied', sourceHash, targetHash};
      }
      diagnostics.push(diagnostic('error', 'install_plan.copy_conflict', 'Asset copy target already exists with different bytes: ' + operation.path, operation));
      return {id: operation.id, type: operation.type, path: operation.path, status: 'failed', sourceHash, targetHash};
    }
    if (!dryRun) {
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.copyFileSync(sourcePath, target);
    }
    return {id: operation.id, type: operation.type, path: operation.path, status: dryRun ? 'would_apply' : 'applied', sourceHash};
  }

  function hashFile(fs, crypto, filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  }

  function replaceOnce(text, operation) {
    const search = operation.search || '';
    if (!search) {
      return {ok: false, code: 'install_plan.replace_empty_search', message: 'Replacement search text is empty.'};
    }
    const replacement = operation.replace || '';
    if (operation.line) {
      const lines = text.split('\n');
      const index = operation.line - 1;
      if (index >= 0 && index < lines.length && lines[index].includes(search)) {
        lines[index] = lines[index].replace(search, replacement);
        return {ok: true, text: lines.join('\n')};
      }
      return {
        ok: false,
        code: 'install_plan.replace_line_mismatch',
        message: 'Replacement line evidence did not match the target text.'
      };
    }
    const matches = text.split(search).length - 1;
    if (matches !== 1) {
      return {
        ok: false,
        code: 'install_plan.replace_ambiguous',
        message: 'Expected exactly one match for replacement text, found ' + matches + '.'
      };
    }
    return {ok: true, text: text.replace(search, replacement)};
  }

  function insertAtAnchor(text, operation) {
    const anchor = operation.anchorText || '';
    if (!anchor) {
      return {ok: false, code: 'install_plan.insert_empty_anchor', message: 'Insert anchor text is empty.'};
    }
    const content = operation.content || '';
    if (!content) {
      return {ok: false, code: 'install_plan.insert_empty_content', message: 'Insert content is empty.'};
    }
    const dedupe = operation.dedupeSearch || content.trim();
    if (dedupe && text.includes(dedupe)) {
      return {ok: true, alreadyApplied: true, text};
    }
    const hadFinalNewline = text.endsWith('\n');
    const lines = hadFinalNewline ? text.slice(0, -1).split('\n') : text.split('\n');
    const matches = [];
    lines.forEach((line, index) => {
      if (line.includes(anchor)) {
        matches.push(index);
      }
    });
    if (matches.length !== 1) {
      return {
        ok: false,
        code: matches.length ? 'install_plan.insert_ambiguous_anchor' : 'install_plan.insert_anchor_missing',
        message: 'Expected exactly one insert anchor match, found ' + matches.length + '.'
      };
    }
    const insertLines = content.replace(/\n$/, '').split('\n');
    const insertAt = operation.position === 'before' ? matches[0] : matches[0] + 1;
    const nextLines = lines.slice(0, insertAt).concat(insertLines, lines.slice(insertAt));
    return {ok: true, text: nextLines.join('\n') + (hadFinalNewline ? '\n' : '')};
  }

  function replaceSection(text, operation) {
    const anchor = operation.anchorText || '';
    const endAnchor = operation.endAnchorText || '';
    const content = operation.content || '';
    if (!anchor) {
      return {ok: false, code: 'install_plan.section_empty_anchor', message: 'Section start anchor text is empty.'};
    }
    if (!endAnchor) {
      return {ok: false, code: 'install_plan.section_empty_end_anchor', message: 'Section end anchor text is empty.'};
    }
    if (!content) {
      return {ok: false, code: 'install_plan.section_empty_content', message: 'Section replacement content is empty.'};
    }
    const dedupe = operation.dedupeSearch || content.trim();
    const hadFinalNewline = text.endsWith('\n');
    const lines = hadFinalNewline ? text.slice(0, -1).split('\n') : text.split('\n');
    const starts = [];
    const ends = [];
    lines.forEach((line, index) => {
      if (line === anchor) {
        starts.push(index);
      }
      if (line === endAnchor) {
        ends.push(index);
      }
    });
    if (starts.length !== 1) {
      if (starts.length === 0 && dedupe && text.includes(dedupe)) {
        return {ok: true, alreadyApplied: true, text};
      }
      return {
        ok: false,
        code: starts.length ? 'install_plan.section_ambiguous_anchor' : 'install_plan.section_anchor_missing',
        message: 'Expected exactly one section start anchor match, found ' + starts.length + '.'
      };
    }
    const start = starts[0];
    const matchingEnds = ends.filter((index) => index >= start);
    if (matchingEnds.length !== 1) {
      return {
        ok: false,
        code: matchingEnds.length ? 'install_plan.section_ambiguous_end_anchor' : 'install_plan.section_end_anchor_missing',
        message: 'Expected exactly one section end anchor match after the start anchor, found ' + matchingEnds.length + '.'
      };
    }
    const end = matchingEnds[0];
    if (operation.startLine && start + 1 !== operation.startLine) {
      return {
        ok: false,
        code: 'install_plan.section_start_line_mismatch',
        message: 'Section start anchor matched line ' + (start + 1) + ', expected line ' + operation.startLine + '.'
      };
    }
    if (operation.endLine && end + 1 !== operation.endLine) {
      return {
        ok: false,
        code: 'install_plan.section_end_line_mismatch',
        message: 'Section end anchor matched line ' + (end + 1) + ', expected line ' + operation.endLine + '.'
      };
    }
    const replacementLines = content.replace(/\n$/, '').split('\n');
    const nextLines = lines.slice(0, start).concat(replacementLines, lines.slice(end + 1));
    return {ok: true, text: nextLines.join('\n') + (hadFinalNewline ? '\n' : '')};
  }

  function isEntrySidebarProtectedReplace(operation) {
    const role = String(operation && (operation.role || operation.workflow || operation.label) || '');
    const line = Number(operation && operation.line || 0);
    const search = String(operation && operation.search || '');
    const replace = String(operation && operation.replace || '');
    if (!Number.isInteger(line) || line <= 0 || !search.trim() || !replace.trim()) {
      return false;
    }
    if (/[\r\n{};]/.test(search + replace)) {
      return false;
    }
    if (/^entry_sidebar\.title$/i.test(role)) {
      return /^title:\s+\S.*$/.test(search) && /^title:\s+\S.*$/.test(replace);
    }
    if (/^entry_sidebar\.(option_label|first_route)$/i.test(role)) {
      return isEntryRouteLine(search) && isEntryRouteLine(replace);
    }
    return false;
  }

  function isEntrySidebarProtectedSection(operation) {
    const role = String(operation && (operation.role || operation.workflow || operation.label) || '');
    const allowedRole = /^entry_sidebar\.(heading|opening_section|opening)$/i.test(role);
    const anchor = String(operation && operation.anchorText || '');
    const endAnchor = String(operation && operation.endAnchorText || '');
    const content = String(operation && operation.content || '');
    const dedupe = String(operation && operation.dedupeSearch || '');
    const startLine = Number(operation && operation.startLine || 0);
    const endLine = Number(operation && operation.endLine || 0);
    return allowedRole &&
      Number.isInteger(startLine) &&
      Number.isInteger(endLine) &&
      startLine > 0 &&
      endLine >= startLine &&
      anchor.trim() &&
      endAnchor.trim() &&
      content.trim() &&
      dedupe.trim() &&
      isEntryHeadingLine(anchor) &&
      isEntryProseEndAnchor(endAnchor) &&
      isSafeEntrySectionContent(content);
  }

  function isProjectMetadataReplace(operation) {
    const role = String(operation && (operation.role || operation.workflow || operation.label) || '');
    const line = Number(operation && operation.line || 0);
    const search = String(operation && operation.search || '');
    const replace = String(operation && operation.replace || '');
    const key = projectMetadataRoleKey(role);
    if (!key || !Number.isInteger(line) || line <= 0 || !search.trim() || !replace.trim()) {
      return false;
    }
    if (/[\r\n{}]/.test(search + replace)) {
      return false;
    }
    return metadataLineMatches(search, key) && metadataLineMatches(replace, key);
  }

  function isProjectMetadataInsert(operation) {
    const role = String(operation && (operation.role || operation.workflow || operation.label) || '');
    const key = projectMetadataRoleKey(role);
    const anchor = String(operation && operation.anchorText || '');
    const content = String(operation && operation.content || '');
    const dedupe = String(operation && operation.dedupeSearch || '');
    if (!key || !anchor.trim() || !content.trim() || !dedupe.trim()) {
      return false;
    }
    if (/[\r{}]/.test(content) || content.replace(/\n$/, '').split('\n').length !== 1) {
      return false;
    }
    return isMetadataAnchorLine(anchor) && metadataLineMatches(content.trim(), key) && dedupe === key + ':';
  }

  function projectMetadataRoleKey(role) {
    const match = String(role || '').match(/^project_metadata\.(title|author|ifid)$/i);
    return match ? match[1].toLowerCase() : '';
  }

  function metadataLineMatches(value, key) {
    const text = String(value || '').trim();
    if (!key) {
      return false;
    }
    if (!new RegExp('^' + key + '\\s*:\\s+\\S.*$', 'i').test(text)) {
      return false;
    }
    return !/^\s*(?:title|author|ifid)\s*:\s*$/i.test(text);
  }

  function isMetadataAnchorLine(value) {
    return ['title', 'author', 'ifid'].some((key) => metadataLineMatches(value, key));
  }

  function isEntryRouteLine(value) {
    return /^\s*-\s+@[A-Za-z0-9_.-]+\s*:\s+\S.*$/.test(String(value || '').trim());
  }

  function isEntryHeadingLine(value) {
    return /^\s*=\s+\S/.test(String(value || '').trim());
  }

  function isEntryProseEndAnchor(value) {
    const text = String(value || '').trim();
    if (!text) {
      return false;
    }
    if (/^(?:title|new-page|on-arrival|tags|view-if|choose-if|go-to|set-root)\s*:/i.test(text)) {
      return false;
    }
    if (/^(?:[-@#]|=|\/\/|\{!|!})/.test(text)) {
      return false;
    }
    return !/[{};]/.test(text);
  }

  function isSafeEntrySectionContent(value) {
    const text = String(value || '');
    if (!text.trim() || /[{};]/.test(text)) {
      return false;
    }
    const lines = text.replace(/\n$/, '').split('\n');
    if (!isEntryHeadingLine(lines[0] || '')) {
      return false;
    }
    return !lines.some((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return false;
      }
      if (index === 0) {
        return false;
      }
      return /^(?:[-@#]|=|\/\/|\{!|!})/.test(trimmed) ||
        /^(?:title|new-page|on-arrival|tags|view-if|choose-if|go-to|set-root)\s*:/i.test(trimmed);
    });
  }

  function diagnostic(severity, code, message, operation) {
    const item = {severity, code, message, confidence: 'exact'};
    if (operation) {
      item.operationId = operation.id;
      item.path = operation.path;
    }
    return item;
  }

  const api = {
    INSTALL_PLAN_VERSION,
    INSTALL_PLAN_KIND,
    INSTALL_LEVELS,
    buildInstallPlan,
    projectProvenanceFromIndex,
    validateProjectProvenance,
    eventInstallPlan,
    newsInstallPlan,
    cardInstallPlan,
    surfaceTextInstallPlan,
    existingSceneEditInstallPlan,
    renderInstallPlanJson,
    classifyOperation,
    operationSummary,
    renderOperationChecklist,
    renderPatchPreview,
    applyInstallPlan
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapInstallPlan = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
