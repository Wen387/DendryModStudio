(function initMeaningLayerUi(global) {
  'use strict';

  const api = {
    renderPreviewElement,
    renderPreviewHtml
  };

  global.ProjectMapMeaningLayerUi = api;

  function renderPreviewElement(element, input, options, fallbackText) {
    if (!element) {
      return;
    }
    const html = renderPreviewHtml(input, options, fallbackText);
    if (html) {
      element.classList.add('meaning-preview-host');
      element.innerHTML = html;
      return;
    }
    element.classList.remove('meaning-preview-host');
    element.textContent = fallbackText || '';
  }

  function renderPreviewHtml(input, options, fallbackText) {
    const previewApi = global.ProjectMapPreviewModel;
    const meaningApi = global.ProjectMapMeaningLayer;
    if (!previewApi || !meaningApi || typeof meaningApi.buildMeaningModel !== 'function') {
      return fallbackText ? '<pre class="player-preview inspector-preview-text">' + escapeHtml(fallbackText) + '</pre>' : '';
    }
    try {
      const preview = input && input.kind === 'preview_model'
        ? input
        : previewApi.buildPreviewModel(input, options || {});
      const locale = currentLocale();
      const model = meaningApi.buildMeaningModel(preview, {locale});
      return renderMeaningModel(model);
    } catch (err) {
      return fallbackText ? '<pre class="player-preview inspector-preview-text">' + escapeHtml(fallbackText) + '</pre>' : '';
    }
  }

  function renderMeaningModel(model) {
    return [
      '<article class="meaning-preview" data-preview-confidence="' + escapeAttr(model.status && model.status.key || 'approximate') + '">',
      '<header class="meaning-preview-header">',
      '<span class="meaning-status meaning-status-' + escapeAttr(model.status && model.status.key || 'approximate') + '">' + escapeHtml(model.status && model.status.label || '') + '</span>',
      '<h4>' + escapeHtml(model.title || '') + '</h4>',
      model.status && model.status.help ? '<p>' + escapeHtml(model.status.help) + '</p>' : '',
      '</header>',
      renderPreviewReadiness(model),
      renderRows(sectionLabel(model, 'playerText'), model.primary, 'primary'),
      renderChoices(model),
      renderPreviewAssets(model),
      renderRows(sectionLabel(model, 'mechanics'), model.mechanics, 'mechanics'),
      renderRows(sectionLabel(model, 'notes'), model.notes, 'notes'),
      renderAdvanced(model),
      '</article>'
    ].join('');
  }

  function renderPreviewReadiness(model) {
    const readiness = model.readiness || {};
    if (!readiness.key && !readiness.summary) {
      return '';
    }
    const stats = [];
    stats.push((readiness.warningCount || 0) + ' ' + (model.locale === 'zh-Hant' ? '項提示' : 'notes'));
    stats.push((readiness.assetCount || 0) + ' ' + (model.locale === 'zh-Hant' ? '個資產' : 'assets'));
    stats.push(readiness.runtimePreview ? (model.locale === 'zh-Hant' ? 'runtime' : 'runtime') : (model.locale === 'zh-Hant' ? '非 runtime' : 'not runtime'));
    return [
      '<section class="meaning-readiness meaning-readiness-' + escapeAttr(readiness.key || 'needs_review') + '">',
      '<strong>' + escapeHtml(readiness.label || '') + '</strong>',
      readiness.summary ? '<p>' + escapeHtml(readiness.summary) + '</p>' : '',
      '<div class="meaning-readiness-stats">',
      stats.map((item) => '<span>' + escapeHtml(item) + '</span>').join(''),
      '</div>',
      '</section>'
    ].join('');
  }

  function renderRows(title, rows, group) {
    const items = (rows || []).filter((row) => row && row.value !== undefined && row.value !== null && String(row.value).trim() !== '');
    if (!items.length) {
      return '';
    }
    return collapsibleSection(group, title, sectionCount(items), [
      '<div class="meaning-row-grid">',
      items.map(renderRow).join(''),
      '</div>'
    ].join(''), {open: group === 'primary'});
  }

  function renderRow(row) {
    return [
      '<div class="meaning-row meaning-kind-' + escapeAttr(String(row.kind || 'info').replace(/\s+/g, '-')) + '">',
      '<span class="meaning-row-label">' + escapeHtml(row.label || '') + '</span>',
      '<span class="meaning-row-value">' + escapeHtml(row.value || '') + '</span>',
      '</div>'
    ].join('');
  }

  function renderChoices(model) {
    const choices = model.choices || [];
    if (!choices.length) {
      return '';
    }
    return collapsibleSection('choices', sectionLabel(model, 'choices'), sectionCount(choices), [
      '<div class="meaning-choice-list">',
      choices.map((choice) => [
        '<article class="meaning-choice">',
        '<strong>' + escapeHtml(choice.label || '') + '</strong>',
        choice.subtitle ? '<p>' + escapeHtml(choice.subtitle) + '</p>' : '',
        (choice.details || []).length ? '<div class="meaning-choice-details">' + choice.details.map(renderRow).join('') + '</div>' : '',
        '</article>'
      ].join('')).join(''),
      '</div>'
    ].join(''), {open: true});
  }

  function renderPreviewAssets(model) {
    const assets = (model.assets || []).filter(Boolean);
    if (!assets.length) {
      return '';
    }
    return collapsibleSection('assets', sectionLabel(model, 'assets'), sectionCount(assets), [
      '<div class="meaning-asset-list">',
      assets.map(renderMeaningAsset).join(''),
      '</div>'
    ].join(''));
  }

  function renderMeaningAsset(asset) {
    const normalized = normalizeAsset(asset);
    const capability = normalized.previewCapability || {};
    const title = normalized.label || normalized.name || normalized.path || '';
    const roleLabel = normalized.roleLabel || assetRoleLabel(normalized.role);
    const preview = capability.canPreview && capability.mediaKind === 'image'
      ? '<img src="' + escapeAttr(capability.url || normalized.path || '') + '" alt="' + escapeAttr(title) + '" loading="lazy">'
      : capability.canPreview && capability.mediaKind === 'audio'
        ? '<audio controls preload="metadata" src="' + escapeAttr(capability.url || normalized.path || '') + '"></audio>'
        : '<span>' + escapeHtml(assetTypeLabel(capability.mediaKind || normalized.type || 'asset')) + '</span>';
    return [
      '<article class="meaning-asset">',
      '<div class="meaning-asset-preview">',
      preview,
      '</div>',
      '<div class="meaning-asset-body">',
      '<strong>' + escapeHtml(title || normalized.path || '') + '</strong>',
      roleLabel ? '<p class="meaning-asset-role">' + escapeHtml(roleLabel) + '</p>' : '',
      '<p>' + escapeHtml(normalized.path || '') + '</p>',
      '</div>',
      '</article>'
    ].join('');
  }

  function normalizeAsset(asset) {
    const api = global.ProjectMapAssetModel;
    if (api && typeof api.normalizeAssetItem === 'function') {
      return api.normalizeAssetItem(asset, {});
    }
    return asset || {};
  }

  function assetRoleLabel(role) {
    const api = global.ProjectMapAssetModel;
    const value = String(role || '').trim();
    if (!value) {
      return '';
    }
    const fallback = api && typeof api.assetRoleLabel === 'function' ? api.assetRoleLabel(value) : value;
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.t === 'function' ? i18n.t('assets.role.' + value, fallback) : fallback;
  }

  function renderAdvanced(model) {
    const rows = model.advanced || [];
    if (!rows.length) {
      return '';
    }
    return collapsibleSection('advanced', sectionLabel(model, 'advanced'), sectionCount(rows), [
      '<div class="meaning-row-grid">',
      rows.map(renderRow).join(''),
      '</div>'
    ].join(''));
  }

  function collapsibleSection(group, title, count, body, options) {
    const open = options && options.open ? ' open' : '';
    const advancedClass = group === 'advanced' ? ' meaning-advanced' : '';
    return [
      '<details class="meaning-section meaning-section-' + escapeAttr(group) + ' meaning-collapsible' + advancedClass + '"' + open + ' data-meaning-section="' + escapeAttr(group) + '">',
      '<summary><span class="meaning-section-title">' + escapeHtml(title) + '</span><span class="section-count">' + escapeHtml(sectionCount(count)) + '</span></summary>',
      '<div class="meaning-section-body">',
      body,
      '</div>',
      '</details>'
    ].join('');
  }

  function sectionCount(value) {
    if (Array.isArray(value)) return String(value.length);
    const count = Number(value);
    return Number.isFinite(count) && count > 0 ? String(count) : '0';
  }

  function sectionLabel(model, key) {
    const zh = model.locale === 'zh-Hant';
    return {
      playerText: zh ? '玩家會看到的內容' : 'Player-facing content',
      choices: zh ? '玩家選項' : 'Player choices',
      mechanics: zh ? '遊戲規則' : 'Game rules',
      notes: zh ? '審查提示' : 'Review notes',
      assets: zh ? '引用資產' : 'Referenced assets',
      advanced: zh ? '進階資訊' : 'Advanced details'
    }[key] || key;
  }

  function assetTypeLabel(value) {
    const zh = currentLocale() === 'zh-Hant';
    const labels = {
      image: zh ? '圖片' : 'Image',
      audio: zh ? '音訊' : 'Audio',
      asset: zh ? '資產' : 'Asset'
    };
    return labels[value] || value;
  }

  function currentLocale() {
    const i18n = global.ProjectMapI18n;
    return i18n && typeof i18n.getLocale === 'function' ? i18n.getLocale() : 'en';
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
    return escapeHtml(value).replace(/\s+/g, '-');
  }
})(typeof window !== 'undefined' ? window : globalThis);
