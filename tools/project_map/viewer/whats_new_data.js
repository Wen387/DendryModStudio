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
  const DATA = {
    latest: '0.98.1',
    releases: [
      {
        version: '0.98.1',
        items: [
          {
            icon: 'map',
            titleKey: 'home.whatsnew.v0981.home.title',
            bodyKey: 'home.whatsnew.v0981.home.body'
          },
          {
            icon: 'spark',
            titleKey: 'home.whatsnew.v0981.overview.title',
            bodyKey: 'home.whatsnew.v0981.overview.body'
          },
          {
            icon: 'book',
            titleKey: 'home.whatsnew.v0981.sections.title',
            bodyKey: 'home.whatsnew.v0981.sections.body'
          }
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
