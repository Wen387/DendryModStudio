(function initProjectMapWhatsNewData(global) {
  'use strict';

  // What's New release data — bundled with the build. `latest` is the version
  // this release's What's New describes; it IS the runtime's notion of the
  // current build for the version-compare trigger (no package.json read, no
  // desktop bridge), so the release band fires identically in the browser and
  // the desktop app and stays decoupled from the remote update-check banner.
  //
  // Each release lists its feature items by i18n key (the copy lives in the
  // off-budget home catalogs en.home.js / zh-Hant.home.js) plus a
  // ProjectMapIcons glyph name. To ship a new release's What's New: bump
  // `latest` and PREPEND a { version, items } entry (newest first). If you do
  // not author an entry, `latest` stays put and nothing fires — there is simply
  // nothing to announce.
  //
  // An item may also carry an optional screenshot for the reading panel
  // (whats_new_panel.js): `image` is a viewer-relative path (convention:
  // assets/whatsnew/<version>/<name>.png — the whole viewer dir ships with the
  // desktop build, so images ride along) and `imageAltKey` is the i18n key for
  // its alt text. Items without `image` render as text-only blocks; the Home
  // digest never shows images either way.
  // The 0.98.5 introduction covers everything since the last public push (the
  // 123-commit backlog), one block per theme, ordered by user impact. Copy is
  // a reviewed draft awaiting the author's final pass; screenshots go in via
  // the optional image/imageAltKey fields described above.
  const DATA = {
    latest: '0.98.5',
    releases: [
      {
        version: '0.98.5',
        items: [
          {icon: 'map', titleKey: 'home.whatsnew.v0981.home.title', bodyKey: 'home.whatsnew.v0981.home.body', image: 'assets/whatsnew/0.98.5/home-hub.png', imageAltKey: 'home.whatsnew.v0981.home.alt'},
          {icon: 'book', titleKey: 'home.whatsnew.v0981.tour.title', bodyKey: 'home.whatsnew.v0981.tour.body', image: 'assets/whatsnew/0.98.5/tour-fairy.png', imageAltKey: 'home.whatsnew.v0981.tour.alt'},
          {icon: 'save', titleKey: 'home.whatsnew.v0981.publish.title', bodyKey: 'home.whatsnew.v0981.publish.body'},
          {icon: 'play', titleKey: 'home.whatsnew.v0981.playtest.title', bodyKey: 'home.whatsnew.v0981.playtest.body', image: 'assets/whatsnew/0.98.5/playtest.png', imageAltKey: 'home.whatsnew.v0981.playtest.alt'},
          {icon: 'edit', titleKey: 'home.whatsnew.v0981.editor.title', bodyKey: 'home.whatsnew.v0981.editor.body'},
          {icon: 'settings', titleKey: 'home.whatsnew.v0981.darkmode.title', bodyKey: 'home.whatsnew.v0981.darkmode.body', image: 'assets/whatsnew/0.98.5/dark-mode.png', imageAltKey: 'home.whatsnew.v0981.darkmode.alt'},
          {icon: 'text', titleKey: 'home.whatsnew.v0981.systemui.title', bodyKey: 'home.whatsnew.v0981.systemui.body'},
          {icon: 'spark', titleKey: 'home.whatsnew.v0981.polish.title', bodyKey: 'home.whatsnew.v0981.polish.body'}
        ]
      }
    ]
  };

  function latestRelease() {
    return DATA.releases && DATA.releases.length ? DATA.releases[0] : null;
  }

  function releaseFor(version) {
    if (!version || !DATA.releases) {
      return null;
    }
    return DATA.releases.find((release) => release.version === version) || null;
  }

  const api = {
    latest: () => DATA.latest,
    latestRelease,
    releaseFor,
    releases: () => (DATA.releases ? DATA.releases.slice() : [])
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapWhatsNewData = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
