#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const suggestions = require('./authoring/variable_suggestions.js');

const ROOT = __dirname;
const VIEWER_HTML = path.join(ROOT, 'viewer', 'index.html');
const VIEWER_CSS = path.join(ROOT, 'viewer', 'styles.css');
const WIZARD_UI = path.join(ROOT, 'viewer', 'wizard_ui.js');
const CARD_UI = path.join(ROOT, 'viewer', 'card_ui.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

const projectIndex = {
  schemaVersion: '0.1',
  variables: [
    {
      name: 'resources',
      tags: ['resource'],
      readCount: 18,
      writeCount: 42,
      reads: [{path: 'source/scenes/status.scene.dry', line: 41}],
      writes: [{path: 'source/scenes/cards/organize.scene.dry', line: 12}]
    },
    {
      name: 'all_quiet_seen',
      tags: ['flag', 'event'],
      readCount: 3,
      writeCount: 1,
      reads: [{path: 'source/scenes/post_event.scene.dry', line: 414}],
      writes: [{path: 'source/scenes/events/all_quiet.scene.dry', line: 8}]
    },
    {
      name: 'worker_unrest',
      tags: ['social'],
      readCount: 5,
      writeCount: 4,
      reads: [{path: 'source/scenes/events/strike.scene.dry', line: 3}],
      writes: [{path: 'source/scenes/events/strike.scene.dry', line: 24}]
    },
    {
      name: 'party_name',
      tags: ['text'],
      readCount: 2,
      writeCount: 1
    }
  ]
};

const candidates = suggestions.buildVariableCandidates(projectIndex);
assert(candidates.length === 4, 'should build candidates from projectIndex.variables');
assert(candidates[0].name === 'resources', 'frequently used gameplay variables should rank high');
assert(candidates.find((item) => item.name === 'all_quiet_seen').meaning === 'event flag', 'seen flags should get human meaning');

const resourceResults = suggestions.searchVariableCandidates(candidates, 'resource', {limit: 2});
assert(resourceResults[0].name === 'resources', 'semantic search should find resources by resource');
assert(resourceResults[0].reason.includes('resource'), 'search result should explain why the candidate matched');

const eventResults = suggestions.searchVariableCandidates(candidates, 'event flag');
assert(eventResults.some((item) => item.name === 'all_quiet_seen'), 'semantic search should find event seen flags');

const unrestResults = suggestions.searchVariableCandidates(candidates, 'worker');
assert(unrestResults[0].name === 'worker_unrest', 'search should match variable name tokens');

const snippet = suggestions.variableSnippet(candidates.find((item) => item.name === 'worker_unrest'));
assert(snippet.metadataCondition === 'worker_unrest = 1', 'metadata condition snippet should avoid Q. prefix');
assert(snippet.jsCondition === 'Q.worker_unrest', 'JS condition snippet should use Q. prefix');
assert(snippet.effectVariable === 'worker_unrest', 'effect snippet should be just the variable name');

const html = fs.readFileSync(VIEWER_HTML, 'utf8');
const css = fs.readFileSync(VIEWER_CSS, 'utf8');
const wizardUi = fs.readFileSync(WIZARD_UI, 'utf8');
const cardUi = fs.readFileSync(CARD_UI, 'utf8');

assert(html.includes('../authoring/variable_suggestions.js'), 'viewer should load variable suggestion model');
assert(html.includes('id="wizard-variable-assistant"'), 'Event wizard should expose a variable assistant');
assert(html.includes('id="card-variable-assistant"'), 'Card wizard should expose a variable assistant');
assert(css.includes('.variable-assistant'), 'CSS should style the variable assistant');
assert(css.includes('.variable-candidate-list'), 'CSS should style variable candidate results');
assert(wizardUi.includes('ProjectMapVariableSuggestions'), 'Event wizard should use the shared suggestion model');
assert(wizardUi.includes('lastConditionFieldId'), 'Event wizard should remember the focused condition field');
assert(wizardUi.includes('data-variable-action'), 'Event candidate cards should support variable actions');
assert(wizardUi.includes('insert-condition'), 'Event candidate cards should support condition insertion');
assert(wizardUi.includes('use-effect'), 'Event candidate cards should support effect variable insertion');
assert(cardUi.includes('ProjectMapVariableSuggestions'), 'Card wizard should use the shared suggestion model');
assert(cardUi.includes('lastConditionFieldId'), 'Card wizard should remember the focused condition field');
assert(cardUi.includes('data-variable-action'), 'Card candidate cards should support variable actions');

process.stdout.write(JSON.stringify({
  ok: true,
  candidates: candidates.map((item) => item.name),
  topResource: resourceResults[0].name
}, null, 2) + '\n');
