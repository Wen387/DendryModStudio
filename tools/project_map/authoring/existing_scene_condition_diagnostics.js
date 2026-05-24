// @ts-check
(function initProjectMapExistingSceneConditionDiagnostics(global) {
  'use strict';

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const out = [];
    ensureArray(values).forEach((value) => {
      const text = String(value || '').trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out;
  }

  function diagnostic(severity, code, message) {
    return {severity, code, message, confidence: 'static_inferred'};
  }

  function conditionWindowDiagnosticsForScene(scene) {
    const rows = [];
    pushConditionWindowDiagnostic(rows, 'Appearance condition', scene && scene.viewIf);
    pushConditionWindowDiagnostic(rows, 'Choice condition', scene && scene.chooseIf);
    ensureArray(scene && scene.options).forEach((option) => {
      const label = String(option && (option.title || option.label || option.id || 'option') || '');
      pushConditionWindowDiagnostic(rows, 'Choice condition: ' + label, option && option.chooseIf);
    });
    ensureArray(scene && scene.sections).forEach((section) => {
      const label = sectionLabelForDiagnostic(scene, section);
      pushConditionWindowDiagnostic(rows, 'Section condition: ' + label, section && section.viewIf);
      pushConditionWindowDiagnostic(rows, 'Section choice condition: ' + label, section && section.chooseIf);
    });
    return rows;
  }

  function conditionWindowDiagnosticsForChanges(changes) {
    const rows = [];
    ensureArray(changes).forEach((change) => {
      if (String(change && change.role || '') !== 'condition') {
        return;
      }
      pushConditionWindowDiagnostic(rows, String(change.label || 'Condition'), change.after);
    });
    return rows;
  }

  function pushConditionWindowDiagnostic(rows, label, condition) {
    const problem = impossibleMonthWindow(condition);
    if (!problem) {
      return;
    }
    rows.push(diagnostic('warning', 'existing_scene_edit.impossible_month_window', label + ' has an impossible month window: ' + problem));
  }

  function impossibleMonthWindow(condition) {
    const text = String(condition || '').trim();
    if (!text || /\bor\b/i.test(text)) {
      return '';
    }
    const matches = Array.from(text.matchAll(/\bmonth\s*(==|=|>=|>|<=|<)\s*(-?\d+(?:\.\d+)?)/gi));
    if (!matches.length) {
      return '';
    }
    let min = 1;
    let max = 12;
    let hasOutOfRangeBound = false;
    const exacts = [];
    matches.forEach((match) => {
      const op = String(match[1] || '');
      const value = Number(match[2]);
      if (!Number.isFinite(value)) {
        return;
      }
      if (op === '=' || op === '==') {
        exacts.push(value);
        hasOutOfRangeBound = hasOutOfRangeBound || value < 1 || value > 12;
        min = Math.max(min, value);
        max = Math.min(max, value);
      } else if (op === '>=') {
        hasOutOfRangeBound = hasOutOfRangeBound || value < 1;
        min = Math.max(min, value);
      } else if (op === '>') {
        hasOutOfRangeBound = hasOutOfRangeBound || value < 0;
        min = Math.max(min, value + 1);
      } else if (op === '<=') {
        hasOutOfRangeBound = hasOutOfRangeBound || value > 12;
        max = Math.min(max, value);
      } else if (op === '<') {
        hasOutOfRangeBound = hasOutOfRangeBound || value > 13;
        max = Math.min(max, value - 1);
      }
    });
    const uniqueExacts = uniqueStrings(exacts.map((value) => String(value)));
    if (uniqueExacts.length > 1) {
      return 'month is set to multiple values (' + uniqueExacts.join(', ') + ').';
    }
    if (min > max) {
      return 'month lower bound ' + min + ' is greater than upper bound ' + max + '.';
    }
    if (hasOutOfRangeBound || min < 1 || max > 12) {
      return 'month must stay between 1 and 12.';
    }
    return '';
  }

  function sectionLabelForDiagnostic(scene, section) {
    const sceneId = String(scene && scene.id || '');
    const raw = String(section && section.id || '');
    const local = sceneId && raw.startsWith(sceneId + '.') ? raw.slice(sceneId.length + 1) : raw;
    return String(section && (section.title || section.subtitle) || local || raw || 'section');
  }

  const api = {
    conditionWindowDiagnosticsForScene,
    conditionWindowDiagnosticsForChanges,
    pushConditionWindowDiagnostic,
    impossibleMonthWindow,
    sectionLabelForDiagnostic
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapExistingSceneConditionDiagnostics = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
