// @ts-check
(function initProjectMapOwnershipMatching(global) {
  'use strict';

  function ensureArray(value) {
    return Array.isArray(value) ? value : [value];
  }

  // Memoized: ownership matching compares every owner against every option and
  // section, calling this for the same handful of endpoint id strings millions
  // of times on a large event (~4.4s of self time). The result is a pure
  // function of the input string and is only read by callers, so cache it. The
  // key space is the project's endpoint id vocabulary (bounded); the size guard
  // is a defensive cap for a long-running session.
  const endpointTokenCache = new Map();

  function parseEndpointToken(value) {
    const key = String(value || '');
    if (endpointTokenCache.has(key)) {
      return endpointTokenCache.get(key);
    }
    const text = key.trim().replace(/^[@#]/, '');
    let parsed = null;
    if (text) {
      const parts = text.split('.');
      parsed = {
        full: text,
        local: parts[parts.length - 1] || text,
        qualified: parts.length > 1
      };
    }
    if (endpointTokenCache.size < 100000) {
      endpointTokenCache.set(key, parsed);
    }
    return parsed;
  }

  function normalizeEndpointToken(value) {
    const parsed = parseEndpointToken(value);
    return parsed ? parsed.local : '';
  }

  function endpointPairMatches(left, right) {
    if (!left || !right) {
      return false;
    }
    if (left.full === right.full) {
      return true;
    }
    if (left.qualified && right.qualified) {
      return false;
    }
    return Boolean(left.local && left.local === right.local);
  }

  function endpointTokens(values) {
    const out = [];
    ensureArray(values).forEach((value) => {
      const token = normalizeEndpointToken(value);
      if (token && !out.includes(token)) {
        out.push(token);
      }
    });
    return out;
  }

  function endpointEntries(values) {
    const out = [];
    ensureArray(values).forEach((value) => {
      const parsed = parseEndpointToken(value);
      if (parsed && !out.some((item) => item.full === parsed.full)) {
        out.push(parsed);
      }
    });
    return out;
  }

  function optionEndpointTokens(option) {
    const value = option || {};
    return endpointTokens([
      value.id,
      value.targetId,
      value.rawTargetId,
      value.sectionId
    ]);
  }

  function ownerEndpointTokens(owner) {
    const value = owner || {};
    return endpointTokens([
      value.optionId,
      value.itemId,
      value.sectionId,
      value.targetId,
      value.rawTargetId,
      value.id
    ]);
  }

  function intersects(left, right) {
    const leftTokens = endpointEntries(left);
    const rightTokens = endpointEntries(right);
    return Boolean(leftTokens.length && rightTokens.length && leftTokens.some((leftToken) => rightTokens.some((rightToken) => endpointPairMatches(leftToken, rightToken))));
  }

  // Memoized for the common single-value call shape: source ownership matching
  // calls endpointMatches(leftString, rightString) O(options x effects x tokens)
  // times with a small set of repeated id-string pairs, so the parse + token
  // intersection work dominates (~1.5s combined self time on a large event).
  // The result is a pure function of the two endpoint strings. Only memoize
  // when both args are primitives (the array call shape goes through intersects
  // directly and is left untouched). Bounded by the id-pair vocabulary.
  // Nested map (left -> right -> bool) avoids allocating a joined key string on
  // every one of the millions of calls, which keeps GC pressure down.
  const endpointMatchPairCache = new Map();
  function endpointMatches(left, right) {
    const leftPrimitive = left == null || typeof left !== 'object';
    const rightPrimitive = right == null || typeof right !== 'object';
    if (!leftPrimitive || !rightPrimitive) {
      return intersects(left, right);
    }
    const leftKey = String(left);
    const rightKey = String(right);
    let byRight = endpointMatchPairCache.get(leftKey);
    if (byRight) {
      const cached = byRight.get(rightKey);
      if (cached !== undefined) {
        return cached;
      }
    } else if (endpointMatchPairCache.size < 20000) {
      byRight = new Map();
      endpointMatchPairCache.set(leftKey, byRight);
    }
    const result = intersects(left, right);
    if (byRight && byRight.size < 20000) {
      byRight.set(rightKey, result);
    }
    return result;
  }

  function ownerMatchesOption(owner, option) {
    return intersects([
      owner && owner.optionId,
      owner && owner.itemId,
      owner && owner.sectionId,
      owner && owner.targetId,
      owner && owner.rawTargetId,
      owner && owner.id
    ], [
      option && option.id,
      option && option.targetId,
      option && option.rawTargetId,
      option && option.sectionId
    ]);
  }

  function ownerMatchesSection(owner, sectionId) {
    return intersects([
      owner && owner.optionId,
      owner && owner.itemId,
      owner && owner.sectionId,
      owner && owner.targetId,
      owner && owner.rawTargetId,
      owner && owner.id
    ], sectionId);
  }

  const api = {
    parseEndpointToken,
    normalizeEndpointToken,
    endpointTokens,
    optionEndpointTokens,
    ownerEndpointTokens,
    endpointMatches,
    ownerMatchesOption,
    ownerMatchesSection
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapOwnershipMatching = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
