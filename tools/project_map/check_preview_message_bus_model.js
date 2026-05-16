#!/usr/bin/env node
'use strict';

const bus = require('./authoring/preview_message_bus.js');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

assert(bus && typeof bus === 'object', 'CommonJS export should return the preview message bus API');
assert(bus.MESSAGE_KINDS.RUNTIME_PREVIEW_COMMAND === 'dms-runtime-preview-command', 'runtime preview command kind should be centralized');
assert(bus.MESSAGE_KINDS.RUNTIME_PREVIEW_RESULT === 'dms-runtime-preview-result', 'runtime preview result kind should be centralized');
assert(bus.MESSAGE_KINDS.RUNTIME_LENS_ACTION === 'dms-runtime-lens-action', 'runtime lens action kind should be centralized');
assert(bus.MESSAGE_KINDS.RUNTIME_LENS_SESSION_EVIDENCE === 'dms-runtime-lens-session-evidence', 'runtime lens evidence kind should be centralized');

const reset = bus.buildRuntimeLensAction('reset');
assert(Object.keys(reset).length === 2, 'reset action should preserve the legacy two-field payload shape');
assert(reset.kind === 'dms-runtime-lens-action', 'reset action should keep the runtime lens action kind');
assert(reset.action === 'reset', 'reset action should keep the reset action name');
assert(Object.keys(bus.buildRuntimeLensAction('reset', {sessionId: 'ignored'})).length === 2, 'reset action should ignore extra fields to preserve payload compatibility');

const annotated = bus.buildRuntimeLensAction('inspect', {sessionId: 's1', kind: 'ignored', action: 'ignored'});
assert(annotated.kind === 'dms-runtime-lens-action', 'extra fields should not override the message kind');
assert(annotated.action === 'inspect', 'extra fields should not override the action name');
assert(annotated.sessionId === 's1', 'extra fields should be copied onto non-reset lens actions');

assert(bus.isRuntimeLensSessionEvidenceMessage({
  kind: 'dms-runtime-lens-session-evidence'
}, {sessionId: 'active'}), 'evidence without message sessionId should be accepted for an active session');
assert(bus.isRuntimeLensSessionEvidenceMessage({
  kind: 'dms-runtime-lens-session-evidence',
  sessionId: 'active'
}, {sessionId: 'active'}), 'evidence with matching sessionId should be accepted');
assert(!bus.isRuntimeLensSessionEvidenceMessage({
  kind: 'dms-runtime-lens-session-evidence',
  sessionId: 'other'
}, {sessionId: 'active'}), 'evidence with a conflicting sessionId should be rejected');
assert(bus.isRuntimeLensSessionEvidenceMessage({
  kind: 'dms-runtime-lens-session-evidence',
  sessionId: 'other'
}, {}), 'evidence should not require active sessions to carry sessionId');
assert(!bus.isRuntimeLensSessionEvidenceMessage({
  kind: 'dms-runtime-preview-result'
}, {sessionId: 'active'}), 'non-evidence message kinds should be rejected');

assert(bus.getPostMessageTargetOrigin('https://example.test/path?q=1') === 'https://example.test', 'https target origin should use the URL origin');
assert(bus.getPostMessageTargetOrigin('http://127.0.0.1:48888/lens/') === 'http://127.0.0.1:48888', 'http target origin should include host and port');
assert(bus.getPostMessageTargetOrigin('file:///tmp/lens/index.html') === '*', 'file target origin should remain wildcard');
assert(bus.getPostMessageTargetOrigin('electron://runtime-lens/index.html') === '*', 'electron target origin should remain wildcard');
assert(bus.getPostMessageTargetOrigin('about:blank') === '*', 'opaque target origin should remain wildcard');
assert(bus.getPostMessageTargetOrigin('') === '*', 'empty target origin should remain wildcard');
assert(bus.getPostMessageTargetOrigin('not a url') === '*', 'invalid target origin should remain wildcard');
