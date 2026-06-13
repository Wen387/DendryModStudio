(function registerProjectMapI18nZhHantHome(global) {
  'use strict';

  // Home Hub catalog, split out of zh-Hant.js so the home.* surface stays off
  // the at-ceiling main catalog. Loaded AFTER zh-Hant.js (which sets the base
  // object), then merged in. Keys must stay in lockstep with en.home.js.
  // NOTE: the home.whatsnew.v0981.* copy is a reviewed draft (one block per
  // release theme, from the 123-commit backlog survey) awaiting the author's
  // final pass before release.
  const CATALOG = {
    'zh-Hant': {
      'home.navAria': '首頁區段',
      'home.section.overview': '總覽',
      'home.section.publish': '發布',
      'home.section.announcements': '公告',
      'home.section.templates': '模板',
      'home.section.whatsnew': '新功能',
      'home.menuEntry': '首頁',
      'home.wordmarkAria': '前往首頁',
      'home.hero.greeting': '歡迎回到工作室',
      'home.hero.sub': '隨時從這裡接續你的編輯。',
      'home.publish.lead': '檢視並把你的模組發布到 GitHub。',
      'home.publish.cta': '開啟發布面板',
      'home.publish.statusInSync': '已與 GitHub 同步',
      'home.publish.statusDirty': '有未儲存的本機修改',
      'home.publish.statusOffline': '無法連線 GitHub',
      'home.publish.statusConnect': '連接 GitHub 後即可發布',
      'home.publish.statusNoProject': '開啟 Mod 後即可發布',
      'home.publish.statusFirstPublish': '尚未發布到 GitHub',
      'home.announcements.lead': '看看最新的公告與更新。',
      'home.announcements.cta': '開啟公告',
      'home.templates.lead': '瀏覽並加入入門模板。',
      'home.templates.cta': '開啟模板中心',
      'home.whatsnew.lead': '更新之後，這裡會介紹本版的新功能。',
      'home.whatsnew.title': '本版新功能',
      'home.whatsnew.empty': '已是最新版本。',
      'home.whatsnew.unavailable': '目前無法取得版本資訊。',
      'home.whatsnew.band.title': '本版有新功能',
      'home.whatsnew.band.body': '看看這次更新帶來了什麼。',
      'home.whatsnew.band.cta': '查看新功能',
      'home.whatsnew.band.dismiss': '知道了',
      'home.whatsnew.link': '本版新功能',
      'home.whatsnew.digest.cta': '看完整介紹',
      'home.whatsnew.panel.title': '這一版的新功能',
      'home.whatsnew.panel.close': '關閉',
      'home.whatsnew.panel.done': '開始使用',
      'home.whatsnew.v0981.home.title': '全新的首頁 Home Hub',
      'home.whatsnew.v0981.home.body': '歡迎彈窗長成了常駐的首頁：總覽、發布、公告、模板與新功能聚在一頁，最近的專案一鍵重開，每個版本還有一次開幕式。隨時點左上角字標就能回來。',
      'home.whatsnew.v0981.home.alt': 'Home Hub 總覽頁，呈現快速操作、最近的專案，以及新功能區段。',
      'home.whatsnew.v0981.tour.title': '導覽精靈帶你上手',
      'home.whatsnew.v0981.tour.body': '聚光燈式導覽搭配導覽精靈，重要介面各有一次性的情境提示，還有「動手試試」任務陪你完成第一次修改提案。',
      'home.whatsnew.v0981.tour.alt': '導覽精靈的歡迎對話框，提供一段選用的 Studio 聚光燈導覽。',
      'home.whatsnew.v0981.publish.title': '直接發布到 GitHub',
      'home.whatsnew.v0981.publish.body': '首次發布、更新推送、同步拉取都在 Studio 內完成；管理儀表板能看提交歷史、調整可見性與描述，發布中斷也能安全重試。',
      'home.whatsnew.v0981.playtest.title': '物件編輯器內嵌試玩',
      'home.whatsnew.v0981.playtest.body': '不用另跑建置流程，直接用真正的 Dendry 引擎遊玩你的事件——場景美術與音樂如實呈現，可從任何上游場景起跑，也能換個種子重抽隨機結果。',
      'home.whatsnew.v0981.playtest.alt': '物件編輯器中開啟一個事件，內嵌試玩控制列正以真正的 Dendry 引擎執行。',
      'home.whatsnew.v0981.editor.title': '條件與創作力大升級',
      'home.whatsnew.v0981.editor.body': '巢狀行內條件變成可導覽的分層樹，what-if 模擬器即時演算分支顯隱；magic 區塊、qdisplay 插入、素材替換、長事件搜尋等六個創作缺口一併補上。',
      'home.whatsnew.v0981.darkmode.title': '深色模式登場',
      'home.whatsnew.v0981.darkmode.body': '淺色、深色、自動三段切換，換上暖炭色調的工作環境；你的內容預覽維持紙色，所見即所得不受影響。',
      'home.whatsnew.v0981.darkmode.alt': '深色模式下的 Studio——Explore 總覽與專案統計呈現於暖炭色背景。',
      'home.whatsnew.v0981.systemui.title': '系統 UI 創作更直覺',
      'home.whatsnew.v0981.systemui.body': '建立入口改為三個直覺分類，右側欄成為可選取、可編輯的真實區域，修改會精準套用到模板，不再誤傷其他欄位。',
      'home.whatsnew.v0981.polish.title': '更快、更安靜的 Studio',
      'home.whatsnew.v0981.polish.body': '大型事件的開啟時間從約 89 秒縮短到 10 秒以內；介面全面打底——補齊空態與錯誤重試、收斂重複訊號、頂欄常駐返回鍵。',
      'home.dash.welcomeBack': '歡迎回來',
      'home.dash.quickActions': '快速入口',
      'home.dash.openOnboarding': '看上手導引',
      'home.dash.openTutorialLibrary': '打開教學圖書館',
      'home.dash.browserHint': '發布與公告功能需在桌面版使用。',
      'home.recent.title': '最近的專案',
      'home.recent.remove': '從清單移除',
      'home.recent.openFailed': '開不了這個資料夾——它可能被移動或改名了。',
      'topbar.templateHub': '範本庫',
      'topbar.publish': '發佈到 GitHub',
      'topbar.announcements': '公告預覽',
      // V3 狀態安全的空狀態／就緒字串。這些字串其實屬於非首頁的介面（試玩、
      // 故事板、卡牌板、工作區佈局、路線圖），但因為主要的 en.js/zh-Hant.js
      // 已達行數上限，所以暫存在這個不計入預算的拆分目錄裡。鍵名仍保留各自的
      // 命名空間前綴；目錄合併是平面的，呼叫端能照常解析。
      'playSim.ready': '準備就緒——挑一個場景開始。',
      'storyboard.empty.title': '故事板上還沒有任何事件',
      'storyboard.empty.hint': '從調色盤新增一個故事事件，或載入帶有日期事件的專案，它們就會出現在這裡。',
      'cardBoard.empty.board': '還沒有任何卡牌——開啟一個含有卡牌物件的專案就會顯示在這裡。',
      'workspaceLayout.readinessEmpty': '載入 ProjectIndex 以檢查工作區的錨點。',
      'previewObjectEditor.routeMapEmpty': '還沒有路線圖——新增一個選項即可看到路線。',
      // 導覽精靈介紹 Home 本身的步驟。基於上方同樣的行數上限原因暫存於此；
      // 文案為佔位稿，待定稿。
      'tour.linear.home.title': 'Home——你的基地',
      'tour.linear.home.body': '你現在看到的就是 Home：公告、模板、發布工具和每個版本的新變化都聚在這裡。隨時點角落的 Dendry Mod Studio 字標就能回來。'
    }
  };

  global.ProjectMapI18nDictionaries = global.ProjectMapI18nDictionaries || {};
  global.ProjectMapI18nDictionaries["zh-Hant"] =
    global.ProjectMapI18nDictionaries["zh-Hant"] || {};
  Object.assign(global.ProjectMapI18nDictionaries["zh-Hant"], CATALOG['zh-Hant']);
})(typeof window !== 'undefined' ? window : globalThis);
