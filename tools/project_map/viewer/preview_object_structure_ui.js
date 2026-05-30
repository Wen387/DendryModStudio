(function initProjectMapPreviewObjectStructureUi(global) {
  'use strict';

  const moduleApi = {create};

  if (global) {
    global.ProjectMapPreviewObjectStructureUi = moduleApi;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = moduleApi;
  }

  function create(deps) {
    const d = deps && typeof deps === 'object' ? deps : {};
    const t = d.t;
    const escapeHtml = d.escapeHtml;
    const escapeAttr = d.escapeAttr;
    const ensureArray = d.ensureArray;
    const fieldId = d.fieldId;
    const fieldValue = d.fieldValue;
    const safeClass = d.safeClass;
    const statusFromEditability = d.statusFromEditability;
    const renderInlineField = d.renderInlineField;
    const logicFieldElement = d.logicFieldElement;
    const structureDraftApi = d.structureDraftApi;
    const displayFieldLabel = d.displayFieldLabel;

    return {
      bodyWithPendingStructure,
      pendingStructurePreview,
      renderStructureActionField,
      renderInlineAddAction,
      renderCompactStructureAction,
      firstStructureAction,
      triggerStructureActions,
      optionStructureActions,
      branchStructureActions,
      resultSectionActions,
      optionEffectGroup,
      structureActionMatchesOption,
      endpointTokenMatches,
      endpointTokenParts,
      structureActionContext,
      structureActionTarget,
      cleanStructureTargetLabel,
      structureActionSafetyLabel,
      isNewEventBody,
      renderAddOptionBuilder,
      renderAddBranchBuilder,
      renderEffectBuilder,
      renderStructureBuilder,
      structureActionHelp,
      builderInput,
      builderInputWithVariables,
      builderTextarea,
      builderSelect
    };

    function bodyWithPendingStructure(body) {
      const base = body && typeof body === 'object' ? body : {};
      const pending = pendingStructurePreview(base);
      if (!pending.options.length && !pending.branches.length && !pending.triggerEffects.length && !pending.optionEffects.length && !pending.removals.length) {
        return base;
      }
      return Object.assign({}, base, {
        options: ensureArray(base.options).concat(pending.options),
        branchSections: ensureArray(base.branchSections).concat(pending.branches),
        effects: ensureArray(base.effects).concat(pending.triggerEffects),
        optionEffects: ensureArray(base.optionEffects).concat(pending.optionEffects),
        pendingStructureRemovals: ensureArray(base.pendingStructureRemovals).concat(pending.removals)
      });
    }

    function pendingStructurePreview(body) {
      const pending = {
        options: [],
        branches: [],
        triggerEffects: [],
        optionEffects: [],
        removals: []
      };
      ensureArray(body && body.structureActions).forEach((field) => {
        const action = String(field && field.structureAction || '');
        const value = fieldValue(field).trim();
        if (field && field.inputType === 'checkbox') {
          if (/^(1|true|yes|on)$/i.test(value)) {
            pending.removals.push({
              action,
              fieldId: fieldId(field),
              optionId: String(field && field.optionId || ''),
              sectionId: String(field && field.sectionId || ''),
              label: String(field && (field.structureTargetLabel || field.label || '') || ''),
              before: String(field && field.structureBefore || field && field.original || '')
            });
          }
          return;
        }
        if (!value) {
          return;
        }
        if (action === 'add_option') {
          const draft = structureDraftApi().parseAddOptionDraft(value);
          const target = draft.target || structureDraftApi().slugForStructurePreview(draft.label) || 'new_option';
          const label = draft.label || t('previewObjectEditor.structureOptionTextPlaceholder', 'What the player clicks');
          const result = draft.result || '';
          const effect = draft.effect || {};
          const ownerSectionId = String(field && field.sectionId || '').trim();
          pending.options.push({
            id: 'draft_' + safeClass(fieldId(field) || target),
            targetId: target,
            rawTargetId: target,
            sectionId: ownerSectionId,
            sectionLabel: ownerSectionId ? String(field && (field.structureTargetLabel || field.label || ownerSectionId) || '') : '',
            label,
            chooseIf: draft.chooseIf || '',
            unavailableText: draft.unavailableText || '',
            isPendingStructure: true,
            fields: [{
              id: (fieldId(field) || target) + '_preview_label',
              label: t('previewObjectEditor.structureOptionText', 'Option text'),
              value: label,
              original: label,
              readOnly: true,
              status: 'manual'
            }].concat(effect && effect.variable ? [{
              id: (fieldId(field) || target) + '_preview_effect',
              role: 'effect',
              label: t('previewObjectEditor.structureChoiceEffectTitle', 'New choice effect'),
              value: 'Q.' + effect.variable + ' ' + (effect.op || '+=') + ' ' + effect.value + (effect.condition ? ' if ' + effect.condition : ''),
              original: 'Q.' + effect.variable + ' ' + (effect.op || '+=') + ' ' + effect.value + (effect.condition ? ' if ' + effect.condition : ''),
              readOnly: true,
              status: 'manual'
            }] : []),
            resultFields: result ? [{
              id: (fieldId(field) || target) + '_preview_result',
              label: t('previewObjectEditor.optionResult', 'Option result'),
              value: result,
              original: result,
              semanticRole: 'option_result_text',
              sectionId: target,
              sectionLabel: target,
              textVariables: structureDraftApi().variablesFromDendryText(result),
              readOnly: true,
              status: 'manual'
            }] : []
          });
          return;
        }
        if (action === 'add_branch') {
          const draft = structureDraftApi().parseBranchDraft(value);
          const section = draft.section || 'follow_up';
          const text = draft.text || '';
          const conditionVariables = structureDraftApi().variablesFromCondition(draft.condition);
          pending.branches.push({
            id: (fieldId(field) || section) + '_preview_branch',
            label: draft.condition
              ? t('previewObjectEditor.conditionalText', 'Conditional text')
              : t('previewObjectEditor.followUpPage', 'Follow-up page'),
            value: draft.condition
              ? '[? if ' + draft.condition + ' : ' + (text || t('previewObjectEditor.structureBranchTextPlaceholder', 'Conditional or follow-up prose')) + ' ?]'
              : (text || t('previewObjectEditor.structureBranchTextPlaceholder', 'Conditional or follow-up prose')),
            original: text,
            semanticRole: draft.condition ? 'conditional_text' : 'section_text',
            branchKind: draft.condition ? 'conditional' : 'section',
            sectionId: section,
            sectionLabel: section,
            conditions: draft.condition ? [draft.condition] : [],
            conditionVariables,
            logicContext: conditionVariables.length ? {conditions: [{raw: draft.condition, variables: conditionVariables}], reads: conditionVariables, conditionVariables, textVariables: []} : null,
            readOnly: true,
            status: 'manual'
          });
          return;
        }
        if (action === 'add_trigger_effect') {
          pending.triggerEffects.push(Object.assign({}, field, {
            value,
            original: value,
            label: t('previewObjectEditor.structureTriggerEffectTitle', 'New on-arrival effect'),
            status: field && field.status || statusFromEditability(field && field.editability) || 'manual'
          }));
          return;
        }
        if (action === 'add_option_effect') {
          const target = String(field && (field.optionId || field.sectionId || field.structureTargetLabel || field.label) || '').trim();
          pending.optionEffects.push({
            id: target,
            label: String(field && (field.structureTargetLabel || field.label || target) || ''),
            fields: [Object.assign({}, field, {
              value,
              original: value,
              label: t('previewObjectEditor.structureChoiceEffectTitle', 'New choice effect'),
              status: field && field.status || statusFromEditability(field && field.editability) || 'manual'
            })]
          });
        }
      });
      return pending;
    }

    function renderStructureActionField(field, body) {
      if (field && field.isQueuedStructure) {
        return renderInlineField(field, {
          role: 'structure-pending',
          element: logicFieldElement(field),
          forceReadOnly: true
        });
      }
      const action = String(field && field.structureAction || '');
      if (action === 'add_option') {
        return renderAddOptionBuilder(field, body);
      }
      if (action === 'add_branch') {
        return renderAddBranchBuilder(field, body);
      }
      if (action === 'add_trigger_effect' || action === 'add_option_effect') {
        return renderEffectBuilder(field, action, body);
      }
      return renderInlineField(field, {
        role: 'structure',
        element: logicFieldElement(field)
      });
    }

    function renderInlineAddAction(field, body) {
      const queued = Boolean(field && field.isQueuedStructure);
      const target = structureActionTarget(field);
      return [
        '<details class="preview-object-inline-add' + (queued ? ' is-pending-addition' : '') + '" data-preview-object-inline-add="' + escapeAttr(String(field && field.structureAction || 'add')) + '"' + (queued ? ' open' : '') + '>',
        '<summary><span>+</span><b>' + escapeHtml(displayFieldLabel(field, field && field.label || '')) + '</b>' + (target ? '<small class="preview-object-inline-add-target" title="' + escapeAttr(target.title) + '">' + escapeHtml(target.label) + '</small>' : '') + (queued ? '<small>' + escapeHtml(t('previewObjectEditor.pendingAdd', 'Pending addition')) + '</small>' : '') + '</summary>',
        renderStructureActionField(field, body),
        '</details>'
      ].join('');
    }

    function renderCompactStructureAction(field, body) {
      const action = String(field && field.structureAction || '');
      if (/^add_/.test(action)) {
        return renderInlineAddAction(field, body);
      }
      const id = fieldId(field);
      const original = field && field.original !== undefined ? String(field.original || '') : 'false';
      const rawLabel = String(field && field.label || '');
      const title = rawLabel ? ' title="' + escapeAttr(rawLabel) + '"' : '';
      const context = structureActionContext(field);
      const safety = structureActionSafetyLabel(body, field);
      return [
        '<label class="preview-object-structure-delete preview-object-action-' + escapeAttr(safeClass(action || 'remove')) + '"' + title + '>',
        id ? '<input type="checkbox" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '" data-object-canvas-original="' + escapeAttr(original) + '">' : '',
        '<span>' + escapeHtml(displayFieldLabel(field, rawLabel)) + '</span>',
        context ? '<small>' + escapeHtml(context) + '</small>' : '',
        safety ? '<small class="preview-object-structure-safety">' + escapeHtml(safety) + '</small>' : '',
        '</label>'
      ].join('');
    }

    function firstStructureAction(body, action) {
      return ensureArray(body && body.structureActions).find((field) => String(field && field.structureAction || '') === action) || null;
    }

    function triggerStructureActions(body) {
      return ensureArray(body && body.structureActions).filter((field) => {
        const action = String(field && field.structureAction || '');
        if (action === 'add_trigger_effect') {
          return true;
        }
        return action === 'remove_effect' &&
          !String(field && field.optionId || '').trim() &&
          !String(field && field.sectionId || '').trim();
      });
    }

    function optionStructureActions(option, body) {
      return ensureArray(body && body.structureActions).filter((field) => {
        const action = String(field && field.structureAction || '');
        if (!['add_option_effect', 'remove_option', 'remove_option_condition', 'remove_effect', 'move_option_up', 'move_option_down'].includes(action)) {
          return false;
        }
        return structureActionMatchesOption(field, option);
      });
    }

    function branchStructureActions(field, body) {
      return ensureArray(body && body.structureActions).filter((actionField) => {
        const action = String(actionField && actionField.structureAction || '');
        if (action !== 'remove_layer' && action !== 'add_option') {
          return false;
        }
        const section = String(field && field.sectionId || field && field.id || '').trim();
        const actionSection = String(actionField && actionField.sectionId || '').trim();
        return Boolean(section && actionSection && section === actionSection);
      });
    }

    function resultSectionActions(fields, body) {
      const sectionIds = new Set(ensureArray(fields).map((field) => String(field && field.sectionId || '').trim()).filter(Boolean));
      if (!sectionIds.size) {
        return [];
      }
      const seen = new Set();
      return ensureArray(body && body.structureActions).filter((actionField) => {
        const action = String(actionField && actionField.structureAction || '');
        const section = String(actionField && actionField.sectionId || '').trim();
        const key = String(actionField && actionField.id || '') + '::' + section;
        if (action !== 'add_option' || !sectionIds.has(section) || seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
    }

    function optionEffectGroup(option, body) {
      return ensureArray(body && body.optionEffects).find((group) => structureActionMatchesOption(group, option)) || null;
    }

    function structureActionMatchesOption(field, option) {
      const action = String(field && field.structureAction || '');
      const optionIds = [
        option && option.id,
        option && option.optionId,
        option && option.targetId,
        option && option.rawTargetId
      ].map((value) => String(value || '').trim()).filter(Boolean);
      const labels = [
        option && option.label,
        option && option.title
      ].map((value) => String(value || '').trim()).filter(Boolean);
      const optionActionIds = [
        field && field.optionId,
        field && field.itemId,
        field && field.targetId,
        field && field.rawTargetId
      ].map((value) => String(value || '').trim()).filter(Boolean);
      if (optionActionIds.length) {
        return optionActionIds.some((id) => optionIds.some((optionId) => endpointTokenMatches(id, optionId)));
      }
      const actionIds = [
        field && field.id,
        field && field.optionId,
        field && field.sectionId
      ].map((value) => String(value || '').trim()).filter(Boolean);
      const target = String(field && (field.structureTargetLabel || field.label) || '').trim();
      if (['remove_option', 'remove_option_condition', 'add_option_effect', 'remove_effect'].includes(action)) {
        return Boolean(target && labels.some((label) => target === label));
      }
      return actionIds.some((id) => optionIds.includes(id)) ||
        Boolean(target && labels.some((label) => target === label || target.includes(label)));
    }

    function endpointTokenMatches(left, right) {
      const leftValue = endpointTokenParts(left);
      const rightValue = endpointTokenParts(right);
      if (!leftValue.local || !rightValue.local) {
        return false;
      }
      if (leftValue.full === rightValue.full) {
        return true;
      }
      if (leftValue.qualified && rightValue.qualified) {
        return false;
      }
      return leftValue.local === rightValue.local;
    }

    function endpointTokenParts(value) {
      const text = String(value || '').trim().replace(/^[@#]/, '');
      const parts = text.split('.');
      return {
        full: text,
        local: parts[parts.length - 1] || '',
        qualified: parts.length > 1
      };
    }

    function structureActionContext(field) {
      const action = String(field && field.structureAction || '');
      const target = String(field && (field.structureTargetLabel || field.optionId || field.sectionId) || '').trim();
      const before = String(field && field.structureBefore || '').trim().split(/\r?\n/).filter(Boolean)[0] || '';
      if (action === 'remove_effect' && before) {
        return before;
      }
      return target;
    }

    function structureActionTarget(field) {
      const action = String(field && field.structureAction || '');
      if (action !== 'add_option' || !(field && field.sectionId)) {
        return null;
      }
      const sectionId = String(field.sectionId || '').trim();
      const localId = sectionId ? '@' + (sectionId.includes('.') ? sectionId.split('.').pop() : sectionId) : '';
      const rawLabel = String(field.structureTargetLabel || field.label || '').trim();
      const label = cleanStructureTargetLabel(rawLabel);
      const target = label && label !== sectionId && label !== localId
        ? [localId, label].filter(Boolean).join(' / ')
        : (localId || label || sectionId);
      return {
        label: t('previewObjectEditor.addToSection', 'Add to') + ': ' + target,
        title: sectionId || target
      };
    }

    function cleanStructureTargetLabel(value) {
      return String(value || '')
        .replace(/^add option to section:\s*/i, '')
        .replace(/^option result:\s*/i, '')
        .trim();
    }

    function structureActionSafetyLabel(body, field) {
      if (isNewEventBody(body)) {
        return t('previewObjectEditor.structureDraftNotice', 'Updates the current draft.');
      }
      const action = String(field && field.structureAction || '');
      const editability = String(field && field.editability || '');
      if (action === 'add_option' && editability === 'guarded_apply') {
        return t('previewObjectEditor.structureGuardedOptionNotice', 'Simple source-backed options can be applied automatically after review.');
      }
      if ((action === 'add_option_effect' || action === 'add_trigger_effect') && editability === 'guarded_apply') {
        return t('previewObjectEditor.structureGuardedEffectNotice', 'Simple source-backed Q effects can be applied automatically after review.');
      }
      if ((action === 'add_option_effect' || action === 'add_trigger_effect') && editability === 'advanced_source_patch') {
        return t('previewObjectEditor.structureAdvancedEffectNotice', 'Source-backed conditional or script-adjacent effects can be applied after advanced confirmation.');
      }
      if (/^remove_/.test(action) && editability === 'guarded_apply') {
        return t('previewObjectEditor.structureGuardedNotice', 'This source-backed structural change can be applied automatically after review.');
      }
      if (/^remove_/.test(action) && editability === 'advanced_source_patch') {
        return t('previewObjectEditor.structureAdvancedNotice', 'Source-backed deletion can be applied after advanced confirmation.');
      }
      return t('previewObjectEditor.structureManualNotice', 'Manual review only; Studio will not change source automatically.');
    }

    function isNewEventBody(body) {
      const value = body && typeof body === 'object' ? body : {};
      const structure = value.eventStructure || {};
      return String(value.mode || structure.mode || '') === 'new_event';
    }

    function renderAddOptionBuilder(field, body) {
      const draft = structureDraftApi().parseAddOptionDraft(fieldValue(field));
      const title = field && field.sectionId
        ? t('previewObjectEditor.structureAddSectionOptionTitle', 'New option in this section')
        : t('previewObjectEditor.structureAddOptionTitle', 'New player option');
      return renderStructureBuilder(field, 'add_option', title, [
        builderInput('option_label', t('previewObjectEditor.structureOptionText', 'Option text'), draft.label, t('previewObjectEditor.structureOptionTextPlaceholder', 'What the player clicks')),
        builderInput('target_id', t('previewObjectEditor.structureTargetId', 'Target section ID'), draft.target, 'new_option'),
        builderSelect('result_mode', t('previewObjectEditor.structureResultMode', 'Result routing'), draft.resultMode || 'native', ['native', 'continue']),
        builderInputWithVariables('choose_if', t('previewObjectEditor.chooseIf', 'Choose if'), draft.chooseIf, 'Q.variable >= 1', body),
        builderInput('unavailable_text', t('previewObjectEditor.unavailableText', 'Unavailable text'), draft.unavailableText, t('previewObjectEditor.unavailableTextPlaceholder', 'Requirement not met')),
        builderInputWithVariables('effect_variable', t('previewObjectEditor.structureVariable', 'Variable'), draft.effect && draft.effect.variable || '', 'public_order', body),
        builderSelect('effect_operation', t('previewObjectEditor.structureOperation', 'Operation'), draft.effect && draft.effect.op || '+=', ['=', '+=', '-=']),
        builderInput('effect_value', t('previewObjectEditor.structureValue', 'Value'), draft.effect && draft.effect.value || '', '1'),
        builderInputWithVariables('effect_condition', t('previewObjectEditor.structureConditionOptional', 'Condition (optional)'), draft.effect && draft.effect.condition || '', 'Q.flag', body),
        builderTextarea('result_text', t('previewObjectEditor.structureResultText', 'Result text'), draft.result, t('previewObjectEditor.structureResultTextPlaceholder', 'What happens after this choice'))
      ], body);
    }

    function renderAddBranchBuilder(field, body) {
      const draft = structureDraftApi().parseBranchDraft(fieldValue(field));
      return renderStructureBuilder(field, 'add_branch', t('previewObjectEditor.structureAddBranchTitle', 'New branch or follow-up'), [
        builderInput('section_id', t('previewObjectEditor.structureSectionId', 'Section ID'), draft.section, 'follow_up'),
        builderInput('condition', t('previewObjectEditor.structureCondition', 'Condition'), draft.condition, 'Q.variable >= 1'),
        builderTextarea('branch_text', t('previewObjectEditor.structureBranchText', 'Branch text'), draft.text, t('previewObjectEditor.structureBranchTextPlaceholder', 'Conditional or follow-up prose'))
      ], body);
    }

    function renderEffectBuilder(field, action, body) {
      const draft = structureDraftApi().parseEffectDraft(fieldValue(field));
      return renderStructureBuilder(field, action, action === 'add_option_effect'
        ? t('previewObjectEditor.structureChoiceEffectTitle', 'New choice effect')
        : t('previewObjectEditor.structureTriggerEffectTitle', 'New on-arrival effect'), [
        builderInputWithVariables('variable', t('previewObjectEditor.structureVariable', 'Variable'), draft.variable, 'public_order', body),
        builderSelect('operation', t('previewObjectEditor.structureOperation', 'Operation'), draft.op || '+=', ['=', '+=', '-=']),
        builderInput('value', t('previewObjectEditor.structureValue', 'Value'), draft.value, '1'),
        builderInputWithVariables('condition', t('previewObjectEditor.structureConditionOptional', 'Condition (optional)'), draft.condition, 'Q.flag', body)
      ], body);
    }

    function renderStructureBuilder(field, action, title, controls, body) {
      const value = fieldValue(field);
      const id = fieldId(field);
      const original = field && field.original !== undefined ? String(field.original || '') : value;
      const target = structureActionTarget(field);
      const safety = structureActionSafetyLabel(body, field);
      return [
        '<article class="preview-object-structure-builder preview-object-action-' + escapeAttr(safeClass(action)) + '" data-preview-object-structure-builder="' + escapeAttr(action) + '" data-preview-object-structure-field-id="' + escapeAttr(id) + '" data-preview-object-structure-option-id="' + escapeAttr(field && field.optionId || '') + '" data-preview-object-structure-section-id="' + escapeAttr(field && field.sectionId || '') + '" data-preview-object-structure-target-label="' + escapeAttr(field && field.structureTargetLabel || field && field.label || '') + '">',
        '<header>',
        '<span>' + escapeHtml(t('previewObjectEditor.editorField', 'Editor field')) + '</span>',
        '<strong>' + escapeHtml(title) + '</strong>',
        target ? '<small class="preview-object-structure-target" title="' + escapeAttr(target.title) + '">' + escapeHtml(target.label) + '</small>' : '',
        '</header>',
        '<div class="preview-object-structure-form">',
        controls.join(''),
        '</div>',
        structureActionHelp(action) ? '<small class="preview-object-structure-help">' + escapeHtml(structureActionHelp(action)) + '</small>' : '',
        safety ? '<small class="preview-object-structure-safety">' + escapeHtml(safety) + '</small>' : '',
        '<button class="preview-object-structure-commit" type="button" data-object-canvas-action="commit_structure_command">' + escapeHtml(t('previewObjectEditor.commitStructure', 'Add to current edit')) + '</button>',
        id ? '<input type="hidden" data-preview-object-structure-output="true" data-object-canvas-field="' + escapeAttr(id) + '" data-editing-field="' + escapeAttr(id) + '" data-object-canvas-original="' + escapeAttr(original) + '" value="' + escapeAttr(value) + '">' : '',
        '</article>'
      ].join('');
    }

    function structureActionHelp(action) {
      return {
        add_option: t('previewObjectEditor.structureHelpAddOption', 'Adds an option, gate, result section, and optional choice effect to the current draft.'),
        add_branch: t('previewObjectEditor.structureHelpAddBranch', 'Adds a conditional or follow-up section to the current draft.'),
        add_trigger_effect: t('previewObjectEditor.structureHelpTriggerEffect', 'Adds a Q effect to the on-arrival logic that runs when this object opens.'),
        add_option_effect: t('previewObjectEditor.structureHelpChoiceEffect', 'Adds a Q effect for this choice or result.')
      }[String(action || '')] || '';
    }

    function builderInput(part, label, value, placeholder) {
      return [
        '<label>',
        '<span>' + escapeHtml(label) + '</span>',
        '<input type="text" data-preview-object-structure-part="' + escapeAttr(part) + '" value="' + escapeAttr(value) + '"' + (placeholder ? ' placeholder="' + escapeAttr(placeholder) + '"' : '') + '>',
        '</label>'
      ].join('');
    }

    function builderInputWithVariables(part, label, value, placeholder, body) {
      var candidates = ensureArray(body && body.variablePickerCandidates);
      if (!candidates.length) {
        return builderInput(part, label, value, placeholder);
      }
      var pickerId = 'structure_var_picker_' + safeClass(part);
      var limit = 12;
      return [
        '<label>',
        '<span>' + escapeHtml(label) + '</span>',
        '<input type="text" data-preview-object-structure-part="' + escapeAttr(part) + '" value="' + escapeAttr(value) + '"' + (placeholder ? ' placeholder="' + escapeAttr(placeholder) + '"' : '') + '>',
        '</label>',
        '<details class="object-canvas-variable-picker" data-object-canvas-variable-picker="true" data-variable-target-field="" data-variable-picker-mode="effect_variable" data-variable-picker-limit="' + String(limit) + '">',
        '<summary>' + escapeHtml(t('previewObjectEditor.variablePicker', 'Variable picker')) + '</summary>',
        '<label class="object-canvas-variable-search"><span>' + escapeHtml(t('previewObjectEditor.variableSearch', 'Search variables')) + '</span><input id="' + escapeAttr(pickerId) + '" type="search" data-object-canvas-variable-search="true" placeholder="' + escapeAttr(t('previewObjectEditor.variableSearchPlaceholder', 'type to filter')) + '"></label>',
        '<div class="object-canvas-variable-candidates" data-object-canvas-variable-candidates="true">',
        candidates.slice(0, limit).map(function(candidate) {
          var insertValue = String(candidate && (candidate.insertValue || candidate.name) || '');
          if (!insertValue) { return ''; }
          var searchText = String(candidate && (candidate.searchText || [candidate.name, candidate.label, candidate.meaning, candidate.summary].join(' ')) || '').toLowerCase();
          return [
            '<button type="button" class="object-canvas-variable-candidate" data-object-canvas-variable-copy="' + escapeAttr(insertValue) + '" data-object-canvas-variable-search-text="' + escapeAttr(searchText) + '">',
            '<strong>' + escapeHtml(candidate && (candidate.label || candidate.name) || insertValue) + '</strong>',
            candidate && candidate.meaning ? '<span>' + escapeHtml(candidate.meaning) + '</span>' : '',
            candidate && candidate.summary ? '<small>' + escapeHtml(candidate.summary) + '</small>' : '',
            '</button>'
          ].join('');
        }).join(''),
        '</div>',
        '</details>'
      ].join('');
    }

    function builderTextarea(part, label, value, placeholder) {
      return [
        '<label class="is-wide">',
        '<span>' + escapeHtml(label) + '</span>',
        '<textarea rows="3" wrap="soft" data-preview-object-structure-part="' + escapeAttr(part) + '"' + (placeholder ? ' placeholder="' + escapeAttr(placeholder) + '"' : '') + '>' + escapeHtml(value) + '</textarea>',
        '</label>'
      ].join('');
    }

    function builderSelect(part, label, value, options) {
      return [
        '<label>',
        '<span>' + escapeHtml(label) + '</span>',
        '<select data-preview-object-structure-part="' + escapeAttr(part) + '">',
        ensureArray(options).map((option) => '<option value="' + escapeAttr(option) + '"' + (String(option) === String(value) ? ' selected' : '') + '>' + escapeHtml(option) + '</option>').join(''),
        '</select>',
        '</label>'
      ].join('');
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
