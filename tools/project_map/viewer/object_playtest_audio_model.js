(function initProjectMapObjectPlaytestAudioModel(global) {
  'use strict';

  // Pure play-test AUDIO state machine (no DOM, no Audio element).
  //
  // The real-engine play-test (object_playtest_engine_model.js) now reports each
  // scene's `audio:` directive on `view.audio`, and the host
  // (desktop/object_playtest_host.js) has already rewritten the directive's file
  // tokens to file:// URLs the renderer can stream. This module turns a sequence
  // of directives (and 'ended' events) into a list of COMMANDS that a thin DOM
  // shell (in object_playtest_engine_ui.js) executes against one real Audio
  // element. Splitting the logic out keeps the queue/shuffle/playlist semantics
  // unit-testable with zero DOM, exactly mirroring the reference player at
  // node_modules/dendrynexus/lib/ui/browser.js (BrowserUserInterface.audio).
  //
  // The reducer is the single source of truth for logical playback state; the
  // shell only reports back when a track naturally 'ends' so queue/shuffle can
  // advance. `isPlaying` is tracked optimistically (set when a play command is
  // emitted, cleared on stop/end) -- it stands in for the reference player's
  // live `!currentAudio.ended && !currentAudio.paused` check.
  //
  // Directive grammar (space separated; same verbs as browser.js):
  //   <file...>            one or more file:// URLs (already resolved by host)
  //   loop                 loop the (single) current track indefinitely
  //   queue                play the file after the current one ends
  //   shuffle              after the current ends, pick a random playlist track
  //   nofade               swap instantly, no 2s cross-fade
  //   clear                empty the playlist
  //   null | none          stop playback (fades out unless nofade)

  var DEFAULT_FADE_MS = 2000; // browser.js sound_fade_time default.

  function freshState() {
    return {
      currentAudioURL: '',
      playlist: [],
      queue: [],
      isLooping: false,
      isPlaying: false,
      // After the current track ends, how to pick the next one: 'queue' pops the
      // queue, 'shuffle' draws a random playlist entry, null stops.
      onEndedMode: null
    };
  }

  function cloneState(state) {
    var base = state && typeof state === 'object' ? state : freshState();
    return {
      currentAudioURL: typeof base.currentAudioURL === 'string' ? base.currentAudioURL : '',
      playlist: Array.isArray(base.playlist) ? base.playlist.slice() : [],
      queue: Array.isArray(base.queue) ? base.queue.slice() : [],
      isLooping: base.isLooping === true,
      isPlaying: base.isPlaying === true,
      onEndedMode: base.onEndedMode === 'queue' || base.onEndedMode === 'shuffle' ? base.onEndedMode : null
    };
  }

  var VERBS = {loop: 1, queue: 1, nofade: 1, shuffle: 1, clear: 1};

  function parseDirective(directive) {
    var tokens = String(directive == null ? '' : directive).split(/\s+/).filter(Boolean);
    var out = {files: [], isLoop: false, isQueue: false, noFade: false, isShuffle: false, isClear: false, isStop: false};
    tokens.forEach(function (token) {
      var low = token.toLowerCase();
      if (low === 'loop') {
        out.isLoop = true;
      } else if (low === 'queue') {
        out.isQueue = true;
      } else if (low === 'nofade') {
        out.noFade = true;
      } else if (low === 'shuffle') {
        out.isShuffle = true;
      } else if (low === 'clear') {
        out.isClear = true;
      } else if (low === 'null' || low === 'none') {
        // browser.js treats null/none as a file token then special-cases it; we
        // model it as an explicit stop sentinel so it never pollutes the playlist.
        out.isStop = true;
      } else {
        out.files.push(token);
      }
    });
    return out;
  }

  function randomIndex(random, length) {
    var r = typeof random === 'function' ? random() : Math.random();
    var idx = Math.floor(r * length);
    if (!(idx >= 0)) {
      idx = 0;
    }
    if (idx >= length) {
      idx = length - 1;
    }
    return idx;
  }

  // Advance after a track naturally ends: pop the queue, or draw from the
  // playlist when shuffling. Mirrors the onended handlers in browser.js (queue
  // uses pop() = LIFO; shuffle picks a random playlist entry).
  function reduceEnded(state, commands, random, fadeMs) {
    state.isPlaying = false;
    if (state.isLooping) {
      // A looping element never fires 'ended'; nothing to advance.
      return;
    }
    var next = null;
    if (state.onEndedMode === 'queue' && state.queue.length) {
      next = state.queue.pop();
    } else if (state.onEndedMode === 'shuffle' && state.playlist.length) {
      next = state.playlist[randomIndex(random, state.playlist.length)];
    }
    if (next) {
      state.currentAudioURL = next;
      state.isPlaying = true;
      commands.push({op: 'play', url: next, fade: true, fadeMs: fadeMs, loop: false});
      // keep onEndedMode so the queue/shuffle chain continues
    } else {
      state.onEndedMode = null;
    }
  }

  function reduceDirective(state, parsed, commands, fadeMs, random) {
    if (parsed.isClear) {
      state.playlist = [];
    }
    if (parsed.files.length >= 1 || parsed.isShuffle) {
      state.playlist = state.playlist.concat(parsed.files);
    }
    var audioFile = parsed.files[0];

    // Stop (null|none): fade out (unless nofade) and clear current playback.
    if (parsed.isStop) {
      if (state.isPlaying || state.currentAudioURL) {
        commands.push({op: 'stop', fade: !parsed.noFade, fadeMs: fadeMs});
      }
      state.isPlaying = false;
      state.isLooping = false;
      state.currentAudioURL = '';
      state.onEndedMode = null;
      return;
    }

    // No file token (e.g. a lone `clear`, or `shuffle` to start from the existing
    // playlist). browser.js would mis-handle a fileless `loop`/`replace` by
    // setting src=undefined; we intentionally avoid that bug and only act on what
    // is meaningful.
    if (!audioFile) {
      if (parsed.isShuffle && state.playlist.length && !state.isPlaying) {
        audioFile = state.playlist[randomIndex(random, state.playlist.length)];
      } else {
        if (parsed.isLoop !== state.isLooping) {
          state.isLooping = parsed.isLoop;
          commands.push({op: 'setLoop', value: parsed.isLoop});
        }
        return;
      }
    }

    var continuation = state.currentAudioURL === audioFile || parsed.isQueue || parsed.isShuffle;
    if (state.currentAudioURL && continuation) {
      if (state.isPlaying) {
        // Current track still playing: enqueue and arm the end handler.
        state.queue.push(audioFile);
        if (parsed.isQueue) {
          state.onEndedMode = 'queue';
        } else if (parsed.isShuffle) {
          state.onEndedMode = 'shuffle';
        }
        commands.push({op: 'enqueue', url: audioFile});
      } else {
        // Current track already ended/paused: swap in immediately.
        state.currentAudioURL = audioFile;
        state.isPlaying = true;
        state.onEndedMode = parsed.isQueue ? 'queue' : parsed.isShuffle ? 'shuffle' : null;
        commands.push({op: 'play', url: audioFile, fade: !parsed.noFade, fadeMs: fadeMs, loop: parsed.isLoop});
      }
    } else if (state.currentAudioURL) {
      // A different track, not queue/shuffle: cross-fade replace.
      state.currentAudioURL = audioFile;
      state.isPlaying = true;
      state.onEndedMode = null;
      commands.push({op: 'replace', url: audioFile, nofade: parsed.noFade, fadeMs: fadeMs});
    } else {
      // Nothing playing yet: start fresh.
      state.currentAudioURL = audioFile;
      state.isPlaying = true;
      state.onEndedMode = parsed.isShuffle ? 'shuffle' : null;
      commands.push({op: 'play', url: audioFile, fade: !parsed.noFade, fadeMs: fadeMs, loop: parsed.isLoop});
    }

    if (parsed.isLoop !== state.isLooping) {
      state.isLooping = parsed.isLoop;
      commands.push({op: 'setLoop', value: parsed.isLoop});
    }
  }

  // reduce(prevState, input, opts) -> {state, commands}
  //   input: a directive STRING (e.g. "file:///x.mp3 loop"), or an event object
  //          {type:'ended'} reported by the shell when a track finishes.
  //   opts:  {random?: () => number, fadeMs?: number} -- inject RNG for
  //          deterministic shuffle in tests; override the cross-fade duration.
  // A null/empty/whitespace directive is a deliberate no-op (event-style audio:
  // a scene with no directive must NOT disturb current playback -- cross-scene
  // persistence lives here, not in the engine model).
  function reduce(prevState, input, opts) {
    var options = opts && typeof opts === 'object' ? opts : {};
    var random = typeof options.random === 'function' ? options.random : Math.random;
    var fadeMs = typeof options.fadeMs === 'number' && options.fadeMs >= 0 ? options.fadeMs : DEFAULT_FADE_MS;
    var state = cloneState(prevState);
    var commands = [];

    if (input && typeof input === 'object' && input.type === 'ended') {
      reduceEnded(state, commands, random, fadeMs);
      return {state: state, commands: commands};
    }

    var directive = typeof input === 'string' ? input : '';
    if (!directive.trim()) {
      return {state: state, commands: commands};
    }

    reduceDirective(state, parseDirective(directive), commands, fadeMs, random);
    return {state: state, commands: commands};
  }

  var api = {
    DEFAULT_FADE_MS: DEFAULT_FADE_MS,
    freshState: freshState,
    parseDirective: parseDirective,
    reduce: reduce
  };

  if (global) {
    global.ProjectMapObjectPlaytestAudioModel = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
