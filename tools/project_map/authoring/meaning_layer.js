(function initMeaningLayer(global) {
  'use strict';

  const MEANING_LAYER_VERSION = '0.1';
  const SUPPORTED_LOCALES = new Set(['en', 'zh-Hant']);

  const TEXT = {
    en: {
      status: {
        exact: 'Ready to review',
        approximate: 'Approximate preview',
        manual_review: 'Manual review needed'
      },
      statusHelp: {
        exact: 'Studio can preview this authoring draft directly.',
        approximate: 'Studio can show the likely player-facing text, but it is not a full runtime simulation.',
        manual_review: 'Studio found the text, but cannot safely apply or own this source yet.'
      },
      section: {
        playerText: 'Player-facing text',
        choices: 'Player choices',
        mechanics: 'Game rules',
        notes: 'Review notes',
        advanced: 'Advanced details'
      },
      labels: {
        sourceKind: 'Content type',
        Type: 'Content type',
        When: 'When it appears',
        Requires: 'Condition',
        Priority: 'Priority',
        'Seen flag': 'Seen flag',
        'Card kind': 'Card type',
        Frequency: 'Frequency',
        'Max visits': 'Max visits',
        'View-if': 'Visible when',
        Tags: 'Tags',
        Delivery: 'Delivery',
        Slot: 'News slot',
        Pool: 'News pool',
        'Requires JS': 'Advanced condition',
        Area: 'Text area',
        Editability: 'Editing route',
        Source: 'Source',
        Router: 'Monthly router',
        'Linked scene': 'Linked scene',
        Confidence: 'Confidence',
        Install: 'Install status'
      },
      values: {
        event: 'Event',
        card: 'Card',
        news: 'News',
        surface_text: 'Text replacement',
        world_event: 'World event',
        action_card: 'Action card',
        dated: 'Dated news',
        background_pool: 'Background news pool',
        legacy_event_popup: 'Monthly event popup',
        card_title: 'Card title',
        scene_title: 'Scene title',
        option_label: 'Player option',
        option_subtitle: 'Option subtitle',
        body_text: 'Story text',
        qdisplay: 'Status text',
        sidebar_label: 'Sidebar label',
        html_sidebar: 'HTML sidebar',
        draft_exportable: 'Editable proposal',
        ide_escape_hatch: 'Manual review needed',
        manual_only: 'Manual review only',
        'manual-only': 'Manual review only',
        proposal_only: 'Proposal only',
        'proposal-only': 'Proposal only',
        safe_apply: 'Safe apply',
        guarded_apply: 'Guarded install',
        advanced_apply: 'Advanced install'
      },
      readiness: {
        ready_to_review: 'Ready to review',
        needs_review: 'Review recommended',
        manual_review: 'Manual review needed'
      },
      readinessSummary: {
        ready_to_review: 'Authoring preview is ready for review. It is not a live runtime simulation.',
        needs_review: 'Review the notes before applying. This preview is not a live runtime simulation.',
        manual_review: 'Manual review is required before this can become an installable change.'
      },
      body: {
        heading: 'Heading',
        subtitle: 'Subtitle',
        paragraph: 'Text',
        news: 'Headline',
        replacementBefore: 'Before',
        replacementAfter: 'After'
      },
      notes: {
        ide: 'This source needs manual confirmation. Studio will provide guidance instead of editing it automatically.',
        partial: 'This preview comes from partial source extraction.',
        unknown: 'Studio cannot fully classify this preview yet.'
      },
      empty: '(empty)'
    },
    'zh-Hant': {
      status: {
        exact: '可直接審查',
        approximate: '近似預覽',
        manual_review: '需要手動確認'
      },
      statusHelp: {
        exact: 'Studio 可以直接預覽這份作者草稿。',
        approximate: 'Studio 可以顯示玩家大致會看到的內容，但這不是完整遊戲 runtime 模擬。',
        manual_review: 'Studio 找到了這段內容，但目前不能保證安全自動修改。'
      },
      section: {
        playerText: '玩家會看到的文字',
        choices: '玩家選項',
        mechanics: '遊戲規則',
        notes: '審查提示',
        advanced: '進階資訊'
      },
      labels: {
        sourceKind: '內容類型',
        Type: '內容類型',
        When: '出現時間',
        Requires: '觸發條件',
        Priority: '優先級',
        'Seen flag': '已看過旗標',
        'Card kind': '卡牌類型',
        Frequency: '出現頻率',
        'Max visits': '最多出現次數',
        'View-if': '顯示條件',
        Tags: '標籤',
        Delivery: '發送方式',
        Slot: '新聞欄位',
        Pool: '背景新聞池',
        'Requires JS': '進階條件',
        Area: '文字位置',
        Editability: '編輯方式',
        Source: '來源',
        Router: '月度路由',
        'Linked scene': '連結場景',
        Confidence: '信心',
        Install: '安裝狀態'
      },
      values: {
        event: '事件',
        card: '卡牌',
        news: '新聞',
        surface_text: '文字修改',
        world_event: '世界事件',
        action_card: '行動卡牌',
        dated: '指定日期新聞',
        background_pool: '背景新聞池',
        legacy_event_popup: '月度事件彈窗',
        card_title: '卡牌標題',
        scene_title: '場景標題',
        option_label: '玩家選項',
        option_subtitle: '選項副標題',
        body_text: '故事正文',
        qdisplay: '狀態文字',
        sidebar_label: '側邊欄標籤',
        html_sidebar: 'HTML 側邊欄',
        draft_exportable: '可建立修改提案',
        ide_escape_hatch: '需要手動確認',
        manual_only: '只能手動確認',
        'manual-only': '只能手動確認',
        proposal_only: '僅產生提案',
        'proposal-only': '僅產生提案',
        safe_apply: '安全套用',
        guarded_apply: '受保護套用',
        advanced_apply: '進階套用'
      },
      readiness: {
        ready_to_review: '可直接審查',
        needs_review: '建議先檢查',
        manual_review: '需要手動確認'
      },
      readinessSummary: {
        ready_to_review: '這份作者預覽可進入審查；它不是即時遊戲 runtime 模擬。',
        needs_review: '套用前請先看審查提示；這不是即時遊戲 runtime 模擬。',
        manual_review: '這份內容需要手動確認，暫時不能視為可安裝修改。'
      },
      body: {
        heading: '標題',
        subtitle: '副標題',
        paragraph: '正文',
        news: '新聞標題',
        replacementBefore: '原文',
        replacementAfter: '修改後'
      },
      notes: {
        ide: '這段來源需要人工確認；Studio 會提供指引，不會直接改檔。',
        partial: '這份預覽來自部分 source 抽取。',
        unknown: 'Studio 暫時無法完整分類這份預覽。'
      },
      empty: '（空白）'
    }
  };

  function buildMeaningModel(input, options) {
    const locale = normalizeLocale(options && options.locale);
    const preview = normalizePreview(input);
    const statusKey = normalizeStatus(preview.confidence);
    const model = {
      schemaVersion: MEANING_LAYER_VERSION,
      kind: 'meaning_layer',
      locale,
      sourceKind: preview.sourceKind || 'preview',
      title: humanTitle(preview, locale),
      status: {
        key: statusKey,
        label: text(locale, 'status', statusKey),
        help: text(locale, 'statusHelp', statusKey)
      },
      readiness: humanReadiness(preview.readiness, locale),
      primary: [],
      choices: [],
      assets: preview.assets,
      mechanics: [],
      notes: [],
      advanced: []
    };

    model.primary.push({
      kind: 'category',
      label: text(locale, 'labels', 'sourceKind'),
      value: humanValue(preview.sourceKind || 'preview', locale)
    });
    splitMeta(preview, model, locale);
    splitBody(preview, model, locale);
    splitChoices(preview, model, locale);
    splitWarnings(preview, model, locale);
    splitInstall(preview, model, locale);
    return model;
  }

  function normalizePreview(input) {
    const value = input && typeof input === 'object' ? input : {};
    return {
      sourceKind: String(value.sourceKind || '').trim(),
      confidence: String(value.confidence || 'approximate').trim(),
      title: String(value.title || '').trim(),
      meta: Array.isArray(value.meta) ? value.meta : [],
      body: Array.isArray(value.body) ? value.body : [],
      choices: Array.isArray(value.choices) ? value.choices : [],
      assets: Array.isArray(value.assets) ? value.assets : [],
      warnings: Array.isArray(value.warnings) ? value.warnings : [],
      diagnostics: Array.isArray(value.diagnostics) ? value.diagnostics : [],
      install: value.install && typeof value.install === 'object' ? value.install : null,
      readiness: value.readiness && typeof value.readiness === 'object' ? value.readiness : null
    };
  }

  function normalizeLocale(locale) {
    const textValue = String(locale || 'en');
    return SUPPORTED_LOCALES.has(textValue) ? textValue : 'en';
  }

  function normalizeStatus(value) {
    return value === 'exact' ? 'exact' : (value === 'unsupported' ? 'manual_review' : 'approximate');
  }

  function humanTitle(preview, locale) {
    if (preview.sourceKind === 'surface_text') {
      const before = replacementValue(preview.body, 'Before:');
      const after = replacementValue(preview.body, 'After:');
      if (before && after && before !== after) {
        return before + ' -> ' + after;
      }
      if (before) {
        return before;
      }
    }
    return stripStatusPrefix(preview.title || humanValue(preview.sourceKind, locale) || 'Preview');
  }

  function splitMeta(preview, model, locale) {
    preview.meta.forEach((item) => {
      const label = String(item && item.label || '').trim();
      const value = String(item && item.value || '').trim();
      if (!label) {
        return;
      }
      const row = {
        kind: metaKind(label),
        label: humanLabel(label, locale),
        value: humanValue(value, locale)
      };
      if (label === 'Source' || label === 'Router' || label === 'Linked scene' || label === 'Confidence') {
        model.advanced.push(row);
      } else if (row.kind === 'mechanic') {
        model.mechanics.push(row);
      } else {
        model.primary.push(row);
      }
    });
  }

  function splitBody(preview, model, locale) {
    preview.body.forEach((row) => {
      const textValue = String(row && row.text || '').trim();
      if (!textValue) {
        return;
      }
      const replacementBefore = parseReplacement(textValue, 'Before:');
      const replacementAfter = parseReplacement(textValue, 'After:');
      if (replacementBefore !== null) {
        model.primary.push({kind: 'game-text', label: text(locale, 'body', 'replacementBefore'), value: replacementBefore || text(locale, null, 'empty')});
        return;
      }
      if (replacementAfter !== null) {
        model.primary.push({kind: 'game-text changed', label: text(locale, 'body', 'replacementAfter'), value: replacementAfter || text(locale, null, 'empty')});
        return;
      }
      model.primary.push({
        kind: bodyKind(row.type),
        label: humanBodyLabel(row.type, locale),
        value: textValue
      });
    });
  }

  function splitChoices(preview, model, locale) {
    preview.choices.forEach((choice, index) => {
      const label = String(choice && choice.label || '').trim() || 'Choice ' + String(index + 1);
      const item = {
        kind: 'choice',
        label,
        subtitle: String(choice && choice.subtitle || '').trim(),
        details: []
      };
      const availability = choice && choice.availability ? choice.availability : {};
      if (availability.condition) {
        item.details.push({kind: 'mechanic', label: humanLabel('Requires', locale), value: availability.condition});
      }
      if (availability.unavailableText) {
        item.details.push({kind: 'game-text', label: humanValue('option_subtitle', locale), value: availability.unavailableText});
      }
      (Array.isArray(choice && choice.effects) ? choice.effects : []).forEach((effect) => {
        item.details.push({kind: 'mechanic', label: locale === 'zh-Hant' ? '效果' : 'Effect', value: String(effect)});
      });
      model.choices.push(item);
    });
  }

  function splitWarnings(preview, model, locale) {
    preview.warnings.forEach((warning) => {
      const note = humanWarning(String(warning || ''), locale);
      if (note) {
        model.notes.push({kind: 'warning', label: text(locale, 'section', 'notes'), value: note});
      }
    });
    preview.diagnostics.forEach((diagnostic) => {
      const message = String(diagnostic && diagnostic.message || diagnostic && diagnostic.code || '').trim();
      if (message) {
        model.advanced.push({kind: 'diagnostic', label: locale === 'zh-Hant' ? '診斷' : 'Diagnostic', value: message});
      }
    });
  }

  function splitInstall(preview, model, locale) {
    if (!preview.install || !preview.install.status) {
      return;
    }
    model.primary.push({
      kind: preview.install.status === 'manual-only' ? 'warning' : 'mechanic',
      label: humanLabel('Install', locale),
      value: humanValue(preview.install.status, locale)
    });
  }

  function humanReadiness(readiness, locale) {
    const raw = readiness && typeof readiness === 'object' ? readiness : {};
    const key = String(raw.key || 'needs_review');
    return {
      key,
      label: text(locale, 'readiness', key) || raw.label || key,
      summary: text(locale, 'readinessSummary', key) || raw.summary || '',
      warningCount: Number(raw.warningCount || 0),
      assetCount: Number(raw.assetCount || 0),
      runtimePreview: Boolean(raw.runtimePreview)
    };
  }

  function bodyKind(type) {
    if (type === 'heading' || type === 'subtitle' || type === 'paragraph' || type === 'news' || type === 'replacement') {
      return 'game-text';
    }
    return 'game-text';
  }

  function metaKind(label) {
    if (label === 'Requires' || label === 'Requires JS' || label === 'Priority' || label === 'Seen flag' || label === 'View-if' || label === 'Frequency' || label === 'Max visits') {
      return 'mechanic';
    }
    if (label === 'Editability') {
      return 'warning';
    }
    return 'category';
  }

  function humanLabel(label, locale) {
    return text(locale, 'labels', label) || label;
  }

  function humanValue(value, locale) {
    const raw = String(value || '').trim();
    if (!raw) {
      return raw;
    }
    return text(locale, 'values', raw) || raw;
  }

  function humanBodyLabel(type, locale) {
    return text(locale, 'body', type) || text(locale, 'body', 'paragraph');
  }

  function humanWarning(warning, locale) {
    if (/IDE escape hatch|cannot safely preview runtime ownership/i.test(warning)) {
      return text(locale, 'notes', 'ide');
    }
    if (/partial source extraction/i.test(warning)) {
      return text(locale, 'notes', 'partial');
    }
    if (/unsupported|does not recognize/i.test(warning)) {
      return text(locale, 'notes', 'unknown');
    }
    return warning;
  }

  function stripStatusPrefix(value) {
    return String(value || '').replace(/^\[[^\]]+\]\s*/, '').trim();
  }

  function replacementValue(rows, prefix) {
    for (const row of rows || []) {
      const parsed = parseReplacement(String(row && row.text || ''), prefix);
      if (parsed !== null) {
        return parsed;
      }
    }
    return '';
  }

  function parseReplacement(value, prefix) {
    const textValue = String(value || '');
    return textValue.startsWith(prefix) ? textValue.slice(prefix.length).trim() : null;
  }

  function text(locale, group, key) {
    const dict = TEXT[locale] || TEXT.en;
    if (!group) {
      return dict[key] || TEXT.en[key] || '';
    }
    return (dict[group] && dict[group][key]) || (TEXT.en[group] && TEXT.en[group][key]) || '';
  }

  const api = {
    MEANING_LAYER_VERSION,
    buildMeaningModel,
    build: buildMeaningModel
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapMeaningLayer = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
