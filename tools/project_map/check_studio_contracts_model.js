#!/usr/bin/env node
'use strict';

const contracts = require('./authoring/studio_contracts.js');
const viewer = require('./viewer/app.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function t(key, fallback) {
  return key + '|' + fallback;
}

assert(contracts.STORAGE_KEYS.draftWorkspace === 'dendry_mod_studio.draft_workspace.v0.1', 'draft workspace storage key should stay stable');
assert(contracts.EVENT_NAMES.createTemplateChanged === 'ProjectMap:create-template-changed', 'create template event name should stay stable');
assert(contracts.textCorpusRoleLabel('conditional_body') === 'conditional body', 'role fallback should humanize conditional_body');
assert(contracts.textCorpusRoleLabel('news_description') === 'news description', 'role fallback should humanize news_description');
assert(contracts.textCorpusRoleLabel('conditional_body', t) === 'textCorpus.role.conditionalBody|conditional body', 'role label should expose i18n key');
assert(contracts.textCorpusEditabilityLabel('text_proposal') === 'text proposal', 'editability fallback should humanize text_proposal');
assert(contracts.textCorpusEditabilityLabel('draft_exportable', t) === 'textCorpus.editability.draftExportable|source-backed draft', 'editability label should expose i18n key');
assert(contracts.browserReviewOnlyMessage(t) === 'install.browserReviewOnly|Browser mode can review change plans. Use the desktop app to apply changes.', 'install review-only copy should expose i18n key');

assert(viewer.textCorpusRoleLabel('conditional_body') === 'conditional body', 'viewer role helper should use Studio contracts');
assert(viewer.textCorpusEditabilityLabel('text_proposal') === 'text proposal', 'viewer editability helper should use Studio contracts');

process.stdout.write(JSON.stringify({
  ok: true,
  storageKey: contracts.STORAGE_KEYS.draftWorkspace,
  createTemplateEvent: contracts.EVENT_NAMES.createTemplateChanged
}, null, 2) + '\n');
