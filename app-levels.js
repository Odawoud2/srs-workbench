/* SRS Workbench, version 1.5: the level pages above the project record — project manager, programme manager, portfolio manager and
   the city's expectations (goals, fields, value library, envelope). Every figure on these pages is derived by SRS.chain() from the
   project records' effect sheets and investments and carries their identifiers; the money view is reported beside the score. */
(function (global) {
  'use strict';
  var A = global.APP, SRS = A.SRS, DATA = A.DATA, DIMS = A.DIMS, DIM_NAME = A.DIM_NAME, IND = A.IND;
  var esc = A.esc, f3 = A.f3, f2 = A.f2, fd = A.fd, pc = A.pc, fv = A.fv, money = A.money;
  var H = A.shared, pageHead = H.pageHead, problemList = H.problemList, effectText = H.effectText, unitName = H.unitName;
  function S() { return A.state(); }
  function U() { return S().ui; }

  // ---------- helpers ----------
  function m1(x, d) { if (x === null || x === undefined || isNaN(x)) return '–'; d = d === undefined ? 1 : d; if (Math.abs(x) < 0.5 * Math.pow(10, -d)) x = 0; return (x < 0 ? '−' : '') + Math.abs(x).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function rng(pv, d) { return !pv ? '–' : m1(pv.central, d) + ' <span class="small muted">(' + m1(pv.low, d) + '–' + m1(pv.high, d) + ')</span>'; }
  function ratio(x) { return (x === null || x === undefined) ? '–' : x.toFixed(2); }
  function pct(x) { return (x === null || x === undefined) ? '–' : Math.round(x * 100) + '%'; }
  function ids(xs) { return xs && xs.length ? xs.map(esc).join(', ') : '–'; }
  function cur() { return S().envelope.currency || ''; }
  function curNote() { return (cur() ? cur() + ' ' : '') + (S().envelope.price_year ? 'at ' + S().envelope.price_year + ' prices' : '') + ', millions; discount rate ' + pc(S().money.discount_rate) + ', ' + S().money.horizon_years + ' years from ' + S().money.base_year; }
  function statusBadge(st) {
    var cls = /met/.test(st) ? 'good' : /short|unserved|not adopted/.test(st) ? 'warn' : 'accent';
    return '<span class="badge ' + cls + '">' + esc(st) + '</span>';
  }
  function lineStatus(ln) {
    if (ln.counted_below) return '<span class="badge">counted below</span> <span class="small muted">' + esc((ln.counted_at || []).map(unitName).join(', ')) + '</span>';
    if (ln.status === SRS.NOT_VALUED) return '<span class="badge warn">not yet valued</span>';
    return '<span class="badge ' + (ln.illustrative ? 'warn' : 'good') + '">' + (ln.illustrative ? 'illustrative' : 'valued') + '</span>' + (ln.approximate ? ' <span class="badge flag">approximate scale</span>' : '');
  }
  function projLink(pid) { return '<a href="#project" data-goproject="' + esc(pid) + '" class="mono">' + esc(pid) + '</a>'; }
  function progLink(pgid) { return '<a href="#programme" data-goprogramme="' + esc(pgid) + '">' + esc(pgid) + '</a>'; }
  function goalLink(gid) { return '<a href="#city" class="mono">' + esc(gid) + '</a>'; }
  function chainOrError() {
    var c = A.chain();
    if (c.error) return { html: '<div class="callout warn"><b>The chain cannot be computed:</b> ' + esc(c.error.message || String(c.error)) + '. Fix the records named and try again.</div>', chain: null };
    return { html: '', chain: c.chain };
  }
  function problemsFor(problems, id) { return problems.filter(function (p) { return p.id === id; }); }
  function illustrativeNote(ch) {
    var lib = ch.city.library_status;
    if (!lib.valued.length) return '<div class="callout warn" style="margin-bottom:14px"><b>No value set.</b> The value library carries the framework\'s structure and no values; every outcome reads as not yet valued until the city sets a value against it on the City expectations page.</div>';
    if (lib.illustrative.length) return '<div class="callout warn" style="margin-bottom:14px"><b>Illustrative values.</b> ' + lib.illustrative.length + ' of the ' + lib.valued.length + ' values in the library are marked illustrative (orders of magnitude for the demonstration); money figures on this page are illustrations of the method, not estimates for a real place. The city replaces them on the City expectations page.</div>';
    return '';
  }
  function compTiles(c, label) {
    return '<div class="tiles"><div class="tile hero"><span class="label">Investment against value' + (label ? ' · ' + esc(label) : '') + '</span><span class="v">' + ratio(c.ratio.central) + '</span><span class="d">value per unit of cost (' + ratio(c.ratio.low) + '–' + ratio(c.ratio.high) + ')</span></div>' +
      '<div class="tile"><span class="label">PV cost</span><span class="v sm">' + m1(c.pv_cost) + '</span><span class="d">capital ' + m1(c.pv_capex) + ' · operating ' + m1(c.pv_opex) + ' · capital cost ' + m1(c.capex) + '</span></div>' +
      '<div class="tile"><span class="label">PV value</span><span class="v sm">' + m1(c.pv_value.central) + '</span><span class="d">' + m1(c.pv_value.low) + '–' + m1(c.pv_value.high) + ' on ' + c.n_valued + ' valued lines; ' + c.unvalued_lines.length + ' not yet valued' + (c.pv_saving ? '; operating savings ' + m1(c.pv_saving) + ' (' + c.saving_projects.join(', ') + ', may overlap with valued outcomes)' : '') + '</span></div>' +
      '<div class="tile"><span class="label">Net present value</span><span class="v sm ' + A.deltaClass(c.net.central) + '">' + m1(c.net.central) + '</span><span class="d">' + m1(c.net.low) + '–' + m1(c.net.high) + ' · payback ' + (c.payback_year || 'beyond the horizon') + '</span></div></div>';
  }
  function linesTable(lines, opts) {
    opts = opts || {};
    var rows = lines.slice();
    if (!opts.all) rows = rows.filter(function (ln) { return !ln.counted_below; });
    if (!rows.length) return '<p class="small muted">No outcome line: the records change no measured value.</p>';
    var html = '<div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Unit</th><th>Indicator</th>' + (opts.effects ? '<th>Effect</th>' : '<th>From the records</th>') + '<th class="num">Before</th><th class="num">After</th><th class="num">Change towards target</th><th>Multiplied by</th><th class="num">Value per unit</th><th class="num">A year at full effect</th><th class="num">PV, central (range)</th><th>Goals</th><th>Status</th></tr></thead><tbody>';
    rows.forEach(function (ln) {
      html += '<tr><td>' + esc(ln.unit_name) + '</td><td><span class="mono">' + ln.code + '</span> ' + esc(ln.name) + '</td><td class="small">' + (opts.effects ? ln.effects.map(function (e) { var x = {}; ['set', 'delta', 'reduce_by'].forEach(function (k) { if (e[k] !== undefined) x[k] = e[k]; }); return effectText(x); }).join('; ') : ln.projects.map(projLink).join(', ')) + '</td><td class="num">' + fv(ln.before) + '</td><td class="num">' + fv(ln.after) + '</td><td class="num ' + A.deltaClass(ln.improvement) + '">' + fv(ln.improvement) + '</td><td class="small">' + esc(ln.quantity_text) + '</td><td class="num">' + (ln.value_per ? fv(ln.value_per.central) : '–') + '</td><td class="num">' + (ln.annual ? m1(ln.annual.central, 2) : '–') + '</td><td class="num">' + (ln.pv ? m1(ln.pv.central) + ' <span class="small muted">(' + m1(ln.pv.low) + '–' + m1(ln.pv.high) + ')</span>' : '–') + '</td><td class="small">' + (ln.goals.length ? ln.goals.map(goalLink).join(', ') : '<span class="muted">none</span>') + '</td><td>' + lineStatus(ln) + '</td></tr>';
    });
    return html + '</tbody></table></div>';
  }
  function moneyChart(years, series, label) {
    var W = 640, Hh = 240, m = { t: 16, r: 16, b: 40, l: 54 }, iw = W - m.l - m.r, ih = Hh - m.t - m.b;
    var all = []; series.forEach(function (s) { s.values.forEach(function (v) { all.push(v); }); });
    var lo = Math.min(0, Math.min.apply(null, all)), hi = Math.max.apply(null, all); if (hi <= lo) hi = lo + 1;
    var step = Math.pow(10, Math.floor(Math.log(hi - lo) / Math.LN10)); if ((hi - lo) / step < 3) step /= 2;
    hi = Math.ceil(hi / step) * step; lo = Math.floor(lo / step) * step;
    function x(i) { return m.l + (years.length > 1 ? i / (years.length - 1) : 0.5) * iw; }
    function y(v) { return m.t + (1 - (v - lo) / (hi - lo)) * ih; }
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + Hh + '" role="img" aria-label="' + esc(label) + '"><g class="grid">';
    for (var v = lo; v <= hi + 1e-9; v += step) s += '<line x1="' + m.l + '" x2="' + (m.l + iw) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (m.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + m1(v, 0) + '</text>';
    s += '</g><g class="axis">';
    years.forEach(function (yr, i) { if (i % Math.ceil(years.length / 8) === 0 || i === years.length - 1) s += '<text x="' + x(i) + '" y="' + (Hh - m.b + 16) + '" text-anchor="middle">' + yr + '</text>'; });
    s += '</g>';
    series.forEach(function (sr) {
      var d = sr.values.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
      s += '<path d="' + d + '" fill="none" stroke="' + sr.color + '" stroke-width="2"' + (sr.dash ? ' stroke-dasharray="5 4"' : '') + '/>';
    });
    s += '</svg><div class="row small" style="margin-top:4px">' + series.map(function (sr) { return '<span><span class="swatch" style="background:' + sr.color + '"></span>' + esc(sr.name) + '</span>'; }).join('') + '</div>';
    return s;
  }
  function goalsOfPortfolio() { return S().portfolio.strategic_goals || []; }
  function scoreBeside(results, uid) {
    var r = results[uid]; if (!r || !r.contribution || !r.contribution.balance) return '';
    var c = r.contribution, cb = c.balance;
    return '<div class="panel"><h3>The score, beside the money</h3><p class="small muted">The rating of Manual Part 3 and the ranking rule of Part 4.8 are unchanged by the money view; this is the contribution of these records at ' + esc(unitName(uid)) + ' at full effect.</p><div class="tiles"><div class="tile"><span class="label">Balanced performance B</span><span class="v sm">' + f3(cb.B_before) + ' → ' + f3(cb.B_after) + '</span><span class="d ' + A.deltaClass(cb.B_after - cb.B_before) + '">' + fd(cb.B_after - cb.B_before) + '</span></div>' +
      DIMS.map(function (d) { var xx = c.dims[d]; return xx ? '<div class="tile"><span class="label"><span class="swatch" style="background:' + A.dimColor(d) + '"></span>' + DIM_NAME[d] + '</span><span class="v sm">' + f3(xx.before) + ' → ' + f3(xx.after) + '</span><span class="d ' + A.deltaClass(xx.change) + '">' + fd(xx.change) + '</span></div>' : ''; }).join('') + '</div>' +
      (r.notes.filter(function (n) { return /^IC\d/.test(n); }).length ? '<p class="small" style="margin-top:8px">Checks fired at this unit: ' + r.notes.filter(function (n) { return /^IC\d/.test(n); }).map(esc).join('; ') + '</p>' : '<p class="small muted" style="margin-top:8px">No interaction check fires at this unit.</p>') + '</div>';
  }
  function navHandlers(root) {
    A.on(root, '[data-goproject]', 'click', function (ev, el) { U().project = el.getAttribute('data-goproject'); });
    A.on(root, '[data-goprogramme]', 'click', function (ev, el) { U().programme = el.getAttribute('data-goprogramme'); });
  }

  // =====================================================================
  // PROJECT MANAGER
  // =====================================================================
  A.registerScreen('project', {
    guard: [{ part: 'options', sel: '[data-claim], [data-pf], #save-project-fields', why: 'The project record is kept by its project manager and the project appraisers.' }],
    render: function () {
      var st = S(), ui = U();
      if (!A.optionById(ui.project)) ui.project = (st.options.filter(function (o) { return o.status !== 'superseded'; })[0] || st.options[0] || {}).id || null;
      var controls = '<label class="control"><span>Project record</span><select id="sel-project">' + st.options.map(function (o) { return '<option value="' + esc(o.id) + '"' + (o.id === ui.project ? ' selected' : '') + '>' + esc(o.id + ' ' + o.name) + (o.status === 'superseded' ? ' (superseded)' : '') + '</option>'; }).join('') + '</select></label>';
      var html = pageHead('Project manager', 'The project record and where it sits', 'One record: its effect sheet and investment, whether it is admissible, which city goals it claims and which its effect sheet serves, the programme and strategic goals it feeds, its outcome lines with the city\'s values on them, and its investment against that value. Everything above this page is derived from records like this one.', controls);
      var ce = chainOrError(); html += ce.html; if (!ce.chain) return html;
      var ch = ce.chain, o = A.optionById(ui.project); if (!o) return html + '<div class="callout">No project record. Write one on the Project appraiser page.</div>';
      var p = ch.projects[o.id], tr = SRS.traceUp(ch, o.id), pg = p.programme ? A.programmeById(p.programme) : null;
      html += illustrativeNote(ch);
      // record
      html += '<div class="grid c2"><div class="panel"><div class="panel-head"><h3>Record ' + esc(o.id) + '</h3>' + statusBadge(o.status || 'candidate') + '</div><dl class="kv small"><dt>Name</dt><dd>' + esc(o.name) + '</dd><dt>Acts on</dt><dd>' + esc(unitName(o.unit)) + '</dd><dt>Programme</dt><dd>' + (pg ? progLink(pg.id) + ' ' + esc(pg.name) + ' · owner ' + esc(pg.owner || '–') : '<span class="muted">in no programme</span>') + '</dd><dt>Delivery</dt><dd>' + (o.start || '–') + '–' + (o.completion || '–') + (o.completion ? ', full effect from ' + (SRS.fullEffectYearOf(o)[0] || '–') : '') + '</dd><dt>Capital cost</dt><dd>' + money(o.capex_m) + (o.completion ? ' phased ' + Object.keys(SRS.capexProfile(o)).map(function (y) { return y + ' ' + m1(SRS.capexProfile(o)[y]); }).join(', ') : '') + '</dd><dt>Operating cost</dt><dd>' + money(o.opex_m) + ' a year' + (o.completion ? ' from ' + (o.completion + 1) : '') + '</dd><dt>Basis</dt><dd>' + esc(o.basis || '–') + (o.estimate_grade ? ' · grade ' + o.estimate_grade : '') + '</dd><dt>Tags and flags</dt><dd><div class="tags">' + (o.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + H.optionFlags(o) + '</div></dd><dt>Lag class</dt><dd>' + esc(o.lag_class || 'programme') + '</dd>' + (o.supersedes ? '<dt>Supersedes</dt><dd>' + projLink(o.supersedes) + '</dd>' : '') + (o.superseded_by ? '<dt>Superseded by</dt><dd>' + projLink(o.superseded_by) + '</dd>' : '') + '</dl>' +
        '<div class="form" style="margin-top:10px"><label>Status<select data-pf="status">' + ['candidate', 'approved', 'in delivery', 'complete', 'superseded'].map(function (x) { return '<option' + ((o.status || 'candidate') === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label><label>Start year<input type="number" data-pf="start" value="' + esc(o.start || '') + '"></label><label>Completion year<input type="number" data-pf="completion" value="' + esc(o.completion || '') + '"></label><label>Capital cost (M)<input type="number" step="any" data-pf="capex_m" value="' + esc(o.capex_m) + '"></label><label>Operating cost (M a year)<input type="number" step="any" data-pf="opex_m" value="' + esc(o.opex_m) + '"></label></div><div class="row" style="margin-top:8px"><button class="btn small primary" id="save-project-fields">Save</button><a class="btn small" href="#appraiser" data-editopt="' + esc(o.id) + '">Edit the effect sheet</a></div>' +
        '<h4 style="margin-top:12px">Admissibility</h4>' + problemList(p.record_problems, 'the record is complete and admissible') + '</div>' +
        // alignment
        '<div class="panel"><h3>Alignment, upwards</h3><p class="small muted">Tick the city goals this record claims to serve; the calculator reads the effect sheet and reports whether each claim is borne out (an effect on a goal\'s indicator at the goal\'s unit or beneath it, moving it towards the target).</p><div class="stack">' + st.goals.map(function (g) {
          var claimed = (o.goals || []).indexOf(g.id) >= 0, served = p.city_goals_served.indexOf(g.id) >= 0, counter = p.counter.indexOf(g.id) >= 0;
          var verdict = claimed && served ? '<span class="badge good">served</span>' : claimed ? '<span class="badge warn">claimed, not borne out</span>' : served ? '<span class="badge accent">served, not claimed</span>' : counter ? '<span class="badge serious">counter-move</span>' : '';
          return '<label class="small" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" data-claim="' + esc(g.id) + '"' + (claimed ? ' checked' : '') + '><span><b>' + esc(g.id) + '</b> ' + esc(g.statement) + ' ' + verdict + '</span></label>';
        }).join('') + '</div>' +
        '<dl class="kv small" style="margin-top:12px"><dt>Programme</dt><dd>' + (tr.programme ? progLink(tr.programme) : '–') + '</dd><dt>Strategic goals</dt><dd>' + (tr.strategic_goals.length ? tr.strategic_goals.map(function (sgid) { var sg = goalsOfPortfolio().filter(function (x) { return x.id === sgid; })[0]; return '<b>' + esc(sgid) + '</b> ' + esc(sg ? sg.statement : '') + ' (city goal ' + esc(sg ? sg.city_goal : '') + ')'; }).join('<br>') : '<span class="muted">none: the record is in no programme</span>') + '</dd><dt>City goals</dt><dd>' + (p.city_goals_served.length ? p.city_goals_served.map(goalLink).join(', ') + ' served by the effect sheet' : '<span class="muted">none served</span>') + (p.unverified.length ? '; claims not borne out: ' + ids(p.unverified) : '') + (p.unclaimed.length ? '; served but not claimed: ' + ids(p.unclaimed) : '') + (p.counter.length ? '; counter-moves: ' + ids(p.counter) : '') + '</dd><dt>SDG targets</dt><dd>' + (tr.sdg_targets.length ? tr.sdg_targets.map(function (t) { return '<span class="badge">' + t + '</span> ' + esc(SRS.sdgTargetText()[t] || ''); }).join('<br>') : '–') + '</dd></dl></div></div>';
      // outcome lines and money
      html += '<div class="section"><div class="panel"><div class="panel-head"><h3>Outcome lines of this record alone</h3><span class="small muted">each line is one indicator at one unit the effect sheet names; the change is composed at full effect under readiness ' + esc(st.readiness) + '; the value is the change × the register figure the scale names × the city\'s value per unit, summed over the years along the record\'s ramp and discounted</span></div>' + linesTable(p.lines, { effects: true }) + '</div></div>';
      html += '<div class="section">' + compTiles(p.comparison, o.id) + '<p class="small muted" style="margin-top:6px">' + esc(curNote()) + '. Lines not yet valued: ' + (p.comparison.unvalued_lines.length ? p.comparison.unvalued_lines.map(function (x) { return x[1]; }).join(', ') : 'none') + '.</p></div>';
      html += '<div class="section">' + scoreBeside(p.results, o.unit) + '</div>';
      if (A.smartCard) html += A.smartCard('project', o.id);
      return html;
    },
    mount: function (root) {
      navHandlers(root);
      A.on(root, '#sel-project', 'change', function (ev, el) { U().project = el.value; A.rerender(); });
      A.on(root, '[data-editopt]', 'click', function (ev, el) { U().editing = JSON.parse(JSON.stringify(A.optionById(el.getAttribute('data-editopt')))); U().editing._orig = el.getAttribute('data-editopt'); });
      A.on(root, '[data-claim]', 'change', function (ev, el) {
        var o = A.optionById(U().project); if (!o) return;
        var gid = el.getAttribute('data-claim'); o.goals = (o.goals || []).filter(function (x) { return x !== gid; }); if (el.checked) o.goals.push(gid);
        A.dataChanged(); A.rerender();
      });
      A.on(root, '#save-project-fields', 'click', function () {
        var o = A.optionById(U().project); if (!o) return;
        root.querySelectorAll('[data-pf]').forEach(function (el) { var k = el.getAttribute('data-pf'); if (el.tagName === 'SELECT') o[k] = el.value; else { var v = parseFloat(el.value); if (isNaN(v)) delete o[k]; else o[k] = v; } });
        A.dataChanged(); A.rerender(); A.toast('Record ' + o.id + ' saved');
      });
    }
  });

  // =====================================================================
  // PROGRAMME MANAGER
  // =====================================================================
  function newProgramme() { var n = 1; while (A.programmeById('PG' + n)) n++; return { id: 'PG' + n, name: 'New programme', owner: '', unit: S().portfolio.unit || U().unit, projects: [], strategic_goals: [], outcomes: [] }; }
  A.registerScreen('programme', {
    guard: [{ part: 'programmes', sel: '[data-pgp], [data-pgsg], [data-pg], #save-programme, #new-programme, #del-programme', why: 'Programme records are kept by the programme and portfolio managers.' }],
    render: function () {
      var st = S(), ui = U();
      if (!A.programmeById(ui.programme)) ui.programme = st.programmes.length ? st.programmes[0].id : null;
      var controls = '<label class="control"><span>Programme</span><select id="sel-programme">' + st.programmes.map(function (g) { return '<option value="' + esc(g.id) + '"' + (g.id === ui.programme ? ' selected' : '') + '>' + esc(g.id + ' ' + g.name) + '</option>'; }).join('') + '</select></label><button class="btn small" id="new-programme">+ New programme</button>';
      var html = pageHead('Programme manager', 'The programme: its records, outcomes and benefits', 'A programme is a named group of project records. Its outcomes are the indicator changes those records make, composed together, each line naming the records that produce it; its benefits are the outcomes the city has put a value on; its contribution to the portfolio\'s strategic goals is the share of each city goal\'s remaining distance its records close, by the portfolio\'s horizon and at full effect.', controls);
      var ce = chainOrError(); html += ce.html; if (!ce.chain) return html;
      var ch = ce.chain, pg = A.programmeById(ui.programme);
      if (!pg) return html + '<div class="callout">No programme record yet. Create one and add project records to it.</div>';
      var P = ch.programmes[pg.id], probs = problemsFor(ch.problems, pg.id);
      html += illustrativeNote(ch);
      var approved = st.options.filter(function (o) { return o.status !== 'superseded'; });
      html += '<div class="grid c2"><div class="panel"><div class="panel-head"><h3>Record ' + esc(pg.id) + '</h3><span class="small muted">' + P.projects.length + ' project records</span></div><div class="form"><label>Identifier<input type="text" data-pg="id" value="' + esc(pg.id) + '"></label><label>Name<input type="text" data-pg="name" value="' + esc(pg.name) + '"></label><label>Owner<input type="text" data-pg="owner" value="' + esc(pg.owner || '') + '"></label><label>Accountable unit' + A.unitSelect('pg-unit', pg.unit || st.portfolio.unit) + '</label></div>' +
        '<h4 style="margin-top:12px">Project records in this programme</h4><div class="stack">' + approved.map(function (o) {
          var inThis = (pg.projects || []).indexOf(o.id) >= 0, other = A.programmeOf(o.id);
          var dis = other && other.id !== pg.id;
          return '<label class="small" style="display:flex;gap:8px;align-items:flex-start' + (dis ? ';opacity:.55' : '') + '"><input type="checkbox" data-pgp="' + esc(o.id) + '"' + (inThis ? ' checked' : '') + (dis ? ' disabled' : '') + '><span>' + projLink(o.id) + ' ' + esc(o.name) + ' <span class="muted">· ' + esc(unitName(o.unit)) + ' · ' + money(o.capex_m) + (dis ? ' · in ' + esc(other.id) : '') + '</span></span></label>';
        }).join('') + '</div>' +
        '<h4 style="margin-top:12px">Strategic goals this programme serves</h4><div class="stack">' + goalsOfPortfolio().map(function (sg) { return '<label class="small" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" data-pgsg="' + esc(sg.id) + '"' + ((pg.strategic_goals || []).indexOf(sg.id) >= 0 ? ' checked' : '') + '><span><b>' + esc(sg.id) + '</b> ' + esc(sg.statement) + ' <span class="muted">(city goal ' + esc(sg.city_goal) + ')</span></span></label>'; }).join('') + (goalsOfPortfolio().length ? '' : '<p class="small muted">The portfolio states no strategic goal yet.</p>') + '</div>' +
        '<div class="row" style="margin-top:10px"><button class="btn small primary" id="save-programme">Save</button><button class="btn small danger" id="del-programme">Delete programme</button></div>' +
        '<h4 style="margin-top:12px">Record checks</h4>' + problemList(probs, 'the programme record is complete') + '</div>' +
        '<div class="panel"><h3>Contribution to the strategic goals</h3><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Strategic goal</th><th>City goal</th><th class="num">Share closed by ' + ch.portfolio.horizon + '</th><th class="num">At full effect</th><th>Records serving it</th></tr></thead><tbody>' + (P.strategic_goals.length ? P.strategic_goals.map(function (sg) { return '<tr><td><b>' + esc(sg.id) + '</b> ' + esc(sg.statement) + '</td><td>' + goalLink(sg.city_goal) + '</td><td class="num">' + pct(sg.share_horizon) + '</td><td class="num">' + pct(sg.share_full) + '</td><td>' + (sg.projects.length ? sg.projects.map(projLink).join(', ') : '<span class="badge warn">none</span>') + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="muted">No strategic goal.</td></tr>') + '</tbody></table></div>' +
        '<p class="small muted" style="margin-top:8px">A goal measured on several indicators is as far along as its slowest. The share at the horizon follows each record\'s own ramp from its completion year.</p>' +
        (P.unaligned_outcomes.length ? '<p class="small" style="margin-top:8px"><b>Outcomes outside any city goal:</b> ' + P.unaligned_outcomes.length + ' lines on ' + Object.keys(P.unaligned_outcomes.reduce(function (a, x) { a[x[1]] = 1; return a; }, {})).length + ' indicators (' + Object.keys(P.unaligned_outcomes.reduce(function (a, x) { a[x[1]] = 1; return a; }, {})).sort().join(', ') + '): benefits the city has not stated an expectation for, or an expectation it has not yet written down.</p>' : '') +
        (P.checks.filter(function (n) { return /^IC\d/.test(n); }).length ? '<p class="small" style="margin-top:8px"><b>Checks fired at ' + esc(unitName(P.checks_unit)) + ':</b> ' + P.checks.filter(function (n) { return /^IC\d/.test(n); }).map(esc).join('; ') + '</p>' : '') + '</div></div>';
      html += '<div class="section"><div class="panel"><div class="panel-head"><h3>Outcomes, with the records that produce them</h3><label class="small"><input type="checkbox" id="show-all-lines"' + (ui.showAllLines ? ' checked' : '') + '> show lines counted below</label></div>' + linesTable(P.lines, { all: ui.showAllLines }) + '</div></div>';
      html += '<div class="section">' + compTiles(P.comparison, pg.id) + '<p class="small muted" style="margin-top:6px">' + esc(curNote()) + '. Sum of the records\' own values ' + m1(P.sum_of_projects_pv.central) + ', composed value ' + m1(P.comparison.pv_value.central) + ', overlap removed by composition ' + m1(P.overlap.central) + ' (records that move the same indicator at the same unit are composed, not added).</p></div>';
      html += '<div class="section">' + scoreBeside(P.results, pg.unit || st.portfolio.unit) + '</div>';
      if (A.smartCard) html += A.smartCard('programme', pg.id);
      return html;
    },
    mount: function (root) {
      navHandlers(root);
      var st = S(), ui = U();
      A.on(root, '#sel-programme', 'change', function (ev, el) { ui.programme = el.value; A.rerender(); });
      A.on(root, '#show-all-lines', 'change', function (ev, el) { ui.showAllLines = el.checked; A.rerender(); });
      A.on(root, '#new-programme', 'click', function () { var g = newProgramme(); st.programmes.push(g); ui.programme = g.id; A.dataChanged(); A.rerender(); });
      A.on(root, '#del-programme', 'click', function () { st.programmes = st.programmes.filter(function (g) { return g.id !== ui.programme; }); st.portfolio.programmes = (st.portfolio.programmes || []).filter(function (x) { return x !== ui.programme; }); ui.programme = null; A.dataChanged(); A.rerender(); });
      A.on(root, '[data-pgp]', 'change', function (ev, el) { var pg = A.programmeById(ui.programme); if (!pg) return; var pid = el.getAttribute('data-pgp'); pg.projects = (pg.projects || []).filter(function (x) { return x !== pid; }); if (el.checked) pg.projects.push(pid); A.dataChanged(); A.rerender(); });
      A.on(root, '[data-pgsg]', 'change', function (ev, el) { var pg = A.programmeById(ui.programme); if (!pg) return; var sg = el.getAttribute('data-pgsg'); pg.strategic_goals = (pg.strategic_goals || []).filter(function (x) { return x !== sg; }); if (el.checked) pg.strategic_goals.push(sg); A.dataChanged(); A.rerender(); });
      A.on(root, '#save-programme', 'click', function () {
        var pg = A.programmeById(ui.programme); if (!pg) return;
        var nid = root.querySelector('[data-pg="id"]').value.trim(); if (!nid) { A.toast('An identifier is required'); return; }
        if (nid !== pg.id && A.programmeById(nid)) { A.toast('A programme with this identifier exists'); return; }
        var old = pg.id; pg.id = nid; pg.name = root.querySelector('[data-pg="name"]').value; pg.owner = root.querySelector('[data-pg="owner"]').value; pg.unit = root.querySelector('#pg-unit').value;
        if (old !== nid) { st.portfolio.programmes = (st.portfolio.programmes || []).map(function (x) { return x === old ? nid : x; }); }
        if ((st.portfolio.programmes || []).indexOf(nid) < 0) { st.portfolio.programmes = (st.portfolio.programmes || []).concat([nid]); }
        ui.programme = nid; A.dataChanged(); A.rerender(); A.toast('Programme ' + nid + ' saved');
      });
    }
  });

  // =====================================================================
  // PORTFOLIO MANAGER
  // =====================================================================
  A.registerScreen('portfolio', {
    guard: [{ part: 'strategy', sel: '[data-pfo], [data-sg], [data-env], #save-portfolio, #add-sg, [data-delsg], [data-pfpg]', why: 'The portfolio record, its strategic goals and the envelope are kept by the portfolio manager and the sponsor.' }],
    render: function () {
      var st = S(), pf = st.portfolio, ui = U();
      var html = pageHead('Portfolio manager', esc(pf.name || 'The portfolio'), 'The portfolio adopts the city\'s goals as its strategic goals, in its own words and with the share of each goal\'s remaining distance it commits to close by the end of its term, and groups the programmes that serve them. This page compares the programmes\' investment against their value, reads the strategic goals against their commitments, phases the capital cost against the city\'s envelope, and reports the composed value of the whole against the sum of its programmes.');
      var ce = chainOrError(); html += ce.html; if (!ce.chain) return html;
      var ch = ce.chain, PF = ch.portfolio, probs = problemsFor(ch.problems, pf.id);
      html += illustrativeNote(ch);
      // record and strategic goals
      html += '<div class="grid c2"><div class="panel"><div class="panel-head"><h3>Record ' + esc(pf.id) + '</h3><span class="small muted">' + PF.programmes.length + ' programmes · ' + PF.projects.length + ' project records</span></div><div class="form"><label>Identifier<input type="text" data-pfo="id" value="' + esc(pf.id) + '"></label><label>Name<input type="text" data-pfo="name" value="' + esc(pf.name) + '"></label><label>Owner<input type="text" data-pfo="owner" value="' + esc(pf.owner || '') + '"></label><label>Accountable unit' + A.unitSelect('pf-unit', pf.unit || 'WH') + '</label><label>Term ends (horizon year)<input type="number" data-pfo="horizon" value="' + esc(pf.horizon || '') + '"></label></div>' +
        '<h4 style="margin-top:12px">Programmes in the portfolio</h4><div class="stack">' + st.programmes.map(function (g) { return '<label class="small" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" data-pfpg="' + esc(g.id) + '"' + ((pf.programmes || []).indexOf(g.id) >= 0 ? ' checked' : '') + '><span>' + progLink(g.id) + ' ' + esc(g.name) + ' <span class="muted">· ' + esc(g.owner || '') + ' · ' + (g.projects || []).length + ' records</span></span></label>'; }).join('') + (st.programmes.length ? '' : '<p class="small muted">No programme record yet.</p>') + '</div>' +
        '<div class="row" style="margin-top:10px"><button class="btn small primary" id="save-portfolio">Save</button></div><h4 style="margin-top:12px">Record checks</h4>' + problemList(probs.concat(ch.problems.filter(function (p) { return /^SG/.test(p.id); })), 'the portfolio record is complete') + '</div>';
      html += '<div class="panel"><div class="panel-head"><h3>Strategic goals</h3><button class="btn small" id="add-sg">+ Add</button></div><p class="small muted">Each strategic goal names the city goal it adopts, in the portfolio\'s own wording, and the share of that goal\'s remaining distance the portfolio commits to close by its horizon.</p><div class="stack" style="margin-top:8px">' + (pf.strategic_goals || []).map(function (sg, i) {
        return '<div class="form" style="grid-template-columns:repeat(auto-fit, minmax(110px, 1fr));align-items:end;padding-bottom:8px;border-bottom:1px solid var(--line)"><label style="grid-column:1/-1">Statement, in the portfolio\'s words<input type="text" data-sg="statement" data-i="' + i + '" value="' + esc(sg.statement || '') + '"></label><label>Id<input type="text" data-sg="id" data-i="' + i + '" value="' + esc(sg.id) + '"></label><label>City goal<select data-sg="city_goal" data-i="' + i + '">' + st.goals.map(function (g) { return '<option value="' + esc(g.id) + '"' + (g.id === sg.city_goal ? ' selected' : '') + '>' + esc(g.id) + '</option>'; }).join('') + '</select></label><label>Commitment (0–1)<input type="number" step="0.05" min="0" max="1" data-sg="commitment" data-i="' + i + '" value="' + esc(sg.commitment === undefined || sg.commitment === null ? '' : sg.commitment) + '"></label><label>&nbsp;<button class="btn small danger" data-delsg="' + i + '">Remove</button></label></div>';
      }).join('') + '</div></div></div>';
      // programmes comparison
      html += '<div class="section"><div class="panel"><div class="panel-head"><h3>Programmes: investment against value</h3><span class="small muted">' + esc(curNote()) + '</span></div><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Level</th><th class="num">Capital cost</th><th class="num">PV cost</th><th class="num">PV value, central (range)</th><th class="num">Net present value</th><th class="num">Value per unit of cost</th><th>Payback</th><th class="num">Lines not yet valued</th><th>Strategic goals</th></tr></thead><tbody>' +
        PF.programmes.map(function (pgid) { var P = ch.programmes[pgid]; if (!P) return ''; var c = P.comparison; return '<tr><td>' + progLink(pgid) + ' ' + esc(P.name) + '</td><td class="num">' + m1(c.capex) + '</td><td class="num">' + m1(c.pv_cost) + '</td><td class="num">' + rng(c.pv_value) + '</td><td class="num ' + A.deltaClass(c.net.central) + '">' + m1(c.net.central) + '</td><td class="num">' + ratio(c.ratio.central) + '</td><td>' + (c.payback_year || 'beyond horizon') + '</td><td class="num">' + c.unvalued_lines.length + '</td><td class="small">' + P.strategic_goals.map(function (s) { return s.id; }).join(', ') + '</td></tr>'; }).join('') +
        '<tr class="group"><td><b>Portfolio, composed</b></td><td class="num">' + m1(PF.comparison.capex) + '</td><td class="num">' + m1(PF.comparison.pv_cost) + '</td><td class="num">' + rng(PF.comparison.pv_value) + '</td><td class="num ' + A.deltaClass(PF.comparison.net.central) + '">' + m1(PF.comparison.net.central) + '</td><td class="num">' + ratio(PF.comparison.ratio.central) + '</td><td>' + (PF.comparison.payback_year || 'beyond horizon') + '</td><td class="num">' + PF.comparison.unvalued_lines.length + '</td><td></td></tr></tbody></table></div>' +
        '<p class="small muted" style="margin-top:8px">Composed value ' + m1(PF.comparison.pv_value.central) + ' against the sum of the programmes\' ' + m1(PF.sum_of_programmes_pv.central) + ': interaction between programmes ' + m1(PF.interaction.central) + '. A ratio far above the others invites a look at that programme\'s effect sheets before it invites investment: the money view multiplies the claimed change by the city\'s value, so an ambitious claim shows here first.</p></div></div>';
      // strategic goals contribution
      html += '<div class="section"><div class="panel"><h3>Strategic goals against their commitments</h3><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Strategic goal</th><th>City goal</th><th class="num">Commitment</th><th class="num">Share closed by ' + PF.horizon + '</th><th class="num">At full effect</th><th>Full effect in</th><th>Status</th><th>Programmes</th><th>Records</th></tr></thead><tbody>' +
        (PF.strategic_goals.length ? PF.strategic_goals.map(function (sg) { return '<tr><td><b>' + esc(sg.id) + '</b> ' + esc(sg.statement) + '</td><td>' + goalLink(sg.city_goal) + '</td><td class="num">' + pct(sg.commitment) + '</td><td class="num">' + pct(sg.share_horizon) + '</td><td class="num">' + pct(sg.share_full) + '</td><td>' + (sg.full_effect_year || '–') + (sg.late ? ' <span class="badge warn">late</span>' : '') + '</td><td>' + statusBadge(sg.status) + '</td><td>' + sg.programmes.map(progLink).join(', ') + '</td><td>' + sg.projects.map(projLink).join(', ') + '</td></tr>'; }).join('') : '<tr><td colspan="9" class="muted">No strategic goal stated.</td></tr>') + '</tbody></table></div></div></div>';
      // envelope
      var env = PF.envelope, years = Object.keys(st.envelope.by_year).map(function (k) { return parseInt(k, 10); }).sort(function (a, b) { return a - b; });
      html += '<div class="section grid c2"><div class="panel"><div class="panel-head"><h3>Capital cost against the city\'s envelope</h3><span class="small muted">' + esc(cur()) + ' millions by year</span></div><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Year</th><th class="num">Envelope</th><th class="num">Committed capital</th><th class="num">Headroom</th></tr></thead><tbody>' +
        (env ? Object.keys(env.by_year).map(function (y) { var r = env.by_year[y]; return '<tr><td>' + y + '</td><td class="num"><input type="number" step="any" data-env="' + y + '" value="' + esc(st.envelope.by_year[y] === undefined ? '' : st.envelope.by_year[y]) + '" style="width:90px"></td><td class="num">' + m1(r.committed) + '</td><td class="num ' + (r.headroom < -1e-9 ? 'delta-neg' : '') + '">' + m1(r.headroom) + (r.headroom < -1e-9 ? ' <span class="badge warn">over</span>' : '') + '</td></tr>'; }).join('') + '<tr class="group"><td><b>Total</b></td><td class="num">' + m1(env.total_envelope) + '</td><td class="num">' + m1(env.total_committed) + '</td><td class="num">' + m1(env.total_envelope - env.total_committed) + '</td></tr>' : '<tr><td colspan="4" class="muted">No envelope recorded.</td></tr>') + '</tbody></table></div>' +
        '<div class="row" style="margin-top:8px"><input type="number" id="env-year" placeholder="year" style="width:90px"><input type="number" step="any" id="env-amount" placeholder="amount" style="width:110px"><button class="btn small" id="add-env">Add year</button></div>' +
        (env && env.over_in.length ? '<p class="small" style="margin-top:8px"><b>The phasing exceeds the envelope in ' + env.over_in.join(', ') + '.</b> Re-phase a record (its start and completion years on the Project manager page), defer one, or revise the envelope on the City expectations page.</p>' : '<p class="small muted" style="margin-top:8px">The phased capital cost sits within the envelope in every year.</p>') + '</div>' +
        '<div class="panel"><h3>Cost and value by year</h3>' + (function () { var ys = []; for (var y = st.money.base_year; y < st.money.base_year + Math.min(15, st.money.horizon_years); y++) ys.push(y); var c = PF.comparison; return moneyChart(ys, [{ name: 'cost (capital and operating)', values: ys.map(function (y) { return c.cost_by_year[y] || 0; }), color: '#b45309' }, { name: 'value, central', values: ys.map(function (y) { return c.value_by_year[y].central; }), color: '#0f766e' }, { name: 'value, low', values: ys.map(function (y) { return c.value_by_year[y].low; }), color: '#0f766e', dash: true }], 'Cost and value by year'); })() + '<p class="small muted">Undiscounted, in millions; the first fifteen years of the horizon.</p></div></div>';
      // value by field and the score
      html += '<div class="section grid c2"><div class="panel"><h3>Value by field</h3><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Field</th><th class="num">PV value, central (range)</th><th class="num">Valued lines</th><th class="num">Not yet valued</th></tr></thead><tbody>' + Object.keys(PF.value_by_field).map(function (f) { var v = PF.value_by_field[f], fld = st.fields.filter(function (x) { return x.id === f; })[0]; return '<tr><td>' + esc(fld ? fld.name : (DIM_NAME[f] || f)) + '</td><td class="num">' + (v.valued_lines.length ? rng(v.pv) : '<span class="muted">no valued line</span>') + '</td><td class="num">' + v.valued_lines.length + '</td><td class="num">' + v.unvalued_lines.length + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        (PF.unaligned_outcomes.length ? '<p class="small" style="margin-top:8px"><b>Outcomes outside any city goal:</b> ' + PF.unaligned_outcomes.length + ' lines on ' + Object.keys(PF.unaligned_outcomes.reduce(function (a, x) { a[x[1]] = 1; return a; }, {})).length + ' indicators.</p>' : '') + '</div>' + scoreBeside(PF.results, pf.unit || 'WH') + '</div>';
      if (A.smartCard) html += A.smartCard('portfolio', st.portfolio.id);
      return html;
    },
    mount: function (root) {
      navHandlers(root);
      var st = S();
      A.on(root, '[data-pfpg]', 'change', function (ev, el) { var id = el.getAttribute('data-pfpg'); st.portfolio.programmes = (st.portfolio.programmes || []).filter(function (x) { return x !== id; }); if (el.checked) st.portfolio.programmes.push(id); A.dataChanged(); A.rerender(); });
      A.on(root, '#save-portfolio', 'click', function () {
        var pf = st.portfolio;
        root.querySelectorAll('[data-pfo]').forEach(function (el) { var k = el.getAttribute('data-pfo'); if (el.type === 'number') { var v = parseInt(el.value, 10); if (isNaN(v)) delete pf[k]; else pf[k] = v; } else pf[k] = el.value; });
        pf.unit = root.querySelector('#pf-unit').value;
        var sgs = [];
        root.querySelectorAll('[data-sg="id"]').forEach(function (el) { var i = el.getAttribute('data-i'), q = function (k) { return root.querySelector('[data-sg="' + k + '"][data-i="' + i + '"]'); }; var c = parseFloat(q('commitment').value); sgs.push({ id: el.value.trim(), statement: q('statement').value, city_goal: q('city_goal').value, commitment: isNaN(c) ? null : c }); });
        pf.strategic_goals = sgs;
        A.dataChanged(); A.rerender(); A.toast('Portfolio saved');
      });
      A.on(root, '#add-sg', 'click', function () { var n = (st.portfolio.strategic_goals || []).length + 1; st.portfolio.strategic_goals = (st.portfolio.strategic_goals || []).concat([{ id: 'SG' + n, statement: '', city_goal: st.goals.length ? st.goals[0].id : '', commitment: null }]); A.dataChanged(); A.rerender(); });
      A.on(root, '[data-delsg]', 'click', function (ev, el) { var i = parseInt(el.getAttribute('data-delsg'), 10); var gone = st.portfolio.strategic_goals[i]; st.portfolio.strategic_goals.splice(i, 1); st.programmes.forEach(function (g) { g.strategic_goals = (g.strategic_goals || []).filter(function (x) { return x !== gone.id; }); }); A.dataChanged(); A.rerender(); });
      A.on(root, '[data-env]', 'change', function (ev, el) { var y = parseInt(el.getAttribute('data-env'), 10), v = parseFloat(el.value); if (isNaN(v)) delete st.envelope.by_year[y]; else st.envelope.by_year[y] = v; A.dataChanged(); A.rerender(); });
      A.on(root, '#add-env', 'click', function () { var y = parseInt(root.querySelector('#env-year').value, 10), v = parseFloat(root.querySelector('#env-amount').value); if (isNaN(y) || isNaN(v)) { A.toast('Year and amount are required'); return; } st.envelope.by_year[y] = v; A.dataChanged(); A.rerender(); });
    }
  });

  // =====================================================================
  // CITY EXPECTATIONS: goals, fields, value library, envelope and money parameters
  // =====================================================================
  function goalRow(g, i, st) {
    var units = A.unitsInDisplayOrder();
    return '<div class="panel" style="margin-bottom:10px"><div class="form" style="grid-template-columns:repeat(auto-fit, minmax(140px, 1fr))"><label style="grid-column:1/-1">In the city\'s words<input type="text" data-g="statement" data-i="' + i + '" value="' + esc(g.statement || '') + '"></label><label>Id<input type="text" data-g="id" data-i="' + i + '" value="' + esc(g.id) + '"></label><label>Horizon<input type="number" data-g="horizon" data-i="' + i + '" value="' + esc(g.horizon || '') + '"></label><label>Source<input type="text" data-g="source" data-i="' + i + '" value="' + esc(g.source || '') + '"></label></div>' +
      '<div class="small muted" style="margin-top:6px">Measured on</div>' + (g.indicators || []).map(function (gi, j) {
        return '<div class="form" style="grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));margin-top:4px;align-items:end"><label>Indicator<select data-gi="code" data-i="' + i + '" data-j="' + j + '">' + DATA.indicators.map(function (x) { return '<option value="' + x.code + '"' + (x.code === gi.code ? ' selected' : '') + '>' + x.code + ' ' + esc(x.name) + '</option>'; }).join('') + '</select></label><label>Unit<select data-gi="unit" data-i="' + i + '" data-j="' + j + '">' + units.map(function (e) { return '<option value="' + esc(e.unit.id) + '"' + (e.unit.id === gi.unit ? ' selected' : '') + '>' + esc(e.unit.name) + '</option>'; }).join('') + '</select></label><label>Target<input type="number" step="any" data-gi="target" data-i="' + i + '" data-j="' + j + '" value="' + esc(gi.target) + '"></label><label>&nbsp;<button class="btn small danger" data-delgi="' + i + ':' + j + '">Remove</button></label></div>';
      }).join('') + '<div class="row" style="margin-top:6px"><button class="btn small" data-addgi="' + i + '">+ indicator</button><button class="btn small danger" data-delg="' + i + '">Delete goal</button><span class="small muted">SDG targets: ' + (SRS.goalSdgs(g).map(function (s) { return s.target; }).join(', ') || '–') + '</span></div></div>';
  }
  A.registerScreen('city', {
    guard: [{ part: 'strategy', sel: '[data-g], [data-gi], [data-addgi], [data-delgi], [data-delg], #add-goal, #save-goals, [data-lib], [data-fld], #save-fields, [data-money], #save-money, #lib-template, #lib-clear', why: 'The city\'s goals, fields, value library and money parameters are kept by the sponsor and the portfolio manager.' }],
    render: function () {
      var st = S(), ui = U();
      var html = pageHead('City expectations', 'Goals, value library and envelope', 'The city states its goals in its own words, each measured on library indicators at a named unit with a target at a horizon year; the SDG targets follow from the indicators through the crosswalk. The city also sets, against each change it wants to count, the value it puts on one unit of that change: the framework ships the structure of this library with no values in it, and an entry without a value is reported as not yet valued, never as zero.');
      var ce = chainOrError(); html += ce.html;
      var ch = ce.chain;
      if (ch) html += illustrativeNote(ch);
      // goals and their status
      html += '<div class="section"><div class="panel"><div class="panel-head"><h3>The city\'s goals and how the portfolio serves them</h3><span class="small muted">' + st.goals.length + ' goals</span></div>' + (ch ? '<div class="tbl-wrap"><table class="tbl small"><thead><tr><th>Goal</th><th>In the city\'s words</th><th>Horizon</th><th>SDG targets</th><th>Adopted as</th><th class="num">Share closed by ' + ch.portfolio.horizon + '</th><th class="num">At full effect</th><th>Full effect in</th><th>Status</th><th>Served by</th><th class="num">PV value, central</th></tr></thead><tbody>' + ch.city.goals.map(function (g) {
        return '<tr><td class="mono">' + esc(g.id) + '</td><td>' + esc(g.statement) + '</td><td>' + (g.horizon || '–') + '</td><td>' + g.sdgs.map(function (s) { return '<span class="badge" title="' + esc(s.text) + '">' + s.target + '</span>'; }).join(' ') + '</td><td>' + ids(g.strategic_goals) + '</td><td class="num">' + pct(g.share_horizon) + '</td><td class="num">' + pct(g.share_full) + '</td><td>' + (g.full_effect_year || '–') + (g.late ? ' <span class="badge warn">late</span>' : '') + '</td><td>' + statusBadge(g.status) + '</td><td class="small">' + g.programmes.map(progLink).join(', ') + (g.projects.length ? ': ' + g.projects.map(projLink).join(', ') : '') + '</td><td class="num">' + (g.value && g.value.valued_lines.length ? m1(g.value.pv.central) : '–') + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (ch.city.unserved.length || ch.city.not_adopted.length ? '<p class="small" style="margin-top:8px">' + (ch.city.unserved.length ? '<b>Unserved:</b> ' + ids(ch.city.unserved) + '. ' : '') + (ch.city.not_adopted.length ? '<b>Not adopted by the portfolio:</b> ' + ids(ch.city.not_adopted) + '.' : '') + '</p>' : '') : '') + '</div></div>';
      // goal editor
      html += '<div class="section"><details class="drawer"><summary><b>Edit the goals</b> <span class="small muted">(statement, horizon, source, the indicators and targets it is measured on)</span></summary><div class="body">' + st.goals.map(function (g, i) { return goalRow(g, i, st); }).join('') + '<div class="row"><button class="btn small" id="add-goal">+ New goal</button><button class="btn small primary" id="save-goals">Save goals</button></div></div></details></div>';
      // value library
      var lib = st.valueLibrary, byCode = SRS.libraryByCode(lib), moved = ch ? ch.portfolio.lines.reduce(function (a, ln) { a[ln.code] = true; return a; }, {}) : {};
      var q = (ui.libSearch || '').toLowerCase();
      var rows = DATA.indicators.filter(function (i) { var e = byCode[i.code]; if (ui.libFilter === 'moved' && !moved[i.code]) return false; if (ui.libFilter === 'valued' && !(e && e.value !== null && e.value !== undefined)) return false; return !q || (i.code + ' ' + i.name).toLowerCase().indexOf(q) >= 0; });
      var libProblems = SRS.validateValueLibrary(lib, st.fields).filter(function (p) { return p.severity === 'error'; });
      html += '<div class="section"><div class="panel"><div class="panel-head"><h3>Value library</h3><div class="row"><select id="lib-filter">' + [['moved', 'indicators the portfolio moves'], ['valued', 'entries with a value'], ['all', 'every indicator']].map(function (x) { return '<option value="' + x[0] + '"' + (ui.libFilter === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select><input type="search" id="lib-search" placeholder="code or name" value="' + esc(ui.libSearch || '') + '"><button class="btn small" id="lib-template">Reset to the empty template</button></div></div>' +
        '<p class="small muted">A value is the currency amount the city sets against one unit of change in the indicator, for one of the things the scale names, for one year; the calculator multiplies the change by the register figure (residents, dwellings, area, a recorded count, or the unit as a whole) and by the value, year by year along the records\' ramps. A value needs the basis the city will cite, a grade and a range; tick <i>illustrative</i> for an order of magnitude that is not the city\'s own.</p>' +
        (libProblems.length ? problemList(libProblems, '') : '') +
        '<div class="tbl-wrap" style="margin-top:8px"><table class="tbl small"><thead><tr><th>Code</th><th>What is valued</th><th>Scale</th><th>Field</th><th class="num">Value per unit</th><th class="num">Low</th><th class="num">High</th><th>Grade</th><th>Basis</th><th>Illustrative</th><th>Status</th></tr></thead><tbody>' + rows.map(function (i) {
          var e = byCode[i.code] || SRS.valueLibraryTemplate(st.fields, st.envelope.currency, st.envelope.price_year).filter(function (x) { return x.code === i.code; })[0];
          var c = i.code;
          return '<tr><td class="mono">' + c + (moved[c] ? ' <span class="badge accent" title="moved by the portfolio">●</span>' : '') + '</td><td class="small"><input type="text" data-lib="valued" data-c="' + c + '" value="' + esc(e.valued) + '" style="min-width:230px"><div class="faint">' + esc(i.name) + ' · ' + esc(i.unit) + '</div></td><td class="small">' + esc(e.scale.replace(/_/g, ' ')) + (e.count ? ' (' + esc(e.count.replace(/_/g, ' ')) + ')' : '') + '<br>' + esc(e.per) + '</td><td><select data-lib="field" data-c="' + c + '">' + st.fields.map(function (f) { return '<option value="' + esc(f.id) + '"' + (f.id === e.field ? ' selected' : '') + '>' + esc(f.name) + '</option>'; }).join('') + DIMS.map(function (d) { return '<option value="' + d + '"' + (d === e.field ? ' selected' : '') + '>' + DIM_NAME[d] + '</option>'; }).join('') + '</select></td><td class="num"><input type="number" step="any" data-lib="value" data-c="' + c + '" value="' + esc(e.value === null || e.value === undefined ? '' : e.value) + '" style="width:100px"></td><td class="num"><input type="number" step="any" data-lib="low" data-c="' + c + '" value="' + esc(e.low === null || e.low === undefined ? '' : e.low) + '" style="width:90px"></td><td class="num"><input type="number" step="any" data-lib="high" data-c="' + c + '" value="' + esc(e.high === null || e.high === undefined ? '' : e.high) + '" style="width:90px"></td><td><select data-lib="grade" data-c="' + c + '">' + ['', 'A', 'B', 'C'].map(function (g) { return '<option value="' + g + '"' + ((e.grade || '') === g ? ' selected' : '') + '>' + (g || '–') + '</option>'; }).join('') + '</select></td><td><input type="text" data-lib="basis" data-c="' + c + '" value="' + esc(e.basis || '') + '" placeholder="the source the city will cite" style="min-width:180px"></td><td><input type="checkbox" data-lib="illustrative" data-c="' + c + '"' + (e.illustrative ? ' checked' : '') + '></td><td>' + (e.value === null || e.value === undefined ? '<span class="badge warn">not yet valued</span>' : e.illustrative ? '<span class="badge warn">illustrative</span>' : '<span class="badge good">valued</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="small muted" style="margin-top:6px">Entries with a value: ' + lib.filter(function (e) { return e.value !== null && e.value !== undefined; }).length + ' of ' + DATA.indicators.length + '. ● marks an indicator the portfolio\'s records move.</p></div></div>';
      // fields, money parameters and envelope summary
      html += '<div class="section grid c2"><div class="panel"><h3>Fields</h3><p class="small muted">The city\'s own grouping of the sub-dimensions for reporting value.</p>' + st.fields.map(function (f, i) { return '<div class="form" style="margin-top:4px"><label>Id<input type="text" data-fld="id" data-i="' + i + '" value="' + esc(f.id) + '"></label><label>Name<input type="text" data-fld="name" data-i="' + i + '" value="' + esc(f.name) + '"></label><label>Sub-dimensions<input type="text" data-fld="subs" data-i="' + i + '" value="' + esc((f.subs || []).join(', ')) + '"></label></div>'; }).join('') + '<div class="row" style="margin-top:8px"><button class="btn small" id="add-field">+ Field</button><button class="btn small primary" id="save-fields">Save fields</button></div></div>' +
        '<div class="panel"><h3>Money parameters</h3><div class="form"><label>Currency<input type="text" data-money="currency" value="' + esc(st.envelope.currency) + '"></label><label>Price year<input type="number" data-money="price_year" value="' + esc(st.envelope.price_year || '') + '"></label><label>Base year<input type="number" data-money="base_year" value="' + esc(st.money.base_year) + '"></label><label>Horizon (years)<input type="number" data-money="horizon_years" value="' + esc(st.money.horizon_years) + '"></label><label>Discount rate<input type="number" step="0.005" data-money="discount_rate" value="' + esc(st.money.discount_rate) + '"></label></div><div class="row" style="margin-top:8px"><button class="btn small primary" id="save-money">Save</button></div>' +
        (ch ? '<h4 style="margin-top:12px">Investment against value at the city</h4><dl class="kv small"><dt>PV cost</dt><dd>' + m1(ch.city.comparison.pv_cost) + '</dd><dt>PV value</dt><dd>' + rng(ch.city.comparison.pv_value) + '</dd><dt>Net</dt><dd>' + rng(ch.city.comparison.net) + '</dd><dt>Value per unit of cost</dt><dd>' + ratio(ch.city.comparison.ratio.central) + '</dd><dt>Envelope</dt><dd>' + (ch.city.envelope ? m1(ch.city.envelope.total_committed) + ' committed of ' + m1(ch.city.envelope.total_envelope) + (ch.city.envelope.over_in.length ? '; over in ' + ch.city.envelope.over_in.join(', ') : '') : '–') + '</dd><dt>Not valued but moved</dt><dd>' + (ch.city.library_status.not_valued_but_moved.length ? ch.city.library_status.not_valued_but_moved.join(', ') : 'none') + '</dd></dl>' : '') + '</div></div>';
      if (A.smartCard) html += A.smartCard('city', st.portfolio.unit || (A.territory().tree.roots[0]));
      return html;
    },
    mount: function (root) {
      navHandlers(root);
      var st = S(), ui = U(), t = null;
      A.on(root, '#lib-filter', 'change', function (ev, el) { ui.libFilter = el.value; A.rerender(); });
      A.on(root, '#lib-search', 'input', function (ev, el) { ui.libSearch = el.value; clearTimeout(t); t = setTimeout(function () { var pos = el.selectionStart; A.rerender(); var e2 = document.getElementById('lib-search'); if (e2) { e2.focus(); e2.setSelectionRange(pos, pos); } }, 350); });
      A.on(root, '[data-lib]', 'change', function (ev, el) {
        var c = el.getAttribute('data-c'), k = el.getAttribute('data-lib');
        var e = SRS.libraryByCode(st.valueLibrary)[c];
        if (!e) { e = SRS.valueLibraryTemplate(st.fields, st.envelope.currency, st.envelope.price_year).filter(function (x) { return x.code === c; })[0]; st.valueLibrary.push(e); }
        if (el.type === 'checkbox') e[k] = el.checked;
        else if (el.type === 'number') { var v = parseFloat(el.value); e[k] = isNaN(v) ? null : v; }
        else e[k] = el.value || null;
        if (k === 'value' && e.value !== null) { e.currency = st.envelope.currency; e.price_year = st.envelope.price_year; }
        A.dataChanged(); A.rerender();
      });
      A.on(root, '#lib-template', 'click', function () { st.valueLibrary = SRS.valueLibraryTemplate(st.fields, st.envelope.currency, st.envelope.price_year); A.dataChanged(); A.rerender(); A.toast('Value library reset: every entry is now not yet valued'); });
      A.on(root, '#add-goal', 'click', function () { var n = st.goals.length + 1; st.goals.push({ id: 'G' + n, statement: '', horizon: null, indicators: [{ code: 'EN1', unit: st.portfolio.unit || 'WH', target: IND.EN1 ? IND.EN1.target : 0 }], source: '' }); A.dataChanged(); A.rerender(); });
      A.on(root, '[data-addgi]', 'click', function (ev, el) { var g = st.goals[parseInt(el.getAttribute('data-addgi'), 10)]; g.indicators.push({ code: 'EN1', unit: st.portfolio.unit || 'WH', target: 0 }); A.dataChanged(); A.rerender(); });
      A.on(root, '[data-delgi]', 'click', function (ev, el) { var p = el.getAttribute('data-delgi').split(':'); st.goals[parseInt(p[0], 10)].indicators.splice(parseInt(p[1], 10), 1); A.dataChanged(); A.rerender(); });
      A.on(root, '[data-delg]', 'click', function (ev, el) { var g = st.goals[parseInt(el.getAttribute('data-delg'), 10)]; st.goals.splice(parseInt(el.getAttribute('data-delg'), 10), 1); st.options.forEach(function (o) { o.goals = (o.goals || []).filter(function (x) { return x !== g.id; }); }); st.portfolio.strategic_goals = (st.portfolio.strategic_goals || []).filter(function (sg) { return sg.city_goal !== g.id; }); A.dataChanged(); A.rerender(); });
      A.on(root, '#save-goals', 'click', function () {
        st.goals.forEach(function (g, i) {
          var q = function (k) { return root.querySelector('[data-g="' + k + '"][data-i="' + i + '"]'); };
          var old = g.id; g.id = q('id').value.trim() || g.id; g.statement = q('statement').value; var h = parseInt(q('horizon').value, 10); g.horizon = isNaN(h) ? null : h; g.source = q('source').value;
          g.indicators.forEach(function (gi, j) { var r = function (k) { return root.querySelector('[data-gi="' + k + '"][data-i="' + i + '"][data-j="' + j + '"]'); }; gi.code = r('code').value; gi.unit = r('unit').value; var tv = parseFloat(r('target').value); gi.target = isNaN(tv) ? gi.target : tv; });
          if (old !== g.id) { st.options.forEach(function (o) { o.goals = (o.goals || []).map(function (x) { return x === old ? g.id : x; }); }); (st.portfolio.strategic_goals || []).forEach(function (sg) { if (sg.city_goal === old) sg.city_goal = g.id; }); }
        });
        A.dataChanged(); A.rerender(); A.toast('Goals saved');
      });
      A.on(root, '#add-field', 'click', function () { st.fields.push({ id: 'field' + (st.fields.length + 1), name: 'New field', subs: [] }); A.dataChanged(); A.rerender(); });
      A.on(root, '#save-fields', 'click', function () {
        st.fields.forEach(function (f, i) { var q = function (k) { return root.querySelector('[data-fld="' + k + '"][data-i="' + i + '"]'); }; var old = f.id; f.id = q('id').value.trim() || f.id; f.name = q('name').value; f.subs = q('subs').value.split(',').map(function (x) { return x.trim().toUpperCase(); }).filter(Boolean); if (old !== f.id) st.valueLibrary.forEach(function (e) { if (e.field === old) e.field = f.id; }); });
        A.dataChanged(); A.rerender(); A.toast('Fields saved');
      });
      A.on(root, '#save-money', 'click', function () {
        var q = function (k) { return root.querySelector('[data-money="' + k + '"]'); };
        st.envelope.currency = q('currency').value; var py = parseInt(q('price_year').value, 10); st.envelope.price_year = isNaN(py) ? null : py;
        var by = parseInt(q('base_year').value, 10), hy = parseInt(q('horizon_years').value, 10), dr = parseFloat(q('discount_rate').value);
        if (!isNaN(by)) st.money.base_year = by; if (!isNaN(hy) && hy > 0) st.money.horizon_years = hy; if (!isNaN(dr) && dr >= 0) st.money.discount_rate = dr;
        A.dataChanged(); A.rerender(); A.toast('Money parameters saved');
      });
    }
  });
})(window);
