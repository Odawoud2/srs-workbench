/* SRS Workbench cloud layer: Firebase sign-in, a shared workspace per organisation, role-based editing and an audit log.
   Active only when firebase-config.js supplies a Firebase web configuration and the Firebase SDK has loaded; otherwise the
   workbench runs in local mode and this file only registers the Account and team screen, which explains how to switch on.

   Firestore layout
     users/{uid}                        { orgId, email }
     invites/{email}                    { orgId, orgName, role, invitedBy, at }
     orgs/{orgId}                       { name, createdBy, createdAt }
     orgs/{orgId}/members/{uid}         { email, name, role, joinedAt }
     orgs/{orgId}/workspace/{part}      { json, rev, updatedAt, updatedBy, updatedByEmail }   part = register | config | options | strategy | programmes
     orgs/{orgId}/audit/{auto}          { at, uid, email, role, part, summary }
   Roles: owner, lead (assessment lead), steward (data steward), appraiser (project appraiser), dimension (dimension lead),
   sponsor, viewer, and from version 1.4 portfolio (portfolio manager), programme (programme manager), project (project manager).
   From version 1.5 the register part also carries the operating register (records with status complete) and the config part the coupling table
   and premium. Write rights: register: owner, lead, steward; config: owner, lead; options (project records): owner, lead, appraiser, programme,
   project; strategy (city goals, fields, value library, envelope, portfolio record): owner, lead, sponsor, portfolio; programmes:
   owner, lead, portfolio, programme; team: owner, lead. The same rights are enforced by firestore.rules. */
(function (global) {
  'use strict';
  var A = global.APP;
  var esc = A.esc;
  var ROLE_NAMES = { owner: 'Owner', lead: 'Assessment lead', steward: 'Data steward', appraiser: 'Project appraiser', dimension: 'Dimension lead', sponsor: 'Sponsor', viewer: 'Viewer',
    portfolio: 'Portfolio manager', programme: 'Programme manager', project: 'Project manager' };
  var WRITE = { register: ['owner', 'lead', 'steward'], config: ['owner', 'lead'], options: ['owner', 'lead', 'appraiser', 'programme', 'project'],
    strategy: ['owner', 'lead', 'sponsor', 'portfolio'], programmes: ['owner', 'lead', 'portfolio', 'programme'], team: ['owner', 'lead'] };
  var PARTS = ['register', 'config', 'options', 'strategy', 'programmes'];
  var C = {
    configured: !!(global.SRS_FIREBASE_CONFIG && global.SRS_FIREBASE_CONFIG.apiKey && global.firebase),
    user: null, orgId: null, orgName: '', role: null, status: 'starting', error: '',
    lastSynced: {}, revs: {}, unsub: [], saveTimer: null, pending: null, members: [], invites: [], audit: []
  };
  var auth = null, db = null;

  function active() { return C.configured && !!C.user && !!C.orgId; }
  function can(part) { return !!C.role && (WRITE[part] || []).indexOf(C.role) >= 0; }
  function role() { return C.role ? ROLE_NAMES[C.role] : 'none'; }
  function statusHtml() {
    return 'Signed in as ' + esc(C.user.email || C.user.uid) + ' · ' + esc(role()) + ' in ' + esc(C.orgName || 'your workspace') +
      '. Changes are shared with your team and recorded in the audit log.';
  }
  function now() { return global.firebase.firestore.FieldValue.serverTimestamp(); }
  function json(part) { return JSON.stringify(A.getParts()[part]); }

  // ---------- start-up ----------
  function init() {
    if (!C.configured) { C.status = 'local'; return; }
    try {
      global.firebase.initializeApp(global.SRS_FIREBASE_CONFIG);
      auth = global.firebase.auth();
      db = global.firebase.firestore();
    } catch (e) { C.configured = false; C.status = 'local'; C.error = 'Firebase could not start: ' + e.message; return; }
    auth.onAuthStateChanged(function (user) {
      stopListening();
      C.user = user; C.orgId = null; C.role = null; C.orgName = '';
      if (!user) { C.status = 'signed-out'; A.rerender(); return; }
      C.status = 'loading'; A.rerender();
      loadMembership().then(function () { A.rerender(); }, function (e) { C.status = 'error'; C.error = e.message; A.rerender(); });
    });
  }

  function loadMembership() {
    var uid = C.user.uid, email = (C.user.email || '').toLowerCase();
    return db.collection('users').doc(uid).get().then(function (snap) {
      var orgId = snap.exists ? snap.data().orgId : null;
      if (orgId) return enterOrg(orgId);
      if (!email) { C.status = 'no-org'; return null; }
      return db.collection('invites').doc(email).get().then(function (inv) {
        if (!inv.exists) { C.status = 'no-org'; return null; }
        var d = inv.data();
        return db.collection('orgs').doc(d.orgId).collection('members').doc(uid).set({ email: email, name: C.user.displayName || '', role: d.role, joinedAt: now() })
          .then(function () { return db.collection('users').doc(uid).set({ orgId: d.orgId, email: email }); })
          .then(function () { return db.collection('invites').doc(email).delete(); })
          .then(function () { return enterOrg(d.orgId, 'joined the workspace as ' + ROLE_NAMES[d.role]); });
      });
    });
  }

  function enterOrg(orgId, auditNote) {
    var uid = C.user.uid;
    return Promise.all([db.collection('orgs').doc(orgId).get(), db.collection('orgs').doc(orgId).collection('members').doc(uid).get()]).then(function (r) {
      if (!r[1].exists) { C.status = 'no-org'; C.error = 'Your account is no longer a member of that workspace.'; return null; }
      C.orgId = orgId; C.orgName = r[0].exists ? r[0].data().name : ''; C.role = r[1].data().role; C.status = 'ready';
      if (auditNote) writeAudit('team', auditNote);
      listen();
      return null;
    });
  }

  // ---------- live sync ----------
  function listen() {
    var ws = db.collection('orgs').doc(C.orgId).collection('workspace');
    PARTS.forEach(function (part) {
      C.unsub.push(ws.doc(part).onSnapshot(function (doc) {
        if (!doc.exists) {
          // an empty workspace part is seeded from this browser's data by someone allowed to write it
          if (can(part)) { C.lastSynced[part] = null; queueSave(0); }
          return;
        }
        var d = doc.data();
        if (d.json === C.lastSynced[part]) return;
        var parsed; try { parsed = JSON.parse(d.json); } catch (e) { return; }
        C.lastSynced[part] = d.json; C.revs[part] = d.rev || 0;
        var parts = {}; parts[part] = parsed;
        applyRemote(parts, d.updatedByEmail && d.updatedBy !== C.user.uid ? d.updatedByEmail : null);
      }, function (e) { C.error = 'Live updates stopped: ' + e.message; A.rerender(); }));
    });
    if (can('team')) refreshTeam();
  }
  function stopListening() { C.unsub.forEach(function (u) { try { u(); } catch (e) { /* ignore */ } }); C.unsub = []; C.lastSynced = {}; }

  function applyRemote(parts, who) {
    var focused = document.activeElement && document.getElementById('main') && document.getElementById('main').contains(document.activeElement) &&
      /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    A.setParts(parts);
    if (focused) {
      // do not pull an input from under the person typing; show the change when they leave the field
      C.pending = true;
      document.activeElement.addEventListener('blur', function once() { document.activeElement && document.activeElement.removeEventListener('blur', once); if (C.pending) { C.pending = null; A.rerender(); } }, { once: true });
    } else { A.rerender(); }
    if (who) A.toast('Updated by ' + who);
  }

  function onLocalChange() { queueSave(1200); }
  function queueSave(delay) {
    clearTimeout(C.saveTimer);
    C.saveTimer = setTimeout(saveNow, delay);
  }
  function saveNow() {
    if (!active()) return;
    var ws = db.collection('orgs').doc(C.orgId).collection('workspace');
    PARTS.forEach(function (part) {
      var cur = json(part);
      if (cur === C.lastSynced[part]) return;
      if (!can(part)) {
        // a change this role may not make (for example a reset) is undone from the shared copy
        if (C.lastSynced[part]) { var p = {}; p[part] = JSON.parse(C.lastSynced[part]); A.setParts(p); A.rerender(); A.toast('That change is not open to your role and was not saved'); }
        return;
      }
      var before = C.lastSynced[part];
      C.lastSynced[part] = cur;
      var rev = (C.revs[part] || 0) + 1; C.revs[part] = rev;
      ws.doc(part).set({ json: cur, rev: rev, updatedAt: now(), updatedBy: C.user.uid, updatedByEmail: C.user.email || '' })
        .then(function () { writeAudit(part, summarise(part, before, cur)); })
        .catch(function (e) { C.lastSynced[part] = before; A.toast('Not saved: ' + e.message); });
    });
  }

  function summarise(part, beforeJson, afterJson) {
    if (!beforeJson) return 'created the shared ' + part + ' from this browser’s data';
    var b = JSON.parse(beforeJson), a = JSON.parse(afterJson), out = [];
    if (part === 'register') {
      var bu = {}; (b.units || []).forEach(function (u) { bu[u.id] = u; });
      (a.units || []).forEach(function (u) {
        var o = bu[u.id];
        if (!o) { out.push('added unit ' + u.name); return; }
        var codes = {};
        Object.keys(Object.assign({}, o.values || {}, u.values || {})).forEach(function (c) { if (JSON.stringify((o.values || {})[c]) !== JSON.stringify((u.values || {})[c])) codes[c] = true; });
        var reg = ['name', 'level', 'population', 'area', 'dwellings', 'elderly_share'].filter(function (k) { return o[k] !== u[k]; });
        if (JSON.stringify(o.denominators || {}) !== JSON.stringify(u.denominators || {})) reg.push('denominators');
        if (Object.keys(codes).length || reg.length) out.push(u.name + ': ' + Object.keys(codes).concat(reg).join(', '));
        delete bu[u.id];
      });
      Object.keys(bu).forEach(function (k) { out.push('removed unit ' + bu[k].name); });
      if (JSON.stringify(b.stock || []) !== JSON.stringify(a.stock || [])) out.push('operating register (' + (a.stock || []).length + ' record' + ((a.stock || []).length === 1 ? '' : 's') + ')');
    } else if (part === 'config') {
      ['readiness'].forEach(function (k) { if (b[k] !== a[k]) out.push(k + ' ' + b[k] + ' → ' + a[k]); });
      Object.keys(Object.assign({}, b.cfg || {}, a.cfg || {})).forEach(function (k) { if (JSON.stringify((b.cfg || {})[k]) !== JSON.stringify((a.cfg || {})[k])) out.push(k.replace(/_/g, ' ')); });
      Object.keys(Object.assign({}, b.territory || {}, a.territory || {})).forEach(function (k) { if ((b.territory || {})[k] !== (a.territory || {})[k]) out.push(k.replace(/_/g, ' ') + ': ' + (a.territory || {})[k]); });
    } else {
      var bo = {}; (b.options || []).forEach(function (o) { bo[o.id] = JSON.stringify(o); });
      (a.options || []).forEach(function (o) { if (!(o.id in bo)) out.push('added option ' + o.id); else if (bo[o.id] !== JSON.stringify(o)) out.push('edited option ' + o.id); delete bo[o.id]; });
      Object.keys(bo).forEach(function (k) { out.push('deleted option ' + k); });
      if (JSON.stringify(b.customBundles || {}) !== JSON.stringify(a.customBundles || {})) out.push('saved bundles changed');
    }
    return (out.length ? out.join('; ') : 'changed ' + part).slice(0, 900);
  }
  function writeAudit(part, summary) {
    if (!C.orgId) return;
    db.collection('orgs').doc(C.orgId).collection('audit').add({ at: now(), uid: C.user.uid, email: C.user.email || '', role: C.role || '', part: part, summary: summary })
      .catch(function () { /* the change itself is saved; a failed audit write is reported on the team screen */ });
  }

  // ---------- account and team ----------
  function signInGoogle() { auth.signInWithPopup(new global.firebase.auth.GoogleAuthProvider()).catch(function (e) { A.toast(e.message); }); }
  function signInEmail(email, pw, create) {
    var p = create ? auth.createUserWithEmailAndPassword(email, pw) : auth.signInWithEmailAndPassword(email, pw);
    p.catch(function (e) { A.toast(e.message); });
  }
  function resetPassword(email) { auth.sendPasswordResetEmail(email).then(function () { A.toast('Password reset email sent'); }, function (e) { A.toast(e.message); }); }
  function signOut() { stopListening(); auth.signOut(); }
  function createOrg(name) {
    var uid = C.user.uid, email = (C.user.email || '').toLowerCase();
    var ref = db.collection('orgs').doc();
    return ref.set({ name: name, createdBy: uid, createdAt: now() })
      .then(function () { return ref.collection('members').doc(uid).set({ email: email, name: C.user.displayName || '', role: 'owner', joinedAt: now() }); })
      .then(function () { return db.collection('users').doc(uid).set({ orgId: ref.id, email: email }); })
      .then(function () { return enterOrg(ref.id, 'created the workspace ' + name); })
      .then(function () { A.rerender(); })
      .catch(function (e) { A.toast('Could not create the workspace: ' + e.message); });
  }
  function refreshTeam() {
    var org = db.collection('orgs').doc(C.orgId);
    Promise.all([
      org.collection('members').get(),
      db.collection('invites').where('orgId', '==', C.orgId).get(),
      org.collection('audit').orderBy('at', 'desc').limit(60).get()
    ]).then(function (r) {
      C.members = r[0].docs.map(function (d) { return Object.assign({ uid: d.id }, d.data()); });
      C.invites = r[1].docs.map(function (d) { return Object.assign({ email: d.id }, d.data()); });
      C.audit = r[2].docs.map(function (d) { return d.data(); });
      if (A.currentRoute() === 'account') A.rerender();
    }, function (e) { C.error = 'Team list: ' + e.message; });
  }
  function invite(email, r) {
    email = (email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { A.toast('Enter a valid email address'); return; }
    db.collection('invites').doc(email).set({ orgId: C.orgId, orgName: C.orgName, role: r, invitedBy: C.user.email || '', at: now() })
      .then(function () { writeAudit('team', 'invited ' + email + ' as ' + ROLE_NAMES[r]); A.toast('Invitation recorded: ' + email + ' joins as ' + ROLE_NAMES[r] + ' when they sign in'); refreshTeam(); })
      .catch(function (e) { A.toast(e.message); });
  }
  function setRole(uid, r) {
    db.collection('orgs').doc(C.orgId).collection('members').doc(uid).update({ role: r })
      .then(function () { writeAudit('team', 'changed a member’s role to ' + ROLE_NAMES[r]); refreshTeam(); }, function (e) { A.toast(e.message); });
  }
  function removeMember(uid, email) {
    db.collection('orgs').doc(C.orgId).collection('members').doc(uid).delete()
      .then(function () { writeAudit('team', 'removed ' + email); refreshTeam(); }, function (e) { A.toast(e.message); });
  }
  function cancelInvite(email) {
    db.collection('invites').doc(email).delete().then(function () { writeAudit('team', 'cancelled the invitation of ' + email); refreshTeam(); }, function (e) { A.toast(e.message); });
  }

  function fmtTime(t) { try { var d = t && t.toDate ? t.toDate() : null; return d ? d.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '–'; } catch (e) { return '–'; } }
  function roleSelect(attr, value, allowOwner) {
    return '<select ' + attr + '>' + Object.keys(ROLE_NAMES).filter(function (k) { return allowOwner || k !== 'owner'; }).map(function (k) { return '<option value="' + k + '"' + (k === value ? ' selected' : '') + '>' + ROLE_NAMES[k] + '</option>'; }).join('') + '</select>';
  }

  A.registerScreen('account', {
    render: function () {
      var head = '<div class="page-head"><div class="title"><span class="role">Workspace</span><h1>Account and team</h1><p class="lede">Sign in to share one territory, one option library and one configuration record with your team. Each member’s role decides what they can change, and every saved change is recorded with its author and time.</p></div></div>';
      if (!C.configured) {
        return head + (C.error ? '<div class="callout serious">' + esc(C.error) + '</div>' : '') +
          '<div class="grid c2"><div class="panel prose"><h3>This copy runs in local mode</h3><p>Edits stay in this browser. To share a territory without accounts, copy or download the territory file on the Assessment lead or Data steward screen and load it on the other side; the option library can be exported and imported on its own from the Project appraiser screen.</p></div>' +
          '<div class="panel prose"><h3>Switching on sign-in and shared storage</h3><p>Deploy the workbench on Firebase Hosting, enable Authentication (Google and email with password) and a Firestore database in the Firebase console, paste the web-app settings into <code>firebase-config.js</code>, and deploy the security rules supplied with the package. The setup guide in the deployment package lists every step.</p></div></div>';
      }
      if (C.status === 'starting' || C.status === 'loading') return head + '<div class="panel"><p class="muted">Connecting to your workspace…</p></div>';
      if (!C.user) {
        return head + '<div class="grid c2"><div class="panel"><h3>Sign in</h3><div class="row" style="margin:8px 0 14px"><button class="btn primary" id="g-in">Continue with Google</button></div>' +
          '<form id="e-form" class="form" style="grid-template-columns:1fr"><label>Email<input type="text" id="e-mail" autocomplete="username"></label><label>Password<input type="password" id="e-pw" autocomplete="current-password" style="background:var(--bg-elev);border:1px solid var(--line-2);border-radius:6px;padding:6px 9px;min-height:34px"></label><div class="row"><button class="btn primary" type="submit">Sign in</button><button class="btn" type="button" id="e-new">Create account</button><button class="btn small" type="button" id="e-reset">Forgotten password</button></div></form></div>' +
          '<div class="panel prose"><h3>Joining a team</h3><p>If an owner or assessment lead has invited your email address, sign in with that address and you join their workspace with the role they chose. Otherwise you can create a new workspace and invite your colleagues.</p></div></div>';
      }
      if (C.status === 'no-org' || C.status === 'error') {
        return head + (C.error ? '<div class="callout warn">' + esc(C.error) + '</div>' : '') + '<div class="grid c2"><div class="panel"><h3>Create a workspace</h3><p class="small muted" style="margin-bottom:8px">You become its owner. The territory, options and configuration currently in this browser become the workspace’s starting data.</p><div class="form" style="grid-template-columns:1fr"><label>Organisation name<input type="text" id="org-name" placeholder="e.g. City of Westhaven"></label></div><div class="row" style="margin-top:10px"><button class="btn primary" id="org-create">Create workspace</button></div></div>' +
          '<div class="panel prose"><h3>Signed in as ' + esc(C.user.email || '') + '</h3><p>No workspace has invited this address yet. Ask your owner or assessment lead to invite it, then sign in again.</p><div class="row" style="margin-top:10px"><button class="btn" id="sign-out">Sign out</button></div></div></div>';
      }
      var html = head + '<div class="grid two-one"><div class="stack">';
      html += '<div class="panel"><div class="panel-head"><h3>' + esc(C.orgName) + '</h3><button class="btn small" id="sign-out">Sign out</button></div><dl class="kv"><dt>Signed in as</dt><dd>' + esc(C.user.email || C.user.uid) + '</dd><dt>Your role</dt><dd>' + esc(role()) + '</dd><dt>You can change</dt><dd>' +
        (['register', 'config', 'options', 'strategy', 'programmes'].filter(can).map(function (p) { return { register: 'the register and indicator values', config: 'the configuration record', options: 'the project records and bundles', strategy: 'the city goals, value library, envelope and portfolio record', programmes: 'the programme records' }[p]; }).join('; ') || 'nothing (read-only)') + '</dd></dl></div>';
      if (can('team')) {
        html += '<div class="panel"><div class="panel-head"><h3>Members</h3><button class="btn small" id="team-refresh">Refresh</button></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Member</th><th>Role</th><th>Joined</th><th></th></tr></thead><tbody>' +
          C.members.map(function (m) {
            var editable = m.uid !== C.user.uid && (C.role === 'owner' || m.role !== 'owner');
            return '<tr><td>' + esc(m.email) + '</td><td>' + (editable ? roleSelect('data-mrole="' + m.uid + '"', m.role, C.role === 'owner') : esc(ROLE_NAMES[m.role] || m.role)) + '</td><td class="small">' + fmtTime(m.joinedAt) + '</td><td>' + (editable && C.role === 'owner' ? '<button class="btn small danger" data-mdel="' + m.uid + '" data-email="' + esc(m.email) + '">Remove</button>' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<h4 style="margin-top:14px">Invite a colleague</h4><div class="row" style="margin-top:6px"><input type="text" id="inv-email" placeholder="name@organisation.gov.au" style="min-width:240px">' + roleSelect('id="inv-role"', 'steward', false) + '<button class="btn primary" id="inv-send">Invite</button></div><p class="small muted" style="margin-top:6px">The invitation is held against the email address; the colleague joins with this role the first time they sign in with it. Send them the site address yourself.</p>' +
          (C.invites.length ? '<div class="tbl-wrap" style="margin-top:10px"><table class="tbl small"><thead><tr><th>Pending invitation</th><th>Role</th><th></th></tr></thead><tbody>' + C.invites.map(function (i) { return '<tr><td>' + esc(i.email) + '</td><td>' + esc(ROLE_NAMES[i.role]) + '</td><td><button class="btn small" data-icancel="' + esc(i.email) + '">Cancel</button></td></tr>'; }).join('') + '</tbody></table></div>' : '') + '</div>';
        html += '<div class="panel"><h3>Audit log</h3><p class="small muted" style="margin-bottom:8px">The latest 60 saved changes; entries cannot be edited or deleted.</p><div class="tbl-wrap"><table class="tbl small"><thead><tr><th>When</th><th>Who</th><th>Role</th><th>Part</th><th>Change</th></tr></thead><tbody>' +
          (C.audit.length ? C.audit.map(function (a) { return '<tr><td style="white-space:nowrap">' + fmtTime(a.at) + '</td><td>' + esc(a.email) + '</td><td>' + esc(ROLE_NAMES[a.role] || a.role) + '</td><td>' + esc(a.part) + '</td><td>' + esc(a.summary) + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="muted">No entries yet.</td></tr>') + '</tbody></table></div></div>';
      }
      html += '</div><div class="stack"><div class="panel prose"><h3>Roles</h3><dl class="kv small"><dt>Owner</dt><dd>everything, including members and roles</dd><dt>Assessment lead</dt><dd>configuration, register, options, members other than owners</dd><dt>Data steward</dt><dd>the register and indicator values</dd><dt>Project appraiser</dt><dd>the project records and saved bundles</dd><dt>Sponsor</dt><dd>the city\'s goals, fields, value library and envelope and the portfolio record (the strategy part)</dd><dt>Portfolio manager</dt><dd>the strategy part and the programme records</dd><dt>Programme manager</dt><dd>the programme records and the project records</dd><dt>Project manager</dt><dd>the project records</dd><dt>Dimension lead, viewer</dt><dd>read every screen; change nothing shared</dd></dl><p class="small muted" style="margin-top:8px">Choices that stay on your own screen, such as the unit you are looking at or the options ticked for an appraisal, are never shared.</p></div></div></div>';
      return html;
    },
    mount: function (root) {
      A.on(root, '#g-in', 'click', signInGoogle);
      A.on(root, '#e-form', 'submit', function (ev) { ev.preventDefault(); signInEmail(document.getElementById('e-mail').value.trim(), document.getElementById('e-pw').value, false); });
      A.on(root, '#e-new', 'click', function () { signInEmail(document.getElementById('e-mail').value.trim(), document.getElementById('e-pw').value, true); });
      A.on(root, '#e-reset', 'click', function () { var e = document.getElementById('e-mail').value.trim(); if (!e) { A.toast('Enter your email first'); return; } resetPassword(e); });
      A.on(root, '#sign-out', 'click', signOut);
      A.on(root, '#org-create', 'click', function () { var n = document.getElementById('org-name').value.trim(); if (!n) { A.toast('Give the workspace a name'); return; } createOrg(n); });
      A.on(root, '#team-refresh', 'click', refreshTeam);
      A.on(root, '#inv-send', 'click', function () { invite(document.getElementById('inv-email').value, document.getElementById('inv-role').value); });
      A.on(root, '[data-mrole]', 'change', function (ev, el) { setRole(el.getAttribute('data-mrole'), el.value); });
      A.on(root, '[data-mdel]', 'click', function (ev, el) {
        if (el.getAttribute('data-armed')) removeMember(el.getAttribute('data-mdel'), el.getAttribute('data-email'));
        else { el.setAttribute('data-armed', '1'); el.textContent = 'Click again to remove'; }
      });
      A.on(root, '[data-icancel]', 'click', function (ev, el) { cancelInvite(el.getAttribute('data-icancel')); });
    }
  });

  global.SRS_CLOUD = { active: active, can: can, role: role, statusHtml: statusHtml, onLocalChange: onLocalChange, state: function () { return C; } };
  init();
})(window);
