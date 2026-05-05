(function initProjectMapEditingFieldPanels(root) {
  'use strict';

  function createEditingFieldPanels(ctx) {
    ctx = ctx || {};
    const t = ctx.t || ((key, fallback) => fallback || key);
    const escapeHtml = ctx.escapeHtml || ((value) => String(value || ''));
    const escapeAttr = ctx.escapeAttr || escapeHtml;

    function renderFieldPanels(context) {
      const editors = context && context.editors || {};
      return [
        '<section class="editing-field-panels" data-editing-field-panels="true">',
        renderEditorGroup(t('editing.group.pageSections', 'Page sections'), editors.pageSections, true),
        renderEditorGroup(t('editing.group.optionText', 'Option text'), editors.optionText, true),
        renderEditorGroup(t('editing.group.conditions', 'Appearance condition'), editors.conditions, false),
        renderEditorGroup(t('editing.group.playerText', 'Other player text'), editors.playerText, false),
        '</section>'
      ].join('');
    }

    function renderContextPanels(context) {
      const rows = context && context.context || {};
      return [
        '<section class="editing-readonly-panels">',
        renderVariables(rows.variables || []),
        renderEffects(rows.effects || []),
        renderAssets(rows.assets || []),
        renderSourceEvidence(rows.sourceEvidence || []),
        renderManualBoundaries(rows.manualBoundaries || []),
        '</section>'
      ].join('');
    }

    function renderEditorGroup(title, rows, open) {
      const items = Array.isArray(rows) ? rows : [];
      return [
        '<details class="editing-panel"' + (open ? ' open' : '') + '>',
        '<summary><span>' + escapeHtml(title) + '</span><b>' + items.length + '</b></summary>',
        items.length ? items.map(renderEditor).join('') : '<div class="editing-empty">' + escapeHtml(t('editing.noEditors', 'No editable source-backed fields in this group.')) + '</div>',
        '</details>'
      ].join('');
    }

    function renderEditor(editor) {
      const longText = String(editor.value || editor.original || '').length > 120 || String(editor.value || '').includes('\n');
      const rows = longText ? Math.max(5, Math.min(14, String(editor.value || '').split('\n').length + 2)) : 3;
      return [
        '<label class="editing-field editing-field-' + escapeAttr(editor.status || 'review') + '">',
        '<span>' + escapeHtml(editor.label || editor.id) + '</span>',
        '<small>' + escapeHtml([statusLabel(editor.status), sourceLabel(editor.source), editor.editability].filter(Boolean).join(' / ')) + '</small>',
        '<textarea rows="' + rows + '" data-editing-field="' + escapeAttr(editor.id) + '">' + escapeHtml(editor.value || '') + '</textarea>',
        '</label>'
      ].join('');
    }

    function renderVariables(rows) {
      return renderReadonlyGroup(t('editing.group.variables', 'Variables touched'), rows, (row) => [
        'Q.' + row.name,
        row.readCount + ' ' + t('editing.reads', 'reads'),
        row.writeCount + ' ' + t('editing.writes', 'writes')
      ].join(' / '));
    }

    function renderEffects(rows) {
      return renderReadonlyGroup(t('editing.group.effects', 'Effects'), rows, (row) => {
        return ['Q.' + row.variable, row.op, row.value, sourceLabel(row.source)].filter(Boolean).join(' ');
      });
    }

    function renderAssets(rows) {
      return renderReadonlyGroup(t('editing.group.assets', 'Assets'), rows, (row) => {
        return [row.role || 'asset', row.label || row.path].filter(Boolean).join(': ');
      });
    }

    function renderSourceEvidence(rows) {
      return renderReadonlyGroup(t('editing.group.sourceEvidence', 'Source evidence'), rows, (row) => {
        return [row.label, row.path + (row.line ? ':' + row.line : '')].filter(Boolean).join(' / ');
      });
    }

    function renderManualBoundaries(rows) {
      return renderReadonlyGroup(t('editing.group.manualBoundaries', 'Manual-review boundaries'), rows, (row) => {
        return [row.label, row.reason, sourceLabel(row.source)].filter(Boolean).join(' / ');
      });
    }

    function renderReadonlyGroup(title, rows, renderRow) {
      const items = Array.isArray(rows) ? rows : [];
      return [
        '<details class="editing-panel">',
        '<summary><span>' + escapeHtml(title) + '</span><b>' + items.length + '</b></summary>',
        items.length ? items.map((row) => '<p class="editing-readonly-line">' + escapeHtml(renderRow(row)) + '</p>').join('') : '<div class="editing-empty">' + escapeHtml(t('editing.noContextRows', 'No rows in this context group.')) + '</div>',
        '</details>'
      ].join('');
    }

    function statusLabel(status) {
      const value = String(status || '');
      if (value === 'guarded') {
        return t('editing.status.guarded', 'guarded apply');
      }
      if (value === 'manual') {
        return t('editing.status.manual', 'manual review');
      }
      if (value === 'read_only') {
        return t('editing.status.readOnly', 'read-only');
      }
      return value;
    }

    function sourceLabel(source) {
      const ref = source && typeof source === 'object' ? source : {};
      return ref.path ? ref.path + (ref.line ? ':' + ref.line : '') : '';
    }

    return {
      renderFieldPanels,
      renderContextPanels
    };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = createEditingFieldPanels;
  }
  if (root) {
    root.ProjectMapEditingFieldPanels = createEditingFieldPanels;
  }
})(typeof window !== 'undefined' ? window : globalThis);
