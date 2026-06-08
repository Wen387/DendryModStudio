// @ts-check
// Focused install-operation support for the System UI right-sidebar guarded
// auto-apply (P1 copy_template_file eject + P2 insert_html_block). Kept out of
// install_plan.js so that orchestrator stays within its complexity budget; the
// fs-touching preflights receive install_plan's primitives via a helpers bag.
(function initRightSidebarTemplateOps(global) {
  'use strict';

  // The engine ships an editable make-html template with a `.tools.right`
  // column already laid out; the mod "owns" the layout by ejecting that
  // template into templates/html/<slug>/ and building with `-t`.
  const ENGINE_TEMPLATE_REL = 'lib/templates/html/default-tabbed-sidebar';
  const TEMPLATE_EJECT_FILES = new Set(['+index.html', '+game.css']);

  function isTemplateIndexPath(relPath) {
    return /^templates\/html\/[^/]+\/\+index\.html$/.test(String(relPath || '').replace(/\\/g, '/'));
  }

  function isTemplateEjectTargetPath(relPath) {
    return /^templates\/html\/[^/]+\/\+(?:index\.html|game\.css)$/.test(String(relPath || '').replace(/\\/g, '/'));
  }

  function isEngineTemplateFile(sourceName) {
    return TEMPLATE_EJECT_FILES.has(String(sourceName || ''));
  }

  // Resolve the engine template source from Studio's bundled dendrynexus (NOT
  // the mod's projectRoot — the edited mod may not depend on dendrynexus).
  function resolveEngineTemplateFile(fileName) {
    if (typeof require !== 'function') {
      return '';
    }
    try {
      const path = require('path');
      const pkg = require.resolve('dendrynexus/package.json');
      return path.join(path.dirname(pkg), ENGINE_TEMPLATE_REL, fileName);
    } catch (_err) {
      return '';
    }
  }

  function htmlHasIdToken(text, ident) {
    return new RegExp('\\bid\\s*=\\s*([\'"])' + ident + '\\1').test(String(text || ''));
  }

  function panelIdFromDedupe(dedupeSearch) {
    const match = /id\s*=\s*(['"])([^'"]+)\1/.exec(String(dedupeSearch || ''));
    return match ? match[2] : 'stats_sidebar_right';
  }

  // Find the `<div id="stats_sidebar" ...>` opening tag. The trailing closing
  // quote after the ident keeps this from matching `stats_sidebar_right`.
  function findStatsSidebarAnchor(text) {
    const match = /<div\b[^>]*\bid\s*=\s*(['"])stats_sidebar\1/.exec(String(text || ''));
    return match ? match.index : -1;
  }

  // Depth-count <div>/</div> from the anchor to find the index just past its
  // matching close tag. `\b` after `div` excludes `<divider>` etc.
  function matchClosingDiv(text, fromIndex) {
    const source = String(text || '');
    const tokens = /<div\b|<\/div\s*>/g;
    tokens.lastIndex = Math.max(0, fromIndex);
    let depth = 0;
    let token;
    while ((token = tokens.exec(source)) !== null) {
      if (token[0].charAt(1) === '/') {
        depth -= 1;
        if (depth === 0) {
          return token.index + token[0].length;
        }
      } else {
        depth += 1;
      }
    }
    return -1;
  }

  function preferredEol(text) {
    const crlf = (String(text || '').match(/\r\n/g) || []).length;
    const lf = (String(text || '').replace(/\r\n/g, '').match(/\n/g) || []).length;
    return crlf > lf ? '\r\n' : '\n';
  }

  // Block-aware insert of the right-sidebar panel after the #stats_sidebar
  // block closes (still inside #tools_wrapper). Idempotent on the panel id.
  function insertHtmlBlock(text, operation) {
    const before = String(text || '');
    const content = String(operation && operation.content || '').replace(/\n+$/, '');
    const panelId = panelIdFromDedupe(operation && operation.dedupeSearch);
    if (htmlHasIdToken(before, panelId)) {
      return {ok: true, alreadyApplied: true, text: before};
    }
    const anchorIndex = findStatsSidebarAnchor(before);
    if (anchorIndex < 0) {
      return {ok: false, code: 'html_anchor_not_found', message: 'Could not find the #stats_sidebar anchor element in the template.'};
    }
    const insertAt = matchClosingDiv(before, anchorIndex);
    if (insertAt < 0) {
      return {ok: false, code: 'html_anchor_unbalanced', message: 'Could not find the matching </div> for the #stats_sidebar block.'};
    }
    const eol = preferredEol(before);
    const block = eol + content.split(/\r?\n/).join(eol) + eol;
    return {
      ok: true,
      text: before.slice(0, insertAt) + block + before.slice(insertAt),
      beforeSnippet: before.slice(anchorIndex, insertAt),
      afterSnippet: block
    };
  }

  // Eject an engine template file into the mod by sourcing its text content
  // (text-based, like create_file) so a same-pass insert_html_block sees it.
  // Idempotent and non-destructive: an existing mod-owned file is left intact.
  function preflightCopyTemplateFile(context, target, operation, diagnostics, h) {
    const sourceName = String(operation.sourceName || '').trim();
    if (!isEngineTemplateFile(sourceName)) {
      diagnostics.push(h.diagnostic('error', 'install_plan.template_source_name', 'copy_template_file source must be +index.html or +game.css.', operation));
      return h.failedPreflightResult(context, operation, 'template_source_name', 'copy_template_file source must be +index.html or +game.css.');
    }
    const enginePath = resolveEngineTemplateFile(sourceName);
    if (!enginePath || !context.fs.existsSync(enginePath) || !context.fs.statSync(enginePath).isFile()) {
      diagnostics.push(h.diagnostic('error', 'install_plan.template_source_missing', 'Engine template source not found: ' + sourceName, operation));
      return h.failedPreflightResult(context, operation, 'template_source_missing', 'Engine template source not found: ' + sourceName);
    }
    const engineText = context.fs.readFileSync(enginePath, 'utf8');
    const state = h.textFileState(context, target);
    if (state.exists) {
      return h.withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied'},
        context.includeEvidence,
        operation,
        h.textOperationEvidence(operation, 'already_applied', state.text, state.text, {
          match: 'template_already_owned',
          message: 'The mod already owns this template file; the author edits are left intact.',
          afterHash: h.hashText(context.crypto, state.text)
        })
      );
    }
    state.exists = true;
    state.text = engineText;
    state.modified = true;
    return h.withOperationEvidence(
      {id: operation.id, type: operation.type, path: operation.path, status: 'would_apply'},
      context.includeEvidence,
      operation,
      h.textOperationEvidence(operation, 'would_apply', '', engineText, {
        match: 'engine_template_ejected',
        message: 'Dry-run verified the engine template can be ejected into the mod.',
        afterHash: h.hashText(context.crypto, engineText),
        diff: h.renderVerifiedDiff(operation, '', '# ejected engine template ' + sourceName, {newFile: true})
      })
    );
  }

  // Block-aware insert of the right-sidebar panel into a mod-owned +index.html.
  function preflightInsertHtmlBlock(context, target, operation, diagnostics, h) {
    const state = h.textFileState(context, target);
    if (!state.exists) {
      diagnostics.push(h.diagnostic('error', 'install_plan.insert_missing_file', 'Target template does not exist (eject it first): ' + operation.path, operation));
      return h.failedPreflightResult(context, operation, 'target_missing', 'Target template does not exist: ' + operation.path);
    }
    const before = state.text;
    const inserted = insertHtmlBlock(before, operation);
    if (!inserted.ok) {
      diagnostics.push(h.diagnostic('error', 'install_plan.' + (inserted.code || 'html_insert_failed'), inserted.message, operation));
      return h.withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'failed'},
        context.includeEvidence,
        operation,
        h.textOperationEvidence(operation, 'failed', before, before, {
          match: inserted.code || 'html_insert_failed',
          message: inserted.message,
          beforeHash: h.hashText(context.crypto, before),
          afterHash: h.hashText(context.crypto, before)
        })
      );
    }
    if (inserted.alreadyApplied) {
      return h.withOperationEvidence(
        {id: operation.id, type: operation.type, path: operation.path, status: 'already_applied'},
        context.includeEvidence,
        operation,
        h.textOperationEvidence(operation, 'already_applied', before, before, {
          match: 'right_panel_already_present',
          beforeHash: h.hashText(context.crypto, before),
          afterHash: h.hashText(context.crypto, before)
        })
      );
    }
    state.text = inserted.text;
    state.modified = true;
    return h.withOperationEvidence(
      {id: operation.id, type: operation.type, path: operation.path, status: 'would_apply'},
      context.includeEvidence,
      operation,
      h.textOperationEvidence(operation, 'would_apply', before, inserted.text, {
        match: 'matched_stats_sidebar_block',
        beforeHash: h.hashText(context.crypto, before),
        afterHash: h.hashText(context.crypto, inserted.text),
        diff: h.renderVerifiedDiff(operation, '', String(operation.content || '').replace(/\n+$/, ''), {newFile: false})
      })
    );
  }

  // Post-write guard: confirm the panel id survived into the final coalesced
  // template text. Returns an error message when it is missing, '' otherwise.
  function finalInsertHtmlBlockMissing(context, operation, h) {
    const target = h.resolveSafeTarget(context.projectRoot, operation.path, context.path);
    if (!target.ok) {
      return '';
    }
    const state = context.textFiles.get(target.path);
    if (!state || !state.exists) {
      return '';
    }
    if (htmlHasIdToken(state.text, panelIdFromDedupe(operation.dedupeSearch))) {
      return '';
    }
    return 'Right-sidebar panel insert passed its anchor check, but the panel id is missing from the final template text.';
  }

  const api = {
    TEMPLATE_EJECT_FILES,
    isTemplateIndexPath,
    isTemplateEjectTargetPath,
    isEngineTemplateFile,
    resolveEngineTemplateFile,
    htmlHasIdToken,
    panelIdFromDedupe,
    insertHtmlBlock,
    preflightCopyTemplateFile,
    preflightInsertHtmlBlock,
    finalInsertHtmlBlockMissing
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapRightSidebarTemplateOps = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
