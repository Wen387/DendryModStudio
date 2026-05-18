(function initDmsRuntimeLensScreenshotHelper(global) {
  'use strict';

  function installFakeDesktop(win, options) {
    const opts = options || {};
    const lensHtml = [
      '<!doctype html><html><head><style>',
      'body{margin:0;min-width:1280px;background:#f8f5ed;color:#2d271e;font:18px Georgia,serif}',
      'main{position:relative;min-width:1280px;padding:28px}.title{font-size:26px;letter-spacing:2px;text-align:center}',
      '.card{width:560px;margin-top:22px;border:2px solid #8f7b61;padding:18px;background:white;box-shadow:0 8px 20px rgba(0,0,0,.12)}',
      '.right-edge{position:absolute;right:32px;top:90px;width:260px;border:2px solid #8f7b61;padding:16px;background:#fffaf1;text-align:right}',
      'button{display:block;width:100%;margin-top:18px;padding:12px;border:1px solid #8f7b61;background:#fffaf1;font:inherit}',
      '</style></head><body><main><div class="title">SOCIAL DEMOCRACY: AN ALTERNATE HISTORY</div><section class="card"><strong>' + escapeHtml(opts.title || 'Runtime Lens focus') + '</strong><p>' + escapeHtml(opts.body || 'Runtime-rendered scene wrapper for the selected object.') + '</p><button>Continue</button></section><aside class="right-edge">Right edge reachable</aside></main></body></html>'
    ].join('');
    const url = 'data:text/html;charset=utf-8,' + encodeURIComponent(lensHtml);
    win.dendryDesktop = {
      createRuntimeLens: async (request) => ({
        ok: opts.fail !== true,
        kind: 'runtime_lens_session',
        status: opts.fail === true ? 'failed' : 'ready',
        focus: request && request.focus || {},
        lensUrl: opts.fail === true ? '' : url,
        lensPageUrl: opts.fail === true ? '' : url,
        externalUrl: opts.fail === true ? '' : url,
        diagnostics: opts.fail === true ? [{severity: 'error', code: 'runtime_lens.fixture_failure', message: 'Fixture Runtime Lens failed for this target.'}] : [],
        postLoadCommands: [{type: 'jumpToScene', sceneId: request && request.focus && (request.focus.targetSceneId || request.focus.id) || ''}]
      }),
      openExternalUrl: () => Promise.resolve({ok: true})
    };
  }

  async function runContentScenario(ctx, variant) {
    const value = ctx || {};
    const win = value.frame.contentWindow;
    const mode = String(variant || 'ready');
    if (mode === 'browser') {
      delete win.dendryDesktop;
      await value.openExisting('events', 'generic_intro', {generic_intro_body: 'Browser-only Runtime Lens unavailable state.'}, 'Runtime Lens browser unavailable');
      await value.waitFor(() => {
        const panel = win.document.querySelector('[data-runtime-lens-panel]');
        const button = panel && panel.querySelector('[data-runtime-lens-action="create"]');
        return panel && button && button.disabled;
      }, 4000);
      return;
    }
    installFakeDesktop(win, {
      fail: mode === 'failure',
      title: mode === 'expanded' ? 'Expanded Runtime Lens' : mode === 'stale' ? 'Draft Runtime Lens' : 'Runtime Lens focus',
      body: mode === 'stale' ? 'This lens will be marked stale after an authoring edit.' : 'Runtime-rendered scene wrapper for the selected object.'
    });
    await value.openExisting('events', 'generic_intro', {generic_intro_body: 'Runtime Lens observes this selected scene.'}, mode === 'failure' ? 'Runtime Lens failure state' : 'Focused Runtime Lens');
    value.click(win, '[data-runtime-lens-action="create"]');
    await value.waitFor(() => win.document.querySelector('[data-runtime-lens-panel][data-runtime-lens-status="' + (mode === 'failure' ? 'failed' : 'ready') + '"]'), 4000);
    if (mode === 'expanded') {
      value.click(win, '[data-runtime-lens-action="toggle_expand"]');
      await value.waitFor(() => {
        const panel = win.document.querySelector('[data-runtime-lens-panel].is-expanded');
        const frame = win.document.querySelector('[data-runtime-lens-frame]');
        return panel && frame && value.isVisible(win, panel) && value.isVisible(win, frame);
      }, 4000);
    } else if (mode === 'stale') {
      let field = win.document.querySelector('[data-object-canvas-field]');
      if (!field && value.click) {
        value.click(win, '[data-object-canvas-action="toggle_overlay"]');
        await value.waitFor(() => win.document.querySelector('[data-object-canvas-field]'), 3000);
        field = win.document.querySelector('[data-object-canvas-field]');
      }
      if (!field) {
        throw new Error('Runtime Lens stale scenario could not find an editable object field.');
      }
      field.value = 'Runtime Lens observes this selected scene after an authoring edit.';
      field.dispatchEvent(new win.Event('input', {bubbles: true}));
      await value.waitFor(() => win.document.querySelector('[data-runtime-lens-panel][data-runtime-lens-status="stale"]'), 4000);
    } else if (mode !== 'failure') {
      await value.waitFor(() => {
        const panel = win.document.querySelector('[data-runtime-lens-panel]');
        const frame = win.document.querySelector('[data-runtime-lens-frame]');
        return panel && panel.dataset.runtimeLensStatus === 'ready' && frame && value.isVisible(win, frame);
      }, 4000);
      if (mode === 'ready') {
        const wrap = win.document.querySelector('[data-runtime-lens-frame-wrap]');
        const frame = win.document.querySelector('[data-runtime-lens-frame]');
        await value.waitFor(() => wrap && frame && wrap.scrollWidth > wrap.clientWidth + 24 && frame.getBoundingClientRect().width >= 1200, 4000);
        wrap.scrollLeft = wrap.scrollWidth;
        await new Promise((resolve) => global.setTimeout(resolve, 120));
      }
    }
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

  global.DMSRuntimeLensScreenshotHelper = {installFakeDesktop, runCardBoardScenario, runContentScenario};
})(typeof window !== 'undefined' ? window : globalThis);
