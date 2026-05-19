#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {readViewerI18n, readExploreBundle} = require('./check_viewer_assets.js');

const ROOT = __dirname;
const VIEWER_DIR = path.join(ROOT, 'viewer');
const VIEWER_HTML = path.join(VIEWER_DIR, 'index.html');

function fail(message) {
  process.stderr.write('FAIL: ' + message + '\n');
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function findObjectBody(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert(markerIndex !== -1, 'missing dictionary marker: ' + marker);
  const openIndex = source.indexOf('{', markerIndex);
  assert(openIndex !== -1, 'missing dictionary object for: ' + marker);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex + 1, index);
      }
    }
  }
  fail('unterminated dictionary object for: ' + marker);
}

function unescapeJsString(value) {
  return value
    .replace(/\\'/g, '\'')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\\\/g, '\\');
}

function extractDictionary(source, marker) {
  const body = findObjectBody(source, marker);
  const entries = new Map();
  const keyPattern = /'((?:\\.|[^'\\])+)'\s*:\s*'((?:\\.|[^'\\])*)'/g;
  let match = keyPattern.exec(body);
  while (match) {
    entries.set(unescapeJsString(match[1]), unescapeJsString(match[2]));
    match = keyPattern.exec(body);
  }
  return entries;
}

function extractConcreteTKeys(source) {
  const keys = new Set();
  const callPattern = /(^|[^A-Za-z0-9_.'"`])(?:t|translate)\(\s*['"]([^'"]+)['"]/g;
  let match = callPattern.exec(source);
  while (match) {
    keys.add(match[2]);
    match = callPattern.exec(source);
  }
  return keys;
}

function extractTokens(value) {
  const tokens = [];
  const tokenPattern = /\{([A-Za-z0-9_.-]+)\}/g;
  let match = tokenPattern.exec(value);
  while (match) {
    tokens.push(match[1]);
    match = tokenPattern.exec(value);
  }
  return tokens.sort();
}

function sameList(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

const html = fs.readFileSync(VIEWER_HTML, 'utf8');
const welcomeUiSource = fs.readFileSync(path.join(VIEWER_DIR, 'welcome_surface_ui.js'), 'utf8');
const htmlAndInjectedSurfaces = html + '\n' + welcomeUiSource;
const i18nSource = readViewerI18n(VIEWER_DIR);
const wizardSource = fs.readFileSync(path.join(VIEWER_DIR, 'wizard_ui.js'), 'utf8');
const cardSource = fs.readFileSync(path.join(VIEWER_DIR, 'card_ui.js'), 'utf8');
const appSource = readExploreBundle(VIEWER_DIR);
const eventDraftSource = fs.readFileSync(path.join(ROOT, 'authoring', 'event_draft.js'), 'utf8');
const meaningLayerSource = fs.readFileSync(path.join(ROOT, 'authoring', 'meaning_layer.js'), 'utf8');
const meaningLayerUiSource = fs.readFileSync(path.join(VIEWER_DIR, 'meaning_layer_ui.js'), 'utf8');
const eventWorkbenchUiSource = fs.readFileSync(path.join(VIEWER_DIR, 'event_workbench_ui.js'), 'utf8');
const dictionaries = {
  en: extractDictionary(i18nSource, 'en:'),
  'zh-Hant': extractDictionary(i18nSource, '\'zh-Hant\':')
};
const zhKeys = new Set(dictionaries['zh-Hant'].keys());
const enKeys = new Set(dictionaries.en.keys());

const missingEnKeys = Array.from(zhKeys).filter((key) => !enKeys.has(key)).sort();
const missingZhKeys = Array.from(enKeys).filter((key) => !zhKeys.has(key)).sort();
assert(missingEnKeys.length === 0, 'missing en keys for zh-Hant dictionary entries: ' + missingEnKeys.join(', '));
assert(missingZhKeys.length === 0, 'missing zh-Hant keys for en dictionary entries: ' + missingZhKeys.join(', '));

const cjkPattern = /[\u3400-\u9fff]/;
const englishValuesWithCjk = Array.from(dictionaries.en.entries())
  .filter(([, value]) => cjkPattern.test(value))
  .map(([key]) => key)
  .sort();
assert(englishValuesWithCjk.length === 0, 'en dictionary values should not contain CJK text: ' + englishValuesWithCjk.join(', '));

const tokenMismatches = Array.from(enKeys)
  .filter((key) => zhKeys.has(key))
  .filter((key) => !sameList(extractTokens(dictionaries.en.get(key)), extractTokens(dictionaries['zh-Hant'].get(key))))
  .sort();
assert(tokenMismatches.length === 0, 'localized placeholders should match between en and zh-Hant: ' + tokenMismatches.join(', '));

const requiredZhLocalizedKeys = [
  'topbar.projectIndexJson',
  'onboarding.dismiss',
  'existingScene.source',
  'design.baseline',
  'design.source',
  'news.source',
  'create.scene',
  'create.migration',
  'create.sample.eventTitle',
  'create.sample.eventIntro',
  'create.sample.eventOption0Body',
  'create.sample.newsDescription',
  'create.sample.cardTitle',
  'create.sample.cardIntro',
  'create.sample.cardOption0Body'
];
const untranslatedRequiredZh = requiredZhLocalizedKeys.filter((key) => {
  const enValue = dictionaries.en.get(key) || '';
  const zhValue = dictionaries['zh-Hant'].get(key) || '';
  return !zhValue || zhValue === enValue || !cjkPattern.test(zhValue);
});
assert(untranslatedRequiredZh.length === 0, 'required zh-Hant keys should be localized, not English fallback: ' + untranslatedRequiredZh.join(', '));

const viewerSources = fs.readdirSync(VIEWER_DIR)
  .filter((name) => name.endsWith('.js'))
  .map((name) => fs.readFileSync(path.join(VIEWER_DIR, name), 'utf8'))
  .join('\n');
const concreteViewerKeys = extractConcreteTKeys(viewerSources);
const missingConcreteKeys = Array.from(concreteViewerKeys)
  .filter((key) => !key.endsWith('.'))
  .filter((key) => !zhKeys.has(key) || !enKeys.has(key))
  .sort();
assert(missingConcreteKeys.length === 0, 'missing dictionary keys referenced by viewer t()/translate(): ' + missingConcreteKeys.join(', '));
assert(!wizardSource.includes("': 繼續'"), 'wizard generated source should use a localized default continue label');
assert(!eventDraftSource.includes(': 繼續'), 'EventDraft core should not hardcode a Chinese continuation label');
assert(!meaningLayerSource.includes("locale || 'zh-Hant'"), 'MeaningLayer core should not default missing locale to zh-Hant');
assert(!meaningLayerUiSource.includes(": 'zh-Hant';"), 'MeaningLayer UI should not default missing i18n to zh-Hant');
assert(!eventWorkbenchUiSource.includes('const TEXT = {'), 'Event Workbench UI should use the shared i18n catalogs, not a local bilingual dictionary');
assert(!cjkPattern.test(eventWorkbenchUiSource), 'Event Workbench UI source should not contain inline zh-Hant copy');
assert(!cjkPattern.test(meaningLayerUiSource), 'MeaningLayer UI source should not contain inline zh-Hant copy');

[
  'eventWorkbench.playerText',
  'eventWorkbench.action.edit_text',
  'eventWorkbench.role.option_label',
  'meaningPreview.section.playerText',
  'meaningPreview.assetType.image',
  'meaningPreview.readiness.notRuntime'
].forEach((key) => {
  assert(enKeys.has(key) && zhKeys.has(key), 'merged UI-localization key should exist in en and zh-Hant: ' + key);
});

const attrPattern = /data-i18n(?:-(?:aria-label|title|placeholder|value))?="([^"]+)"/g;
const missingAttributeKeys = [];
let attrMatch = attrPattern.exec(html);
while (attrMatch) {
  if (!zhKeys.has(attrMatch[1]) || !enKeys.has(attrMatch[1])) {
    missingAttributeKeys.push(attrMatch[1]);
  }
  attrMatch = attrPattern.exec(html);
}
assert(missingAttributeKeys.length === 0, 'localized HTML attributes need en and zh-Hant keys: ' + missingAttributeKeys.join(', '));

const unlocalizedAriaLabels = [];
const unlocalizedPlaceholders = [];
const unlocalizedTitles = [];
const tagPattern = /<[^>]+>/g;
let tagMatch = tagPattern.exec(html);
while (tagMatch) {
  const tag = tagMatch[0];
  const ariaMatch = tag.match(/\saria-label="([^"]+)"/);
  if (ariaMatch && !tag.includes('data-i18n-aria-label=') && ariaMatch[1] !== 'Dendry Mod Studio') {
    unlocalizedAriaLabels.push(ariaMatch[1]);
  }
  const placeholderMatch = tag.match(/\splaceholder="([^"]+)"/);
  if (
    placeholderMatch &&
    !tag.includes('data-i18n-placeholder=') &&
    !tag.includes('data-i18n-value=')
  ) {
    unlocalizedPlaceholders.push(placeholderMatch[1]);
  }
  const titleMatch = tag.match(/\stitle="([^"]+)"/);
  if (titleMatch && !tag.includes('data-i18n-title=')) {
    unlocalizedTitles.push(titleMatch[1]);
  }
  tagMatch = tagPattern.exec(html);
}
assert(unlocalizedAriaLabels.length === 0, 'aria-label attributes should be localized: ' + unlocalizedAriaLabels.join(', '));
assert(unlocalizedPlaceholders.length === 0, 'placeholder attributes should be localized: ' + unlocalizedPlaceholders.join(', '));
assert(unlocalizedTitles.length === 0, 'title attributes should be localized: ' + unlocalizedTitles.join(', '));

function tagForId(id) {
  const pattern = new RegExp('<[^>]+id="' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^>]*>', 'm');
  const match = html.match(pattern);
  return match ? match[0] : '';
}

[
  ['install-status', 'data-i18n="install.noPlan"'],
  ['install-project-status', 'data-i18n="install.projectMissing"'],
  ['wizard-title', 'data-i18n-value="create.sample.eventTitle"'],
  ['wizard-heading', 'data-i18n-value="create.sample.eventHeading"'],
  ['wizard-intro', 'data-i18n-value="create.sample.eventIntro"'],
  ['wizard-option-0-title', 'data-i18n-value="create.sample.eventOption0Title"'],
  ['wizard-option-0-subtitle', 'data-i18n-value="create.sample.eventOption0Subtitle"'],
  ['wizard-option-0-body', 'data-i18n-value="create.sample.eventOption0Body"'],
  ['wizard-option-1-title', 'data-i18n-value="create.sample.eventOption1Title"'],
  ['wizard-option-1-subtitle', 'data-i18n-value="create.sample.eventOption1Subtitle"'],
  ['wizard-option-1-body', 'data-i18n-value="create.sample.eventOption1Body"'],
  ['wizard-option-2-title', 'data-i18n-value="create.sample.eventOption2Title"'],
  ['wizard-option-2-subtitle', 'data-i18n-value="create.sample.eventOption2Subtitle"'],
  ['wizard-option-2-body', 'data-i18n-value="create.sample.eventOption2Body"'],
  ['wizard-option-3-title', 'data-i18n-value="create.sample.eventOption3Title"'],
  ['wizard-option-3-subtitle', 'data-i18n-value="create.sample.eventOption3Subtitle"'],
  ['wizard-option-3-body', 'data-i18n-value="create.sample.eventOption3Body"'],
  ['news-description', 'data-i18n-value="create.sample.newsDescription"'],
  ['card-title', 'data-i18n-value="create.sample.cardTitle"'],
  ['card-heading', 'data-i18n-value="create.sample.cardHeading"'],
  ['card-subtitle', 'data-i18n-value="create.sample.cardSubtitle"'],
  ['card-intro', 'data-i18n-value="create.sample.cardIntro"'],
  ['card-option-0-label', 'data-i18n-value="create.sample.cardOption0Label"'],
  ['card-option-0-subtitle', 'data-i18n-value="create.sample.cardOption0Subtitle"'],
  ['card-option-0-body', 'data-i18n-value="create.sample.cardOption0Body"'],
  ['card-option-1-label', 'data-i18n-value="create.sample.cardOption1Label"'],
  ['card-option-1-subtitle', 'data-i18n-value="create.sample.cardOption1Subtitle"'],
  ['card-option-1-body', 'data-i18n-value="create.sample.cardOption1Body"'],
  ['card-option-2-label', 'data-i18n-value="create.sample.cardOption2Label"'],
  ['card-option-2-subtitle', 'data-i18n-value="create.sample.cardOption2Subtitle"'],
  ['card-option-2-body', 'data-i18n-value="create.sample.cardOption2Body"'],
  ['card-option-3-label', 'data-i18n-value="create.sample.cardOption3Label"'],
  ['card-option-3-subtitle', 'data-i18n-value="create.sample.cardOption3Subtitle"'],
  ['card-option-3-body', 'data-i18n-value="create.sample.cardOption3Body"']
].forEach(([id, snippet]) => {
  const tag = tagForId(id);
  assert(tag && tag.includes(snippet), id + ' should carry localized default value/status: ' + snippet);
});

[
  ['mode switch aria', 'data-i18n-aria-label="aria.modeSwitch"'],
  ['language select aria', 'data-i18n-aria-label="aria.language"'],
  ['welcome close aria', 'data-i18n-aria-label="welcome.close"'],
  ['welcome route aria', 'data-i18n-aria-label="welcome.stepsLabel"'],
  ['project nav aria', 'data-i18n-aria-label="aria.projectMapViews"'],
  ['confidence legend aria', 'data-i18n-aria-label="aria.confidenceLegend"'],
  ['sort direction title', 'data-i18n-title="explore.sortDirection"'],
  ['sort direction aria', 'data-i18n-aria-label="explore.sortDirection"'],
  ['explore inspector aria', 'data-i18n-aria-label="aria.inspector"'],
  ['event wizard title', 'data-i18n="create.eventWizard"'],
  ['news wizard title', 'data-i18n="create.newsWizard"'],
  ['card wizard title', 'data-i18n="create.cardWizard"'],
  ['text proposal wizard title', 'data-i18n="create.textProposalWizard"'],
  ['create no index status', 'data-i18n="create.status.noIndexLoaded"'],
  ['create add effect', 'data-i18n="create.addEffect"'],
  ['create download root snippet', 'data-i18n="create.downloadRootSnippet"'],
  ['create download snippet', 'data-i18n="create.downloadSnippet"'],
  ['create download proposal', 'data-i18n="create.downloadProposal"'],
  ['news headline sample value', 'data-i18n-value="create.sample.newsHeadline"'],
  ['surface original sample value', 'data-i18n-value="create.sample.surfaceOriginal"'],
  ['surface replacement sample value', 'data-i18n-value="create.sample.surfaceReplacement"'],
  ['surface reason sample value', 'data-i18n-value="create.sample.surfaceReason"'],
  ['design atelier aria', 'data-i18n-aria-label="aria.designWorkspace"'],
  ['design search aria', 'data-i18n-aria-label="design.searchAria"'],
  ['design view tabs aria', 'data-i18n-aria-label="design.viewTabs"'],
  ['design scope aria', 'data-i18n-aria-label="design.scopeAria"'],
  ['design graph aria', 'data-i18n-aria-label="design.graphAria"'],
  ['design confidence legend aria', 'data-i18n-aria-label="aria.confidenceLegend"'],
  ['design zoom controls aria', 'data-i18n-aria-label="design.zoomControls"'],
  ['design inspector aria', 'data-i18n-aria-label="design.inspectorAria"'],
  ['install operation review aria', 'data-i18n-aria-label="install.operationReviewAria"'],
  ['install diff preview aria', 'data-i18n-aria-label="install.diffPreviewAria"'],
  ['runtime preview aria', 'data-i18n-aria-label="install.runtimePreviewAria"'],
  ['install result aria', 'data-i18n-aria-label="install.resultAria"'],
  ['create template aria', 'data-i18n-aria-label="create.templateAria"'],
  ['my changes aria', 'data-i18n-aria-label="draftWorkspace.panelAria"'],
  ['existing scene editor aria', 'data-i18n-aria-label="existingScene.editorAria"'],
  ['event variable assistant aria', 'data-i18n-aria-label="variableAssistant.aria"'],
  ['asset install picker label', 'data-i18n="assets.installPicker"'],
  ['asset advanced panel label', 'data-i18n="assets.advancedRawData"'],
  ['asset install request label', 'data-i18n="assets.installRequests"']
].forEach(([label, snippet]) => {
  const haystack = label.startsWith('welcome') ? htmlAndInjectedSurfaces : html;
  assert(haystack.includes(snippet), label + ' should be localized');
});

[
  ['event variable insert action', wizardSource, 'variableAssistant.insertCondition'],
  ['event variable effect action', wizardSource, 'variableAssistant.useEffect'],
  ['card variable insert action', cardSource, 'variableAssistant.insertCondition'],
  ['card variable effect action', cardSource, 'variableAssistant.useEffect']
].forEach(([label, source, snippet]) => {
  assert(source.includes(snippet), label + ' should use localized dynamic text');
});

[
  ['event dynamic Create renderer', wizardSource],
  ['card dynamic Create renderer', cardSource]
].forEach(([label, source]) => {
  assert(source.includes('project-map:locale-changed'), label + ' should refresh after locale changes');
  assert(source.includes('renderVariableAssistant();'), label + ' should rerender variable candidate actions');
  assert(source.includes('renderDraftAssetPanel(draft);'), label + ' should rerender draft asset configuration');
  assert(source.includes('renderAssetPicker(draft);'), label + ' should rerender asset picker configuration');
  assert(source.includes('renderAssetManifest(draft);'), label + ' should rerender asset manifest configuration');
});

[
  ['asset picker heading', 'assets.picker'],
  ['draft asset panel heading', 'assets.draftPanel'],
  ['asset slots heading', 'assets.slots'],
  ['asset manifest heading', 'assets.manifest'],
  ['asset slot empty state', 'assets.slotState.empty'],
  ['asset slot selected state', 'assets.slotState.selected'],
  ['asset slot pending install state', 'assets.slotState.pendingInstall'],
  ['asset copy action badge', 'install.action.copyAssetFile']
].forEach(([label, snippet]) => {
  assert(appSource.includes(snippet), label + ' should use localized dynamic asset text');
});

process.stdout.write(JSON.stringify({
  ok: true,
  checkedKeys: zhKeys.size,
  enKeys: enKeys.size,
  concreteViewerKeys: concreteViewerKeys.size
}, null, 2) + '\n');
