/* SRS Workbench, version 1.5: effective smartness. One screen with the three readings of Manual Part 10 (alignment, yield,
   the catalytic ratio) at every level and at two time stances, the editors for the coupling table and the operating
   register, and the cards the level pages carry. Every figure is computed by SRS.smartReadings() from the records and the
   Tier 1 values; the readings are reported beside the score and never rank. */
(function (global) {
  'use strict';
  var A = global.APP, SRS = A.SRS, DATA = A.DATA, IND = A.IND;
  var esc = A.esc, pc = A.pc;
  var H = A.shared, pageHead = H.pageHead, unitName = H.unitName, problemList = H.problemList;
  function S() { return A.state(); }
  function U() { return S().ui; }

  function f4(x) { if (x === null || x === undefined || isNaN(x)) return '–'; return (x < 0 ? '−' : '+') + Math.abs(x).toFixed(4); }
  function f2u(x) { if (x === null || x === undefined || isNaN(x)) return '–'; return x.toFixed(2); }
  function kap(x) { return (x === null || x === undefined) ? '–' : x.toFixed(2); }
  function cpp(x) { return (x === null || x === undefined) ? '–' : Math.round(x).toLocaleString('en-GB'); }
  function pct(x) { return (x === null || x === undefined) ? '–' : Math.round(x * 100) + '%'; }
  function ids(xs) { return xs && xs.length ? xs.map(esc).join(', ') : 'none'; }
  function kapBadge(x) {
    if (x === null || x === undefined) return '<span class="badge">κ undefined</span>';
    var cls = x > 1.02 ? 'good' : x < 0.98 ? 'warn' : 'accent';
    return '<span class="badge ' + cls + '">κ ' + x.toFixed(2) + '</span>';
  }
  function smartOrError() {
    var r = A.smart();
    if (r.error) return { smart: null, html: '<div class="callout warn">The readings could not be computed: ' + esc(r.error.message || String(r.error)) + '</div>' };
    return { smart: r.smart, html: '' };
  }
  function attRows(att, n, opts) {
    opts = opts || {};
    var b = att.B;
    var rows = '<tr><td class="lab">Digital layer φ<sub>D</sub></td><td class="num">' + f4(b.digital) + '</td><td class="num">' + f4(att.S.digital) + '</td><td class="num">' + f4(att.R.digital) + '</td></tr>' +
      '<tr><td class="lab">Physical layer φ<sub>P</sub></td><td class="num">' + f4(b.physical) + '</td><td class="num">' + f4(att.S.physical) + '</td><td class="num">' + f4(att.R.physical) + '</td></tr>' +
      '<tr><td class="lab">In all</td><td class="num"><b>' + f4(b.total) + '</b></td><td class="num">' + f4(att.S.total) + '</td><td class="num">' + f4(att.R.total) + '</td></tr>' +
      (opts.kappa === false ? '' : '<tr><td class="lab">Digital alone · given the physical layer</td><td class="num" colspan="3">' + f4(b.alone) + ' · ' + f4(b.given_physical) + ' <span class="small muted">(interaction ' + f4(b.interaction) + ')</span> ' + kapBadge(b.kappa) + '</td></tr>');
    var norm = '<tr><td class="lab">Digital share · per capability point</td><td class="num" colspan="3">' + pct(n.share) + ' · ' + (n.per_capability_point === null ? '–' : n.per_capability_point.toFixed(3)) + '</td></tr>' +
      '<tr><td class="lab">Cost per point, digital · physical (M)</td><td class="num" colspan="3">' + cpp(n.cost_per_point_digital) + ' · ' + cpp(n.cost_per_point_physical) + '</td></tr>';
    return '<div class="tbl-wrap"><table class="tbl small att"><thead><tr><th></th><th class="num">B</th><th class="num">S</th><th class="num">R</th></tr></thead><tbody>' + rows + norm + '</tbody></table></div>';
  }
  function yieldPanel(title, y, note, opts) {
    if (!y) return '<div class="panel"><h3>' + esc(title) + '</h3><p class="small muted">' + esc(note || 'No records reach this unit.') + '</p></div>';
    return '<div class="panel"><div class="panel-head"><h3>' + esc(title) + '</h3><span class="small muted">digital ' + ids(y.digital) + ' · physical ' + ids(y.physical) + '</span></div>' + attRows(y.attribution, y.normalised, opts) + (note ? '<p class="small muted" style="margin-top:6px">' + note + '</p>' : '') + '</div>';
  }
  function alignPanel(al, after, name) {
    var uns = al.needs.filter(function (n) { return n.served_by === null; }).slice(0, 4).map(function (n) { return n.code; });
    var top = al.needs.slice(0, 6);
    return '<div class="panel"><div class="panel-head"><h3>Alignment' + (name ? ' at ' + esc(name) : '') + '</h3><span class="small muted">structural: whether capability is pointed at need, not whether it works</span></div>' +
      '<div class="tiles"><div class="tile"><span class="label">Alignment</span><span class="v sm">' + f2u(al.alignment) + '</span><span class="d">need-weighted service' + (after !== null && after !== undefined ? '; ' + f2u(after) + ' at full effect of the plan' : '') + '</span></div>' +
      '<div class="tile"><span class="label">Coverage</span><span class="v sm">' + f2u(al.coverage) + '</span><span class="d">need served at Level 3 or above</span></div>' +
      '<div class="tile"><span class="label">Unserved need</span><span class="v sm">' + f2u(al.unserved) + '</span><span class="d">' + esc(uns.join(', ') || 'none') + '</span></div>' +
      '<div class="tile"><span class="label">Idle capability</span><span class="v sm">' + f2u(al.idle) + '</span><span class="d">' + esc((al.idle_capabilities || []).join(', ') || 'none') + '</span></div></div>' +
      '<div class="tbl-wrap" style="margin-top:8px"><table class="tbl small"><thead><tr><th>Largest needs</th><th class="num">Share of need</th><th class="num">Score</th><th>Served by</th><th class="num">Service</th></tr></thead><tbody>' + top.map(function (n) {
        return '<tr><td><span class="mono">' + n.code + '</span> <span class="small muted">' + esc(IND[n.code] ? IND[n.code].name : '') + '</span></td><td class="num">' + pct(n.share) + '</td><td class="num">' + n.score.toFixed(3) + '</td><td>' + (n.served_by ? '<span class="mono">' + n.served_by + '</span>' : '<span class="badge warn">none</span>') + '</td><td class="num">' + (n.served_by ? n.service.toFixed(2) : '–') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  // ---------- the card the level pages carry ----------
  A.smartCard = function (kind, id) {
    var r = smartOrError(); if (!r.smart) return '';
    var E = r.smart, html = '';
    if (kind === 'project') {
      var rec = E.records[id];
      if (!rec) return '<div class="section"><div class="panel"><h3>Effective smartness</h3><p class="small muted">The record is in no programme, so its contribution within a programme cannot be read; see the Effective smartness page.</p></div></div>';
      html = '<div class="panel"><div class="panel-head"><h3>Effective smartness</h3><span class="small muted">' + (rec.digital ? 'digital record' : 'physical record') + ' · read at ' + esc(unitName(rec.unit)) + ', the accountable unit of ' + esc(rec.programme) + '</span></div>' +
        '<div class="tiles"><div class="tile"><span class="label">Contribution alone (B)</span><span class="v sm">' + f4(rec.alone.B) + '</span><span class="d">the record applied to the baseline on its own</span></div><div class="tile"><span class="label">Within the programme (B)</span><span class="v sm">' + f4(rec.within.B) + '</span><span class="d">the programme with the record minus the programme without it</span></div><div class="tile"><span class="label">κ for the record</span><span class="v sm">' + kap(rec.kappa) + '</span><span class="d">' + (rec.kappa === null ? 'undefined: the record contributes nothing or less than nothing alone' : rec.kappa > 1.02 ? 'the programme makes it deliver more' : rec.kappa < 0.98 ? 'the programme makes it deliver less' : 'additive') + '</span></div></div>' +
        '<p class="small muted" style="margin-top:6px">Alone: the record applied to the baseline on its own. Within: the programme with the record minus the programme without it. Neither enters the ranking. <a href="#smartness">Effective smartness page</a>.</p></div>';
    } else if (kind === 'programme') {
      var pg = E.programmes[id]; if (!pg) return '';
      html = yieldPanel('Effective smartness of the programme', pg.planned, 'Planned stance at ' + esc(unitName(pg.unit)) + ', full effect; by the portfolio\'s horizon the digital layer contributes ' + (pg.planned_horizon ? f4(pg.planned_horizon.attribution.B.digital) : '–') + '. <a href="#smartness">Effective smartness page</a>.');
    } else if (kind === 'portfolio') {
      var pf = E.portfolio; if (!pf) return '';
      html = yieldPanel('Effective smartness of the portfolio', pf.planned, 'Planned stance at ' + esc(unitName(pf.unit)) + ', full effect; by the horizon the digital layer contributes ' + (pf.planned_horizon ? f4(pf.planned_horizon.attribution.B.digital) : '–') + '. The ranking of Part 4.8 does not read this. <a href="#smartness">Effective smartness page</a>.');
    } else if (kind === 'city') {
      var u = E.units[id]; if (!u) return '';
      html = '<div class="grid c2">' + alignPanel(u.alignment, u.alignment_after ? u.alignment_after.alignment : null, unitName(id)) +
        '<div class="stack">' + yieldPanel('In operation', u.in_operation, 'The counterfactual runs the other way: realised effects removed. κ ' + esc(u.in_operation.kappa_note) + '.', { kappa: false }) + yieldPanel('Planned', u.planned, 'Approved records reaching ' + esc(unitName(id)) + ', full effect. Together with the operating stock the digital layer carries ' + f4(u.together) + ' of B.') + '</div></div>';
    }
    return html ? '<div class="section">' + html + '</div>' : '';
  };

  // ---------- the screen ----------
  A.registerScreen('smartness', {
    guard: [{ part: 'config', sel: '[data-cat], [data-cp], #add-coupling, [data-delcp], #save-catalysis', why: 'The coupling table and the premium are configuration, kept by the assessment lead.' },
            { part: 'register', sel: '[data-st], [data-ste], #add-stock, [data-delstock], [data-addste], [data-delste], #save-stock', why: 'The operating register is kept by the data steward.' }],
    render: function () {
      var st = S(), ui = U();
      var units = A.unitsInDisplayOrder();
      if (!ui.smartUnit || !A.unitById(ui.smartUnit)) ui.smartUnit = ui.unit || 'WH';
      var controls = '<label class="control"><span>Unit</span><select id="sel-smart-unit">' + units.map(function (x) { return '<option value="' + esc(x.unit.id) + '"' + (x.unit.id === ui.smartUnit ? ' selected' : '') + '>' + esc(x.unit.name) + '</option>'; }).join('') + '</select></label>';
      var html = pageHead('Effective smartness', 'Does the capability serve the outcomes?', 'Three readings at every level, beside the score and never ranking (Manual Part 10): alignment, whether the capability a unit holds is pointed at its outcome shortfall; yield, what the digital layer of the systems in operation and of the records planned contributes to B, attributed to the digital and physical layers so that the two always sum to the whole; and the catalytic ratio κ, the digital layer\'s contribution with the physical layer present over its contribution alone.', controls);
      var r = smartOrError(); html += r.html; if (!r.smart) return html;
      var E = r.smart, u = E.units[ui.smartUnit];
      if (st.territory.synthetic) html += '<div class="callout small">Demonstration data: Westhaven\'s operating register and the records are synthetic, and the premium behind κ is a modelled coupling graded B on the reference document\'s Annex G.</div>';
      // this unit
      html += '<div class="section"><h3 style="margin:0 0 8px">' + esc(unitName(ui.smartUnit)) + '</h3><div class="grid c2">' + alignPanel(u.alignment, u.alignment_after ? u.alignment_after.alignment : null, null) +
        '<div class="stack">' + yieldPanel('In operation', u.in_operation, 'Records with status complete that reach this unit; the counterfactual removes their realised effects. κ ' + esc(u.in_operation.kappa_note) + (u.in_operation.couplings_present.length ? '; couplings present: ' + u.in_operation.couplings_present.map(function (c) { return c.a + '–' + c.b; }).join(', ') : '') + '.', { kappa: false }) +
        yieldPanel('Planned', u.planned, 'Approved records reaching the unit, full effect; by the portfolio\'s horizon the digital layer contributes ' + (u.planned_horizon ? f4(u.planned_horizon.attribution.B.digital) : '–') + '. Together with the operating stock: ' + f4(u.together) + '.') + '</div></div></div>';
      // every unit
      html += '<div class="section"><div class="panel"><div class="panel-head"><h3>Every unit</h3><span class="small muted">alignment at the baseline and at full effect of the plan; the digital layer\'s contribution in operation and planned</span></div><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Unit</th><th class="num">Alignment</th><th class="num">At full effect</th><th class="num">Coverage</th><th class="num">Unserved</th><th class="num">Idle</th><th class="num">In operation φ<sub>D</sub></th><th class="num">Planned φ<sub>D</sub></th><th class="num">Planned κ</th><th class="num">Together</th></tr></thead><tbody>' + units.map(function (x) {
        var e = E.units[x.unit.id], pl = e.planned;
        return '<tr><td style="padding-left:' + (8 + x.depth * 14) + 'px"><a href="#smartness" data-smartunit="' + esc(x.unit.id) + '">' + esc(x.unit.name) + '</a></td><td class="num">' + f2u(e.alignment.alignment) + '</td><td class="num">' + f2u(e.alignment_after ? e.alignment_after.alignment : null) + '</td><td class="num">' + f2u(e.alignment.coverage) + '</td><td class="num">' + f2u(e.alignment.unserved) + '</td><td class="num">' + f2u(e.alignment.idle) + '</td><td class="num">' + f4(e.in_operation.attribution.B.digital) + '</td><td class="num">' + (pl ? f4(pl.attribution.B.digital) : '–') + '</td><td class="num">' + (pl ? kap(pl.attribution.B.kappa) : '–') + '</td><td class="num">' + f4(e.together) + '</td></tr>';
      }).join('') + '</tbody></table></div></div></div>';
      // programmes, portfolio, records
      html += '<div class="section"><div class="panel"><div class="panel-head"><h3>Programmes, the portfolio and the records</h3><span class="small muted">planned stance at each level\'s accountable unit</span></div><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Level</th><th>Unit</th><th>Digital</th><th>Physical</th><th class="num">ΔB in all</th><th class="num">φ<sub>D</sub></th><th class="num">φ<sub>P</sub></th><th class="num">Alone</th><th class="num">Given physical</th><th class="num">κ</th><th class="num">Share</th><th class="num">Cost per point D · P</th></tr></thead><tbody>' +
        Object.keys(E.programmes).map(function (pgid) { var e = E.programmes[pgid], y = e.planned, b = y.attribution.B, n = y.normalised; return '<tr><td><a href="#programme" data-goprogramme="' + esc(pgid) + '">' + esc(pgid) + '</a> ' + esc(e.name) + '</td><td>' + esc(e.unit) + '</td><td class="small">' + ids(y.digital) + '</td><td class="small">' + ids(y.physical) + '</td><td class="num">' + f4(b.total) + '</td><td class="num">' + f4(b.digital) + '</td><td class="num">' + f4(b.physical) + '</td><td class="num">' + f4(b.alone) + '</td><td class="num">' + f4(b.given_physical) + '</td><td class="num">' + kap(b.kappa) + '</td><td class="num">' + pct(n.share) + '</td><td class="num">' + cpp(n.cost_per_point_digital) + ' · ' + cpp(n.cost_per_point_physical) + '</td></tr>'; }).join('') +
        (E.portfolio ? (function () { var y = E.portfolio.planned, b = y.attribution.B, n = y.normalised; return '<tr><td><a href="#portfolio"><b>' + esc(E.portfolio.id) + '</b></a> portfolio</td><td>' + esc(E.portfolio.unit) + '</td><td class="small">' + ids(y.digital) + '</td><td class="small">' + ids(y.physical) + '</td><td class="num"><b>' + f4(b.total) + '</b></td><td class="num"><b>' + f4(b.digital) + '</b></td><td class="num">' + f4(b.physical) + '</td><td class="num">' + f4(b.alone) + '</td><td class="num">' + f4(b.given_physical) + '</td><td class="num">' + kap(b.kappa) + '</td><td class="num">' + pct(n.share) + '</td><td class="num">' + cpp(n.cost_per_point_digital) + ' · ' + cpp(n.cost_per_point_physical) + '</td></tr>'; })() : '') +
        '</tbody></table></div>' +
        '<div class="tbl-wrap" style="margin-top:10px"><table class="tbl small"><thead><tr><th>Record</th><th>Programme</th><th>Layer</th><th class="num">Alone (B)</th><th class="num">Within the programme (B)</th><th class="num">κ for the record</th></tr></thead><tbody>' + Object.keys(E.records).map(function (rid) { var e = E.records[rid], o = A.optionById(rid); return '<tr><td><a href="#project" data-goproject="' + esc(rid) + '" class="mono">' + esc(rid) + '</a> ' + esc(o ? o.name : '') + '</td><td>' + esc(e.programme) + '</td><td>' + (e.digital ? 'digital' : 'physical') + '</td><td class="num">' + f4(e.alone.B) + '</td><td class="num">' + f4(e.within.B) + '</td><td class="num">' + kap(e.kappa) + '</td></tr>'; }).join('') + '</tbody></table></div></div></div>';
      // bundles
      var blist = A.allBundles(), bundles = {}, bset = {}; blist.forEach(function (b) { bundles[b.id] = b; bset[b.id] = (b.options || []).map(A.optionById).filter(function (o) { return o && o.status !== 'complete'; }); });
      var BS = null; try { BS = SRS.bundleReadings(st.units, bset, st.readiness, ui.appraisalUnit || 'WH', st.cfg); } catch (e) { BS = null; }
      html += '<div class="section"><div class="panel"><div class="panel-head"><h3>The bundles at ' + esc(unitName(ui.appraisalUnit || 'WH')) + '</h3><span class="small muted">the same attribution on each bundle of the Project appraiser page; the ranking does not read it</span></div>' + (BS ? '<div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Bundle</th><th>Digital</th><th>Physical</th><th class="num">ΔB in all</th><th class="num">φ<sub>D</sub></th><th class="num">φ<sub>P</sub></th><th class="num">Alone</th><th class="num">Given physical</th><th class="num">Interaction</th><th class="num">κ</th><th class="num">Share</th><th class="num">Cost per point D · P</th></tr></thead><tbody>' + Object.keys(BS).map(function (k) { var y = BS[k], b = y.attribution.B, n = y.normalised; return '<tr><td><b>' + esc(k) + '</b> ' + esc(bundles[k].name || '') + '</td><td class="small">' + ids(y.digital) + '</td><td class="small">' + ids(y.physical) + '</td><td class="num">' + f4(b.total) + '</td><td class="num">' + f4(b.digital) + '</td><td class="num">' + f4(b.physical) + '</td><td class="num">' + f4(b.alone) + '</td><td class="num">' + f4(b.given_physical) + '</td><td class="num">' + f4(b.interaction) + '</td><td class="num">' + kap(b.kappa) + '</td><td class="num">' + pct(n.share) + '</td><td class="num">' + cpp(n.cost_per_point_digital) + ' · ' + cpp(n.cost_per_point_physical) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="small muted">A bundle could not be appraised.</p>') + '</div></div>';
      // couplings and premium
      var cat = st.cfg.catalysis;
      html += '<div class="section grid c2"><div class="panel"><div class="panel-head"><h3>Couplings and the premium</h3><span class="small muted">configuration (T13)</span></div><div class="form"><label>Premium π<input type="number" step="0.01" min="1" data-cat="premium" value="' + esc(cat.premium) + '"></label><label>Phase-in starts (years after the later partner\'s completion)<input type="number" data-cat="phase_in_start" value="' + esc(cat.phase_in_start) + '"></label><label>Phase-in complete (years)<input type="number" data-cat="phase_in_full" value="' + esc(cat.phase_in_full) + '"></label></div>' +
        '<div class="tbl-wrap" style="margin-top:8px"><table class="tbl small"><thead><tr><th>First tag</th><th>Second tag</th><th>Outcome sub-dimensions catalysed</th><th></th></tr></thead><tbody>' + (cat.couplings || []).map(function (c, i) { return '<tr><td><input type="text" data-cp="a" data-i="' + i + '" value="' + esc(c.a) + '" style="width:120px"></td><td><input type="text" data-cp="b" data-i="' + i + '" value="' + esc(c.b) + '" style="width:120px"></td><td><input type="text" data-cp="subs" data-i="' + i + '" value="' + esc((c.subs || []).join(', ')) + '" style="width:120px"></td><td><button class="btn small danger" data-delcp="' + i + '">Remove</button></td></tr>'; }).join('') + '</tbody></table></div>' +
        '<div class="row" style="margin-top:8px"><button class="btn small" id="add-coupling">Add a coupling</button><button class="btn small primary" id="save-catalysis">Save</button></div><p class="small muted" style="margin-top:6px">Each member\'s effect on an indicator in a coupled sub-dimension is multiplied by 1 + (π − 1) × readiness × phase-in × overlap. Set the premium to 1 to switch the mechanism off (every κ then reads 1.00). The tags are those of the option library; the sub-dimension codes are EN, SE, EC, IF, RB, RD, RF, RP.</p></div>' +
        // operating register
        '<div class="panel"><div class="panel-head"><h3>Operating register</h3><span class="small muted">records with status complete (T14)</span></div>' + (st.stock.length ? st.stock.map(function (o, i) {
          var probs = SRS.validateOptions([o], st.units).filter(function (p) { return p.severity === 'error'; });
          return '<details class="drawer"><summary><b class="mono">' + esc(o.id) + '</b> ' + esc(o.name) + ' <span class="small muted">' + esc(o.unit) + ' · ' + (o.completion || '–') + ' · ' + (o.capex_m === undefined || o.capex_m === null ? '–' : o.capex_m + ' M') + '</span> ' + (SRS.isDigital(o) ? '<span class="badge accent">digital</span>' : '<span class="badge">physical</span>') + (probs.length ? ' <span class="badge serious">' + probs.length + ' error' + (probs.length > 1 ? 's' : '') + '</span>' : '') + '</summary><div class="body">' +
            '<div class="form"><label>Identifier<input type="text" data-st="id" data-i="' + i + '" value="' + esc(o.id) + '"></label><label>Name<input type="text" data-st="name" data-i="' + i + '" value="' + esc(o.name) + '"></label><label>Unit<select data-st="unit" data-i="' + i + '">' + units.map(function (x) { return '<option value="' + esc(x.unit.id) + '"' + (x.unit.id === o.unit ? ' selected' : '') + '>' + esc(x.unit.name) + '</option>'; }).join('') + '</select></label><label>Tags (comma-separated)<input type="text" data-st="tags" data-i="' + i + '" value="' + esc((o.tags || []).join(', ')) + '"></label><label>Lag class<select data-st="lag_class" data-i="' + i + '">' + A.LAG_CLASSES.map(function (l) { return '<option' + (l === o.lag_class ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select></label><label>Start year<input type="number" data-st="start" data-i="' + i + '" value="' + esc(o.start || '') + '"></label><label>Completion year<input type="number" data-st="completion" data-i="' + i + '" value="' + esc(o.completion || '') + '"></label><label>Capital cost (M)<input type="number" step="any" data-st="capex_m" data-i="' + i + '" value="' + esc(o.capex_m === undefined ? '' : o.capex_m) + '"></label><label>Operating cost (M a year)<input type="number" step="any" data-st="opex_m" data-i="' + i + '" value="' + esc(o.opex_m === undefined ? '' : o.opex_m) + '"></label><label>Basis<input type="text" data-st="basis" data-i="' + i + '" value="' + esc(o.basis || '') + '"></label><label>Grade<select data-st="estimate_grade" data-i="' + i + '">' + ['A', 'B', 'C'].map(function (gr) { return '<option' + (gr === o.estimate_grade ? ' selected' : '') + '>' + gr + '</option>'; }).join('') + '</select></label></div>' +
            '<h4 style="margin-top:8px">Realised effects</h4><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Unit</th><th>Indicator</th><th>Form</th><th class="num">Value (delta, or the value now)</th><th class="num">Before (for a set)</th><th></th></tr></thead><tbody>' + (o.effects || []).map(function (e, j) {
              return '<tr><td><select data-ste="unit" data-i="' + i + '" data-j="' + j + '">' + units.map(function (x) { return '<option value="' + esc(x.unit.id) + '"' + (x.unit.id === e.unit ? ' selected' : '') + '>' + esc(x.unit.id) + '</option>'; }).join('') + '</select></td><td><input type="text" data-ste="code" data-i="' + i + '" data-j="' + j + '" value="' + esc(e.code) + '" style="width:60px"></td><td><select data-ste="form" data-i="' + i + '" data-j="' + j + '"><option' + (e.delta !== undefined ? ' selected' : '') + '>delta</option><option' + (e.set !== undefined ? ' selected' : '') + '>set</option></select></td><td class="num"><input type="number" step="any" data-ste="value" data-i="' + i + '" data-j="' + j + '" value="' + esc(e.delta !== undefined ? e.delta : e.set) + '" style="width:90px"></td><td class="num"><input type="number" step="any" data-ste="before" data-i="' + i + '" data-j="' + j + '" value="' + esc(e.before === undefined || e.before === null ? '' : e.before) + '" style="width:90px"></td><td><button class="btn small danger" data-delste="' + i + '" data-j="' + j + '">×</button></td></tr>';
            }).join('') + '</tbody></table></div><div class="row" style="margin-top:6px"><button class="btn small" data-addste="' + i + '">Add an effect</button><button class="btn small danger" data-delstock="' + i + '">Remove the record</button></div>' + (probs.length ? problemList(probs, '') : '') + '</div></details>';
        }).join('') : '<p class="small muted">No system in operation is recorded. The in-operation reading needs the operating register: each system already running, with the effects it has realised at the baseline (a delta, or a set with its before value).</p>') +
        '<div class="row" style="margin-top:8px"><button class="btn small" id="add-stock">Add a record in operation</button><button class="btn small primary" id="save-stock">Save</button></div><p class="small muted" style="margin-top:6px">A complete record is never applied forward; the in-operation reading removes its realised effects from today\'s values and re-scores.</p></div></div>';
      // crosswalk
      html += '<div class="section"><details class="drawer"><summary><b>The capability crosswalk</b> <span class="small muted">(which outcome indicators each capability serves; grade B by ISO theme, C by a stated mechanism)</span></summary><div class="body"><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Capability</th><th>Theme</th><th>Serves</th></tr></thead><tbody>' + Object.keys(E.crosswalk).map(function (c) { var th = SRS.themeOf(c); return '<tr><td class="mono">' + c + ' <span class="small muted">' + esc(IND[c] ? IND[c].name : '') + '</span></td><td>' + (th || '–') + ' ' + esc(SRS.themeNames()[th] || '') + '</td><td class="small">' + E.crosswalk[c].map(function (r) { return '<span class="mono">' + r.code + '</span> <span class="badge">' + r.grade + '</span>'; }).join(' ') + '</td></tr>'; }).join('') + '</tbody></table></div></div></details></div>';
      return html;
    },
    mount: function (root) {
      var st = S(), ui = U();
      var sel = root.querySelector('#sel-smart-unit'); if (sel) sel.addEventListener('change', function () { ui.smartUnit = sel.value; A.rerender(); });
      A.on(root, '[data-smartunit]', 'click', function (ev, el) { ev.preventDefault(); ui.smartUnit = el.getAttribute('data-smartunit'); A.rerender(); window.scrollTo(0, 0); });
      A.on(root, '[data-goprogramme]', 'click', function (ev, el) { ui.programme = el.getAttribute('data-goprogramme'); });
      A.on(root, '[data-goproject]', 'click', function (ev, el) { ui.project = el.getAttribute('data-goproject'); });
      function readCatalysis() {
        var cat = st.cfg.catalysis;
        root.querySelectorAll('[data-cat]').forEach(function (el) { var v = parseFloat(el.value); if (!isNaN(v)) cat[el.getAttribute('data-cat')] = v; });
        root.querySelectorAll('[data-cp]').forEach(function (el) { var i = parseInt(el.getAttribute('data-i'), 10), k = el.getAttribute('data-cp'); if (!cat.couplings[i]) return; if (k === 'subs') cat.couplings[i].subs = el.value.split(',').map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean); else cat.couplings[i][k] = el.value.trim(); });
      }
      var add = root.querySelector('#add-coupling'); if (add) add.addEventListener('click', function () { readCatalysis(); st.cfg.catalysis.couplings.push({ a: '', b: '', subs: [] }); A.dataChanged(); A.rerender(); });
      A.on(root, '[data-delcp]', 'click', function (ev, el) { readCatalysis(); st.cfg.catalysis.couplings.splice(parseInt(el.getAttribute('data-delcp'), 10), 1); A.dataChanged(); A.rerender(); });
      var sc = root.querySelector('#save-catalysis'); if (sc) sc.addEventListener('click', function () { readCatalysis(); A.dataChanged(); A.toast('Couplings and premium saved'); A.rerender(); });
      function readStock() {
        root.querySelectorAll('[data-st]').forEach(function (el) {
          var i = parseInt(el.getAttribute('data-i'), 10), k = el.getAttribute('data-st'), o = st.stock[i]; if (!o) return;
          if (k === 'tags') o.tags = el.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
          else if (['start', 'completion'].indexOf(k) >= 0) { var n = parseInt(el.value, 10); if (isNaN(n)) delete o[k]; else o[k] = n; }
          else if (['capex_m', 'opex_m'].indexOf(k) >= 0) { var f = parseFloat(el.value); if (isNaN(f)) delete o[k]; else o[k] = f; }
          else o[k] = el.value.trim();
          o.status = 'complete';
        });
        root.querySelectorAll('[data-ste]').forEach(function (el) {
          var i = parseInt(el.getAttribute('data-i'), 10), j = parseInt(el.getAttribute('data-j'), 10), k = el.getAttribute('data-ste'), o = st.stock[i]; if (!o || !o.effects || !o.effects[j]) return;
          var e = o.effects[j];
          if (k === 'unit') e.unit = el.value; else if (k === 'code') e.code = el.value.trim().toUpperCase();
          else if (k === 'form') { var v = e.delta !== undefined ? e.delta : e.set; delete e.delta; delete e.set; e[el.value] = v; }
          else if (k === 'value') { var v2 = parseFloat(el.value); if (e.delta !== undefined) e.delta = v2; else e.set = v2; }
          else if (k === 'before') { var b = parseFloat(el.value); if (isNaN(b)) delete e.before; else e.before = b; }
        });
      }
      var addS = root.querySelector('#add-stock'); if (addS) addS.addEventListener('click', function () { readStock(); st.stock.push({ id: 'L' + (st.stock.length + 1), name: 'New system in operation', unit: ui.smartUnit, tags: ['digital'], lag_class: 'programme', status: 'complete', completion: st.money.base_year - 1, capex_m: 0, opex_m: 0, estimate_grade: 'B', effects: [] }); A.dataChanged(); A.rerender(); });
      A.on(root, '[data-delstock]', 'click', function (ev, el) { readStock(); st.stock.splice(parseInt(el.getAttribute('data-delstock'), 10), 1); A.dataChanged(); A.rerender(); });
      A.on(root, '[data-addste]', 'click', function (ev, el) { readStock(); var o = st.stock[parseInt(el.getAttribute('data-addste'), 10)]; if (o) { o.effects = o.effects || []; o.effects.push({ unit: o.unit, code: 'SS1', delta: 0 }); } A.dataChanged(); A.rerender(); });
      A.on(root, '[data-delste]', 'click', function (ev, el) { readStock(); var o = st.stock[parseInt(el.getAttribute('data-delste'), 10)]; if (o && o.effects) o.effects.splice(parseInt(el.getAttribute('data-j'), 10), 1); A.dataChanged(); A.rerender(); });
      var ss = root.querySelector('#save-stock'); if (ss) ss.addEventListener('click', function () { readStock(); A.dataChanged(); A.toast('Operating register saved'); A.rerender(); });
    }
  });
})(window);
