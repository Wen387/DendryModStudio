#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const PROJECT_MAP_DIR = __dirname;
const DESKTOP_DIR = path.join(PROJECT_MAP_DIR, 'desktop');
const VIEWER_DIR = path.join(PROJECT_MAP_DIR, 'viewer');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(read(filePath));
}

async function main() {
  const updateNotice = require(path.join(DESKTOP_DIR, 'update_notice.js'));
  const updateNoticeUi = require(path.join(VIEWER_DIR, 'update_notice_ui.js'));
  const updateNoticeSource = read(path.join(DESKTOP_DIR, 'update_notice.js'));
  const packageJson = readJson(path.join(DESKTOP_DIR, 'package.json'));
  const manifest = readJson(path.join(DESKTOP_DIR, 'update_manifest.json'));
  const html = read(path.join(VIEWER_DIR, 'index.html'));
  const css = read(path.join(VIEWER_DIR, 'styles.css'));
  const i18n = read(path.join(VIEWER_DIR, 'i18n.js'));
  const mainJs = read(path.join(DESKTOP_DIR, 'main.js'));
  const preloadJs = read(path.join(DESKTOP_DIR, 'preload.js'));
  const packageDir = read(path.join(DESKTOP_DIR, 'scripts', 'package_dir.js'));

  assert(typeof updateNotice.checkForUpdate === 'function', 'update_notice should expose checkForUpdate');
  assert(typeof updateNotice.validateManifest === 'function', 'update_notice should expose validateManifest');
  assert(typeof updateNoticeUi.createController === 'function', 'update_notice_ui should expose createController');
  assert(typeof updateNoticeUi.canCheckUpdates === 'function', 'update_notice_ui should expose canCheckUpdates');
  assert(
    packageJson.dendryModStudio &&
    /update_manifest\.json$/.test(packageJson.dendryModStudio.updateManifestUrl || ''),
    'desktop package should configure a static update manifest URL'
  );
  assert(updateNotice.configuredManifestUrl({desktopDir: DESKTOP_DIR}).includes('update_manifest.json'), 'configured manifest URL should resolve from package.json');

  const validation = updateNotice.validateManifest(manifest);
  assert(validation.ok, 'bundled update manifest should validate: ' + validation.diagnostics.join('; '));
  assert(manifest.schemaVersion === 1, 'bundled update manifest should use schemaVersion 1');
  assert(manifest.latestVersion === packageJson.version, 'bundled update manifest should match desktop package version');
  assert(typeof manifest.announcementOnly === 'boolean', 'bundled update manifest should make announcement-only behavior explicit');
  assert(Array.isArray(manifest.notices) && manifest.notices.length >= 2, 'bundled update manifest should expose a notice feed');
  assert(manifest.notices.some((notice) => notice.kind === 'release'), 'bundled update manifest should include update history');
  assert(manifest.notices.some((notice) => notice.kind === 'announcement'), 'bundled update manifest should include general announcements');
  assert(manifest.notices.some((notice) => notice.kind === 'playtest'), 'bundled update manifest should include playtest notices');
  assert(manifest.notices.some((notice) => notice.kind === 'contact'), 'bundled update manifest should include contact actions');
  assert(manifest.titleLocalized && manifest.titleLocalized['zh-Hant'], 'bundled update manifest should include zh-Hant title');
  assert(manifest.bodyLocalized && manifest.bodyLocalized['zh-Hant'], 'bundled update manifest should include zh-Hant body');
  assert(updateNotice.compareVersions('0.9.2', '0.9.3') < 0, 'compareVersions should detect newer patch releases');
  assert(updateNotice.compareVersions('v0.10.0', '0.9.9') > 0, 'compareVersions should handle v-prefixed versions');

  const evaluated = updateNotice.evaluateManifest({
    schemaVersion: 1,
    channel: 'dev-preview',
    latestVersion: '0.9.3',
    minimumRecommendedVersion: '0.9.2',
    severity: 'warning',
    noticeId: 'test-v0.9.3',
    title: 'Update available',
    titleLocalized: {'zh-Hant': '有可用更新'},
    body: 'A newer test build is available.',
    bodyLocalized: {'zh-Hant': '有新的測試版可用。'},
    downloadUrl: 'https://example.com/dendry-mod-studio.tar.gz',
    releaseNotesUrl: 'https://example.com/notes'
  }, {currentVersion: '0.9.2'});
  assert(evaluated.ok, 'valid manifest should evaluate successfully');
  assert(evaluated.updateAvailable, 'newer latestVersion should be an available update');
  assert(evaluated.shouldNotify, 'available update should notify');
  assert(evaluated.severity === 'warning', 'manifest severity should be preserved');
  assert(evaluated.titleLocalized['zh-Hant'] === '有可用更新', 'localized title should be preserved');
  assert(evaluated.bodyLocalized['zh-Hant'] === '有新的測試版可用。', 'localized body should be preserved');

  const announcement = updateNotice.evaluateManifest({
    schemaVersion: 1,
    latestVersion: '0.9.2',
    announcementOnly: true,
    title: 'Service notice',
    body: 'A current-version announcement should still notify.'
  }, {currentVersion: '0.9.2'});
  assert(announcement.ok && announcement.shouldNotify && !announcement.updateAvailable, 'announcementOnly should notify without a newer version');

  const feed = updateNotice.evaluateManifest({
    schemaVersion: 1,
    latestVersion: '0.9.2',
    notices: [
      {
        noticeId: 'feed-playtest',
        kind: 'playtest',
        title: 'Playtest call',
        titleLocalized: {'zh-Hant': '測試邀請'},
        body: 'Try the preview.',
        bodyLocalized: {'zh-Hant': '請試用預覽版。'},
        actionUrl: 'https://example.com/issues',
        actionLabelLocalized: {'zh-Hant': '開啟回饋頁'}
      },
      {
        noticeId: 'feed-tip',
        kind: 'tip',
        notify: false,
        title: 'Tip',
        body: 'Quiet preview item.'
      },
      {
        noticeId: 'feed-contact',
        kind: 'contact',
        title: 'Contact',
        body: 'Open the feedback form.',
        actionUrl: 'https://example.com/contact'
      }
    ]
  }, {currentVersion: '0.9.2'});
  assert(feed.ok && feed.notices.length === 3, 'manifest notices should evaluate as a notice feed');
  assert(feed.shouldNotify && feed.noticeId === 'feed-playtest', 'first notifying feed item should become the banner-compatible notice');
  assert(feed.notices[0].kind === 'playtest' && feed.notices[0].actionUrl.includes('example.com'), 'feed item should preserve kind and action URL');
  assert(feed.notices[1].shouldNotify === false, 'quiet feed items should stay in the preview without banner notification');
  assert(feed.notices[2].kind === 'contact' && feed.notices[2].actionUrl.includes('contact'), 'contact feed items should be accepted');

  const bundledEvaluation = updateNotice.evaluateManifest(manifest, {currentVersion: packageJson.version});
  assert(bundledEvaluation.ok, 'bundled update manifest should evaluate successfully');
  assert(
    !manifest.announcementOnly || (bundledEvaluation.shouldNotify && !bundledEvaluation.updateAvailable),
    'bundled same-version announcement should notify without reporting an update'
  );

  const invalid = updateNotice.validateManifest({
    schemaVersion: 1,
    severity: 'urgent',
    announcementOnly: 'yes',
    titleLocalized: {'zh-Hant': 123},
    downloadUrl: 'file:///tmp/not-allowed'
  });
  assert(!invalid.ok, 'invalid severity and non-http URL should fail validation');

  const disabled = await updateNotice.checkForUpdate({
    desktopDir: DESKTOP_DIR,
    env: {DMS_UPDATE_NOTICE_DISABLED: 'true'}
  });
  assert(disabled.ok && disabled.disabled && !disabled.configured, 'disabled env should skip update checks');

  const emptyDesktopDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-update-notice-empty-desktop-'));
  fs.writeFileSync(path.join(emptyDesktopDir, 'package.json'), JSON.stringify({version: '0.9.2'}, null, 2), 'utf8');
  const unconfigured = await updateNotice.checkForUpdate({
    desktopDir: emptyDesktopDir,
    env: {}
  });
  assert(unconfigured.ok && !unconfigured.configured, 'desktop package without manifest URL should be unconfigured');

  const injectedManifest = Object.assign({}, manifest, {
    latestVersion: '0.9.3',
    noticeId: 'injected-manifest-test'
  });
  const fetched = await updateNotice.checkForUpdate({
    desktopDir: DESKTOP_DIR,
    currentVersion: '0.9.2',
    manifestUrl: 'https://example.com/update_manifest.json',
    manifest: injectedManifest,
    timeoutMs: 2000,
    env: {}
  });
  assert(fetched.ok, 'injected manifest update check should pass: ' + fetched.message);
  assert(fetched.configured, 'injected manifest update check should be configured');
  assert(fetched.updateAvailable, 'injected manifest should report update available');
  assert(fetched.shouldNotify, 'injected manifest should notify');
  assert(fetched.manifestUrl.includes('example.com'), 'manifest URL should be reported');
  assert(updateNoticeSource.includes("'User-Agent': 'DendryModStudioUpdateNotice/1'"), 'manifest request should use stable app user agent');

  const storage = new Map();
  const controller = updateNoticeUi.createController({
    storage: {
      getItem: (key) => storage.get(key),
      setItem: (key, value) => storage.set(key, value)
    }
  });
  assert(updateNoticeUi.noticeKey({noticeId: 'demo-notice'}) === 'demo-notice', 'noticeKey should prefer noticeId');
  assert(!controller.isDismissed({noticeId: 'demo-notice'}), 'notice should start visible');
  assert(controller.dismiss({noticeId: 'demo-notice'}), 'dismiss should persist notice key');
  assert(controller.isDismissed({noticeId: 'demo-notice'}), 'dismissed notice should be hidden next time');
  assert(controller.unreadCount([{noticeId: 'demo-notice', shouldNotify: true}, {noticeId: 'new-notice', shouldNotify: true}]) === 1, 'controller should count unread feed notices');
  assert(controller.dismissAll([{noticeId: 'new-notice'}]), 'controller should mark all feed notices read');
  assert(controller.unreadCount([{noticeId: 'demo-notice', shouldNotify: true}, {noticeId: 'new-notice', shouldNotify: true}]) === 0, 'mark all read should clear unread count');
  assert(updateNoticeUi.canCheckUpdates({dendryDesktop: {checkUpdateNotice: () => null}}), 'viewer should detect desktop update API');
  assert(updateNoticeSource.includes('normalizeManifestNotices'), 'desktop update evaluation should normalize notice feeds');

  [
    'id="update-notice-banner"',
    'id="announcement-board"',
    'id="announcement-board-tabs"',
    'id="announcement-board-detail"',
    'id="studio-open-announcements"',
    'id="studio-check-updates"',
    'data-announcement-category="updates"',
    'data-announcement-category="announcements"',
    'data-announcement-category="testing"',
    'update_notice_ui.js'
  ].forEach((needle) => {
    assert(html.includes(needle), 'viewer HTML missing update notice surface: ' + needle);
  });
  [
    '.update-notice-banner',
    '.announcement-board',
    '.announcement-board-tabs',
    '.announcement-board-tab',
    '.announcement-board-detail',
    '.announcement-card',
    '.update-notice-actions',
    '.update-notice-banner.is-critical'
  ].forEach((needle) => {
    assert(css.includes(needle), 'viewer CSS missing update notice style: ' + needle);
  });
  [
    'topbar.checkUpdates',
    'topbar.announcements',
    'announcementBoard.title',
    'announcementBoard.category.updates',
    'announcementBoard.category.announcements',
    'announcementBoard.category.testing',
    'announcementBoard.openReleaseNotesBrowser',
    'announcementBoard.closeDetails',
    'announcementBoard.kind.contact',
    'updateNotice.viewDetails',
    'updateNotice.download',
    'updateNotice.currentBody'
  ].forEach((key) => {
    assert(i18n.includes("'" + key + "'"), 'i18n missing update notice key ' + key);
  });
  assert(mainJs.includes('dendry:update-notice-check'), 'desktop main should expose update notice check IPC');
  assert(read(path.join(VIEWER_DIR, 'update_notice_ui.js')).includes('localizedNoticeField'), 'viewer should render localized update notice title/body');
  assert(read(path.join(VIEWER_DIR, 'update_notice_ui.js')).includes('categoryForNotice'), 'viewer should group notice preview items by category');
  assert(read(path.join(VIEWER_DIR, 'update_notice_ui.js')).includes('showNoticeDetail'), 'viewer should preview notice details in-app before opening external links');
  assert(mainJs.includes('dendry:open-external-url'), 'desktop main should expose safe external link IPC');
  assert(preloadJs.includes('checkUpdateNotice'), 'preload should expose checkUpdateNotice');
  assert(preloadJs.includes('openExternalUrl'), 'preload should expose openExternalUrl');
  assert(packageDir.includes("'update_notice.js'"), 'package_dir should copy update_notice.js');
  assert(packageDir.includes("'update_manifest.json'"), 'package_dir should copy update_manifest.json');

  process.stdout.write(JSON.stringify({
    ok: true,
    manifestUrl: packageJson.dendryModStudio.updateManifestUrl,
    packageVersion: packageJson.version
  }, null, 2) + '\n');
}

main().catch((err) => fail(err && err.stack ? err.stack : String(err)));
