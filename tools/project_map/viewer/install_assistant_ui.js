(function initProjectMapInstallAssistant(global) {
  'use strict';

  const EVENT_NAMES = [
    'project-map:index-loaded',
    'ProjectMap:index-loaded',
    'projectmap:index-loaded',
    'ProjectMapIndexLoaded',
    'ProjectMap:desktop-index-loaded',
    'project-map:model-loaded'
  ];

  const state = {
    plan: null,
    projectRoot: '',
    projectIndex: null,
    lastCheckKey: '',
    lastCheckAllowAdvanced: false,
    lastResult: null,
    runtimePreviewResult: null
  };

  let elements = null;

  const api = {
    loadPlan,
    renderInstallAssistantPlan,
    applyLoadedPlan,
    createRuntimePreview,
    renderResultReport,
    renderRuntimePreviewResult,
    getState: () => ({
      plan: state.plan,
      projectRoot: state.projectRoot,
      projectIndex: state.projectIndex,
      lastCheckKey: state.lastCheckKey,
      lastCheckAllowAdvanced: state.lastCheckAllowAdvanced,
      lastResult: state.lastResult,
      runtimePreviewResult: state.runtimePreviewResult
    })
  };

  global.ProjectMapInstallAssistant = api;

  if (!global || !global.document) {
    return;
  }

  onReady(() => startInstallAssistant(global.document));

  function onReady(callback) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function startInstallAssistant(document) {
    elements = {
      file: document.getElementById('install-plan-file'),
      status: document.getElementById('install-status'),
      projectStatus: document.getElementById('install-project-status'),
      summary: document.getElementById('install-summary'),
      readiness: document.getElementById('install-readiness'),
      checklist: document.getElementById('install-checklist'),
      patchPreview: document.getElementById('install-patch-preview'),
      dryRun: document.getElementById('install-dry-run'),
      apply: document.getElementById('install-apply'),
      runtimePreview: document.getElementById('install-runtime-preview'),
      allowAdvanced: document.getElementById('install-allow-advanced'),
      runtimePreviewResult: document.getElementById('install-runtime-preview-result'),
      result: document.getElementById('install-result')
    };
    if (!elements.file) {
      return;
    }
    bindIndexEvents();
    bindLocaleEvents();
    elements.file.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        readPlanFile(file);
      }
    });
    elements.dryRun.addEventListener('click', () => {
      applyLoadedPlan({
        dryRun: true,
        allowAdvanced: Boolean(elements.allowAdvanced && elements.allowAdvanced.checked)
      });
    });
    elements.apply.addEventListener('click', () => {
      const allowAdvanced = Boolean(elements.allowAdvanced && elements.allowAdvanced.checked);
      const message = allowAdvanced
        ? t('install.confirmAdvanced', 'Apply safe, guarded, and advanced changes? Manual review steps will not be applied.')
        : t('install.confirmApply', 'Apply safe and reviewed guarded changes? Advanced and manual review steps will not be applied.');
      if (global.confirm && !global.confirm(message)) {
        return;
      }
      applyLoadedPlan({dryRun: false, allowAdvanced});
    });
    if (elements.runtimePreview) {
      elements.runtimePreview.addEventListener('click', () => {
        createRuntimePreview({
          allowAdvanced: Boolean(elements.allowAdvanced && elements.allowAdvanced.checked)
        });
      });
    }
    if (elements.allowAdvanced) {
      elements.allowAdvanced.addEventListener('change', () => render());
    }
    render();
  }

  function bindIndexEvents() {
    const handler = (event) => {
      const detail = event.detail || {};
      const index = detail.index || (detail.model && detail.model.index) || null;
      state.projectIndex = index || state.projectIndex || null;
      state.projectRoot = detail.root || (index && index.project && index.project.root) || state.projectRoot || '';
      renderProjectStatus();
    };
    EVENT_NAMES.forEach((name) => {
      global.document.addEventListener(name, handler);
      global.addEventListener(name, handler);
    });
  }

  function bindLocaleEvents() {
    global.document.addEventListener('project-map:locale-changed', () => {
      render();
      if (state.lastResult) {
        setResult(state.lastResult);
      }
      if (state.runtimePreviewResult) {
        setRuntimePreviewResult(state.runtimePreviewResult);
      }
    });
  }

  function readPlanFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadPlan(JSON.parse(String(reader.result || '{}')), {fileName: file.name});
      } catch (err) {
        state.plan = null;
        state.lastResult = null;
        state.runtimePreviewResult = null;
        setStatus(t('install.readPlanFailed', 'Could not read install plan: {message}').replace('{message}', err.message), 'error');
        render();
      }
    };
    reader.onerror = () => {
      setStatus(t('install.readPlanFileFailed', 'Could not read install plan file.'), 'error');
    };
    reader.readAsText(file);
  }

  function loadPlan(plan, meta) {
    state.plan = plan && typeof plan === 'object' ? plan : null;
    const planRoot = installPlanProjectRoot(state.plan);
    if (planRoot) {
      state.projectRoot = planRoot;
    }
    state.lastCheckKey = '';
    state.lastCheckAllowAdvanced = false;
    state.lastResult = null;
    state.runtimePreviewResult = null;
    setStatus(state.plan
      ? t('install.loadedPlan', 'Loaded change plan') + ': ' + ((meta && meta.fileName) || state.plan.id || 'install plan')
      : t('install.noPlan', 'No change plan loaded.'), state.plan ? 'ready' : '');
    render();
    return renderInstallAssistantPlan(state.plan);
  }

  function renderInstallAssistantPlan(plan) {
    const installApi = installPlanApi();
    if (!plan) {
      return {
        summary: emptySummary(),
        checklist: t('install.checklist.noPlan', 'Load an install-plan JSON to review operations.') + '\n',
        patchPreview: ''
      };
    }
    if (!installApi) {
      return {
        summary: emptySummary(),
        checklist: t('install.checklist.helperMissing', 'InstallPlan helper is not loaded.') + '\n',
        patchPreview: ''
      };
    }
    return {
      summary: installApi.operationSummary(plan),
      checklist: installApi.renderOperationChecklist(plan, {locale: currentLocale()}),
      patchPreview: installApi.renderPatchPreview(plan)
    };
  }

  async function applyLoadedPlan(options) {
    const dryRun = !options || options.dryRun !== false;
    const allowAdvanced = Boolean(options && options.allowAdvanced === true);
    if (!state.plan) {
      setResult({ok: false, message: t('install.loadPlanFirst', 'Load an install-plan JSON first.')});
      return state.lastResult;
    }
    const desktop = global.dendryDesktop;
    if (!desktop || typeof desktop.applyInstallPlan !== 'function') {
      setResult({
        ok: false,
        dryRun,
        message: browserReviewOnlyMessage()
      });
      return state.lastResult;
    }
    if (!dryRun && !canApplyReviewed(allowAdvanced)) {
      setResult({
        ok: false,
        dryRun: false,
        allowAdvanced,
        message: t('install.applyNeedsCheck', 'Run a successful check for this plan before applying changes.')
      });
      return state.lastResult;
    }
    setResult({
      ok: true,
      dryRun,
      allowAdvanced,
      message: dryRun ? t('install.report.dryRunStarted', 'Check started...') : t('install.report.applyStarted', 'Applying reviewed changes...')
    });
    try {
      const result = await desktop.applyInstallPlan({
        plan: state.plan,
        projectRoot: activeProjectRoot(),
        dryRun,
        allowAdvanced
      });
      setResult(result);
      rememberDryRunCheck(result, {dryRun, allowAdvanced});
      await refreshProjectIndexAfterApply(result, {dryRun});
      return result;
    } catch (err) {
      setResult({ok: false, dryRun, message: err && err.message ? err.message : String(err)});
      return state.lastResult;
    }
  }

  async function createRuntimePreview(options) {
    const allowAdvanced = Boolean(options && options.allowAdvanced === true);
    const projectRoot = await resolveActiveProjectRoot();
    if (!projectRoot) {
      setRuntimePreviewResult({
        ok: false,
        message: t('install.runtimePreviewNoProject', 'Open or load a Dendry project before creating a runtime preview.')
      });
      return state.runtimePreviewResult;
    }
    const desktop = global.dendryDesktop;
    if (!desktop || typeof desktop.createRuntimePreview !== 'function') {
      setRuntimePreviewResult({
        ok: false,
        message: t('install.runtimePreviewBrowserOnly', 'Runtime Preview is available in the desktop app because it needs a temporary project copy and a local preview server.')
      });
      return state.runtimePreviewResult;
    }
    setRuntimePreviewResult({
      ok: true,
      pending: true,
      allowAdvanced,
      message: t('install.runtimePreviewStarting', 'Creating a temporary baseline and modified preview...')
    });
    try {
      const result = await desktop.createRuntimePreview({
        plan: state.plan || emptyRuntimePreviewPlan(projectRoot),
        projectRoot,
        allowAdvanced,
        projectIndex: state.projectIndex || null
      });
      setRuntimePreviewResult(result);
      return result;
    } catch (err) {
      setRuntimePreviewResult({
        ok: false,
        allowAdvanced,
        message: err && err.message ? err.message : String(err)
      });
      return state.runtimePreviewResult;
    }
  }

  async function refreshProjectIndexAfterApply(result, options) {
    const dryRun = Boolean(options && options.dryRun);
    if (!shouldRefreshProjectIndex(result, dryRun)) {
      return null;
    }
    const desktop = global.dendryDesktop;
    if (!desktop || typeof desktop.scanProject !== 'function') {
      return null;
    }
    const desktopState = desktop && typeof desktop.getState === 'function'
      ? await desktop.getState().catch(() => null)
      : null;
    const lastProject = desktopState && desktopState.lastProject ? desktopState.lastProject : {};
    const root = state.projectRoot || installPlanProjectRoot(state.plan) || lastProject.root || '';
    if (!root) {
      setStatus(t('install.refreshMissingProject', 'Changes were applied, but Studio could not find the project root to refresh Explore and Design.'), 'error');
      return null;
    }
    setStatus(t('install.refreshingIndex', 'Changes applied. Refreshing ProjectIndex for Explore and Design...'), 'ready');
    try {
      const refresh = await desktop.scanProject({
        root,
        includeExcerpts: Boolean(lastProject && lastProject.includeExcerpts)
      });
      if (!refresh || !refresh.ok) {
        const message = refresh && (refresh.message || (refresh.error && refresh.error.message))
          ? (refresh.message || refresh.error.message)
          : 'Unknown refresh error.';
        setStatus(t('install.refreshFailed', 'Changes were applied, but ProjectIndex refresh failed: {message}').replace('{message}', message), 'error');
        return refresh || null;
      }
      setStatus(t('install.refreshComplete', 'Changes applied and ProjectIndex refreshed.'), 'ready');
      return refresh;
    } catch (err) {
      const message = err && err.message ? err.message : String(err);
      setStatus(t('install.refreshFailed', 'Changes were applied, but ProjectIndex refresh failed: {message}').replace('{message}', message), 'error');
      return null;
    }
  }

  function shouldRefreshProjectIndex(result, dryRun) {
    if (dryRun || !result || result.dryRun) {
      return false;
    }
    const results = Array.isArray(result.results) ? result.results : [];
    return results.some((item) => item && (item.status === 'applied' || item.status === 'already_applied'));
  }

  function installPlanProjectRoot(plan) {
    return plan && plan.project && typeof plan.project.root === 'string'
      ? plan.project.root.trim()
      : '';
  }

  function activeProjectRoot() {
    return state.projectRoot || installPlanProjectRoot(state.plan);
  }

  async function resolveActiveProjectRoot() {
    const root = activeProjectRoot();
    if (root) {
      return root;
    }
    const desktop = global.dendryDesktop;
    if (!desktop || typeof desktop.getState !== 'function') {
      return '';
    }
    const desktopState = await desktop.getState().catch(() => null);
    const lastProject = desktopState && desktopState.lastProject ? desktopState.lastProject : {};
    const lastRoot = typeof lastProject.root === 'string' ? lastProject.root.trim() : '';
    if (lastRoot) {
      state.projectRoot = lastRoot;
    }
    return lastRoot;
  }

  function emptyRuntimePreviewPlan(projectRoot) {
    return {
      schemaVersion: '0.1',
      kind: 'dendry_mod_studio_install_plan',
      id: 'runtime_preview_current_project',
      draftKind: 'runtime_preview',
      title: t('install.runtimePreviewBareTitle', 'Current project preview'),
      status: 'proposal_only',
      project: {root: projectRoot},
      operations: []
    };
  }

  function render() {
    if (!elements) {
      return;
    }
    renderProjectStatus();
    const rendered = renderInstallAssistantPlan(state.plan);
    elements.summary.innerHTML = renderSummary(rendered.summary);
    if (elements.readiness) {
      elements.readiness.innerHTML = renderReadiness(rendered.summary);
    }
    elements.checklist.innerHTML = renderHumanChecklist(state.plan, rendered.summary);
    elements.patchPreview.textContent = rendered.patchPreview || t('install.patchPreview.empty', '(no patch preview)');
    elements.dryRun.disabled = !state.plan || !global.dendryDesktop;
    elements.apply.disabled = !canApplyReviewed(Boolean(elements.allowAdvanced && elements.allowAdvanced.checked));
    if (elements.runtimePreview) {
      elements.runtimePreview.disabled = !global.dendryDesktop;
    }
    if (elements.runtimePreviewResult) {
      elements.runtimePreviewResult.innerHTML = renderRuntimePreviewResult(state.runtimePreviewResult);
    }
    if (!state.lastResult) {
      elements.result.textContent = global.dendryDesktop
        ? t('install.result.emptyDesktop', 'Load a change plan, then run a check before applying changes.')
        : browserReviewOnlyMessage();
    }
  }

  function renderSummary(summary) {
    const values = [
      [t('install.human.safeApply', 'Safe to apply'), summary.safeApply || 0, 'safe'],
      [t('install.human.guardedApply', 'Check then apply'), summary.guardedApply || 0, 'guarded'],
      [t('install.human.advancedApply', 'Advanced opt-in'), summary.advancedApply || 0, 'advanced'],
      [t('install.human.manualReview', 'Manual steps'), summary.manualReview || 0, 'manual'],
      [t('install.human.refused', 'Protected'), summary.refused || 0, 'refused'],
      [t('install.human.total', 'Total changes'), summary.total || 0, 'total']
    ];
    return values.map(([label, value, kind]) => {
      return '<div class="install-summary-card install-summary-' + escapeHtml(kind) + '"><span class="install-summary-value">' +
        escapeHtml(value) + '</span><span class="install-summary-label">' + escapeHtml(label) + '</span></div>';
    }).join('');
  }

  function renderReadiness(summary) {
    if (!state.plan) {
      return [
        '<div class="install-readiness-card">',
        '<strong>' + escapeHtml(t('install.finishMod', 'Finish this mod')) + '</strong>',
        '<p>' + escapeHtml(t('install.readiness.noPlan', 'Load a change plan to see what Studio can apply and what still needs manual review.')) + '</p>',
        '</div>'
      ].join('');
    }
    const safe = summary.safeApply || 0;
    const guarded = summary.guardedApply || 0;
    const advanced = summary.advancedApply || 0;
    const manual = summary.manualReview || 0;
    const refused = summary.refused || 0;
    const allowAdvanced = Boolean(elements && elements.allowAdvanced && elements.allowAdvanced.checked);
    const autoApplyAvailable = Boolean(safe || guarded || (allowAdvanced && advanced));
    const checked = canApplyReviewed(allowAdvanced);
    const status = refused
      ? t('install.readiness.blocked', 'Some changes are protected and will not be applied.')
      : advanced
        ? t('install.readiness.advanced', 'Some changes need explicit advanced opt-in.')
        : manual
        ? t('install.readiness.manual', 'Playable after you complete the manual steps.')
        : guarded
          ? checked
            ? t('install.readiness.checked', 'Check passed. Studio can apply the reviewed changes.')
            : t('install.readiness.guarded', 'Run a check, then Studio can apply the reviewed changes.')
          : safe
            ? checked
              ? t('install.readiness.checked', 'Check passed. Studio can apply the reviewed changes.')
              : t('install.readiness.safe', 'Ready to apply safe changes.')
            : t('install.readiness.none', 'No installable changes in this plan.');
    const steps = [
      autoApplyAvailable
        ? checked ? t('install.readiness.checkPassed', 'Latest check matches this plan.') : t('install.readiness.checkNeeded', 'Run check before applying.')
        : t('install.readiness.noCheckNeeded', 'No automatic apply step is available.'),
      safe ? t('install.readiness.safeCount', 'Safe changes') + ': ' + safe : t('install.readiness.noSafe', 'No safe one-click changes.'),
      guarded ? t('install.readiness.guardedCount', 'Reviewed changes') + ': ' + guarded : t('install.readiness.noGuarded', 'No guarded changes.'),
      advanced ? t('install.readiness.advancedCount', 'Advanced changes') + ': ' + advanced : t('install.readiness.noAdvanced', 'No advanced changes.'),
      manual ? t('install.readiness.manualCount', 'Manual steps') + ': ' + manual : t('install.readiness.noManual', 'No manual steps remain.'),
      refused ? t('install.readiness.refusedCount', 'Protected changes') + ': ' + refused : t('install.readiness.noRefused', 'No protected changes.')
    ];
    return [
      '<div class="install-readiness-card">',
      '<strong>' + escapeHtml(t('install.finishMod', 'Finish this mod')) + '</strong>',
      '<p>' + escapeHtml(status) + '</p>',
      '<ul>',
      steps.map((step) => '<li>' + escapeHtml(step) + '</li>').join(''),
      '</ul>',
      '</div>'
    ].join('');
  }

  function renderHumanChecklist(plan, summary) {
    if (!plan) {
      return [
        '<div class="install-empty-help">',
        '<strong>' + escapeHtml(t('install.human.noPlanTitle', 'No change plan loaded')) + '</strong>',
        '<p>' + escapeHtml(t('install.human.noPlanBody', 'Send a draft from Create, or load an install-plan JSON to review changes here.')) + '</p>',
        '</div>'
      ].join('');
    }
    const installApi = installPlanApi();
    const operations = Array.isArray(plan.operations) ? plan.operations : [];
    const classifications = operations.map((operation) => installApi && typeof installApi.classifyOperation === 'function'
      ? installApi.classifyOperation(operation)
      : {status: operation.safety || 'manual_review', reason: operation.description || '', operation});
    const groups = [
      ['safe_apply', t('install.human.safeApply', 'Safe to apply'), t('install.human.safeHelp', 'Studio can create or replace this directly after a check.')],
      ['guarded_apply', t('install.human.guardedApply', 'Check then apply'), t('install.human.guardedHelp', 'Studio can apply this if the original text still matches.')],
      ['advanced_apply', t('install.human.advancedApply', 'Advanced opt-in'), t('install.human.advancedHelp', 'This touches a sensitive area and needs explicit advanced consent.')],
      ['manual_review', t('install.human.manualReview', 'Manual steps'), t('install.human.manualHelp', 'Studio will guide you, but it will not edit this automatically.')],
      ['refused', t('install.human.refused', 'Protected'), t('install.human.refusedHelp', 'Studio will not apply this operation. Rewrite it or handle it outside the app.')]
    ];
    return [
      '<div class="install-human-intro">',
      '<strong>' + escapeHtml(t('install.human.title', 'What this will change')) + '</strong>',
      '<span>' + escapeHtml((summary && summary.total || operations.length || 0) + ' ' + t('install.human.changeCount', 'change(s) in this plan')) + '</span>',
      '</div>',
      groups.map(([status, title, help]) => renderHumanGroup(status, title, help, classifications.filter((item) => item.status === status))).join('')
    ].join('');
  }

  function renderHumanGroup(status, title, help, rows) {
    return [
      '<section class="install-human-group install-human-' + escapeHtml(status.replace(/_/g, '-')) + '">',
      '<header><strong>' + escapeHtml(title) + '</strong><span>' + rows.length + '</span></header>',
      '<p>' + escapeHtml(help) + '</p>',
      rows.length ? '<div class="install-human-ops">' + rows.map(renderHumanOperation).join('') + '</div>' : '<div class="install-human-none">' + escapeHtml(t('install.human.none', 'None')) + '</div>',
      '</section>'
    ].join('');
  }

  function renderHumanOperation(item) {
    const op = item.operation || {};
    const reason = operationReason(item, op);
    return [
      '<article class="install-human-op">',
      '<strong>' + escapeHtml(operationActionLabel(op)) + '</strong>',
      reason ? '<p>' + escapeHtml(reason) + '</p>' : '',
      '<details>',
      '<summary>' + escapeHtml(t('install.human.advancedDetails', 'Advanced details')) + '</summary>',
      '<code>' + escapeHtml([op.type || t('install.action.operation', 'operation'), op.path || t('install.unknownPath', '(unknown path)')].join(' · ')) + '</code>',
      '</details>',
      '</article>'
    ].join('');
  }

  function operationReason(item, operation) {
    const installApi = installPlanApi();
    if (installApi && typeof installApi.operationReason === 'function') {
      return installApi.operationReason(operation || {}, item || {}, {locale: currentLocale()});
    }
    return item && item.reason || operation && operation.description || '';
  }

  function operationActionLabel(operation) {
    const type = operation && operation.type;
    if (type === 'create_file') {
      return t('install.action.createFile', 'Create a new source file');
    }
    if (type === 'replace_text') {
      return t('install.action.replaceText', 'Replace player-facing text');
    }
    if (type === 'replace_section') {
      return t('install.action.replaceSection', 'Replace a source section');
    }
    if (type === 'insert_text') {
      return t('install.action.insertText', 'Insert source text');
    }
    if (type === 'manual_snippet') {
      return t('install.action.manualSnippet', 'Copy a manual snippet');
    }
    if (type === 'copy_asset_file') {
      return t('install.action.copyAssetFile', 'Copy an asset file');
    }
    return t('install.action.reviewOperation', 'Review this change');
  }

  function renderProjectStatus() {
    if (!elements || !elements.projectStatus) {
      return;
    }
    elements.projectStatus.textContent = state.projectRoot
      ? t('install.projectRoot', 'Project root') + ': ' + state.projectRoot
      : t('install.projectMissing', 'Open or load a project index first.');
  }

  function setStatus(message, kind) {
    if (!elements || !elements.status) {
      return;
    }
    elements.status.textContent = message;
    elements.status.classList.toggle('is-ready', kind === 'ready');
    elements.status.classList.toggle('is-error', kind === 'error');
  }

  function setResult(result) {
    state.lastResult = result || null;
    if (!elements || !elements.result) {
      return;
    }
    elements.result.textContent = renderResultReport(result);
  }

  function rememberDryRunCheck(result, options) {
    const dryRun = Boolean(options && options.dryRun);
    if (!dryRun) {
      return;
    }
    const ok = result && result.ok && !resultHasFailures(result);
    state.lastCheckKey = ok ? planFingerprint(state.plan) : '';
    state.lastCheckAllowAdvanced = ok && Boolean(options && options.allowAdvanced);
  }

  function canApplyReviewed(allowAdvanced) {
    if (!state.plan || !global.dendryDesktop) {
      return false;
    }
    if (!hasAutoApplyOperations(state.plan, allowAdvanced)) {
      return false;
    }
    const advancedMatches = !hasAdvancedApplyOperations(state.plan) || state.lastCheckAllowAdvanced === Boolean(allowAdvanced);
    return Boolean(state.lastCheckKey && state.lastCheckKey === planFingerprint(state.plan) && advancedMatches);
  }

  function hasAutoApplyOperations(plan, allowAdvanced) {
    const summary = operationSummaryForPlan(plan);
    return Boolean(summary.safeApply || summary.guardedApply || (allowAdvanced && summary.advancedApply));
  }

  function hasAdvancedApplyOperations(plan) {
    const summary = operationSummaryForPlan(plan);
    return Boolean(summary.advancedApply);
  }

  function operationSummaryForPlan(plan) {
    const installApi = installPlanApi();
    if (installApi && typeof installApi.operationSummary === 'function') {
      return installApi.operationSummary(plan) || {};
    }
    const summary = {safeApply: 0, guardedApply: 0, advancedApply: 0};
    const operations = Array.isArray(plan && plan.operations) ? plan.operations : [];
    operations.forEach((operation) => {
      const safety = operation && operation.safety;
      if (safety === 'safe_apply') {
        summary.safeApply += 1;
      } else if (safety === 'guarded_apply') {
        summary.guardedApply += 1;
      } else if (safety === 'advanced_apply') {
        summary.advancedApply += 1;
      }
    });
    return summary;
  }

  function resultHasFailures(result) {
    const rows = Array.isArray(result && result.results) ? result.results : [];
    return rows.some((item) => item && item.status === 'failed');
  }

  function planFingerprint(plan) {
    return stableJson(plan || {});
  }

  function stableJson(value) {
    if (Array.isArray(value)) {
      return '[' + value.map(stableJson).join(',') + ']';
    }
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}';
    }
    return JSON.stringify(value === undefined ? null : value);
  }

  function setRuntimePreviewResult(result) {
    state.runtimePreviewResult = result || null;
    if (!elements || !elements.runtimePreviewResult) {
      return;
    }
    elements.runtimePreviewResult.innerHTML = renderRuntimePreviewResult(result);
  }

  function renderRuntimePreviewResult(result) {
    if (!global.dendryDesktop) {
      return '<div class="runtime-preview-empty">' + escapeHtml(t('install.runtimePreviewBrowserOnly', 'Runtime Preview is available in the desktop app because it needs a temporary project copy and a local preview server.')) + '</div>';
    }
    if (!result) {
      return '<div class="runtime-preview-empty">' + escapeHtml(t('install.runtimePreviewEmpty', 'Create a runtime preview to compare the original project against this proposal in a temporary sandbox.')) + '</div>';
    }
    const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics : [];
    const status = result.pending
      ? t('install.runtimePreviewStarting', 'Creating a temporary baseline and modified preview...')
      : result.ok
        ? t('install.runtimePreviewReady', 'Runtime preview is ready.')
        : t('install.runtimePreviewFailed', 'Runtime preview could not be created.');
    const message = result.message || (result.ok && result.installResult && result.installResult.ok === false
      ? t('install.runtimePreviewReadyWithInstallWarnings', 'Runtime preview was created, but some proposed changes could not be applied to the temporary modified copy. Check diagnostics below.')
      : '');
    const links = [
      result.compareUrl ? ['install.runtimePreviewOpenCompare', t('install.runtimePreviewOpenCompare', 'Open comparison'), result.compareUrl] : null,
      result.baselineUrl ? ['install.runtimePreviewOpenBaseline', t('install.runtimePreviewOpenBaseline', 'Open original'), result.baselineUrl] : null,
      result.modifiedUrl ? ['install.runtimePreviewOpenModified', t('install.runtimePreviewOpenModified', 'Open modified'), result.modifiedUrl] : null
    ].filter(Boolean);
    return [
      '<article class="runtime-preview-card ' + (result.ok ? 'is-ready' : 'is-error') + '">',
      '<header><strong>' + escapeHtml(status) + '</strong>' + (result.sessionId ? '<span>' + escapeHtml(result.sessionId) + '</span>' : '') + '</header>',
      message ? '<p>' + escapeHtml(message) + '</p>' : '',
      links.length ? '<div class="runtime-preview-links">' + links.map((item) => {
        return '<a href="' + escapeHtml(item[2]) + '" target="_blank" rel="noopener">' + escapeHtml(item[1]) + '</a>';
      }).join('') + '</div>' : '',
      renderRuntimePreviewBuilds(result),
      diagnostics.length ? '<details class="runtime-preview-diagnostics"><summary>' + escapeHtml(t('install.runtimePreviewDiagnostics', 'Diagnostics')) + '</summary><ul>' +
        diagnostics.slice(0, 12).map((diag) => '<li>' + escapeHtml([(diag.severity || 'info'), (diag.code || 'diagnostic'), (diag.message || '')].join(' · ')) + '</li>').join('') +
        '</ul></details>' : '',
      '</article>'
    ].join('');
  }

  function renderRuntimePreviewBuilds(result) {
    const rows = [
      [t('install.runtimePreviewBaseline', 'Original'), result && result.baselineBuild],
      [t('install.runtimePreviewModified', 'Modified'), result && result.modifiedBuild]
    ].filter((item) => item[1]);
    if (!rows.length) {
      return '';
    }
    return '<div class="runtime-preview-builds">' + rows.map((item) => {
      const build = item[1] || {};
      const label = build.ok ? t('install.runtimePreviewBuildOk', 'build ok') : t('install.runtimePreviewBuildFailed', 'build failed');
      return '<div><strong>' + escapeHtml(item[0]) + '</strong><span>' + escapeHtml(label) + '</span><code>' + escapeHtml(build.command || '') + '</code></div>';
    }).join('') + '</div>';
  }

  function renderResultReport(result) {
    if (!result) {
      return '';
    }
    const lines = [];
    const results = Array.isArray(result.results) ? result.results : [];
    lines.push(result.ok ? t('install.report.ok', 'Install check completed.') : t('install.report.needsAttention', 'Install check needs attention.'));
    lines.push((result.dryRun ? t('install.report.dryRun', 'Mode: dry-run') : t('install.report.apply', 'Mode: apply')) +
      (result.allowAdvanced ? ' · ' + t('install.report.advancedOn', 'advanced opt-in enabled') : ''));
    if (result.message) {
      lines.push(String(result.message));
    }
    lines.push('');
    lines.push(t('install.report.results', 'Results'));
    const grouped = groupResults(results);
    ['applied', 'already_applied', 'would_apply', 'advanced_review', 'manual_review', 'failed'].forEach((status) => {
      const rows = grouped.get(status) || [];
      lines.push('- ' + statusLabel(status) + ': ' + rows.length);
      rows.slice(0, 12).forEach((row) => {
        lines.push('  - ' + [row.id || row.type || 'operation', row.path || ''].filter(Boolean).join(' · '));
      });
    });
    const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics : [];
    if (diagnostics.length) {
      lines.push('');
      lines.push(t('install.report.diagnostics', 'Diagnostics'));
      diagnostics.slice(0, 12).forEach((diag) => {
        lines.push('- ' + (diag.severity || 'info') + ' · ' + (diag.code || 'diagnostic') + ': ' + (diag.message || ''));
      });
    }
    const rollback = rollbackNotes(results);
    if (rollback.length) {
      lines.push('');
      lines.push(t('install.report.rollback', 'Rollback notes'));
      rollback.forEach((note) => lines.push('- ' + note));
    }
    if (!results.length && !diagnostics.length && result.message) {
      lines.push('');
      lines.push(t('install.report.noOperations', 'No install operations were run.'));
    }
    return lines.join('\n');
  }

  function groupResults(results) {
    const map = new Map();
    results.forEach((result) => {
      const status = result && result.status ? result.status : 'unknown';
      if (!map.has(status)) {
        map.set(status, []);
      }
      map.get(status).push(result);
    });
    return map;
  }

  function statusLabel(status) {
    return {
      applied: t('install.report.appliedHuman', 'Applied'),
      already_applied: t('install.report.alreadyAppliedHuman', 'Already applied'),
      would_apply: t('install.report.wouldApplyHuman', 'Check passed, not applied yet'),
      advanced_review: t('install.report.advancedReviewHuman', 'Waiting for advanced opt-in'),
      manual_review: t('install.report.manualReviewHuman', 'Manual step'),
      failed: t('install.report.failedHuman', 'Needs attention')
    }[status] || status;
  }

  function rollbackNotes(results) {
    const operations = new Map();
    if (state.plan && Array.isArray(state.plan.operations)) {
      state.plan.operations.forEach((operation) => {
        if (operation && operation.id) {
          operations.set(operation.id, operation);
        }
      });
    }
    return results
      .filter((result) => result && (result.status === 'applied' || result.status === 'would_apply'))
      .map((result) => {
        const operation = operations.get(result.id) || {};
        if (operation.type === 'create_file') {
          return (result.status === 'would_apply' ? t('install.report.wouldDelete', 'Would undo by deleting') : t('install.report.delete', 'Undo by deleting')) +
            ' ' + (operation.path || result.path || '');
        }
        if (operation.type === 'replace_text') {
          return (result.status === 'would_apply' ? t('install.report.wouldRestore', 'Would undo by restoring original text in') : t('install.report.restore', 'Undo by restoring original text in')) +
            ' ' + (operation.path || result.path || '') + ': "' + shorten(operation.replace || '') + '" -> "' + shorten(operation.search || '') + '"';
        }
        return '';
      })
      .filter(Boolean);
  }

  function installPlanApi() {
    return global.ProjectMapInstallPlan || null;
  }

  function studioContracts() {
    return global.ProjectMapStudioContracts || null;
  }

  function browserReviewOnlyMessage() {
    const contracts = studioContracts();
    return contracts && typeof contracts.browserReviewOnlyMessage === 'function'
      ? contracts.browserReviewOnlyMessage(t)
      : t('install.browserReviewOnly', 'Browser mode can review change plans. Use the desktop app to apply changes.');
  }

  function emptySummary() {
    return {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 0, refused: 0, total: 0};
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function shorten(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > 80 ? text.slice(0, 77) + '...' : text;
  }

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function currentLocale() {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.getLocale === 'function' ? i18n.getLocale() : 'en';
  }
})(typeof window !== 'undefined' ? window : globalThis);
