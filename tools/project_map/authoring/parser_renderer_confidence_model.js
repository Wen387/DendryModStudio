(function initProjectMapParserRendererConfidence(global) {
  'use strict';

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function buildConfidenceReport(projectIndex, options) {
    const index = isObject(projectIndex) ? projectIndex : {};
    const opts = isObject(options) ? options : {};
    const sampleLimit = Math.max(1, Number(opts.sampleLimit || 8) || 8);
    const diagnostics = allDiagnostics(index);
    const evidence = parserEvidence(index);
    const routeOrder = routeOrderEvidence(evidence, diagnostics, sampleLimit);
    const dynamicQ = dynamicQEvidence(evidence, diagnostics, sampleLimit);
    const monthlyPopups = monthlyPopupEvidence(index, evidence, sampleLimit);
    const sharedEffects = sharedEffectEvidence(index, evidence, sampleLimit);
    const runtimeReadiness = runtimeReadinessEvidence(index, diagnostics);
    return {
      schemaVersion: '0.1',
      kind: 'parser_renderer_confidence_report',
      summary: {
        routeOrderSensitiveCount: routeOrder.count,
        dynamicQManualReviewCount: dynamicQ.manualReviewCount,
        monthlyPopupManualReviewCount: monthlyPopups.routerManualReviewCount,
        sharedEffectLineCount: sharedEffects.lineCount,
        routeOrderGroupCount: routeOrder.structuredGroupCount,
        dynamicKeyEvidenceCount: dynamicQ.structuredEvidenceCount,
        effectClauseCount: sharedEffects.clauseCount,
        monthlyPopupRouterTableCount: monthlyPopups.routerTableCount,
        runtimeFallbackRequired: runtimeReadiness.fallbackRequired,
        missingRuntimeDependencyCount: runtimeReadiness.missingDependencyCount
      },
      routeOrder,
      dynamicQ,
      monthlyPopups,
      sharedEffects,
      runtimeReadiness
    };
  }

  function allDiagnostics(index) {
    const semantic = isObject(index.semantic) ? index.semantic : {};
    const runtimeSurface = isObject(semantic.runtimeSurface) ? semantic.runtimeSurface : {};
    return ensureArray(index.diagnostics).concat(ensureArray(runtimeSurface.diagnostics));
  }

  function parserEvidence(index) {
    const semantic = isObject(index.semantic) ? index.semantic : {};
    return isObject(semantic.parserEvidence) ? semantic.parserEvidence : {};
  }

  function parserEvidenceCore(evidence) {
    return isObject(evidence && evidence.core) ? evidence.core : (isObject(evidence) ? evidence : {});
  }

  function parserEvidenceRows(evidence, key) {
    const coreRows = ensureArray(parserEvidenceCore(evidence)[key]);
    return coreRows.length ? coreRows : ensureArray(evidence && evidence[key]);
  }

  function profileEvidenceRows(evidence) {
    return ensureArray(evidence && evidence.profiles);
  }

  function profileRouterRows(evidence, compatAlias) {
    const rows = [];
    profileEvidenceRows(evidence).forEach((profile) => {
      const packages = new Map(ensureArray(profile && profile.packages).map((item) => [String(item && item.id || ''), item || {}]));
      ensureArray(profile && profile.routerTables).forEach((table) => {
        const packageRow = packages.get(String(table && table.packageId || '')) || {};
        const alias = String((table && table.compatAlias) || packageRow.compatAlias || '');
        if (compatAlias && alias !== compatAlias) {
          return;
        }
        ensureArray(table && table.rows).forEach((row) => {
          rows.push(Object.assign({
            profileId: String(profile && profile.profileId || ''),
            packageId: String(table && table.packageId || ''),
            routerTableId: String(table && table.id || ''),
            compatAlias: alias
          }, isObject(row) ? row : {}));
        });
      });
    });
    if (rows.length) {
      return rows;
    }
    return compatAlias === 'monthlyPopupRouterTable' ? ensureArray(evidence && evidence.monthlyPopupRouterTable) : [];
  }

  function routeOrderEvidence(evidence, diagnostics, sampleLimit) {
    const groups = parserEvidenceRows(evidence, 'routeOrderGroups');
    if (groups.length) {
      return {
        count: groups.length,
        structuredGroupCount: groups.length,
        routeClass: 'runtime_order_sensitive',
        installSafety: 'manual_review',
        reason: 'Conditional or chained go-to clauses are parser-backed as ordered route groups, but route order must be reviewed before rewriting source.',
        samples: groups.slice(0, sampleLimit).map(routeOrderGroupSample)
      };
    }
    const items = ensureArray(diagnostics).filter((diag) => String(diag && diag.code || '') === 'project_map.conditional_goto');
    return {
      count: items.length,
      structuredGroupCount: 0,
      routeClass: 'runtime_order_sensitive',
      installSafety: 'manual_review',
      reason: 'Conditional or chained go-to clauses are parsed, but route order must be reviewed before rewriting source.',
      samples: items.slice(0, sampleLimit).map((diag) => ({
        sceneId: String(diag.sceneId || ''),
        source: sourceRef(diag.source || {path: diag.path}),
        message: String(diag.message || '')
      }))
    };
  }

  function routeOrderGroupSample(group) {
    return {
      id: String(group && group.id || ''),
      sceneId: String(group && group.sceneId || ''),
      ownerId: String(group && group.ownerId || ''),
      source: sourceRef(group && group.source || {}),
      chainContext: String(group && group.chainContext || ''),
      parserBacked: group && group.parserBacked !== false,
      routeCount: ensureArray(group && group.clauses).length,
      clauses: ensureArray(group && group.clauses).map((clause) => ({
        order: Number(clause && clause.order || 0),
        rawTarget: String(clause && clause.rawTarget || ''),
        resolvedTarget: String(clause && clause.resolvedTarget || ''),
        targetResolved: Boolean(clause && clause.targetResolved),
        predicate: String(clause && clause.predicate || ''),
        isFallback: Boolean(clause && clause.isFallback)
      }))
    };
  }

  function dynamicQEvidence(evidence, diagnostics, sampleLimit) {
    const rows = parserEvidenceRows(evidence, 'dynamicKeyEvidence');
    if (rows.length) {
      const manual = rows.filter((row) => String(row && row.reviewBoundary || '') === 'manual_review' || row && row.safeExpansion !== true);
      const classifications = countBy(manual, (row) => String(row && row.classification || 'unknown'));
      return {
        count: manual.length,
        structuredEvidenceCount: rows.length,
        manualReviewCount: manual.length,
        safeExpansionCount: rows.filter((row) => row && row.safeExpansion === true).length,
        classifications,
        reviewBoundary: 'manual_review',
        reason: 'Dynamic Q[] keys are represented as parser evidence; unresolved keys stay review-only unless a bounded static expansion is proven.',
        samples: manual.slice(0, sampleLimit).map(dynamicKeySample),
        safeExpansionSamples: rows.filter((row) => row && row.safeExpansion === true).slice(0, sampleLimit).map(dynamicKeySample)
      };
    }
    const items = ensureArray(diagnostics).filter((diag) => String(diag && diag.code || '') === 'project_map.dynamic_q_opaque');
    const classifications = countBy(items, (diag) => classifyDynamicDiagnostic(diag));
    return {
      count: items.length,
      structuredEvidenceCount: 0,
      manualReviewCount: items.length,
      safeExpansionCount: items.filter((diag) => diag && diag.safeExpansion === true).length,
      classifications,
      reviewBoundary: 'manual_review',
      reason: 'Dynamic Q[] keys stay review-only unless the parser can prove a bounded static expansion.',
      samples: items.slice(0, sampleLimit).map((diag) => ({
        expression: dynamicExpression(diag),
        classification: classifyDynamicDiagnostic(diag),
        source: sourceRef(diag.source || {path: diag.path}),
        safeExpansion: diag && diag.safeExpansion === true
      }))
    };
  }

  function dynamicKeySample(row) {
    return {
      id: String(row && row.id || ''),
      expression: String(row && row.expression || ''),
      accessKind: String(row && row.accessKind || ''),
      classification: String(row && row.classification || 'unknown'),
      source: sourceRef(row && row.source || {}),
      safeExpansion: row && row.safeExpansion === true,
      expandedKeyCount: Number(row && row.expandedKeyCount || ensureArray(row && row.expandedKeys).length || 0),
      expandedKeys: ensureArray(row && row.expandedKeys).slice(0, 8).map(String),
      bindingSources: ensureArray(row && row.bindingSources).slice(0, 8).map((item) => ({
        name: String(item && item.name || ''),
        kind: String(item && item.kind || ''),
        valueCount: Number(item && item.valueCount || 0)
      })),
      reviewBoundary: String(row && row.reviewBoundary || '')
    };
  }

  function monthlyPopupEvidence(index, evidence, sampleLimit) {
    const routerTable = profileRouterRows(evidence, 'monthlyPopupRouterTable');
    if (routerTable.length) {
      return {
        count: routerTable.length,
        routerTableCount: routerTable.length,
        linkedSceneCount: routerTable.filter((row) => String(row && row.linkedSceneId || '')).length,
        contentRoute: 'object_workspace',
        routerBoundary: 'manual_review',
        routerManualReviewCount: routerTable.filter((row) => String(row && row.installSafety || '') === 'manual_review').length,
        reason: 'Monthly popup content is visible through linked event evidence; protected post-event router behavior remains manual review.',
        samples: routerTable.slice(0, sampleLimit).map((row) => ({
          id: String(row && row.id || ''),
          title: String(row && row.title || ''),
          linkedSceneId: String(row && row.linkedSceneId || ''),
          router: sourceRef(row && row.router && row.router.source || {}),
          source: sourceRef(row && row.contentSource || {})
        }))
      };
    }
    const semantic = isObject(index.semantic) ? index.semantic : {};
    const news = isObject(semantic.news) ? semantic.news : {};
    const popups = ensureArray(news.eventPopups);
    const linked = popups.filter((popup) => String(popup && (popup.linkedSceneId || popup.sceneId) || ''));
    return {
      count: popups.length,
      routerTableCount: 0,
      linkedSceneCount: linked.length,
      contentRoute: 'object_workspace',
      routerBoundary: 'manual_review',
      routerManualReviewCount: popups.length,
      reason: 'Monthly popup content is visible through the linked event object; protected post-event router behavior remains manual review.',
      samples: popups.slice(0, sampleLimit).map((popup) => ({
        id: String(popup && popup.id || popup && popup.linkedSceneId || ''),
        title: String(popup && (popup.title || popup.headline || popup.label) || ''),
        linkedSceneId: String(popup && (popup.linkedSceneId || popup.sceneId) || ''),
        source: sourceRef(popup && (popup.excerptSource || popup.source) || {})
      }))
    };
  }

  function sharedEffectEvidence(index, evidence, sampleLimit) {
    const clauses = parserEvidenceRows(evidence, 'effectClauses');
    if (clauses.length) {
      const byLine = new Map();
      clauses.forEach((clause) => {
        const key = String(clause && clause.sharedLineGroupId || '') ||
          [clause && clause.source && clause.source.path || '', clause && clause.source && (clause.source.line || clause.source.startLine) || ''].join(':');
        if (!key) {
          return;
        }
        if (!byLine.has(key)) {
          byLine.set(key, {source: sourceRef(clause && clause.source || {}), rows: [], inlineEffectCount: 0});
        }
        const group = byLine.get(key);
        group.rows.push(clause);
        group.inlineEffectCount = Math.max(group.inlineEffectCount, Number(clause && clause.lineEffectCount || 1));
      });
      const shared = Array.from(byLine.values()).filter((group) => group.rows.length > 1 || group.inlineEffectCount > 1);
      return {
        lineCount: shared.length,
        clauseCount: clauses.length,
        effectRowCount: clauses.length,
        guardedCandidateCount: clauses.filter((clause) => String(clause && clause.installSafety || '') === 'guarded_candidate').length,
        manualReviewCount: clauses.filter((clause) => String(clause && clause.installSafety || '') === 'manual_review').length,
        installSafety: shared.length ? 'manual_review' : 'guarded_candidate',
        reason: 'Parser-backed effect clauses expose per-clause source evidence; ambiguous shared-line clauses remain manual review.',
        samples: shared.slice(0, sampleLimit).map((group) => ({
          source: group.source,
          rowCount: group.rows.length,
          inlineEffectCount: group.inlineEffectCount,
          labels: group.rows.map((row) => String(row && (row.sourceExpression || row.id) || '').trim()).filter(Boolean).slice(0, 4)
        }))
      };
    }
    const semantic = isObject(index.semantic) ? index.semantic : {};
    const corpus = ensureArray(semantic.textCorpus && semantic.textCorpus.items);
    const scriptRows = corpus.filter((item) => {
      const role = String(item && item.role || '');
      const text = String(item && item.text || item && item.source && item.source.anchorText || '');
      return role === 'script' && /\bQ\.|(?:^|[;\s])[A-Za-z_][A-Za-z0-9_]*\s*(?:=|\+=|-=|\*=|\/=)/.test(text);
    });
    const byLine = new Map();
    scriptRows.forEach((row) => {
      const ref = sourceRef(row && row.source || {});
      const key = ref.path && ref.line ? ref.path + ':' + ref.line : '';
      if (!key) {
        return;
      }
      if (!byLine.has(key)) {
        byLine.set(key, {source: ref, rows: [], inlineEffectCount: 0});
      }
      const group = byLine.get(key);
      group.rows.push(row);
      group.inlineEffectCount = Math.max(group.inlineEffectCount, countEffectExpressions(ref.anchorText || row.text || ''));
    });
    const shared = Array.from(byLine.values()).filter((group) => group.rows.length > 1 || group.inlineEffectCount > 1);
    return {
      lineCount: shared.length,
      clauseCount: 0,
      effectRowCount: shared.reduce((sum, group) => sum + group.rows.length, 0),
      installSafety: 'manual_review',
      reason: 'Co-located source-line effects are reviewed as a whole line so one effect edit cannot silently clobber adjacent logic.',
      samples: shared.slice(0, sampleLimit).map((group) => ({
        source: group.source,
        rowCount: group.rows.length,
        inlineEffectCount: group.inlineEffectCount,
        labels: group.rows.map((row) => String(row && (row.text || row.id) || '').trim()).filter(Boolean).slice(0, 4)
      }))
    };
  }

  function runtimeReadinessEvidence(index, diagnostics) {
    const semantic = isObject(index.semantic) ? index.semantic : {};
    const runtimeSurface = isObject(semantic.runtimeSurface) ? semantic.runtimeSurface : {};
    const readiness = isObject(runtimeSurface.readiness) ? runtimeSurface.readiness : {};
    const runtimeDiagnostics = ensureArray(diagnostics).filter((diag) => {
      const code = String(diag && diag.code || '');
      return code === 'runtime_surface.missing_script' ||
        code === 'runtime_surface.missing_stylesheet' ||
        code === 'runtime_surface.partial_runtime' ||
        code === 'runtime_preview.quick_html_missing';
    });
    const missingDependencies = uniqueStrings(runtimeDiagnostics
      .map((diag) => String(diag && (diag.missingPath || diag.path) || ''))
      .filter(Boolean));
    const compactDiagnostics = uniqueDiagnostics(runtimeDiagnostics);
    const fallbackRequired = runtimeDiagnostics.length > 0 ||
      readiness.status === 'partial' ||
      readiness.quickPreviewReady === false ||
      Number(readiness.missingDependencyCount || 0) > 0;
    return {
      status: String(readiness.status || (fallbackRequired ? 'partial' : 'unknown')),
      quickPreviewReady: readiness.quickPreviewReady === undefined ? !fallbackRequired : Boolean(readiness.quickPreviewReady),
      fallbackRequired,
      fallbackMode: fallbackRequired ? 'temporary_full_build' : 'quick_reuse',
      missingDependencyCount: missingDependencies.length || Number(readiness.missingDependencyCount || 0) || 0,
      missingDependencies,
      diagnostics: compactDiagnostics.map((diag) => ({
        severity: String(diag && diag.severity || ''),
        code: String(diag && diag.code || ''),
        message: String(diag && diag.message || ''),
        missingPath: String(diag && diag.missingPath || '')
      }))
    };
  }

  function classifyDynamicDiagnostic(diag) {
    const explicit = String(diag && diag.classification || '').trim();
    if (explicit) {
      return explicit;
    }
    const expr = dynamicExpression(diag);
    if (/\[[^\]]+\]/.test(expr)) {
      return 'indexed_binding';
    }
    if (expr.indexOf('+') >= 0) {
      return 'dynamic_concatenation';
    }
    if (/^(?:Q\.)?[A-Za-z_][A-Za-z0-9_]*$/.test(expr)) {
      return 'unresolved_identifier';
    }
    return expr ? 'opaque_expression' : 'unknown';
  }

  function dynamicExpression(diag) {
    const explicit = String(diag && diag.expression || '').trim();
    if (explicit) {
      return explicit;
    }
    const message = String(diag && diag.message || '');
    const match = message.match(/Q\[(.*)\]/);
    return match ? match[1].trim() : '';
  }

  function countEffectExpressions(value) {
    const text = String(value || '');
    const matches = text.match(/(?:Q\.)?[A-Za-z_][A-Za-z0-9_]*\s*(?:=|\+=|-=|\*=|\/=)/g);
    return matches ? matches.length : 0;
  }

  function countBy(items, keyFn) {
    return ensureArray(items).reduce((counts, item) => {
      const key = String(keyFn(item) || 'unknown');
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});
  }

  function uniqueDiagnostics(items) {
    const seen = new Set();
    const out = [];
    ensureArray(items).forEach((diag) => {
      const key = [
        String(diag && diag.severity || ''),
        String(diag && diag.code || ''),
        String(diag && diag.message || ''),
        String(diag && diag.missingPath || '')
      ].join('\u0000');
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      out.push(diag);
    });
    return out;
  }

  function uniqueStrings(items) {
    const seen = new Set();
    const out = [];
    ensureArray(items).forEach((item) => {
      const text = String(item || '');
      if (!text || seen.has(text)) {
        return;
      }
      seen.add(text);
      out.push(text);
    });
    return out;
  }

  function sourceRef(source) {
    const value = isObject(source) ? source : {};
    const line = numberOrNull(value.line || value.startLine);
    const endLine = numberOrNull(value.endLine || value.line || value.startLine);
    return {
      path: String(value.path || '').replace(/\\/g, '/').replace(/^\.\//, '').trim(),
      line,
      startLine: line,
      endLine,
      anchorText: String(value.anchorText || '').trim()
    };
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? Math.floor(num) : null;
  }

  const api = {
    buildConfidenceReport
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapParserRendererConfidence = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
