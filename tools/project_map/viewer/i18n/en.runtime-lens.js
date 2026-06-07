(function registerProjectMapI18nEnRuntimeLens(global) {
  'use strict';

  // Runtime Lens catalog, split out of en.js so the large
  // runtimeLens.* surface stays off the at-ceiling main catalog. Loaded AFTER
  // en.js (which sets the base object), then merged in.
  const CATALOG = {
    en: {
      'runtimeLens.eyebrow': 'Runtime Lens',
      'runtimeLens.title': 'Focused runtime',
      'runtimeLens.create': 'Create Lens',
      'runtimeLens.createQuick': 'Quick Lens',
      'runtimeLens.refresh': 'Refresh',
      'runtimeLens.refreshQuick': 'Refresh quick',
      'runtimeLens.rebuild': 'Rebuild',
      'runtimeLens.rebuildFull': 'Full Build',
      'runtimeLens.quickHint': 'Quick Lens reuses the last generated build. It does not include unbuilt edits; use Full Build to apply this change.',
      'runtimeLens.fullHint': 'Full Build rebuilds a temporary runtime that applies this edit, then focuses it.',
      'runtimeLens.quickModeNote': 'Showing the last generated build. Unbuilt edits are not included; use Full Build to apply this change.',
      'runtimeLens.quickFallbackFull': 'No reusable build was found, so a temporary Full Build was used.',
      'runtimeLens.reset': 'Reset',
      'runtimeLens.collapse': 'Collapse',
      'runtimeLens.restore': 'Restore',
      'runtimeLens.expand': 'Expand',
      'runtimeLens.dock': 'Dock',
      'runtimeLens.openExternal': 'Open',
      'runtimeLens.clear': 'Clear',
      'runtimeLens.focus': 'Focus',
      'runtimeLens.target': 'Target',
      'runtimeLens.frameTitle': 'Focused runtime preview',
      'runtimeLens.evidence': 'Runtime evidence',
      'runtimeLens.proof.deckPool': 'Deck proof',
      'runtimeLens.proof.advisorController': 'Advisor proof',
      'runtimeLens.timings': 'Timings',
      'runtimeLens.health': 'Runtime health',
      'runtimeLens.domMap': 'DOM source map',
      'runtimeLens.visualSurface': 'Editable visual surfaces',
      'runtimeLens.openRoute': 'Open route',
      'runtimeLens.createAssetDraft': 'Create asset draft',
      'runtimeLens.manualReview': 'manual review',
      'runtimeLens.visualSurfaceOpened': 'Runtime visual surface route opened. Review before applying any changes.',
      'runtimeLens.visualSurfaceOpenFailed': 'Runtime visual surface route could not be opened; keep this item as manual review.',
      'runtimeLens.visualAssetDraftOpened': 'Runtime asset reference draft opened. Review before applying any changes.',
      'runtimeLens.visualAssetDraftOpenFailed': 'Runtime asset reference draft could not be created; keep this item as manual review.',
      'runtimeLens.browserOnly': 'Focused Runtime Lens is available in the desktop app because it opens a temporary runtime sandbox.',
      'runtimeLens.browserOnlyShort': 'Desktop app required.',
      'runtimeLens.unsupportedFocus': 'Select a source-backed object or UI region to focus it in runtime.',
      'runtimeLens.stale': 'Lens is showing a previous selection. Refresh to rebuild around this object.',
      'runtimeLens.draftStale': 'Lens is behind the current edit. Refresh or rebuild it to observe the latest draft.',
      'runtimeLens.idle': 'Ready to open a quick focused runtime lens.',
      'runtimeLens.building': 'Opening a temporary runtime lens...',
      'runtimeLens.ready': 'Lens is ready.',
      'runtimeLens.partial': 'Lens loaded with runtime snapshot warnings.',
      'runtimeLens.blocked': 'Runtime Lens is blocked by incomplete generated runtime files.',
      'runtimeLens.suspended': 'Lens is suspended while this workspace is in the background. Refresh to reload it.',
      'runtimeLens.failed': 'Lens could not be created.',
      'runtimeLens.snapshotFailed': 'Runtime snapshot could not verify the loaded game page.',
      'runtimeLens.empty': 'Open a Quick Lens to observe this object in the latest generated runtime.',
      'runtimeLens.noFocus': 'Select a source-backed object or UI region before creating a Lens.',
      'runtimeLens.status.ready': 'Focused Runtime Lens is ready.',
      'runtimeLens.status.failed': 'Focused Runtime Lens could not be created.',
      'runtimeLens.status.reset': 'Runtime Lens preview state reset was requested.',
      'runtimeLens.status.queued': 'Runtime Lens will rebuild after the current build finishes.',
    }
  };

  global.ProjectMapI18nDictionaries = global.ProjectMapI18nDictionaries || {};
  global.ProjectMapI18nDictionaries["en"] =
    global.ProjectMapI18nDictionaries["en"] || {};
  Object.assign(global.ProjectMapI18nDictionaries["en"], CATALOG["en"]);
})(typeof window !== 'undefined' ? window : globalThis);
