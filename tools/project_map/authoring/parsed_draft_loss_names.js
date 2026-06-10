(function initProjectMapParsedDraftLossNames(global) {
  'use strict';

  // Names the parsed->draft losses that roleKeyedParity can otherwise only
  // count. Extractors exist ONLY for roles whose item identities survive the
  // parse->draft transform verbatim, so the multiset diff cancels cleanly;
  // prose/structural roles (body, options, sections) stay count-only because
  // their ids are transformed (safeId/localId) and naive diffs would name
  // spurious items. Shared helpers are injected from parsed_to_draft.js so
  // both sides of every comparison use the exact counting traversals.
  function createLossNamer(deps) {
    const ensureArray = deps.ensureArray;
    const roleOf = deps.roleOf;
    const hookRows = deps.hookRows;
    const assetRefsForScene = deps.assetRefsForScene;

    function namedRoleLosses(role, scene, textRows, draft) {
      const sides = lossNameSides(String(role || ''), scene, textRows, draft);
      if (!sides) {
        return [];
      }
      const pool = sides.draft;
      const missing = [];
      sides.parsed.forEach((name) => {
        const found = pool.indexOf(name);
        if (found >= 0) {
          pool.splice(found, 1);
        } else {
          missing.push(name);
        }
      });
      return missing.slice(0, 6).map(clipLossName);
    }

    function lossNameSides(role, scene, textRows, draft) {
      if (role === 'metadata') {
        return {
          parsed: metadataNames(scene).concat(metadataRowNames(textRows)),
          draft: metadataNames(draft)
        };
      }
      if (role === 'lifecycleHooks') {
        return {parsed: hookLineNames(scene), draft: hookLineNames(draft)};
      }
      if (role === 'assets') {
        return {
          parsed: assetRefsForScene(scene).map(assetName),
          draft: ensureArray(draft && draft.assetRefs).map(assetName)
        };
      }
      if (role === 'setJump') {
        return {
          parsed: jumpNames(scene && (scene.setJump || scene.set_jump || scene.jumpTarget)),
          draft: jumpNames(draft && draft.setJump)
        };
      }
      return null;
    }

    function metadataNames(value) {
      return ensureArray(value && value.tags).map((tag) => 'tags: ' + String(tag).trim())
        .concat(value && value.newPage !== undefined ? ['new-page'] : []);
    }

    function metadataRowNames(textRows) {
      return ensureArray(textRows)
        .filter((row) => ['metadata', 'tags', 'new_page'].indexOf(roleOf(row)) >= 0)
        .map((row) => 'metadata: ' + String(row && (row.text || row.value || row.original) || '').trim());
    }

    function hookLineNames(value) {
      const names = [];
      const push = (row) => hookRows(row).forEach((line) => names.push(String(line).trim()));
      push(value);
      ensureArray(value && value.sections).forEach((section) => {
        push(section);
        ensureArray(section && section.options).forEach(push);
      });
      ensureArray(value && (value.options || value.choices)).forEach(push);
      return names;
    }

    function assetName(asset) {
      return 'asset: ' + String(asset && asset.path || '').trim();
    }

    function jumpNames(value) {
      return value ? ['set-jump: ' + String(value).trim()] : [];
    }

    function clipLossName(value) {
      const text = String(value || '').trim().replace(/\s+/g, ' ');
      return text.length > 60 ? text.slice(0, 57) + '...' : text;
    }

    return {namedRoleLosses};
  }

  const api = {createLossNamer};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapParsedDraftLossNames = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
