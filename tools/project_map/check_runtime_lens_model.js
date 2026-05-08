#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const lensModel = require('./authoring/runtime_lens_model.js');
const runtimeLens = require('./desktop/runtime_lens.js');
const runtimePreview = require('./desktop/runtime_preview.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function htmlBuildRunner(label) {
  return (root, meta) => {
    const htmlRoot = path.join(root, 'out', 'html');
    fs.mkdirSync(htmlRoot, {recursive: true});
    fs.writeFileSync(path.join(htmlRoot, 'index.html'), [
      '<!doctype html>',
      '<title>' + String(label || meta && meta.lane || 'runtime lens') + '</title>',
      '<body>' + String(meta && meta.lane || 'runtime lens') + '</body>'
    ].join('\n') + '\n', 'utf8');
    return {
      ok: true,
      root,
      lane: meta && meta.lane || '',
      command: label || 'runtime lens fixture build',
      htmlRoot,
      diagnostics: []
    };
  };
}

const projectIndex = {
  project: {name: 'Runtime Lens Fixture'},
  scenes: [
    {id: 'root', title: 'Root', type: 'root', path: 'source/scenes/root.scene.dry'},
    {id: 'focus_event', title: 'Focused Event', type: 'event', path: 'source/scenes/events/focus_event.scene.dry'},
    {id: 'focus_news', title: 'Focused News', type: 'news', path: 'source/scenes/news/focus_news.scene.dry'},
    {id: 'focus_card', title: 'Focused Card', type: 'card', path: 'source/scenes/cards/focus_card.scene.dry'},
    {id: 'starter_deck', title: 'Starter Deck', type: 'deck', path: 'source/scenes/decks/starter_deck.scene.dry'}
  ],
  semantic: {
    events: [{id: 'focus_event', title: 'Focused Event'}],
    news: [{id: 'focus_news', title: 'Focused News'}],
    cards: [{id: 'focus_card', title: 'Focused Card'}],
    decks: [{id: 'starter_deck', title: 'Starter Deck'}]
  },
  variables: [{name: 'year', tags: ['time']}],
  edges: [{from: 'root', to: 'focus_event', kind: 'choice'}]
};

const browserModel = lensModel.buildModel({
  isDesktop: false,
  focus: {kind: 'event', id: 'focus_event'},
  projectIndex
});
assert(browserModel.status === 'unavailable', 'browser mode should report Runtime Lens unavailable');
assert(browserModel.diagnostics.some((diag) => diag.code === 'runtime_lens.desktop_required'), 'browser model should explain desktop requirement');

const idleFocus = lensModel.normalizeFocus({kind: 'event', id: 'focus_event'}, projectIndex);
assert(idleFocus.targetSceneId === 'focus_event', 'event focus should resolve target scene id');
assert(idleFocus.title === 'Focused Event', 'event focus should resolve scene title');
const newsFocus = lensModel.normalizeFocus({kind: 'news_item', id: 'focus_news'}, projectIndex);
assert(newsFocus.kind === 'news', 'news_item focus should normalize to news');
assert(newsFocus.targetSceneId === 'focus_news', 'news focus should resolve target scene id');
const deckFocus = lensModel.normalizeFocus({kind: 'deck', id: 'starter_deck'}, projectIndex);
assert(deckFocus.targetSceneId === 'starter_deck', 'deck focus should resolve target scene id');

const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_runtime_lens_source_'));
const sessionsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dms_runtime_lens_sessions_'));
fs.mkdirSync(path.join(sourceRoot, 'source', 'scenes', 'events'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, 'source', 'scenes', 'news'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, 'source', 'scenes', 'cards'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, 'source', 'scenes', 'decks'), {recursive: true});
fs.mkdirSync(path.join(sourceRoot, '.git'), {recursive: true});
fs.writeFileSync(path.join(sourceRoot, 'source', 'info.dry'), 'title: Runtime Lens Fixture\n', 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'source', 'scenes', 'root.scene.dry'), [
  'title: Root',
  '',
  '- @focus_event: Focus event',
  ''
].join('\n'), 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'source', 'scenes', 'events', 'focus_event.scene.dry'), [
  'title: Focused Event',
  'tags: event',
  '',
  'Original event text.',
  ''
].join('\n'), 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'source', 'scenes', 'news', 'focus_news.scene.dry'), [
  'title: Focused News',
  'tags: news',
  '',
  'Original news text.',
  ''
].join('\n'), 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'source', 'scenes', 'cards', 'focus_card.scene.dry'), [
  'title: Focused Card',
  'is-card: true',
  '',
  'Original card text.',
  ''
].join('\n'), 'utf8');
fs.writeFileSync(path.join(sourceRoot, 'source', 'scenes', 'decks', 'starter_deck.scene.dry'), [
  'title: Starter Deck',
  'tags: deck',
  '',
  'Deck lane.',
  ''
].join('\n'), 'utf8');
fs.writeFileSync(path.join(sourceRoot, '.git', 'config'), 'must not copy\n', 'utf8');
fs.mkdirSync(path.join(sourceRoot, 'out', 'html'), {recursive: true});
fs.writeFileSync(path.join(sourceRoot, 'out', 'html', 'index.html'), '<!doctype html><title>Existing runtime</title>\n', 'utf8');

const quickLens = runtimeLens.createRuntimeLens({
  projectRoot: sourceRoot,
  sessionsRoot,
  projectIndex,
  focus: {kind: 'event', id: 'focus_event'},
  previewMode: 'quick',
  serverFactory: runtimePreview.fakeServerFactory(48110),
  now: () => new Date('2026-05-06T12:29:00.000Z')
});

assert(quickLens.ok, 'quick Runtime Lens should create a focused session from existing out/html: ' + JSON.stringify(quickLens));
assert(quickLens.previewMode === 'quick', 'quick Runtime Lens should preserve preview mode');
assert(quickLens.modifiedBuild && quickLens.modifiedBuild.skippedBuild === true, 'quick Runtime Lens should skip the full build');
assert(!quickLens.baselineBuild, 'quick Runtime Lens should not build a baseline copy');
assert(!fs.existsSync(path.join(quickLens.paths.modifiedRoot, 'source', 'info.dry')), 'quick Runtime Lens should not copy full project source');
assert(fs.existsSync(quickLens.lensPagePath), 'quick Runtime Lens should still write a focused wrapper page');

const quickNewsLens = runtimeLens.createRuntimeLens({
  projectRoot: sourceRoot,
  sessionsRoot,
  projectIndex,
  focus: {kind: 'news', id: 'focus_news'},
  previewMode: 'quick',
  serverFactory: runtimePreview.fakeServerFactory(48113),
  now: () => new Date('2026-05-06T12:29:30.000Z')
});
assert(quickNewsLens.ok, 'quick Runtime Lens should focus a news scene: ' + JSON.stringify(quickNewsLens));
assert(quickNewsLens.focus.targetSceneId === 'focus_news', 'quick news Runtime Lens should resolve a scene target');
assert(quickNewsLens.postLoadCommands.some((command) => command.type === 'jumpToScene' && command.sceneId === 'focus_news'), 'quick news Runtime Lens should queue a scene jump command');

const eventLens = runtimeLens.createRuntimeLens({
  projectRoot: sourceRoot,
  sessionsRoot,
  projectIndex,
  focus: {kind: 'event', id: 'focus_event'},
  buildRunner: htmlBuildRunner('runtime lens build'),
  serverFactory: runtimePreview.fakeServerFactory(48111),
  now: () => new Date('2026-05-06T12:30:00.000Z')
});

assert(eventLens.ok, 'event Runtime Lens should create a focused session: ' + JSON.stringify(eventLens));
assert(eventLens.kind === 'runtime_lens_session', 'Runtime Lens should return a lens session kind');
assert(eventLens.status === 'ready', 'Runtime Lens should report ready status');
assert(eventLens.lensUrl.includes('/lens/'), 'Runtime Lens primary URL should point at the focused wrapper page');
assert(eventLens.modifiedUrl.includes('/modified/out/html/'), 'Runtime Lens should retain the modified runtime URL');
assert(eventLens.externalUrl === eventLens.lensUrl, 'Runtime Lens external URL should default to the focused wrapper page');
assert(fs.existsSync(eventLens.lensPagePath), 'Runtime Lens should write a focused wrapper page');
const lensPageHtml = fs.readFileSync(eventLens.lensPagePath, 'utf8');
assert(lensPageHtml.includes('Focused Runtime Lens'), 'Runtime Lens wrapper should identify the focused lens');
assert(lensPageHtml.includes('jumpToScene'), 'Runtime Lens wrapper should carry post-load focus commands');
assert(lensPageHtml.includes('dms-runtime-lens-action'), 'Runtime Lens wrapper should accept parent focus/reset actions');
assert(eventLens.focus.targetSceneId === 'focus_event', 'Runtime Lens should preserve focused scene target');
assert(eventLens.postLoadCommands.some((command) => command.type === 'jumpToScene' && command.sceneId === 'focus_event'), 'Runtime Lens should queue a scene jump command');
assert(eventLens.lensModel.commands.some((command) => command.type === 'focusScene'), 'Runtime Lens model should expose focusScene command');
assert(fs.existsSync(path.join(eventLens.paths.modifiedRoot, 'source', 'info.dry')), 'modified sandbox should include source/info.dry');
assert(!fs.existsSync(path.join(eventLens.paths.modifiedRoot, '.git', 'config')), 'Runtime Lens sandbox must not copy .git');
assert(fs.readFileSync(path.join(sourceRoot, 'source', 'scenes', 'events', 'focus_event.scene.dry'), 'utf8').includes('Original event text'), 'Runtime Lens must not mutate the real source project');

const cardLens = runtimeLens.createRuntimeLens({
  projectRoot: sourceRoot,
  sessionsRoot,
  projectIndex,
  focus: {kind: 'card', id: 'focus_card'},
  buildRunner: htmlBuildRunner('runtime lens card build'),
  serverFactory: runtimePreview.fakeServerFactory(48112),
  now: () => new Date('2026-05-06T12:31:00.000Z')
});
assert(cardLens.ok, 'card Runtime Lens should create a focused session: ' + JSON.stringify(cardLens));
assert(cardLens.focus.targetCardId === 'focus_card', 'card focus should preserve target card id');
assert(cardLens.postLoadCommands.some((command) => command.type === 'focusCard' && command.cardId === 'focus_card'), 'card Runtime Lens should queue a card focus command');

const missingRoot = runtimeLens.createRuntimeLens({
  projectRoot: path.join(sourceRoot, 'missing'),
  projectIndex,
  focus: {kind: 'event', id: 'focus_event'}
});
assert(!missingRoot.ok && missingRoot.status === 'failed', 'missing project root should fail safely');
assert(missingRoot.diagnostics.some((diag) => diag.code === 'runtime_lens.project_root'), 'missing project root should report a Runtime Lens diagnostic');

process.stdout.write(JSON.stringify({
  ok: true,
  eventLens: {
    status: eventLens.status,
    focus: eventLens.focus.targetSceneId,
    urlKind: eventLens.lensUrl.includes('/lens/') ? 'focused-wrapper' : 'unknown'
  },
  cardLens: {
    status: cardLens.status,
    focus: cardLens.focus.targetCardId,
    commands: cardLens.postLoadCommands.map((command) => command.type)
  }
}, null, 2) + '\n');
