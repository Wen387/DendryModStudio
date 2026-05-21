(function initProjectMapPreviewObjectOpeningContextUi(global) {
  'use strict';

  function create(deps) {
    const api = deps && typeof deps === 'object' ? deps : {};
    const t = typeof api.t === 'function' ? api.t : (_key, fallback) => fallback || '';
    const escapeHtml = typeof api.escapeHtml === 'function' ? api.escapeHtml : defaultEscapeHtml;
    const ensureArray = typeof api.ensureArray === 'function' ? api.ensureArray : defaultEnsureArray;
    const fieldId = typeof api.fieldId === 'function' ? api.fieldId : defaultFieldId;
    const renderInlineField = typeof api.renderInlineField === 'function' ? api.renderInlineField : () => '';
    const logicFieldElement = typeof api.logicFieldElement === 'function' ? api.logicFieldElement : () => 'input';

    function render(body, model) {
      const fields = openingContextFields(body);
      if (!fields.length) {
        return '';
      }
      return [
        '<section class="preview-object-opening-context" data-preview-object-opening-context="true">',
        '<div class="preview-object-section-title">' + escapeHtml(t('previewObjectEditor.openingContext', 'Opening conditions')) + '</div>',
        '<div class="preview-object-opening-context-fields">',
        fields.map((field) => renderInlineField(field, {
          role: 'opening-context',
          element: openingContextFieldElement(field),
          fallbackLabel: field && field.label || t('previewObjectEditor.openingContext', 'Opening conditions'),
          assetBaseUrl: model && model.eventBody && model.eventBody.assetBaseUrl
        })).join(''),
        '</div>',
        '</section>'
      ].join('');
    }

    function openingContextFields(body) {
      return ensureArray(body && body.metaFields).filter(isOpeningContextField);
    }

    function isOpeningContextField(field) {
      if (!field) {
        return false;
      }
      const id = String(fieldId(field) || field.id || field.key || '').trim();
      const label = String(field.label || '').trim();
      const role = String(field.role || field.semanticRole || '').trim();
      if (/^(?:metadata_)?(?:metadata_tags|metadata_maxVisits|metadata_newPage|metadata_viewIf)$/i.test(id)) {
        return true;
      }
      if (/^event\.(?:tags|maxVisits|newPage|requires|priority|useSeenFlag)$/i.test(id)) {
        return true;
      }
      if (role === 'metadata' && /^(?:Tags|Max visits|New page|Priority)$/i.test(label)) {
        return true;
      }
      return /^(?:Appearance condition|Condition)$/i.test(label) && /(?:viewIf|requires|condition)/i.test(id + ' ' + role);
    }

    function openingContextFieldElement(field) {
      const id = String(fieldId(field) || field && field.id || '').trim();
      const label = String(field && field.label || '').trim();
      if (/viewIf|requires|condition/i.test(id + ' ' + label)) {
        return 'textarea';
      }
      return logicFieldElement(field);
    }

    return {
      render,
      openingContextFields,
      isOpeningContextField
    };
  }

  function defaultFieldId(field) {
    return String(field && field.id || '');
  }

  function defaultEnsureArray(value) {
    return Array.isArray(value) ? value : [];
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
    global.ProjectMapPreviewObjectOpeningContextUi = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
