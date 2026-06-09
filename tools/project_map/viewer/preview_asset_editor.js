(function initProjectMapPreviewAssetEditor(global) {
  'use strict';

  // Asset <select>s carry the whole indexed catalog. A dense event renders one
  // per empty slot across hundreds of cards, so emitting every <option> inline
  // multiplied into tens of thousands of DOM nodes. Above this threshold we defer
  // the option list: the select renders with only its placeholder/current row and
  // a stashed thunk builds the full list the first time the control is focused.
  // The same threshold gates the inline filter input (renderAssetSelectFilter),
  // so whenever options are deferred the user still has a search box to populate
  // and filter them.
  const ASSET_SELECT_DEFER_THRESHOLD = 16;
  const deferredAssetOptionThunks = new Map();
  const DEFERRED_ASSET_OPTION_LIMIT = 4000;
  let deferredAssetOptionSeq = 0;

  function stashDeferredAssetOptions(thunk) {
    const id = 'dac' + (deferredAssetOptionSeq += 1);
    deferredAssetOptionThunks.set(id, thunk);
    if (deferredAssetOptionThunks.size > DEFERRED_ASSET_OPTION_LIMIT) {
      const oldest = deferredAssetOptionThunks.keys().next().value;
      deferredAssetOptionThunks.delete(oldest);
    }
    return id;
  }

  function materializeDeferredAssetOptions(id) {
    const thunk = id ? deferredAssetOptionThunks.get(id) : null;
    if (typeof thunk !== 'function') {
      return '';
    }
    return String(thunk() || '');
  }

  function populateDeferredAssetSelect(select) {
    if (!select || !select.dataset || select.dataset.assetSelectReady === 'true') {
      return;
    }
    const id = select.dataset.assetSelectDeferred || '';
    select.dataset.assetSelectReady = 'true';
    const html = materializeDeferredAssetOptions(id);
    deferredAssetOptionThunks.delete(id);
    if (!html || typeof select.insertAdjacentHTML !== 'function') {
      return;
    }
    const previous = select.value;
    select.insertAdjacentHTML('beforeend', html);
    if (previous) {
      try {
        select.value = previous;
      } catch (error) {
        /* keep the best-effort current selection */
      }
    }
  }

  function create(deps) {
    const d = deps && typeof deps === 'object' ? deps : {};
    const t = typeof d.t === 'function' ? d.t : (_key, fallback) => fallback || '';
    const escapeHtml = typeof d.escapeHtml === 'function' ? d.escapeHtml : defaultEscapeHtml;
    const escapeAttr = typeof d.escapeAttr === 'function' ? d.escapeAttr : defaultEscapeAttr;
    const ensureArray = typeof d.ensureArray === 'function' ? d.ensureArray : defaultEnsureArray;
    const safeClass = typeof d.safeClass === 'function' ? d.safeClass : defaultSafeClass;
    const isFlowAsset = typeof d.isFlowAsset === 'function' ? d.isFlowAsset : () => false;
    const isFlowAssetAddField = typeof d.isFlowAssetAddField === 'function' ? d.isFlowAssetAddField : () => false;
    const assetModelApi = typeof d.assetModelApi === 'function' ? d.assetModelApi : () => null;
    const sourceLabelFromRef = typeof d.sourceLabelFromRef === 'function' ? d.sourceLabelFromRef : (value) => String(value || '');

    function renderInlineAssetPlacements(assets, addFields, target, body, model, options) {
      const rows = ensureArray(assets).filter((asset) => asset && (asset.path || asset.label || asset.name));
      const adds = ensureArray(addFields);
      const suppressEmptyAddControls = shouldSuppressEmptyFlowAddControls(body, rows, adds);
      if (!rows.length && (!adds.length || suppressEmptyAddControls)) {
        return '';
      }
      const renderOptions = options || {};
      const allowAddControls = Object.prototype.hasOwnProperty.call(renderOptions, 'showAddControls')
        ? Boolean(renderOptions.showAddControls)
        : Boolean(model && model.mode === 'existing');
      const allowReplacementControls = Object.prototype.hasOwnProperty.call(renderOptions, 'showReplacementControls')
        ? Boolean(renderOptions.showReplacementControls)
        : Boolean(model && model.mode === 'existing');
      const opts = {
        assetCatalog: body && body.assetCatalog,
        relatedAssets: rows.concat(ensureArray(body && body.assets)),
        showControls: model && model.mode !== 'existing',
        showAddControls: allowAddControls,
        showReplacementControls: allowReplacementControls,
        allowSwapControl: allowReplacementControls
      };
      return [
        '<div class="object-canvas-flow-assets" data-object-canvas-flow-assets="true" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '">',
        '<small>' + escapeHtml(t('assets.flowAssets', 'Flow assets')) + '</small>',
        rows.map((asset) => renderFlowAssetRow(asset, target, opts)).join(''),
        !suppressEmptyAddControls && (opts.showAddControls || opts.showControls) ? adds.map((field) => renderAssetAddFieldControls(field, target, opts)).join('') : '',
        '</div>'
      ].join('');
    }

    function shouldSuppressEmptyFlowAddControls(body, rows, addFields) {
      if (ensureArray(rows).length || !ensureArray(addFields).length) {
        return false;
      }
      const flowAddCount = ensureArray(body && body.assetAddFields).filter(isFlowAssetAddField).length;
      const flowSurfaceCount = ensureArray(body && body.options).length + ensureArray(body && body.branchSections).length;
      return flowAddCount > 20 || flowSurfaceCount > 20;
    }

    function renderFlowAssetRow(asset, target, options) {
      const item = asset || {};
      const role = item.role || 'event_illustration';
      const location = item.displayLocation || item.sectionId || item.optionId || '';
      return [
        '<article class="object-canvas-flow-asset-row" data-object-canvas-flow-asset-row="true" data-asset-placement-kind="' + escapeAttr(item.placementKind || 'unknown_inline') + '" data-asset-role="' + escapeAttr(role) + '">',
        renderPreviewAsset(item, target),
        location ? '<small>' + escapeHtml(location) + '</small>' : '',
        options && options.showReplacementControls ? renderFlowAssetReplacementControl(item, target, options) : '',
        options && options.showReplacementControls ? renderFlowAssetRemovalControl(item, target) : '',
        '</article>'
      ].join('');
    }

    function renderFlowAssetReplacementControl(asset, target, options) {
      const item = asset || {};
      const fieldId = String(item.assetEditFieldId || '').trim();
      const directive = String(item.replacementDirective || item.directive || '').trim();
      if (!fieldId || !directive || !item.replacementAvailable) {
        return '';
      }
      return [
        options && options.allowSwapControl ? renderExistingAssetSwapControl(item, item.role, item.type, target, options) : '',
        '<label class="object-canvas-asset-picker-control object-canvas-asset-replacement-control" data-object-canvas-asset-replacement="true">',
        '<span>' + escapeHtml(t('assets.replaceFile', 'Replacement file')) + '</span>',
        '<input type="file" accept="' + escapeAttr(item.type === 'audio' ? 'audio/*' : 'image/*') + '" data-object-canvas-asset-file="true" data-existing-asset-field="' + escapeAttr(fieldId) + '" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(item.role || '') + '" data-asset-directive="' + escapeAttr(directive) + '" data-current-asset-path="' + escapeAttr(item.assetCurrentPath || item.path || '') + '" data-asset-original="' + escapeAttr(item.assetOriginal || '') + '">',
        '</label>'
      ].join('');
    }

    // Swap an EXISTING indexed asset to another already-indexed asset (no file
    // upload). Mirrors the add-slot picker but binds to data-existing-asset-field
    // so a change becomes a guarded replace_text on the current reference line.
    function renderExistingAssetSwapControl(ref, role, type, target, options) {
      const item = ref || {};
      const fieldId = String(item.assetEditFieldId || '').trim();
      const directive = String(item.replacementDirective || item.directive || '').trim();
      const slotRole = String(role || item.role || '').trim();
      if (!fieldId || !directive || !item.replacementAvailable) {
        return '';
      }
      const catalog = assetCatalogForSlot(options && options.assetCatalog, {type: type || item.type || 'image', role: slotRole});
      if (!ensureArray(catalog).length) {
        return '';
      }
      const currentValue = assetSelectValue(item, slotRole);
      const currentInCatalog = catalog.some((asset) => sourceReferencePathForAsset(asset && asset.path) === sourceReferencePathForAsset(item.path || item.assetCurrentPath));
      const deferOptions = ensureArray(catalog).length >= ASSET_SELECT_DEFER_THRESHOLD;
      const showCurrentOption = currentValue && (deferOptions ? true : !currentInCatalog);
      const deferredId = deferOptions
        ? stashDeferredAssetOptions(() => ensureArray(catalog)
          .filter((asset) => !currentValue || assetSelectValue(asset, slotRole) !== currentValue)
          .map((asset) => renderAssetSelectOption(asset, slotRole, currentValue)).join(''))
        : '';
      const dataAttrs = ' data-existing-asset-field="' + escapeAttr(fieldId) + '" data-asset-directive="' + escapeAttr(directive) + '" data-asset-role="' + escapeAttr(slotRole) + '" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-current-asset-path="' + escapeAttr(item.assetCurrentPath || item.path || '') + '" data-asset-original="' + escapeAttr(item.assetOriginal || '') + '"';
      return [
        '<div class="object-canvas-asset-picker-control object-canvas-asset-swap-control" data-object-canvas-asset-swap="true">',
        '<span>' + escapeHtml(t('assets.chooseIndexed', 'Indexed asset')) + '</span>',
        renderAssetSelectFilter(catalog),
        '<select data-object-canvas-asset-select="true"' + (deferOptions ? ' data-asset-select-deferred="' + escapeAttr(deferredId) + '"' : '') + dataAttrs + '>',
        showCurrentOption ? '<option value="' + escapeAttr(currentValue) + '" selected data-asset-search-text="' + escapeAttr(assetSearchText(item)) + '">' + escapeHtml(assetOptionLabel(item) || item.path || item.label || slotRole) + '</option>' : '',
        deferOptions ? '' : catalog.map((asset) => renderAssetSelectOption(asset, slotRole, currentValue)).join(''),
        '</select>',
        '</div>'
      ].join('');
    }

    function renderFlowAssetRemovalControl(asset, target) {
      const item = asset || {};
      const fieldId = String(item.assetEditFieldId || '').trim();
      if (fieldId && item.pendingAddition) {
        return [
          '<button type="button" class="object-canvas-asset-remove-control" data-object-canvas-action="clear_asset_addition" data-existing-asset-add-field="' + escapeAttr(fieldId) + '" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(item.role || '') + '" data-asset-directive="' + escapeAttr(item.replacementDirective || item.directive || '') + '" data-current-asset-path="' + escapeAttr(item.assetCurrentPath || item.path || '') + '">',
          escapeHtml(t('assets.clearPendingAddition', 'Cancel addition')),
          '</button>'
        ].join('');
      }
      if (!fieldId || !item.allowAssetRemoval || !item.replacementAvailable) {
        return '';
      }
      return [
        '<button type="button" class="' + assetRemovalButtonClass(item.pendingRemoval) + '" data-object-canvas-action="remove_asset_reference" data-existing-asset-field="' + escapeAttr(fieldId) + '" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(item.role || '') + '" data-asset-directive="' + escapeAttr(item.replacementDirective || item.directive || '') + '" data-current-asset-path="' + escapeAttr(item.assetCurrentPath || item.path || '') + '" data-asset-original="' + escapeAttr(item.assetOriginal || '') + '"' + assetRemovalStateAttrs(item.pendingRemoval) + '>',
        assetRemovalButtonLabel(item.pendingRemoval),
        '</button>'
      ].join('');
    }

    function renderAssetAddFieldControls(field, target, options) {
      const role = String(field && field.role || field && field.assetRole || 'event_illustration').trim();
      const directive = String(field && field.directive || field && field.assetDirective || 'inline-image').trim();
      const fieldId = String(field && field.id || '').trim();
      if (!fieldId || !role || !directive) {
        return '';
      }
      const catalog = assetCatalogForSlot(options && options.assetCatalog, {
        type: field.type || field.assetType || 'image',
        role,
        preferredAssetPaths: preferredAssetPathsForField(field, options)
      });
      const label = assetAddFieldLabel(field);
      const fieldAttrs = field.draftPlacement
        ? ' data-object-canvas-asset-placement-id="' + escapeAttr(field.placementId || fieldId) + '" data-asset-placement-kind="' + escapeAttr(field.placementKind || '') + '" data-asset-section-id="' + escapeAttr(field.sectionId || '') + '" data-asset-option-id="' + escapeAttr(field.optionId || '') + '" data-asset-display-location="' + escapeAttr(field.displayLocation || '') + '" data-asset-directive="' + escapeAttr(directive) + '"'
        : ' data-existing-asset-add-field="' + escapeAttr(fieldId) + '" data-asset-directive="' + escapeAttr(directive) + '"';
      const deferOptions = ensureArray(catalog).length >= ASSET_SELECT_DEFER_THRESHOLD;
      const deferredId = deferOptions
        ? stashDeferredAssetOptions(() => ensureArray(catalog).map((asset) => renderAssetSelectOption(asset, role)).join(''))
        : '';
      return [
        '<div class="object-canvas-flow-asset-add" data-object-canvas-flow-asset-add="true" data-asset-placement-kind="' + escapeAttr(field.placementKind || '') + '">',
        '<span>' + escapeHtml(label) + '</span>',
        '<div class="object-canvas-asset-picker-control">',
        '<span>' + escapeHtml(t('assets.chooseIndexed', 'Indexed asset')) + '</span>',
        renderAssetSelectFilter(catalog),
        '<select data-object-canvas-asset-select="true"' + (deferOptions ? ' data-asset-select-deferred="' + escapeAttr(deferredId) + '"' : '') + ' data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(role) + '"' + fieldAttrs + '>',
        '<option value="">' + escapeHtml(t('assets.slotEmpty', 'No asset selected for this slot.')) + '</option>',
        deferOptions ? '' : catalog.map((asset) => renderAssetSelectOption(asset, role)).join(''),
        '</select>',
        '</div>',
        '<label class="object-canvas-asset-picker-control">',
        '<span>' + escapeHtml(t('assets.localFile', 'Local file')) + '</span>',
        '<input type="file" accept="' + escapeAttr((field.type || field.assetType) === 'audio' ? 'audio/*' : 'image/*') + '" data-object-canvas-asset-file="true" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(role) + '"' + fieldAttrs + '>',
        '</label>',
        '</div>'
      ].join('');
    }

    function renderPreviewAssets(assets, target, options) {
      const rows = ensureArray(assets).filter((asset) => asset && (asset.path || asset.label || asset.name));
      const opts = options || {};
      const normalizedTarget = target === 'card' ? 'card' : 'event';
      const globalRows = rows.filter((asset) => !isFlowAsset(asset));
      const flowRows = rows.filter(isFlowAsset);
      const flowAddFields = ensureArray(opts.assetAddFields).filter(isFlowAssetAddField);
      const slots = assetSlotsForRows(globalRows, normalizedTarget, opts);
      const flowAddControls = opts.showControls
        ? flowAddFields.map((field) => renderAssetAddFieldControls(field, normalizedTarget, opts)).join('')
        : renderFlowAssetAddSummary(flowAddFields);
      if (!rows.length && !slots.length && !flowAddFields.length && !opts.forcePanel) {
        return '';
      }
      return [
        '<section class="object-editing-preview-assets preview-object-assets object-canvas-assets-panel" data-object-editing-preview-assets="true" data-preview-object-assets="true" data-object-canvas-assets-panel="true" data-asset-target="' + escapeAttr(normalizedTarget) + '">',
        '<span class="object-editing-preview-group-label">' + escapeHtml(t('previewObjectEditor.assets', 'Referenced assets')) + '</span>',
        renderPreviewAssetSlots(slots, normalizedTarget, opts),
        renderGlobalAssetRows(globalRows, normalizedTarget),
        flowRows.length || flowAddFields.length ? '<div class="object-canvas-asset-row-grid" data-object-canvas-flow-asset-summary="true"><small>' + escapeHtml(t('assets.flowAssets', 'Flow assets')) + '</small>' + flowRows.slice(0, 8).map((asset) => renderFlowAssetRow(asset, normalizedTarget, opts)).join('') + flowAddControls + '</div>' : '',
        rows.length > 8 ? '<button type="button" class="object-canvas-expand-assets-btn" data-object-canvas-action="toggle_preview_expanded">' + escapeHtml(t('previewObjectEditor.moreAssets', 'More assets') + ': +' + String(rows.length - 8)) + '</button>' : '',
        '</section>'
      ].join('');
    }

    function renderFlowAssetAddSummary(fields) {
      const count = ensureArray(fields).length;
      if (!count) {
        return '';
      }
      return [
        '<div class="object-canvas-flow-asset-add-summary" data-object-canvas-flow-asset-add-summary="true">',
        '<span>' + escapeHtml(t('assets.flowAddSummary', 'Add controls are available in {count} flow locations.').replace('{count}', String(count))) + '</span>',
        '<small>' + escapeHtml(t('assets.flowAddSummaryHint', 'Use the matching option result, branch, or section to add a flow-positioned image.')) + '</small>',
        '</div>'
      ].join('');
    }

    function renderPreviewAssetSlots(slots, target, options) {
      const opts = options || {};
      if (!slots.length) {
        return '';
      }
      return [
        '<div class="object-canvas-asset-slot-grid" data-object-canvas-asset-slots="true">',
        slots.map((slot) => [
          '<article class="object-canvas-asset-slot' + (isAudioSlotRole(slot.role) ? ' is-audio-slot' : '') + '" data-object-canvas-asset-slot="true" data-asset-slot-role="' + escapeAttr(slot.role || '') + '" data-asset-slot-status="' + escapeAttr(slot.status || 'empty') + '">',
          '<strong>' + escapeHtml(t('assets.role.' + slot.role, slot.roleLabel || slot.label || slot.role || t('previewObjectEditor.asset', 'Asset'))) + '</strong>',
          '<small>' + escapeHtml(t('assets.type.' + (slot.type || 'asset'), slot.type || 'asset')) + '</small>',
          renderAudioModifierBadges(slot.assetRef),
          slot.assetRef && slot.assetRef.path ? '<code>' + escapeHtml(slot.assetRef.path) + '</code>' : '<span>' + escapeHtml(t('assets.slotEmpty', 'No asset selected for this slot.')) + '</span>',
          slot.installRequest ? '<em>' + escapeHtml(slot.installRequest.sourceName || slot.installRequest.sourcePath || t('assets.sourcePending', 'Source file selected in this browser session')) + '</em>' : '',
          opts.showControls || opts.showAddControls && slot.addField && !(slot.assetRef && slot.assetRef.path) ? renderAssetSlotControls(slot, target, opts) : '',
          opts.showReplacementControls ? renderAssetReplacementControl(slot, target, opts) : '',
          opts.showReplacementControls ? renderAssetRemovalControl(slot, target) : '',
          '</article>'
        ].join('')).join(''),
        '</div>'
      ].join('');
    }

    function assetSlotsForRows(rows, target, options) {
      const api = assetModelApi();
      if (!api || typeof api.buildAssetSlots !== 'function') {
        return [];
      }
      const opts = options || {};
      const assetRefs = ensureArray(rows).filter((row) => row && row.rowKind !== 'asset_install_request').map((row) => Object.assign({}, row.assetRef || {}, {
        path: row.path || row.assetRef && row.assetRef.path || '',
        type: row.type || row.assetRef && row.assetRef.type || '',
        label: row.label || row.assetRef && row.assetRef.label || '',
        role: row.role || row.assetRef && row.assetRef.role || '',
        directive: row.directive || row.assetRef && row.assetRef.directive || '',
        previewUrl: row.previewUrl || row.assetRef && row.assetRef.previewUrl || '',
        fileExists: row.fileExists,
        audioModifiers: row.audioModifiers || row.assetRef && row.assetRef.audioModifiers || [],
        audioGroupId: row.audioGroupId || row.assetRef && row.assetRef.audioGroupId || ''
      }));
      const assetInstallRequests = ensureArray(rows).filter((row) => row && row.installRequest).map((row) => row.installRequest);
      return api.buildAssetSlots({assetRefs, assetInstallRequests}, {target}).map((slot) => {
        const matchingRow = ensureArray(rows).find((row) => row && row.role === slot.role);
        const addField = assetSlotAddField(ensureArray(opts.assetAddFields), slot);
        if (!matchingRow || !slot.assetRef) {
          return Object.assign({}, slot, {addField});
        }
        return Object.assign({}, slot, {
          status: slot.installRequest ? 'pending_install' : (matchingRow.status || matchingRow.referenceState && matchingRow.referenceState.key || slot.status),
          addField,
          assetRef: Object.assign({}, slot.assetRef, {
            assetEditFieldId: matchingRow.assetEditFieldId || '',
            assetEditability: matchingRow.assetEditability || matchingRow.editability || '',
            assetOriginal: matchingRow.assetOriginal || '',
            assetCurrentPath: matchingRow.assetCurrentPath || matchingRow.path || '',
            source: matchingRow.source || slot.assetRef.source || null,
            sourcePath: matchingRow.sourcePath || '',
            replacementDirective: matchingRow.replacementDirective || matchingRow.directive || slot.assetRef.directive || '',
            allowAssetRemoval: Boolean(matchingRow.allowAssetRemoval),
            pendingRemoval: Boolean(matchingRow.pendingRemoval),
            pendingAddition: Boolean(matchingRow.pendingAddition),
            replacementAvailable: Boolean(matchingRow.replacementAvailable)
          })
        });
      });
    }

    function assetSlotAddField(fields, slot) {
      const role = String(slot && slot.role || '').trim();
      if (!role) {
        return null;
      }
      return ensureArray(fields).find((field) => {
        if (!field || String(field.role || '') !== role) {
          return false;
        }
        const id = String(field.id || '');
        if (id.indexOf('asset_add_flow_') === 0) {
          return false;
        }
        if (String(field.sectionId || '').trim() || String(field.optionId || '').trim()) {
          return false;
        }
        const kind = String(field.placementKind || 'global_slot');
        return kind === 'global_slot' || (role === 'event_illustration' && kind === 'opening_visual');
      }) || null;
    }

    function renderAssetSlotControls(slot, target, options) {
      const role = String(slot && slot.role || '').trim();
      if (!role) {
        return '';
      }
      const catalog = assetCatalogForSlot(options && options.assetCatalog, slot);
      const currentValue = assetSelectValue(slot.assetRef, role);
      const addField = slot && slot.addField || null;
      const fieldAttrs = addField
        ? ' data-existing-asset-add-field="' + escapeAttr(addField.id || '') + '" data-asset-directive="' + escapeAttr(addField.directive || '') + '"'
        : '';
      const deferOptions = ensureArray(catalog).length >= ASSET_SELECT_DEFER_THRESHOLD;
      const currentInCatalog = catalog.some((asset) => sourceReferencePathForAsset(asset && asset.path) === sourceReferencePathForAsset(slot.assetRef && slot.assetRef.path));
      // When deferring, surface the current selection up front so the control
      // shows the right value before its options are populated on focus; the
      // deferred batch then excludes it so the dropdown has no duplicate row.
      const showCurrentOption = currentValue && (deferOptions ? true : !currentInCatalog);
      const deferredId = deferOptions
        ? stashDeferredAssetOptions(() => ensureArray(catalog)
          .filter((asset) => !currentValue || assetSelectValue(asset, role) !== currentValue)
          .map((asset) => renderAssetSelectOption(asset, role, currentValue)).join(''))
        : '';
      return [
        '<div class="object-canvas-asset-picker-control">',
        '<span>' + escapeHtml(t('assets.chooseIndexed', 'Indexed asset')) + '</span>',
        renderAssetSelectFilter(catalog),
        '<select data-object-canvas-asset-select="true"' + (deferOptions ? ' data-asset-select-deferred="' + escapeAttr(deferredId) + '"' : '') + ' data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(role) + '"' + fieldAttrs + '>',
        '<option value="">' + escapeHtml(t('assets.slotEmpty', 'No asset selected for this slot.')) + '</option>',
        showCurrentOption ? '<option value="' + escapeAttr(currentValue) + '" selected data-asset-search-text="' + escapeAttr(assetSearchText(slot.assetRef)) + '">' + escapeHtml(assetOptionLabel(slot.assetRef) || slot.assetRef.path || slot.assetRef.label || role) + '</option>' : '',
        deferOptions ? '' : catalog.map((asset) => renderAssetSelectOption(asset, role, currentValue)).join(''),
        '</select>',
        '</div>',
        '<label class="object-canvas-asset-picker-control">',
        '<span>' + escapeHtml(t('assets.localFile', 'Local file')) + '</span>',
        '<input type="file" accept="' + escapeAttr(slot.type === 'audio' ? 'audio/*' : 'image/*') + '" data-object-canvas-asset-file="true" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(role) + '"' + fieldAttrs + '>',
        '</label>',
        renderAudioModifierToggles(slot, addField)
      ].join('');
    }

    function renderAudioModifierToggles(slot, addField) {
      var directive = String(slot && slot.directive || addField && addField.directive || '').trim();
      if (directive !== 'audio') { return ''; }
      var keywords = ['loop', 'queue', 'shuffle', 'nofade'];
      var existing = ensureArray(slot && slot.assetRef && slot.assetRef.audioModifiers);
      var fieldId = addField && addField.id || '';
      return [
        '<fieldset class="object-canvas-audio-modifier-toggles" data-audio-modifier-fieldset="true" data-audio-modifier-field-id="' + escapeAttr(fieldId) + '">',
        '<legend>' + escapeHtml(t('assets.audioModifiers', 'Audio modifiers')) + '</legend>',
        keywords.map(function (kw) {
          var checked = existing.indexOf(kw) >= 0 ? ' checked' : '';
          return '<label><input type="checkbox" value="' + escapeAttr(kw) + '" data-audio-modifier-toggle="' + escapeAttr(kw) + '"' + checked + '> ' + escapeHtml(kw) + '</label>';
        }).join(''),
        '</fieldset>'
      ].join('');
    }

    function renderAssetReplacementControl(slot, target, options) {
      const ref = slot && slot.assetRef || {};
      const role = String(slot && slot.role || ref.role || '').trim();
      const fieldId = String(ref.assetEditFieldId || '').trim();
      const directive = String(ref.replacementDirective || ref.directive || '').trim();
      if (!role || !fieldId || !directive || !ref.replacementAvailable) {
        return '';
      }
      return [
        renderExistingAssetSwapControl(ref, role, slot && slot.type, target, options),
        '<label class="object-canvas-asset-picker-control object-canvas-asset-replacement-control" data-object-canvas-asset-replacement="true">',
        '<span>' + escapeHtml(t('assets.replaceFile', 'Replacement file')) + '</span>',
        '<input type="file" accept="' + escapeAttr(slot.type === 'audio' ? 'audio/*' : 'image/*') + '" data-object-canvas-asset-file="true" data-existing-asset-field="' + escapeAttr(fieldId) + '" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(role) + '" data-asset-directive="' + escapeAttr(directive) + '" data-current-asset-path="' + escapeAttr(ref.assetCurrentPath || ref.path || '') + '" data-asset-original="' + escapeAttr(ref.assetOriginal || '') + '">',
        '</label>'
      ].join('');
    }

    function renderAssetRemovalControl(slot, target) {
      const ref = slot && slot.assetRef || {};
      const fieldId = String(ref.assetEditFieldId || '').trim();
      if (fieldId && ref.pendingAddition) {
        return [
          '<button type="button" class="object-canvas-asset-remove-control" data-object-canvas-action="clear_asset_addition" data-existing-asset-add-field="' + escapeAttr(fieldId) + '" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(slot && slot.role || ref.role || '') + '" data-asset-directive="' + escapeAttr(ref.replacementDirective || ref.directive || '') + '" data-current-asset-path="' + escapeAttr(ref.assetCurrentPath || ref.path || '') + '">',
          escapeHtml(t('assets.clearPendingAddition', 'Cancel addition')),
          '</button>'
        ].join('');
      }
      if (!fieldId || !ref.allowAssetRemoval || !ref.replacementAvailable) {
        return '';
      }
      return [
        '<button type="button" class="' + assetRemovalButtonClass(ref.pendingRemoval) + '" data-object-canvas-action="remove_asset_reference" data-existing-asset-field="' + escapeAttr(fieldId) + '" data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '" data-asset-role="' + escapeAttr(slot && slot.role || ref.role || '') + '" data-asset-directive="' + escapeAttr(ref.replacementDirective || ref.directive || '') + '" data-current-asset-path="' + escapeAttr(ref.assetCurrentPath || ref.path || '') + '" data-asset-original="' + escapeAttr(ref.assetOriginal || '') + '"' + assetRemovalStateAttrs(ref.pendingRemoval) + '>',
        assetRemovalButtonLabel(ref.pendingRemoval),
        '</button>'
      ].join('');
    }

    function assetRemovalButtonClass(pendingRemoval) {
      return 'object-canvas-asset-remove-control' + (pendingRemoval ? ' is-pending-removal' : '');
    }

    function assetRemovalStateAttrs(pendingRemoval) {
      return ' data-asset-removal-state="' + (pendingRemoval ? 'pending' : 'idle') + '" aria-pressed="' + (pendingRemoval ? 'true' : 'false') + '"';
    }

    function assetRemovalButtonLabel(pendingRemoval) {
      return escapeHtml(pendingRemoval ? t('assets.restoreReference', 'Undo removal') : t('assets.removeReference', 'Remove reference'));
    }

    function assetCatalogForSlot(catalog, slot) {
      const type = String(slot && slot.type || '').trim();
      const role = String(slot && slot.role || '').trim();
      const preferredKeys = preferredAssetKeySet(slot);
      return ensureArray(catalog).filter((asset) => {
        const assetType = String(asset && asset.type || '').trim();
        return asset && (asset.path || asset.id) && (!type || !assetType || assetType === type);
      }).map((asset, index) => ({
        asset,
        index,
        score: assetCatalogScore(asset, role, preferredKeys)
      })).sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }
        const aLabel = String(a.asset && (a.asset.label || a.asset.name || a.asset.path || a.asset.id) || '');
        const bLabel = String(b.asset && (b.asset.label || b.asset.name || b.asset.path || b.asset.id) || '');
        return aLabel.localeCompare(bLabel) || a.index - b.index;
      }).map((row) => row.asset);
    }

    function assetCatalogScore(asset, role, preferredKeys) {
      const item = asset || {};
      const keys = assetPreferenceKeys(item);
      const preferred = keys.some((key) => preferredKeys.has(key)) ? 1000 : 0;
      const roleMatch = role && String(item.role || '').trim() === role ? 40 : 0;
      const path = String(item.path || item.targetPath || item.id || '').toLowerCase();
      const eventMedia = /(^|\/)(img|images|assets)\/.*\.(png|jpe?g|webp|gif)$/i.test(path) ? 8 : 0;
      return preferred + roleMatch + eventMedia;
    }

    function preferredAssetPathsForField(field, options) {
      const paths = ensureArray(field && field.preferredAssetPaths).map(String);
      ensureArray(options && options.relatedAssets).forEach((asset) => {
        const path = String(asset && (asset.path || asset.targetPath || asset.assetCurrentPath || '') || '').trim();
        if (path) {
          paths.push(path);
        }
      });
      return paths;
    }

    function preferredAssetKeySet(source) {
      const keys = new Set();
      ensureArray(source && source.preferredAssetPaths).forEach((path) => {
        assetPreferenceKeys({path}).forEach((key) => keys.add(key));
      });
      ensureArray(source && source.relatedAssets).forEach((asset) => {
        assetPreferenceKeys(asset).forEach((key) => keys.add(key));
      });
      assetPreferenceKeys(source).forEach((key) => keys.add(key));
      return keys;
    }

    function assetPreferenceKeys(asset) {
      const item = asset || {};
      const raw = [
        item.path,
        item.targetPath,
        item.assetCurrentPath,
        item.label,
        item.name,
        item.id
      ].map((value) => String(value || '').trim()).filter(Boolean);
      const keys = [];
      raw.forEach((value) => {
        const normalized = value.replace(/\\/g, '/').toLowerCase();
        keys.push(normalized);
        const file = normalized.split('/').filter(Boolean).pop();
        if (file) {
          keys.push(file);
        }
      });
      return keys;
    }

    function assetAddFieldLabel(field) {
      const kind = String(field && field.placementKind || '').trim();
      if (kind === 'option_result_visual') {
        return t('assets.addToOptionResult', 'Add image to option result');
      }
      if (kind === 'conditional_visual') {
        return t('assets.addToConditional', 'Add image to conditional branch');
      }
      if (kind === 'menu_visual') {
        return t('assets.addToMenu', 'Add image to menu branch');
      }
      if (kind === 'opening_visual') {
        return t('assets.addToOpening', 'Add opening image');
      }
      if (kind === 'section_visual') {
        return t('assets.addToSection', 'Add image to this section');
      }
      return String(field && field.label || '').trim() || t('assets.addHere', 'Add image here');
    }

    function assetSelectValue(asset, role) {
      const item = asset || {};
      const rawPath = String(item.path || item.targetPath || '').trim();
      const path = sourceReferencePathForAsset(rawPath);
      if (!path) {
        return '';
      }
      return JSON.stringify({
        path,
        previewUrl: String(item.previewUrl || item.url || rawPath).trim(),
        type: String(item.type || 'asset').trim(),
        label: String(item.label || item.name || path).trim(),
        role: String(role || item.role || '').trim()
      });
    }

    function renderAssetSelectFilter(catalog) {
      const count = ensureArray(catalog).length;
      if (count < ASSET_SELECT_DEFER_THRESHOLD) {
        return '';
      }
      return [
        '<input class="object-canvas-asset-filter" type="search" data-object-canvas-asset-filter="true" placeholder="' + escapeAttr(t('assets.filterIndexed', 'Filter asset path or filename')) + '" aria-label="' + escapeAttr(t('assets.filterIndexed', 'Filter asset path or filename')) + '" autocomplete="off" spellcheck="false">',
        '<small class="object-canvas-asset-picker-count" data-object-canvas-asset-picker-count="true">' + escapeHtml(t('assets.indexedCount', '{count} indexed assets').replace('{count}', String(count))) + '</small>'
      ].join('');
    }

    function renderAssetSelectOption(asset, role, currentValue) {
      const value = assetSelectValue(asset, role);
      if (!value) {
        return '';
      }
      const selected = currentValue && value === currentValue ? ' selected' : '';
      return '<option value="' + escapeAttr(value) + '"' + selected + ' data-asset-search-text="' + escapeAttr(assetSearchText(asset)) + '">' + escapeHtml(assetOptionLabel(asset)) + '</option>';
    }

    function assetOptionLabel(asset) {
      const item = asset || {};
      const path = sourceReferencePathForAsset(item.path || item.targetPath || item.assetCurrentPath || '');
      const label = String(item.label || item.name || '').trim();
      if (label && path && label !== path) {
        return label + ' / ' + path;
      }
      return label || path || String(item.id || '').trim();
    }

    function assetSearchText(asset) {
      const item = asset || {};
      return assetPreferenceKeys(item).concat([
        sourceReferencePathForAsset(item.path || ''),
        sourceReferencePathForAsset(item.targetPath || ''),
        sourceReferencePathForAsset(item.assetCurrentPath || ''),
        assetOptionLabel(item)
      ]).join(' ').toLowerCase();
    }

    function sourceReferencePathForAsset(value) {
      const path = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
      return path.replace(/^out\/html\//i, '');
    }

    function renderPreviewAsset(asset, target) {
      const capability = asset && asset.previewCapability || {};
      const label = asset && (asset.label || asset.name || asset.path) || t('previewObjectEditor.asset', 'Asset');
      const role = asset && (asset.roleLabel || asset.role || asset.type) || capability.mediaKind || '';
      const state = asset && asset.referenceState && asset.referenceState.label ||
        asset && asset.statusLabel ||
        asset && asset.status && asset.status.label ||
        capability.message ||
        '';
      const source = sourceLabelFromRef(asset && asset.source);
      const previewMediaClass = capability.canPreview && (capability.mediaKind === 'image' || capability.mediaKind === 'audio') ? 'object-editing-preview-asset-figure' : 'object-editing-preview-asset-ref';
      const rowAttrs = previewAssetRowAttrs(asset, target, previewMediaClass);
      if (capability.canPreview && capability.mediaKind === 'image' && capability.url) {
        return [
          '<figure' + rowAttrs + '>',
          '<img src="' + escapeAttr(capability.url) + '" alt="' + escapeAttr(label) + '" loading="lazy">',
          '<figcaption>' + escapeHtml([role, label, state].filter(Boolean).join(' / ')) + '</figcaption>',
          source ? '<small>' + escapeHtml(source) + '</small>' : '',
          '</figure>'
        ].join('');
      }
      if (capability.canPreview && capability.mediaKind === 'audio' && capability.url) {
        return [
          '<figure' + rowAttrs + ' data-asset-preview-audio="true">',
          '<audio controls preload="metadata" src="' + escapeAttr(capability.url) + '"></audio>',
          renderAudioModifierBadges(asset),
          '<figcaption>' + escapeHtml([role, label, state].filter(Boolean).join(' / ')) + '</figcaption>',
          source ? '<small>' + escapeHtml(source) + '</small>' : '',
          '</figure>'
        ].join('');
      }
      return [
        '<div' + rowAttrs + '>',
        '<strong>' + escapeHtml(label) + '</strong>',
        role ? '<small>' + escapeHtml(role) + '</small>' : '',
        renderAudioModifierBadges(asset),
        asset && asset.path ? '<code>' + escapeHtml(asset.path) + '</code>' : '',
        state ? '<small>' + escapeHtml(state) + '</small>' : '',
        asset && asset.installRequest && asset.installRequest.sourceName ? '<small>' + escapeHtml(asset.installRequest.sourceName) + '</small>' : '',
        source ? '<small>' + escapeHtml(source) + '</small>' : '',
        '</div>'
      ].join('');
    }

    function previewAssetRowAttrs(asset, target, baseClass) {
      const rowKind = asset && asset.rowKind || 'asset_ref';
      const state = asset && asset.referenceState && asset.referenceState.key ||
        asset && asset.status && asset.status.key ||
        typeof (asset && asset.status) === 'string' && asset.status ||
        '';
      const classes = [baseClass, 'object-canvas-asset-row', 'asset-kind-' + safeClass(rowKind)].filter(Boolean).join(' ');
      return [
        ' class="' + escapeAttr(classes) + '"',
        ' data-preview-object-asset-row="true"',
        ' data-object-canvas-asset-row="true"',
        ' data-asset-target="' + escapeAttr(target === 'card' ? 'card' : 'event') + '"',
        ' data-asset-row-kind="' + escapeAttr(rowKind) + '"',
        ' data-asset-role="' + escapeAttr(asset && asset.role || '') + '"',
        ' data-asset-state="' + escapeAttr(state) + '"',
        asset && asset.directive ? ' data-asset-directive="' + escapeAttr(asset.directive) + '"' : ''
      ].join('');
    }

    function isAudioSlotRole(role) {
      return /audio|music/.test(String(role || ''));
    }

    function renderAudioModifierBadges(assetRef) {
      const modifiers = ensureArray(assetRef && assetRef.audioModifiers);
      if (!modifiers.length) {
        return '';
      }
      return '<span class="audio-modifier-badges">' + modifiers.map(function (mod) {
        return '<span class="audio-modifier-badge" data-audio-modifier="' + escapeAttr(mod) + '">' + escapeHtml(mod) + '</span>';
      }).join('') + '</span>';
    }

    function groupGlobalAudioRows(rows) {
      var items = [];
      var groupMap = {};
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var gid = row && (row.audioGroupId || row.assetRef && row.assetRef.audioGroupId) || '';
        if (!gid) {
          items.push({type: 'single', asset: row});
          continue;
        }
        if (groupMap[gid]) {
          groupMap[gid].members.push(row);
        } else {
          var group = {type: 'playlist', groupId: gid, members: [row]};
          groupMap[gid] = group;
          items.push(group);
        }
      }
      return items;
    }

    function renderAudioPlaylistGroup(group, target) {
      var members = group.members || [];
      if (members.length < 2) {
        return renderPreviewAsset(members[0], target);
      }
      var first = members[0] || {};
      var modifiers = ensureArray(first.audioModifiers || first.assetRef && first.assetRef.audioModifiers);
      var modLabel = modifiers.length
        ? ' <span class="audio-modifier-badges">' + modifiers.map(function (m) { return '<span class="audio-modifier-badge">' + escapeHtml(m) + '</span>'; }).join('') + '</span>'
        : '';
      var tracks = members.map(function (asset, idx) {
        var cap = asset && asset.previewCapability || {};
        var label = asset && (asset.label || asset.name || asset.path) || 'Track ' + (idx + 1);
        var audioTag = cap.canPreview && cap.mediaKind === 'audio' && cap.url
          ? '<audio controls preload="metadata" src="' + escapeAttr(cap.url) + '"></audio>'
          : '';
        return '<li data-audio-playlist-track="' + escapeAttr(String(idx)) + '">' + audioTag + '<span>' + escapeHtml(label) + '</span></li>';
      });
      var rowAttrs = previewAssetRowAttrs(first, target, 'object-editing-preview-asset-figure');
      return [
        '<figure' + rowAttrs + ' data-asset-preview-audio="true" data-audio-playlist-group="' + escapeAttr(group.groupId) + '">',
        '<strong class="audio-playlist-header">' + escapeHtml(t('previewObjectEditor.audioPlaylist', 'Audio playlist')) + ' (' + members.length + ')' + modLabel + '</strong>',
        '<ol class="audio-playlist-tracks">' + tracks.join('') + '</ol>',
        '</figure>'
      ].join('');
    }

    function renderGlobalAssetRows(globalRows, target) {
      if (!globalRows.length) { return ''; }
      var grouped = groupGlobalAudioRows(globalRows.slice(0, 8));
      var html = grouped.map(function (item) {
        return item.type === 'playlist'
          ? renderAudioPlaylistGroup(item, target)
          : renderPreviewAsset(item.asset, target);
      }).join('');
      return '<div class="object-canvas-asset-row-grid" data-object-canvas-global-assets="true">' + html + '</div>';
    }

    return {
      renderInlineAssetPlacements,
      renderPreviewAssets
    };
  }

  function defaultEnsureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function defaultSafeClass(value) {
    return String(value || 'item').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  }

  function defaultEscapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function defaultEscapeAttr(value) {
    return defaultEscapeHtml(value).replace(/`/g, '&#96;');
  }

  const api = {create, populateDeferredAssetSelect, materializeDeferredAssetOptions};

  if (global) {
    global.ProjectMapPreviewAssetEditor = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
