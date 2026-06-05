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
    return [
      '<div class="object-editing-play object-editing-play-engine is-loading" data-object-editing-play-engine="true">',
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
    const label = (choice && choice.titleHtml) || escapeHtml(t('playSim.untitledOption', 'Untitled choice'));
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

  // Render one engine turn (title + content + choices) -- the part that changes
  // every interaction. Kept separate from the pane wrapper so a starting-state
  // edit can refresh just this region and leave the inputs (and focus) intact.
  function renderNode(view, opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    if (!view) {
      return renderError(options.error || {error: 'engine-error'});
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
    const choiceList = choices.length
      ? '<ul class="object-editing-play-options">' + choices.map(renderChoice).join('') + '</ul>'
      : (view.gameOver ? '' : '<p class="object-editing-play-no-options">' + escapeHtml(t('playSim.noOptions', 'No choices to simulate.')) + '</p>');
    return [
      '<article class="object-editing-play-card" data-play-card="engine">',
      title,
      content,
      gameOver,
      choiceList,
      '</article>'
    ].join('');
  }

  // Render the full engine play pane (note + edit badges + starting-state panel
  // + the per-turn node).
  function renderPane(view, opts) {
    const options = opts && typeof opts === 'object' ? opts : {};
    return [
      '<div class="object-editing-play object-editing-play-engine" data-object-editing-play-engine="true">',
      '<p class="object-editing-play-note object-editing-play-engine-note">' + escapeHtml(t('playEngine.note', 'Real-engine play-test: text, conditions, effects, qdisplays, choice availability and cross-scene routes are run by the actual DendryNexus engine.')) + '</p>',
      renderBadges(options),
      renderStatePanel(options.variables, options.startState),
      '<div class="object-editing-play-node" data-play-engine-node="true">',
      renderNode(view, options),
      '</div>',
      '</div>'
    ].join('');
  }

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

  function ensureSession(entry) {
    if (!current || current.entry !== entry) {
      current = {entry: entry, token: null, viewState: null, view: null, startState: {}, runId: 0, edited: false, editFailed: false, error: null};
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
      editFailed: current ? current.editFailed : false
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
  }

  function startSession(deps, container, nodeOnly) {
    const entry = depEntryScene(deps);
    if (!container || !entry) {
      return;
    }
    const sess = ensureSession(entry);
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
    invoke({action: 'start', entrySceneId: entry, startState: sess.startState, plan: depPlan(deps)})
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
      sess.startState = {};
      sess.error = null;
      startSession(deps, container, false);
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
    // Back-compat alias.
    renderView: renderPane,
    // Stateful controller used by the Object Editor canvas UI.
    renderInto: renderInto,
    claimPane: claimPane,
    handleClick: handleClick,
    handleInput: handleInput,
    entrySceneId: depEntryScene
  };

  if (global) {
    global.ProjectMapObjectPlaytestEngineUi = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
