(function initProtectedPathPolicy(global) {
  'use strict';

  const PROTECTED_ROUTER_SOURCE_PATHS = new Set([
    'source/scenes/root.scene.dry',
    'source/scenes/post_event.scene.dry',
    'source/scenes/post_event_news.scene.dry'
  ]);

  function normalizeRelativePath(value) {
    const raw = String(value || '').replace(/\\/g, '/').replace(/\/+/g, '/');
    const prefix = raw.startsWith('/') ? '/' : '';
    return prefix + raw.split('/').filter((part) => part && part !== '.').join('/');
  }

  function protectedGeneratedOutputReason(relPath) {
    const rel = normalizeRelativePath(relPath);
    if (rel === '.git' || rel.startsWith('.git/')) {
      return 'git';
    }
    if (rel === 'out/game.json' || rel === 'out/html' || rel.startsWith('out/html/')) {
      return 'generated_output';
    }
    return '';
  }

  function isProtectedGeneratedOutputPath(relPath) {
    return Boolean(protectedGeneratedOutputReason(relPath));
  }

  function isProtectedRouterSourcePath(relPath) {
    return PROTECTED_ROUTER_SOURCE_PATHS.has(normalizeRelativePath(relPath));
  }

  const api = {
    normalizeRelativePath,
    isProtectedGeneratedOutputPath,
    protectedGeneratedOutputReason,
    isProtectedRouterSourcePath
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapProtectedPathPolicy = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
