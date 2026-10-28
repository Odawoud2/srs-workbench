/* SRS Workbench (version 1.5): state, routing, shared components and charts. The demonstration screens are in app-demo.js; the work screens (data entry and the role dashboards) in app-screens.js, app-levels.js and app-smart.js. */
(function (global) {
  'use strict';
  var DATA = global.SRS_DATA;
  var SRS = global.SRS;
  SRS.configure(DATA);

  var STORE_KEY = 'srs-workbench-state-v1.5';
  var DIMS = DATA.dims.map(function (d) { return d.code; });
  var DIM_NAME = {}; DATA.dims.forEach(function (d) { DIM_NAME[d.code] = d.name; });
  var SUB = {}; DATA.subdims.forEach(function (s) { SUB[s.code] = s; });
  var IND = {}; DATA.indicators.forEach(function (i) { IND[i.code] = i; });
  var LEVEL_NAMES = { 1: 'Critical', 2: 'Weak', 3: 'Developing', 4: 'Established', 5: 'Leading' };
  var AGG_TEXT = { popw: 'population-weighted mean of children', areaw: 'area-weighted mean of children', dwellw: 'dwelling-weighted mean of children',
    sumratio: 'ratio of summed numerators to summed denominators', system: 'system value owned at city or region level; children inherit it, flagged', direct: 'measured at every level; not derived' };
  var TAG_LIST = ['operations', 'digital', 'smart_service', 'smart_mobility', 'cyber', 'inclusion', 'efficiency', 'redundancy', 'resilience', 'flood', 'green_blue', 'hard', 'tod', 'compact_infill', 'land_value', 'affordable_housing', 'tenure_security', 'active_travel', 'road_pricing', 'housing', 'greening'];
  var LAG_CLASSES = Object.keys(DATA.lag_profiles);
  var READINESS_TEXT = {
    none: 'None or one of the four conditions of Manual Part 4.5 is met (multiplier 0.3). The conditions are an active environmental or safety enforcement regime; innovation capacity at or above the national median; an economic base at or above the national median product per capita; and a standing cross-departmental or cross-jurisdictional coordination body.',
    partial: 'Two or three of the four conditions of Manual Part 4.5 are met (multiplier 0.7): enforcement regime, innovation capacity, economic base, standing coordination body. Westhaven meets three.',
    mature: 'All four conditions of Manual Part 4.5 are met (multiplier 1.0): enforcement regime, innovation capacity, economic base, standing coordination body.'
  };

  // ---------- state ----------
  function freshState() {
    return {
      units: JSON.parse(JSON.stringify(DATA.units)),
      options: JSON.parse(JSON.stringify(DATA.options)),
      bundles: JSON.parse(JSON.stringify(DATA.bundles)),
      customBundles: {},
      cfg: { enable_optional: false, lag_gap: DATA.defaults.lag_gap, aversion_p: DATA.defaults.aversion_p, indicator_weights: {}, sub_weights: {}, catalysis: JSON.parse(JSON.stringify(DATA.defaults.catalysis)) },
      // version 1.5: the operating register (records with status complete, with the effects they have realised)
      stock: JSON.parse(JSON.stringify(DATA.stock || [])),
      readiness: DATA.readiness,
      territory: { name: DATA.territory.name, configuration_version: DATA.territory.configuration_version, reference_year: DATA.territory.reference_year, synthetic: true },
      // version 1.4: the levels above the project record
      goals: JSON.parse(JSON.stringify(DATA.goals || [])),
      fields: JSON.parse(JSON.stringify(DATA.fields || [])),
      programmes: JSON.parse(JSON.stringify(DATA.programmes || [])),
      portfolio: JSON.parse(JSON.stringify(DATA.portfolio || { id: 'PF', name: 'Portfolio', programmes: [], strategic_goals: [] })),
      envelope: envelopeFrom(DATA.envelope),
      valueLibrary: JSON.parse(JSON.stringify(DATA.value_library || [])),
      money: JSON.parse(JSON.stringify(DATA.money || { base_year: 2026, horizon_years: 30, discount_rate: 0.05 })),
      ui: { unit: 'WH', dim: 'S', appraisalUnit: 'WH', selected: DATA.bundles.D.options.slice(), year: 0, dataFilter: 'all', dataSearch: '', refSearch: '', indicator: null, bundleCompare: ['A', 'B', 'C', 'D'],
        project: null, programme: null, libFilter: 'moved', libSearch: '', goalEditing: null, programmeEditing: null, showAllLines: false }
    };
  }
  function envelopeFrom(e) {
    e = e || { currency: '', price_year: null, by_year: {} };
    var by = {}; Object.keys(e.by_year || {}).forEach(function (k) { by[parseInt(k, 10)] = e.by_year[k]; });
    return { currency: e.currency || '', price_year: e.price_year || null, by_year: by };
  }
  function upgradeState(st) {
    var f = freshState();
    ['goals', 'fields', 'programmes', 'portfolio', 'envelope', 'valueLibrary', 'money', 'stock'].forEach(function (k) { if (st[k] === undefined) st[k] = f[k]; });
    if (st.cfg && !st.cfg.catalysis) st.cfg.catalysis = f.cfg.catalysis;
    if (st.envelope && st.envelope.by_year) { var by = {}; Object.keys(st.envelope.by_year).forEach(function (k) { by[parseInt(k, 10)] = st.envelope.by_year[k]; }); st.envelope.by_year = by; }
    return st;
  }
  var state = freshState();
  try {
    var saved = global.localStorage ? global.localStorage.getItem(STORE_KEY) : null;
    if (saved) {
      var parsed = JSON.parse(saved);
      if (parsed && parsed.units && parsed.options) {
        state = upgradeState(parsed);
        state.ui = Object.assign(freshState().ui, state.ui || {});
        state.customBundles = state.customBundles || {};
      }
    }
  } catch (e) { /* storage unavailable: run from the defaults */ }

  var cache = { territory: null, key: null };
  function persist() {
    try { if (global.localStorage) global.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
    try { if (global.SRS_CLOUD && global.SRS_CLOUD.active()) global.SRS_CLOUD.onLocalChange(); } catch (e) { /* the cloud layer reports its own errors */ }
  }
  // ---------- shared workspace parts (cloud mode) ----------
  // register: the territory register and measured values (data steward); config: configuration record (assessment lead);
  // options: the option library and bundles (project appraiser). The ui part is per person and never shared.
  // strategy (version 1.4): the city's goals, fields, value library and envelope and the portfolio record (sponsor, portfolio manager);
  // programmes: the programme records (portfolio and programme managers)
  function getParts() {
    return { register: { units: state.units, stock: state.stock }, config: { cfg: state.cfg, readiness: state.readiness, territory: state.territory },
      options: { options: state.options, bundles: state.bundles, customBundles: state.customBundles },
      strategy: { goals: state.goals, fields: state.fields, portfolio: state.portfolio, envelope: state.envelope, valueLibrary: state.valueLibrary, money: state.money },
      programmes: { programmes: state.programmes } };
  }
  function setParts(parts) {
    if (parts.register && parts.register.units) state.units = JSON.parse(JSON.stringify(parts.register.units));
    if (parts.register && parts.register.stock) state.stock = JSON.parse(JSON.stringify(parts.register.stock));
    if (parts.config) { if (parts.config.cfg) state.cfg = JSON.parse(JSON.stringify(parts.config.cfg)); if (parts.config.readiness) state.readiness = parts.config.readiness; if (parts.config.territory) state.territory = JSON.parse(JSON.stringify(parts.config.territory)); }
    if (parts.options) { if (parts.options.options) state.options = JSON.parse(JSON.stringify(parts.options.options)); state.bundles = JSON.parse(JSON.stringify(parts.options.bundles || {})); state.customBundles = JSON.parse(JSON.stringify(parts.options.customBundles || {})); }
    if (parts.strategy) { ['goals', 'fields', 'portfolio', 'valueLibrary', 'money'].forEach(function (k) { if (parts.strategy[k]) state[k] = JSON.parse(JSON.stringify(parts.strategy[k])); }); if (parts.strategy.envelope) state.envelope = envelopeFrom({ currency: parts.strategy.envelope.currency, price_year: parts.strategy.envelope.price_year, by_year: parts.strategy.envelope.by_year }); }
    if (parts.programmes && parts.programmes.programmes) state.programmes = JSON.parse(JSON.stringify(parts.programmes.programmes));
    stamp++; appraisalCache = {}; cache.territory = null; chainCache = null; smartCache = null;
    try { if (global.localStorage) global.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function can(part) { return global.SRS_CLOUD && global.SRS_CLOUD.active() ? global.SRS_CLOUD.can(part) : true; }
  function invalidate() { cache.territory = null; persist(); }
  function territory() {
    if (!cache.territory) cache.territory = SRS.scoreTerritory(state.units, state.cfg);
    return cache.territory;
  }
  function unitById(id) { var m = {}; state.units.forEach(function (u) { m[u.id] = u; }); return m[id]; }
  function unitsInDisplayOrder() {
    var t = territory().tree, out = [];
    function visit(id, depth) { var u = t.byId[id]; out.push({ unit: u, depth: depth }); t.children[id].forEach(function (k) { visit(k, depth + 1); }); }
    t.roots.forEach(function (r) { visit(r, 0); });
    return out;
  }
  function subtree(id) {
    var t = territory().tree, out = [];
    function visit(x, depth) { out.push({ id: x, depth: depth }); t.children[x].forEach(function (k) { visit(k, depth + 1); }); }
    visit(id, 0);
    return out;
  }
  function optionById(id) { for (var i = 0; i < state.options.length; i++) if (state.options[i].id === id) return state.options[i]; return null; }
  function allBundles() {
    var out = [];
    Object.keys(state.bundles).forEach(function (k) { out.push({ id: k, name: state.bundles[k].name, options: state.bundles[k].options, custom: false }); });
    Object.keys(state.customBundles).forEach(function (k) { out.push({ id: k, name: state.customBundles[k].name, options: state.customBundles[k].options, custom: true }); });
    return out;
  }
  var appraisalCache = {};
  function appraise(optionIds, settings) {
    var key = JSON.stringify([optionIds, settings, state.cfg, cacheStamp()]);
    if (appraisalCache[key]) return appraisalCache[key];
    var opts = optionIds.map(optionById).filter(Boolean);
    var r = SRS.appraiseTerritory(state.units, opts, { readiness: settings.readiness, year: settings.year || null, cfg: state.cfg });
    if (Object.keys(appraisalCache).length > 60) appraisalCache = {};
    appraisalCache[key] = r;
    return r;
  }
  var stamp = 0;
  function cacheStamp() { return stamp; }
  function dataChanged() { stamp++; appraisalCache = {}; chainCache = null; smartCache = null; invalidate(); }
  // version 1.5: effective smartness at every level, computed once per state and cached
  var smartCache = null;
  function smart() {
    if (smartCache && smartCache.stamp === stamp) return smartCache.value;
    var value, error = null;
    try { value = SRS.smartReadings(state.units, state.options.concat(state.stock), state.programmes, state.portfolio, { readiness: state.readiness, cfg: state.cfg, horizon: state.portfolio.horizon || null }); }
    catch (e) { value = null; error = e; }
    smartCache = { stamp: stamp, value: { smart: value, error: error } };
    return smartCache.value;
  }
  // version 1.4: the alignment chain and the money view, computed once per state and cached
  var chainCache = null;
  function chainSettings() {
    return { readiness: state.readiness, base_year: state.money.base_year, horizon_years: state.money.horizon_years, discount_rate: state.money.discount_rate, envelope: state.envelope, fields: state.fields, catalysis: state.cfg.catalysis };
  }
  function chain() {
    if (chainCache && chainCache.stamp === stamp) return chainCache.value;
    var value, error = null;
    try { value = SRS.chain(state.units, state.options, state.goals, state.programmes, state.portfolio, state.valueLibrary, chainSettings()); }
    catch (e) { value = null; error = e; }
    chainCache = { stamp: stamp, value: { chain: value, error: error } };
    return chainCache.value;
  }
  function programmeById(id) { for (var i = 0; i < state.programmes.length; i++) if (state.programmes[i].id === id) return state.programmes[i]; return null; }
  function goalById(id) { for (var i = 0; i < state.goals.length; i++) if (state.goals[i].id === id) return state.goals[i]; return null; }
  function programmeOf(projectId) { for (var i = 0; i < state.programmes.length; i++) if ((state.programmes[i].projects || []).indexOf(projectId) >= 0) return state.programmes[i]; return null; }

  // ---------- formatting ----------
  function f3(x) { return (x === null || x === undefined || isNaN(x)) ? '–' : x.toFixed(3); }
  function f2(x) { return (x === null || x === undefined || isNaN(x)) ? '–' : x.toFixed(2); }
  function fd(x) { if (x === null || x === undefined || isNaN(x)) return '–'; var s = x.toFixed(3); return (x > 0 ? '+' : '') + s; }
  function pc(x, n) { return (x === null || x === undefined || isNaN(x)) ? '–' : (x * 100).toFixed(n === undefined ? 0 : n) + ' %'; }
  function fv(v) { if (v === null || v === undefined || isNaN(v)) return '–'; var a = Math.abs(v); var s = a >= 1000 ? Math.round(v).toLocaleString('en-GB') : a >= 100 ? v.toFixed(1).replace(/\.0$/, '') : a >= 1 ? String(Number(v.toFixed(2))) : String(Number(v.toPrecision(3))); return s; }
  function money(m) { return (m === null || m === undefined) ? '–' : (m < 0 ? '−' : '') + Math.abs(m).toLocaleString('en-GB', { maximumFractionDigits: 1 }) + ' M'; }
  function deltaClass(x) { return x > 1e-9 ? 'delta-pos' : x < -1e-9 ? 'delta-neg' : 'delta-zero'; }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function levelBadge(x, withName) {
    if (x === null || x === undefined) return '<span class="badge">not rated</span>';
    var l = SRS.levelOf(x);
    return '<span class="badge lvl-' + l.level + '">' + l.level + (withName === false ? '' : ' ' + l.name) + '</span>';
  }
  function stageBadge(stage) {
    var cls = stage === 'Even' ? 'good' : stage === 'Broadly even' ? 'accent' : stage === 'Uneven' ? 'warn' : 'serious';
    return '<span class="badge ' + cls + '">' + esc(stage) + '</span>';
  }
  function capOf(bal) { return bal && bal.capability ? bal.capability.M : null; }
  function lagText(bal) {
    if (!bal) return 'not rated';
    var t = !bal.lagging.length ? 'sustainability and resilience within the lag gap' : bal.lagging.map(function (d) { return DIM_NAME[d] + ' lags (gap ' + f2(bal.lag_size[d]) + ')'; }).join(', ');
    var c = capOf(bal);
    if (c && c.score !== null) t += c.trails ? '; digital capability trails the outcomes by ' + f2(c.gap) : '; digital capability keeps pace with the outcomes';
    return t;
  }
  function lagBadges(bal) {
    if (!bal) return '';
    var out = !bal.lagging.length ? '<span class="badge good">▲ no outcome lag</span>' : bal.lagging.map(function (d) { return '<span class="badge warn">▼ ' + DIM_NAME[d] + ' lags by ' + f2(bal.lag_size[d]) + '</span>'; }).join(' ');
    return out + ' ' + capBadge(bal);
  }
  function capBadge(bal) {
    var c = capOf(bal);
    if (!c || c.score === null) return '<span class="badge">capability not rated</span>';
    return c.trails ? '<span class="badge warn">▼ capability trails by ' + f2(c.gap) + '</span>' : '<span class="badge good">capability keeps pace</span>';
  }
  function confBadge(conf) { return '<span class="badge ' + (conf.grade === 'A' ? 'good' : conf.grade === 'B' ? 'accent' : 'warn') + '">confidence ' + conf.grade + '</span>'; }
  function ratingLabel(res) {
    if (!res.balance) return 'Not rated: sustainability or resilience lacks the minimum number of rated sub-dimensions.';
    var b = res.balance, pl = b.performance_level, c = capOf(b);
    var capPart = c && c.score !== null ? 'capability ' + c.level.level + ' ' + c.level.name + (c.trails ? ', trailing' : '') : 'capability not rated';
    return pl.level + ' ' + pl.name + '<span class="sep">·</span>outcomes ' + b.stage.toLowerCase() + '<span class="sep">·</span>' + (b.lagging.length ? b.lagging.map(function (d) { return DIM_NAME[d]; }).join(' and ') + ' lagging' : 'no outcome lag') + '<span class="sep">·</span>' + capPart;
  }
  function ratingText(res) { return ratingLabel(res).replace(/<span class="sep">·<\/span>/g, ' · '); }
  function track(x, opts) {
    opts = opts || {};
    var segs = '<i class="seg"></i><i class="seg"></i><i class="seg"></i><i class="seg"></i><i class="seg"></i>';
    var mk = x === null || x === undefined ? '' : '<i class="mk" style="left:' + (x * 100).toFixed(1) + '%"></i>';
    var ghost = opts.ghost === null || opts.ghost === undefined ? '' : '<i class="mk ghost" style="left:' + (opts.ghost * 100).toFixed(1) + '%"></i>';
    return '<div class="track' + (opts.lg ? ' lg' : '') + '" title="' + esc(opts.title || '') + '">' + segs + ghost + mk + '</div>';
  }
  function hbar(label, x, cls, opts) {
    opts = opts || {};
    var w = x === null ? 0 : Math.max(0, Math.min(1, x)) * 100;
    var ghost = opts.ghost !== undefined && opts.ghost !== null ? '<i class="ghost ' + cls + '" style="width:' + (opts.ghost * 100).toFixed(1) + '%"></i>' : '';
    return '<div class="hbar"><span>' + label + '</span><div class="bar">' + ghost + '<i class="' + cls + '" style="width:' + w.toFixed(1) + '%"></i></div><span class="n">' + f3(x) + '</span></div>';
  }
  function unitSelect(id, value, filter) {
    var opts = unitsInDisplayOrder().filter(function (e) { return !filter || filter(e.unit); }).map(function (e) {
      return '<option value="' + esc(e.unit.id) + '"' + (e.unit.id === value ? ' selected' : '') + '>' + ' '.repeat(e.depth * 3) + esc(e.unit.name) + ' (' + esc(e.unit.level) + ')</option>';
    }).join('');
    return '<select id="' + id + '">' + opts + '</select>';
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, 1800);
  }
  function copyText(text, what) {
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast((what || 'Text') + ' copied'); } catch (e) { toast('Select and copy the text shown'); }
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast((what || 'Text') + ' copied'); }, fallback);
    else fallback();
  }
  /* Hand the viewer a file. In the published claude.ai page the downloads capability asks the viewer to confirm the save;
     elsewhere the browser's own download is used. Resolves true when a save was handed over. */
  function download(name, text, mime) {
    if (global.claude && typeof global.claude.use === 'function') {
      return global.claude.use('downloads').then(function (dl) {
        if (!dl) { toast('Downloads are not available in this view; use the copy button'); return false; }
        return dl.save({ filename: name, data: text }).then(function () { toast('Saved ' + name); return true; }, function (e) {
          if (e && e.code === 'declined') return false;
          toast('Could not save the file' + (e && e.message ? ': ' + e.message : '') + '; use the copy button'); return false;
        });
      });
    }
    try {
      var blob = new Blob([text], { type: mime || 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      return Promise.resolve(true);
    } catch (e) { toast('Could not start the download; use the copy button'); return Promise.resolve(false); }
  }
  /* Read a file the viewer picks, as text. */
  function pickFile(accept) {
    return new Promise(function (resolve) {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept || '.json,application/json';
      inp.style.display = 'none'; document.body.appendChild(inp);
      inp.addEventListener('change', function () {
        var f = inp.files && inp.files[0]; document.body.removeChild(inp);
        if (!f) { resolve(null); return; }
        var r = new FileReader(); r.onload = function () { resolve({ name: f.name, text: String(r.result) }); }; r.onerror = function () { resolve(null); }; r.readAsText(f);
      });
      inp.click();
    });
  }

  // ---------- charts ----------
  var tipEl = null;
  function ensureTip(wrap) {
    var t = wrap.querySelector('.tip');
    if (!t) { t = document.createElement('div'); t.className = 'tip'; wrap.appendChild(t); }
    return t;
  }
  function attachHover(wrap) {
    var t = ensureTip(wrap);
    wrap.querySelectorAll('[data-tip]').forEach(function (el) {
      el.addEventListener('mousemove', function (ev) {
        var r = wrap.getBoundingClientRect();
        t.innerHTML = el.getAttribute('data-tip');
        t.style.left = (ev.clientX - r.left) + 'px'; t.style.top = (ev.clientY - r.top) + 'px'; t.classList.add('on');
      });
      el.addEventListener('mouseleave', function () { t.classList.remove('on'); });
    });
  }
  function dimColor(d) { return 'var(--dim-' + d + ')'; }

  /* Line chart of a year profile: series [{key,name,color,values[]}], x = years 0..n. */
  function lineChart(series, years, opts) {
    opts = opts || {};
    var W = 640, H = opts.height || 260, m = { t: 18, r: 110, b: 44, l: 42 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var ymin = opts.ymin !== undefined ? opts.ymin : 0, ymax = opts.ymax !== undefined ? opts.ymax : 1;
    var allv = []; series.forEach(function (s) { s.values.forEach(function (v) { if (v !== null) allv.push(v); }); });
    if (opts.fit && allv.length) { var lo = Math.min.apply(null, allv), hi = Math.max.apply(null, allv); var pad = Math.max(0.02, (hi - lo) * 0.25); ymin = Math.max(0, Math.floor((lo - pad) * 20) / 20); ymax = Math.min(1, Math.ceil((hi + pad) * 20) / 20); }
    function x(i) { return m.l + (years.length > 1 ? i / (years.length - 1) : 0.5) * iw; }
    function y(v) { return m.t + (1 - (v - ymin) / (ymax - ymin)) * ih; }
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || 'Line chart') + '">';
    var ticks = 5, g = '';
    for (var k = 0; k <= ticks; k++) { var v = ymin + (ymax - ymin) * k / ticks; g += '<line x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' + '<text x="' + (m.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v.toFixed(2) + '</text>'; }
    s += '<g class="grid">' + g + '</g>';
    s += '<g class="axis">' + years.map(function (yr, i) { return '<text x="' + x(i) + '" y="' + (H - 26) + '" text-anchor="middle">' + esc(yr) + '</text>'; }).join('') + '</g>';
    s += '<text x="' + (m.l + iw / 2) + '" y="' + (H - 8) + '" text-anchor="middle" class="lblsub">' + esc(opts.xlabel || '') + '</text>';
    series.forEach(function (sr) {
      var pts = sr.values.map(function (v, i) { return v === null ? null : [x(i), y(v)]; }).filter(Boolean);
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
      s += '<path d="' + d + '" fill="none" stroke="' + sr.color + '" stroke-width="' + (sr.bold ? 3 : 2) + '" stroke-linejoin="round" stroke-linecap="round"' + (sr.dash ? ' stroke-dasharray="5 4"' : '') + '/>';
      pts.forEach(function (p, i) {
        s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="9" fill="transparent" data-tip="' + esc(sr.name + ', ' + (opts.xname || 'year') + ' ' + years[i] + ': ' + sr.values[i].toFixed(3)) + '"/>';
        s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (sr.bold ? 3.5 : 2.5) + '" fill="' + sr.color + '" stroke="var(--bg-elev)" stroke-width="1.5" pointer-events="none"/>';
      });
      if (pts.length) { var last = pts[pts.length - 1]; s += '<text x="' + (last[0] + 8) + '" y="' + (last[1] + 4 + (sr.labelDy || 0)) + '" class="lbl" style="fill:' + sr.color + '">' + esc(sr.name) + ' ' + sr.values[sr.values.length - 1].toFixed(3) + '</text>'; }
    });
    s += '</svg>';
    return s;
  }
  /* Resolve end-label collisions by nudging labelDy on series sorted by final value. */
  function spreadLabels(series, minGap) {
    var H = 260, ih = H - 18 - 34;
    var items = series.map(function (s) { return { s: s, v: s.values[s.values.length - 1] }; }).filter(function (i) { return i.v !== null; });
    items.sort(function (a, b) { return b.v - a.v; });
    var lastY = -1e9;
    items.forEach(function (it) { it.s.labelDy = 0; });
    return series;
  }

  /* Grouped horizontal bars: rows [{label, bars:[{name,value,color,tip}]}] drawn to one 0–1 scale. */
  function groupedBars(rows, opts) {
    opts = opts || {};
    var W = opts.width || 640, rowH = 16, gap = 3, labelW = opts.labelW || 150, m = { t: 8, r: 50, b: 20 };
    var max = opts.max || 1, fmt = opts.fmt || function (v) { return v.toFixed(3); };
    var groupGap = 12;
    var n = rows.reduce(function (a, r) { return a + r.bars.length; }, 0);
    var H = m.t + rows.length * groupGap + n * (rowH + gap) + m.b;
    var iw = W - labelW - m.r;
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opts.label || 'Bar chart') + '">';
    s += '<g class="grid">' + [0, 0.2, 0.4, 0.6, 0.8, 1].map(function (v) { var xx = labelW + v * iw; return '<line x1="' + xx + '" x2="' + xx + '" y1="' + m.t + '" y2="' + (H - m.b) + '"/>' + '<text x="' + xx + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(opts.tickFmt ? opts.tickFmt(v * max) : (max === 1 ? v.toFixed(1) : fmt(v * max))) + '</text>'; }).join('') + '</g>';
    var yy = m.t;
    rows.forEach(function (r) {
      s += '<text x="' + (labelW - 10) + '" y="' + (yy + 12) + '" text-anchor="end" class="lbl">' + esc(r.label) + '</text>';
      r.bars.forEach(function (b) {
        var w = (b.value === null ? 0 : Math.max(0, Math.min(max, b.value))) / max * iw;
        s += '<rect x="' + labelW + '" y="' + yy + '" width="' + w.toFixed(1) + '" height="' + rowH + '" rx="2" fill="' + b.color + '" data-tip="' + esc(b.tip || (b.name + ': ' + fmt(b.value === null ? 0 : b.value))) + '"/>';
        s += '<text x="' + (labelW + w + 5) + '" y="' + (yy + 12) + '">' + (b.value === null ? 'not rated' : esc(fmt(b.value))) + '</text>';
        if (b.name) s += '<text x="' + (labelW + 4) + '" y="' + (yy + 12) + '" style="fill:#fff;font-size:10px" pointer-events="none">' + esc(b.name) + '</text>';
        yy += rowH + gap;
      });
      yy += groupGap;
    });
    s += '</svg>';
    return s;
  }

  // ---------- routing ----------
  var SCREENS = {};
  /* The menu: the demonstration screens first (chart-first, read-only), then the work screens where data is entered,
     folded away so that a presentation shows the framework and not its forms. */
  var ROLES = [
    { id: 'home', k: '⌂', title: 'Dashboard', group: null },
    { id: 'rating', k: '1', title: 'Rate the territory', group: 'The framework' },
    { id: 'appraisal', k: '2', title: 'Appraise investments', group: null },
    { id: 'levels', k: '3', title: 'Deliver at every level', group: null },
    { id: 'smart', k: '4', title: 'Effective smartness', group: null },
    { id: 'plane', k: '5', title: 'Balance plane', group: null },
    { id: 'roles', k: '≡', title: 'All work screens', group: 'Work screens · data entry', fold: 'work' },
    { id: 'data', k: 'a', title: 'Register and values', group: null, fold: 'work' },
    { id: 'lead', k: 'b', title: 'Configuration and sign-off', group: null, fold: 'work' },
    { id: 'appraiser', k: 'c', title: 'Project records and bundles', group: null, fold: 'work' },
    { id: 'project', k: 'd', title: 'Project record page', group: null, fold: 'work' },
    { id: 'programme', k: 'e', title: 'Programme records', group: null, fold: 'work' },
    { id: 'portfolio', k: 'f', title: 'Portfolio record', group: null, fold: 'work' },
    { id: 'city', k: 'g', title: 'City goals and values', group: null, fold: 'work' },
    { id: 'smartness', k: 'h', title: 'Couplings and operating register', group: null, fold: 'work' },
    { id: 'sponsor', k: 'i', title: 'Sponsor brief', group: null, fold: 'work' },
    { id: 'dimension', k: 'j', title: 'Dimension detail', group: null, fold: 'work' },
    { id: 'reference', k: '§', title: 'Indicators Library', group: 'Library' },
    { id: 'about', k: '?', title: 'About and help', group: null },
    { id: 'account', k: '@', title: 'Account and team', group: 'Workspace' }
  ];
  function currentRoute() {
    var h = (location.hash || '#home').replace('#', '');
    return SCREENS[h] ? h : 'home';
  }
  function renderNav() {
    var r = currentRoute();
    var inWork = ROLES.some(function (x) { return x.id === r && x.fold === 'work'; });
    var open = inWork || !!(state.ui && state.ui.navWorkOpen);
    var nav = '', folded = false;
    ROLES.forEach(function (x) {
      var link = '<a href="#' + x.id + '" class="' + (x.id === r ? 'active' : '') + '"><span class="k">' + x.k + '</span>' + x.title + '</a>';
      if (x.fold === 'work' && !folded) { folded = true; nav += '<details class="navfold"' + (open ? ' open' : '') + ' id="nav-work"><summary class="group label">' + x.group + '</summary>' + link; return; }
      if (x.fold === 'work') { nav += link; return; }
      if (folded) { nav += '</details>'; folded = false; }
      nav += (x.group ? '<div class="group label">' + x.group + '</div>' : '') + link;
    });
    if (folded) nav += '</details>';
    document.getElementById('nav').innerHTML = nav;
    var fold = document.getElementById('nav-work');
    if (fold) fold.addEventListener('toggle', function () { if (state.ui) state.ui.navWorkOpen = fold.open; });
    var ml = document.getElementById('mode-line');
    if (ml) ml.innerHTML = global.SRS_CLOUD && global.SRS_CLOUD.active() ? global.SRS_CLOUD.statusHtml() : 'Local mode: the calculator runs in your browser and edits stay on this device.';
    document.getElementById('topbar').innerHTML = ROLES.filter(function (x) { return !x.fold || x.id === 'roles' || x.id === r; }).map(function (x) { return '<a href="#' + x.id + '" class="' + (x.id === r ? 'active' : '') + '">' + x.title + '</a>'; }).join('');
  }
  function render() {
    var r = currentRoute();
    renderNav();
    var main = document.getElementById('main');
    main.innerHTML = '<div class="screen-enter">' + SCREENS[r].render() + '</div>';
    if (SCREENS[r].mount) SCREENS[r].mount(main);
    (SCREENS[r].guard || []).forEach(function (g) {
      if (can(g.part)) return;
      var locked = main.querySelectorAll(g.sel);
      locked.forEach(function (el) { el.disabled = true; el.title = 'Your role in this workspace cannot change this'; });
      if (locked.length && !main.querySelector('.ro-note')) {
        var n = document.createElement('div'); n.className = 'callout ro-note'; n.style.marginBottom = '14px';
        n.textContent = 'Read-only for your role (' + global.SRS_CLOUD.role() + '). ' + g.why;
        var head = main.querySelector('.page-head'); if (head && head.parentNode) head.parentNode.insertBefore(n, head.nextSibling);
      }
    });
    main.querySelectorAll('.chart-wrap').forEach(attachHover);
    persist();
  }
  function rerender() { render(); }
  global.addEventListener('hashchange', function () { window.scrollTo(0, 0); render(); });

  function registerScreen(id, def) { SCREENS[id] = def; }
  function on(root, selector, event, handler) {
    root.querySelectorAll(selector).forEach(function (el) { el.addEventListener(event, function (ev) { handler(ev, el); }); });
  }

  global.APP = {
    DATA: DATA, SRS: SRS, DIMS: DIMS, DIM_NAME: DIM_NAME, SUB: SUB, IND: IND, LEVEL_NAMES: LEVEL_NAMES, AGG_TEXT: AGG_TEXT, TAG_LIST: TAG_LIST, LAG_CLASSES: LAG_CLASSES, READINESS_TEXT: READINESS_TEXT,
    state: function () { return state; }, resetState: function () { state = freshState(); dataChanged(); }, replaceState: function (s) { state = s; state.ui = Object.assign(freshState().ui, s.ui || {}); state.customBundles = state.customBundles || {}; dataChanged(); },
    territory: territory, unitById: unitById, unitsInDisplayOrder: unitsInDisplayOrder, subtree: subtree, optionById: optionById, allBundles: allBundles, appraise: appraise, dataChanged: dataChanged, persist: persist,
    chain: chain, chainSettings: chainSettings, programmeById: programmeById, goalById: goalById, programmeOf: programmeOf, envelopeFrom: envelopeFrom, smart: smart,
    f3: f3, f2: f2, fd: fd, pc: pc, fv: fv, money: money, deltaClass: deltaClass, esc: esc, levelBadge: levelBadge, stageBadge: stageBadge, lagText: lagText, lagBadges: lagBadges, capBadge: capBadge, capOf: capOf, confBadge: confBadge, ratingLabel: ratingLabel, ratingText: ratingText,
    track: track, hbar: hbar, unitSelect: unitSelect, toast: toast, copyText: copyText, download: download, pickFile: pickFile,
    lineChart: lineChart, groupedBars: groupedBars, dimColor: dimColor, spreadLabels: spreadLabels,
    registerScreen: registerScreen, render: render, rerender: rerender, on: on, currentRoute: currentRoute,
    getParts: getParts, setParts: setParts, can: can, screens: function () { return SCREENS; }
  };
  global.addEventListener('DOMContentLoaded', function () { render(); });
})(window);
