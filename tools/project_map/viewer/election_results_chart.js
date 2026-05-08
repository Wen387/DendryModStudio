(function initProjectMapElectionResultsChart(global) {
  'use strict';

  function render(parties, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const rows = normalizeParties(parties);
    const seatsTotal = Math.max(1, Number(opts.seatsTotal) || totalSeats(rows) || 1);
    const d3Data = toD3Data(rows);
    const d3Rendered = renderWithD3Parliament(d3Data, seatsTotal, opts);
    if (d3Rendered) {
      return d3Rendered;
    }
    const layout = buildSemiCircleLayout(rows, seatsTotal, opts);
    return [
      '<svg class="d3-parliament-preview" data-d3-parliament-chart="true" data-d3-parliament-compatible="true" data-d3-parliament-data="' + escapeAttr(JSON.stringify(d3Data)) + '" data-d3-parliament-width="' + escapeAttr(String(layout.width)) + '" data-d3-parliament-height="' + escapeAttr(String(layout.height)) + '" data-d3-parliament-inner-radius-coef="' + escapeAttr(String(layout.innerRadiusCoef)) + '" viewBox="0 0 ' + escapeAttr(String(layout.width)) + ' ' + escapeAttr(String(layout.height)) + '" role="img" aria-label="' + escapeAttr(opts.label || 'D3 parliament seat chart') + '">',
      '<g class="parliament" transform="translate(0,0)">',
      layout.seats.map((seat) => '<circle class="seat party-' + safeClass(seat.party.key || seat.party.id || seat.party.name) + '" cx="' + formatNumber(seat.x) + '" cy="' + formatNumber(seat.y) + '" r="' + formatNumber(seat.radius) + '" fill="' + escapeAttr(seat.party.color || '#999999') + '" stroke="#2f2a22" stroke-width="1.15"><title>' + escapeHtml((seat.party.name || seat.party.key || 'Party') + ' / ' + String(seat.party.seats || 0) + ' seats') + '</title></circle>').join(''),
      '</g>',
      '</svg>'
    ].join('');
  }

  function renderWithD3Parliament(d3Data, seatsTotal, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const d3 = global && global.d3;
    const doc = global && global.document;
    if (!d3 || typeof d3.parliament !== 'function' || !doc || typeof doc.createElement !== 'function') {
      return '';
    }
    try {
      const width = Math.max(320, Number(opts.width) || 680);
      const height = Math.max(170, Number(opts.height) || 330);
      const innerRadiusCoef = Math.max(0.18, Math.min(0.72, Number(opts.innerRadiusCoef) || 0.4));
      const host = doc.createElement('div');
      const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
      host.appendChild(svg);
      svg.setAttribute('class', 'd3-parliament-preview');
      svg.setAttribute('data-d3-parliament-chart', 'true');
      svg.setAttribute('data-d3-parliament-compatible', 'true');
      svg.setAttribute('data-d3-parliament-direct', 'true');
      svg.setAttribute('data-d3-parliament-data', JSON.stringify(d3Data));
      svg.setAttribute('data-d3-parliament-width', String(width));
      svg.setAttribute('data-d3-parliament-height', String(height));
      svg.setAttribute('data-d3-parliament-inner-radius-coef', String(innerRadiusCoef));
      svg.setAttribute('viewBox', '0 0 ' + String(width) + ' ' + String(height));
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', opts.label || 'D3 parliament seat chart');

      const parliament = d3.parliament();
      if (typeof parliament.width === 'function') {
        parliament.width(width);
      }
      if (typeof parliament.height === 'function') {
        parliament.height(height);
      }
      if (typeof parliament.innerRadiusCoef === 'function') {
        parliament.innerRadiusCoef(innerRadiusCoef);
      }
      d3.select(svg).datum(d3Data).call(parliament);
      svg.setAttribute('data-d3-parliament-seat-total', String(seatsTotal));
      return host.innerHTML;
    } catch (_err) {
      return '';
    }
  }

  function toD3Data(parties) {
    return normalizeParties(parties).filter((party) => party.seats > 0).map((party) => ({
      id: party.key || safeClass(party.name),
      legend: party.legend || party.name || party.key || '',
      name: party.name || party.legend || party.key || '',
      seats: party.seats,
      color: party.color
    }));
  }

  function buildSemiCircleLayout(parties, seatsTotal, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const width = Math.max(320, Number(opts.width) || 680);
    const height = Math.max(170, Number(opts.height) || 330);
    const innerRadiusCoef = Math.max(0.18, Math.min(0.72, Number(opts.innerRadiusCoef) || 0.4));
    const centerX = width / 2;
    const centerY = height - 18;
    const outerRadius = Math.min(width / 2 - 24, height - 34);
    const innerRadius = Math.max(34, outerRadius * innerRadiusCoef);
    const seatRadius = Math.max(3.2, Math.min(8.5, Number(opts.seatRadius) || seatRadiusFor(seatsTotal)));
    const rowCount = Math.max(3, Math.min(18, Number(opts.rowCount) || Math.round(Math.sqrt(seatsTotal) * 0.55)));
    const rowCounts = distributeRowCounts(seatsTotal, rowCount, innerRadius, outerRadius, seatRadius);
    const sequence = seatSequence(parties, seatsTotal);
    const seats = [];
    let seatIndex = 0;
    rowCounts.forEach((count, rowIndex) => {
      const radius = rowCount <= 1
        ? (innerRadius + outerRadius) / 2
        : outerRadius - (outerRadius - innerRadius) * (rowIndex / (rowCount - 1));
      const angleStep = Math.PI / Math.max(1, count - 1);
      for (let index = 0; index < count && seatIndex < sequence.length; index += 1) {
        const angle = Math.PI - index * angleStep;
        const party = sequence[seatIndex] || sequence[sequence.length - 1] || {name: '', color: '#d8d3c4'};
        seats.push({
          index: seatIndex,
          rowIndex,
          party,
          radius: seatRadius,
          x: centerX + radius * Math.cos(angle),
          y: centerY - radius * Math.sin(angle)
        });
        seatIndex += 1;
      }
    });
    return {width, height, innerRadiusCoef, seats};
  }

  function distributeRowCounts(totalSeats, rowCount, innerRadius, outerRadius, seatRadius) {
    const weights = [];
    for (let index = 0; index < rowCount; index += 1) {
      const radius = rowCount <= 1
        ? (innerRadius + outerRadius) / 2
        : outerRadius - (outerRadius - innerRadius) * (index / (rowCount - 1));
      weights.push(Math.max(1, Math.PI * radius / Math.max(1, seatRadius * 2.35)));
    }
    const weightTotal = weights.reduce((sum, value) => sum + value, 0) || rowCount;
    const raw = weights.map((weight) => {
      const exact = totalSeats * weight / weightTotal;
      return {count: Math.max(1, Math.floor(exact)), remainder: exact - Math.floor(exact)};
    });
    let assigned = raw.reduce((sum, row) => sum + row.count, 0);
    while (assigned > totalSeats && raw.some((row) => row.count > 1)) {
      const index = raw.reduce((best, row, current) => row.count > 1 && row.remainder < raw[best].remainder ? current : best, 0);
      raw[index].count -= 1;
      assigned -= 1;
    }
    while (assigned < totalSeats) {
      const index = raw.reduce((best, row, current) => row.remainder > raw[best].remainder ? current : best, 0);
      raw[index].count += 1;
      raw[index].remainder = 0;
      assigned += 1;
    }
    return raw.map((row) => row.count);
  }

  function seatSequence(parties, seatsTotal) {
    const rows = normalizeParties(parties);
    const weighted = rows.length ? rows : [{key: 'empty', name: 'Empty', color: '#d8d3c4', seats: seatsTotal}];
    const weightTotal = totalSeats(weighted) || weighted.length;
    const raw = weighted.map((party) => {
      const exact = seatsTotal * (party.seats || (weightTotal === weighted.length ? 1 : 0)) / weightTotal;
      return {party, count: Math.floor(exact), remainder: exact - Math.floor(exact)};
    });
    let assigned = raw.reduce((sum, row) => sum + row.count, 0);
    while (assigned < seatsTotal && raw.length) {
      const index = raw.reduce((best, row, current) => row.remainder > raw[best].remainder ? current : best, 0);
      raw[index].count += 1;
      raw[index].remainder = 0;
      assigned += 1;
    }
    return raw.reduce((all, row) => {
      for (let index = 0; index < row.count; index += 1) {
        all.push(row.party);
      }
      return all;
    }, []);
  }

  function seatRadiusFor(totalSeats) {
    if (totalSeats > 620) {
      return 3.7;
    }
    if (totalSeats > 420) {
      return 4.4;
    }
    if (totalSeats > 240) {
      return 5.2;
    }
    return 6.2;
  }

  function normalizeParties(parties) {
    return ensureArray(parties).map((party, index) => {
      const value = party && typeof party === 'object' ? party : {};
      const seats = Math.max(0, Math.round(Number(value.seats) || Number(value.seatsShare) || Number(value.voteShare) || 0));
      return {
        key: String(value.key || value.id || safeClass(value.name || 'party_' + (index + 1))).trim(),
        id: String(value.id || value.key || '').trim(),
        legend: String(value.legend || value.name || value.key || '').trim(),
        name: String(value.name || value.legend || value.key || ('Party ' + (index + 1))).trim(),
        color: safeColor(value.color || value.colour || value.fill || '#999999'),
        seats
      };
    }).filter((party) => party.name);
  }

  function totalSeats(parties) {
    return normalizeParties(parties).reduce((total, party) => total + (Number(party.seats) || 0), 0);
  }

  function safeColor(value) {
    const text = String(value || '').trim();
    return /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(text) ? text : '#999999';
  }

  function formatNumber(value) {
    return String(Math.round(Number(value || 0) * 100) / 100);
  }

  function safeClass(value) {
    return String(value || 'party').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'party';
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#96;');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  const api = {render, toD3Data, buildSemiCircleLayout, renderWithD3Parliament};
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.ProjectMapElectionResultsChart = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
