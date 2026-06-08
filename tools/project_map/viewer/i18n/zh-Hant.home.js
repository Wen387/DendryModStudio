(function registerProjectMapI18nZhHantHome(global) {
  'use strict';

  // Home Hub catalog, split out of zh-Hant.js so the home.* surface stays off
  // the at-ceiling main catalog. Loaded AFTER zh-Hant.js (which sets the base
  // object), then merged in. Keys must stay in lockstep with en.home.js.
  // NOTE: the home.whatsnew.v0981.* feature copy is placeholder release text
  // describing the Home Hub; finalize the prose once Home is feature-complete.
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
      'home.whatsnew.band.title': '本版有新功能',
      'home.whatsnew.band.body': '看看這次更新帶來了什麼。',
      'home.whatsnew.band.cta': '查看新功能',
      'home.whatsnew.band.dismiss': '知道了',
      'home.whatsnew.link': '本版新功能',
      'home.whatsnew.v0981.home.title': '真正的首頁',
      'home.whatsnew.v0981.home.body': '隨時點左上角字標就能回到首頁——獨立於四個工作模式的 Studio 儀表板。',
      'home.whatsnew.v0981.overview.title': '會隨情境變化的總覽',
      'home.whatsnew.v0981.overview.body': '載入專案前是上手導引；開了專案就換成「歡迎回來」的儀表板。',
      'home.whatsnew.v0981.sections.title': '逐步聚合的 Studio 工具',
      'home.whatsnew.v0981.sections.body': '發布、公告、模板與新功能正一個個搬進首頁。',
      'home.dash.welcomeBack': '歡迎回來',
      'home.dash.openOnboarding': '看上手導引',
      'home.dash.openTutorialLibrary': '打開教學圖書館',
      'home.dash.browserHint': '發布與公告功能需在桌面版使用。',
      'topbar.templateHub': '範本庫',
      'topbar.publish': '發佈到 GitHub',
      'topbar.announcements': '公告預覽'
    }
  };

  global.ProjectMapI18nDictionaries = global.ProjectMapI18nDictionaries || {};
  global.ProjectMapI18nDictionaries["zh-Hant"] =
    global.ProjectMapI18nDictionaries["zh-Hant"] || {};
  Object.assign(global.ProjectMapI18nDictionaries["zh-Hant"], CATALOG['zh-Hant']);
})(typeof window !== 'undefined' ? window : globalThis);
