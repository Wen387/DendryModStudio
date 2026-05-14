(function initProjectMapExistingSceneLogicFields(global) {
  'use strict';

  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const ROUTE_TARGET_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function ownershipMatchingApi() {
    if (global && global.ProjectMapOwnershipMatching) {
      return global.ProjectMapOwnershipMatching;
    }
    if (typeof require === 'function') {
      try {
        return require('./ownership_matching_model.js');
      } catch (_err) {
        return null;
      }
    }
    return null;
  }

  function buildRouteFields(scene, options) {
    const sceneId = String(scene && scene.id || '');
    const fields = ensureArray(options).map((option, index) => {
      const rawTarget = String(option.rawTargetId || option.targetId || '').trim();
      const target = String(option.targetId || rawTarget).trim();
      if (!target) {
        return null;
      }
      const source = sourceRef(option.source || {});
      const search = routeSearchToken(source.anchorText, rawTarget) || '@' + rawTarget;
      const guarded = canGuardField(source, search) && Boolean(search);
      return {
        id: safeId('route_' + (option.id || index + 1)),
        role: 'route',
        label: 'Route target: ' + (option.label || option.id || target),
        original: rawTarget,
        value: rawTarget,
        source,
        sourcePath: source.path || '',
        editability: guarded ? 'guarded_replace_text' : 'advanced_source_patch',
        owner: {sceneId, sectionId: String(option.sectionId || ''), itemId: String(option.id || ''), kind: 'route'},
        sectionId: String(option.sectionId || ''),
        optionId: String(option.id || ''),
        inputType: 'text',
        transform: 'route_target',
        searchText: search,
        confidence: guarded ? 'exact' : 'approximate',
        reason: guarded
          ? 'Route target token has exact line evidence and can be checked before replacement.'
          : 'Route target needs the source slice editor and an advanced apply confirmation.'
      };
    }).filter(Boolean);
    return fields.concat(routeFieldsFromScene(scene));
  }

  function routeFieldsFromScene(scene) {
    const fields = [];
    const sceneId = String(scene && scene.id || '');
    if (!sceneId) {
      return fields;
    }
    collectRouteOwners(scene).forEach((owner) => {
      Object.keys(owner.routes || {}).forEach((fieldName) => {
        const routes = ensureArray(owner.routes[fieldName]);
        routes.forEach((route, index) => {
          const rawTarget = String(route && route.id || '').trim();
          if (!rawTarget) {
            return;
          }
          const rawClause = String(route && (route.raw || route.id) || rawTarget).trim();
          const source = routeSource(owner.item, scene, fieldName);
          const search = rawClause || rawTarget;
          const guarded = canGuardField(source, search) && Boolean(search);
          fields.push({
            id: safeId('route_' + owner.id + '_' + fieldName + '_' + (index + 1)),
            role: 'route',
            label: 'Go-to target: ' + owner.label,
            original: rawTarget,
            value: rawTarget,
            source,
            sourcePath: source.path || '',
            editability: guarded ? 'guarded_replace_text' : 'advanced_source_patch',
            owner: {sceneId, sectionId: owner.sectionId, itemId: fieldName, kind: 'route'},
            sectionId: owner.sectionId,
            optionId: '',
            inputType: 'text',
            transform: 'goto_route_target',
            routeKind: fieldName,
            routePredicate: String(route && route.predicate || ''),
            routeRaw: rawClause,
            searchText: search,
            confidence: guarded ? 'exact' : 'approximate',
            reason: guarded
              ? 'Go-to route clause has exact line evidence and can be checked before replacement.'
              : 'Go-to route needs the source slice editor and an advanced apply confirmation.'
          });
        });
      });
    });
    return fields;
  }

  function collectRouteOwners(scene) {
    const sceneId = String(scene && scene.id || '');
    const owners = [{
      id: sceneId || 'scene',
      sectionId: '',
      label: scene && (scene.title || scene.id) || 'Scene',
      item: scene,
      routes: scene && scene.routes || {}
    }];
    ensureArray(scene && scene.sections).forEach((section) => {
      owners.push({
        id: String(section && section.id || '').replace(/[^A-Za-z0-9_]+/g, '_') || 'section',
        sectionId: String(section && section.id || ''),
        label: sectionLabel(sceneId, section),
        item: section,
        routes: section && section.routes || {}
      });
    });
    return owners;
  }

  function sectionLabel(sceneId, section) {
    const raw = String(section && section.id || '');
    const local = raw.startsWith(sceneId + '.') ? raw.slice(sceneId.length + 1) : raw;
    return String(section && (section.title || section.subtitle) || local || raw || 'Section');
  }

  function routeSource(item, scene, fieldName) {
    const metadata = isObject(item && item.metadata) ? item.metadata : {};
    const ref = isObject(metadata[fieldName]) ? metadata[fieldName] : {};
    const path = ref.path || scene && scene.path || '';
    return sourceRef({
      path,
      line: ref.line || ref.startLine,
      endLine: ref.endLine || ref.line || ref.startLine
    });
  }

  function buildEffectFields(scene, effects, options) {
    const sceneId = String(scene && scene.id || '');
    const sourceLineUse = countEffectSourceLines(effects);
    return ensureArray(effects).map((effect, index) => {
      const expression = effectExpression(effect);
      if (!expression) {
        return null;
      }
      const sourceExpression = effectSourceExpression(effect, expression);
      const source = sourceRef(effect.source || {});
      const search = effectSearchText(source.anchorText, sourceExpression || expression);
      const sourceLineKey = effectSourceLineKey(source);
      const sourceLineEffectCount = sourceLineKey ? (sourceLineUse.get(sourceLineKey) || 0) : 0;
      const anchorEffectCount = countEffectExpressions(source.anchorText);
      const sharedSourceLine = sourceLineEffectCount > 1 || anchorEffectCount > 1;
      const uniqueSharedToken = !sharedSourceLine || countOccurrences(source.anchorText, search) === 1;
      const guarded = uniqueSharedToken && canGuardField(source, search);
      const option = optionForEffect(options, effect);
      return {
        id: safeId('effect_' + (index + 1) + '_' + String(effect.variable || 'variable')),
        role: 'effect',
        label: 'Effect: Q.' + String(effect.variable || ''),
        original: expression,
        value: expression,
        sourceExpression,
        displayExpression: expression,
        effectSyntax: String(effect.syntax || ''),
        effectHook: String(effect.hook || ''),
        condition: String(effect.condition || ''),
        source,
        sourcePath: source.path || '',
        editability: guarded ? 'guarded_replace_text' : 'advanced_source_patch',
        owner: {
          sceneId,
          sectionId: String(effect.sectionId || ''),
          itemId: option && option.id || '',
          kind: 'effect'
        },
        sectionId: String(effect.sectionId || ''),
        optionId: option && option.id || '',
        inputType: 'text',
        transform: 'effect_expression',
        searchText: search,
        sharedSourceLine,
        sourceLineEffectCount: Math.max(sourceLineEffectCount, anchorEffectCount || 0),
        sourceLineSafety: sharedSourceLine
          ? (guarded ? 'shared_line_exact_token_guarded' : 'whole_line_advanced_source_patch')
          : (guarded ? 'single_expression_guarded' : 'advanced_source_patch'),
        confidence: guarded ? 'exact' : 'approximate',
        reason: sharedSourceLine
          ? (guarded
            ? 'This effect shares a source line with adjacent logic. Studio can guard the exact token, and Review & Apply must still check the whole line before writing.'
            : 'This effect shares a source line with adjacent logic and the replacement token is not unique, so Studio uses an advanced source slice edit.')
          : guarded
          ? 'Simple event effect has exact line evidence and can be checked before replacement.'
          : 'Effect needs the source slice editor because it is not a simple line-backed assignment.'
      };
    }).filter(Boolean);
  }

  function countEffectSourceLines(effects) {
    const seen = new Map();
    ensureArray(effects).forEach((effect) => {
      const key = effectSourceLineKey(sourceRef(effect && effect.source || {}));
      if (!key) {
        return;
      }
      const identity = effectIdentity(effect);
      if (!identity) {
        return;
      }
      if (!seen.has(key)) {
        seen.set(key, new Set());
      }
      seen.get(key).add(identity);
    });
    const counts = new Map();
    seen.forEach((items, key) => {
      counts.set(key, items.size);
    });
    return counts;
  }

  function effectSourceLineKey(source) {
    const ref = sourceRef(source || {});
    return ref.path && ref.line ? ref.path + ':' + ref.line : '';
  }

  function effectIdentity(effect) {
    return effectExpression(effect);
  }

  function countEffectExpressions(value) {
    const matches = String(value || '').match(/(?:Q\.)?[A-Za-z_][A-Za-z0-9_]*\s*(?:=|\+=|-=|\*=|\/=)/g);
    return matches ? matches.length : 0;
  }

  function countOccurrences(haystack, needle) {
    const text = String(haystack || '');
    const search = String(needle || '');
    if (!text || !search) {
      return 0;
    }
    let count = 0;
    let offset = 0;
    while (offset <= text.length) {
      const found = text.indexOf(search, offset);
      if (found < 0) {
        break;
      }
      count += 1;
      offset = found + Math.max(1, search.length);
    }
    return count;
  }

  function changeForLogicField(field, afterValue, fallback) {
    const base = typeof fallback === 'function' ? fallback : baseFieldChange;
    const transform = String(field && field.transform || '');
    const afterText = String(afterValue === undefined || afterValue === null ? '' : afterValue);
    if (transform === 'route_target') {
      const before = String(field.searchText || routeSearchToken(field.source && field.source.anchorText, field.original) || ('@' + field.original));
      if (!ROUTE_TARGET_RE.test(normalizeRouteTarget(afterText))) {
        return manualFieldChange(field, before, afterText, base);
      }
      return base(field, before, routeReplacementToken(before, afterText));
    }
    if (transform === 'goto_route_target') {
      const before = String(field.searchText || field.routeRaw || field.original || '');
      if (!ROUTE_TARGET_RE.test(normalizeRouteTarget(afterText))) {
        return manualFieldChange(field, before, afterText, base);
      }
      return base(field, before, routeReplacementClause(field, before, afterText));
    }
    if (transform === 'effect_expression') {
      const normalized = normalizeEffectEdit(afterText);
      if (!isSimpleEffectExpression(normalized)) {
        return manualFieldChange(field, String(field.searchText || field.original || ''), afterText, base);
      }
      return base(field, String(field.searchText || field.original || ''), effectReplacementText(field, normalized));
    }
    return null;
  }

  function baseFieldChange(field, before, after) {
    return {
      fieldId: field.id,
      role: field.role || 'text',
      label: field.label || field.role || field.id,
      sectionId: field.sectionId || '',
      optionId: field.optionId || '',
      source: sourceRef(field.source || {}),
      editability: field.editability || 'manual_review',
      before: String(before === undefined || before === null ? '' : before),
      after: String(after === undefined || after === null ? '' : after)
    };
  }

  function manualFieldChange(field, before, after, base) {
    const change = base(field, before, after);
    change.editability = 'advanced_source_patch';
    return change;
  }

  function optionForEffect(options, effect) {
    const api = ownershipMatchingApi();
    const sectionId = String(effect && effect.sectionId || '');
    return ensureArray(options).find((option) => {
      return api && typeof api.ownerMatchesOption === 'function'
        ? api.ownerMatchesOption(effect, option)
        : String(option.targetId || '') === sectionId || String(option.id || '') === sectionId;
    }) || null;
  }

  function effectExpression(effect) {
    const explicit = String(effect && (effect.displayExpression || effect.expression) || '').trim();
    if (explicit) {
      return explicit;
    }
    const variable = String(effect && effect.variable || '').trim();
    const op = String(effect && effect.op || effect.operator || '').trim();
    const rawValue = effect && effect.value;
    const value = String(rawValue === undefined || rawValue === null ? '' : rawValue).trim();
    if (!ID_RE.test(variable) || !/^(?:=|\+=|-=|\*=|\/=)$/.test(op) || !value) {
      return '';
    }
    const condition = String(effect && effect.condition || '').trim();
    return 'Q.' + variable + ' ' + op + ' ' + value + (condition ? ' if ' + condition : '');
  }

  function effectSourceExpression(effect, displayExpression) {
    const explicit = String(effect && effect.sourceExpression || '').trim();
    if (explicit) {
      return explicit;
    }
    const parsed = parseSimpleEffectExpression(displayExpression);
    if (!parsed) {
      return String(displayExpression || '').trim();
    }
    const prefix = String(effect && effect.syntax || '') === 'dendry_shorthand' ? '' : 'Q.';
    return prefix + parsed.variable + ' ' + parsed.op + ' ' + parsed.value + (parsed.condition ? ' if ' + parsed.condition : '');
  }

  function effectSearchText(anchorText, expression) {
    const anchor = String(anchorText || '').trim();
    const expr = String(expression || '').trim().replace(/;$/, '').trim();
    return anchor && anchor.includes(expr) ? expr : expr;
  }

  function routeSearchToken(anchorText, target) {
    const bare = normalizeRouteTarget(target);
    if (!bare) {
      return '';
    }
    const anchor = String(anchorText || '');
    const match = anchor.match(new RegExp('([@#])' + escapeRegExp(bare) + '(?=\\b|:|\\s|$)'));
    if (match) {
      return match[1] + bare;
    }
    return anchor.includes('@' + bare) ? '@' + bare : (anchor.includes('#' + bare) ? '#' + bare : '');
  }

  function routeReplacementToken(beforeToken, afterTarget) {
    const prefix = /^[#@]/.test(String(beforeToken || '')) ? String(beforeToken || '').charAt(0) : '@';
    const bare = normalizeRouteTarget(afterTarget);
    return bare ? prefix + bare : String(afterTarget || '').trim();
  }

  function routeReplacementClause(field, beforeClause, afterTarget) {
    const bare = normalizeRouteTarget(afterTarget);
    const before = String(beforeClause || '').trim();
    const original = String(field && field.original || '').trim();
    const predicate = String(field && field.routePredicate || '').trim();
    if (!bare) {
      return String(afterTarget || '').trim();
    }
    if (predicate) {
      return bare + ' if ' + predicate;
    }
    if (original && before.indexOf(original) >= 0) {
      return before.replace(original, bare);
    }
    return bare;
  }

  function normalizeRouteTarget(value) {
    return String(value || '').trim().replace(/^[@#]+/, '').trim();
  }

  function normalizeEffectEdit(value) {
    return String(value || '').trim().replace(/;+$/, '').trim();
  }

  function isSimpleEffectExpression(value) {
    return Boolean(parseSimpleEffectExpression(value));
  }

  function effectReplacementText(field, value) {
    const parsed = parseSimpleEffectExpression(value);
    if (!parsed) {
      return String(value || '').trim();
    }
    const sourceText = String(field && (field.searchText || field.sourceExpression) || '').trim();
    const syntax = String(field && field.effectSyntax || '');
    const useBare = syntax === 'dendry_shorthand' || (sourceText && !/^Q\./.test(sourceText));
    return (useBare ? '' : 'Q.') + parsed.variable + ' ' + parsed.op + ' ' + parsed.value + (parsed.condition ? ' if ' + parsed.condition : '');
  }

  function parseSimpleEffectExpression(value) {
    const parts = splitTrailingIf(String(value || '').trim());
    const match = parts.expression.match(/^(?:Q\.)?([A-Za-z_][A-Za-z0-9_]*)\s*(=|\+=|-=|\*=|\/=)\s*([^;\n]+)$/);
    if (!match) {
      return null;
    }
    return {
      variable: match[1],
      op: match[2],
      value: match[3].trim(),
      condition: parts.condition
    };
  }

  function splitTrailingIf(value) {
    const text = String(value || '').trim();
    let quote = '';
    let escaped = false;
    let splitAt = -1;
    for (let index = 0; index < text.length; index += 1) {
      const char = text.charAt(index);
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\' && quote) {
        escaped = true;
        continue;
      }
      if (quote) {
        if (char === quote) {
          quote = '';
        }
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (text.slice(index, index + 4).toLowerCase() === ' if ') {
        splitAt = index;
      }
    }
    if (splitAt < 0) {
      return {expression: text, condition: ''};
    }
    return {expression: text.slice(0, splitAt).trim(), condition: text.slice(splitAt + 4).trim()};
  }

  function canGuardField(source, original) {
    const path = String(source && source.path || '');
    const line = Number(source && (source.line || source.startLine) || 0);
    const endLine = Number(source && (source.endLine || source.line || source.startLine) || line || 0);
    return Boolean(
      path.startsWith('source/scenes/') &&
      path.endsWith('.scene.dry') &&
      !isProtectedRouterPath(path) &&
      Number.isInteger(line) &&
      line > 0 &&
      (!Number.isInteger(endLine) || endLine <= 0 || endLine === line) &&
      String(original || '').trim()
    );
  }

  function isProtectedRouterPath(relPath) {
    const rel = String(relPath || '').replace(/\\/g, '/');
    return rel === 'source/scenes/root.scene.dry' ||
      rel === 'source/scenes/post_event.scene.dry' ||
      rel === 'source/scenes/post_event_news.scene.dry';
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
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

  function safeId(value) {
    let text = String(value || 'field')
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!text) {
      text = 'field';
    }
    if (!/^[A-Za-z_]/.test(text)) {
      text = 'field_' + text;
    }
    return ID_RE.test(text) ? text : 'field';
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? Math.floor(num) : null;
  }

  function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const api = {
    buildRouteFields,
    buildEffectFields,
    changeForLogicField,
    effectExpression,
    routeSearchToken,
    routeReplacementToken,
    isSimpleEffectExpression
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapExistingSceneLogicFields = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
