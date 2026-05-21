(function initProjectMapPreviewObjectMetadataUi(global) {
  'use strict';

  function create(deps) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const t = typeof api.t === 'function' ? api.t : (_key, fallback) => fallback || '';
    const escapeHtml = typeof api.escapeHtml === 'function' ? api.escapeHtml : defaultEscapeHtml;
    const escapeAttr = typeof api.escapeAttr === 'function' ? api.escapeAttr : escapeHtml;
    const ensureArray = typeof api.ensureArray === 'function' ? api.ensureArray : defaultEnsureArray;
    const fieldValue = typeof api.fieldValue === 'function' ? api.fieldValue : defaultFieldValue;
    const fieldId = typeof api.fieldId === 'function' ? api.fieldId : defaultFieldId;
    const displayFieldLabel = typeof api.displayFieldLabel === 'function' ? api.displayFieldLabel : defaultDisplayFieldLabel;
    const actionForField = typeof api.actionForField === 'function' ? api.actionForField : () => null;
    const renderedEntryAttrs = typeof api.renderedEntryAttrs === 'function' ? api.renderedEntryAttrs : () => '';
    const renderActionContextLens = typeof api.renderActionContextLens === 'function' ? api.renderActionContextLens : () => '';

    function renderChips(fields, model) {
      const rows = ensureArray(fields).filter((field) => field && fieldValue(field).trim());
      if (!rows.length) {
        return '';
      }
      return [
        '<div class="object-editing-preview-metadata" data-object-editing-preview-metadata="true">',
        rows.slice(0, 12).map((field) => renderChip(field, model)).join(''),
        '</div>'
      ].join('');
    }

    function renderChip(field, model) {
      const role = String(field && (field.role || field.semanticRole) || '').toLowerCase();
      const labelText = String(field && field.label || field && field.id || '');
      const metadataKind = role === 'route' ? 'route' : /condition|view|choose|if/i.test(labelText) ? 'condition' : 'metadata';
      const entryKind = metadataKind === 'route' || metadataKind === 'condition' ? 'condition' : 'metadata';
      const action = actionForField(field, entryKind, model, {role: metadataKind});
      const labelParts = previewMetadataLabelParts(displayFieldLabel(field, field && field.label || fieldId(field)), metadataKind);
      const rawValue = fieldValue(field);
      const layout = previewMetadataLayout(metadataKind, labelParts, rawValue);
      const displayValue = previewMetadataValue(rawValue, metadataKind, layout);
      return [
        '<span class="object-editing-preview-metadata-chip" data-metadata-kind="' + escapeAttr(metadataKind) + '" data-metadata-layout="' + escapeAttr(layout) + '"' + (labelParts.context ? ' data-metadata-has-context="true"' : '') + renderedEntryAttrs(action, entryKind, t('previewObjectEditor.editRenderedMetadata', 'Edit metadata')) + '>',
        '<span class="object-editing-preview-metadata-label"><strong>' + escapeHtml(labelParts.label) + '</strong>' + (labelParts.context ? '<small>' + escapeHtml(labelParts.context) + '</small>' : '') + '</span>',
        '<em>' + escapeHtml(displayValue) + '</em>',
        renderActionContextLens(action, entryKind),
        '</span>'
      ].join('');
    }

    return {
      renderChips
    };
  }

  function previewMetadataLabelParts(label, kind) {
    const text = String(label || '').replace(/\s+/g, ' ').trim();
    if ((kind === 'condition' || kind === 'route') && text.indexOf(':') > 0) {
      const parts = text.split(':');
      const head = parts.shift().trim();
      const tail = parts.join(':').trim();
      if (head && tail) {
        return {label: head, context: tail};
      }
    }
    return {label: text, context: ''};
  }

  function previewMetadataLayout(kind, labelParts, value) {
    const context = String(labelParts && labelParts.context || '');
    const text = String(value || '');
    if (kind === 'condition') {
      return 'block';
    }
    if (kind === 'route' && (context.length > 32 || text.length > 24)) {
      return 'block';
    }
    return 'inline';
  }

  function previewMetadataValue(value, kind, layout) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (kind !== 'condition' || layout !== 'block' || text.length < 48) {
      return text;
    }
    return text.replace(/\s+(and|or)\s+/gi, '\n$1 ');
  }

  function defaultEnsureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function defaultFieldValue(field) {
    const value = field && Object.prototype.hasOwnProperty.call(field, 'value') ? field.value : field && field.text;
    return String(value === undefined || value === null ? '' : value);
  }

  function defaultFieldId(field) {
    return String(field && field.id || '');
  }

  function defaultDisplayFieldLabel(field, fallback) {
    return String(field && field.label || fallback || '');
  }

  function defaultEscapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const api = {create};

  if (global) {
    global.ProjectMapPreviewObjectMetadataUi = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
