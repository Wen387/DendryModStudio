// @ts-check
(function initProjectMapEventSourceUnitModel(global) {
  'use strict';

  const METADATA_DIRECTIVES = new Set([
    'title',
    'subtitle',
    'tags',
    'new-page',
    'is-card',
    'is-special',
    'priority',
    'frequency',
    'frequency-var',
    'order',
    'max-visits',
    'max-visits-var',
    'count-visits',
    'count-visits-var',
    'view-if'
  ]);
  const HOOK_DIRECTIVES = new Set(['on-arrival', 'on-display', 'on-departure']);
  const ROUTE_DIRECTIVES = new Set([
    'go-to',
    'go-to-ref',
    'call',
    'set-jump',
    'check-success-go-to',
    'check-failure-go-to'
  ]);
  const ASSET_DIRECTIVES = new Set([
    'face-image',
    'card-image',
    'set-bg',
    'audio',
    'set-music',
    'set-sprites'
  ]);
  const CONDITION_DIRECTIVES = new Set([
    'choose-if',
    'unavailable-subtitle',
    'unavailablesubtitle'
  ]);

  function parseEventSourceUnits(source, options) {
    const opts = isObject(options) ? options : {};
    const text = String(source || '');
    const lines = text.split(/\r?\n/);
    const units = [];
    const coveredLines = new Set();
    const directiveCounts = {};
    let currentSection = '';
    let inRawBlock = null;

    lines.forEach((line, index) => {
      const lineNo = index + 1;
      const trimmed = line.trim();
      if (inRawBlock) {
        inRawBlock.lines.push(line);
        inRawBlock.endLine = lineNo;
        coverLine(coveredLines, lineNo);
        if (rawBlockLineCloses(inRawBlock, line)) {
          finishRawBlock(units, inRawBlock);
          inRawBlock = null;
        }
        return;
      }
      if (!trimmed) {
        units.push(unit('blank', 'blank', opts, lineNo, lineNo, line, {
          coverageClass: 'preserved',
          ownerSectionId: currentSection
        }));
        coverLine(coveredLines, lineNo);
        return;
      }

      const section = line.match(/^\s*@([A-Za-z_][A-Za-z0-9_.-]*)\s*$/);
      if (section) {
        currentSection = section[1];
        units.push(unit('section_header', 'section:' + currentSection, opts, lineNo, lineNo, line, {
          coverageClass: 'structured',
          ownerSectionId: currentSection,
          sectionId: currentSection
        }));
        coverLine(coveredLines, lineNo);
        return;
      }

      const option = line.match(/^\s*-\s+([@#])?([A-Za-z_][A-Za-z0-9_.-]*)(?::\s*(.*))?$/);
      if (option) {
        const id = option[2];
        units.push(unit('option_label', 'option:' + id, opts, lineNo, lineNo, line, {
          coverageClass: 'structured',
          ownerSectionId: currentSection,
          optionId: id,
          routeTarget: id,
          routePrefix: option[1] || ''
        }));
        coverLine(coveredLines, lineNo);
        return;
      }

      const heading = line.match(/^\s*=\s+(.*)$/);
      if (heading) {
        units.push(unit('heading', 'heading:' + (currentSection || 'root'), opts, lineNo, lineNo, line, {
          coverageClass: 'structured',
          ownerSectionId: currentSection
        }));
        coverLine(coveredLines, lineNo);
        return;
      }

      const directive = line.match(/^\s*([A-Za-z][A-Za-z0-9_-]*(?: [A-Za-z][A-Za-z0-9_-]*)*)\s*:\s*(.*)$/);
      if (directive) {
        const key = directive[1].trim();
        const normalizedKey = key.toLowerCase();
        if (!looksLikeSourceDirectiveKey(key)) {
          units.push(unit('body_text', 'body:' + (currentSection || 'root') + ':' + lineNo, opts, lineNo, lineNo, line, {
            coverageClass: 'source_backed_editable',
            ownerSectionId: currentSection
          }));
          coverLine(coveredLines, lineNo);
          return;
        }
        directiveCounts[normalizedKey] = (directiveCounts[normalizedKey] || 0) + 1;
        if (directive[2].indexOf('{!') >= 0) {
          inRawBlock = {
            directive: key,
            normalizedDirective: normalizedKey,
            startLine: lineNo,
            endLine: lineNo,
            lines: [line],
            ownerSectionId: currentSection,
            sourcePath: opts.path || ''
          };
          coverLine(coveredLines, lineNo);
          if (rawBlockLineCloses(inRawBlock, line)) {
            finishRawBlock(units, inRawBlock);
            inRawBlock = null;
          }
          return;
        }
        units.push(unit(kindForDirective(normalizedKey), key, opts, lineNo, lineNo, line, {
          coverageClass: coverageClassForDirective(normalizedKey),
          directive: key,
          normalizedDirective: normalizedKey,
          ownerSectionId: currentSection,
          semanticRole: semanticRoleForDirective(normalizedKey)
        }));
        coverLine(coveredLines, lineNo);
        return;
      }

      const effect = line.match(/^\s*(?:Q\.)?([A-Za-z_][A-Za-z0-9_.[\]'"]*)\s*(=|\+=|-=|\*=|\/=)\s*(.*?);?\s*$/);
      if (effect) {
        units.push(unit('effect_line', 'effect:' + effect[1], opts, lineNo, lineNo, line, {
          coverageClass: ['=', '+=', '-='].includes(effect[2]) ? 'structured' : 'source_backed_editable',
          ownerSectionId: currentSection,
          variable: effect[1],
          op: effect[2]
        }));
        coverLine(coveredLines, lineNo);
        return;
      }

      units.push(unit('body_text', 'body:' + (currentSection || 'root') + ':' + lineNo, opts, lineNo, lineNo, line, {
        coverageClass: 'source_backed_editable',
        ownerSectionId: currentSection
      }));
      coverLine(coveredLines, lineNo);
    });

    if (inRawBlock) {
      finishRawBlock(units, inRawBlock);
    }

    const nonEmptyLines = lines
      .map((line, index) => ({line: index + 1, text: line}))
      .filter((row) => row.text.trim());
    const uncovered = nonEmptyLines
      .filter((row) => !coveredLines.has(row.line))
      .map((row) => ({line: row.line, text: row.text}));

    return {
      kind: 'event_source_units',
      path: opts.path || '',
      lineCount: lines.length,
      nonEmptyLineCount: nonEmptyLines.length,
      coveredNonEmptyLineCount: nonEmptyLines.length - uncovered.length,
      uncoveredNonEmptyLines: uncovered,
      coverageComplete: uncovered.length === 0,
      units,
      countsByKind: countBy(units, (item) => item.kind),
      countsByCoverageClass: countBy(units, (item) => item.coverageClass || 'unknown'),
      directiveCounts,
      sourceManifest: sourceManifest(text),
      summary: {
        units: units.length,
        sections: units.filter((item) => item.kind === 'section_header').length,
        options: units.filter((item) => item.kind === 'option_label').length,
        hooks: units.filter((item) => item.kind === 'hook' || item.kind === 'raw_hook_block').length,
        routes: units.filter((item) => item.kind === 'route').length,
        assets: units.filter((item) => item.kind === 'asset').length,
        rawBlocks: units.filter((item) => item.kind === 'raw_hook_block' || item.kind === 'raw_source_block').length
      }
    };
  }

  function reconstructSourceFromUnits(parsed) {
    const units = parsed && Array.isArray(parsed.units) ? parsed.units : [];
    const ordered = units.slice().sort((left, right) => {
      const leftLine = left && left.source ? left.source.startLine || left.source.line || 0 : 0;
      const rightLine = right && right.source ? right.source.startLine || right.source.line || 0 : 0;
      return leftLine - rightLine;
    });
    return ordered.map((item) => String(item && item.text || '')).join('\n');
  }

  function finishRawBlock(units, block) {
    const directive = block.normalizedDirective || String(block.directive || '').toLowerCase();
    const isHook = HOOK_DIRECTIVES.has(directive);
    units.push(unit(isHook ? 'raw_hook_block' : 'raw_source_block', block.directive, {
      path: block.sourcePath || ''
    }, block.startLine, block.endLine, block.lines.join('\n'), {
      coverageClass: 'source_backed_editable',
      directive: block.directive,
      normalizedDirective: directive,
      ownerSectionId: block.ownerSectionId,
      semanticRole: isHook ? 'hook_raw_js' : 'raw_js',
      safetyClass: 'advanced_source_patch'
    }));
  }

  function rawBlockLineCloses(block, line) {
    const value = isObject(block) ? block : {};
    let quote = String(value.quote || '');
    let escaped = Boolean(value.escaped);
    const text = String(line || '');
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1] || '';
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === quote) {
          quote = '';
        }
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        quote = char;
        escaped = false;
        continue;
      }
      if (char === '/' && next === '/') {
        break;
      }
      if (char === '!' && next === '}') {
        value.quote = quote;
        value.escaped = escaped;
        return true;
      }
    }
    value.quote = quote;
    value.escaped = escaped;
    return false;
  }

  function kindForDirective(key) {
    if (METADATA_DIRECTIVES.has(key)) {
      return 'metadata';
    }
    if (HOOK_DIRECTIVES.has(key)) {
      return 'hook';
    }
    if (ROUTE_DIRECTIVES.has(key)) {
      return 'route';
    }
    if (ASSET_DIRECTIVES.has(key)) {
      return 'asset';
    }
    if (CONDITION_DIRECTIVES.has(key)) {
      return 'condition';
    }
    return 'directive';
  }

  function semanticRoleForDirective(key) {
    if (METADATA_DIRECTIVES.has(key)) {
      return 'event_metadata';
    }
    if (HOOK_DIRECTIVES.has(key)) {
      return 'lifecycle_hook';
    }
    if (ROUTE_DIRECTIVES.has(key)) {
      return 'route';
    }
    if (ASSET_DIRECTIVES.has(key)) {
      return 'asset';
    }
    if (CONDITION_DIRECTIVES.has(key)) {
      return 'condition';
    }
    return 'source_directive';
  }

  function coverageClassForDirective(key) {
    if (
      METADATA_DIRECTIVES.has(key) ||
      HOOK_DIRECTIVES.has(key) ||
      ROUTE_DIRECTIVES.has(key) ||
      ASSET_DIRECTIVES.has(key) ||
      CONDITION_DIRECTIVES.has(key)
    ) {
      return 'structured';
    }
    return 'source_backed_editable';
  }

  function isKnownDirectiveKey(key) {
    const normalized = String(key || '').trim().toLowerCase();
    return METADATA_DIRECTIVES.has(normalized) ||
      HOOK_DIRECTIVES.has(normalized) ||
      ROUTE_DIRECTIVES.has(normalized) ||
      ASSET_DIRECTIVES.has(normalized) ||
      CONDITION_DIRECTIVES.has(normalized);
  }

  function looksLikeSourceDirectiveKey(key) {
    const text = String(key || '').trim();
    if (isKnownDirectiveKey(text)) {
      return true;
    }
    return /^[a-z][a-z0-9_-]*$/.test(text);
  }

  function unit(kind, id, opts, startLine, endLine, text, extra) {
    return Object.assign({
      kind,
      id: String(id || kind) + ':' + startLine,
      source: {
        path: opts && opts.path || '',
        line: startLine,
        startLine,
        endLine
      },
      text: String(text || ''),
      editability: kind === 'blank' ? 'preserved' : (extra && extra.coverageClass === 'structured' ? 'guarded_apply' : 'advanced_source_patch')
    }, extra || {});
  }

  function coverLine(lines, lineNo) {
    lines.add(lineNo);
  }

  function countBy(items, keyFn) {
    return items.reduce((out, item) => {
      const key = String(keyFn(item) || 'unknown');
      out[key] = (out[key] || 0) + 1;
      return out;
    }, {});
  }

  function sourceManifest(text) {
    const source = String(text || '');
    return {
      bytes: byteLengthUtf8(source),
      lines: source.split(/\r?\n/).length,
      checksum: fnv1a(source)
    };
  }

  function fnv1a(text) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash >>> 0, 0x01000193);
    }
    return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  }

  function byteLengthUtf8(text) {
    if (typeof Buffer !== 'undefined' && Buffer.byteLength) {
      return Buffer.byteLength(text, 'utf8');
    }
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(text).length;
    }
    return unescape(encodeURIComponent(text)).length;
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {
    parseEventSourceUnits,
    reconstructSourceFromUnits,
    METADATA_DIRECTIVES,
    HOOK_DIRECTIVES,
    ROUTE_DIRECTIVES,
    ASSET_DIRECTIVES,
    CONDITION_DIRECTIVES
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapEventSourceUnitModel = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
