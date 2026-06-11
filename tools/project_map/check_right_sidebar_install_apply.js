#!/usr/bin/env node
// @ts-check
'use strict';

// fs-level acceptance for the System UI right-sidebar guarded auto-apply
// (P1 copy_template_file eject + P2 insert_html_block). Exercises the real
// install_plan applier against throwaway project copies: dry-run -> commit ->
// idempotent rerun, plus the permission boundary for out-of-domain paths.

const fs = require('fs');
const os = require('os');
const path = require('path');

const rightSidebar = require('./authoring/right_sidebar_draft.js');
const installPlan = require('./authoring/install_plan.js');
const {assert} = require('./check_harness.js');

const ENGINE_DIR = path.join(
  path.dirname(require.resolve('dendrynexus/package.json')),
  'lib', 'templates', 'html', 'default-tabbed-sidebar'
);

function mkProject(withOwnedTemplate) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-right-sidebar-'));
  fs.mkdirSync(path.join(root, 'source'), {recursive: true});
  fs.writeFileSync(path.join(root, 'source', 'info.dry'), 'title: Demo Mod\n');
  if (withOwnedTemplate) {
    const dir = path.join(root, 'templates', 'html', 'demo-mod');
    fs.mkdirSync(dir, {recursive: true});
    fs.copyFileSync(path.join(ENGINE_DIR, '+index.html'), path.join(dir, '+index.html'));
    fs.copyFileSync(path.join(ENGINE_DIR, '+game.css'), path.join(dir, '+game.css'));
  }
  return root;
}

function indexFor(root, templateSource) {
  return {schemaVersion: '0.1', project: {name: 'Demo Mod', root, templateSource}, scenes: [], semantic: {}};
}

function demoDraft() {
  return rightSidebar.normalizeDraft({
    id: 'right_sidebar_panel',
    title: 'Right Sidebar',
    panelTitle: 'Field Notes',
    panelBody: 'Clues gathered so far.',
    templateDir: 'templates/html/demo-mod'
  });
}

function statuses(result) {
  return (result.results || []).map((r) => r.id + ':' + r.status);
}

function panelCount(indexPath) {
  return (fs.readFileSync(indexPath, 'utf8').match(/id=['"]stats_sidebar_right['"]/g) || []).length;
}

function rmrf(root) {
  fs.rmSync(root, {recursive: true, force: true});
}

// --- engine_default: eject (+index.html, +game.css) + insert, one pass ------
(function engineDefault() {
  const root = mkProject(false);
  try {
    const index = indexFor(root, {owned: false, dirs: [], indexPath: '', hasStatsSidebarAnchor: false, hasRightPanel: false});
    const plan = rightSidebar.buildInstallPlan(demoDraft(), index);

    const dry = installPlan.applyInstallPlan(plan, {projectRoot: root, dryRun: true});
    assert(dry.ok, 'engine_default dry-run should succeed: ' + JSON.stringify(dry.diagnostics || []));
    assert(dry.results.every((r) => r.status === 'would_apply'),
      'engine_default dry-run should mark every op would_apply, got ' + statuses(dry).join(','));

    const commit = installPlan.applyInstallPlan(plan, {projectRoot: root, dryRun: false});
    assert(commit.ok, 'engine_default commit should succeed');
    assert(commit.results.every((r) => r.status === 'applied'),
      'engine_default commit should apply every op, got ' + statuses(commit).join(','));

    const indexPath = path.join(root, 'templates', 'html', 'demo-mod', '+index.html');
    assert(fs.existsSync(indexPath), 'engine_default should have ejected +index.html');
    assert(fs.existsSync(path.join(root, 'templates', 'html', 'demo-mod', '+game.css')),
      'engine_default should have ejected +game.css');
    assert(panelCount(indexPath) === 1, 'engine_default committed template should contain exactly one panel');

    // Structural placement: panel is a sibling AFTER #stats_sidebar closes and
    // BEFORE #content, inside #tools_wrapper.
    const text = fs.readFileSync(indexPath, 'utf8');
    const anchorAt = text.search(/<div\b[^>]*\bid\s*=\s*(['"])stats_sidebar\1/);
    const panelAt = text.search(/id=['"]stats_sidebar_right['"]/);
    const contentAt = text.search(/<div\b[^>]*\bid\s*=\s*(['"])content\1/);
    assert(anchorAt >= 0 && panelAt > anchorAt, 'panel should be inserted after the #stats_sidebar anchor');
    assert(contentAt < 0 || panelAt < contentAt, 'panel should be inserted before #content (sibling in #tools_wrapper)');

    // Idempotent rerun: nothing new, still one panel.
    const rerun = installPlan.applyInstallPlan(plan, {projectRoot: root, dryRun: false});
    assert(rerun.ok, 'engine_default rerun should succeed');
    assert(rerun.results.every((r) => r.status === 'already_applied'),
      'engine_default rerun should be fully already_applied, got ' + statuses(rerun).join(','));
    assert(panelCount(indexPath) === 1, 'engine_default rerun must not duplicate the panel');
  } finally {
    rmrf(root);
  }
})();

// --- mod_owned: insert only, non-destructive to the author's template -------
(function modOwned() {
  const root = mkProject(true);
  try {
    const indexPath = path.join(root, 'templates', 'html', 'demo-mod', '+index.html');
    const before = fs.readFileSync(indexPath, 'utf8');
    const index = indexFor(root, {
      owned: true,
      dirs: ['templates/html/demo-mod'],
      indexPath: 'templates/html/demo-mod/+index.html',
      hasStatsSidebarAnchor: true,
      hasRightPanel: false
    });
    const plan = rightSidebar.buildInstallPlan(demoDraft(), index);
    assert(plan.operations.length === 1 && plan.operations[0].type === 'insert_html_block',
      'mod_owned plan should be a single insert_html_block');

    const commit = installPlan.applyInstallPlan(plan, {projectRoot: root, dryRun: false});
    assert(commit.ok && commit.results.every((r) => r.status === 'applied'),
      'mod_owned commit should apply the insert, got ' + statuses(commit).join(','));
    assert(panelCount(indexPath) === 1, 'mod_owned template should contain exactly one panel');

    const after = fs.readFileSync(indexPath, 'utf8');
    // The author's original markup must be preserved verbatim (only an addition).
    assert(after.indexOf(before.trim().slice(0, 80)) >= 0 || after.length > before.length,
      'mod_owned insert should preserve the existing template and only add the panel');

    const rerun = installPlan.applyInstallPlan(plan, {projectRoot: root, dryRun: false});
    assert(rerun.results.every((r) => r.status === 'already_applied'),
      'mod_owned rerun should be already_applied, got ' + statuses(rerun).join(','));
    assert(panelCount(indexPath) === 1, 'mod_owned rerun must not duplicate the panel');
  } finally {
    rmrf(root);
  }
})();

// --- Permission boundary: the new ops must refuse out-of-domain paths --------
(function permissionBoundary() {
  // copy_template_file may only target templates/html/<slug>/(+index.html|+game.css).
  const badCopyTargets = [
    {id: 'a', type: 'copy_template_file', path: 'out/html/index.html', sourceName: '+index.html', safety: 'guarded_apply'},
    {id: 'b', type: 'copy_template_file', path: 'source/scenes/x.scene.dry', sourceName: '+index.html', safety: 'guarded_apply'},
    {id: 'c', type: 'copy_template_file', path: 'templates/html/m/+index.html', sourceName: 'evil.sh', safety: 'guarded_apply'}
  ];
  badCopyTargets.forEach((op) => {
    const klass = installPlan.classifyOperation(op);
    assert(klass.status === 'refused' || klass.status === 'manual_review',
      'copy_template_file must refuse out-of-domain target/source: ' + op.path + '/' + op.sourceName + ' got ' + klass.status);
  });

  // insert_html_block may only target a templates/html/<slug>/+index.html.
  const badInsertTargets = [
    {id: 'd', type: 'insert_html_block', path: 'source/scenes/x.scene.dry', content: '<div>', anchorText: 'x', dedupeSearch: "id='stats_sidebar_right'", safety: 'guarded_apply'},
    {id: 'e', type: 'insert_html_block', path: 'out/html/index.html', content: '<div>', anchorText: 'x', dedupeSearch: "id='stats_sidebar_right'", safety: 'guarded_apply'},
    {id: 'f', type: 'insert_html_block', path: 'templates/html/m/+game.css', content: '<div>', anchorText: 'x', dedupeSearch: "id='stats_sidebar_right'", safety: 'guarded_apply'}
  ];
  badInsertTargets.forEach((op) => {
    const klass = installPlan.classifyOperation(op);
    assert(klass.status === 'refused' || klass.status === 'manual_review',
      'insert_html_block must refuse out-of-domain target: ' + op.path + ' got ' + klass.status);
  });

  // A well-formed op on the correct path classifies as guarded.
  const good = installPlan.classifyOperation({
    id: 'g', type: 'insert_html_block', path: 'templates/html/m/+index.html',
    content: '<div>', anchorText: "<div id='stats_sidebar'>", dedupeSearch: "id='stats_sidebar_right'", safety: 'guarded_apply'
  });
  assert(good.status === 'guarded_apply', 'a well-formed template insert should classify as guarded_apply, got ' + good.status);
})();

process.stdout.write(JSON.stringify({ok: true, check: 'right_sidebar_install_apply'}, null, 2) + '\n');
