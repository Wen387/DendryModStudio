#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {readExploreBundle} = require('./check_viewer_assets.js');

const indexPath = process.argv[2] || '/tmp/dendry_project_map/project-index-state-review.json';
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const api = require('./authoring/event_workbench_model.js');

const eventId = process.argv[3] || 'food_safety_2014';
const workbench = api.buildEventWorkbench(index, eventId, {locale: 'zh-Hant'});

function isHiddenScriptOrComment(value) {
  const text = String(value || '').trim();
  return (
    text.startsWith('//') ||
    /^Q\./.test(text) ||
    /;\s*Q\./.test(text) ||
    /\bQ\.[A-Za-z_][A-Za-z0-9_]*\s*(?:[+\-*/%]?=)/.test(text)
  );
}

assert.strictEqual(workbench.kind, 'event_workbench');
assert.strictEqual(workbench.sceneId, eventId);
assert(workbench.title.includes('食安') || workbench.title === eventId, 'should expose the player-facing event title');

assert(workbench.playerText.length >= 3, 'should collect player-facing body text');
assert(
  workbench.playerText.every((row) => !isHiddenScriptOrComment(row.text)),
  'player text should not expose Q.* scripts or // comments as body prose'
);
assert(
  workbench.playerText.some((row) =>
    String(row.text || '').includes('整條供應鏈') &&
    String(row.text || '').includes('產出這家企業的制度')
  ),
  'player text should preserve complete visible event prose, not clipped excerpts'
);
assert(
  workbench.playerText.every((row) => !(String(row.text || '').length === 180 && String(row.text || '').endsWith('...'))),
  'player text should not inherit 180-character Text Corpus excerpt truncation'
);

assert(workbench.conditions.some((item) => item.kind === 'year' && String(item.value) === '2014'), 'should explain year condition');
assert(workbench.conditions.some((item) => item.kind === 'month'), 'should explain month condition');
assert(workbench.conditions.some((item) => item.kind === 'seen_flag'), 'should explain seen flag condition');

assert(workbench.effects.some((item) => item.variable === 'food_safety_seen'), 'should classify trigger seen-flag write as an effect');
assert(workbench.variables.some((item) => item.name === 'resources' && item.accesses.includes('write')), 'should summarize variables written in the event');
assert(workbench.variables.some((item) => item.name === 'founding_phase' && item.accesses.includes('read')), 'should summarize variables read in the event');

assert(workbench.links.outgoing.length > 0, 'should expose outgoing flow links');
assert(workbench.actions.some((item) => item.id === 'edit_text'), 'should expose text rewrite action');
assert(workbench.actions.some((item) => item.id === 'copy_alt_timeline'), 'should expose alternate timeline copy action');
assert(workbench.actions.some((item) => item.id === 'follow_up'), 'should expose follow-up action');
assert(workbench.advanced.source.path.endsWith('.scene.dry'), 'should keep source path in advanced info');

assert.strictEqual(typeof api.buildActionDraft, 'function', 'Event Workbench should expose action draft builder');

const rewrite = api.buildActionDraft(index, eventId, 'edit_text', {locale: 'zh-Hant'});
assert.strictEqual(rewrite.ok, true, 'rewrite action should build a text proposal');
assert.strictEqual(rewrite.template, 'surface', 'rewrite action should route to text proposal template');
assert(rewrite.draft.originalLabel && rewrite.draft.source.path, 'rewrite action should carry original text and source');

const alternate = api.buildActionDraft(index, eventId, 'copy_alt_timeline', {locale: 'zh-Hant'});
assert.strictEqual(alternate.ok, true, 'alternate timeline action should build an event draft');
assert.strictEqual(alternate.template, 'event', 'alternate timeline action should route to event template');
assert(alternate.draft.id !== eventId, 'alternate timeline draft should not reuse the existing scene id');
assert(alternate.draft.introParagraphs.some((line) => line.includes('食安') || line.includes('另類')), 'alternate timeline draft should preserve context for rewriting');
assert(
  !alternate.draft.effectsOnTrigger.some((effect) => effect.variable === 'food_safety_seen'),
  'alternate timeline draft should not mark the original source event as seen'
);

const followUp = api.buildActionDraft(index, eventId, 'follow_up', {locale: 'zh-Hant'});
assert.strictEqual(followUp.ok, true, 'follow-up action should build an event draft');
assert.strictEqual(followUp.template, 'event', 'follow-up action should route to event template');
assert(followUp.draft.id.includes('followup'), 'follow-up draft should use a follow-up id');
assert(followUp.draft.when.year >= alternate.draft.when.year, 'follow-up timing should be at or after the source event year');

const htmlPath = path.join(__dirname, 'viewer', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
assert(html.includes('event_workbench_model.js'), 'viewer should load Event Workbench model');
assert(html.includes('event_workbench_ui.js'), 'viewer should load Event Workbench UI');
const eventWorkbenchUi = fs.readFileSync(path.join(__dirname, 'viewer', 'event_workbench_ui.js'), 'utf8');
const renderedWorkbench = require('./viewer/event_workbench_ui.js').renderEventWorkbench(workbench, {locale: 'zh-Hant'});
assert(renderedWorkbench.includes('event-workbench-collapsible'), 'Event Workbench should render collapsible information categories');
assert(renderedWorkbench.includes('event-workbench-section-count'), 'Event Workbench collapsible headings should show count badges');
assert(renderedWorkbench.includes('<details class="event-workbench-section event-workbench-collapsible" open'), 'Event Workbench should keep primary sections open by default');
assert(renderedWorkbench.includes('data-event-workbench-section="conditions"'), 'Event Workbench should expose a collapsible conditions section');
assert(eventWorkbenchUi.includes('sectionCount'), 'Event Workbench UI should compute section counts for badges');

const app = readExploreBundle(path.join(__dirname, 'viewer'));
const designUi = fs.readFileSync(path.join(__dirname, 'viewer', 'design_ui.js'), 'utf8');
assert(app.includes('renderEventWorkbenchInspector'), 'Explore inspector should route events through Event Workbench');
assert(designUi.includes('renderEventWorkbenchForSelected'), 'Design inspector should route events through Event Workbench');
assert(app.includes('handleEventWorkbenchAction'), 'Explore inspector should handle Event Workbench action buttons');
assert(designUi.includes('handleEventWorkbenchAction'), 'Design inspector should handle Event Workbench action buttons');

console.log('Event Workbench model smoke passed:', workbench.sceneId, workbench.playerText.length, 'text rows');
