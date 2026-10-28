/* SRS Workbench screens: one dashboard per framework role (Practitioner Manual Part 1.5). */
(function (global) {
  'use strict';
  var A = global.APP, SRS = A.SRS, DATA = A.DATA, DIMS = A.DIMS, DIM_NAME = A.DIM_NAME, SUB = A.SUB, IND = A.IND;
  var esc = A.esc, f3 = A.f3, f2 = A.f2, fd = A.fd, pc = A.pc, fv = A.fv, money = A.money;
  function S() { return A.state(); }
  function U() { return S().ui; }
  function T() { return A.territory(); }
  function res(id) { return T().results[id]; }
  function unitName(id) { var u = A.unitById(id); return u ? u.name : id; }
  function subsOf(d) { return DATA.subdims.filter(function (s) { return s.dim === d && (s.code !== 'IF' || S().cfg.enable_optional); }); }
  function indsOf(sub) { return DATA.indicators.filter(function (i) { return i.sub === sub; }); }
  // version 1.5: one line of effective smartness for the sponsor
  function smartLine(uid) {
    if (!A.smart) return '';
    var r = A.smart(); if (!r.smart || !r.smart.units[uid]) return '';
    var e = r.smart.units[uid], al = e.alignment, op = e.in_operation.attribution.B.digital, pl = e.planned ? e.planned.attribution.B.digital : null, k = e.planned ? e.planned.attribution.B.kappa : null;
    var f4 = function (x) { return x === null || x === undefined ? '–' : (x < 0 ? '−' : '+') + Math.abs(x).toFixed(3); };
    return '<p class="small" style="margin-top:8px"><b>Effective smartness (Part 10):</b> alignment ' + (al.alignment === null ? '–' : al.alignment.toFixed(2)) + ' (the capability held serves that share of the outcome shortfall); the digital layer carries ' + f4(op) + ' of B in operation' + (e.planned ? ' and contributes ' + f4(pl) + ' in the plan, κ ' + (k === null ? 'undefined' : k.toFixed(2)) : '') + '. <a href="#smartness">Read the three readings.</a> They never rank.</p>';
  }
  function pageHead(role, title, lede, controls) {
    return '<div class="page-head"><div class="title"><span class="role">' + role + '</span><h1>' + title + '</h1><p class="lede">' + lede + '</p></div><div class="controls">' + (controls || '') + '</div></div>' + syntheticNote();
  }
  function ensureUnit() { if (!A.unitById(U().unit)) U().unit = T().tree.roots[0]; if (!A.unitById(U().appraisalUnit)) U().appraisalUnit = U().unit; }
  function syntheticNote() {
    return S().territory.synthetic ? '<div class="callout warn" style="margin-bottom:14px"><b>Demonstration data.</b> Westhaven Region is a synthetic territory; its values describe no real place. The scores are computed from fixed floors, targets, equal weights and default check parameters, several of which are assumptions without direct calibration, and no uncertainty range is shown. Use the results to learn the method, not to judge a territory or select an investment.</div>' : '';
  }
  function syntheticText() { return S().territory.synthetic ? 'DEMONSTRATION DATA: synthetic territory; default parameters include uncalibrated assumptions; no uncertainty range is reported.' : ''; }
  function territoryLine() { return esc(S().territory.name) + ' · reference year ' + esc(S().territory.reference_year); }
  function isOutcome(d) { return SRS.defaults().outcome_dims.indexOf(d) >= 0; }
  function pDesc() { var p = S().cfg.aversion_p || 0; return p === 0 ? 'geometric mean' : 'power mean, p = ' + p; }
  function bTile(b, hero) {
    return '<div class="tile' + (hero ? ' hero' : '') + '"><span class="label">Balanced performance B</span><span class="v">' + f3(b.B) + '</span><span>' + A.levelBadge(b.B) + '</span><span class="d">' + pDesc() + ' of sustainability and resilience; sets the performance level</span></div>';
  }
  function dTile(b) {
    return '<div class="tile"><span class="label">Balance of the outcomes</span><span class="v">' + f2(b.gap) + '</span><span>' + A.stageBadge(b.stage) + '</span><span class="d">gap between S and R; sets the stage. D = ' + f3(b.D) + '</span></div>';
  }
  function dimTiles(r, ghost) {
    return DIMS.map(function (d) {
      var sc = r.dims[d].score, g = ghost ? ghost.dims[d].score : null;
      return '<div class="tile"><span class="label"><span class="swatch" style="background:' + A.dimColor(d) + '"></span>' + DIM_NAME[d] + (isOutcome(d) ? ' · outcome' : ' · capability') + '</span><span class="v">' + f3(sc) + '</span><span>' + A.levelBadge(sc) + (g !== null && g !== undefined ? ' <span class="small ' + A.deltaClass(sc - g) + '">' + fd(sc - g) + '</span>' : '') + '</span>' + A.track(sc, { ghost: g }) + '</div>';
    }).join('');
  }
  function obstacleList(r, d, n) {
    var items = (r.obstacles && r.obstacles[d]) ? r.obstacles[d].slice(0, n || 5) : [];
    if (!items.length) return '<p class="muted small">No rated indicators in this dimension.</p>';
    return '<ol class="note-list">' + items.map(function (t) { var i = IND[t[0]]; var ir = r.indicators[t[0]]; return '<li><b class="mono">' + t[0] + '</b> ' + esc(i.name) + ' <span class="muted">— ' + pc(t[1], 1) + ' of the gap; value ' + fv(ir.value) + ' ' + esc(i.unit) + ', score ' + f3(ir.score) + '</span></li>'; }).join('') + '</ol>';
  }
  function checksAnywhere(app, unitId) {
    var ids = A.subtree(unitId).map(function (e) { return e.id; });
    var set = {};
    ids.forEach(function (id) { var r = app.results[id]; if (r) r.notes.forEach(function (n) { var m = n.match(/^(IC\d+)/); if (m) set[m[1]] = true; }); });
    return Object.keys(set).sort(function (a, b) { return parseInt(a.slice(2)) - parseInt(b.slice(2)); });
  }
  function bundleRows(unitId, readiness) {
    return A.allBundles().map(function (b) {
      var app; try { app = A.appraise(b.options, { readiness: readiness }); } catch (e) { if (e && e.name === 'ValidationError') return null; throw e; }
      var r = app.results[unitId];
      var capex = b.options.map(A.optionById).filter(Boolean).reduce(function (s, o) { return s + (o.capex_m || 0); }, 0);
      return { bundle: b, app: app, r: r, contribution: r.contribution, capex: capex, checks: checksAnywhere(app, unitId), cpp: r.contribution.balance ? SRS.costPerPoint(capex, r.contribution) : null };
    }).filter(Boolean);
  }
  function bundleTable(rows, unitId, highlight) {
    var entries = rows.map(function (x) { return { id: x.bundle.id, contribution: x.contribution, row: x }; });
    var ranked = SRS.rankBundles(entries);
    var info = {};
    ranked.ranked.forEach(function (e, i) { info[e.id] = { rank: i + 1, closes: e.closes_lag, opens: e.opens_lag, near: !!e.near_tie }; });
    ranked.set_aside.forEach(function (e) { info[e.id] = { aside: e.reason }; });
    var html = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Rank</th><th>Bundle</th><th>Options</th><th class="num">Capex</th><th class="num">ΔS</th><th class="num">ΔR</th><th class="num">ΔM</th><th>Weaker outcome lag closed</th><th class="num">B after</th><th class="num">D after</th><th>Capability after</th><th>Lag after</th><th>Checks fired</th><th class="num">Cost per point</th></tr></thead><tbody>';
    var order = ranked.ranked.concat(ranked.set_aside);
    order.forEach(function (e) {
      var x = e.row, c = x.contribution, b = x.bundle, inf = info[b.id];
      if (!c.balance) { html += '<tr class="aside"><td><span class="badge serious">set aside</span></td><td>' + esc(b.id + ' ' + b.name) + '</td><td colspan="11" class="muted">not rated</td></tr>'; return; }
      var rankCell = inf.aside ? '<span class="badge serious" title="' + esc(inf.aside) + '">set aside</span><div class="small faint">' + esc(inf.aside) + '</div>' : '<b>' + inf.rank + '</b>';
      html += '<tr class="' + (inf.aside ? 'aside' : '') + (highlight === b.id ? ' sel' : '') + '"><td>' + rankCell + '</td><td><b>' + esc(b.id) + '</b> ' + esc(b.name) + '</td><td class="small">' + b.options.join(', ') + '</td><td class="num">' + money(x.capex) + '</td>' +
        DIMS.map(function (d) { return '<td class="num ' + A.deltaClass(c.dims[d].change) + '">' + fd(c.dims[d].change) + '</td>'; }).join('') +
        '<td>' + (inf.aside ? '–' : (inf.closes ? '<span class="badge good">yes</span>' : '<span class="badge warn">no</span>' + (inf.opens && inf.opens.length ? ' <span class="small">opens ' + inf.opens.map(function (d) { return DIM_NAME[d]; }).join(', ') + '</span>' : ''))) + '</td>' +
        '<td class="num"><b>' + f3(c.balance.B_after) + '</b></td><td class="num">' + f3(c.balance.D_after) + (inf.near ? ' <span class="badge" title="B within 0.005 of the bundle above; D decided">tie</span>' : '') + '</td><td class="small">' + (c.balance.capability_after.M.score === null ? '–' : f3(c.balance.capability_after.M.score) + (c.balance.capability_after.M.trails ? ' trails' : ' keeps pace')) + '</td><td>' + (c.balance.lagging_after.length ? c.balance.lagging_after.map(function (d) { return DIM_NAME[d]; }).join(', ') : 'none') + '</td><td class="small">' + (x.checks.length ? x.checks.join(', ') : 'none') + '</td><td class="num">' + (x.cpp === null ? '–' : money(x.cpp)) + '</td></tr>';
    });
    html += '</tbody></table></div>';
    return { html: html, ranked: ranked };
  }
  var RANK_RULE = 'Bundles are compared in four steps (Manual Part 4.8). A bundle that lowers sustainability or resilience is set aside. A bundle that another eligible bundle matches or beats on both outcomes is set aside as dominated; capability is reported beside the ranking and does not enter the test. Bundles that remove the lag on the weaker outcome without opening a new one come first. Within each group the balanced performance B after completion decides, because B never falls when an outcome improves; where two bundles are within 0.005 on B, the higher coordination degree D ranks first. The change in digital capability and the cost per point of outcome gained are reported beside them.';

  // =====================================================================
  // HOME
  // =====================================================================
  A.registerScreen('roles', {
    render: function () {
      ensureUnit();
      var root = T().tree.roots[0], r = res(root);
      var roles = [
        ['sponsor', 'Sponsor', 'Owns the territory, approves the configuration and the published results.', 'The rating in one line, the hierarchy at a glance, what is holding the territory back and which portfolio to fund.'],
        ['lead', 'Assessment lead', 'Runs the rating cycle, keeps the configuration record and signs the profile cards.', 'Full profile cards, sub-dimension tables, balance arithmetic, roll-ups, configuration settings and export.'],
        ['data', 'Data steward', 'Collects the data, assigns data-quality grades and keeps the sources.', 'Every indicator value with its grade, year and source, editable, with coverage and confidence recomputed live.'],
        ['dimension', 'Dimension lead', 'One each for sustainability, resilience and smartness; checks the values and explains the results.', 'Sub-dimension drill-down, indicator level bars, obstacle degrees and a comparison across units.'],
        ['appraiser', 'Project appraiser', 'Prepares effect sheets and runs the interaction checks for interventions.', 'Option library, bundle builder, the thirteen checks, readiness and lag profiles, year-by-year profile and bundle ranking.'],
        ['project', 'Project manager', 'Submits the project record: effect sheet, investment, the city goals it claims.', 'One record, its admissibility, which goals its effect sheet serves, the programme and strategic goals it feeds, its outcome lines valued by the city, investment against value.'],
        ['programme', 'Programme manager', 'Groups project records into a programme and answers for its outcomes.', 'Composed outcomes with the records that produce each, benefits, contribution to the strategic goals by the horizon and at full effect, investment against value, overlap removed by composition.'],
        ['portfolio', 'Portfolio manager', 'Adopts the city\'s goals as strategic goals with commitments and funds the programmes.', 'Programmes compared on investment against value, strategic goals against commitments, capital phasing against the envelope, cost and value by year, the score beside.'],
        ['city', 'City expectations', 'States the goals in the city\'s words and sets the value library.', 'Goals with their SDG targets and status, the value library the city fills (no values shipped), fields, envelope and money parameters.'],
        ['smartness', 'Effective smartness', 'Reads whether the digital capability a city holds or plans serves its two outcomes.', 'Alignment per unit, the digital layer\'s contribution in operation and planned with the catalytic ratio, the coupling table and the operating register; reported beside the score, never ranking.'],
      ];
      return '<div class="page-head"><div class="title"><span class="role">Work screens</span><h1>Where the data is entered and each role does its work</h1><p class="lede">The workbench runs the Practitioner Manual\'s calculator in your browser. A territory is rated on two outcomes, sustainability and resilience, with its digital capability (smartness) reported beside them as the means of reaching them. It is loaded with the Westhaven Region demonstration territory, and every figure it shows is computed from the indicator values on the Data steward screen, so a changed value, grade or option flows through to every role\'s dashboard at once.</p></div></div>' +
        '<div class="panel"><div class="panel-head"><h2>' + esc(r.name) + '</h2><span class="small muted">' + territoryLine() + '</span></div>' +
        (r.balance ? '<p class="rating-line">' + A.ratingLabel(r) + '</p><div class="row" style="margin-top:8px">' + A.lagBadges(r.balance) + A.confBadge(r.confidence) + A.stageBadge(r.balance.stage) + '</div><div class="tiles" style="margin-top:14px">' + bTile(r.balance, true) + dimTiles(r) + dTile(r.balance) + '</div>' : '<p class="muted">The territory is not yet rated.</p>') +
        '</div>' +
        '<div class="section"><h2>Choose your screen</h2><p class="lede">The five roles of Manual Part 1.5 and the three delivery roles of Part 9 each have a working screen built around their decisions and the data they keep, the city\'s expectations have a page of their own, and the Effective smartness page holds the coupling table and the operating register. The screens share one set of data, so nothing has to be entered twice, and every figure on the <a href="#home">Dashboard</a> and the framework screens is recomputed from what is entered here.</p>' +
        '<div class="cards roles">' + roles.map(function (x) { return '<a class="role-card" href="#' + x[0] + '"><h3>' + x[1] + '</h3><p class="who">' + x[2] + '</p><p class="what">' + x[3] + '</p></a>'; }).join('') + '</div></div>' +
        '<div class="section grid c2"><div class="panel"><h3>Loading your own territory</h3><p class="prose muted">Open the Data steward screen, edit the register and the indicator values in place, or paste a territory file in the same JSON form as the one you can copy out. Values the steward does not enter are derived from children by the indicator\'s aggregation rule or inherited from the parent, and both are flagged.</p></div><div class="panel"><h3>Where the method is written down</h3><p class="prose muted">The Practitioner Manual (version ' + esc(DATA.manual_version) + ') defines every rule the workbench applies; the Indicators Library screen reproduces the indicator library and the parameter card. The Case Study and Tutorial Guide works through Westhaven by hand, and the figures it publishes are the figures this workbench computes.</p></div></div>';
    }
  });

  // =====================================================================
  // SPONSOR
  // =====================================================================
  A.registerScreen('sponsor', {
    render: function () {
      ensureUnit();
      var uid = U().unit, r = res(uid), t = T();
      var controls = '<label class="control"><span>Territory unit</span>' + A.unitSelect('sel-unit', uid) + '</label>';
      var html = pageHead('Sponsor', 'Where ' + esc(r.name) + ' stands', 'The SRS rating in one line, how the units beneath it compare, what holds the territory back and which investment portfolio the appraisal supports.', controls);
      if (!r.balance) return html + '<div class="callout warn">This unit is not rated: sustainability or resilience lacks the minimum number of rated sub-dimensions. Ask the data steward which indicators are missing.</div>';
      var b = r.balance;
      html += '<div class="panel"><div class="panel-head"><h2>SRS rating</h2><span class="small muted">' + territoryLine() + '</span></div><p class="rating-line">' + A.ratingLabel(r) + '</p><div class="row" style="margin-top:8px">' + A.lagBadges(b) + A.confBadge(r.confidence) + '</div>' +
        '<p class="prose muted" style="margin-top:10px">' + sponsorNarrative(r) + '</p>' + smartLine(uid) + '</div>';
      html += '<div class="tiles" style="margin-top:16px">' + bTile(b, true) + dimTiles(r) + dTile(b) + '</div>';
      // hierarchy
      var rows = A.subtree(uid);
      html += '<div class="section"><h2>The hierarchy beneath ' + esc(r.name) + '</h2><p class="lede">A parent is reported as the distribution of its children, not as their average: the range of D, the stage of each child and the between-unit evenness.</p><div class="panel"><div class="hierarchy">';
      rows.forEach(function (e) {
        var rr = res(e.id), bb = rr.balance;
        html += '<div class="hrow' + (e.id === uid ? ' sel' : '') + '" data-unit="' + esc(e.id) + '"><div class="nm" style="padding-left:' + (e.depth * 18) + 'px"><b>' + esc(rr.name) + '</b><span class="lvl">' + esc(rr.level) + '</span></div><div class="trk">' + (bb ? A.track(bb.D, { title: 'D ' + f3(bb.D) }) : '') + '</div><div class="num">' + (bb ? f3(bb.D) : '–') + '</div><div class="stg">' + (bb ? A.stageBadge(bb.stage) : '<span class="badge">not rated</span>') + '</div></div>';
      });
      html += '</div>';
      var ru = t.rollups[uid];
      if (ru) {
        html += '<div class="row" style="margin-top:12px"><span class="badge accent">children D from ' + f3(ru.D_min) + ' to ' + f3(ru.D_max) + ', median ' + f3(ru.D_median) + '</span><span class="badge accent">between-unit evenness ' + f3(ru.between_unit_evenness) + '</span>' + Object.keys(ru.stages).map(function (k) { return '<span class="badge">' + ru.stages[k] + ' × ' + esc(k) + '</span>'; }).join('') + '</div>';
      }
      html += '</div></div>';
      // what holds it back
      var capT = A.capOf(b);
      var outsW = SRS.defaults().outcome_dims;
      var lagDims = b.lagging.length ? b.lagging.slice() : [outsW.reduce(function (a, d) { return r.dims[d].score < r.dims[a].score ? d : a; }, outsW[0])];
      if (capT && capT.trails) lagDims.push('M');
      html += '<div class="section' + (lagDims.length > 1 ? ' grid c2' : '') + '">' + lagDims.map(function (d) {
        return '<div class="panel"><h3><span class="swatch" style="background:' + A.dimColor(d) + '"></span>' + (d === 'M' ? 'What holds digital capability back (it trails the outcomes by ' + f2(capT.gap) + ')' : 'What holds ' + DIM_NAME[d].toLowerCase() + ' back' + (b.lagging.indexOf(d) < 0 ? ' (the weaker outcome; neither lags by more than the gap)' : '')) + '</h3><p class="small muted" style="margin-bottom:8px">Obstacle degree: each indicator\'s weighted distance from target as a share of the dimension\'s total distance. The five largest are listed.</p>' + obstacleList(r, d, lagDims.length > 1 ? 5 : 6) + '</div>';
      }).join('') + '</div>';
      // portfolio
      var appUnit = U().appraisalUnit;
      var brs = bundleRows(appUnit, S().readiness);
      var bt = bundleTable(brs, appUnit, brs.length ? null : null);
      var best = bt.ranked.ranked[0];
      html += '<div class="section"><h2>Portfolio recommendation for ' + esc(unitName(appUnit)) + '</h2><p class="lede">Bundles are appraised at full effect with governance readiness set to <b>' + esc(S().readiness) + '</b>. ' + RANK_RULE + ' The appraiser\'s screen chooses the unit and the bundles.</p>' + bt.html;
      if (best) {
        var c = best.contribution; best = best.row;
        html += '<div class="callout" style="margin-top:12px"><b>Ranked first: bundle ' + esc(best.bundle.id) + ', ' + esc(best.bundle.name) + '.</b> It raises the balanced performance B from ' + f3(c.balance.B_before) + ' to ' + f3(c.balance.B_after) + ' and D from ' + f3(c.balance.D_before) + ' to ' + f3(c.balance.D_after) + ' for a capital cost of ' + money(best.capex) + (best.cpp ? ', or ' + money(best.cpp) + ' per hundredth of outcome score gained' : '') + '. After completion ' + (c.balance.lagging_after.length ? DIM_NAME[c.balance.lagging_after[0]].toLowerCase() + ' still lags' : 'neither outcome lags the other by more than the lag gap') + (c.balance.capability_after.M.score !== null ? ', and digital capability ' + (c.balance.capability_after.M.trails ? 'still trails the outcomes by ' + f2(c.balance.capability_after.M.gap) : 'keeps pace with the outcomes') : '') + '.' + (best.checks.length ? ' Checks that fired somewhere in the hierarchy: ' + best.checks.join(', ') + '.' : ' No interaction check fired anywhere in the hierarchy.') + '</div>';
        var prof = SRS.yearProfile(S().units, best.bundle.options.map(A.optionById).filter(Boolean), { readiness: S().readiness, cfg: S().cfg }, appUnit, 8);
        html += '<div class="panel" style="margin-top:16px"><h3>Year-by-year profile of bundle ' + esc(best.bundle.id) + '</h3><p class="small muted">Each option reaches its full effect along its lag profile; year 0 is the baseline and year 1 the first year after completion.</p><div class="chart-wrap">' + profileChart(prof) + '</div>' + profileLegend() + '</div>';
      }
      html += '</div>';
      return html;
    },
    mount: function (root) {
      A.on(root, '#sel-unit', 'change', function (ev, el) { U().unit = el.value; A.rerender(); });
      A.on(root, '.hrow', 'click', function (ev, el) { U().unit = el.getAttribute('data-unit'); A.rerender(); });
    }
  });
  function sponsorNarrative(r) {
    var b = r.balance, c = A.capOf(b);
    var s = esc(r.name) + ' scores ' + f3(r.dims.S.score) + ' on sustainability and ' + f3(r.dims.R.score) + ' on resilience, the two outcomes the rating is built on. ';
    s += 'Their balanced performance B of ' + f3(b.B) + ' places it at performance level ' + b.performance_level.level + ' (' + b.performance_level.name + '), and the gap of ' + f2(b.gap) + ' between the two outcomes makes them ' + b.stage.toLowerCase() + '. ';
    if (b.lagging.length) s += DIM_NAME[b.lagging[0]] + ' lags the other outcome by ' + f2(b.lag_size[b.lagging[0]]) + ', more than the lag gap of ' + f2(S().cfg.lag_gap) + ', so investment that does not raise it will not raise the stage. ';
    else s += 'Neither outcome lags the other by more than the lag gap of ' + f2(S().cfg.lag_gap) + '. ';
    if (c && c.score !== null) s += 'Its digital capability scores ' + f3(c.score) + ' (level ' + c.level.level + ', ' + c.level.name + ')' + (c.trails ? ', which trails the outcome level by ' + f2(c.gap) + ': the means of improving services, response and data-driven management are weaker than the outcomes they are meant to support. ' : ', in step with the outcome level. ');
    s += 'The data-confidence grade is ' + r.confidence.grade + ' (' + pc(r.confidence.coverage) + ' of indicators present, ' + pc(r.confidence.share_A_or_B) + ' of them graded A or B).';
    return s;
  }
  function profileChart(prof) {
    var years = prof.map(function (p) { return p.year; });
    var series = [
      { name: 'B', color: 'var(--fg)', values: prof.map(function (p) { return p.L; }), bold: true },
      { name: 'S', color: 'var(--dim-S)', values: prof.map(function (p) { return p.S; }) },
      { name: 'R', color: 'var(--dim-R)', values: prof.map(function (p) { return p.R; }) },
      { name: 'M', color: 'var(--dim-M)', values: prof.map(function (p) { return p.M; }), dash: true }
    ];
    // nudge colliding end labels
    var ends = series.map(function (s) { return { s: s, v: s.values[s.values.length - 1] }; }).sort(function (a, b) { return b.v - a.v; });
    var minGap = 0.028, prev = null;
    ends.forEach(function (e) { e.y = e.v; if (prev !== null && prev - e.y < minGap) e.y = prev - minGap; prev = e.y; });
    ends.forEach(function (e) { e.s.labelDy = (e.v - e.y) * (260 - 18 - 34) / 1; });
    var lo = Math.min.apply(null, series.reduce(function (a, s) { return a.concat(s.values); }, [])), hi = Math.max.apply(null, series.reduce(function (a, s) { return a.concat(s.values); }, []));
    var ymin = Math.max(0, Math.floor((lo - 0.05) * 10) / 10), ymax = Math.min(1, Math.ceil((hi + 0.05) * 10) / 10);
    ends.forEach(function (e) { e.s.labelDy = (e.v - e.y) * (260 - 18 - 34) / (ymax - ymin); });
    return A.lineChart(series, years, { ymin: ymin, ymax: ymax, xlabel: 'years after completion', label: 'Year profile of B, S, R and M' });
  }
  function profileLegend() {
    return '<div class="legend"><span><span class="swatch" style="background:var(--fg)"></span>B balanced performance</span><span><span class="swatch" style="background:var(--dim-S)"></span>S sustainability</span><span><span class="swatch" style="background:var(--dim-R)"></span>R resilience</span><span><span class="swatch" style="background:var(--dim-M)"></span>M digital capability (dashed)</span></div>';
  }

  // =====================================================================
  // ASSESSMENT LEAD
  // =====================================================================
  A.registerScreen('lead', {
    guard: [{ part: 'config', sel: '#cfg-name, #cfg-version, #cfg-readiness, #cfg-lag, #cfg-p, #cfg-if, [data-wsub], [data-wind], #w-reset', why: 'The configuration record is kept by the assessment lead.' }],
    render: function () {
      ensureUnit();
      var uid = U().unit, r = res(uid), t = T(), u = A.unitById(uid);
      var controls = '<label class="control"><span>Territory unit</span>' + A.unitSelect('sel-unit', uid) + '</label>';
      var html = pageHead('Assessment lead', 'Profile card: ' + esc(r.name), 'The complete rating record of one unit, the arithmetic behind it, the roll-up of its children and the configuration the cycle was run with. Everything on this screen is what the profile card template (Manual Part 8, T3) asks for.', controls);
      var b = r.balance;
      html += '<div class="grid two-one"><div class="stack">';
      html += '<div class="panel"><div class="panel-head"><h2>Rating</h2><span class="small muted">' + territoryLine() + '</span></div>' + (b ? '<p class="rating-line">' + A.ratingLabel(r) + '</p><div class="row" style="margin-top:8px">' + A.lagBadges(b) + A.confBadge(r.confidence) + '<span class="badge">' + r.confidence.n_present + ' of ' + r.confidence.n_total + ' indicators present</span><span class="badge">' + r.confidence.inherited + ' inherited</span></div>' : '<div class="callout warn">Not rated: a dimension lacks the minimum number of rated sub-dimensions (S 2, R 3, M 2).</div>') + '</div>';
      var eqw = equalWeightResult(uid);
      if (eqw) html += '<div class="callout">Weights are unequal in this configuration. Equal-weight result for comparison (Manual Part 2.4): ' + esc(eqw) + '</div>';
      html += '<div class="tiles">' + (b ? bTile(b, true) : '') + dimTiles(r) + (b ? dTile(b) : '') + '</div>';
      // sub-dimension table
      html += '<div class="panel"><h3>Sub-dimension scores</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Sub-dimension</th><th class="num">Score</th><th>Level</th><th class="num">Present (weight)</th><th>Rated</th><th class="num">Weight in dimension</th></tr></thead><tbody>';
      DIMS.forEach(function (d) {
        html += '<tr class="group"><td colspan="6"><span class="swatch" style="background:' + A.dimColor(d) + '"></span>' + DIM_NAME[d] + ' — ' + f3(r.dims[d].score) + (r.dims[d].rated ? '' : ' (not rated)') + '</td></tr>';
        subsOf(d).forEach(function (s) {
          var sr = r.subs[s.code];
          html += '<tr><td style="white-space:nowrap"><span class="mono">' + s.code + '</span> ' + esc(s.name.replace(' (optional)', '')) + '</td><td class="num">' + f3(sr.score) + '</td><td>' + A.levelBadge(sr.score) + '</td><td class="num">' + sr.n_present + ' / ' + sr.n_total + ' (' + pc(sr.weight_share_present) + ')</td><td>' + (sr.rated ? '<span class="badge good">rated</span>' : '<span class="badge warn">below minimum</span>') + '</td><td class="num">' + (sr.weight !== undefined ? pc(sr.weight) : '–') + '</td></tr>';
        });
      });
      html += '</tbody></table></div></div>';
      // balance arithmetic
      if (b) {
        var capL = A.capOf(b);
        html += '<div class="panel"><h3>Rating arithmetic</h3><p class="small muted" style="margin-bottom:8px">The rating is built on the two outcomes, sustainability and resilience; digital capability is reported beside them (Manual Part 3).</p><dl class="kv"><dt>Mean of S and R</dt><dd>' + f3(b.mean) + '</dd><dt>Balanced performance B = ' + (b.p === 0 ? '√(S × R)' : '((Sᵖ + Rᵖ) / 2)^(1/p), p = ' + b.p) + '</dt><dd>' + f3(b.B) + ' → level ' + b.performance_level.level + ' ' + b.performance_level.name + '</dd><dt>Imbalance A = 1 − B / mean</dt><dd>' + b.imbalance.toFixed(4) + '</dd><dt>Population standard deviation σ</dt><dd>' + f3(b.sigma) + '</dd><dt>Evenness C = max(0, 1 − 2σ)</dt><dd>' + f3(b.evenness) + '</dd><dt>Coordination degree D = √(C × mean)</dt><dd>' + f3(b.D) + ' (near-ties in the ranking; the stage read from D, ' + esc(b.d_stage) + ', is reported for comparison)</dd><dt>Balance stage from the gap |S − R| = ' + f2(b.gap) + '</dt><dd>' + esc(b.stage) + ' (even ≤ 0.10, broadly even ≤ 0.25, uneven ≤ 0.50)</dd><dt>Lag test between the outcomes (gap ' + f2(S().cfg.lag_gap) + ')</dt><dd>' + (b.lagging.length ? esc(DIM_NAME[b.lagging[0]]) + ' lags by ' + f2(b.lag_size[b.lagging[0]]) : 'neither lags') + '</dd><dt>Digital capability M</dt><dd>' + (capL && capL.score !== null ? f3(capL.score) + ', level ' + capL.level.level + ' ' + capL.level.name + '; gap to B ' + fd(capL.gap) + (capL.trails ? ', trailing' : ', keeping pace') : 'not rated') + '</dd><dt>Geometric mean of S, R and M (reference only)</dt><dd>' + f3(b.L_all) + '</dd></dl></div>';
        html += '<div class="panel"><h3>Obstacle degrees</h3><div class="grid c3">' + DIMS.map(function (d) { return '<div><h4><span class="swatch" style="background:' + A.dimColor(d) + '"></span>' + DIM_NAME[d] + '</h4>' + obstacleList(r, d, 5) + '</div>'; }).join('') + '</div></div>';
      }
      // roll-up
      var ru = t.rollups[uid];
      if (ru) {
        html += '<div class="panel"><h3>Roll-up of children</h3><p class="small muted" style="margin-bottom:8px">Reported as a distribution with the between-unit evenness, 1 − 2 × the population standard deviation of the children\'s D.</p><div class="row"><span class="badge accent">D min ' + f3(ru.D_min) + '</span><span class="badge accent">median ' + f3(ru.D_median) + '</span><span class="badge accent">max ' + f3(ru.D_max) + '</span><span class="badge accent">between-unit evenness ' + f3(ru.between_unit_evenness) + '</span></div><div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Child</th><th class="num">S</th><th class="num">R</th><th class="num">M</th><th class="num">B</th><th class="num">D</th><th>Stage</th><th>Outcome lag</th><th>Confidence</th></tr></thead><tbody>' +
          t.tree.children[uid].map(function (k) { var rr = res(k), bb = rr.balance; return '<tr><td><b>' + esc(rr.name) + '</b></td>' + DIMS.map(function (d) { return '<td class="num">' + f3(rr.dims[d].score) + '</td>'; }).join('') + '<td class="num">' + (bb ? f3(bb.B) : '–') + '</td><td class="num">' + (bb ? f3(bb.D) : '–') + '</td><td>' + (bb ? A.stageBadge(bb.stage) : '–') + '</td><td>' + (bb ? (bb.lagging.length ? bb.lagging.map(function (d) { return DIM_NAME[d]; }).join(', ') : 'none') : '–') + '</td><td>' + rr.confidence.grade + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
      }
      html += '</div><div class="stack">';
      // configuration
      html += '<div class="panel"><h3>Configuration record</h3><div class="form" style="grid-template-columns:1fr">' +
        '<label>Territory name<input type="text" id="cfg-name" value="' + esc(S().territory.name) + '"></label>' +
        '<label>Configuration version<input type="text" id="cfg-version" value="' + esc(S().territory.configuration_version) + '"></label>' +
        '<label>Governance readiness<select id="cfg-readiness">' + ['none', 'partial', 'mature'].map(function (k) { return '<option value="' + k + '"' + (S().readiness === k ? ' selected' : '') + '>' + k + ' (× ' + SRS.defaults().readiness_multiplier[k].toFixed(1) + ')</option>'; }).join('') + '</select><span class="small muted">' + esc(A.READINESS_TEXT[S().readiness]) + '</span></label>' +
        '<label>Lag gap<input type="number" id="cfg-lag" step="0.01" min="0" max="0.5" value="' + S().cfg.lag_gap + '"></label>' +
        '<label>Inequality aversion p<select id="cfg-p">' + [[0.5, '0.5 (mild)'], [0, '0 (geometric mean, default)'], [-1, '−1 (harmonic mean)'], [-3, '−3 (strong)'], [-10, '−10 (close to the weaker outcome)']].map(function (o) { return '<option value="' + o[0] + '"' + ((S().cfg.aversion_p || 0) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select><span class="small muted">How strongly B penalises a gap between sustainability and resilience. A policy choice for the configuration record.</span></label>' +
        '<label class="chk"><input type="checkbox" id="cfg-if"' + (S().cfg.enable_optional ? ' checked' : '') + '> Include the optional institutional and fiscal sub-dimension (IF)</label>' +
        '</div><dl class="kv small" style="margin-top:12px"><dt>Rating minimums</dt><dd>3 indicators and 50 % of weight per sub-dimension; 2, 3 and 2 rated sub-dimensions for S, R, M</dd><dt>Level bands</dt><dd>0.2 / 0.4 / 0.6 / 0.8</dd><dt>Balance stage on the gap between the outcomes</dt><dd>even ≤ 0.10, broadly even ≤ 0.25, uneven ≤ 0.50, severely uneven above</dd><dt>Confidence rule</dt><dd>A: coverage ≥ 90 % and ≥ 80 % graded A or B; B: ≥ 75 % and ≥ 60 %; otherwise C</dd><dt>Weights</dt><dd>' + (weightsUnequal() ? 'unequal; see the weights panel' : 'equal within sub-dimensions and dimensions') + '</dd></dl></div>';
      html += weightsPanel();
      // sign-off checklist
      html += '<div class="panel"><h3>Sign-off checklist</h3><ul class="checklist small">' + [
        [r.confidence.coverage >= 0.9, 'Coverage at or above 90 % (' + pc(r.confidence.coverage) + ')'],
        [r.confidence.share_A_or_B >= 0.8, 'At least 80 % of present values graded A or B (' + pc(r.confidence.share_A_or_B) + ')'],
        [!!b, 'Both outcome dimensions rated (sustainability and resilience)'],
        [r.confidence.inherited === 0 || true, r.confidence.inherited + ' inherited system values flagged on the card'],
        [!!S().territory.configuration_version, 'Configuration version recorded (' + esc(S().territory.configuration_version) + ')'],
        [true, 'Readiness setting stated: ' + esc(S().readiness)]
      ].map(function (x) { return '<li><span class="badge ' + (x[0] ? 'good' : 'warn') + '">' + (x[0] ? '✓' : '!') + '</span><span>' + x[1] + '</span></li>'; }).join('') + '</ul></div>';
      // export
      html += '<div class="panel"><h3>Export</h3><p class="small muted" style="margin-bottom:8px">Copy the profile card for a report, or the whole territory file to hand to another assessor or to reload later.</p><div class="row"><button class="btn" id="exp-card">Copy profile card (text)</button><button class="btn" id="exp-card-json">Copy profile card (JSON)</button><button class="btn" id="exp-territory">Copy territory file</button><button class="btn" id="dl-territory">Download territory file</button><button class="btn" id="dl-card">Download profile card</button></div></div>';
      html += '</div></div>';
      return html;
    },
    mount: function (root) {
      A.on(root, '#sel-unit', 'change', function (ev, el) { U().unit = el.value; A.rerender(); });
      A.on(root, '#cfg-readiness', 'change', function (ev, el) { S().readiness = el.value; A.dataChanged(); A.rerender(); });
      A.on(root, '#cfg-lag', 'change', function (ev, el) { var v = parseFloat(el.value); if (!isNaN(v)) { S().cfg.lag_gap = v; A.dataChanged(); A.rerender(); } });
      A.on(root, '#cfg-if', 'change', function (ev, el) { S().cfg.enable_optional = el.checked; A.dataChanged(); A.rerender(); });
      A.on(root, '#cfg-p', 'change', function (ev, el) { S().cfg.aversion_p = parseFloat(el.value); A.dataChanged(); A.rerender(); });
      A.on(root, '[data-wsub], [data-wind]', 'change', function (ev, el) {
        var cfg = S().cfg, v = parseFloat(el.value);
        if (isNaN(v) || v <= 0) { A.toast('A weight must be a positive number'); A.rerender(); return; }
        var isSub = el.hasAttribute('data-wsub'), key = isSub ? el.getAttribute('data-wsub') : el.getAttribute('data-wind');
        var map = isSub ? (cfg.sub_weights = cfg.sub_weights || {}) : (cfg.indicator_weights = cfg.indicator_weights || {});
        var old = map[key]; map[key] = v;
        var err = weightCapError();
        if (err) { if (old === undefined) delete map[key]; else map[key] = old; A.toast(err); A.rerender(); return; }
        A.dataChanged(); A.rerender();
      });
      A.on(root, '#w-reset', 'click', function () { S().cfg.indicator_weights = {}; S().cfg.sub_weights = {}; A.dataChanged(); A.rerender(); A.toast('Equal weights restored'); });
      A.on(root, '#cfg-name', 'change', function (ev, el) { S().territory.name = el.value; A.persist(); A.rerender(); });
      A.on(root, '#cfg-version', 'change', function (ev, el) { S().territory.configuration_version = el.value; A.persist(); A.rerender(); });
      A.on(root, '#exp-card', 'click', function () { A.copyText(profileCardText(U().unit), 'Profile card'); });
      A.on(root, '#exp-card-json', 'click', function () { A.copyText(JSON.stringify(profileCardJson(U().unit), null, 2), 'Profile card JSON'); });
      A.on(root, '#exp-territory', 'click', function () { A.copyText(territoryFile(), 'Territory file'); });
      A.on(root, '#dl-territory', 'click', function () { A.download(fileStem() + '-territory.json', territoryFile(), 'application/json'); });
      A.on(root, '#dl-card', 'click', function () { A.download(fileStem() + '-profile-' + U().unit + '.txt', profileCardText(U().unit), 'text/plain'); });
    }
  });
  function profileCardJson(uid) {
    var r = res(uid), out = { notice: syntheticText() || undefined, unit: r.name, id: uid, level: r.level, territory: S().territory, readiness: S().readiness, configuration: S().cfg, dimensions: {}, sub_dimensions: {}, balance: r.balance, confidence: r.confidence, obstacles: r.obstacles, indicators: r.indicators };
    DIMS.forEach(function (d) { out.dimensions[d] = r.dims[d]; });
    Object.keys(r.subs).forEach(function (s) { out.sub_dimensions[s] = r.subs[s]; });
    return out;
  }
  function profileCardText(uid) {
    var r = res(uid), b = r.balance, L = [];
    L.push('SRS PROFILE CARD — ' + r.name + ' (' + r.level + ')');
    if (syntheticText()) L.push(syntheticText());
    L.push(S().territory.name + ' · configuration ' + S().territory.configuration_version + ' · reference year ' + S().territory.reference_year);
    L.push('');
    if (b) L.push('Rating: ' + A.ratingText(r) + ' · confidence ' + r.confidence.grade);
    L.push('Outcomes: S ' + f3(r.dims.S.score) + ', R ' + f3(r.dims.R.score) + '; digital capability M ' + f3(r.dims.M.score));
    if (b) L.push('Balance: B ' + f3(b.B) + ' (' + pDesc() + '), imbalance ' + b.imbalance.toFixed(4) + ', mean ' + f3(b.mean) + ', sigma ' + f3(b.sigma) + ', C ' + f3(b.evenness) + ', D ' + f3(b.D) + '; ' + A.lagText(b));
    var eqw = equalWeightResult(U().unit); if (eqw) L.push('Equal-weight result (weights are unequal in this configuration): ' + eqw);
    L.push('Confidence: coverage ' + pc(r.confidence.coverage) + ', A/B share ' + pc(r.confidence.share_A_or_B) + ', inherited ' + r.confidence.inherited + ', readiness ' + S().readiness);
    L.push('');
    L.push('Sub-dimensions:');
    Object.keys(r.subs).forEach(function (s) { var sr = r.subs[s]; L.push('  ' + s + ' ' + sr.name + ': ' + f3(sr.score) + (sr.rated ? '' : ' (not rated)') + ', ' + sr.n_present + '/' + sr.n_total + ' present'); });
    if (b) { L.push(''); L.push('Top obstacles:'); DIMS.forEach(function (d) { L.push('  ' + DIM_NAME[d] + ': ' + r.obstacles[d].slice(0, 3).map(function (t) { return t[0] + ' ' + pc(t[1], 1); }).join(', ')); }); }
    L.push(''); L.push('Indicators (code value score dq flags):');
    Object.keys(r.indicators).forEach(function (c) { var ir = r.indicators[c]; L.push('  ' + c + ' ' + (ir.value === null ? 'missing' : fv(ir.value)) + ' ' + f3(ir.score) + ' ' + (ir.dq || '-') + (ir.inherited ? ' inherited' : ir.derived ? ' derived' : '')); });
    return L.join('\n');
  }
  function wOf(map, k) { return map && map[k] !== undefined ? map[k] : 1; }
  function weightCapError() {
    var e = SRS.weightCapError(S().cfg);
    return e ? 'Not applied: ' + e + ' (Manual Part 2.4; the cap is max(25 %, 1/n) per indicator and max(50 %, 1/n) per sub-dimension).' : null;
  }
  function weightsPanel() {
    var cfg = S().cfg;
    var html = '<div class="panel"><div class="panel-head"><h3>Weights</h3><button class="btn small" id="w-reset">Equal weights</button></div><p class="small muted" style="margin-bottom:8px">Relative weights, renormalised over the indicators present. Caps, enforced by the calculator: no indicator above 25 % of its sub-dimension (or 1/n with fewer than four active indicators), no sub-dimension above 50 % of its dimension. Every report computed with unequal weights also shows the equal-weight result.</p>';
    DIMS.forEach(function (d) {
      var subs = subsOf(d), st = subs.reduce(function (a, x) { return a + wOf(cfg.sub_weights, x.code); }, 0);
      html += '<h4 style="margin-top:10px"><span class="swatch" style="background:' + A.dimColor(d) + '"></span>' + DIM_NAME[d] + '</h4>';
      subs.forEach(function (x) {
        var inds = indsOf(x.code), it = inds.reduce(function (a, ind) { return a + wOf(cfg.indicator_weights, ind.code); }, 0);
        html += '<details class="drawer" style="margin-top:6px"><summary class="small"><span>' + x.code + ' ' + esc(x.name.replace(' (optional)', '')) + ' · ' + pc(wOf(cfg.sub_weights, x.code) / st) + ' of ' + DIM_NAME[d].toLowerCase() + '</span></summary><div class="body"><label class="small" style="display:flex;gap:8px;align-items:center;margin:6px 0">Sub-dimension weight <input type="number" min="0.1" step="0.1" data-wsub="' + x.code + '" value="' + wOf(cfg.sub_weights, x.code) + '" style="width:80px"></label><table class="tbl small"><tbody>' +
          inds.map(function (ind) { return '<tr><td class="mono">' + ind.code + '</td><td>' + esc(ind.name) + '</td><td class="num"><input type="number" min="0.1" step="0.1" data-wind="' + ind.code + '" value="' + wOf(cfg.indicator_weights, ind.code) + '" style="width:70px"></td><td class="num">' + pc(wOf(cfg.indicator_weights, ind.code) / it) + '</td></tr>'; }).join('') + '</tbody></table></div></details>';
      });
    });
    return html + '</div>';
  }
  function weightsUnequal() {
    var cfg = S().cfg;
    return Object.keys(cfg.indicator_weights || {}).some(function (k) { return cfg.indicator_weights[k] !== 1; }) || Object.keys(cfg.sub_weights || {}).some(function (k) { return cfg.sub_weights[k] !== 1; });
  }
  function equalWeightResult(uid) {
    if (!weightsUnequal()) return null;
    var cfg = JSON.parse(JSON.stringify(S().cfg)); cfg.indicator_weights = {}; cfg.sub_weights = {};
    var r = SRS.scoreTerritory(S().units, cfg).results[uid];
    if (!r || !r.balance) return 'not rated';
    return 'S ' + f3(r.dims.S.score) + ', R ' + f3(r.dims.R.score) + ', M ' + f3(r.dims.M.score) + ', B ' + f3(r.balance.B) + ', D ' + f3(r.balance.D) + ' (' + A.ratingText(r) + ')';
  }
  function fileStem() { return (S().territory.name || 'srs').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'srs'; }
  function loadTerritoryText(text) {
    var obj = JSON.parse(text);
    if (!obj.units || !Array.isArray(obj.units)) throw new Error('no units array');
    var st = S();
    var ns = { units: obj.units, options: obj.options || st.options, bundles: obj.bundles || {}, customBundles: obj.custom_bundles || {}, cfg: Object.assign({ indicator_weights: {}, sub_weights: {}, aversion_p: 0 }, obj.cfg || st.cfg), readiness: obj.readiness || st.readiness, territory: obj.territory || Object.assign({}, st.territory, { synthetic: false }), ui: st.ui,
      // version 1.4: a file without the levels keeps the city's goals and library empty rather than Westhaven's
      goals: obj.goals || [], fields: obj.fields || st.fields, programmes: obj.programmes || [], portfolio: obj.portfolio || { id: 'PF', name: 'Portfolio', programmes: [], strategic_goals: [], horizon: null },
      envelope: A.envelopeFrom(obj.envelope || { currency: st.envelope.currency, price_year: st.envelope.price_year, by_year: {} }), valueLibrary: obj.value_library || SRS.valueLibraryTemplate(obj.fields || st.fields, st.envelope.currency, st.envelope.price_year), money: obj.money || st.money,
      // version 1.5: the operating register; a file without one has no system in operation
      stock: obj.stock || [] };
    if (!ns.cfg.catalysis) ns.cfg.catalysis = JSON.parse(JSON.stringify(DATA.defaults.catalysis));
    ns.units.forEach(function (u) { u.values = u.values || {}; });
    A.replaceState(ns);
    var roots = A.territory().tree.roots; U().unit = roots[0]; U().appraisalUnit = roots[0];
    return ns.units.length;
  }
  function optionLibraryFile() {
    return JSON.stringify({ framework: DATA.framework, manual_version: DATA.manual_version, kind: 'option-library', territory: S().territory.name, options: S().options, bundles: S().bundles, custom_bundles: S().customBundles }, null, 1);
  }
  function loadOptionLibraryText(text, mode) {
    var obj = JSON.parse(text);
    if (!obj.options || !Array.isArray(obj.options)) throw new Error('no options array');
    var st = S(), added = 0, replaced = 0;
    if (mode === 'replace') { st.options = obj.options; st.bundles = obj.bundles || {}; st.customBundles = obj.custom_bundles || {}; added = obj.options.length; }
    else {
      obj.options.forEach(function (o) { var i = st.options.findIndex(function (x) { return x.id === o.id; }); if (i >= 0) { st.options[i] = o; replaced++; } else { st.options.push(o); added++; } });
      Object.keys(obj.custom_bundles || {}).forEach(function (k) { st.customBundles[k] = obj.custom_bundles[k]; });
      Object.keys(obj.bundles || {}).forEach(function (k) { if (!st.bundles[k]) st.bundles[k] = obj.bundles[k]; });
    }
    U().selected = U().selected.filter(function (id) { return A.optionById(id); });
    A.dataChanged();
    return { added: added, replaced: replaced };
  }
  function territoryFile() {
    return JSON.stringify({ framework: DATA.framework, manual_version: DATA.manual_version, territory: S().territory, readiness: S().readiness, cfg: S().cfg, units: S().units, options: S().options, bundles: S().bundles, custom_bundles: S().customBundles,
      goals: S().goals, fields: S().fields, programmes: S().programmes, portfolio: S().portfolio, envelope: S().envelope, value_library: S().valueLibrary, money: S().money, stock: S().stock }, null, 1);
  }

  // =====================================================================
  // DATA STEWARD
  // =====================================================================
  A.registerScreen('data', {
    guard: [{ part: 'register', sel: '[data-reg], [data-f], [data-den], #add-unit, #reset-all, #load-file, #paste-file', why: 'Indicator values, grades and the register are kept by the data steward.' }],
    render: function () {
      ensureUnit();
      var uid = U().unit, u = A.unitById(uid), r = res(uid), t = T(), prepared = t.tree.byId[uid];
      var controls = '<label class="control"><span>Territory unit</span>' + A.unitSelect('sel-unit', uid) + '</label>' +
        '<label class="control"><span>Show</span><select id="data-filter">' + [['all', 'all indicators'], ['missing', 'missing only'], ['measured', 'measured here'], ['derived', 'derived or inherited'], ['C', 'graded C']].map(function (x) { return '<option value="' + x[0] + '"' + (U().dataFilter === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
        '<label class="control"><span>Search</span><input type="search" id="data-search" placeholder="code or name" value="' + esc(U().dataSearch) + '"></label>';
      var html = pageHead('Data steward', 'Values, grades and sources: ' + esc(u.name), 'Every indicator of the default library for this unit. Enter a value, its year, its data-quality grade and its source; values you leave empty are derived from the unit\'s children by the indicator\'s aggregation rule, or inherited from its parent when the indicator is a system value. Coverage and confidence update as you type.', controls);
      html += '<div class="tiles"><div class="tile"><span class="label">Coverage</span><span class="v">' + pc(r.confidence.coverage) + '</span><span class="d">' + r.confidence.n_present + ' of ' + r.confidence.n_total + ' active indicators</span></div><div class="tile"><span class="label">Graded A or B</span><span class="v">' + pc(r.confidence.share_A_or_B) + '</span><span class="d">of present values</span></div><div class="tile"><span class="label">Confidence</span><span class="v">' + r.confidence.grade + '</span><span class="d">A needs 90 % and 80 %; B needs 75 % and 60 %</span></div><div class="tile"><span class="label">Measured here</span><span class="v">' + Object.keys(u.values || {}).length + '</span><span class="d">' + Object.keys(prepared.values).filter(function (c) { return prepared.values[c].derived; }).length + ' derived, ' + Object.keys(prepared.values).filter(function (c) { return prepared.values[c].inherited; }).length + ' inherited</span></div></div>';
      // register
      html += '<div class="section grid two-one"><div class="panel"><h3>Register entry</h3><div class="form">' +
        '<label>Name<input type="text" data-reg="name" value="' + esc(u.name) + '"></label><label>Level<select data-reg="level">' + ['region', 'city', 'district', 'precinct'].map(function (l) { return '<option' + (u.level === l ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select></label>' +
        '<label>Population<input type="number" data-reg="population" value="' + esc(u.population) + '"></label><label>Land area (km²)<input type="number" data-reg="area" step="0.1" value="' + esc(u.area) + '"></label><label>Dwellings<input type="number" data-reg="dwellings" value="' + esc(u.dwellings) + '"></label><label>Residents 65+ (%)<input type="number" data-reg="elderly_share" step="0.1" value="' + esc(u.elderly_share) + '"></label><label class="chk" title="Used by check IC8: a green–blue flood strategy locks in only where the unit holds no hard or pumped flood capacity"><input type="checkbox" data-reg="hard_flood_capacity"' + (u.hard_flood_capacity ? ' checked' : '') + '> Hard or pumped flood capacity in service</label>' +
        '</div>' + registerCheck(uid) + denFields(u, prepared) + registerProblems(uid) + '</div>' +
        '<div class="panel"><h3>Territory file</h3><p class="small muted" style="margin-bottom:8px">Copy the whole territory (register, values, options) as JSON, or paste a file in the same form to load another territory. Resetting restores the Westhaven demonstration data.</p><div class="row"><button class="btn" id="copy-file">Copy territory file</button><button class="btn" id="dl-file">Download territory file</button><button class="btn" id="open-file">Load a territory file</button><button class="btn" id="add-unit">Add a child unit</button><button class="btn danger" id="reset-all">Reset to Westhaven</button></div><details class="drawer" style="margin-top:10px"><summary>Paste a territory file</summary><div class="body"><textarea id="paste-file" rows="6" placeholder="{ &quot;units&quot;: [...], &quot;options&quot;: [...] }"></textarea><div class="row" style="margin-top:8px"><button class="btn primary" id="load-file">Load</button></div></div></details></div></div>';
      // indicator table
      html += '<div class="section"><h2>Indicator values</h2><p class="lede">A value typed here is measured at this unit and overrides derivation. Clear it to return to the derived or inherited value. Grades: A audited or statutory, B administrative or modelled with documented method, C estimated. For the ratio indicators, enter the unit\'s counts in the register entry: with every child\'s count recorded a parent\'s value is the sum of the children\'s numerators over the sum of their denominators; without them it is derived by the fallback weighting, marked ≈ and capped at grade B. A parent is derived only when the reporting children cover at least half of it, and the coverage is shown on the origin badge.</p><div class="panel"><div class="tbl-wrap"><table class="tbl data-tbl"><thead><tr><th>Code</th><th>Indicator</th><th class="num">Value</th><th class="num">Year</th><th>Grade</th><th>Source</th><th class="num">Score</th><th>Level</th><th>Origin</th></tr></thead><tbody>';
      var q = (U().dataSearch || '').toLowerCase(), filter = U().dataFilter;
      DATA.subdims.forEach(function (s) {
        if (s.code === 'IF' && !S().cfg.enable_optional) return;
        var rows = indsOf(s.code).filter(function (i) {
          var rec = (u.values || {})[i.code], pv = prepared.values[i.code], ir = r.indicators[i.code];
          if (q && i.code.toLowerCase().indexOf(q) < 0 && i.name.toLowerCase().indexOf(q) < 0) return false;
          if (filter === 'missing') return !pv;
          if (filter === 'measured') return !!rec;
          if (filter === 'derived') return pv && (pv.derived || pv.inherited);
          if (filter === 'C') return pv && pv.dq === 'C';
          return true;
        });
        if (!rows.length) return;
        html += '<tr class="group"><td colspan="9">' + s.code + ' ' + esc(s.name) + ' · ' + DIM_NAME[s.dim] + '</td></tr>';
        rows.forEach(function (i) {
          var rec = (u.values || {})[i.code], pv = prepared.values[i.code], ir = r.indicators[i.code] || {};
          var origin = rec ? '<span class="badge good">measured</span>' : pv && pv.derived ? '<span class="badge ' + (pv.approximate ? 'warn' : 'flag') + '" title="' + esc(pv.source || '') + '">derived' + (pv.approximate ? ' ≈' : '') + (pv.coverage !== undefined && pv.coverage !== null && pv.coverage < 0.999 ? ' ' + Math.round(pv.coverage * 100) + '%' : '') + '</span>' : pv && pv.inherited ? '<span class="badge flag">inherited</span>' : '<span class="badge warn">missing</span>';
          html += '<tr data-code="' + i.code + '"><td class="mono">' + i.code + '</td><td class="ind-name">' + esc(i.name) + '<div class="small faint">' + esc(i.unit) + ' · floor ' + fv(i.floor) + ', target ' + fv(i.target) + '</div></td>' +
            '<td class="num"><input class="w-s num" type="number" step="any" data-f="value" value="' + (rec ? esc(rec.value) : '') + '" placeholder="' + (pv ? fv(pv.value) : '') + '"></td>' +
            '<td class="num"><input class="w-s num" type="number" data-f="year" value="' + (rec && rec.year ? esc(rec.year) : '') + '" placeholder="' + (pv && pv.year ? pv.year : '') + '"></td>' +
            '<td><select class="w-s" data-f="dq">' + ['', 'A', 'B', 'C'].map(function (g) { return '<option value="' + g + '"' + ((rec ? rec.dq : '') === g ? ' selected' : '') + '>' + (g || (pv ? pv.dq : '–')) + '</option>'; }).join('') + '</select></td>' +
            '<td><input class="w-m" type="text" data-f="source" value="' + (rec ? esc(rec.source || '') : '') + '" placeholder="' + (pv ? esc(pv.source || '') : '') + '"></td>' +
            '<td class="num">' + f3(ir.score) + '</td><td>' + (ir.score === null || ir.score === undefined ? '' : A.levelBadge(ir.score, false)) + '</td><td>' + origin + '</td></tr>';
        });
      });
      html += '</tbody></table></div></div></div>';
      return html;
    },
    mount: function (root) {
      A.on(root, '#sel-unit', 'change', function (ev, el) { U().unit = el.value; A.rerender(); });
      A.on(root, '#data-filter', 'change', function (ev, el) { U().dataFilter = el.value; A.rerender(); });
      var sTimer = null;
      A.on(root, '#data-search', 'input', function (ev, el) { U().dataSearch = el.value; clearTimeout(sTimer); sTimer = setTimeout(function () { var pos = el.selectionStart; A.rerender(); var e2 = document.getElementById('data-search'); if (e2) { e2.focus(); e2.setSelectionRange(pos, pos); } }, 350); });
      A.on(root, '[data-reg]', 'change', function (ev, el) {
        var u = A.unitById(U().unit), k = el.getAttribute('data-reg');
        if (k === 'name' || k === 'level') u[k] = el.value; else if (el.type === 'checkbox') u[k] = !!el.checked; else { var v = parseFloat(el.value); u[k] = isNaN(v) ? null : v; }
        A.dataChanged(); A.rerender();
      });
      A.on(root, 'tr[data-code] [data-f]', 'change', function (ev, el) {
        var u = A.unitById(U().unit), code = el.closest('tr').getAttribute('data-code'), fld = el.getAttribute('data-f');
        u.values = u.values || {};
        var rec = u.values[code];
        if (fld === 'value') {
          if (el.value === '' || isNaN(parseFloat(el.value))) { delete u.values[code]; }
          else { rec = rec || { year: S().territory.reference_year, dq: 'B', source: '' }; rec.value = parseFloat(el.value); u.values[code] = rec; }
        } else {
          if (!rec) {
            var pv = T().tree.byId[u.id].values[code];
            if (!pv) { A.toast('Enter a value first'); A.rerender(); return; }
            rec = { value: pv.value, year: pv.year, dq: pv.dq, source: pv.source }; u.values[code] = rec;
          }
          if (fld === 'year') rec.year = el.value === '' ? null : parseInt(el.value, 10);
          else if (fld === 'dq') { if (el.value) rec.dq = el.value; }
          else rec.source = el.value;
        }
        A.dataChanged();
        var active = document.activeElement; var tr = el.closest('tr'); var idx = Array.prototype.indexOf.call(tr.querySelectorAll('[data-f]'), el);
        A.rerender();
        var again = document.querySelector('tr[data-code="' + code + '"]'); if (again) { var els = again.querySelectorAll('[data-f]'); if (els[idx]) els[idx].focus(); }
      });
      A.on(root, '[data-den]', 'change', function (ev, el) {
        var u = A.unitById(U().unit), code = el.getAttribute('data-den'), v = parseFloat(el.value);
        u.denominators = u.denominators || {};
        if (el.value === '' || isNaN(v)) delete u.denominators[code]; else u.denominators[code] = v;
        A.dataChanged(); A.rerender();
      });
      A.on(root, '#copy-file', 'click', function () { A.copyText(territoryFile(), 'Territory file'); });
      A.on(root, '#dl-file', 'click', function () { A.download(fileStem() + '-territory.json', territoryFile(), 'application/json'); });
      A.on(root, '#open-file', 'click', function () { A.pickFile('.json').then(function (f) { if (!f) return; try { var n = loadTerritoryText(f.text); A.toast('Territory loaded: ' + n + ' units'); A.rerender(); } catch (e) { A.toast('Could not read the file: ' + e.message); } }); });
      A.on(root, '#reset-all', 'click', function (ev, el) {
        if (el.getAttribute('data-armed')) { A.resetState(); A.toast('Westhaven data restored'); A.rerender(); }
        else { el.setAttribute('data-armed', '1'); el.textContent = 'Click again to confirm the reset'; }
      });
      A.on(root, '#add-unit', 'click', function (ev, el) {
        var parent = A.unitById(U().unit);
        var n = S().units.length + 1, id = parent.id + '-' + n;
        var level = parent.level === 'region' ? 'city' : parent.level === 'city' ? 'district' : 'precinct';
        S().units.push({ id: id, name: 'New ' + level + ' ' + n, level: level, parent: parent.id, population: 0, area: 0, dwellings: 0, elderly_share: null, values: {} });
        U().unit = id; A.dataChanged(); A.rerender(); A.toast('Unit added under ' + parent.name);
      });
      A.on(root, '#load-file', 'click', function () {
        var ta = document.getElementById('paste-file');
        try { var n = loadTerritoryText(ta.value); A.toast('Territory loaded: ' + n + ' units'); A.rerender(); }
        catch (e) { A.toast('Could not read the file: ' + e.message); }
      });
    }
  });
  function denKeys() {
    var basis = SRS.denBasis(), out = [], seen = {};
    Object.keys(basis).forEach(function (code) { var k = basis[code].key; if (!k || k === 'dwellings' || seen[k]) return; seen[k] = true; out.push({ key: k, codes: Object.keys(basis).filter(function (c) { return basis[c].key === k; }) }); });
    return out;
  }
  function denFields(u, prepared) {
    var names = DATA.den_names || {};
    return '<div class="small faint" style="margin-top:6px">Counts for the ratio indicators (a parent\'s count is the sum of its children\'s unless recorded here; without a count the indicator is derived by the fallback weighting, flagged approximate):</div>' +
      '<div class="row" style="flex-wrap:wrap;gap:8px 14px;margin-top:4px">' + denKeys().map(function (d) {
        var own = (u.denominators || {})[d.key], derived = (prepared.denominators || {})[d.key];
        return '<label class="small faint" style="display:flex;gap:6px;align-items:center" title="' + esc(d.codes.join(', ')) + '">' + esc(names[d.key] || d.key) + ' <input class="w-s num" type="number" min="0" step="1" data-den="' + esc(d.key) + '" value="' + (own !== undefined ? esc(own) : '') + '" placeholder="' + (derived !== undefined ? derived : '—') + '" style="width:90px;min-height:26px"></label>';
      }).join('') + '</div>';
  }
  function problemList(problems, emptyText) {
    if (!problems.length) return '<p class="small muted" style="margin-top:8px"><span class="badge good">✓</span> ' + emptyText + '</p>';
    var errs = problems.filter(function (p) { return p.severity === 'error'; }).length;
    return '<ul class="checklist small" style="margin-top:10px">' + problems.map(function (p) {
      return '<li><span class="badge ' + (p.severity === 'error' ? 'serious' : 'warn') + '">' + (p.severity === 'error' ? '✕' : '!') + '</span><span><b class="mono">' + esc(p.id) + '</b> ' + esc(p.message) + '</span></li>';
    }).join('') + '</ul>' + (errs ? '<p class="small" style="margin-top:6px">' + errs + ' error' + (errs > 1 ? 's' : '') + ': the record is not admissible until they are fixed (Manual 4.3; Reference Part B.2).</p>' : '');
  }
  function registerProblems(uid) {
    var all = SRS.validateTerritory(S().units), mine = all.filter(function (p) { return p.id === uid; });
    var others = all.length - mine.length, errsAll = all.filter(function (p) { return p.severity === 'error'; }).length;
    return '<h4 style="margin-top:12px">Register completeness</h4>' + problemList(mine, 'this unit\'s register entry and values are complete') +
      (others ? '<p class="small muted" style="margin-top:6px">' + others + ' further note' + (others > 1 ? 's' : '') + ' on other units' + (errsAll ? ', ' + errsAll + ' of them errors' : '') + '; select each unit to read them.</p>' : '');
  }
  function registerCheck(uid) {
    var t = T(), kids = t.tree.children[uid];
    if (!kids.length) return '<p class="small muted" style="margin-top:8px">No children: this unit\'s values are measured or inherited, never derived.</p>';
    var u = A.unitById(uid), out = [];
    ['population', 'area', 'dwellings'].forEach(function (k) {
      var s = kids.reduce(function (a, c) { return a + (A.unitById(c)[k] || 0); }, 0);
      var ok = Math.abs(s - (u[k] || 0)) <= Math.max(1, 0.005 * (u[k] || 0));
      out.push('<li><span class="badge ' + (ok ? 'good' : 'warn') + '">' + (ok ? '✓' : '!') + '</span><span>' + k + ': children sum to ' + fv(s) + ', parent records ' + fv(u[k]) + '</span></li>');
    });
    return '<ul class="checklist small" style="margin-top:10px">' + out.join('') + '</ul>';
  }

  // =====================================================================
  // DIMENSION LEAD
  // =====================================================================
  A.registerScreen('dimension', {
    render: function () {
      ensureUnit();
      var uid = U().unit, d = U().dim, r = res(uid), t = T();
      var controls = '<label class="control"><span>Dimension</span><select id="sel-dim">' + DIMS.map(function (x) { return '<option value="' + x + '"' + (x === d ? ' selected' : '') + '>' + DIM_NAME[x] + '</option>'; }).join('') + '</select></label><label class="control"><span>Territory unit</span>' + A.unitSelect('sel-unit', uid) + '</label>';
      var html = pageHead('Dimension lead · ' + DIM_NAME[d], DIM_NAME[d] + ' in ' + esc(r.name), 'Each sub-dimension with its indicators on the five-band scale, the obstacle degrees that rank what to act on, and a comparison of this unit\'s children or peers sub-dimension by sub-dimension.', controls);
      var dr = r.dims[d];
      html += '<div class="tiles"><div class="tile hero"><span class="label"><span class="swatch" style="background:' + A.dimColor(d) + '"></span>' + DIM_NAME[d] + '</span><span class="v">' + f3(dr.score) + '</span><span>' + A.levelBadge(dr.score) + (r.balance && r.balance.lagging.indexOf(d) >= 0 ? ' <span class="badge warn">▼ lagging by ' + f2(r.balance.lag_size[d]) + '</span>' : '') + '</span>' + A.track(dr.score, { lg: true }) + '</div>' +
        subsOf(d).map(function (s) { var sr = r.subs[s.code]; return '<div class="tile"><span class="label">' + s.code + ' ' + esc(s.name) + '</span><span class="v sm">' + f3(sr.score) + '</span><span>' + A.levelBadge(sr.score) + (sr.rated ? '' : ' <span class="badge warn">not rated</span>') + '</span>' + A.track(sr.score) + '</div>'; }).join('') + '</div>';
      // sub-dimension drill-down
      html += '<div class="section"><h2>Indicators by sub-dimension</h2><p class="lede">The marker shows the indicator\'s score on the band scale; the five bands are the levels Critical, Weak, Developing, Established and Leading at 0.2 steps. Click an indicator for its definition, method, source and the band boundaries in its own units.</p>';
      subsOf(d).forEach(function (s) {
        var sr = r.subs[s.code];
        html += '<div class="panel" style="margin-bottom:12px"><div class="panel-head"><h3>' + s.code + ' ' + esc(s.name) + '</h3><span class="small muted">' + sr.n_present + ' of ' + sr.n_total + ' present · weight present ' + pc(sr.weight_share_present) + ' · ' + (sr.rated ? 'rated' : 'not rated: fewer than 3 indicators or less than 50 % of weight') + '</span></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Indicator</th><th class="num">Value</th><th style="min-width:160px">Score on the band scale</th><th class="num">Score</th><th>Level</th><th class="num">Obstacle</th><th>Flags</th></tr></thead><tbody>';
        var obs = {}; (r.obstacles[d] || []).forEach(function (tpl) { obs[tpl[0]] = tpl[1]; });
        indsOf(s.code).forEach(function (i) {
          var ir = r.indicators[i.code] || { value: null, score: null };
          html += '<tr class="clickable" data-ind="' + i.code + '"><td class="mono">' + i.code + '</td><td>' + esc(i.name) + '</td><td class="num">' + (ir.value === null ? '<span class="badge warn">missing</span>' : fv(ir.value) + ' <span class="faint small">' + esc(i.unit) + '</span>') + '</td><td>' + A.track(ir.score) + '</td><td class="num">' + f3(ir.score) + '</td><td>' + (ir.score === null ? '' : A.levelBadge(ir.score)) + '</td><td class="num">' + (obs[i.code] !== undefined ? pc(obs[i.code], 1) : '–') + '</td><td>' + (ir.inherited ? '<span class="badge flag">inherited</span>' : ir.derived ? '<span class="badge flag">derived</span>' : '') + (ir.dq ? ' <span class="badge">' + ir.dq + '</span>' : '') + '</td></tr>';
        });
        html += '</tbody></table></div></div>';
      });
      html += '</div>';
      // obstacle ranking + comparison
      var kids = t.tree.children[uid];
      var cmpIds = kids.length ? [uid].concat(kids) : (A.unitById(uid).parent ? t.tree.children[A.unitById(uid).parent] : [uid]);
      var cmpTitle = kids.length ? esc(r.name) + ' and its children' : esc(r.name) + ' and its peers';
      var SHORT = { EN: 'Environmental', SE: 'Social and equity', EC: 'Economic', IF: 'Institutional', RB: 'Robustness', RD: 'Redundancy', RF: 'Resourcefulness', RP: 'Rapidity', DI: 'Digital infrastructure', SS: 'Smart services', DG: 'Data governance' };
      html += '<div class="section grid two-one"><div class="panel"><h3>' + cmpTitle + ', sub-dimension by sub-dimension</h3><p class="small muted" style="margin-bottom:8px">Bars share one 0–1 scale; the selected unit is drawn in the dimension colour and the others in grey.</p><div class="chart-wrap">' +
        A.groupedBars(subsOf(d).map(function (s) { return { label: s.code + ' ' + (SHORT[s.code] || s.code), bars: cmpIds.map(function (k) { var rr = res(k); return { name: rr.name, value: rr.subs[s.code].score, color: k === uid ? A.dimColor(d) : 'var(--fg-3)', tip: rr.name + ' — ' + s.code + ': ' + f3(rr.subs[s.code].score) }; }) }; }), { label: 'Comparison of units by sub-dimension' }) +
        '</div><div class="legend">' + cmpIds.map(function (k) { return '<span><span class="swatch" style="background:' + (k === uid ? A.dimColor(d) : 'var(--fg-3)') + '"></span>' + esc(unitName(k)) + '</span>'; }).join('') + '</div></div>' +
        '<div class="panel"><h3>Obstacle ranking</h3><p class="small muted" style="margin-bottom:8px">Where the distance to target is concentrated. Acting on the top entries moves the dimension most per unit of indicator change.</p>' + obstacleList(r, d, 8) + '</div></div>';
      // indicator detail
      if (U().indicator && IND[U().indicator]) html += '<div class="section" id="ind-detail">' + indicatorDetail(U().indicator, r) + '</div>';
      return html;
    },
    mount: function (root) {
      A.on(root, '#sel-unit', 'change', function (ev, el) { U().unit = el.value; A.rerender(); });
      A.on(root, '#sel-dim', 'change', function (ev, el) { U().dim = el.value; A.rerender(); });
      A.on(root, 'tr[data-ind]', 'click', function (ev, el) { U().indicator = el.getAttribute('data-ind'); A.rerender(); var d = document.getElementById('ind-detail'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    }
  });
  function indicatorDetail(code, r) {
    var i = IND[code], tx = i.text || {}, bands = SRS.bandValues(i.floor, i.target), ir = r ? r.indicators[code] : null;
    return '<div class="panel"><div class="panel-head"><h2><span class="mono">' + code + '</span> ' + esc(i.name) + '</h2><span class="small muted">' + esc(i.ref) + ' · basis grade ' + i.grade + '</span></div><div class="grid c2"><div class="dl"><p><b>Definition.</b> ' + esc(tx.definition || '') + '</p><p><b>Method.</b> ' + esc(tx.method || '') + '</p><p><b>Source.</b> ' + esc(tx.source || '') + '</p><p><b>Levels.</b> ' + esc(tx.levels_note || '') + '</p><p><b>Pitfalls.</b> ' + esc(tx.pitfalls || '') + '</p>' + (tx.basis_note ? '<p><b>Basis of floor and target.</b> ' + esc(tx.basis_note) + '</p>' : '') + '<p><b>Aggregation.</b> ' + esc(A.AGG_TEXT[i.agg]) + ' (' + i.agg + '); measured at ' + i.levels.split('').map(function (c) { return { R: 'region', C: 'city', D: 'district', P: 'precinct' }[c]; }).join(', ') + '.</p></div>' +
      '<div><h4>Scoring bands in ' + esc(i.unit) + '</h4><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Level</th><th class="num">From</th><th class="num">To</th></tr></thead><tbody>' +
      [['1 Critical', i.floor, bands[0]], ['2 Weak', bands[0], bands[1]], ['3 Developing', bands[1], bands[2]], ['4 Established', bands[2], bands[3]], ['5 Leading', bands[3], i.target]].map(function (b, k) { return '<tr><td><span class="badge lvl-' + (k + 1) + '">' + b[0] + '</span></td><td class="num">' + fv(b[1]) + '</td><td class="num">' + fv(b[2]) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="small muted" style="margin-top:8px">Floor ' + fv(i.floor) + ' scores 0 and target ' + fv(i.target) + ' scores 1' + (i.floor > i.target ? '; lower values are better' : '') + '. Values beyond the bounds are clipped.</p>' + (ir && ir.value !== null ? '<p class="small" style="margin-top:6px">In ' + esc(r.name) + ': value ' + fv(ir.value) + ', score ' + f3(ir.score) + ', ' + A.levelBadge(ir.score) + '</p>' : '') + '</div></div></div>';
  }

  // =====================================================================
  // PROJECT APPRAISER
  // =====================================================================
  A.registerScreen('appraiser', {
    guard: [{ part: 'options', sel: '#new-opt, [data-edit], [data-dup], [data-del], #save-bundle, [data-delbundle], #bundle-name, #lib-merge, #lib-replace', why: 'The option library and saved bundles are kept by the project appraisers.' }, { part: 'config', sel: '#sel-readiness', why: 'The readiness setting belongs to the configuration record.' }],
    render: function () {
      ensureUnit();
      var ui = U(), st = S(), appUnit = ui.appraisalUnit, t = T();
      ui.selected = ui.selected.filter(function (id) { return A.optionById(id); });
      var controls = '<label class="control"><span>Appraisal unit</span>' + A.unitSelect('sel-appunit', appUnit) + '</label>' +
        '<label class="control"><span>Readiness</span><select id="sel-readiness">' + ['none', 'partial', 'mature'].map(function (k) { return '<option value="' + k + '"' + (st.readiness === k ? ' selected' : '') + '>' + k + ' (× ' + SRS.defaults().readiness_multiplier[k].toFixed(1) + ')</option>'; }).join('') + '</select></label>' +
        '<label class="control"><span>Year after completion</span><div class="year-slider"><input type="range" id="sel-year" min="0" max="8" value="' + ui.year + '"><b id="year-lbl">' + (ui.year ? 'year ' + ui.year : 'full effect') + '</b></div></label>';
      var html = pageHead('Project appraiser', 'Appraisal on ' + esc(unitName(appUnit)), 'Choose options from the library or write your own effect sheet, then read the contribution statement: the change to every sub-dimension and dimension after the thirteen interaction checks, the readiness multiplier and the lag profile, and the effect on D and L.', controls);
      // bundles row
      html += '<div class="panel"><div class="panel-head"><h3>Bundles</h3><span class="small muted">load a preset, or save the current selection under a name</span></div><div class="row">' + A.allBundles().map(function (b) { var same = b.options.length === ui.selected.length && b.options.every(function (o) { return ui.selected.indexOf(o) >= 0; }); return '<button class="btn small' + (same ? ' primary' : '') + '" data-bundle="' + esc(b.id) + '" title="' + esc(b.options.join(', ')) + '">' + esc(b.id) + ' ' + esc(b.name) + '</button>' + (b.custom ? '<button class="btn small danger" data-delbundle="' + esc(b.id) + '" title="delete">×</button>' : ''); }).join('') + '<span style="flex:1"></span><input type="text" id="bundle-name" placeholder="name for the current selection" style="min-width:200px"><button class="btn small" id="save-bundle">Save selection</button><button class="btn small" id="clear-sel">Clear</button></div><div class="row" style="margin-top:10px"><span class="small muted">Option library:</span><button class="btn small" id="lib-dl">Download</button><button class="btn small" id="lib-copy">Copy</button><button class="btn small" id="lib-merge">Load and merge</button><button class="btn small" id="lib-replace">Load and replace</button><span class="small faint">a library file holds every option and saved bundle; merging keeps your options and overwrites those with the same identifier</span></div></div>';
      // option library
      var recProblems = SRS.validateOptions(st.options, st.units, st.goals);
      html += '<div class="section"><div class="panel"><div class="panel-head"><h3>Intervention records</h3><span class="small muted">each option is checked before an appraisal: unit, indicators, tags, lag class, flags, effect forms, bases and grades (Manual 4.3; Reference Part B.2)</span></div>' +
        problemList(recProblems, 'all ' + st.options.length + ' option records are complete') + '</div></div>';
      html += '<div class="section"><h2>Option library</h2><p class="lede">Tick the options to include. Each card names the unit the option acts on, its lag class, its tags (which drive the interaction checks) and its effect sheet.</p><div class="cards">';
      st.options.forEach(function (o) {
        var on = ui.selected.indexOf(o.id) >= 0;
        html += '<div class="card' + (on ? ' on' : '') + '"><div class="ttl"><label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer"><input type="checkbox" data-opt="' + esc(o.id) + '"' + (on ? ' checked' : '') + '><b>' + esc(o.id) + ' ' + esc(o.name) + '</b></label></div><div class="meta"><span>acts on <b>' + esc(unitName(o.unit)) + '</b></span><span>lag: ' + esc(o.lag_class || 'programme') + '</span><span>capex ' + money(o.capex_m) + '</span><span>opex ' + money(o.opex_m) + ' p.a.</span></div><div class="tags">' + (o.tags || []).map(function (tg) { return '<span class="tag">' + esc(tg) + '</span>'; }).join('') + optionFlags(o) + '</div><details class="drawer"><summary class="small">effect sheet (' + (o.effects || []).length + ')</summary><div class="body small">' + (o.effects || []).map(function (e) { return '<div><span class="mono">' + esc(e.code) + '</span> @ ' + esc(unitName(e.unit)) + ': ' + effectText(e) + '</div>'; }).join('') + '</div></details><div class="row"><button class="btn small" data-edit="' + esc(o.id) + '">Edit</button><button class="btn small" data-dup="' + esc(o.id) + '">Duplicate</button>' + (o.custom ? '<button class="btn small danger" data-del="' + esc(o.id) + '">Delete</button>' : '') + '</div></div>';
      });
      html += '<div class="card" style="justify-content:center;align-items:center;border-style:dashed"><button class="btn primary" id="new-opt">+ New option</button><span class="small muted">write an effect sheet from scratch</span></div></div></div>';
      // editor
      if (ui.editing) html += '<div class="section" id="opt-editor">' + optionEditor(ui.editing) + '</div>';
      // results
      if (!ui.selected.length) { html += '<div class="section"><div class="callout">Select at least one option to see its contribution statement.</div></div>'; return html; }
      var app;
      try { app = A.appraise(ui.selected, { readiness: st.readiness, year: ui.year || null }); }
      catch (e) { if (e && e.name === 'ValidationError') { html += '<div class="section"><div class="callout warn"><b>The appraisal cannot run:</b> ' + esc(e.message) + '. Fix the record in the option editor and try again.</div></div>'; return html; } throw e; }
      var r = app.results[appUnit], c = r.contribution;
      html += '<div class="section"><h2>Contribution statement for ' + esc(unitName(appUnit)) + '</h2><p class="lede">' + (ui.year ? 'Effects scaled to year ' + ui.year + ' of each option\'s lag profile.' : 'Full effect at completion.') + ' Readiness ' + esc(st.readiness) + '. Options in scope of this unit: ' + r.options.join(', ') + '.</p>';
      if (!c.balance) { html += '<div class="callout warn">The unit is not rated before or after the options, so no contribution can be stated.</div>'; return html; }
      var ca0 = c.balance.capability_before.M, ca1 = c.balance.capability_after.M;
      html += '<div class="tiles"><div class="tile hero"><span class="label">Balanced performance B</span><span class="v">' + f3(c.balance.B_before) + ' → ' + f3(c.balance.B_after) + '</span><span>' + A.levelBadge(c.balance.B_after) + ' <span class="small ' + A.deltaClass(c.balance.B_after - c.balance.B_before) + '">' + fd(c.balance.B_after - c.balance.B_before) + '</span></span></div><div class="tile"><span class="label">Coordination degree D</span><span class="v sm">' + f3(c.balance.D_before) + ' → ' + f3(c.balance.D_after) + '</span><span>' + A.stageBadge(c.balance.stage_after) + '</span></div><div class="tile"><span class="label">Outcome lag after</span><span class="v sm">' + (c.balance.lagging_after.length ? c.balance.lagging_after.map(function (d) { return DIM_NAME[d]; }).join(', ') : 'none') + '</span><span class="d">before: ' + (c.balance.lagging_before.length ? c.balance.lagging_before.map(function (d) { return DIM_NAME[d]; }).join(', ') : 'none') + '</span></div><div class="tile"><span class="label">Digital capability</span><span class="v sm">' + (ca1.score === null ? '–' : f3(ca0.score) + ' → ' + f3(ca1.score)) + '</span><span class="d">' + (ca1.score === null ? 'not rated' : (ca1.trails ? 'trails the outcomes by ' + f2(ca1.gap) : 'keeps pace with the outcomes') + (ca0.trails && !ca1.trails ? ' (gap closed)' : '')) + '</span></div></div>';
      html += '<div class="grid c2" style="margin-top:16px"><div class="panel"><h3>Dimensions before and after</h3>' + DIMS.map(function (d) { var x = c.dims[d]; return A.hbar('<span class="swatch" style="background:' + A.dimColor(d) + '"></span>' + DIM_NAME[d], x.after, 'fill-' + d, { ghost: x.before }) + '<div class="small muted" style="margin:-2px 0 8px 130px">before ' + f3(x.before) + ' · change <b class="' + A.deltaClass(x.change) + '">' + fd(x.change) + '</b> · gap closed ' + pc(x.gap_closed, 1) + '</div>'; }).join('') + '</div>' +
        '<div class="panel"><h3>Checks and multipliers applied at this unit</h3>' + (r.notes.length ? '<ul class="note-list">' + r.notes.map(function (n) { return '<li class="' + (/^IC\d+/.test(n) ? 'check' : 'mult') + '">' + esc(n) + '</li>'; }).join('') + '</ul>' : '<p class="muted small">No check fired and no multiplier applied at this unit.</p>') + (r.log.length ? '<details class="drawer" style="margin-top:8px"><summary class="small">effect log (' + r.log.length + ')</summary><div class="body small">' + r.log.map(function (n) { return '<div>' + esc(n) + '</div>'; }).join('') + '</div></details>' : '') + '</div></div>';
      // sub-dimension table
      html += '<div class="panel" style="margin-top:16px"><h3>Sub-dimension changes</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Sub-dimension</th><th class="num">Before</th><th class="num">Raw after</th><th class="num">Check trim</th><th class="num">After</th><th class="num">Change</th><th class="num">Gap closed</th></tr></thead><tbody>' +
        Object.keys(c.subs).map(function (s) { var x = c.subs[s]; return '<tr><td><span class="mono">' + s + '</span> ' + esc(SUB[s].name) + '</td><td class="num">' + f3(x.before) + '</td><td class="num">' + f3(r.post_raw.subs[s].score) + '</td><td class="num ' + A.deltaClass(r.adjustments[s] || 0) + '">' + (r.adjustments[s] ? fd(r.adjustments[s]) : '') + '</td><td class="num"><b>' + f3(x.after) + '</b></td><td class="num ' + A.deltaClass(x.change) + '">' + fd(x.change) + '</td><td class="num">' + pc(x.gap_closed, 1) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
      // per unit
      var sub = A.subtree(appUnit);
      if (sub.length > 1) {
        html += '<div class="panel" style="margin-top:16px"><h3>Every unit in the hierarchy</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Unit</th><th class="num">ΔS</th><th class="num">ΔR</th><th class="num">ΔM</th><th class="num">D before</th><th class="num">D after</th><th>Stage after</th><th>Lag after</th><th>Checks fired</th></tr></thead><tbody>' + sub.map(function (e) {
          var rr = app.results[e.id], cc = rr.contribution; if (!cc.balance) return '<tr><td>' + esc(unitName(e.id)) + '</td><td colspan="8" class="muted">not rated</td></tr>';
          var fired = rr.notes.filter(function (n) { return /^IC\d+/.test(n); }).map(function (n) { return n.match(/^(IC\d+)/)[1]; });
          return '<tr><td style="padding-left:' + (10 + e.depth * 16) + 'px"><b>' + esc(unitName(e.id)) + '</b></td>' + DIMS.map(function (d) { return '<td class="num ' + A.deltaClass(cc.dims[d].change) + '">' + fd(cc.dims[d].change) + '</td>'; }).join('') + '<td class="num">' + f3(cc.balance.D_before) + '</td><td class="num"><b>' + f3(cc.balance.D_after) + '</b></td><td>' + A.stageBadge(cc.balance.stage_after) + '</td><td>' + (cc.balance.lagging_after.length ? cc.balance.lagging_after.map(function (d) { return DIM_NAME[d]; }).join(', ') : 'none') + '</td><td class="small">' + (fired.length ? fired.filter(function (x, i, a) { return a.indexOf(x) === i; }).join(', ') : 'none') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
      }
      // year profile
      var prof = SRS.yearProfile(st.units, ui.selected.map(A.optionById).filter(Boolean), { readiness: st.readiness, cfg: st.cfg }, appUnit, 8);
      html += '<div class="panel" style="margin-top:16px"><h3>Year-by-year profile</h3><p class="small muted">Each option reaches its full effect along the lag profile of its class (Manual Part 4.6). Year 0 is the baseline.</p><div class="chart-wrap">' + profileChart(prof) + '</div>' + profileLegend() + '<div class="tbl-wrap" style="margin-top:8px"><table class="tbl small"><thead><tr><th>Year</th>' + prof.map(function (p) { return '<th class="num">' + p.year + '</th>'; }).join('') + '</tr></thead><tbody>' + [['B', 'L'], ['D', 'D'], ['S', 'S'], ['R', 'R'], ['M', 'M']].map(function (k) { return '<tr><td><b>' + k[0] + '</b></td>' + prof.map(function (p) { return '<td class="num">' + f3(p[k[1]]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div></div>';
      // statement text
      html += '<div class="panel" style="margin-top:16px"><div class="panel-head"><h3>Statement for the appraisal report</h3><button class="btn small" id="copy-statement">Copy</button></div><div class="pre" id="statement">' + esc(statementText(appUnit, r, app)) + '</div></div>';
      html += '</div>';
      // bundle comparison
      var brs = bundleRows(appUnit, st.readiness);
      var bt = bundleTable(brs, appUnit, null);
      html += '<div class="section"><h2>Bundle comparison</h2><p class="lede">All saved bundles at full effect on ' + esc(unitName(appUnit)) + ' with readiness ' + esc(st.readiness) + ', ranked by the rule of Manual Part 4.8. ' + RANK_RULE + ' Cost per point is capex divided by the dimension score gained, in hundredths.</p>' + bt.html + '</div>';
      return html;
    },
    mount: function (root) {
      var ui = U(), st = S();
      A.on(root, '#sel-appunit', 'change', function (ev, el) { ui.appraisalUnit = el.value; A.rerender(); });
      A.on(root, '#sel-readiness', 'change', function (ev, el) { st.readiness = el.value; A.dataChanged(); A.rerender(); });
      var yt = null;
      A.on(root, '#sel-year', 'input', function (ev, el) { var lbl = document.getElementById('year-lbl'); lbl.textContent = el.value === '0' ? 'full effect' : 'year ' + el.value; clearTimeout(yt); yt = setTimeout(function () { ui.year = parseInt(el.value, 10); A.rerender(); }, 250); });
      A.on(root, '[data-opt]', 'change', function (ev, el) { var id = el.getAttribute('data-opt'); var i = ui.selected.indexOf(id); if (el.checked && i < 0) ui.selected.push(id); if (!el.checked && i >= 0) ui.selected.splice(i, 1); A.rerender(); });
      A.on(root, '[data-bundle]', 'click', function (ev, el) { var b = A.allBundles().filter(function (x) { return x.id === el.getAttribute('data-bundle'); })[0]; if (b) { ui.selected = b.options.slice(); A.rerender(); } });
      A.on(root, '[data-delbundle]', 'click', function (ev, el) { delete st.customBundles[el.getAttribute('data-delbundle')]; A.persist(); A.rerender(); });
      A.on(root, '#save-bundle', 'click', function () { var nm = document.getElementById('bundle-name').value.trim(); if (!nm || !ui.selected.length) { A.toast('Give the selection a name'); return; } var id = 'U' + (Object.keys(st.customBundles).length + 1); while (st.customBundles[id] || st.bundles[id]) id = id + 'x'; st.customBundles[id] = { name: nm, options: ui.selected.slice() }; A.persist(); A.rerender(); A.toast('Bundle ' + id + ' saved'); });
      A.on(root, '#clear-sel', 'click', function () { ui.selected = []; A.rerender(); });
      A.on(root, '#lib-dl', 'click', function () { A.download(fileStem() + '-option-library.json', optionLibraryFile(), 'application/json'); });
      A.on(root, '#lib-copy', 'click', function () { A.copyText(optionLibraryFile(), 'Option library'); });
      A.on(root, '#lib-merge', 'click', function () { if (!A.can('options')) { A.toast('Your role cannot change the option library'); return; } A.pickFile('.json').then(function (f) { if (!f) return; try { var r = loadOptionLibraryText(f.text, 'merge'); A.toast(r.added + ' options added, ' + r.replaced + ' replaced'); A.rerender(); } catch (e) { A.toast('Could not read the file: ' + e.message); } }); });
      A.on(root, '#lib-replace', 'click', function () { if (!A.can('options')) { A.toast('Your role cannot change the option library'); return; } A.pickFile('.json').then(function (f) { if (!f) return; try { var r = loadOptionLibraryText(f.text, 'replace'); A.toast('Library replaced: ' + r.added + ' options'); A.rerender(); } catch (e) { A.toast('Could not read the file: ' + e.message); } }); });
      A.on(root, '#new-opt', 'click', function () { ui.editing = newOption(); A.rerender(); scrollToEditor(); });
      A.on(root, '[data-edit]', 'click', function (ev, el) { ui.editing = JSON.parse(JSON.stringify(A.optionById(el.getAttribute('data-edit')))); ui.editing._orig = el.getAttribute('data-edit'); A.rerender(); scrollToEditor(); });
      A.on(root, '[data-dup]', 'click', function (ev, el) { var o = JSON.parse(JSON.stringify(A.optionById(el.getAttribute('data-dup')))); o.id = o.id + 'c'; while (A.optionById(o.id)) o.id += 'c'; o.name = o.name + ' (copy)'; o.custom = true; delete o._orig; ui.editing = o; A.rerender(); scrollToEditor(); });
      A.on(root, '[data-del]', 'click', function (ev, el) { var id = el.getAttribute('data-del'); st.options = st.options.filter(function (o) { return o.id !== id; }); ui.selected = ui.selected.filter(function (x) { return x !== id; }); A.dataChanged(); A.rerender(); });
      A.on(root, '#copy-statement', 'click', function () { A.copyText(document.getElementById('statement').textContent, 'Statement'); });
      mountEditor(root);
    }
  });
  function scrollToEditor() { var e = document.getElementById('opt-editor'); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function optionFlags(o) {
    var f = [];
    if (o.cyber_exposure) f.push('cyber exposure');
    if (o.couples_systems) f.push('couples ' + o.couples_systems + ' system' + (o.couples_systems > 1 ? 's' : ''));
    if (o.backup_days) f.push(o.backup_days + ' days backup');
    if (o.operating_load) f.push('operating load');
    if (o.on_site_generation) f.push('on-site generation');
    if (o.consolidates_capacity === false) f.push('keeps capacity');
    if (o.density_after) f.push('density after ' + o.density_after.toLocaleString('en-GB') + '/km²');
    return f.map(function (x) { return '<span class="badge flag">' + x + '</span>'; }).join('');
  }
  function effectText(e) {
    if (e.set !== undefined) return 'set to ' + fv(e.set);
    if (e.delta !== undefined) return (e.delta >= 0 ? '+' : '−') + fv(Math.abs(e.delta)) + (e.basis ? ' (' + e.basis + ')' : '');
    if (e.reduce_by !== undefined) return 'reduce the gap to target by ' + pc(e.reduce_by);
    return '';
  }
  function statementText(uid, r, app) {
    var c = r.contribution, L = [];
    L.push('CONTRIBUTION STATEMENT — ' + unitName(uid));
    if (syntheticText()) L.push(syntheticText());
    L.push('Options: ' + U().selected.join(', ') + ' · readiness ' + S().readiness + ' · ' + (U().year ? 'year ' + U().year + ' after completion' : 'full effect') + ' · configuration ' + S().territory.configuration_version);
    L.push('');
    DIMS.forEach(function (d) { var x = c.dims[d]; L.push(DIM_NAME[d] + ': ' + f3(x.before) + ' → ' + f3(x.after) + ' (' + fd(x.change) + ', ' + pc(x.gap_closed, 1) + ' of gap closed)'); });
    L.push('B (balanced performance): ' + f3(c.balance.B_before) + ' → ' + f3(c.balance.B_after) + ' (level ' + SRS.levelOf(c.balance.B_before).level + ' → ' + SRS.levelOf(c.balance.B_after).level + ')');
    L.push('D: ' + f3(c.balance.D_before) + ' → ' + f3(c.balance.D_after) + ' (' + c.balance.stage_before + ' → ' + c.balance.stage_after + '); C: ' + f3(c.balance.C_before) + ' → ' + f3(c.balance.C_after));
    var cb = c.balance.capability_before.M, cf = c.balance.capability_after.M;
    if (cf.score !== null) L.push('Digital capability: ' + f3(cb.score) + ' → ' + f3(cf.score) + (cf.trails ? ', trailing the outcomes by ' + f2(cf.gap) : ', keeping pace with the outcomes'));
    L.push('Outcome lag before: ' + (c.balance.lagging_before.length ? c.balance.lagging_before.map(function (d) { return DIM_NAME[d]; }).join(', ') : 'none') + '; after: ' + (c.balance.lagging_after.length ? c.balance.lagging_after.map(function (d) { return DIM_NAME[d]; }).join(', ') : 'none'));
    L.push('');
    L.push('Sub-dimensions (before → after, change, gap closed):');
    Object.keys(c.subs).forEach(function (s) { var x = c.subs[s]; L.push('  ' + s + ' ' + f3(x.before) + ' → ' + f3(x.after) + ' (' + fd(x.change) + ', ' + pc(x.gap_closed, 1) + ')'); });
    L.push('');
    L.push('Checks and multipliers at this unit:');
    if (r.notes.length) r.notes.forEach(function (n) { L.push('  ' + n); }); else L.push('  none');
    var fired = checksAnywhere(app, uid);
    L.push('Checks fired anywhere in the hierarchy: ' + (fired.length ? fired.join(', ') : 'none'));
    return L.join('\n');
  }
  function newOption() {
    var n = 1; while (A.optionById('N' + n)) n++;
    return { id: 'N' + n, name: 'New option', unit: U().appraisalUnit, tags: [], lag_class: 'programme', capex_m: 0, opex_m: 0, effects: [{ unit: U().appraisalUnit, code: 'EN1', delta: 0 }], custom: true };
  }
  function optionEditor(o) {
    var units = A.unitsInDisplayOrder();
    function usel(name, val) { return '<select data-ef="' + name + '">' + units.map(function (e) { return '<option value="' + esc(e.unit.id) + '"' + (e.unit.id === val ? ' selected' : '') + '>' + esc(e.unit.name) + '</option>'; }).join('') + '</select>'; }
    var html = '<div class="panel"><div class="panel-head"><h2>' + (o._orig ? 'Edit option ' + esc(o._orig) : 'New option') + '</h2><span class="small muted">the tags and flags drive the thirteen interaction checks; the lag class sets the ramp to full effect</span></div><div class="form">' +
      '<label>Identifier<input type="text" data-o="id" value="' + esc(o.id) + '"></label><label>Name<input type="text" data-o="name" value="' + esc(o.name) + '"></label>' +
      '<label>Acts on unit<select data-o="unit">' + units.map(function (e) { return '<option value="' + esc(e.unit.id) + '"' + (e.unit.id === o.unit ? ' selected' : '') + '>' + esc(e.unit.name) + '</option>'; }).join('') + '</select></label>' +
      '<label>Lag class<select data-o="lag_class">' + A.LAG_CLASSES.map(function (k) { return '<option' + (o.lag_class === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></label>' +
      '<label>Capex (M)<input type="number" step="any" data-o="capex_m" value="' + esc(o.capex_m) + '"></label><label>Opex (M p.a.)<input type="number" step="any" data-o="opex_m" value="' + esc(o.opex_m) + '"></label>' +
      '<label>Basis of the estimates<input type="text" data-o="basis" placeholder="e.g. hydraulic model of the works, 2025" value="' + esc(o.basis || '') + '"></label><label>Estimate grade<select data-o="estimate_grade">' + ['', 'A', 'B', 'C'].map(function (g) { return '<option value="' + g + '"' + ((o.estimate_grade || '') === g ? ' selected' : '') + '>' + (g || '— not graded') + '</option>'; }).join('') + '</select></label>' +
      '<label>Start (year)<input type="number" data-o="start" value="' + esc(o.start || '') + '"></label><label>Completion (year)<input type="number" data-o="completion" value="' + esc(o.completion || '') + '"></label><label>Status<select data-o="status">' + ['candidate', 'approved', 'in delivery', 'complete', 'superseded'].map(function (x) { return '<option' + ((o.status || 'candidate') === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label><label>Backup days of coupled systems<input type="number" min="0" data-o="backup_days" value="' + esc(o.backup_days === undefined ? '' : o.backup_days) + '"></label>' +
      '<label>Cyber exposure (0/1)<input type="number" min="0" max="1" data-o="cyber_exposure" value="' + esc(o.cyber_exposure || 0) + '"></label><label>Couples systems (count)<input type="number" min="0" data-o="couples_systems" value="' + esc(o.couples_systems || 0) + '"></label><label>Backup days<input type="number" min="0" data-o="backup_days" value="' + esc(o.backup_days || 0) + '"></label><label>Density after (persons/km², TOD only)<input type="number" data-o="density_after" value="' + esc(o.density_after || '') + '"></label>' +
      '<label class="chk"><input type="checkbox" data-o="operating_load"' + (o.operating_load ? ' checked' : '') + '> operating energy load</label><label class="chk"><input type="checkbox" data-o="on_site_generation"' + (o.on_site_generation ? ' checked' : '') + '> on-site generation</label><label class="chk"><input type="checkbox" data-o="consolidates_capacity"' + (o.consolidates_capacity !== false ? ' checked' : '') + '> consolidates capacity (efficiency options)</label>' +
      '</div><h4 style="margin-top:14px">Tags</h4><div class="row">' + A.TAG_LIST.map(function (tg) { return '<label class="small" style="display:inline-flex;gap:4px;align-items:center"><input type="checkbox" data-tag="' + tg + '"' + ((o.tags || []).indexOf(tg) >= 0 ? ' checked' : '') + '>' + tg + '</label>'; }).join('') + '</div>' +
      '<h4 style="margin-top:14px">City goals this record claims to serve</h4><div class="row">' + (S().goals || []).map(function (g) { return '<label class="small" style="display:inline-flex;gap:4px;align-items:center" title="' + esc(g.statement) + '"><input type="checkbox" data-goal="' + esc(g.id) + '"' + ((o.goals || []).indexOf(g.id) >= 0 ? ' checked' : '') + '>' + esc(g.id) + '</label>'; }).join('') + '<span class="small faint">the calculator reports whether each claim is borne out by the effect sheet (Project manager page)</span></div>' +
      '<h4 style="margin-top:14px">Effect sheet</h4><p class="small muted" style="margin-bottom:6px">set: the value after completion; delta: added to the baseline value; reduce by: proportional reduction of the gap to target (0–1), combined across options as 1 − Π(1 − r).</p><div class="effects-editor" id="effects">' +
      (o.effects || []).map(function (e, k) { var kind = e.set !== undefined ? 'set' : e.reduce_by !== undefined ? 'reduce_by' : 'delta'; var val = e.set !== undefined ? e.set : e.reduce_by !== undefined ? e.reduce_by : e.delta; return '<div class="erow" data-k="' + k + '">' + usel('unit', e.unit) + '<select data-ef="code">' + DATA.indicators.map(function (i) { return '<option value="' + i.code + '"' + (i.code === e.code ? ' selected' : '') + '>' + i.code + '</option>'; }).join('') + '</select><select data-ef="kind">' + ['set', 'delta', 'reduce_by'].map(function (kk) { return '<option value="' + kk + '"' + (kk === kind ? ' selected' : '') + '>' + kk.replace('_', ' ') + '</option>'; }).join('') + '</select><input type="number" step="any" data-ef="value" value="' + esc(val) + '"><button class="btn small" data-rm="' + k + '" title="remove">×</button></div>'; }).join('') +
      '</div><div class="row" style="margin-top:8px"><button class="btn small" id="add-effect">+ Add effect</button></div>' +
      '<div class="row" style="margin-top:16px"><button class="btn primary" id="save-opt">Save option</button><button class="btn" id="cancel-opt">Cancel</button></div></div>';
    return html;
  }
  function readEditor(root) {
    var o = U().editing; if (!o) return null;
    root.querySelectorAll('[data-o]').forEach(function (el) {
      var k = el.getAttribute('data-o');
      if (el.type === 'checkbox') o[k] = el.checked;
      else if (el.type === 'number') { var v = parseFloat(el.value); if (isNaN(v)) delete o[k]; else o[k] = v; }
      else o[k] = el.value;
    });
    o.tags = Array.prototype.map.call(root.querySelectorAll('[data-tag]:checked'), function (el) { return el.getAttribute('data-tag'); });
    o.goals = Array.prototype.map.call(root.querySelectorAll('[data-goal]:checked'), function (el) { return el.getAttribute('data-goal'); });
    o.effects = Array.prototype.map.call(root.querySelectorAll('#effects .erow'), function (row) {
      var e = { unit: row.querySelector('[data-ef="unit"]').value, code: row.querySelector('[data-ef="code"]').value };
      var kind = row.querySelector('[data-ef="kind"]').value, v = parseFloat(row.querySelector('[data-ef="value"]').value);
      if (isNaN(v)) v = 0;
      e[kind] = v;
      return e;
    });
    if (!o.density_after) delete o.density_after;
    return o;
  }
  function mountEditor(root) {
    if (!U().editing) return;
    A.on(root, '#add-effect', 'click', function () { readEditor(root); U().editing.effects.push({ unit: U().editing.unit, code: 'EN1', delta: 0 }); A.rerender(); });
    A.on(root, '[data-rm]', 'click', function (ev, el) { readEditor(root); U().editing.effects.splice(parseInt(el.getAttribute('data-rm'), 10), 1); A.rerender(); });
    A.on(root, '#cancel-opt', 'click', function () { U().editing = null; A.rerender(); });
    A.on(root, '#save-opt', 'click', function () {
      var o = readEditor(root), st = S();
      if (!o.id || !o.name) { A.toast('Identifier and name are required'); return; }
      var orig = o._orig; delete o._orig;
      if (orig) { var i = st.options.findIndex(function (x) { return x.id === orig; }); if (i >= 0) st.options[i] = o; else st.options.push(o); if (orig !== o.id) { U().selected = U().selected.map(function (x) { return x === orig ? o.id : x; }); } }
      else { if (A.optionById(o.id)) { A.toast('An option with this identifier exists'); return; } o.custom = true; st.options.push(o); if (U().selected.indexOf(o.id) < 0) U().selected.push(o.id); }
      U().editing = null; A.dataChanged(); A.rerender(); A.toast('Option ' + o.id + ' saved');
    });
  }

  // =====================================================================
  // REFERENCE
  // =====================================================================
  A.registerScreen('reference', {
    render: function () {
      var q = (U().refSearch || '').toLowerCase();
      var html = pageHead('Indicators Library', 'The indicators, their bands and the parameter card', 'The default library of Manual Part 5 with every indicator\'s floor, target, basis grade, measurement levels and aggregation rule, its SDG target through the ISO crosswalk and the scale its value library entry multiplies a change by, and the parameters the calculator applies.', '<label class="control"><span>Search</span><input type="search" id="ref-search" placeholder="code, name or standard" value="' + esc(U().refSearch) + '"></label>');
      html += '<div class="panel"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Code</th><th>Indicator</th><th>Standard</th><th>Unit</th><th class="num">Floor</th><th class="num">Target</th><th>Grade</th><th>Levels</th><th>Aggregation</th><th>SDG target</th><th>Value scale</th></tr></thead><tbody>';
      DATA.subdims.forEach(function (s) {
        var rows = indsOf(s.code).filter(function (i) { return !q || (i.code + ' ' + i.name + ' ' + i.ref).toLowerCase().indexOf(q) >= 0; });
        if (!rows.length) return;
        html += '<tr class="group"><td colspan="11">' + s.code + ' ' + esc(s.name) + ' · ' + DIM_NAME[s.dim] + '</td></tr>';
        rows.forEach(function (i) { var sdg = SRS.sdgOf(i.code), sc_ = SRS.scaleOf(i.code); html += '<tr class="clickable" data-ind="' + i.code + '"><td class="mono">' + i.code + '</td><td>' + esc(i.name) + '</td><td class="small">' + esc(i.ref) + '</td><td class="small">' + esc(i.unit) + '</td><td class="num">' + fv(i.floor) + '</td><td class="num">' + fv(i.target) + '</td><td>' + i.grade + '</td><td class="mono">' + i.levels + '</td><td class="small">' + i.agg + '</td><td class="small">' + (sdg ? '<span class="badge" title="' + esc(SRS.sdgTargetText()[sdg.target] || '') + '">' + sdg.target + '</span> ' + esc(SRS.sdgNames()[sdg.goal] || '') + ' (' + sdg.grade + ')' : '–') + '</td><td class="small">' + esc(sc_.scale.replace(/_/g, ' ')) + (sc_.count ? ' (' + esc(sc_.count.replace(/_/g, ' ')) + ')' : '') + ', ' + esc(sc_.per) + '</td></tr>'; });
      });
      html += '</tbody></table></div></div>';
      if (U().indicator && IND[U().indicator]) html += '<div class="section" id="ind-detail">' + indicatorDetail(U().indicator, res(U().unit)) + '</div>';
      var p = SRS.checkParams(), lp = SRS.lagProfiles();
      html += '<div class="section grid c2"><div class="panel"><h3>Parameter card</h3><dl class="kv small"><dt>Level bands</dt><dd>0.2 / 0.4 / 0.6 / 0.8 (Critical, Weak, Developing, Established, Leading)</dd><dt>Outcomes and capability</dt><dd>the rating is built on sustainability (S) and resilience (R); smartness (M) is reported as digital capability</dd><dt>Balanced performance B</dt><dd>power mean of S and R with inequality aversion p = ' + (S().cfg.aversion_p || 0) + ' (0 is the geometric mean); sets the performance level</dd><dt>Balance stage</dt><dd>read from the gap between the two outcome scores: even ≤ 0.10, broadly even ≤ 0.25, uneven ≤ 0.50, severely uneven above; D = √(C × mean) is computed on S and R</dd><dt>Lag gap</dt><dd>' + f2(S().cfg.lag_gap) + ', between the outcomes and between capability and B</dd><dt>Rating minimums</dt><dd>3 indicators and 50 % of weight per sub-dimension; 2, 3, 2 sub-dimensions for S, R, M</dd><dt>Confidence</dt><dd>A at 90 % coverage and 80 % A/B; B at 75 % and 60 %</dd><dt>Readiness multipliers</dt><dd>none 0.3, partial 0.7, mature 1.0</dd><dt>IC1 efficiency vs redundancy</dt><dd>−' + p.IC1_trim + ' on RD, −' + p.IC1_trim_with_redundancy + ' with a redundancy option</dd><dt>IC2 density</dt><dd>reference ' + p.IC2_density_ref.toLocaleString('en-GB') + ', decline above ' + p.IC2_density_decline.toLocaleString('en-GB') + ', car benefit halved above ' + p.IC2_density_car.toLocaleString('en-GB') + ' persons/km²</dd><dt>IC3 smart liability</dt><dd>−' + p.IC3_trim + ' on RB</dd><dt>IC4 rebound</dt><dd>' + pc(p.IC4_rebound) + ' of ex-ante energy savings</dd><dt>IC5 overlap</dt><dd>reductions combine as 1 − Π(1 − r)</dd><dt>IC6 integration</dt><dd>× ' + p.IC6_multiplier + ' with both; −' + p.IC6_ops_without_services + ' / −' + p.IC6_services_without_ops + ' on SS without</dd><dt>IC7 displacement</dt><dd>−' + p.IC7_trim + ' on SE</dd><dt>IC8 lock-in</dt><dd>−' + p.IC8_trim + ' on RF</dd><dt>IC9 density without canopy</dt><dd>−' + p.IC9_trim + ' on EN (−' + p.IC9_trim_infill + ' compact infill)</dd><dt>IC10 digital exclusion</dt><dd>−' + p.IC10_trim + ' on SE (−' + p.IC10_trim_vulnerable + ' above ' + p.IC10_elderly_share + ' % aged 65+), SS benefit × ' + p.IC10_benefit_multiplier + '</dd><dt>IC11 induced travel</dt><dd>−' + p.IC11_trim + ' on EN</dd><dt>IC12 consumption-raising adaptation</dt><dd>−' + p.IC12_trim + ' on EN within the option\'s payback window (default ' + p.IC12_default_payback_years + ' years); lapses after it</dd><dt>IC13 coupling exposure</dt><dd>−' + p.IC13_trim + ' on RB per coupled system</dd><dt>Check scope</dt><dd>population share of the appraised unit in a trigger\'s footprint and in no offset\'s footprint; once per unit</dd><dt>Bundle ranking</dt><dd>set aside if any dimension falls or if dominated on the outcomes; then closes the weaker outcome\'s lag; then B after, D deciding near-ties within 0.005</dd><dt>Smartness saturation</dt><dd>marginal effect × ' + p.M_saturation_factor + ' above ' + p.M_saturation + '</dd></dl></div>' +
        '<div class="panel"><h3>Lag profiles (share of full effect, years 1–8)</h3><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Class</th>' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (y) { return '<th class="num">' + y + '</th>'; }).join('') + '</tr></thead><tbody>' + Object.keys(lp).map(function (k) { return '<tr><td>' + k + '</td>' + lp[k].map(function (v) { return '<td class="num">' + pc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div><h3 style="margin-top:14px">Aggregation rules</h3><dl class="kv small">' + Object.keys(A.AGG_TEXT).map(function (k) { return '<dt>' + k + '</dt><dd>' + esc(A.AGG_TEXT[k]) + '</dd>'; }).join('') + '</dl></div></div>';
      return html;
    },
    mount: function (root) {
      var t = null;
      A.on(root, '#ref-search', 'input', function (ev, el) { U().refSearch = el.value; clearTimeout(t); t = setTimeout(function () { var pos = el.selectionStart; A.rerender(); var e2 = document.getElementById('ref-search'); if (e2) { e2.focus(); e2.setSelectionRange(pos, pos); } }, 350); });
      A.on(root, 'tr[data-ind]', 'click', function (ev, el) { U().indicator = el.getAttribute('data-ind'); A.rerender(); var d = document.getElementById('ind-detail'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    }
  });

  // =====================================================================
  // ABOUT
  // =====================================================================
  A.registerScreen('about', {
    render: function () {
      return pageHead('About and help', 'How the workbench works', 'What it computes, where the rules come from, what it stores and how to deploy it.') +
        '<div class="panel prose" style="margin-bottom:16px"><h3>Two kinds of screen</h3><p>The <b>framework screens</b> (Dashboard and steps 1 to 5 in the menu) are for showing the method: each is chart-first and read-only, and each panel names the work screen it is computed from. The <b>work screens</b>, folded under <i>Work screens · data entry</i>, are where the data is entered and each role does its work: the register and the indicator values, the configuration and sign-off, the project records and bundles, the programme and portfolio records, the city\'s goals and values, and the coupling table with the operating register. Both kinds read one state, so a value changed on a work screen is on every framework screen at once.</p></div>' +
        '<div class="grid c2"><div class="panel prose"><h3>The method</h3><p>Each indicator value is normalised between its floor (score 0) and its target (score 1) and clipped. A sub-dimension is the weighted mean of its present indicators and is rated when at least three are present carrying at least half the weight; the caps on weights are enforced by the calculator. A dimension is the weighted mean of its rated sub-dimensions. A parent unit\'s value is derived from its children by the indicator\'s rule: a ratio indicator by its own counts when they are recorded, otherwise by the fallback weighting, flagged approximate and capped at grade B; a parent is derived only when the reporting children cover at least half of it, and the coverage is shown.</p><p>The rating is built on two outcomes, sustainability and resilience. Their balanced performance B is a power mean with an inequality aversion p set in the configuration (the default, p = 0, is the geometric mean); it never falls when either outcome improves and sets the performance level on the same 0.2 bands as the indicators. The balance stage is read from the gap between the two outcome scores (even, broadly even, uneven, severely uneven at 0.10, 0.25 and 0.50); the coordination degree D is reported and decides near-ties in the ranking. An outcome lags when it sits more than the lag gap below the other. Smartness is reported beside the rating as digital capability, the means by which a territory improves its outcomes: it has its own score and level, and it is flagged as trailing when it sits more than the lag gap below B.</p><p>Tier 2 applies an option\'s effect sheet to the measured values of the unit each effect names, scaling a digital option\'s co-benefits by the governance-readiness factor before composition, carries each change into parents that hold their own measured value, re-derives the rest, re-scores, runs the interaction checks as trims on the affected sub-dimensions, multiplies capability changes by the readiness factor, and reads the change in every score as the option\'s contribution. Effects on one indicator compose in a fixed sequence whatever the order of the options, and each option\'s ramp scales its own contribution, so the time path reaches the full-effect result by year 8. Each option acts on a footprint, the lowest-level units it covers; a check applies to the share of the appraised unit\'s population in a trigger\'s footprint, lifted in proportion to the delivered effect of the offsets covering it, once per unit; lock-in reads the design classes present, not the number of option records.</p><p>Bundles are ranked by the rule of Manual Part 4.8: bundles that lower an outcome, or that another bundle matches or beats on both outcomes, are set aside; those that close the lag on the weaker outcome come first; B after completion orders each group, and D decides between bundles within 0.005 on B. Capability and the cost per point of outcome gained are reported beside the ranking.</p><p>The levels above the project record and the money view follow Manual Part 9 (Reference Part E). The city states its goals in its own words, measured on library indicators, and the SDG targets follow through the ISO crosswalk; a project record claims the goals it serves and the calculator reports whether its effect sheet bears the claim out. A programme is a group of records whose outcomes are composed, each line naming the records that produce it; the portfolio adopts the city\'s goals as strategic goals with commitments and is read against them by its horizon and at full effect, with each record ramping on its own clock from its completion year. The value library is a structure the city fills: a change in an indicator is multiplied by the register figure its scale names and by the value the city sets, summed by year and discounted, so that investment and value compare at every level; an unvalued change is reported as such, never as zero; a parent whose outcome an option states while also stating it beneath is counted once, at the lowest units; and the money view is reported beside the score, which it does not rank.</p><p>Effective smartness follows Manual Part 10 (Reference Part F). Three readings at every level, beside the score and never ranking: alignment, the need-weighted share of a unit\'s outcome shortfall that the capability it holds serves under the capability crosswalk (each capability indicator serves the outcome indicators of its own ISO theme at grade B and a few stated cross-theme mechanisms at grade C); yield, the two-layer Shapley contribution of a record set\'s digital records to the unit\'s change in B, with the physical layer\'s as the remainder, read in a planned stance and in an in-operation stance that removes the realised effects of the systems already running; and the catalytic ratio, the digital layer\'s contribution with the physical layer present over its contribution alone. The integration premium acts on the outcomes rather than on the capability score: where a bundle holds both members of a coupling (an operations centre with a smart service, an operations centre with a flood work, a mobility platform with a transit precinct), each member\'s effect on the coupled sub-dimensions is multiplied by 1 + (premium − 1) × readiness × phase-in × overlap, and the multiplier of 1.2 on the smartness sub-dimensions is withdrawn. A record with status complete is a system in operation, carries realised effects (a delta, or a set with its before value) and is never applied forward.</p></div>' +
        '<div class="panel prose"><h3>What is stored, and where</h3><p>When the site is deployed with Firebase sign-in, territories and the option library are stored in your organisation\'s cloud workspace, every member sees the same data, editing follows each member\'s role, and every save is written to an audit log. Without sign-in (for example in this published preview), the workbench runs in local mode: your edits stay in this browser, and you move a territory between people by copying or downloading the territory file and loading it on the other side.</p><h3 style="margin-top:14px">Deploying it</h3><p>The site is static and runs on Firebase Hosting, any web server, or from disk. Firebase sign-in and cloud storage are switched on by filling in the project settings in firebase-config.js; the setup guide in the deployment package lists the steps. The calculator (srs-calc.js) is a verified port of the Python reference calculator supplied with the manual.</p><h3 style="margin-top:14px">Verification</h3><p>The browser calculator is checked against the Python reference calculator for the baseline of all eight units, the roll-ups, bundles A to D, every single option, bundle D at mature readiness, the year profile, the convergence of every bundle by year 8, the bundle ranking, the record and register checks, the goals, the whole chain (outcome lines, values, investment, strategic goals, envelope and traces at every level) and the effective-smartness readings, to within 10⁻⁹. The regression tests reproduce every computational finding of the independent review of 9 October 2026 and confirm that B never falls when an outcome improves.</p></div></div>';
    }
  });
  // shared with app-levels.js (version 1.4)
  A.shared = { pageHead: pageHead, problemList: problemList, effectText: effectText, syntheticNote: syntheticNote, ensureUnit: ensureUnit, unitName: unitName, optionFlags: optionFlags, scrollToEditor: scrollToEditor };
})(window);
