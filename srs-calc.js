/* SRS Development Framework calculator, JavaScript edition (Practitioner Manual, version 1.2).
   A function-for-function port of the Python reference calculator (framework/calculator/srs_calc.py, version 1.2),
   verified against its outputs by tools/verify.js.

   Tier 1: territory rating from indicator values (normalisation, sub-dimension and dimension scores,
           level L, evenness C, coordination degree D, stage, lag, obstacle degrees, data confidence).
   Tier 2: appraisal of options and bundles by the change they make to a unit's rating, with the interaction
           checks, the governance-readiness multiplier and the lag profiles.

   Version 1.1 corrections (independent review of 9 October 2026): ratio indicators aggregate by their own
   denominators; effects compose independently of order and their time path converges on the full effect; checks are
   scoped through any number of levels by leaf footprints, count once per leaf, lift in proportion to offset coverage
   and ramp with the triggering option; IC12 lapses after its payback window; bundles are ranked with a dominance
   screen before the coordination degree. */
(function (global) {
  'use strict';

  var LIB = { indicators: [], byCode: {}, subdims: [], subOf: {}, dims: [], subsOfDim: {}, dimName: {} };
  var LEVEL_BANDS = [[0.8, 5, 'Leading'], [0.6, 4, 'Established'], [0.4, 3, 'Developing'], [0.2, 2, 'Weak'], [0.0, 1, 'Critical']];
  var DEFAULTS = {
    lag_gap: 0.10, min_indicators_per_sub: 3, min_weight_share_per_sub: 0.5,
    min_subs_per_dim: { S: 2, R: 3, M: 2 }, optional_subs: ['IF'], enable_optional: false,
    readiness_multiplier: { none: 0.3, partial: 0.7, mature: 1.0 },
    outcome_dims: ['S', 'R'], capability_dims: ['M'], aversion_p: 0.0, near_tie: 0.005,
    /* version 1.5: the catalytic mechanism (the integration premium on the outcomes a coupled pair delivers) */
    catalysis: { premium: 1.2, phase_in_start: 2, phase_in_full: 5, couplings: [
      { a: 'operations', b: 'smart_service', subs: ['EN', 'SE', 'RP'] },
      { a: 'operations', b: 'flood', subs: ['RB', 'RP'] },
      { a: 'smart_mobility', b: 'tod', subs: ['EN', 'SE'] }] }
  };
  var LAG_PROFILES = {};
  var CHECK_PARAMS = {};
  var DEN_BASIS = {};
  var SDG_CROSSWALK = {}, SDG_TARGET_TEXT = {}, SDG_NAMES = {};
  var FULL_EFFECT_YEAR = 8;
  var M_SUBS = { DI: true, SS: true, DG: true };
  var DIGITAL_TAGS = ['operations', 'smart_service', 'smart_mobility', 'cyber', 'digital', 'inclusion'];

  function configure(data) {
    LIB.indicators = data.indicators.slice();
    LIB.byCode = {};
    LIB.indicators.forEach(function (i) { LIB.byCode[i.code] = i; });
    LIB.subdims = data.subdims.slice();
    LIB.subOf = {};
    LIB.subdims.forEach(function (s) { LIB.subOf[s.code] = s; });
    LIB.dims = data.dims.map(function (d) { return d.code; });
    LIB.dimName = {};
    data.dims.forEach(function (d) { LIB.dimName[d.code] = d.name; });
    LIB.subsOfDim = {};
    LIB.dims.forEach(function (d) { LIB.subsOfDim[d] = LIB.subdims.filter(function (s) { return s.dim === d; }).map(function (s) { return s.code; }); });
    if (data.defaults) DEFAULTS = clone(data.defaults);
    if (data.lag_profiles) LAG_PROFILES = clone(data.lag_profiles);
    if (data.check_params) CHECK_PARAMS = clone(data.check_params);
    if (data.den_basis) DEN_BASIS = clone(data.den_basis);
    if (data.full_effect_year) FULL_EFFECT_YEAR = data.full_effect_year;
    if (data.sdg_crosswalk) SDG_CROSSWALK = clone(data.sdg_crosswalk);
    if (data.sdg_target_text) SDG_TARGET_TEXT = clone(data.sdg_target_text);
    if (data.sdg_names) SDG_NAMES = clone(data.sdg_names);
    if (data.valued_text) VALUED_TEXT = clone(data.valued_text);
  }

  // ---------- helpers ----------
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function keys(o) { return Object.keys(o); }
  function sum(a) { return a.reduce(function (s, x) { return s + x; }, 0); }
  function fs(x, n) { return (x >= 0 ? '+' : '') + x.toFixed(n); }
  function pct0(x) { return Math.round(x * 100) + '%'; }
  function thousands(x) { return Number(x).toLocaleString('en-US'); }
  function g(x) { return String(Number(Number(x).toPrecision(6))); }
  function median(a) { var b = a.slice().sort(function (x, y) { return x - y; }); var n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; }
  function pstdev(a) { var m = sum(a) / a.length; return Math.sqrt(sum(a.map(function (x) { return (x - m) * (x - m); })) / a.length); }
  function has(arr, x) { return (arr || []).indexOf(x) >= 0; }
  function intersects(a, b) { return (a || []).some(function (x) { return b.indexOf(x) >= 0; }); }
  function mergeParams(params) { var p = clone(CHECK_PARAMS); if (params) keys(params).forEach(function (k) { p[k] = params[k]; }); return p; }
  function mergeCfg(cfg) { var out = clone(DEFAULTS); if (cfg) keys(cfg).forEach(function (k) { out[k] = cfg[k]; }); return out; }

  function levelOf(x) {
    if (x === null || x === undefined || isNaN(x)) return null;
    for (var i = 0; i < LEVEL_BANDS.length; i++) if (x >= LEVEL_BANDS[i][0]) return { level: LEVEL_BANDS[i][1], name: LEVEL_BANDS[i][2] };
    return { level: 1, name: 'Critical' };
  }
  /* Balance stage (version 1.3): read from the gap between the two outcome scores. */
  var STAGES = [[0.10, 'Even'], [0.25, 'Broadly even'], [0.50, 'Uneven'], [1.01, 'Severely uneven']];
  function stageOf(gap) { for (var i = 0; i < STAGES.length; i++) if (gap <= STAGES[i][0]) return STAGES[i][1]; return STAGES[STAGES.length - 1][1]; }
  /* Stage read from D, as in versions 1.0 to 1.2; reported for comparison only. */
  function dStageOf(d) {
    if (d > 0.8) return 'High coordination';
    if (d > 0.5) return 'Basic coordination';
    if (d > 0.3) return 'Basic imbalance';
    return 'Severe imbalance';
  }
  function bandValues(floor, target) { return [0.2, 0.4, 0.6, 0.8].map(function (q) { return floor + (target - floor) * q; }); }

  // ---------- balance (version 1.2) ----------
  function powerMean(xs, p) {
    if (!xs.length) return null;
    if (p === 0) return Math.min.apply(null, xs) > 0 ? Math.pow(xs.reduce(function (a, x) { return a * x; }, 1), 1 / xs.length) : 0.0;
    if (p < 0 && Math.min.apply(null, xs) <= 0) return 0.0;
    return Math.pow(sum(xs.map(function (x) { return Math.pow(x, p); })) / xs.length, 1 / p);
  }
  /* Outcomes (S, R): balanced performance index B, imbalance A, evenness C, coordination degree D, stage, lag.
     Capability (M): score, level, gap to B, trailing flag. Null when an outcome dimension is not rated. */
  function balanceOf(dimScores, cfg) {
    var outs = cfg.outcome_dims;
    var vals = outs.map(function (d) { var v = dimScores[d]; return v === undefined ? null : v; });
    if (vals.some(function (v) { return v === null; })) return null;
    var n = vals.length, mean = sum(vals) / n;
    var sigma = Math.sqrt(sum(vals.map(function (v) { return (v - mean) * (v - mean); })) / n);
    var B = powerMean(vals, cfg.aversion_p);
    var A = mean > 0 ? 1 - B / mean : 0.0;
    var C = Math.max(0, 1 - 2 * sigma), D = Math.sqrt(C * mean), top = Math.max.apply(null, vals);
    var lagging = outs.filter(function (d) { return top - dimScores[d] > cfg.lag_gap; });
    var lagSize = {}; lagging.forEach(function (d) { lagSize[d] = top - dimScores[d]; });
    var cap = {};
    cfg.capability_dims.forEach(function (d) {
      var m = dimScores[d]; if (m === undefined) m = null;
      cap[d] = { score: m, level: m !== null ? levelOf(m) : null, gap: m !== null ? B - m : null, trails: m !== null && B - m > cfg.lag_gap };
    });
    var allv = LIB.dims.map(function (d) { var v = dimScores[d]; return v === undefined ? null : v; });
    var L3 = allv.every(function (v) { return v !== null; }) ? powerMean(allv, 0) : null;
    var gap = top - Math.min.apply(null, vals);
    return { B: B, level: B, p: cfg.aversion_p, mean: mean, sigma: sigma, imbalance: A, evenness: C, D: D, gap: gap, stage: stageOf(gap), d_stage: dStageOf(D),
      performance_level: levelOf(B), lagging: lagging, lag_size: lagSize, outcomes: outs.slice(), capability: cap, L_all: L3 };
  }
  function dimScoresOf(res) { var o = {}; LIB.dims.forEach(function (d) { o[d] = res.dims[d].score; }); return o; }

  // ---------- Tier 1 ----------
  function normalise(v, fl, t) {
    if (v === null || v === undefined) return null;
    return Math.max(0, Math.min(1, (v - fl) / (t - fl)));
  }
  function ConfigurationError(message) { this.name = 'ConfigurationError'; this.message = message; }
  ConfigurationError.prototype = Object.create(Error.prototype);
  function weightsFor(codes, cfgWeights) {
    var w = {}, s = 0;
    codes.forEach(function (c) { w[c] = (cfgWeights && cfgWeights[c] !== undefined) ? cfgWeights[c] : 1.0; if (w[c] < 0) throw new ConfigurationError('a weight is negative: ' + c); s += w[c]; });
    var out = {};
    if (!s) return out;
    codes.forEach(function (c) { out[c] = w[c] / s; });
    return out;
  }
  var WEIGHT_CAP_INDICATOR = 0.25, WEIGHT_CAP_SUB = 0.50;
  /* Weight caps of Manual Part 2.4 on the configured weights (version 1.3): an indicator may carry at most
     max(0.25, 1/n) of its sub-dimension over the n active indicators, a sub-dimension at most max(0.50, 1/n) of its
     dimension. Returns null when the configuration is admissible, else the message naming the first breach. */
  function weightCapError(cfg) {
    cfg = mergeCfg(cfg);
    var activeSubs = LIB.subdims.filter(function (s) { return cfg.optional_subs.indexOf(s.code) < 0 || cfg.enable_optional; }).map(function (s) { return s.code; });
    var inactive = cfg.inactive || [], iw = cfg.indicator_weights || {}, sw = cfg.sub_weights || {};
    var bad = keys(iw).concat(keys(sw)).filter(function (c) { return !LIB.byCode[c] && !LIB.subOf[c]; });
    if (bad.length) return 'weight given for an unknown code: ' + bad[0];
    for (var i = 0; i < activeSubs.length; i++) {
      var sub = activeSubs[i];
      var codes = LIB.indicators.filter(function (ind) { return ind.sub === sub && inactive.indexOf(ind.code) < 0; }).map(function (ind) { return ind.code; });
      if (!codes.length) continue;
      var w = weightsFor(codes, iw), cap = Math.max(WEIGHT_CAP_INDICATOR, 1 / codes.length);
      for (var j = 0; j < codes.length; j++) if (w[codes[j]] > cap + 1e-9) return codes[j] + ' carries ' + (w[codes[j]] * 100).toFixed(1) + '% of ' + sub + '; the cap is ' + Math.round(cap * 100) + '% with ' + codes.length + ' active indicators';
    }
    for (var k = 0; k < LIB.dims.length; k++) {
      var d = LIB.dims[k], subs = LIB.subsOfDim[d].filter(function (s) { return activeSubs.indexOf(s) >= 0; });
      var ws = weightsFor(subs, sw), capS = Math.max(WEIGHT_CAP_SUB, 1 / subs.length);
      for (var m = 0; m < subs.length; m++) if (ws[subs[m]] > capS + 1e-9) return subs[m] + ' carries ' + (ws[subs[m]] * 100).toFixed(1) + '% of ' + d + '; the cap is ' + Math.round(capS * 100) + '% with ' + subs.length + ' active sub-dimensions';
    }
    return null;
  }
  function checkWeights(cfg) { var e = weightCapError(cfg); if (e) throw new ConfigurationError(e); return true; }

  function scoreUnit(unit, cfg) {
    cfg = mergeCfg(cfg);
    checkWeights(cfg);
    var activeSubs = LIB.subdims.filter(function (s) { return cfg.optional_subs.indexOf(s.code) < 0 || cfg.enable_optional; }).map(function (s) { return s.code; });
    var indW = cfg.indicator_weights || {}, subWCfg = cfg.sub_weights || {}, inactive = cfg.inactive || [];
    var res = { id: unit.id, name: unit.name, level: unit.level, indicators: {}, subs: {}, dims: {} };
    var values = unit.values || {};
    LIB.indicators.forEach(function (ind) {
      if (activeSubs.indexOf(ind.sub) < 0 || inactive.indexOf(ind.code) >= 0) return;
      var rec = values[ind.code];
      var v = rec ? rec.value : null;
      if (v === undefined) v = null;
      var x = v !== null ? normalise(v, ind.floor, ind.target) : null;
      res.indicators[ind.code] = { value: v, score: x, level: x !== null ? levelOf(x).level : null,
        dq: rec ? (rec.dq || null) : null, year: rec ? (rec.year || null) : null,
        inherited: rec ? !!rec.inherited : false, derived: rec ? !!rec.derived : false, sub: ind.sub,
        approximate: rec ? !!rec.approximate : false, coverage: rec && rec.coverage !== undefined ? rec.coverage : null };
    });
    activeSubs.forEach(function (sub) {
      var codes = keys(res.indicators).filter(function (c) { return res.indicators[c].sub === sub; });
      var present = codes.filter(function (c) { return res.indicators[c].score !== null; });
      var wall = weightsFor(codes, indW);
      var share = sum(present.map(function (c) { return wall[c]; }));
      var rated = present.length >= cfg.min_indicators_per_sub && share >= cfg.min_weight_share_per_sub;
      var w = present.length ? weightsFor(present, indW) : {};
      var score = rated ? sum(present.map(function (c) { return w[c] * res.indicators[c].score; })) : null;
      present.forEach(function (c) { res.indicators[c].weight = w[c]; });
      res.subs[sub] = { score: score, rated: rated, n_present: present.length, n_total: codes.length, weight_share_present: share,
        level: score !== null ? levelOf(score).level : null, dim: LIB.subOf[sub].dim, name: LIB.subOf[sub].name };
    });
    LIB.dims.forEach(function (d) {
      var subs = LIB.subsOfDim[d].filter(function (s) { return activeSubs.indexOf(s) >= 0; });
      var ratedSubs = subs.filter(function (s) { return res.subs[s].rated; });
      var rated = ratedSubs.length >= cfg.min_subs_per_dim[d];
      var w = ratedSubs.length ? weightsFor(ratedSubs, subWCfg) : {};
      var score = rated ? sum(ratedSubs.map(function (s) { return w[s] * res.subs[s].score; })) : null;
      ratedSubs.forEach(function (s) { res.subs[s].weight = w[s]; });
      res.dims[d] = { score: score, rated: rated, subs: subs, level: score !== null ? levelOf(score).level : null, name: LIB.dimName[d] };
    });
    res.balance = balanceOf(dimScoresOf(res), cfg);
    {
      res.obstacles = {};
      LIB.dims.forEach(function (d) {
        var items = [];
        res.dims[d].subs.forEach(function (s) {
          if (!res.subs[s].rated) return;
          var ws = res.subs[s].weight || 0;
          keys(res.indicators).forEach(function (c) { var r = res.indicators[c]; if (r.sub === s && r.score !== null) items.push([c, ws * r.weight, 1 - r.score]); });
        });
        var tot = sum(items.map(function (t) { return t[1] * t[2]; }));
        var degs = items.map(function (t) { return [t[0], tot ? (t[1] * t[2] / tot) : 0.0]; });
        degs.sort(function (a, b) { return b[1] - a[1]; });
        res.obstacles[d] = degs;
      });
    }
    var pres = keys(res.indicators).map(function (c) { return res.indicators[c]; }).filter(function (r) { return r.score !== null; });
    var nTot = keys(res.indicators).length;
    var coverage = nTot ? pres.length / nTot : 0;
    var ab = pres.length ? pres.filter(function (r) { return r.dq === 'A' || r.dq === 'B'; }).length / pres.length : 0;
    var conf = (coverage >= 0.9 && ab >= 0.8) ? 'A' : (coverage >= 0.75 && ab >= 0.6) ? 'B' : 'C';
    res.confidence = { grade: conf, coverage: coverage, share_A_or_B: ab, inherited: pres.filter(function (r) { return r.inherited; }).length, n_present: pres.length, n_total: nTot };
    return res;
  }

  var COVERAGE_MIN = 0.5, COVERAGE_FULL = 0.9;
  /* Denominator of a ratio indicator for one unit (version 1.3): DEN_BASIS[code] = {key, fallback, exact_fallback};
     "dwellings" comes from the register, any other key from unit.denominators[key] (or, in a legacy register, from
     unit.denominators[code]). Null when it is not recorded. */
  function den(unit, code) {
    var basis = DEN_BASIS[code];
    if (!basis || !basis.key) return null;
    if (basis.key === 'dwellings') return unit.dwellings === undefined ? null : unit.dwellings;
    var ds = unit.denominators || {};
    if (ds[basis.key] !== undefined && ds[basis.key] !== null) return ds[basis.key];
    if (ds[code] !== undefined && ds[code] !== null) return ds[code];
    return null;
  }
  function weightKey(rule) { return rule === 'popw' ? 'population' : rule === 'areaw' ? 'area' : rule === 'dwellw' ? 'dwellings' : 'population'; }
  /* The value a parent takes for one indicator from its children (version 1.3), or null: exact by the recorded
     counts when every reporting child carries them, else by the fallback weighting flagged approximate unless that
     weighting is exact; coverage = share of the parent's weight held by the reporting children, below COVERAGE_MIN
     the value is not derived; grade capped at B when approximate or coverage below COVERAGE_FULL. */
  function deriveValue(code, children, log, parentId) {
    var ind = LIB.byCode[code], rule = ind.agg;
    if (rule === 'system' || rule === 'direct') return null;
    var reporting = children.map(function (ch) { return [ch, (ch.values || {})[code]]; }).filter(function (t) { return t[1] && t[1].value !== null && t[1].value !== undefined; });
    if (!reporting.length) return null;
    var basis = DEN_BASIS[code];
    var exactCounts = !!(basis && basis.key) && reporting.every(function (t) { return den(t[0], code) !== null; });
    var approximate = false, weighting = rule, ws, allWs;
    if (exactCounts) {
      weighting = 'count:' + basis.key;
      ws = reporting.map(function (t) { return den(t[0], code); });
      allWs = children.map(function (ch) { return den(ch, code); }).filter(function (w) { return w !== null; });
    } else {
      var fb = basis ? basis.fallback : rule;
      weighting = fb;
      approximate = !!basis && !basis.exact_fallback;
      var wk = weightKey(fb);
      ws = reporting.map(function (t) { return t[0][wk] || 0; });
      allWs = children.map(function (ch) { return ch[wk] || 0; });
    }
    var dsum = sum(ws), tot = sum(allWs);
    if (!dsum) return null;
    var coverage = tot ? dsum / tot : 1.0;
    if (coverage + 1e-9 < COVERAGE_MIN) {
      if (log) log.push(parentId + ': ' + code + ' not derived; reporting children cover ' + Math.round(coverage * 100) + '% of the parent, below ' + Math.round(COVERAGE_MIN * 100) + '%');
      return null;
    }
    var num = sum(reporting.map(function (t, i) { return ws[i] * t[1].value; }));
    var years = reporting.map(function (t) { return t[1].year; }).filter(function (y) { return y; });
    var dqs = reporting.map(function (t) { return t[1].dq || 'C'; }).sort();
    var dq = dqs[dqs.length - 1];
    if ((approximate || coverage + 1e-9 < COVERAGE_FULL) && dq === 'A') dq = 'B';
    var how = weighting.indexOf('count:') === 0 ? 'ratio of summed counts, ' + weighting.slice(6) : weighting;
    var src = 'derived from children (' + how + (approximate ? '; approximate' : '') + (coverage < 0.999 ? '; coverage ' + Math.round(coverage * 100) + '%' : '') + ')';
    return { value: num / dsum, year: years.length ? Math.max.apply(null, years) : null, dq: dq, source: src, derived: true, approximate: approximate, coverage: coverage, weighting: weighting, den: dsum };
  }
  function deriveParentValues(parent, children, log) {
    log = log || [];
    parent.values = parent.values || {};
    var pv = parent.values;
    LIB.indicators.forEach(function (ind) {
      var code = ind.code, rule = ind.agg;
      if (rule === 'system') {
        if (pv[code]) children.forEach(function (ch) { ch.values = ch.values || {}; if (!ch.values[code]) { ch.values[code] = clone(pv[code]); ch.values[code].inherited = true; } });
        return;
      }
      if (rule === 'direct') return;
      var basis = DEN_BASIS[code];
      if (basis && basis.key && basis.key !== 'dwellings' && children.length) {
        var dens = children.map(function (ch) { return den(ch, code); });
        if (dens.every(function (d) { return d !== null; })) {
          parent.denominators = parent.denominators || {};
          if (parent.denominators[basis.key] === undefined && parent.denominators[code] === undefined) {
            parent.denominators[basis.key] = sum(dens);
            (parent.denominators_derived = parent.denominators_derived || []).push(basis.key);
          }
        }
      }
      if (pv[code]) return;
      var d = deriveValue(code, children, log, parent.id);
      if (d) { var rec = clone(d); delete rec.den; pv[code] = rec; }
    });
    return log;
  }

  function rollup(childResults) {
    var Ds = childResults.filter(function (c) { return c.balance; }).map(function (c) { return c.balance.D; });
    if (!Ds.length) return null;
    var sd = Ds.length > 1 ? pstdev(Ds) : 0.0;
    var stages = {};
    childResults.forEach(function (c) { var st = c.balance ? c.balance.stage : 'not rated'; stages[st] = (stages[st] || 0) + 1; });
    return { n: Ds.length, D_min: Math.min.apply(null, Ds), D_median: median(Ds), D_max: Math.max.apply(null, Ds), between_unit_evenness: Math.max(0, 1 - 2 * sd), stages: stages,
      children: childResults.map(function (c) { return { id: c.id, name: c.name, D: c.balance ? c.balance.D : null, stage: c.balance ? c.balance.stage : 'not rated', lagging: c.balance ? c.balance.lagging : [] }; }) };
  }

  // ---------- hierarchy ----------
  function buildTree(units) {
    var byId = {}, children = {};
    units.forEach(function (u) { byId[u.id] = u; children[u.id] = []; });
    units.forEach(function (u) { if (u.parent && children[u.parent]) children[u.parent].push(u.id); });
    var roots = units.filter(function (u) { return !u.parent || !byId[u.parent]; }).map(function (u) { return u.id; });
    var order = [];
    function visit(id) { children[id].forEach(visit); order.push(id); }
    roots.forEach(visit);
    function ancestors(id) { var a = [], p = byId[id] && byId[id].parent; while (p && byId[p]) { a.push(p); p = byId[p].parent; } return a; }
    function leaves(id) { if (!children[id].length) return [id]; var out = []; children[id].forEach(function (k) { out = out.concat(leaves(k)); }); return out; }
    return { byId: byId, children: children, roots: roots, bottomUp: order, ancestors: ancestors, leaves: leaves };
  }
  function strip(units) {
    var us = clone(units);
    us.forEach(function (u) {
      var v = {};
      keys(u.values || {}).forEach(function (c) { var r = u.values[c]; if (!r.derived && !r.inherited) v[c] = r; });
      u.values = v;
      if (u.denominators_derived) { u.denominators_derived.forEach(function (k) { if (u.denominators) delete u.denominators[k]; }); delete u.denominators_derived; }
    });
    return us;
  }
  function passDown(tree, overwriteInherited) {
    tree.bottomUp.slice().reverse().forEach(function (id) {
      var p = tree.byId[id];
      tree.children[id].forEach(function (k) {
        var ch = tree.byId[k];
        ch.values = ch.values || {};
        LIB.indicators.forEach(function (ind) {
          if (ind.agg === 'system' && p.values && p.values[ind.code]) {
            var cur = ch.values[ind.code];
            if (!cur || (overwriteInherited && cur.inherited)) { ch.values[ind.code] = clone(p.values[ind.code]); ch.values[ind.code].inherited = true; }
          }
        });
      });
    });
  }
  function prepareTerritory(units, log) {
    log = log || [];
    var us = strip(units);
    var tree = buildTree(us);
    tree.bottomUp.forEach(function (id) {
      var kids = tree.children[id].map(function (k) { return tree.byId[k]; });
      if (kids.length) deriveParentValues(tree.byId[id], kids, log);
    });
    passDown(tree, false);
    return { units: us, tree: tree, log: log };
  }
  function scoreTerritory(units, cfg) {
    var prep = prepareTerritory(units);
    var results = {};
    prep.units.forEach(function (u) { results[u.id] = scoreUnit(u, cfg); });
    var rollups = {};
    prep.units.forEach(function (u) { var kids = prep.tree.children[u.id]; if (kids.length) rollups[u.id] = rollup(kids.map(function (k) { return results[k]; })); });
    return { units: prep.units, tree: prep.tree, results: results, rollups: rollups, log: prep.log };
  }

  // ---------- Tier 2 ----------
  function tags(o) { return o.tags || []; }
  /* version 1.4: a calendar year (>= 1000) denotes, for each option, the years since its own completion year */
  function yearIndex(option, year) {
    if (year === null || year === undefined || year < 1000) return year;
    return year - (option.completion || 0);
  }
  function ramp(option, year) {
    year = yearIndex(option, year);
    if (year === null || year === undefined) return 1.0;
    var prof = LAG_PROFILES[option.lag_class || 'programme'] || LAG_PROFILES.programme;
    if (year <= 0) return 0.0;
    return prof[Math.min(year, prof.length) - 1];
  }
  function densityMultiplier(density, p) {
    if (density <= p.IC2_density_decline) return Math.max(0.5, Math.min(1.0, density / p.IC2_density_ref));
    var span = p.IC2_density_car - p.IC2_density_decline;
    return Math.max(0.5, 1.0 - 0.5 * (density - p.IC2_density_decline) / span);
  }
  function adjustChange(opt, code, change, e, p, log) {
    var t = tags(opt);
    if (code === 'EN4' && has(t, 'efficiency') && change < 0 && (e.basis || 'ex-ante') === 'ex-ante') {
      log.push('IC4 rebound: ' + opt.id + ' EN4 saving ' + (-change).toFixed(1) + ' reduced by ' + pct0(p.IC4_rebound) + ' to ' + (-change * (1 - p.IC4_rebound)).toFixed(1));
      change *= (1 - p.IC4_rebound);
    }
    if (has(t, 'tod') && (code === 'SE5' || code === 'SE6') && opt.density_after) {
      var m = densityMultiplier(opt.density_after, p);
      if (Math.abs(m - 1) > 1e-12) log.push('IC2 density: ' + opt.id + ' ' + code + ' effect scaled by ' + m.toFixed(2) + ' at ' + thousands(opt.density_after) + ' persons per km²');
      change *= m;
    }
    if (has(t, 'tod') && code === 'EN1' && (opt.density_after || 0) > p.IC2_density_car) {
      log.push('IC2 density: ' + opt.id + ' car-use benefit on EN1 halved above ' + thousands(p.IC2_density_car) + ' persons per km²');
      change *= 0.5;
    }
    return change;
  }

  function isDigital(opt) { return intersects(DIGITAL_TAGS, tags(opt)); }
  /* Version 1.3: the readiness multiplier g scales each digital option's own effects on sustainability and resilience
     indicators before composition, so an option's benefit is the same whatever else is in the bundle. */
  function couplingPhase(opt, partner, year, cat) {
    if (year === null || year === undefined) return 1.0;
    var idx = Math.min(yearIndex(opt, year), yearIndex(partner, year));
    var a = cat.phase_in_start, b = cat.phase_in_full;
    if (idx <= a) return 0.0;
    if (idx >= b) return 1.0;
    return (idx - a) / (b - a);
  }
  function couplingContext(tree, unitId, options, cat) {
    /* version 1.5: for one appraised unit, the couplings each option is party to within the bundle, with the
       population overlap of both partners' footprints among the unit's leaves */
    var leaves = tree.leaves(unitId), pop = {}, tot = 0;
    leaves.forEach(function (l) { pop[l] = tree.byId[l].population || 0; tot += pop[l]; });
    tot = tot || 1.0;
    var fp = {}; options.forEach(function (o) { fp[o.id] = footprint(tree, unitId, o); });
    var ctx = {};
    (cat.couplings || []).forEach(function (c) {
      options.forEach(function (o) {
        var to = tags(o);
        options.forEach(function (q) {
          if (q === o || q.id === o.id) return;
          var tq = tags(q);
          if (!((has(to, c.a) && has(tq, c.b)) || (has(to, c.b) && has(tq, c.a)))) return;
          var both = fp[o.id].filter(function (l) { return fp[q.id].indexOf(l) >= 0; });
          if (!both.length) return;
          var overlap = sum(both.map(function (l) { return pop[l]; })) / tot;
          (ctx[o.id] = ctx[o.id] || []).push({ subs: c.subs.slice(), overlap: overlap, partner: q, a: c.a, b: c.b });
        });
      });
    });
    return ctx;
  }
  function catalysisOf(cfg) {
    var cat = clone(DEFAULTS.catalysis || { premium: 1.0, phase_in_start: 2, phase_in_full: 5, couplings: [] });
    if (cfg && cfg.catalysis) keys(cfg.catalysis).forEach(function (k) { cat[k] = cfg.catalysis[k]; });
    return cat;
  }

  function applyEffects(unit, options, params, year, log, readinessG, coupling, catalysis) {
    var p = mergeParams(params);
    var u = clone(unit);
    log = log || [];
    var gR = (readinessG === undefined || readinessG === null) ? 1.0 : readinessG;
    var full = year === null || year === undefined;
    var perCode = {};
    options.forEach(function (opt) {
      (opt.effects || []).forEach(function (e) {
        if (e.unit !== undefined && e.unit !== null && e.unit !== unit.id) return;
        (perCode[e.code] = perCode[e.code] || []).push([opt, e]);
      });
    });
    keys(perCode).sort().forEach(function (code) {
      var ind = LIB.byCode[code], rec = u.values[code];
      if (!ind) { log.push('unknown indicator ' + code + '; effect ignored'); return; }
      if (!rec || rec.value === null || rec.value === undefined) { perCode[code].forEach(function (pe) { log.push(pe[0].id + ': no measured baseline for ' + code + ' at ' + unit.id + '; effect ignored'); }); return; }
      var v0 = rec.value, t = ind.target, sets = [], deltas = [], reds = [];
      perCode[code].forEach(function (pe) {
        var opt = pe[0], e = pe[1], fr = ramp(opt, year), sink = full ? log : [];
        var gg = (isDigital(opt) && !M_SUBS[ind.sub] && gR !== 1.0) ? gR : 1.0;
        if (gg !== 1.0 && full) log.push(opt.id + ': co-benefit on ' + code + ' scaled by readiness ' + gg.toFixed(1));
        var cf = 1.0;
        if (coupling && catalysis && coupling[opt.id] && !M_SUBS[ind.sub]) {
          var best = null;
          coupling[opt.id].forEach(function (cp) {
            if (cp.subs.indexOf(ind.sub) < 0) return;
            var up = (catalysis.premium - 1.0) * gR * couplingPhase(opt, cp.partner, year, catalysis) * cp.overlap;
            if (best === null || up > best[0]) best = [up, cp];
          });
          if (best && best[0] > 1e-12) {
            cf = 1.0 + best[0];
            if (full) log.push(opt.id + ': effect on ' + code + ' catalysed x' + cf.toFixed(3) + ' by ' + best[1].partner.id + ' (' + best[1].a + ' with ' + best[1].b + ', overlap ' + best[1].overlap.toFixed(2) + ', readiness ' + gR.toFixed(1) + ')');
          }
        }
        if (e.set !== undefined) sets.push([opt, adjustChange(opt, code, e.set - v0, e, p, sink) * gg * cf, fr, e.set]);
        else if (e.delta !== undefined) deltas.push([opt, adjustChange(opt, code, e.delta, e, p, sink) * gg * cf, fr]);
        else if (e.reduce_by !== undefined) reds.push([opt, Math.min(1.0, e.reduce_by * gg * cf), fr]);
      });
      var base = v0;
      if (sets.length) {
        var win = sets.slice().sort(function (a, b) { var da = Math.abs(t - (v0 + a[1])), db = Math.abs(t - (v0 + b[1])); return da !== db ? da - db : (a[0].id < b[0].id ? -1 : a[0].id > b[0].id ? 1 : 0); })[0];
        if (sets.length > 1 && full) log.push('Several options set ' + code + ' (' + sets.map(function (s) { return s[0].id + ' ' + g(s[3]); }).join(', ') + '); the value nearer the target, ' + g(v0 + win[1]) + ' from ' + win[0].id + ', is kept and the others add nothing');
        base = v0 + win[1] * win[2];
      }
      var v1 = base + sum(deltas.map(function (d) { return d[1] * d[2]; }));
      if (reds.length) {
        var combined = 1 - reds.reduce(function (acc, r) { return acc * (1 - r[1] * r[2]); }, 1);
        if (reds.length > 1 && full) log.push('IC5 overlap: ' + code + ' reductions ' + reds.map(function (r) { return r[0].id + ' ' + Math.round(r[1] * 100) + '%'; }).join(', ') + ' combined to ' + (combined * 100).toFixed(1) + '% rather than ' + Math.round(sum(reds.map(function (r) { return r[1]; })) * 100) + '%');
        v1 = v1 + (t - v1) * combined;
      }
      var nrec = clone(rec);
      nrec.value = v1; nrec.source = 'effects of ' + perCode[code].map(function (pe) { return pe[0].id; }).join(', ');
      u.values[code] = nrec;
    });
    return { unit: u, log: log };
  }

  function footprint(tree, unitId, opt) {
    var leaves = tree.leaves(unitId), ou = opt.unit;
    if (ou === undefined || ou === null || ou === unitId || tree.ancestors(unitId).indexOf(ou) >= 0) return leaves.slice();
    if (tree.byId[ou] && tree.ancestors(ou).indexOf(unitId) >= 0) return tree.leaves(ou);
    return [];
  }

  function runChecks(unitId, tree, options, params, elderlyShare, mLow, year) {
    var p = mergeParams(params);
    var leaves = tree.leaves(unitId);
    var pop = {}; leaves.forEach(function (l) { pop[l] = tree.byId[l].population || 0; });
    var tot = sum(leaves.map(function (l) { return pop[l]; })) || 1;
    var fp = {}; options.forEach(function (o) { fp[o.id] = footprint(tree, unitId, o); });
    var opts = options.filter(function (o) { return fp[o.id].length; });
    var yr = (year === null || year === undefined) ? FULL_EFFECT_YEAR : year;
    var adj = {}, notes = [];
    /* Delivered coverage of a leaf by offset options with any of the needed tags: the largest ramp fraction among them in
       the year appraised (1.0 at full effect), 0.0 when none covers the leaf (version 1.3). */
    function covered(l, needed) { var fr = opts.filter(function (o) { return intersects(tags(o), needed) && fp[o.id].indexOf(l) >= 0; }).map(function (o) { return ramp(o, year); }); return fr.length ? Math.max.apply(null, fr) : 0.0; }
    function share(m) { return sum(keys(m).map(function (l) { return pop[l] * m[l]; })) / tot; }
    function ones(m) { var o = {}; keys(m).forEach(function (l) { o[l] = 1; }); return o; }
    function trim(sub, amount, note) { if (amount <= 1e-9) return; adj[sub] = (adj[sub] || 0) - amount; notes.push(note); }
    function where(frac) { return frac >= 0.999 ? '' : " (applies to " + frac.toFixed(2) + " of the unit's population)"; }
    function subName(s) { return LIB.subOf[s].name.toLowerCase(); }
    function simple(code, sub, triggers, offsetTags, magnitude, text) {
      if (!triggers.length) return;
      var amounts = {};
      leaves.forEach(function (l) {
        var ts = triggers.filter(function (o) { return fp[o.id].indexOf(l) >= 0; });
        if (!ts.length) return;
        var lift = offsetTags ? covered(l, offsetTags) : 0.0;
        var a = Math.max.apply(null, ts.map(function (o) { return magnitude(o) * Math.max(0, ramp(o, year) - lift); }));
        if (a > 1e-12) amounts[l] = a;
      });
      var amt = share(amounts);
      trim(sub, amt, code + ' ' + triggers.map(function (o) { return o.id; }).join(', ') + ': ' + text + '; ' + subName(sub) + ' −' + amt.toFixed(3) + where(share(ones(amounts))));
    }
    function withTag(t) { return opts.filter(function (o) { return has(tags(o), t); }); }

    var trig = opts.filter(function (o) { return has(tags(o), 'efficiency') && (o.consolidates_capacity === undefined ? true : o.consolidates_capacity); });
    if (trig.length) {
      var am = {}, nHalf = 0;
      leaves.forEach(function (l) {
        var ts = trig.filter(function (o) { return fp[o.id].indexOf(l) >= 0; });
        if (!ts.length) return;
        var red = covered(l, ['redundancy']), rt = Math.max.apply(null, ts.map(function (o) { return ramp(o, year); }));
        var c = rt > 0 ? Math.min(red / rt, 1) : 0;
        nHalf += pop[l] * c;
        am[l] = rt * (p.IC1_trim * (1 - c) + p.IC1_trim_with_redundancy * c);
      });
      var a1 = share(am), hf = nHalf / tot;
      trim('RD', a1, 'IC1 ' + trig.map(function (o) { return o.id; }).join(', ') + ': efficiency option consolidates capacity; redundancy −' + a1.toFixed(3) +
        (hf > 1e-9 ? ' (halved on ' + hf.toFixed(2) + ' of the population covered by a redundancy option)' : '') + where(share(ones(am))));
    }
    simple('IC3', 'RB', opts.filter(function (o) { return (o.cyber_exposure || 0) > 0; }), ['cyber'], function () { return p.IC3_trim; }, 'digital option with cyber exposure and no cyber-resilience option');
    var ops = withTag('operations'), serv = withTag('smart_service');
    simple('IC6', 'SS', ops, ['smart_service'], function () { return p.IC6_ops_without_services; }, 'operations centre without a service programme');
    simple('IC6', 'SS', serv, ['operations'], function () { return p.IC6_services_without_ops; }, 'service options without an operations centre');
    simple('IC7', 'SE', withTag('land_value'), ['affordable_housing', 'tenure_security'], function () { return p.IC7_trim; }, 'land-value-raising option without affordable housing or tenure security covering the same population');
    var flood = withTag('flood');
    if (flood.length) {
      var a8 = {};
      leaves.forEach(function (l) {
        var fl = flood.filter(function (o) { return fp[o.id].indexOf(l) >= 0; });
        if (!fl.length) return;
        /* version 1.3: the design classes present decide, not the number of records; a hard or pumped strategy with no
           green-blue option locks in, a green-blue strategy where the unit holds no hard or pumped capacity on its register */
        var classes = {};
        fl.forEach(function (o) { classes[has(tags(o), 'green_blue') ? 'green_blue' : has(tags(o), 'pumped') ? 'pumped' : 'hard'] = true; });
        var greenOnly = keys(classes).length === 1 && classes.green_blue && !tree.byId[l].hard_flood_capacity;
        if (!classes.green_blue || greenOnly) a8[l] = p.IC8_trim * Math.max.apply(null, fl.map(function (o) { return ramp(o, year); }));
      });
      var amt8 = share(a8);
      trim('RF', amt8, 'IC8 ' + flood.map(function (o) { return o.id; }).join(', ') + ': flood strategy of a single design class; resourcefulness −' + amt8.toFixed(3) + ' for lock-in to one design standard' + where(share(ones(a8))));
    }
    simple('IC9', 'EN', withTag('tod'), ['green_blue'], function (o) { return has(tags(o), 'compact_infill') ? p.IC9_trim_infill : p.IC9_trim; }, 'densification without a green–blue option covering the same population');
    var vulnerable = (elderlyShare !== null && elderlyShare !== undefined && elderlyShare > p.IC10_elderly_share) || mLow;
    simple('IC10', 'SE', serv, ['inclusion'], function () { return vulnerable ? p.IC10_trim_vulnerable : p.IC10_trim; }, 'digital service without an inclusion measure' + (vulnerable ? ' (vulnerable population)' : ''));
    simple('IC11', 'EN', withTag('smart_mobility'), ['tod', 'active_travel', 'road_pricing'], function () { return p.IC11_trim; }, 'smart mobility without densification, active-travel works or road pricing covering the same population');
    var ic12 = opts.filter(function (o) { return has(tags(o), 'resilience') && o.operating_load && !o.on_site_generation; });
    var live = ic12.filter(function (o) { return ((year === null || year === undefined) ? FULL_EFFECT_YEAR : yearIndex(o, year)) <= (o.payback_years !== undefined ? o.payback_years : p.IC12_default_payback_years); });
    ic12.forEach(function (o) { if (live.indexOf(o) < 0) notes.push('IC12 ' + o.id + ': payback window of ' + g(o.payback_years !== undefined ? o.payback_years : p.IC12_default_payback_years) + ' years has passed by year ' + yr + '; no trim'); });
    simple('IC12', 'EN', live, null, function () { return p.IC12_trim; }, 'resilience option with an operating energy load and no on-site generation, within its payback window');
    opts.forEach(function (o) {
      if ((o.couples_systems || 0) > 0 && !((o.backup_days || 0) >= 3)) {
        var a13 = {};
        fp[o.id].forEach(function (l) { var a = p.IC13_trim * o.couples_systems * Math.max(0, ramp(o, year) - Math.min(covered(l, ['operations']), covered(l, ['cyber']))); if (a > 1e-12) a13[l] = a; });
        var amt13 = share(a13);
        trim('RB', amt13, 'IC13 ' + o.id + ': couples ' + o.couples_systems + ' system(s) to a stressed system without three days of backup; robustness −' + amt13.toFixed(3) + where(share(ones(a13))));
      }
    });
    return { adjustments: adj, notes: notes, options_in_scope: opts };
  }

  function appraisePrepared(tree, baseUnit, postUnit, options, readiness, cfg, params, year) {
    var p = mergeParams(params);
    var base = scoreUnit(baseUnit, cfg), postRaw = scoreUnit(postUnit, cfg);
    var mLow = base.dims.M.score !== null && base.dims.M.score < 0.4;
    var elderly = baseUnit.elderly_share;
    var chk = runChecks(baseUnit.id, tree, options, p, elderly, mLow, year);
    var adj = chk.adjustments, notes = chk.notes.slice(), opts = chk.options_in_scope;
    var gm = DEFAULTS.readiness_multiplier[readiness]; if (gm === undefined) gm = 1.0;
    var hasOps = opts.some(function (o) { return has(tags(o), 'operations'); });
    var hasServ = opts.some(function (o) { return has(tags(o), 'smart_service'); });
    var vulnerable = (elderly !== null && elderly !== undefined && elderly > p.IC10_elderly_share) || mLow;
    var noInclusion = hasServ && !opts.some(function (o) { return has(tags(o), 'inclusion'); });
    var subsPost = {};
    keys(postRaw.subs).forEach(function (s) {
      var x0 = base.subs[s] ? base.subs[s].score : null, x1 = postRaw.subs[s].score;
      if (x0 === null || x1 === null) { subsPost[s] = x1; return; }
      var d = x1 - x0, mult = 1.0, why = [];
      if (M_SUBS[s]) {
        mult *= gm; why.push('readiness ' + gm.toFixed(1));
        /* version 1.5: the integration premium acts on the coupled outcomes (couplingContext), not on the capability score */
        if (s === 'SS' && vulnerable && noInclusion) { mult *= p.IC10_benefit_multiplier; why.push('IC10 ×0.5'); }
        if (x0 > p.M_saturation && d > 0) { mult *= p.M_saturation_factor; why.push('saturation ×0.5'); }
      }
      subsPost[s] = Math.max(0, Math.min(1, x0 + d * mult + (adj[s] || 0)));
      if (mult !== 1.0 && Math.abs(d) > 1e-9) notes.push(s + ': raw change ' + fs(d, 3) + ' × ' + mult.toFixed(2) + ' (' + why.join(', ') + ') = ' + fs(d * mult, 3));
    });
    var post = clone(postRaw);
    keys(subsPost).forEach(function (s) { post.subs[s].score = subsPost[s]; post.subs[s].level = subsPost[s] !== null ? levelOf(subsPost[s]).level : null; });
    LIB.dims.forEach(function (dk) {
      var rated = post.dims[dk].subs.filter(function (s) { return post.subs[s].rated; });
      var w = {}; rated.forEach(function (s) { w[s] = post.subs[s].weight !== undefined ? post.subs[s].weight : 1 / rated.length; });
      var scv = rated.length && post.dims[dk].rated ? sum(rated.map(function (s) { return w[s] * post.subs[s].score; })) : null;
      post.dims[dk].score = scv; post.dims[dk].level = scv !== null ? levelOf(scv).level : null;
    });
    var cfgFull = mergeCfg(cfg);
    post.balance = balanceOf(dimScoresOf(post), cfgFull);
    var contrib = { subs: {}, dims: {}, balance: null };
    if (post.balance && base.balance) {
      keys(base.subs).forEach(function (s) {
        var x0 = base.subs[s].score, x1 = post.subs[s] ? post.subs[s].score : null;
        if (x0 === null || x1 === null) return;
        contrib.subs[s] = { before: x0, after: x1, change: x1 - x0, gap_closed: x0 < 1 ? (x1 - x0) / (1 - x0) : 0.0 };
      });
      LIB.dims.forEach(function (dk) {
        var x0 = base.dims[dk].score, x1 = post.dims[dk].score;
        if (x0 === null || x1 === null) return;
        contrib.dims[dk] = { before: x0, after: x1, change: x1 - x0, gap_closed: x0 < 1 ? (x1 - x0) / (1 - x0) : 0.0 };
      });
      var b0 = base.balance, b1 = post.balance;
      contrib.balance = { B_before: b0.B, B_after: b1.B, D_before: b0.D, D_after: b1.D, stage_before: b0.stage, stage_after: b1.stage,
        lagging_before: b0.lagging, lagging_after: b1.lagging, L_before: b0.B, L_after: b1.B, C_before: b0.evenness, C_after: b1.evenness,
        A_before: b0.imbalance, A_after: b1.imbalance, capability_before: b0.capability, capability_after: b1.capability };
    }
    return { baseline: base, post: post, post_raw: postRaw, adjustments: adj, notes: notes, contribution: contrib, readiness: readiness, options: opts.map(function (o) { return o.id; }) };
  }

  /* Draft 0.2: the intervention record and the register are checked before an appraisal or an assessment
     (Reference Parts A.2 and B.2; Manual 3.1 and 4.3). Each check returns a list of {severity, id, message};
     an "error" makes the record inadmissible, a "warning" is reported. Mirrors validate_options / validate_territory. */
  function ValidationError(message) { this.name = 'ValidationError'; this.message = message; }
  ValidationError.prototype = Object.create(Error.prototype);
  var KNOWN_TAGS = ['operations', 'digital', 'smart_service', 'smart_mobility', 'cyber', 'inclusion', 'efficiency', 'redundancy',
    'flood', 'green_blue', 'hard', 'resilience', 'tod', 'compact_infill', 'land_value', 'affordable_housing',
    'tenure_security', 'active_travel', 'road_pricing', 'housing'];
  var REQUIRED_FLAGS = { operations: ['cyber_exposure', 'operating_load', 'couples_systems'], digital: ['cyber_exposure'], smart_service: ['cyber_exposure'],
    smart_mobility: ['cyber_exposure'], efficiency: ['consolidates_capacity'], hard: ['operating_load'], tod: ['density_after'] };
  function validateOptions(options, units, goals) {
    var ids = null, tree = null;
    if (units) { ids = {}; units.forEach(function (u) { ids[u.id] = true; }); tree = buildTree(strip(units)); }
    var problems = [], seen = {};
    function add(sev, id, m) { problems.push({ severity: sev, id: id, message: m }); }
    (options || []).forEach(function (o) {
      var oid = o.id || '?';
      if (seen[oid]) add('error', oid, 'duplicate option id'); seen[oid] = true;
      var tags = o.tags || [];
      tags.forEach(function (t) { if (KNOWN_TAGS.indexOf(t) < 0) add('error', oid, "tag '" + t + "' is not in the library"); });
      var lc = o.lag_class;
      if (!lc) add('warning', oid, 'no lag class declared; the programme ramp is assumed');
      else if (!LAG_PROFILES[lc]) add('error', oid, "lag class '" + lc + "' is unknown");
      if (o.capex_m === undefined || o.capex_m === null) add('warning', oid, 'no capital cost recorded; the cost per point cannot be reported');
      if (o.status === 'complete' && !o.completion) add('error', oid, 'a complete record needs its completion year');
      Object.keys(REQUIRED_FLAGS).forEach(function (tag) {
        if (tags.indexOf(tag) >= 0) REQUIRED_FLAGS[tag].forEach(function (f) {
          if (!(f in o)) add('warning', oid, "flag '" + f + "' not declared for a " + tag + ' option; the checks read it as absent');
        });
      });
      if (o.operating_load && !('on_site_generation' in o)) add('warning', oid, 'an operating load is declared without saying whether on-site generation covers it; IC12 reads it as uncovered');
      if ('couples_systems' in o && o.couples_systems > 0 && !('backup_days' in o)) add('warning', oid, 'systems are coupled without the days of local backup declared; IC13 reads them as having none');
      if (o.unit !== undefined && o.unit !== null && ids && !ids[o.unit]) add('error', oid, "unit '" + o.unit + "' is not in the register");
      if (goals && o.goals && o.goals.length) {
        var known = {}; goals.forEach(function (g) { known[g.id] = true; });
        o.goals.forEach(function (gid) { if (!known[gid]) add('error', oid, "claims goal '" + gid + "', which is not in the goal library"); });
      }
      var effects = o.effects || [];
      if (!effects.length) add('warning', oid, 'no effect on any indicator; the record contributes nothing but its tags and flags');
      effects.forEach(function (e) {
        var code = e.code, unit = e.unit;
        if (!LIB.byCode[code]) { add('error', oid, "indicator '" + code + "' is not in the active library"); return; }
        if (ids && !ids[unit]) { add('error', oid, 'effect on ' + code + " names unit '" + unit + "', which is not in the register"); return; }
        var forms = ['set', 'delta', 'reduce_by'].filter(function (k) { return k in e; });
        if (forms.length !== 1 || e[forms[0]] === null || e[forms[0]] === undefined) add('error', oid, 'effect on ' + code + ' at ' + unit + ' needs exactly one of set, delta or reduce_by');
        else if ('reduce_by' in e && !(e.reduce_by >= 0 && e.reduce_by <= 1)) add('error', oid, 'reduce_by on ' + code + ' at ' + unit + ' must lie between 0 and 1');
        if (o.status === 'complete') {
          /* version 1.5: a realised effect is a delta or a set with its before value, so that it can be inverted */
          if ('reduce_by' in e) add('error', oid, 'realised effect on ' + code + ' at ' + unit + ': a complete record states a delta or a set with its before value, not a share of the gap');
          else if ('set' in e && (e.before === undefined || e.before === null)) add('error', oid, 'realised effect on ' + code + ' at ' + unit + ': a set needs the before value');
        }
        if (!('basis' in e) && !('grade' in e) && !o.estimate_grade) add('warning', oid, 'effect on ' + code + ' at ' + unit + ' carries no basis or grade');
        if (tree && LIB.byCode[code].agg === 'system' && tree.byId[unit] && tree.byId[unit].parent && unit !== o.unit) add('warning', oid, code + ' is a system value inherited by ' + unit + '; the effect should be stated at the unit that owns the system');
      });
    });
    if (goals && goals.length && units && admissible(problems)) {
      var al = goalAlignment(options, goals, units);
      (options || []).forEach(function (o) {
        var a = al[o.id || '?'] || {};
        (a.unverified || []).forEach(function (gid) { if ((a.unknown || []).indexOf(gid) < 0) add('warning', o.id || '?', "claims goal '" + gid + "' but no effect on its sheet moves an indicator that goal is measured on, at its unit or beneath it"); });
        Object.keys(a.counter || {}).forEach(function (gid) {
          var codes = {}; a.counter[gid].forEach(function (r) { codes[r.code] = true; });
          add('warning', o.id || '?', 'moves ' + Object.keys(codes).sort().join(', ') + " away from the target of goal '" + gid + "'");
        });
      });
    }
    return problems;
  }
  function validateTerritory(units) {
    var problems = [], by = {};
    function add(sev, id, m) { problems.push({ severity: sev, id: id, message: m }); }
    (units || []).forEach(function (u) {
      if (!u.id) { add('error', '?', 'a unit has no id'); return; }
      if (by[u.id]) add('error', u.id, 'duplicate unit id');
      by[u.id] = u;
    });
    Object.keys(by).forEach(function (uid) {
      var u = by[uid];
      if (u.parent && !by[u.parent]) add('error', uid, "parent '" + u.parent + "' is not in the register");
      ['population', 'area', 'dwellings'].forEach(function (k) { if (!u[k]) add('error', uid, k + ' is missing'); });
      if (!('elderly_share' in u)) add('warning', uid, 'share of residents aged 65 and over not recorded; IC10 reads it as below 10 %');
      var hasChildren = Object.keys(by).some(function (k) { return by[k].parent === uid; });
      Object.keys(u.values || {}).forEach(function (code) {
        var rec = u.values[code];
        if (!LIB.byCode[code]) { add('error', uid, "value for unknown indicator '" + code + "'"); return; }
        if (rec.value === null || rec.value === undefined) return;
        if (['A', 'B', 'C'].indexOf(rec.dq) < 0) add('error', uid, code + ": grade '" + rec.dq + "' is not A, B or C");
        if (!rec.year) add('warning', uid, code + ': no reference year');
        if (!rec.source) add('warning', uid, code + ': no source');
        var basis = DEN_BASIS[code];
        if (basis && basis.key && basis.key !== 'dwellings' && !basis.exact_fallback && !hasChildren && den(u, code) === null)
          add('warning', uid, code + ": the count '" + basis.key + "' is not recorded, so a parent derived from this unit is approximate");
      });
    });
    Object.keys(by).forEach(function (uid) {
      var u = by[uid], kids = Object.keys(by).map(function (k) { return by[k]; }).filter(function (c) { return c.parent === uid; });
      if (!kids.length) return;
      ['population', 'area', 'dwellings'].forEach(function (k) {
        var tot = sum(kids.map(function (c) { return c[k] || 0; })), own = u[k] || 0;
        var fm = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
        if (own && tot > own * 1.0005) add('error', uid, "children's " + k + ' (' + fm(tot) + ") exceed the parent's (" + fm(own) + ')');
        else if (own && tot < own * 0.9995) add('warning', uid, "children's " + k + ' (' + fm(tot) + ") fall short of the parent's (" + fm(own) + '); the difference is uncovered');
      });
    });
    return problems;
  }
  function admissible(problems) { return !problems.some(function (p) { return p.severity === 'error'; }); }

  function appraiseTerritory(units, options, settings) {
    settings = settings || {};
    var readiness = settings.readiness || 'mature', year = settings.year, cfg = settings.cfg || null, params = settings.params || null;
    if (year === undefined) year = null;
    var problems = validateOptions(options, units);
    if (!admissible(problems)) throw new ValidationError(problems.filter(function (p) { return p.severity === 'error'; }).map(function (p) { return p.id + ': ' + p.message; }).join('; '));
    var done = options.filter(function (o) { return o.status === 'complete'; }).map(function (o) { return o.id; });
    if (done.length) throw new ValidationError(done.join(', ') + ': a complete record is already in the baseline and is read by the in-operation stance, not applied again');
    var basePrep = prepareTerritory(units);
    var baseById = basePrep.tree.byId;
    var postUnits = strip(units);
    var ptree = buildTree(postUnits);
    var logs = {};
    var gR = DEFAULTS.readiness_multiplier[readiness]; if (gR === undefined) gR = 1.0;
    var cat = catalysisOf(cfg);
    ptree.bottomUp.forEach(function (id) {
      var u = ptree.byId[id];
      var relevant = options.filter(function (o) { return (o.effects || []).some(function (e) { return e.unit === id; }); });
      var ctx = cat.premium !== 1.0 ? couplingContext(ptree, id, options, cat) : {};
      var r = applyEffects(u, relevant, params, year, [], gR, ctx, cat);
      u.values = r.unit.values;
      logs[id] = r.log;
      var kids = ptree.children[id].map(function (k) { return ptree.byId[k]; });
      if (kids.length) {
        /* version 1.3: a parent holding its own measured value carries the change its children's interventions make
           to the value derived from them, over the parent's own count where it differs from the children's sum */
        var baseKids = ptree.children[id].map(function (k) { return baseById[k]; });
        keys(u.values).forEach(function (code) {
          var rec = u.values[code];
          if (rec.derived || rec.inherited || LIB.byCode[code].agg === 'system' || LIB.byCode[code].agg === 'direct') return;
          if (String(rec.source || '').indexOf('effects of') === 0) {
            /* version 1.4: an option that states the parent's own outcome has stated it; the children's change is the same change seen from below */
            r.log.push(code + ": the options state the parent's own outcome (" + g(rec.value) + '); the change in the children is not added again');
            return;
          }
          var d1 = deriveValue(code, kids), d0 = deriveValue(code, baseKids);
          if (!d1 || !d0 || Math.abs(d1.value - d0.value) < 1e-12) return;
          var change = d1.value - d0.value, own = den(baseById[id], code);
          if (d1.weighting.indexOf('count:') === 0 && own && d0.den && Math.abs(own - d0.den) > 1e-9) change *= d0.den / own;
          var nrec = clone(rec); nrec.value = rec.value + change; nrec.source = (rec.source || '') + '; ' + (change >= 0 ? '+' : '−') + g(Math.abs(change)) + " from children's interventions";
          u.values[code] = nrec;
          r.log.push(code + ': measured value ' + g(rec.value) + ' carries the change ' + (change >= 0 ? '+' : '') + String(Number(change.toPrecision(4))) + ' made by interventions in the children');
        });
        deriveParentValues(u, kids, []);
      }
    });
    passDown(ptree, true);
    var results = {};
    basePrep.tree.bottomUp.forEach(function (id) {
      var res = appraisePrepared(basePrep.tree, baseById[id], ptree.byId[id], options, readiness, cfg, params, year);
      res.log = logs[id] || [];
      results[id] = res;
    });
    return { results: results, tree: basePrep.tree, post_units: ptree.byId, base_units: baseById };
  }

  function yearProfile(units, options, settings, unitId, years) {
    years = years || FULL_EFFECT_YEAR;
    var out = [];
    var base = scoreTerritory(units, settings && settings.cfg).results[unitId];
    out.push({ year: 0, S: base.dims.S.score, R: base.dims.R.score, M: base.dims.M.score, D: base.balance ? base.balance.D : null, L: base.balance ? base.balance.level : null });
    for (var y = 1; y <= years; y++) {
      var s = clone(settings || {}); s.year = y;
      var r = appraiseTerritory(units, options, s).results[unitId].post;
      out.push({ year: y, S: r.dims.S.score, R: r.dims.R.score, M: r.dims.M.score, D: r.balance ? r.balance.D : null, L: r.balance ? r.balance.level : null });
    }
    return out;
  }

  /* Bundle comparison rule of Manual Part 4.8 (version 1.3): set aside bundles that lower an outcome (S or R); set aside
     bundles dominated by another eligible bundle on both outcomes (capability is reported beside); bundles that remove the lag on
     the weaker outcome without opening a new one come first; within each group the balanced performance index B after decides,
     and where two B values differ by less than the near-tie margin the higher coordination degree D ranks first. */
  function rankBundles(entries, cfg) {
    cfg = mergeCfg(cfg);
    var outs = cfg.outcome_dims, out = { ranked: [], set_aside: [] }, elig = [];
    entries.forEach(function (e) {
      var c = e.contribution;
      if (!c.balance) { e.reason = 'not rated'; out.set_aside.push(e); return; }
      var low = outs.filter(function (d) { return c.dims[d].change < -1e-9; });
      if (low.length) { e.reason = 'lowers ' + low.map(function (d) { return LIB.dimName[d].toLowerCase(); }).join(' and '); out.set_aside.push(e); return; }
      elig.push(e);
    });
    var dimsAll = outs.filter(function (d) { return elig.every(function (e) { return e.contribution.dims[d]; }); });   /* version 1.3: outcomes only */
    function after(e, d) { return e.contribution.dims[d].after; }
    var nd = [];
    elig.forEach(function (e) {
      var dom = elig.filter(function (f) { return f !== e && dimsAll.every(function (d) { return after(f, d) >= after(e, d) - 1e-12; }) && dimsAll.some(function (d) { return after(f, d) > after(e, d) + 1e-12; }); });
      if (dom.length) { e.reason = 'dominated by ' + dom.map(function (f) { return f.id; }).join(', '); out.set_aside.push(e); }
      else nd.push(e);
    });
    nd.forEach(function (e) {
      var b = e.contribution.balance;
      var weakest = outs.reduce(function (a, d) { return e.contribution.dims[d].before < e.contribution.dims[a].before ? d : a; }, outs[0]);
      var newLag = b.lagging_after.filter(function (d) { return b.lagging_before.indexOf(d) < 0; });
      e.closes_lag = b.lagging_after.indexOf(weakest) < 0 && !newLag.length;
      e.opens_lag = newLag;
    });
    nd.sort(function (a, b) { return (a.closes_lag ? 0 : 1) - (b.closes_lag ? 0 : 1) || b.contribution.balance.B_after - a.contribution.balance.B_after; });
    var changed = true;
    while (changed) {
      changed = false;
      for (var i = 0; i < nd.length - 1; i++) {
        var a = nd[i], b = nd[i + 1];
        if (a.closes_lag === b.closes_lag && a.contribution.balance.B_after - b.contribution.balance.B_after < cfg.near_tie && b.contribution.balance.D_after > a.contribution.balance.D_after + 1e-12) {
          nd[i] = b; nd[i + 1] = a; b.near_tie = true; changed = true;
        }
      }
    }
    out.ranked = nd;
    return out;
  }
  /* Goals (draft 0.2): the territory's goals in its own words, measured on indicators at a unit, matched to SDG
     targets through the crosswalk. Mirrors goal_sdgs / goal_alignment / goal_contribution / goal_coverage. */
  function sdgOf(code) { var m = SDG_CROSSWALK[code]; if (!m) return null; return { goal: parseInt(m.target.split('.')[0], 10), target: m.target, grade: m.grade }; }
  function goalSdgs(goal) {
    var out = [], seen = {};
    (goal.indicators || []).forEach(function (gi) {
      var m = sdgOf(gi.code);
      if (m && !seen[m.target]) { seen[m.target] = true; out.push({ goal: m.goal, goal_name: SDG_NAMES[String(m.goal)] || '', target: m.target, text: SDG_TARGET_TEXT[m.target] || '', grade: m.grade }); }
    });
    return out.sort(function (a, b) { return a.goal - b.goal || (a.target < b.target ? -1 : a.target > b.target ? 1 : 0); });
  }
  function direction(code) { var i = LIB.byCode[code]; return i.target > i.floor ? 1 : -1; }
  function effectDirection(e, baseline, code) {
    var d = direction(code);
    if ('reduce_by' in e) return e.reduce_by > 0 ? 1 : 0;
    if ('delta' in e) return e.delta === 0 ? 0 : ((e.delta > 0) === (d > 0) ? 1 : -1);
    if ('set' in e && baseline !== null && baseline !== undefined) { var diff = e.set - baseline; return diff === 0 ? 0 : ((diff > 0) === (d > 0) ? 1 : -1); }
    return 0;
  }
  function goalAlignment(options, goals, units) {
    var prep = prepareTerritory(units), tree = prep.tree, by = {};
    prep.units.forEach(function (u) { by[u.id] = u; });
    function beneath(uid, top) { while (uid !== null && uid !== undefined) { if (uid === top) return true; uid = tree.byId[uid] ? tree.byId[uid].parent : null; } return false; }
    var out = {};
    (options || []).forEach(function (o) {
      var claimed = (o.goals || []).slice(), served = {}, counter = {};
      goals.forEach(function (g) {
        (g.indicators || []).forEach(function (gi) {
          (o.effects || []).forEach(function (e) {
            if (e.code !== gi.code || !beneath(e.unit, gi.unit)) return;
            var rec = by[e.unit] && by[e.unit].values ? by[e.unit].values[gi.code] : null, bv = rec ? rec.value : null;
            var dr = effectDirection(e, bv, gi.code);
            if (dr > 0) (served[g.id] = served[g.id] || []).push({ code: gi.code, unit: e.unit });
            else if (dr < 0) (counter[g.id] = counter[g.id] || []).push({ code: gi.code, unit: e.unit });
          });
        });
      });
      var known = {}; goals.forEach(function (g) { known[g.id] = true; });
      out[o.id] = { claimed: claimed, served: served, counter: counter,
        unverified: claimed.filter(function (g) { return !served[g]; }),
        unclaimed: Object.keys(served).filter(function (g) { return claimed.indexOf(g) < 0; }),
        unknown: claimed.filter(function (g) { return !known[g]; }) };
    });
    return out;
  }
  function fullEffectYearOf(option) {
    var prof = LAG_PROFILES[option.lag_class || 'programme'] || LAG_PROFILES.programme, n = prof.length;
    for (var i = 0; i < prof.length; i++) if (prof[i] >= 1.0) { n = i + 1; break; }
    return [option.completion ? option.completion + n : null, n];
  }
  function goalContribution(results, goals, options) {
    var out = [];
    goals.forEach(function (g) {
      var rows = [], served = false, late = false;
      (g.indicators || []).forEach(function (gi) {
        var r = results[gi.unit]; if (!r) return;
        var bi = r.baseline.indicators[gi.code], ai = r.post.indicators[gi.code];
        var b = bi ? bi.value : null, a = ai ? ai.value : null, t = gi.target, d = direction(gi.code);
        if (b === null || b === undefined || a === null || a === undefined) { rows.push({ code: gi.code, unit: gi.unit, before: b, after: a, target: t, share: null, status: 'no value' }); return; }
        var remaining = (t - b) * d, status, share, raw = null, remAfter = null;
        if (remaining <= 1e-12) { status = 'already met'; share = null; }
        else {
          raw = (a - b) * d / remaining;
          if (raw >= 1 - 1e-12) { share = 1.0; status = 'met'; }
          else { share = raw; status = raw > 1e-12 ? 'served' : (raw < -1e-12 ? 'counter' : 'untouched'); }
          served = served || status === 'served' || status === 'met';
          remAfter = Math.max(0, (t - a) * d / remaining);
        }
        rows.push({ code: gi.code, unit: gi.unit, before: b, after: a, target: t, share: share, status: status, raw_share: raw, remaining_after: remAfter });
      });
      var yr = null;
      if (options) {
        var codes = {}; (g.indicators || []).forEach(function (gi) { codes[gi.code] = true; });
        var years = options.filter(function (o) { return (o.effects || []).some(function (e) { return codes[e.code]; }); }).map(function (o) { return fullEffectYearOf(o)[0]; }).filter(function (y) { return y; });
        yr = years.length ? Math.max.apply(null, years) : null;
        late = !!(yr && g.horizon && yr > g.horizon);
      }
      out.push({ id: g.id, statement: g.statement, horizon: g.horizon === undefined ? null : g.horizon, sdgs: goalSdgs(g), indicators: rows, served: served, full_effect_year: yr, late: late });
    });
    return out;
  }
  function goalCoverage(entries, goals) {
    var out = [], servedAny = {};
    entries.forEach(function (e) {
      var gc = {}; e.goal_contribution.forEach(function (g) { gc[g.id] = g; });
      var served = Object.keys(gc).filter(function (k) { return gc[k].served; });
      served.forEach(function (k) { servedAny[k] = true; });
      var shares = {};
      Object.keys(gc).forEach(function (k) { var sh = gc[k].indicators.map(function (r) { return r.share; }).filter(function (x) { return x !== null && x !== undefined; }); shares[k] = sh.length ? Math.min.apply(null, sh) : null; });
      out.push({ id: e.id, served: served, unserved: goals.filter(function (g) { return served.indexOf(g.id) < 0; }).map(function (g) { return g.id; }), shares: shares,
        late: Object.keys(gc).filter(function (k) { return gc[k].late; }) });
    });
    return { bundles: out, unserved_by_all: goals.filter(function (g) { return !servedAny[g.id]; }).map(function (g) { return g.id; }) };
  }

  function costPerPoint(capex, contribution, cfg) {
    cfg = mergeCfg(cfg);
    var pts = sum(cfg.outcome_dims.map(function (d) { return Math.max(0, contribution.dims[d].change) * 100; }));
    return pts > 0 ? capex / pts : null;
  }

  // ---------- version 1.4: the alignment chain and the money view (port of srs_chain.py) ----------
  var NOT_VALUED = 'not yet valued by the territory';
  var PER_100K_ITEMS = { SE7: 'homicide avoided', EC3: 'business', EC4: 'patent', IF4: 'citizen engaged', DG5: 'portal visit', RD7: 'shelter place' };
  var UNIT_ITEMS = { RD1: 'supply source', RD2: 'supply source', DG3: 'hour of downtime', RP6: 'year of recovery', SE2: 'index unit' };
  var VALUED_TEXT = {};
  var SINGULAR = { labour_force: 'member of the labour force', youth_labour_force: 'young member of the labour force', commuters: 'commuter', signalised_intersections: 'intersection', luminaires: 'luminaire', critical_facilities: 'facility', hospitals: 'hospital', neighbourhoods: 'neighbourhood', waste_collected_tonnes: 'tonne', businesses_started: 'business', registered_voters: 'voter' };
  function setValuedText(t) { VALUED_TEXT = clone(t || {}); }
  function scaleOf(code) {
    var i = LIB.byCode[code], unit = i.unit, basis = DEN_BASIS[code] || {}, key = basis.key || null;
    if (unit.indexOf('per person') >= 0 || ((unit === 'µg/m³' || unit === 'minutes' || unit === 'years') && i.agg === 'popw')) return { scale: 'population', count: null, fallback: null, per: 'per person' };
    if (unit.indexOf('per 100,000') >= 0) return { scale: 'population_per_100k', count: null, fallback: null, per: 'per ' + (PER_100K_ITEMS[code] || 'item') };
    if (unit === 'hours per household per year') return { scale: 'count', count: 'households', fallback: 'dwellings', per: 'per household-hour' };
    if (unit === 'jobs per dwelling') return { scale: 'dwellings', count: null, fallback: null, per: 'per job' };
    if (unit === 'stations per km²') return { scale: 'area', count: null, fallback: null, per: 'per station' };
    if (unit.indexOf('% of ') === 0) {
      var thing = unit.slice(5);
      if (thing === 'population') return { scale: 'population_share', count: null, fallback: null, per: 'per person' };
      if (thing === 'land area' || thing === 'high-risk land area') {
        if (key) return { scale: 'count_share', count: key, fallback: 'area_share', per: 'per km²' };
        return { scale: 'area_share', count: null, fallback: null, per: 'per km²' };
      }
      if (['residential properties', 'properties', 'buildings', 'residential buildings', 'dwellings'].indexOf(thing) >= 0) {
        var per = 'per ' + ({ 'residential properties': 'property', properties: 'property', buildings: 'building', 'residential buildings': 'building', dwellings: 'dwelling' }[thing]);
        if (key && key !== 'dwellings') return { scale: 'count_share', count: key, fallback: 'dwellings_share', per: per };
        return { scale: 'dwellings_share', count: null, fallback: null, per: per };
      }
      if (key && key !== 'dwellings') {
        var fb = { popw: 'population_share', dwellw: 'dwellings_share', areaw: 'area_share' }[basis.fallback] || 'population_share';
        return { scale: 'count_share', count: key, fallback: fb, per: 'per ' + (SINGULAR[key] || key) };
      }
      if (i.agg === 'system' || i.agg === 'direct') return { scale: 'unit', count: null, fallback: null, per: 'per percentage point' };
      return { scale: 'population_share', count: null, fallback: null, per: 'per person' };
    }
    if (unit === '%') return { scale: 'unit', count: null, fallback: null, per: 'per percentage point' };
    return { scale: 'unit', count: null, fallback: null, per: 'per ' + (UNIT_ITEMS[code] || unit) };
  }
  function quantityOf(unit, code) {
    var s = scaleOf(code), pop = unit.population || 0, dw = unit.dwellings || 0, area = unit.area || 0, dens = unit.denominators || {};
    var fmt0 = function (x) { return thousands(Math.round(x)); };
    var spaced = function (k) { return k.replace(/_/g, ' '); };
    switch (s.scale) {
      case 'population': return { quantity: pop, text: fmt0(pop) + ' residents', approximate: false };
      case 'population_share': return { quantity: pop / 100, text: fmt0(pop) + ' residents ÷ 100', approximate: false };
      case 'population_per_100k': return { quantity: pop / 100000, text: fmt0(pop) + ' residents ÷ 100,000', approximate: false };
      case 'dwellings': return { quantity: dw, text: fmt0(dw) + ' dwellings', approximate: false };
      case 'dwellings_share': return { quantity: dw / 100, text: fmt0(dw) + ' dwellings ÷ 100', approximate: false };
      case 'area': return { quantity: area, text: fmt0(area) + ' km²', approximate: false };
      case 'area_share': return { quantity: area / 100, text: fmt0(area) + ' km² ÷ 100', approximate: false };
      case 'count':
        if (dens[s.count] !== undefined) return { quantity: dens[s.count], text: fmt0(dens[s.count]) + ' ' + spaced(s.count), approximate: false };
        return { quantity: dw, text: fmt0(dw) + ' dwellings (no count of ' + spaced(s.count) + ' recorded)', approximate: true };
      case 'count_share':
        if (dens[s.count] !== undefined) return { quantity: dens[s.count] / 100, text: fmt0(dens[s.count]) + ' ' + spaced(s.count) + ' ÷ 100', approximate: false };
        var fb = { population_share: [pop / 100, fmt0(pop) + ' residents ÷ 100'], dwellings_share: [dw / 100, fmt0(dw) + ' dwellings ÷ 100'], area_share: [area / 100, fmt0(area) + ' km² ÷ 100'] }[s.fallback];
        return { quantity: fb[0], text: fb[1] + ' (no count of ' + spaced(s.count) + ' recorded)', approximate: true };
      default: return { quantity: 1, text: 'the unit as a whole', approximate: false };
    }
  }
  function defaultField(code, fields) {
    var sub = LIB.byCode[code].sub;
    for (var k = 0; k < (fields || []).length; k++) if ((fields[k].subs || []).indexOf(sub) >= 0) return fields[k].id;
    return LIB.subOf[sub].dim;
  }
  function valueLibraryTemplate(fields, currency, priceYear) {
    return LIB.indicators.map(function (i) {
      var s = scaleOf(i.code);
      return { code: i.code, name: i.name, valued: VALUED_TEXT[i.code] || ('One unit of change in ' + i.name.toLowerCase()), change_unit: i.unit, scale: s.scale, count: s.count, per: s.per,
        direction: i.target > i.floor ? 1 : -1, field: defaultField(i.code, fields), currency: currency || null, price_year: priceYear || null,
        value: null, low: null, high: null, basis: null, grade: null, illustrative: false };
    });
  }
  function libraryByCode(library) { var o = {}; (library || []).forEach(function (e) { o[e.code] = e; }); return o; }
  function entryStatus(e) {
    if (!e || e.value === null || e.value === undefined) return NOT_VALUED;
    return e.illustrative ? 'illustrative value' : 'valued by the territory';
  }
  function validateValueLibrary(library, fields) {
    var probs = [], seen = {}, fieldIds = {};
    (fields || []).forEach(function (f) { fieldIds[f.id] = true; }); LIB.dims.forEach(function (d) { fieldIds[d] = true; });
    var add = function (sev, id, msg) { probs.push({ severity: sev, id: id, message: msg }); };
    (library || []).forEach(function (e) {
      var c = e.code;
      if (!LIB.byCode[c]) { add('error', c, 'unknown indicator'); return; }
      if (seen[c]) add('error', c, 'duplicate entry');
      seen[c] = true;
      if (e.field && !fieldIds[e.field]) add('error', c, 'unknown field ' + e.field);
      var v = e.value;
      if (v === null || v === undefined) return;
      if (v < 0) add('error', c, 'a value below zero; the direction of the change is read from the indicator, not from the sign of the value');
      if (!e.basis) add('error', c, 'a value without the basis the territory will cite');
      if (['A', 'B', 'C'].indexOf(e.grade) < 0) add('error', c, 'a value without a grade');
      if (!e.price_year) add('warning', c, 'a value without a price year');
      var lo = e.low, hi = e.high;
      if ((lo !== null && lo !== undefined && lo > v) || (hi !== null && hi !== undefined && hi < v)) add('error', c, 'the range does not contain the value');
      if (lo === null || lo === undefined || hi === null || hi === undefined) add('warning', c, 'a value without a range');
      if (e.illustrative) add('warning', c, "an illustrative value in use; to be replaced by the territory's own");
    });
    return probs;
  }
  function capexProfile(option) {
    var capex = option.capex_m; if (capex === null || capex === undefined) return {};
    var end = option.completion; if (!end) return { 'null': capex };
    var start = option.start || end, lo = Math.min(start, end), out = {}, n = end - lo + 1;
    for (var y = lo; y <= end; y++) out[y] = capex / n;
    return out;
  }
  function opexProfile(option, baseYear, horizonYears) {
    var opex = option.opex_m, out = {};
    if (!opex || !option.completion) return out;
    for (var y = option.completion + 1; y < baseYear + horizonYears; y++) out[y] = opex;
    return out;
  }
  function discount(amount, year, baseYear, rate) { return amount / Math.pow(1 + rate, Math.max(0, year - baseYear)); }
  function investmentOf(options, baseYear, horizonYears, rate) {
    /* a negative operating cost is an operating saving to the authority, kept apart from the cost and reported on the value side */
    var lines = [], capexBy = {}, opexBy = {}, savingBy = {}, unphased = [];
    options.forEach(function (o) {
      var cp = capexProfile(o);
      keys(cp).forEach(function (y) {
        if (y === 'null') { unphased.push(o.id); return; }
        var yy = parseInt(y, 10); capexBy[yy] = (capexBy[yy] || 0) + cp[y]; lines.push({ project: o.id, year: yy, capex: cp[y], opex: 0, saving: 0 });
      });
      var op = opexProfile(o, baseYear, horizonYears);
      keys(op).forEach(function (y) {
        var yy = parseInt(y, 10);
        if (op[y] >= 0) { opexBy[yy] = (opexBy[yy] || 0) + op[y]; lines.push({ project: o.id, year: yy, capex: 0, opex: op[y], saving: 0 }); }
        else { savingBy[yy] = (savingBy[yy] || 0) - op[y]; lines.push({ project: o.id, year: yy, capex: 0, opex: 0, saving: -op[y] }); }
      });
    });
    var capex = sum(options.map(function (o) { return o.capex_m || 0; }));
    var pvCapex = sum(keys(capexBy).map(function (y) { return discount(capexBy[y], parseInt(y, 10), baseYear, rate); }));
    var pvOpex = sum(keys(opexBy).map(function (y) { return discount(opexBy[y], parseInt(y, 10), baseYear, rate); }));
    var pvSaving = sum(keys(savingBy).map(function (y) { return discount(savingBy[y], parseInt(y, 10), baseYear, rate); }));
    return { projects: options.map(function (o) { return o.id; }), capex: capex, opex_per_year: sum(options.map(function (o) { return Math.max(0, o.opex_m || 0); })),
      saving_per_year: sum(options.map(function (o) { return Math.max(0, -(o.opex_m || 0)); })), saving_projects: options.filter(function (o) { return (o.opex_m || 0) < 0; }).map(function (o) { return o.id; }),
      capex_by_year: capexBy, opex_by_year: opexBy, saving_by_year: savingBy, pv_capex: pvCapex, pv_opex: pvOpex, pv_saving: pvSaving, pv_cost: pvCapex + pvOpex, lines: lines, unphased: unphased };
  }
  function changedCodes(stripped, relevant, gR, coupling, catalysis) {
    var nu = applyEffects(stripped, relevant, null, null, [], gR, coupling, catalysis).unit, out = {};
    keys(nu.values).forEach(function (c) { if (String(nu.values[c].source || '').indexOf('effects of') === 0) out[c] = nu.values[c]; });
    return out;
  }
  function descendants(tree, uid) { var out = []; (tree.children[uid] || []).forEach(function (k) { out.push(k); out = out.concat(descendants(tree, k)); }); return out; }
  function outcomeLines(units, options, readiness, baseYear, years, catalysis) {
    var prep = prepareTerritory(units), tree = prep.tree, baseBy = tree.byId;
    var strippedList = strip(units), stripped = {}; strippedList.forEach(function (u) { stripped[u.id] = u; });
    var gR = DEFAULTS.readiness_multiplier[readiness || 'mature']; if (gR === undefined) gR = 1.0;
    var cat = catalysis ? catalysisOf({ catalysis: catalysis }) : catalysisOf(null);   /* version 1.5: the lines carry the catalysed effects the appraisal applies */
    var ptree = buildTree(strippedList);
    var lines = [], codesAt = {};
    tree.bottomUp.forEach(function (uid) {
      var relevant = options.filter(function (o) { return (o.effects || []).some(function (e) { return e.unit === uid; }); });
      if (!relevant.length) return;
      var ctx = cat.premium !== 1.0 ? couplingContext(ptree, uid, options, cat) : {};
      var changed = changedCodes(stripped[uid], relevant, gR, ctx, cat);
      codesAt[uid] = keys(changed);
      var paths = {};
      if (years) years.forEach(function (y) {
        var nu = applyEffects(stripped[uid], relevant, null, y, [], gR, ctx, cat).unit;
        keys(changed).forEach(function (c) { (paths[c] = paths[c] || {})[y] = nu.values[c].value; });
      });
      keys(changed).sort().forEach(function (c) {
        var rec = changed[c], v0 = baseBy[uid].values[c].value, ind = LIB.byCode[c], d = ind.target > ind.floor ? 1 : -1;
        var srcs = relevant.filter(function (o) { return (o.effects || []).some(function (e) { return e.unit === uid && e.code === c; }); }).map(function (o) { return o.id; });
        var effects = [];
        relevant.forEach(function (o) { (o.effects || []).forEach(function (e) { if (e.unit === uid && e.code === c) { var x = { project: o.id }; ['set', 'delta', 'reduce_by'].forEach(function (k) { if (e[k] !== undefined) x[k] = e[k]; }); effects.push(x); } }); });
        var path = null;
        if (years) { path = {}; years.forEach(function (y) { path[y] = (paths[c][y] - v0) * d; }); }
        lines.push({ unit: uid, unit_name: baseBy[uid].name, level: baseBy[uid].level, code: c, name: ind.name, sub: ind.sub, dim: LIB.subOf[ind.sub].dim,
          before: v0, after: rec.value, change: rec.value - v0, improvement: (rec.value - v0) * d, direction: d, projects: srcs, effects: effects, path: path, counted_below: false });
      });
    });
    lines.forEach(function (ln) {
      var desc = descendants(tree, ln.unit), at = desc.filter(function (k) { return (codesAt[k] || []).indexOf(ln.code) >= 0; });
      if (at.length) { ln.counted_below = true; ln.counted_at = at; }
    });
    return { lines: lines, tree: tree, base_by: baseBy };
  }
  function within(baseBy, uid, top) { while (uid !== null && uid !== undefined) { if (uid === top) return true; uid = baseBy[uid] ? baseBy[uid].parent : null; } return false; }
  function valueLines(lines, library, baseBy, baseYear, horizonYears, rate, goals, fields) {
    var lib = libraryByCode(library), years = []; for (var y = baseYear; y < baseYear + horizonYears; y++) years.push(y);
    lines.forEach(function (ln) {
      var e = lib[ln.code] || null;
      ln.field = (e && e.field) || defaultField(ln.code, fields);
      ln.goals = (goals || []).filter(function (gl) { return (gl.indicators || []).some(function (gi) { return gi.code === ln.code && within(baseBy, ln.unit, gi.unit); }); }).map(function (gl) { return gl.id; });
      ln.status = ln.counted_below ? 'counted below' : entryStatus(e);
      var q = quantityOf(baseBy[ln.unit], ln.code);
      ln.quantity = q.quantity; ln.quantity_text = q.text; ln.approximate = q.approximate; ln.per = (e || scaleOf(ln.code)).per;
      if (ln.counted_below || !e || e.value === null || e.value === undefined) { ln.value_per = null; ln.annual = null; ln.pv = null; ln.by_year = null; return; }
      var v = { low: (e.low !== null && e.low !== undefined) ? e.low : e.value, central: e.value, high: (e.high !== null && e.high !== undefined) ? e.high : e.value };
      ln.value_per = v; ln.value_grade = e.grade || null; ln.illustrative = !!e.illustrative;
      ln.annual = {}; keys(v).forEach(function (k) { ln.annual[k] = ln.improvement * q.quantity * v[k] / 1e6; });
      var byYear = {};
      years.forEach(function (yy) { byYear[yy] = {}; keys(v).forEach(function (k) { byYear[yy][k] = (ln.path ? (ln.path[yy] || 0) : ln.improvement) * q.quantity * v[k] / 1e6; }); });
      ln.by_year = byYear;
      ln.pv = {}; keys(v).forEach(function (k) { ln.pv[k] = sum(years.map(function (yy) { return discount(byYear[yy][k], yy, baseYear, rate); })); });
    });
    return lines;
  }
  function sumPv(lines, key, val) {
    var sel = lines.filter(function (ln) { if (key === undefined || key === null) return true; var x = ln[key]; return x === val || (Array.isArray(x) && x.indexOf(val) >= 0); });
    var valued = sel.filter(function (ln) { return ln.pv; });
    var tot = { low: 0, central: 0, high: 0 }, annual = { low: 0, central: 0, high: 0 };
    valued.forEach(function (ln) { keys(tot).forEach(function (k) { tot[k] += ln.pv[k]; annual[k] += ln.annual[k]; }); });
    return { pv: tot, annual_at_full_effect: annual, valued_lines: valued.map(function (ln) { return [ln.unit, ln.code]; }),
      unvalued_lines: sel.filter(function (ln) { return ln.status === NOT_VALUED; }).map(function (ln) { return [ln.unit, ln.code]; }),
      counted_below: sel.filter(function (ln) { return ln.counted_below; }).map(function (ln) { return [ln.unit, ln.code]; }),
      illustrative: valued.some(function (ln) { return ln.illustrative; }), approximate: valued.some(function (ln) { return ln.approximate; }) };
  }
  function valueBy(lines, key, ks) { var o = {}; ks.forEach(function (k) { o[k] = sumPv(lines, key, k); }); return o; }
  function byYearTotals(lines, years) {
    var out = {};
    years.forEach(function (y) { out[y] = { low: 0, central: 0, high: 0 }; lines.forEach(function (ln) { if (ln.by_year) keys(out[y]).forEach(function (k) { out[y][k] += ln.by_year[y][k]; }); }); });
    return out;
  }
  function investmentAgainstValue(inv, lines, baseYear, horizonYears) {
    var years = []; for (var y = baseYear; y < baseYear + horizonYears; y++) years.push(y);
    var val = sumPv(lines), cost = inv.pv_cost, sav = inv.pv_saving, pvValue = {};
    keys(val.pv).forEach(function (k) { pvValue[k] = val.pv[k] + sav; });
    var out = { pv_cost: cost, pv_capex: inv.pv_capex, pv_opex: inv.pv_opex, capex: inv.capex, pv_outcomes: val.pv, pv_saving: sav, saving_projects: inv.saving_projects, pv_value: pvValue, net: {}, ratio: {},
      unvalued_lines: val.unvalued_lines, n_valued: val.valued_lines.length, illustrative: val.illustrative, approximate: val.approximate };
    keys(pvValue).forEach(function (k) { out.net[k] = pvValue[k] - cost; out.ratio[k] = cost > 0 ? pvValue[k] / cost : null; });
    var vy = byYearTotals(lines, years), cumV = 0, cumC = 0, pay = null, costBy = {};
    years.forEach(function (yy) { keys(vy[yy]).forEach(function (k) { vy[yy][k] += inv.saving_by_year[yy] || 0; }); });
    years.forEach(function (yy) {
      cumV += vy[yy].central; var cy = (inv.capex_by_year[yy] || 0) + (inv.opex_by_year[yy] || 0); cumC += cy; costBy[yy] = cy;
      if (pay === null && cumC > 0 && cumV >= cumC) pay = yy;
    });
    out.payback_year = pay; out.value_by_year = vy; out.cost_by_year = costBy;
    return out;
  }
  function validateProgrammes(programmes, options, portfolio, goals) {
    var probs = [], add = function (sev, id, msg) { probs.push({ severity: sev, id: id, message: msg }); };
    var optIds = {}; options.forEach(function (o) { optIds[o.id] = true; });
    var seen = {}, sgIds = {}, goalIds = {};
    ((portfolio || {}).strategic_goals || []).forEach(function (sg) { sgIds[sg.id] = true; });
    (goals || []).forEach(function (gl) { goalIds[gl.id] = true; });
    (programmes || []).forEach(function (pg) {
      (pg.projects || []).forEach(function (pid) {
        if (!optIds[pid]) add('error', pg.id, 'names a project record that does not exist: ' + pid);
        else if (seen[pid]) add('error', pg.id, pid + ' is also in programme ' + seen[pid]);
        seen[pid] = pg.id;
      });
      if (!(pg.strategic_goals || []).length) add('warning', pg.id, 'serves no strategic goal of the portfolio');
      (pg.strategic_goals || []).forEach(function (sg) { if (!sgIds[sg]) add('error', pg.id, 'names a strategic goal the portfolio does not state: ' + sg); });
      if (!pg.owner) add('warning', pg.id, 'no owner recorded');
    });
    if (portfolio) {
      var pgIds = {}; (programmes || []).forEach(function (pg) { pgIds[pg.id] = true; });
      (portfolio.programmes || []).forEach(function (pgid) { if (!pgIds[pgid]) add('error', portfolio.id, 'names a programme that does not exist: ' + pgid); });
      var served = {}; (programmes || []).forEach(function (pg) { (pg.strategic_goals || []).forEach(function (sg) { served[sg] = true; }); });
      (portfolio.strategic_goals || []).forEach(function (sg) {
        if (!goalIds[sg.city_goal]) add('error', sg.id, 'names a city goal that does not exist: ' + sg.city_goal);
        if (!served[sg.id]) add('warning', sg.id, 'no programme serves this strategic goal');
        var c = sg.commitment;
        if (c !== null && c !== undefined && !(c > 0 && c <= 1)) add('warning', sg.id, 'commitment ' + c + ' is outside (0, 1]');
      });
    }
    options.forEach(function (o) { if (!seen[o.id] && (o.status || 'candidate') !== 'candidate') add('warning', o.id, 'an approved project record in no programme'); });
    return probs;
  }
  function sortPairs(ps) { return ps.slice().sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0; }); }
  function shareOf(gc, gid) {
    var gl = null; gc.forEach(function (x) { if (x.id === gid) gl = x; });
    if (!gl) return null;
    var shares = gl.indicators.map(function (r) { return r.share; }).filter(function (x) { return x !== null && x !== undefined; });
    if (!shares.length) return null;
    var m = Math.min.apply(null, shares);
    return Math.abs(m) < 1e-12 ? 0 : m;
  }
  function rowsOf(gc, gid) { var gl = null; gc.forEach(function (x) { if (x.id === gid) gl = x; }); return gl ? gl.indicators : []; }
  function topOf(tree) { return tree.roots[0] || null; }
  function chain(units, options, goals, programmes, portfolio, library, settings) {
    settings = settings || {};
    var readiness = settings.readiness || 'mature', baseYear = settings.base_year || 2026, horizonYears = settings.horizon_years || 30, rate = settings.discount_rate === undefined ? 0.05 : settings.discount_rate;
    var envelope = settings.envelope || null, fields = settings.fields || null;
    var opt = {}; options.forEach(function (o) { opt[o.id] = o; });
    var years = []; for (var y = baseYear; y < baseYear + horizonYears; y++) years.push(y);
    var probs = validateProgrammes(programmes, options, portfolio, goals).concat(validateValueLibrary(library, fields));
    var pfGoals = portfolio.strategic_goals || [], pfHorizon = portfolio.horizon || baseYear + 5;
    var sgBy = {}; pfGoals.forEach(function (sg) { sgBy[sg.id] = sg; });
    var pgBy = {}; programmes.forEach(function (pg) { pgBy[pg.id] = pg; });
    var progOf = {}; programmes.forEach(function (pg) { (pg.projects || []).forEach(function (pid) { progOf[pid] = pg.id; }); });
    var align = goalAlignment(options, goals, units);
    function level(ids, label, unit) {
      var opts = ids.filter(function (i) { return opt[i]; }).map(function (i) { return opt[i]; });
      var ol = outcomeLines(units, opts, readiness, baseYear, years, settings.catalysis || null);
      valueLines(ol.lines, library, ol.base_by, baseYear, horizonYears, rate, goals, fields);
      var inv = investmentOf(opts, baseYear, horizonYears, rate), comp = investmentAgainstValue(inv, ol.lines, baseYear, horizonYears);
      var resFull = appraiseTerritory(units, opts, { readiness: readiness, year: null }).results;
      var gcFull = goalContribution(resFull, goals, opts);
      var resH = appraiseTerritory(units, opts, { readiness: readiness, year: pfHorizon }).results;
      var gcH = goalContribution(resH, goals, opts);
      var fieldIds = []; ol.lines.forEach(function (ln) { if (fieldIds.indexOf(ln.field) < 0) fieldIds.push(ln.field); }); fieldIds.sort();
      var top = topOf(ol.tree);
      return { id: label, projects: opts.map(function (o) { return o.id; }), lines: ol.lines, investment: inv, comparison: comp, goal_contribution: gcFull, goal_contribution_at_horizon: gcH, results: resFull,
        value_by_field: valueBy(ol.lines, 'field', fieldIds), value_by_goal: valueBy(ol.lines, 'goals', goals.map(function (gl) { return gl.id; })), value_by_dimension: valueBy(ol.lines, 'dim', LIB.dims.slice()),
        checks_unit: (unit && resFull[unit]) ? unit : top,
        checks: (unit && resFull[unit]) ? resFull[unit].notes : ((top && resFull[top]) ? resFull[top].notes : []) };
    }
    var projects = {};
    options.forEach(function (o) {
      var pgid = progOf[o.id] || null, sgs = pgid ? (pgBy[pgid].strategic_goals || []) : [], lv = level([o.id], o.id, o.unit), a = align[o.id];
      var served = keys(a.served).sort(), counter = keys(a.counter).sort();
      projects[o.id] = lv;
      lv.name = o.name; lv.unit = o.unit; lv.programme = pgid; lv.strategic_goals = sgs; lv.city_goals_claimed = a.claimed; lv.city_goals_served = served; lv.counter = counter;
      lv.unverified = a.unverified; lv.unclaimed = a.unclaimed; lv.capex = o.capex_m === undefined ? null : o.capex_m; lv.opex = o.opex_m === undefined ? null : o.opex_m;
      lv.start = o.start || null; lv.completion = o.completion || null; lv.status = o.status || 'candidate'; lv.basis = o.basis || null; lv.estimate_grade = o.estimate_grade || null;
      lv.record_problems = validateOptions([o], units, goals);
    });
    var progs = {};
    programmes.forEach(function (pg) {
      var lv = level(pg.projects || [], pg.id, pg.unit || portfolio.unit), ownSum = { low: 0, central: 0, high: 0 };
      (pg.projects || []).forEach(function (p) { if (projects[p]) keys(ownSum).forEach(function (k) { ownSum[k] += projects[p].comparison.pv_value[k]; }); });
      var sgRows = [];
      (pg.strategic_goals || []).forEach(function (sgid) {
        var sg = sgBy[sgid]; if (!sg) return;
        sgRows.push({ id: sgid, city_goal: sg.city_goal, statement: sg.statement, share_full: shareOf(lv.goal_contribution, sg.city_goal), share_horizon: shareOf(lv.goal_contribution_at_horizon, sg.city_goal),
          commitment: sg.commitment === undefined ? null : sg.commitment, projects: (pg.projects || []).filter(function (p) { return projects[p] && projects[p].city_goals_served.indexOf(sg.city_goal) >= 0; }) });
      });
      var unaligned = sortPairs(lv.lines.filter(function (ln) { return !ln.goals.length && ln.improvement > 1e-12 && !ln.counted_below; }).map(function (ln) { return [ln.unit, ln.code]; }));
      progs[pg.id] = lv;
      lv.name = pg.name; lv.owner = pg.owner || null; lv.unit = pg.unit || null; lv.strategic_goals = sgRows; lv.sum_of_projects_pv = ownSum;
      lv.overlap = {}; keys(ownSum).forEach(function (k) { lv.overlap[k] = ownSum[k] - lv.comparison.pv_value[k]; });
      lv.unaligned_outcomes = unaligned; lv.outcomes_declared = pg.outcomes || [];
    });
    var allIds = []; (portfolio.programmes || []).forEach(function (pgid) { if (pgBy[pgid]) allIds = allIds.concat(pgBy[pgid].projects || []); });
    var pf = level(allIds, portfolio.id, portfolio.unit), sumPg = { low: 0, central: 0, high: 0 };
    (portfolio.programmes || []).forEach(function (pgid) { if (progs[pgid]) keys(sumPg).forEach(function (k) { sumPg[k] += progs[pgid].comparison.pv_value[k]; }); });
    var sgRows2 = [];
    pfGoals.forEach(function (sg) {
      var gid = sg.city_goal, serving = (portfolio.programmes || []).filter(function (pgid) { return pgBy[pgid] && (pgBy[pgid].strategic_goals || []).indexOf(sg.id) >= 0; });
      var shFull = shareOf(pf.goal_contribution, gid), shH = shareOf(pf.goal_contribution_at_horizon, gid), c = sg.commitment === undefined ? null : sg.commitment;
      var status = (shFull === null || shFull <= 1e-12) ? 'unserved' : (c !== null && shH !== null && shH >= c - 1e-9) ? 'commitment met at the horizon' : (c !== null && shFull !== null && shFull >= c - 1e-9) ? 'commitment met at full effect' : (c !== null ? 'short of the commitment' : 'served');
      var gcx = null; pf.goal_contribution.forEach(function (x) { if (x.id === gid) gcx = x; });
      sgRows2.push({ id: sg.id, city_goal: gid, statement: sg.statement, commitment: c, share_full: shFull, share_horizon: shH, status: status, programmes: serving,
        projects: allIds.filter(function (p) { return projects[p].city_goals_served.indexOf(gid) >= 0; }), rows: rowsOf(pf.goal_contribution, gid), rows_horizon: rowsOf(pf.goal_contribution_at_horizon, gid),
        late: gcx ? gcx.late : false, full_effect_year: gcx ? gcx.full_effect_year : null });
    });
    var env = null;
    if (envelope) {
      var by = envelope.by_year || {}, committed = pf.investment.capex_by_year, yrs = {};
      keys(by).forEach(function (k) { yrs[k] = true; }); keys(committed).forEach(function (k) { yrs[k] = true; });
      var ys = keys(yrs).map(function (k) { return parseInt(k, 10); }).sort(function (a, b) { return a - b; });
      env = { by_year: {}, total_envelope: sum(keys(by).map(function (k) { return by[k]; })), total_committed: sum(keys(committed).map(function (k) { return committed[k]; })), over_in: [], outside_envelope: [] };
      ys.forEach(function (yy) { var e = by[yy] || 0, cm = committed[yy] || 0; env.by_year[yy] = { envelope: e, committed: cm, headroom: e - cm }; if (cm > e + 1e-9) env.over_in.push(yy); });
      keys(committed).forEach(function (k) { if (by[k] === undefined) env.outside_envelope.push(parseInt(k, 10)); });
    }
    var interaction = {}; keys(sumPg).forEach(function (k) { interaction[k] = pf.comparison.pv_value[k] - sumPg[k]; });
    pf.name = portfolio.name; pf.owner = portfolio.owner || null; pf.unit = portfolio.unit || null; pf.horizon = pfHorizon; pf.programmes = portfolio.programmes || [];
    pf.strategic_goals = sgRows2; pf.sum_of_programmes_pv = sumPg; pf.interaction = interaction; pf.envelope = env;
    pf.unaligned_outcomes = sortPairs(pf.lines.filter(function (ln) { return !ln.goals.length && ln.improvement > 1e-12 && !ln.counted_below; }).map(function (ln) { return [ln.unit, ln.code]; }));
    var cityGoals = [];
    goals.forEach(function (gl) {
      var sgs = pfGoals.filter(function (sg) { return sg.city_goal === gl.id; }).map(function (sg) { return sg.id; });
      var row = null; sgRows2.forEach(function (r) { if (r.city_goal === gl.id) row = r; });
      var gcx = null; pf.goal_contribution.forEach(function (x) { if (x.id === gl.id) gcx = x; });
      cityGoals.push({ id: gl.id, statement: gl.statement, horizon: gl.horizon === undefined ? null : gl.horizon, sdgs: goalSdgs(gl), strategic_goals: sgs, adopted: sgs.length > 0,
        served: !!(gcx && gcx.served), late: !!(gcx && gcx.late), full_effect_year: gcx ? gcx.full_effect_year : null, share_full: shareOf(pf.goal_contribution, gl.id), share_horizon: shareOf(pf.goal_contribution_at_horizon, gl.id),
        status: row ? row.status : ((gcx && gcx.served) ? 'served, not adopted by the portfolio' : 'not adopted, unserved'),
        programmes: row ? row.programmes : [], projects: allIds.filter(function (p) { return projects[p].city_goals_served.indexOf(gl.id) >= 0; }),
        value: pf.value_by_goal[gl.id] || null, rows: gcx ? gcx.indicators : [] });
    });
    var city = { goals: cityGoals, unserved: cityGoals.filter(function (gl) { return !gl.served; }).map(function (gl) { return gl.id; }), not_adopted: cityGoals.filter(function (gl) { return !gl.adopted; }).map(function (gl) { return gl.id; }),
      value_by_field: pf.value_by_field, value_by_dimension: pf.value_by_dimension, comparison: pf.comparison, envelope: env,
      library_status: { valued: library.filter(function (e) { return e.value !== null && e.value !== undefined; }).map(function (e) { return e.code; }),
        illustrative: library.filter(function (e) { return e.illustrative && e.value !== null && e.value !== undefined; }).map(function (e) { return e.code; }),
        not_valued_but_moved: (function () { var s = {}; pf.lines.forEach(function (ln) { if (ln.status === NOT_VALUED) s[ln.code] = true; }); return keys(s).sort(); })() } };
    return { projects: projects, programmes: progs, portfolio: pf, city: city, problems: probs,
      parameters: { base_year: baseYear, horizon_years: horizonYears, discount_rate: rate, readiness: readiness, portfolio_horizon: pfHorizon } };
  }
  function traceUp(ch, projectId) {
    var p = ch.projects[projectId], pg = p.programme ? ch.programmes[p.programme] : null;
    var sgs = ch.portfolio.strategic_goals.filter(function (sg) { return p.strategic_goals.indexOf(sg.id) >= 0; });
    var gids = {}; sgs.forEach(function (sg) { gids[sg.city_goal] = true; }); p.city_goals_served.forEach(function (gid) { gids[gid] = true; });
    var gl = keys(gids).sort(), cg = ch.city.goals.filter(function (x) { return gl.indexOf(x.id) >= 0; }), targets = {};
    cg.forEach(function (x) { x.sdgs.forEach(function (s) { targets[s.target] = true; }); });
    return { project: projectId, programme: pg ? pg.id : null, strategic_goals: sgs.map(function (sg) { return sg.id; }), city_goals: gl, sdg_targets: keys(targets).sort() };
  }
  function traceDown(ch, goalId) {
    var gl = null; ch.city.goals.forEach(function (x) { if (x.id === goalId) gl = x; });
    if (!gl) return null;
    return { goal: goalId, strategic_goals: gl.strategic_goals, programmes: gl.programmes, projects: gl.projects,
      lines: ch.portfolio.lines.filter(function (ln) { return ln.goals.indexOf(goalId) >= 0; }).map(function (ln) { return { unit: ln.unit, code: ln.code, projects: ln.projects, improvement: ln.improvement, pv: ln.pv || null }; }) };
  }


  // ---------- version 1.5: effective smartness (alignment, yield, the catalytic ratio) ----------
  var THEME_RE = /ISO 3712[023]\s*(?:cl\.\s*)?(\d+)/;
  var THEME_NAMES = { 5: 'Economy', 6: 'Education', 7: 'Energy', 8: 'Environment and climate change', 9: 'Finance', 10: 'Governance', 11: 'Health', 12: 'Housing',
    13: 'Population and social conditions', 14: 'Recreation', 15: 'Safety', 16: 'Solid waste', 17: 'Sport and culture', 18: 'Telecommunication', 19: 'Transportation',
    20: 'Urban agriculture and food security', 21: 'Urban planning', 22: 'Wastewater', 23: 'Water' };
  var CROSSWALK_C = {
    SS2: [['EN1', 'real-time transit information raises public-transport use and lowers car emissions']],
    SS3: [['EN1', 'unified payment raises public-transport use and lowers car emissions']],
    DI6: [['EN1', 'intelligent intersections cut idling and emissions'], ['EN2', 'intelligent intersections cut idling and particulate emissions'], ['RP3', 'signal priority shortens emergency response']],
    DI1: [['RP1', 'broadband carries warnings to households'], ['EC3', 'connectivity supports business formation'], ['EC6', 'connectivity supports business survival']],
    DI2: [['RP1', 'coverage carries warnings across the territory'], ['RP2', 'coverage carries agency warnings in time']],
    SS6: [['RP1', 'public alerts extend early-warning coverage']],
    SS7: [['SE7', 'managed lighting supports safety']],
    DI3: [['EN1', 'smart metering lowers energy use and emissions']]
  };
  function themeOf(code) { var i = LIB.byCode[code]; if (!i) return null; var m = THEME_RE.exec(i.ref || i.source || ''); return m ? parseInt(m[1], 10) : null; }
  function capabilityCrosswalk() {
    var themes = {}; LIB.indicators.forEach(function (i) { themes[i.code] = themeOf(i.code); });
    var out = {};
    LIB.indicators.forEach(function (i) {
      if (!M_SUBS[i.sub]) return;
      var rows = [], th = themes[i.code];
      LIB.indicators.forEach(function (k) {
        if (M_SUBS[k.sub] || th === null || themes[k.code] !== th) return;
        rows.push({ code: k.code, grade: 'B', basis: ('ISO theme ' + th + ', ' + (THEME_NAMES[th] || '')).replace(/, $/, '') });
      });
      (CROSSWALK_C[i.code] || []).forEach(function (kw) {
        if (LIB.byCode[kw[0]] && !rows.some(function (r) { return r.code === kw[0]; })) rows.push({ code: kw[0], grade: 'C', basis: kw[1] });
      });
      rows.sort(function (a, b) { return a.code < b.code ? -1 : a.code > b.code ? 1 : 0; });
      out[i.code] = rows;
    });
    return out;
  }
  function needsOf(res, cfg) {
    var cf = mergeCfg(cfg), needs = {};
    cf.outcome_dims.forEach(function (d) {
      res.dims[d].subs.forEach(function (sub) {
        if (!res.subs[sub].rated) return;
        var ws = res.subs[sub].weight || 0;
        keys(res.indicators).forEach(function (c) {
          var r = res.indicators[c];
          if (r.sub === sub && r.score !== null && r.score !== undefined) needs[c] = { need: ws * r.weight * (1 - r.score), score: r.score, sub: sub, dim: d };
        });
      });
    });
    return needs;
  }
  function alignment(res, crosswalk, cfg) {
    var cw = crosswalk || capabilityCrosswalk(), needs = needsOf(res, cfg), cap = {};
    keys(res.indicators).forEach(function (c) { var r = res.indicators[c]; if (M_SUBS[r.sub] && r.score !== null && r.score !== undefined) cap[c] = r.score; });
    var serves = {};
    keys(cw).forEach(function (m) { cw[m].forEach(function (r) { (serves[r.code] = serves[r.code] || []).push(m); }); });
    var tot = sum(keys(needs).map(function (k) { return needs[k].need; }));
    var servedSum = 0, coveredSum = 0, unservedSum = 0, detail = [];
    keys(needs).forEach(function (k) {
      var n = needs[k], best = 0.0, bestM = null;
      (serves[k] || []).forEach(function (m) { if (cap[m] !== undefined && cap[m] > best) { best = cap[m]; bestM = m; } });
      servedSum += n.need * best; coveredSum += n.need * (best >= 0.4 ? 1 : 0); if (bestM === null) unservedSum += n.need;
      detail.push({ code: k, sub: n.sub, dim: n.dim, score: n.score, need: n.need, share: tot ? n.need / tot : 0, served_by: bestM, service: best });
    });
    var idleNum = 0, idleDen = 0, idle = [];
    keys(cap).forEach(function (m) {
      var targets = (cw[m] || []).map(function (r) { return r.code; }).filter(function (k) { return needs[k] !== undefined; });
      var isIdle = !targets.length || targets.every(function (k) { return needs[k].score >= 0.6; });
      idleNum += cap[m] * (isIdle ? 1 : 0); idleDen += cap[m]; if (isIdle) idle.push(m);
    });
    detail.sort(function (a, b) { return b.need - a.need; });
    idle.sort();
    return { alignment: tot ? servedSum / tot : null, coverage: tot ? coveredSum / tot : null, unserved: tot ? unservedSum / tot : null, idle: idleDen ? idleNum / idleDen : null, idle_capabilities: idle, needs: detail, capability: cap };
  }
  function alignmentTerritory(units, cfg, crosswalk) {
    var cw = crosswalk || capabilityCrosswalk(), res = scoreTerritory(units, cfg).results, out = {};
    keys(res).forEach(function (u) { out[u] = alignment(res[u], cw, cfg); });
    return out;
  }
  function stockOf(options) { return options.filter(function (o) { return o.status === 'complete'; }); }
  function reaches(record, unitId, tree) {
    if (footprint(tree, unitId, record).length) return true;
    var below = [unitId].concat(descendants(tree, unitId));
    return (record.effects || []).some(function (e) { return below.indexOf(e.unit) >= 0; });
  }
  function removeRealised(units, records, log) {
    log = log || [];
    var us = clone(units), by = {}; us.forEach(function (u) { by[u.id] = u; });
    records.slice().sort(function (a, b) { return (b.completion || 0) - (a.completion || 0); }).forEach(function (o) {
      (o.effects || []).forEach(function (e) {
        var u = by[e.unit];
        if (!u || !u.values || !u.values[e.code]) { log.push(o.id + ': no measured value for ' + e.code + ' at ' + e.unit + '; realised effect ignored'); return; }
        var rec = u.values[e.code];
        if (rec.value === null || rec.value === undefined) { log.push(o.id + ': no measured value for ' + e.code + ' at ' + e.unit + '; realised effect ignored'); return; }
        if (e.delta !== undefined) rec.value = rec.value - e.delta;
        else if (e.set !== undefined && e.before !== undefined && e.before !== null) rec.value = e.before;
        else { log.push(o.id + ': realised effect on ' + e.code + ' at ' + e.unit + ' is not invertible; ignored'); return; }
        rec.source = (rec.source || '') + '; without ' + o.id;
      });
    });
    return us;
  }
  function scoresAt(units, unitId, cfg) {
    var r = scoreTerritory(units, cfg).results[unitId], b = r.balance;
    return { B: b ? b.B : null, S: r.dims.S.score, R: r.dims.R.score, M: r.dims.M.score, res: r };
  }
  function diffScores(a, b) { var o = {}; ['B', 'S', 'R', 'M'].forEach(function (k) { o[k] = (a[k] !== null && a[k] !== undefined && b[k] !== null && b[k] !== undefined) ? a[k] - b[k] : null; }); return o; }
  function zeroScores() { return { B: 0.0, S: 0.0, R: 0.0, M: 0.0 }; }
  function shapley(vD, vP, vDP) {
    var out = {};
    ['B', 'S', 'R'].forEach(function (k) {
      var d = vD[k], p = vP[k], dp = vDP[k];
      if (d === null || d === undefined || p === null || p === undefined || dp === null || dp === undefined) { out[k] = { digital: null, physical: null, alone: null, given_physical: null, interaction: null, kappa: null, total: null }; return; }
      var given = dp - p, phi = 0.5 * (d + given);
      out[k] = { digital: phi, physical: dp - phi, alone: d, given_physical: given, interaction: given - d, kappa: (d > 1e-9 && given > -1e-12) ? given / d : null, total: dp };
    });
    return out;
  }
  function normaliseYield(att, dM, capexD, capexP) {
    var phi = att.B.digital, tot = att.B.total;
    var ptsD = (att.S.digital !== null && att.R.digital !== null) ? att.S.digital + att.R.digital : null;
    var ptsP = (att.S.physical !== null && att.R.physical !== null) ? att.S.physical + att.R.physical : null;
    return { per_capability_point: (phi !== null && dM && Math.abs(dM) > 1e-9) ? phi / dM : null,
      share: (phi !== null && tot !== null && tot !== undefined && tot > 1e-6) ? phi / tot : null,
      cost_per_point_digital: (ptsD && ptsD > 1e-9 && capexD !== null && capexD !== undefined) ? capexD / (ptsD * 100) : null,
      cost_per_point_physical: (ptsP && ptsP > 1e-9 && capexP !== null && capexP !== undefined) ? capexP / (ptsP * 100) : null,
      outcome_points_digital: ptsD, outcome_points_physical: ptsP, capex_digital: capexD, capex_physical: capexP, delta_M: dM };
  }
  function capexOf(records) { return records.length ? sum(records.map(function (o) { return (o.capex_m === null || o.capex_m === undefined) ? 0 : o.capex_m; })) : 0.0; }
  function costed(units, records, unitId) {
    var tree = buildTree(strip(units)), inside = [unitId].concat(descendants(tree, unitId));
    return records.every(function (o) { return inside.indexOf(o.unit) >= 0; });
  }
  function yieldPlanned(units, records, unitId, readiness, year, cfg, params) {
    var recs = records.filter(function (o) { return o.status !== 'complete'; });
    var D = recs.filter(isDigital), P = recs.filter(function (o) { return !isDigital(o); });
    var base = scoresAt(units, unitId, cfg), isCosted = costed(units, recs, unitId);
    var v = function (X) {
      if (!X.length) return zeroScores();
      var r = appraiseTerritory(units, X, { readiness: readiness, year: year, cfg: cfg, params: params }).results[unitId].post, b = r.balance;
      return diffScores({ B: b ? b.B : null, S: r.dims.S.score, R: r.dims.R.score, M: r.dims.M.score }, base);
    };
    var vD = v(D), vP = v(P), vDP = v(recs), att = shapley(vD, vP, vDP);
    return { stance: 'planned', unit: unitId, year: year === undefined ? null : year, readiness: readiness, digital: D.map(function (o) { return o.id; }), physical: P.map(function (o) { return o.id; }),
      attribution: att, normalised: normaliseYield(att, vDP.M, isCosted ? capexOf(D) : null, isCosted ? capexOf(P) : null), delta_M_alone: vD.M };
  }
  function yieldInOperation(units, stock, unitId, cfg) {
    var tree = buildTree(strip(units));
    var O = stock.filter(function (o) { return o.status === 'complete' && reaches(o, unitId, tree); });
    var D = O.filter(isDigital), P = O.filter(function (o) { return !isDigital(o); });
    var base = scoresAt(units, unitId, cfg);
    var r = function (X) { if (!X.length) return zeroScores(); return diffScores(base, scoresAt(removeRealised(units, X), unitId, cfg)); };
    var rD = r(D), rP = r(P), rO = r(O), att = shapley(rD, rP, rO);
    keys(att).forEach(function (k) { att[k].kappa = null; });
    var isCosted = costed(units, O, unitId), cat = catalysisOf(cfg), present = [];
    (cat.couplings || []).forEach(function (c) {
      O.forEach(function (o) { O.forEach(function (q) { if (o !== q && has(tags(o), c.a) && has(tags(q), c.b)) present.push({ a: o.id, b: q.id, coupling: c.a + ' with ' + c.b, subs: c.subs.slice() }); }); });
    });
    return { stance: 'in operation', unit: unitId, digital: D.map(function (o) { return o.id; }), physical: P.map(function (o) { return o.id; }), attribution: att,
      normalised: normaliseYield(att, rD.M, isCosted ? capexOf(D) : null, isCosted ? capexOf(P) : null), couplings_present: present,
      kappa_note: (D.length && P.length) ? 'not separable from realised effects' : (D.length ? 'no physical record in operation' : 'no digital record in operation') };
  }
  function recordReadings(units, programmeRecords, record, unitId, readiness, year, cfg, params) {
    var base = scoresAt(units, unitId, cfg);
    var v = function (X) {
      if (!X.length) return zeroScores();
      var r = appraiseTerritory(units, X, { readiness: readiness, year: year, cfg: cfg, params: params }).results[unitId].post, b = r.balance;
      return diffScores({ B: b ? b.B : null, S: r.dims.S.score, R: r.dims.R.score, M: r.dims.M.score }, base);
    };
    var alone = v([record]), others = programmeRecords.filter(function (o) { return o.id !== record.id; });
    var within = others.length ? diffScores(v(programmeRecords), v(others)) : alone;
    var out = { record: record.id, digital: isDigital(record), unit: unitId, alone: alone, within: within };
    out.kappa = (alone.B && alone.B > 1e-9 && within.B !== null && within.B > -1e-12) ? within.B / alone.B : null;
    return out;
  }
  function smartReadings(units, options, programmes, portfolio, settings) {
    settings = settings || {};
    var readiness = settings.readiness || 'mature', cfg = settings.cfg || null, params = settings.params || null, horizon = settings.horizon || null;
    var tree = buildTree(strip(units)), by = {}; options.forEach(function (o) { by[o.id] = o; });
    var stock = stockOf(options), approved = options.filter(function (o) { return o.status === 'approved' || o.status === 'in delivery'; });
    var cw = capabilityCrosswalk(), out = { crosswalk: cw, units: {}, programmes: {}, portfolio: null, records: {} };
    var baseRes = scoreTerritory(units, cfg).results;
    var postFull = approved.length ? appraiseTerritory(units, approved, { readiness: readiness, year: null, cfg: cfg, params: params }).results : null;
    keys(tree.byId).forEach(function (u) {
      var reach = approved.filter(function (o) { return reaches(o, u, tree); });
      var entry = { name: tree.byId[u].name, level: tree.byId[u].level, alignment: alignment(baseRes[u], cw, cfg),
        alignment_after: postFull ? alignment(postFull[u].post, cw, cfg) : null, in_operation: yieldInOperation(units, stock, u, cfg),
        planned: reach.length ? yieldPlanned(units, reach, u, readiness, null, cfg, params) : null,
        planned_horizon: (reach.length && horizon) ? yieldPlanned(units, reach, u, readiness, horizon, cfg, params) : null };
      var op = entry.in_operation.attribution.B.digital, pl = entry.planned ? entry.planned.attribution.B.digital : 0.0;
      entry.together = (op || 0.0) + (pl || 0.0);
      out.units[u] = entry;
    });
    (programmes || []).forEach(function (pg) {
      var recs = (pg.projects || []).filter(function (i) { return by[i]; }).map(function (i) { return by[i]; });
      out.programmes[pg.id] = { name: pg.name, unit: pg.unit, planned: yieldPlanned(units, recs, pg.unit, readiness, null, cfg, params),
        planned_horizon: horizon ? yieldPlanned(units, recs, pg.unit, readiness, horizon, cfg, params) : null };
      recs.forEach(function (rec) { out.records[rec.id] = recordReadings(units, recs, rec, pg.unit, readiness, null, cfg, params); out.records[rec.id].programme = pg.id; });
    });
    if (portfolio) {
      var ids = [];
      (programmes || []).forEach(function (pg) { if ((portfolio.programmes || []).indexOf(pg.id) >= 0) ids = ids.concat(pg.projects || []); });
      var precs = ids.filter(function (i) { return by[i]; }).map(function (i) { return by[i]; });
      out.portfolio = { id: portfolio.id, unit: portfolio.unit, planned: yieldPlanned(units, precs, portfolio.unit, readiness, null, cfg, params),
        planned_horizon: yieldPlanned(units, precs, portfolio.unit, readiness, portfolio.horizon || null, cfg, params) };
    }
    return out;
  }
  function bundleReadings(units, bundles, readiness, unitId, cfg, params) {
    var out = {}; keys(bundles).forEach(function (name) { out[name] = yieldPlanned(units, bundles[name], unitId, readiness, null, cfg, params); }); return out;
  }

  var api = {
    configure: configure, lib: LIB, defaults: function () { return DEFAULTS; }, lagProfiles: function () { return LAG_PROFILES; }, checkParams: function () { return CHECK_PARAMS; },
    fullEffectYear: function () { return FULL_EFFECT_YEAR; }, denBasis: function () { return DEN_BASIS; },
    levelOf: levelOf, stageOf: stageOf, dStageOf: dStageOf, bandValues: bandValues, normalise: normalise, weightCapError: weightCapError, checkWeights: checkWeights, ConfigurationError: ConfigurationError, deriveValue: deriveValue, isDigital: isDigital,
    scoreUnit: scoreUnit, deriveParentValues: deriveParentValues, rollup: rollup, prepareTerritory: prepareTerritory, scoreTerritory: scoreTerritory,
    applyEffects: applyEffects, runChecks: runChecks, appraisePrepared: appraisePrepared, appraiseTerritory: appraiseTerritory, yearProfile: yearProfile,
    ramp: ramp, densityMultiplier: densityMultiplier, powerMean: powerMean, balanceOf: balanceOf, rankBundles: rankBundles, costPerPoint: costPerPoint, buildTree: buildTree,
    validateOptions: validateOptions, validateTerritory: validateTerritory, admissible: admissible, ValidationError: ValidationError, knownTags: function () { return KNOWN_TAGS.slice(); }, requiredFlags: function () { return REQUIRED_FLAGS; },
    sdgOf: sdgOf, goalSdgs: goalSdgs, goalAlignment: goalAlignment, goalContribution: goalContribution, goalCoverage: goalCoverage, fullEffectYearOf: fullEffectYearOf, sdgNames: function () { return SDG_NAMES; }, sdgTargetText: function () { return SDG_TARGET_TEXT; },
    yearIndex: yearIndex, NOT_VALUED: NOT_VALUED, scaleOf: scaleOf, quantityOf: quantityOf, defaultField: defaultField, valueLibraryTemplate: valueLibraryTemplate, libraryByCode: libraryByCode, entryStatus: entryStatus,
    validateValueLibrary: validateValueLibrary, capexProfile: capexProfile, opexProfile: opexProfile, investmentOf: investmentOf, outcomeLines: outcomeLines, valueLines: valueLines, sumPv: sumPv, valueBy: valueBy,
    investmentAgainstValue: investmentAgainstValue, validateProgrammes: validateProgrammes, chain: chain, traceUp: traceUp, traceDown: traceDown, setValuedText: setValuedText,
    couplingPhase: couplingPhase, couplingContext: couplingContext, catalysisOf: catalysisOf, themeOf: themeOf, themeNames: function () { return THEME_NAMES; }, capabilityCrosswalk: capabilityCrosswalk, alignment: alignment, alignmentTerritory: alignmentTerritory,
    stockOf: stockOf, reaches: reaches, removeRealised: removeRealised, shapley: shapley, yieldPlanned: yieldPlanned, yieldInOperation: yieldInOperation, recordReadings: recordReadings, smartReadings: smartReadings, bundleReadings: bundleReadings
  };
  global.SRS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
