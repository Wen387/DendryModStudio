// @ts-check
(function initProjectMapExistingSceneLineCoalescer(global) {
  'use strict';

  /**
   * @typedef {Record<string, any>} ExistingSceneLineChange
   * @typedef {{change: ExistingSceneLineChange, index: number}} IndexedExistingSceneLineChange
   * @typedef {{isProtectedRouterPath?: (path: string) => boolean}} ExistingSceneCoalescerOptions
   * @typedef {{ok: boolean, line?: string}} LineApplyResult
   * @typedef {{ok: boolean, hook?: string, prefix?: string, clauses?: string[]}} ParsedHookLine
   */

  const api = {
    coalesceExistingSceneChanges,
    coalesceExistingSceneLineReplacements
  };

  if (global) {
    global.ProjectMapExistingSceneLineCoalescer = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  /**
   * Merge safe operation-ready change groups before install-plan generation.
   * This keeps the install plan ordinary while avoiding same-source-unit
   * insert/replace fragments that would otherwise shift each other's anchors.
   * @param {unknown[]} changes
   * @param {ExistingSceneCoalescerOptions=} options
   * @returns {ExistingSceneLineChange[]}
   */
  function coalesceExistingSceneChanges(changes, options) {
    return coalesceExistingSceneSourceUnits(
      coalesceExistingSceneLineReplacements(changes),
      isObject(options) ? options : {}
    );
  }

  /**
   * Merge multiple same-source-line replacement changes into one operation-ready
   * change so the installer verifies and writes a single current source line.
   * @param {unknown[]} changes
   * @returns {ExistingSceneLineChange[]}
   */
  function coalesceExistingSceneLineReplacements(changes) {
    const rows = ensureArray(changes);
    const groups = new Map();
    rows.forEach((change, index) => {
      const key = coalescibleExistingSceneLineKey(change);
      if (!key) {
        return;
      }
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push({change, index});
    });
    const replacementsByFirstIndex = new Map();
    const skippedIndexes = new Set();
    groups.forEach((group) => {
      if (group.length < 2) {
        return;
      }
      const merged = mergeExistingSceneLineReplacementGroup(group.map((item) => item.change));
      if (!merged) {
        return;
      }
      const firstIndex = group[0].index;
      replacementsByFirstIndex.set(firstIndex, merged);
      group.slice(1).forEach((item) => skippedIndexes.add(item.index));
    });
    return rows.reduce((next, change, index) => {
      if (replacementsByFirstIndex.has(index)) {
        const merged = replacementsByFirstIndex.get(index);
        if (merged.before !== merged.after) {
          next.push(merged);
        }
        return next;
      }
      if (!skippedIndexes.has(index)) {
        next.push(change);
      }
      return next;
    }, []);
  }

  /**
   * @param {ExistingSceneLineChange[]} changes
   * @param {ExistingSceneCoalescerOptions} options
   * @returns {ExistingSceneLineChange[]}
   */
  function coalesceExistingSceneSourceUnits(changes, options) {
    const rows = ensureArray(changes);
    const groups = new Map();
    rows.forEach((change, index) => {
      const key = coalescibleSourceUnitKey(change, options);
      if (!key) {
        return;
      }
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push({change, index});
    });
    const replacementsByFirstIndex = new Map();
    const skippedIndexes = new Set();
    groups.forEach((group) => {
      const primaries = group.filter((item) => isSourceUnitPrimaryChange(item.change, options));
      if (primaries.length !== 1) {
        return;
      }
      const primary = primaries[0];
      const insertItems = group
        .filter((item) => item.index !== primary.index && isSourceUnitInsertChange(item.change, primary.change, options))
        .sort((left, right) => left.index - right.index);
      const replaceItems = group
        .filter((item) => item.index !== primary.index && isSourceUnitReplaceTextChange(item.change, primary.change, options))
        .sort((left, right) => left.index - right.index);
      if (!insertItems.length && !replaceItems.length) {
        return;
      }
      const merged = mergeExistingSceneSourceUnit(primary.change, insertItems.map((item) => item.change), replaceItems.map((item) => item.change));
      if (!merged) {
        return;
      }
      const firstIndex = Math.min(primary.index, ...insertItems.map((item) => item.index), ...replaceItems.map((item) => item.index));
      replacementsByFirstIndex.set(firstIndex, merged);
      [primary].concat(insertItems, replaceItems).forEach((item) => {
        if (item.index !== firstIndex) {
          skippedIndexes.add(item.index);
        }
      });
    });
    return rows.reduce((next, change, index) => {
      if (replacementsByFirstIndex.has(index)) {
        next.push(replacementsByFirstIndex.get(index));
        return next;
      }
      if (!skippedIndexes.has(index)) {
        next.push(change);
      }
      return next;
    }, []);
  }

  /**
   * @param {unknown} change
   * @param {ExistingSceneCoalescerOptions} options
   * @returns {string}
   */
  function coalescibleSourceUnitKey(change, options) {
    const value = isObject(change) ? change : {};
    const source = isObject(value.source) ? value.source : {};
    const path = normalizedPath(source.path || value.sourcePath);
    if (!path || sourcePathProtected(path, options)) {
      return '';
    }
    const sectionId = String(value.sectionId || '').trim();
    const optionId = String(value.optionId || '').trim();
    if (sectionId) {
      return path + '|section:' + sectionId;
    }
    if (optionId) {
      return path + '|option:' + optionId;
    }
    const line = numberOrNull(value.startLine || source.startLine || source.line);
    const endLine = numberOrNull(value.endLine || source.endLine || source.line || source.startLine || line);
    if (!line || !endLine) {
      return '';
    }
    return path + '|range:' + line + ':' + endLine;
  }

  /**
   * @param {ExistingSceneLineChange} change
   * @param {ExistingSceneCoalescerOptions} options
   * @returns {boolean}
   */
  function isSourceUnitPrimaryChange(change, options) {
    const value = isObject(change) ? change : {};
    const source = isObject(value.source) ? value.source : {};
    const path = normalizedPath(source.path || value.sourcePath);
    const startLine = numberOrNull(value.startLine || source.startLine || source.line);
    const endLine = numberOrNull(value.endLine || source.endLine || source.line || source.startLine);
    return String(value.operationType || '') === 'replace_section' &&
      !sourcePathProtected(path, options) &&
      !isManualOrDeleteChange(value) &&
      Boolean(path && startLine && endLine && endLine >= startLine) &&
      Boolean(String(value.anchorText || source.anchorText || '').trim()) &&
      Boolean(String(value.endAnchorText || source.endAnchorText || '').trim()) &&
      Boolean(String(value.after || '').trim());
  }

  /**
   * @param {ExistingSceneLineChange} change
   * @param {ExistingSceneLineChange} primary
   * @param {ExistingSceneCoalescerOptions} options
   * @returns {boolean}
   */
  function isSourceUnitInsertChange(change, primary, options) {
    const value = isObject(change) ? change : {};
    const source = isObject(value.source) ? value.source : {};
    const primarySource = isObject(primary.source) ? primary.source : {};
    const path = normalizedPath(source.path || value.sourcePath);
    const primaryPath = normalizedPath(primarySource.path || primary.sourcePath);
    if (String(value.operationType || '') !== 'insert_text' || !path || path !== primaryPath || sourcePathProtected(path, options)) {
      return false;
    }
    if (isManualOrDeleteChange(value)) {
      return false;
    }
    if (!String(value.after || '').trim()) {
      return false;
    }
    if (!sourceUnitIdentityCompatible(primary, value)) {
      return false;
    }
    const anchor = String(value.anchorText || source.anchorText || '').trim();
    const primaryAnchor = String(primary.anchorText || primarySource.anchorText || '').trim();
    const primaryEndAnchor = String(primary.endAnchorText || primarySource.endAnchorText || '').trim();
    if (!anchor || (anchor !== primaryAnchor && anchor !== primaryEndAnchor)) {
      return false;
    }
    if (primaryAnchor && primaryEndAnchor && primaryAnchor !== primaryEndAnchor) {
      const position = String(value.position || 'after') === 'before' ? 'before' : 'after';
      if (anchor === primaryAnchor && position !== 'before') {
        return false;
      }
      if (anchor === primaryEndAnchor && position === 'before') {
        return false;
      }
    }
    const line = numberOrNull(source.line || source.startLine || value.startLine || value.line);
    const primaryStart = numberOrNull(primary.startLine || primarySource.startLine || primarySource.line);
    const primaryEnd = numberOrNull(primary.endLine || primarySource.endLine || primarySource.line || primarySource.startLine || primaryStart);
    return !line || line === primaryStart || line === primaryEnd;
  }

  /**
   * @param {ExistingSceneLineChange} change
   * @param {ExistingSceneLineChange} primary
   * @param {ExistingSceneCoalescerOptions} options
   * @returns {boolean}
   */
  function isSourceUnitReplaceTextChange(change, primary, options) {
    const value = isObject(change) ? change : {};
    const source = isObject(value.source) ? value.source : {};
    const primarySource = isObject(primary.source) ? primary.source : {};
    const path = normalizedPath(source.path || value.sourcePath);
    const primaryPath = normalizedPath(primarySource.path || primary.sourcePath);
    if (String(value.operationType || '') !== 'replace_text' || !path || path !== primaryPath || sourcePathProtected(path, options)) {
      return false;
    }
    if (isManualOrDeleteChange(value) || !sourceUnitIdentityCompatible(primary, value)) {
      return false;
    }
    const before = String(value.before || '').trim();
    const after = String(value.after || '').trim();
    if (!before || !after || before === after) {
      return false;
    }
    const line = numberOrNull(value.line || value.startLine || source.line || source.startLine);
    const primaryStart = numberOrNull(primary.startLine || primarySource.startLine || primarySource.line);
    const primaryEnd = numberOrNull(primary.endLine || primarySource.endLine || primarySource.line || primarySource.startLine || primaryStart);
    return Boolean(line && primaryStart && primaryEnd && line >= primaryStart && line <= primaryEnd);
  }

  /**
   * @param {ExistingSceneLineChange} primary
   * @param {ExistingSceneLineChange[]} inserts
   * @param {ExistingSceneLineChange[]=} replacements
   * @returns {ExistingSceneLineChange|null}
   */
  function mergeExistingSceneSourceUnit(primary, inserts, replacements) {
    const insertRows = ensureArray(inserts).filter(Boolean);
    const replaceRows = ensureArray(replacements).filter(Boolean);
    const beforeInserts = insertRows.filter((change) => String(change.position || 'after') === 'before');
    const afterInserts = insertRows.filter((change) => String(change.position || 'after') !== 'before');
    const primaryContent = applySourceUnitTextReplacements(sourceUnitContentFragment(primary.after), replaceRows);
    if (primaryContent === null) {
      return null;
    }
    const content = beforeInserts.map((change) => sourceUnitContentFragment(change.after))
      .concat(primaryContent)
      .concat(afterInserts.map((change) => sourceUnitContentFragment(change.after)))
      .join('');
    if (!content.trim()) {
      return null;
    }
    const editability = [primary].concat(insertRows, replaceRows).some((change) => existingSceneAdvancedRequested(change))
      ? 'advanced_source_patch'
      : (primary.editability || 'guarded_replace_section');
    const roles = [primary].concat(insertRows, replaceRows).map((change) => String(change.role || '').trim()).filter(Boolean);
    const fieldIds = [primary].concat(insertRows, replaceRows).map((change) => String(change.fieldId || '').trim()).filter(Boolean);
    return Object.assign({}, primary, {
      fieldId: primary.fieldId || 'coalesced_source_unit',
      label: primary.label || primary.role || 'section',
      editability,
      operationType: 'replace_section',
      after: content,
      dedupeSearch: coalescedDedupeSearch(content),
      coalescedSourceUnit: true,
      coalescedChangeIds: fieldIds,
      coalescedSourceRoles: roles
    });
  }

  /**
   * @param {string} content
   * @param {ExistingSceneLineChange[]} replacements
   * @returns {string|null}
   */
  function applySourceUnitTextReplacements(content, replacements) {
    let next = String(content || '');
    for (const change of ensureArray(replacements)) {
      const before = String(change && change.before || '');
      const after = String(change && change.after || '');
      if (!before || before === after) {
        return null;
      }
      if (occurrenceCount(next, before) !== 1) {
        return null;
      }
      next = next.replace(before, after);
    }
    return next;
  }

  /**
   * @param {ExistingSceneLineChange} left
   * @param {ExistingSceneLineChange} right
   * @returns {boolean}
   */
  function sourceUnitIdentityCompatible(left, right) {
    const leftSection = String(left.sectionId || '').trim();
    const rightSection = String(right.sectionId || '').trim();
    const leftOption = String(left.optionId || '').trim();
    const rightOption = String(right.optionId || '').trim();
    if (leftSection && rightSection && leftSection !== rightSection) {
      return false;
    }
    if (leftOption && rightOption && leftOption !== rightOption) {
      return false;
    }
    return Boolean(leftSection || rightSection || leftOption || rightOption || coalescibleSourceUnitKey(left, {}) === coalescibleSourceUnitKey(right, {}));
  }

  /**
   * @param {ExistingSceneLineChange} value
   * @returns {boolean}
   */
  function isManualOrDeleteChange(value) {
    const editability = String(value.editability || '');
    const operationType = String(value.operationType || '');
    return editability === 'manual_review' ||
      operationType === 'manual_snippet' ||
      Boolean(value.allowEmptyReplace || value.deletesSourceLine || value.deleteMode === 'line');
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function sourceUnitContentFragment(value) {
    const text = String(value === undefined || value === null ? '' : value);
    return text && !text.endsWith('\n') ? text + '\n' : text;
  }

  /**
   * @param {string} text
   * @param {string} needle
   * @returns {number}
   */
  function occurrenceCount(text, needle) {
    const value = String(text || '');
    const target = String(needle || '');
    return target ? value.split(target).length - 1 : 0;
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function coalescedDedupeSearch(value) {
    return String(value || '').trim().slice(0, 200);
  }

  /**
   * @param {unknown} path
   * @returns {string}
   */
  function normalizedPath(path) {
    return String(path || '').replace(/\\/g, '/').trim();
  }

  /**
   * @param {string} path
   * @param {ExistingSceneCoalescerOptions} options
   * @returns {boolean}
   */
  function sourcePathProtected(path, options) {
    return Boolean(options && typeof options.isProtectedRouterPath === 'function' && options.isProtectedRouterPath(path));
  }

  /**
   * @param {unknown} change
   * @returns {string}
   */
  function coalescibleExistingSceneLineKey(change) {
    const value = isObject(change) ? change : {};
    const operationType = String(value.operationType || '');
    if ((operationType && operationType !== 'replace_text') || value.deletesSourceLine || value.deleteMode === 'line') {
      return '';
    }
    if (!isEffectLikeExistingSceneLineChange(value)) {
      return '';
    }
    const source = isObject(value.source) ? value.source : {};
    const path = String(source.path || value.sourcePath || '').replace(/\\/g, '/').trim();
    const line = numberOrNull(source.line || source.startLine || value.line || value.startLine);
    const endLine = numberOrNull(source.endLine || value.endLine || source.line || source.startLine || line);
    const before = String(value.before === undefined || value.before === null ? '' : value.before);
    const after = String(value.after === undefined || value.after === null ? '' : value.after);
    if (!path || !line || (endLine && endLine !== line) || !before || before === after) {
      return '';
    }
    return path + ':' + line;
  }

  /**
   * @param {ExistingSceneLineChange} change
   * @returns {boolean}
   */
  function isEffectLikeExistingSceneLineChange(change) {
    const source = isObject(change.source) ? change.source : {};
    const role = String(change.role || '').toLowerCase();
    const label = String(change.label || '').toLowerCase();
    const before = String(change.before || '');
    const anchor = String(change.anchorText || source.anchorText || source.rawAnchorText || change.rawAnchorText || '');
    return role === 'effect' ||
      label.includes('effect') ||
      looksLikeEffectSourceText(before) ||
      looksLikeEffectSourceText(anchor);
  }

  /**
   * @param {unknown} value
   * @returns {boolean}
   */
  function looksLikeEffectSourceText(value) {
    const text = String(value || '').trim();
    return /^(?:on-arrival|on-departure|on-display)\s*:/i.test(text) ||
      /^(?:Q\.)?[A-Za-z_][A-Za-z0-9_]*\s*(?:=|\+=|-=|\*=|\/=)/.test(text);
  }

  /**
   * @param {ExistingSceneLineChange[]} changes
   * @returns {ExistingSceneLineChange|null}
   */
  function mergeExistingSceneLineReplacementGroup(changes) {
    const rows = ensureArray(changes).filter(Boolean);
    const first = rows[0] || {};
    const firstSource = isObject(first.source) ? first.source : {};
    const baseLine = firstFullSourceLine(rows);
    if (!baseLine) {
      return null;
    }
    let current = baseLine;
    for (const change of rows) {
      const applied = applyExistingSceneLineChange(current, change, baseLine);
      if (!applied.ok || applied.line === undefined) {
        return null;
      }
      current = applied.line;
    }
    const editability = rows.some((change) => existingSceneAdvancedRequested(change)) ? 'advanced_source_patch' : 'guarded_apply';
    return Object.assign({}, first, {
      fieldId: first.fieldId || 'same_line_source_edit',
      role: first.role || 'effect',
      label: first.label || 'Same-line source edits',
      source: Object.assign({}, firstSource, {
        line: numberOrNull(firstSource.line || firstSource.startLine),
        startLine: numberOrNull(firstSource.startLine || firstSource.line),
        endLine: numberOrNull(firstSource.line || firstSource.startLine),
        anchorText: baseLine,
        endAnchorText: baseLine
      }),
      before: baseLine,
      after: current,
      anchorText: baseLine,
      endAnchorText: baseLine,
      rawAnchorText: first.rawAnchorText || firstSource.rawAnchorText || '',
      expectedRangeHash: first.expectedRangeHash || firstSource.expectedRangeHash || '',
      operationType: 'replace_text',
      editability
    });
  }

  /**
   * @param {ExistingSceneLineChange[]} changes
   * @returns {string}
   */
  function firstFullSourceLine(changes) {
    for (const change of ensureArray(changes)) {
      const source = isObject(change && change.source) ? change.source : {};
      const candidates = [
        change && change.rawAnchorText,
        source.rawAnchorText,
        source.anchorText,
        change && change.anchorText,
        change && change.before
      ];
      for (const candidate of candidates) {
        const line = String(candidate || '').trim();
        if (line && line.indexOf('\n') < 0 && line.indexOf('\r') < 0 && looksLikeWholeSourceLine(line)) {
          return line;
        }
      }
    }
    return '';
  }

  /**
   * @param {unknown} value
   * @returns {boolean}
   */
  function looksLikeWholeSourceLine(value) {
    const text = String(value || '').trim();
    return /^(?:[A-Za-z0-9_-]+\s*:|[-#@=])/.test(text);
  }

  /**
   * @param {string} currentLine
   * @param {ExistingSceneLineChange} change
   * @param {string} baseLine
   * @returns {LineApplyResult}
   */
  function applyExistingSceneLineChange(currentLine, change, baseLine) {
    const before = stringField(change && change.before);
    const after = stringField(change && change.after);
    if (!before || before === after) {
      return {ok: true, line: currentLine};
    }
    if (String(currentLine).includes(before)) {
      return {ok: true, line: String(currentLine).replace(before, after)};
    }
    if (after && String(currentLine).includes(after)) {
      return {ok: true, line: String(currentLine)};
    }
    const rebased = applyHookClauseDiff(before, after, currentLine);
    if (rebased.ok) {
      return rebased;
    }
    if (before === baseLine) {
      const baseRebased = applyHookClauseDiff(baseLine, after, currentLine);
      if (baseRebased.ok) {
        return baseRebased;
      }
    }
    return {ok: false};
  }

  /**
   * @param {string} beforeLine
   * @param {string} afterLine
   * @param {string} currentLine
   * @returns {LineApplyResult}
   */
  function applyHookClauseDiff(beforeLine, afterLine, currentLine) {
    const before = parseHookClauseLine(beforeLine);
    const after = parseHookClauseLine(afterLine);
    const current = parseHookClauseLine(currentLine);
    if (!before.ok || !after.ok || !current.ok || before.hook !== after.hook || before.hook !== current.hook) {
      return {ok: false};
    }
    const removed = clauseMultisetDelta(before.clauses || [], after.clauses || []);
    const added = clauseMultisetDelta(after.clauses || [], before.clauses || []);
    const currentClauses = (current.clauses || []).slice();
    for (const clause of removed) {
      const index = currentClauses.indexOf(clause);
      if (index < 0) {
        return {ok: false};
      }
      currentClauses.splice(index, 1);
    }
    added.forEach((clause) => {
      if (!currentClauses.includes(clause)) {
        currentClauses.push(clause);
      }
    });
    if (!removed.length && !added.length) {
      return {ok: true, line: currentLine};
    }
    return {
      ok: true,
      line: String(current.prefix || '') + currentClauses.join('; ')
    };
  }

  /**
   * @param {string[]} left
   * @param {string[]} right
   * @returns {string[]}
   */
  function clauseMultisetDelta(left, right) {
    const remaining = new Map();
    ensureArray(right).forEach((clause) => {
      remaining.set(clause, Number(remaining.get(clause) || 0) + 1);
    });
    return ensureArray(left).filter((clause) => {
      const count = Number(remaining.get(clause) || 0);
      if (count > 0) {
        remaining.set(clause, count - 1);
        return false;
      }
      return true;
    });
  }

  /**
   * @param {unknown} line
   * @returns {ParsedHookLine}
   */
  function parseHookClauseLine(line) {
    const text = String(line || '').trim();
    const match = text.match(/^((?:on-arrival|on-departure|on-display)\s*:\s*)(.*)$/i);
    if (!match) {
      return {ok: false};
    }
    return {
      ok: true,
      hook: match[1].toLowerCase().replace(/\s+/g, ''),
      prefix: match[1],
      clauses: match[2].split(';').map((clause) => clause.trim()).filter(Boolean)
    };
  }

  /**
   * @param {ExistingSceneLineChange} change
   * @returns {boolean}
   */
  function existingSceneAdvancedRequested(change) {
    const editability = String(change.editability || '');
    return editability === 'advanced_source_patch' || editability === 'advanced_apply';
  }

  /**
   * @param {unknown} value
   * @returns {number|null}
   */
  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const number = Number(value);
    return Number.isFinite(number) ? Math.floor(number) : null;
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function stringField(value) {
    return value === undefined || value === null ? '' : String(value);
  }

  /**
   * @param {unknown} value
   * @returns {value is ExistingSceneLineChange}
   */
  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  /**
   * @template T
   * @param {T[]|unknown} value
   * @returns {T[]}
   */
  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
