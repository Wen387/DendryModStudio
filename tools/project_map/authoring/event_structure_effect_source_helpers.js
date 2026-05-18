(function initProjectMapEventStructureEffectSourceHelpers(global) {
  'use strict';

  function isOnArrivalEffectLine(value) {
    return /^on-arrival\s*:/i.test(stringValue(value).trim()) && stringValue(value).indexOf('{!') < 0;
  }

  function looksLikeStandaloneEffectAnchor(anchor) {
    const text = stringValue(anchor).trim();
    if (!text || /^on-arrival\s*:/i.test(text) || /^on-departure\s*:/i.test(text) || /^on-display\s*:/i.test(text)) {
      return false;
    }
    return /^(?:Q\.)?[A-Za-z_][A-Za-z0-9_]*\s*(?:=|\+=|-=|\*=|\/=)/.test(text);
  }

  function effectRemovalFromSourceLine(anchor, candidates) {
    const line = stringValue(anchor).trim();
    if (!line || /^on-display\s*:/i.test(line) || line.indexOf('{!') >= 0) {
      return {ok: false, nextLine: ''};
    }
    const onArrival = line.match(/^((?:on-arrival|on-departure)\s*:\s*)([\s\S]+)$/i);
    const standalone = !onArrival && looksLikeStandaloneEffectAnchor(line);
    if (!onArrival && !standalone) {
      return {ok: false, nextLine: ''};
    }
    const prefix = onArrival ? onArrival[1] : '';
    const body = onArrival ? onArrival[2] : line;
    const clauses = splitEffectClauses(body);
    if (!clauses.length) {
      return {ok: false, nextLine: ''};
    }
    const normalizedCandidates = uniqueStrings((Array.isArray(candidates) ? candidates : []).map(normalizeEffectClause).filter(Boolean));
    if (!normalizedCandidates.length) {
      return {ok: false, nextLine: ''};
    }
    let removed = 0;
    const remaining = clauses.filter((clause) => {
      const matched = normalizedCandidates.includes(normalizeEffectClause(clause));
      if (matched) {
        removed += 1;
        return false;
      }
      return true;
    });
    if (removed !== 1) {
      return {ok: false, nextLine: ''};
    }
    if (!remaining.length) {
      return {ok: true, nextLine: ''};
    }
    if (onArrival) {
      return {ok: true, nextLine: prefix + remaining.join('; ')};
    }
    return {ok: true, nextLine: remaining.join('; ') + (/\s*;\s*$/.test(line) ? ';' : '')};
  }

  function splitEffectClauses(text) {
    const clauses = [];
    let current = '';
    let quote = '';
    let escaped = false;
    stringValue(text).split('').forEach((char) => {
      if (escaped) {
        current += char;
        escaped = false;
        return;
      }
      if (char === '\\' && quote) {
        current += char;
        escaped = true;
        return;
      }
      if (quote) {
        current += char;
        if (char === quote) {
          quote = '';
        }
        return;
      }
      if (char === '"' || char === "'") {
        quote = char;
        current += char;
        return;
      }
      if (char === ';') {
        if (current.trim()) {
          clauses.push(current.trim());
        }
        current = '';
        return;
      }
      current += char;
    });
    if (current.trim()) {
      clauses.push(current.trim());
    }
    return clauses;
  }

  function normalizeEffectClause(value) {
    return stringValue(value)
      .replace(/^(?:on-arrival|on-departure)\s*:\s*/i, '')
      .replace(/\bQ\./g, '')
      .replace(/\s*(=|\+=|-=|\*=|\/=)\s*/g, ' $1 ')
      .replace(/\s+/g, ' ')
      .replace(/;+$/g, '')
      .trim();
  }

  function uniqueStrings(values) {
    const seen = new Set();
    const out = [];
    (Array.isArray(values) ? values : []).forEach((value) => {
      const text = stringValue(value).trim();
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out;
  }

  function stringValue(value) {
    return value === undefined || value === null ? '' : String(value);
  }

  const api = {
    isOnArrivalEffectLine,
    looksLikeStandaloneEffectAnchor,
    effectRemovalFromSourceLine,
    splitEffectClauses,
    normalizeEffectClause
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapEventStructureEffectSourceHelpers = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
