(function initProjectMapPublishUi(global) {
  'use strict';

  const document = global.document;
  if (!document) {
    return;
  }

  function caps() {
    return (global && global.ProjectMapDesktopCapabilities) || null;
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function applyI18n(root) {
    const i18n = global && global.ProjectMapI18n;
    if (i18n && typeof i18n.applyTranslations === 'function') {
      i18n.applyTranslations(root);
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function formatBytes(n) {
    const v = Number(n) || 0;
    if (v < 1024) { return v + ' B'; }
    if (v < 1024 * 1024) { return (v / 1024).toFixed(1) + ' KB'; }
    return (v / 1024 / 1024).toFixed(1) + ' MB';
  }

  let overlay = null;
  let bodyEl = null;
  let opened = false;
  let cachedRoot = '';

  function isAvailable() {
    const c = caps();
    return Boolean(c && typeof c.canPublishMod === 'function' && c.canPublishMod());
  }

  // The desktop bridge resolves getState() through ipcRenderer.invoke, i.e. a
  // Promise — so the project root must be awaited, then cached for the sync
  // callers (projectName / loadPreview / onSubmit).
  async function resolveProjectRoot() {
    const c = caps();
    if (!c || typeof c.getState !== 'function') { return ''; }
    try {
      const state = await Promise.resolve(c.getState());
      return state && state.lastProject && state.lastProject.root ? state.lastProject.root : '';
    } catch (_err) {
      return '';
    }
  }

  function currentProjectRoot() {
    return cachedRoot;
  }

  function projectName() {
    const root = currentProjectRoot();
    if (!root) { return ''; }
    const parts = root.replace(/[\\/]+$/, '').split(/[\\/]/);
    return parts[parts.length - 1] || '';
  }

  function ensureOverlay() {
    if (overlay) { return overlay; }
    const mount = document.getElementById('studio-publish-root') || document.body;
    overlay = document.createElement('div');
    overlay.className = 'publish-overlay hidden';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'publish-title');
    overlay.innerHTML = [
      '<div class="publish-dialog">',
      '  <header class="publish-header">',
      '    <div>',
      '      <p class="publish-eyebrow" data-i18n="publish.eyebrow">Share your mod</p>',
      '      <h2 id="publish-title" data-i18n="publish.title">Publish to GitHub</h2>',
      '    </div>',
      '    <button type="button" class="publish-close" data-publish-close aria-label="Close" data-i18n-aria-label="publish.close">×</button>',
      '  </header>',
      '  <div class="publish-body"></div>',
      '</div>'
    ].join('\n');
    mount.appendChild(overlay);
    bodyEl = overlay.querySelector('.publish-body');
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) { close(); }
    });
    overlay.querySelector('[data-publish-close]').addEventListener('click', close);
    document.addEventListener('keydown', function (event) {
      if (opened && event.key === 'Escape') { close(); }
    });
    applyI18n(overlay);
    return overlay;
  }

  function setBody(html) {
    bodyEl.innerHTML = html;
    applyI18n(bodyEl);
  }

  function open() {
    const more = document.getElementById('topbar-more');
    if (more && more.tagName === 'DETAILS') { more.open = false; }
    ensureOverlay();
    overlay.classList.remove('hidden');
    opened = true;
    renderAuto();
  }

  function close() {
    if (overlay) { overlay.classList.add('hidden'); }
    opened = false;
  }

  async function renderAuto() {
    cachedRoot = await resolveProjectRoot();
    if (!cachedRoot) { renderNoProject(); return; }
    const c = caps();
    let status = null;
    try {
      status = c && typeof c.publishAuthStatus === 'function' ? await c.publishAuthStatus() : null;
    } catch (_err) {
      status = null;
    }
    if (status && status.connected) { renderForm(); } else { renderConnect(); }
  }

  function renderNoProject() {
    setBody([
      '<div class="publish-step">',
      '  <h3 data-i18n="publish.noProject.title">Open a mod first</h3>',
      '  <p class="publish-muted" data-i18n="publish.noProject.body"></p>',
      '</div>'
    ].join(''));
  }

  function renderConnect() {
    setBody([
      '<div class="publish-step">',
      '  <h3 data-i18n="publish.connect.title"></h3>',
      '  <p class="publish-muted" data-i18n="publish.connect.body"></p>',
      '  <button type="button" class="publish-link" data-publish-create-token data-i18n="publish.connect.createToken"></button>',
      '  <label class="publish-field">',
      '    <span data-i18n="publish.connect.tokenLabel"></span>',
      '    <input type="password" class="publish-input" data-publish-token autocomplete="off" spellcheck="false">',
      '  </label>',
      '  <p class="publish-error-text hidden" data-publish-connect-error></p>',
      '  <div class="publish-actions">',
      '    <button type="button" class="publish-primary" data-publish-connect data-i18n="publish.connect.submit"></button>',
      '  </div>',
      '</div>'
    ].join(''));

    const input = bodyEl.querySelector('[data-publish-token]');
    input.setAttribute('placeholder', t('publish.connect.tokenPlaceholder', ''));

    bodyEl.querySelector('[data-publish-create-token]').addEventListener('click', function () {
      const c = caps();
      if (c && typeof c.openExternalUrl === 'function') {
        c.openExternalUrl({ url: 'https://github.com/settings/tokens/new?scopes=repo&description=Dendry%20Mod%20Studio' });
      }
    });

    bodyEl.querySelector('[data-publish-connect]').addEventListener('click', async function () {
      const token = (input.value || '').trim();
      const errEl = bodyEl.querySelector('[data-publish-connect-error]');
      errEl.classList.add('hidden');
      if (!token) { return; }
      const btn = this;
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = t('publish.connect.connecting', 'Connecting...');
      let res = null;
      let bridgeError = '';
      try {
        res = await caps().publishSetToken({ token: token });
      } catch (err) {
        // A rejected invoke means the desktop bridge / main-process handler
        // is missing (e.g. Electron not fully restarted after the backend
        // landed). Surface that detail instead of blaming the token.
        bridgeError = String((err && err.message) || err || '');
        res = null;
      }
      btn.disabled = false;
      btn.textContent = label;
      if (res && res.ok) {
        renderForm();
      } else {
        const detail = (res && res.message) ? res.message : bridgeError;
        errEl.textContent = detail || t('publish.connect.failed', 'Could not connect.');
        errEl.classList.remove('hidden');
      }
    });
  }

  function renderForm() {
    setBody([
      '<div class="publish-step">',
      '  <div class="publish-account">',
      '    <span data-i18n="publish.connectedAs"></span>',
      '    <button type="button" class="publish-link" data-publish-disconnect data-i18n="publish.disconnect"></button>',
      '  </div>',
      '  <label class="publish-field">',
      '    <span data-i18n="publish.form.repoName"></span>',
      '    <input type="text" class="publish-input" data-publish-name spellcheck="false">',
      '  </label>',
      '  <label class="publish-field">',
      '    <span data-i18n="publish.form.description"></span>',
      '    <input type="text" class="publish-input" data-publish-desc>',
      '  </label>',
      '  <fieldset class="publish-field publish-visibility">',
      '    <legend data-i18n="publish.form.visibility"></legend>',
      '    <label class="publish-radio"><input type="radio" name="publish-visibility" value="public" checked> <span data-i18n="publish.form.public"></span></label>',
      '    <label class="publish-radio"><input type="radio" name="publish-visibility" value="private"> <span data-i18n="publish.form.private"></span></label>',
      '  </fieldset>',
      '  <div class="publish-preview">',
      '    <div class="publish-preview-head" data-i18n="publish.form.preview"></div>',
      '    <div class="publish-preview-list" data-publish-preview><span class="publish-muted" data-i18n="publish.form.previewLoading"></span></div>',
      '  </div>',
      '  <p class="publish-error-text hidden" data-publish-form-error></p>',
      '  <div class="publish-actions">',
      '    <button type="button" class="publish-primary" data-publish-submit data-i18n="publish.submit"></button>',
      '  </div>',
      '</div>'
    ].join(''));

    bodyEl.querySelector('[data-publish-name]').value = projectName();

    bodyEl.querySelector('[data-publish-disconnect]').addEventListener('click', async function () {
      try { await caps().publishClearToken(); } catch (_err) { /* ignore */ }
      renderConnect();
    });

    bodyEl.querySelector('[data-publish-submit]').addEventListener('click', onSubmit);

    loadPreview();
  }

  async function loadPreview() {
    const listEl = bodyEl.querySelector('[data-publish-preview]');
    if (!listEl) { return; }
    let res = null;
    try {
      res = await caps().publishMod({ projectRoot: currentProjectRoot(), dryRun: true });
    } catch (_err) {
      res = null;
    }
    if (!bodyEl || !bodyEl.contains(listEl)) { return; }
    if (!res || !res.ok || !res.manifest) {
      listEl.innerHTML = '<span class="publish-muted">' + escapeHtml((res && res.message) || '') + '</span>';
      return;
    }
    const included = res.manifest.included || [];
    const warnings = res.manifest.warnings || [];
    const summary = included.length + ' ' + t('publish.form.previewCount', 'files') + ' · ' + formatBytes(res.manifest.totalBytes);
    let warnHtml = '';
    warnings.forEach(function (w) {
      const label = w.code === 'large_total'
        ? t('publish.form.warnLargeTotal', 'Large total size')
        : t('publish.form.warnLargeFile', 'Large file');
      warnHtml += '<div class="publish-warn">⚠ ' + escapeHtml(label) + (w.path ? ' — ' + escapeHtml(w.path) : '') + '</div>';
    });
    const rows = included.slice(0, 200).map(function (f) {
      return '<div class="publish-preview-row"><span class="publish-preview-path">'
        + escapeHtml(f.path) + '</span><span class="publish-preview-size">'
        + formatBytes(f.bytes) + '</span></div>';
    });
    listEl.innerHTML = '<div class="publish-preview-summary">' + escapeHtml(summary) + '</div>' + warnHtml + rows.join('');
  }

  async function onSubmit() {
    const name = (bodyEl.querySelector('[data-publish-name]').value || '').trim() || projectName();
    const desc = (bodyEl.querySelector('[data-publish-desc]').value || '').trim();
    const checked = bodyEl.querySelector('input[name="publish-visibility"]:checked');
    const isPrivate = Boolean(checked && checked.value === 'private');
    renderPublishing();
    let res = null;
    try {
      res = await caps().publishMod({
        projectRoot: currentProjectRoot(),
        name: name,
        description: desc,
        private: isPrivate
      });
    } catch (err) {
      res = { ok: false, message: String((err && err.message) || err) };
    }
    if (res && res.ok) { renderSuccess(res); } else { renderError(res); }
  }

  function renderPublishing() {
    setBody([
      '<div class="publish-step publish-center">',
      '  <div class="publish-spinner" aria-hidden="true"></div>',
      '  <p data-i18n="publish.publishing"></p>',
      '</div>'
    ].join(''));
  }

  function renderSuccess(res) {
    setBody([
      '<div class="publish-step publish-center">',
      '  <h3 data-i18n="publish.success.title"></h3>',
      '  <p class="publish-muted" data-i18n="publish.success.body"></p>',
      '  <p class="publish-repo-url"></p>',
      '  <div class="publish-actions">',
      '    <button type="button" class="publish-primary" data-publish-open data-i18n="publish.success.openRepo"></button>',
      '    <button type="button" class="publish-secondary" data-publish-close-done data-i18n="publish.success.done"></button>',
      '  </div>',
      '</div>'
    ].join(''));
    bodyEl.querySelector('.publish-repo-url').textContent = res.repoUrl || '';
    bodyEl.querySelector('[data-publish-open]').addEventListener('click', function () {
      const c = caps();
      if (c && typeof c.openExternalUrl === 'function' && res.repoUrl) {
        c.openExternalUrl({ url: res.repoUrl });
      }
    });
    bodyEl.querySelector('[data-publish-close-done]').addEventListener('click', close);
  }

  // Prefer a localized message for codes we recognize; otherwise fall back to
  // the backend's raw message (which already carries GitHub's own detail).
  function errorMessage(res) {
    const fallback = (res && res.message) || '';
    if (res && res.code === 'private_scope') {
      return t('publish.error.privateScope', fallback);
    }
    return fallback;
  }

  function renderError(res) {
    setBody([
      '<div class="publish-step">',
      '  <h3 data-i18n="publish.error.title"></h3>',
      '  <p class="publish-error-text"></p>',
      '  <div class="publish-actions">',
      '    <button type="button" class="publish-primary" data-publish-retry data-i18n="publish.error.retry"></button>',
      '  </div>',
      '</div>'
    ].join(''));
    bodyEl.querySelector('.publish-error-text').textContent = errorMessage(res);
    bodyEl.querySelector('[data-publish-retry]').addEventListener('click', renderForm);
  }

  function wireButton() {
    const btn = document.getElementById('studio-open-publish');
    if (btn && !btn.dataset.publishWired) {
      btn.dataset.publishWired = '1';
      btn.addEventListener('click', open);
    }
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  onReady(function () {
    wireButton();
    document.addEventListener('project-map:locale-changed', function () {
      if (overlay) { applyI18n(overlay); }
    });
  });

  global.ProjectMapPublishUi = { open: open, close: close, isAvailable: isAvailable };
})(typeof window !== 'undefined' ? window : globalThis);
