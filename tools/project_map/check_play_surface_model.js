#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const playSurface = require('./authoring/play_surface_draft.js');
const installPlan = require('./authoring/install_plan.js');
const core = require('./desktop/studio_core.js');

const ROOT = __dirname;
const DESKTOP_DIR = path.join(ROOT, 'desktop');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function syntheticIndexWithoutAnchor() {
  return {
    schemaVersion: '0.1',
    project: {name: 'Playable Surface fixture', root: '', profileIds: ['generic-dendry']},
    scenes: [
      {
        id: 'main',
        type: 'hand',
        title: 'Old Hand',
        path: 'source/scenes/main.scene.dry',
        metadata: {title: {path: 'source/scenes/main.scene.dry', line: 1}},
        options: [
          {
            id: '@deck',
            title: 'Open old deck',
            target: {kind: 'scene', id: 'deck'},
            sourceSpan: {path: 'source/scenes/main.scene.dry', line: 8}
          },
          {
            id: '#advisor',
            title: 'Ask old advisor',
            target: {kind: 'tag', id: 'advisor'},
            sourceSpan: {path: 'source/scenes/main.scene.dry', line: 9}
          }
        ]
      }
    ],
    semantic: {
      textCorpus: {
        items: [
          {
            id: 'hand_heading',
            role: 'heading',
            text: 'Old Hand',
            owner: {sceneId: 'main'},
            source: {path: 'source/scenes/main.scene.dry', line: 4}
          },
          {
            id: 'hand_body',
            role: 'body',
            text: 'Old body.',
            owner: {sceneId: 'main'},
            source: {path: 'source/scenes/main.scene.dry', line: 6}
          }
        ]
      }
    }
  };
}

function justicePartyDraft(index) {
  const draft = playSurface.defaultDraft(index);
  draft.id = 'justice_party_play_surface';
  draft.title = 'Justice Party playable surface';
  draft.handTitle = 'Justice Party Field Office';
  draft.handHeading = 'Justice Party Field Office';
  draft.handBody = 'The first playable workspace is a small Justice Party office: staff track resources, open the party affairs hand, and keep a labor advisor within reach.';
  draft.handDeckOptionLabel = 'Open party affairs cards';
  draft.handAdvisorOptionLabel = 'Review labor advisor';
  draft.deckTitle = 'Party Affairs Deck';
  draft.deckSubtitle = 'A minimal deck for organizing weeks';
  draft.cardTitle = 'Party Affairs Starter Card';
  draft.cardHeading = 'Plan the party week';
  draft.cardBody = 'The office chooses whether to spend resources on visible organizing or keep capacity for the next opening.';
  draft.cardOption0Label = 'Fund worker outreach';
  draft.cardOption1Label = 'Hold capacity';
  draft.advisorTitle = 'Labor Advisor';
  draft.advisorSubtitle = 'A standing ally for workplace strategy';
  draft.advisorHeading = 'Labor Advisor';
  draft.advisorBody = 'A labor organizer helps the party connect workplace demands with local campaign capacity.';
  draft.advisorOption0Label = 'Ask about workplace visits';
  return draft;
}

async function main() {
  const fallbackModel = playSurface.buildSurfaceModel(syntheticIndexWithoutAnchor());
  assert(fallbackModel.hand.titleSource.anchorText === 'title: Old Hand', 'metadata-only title evidence should get a safe fallback anchor');
  assert(fallbackModel.hand.openingEvidence.anchorText === '= Old Hand', 'heading rows should provide opening section anchors');

  const preparedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_play_surface_starter_'));
  const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dendry_play_surface_index_'));
  const prepared = core.prepareStarterDemo({
    desktopDir: DESKTOP_DIR,
    workspaceRoot: preparedRoot
  });
  assert(prepared.ok, 'starter demo should prepare for Playable Surface model check');
  const indexed = await core.buildProjectIndex({
    root: prepared.root,
    outDir: scratchRoot,
    includeExcerpts: false,
    python: 'python3',
    desktopDir: DESKTOP_DIR
  });
  assert(indexed.ok, 'starter demo should build a ProjectIndex for Playable Surface model: ' + JSON.stringify(indexed.error || null));

  const model = playSurface.buildSurfaceModel(indexed.index);
  assert(model.kind === 'play_surface_model', 'starter demo should build a Playable Surface model');
  assert(model.hand && model.hand.id === 'main', 'model should detect the starter hand workspace');
  assert(model.deck && model.deck.id === 'demo_action_deck', 'model should detect the starter deck');
  assert(model.card && model.card.id === 'demo_action_card', 'model should detect the starter action card');
  assert(model.advisor && model.advisor.id === 'demo_advisor', 'model should detect the starter advisor-like pinned card');
  assert(model.readiness.every((row) => row.status === 'ready'), 'starter model should mark all playable surface lanes ready');
  assert(model.handDeckOption && model.handDeckOption.id === '@demo_action_deck', 'model should detect the hand deck option');
  assert(model.handAdvisorOption && model.handAdvisorOption.id === '#demo_advisor', 'model should detect the hand advisor option');

  const draft = justicePartyDraft(indexed.index);
  const bundle = playSurface.buildExportBundle(draft, indexed.index);
  assert(bundle.ok, 'Justice Party playable surface bundle should validate: ' + JSON.stringify(bundle.diagnostics));
  assert(bundle.installPlan.draftKind === 'play_surface', 'bundle should expose play_surface install plan');
  assert(bundle.playerPreview.includes('Justice Party Field Office'), 'player preview should include the new hand heading');
  assert(bundle.playerPreview.includes('Labor Advisor'), 'player preview should include the new advisor heading');
  assert(bundle.files.some((file) => file.path.endsWith('.play-surface-draft.json')), 'bundle should include draft JSON');
  assert(bundle.files.some((file) => file.path.endsWith('.patch-preview.diff')), 'bundle should include patch preview');
  assert(bundle.patchPreview.includes('@@ replace section'), 'patch preview should include guarded section replacements');

  const summary = installPlan.operationSummary(bundle.installPlan);
  assert(summary.guardedApply >= 10, 'playable surface edits should generate guarded apply operations: ' + JSON.stringify(summary));
  assert(bundle.installPlan.operations.some((op) => op.id === 'hand_opening' && op.type === 'replace_section'), 'plan should replace hand heading/body section');
  assert(bundle.installPlan.operations.some((op) => op.id === 'card_opening' && op.type === 'replace_section'), 'plan should replace starter action card section');
  assert(bundle.installPlan.operations.some((op) => op.id === 'advisor_opening' && op.type === 'replace_section'), 'plan should replace advisor section');
  assert(bundle.installPlan.operations.some((op) => op.id === 'hand_deck_option' && op.type === 'replace_text'), 'plan should replace the hand deck option label');
  assert(bundle.installPlan.operations.some((op) => op.id === 'hand_advisor_option' && op.type === 'replace_text'), 'plan should replace the hand advisor option label');

  const dryRun = installPlan.applyInstallPlan(bundle.installPlan, {projectRoot: prepared.root, dryRun: true});
  assert(dryRun.ok, 'Play Surface dry-run should succeed with exact source evidence: ' + JSON.stringify(dryRun));
  assert(!dryRun.results.some((item) => item.status === 'failed'), 'Play Surface dry-run should not hide failed operations');
  const applied = installPlan.applyInstallPlan(bundle.installPlan, {projectRoot: prepared.root, dryRun: false});
  assert(applied.ok, 'Play Surface apply should succeed on a temp starter copy: ' + JSON.stringify(applied));

  const mainText = fs.readFileSync(path.join(prepared.root, 'source', 'scenes', 'main.scene.dry'), 'utf8');
  const deckText = fs.readFileSync(path.join(prepared.root, 'source', 'scenes', 'decks', 'demo_action_deck.scene.dry'), 'utf8');
  const cardText = fs.readFileSync(path.join(prepared.root, 'source', 'scenes', 'cards', 'demo_action_card.scene.dry'), 'utf8');
  const advisorText = fs.readFileSync(path.join(prepared.root, 'source', 'scenes', 'advisors', 'demo_advisor.scene.dry'), 'utf8');
  assert(mainText.includes('title: Justice Party Field Office'), 'hand title should be updated');
  assert(mainText.includes('= Justice Party Field Office'), 'hand heading should be updated');
  assert(mainText.includes('- @demo_action_deck: Open party affairs cards'), 'hand deck option should be updated');
  assert(mainText.includes('- #demo_advisor: Review labor advisor'), 'hand advisor option should be updated');
  assert(deckText.includes('title: Party Affairs Deck'), 'deck title should be updated');
  assert(deckText.includes('subtitle: A minimal deck for organizing weeks'), 'deck subtitle should be updated');
  assert(cardText.includes('= Plan the party week'), 'card heading should be updated');
  assert(cardText.includes('- @spend_resources: Fund worker outreach'), 'card option A should be updated');
  assert(cardText.includes('- @save_capacity: Hold capacity'), 'card option B should be updated');
  assert(advisorText.includes('subtitle: A standing ally for workplace strategy'), 'advisor subtitle should be updated');
  assert(advisorText.includes('- @ask_for_help: Ask about workplace visits'), 'advisor option should be updated');

  fs.rmSync(preparedRoot, {recursive: true, force: true});
  fs.rmSync(scratchRoot, {recursive: true, force: true});

  process.stdout.write(JSON.stringify({
    ok: true,
    guardedOps: summary.guardedApply,
    hand: model.hand.id,
    advisor: model.advisor.id
  }, null, 2) + '\n');
}

main().catch((err) => {
  fail(err && err.stack ? err.stack : String(err));
});
