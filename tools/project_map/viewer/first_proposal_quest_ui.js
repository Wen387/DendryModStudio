(function initProjectMapFirstProposalQuestUi(global) {
  'use strict';

  // The loose "complete your first proposal" companion: a non-modal corner panel
  // (it never dims the page) that reads its checklist from
  // authoring/first_proposal_quest_model.js, listens for the real app events the
  // model names, and ticks each item as the user actually does it. Progress is
  // persisted, so closing and reopening resumes where they left off. Desktop-only
  // items are shown but locked in the browser — the deliberate "browser does
  // half" split. One item (read-diff) completes via an inline mini quiz instead
  // of an app event.

  function model() {
    if (global && global.ProjectMapFirstProposalQuestModel) {
      return global.ProjectMapFirstProposalQuestModel;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('../authoring/first_proposal_quest_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function contracts() {
    if (global && global.ProjectMapStudioSharedConstants) {
      return global.ProjectMapStudioSharedConstants;
    }
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        return require('../authoring/studio_shared_constants.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function storageKey() {
    const api = contracts();
    return api && api.STORAGE_KEYS && api.STORAGE_KEYS.firstProposalQuestProgress
      ? api.STORAGE_KEYS.firstProposalQuestProgress
      : 'dendry-mod-studio-first-proposal-quest.v1';
  }

  function openEventName() {
    const api = contracts();
    return api && api.EVENT_NAMES && api.EVENT_NAMES.openFirstProposalQuest
      ? api.EVENT_NAMES.openFirstProposalQuest
      : 'ProjectMap:open-first-proposal-quest';
  }

  function desktopCaps() {
    return global && global.ProjectMapDesktopCapabilities ? global.ProjectMapDesktopCapabilities : null;
  }

  function shellNav() {
    return global && global.ProjectMapShellNavigation ? global.ProjectMapShellNavigation : null;
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function decorateIcons(root) {
    const icons = global && global.ProjectMapIcons;
    if (icons && typeof icons.decorate === 'function' && root) {
      icons.decorate(root);
    }
  }

  function prefersReducedMotion() {
    return Boolean(global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function safeStorage() {
    try {
      return global && global.localStorage ? global.localStorage : null;
    } catch (_err) {
      return null;
    }
  }

  // Same kaomoji family as the guided tour, so the companion reads as the same
  // little guide. Decorative (aria-hidden); the heading carries the real label.
  const MASCOT = {
    idle: '(*・ω・)',
    cheer: '(*・ω・)b',
    done: '(*・ω・*)ﾉ'
  };

  const state = {
    running: false,
    els: null,
    progress: {},
    listeners: [],
    quizItemId: '',
    flashTimer: 0
  };

  const api = {
    open: openQuest,
    close: function close() { closeQuest(true); },
    isRunning: function isRunning() { return state.running; },
    reset: resetProgress
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapFirstProposalQuest = api;
  }
  if (!global || !global.document) {
    return;
  }

  onReady(function () { start(global.document); });

  function onReady(callback) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', callback);
    } else {
      callback();
    }
  }

  function start(document) {
    state.progress = readProgress();
    document.addEventListener(openEventName(), function () { openQuest(); });
    document.addEventListener('project-map:locale-changed', function () {
      if (state.running) {
        renderAll();
      }
    });
  }

  // --- Persistence -----------------------------------------------------------

  function readProgress() {
    const storage = safeStorage();
    if (!storage || typeof storage.getItem !== 'function') {
      return {};
    }
    try {
      const raw = storage.getItem(storageKey());
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  function writeProgress() {
    const storage = safeStorage();
    if (!storage || typeof storage.setItem !== 'function') {
      return;
    }
    try {
      storage.setItem(storageKey(), JSON.stringify(state.progress));
    } catch (_err) {
      // best effort only
    }
  }

  function resetProgress() {
    state.progress = {};
    writeProgress();
    if (state.running) {
      renderAll();
    }
  }

  // --- Environment -----------------------------------------------------------

  function isDesktop() {
    const caps = desktopCaps();
    return Boolean(caps && typeof caps.isDesktop === 'function' && caps.isDesktop(global));
  }

  function env() {
    return {desktop: isDesktop()};
  }

  function projectLoaded() {
    const nav = shellNav();
    const index = nav && typeof nav.getProjectIndex === 'function' ? nav.getProjectIndex() : null;
    return Boolean(index);
  }

  // --- Open / close ----------------------------------------------------------

  function openQuest() {
    const m = model();
    if (!m || !global.document) {
      return false;
    }
    ensurePanel(global.document);
    if (!state.els) {
      return false;
    }
    // Coming in with a project already loaded? The first item is already true —
    // start them with a tick rather than a chore.
    if (projectLoaded() && !state.progress.load) {
      state.progress.load = true;
      writeProgress();
    }
    state.running = true;
    bindEventListeners();
    state.els.panel.classList.remove('hidden');
    state.els.panel.classList.remove('is-collapsed');
    renderAll();
    return true;
  }

  function closeQuest(fromUser) {
    if (state.els) {
      state.els.panel.classList.add('hidden');
    }
    unbindEventListeners();
    clearFlash();
    state.running = false;
    return Boolean(fromUser);
  }

  function toggleCollapsed() {
    if (!state.els) {
      return;
    }
    state.els.panel.classList.toggle('is-collapsed');
  }

  // --- Event listening -------------------------------------------------------

  function bindEventListeners() {
    if (state.listeners.length) {
      return;
    }
    const m = model();
    const names = {};
    m.items().forEach(function (item) {
      if (item.completion === 'event' && item.event) {
        names[item.event] = true;
      }
    });
    Object.keys(names).forEach(function (name) {
      const handler = function (event) {
        onAppEvent(name, event && event.detail ? event.detail : {});
      };
      global.document.addEventListener(name, handler);
      state.listeners.push({name: name, handler: handler});
    });
  }

  function unbindEventListeners() {
    state.listeners.forEach(function (entry) {
      global.document.removeEventListener(entry.name, entry.handler);
    });
    state.listeners = [];
  }

  function onAppEvent(name, detail) {
    if (!state.running) {
      return;
    }
    const m = model();
    const environment = env();
    m.items().forEach(function (item) {
      if (state.progress[item.id]) {
        return;
      }
      // Never auto-complete an item the user cannot actually reach on this
      // platform (a locked desktop-only step in the browser).
      if (!m.isItemAvailable(item, environment)) {
        return;
      }
      if (m.matchEvent(item, name, detail)) {
        markDone(item.id);
      }
    });
  }

  function markDone(id) {
    if (state.progress[id]) {
      return;
    }
    state.progress[id] = true;
    writeProgress();
    renderAll();
    flashDone(id);
  }

  // --- Rendering -------------------------------------------------------------

  function ensurePanel(document) {
    if (state.els) {
      return;
    }
    const mount = document.getElementById('studio-first-proposal-quest-root') || document.body;
    if (!mount) {
      return;
    }
    const panel = document.createElement('aside');
    panel.id = 'studio-first-proposal-quest';
    panel.className = 'quest-panel hidden';
    panel.setAttribute('role', 'complementary');
    panel.setAttribute('aria-label', t('quest.heading', 'Your first proposal'));
    panel.innerHTML = [
      '<header class="quest-header">',
      '  <span class="quest-mascot" aria-hidden="true">' + MASCOT.idle + '</span>',
      '  <span class="quest-title" data-quest-title></span>',
      '  <span class="quest-progress" data-quest-progress aria-hidden="true"></span>',
      '  <button type="button" class="quest-collapse" data-quest-collapse aria-label="' + escapeAttr(t('quest.collapse', 'Collapse')) + '"><span data-ui-icon="chevron"></span></button>',
      '  <button type="button" class="quest-close" data-quest-close aria-label="' + escapeAttr(t('quest.close', 'Close')) + '"><span data-ui-icon="close"></span></button>',
      '</header>',
      '<div class="quest-body">',
      '  <ol class="quest-list" data-quest-list></ol>',
      '  <p class="quest-nudge" data-quest-nudge aria-live="polite"></p>',
      '  <div class="quest-quiz" data-quest-quiz hidden></div>',
      '  <div class="quest-celebrate" data-quest-celebrate hidden></div>',
      '</div>'
    ].join('');
    mount.appendChild(panel);
    state.els = {
      panel: panel,
      mascot: panel.querySelector('.quest-mascot'),
      title: panel.querySelector('[data-quest-title]'),
      progress: panel.querySelector('[data-quest-progress]'),
      list: panel.querySelector('[data-quest-list]'),
      nudge: panel.querySelector('[data-quest-nudge]'),
      quiz: panel.querySelector('[data-quest-quiz]'),
      celebrate: panel.querySelector('[data-quest-celebrate]')
    };
    panel.querySelector('[data-quest-collapse]').addEventListener('click', toggleCollapsed);
    panel.querySelector('[data-quest-close]').addEventListener('click', function () { closeQuest(true); });
    decorateIcons(panel);
  }

  function renderAll() {
    if (!state.els) {
      return;
    }
    const m = model();
    const environment = env();
    const completion = m.completion(state.progress, environment);

    state.els.title.textContent = t('quest.heading', 'Your first proposal');
    state.els.progress.textContent = completion.done + ' / ' + completion.available;

    renderList(m, environment);

    if (completion.allDone) {
      renderCelebration(m);
      state.els.nudge.hidden = true;
      state.els.quiz.hidden = true;
    } else {
      state.els.celebrate.hidden = true;
      if (state.els.quiz.hidden) {
        renderNudge(m, environment);
      }
    }
    decorateIcons(state.els.panel);
  }

  function renderList(m, environment) {
    const items = m.items();
    state.els.list.innerHTML = items.map(function (item) {
      const done = Boolean(state.progress[item.id]);
      const available = m.isItemAvailable(item, environment);
      const next = !done && available && isNextItem(m, environment, item.id);
      const classes = ['quest-item'];
      if (done) { classes.push('is-done'); }
      if (!available) { classes.push('is-locked'); }
      if (next) { classes.push('is-next'); }
      const mark = done
        ? '<span class="quest-item-mark" data-ui-icon="check" aria-hidden="true"></span>'
        : (!available
          ? '<span class="quest-item-mark quest-item-mark--locked" aria-hidden="true"></span>'
          : '<span class="quest-item-mark quest-item-mark--todo" aria-hidden="true"></span>');
      const quizButton = (item.completion === 'quiz' && available && !done)
        ? '<button type="button" class="quest-item-action" data-quest-quiz-open="' + escapeAttr(item.id) + '">' +
          escapeHtml(t('quest.quiz.play', 'Try it')) + '</button>'
        : '';
      const lockedHint = (!available && item.lockedKey)
        ? '<span class="quest-item-locked">' + escapeHtml(t(item.lockedKey, item.lockedFallback)) + '</span>'
        : '';
      return [
        '<li class="' + classes.join(' ') + '" data-quest-item="' + escapeAttr(item.id) + '">',
        mark,
        '<span class="quest-item-text">',
        '<span class="quest-item-title">' + escapeHtml(t(item.titleKey, item.titleFallback)) + '</span>',
        lockedHint,
        '</span>',
        quizButton,
        '</li>'
      ].join('');
    }).join('');
    state.els.list.querySelectorAll('[data-quest-quiz-open]').forEach(function (button) {
      button.addEventListener('click', function () {
        openQuiz(button.getAttribute('data-quest-quiz-open'));
      });
    });
  }

  // The first not-done, available item is the one we nudge toward.
  function nextItem(m, environment) {
    const items = m.items();
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (!state.progress[item.id] && m.isItemAvailable(item, environment)) {
        return item;
      }
    }
    return null;
  }

  function isNextItem(m, environment, id) {
    const item = nextItem(m, environment);
    return Boolean(item && item.id === id);
  }

  function renderNudge(m, environment) {
    const item = nextItem(m, environment);
    if (!item) {
      state.els.nudge.hidden = true;
      state.els.nudge.textContent = '';
      return;
    }
    state.els.nudge.hidden = false;
    state.els.nudge.textContent = t(item.nudgeKey, item.nudgeFallback);
    setMascot(MASCOT.idle);
  }

  // Briefly show the ticked item's acknowledgement (the fairy's "nice, you did
  // it" line) before settling back onto the next nudge.
  function flashDone(id) {
    const m = model();
    const item = m.items().filter(function (entry) { return entry.id === id; })[0];
    if (!item || !state.els || state.els.celebrate.hidden === false) {
      return;
    }
    clearFlash();
    state.els.nudge.hidden = false;
    state.els.nudge.textContent = t(item.doneKey, item.doneFallback);
    state.els.nudge.classList.add('is-flash');
    setMascot(MASCOT.cheer);
    state.flashTimer = global.setTimeout(function () {
      state.flashTimer = 0;
      if (!state.els) {
        return;
      }
      state.els.nudge.classList.remove('is-flash');
      const completion = m.completion(state.progress, env());
      if (!completion.allDone && state.els.quiz.hidden) {
        renderNudge(m, env());
      }
    }, prefersReducedMotion() ? 1200 : 2600);
  }

  function clearFlash() {
    if (state.flashTimer) {
      global.clearTimeout(state.flashTimer);
      state.flashTimer = 0;
    }
    if (state.els && state.els.nudge) {
      state.els.nudge.classList.remove('is-flash');
    }
  }

  function setMascot(face) {
    if (state.els && state.els.mascot) {
      state.els.mascot.textContent = face;
    }
  }

  // --- Read-diff mini quiz ---------------------------------------------------

  function openQuiz(itemId) {
    const m = model();
    const quiz = m.readDiffQuiz();
    state.quizItemId = itemId;
    clearFlash();
    state.els.nudge.hidden = true;
    state.els.quiz.hidden = false;
    state.els.quiz.innerHTML = [
      '<p class="quest-quiz-prompt">' + escapeHtml(t(quiz.promptKey, quiz.promptFallback)) + '</p>',
      '<div class="quest-quiz-diff" role="group">',
      quiz.lines.map(function (line) {
        return '<button type="button" class="quest-quiz-line quest-quiz-line--' + escapeAttr(line.kind) +
          '" data-quiz-line="' + escapeAttr(line.id) + '">' +
          '<span class="quest-quiz-sign" aria-hidden="true">' + diffSign(line.kind) + '</span>' +
          '<span class="quest-quiz-code">' + escapeHtml(t(line.textKey, line.textFallback)) + '</span>' +
          '</button>';
      }).join(''),
      '</div>',
      '<p class="quest-quiz-feedback" data-quiz-feedback aria-live="polite"></p>'
    ].join('');
    const feedback = state.els.quiz.querySelector('[data-quiz-feedback]');
    state.els.quiz.querySelectorAll('[data-quiz-line]').forEach(function (button) {
      button.addEventListener('click', function () {
        answerQuiz(button.getAttribute('data-quiz-line'), quiz, feedback);
      });
    });
    setMascot(MASCOT.idle);
  }

  function diffSign(kind) {
    if (kind === 'added') { return '+'; }
    if (kind === 'removed') { return '-'; }
    return ' ';
  }

  function answerQuiz(lineId, quiz, feedback) {
    if (lineId === quiz.answer) {
      feedback.textContent = t(quiz.correctKey, quiz.correctFallback);
      feedback.classList.remove('is-wrong');
      feedback.classList.add('is-right');
      setMascot(MASCOT.cheer);
      state.els.quiz.querySelectorAll('[data-quiz-line]').forEach(function (button) {
        button.disabled = true;
        if (button.getAttribute('data-quiz-line') === quiz.answer) {
          button.classList.add('is-answer');
        }
      });
      global.setTimeout(function () {
        closeQuiz();
        markDone(state.quizItemId || 'read-diff');
      }, prefersReducedMotion() ? 600 : 1400);
    } else {
      feedback.textContent = t(quiz.wrongKey, quiz.wrongFallback);
      feedback.classList.remove('is-right');
      feedback.classList.add('is-wrong');
    }
  }

  function closeQuiz() {
    if (!state.els) {
      return;
    }
    state.quizItemId = '';
    state.els.quiz.hidden = true;
    state.els.quiz.innerHTML = '';
  }

  // --- Celebration -----------------------------------------------------------

  function renderCelebration(m) {
    const copy = m.copy();
    state.els.celebrate.hidden = false;
    state.els.celebrate.innerHTML = [
      '<span class="quest-celebrate-mascot" aria-hidden="true">' + MASCOT.done + '</span>',
      '<strong class="quest-celebrate-title">' + escapeHtml(t(copy.doneTitleKey, copy.doneTitleFallback)) + '</strong>',
      '<span class="quest-celebrate-body">' + escapeHtml(t(copy.doneBodyKey, copy.doneBodyFallback)) + '</span>'
    ].join('');
    setMascot(MASCOT.done);
  }

  // --- Small helpers ---------------------------------------------------------

  function escapeHtml(text) {
    return String(text === undefined || text === null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(text) {
    return escapeHtml(text);
  }
})(typeof window !== 'undefined' ? window : globalThis);
