(function initProjectMapEventWorkbenchUi(global) {
  'use strict';

  const domTextUtils = (function () {
    if (global && global.ProjectMapDomText) {
      return global.ProjectMapDomText;
    }
    return require('./dom_text_utils.js');
  })();
  const escapeHtml = domTextUtils.escapeHtml;
  const escapeAttr = domTextUtils.escapeAttr;

  const api = {
    renderEventWorkbench
  };

  const FALLBACK = {
    eyebrow: 'Event Workbench',
    playerText: 'Player-facing content',
    options: 'Player choices',
    conditions: 'Appearance conditions',
    effects: 'Effects and variable changes',
    variables: 'State touched by this event',
    links: 'Follow-up and related flow',
    routeState: 'Route state',
    noRouteState: 'No structured route state was found.',
    routeDependencies: 'State dependencies',
    routeFallback: 'fallback',
    routeRuntime: 'Runtime selection',
    routeRandom: 'possible random split',
    routeExclusive: 'mutually exclusive',
    routeSampledMulti: 'sampled multi-valid',
    routeSampledZero: 'sampled no-valid',
    routePreRouteWrite: 'on-arrival writes route state',
    routePreRouteOpaque: 'script before route',
    actions: 'What you can do here',
    advanced: 'Advanced details',
    noText: 'No body text was extracted into this index.',
    noOptions: 'This event has no parser-backed choices.',
    noConditions: 'No explicit conditions were found.',
    noEffects: 'No statically recognizable variable changes were found.',
    noVariables: 'No variable reads/writes were found for this event.',
    noLinks: 'No graph links were found.',
    conditionYear: 'Year',
    conditionMonth: 'Month',
    conditionSeen: 'Not seen yet',
    conditionAdvanced: 'Advanced condition',
    source: 'Source',
    rawViewIf: 'Raw view-if',
    notCaptured: 'Not fully captured yet',
    diagnostics: 'Diagnostics',
    edit: 'Edit',
    effect: 'Effect',
    writesHere: 'writes here',
    variableCondition: 'Variable condition',
    'action.edit_text': 'Rewrite player text',
    'action.copy_alt_timeline': 'Copy as alternate timeline event',
    'action.follow_up': 'Create follow-up event',
    'action.edit_text.desc': 'Create a text replacement proposal from player-facing prose.',
    'action.copy_alt_timeline.desc': 'Seed a new event draft from this event. Review body text and effects before export.',
    'action.follow_up.desc': 'Create a new event that continues this beat.',
    'role.title': 'Title',
    'role.heading': 'Heading',
    'role.subtitle': 'Subtitle',
    'role.body': 'Body',
    'role.conditional_body': 'Conditional text',
    'role.option_label': 'Player option',
    'role.option_subtitle': 'Option subtitle',
    'role.unavailable_text': 'Unavailable text',
    'role.news_headline': 'News headline',
    'role.news_description': 'News description',
    'role.monthly_popup_excerpt': 'Monthly popup excerpt'
  };

  if (global) {
    global.ProjectMapEventWorkbenchUi = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  function renderEventWorkbench(workbench, options) {
    const wb = workbench || {};
    const opts = options || {};
    const locale = opts.locale === 'zh-Hant' ? 'zh-Hant' : 'en';
    const title = wb.title || wb.sceneId || 'Event';
    return [
      '<section class="event-workbench">',
      '<div class="event-workbench-header">',
      '<div>',
      '<div class="event-workbench-eyebrow">' + escapeHtml(opts.eyebrow || label(locale, 'eyebrow')) + '</div>',
      '<h2>' + escapeHtml(title) + '</h2>',
      wb.summary && wb.summary.timing ? '<p>' + escapeHtml(wb.summary.timing) + '</p>' : '',
      '</div>',
      '<div class="event-workbench-badges">',
      badge(wb.sceneType || 'event'),
      badge(wb.confidence || 'approximate'),
      '</div>',
      '</div>',
      renderPlayerText(wb.playerText || [], locale),
      renderOptions(wb.options || [], locale),
      renderRouteState(wb.routeState || {}, locale),
      renderConditions(wb.conditions || [], locale),
      renderEffects(wb.effects || [], locale),
      renderVariables(wb.variables || [], locale),
      renderLinks(wb.links || {}, locale),
      renderActions(wb.actions || [], locale),
      renderAdvanced(wb.advanced || {}, wb.diagnostics || [], locale),
      '</section>'
    ].join('');
  }

  function renderPlayerText(rows, locale) {
    const content = rows.slice(0, 12).map((row) => {
      return '<article class="event-workbench-text-row">' +
        '<span>' + escapeHtml(roleLabel(row.role, locale) || row.label || row.role || 'Text') + renderEditAction(row, locale) + '</span>' +
        '<p>' + escapeHtml(row.text || '') + '</p>' +
      '</article>';
    }).join('');
    return section('playerText', label(locale, 'playerText'), content || empty(label(locale, 'noText')), sectionCount(rows), {open: true});
  }

  function renderOptions(rows, locale) {
    const content = rows.slice(0, 6).map((row) => {
      const effects = (row.effects || []).slice(0, 4).map(effectLabel).join(' · ');
      return '<article class="event-workbench-option-row">' +
        '<strong>' + escapeHtml(row.label || row.id || 'Option') + renderEditAction(row, locale) + '</strong>' +
        (row.subtitle ? '<p>' + escapeHtml(row.subtitle) + '</p>' : '') +
        (row.chooseIf ? '<small>' + escapeHtml(label(locale, 'conditions')) + ': ' + escapeHtml(row.chooseIf) + '</small>' : '') +
        (effects ? '<small>' + escapeHtml(label(locale, 'effect')) + ': ' + escapeHtml(effects) + '</small>' : '') +
      '</article>';
    }).join('');
    return section('options', label(locale, 'options'), content || empty(label(locale, 'noOptions')), sectionCount(rows), {open: true});
  }

  function renderConditions(rows, locale) {
    const content = rows.slice(0, 12).map((row) => {
      return '<div class="event-workbench-chip event-workbench-condition">' +
        '<strong>' + escapeHtml(conditionLabel(row, locale)) + '</strong>' +
        '<span>' + escapeHtml(conditionValue(row)) + '</span>' +
      '</div>';
    }).join('');
    return section('conditions', label(locale, 'conditions'), '<div class="event-workbench-chip-grid">' + (content || empty(label(locale, 'noConditions'))) + '</div>', sectionCount(rows));
  }

  function renderRouteState(routeState, locale) {
    const rows = (routeState && routeState.states || []).slice(0, 8);
    const content = rows.map((row) => {
      const candidates = (row.candidates || []).slice(0, 4).map((candidate) => {
        const predicate = candidate.predicate ? ' if ' + candidate.predicate : '';
        const fallback = candidate.isFallback ? ' [' + label(locale, 'routeFallback') + ']' : '';
        const dynamic = candidate.dynamicTarget ? ' · ' + (candidate.targetSource || 'dynamic') : '';
        return '<li>' + escapeHtml((candidate.resolvedTarget || candidate.rawTarget || '') + predicate + fallback + dynamic) + '</li>';
      }).join('');
      const dependencies = (row.dependencies || []).length
        ? '<small>' + escapeHtml(label(locale, 'routeDependencies') + ': ' + row.dependencies.join(', ')) + '</small>'
        : '';
      const semantics = row.runtimeSemantics || {};
      const semanticsText = routeRuntimeLabel(semantics, locale);
      return '<article class="event-workbench-route-state-row" data-event-workbench-route-state="' + escapeAttr(row.id || '') + '">' +
        '<strong>' + escapeHtml([row.routeField || row.routeKind || 'route', row.chainContext || row.status || ''].filter(Boolean).join(' · ')) + '</strong>' +
        '<span>' + escapeHtml(row.summaryLabel || row.routePurpose || '') + '</span>' +
        (semanticsText ? '<small>' + escapeHtml(semanticsText) + '</small>' : '') +
        (candidates ? '<ul>' + candidates + '</ul>' : '') +
        dependencies +
      '</article>';
    }).join('');
    const count = routeState && routeState.summary && routeState.summary.routeStateCount || rows.length;
    return section('routeState', label(locale, 'routeState'), content || empty(label(locale, 'noRouteState')), sectionCount(count));
  }

  function routeRuntimeLabel(semantics, locale) {
    const selectionMode = String(semantics && semantics.selectionMode || '');
    if (!selectionMode) {
      return '';
    }
    const prefix = label(locale, 'routeRuntime') + ': ';
    const suffixes = routeRuntimeEvidenceLabels(semantics, locale);
    const suffix = suffixes.length ? ' · ' + suffixes.join(' · ') : '';
    if (semantics && semantics.possibleRandomization) {
      return prefix + label(locale, 'routeRandom') + (semantics.exclusivity ? ' · ' + semantics.exclusivity : '') + suffix;
    }
    if (['explicit_complement', 'simple_equality_partition'].includes(String(semantics && semantics.exclusivity || ''))) {
      return prefix + label(locale, 'routeExclusive') + ' · ' + semantics.exclusivity + suffix;
    }
    return prefix + selectionMode + suffix;
  }

  function routeRuntimeEvidenceLabels(semantics, locale) {
    const rows = [];
    const collision = semantics && semantics.collisionSummary || {};
    const after = collision && collision.after || {};
    const preRoute = semantics && semantics.preRouteScript || {};
    if (collision && collision.tested && Number(after.multiValidCount || 0) > 0) {
      rows.push(label(locale, 'routeSampledMulti'));
    }
    if (collision && collision.tested && Number(after.zeroValidCount || 0) > 0) {
      rows.push(label(locale, 'routeSampledZero'));
    }
    if (preRoute && Number(preRoute.routeDependencyWriteCount || 0) > 0) {
      rows.push(label(locale, 'routePreRouteWrite'));
    } else if (preRoute && preRoute.opaque) {
      rows.push(label(locale, 'routePreRouteOpaque'));
    }
    return rows;
  }

  function renderEffects(rows, locale) {
    const content = rows.slice(0, 16).map((row) => {
      return '<div class="event-workbench-effect-row">' +
        '<strong>' + escapeHtml(row.variable || '') + '</strong>' +
        '<span>' + escapeHtml(effectLabel(row, locale)) + renderEditAction(row, locale) + '</span>' +
        (row.source ? '<small>' + escapeHtml(sourceLabel(row.source)) + '</small>' : '') +
      '</div>';
    }).join('');
    return section('effects', label(locale, 'effects'), content || empty(label(locale, 'noEffects')), sectionCount(rows));
  }

  function renderVariables(rows, locale) {
    const content = rows.slice(0, 18).map((row) => {
      return '<div class="event-workbench-variable-row">' +
        '<strong>' + escapeHtml(row.name || '') + '</strong>' +
        '<span>' + escapeHtml((row.accesses || []).join(' / ')) + '</span>' +
        '<small>R ' + escapeHtml(row.readCount || 0) + ' · W ' + escapeHtml(row.writeCount || 0) + '</small>' +
      '</div>';
    }).join('');
    return section('variables', label(locale, 'variables'), content || empty(label(locale, 'noVariables')), sectionCount(rows));
  }

  function renderLinks(links, locale) {
    const rows = []
      .concat((links.outgoing || []).slice(0, 8))
      .concat((links.incoming || []).slice(0, 4));
    const content = rows.map((row) => {
      return '<div class="event-workbench-link-row">' +
        '<strong>' + escapeHtml(row.direction || '') + '</strong>' +
        '<span>' + escapeHtml((row.from || '') + ' → ' + (row.to || '')) + '</span>' +
        (row.label ? '<small>' + escapeHtml(row.label) + '</small>' : '') +
      '</div>';
    }).join('');
    return section('links', label(locale, 'links'), content || empty(label(locale, 'noLinks')), sectionCount(rows));
  }

  function renderActions(rows, locale) {
    const content = rows.map((row) => {
      const disabled = row.disabled ? ' disabled' : '';
      return '<article class="event-workbench-action-row">' +
        '<button type="button" data-event-workbench-action="' + escapeAttr(row.id || '') + '"' + disabled + '>' +
        '<strong>' + escapeHtml(actionLabel(row, locale)) + '</strong>' +
        '<span>' + escapeHtml(actionDescription(row, locale)) + '</span>' +
        '</button>' +
      '</article>';
    }).join('');
    return section('actions', label(locale, 'actions'), content, sectionCount(rows), {open: true});
  }

  function renderEditAction(row, locale) {
    if (!row || !row.editAction) {
      return '';
    }
    const ui = visibleEditActionApi();
    return ui && typeof ui.renderButton === 'function'
      ? ui.renderButton(row.editAction, {compact: true, label: label(locale, 'edit'), translate: (key, fallback) => translate(locale, key, fallback), escapeHtml, escapeAttr})
      : '<button type="button" class="visible-edit-action-button is-compact" data-visible-edit-action="' + escapeAttr(JSON.stringify(row.editAction)) + '">' + escapeHtml(label(locale, 'edit')) + '</button>';
  }

  function renderAdvanced(advanced, diagnostics, locale) {
    const source = advanced.source || {};
    const diag = (diagnostics || []).slice(0, 8).map((item) => {
      return '<li>' + escapeHtml((item.severity || 'info') + ' · ' + (item.code || '') + ': ' + (item.message || '')) + '</li>';
    }).join('');
    const warnings = (advanced.notCaptured || []).map((item) => '<li>' + escapeHtml(item) + '</li>').join('');
    const count = sectionCount((advanced.notCaptured || []).length + (diagnostics || []).length + (advanced.rawViewIf ? 1 : 0) + (source && source.path ? 1 : 0));
    return '<details class="event-workbench-section event-workbench-collapsible event-workbench-advanced" data-event-workbench-section="advanced">' +
      '<summary><span class="event-workbench-section-title">' + escapeHtml(label(locale, 'advanced')) + '</span><span class="event-workbench-section-count section-count">' + escapeHtml(count) + '</span></summary>' +
      '<div class="event-workbench-section-body">' +
      '<dl class="kv">' +
      '<dt>' + escapeHtml(label(locale, 'source')) + '</dt><dd>' + escapeHtml(sourceLabel(source) || advanced.path || '') + '</dd>' +
      '<dt>' + escapeHtml(label(locale, 'rawViewIf')) + '</dt><dd>' + escapeHtml(advanced.rawViewIf || '') + '</dd>' +
      '</dl>' +
      (warnings ? '<h4>' + escapeHtml(label(locale, 'notCaptured')) + '</h4><ul>' + warnings + '</ul>' : '') +
      (diag ? '<h4>' + escapeHtml(label(locale, 'diagnostics')) + '</h4><ul>' + diag + '</ul>' : '') +
      '</div>' +
      '</details>';
  }

  function section(id, title, body, count, options) {
    const open = options && options.open ? ' open' : '';
    return '<details class="event-workbench-section event-workbench-collapsible"' + open + ' data-event-workbench-section="' + escapeAttr(id || '') + '">' +
      '<summary><span class="event-workbench-section-title">' + escapeHtml(title) + '</span><span class="event-workbench-section-count section-count">' + escapeHtml(sectionCount(count)) + '</span></summary>' +
      '<div class="event-workbench-section-body">' + body + '</div>' +
      '</details>';
  }

  function sectionCount(value) {
    if (Array.isArray(value)) return String(value.length);
    const count = Number(value);
    return Number.isFinite(count) && count > 0 ? String(count) : '0';
  }

  function empty(text) {
    return '<div class="event-workbench-empty">' + escapeHtml(text) + '</div>';
  }

  function badge(text) {
    return '<span class="event-workbench-badge">' + escapeHtml(text || '') + '</span>';
  }

  function conditionLabel(row, locale) {
    if (row.kind === 'year') return label(locale, 'conditionYear');
    if (row.kind === 'month') return label(locale, 'conditionMonth');
    if (row.kind === 'seen_flag') return label(locale, 'conditionSeen');
    if (row.kind === 'variable') return row.label || row.variable || label(locale, 'variableCondition');
    return row.label || label(locale, 'conditionAdvanced');
  }

  function conditionValue(row) {
    if (row.kind === 'year') return String(row.value);
    if (row.kind === 'month') return String(row.op || '') + ' ' + String(row.value || '');
    if (row.kind === 'seen_flag') return row.variable || row.raw || '';
    if (row.kind === 'variable') return [row.variable, row.op, row.value].filter(Boolean).join(' ');
    return row.raw || '';
  }

  function effectLabel(row, locale) {
    if (!row) return '';
    if (row.op === 'writes') return label(locale, 'writesHere');
    return [row.op || '', row.value || ''].filter(Boolean).join(' ');
  }

  function label(locale, key) {
    return translate(locale, 'eventWorkbench.' + key, FALLBACK[key] || key);
  }

  function roleLabel(role, locale) {
    const key = String(role || '');
    return key ? optionalLabel(locale, 'role.' + key) : '';
  }

  function actionLabel(row, locale) {
    return optionalLabel(locale, 'action.' + (row.id || '')) || row.label || row.id || '';
  }

  function actionDescription(row, locale) {
    return optionalLabel(locale, 'action.' + (row.id || '') + '.desc') || row.description || '';
  }

  function optionalLabel(locale, key) {
    const fullKey = 'eventWorkbench.' + key;
    const translated = translate(locale, fullKey, FALLBACK[key] || '');
    return translated === fullKey || translated === key ? '' : translated;
  }

  function translate(locale, key, fallback) {
    const i18n = global && global.ProjectMapI18n;
    if (
      i18n &&
      typeof i18n.t === 'function' &&
      (!locale || typeof i18n.getLocale !== 'function' || i18n.getLocale() === locale)
    ) {
      return i18n.t(key, fallback);
    }
    const dictionaries = global && global.ProjectMapI18nDictionaries || {};
    const dictionary = dictionaries[locale] || dictionaries.en || {};
    return dictionary[key] || fallback || key;
  }

  function sourceLabel(source) {
    if (!source || !source.path) return '';
    return source.path + (source.line || source.startLine ? ':' + (source.line || source.startLine) : '');
  }

  function visibleEditActionApi() {
    if (global && global.ProjectMapVisibleEditActionUi) {
      return global.ProjectMapVisibleEditActionUi;
    }
    if (typeof require === 'function') {
      try {
        return require('./visible_edit_action_ui.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

})(typeof window !== 'undefined' ? window : globalThis);
