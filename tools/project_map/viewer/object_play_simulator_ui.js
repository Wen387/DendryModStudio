(function initProjectMapObjectPlaySimulatorUi(global) {
  'use strict';

  // Renders the approximate inline "play test" surface for the Object Editor.
  // Kept out of preview_object_editor.js so that already-large file does not
  // grow further; it reuses that module's renderTextBlocks for player text and
  // ProjectMapObjectPlaySimulator for the (browser-safe) dry-run model.

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

  function ensureArray(value) {
    if (domTextUtils && typeof domTextUtils.ensureArray === 'function') {
      return domTextUtils.ensureArray(value);
    }
    if (Array.isArray(value)) {
      return value;
    }
    return value == null ? [] : [value];
  }

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

  function sim() {
    if (global && global.ProjectMapObjectPlaySimulator) {
      return global.ProjectMapObjectPlaySimulator;
    }
    if (typeof require === 'function') {
      try {
        return require('./object_play_simulator_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function renderTextBlocks(value, options) {
    const editor = global && global.ProjectMapPreviewObjectEditor;
    if (editor && typeof editor.renderTextBlocks === 'function') {
      return editor.renderTextBlocks(value, options || {});
    }
    return '<p>' + escapeHtml(String(value == null ? '' : value)) + '</p>';
  }

  const api = {
    isSupported,
    renderPaneWithPlay,
    renderPane,
    renderNode
  };

  if (global) {
    global.ProjectMapObjectPlaySimulatorUi = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  function isSupported(body) {
    const model = sim();
    return Boolean(model && typeof model.isSupported === 'function' && model.isSupported(body));
  }

  function normalizePlayState(playState) {
    const ps = playState && typeof playState === 'object' ? playState : {};
    return {
      q: ps.q && typeof ps.q === 'object' ? ps.q : {},
      chosen: ps.chosen || null
    };
  }

  // Wrap the modal preview with a Preview/Play-test toggle. The play panel is
  // left empty and pending so it only renders the first time the author opens
  // it (the canvas UI fills it via renderPane), keeping every modal open cheap
  // even though most are never play-tested.
  function renderPaneWithPlay(previewHtml, body) {
    if (!isSupported(body)) {
      return previewHtml;
    }
    return [
      renderToggle(),
      '<div class="object-editing-preview-panel" data-preview-mode-panel="preview">',
      previewHtml,
      '</div>',
      '<div class="object-editing-play-panel" data-preview-mode-panel="play" hidden>',
      '<div class="object-editing-play-sim" data-play-sim-pane="true" data-play-sim-pending="true"></div>',
      '</div>'
    ].join('');
  }

  function renderToggle() {
    return [
      '<div class="object-editing-preview-modes-toolbar" role="tablist" data-preview-modes-toolbar="true">',
      '<button type="button" class="is-active" role="tab" aria-selected="true" data-play-action="show-preview">' + escapeHtml(t('playSim.tabPreview', 'Preview')) + '</button>',
      '<button type="button" role="tab" aria-selected="false" data-play-action="show-play">' + escapeHtml(t('playSim.tabPlay', 'Play test')) + '</button>',
      '</div>'
    ].join('');
  }

  function renderPane(body, model, playState) {
    const model0 = sim();
    if (!model0 || !model0.isSupported(body)) {
      return '<div class="object-editing-play-empty">' + escapeHtml(t('playSim.unsupported', 'This object cannot be play-simulated yet.')) + '</div>';
    }
    const ps = normalizePlayState(playState);
    const variables = model0.collectVariables(body, {});
    return [
      '<div class="object-editing-play" data-object-editing-play="true">',
      '<p class="object-editing-play-note">' + escapeHtml(t('playSim.approxNote', 'Approximate dry-run of this object only: conditions, simple effects, and text are simulated in the browser. Cards, randomness, qdisplays, and cross-scene jumps are not — use the full runtime preview for an exact playthrough.')) + '</p>',
      renderStatePanel(variables, ps),
      '<div class="object-editing-play-node" data-play-node="true">' + renderNode(body, model, ps) + '</div>',
      '</div>'
    ].join('');
  }

  function renderStatePanel(variables, ps) {
    if (!variables.length) {
      return '';
    }
    return [
      '<details class="object-editing-play-state" open data-play-state="true">',
      '<summary>' + escapeHtml(t('playSim.startState', 'Starting state')) + '</summary>',
      '<div class="object-editing-play-state-vars">',
      variables.map((name) => {
        const has = ps.q && Object.prototype.hasOwnProperty.call(ps.q, name);
        const val = has ? ps.q[name] : 0;
        return [
          '<label class="object-editing-play-var">',
          '<span>Q.' + escapeHtml(name) + '</span>',
          '<input type="number" step="1" value="' + escapeAttr(String(val)) + '" data-play-var="' + escapeAttr(name) + '" aria-label="' + escapeAttr('Q.' + name) + '">',
          '</label>'
        ].join('');
      }).join(''),
      '</div>',
      '<button type="button" class="object-editing-play-reset" data-play-action="reset">' + escapeHtml(t('playSim.reset', 'Reset to start')) + '</button>',
      '</details>'
    ].join('');
  }

  function renderNode(body, model, playState) {
    const model0 = sim();
    if (!model0 || !model0.isSupported(body)) {
      return '';
    }
    const ps = normalizePlayState(playState);
    const state = model0.initialState(body, ps.q, {});
    const entry = model0.buildEntryView(body, state, {});
    if (!ps.chosen) {
      return renderEntry(body, entry);
    }
    const result = model0.chooseOption(body, entry.onArrival.state, ps.chosen, {});
    return renderResult(body, entry, result);
  }

  function renderDelta(applied, emptyLabel) {
    const rows = ensureArray(applied);
    if (!rows.length) {
      return emptyLabel ? '<p class="object-editing-play-delta-empty">' + escapeHtml(emptyLabel) + '</p>' : '';
    }
    return '<ul class="object-editing-play-delta">' + rows.map((entry) =>
      '<li><code>Q.' + escapeHtml(String(entry.variable)) + '</code> <span class="object-editing-play-delta-from">' + escapeHtml(String(entry.from)) + '</span> &rarr; <span class="object-editing-play-delta-to">' + escapeHtml(String(entry.to)) + '</span></li>'
    ).join('') + '</ul>';
  }

  function skippedReasonLabel(reason) {
    if (reason === 'unsupported_effect') {
      return t('playSim.skipUnsupportedEffect', 'not simulated (complex effect)');
    }
    if (reason === 'unsupported_value') {
      return t('playSim.skipUnsupportedValue', 'not simulated (complex value)');
    }
    if (reason === 'condition_not_met') {
      return t('playSim.skipCondition', 'skipped (its condition was false)');
    }
    return t('playSim.skipGeneric', 'not simulated');
  }

  function renderSkipped(skipped) {
    const rows = ensureArray(skipped);
    if (!rows.length) {
      return '';
    }
    return '<ul class="object-editing-play-skipped">' + rows.map((entry) =>
      '<li><code>' + escapeHtml(String(entry.expression)) + '</code> &mdash; ' + escapeHtml(skippedReasonLabel(entry.reason)) + '</li>'
    ).join('') + '</ul>';
  }

  function renderOption(option) {
    const available = option.available;
    const label = escapeHtml(option.label || t('playSim.untitledOption', 'Untitled choice'));
    const subtitle = option.subtitle ? '<span class="object-editing-play-option-subtitle">' + escapeHtml(option.subtitle) + '</span>' : '';
    if (available === false) {
      return [
        '<li class="object-editing-play-option is-unavailable">',
        '<button type="button" disabled>' + label + subtitle + '</button>',
        option.condition ? '<span class="object-editing-play-option-condition"><code>' + escapeHtml(option.condition) + '</code></span>' : '',
        option.unavailableText ? '<span class="object-editing-play-option-unavailable">' + escapeHtml(option.unavailableText) + '</span>' : '',
        '</li>'
      ].join('');
    }
    const unknown = available === null
      ? '<span class="object-editing-play-option-unknown">' + escapeHtml(t('playSim.conditionUnknown', 'condition not evaluated')) + '</span>'
      : '';
    return [
      '<li class="object-editing-play-option' + (available === null ? ' is-unknown' : '') + '">',
      '<button type="button" data-play-option="' + escapeAttr(option.id) + '">' + label + subtitle + '</button>',
      unknown,
      '</li>'
    ].join('');
  }

  function renderEntry(body, entry) {
    const options = ensureArray(entry.options);
    return [
      '<article class="object-editing-play-card" data-play-card="entry">',
      entry.heading ? '<h4 class="object-editing-play-heading">' + escapeHtml(entry.heading) + '</h4>' : '',
      ensureArray(entry.onArrival && entry.onArrival.applied).length
        ? '<div class="object-editing-play-onarrival"><span class="object-editing-play-onarrival-label">' + escapeHtml(t('playSim.onArrival', 'On arrival')) + '</span>' + renderDelta(entry.onArrival.applied) + '</div>'
        : '',
      '<div class="object-editing-play-text">' + renderTextBlocks(entry.text, {empty: false, assetBaseUrl: body.assetBaseUrl || ''}) + '</div>',
      options.length
        ? '<ul class="object-editing-play-options">' + options.map((option) => renderOption(option)).join('') + '</ul>'
        : '<p class="object-editing-play-no-options">' + escapeHtml(t('playSim.noOptions', 'No choices to simulate.')) + '</p>',
      '</article>'
    ].join('');
  }

  function renderContinuation(continuation) {
    if (!continuation || !continuation.nextTarget) {
      return '';
    }
    return '<p class="object-editing-play-continuation">' + escapeHtml(t('playSim.continuesTo', 'Continues to') + ': ') + '<code>' + escapeHtml(continuation.nextTarget) + '</code> <span class="object-editing-play-continuation-note">' + escapeHtml(t('playSim.boundary', '(dry-run stops here)')) + '</span></p>';
  }

  function renderResult(body, entry, result) {
    const chosen = ensureArray(entry.options).filter((option) => option.id === (result && result.optionId))[0]
      || {label: '', id: result && result.optionId};
    const back = '<button type="button" class="object-editing-play-back" data-play-action="back">' + escapeHtml(t('playSim.back', 'Back to choices')) + '</button>';
    if (!result || !result.ok) {
      const message = result && result.unavailableText
        ? result.unavailableText
        : t('playSim.blocked', 'That choice is not available in this state.');
      return [
        '<article class="object-editing-play-card is-blocked" data-play-card="blocked">',
        '<p class="object-editing-play-blocked">' + escapeHtml(message) + '</p>',
        back,
        '</article>'
      ].join('');
    }
    const proseTitle = result.result && result.result.title;
    const proseSubtitle = result.result && result.result.subtitle;
    const proseText = result.result && result.result.text;
    return [
      '<article class="object-editing-play-card is-result" data-play-card="result">',
      '<p class="object-editing-play-chose">' + escapeHtml(t('playSim.youChose', 'You chose:')) + ' <strong>' + escapeHtml(chosen.label || '') + '</strong></p>',
      '<div class="object-editing-play-effects"><span class="object-editing-play-effects-label">' + escapeHtml(t('playSim.effects', 'Effects applied')) + '</span>' + renderDelta(result.delta, t('playSim.noEffects', 'No state changes.')) + '</div>',
      renderSkipped(result.skipped),
      proseTitle ? '<h4 class="object-editing-play-heading">' + escapeHtml(proseTitle) + '</h4>' : '',
      proseSubtitle ? '<p class="object-editing-play-subtitle">' + escapeHtml(proseSubtitle) + '</p>' : '',
      proseText ? '<div class="object-editing-play-text">' + renderTextBlocks(proseText, {empty: false, assetBaseUrl: body.assetBaseUrl || ''}) + '</div>' : '',
      renderContinuation(result.continuation),
      back,
      '</article>'
    ].join('');
  }
})(typeof window !== 'undefined' ? window : globalThis);
