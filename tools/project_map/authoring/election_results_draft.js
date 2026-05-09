(function initProjectMapElectionResultsDraft(global) {
  'use strict';

  const VERSION = '0.1';
  const KIND = 'election_results';
  const ID_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

  const DEFAULT_PARTIES = [
    party('spd', 'SPD', '#d9341f', '28.7', '2.7', '29.8', '3.3', '153'),
    party('kpd', 'KPD', '#7a1708', '10.5', '1.5', '10.9', '1.8', '56'),
    party('ddp', 'DDP', '#d6cd54', '4.5', '-1.8', '4.7', '-1.8', '24'),
    party('z', 'Z', '#000000', '11.9', '-1.7', '12.4', '-2.3', '64'),
    party('bvp', 'BVP', '#b8e2eb', '3.0', '-0.7', '3.1', '-0.8', '16'),
    party('dvp', 'DVP', '#d6b339', '8.5', '-1.6', '8.9', '-1.4', '46'),
    party('others', 'Others', '#9b9b9b', '14.0', '6.2', '10.5', '4.6', '54'),
    party('dnvp', 'DNVP', '#5a8fbd', '14.9', '-5.6', '15.5', '-5.4', '80'),
    party('nsdap', 'NSDAP', '#85500e', '4.1', '1.1', '4.3', '1.3', '22')
  ];

  const DEFAULT_COALITIONS = [
    coalition('weimar', 'Weimar Coalition', 'SPD + Z + DDP', '46.9'),
    coalition('grand', 'Grand Coalition', 'SPD + Z + BVP + DDP + DVP', '58.9'),
    coalition('bourgeois', 'Bourgeois Coalition', 'Z + BVP + DDP + DVP + Others', '39.6'),
    coalition('right_wing', 'Right-wing Coalition', 'Z + BVP + DVP + Others + DNVP', '50.4')
  ];

  const DEFAULT_CHOICES = [
    choice('grand', 'We can form a Grand Coalition.', 'SPD + Z + BVP + DDP + DVP (58.9%)', false, '', 'A grand coalition government is formed.', []),
    choice('popular_front', 'A new "Popular Front" coalition?', 'SPD + KPD + Z + DDP (57.8%) - relations are not good enough.', true, 'kpd_relations >= 50', '', []),
    choice('refuse', 'Refuse to form a government, so that a right-wing coalition may be formed.', 'Z + BVP + DVP + Others + DNVP (50.4%)', false, '', 'A right-wing coalition may attempt to form a government.', [])
  ];

  function defaultDraft(projectIndex) {
    const electionEvents = collectElectionEvents(projectIndex);
    const selected = electionEvents[0] || null;
    const sourceBacked = hasSourceTextEvidence(selected);
    return normalizeDraft({
      schemaVersion: VERSION,
      kind: KIND,
      id: 'election_results_update',
      title: selected && (selected.screenTitle || selected.title) || 'Election Results',
      subtitle: selected && selected.subtitle || 'Reichstag election results',
      intro: selected && selected.intro || 'There are some potential coalition arrangements.',
      seatsTotal: selected && selected.seatsTotal || '515',
      targetSceneId: selected && selected.id || '',
      electionKind: selected && selected.electionKind || 'reichstag',
      year: selected && selected.year || '',
      month: selected && selected.month || '',
      viewIf: selected && selected.viewIf || '',
      resultText: selected && selected.resultText || (sourceBacked ? '' : 'Use this area for the consequence text shown after a coalition choice.'),
      conditionText: selected && selected.conditionText || '',
      sourcePath: selected && selected.path || 'source/scenes/events/election_results.scene.dry',
      chartElementId: selected && selected.chartElementId || 'reichstag_results',
      useD3Parliament: selected ? selected.usesD3Parliament !== false : true,
      parties: selected && selected.parties && selected.parties.length ? selected.parties : DEFAULT_PARTIES,
      coalitions: selected && selected.coalitions || (sourceBacked ? [] : DEFAULT_COALITIONS),
      choices: selected && selected.choices || (sourceBacked ? [] : DEFAULT_CHOICES),
      effects: [],
      electionEvents,
      sourceBacked,
      evidence: selected && selected.evidence || {}
    }, projectIndex);
  }

  function normalizeDraft(input, projectIndex) {
    const draft = isObject(input) ? clone(input) : {};
    const electionEvents = ensureArray(draft.electionEvents).length ? normalizeElectionEvents(draft.electionEvents) : collectElectionEvents(projectIndex);
    const selected = selectElectionEvent(draft.targetSceneId, electionEvents);
    draft.schemaVersion = String(draft.schemaVersion || VERSION);
    draft.kind = KIND;
    draft.id = safeId(draft.id || 'election_results_update');
    draft.title = singleLine(draft.title || 'Election Results');
    draft.subtitle = singleLine(draft.subtitle || 'Reichstag election results');
    draft.intro = String(draft.intro || '').trim();
    draft.seatsTotal = numericText(draft.seatsTotal || '515', '515');
    draft.targetSceneId = String(draft.targetSceneId || selected && selected.id || '').trim();
    draft.sourceBacked = booleanValue(draft.sourceBacked !== undefined ? draft.sourceBacked : hasSourceTextEvidence(selected));
    draft.electionKind = safeId(draft.electionKind || selected && selected.electionKind || 'reichstag').toLowerCase();
    draft.year = String(draft.year || selected && selected.year || '').trim();
    draft.month = String(draft.month || selected && selected.month || '').trim();
    draft.viewIf = String(draft.viewIf || selected && selected.viewIf || '').trim();
    draft.resultText = String(draft.resultText || '').trim();
    draft.conditionText = String(draft.conditionText || '').trim();
    draft.sourcePath = String(draft.sourcePath || selected && selected.path || 'source/scenes/events/election_results.scene.dry').trim();
    draft.chartElementId = String(draft.chartElementId || selected && selected.chartElementId || 'reichstag_results').trim();
    draft.useD3Parliament = booleanValue(draft.useD3Parliament !== undefined ? draft.useD3Parliament : true);
    draft.parties = normalizeRows(draft.parties, DEFAULT_PARTIES, normalizeParty);
    draft.coalitions = normalizeRows(draft.coalitions, draft.sourceBacked ? [] : DEFAULT_COALITIONS, normalizeCoalition);
    draft.choices = normalizeRows(draft.choices, draft.sourceBacked ? [] : DEFAULT_CHOICES, normalizeChoice);
    draft.effects = normalizeEffects(draft.effects);
    draft.electionEvents = electionEvents;
    draft.evidence = isObject(draft.evidence) ? draft.evidence : {};
    return draft;
  }

  function validateDraft(input, projectIndex) {
    const draft = normalizeDraft(input, projectIndex);
    const diagnostics = [];
    if (!ID_RE.test(draft.id)) {
      diagnostic(diagnostics, 'error', 'election_results.id', 'Election Results draft id must be file-safe.');
    }
    if (!draft.title) {
      diagnostic(diagnostics, 'error', 'election_results.title', 'Election Results title is required.');
    }
    if (!draft.parties.some((row) => Number(row.seats) > 0 || Number(row.seatsShare) > 0)) {
      diagnostic(diagnostics, 'warning', 'election_results.empty_parties', 'No party seat data is available for the chart.');
    }
    if (!draft.targetSceneId && draft.electionEvents.length) {
      diagnostic(diagnostics, 'warning', 'election_results.no_target_event', 'Choose which election event this results screen modifies.');
    }
    if (draft.useD3Parliament && !draft.chartElementId) {
      diagnostic(diagnostics, 'warning', 'election_results.no_chart_target', 'D3 parliament charts need an SVG element id such as reichstag_results or thuringia_landtag.');
    }
    return {ok: diagnostics.every((item) => item.severity !== 'error'), draft, diagnostics};
  }

  function buildExportBundle(input, projectIndex, options) {
    const validation = validateDraft(input, projectIndex);
    const draft = validation.draft;
    const installApi = installPlanApi();
    const plan = buildInstallPlan(draft, projectIndex);
    const draftJson = JSON.stringify(draft, null, 2) + '\n';
    const playerPreview = renderPlayerPreview(draft);
    const installPlanJson = installApi.renderInstallPlanJson(plan);
    const patchPreview = installApi.renderPatchPreview(plan);
    const installChecklist = installApi.renderOperationChecklist(plan, options || {});
    const installNotes = renderInstallNotes(draft);
    return {
      ok: validation.ok,
      draft,
      diagnostics: validation.diagnostics,
      files: [
        {path: draft.id + '.election-results-draft.json', content: draftJson, kind: 'draft'},
        {path: draft.id + '.election-results-preview.txt', content: playerPreview, kind: 'preview'},
        {path: draft.id + '.install-plan.json', content: installPlanJson, kind: 'install_plan'},
        {path: draft.id + '.patch-preview.diff', content: patchPreview, kind: 'patch_preview'},
        {path: draft.id + '.install-notes.txt', content: installNotes, kind: 'notes'}
      ],
      playerPreview,
      previewText: playerPreview,
      draftJson,
      installPlan: plan,
      installPlanJson,
      patchPreview,
      installChecklist,
      installNotes
    };
  }

  function buildInstallPlan(input, projectIndex) {
    const draft = normalizeDraft(input, projectIndex);
    const installApi = installPlanApi();
    return installApi.buildInstallPlan({
      id: draft.id,
      draftKind: KIND,
      title: draft.title || draft.id,
      project: installApi.projectProvenanceFromIndex ? installApi.projectProvenanceFromIndex(projectIndex) : null,
      operations: [{
        id: 'election_results_manual_review',
        type: 'manual_snippet',
        path: draft.sourcePath || 'source/scenes/events/election_results.scene.dry',
        content: JSON.stringify({
          targetSceneId: draft.targetSceneId,
          electionKind: draft.electionKind,
          viewIf: draft.viewIf,
          chartElementId: draft.chartElementId,
          useD3Parliament: draft.useD3Parliament,
          title: draft.title,
          subtitle: draft.subtitle,
          resultText: draft.resultText,
          conditionText: draft.conditionText,
          parties: draft.parties,
          coalitions: draft.coalitions,
          choices: draft.choices,
          effects: draft.effects
        }, null, 2) + '\n',
        safety: 'manual_review',
        role: 'election_results',
        description: 'Review how this election-results UI is wired into the project-specific event renderer.'
      }]
    });
  }

  function renderPlayerPreview(draft) {
    const lines = [
      draft.title,
      draft.subtitle,
      'Source: ' + (draft.sourcePath || '(new election event)'),
      'Chart: ' + (draft.useD3Parliament ? 'd3.parliament -> #' + (draft.chartElementId || '(missing target)') : 'custom/manual chart'),
      draft.viewIf ? 'Condition: ' + draft.viewIf : '',
      '',
      'Parties:'
    ].filter((line) => line !== '');
    draft.parties.forEach((row) => {
      lines.push('- ' + row.name + ': ' + row.voteShare + '% vote / ' + row.seatsShare + '% seats');
    });
    lines.push('', 'Potential coalitions:');
    draft.coalitions.forEach((row) => {
      lines.push('- ' + row.name + ' (' + row.parties + '): ' + row.share + '%');
    });
    lines.push('', 'Player choices:');
    draft.choices.forEach((row) => {
      lines.push('- ' + row.label + (row.disabled ? ' [disabled]' : ''));
      if (row.condition) {
        lines.push('  if: ' + row.condition);
      }
      if (row.detail) {
        lines.push('  ' + row.detail);
      }
      if (row.resultText) {
        lines.push('  result: ' + row.resultText);
      }
      ensureArray(row.effects).forEach((effect) => lines.push('  effect: ' + effectLine(effect)));
    });
    if (draft.resultText || draft.conditionText || draft.effects.length) {
      lines.push('', 'Conditions and consequences:');
      if (draft.conditionText) {
        lines.push('- conditional text: ' + draft.conditionText);
      }
      if (draft.resultText) {
        lines.push('- result text: ' + draft.resultText);
      }
      draft.effects.forEach((effect) => lines.push('- effect: ' + effectLine(effect)));
    }
    return lines.join('\n') + '\n';
  }

  function renderInstallNotes(draft) {
    return [
      'Election Results UI draft: ' + draft.id,
      '',
      'This is a System UI authoring draft for a player-facing election-results event.',
      'The current install plan is manual-review only because election-result renderers are project-specific.',
      '',
      'Suggested source target:',
      draft.sourcePath || 'source/scenes/events/election_results.scene.dry',
      '',
      'D3 parliament target:',
      draft.useD3Parliament ? ('#' + (draft.chartElementId || '(missing id)')) : 'D3 disabled for this draft',
      '',
      'Use the WYSIWYG preview to adjust party colors, vote/seat values, coalitions, and player choices before wiring it into the event chain.'
    ].join('\n') + '\n';
  }

  function normalizeRows(rows, defaults, normalizer) {
    const source = Array.isArray(rows) && rows.length ? rows : defaults;
    const length = Math.max(defaults.length, source.length);
    return Array.from({length}).map((_, index) => {
      const fallback = defaults[index] || defaults[defaults.length - 1] || {};
      return normalizer(source[index] || fallback, fallback, index);
    });
  }

  function normalizeParty(input, fallback, index) {
    const value = isObject(input) ? input : {};
    return party(
      safeId(value.key || fallback.key || 'party_' + (index + 1)).toLowerCase(),
      singleLine(value.name || fallback.name || 'Party ' + (index + 1)),
      safeColor(value.color || fallback.color || '#999999'),
      numericText(value.voteShare, fallback.voteShare),
      signedNumericText(value.voteChange, fallback.voteChange),
      numericText(value.seatsShare, fallback.seatsShare),
      signedNumericText(value.seatsChange, fallback.seatsChange),
      positivePreviewSeats(value.seats, fallback.seats, value.seatsExpression || fallback.seatsExpression),
      String(value.seatsExpression || fallback.seatsExpression || '').trim()
    );
  }

  function normalizeCoalition(input, fallback, index) {
    const value = isObject(input) ? input : {};
    return coalition(
      safeId(value.key || fallback.key || 'coalition_' + (index + 1)).toLowerCase(),
      singleLine(value.name || fallback.name || 'Coalition ' + (index + 1)),
      singleLine(value.parties || fallback.parties || ''),
      numericText(value.share, fallback.share),
      String(value.description || fallback.description || '').trim()
    );
  }

  function normalizeChoice(input, fallback, index) {
    const value = isObject(input) ? input : {};
    return choice(
      safeId(value.key || fallback.key || 'choice_' + (index + 1)).toLowerCase(),
      singleLine(value.label || fallback.label || 'Choice ' + (index + 1)),
      String(value.detail || fallback.detail || '').trim(),
      booleanValue(value.disabled !== undefined ? value.disabled : fallback.disabled),
      String(value.condition || fallback.condition || '').trim(),
      String(value.resultText || fallback.resultText || '').trim(),
      normalizeEffects(value.effects || fallback.effects)
    );
  }

  function party(key, name, color, voteShare, voteChange, seatsShare, seatsChange, seats, seatsExpression) {
    const row = {key, name, color, voteShare, voteChange, seatsShare, seatsChange, seats};
    if (seatsExpression) {
      row.seatsExpression = seatsExpression;
    }
    return row;
  }

  function coalition(key, name, parties, share, description) {
    return {key, name, parties, share, description: description || ''};
  }

  function choice(key, label, detail, disabled, condition, resultText, effects) {
    return {key, label, detail, disabled: Boolean(disabled), condition: condition || '', resultText: resultText || '', effects: ensureArray(effects)};
  }

  function normalizeEffects(effects) {
    return ensureArray(effects).map((effect, index) => {
      const value = isObject(effect) ? effect : {};
      const variable = String(value.variable || value.name || '').trim();
      const op = String(value.op || value.operator || '+=').trim() || '+=';
      const rawValue = value.value === undefined || value.value === null ? (index === 0 ? '1' : '') : value.value;
      return {
        variable,
        op,
        value: String(rawValue).trim(),
        condition: String(value.condition || '').trim(),
        hook: String(value.hook || '').trim()
      };
    }).filter((effect) => effect.variable || effect.value || effect.condition);
  }

  function collectElectionEvents(projectIndex) {
    const scenes = ensureArray(projectIndex && projectIndex.scenes);
    const semanticRows = ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.electionResults && projectIndex.semantic.electionResults.items)
      .map(electionEventFromSemantic).filter(Boolean);
    const sceneRows = scenes.map(electionEventFromScene).filter(Boolean);
    const rows = mergeElectionEventRows(semanticRows, sceneRows).map((row) => enrichElectionEventText(row, projectIndex));
    rows.sort((a, b) => b.score - a.score || String(a.title).localeCompare(String(b.title)));
    return rows.map((row) => {
      const copy = Object.assign({}, row);
      delete copy.score;
      return copy;
    }).slice(0, 40);
  }

  function enrichElectionEventText(row, projectIndex) {
    const value = isObject(row) ? Object.assign({}, row) : {};
    const sceneId = String(value.sceneId || value.id || '').trim();
    const allRows = textRowsForScene(projectIndex, sceneId);
    if (!allRows.length) {
      return value;
    }
    const scene = sceneById(projectIndex, sceneId);
    const scope = textScopeForElectionSource(allRows, scene, value);
    const rows = scope.rows;
    const openingRows = rows.filter((item) => isOpeningTextRow(item));
    const heading = nearestHeadingText(rows, value.line) || firstRowText(openingRows, 'heading') || '';
    const title = firstRowText(openingRows, 'title') || '';
    const subtitle = firstRowText(openingRows, 'subtitle') || '';
    const intro = bodyText(sourceBodyRows(rows, value.line, scope.sectionId)) || bodyText(openingRows);
    const choices = sourceChoicesFromRows(scene, rows);
    const fallbackResult = choices.length ? rows
      .filter((item) => isElectionBodyRow(item) && String(item.owner && item.owner.sectionId || '').trim() && !choiceTargetsSection(choices, item.owner && item.owner.sectionId))
      .map((item) => item.text)
      .filter(Boolean)
      .join('\n\n') : '';
    value.screenTitle = heading || title || value.screenTitle || value.title || '';
    if (subtitle && !value.subtitle) {
      value.subtitle = subtitle;
    }
    if (intro) {
      value.intro = intro;
    }
    if (fallbackResult) {
      value.resultText = fallbackResult;
    }
    if (choices.length) {
      value.choices = choices;
      value.coalitions = sourceCoalitionsFromChoices(choices);
    }
    value.sourceBacked = true;
    value.evidence = Object.assign({}, value.evidence || {}, {
      textCorpusRows: rows.length,
      sourceText: 'text_corpus',
      sourceSectionId: scope.sectionId || '',
      sourceChoices: choices.length
    });
    return value;
  }

  function textRowsForScene(projectIndex, sceneId) {
    const target = String(sceneId || '').trim();
    if (!target) {
      return [];
    }
    return ensureArray(projectIndex && projectIndex.semantic && projectIndex.semantic.textCorpus && projectIndex.semantic.textCorpus.items)
      .filter((item) => {
        const owner = isObject(item && item.owner) ? item.owner : {};
        return String(owner.sceneId || '') === target;
      })
      .slice()
      .sort((a, b) => numberOr(a && a.source && a.source.line, 0) - numberOr(b && b.source && b.source.line, 0));
  }

  function sceneById(projectIndex, sceneId) {
    const target = String(sceneId || '').trim();
    return ensureArray(projectIndex && projectIndex.scenes).find((scene) => String(scene && scene.id || '') === target) || null;
  }

  function textScopeForElectionSource(rows, scene, source) {
    const allRows = ensureArray(rows);
    const line = numberOr(source && source.line, 0);
    const section = sectionForSourceLine(scene, line);
    if (section) {
      const sectionId = normalizeLocalId(section.id);
      const sceneId = normalizeLocalId(scene && scene.id);
      const sectionRows = allRows.filter((item) => {
        const owner = isObject(item && item.owner) ? item.owner : {};
        const rowSection = normalizeLocalId(owner.sectionId || item && item.sectionId);
        return sectionMatchesTarget(rowSection, sectionId, sceneId);
      });
      if (sectionRows.length) {
        return {rows: sectionRows, sectionId};
      }
    }
    if (line) {
      const nearby = rowsAroundSourceLine(allRows, line);
      if (nearby.length) {
        return {rows: nearby, sectionId: ''};
      }
    }
    return {rows: allRows, sectionId: ''};
  }

  function sectionForSourceLine(scene, line) {
    const targetLine = Number(line || 0);
    if (!targetLine) {
      return null;
    }
    return ensureArray(scene && scene.sections).find((section) => {
      const span = isObject(section && section.sourceSpan) ? section.sourceSpan : {};
      const start = Number(span.startLine || span.line || 0);
      const end = Number(span.endLine || span.end || 0);
      return start && end && targetLine >= start && targetLine <= end;
    }) || null;
  }

  function rowsAroundSourceLine(rows, line) {
    const sourceLine = Number(line || 0);
    if (!sourceLine) {
      return ensureArray(rows);
    }
    return ensureArray(rows).filter((item) => {
      const rowLine = textRowLine(item);
      return rowLine && rowLine >= sourceLine - 20 && rowLine <= sourceLine + 180;
    });
  }

  function sourceBodyRows(rows, line, sectionId) {
    const sourceSectionId = normalizeLocalId(sectionId);
    const bodyRows = ensureArray(rows).filter((item) => {
      if (!isElectionBodyRow(item)) {
        return false;
      }
      const owner = isObject(item && item.owner) ? item.owner : {};
      const rowSectionId = normalizeLocalId(owner.sectionId || item && item.sectionId);
      return rowSectionId === sourceSectionId;
    });
    const sourceLine = Number(line || 0);
    if (!sourceLine) {
      return bodyRows;
    }
    const after = bodyRows.filter((item) => {
      const rowLine = textRowLine(item);
      return rowLine && rowLine >= sourceLine && rowLine <= sourceLine + 120;
    });
    if (after.length) {
      return after;
    }
    const nearby = bodyRows.filter((item) => {
      const rowLine = textRowLine(item);
      return rowLine && Math.abs(rowLine - sourceLine) <= 120;
    });
    return nearby.length ? nearby : bodyRows;
  }

  function nearestHeadingText(rows, line) {
    const sourceLine = Number(line || 0);
    const headings = ensureArray(rows)
      .filter((item) => String(item && item.role || '') === 'heading' && String(item && item.text || '').trim())
      .map((item) => ({item, line: textRowLine(item)}));
    if (!headings.length) {
      return '';
    }
    if (!sourceLine) {
      return singleLine(headings[0].item.text);
    }
    const after = headings
      .filter((entry) => entry.line && entry.line >= sourceLine - 4 && entry.line <= sourceLine + 120)
      .sort((a, b) => Math.abs(a.line - sourceLine) - Math.abs(b.line - sourceLine))[0];
    if (after) {
      return singleLine(after.item.text);
    }
    headings.sort((a, b) => Math.abs((a.line || 0) - sourceLine) - Math.abs((b.line || 0) - sourceLine));
    return singleLine(headings[0].item.text);
  }

  function textRowLine(item) {
    return numberOr(item && item.source && item.source.line, 0);
  }

  function sourceChoicesFromRows(scene, rows) {
    const optionRows = ensureArray(rows).filter((item) => String(item && item.role || '') === 'option_label');
    if (!optionRows.length) {
      return [];
    }
    const optionMap = optionLookup(scene);
    return optionRows.map((row, index) => {
      const optionId = String(row.optionId || row.owner && row.owner.itemId || '').trim();
      const option = optionForId(optionMap, optionId);
      const targetId = optionTargetId(option, optionId);
      const targetSection = sectionForId(scene, targetId);
      const sectionRows = rowsForSection(rows, scene && scene.id, targetId);
      const subtitle = optionSubtitleFor(rows, row, optionId);
      const resultText = bodyText(sectionRows);
      const condition = uniqueStrings([
        option && option.chooseIf,
        option && option.viewIf,
        option && option.requires,
        targetSection && targetSection.chooseIf,
        targetSection && targetSection.viewIf,
        lastMeaningfulCondition(row.conditions)
      ]).join(' / ');
      return choice(
        safeId(optionId || row.id || 'choice_' + (index + 1)).toLowerCase(),
        singleLine(row.text || option && option.title || 'Choice ' + (index + 1)),
        subtitle || singleLine(option && option.subtitle || ''),
        Boolean(condition),
        condition,
        resultText,
        []
      );
    }).filter((item) => item.label);
  }

  function sourceCoalitionsFromChoices(choices) {
    return ensureArray(choices).map((item, index) => {
      const detail = String(item && item.detail || '').trim();
      if (!detail || !/[A-Za-z0-9]\s*\+\s*[A-Za-z0-9]/.test(detail)) {
        return null;
      }
      const percent = detail.match(/(\d+(?:\.\d+)?)\s*%/);
      const parties = detail.replace(/\([^)]*\)/g, '').replace(/\d+(?:\.\d+)?\s*%/g, '').trim();
      return coalition(
        safeId(item.key || item.label || 'coalition_' + (index + 1)).toLowerCase(),
        singleLine(item.label || 'Coalition ' + (index + 1)),
        singleLine(parties || detail),
        percent ? percent[1] : '',
        ''
      );
    }).filter(Boolean);
  }

  function optionLookup(scene) {
    const rows = collectSceneOptions(scene);
    const byId = new Map();
    rows.forEach((option) => {
      optionKeys(option).forEach((key) => {
        if (key && !byId.has(key)) {
          byId.set(key, option);
        }
      });
    });
    return byId;
  }

  function collectSceneOptions(scene) {
    const rows = ensureArray(scene && scene.options).slice();
    ensureArray(scene && scene.sections).forEach((section) => {
      ensureArray(section && section.options).forEach((option) => {
        rows.push(Object.assign({ownerSectionId: section && section.id || ''}, option || {}));
      });
    });
    return rows;
  }

  function sectionForId(scene, sectionId) {
    const target = normalizeLocalId(sectionId);
    const sceneId = String(scene && scene.id || '');
    return ensureArray(scene && scene.sections).find((section) => {
      return sectionMatchesTarget(normalizeLocalId(section && section.id), target, normalizeLocalId(sceneId));
    }) || null;
  }

  function optionKeys(option) {
    const target = isObject(option && option.target) ? option.target : {};
    return uniqueStrings([
      option && option.id,
      option && option.optionId,
      option && option.targetId,
      option && option.rawTarget,
      target.id,
      target.raw,
      target.sectionId
    ].map(normalizeLocalId));
  }

  function optionForId(map, id) {
    const key = normalizeLocalId(id);
    return map.get(key) || null;
  }

  function optionTargetId(option, fallback) {
    const target = isObject(option && option.target) ? option.target : {};
    return normalizeLocalId(target.id || target.sectionId || option && option.targetId || option && option.rawTarget || option && option.id || fallback);
  }

  function rowsForSection(rows, sceneId, sectionId) {
    const target = normalizeLocalId(sectionId);
    const scene = normalizeLocalId(sceneId);
    if (!target) {
      return [];
    }
    return ensureArray(rows).filter((item) => {
      const owner = isObject(item && item.owner) ? item.owner : {};
      const section = normalizeLocalId(owner.sectionId || item && item.sectionId);
      return sectionMatchesTarget(section, target, scene) && isElectionBodyRow(item);
    });
  }

  function optionSubtitleFor(rows, labelRow, optionId) {
    const line = numberOr(labelRow && labelRow.source && labelRow.source.line, 0);
    const target = normalizeLocalId(optionId);
    const found = ensureArray(rows).find((item) => {
      return String(item && item.role || '') === 'option_subtitle' &&
        normalizeLocalId(item.optionId || item.owner && item.owner.itemId) === target &&
        (!line || numberOr(item && item.source && item.source.line, 0) === line);
    });
    return found && found.text ? singleLine(found.text) : '';
  }

  function isOpeningTextRow(item) {
    const owner = isObject(item && item.owner) ? item.owner : {};
    const role = String(item && item.role || '');
    return !String(owner.sectionId || '').trim() &&
      (role === 'title' || role === 'subtitle' || role === 'heading' || isElectionBodyRow(item));
  }

  function isBodyRole(role) {
    const text = String(role || '');
    return text === 'body' || text === 'conditional_body';
  }

  function bodyText(rows) {
    return ensureArray(rows)
      .filter(isElectionBodyRow)
      .map((item) => String(item && item.text || '').trim())
      .filter(Boolean)
      .join('\n\n');
  }

  function isElectionBodyRow(item) {
    return isBodyRole(item && item.role) && !isElectionUiMarkupText(item && item.text);
  }

  function isElectionUiMarkupText(text) {
    const value = String(text || '').trim();
    return /<\s*(?:tr|td|table|thead|tbody|svg|div|hr)\b/i.test(value) ||
      /\bd3\.parliament\b/i.test(value);
  }

  function firstRowText(rows, role) {
    const found = ensureArray(rows).find((item) => String(item && item.role || '') === role && String(item && item.text || '').trim());
    return found ? singleLine(found.text) : '';
  }

  function choiceTargetsSection(choices, sectionId) {
    const target = normalizeLocalId(sectionId);
    return ensureArray(choices).some((item) => normalizeLocalId(item && item.key) === target);
  }

  function sectionMatchesTarget(sectionId, targetId, sceneId) {
    const section = normalizeLocalId(sectionId);
    const target = normalizeLocalId(targetId);
    const scene = normalizeLocalId(sceneId);
    if (!section || !target) {
      return false;
    }
    return section === target || section === scene + '_' + target || section.endsWith('_' + target);
  }

  function normalizeLocalId(value) {
    let text = String(value || '').trim();
    if (!text) {
      return '';
    }
    text = text.replace(/^[@#]+/, '');
    const dot = text.lastIndexOf('.');
    if (dot >= 0) {
      text = text.slice(dot + 1);
    }
    return safeId(text).toLowerCase();
  }

  function lastMeaningfulCondition(values) {
    const rows = ensureArray(values).map((item) => String(item || '').trim()).filter(Boolean);
    return rows.length ? rows[rows.length - 1] : '';
  }

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

  function electionEventFromScene(scene) {
    if (!isObject(scene)) {
      return null;
    }
    const haystack = sceneSearchText(scene);
    if (!hasParliamentSurfaceEvidence(haystack)) {
      return null;
    }
    const score = electionScore(scene, haystack);
    if (score <= 0) {
      return null;
    }
    const source = scene.sourceSpan || scene.topLevelSpan || {};
    const path = String(scene.path || source.path || scene.sourcePath || '').trim();
    const title = singleLine(scene.title || scene.name || scene.id || path || 'D3 parliament source');
    const chartElementId = inferChartElementId(haystack);
    return {
      id: String(scene.id || scene.name || safeId(title)).trim(),
      sceneId: String(scene.id || scene.name || safeId(title)).trim(),
      title,
      subtitle: inferElectionSubtitle(title, path, haystack, chartElementId),
      path,
      line: Number(source.startLine || source.line || 1) || 1,
      electionKind: inferElectionKind(title, path, haystack, chartElementId),
      year: inferYear(title + ' ' + path),
      month: '',
      viewIf: metadataLine(scene, 'viewIf') || metadataLine(scene, 'requires') || '',
      conditionText: inferConditionText(haystack),
      chartElementId,
      usesD3Parliament: true,
      reason: 'd3_parliament',
      score
    };
  }

  function hasSourceTextEvidence(source) {
    return Boolean(source && (
      source.intro ||
      source.resultText ||
      ensureArray(source.choices).length ||
      ensureArray(source.coalitions).length ||
      source.evidence && Number(source.evidence.sourceChoices || 0) > 0
    ));
  }

  function electionEventFromSemantic(row) {
    if (!isObject(row)) {
      return null;
    }
    const id = String(row.id || row.sceneId || '').trim();
    if (!id) {
      return null;
    }
    return {
      id,
      sceneId: String(row.sceneId || id).trim(),
      title: singleLine(row.title || id),
      subtitle: singleLine(row.subtitle || ''),
      path: String(row.path || row.sourcePath || '').trim(),
      line: Number(row.line || 1) || 1,
      electionKind: safeId(row.electionKind || 'election').toLowerCase(),
      year: String(row.year || '').trim(),
      month: String(row.month || '').trim(),
      viewIf: String(row.viewIf || '').trim(),
      conditionText: String(row.conditionText || '').trim(),
      chartElementId: String(row.chartElementId || '').trim(),
      usesD3Parliament: booleanValue(row.usesD3Parliament !== undefined ? row.usesD3Parliament : true),
      seatsTotal: String(row.seatsTotal || '').trim(),
      parties: normalizeRows(row.parties, [], normalizeParty),
      reason: String(row.reason || 'd3_parliament').trim(),
      score: row.usesD3Parliament === false ? 12 : 18
    };
  }

  function mergeElectionEventRows(primary, fallback) {
    const byId = new Map();
    ensureArray(primary).forEach((row) => {
      if (row && row.id) {
        byId.set(row.id, row);
      }
    });
    ensureArray(fallback).forEach((row) => {
      if (!row || !row.id) {
        return;
      }
      if (!byId.has(row.id)) {
        byId.set(row.id, row);
        return;
      }
      const current = byId.get(row.id);
      byId.set(row.id, Object.assign({}, row, current, {
        score: Math.max(Number(row.score || 0), Number(current.score || 0))
      }));
    });
    return Array.from(byId.values());
  }

  function sceneSearchText(scene) {
    const chunks = [
      scene.id,
      scene.name,
      scene.title,
      scene.path,
      ensureArray(scene.tags).join(' '),
      scene.sourceSpan && scene.sourceSpan.excerpt,
      scene.topLevelSpan && scene.topLevelSpan.excerpt
    ];
    ensureArray(scene.sections).forEach((section) => {
      chunks.push(section && section.id, section && section.title, section && section.subtitle, section && section.sourceSpan && section.sourceSpan.excerpt);
    });
    ensureArray(scene.options).forEach((option) => chunks.push(option && option.title, option && option.sourceSpan && option.sourceSpan.excerpt));
    return chunks.filter(Boolean).join('\n');
  }

  function electionScore(scene, text) {
    const lower = String(text || '').toLowerCase();
    let score = 0;
    if (/\bd3\.parliament\b/.test(lower)) {
      score += 10;
    }
    if (/election|elections|wahl|landtag|reichstag|parliament|seat chart|results/.test(lower)) {
      score += 3;
    }
    if (/election|landtag|reichstag/.test(String(scene && scene.path || '').toLowerCase())) {
      score += 3;
    }
    if (/election|results|landtag|reichstag/.test(String(scene && scene.title || '').toLowerCase())) {
      score += 2;
    }
    return score;
  }

  function hasParliamentSurfaceEvidence(text) {
    const source = String(text || '');
    if (!/\bd3\.parliament\b/i.test(source)) {
      return false;
    }
    return inferChartElementId(source) || /['"]?seats['"]?\s*:/i.test(source);
  }

  function inferChartElementId(text) {
    const source = String(text || '');
    const d3 = source.match(/d3\.select\(\s*["']#([^"']+)["']\s*\)/);
    if (d3 && d3[1]) {
      return d3[1];
    }
    const svg = source.match(/<svg[^>]+id=["']([^"']+)["']/i);
    return svg && svg[1] || '';
  }

  function inferElectionKind(title, path, text, chartId) {
    const focused = String([title, path, chartId].join(' ')).toLowerCase();
    if (/reichstag|parliament/.test(focused)) {
      return 'reichstag';
    }
    if (/landtag|thuringia|prussia|state/.test(focused)) {
      return 'state';
    }
    const source = String([title, path, text].join(' ')).toLowerCase();
    if (/reichstag|parliament/.test(source)) {
      return 'reichstag';
    }
    if (/landtag|thuringia|prussia|state/.test(source)) {
      return 'state';
    }
    return 'election';
  }

  function inferElectionSubtitle(title, path, text, chartId) {
    const kind = inferElectionKind(title, path, text, chartId);
    if (kind === 'state') {
      const state = String(title || path || '').match(/(Thuringia|Prussia|Bavaria|Saxony|Hesse|Hamburg|Berlin)/i);
      return state ? state[1] + ' election results' : 'State election results';
    }
    if (kind === 'reichstag') {
      return 'Reichstag election results';
    }
    return 'Election results';
  }

  function inferYear(text) {
    const match = String(text || '').match(/\b(19|20)\d{2}\b/);
    return match ? match[0] : '';
  }

  function inferConditionText(text) {
    const match = String(text || '').match(/\[\?\s*if\s+([^:\]]+)/i);
    return match ? match[1].trim() : '';
  }

  function metadataLine(scene, key) {
    const metadata = isObject(scene && scene.metadata) ? scene.metadata : {};
    const value = metadata[key] || metadata[key.replace(/[A-Z]/g, (char) => '-' + char.toLowerCase())];
    if (!isObject(value)) {
      return '';
    }
    return String(value.value || value.raw || value.excerpt || '').trim();
  }

  function normalizeElectionEvents(rows) {
    return ensureArray(rows).map((row) => {
      const value = isObject(row) ? row : {};
      return {
        id: String(value.id || '').trim(),
        sceneId: String(value.sceneId || value.id || '').trim(),
        title: singleLine(value.title || value.id || 'D3 parliament source'),
        subtitle: singleLine(value.subtitle || ''),
        path: String(value.path || '').trim(),
        line: Number(value.line || 0) || null,
        electionKind: safeId(value.electionKind || 'election').toLowerCase(),
        year: String(value.year || '').trim(),
        month: String(value.month || '').trim(),
        viewIf: String(value.viewIf || '').trim(),
        conditionText: String(value.conditionText || '').trim(),
        chartElementId: String(value.chartElementId || '').trim(),
        usesD3Parliament: booleanValue(value.usesD3Parliament !== undefined ? value.usesD3Parliament : false),
        seatsTotal: String(value.seatsTotal || '').trim(),
        parties: normalizeRows(value.parties, [], normalizeParty),
        reason: String(value.reason || '').trim()
      };
    }).filter((row) => row.id);
  }

  function selectElectionEvent(id, rows) {
    const key = String(id || '').trim();
    return ensureArray(rows).find((row) => row.id === key) || ensureArray(rows)[0] || null;
  }

  function effectLine(effect) {
    const row = isObject(effect) ? effect : {};
    return [row.hook || '', row.variable || '', row.op || '', row.value === undefined ? '' : row.value, row.condition ? 'if ' + row.condition : ''].filter(Boolean).join(' ');
  }

  function installPlanApi() {
    if (global && global.ProjectMapInstallPlan) {
      return global.ProjectMapInstallPlan;
    }
    if (typeof require === 'function') {
      return require('./install_plan.js');
    }
    return null;
  }

  function safeId(value) {
    const text = String(value || '').trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    return /^[A-Za-z_]/.test(text) ? text : 'item_' + (text || '1');
  }

  function safeColor(value) {
    const text = String(value || '').trim();
    return /^#[0-9A-Fa-f]{6}$/.test(text) ? text.toUpperCase() : '#999999';
  }

  function numericText(value, fallback) {
    const text = String(value === undefined || value === null || value === '' ? fallback : value).trim();
    const parsed = Number(text);
    return Number.isFinite(parsed) ? String(parsed) : String(fallback || '0');
  }

  function numberOr(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number(fallback || 0);
  }

  function positivePreviewSeats(value, fallback, expression) {
    const text = numericText(value, fallback);
    return Number(text) > 0 || !expression ? text : '1';
  }

  function signedNumericText(value, fallback) {
    const text = numericText(value, fallback);
    return text === '-0' ? '0' : text;
  }

  function singleLine(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function booleanValue(value) {
    if (typeof value === 'boolean') {
      return value;
    }
    return /^(1|true|yes|on|disabled)$/i.test(String(value || '').trim());
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function diagnostic(diagnostics, severity, code, message) {
    diagnostics.push({severity, level: severity, code, message, confidence: 'static'});
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  const api = {defaultDraft, normalizeDraft, validateDraft, buildExportBundle, buildInstallPlan, collectElectionEvents};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapElectionResultsDraft = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
