// @ts-check
(function initProjectMapExistingSceneTextBlockHelpers(global) {
  'use strict';

  /**
   * @typedef {import('../types/project_map_contracts').ExistingSceneTextBlockHelperDeps} ExistingSceneTextBlockHelperDeps
   * @typedef {import('../types/project_map_contracts').ExistingSceneTextBlockHelpersApi} ExistingSceneTextBlockHelpersApi
   * @typedef {import('../types/project_map_contracts').ExistingSceneTextBlockHelpersFactory} ExistingSceneTextBlockHelpersFactory
   * @typedef {import('../types/project_map_contracts').ExistingSceneTextBlockRow} ExistingSceneTextBlockRow
   * @typedef {import('../types/project_map_contracts').ExistingSceneOptionRow} ExistingSceneOptionRow
   * @typedef {import('../types/project_map_contracts').ExistingSceneConditionalAlternative} ExistingSceneConditionalAlternative
   * @typedef {import('../types/project_map_contracts').ExistingSceneTextBlockSemantics} ExistingSceneTextBlockSemantics
   * @typedef {import('../types/project_map_contracts').ExistingSceneLogicalTextRun} ExistingSceneLogicalTextRun
   * @typedef {import('../types/project_map_contracts').ProjectIndexScene} ProjectIndexScene
   * @typedef {import('../types/project_map_contracts').ProjectIndexSection} ProjectIndexSection
   * @typedef {import('../types/project_map_contracts').SourceRef} SourceRef
   * @typedef {import('../types/project_map_contracts').InlineConditionalSpanNode} InlineConditionalSpanNode
   */

  /**
   * @param {ExistingSceneTextBlockHelperDeps=} deps
   * @returns {ExistingSceneTextBlockHelpersApi}
   */
  function create(deps) {
    const options = deps && typeof deps === 'object' && !Array.isArray(deps) ? deps : {};
    const sourceRef = typeof options.sourceRef === 'function' ? options.sourceRef : defaultSourceRef;
    const humanSectionId = typeof options.humanSectionId === 'function' ? options.humanSectionId : defaultHumanSectionId;

    /**
     * @param {ExistingSceneTextBlockRow[]} rows
     * @returns {ExistingSceneConditionalAlternative[]}
     */
    function conditionalAlternativesForRows(rows) {
      const seen = new Set();
      /** @type {ExistingSceneConditionalAlternative[]} */
      const out = [];
      /**
       * @param {unknown} conditionInput
       * @param {unknown} textInput
       * @param {unknown} sourceInput
       */
      function push(conditionInput, textInput, sourceInput) {
        const condition = compactVisibleText(conditionInput);
        const text = compactVisibleText(textInput);
        if (!condition || !text) {
          return;
        }
        const source = sourceRef(sourceInput || {});
        const key = [condition, text, source.path || '', source.line || ''].join('|');
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        out.push({condition, text, source});
      }
      ensureArray(rows).forEach((row) => {
        if (String(row && row.role || '') === 'conditional_body') {
          push(lastMeaningfulCondition(row && row.conditions), row && row.text, row && row.source);
        }
        if (row && row.hasInlineConditionals) {
          const source = sourceRef(row.source || {});
          const raw = String(source.anchorText || row.originalText || row.text || '').trim();
          extractInlineConditionals(raw).forEach((item) => {
            push(item.condition, item.text, source);
          });
        }
      });
      return out;
    }

    /**
     * Nesting-aware companion to conditionalAlternativesForRows. Returns a tree
     * of branches so the editor can render parent -> child conditional layers
     * instead of a flattened list.
     * @param {ExistingSceneTextBlockRow[]} rows
     * @returns {Array<object>}
     */
    function conditionalTreeForRows(rows) {
      const seen = new Set();
      /** @type {Array<object>} */
      const out = [];
      /**
       * @param {unknown} conditionInput
       * @param {unknown} textInput
       * @param {Array<object>} children
       * @param {SourceRef} source
       * @param {object} [extra] Optional edit metadata (span/raw/editable/lineText).
       */
      function pushNode(conditionInput, textInput, children, source, extra) {
        const condition = compactVisibleText(conditionInput);
        if (!condition) {
          return;
        }
        const text = compactVisibleText(textInput);
        const kids = ensureArray(children);
        if (!text && !kids.length) {
          return;
        }
        const key = [condition, text, source.path || '', source.line || ''].join('|');
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        out.push(Object.assign({condition, text, children: kids, source}, extra || {}));
      }
      ensureArray(rows).forEach((row) => {
        const source = sourceRef(row && row.source || {});
        if (String(row && row.role || '') === 'conditional_body') {
          pushNode(lastMeaningfulCondition(row && row.conditions), row && row.text, [], source);
        }
        if (row && row.hasInlineConditionals) {
          // Parse against the verbatim source line (NOT trimmed) so recorded
          // offsets align with the exact string a guarded replace will splice.
          const lineText = String(source.anchorText || row.originalText || row.text || '');
          extractInlineConditionalTreeWithSpans(lineText).forEach((spanNode) => {
            const enriched = enrichEditableSpanNode(spanNode, lineText);
            pushNode(enriched.condition, enriched.text, enriched.children, source, {
              rawCondition: enriched.rawCondition,
              rawText: enriched.rawText,
              span: enriched.span,
              lineText: enriched.lineText,
              editable: enriched.editable
            });
          });
        }
      });
      return out;
    }

    /**
     * @param {ProjectIndexScene} scene
     * @param {string} sectionId
     * @param {ExistingSceneTextBlockRow[]} rows
     * @param {ExistingSceneOptionRow[]} optionRows
     * @returns {ExistingSceneTextBlockSemantics}
     */
    function textBlockSemantics(scene, sectionId, rows, optionRows) {
      const sceneId = String(scene && scene.id || '');
      const id = String(sectionId || '');
      const section = findSceneSection(scene, id);
      const incomingOptions = ensureArray(optionRows).filter((option) => sectionTargetedByOption(sceneId, id, option));
      const ownedOptions = ensureArray(optionRows).filter((option) => sectionOwnsOption(sceneId, id, option));
      const hasConditionalRows = ensureArray(rows).some((row) => String(row && row.role || '') === 'conditional_body');
      const inlineConditions = ensureArray(rows)
        .filter((row) => String(row && row.role || '') === 'conditional_body')
        .map((row) => lastMeaningfulCondition(row && row.conditions))
        .filter(Boolean);
      const sectionConditions = [
        section && section.viewIf,
        section && section.chooseIf
      ].map((value) => String(value || '').trim()).filter(Boolean);
      const conditions = uniqueStrings(sectionConditions.concat(inlineConditions));
      const sectionLabel = sectionDisplayLabel(sceneId, section, id);
      const relatedOptionIds = incomingOptions.map((option) => String(option.id || '')).filter(Boolean);
      const relatedOptionLabels = incomingOptions.map((option) => String(option.label || option.id || '')).filter(Boolean);
      const ownedOptionIds = ownedOptions.map((option) => String(option.id || '')).filter(Boolean);
      const ownedOptionLabels = ownedOptions.map((option) => String(option.label || option.id || '')).filter(Boolean);
      if (incomingOptions.length && conditions.length) {
        return {
          semanticRole: 'conditional_option_result_text',
          branchKind: ownedOptions.length ? 'option_result_menu' : 'option_result',
          label: 'Conditional option result: ' + (relatedOptionLabels.join(' / ') || sectionLabel),
          sectionLabel,
          conditions,
          relatedOptionIds,
          relatedOptionLabels,
          ownedOptionIds,
          ownedOptionLabels,
          hasConditionalRows
        };
      }
      if (incomingOptions.length) {
        return {
          semanticRole: 'option_result_text',
          branchKind: ownedOptions.length ? 'option_result_menu' : 'option_result',
          label: 'Option result: ' + (relatedOptionLabels.join(' / ') || sectionLabel),
          sectionLabel,
          conditions,
          relatedOptionIds,
          relatedOptionLabels,
          ownedOptionIds,
          ownedOptionLabels,
          hasConditionalRows
        };
      }
      if (ownedOptions.length) {
        return {
          semanticRole: 'menu_section_text',
          branchKind: conditions.length || hasConditionalRows ? 'conditional_menu' : 'menu',
          label: 'Follow-up menu: ' + sectionLabel,
          sectionLabel,
          conditions,
          relatedOptionIds,
          relatedOptionLabels,
          ownedOptionIds,
          ownedOptionLabels,
          hasConditionalRows
        };
      }
      if (conditions.length || hasConditionalRows) {
        return {
          semanticRole: 'conditional_text',
          branchKind: 'conditional',
          label: 'Conditional text: ' + sectionLabel,
          sectionLabel,
          conditions,
          relatedOptionIds,
          relatedOptionLabels,
          ownedOptionIds,
          ownedOptionLabels,
          hasConditionalRows
        };
      }
      if (isOpeningSectionId(sceneId, id)) {
        return {
          semanticRole: 'opening_text',
          branchKind: 'opening',
          label: 'Opening page text',
          sectionLabel,
          conditions,
          relatedOptionIds,
          relatedOptionLabels,
          ownedOptionIds,
          ownedOptionLabels,
          hasConditionalRows
        };
      }
      return {
        semanticRole: 'section_text',
        branchKind: 'section',
        label: 'Scene step: ' + sectionLabel,
        sectionLabel,
        conditions,
        relatedOptionIds,
        relatedOptionLabels,
        ownedOptionIds,
        ownedOptionLabels,
        hasConditionalRows
      };
    }

    /**
     * @param {string} sceneId
     * @param {ProjectIndexSection|null|undefined} section
     * @param {string} sectionId
     * @returns {string}
     */
    function sectionDisplayLabel(sceneId, section, sectionId) {
      const raw = String(sectionId || '');
      const local = raw.startsWith(sceneId + '.') ? raw.slice(sceneId.length + 1) : raw;
      return String(section && (section.title || section.subtitle) || humanSectionId(local || raw || 'opening'));
    }

    return {
      textBlockSemantics,
      detectVisualKinds,
      conditionalAlternativesForRows,
      conditionalTreeForRows,
      extractInlineConditionalTree,
      extractInlineConditionalTreeWithSpans,
      spliceInlineLeaf,
      isEditableInlineLeafValue,
      describeInlineLeafValue,
      lastMeaningfulCondition,
      isBlockTextRole,
      logicalTextRuns,
      isMixedInlineConditionalSource,
      isStructuralSceneLine,
      findSceneSection,
      sectionTargetedByOption,
      sectionOwnsOption,
      sectionIdVariants,
      optionTargetVariants,
      optionOwnerVariants,
      optionIdVariants,
      endpointVariants,
      isOpeningSectionId,
      sectionDisplayLabel
    };
  }

  /**
   * @param {unknown} value
   * @returns {string[]}
   */
  function detectVisualKinds(value) {
    const text = String(value || '');
    const kinds = [];
    if (/<\s*(?:table|thead|tbody|tfoot|tr|th|td|caption)\b/i.test(text) ||
        /\b(?:chart|graph|canvas)\b/i.test(text) ||
        /<\s*(?:canvas|svg)\b/i.test(text)) {
      kinds.push('chart');
    }
    if (/<\s*img\b/i.test(text) ||
        /!\[[^\]]*\]\([^)]+\.(?:png|jpe?g|gif|webp|svg)(?:[?#][^)]*)?\)/i.test(text) ||
        /\b(?:img|images|assets|out\/html\/img)\/[^\s'"<>]+\.(?:png|jpe?g|gif|webp|svg)\b/i.test(text)) {
      kinds.push('asset');
    }
    if (/<\s*[a-z][a-z0-9-]*\b/i.test(text)) {
      kinds.push('html');
    }
    return uniqueStrings(kinds);
  }

  /**
   * @param {unknown} values
   * @returns {string}
   */
  function lastMeaningfulCondition(values) {
    const rows = ensureArray(values).map((value) => String(value || '').trim()).filter(Boolean);
    return rows.length ? rows[rows.length - 1] : '';
  }

  /**
   * @param {unknown} value
   * @returns {string}
   */
  function compactVisibleText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * @param {unknown} value
   * @returns {Array<{condition: string, text: string}>}
   */
  function extractInlineConditionals(value) {
    const out = [];
    const text = String(value || '');
    let pos = 0;
    while (pos < text.length) {
      const openIndex = text.indexOf('[?', pos);
      if (openIndex < 0) break;
      const afterOpen = openIndex + 2;
      const ifMatch = text.slice(afterOpen).match(/^\s*if\s+/);
      if (!ifMatch) { pos = afterOpen; continue; }
      const conditionStart = afterOpen + ifMatch[0].length;
      const colonIndex = text.indexOf(':', conditionStart);
      if (colonIndex < 0) { pos = conditionStart; continue; }
      const condition = text.slice(conditionStart, colonIndex).trim();
      const bodyStart = colonIndex + 1;
      let depth = 1;
      let i = bodyStart;
      while (i < text.length && depth > 0) {
        if (text[i] === '[' && i + 1 < text.length && text[i + 1] === '?') {
          depth++;
          i += 2;
        } else if (text[i] === '?' && i + 1 < text.length && text[i + 1] === ']') {
          depth--;
          if (depth === 0) break;
          i += 2;
        } else {
          i++;
        }
      }
      if (depth === 0) {
        const body = text.slice(bodyStart, i).trim();
        const compactCondition = compactVisibleText(condition);
        const compactBody = compactVisibleText(body);
        if (compactCondition && compactBody) {
          out.push({condition: compactCondition, text: compactBody});
        }
        extractInlineConditionals(body).forEach((inner) => out.push(inner));
        pos = i + 2;
      } else {
        pos = conditionStart;
      }
    }
    return out;
  }

  /**
   * Nesting-aware variant of extractInlineConditionals. Unlike the flat
   * extractor (which spreads inner conditionals into sibling rows), this keeps
   * the parent -> child structure so the editor can render the branch tree.
   * @param {unknown} value
   * @returns {Array<{condition: string, text: string, children: Array<object>}>}
   */
  function extractInlineConditionalTree(value) {
    const out = [];
    const text = String(value || '');
    let pos = 0;
    while (pos < text.length) {
      const openIndex = text.indexOf('[?', pos);
      if (openIndex < 0) break;
      const afterOpen = openIndex + 2;
      const ifMatch = text.slice(afterOpen).match(/^\s*if\s+/);
      if (!ifMatch) { pos = afterOpen; continue; }
      const conditionStart = afterOpen + ifMatch[0].length;
      const colonIndex = text.indexOf(':', conditionStart);
      if (colonIndex < 0) { pos = conditionStart; continue; }
      const condition = text.slice(conditionStart, colonIndex).trim();
      const bodyStart = colonIndex + 1;
      let depth = 1;
      let i = bodyStart;
      while (i < text.length && depth > 0) {
        if (text[i] === '[' && i + 1 < text.length && text[i + 1] === '?') {
          depth++;
          i += 2;
        } else if (text[i] === '?' && i + 1 < text.length && text[i + 1] === ']') {
          depth--;
          if (depth === 0) break;
          i += 2;
        } else {
          i++;
        }
      }
      if (depth === 0) {
        const body = text.slice(bodyStart, i).trim();
        const children = extractInlineConditionalTree(body);
        const ownText = compactVisibleText(stripNestedConditionals(body));
        const compactCondition = compactVisibleText(condition);
        if (compactCondition && (ownText || children.length)) {
          out.push({condition: compactCondition, text: ownText, children});
        }
        pos = i + 2;
      } else {
        pos = conditionStart;
      }
    }
    return out;
  }

  /**
   * Removes balanced [? ... ?] spans so a branch can report only its own
   * directly-visible text, leaving nested branches to the children entries.
   * @param {unknown} value
   * @returns {string}
   */
  function stripNestedConditionals(value) {
    const text = String(value || '');
    let out = '';
    let pos = 0;
    while (pos < text.length) {
      const openIndex = text.indexOf('[?', pos);
      if (openIndex < 0) {
        out += text.slice(pos);
        break;
      }
      out += text.slice(pos, openIndex);
      let depth = 1;
      let i = openIndex + 2;
      while (i < text.length && depth > 0) {
        if (text[i] === '[' && i + 1 < text.length && text[i + 1] === '?') {
          depth++;
          i += 2;
        } else if (text[i] === '?' && i + 1 < text.length && text[i + 1] === ']') {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      if (depth === 0) {
        pos = i;
      } else {
        // Unbalanced: keep the remainder verbatim rather than dropping text.
        out += text.slice(openIndex);
        break;
      }
    }
    return out;
  }

  /**
   * Position-preserving variant of extractInlineConditionalTree. In addition to
   * the display condition/text, every node records absolute offsets (UTF-16
   * code units) into the original line so the editor can rewrite a single leaf
   * by splicing only the trimmed condition/text range and leave every other
   * byte of the line byte-identical. Offsets are rebased into `base` for nested
   * children so they remain valid against the top-level line.
   * @param {unknown} value
   * @param {number} [base]
   * @returns {Array<InlineConditionalSpanNode>}
   */
  function extractInlineConditionalTreeWithSpans(value, base) {
    const offset = Number(base || 0);
    const text = String(value || '');
    /** @type {Array<InlineConditionalSpanNode>} */
    const out = [];
    let pos = 0;
    while (pos < text.length) {
      const openIndex = text.indexOf('[?', pos);
      if (openIndex < 0) break;
      const afterOpen = openIndex + 2;
      const ifMatch = text.slice(afterOpen).match(/^\s*if\s+/);
      if (!ifMatch) { pos = afterOpen; continue; }
      const conditionStart = afterOpen + ifMatch[0].length;
      const colonIndex = text.indexOf(':', conditionStart);
      if (colonIndex < 0) { pos = conditionStart; continue; }
      const condTrim = trimmedRange(text, conditionStart, colonIndex);
      const bodyStart = colonIndex + 1;
      let depth = 1;
      let i = bodyStart;
      while (i < text.length && depth > 0) {
        if (text[i] === '[' && i + 1 < text.length && text[i + 1] === '?') { depth += 1; i += 2; }
        else if (text[i] === '?' && i + 1 < text.length && text[i + 1] === ']') { depth -= 1; if (depth === 0) break; i += 2; }
        else { i += 1; }
      }
      if (depth === 0) {
        const bodyEnd = i;
        const bodyText = text.slice(bodyStart, bodyEnd);
        const children = extractInlineConditionalTreeWithSpans(bodyText, offset + bodyStart);
        const textTrim = trimmedRange(text, bodyStart, bodyEnd);
        const rawCondition = text.slice(condTrim.start, condTrim.end);
        const rawText = text.slice(textTrim.start, textTrim.end);
        if (compactVisibleText(rawCondition) && (compactVisibleText(stripNestedConditionals(rawText)) || children.length)) {
          out.push({
            condition: compactVisibleText(rawCondition),
            text: compactVisibleText(stripNestedConditionals(rawText)),
            children,
            hasChildren: children.length > 0,
            spanStart: offset + openIndex,
            spanEnd: offset + i + 2,
            condStart: offset + condTrim.start,
            condEnd: offset + condTrim.end,
            rawCondition,
            textStart: offset + textTrim.start,
            textEnd: offset + textTrim.end,
            rawText
          });
        }
        pos = i + 2;
      } else {
        pos = conditionStart;
      }
    }
    return out;
  }

  /**
   * Trims surrounding whitespace from a [start, end) slice and returns the
   * tightened range so callers splice only the meaningful condition/text.
   * @param {string} text
   * @param {number} start
   * @param {number} end
   * @returns {{start: number, end: number}}
   */
  function trimmedRange(text, start, end) {
    let s = start;
    let e = end;
    while (s < e && /\s/.test(text[s])) s += 1;
    while (e > s && /\s/.test(text[e - 1])) e -= 1;
    return {start: s, end: e};
  }

  /**
   * Rewrites a single inline-conditional leaf by replacing only its recorded
   * trimmed condition/text ranges. Edits are applied later-range-first so
   * earlier offsets stay valid, which keeps every unedited byte (delimiters,
   * spacing, sibling and nested branches) identical. Callers must validate the
   * incoming values with isEditableInlineLeafValue first.
   * @param {unknown} line
   * @param {InlineConditionalSpanNode} leaf
   * @param {{condition?: string, text?: string}} next
   * @returns {string}
   */
  function spliceInlineLeaf(line, leaf, next) {
    const source = String(line || '');
    if (!leaf || !next) {
      return source;
    }
    const edits = [];
    if (Object.prototype.hasOwnProperty.call(next, 'text') && typeof next.text === 'string') {
      edits.push({start: leaf.textStart, end: leaf.textEnd, value: next.text});
    }
    if (Object.prototype.hasOwnProperty.call(next, 'condition') && typeof next.condition === 'string') {
      edits.push({start: leaf.condStart, end: leaf.condEnd, value: next.condition});
    }
    edits.sort((a, b) => b.start - a.start);
    let out = source;
    for (const ed of edits) {
      if (!Number.isInteger(ed.start) || !Number.isInteger(ed.end) || ed.start < 0 || ed.end > out.length || ed.start > ed.end) {
        return source;
      }
      out = out.slice(0, ed.start) + ed.value + out.slice(ed.end);
    }
    return out;
  }

  /**
   * Explains whether a proposed leaf condition/text value can be safely spliced
   * back into the inline-conditional grammar. A value carrying a '[?' or '?]'
   * delimiter could split or merge branches; an empty or ':'-carrying condition
   * could be read as a body separator. Returns a stable reason code so the
   * editor can surface inline feedback instead of silently downgrading to a
   * manual snippet. This is the single source of truth for the guard.
   * @param {unknown} value
   * @param {"text"|"condition"} kind
   * @returns {{ok: boolean, code: string}}
   */
  function describeInlineLeafValue(value, kind) {
    const text = String(value == null ? '' : value);
    if (text.indexOf('[?') !== -1 || text.indexOf('?]') !== -1) {
      return {ok: false, code: 'delimiter'};
    }
    if (kind === 'condition') {
      if (!text.trim()) {
        return {ok: false, code: 'empty_condition'};
      }
      if (text.indexOf(':') !== -1) {
        return {ok: false, code: 'condition_colon'};
      }
    }
    return {ok: true, code: ''};
  }

  /**
   * Guards a proposed leaf condition/text value against characters that would
   * break the inline-conditional grammar when spliced back. Such edits must stay
   * manual. Boolean facade over describeInlineLeafValue.
   * @param {unknown} value
   * @param {"text"|"condition"} kind
   * @returns {boolean}
   */
  function isEditableInlineLeafValue(value, kind) {
    return describeInlineLeafValue(value, kind).ok;
  }

  /**
   * True when every '[?' opener in the line has a matching '?]' closer and no
   * closer appears before its opener. A leaf is only structurally editable when
   * its line is balanced, so a malformed line stays manual.
   * @param {unknown} value
   * @returns {boolean}
   */
  function inlineConditionalsBalanced(value) {
    const text = String(value || '');
    let depth = 0;
    let i = 0;
    while (i < text.length) {
      if (text[i] === '[' && text[i + 1] === '?') { depth += 1; i += 2; }
      else if (text[i] === '?' && text[i + 1] === ']') { depth -= 1; if (depth < 0) return false; i += 2; }
      else { i += 1; }
    }
    return depth === 0;
  }

  /**
   * Maps a raw span node (from extractInlineConditionalTreeWithSpans) into the
   * display node shape used by the conditional tree, attaching per-leaf edit
   * metadata: the verbatim condition/text, the splice span, the source line the
   * offsets index into, and an `editable` flag. Only leaves (no children) on a
   * balanced line with grammar-safe current values are marked editable; the
   * final source-uniqueness guard is applied later by the edit model.
   * @param {InlineConditionalSpanNode} spanNode
   * @param {string} lineText
   * @returns {object}
   */
  function enrichEditableSpanNode(spanNode, lineText) {
    const children = ensureArray(spanNode && spanNode.children).map((child) => enrichEditableSpanNode(child, lineText));
    const isLeaf = children.length === 0;
    const span = {
      spanStart: spanNode.spanStart,
      spanEnd: spanNode.spanEnd,
      condStart: spanNode.condStart,
      condEnd: spanNode.condEnd,
      textStart: spanNode.textStart,
      textEnd: spanNode.textEnd
    };
    const offsetsValid = [span.spanStart, span.spanEnd, span.condStart, span.condEnd, span.textStart, span.textEnd]
      .every((value) => Number.isInteger(value) && value >= 0);
    const editable = isLeaf
      && offsetsValid
      && inlineConditionalsBalanced(lineText)
      && isEditableInlineLeafValue(spanNode.rawText, 'text')
      && isEditableInlineLeafValue(spanNode.rawCondition, 'condition');
    return {
      condition: spanNode.condition,
      text: spanNode.text,
      children,
      rawCondition: spanNode.rawCondition,
      rawText: spanNode.rawText,
      span,
      lineText,
      editable
    };
  }

  /**
   * @param {unknown} role
   * @returns {boolean}
   */
  function isBlockTextRole(role) {
    const text = String(role || '');
    return text === 'heading' || text === 'body' || text === 'conditional_body';
  }

  /**
   * @param {ExistingSceneTextBlockRow[]} rows
   * @returns {ExistingSceneLogicalTextRun[]}
   */
  function logicalTextRuns(rows) {
    /** @type {ExistingSceneLogicalTextRun[]} */
    const runs = [];
    /** @type {ExistingSceneLogicalTextRun|null} */
    let current = null;
    ensureArray(rows).forEach((row) => {
      const kind = String(row && row.role || '') === 'conditional_body' ? 'conditional' : 'prose';
      if (!current || current.kind !== kind) {
        current = {kind, rows: []};
        runs.push(current);
      }
      current.rows.push(row);
    });
    return runs;
  }

  /**
   * @param {unknown} value
   * @returns {boolean}
   */
  function isMixedInlineConditionalSource(value) {
    const text = String(value || '').trim();
    if (!/\[\?\s*if\s+/i.test(text)) {
      return false;
    }
    const remainder = text.replace(/\[\?\s*if\s+.+?\s*:\s*.*?\s*\?\]/g, ' ').replace(/\s+/g, ' ').trim();
    return Boolean(remainder && !isStructuralSceneLine(remainder));
  }

  /**
   * @param {unknown} value
   * @returns {boolean}
   */
  function isStructuralSceneLine(value) {
    const text = String(value || '').trim();
    if (!text) {
      return true;
    }
    if (/^(#|@|-|=)/.test(text)) {
      return true;
    }
    if (/^[A-Za-z][A-Za-z0-9_-]*\s*:/.test(text)) {
      return true;
    }
    if (/\bQ(?:\.[A-Za-z_][A-Za-z0-9_]*|\[\s*['"][^'"]+['"]\s*\])\s*(?:[+\-*/%]?=|\+\+|--)/.test(text)) {
      return true;
    }
    return false;
  }

  /**
   * @param {ProjectIndexScene} scene
   * @param {string} sectionId
   * @returns {ProjectIndexSection|null}
   */
  function findSceneSection(scene, sectionId) {
    const id = String(sectionId || '');
    if (!id) {
      return null;
    }
    const sceneId = String(scene && scene.id || '');
    const variants = new Set(sectionIdVariants(sceneId, id));
    return ensureArray(scene && scene.sections).find((section) => {
      return variants.has(String(section && section.id || ''));
    }) || null;
  }

  /**
   * @param {string} sceneId
   * @param {string} sectionId
   * @param {ExistingSceneOptionRow} option
   * @returns {boolean}
   */
  function sectionTargetedByOption(sceneId, sectionId, option) {
    const sectionVariants = new Set(sectionIdVariants(sceneId, sectionId));
    if (!sectionVariants.size) {
      return false;
    }
    return optionTargetVariants(sceneId, option).some((candidate) => sectionVariants.has(candidate));
  }

  /**
   * @param {string} sceneId
   * @param {string} sectionId
   * @param {ExistingSceneOptionRow} option
   * @returns {boolean}
   */
  function sectionOwnsOption(sceneId, sectionId, option) {
    const sectionVariants = new Set(sectionIdVariants(sceneId, sectionId));
    if (!sectionVariants.size) {
      return false;
    }
    return optionOwnerVariants(sceneId, option).some((candidate) => sectionVariants.has(candidate));
  }

  /**
   * @param {string} sceneId
   * @param {string} sectionId
   * @returns {string[]}
   */
  function sectionIdVariants(sceneId, sectionId) {
    const raw = String(sectionId || '').trim();
    if (!raw) {
      return [];
    }
    const variants = [raw];
    const local = raw.startsWith(sceneId + '.') ? raw.slice(sceneId.length + 1) : raw;
    if (local && local !== raw) {
      variants.push(local);
    }
    if (sceneId && local && raw.indexOf('.') < 0) {
      variants.push(sceneId + '.' + local);
    }
    return uniqueStrings(variants);
  }

  /**
   * @param {string} sceneId
   * @param {ExistingSceneOptionRow} option
   * @returns {string[]}
   */
  function optionTargetVariants(sceneId, option) {
    const values = [
      option && option.targetId,
      option && option.rawTargetId,
      option && option.id
    ];
    return endpointVariants(sceneId, values);
  }

  /**
   * @param {string} sceneId
   * @param {ExistingSceneOptionRow} option
   * @returns {string[]}
   */
  function optionOwnerVariants(sceneId, option) {
    return endpointVariants(sceneId, [option && option.sectionId]);
  }

  /**
   * @param {string} sceneId
   * @param {unknown[]|unknown} values
   * @returns {string[]}
   */
  function endpointVariants(sceneId, values) {
    const rows = Array.isArray(values) ? values : [values];
    const out = [];
    rows.forEach((value) => {
      const text = String(value || '').trim().replace(/^[@#]/, '');
      if (!text) {
        return;
      }
      out.push.apply(out, sectionIdVariants(sceneId, text));
    });
    return uniqueStrings(out);
  }

  /**
   * @param {string} sceneId
   * @param {ExistingSceneOptionRow} option
   * @returns {string[]}
   */
  function optionIdVariants(sceneId, option) {
    const values = [
      option && option.targetId,
      option && option.rawTargetId,
      option && option.id,
      option && option.sectionId
    ];
    return endpointVariants(sceneId, values);
  }

  /**
   * @param {string} sceneId
   * @param {string} sectionId
   * @returns {boolean}
   */
  function isOpeningSectionId(sceneId, sectionId) {
    const text = String(sectionId || '').trim();
    if (!text) {
      return true;
    }
    const local = text.startsWith(sceneId + '.') ? text.slice(sceneId.length + 1) : text;
    return /^(?:start|opening|intro|main)$/i.test(local);
  }

  /**
   * @param {unknown} value
   * @returns {any[]}
   */
  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  /**
   * @param {unknown[]} values
   * @returns {string[]}
   */
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

  /**
   * @param {unknown} source
   * @returns {SourceRef}
   */
  function defaultSourceRef(source) {
    /** @type {Record<string, any>} */
    const value = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    const line = numberOrNull(value.line || value.startLine);
    const endLine = numberOrNull(value.endLine || value.line || value.startLine);
    return {
      path: String(value.path || '').trim(),
      line,
      startLine: line,
      endLine,
      anchorText: String(value.anchorText || '').trim(),
      endAnchorText: String(value.endAnchorText || '').trim()
    };
  }

  /**
   * @param {unknown} value
   * @returns {number|null}
   */
  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? Math.floor(num) : null;
  }

  /**
   * @param {string} sectionId
   * @returns {string}
   */
  function defaultHumanSectionId(sectionId) {
    const text = String(sectionId || '');
    const last = text.includes('.') ? text.split('.').pop() : text;
    return last.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /** @type {ExistingSceneTextBlockHelpersFactory} */
  const api = {create, describeInlineLeafValue, isEditableInlineLeafValue};

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapExistingSceneTextBlockHelpers = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
