(function initInstallPlan(global) {
  'use strict';

  const INSTALL_PLAN_VERSION = '0.1';
  const INSTALL_PLAN_KIND = 'dendry_mod_studio_install_plan';
  const DEFAULT_VALIDATION_COMMAND = 'bash tools/build_and_validate.sh --skip-build --errors-only';
  const installOperationContracts = installOperationContractsApi();
  if (!installOperationContracts) {
    throw new Error('Install operation contracts helper must be loaded before install_plan.js.');
  }
  const finalizeApplyResult = installOperationContracts.finalizeApplyResult;
  const markCommittedResults = installOperationContracts.markCommittedResults;
  const withOperationEvidence = installOperationContracts.withOperationEvidence;
  const textOperationEvidence = installOperationContracts.textOperationEvidence;
  const manualOperationEvidence = installOperationContracts.manualOperationEvidence;
  const failedOperationEvidence = installOperationContracts.failedOperationEvidence;
  const assetOperationEvidence = installOperationContracts.assetOperationEvidence;
  const prefixLines = installOperationContracts.prefixLines;
  const existingSceneLineCoalescer = existingSceneLineCoalescerApi();
  if (!existingSceneLineCoalescer) {
    throw new Error('Existing scene line coalescer helper must be loaded before install_plan.js.');
  }
  const APPLY_STATUSES = installOperationContracts.APPLY_STATUSES;
  const protectedPathPolicy = resolveProtectedPathPolicy(global);
  const INSTALL_LEVELS = installOperationContracts.INSTALL_LEVELS;
  const CHECKLIST_TEXT = {
    en: {
      'checklist.title': 'Install operation checklist',
      'checklist.status': 'Status: proposal only / not installed',
      'group.safe_apply': 'Safe apply',
      'group.guarded_apply': 'Guarded install',
      'group.advanced_apply': 'Advanced install',
      'group.manual_review': 'Manual review',
      'group.refused': 'Protected / refused',
      none: 'none',
      unknownPath: '(unknown path)',
      'reason.defaultManual': 'This operation must be reviewed and installed by hand.',
      'reason.defaultEligible': 'This operation is eligible for guarded apply.',
      'reason.type.create_file': 'Create a new source file from this proposal.',
      'reason.type.replace_text': 'Replace one source-backed player-facing line after the original text still matches.',
      'reason.type.insert_text': 'Insert source text after a known anchor and dedupe token still match.',
      'reason.type.replace_section': 'Replace a source-backed section between exact begin and end anchors.',
      'reason.type.manual_snippet': 'Review and paste this snippet manually.',
      'reason.type.copy_asset_file': 'Copy the selected local asset into the project target path.',
      'reason.create_scene': 'Create the exported world event or card scene.',
      'reason.root_seen_flag': 'Insert the generated event-seen flag near the known root anchor.',
      'reason.post_event_migration': 'Insert the generated old-save migration guard after the known compatibility anchor.',
      'reason.post_event_news_snippet': 'Wire the news snippet into the detected post-event news route, or review it manually if no safe route was found.',
      'reason.wire_card_flow': 'Review hand, deck, or sidebar wiring for this card manually.',
      'reason.replace_label': 'Replace source-backed surface text after matching exact source evidence.',
      'reason.manual_label_review': 'Review this surface text proposal manually because the source is generated, protected, or ambiguous.',
      'reason.entry_root_title': 'Replace the root/start menu source title after exact line evidence matches.',
      'reason.entry_opening_section': 'Replace the source-backed start menu heading and opening text between exact anchors.',
      'reason.entry_opening_manual': 'Start menu source anchors are not exact enough for guarded apply; review the root opening manually.',
      'reason.entry_first_route': 'Replace the first start-menu route line after exact source evidence matches.',
      'reason.entry_first_route_manual': 'First route source line evidence is missing; review the root option manually.',
      'reason.sidebar_generated_manual': 'Sidebar evidence appears generated or custom; review manually before editing UI-owned files.',
      'reason.sidebar_title': 'Replace the source-backed sidebar scene title after exact line evidence matches.',
      'reason.sidebar_section': 'Replace the source-backed sidebar/status display section between exact anchors.',
      'reason.sidebar_section_manual': 'Sidebar source anchors are not exact enough for guarded apply; review the status scene manually.',
      'reason.sidebar_create_status_scene': 'Create a source-backed status/sidebar scene for the default Dendry HTML shell.',
      'reason.entry_sidebar_noop': 'No installable Entry/Sidebar change was generated.',
      'reason.sidebar_status_generated_manual': 'Sidebar/status evidence appears generated or custom; review manually before editing UI-owned files.',
      'reason.sidebar_status_title': 'Replace the source-backed sidebar/status scene title after exact line evidence matches.',
      'reason.sidebar_status_section': 'Replace the source-backed sidebar/status display section between exact anchors.',
      'reason.sidebar_status_section_manual': 'Sidebar/status source anchors are not exact enough for guarded apply; review manually.',
      'reason.sidebar_status_create_status_scene': 'Create a source-backed status/sidebar scene.',
      'reason.sidebar_status_noop': 'No installable Sidebar/Status change was generated.',
      'reason.workspace_layout_deck': 'Create the proposed deck scene for this playable workspace.',
      'reason.workspace_layout_card': 'Create the proposed starter card scene.',
      'reason.workspace_layout_route': 'Insert the hand/deck route after the matching source anchor.',
      'reason.workspace_layout_route_manual': 'Review the hand/deck route manually because exact source evidence is missing.',
      'reason.workspace_layout_sidebar': 'Add the proposed sidebar category after the matching status/sidebar anchor.',
      'reason.workspace_layout_sidebar_manual': 'Review the sidebar category manually because exact source evidence is missing.',
      'reason.project_metadata_validation_manual': 'Fix Game Info validation errors before applying metadata changes.',
      'reason.project_metadata_replace': 'Replace source/info.dry metadata after exact line evidence matches.',
      'reason.project_metadata_insert': 'Insert missing source/info.dry metadata after matching a known metadata anchor.',
      'reason.project_metadata_manual': 'Source evidence is missing for this metadata field; review source/info.dry manually.',
      'reason.project_metadata_noop': 'No installable Game Info change was generated.',
      'reason.existing_section': 'Replace existing scene section text after exact source anchors still match.',
      'reason.existing_text': 'Replace existing scene text after the original source line still matches.',
      'reason.existing_manual': 'Existing scene source evidence is missing or protected; review it manually.',
      'reason.asset_file': 'Copy the selected local asset into the project, then review the asset reference path.'
    },
    'zh-Hant': {
      'checklist.title': '安裝操作檢查清單',
      'checklist.status': '狀態：僅為提案 / 尚未安裝',
      'group.safe_apply': '可安全套用',
      'group.guarded_apply': '受控安裝',
      'group.advanced_apply': '進階安裝',
      'group.manual_review': '手動審查',
      'group.refused': '受保護 / 已拒絕',
      none: '沒有',
      unknownPath: '（未知路徑）',
      'reason.defaultManual': '這項操作需要手動審查與安裝。',
      'reason.defaultEligible': '這項操作符合受控套用條件。',
      'reason.type.create_file': '從這份提案建立新的 source 檔案。',
      'reason.type.replace_text': '在原文字仍匹配時，替換一行有 source 證據的玩家可見文字。',
      'reason.type.insert_text': '在已知錨點與去重標記仍匹配時插入 source 文字。',
      'reason.type.replace_section': '在精確開始與結束錨點之間替換 source-backed 區段。',
      'reason.type.manual_snippet': '手動審查並貼上這段片段。',
      'reason.type.copy_asset_file': '把已選的本地素材複製到專案目標路徑。',
      'reason.create_scene': '建立匯出的世界事件或卡牌場景。',
      'reason.root_seen_flag': '在已知 root 錨點附近插入產生的事件已讀旗標。',
      'reason.post_event_migration': '在已知相容性錨點後插入舊存檔遷移 guard。',
      'reason.post_event_news_snippet': '將新聞片段接入偵測到的 post-event news 路由；若沒有安全路由則手動審查。',
      'reason.wire_card_flow': '手動審查這張卡牌的手牌、牌庫或側邊欄接線。',
      'reason.replace_label': '在精確 source 證據匹配後替換 source-backed 介面文字。',
      'reason.manual_label_review': '因為來源是 generated、受保護或不明確，請手動審查這項介面文字提案。',
      'reason.entry_root_title': '在精確行證據匹配後替換 root / 開始選單 source 標題。',
      'reason.entry_opening_section': '在精確錨點之間替換 source-backed 開始選單標題與開場文字。',
      'reason.entry_opening_manual': '開始選單 source 錨點不夠精確，請手動審查 root 開場內容。',
      'reason.entry_first_route': '在精確 source 證據匹配後替換開始選單第一路由行。',
      'reason.entry_first_route_manual': '第一路由缺少 source 行證據；請手動審查 root 選項。',
      'reason.sidebar_generated_manual': '側邊欄證據看起來是 generated 或 custom；修改 UI-owned 檔案前請手動審查。',
      'reason.sidebar_title': '在精確行證據匹配後替換 source-backed 側邊欄場景標題。',
      'reason.sidebar_section': '在精確錨點之間替換 source-backed 側邊欄 / 狀態顯示區段。',
      'reason.sidebar_section_manual': '側邊欄 source 錨點不夠精確，請手動審查 status 場景。',
      'reason.sidebar_create_status_scene': '為預設 Dendry HTML shell 建立 source-backed status / 側邊欄場景。',
      'reason.entry_sidebar_noop': '沒有產生可安裝的 Entry/Sidebar 修改。',
      'reason.sidebar_status_generated_manual': '側邊欄 / 狀態證據看起來是 generated 或 custom；修改 UI-owned 檔案前請手動審查。',
      'reason.sidebar_status_title': '在精確行證據匹配後替換 source-backed 側邊欄 / 狀態場景標題。',
      'reason.sidebar_status_section': '在精確錨點之間替換 source-backed 側邊欄 / 狀態顯示區段。',
      'reason.sidebar_status_section_manual': '側邊欄 / 狀態 source 錨點不夠精確，請手動審查。',
      'reason.sidebar_status_create_status_scene': '建立 source-backed status / 側邊欄場景。',
      'reason.sidebar_status_noop': '沒有產生可安裝的 Sidebar/Status 修改。',
      'reason.workspace_layout_deck': '為這個可玩工作區建立提案牌庫場景。',
      'reason.workspace_layout_card': '建立提案起始卡牌場景。',
      'reason.workspace_layout_route': '在匹配的 source 錨點後插入手牌 / 牌庫路由。',
      'reason.workspace_layout_route_manual': '因為缺少精確 source 證據，請手動審查手牌 / 牌庫路由。',
      'reason.workspace_layout_sidebar': '在匹配的 status / 側邊欄錨點後加入提案側邊欄類別。',
      'reason.workspace_layout_sidebar_manual': '因為缺少精確 source 證據，請手動審查側邊欄類別。',
      'reason.project_metadata_validation_manual': '套用遊戲資訊修改前，請先修正驗證錯誤。',
      'reason.project_metadata_replace': '在精確行證據匹配後替換 source/info.dry metadata。',
      'reason.project_metadata_insert': '在已知 metadata 錨點匹配後插入缺失的 source/info.dry metadata。',
      'reason.project_metadata_manual': '這個 metadata 欄位缺少 source 證據；請手動審查 source/info.dry。',
      'reason.project_metadata_noop': '沒有產生可安裝的遊戲資訊修改。',
      'reason.existing_section': '在精確 source 錨點仍匹配時替換既有場景區段文字。',
      'reason.existing_text': '在原 source 行仍匹配時替換既有場景文字。',
      'reason.existing_manual': '既有場景缺少 source 證據或位於受保護區域；請手動審查。',
      'reason.asset_file': '把已選的本地素材複製到專案中，然後審查素材引用路徑。'
    }
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

  function resolveProtectedPathPolicy(globalRef) {
    if (globalRef && globalRef.ProjectMapProtectedPathPolicy) {
      return globalRef.ProjectMapProtectedPathPolicy;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('./protected_path_policy.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function protectedPathPolicyApi() {
    if (protectedPathPolicy) {
      return protectedPathPolicy;
    }
    if (global && global.ProjectMapProtectedPathPolicy) {
      return global.ProjectMapProtectedPathPolicy;
    }
    throw new Error('ProjectMapProtectedPathPolicy is required before install_plan.js');
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
    return installOperationContracts.normalizeInstallOperation(operation, index);
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
    const routerOperation = eventRouterRegistrationOperation(options.routerRegistration);
    const operations = [{
      id: 'create_scene',
      type: 'create_file',
      path: 'source/scenes/events/' + id + '.scene.dry',
      content: options.scene || '',
      safety: 'safe_apply',
      description: 'Create the exported world event scene.'
    }];
    if (String(options.rootSnippet || '').trim()) {
      operations.push({
        id: 'root_seen_flag',
        type: 'insert_text',
        path: 'source/scenes/root.scene.dry',
        content: options.rootSnippet || '',
        anchorText: options.rootAnchorText || '// ====== U. EVENT SEEN FLAGS ======',
        position: 'after',
        dedupeSearch: options.rootDedupeSearch || options.rootSnippet || '',
        safety: 'guarded_apply',
        description: 'Insert the generated seen flag init near event seen flags after matching the root anchor.'
      });
    }
    if (String(options.migrationSnippet || '').trim()) {
      operations.push({
        id: 'post_event_migration',
        type: 'insert_text',
        path: 'source/scenes/post_event.scene.dry',
        content: options.migrationSnippet || '',
        anchorText: options.migrationAnchorText || '// Save compatibility: post_event split (post_event_news)',
        position: 'after',
        dedupeSearch: options.migrationDedupeSearch || options.migrationSnippet || '',
        safety: 'guarded_apply',
        description: 'Insert the generated old-save migration guard after matching the post_event compatibility anchor.'
      });
    }
    return buildInstallPlan({
      id,
      draftKind: 'world_event',
      title: options.title || id,
      project: options.project || null,
      operations: operations.concat(eventVariableInitOperations(options.variableInitRequests, options.rootAnchorText))
        .concat(routerOperation ? [routerOperation] : [])
        .concat(assetInstallOperations(options.assetInstallRequests))
    });
  }

  function eventRouterRegistrationOperation(input) {
    const router = isObject(input) ? input : {};
    const path = String(router.path || '').trim();
    const anchorText = String(router.anchorText || '').trim();
    const content = router.content === undefined || router.content === null ? '' : String(router.content);
    const dedupeSearch = String(router.dedupeSearch || content || '').trim();
    if (!path || !anchorText || !content || !dedupeSearch) {
      return null;
    }
    const requestedSafety = String(router.safety || '').trim();
    return {
      id: 'event_router_registration',
      type: 'insert_text',
      path,
      content,
      anchorText,
      position: String(router.position || 'after').trim() === 'before' ? 'before' : 'after',
      dedupeSearch,
      safety: requestedSafety === 'guarded_apply' ? 'guarded_apply' : 'advanced_apply',
      description: String(router.description || 'Register this event with the profile-aware monthly event router.').trim()
    };
  }

  function eventVariableInitOperations(requests, rootAnchorText) {
    return ensureArray(requests).map((request, index) => {
      const value = isObject(request) ? request : {name: request};
      const name = String(value.name || value.variable || '').trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        return null;
      }
      const initial = value.initialValue === undefined || value.initialValue === null || value.initialValue === ''
        ? '0'
        : String(value.initialValue);
      const content = 'Q.' + name + ' = ' + initial + ';\n';
      return {
        id: 'event_variable_init_' + name + '_' + String(index + 1),
        type: 'insert_text',
        path: 'source/scenes/root.scene.dry',
        content,
        anchorText: value.anchorText || rootAnchorText || '// ====== U. EVENT SEEN FLAGS ======',
        position: 'after',
        dedupeSearch: 'Q.' + name + ' =',
        safety: 'guarded_apply',
        description: 'Initialize new event variable Q.' + name + ' near root event state.'
      };
    }).filter(Boolean);
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
    const wiringOperation = isObject(options.wiringOperation) ? [options.wiringOperation] : [];
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
          sceneKind: options.cardKind === 'advisor_like' ? 'advisor_like' : 'card',
          safety: 'safe_apply',
          description: 'Create the exported card scene.'
        },
      ].concat(wiringOperation.length ? wiringOperation : options.skipWiringManual ? [] : [
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
        : editability === 'source_patch'
          ? 'advanced_apply'
          : singleLineTextProposal
            ? 'guarded_apply'
            : 'manual_review';
    const isTextProposal = editability === 'text_proposal';
    const isSourcePatch = editability === 'source_patch';
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
                : isSourcePatch
                ? 'Studio source patch: replace player-facing text through an advanced source-backed operation.'
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
                : 'Source mapping required: source is generated, runtime-owned, or ambiguous.'
            }
      ]
    });
  }

  function existingSceneEditInstallPlan(proposal, options) {
    const opts = isObject(options) ? options : {};
    const draft = isObject(proposal) ? proposal : {};
    const id = String(draft.id || 'existing_scene_edit').trim();
    const changes = typeof existingSceneLineCoalescer.coalesceExistingSceneChanges === 'function'
      ? existingSceneLineCoalescer.coalesceExistingSceneChanges(ensureArray(draft.changes), {isProtectedRouterPath})
      : existingSceneLineCoalescer.coalesceExistingSceneLineReplacements(ensureArray(draft.changes));
    const operations = changes.map((change, index) => existingSceneChangeOperation(change, index))
      .concat(assetInstallOperations(draft.assetInstallRequests));
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
    const advancedRequested = existingSceneAdvancedRequested(value);
    if (!advancedRequested && value.operationType === 'insert_text' && existingSceneInsertCanGuard(value, path, line, after)) {
      return {
        id: 'insert_existing_' + (index + 1),
        type: 'insert_text',
        path,
        line,
        anchorText: value.anchorText || source.anchorText,
        rawAnchorText: value.rawAnchorText || source.rawAnchorText || '',
        content: after.endsWith('\n') ? after : after + '\n',
        position: value.position === 'before' ? 'before' : 'after',
        dedupeSearch: value.dedupeSearch || after.trim(),
        safety: 'guarded_apply',
        role: 'existing_scene.structure_insert',
        description: 'Insert existing ' + label + ' after confirming the source anchor and dedupe evidence still match.'
      };
    }
    if (value.operationType === 'insert_text' && existingSceneInsertCanAdvanced(value, path, line, after)) {
      return {
        id: 'insert_existing_' + (index + 1),
        type: 'insert_text',
        path,
        line,
        anchorText: value.anchorText || source.anchorText,
        rawAnchorText: value.rawAnchorText || source.rawAnchorText || '',
        content: after.endsWith('\n') ? after : after + '\n',
        position: value.position === 'before' ? 'before' : 'after',
        dedupeSearch: value.dedupeSearch || after.trim(),
        safety: 'advanced_apply',
        role: 'existing_scene.structure_insert',
        description: 'Insert existing ' + label + ' through an advanced source-backed operation.'
      };
    }
    if (!advancedRequested && value.operationType !== 'manual_snippet' && existingSceneSectionCanGuard(value, path, line, endLine, after)) {
      return {
        id,
        type: 'replace_section',
        path,
        anchorText: value.anchorText,
        endAnchorText: value.endAnchorText,
        rawAnchorText: value.rawAnchorText || source.rawAnchorText || '',
        rawEndAnchorText: value.rawEndAnchorText || source.rawEndAnchorText || '',
        content: existingSceneReplacementContent(after, value.allowEmptyReplace),
        dedupeSearch: value.dedupeSearch || after.trim(),
        startLine: value.startLine || line,
        endLine: value.endLine || endLine,
        expectedRangeHash: value.expectedRangeHash || source.expectedRangeHash || '',
        allowEmptyReplace: Boolean(value.allowEmptyReplace),
        deleteMode: value.deletesSourceLine ? 'line' : '',
        deletesSourceLine: Boolean(value.deletesSourceLine),
        safety: 'guarded_apply',
        role: 'existing_scene.section_text',
        coalescedChangeIds: ensureArray(value.coalescedChangeIds),
        coalescedSourceRoles: ensureArray(value.coalescedSourceRoles),
        description: existingSceneSectionDescription(label, value, 'after confirming exact source anchors still match.')
      };
    }
    if (value.operationType !== 'manual_snippet' && existingSceneSectionCanAdvanced(value, path, line, endLine, after)) {
      return {
        id,
        type: 'replace_section',
        path,
        anchorText: value.anchorText || source.anchorText,
        endAnchorText: value.endAnchorText || source.endAnchorText,
        rawAnchorText: value.rawAnchorText || source.rawAnchorText || '',
        rawEndAnchorText: value.rawEndAnchorText || source.rawEndAnchorText || '',
        content: existingSceneReplacementContent(after, value.allowEmptyReplace),
        dedupeSearch: value.dedupeSearch || after.trim(),
        startLine: value.startLine || line,
        endLine: value.endLine || endLine,
        expectedRangeHash: value.expectedRangeHash || source.expectedRangeHash || '',
        allowEmptyReplace: Boolean(value.allowEmptyReplace),
        deleteMode: value.deletesSourceLine ? 'line' : '',
        deletesSourceLine: Boolean(value.deletesSourceLine),
        safety: 'advanced_apply',
        role: 'existing_scene.section_text',
        coalescedChangeIds: ensureArray(value.coalescedChangeIds),
        coalescedSourceRoles: ensureArray(value.coalescedSourceRoles),
        description: existingSceneSectionDescription(label, value, 'through an advanced source-backed operation.')
      };
    }
    if (!advancedRequested && value.operationType !== 'manual_snippet' && existingSceneChangeCanGuard(path, line, source.endLine || source.line || source.startLine, before, after, value)) {
      return {
        id,
        type: 'replace_text',
        path,
        line,
        search: before,
        replace: after,
        rawAnchorText: value.rawAnchorText || source.rawAnchorText || '',
        expectedRangeHash: value.expectedRangeHash || source.expectedRangeHash || '',
        deleteMode: value.deletesSourceLine ? 'line' : '',
        deletesSourceLine: Boolean(value.deletesSourceLine),
        safety: 'guarded_apply',
        description: 'Replace existing ' + label + ' in the source scene after confirming the original line still matches.'
      };
    }
    if (value.operationType !== 'manual_snippet' && existingSceneChangeCanAdvanced(path, line, source.endLine || source.line || source.startLine, before, after, value)) {
      return {
        id,
        type: 'replace_text',
        path,
        line,
        search: before,
        replace: after,
        rawAnchorText: value.rawAnchorText || source.rawAnchorText || '',
        expectedRangeHash: value.expectedRangeHash || source.expectedRangeHash || '',
        deleteMode: value.deletesSourceLine ? 'line' : '',
        deletesSourceLine: Boolean(value.deletesSourceLine),
        safety: 'advanced_apply',
        description: 'Replace existing ' + label + ' through an advanced source-backed operation.'
      };
    }
    return {
      id: 'manual_existing_' + (index + 1),
      type: 'manual_snippet',
      path,
      line,
      content: [
        'Existing scene edit needs Studio source review before changing source.',
        'Field: ' + label,
        'Before:',
        before || '(empty)',
        '',
        'After:',
        after || '(empty)'
      ].join('\n') + '\n',
      safety: 'manual_review',
      description: path && isProtectedRouterPath(path)
        ? 'Protected/router scene field requires Studio source review.'
        : 'Existing scene field lacks exact single-line source evidence for guarded apply.'
    };
  }

  function existingSceneAdvancedRequested(change) {
    const value = isObject(change) ? change : {};
    const editability = String(value.editability || '');
    return editability === 'advanced_source_patch' || editability === 'advanced_apply';
  }

  function existingSceneReplacementContent(after, allowEmptyReplace) {
    const text = String(after === undefined || after === null ? '' : after);
    if (!text && allowEmptyReplace) {
      return '';
    }
    return text.endsWith('\n') ? text : text + '\n';
  }

  function existingSceneSectionDescription(label, change, suffix) {
    const prefix = change && change.coalescedSourceUnit
      ? 'Replace existing coalesced source-unit edit for '
      : 'Replace existing ';
    return prefix + label + ' section text ' + suffix;
  }

  function existingSceneChangeCanGuard(path, line, endLine, before, after, change) {
    const rel = String(path || '').replace(/\\/g, '/');
    const sourceLine = Number(line || 0);
    const sourceEndLine = Number(endLine || sourceLine || 0);
    const allowEmptyReplace = Boolean(change && change.allowEmptyReplace);
    return Boolean(
      rel.startsWith('source/scenes/') &&
      rel.endsWith('.scene.dry') &&
      !isProtectedRouterPath(rel) &&
      Number.isInteger(sourceLine) &&
      sourceLine > 0 &&
      (!Number.isInteger(sourceEndLine) || sourceEndLine <= 0 || sourceEndLine === sourceLine) &&
      String(before || '').trim() &&
      (String(after || '').trim() || allowEmptyReplace)
    );
  }

  function existingSceneChangeCanAdvanced(path, line, endLine, before, after, change) {
    const rel = String(path || '').replace(/\\/g, '/');
    const sourceLine = Number(line || 0);
    const sourceEndLine = Number(endLine || sourceLine || 0);
    const allowEmptyReplace = Boolean(change && change.allowEmptyReplace);
    return Boolean(
      rel.startsWith('source/scenes/') &&
      rel.endsWith('.scene.dry') &&
      Number.isInteger(sourceLine) &&
      sourceLine > 0 &&
      (!Number.isInteger(sourceEndLine) || sourceEndLine <= 0 || sourceEndLine === sourceLine) &&
      String(before || '').trim() &&
      (String(after || '').trim() || allowEmptyReplace)
    );
  }

  function existingSceneInsertCanGuard(change, path, line, after) {
    const value = isObject(change) ? change : {};
    const rel = String(path || '').replace(/\\/g, '/');
    const sourceLine = Number(line || 0);
    const anchor = String(value.anchorText || (value.source && value.source.anchorText) || '').trim();
    const dedupe = String(value.dedupeSearch || after || '').trim();
    return Boolean(
      rel.startsWith('source/scenes/') &&
      rel.endsWith('.scene.dry') &&
      !isProtectedRouterPath(rel) &&
      Number.isInteger(sourceLine) &&
      sourceLine > 0 &&
      anchor &&
      dedupe &&
      String(after || '').trim()
    );
  }

  function existingSceneInsertCanAdvanced(change, path, line, after) {
    const value = isObject(change) ? change : {};
    const rel = String(path || '').replace(/\\/g, '/');
    const sourceLine = Number(line || 0);
    const anchor = String(value.anchorText || (value.source && value.source.anchorText) || '').trim();
    const dedupe = String(value.dedupeSearch || after || '').trim();
    return Boolean(
      rel.startsWith('source/scenes/') &&
      rel.endsWith('.scene.dry') &&
      Number.isInteger(sourceLine) &&
      sourceLine > 0 &&
      anchor &&
      dedupe &&
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
      (String(after || '').trim() || Boolean(value.allowEmptyReplace))
    );
  }

  function existingSceneSectionCanAdvanced(change, path, line, endLine, after) {
    const value = isObject(change) ? change : {};
    const rel = String(path || '').replace(/\\/g, '/');
    const sourceLine = Number(line || 0);
    const sourceEndLine = Number(endLine || 0);
    return Boolean(
      value.operationType === 'replace_section' &&
      rel.startsWith('source/scenes/') &&
      rel.endsWith('.scene.dry') &&
      Number.isInteger(sourceLine) &&
      sourceLine > 0 &&
      Number.isInteger(sourceEndLine) &&
      sourceEndLine >= sourceLine &&
      String(value.anchorText || (value.source && value.source.anchorText) || '').trim() &&
      String(value.endAnchorText || (value.source && value.source.endAnchorText) || '').trim() &&
      (String(after || '').trim() || Boolean(value.allowEmptyReplace))
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
    return installOperationContracts.summarizeInstallOperations(plan, classifyOperation);
  }

  function renderOperationChecklist(plan, options) {
    const operations = ensureArray(plan && plan.operations);
    const groups = [
      ['safe_apply', localizedText(options, 'group.safe_apply', 'Safe apply')],
      ['guarded_apply', localizedText(options, 'group.guarded_apply', 'Guarded install')],
      ['advanced_apply', localizedText(options, 'group.advanced_apply', 'Advanced install')],
      ['manual_review', localizedText(options, 'group.manual_review', 'Manual review')],
      ['refused', localizedText(options, 'group.refused', 'Protected / refused')]
    ];
    const classifications = operations.map(classifyOperation);
    const lines = [
      localizedText(options, 'checklist.title', 'Install operation checklist'),
      localizedText(options, 'checklist.status', 'Status: proposal only / not installed'),
      ''
    ];
    groups.forEach(([status, title]) => {
      const group = classifications.filter((item) => item.status === status);
      lines.push(title + ' (' + group.length + ')');
      if (!group.length) {
        lines.push('- ' + localizedText(options, 'none', 'none'));
      } else {
        group.forEach((item) => {
          const op = item.operation;
          lines.push('- ' + op.type + ' ' + (op.path || localizedText(options, 'unknownPath', '(unknown path)')) + ' — ' + operationReason(op, item, options));
        });
      }
      lines.push('');
    });
    return lines.join('\n').replace(/\n+$/, '\n');
  }

  function operationReason(operation, classification, options) {
    const op = normalizeOperation(operation || {}, 0);
    const item = isObject(classification) ? classification : {};
    const key = operationReasonKey(op);
    if (key) {
      return localizedText(options, key, op.description || item.reason || '');
    }
    if (item.status === 'refused' && item.reason && !op.description) {
      return item.reason;
    }
    if (op.description) {
      return op.description;
    }
    if (item.reason) {
      return item.reason;
    }
    return localizedText(options, op.safety === 'manual_review' ? 'reason.defaultManual' : 'reason.defaultEligible', '');
  }

  function operationReasonKey(operation) {
    const op = operation || {};
    const id = String(op.id || '');
    if (CHECKLIST_TEXT.en['reason.' + id]) {
      return 'reason.' + id;
    }
    if (/^project_metadata_(title|author|ifid)$/.test(id)) {
      return 'reason.project_metadata_replace';
    }
    if (/^project_metadata_(title|author|ifid)_insert$/.test(id)) {
      return 'reason.project_metadata_insert';
    }
    if (/^project_metadata_(title|author|ifid)_manual$/.test(id)) {
      return 'reason.project_metadata_manual';
    }
    if (id === 'create_deck_scene') {
      return 'reason.workspace_layout_deck';
    }
    if (id === 'create_starter_card') {
      return 'reason.workspace_layout_card';
    }
    if (id === 'hand_deck_route') {
      return 'reason.workspace_layout_route';
    }
    if (id === 'hand_deck_route_manual') {
      return 'reason.workspace_layout_route_manual';
    }
    if (id === 'sidebar_category') {
      return 'reason.workspace_layout_sidebar';
    }
    if (id === 'sidebar_category_manual') {
      return 'reason.workspace_layout_sidebar_manual';
    }
    if (/^replace_existing_/.test(id)) {
      return op.type === 'replace_section' ? 'reason.existing_section' : 'reason.existing_text';
    }
    if (/^manual_existing_/.test(id)) {
      return 'reason.existing_manual';
    }
    if (/^copy_asset_file_/.test(id)) {
      return 'reason.asset_file';
    }
    if (op.type && CHECKLIST_TEXT.en['reason.type.' + op.type]) {
      return 'reason.type.' + op.type;
    }
    return '';
  }

  function localizedText(options, key, fallback) {
    const locale = localeKey(options);
    const dict = CHECKLIST_TEXT[locale] || CHECKLIST_TEXT.en;
    return dict[key] || CHECKLIST_TEXT.en[key] || fallback || key;
  }

  function localeKey(options) {
    const raw = isObject(options) ? String(options.locale || '') : '';
    return raw.toLowerCase().startsWith('zh') ? 'zh-Hant' : 'en';
  }

  function renderPatchPreview(plan) {
    return installOperationContracts.renderPatchPreview(plan);
  }

  function applyInstallPlan(plan, options) {
    const node = nodeModules();
    const opts = isObject(options) ? options : {};
    const includeEvidence = opts.includeEvidence === true;
    if (!node) {
      return finalizeApplyResult({
        ok: false,
        dryRun: Boolean(options && options.dryRun !== false),
        results: [],
        diagnostics: [diagnostic('error', 'install_plan.node_only', 'Applying install plans requires Node.js filesystem access.')]
      }, includeEvidence);
    }
    const fs = node.fs;
    const path = node.path;
    const dryRun = opts.dryRun !== false;
    const allowAdvanced = opts.allowAdvanced === true;
    const projectRoot = opts.projectRoot ? path.resolve(String(opts.projectRoot)) : '';
    const diagnostics = [];
    const results = [];
    const operations = orderOperationsForApply(ensureArray(plan.operations).map(normalizeOperation));
    const summary = operationSummary({operations});

    if (!projectRoot) {
      diagnostics.push(diagnostic('error', 'install_plan.project_root', 'projectRoot is required.'));
      return finalizeApplyResult({ok: false, dryRun, operationSummary: summary, results, diagnostics}, includeEvidence);
    }
    if (!fs.existsSync(path.join(projectRoot, 'source', 'info.dry'))) {
      diagnostics.push(diagnostic('error', 'install_plan.project_root', 'source/info.dry was not found under projectRoot.'));
      return finalizeApplyResult({ok: false, dryRun, operationSummary: summary, results, diagnostics}, includeEvidence);
    }
    const provenanceCheck = validateProjectProvenance(plan && plan.project, projectRoot, path);
    if (!provenanceCheck.ok) {
      diagnostics.push(diagnostic('error', 'install_plan.project_mismatch', provenanceCheck.message));
      return finalizeApplyResult({ok: false, dryRun, operationSummary: summary, results, diagnostics}, includeEvidence);
    }

    const context = createApplyContext(fs, path, node.crypto, projectRoot, includeEvidence);
    operations.forEach((operation) => {
      results.push(preflightOperation(context, operation, allowAdvanced, diagnostics));
    });
    validateFinalOperationEffects(context, operations, results, diagnostics);
    const hasFailed = results.some((result) => result && result.status === 'failed');
    if (!dryRun && !hasFailed) {
      commitApplyContext(context);
    }

    return finalizeApplyResult({
      ok: diagnostics.every((item) => item.severity !== 'error'),
      dryRun,
      allowAdvanced,
      operationSummary: summary,
      results: !dryRun && !hasFailed ? markCommittedResults(results) : results,
      diagnostics
    }, includeEvidence);
  }

  function createApplyContext(fs, path, crypto, projectRoot, includeEvidence) {
    return {
      fs,
      path,
      crypto,
      projectRoot,
      includeEvidence,
      textFiles: new Map(),
      copyActions: []
    };
  }

  function preflightOperation(context, operation, allowAdvanced, diagnostics) {
    if (!APPLY_STATUSES.has(operation.safety)) {
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'manual_review'},
        context.includeEvidence,
        operation,
        manualOperationEvidence(operation, 'manual_review', 'This operation requires manual review before source changes.')
      );
    }
    if (operation.safety === 'advanced_apply' && !allowAdvanced) {
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'advanced_review'},
        context.includeEvidence,
        operation,
        manualOperationEvidence(operation, 'advanced_review', 'This operation needs explicit advanced opt-in.')
      );
    }
    const target = resolveSafeTarget(context.projectRoot, operation.path, context.path);
    if (!target.ok) {
      diagnostics.push(diagnostic('error', 'install_plan.unsafe_path', target.message, operation));
      return failedPreflightResult(context, operation, 'unsafe_path', target.message);
    }
    const permission = operationPermission(operation, target.relative, operation.safety);
    if (!permission.ok) {
      diagnostics.push(diagnostic('error', 'install_plan.unsafe_path', permission.message, operation));
      return failedPreflightResult(context, operation, 'refused', permission.message);
    }
    if (operation.type === 'create_file') {
      return preflightCreateFile(context, target.path, operation, diagnostics);
    }
    if (operation.type === 'replace_text') {
      return preflightReplaceText(context, target.path, operation, diagnostics);
    }
    if (operation.type === 'insert_text') {
      return preflightInsertText(context, target.path, operation, diagnostics);
    }
    if (operation.type === 'replace_section') {
      return preflightReplaceSection(context, target.path, operation, diagnostics);
    }
    if (operation.type === 'copy_asset_file') {
      return preflightCopyAssetFile(context, target.path, operation, diagnostics);
    }
    diagnostics.push(diagnostic('error', 'install_plan.unsupported_operation', 'Unsupported safe operation: ' + operation.type, operation));
    return failedPreflightResult(context, operation, 'unsupported_operation', 'Unsupported safe operation: ' + operation.type);
  }

  function validateFinalOperationEffects(context, operations, results, diagnostics) {
    ensureArray(operations).forEach((operation, index) => {
      const result = results[index];
      if (!result || (result.status !== 'would_apply' && result.status !== 'already_applied')) {
        return;
      }
      if (String(operation && operation.type || '') !== 'insert_text') {
        return;
      }
      const dedupe = String(operation && (operation.dedupeSearch || operation.content) || '').trim();
      if (!dedupe) {
        return;
      }
      const target = resolveSafeTarget(context.projectRoot, operation.path, context.path);
      if (!target.ok) {
        return;
      }
      const state = context.textFiles.get(target.path);
      if (!state || !state.exists) {
        return;
      }
      if (String(state.text || '').includes(dedupe)) {
        return;
      }
      const message = 'Insert operation passed its local anchor check, but later same-file operations removed the inserted content.';
      diagnostics.push(diagnostic('error', 'install_plan.final_insert_missing', message, operation));
      results[index] = failedPreflightResult(context, operation, 'final_insert_missing', message);
    });
  }

  function failedPreflightResult(context, operation, match, message) {
    return withOperationEvidence(
      {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
      context.includeEvidence,
      operation,
      failedOperationEvidence(operation, match, message)
    );
  }

  function textFileState(context, target) {
    const key = String(target || '');
    if (context.textFiles.has(key)) {
      return context.textFiles.get(key);
    }
    const exists = context.fs.existsSync(target);
    const state = {
      path: target,
      exists,
      originalExists: exists,
      originalText: exists ? context.fs.readFileSync(target, 'utf8') : '',
      text: exists ? context.fs.readFileSync(target, 'utf8') : '',
      modified: false
    };
    context.textFiles.set(key, state);
    return state;
  }

  function preflightCreateFile(context, target, operation, diagnostics) {
    const state = textFileState(context, target);
    const content = operation.content || '';
    if (state.exists) {
      if (state.text === content) {
        return withOperationEvidence(
          {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied'},
          context.includeEvidence,
          operation,
          textOperationEvidence(operation, 'already_applied', state.text, state.text, {
            match: 'target_file_already_matches',
            afterSnippet: content,
            afterHash: hashText(context.crypto, state.text)
          })
        );
      }
      diagnostics.push(diagnostic('error', 'install_plan.create_exists', 'Target file already exists with different content: ' + operation.path, operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        context.includeEvidence,
        operation,
        textOperationEvidence(operation, 'failed', state.text, content, {
          match: 'target_exists_with_different_content',
          message: 'Target file already exists with different content.',
          beforeSnippet: firstLines(state.text, 8),
          afterSnippet: content,
          beforeHash: hashText(context.crypto, state.text),
          afterHash: hashText(context.crypto, content)
        })
      );
    }
    state.exists = true;
    state.text = content;
    state.modified = true;
    return withOperationEvidence(
      {id: operation.id, type: operation.type, path: operation.path, status: 'would_apply'},
      context.includeEvidence,
      operation,
      textOperationEvidence(operation, 'would_apply', '', content, {
        match: 'target_file_missing',
        message: 'Dry-run verified that this new file can be created.',
        afterSnippet: content,
        afterHash: hashText(context.crypto, content),
        diff: renderVerifiedDiff(operation, '', content, {newFile: true})
      })
    );
  }

  function preflightReplaceText(context, target, operation, diagnostics) {
    const state = textFileState(context, target);
    if (!state.exists) {
      diagnostics.push(diagnostic('error', 'install_plan.replace_missing_file', 'Target file does not exist: ' + operation.path, operation));
      return failedPreflightResult(context, operation, 'target_missing', 'Target file does not exist: ' + operation.path);
    }
    const before = state.text;
    const after = replaceOnce(before, operation, context.crypto, state.originalText);
    if (!after.ok) {
      diagnostics.push(diagnostic('error', after.code, after.message, operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        context.includeEvidence,
        operation,
        textOperationEvidence(operation, 'failed', before, before, Object.assign({}, after, {
          match: after.code || 'match_failed',
          beforeHash: hashText(context.crypto, before),
          afterHash: hashText(context.crypto, before)
        }))
      );
    }
    if (after.alreadyApplied) {
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied'},
        context.includeEvidence,
        operation,
        textOperationEvidence(operation, 'already_applied', before, after.text || before, Object.assign({}, after, {
          match: 'replacement_already_present',
          beforeHash: hashText(context.crypto, before),
          afterHash: hashText(context.crypto, after.text || before)
        }))
      );
    }
    state.text = after.text;
    state.modified = true;
    return withOperationEvidence(
      {id: operation.id, type: operation.type, path: operation.path, status: 'would_apply'},
      context.includeEvidence,
      operation,
      textOperationEvidence(operation, 'would_apply', before, after.text, Object.assign({}, after, {
        match: 'matched_current_file',
        beforeHash: hashText(context.crypto, before),
        afterHash: hashText(context.crypto, after.text),
        diff: renderVerifiedDiff(operation, after.beforeSnippet || operation.search || '', after.afterSnippet || operation.replace || '', after)
      }))
    );
  }

  function preflightInsertText(context, target, operation, diagnostics) {
    const state = textFileState(context, target);
    if (!state.exists) {
      diagnostics.push(diagnostic('error', 'install_plan.insert_missing_file', 'Target file does not exist: ' + operation.path, operation));
      return failedPreflightResult(context, operation, 'target_missing', 'Target file does not exist: ' + operation.path);
    }
    const before = state.text;
    const inserted = insertAtAnchor(before, operation, state.originalText);
    if (!inserted.ok) {
      diagnostics.push(diagnostic('error', inserted.code, inserted.message, operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        context.includeEvidence,
        operation,
        textOperationEvidence(operation, 'failed', before, before, Object.assign({}, inserted, {
          match: inserted.code || 'anchor_failed',
          beforeHash: hashText(context.crypto, before),
          afterHash: hashText(context.crypto, before)
        }))
      );
    }
    if (inserted.alreadyApplied) {
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied'},
        context.includeEvidence,
        operation,
        textOperationEvidence(operation, 'already_applied', before, inserted.text || before, Object.assign({}, inserted, {
          match: 'dedupe_already_present',
          beforeHash: hashText(context.crypto, before),
          afterHash: hashText(context.crypto, inserted.text || before)
        }))
      );
    }
    state.text = inserted.text;
    state.modified = true;
    return withOperationEvidence(
      {id: operation.id, type: operation.type, path: operation.path, status: 'would_apply'},
      context.includeEvidence,
      operation,
      textOperationEvidence(operation, 'would_apply', before, inserted.text, Object.assign({}, inserted, {
        match: 'matched_current_anchor',
        beforeHash: hashText(context.crypto, before),
        afterHash: hashText(context.crypto, inserted.text),
        diff: renderVerifiedDiff(operation, inserted.beforeSnippet || operation.anchorText || '', inserted.afterSnippet || operation.content || '', inserted)
      }))
    );
  }

  function preflightReplaceSection(context, target, operation, diagnostics) {
    const state = textFileState(context, target);
    if (!state.exists) {
      diagnostics.push(diagnostic('error', 'install_plan.section_missing_file', 'Target file does not exist: ' + operation.path, operation));
      return failedPreflightResult(context, operation, 'target_missing', 'Target file does not exist: ' + operation.path);
    }
    const before = state.text;
    const section = replaceSection(before, operation, state.originalText);
    if (!section.ok) {
      diagnostics.push(diagnostic('error', section.code, section.message, operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        context.includeEvidence,
        operation,
        textOperationEvidence(operation, 'failed', before, before, Object.assign({}, section, {
          match: section.code || 'section_failed',
          beforeHash: hashText(context.crypto, before),
          afterHash: hashText(context.crypto, before)
        }))
      );
    }
    if (section.alreadyApplied) {
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied'},
        context.includeEvidence,
        operation,
        textOperationEvidence(operation, 'already_applied', before, section.text || before, Object.assign({}, section, {
          match: 'replacement_section_already_present',
          beforeHash: hashText(context.crypto, before),
          afterHash: hashText(context.crypto, section.text || before)
        }))
      );
    }
    if (operation.expectedRangeHash && section.beforeSnippet && hashText(context.crypto, section.beforeSnippet) !== operation.expectedRangeHash) {
      diagnostics.push(diagnostic('error', 'install_plan.section_range_hash_mismatch', 'Section range evidence hash did not match the current source text.', operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        context.includeEvidence,
        operation,
        textOperationEvidence(operation, 'failed', before, before, Object.assign({}, section, {
          match: 'section_range_hash_mismatch',
          message: 'Section range evidence hash did not match the current source text.',
          beforeHash: hashText(context.crypto, before),
          afterHash: hashText(context.crypto, before)
        }))
      );
    }
    state.text = section.text;
    state.modified = true;
    return withOperationEvidence(
      {id: operation.id, type: operation.type, path: operation.path, status: 'would_apply'},
      context.includeEvidence,
      operation,
      textOperationEvidence(operation, 'would_apply', before, section.text, Object.assign({}, section, {
        match: section.matchKind === 'trim_equivalent_line_evidence' ? 'matched_current_section_trim_equivalent' : 'matched_current_section',
        beforeHash: hashText(context.crypto, before),
        afterHash: hashText(context.crypto, section.text),
        diff: renderVerifiedDiff(operation, section.beforeSnippet || operation.anchorText || '', section.afterSnippet || operation.content || '', section)
      }))
    );
  }

  function preflightCopyAssetFile(context, target, operation, diagnostics) {
    const sourcePath = String(operation.sourcePath || '').trim();
    if (!sourcePath) {
      diagnostics.push(diagnostic('error', 'install_plan.copy_source_missing', 'Asset copy sourcePath is required for guarded apply.', operation));
      return failedPreflightResult(context, operation, 'copy_source_missing', 'Asset copy sourcePath is required for guarded apply.');
    }
    if (!context.path.isAbsolute(sourcePath)) {
      diagnostics.push(diagnostic('error', 'install_plan.copy_source_path', 'Asset copy sourcePath must be an absolute desktop file path.', operation));
      return failedPreflightResult(context, operation, 'copy_source_path', 'Asset copy sourcePath must be an absolute desktop file path.');
    }
    if (!context.fs.existsSync(sourcePath) || !context.fs.statSync(sourcePath).isFile()) {
      diagnostics.push(diagnostic('error', 'install_plan.copy_source_missing', 'Asset copy source file does not exist: ' + sourcePath, operation));
      return failedPreflightResult(context, operation, 'copy_source_missing', 'Asset copy source file does not exist.');
    }
    const sourceHash = hashFile(context.fs, context.crypto, sourcePath);
    if (context.fs.existsSync(target)) {
      if (!context.fs.statSync(target).isFile()) {
        diagnostics.push(diagnostic('error', 'install_plan.copy_conflict', 'Asset copy target exists and is not a file: ' + operation.path, operation));
        return withOperationEvidence(
          {id: operation.id, type: operation.type, path: operation.path, status: 'failed', sourceHash},
          context.includeEvidence,
          operation,
          assetOperationEvidence(operation, 'failed', {
            match: 'target_exists_not_file',
            message: 'Asset copy target exists and is not a file.',
            sourceHash
          })
        );
      }
      const targetHash = hashFile(context.fs, context.crypto, target);
      if (sourceHash === targetHash) {
        return withOperationEvidence(
          {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied', sourceHash, targetHash},
          context.includeEvidence,
          operation,
          assetOperationEvidence(operation, 'already_applied', {
            match: 'asset_bytes_already_match',
            sourceHash,
            targetHash
          })
        );
      }
      diagnostics.push(diagnostic('error', 'install_plan.copy_conflict', 'Asset copy target already exists with different bytes: ' + operation.path, operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed', sourceHash, targetHash},
        context.includeEvidence,
        operation,
        assetOperationEvidence(operation, 'failed', {
          match: 'target_exists_with_different_bytes',
          message: 'Asset copy target already exists with different bytes.',
          sourceHash,
          targetHash
        })
      );
    }
    context.copyActions.push({sourcePath, target});
    return withOperationEvidence(
      {id: operation.id, type: operation.type, path: operation.path, status: 'would_apply', sourceHash},
      context.includeEvidence,
      operation,
      assetOperationEvidence(operation, 'would_apply', {
        match: 'source_file_available',
        message: 'Dry-run verified that this asset can be copied.',
        sourceHash,
        diff: renderVerifiedDiff(operation, '', operation.content || ('source: ' + (operation.sourceName || 'asset')), {asset: true})
      })
    );
  }

  function commitApplyContext(context) {
    context.textFiles.forEach((state) => {
      if (!state.modified) {
        return;
      }
      context.fs.mkdirSync(context.path.dirname(state.path), {recursive: true});
      context.fs.writeFileSync(state.path, state.text, 'utf8');
    });
    context.copyActions.forEach((action) => {
      context.fs.mkdirSync(context.path.dirname(action.target), {recursive: true});
      context.fs.copyFileSync(action.sourcePath, action.target);
    });
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
    const protectedMessage = protectedGeneratedOutputMessage(relPath, relative);
    if (protectedMessage) {
      return {ok: false, message: protectedMessage};
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
    const modules = nodeModules();
    const fsApi = modules && modules.fs;
    const expectedRoot = canonicalProjectRoot(String(provenance.root), pathApi, fsApi);
    const actualRoot = canonicalProjectRoot(String(projectRoot), pathApi, fsApi);
    if (expectedRoot !== actualRoot) {
      return {
        ok: false,
        message: 'Install plan was generated for a different project root. Plan root: ' + expectedRoot + '; open project root: ' + actualRoot + '.'
      };
    }
    return {ok: true};
  }

  function canonicalProjectRoot(root, pathApi, fsApi) {
    const resolved = pathApi.resolve(String(root || ''));
    if (!fsApi || !fsApi.existsSync || !fsApi.realpathSync || !fsApi.existsSync(resolved)) {
      return resolved;
    }
    try {
      return fsApi.realpathSync.native
        ? fsApi.realpathSync.native(resolved)
        : fsApi.realpathSync(resolved);
    } catch (_err) {
      return resolved;
    }
  }

  function portablePathSafety(relPath) {
    if (!relPath) {
      return {ok: false, message: 'Operation path is required.'};
    }
    const rel = protectedPathPolicyApi().normalizeRelativePath(relPath);
    if (rel.startsWith('/') || /^[A-Za-z]:\//.test(rel)) {
      return {ok: false, message: 'Operation path must be relative to the project root: ' + relPath};
    }
    const parts = rel.split('/').filter(Boolean);
    if (!parts.length || parts.includes('..')) {
      return {ok: false, message: 'Operation path escapes the project root: ' + relPath};
    }
    const protectedMessage = protectedGeneratedOutputMessage(relPath, rel);
    if (protectedMessage) {
      return {ok: false, message: protectedMessage};
    }
    return {ok: true, relative: parts.join('/')};
  }

  function protectedGeneratedOutputMessage(relPath, relative) {
    const reason = protectedPathPolicyApi().protectedGeneratedOutputReason(relative);
    if (reason === 'git') {
      return 'Operation path targets .git: ' + relPath;
    }
    if (reason === 'generated_output') {
      return 'Operation path targets generated/protected output: ' + relPath;
    }
    return '';
  }

  function operationPermission(operation, relative, safety) {
    const rel = protectedPathPolicyApi().normalizeRelativePath(relative);
    if (isProtectedRouterPath(rel) && safety !== 'advanced_apply') {
      if (
        operation.type === 'insert_text' &&
        safety === 'guarded_apply' &&
        isProtectedRouterPath(rel) &&
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
      if (safety === 'advanced_apply' && operation.type === 'replace_text' && operation.line) {
        return {ok: true, message: 'Advanced project metadata replacement is allowed with exact line evidence.'};
      }
      if (
        safety === 'advanced_apply' &&
        operation.type === 'replace_section' &&
        operation.anchorText &&
        operation.endAnchorText &&
        (operation.content || operation.allowEmptyReplace) &&
        operation.dedupeSearch
      ) {
        return {ok: true, message: 'Advanced project metadata section replacement is allowed with exact anchors.'};
      }
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
      if (isCardSceneCreate(operation, rel)) {
        return {ok: true, message: 'Safe card create_file may use a project-specific source/scenes subdirectory.'};
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
        if (rel.startsWith('source/scenes/') && rel.endsWith('.scene.dry') && operation.line) {
          return {ok: true, message: 'Advanced scene replace_text is allowed with exact line evidence.'};
        }
        if (rel.startsWith('source/qdisplays/') && rel.endsWith('.qdisplay.dry') && operation.line) {
          return {ok: true, message: 'Advanced qdisplay replace_text is allowed with exact line evidence.'};
        }
        return {ok: false, message: 'advanced replace_text requires source-backed exact line evidence: ' + rel};
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
      if (
        safety === 'advanced_apply' &&
        rel.startsWith('source/scenes/') &&
        rel.endsWith('.scene.dry') &&
        operation.anchorText &&
        operation.content &&
        operation.dedupeSearch
      ) {
        return {ok: true, message: 'Advanced source insert is allowed with an exact anchor and dedupe evidence.'};
      }
      if (safety === 'guarded_apply' && rel.startsWith('source/scenes/') && rel.endsWith('.scene.dry') && operation.anchorText && operation.dedupeSearch) {
        return {ok: true, message: 'Guarded source insert with anchor and dedupe evidence.'};
      }
      return {ok: false, message: 'insert_text requires guarded source scene evidence: ' + rel};
    }
    if (operation.type === 'replace_section') {
      if (
        safety === 'advanced_apply' &&
        rel.startsWith('source/scenes/') &&
        rel.endsWith('.scene.dry') &&
        operation.anchorText &&
        operation.endAnchorText &&
        (operation.content || operation.allowEmptyReplace) &&
        operation.dedupeSearch
      ) {
        return {ok: true, message: 'Advanced source section replacement with exact start/end anchors and dedupe evidence.'};
      }
      if (
        safety === 'guarded_apply' &&
        rel.startsWith('source/scenes/') &&
        rel.endsWith('.scene.dry') &&
        operation.anchorText &&
        operation.endAnchorText &&
        (operation.content || operation.allowEmptyReplace) &&
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
      if (!isAbsoluteDesktopPath(operation.sourcePath)) {
        return {ok: false, message: 'copy_asset_file requires an absolute desktop sourcePath.'};
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

  function isAbsoluteDesktopPath(value) {
    const text = String(value || '').trim();
    return /^(?:\/|[A-Za-z]:[\\/])/.test(text);
  }

  function isKnownAssetExtension(value) {
    return /\.(png|jpe?g|gif|webp|svg|mp3|ogg|wav|flac|m4a)$/i.test(String(value || '').split(/[?#]/)[0]);
  }

  function isProtectedRouterPath(relPath) {
    return protectedPathPolicyApi().isProtectedRouterSourcePath(relPath);
  }

  function safeOperationPermission(operation, relative) {
    return operationPermission(operation, relative, 'safe_apply');
  }

  function isCardSceneCreate(operation, rel) {
    const sceneKind = String(operation && (operation.sceneKind || operation.objectKind || '') || '').trim();
    if (sceneKind !== 'card' && sceneKind !== 'advisor_like') {
      return false;
    }
    if (!rel.startsWith('source/scenes/') || !rel.endsWith('.scene.dry')) {
      return false;
    }
    return !isProtectedRouterPath(rel);
  }

  function renderVerifiedDiff(operation, beforeSnippet, afterSnippet, options) {
    const opts = isObject(options) ? options : {};
    const pathLabel = operation.path || '(unknown-path)';
    const header = [
      'diff --git a/' + pathLabel + ' b/' + pathLabel
    ];
    if (opts.newFile || opts.asset) {
      header.push('--- /dev/null');
    } else {
      header.push('--- a/' + pathLabel);
    }
    header.push('+++ b/' + pathLabel);
    header.push('@@ current file evidence' + evidenceLineLabel(opts, operation));
    if (opts.asset) {
      return header.concat([
        '+# source: ' + (operation.sourceName || '(selected local asset)'),
        '+# target: ' + pathLabel,
        '+# ' + (operation.description || 'Copy asset file into the project.')
      ]).join('\n') + '\n';
    }
    const before = String(beforeSnippet || '');
    const after = String(afterSnippet || '');
    const body = [];
    if (operation.type === 'insert_text') {
      if (operation.position === 'before' && after) {
        body.push(prefixLines('+', after));
      }
      if (before) {
        body.push(prefixLines(' ', before));
      }
      if (operation.position !== 'before' && after) {
        body.push(prefixLines('+', after));
      }
      return header.concat(body.length ? body : [' # no text diff']).join('\n') + '\n';
    }
    if (before) {
      body.push(prefixLines('-', before));
    }
    if (after) {
      body.push(prefixLines('+', after));
    }
    return header.concat(body.length ? body : [' # no text diff']).join('\n') + '\n';
  }

  function evidenceLineLabel(details, operation) {
    const start = details.startLine || details.line || operation.startLine || operation.line || null;
    const end = details.endLine || operation.endLine || null;
    if (start && end && end !== start) {
      return ' lines ' + start + '-' + end;
    }
    if (start) {
      return ' line ' + start;
    }
    return '';
  }

  function firstLines(text, limit) {
    return contentLines(text).slice(0, limit || 8).join('\n');
  }

  function orderOperationsForApply(operations) {
    return ensureArray(operations).map((operation, index) => ({operation, index})).sort((left, right) => {
      const a = left.operation || {};
      const b = right.operation || {};
      if (sameSourceMutationPath(a, b)) {
        const aLine = sourceMutationLine(a);
        const bLine = sourceMutationLine(b);
        if (aLine > 0 && bLine > 0 && aLine !== bLine) {
          return bLine - aLine;
        }
        if (aLine > 0 && bLine > 0 && aLine === bLine) {
          const aPriority = sameLineMutationPriority(a);
          const bPriority = sameLineMutationPriority(b);
          if (aPriority !== bPriority) {
            return aPriority - bPriority;
          }
        }
      }
      return left.index - right.index;
    }).map((item) => item.operation);
  }

  function sameLineMutationPriority(operation) {
    const type = String(operation && operation.type || '');
    if (type === 'insert_text') {
      return 0;
    }
    if (type === 'replace_text') {
      return 1;
    }
    return 2;
  }

  function sameSourceMutationPath(a, b) {
    return String(a && a.path || '') &&
      String(a && a.path || '') === String(b && b.path || '') &&
      isSourceTextMutation(a) &&
      isSourceTextMutation(b);
  }

  function isSourceTextMutation(operation) {
    return /^(?:replace_text|insert_text|replace_section)$/.test(String(operation && operation.type || ''));
  }

  function sourceMutationLine(operation) {
    const value = Number(operation && (operation.startLine || operation.line) || 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function hashFile(fs, crypto, filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  }

  function hashText(crypto, text) {
    if (!crypto || typeof crypto.createHash !== 'function') {
      return '';
    }
    return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
  }

  function preferredEol(text) {
    const crlf = (String(text || '').match(/\r\n/g) || []).length;
    const lf = (String(text || '').replace(/\r\n/g, '').match(/\n/g) || []).length;
    return crlf > lf ? '\r\n' : '\n';
  }

  function splitLogicalLines(text) {
    const value = String(text || '');
    const hadFinalNewline = /(?:\r\n|\n|\r)$/.test(value);
    const body = hadFinalNewline ? value.replace(/(?:\r\n|\n|\r)$/, '') : value;
    return {
      lines: body ? body.split(/\r\n|\n|\r/) : [],
      eol: preferredEol(value),
      hadFinalNewline
    };
  }

  function contentLines(content) {
    const body = String(content || '').replace(/(?:\r\n|\n|\r)$/, '');
    return body ? body.split(/\r\n|\n|\r/) : [];
  }

  function joinLogicalLines(parts) {
    return parts.lines.join(parts.eol) + (parts.hadFinalNewline ? parts.eol : '');
  }

  function normalizeNewlines(value) {
    return String(value || '').replace(/\r\n|\r/g, '\n');
  }

  function containsUniqueNormalizedBlock(text, content) {
    const block = normalizeNewlines(content).replace(/\n$/, '');
    if (!block) {
      return false;
    }
    return normalizeNewlines(text).split(block).length - 1 === 1;
  }

  function hasDedupeNearInsert(lines, insertAt, insertLineCount, dedupe, position) {
    if (!dedupe) {
      return false;
    }
    const width = Math.max(1, insertLineCount) + 2;
    const start = position === 'before' ? Math.max(0, insertAt - width) : insertAt;
    const end = position === 'before' ? insertAt : Math.min(lines.length, insertAt + width);
    return lines.slice(start, end).join('\n').includes(dedupe);
  }

  function replaceOnce(text, operation, crypto, originalText) {
    const search = operation.search || '';
    if (!search) {
      return {ok: false, code: 'install_plan.replace_empty_search', message: 'Replacement search text is empty.'};
    }
    const replacement = operation.replace || '';
    const deleteLine = shouldDeleteWholeLine(operation, replacement);
    if (operation.line) {
      const parts = splitLogicalLines(text);
      const lines = parts.lines;
      const resolvedLine = resolveReplaceLineIndex(lines, originalText, operation, crypto, search, replacement, deleteLine);
      if (!resolvedLine.ok) {
        return resolvedLine;
      }
      const index = resolvedLine.index;
      const beforeLine = lines[index];
      if (replacement && beforeLine && beforeLine.includes(replacement)) {
        return {ok: true, alreadyApplied: true, text, line: index + 1, beforeSnippet: beforeLine, afterSnippet: beforeLine};
      }
      if (deleteLine && text.split(search).length - 1 === 0) {
        return {ok: true, alreadyApplied: true, text, line: operation.line, beforeSnippet: '', afterSnippet: ''};
      }
      if (index >= 0 && index < lines.length && lines[index].includes(search)) {
        if (deleteLine) {
          lines.splice(index, 1);
        } else {
          lines[index] = lines[index].replace(search, replacement);
        }
        return {
          ok: true,
          text: joinLogicalLines(parts),
          line: index + 1,
          beforeSnippet: beforeLine,
          afterSnippet: deleteLine ? '' : lines[index],
          deleteMode: deleteLine ? 'line' : ''
        };
      }
      return {
        ok: false,
        code: 'install_plan.replace_line_mismatch',
        message: 'Replacement line evidence did not match the target text.'
      };
    }
    const matches = text.split(search).length - 1;
    if (matches !== 1) {
      const alreadyMatches = replacement ? text.split(replacement).length - 1 : 0;
      if (matches === 0 && alreadyMatches >= 1) {
        return {ok: true, alreadyApplied: true, text, beforeSnippet: replacement, afterSnippet: replacement};
      }
      return {
        ok: false,
        code: 'install_plan.replace_ambiguous',
        message: 'Expected exactly one match for replacement text, found ' + matches + '.'
      };
    }
    if (deleteLine) {
      const parts = splitLogicalLines(text);
      const matches = [];
      parts.lines.forEach((line, index) => {
        if (line.includes(search)) {
          matches.push(index);
        }
      });
      if (matches.length !== 1) {
        return {
          ok: false,
          code: matches.length ? 'install_plan.replace_ambiguous' : 'install_plan.replace_line_mismatch',
          message: 'Expected exactly one source line to delete, found ' + matches.length + '.'
        };
      }
      const beforeLine = parts.lines[matches[0]];
      parts.lines.splice(matches[0], 1);
      return {ok: true, text: joinLogicalLines(parts), beforeSnippet: beforeLine, afterSnippet: '', deleteMode: 'line'};
    }
    return {ok: true, text: text.replace(search, replacement), beforeSnippet: search, afterSnippet: replacement};
  }

  function resolveReplaceLineIndex(lines, originalText, operation, crypto, search, replacement, deleteLine) {
    const lineIndex = Number(operation && operation.line || 0) - 1;
    const beforeLine = lineIndex >= 0 && lineIndex < lines.length ? lines[lineIndex] : undefined;
    const sourceEvidence = lineMatchesReplaceEvidence(beforeLine, operation, crypto);
    if (sourceEvidence.ok && lineSatisfiesReplaceTarget(beforeLine, search, replacement, deleteLine)) {
      return {ok: true, index: lineIndex};
    }
    const shifted = resolveShiftedReplaceLineIndex(lines, originalText, lineIndex, operation, crypto, search, replacement, deleteLine);
    if (shifted.ok) {
      return shifted;
    }
    const alreadyApplied = resolveAlreadyAppliedReplaceLineIndex(lines, lineIndex, replacement, deleteLine);
    if (alreadyApplied.ok) {
      return alreadyApplied;
    }
    if (!sourceEvidence.ok) {
      return sourceEvidence;
    }
    return {
      ok: false,
      code: 'install_plan.replace_line_mismatch',
      message: 'Replacement line evidence did not match the target text.'
    };
  }

  function lineSatisfiesReplaceTarget(line, search, replacement, deleteLine) {
    const value = String(line === undefined || line === null ? '' : line);
    return value.includes(search) || Boolean(replacement && value.includes(replacement)) || Boolean(deleteLine && search);
  }

  function resolveAlreadyAppliedReplaceLineIndex(lines, lineIndex, replacement, deleteLine) {
    const target = String(replacement || '');
    if (!target || deleteLine) {
      return {ok: false};
    }
    if (lineIndex >= 0 && lineIndex < lines.length && String(lines[lineIndex] || '').includes(target)) {
      return {ok: true, index: lineIndex, matchKind: 'already_applied_line'};
    }
    const replacementMatches = [];
    lines.forEach((line, index) => {
      if (String(line || '').includes(target)) {
        replacementMatches.push(index);
      }
    });
    if (replacementMatches.length === 1) {
      return {ok: true, index: replacementMatches[0], matchKind: 'already_applied_unique'};
    }
    return {ok: false};
  }

  function resolveShiftedReplaceLineIndex(lines, originalText, lineIndex, operation, crypto, search, replacement, deleteLine) {
    const originalLines = splitLogicalLines(originalText || '').lines;
    const originalLine = originalLines[lineIndex];
    const sourceEvidence = lineMatchesReplaceEvidence(originalLine, operation, crypto);
    if (!sourceEvidence.ok || !lineSatisfiesReplaceTarget(originalLine, search, replacement, deleteLine)) {
      return {ok: false};
    }
    const exactOriginalLineMatches = [];
    lines.forEach((line, index) => {
      if (line === originalLine) {
        exactOriginalLineMatches.push(index);
      }
    });
    if (exactOriginalLineMatches.length === 1) {
      return {ok: true, index: exactOriginalLineMatches[0]};
    }
    if (exactOriginalLineMatches.length > 1) {
      return {
        ok: false,
        code: 'install_plan.replace_line_mismatch',
        message: 'Replacement line evidence matched the original source, but the shifted line is ambiguous after earlier same-file operations.'
      };
    }
    const searchMatches = [];
    lines.forEach((line, index) => {
      if (String(line || '').includes(search)) {
        searchMatches.push(index);
      }
    });
    if (searchMatches.length === 1) {
      return {ok: true, index: searchMatches[0]};
    }
    return {
      ok: false,
      code: 'install_plan.replace_line_mismatch',
      message: searchMatches.length
        ? 'Replacement line evidence matched the original source, but the shifted target is ambiguous after earlier same-file operations.'
        : 'Replacement line evidence matched the original source, but the target no longer exists after earlier same-file operations.'
    };
  }

  function lineMatchesReplaceEvidence(line, operation, crypto) {
    const rawAnchor = String(operation && operation.rawAnchorText || '');
    if (line === undefined || line === null) {
      return {
        ok: false,
        code: 'install_plan.replace_line_mismatch',
        message: 'Replacement line evidence points outside the target file.'
      };
    }
    if (rawAnchor && line !== rawAnchor) {
      return {
        ok: false,
        code: 'install_plan.replace_raw_line_mismatch',
        message: 'Raw replacement line evidence did not match the current source text.'
      };
    }
    const expectedHash = String(operation && operation.expectedRangeHash || '');
    if (expectedHash && hashText(crypto, line) !== expectedHash) {
      return {
        ok: false,
        code: 'install_plan.replace_range_hash_mismatch',
        message: 'Replacement line evidence hash did not match the current source text.'
      };
    }
    return {ok: true};
  }

  function shouldDeleteWholeLine(operation, replacement) {
    return !String(replacement || '') &&
      (String(operation && operation.deleteMode || '') === 'line' || Boolean(operation && operation.deletesSourceLine));
  }

  function insertAtAnchor(text, operation, originalText) {
    const anchor = operation.anchorText || '';
    if (!anchor) {
      return {ok: false, code: 'install_plan.insert_empty_anchor', message: 'Insert anchor text is empty.'};
    }
    const content = operation.content || '';
    if (!content) {
      return {ok: false, code: 'install_plan.insert_empty_content', message: 'Insert content is empty.'};
    }
    const dedupe = operation.dedupeSearch || content.trim();
    const parts = splitLogicalLines(text);
    const lines = parts.lines;
    const matches = [];
    const lineEvidence = Number(operation.line || operation.startLine || 0);
    if (Number.isInteger(lineEvidence) && lineEvidence > 0) {
      const lineIndex = lineEvidence - 1;
      const line = lines[lineIndex];
      if (line === undefined) {
        return {
          ok: false,
          code: 'install_plan.insert_line_missing',
          message: 'Insert line evidence points outside the target file.'
        };
      }
      if (line.includes(anchor)) {
        matches.push(lineIndex);
      } else {
        const shifted = resolveShiftedInsertAnchorLine(lines, originalText, lineIndex, anchor);
        if (!shifted.ok) {
          return shifted;
        }
        matches.push(shifted.index);
      }
    } else {
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
    }
    const insertLines = contentLines(content);
    const insertAt = operation.position === 'before' ? matches[0] : matches[0] + 1;
    if (hasDedupeNearInsert(lines, insertAt, insertLines.length, dedupe, operation.position)) {
      return {
        ok: true,
        alreadyApplied: true,
        text,
        line: matches[0] + 1,
        beforeSnippet: lines[matches[0]] || anchor,
        afterSnippet: content
      };
    }
    const nextLines = lines.slice(0, insertAt).concat(insertLines, lines.slice(insertAt));
    return {
      ok: true,
      text: joinLogicalLines(Object.assign({}, parts, {lines: nextLines})),
      line: matches[0] + 1,
      beforeSnippet: lines[matches[0]] || anchor,
      afterSnippet: content
    };
  }

  function resolveShiftedInsertAnchorLine(lines, originalText, lineIndex, anchor) {
    const originalLines = splitLogicalLines(originalText || '').lines;
    const originalLine = originalLines[lineIndex];
    if (originalLine === undefined || !String(originalLine || '').includes(anchor)) {
      return {
        ok: false,
        code: 'install_plan.insert_line_anchor_mismatch',
        message: 'Insert line evidence did not match the anchor text.'
      };
    }
    const exactOriginalLineMatches = [];
    lines.forEach((line, index) => {
      if (line === originalLine) {
        exactOriginalLineMatches.push(index);
      }
    });
    if (exactOriginalLineMatches.length === 1) {
      return {ok: true, index: exactOriginalLineMatches[0]};
    }
    if (exactOriginalLineMatches.length > 1) {
      return {
        ok: false,
        code: 'install_plan.insert_line_anchor_mismatch',
        message: 'Insert line evidence matched the original source, but the shifted anchor is ambiguous after earlier same-file operations.'
      };
    }
    const anchorMatches = [];
    lines.forEach((line, index) => {
      if (String(line || '').includes(anchor)) {
        anchorMatches.push(index);
      }
    });
    if (anchorMatches.length === 1) {
      return {ok: true, index: anchorMatches[0]};
    }
    return {
      ok: false,
      code: 'install_plan.insert_line_anchor_mismatch',
      message: anchorMatches.length
        ? 'Insert line evidence matched the original source, but the shifted anchor is ambiguous after earlier same-file operations.'
        : 'Insert line evidence matched the original source, but the anchor no longer exists after earlier same-file operations.'
    };
  }

  function replaceSection(text, operation, originalText) {
    const anchor = operation.anchorText || '';
    const endAnchor = operation.endAnchorText || '';
    const content = operation.content || '';
    if (!anchor) {
      return {ok: false, code: 'install_plan.section_empty_anchor', message: 'Section start anchor text is empty.'};
    }
    if (!endAnchor) {
      return {ok: false, code: 'install_plan.section_empty_end_anchor', message: 'Section end anchor text is empty.'};
    }
    if (!content && !operation.allowEmptyReplace) {
      return {ok: false, code: 'install_plan.section_empty_content', message: 'Section replacement content is empty.'};
    }
    const parts = splitLogicalLines(text);
    const lines = parts.lines;
    const startMatch = resolveSectionAnchor(lines, anchor, operation.rawAnchorText || '', operation.startLine || operation.line || null, 0, 'start', originalText);
    if (!startMatch.ok) {
      if (containsUniqueNormalizedBlock(text, content)) {
        return {ok: true, alreadyApplied: true, text, beforeSnippet: content, afterSnippet: content};
      }
      return {
        ok: false,
        code: startMatch.code,
        message: startMatch.message
      };
    }
    const start = startMatch.index;
    const replacementLines = contentLines(content);
    const existingReplacementAtStart = lines.slice(start, start + replacementLines.length).join(parts.eol);
    if (replacementLines.length && normalizedReplacementBlock(existingReplacementAtStart) === normalizedReplacementBlock(content)) {
      return {
        ok: true,
        alreadyApplied: true,
        text,
        startLine: start + 1,
        endLine: start + replacementLines.length,
        beforeSnippet: existingReplacementAtStart,
        afterSnippet: content,
        matchKind: startMatch.matchKind === 'trim_equivalent'
          ? 'trim_equivalent_line_evidence'
          : 'exact_line_evidence'
      };
    }
    const endMatch = resolveSectionAnchor(lines, endAnchor, operation.rawEndAnchorText || '', operation.endLine || null, start, 'end', originalText);
    if (!endMatch.ok) {
      if (containsUniqueNormalizedBlock(text, content)) {
        return {ok: true, alreadyApplied: true, text, beforeSnippet: content, afterSnippet: content};
      }
      return {
        ok: false,
        code: endMatch.code,
        message: endMatch.message
      };
    }
    const end = endMatch.index;
    if (operation.startLine && start + 1 !== operation.startLine && !isShiftedSectionMatch(startMatch.matchKind)) {
      return {
        ok: false,
        code: 'install_plan.section_start_line_mismatch',
        message: 'Section start anchor matched line ' + (start + 1) + ', expected line ' + operation.startLine + '.'
      };
    }
    if (operation.endLine && end + 1 !== operation.endLine && !isShiftedSectionMatch(endMatch.matchKind)) {
      return {
        ok: false,
        code: 'install_plan.section_end_line_mismatch',
        message: 'Section end anchor matched line ' + (end + 1) + ', expected line ' + operation.endLine + '.'
      };
    }
    const beforeSnippet = lines.slice(start, end + 1).join(parts.eol);
    if (normalizedReplacementBlock(beforeSnippet) === normalizedReplacementBlock(content)) {
      return {
        ok: true,
        alreadyApplied: true,
        text,
        startLine: start + 1,
        endLine: end + 1,
        beforeSnippet,
        afterSnippet: content,
        matchKind: startMatch.matchKind === 'trim_equivalent' || endMatch.matchKind === 'trim_equivalent'
          ? 'trim_equivalent_line_evidence'
          : 'exact_line_evidence'
      };
    }
    const nextLines = lines.slice(0, start).concat(replacementLines, lines.slice(end + 1));
    return {
      ok: true,
      text: joinLogicalLines(Object.assign({}, parts, {lines: nextLines})),
      startLine: start + 1,
      endLine: end + 1,
      beforeSnippet,
      afterSnippet: content,
      matchKind: startMatch.matchKind === 'trim_equivalent' || endMatch.matchKind === 'trim_equivalent'
        ? 'trim_equivalent_line_evidence'
        : 'exact_line_evidence'
    };
  }

  function normalizedReplacementBlock(value) {
    return normalizeNewlines(value).replace(/\n$/, '');
  }

  function resolveSectionAnchor(lines, anchor, rawAnchor, lineEvidence, minimumIndex, kind, originalText) {
    const label = kind === 'end' ? 'end' : 'start';
    const missingCode = kind === 'end' ? 'install_plan.section_end_anchor_missing' : 'install_plan.section_anchor_missing';
    const ambiguousCode = kind === 'end' ? 'install_plan.section_ambiguous_end_anchor' : 'install_plan.section_ambiguous_anchor';
    const lineNumber = Number(lineEvidence || 0);
    if (Number.isInteger(lineNumber) && lineNumber > 0) {
      const index = lineNumber - 1;
      const line = lines[index];
      if (line === undefined || index < minimumIndex) {
        const shifted = resolveShiftedSectionAnchorLine(lines, originalText, index, anchor, rawAnchor, minimumIndex, kind);
        if (shifted.ok) {
          return shifted;
        }
        return {
          ok: false,
          code: missingCode,
          count: 0,
          message: 'Section ' + label + ' line evidence points outside the target range.'
        };
      }
      const match = lineMatchesSourceAnchor(line, anchor, rawAnchor, true);
      if (!match.ok) {
        const shifted = resolveShiftedSectionAnchorLine(lines, originalText, index, anchor, rawAnchor, minimumIndex, kind);
        if (shifted.ok) {
          return shifted;
        }
        return shifted.code ? shifted : {
          ok: false,
          code: kind === 'end' ? 'install_plan.section_end_line_mismatch' : 'install_plan.section_start_line_mismatch',
          count: 0,
          message: 'Section ' + label + ' line evidence did not match the anchor text.'
        };
      }
      return {ok: true, index, count: 1, matchKind: match.kind};
    }
    const exact = [];
    lines.forEach((line, index) => {
      if (index >= minimumIndex && lineMatchesSourceAnchor(line, anchor, rawAnchor, false).ok) {
        exact.push(index);
      }
    });
    if (exact.length === 1) {
      return {ok: true, index: exact[0], count: 1, matchKind: 'exact'};
    }
    if (exact.length > 1 || rawAnchor) {
      return {
        ok: false,
        code: exact.length ? ambiguousCode : missingCode,
        count: exact.length,
        message: 'Expected exactly one section ' + label + ' anchor match, found ' + exact.length + '.'
      };
    }
    const trimMatches = [];
    lines.forEach((line, index) => {
      if (index >= minimumIndex && line.trim() === String(anchor || '').trim()) {
        trimMatches.push(index);
      }
    });
    if (trimMatches.length === 1) {
      return {ok: true, index: trimMatches[0], count: 1, matchKind: 'trim_equivalent'};
    }
    return {
      ok: false,
      code: trimMatches.length ? ambiguousCode : missingCode,
      count: trimMatches.length,
      message: 'Expected exactly one section ' + label + ' anchor match, found ' + trimMatches.length + '.'
    };
  }

  function resolveShiftedSectionAnchorLine(lines, originalText, lineIndex, anchor, rawAnchor, minimumIndex, kind) {
    const originalLines = splitLogicalLines(originalText || '').lines;
    const originalLine = originalLines[lineIndex];
    const originalMatch = lineMatchesSourceAnchor(originalLine, anchor, rawAnchor, true);
    if (!originalMatch.ok) {
      return {ok: false};
    }
    const exactOriginalLineMatches = [];
    lines.forEach((line, index) => {
      if (index >= minimumIndex && line === originalLine) {
        exactOriginalLineMatches.push(index);
      }
    });
    if (exactOriginalLineMatches.length === 1) {
      return {ok: true, index: exactOriginalLineMatches[0], count: 1, matchKind: 'shifted_' + originalMatch.kind};
    }
    if (exactOriginalLineMatches.length > 1) {
      return shiftedSectionAnchorFailure(kind, true);
    }
    const anchorMatches = [];
    lines.forEach((line, index) => {
      if (index >= minimumIndex && lineMatchesSourceAnchor(line, anchor, rawAnchor, true).ok) {
        anchorMatches.push(index);
      }
    });
    if (anchorMatches.length === 1) {
      return {ok: true, index: anchorMatches[0], count: 1, matchKind: 'shifted_anchor'};
    }
    return shiftedSectionAnchorFailure(kind, anchorMatches.length > 0);
  }

  function shiftedSectionAnchorFailure(kind, ambiguous) {
    const label = kind === 'end' ? 'end' : 'start';
    return {
      ok: false,
      code: kind === 'end' ? 'install_plan.section_end_line_mismatch' : 'install_plan.section_start_line_mismatch',
      count: ambiguous ? 2 : 0,
      message: ambiguous
        ? 'Section ' + label + ' line evidence matched the original source, but the shifted anchor is ambiguous after earlier same-file operations.'
        : 'Section ' + label + ' line evidence matched the original source, but the anchor no longer exists after earlier same-file operations.'
    };
  }

  function isShiftedSectionMatch(matchKind) {
    return String(matchKind || '').indexOf('shifted_') === 0;
  }

  function lineMatchesSourceAnchor(line, anchor, rawAnchor, allowTrimEquivalent) {
    if (line === undefined || line === null) {
      return {ok: false};
    }
    if (rawAnchor) {
      return line === rawAnchor ? {ok: true, kind: 'raw_exact'} : {ok: false};
    }
    if (line === anchor) {
      return {ok: true, kind: 'exact'};
    }
    if (allowTrimEquivalent && line.trim() === String(anchor || '').trim()) {
      return {ok: true, kind: 'trim_equivalent'};
    }
    return {ok: false};
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
    if (/^(?:title|new-page|on-arrival|on-departure|tags|view-if|choose-if|go-to|set-root)\s*:/i.test(text)) {
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
        /^(?:title|new-page|on-arrival|on-departure|tags|view-if|choose-if|go-to|set-root)\s*:/i.test(trimmed);
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

  function installOperationContractsApi() {
    if (global && global.ProjectMapInstallOperationContracts) {
      return global.ProjectMapInstallOperationContracts;
    }
    if (typeof require === 'function') {
      try {
        return require('./install_operation_contracts.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function existingSceneLineCoalescerApi() {
    if (global && global.ProjectMapExistingSceneLineCoalescer) {
      return global.ProjectMapExistingSceneLineCoalescer;
    }
    if (typeof require === 'function') {
      try {
        return require('./existing_scene_line_coalescer.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
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
    operationReason,
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
