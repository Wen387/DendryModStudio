#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');

const capabilities = require(path.join(__dirname, 'viewer', 'desktop_capabilities.js'));

async function main() {
  const previousDesktop = global.dendryDesktop;

  try {
    delete global.dendryDesktop;

    assert.strictEqual(
      global.ProjectMapDesktopCapabilities,
      capabilities,
      'desktop capabilities should publish a browser global and CommonJS export'
    );

    assert.strictEqual(capabilities.raw({}), null, 'browser fallback should not create a desktop bridge stub');
    assert.strictEqual(capabilities.raw({window: {}}), null, 'empty window fallback should stay browser-only');
    assert.strictEqual(capabilities.isDesktop({}), false, 'browser fallback should not report desktop mode');
    assert.strictEqual(capabilities.has('openStarterDemo', {}), false, 'missing desktop method should be unavailable');
    assert.strictEqual(capabilities.canOpenStarterDemo({}), false, 'starter demo should be unavailable in browser mode');
    assert.strictEqual(capabilities.canCheckUpdateNotice({}), false, 'update notices should be unavailable in browser mode');
    assert.strictEqual(capabilities.canOpenExternalUrl({}), false, 'external URL bridge should be unavailable in browser mode');
    assert.strictEqual(capabilities.canCreateRuntimeLens({}), false, 'Runtime Lens should be unavailable in browser mode');
    assert.strictEqual(capabilities.getLocale({}), '', 'missing getLocale should fall back to an empty locale');
    assert.strictEqual(capabilities.getState({}), null, 'missing getState should fall back to null state');
    assert.strictEqual(await capabilities.openStarterDemo({includeExcerpts: true}, {}), null, 'missing starter demo bridge should resolve safely');
    assert.strictEqual(await capabilities.checkUpdateNotice({timeoutMs: 10}, {}), null, 'missing update bridge should resolve safely');
    assert.strictEqual(capabilities.openExternalUrl({url: 'https://example.com'}, {}), false, 'missing external bridge should return false');

    const calls = [];
    const bridge = {
      getLocale() {
        calls.push(['getLocale']);
        return 'zh-Hant';
      },
      getState() {
        calls.push(['getState']);
        return {projectPath: '/tmp/demo-project'};
      },
      openStarterDemo(options) {
        calls.push(['openStarterDemo', options]);
        return {ok: true, includeExcerpts: Boolean(options && options.includeExcerpts)};
      },
      checkUpdateNotice(options) {
        calls.push(['checkUpdateNotice', options]);
        return {ok: true, timeoutMs: options && options.timeoutMs};
      },
      openExternalUrl(options) {
        calls.push(['openExternalUrl', options]);
        return 'opened';
      },
      createRuntimeLens() {
        calls.push(['createRuntimeLens']);
      }
    };
    const env = {dendryDesktop: bridge};

    assert.strictEqual(capabilities.raw(env), bridge, 'raw should return the fake bridge from env');
    assert.strictEqual(capabilities.raw({window: env}), bridge, 'raw should read a nested window bridge');
    assert.strictEqual(capabilities.raw({globalThis: env}), bridge, 'raw should read a nested globalThis bridge');
    assert.strictEqual(capabilities.isDesktop(env), true, 'fake bridge should report desktop mode');
    assert.strictEqual(capabilities.has('getLocale', env), true, 'has should detect fake bridge methods');
    assert.strictEqual(capabilities.canOpenStarterDemo(env), true, 'starter demo capability should detect fake bridge');
    assert.strictEqual(capabilities.canCheckUpdateNotice(env), true, 'update notice capability should detect fake bridge');
    assert.strictEqual(capabilities.canOpenExternalUrl(env), true, 'external URL capability should detect fake bridge');
    assert.strictEqual(capabilities.canCreateRuntimeLens(env), true, 'Runtime Lens capability should detect fake bridge');
    assert.strictEqual(capabilities.getLocale(env), 'zh-Hant', 'getLocale should pass through to the bridge');
    assert.deepStrictEqual(capabilities.getState(env), {projectPath: '/tmp/demo-project'}, 'getState should pass through to the bridge');

    const starter = await capabilities.openStarterDemo({includeExcerpts: true}, env);
    assert.deepStrictEqual(starter, {ok: true, includeExcerpts: true}, 'openStarterDemo should pass options through');
    const notice = await capabilities.checkUpdateNotice({timeoutMs: 1234}, env);
    assert.deepStrictEqual(notice, {ok: true, timeoutMs: 1234}, 'checkUpdateNotice should pass options through');
    assert.strictEqual(
      capabilities.openExternalUrl({url: 'https://example.com/dms'}, env),
      'opened',
      'openExternalUrl should return the bridge result'
    );
    assert.deepStrictEqual(
      calls.map((call) => call[0]),
      ['getLocale', 'getState', 'openStarterDemo', 'checkUpdateNotice', 'openExternalUrl'],
      'pass-through methods should call only the requested bridge methods'
    );

    assert.strictEqual(capabilities.raw(), null, 'raw() should stay empty before the global bridge exists');
    global.dendryDesktop = {getLocale: () => 'en-US'};
    assert.strictEqual(capabilities.raw(), global.dendryDesktop, 'raw() should lazily observe a later global bridge');
    assert.strictEqual(capabilities.getLocale(), 'en-US', 'getLocale should read the latest global bridge');
    global.dendryDesktop = {getLocale: () => 'zh-TW', getState: () => ({opened: true})};
    assert.strictEqual(capabilities.getLocale(), 'zh-TW', 'getLocale should not cache an earlier global bridge');
    assert.deepStrictEqual(capabilities.getState(), {opened: true}, 'getState should read the updated global bridge');

    assert.strictEqual(
      capabilities.getLocale({dendryDesktop: {getLocale() { throw new Error('locale failed'); }}}),
      '',
      'getLocale should return a fallback instead of throwing'
    );
    assert.strictEqual(
      capabilities.getState({dendryDesktop: {getState() { throw new Error('state failed'); }}}),
      null,
      'getState should return a fallback instead of throwing'
    );
    assert.strictEqual(
      capabilities.openExternalUrl({url: 'https://example.com'}, {dendryDesktop: {openExternalUrl() { throw new Error('open failed'); }}}),
      false,
      'openExternalUrl should return a fallback instead of throwing'
    );

    process.stdout.write(JSON.stringify({ok: true}, null, 2) + '\n');
  } finally {
    if (previousDesktop === undefined) {
      delete global.dendryDesktop;
    } else {
      global.dendryDesktop = previousDesktop;
    }
  }
}

main().catch((err) => {
  process.stderr.write('FAIL: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
