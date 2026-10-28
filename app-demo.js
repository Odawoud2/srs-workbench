/* SRS Workbench demonstration screens (version 1.5): the dashboard, one screen per component of the framework (rating, appraisal,
   the levels, effective smartness) and the balance plane. Chart-first and read-only: every figure is computed live by the calculator
   from the same state the work screens edit, so a change made on a data-entry screen shows here at once. */
(function (global) {
  'use strict';
  var A = global.APP, SRS = A.SRS, DATA = A.DATA, DIMS = A.DIMS, DIM_NAME = A.DIM_NAME, SUB = A.SUB, IND = A.IND;
  var esc = A.esc, f3 = A.f3, f2 = A.f2, fd = A.fd, pc = A.pc, fv = A.fv, money = A.money;
  function S() { return A.state(); }
  function U() { return S().ui; }
  function T() { return A.territory(); }
  function res(id) { return T().results[id]; }
  function unitName(id) { var u = A.unitById(id); return u ? u.name : id; }
  function ensureUnit() { if (!A.unitById(U().unit)) U().unit = T().tree.roots[0]; if (!A.unitById(U().appraisalUnit)) U().appraisalUnit = U().unit; }
  function s4(x) { return x === null || x === undefined || isNaN(x) ? '–' : (x < 0 ? '−' : '+') + Math.abs(x).toFixed(4); }
  function s3(x) { return x === null || x === undefined || isNaN(x) ? '–' : (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3); }
  function isOutcome(d) { return SRS.defaults().outcome_dims.indexOf(d) >= 0; }
  var DIMC = { S: 'var(--dim-S)', R: 'var(--dim-R)', M: 'var(--dim-M)' };
  var COST = 'var(--dim-R)', VALUE = 'var(--accent)', INK = 'var(--fg)', DIG = 'var(--dim-M)', PHY = 'var(--dim-S)';

  // ---------- the approved plan ----------
  function approvedIds() {
    var c = A.chain();
    if (c.chain && c.chain.portfolio && c.chain.portfolio.projects && c.chain.portfolio.projects.length) return c.chain.portfolio.projects.slice();
    return S().options.filter(function (o) { return o.status === 'approved' || o.status === 'in delivery'; }).map(function (o) { return o.id; });
  }
  function planAt(year) {
    var ids = approvedIds(); if (!ids.length) return null;
    try { return A.appraise(ids, { readiness: S().readiness, year: year }); } catch (e) { return null; }
  }
  function horizon() { return S().portfolio.horizon || (S().money.base_year + 5); }
  function snap(r) {
    if (!r || !r.balance) return null;
    return { S: r.dims.S.score, R: r.dims.R.score, M: r.dims.M.score, B: r.balance.B, D: r.balance.D, level: r.balance.performance_level.level, levelName: r.balance.performance_level.name, stage: r.balance.stage, gap: r.balance.gap, cap: A.capOf(r.balance) };
  }
  /* The three positions of a unit: now, by the portfolio's horizon, at full effect; null plan entries where nothing reaches it. */
  function positions(uid) {
    var now = snap(res(uid)), p31 = planAt(horizon()), pf = planAt(null);
    var y = p31 && p31.results[uid] ? snap(p31.results[uid].post) : null, f = pf && pf.results[uid] ? snap(pf.results[uid].post) : null;
    var moves = !!(f && now && (Math.abs(f.S - now.S) > 1e-9 || Math.abs(f.R - now.R) > 1e-9 || Math.abs(f.M - now.M) > 1e-9));
    var recs = moves && pf.results[uid].options ? pf.results[uid].options.slice() : [];
    return { now: now, y: moves ? y : null, full: moves ? f : null, moves: moves, records: recs };
  }

  // ---------- page furniture ----------
  var STEPS = [['rating', '1', 'Rate the territory'], ['appraisal', '2', 'Appraise investments'], ['levels', '3', 'Deliver at every level'], ['smart', '4', 'Effective smartness'], ['plane', '5', 'Balance plane']];
  function stepStrip(cur) {
    return '<nav class="steps" aria-label="The framework in five screens"><a href="#home" class="' + (cur === 'home' ? 'active' : '') + '"><span class="n">⌂</span>Dashboard</a>' + STEPS.map(function (s) { return '<a href="#' + s[0] + '" class="' + (s[0] === cur ? 'active' : '') + '"><span class="n">' + s[1] + '</span>' + s[2] + '</a>'; }).join('') + '</nav>';
  }
  function demoHead(cur, kicker, title, lede, controls) {
    var syn = S().territory.synthetic ? '<span class="badge warn" title="Westhaven Region is a synthetic territory; its values describe no real place. The results show the method, not a judgement of any territory.">demonstration data</span>' : '';
    return stepStrip(cur) + '<div class="page-head"><div class="title"><span class="role">' + esc(kicker) + ' ' + syn + '</span><h1>' + title + '</h1><p class="lede">' + lede + '</p></div><div class="controls">' + (controls || '') + '</div></div>';
  }
  function unitControl() { return '<label class="control"><span>Unit</span>' + A.unitSelect('sel-demo-unit', U().unit) + '</label>'; }
  function mountUnit(root) { var sel = root.querySelector('#sel-demo-unit'); if (sel) sel.addEventListener('change', function () { U().unit = sel.value; U().appraisalUnit = sel.value; A.rerender(); }); }
  function kpi(label, value, badge, note, cls) {
    return '<div class="tile kpi' + (cls ? ' ' + cls : '') + '"><span class="label">' + label + '</span><span class="v">' + value + '</span>' + (badge ? '<span>' + badge + '</span>' : '') + (note ? '<span class="d">' + note + '</span>' : '') + '</div>';
  }
  function sources(items) {
    return '<p class="small muted sources">Where this is edited: ' + items.map(function (x) { return '<a href="#' + x[0] + '">' + esc(x[1]) + '</a>'; }).join(' · ') + '.</p>';
  }
  function explain(cards) {
    return '<div class="explain">' + cards.map(function (c) { return '<div class="card"><b>' + c[0] + '</b><p class="small muted">' + c[1] + '</p></div>'; }).join('') + '</div>';
  }

  // ---------- chart helpers (SVG, theme-aware) ----------
  /* Horizontal bars, one per row, to a 0..max scale; rows [{label, value, ghost, color, tip, sub}]. */
  function hbars(rows, opts) {
    opts = opts || {};
    var W = opts.width || 640, rowH = opts.rowH || 22, gap = 6, labelW = opts.labelW || 150, m = { t: 6, r: 64, b: 22 };
    var max = opts.max || 1;
    var H = m.t + rows.length * (rowH + gap) + m.b, iw = W - labelW - m.r;
    var fmt = opts.fmt || function (v) { return v.toFixed(3); };
    var ticks = opts.ticks || [0, 0.2, 0.4, 0.6, 0.8, 1].map(function (v) { return v * max; });
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || 'Bar chart') + '">';
    s += '<g class="grid">' + ticks.map(function (v) { var xx = labelW + v / max * iw; return '<line x1="' + xx + '" x2="' + xx + '" y1="' + m.t + '" y2="' + (H - m.b) + '"/><text x="' + xx + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(opts.tickFmt ? opts.tickFmt(v) : fmt(v)) + '</text>'; }).join('') + '</g>';
    var yy = m.t;
    rows.forEach(function (r) {
      var v = r.value === null || r.value === undefined ? null : Math.max(0, Math.min(max, r.value));
      s += '<text x="' + (labelW - 10) + '" y="' + (yy + rowH * 0.5 + 4) + '" text-anchor="end" class="lbl">' + esc(r.label) + '</text>';
      if (r.sub) s += '<text x="' + (labelW - 10) + '" y="' + (yy + rowH * 0.5 + 15) + '" text-anchor="end" class="lblsub" style="font-size:9.5px">' + esc(r.sub) + '</text>';
      if (r.ghost !== null && r.ghost !== undefined) { var gw = Math.max(0, Math.min(max, r.ghost)) / max * iw; s += '<rect x="' + labelW + '" y="' + (yy + 3) + '" width="' + gw.toFixed(1) + '" height="' + (rowH - 6) + '" rx="3" fill="' + (r.color || INK) + '" opacity="0.25" data-tip="' + esc(r.ghostTip || ('after the plan: ' + fmt(r.ghost))) + '"/>'; }
      if (v !== null) { var w = v / max * iw; s += '<rect x="' + labelW + '" y="' + yy + '" width="' + w.toFixed(1) + '" height="' + rowH + '" rx="3" fill="' + (r.color || INK) + '" data-tip="' + esc(r.tip || (r.label + ': ' + fmt(r.value))) + '"/>'; }
      s += '<text x="' + (labelW + (v === null ? 0 : v / max * iw) + 6) + '" y="' + (yy + rowH * 0.5 + 4) + '" class="num">' + (v === null ? 'not rated' : esc(fmt(r.value))) + (r.ghost !== null && r.ghost !== undefined ? '<tspan class="lblsub"> → ' + esc(fmt(r.ghost)) + '</tspan>' : '') + '</text>';
      yy += rowH + gap;
    });
    return s + '</svg>';
  }
  /* Signed horizontal bars about zero; rows [{label, bars:[{name, value, color}]}]. */
  function signedBars(rows, opts) {
    opts = opts || {};
    var W = opts.width || 640, barH = 12, gap = 2, groupGap = 12, labelW = opts.labelW || 170, m = { t: 8, r: 70, b: 22 };
    var n = rows.reduce(function (a, r) { return a + r.bars.length; }, 0);
    var H = m.t + n * (barH + gap) + rows.length * groupGap + m.b, iw = W - labelW - m.r, cx = labelW + iw / 2;
    var max = 0; rows.forEach(function (r) { r.bars.forEach(function (b) { if (b.value !== null) max = Math.max(max, Math.abs(b.value)); }); });
    max = opts.max || (max > 0 ? Math.ceil(max * 100) / 100 : 0.1);
    var fmt = opts.fmt || function (v) { return (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3); };
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || 'Signed bar chart') + '">';
    s += '<g class="grid">' + [-1, -0.5, 0, 0.5, 1].map(function (t) { var xx = cx + t * iw / 2; return '<line x1="' + xx + '" x2="' + xx + '" y1="' + m.t + '" y2="' + (H - m.b) + '"' + (t === 0 ? ' style="stroke:var(--line-2)"' : '') + '/><text x="' + xx + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(fmt(t * max)) + '</text>'; }).join('') + '</g>';
    var yy = m.t;
    rows.forEach(function (r) {
      s += '<text x="' + (labelW - 10) + '" y="' + (yy + 11) + '" text-anchor="end" class="lbl">' + esc(r.label) + '</text>';
      if (r.sub) s += '<text x="' + (labelW - 10) + '" y="' + (yy + 23) + '" text-anchor="end" class="lblsub" style="font-size:9.5px">' + esc(r.sub) + '</text>';
      r.bars.forEach(function (b) {
        var v = b.value === null ? 0 : b.value, w = Math.abs(v) / max * iw / 2, x0 = v < 0 ? cx - w : cx;
        s += '<rect x="' + x0.toFixed(1) + '" y="' + yy + '" width="' + Math.max(w, 0.5).toFixed(1) + '" height="' + barH + '" rx="2" fill="' + b.color + '" data-tip="' + esc(b.tip || (r.label + ' · ' + b.name + ': ' + (b.value === null ? 'not rated' : fmt(b.value)))) + '"/>';
        s += '<text x="' + (v < 0 ? cx + 5 : cx + w + 5) + '" y="' + (yy + 10) + '" style="font-size:10px">' + esc(b.name ? b.name + ' ' : '') + (b.value === null ? '–' : esc(fmt(b.value))) + '</text>';
        yy += barH + gap;
      });
      yy += groupGap;
    });
    return s + '</svg>';
  }
  /* Vertical grouped columns: cats [labels], series [{name, color, values[]}], with an optional reference line series drawn as a step. */
  function columns(cats, series, opts) {
    opts = opts || {};
    var W = opts.width || 640, H = opts.height || 240, m = { t: 14, r: 16, b: 46, l: 48 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var max = 0; series.forEach(function (s) { s.values.forEach(function (v) { if (v !== null) max = Math.max(max, v); }); }); if (opts.line) opts.line.values.forEach(function (v) { max = Math.max(max, v); });
    max = opts.max || niceMax(max);
    var fmt = opts.fmt || function (v) { return fv(v); };
    function y(v) { return m.t + ih - v / max * ih; }
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || 'Column chart') + '">';
    var ticks = 4, g = '';
    for (var k = 0; k <= ticks; k++) { var v = max * k / ticks; g += '<line x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (m.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(fmt(v)) + '</text>'; }
    s += '<g class="grid">' + g + '</g>';
    var gw = iw / cats.length, bw = Math.min(28, gw * 0.7 / series.length);
    cats.forEach(function (c, i) {
      var x0 = m.l + i * gw + (gw - bw * series.length) / 2;
      series.forEach(function (sr, j) {
        var v = sr.values[i]; if (v === null || v === undefined) return;
        s += '<rect x="' + (x0 + j * bw).toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + (bw - 2).toFixed(1) + '" height="' + (m.t + ih - y(v)).toFixed(1) + '" rx="2" fill="' + sr.color + '" data-tip="' + esc(sr.name + ', ' + c + ': ' + fmt(v)) + '"/>';
      });
      s += '<text x="' + (m.l + i * gw + gw / 2) + '" y="' + (H - 28) + '" text-anchor="middle">' + esc(c) + '</text>';
    });
    if (opts.line) {
      var d = ''; cats.forEach(function (c, i) { var v = opts.line.values[i]; var xa = m.l + i * gw, xb = xa + gw; d += (i ? ' L' : 'M') + xa.toFixed(1) + ' ' + y(v).toFixed(1) + ' L' + xb.toFixed(1) + ' ' + y(v).toFixed(1); });
      s += '<path d="' + d + '" fill="none" stroke="' + opts.line.color + '" stroke-width="2" stroke-dasharray="6 4"/>';
    }
    var lx = m.l; s += '<g class="legend-svg">' + series.concat(opts.line ? [opts.line] : []).map(function (sr) { var out = '<rect x="' + lx + '" y="' + (H - 14) + '" width="12" height="8" rx="2" fill="' + sr.color + '"/><text x="' + (lx + 16) + '" y="' + (H - 6) + '">' + esc(sr.name) + '</text>'; lx += 24 + sr.name.length * 6.2; return out; }).join('') + '</g>';
    return s + '</svg>';
  }
  function niceMax(v) { if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))); var n = v / p; var m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10; return m * p; }
  /* Line chart with a numeric axis and a legend beneath: years [], series [{name, color, values[], dash, area}]. */
  function mline(years, series, opts) {
    opts = opts || {};
    var W = opts.width || 640, H = opts.height || 250, m = { t: 14, r: 18, b: 52, l: 52 };
    // legend rows, wrapped to the width
    var lpos = [], lx0 = m.l, lrow = 0; series.forEach(function (sr) { var wdt = 26 + sr.name.length * 6.2; if (lx0 + wdt > W - m.r && lx0 > m.l) { lx0 = m.l; lrow++; } lpos.push([lx0, lrow]); lx0 += wdt; });
    m.b = 38 + 14 * (lrow + 1);
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var max = 0, min = 0; series.forEach(function (s) { s.values.forEach(function (v) { if (v !== null) { max = Math.max(max, v); min = Math.min(min, v); } }); });
    max = opts.max || niceMax(max); min = opts.min !== undefined ? opts.min : 0;
    var fmt = opts.fmt || function (v) { return fv(v); };
    function x(i) { return m.l + (years.length > 1 ? i / (years.length - 1) : 0.5) * iw; }
    function y(v) { return m.t + (1 - (v - min) / (max - min)) * ih; }
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || 'Line chart') + '">';
    var ticks = 4, g = '';
    for (var k = 0; k <= ticks; k++) { var v = min + (max - min) * k / ticks; g += '<line x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (m.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(fmt(v)) + '</text>'; }
    s += '<g class="grid">' + g + '</g>';
    var every = Math.max(1, Math.ceil(years.length / 10));
    s += '<g class="axis">' + years.map(function (yr, i) { return i % every ? '' : '<text x="' + x(i) + '" y="' + (H - m.b + 16) + '" text-anchor="middle">' + esc(yr) + '</text>'; }).join('') + '</g>';
    series.forEach(function (sr) {
      var pts = sr.values.map(function (v, i) { return v === null ? null : [x(i), y(v)]; }).filter(Boolean);
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      if (sr.area && pts.length) s += '<path d="' + d + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + y(min).toFixed(1) + ' L' + pts[0][0].toFixed(1) + ' ' + y(min).toFixed(1) + ' Z" fill="' + sr.color + '" opacity="0.08"/>';
      s += '<path d="' + d + '" fill="none" stroke="' + sr.color + '" stroke-width="' + (sr.bold ? 3 : 2) + '" stroke-linejoin="round" stroke-linecap="round"' + (sr.dash ? ' stroke-dasharray="5 4"' : '') + '/>';
      pts.forEach(function (p, i) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="8" fill="transparent" data-tip="' + esc(sr.name + ', ' + years[i] + ': ' + fmt(sr.values[i])) + '"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.5" fill="' + sr.color + '" stroke="var(--bg-elev)" stroke-width="1.5" pointer-events="none"/>'; });
    });
    s += '<g class="legend-svg">' + series.map(function (sr, j) { var lx = lpos[j][0], ly = H - m.b + 34 + lpos[j][1] * 14; return '<line x1="' + lx + '" x2="' + (lx + 14) + '" y1="' + (ly - 4) + '" y2="' + (ly - 4) + '" stroke="' + sr.color + '" stroke-width="2.5"' + (sr.dash ? ' stroke-dasharray="4 3"' : '') + '/><text x="' + (lx + 18) + '" y="' + ly + '">' + esc(sr.name) + '</text>'; }).join('') + '</g>';
    return s + '</svg>';
  }
  /* Horizontal grouped bars with the value at each bar's end and names in a legend: rows [{label, bars:[{name, value, color, tip}]}]. */
  function groupedH(rows, opts) {
    opts = opts || {};
    var W = opts.width || 640, barH = opts.barH || 11, gap = 2, groupGap = 10, labelW = opts.labelW || 140, m = { t: 6, r: 60, b: 22 };
    var n = rows.reduce(function (a, r) { return a + r.bars.length; }, 0);
    var H = m.t + n * (barH + gap) + rows.length * groupGap + m.b, iw = W - labelW - m.r;
    var max = opts.max || 1, fmt = opts.fmt || function (v) { return v.toFixed(3); };
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || 'Bar chart') + '">';
    s += '<g class="grid">' + [0, 0.25, 0.5, 0.75, 1].map(function (t) { var xx = labelW + t * iw; return '<line x1="' + xx + '" x2="' + xx + '" y1="' + m.t + '" y2="' + (H - m.b) + '"/><text x="' + xx + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(fmt(t * max)) + '</text>'; }).join('') + '</g>';
    var yy = m.t;
    rows.forEach(function (r) {
      var mid = yy + (r.bars.length * (barH + gap)) / 2;
      s += '<text x="' + (labelW - 10) + '" y="' + (mid + 3) + '" text-anchor="end" class="lbl">' + esc(r.label) + '</text>';
      r.bars.forEach(function (b) {
        var v = b.value === null || b.value === undefined ? null : Math.max(0, Math.min(max, b.value)), w = v === null ? 0 : v / max * iw;
        if (v !== null) s += '<rect x="' + labelW + '" y="' + yy + '" width="' + Math.max(w, 1).toFixed(1) + '" height="' + barH + '" rx="2" fill="' + b.color + '" data-tip="' + esc(b.tip || (r.label + ' · ' + b.name + ': ' + fmt(b.value))) + '"/>';
        s += '<text x="' + (labelW + w + 5) + '" y="' + (yy + barH - 2) + '" style="font-size:9.5px">' + (v === null ? '–' : esc(fmt(b.value))) + '</text>';
        yy += barH + gap;
      });
      yy += groupGap;
    });
    return s + '</svg>';
  }
  /* A large HTML bar for one money figure. */
  function mbar(label, value, max, color, text) {
    return '<div class="mbar"><div class="mbar-head"><span>' + label + '</span><b>' + text + '</b></div><div class="progress"><i style="width:' + Math.min(100, value / max * 100).toFixed(1) + '%;background:' + color + '"></i></div></div>';
  }
  function shorten(t, n) { t = String(t); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; }
  /* A stacked status bar with its legend: segments [{name, count, cls}]. */
  function statusBar(segments) {
    var total = segments.reduce(function (a, s) { return a + s.count; }, 0) || 1;
    return '<div class="statusbar">' + segments.filter(function (s) { return s.count > 0; }).map(function (s) { return '<i class="' + s.cls + '" style="width:' + (s.count / total * 100).toFixed(1) + '%" title="' + esc(s.name + ': ' + s.count) + '">' + s.count + '</i>'; }).join('') + '</div><div class="legend">' + segments.map(function (s) { return '<span><i class="swatch ' + s.cls + '"></i>' + esc(s.name) + ' ' + s.count + '</span>'; }).join('') + '</div>';
  }
  /* The balance plane: units plotted by S and R, now → horizon → full effect. */
  function planeSvg(items, opts) {
    opts = opts || {};
    var W = 640, H = opts.height || 560, ML = 52, MR = 30, MT = 30, MB = 48, PW = W - ML - MR, PH = H - MT - MB;
    var LO = 0.35, HI = 0.90;
    var all = []; items.forEach(function (it) { [it.now, it.y, it.full].forEach(function (p) { if (p) { all.push(p.S); all.push(p.R); } }); });
    if (all.length) { var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all); if (lo < LO + 0.03 || hi > HI - 0.03) { LO = Math.max(0, Math.floor((lo - 0.05) * 20) / 20); HI = Math.min(1, Math.ceil((hi + 0.05) * 20) / 20); } }
    function sx(v) { return ML + (v - LO) / (HI - LO) * PW; }
    function sy(v) { return MT + PH - (v - LO) / (HI - LO) * PH; }
    var cid = 'pl' + Math.random().toString(36).slice(2, 7);
    var s = '<svg class="chart plane" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Balance plane: sustainability against resilience, each unit now and after the approved plan">';
    s += '<defs><clipPath id="' + cid + '"><rect x="' + ML + '" y="' + MT + '" width="' + PW + '" height="' + PH + '"/></clipPath></defs>';
    function band(d, cls) { var pts = [[LO - 1, LO - 1 - d], [HI + 1, HI + 1 - d], [HI + 1, HI + 1 + d], [LO - 1, LO - 1 + d]]; return '<polygon class="' + cls + '" points="' + pts.map(function (p) { return sx(p[0]).toFixed(1) + ',' + sy(p[1]).toFixed(1); }).join(' ') + '"/>'; }
    var thr = SRS.defaults().stage_thresholds || [0.10, 0.25];
    s += '<g clip-path="url(#' + cid + ')" pointer-events="none">' + band(thr[1] || 0.25, 'band-broad') + band(thr[0] || 0.10, 'band-even') + '</g>';
    // grid and axes
    var g = '';
    for (var v = Math.ceil(LO * 10) / 10; v <= HI + 1e-9; v = Math.round((v + 0.1) * 10) / 10) { g += '<line x1="' + sx(v) + '" x2="' + sx(v) + '" y1="' + MT + '" y2="' + (MT + PH) + '"/><line x1="' + ML + '" x2="' + (ML + PW) + '" y1="' + sy(v) + '" y2="' + sy(v) + '"/><text x="' + sx(v) + '" y="' + (MT + PH + 16) + '" text-anchor="middle">' + v.toFixed(1) + '</text><text x="' + (ML - 7) + '" y="' + (sy(v) + 4) + '" text-anchor="end">' + v.toFixed(1) + '</text>'; }
    s += '<g class="grid" pointer-events="none">' + g + '</g>';
    s += '<g class="axis" pointer-events="none"><line x1="' + ML + '" x2="' + (ML + PW) + '" y1="' + (MT + PH) + '" y2="' + (MT + PH) + '"/><line x1="' + ML + '" x2="' + ML + '" y1="' + MT + '" y2="' + (MT + PH) + '"/></g>';
    s += '<text x="' + (ML + PW / 2) + '" y="' + (H - 10) + '" text-anchor="middle" class="lbl" pointer-events="none">Sustainability S</text>';
    s += '<text transform="translate(14 ' + (MT + PH / 2) + ') rotate(-90)" text-anchor="middle" class="lbl" pointer-events="none">Resilience R</text>';
    // diagonal, band edges, level curves
    s += '<g clip-path="url(#' + cid + ')" pointer-events="none" class="plane-lines"><line x1="' + sx(LO) + '" y1="' + sy(LO) + '" x2="' + sx(HI) + '" y2="' + sy(HI) + '" class="diag"/>';
    [thr[0] || 0.10, thr[1] || 0.25].forEach(function (d) { s += '<line x1="' + sx(LO) + '" y1="' + sy(LO + d) + '" x2="' + sx(HI - d) + '" y2="' + sy(HI) + '" class="edge"/><line x1="' + sx(LO + d) + '" y1="' + sy(LO) + '" x2="' + sx(HI) + '" y2="' + sy(HI - d) + '" class="edge"/>'; });
    [[0.4, '2 | 3'], [0.6, '3 | 4'], [0.8, '4 | 5']].forEach(function (c) {
      var d = ''; for (var i = 0; i <= 120; i++) { var sv = LO + (HI - LO) * i / 120, r = c[0] * c[0] / sv; d += (i ? ' L' : 'M') + sx(sv).toFixed(1) + ' ' + sy(r).toFixed(1); }
      s += '<path d="' + d + '" class="curve"/>';
      var sEdge = c[0] * c[0] / HI; var lx, ly;
      if (sEdge >= LO) { lx = sx(sEdge) + 5; ly = MT + 12; } else { lx = ML + 5; ly = sy(c[0] * c[0] / LO) - 5; }
      s += '<text x="' + lx + '" y="' + ly + '" class="curve-lab">B ' + c[0].toFixed(2) + ' · Level ' + c[1] + '</text>';
    });
    s += '</g>';
    s += '<text x="' + (sx(HI) - 4) + '" y="' + (sy(HI) + 13) + '" text-anchor="end" class="curve-lab" pointer-events="none">S = R</text>';
    s += '<text x="' + (ML + PW * 0.5) + '" y="' + (MT - 9) + '" text-anchor="middle" class="curve-lab" pointer-events="none">EVEN within the inner band · BROADLY EVEN within the outer · UNEVEN beyond it</text>';
    // units: lines first, then dots, then labels
    var labels = [];
    items.forEach(function (it) {
      var col = it.color, r0 = it.kind === 'district' ? 5 : 6, p = it.now; if (!p) return;
      var tipNow = esc('<b>' + it.name + '</b><br>2025: S ' + f3(p.S) + ' · R ' + f3(p.R) + ' · B ' + f3(p.B) + '<br>Level ' + p.level + ' ' + p.levelName + ' · ' + p.stage + (it.full ? '<br>at full effect: S ' + f3(it.full.S) + ' · R ' + f3(it.full.R) + ' · B ' + f3(it.full.B) + '<br>Level ' + it.full.level + ' ' + it.full.levelName + ' · ' + it.full.stage + '<br>' + it.records.length + ' records reach this unit' : '<br>no approved record acts here'));
      if (it.full) {
        var mid = it.y || it.full;
        s += '<path d="M' + sx(p.S).toFixed(1) + ' ' + sy(p.R).toFixed(1) + ' L' + sx(mid.S).toFixed(1) + ' ' + sy(mid.R).toFixed(1) + ' L' + sx(it.full.S).toFixed(1) + ' ' + sy(it.full.R).toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="1.6" stroke-linecap="round" opacity="0.85" pointer-events="none"/>';
        if (it.y) { var dx = sx(it.full.S) - sx(p.S), dy = sy(it.full.R) - sy(p.R), len = Math.hypot(dx, dy) || 1, px = -dy / len * 4.5, py = dx / len * 4.5, tx = sx(it.y.S), ty = sy(it.y.R); s += '<line x1="' + (tx - px).toFixed(1) + '" y1="' + (ty - py).toFixed(1) + '" x2="' + (tx + px).toFixed(1) + '" y2="' + (ty + py).toFixed(1) + '" stroke="' + col + '" stroke-width="1.6" stroke-linecap="round" pointer-events="none"/>'; }
        s += '<circle cx="' + sx(it.full.S).toFixed(1) + '" cy="' + sy(it.full.R).toFixed(1) + '" r="' + (r0 + 2) + '" class="ring"/><circle cx="' + sx(it.full.S).toFixed(1) + '" cy="' + sy(it.full.R).toFixed(1) + '" r="' + (r0 - 0.5) + '" fill="var(--bg-elev)" stroke="' + col + '" stroke-width="2" data-tip="' + tipNow + '"/>';
      }
      s += '<circle cx="' + sx(p.S).toFixed(1) + '" cy="' + sy(p.R).toFixed(1) + '" r="' + (r0 + 2) + '" class="ring"/><circle cx="' + sx(p.S).toFixed(1) + '" cy="' + sy(p.R).toFixed(1) + '" r="' + r0 + '" fill="' + col + '" data-tip="' + tipNow + '"/>';
      labels.push({ x: sx(p.S), y: sy(p.R), name: it.name, sub: it.full ? null : 'no approved records', id: it.id });
    });
    // label placement: fixed offsets for the demonstration territory, nudged apart elsewhere
    var LAB = { 'WR': ['end', -9, -7], 'WH': ['end', -10, 4], 'AS': ['end', -9, -8], 'PE': ['start', 10, 4], 'WH-H': ['end', -10, 4], 'WH-R': ['start', 9, 14], 'WH-N': ['end', -9, 11], 'WH-M': ['start', 9, 12] };
    labels.sort(function (a, b) { return a.y - b.y; });
    var placed = [];
    labels.forEach(function (l) {
      var L = LAB[l.id] || ['start', 9, 4]; var lx = l.x + L[1], ly = l.y + L[2];
      if (!LAB[l.id]) placed.forEach(function (q) { if (Math.abs(q.x - lx) < 90 && Math.abs(q.y - ly) < 14) ly = q.y + 14; });
      placed.push({ x: lx, y: ly });
      s += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" text-anchor="' + L[0] + '" class="unit-lab" pointer-events="none">' + esc(l.name) + '</text>';
      if (l.sub) s += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 12).toFixed(1) + '" text-anchor="' + L[0] + '" class="unit-sub" pointer-events="none">' + esc(l.sub) + '</text>';
    });
    return s + '</svg>';
  }
  function planeItems(filter) {
    var out = [];
    A.unitsInDisplayOrder().forEach(function (e) {
      var u = e.unit; if (filter && !filter(u)) return;
      var p = positions(u.id); if (!p.now) return;
      var kind = u.level === 'region' ? 'region' : u.level === 'city' ? 'city' : 'district';
      out.push({ id: u.id, name: u.name, kind: kind, color: kind === 'region' ? 'var(--dim-R)' : kind === 'city' ? 'var(--dim-S)' : 'var(--dim-M)', now: p.now, y: p.y, full: p.full, records: p.records });
    });
    return out;
  }
  function planeLegend() {
    return '<div class="legend plane-key"><span><i class="swatch" style="background:var(--dim-R)"></i>Region</span><span><i class="swatch" style="background:var(--dim-S)"></i>City</span><span><i class="swatch" style="background:var(--dim-M)"></i>District</span><span><svg width="64" height="14" viewBox="0 0 64 14" style="vertical-align:middle"><line x1="6" y1="7" x2="58" y2="7" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="7" r="4.5" fill="currentColor"/><line x1="32" y1="3" x2="32" y2="11" stroke="currentColor" stroke-width="1.5"/><circle cx="58" cy="7" r="4.5" fill="var(--bg-elev)" stroke="currentColor" stroke-width="2"/></svg> now → ' + horizon() + ' → full effect</span></div>';
  }

  // ---------- bundles (shared by the dashboard and the appraisal screen) ----------
  function checksAnywhere(app, unitId) {
    var set = {};
    A.subtree(unitId).forEach(function (e) { var r = app.results[e.id]; if (r) r.notes.forEach(function (n) { var m = n.match(/^(IC\d+)/); if (m) set[m[1]] = true; }); });
    return Object.keys(set).sort(function (a, b) { return parseInt(a.slice(2)) - parseInt(b.slice(2)); });
  }
  function bundleSet(unitId) {
    var rows = A.allBundles().map(function (b) {
      var app; try { app = A.appraise(b.options, { readiness: S().readiness }); } catch (e) { return null; }
      var r = app.results[unitId]; if (!r || !r.contribution) return null;
      var capex = b.options.map(A.optionById).filter(Boolean).reduce(function (s, o) { return s + (o.capex_m || 0); }, 0);
      return { bundle: b, app: app, r: r, c: r.contribution, capex: capex, checks: checksAnywhere(app, unitId), cpp: r.contribution.balance ? SRS.costPerPoint(capex, r.contribution) : null };
    }).filter(Boolean);
    var ranked = SRS.rankBundles(rows.map(function (x) { return { id: x.bundle.id, contribution: x.c, row: x }; }));
    var info = {};
    ranked.ranked.forEach(function (e, i) { info[e.id] = { rank: i + 1, closes: e.closes_lag, opens: e.opens_lag, near: !!e.near_tie }; });
    ranked.set_aside.forEach(function (e) { info[e.id] = { aside: e.reason }; });
    return { rows: rows, ranked: ranked, info: info, first: ranked.ranked.length ? ranked.ranked[0].row : null };
  }

  // =====================================================================
  // DASHBOARD
  // =====================================================================
  A.registerScreen('home', {
    render: function () {
      ensureUnit();
      var st = S(), uid = U().unit, r = res(uid), t = T();
      var html = demoHead('home', 'SRS Development Framework · Workbench', 'Where ' + esc(r.name) + ' stands, and where its plan takes it',
        'One territory, rated on two outcomes with its digital capability beside them; the approved portfolio appraised by the change it makes; every level from the project record to the city\'s goals read against the same figures. Each panel opens the screen that explains it.', unitControl());
      if (!r.balance) return html + '<div class="callout warn">This unit is not rated: sustainability or resilience lacks the minimum number of rated sub-dimensions. Open <a href="#data">Register and values</a> to see which indicators are missing.</div>';
      var p = positions(uid), b = r.balance, full = p.full, cap = A.capOf(b);
      // rating band
      html += '<div class="panel rating-band"><div class="panel-head"><h2>' + esc(r.name) + '</h2><span class="small muted">' + esc(st.territory.name) + ' · reference year ' + esc(st.territory.reference_year) + ' · confidence ' + esc(r.confidence.grade) + '</span></div>' +
        '<p class="rating-line">' + A.ratingLabel(r) + '</p>' +
        '<div class="kpis" style="margin-top:12px">' +
        kpi('Balanced performance B', f3(b.B) + (full ? '<span class="arrow">→ ' + f3(full.B) + '</span>' : ''), A.levelBadge(b.B) + (full && full.level !== b.level ? ' <span class="badge accent">→ Level ' + full.level + ' ' + esc(full.levelName) + '</span>' : ''), 'sets the performance level' + (full ? '; the arrow is the approved plan at full effect' : ''), 'hero') +
        DIMS.map(function (d) { var sc = r.dims[d].score, g = full ? full[d] : null; return kpi('<span class="swatch" style="background:' + DIMC[d] + '"></span>' + DIM_NAME[d] + (isOutcome(d) ? ' · outcome' : ' · capability'), f3(sc) + (g !== null ? '<span class="arrow ' + A.deltaClass(g - sc) + '">' + fd(g - sc) + '</span>' : ''), A.levelBadge(sc), A.track(sc, { ghost: g })); }).join('') +
        kpi('Balance of the outcomes', esc(b.stage), A.stageBadge(b.stage) + ' ' + A.lagBadges(b), 'gap |S − R| ' + f2(b.gap) + (full ? ' → ' + f2(full.gap) + ' at full effect' : '')) +
        '</div></div>';
      // plane + plan at a glance
      var items = planeItems();
      html += '<div class="section grid two-one"><div class="panel"><div class="panel-head"><h3>The balance plane</h3><a class="small" href="#plane">Open the full plane</a></div><div class="chart-wrap plane-wrap">' + planeSvg(items, { height: 520 }) + '</div>' + planeLegend() + '<p class="small muted">Each unit sits at its sustainability and resilience scores. The filled dot is today; the thin line runs through ' + horizon() + ' to full effect of the approved portfolio. The curves are the level edges and the diagonal bands the balance stages, so a dot\'s position reads as its rating.</p></div>' +
        '<div class="stack">' + planCards(uid) + '</div></div>';
      // units compared
      var rows = A.unitsInDisplayOrder().map(function (e) { var rr = res(e.unit.id), pp = positions(e.unit.id); return { label: e.unit.name, sub: e.unit.level, value: rr.balance ? rr.balance.B : null, ghost: pp.full ? pp.full.B : null, color: e.unit.level === 'region' ? DIMC.R : e.unit.level === 'city' ? DIMC.S : DIMC.M, tip: e.unit.name + ': B ' + f3(rr.balance ? rr.balance.B : null) + (pp.full ? ' → ' + f3(pp.full.B) + ' at full effect' : '') }; });
      html += '<div class="section grid c2"><div class="panel"><div class="panel-head"><h3>How the units compare</h3><a class="small" href="#rating">Rating screen</a></div><div class="chart-wrap">' + hbars(rows, { label: 'Balanced performance by unit', rowH: 20, width: 470, labelW: 120 }) + '</div><p class="small muted">Balanced performance B today (solid) and after the plan (faint). A parent is reported as the distribution of its children, never as their average.</p></div>' +
        '<div class="panel"><div class="panel-head"><h3>The framework in five screens</h3></div><div class="cards roles">' + STEPS.map(function (s) { var what = { rating: 'Two outcomes, a capability beside them, one rating label; where the score comes from and what holds the unit back.', appraisal: 'Four candidate bundles appraised on the same scale, the checks that fire, the ranking rule and the path to full effect.', levels: 'The city\'s goals, the portfolio\'s commitments, the programmes and the project records, with investment against value at every level.', smart: 'Whether the digital capability the city holds and plans serves its two outcomes: alignment, the digital layer\'s yield and the catalytic ratio.', plane: 'Every unit on one plane, today and after the plan, with the levels and stages drawn as the rules define them.' }[s[0]]; return '<a class="role-card" href="#' + s[0] + '"><h3><span class="n">' + s[1] + '</span> ' + s[2] + '</h3><p class="what">' + what + '</p></a>'; }).join('') + '</div></div></div>';
      html += '<div class="section"><p class="small muted">Data entry and the role screens are under <b>Work screens</b> in the menu: the register and values, the configuration, the project records, the programmes, the portfolio, the city\'s goals and values, and the operating register. Every figure above is recomputed from them.</p></div>';
      return html;
    },
    mount: function (root) { mountUnit(root); }
  });
  /* The plan at a glance: four cards for the right-hand column of the dashboard. */
  function planCards(uid) {
    var st = S(), ch = A.chain(), out = '';
    var ids = approvedIds();
    var env = st.envelope.by_year, envTotal = Object.keys(env).reduce(function (a, k) { return a + (env[k] || 0); }, 0);
    var capex = ids.map(A.optionById).filter(Boolean).reduce(function (a, o) { return a + (o.capex_m || 0); }, 0);
    out += '<div class="panel"><div class="panel-head"><h3>The approved portfolio</h3><a class="small" href="#levels">Levels screen</a></div><div class="kpis kpis-sm">' + kpi('Records', ids.length, null, (st.programmes || []).length + ' programmes · ' + esc(st.portfolio.name || '')) + kpi('Capital cost', money(capex), null, envTotal ? 'against an envelope of ' + money(envTotal) + ' to ' + horizon() : 'no envelope set') + '</div>' + (envTotal ? '<div class="progress" title="capital cost against the envelope"><i style="width:' + Math.min(100, capex / envTotal * 100).toFixed(1) + '%;background:' + COST + '"></i></div>' : '') + '</div>';
    if (ch.chain) {
      var goals = ch.chain.city.goals || [];
      var segs = [{ name: 'met by the horizon', count: goals.filter(function (g) { return /met at the horizon/.test(g.status); }).length, cls: 'fill-good' }, { name: 'met at full effect', count: goals.filter(function (g) { return /met at full effect/.test(g.status); }).length, cls: 'fill-accent' }, { name: 'short', count: goals.filter(function (g) { return /short/.test(g.status); }).length, cls: 'fill-warn' }, { name: 'not served', count: goals.filter(function (g) { return !g.served || !g.adopted; }).length, cls: 'fill-grey' }];
      out += '<div class="panel"><div class="panel-head"><h3>The city\'s goals</h3><a class="small" href="#levels">Goals and commitments</a></div>' + statusBar(segs) + '<p class="small muted" style="margin-top:6px">' + goals.length + ' goals in the city\'s own words, each adopted by the portfolio with a commitment and read by ' + horizon() + ' and at full effect.</p></div>';
      var c = ch.chain.city.comparison;
      var mmax = Math.max(c.pv_cost, c.pv_value.high);
      out += '<div class="panel"><div class="panel-head"><h3>Investment against value</h3><a class="small" href="#levels">Money view</a></div>' + mbar('Present value of cost', c.pv_cost, mmax, COST, money(c.pv_cost)) + mbar('Present value of the outcomes valued', c.pv_value.central, mmax, VALUE, money(c.pv_value.central)) + '<p class="small muted">range ' + money(c.pv_value.low) + ' to ' + money(c.pv_value.high) + '; ' + (c.ratio ? f2(c.ratio.central) + ' of value per unit of cost (range ' + f2(c.ratio.low) + ' to ' + f2(c.ratio.high) + ')' : '') + '; ' + (c.unvalued_lines ? c.unvalued_lines.length : 0) + ' lines not yet valued. Reported beside the score; it never ranks.</p></div>';
    }
    var sm = A.smart();
    if (sm.smart && sm.smart.units[uid]) {
      var e = sm.smart.units[uid], al = e.alignment, pl = e.planned, k = pl ? pl.attribution.B.kappa : null;
      out += '<div class="panel"><div class="panel-head"><h3>Effective smartness</h3><a class="small" href="#smart">Three readings</a></div><div class="kpis kpis-sm">' + kpi('Alignment', f2(al.alignment) + (e.alignment_after ? '<span class="arrow">→ ' + f2(e.alignment_after.alignment) + '</span>' : ''), null, 'share of the outcome shortfall the capability is pointed at') + kpi('Digital layer', s3(e.in_operation.attribution.B.digital), null, 'of B carried by the systems in operation') + (pl ? kpi('In the plan', s3(pl.attribution.B.digital), kapBadge(k), 'of the portfolio\'s ' + s3(pl.attribution.B.total) + ' in B') : '') + '</div></div>';
    }
    return out;
  }
  function kapBadge(x) { if (x === null || x === undefined) return '<span class="badge">κ undefined</span>'; return '<span class="badge ' + (x > 1.02 ? 'good' : x < 0.98 ? 'warn' : 'accent') + '">κ ' + x.toFixed(2) + '</span>'; }

  // =====================================================================
  // 1. RATE THE TERRITORY
  // =====================================================================
  A.registerScreen('rating', {
    render: function () {
      ensureUnit();
      var uid = U().unit, r = res(uid), t = T();
      var html = demoHead('rating', 'Tier 1 · the rating', 'Rate the territory: two outcomes, a capability beside them, one label',
        'Seventy standard indicators are scored between a floor and a target and aggregated to ten sub-dimensions and three dimensions. Sustainability and resilience are the outcomes the rating is built on; smartness is the digital capability that serves them, reported beside the rating and flagged when it trails.', unitControl());
      if (!r.balance) return html + '<div class="callout warn">This unit is not rated: sustainability or resilience lacks the minimum number of rated sub-dimensions.</div>';
      var b = r.balance, cap = A.capOf(b);
      html += '<div class="panel"><p class="rating-line">' + A.ratingLabel(r) + '</p><div class="row" style="margin-top:8px">' + A.lagBadges(b) + ' ' + A.confBadge(r.confidence) + '</div>' +
        '<div class="kpis" style="margin-top:12px">' + kpi('Balanced performance B', f3(b.B), A.levelBadge(b.B), 'the ' + (S().cfg.aversion_p ? 'power mean, p = ' + S().cfg.aversion_p : 'geometric mean') + ' of S and R; sets the level', 'hero') +
        DIMS.map(function (d) { var sc = r.dims[d].score; return kpi('<span class="swatch" style="background:' + DIMC[d] + '"></span>' + DIM_NAME[d] + (isOutcome(d) ? ' · outcome' : ' · capability'), f3(sc), A.levelBadge(sc), A.track(sc)); }).join('') +
        kpi('Balance stage', esc(b.stage), A.stageBadge(b.stage), 'gap |S − R| = ' + f2(b.gap) + '; D = ' + f3(b.D)) + '</div></div>';
      html += explain([['Level from B', 'Five levels on B: 1 Critical below 0.20, 2 Weak to 0.40, 3 Developing to 0.60, 4 Established to 0.80, 5 Leading above.'], ['Stage from the gap', 'Even within 0.10, broadly even within 0.25, uneven beyond; the stage names the lagging outcome.'], ['Outcome lag', 'An outcome more than the lag gap below the other is flagged; the obstacle list says where to act first.'], ['Capability beside', 'Smartness is scored by the same bands and reported as digital capability, trailing or keeping pace with the outcomes.']]);
      // sub-dimension bars
      var subRows = [];
      DIMS.forEach(function (d) { DATA.subdims.filter(function (s) { return s.dim === d && (s.code !== 'IF' || S().cfg.enable_optional); }).forEach(function (s) { var x = r.subs[s.code]; subRows.push({ label: s.code + ' ' + shorten(s.name, 30), value: x && x.rated ? x.score : null, color: DIMC[d], tip: s.name + ': ' + f3(x && x.rated ? x.score : null) + (x ? ' (' + x.n_present + ' of ' + x.n_total + ' indicators present)' : '') }); }); });
      // obstacles of the weaker outcome and of capability
      var weaker = r.dims.S.score <= r.dims.R.score ? 'S' : 'R';
      function obs(d, n) { return ((r.obstacles && r.obstacles[d]) || []).slice(0, n).map(function (o) { var i = IND[o[0]], ir = r.indicators[o[0]]; return { label: o[0] + ' ' + shorten(i.name, 30), value: o[1], color: DIMC[d], tip: i.name + ': ' + pc(o[1], 1) + ' of the ' + DIM_NAME[d] + ' gap; value ' + fv(ir.value) + ' ' + i.unit + ', score ' + f3(ir.score) }; }); }
      var obsRows = obs(weaker, 5).concat(cap && cap.trails ? obs('M', 3) : []);
      var obsMax = obsRows.reduce(function (a, x) { return Math.max(a, x.value); }, 0.05);
      html += '<div class="section grid c2"><div class="panel"><div class="panel-head"><h3>Where the score comes from</h3><span class="small muted">ten sub-dimensions</span></div><div class="chart-wrap">' + hbars(subRows, { label: 'Sub-dimension scores', rowH: 18, labelW: 215, width: 500 }) + '</div></div>' +
        '<div class="panel"><div class="panel-head"><h3>What holds ' + esc(r.name) + ' back</h3><span class="small muted">share of the gap in ' + DIM_NAME[weaker] + (cap && cap.trails ? ' and in capability' : '') + '</span></div><div class="chart-wrap">' + hbars(obsRows, { label: 'Obstacle degrees', rowH: 18, labelW: 215, width: 500, max: niceMax(obsMax), fmt: function (v) { return pc(v, 1); } }) + '</div><p class="small muted">Each indicator\'s share of the shortfall is its weight multiplied by its distance from the target. These are the indicators the authority acts on first and the option library is searched for.</p></div></div>';
      // hierarchy
      var kids = t.tree.children[uid] || [];
      if (kids.length) {
        var hr = kids.map(function (k) { var rr = res(k); return { label: rr.name, bars: DIMS.map(function (d) { return { name: d, value: rr.dims[d].score, color: DIMC[d] }; }) }; });
        html += '<div class="section panel"><div class="panel-head"><h3>The units beneath ' + esc(r.name) + '</h3><span class="small muted">' + kids.map(function (k) { var rr = res(k); return esc(rr.name) + ' ' + (rr.balance ? A.stageBadge(rr.balance.stage) : ''); }).join(' ') + '</span></div><div class="chart-wrap">' + A.groupedBars(hr, { label: 'Children compared' }) + '</div><p class="small muted">A parent carries its own rating and, beside it, the range across its children and their stages, so that a region\'s rating is never mistaken for an average that hides a struggling city.</p></div>';
      }
      html += sources([['data', 'Register and values'], ['lead', 'Configuration'], ['dimension', 'Dimension detail'], ['sponsor', 'Sponsor brief']]);
      return html;
    },
    mount: function (root) { mountUnit(root); }
  });

  // =====================================================================
  // 2. APPRAISE INVESTMENTS
  // =====================================================================
  A.registerScreen('appraisal', {
    render: function () {
      ensureUnit();
      var uid = U().unit, r = res(uid);
      var html = demoHead('appraisal', 'Tier 2 · the appraisal', 'Appraise investments by the change they make to the rating',
        'Each project record carries an effect sheet, the change it claims on each indicator at each unit. A bundle is applied to the measured values, the thirteen interaction checks run, digital gains are scaled by governance readiness, and the unit is re-scored. The ranking rule reads the two outcomes and nothing else.', unitControl() + '<div class="control"><span>Readiness</span><span class="badge accent">' + esc(S().readiness) + '</span></div>');
      if (!r.balance) return html + '<div class="callout warn">This unit is not rated, so nothing can be appraised against it.</div>';
      var bs = bundleSet(uid);
      if (!bs.rows.length) return html + '<div class="callout warn">No bundle can be appraised: every saved bundle holds an inadmissible record. Open <a href="#appraiser">Project records</a>.</div>';
      var order = bs.ranked.ranked.concat(bs.ranked.set_aside).map(function (e) { return e.row; });
      html += '<div class="bundles">' + order.map(function (x) {
        var inf = bs.info[x.bundle.id], c = x.c, b = x.bundle, first = bs.first && bs.first.bundle.id === b.id;
        var status = inf.aside ? '<span class="badge serious">set aside</span> <span class="small muted">' + esc(inf.aside) + '</span>' : '<span class="badge good">ranks ' + inf.rank + '</span>' + (inf.near ? ' <span class="badge">near tie, D decided</span>' : '');
        return '<div class="panel bundle' + (first ? ' first' : '') + (inf.aside ? ' aside' : '') + '"><div class="panel-head"><h3>' + esc(b.id) + ' ' + esc(b.name) + '</h3><span class="small muted">' + money(x.capex) + '</span></div><div>' + status + '</div>' +
          '<div class="bigb"><span class="label">B</span> ' + f3(c.balance.B_before) + ' <span class="arrow">→</span> <b>' + f3(c.balance.B_after) + '</b> ' + A.levelBadge(c.balance.B_after, false) + '</div>' +
          '<div class="deltas">' + DIMS.map(function (d) { var v = c.dims[d].change; return '<div class="delta"><span class="swatch" style="background:' + DIMC[d] + '"></span><span class="k">' + d + '</span><span class="bar"><i style="width:' + Math.min(100, Math.abs(v) / 0.12 * 50).toFixed(1) + '%;' + (v < 0 ? 'right:50%' : 'left:50%') + ';background:' + DIMC[d] + '"></i></span><span class="num ' + A.deltaClass(v) + '">' + fd(v) + '</span></div>'; }).join('') + '</div>' +
          '<div class="small muted">records ' + b.options.join(', ') + '</div><div class="row" style="margin-top:6px">' + (x.checks.length ? x.checks.map(function (k) { return '<span class="badge warn">' + k + '</span>'; }).join(' ') : '<span class="badge good">no check fires</span>') + '</div>' +
          '<div class="small muted" style="margin-top:6px">' + (x.cpp === null ? '' : money(x.cpp) + ' per point of outcome gained · ') + 'capability ' + (c.balance.capability_after.M.score === null ? '–' : f3(c.balance.capability_after.M.score) + (c.balance.capability_after.M.trails ? ', trails' : ', keeps pace')) + '</div></div>';
      }).join('') + '</div>';
      html += explain([['1 · Set aside what lowers an outcome', 'A bundle that lowers sustainability or resilience is set aside, whatever it does to the other scores.'], ['2 · Set aside the dominated', 'A bundle another one matches or beats on both outcomes is set aside; capability is reported beside and does not enter the test.'], ['3 · Close the weaker outcome\'s lag', 'Bundles that remove the lag on the weaker outcome without opening a new one come first.'], ['4 · Order by B, D settles near-ties', 'B after completion orders the rest, because it never falls when an outcome improves; within 0.005, the higher D ranks first.']]);
      // change by bundle and year profile
      var sb = order.map(function (x) { return { label: x.bundle.id + ' ' + shorten(x.bundle.name, 22), bars: DIMS.map(function (d) { return { name: d, value: x.c.dims[d].change, color: DIMC[d] }; }) }; });
      var left = '<div class="panel"><div class="panel-head"><h3>What each bundle changes</h3><span class="small muted">at ' + esc(r.name) + ', full effect</span></div><div class="chart-wrap">' + signedBars(sb, { label: 'Change in S, R and M by bundle', width: 500, labelW: 160 }) + '</div><p class="small muted">Bundle A buys capability by drawing down sustainability; D is C redesigned after the checks, and its sustainability change turns positive for 22 M more.</p></div>';
      var right = '';
      if (bs.first) {
        var yrs = [], prof = SRS.yearProfile(S().units, bs.first.bundle.options.map(A.optionById).filter(Boolean), { readiness: S().readiness, cfg: S().cfg }, uid, 8);
        prof.forEach(function (p) { yrs.push(String(p.year)); });
        var series = [{ name: 'Sustainability S', color: DIMC.S, values: prof.map(function (p) { return p.S; }) }, { name: 'Resilience R', color: DIMC.R, values: prof.map(function (p) { return p.R; }) }, { name: 'Balanced performance B', color: INK, bold: true, values: prof.map(function (p) { return p.L; }) }, { name: 'Capability M', color: DIMC.M, dash: true, values: prof.map(function (p) { return p.M; }) }];
        var allv = []; series.forEach(function (sr) { sr.values.forEach(function (v) { allv.push(v); }); }); var lo = Math.floor(Math.min.apply(null, allv) * 20) / 20, hi = Math.ceil(Math.max.apply(null, allv) * 20) / 20;
        right = '<div class="panel"><div class="panel-head"><h3>From completion to full effect</h3><span class="small muted">bundle ' + esc(bs.first.bundle.id) + ', years after completion</span></div><div class="chart-wrap">' + mline(yrs, series, { min: lo, max: hi, height: 280, width: 500, label: 'Year profile of the ranked bundle', fmt: function (v) { return v.toFixed(2); } }) + '</div><p class="small muted">Nine lag profiles give each option\'s share of full effect in years one to eight. Capability moves first, because digital options deliver within two to three years; the outcomes follow as greening and densification mature.</p></div>';
      }
      html += '<div class="section grid c2">' + left + right + '</div>';
      html += sources([['appraiser', 'Project records and effect sheets'], ['lead', 'Readiness and configuration'], ['reference', 'Indicators Library: the thirteen checks and the lag profiles']]);
      return html;
    },
    mount: function (root) { mountUnit(root); }
  });

  // =====================================================================
  // 3. DELIVER AT EVERY LEVEL
  // =====================================================================
  A.registerScreen('levels', {
    render: function () {
      ensureUnit();
      var st = S(), ch = A.chain();
      var html = demoHead('levels', 'The levels · goals, portfolio, programmes, projects', 'Deliver at every level, with investment against value beside the score',
        'The city states its goals in its own words. The portfolio adopts them as strategic goals with a commitment, funds programmes within an envelope, and each programme is a named group of project records. Every figure above a record is derived from the records beneath it, and the trace runs both ways.');
      if (ch.error || !ch.chain) return html + '<div class="callout warn">The chain could not be computed: ' + esc(ch.error ? ch.error.message : '') + '</div>';
      var C = ch.chain, city = C.city, pf = C.portfolio, hz = horizon();
      // the chain
      var nProj = (pf.projects || []).length, nProg = Object.keys(C.programmes).length, nGoals = (city.goals || []).length, nSG = (pf.strategic_goals || []).length;
      html += '<div class="panel chainbox"><div class="chain">' +
        '<a href="#city" class="lvl l-city"><b>City</b><span>' + nGoals + ' goals in the city\'s words, each with an SDG target, a horizon and an indicator; the envelope; the value library</span></a><span class="arrows">↓ adopts · ↑ serves</span>' +
        '<a href="#portfolio" class="lvl l-pf"><b>Portfolio</b><span>' + esc(pf.name) + ': ' + nSG + ' strategic goals with commitments to ' + hz + ', ' + nProg + ' programmes, ' + money(pf.investment.capex) + ' of capital</span></a><span class="arrows">↓ funds · ↑ composes</span>' +
        '<a href="#programme" class="lvl l-pg"><b>Programmes</b><span>' + Object.keys(C.programmes).map(function (k) { return esc(C.programmes[k].name); }).join(' · ') + '</span></a><span class="arrows">↓ groups · ↑ claims</span>' +
        '<a href="#project" class="lvl l-pr"><b>Project records</b><span>' + nProj + ' approved records, each with an effect sheet, a phased investment and the city goals it claims; the calculator tests each claim</span></a></div></div>';
      // goals
      var goals = city.goals || [], sgBy = {}; (pf.strategic_goals || []).forEach(function (g) { sgBy[g.city_goal] = g; });
      html += '<div class="section"><div class="panel-head"><h2>The city\'s goals against the portfolio\'s commitments</h2><span class="small muted">share of each goal\'s remaining distance closed by ' + hz + ' and at full effect</span></div><div class="goals">' + goals.map(function (g) {
        var sg = sgBy[g.id], cm = sg ? sg.commitment : null, cls = /met/.test(g.status) ? 'good' : /short/.test(g.status) ? 'warn' : 'serious';
        return '<div class="panel goal"><div class="goal-head"><b>' + esc(g.id) + '</b> <span class="badge ' + cls + '">' + esc(g.status) + '</span>' + (g.late ? ' <span class="badge warn">late</span>' : '') + '</div><p>' + esc(g.statement) + '</p>' +
          '<div class="progress"><i style="width:' + Math.min(100, (g.share_full || 0) * 100).toFixed(1) + '%;background:' + VALUE + ';opacity:0.35" title="at full effect"></i><i style="width:' + Math.min(100, (g.share_horizon || 0) * 100).toFixed(1) + '%;background:' + VALUE + '" title="by the horizon"></i>' + (cm !== null ? '<b class="mark" style="left:' + Math.min(100, cm * 100).toFixed(1) + '%" title="commitment"></b>' : '') + '</div>' +
          '<div class="small muted">by ' + hz + ' ' + pc(g.share_horizon) + ' · at full effect ' + pc(g.share_full) + (cm !== null ? ' · commitment ' + pc(cm) : '') + ' · full effect in ' + esc(g.full_effect_year || '–') + '</div><div class="small muted">' + (g.sdgs || []).map(function (s) { return 'SDG ' + s.target; }).join(', ') + ' · served by ' + (g.projects || []).join(', ') + '</div></div>';
      }).join('') + '</div></div>';
      // investment against value by programme + envelope
      var progs = Object.keys(C.programmes).map(function (k) { return C.programmes[k]; });
      var ivRows = []; progs.forEach(function (p) { ivRows.push({ label: p.name, bars: [{ name: 'PV cost', value: p.comparison.pv_cost, color: COST }, { name: 'PV value', value: p.comparison.pv_value.central, color: VALUE, tip: p.name + ': PV value ' + money(p.comparison.pv_value.central) + ' (range ' + money(p.comparison.pv_value.low) + ' to ' + money(p.comparison.pv_value.high) + ')' }] }); });
      ivRows.push({ label: 'Portfolio, composed', bars: [{ name: 'PV cost', value: pf.comparison.pv_cost, color: COST }, { name: 'PV value', value: pf.comparison.pv_value.central, color: VALUE, tip: 'Portfolio: PV value ' + money(pf.comparison.pv_value.central) + ' (range ' + money(pf.comparison.pv_value.low) + ' to ' + money(pf.comparison.pv_value.high) + ')' }] });
      var ivMax = niceMax(Math.max(pf.comparison.pv_cost, pf.comparison.pv_value.central));
      html += '<div class="section grid c2"><div class="panel"><div class="panel-head"><h3>Investment against value</h3><span class="small muted">present values, ' + esc(st.money.horizon_years) + ' years at ' + pc(st.money.discount_rate) + '</span></div><div class="chart-wrap">' + groupedH(ivRows.map(function (r) { return { label: shorten(r.label, 22), bars: r.bars.map(function (b) { return { name: b.name, value: b.value, color: b.color, tip: b.tip || (r.label + ': ' + b.name + ' ' + money(b.value)) }; }) }; }), { label: 'Investment against value by programme', max: ivMax, fmt: function (v) { return money(v); }, width: 500, labelW: 150, barH: 12 }) + '</div><div class="legend"><span><i class="swatch" style="background:' + COST + '"></i>present value of cost</span><span><i class="swatch" style="background:' + VALUE + '"></i>present value of the outcomes valued, central</span></div><p class="small muted">' + f2(pf.comparison.ratio.central) + ' of value per unit of cost for the portfolio; the composed value is ' + money(pf.comparison.pv_value.central) + ' against the sum of the programmes\' ' + money(pf.sum_of_programmes_pv && pf.sum_of_programmes_pv.central !== undefined ? pf.sum_of_programmes_pv.central : pf.sum_of_programmes_pv) + '. Values are the city\'s own and ' + (st.territory.synthetic ? 'illustrative here' : 'carry their basis and grade') + '; the view never ranks.</p></div>';
      var years = Object.keys(city.envelope.by_year).map(function (k) { return parseInt(k, 10); }).sort(function (a, b) { return a - b; });
      html += '<div class="panel"><div class="panel-head"><h3>Capital phasing against the envelope</h3><span class="small muted">' + esc(st.envelope.currency || '') + ' millions by year</span></div><div class="chart-wrap">' + columns(years.map(String), [{ name: 'committed', color: COST, values: years.map(function (y) { return city.envelope.by_year[y].committed; }) }], { line: { name: 'envelope', color: INK, values: years.map(function (y) { return city.envelope.by_year[y].envelope; }) }, label: 'Committed capital against the envelope', width: 500 }) + '</div><p class="small muted">' + (function () { var over = years.filter(function (y) { return city.envelope.by_year[y].headroom < -1e-9; }); return over.length ? 'The envelope is exceeded in ' + over.map(function (y) { return y + ' by ' + money(-city.envelope.by_year[y].headroom); }).join(', ') + ', which the portfolio manager answers by re-phasing or deferring a record, not by editing a figure.' : 'The phasing stays within the envelope in every year.'; })() + '</p></div></div>';
      // cumulative cost and value
      var ys = []; for (var y = st.money.base_year; y < st.money.base_year + Math.min(15, st.money.horizon_years); y++) ys.push(y);
      var cum = 0, cumv = 0, cc = [], cv = [], c = pf.comparison;
      ys.forEach(function (y) { cum += c.cost_by_year[y] || 0; cumv += (c.value_by_year[y] ? c.value_by_year[y].central : 0); cc.push(cum); cv.push(cumv); });
      var cross = null; ys.forEach(function (y, i) { if (cross === null && cv[i] > cc[i]) cross = y; });
      html += '<div class="section panel"><div class="panel-head"><h3>Cumulative cost and value, year by year</h3><span class="small muted">undiscounted, the first fifteen years</span></div><div class="chart-wrap mid">' + mline(ys.map(String), [{ name: 'cumulative cost (capital and operating)', color: COST, values: cc }, { name: 'cumulative value, central', color: VALUE, values: cv, area: true }], { label: 'Cumulative cost and value', fmt: function (v) { return fv(v); }, width: 760, height: 280 }) + '</div><p class="small muted">Value starts when the first records complete and their ramps begin' + (cross ? '; cumulative value passes cumulative cost in ' + cross : '') + '.</p></div>';
      html += sources([['city', 'City goals, value library and envelope'], ['portfolio', 'Portfolio record and strategic goals'], ['programme', 'Programme records'], ['project', 'Project records and claims']]);
      return html;
    }
  });

  // =====================================================================
  // 4. EFFECTIVE SMARTNESS
  // =====================================================================
  A.registerScreen('smart', {
    render: function () {
      ensureUnit();
      var uid = U().unit, r = res(uid), sm = A.smart();
      var html = demoHead('smart', 'Part 10 · effective smartness', 'Does the digital capability serve the outcomes?',
        'Three readings, reported beside the score at every level and never ranking. Alignment: is the capability the city holds pointed at its outcome shortfall? Yield: what do the digital systems in operation, and the digital records planned, contribute to B? The catalytic ratio κ: does the digital layer make the physical one deliver more?', unitControl());
      if (sm.error || !sm.smart || !sm.smart.units[uid]) return html + '<div class="callout warn">The readings could not be computed' + (sm.error ? ': ' + esc(sm.error.message) : '') + '.</div>';
      var E = sm.smart, e = E.units[uid], al = e.alignment, aa = e.alignment_after, op = e.in_operation, pl = e.planned;
      html += '<div class="kpis">' + kpi('Alignment', f2(al.alignment) + (aa ? '<span class="arrow">→ ' + f2(aa.alignment) + '</span>' : ''), null, 'share of the need-weighted shortfall served by capability held' + (aa ? '; the arrow is the plan at full effect' : ''), 'hero') +
        kpi('Unserved need', f2(al.unserved), null, 'served by nothing: ' + esc(al.needs.filter(function (n) { return n.served_by === null; }).slice(0, 3).map(function (n) { return n.code; }).join(', ') || 'none')) +
        kpi('Idle capability', f2(al.idle), null, 'pointed at outcomes already at Level 4 or above: ' + esc((al.idle_capabilities || []).slice(0, 4).join(', ') || 'none')) +
        kpi('Digital layer in operation', s3(op.attribution.B.digital), null, 'of B today, carried by ' + (op.digital.length ? op.digital.join(', ') : 'no system in operation')) +
        (pl ? kpi('Digital layer in the plan', s3(pl.attribution.B.digital), kapBadge(pl.attribution.B.kappa), pc(pl.normalised.share) + ' of the ' + s3(pl.attribution.B.total) + ' the plan adds to B') : kpi('Digital layer in the plan', '–', null, 'no approved record reaches this unit')) + '</div>';
      html += explain([['Alignment is structural', 'It says whether capability is deployed where the outcomes fall short, under a crosswalk built from the standards\' own themes, and nothing about whether it works.'], ['Yield is attributed, never assumed', 'The change in B is split between the digital and physical layers by the two-player Shapley value, so the two always sum to the whole.'], ['In operation is the one measurement', 'The realised effects of the systems already running are removed and the unit re-scored; nothing is modelled.'], ['κ reads a coupling', 'Above one the digital layer catalyses; the premium behind it is a modelled quantity graded B, and the manual says so beside every ratio.']]);
      // layer bars by unit
      var units = A.unitsInDisplayOrder();
      var lr = units.map(function (x) { var u = E.units[x.unit.id]; if (!u || (!u.in_operation.digital.length && !u.planned)) return null; return { label: x.unit.name, bars: [{ name: 'digital layer in operation', value: u.in_operation.digital.length ? u.in_operation.attribution.B.digital : null, color: DIG }, { name: 'digital layer planned', value: u.planned ? u.planned.attribution.B.digital : null, color: INK }, { name: 'physical layer planned', value: u.planned ? u.planned.attribution.B.physical : null, color: PHY }] }; }).filter(Boolean);
      var idle = units.filter(function (x) { var u = E.units[x.unit.id]; return u && !u.in_operation.digital.length && !u.planned; }).map(function (x) { return x.unit.name; });
      var lmax = 0.001; lr.forEach(function (row) { row.bars.forEach(function (b) { if (b.value !== null) lmax = Math.max(lmax, b.value); }); });
      var ar = units.map(function (x) { var u = E.units[x.unit.id]; if (!u) return null; return { label: x.unit.name, value: u.alignment.alignment, ghost: u.alignment_after ? u.alignment_after.alignment : null, color: DIG, tip: x.unit.name + ': alignment ' + f2(u.alignment.alignment) + (u.alignment_after ? ' → ' + f2(u.alignment_after.alignment) + ' at full effect' : ''), ghostTip: 'at full effect of the plan: ' + f2(u.alignment_after ? u.alignment_after.alignment : null) }; }).filter(Boolean);
      html += '<div class="section grid c2"><div class="panel"><div class="panel-head"><h3>What the digital layer contributes to B</h3><span class="small muted">by unit, full effect</span></div><div class="chart-wrap">' + groupedH(lr.map(function (row) { return { label: row.label, bars: row.bars.map(function (b) { return { name: b.name, value: b.value === null ? null : Math.max(0, b.value), color: b.color, tip: row.label + ' · ' + b.name + ': ' + s4(b.value) }; }) }; }), { label: 'Contribution to B by layer', max: niceMax(lmax), fmt: function (v) { return s4(v); }, width: 500, labelW: 130 }) + '</div><div class="legend"><span><i class="swatch" style="background:' + DIG + '"></i>digital layer in operation</span><span><i class="swatch" style="background:' + INK + '"></i>digital layer planned</span><span><i class="swatch" style="background:' + PHY + '"></i>physical layer planned</span></div><p class="small muted">' + (idle.length ? esc(idle.join(' and ')) + ' hold no record in either stance. ' : '') + (function () { var k = E.units[uid].planned ? E.units[uid].planned.attribution.B.kappa : null; return k === null ? 'Where nothing physical is planned the digital layer is its own co-benefits and nothing more.' : 'At ' + esc(r.name) + ' κ = ' + k.toFixed(2) + ': the digital layer contributes ' + s4(E.units[uid].planned.attribution.B.given_physical) + ' with the physical layer present against ' + s4(E.units[uid].planned.attribution.B.alone) + ' alone.'; })() + '</p></div>' +
        '<div class="panel"><div class="panel-head"><h3>Alignment by unit</h3><span class="small muted">today (solid) and at full effect of the plan (faint)</span></div><div class="chart-wrap">' + hbars(ar, { label: 'Alignment by unit', rowH: 20, width: 470, labelW: 130, fmt: function (v) { return v.toFixed(2); } }) + '</div><p class="small muted">The plan raises alignment where it adds capability on the themes where the shortfall is, and leaves it where nothing is planned.</p></div></div>';
      // bundles
      var blist = A.allBundles(), bset = {}; blist.forEach(function (b) { bset[b.id] = (b.options || []).map(A.optionById).filter(function (o) { return o && o.status !== 'complete'; }); });
      var BS = null; try { BS = SRS.bundleReadings(S().units, bset, S().readiness, U().appraisalUnit || uid, S().cfg); } catch (err) { BS = null; }
      if (BS) {
        var brows = Object.keys(BS).map(function (k) { var y = BS[k], b = y.attribution.B; var nm = (blist.filter(function (x) { return x.id === k; })[0] || {}).name || ''; return { label: k + ' ' + shorten(nm, 22), sub: (b.kappa === null ? 'κ undefined' : 'κ ' + b.kappa.toFixed(2)) + (y.normalised.share !== null ? ' · digital share ' + pc(y.normalised.share) : ''), bars: [{ name: 'digital φD', value: b.digital, color: DIG }, { name: 'physical φP', value: b.physical, color: PHY }] }; });
        html += '<div class="section panel"><div class="panel-head"><h3>The four bundles under the same attribution</h3><span class="small muted">at ' + esc(unitName(U().appraisalUnit || uid)) + '; the ranking does not read this</span></div><div class="chart-wrap mid">' + signedBars(brows, { label: 'Bundle attribution by layer', labelW: 190, width: 640 }) + '</div><p class="small muted">A digital layer that lowers B has neither a share nor a ratio; the reading sends the sponsor to the checks that fire on it. With the premium switched off every bundle reads κ = 1.00 and the layers are additive, the reading of versions 1.2 to 1.4.</p></div>';
      }
      html += sources([['smartness', 'Couplings, premium and the operating register'], ['appraiser', 'Project records'], ['reference', 'Indicators Library: the capability crosswalk']]);
      return html;
    },
    mount: function (root) { mountUnit(root); }
  });

  // =====================================================================
  // 5. BALANCE PLANE
  // =====================================================================
  A.registerScreen('plane', {
    render: function () {
      ensureUnit();
      var mode = U().planeMode || 'all';
      var root = T().tree.roots[0];
      var html = demoHead('plane', 'The balance plane', 'Every unit on one plane: where it stands and where the plan takes it',
        'Sustainability on the horizontal axis and resilience on the vertical. The filled dot is each unit\'s rating today; the thin line runs through ' + horizon() + ' to its position when every approved record reaches full effect. The level curves and stage bands are the framework\'s own rules, so a dot\'s position reads as its rating label.',
        '<div class="control"><span>Units shown</span><div class="seg" role="group"><button type="button" data-plane="all" class="' + (mode === 'all' ? 'on' : '') + '">All</button><button type="button" data-plane="cities" class="' + (mode === 'cities' ? 'on' : '') + '">Region and cities</button><button type="button" data-plane="districts" class="' + (mode === 'districts' ? 'on' : '') + '">A city and its districts</button></div></div>');
      var filter = mode === 'cities' ? function (u) { return u.level !== 'district' && u.level !== 'precinct'; } : mode === 'districts' ? function (u) { return u.id === U().unit || (A.unitById(u.id) && A.unitById(u.id).parent === U().unit); } : null;
      var items = planeItems(filter);
      html += '<div class="grid two-one"><div class="panel"><div class="chart-wrap plane-wrap">' + planeSvg(items, { height: 600 }) + '</div>' + planeLegend() + '</div>' +
        '<div class="stack"><div class="panel"><h3>Reading the plane</h3><p class="small muted">The diagonal is S = R. Within the inner band the gap between the outcomes is 0.10 or less (Even), within the outer band up to 0.25 (Broadly even); outside it the rating is Uneven and names the lagging outcome. The curves are B = √(S × R) at 0.40, 0.60 and 0.80, the edges of Levels 2 | 3, 3 | 4 and 4 | 5; crossing one is a change of level.</p></div>' +
        '<div class="panel"><h3>The moves</h3><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Unit</th><th class="num">B now</th><th class="num">B full</th><th>Level</th></tr></thead><tbody>' + items.map(function (it) { return '<tr><td>' + esc(it.name) + '</td><td class="num">' + f3(it.now.B) + '</td><td class="num">' + (it.full ? f3(it.full.B) : '–') + '</td><td>' + (it.full ? it.now.level + ' → ' + it.full.level : String(it.now.level)) + '</td></tr>'; }).join('') + '</tbody></table></div></div></div></div>';
      return html;
    },
    mount: function (root) { A.on(root, '[data-plane]', 'click', function (ev, el) { U().planeMode = el.getAttribute('data-plane'); A.rerender(); }); }
  });
})(window);
