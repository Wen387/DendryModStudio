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
    const operations = ensureArray(draft.changes).map((change, index) => existingSceneChangeOperation(change, index))
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
        content: after.endsWith('\n') ? after : after + '\n',
        dedupeSearch: value.dedupeSearch || after.trim(),
        startLine: value.startLine || line,
        endLine: value.endLine || endLine,
        safety: 'guarded_apply',
        role: 'existing_scene.section_text',
        description: 'Replace existing ' + label + ' section text after confirming exact source anchors still match.'
      };
    }
    if (value.operationType !== 'manual_snippet' && existingSceneSectionCanAdvanced(value, path, line, endLine, after)) {
      return {
        id,
        type: 'replace_section',
        path,
        anchorText: value.anchorText || source.anchorText,
        endAnchorText: value.endAnchorText || source.endAnchorText,
        content: after.endsWith('\n') ? after : after + '\n',
        dedupeSearch: value.dedupeSearch || after.trim(),
        startLine: value.startLine || line,
        endLine: value.endLine || endLine,
        safety: 'advanced_apply',
        role: 'existing_scene.section_text',
        description: 'Replace existing ' + label + ' section text through an advanced source-backed operation.'
      };
    }
    if (!advancedRequested && value.operationType !== 'manual_snippet' && existingSceneChangeCanGuard(path, line, source.endLine || source.line || source.startLine, before, after)) {
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
    if (value.operationType !== 'manual_snippet' && existingSceneChangeCanAdvanced(path, line, source.endLine || source.line || source.startLine, before, after)) {
      return {
        id,
        type: 'replace_text',
        path,
        line,
        search: before,
        replace: after,
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

  function existingSceneAdvancedRequested(change) {
    const value = isObject(change) ? change : {};
    const editability = String(value.editability || '');
    return editability === 'advanced_source_patch' || editability === 'advanced_apply';
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

  function existingSceneChangeCanAdvanced(path, line, endLine, before, after) {
    const rel = String(path || '').replace(/\\/g, '/');
    const sourceLine = Number(line || 0);
    const sourceEndLine = Number(endLine || sourceLine || 0);
    return Boolean(
      rel.startsWith('source/scenes/') &&
      rel.endsWith('.scene.dry') &&
      Number.isInteger(sourceLine) &&
      sourceLine > 0 &&
      (!Number.isInteger(sourceEndLine) || sourceEndLine <= 0 || sourceEndLine === sourceLine) &&
      String(before || '').trim() &&
      String(after || '').trim()
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
      String(after || '').trim()
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
    const operations = ensureArray(plan.operations).map(normalizeOperation);
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

    operations.forEach((operation) => {
      if (!APPLY_STATUSES.has(operation.safety)) {
        results.push(withOperationEvidence(
          {id: operation.id, type: operation.type, path: operation.path, status: 'manual_review'},
          includeEvidence,
          operation,
          manualOperationEvidence(operation, 'manual_review', 'This operation requires manual review before source changes.')
        ));
        return;
      }
      if (operation.safety === 'advanced_apply' && !allowAdvanced) {
        results.push(withOperationEvidence(
          {id: operation.id, type: operation.type, path: operation.path, status: 'advanced_review'},
          includeEvidence,
          operation,
          manualOperationEvidence(operation, 'advanced_review', 'This operation needs explicit advanced opt-in.')
        ));
        return;
      }
      const target = resolveSafeTarget(projectRoot, operation.path, path);
      if (!target.ok) {
        diagnostics.push(diagnostic('error', 'install_plan.unsafe_path', target.message, operation));
        results.push(withOperationEvidence(
          {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
          includeEvidence,
          operation,
          failedOperationEvidence(operation, 'unsafe_path', target.message)
        ));
        return;
      }
      const permission = operationPermission(operation, target.relative, operation.safety);
      if (!permission.ok) {
        diagnostics.push(diagnostic('error', 'install_plan.unsafe_path', permission.message, operation));
        results.push(withOperationEvidence(
          {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
          includeEvidence,
          operation,
          failedOperationEvidence(operation, 'refused', permission.message)
        ));
        return;
      }
      if (operation.type === 'create_file') {
        results.push(applyCreateFile(fs, path, node.crypto, target.path, operation, dryRun, diagnostics, includeEvidence));
        return;
      }
      if (operation.type === 'replace_text') {
        results.push(applyReplaceText(fs, node.crypto, target.path, operation, dryRun, diagnostics, includeEvidence));
        return;
      }
      if (operation.type === 'insert_text') {
        results.push(applyInsertText(fs, node.crypto, target.path, operation, dryRun, diagnostics, includeEvidence));
        return;
      }
      if (operation.type === 'replace_section') {
        results.push(applyReplaceSection(fs, node.crypto, target.path, operation, dryRun, diagnostics, includeEvidence));
        return;
      }
      if (operation.type === 'copy_asset_file') {
        results.push(applyCopyAssetFile(fs, path, node.crypto, target.path, operation, dryRun, diagnostics, includeEvidence));
        return;
      }
      diagnostics.push(diagnostic('error', 'install_plan.unsupported_operation', 'Unsupported safe operation: ' + operation.type, operation));
      results.push(withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        includeEvidence,
        operation,
        failedOperationEvidence(operation, 'unsupported_operation', 'Unsupported safe operation: ' + operation.type)
      ));
    });

    return finalizeApplyResult({
      ok: diagnostics.every((item) => item.severity !== 'error'),
      dryRun,
      allowAdvanced,
      operationSummary: summary,
      results,
      diagnostics
    }, includeEvidence);
  }

  function finalizeApplyResult(result, includeEvidence) {
    if (!includeEvidence) {
      return result;
    }
    const rows = ensureArray(result.results);
    const verifiedDiff = rows
      .map((row) => row && row.evidence && row.evidence.diff ? row.evidence.diff : '')
      .filter(Boolean)
      .join('\n');
    return Object.assign({}, result, {
      verifiedDiff,
      changedFiles: rows.map(changedFileForResult).filter(Boolean)
    });
  }

  function changedFileForResult(result) {
    if (!result || !result.path) {
      return null;
    }
    const evidence = result.evidence || {};
    return {
      operationId: result.id || '',
      type: result.type || '',
      path: result.path || '',
      status: result.status || '',
      evidenceStatus: evidence.status || '',
      match: evidence.match || '',
      line: evidence.line || null,
      startLine: evidence.startLine || null,
      endLine: evidence.endLine || null
    };
  }

  function withOperationEvidence(result, includeEvidence, operation, evidence) {
    if (!includeEvidence) {
      return result;
    }
    return Object.assign({}, result, {
      evidence: normalizeEvidence(Object.assign({
        operationId: operation && operation.id || '',
        type: operation && operation.type || '',
        path: operation && operation.path || ''
      }, evidence || {}))
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
      if (safety === 'advanced_apply' && operation.type === 'replace_text' && operation.line) {
        return {ok: true, message: 'Advanced project metadata replacement is allowed with exact line evidence.'};
      }
      if (
        safety === 'advanced_apply' &&
        operation.type === 'replace_section' &&
        operation.anchorText &&
        operation.endAnchorText &&
        operation.content &&
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
        operation.content &&
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

  function normalizeEvidence(evidence) {
    const value = isObject(evidence) ? evidence : {};
    const normalized = {
      operationId: String(value.operationId || ''),
      type: String(value.type || ''),
      path: String(value.path || ''),
      status: String(value.status || ''),
      match: String(value.match || ''),
      message: String(value.message || ''),
      line: numberOrNull(value.line),
      startLine: numberOrNull(value.startLine),
      endLine: numberOrNull(value.endLine),
      beforeSnippet: truncateEvidence(value.beforeSnippet),
      afterSnippet: truncateEvidence(value.afterSnippet),
      beforeHash: String(value.beforeHash || ''),
      afterHash: String(value.afterHash || ''),
      sourceHash: String(value.sourceHash || ''),
      targetHash: String(value.targetHash || ''),
      diff: String(value.diff || '')
    };
    Object.keys(normalized).forEach((key) => {
      if (normalized[key] === '' || normalized[key] === null) {
        delete normalized[key];
      }
    });
    return normalized;
  }

  function textOperationEvidence(operation, status, beforeText, afterText, details) {
    const info = isObject(details) ? details : {};
    return {
      status,
      match: info.match || status,
      message: info.message || evidenceMessage(status),
      line: info.line || operation.line || null,
      startLine: info.startLine || operation.startLine || null,
      endLine: info.endLine || operation.endLine || null,
      beforeSnippet: info.beforeSnippet !== undefined ? info.beforeSnippet : '',
      afterSnippet: info.afterSnippet !== undefined ? info.afterSnippet : '',
      beforeHash: info.beforeHash || '',
      afterHash: info.afterHash || '',
      diff: info.diff || ''
    };
  }

  function manualOperationEvidence(operation, status, message) {
    return {
      status,
      match: status,
      message,
      beforeSnippet: operation.search || operation.anchorText || '',
      afterSnippet: operation.replace || operation.content || ''
    };
  }

  function failedOperationEvidence(operation, match, message) {
    return {
      status: 'failed',
      match,
      message,
      beforeSnippet: operation.search || operation.anchorText || '',
      afterSnippet: operation.replace || operation.content || ''
    };
  }

  function assetOperationEvidence(operation, status, details) {
    const info = isObject(details) ? details : {};
    return {
      status,
      match: info.match || status,
      message: info.message || evidenceMessage(status),
      sourceHash: info.sourceHash || '',
      targetHash: info.targetHash || '',
      beforeSnippet: operation.sourceName || '',
      afterSnippet: operation.path || '',
      diff: info.diff || ''
    };
  }

  function evidenceMessage(status) {
    if (status === 'would_apply') {
      return 'Dry-run verified this operation against the current file.';
    }
    if (status === 'applied') {
      return 'Applied this operation after verifying the current file.';
    }
    if (status === 'already_applied') {
      return 'The current file already contains this proposed result.';
    }
    if (status === 'manual_review') {
      return 'This operation remains manual review only.';
    }
    if (status === 'advanced_review') {
      return 'This operation needs advanced opt-in before apply.';
    }
    if (status === 'failed') {
      return 'This operation could not be verified against the current file.';
    }
    return status || '';
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

  function truncateEvidence(value) {
    const text = String(value || '');
    if (text.length <= 4000) {
      return text;
    }
    return text.slice(0, 3980).trimEnd() + '\n...';
  }

  function applyCreateFile(fs, path, crypto, target, operation, dryRun, diagnostics, includeEvidence) {
    if (fs.existsSync(target)) {
      const existing = fs.readFileSync(target, 'utf8');
      if (existing === (operation.content || '')) {
        return withOperationEvidence(
          {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied'},
          includeEvidence,
          operation,
          textOperationEvidence(operation, 'already_applied', existing, existing, {
            match: 'target_file_already_matches',
            afterSnippet: operation.content || '',
            afterHash: hashText(crypto, existing)
          })
        );
      }
      diagnostics.push(diagnostic('error', 'install_plan.create_exists', 'Target file already exists with different content: ' + operation.path, operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        includeEvidence,
        operation,
        textOperationEvidence(operation, 'failed', existing, operation.content || '', {
          match: 'target_exists_with_different_content',
          message: 'Target file already exists with different content.',
          beforeSnippet: firstLines(existing, 8),
          afterSnippet: operation.content || '',
          beforeHash: hashText(crypto, existing),
          afterHash: hashText(crypto, operation.content || '')
        })
      );
    }
    if (!dryRun) {
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.writeFileSync(target, operation.content || '', 'utf8');
    }
    const status = dryRun ? 'would_apply' : 'applied';
    return withOperationEvidence(
      {id: operation.id, type: operation.type, path: operation.path, status},
      includeEvidence,
      operation,
      textOperationEvidence(operation, status, '', operation.content || '', {
        match: 'target_file_missing',
        message: dryRun ? 'Dry-run verified that this new file can be created.' : 'Created this new source file.',
        afterSnippet: operation.content || '',
        afterHash: hashText(crypto, operation.content || ''),
        diff: renderVerifiedDiff(operation, '', operation.content || '', {newFile: true})
      })
    );
  }

  function applyReplaceText(fs, crypto, target, operation, dryRun, diagnostics, includeEvidence) {
    if (!fs.existsSync(target)) {
      diagnostics.push(diagnostic('error', 'install_plan.replace_missing_file', 'Target file does not exist: ' + operation.path, operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        includeEvidence,
        operation,
        failedOperationEvidence(operation, 'target_missing', 'Target file does not exist: ' + operation.path)
      );
    }
    const before = fs.readFileSync(target, 'utf8');
    const after = replaceOnce(before, operation);
    if (!after.ok) {
      diagnostics.push(diagnostic('error', after.code, after.message, operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        includeEvidence,
        operation,
        textOperationEvidence(operation, 'failed', before, before, Object.assign({}, after, {
          match: after.code || 'match_failed',
          beforeHash: hashText(crypto, before),
          afterHash: hashText(crypto, before)
        }))
      );
    }
    if (after.alreadyApplied) {
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied'},
        includeEvidence,
        operation,
        textOperationEvidence(operation, 'already_applied', before, after.text || before, Object.assign({}, after, {
          match: 'replacement_already_present',
          beforeHash: hashText(crypto, before),
          afterHash: hashText(crypto, after.text || before)
        }))
      );
    }
    if (!dryRun) {
      fs.writeFileSync(target, after.text, 'utf8');
    }
    const status = dryRun ? 'would_apply' : 'applied';
    return withOperationEvidence(
      {id: operation.id, type: operation.type, path: operation.path, status},
      includeEvidence,
      operation,
      textOperationEvidence(operation, status, before, after.text, Object.assign({}, after, {
        match: 'matched_current_file',
        beforeHash: hashText(crypto, before),
        afterHash: hashText(crypto, after.text),
        diff: renderVerifiedDiff(operation, after.beforeSnippet || operation.search || '', after.afterSnippet || operation.replace || '', after)
      }))
    );
  }

  function applyInsertText(fs, crypto, target, operation, dryRun, diagnostics, includeEvidence) {
    if (!fs.existsSync(target)) {
      diagnostics.push(diagnostic('error', 'install_plan.insert_missing_file', 'Target file does not exist: ' + operation.path, operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        includeEvidence,
        operation,
        failedOperationEvidence(operation, 'target_missing', 'Target file does not exist: ' + operation.path)
      );
    }
    const before = fs.readFileSync(target, 'utf8');
    const inserted = insertAtAnchor(before, operation);
    if (!inserted.ok) {
      diagnostics.push(diagnostic('error', inserted.code, inserted.message, operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        includeEvidence,
        operation,
        textOperationEvidence(operation, 'failed', before, before, Object.assign({}, inserted, {
          match: inserted.code || 'anchor_failed',
          beforeHash: hashText(crypto, before),
          afterHash: hashText(crypto, before)
        }))
      );
    }
    if (inserted.alreadyApplied) {
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied'},
        includeEvidence,
        operation,
        textOperationEvidence(operation, 'already_applied', before, inserted.text || before, Object.assign({}, inserted, {
          match: 'dedupe_already_present',
          beforeHash: hashText(crypto, before),
          afterHash: hashText(crypto, inserted.text || before)
        }))
      );
    }
    if (!dryRun) {
      fs.writeFileSync(target, inserted.text, 'utf8');
    }
    const status = dryRun ? 'would_apply' : 'applied';
    return withOperationEvidence(
      {id: operation.id, type: operation.type, path: operation.path, status},
      includeEvidence,
      operation,
      textOperationEvidence(operation, status, before, inserted.text, Object.assign({}, inserted, {
        match: 'matched_current_anchor',
        beforeHash: hashText(crypto, before),
        afterHash: hashText(crypto, inserted.text),
        diff: renderVerifiedDiff(operation, inserted.beforeSnippet || operation.anchorText || '', inserted.afterSnippet || operation.content || '', inserted)
      }))
    );
  }

  function applyReplaceSection(fs, crypto, target, operation, dryRun, diagnostics, includeEvidence) {
    if (!fs.existsSync(target)) {
      diagnostics.push(diagnostic('error', 'install_plan.section_missing_file', 'Target file does not exist: ' + operation.path, operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        includeEvidence,
        operation,
        failedOperationEvidence(operation, 'target_missing', 'Target file does not exist: ' + operation.path)
      );
    }
    const before = fs.readFileSync(target, 'utf8');
    const section = replaceSection(before, operation);
    if (!section.ok) {
      diagnostics.push(diagnostic('error', section.code, section.message, operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        includeEvidence,
        operation,
        textOperationEvidence(operation, 'failed', before, before, Object.assign({}, section, {
          match: section.code || 'section_failed',
          beforeHash: hashText(crypto, before),
          afterHash: hashText(crypto, before)
        }))
      );
    }
    if (section.alreadyApplied) {
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied'},
        includeEvidence,
        operation,
        textOperationEvidence(operation, 'already_applied', before, section.text || before, Object.assign({}, section, {
          match: 'replacement_section_already_present',
          beforeHash: hashText(crypto, before),
          afterHash: hashText(crypto, section.text || before)
        }))
      );
    }
    if (!dryRun) {
      fs.writeFileSync(target, section.text, 'utf8');
    }
    const status = dryRun ? 'would_apply' : 'applied';
    return withOperationEvidence(
      {id: operation.id, type: operation.type, path: operation.path, status},
      includeEvidence,
      operation,
      textOperationEvidence(operation, status, before, section.text, Object.assign({}, section, {
        match: 'matched_current_section',
        beforeHash: hashText(crypto, before),
        afterHash: hashText(crypto, section.text),
        diff: renderVerifiedDiff(operation, section.beforeSnippet || operation.anchorText || '', section.afterSnippet || operation.content || '', section)
      }))
    );
  }

  function applyCopyAssetFile(fs, path, crypto, target, operation, dryRun, diagnostics, includeEvidence) {
    const sourcePath = String(operation.sourcePath || '').trim();
    if (!sourcePath) {
      diagnostics.push(diagnostic('error', 'install_plan.copy_source_missing', 'Asset copy sourcePath is required for guarded apply.', operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        includeEvidence,
        operation,
        failedOperationEvidence(operation, 'copy_source_missing', 'Asset copy sourcePath is required for guarded apply.')
      );
    }
    if (!path.isAbsolute(sourcePath)) {
      diagnostics.push(diagnostic('error', 'install_plan.copy_source_path', 'Asset copy sourcePath must be an absolute desktop file path.', operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        includeEvidence,
        operation,
        failedOperationEvidence(operation, 'copy_source_path', 'Asset copy sourcePath must be an absolute desktop file path.')
      );
    }
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      diagnostics.push(diagnostic('error', 'install_plan.copy_source_missing', 'Asset copy source file does not exist: ' + sourcePath, operation));
      return withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        includeEvidence,
        operation,
        failedOperationEvidence(operation, 'copy_source_missing', 'Asset copy source file does not exist.')
      );
    }
    const sourceHash = hashFile(fs, crypto, sourcePath);
    if (fs.existsSync(target)) {
      if (!fs.statSync(target).isFile()) {
        diagnostics.push(diagnostic('error', 'install_plan.copy_conflict', 'Asset copy target exists and is not a file: ' + operation.path, operation));
        return withOperationEvidence(
          {id: operation.id, type: operation.type, path: operation.path, status: 'failed', sourceHash},
          includeEvidence,
          operation,
          assetOperationEvidence(operation, 'failed', {
            match: 'target_exists_not_file',
            message: 'Asset copy target exists and is not a file.',
            sourceHash
          })
        );
      }
      const targetHash = hashFile(fs, crypto, target);
      if (sourceHash === targetHash) {
        return withOperationEvidence(
          {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied', sourceHash, targetHash},
          includeEvidence,
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
        includeEvidence,
        operation,
        assetOperationEvidence(operation, 'failed', {
          match: 'target_exists_with_different_bytes',
          message: 'Asset copy target already exists with different bytes.',
          sourceHash,
          targetHash
        })
      );
    }
    if (!dryRun) {
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.copyFileSync(sourcePath, target);
    }
    const status = dryRun ? 'would_apply' : 'applied';
    return withOperationEvidence(
      {id: operation.id, type: operation.type, path: operation.path, status, sourceHash},
      includeEvidence,
      operation,
      assetOperationEvidence(operation, status, {
        match: 'source_file_available',
        message: dryRun ? 'Dry-run verified that this asset can be copied.' : 'Copied this asset into the project.',
        sourceHash,
        diff: renderVerifiedDiff(operation, '', operation.content || ('source: ' + (operation.sourceName || 'asset')), {asset: true})
      })
    );
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

  function containsNormalizedBlock(text, content) {
    const block = normalizeNewlines(content).replace(/\n$/, '');
    return Boolean(block) && normalizeNewlines(text).includes(block);
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

  function replaceOnce(text, operation) {
    const search = operation.search || '';
    if (!search) {
      return {ok: false, code: 'install_plan.replace_empty_search', message: 'Replacement search text is empty.'};
    }
    const replacement = operation.replace || '';
    if (operation.line) {
      const parts = splitLogicalLines(text);
      const lines = parts.lines;
      const index = operation.line - 1;
      if (index >= 0 && index < lines.length && lines[index].includes(search)) {
        const beforeLine = lines[index];
        lines[index] = lines[index].replace(search, replacement);
        return {
          ok: true,
          text: joinLogicalLines(parts),
          line: operation.line,
          beforeSnippet: beforeLine,
          afterSnippet: lines[index]
        };
      }
      if (replacement && index >= 0 && index < lines.length && lines[index].includes(replacement)) {
        return {ok: true, alreadyApplied: true, text, line: operation.line, beforeSnippet: lines[index], afterSnippet: lines[index]};
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
    return {ok: true, text: text.replace(search, replacement), beforeSnippet: search, afterSnippet: replacement};
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
    const parts = splitLogicalLines(text);
    const lines = parts.lines;
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
    const parts = splitLogicalLines(text);
    const lines = parts.lines;
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
      if (starts.length === 0 && containsNormalizedBlock(text, content)) {
        return {ok: true, alreadyApplied: true, text, beforeSnippet: content, afterSnippet: content};
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
    const replacementLines = contentLines(content);
    const beforeSnippet = lines.slice(start, end + 1).join(parts.eol);
    const nextLines = lines.slice(0, start).concat(replacementLines, lines.slice(end + 1));
    return {
      ok: true,
      text: joinLogicalLines(Object.assign({}, parts, {lines: nextLines})),
      startLine: start + 1,
      endLine: end + 1,
      beforeSnippet,
      afterSnippet: content
    };
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
