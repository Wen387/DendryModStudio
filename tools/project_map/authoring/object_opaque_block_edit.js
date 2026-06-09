// @ts-check
(function initProjectMapObjectOpaqueBlockEdit(global) {
  'use strict';

  // Magic {! … !} blocks are opaque arbitrary JS. By policy they are edited as
  // RAW TEXT, never structured — Studio does not interpret the JS. Each edited
  // block becomes a guarded replace_section over its recorded [line..endLine]
  // span (anchors from the indexer), so a save replaces exactly that block and
  // leaves every other byte of the file untouched (mirrors the prose textBlocks
  // path in existing_scene_edit_model.js). The field id is 'opaque:<blockId>'.
  // Split out of existing_scene_edit_model.js to keep that orchestrator bounded.

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  // An edit that drops or unbalances the {! … !} wrapper would corrupt the block,
  // so the change is downgraded to manual review rather than auto-applied.
  function preservesOpaqueWrapper(text) {
    const value = String(text || '');
    const open = (value.match(/\{!/g) || []).length;
    const close = (value.match(/!\}/g) || []).length;
    return open >= 1 && open === close;
  }

  function opaqueBlockChange(block, before, after) {
    const source = isObject(block.source) ? block.source : {};
    const change = {
      fieldId: 'opaque:' + block.id,
      role: 'opaque_js_block',
      label: String(block.label || 'JS block'),
      sectionId: '',
      optionId: '',
      source: source,
      editability: 'guarded_replace_section',
      operationType: 'replace_section',
      anchorText: String(source.anchorText || ''),
      endAnchorText: String(source.endAnchorText || ''),
      rawAnchorText: String(source.rawAnchorText || ''),
      rawEndAnchorText: String(source.rawEndAnchorText || ''),
      expectedRangeHash: String(source.expectedRangeHash || ''),
      startLine: source.line || null,
      endLine: source.endLine || null,
      dedupeSearch: String(after || '').trim().slice(0, 200),
      before: before,
      after: after
    };
    if (!preservesOpaqueWrapper(after)) {
      change.operationType = 'manual_snippet';
      change.editability = 'manual_review';
    }
    return change;
  }

  // Turn edited 'opaque:<id>' values into guarded replace_section changes. Only
  // blocks the model marked `editable` (verbatim text + scene span + anchors) are
  // touched; unchanged or untouched blocks yield nothing.
  function opaqueBlockChangesFromValues(model, values) {
    const edited = isObject(values) ? values : {};
    return ensureArray(model && model.opaqueJsBlocks).reduce((changes, block) => {
      if (!block || !block.editable) {
        return changes;
      }
      const key = 'opaque:' + block.id;
      if (!Object.prototype.hasOwnProperty.call(edited, key)) {
        return changes;
      }
      const before = String(block.rawText || block.original || '');
      const after = String(edited[key] === undefined || edited[key] === null ? '' : edited[key]);
      if (after === before) {
        return changes;
      }
      changes.push(opaqueBlockChange(block, before, after));
      return changes;
    }, []);
  }

  const api = {
    opaqueBlockChangesFromValues,
    opaqueBlockChange,
    preservesOpaqueWrapper
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapObjectOpaqueBlockEdit = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
