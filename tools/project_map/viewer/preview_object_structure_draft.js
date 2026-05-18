(function initProjectMapPreviewObjectStructureDraft(global) {
  'use strict';

  const api = {
    composeStructureValue,
    readBuilderCommand,
    syncBuilder,
    clearBuilder,
    slugForStructure: slugForStructurePreview,
    slugForStructurePreview,
    variablesFromDendryText,
    variablesFromCondition,
    parseAddOptionDraft,
    parseBranchDraft,
    parseEffectDraft,
    splitEffectCondition
  };

  if (global) {
    global.ProjectMapPreviewObjectStructureDraft = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  function slugForStructurePreview(value) {
    return String(value || '')
      .trim()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48);
  }

  function composeStructureValue(action, parts) {
    const values = parts || {};
    if (action === 'add_option') {
      const label = String(values.option_label || '').trim();
      const result = String(values.result_text || '').trim();
      const chooseIf = String(values.choose_if || '').trim();
      const unavailableText = String(values.unavailable_text || '').trim();
      const resultMode = String(values.result_mode || 'native').trim() || 'native';
      const target = slugForStructurePreview(values.target_id) || slugForStructurePreview(label) || 'new_option';
      if (!label && !result && !String(values.target_id || '').trim() && !chooseIf && !unavailableText && resultMode === 'native') {
        return '';
      }
      return [
        '- @' + target + ': ' + (label || 'Player-facing option text'),
        '# ' + target,
        'result-mode: ' + resultMode,
        chooseIf ? 'choose-if: ' + chooseIf : '',
        unavailableText ? 'unavailable-subtitle: ' + unavailableText : '',
        result || 'Result prose.'
      ].filter(Boolean).join('\n');
    }
    if (action === 'add_branch') {
      const section = slugForStructurePreview(values.section_id) || 'follow_up';
      const condition = String(values.condition || '').trim();
      const text = String(values.branch_text || '').trim();
      if (!String(values.section_id || '').trim() && !condition && !text) {
        return '';
      }
      return ['# ' + section, condition ? '[? if ' + condition + ' : ' + (text || 'Conditional prose.') + ' ?]' : (text || 'Follow-up prose.')].join('\n');
    }
    if (action === 'add_trigger_effect' || action === 'add_option_effect') {
      const variable = String(values.variable || '').trim().replace(/^Q\./, '');
      const op = String(values.operation || '+=').trim() || '+=';
      const value = String(values.value || '').trim();
      const condition = String(values.condition || '').trim();
      if (!variable || !value) {
        return '';
      }
      return 'Q.' + variable + ' ' + op + ' ' + value + (condition ? ' if ' + condition : '');
    }
    return '';
  }

  function readBuilderCommand(builder, options) {
    const opts = options || {};
    const value = syncBuilder(builder, opts);
    if (!builder || !String(value || '').trim()) {
      return null;
    }
    const output = queryOne(builder, '[data-preview-object-structure-output]');
    const action = builder.dataset && builder.dataset.previewObjectStructureBuilder || '';
    const fieldId = builder.dataset && builder.dataset.previewObjectStructureFieldId ||
      output && output.dataset && output.dataset.objectCanvasField || '';
    const command = {
      action,
      fieldId,
      optionId: builder.dataset && builder.dataset.previewObjectStructureOptionId || '',
      sectionId: builder.dataset && builder.dataset.previewObjectStructureSectionId || '',
      targetLabel: builder.dataset && builder.dataset.previewObjectStructureTargetLabel || '',
      value: String(value || '').trim()
    };
    if (opts.id !== undefined && opts.id !== null) {
      command.id = opts.id;
    }
    if (opts.counter !== undefined && opts.counter !== null) {
      command.id = 'structure_command_' + opts.counter;
    }
    return command;
  }

  function syncBuilder(builder, options) {
    if (!builder) {
      return '';
    }
    const output = queryOne(builder, '[data-preview-object-structure-output]');
    if (!output) {
      return '';
    }
    const action = builder.dataset && builder.dataset.previewObjectStructureBuilder || '';
    const parts = {};
    queryAll(builder, '[data-preview-object-structure-part]').forEach((input) => {
      const key = input.dataset && input.dataset.previewObjectStructurePart || '';
      parts[key] = String(input.value || '').trim();
    });
    const next = composeStructureValue(action, parts);
    if (output.value !== next) {
      output.value = next;
      if (!options || options.dispatch !== false) {
        dispatchInput(output, options);
      }
    }
    return next;
  }

  function clearBuilder(builder) {
    if (!builder) {
      return;
    }
    queryAll(builder, '[data-preview-object-structure-part]').forEach((input) => {
      if (input.tagName === 'SELECT') {
        input.selectedIndex = 0;
      } else {
        input.value = '';
      }
    });
    const output = queryOne(builder, '[data-preview-object-structure-output]');
    if (output) {
      output.value = '';
    }
  }

  function queryOne(root, selector) {
    return root && typeof root.querySelector === 'function' ? root.querySelector(selector) : null;
  }

  function queryAll(root, selector) {
    if (!root || typeof root.querySelectorAll !== 'function') {
      return [];
    }
    return Array.prototype.slice.call(root.querySelectorAll(selector));
  }

  function dispatchInput(output, options) {
    if (!output || typeof output.dispatchEvent !== 'function') {
      return;
    }
    const eventFactory = options && options.Event || typeof Event !== 'undefined' && Event;
    if (typeof eventFactory !== 'function') {
      return;
    }
    output.dispatchEvent(new eventFactory('input', {bubbles: true}));
  }

  function variablesFromDendryText(value) {
    const names = [];
    const re = /\[\+\s*([A-Za-z_][A-Za-z0-9_]*)\b/g;
    let match;
    while ((match = re.exec(String(value || ''))) !== null) {
      names.push(match[1]);
    }
    return uniqueStrings(names);
  }

  function variablesFromCondition(value) {
    const text = String(value || '')
      .replace(/'[^']*'|"[^"]*"/g, ' ')
      .replace(/<[^>]+>/g, ' ');
    const names = [];
    let match;
    const dotted = /\bQ\.([A-Za-z_][A-Za-z0-9_]*)\b/g;
    while ((match = dotted.exec(text)) !== null) {
      names.push(match[1]);
    }
    const reserved = new Set(['and', 'or', 'not', 'if', 'true', 'false', 'is', 'in']);
    const bare = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
    while ((match = bare.exec(text)) !== null) {
      const name = match[1];
      if (!reserved.has(name.toLowerCase()) && !/^\d/.test(name)) {
        names.push(name);
      }
    }
    return uniqueStrings(names);
  }

  function parseAddOptionDraft(value) {
    const lines = String(value || '').split(/\r?\n/);
    const first = lines.find((line) => /^\s*-\s*@[^:]+:/.test(line)) || '';
    const match = first.match(/^\s*-\s*@([^:]+):\s*(.*)$/);
    const section = lines.find((line) => /^\s*#\s*\S+/.test(line)) || '';
    const chooseLine = lines.find((line) => /^\s*choose-if\s*:/i.test(line)) || '';
    const unavailableLine = lines.find((line) => /^\s*unavailable-(?:subtitle|text)\s*:/i.test(line)) || '';
    const resultModeLine = lines.find((line) => /^\s*result-mode\s*:/i.test(line)) || '';
    const target = match && match[1] || (section.match(/^\s*#\s*(\S+)/) || [])[1] || '';
    const label = match && match[2] || '';
    const chooseIf = chooseLine.replace(/^\s*choose-if\s*:\s*/i, '').trim();
    const unavailableText = unavailableLine.replace(/^\s*unavailable-(?:subtitle|text)\s*:\s*/i, '').trim();
    const resultMode = resultModeLine.replace(/^\s*result-mode\s*:\s*/i, '').trim();
    const result = lines.filter((line) => line !== first && line !== section && line !== chooseLine && line !== unavailableLine && line !== resultModeLine).join('\n').trim();
    return {target, label, result, chooseIf, unavailableText, resultMode};
  }

  function parseBranchDraft(value) {
    const text = String(value || '');
    const lines = text.split(/\r?\n/);
    const sectionLine = lines.find((line) => /^\s*#\s*\S+/.test(line)) || '';
    const section = (sectionLine.match(/^\s*#\s*(\S+)/) || [])[1] || '';
    const body = lines.filter((line) => line !== sectionLine).join('\n').trim();
    const conditional = body.match(/^\[\?\s*if\s+(.+?)\s*:\s*([\s\S]*?)\s*\?\]$/);
    return {
      section,
      condition: conditional ? conditional[1].trim() : '',
      text: conditional ? conditional[2].trim() : body
    };
  }

  function parseEffectDraft(value) {
    const text = String(value || '').trim().replace(/^Q\./, '');
    const parts = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(\+=|-=|\*=|\/=|=)\s*(.*)$/);
    if (!parts) {
      return {variable: '', op: '+=', value: '', condition: ''};
    }
    const tail = splitEffectCondition(parts[3]);
    return {variable: parts[1], op: parts[2], value: tail.value, condition: tail.condition};
  }

  function splitEffectCondition(value) {
    const text = String(value || '').trim();
    const match = text.match(/^([\s\S]*?)\s+if\s+([\s\S]+)$/i);
    return match ? {value: match[1].trim(), condition: match[2].trim()} : {value: text, condition: ''};
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const out = [];
    (Array.isArray(values) ? values : []).forEach((value) => {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out;
  }
})(typeof window !== 'undefined' ? window : globalThis);
