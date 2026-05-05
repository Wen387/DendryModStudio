(function initProjectMapSystemUiFixtureState(global) {
  'use strict';

  const FIXTURES = {
    default: {
      key: 'default',
      labelKey: 'systemUi.fixture.default',
      fallback: 'Default',
      bodyClass: 'is-fixture-default',
      sidebarBody: 'Resources available: 0',
      statusLines: ['Internal dissent: very low', 'Resources available: 0'],
      mainHint: 'Read.',
      optionHint: '',
      interactiveHint: 'Ready',
      diagnostics: [
        {id: 'fixture', labelKey: 'systemUi.fixtureDiagnostic', label: 'Fixture', value: 'Default'}
      ]
    },
    changed: {
      key: 'changed',
      labelKey: 'systemUi.fixture.changed',
      fallback: 'Changed state',
      bodyClass: 'is-fixture-changed',
      sidebarBody: 'Resources available: 2',
      statusLines: ['Internal dissent: rising', 'Policy work has started moving.', 'Public order: unstable'],
      mainHint: 'A saved proposal is visible in the player screen.',
      optionHint: 'Changed route available',
      interactiveHint: 'Draft changes active',
      diagnostics: [
        {id: 'fixture', labelKey: 'systemUi.fixtureDiagnostic', label: 'Fixture', value: 'Changed state'},
        {id: 'state', labelKey: 'systemUi.fixtureState', label: 'State', value: 'Preview-only changed values'}
      ]
    },
    status_heavy: {
      key: 'status_heavy',
      labelKey: 'systemUi.fixture.statusHeavy',
      fallback: 'Status-heavy',
      bodyClass: 'is-fixture-status-heavy',
      sidebarBody: 'Resources available: 4',
      statusLines: [
        'SPD position: opposition',
        'Prussian government: unstable',
        'Internal dissent: medium',
        'Reichstag composition: SPD 26% / KPD 12%',
        'Next election: 1932 Q4',
        'Economic growth: -1%'
      ],
      mainHint: 'Sidebar-heavy state shows whether labels remain readable.',
      optionHint: 'Inspect status display',
      interactiveHint: 'Status context expanded',
      diagnostics: [
        {id: 'fixture', labelKey: 'systemUi.fixtureDiagnostic', label: 'Fixture', value: 'Status-heavy'},
        {id: 'state', labelKey: 'systemUi.fixtureState', label: 'State', value: 'Many sidebar/status rows'}
      ]
    },
    interactive: {
      key: 'interactive',
      labelKey: 'systemUi.fixture.interactive',
      fallback: 'Interactive',
      bodyClass: 'is-fixture-interactive',
      sidebarBody: 'Resources available: 3',
      statusLines: ['Available cards: 3', 'Advisor ready: yes', 'Deck cooldown: 0'],
      mainHint: 'Playable regions are populated with cards and advisor prompts.',
      optionHint: 'Draw a card',
      interactiveHint: 'Cards, deck, and advisor are populated',
      diagnostics: [
        {id: 'fixture', labelKey: 'systemUi.fixtureDiagnostic', label: 'Fixture', value: 'Interactive'},
        {id: 'state', labelKey: 'systemUi.fixtureState', label: 'State', value: 'Card/deck/advisor preview'}
      ]
    }
  };

  const ALIASES = {
    busy: 'changed',
    changed_state: 'changed',
    status: 'status_heavy',
    statusheavy: 'status_heavy',
    card: 'interactive',
    cards: 'interactive'
  };

  function normalizeFixture(value) {
    const key = String(value || '').trim();
    const normalized = ALIASES[key] || key;
    return FIXTURES[normalized] ? normalized : 'default';
  }

  function fixtureState(value) {
    return clone(FIXTURES[normalizeFixture(value)]);
  }

  function fixtureList() {
    return ['default', 'changed', 'status_heavy', 'interactive'].map((key) => clone(FIXTURES[key]));
  }

  function clone(value) {
    return Object.assign({}, value, {
      statusLines: Array.isArray(value.statusLines) ? value.statusLines.slice() : [],
      diagnostics: Array.isArray(value.diagnostics) ? value.diagnostics.map((item) => Object.assign({}, item)) : []
    });
  }

  const api = {fixtureList, fixtureState, normalizeFixture};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSystemUiFixtureState = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
