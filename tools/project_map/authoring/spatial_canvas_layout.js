// @ts-check
/**
 * spatial_canvas_layout.js — Pure layout computation for the Spatial Canvas.
 *
 * Takes ProjectIndex data and computes card positions, baseplate groupings,
 * and stack hints.  This module has no UI or DOM dependency; it is consumed
 * by spatial_canvas_model.js and the contract check.
 */
(function initProjectMapSpatialCanvasLayout(global) {
  'use strict';

  // ── constants ──────────────────────────────────────────────────────────

  /** Default intrinsic card size (before zoom). */
  var CARD_WIDTH = 300;
  var CARD_HEIGHT_MIN = 80;
  var CARD_HEIGHT_BASE = 120;
  var CARD_HEIGHT_PER_OPTION = 22;

  /** Grid spacing inside a baseplate. */
  var GRID_COL_GAP = 24;
  var GRID_ROW_GAP = 24;
  var GRID_MAX_COLS = 4;

  /** Spacing between baseplates. */
  var BASEPLATE_GAP = 64;
  var BASEPLATE_PADDING = 32;

  /** LOD pixel-height thresholds (on rendered card height). */
  var LOD_0_MAX = 60;
  var LOD_1_MAX = 250;

  // ── public entry ───────────────────────────────────────────────────────

  /**
   * Compute a full spatial layout from ProjectIndex data.
   *
   * @param {Array} cards — flat card array (from collectProjectCards or equivalent)
   * @param {object} projectIndex
   * @param {object=} options
   * @returns {{
   *   cards: Array<{key:string, x:number, y:number, width:number, height:number, baseplateId:string}>,
   *   baseplates: Array<{id:string, label:string, kind:string, bounds:{x:number,y:number,w:number,h:number}, cardKeys:Array<string>}>,
   *   stacks: Array<{id:string, label:string, cardKeys:Array<string>}>,
   *   metrics: {cardCount:number, baseplateCount:number, stackCount:number}
   * }}
   */
  function computeLayout(cards, projectIndex, options) {
    var opts = isObject(options) ? options : {};
    var cardList = ensureArray(cards);
    var overrides = isObject(opts.overrides) ? opts.overrides : {};

    // 1. Assign cards to baseplates.
    var assignment = assignBaseplates(cardList, projectIndex);

    // 2. Position cards inside each baseplate (local grid).
    var localPositions = layoutBaseplateCards(assignment.baseplates, cardList);

    // 3. Position baseplates themselves (global grid).
    var globalOffsets = layoutBaseplates(assignment.baseplates, localPositions);

    // 4. Merge local + global positions; apply manual overrides.
    var cardPositions = mergePositions(cardList, assignment, localPositions, globalOffsets, overrides);

    // 5. Compute baseplate bounds from final card positions.
    var baseplates = computeBaseplateBounds(assignment.baseplates, cardPositions);

    // 6. Compute auto-stacks for baseplates with many cards.
    var manualStacks = ensureArray(opts.manualStacks);
    var autoStacks = computeAutoStacks(assignment.baseplates, cardList, cardPositions, manualStacks);

    return {
      cards: cardPositions,
      baseplates: baseplates,
      stacks: autoStacks,
      metrics: {
        cardCount: cardPositions.length,
        baseplateCount: baseplates.length,
        stackCount: autoStacks.length
      }
    };
  }

  /**
   * Compute the LOD tier for a card given its rendered pixel height.
   *
   * @param {number} renderedHeight — card height × current zoom
   * @returns {0|1|2}
   */
  function computeLod(renderedHeight) {
    if (renderedHeight < LOD_0_MAX) {
      return 0;
    }
    if (renderedHeight < LOD_1_MAX) {
      return 1;
    }
    return 2;
  }

  /**
   * Return the intrinsic (unscaled) height for a card based on its content.
   *
   * @param {object} card
   * @returns {number}
   */
  function intrinsicCardHeight(card) {
    var value = isObject(card) ? card : {};
    var optionCount = ensureArray(value.routeTargets).length;
    var bodyLines = String(value.body || '').split('\n').length;
    var base = CARD_HEIGHT_BASE + optionCount * CARD_HEIGHT_PER_OPTION;
    if (bodyLines > 2) {
      base += (bodyLines - 2) * 16;
    }
    return Math.max(CARD_HEIGHT_MIN, base);
  }

  // ── baseplate assignment ───────────────────────────────────────────────

  /**
   * Group cards into baseplates using three heuristics:
   * 1. Chain grouping (connected components via go-to edges)
   * 2. Time bucketing (year/quarter from schedule)
   * 3. Prefix clustering (shared scene-ID prefix)
   *
   * Every card is assigned to exactly one baseplate; unassigned cards fall
   * into a catch-all "Uncategorized" plate.
   */
  function assignBaseplates(cards, projectIndex) {
    var byKey = cardKeyMap(cards);
    var edgeGroups = chainComponents(cards, projectIndex);
    var assigned = new Map(); // cardKey → baseplateId
    var baseplates = [];

    // Pass 1: chain groups
    edgeGroups.forEach(function (group) {
      if (group.keys.length < 2) {
        return; // singletons go to later passes
      }
      var id = 'chain:' + group.root;
      var label = chainLabel(group, byKey);
      baseplates.push({id: id, label: label, kind: 'chain', cardKeys: group.keys.slice()});
      group.keys.forEach(function (key) { assigned.set(key, id); });
    });

    // Pass 2: time buckets for unassigned cards
    var unassigned = cards.filter(function (c) { return !assigned.has(c.key); });
    var timeBuckets = timeBucket(unassigned);
    timeBuckets.forEach(function (bucket) {
      var id = 'time:' + bucket.label;
      baseplates.push({id: id, label: bucket.label, kind: 'time', cardKeys: bucket.keys.slice()});
      bucket.keys.forEach(function (key) { assigned.set(key, id); });
    });

    // Pass 3: prefix clusters for still-unassigned cards
    var remaining = cards.filter(function (c) { return !assigned.has(c.key); });
    var prefixGroups = prefixCluster(remaining);
    prefixGroups.forEach(function (group) {
      if (group.keys.length < 2) {
        return;
      }
      var id = 'domain:' + group.prefix;
      baseplates.push({id: id, label: group.prefix, kind: 'domain', cardKeys: group.keys.slice()});
      group.keys.forEach(function (key) { assigned.set(key, id); });
    });

    // Pass 4: catch-all
    var uncategorized = cards.filter(function (c) { return !assigned.has(c.key); });
    if (uncategorized.length) {
      var catchAllId = 'other:uncategorized';
      baseplates.push({id: catchAllId, label: 'Other', kind: 'other', cardKeys: uncategorized.map(function (c) { return c.key; })});
      uncategorized.forEach(function (c) { assigned.set(c.key, catchAllId); });
    }

    return {baseplates: baseplates, assignment: assigned};
  }

  // ── chain connected components (union-find) ────────────────────────────

  function chainComponents(cards, projectIndex) {
    var index = isObject(projectIndex) ? projectIndex : {};
    var edges = ensureArray(index.edges);
    var cardIds = new Set();
    var idToKey = new Map();
    cards.forEach(function (card) {
      cardIds.add(String(card.id));
      idToKey.set(String(card.id), card.key);
    });

    // Union-find
    var parent = {};
    function find(x) {
      if (!(x in parent)) { parent[x] = x; }
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    }
    function union(a, b) {
      var ra = find(a);
      var rb = find(b);
      if (ra !== rb) { parent[ra] = rb; }
    }

    edges.forEach(function (edge) {
      var from = sceneIdFromEndpoint(String(edge && edge.from || ''));
      var to = sceneIdFromEndpoint(String(edge && edge.to || ''));
      if (from && to && cardIds.has(from) && cardIds.has(to)) {
        union(from, to);
      }
    });

    // Collect components
    var components = new Map(); // root → [ids]
    cardIds.forEach(function (id) {
      if (!(id in parent)) { return; } // not in any edge
      var root = find(id);
      if (!components.has(root)) { components.set(root, []); }
      components.get(root).push(id);
    });

    var groups = [];
    components.forEach(function (ids, root) {
      groups.push({
        root: root,
        keys: ids.map(function (id) { return idToKey.get(id) || 'event:' + id; })
      });
    });
    return groups;
  }

  /**
   * Strip section suffix from an edge endpoint to get the scene-level ID.
   * E.g. "election_primary.option_1" → "election_primary"
   */
  function sceneIdFromEndpoint(endpoint) {
    var dot = endpoint.indexOf('.');
    return dot >= 0 ? endpoint.slice(0, dot) : endpoint;
  }

  function chainLabel(group, byKey) {
    var card = byKey.get(group.keys[0]) || byKey.get('event:' + group.root);
    if (card && card.title) {
      return String(card.title).slice(0, 40);
    }
    return String(group.root).replace(/_/g, ' ');
  }

  // ── time bucketing ─────────────────────────────────────────────────────

  function timeBucket(cards) {
    var buckets = new Map(); // "YYYY QN" → keys[]
    cards.forEach(function (card) {
      var sched = isObject(card.schedule) ? card.schedule : {};
      if (!sched.year) {
        return;
      }
      var quarter = sched.monthStart ? Math.ceil(Number(sched.monthStart) / 3) : 0;
      var label = String(sched.year) + (quarter ? ' Q' + quarter : '');
      if (!buckets.has(label)) {
        buckets.set(label, []);
      }
      buckets.get(label).push(card.key);
    });
    var out = [];
    buckets.forEach(function (keys, label) {
      out.push({label: label, keys: keys});
    });
    return out;
  }

  // ── prefix clustering ──────────────────────────────────────────────────

  function prefixCluster(cards) {
    var groups = new Map(); // prefix → keys[]
    cards.forEach(function (card) {
      var prefix = idPrefix(card.id || '');
      if (!prefix) { return; }
      if (!groups.has(prefix)) { groups.set(prefix, []); }
      groups.get(prefix).push(card.key);
    });
    var out = [];
    groups.forEach(function (keys, prefix) {
      out.push({prefix: prefix, keys: keys});
    });
    return out;
  }

  /**
   * Extract the namespace prefix from a scene ID.
   * "election_primary" → "election", "news_budget_update" → "news"
   */
  function idPrefix(id) {
    var text = String(id || '');
    var under = text.indexOf('_');
    return under > 0 ? text.slice(0, under) : '';
  }

  // ── card positioning inside baseplates ─────────────────────────────────

  /**
   * Arrange cards in each baseplate on a simple grid.
   * Returns a Map<cardKey, {localX, localY, width, height}>.
   */
  function layoutBaseplateCards(baseplates, allCards) {
    var byKey = cardKeyMap(allCards);
    var positions = new Map();

    baseplates.forEach(function (bp) {
      var cols = Math.min(bp.cardKeys.length, GRID_MAX_COLS);
      bp.cardKeys.forEach(function (key, index) {
        var card = byKey.get(key);
        var col = index % cols;
        var row = Math.floor(index / cols);
        var height = intrinsicCardHeight(card);
        positions.set(key, {
          localX: col * (CARD_WIDTH + GRID_COL_GAP),
          localY: row * (height + GRID_ROW_GAP),
          width: CARD_WIDTH,
          height: height
        });
      });
    });

    return positions;
  }

  // ── baseplate global positioning ───────────────────────────────────────

  /**
   * Arrange baseplates in a row-wrap grid, computing an (offsetX, offsetY)
   * for each.  Returns a Map<baseplateId, {offsetX, offsetY}>.
   */
  function layoutBaseplates(baseplates, localPositions) {
    var offsets = new Map();
    var cursorX = 0;
    var cursorY = 0;
    var rowMaxHeight = 0;
    var rowCount = 0;
    var MAX_ROW_PLATES = 3;

    baseplates.forEach(function (bp) {
      var bounds = localBounds(bp.cardKeys, localPositions);
      var bpWidth = bounds.w + BASEPLATE_PADDING * 2;
      var bpHeight = bounds.h + BASEPLATE_PADDING * 2;

      if (rowCount >= MAX_ROW_PLATES) {
        cursorX = 0;
        cursorY += rowMaxHeight + BASEPLATE_GAP;
        rowMaxHeight = 0;
        rowCount = 0;
      }

      offsets.set(bp.id, {offsetX: cursorX + BASEPLATE_PADDING, offsetY: cursorY + BASEPLATE_PADDING});
      cursorX += bpWidth + BASEPLATE_GAP;
      rowMaxHeight = Math.max(rowMaxHeight, bpHeight);
      rowCount += 1;
    });

    return offsets;
  }

  function localBounds(cardKeys, localPositions) {
    var maxX = 0;
    var maxY = 0;
    cardKeys.forEach(function (key) {
      var pos = localPositions.get(key);
      if (pos) {
        maxX = Math.max(maxX, pos.localX + pos.width);
        maxY = Math.max(maxY, pos.localY + pos.height);
      }
    });
    return {w: maxX || CARD_WIDTH, h: maxY || CARD_HEIGHT_BASE};
  }

  // ── merge and override ─────────────────────────────────────────────────

  function mergePositions(cards, assignment, localPositions, globalOffsets, overrides) {
    return cards.map(function (card) {
      var local = localPositions.get(card.key) || {localX: 0, localY: 0, width: CARD_WIDTH, height: CARD_HEIGHT_BASE};
      var bpId = assignment.assignment.get(card.key) || '';
      var global = globalOffsets.get(bpId) || {offsetX: 0, offsetY: 0};
      var override = isObject(overrides[card.key]) ? overrides[card.key] : null;
      var x = override && typeof override.x === 'number' ? override.x : global.offsetX + local.localX;
      var y = override && typeof override.y === 'number' ? override.y : global.offsetY + local.localY;
      return {
        key: card.key,
        x: x,
        y: y,
        width: local.width,
        height: local.height,
        baseplateId: bpId
      };
    });
  }

  // ── baseplate bounds from card positions ────────────────────────────────

  function computeBaseplateBounds(baseplates, cardPositions) {
    var posMap = new Map();
    cardPositions.forEach(function (pos) { posMap.set(pos.key, pos); });

    return baseplates.map(function (bp) {
      var minX = Infinity;
      var minY = Infinity;
      var maxX = -Infinity;
      var maxY = -Infinity;
      bp.cardKeys.forEach(function (key) {
        var pos = posMap.get(key);
        if (!pos) { return; }
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + pos.width);
        maxY = Math.max(maxY, pos.y + pos.height);
      });
      var pad = BASEPLATE_PADDING;
      return {
        id: bp.id,
        label: bp.label,
        kind: bp.kind,
        bounds: {
          x: (minX === Infinity ? 0 : minX) - pad,
          y: (minY === Infinity ? 0 : minY) - pad,
          w: (maxX === -Infinity ? CARD_WIDTH : maxX - minX) + pad * 2,
          h: (maxY === -Infinity ? CARD_HEIGHT_BASE : maxY - minY) + pad * 2
        },
        cardKeys: bp.cardKeys.slice()
      };
    });
  }

  // ── auto-stacks ──────────────────────────────────────────────────────────

  /** Auto-stack threshold: baseplates with more cards than this get stacked. */
  var AUTO_STACK_THRESHOLD = 8;

  /**
   * Create auto-stacks for baseplates that have many cards.  Manual stacks
   * take priority and are included as-is; remaining large baseplates get
   * one auto-stack each.
   */
  function computeAutoStacks(baseplates, allCards, cardPositions, manualStacks) {
    var byKey = cardKeyMap(allCards);
    var posMap = new Map();
    cardPositions.forEach(function (p) { posMap.set(p.key, p); });
    var manualKeys = new Set();
    var stacks = [];

    // Include manual stacks first
    ensureArray(manualStacks).forEach(function (ms) {
      if (!ms || !ms.id || !ms.cardKeys || !ms.cardKeys.length) { return; }
      var titles = {};
      ms.cardKeys.forEach(function (key) {
        manualKeys.add(key);
        var card = byKey.get(key);
        if (card) { titles[key] = card.title || key; }
      });
      var firstPos = posMap.get(ms.cardKeys[0]) || {x: 0, y: 0};
      stacks.push({
        id: ms.id,
        label: ms.label || 'Stack',
        cardKeys: ms.cardKeys.slice(),
        titles: titles,
        position: {x: firstPos.x, y: firstPos.y},
        manual: true
      });
    });

    // Auto-stacks for large baseplates
    baseplates.forEach(function (bp) {
      var unmanaged = bp.cardKeys.filter(function (key) { return !manualKeys.has(key); });
      if (unmanaged.length <= AUTO_STACK_THRESHOLD) { return; }
      var titles = {};
      unmanaged.forEach(function (key) {
        var card = byKey.get(key);
        if (card) { titles[key] = card.title || key; }
      });
      var firstPos = posMap.get(unmanaged[0]) || {x: 0, y: 0};
      stacks.push({
        id: 'auto:' + bp.id,
        label: bp.label || bp.id,
        cardKeys: unmanaged,
        titles: titles,
        position: {x: firstPos.x, y: firstPos.y},
        manual: false
      });
    });

    return stacks;
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  function cardKeyMap(cards) {
    var map = new Map();
    ensureArray(cards).forEach(function (card) {
      if (card && card.key) { map.set(card.key, card); }
    });
    return map;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  // ── export ──────────────────────────────────────────────────────────────

  var api = {
    computeLayout: computeLayout,
    computeLod: computeLod,
    intrinsicCardHeight: intrinsicCardHeight,
    LOD_0_MAX: LOD_0_MAX,
    LOD_1_MAX: LOD_1_MAX,
    CARD_WIDTH: CARD_WIDTH
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapSpatialCanvasLayout = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
