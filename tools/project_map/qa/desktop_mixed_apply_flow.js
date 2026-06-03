'use strict';

const fs = require('fs');
const path = require('path');

const definition = {
  title: 'Desktop bridge dry-runs, applies, and verifies mixed create/replace/copy operations.',
  artifactSlug: 'desktop-mixed-apply-flow',
  dialogRoots: ['projectRoot'],
  playerLike: [
    'opens a writable copy of the QA mini fixture through Quick Start',
    'loads a mixed install plan into Review & Apply',
    'runs desktop dry-run through the preload IPC bridge',
    'applies reviewed safe and guarded operations through the same bridge',
    'verifies post-apply dry-run reports the operations already applied',
    'checks the created scene, text replacement, and copied asset on disk'
  ],
  shortcuts: [
    'creates the mixed install plan deterministically instead of manually filling multiple editors',
    'uses an artifact project copy so the fixture is never modified'
  ]
};

async function run(win, args, artifactDir, log, helpers) {
  const workspaceRoot = copyDirectory(args.projectRoot, path.join(artifactDir, 'qa-mini-mixed-apply'));
  const sourceAssetDir = helpers.ensureDir(path.join(artifactDir, 'selected-local-assets'));
  const sourceAssetPath = path.join(sourceAssetDir, 'mixed-apply-art.png');
  const sourceAssetBytes = 'desktop mixed apply asset fixture\n';
  fs.writeFileSync(sourceAssetPath, sourceAssetBytes, 'utf8');
  args.projectRoot = workspaceRoot;

  await helpers.expectVisible(win, '#studio-welcome', 'Quick Start overlay should be visible on first launch');
  await helpers.click(win, '#welcome-primary');
  await helpers.waitForHidden(win, '#studio-welcome', 'Quick Start should close after opening the writable copy');
  const loaded = await helpers.waitForProjectLoaded(win, workspaceRoot, args.timeoutMs);
  await helpers.screenshot(win, artifactDir, '01-project-copy-loaded');
  log('Writable QA mini copy loads', 'PASS', JSON.stringify(loaded.summary || {}));

  const originalIntroPath = path.join(workspaceRoot, 'source', 'scenes', 'generic_intro.scene.dry');
  const originalIntro = fs.readFileSync(originalIntroPath, 'utf8');
  const searchText = 'This scene has a simple variable write and no project-specific systems.';
  const replacementText = 'Desktop bridge apply replaced this source-backed paragraph after dry-run.';
  if (!originalIntro.includes(searchText)) {
    throw new Error('Desktop mixed apply fixture no longer contains expected source text.');
  }

  const planInfo = await helpers.evalInPage(win, (root, assetSource, search, replacement) => {
    const installApi = window.ProjectMapInstallPlan;
    const assistant = window.ProjectMapInstallAssistant;
    const wizard = window.ProjectMapWizard;
    const assistantState = assistant && assistant.getState && assistant.getState() || {};
    const wizardState = wizard && wizard.getState && wizard.getState() || {};
    const index = assistantState.projectIndex || wizardState.projectIndex || null;
    if (!installApi || !assistant) {
      return {
        ok: false,
        message: 'Install Assistant or InstallPlan missing.',
        hasInstallPlan: Boolean(installApi),
        hasAssistant: Boolean(assistant),
        hasProjectIndex: Boolean(index),
        hasInstallContracts: Boolean(window.ProjectMapInstallOperationContracts),
        hasLineCoalescer: Boolean(window.ProjectMapExistingSceneLineCoalescer),
        installRelatedScripts: Array.from(document.scripts).map((script) => script.src || '').filter((src) => src.includes('install') || src.includes('line_coalescer') || src.includes('protected_path'))
      };
    }
    const project = index ? installApi.projectProvenanceFromIndex(index) || {} : {name: 'QA Mini', root, schemaVersion: 'desktop-qa'};
    const plan = installApi.buildInstallPlan({
      id: 'desktop_mixed_apply_bridge',
      draftKind: 'desktop_mixed_apply',
      title: 'Desktop mixed apply bridge',
      project: Object.assign({}, project, {root}),
      operations: [
        {
          id: 'create_mixed_scene',
          type: 'create_file',
          path: 'source/scenes/events/desktop_mixed_apply_created.scene.dry',
          safety: 'safe_apply',
          description: 'Create a small scene through the desktop apply bridge.',
          content: [
            'title: Desktop Mixed Apply Event',
            'tags: event',
            '',
            '= Desktop Mixed Apply',
            '',
            'This event was created by the desktop-backed mixed apply scenario.',
            '',
            '- @root: Return',
            ''
          ].join('\n')
        },
        {
          id: 'replace_intro_paragraph',
          type: 'replace_text',
          path: 'source/scenes/generic_intro.scene.dry',
          line: 9,
          search,
          replace: replacement,
          safety: 'guarded_apply',
          description: 'Replace source-backed event prose after exact dry-run evidence.'
        },
        {
          id: 'copy_selected_asset',
          type: 'copy_asset_file',
          path: 'assets/studio/events/desktop_mixed_apply/local-art.png',
          sourcePath: assetSource,
          sourceName: 'mixed-apply-art.png',
          safety: 'guarded_apply',
          description: 'Copy a selected desktop asset into the project asset folder.'
        }
      ]
    });
    assistant.loadPlan(plan, {fileName: 'desktop-mixed-apply.install-plan.json'});
    return {
      ok: true,
      summary: installApi.operationSummary(plan),
      paths: plan.operations.map((operation) => operation.path)
    };
  }, workspaceRoot, sourceAssetPath, searchText, replacementText);
  if (!planInfo || !planInfo.ok) {
    throw new Error('Could not load mixed desktop install plan: ' + JSON.stringify(planInfo || {}));
  }
  await helpers.expectInstallOperationPath(win, 'source/scenes/events/desktop_mixed_apply_created.scene.dry');
  await helpers.screenshot(win, artifactDir, '02-mixed-plan-loaded');
  log('Mixed install plan loads into Review & Apply', 'PASS', JSON.stringify(planInfo.summary || {}));

  const dryRunResult = await helpers.evalInPage(win, async () => {
    return window.ProjectMapInstallAssistant.applyLoadedPlan({dryRun: true});
  });
  assertResultStatuses(dryRunResult, ['create_mixed_scene', 'replace_intro_paragraph', 'copy_selected_asset'], 'would_apply', 'desktop mixed dry-run');
  if (fs.existsSync(path.join(workspaceRoot, 'source', 'scenes', 'events', 'desktop_mixed_apply_created.scene.dry'))) {
    throw new Error('Dry-run created a scene file on disk.');
  }
  if (fs.readFileSync(originalIntroPath, 'utf8') !== originalIntro) {
    throw new Error('Dry-run modified the existing source file.');
  }
  await helpers.screenshot(win, artifactDir, '03-mixed-dry-run');
  log('Desktop dry-run verifies mixed operations without writing files', 'PASS', helpers.statusSummary(dryRunResult));

  const applyResult = await helpers.evalInPage(win, async () => {
    return window.ProjectMapInstallAssistant.applyLoadedPlan({dryRun: false});
  });
  assertResultStatuses(applyResult, ['create_mixed_scene', 'replace_intro_paragraph', 'copy_selected_asset'], 'applied', 'desktop mixed apply');
  const postApply = applyResult && applyResult.postApplyVerification;
  assertResultStatuses(postApply, ['create_mixed_scene', 'replace_intro_paragraph', 'copy_selected_asset'], 'already_applied', 'desktop post-apply verify');

  const createdScenePath = path.join(workspaceRoot, 'source', 'scenes', 'events', 'desktop_mixed_apply_created.scene.dry');
  const copiedAssetPath = path.join(workspaceRoot, 'assets', 'studio', 'events', 'desktop_mixed_apply', 'local-art.png');
  const updatedIntro = fs.readFileSync(originalIntroPath, 'utf8');
  if (!fs.existsSync(createdScenePath) || !fs.readFileSync(createdScenePath, 'utf8').includes('Desktop Mixed Apply')) {
    throw new Error('Apply did not create the expected scene file.');
  }
  if (!updatedIntro.includes(replacementText) || updatedIntro.includes(searchText)) {
    throw new Error('Apply did not replace the expected source-backed paragraph.');
  }
  if (!fs.existsSync(copiedAssetPath) || fs.readFileSync(copiedAssetPath, 'utf8') !== sourceAssetBytes) {
    throw new Error('Apply did not copy the selected desktop asset bytes.');
  }
  await helpers.screenshot(win, artifactDir, '04-mixed-applied');
  log('Desktop apply writes files and post-apply verify reports already-applied', 'PASS', helpers.statusSummary(postApply));
}

function copyDirectory(source, target) {
  fs.cpSync(source, target, {recursive: true});
  return target;
}

function assertResultStatuses(result, ids, expectedStatus, label) {
  if (!result || result.ok !== true || !Array.isArray(result.results)) {
    throw new Error(label + ' did not produce a successful install result: ' + JSON.stringify(result || {}));
  }
  const missing = ids.filter((id) => {
    return !result.results.some((item) => item && item.id === id && item.status === expectedStatus);
  });
  if (missing.length) {
    throw new Error(label + ' missing ' + expectedStatus + ' statuses for ' + missing.join(', ') + ': ' + statusSummary(result));
  }
}

function statusSummary(result) {
  const rows = Array.isArray(result && result.results) ? result.results : [];
  return rows.map((item) => [item.id, item.type, item.status].filter(Boolean).join(':')).join(', ');
}

module.exports = {definition, run};
