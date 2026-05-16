(function initProjectMapExistingSceneTextBlockBuilder(global) {
  'use strict';

  const RESERVED_CONDITION_WORDS = new Set([
    'and', 'or', 'not', 'if', 'else', 'true', 'false', 'null', 'undefined',
    'in', 'is', 'then', 'return', 'Q'
  ]);

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

  function create(deps) {
    const injected = isObject(deps) ? deps : {};
    const sourceRef = typeof injected.sourceRef === 'function' ? injected.sourceRef : null;
    const sourceLine = typeof injected.sourceLine === 'function' ? injected.sourceLine : null;
    const safeId = typeof injected.safeId === 'function' ? injected.safeId : null;
    const isProtectedRouterPath = typeof injected.isProtectedRouterPath === 'function' ? injected.isProtectedRouterPath : null;
    const textBlockHelpers = isObject(injected.textBlockHelpers) ? injected.textBlockHelpers : null;
    if (!sourceRef || !sourceLine || !safeId || !isProtectedRouterPath || !textBlockHelpers) {
      throw new Error('existing_scene_text_block_builder requires sourceRef, sourceLine, safeId, isProtectedRouterPath, and textBlockHelpers dependencies.');
    }

    function textBlocksForScene(scene, rows, sceneSourcePath, options) {
      const bySection = new Map();
      normalizeBlockTextRows(rows).forEach((row) => {
        if (!isBlockTextRole(row.role)) {
          return;
        }
        const source = sourceRef(row.source || {});
        if (!source.path || (sceneSourcePath && source.path !== sceneSourcePath) || !source.line) {
          return;
        }
        const owner = isObject(row.owner) ? row.owner : {};
        const key = String(owner.sectionId || '');
        if (!bySection.has(key)) {
          bySection.set(key, []);
        }
        bySection.get(key).push(row);
      });
      const blocks = [];
      bySection.forEach((sectionRowsForBlock, sectionId) => {
        const ordered = sectionRowsForBlock.slice().sort((a, b) => sourceLine(a.source) - sourceLine(b.source));
        const runs = logicalTextRuns(ordered);
        const lineUsage = new Map();
        runs.forEach((run, index) => {
          run.index = index;
          uniqueStrings(run.rows.map((row) => String(sourceLine(row.source) || ''))).forEach((line) => {
            if (!line) {
              return;
            }
            lineUsage.set(line, (lineUsage.get(line) || 0) + 1);
          });
        });
        runs.forEach((run) => {
          const sharedLine = uniqueStrings(run.rows.map((row) => String(sourceLine(row.source) || '')))
            .some((line) => line && lineUsage.get(line) > 1);
          const block = textBlockFromRows(scene, sectionId, run.rows, options, {
            runKind: run.kind,
            runIndex: run.index,
            singleRun: runs.length === 1,
            forceManual: sharedLine
          });
          if (block) {
            blocks.push(block);
          }
        });
      });
      return blocks.sort((a, b) => (a.source.line || 0) - (b.source.line || 0));
    }

    function normalizeBlockTextRows(rows) {
      const inputRows = ensureArray(rows);
      const byLine = new Map();
      inputRows.forEach((row) => {
        if (!isBlockTextRole(row && row.role)) {
          return;
        }
        const key = blockSourceLineKey(row);
        if (!key) {
          return;
        }
        if (!byLine.has(key)) {
          byLine.set(key, []);
        }
        byLine.get(key).push(row);
      });
      const mixedLineKeys = new Map();
      byLine.forEach((lineRows, key) => {
        const bodyRows = lineRows.filter((row) => String(row && row.role || '') === 'body');
        const conditionalRows = lineRows.filter((row) => String(row && row.role || '') === 'conditional_body');
        if (!bodyRows.length || !conditionalRows.length) {
          return;
        }
        const anchor = sourceAnchor(bodyRows[0]) || sourceAnchor(conditionalRows[0]);
        if (!isMixedInlineConditionalSource(anchor)) {
          return;
        }
        mixedLineKeys.set(key, {
          anchor,
          inlineConditions: uniqueStrings(conditionalRows.map((row) => lastMeaningfulCondition(row && row.conditions)).filter(Boolean))
        });
      });
      return inputRows.map((row) => {
        const key = blockSourceLineKey(row);
        const mixed = key ? mixedLineKeys.get(key) : null;
        if (!mixed) {
          return row;
        }
        if (String(row && row.role || '') === 'conditional_body') {
          return null;
        }
        if (String(row && row.role || '') !== 'body') {
          return row;
        }
        return Object.assign({}, row, {
          text: mixed.anchor,
          originalText: mixed.anchor,
          hasInlineConditionals: true,
          inlineConditions: mixed.inlineConditions
        });
      }).filter(Boolean);
    }

    function blockSourceLineKey(row) {
      const source = row && row.source || {};
      const path = String(source.path || '');
      const line = sourceLine(source);
      const section = String(row && row.owner && row.owner.sectionId || '');
      return path && line ? [path, line, section].join(':') : '';
    }

    function textBlockFromRows(scene, sectionId, rows, options, runOptions) {
      const run = isObject(runOptions) ? runOptions : {};
      const usable = ensureArray(rows).filter((row) => isBlockTextRole(row.role) && sourceLine(row.source));
      if (!usable.length) {
        return null;
      }
      const first = usable[0];
      const last = usable[usable.length - 1];
      const source = sourceRef(first.source || {});
      const anchorText = sourceAnchor(first);
      const endAnchorText = sourceEndAnchor(last);
      if (!source.path || !anchorText || !endAnchorText || isProtectedRouterPath(source.path)) {
        return null;
      }
      const startLine = sourceLine(first.source);
      const endLine = sourceEndLine(last.source);
      const spanLines = endLine && startLine ? endLine - startLine + 1 : 0;
      if (spanLines > 36) {
        return null;
      }
      const original = renderTextBlockContent(usable);
      if (!original.trim()) {
        return null;
      }
      const semantics = textBlockSemantics(scene, sectionId, usable, options);
      const idRoot = 'section_text_' + (sectionId || scene && scene.id || 'opening');
      const id = safeId(run.singleRun ? idRoot : [idRoot, run.runKind || 'text', startLine || '', Number(run.runIndex || 0) + 1].filter(Boolean).join('_'));
      const visualKinds = detectVisualKinds(original);
      const inlineConditions = uniqueStrings(usable.flatMap((row) => ensureArray(row && row.inlineConditions)));
      const conditionalAlternatives = conditionalAlternativesForRows(usable);
      const conditionVariables = uniqueStrings(semantics.conditions.flatMap(variablesFromCondition));
      const inlineConditionVariables = uniqueStrings(inlineConditions.flatMap(variablesFromCondition));
      const textVariables = variablesFromDendryText(original);
      const editability = run.forceManual ? 'advanced_source_patch' : 'guarded_replace_section';
      return {
        id,
        role: 'section_text',
        semanticRole: semantics.semanticRole,
        branchKind: semantics.branchKind,
        label: semantics.label,
        sectionLabel: semantics.sectionLabel,
        sectionId: String(sectionId || ''),
        conditions: semantics.conditions,
        relatedOptionIds: semantics.relatedOptionIds,
        relatedOptionLabels: semantics.relatedOptionLabels,
        ownedOptionIds: semantics.ownedOptionIds,
        ownedOptionLabels: semantics.ownedOptionLabels,
        visualKinds,
        conditionVariables,
        inlineConditions,
        inlineConditionVariables,
        hasInlineConditionals: inlineConditions.length > 0 || usable.some((row) => Boolean(row && row.hasInlineConditionals)),
        textVariables,
        logicContext: {
          conditions: semantics.conditions.map((condition) => ({
            raw: condition,
            variables: variablesFromCondition(condition)
          })),
          inlineConditions: inlineConditions.map((condition) => ({
            raw: condition,
            variables: variablesFromCondition(condition)
          })),
          reads: uniqueStrings(conditionVariables.concat(inlineConditionVariables, textVariables)),
          textVariables,
          conditionVariables,
          inlineConditionVariables,
          conditionalAlternatives
        },
        hasConditionalRows: semantics.hasConditionalRows,
        hasConditionalAlternatives: conditionalAlternatives.length > 1,
        conditionalAlternatives,
        fieldIds: usable.map((row) => safeId(row.id || [row.role || 'text', sectionId, sourceLine(row.source)].filter(Boolean).join('_'))),
        original,
        value: original,
        source: {
          path: source.path,
          line: startLine,
          endLine,
          anchorText,
          endAnchorText
        },
        editability,
        confidence: 'exact',
        reason: run.forceManual
          ? 'This text shares a source line with another parsed block, so Studio uses an advanced source slice edit.'
          : 'Exact source-backed text block can be checked before replacement.'
      };
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
      const bare = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
      while ((match = bare.exec(text)) !== null) {
        const name = match[1];
        if (!RESERVED_CONDITION_WORDS.has(name) && !/^\d/.test(name)) {
          names.push(name);
        }
      }
      return uniqueStrings(names);
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

    function renderTextBlockContent(rows) {
      const lines = [];
      const seenConditionalSourceLines = new Set();
      ensureArray(rows).forEach((row) => {
        const role = String(row.role || '');
        const text = String(row.text || '').trim();
        if (!text) {
          return;
        }
        if (lines.length && lines[lines.length - 1] !== '') {
          lines.push('');
        }
        if (role === 'heading') {
          lines.push(text.startsWith('=') ? text : '= ' + text);
        } else if (row.hasInlineConditionals && isMixedInlineConditionalSource(sourceAnchor(row))) {
          lines.push(sourceAnchor(row));
        } else if (role === 'conditional_body') {
          const source = row.source || {};
          const sourceKey = [source.path || '', sourceLine(source) || '', String(source.anchorText || '').trim()].join(':');
          if (seenConditionalSourceLines.has(sourceKey)) {
            return;
          }
          seenConditionalSourceLines.add(sourceKey);
          lines.push(String(source.anchorText || text).trim());
        } else {
          lines.push(text);
        }
      });
      return lines.join('\n').replace(/\n+$/, '') + '\n';
    }

    function sourceAnchor(row) {
      const source = row && row.source || {};
      const exact = String(source.anchorText || '').trim();
      if (exact) {
        return exact;
      }
      const original = String(row && (row.originalText || row.text) || '').trim();
      if (String(row && row.role || '') === 'heading' && !original.startsWith('=')) {
        return '= ' + original;
      }
      if (sourceLine(source) && sourceEndLine(source) && sourceLine(source) !== sourceEndLine(source)) {
        return '';
      }
      return original;
    }

    function sourceEndAnchor(row) {
      const source = row && row.source || {};
      const exact = String(source.endAnchorText || '').trim();
      if (exact) {
        return exact;
      }
      return sourceAnchor(row);
    }

    function sourceEndLine(source) {
      const ref = sourceRef(source);
      return ref.endLine || ref.line || 0;
    }

    function conditionalAlternativesForRows(rows) {
      return textBlockHelpers.conditionalAlternativesForRows(rows);
    }

    function detectVisualKinds(value) {
      return textBlockHelpers.detectVisualKinds(value);
    }

    function isBlockTextRole(role) {
      return textBlockHelpers.isBlockTextRole(role);
    }

    function isMixedInlineConditionalSource(value) {
      return textBlockHelpers.isMixedInlineConditionalSource(value);
    }

    function lastMeaningfulCondition(values) {
      return textBlockHelpers.lastMeaningfulCondition(values);
    }

    function logicalTextRuns(rows) {
      return textBlockHelpers.logicalTextRuns(rows);
    }

    function textBlockSemantics(scene, sectionId, rows, options) {
      return textBlockHelpers.textBlockSemantics(scene, sectionId, rows, options);
    }

    return {
      textBlocksForScene,
      normalizeBlockTextRows,
      blockSourceLineKey,
      textBlockFromRows,
      variablesFromCondition,
      variablesFromDendryText,
      renderTextBlockContent,
      sourceAnchor,
      sourceEndAnchor,
      sourceEndLine,
      RESERVED_CONDITION_WORDS
    };
  }

  const api = {
    create,
    RESERVED_CONDITION_WORDS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapExistingSceneTextBlockBuilder = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
