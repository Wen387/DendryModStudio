(function initProjectMapEventWorkbenchUi(global) {
  'use strict';

  const api = {
    renderEventWorkbench
  };

  const TEXT = {
    en: {
      eyebrow: 'Event Workbench',
      playerText: 'Player-facing content',
      options: 'Player choices',
      conditions: 'Appearance conditions',
      effects: 'Effects and variable changes',
      variables: 'State touched by this event',
      links: 'Follow-up and related flow',
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
      effect: 'Effect',
      writesHere: 'writes here',
      variableCondition: 'Variable condition',
      action_edit_text: 'Rewrite player text',
      action_copy_alt_timeline: 'Copy as alternate timeline event',
      action_follow_up: 'Create follow-up event',
      action_edit_text_desc: 'Create a text replacement proposal from player-facing prose.',
      action_copy_alt_timeline_desc: 'Seed a new event draft from this event. Review body text and effects before export.',
      action_follow_up_desc: 'Create a new event that continues this beat.'
    },
    'zh-Hant': {
      eyebrow: '事件工作台',
      playerText: '玩家會看到的內容',
      options: '玩家選項',
      conditions: '出現條件',
      effects: '效果與變數改動',
      variables: '此事件碰到的狀態',
      links: '後續與關聯',
      actions: '可以從這裡做什麼',
      advanced: '進階資訊',
      noText: '尚未在 index 中抽取到正文。',
      noOptions: '此事件沒有 parser-backed 選項。',
      noConditions: '未找到明確條件。',
      noEffects: '沒有找到可靜態辨識的變數改動。',
      noVariables: '沒有找到本事件的變數讀寫。',
      noLinks: '沒有找到 graph 關聯。',
      conditionYear: '年份',
      conditionMonth: '月份',
      conditionSeen: '尚未看過',
      conditionAdvanced: '進階條件',
      source: '來源',
      rawViewIf: '原始 view-if',
      notCaptured: '目前未完整捕獲',
      diagnostics: '診斷',
      effect: '效果',
      writesHere: '在這裡寫入',
      variableCondition: '變數條件',
      action_edit_text: '改寫玩家文字',
      action_copy_alt_timeline: '複製成另類世界線事件',
      action_follow_up: '建立後續事件',
      action_edit_text_desc: '從玩家可見文字建立修改提案。',
      action_copy_alt_timeline_desc: '從這個事件建立一份新事件草稿；匯出前請審查正文與效果。',
      action_follow_up_desc: '建立一個接續此事件的新事件。'
    }
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
        '<span>' + escapeHtml(roleLabel(row.role, locale) || row.label || row.role || 'Text') + '</span>' +
        '<p>' + escapeHtml(row.text || '') + '</p>' +
      '</article>';
    }).join('');
    return section('playerText', label(locale, 'playerText'), content || empty(label(locale, 'noText')), sectionCount(rows), {open: true});
  }

  function renderOptions(rows, locale) {
    const content = rows.slice(0, 6).map((row) => {
      const effects = (row.effects || []).slice(0, 4).map(effectLabel).join(' · ');
      return '<article class="event-workbench-option-row">' +
        '<strong>' + escapeHtml(row.label || row.id || 'Option') + '</strong>' +
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

  function renderEffects(rows, locale) {
    const content = rows.slice(0, 16).map((row) => {
      return '<div class="event-workbench-effect-row">' +
        '<strong>' + escapeHtml(row.variable || '') + '</strong>' +
        '<span>' + escapeHtml(effectLabel(row, locale)) + '</span>' +
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
    const table = TEXT[locale] || TEXT.en;
    return table[key] || TEXT.en[key] || key;
  }

  function roleLabel(role, locale) {
    const zh = {
      title: '標題',
      heading: '小標題',
      subtitle: '副標題',
      body: '正文',
      conditional_body: '條件正文',
      option_label: '玩家選項',
      option_subtitle: '選項副標題',
      unavailable_text: '不可用時文字',
      news_headline: '新聞標題',
      news_description: '新聞描述',
      monthly_popup_excerpt: '月度彈窗摘錄'
    };
    const en = {
      title: 'Title',
      heading: 'Heading',
      subtitle: 'Subtitle',
      body: 'Body',
      conditional_body: 'Conditional text',
      option_label: 'Player option',
      option_subtitle: 'Option subtitle',
      unavailable_text: 'Unavailable text',
      news_headline: 'News headline',
      news_description: 'News description',
      monthly_popup_excerpt: 'Monthly popup excerpt'
    };
    const table = locale === 'zh-Hant' ? zh : en;
    return table[String(role || '')] || '';
  }

  function actionLabel(row, locale) {
    return label(locale, 'action_' + (row.id || '')) || row.label || row.id || '';
  }

  function actionDescription(row, locale) {
    return label(locale, 'action_' + (row.id || '') + '_desc') || row.description || '';
  }

  function sourceLabel(source) {
    if (!source || !source.path) return '';
    return source.path + (source.line || source.startLine ? ':' + (source.line || source.startLine) : '');
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }
})(typeof window !== 'undefined' ? window : globalThis);
