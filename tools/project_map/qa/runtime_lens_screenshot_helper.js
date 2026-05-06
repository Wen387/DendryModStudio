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

  async function runCardBoardScenario(ctx, variant) {
    const value = ctx || {};
    const win = value.frame.contentWindow;
    const mode = String(variant || 'card');
    installFakeDesktop(win, {
      title: mode === 'advisor' ? 'Advisor Runtime Lens' : mode === 'option' ? 'Card Option Runtime Lens' : 'Card Runtime Lens',
      body: 'Runtime-rendered card scene wrapper for the selected Card Board object.'
    });
    value.seedCustomIndex(win, value.cardBoardFixtureIndex());
    await value.openTemplate('card', {}, mode === 'advisor' ? 'Card Board advisor Runtime Lens' : mode === 'option' ? 'Card Board option Runtime Lens' : 'Card Board card Runtime Lens');
    if (mode === 'advisor') {
      value.click(win, '[data-card-board-card="advisor:advisor_card"]');
    } else {
      value.click(win, '[data-card-board-card="card:policy_card"]');
      if (mode === 'option') {
        await value.waitFor(() => win.document.querySelector('[data-card-board-card="card:policy_card"] [data-card-board-option]'), 3000);
        value.click(win, '[data-card-board-card="card:policy_card"] [data-card-board-option]');
      }
    }
    await value.waitFor(() => win.document.querySelector('[data-runtime-lens-action="create"]:not([disabled])'), 4000);
    value.click(win, '[data-runtime-lens-action="create"]');
    await value.waitFor(() => {
      const panel = win.document.querySelector('[data-runtime-lens-panel]');
      const frame = win.document.querySelector('[data-runtime-lens-frame]');
      return panel && panel.dataset.runtimeLensStatus === 'ready' && frame && value.isVisible(win, frame);
    }, 4000);
    win.document.querySelector('[data-runtime-lens-panel]').scrollIntoView({block: 'center', inline: 'nearest'});
    await value.delay(180);
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

  global.DMSRuntimeLensScreenshotHelper = {installFakeDesktop, runCardBoardScenario};
})(typeof window !== 'undefined' ? window : globalThis);
