(function initProjectMapVariableSuggestions(global) {
  'use strict';

  const DEFAULT_LIMIT = 12;

  function buildVariableCandidates(projectIndexOrModel, options) {
    const variables = variableList(projectIndexOrModel);
    return variables
      .map((variable) => normalizeCandidate(variable, options || {}))
      .filter((candidate) => candidate.name)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  }

  function searchVariableCandidates(candidatesOrIndex, query, options) {
    const opts = options || {};
    const candidates = Array.isArray(candidatesOrIndex)
      ? candidatesOrIndex
      : buildVariableCandidates(candidatesOrIndex, opts);
    const text = String(query || '').trim().toLowerCase();
    const limit = Number(opts.limit || DEFAULT_LIMIT);
    const searched = candidates
      .map((candidate) => scoreCandidate(candidate, text))
      .filter((candidate) => candidate.matchScore > 0 || !text)
      .sort((a, b) => b.matchScore - a.matchScore || b.score - a.score || a.name.localeCompare(b.name));
    return searched.slice(0, limit);
  }

  function variableSnippet(candidate, options) {
    const name = String(candidate && candidate.name || '').trim();
    const defaultValue = candidate && candidate.meaning === 'event flag' ? '0' : '1';
    const value = options && options.value !== undefined ? String(options.value) : defaultValue;
    return {
      metadataCondition: name ? name + ' = ' + value : '',
      jsCondition: name ? 'Q.' + name : '',
      effectVariable: name
    };
  }

  function normalizeCandidate(variable) {
    const name = String(variable && variable.name || '').trim();
    const tags = ensureArray(variable && variable.tags).map(String).filter(Boolean);
    const reads = ensureArray(variable && variable.reads);
    const writes = ensureArray(variable && variable.writes);
    const readCount = numeric(variable && variable.readCount, reads.length);
    const writeCount = numeric(variable && variable.writeCount, writes.length);
    const meaning = inferMeaning(name, tags);
    const sourceHints = reads.concat(writes)
      .slice(0, 4)
      .map((source) => source && source.path ? source.path + (source.line ? ':' + source.line : '') : '')
      .filter(Boolean);
    const summary = humanSummary({name, tags, readCount, writeCount, meaning, sourceHints});
    const searchText = [
      name,
      name.replace(/_/g, ' '),
      meaning,
      tags.join(' '),
      sourceHints.join(' '),
      semanticAliases(name, tags, meaning).join(' ')
    ].join(' ').toLowerCase();
    return {
      name,
      label: name,
      meaning,
      tags,
      readCount,
      writeCount,
      reads,
      writes,
      sourceHints,
      summary,
      reason: '',
      searchText,
      score: readCount + writeCount + meaningWeight(meaning) + Math.min(tags.length, 4)
    };
  }

  function scoreCandidate(candidate, query) {
    const copy = Object.assign({}, candidate);
    if (!query) {
      copy.matchScore = copy.score;
      copy.reason = candidate.meaning || 'frequently used variable';
      return copy;
    }
    const tokens = query.split(/\s+/).filter(Boolean);
    let score = 0;
    const reasons = [];
    tokens.forEach((token) => {
      if (candidate.name.toLowerCase() === token) {
        score += 120;
        reasons.push(token + ' exact name');
      } else if (candidate.name.toLowerCase().startsWith(token)) {
        score += 80;
        reasons.push(token + ' name prefix');
      } else if (candidate.name.toLowerCase().includes(token)) {
        score += 55;
        reasons.push(token + ' name');
      } else if (candidate.searchText.includes(token)) {
        score += 35;
        reasons.push(token);
      }
    });
    if (score > 0) {
      score += Math.min(candidate.score, 60);
    }
    copy.matchScore = score;
    copy.reason = reasons.length ? unique(reasons).join(', ') : candidate.meaning || 'candidate';
    return copy;
  }

  function variableList(value) {
    if (!value) {
      return [];
    }
    if (Array.isArray(value.variables)) {
      return value.variables;
    }
    if (value.lists && Array.isArray(value.lists.variables)) {
      return value.lists.variables;
    }
    if (value.index && Array.isArray(value.index.variables)) {
      return value.index.variables;
    }
    return [];
  }

  function inferMeaning(name, tags) {
    const text = [name].concat(tags).join(' ').toLowerCase();
    if (/_seen$/.test(name) || text.includes('seen') || text.includes('flag')) {
      return 'event flag';
    }
    if (text.includes('resource') || text.includes('capacity') || text.includes('action_timer')) {
      return 'resource or capacity';
    }
    if (text.includes('relation') || text.includes('trust') || text.includes('approval')) {
      return 'relationship or trust';
    }
    if (text.includes('year') || text.includes('month') || text.includes('date')) {
      return 'time gate';
    }
    if (text.includes('unrest') || text.includes('strike') || text.includes('movement')) {
      return 'social pressure';
    }
    if (text.includes('card') || text.includes('deck') || text.includes('hand')) {
      return 'card flow';
    }
    if (text.includes('profile') || text.includes('identity') || text.includes('ideology')) {
      return 'political profile';
    }
    return 'game state';
  }

  function semanticAliases(name, tags, meaning) {
    const aliases = [];
    const text = [name].concat(tags).concat([meaning]).join(' ').toLowerCase();
    if (text.includes('resource') || text.includes('capacity')) {
      aliases.push('resource resources capacity action cost spend');
    }
    if (text.includes('seen') || text.includes('flag') || text.includes('event')) {
      aliases.push('event flag seen unlocked watched appeared proposal');
    }
    if (text.includes('relation') || text.includes('trust')) {
      aliases.push('relationship trust approval support');
    }
    if (text.includes('unrest') || text.includes('movement')) {
      aliases.push('worker labor strike unrest protest social movement');
    }
    if (text.includes('year') || text.includes('month')) {
      aliases.push('time date month year schedule');
    }
    return aliases;
  }

  function humanSummary(candidate) {
    const pieces = [];
    pieces.push(candidate.meaning);
    pieces.push('reads ' + candidate.readCount);
    pieces.push('writes ' + candidate.writeCount);
    if (candidate.tags.length) {
      pieces.push('tags: ' + candidate.tags.slice(0, 3).join(', '));
    }
    if (candidate.sourceHints.length) {
      pieces.push(candidate.sourceHints[0]);
    }
    return pieces.join(' · ');
  }

  function meaningWeight(meaning) {
    return {
      'resource or capacity': 25,
      'event flag': 22,
      'relationship or trust': 18,
      'social pressure': 16,
      'time gate': 14,
      'card flow': 12,
      'political profile': 10,
      'game state': 4
    }[meaning] || 0;
  }

  function numeric(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function unique(values) {
    return Array.from(new Set(values));
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  const api = {
    buildVariableCandidates,
    searchVariableCandidates,
    variableSnippet
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapVariableSuggestions = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
