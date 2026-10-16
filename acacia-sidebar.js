/* acacia-sidebar.js - right-hand tools bar, styled exactly like the Acacia Inventory right sidebar.
   Buttons (same order as Inventory): Notebook, Webinars, Team Status (chat), Support, Organization Details | Docs, Sheets, Photos, Calendar.
   Self-contained (own CSS + markup). Notes / saved webinars use the same localStorage keys as Books (acaciaNotes, acaciaWebinars).
   Team chat uses the acx_team_* functions (sql/acacia_team.sql); Organization Details reads the Books profile via acx_books_read. */
(function () {
  'use strict';
  if (window.__acxSidebar) return; window.__acxSidebar = true;

  var NOTES = 'acaciaNotes', WEB = 'acaciaWebinars';
  var bar, panel, head, titleEl, body, current = null, noteCat = 'Work';
  var teamTimer = null, peer = null, roster = [], lastN = -1;

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function jget(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')); }
  function user() {
    try { if (typeof currentUser === 'function') { var u = currentUser(); if (u) return u; } } catch (e) {}
    try { if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) return CURRENT_USER; } catch (e) {}
    try { if (window.acxSession) { var s = window.acxSession(); if (s) return s.obj || s; } } catch (e) {}
    return null;
  }
  function companyId() { var u = user(); return u && (u.companyId || u.company_id) ? String(u.companyId || u.company_id) : ''; }
  function cloud() { var A = window.AcaciaCloud || {}; return { url: window.__SUPA_URL__ || A.URL, key: window.__SUPA_KEY__ || A.KEY }; }
  function rpc(fn, args) {
    var c = cloud();
    if (!c.url || !c.key) return Promise.reject(new Error('Not connected'));
    return fetch(c.url + '/rest/v1/rpc/' + fn, {
      method: 'POST', headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' }, body: JSON.stringify(args)
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) throw new Error((j && (j.message || j.hint)) || ('Request failed (' + r.status + ')'));
        return j;
      });
    });
  }

  /* ---------- look (mirrors the Inventory sidebar + panels) ---------- */
  var css =
    '#acxsbBar{position:fixed;right:0;top:0;bottom:0;width:48px;z-index:8990;display:none;flex-direction:column;align-items:center;gap:16px;padding:8px;overflow-y:auto;background:#fff;border-left:1px solid #e2e8f0;box-sizing:border-box}' +
    '#acxsbBar button{width:32px;height:32px;flex:none;display:flex;align-items:center;justify-content:center;border:0;background:transparent;border-radius:8px;font-size:16px;line-height:1;cursor:pointer;transition:background .15s;padding:0}' +
    '#acxsbBar button:hover,#acxsbBar button.on{background:#f1f5f9}' +
    '#acxsbBar .sep{width:24px;height:1px;background:#e2e8f0;margin:4px 0;flex:none}' +
    'body.acxsb-on .acxsb-pad{margin-right:48px!important}' +
    'body.acxsb-on #acxhFab{right:64px!important}body.acxsb-on #acxhPop{right:64px!important}body.acxsb-on #acxsRoot{right:64px!important}' +
    '#acxsbPanel{position:fixed;top:5rem;right:4rem;width:20rem;max-width:calc(100vw - 80px);max-height:calc(100vh - 7rem);z-index:8991;display:none;flex-direction:column;overflow:hidden;background:#fff;color:#0f172a;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 25px 50px -12px rgba(0,0,0,.25);font-size:12px;line-height:1.4;font-family:inherit}' +
    '#acxsbPanel.open{display:flex}#acxsbPanel *{box-sizing:border-box;font-family:inherit}#acxsbPanel button,#acxsbPanel input,#acxsbPanel select{font-family:inherit}' +
    '#acxsbHead{padding:12px;color:#fff;font-weight:700;display:flex;justify-content:space-between;align-items:center;flex:none}' +
    '#acxsbHead button{background:none;border:0;color:#fff;font-weight:700;font-size:14px;cursor:pointer;opacity:.9}#acxsbHead button:hover{opacity:1}' +
    '#acxsbBody{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}' +
    '.sb-top{padding:8px;background:#f8fafc;border-bottom:1px solid #e5e7eb;flex:none}' +
    '.sb-list{flex:1;overflow-y:auto;padding:12px;background:rgba(248,250,252,.6);min-height:120px}' +
    '.sb-foot{padding:8px;background:#fff;border-top:1px solid #f3f4f6;display:flex;gap:4px;flex:none}' +
    '#acxsbPanel input,#acxsbPanel textarea,#acxsbPanel select{height:32px;padding:0 8px;border:1px solid #d1d5db;border-radius:6px;outline:none;font:inherit;background:#fff;color:#0f172a;width:100%}' +
    '#acxsbPanel input:focus,#acxsbPanel select:focus{border-color:#64748b}' +
    '.sb-btn{height:32px;padding:0 12px;border:0;border-radius:6px;color:#fff;font-weight:700;font-size:12px;cursor:pointer;white-space:nowrap}' +
    '.sb-btn.o{background:#fff;color:#6b7280;border:1px solid #e5e7eb;font-weight:500;padding:0 8px}.sb-btn.o:hover{background:#f9fafb}' +
    '.sb-chip{padding:4px 8px;border:0;border-radius:6px;font-weight:500;font-size:12px;cursor:pointer}' +
    '.sb-chip.sel{outline:2px solid currentColor}' +
    '.sb-card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:8px;margin-bottom:8px}' +
    '.sb-meta{color:#6b7280;font-size:11px}' +
    '.sb-x{float:right;border:0;background:none;color:#9ca3af;cursor:pointer;font-size:12px}.sb-x:hover{color:#dc2626}' +
    '.sb-empty{text-align:center;color:#94a3b8;padding:16px 0}' +
    '.sb-tm{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:6px 8px;margin-bottom:6px;cursor:pointer;font:inherit;color:#0f172a}.sb-tm:hover{border-color:#94a3b8}' +
    '.sb-dot{display:inline-block;width:8px;height:8px;border-radius:50%;flex:none}' +
    '.sb-av{width:28px;height:28px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;flex:none}' +
    '.sb-bd{margin-left:auto;background:#dc2626;color:#fff;border-radius:999px;font-size:10px;font-weight:700;padding:1px 6px}' +
    '.sb-msg{display:flex;margin:4px 0}.sb-msg.me{justify-content:flex-end}' +
    '.sb-b{max-width:84%;padding:6px 10px;border-radius:12px;background:#f1f5f9;white-space:pre-wrap;word-wrap:break-word}.sb-msg.me .sb-b{background:#1d4ed8;color:#fff}' +
    '.sb-b small{display:block;font-size:10px;opacity:.65;margin-top:2px}' +
    '.sb-kv{margin:0 0 4px}.sb-kv b{color:#334155}' +
    '#acxsbBadge{display:none;position:absolute;top:-4px;right:-6px;background:#dc2626;color:#fff;border-radius:999px;font-weight:700;font-size:9px;line-height:1;padding:2px 4px}' +
    '@media (max-width:700px){#acxsbPanel{right:8px;left:8px;width:auto;max-width:none}}';

  var TOOLS = [
    ['notes', '📔', 'Acacia Notebook'], ['webinar', '🎥', 'Webinars'], ['team', '💬', 'Team Status'], ['support', '🎧', 'Support Hub'], ['org', '🏢', 'Organization Details'],
    ['-'],
    ['gdocs', '📄', 'Google Docs', 'https://docs.google.com/'], ['gsheets', '📊', 'Google Sheets', 'https://sheets.google.com/'],
    ['gphotos', '🖼️', 'Google Photos', 'https://photos.google.com/'], ['gcal', '📅', 'Google Calendar', 'https://calendar.google.com/']
  ];
  var COLORS = { notes: '#9333ea', webinar: '#e11d48', team: '#1d4ed8', org: '#047857' };

  function build() {
    var st = document.createElement('style'); st.id = 'acxsbCss'; st.textContent = css; document.head.appendChild(st);
    bar = document.createElement('aside'); bar.id = 'acxsbBar';
    bar.innerHTML = TOOLS.map(function (t) {
      if (t[0] === '-') return '<div class="sep"></div>';
      var badge = t[0] === 'team' ? '<i id="acxsbBadge" style="font-style:normal"></i>' : '';
      return '<button type="button" data-t="' + t[0] + '" title="' + t[2] + '" style="position:relative">' + t[1] + badge + '</button>';
    }).join('');
    panel = document.createElement('div'); panel.id = 'acxsbPanel';
    panel.innerHTML = '<div id="acxsbHead"><span id="acxsbTitle"></span><button type="button" data-c="1">✕</button></div><div id="acxsbBody"></div>';
    document.body.appendChild(bar); document.body.appendChild(panel);
    head = $('acxsbHead'); titleEl = $('acxsbTitle'); body = $('acxsbBody');
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]'); if (!b) return;
      var t = b.getAttribute('data-t');
      if (t === 'support') { closePanel(); var f = $('acxhFab'); if (typeof window.toggleSupportPopup === 'function') window.toggleSupportPopup(); else if (f) f.click(); return; }
      for (var i = 0; i < TOOLS.length; i++) if (TOOLS[i][0] === t && TOOLS[i][3]) { closePanel(); window.open(TOOLS[i][3], '_blank', 'noopener'); return; }
      openTool(t);
    });
    panel.addEventListener('click', function (e) { if (e.target.closest('[data-c]')) closePanel(); });
    setInterval(tick, 1000); setInterval(bgTick, 30000); setTimeout(bgTick, 4000);
  }
  var padded = [];
  function appTopbar() {
    var el = document.querySelector('#topbar, .topbar');
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return (r.height > 0 && r.width > 0) ? el : null;
  }
  function unpad() { padded.forEach(function (n) { n.classList.remove('acxsb-pad'); }); padded = []; }
  function tick() {
    var on = !!user();
    bar.style.display = on ? 'flex' : 'none';
    document.body.classList.toggle('acxsb-on', on);
    if (!on) { unpad(); closePanel(); return; }
    var tb = appTopbar(), t = 0;
    if (tb) {
      t = Math.max(0, Math.round(tb.getBoundingClientRect().bottom));
      var P = tb.parentNode;
      if (P && (padded.length === 0 || padded[0].parentNode !== P || padded.length !== P.children.length - 1 - (bar.parentNode === P ? 1 : 0) - (panel.parentNode === P ? 1 : 0))) {
        unpad();
        [].forEach.call(P.children, function (c) {
          if (c === tb || c === bar || c === panel || c.tagName === 'SCRIPT' || c.tagName === 'STYLE') return;
          c.classList.add('acxsb-pad'); padded.push(c);
        });
      }
    }
    bar.style.top = t + 'px';
    panel.style.top = Math.max(80, t + 12) + 'px';
  }
  function stopTeamPoll() { if (teamTimer) { clearInterval(teamTimer); teamTimer = null; } }
  function closePanel() {
    stopTeamPoll(); panel.classList.remove('open'); current = null;
    [].forEach.call(bar.querySelectorAll('button.on'), function (b) { b.classList.remove('on'); });
  }
  function openTool(t) {
    if (current === t) return closePanel();
    closePanel(); current = t; panel.classList.add('open');
    head.style.background = COLORS[t] || '#334155';
    var b = bar.querySelector('[data-t="' + t + '"]'); if (b) b.classList.add('on');
    if (t === 'notes') notes(); else if (t === 'webinar') webinars(); else if (t === 'team') team(); else if (t === 'org') org();
  }

  /* ---------- Notebook ---------- */
  var CATS = { Work: ['#f3e8ff', '#7e22ce'], Personal: ['#dbeafe', '#1d4ed8'], Ideas: ['#fef3c7', '#b45309'] };
  function loadNotes() {
    return (jget(NOTES, []) || []).map(function (e) {
      return { text: e.text || '', category: e.category || 'Work', pinned: !!e.pinned, date: e.date || new Date().toLocaleString(), ts: typeof e.ts === 'number' ? e.ts : 0 };
    });
  }
  function notes() {
    titleEl.textContent = '📔 Acacia Notebook';
    body.innerHTML =
      '<div class="sb-top" style="display:flex;gap:4px">' + Object.keys(CATS).map(function (c) {
        return '<button type="button" class="sb-chip' + (c === noteCat ? ' sel' : '') + '" data-cat="' + c + '" style="background:' + CATS[c][0] + ';color:' + CATS[c][1] + '">' + c + '</button>';
      }).join('') + '</div>' +
      '<div class="sb-list" id="acxsbNl"></div>' +
      '<div class="sb-foot"><input id="acxsbNt" type="text" placeholder="Write a note..." style="flex:1"><button class="sb-btn" id="acxsbNs" type="button" style="background:#9333ea">Save</button><button class="sb-btn o" id="acxsbNc" type="button">Clear</button></div>';
    [].forEach.call(body.querySelectorAll('[data-cat]'), function (b) { b.onclick = function () { noteCat = b.getAttribute('data-cat'); notes(); }; });
    var all = loadNotes().map(function (n, i) { n._i = i; return n; }).sort(function (a, b) { return (b.pinned - a.pinned) || (b.ts - a.ts); });
    $('acxsbNl').innerHTML = all.length ? all.map(function (n) {
      var c = CATS[n.category] || CATS.Work;
      return '<div class="sb-card"><button class="sb-x" data-del="' + n._i + '" type="button" title="Delete">✕</button>' +
        '<span class="sb-meta"><span style="background:' + c[0] + ';color:' + c[1] + ';border-radius:4px;padding:1px 6px;font-weight:600">' + esc(n.category) + '</span> ' + esc(n.date) + '</span>' +
        '<div style="white-space:pre-wrap;margin-top:4px">' + esc(n.text) + '</div></div>';
    }).join('') : '<div class="sb-empty">No notes yet.</div>';
    var save = function () {
      var t = $('acxsbNt').value.trim(); if (!t) return;
      var a = loadNotes(); a.push({ text: t, category: noteCat, pinned: false, date: new Date().toLocaleString(), ts: Date.now() }); jset(NOTES, a); notes();
    };
    $('acxsbNs').onclick = save; $('acxsbNt').onkeydown = function (e) { if (e.key === 'Enter') save(); };
    $('acxsbNc').onclick = function () { if (confirm('Clear all notes?')) { jset(NOTES, []); notes(); } };
    [].forEach.call(body.querySelectorAll('[data-del]'), function (b) {
      b.onclick = function () { var a = loadNotes(); a.splice(parseInt(b.getAttribute('data-del'), 10), 1); jset(NOTES, a); notes(); };
    });
  }

  /* ---------- Webinars ---------- */
  function webinars() {
    titleEl.textContent = '🎥 Webinar Scheduler';
    body.innerHTML =
      '<div class="sb-top"><input id="acxsbWt" type="text" placeholder="Webinar Session Title" style="margin-bottom:6px">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px"><input id="acxsbWd" type="datetime-local"><input id="acxsbWl" type="text" placeholder="Meeting URL Link"></div>' +
      '<div style="display:flex;gap:6px"><button class="sb-btn" id="acxsbWa" type="button" style="flex:1;background:#e11d48">Add Session</button><button class="sb-btn o" id="acxsbWc" type="button">Clear</button></div></div>' +
      '<div class="sb-list" id="acxsbWl2"></div>';
    var devRows = null;
    var paint = function (dev) {
      var mine = jget(WEB, []) || [], h = '';
      if (dev && dev.length) {
        h += '<div class="sb-meta" style="margin-bottom:6px"><b>From the Acacia team</b></div>' + dev.map(function (w) {
          var done = w.status === 'completed' || Date.now() > new Date(w.starts_at).getTime() + (w.duration_min || 60) * 60000;
          var act = done ? (safeUrl(w.recording_url) ? '<a href="' + esc(w.recording_url) + '" target="_blank" rel="noopener" style="color:#1d4ed8">▶ Watch recording</a>' : '<span class="sb-meta">Session ended</span>')
            : (safeUrl(w.join_url) ? '<a href="' + esc(w.join_url) + '" target="_blank" rel="noopener" style="color:#1d4ed8">Join webinar</a>' : '<span class="sb-meta">Join link coming soon</span>');
          return '<div class="sb-card"><b>' + esc(w.title) + '</b><div class="sb-meta">' + esc(new Date(w.starts_at).toLocaleString()) + (w.host ? ' · ' + esc(w.host) : '') + '</div>' + act + '</div>';
        }).join('');
      }
      h += '<div class="sb-meta" style="margin:' + (h ? '10px' : '0') + ' 0 6px"><b>My sessions</b></div>' + (mine.length ? mine.map(function (w, i) {
        return '<div class="sb-card"><button class="sb-x" data-wd="' + i + '" type="button">✕</button><b>' + esc(w.title) + '</b><div class="sb-meta">' + esc(new Date(w.date).toLocaleString()) + '</div>' +
          (safeUrl(w.link) ? '<a href="' + esc(w.link) + '" target="_blank" rel="noopener" style="color:#1d4ed8">Join webinar</a>' : '') + '</div>';
      }).join('') : '<div class="sb-empty">No sessions scheduled.</div>');
      var box = $('acxsbWl2'); if (!box) return; box.innerHTML = h;
      [].forEach.call(box.querySelectorAll('[data-wd]'), function (b) {
        b.onclick = function () { var a = jget(WEB, []) || []; a.splice(parseInt(b.getAttribute('data-wd'), 10), 1); jset(WEB, a); paint(devRows); };
      });
    };
    paint(null);
    $('acxsbWa').onclick = function () {
      var t = $('acxsbWt').value.trim(), d = $('acxsbWd').value, l = $('acxsbWl').value.trim();
      if (!t || !d || !l) return alert('Please fill in title, date and link.');
      if (!safeUrl(l)) return alert('The link must start with http:// or https://');
      var a = jget(WEB, []) || []; a.push({ title: t, date: d, link: l }); jset(WEB, a);
      $('acxsbWt').value = ''; $('acxsbWd').value = ''; $('acxsbWl').value = ''; paint(devRows);
    };
    $('acxsbWc').onclick = function () { if (confirm('Clear all your sessions?')) { jset(WEB, []); paint(devRows); } };
    var c = cloud(); if (!c.url || !c.key) return;
    fetch(c.url + '/rest/v1/acacia_webinars?status=in.(scheduled,completed)&order=starts_at.desc&limit=30', { headers: { apikey: c.key, Authorization: 'Bearer ' + c.key } })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (rows) {
        var cid = companyId().toLowerCase();
        devRows = (rows || []).filter(function (r) { return !r.company_ids || !r.company_ids.length || r.company_ids.map(function (x) { return String(x).toLowerCase(); }).indexOf(cid) > -1; });
        if (current === 'webinar') paint(devRows);
      }).catch(function () {});
  }

  /* ---------- Team Status + chat ---------- */
  var STATUS = [
    { id: 'available', label: 'Available', color: '#16a34a' }, { id: 'busy', label: 'Busy', color: '#dc2626' },
    { id: 'away', label: 'Away', color: '#d97706' }, { id: 'offline', label: 'Offline', color: '#6b7280' }
  ];
  var AVC = ['#ef4444', '#f97316', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777'];
  function me() {
    var u = user(); if (!u) return null;
    var key = String(u.email || u.username || u.user || u.login || u.login_id || '').trim().toLowerCase();
    if (!key) return null;
    return { key: key, name: String(u.name || u.fullName || u.username || key.replace(/@.*$/, '')), company: companyId() };
  }
  function stInfo(id) { for (var i = 0; i < STATUS.length; i++) if (STATUS[i].id === id) return STATUS[i]; return STATUS[3]; }
  function colorFor(k) { for (var a = 0, i = 0; i < k.length; i++) a = (31 * a + k.charCodeAt(i)) >>> 0; return AVC[a % AVC.length]; }
  function ini(n) { n = String(n || '?').trim(); var p = n.split(/\s+/); return (p.length > 1 ? p[0][0] + p[1][0] : n.slice(0, 2)).toUpperCase(); }
  function setBadge(n) { var b = $('acxsbBadge'); if (!b) return; b.style.display = n > 0 ? 'inline-block' : 'none'; b.textContent = n > 99 ? '99+' : String(n); }
  function myStatus() { return localStorage.getItem('acxsbStatus') || 'available'; }
  function pushStatus(st) {
    var m = me(); if (!m) return Promise.resolve();
    return rpc('acx_team_set_status', { p_company: m.company, p_user: m.key, p_name: m.name, p_status: st || myStatus() }).catch(function () {});
  }
  function team() {
    var m = me();
    titleEl.textContent = '💬 Team Status';
    if (!m) { body.innerHTML = '<div class="sb-list sb-empty">Please sign in again.</div>'; return; }
    peer = null; lastN = -1;
    var st = myStatus(); pushStatus(st);
    body.innerHTML =
      '<div class="sb-top"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div class="sb-av" style="background:' + colorFor(m.key) + '">' + esc(ini(m.name)) + '</div>' +
      '<div style="flex:1;min-width:0"><b>' + esc(m.name) + '</b><div class="sb-meta">You</div></div>' +
      '<select id="acxsbSt" style="width:auto">' + STATUS.map(function (s) { return '<option value="' + s.id + '"' + (s.id === st ? ' selected' : '') + '>' + s.label + '</option>'; }).join('') + '</select></div>' +
      '<input id="acxsbTs" type="search" placeholder="Search teammates..." autocomplete="off"></div>' +
      '<div class="sb-list" id="acxsbTl"><div class="sb-meta">Loading...</div></div>';
    $('acxsbSt').onchange = function () { localStorage.setItem('acxsbStatus', this.value); pushStatus(this.value).then(loadRoster); };
    $('acxsbTs').oninput = drawRoster;
    loadRoster(); stopTeamPoll(); teamTimer = setInterval(loadRoster, 6000);
  }
  function loadRoster() {
    var m = me(); if (!m || peer) return;
    Promise.all([rpc('acx_team_roster', { p_company: m.company }), rpc('acx_team_unread', { p_company: m.company, p_me: m.key })]).then(function (r) {
      var un = {}; (r[1] || []).forEach(function (x) { un[x.from_key] = x.n; });
      roster = (r[0] || []).filter(function (x) { return x.user_key !== m.key; }).map(function (x) { x.unread = un[x.user_key] || 0; return x; });
      drawRoster();
    }).catch(function (e) {
      var l = $('acxsbTl'); if (l && !peer) l.innerHTML = '<div class="sb-meta">Could not load your team.<br>' + esc(e.message) + '<br>Ask the developer to run <b>acacia_team.sql</b> in Supabase.</div>';
    });
  }
  function drawRoster() {
    var l = $('acxsbTl'); if (!l || peer) return;
    var q = ($('acxsbTs') && $('acxsbTs').value || '').toLowerCase().trim();
    var rows = roster.filter(function (x) { return !q || String(x.name || x.user_key).toLowerCase().indexOf(q) > -1; });
    rows.sort(function (a, b) { return (b.unread - a.unread) || ((a.status === 'offline') - (b.status === 'offline')) || String(a.name || a.user_key).localeCompare(String(b.name || b.user_key)); });
    l.innerHTML = rows.length ? rows.map(function (x) {
      var s = stInfo(x.status), nm = x.name || x.user_key;
      return '<button type="button" class="sb-tm" data-k="' + esc(x.user_key) + '"><div class="sb-av" style="background:' + colorFor(x.user_key) + '">' + esc(ini(nm)) + '</div>' +
        '<div style="min-width:0"><b>' + esc(nm) + '</b><div class="sb-meta"><span class="sb-dot" style="background:' + s.color + '"></span> ' + s.label + '</div></div>' +
        (x.unread ? '<span class="sb-bd">' + x.unread + '</span>' : '') + '</button>';
    }).join('') : '<div class="sb-empty">No teammates yet. People appear here after they sign in to any Acacia app.</div>';
    [].forEach.call(l.querySelectorAll('[data-k]'), function (b) {
      b.onclick = function () { var k = b.getAttribute('data-k'); openConv(roster.filter(function (x) { return x.user_key === k; })[0]); };
    });
  }
  function openConv(p) {
    var m = me(); if (!m || !p) return;
    peer = p; lastN = -1; stopTeamPoll();
    var s = stInfo(p.status), nm = p.name || p.user_key;
    titleEl.textContent = '💬 ' + nm;
    body.innerHTML =
      '<div class="sb-top" style="display:flex;align-items:center;gap:8px"><button class="sb-btn o" id="acxsbBk" type="button">←</button><div class="sb-av" style="background:' + colorFor(p.user_key) + '">' + esc(ini(nm)) + '</div>' +
      '<div><b>' + esc(nm) + '</b><div class="sb-meta"><span class="sb-dot" style="background:' + s.color + '"></span> ' + s.label + '</div></div></div>' +
      '<div class="sb-list" id="acxsbMs" style="min-height:200px"><div class="sb-meta">Loading...</div></div>' +
      '<div class="sb-foot"><input id="acxsbMi" type="text" placeholder="Type a message..." autocomplete="off" style="flex:1"><button class="sb-btn" id="acxsbMsend" type="button" style="background:#1d4ed8">Send</button></div>' +
      '<div class="sb-meta" id="acxsbMe" style="color:#dc2626;padding:0 8px 6px"></div>';
    $('acxsbBk').onclick = function () { stopTeamPoll(); team(); };
    var send = function () {
      var t = ($('acxsbMi').value || '').trim(); if (!t) return;
      $('acxsbMsend').disabled = true;
      rpc('acx_team_send', { p_company: m.company, p_from: m.key, p_from_name: m.name, p_to: p.user_key, p_body: t }).then(function () {
        $('acxsbMi').value = ''; $('acxsbMsend').disabled = false; $('acxsbMe').textContent = ''; pullThread();
      }).catch(function (e) { $('acxsbMsend').disabled = false; $('acxsbMe').textContent = 'Could not send: ' + e.message; });
    };
    $('acxsbMsend').onclick = send;
    $('acxsbMi').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); send(); } };
    pullThread(); teamTimer = setInterval(pullThread, 4000);
    setTimeout(function () { var i = $('acxsbMi'); if (i) i.focus(); }, 50);
  }
  function pullThread() {
    var m = me(); if (!m || !peer) return;
    rpc('acx_team_thread', { p_company: m.company, p_me: m.key, p_peer: peer.user_key }).then(function (rows) {
      rows = rows || []; var box = $('acxsbMs'); if (!box || rows.length === lastN) return;
      lastN = rows.length;
      box.innerHTML = rows.length ? rows.map(function (x) {
        return '<div class="sb-msg ' + (x.from_key === m.key ? 'me' : '') + '"><div class="sb-b">' + esc(x.body) + '<small>' + esc(new Date(x.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })) + '</small></div></div>';
      }).join('') : '<div class="sb-empty">Say hello 👋</div>';
      box.scrollTop = box.scrollHeight;
      rpc('acx_team_mark_read', { p_company: m.company, p_me: m.key, p_peer: peer.user_key }).catch(function () {});
    }).catch(function () {});
  }
  function bgTick() {
    var m = me(); if (!m) return;
    pushStatus();
    rpc('acx_team_unread', { p_company: m.company, p_me: m.key }).then(function (rows) {
      setBadge((rows || []).reduce(function (a, x) { return a + (x.n || 0); }, 0));
    }).catch(function () {});
  }

  /* ---------- Organization Details (Books organization profile) ---------- */
  function org() {
    titleEl.textContent = '🏢 Organization Details';
    var cid = companyId(), u = user() || {}, fb = u.companyName || u.company || '';
    body.innerHTML = '<div class="sb-list"><div class="sb-meta">Loading...</div></div>';
    var show = function (h) { if (current === 'org') body.innerHTML = '<div class="sb-list">' + h + '</div>'; };
    rpc('acx_books_read', { p_company: cid, p_keys: ['orgInfo', 'orgInfo_' + cid] }).then(function (rows) {
      var info = null;
      (rows || []).sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at); }).some(function (r) {
        try { var v = r.value; if (typeof v === 'string') v = JSON.parse(v); if (typeof v === 'string') v = JSON.parse(v); if (v && typeof v === 'object') { info = v; return true; } } catch (e) {}
        return false;
      });
      if (!info) return show('<div class="sb-kv"><b>Company:</b> ' + esc(fb || cid) + '</div><div class="sb-kv"><b>Company ID:</b> ' + esc(cid) + '</div><div class="sb-meta" style="margin-top:8px">No organization profile found yet. Fill it in under Organization Profile in Acacia Books.</div>');
      var F = [['Company Name', 'name'], ['PIN/Tax ID', 'pin'], ['Industry', 'industry'], ['Location', 'location'], ['Address', 'address'], ['Phone', 'phone'], ['Email', 'email'],
        ['Currency', 'currency'], ['Base Currency', 'baseCurrency'], ['Fiscal Year', 'fiscalYear'], ['Report Basis', 'reportBasis'], ['Language', 'language'], ['Time Zone', 'timeZone'],
        ['Date Format', 'dateFormat'], ['Primary Contact', 'primaryContact'], ['Primary Email', 'primaryContactEmail'], ['Company ID', 'companyId']];
      var h = ((info.logo && /^data:image\//i.test(String(info.logo))) || safeUrl(info.logo)) ? '<div style="text-align:center;margin-bottom:8px"><img src="' + esc(info.logo) + '" alt="Logo" style="width:72px;height:72px;object-fit:contain;border:1px solid #e5e7eb;border-radius:8px;background:#fff"></div>' : '';
      F.forEach(function (f) { if (info[f[1]]) h += '<div class="sb-kv"><b>' + f[0] + ':</b> ' + esc(info[f[1]]) + '</div>'; });
      if (Array.isArray(info.additionalFields) && info.additionalFields.length) {
        h += '<div class="sb-meta" style="margin:8px 0 4px;border-top:1px solid #e5e7eb;padding-top:6px"><b>Additional Information</b></div>';
        info.additionalFields.forEach(function (f) { h += '<div class="sb-kv"><b>' + esc(f.label) + ':</b> ' + esc(f.value) + '</div>'; });
      }
      show(h || '<div class="sb-meta">Organization profile is empty.</div>');
    }).catch(function (e) {
      show('<div class="sb-kv"><b>Company:</b> ' + esc(fb || cid) + '</div><div class="sb-kv"><b>Company ID:</b> ' + esc(cid) + '</div><div class="sb-meta" style="margin-top:8px">Could not load the organization profile (' + esc(e.message) + '). Ask the developer to run the latest SQL.</div>');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
