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
  // One-shot banner shown on the next sync-dashboard render (set by an action,
  // consumed by renderSyncPanel) + when we last probed GitHub, so the panel can
  // confirm an action in place instead of dead-ending on a separate screen.
  let pendingFlash = null;
  let lastCheckedAt = 0;

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
    pendingFlash = null;
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
    if (!status || !status.connected) { renderConnect(); return; }

    // Connected: decide first-publish vs update/sync from the folder's real git
    // state. Anything that isn't an already-tracked repo falls through to the
    // existing first-publish form.
    setBody([
      '<div class="publish-step publish-center">',
      '  <div class="publish-spinner" aria-hidden="true"></div>',
      '  <p data-i18n="publish.sync.checking">Checking GitHub…</p>',
      '</div>'
    ].join(''));
    let sync = null;
    try {
      sync = c && typeof c.publishStatus === 'function'
        ? await c.publishStatus({ projectRoot: currentProjectRoot() })
        : null;
    } catch (_err) {
      sync = null;
    }
    if (sync && sync.ok) { lastCheckedAt = Date.now(); }
    if (sync && sync.ok && sync.state && sync.state !== 'first_publish') {
      renderSyncPanel(sync);
    } else {
      renderForm();
    }
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

  // ---- Update / sync panel (shown when the folder already tracks an origin) ----

  function repoNameFromUrl(url) {
    return String(url || '').replace(/\/+$/, '').split('/').pop() || '';
  }

  function formatLocaleDate(value) {
    if (!value) { return ''; }
    try {
      const d = new Date(value);
      if (isNaN(d.getTime())) { return ''; }
      return d.toLocaleDateString();
    } catch (_err) {
      return '';
    }
  }

  // Post-action confirmation: queue a one-shot banner, then re-probe so the
  // dashboard refreshes with the new state instead of dead-ending on a separate
  // success/error screen.
  function flashThenRefresh(type, text) {
    pendingFlash = { type: type, text: text };
    renderAuto();
  }

  function consumeFlash(flashEl) {
    if (!flashEl) { return; }
    if (!pendingFlash) { return; }
    flashEl.textContent = pendingFlash.text || '';
    flashEl.className = 'publish-flash ' + (pendingFlash.type === 'error' ? 'is-error' : 'is-success');
    pendingFlash = null;
  }

  function renderCheckedLabel(el) {
    if (!el) { return; }
    let when = '';
    try { when = lastCheckedAt ? new Date(lastCheckedAt).toLocaleTimeString() : ''; } catch (_err) { when = ''; }
    el.textContent = when ? (t('publish.sync.lastChecked', 'Last checked') + ': ' + when) : '';
  }

  // Repo identity card: clickable name (opens GitHub), a public/private badge
  // (reusing the first-publish visibility labels), the description, and when the
  // remote was last updated. repoMeta is best-effort — absent when offline or the
  // metadata read failed, in which case only the name link is shown.
  function buildRepoCard(card, sync) {
    if (!card) { return; }
    const meta = sync.repoMeta || null;
    const url = sync.repoUrl || '';
    const name = repoNameFromUrl(url);

    const head = document.createElement('div');
    head.className = 'publish-repo-head';
    if (url) {
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'publish-repo-link';
      link.textContent = name || url;
      link.addEventListener('click', function () {
        const c = caps();
        if (c && typeof c.openExternalUrl === 'function') { c.openExternalUrl({ url: url }); }
      });
      head.appendChild(link);
    } else {
      const span = document.createElement('span');
      span.className = 'publish-repo-link is-static';
      span.textContent = name;
      head.appendChild(span);
    }
    if (meta) {
      const badge = document.createElement('span');
      badge.className = 'publish-vis-badge ' + (meta.private ? 'is-private' : 'is-public');
      badge.textContent = meta.private
        ? t('publish.form.private', 'Private')
        : t('publish.form.public', 'Public');
      head.appendChild(badge);
    }
    card.appendChild(head);

    if (meta && meta.description) {
      const desc = document.createElement('p');
      desc.className = 'publish-repo-desc';
      desc.textContent = meta.description;
      card.appendChild(desc);
    }
    const when = meta ? formatLocaleDate(meta.pushedAt) : '';
    if (when) {
      const upd = document.createElement('p');
      upd.className = 'publish-repo-updated';
      upd.textContent = t('publish.sync.lastUpdatedLabel', 'Last updated') + ': ' + when;
      card.appendChild(upd);
    }
  }

  function commitRowsHtml(commits) {
    return (commits || []).slice(0, 8).map(function (cmt) {
      const when = formatLocaleDate(cmt && cmt.date);
      return '<div class="publish-commit-row">'
        + '<span class="publish-commit-msg">' + escapeHtml((cmt && cmt.message) || '') + '</span>'
        + (when ? '<span class="publish-commit-date">' + escapeHtml(when) + '</span>' : '')
        + '</div>';
    }).join('');
  }

  // Commit messages behind the ahead/behind counts: what THIS update will upload,
  // and what is waiting on GitHub. The messages are plain data from the backend
  // (already-local objects), so this never hits the network.
  function buildCommitLists(container, sync) {
    if (!container) { return; }
    const ahead = sync.aheadCommits || [];
    const behind = sync.behindCommits || [];
    let html = '';
    if (ahead.length) {
      html += '<div class="publish-commit-group"><div class="publish-commit-head">'
        + escapeHtml(t('publish.sync.changesToUpload', 'Changes to upload'))
        + '</div>' + commitRowsHtml(ahead) + '</div>';
    }
    if (behind.length) {
      html += '<div class="publish-commit-group"><div class="publish-commit-head">'
        + escapeHtml(t('publish.sync.changesFromGitHub', 'New on GitHub'))
        + '</div>' + commitRowsHtml(behind) + '</div>';
    }
    container.innerHTML = html;
  }

  // Lazy file-level detail. Only offered when there are local changes to
  // enumerate (a pure remote_ahead has none locally). The actual diff is fetched
  // on demand so opening the panel stays fast.
  function wireChangesDisclosure(container, sync) {
    if (!container) { return; }
    const mayHaveLocal = Boolean(sync.dirty)
      || (sync.aheadCommits && sync.aheadCommits.length > 0)
      || sync.state === 'local_ahead'
      || sync.state === 'diverged';
    if (!mayHaveLocal) { return; }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'publish-link';
    btn.textContent = t('publish.sync.viewFiles', 'View changed files');
    btn.addEventListener('click', function () {
      btn.disabled = true;
      const spin = document.createElement('div');
      spin.className = 'publish-spinner publish-spinner-sm';
      spin.setAttribute('aria-hidden', 'true');
      container.appendChild(spin);
      loadChangedFiles(container);
    });
    container.appendChild(btn);
  }

  function changeMark(change) {
    if (change === 'add') { return '+'; }
    if (change === 'delete') { return '−'; }
    return '~';
  }

  async function loadChangedFiles(container) {
    let res = null;
    try {
      res = await caps().publishChanges({ projectRoot: currentProjectRoot() });
    } catch (_err) {
      res = null;
    }
    // The panel may have re-rendered while we awaited; bail if detached.
    if (!bodyEl || !bodyEl.contains(container)) { return; }
    container.innerHTML = '';
    const rows = [];
    if (res && res.ok) {
      (res.committedChanges || []).forEach(function (f) { rows.push(f); });
      (res.workingChanges || []).forEach(function (f) {
        if (!rows.some(function (r) { return r.path === f.path; })) { rows.push(f); }
      });
      rows.sort(function (a, b) { return a.path.localeCompare(b.path); });
    }
    if (!rows.length) {
      const note = document.createElement('p');
      note.className = 'publish-sync-hint';
      note.textContent = '—';
      container.appendChild(note);
      return;
    }
    const list = document.createElement('div');
    list.className = 'publish-change-list';
    list.innerHTML = rows.slice(0, 300).map(function (f) {
      return '<div class="publish-change-row publish-change-' + escapeHtml(f.change) + '">'
        + '<span class="publish-change-mark" aria-hidden="true">' + changeMark(f.change) + '</span>'
        + '<span class="publish-change-path">' + escapeHtml(f.path) + '</span></div>';
    }).join('');
    container.appendChild(list);
  }

  function renderSyncPanel(sync) {
    const state = sync.state;
    const ahead = Number(sync.ahead) || 0;
    const behind = Number(sync.behind) || 0;
    const dirty = Boolean(sync.dirty);

    let summaryKey = 'publish.sync.inSync';
    let summaryFallback = 'Everything is up to date with GitHub.';
    if (state === 'offline') {
      summaryKey = 'publish.sync.offline';
      summaryFallback = 'Could not reach GitHub. Check your connection and try again.';
    } else if (state === 'local_ahead') {
      summaryKey = 'publish.sync.localAhead';
      summaryFallback = 'You have local changes that are not on GitHub yet.';
    } else if (state === 'remote_ahead') {
      summaryKey = 'publish.sync.remoteAhead';
      summaryFallback = 'GitHub has newer changes than the copy on your computer.';
    } else if (state === 'diverged') {
      summaryKey = 'publish.sync.diverged';
      summaryFallback = 'Your computer and GitHub have each changed separately.';
    }

    setBody([
      '<div class="publish-step">',
      '  <div class="publish-account">',
      '    <span data-i18n="publish.connectedAs"></span>',
      '    <button type="button" class="publish-link" data-publish-disconnect data-i18n="publish.disconnect"></button>',
      '  </div>',
      '  <div class="publish-sync">',
      '    <div class="publish-flash hidden" data-publish-flash></div>',
      '    <div class="publish-repo-card" data-publish-repo-card></div>',
      '    <div class="publish-sync-counts" data-publish-counts></div>',
      '    <p class="publish-sync-summary">' + escapeHtml(t(summaryKey, summaryFallback)) + '</p>',
      '    <p class="publish-sync-dirty hidden" data-publish-dirty>'
        + escapeHtml(t('publish.sync.dirty', 'You also have unsaved local edits — they will be included when you update.'))
        + '</p>',
      '    <div class="publish-commits" data-publish-commits></div>',
      '    <div class="publish-changes" data-publish-changes></div>',
      '    <p class="publish-error-text hidden" data-publish-sync-error></p>',
      '    <div class="publish-actions" data-publish-sync-actions></div>',
      '    <div class="publish-manage" data-publish-manage></div>',
      '    <p class="publish-checked" data-publish-checked></p>',
      '  </div>',
      '</div>'
    ].join(''));

    consumeFlash(bodyEl.querySelector('[data-publish-flash]'));
    buildRepoCard(bodyEl.querySelector('[data-publish-repo-card]'), sync);
    buildCommitLists(bodyEl.querySelector('[data-publish-commits]'), sync);
    wireChangesDisclosure(bodyEl.querySelector('[data-publish-changes]'), sync);
    renderCheckedLabel(bodyEl.querySelector('[data-publish-checked]'));

    const countsEl = bodyEl.querySelector('[data-publish-counts]');
    if (countsEl) {
      const badges = [];
      if (ahead > 0) {
        badges.push('<span class="publish-badge publish-badge-ahead">↑ ' + ahead + ' '
          + escapeHtml(t('publish.sync.ahead', 'to upload')) + '</span>');
      }
      if (behind > 0) {
        badges.push('<span class="publish-badge publish-badge-behind">↓ ' + behind + ' '
          + escapeHtml(t('publish.sync.behind', 'to download')) + '</span>');
      }
      countsEl.innerHTML = badges.join('');
    }

    if (dirty) {
      const dEl = bodyEl.querySelector('[data-publish-dirty]');
      if (dEl) { dEl.classList.remove('hidden'); }
    }

    bodyEl.querySelector('[data-publish-disconnect]').addEventListener('click', async function () {
      try { await caps().publishClearToken(); } catch (_err) { /* ignore */ }
      renderConnect();
    });

    renderSyncActions(sync);
    buildManageSection(bodyEl.querySelector('[data-publish-manage]'), sync);
  }

  // State-specific action buttons live here. A refresh is always available so the
  // user can re-check after acting on GitHub or reconnecting.
  function renderSyncActions(sync) {
    const actions = bodyEl.querySelector('[data-publish-sync-actions]');
    if (!actions) { return; }
    const state = sync.state;
    const dirty = Boolean(sync.dirty);
    const canUpdate = state === 'local_ahead' || (state === 'in_sync' && dirty);

    if (canUpdate) {
      // Update needs a commit message — render a small form above the buttons.
      const form = document.createElement('div');
      form.className = 'publish-update-form';
      form.innerHTML = [
        '<label class="publish-field">',
        '  <span>' + escapeHtml(t('publish.sync.messageLabel', 'Describe what changed')) + '</span>',
        '  <input type="text" class="publish-input" data-publish-update-message spellcheck="false">',
        '</label>'
      ].join('');
      actions.parentNode.insertBefore(form, actions);
      const msgInput = form.querySelector('[data-publish-update-message]');
      msgInput.setAttribute('placeholder', t('publish.sync.messagePlaceholder', 'e.g. Fixed the intro scene'));

      const updateBtn = document.createElement('button');
      updateBtn.type = 'button';
      updateBtn.className = 'publish-primary';
      updateBtn.textContent = t('publish.sync.update', 'Update on GitHub');
      updateBtn.addEventListener('click', function () { onUpdate(msgInput.value); });
      actions.appendChild(updateBtn);
    }

    // Fast-forward pull is offered only when the remote is strictly ahead and the
    // worktree is clean. A dirty remote_ahead gets an advisory note instead — we
    // never overwrite local edits.
    if (state === 'remote_ahead' && !dirty) {
      const syncBtn = document.createElement('button');
      syncBtn.type = 'button';
      syncBtn.className = 'publish-primary';
      syncBtn.textContent = t('publish.sync.sync', 'Download from GitHub');
      syncBtn.addEventListener('click', onSync);
      actions.appendChild(syncBtn);
    } else if (state === 'remote_ahead' && dirty) {
      const hint = document.createElement('p');
      hint.className = 'publish-sync-hint';
      hint.textContent = t('publish.sync.dirtyBlocksPull', 'Set your local edits aside before downloading the changes from GitHub.');
      actions.parentNode.insertBefore(hint, actions);
    }

    // Divergence escape hatch: force-push (overwrite remote). Deliberately the
    // only place that crosses the never-force rule, gated behind a strong warning
    // and a typed second confirmation.
    if (state === 'diverged') {
      const warn = document.createElement('p');
      warn.className = 'publish-sync-danger';
      warn.textContent = t('publish.sync.divergedWarn', 'Your computer and GitHub have changed separately. You can overwrite GitHub with your version, but the changes made on GitHub will be lost.');
      actions.parentNode.insertBefore(warn, actions);

      const forceBtn = document.createElement('button');
      forceBtn.type = 'button';
      forceBtn.className = 'publish-danger';
      forceBtn.textContent = t('publish.sync.forceOpen', 'Overwrite GitHub with my version…');
      forceBtn.addEventListener('click', function () { renderForceConfirm(sync); });
      actions.appendChild(forceBtn);
    }

    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.className = 'publish-secondary';
    refresh.textContent = t('publish.sync.refresh', 'Check again');
    refresh.addEventListener('click', renderAuto);
    actions.appendChild(refresh);
  }

  async function onUpdate(message, extraOpts) {
    const msg = String(message || '').trim();
    if (!msg) {
      const errEl = bodyEl.querySelector('[data-publish-sync-error]');
      if (errEl) {
        errEl.textContent = t('publish.sync.needMessage', 'Please describe what changed first.');
        errEl.classList.remove('hidden');
      }
      return;
    }
    renderBusy('publish.publishing', 'Publishing…');
    let res = null;
    try {
      res = await caps().publishUpdate(Object.assign(
        { projectRoot: currentProjectRoot(), message: msg },
        extraOpts || {}
      ));
    } catch (err) {
      res = { ok: false, message: String((err && err.message) || err) };
    }
    if (res && res.ok) {
      const forced = Boolean(res.forced);
      flashThenRefresh('success', forced
        ? t('publish.sync.forcedBody', 'GitHub now matches the copy on your computer.')
        : t('publish.sync.updatedBody', 'Your changes are now on GitHub.'));
    } else {
      flashThenRefresh('error', updateErrorMessage(res));
    }
  }

  // Friendlier copy for the update failures we recognize; otherwise the backend's
  // own message (which already carries GitHub's detail).
  function updateErrorMessage(res) {
    const code = res && res.code;
    if (code === 'nothing_to_commit') {
      return t('publish.sync.nothingToCommit', 'There are no changes to publish.');
    }
    if (code === 'remote_ahead') {
      return t('publish.sync.remoteMoved', 'GitHub changed since you last checked. Re-check and sync first.');
    }
    return errorMessage(res);
  }

  function renderBusy(textKey, fallback) {
    setBody([
      '<div class="publish-step publish-center">',
      '  <div class="publish-spinner" aria-hidden="true"></div>',
      '  <p>' + escapeHtml(t(textKey, fallback)) + '</p>',
      '</div>'
    ].join(''));
  }

  async function onSync() {
    renderBusy('publish.sync.syncing', 'Downloading from GitHub…');
    let res = null;
    try {
      res = await caps().publishSync({ projectRoot: currentProjectRoot() });
    } catch (err) {
      res = { ok: false, message: String((err && err.message) || err) };
    }
    if (res && res.ok) {
      // The on-disk content changed — rebuild the Studio index so the underlying
      // app reflects the pulled version (best-effort; the overlay stays open).
      try {
        const c = caps();
        const bridge = c && typeof c.raw === 'function' ? c.raw() : null;
        if (bridge && typeof bridge.rebuildProjectIndex === 'function') {
          await bridge.rebuildProjectIndex({});
        }
      } catch (_err) { /* index refresh is best-effort */ }
      flashThenRefresh('success', t('publish.sync.syncedBody', 'Studio now has the latest version from GitHub.'));
    } else {
      flashThenRefresh('error', syncErrorMessage(res));
    }
  }

  function syncErrorMessage(res) {
    const code = res && res.code;
    if (code === 'dirty') {
      return t('publish.sync.dirtyError', 'You have unsaved local edits. Set them aside, then download again.');
    }
    if (code === 'not_fast_forward') {
      return t('publish.sync.notFastForward', 'GitHub and your computer have diverged. Re-check to see your options.');
    }
    return (res && res.message) || '';
  }

  // The force-push (overwrite remote) escape hatch. A strong warning plus a typed
  // confirmation (the user must type the repo name) gate the only force we do.
  function renderForceConfirm(sync) {
    const repoUrl = (sync && sync.repoUrl) || '';
    const repoName = repoUrl.replace(/\/+$/, '').split('/').pop() || '';
    setBody([
      '<div class="publish-step">',
      '  <h3>' + escapeHtml(t('publish.sync.forceTitle', 'Overwrite GitHub?')) + '</h3>',
      '  <div class="publish-sync-danger-box">',
      '    <p>' + escapeHtml(t('publish.sync.forceWarn1', 'This replaces the version on GitHub with the copy on your computer.')) + '</p>',
      '    <p>' + escapeHtml(t('publish.sync.forceWarn2', 'Any changes on GitHub that you do not have will be permanently lost. This cannot be undone.')) + '</p>',
      '  </div>',
      '  <label class="publish-field">',
      '    <span>' + escapeHtml(t('publish.sync.messageOptional', 'Message for this update (optional)')) + '</span>',
      '    <input type="text" class="publish-input" data-publish-force-message spellcheck="false">',
      '  </label>',
      '  <label class="publish-field">',
      '    <span>' + escapeHtml(t('publish.sync.forceConfirmLabel', 'Type the repository name to confirm') + ': ' + repoName) + '</span>',
      '    <input type="text" class="publish-input" data-publish-force-confirm spellcheck="false" autocomplete="off">',
      '  </label>',
      '  <div class="publish-actions">',
      '    <button type="button" class="publish-secondary" data-publish-force-cancel></button>',
      '    <button type="button" class="publish-danger" data-publish-force-go disabled></button>',
      '  </div>',
      '</div>'
    ].join(''));

    const confirmInput = bodyEl.querySelector('[data-publish-force-confirm]');
    const goBtn = bodyEl.querySelector('[data-publish-force-go]');
    const cancelBtn = bodyEl.querySelector('[data-publish-force-cancel]');
    goBtn.textContent = t('publish.sync.forceGo', 'Overwrite GitHub');
    cancelBtn.textContent = t('publish.sync.cancel', 'Cancel');
    cancelBtn.addEventListener('click', renderAuto);

    function validate() {
      goBtn.disabled = !(repoName && confirmInput.value.trim() === repoName);
    }
    confirmInput.addEventListener('input', validate);
    validate();

    goBtn.addEventListener('click', function () {
      if (goBtn.disabled) { return; }
      const msg = (bodyEl.querySelector('[data-publish-force-message]').value || '').trim();
      onUpdate(msg || t('publish.sync.forceDefaultMessage', 'Overwrite from Dendry Mod Studio'), { force: true });
    });
  }

  // ----- Manage section: repo settings that write to GitHub -----------------
  // Lower-stakes management for an already-published folder: change visibility,
  // edit the description, or disconnect the folder from its repo. Each write
  // goes through the backend op we own (publishConfig / publishUnlink) and
  // confirms in place via the same flash + re-probe path as the sync actions, so
  // the dashboard reflects the change without dead-ending on a separate screen.
  function buildManageSection(container, sync) {
    if (!container) { return; }
    const meta = sync.repoMeta || null;

    const head = document.createElement('div');
    head.className = 'publish-manage-head';
    head.textContent = t('publish.manage.title', 'Manage');
    container.appendChild(head);

    buildVisibilityRow(container, meta);
    buildDescriptionRow(container, meta);
    buildUnlinkRow(container, sync);
  }

  // repoMeta is best-effort. When it is absent (offline / metadata read failed)
  // we cannot know the current visibility, so we show a short note instead of
  // guessing — never a toggle that might flip the wrong way.
  function buildVisibilityRow(container, meta) {
    const row = document.createElement('div');
    row.className = 'publish-manage-row';
    const label = document.createElement('span');
    label.className = 'publish-manage-label';
    label.textContent = t('publish.manage.visibilityLabel', 'Visibility');
    row.appendChild(label);

    if (!meta) {
      const note = document.createElement('span');
      note.className = 'publish-manage-note';
      note.textContent = t('publish.manage.visibilityUnavailable', 'Connect to GitHub to change visibility.');
      row.appendChild(note);
      container.appendChild(row);
      return;
    }

    const badge = document.createElement('span');
    badge.className = 'publish-vis-badge ' + (meta.private ? 'is-private' : 'is-public');
    badge.textContent = meta.private
      ? t('publish.form.private', 'Private')
      : t('publish.form.public', 'Public');
    row.appendChild(badge);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'publish-secondary publish-manage-action';
    if (meta.private) {
      // private -> public is the privacy-sensitive direction: confirm first.
      btn.textContent = t('publish.manage.makePublic', 'Make public…');
      btn.addEventListener('click', renderMakePublicConfirm);
    } else {
      // public -> private is low-risk: one click.
      btn.textContent = t('publish.manage.makePrivate', 'Make private');
      btn.addEventListener('click', function () {
        onConfig({ private: true }, t('publish.manage.madePrivate', 'This mod is now private on GitHub.'));
      });
    }
    row.appendChild(btn);
    container.appendChild(row);
  }

  function renderMakePublicConfirm() {
    setBody([
      '<div class="publish-step">',
      '  <h3>' + escapeHtml(t('publish.manage.makePublicGo', 'Make public')) + '</h3>',
      '  <p>' + escapeHtml(t('publish.manage.makePublicConfirm', 'Anyone will be able to find and read this mod on GitHub. Make it public?')) + '</p>',
      '  <div class="publish-actions">',
      '    <button type="button" class="publish-secondary" data-publish-cancel></button>',
      '    <button type="button" class="publish-primary" data-publish-go></button>',
      '  </div>',
      '</div>'
    ].join(''));
    const cancel = bodyEl.querySelector('[data-publish-cancel]');
    cancel.textContent = t('publish.sync.cancel', 'Cancel');
    cancel.addEventListener('click', renderAuto);
    const go = bodyEl.querySelector('[data-publish-go]');
    go.textContent = t('publish.manage.makePublicGo', 'Make public');
    go.addEventListener('click', function () {
      onConfig({ private: false }, t('publish.manage.madePublic', 'This mod is now public on GitHub.'));
    });
  }

  function buildDescriptionRow(container, meta) {
    const row = document.createElement('div');
    row.className = 'publish-manage-row publish-manage-row-desc';
    renderDescriptionView(row, meta);
    container.appendChild(row);
  }

  function renderDescriptionView(row, meta) {
    row.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'publish-manage-label';
    label.textContent = t('publish.manage.descriptionLabel', 'Description');
    row.appendChild(label);

    const current = (meta && meta.description) || '';
    const text = document.createElement('span');
    text.className = 'publish-manage-desc-text' + (current ? '' : ' is-empty');
    text.textContent = current || t('publish.manage.descriptionEmpty', 'No description yet.');
    row.appendChild(text);

    // Without repoMeta we cannot prefill the current text reliably, so the
    // editor is only offered when we know what we are editing.
    if (!meta) { return; }
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'publish-link publish-manage-action';
    edit.textContent = t('publish.manage.descriptionEdit', 'Edit');
    edit.addEventListener('click', function () { renderDescriptionEdit(row, meta); });
    row.appendChild(edit);
  }

  function renderDescriptionEdit(row, meta) {
    row.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'publish-manage-label';
    label.textContent = t('publish.manage.descriptionLabel', 'Description');
    row.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'publish-input publish-manage-desc-input';
    input.spellcheck = false;
    input.value = (meta && meta.description) || '';
    row.appendChild(input);

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'publish-primary publish-manage-action';
    save.textContent = t('publish.manage.descriptionSave', 'Save');
    save.addEventListener('click', function () {
      onConfig({ description: input.value.trim() }, t('publish.manage.descriptionSaved', 'Description updated on GitHub.'));
    });
    row.appendChild(save);

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'publish-secondary publish-manage-action';
    cancel.textContent = t('publish.sync.cancel', 'Cancel');
    cancel.addEventListener('click', function () { renderDescriptionView(row, meta); });
    row.appendChild(cancel);

    if (typeof input.focus === 'function') { input.focus(); }
  }

  function buildUnlinkRow(container, sync) {
    const row = document.createElement('div');
    row.className = 'publish-manage-row publish-manage-row-unlink';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'publish-link publish-manage-unlink';
    btn.textContent = t('publish.manage.unlink', 'Disconnect from GitHub…');
    btn.addEventListener('click', function () { renderUnlinkConfirm(sync); });
    row.appendChild(btn);
    container.appendChild(row);
  }

  // Disconnect is local-only and non-destructive (it removes the origin remote;
  // history, files, and the GitHub repo all stay), so a single clear confirm —
  // not a typed-name gate like the force-push — is the right weight.
  function renderUnlinkConfirm(sync) {
    setBody([
      '<div class="publish-step">',
      '  <h3>' + escapeHtml(t('publish.manage.unlinkTitle', 'Disconnect this folder from GitHub?')) + '</h3>',
      '  <p>' + escapeHtml(t('publish.manage.unlinkBody1', 'This only removes the link on your computer. Your files, your history, and the GitHub repository all stay exactly as they are.')) + '</p>',
      '  <p class="publish-muted">' + escapeHtml(t('publish.manage.unlinkBody2', 'You can reconnect any time by publishing this folder again.')) + '</p>',
      '  <div class="publish-actions">',
      '    <button type="button" class="publish-secondary" data-publish-unlink-cancel></button>',
      '    <button type="button" class="publish-primary" data-publish-unlink-go></button>',
      '  </div>',
      '</div>'
    ].join(''));
    const cancel = bodyEl.querySelector('[data-publish-unlink-cancel]');
    cancel.textContent = t('publish.sync.cancel', 'Cancel');
    cancel.addEventListener('click', renderAuto);
    const go = bodyEl.querySelector('[data-publish-unlink-go]');
    go.textContent = t('publish.manage.unlinkGo', 'Disconnect');
    go.addEventListener('click', onUnlink);
  }

  async function onUnlink() {
    renderBusy('publish.manage.unlink', 'Disconnecting…');
    let res = null;
    try {
      res = await caps().publishUnlink({ projectRoot: currentProjectRoot() });
    } catch (err) {
      res = { ok: false, message: String((err && err.message) || err) };
    }
    if (res && res.ok) {
      renderUnlinkDone();
    } else {
      flashThenRefresh('error', (res && res.message) || '');
    }
  }

  // After unlinking the folder is a first-publish folder again. Show a calm
  // confirmation, then let the user step back into the publish flow (renderAuto
  // re-probes and, finding no origin, renders the publish form).
  function renderUnlinkDone() {
    setBody([
      '<div class="publish-step publish-center">',
      '  <h3>' + escapeHtml(t('publish.manage.unlinkDoneTitle', 'Disconnected from GitHub')) + '</h3>',
      '  <p class="publish-muted">' + escapeHtml(t('publish.manage.unlinkDoneBody', 'This folder is no longer linked to GitHub. Publish it again whenever you are ready.')) + '</p>',
      '  <div class="publish-actions">',
      '    <button type="button" class="publish-primary" data-publish-unlink-back></button>',
      '  </div>',
      '</div>'
    ].join(''));
    const back = bodyEl.querySelector('[data-publish-unlink-back]');
    back.textContent = t('publish.manage.unlinkDoneBack', 'Back to publishing');
    back.addEventListener('click', renderAuto);
  }

  // Shared writer for visibility + description changes. Both PATCH the repo via
  // publishConfig and confirm in place; the re-probe afterwards refreshes the
  // dashboard's repoMeta so the new state is reflected.
  async function onConfig(patch, successText) {
    renderBusy('publish.publishing', 'Publishing…');
    let res = null;
    try {
      res = await caps().publishConfig(Object.assign({ projectRoot: currentProjectRoot() }, patch));
    } catch (err) {
      res = { ok: false, message: String((err && err.message) || err) };
    }
    if (res && res.ok) {
      flashThenRefresh('success', successText);
    } else {
      flashThenRefresh('error', configErrorMessage(res));
    }
  }

  function configErrorMessage(res) {
    const code = res && res.code;
    if (code === 'forbidden') {
      return t('publish.manage.forbidden', 'Your GitHub connection does not have permission to change this. Reconnect with full repository access.');
    }
    if (code === 'no_changes') {
      return t('publish.sync.nothingToCommit', 'There are no changes to publish.');
    }
    return (res && res.message) || '';
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
