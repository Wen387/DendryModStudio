// Right Sidebar guarded auto-apply — UI controller.
//
// Surfaces the headless ProjectMapRightSidebarDraft model (P0–P3) as a
// clickable designer so a tester can: design a right-gutter panel -> see the
// detected template ownership + apply mode -> push the guarded install plan
// (copy_template_file + insert_html_block, or manual_review when ownership is
// unknown) into the shared Review & Apply wizard. It mounts itself inside the
// existing "Sidebar / Status" authoring panel, so it shows/hides with that
// surface and needs no new authoring-surface registry key.
//
// Deliberately uses literal English copy (no i18n keys) — this is a focused
// guarded-apply test surface, kept off the localization catalogs.
(function initRightSidebarGuardedUi(global) {
  'use strict';

  if (!global || !global.document) {
    return;
  }
  const document = global.document;

  const EVENT_NAMES = [
    'project-map:index-loaded',
    'ProjectMap:index-loaded',
    'projectmap:index-loaded',
    'ProjectMapIndexLoaded',
    'project-map:model-loaded',
    'ProjectMap:desktop-index-loaded'
  ];

  const state = {projectIndex: null, model: null, host: null, mounted: false, tdirEdited: false};

  const api = {
    setProjectIndex: setProjectIndex,
    setIndex: setProjectIndex,
    refresh: render,
    getModel: () => state.model
  };
  global.ProjectMapRightSidebarGuardedUi = api;

  onReady(() => {
    mount();
    bindIndexEvents();
    render();
  });

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function coreApi() {
    return global.ProjectMapRightSidebarDraft || null;
  }

  function installAssistant() {
    return global.ProjectMapInstallAssistant || null;
  }

  function mount() {
    if (state.mounted) {
      return;
    }
    const section = document.querySelector('section.wizard-form-panel[data-create-template-panel="sidebar_status"]');
    if (!section) {
      return;
    }
    const host = document.createElement('section');
    host.id = 'right-sidebar-guarded-host';
    host.className = 'wizard-fieldset';
    host.innerHTML = skeleton();
    section.appendChild(host);
    state.host = host;
    bindForm();
    state.mounted = true;
  }

  function skeleton() {
    return [
      '<div class="preview-heading output-heading">Right Sidebar Panel — guarded auto-apply (test)</div>',
      '<p class="wizard-field-help">Design a <code>#stats_sidebar_right .tools.right</code> panel, then send the guarded plan to Review &amp; Apply. Studio writes it only when it can confirm a mod-owned template the build will read; otherwise it stays manual review.</p>',
      '<div id="rsg-badge" class="diagnostic-row info">Open a project to detect template ownership.</div>',
      '<div id="rsg-readiness" class="entry-route-grid"></div>',
      '<label class="wizard-field"><span>Panel heading</span>',
      '<input id="rsg-heading" type="text" autocomplete="off" placeholder="Field Notes"></label>',
      '<label class="wizard-field"><span>Panel body (blank line = new paragraph)</span>',
      '<textarea id="rsg-body" rows="3" placeholder="Notes shown in the right gutter."></textarea></label>',
      '<label class="wizard-field"><span>Extra lines (one per line, optional)</span>',
      '<textarea id="rsg-lines" rows="2"></textarea></label>',
      '<label class="wizard-field"><span>Mod template directory</span>',
      '<input id="rsg-template-dir" type="text" autocomplete="off" placeholder="templates/html/&lt;slug&gt;"></label>',
      '<input id="rsg-id" type="hidden" value="right_sidebar_panel">',
      '<input id="rsg-title" type="hidden" value="Right Sidebar Panel">',
      '<div id="rsg-diagnostics"></div>',
      '<div class="preview-heading">Generated operations</div>',
      '<div id="rsg-ops"></div>',
      '<div class="preview-heading">Panel HTML</div>',
      '<pre id="rsg-html-preview" class="code-preview"></pre>',
      '<div class="preview-heading">Player-facing preview</div>',
      '<pre id="rsg-player-preview" class="code-preview"></pre>',
      '<div class="wizard-actions"><div class="wizard-action-group wizard-action-primary">',
      '<button id="rsg-review" class="primary-action" type="button">Review &amp; Apply (guarded)</button>',
      '<button id="rsg-download" type="button">Download install plan</button>',
      '</div></div>',
      '<div id="rsg-status" class="wizard-field-help"></div>'
    ].join('');
  }

  function bindForm() {
    ['rsg-heading', 'rsg-body', 'rsg-lines', 'rsg-template-dir'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        if (id === 'rsg-template-dir') {
          el.addEventListener('input', () => {
            state.tdirEdited = true;
            render();
          });
        } else {
          el.addEventListener('input', render);
        }
      }
    });
    const review = document.getElementById('rsg-review');
    if (review) {
      review.addEventListener('click', reviewAndApply);
    }
    const download = document.getElementById('rsg-download');
    if (download) {
      download.addEventListener('click', downloadPlan);
    }
  }

  function bindIndexEvents() {
    EVENT_NAMES.forEach((name) => {
      document.addEventListener(name, (event) => {
        const detail = event.detail || {};
        if (detail.index) {
          setProjectIndex(detail.index);
        } else if (detail.model && detail.model.index) {
          setProjectIndex(detail.model.index);
        }
      });
    });
  }

  function setProjectIndex(index) {
    state.projectIndex = index || null;
    render();
  }

  function render() {
    if (!state.host) {
      mount();
    }
    if (!state.host) {
      return;
    }
    const core = coreApi();
    if (core && typeof core.buildRightSidebarModel === 'function') {
      state.model = core.buildRightSidebarModel(state.projectIndex);
    }
    const tdir = document.getElementById('rsg-template-dir');
    if (tdir && !state.tdirEdited && state.model && state.model.recommendedTemplateDir) {
      tdir.value = state.model.recommendedTemplateDir;
    }
    renderBadge();
    renderReadiness();
    const draft = buildDraft();
    let bundle = null;
    if (core && typeof core.buildExportBundle === 'function') {
      try {
        bundle = core.buildExportBundle(draft, state.projectIndex);
      } catch (_err) {
        bundle = null;
      }
    }
    setText('rsg-html-preview', bundle ? bundle.panelHtml : fallbackPanelHtml(core, draft));
    setText('rsg-player-preview', bundle ? bundle.playerPreview : '');
    renderDiagnostics(bundle ? bundle.diagnostics : []);
    renderOps(bundle ? bundle.installPlan : null);
  }

  function fallbackPanelHtml(core, draft) {
    if (core && typeof core.renderRightSidebarHtml === 'function' && typeof core.normalizeDraft === 'function') {
      return core.renderRightSidebarHtml(core.normalizeDraft(draft));
    }
    return '';
  }

  function buildDraft() {
    return {
      schemaVersion: '0.1',
      kind: 'right_sidebar',
      id: val('rsg-id') || 'right_sidebar_panel',
      title: val('rsg-title') || 'Right Sidebar Panel',
      panelTitle: val('rsg-heading'),
      panelBody: val('rsg-body'),
      panelLines: val('rsg-lines'),
      templateDir: val('rsg-template-dir') || (state.model && state.model.recommendedTemplateDir) || '',
      evidence: state.model || {}
    };
  }

  function renderBadge() {
    const el = document.getElementById('rsg-badge');
    if (!el) {
      return;
    }
    if (!state.model) {
      el.className = 'diagnostic-row info';
      el.textContent = 'Open a project to detect template ownership.';
      return;
    }
    const model = state.model;
    const guarded = model.applyMode === 'guarded_apply';
    el.className = 'diagnostic-row ' + (guarded ? 'info' : 'warning');
    el.innerHTML = '<strong>ownership: ' + esc(model.templateOwnership) + '</strong>' +
      '<span>apply mode: ' + esc(model.applyMode) +
      (guarded ? ' — Studio writes the panel into the mod template and verifies it.'
        : ' — manual review only; apply the exported patch by hand.') + '</span>';
  }

  function renderReadiness() {
    const el = document.getElementById('rsg-readiness');
    if (!el) {
      return;
    }
    const rows = state.model && Array.isArray(state.model.readiness) ? state.model.readiness : [];
    if (!rows.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = rows.map((row) => {
      const status = String(row.status || 'manual');
      const cls = status === 'ready' ? 'ready' : status === 'guarded' ? 'ready' : 'warning';
      return '<div class="entry-route-card ' + cls + '">' +
        '<small>' + esc(row.label || row.id || '') + ' (' + esc(status) + ')</small>' +
        '<strong>' + esc(row.message || '') + '</strong></div>';
    }).join('');
  }

  function renderDiagnostics(diagnostics) {
    const el = document.getElementById('rsg-diagnostics');
    if (!el) {
      return;
    }
    const items = Array.isArray(diagnostics) ? diagnostics : [];
    if (!items.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = items.map((diag) => {
      const severity = esc(diag.severity || 'info');
      return '<div class="diagnostic-row ' + severity + '">' +
        '<strong>' + esc(diag.code || 'diagnostic') + '</strong>' +
        '<span>' + esc(diag.message || '') + '</span></div>';
    }).join('');
  }

  function renderOps(plan) {
    const el = document.getElementById('rsg-ops');
    if (!el) {
      return;
    }
    const ops = plan && Array.isArray(plan.operations) ? plan.operations : [];
    if (!ops.length) {
      el.innerHTML = '<div class="diagnostic-row info"><span>No operations yet.</span></div>';
      return;
    }
    el.innerHTML = ops.map((op) => {
      const guarded = String(op.safety || '').indexOf('apply') >= 0 && op.safety !== 'manual_review';
      return '<div class="diagnostic-row ' + (guarded ? 'info' : 'warning') + '">' +
        '<strong>' + esc(op.type || '') + '</strong>' +
        '<span>' + esc(op.path || '') + ' [' + esc(op.safety || '') + ']</span></div>';
    }).join('');
  }

  function reviewAndApply() {
    const core = coreApi();
    if (!core || typeof core.buildExportBundle !== 'function') {
      return setStatus('Right Sidebar draft core is not loaded.', 'warning');
    }
    const bundle = core.buildExportBundle(buildDraft(), state.projectIndex);
    if (!bundle || !bundle.installPlanJson) {
      return setStatus('No install plan was produced.', 'warning');
    }
    const assistant = installAssistant();
    if (!assistant || typeof assistant.loadPlan !== 'function') {
      return setStatus('Install Assistant is not loaded.', 'warning');
    }
    let plan;
    try {
      plan = JSON.parse(bundle.installPlanJson);
    } catch (err) {
      return setStatus('Install plan JSON is invalid: ' + err.message, 'warning');
    }
    assistant.loadPlan(plan, {fileName: (plan.id || 'right-sidebar') + '.install-plan.json'});
    const installButton = document.querySelector('[data-mode="install"]');
    if (installButton) {
      installButton.click();
    }
    const count = bundle.installPlan && Array.isArray(bundle.installPlan.operations)
      ? bundle.installPlan.operations.length : 0;
    setStatus('Sent ' + count + ' operation(s) to Review & Apply (mode: ' +
      (state.model ? state.model.applyMode : 'unknown') + ').', 'ready');
  }

  function downloadPlan() {
    const core = coreApi();
    if (!core || typeof core.buildExportBundle !== 'function') {
      return setStatus('Right Sidebar draft core is not loaded.', 'warning');
    }
    const bundle = core.buildExportBundle(buildDraft(), state.projectIndex);
    if (!bundle || !bundle.installPlanJson) {
      return setStatus('No install plan was produced.', 'warning');
    }
    const blob = new Blob([bundle.installPlanJson], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = (buildDraft().id || 'right-sidebar') + '.install-plan.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function setStatus(message, className) {
    const el = document.getElementById('rsg-status');
    if (!el) {
      return;
    }
    el.textContent = message || '';
    el.classList.remove('ready', 'warning');
    if (className) {
      el.classList.add(className);
    }
  }

  function val(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value || '';
    }
  }

  function esc(value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

})(typeof window !== 'undefined' ? window : globalThis);
