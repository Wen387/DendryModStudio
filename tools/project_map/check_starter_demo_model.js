#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const DESKTOP_DIR = path.join(ROOT, 'desktop');
const TEMPLATE_ROOT = path.join(ROOT, 'templates', 'starter-demo');
const core = require('./desktop/studio_core.js');
const runtimePreview = require('./desktop/runtime_preview.js');
const objectCanvasModel = require('./authoring/object_authoring_canvas_model.js');
const previewObjectEditor = require('./viewer/preview_object_editor.js');
const {pythonCommand} = require('./check_python_command.js');
const compiler = require('dendrynexus/lib/parsers/compiler');
const {DendryEngine} = require('dendrynexus/lib/engine');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(TEMPLATE_ROOT, relativePath), 'utf8');
}

function sceneById(index, id) {
  return (index.scenes || []).find((scene) => String(scene && scene.id || '') === id) || null;
}

function collectDryFiles(sourceRoot, current, result) {
  const dir = current || sourceRoot;
  const out = result || [];
  fs.readdirSync(dir).forEach((name) => {
    const filePath = path.join(dir, name);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      collectDryFiles(sourceRoot, filePath, out);
    } else if (/\.dry$/.test(name)) {
      out.push({
        name: path.relative(sourceRoot, filePath).replace(/\\/g, '/'),
        contents: fs.readFileSync(filePath, 'utf8')
      });
    }
  });
  return out;
}

function compileGameFromTemplate(templateRoot) {
  return new Promise((resolve, reject) => {
    compiler.compileGame(collectDryFiles(path.join(templateRoot, 'source')), (err, game) => {
      if (err) {
        reject(err);
      } else {
        resolve(game);
      }
    });
  });
}

function captureStarterDemoHand(game) {
  return captureRuntimeHand(game, 'main');
}

function captureRuntimeHand(game, sceneId) {
  const output = {decks: [], hands: [], pinned: []};
  const noop = () => {};
  const ui = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'displayDecks') {
        return (decks) => {
          output.decks = decks.map((deck) => ({
            id: deck.id,
            canChoose: deck.canChoose,
            image: deck.image
          }));
        };
      }
      if (prop === 'displayHand') {
        return (hand, maxCards) => {
          output.hands.push({count: hand.length, maxCards});
        };
      }
      if (prop === 'displayPinnedCards') {
        return (cards) => {
          output.pinned = cards.map((card) => ({
            id: card.id,
            image: card.image
          }));
        };
      }
      return noop;
    }
  });
  const engine = new DendryEngine(ui, game);
  engine.beginGame();
  if (sceneId && engine.state.sceneId !== sceneId) {
    engine.goToScene(sceneId);
  }
  return output;
}

function syntheticPriorityHandGame(pinnedPriority) {
  return {
    title: 'Priority Hand Fixture',
    author: 'Studio Check',
    firstScene: 'main',
    qualities: {},
    qdisplays: {},
    tagLookup: {demo_action: {demo_card: true}},
    scenes: {
      main: {
        id: 'main',
        isHand: true,
        maxCards: 3,
        options: [
          {id: '@demo_deck', title: 'Monthly deck'},
          {id: '@demo_overview', title: 'Overview'}
        ],
        content: {type: 'paragraph', content: ''}
      },
      demo_deck: {
        id: 'demo_deck',
        title: 'Monthly deck',
        isDeck: true,
        priority: 1,
        cardImage: 'img/cards/deck.svg',
        options: [{id: '#demo_action', title: 'Draw action'}],
        content: {type: 'paragraph', content: ''}
      },
      demo_overview: {
        id: 'demo_overview',
        title: 'Overview',
        isPinnedCard: true,
        priority: pinnedPriority,
        cardImage: 'img/cards/overview.svg',
        content: {type: 'paragraph', content: ''}
      },
      demo_card: {
        id: 'demo_card',
        title: 'Demo card',
        tags: ['demo_action'],
        isCard: true,
        cardImage: 'img/cards/card.svg',
        content: {type: 'paragraph', content: ''}
      }
    }
  };
}

async function main() {
  [
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
    'source/scenes/root.scene.dry',
    'source/scenes/main.scene.dry',
    'source/scenes/status.scene.dry',
    'source/scenes/decks/demo_action_deck.scene.dry',
    'source/scenes/cards/demo_action_card.scene.dry',
    'source/scenes/cards/demo_office_overview_card.scene.dry',
    'source/scenes/cards/demo_field_operation_card.scene.dry',
    'source/scenes/cards/demo_civic_wire_card.scene.dry',
    'source/scenes/advisors/demo_advisor.scene.dry',
    'source/scenes/advisors/demo_media_advisor.scene.dry',
    'source/scenes/advisors/demo_budget_advisor.scene.dry',
    'source/scenes/demo_opening.scene.dry',
    'source/scenes/events/demo_campaign_pressure.scene.dry',
    'source/scenes/events/demo_case_hearing.scene.dry',
    'source/scenes/events/demo_back_room_talks.scene.dry',
    'source/scenes/events/demo_resolution_week.scene.dry',
    'source/scenes/events/demo_monthly_report.scene.dry',
    'source/scenes/events/demo_budget_leak.scene.dry',
    'source/scenes/events/demo_polling_shock.scene.dry',
    'source/scenes/events/demo_council_deadlock.scene.dry',
    'source/scenes/post_event.scene.dry',
    'source/qdisplays/qdemo_level.qdisplay.dry',
    'source/qualities/demo_pressure.quality.dry',
    'source/qualities/demo_case_strength.quality.dry',
    'source/qualities/demo_reform_mandate.quality.dry',
    'source/qualities/demo_resources.quality.dry',
    'source/qualities/demo_advisor_trust.quality.dry',
    'source/qualities/demo_card_progress.quality.dry',
    'source/qualities/demo_year.quality.dry',
    'source/qualities/demo_month.quality.dry',
    'source/qualities/demo_monthly_tick.quality.dry',
    'source/qualities/demo_press_risk.quality.dry',
    'source/qualities/demo_legislative_path.quality.dry',
    'source/qualities/demo_budget_leak_seen.quality.dry',
    'source/qualities/demo_polling_shock_seen.quality.dry',
    'source/qualities/demo_council_deadlock_seen.quality.dry',
    'project-index.json',
    'project-index-excerpts.json'
  ].forEach((relativePath) => {
    assert(fs.existsSync(path.join(TEMPLATE_ROOT, relativePath)), 'starter demo should include ' + relativePath);
  });

  const info = read('source/info.dry');
  const packageJson = JSON.parse(read('package.json'));
  const bundledProjectIndex = JSON.parse(read('project-index.json'));
  const bundledProjectIndexExcerpts = JSON.parse(read('project-index-excerpts.json'));
  const root = read('source/scenes/root.scene.dry');
  const status = read('source/scenes/status.scene.dry');
  const main = read('source/scenes/main.scene.dry');
  const deck = read('source/scenes/decks/demo_action_deck.scene.dry');
  const actionCard = read('source/scenes/cards/demo_action_card.scene.dry');
  const overviewCard = read('source/scenes/cards/demo_office_overview_card.scene.dry');
  const fieldOperationCard = read('source/scenes/cards/demo_field_operation_card.scene.dry');
  const civicWireCard = read('source/scenes/cards/demo_civic_wire_card.scene.dry');
  const advisor = read('source/scenes/advisors/demo_advisor.scene.dry');
  const mediaAdvisor = read('source/scenes/advisors/demo_media_advisor.scene.dry');
  const budgetAdvisor = read('source/scenes/advisors/demo_budget_advisor.scene.dry');
  const opening = read('source/scenes/demo_opening.scene.dry');
  const campaignPressure = read('source/scenes/events/demo_campaign_pressure.scene.dry');
  const caseHearing = read('source/scenes/events/demo_case_hearing.scene.dry');
  const backRoomTalks = read('source/scenes/events/demo_back_room_talks.scene.dry');
  const resolutionWeek = read('source/scenes/events/demo_resolution_week.scene.dry');
  const monthlyReport = read('source/scenes/events/demo_monthly_report.scene.dry');
  const budgetLeak = read('source/scenes/events/demo_budget_leak.scene.dry');
  const pollingShock = read('source/scenes/events/demo_polling_shock.scene.dry');
  const councilDeadlock = read('source/scenes/events/demo_council_deadlock.scene.dry');
  const postEvent = read('source/scenes/post_event.scene.dry');
  const qdemoLevel = read('source/qdisplays/qdemo_level.qdisplay.dry');

  assert(info.includes('Dendry Mod Studio Starter Demo'), 'starter demo should have a player-facing title');
  assert(packageJson.private === true, 'starter demo package should be private');
  assert(packageJson.dependencies && packageJson.dependencies.dendrynexus, 'starter demo package should signal DendryNexus runtime dependency');
  assert(root.includes('demo_support') && root.includes('demo_conflict'), 'starter demo root should initialize demo variables');
  assert(root.includes('demo_resources') && root.includes('demo_advisor_trust'), 'starter demo root should initialize whiteboard card/advisor variables');
  assert(root.includes('demo_pressure') && root.includes('demo_reform_mandate'), 'starter demo root should initialize complex event chain variables');
  assert(root.includes('demo_year') && root.includes('demo_month'), 'starter demo root should initialize the September 2032 calendar');
  assert(root.includes('news_1') && root.includes('demo_press_risk'), 'starter demo root should initialize civic wire news state');
  assert(root.includes('// ====== U. EVENT SEEN FLAGS ======'), 'starter demo root should expose world-event install anchor');
  assert(root.includes('@demo_office_overview_card: Open the office overview card'), 'starter demo root should open the reusable overview card');
  assert(root.includes('@demo_campaign_pressure: Play the civic reform chain'), 'starter demo root should link to the complex event chain');
  assert(root.includes('@main: Open the workspace hand'), 'starter demo root should link to the whiteboard hand');
  assert(root.includes('@post_event: Advance one month'), 'starter demo root should link to the monthly time tick');
  assert(root.includes('@demo_opening.demo_status'), 'starter demo root should link to the cross-scene status section with a qualified id');
  assert(root.includes('@demo_opening.support_followup'), 'starter demo root should link to the cross-scene follow-up section with a qualified id');
  assert(status.includes('Civic Reform Dashboard'), 'starter demo should include a status sidebar scene for the default Dendry HTML shell');
  assert(status.includes('Calendar: [+ demo_year +] / [+ demo_month +]') && status.includes('Latest civic wire'), 'starter demo status sidebar should show time and news');
  assert(status.includes('demo_support') && status.includes('demo_conflict'), 'starter demo status sidebar should reflect demo variables');
  assert(status.includes('qdemo_level') && status.includes('demo_card_progress'), 'starter demo status sidebar should show qdisplay-backed whiteboard variables');
  assert(status.includes('demo_pressure') && status.includes('demo_resolution_seen') && status.includes('demo_press_risk'), 'starter demo status sidebar should show complex event chain and news pressure state');
  assert(main.includes('is-hand: true') && main.includes('@demo_action_deck') && main.includes('#demo_advisor'), 'starter demo should include a hand with deck and advisor lanes');
  assert(main.includes('@demo_office_overview_card') && main.includes('@demo_media_advisor') && main.includes('@demo_budget_advisor') && main.includes('@post_event'), 'starter demo hand should expose overview, multiple advisors, and the monthly tick');
  assert(main.includes('Monthly office workspace.') && !main.includes('This hand scene is the repeatable workspace.'), 'starter demo hand should avoid a long first paragraph that collides with Dendry dropcap styling');
  assert(deck.includes('is-deck: true') && deck.includes('#demo_action') && deck.includes('Monthly Action Deck'), 'starter demo should include a monthly action deck');
  assert(deck.includes('card-image: img/cards/demo_action_deck.svg'), 'starter demo monthly deck should render with a visible card face');
  assert(actionCard.includes('is-card: true') && actionCard.includes('demo_card_progress += 1'), 'starter demo should include a minimal action card');
  assert(actionCard.includes('card-image: img/cards/demo_action_card.svg'), 'starter demo action card should render with a visible card face');
  assert(actionCard.includes('priority: 1'), 'starter demo action card should share deck draw priority with other demo action cards');
  assert(actionCard.includes('Prepare a case file') && actionCard.includes('demo_case_strength += 2'), 'starter demo action card should prepare the complex event chain');
  assert(actionCard.includes('go-to: post_event'), 'starter demo action card choices should be able to advance the month');
  assert(overviewCard.includes('is-card: true') && overviewCard.includes('is-pinned-card: true') && overviewCard.includes('Office Overview Card') && overviewCard.includes('@post_event: Advance one month'), 'starter demo should move the long intro into a repeatable pinned overview card');
  assert(overviewCard.includes('card-image: img/cards/demo_office_overview_card.svg'), 'starter demo overview card should render with a visible card face');
  assert(overviewCard.includes('priority: 1'), 'starter demo overview card should not hide deck/advisor choices through a higher hand priority');
  assert(fieldOperationCard.includes('is-card: true') && fieldOperationCard.includes('go-to: post_event') && fieldOperationCard.includes('Canvass the districts'), 'starter demo should include a monthly field operation card');
  assert(fieldOperationCard.includes('card-image: img/cards/demo_field_operation_card.svg'), 'starter demo field operation card should render with a visible card face');
  assert(civicWireCard.includes('is-card: true') && civicWireCard.includes('go-to: post_event') && civicWireCard.includes('Feed the civic wire'), 'starter demo should include a monthly news card');
  assert(civicWireCard.includes('card-image: img/cards/demo_civic_wire_card.svg'), 'starter demo civic wire card should render with a visible card face');
  assert(advisor.includes('is-pinned-card: true') && advisor.includes('demo_advisor_trust += 1'), 'starter demo should include a minimal advisor-like pinned card');
  assert(advisor.includes('card-image: img/cards/demo_advisor.svg'), 'starter demo advisor card should render with a visible card face');
  assert(advisor.includes('Request private counsel') && advisor.includes('demo_cabinet_balance += 2'), 'starter demo advisor should prepare the complex event chain');
  assert(mediaAdvisor.includes('is-pinned-card: true') && mediaAdvisor.includes('demo_press_risk += 1'), 'starter demo should include a media advisor that prepares news pressure');
  assert(mediaAdvisor.includes('card-image: img/cards/demo_media_advisor.svg'), 'starter demo media advisor should render with a visible card face');
  assert(budgetAdvisor.includes('is-pinned-card: true') && budgetAdvisor.includes('demo_legislative_path += 2'), 'starter demo should include a budget advisor that prepares route state');
  assert(budgetAdvisor.includes('card-image: img/cards/demo_budget_advisor.svg'), 'starter demo budget advisor should render with a visible card face');
  assert(!qdemoLevel.includes(': none') && qdemoLevel.includes('(--0) none'), 'starter demo qdisplay text should not double-print status colons in the sidebar');
  assert(opening.includes('tags: event'), 'starter demo should include an event-like scene');
  assert(opening.includes('Civic Reform Office Briefing'), 'starter demo should demonstrate player-facing event text');
  assert(opening.includes('view-if: demo_support > 0'), 'starter demo should demonstrate a condition');
  assert(opening.includes('on-arrival: demo_support += 1; demo_public_attention += 1'), 'starter demo should demonstrate a parser-backed effect');
  assert(campaignPressure.includes('Civic Reform Campaign') && campaignPressure.includes('go-to: demo_case_hearing'), 'starter demo should include the first playable complex-chain event');
  assert(campaignPressure.includes('face-image: img/events/demo_campaign_pressure.svg'), 'starter demo campaign event should include an editable illustration');
  assert(caseHearing.includes('Move into back-room talks') && caseHearing.includes('go-to: demo_back_room_talks'), 'starter demo hearing should route into a playable branch event');
  assert(backRoomTalks.includes('Back-room Talks') && backRoomTalks.includes('go-to: demo_resolution_week'), 'starter demo should include the playable back-room branch event');
  assert(resolutionWeek.includes('Resolution Week') && resolutionWeek.includes('demo_resolution_result = 3'), 'starter demo should include a state-driven complex-chain conclusion');
  assert(monthlyReport.includes('Monthly Civic Docket') && monthlyReport.includes('@demo_budget_leak') && monthlyReport.includes('@demo_council_deadlock'), 'starter demo should include a monthly docket with conditional event popups');
  assert(monthlyReport.includes('face-image: img/events/demo_monthly_docket.svg'), 'starter demo monthly docket should include an editable illustration');
  assert(budgetLeak.includes('choose-if: demo_month >= 10') && budgetLeak.includes('demo_press_risk >= 2'), 'starter demo budget leak should require time and layered news pressure');
  assert(budgetLeak.includes('face-image: img/events/demo_budget_leak.svg'), 'starter demo budget leak should include an editable illustration');
  assert(pollingShock.includes('choose-if: demo_month >= 10') && pollingShock.includes('demo_support >= 3'), 'starter demo polling shock should require time and support');
  assert(pollingShock.includes('face-image: img/events/demo_polling_shock.svg'), 'starter demo polling shock should include an editable illustration');
  assert(councilDeadlock.includes('Side Letter') && councilDeadlock.includes('demo_legislative_path >= 2'), 'starter demo council deadlock should include nested branch state');
  assert(councilDeadlock.includes('face-image: img/events/demo_council_deadlock.svg'), 'starter demo council deadlock should include an editable illustration');
  assert(postEvent.includes('if (Q.demo_support === undefined)'), 'starter demo should include save migration guards');
  assert(postEvent.includes('if (Q.demo_resources === undefined)'), 'starter demo should migrate whiteboard card/advisor variables');
  assert(postEvent.includes('if (Q.demo_pressure === undefined)'), 'starter demo should migrate complex event chain variables');
  assert(postEvent.includes('Q.demo_month += 1') && postEvent.includes('Q.news_3 = Q.news_2'), 'starter demo post_event should advance time and rotate civic wire news');
  assert(postEvent.includes('// Save compatibility: post_event split (post_event_news)'), 'starter demo should expose post_event install anchor');
  assert(bundledProjectIndex.project.root === '__STARTER_DEMO_TEMPLATE_ROOT__', 'starter demo cached ProjectIndex should not store a developer absolute path');
  assert(bundledProjectIndexExcerpts.project.root === '__STARTER_DEMO_TEMPLATE_ROOT__', 'starter demo cached excerpt ProjectIndex should not store a developer absolute path');
  assert((bundledProjectIndex.summary.effectCount || 0) >= 145, 'starter demo cached ProjectIndex should expose parser-backed player-facing effects');
  assert((bundledProjectIndex.summary.effectClauseCount || 0) >= 145, 'starter demo cached ProjectIndex should expose parser-backed effect clauses');
  assert((bundledProjectIndex.summary.newsItemCount || 0) >= 4, 'starter demo cached ProjectIndex should expose SDAAH-like news surface items');
  assert((bundledProjectIndex.summary.imageAssetCount || 0) >= 13, 'starter demo cached ProjectIndex should expose editable demo event and card images');
  assert((bundledProjectIndex.summary.opaqueJsBlockCount || 0) <= 1, 'starter demo should keep player-facing opaque JS to a minimum');
  assert(sceneById(bundledProjectIndex, 'demo_budget_leak').assetRefs.some((asset) => asset.path === 'img/events/demo_budget_leak.svg' && asset.directive === 'face-image'), 'starter demo indexed events should expose face-image asset refs');
  assert(sceneById(bundledProjectIndex, 'demo_action_card').assetRefs.some((asset) => asset.path === 'img/cards/demo_action_card.svg' && asset.directive === 'card-image'), 'starter demo indexed cards should expose card-image asset refs');
  const runtimeHand = captureStarterDemoHand(await compileGameFromTemplate(TEMPLATE_ROOT));
  assert(runtimeHand.decks.length === 1 && runtimeHand.decks[0].id === 'demo_action_deck' && runtimeHand.decks[0].canChoose === true, 'Dendry runtime hand should display the monthly action deck as a drawable deck');
  assert(runtimeHand.pinned.map((card) => card.id).sort().join(',') === 'demo_advisor,demo_budget_advisor,demo_media_advisor,demo_office_overview_card', 'Dendry runtime hand should display the overview and all advisor cards as pinned cards');
  assert(runtimeHand.decks[0].image === 'img/cards/demo_action_deck.svg' && runtimeHand.pinned.every((card) => /^img\/cards\//.test(card.image || '')), 'Dendry runtime hand should receive visible card-image refs for deck and pinned cards');
  const highPriorityHand = captureRuntimeHand(syntheticPriorityHandGame(5), 'main');
  assert(highPriorityHand.decks.length === 0 && highPriorityHand.pinned.map((card) => card.id).join(',') === 'demo_overview', 'Dendry runtime hand should let a higher-priority pinned choice hide lower-priority deck choices');
  const equalPriorityHand = captureRuntimeHand(syntheticPriorityHandGame(1), 'main');
  assert(equalPriorityHand.decks.map((deck) => deck.id).join(',') === 'demo_deck' && equalPriorityHand.pinned.map((card) => card.id).join(',') === 'demo_overview', 'Dendry runtime hand should show deck and pinned card together when their priorities match');
  const campaignCanvas = objectCanvasModel.buildExistingCanvas(bundledProjectIndex, 'events', 'demo_campaign_pressure', {});
  assert(campaignCanvas.ok, 'starter demo campaign pressure event should open in Object Canvas');
  const campaignEditorHtml = previewObjectEditor.render(campaignCanvas);
  assert(campaignEditorHtml.includes('data-preview-object-choice="quiet_briefing"') && campaignEditorHtml.includes('data-object-canvas-field="block:section_text_demo_campaign_pressure_quiet_briefing"'), 'right editor should expose complex event option result text in the owning choice card');
  const quietResultFieldCount = (campaignEditorHtml.match(/data-object-canvas-field="block:section_text_demo_campaign_pressure_quiet_briefing"/g) || []).length;
  assert(quietResultFieldCount === 1, 'right editor should not render duplicate controls for the same complex event option result field');
  const quietSectionAdd = campaignCanvas.eventBody.structureActions.find((field) => field.id === 'structure_add_option_section_demo_campaign_pressure_quiet_briefing');
  assert(quietSectionAdd && quietSectionAdd.editability === 'guarded_apply', 'complex event result sections without existing nested choices should still expose guarded source-backed option insertion');
  assert(quietSectionAdd.structureSourceBlock && quietSectionAdd.structureSourceBlock.kind === 'section_text_option_insert_anchor', 'section option insertion should use the result prose tail as an exact source anchor');
  const campaignEdited = objectCanvasModel.buildExistingCanvas(bundledProjectIndex, 'events', 'demo_campaign_pressure', {
    values: {
      __structureCommands: [{
        type: 'add_option',
        action: 'add_option',
        fieldId: 'structure_add_option_section_demo_campaign_pressure_quiet_briefing',
        sectionId: 'demo_campaign_pressure.quiet_briefing',
        value: [
          '- @press_witness: Invite the press to witness the quiet bargain.',
          '# press_witness',
          'result-mode: native',
          'choose-if: demo_public_attention >= 1',
          'unavailable-subtitle: No reporter is close enough to trust the leak.',
          'A trusted reporter waits in the side corridor.'
        ].join('\n')
      }]
    }
  });
  assert(campaignEdited.changeState.installPlan.operations.some((operation) =>
    operation.type === 'insert_text' &&
    operation.safety === 'guarded_apply' &&
    String(operation.content || '').includes('@press_witness') &&
    String(operation.content || '').includes('choose-if: demo_public_attention >= 1')
  ), 'adding a nested option to a complex event result should produce a guarded source-backed insert');
  assert(!campaignEdited.changeState.installPlan.operations.some((operation) => operation.type === 'manual_snippet'), 'source-backed complex event nested option insertion should not fall back to a manual snippet');

  const preparedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_starter_demo_model_'));
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_starter_demo_index_'));
  const prepared = core.prepareStarterDemo({
    desktopDir: DESKTOP_DIR,
    workspaceRoot: preparedRoot
  });
  assert(prepared.ok, 'desktop core should prepare starter demo copy');
  assert(prepared.root.startsWith(preparedRoot), 'prepared starter demo should be a writable copy');
  assert(fs.existsSync(path.join(prepared.root, 'source', 'info.dry')), 'prepared starter demo should contain source/info.dry');
  assert(fs.existsSync(path.join(prepared.root, 'package.json')), 'prepared starter demo should contain package.json for Runtime Preview builds');

  const cachedIndex = core.loadStarterDemoIndex({
    desktopDir: DESKTOP_DIR,
    prepared,
    includeExcerpts: false
  });
  assert(cachedIndex.ok, 'starter demo should open from the bundled ProjectIndex cache');
  assert(cachedIndex.fromCache === true, 'starter demo cached ProjectIndex should report cache usage');
  assert(cachedIndex.root === prepared.root, 'starter demo cached ProjectIndex should use the writable template copy as root');
  assert(cachedIndex.index.project.root === prepared.root, 'starter demo cached ProjectIndex should rewrite project.root');
  assert(cachedIndex.projectName === 'Dendry Mod Studio Starter Demo', 'starter demo cached ProjectIndex should keep template title');
  assert(cachedIndex.summary.sceneCount >= 3, 'starter demo cached ProjectIndex should expose multiple scenes');
  assert(cachedIndex.summary.eventCount >= 1, 'starter demo cached ProjectIndex should expose one event-like scene');
  assert(cachedIndex.summary.cardCount >= 1, 'starter demo cached ProjectIndex should expose one action card');
  assert(cachedIndex.index.variables.some((item) => item.name === 'demo_support'), 'starter demo cached ProjectIndex should include demo_support variable');

  const cachedExcerpts = core.loadStarterDemoIndex({
    desktopDir: DESKTOP_DIR,
    prepared,
    includeExcerpts: true
  });
  assert(cachedExcerpts.ok, 'starter demo should open from the bundled excerpt ProjectIndex cache');
  assert(cachedExcerpts.includeExcerpts === true, 'starter demo excerpt cache should report excerpts');
  assert(JSON.stringify(cachedExcerpts.index).includes('"excerpt"'), 'starter demo excerpt cache should include source excerpts');

  fs.rmSync(path.join(prepared.root, 'package.json'), {force: true});
  fs.rmSync(path.join(prepared.root, 'source', 'scenes', 'main.scene.dry'), {force: true});
  fs.rmSync(path.join(prepared.root, 'source', 'scenes', 'cards'), {recursive: true, force: true});
  fs.rmSync(path.join(prepared.root, 'source', 'scenes', 'advisors'), {recursive: true, force: true});
  fs.rmSync(path.join(prepared.root, 'source', 'scenes', 'decks'), {recursive: true, force: true});
  fs.rmSync(path.join(prepared.root, 'source', 'qualities'), {recursive: true, force: true});
  fs.rmSync(path.join(prepared.root, 'source', 'qdisplays'), {recursive: true, force: true});
  fs.writeFileSync(
    path.join(prepared.root, 'source', 'scenes', 'root.scene.dry'),
    root.replace('@demo_opening.demo_status', '@demo_status')
      .replace('@demo_opening.support_followup', '@support_followup')
      .replace('- @main: Open the workspace hand\n', '')
      .replace('if (Q.demo_resources === undefined) { Q.demo_resources = 2; }\n', '')
      .replace('if (Q.demo_advisor_trust === undefined) { Q.demo_advisor_trust = 0; }\n', '')
      .replace('if (Q.demo_card_progress === undefined) { Q.demo_card_progress = 0; }\n', ''),
    'utf8'
  );
  const repaired = core.prepareStarterDemo({
    desktopDir: DESKTOP_DIR,
    workspaceRoot: preparedRoot
  });
  assert(repaired.ok && repaired.reused === true, 'desktop core should reopen an existing starter demo workspace');
  assert(fs.existsSync(path.join(repaired.root, 'package.json')), 'desktop core should repair old starter demo copies missing package.json');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'scenes', 'main.scene.dry')), 'desktop core should repair old starter demo copies missing the hand scene');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'scenes', 'cards', 'demo_action_card.scene.dry')), 'desktop core should repair old starter demo copies missing the action card');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'scenes', 'cards', 'demo_office_overview_card.scene.dry')), 'desktop core should repair old starter demo copies missing the overview card');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'scenes', 'cards', 'demo_field_operation_card.scene.dry')), 'desktop core should repair old starter demo copies missing monthly cards');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'scenes', 'advisors', 'demo_advisor.scene.dry')), 'desktop core should repair old starter demo copies missing the advisor card');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'scenes', 'advisors', 'demo_media_advisor.scene.dry')), 'desktop core should repair old starter demo copies missing the media advisor');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'scenes', 'events', 'demo_monthly_report.scene.dry')), 'desktop core should repair old starter demo copies missing the monthly docket');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'img', 'cards', 'demo_action_card.svg')), 'desktop core should repair old starter demo copies missing demo card images');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'img', 'cards', 'demo_office_overview_card.svg')), 'desktop core should repair old starter demo copies missing overview card images');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'img', 'events', 'demo_budget_leak.svg')), 'desktop core should repair old starter demo copies missing demo event images');
  assert(fs.existsSync(path.join(repaired.root, 'source', 'qdisplays', 'qdemo_level.qdisplay.dry')), 'desktop core should repair old starter demo copies missing qdisplays');
  const repairedRoot = fs.readFileSync(path.join(repaired.root, 'source', 'scenes', 'root.scene.dry'), 'utf8');
  assert(repairedRoot.includes('@demo_opening.demo_status'), 'desktop core should repair old starter demo status links');
  assert(repairedRoot.includes('@demo_opening.support_followup'), 'desktop core should repair old starter demo follow-up links');
  assert(repairedRoot.includes('@demo_office_overview_card: Open the office overview card'), 'desktop core should repair old starter demo overview card route');
  assert(repairedRoot.includes('@main: Open the workspace hand'), 'desktop core should repair old starter demo hand route');
  assert(repairedRoot.includes('Q.demo_resources === undefined'), 'desktop core should repair old starter demo whiteboard variables');
  assert(repairedRoot.includes('Q.demo_year === undefined'), 'desktop core should repair old starter demo time variables');
  assert(repairedRoot.includes('@demo_campaign_pressure: Play the civic reform chain'), 'desktop core should repair old starter demo complex-chain route');
  assert(repairedRoot.includes('@post_event: Advance one month'), 'desktop core should repair old starter demo monthly route');

  const compatibilityRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_starter_demo_compat_'));
  const compatibilityPrepared = core.prepareStarterDemo({
    desktopDir: DESKTOP_DIR,
    workspaceRoot: compatibilityRoot
  });
  assert(compatibilityPrepared.ok, 'desktop core should prepare a compatibility repair fixture');
  const legacyHandText = [
    'This hand scene is the repeatable workspace. Card-style DendryNexus',
    'projects often use a hand like this for monthly actions, standing advisors,',
    'circles, or other tools the player can revisit.',
    '',
    'Use the action deck to spend resources and build a case. Use the advisor to',
    'shape support and compromise. The civic reform chain reads those variables.'
  ].join('\n');
  fs.writeFileSync(
    path.join(compatibilityPrepared.root, 'source', 'scenes', 'main.scene.dry'),
    main.replace('Monthly office workspace.\n\nClick the monthly deck to draw reusable action cards. Pinned briefing and\nadvisor cards stay available, while drawn cards fill the hand slots below.\nThis is the simplified SDAAH-like loop: prepare, advance the month, then let\nevents read the changed Q variables.', legacyHandText),
    'utf8'
  );
  fs.writeFileSync(
    path.join(compatibilityPrepared.root, 'source', 'qdisplays', 'qdemo_level.qdisplay.dry'),
    qdemoLevel.replace('(--0) none', '(--0) : none').replace('(1..2) low', '(1..2) : low').replace('(3..5) medium', '(3..5) : medium').replace('(6..) high', '(6..) : high'),
    'utf8'
  );
  [
    ['source/scenes/decks/demo_action_deck.scene.dry', 'card-image: img/cards/demo_action_deck.svg\n'],
    ['source/scenes/cards/demo_action_card.scene.dry', 'card-image: img/cards/demo_action_card.svg\n'],
    ['source/scenes/cards/demo_field_operation_card.scene.dry', 'card-image: img/cards/demo_field_operation_card.svg\n'],
    ['source/scenes/cards/demo_civic_wire_card.scene.dry', 'card-image: img/cards/demo_civic_wire_card.svg\n'],
    ['source/scenes/cards/demo_office_overview_card.scene.dry', 'is-pinned-card: true\ncard-image: img/cards/demo_office_overview_card.svg\n'],
    ['source/scenes/advisors/demo_advisor.scene.dry', 'card-image: img/cards/demo_advisor.svg\n'],
    ['source/scenes/advisors/demo_media_advisor.scene.dry', 'card-image: img/cards/demo_media_advisor.svg\n'],
    ['source/scenes/advisors/demo_budget_advisor.scene.dry', 'card-image: img/cards/demo_budget_advisor.svg\n']
  ].forEach(([relativePath, removedText]) => {
    const target = path.join(compatibilityPrepared.root, relativePath);
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(removedText, ''), 'utf8');
  });
  const compatibilityDeckPath = path.join(compatibilityPrepared.root, 'source', 'scenes', 'decks', 'demo_action_deck.scene.dry');
  fs.writeFileSync(
    compatibilityDeckPath,
    fs.readFileSync(compatibilityDeckPath, 'utf8')
      .replace('title: Monthly Action Deck', 'title: Starter Deck')
      .replace('subtitle: Reusable office cards; many choices advance the month', 'subtitle: A minimal action-card deck'),
    'utf8'
  );
  const compatibilityActionPath = path.join(compatibilityPrepared.root, 'source', 'scenes', 'cards', 'demo_action_card.scene.dry');
  fs.writeFileSync(compatibilityActionPath, fs.readFileSync(compatibilityActionPath, 'utf8').replace('priority: 1', 'priority: 0'), 'utf8');
  const compatibilityOverviewPath = path.join(compatibilityPrepared.root, 'source', 'scenes', 'cards', 'demo_office_overview_card.scene.dry');
  fs.writeFileSync(compatibilityOverviewPath, fs.readFileSync(compatibilityOverviewPath, 'utf8').replace('priority: 1', 'priority: 5'), 'utf8');
  [compatibilityActionPath, compatibilityOverviewPath].forEach((target) => {
    fs.writeFileSync(target, fs.readFileSync(target, 'utf8').replace(/\n\n=/, '\n='), 'utf8');
  });
  const compatibilityRepaired = core.prepareStarterDemo({
    desktopDir: DESKTOP_DIR,
    workspaceRoot: compatibilityRoot
  });
  assert(compatibilityRepaired.ok && compatibilityRepaired.reused === true, 'desktop core should repair existing starter demo copies without a full refresh');
  const compatibilityMain = fs.readFileSync(path.join(compatibilityRepaired.root, 'source', 'scenes', 'main.scene.dry'), 'utf8');
  const compatibilityQDisplay = fs.readFileSync(path.join(compatibilityRepaired.root, 'source', 'qdisplays', 'qdemo_level.qdisplay.dry'), 'utf8');
  const compatibilityDeck = fs.readFileSync(path.join(compatibilityRepaired.root, 'source', 'scenes', 'decks', 'demo_action_deck.scene.dry'), 'utf8');
  const compatibilityAction = fs.readFileSync(path.join(compatibilityRepaired.root, 'source', 'scenes', 'cards', 'demo_action_card.scene.dry'), 'utf8');
  const compatibilityOverview = fs.readFileSync(path.join(compatibilityRepaired.root, 'source', 'scenes', 'cards', 'demo_office_overview_card.scene.dry'), 'utf8');
  const compatibilityAdvisor = fs.readFileSync(path.join(compatibilityRepaired.root, 'source', 'scenes', 'advisors', 'demo_advisor.scene.dry'), 'utf8');
  assert(compatibilityMain.includes('Monthly office workspace.') && !compatibilityMain.includes('This hand scene is the repeatable workspace.'), 'desktop core should repair existing starter demo hand copy text that breaks dropcap layout');
  assert(compatibilityQDisplay.includes('(--0) none') && !compatibilityQDisplay.includes(': none'), 'desktop core should repair existing starter demo qdisplay output labels');
  assert(compatibilityDeck.includes('title: Monthly Action Deck') && compatibilityDeck.includes('card-image: img/cards/demo_action_deck.svg'), 'desktop core should repair existing starter demo deck title and card image');
  assert(compatibilityAction.includes('priority: 1') && /\npriority:\s*1\n\n= Starter Action Card/.test(compatibilityAction), 'desktop core should repair existing starter demo action card priority and preserve the metadata/body blank line');
  assert(compatibilityOverview.includes('is-pinned-card: true') && compatibilityOverview.includes('card-image: img/cards/demo_office_overview_card.svg') && /\npriority:\s*1\n\n= Dendry Mod Studio Starter Demo/.test(compatibilityOverview), 'desktop core should repair existing starter demo overview pinned card image, hand priority, and metadata/body blank line');
  assert(compatibilityAdvisor.includes('card-image: img/cards/demo_advisor.svg'), 'desktop core should repair existing starter demo advisor card images even when the old advisor title is still present');

  const staleWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_starter_demo_stale_'));
  const staleDemoRoot = path.join(staleWorkspaceRoot, 'starter-demo');
  fs.mkdirSync(path.join(staleDemoRoot, 'source', 'scenes', 'events'), {recursive: true});
  fs.writeFileSync(path.join(staleDemoRoot, 'source', 'info.dry'), 'title: Dendry Mod Studio Starter Demo\n', 'utf8');
  fs.writeFileSync(path.join(staleDemoRoot, 'source', 'scenes', 'demo_opening.scene.dry'), 'title: A Small Campaign Office\n', 'utf8');
  fs.writeFileSync(path.join(staleDemoRoot, 'source', 'scenes', 'status.scene.dry'), '= Old Demo Status\n', 'utf8');
  fs.writeFileSync(path.join(staleDemoRoot, 'source', 'scenes', 'events', 'demo_campaign_pressure.scene.dry'), '= A Small Campaign Office\n', 'utf8');
  const refreshed = core.prepareStarterDemo({
    desktopDir: DESKTOP_DIR,
    workspaceRoot: staleWorkspaceRoot,
    refreshIfStale: true
  });
  assert(refreshed.ok && refreshed.refreshed === true, 'desktop core should refresh stale bundled demo workspace copies');
  assert(refreshed.backupRoot && fs.existsSync(path.join(refreshed.backupRoot, 'source', 'info.dry')), 'desktop core should keep a backup before refreshing a stale demo');
  const refreshedCampaign = fs.readFileSync(path.join(refreshed.root, 'source', 'scenes', 'events', 'demo_campaign_pressure.scene.dry'), 'utf8');
  assert(refreshedCampaign.includes('Civic Reform Campaign'), 'refreshed starter demo should use the current playable Civic Reform template');

  const freshWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_starter_demo_fresh_'));
  const freshDemoRoot = path.join(freshWorkspaceRoot, 'starter-demo');
  fs.mkdirSync(path.join(freshDemoRoot, 'source', 'scenes', 'events'), {recursive: true});
  fs.writeFileSync(path.join(freshDemoRoot, 'source', 'info.dry'), 'title: Dendry Mod Studio Starter Demo\n', 'utf8');
  fs.writeFileSync(path.join(freshDemoRoot, 'source', 'scenes', 'demo_opening.scene.dry'), 'title: Civic Reform Office Briefing\n', 'utf8');
  fs.writeFileSync(path.join(freshDemoRoot, 'source', 'scenes', 'status.scene.dry'), '= Civic Reform Dashboard\n', 'utf8');
  fs.writeFileSync(path.join(freshDemoRoot, 'source', 'scenes', 'events', 'demo_campaign_pressure.scene.dry'), '= Civic Reform Campaign\n\nUser note should survive.\n', 'utf8');
  fs.writeFileSync(path.join(freshDemoRoot, 'source', 'scenes', 'events', 'demo_monthly_report.scene.dry'), '= Monthly Civic Docket\n', 'utf8');
  fs.writeFileSync(path.join(freshDemoRoot, '.dendry-studio-template.json'), JSON.stringify({signature: 'older-template-signature'}) + '\n', 'utf8');
  const freshReused = core.prepareStarterDemo({
    desktopDir: DESKTOP_DIR,
    workspaceRoot: freshWorkspaceRoot,
    refreshIfStale: true
  });
  assert(freshReused.ok && freshReused.reused === true && freshReused.refreshed === false, 'desktop core should preserve already-upgraded starter demo copies');
  const freshCampaign = fs.readFileSync(path.join(freshReused.root, 'source', 'scenes', 'events', 'demo_campaign_pressure.scene.dry'), 'utf8');
  assert(freshCampaign.includes('User note should survive.'), 'desktop core should not overwrite a fresh user-edited demo copy');

  const buildCommand = runtimePreview.resolveBuildCommand(prepared.root);
  assert(buildCommand.ok, 'starter demo should resolve a Runtime Preview build command: ' + JSON.stringify(buildCommand));
  const runtimeHtmlRoot = path.join(prepared.root, 'out', 'html');
  fs.mkdirSync(runtimeHtmlRoot, {recursive: true});
  const assetCopy = runtimePreview.copySourceRuntimeAssets(prepared.root, runtimeHtmlRoot);
  assert(assetCopy.ok && assetCopy.copied === true, 'Runtime Preview should copy source/img assets into out/html/img: ' + JSON.stringify(assetCopy));
  assert(fs.existsSync(path.join(runtimeHtmlRoot, 'img', 'cards', 'demo_action_card.svg')), 'Runtime Preview should make starter demo card-image assets available to generated HTML');
  assert(fs.existsSync(path.join(runtimeHtmlRoot, 'img', 'events', 'demo_campaign_pressure.svg')), 'Runtime Preview should make starter demo face-image assets available to generated HTML');
  assert(fs.existsSync(path.join(runtimeHtmlRoot, 'img', 'events', 'demo_monthly_docket.svg')), 'Runtime Preview should make starter demo monthly docket image available to generated HTML');
  fs.writeFileSync(path.join(runtimeHtmlRoot, 'index.html'), '<!doctype html><html><body>quick</body></html>\n', 'utf8');
  const quickSession = runtimePreview.createQuickSession({
    projectRoot: prepared.root,
    sessionsRoot: path.join(preparedRoot, 'quick-runtime-sessions'),
    plan: {id: 'starter_quick_asset_probe', title: 'Starter Quick Asset Probe'}
  });
  assert(quickSession.ok, 'Quick Runtime Lens should open with a minimal generated HTML shell: ' + JSON.stringify(quickSession.diagnostics || []));
  assert(quickSession.assetCopy && quickSession.assetCopy.copied === true, 'Quick Runtime Lens should copy source/img assets into the preview session');
  assert(fs.existsSync(path.join(quickSession.paths.modifiedRoot, 'out', 'html', 'img', 'cards', 'demo_action_card.svg')), 'Quick Runtime Lens should make starter demo card-image assets available when reusing existing HTML');
  assert(fs.existsSync(path.join(quickSession.paths.modifiedRoot, 'out', 'html', 'img', 'events', 'demo_campaign_pressure.svg')), 'Quick Runtime Lens should make starter demo face-image assets available when reusing existing HTML');

  const indexed = await core.buildProjectIndex({
    root: prepared.root,
    outDir: scratchRoot,
    includeExcerpts: false,
    python: pythonCommand(),
    desktopDir: DESKTOP_DIR
  });
  assert(indexed.ok, 'starter demo should build a ProjectIndex: ' + JSON.stringify(indexed.error || null));
  assert(indexed.projectName === 'Dendry Mod Studio Starter Demo', 'starter demo ProjectIndex should keep the template title');
  assert(indexed.summary.sceneCount >= 3, 'starter demo should expose multiple scenes');
  assert(indexed.summary.eventCount >= 1, 'starter demo should expose one event-like scene');
  assert(indexed.summary.eventCount >= 9, 'starter demo should expose the opening event, complex chain, and monthly popups');
  assert(indexed.summary.cardCount >= 7, 'starter demo should expose overview, action, monthly, and advisor cards');
  assert(indexed.summary.handCount >= 1, 'starter demo should expose one hand scene');
  assert(indexed.summary.deckCount >= 1, 'starter demo should expose one deck scene');
  assert(indexed.summary.pinnedCardCount >= 3, 'starter demo should expose multiple advisor-like pinned cards');
  assert(indexed.index.variables.some((item) => item.name === 'demo_support'), 'starter demo ProjectIndex should include demo_support variable');
  assert(indexed.index.variables.some((item) => item.name === 'demo_resources'), 'starter demo ProjectIndex should include demo_resources variable');
  assert(indexed.index.variables.some((item) => item.name === 'demo_pressure'), 'starter demo ProjectIndex should include demo_pressure variable');
  assert(indexed.index.variables.some((item) => item.name === 'demo_year'), 'starter demo ProjectIndex should include the demo calendar year variable');
  assert(indexed.index.variables.some((item) => item.name === 'demo_press_risk'), 'starter demo ProjectIndex should include the demo press risk variable');
  assert(indexed.index.edges.some((edge) => String(edge.from || '').startsWith('demo_campaign_pressure.') && edge.to === 'demo_case_hearing'), 'starter demo ProjectIndex should route from the first complex event to the hearing');
  assert(indexed.index.edges.some((edge) => String(edge.from || '').startsWith('demo_case_hearing.') && edge.to === 'demo_back_room_talks'), 'starter demo ProjectIndex should route from the hearing to the back-room branch');
  assert(indexed.index.edges.some((edge) => String(edge.from || '').startsWith('demo_back_room_talks.') && edge.to === 'demo_resolution_week'), 'starter demo ProjectIndex should route from the back-room branch to the resolution');
  assert(indexed.index.edges.some((edge) => String(edge.from || '').startsWith('demo_case_hearing.') && edge.to === 'demo_resolution_week'), 'starter demo ProjectIndex should route from the hearing to the resolution');
  assert(indexed.index.edges.some((edge) => String(edge.from || '').startsWith('demo_council_deadlock.') && edge.to === 'demo_monthly_report'), 'starter demo ProjectIndex should route from a nested monthly popup branch back to the monthly docket');
  assert(((indexed.summary && indexed.summary.imageAssetCount) || (indexed.index.summary && indexed.index.summary.imageAssetCount) || 0) >= 13, 'starter demo ProjectIndex should include demo event and card image assets');

  fs.rmSync(preparedRoot, {recursive: true, force: true});
  fs.rmSync(scratchRoot, {recursive: true, force: true});
  fs.rmSync(compatibilityRoot, {recursive: true, force: true});
  fs.rmSync(staleWorkspaceRoot, {recursive: true, force: true});
  fs.rmSync(freshWorkspaceRoot, {recursive: true, force: true});

  process.stdout.write(JSON.stringify({
    ok: true,
    templateRoot: TEMPLATE_ROOT,
    sceneCount: indexed.summary.sceneCount,
    eventCount: indexed.summary.eventCount
  }, null, 2) + '\n');
}

main().catch((err) => {
  fail(err && err.stack ? err.stack : String(err));
});
