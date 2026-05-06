(function initDmsRuntimeLensScreenshotHelper(global) {
  'use strict';

  function installFakeDesktop(win, options) {
    const opts = options || {};
    const lensHtml = [
      '<!doctype html><html><head><style>',
      'body{margin:0;background:#f8f5ed;color:#2d271e;font:18px Georgia,serif}',
      'main{padding:28px}.title{font-size:26px;letter-spacing:2px;text-align:center}',
      '.card{margin-top:22px;border:2px solid #8f7b61;padding:18px;background:white;box-shadow:0 8px 20px rgba(0,0,0,.12)}',
      'button{display:block;width:100%;margin-top:18px;padding:12px;border:1px solid #8f7b61;background:#fffaf1;font:inherit}',
      '</style></head><body><main><div class="title">SOCIAL DEMOCRACY: AN ALTERNATE HISTORY</div><section class="card"><strong>' + escapeHtml(opts.title || 'Runtime Lens focus') + '</strong><p>' + escapeHtml(opts.body || 'Runtime-rendered scene wrapper for the selected object.') + '</p><button>Continue</button></section></main></body></html>'
    ].join('');
    const url = 'data:text/html;charset=utf-8,' + encodeURIComponent(lensHtml);
    win.dendryDesktop = {
      createRuntimeLens: async (request) => ({
        ok: true,
        kind: 'runtime_lens_session',
        status: 'ready',
        focus: request && request.focus || {},
        lensUrl: url,
        lensPageUrl: url,
        externalUrl: url,
        diagnostics: [],
        postLoadCommands: [{type: 'jumpToScene', sceneId: request && request.focus && (request.focus.targetSceneId || request.focus.id) || ''}]
      }),
      openExternalUrl: () => Promise.resolve({ok: true})
    };
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  global.DMSRuntimeLensScreenshotHelper = {installFakeDesktop};
})(typeof window !== 'undefined' ? window : globalThis);
