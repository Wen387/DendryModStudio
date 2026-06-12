(function initProjectMapObjectPlaytestEngineUi(global) {
  'use strict';

  // Renders the REAL-ENGINE play-test surface for the Object Editor (Phase 2).
  //
  // Unlike object_play_simulator_ui.js (the browser-only approximate dry-run),
  // this surface displays a `view` produced node-side by the actual vendored
  // DendryEngine (see desktop/object_playtest_host.js), reached over the
  // dendryDesktop.objectPlaytest IPC bridge. The engine has already resolved
  // text, conditions, effects, qdisplays and choice availability, and rendered
  // content/choice HTML through its own converter -- so those strings are
  // injected as-is (the same markup the shipped game would show). Only values
  // we add around them (quality names/numbers) are escaped here.
  //
  // It reuses the Preview/Play toggle + play-pane scaffold created by
  // object_play_simulator_ui.renderPaneWithPlay; this module only fills the
  // pane body, so nothing here renders a toggle of its own.

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    if (typeof require === 'function') {
      try {
        return require('./dom_text_utils.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  })();

  function escapeHtml(value) {
    if (domTextUtils && typeof domTextUtils.escapeHtml === 'function') {
      return domTextUtils.escapeHtml(value);
    }
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function escapeAttr(value) {
    if (domTextUtils && typeof domTextUtils.escapeAttr === 'function') {
      return domTextUtils.escapeAttr(value);
    }
    return escapeHtml(value);
  }

  function t(key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t(key, fallback) : fallback;
  }

  function capabilities(env) {
    if (global && global.ProjectMapDesktopCapabilities) {
      return global.ProjectMapDesktopCapabilities;
    }
    if (typeof require === 'function') {
      try {
        return require('./desktop_capabilities.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  // The real engine is only reachable inside the desktop shell (it needs the
  // node-side compiler + DendryEngine). In the plain browser viewer this is
  // false and the caller keeps the approximate simulator.
  function isAvailable(env) {
    const caps = capabilities(env);
    return Boolean(caps && typeof caps.has === 'function' && caps.has('objectPlaytest', env));
  }

  function bridge(env) {
    const caps = capabilities(env);
    const raw = caps && typeof caps.raw === 'function' ? caps.raw(env) : null;
    return raw && typeof raw.objectPlaytest === 'function' ? raw : null;
  }

  function invoke(options, env) {
    const desktop = bridge(env);
    if (!desktop) {
      return Promise.reject(new Error('objectPlaytest bridge unavailable'));
    }
    return Promise.resolve(desktop.objectPlaytest(options || {}));
  }

  function renderLoading() {
    // Compiling a large game runs in the desktop main process and can take a
    // beat (hundreds of ms on big mods); an animated bar makes clear the editor
    // is working, not frozen.
    return [
      '<div class="object-editing-play object-editing-play-engine is-loading" data-object-editing-play-engine="true">',
      '<div class="object-editing-play-engine-progress" role="progressbar" aria-busy="true" aria-label="' + escapeAttr(t('playEngine.loading', 'Compiling and running the real engine...')) + '"><span></span></div>',
      '<p class="object-editing-play-engine-loading">' + escapeHtml(t('playEngine.loading', 'Compiling and running the real engine...')) + '</p>',
      '</div>'
    ].join('');
  }

  function errorMessage(error) {
    if (error && error.message) {
      return String(error.message);
    }
    return t('playEngine.error', 'The real-engine play-test could not run. Check the project compiles cleanly.');
  }

  function renderError(error) {
    return [
      '<div class="object-editing-play object-editing-play-engine is-error" data-object-editing-play-engine="true">',
      '<p class="object-editing-play-engine-error">' + escapeHtml(errorMessage(error)) + '</p>',
      '<button type="button" class="object-editing-play-reset" data-play-action="engine-restart">' + escapeHtml(t('playSim.reset', 'Reset to start')) + '</button>',
      '</div>'
    ].join('');
  }

  // Initial, not-yet-started state: the run hasn't been claimed/started, so
  // there is no view and no error. A neutral invitation (reuses the existing
  // play-note styling) instead of an engine error.
  function renderReady() {
    return '<p class="object-editing-play-note" data-play-engine-ready="true">' +
      escapeHtml(t('playSim.ready', 'Ready — pick a scene to begin.')) +
      '</p>';
  }

  function renderBadges(opts) {
    const badges = [];
    if (opts.edited) {
      badges.push('<span class="object-editing-play-engine-badge is-edited">' + escapeHtml(t('playEngine.edited', 'Includes unsaved edits')) + '</span>');
    }
    if (opts.editFailed) {
      badges.push('<span class="object-editing-play-engine-badge is-edit-failed">' + escapeHtml(t('playEngine.editFailed', 'Unsaved edits could not be applied; showing saved version')) + '</span>');
    }
    return badges.length ? '<div class="object-editing-play-engine-badges">' + badges.join('') + '</div>' : '';
  }

  // The play-test entry picker: lets the author start the run from any authored
  // scene (an upstream lead-in, or `root` to play from the very beginning), not
  // only the edited object's own scene. `scenes` is the host's list of
  // selectable entry points; `defaultEntry` is the edited object's scene, which
  // we always keep selectable and mark so the author can find their way back.
  function renderEntryPicker(scenes, entry, defaultEntry) {
    const list = Array.isArray(scenes) ? scenes.slice() : [];
    const have = {};
    list.forEach((scene) => {
      if (scene && scene.id) {
        have[scene.id] = true;
      }
    });
    [defaultEntry, entry].forEach((id) => {
      if (id && !have[id]) {
        list.push({id: id, title: null});
        have[id] = true;
      }
    });
    if (list.length < 2) {
      return '';
    }
    list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const thisObject = t('playEngine.entryThisObject', '(this object)');
    const options = list.map((scene) => {
      const id = scene.id;
      const base = scene.title ? scene.title + ' (' + id + ')' : id;
      const label = id === defaultEntry ? base + ' ' + thisObject : base;
      const selected = id === entry ? ' selected' : '';
      return '<option value="' + escapeAttr(id) + '"' + selected + '>' + escapeHtml(label) + '</option>';
    }).join('');
    const labelText = t('playEngine.entryScene', 'Start from scene');
    return [
      '<label class="object-editing-play-entry" data-play-entry-field="true">',
      '<span>' + escapeHtml(labelText) + '</span>',
      '<select data-play-entry aria-label="' + escapeAttr(labelText) + '">' + options + '</select>',
      '</label>'
    ].join('');
  }

  function renderStatePanel(variables, startState) {
    const names = Array.isArray(variables) ? variables : [];
    if (!names.length) {
      return '';
    }
    const ss = startState && typeof startState === 'object' ? startState : {};
    return [
      '<details class="object-editing-play-state" open data-play-state="true">',
      '<summary>' + escapeHtml(t('playSim.startState', 'Starting state')) + '</summary>',
      '<div class="object-editing-play-state-vars">',
      names.map((name) => {
        const has = Object.prototype.hasOwnProperty.call(ss, name);
        const val = has ? ss[name] : 0;
        return [
          '<label class="object-editing-play-var">',
          '<span>Q.' + escapeHtml(name) + '</span>',
          '<input type="number" step="1" value="' + escapeAttr(String(val)) + '" data-play-var="' + escapeAttr(name) + '" aria-label="' + escapeAttr('Q.' + name) + '">',
          '</label>'
        ].join('');
      }).join(''),
      '</div>',
      '<button type="button" class="object-editing-play-reset" data-play-action="engine-restart">' + escapeHtml(t('playSim.reset', 'Reset to start')) + '</button>',
      '</details>'
    ].join('');
  }

  function renderChoice(choice) {
    const index = Number(choice && choice.index);
    // The engine renders choice titles as rich inline HTML (styled spans, magic
    // text). Wrap the whole title in ONE element so the option button's
    // column layout treats it as a single line that flows/wraps normally --
    // otherwise each inline run becomes its own flex item, stacking vertically.
    const labelHtml = (choice && choice.titleHtml) || escapeHtml(t('playSim.untitledOption', 'Untitled choice'));
    const label = '<span class="object-editing-play-option-label">' + labelHtml + '</span>';
    const subtitle = choice && choice.subtitle
      ? '<span class="object-editing-play-option-subtitle">' + choice.subtitle + '</span>'
      : '';
    if (choice && choice.canChoose === false) {
      return [
        '<li class="object-editing-play-option is-unavailable">',
        '<button type="button" disabled>' + label + subtitle + '</button>',
        '<span class="object-editing-play-option-unavailable">' + escapeHtml(t('playEngine.unavailable', 'Unavailable in this state')) + '</span>',
        '</li>'
      ].join('');
    }
    return [
      '<li class="object-editing-play-option">',
      '<button type="button" data-play-choice="' + escapeAttr(String(index)) + '">' + label + subtitle + '</button>',
      '</li>'
    ].join('');
  }

  // ---- art assets (background / sprites / portrait·card images) ------------
  // The host inlines each scene image as a data: URI before the view crosses
  // IPC, so they drop straight into a src/background here. A background that is a
  // CSS colour or gradient (not an image) arrives verbatim and is applied as-is.

  function backgroundStyle(bg) {
    if (!bg || typeof bg !== 'string') {
      return '';
    }
    if (bg.indexOf('data:') === 0) {
      return 'background-image:url("' + bg.replace(/"/g, '%22') + '");';
    }
    if (/gradient\(/i.test(bg)) {
      return 'background-image:' + bg + ';';
    }
    return 'background-color:' + bg + ';';
  }

  const SPRITE_LOCATION_CLASS = {
    topleft: 'top-left',
    topright: 'top-right',
    bottomleft: 'bottom-left',
    bottomright: 'bottom-right'
  };

  function spriteLocationClass(location) {
    const key = String(location || '').toLowerCase().replace(/[^a-z]/g, '');
    return SPRITE_LOCATION_CLASS[key] || 'top-left';
  }

  function spriteStyleString(style) {
    if (!style) {
      return '';
    }
    // The engine compiles set-<corner>-style as a raw CSS string; older/object
    // forms (jQuery .css() maps) are also tolerated.
    if (typeof style === 'string') {
      return style;
    }
    if (typeof style !== 'object') {
      return '';
    }
    return Object.keys(style)
      .map(function (prop) {
        const cssProp = prop.replace(/[A-Z]/g, function (ch) { return '-' + ch.toLowerCase(); });
        return cssProp + ':' + style[prop];
      })
      .join(';');
  }

  function renderSprites(view) {
    const sprites = Array.isArray(view.sprites) ? view.sprites : [];
    if (!sprites.length) {
      return '';
    }
    const styles = view.spriteStyles && typeof view.spriteStyles === 'object' ? view.spriteStyles : {};
    return sprites
      .map(function (sprite) {
        if (!sprite || typeof sprite.image !== 'string') {
          return '';
        }
        const inline = spriteStyleString(styles[sprite.location]);
        return '<img class="object-editing-play-sprite is-' + spriteLocationClass(sprite.location) +
          '" alt="" src="' + escapeAttr(sprite.image) + '"' +
          (inline ? ' style="' + escapeAttr(inline) + '"' : '') + '>';
      })
      .join('');
  }

  function renderPortrait(view) {
    const src = (typeof view.faceImage === 'string' && view.faceImage) ||
      (typeof view.cardImage === 'string' && view.cardImage) || '';
    if (!src) {
      return '';
    }
    return '<figure class="object-editing-play-portrait"><img alt="" src="' + escapeAttr(src) + '"></figure>';
  }

  // Pictures a scene attaches through display/arrival code (e.g. an on-display
  // {! image.src = "img/..." !} block). The host inlined each to a data URI; we
  // show them as full-width figures below the prose, where such code usually
  // drops them in the running game.
  function renderContentImages(view) {
    const imgs = Array.isArray(view.contentImages) ? view.contentImages : [];
    const valid = imgs.filter(function (src) {
      return typeof src === 'string' && src;
    });
    if (!valid.length) {
      return '';
    }
    return '<div class="object-editing-play-figures">' +
      valid.map(function (src) {
        return '<figure class="object-editing-play-figure"><img alt="" src="' + escapeAttr(src) + '"></figure>';
      }).join('') +
      '</div>';
  }

  // Render one engine turn (title + content + choices) -- the part that changes
  // every interaction. Kept separate from the pane wrapper so a starting-state
  // edit can refresh just this region and leave the inputs (and focus) intact.
  function renderNode(view, opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    if (!view) {
      // No view AND no error means we simply have not started a run yet (the
      // first IPC start response hasn't landed). Show an inviting "ready"
      // placeholder rather than the scary engine-error card, which used to
      // appear in the initial state and read like a failure.
      if (!options.error) {
        return renderReady();
      }
      return renderError(options.error);
    }
    const choices = Array.isArray(view.choices) ? view.choices : [];
    const title = view.title
      ? '<h4 class="object-editing-play-heading">' + escapeHtml(view.title) + '</h4>'
      : '';
    const content = view.contentHtml
      ? '<div class="object-editing-play-text">' + view.contentHtml + '</div>'
      : '';
    const gameOver = view.gameOver
      ? '<p class="object-editing-play-engine-gameover">' + escapeHtml(t('playEngine.gameOver', 'The game ends here.')) + '</p>'
      : '';
    // set-music is parsed/indexed as music but no engine UI hook plays it (it is
    // template-dependent -- see the model's finishTurn note). When the landed
    // scene declares it, surface a non-blocking note so the author knows the
    // play-test intentionally does NOT play it, rather than silently dropping it.
    const setMusicNote = view.setMusic
      ? '<p class="object-editing-play-note object-editing-play-setmusic-note" data-play-setmusic-note="true">' +
        escapeHtml(t('playEngine.setMusicNote', 'This scene sets music (set-music); the play-test does not play it — playback is template-dependent.')) + '</p>'
      : '';
    const choiceList = choices.length
      ? '<ul class="object-editing-play-options">' + choices.map(renderChoice).join('') + '</ul>'
      : (view.gameOver ? '' : '<p class="object-editing-play-no-options">' + escapeHtml(t('playSim.noOptions', 'No choices to simulate.')) + '</p>');
    const bgStyle = backgroundStyle(view.bg);
    const sprites = renderSprites(view);
    // Background + sprites sit in a "stage" banner above the text rather than
    // behind it -- clearer to read in an editor pane, and it avoids tinting the
    // prose. The banner only appears when the scene actually has art.
    const stage = (bgStyle || sprites)
      ? '<div class="object-editing-play-stage' + (bgStyle ? ' has-bg' : '') + '"' +
        (bgStyle ? ' style="' + escapeAttr(bgStyle) + '"' : '') + '>' + sprites + '</div>'
      : '';
    return [
      '<article class="object-editing-play-card" data-play-card="engine">',
      stage,
      '<div class="object-editing-play-body">',
      renderPortrait(view),
      title,
      content,
      renderContentImages(view),
      setMusicNote,
      gameOver,
      choiceList,
      '</div>',
      '</article>'
    ].join('');
  }

  // A small, always-rendered controls row. Re-roll restarts the play-test with a
  // fresh random seed -- keeping the author's starting-state edits and entry
  // scene -- so randomness-bearing scenes (decks/cards) can be explored beyond
  // the single fixed-seed outcome. It lives here (not in the starting-state
  // panel) precisely because randomness can exist with no quality variables, so
  // the affordance must be decoupled from that panel's presence. The Reset button
  // in renderStatePanel is the complementary action: it clears edits AND returns
  // to the default reproducible seed.
  // The mute button is a toggle: its label and aria-pressed flip with the shared
  // audioShell.muted state (an editor-level author preference persisted across
  // objects). handleClick reuses muteLabel() to relabel the button in place.
  function muteLabel(muted) {
    return muted ? t('playEngine.unmute', 'Unmute audio') : t('playEngine.mute', 'Mute audio');
  }

  function renderControls() {
    const muted = audioShell.muted;
    return [
      '<div class="object-editing-play-controls" data-play-controls="true">',
      '<button type="button" class="object-editing-play-reroll" data-play-action="engine-reroll">' +
        escapeHtml(t('playEngine.reroll', 'Re-roll randomness')) + '</button>',
      '<button type="button" class="object-editing-play-mute" data-play-action="engine-mute"' +
        ' aria-pressed="' + (muted ? 'true' : 'false') + '">' +
        escapeHtml(muteLabel(muted)) + '</button>',
      '</div>'
    ].join('');
  }

  // Render the full engine play pane (note + edit badges + controls + starting-
  // state panel + the per-turn node).
  function renderPane(view, opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    return [
      '<div class="object-editing-play object-editing-play-engine" data-object-editing-play-engine="true">',
      '<p class="object-editing-play-note object-editing-play-engine-note">' + escapeHtml(t('playEngine.note', 'Real-engine play-test: text, conditions, effects, qdisplays, choice availability and cross-scene routes are run by the actual DendryNexus engine.')) + '</p>',
      renderBadges(options),
      renderEntryPicker(options.scenes, options.entry, options.defaultEntry),
      renderControls(),
      renderStatePanel(options.variables, options.startState),
      '<div class="object-editing-play-node" data-play-engine-node="true">',
      renderNode(view, options),
      '</div>',
      '</div>'
    ].join('');
  }

  // ---- audio playback shell -------------------------------------------------
  // The engine reports each scene's `audio:` directive on view.audio (file tokens
  // already resolved to file:// URLs by the host). This shell turns a sequence of
  // directives + 'ended' events into playback against ONE real Audio element,
  // delegating all queue/shuffle/playlist logic to the pure reducer
  // (ProjectMapObjectPlaytestAudioModel). The Audio element is JS-held and never
  // lives in the per-turn innerHTML (rebuilt every interaction), so playback
  // survives re-renders. Cross-scene persistence is automatic: a turn whose
  // view.audio is null is a reducer no-op, so the current track keeps playing.

  function audioReducer() {
    if (global && global.ProjectMapObjectPlaytestAudioModel) {
      return global.ProjectMapObjectPlaytestAudioModel;
    }
    if (typeof require === 'function') {
      try {
        return require('./object_playtest_audio_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  const FADE_STEP_MS = 50;

  // Play-test audio mute is an EDITOR-level author preference (it applies across
  // every object the author play-tests), so it persists under the Studio
  // `dendry-mod-studio-*` namespace -- NOT the per-game-title key the reference
  // browser.js uses for disable_audio. Guard every localStorage hop: it can be
  // unavailable in restricted/headless contexts (mirrors i18n.js).
  const PLAYTEST_AUDIO_MUTED_KEY = 'dendry-mod-studio-playtest-audio-muted';

  function readMutedPref() {
    try {
      return !!(global && global.localStorage && global.localStorage.getItem(PLAYTEST_AUDIO_MUTED_KEY) === 'true');
    } catch (_e) {
      return false;
    }
  }

  function writeMutedPref(value) {
    try {
      if (global && global.localStorage) {
        global.localStorage.setItem(PLAYTEST_AUDIO_MUTED_KEY, value ? 'true' : 'false');
      }
    } catch (_e) {
      /* localStorage can be unavailable in restricted browser contexts. */
    }
  }

  const audioShell = {
    el: null,
    state: null,
    fadeTimer: null,
    unblock: null,
    blocked: false,
    watch: null,
    // Loaded eagerly from the persisted editor preference so the controls row
    // reflects the saved mute state on the very first render (before any track).
    muted: readMutedPref(),

    reducerState: function () {
      const model = audioReducer();
      if (!this.state && model) {
        this.state = model.freshState();
      }
      return this.state;
    },

    ensureEl: function () {
      if (this.el || typeof Audio === 'undefined') {
        return this.el;
      }
      const el = new Audio();
      const self = this;
      el.addEventListener('ended', function () {
        self.dispatch({type: 'ended'});
      });
      this.el = el;
      return el;
    },

    dispatch: function (input) {
      const model = audioReducer();
      if (!model) {
        return;
      }
      const res = model.reduce(this.reducerState(), input, {});
      this.state = res.state;
      this.exec(res.commands);
    },

    // Apply a turn's directive (string | null). Null/empty = persist (no-op).
    apply: function (directive) {
      this.dispatch(typeof directive === 'string' ? directive : '');
    },

    // Mute/unmute the play-test (mirrors browser.js toggle_audio). The reducer's
    // logical state is left untouched -- muting only silences the element -- so
    // unmute resumes exactly the track the reducer says is current. Note this is
    // intentionally NOT cleared by hardStop: mute is a persistent author setting.
    setMuted: function (on) {
      on = !!on;
      if (on === this.muted) {
        return;
      }
      this.muted = on;
      if (on) {
        // Pause the element; a paused element stays silent even as later turns'
        // play/replace commands re-arm its src (startPlayback is gated below).
        this.cancelFade();
        if (this.el) {
          try { this.el.pause(); } catch (_e) { /* ignore */ }
        }
      } else {
        // Resume whatever the reducer says is current, restoring loop from the
        // logical state (browser.js drops loop on mute and never restores it --
        // the reducer is our source of truth, so this is strictly more correct).
        const st = this.state;
        if (st && st.isPlaying && st.currentAudioURL) {
          if (this.el) {
            this.el.loop = !!st.isLooping;
          }
          this.startPlayback();
        }
      }
    },

    // A fresh playthrough -- hard-stop and clear before applying new audio.
    reset: function () {
      this.hardStop();
    },

    // Leaving the play surface -- stop and clear.
    stop: function () {
      this.hardStop();
    },

    hardStop: function () {
      this.cancelFade();
      this.clearUnblock();
      this.stopLeaveWatch();
      if (this.el) {
        try { this.el.pause(); } catch (_e) { /* ignore */ }
        try { this.el.removeAttribute('src'); this.el.load(); } catch (_e) { /* ignore */ }
        this.el.loop = false;
      }
      const model = audioReducer();
      this.state = model ? model.freshState() : null;
      this.blocked = false;
    },

    cancelFade: function () {
      if (this.fadeTimer) {
        clearInterval(this.fadeTimer);
        this.fadeTimer = null;
      }
    },

    fadeTo: function (target, ms, done) {
      const el = this.el;
      if (!el) {
        if (done) { done(); }
        return;
      }
      this.cancelFade();
      const clampTarget = Math.max(0, Math.min(1, target));
      const steps = ms > 0 ? Math.max(1, Math.round(ms / FADE_STEP_MS)) : 1;
      if (steps <= 1) {
        try { el.volume = clampTarget; } catch (_e) { /* ignore */ }
        if (done) { done(); }
        return;
      }
      const start = typeof el.volume === 'number' ? el.volume : 1;
      const delta = (clampTarget - start) / steps;
      let i = 0;
      const self = this;
      this.fadeTimer = setInterval(function () {
        i += 1;
        let v = start + delta * i;
        if (v < 0) { v = 0; }
        if (v > 1) { v = 1; }
        try { el.volume = v; } catch (_e) { /* ignore */ }
        if (i >= steps) {
          self.cancelFade();
          try { el.volume = clampTarget; } catch (_e) { /* ignore */ }
          if (done) { done(); }
        }
      }, FADE_STEP_MS);
    },

    playUrl: function (url, fade, fadeMs) {
      const el = this.ensureEl();
      if (!el || !url) {
        return;
      }
      this.cancelFade();
      try { el.src = url; } catch (_e) { return; }
      try { el.currentTime = 0; } catch (_e) { /* ignore */ }
      el.volume = fade ? 0 : 1;
      this.startPlayback();
      if (fade) {
        this.fadeTo(1, fadeMs);
      }
    },

    startPlayback: function () {
      const el = this.el;
      if (!el || typeof el.play !== 'function') {
        return;
      }
      // While muted, keep the reducer's logical state advancing (src is still
      // re-armed by playUrl) but never actually sound the element. setMuted(false)
      // calls back here to resume the current track.
      if (this.muted) {
        return;
      }
      this.ensureLeaveWatch();
      const self = this;
      let p;
      try { p = el.play(); } catch (_e) { p = null; }
      if (p && typeof p.then === 'function') {
        p.then(function () { self.blocked = false; }).catch(function () { self.armUnblock(); });
      }
    },

    // Autoplay can be blocked when the document lacks user activation. Arm a
    // one-shot listener so the next click anywhere resumes playback.
    armUnblock: function () {
      if (this.unblock || typeof document === 'undefined') {
        return;
      }
      this.blocked = true;
      const self = this;
      const handler = function () {
        self.clearUnblock();
        self.startPlayback();
      };
      document.addEventListener('click', handler, {once: true, capture: true});
      this.unblock = function () {
        document.removeEventListener('click', handler, {capture: true});
      };
    },

    clearUnblock: function () {
      if (this.unblock) {
        this.unblock();
        this.unblock = null;
      }
      this.blocked = false;
    },

    // Stop audio when the author leaves the play surface. The Audio element is
    // JS-held, so neither toggling Play->Preview (which only sets the play
    // panel's `hidden`) nor closing the editor modal (which removes the modal
    // subtree) would otherwise stop it. One observer covers both: re-check the
    // panel's connected+visible state on any relevant DOM mutation and stop when
    // it is gone or hidden. Active only while a track is playing.
    ensureLeaveWatch: function () {
      if (this.watch || typeof MutationObserver === 'undefined' || typeof document === 'undefined') {
        return;
      }
      const panel = document.querySelector('[data-preview-mode-panel="play"]');
      if (!panel || !document.body) {
        return;
      }
      const self = this;
      const obs = new MutationObserver(function () {
        if (!panel.isConnected || panel.hidden === true) {
          self.stop();
        }
      });
      obs.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['hidden']});
      this.watch = obs;
    },

    stopLeaveWatch: function () {
      if (this.watch) {
        try { this.watch.disconnect(); } catch (_e) { /* ignore */ }
        this.watch = null;
      }
    },

    exec: function (commands) {
      const self = this;
      (commands || []).forEach(function (cmd) {
        if (!cmd || !cmd.op) {
          return;
        }
        if (cmd.op === 'play') {
          self.playUrl(cmd.url, cmd.fade !== false, cmd.fadeMs);
          if (self.el) {
            self.el.loop = !!cmd.loop;
          }
        } else if (cmd.op === 'replace') {
          if (cmd.nofade) {
            self.playUrl(cmd.url, false, 0);
          } else {
            const fadeMs = cmd.fadeMs;
            self.fadeTo(0, fadeMs, function () {
              self.playUrl(cmd.url, true, fadeMs);
            });
          }
        } else if (cmd.op === 'stop') {
          if (cmd.fade && self.el) {
            self.fadeTo(0, cmd.fadeMs, function () {
              if (self.el) {
                try { self.el.pause(); } catch (_e) { /* ignore */ }
              }
            });
          } else if (self.el) {
            try { self.el.pause(); } catch (_e) { /* ignore */ }
          }
        } else if (cmd.op === 'setLoop') {
          if (self.el) {
            self.el.loop = !!cmd.value;
          }
        }
        // 'enqueue' needs no element action: the reducer holds the queue and the
        // shell's 'ended' listener advances it.
      });
    },

    debugState: function () {
      const st = this.state || {};
      return {
        currentAudioURL: st.currentAudioURL || '',
        isPlaying: this.el ? !this.el.paused : false,
        looping: this.el ? !!this.el.loop : false,
        volume: this.el ? this.el.volume : null,
        playlist: Array.isArray(st.playlist) ? st.playlist.slice() : [],
        queue: Array.isArray(st.queue) ? st.queue.slice() : [],
        blocked: !!this.blocked
      };
    }
  };

  // ---- Stateful controller --------------------------------------------------
  // Owns one play-test session and routes the pane's clicks/inputs. The Object
  // Editor passes a small `deps` accessor bag each call so this module needs no
  // knowledge of the editor's internals (and the heavy interaction wiring stays
  // out of the already-large canvas UI file).
  //   deps: { getModel(), getHost(), getInstallPlan(), getPreviewPane() }

  let current = null;

  function depModel(deps) {
    return (deps && typeof deps.getModel === 'function' && deps.getModel()) || null;
  }

  function depEntryScene(deps) {
    const model = depModel(deps);
    return (model && (model.objectId || model.sceneId)) || '';
  }

  function depContainer(deps) {
    const pane = deps && typeof deps.getPreviewPane === 'function' ? deps.getPreviewPane() : null;
    return pane && typeof pane.querySelector === 'function' ? pane.querySelector('[data-play-sim-pane]') : null;
  }

  function depPlan(deps) {
    try {
      return deps && typeof deps.getInstallPlan === 'function' ? deps.getInstallPlan() : null;
    } catch (_err) {
      return null;
    }
  }

  function depVariables(deps) {
    const model = depModel(deps);
    const sim = global && global.ProjectMapObjectPlaySimulator;
    const body = model && model.eventBody;
    if (sim && body && typeof sim.collectVariables === 'function') {
      try {
        return sim.collectVariables(body, {});
      } catch (_err) {
        return [];
      }
    }
    return [];
  }

  function depWithinHost(deps, el) {
    const host = deps && typeof deps.getHost === 'function' ? deps.getHost() : null;
    return Boolean(host && typeof host.contains === 'function' && host.contains(el));
  }

  // Produce a fresh random seed -- an array of strings, the same shape the model
  // expects (its DEFAULT_SEED is ['dendry-mod-studio-playtest']). The engine
  // hashes the array to seed its PRNG, so any distinct token yields a distinct
  // randomness stream. Math.random is available in the renderer.
  function newSeed() {
    return ['playtest-' + Math.random().toString(36).slice(2, 10)];
  }

  // Keyed by the edited OBJECT's scene (depEntryScene): switching objects in the
  // editor starts a fresh session. The effective `entry` defaults to that scene
  // but can be re-pointed by the entry picker without losing the session's
  // starting-state edits; `defaultEntry` records the object's own scene so the
  // picker can mark it. `seed` is null for a fresh/reset session so the host
  // falls back to the model's DEFAULT_SEED (reproducible); Re-roll sets it.
  function ensureSession(key) {
    if (!current || current.key !== key) {
      current = {key: key, entry: key, defaultEntry: key, scenes: [], token: null, viewState: null, view: null, startState: {}, seed: null, runId: 0, edited: false, editFailed: false, error: null};
    }
    return current;
  }

  function paneInto(container, deps) {
    if (!container) {
      return;
    }
    if (current && current.error) {
      container.innerHTML = renderError(current.error);
      return;
    }
    container.innerHTML = renderPane(current && current.view, {
      variables: depVariables(deps),
      startState: current ? current.startState : {},
      edited: current ? current.edited : false,
      editFailed: current ? current.editFailed : false,
      scenes: current ? current.scenes : [],
      entry: current ? current.entry : '',
      defaultEntry: current ? current.defaultEntry : ''
    });
  }

  function nodeInto(container) {
    if (!container) {
      return;
    }
    const node = container.querySelector('[data-play-engine-node]');
    if (!node) {
      return;
    }
    node.innerHTML = current && current.error
      ? renderError(current.error)
      : renderNode(current && current.view, {});
  }

  function applyStart(sess, res) {
    if (!res || res.ok === false) {
      sess.error = res || {error: 'engine-error'};
      return;
    }
    sess.error = null;
    sess.token = res.token || null;
    sess.viewState = res.state || null;
    sess.view = res.view || null;
    sess.edited = res.edited === true;
    sess.editFailed = res.editFailed === true;
    if (Array.isArray(res.scenes)) {
      sess.scenes = res.scenes;
    }
    // A start is a fresh playthrough (claim / restart / entry change / starting-
    // state edit): stop any prior audio, then apply this scene's directive. If
    // the scene has no audio (view.audio null) the apply is a no-op, leaving the
    // fresh session silent.
    audioShell.reset();
    audioShell.apply(sess.view && sess.view.audio);
  }

  function startSession(deps, container, nodeOnly) {
    const key = depEntryScene(deps);
    if (!container || !key) {
      return;
    }
    const sess = ensureSession(key);
    sess.error = null;
    const runId = (sess.runId += 1);
    if (nodeOnly) {
      const node = container.querySelector('[data-play-engine-node]');
      if (node) {
        node.innerHTML = renderLoading();
      }
    } else {
      container.innerHTML = renderLoading();
    }
    invoke({action: 'start', entrySceneId: sess.entry, startState: sess.startState, seed: sess.seed, plan: depPlan(deps)})
      .then((res) => {
        if (current !== sess || sess.runId !== runId) {
          return;
        }
        applyStart(sess, res);
        if (nodeOnly) {
          nodeInto(container);
        } else {
          paneInto(container, deps);
        }
      })
      .catch((err) => {
        if (current !== sess || sess.runId !== runId) {
          return;
        }
        sess.error = {error: 'engine-error', message: String((err && err.message) || err)};
        if (nodeOnly) {
          nodeInto(container);
        } else {
          paneInto(container, deps);
        }
      });
  }

  function advanceSession(deps, container, choiceIndex) {
    const sess = current;
    if (!sess || !container || !sess.token || !sess.viewState) {
      return;
    }
    const runId = (sess.runId += 1);
    const node = container.querySelector('[data-play-engine-node]');
    if (node) {
      node.innerHTML = renderLoading();
    }
    invoke({action: 'advance', token: sess.token, state: sess.viewState, choiceIndex: choiceIndex, plan: depPlan(deps)})
      .then((res) => {
        if (current !== sess || sess.runId !== runId) {
          return;
        }
        if (res && res.error === 'stale-game') {
          startSession(deps, container, false);
          return;
        }
        if (!res || res.ok === false) {
          sess.error = res || {error: 'engine-error'};
        } else {
          sess.error = null;
          sess.token = res.token || sess.token;
          sess.viewState = res.state || null;
          sess.view = res.view || null;
          // Advancing a choice persists audio across scenes: apply this scene's
          // directive (null = keep playing the current track).
          audioShell.apply(sess.view && sess.view.audio);
        }
        nodeInto(container);
      })
      .catch((err) => {
        if (current !== sess || sess.runId !== runId) {
          return;
        }
        sess.error = {error: 'engine-error', message: String((err && err.message) || err)};
        nodeInto(container);
      });
  }

  // Begin (or restart) a play-test in the pane. Resets the session for the
  // current object.
  function renderInto(container, deps) {
    if (!container) {
      return;
    }
    const sess = ensureSession(depEntryScene(deps));
    sess.error = null;
    startSession(deps, container, false);
  }

  // Take over the play pane when the real engine is reachable and the edited
  // object maps to a scene. Returns true when claimed so the caller can skip
  // the approximate simulator.
  function claimPane(container, deps) {
    if (!container || !isAvailable() || !depEntryScene(deps)) {
      return false;
    }
    renderInto(container, deps);
    return true;
  }

  function handleClick(event, deps) {
    if (!isAvailable() || !depEntryScene(deps)) {
      return false;
    }
    const target = event && event.target;
    if (!target || !target.closest) {
      return false;
    }
    const container = depContainer(deps);
    if (!container) {
      return false;
    }
    const restart = target.closest('[data-play-action="engine-restart"]');
    if (restart && depWithinHost(deps, restart)) {
      event.preventDefault();
      const entry = depEntryScene(deps);
      const sess = ensureSession(entry);
      // Reset to baseline: drop starting-state edits AND the rolled seed, so the
      // run returns to the default reproducible randomness.
      sess.startState = {};
      sess.seed = null;
      sess.error = null;
      startSession(deps, container, false);
      return true;
    }
    const reroll = target.closest('[data-play-action="engine-reroll"]');
    if (reroll && depWithinHost(deps, reroll)) {
      event.preventDefault();
      const entry = depEntryScene(deps);
      const sess = ensureSession(entry);
      // Re-roll: keep the author's starting-state edits and entry scene; only
      // swap in a fresh random seed and replay so deck/card randomness differs.
      sess.seed = newSeed();
      sess.error = null;
      startSession(deps, container, false);
      return true;
    }
    const mute = target.closest('[data-play-action="engine-mute"]');
    if (mute && depWithinHost(deps, mute)) {
      event.preventDefault();
      // Toggle mute on the shared shell, persist the editor preference, and
      // relabel the button in place -- no session restart or pane re-render, so
      // current playback state (and the per-turn node) is untouched.
      audioShell.setMuted(!audioShell.muted);
      writeMutedPref(audioShell.muted);
      mute.setAttribute('aria-pressed', audioShell.muted ? 'true' : 'false');
      mute.textContent = muteLabel(audioShell.muted);
      return true;
    }
    const choice = target.closest('[data-play-choice]');
    if (choice && depWithinHost(deps, choice)) {
      event.preventDefault();
      const index = Number(choice.dataset.playChoice);
      if (Number.isFinite(index)) {
        advanceSession(deps, container, index);
      }
      return true;
    }
    return false;
  }

  function handleInput(event, deps) {
    if (!isAvailable() || !depEntryScene(deps)) {
      return false;
    }
    const target = event && event.target;
    if (!target || !target.closest) {
      return false;
    }
    const entrySelect = target.closest('[data-play-entry]');
    if (entrySelect && depWithinHost(deps, entrySelect)) {
      const container = depContainer(deps);
      if (!container) {
        return false;
      }
      const sess = ensureSession(depEntryScene(deps));
      const chosen = entrySelect.value || '';
      if (chosen && chosen !== sess.entry) {
        sess.entry = chosen;
        // Node-only restart: re-run from the new entry but leave the picker (and
        // the starting-state inputs + their focus) in place.
        startSession(deps, container, true);
      }
      return true;
    }
    const varInput = target.closest('[data-play-var]');
    if (!varInput || !depWithinHost(deps, varInput)) {
      return false;
    }
    const container = depContainer(deps);
    if (!container) {
      return false;
    }
    const name = varInput.dataset.playVar || '';
    if (!name) {
      return false;
    }
    const sess = ensureSession(depEntryScene(deps));
    const num = Number(varInput.value);
    sess.startState[name] = Number.isFinite(num) ? num : 0;
    startSession(deps, container, true);
    return true;
  }

  const api = {
    isAvailable: isAvailable,
    invoke: invoke,
    renderLoading: renderLoading,
    renderError: renderError,
    renderPane: renderPane,
    renderNode: renderNode,
    // Stateful controller used by the Object Editor canvas UI.
    renderInto: renderInto,
    claimPane: claimPane,
    handleClick: handleClick,
    handleInput: handleInput,
    entrySceneId: depEntryScene,
    // Stop and clear audio when the play surface is dismissed (Preview/Play
    // toggle, object close). Safe to call when nothing is playing.
    stopAudio: function () { audioShell.stop(); },
    // Read-only playback snapshot for QA/CDP probing (the Audio element is
    // JS-held, not in the DOM, so it cannot be inspected via the DOM).
    audioDebugState: function () { return audioShell.debugState(); }
  };

  if (global) {
    global.ProjectMapObjectPlaytestEngineUi = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
