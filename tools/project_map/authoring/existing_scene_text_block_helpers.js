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
    const re = /\[\?\s*if\s+([\s\S]+?)\s*:\s*([\s\S]*?)\s*\?\]/g;
    let match;
    while ((match = re.exec(text)) !== null) {
      const condition = compactVisibleText(match[1]);
      const body = compactVisibleText(match[2]);
      if (condition && body) {
        out.push({condition, text: body});
      }
    }
    return out;
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
  const api = {create};

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapExistingSceneTextBlockHelpers = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
