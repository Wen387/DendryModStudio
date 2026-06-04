#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {assert} = require('./check_harness.js');

const contracts = require('./authoring/studio_shared_constants.js');
const themeApi = require('./viewer/theme_ui.js');

const ROOT = __dirname;
const VIEWER_HTML = path.join(ROOT, 'viewer', 'index.html');
const THEME_UI = path.join(ROOT, 'viewer', 'theme_ui.js');
const BASE_CSS = path.join(ROOT, 'viewer', 'styles', 'base.css');
const EN_I18N = path.join(ROOT, 'viewer', 'i18n', 'en.js');
const ZH_I18N = path.join(ROOT, 'viewer', 'i18n', 'zh-Hant.js');

const html = fs.readFileSync(VIEWER_HTML, 'utf8');
const themeUi = fs.readFileSync(THEME_UI, 'utf8');
const baseCss = fs.readFileSync(BASE_CSS, 'utf8');
const enI18n = fs.readFileSync(EN_I18N, 'utf8');
const zhI18n = fs.readFileSync(ZH_I18N, 'utf8');

// --- Centralized constants -------------------------------------------------
assert(contracts.STORAGE_KEYS.theme === 'dendry-mod-studio-theme',
  'theme storage key should be centralized');
assert(contracts.EVENT_NAMES.themeChanged === 'ProjectMap:theme-changed',
  'theme changed event should be centralized');
assert(Array.isArray(contracts.THEME_VALUES)
  && contracts.THEME_VALUES.join(',') === 'auto,light,dark',
  'theme values should be auto/light/dark');
assert(contracts.DEFAULT_THEME === 'auto', 'default theme should follow the system (auto)');

// --- base.css palette ------------------------------------------------------
assert(baseCss.includes(':root[data-theme="dark"]'),
  'base.css should define a dark palette via :root[data-theme="dark"]');
assert(/:root\[data-theme="dark"\][\s\S]*color-scheme:\s*dark/.test(baseCss),
  'the dark palette should set color-scheme: dark');
['--studio-paper', '--studio-surface', '--studio-ink', '--studio-accent',
  '--danger', '--warn', '--info', '--success', '--code', '--shadow'].forEach((token) => {
  // Every overridable token must appear at least twice: light default + dark.
  const count = baseCss.split(token + ':').length - 1;
  assert(count >= 2, 'dark palette should override ' + token + ' (found ' + count + ' definitions)');
});

// --- index.html FOUC bootstrap + control -----------------------------------
assert(html.includes('dendry-mod-studio-theme'),
  'index.html bootstrap should read the theme from localStorage');
assert(html.includes('prefers-color-scheme: dark'),
  'index.html bootstrap should resolve auto via prefers-color-scheme');
assert(html.includes('documentElement.dataset.theme'),
  'index.html bootstrap should set data-theme before first paint');
assert(html.includes('id="theme-select"'), 'topbar should expose a #theme-select control');
['value="auto"', 'value="light"', 'value="dark"'].forEach((opt) => {
  assert(html.includes('data-i18n="theme.' + opt.replace('value="', '').replace('"', '') + '"'),
    'theme select should offer the ' + opt + ' option');
});
assert(html.includes('theme_ui.js'), 'viewer should load theme_ui.js');
// The bootstrap must run before the stylesheet so the first paint is correct.
const bootstrapAt = html.indexOf('documentElement.dataset.theme');
const stylesheetAt = html.indexOf('href="styles.css"');
assert(bootstrapAt !== -1 && stylesheetAt !== -1 && bootstrapAt < stylesheetAt,
  'theme bootstrap should run before styles.css to avoid a flash of the wrong palette');

// --- theme_ui.js contract --------------------------------------------------
assert(themeUi.includes('ProjectMapThemeUi'), 'theme_ui.js should expose a browser API');
['getTheme', 'getResolvedTheme', 'setTheme', 'resolveTheme'].forEach((method) => {
  assert(typeof themeApi[method] === 'function', 'theme API should expose ' + method + '()');
});
assert(themeUi.includes('setItem') && themeUi.includes('getItem'),
  'theme_ui.js should persist the preference to localStorage');
assert(themeUi.includes("matchMedia('(prefers-color-scheme: dark)')"),
  'theme_ui.js should resolve auto via prefers-color-scheme');
assert(themeUi.includes('addEventListener') && themeUi.includes("'change'"),
  'theme_ui.js should track system theme changes live while in auto');
assert(themeUi.includes('dispatchChanged') || themeUi.includes('CustomEvent'),
  'theme_ui.js should announce theme changes for other surfaces');

// resolveTheme is pure and works without a DOM (Node has no matchMedia).
assert(themeApi.resolveTheme('dark') === 'dark', 'resolveTheme(dark) should be dark');
assert(themeApi.resolveTheme('light') === 'light', 'resolveTheme(light) should be light');
assert(themeApi.resolveTheme('bogus') === 'light',
  'resolveTheme should normalize unknown values (auto resolves to light without matchMedia)');
assert(themeApi.getTheme() === 'auto', 'theme should default to auto without stored state');

// --- i18n parity (both locales) --------------------------------------------
['theme.label', 'theme.auto', 'theme.light', 'theme.dark', 'aria.theme'].forEach((key) => {
  assert(enI18n.includes("'" + key + "'"), 'en locale should define ' + key);
  assert(zhI18n.includes("'" + key + "'"), 'zh-Hant locale should define ' + key);
});

process.stdout.write(JSON.stringify({
  ok: true,
  themeValues: contracts.THEME_VALUES,
  defaultTheme: contracts.DEFAULT_THEME
}, null, 2) + '\n');
