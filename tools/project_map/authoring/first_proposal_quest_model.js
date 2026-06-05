(function initProjectMapFirstProposalQuestModel(global) {
  'use strict';

  // Pure data + logic for the loose "complete your first proposal" quest. No DOM
  // lives here: viewer/first_proposal_quest_ui.js renders the corner companion,
  // listens for the events named below, and ticks each item as the user actually
  // does it.
  //
  // Unlike the guided tour (modal, tells you things, advances on Next), this is a
  // non-blocking checklist that watches real app events. Each item declares the
  // event + predicate that completes it, so the UI never hand-rolls the matching.
  // One item (read-diff) completes via an in-widget mini quiz instead of an app
  // event, because "did you read the diff" is a habit, not something the app emits.
  //
  // Platform split: 'any' items work in the browser too; 'desktop' items (the real
  // check / read-diff / apply cluster) are locked in the browser, which is the
  // deliberate "browser does half" boundary.

  const PLATFORMS = ['any', 'desktop'];
  const COMPLETIONS = ['event', 'quiz'];

  // Canonical event names this model points at. Kept as plain strings so the
  // model has no load-time dependency; check_first_proposal_quest_model.js
  // cross-checks them against studio_shared_constants.EVENT_NAMES.
  const EVENTS = {
    indexLoaded: 'ProjectMap:index-loaded',
    exploreEntryOpened: 'ProjectMap:explore-entry-opened',
    draftWorkspaceUpdated: 'ProjectMap:draft-workspace-updated',
    installResult: 'ProjectMap:install-result'
  };

  function asString(value) {
    return value === undefined || value === null ? '' : String(value);
  }

  function normalizePlatform(value) {
    const platform = asString(value) || 'any';
    return PLATFORMS.indexOf(platform) === -1 ? 'any' : platform;
  }

  function normalizeCompletion(value) {
    const completion = asString(value) || 'event';
    return COMPLETIONS.indexOf(completion) === -1 ? 'event' : completion;
  }

  // A predicate over an event's detail, declared as small data the model knows
  // how to evaluate: equals (strict per-key) and gte (numeric >=). Null means the
  // event firing at all is enough.
  function normalizeMatch(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const out = {};
    if (value.equals && typeof value.equals === 'object') {
      out.equals = Object.assign({}, value.equals);
    }
    if (value.gte && typeof value.gte === 'object') {
      out.gte = Object.assign({}, value.gte);
    }
    return out.equals || out.gte ? out : null;
  }

  function item(spec) {
    const source = spec || {};
    return {
      id: asString(source.id),
      titleKey: asString(source.titleKey),
      titleFallback: asString(source.titleFallback),
      // The fairy's nudge shown while this is the next thing to try.
      nudgeKey: asString(source.nudgeKey),
      nudgeFallback: asString(source.nudgeFallback),
      // The acknowledgement shown briefly when the item ticks.
      doneKey: asString(source.doneKey),
      doneFallback: asString(source.doneFallback),
      platform: normalizePlatform(source.platform),
      completion: normalizeCompletion(source.completion),
      // For completion === 'event': the document event to listen for.
      event: asString(source.event),
      match: normalizeMatch(source.match),
      // Shown in place of the action when the item is locked (browser on a
      // desktop-only item).
      lockedKey: asString(source.lockedKey),
      lockedFallback: asString(source.lockedFallback)
    };
  }

  const ITEMS = [
    item({
      id: 'load',
      titleKey: 'quest.item.load.title',
      titleFallback: 'Open a project or demo',
      nudgeKey: 'quest.item.load.nudge',
      nudgeFallback: 'Pick a place to practice — "Load Demo" on the Welcome Hub gives you a sandbox where nothing touches your real files.',
      doneKey: 'quest.item.load.done',
      doneFallback: 'Loaded. This sandbox is your practice ground.',
      platform: 'any',
      completion: 'event',
      event: EVENTS.indexLoaded
    }),
    item({
      id: 'open-scene',
      titleKey: 'quest.item.openScene.title',
      titleFallback: 'Open a scene in Explore',
      nudgeKey: 'quest.item.openScene.nudge',
      nudgeFallback: 'Head to Explore and open a scene from the sidebar — get a feel for the thing you are about to change.',
      doneKey: 'quest.item.openScene.done',
      doneFallback: 'There it is — that is what a scene looks like.',
      platform: 'any',
      completion: 'event',
      event: EVENTS.exploreEntryOpened,
      match: {equals: {view: 'scenes'}}
    }),
    item({
      id: 'draft',
      titleKey: 'quest.item.draft.title',
      titleFallback: 'Make your first draft',
      nudgeKey: 'quest.item.draft.nudge',
      nudgeFallback: 'Change a line and save it as a draft. It is only a proposal — not one character of your source files has moved yet.',
      doneKey: 'quest.item.draft.done',
      doneFallback: 'Your first draft landed in My Changes. One trick richer than a minute ago.',
      platform: 'any',
      completion: 'event',
      event: EVENTS.draftWorkspaceUpdated,
      match: {gte: {count: 1}}
    }),
    item({
      id: 'check',
      titleKey: 'quest.item.check.title',
      titleFallback: 'Run a check in Install',
      nudgeKey: 'quest.item.check.nudge',
      nudgeFallback: 'Switch to Install and run the check. It plays your change through and lays the diff out: left is now, right is after.',
      doneKey: 'quest.item.check.done',
      doneFallback: 'Checked. That diff is the last gate before anything is applied.',
      platform: 'desktop',
      completion: 'event',
      event: EVENTS.installResult,
      match: {equals: {dryRun: true, ok: true}},
      lockedKey: 'quest.item.check.locked',
      lockedFallback: 'This step needs the desktop app — the browser cannot run a real check.'
    }),
    item({
      id: 'read-diff',
      titleKey: 'quest.item.readDiff.title',
      titleFallback: 'Read the diff',
      nudgeKey: 'quest.item.readDiff.nudge',
      nudgeFallback: 'Before applying, learn to read the diff. Here is a tiny one — spot the line your edit produces.',
      doneKey: 'quest.item.readDiff.done',
      doneFallback: 'Now you can read a diff. That is the single most useful safety habit here.',
      platform: 'desktop',
      completion: 'quiz',
      lockedKey: 'quest.item.readDiff.locked',
      lockedFallback: 'Paired with the check — available in the desktop app.'
    }),
    item({
      id: 'apply',
      titleKey: 'quest.item.apply.title',
      titleFallback: 'Apply the change',
      nudgeKey: 'quest.item.apply.nudge',
      nudgeFallback: 'Happy with the diff? Apply it. Studio backs up whatever it replaces first, so this step can be undone.',
      doneKey: 'quest.item.apply.done',
      doneFallback: 'Applied. You just carried an idea all the way into the real game files.',
      platform: 'desktop',
      completion: 'event',
      event: EVENTS.installResult,
      match: {equals: {dryRun: false, ok: true}},
      lockedKey: 'quest.item.apply.locked',
      lockedFallback: 'Applying is desktop-only — the browser stops at the step before.'
    })
  ];

  // The read-diff mini quiz: a tiny canned diff (context + one removed + one
  // added line). The player picks the line the file becomes after applying — the
  // "+" line — which teaches the one habit that matters most before Apply.
  const READ_DIFF_QUIZ = {
    promptKey: 'quest.quiz.prompt',
    promptFallback: 'After you apply, which line is what the scene becomes?',
    lines: [
      {id: 'title', kind: 'context', textKey: 'quest.quiz.line.title', textFallback: 'title: Harbor Morning'},
      {id: 'old', kind: 'removed', textKey: 'quest.quiz.line.old', textFallback: 'The dockers wait at dawn.'},
      {id: 'new', kind: 'added', textKey: 'quest.quiz.line.new', textFallback: 'The dockers gather at dawn.'},
      {id: 'opts', kind: 'context', textKey: 'quest.quiz.line.opts', textFallback: 'options:'}
    ],
    answer: 'new',
    correctKey: 'quest.quiz.correct',
    correctFallback: 'Right. The "+" line is what the file becomes — reading that before you apply is the habit that keeps edits safe.',
    wrongKey: 'quest.quiz.wrong',
    wrongFallback: 'Almost. The "-" line is the old text being removed; the "+" line is the new result. Take another look.'
  };

  // Companion entrance + completion sign-off copy (the fairy's framing lines).
  const COPY = {
    introTitleKey: 'quest.intro.title',
    introTitleFallback: 'Want to try it hands-on?',
    introBodyKey: 'quest.intro.body',
    introBodyFallback: 'I will sit in the corner and tick things off as you do them. Leave whenever you like.',
    headingKey: 'quest.heading',
    headingFallback: 'Your first proposal',
    doneTitleKey: 'quest.done.title',
    doneTitleFallback: 'You did a full lap',
    doneBodyKey: 'quest.done.body',
    doneBodyFallback: 'Find, change, check, apply — you walked the whole path yourself. Your own project works the same way.'
  };

  function cloneItem(value) {
    return item(value);
  }

  function items() {
    return ITEMS.map(cloneItem);
  }

  function platforms() {
    return PLATFORMS.slice();
  }

  function readDiffQuiz() {
    return {
      promptKey: READ_DIFF_QUIZ.promptKey,
      promptFallback: READ_DIFF_QUIZ.promptFallback,
      lines: READ_DIFF_QUIZ.lines.map(function (line) {
        return Object.assign({}, line);
      }),
      answer: READ_DIFF_QUIZ.answer,
      correctKey: READ_DIFF_QUIZ.correctKey,
      correctFallback: READ_DIFF_QUIZ.correctFallback,
      wrongKey: READ_DIFF_QUIZ.wrongKey,
      wrongFallback: READ_DIFF_QUIZ.wrongFallback
    };
  }

  function copy() {
    return Object.assign({}, COPY);
  }

  function isDesktopEnv(env) {
    return Boolean(env && env.desktop);
  }

  // A desktop-only item is locked (visible but not actionable) in the browser.
  function isItemAvailable(itemInput, env) {
    const normalized = item(itemInput);
    if (normalized.platform === 'desktop') {
      return isDesktopEnv(env);
    }
    return true;
  }

  function availableItems(env) {
    return items().filter(function (entry) {
      return isItemAvailable(entry, env);
    });
  }

  function matchesDetail(match, detail) {
    if (!match) {
      return true;
    }
    const data = detail || {};
    if (match.equals) {
      const keys = Object.keys(match.equals);
      for (let i = 0; i < keys.length; i += 1) {
        if (data[keys[i]] !== match.equals[keys[i]]) {
          return false;
        }
      }
    }
    if (match.gte) {
      const keys = Object.keys(match.gte);
      for (let i = 0; i < keys.length; i += 1) {
        const value = Number(data[keys[i]]);
        if (!(value >= match.gte[keys[i]])) {
          return false;
        }
      }
    }
    return true;
  }

  // Does this event (name + detail) complete the given item? Quiz items never
  // complete from an event.
  function matchEvent(itemInput, eventName, detail) {
    const normalized = item(itemInput);
    if (normalized.completion !== 'event') {
      return false;
    }
    if (!normalized.event || normalized.event !== asString(eventName)) {
      return false;
    }
    return matchesDetail(normalized.match, detail);
  }

  function progressMap(progress) {
    const out = {};
    if (progress && typeof progress === 'object') {
      Object.keys(progress).forEach(function (key) {
        if (progress[key]) {
          out[key] = true;
        }
      });
    }
    return out;
  }

  // Completion is measured against the items available on this platform, so a
  // browser user who finishes the three unlocked items reads as "done" rather
  // than stuck at 3/6 forever.
  function completion(progress, env) {
    const done = progressMap(progress);
    const all = items();
    const available = all.filter(function (entry) {
      return isItemAvailable(entry, env);
    });
    const doneAvailable = available.filter(function (entry) {
      return done[entry.id];
    });
    return {
      total: all.length,
      available: available.length,
      done: doneAvailable.length,
      allDone: available.length > 0 && doneAvailable.length === available.length
    };
  }

  // Every i18n key the dataset references, so the localization check can confirm
  // both locales define them without re-listing keys by hand.
  function referencedI18nKeys() {
    const keys = [];
    const seen = {};
    function add(key) {
      if (key && !seen[key]) {
        seen[key] = true;
        keys.push(key);
      }
    }
    ITEMS.forEach(function (entry) {
      add(entry.titleKey);
      add(entry.nudgeKey);
      add(entry.doneKey);
      add(entry.lockedKey);
    });
    add(READ_DIFF_QUIZ.promptKey);
    add(READ_DIFF_QUIZ.correctKey);
    add(READ_DIFF_QUIZ.wrongKey);
    READ_DIFF_QUIZ.lines.forEach(function (line) {
      add(line.textKey);
    });
    Object.keys(COPY).forEach(function (key) {
      if (/Key$/.test(key)) {
        add(COPY[key]);
      }
    });
    return keys;
  }

  const api = {
    item,
    items,
    platforms,
    readDiffQuiz,
    copy,
    isItemAvailable,
    availableItems,
    matchEvent,
    completion,
    referencedI18nKeys,
    EVENTS: Object.assign({}, EVENTS)
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapFirstProposalQuestModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
