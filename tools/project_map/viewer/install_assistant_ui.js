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
    postApplyVerification: null,
    runtimePreviewResult: null,
    runtimePreviewSuspended: false
  };

  let elements = null;

  const api = {
    loadPlan,
    renderInstallAssistantPlan,
    buildReviewApplyReadiness,
    buildReviewApplyUiState,
    applyLoadedPlan,
    createRuntimePreview,
    endRuntimePreview,
    renderResultReport,
    renderRuntimePreviewResult,
    getState: () => ({
      plan: state.plan,
      projectRoot: state.projectRoot,
      projectIndex: state.projectIndex,
      lastCheckKey: state.lastCheckKey,
      lastCheckAllowAdvanced: state.lastCheckAllowAdvanced,
      lastResult: state.lastResult,
      postApplyVerification: state.postApplyVerification,
      runtimePreviewResult: state.runtimePreviewResult,
      runtimePreviewSuspended: state.runtimePreviewSuspended
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
      verifiedDiff: document.getElementById('install-verified-diff'),
      dryRun: document.getElementById('install-dry-run'),
      apply: document.getElementById('install-apply'),
      runtimePreview: document.getElementById('install-runtime-preview'),
      downloadEvidence: document.getElementById('install-download-evidence'),
      downloadVerifiedDiff: document.getElementById('install-download-verified-diff'),
      allowAdvanced: document.getElementById('install-allow-advanced'),
      runtimePreviewResult: document.getElementById('install-runtime-preview-result'),
      result: document.getElementById('install-result')
    };
    if (!elements.file) {
      return;
    }
    bindIndexEvents();
    bindLocaleEvents();
    bindRuntimeLifecycle(document);
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
    if (elements.downloadEvidence) {
      elements.downloadEvidence.addEventListener('click', downloadEvidenceBundle);
    }
    if (elements.downloadVerifiedDiff) {
      elements.downloadVerifiedDiff.addEventListener('click', downloadVerifiedDiff);
    }
    if (elements.runtimePreviewResult) {
      elements.runtimePreviewResult.addEventListener('click', (event) => {
        const button = event.target && event.target.closest && event.target.closest('[data-runtime-preview-action]');
        if (!button) {
          return;
        }
        if (button.dataset.runtimePreviewAction === 'end') {
          endRuntimePreview();
        }
      });
    }
    if (elements.allowAdvanced) {
      elements.allowAdvanced.addEventListener('change', () => {
        if (elements.allowAdvanced.checked && !confirmEnableAdvanced()) {
          elements.allowAdvanced.checked = false;
        }
        render();
      });
    }
    render();
  }

  function confirmEnableAdvanced() {
    if (!global.confirm) {
      return true;
    }
    return global.confirm(t('install.confirmEnableAdvanced', 'Open advanced operations? Advanced operations may touch protected routers, root setup, generated wiring, or other sensitive source areas. Learn and enable Git version control for your target repo before using this.'));
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

  function bindRuntimeLifecycle(document) {
    document.addEventListener('ProjectMap:mode-changing', (event) => {
      const detail = event && event.detail || {};
      if (detail.previousMode === 'install' && detail.nextMode !== 'install') {
        suspendRuntimePreview('mode');
      }
    });
    document.addEventListener('ProjectMap:foreground-changed', (event) => {
      const detail = event && event.detail || {};
      if (detail.visible === false && document.body && document.body.dataset.mode === 'install') {
        suspendRuntimePreview('background');
      }
    });
  }

  function suspendRuntimePreview(_reason) {
    if (state.runtimePreviewResult && state.runtimePreviewResult.ok) {
      state.runtimePreviewSuspended = true;
    }
    removeRuntimePreviewFrames();
    if (elements && elements.runtimePreviewResult && state.runtimePreviewResult) {
      elements.runtimePreviewResult.innerHTML = renderRuntimePreviewResult(state.runtimePreviewResult);
    }
  }

  function removeRuntimePreviewFrames() {
    if (!elements || !elements.runtimePreviewResult || !elements.runtimePreviewResult.querySelectorAll) {
      return;
    }
    elements.runtimePreviewResult.querySelectorAll('[data-runtime-preview-frame]').forEach((frame) => {
      frame.setAttribute('src', 'about:blank');
      if (frame.parentNode) {
        frame.parentNode.removeChild(frame);
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
        state.postApplyVerification = null;
        state.runtimePreviewResult = null;
        state.runtimePreviewSuspended = false;
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
    state.postApplyVerification = null;
    state.runtimePreviewResult = null;
    state.runtimePreviewSuspended = false;
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
    state.postApplyVerification = null;
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
        allowAdvanced,
        includeEvidence: true
      });
      let finalResult = result;
      rememberDryRunCheck(result, {dryRun, allowAdvanced});
      if (!dryRun) {
        const verification = await verifyPostApply(result, {allowAdvanced});
        state.postApplyVerification = verification;
        finalResult = Object.assign({}, result, {postApplyVerification: verification});
      } else {
        state.postApplyVerification = null;
      }
      setResult(finalResult);
      render();
      await refreshProjectIndexAfterApply(finalResult, {dryRun});
      return finalResult;
    } catch (err) {
      setResult({ok: false, dryRun, message: err && err.message ? err.message : String(err)});
      return state.lastResult;
    }
  }

  async function verifyPostApply(applyResult, options) {
    if (!shouldRunPostApplyVerification(applyResult)) {
      return null;
    }
    const desktop = global.dendryDesktop;
    if (!desktop || typeof desktop.applyInstallPlan !== 'function') {
      return null;
    }
    try {
      return await desktop.applyInstallPlan({
        plan: state.plan,
        projectRoot: activeProjectRoot(),
        dryRun: true,
        allowAdvanced: Boolean(options && options.allowAdvanced),
        includeEvidence: true
      });
    } catch (err) {
      return {
        ok: false,
        dryRun: true,
        message: err && err.message ? err.message : String(err),
        results: [],
        diagnostics: []
      };
    }
  }

  function shouldRunPostApplyVerification(result) {
    if (!result || result.dryRun || !result.ok) {
      return false;
    }
    const rows = Array.isArray(result.results) ? result.results : [];
    return rows.some((item) => item && (item.status === 'applied' || item.status === 'already_applied'));
  }

  async function createRuntimePreview(options) {
    const allowAdvanced = Boolean(options && options.allowAdvanced === true);
    const projectRoot = await resolveActiveProjectRoot();
    if (!projectRoot) {
      state.runtimePreviewSuspended = false;
      setRuntimePreviewResult({
        ok: false,
        message: t('install.runtimePreviewNoProject', 'Open or load a Dendry project before creating a runtime preview.')
      });
      return state.runtimePreviewResult;
    }
    const desktop = global.dendryDesktop;
    if (!desktop || typeof desktop.createRuntimePreview !== 'function') {
      state.runtimePreviewSuspended = false;
      setRuntimePreviewResult({
        ok: false,
        message: t('install.runtimePreviewBrowserOnly', 'Runtime Preview is available in the desktop app because it needs a temporary project copy and a local preview server.')
      });
      return state.runtimePreviewResult;
    }
    state.runtimePreviewSuspended = false;
    setRuntimePreviewResult({
      ok: true,
      pending: true,
      allowAdvanced,
      progressStage: 'full-build',
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

  async function endRuntimePreview() {
    const previous = state.runtimePreviewResult;
    if (!previous) {
      return null;
    }
    removeRuntimePreviewFrames();
    const desktop = global.dendryDesktop;
    let closeResult = null;
    if (desktop && typeof desktop.closeRuntimePreview === 'function') {
      try {
        closeResult = await desktop.closeRuntimePreview({});
      } catch (err) {
        closeResult = {
          ok: false,
          message: err && err.message ? err.message : String(err)
        };
      }
    }
    state.runtimePreviewSuspended = false;
    setRuntimePreviewResult(Object.assign({}, previous, {
      pending: false,
      ended: true,
      closeResult,
      message: closeResult && closeResult.ok === false
        ? t('install.runtimePreviewEndFailed', 'Studio removed the inline preview, but could not close the local preview server.')
        : t('install.runtimePreviewEnded', 'Runtime preview ended. Create a new preview when you want to inspect the sandbox again.')
    }));
    return state.runtimePreviewResult;
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
    if (elements.verifiedDiff) {
      elements.verifiedDiff.textContent = verifiedDiffText();
    }
    elements.dryRun.disabled = !state.plan || !global.dendryDesktop;
    elements.apply.disabled = !canApplyReviewed(Boolean(elements.allowAdvanced && elements.allowAdvanced.checked));
    if (elements.downloadEvidence) {
      elements.downloadEvidence.disabled = !hasEvidenceBundle();
    }
    if (elements.downloadVerifiedDiff) {
      elements.downloadVerifiedDiff.disabled = !currentVerifiedDiff();
    }
    if (elements.runtimePreview) {
      elements.runtimePreview.disabled = !global.dendryDesktop || Boolean(state.runtimePreviewResult && state.runtimePreviewResult.pending);
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

  function verifiedDiffText() {
    if (!state.plan) {
      return t('install.verifiedDiff.noPlan', 'Load a change plan to see a verified diff after dry-run.');
    }
    if (!global.dendryDesktop) {
      return t('install.verifiedDiff.desktopOnly', 'Verified diffs need the desktop app because Studio must read the current project files.');
    }
    const diff = currentVerifiedDiff();
    return diff || t('install.verifiedDiff.runCheck', 'Run dry-run to verify this plan against the current project files.');
  }

  function currentVerifiedDiff() {
    if (state.lastResult && state.lastResult.verifiedDiff) {
      return state.lastResult.verifiedDiff;
    }
    if (state.postApplyVerification && state.postApplyVerification.verifiedDiff) {
      return state.postApplyVerification.verifiedDiff;
    }
    return '';
  }

  function hasEvidenceBundle() {
    return Boolean(state.lastResult && (
      state.lastResult.verifiedDiff ||
      Array.isArray(state.lastResult.changedFiles) ||
      Array.isArray(state.lastResult.results)
    ));
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
    const viewState = buildReviewApplyUiState(summary);
    const status = renderReadinessStatus(viewState);
    const steps = viewState.steps.map(renderReadinessStep);
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
    const reviewApi = global.ProjectMapInstallReviewUi;
    const allowAdvanced = currentAllowAdvanced();
    const viewState = buildReviewApplyUiState(summary, allowAdvanced);
    if (reviewApi && typeof reviewApi.renderPlanReview === 'function') {
      return reviewApi.renderPlanReview({
        plan,
        summary,
        result: state.lastResult,
        readiness: viewState.readiness,
        installApi: installPlanApi(),
        locale: currentLocale(),
        t
      });
    }
    if (!plan) {
      return [
        '<div class="install-empty-help">',
        '<strong>' + escapeHtml(t('install.human.noPlanTitle', 'No change plan loaded')) + '</strong>',
        '<p>' + escapeHtml(t('install.human.noPlanBody', 'Send a draft from Create, or load an install-plan JSON to review changes here.')) + '</p>',
        '</div>'
      ].join('');
    }
    return [
      '<div class="install-human-intro">',
      '<strong>' + escapeHtml(t('install.human.title', 'What this will change')) + '</strong>',
      '<span>' + escapeHtml((summary && summary.total || 0) + ' ' + t('install.human.changeCount', 'change(s) in this plan')) + '</span>',
      '</div>'
    ].join('');
  }

  function currentAllowAdvanced() {
    return Boolean(elements && elements.allowAdvanced && elements.allowAdvanced.checked);
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
    return buildReviewApplyUiState(operationSummaryForPlan(state.plan), allowAdvanced).readiness.canApply === true;
  }

  function operationSummaryForPlan(plan) {
    const installApi = installPlanApi();
    if (installApi && typeof installApi.operationSummary === 'function') {
      return installApi.operationSummary(plan) || {};
    }
    const contracts = installOperationContractsApi();
    if (contracts && typeof contracts.summarizeInstallOperations === 'function') {
      return contracts.summarizeInstallOperations(plan);
    }
    return emptySummary();
  }

  function buildReviewApplyReadiness(plan, options) {
    const summary = operationSummaryForPlan(plan);
    const checked = Boolean(options && options.checked);
    return reviewApplyReadinessForSummary(summary, checked, Boolean(options && options.allowAdvanced));
  }

  function reviewApplyReadiness(summary, allowAdvanced) {
    return reviewApplyReadinessForSummary(summary, currentCheckMatches(allowAdvanced), allowAdvanced);
  }

  function reviewApplyReadinessForSummary(summary, checked, allowAdvanced) {
    const reviewStateApi = installReviewStateApi();
    if (reviewStateApi && typeof reviewStateApi.buildReviewApplyReadiness === 'function') {
      return reviewStateApi.buildReviewApplyReadiness(summary || emptySummary(), checked, allowAdvanced, installOperationContractsApi());
    }
    const value = summary || emptySummary();
    return {
      canApply: false,
      checked: checked === true,
      needsCheck: false,
      needsAdvancedConsent: false,
      manualReviewCount: Number(value.manualReview || 0),
      refusedCount: Number(value.refused || 0),
      automaticOperationCount: Number(value.safeApply || 0) + Number(value.guardedApply || 0) + Number(value.advancedApply || 0),
      eligibleAutomaticOperationCount: 0,
      skippedAdvancedOperationCount: Number(value.advancedApply || 0)
    };
  }

  function buildReviewApplyUiState(summary, allowAdvanced) {
    const advancedAllowed = allowAdvanced === undefined ? currentAllowAdvanced() : Boolean(allowAdvanced);
    const readiness = reviewApplyReadiness(summary, advancedAllowed);
    const reviewStateApi = installReviewStateApi();
    if (reviewStateApi && typeof reviewStateApi.buildReviewApplyUiState === 'function') {
      return reviewStateApi.buildReviewApplyUiState({
        summary,
        readiness,
        lastResult: state.lastResult,
        postApplyVerification: state.postApplyVerification
      });
    }
    return {
      summary: summary || emptySummary(),
      readiness,
      autoApplyAvailable: false,
      checked: false,
      failedResult: null,
      postApply: null,
      statusKind: 'none',
      steps: []
    };
  }

  function renderReadinessStatus(viewState) {
    const labels = {
      applied_needs_verification: t('install.readiness.appliedNeedsVerification', 'Changes were applied; post-apply verification did not run.'),
      applied_attention: t('install.readiness.appliedAttention', 'Applied, but verification needs attention.'),
      applied_manual_remaining: t('install.readiness.appliedManualRemaining', 'Applied and verified; manual steps remain.'),
      applied_verified: t('install.readiness.appliedVerified', 'Applied and verified.'),
      failed_check: t('install.readiness.failedCheck', 'Latest check found an operation that cannot be applied yet.'),
      checked: t('install.readiness.checked', 'Check passed. Studio can apply the reviewed changes.'),
      needs_check_guarded: t('install.readiness.guarded', 'Run a check, then Studio can apply the reviewed changes.'),
      needs_check_safe: t('install.readiness.safe', 'Ready to apply safe changes.'),
      blocked: t('install.readiness.blocked', 'Some changes are protected and will not be applied.'),
      advanced: t('install.readiness.advanced', 'Some changes need explicit advanced opt-in.'),
      manual: t('install.readiness.manual', 'Playable after you complete the manual steps.'),
      none: t('install.readiness.none', 'No installable changes in this plan.')
    };
    return labels[viewState && viewState.statusKind] || labels.none;
  }

  function renderReadinessStep(step) {
    if (!step || !step.kind) {
      return '';
    }
    const count = Number(step.count || 0);
    const labels = {
      apply_done: t('install.readiness.applyDone', 'Apply step completed.'),
      post_verify_attention: t('install.readiness.postVerifyAttention', 'Post-apply verification found a mismatch or a still-pending automatic change.'),
      post_verify_passed: t('install.readiness.postVerifyPassed', 'Post-apply verification found the automatic changes in place.'),
      check_passed: t('install.readiness.checkPassed', 'Latest check matches this plan.'),
      check_needed: t('install.readiness.checkNeeded', 'Run check before applying.'),
      no_check_needed: t('install.readiness.noCheckNeeded', 'No automatic apply step is available.'),
      no_safe: t('install.readiness.noSafe', 'No safe one-click changes.'),
      no_guarded: t('install.readiness.noGuarded', 'No guarded changes.'),
      no_advanced: t('install.readiness.noAdvanced', 'No advanced changes.'),
      no_manual: t('install.readiness.noManual', 'No manual steps remain.'),
      no_refused: t('install.readiness.noRefused', 'No protected changes.')
    };
    if (step.kind === 'failed_operation') {
      return t('install.readiness.failedOperation', 'Blocking operation') + ': ' + (Array.isArray(step.labelParts) ? step.labelParts.join(' · ') : '');
    }
    if (step.kind === 'safe_count') {
      return t('install.readiness.safeCount', 'Safe changes') + ': ' + count;
    }
    if (step.kind === 'guarded_count') {
      return t('install.readiness.guardedCount', 'Reviewed changes') + ': ' + count;
    }
    if (step.kind === 'advanced_count') {
      return t('install.readiness.advancedCount', 'Advanced changes') + ': ' + count;
    }
    if (step.kind === 'manual_count') {
      return t('install.readiness.manualCount', 'Manual steps') + ': ' + count;
    }
    if (step.kind === 'refused_count') {
      return t('install.readiness.refusedCount', 'Protected changes') + ': ' + count;
    }
    return labels[step.kind] || String(step.kind);
  }

  function currentCheckMatches(allowAdvanced) {
    if (!state.plan || !state.lastCheckKey || state.lastCheckKey !== planFingerprint(state.plan)) {
      return false;
    }
    const summary = operationSummaryForPlan(state.plan);
    const hasAdvanced = Number(summary.advancedApply || 0) > 0;
    return !hasAdvanced || state.lastCheckAllowAdvanced === Boolean(allowAdvanced);
  }

  function resultHasFailures(result) {
    const reviewStateApi = installReviewStateApi();
    if (reviewStateApi && typeof reviewStateApi.resultHasFailures === 'function') {
      return reviewStateApi.resultHasFailures(result);
    }
    return true;
  }

  function firstFailedResult(result) {
    const reviewStateApi = installReviewStateApi();
    if (reviewStateApi && typeof reviewStateApi.firstFailedResult === 'function') {
      return reviewStateApi.firstFailedResult(result);
    }
    return null;
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
      : result.ended
        ? t('install.runtimePreviewEndedTitle', 'Runtime preview ended.')
        : result.ok
        ? t('install.runtimePreviewReady', 'Runtime preview is ready.')
        : t('install.runtimePreviewFailed', 'Runtime preview could not be created.');
    const message = result.message || (result.ok && result.installResult && result.installResult.ok === false
      ? t('install.runtimePreviewReadyWithInstallWarnings', 'Runtime preview was created, but some proposed changes could not be applied to the temporary modified copy. Check diagnostics below.')
      : '');
    const links = [
      !result.ended && result.compareUrl ? ['install.runtimePreviewOpenCompare', t('install.runtimePreviewOpenCompare', 'Open comparison'), result.compareUrl] : null,
      !result.ended && result.baselineUrl ? ['install.runtimePreviewOpenBaseline', t('install.runtimePreviewOpenBaseline', 'Open original'), result.baselineUrl] : null,
      !result.ended && result.modifiedUrl ? ['install.runtimePreviewOpenModified', t('install.runtimePreviewOpenModified', 'Open modified'), result.modifiedUrl] : null
    ].filter(Boolean);
    return [
      '<article class="runtime-preview-card ' + runtimePreviewCardClass(result) + '">',
      '<header><strong>' + escapeHtml(status) + '</strong>' + (result.sessionId ? '<span>' + escapeHtml(result.sessionId) + '</span>' : '') + '</header>',
      message ? '<p>' + escapeHtml(message) + '</p>' : '',
      renderRuntimePreviewProgress(result),
      renderRuntimePreviewActions(result),
      links.length ? '<div class="runtime-preview-links">' + links.map((item) => {
        return '<a href="' + escapeHtml(item[2]) + '" target="_blank" rel="noopener">' + escapeHtml(item[1]) + '</a>';
      }).join('') + '</div>' : '',
      renderRuntimePreviewFrame(result),
      renderRuntimePreviewBuilds(result),
      renderRuntimePreviewTimings(result),
      diagnostics.length ? '<details class="runtime-preview-diagnostics"><summary>' + escapeHtml(t('install.runtimePreviewDiagnostics', 'Diagnostics')) + '</summary><ul>' +
        diagnostics.slice(0, 12).map((diag) => '<li>' + escapeHtml([(diag.severity || 'info'), (diag.code || 'diagnostic'), (diag.message || '')].join(' · ')) + '</li>').join('') +
        '</ul></details>' : '',
      '</article>'
    ].join('');
  }

  function runtimePreviewCardClass(result) {
    if (result && result.pending) {
      return 'is-pending';
    }
    if (result && result.ended) {
      return 'is-ended';
    }
    return result && result.ok ? 'is-ready' : 'is-error';
  }

  function renderRuntimePreviewProgress(result) {
    if (!result || !result.pending) {
      return '';
    }
    const steps = [
      t('install.runtimePreviewProgress.copy', 'Copying the project into a temporary sandbox'),
      t('install.runtimePreviewProgress.apply', 'Applying this plan to the modified copy'),
      t('install.runtimePreviewProgress.build', 'Building generated game output for preview'),
      t('install.runtimePreviewProgress.server', 'Starting the local comparison server')
    ];
    return [
      '<div class="runtime-preview-progress" role="status" aria-live="polite">',
      '<progress max="100" aria-label="' + escapeHtml(t('install.runtimePreviewProgressLabel', 'Runtime preview progress')) + '"></progress>',
      '<p>' + escapeHtml(t('install.runtimePreviewFullBuildNote', 'This is a full deployment preview: Studio copies the project, applies the plan to a temporary modified copy, and rebuilds game output. Large projects can take a while.')) + '</p>',
      '<ol>',
      steps.map((step) => '<li>' + escapeHtml(step) + '</li>').join(''),
      '</ol>',
      '</div>'
    ].join('');
  }

  function renderRuntimePreviewActions(result) {
    if (!result || result.pending || result.ended || !result.ok) {
      return result && result.ended
        ? '<div class="runtime-preview-ended-note">' + escapeHtml(t('install.runtimePreviewServerClosed', 'The inline frame was removed and the local preview server was closed.')) + '</div>'
        : '';
    }
    return [
      '<div class="runtime-preview-actions">',
      '<button type="button" class="runtime-preview-end" data-runtime-preview-action="end">',
      escapeHtml(t('install.runtimePreviewEnd', 'End preview')),
      '</button>',
      '</div>'
    ].join('');
  }

  function renderRuntimePreviewFrame(result) {
    const url = result && (result.compareUrl || result.modifiedUrl || result.baselineUrl);
    if (!result || !result.ok || result.ended || !url) {
      return '';
    }
    if (state.runtimePreviewSuspended) {
      return '<div class="runtime-preview-empty">' + escapeHtml(t('install.runtimePreviewSuspended', 'Inline runtime preview is suspended in the background. Create a new runtime preview to reload it.')) + '</div>';
    }
    return [
      '<div class="runtime-preview-frame-shell">',
      '<div class="runtime-preview-frame-caption">' + escapeHtml(t('install.runtimePreviewInline', 'Inline runtime preview')) + '</div>',
      '<iframe data-runtime-preview-frame="true" src="' + escapeHtml(url) + '" title="' + escapeHtml(t('install.runtimePreviewInlineTitle', 'Runtime preview frame')) + '" loading="lazy"></iframe>',
      '</div>'
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

  function renderRuntimePreviewTimings(result) {
    const timings = result && result.timings || {};
    const stages = Array.isArray(timings.stages) ? timings.stages.filter((item) => item && item.stage) : [];
    if (!stages.length) {
      return '';
    }
    return [
      '<details class="runtime-preview-diagnostics">',
      '<summary>' + escapeHtml(t('install.runtimePreviewTimings', 'Timings')) + ' · ' + escapeHtml(formatMs(timings.totalMs)) + '</summary>',
      '<ul>' + stages.slice(0, 10).map((item) => '<li>' + escapeHtml(item.stage) + ' · ' + escapeHtml(formatMs(item.ms)) + '</li>').join('') + '</ul>',
      '</details>'
    ].join('');
  }

  function formatMs(value) {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) {
      return '0ms';
    }
    if (number >= 1000) {
      return (number / 1000).toFixed(number >= 10000 ? 0 : 1) + 's';
    }
    return Math.round(number) + 'ms';
  }

  function renderResultReport(result) {
    const reportApi = installResultReportApi();
    if (reportApi && typeof reportApi.buildInstallResultReport === 'function') {
      return reportApi.buildInstallResultReport(result, {plan: state.plan, t});
    }
    return result ? 'Install report helper is not loaded.' : '';
  }

  function downloadEvidenceBundle() {
    if (!hasEvidenceBundle()) {
      return;
    }
    const payload = {
      schemaVersion: '0.1',
      kind: 'dendry_mod_studio_install_evidence',
      generatedAt: new Date().toISOString(),
      plan: {
        id: state.plan && state.plan.id || '',
        title: state.plan && state.plan.title || '',
        draftKind: state.plan && state.plan.draftKind || '',
        operations: Array.isArray(state.plan && state.plan.operations) ? state.plan.operations.length : 0
      },
      result: pruneEvidenceResult(state.lastResult),
      postApplyVerification: pruneEvidenceResult(state.postApplyVerification || state.lastResult && state.lastResult.postApplyVerification)
    };
    downloadText(fileStem() + '.install-evidence.json', JSON.stringify(payload, null, 2) + '\n', 'application/json');
  }

  function downloadVerifiedDiff() {
    const diff = currentVerifiedDiff();
    if (!diff) {
      return;
    }
    downloadText(fileStem() + '.verified.diff', diff, 'text/x-diff');
  }

  function pruneEvidenceResult(result) {
    if (!result) {
      return null;
    }
    return {
      ok: Boolean(result.ok),
      dryRun: Boolean(result.dryRun),
      allowAdvanced: Boolean(result.allowAdvanced),
      message: result.message || '',
      operationSummary: result.operationSummary || null,
      changedFiles: Array.isArray(result.changedFiles) ? result.changedFiles : [],
      verifiedDiff: result.verifiedDiff || '',
      results: Array.isArray(result.results) ? result.results.map((row) => ({
        id: row && row.id || '',
        type: row && row.type || '',
        path: row && row.path || '',
        status: row && row.status || '',
        evidence: row && row.evidence || null
      })) : [],
      diagnostics: Array.isArray(result.diagnostics) ? result.diagnostics : []
    };
  }

  function fileStem() {
    const raw = state.plan && (state.plan.id || state.plan.title) || 'dendry-install-plan';
    return String(raw || 'dendry-install-plan').trim().replace(/[^A-Za-z0-9_.-]+/g, '_') || 'dendry-install-plan';
  }

  function downloadText(fileName, content, type) {
    if (!global.document || typeof Blob === 'undefined' || !global.URL || typeof global.URL.createObjectURL !== 'function') {
      return false;
    }
    const blob = new Blob([String(content || '')], {type: type || 'text/plain'});
    const url = global.URL.createObjectURL(blob);
    const link = global.document.createElement('a');
    link.href = url;
    link.download = fileName;
    global.document.body.appendChild(link);
    link.click();
    link.remove();
    global.URL.revokeObjectURL(url);
    return true;
  }

  function installPlanApi() {
    return global.ProjectMapInstallPlan || null;
  }

  function installOperationContractsApi() {
    return global.ProjectMapInstallOperationContracts || null;
  }

  function installReviewStateApi() {
    return global.ProjectMapInstallReviewStateModel || null;
  }

  function installResultReportApi() {
    return global.ProjectMapInstallResultReportModel || null;
  }

  function studioContracts() {
    return global.ProjectMapStudioSharedConstants || null;
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

  function t(key, fallback) {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function currentLocale() {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.getLocale === 'function' ? i18n.getLocale() : 'en';
  }
})(typeof window !== 'undefined' ? window : globalThis);
