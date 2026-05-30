(function initProjectMapIcons(global) {
  'use strict';

  const ICONS = {
    folder: [
      '<path d="M3 6.5h6l1.8 2H21v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"></path>',
      '<path d="M3 8.5h18"></path>'
    ],
    play: [
      '<circle cx="12" cy="12" r="9"></circle>',
      '<path d="m10 8 6 4-6 4Z"></path>'
    ],
    search: [
      '<circle cx="10.5" cy="10.5" r="6.5"></circle>',
      '<path d="m16 16 5 5"></path>'
    ],
    map: [
      '<path d="M4 6.5 9.5 4l5 2.5L20 4v13.5L14.5 20l-5-2.5L4 20Z"></path>',
      '<path d="M9.5 4v13.5"></path>',
      '<path d="M14.5 6.5V20"></path>'
    ],
    edit: [
      '<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16Z"></path>',
      '<path d="m13.5 6.5 4 4"></path>'
    ],
    save: [
      '<path d="M5 4h12l2 2v14H5Z"></path>',
      '<path d="M8 4v6h8V4"></path>',
      '<path d="M8 20v-6h8v6"></path>'
    ],
    check: [
      '<circle cx="12" cy="12" r="9"></circle>',
      '<path d="m8 12.5 2.6 2.6L16.5 9"></path>'
    ],
    warning: [
      '<path d="M12 4 21 20H3Z"></path>',
      '<path d="M12 9v5"></path>',
      '<path d="M12 17h.01"></path>'
    ],
    info: [
      '<circle cx="12" cy="12" r="9"></circle>',
      '<path d="M12 11v5"></path>',
      '<path d="M12 8h.01"></path>'
    ],
    book: [
      '<path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3Z"></path>',
      '<path d="M5 4v19"></path>',
      '<path d="M17 7h2v13h-2"></path>'
    ],
    plus: [
      '<circle cx="12" cy="12" r="9"></circle>',
      '<path d="M12 8v8"></path>',
      '<path d="M8 12h8"></path>'
    ],
    card: [
      '<rect x="4" y="5" width="16" height="14" rx="2"></rect>',
      '<path d="M7 9h10"></path>',
      '<path d="M7 13h5"></path>'
    ],
    image: [
      '<rect x="4" y="5" width="16" height="14" rx="2"></rect>',
      '<circle cx="9" cy="10" r="1.5"></circle>',
      '<path d="m6 17 4.2-4.2a1.5 1.5 0 0 1 2.1 0L17 17"></path>'
    ],
    music: [
      '<path d="M9 18a3 3 0 1 1-2-2.83V6l11-2v10"></path>',
      '<path d="M18 14a3 3 0 1 1-2-2.83"></path>',
      '<path d="M9 9.5 18 8"></path>'
    ],
    settings: [
      '<circle cx="12" cy="12" r="3"></circle>',
      '<path d="M12 3v3"></path>',
      '<path d="M12 18v3"></path>',
      '<path d="m4.2 7.5 2.6 1.5"></path>',
      '<path d="m17.2 15 2.6 1.5"></path>',
      '<path d="m19.8 7.5-2.6 1.5"></path>',
      '<path d="m6.8 15-2.6 1.5"></path>'
    ],
    chevron: [
      '<path d="m9 6 6 6-6 6"></path>'
    ],
    close: [
      '<path d="M6 6l12 12"></path>',
      '<path d="M18 6 6 18"></path>'
    ],
    refresh: [
      '<path d="M20 6v5h-5"></path>',
      '<path d="M4 18v-5h5"></path>',
      '<path d="M18.5 9A7 7 0 0 0 6.4 6.2L4 8.5"></path>',
      '<path d="M5.5 15A7 7 0 0 0 17.6 17.8L20 15.5"></path>'
    ],
    text: [
      '<path d="M5 6h14"></path>',
      '<path d="M8 6v12"></path>',
      '<path d="M16 6v12"></path>',
      '<path d="M6 18h12"></path>'
    ],
    spark: [
      '<path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5Z"></path>',
      '<path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7Z"></path>'
    ]
  };

  function icon(name, options) {
    const opts = options || {};
    const key = ICONS[name] ? name : 'spark';
    const className = opts.className ? ' ' + String(opts.className).replace(/[^A-Za-z0-9_ -]/g, '') : '';
    return '<svg class="ui-icon' + className + '" data-ui-icon-instance="' + key + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + ICONS[key].join('') + '</svg>';
  }

  function mount(element, name, options) {
    if (!element) {
      return false;
    }
    element.innerHTML = icon(name, options);
    return true;
  }

  function prependTo(element, name, options) {
    if (!element || element.querySelector('[data-ui-icon-instance]')) {
      return false;
    }
    element.insertAdjacentHTML('afterbegin', icon(name, options));
    return true;
  }

  function decorate(root) {
    const scope = root && typeof root.querySelectorAll === 'function' ? root : global.document;
    if (!scope) {
      return 0;
    }
    let count = 0;
    scope.querySelectorAll('[data-ui-icon]').forEach((target) => {
      const name = target.getAttribute('data-ui-icon') || 'spark';
      const mounted = target.querySelector('[data-ui-icon-instance]');
      if (mounted && mounted.getAttribute('data-ui-icon-instance') === (ICONS[name] ? name : 'spark')) {
        return;
      }
      if (mount(target, name)) {
        count += 1;
      }
    });
    return count;
  }

  function decorateChrome(document) {
    if (!document || typeof document.querySelector !== 'function') {
      return 0;
    }
    const mappings = [
      ['#studio-open-onboarding', 'map'],
      ['#studio-open-template-hub', 'download'],
      ['#studio-open-tutorial-library', 'book'],
      ['#studio-open-announcements', 'info'],
      ['#studio-check-updates', 'refresh'],
      ['#desktop-run-doctor', 'check'],
      ['.nav-item[data-view="overview"]', 'map'],
      ['.nav-item[data-view="scenes"]', 'map'],
      ['.nav-item[data-view="events"]', 'play'],
      ['.nav-item[data-view="cards"]', 'card'],
      ['.nav-item[data-view="news"]', 'book'],
      ['.nav-item[data-view="textCorpus"]', 'text'],
      ['.nav-item[data-view="assets"]', 'image'],
      ['.nav-item[data-view="variables"]', 'settings'],
      ['.nav-item[data-view="surfaceText"]', 'edit'],
      ['.nav-item[data-view="coverage"]', 'check'],
      ['.nav-item[data-view="diagnostics"]', 'warning']
    ];
    let count = 0;
    mappings.forEach(([selector, name]) => {
      const element = document.querySelector(selector);
      if (prependTo(element, name)) {
        count += 1;
      }
    });
    return count;
  }

  function onReady(callback) {
    if (!global || !global.document) {
      return;
    }
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  const api = {
    icon,
    mount,
    prependTo,
    decorate,
    decorateChrome,
    names: () => Object.keys(ICONS)
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapIcons = api;
  }
  onReady(() => {
    decorate(global.document);
    decorateChrome(global.document);
  });
})(typeof window !== 'undefined' ? window : globalThis);
