(function registerProjectMapI18nZhHantRuntimeLens(global) {
  'use strict';

  // Runtime Lens catalog, split out of zh-Hant.js so the large
  // runtimeLens.* surface stays off the at-ceiling main catalog. Loaded AFTER
  // zh-Hant.js (which sets the base object), then merged in.
  const CATALOG = {
    'zh-Hant': {
      'runtimeLens.eyebrow': '實機觀察窗',
      'runtimeLens.title': '聚焦實機',
      'runtimeLens.create': '建立觀察窗',
      'runtimeLens.createQuick': '快速觀察',
      'runtimeLens.refresh': '刷新',
      'runtimeLens.refreshQuick': '快速刷新',
      'runtimeLens.rebuild': '重建',
      'runtimeLens.rebuildFull': '完整建置',
      'runtimeLens.quickHint': '快速觀察會重用上一次產生的建置，不包含尚未建置的編輯；要套用這次編輯請改用完整建置。',
      'runtimeLens.fullHint': '完整建置會重建一個套用了這次編輯的暫存實機，再聚焦它。',
      'runtimeLens.quickModeNote': '目前顯示的是上一次產生的建置，未包含尚未建置的編輯；要套用這次編輯請改用完整建置。',
      'runtimeLens.quickFallbackFull': '找不到可重用的建置，已改用暫時的完整建置。',
      'runtimeLens.reset': '重置',
      'runtimeLens.collapse': '折疊',
      'runtimeLens.restore': '恢復',
      'runtimeLens.expand': '展開',
      'runtimeLens.dock': '收回',
      'runtimeLens.openExternal': '開啟',
      'runtimeLens.clear': '清除',
      'runtimeLens.focus': '焦點',
      'runtimeLens.target': '目標',
      'runtimeLens.frameTitle': '聚焦實機預覽',
      'runtimeLens.evidence': '實機證據',
      'runtimeLens.proof.deckPool': '牌組驗證',
      'runtimeLens.proof.advisorController': '顧問驗證',
      'runtimeLens.timings': '耗時',
      'runtimeLens.health': '實機健康狀態',
      'runtimeLens.domMap': 'DOM 來源映射',
      'runtimeLens.visualSurface': '可編輯視覺表面',
      'runtimeLens.openRoute': '打開路徑',
      'runtimeLens.createAssetDraft': '建立資產草稿',
      'runtimeLens.manualReview': '需要人工審閱',
      'runtimeLens.visualSurfaceOpened': '已打開實機視覺表面的編輯路徑；套用任何變更前請先審閱。',
      'runtimeLens.visualSurfaceOpenFailed': '無法打開實機視覺表面的編輯路徑；請保留為人工審閱。',
      'runtimeLens.visualAssetDraftOpened': '已打開實機資產引用草稿；套用任何變更前請先審閱。',
      'runtimeLens.visualAssetDraftOpenFailed': '無法建立實機資產引用草稿；請保留為人工審閱。',
      'runtimeLens.browserOnly': '聚焦實機觀察窗需要打開暫存實機沙盒，因此只在桌面版可用。',
      'runtimeLens.browserOnlyShort': '需要桌面版。',
      'runtimeLens.unsupportedFocus': '請選中有來源依據的對象或 UI 區域，再在實機觀察窗中聚焦。',
      'runtimeLens.stale': '觀察窗仍顯示上一個選擇；刷新後會圍繞目前對象重建。',
      'runtimeLens.draftStale': '觀察窗落後於目前編輯；刷新或重建後會顯示最新草稿。',
      'runtimeLens.idle': '可以打開快速聚焦實機觀察窗。',
      'runtimeLens.building': '正在打開暫存實機觀察窗...',
      'runtimeLens.ready': '觀察窗已就緒。',
      'runtimeLens.partial': '觀察窗已載入，但實機快照有警告。',
      'runtimeLens.blocked': '生成的實機檔案不完整，因此無法建立觀察窗。',
      'runtimeLens.suspended': '觀察窗已在背景暫停；刷新後會重新載入。',
      'runtimeLens.failed': '無法建立觀察窗。',
      'runtimeLens.snapshotFailed': '實機快照無法驗證已載入的遊戲頁面。',
      'runtimeLens.empty': '打開快速觀察窗後，可在最近產生的實機預覽中觀察這個對象。',
      'runtimeLens.noFocus': '請先選中有來源依據的對象或 UI 區域，再建立觀察窗。',
      'runtimeLens.status.ready': '聚焦實機觀察窗已就緒。',
      'runtimeLens.status.failed': '無法建立聚焦實機觀察窗。',
      'runtimeLens.status.reset': '已要求重置觀察窗中的預覽狀態。',
      'runtimeLens.status.queued': '觀察窗會在目前建置完成後再次重建。',
    }
  };

  global.ProjectMapI18nDictionaries = global.ProjectMapI18nDictionaries || {};
  global.ProjectMapI18nDictionaries["zh-Hant"] =
    global.ProjectMapI18nDictionaries["zh-Hant"] || {};
  Object.assign(global.ProjectMapI18nDictionaries["zh-Hant"], CATALOG['zh-Hant']);
})(typeof window !== 'undefined' ? window : globalThis);
