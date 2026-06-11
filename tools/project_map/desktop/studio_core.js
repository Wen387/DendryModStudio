'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const {spawnSync} = require('child_process');

function requireInstallPlan() {
  const candidates = [
    path.join(__dirname, '..', 'authoring', 'install_plan.js'),
    path.join(__dirname, 'project_map', 'authoring', 'install_plan.js')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }
  throw new Error('Install plan helper not found in desktop resources.');
}

const installPlan = requireInstallPlan();
const runtimePreview = require('./runtime_preview');
const runtimeLens = require('./runtime_lens');
const sourceSliceRead = require('./source_slice_read.js');
const STARTER_DEMO_ID = 'starter-demo';
const STARTER_DEMO_TEMPLATE_MARKER = '.dendry-studio-template.json';
const PYTHON_CHECK_TIMEOUT_MS = 10 * 1000;
const PROJECT_INDEX_TIMEOUT_MS = 10 * 60 * 1000;
const STARTER_DEMO_SIGNATURE_FILES = [
  'README.md',
  'package.json',
  'source/info.dry',
  'source/img/cards/demo_action_deck.svg',
  'source/img/cards/demo_action_card.svg',
  'source/img/cards/demo_field_operation_card.svg',
  'source/img/cards/demo_civic_wire_card.svg',
  'source/img/cards/demo_office_overview_card.svg',
  'source/img/cards/demo_advisor.svg',
  'source/img/cards/demo_media_advisor.svg',
  'source/img/cards/demo_budget_advisor.svg',
  'source/img/events/demo_campaign_pressure.svg',
  'source/img/events/demo_monthly_docket.svg',
  'source/img/events/demo_budget_leak.svg',
  'source/img/events/demo_polling_shock.svg',
  'source/img/events/demo_council_deadlock.svg',
  'source/qdisplays/qdemo_level.qdisplay.dry',
  'source/scenes/root.scene.dry',
  'source/scenes/main.scene.dry',
  'source/scenes/status.scene.dry',
  'source/scenes/demo_opening.scene.dry',
  'source/scenes/decks/demo_action_deck.scene.dry',
  'source/scenes/cards/demo_action_card.scene.dry',
  'source/scenes/cards/demo_office_overview_card.scene.dry',
  'source/scenes/cards/demo_field_operation_card.scene.dry',
  'source/scenes/cards/demo_civic_wire_card.scene.dry',
  'source/scenes/advisors/demo_advisor.scene.dry',
  'source/scenes/advisors/demo_media_advisor.scene.dry',
  'source/scenes/advisors/demo_budget_advisor.scene.dry',
  'source/scenes/events/demo_campaign_pressure.scene.dry',
  'source/scenes/events/demo_case_hearing.scene.dry',
  'source/scenes/events/demo_back_room_talks.scene.dry',
  'source/scenes/events/demo_resolution_week.scene.dry',
  'source/scenes/events/demo_monthly_report.scene.dry',
  'source/scenes/events/demo_budget_leak.scene.dry',
  'source/scenes/events/demo_polling_shock.scene.dry',
  'source/scenes/events/demo_council_deadlock.scene.dry',
  'project-index.json',
  'project-index-excerpts.json'
];
const STARTER_DEMO_FRESH_SENTINELS = [
  ['source/scenes/demo_opening.scene.dry', 'Civic Reform Office Briefing'],
  ['source/scenes/events/demo_campaign_pressure.scene.dry', 'Civic Reform Campaign'],
  ['source/scenes/events/demo_monthly_report.scene.dry', 'Monthly Civic Docket'],
  ['source/scenes/status.scene.dry', 'Civic Reform Dashboard']
];

function resolveResourcePaths(options) {
  const desktopDir = path.resolve((options && options.desktopDir) || __dirname);
  const packagedProjectMapDir = path.join(desktopDir, 'project_map');
  const resourceProjectMapDir = process.resourcesPath
    ? path.join(process.resourcesPath, 'app', 'project_map')
    : packagedProjectMapDir;
  const projectMapDir = fs.existsSync(path.join(packagedProjectMapDir, 'viewer', 'index.html'))
    ? packagedProjectMapDir
    : path.resolve(desktopDir, '..');
  const backendProjectMapDir = fs.existsSync(path.join(resourceProjectMapDir, 'build_project_map.py'))
    ? resourceProjectMapDir
    : projectMapDir;
  const parserProjectMapDir = fs.existsSync(path.join(packagedProjectMapDir, 'parse_dry_project.js'))
    ? packagedProjectMapDir
    : backendProjectMapDir;
  const templateProjectMapDir = fs.existsSync(path.join(resourceProjectMapDir, 'templates', STARTER_DEMO_ID, 'source', 'info.dry'))
    ? resourceProjectMapDir
    : projectMapDir;
  return {
    desktopDir,
    projectMapDir,
    viewerDir: path.join(projectMapDir, 'viewer'),
    viewerIndex: path.join(projectMapDir, 'viewer', 'index.html'),
    parser: path.join(parserProjectMapDir, 'parse_dry_project.js'),
    indexer: path.join(backendProjectMapDir, 'build_project_map.py'),
    templatesDir: path.join(templateProjectMapDir, 'templates'),
    starterDemoTemplate: path.join(templateProjectMapDir, 'templates', STARTER_DEMO_ID),
    starterDemoIndex: path.join(templateProjectMapDir, 'templates', STARTER_DEMO_ID, 'project-index.json'),
    starterDemoIndexWithExcerpts: path.join(templateProjectMapDir, 'templates', STARTER_DEMO_ID, 'project-index-excerpts.json')
  };
}

function checkFile(filePath, label, code) {
  if (fs.existsSync(filePath)) {
    return {ok: true, code, label, path: filePath, message: label + ' found.'};
  }
  return {
    ok: false,
    code,
    label,
    path: filePath,
    message: label + ' is missing from the Dendry Mod Studio app files.'
  };
}

function checkResourcePaths(options) {
  const paths = resolveResourcePaths(options);
  const checks = {
    viewer: checkFile(paths.viewerIndex, 'Viewer app', 'viewer_missing'),
    indexer: checkFile(paths.indexer, 'Project Map indexer', 'indexer_missing'),
    parser: checkFile(paths.parser, 'Dendry parser wrapper', 'parser_missing'),
    starterDemo: checkFile(path.join(paths.starterDemoTemplate, 'source', 'info.dry'), 'Starter demo template', 'starter_demo_missing')
  };
  const ok = Object.values(checks).every((check) => check.ok);
  return {
    ok,
    paths,
    checks,
    message: ok
      ? 'Dendry Mod Studio app files are present.'
      : 'Dendry Mod Studio is missing required app files.'
  };
}

function fileSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch (_err) {
    return 0;
  }
}

function copyPath(src, dest) {
  fs.cpSync(src, dest, {
    recursive: true,
    force: true,
    dereference: true,
    filter: (source) => {
      const base = path.basename(source);
      return base !== '.git' && base !== '__pycache__';
    }
  });
}

function readFileIfExists(filePath) {
  try {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  } catch (_err) {
    return '';
  }
}

function starterDemoTemplateSignature(root) {
  const hash = crypto.createHash('sha256');
  STARTER_DEMO_SIGNATURE_FILES.forEach((relativePath) => {
    const filePath = path.join(root, relativePath);
    hash.update(relativePath);
    hash.update('\0');
    hash.update(readFileIfExists(filePath));
    hash.update('\0');
  });
  return hash.digest('hex');
}

function readStarterDemoTemplateMarker(root) {
  const markerPath = path.join(root, STARTER_DEMO_TEMPLATE_MARKER);
  try {
    return JSON.parse(fs.readFileSync(markerPath, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function writeStarterDemoTemplateMarker(sourceRoot, targetRoot) {
  const markerPath = path.join(targetRoot, STARTER_DEMO_TEMPLATE_MARKER);
  try {
    fs.writeFileSync(markerPath, JSON.stringify({
      id: STARTER_DEMO_ID,
      source: 'bundled_starter_demo',
      signature: starterDemoTemplateSignature(sourceRoot),
      refreshedAt: new Date().toISOString()
    }, null, 2) + '\n', 'utf8');
  } catch (_err) {
    // The marker is a convenience for future refresh checks; the project copy
    // itself remains usable even if this write fails.
  }
}

function starterDemoLooksFresh(root) {
  return STARTER_DEMO_FRESH_SENTINELS.every(([relativePath, expected]) => {
    return readFileIfExists(path.join(root, relativePath)).includes(expected);
  });
}

function backupPathForStarterDemo(targetRoot) {
  const parent = path.dirname(targetRoot);
  const stamp = new Date().toISOString().replace(/[^0-9A-Za-z]+/g, '-').replace(/^-|-$/g, '');
  for (let index = 0; index < 20; index += 1) {
    const suffix = index ? '-' + index : '';
    const candidate = path.join(parent, STARTER_DEMO_ID + '-backup-' + stamp + suffix);
    if (!fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(parent, STARTER_DEMO_ID + '-backup-' + stamp + '-' + process.pid);
}

function shouldRefreshStarterDemoCopy(sourceRoot, targetRoot, options) {
  if (!fs.existsSync(path.join(targetRoot, 'source', 'info.dry'))) {
    return false;
  }
  if (options && options.forceRefresh) {
    return true;
  }
  if (!options || !options.refreshIfStale) {
    return false;
  }
  const sourceSignature = starterDemoTemplateSignature(sourceRoot);
  const marker = readStarterDemoTemplateMarker(targetRoot);
  const looksFresh = starterDemoLooksFresh(targetRoot);
  if (marker && marker.signature === sourceSignature && looksFresh) {
    return false;
  }
  if (!looksFresh) {
    return true;
  }
  return false;
}

function prepareStarterDemo(options) {
  const paths = resolveResourcePaths(options);
  const sourceRoot = paths.starterDemoTemplate;
  const workspaceRoot = path.resolve(
    options && options.workspaceRoot
      ? options.workspaceRoot
      : path.join(os.tmpdir(), 'dendry_mod_studio_starter_templates')
  );
  const targetRoot = path.join(workspaceRoot, STARTER_DEMO_ID);
  const infoPath = path.join(sourceRoot, 'source', 'info.dry');
  if (!fs.existsSync(infoPath)) {
    return {
      ok: false,
      id: STARTER_DEMO_ID,
      sourceRoot,
      targetRoot,
      message: 'The bundled starter demo template is missing from this Dendry Mod Studio package.'
    };
  }
  let alreadyPresent = fs.existsSync(path.join(targetRoot, 'source', 'info.dry'));
  let refreshed = false;
  let backupRoot = '';
  if (alreadyPresent && shouldRefreshStarterDemoCopy(sourceRoot, targetRoot, options || {})) {
    fs.mkdirSync(workspaceRoot, {recursive: true});
    backupRoot = backupPathForStarterDemo(targetRoot);
    fs.renameSync(targetRoot, backupRoot);
    alreadyPresent = false;
    refreshed = true;
  }
  if (!alreadyPresent) {
    fs.mkdirSync(workspaceRoot, {recursive: true});
    copyPath(sourceRoot, targetRoot);
  } else {
    repairStarterDemoSupportFiles(sourceRoot, targetRoot);
  }
  writeStarterDemoTemplateMarker(sourceRoot, targetRoot);
  const validation = validateProjectRoot(targetRoot);
  return Object.assign({
    ok: validation.ok,
    id: STARTER_DEMO_ID,
    title: 'Dendry Mod Studio Starter Demo',
    sourceRoot,
    targetRoot,
    root: validation.root || targetRoot,
    reused: alreadyPresent,
    refreshed,
    backupRoot,
    message: validation.ok
      ? (refreshed ? 'Starter demo workspace refreshed from the bundled template.' : alreadyPresent ? 'Starter demo workspace opened.' : 'Starter demo workspace created.')
      : validation.message
  }, validation.ok ? {} : {error: validation});
}

function repairStarterDemoSupportFiles(sourceRoot, targetRoot) {
  [
    'package.json',
    'source/scenes/main.scene.dry',
    'source/scenes/decks/demo_action_deck.scene.dry',
    'source/scenes/cards/demo_action_card.scene.dry',
    'source/scenes/cards/demo_office_overview_card.scene.dry',
    'source/scenes/cards/demo_field_operation_card.scene.dry',
    'source/scenes/cards/demo_civic_wire_card.scene.dry',
    'source/scenes/advisors/demo_advisor.scene.dry',
    'source/scenes/advisors/demo_media_advisor.scene.dry',
    'source/scenes/advisors/demo_budget_advisor.scene.dry',
    'source/img/cards/demo_action_deck.svg',
    'source/img/cards/demo_action_card.svg',
    'source/img/cards/demo_field_operation_card.svg',
    'source/img/cards/demo_civic_wire_card.svg',
    'source/img/cards/demo_office_overview_card.svg',
    'source/img/cards/demo_advisor.svg',
    'source/img/cards/demo_media_advisor.svg',
    'source/img/cards/demo_budget_advisor.svg',
    'source/img/events/demo_campaign_pressure.svg',
    'source/img/events/demo_monthly_docket.svg',
    'source/img/events/demo_budget_leak.svg',
    'source/img/events/demo_polling_shock.svg',
    'source/img/events/demo_council_deadlock.svg',
    'source/qdisplays/qdemo_level.qdisplay.dry',
    'source/qualities/demo_support.quality.dry',
    'source/qualities/demo_conflict.quality.dry',
    'source/qualities/demo_resources.quality.dry',
    'source/qualities/demo_advisor_trust.quality.dry',
    'source/qualities/demo_card_progress.quality.dry',
    'source/qualities/demo_event_seen.quality.dry',
    'source/qualities/demo_chain_seen.quality.dry',
    'source/qualities/demo_hearing_seen.quality.dry',
    'source/qualities/demo_resolution_seen.quality.dry',
    'source/qualities/demo_pressure.quality.dry',
    'source/qualities/demo_public_attention.quality.dry',
    'source/qualities/demo_case_strength.quality.dry',
    'source/qualities/demo_cabinet_balance.quality.dry',
    'source/qualities/demo_reform_mandate.quality.dry',
    'source/qualities/demo_opposition_heat.quality.dry',
    'source/qualities/demo_resolution_result.quality.dry',
    'source/qualities/demo_year.quality.dry',
    'source/qualities/demo_month.quality.dry',
    'source/qualities/demo_monthly_tick.quality.dry',
    'source/qualities/demo_press_risk.quality.dry',
    'source/qualities/demo_legislative_path.quality.dry',
    'source/qualities/demo_budget_leak_seen.quality.dry',
    'source/qualities/demo_polling_shock_seen.quality.dry',
    'source/qualities/demo_council_deadlock_seen.quality.dry',
    'source/scenes/events/demo_campaign_pressure.scene.dry',
    'source/scenes/events/demo_case_hearing.scene.dry',
    'source/scenes/events/demo_back_room_talks.scene.dry',
    'source/scenes/events/demo_resolution_week.scene.dry',
    'source/scenes/events/demo_monthly_report.scene.dry',
    'source/scenes/events/demo_budget_leak.scene.dry',
    'source/scenes/events/demo_polling_shock.scene.dry',
    'source/scenes/events/demo_council_deadlock.scene.dry'
  ].forEach((relativePath) => {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(targetRoot, relativePath);
    if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) {
      return;
    }
    fs.mkdirSync(path.dirname(targetPath), {recursive: true});
    fs.copyFileSync(sourcePath, targetPath);
  });
  repairStarterDemoSourceCompatibility(targetRoot);
  repairStarterDemoTemplateCompatibility(targetRoot);
}

function patchFileIfChanged(filePath, updater) {
  if (!fs.existsSync(filePath)) {
    return false;
  }
  const before = fs.readFileSync(filePath, 'utf8');
  const after = updater(before);
  if (after === before) {
    return false;
  }
  fs.writeFileSync(filePath, after, 'utf8');
  return true;
}

function insertLineAfter(text, anchor, insertedLine) {
  if (!text.includes(anchor) || text.includes(insertedLine)) {
    return text;
  }
  return text.replace(anchor, anchor + '\n' + insertedLine);
}

function insertMetadataLine(text, insertedLine) {
  if (text.includes(insertedLine)) {
    return text;
  }
  if (/^subtitle:/m.test(text)) {
    return text.replace(/^(subtitle:[^\n]*)/m, '$1\n' + insertedLine);
  }
  if (/^title:/m.test(text)) {
    return text.replace(/^(title:[^\n]*)/m, '$1\n' + insertedLine);
  }
  return insertedLine + '\n' + text;
}

function ensureBlankLineBeforeFirstHeading(text) {
  return String(text || '').replace(/^([A-Za-z][A-Za-z0-9-]*:\s*[^\n]+)\n(= )/m, '$1\n\n$2');
}

function repairStarterDemoTemplateCompatibility(targetRoot) {
  patchFileIfChanged(path.join(targetRoot, 'source', 'scenes', 'main.scene.dry'), (text) => {
    const replacement = [
      'Monthly office workspace.',
      '',
      'Click the monthly deck to draw reusable action cards. Pinned briefing and',
      'advisor cards stay available, while drawn cards fill the hand slots below.',
      'This is the simplified SDAAH-like loop: prepare, advance the month, then let',
      'events read the changed Q variables.'
    ].join('\n');
    let next = text.replace(
      [
        'This hand scene is the repeatable workspace. Card-style DendryNexus',
        'projects often use a hand like this for monthly actions, standing advisors,',
        'circles, or other tools the player can revisit.',
        '',
        'Use the action deck to spend resources and build a case. Use the advisor to',
        'shape support and compromise. The civic reform chain reads those variables.'
      ].join('\n'),
      replacement
    );
    next = next.replace(
      /This hand scene is the repeatable workspace\.[\s\S]*?The civic reform chain reads those variables\./,
      replacement
    );
    return next;
  });

  patchFileIfChanged(path.join(targetRoot, 'source', 'qdisplays', 'qdemo_level.qdisplay.dry'), (text) => {
    return text
      .replace(/\(--0\)\s+:\s+none/g, '(--0) none')
      .replace(/\(1\.\.2\)\s+:\s+low/g, '(1..2) low')
      .replace(/\(3\.\.5\)\s+:\s+medium/g, '(3..5) medium')
      .replace(/\(6\.\.\)\s+:\s+high/g, '(6..) high');
  });

  patchFileIfChanged(path.join(targetRoot, 'source', 'scenes', 'decks', 'demo_action_deck.scene.dry'), (text) => {
    if (!text.includes('is-deck: true')) {
      return text;
    }
    let next = text
      .replace(/^title:\s*Starter Deck\s*$/m, 'title: Monthly Action Deck')
      .replace(/^subtitle:\s*A minimal action-card deck\s*$/m, 'subtitle: Reusable office cards; many choices advance the month');
    next = insertMetadataLine(next, 'card-image: img/cards/demo_action_deck.svg');
    return ensureBlankLineBeforeFirstHeading(next);
  });

  patchFileIfChanged(path.join(targetRoot, 'source', 'scenes', 'cards', 'demo_action_card.scene.dry'), (text) => {
    if (!text.includes('title: Starter Action Card')) {
      return text;
    }
    let next = insertLineAfter(text, 'is-card: true', 'card-image: img/cards/demo_action_card.svg');
    next = next.replace(/^priority:\s*0\s*$/m, 'priority: 1');
    return ensureBlankLineBeforeFirstHeading(next);
  });

  patchFileIfChanged(path.join(targetRoot, 'source', 'scenes', 'cards', 'demo_field_operation_card.scene.dry'), (text) => {
    if (!text.includes('title: Field Operation Card')) {
      return text;
    }
    return ensureBlankLineBeforeFirstHeading(insertLineAfter(text, 'is-card: true', 'card-image: img/cards/demo_field_operation_card.svg'));
  });

  patchFileIfChanged(path.join(targetRoot, 'source', 'scenes', 'cards', 'demo_civic_wire_card.scene.dry'), (text) => {
    if (!text.includes('title: Civic Wire Card')) {
      return text;
    }
    return ensureBlankLineBeforeFirstHeading(insertLineAfter(text, 'is-card: true', 'card-image: img/cards/demo_civic_wire_card.svg'));
  });

  patchFileIfChanged(path.join(targetRoot, 'source', 'scenes', 'cards', 'demo_office_overview_card.scene.dry'), (text) => {
    if (!text.includes('title: Office Overview Card')) {
      return text;
    }
    let next = insertLineAfter(text, 'is-card: true', 'is-pinned-card: true');
    next = insertLineAfter(next, 'is-pinned-card: true', 'card-image: img/cards/demo_office_overview_card.svg');
    next = next.replace(/^priority:\s*5\s*$/m, 'priority: 1');
    return ensureBlankLineBeforeFirstHeading(next);
  });

  patchFileIfChanged(path.join(targetRoot, 'source', 'scenes', 'advisors', 'demo_advisor.scene.dry'), (text) => {
    if (!text.includes('is-pinned-card: true')) {
      return text;
    }
    return ensureBlankLineBeforeFirstHeading(insertMetadataLine(text, 'card-image: img/cards/demo_advisor.svg'));
  });

  patchFileIfChanged(path.join(targetRoot, 'source', 'scenes', 'advisors', 'demo_media_advisor.scene.dry'), (text) => {
    if (!text.includes('is-pinned-card: true')) {
      return text;
    }
    return ensureBlankLineBeforeFirstHeading(insertMetadataLine(text, 'card-image: img/cards/demo_media_advisor.svg'));
  });

  patchFileIfChanged(path.join(targetRoot, 'source', 'scenes', 'advisors', 'demo_budget_advisor.scene.dry'), (text) => {
    if (!text.includes('is-pinned-card: true')) {
      return text;
    }
    return ensureBlankLineBeforeFirstHeading(insertMetadataLine(text, 'card-image: img/cards/demo_budget_advisor.svg'));
  });
}

function repairStarterDemoSourceCompatibility(targetRoot) {
  const rootScenePath = path.join(targetRoot, 'source', 'scenes', 'root.scene.dry');
  if (!fs.existsSync(rootScenePath)) {
    return;
  }
  const before = fs.readFileSync(rootScenePath, 'utf8');
  let after = before
    .replace('- @.demo_opening.demo_status: Check demo state', '- @demo_opening.demo_status: Check demo state')
    .replace('- @.demo_opening.demo_status: Check office state', '- @demo_opening.demo_status: Check office state')
    .replace('- @.demo_opening.support_followup: Follow up on support', '- @demo_opening.support_followup: Follow up on support')
    .replace('- @demo_status: Check demo state', '- @demo_opening.demo_status: Check demo state')
    .replace('- @demo_status: Check office state', '- @demo_opening.demo_status: Check office state')
    .replace('- @support_followup: Follow up on support', '- @demo_opening.support_followup: Follow up on support')
    .replace('- @demo_campaign_pressure: Play the complex event chain', '- @demo_campaign_pressure: Play the civic reform chain');
  if (!after.includes('Q.demo_resources === undefined')) {
    after = after.replace(
      'if (Q.demo_event_seen === undefined) { Q.demo_event_seen = 0; }',
      [
        'if (Q.demo_resources === undefined) { Q.demo_resources = 2; }',
        'if (Q.demo_advisor_trust === undefined) { Q.demo_advisor_trust = 0; }',
        'if (Q.demo_card_progress === undefined) { Q.demo_card_progress = 0; }',
        'if (Q.demo_event_seen === undefined) { Q.demo_event_seen = 0; }'
      ].join('\n')
    );
  }
  if (!after.includes('Q.demo_year === undefined')) {
    after = after.replace(
      'if (Q.demo_resolution_result === undefined) { Q.demo_resolution_result = 0; }',
      [
        'if (Q.demo_resolution_result === undefined) { Q.demo_resolution_result = 0; }',
        'if (Q.demo_year === undefined) { Q.demo_year = 2032; }',
        'if (Q.demo_month === undefined) { Q.demo_month = 9; }',
        'if (Q.demo_monthly_tick === undefined) { Q.demo_monthly_tick = 0; }',
        'if (Q.demo_press_risk === undefined) { Q.demo_press_risk = 0; }',
        'if (Q.demo_legislative_path === undefined) { Q.demo_legislative_path = 0; }',
        'if (Q.demo_budget_leak_seen === undefined) { Q.demo_budget_leak_seen = 0; }',
        'if (Q.demo_polling_shock_seen === undefined) { Q.demo_polling_shock_seen = 0; }',
        'if (Q.demo_council_deadlock_seen === undefined) { Q.demo_council_deadlock_seen = 0; }',
        'if (Q.news_1 === undefined) { Q.news_1 = "Office calendar opens in September 2032."; }',
        'if (Q.news_1_desc === undefined) { Q.news_1_desc = "The Civic Reform Office is ready for its first monthly docket."; }',
        'if (Q.news_2 === undefined) { Q.news_2 = ""; }',
        'if (Q.news_2_desc === undefined) { Q.news_2_desc = ""; }',
        'if (Q.news_3 === undefined) { Q.news_3 = ""; }',
        'if (Q.news_3_desc === undefined) { Q.news_3_desc = ""; }'
      ].join('\n')
    );
  }
  if (!after.includes('- @main: Open the workspace hand')) {
    after = after.replace(/- @demo_opening: [^\n]+/, (line) => '- @main: Open the workspace hand\n' + line);
  }
  if (!after.includes('- @demo_office_overview_card: Open the office overview card')) {
    after = after.replace(/- @main: [^\n]+/, (line) => '- @demo_office_overview_card: Open the office overview card\n' + line);
  }
  if (!after.includes('- @demo_campaign_pressure: Play the civic reform chain')) {
    after = after.replace(/- @demo_opening: [^\n]+/, (line) => '- @demo_campaign_pressure: Play the civic reform chain\n' + line);
  }
  if (!after.includes('- @post_event: Advance one month')) {
    after = after.replace(/- @demo_opening: [^\n]+/, (line) => '- @post_event: Advance one month\n' + line);
  }
  if (after !== before) {
    fs.writeFileSync(rootScenePath, after, 'utf8');
  }
  const mainScenePath = path.join(targetRoot, 'source', 'scenes', 'main.scene.dry');
  if (fs.existsSync(mainScenePath)) {
    const mainBefore = fs.readFileSync(mainScenePath, 'utf8');
    let mainAfter = mainBefore;
    if (!mainAfter.includes('- @demo_office_overview_card: Review office overview card')) {
      mainAfter = mainAfter.replace(/- @demo_action_deck: [^\n]+/, (line) => '- @demo_office_overview_card: Review office overview card\n' + line);
    }
    if (mainAfter !== mainBefore) {
      fs.writeFileSync(mainScenePath, mainAfter, 'utf8');
    }
  }
  const postEventPath = path.join(targetRoot, 'source', 'scenes', 'post_event.scene.dry');
  if (fs.existsSync(postEventPath)) {
    const postBefore = fs.readFileSync(postEventPath, 'utf8');
    let postAfter = postBefore;
    if (!postAfter.includes('Q.demo_resources === undefined')) {
      postAfter = postAfter.replace(
        'if (Q.demo_event_seen === undefined) { Q.demo_event_seen = 0; }',
        [
          'if (Q.demo_resources === undefined) { Q.demo_resources = 2; }',
          'if (Q.demo_advisor_trust === undefined) { Q.demo_advisor_trust = 0; }',
          'if (Q.demo_card_progress === undefined) { Q.demo_card_progress = 0; }',
          'if (Q.demo_event_seen === undefined) { Q.demo_event_seen = 0; }'
        ].join('\n')
      );
    }
    if (!postAfter.includes('Q.demo_year === undefined')) {
      postAfter = postAfter.replace(
        'if (Q.demo_resolution_result === undefined) { Q.demo_resolution_result = 0; }',
        [
          'if (Q.demo_resolution_result === undefined) { Q.demo_resolution_result = 0; }',
          'if (Q.demo_year === undefined) { Q.demo_year = 2032; }',
          'if (Q.demo_month === undefined) { Q.demo_month = 9; }',
          'if (Q.demo_monthly_tick === undefined) { Q.demo_monthly_tick = 0; }',
          'if (Q.demo_press_risk === undefined) { Q.demo_press_risk = 0; }',
          'if (Q.demo_legislative_path === undefined) { Q.demo_legislative_path = 0; }',
          'if (Q.demo_budget_leak_seen === undefined) { Q.demo_budget_leak_seen = 0; }',
          'if (Q.demo_polling_shock_seen === undefined) { Q.demo_polling_shock_seen = 0; }',
          'if (Q.demo_council_deadlock_seen === undefined) { Q.demo_council_deadlock_seen = 0; }',
          'if (Q.news_1 === undefined) { Q.news_1 = "Office calendar opens in September 2032."; }',
          'if (Q.news_1_desc === undefined) { Q.news_1_desc = "The Civic Reform Office is ready for its first monthly docket."; }',
          'if (Q.news_2 === undefined) { Q.news_2 = ""; }',
          'if (Q.news_2_desc === undefined) { Q.news_2_desc = ""; }',
          'if (Q.news_3 === undefined) { Q.news_3 = ""; }',
          'if (Q.news_3_desc === undefined) { Q.news_3_desc = ""; }'
        ].join('\n')
      );
    }
    if (postAfter !== postBefore) {
      fs.writeFileSync(postEventPath, postAfter, 'utf8');
    }
  }
}

function validateProjectRoot(root) {
  const rootPath = path.resolve(String(root || ''));
  const infoPath = path.join(rootPath, 'source', 'info.dry');
  if (!root || !fs.existsSync(infoPath)) {
    const candidates = findNestedProjectCandidates(rootPath);
    if (candidates.length === 1) {
      const candidateRoot = path.resolve(candidates[0]);
      return {
        ok: true,
        root: candidateRoot,
        infoPath: path.join(candidateRoot, 'source', 'info.dry'),
        selectedNestedRoot: true,
        requestedRoot: rootPath
      };
    }
    const hint = candidates.length
      ? ' Nearby Dendry project folders: ' + candidates.slice(0, 4).join(', ') + '.'
      : '';
    return {
      ok: false,
      root: rootPath,
      candidates,
      message: 'Choose a Dendry project folder that contains source/info.dry.' + hint
    };
  }
  return {ok: true, root: rootPath, infoPath};
}

function findNestedProjectCandidates(rootPath) {
  const candidates = [];
  try {
    const entries = fs.readdirSync(rootPath, {withFileTypes: true});
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((entry) => {
        const child = path.join(rootPath, entry.name);
        if (fs.existsSync(path.join(child, 'source', 'info.dry'))) {
          candidates.push(child);
        }
      });
  } catch (_err) {
    return [];
  }
  return candidates;
}

function checkPython(options) {
  const resolved = resolvePythonExecutable(options);
  const python = resolved.python;
  const result = spawnSync(python, ['--version'], {
    encoding: 'utf8',
    timeout: PYTHON_CHECK_TIMEOUT_MS,
    windowsHide: true
  });
  const versionText = String(result.stdout || result.stderr || '').trim();
  if (
    (result.error && result.status !== 0 && !versionText) ||
    isPythonUnavailable(versionText, result.error && result.error.code)
  ) {
    return {
      ok: false,
      code: 'python_missing',
      python,
      source: resolved.source,
      bundled: resolved.bundled,
      message: 'Dendry Mod Studio could not find its bundled Python runtime. Install a release build with the runtime included, or set PYTHON to a Python 3 executable for development.' + bundledPythonHint(resolved)
    };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      code: 'python_failed',
      python,
      source: resolved.source,
      bundled: resolved.bundled,
      message: 'Dendry Mod Studio could not start its Python runtime at ' + python + '.'
    };
  }
  const match = versionText.match(/Python\s+(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match || Number(match[1]) < 3) {
    return {
      ok: false,
      code: 'python_version',
      python,
      source: resolved.source,
      bundled: resolved.bundled,
      version: versionText,
      message: 'Dendry Mod Studio needs a Python 3 runtime.'
    };
  }
  return {
    ok: true,
    code: 'python_ok',
    python,
    source: resolved.source,
    bundled: resolved.bundled,
    version: versionText,
    message: (resolved.source === 'bundled' ? 'Bundled ' : '') + versionText + ' is available.'
  };
}

function checkScratchDir(outDir) {
  const scratch = path.resolve(outDir || path.join(os.tmpdir(), 'dendry_mod_studio_desktop'));
  const probe = path.join(scratch, '.doctor-write-test-' + process.pid);
  try {
    fs.mkdirSync(scratch, {recursive: true});
    fs.writeFileSync(probe, 'ok\n', 'utf8');
    fs.unlinkSync(probe);
    return {
      ok: true,
      code: 'scratch_ok',
      path: scratch,
      message: 'Scratch folder is writable.'
    };
  } catch (_err) {
    return {
      ok: false,
      code: 'scratch_unwritable',
      path: scratch,
      message: 'Dendry Mod Studio could not write to its scratch folder.'
    };
  }
}

function isPythonUnavailable(versionText, errorCode) {
  if (errorCode === 'ENOENT') {
    return true;
  }
  const lowered = String(versionText || '').toLowerCase();
  return (
    lowered.includes('python was not found') ||
    lowered.includes('is not recognized') ||
    lowered.includes('not recognized as an internal or external command') ||
    lowered.includes('no such file or directory') ||
    lowered.includes('no such file') ||
    lowered.includes('cannot find the path specified')
  );
}

function friendlyError(error) {
  const raw = String(error && (error.message || error) || 'Unknown error.');
  if (/Cannot find module ['"]dendrynexus\//.test(raw)) {
    return {
      message: 'DendryNexus parser files were not found. Use the packaged Studio app, or run it from a development checkout with dependencies installed.'
    };
  }
  let message = raw
    .replace(/^Error:\s*/, '')
    .replace(/^ENOENT:[^,]*(?:,\s*)?/, '')
    .replace(/Traceback[\s\S]*/m, 'The underlying tool reported an error.');
  message = message.trim();
  if (!message) {
    message = 'Dendry Mod Studio could not finish that action.';
  }
  return {message};
}

function summarizeIndex(index) {
  const summary = index && index.summary ? index.summary : {};
  return {
    sceneCount: Number(summary.sceneCount || 0),
    edgeCount: Number(summary.edgeCount || 0),
    variableCount: Number(summary.variableCount || 0),
    diagnosticCount: Number(summary.diagnosticCount || 0),
    eventCount: Number(summary.eventCount || 0),
    cardCount: Number(summary.cardCount || 0),
    handCount: Number(summary.handCount || 0),
    deckCount: Number(summary.deckCount || 0),
    pinnedCardCount: Number(summary.pinnedCardCount || 0),
    newsItemCount: Number(summary.newsItemCount || 0)
  };
}

function emitProgress(options, update) {
  const onProgress = options && options.onProgress;
  if (typeof onProgress !== 'function') {
    return;
  }
  const percent = Number(update && update.percent);
  const normalized = Object.assign({}, update, {
    percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, Math.round(percent))) : 0,
    stage: String(update && update.stage || 'working'),
    label: String(update && update.label || 'Working...')
  });
  try {
    onProgress(normalized);
  } catch (_err) {
    // Progress reporting must never break the indexer.
  }
}

function projectName(index, root) {
  return (index && index.project && index.project.name) || path.basename(root);
}

function bundledPythonRoots(options) {
  const paths = resolveResourcePaths(options);
  const roots = [
    path.join(paths.desktopDir, 'runtime', 'python')
  ];
  if (process.resourcesPath) {
    roots.push(path.join(process.resourcesPath, 'app', 'runtime', 'python'));
    roots.push(path.join(process.resourcesPath, 'runtime', 'python'));
  }
  return Array.from(new Set(roots.map((root) => path.resolve(root))));
}

function bundledPythonCandidates(options) {
  const candidates = [];
  bundledPythonRoots(options).forEach((root) => {
    if (process.platform === 'win32') {
      candidates.push(
        path.join(root, 'python.exe'),
        path.join(root, 'python', 'python.exe')
      );
      return;
    }
    candidates.push(
      path.join(root, 'bin', 'python3'),
      path.join(root, 'bin', 'python'),
      path.join(root, 'python', 'bin', 'python3'),
      path.join(root, 'python', 'bin', 'python')
    );
  });
  return Array.from(new Set(candidates));
}

function resolveBundledPython(options) {
  const candidates = bundledPythonCandidates(options);
  const executable = candidates.find((candidate) => fs.existsSync(candidate));
  return executable
    ? {ok: true, source: 'bundled', python: executable, candidates}
    : {ok: false, source: 'bundled', candidates};
}

function resolvePythonExecutable(options) {
  const opts = options || {};
  const bundled = resolveBundledPython(opts);
  if (opts.python) {
    return {
      source: 'explicit',
      python: opts.python,
      bundled
    };
  }
  if (bundled.ok) {
    return {
      source: 'bundled',
      python: bundled.python,
      bundled
    };
  }
  if (process.env.PYTHON) {
    return {
      source: 'environment',
      python: process.env.PYTHON,
      bundled
    };
  }
  return {
    source: 'system',
    python: process.platform === 'win32' ? 'python' : 'python3',
    bundled
  };
}

function bundledPythonHint(resolved) {
  const bundled = resolved && resolved.bundled;
  const candidates = bundled && Array.isArray(bundled.candidates)
    ? bundled.candidates.filter(Boolean)
    : [];
  if (!candidates.length) {
    return '';
  }
  return ' Looked for bundled Python at: ' + candidates.join(', ');
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readProjectInfoSource(root) {
  const infoPath = path.join(root, 'source', 'info.dry');
  const info = {};
  const infoSource = {};
  if (!fs.existsSync(infoPath)) {
    return {info, infoSource};
  }
  fs.readFileSync(infoPath, 'utf8').split(/\r?\n/).forEach((raw, index) => {
    if (!raw.includes(':')) {
      return;
    }
    const parts = raw.split(':');
    const key = String(parts.shift() || '').trim();
    if (!key) {
      return;
    }
    info[key] = parts.join(':').trim();
    infoSource[key] = {
      path: 'source/info.dry',
      line: index + 1,
      anchorText: raw
    };
  });
  return {info, infoSource};
}

function refreshCachedIndexInfo(index, root) {
  const metadata = readProjectInfoSource(root);
  const project = Object.assign({}, index.project || {}, {
    root,
    info: metadata.info,
    infoSource: metadata.infoSource
  });
  project.name = metadata.info.title || project.name || path.basename(root);
  index.project = project;
  return index;
}

function loadStarterDemoIndex(options) {
  const opts = options || {};
  const prepared = opts.prepared || null;
  const paths = resolveResourcePaths(opts);
  const preferredIndexPath = opts.includeExcerpts && fs.existsSync(paths.starterDemoIndexWithExcerpts)
    ? paths.starterDemoIndexWithExcerpts
    : paths.starterDemoIndex;
  if (!fs.existsSync(preferredIndexPath)) {
    return {
      ok: false,
      code: 'starter_demo_index_missing',
      indexPath: preferredIndexPath,
      message: 'The bundled starter demo ProjectIndex cache is missing.'
    };
  }
  try {
    const index = readJsonFile(preferredIndexPath);
    const root = prepared && prepared.root
      ? prepared.root
      : paths.starterDemoTemplate;
    refreshCachedIndexInfo(index, root);
    return {
      ok: true,
      root,
      projectName: projectName(index, root),
      includeExcerpts: preferredIndexPath === paths.starterDemoIndexWithExcerpts,
      indexPath: preferredIndexPath,
      indexSize: fileSize(preferredIndexPath),
      index,
      summary: summarizeIndex(index),
      fromCache: true
    };
  } catch (err) {
    return {
      ok: false,
      code: 'starter_demo_index_invalid',
      indexPath: preferredIndexPath,
      error: friendlyError(err),
      message: 'The bundled starter demo ProjectIndex cache could not be read.'
    };
  }
}

function ensureScratchDir(outDir) {
  const check = checkScratchDir(outDir);
  if (!check.ok) {
    throw new Error(check.message);
  }
  return check.path;
}

async function writeParserIndex(root, parserOut, paths) {
  const parser = require(paths.parser);
  const parserIndex = await parser.parseProject(root);
  fs.writeFileSync(parserOut, JSON.stringify(parserIndex, null, 2) + '\n', 'utf8');
  return parserIndex;
}

const INDEX_CACHE_VERSION = 1;

function projectCacheDir(outDir, root) {
  const id = crypto.createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 16);
  return path.join(outDir, 'index-cache', id);
}

function toolFileMtimeTag(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return filePath + ':' + stat.mtimeMs;
  } catch (_err) { return ''; }
}

function computeProjectFingerprint(root, toolPaths) {
  const sourceDir = path.join(root, 'source');
  const files = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, {withFileTypes: true}); }
    catch (_err) { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.isFile()) { continue; }
      if (!/\.dry$/i.test(entry.name)) { continue; }
      try {
        const stat = fs.statSync(full);
        files.push(path.relative(root, full) + ':' + stat.mtimeMs + ':' + stat.size);
      } catch (_err) { /* skip unreadable */ }
    }
  }
  if (fs.existsSync(sourceDir)) { walk(sourceDir); }
  files.sort();
  const hash = crypto.createHash('sha256');
  hash.update('v' + INDEX_CACHE_VERSION + '\n');
  // Include indexer + parser script mtimes so Studio updates invalidate the
  // cache automatically, without needing a manual INDEX_CACHE_VERSION bump.
  if (toolPaths) {
    const tag1 = toolFileMtimeTag(toolPaths.indexer);
    const tag2 = toolFileMtimeTag(toolPaths.parser);
    if (tag1) { hash.update('tool:' + tag1 + '\n'); }
    if (tag2) { hash.update('tool:' + tag2 + '\n'); }
  }
  for (const line of files) { hash.update(line + '\n'); }
  return {version: INDEX_CACHE_VERSION, fileCount: files.length, hash: hash.digest('hex'), root: path.resolve(root)};
}

function checkProjectCache(outDir, root, includeExcerpts, toolPaths) {
  const cacheDir = projectCacheDir(outDir, root);
  const fpPath = path.join(cacheDir, 'fingerprint.json');
  const indexName = includeExcerpts ? 'project-index-excerpts.json' : 'project-index.json';
  const indexPath = path.join(cacheDir, indexName);
  const result = {hit: false, cacheDir, indexPath, fpPath, firstTime: true, fingerprint: null};
  if (!fs.existsSync(fpPath) || !fs.existsSync(indexPath)) { return result; }
  try {
    const cached = JSON.parse(fs.readFileSync(fpPath, 'utf8'));
    const current = computeProjectFingerprint(root, toolPaths);
    result.firstTime = false;
    result.fingerprint = current;
    if (cached.hash === current.hash && cached.version === current.version) {
      result.hit = true;
    }
    return result;
  } catch (_err) { return result; }
}

function saveProjectCache(outDir, root, includeExcerpts, srcIndexPath, fingerprint, toolPaths) {
  try {
    const cacheDir = projectCacheDir(outDir, root);
    fs.mkdirSync(cacheDir, {recursive: true});
    const fp = fingerprint || computeProjectFingerprint(root, toolPaths);
    fs.writeFileSync(path.join(cacheDir, 'fingerprint.json'), JSON.stringify(fp, null, 2) + '\n', 'utf8');
    const indexName = includeExcerpts ? 'project-index-excerpts.json' : 'project-index.json';
    fs.copyFileSync(srcIndexPath, path.join(cacheDir, indexName));
    // Remove the other variant so a stale index from a previous build cannot
    // be served when the user switches the excerpts toggle.
    const staleName = includeExcerpts ? 'project-index.json' : 'project-index-excerpts.json';
    const stalePath = path.join(cacheDir, staleName);
    if (fs.existsSync(stalePath)) {
      fs.unlinkSync(stalePath);
    }
  } catch (_err) { /* cache save is non-fatal */ }
}

var INDEX_CACHE_MAX_ENTRIES = 3;

function pruneIndexCache(outDir) {
  const cacheRoot = path.join(outDir, 'index-cache');
  if (!fs.existsSync(cacheRoot)) { return; }
  let entries;
  try { entries = fs.readdirSync(cacheRoot, {withFileTypes: true}); }
  catch (_err) { return; }
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) { continue; }
    const dir = path.join(cacheRoot, entry.name);
    const fpPath = path.join(dir, 'fingerprint.json');
    let mtime = 0;
    let projectRoot = '';
    try {
      const stat = fs.statSync(fpPath);
      mtime = stat.mtimeMs;
      const fp = JSON.parse(fs.readFileSync(fpPath, 'utf8'));
      projectRoot = fp.root || '';
    } catch (_err) { /* treat as oldest */ }
    dirs.push({dir, mtime, projectRoot});
  }
  // Remove entries whose project root no longer exists on disk
  const orphans = dirs.filter((d) => d.projectRoot && !fs.existsSync(d.projectRoot));
  for (const orphan of orphans) {
    try { fs.rmSync(orphan.dir, {recursive: true, force: true}); } catch (_err) { /* skip */ }
  }
  // Keep the most recent INDEX_CACHE_MAX_ENTRIES entries; remove the rest
  const survivors = dirs.filter((d) => !orphans.includes(d));
  if (survivors.length <= INDEX_CACHE_MAX_ENTRIES) { return; }
  survivors.sort((a, b) => b.mtime - a.mtime);
  const evict = survivors.slice(INDEX_CACHE_MAX_ENTRIES);
  for (const entry of evict) {
    try { fs.rmSync(entry.dir, {recursive: true, force: true}); } catch (_err) { /* skip */ }
  }
}

async function buildProjectIndex(options) {
  const paths = resolveResourcePaths(options);
  emitProgress(options, {
    stage: 'preflight',
    percent: 4,
    label: 'Checking app files and project folder...'
  });
  const resources = checkResourcePaths(options);
  if (!resources.ok) {
    emitProgress(options, {
      stage: 'preflight',
      percent: 100,
      label: resources.message,
      error: true
    });
    return {
      ok: false,
      stage: 'preflight',
      checks: {resources},
      error: {message: resources.message},
      message: resources.message
    };
  }

  const validation = validateProjectRoot(options && options.root);
  if (!validation.ok) {
    emitProgress(options, {
      stage: 'preflight',
      percent: 100,
      label: validation.message,
      error: true
    });
    return {ok: false, error: validation, message: validation.message};
  }

  const root = validation.root;
  const scratchCheck = checkScratchDir(options && options.outDir);
  if (!scratchCheck.ok) {
    emitProgress(options, {
      stage: 'preflight',
      percent: 100,
      label: scratchCheck.message,
      error: true
    });
    return {
      ok: false,
      stage: 'preflight',
      checks: {resources, scratch: scratchCheck},
      error: {message: scratchCheck.message},
      message: scratchCheck.message
    };
  }
  const scratch = scratchCheck.path;
  const includeExcerpts = Boolean(options && options.includeExcerpts);
  const indexName = includeExcerpts ? 'project-index-excerpts.json' : 'project-index.json';
  const parserOut = path.join(scratch, 'parser-index.json');
  const indexPath = path.join(scratch, indexName);

  // --- Index cache: skip parser + indexer if source files haven't changed ---
  pruneIndexCache(scratch);
  emitProgress(options, {
    stage: 'cache-check',
    percent: 6,
    label: 'Checking for cached index...'
  });
  const cache = checkProjectCache(scratch, root, includeExcerpts, paths);
  if (cache.hit) {
    emitProgress(options, {
      stage: 'cache-load',
      percent: 85,
      label: 'Loading cached Project Map index...'
    });
    try {
      const index = JSON.parse(fs.readFileSync(cache.indexPath, 'utf8'));
      emitProgress(options, {
        stage: 'complete',
        percent: 100,
        label: 'Project Map index ready (cached).'
      });
      return {
        ok: true,
        root,
        projectName: projectName(index, root),
        includeExcerpts,
        indexPath: cache.indexPath,
        indexSize: fileSize(cache.indexPath),
        index,
        cached: true,
        summary: summarizeIndex(index)
      };
    } catch (_err) {
      // Cache read failed — fall through to full build
    }
  }

  const pythonCheck = checkPython(options);
  const python = pythonCheck.python;
  if (!pythonCheck.ok) {
    emitProgress(options, {
      stage: 'preflight',
      percent: 100,
      label: pythonCheck.message,
      error: true
    });
    return {
      ok: false,
      stage: 'preflight',
      checks: {resources, scratch: scratchCheck, python: pythonCheck},
      error: {message: pythonCheck.message},
      message: pythonCheck.message
    };
  }

  emitProgress(options, {
    stage: 'parser',
    percent: 24,
    label: cache.firstTime
      ? 'Parsing Dendry scenes...'
      : 'Project files changed. Rebuilding index...',
    hintKey: cache.firstTime ? 'desktop.indexHintFirstTime' : '',
    hint: cache.firstTime
      ? 'First time opening this project. Building a reusable index — future loads will be much faster. This may take 30–60 seconds.'
      : null
  });
  try {
    await writeParserIndex(root, parserOut, paths);
  } catch (err) {
    emitProgress(options, {
      stage: 'parser',
      percent: 100,
      label: 'Could not parse this Dendry project.',
      error: true
    });
    return {
      ok: false,
      stage: 'parser',
      error: friendlyError(err),
      message: 'Could not parse this Dendry project.'
    };
  }

  emitProgress(options, {
    stage: 'indexer',
    percent: 58,
    label: includeExcerpts ? 'Building review index with source excerpts...' : 'Building Project Map semantic index...',
    hintKey: cache.firstTime ? 'desktop.indexHintFirstTime' : '',
    hint: cache.firstTime
      ? 'First time opening this project. Building a reusable index — future loads will be much faster. This may take 30–60 seconds.'
      : null
  });
  const args = [
    paths.indexer,
    '--root', root,
    '--parser-index', parserOut,
    '--out', indexPath
  ];
  if (includeExcerpts) {
    args.push('--include-excerpts');
  }
  const result = spawnSync(python, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: PROJECT_INDEX_TIMEOUT_MS,
    maxBuffer: 1024 * 1024 * 8,
    windowsHide: true
  });
  if (result.status !== 0 || (result.error && result.status !== 0)) {
    const error = friendlyError(result.error || result.stderr || ('exit ' + result.status));
    const message = result.error && result.error.code === 'ENOENT'
      ? pythonCheck.message
      : ['Could not build the Project Map index.', error && error.message]
        .filter(Boolean)
        .join(' ');
    emitProgress(options, {
      stage: 'indexer',
      percent: 100,
      label: message,
      error: true
    });
    return {
      ok: false,
      stage: 'indexer',
      error,
      message
    };
  }

  emitProgress(options, {
    stage: 'read-index',
    percent: 88,
    label: 'Loading generated ProjectIndex...'
  });
  let index;
  try {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch (err) {
    emitProgress(options, {
      stage: 'read-index',
      percent: 100,
      label: 'The Project Map index was generated but could not be read.',
      error: true
    });
    return {
      ok: false,
      stage: 'read-index',
      error: friendlyError(err),
      message: 'The Project Map index was generated but could not be read.'
    };
  }

  saveProjectCache(scratch, root, includeExcerpts, indexPath, cache.fingerprint, paths);

  emitProgress(options, {
    stage: 'complete',
    percent: 100,
    label: 'Project Map index ready.'
  });
  return {
    ok: true,
    root,
    projectName: projectName(index, root),
    includeExcerpts,
    indexPath,
    indexSize: fileSize(indexPath),
    parserIndexPath: parserOut,
    index,
    summary: summarizeIndex(index)
  };
}

async function runDesktopDoctor(options) {
  const root = options && options.root;
  const resources = checkResourcePaths(options);
  const scratch = checkScratchDir(options && options.outDir);
  const python = checkPython(options);
  const projectRoot = validateProjectRoot(root);
  const checks = {
    resources,
    scratch,
    python,
    projectRoot
  };
  const ok = Object.values(checks).every((check) => check.ok);
  return {
    ok,
    checks,
    message: ok
      ? 'Dendry Mod Studio is ready to scan this project.'
      : 'Dendry Mod Studio needs attention before it can scan this project.'
  };
}

function applyInstallPlan(options) {
  const plan = options && options.plan;
  const projectRoot = options && options.projectRoot;
  const dryRun = !options || options.dryRun !== false;
  const allowAdvanced = options && options.allowAdvanced === true;
  const includeEvidence = options && options.includeEvidence === true;
  if (!plan || typeof plan !== 'object') {
    return {
      ok: false,
      dryRun,
      operationSummary: {safeApply: 0, guardedApply: 0, advancedApply: 0, manualReview: 0, refused: 0, total: 0},
      results: [],
      diagnostics: [{
        severity: 'error',
        code: 'desktop_install.plan_missing',
        message: 'Choose an install-plan JSON file before running the Install Assistant.',
        confidence: 'exact'
      }]
    };
  }
  const result = installPlan.applyInstallPlan(plan, {projectRoot, dryRun, allowAdvanced, includeEvidence});
  return Object.assign({}, result, {
    operationChecklist: installPlan.renderOperationChecklist(plan)
  });
}

// Bounded source-slice read (over-cap magic block entry); the path/range
// validation and hashing live in the focused source_slice_read.js sibling —
// this wrapper only resolves the project root the same way installs do.
function readSourceSlice(options) {
  const opts = options || {};
  const validated = validateProjectRoot(opts.root);
  if (!validated.ok) {
    return {ok: false, code: 'read_slice.no_project', message: validated.message || 'Open a project folder first.', path: String(opts.path || '')};
  }
  return sourceSliceRead.readSourceSlice({
    root: validated.root,
    path: opts.path,
    startLine: opts.startLine,
    endLine: opts.endLine
  });
}

function createRuntimePreview(options) {
  const opts = options || {};
  return runtimePreview.createRuntimePreview({
    projectRoot: opts.projectRoot,
    sessionsRoot: opts.sessionsRoot,
    plan: opts.plan,
    allowAdvanced: opts.allowAdvanced === true,
    allowProjectBuildWrapper: opts.allowProjectBuildWrapper === true,
    dryRun: false,
    projectIndex: opts.projectIndex || null,
    locale: opts.locale || ''
  });
}

function createRuntimeLens(options) {
  const opts = options || {};
  return runtimeLens.createRuntimeLens({
    projectRoot: opts.projectRoot,
    sessionsRoot: opts.sessionsRoot,
    plan: opts.plan,
    focus: opts.focus,
    allowAdvanced: opts.allowAdvanced === true,
    allowProjectBuildWrapper: opts.allowProjectBuildWrapper === true,
    projectIndex: opts.projectIndex || null,
    previewMode: opts.previewMode,
    buildRunner: opts.buildRunner,
    serverFactory: opts.serverFactory,
    now: opts.now
  });
}

function recordRuntimePreviewHistory(options) {
  return runtimePreview.recordDebugCommandHistory(
    options && options.sessionRoot,
    options && options.command,
    options && options.result
  );
}

function closeRuntimePreviewServer(callback) {
  return runtimePreview.closePreviewServer(callback);
}

const templateCatalog = require('./template_catalog');

function prepareCatalogTemplate(options) {
  const opts = options || {};
  const templatesRoot = opts.templatesRoot;
  const template = opts.template;
  if (!templatesRoot || !template || !template.id) {
    return {ok: false, message: 'Missing templatesRoot or template entry.'};
  }
  const installDir = templateCatalog.templateInstallDir(templatesRoot, template.id);
  const status = templateCatalog.checkTemplateStatus(templatesRoot, template.id);
  if (status === 'ready') {
    const validation = validateProjectRoot(installDir);
    return Object.assign({
      ok: validation.ok,
      id: template.id,
      title: template.title || template.id,
      root: validation.root || installDir,
      installDir,
      alreadyInstalled: true,
      message: validation.ok ? 'Catalog template opened.' : validation.message
    }, validation.ok ? {} : {error: validation});
  }
  const sourceUrl = templateCatalog.resolveReleaseAssetUrl(template, 'assetName');
  if (!sourceUrl) {
    return {ok: false, id: template.id, message: 'Cannot resolve download URL for template.'};
  }
  return {
    ok: true,
    id: template.id,
    title: template.title || template.id,
    installDir,
    sourceUrl,
    needsDownload: true,
    template
  };
}

function loadCatalogTemplateIndex(options) {
  const opts = options || {};
  const installDir = opts.installDir;
  if (!installDir) {
    return {ok: false, code: 'catalog_no_install_dir', message: 'No install directory provided.'};
  }
  const loaded = templateCatalog.loadTemplateIndex(installDir, opts.includeExcerpts);
  if (!loaded.ok) {
    return loaded;
  }
  const root = installDir;
  refreshCachedIndexInfo(loaded.index, root);
  return {
    ok: true,
    root,
    projectName: projectName(loaded.index, root),
    includeExcerpts: loaded.includeExcerpts,
    indexPath: loaded.indexPath,
    indexSize: fileSize(loaded.indexPath),
    index: loaded.index,
    summary: summarizeIndex(loaded.index),
    fromCache: true
  };
}

module.exports = {
  resolveResourcePaths,
  validateProjectRoot,
  friendlyError,
  resolveBundledPython,
  resolvePythonExecutable,
  checkPython,
  checkResourcePaths,
  checkScratchDir,
  runDesktopDoctor,
  buildProjectIndex,
  projectCacheDir,
  pruneIndexCache,
  loadStarterDemoIndex,
  applyInstallPlan,
  readSourceSlice,
  createRuntimePreview,
  createRuntimeLens,
  recordRuntimePreviewHistory,
  closeRuntimePreviewServer,
  prepareStarterDemo,
  readProjectInfoSource,
  refreshCachedIndexInfo,
  emitProgress,
  summarizeIndex,
  prepareCatalogTemplate,
  loadCatalogTemplateIndex
};
