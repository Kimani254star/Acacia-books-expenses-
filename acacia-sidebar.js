/* acacia-sidebar.js - right-hand tools bar, same idea as the Acacia Books right sidebar.
   Notebook, Webinars, Team Status (team chat), Organization Details, Google Docs / Sheets / Photos / Calendar, Support. Self-contained: injects its own CSS + markup.
   Notes and saved webinars use the SAME localStorage keys as Books (acaciaNotes, acaciaWebinars), so on one domain they are shared.
   Developer-scheduled webinars are read from the acacia_webinars table (same table Books uses). */
(function () {
  'use strict';
  if (window.__acxSidebar) return; window.__acxSidebar = true;

  var NOTES = 'acaciaNotes', WEB = 'acaciaWebinars', OPEN = 'acxSidebarCollapsed';
  var LINKS = [
    { i: '📝', t: 'Google Docs', u: 'https://docs.google.com/' },
    { i: '📊', t: 'Google Sheets', u: 'https://sheets.google.com/' },
    { i: '📸', t: 'Google Photos', u: 'https://photos.google.com/' },
    { i: '📅', t: 'Google Calendar', u: 'https://calendar.google.com/' }
  ];
  var dock, panel, body, titleEl, current = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function jget(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function user() {
    try { if (typeof currentUser === 'function') { var u = currentUser(); if (u) return u; } } catch (e) {}
    try { if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) return CURRENT_USER; } catch (e) {}
    try { if (window.acxSession) { var s = window.acxSession(); if (s) return s.obj || s; } } catch (e) {}
    return null;
  }
  function companyId() { var u = user(); return u && (u.companyId || u.company_id) ? String(u.companyId || u.company_id) : ''; }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')); }

  var css =
    '#acxsbDock{position:fixed;right:0;top:28%;z-index:8990;display:none;flex-direction:column;gap:6px;background:#111827;padding:8px 6px;border-radius:12px 0 0 12px;box-shadow:-2px 4px 16px rgba(0,0,0,.28)}' +
    '#acxsbDock button,#acxsbDock a{width:36px;height:36px;border:0;border-radius:9px;background:transparent;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;text-decoration:none;transition:background .15s}' +
    '#acxsbDock button:hover,#acxsbDock a:hover,#acxsbDock button.on{background:#facc15;color:#000}' +
    '#acxsbDock .sep{height:1px;background:#374151;margin:2px 4px}' +
    '#acxsbDock.min{padding:6px 4px}#acxsbDock.min .tool{display:none}' +
    '#acxsbPanel{position:fixed;right:58px;top:14%;z-index:8991;width:340px;max-width:calc(100vw - 80px);max-height:72vh;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.28);display:none;flex-direction:column;overflow:hidden;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    '#acxsbPanel.open{display:flex}' +
    '#acxsbPanel .h{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:#111827;color:#fff}' +
    '#acxsbPanel .h b{font-size:14px}#acxsbPanel .h button{background:none;border:0;color:#fff;font-size:18px;cursor:pointer}' +
    '#acxsbBody{padding:10px 12px;overflow-y:auto;background:#f8fafc}' +
    '#acxsbBody input,#acxsbBody textarea,#acxsbBody select{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:7px 9px;font:inherit;background:#fff;color:#0f172a;margin-bottom:6px;box-sizing:border-box}' +
    '#acxsbBody .row{display:flex;gap:6px;align-items:center}' +
    '#acxsbBody .btn{border:0;background:#111827;color:#fff;border-radius:8px;padding:7px 12px;font:inherit;font-weight:600;cursor:pointer}' +
    '#acxsbBody .btn.l{background:#e2e8f0;color:#0f172a}' +
    '#acxsbBody .card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin-bottom:8px}' +
    '#acxsbBody .card.pin{border-color:#facc15;background:#fffbeb}' +
    '#acxsbBody .meta{font-size:12px;color:#64748b}' +
    '#acxsbBody a{color:#1d4ed8}' +
    '#acxsbBody .x{float:right;border:0;background:none;color:#dc2626;cursor:pointer;font-size:12px}' +
    '#acxsbBody .tm{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin-bottom:6px;cursor:pointer;font:inherit;color:#0f172a}' +
    '#acxsbBody .tm:hover{border-color:#111827}#acxsbBody .dot{width:10px;height:10px;border-radius:50%;flex:none}' +
    '#acxsbBody .av{width:30px;height:30px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex:none}' +
    '#acxsbBody .bd{margin-left:auto;background:#dc2626;color:#fff;border-radius:999px;font-size:11px;font-weight:700;padding:1px 7px}' +
    '#acxsbBody .msgs{max-height:300px;overflow-y:auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;margin-bottom:8px}' +
    '#acxsbBody .m{display:flex;margin:5px 0}#acxsbBody .m.me{justify-content:flex-end}' +
    '#acxsbBody .b{max-width:82%;padding:6px 10px;border-radius:12px;background:#f1f5f9;white-space:pre-wrap;word-wrap:break-word}' +
    '#acxsbBody .m.me .b{background:#111827;color:#fff}#acxsbBody .b small{display:block;font-size:10px;opacity:.6;margin-top:2px}' +
    '#acxsbBody .kv{margin:0 0 4px}#acxsbBody .kv b{color:#334155}' +
    '@media (max-width:700px){#acxsbDock{top:auto;bottom:70px}#acxsbPanel{right:8px;left:8px;width:auto;max-width:none}}';

  function build() {
    var st = document.createElement('style'); st.id = 'acxsbCss'; st.textContent = css; document.head.appendChild(st);
    dock = document.createElement('div'); dock.id = 'acxsbDock';
    dock.innerHTML =
      '<button type="button" data-t="min" title="Show / hide tools">⇆</button>' +
      '<button class="tool" type="button" data-t="notes" title="Acacia Notebook">📔</button>' +
      '<button class="tool" type="button" data-t="webinar" title="Webinars">🎥</button>' +
      '<button class="tool" type="button" data-t="team" title="Team Status"><span style="position:relative">🌳<i id="acxsbBadge" style="display:none;position:absolute;top:-8px;right:-10px;background:#dc2626;color:#fff;border-radius:999px;font:700 10px/1 system-ui;padding:2px 5px;font-style:normal"></i></span></button>' +
      '<button class="tool" type="button" data-t="org" title="Organization Details">🏢</button>' +
      '<div class="sep tool"></div>' +
      LINKS.map(function (l) { return '<a class="tool" href="' + l.u + '" target="_blank" rel="noopener" title="' + l.t + '">' + l.i + '</a>'; }).join('') +
      '<div class="sep tool"></div>' +
      '<button class="tool" type="button" data-t="support" title="Support">🎧</button>';
    panel = document.createElement('div'); panel.id = 'acxsbPanel';
    panel.innerHTML = '<div class="h"><b id="acxsbTitle"></b><button type="button" data-t="close" title="Close">✕</button></div><div id="acxsbBody"></div>';
    document.body.appendChild(dock); document.body.appendChild(panel);
    body = $('acxsbBody'); titleEl = $('acxsbTitle');
    if (localStorage.getItem(OPEN) === '1') dock.classList.add('min');
    dock.addEventListener('click', function (e) {
      var b = e.target.closest('[data-t]'); if (!b) return;
      var t = b.getAttribute('data-t');
      if (t === 'min') { dock.classList.toggle('min'); localStorage.setItem(OPEN, dock.classList.contains('min') ? '1' : '0'); closePanel(); }
      else if (t === 'support') { closePanel(); var f = $('acxhFab'); if (typeof window.toggleSupportPopup === 'function') window.toggleSupportPopup(); else if (f) f.click(); }
      else openTool(t);
    });
    panel.addEventListener('click', function (e) { var b = e.target.closest('[data-t="close"]'); if (b) closePanel(); });
    bgTimer = setInterval(bgTick, 30000); setTimeout(bgTick, 4000);
    setInterval(function () {
      var on = !!user();
      dock.style.display = on ? 'flex' : 'none';
      if (!on) closePanel();
    }, 1000);
  }
  function closePanel() {
    stopTeamPoll(); panel.classList.remove('open'); current = null;
    [].forEach.call(dock.querySelectorAll('button.on'), function (b) { b.classList.remove('on'); });
  }
  function openTool(t) {
    if (current === t) return closePanel();
    closePanel(); current = t; panel.classList.add('open');
    var b = dock.querySelector('[data-t="' + t + '"]'); if (b) b.classList.add('on');
    if (t === 'notes') notes(); else if (t === 'webinar') webinars(); else if (t === 'team') team(); else if (t === 'org') org();
  }

  /* ---------- Notebook ---------- */
  function loadNotes() {
    return (jget(NOTES, []) || []).map(function (e) {
      return { text: e.text || '', category: e.category || 'General', pinned: !!e.pinned, date: e.date || new Date().toLocaleString(), ts: typeof e.ts === 'number' ? e.ts : 0 };
    });
  }
  function notes() {
    titleEl.textContent = '📔 Acacia Notebook';
    var list = loadNotes().map(function (n, i) { n._i = i; return n; });
    list.sort(function (a, b) { return (b.pinned - a.pinned) || (b.ts - a.ts); });
    body.innerHTML =
      '<textarea id="acxsbNote" rows="3" placeholder="Write a note..."></textarea>' +
      '<div class="row"><select id="acxsbCat" style="flex:1"><option>General</option><option>Task</option><option>Idea</option><option>Meeting</option><option>Reminder</option></select>' +
      '<label class="meta" style="white-space:nowrap"><input id="acxsbPin" type="checkbox" style="width:auto;margin:0 4px 0 0">Pin</label>' +
      '<button class="btn" id="acxsbAdd" type="button">Add</button></div>' +
      '<div style="margin-top:10px">' + (list.length ? list.map(function (n) {
        return '<div class="card' + (n.pinned ? ' pin' : '') + '"><button class="x" data-del="' + n._i + '" type="button">Delete</button>' +
          '<div class="meta">' + (n.pinned ? '📌 ' : '') + esc(n.category) + ' · ' + esc(n.date) + '</div><div style="white-space:pre-wrap">' + esc(n.text) + '</div></div>';
      }).join('') : '<div class="meta" style="text-align:center;padding:14px 0">No notes yet.</div>') + '</div>';
    $('acxsbAdd').onclick = function () {
      var t = $('acxsbNote').value.trim(); if (!t) return;
      var all = loadNotes();
      all.push({ text: t, category: $('acxsbCat').value, pinned: $('acxsbPin').checked, date: new Date().toLocaleString(), ts: Date.now() });
      jset(NOTES, all); notes();
    };
    [].forEach.call(body.querySelectorAll('[data-del]'), function (b) {
      b.onclick = function () {
        if (!confirm('Delete this note?')) return;
        var all = loadNotes(); all.splice(parseInt(b.getAttribute('data-del'), 10), 1); jset(NOTES, all); notes();
      };
    });
  }

  /* ---------- Webinars ---------- */
  function cloud() {
    var A = window.AcaciaCloud || {};
    return { url: window.__SUPA_URL__ || A.URL, key: window.__SUPA_KEY__ || A.KEY };
  }
  function webinars() {
    titleEl.textContent = '🎥 Webinars';
    var mine = jget(WEB, []) || [];
    body.innerHTML =
      '<div class="meta" style="margin-bottom:6px"><b>From the Acacia team</b></div><div id="acxsbDev" class="meta">Loading...</div>' +
      '<div class="meta" style="margin:12px 0 6px"><b>My saved webinars</b></div>' +
      '<input id="acxsbWt" placeholder="Title"><input id="acxsbWd" type="datetime-local"><input id="acxsbWl" placeholder="https:// join link">' +
      '<button class="btn" id="acxsbWa" type="button">Save webinar</button>' +
      '<div style="margin-top:8px">' + (mine.length ? mine.map(function (w, i) {
        return '<div class="card"><button class="x" data-wdel="' + i + '" type="button">Delete</button><b>' + esc(w.title) + '</b>' +
          '<div class="meta">' + esc(new Date(w.date).toLocaleString()) + '</div>' +
          (safeUrl(w.link) ? '<a href="' + esc(w.link) + '" target="_blank" rel="noopener">Join webinar</a>' : '') + '</div>';
      }).join('') : '<div class="meta">No webinars saved.</div>') + '</div>';
    $('acxsbWa').onclick = function () {
      var t = $('acxsbWt').value.trim(), d = $('acxsbWd').value, l = $('acxsbWl').value.trim();
      if (!t || !d || !l) return alert('Please fill in title, date and link.');
      if (!safeUrl(l)) return alert('The link must start with http:// or https://');
      var all = jget(WEB, []) || []; all.push({ title: t, date: d, link: l }); jset(WEB, all); webinars();
    };
    [].forEach.call(body.querySelectorAll('[data-wdel]'), function (b) {
      b.onclick = function () { var all = jget(WEB, []) || []; all.splice(parseInt(b.getAttribute('data-wdel'), 10), 1); jset(WEB, all); webinars(); };
    });
    var c = cloud(), box = $('acxsbDev');
    if (!c.url || !c.key) { box.textContent = 'Not connected.'; return; }
    fetch(c.url + '/rest/v1/acacia_webinars?status=in.(scheduled,completed)&order=starts_at.desc&limit=30',
      { headers: { apikey: c.key, Authorization: 'Bearer ' + c.key } })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (rows) {
        var cid = companyId().toLowerCase();
        rows = (rows || []).filter(function (r) {
          return !r.company_ids || !r.company_ids.length || r.company_ids.map(function (x) { return String(x).toLowerCase(); }).indexOf(cid) > -1;
        });
        if (!$('acxsbDev')) return;
        box.innerHTML = rows.length ? rows.map(function (w) {
          var done = w.status === 'completed' || Date.now() > new Date(w.starts_at).getTime() + (w.duration_min || 60) * 60000;
          var act = done ? (safeUrl(w.recording_url) ? '<a href="' + esc(w.recording_url) + '" target="_blank" rel="noopener">▶ Watch recording</a>' : 'Session ended')
            : (safeUrl(w.join_url) ? '<a href="' + esc(w.join_url) + '" target="_blank" rel="noopener">Join webinar</a>' : 'Join link coming soon');
          return '<div class="card"><b>' + esc(w.title) + '</b><div class="meta">' + esc(new Date(w.starts_at).toLocaleString()) + (w.host ? ' · ' + esc(w.host) : '') + '</div>' + act + '</div>';
        }).join('') : 'No webinars scheduled yet.';
      }).catch(function () { if ($('acxsbDev')) box.textContent = 'Could not load webinars.'; });
  }


  /* ---------- Team status + chat (shared Supabase tables, see acacia_team.sql) ---------- */
  var STATUS = [
    { id: 'available', label: 'Available', color: '#16a34a' }, { id: 'busy', label: 'Busy', color: '#dc2626' },
    { id: 'away', label: 'Away', color: '#d97706' }, { id: 'offline', label: 'Offline', color: '#6b7280' }
  ];
  var AVC = ['#ef4444', '#f97316', '#ca8a04', '#16a34a', '#0891b2', '#2563eb', '#7c3aed', '#db2777'];
  var teamTimer = null, bgTimer = null, peer = null, roster = [], lastN = -1;
  function me() {
    var u = user(); if (!u) return null;
    var key = String(u.email || u.username || u.user || u.login || u.login_id || '').trim().toLowerCase();
    if (!key) return null;
    return { key: key, name: String(u.name || u.fullName || u.username || key.replace(/@.*$/, '')), company: companyId() };
  }
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
  function stInfo(id) { for (var i = 0; i < STATUS.length; i++) if (STATUS[i].id === id) return STATUS[i]; return STATUS[3]; }
  function colorFor(k) { for (var a = 0, i = 0; i < k.length; i++) a = (31 * a + k.charCodeAt(i)) >>> 0; return AVC[a % AVC.length]; }
  function ini(n) { n = String(n || '?').trim(); var p = n.split(/\s+/); return (p.length > 1 ? p[0][0] + p[1][0] : n.slice(0, 2)).toUpperCase(); }
  function stopTeamPoll() { if (teamTimer) { clearInterval(teamTimer); teamTimer = null; } }
  function setBadge(n) {
    var b = $('acxsbBadge'); if (!b) return;
    b.style.display = n > 0 ? 'inline-block' : 'none'; b.textContent = n > 99 ? '99+' : String(n);
  }
  function myStatus() { return localStorage.getItem('acxsbStatus') || 'available'; }
  function pushStatus(st) {
    var m = me(); if (!m) return Promise.resolve();
    return rpc('acx_team_set_status', { p_company: m.company, p_user: m.key, p_name: m.name, p_status: st || myStatus() }).catch(function () {});
  }
  function team() {
    var m = me();
    titleEl.textContent = '🌳 Team Status';
    if (!m) { body.innerHTML = '<div class="meta">Please sign in again.</div>'; return; }
    peer = null; lastN = -1;
    var st = myStatus();
    pushStatus(st);
    body.innerHTML =
      '<div class="row" style="margin-bottom:8px"><div class="av" style="background:' + colorFor(m.key) + '">' + esc(ini(m.name)) + '</div>' +
      '<div style="flex:1;min-width:0"><b>' + esc(m.name) + '</b><div class="meta">You</div></div>' +
      '<select id="acxsbSt" style="width:auto;margin:0">' + STATUS.map(function (s) { return '<option value="' + s.id + '"' + (s.id === st ? ' selected' : '') + '>' + s.label + '</option>'; }).join('') + '</select></div>' +
      '<input id="acxsbTs" type="search" placeholder="Search teammates..." autocomplete="off"><div id="acxsbTl" class="meta">Loading...</div>';
    $('acxsbSt').onchange = function () { localStorage.setItem('acxsbStatus', this.value); pushStatus(this.value).then(loadRoster); };
    $('acxsbTs').oninput = drawRoster;
    loadRoster(); stopTeamPoll(); teamTimer = setInterval(loadRoster, 6000);
  }
  function loadRoster() {
    var m = me(); if (!m || peer) return;
    Promise.all([
      rpc('acx_team_roster', { p_company: m.company }),
      rpc('acx_team_unread', { p_company: m.company, p_me: m.key })
    ]).then(function (r) {
      var un = {}; (r[1] || []).forEach(function (x) { un[x.from_key] = x.n; });
      roster = (r[0] || []).filter(function (x) { return x.user_key !== m.key; }).map(function (x) { x.unread = un[x.user_key] || 0; return x; });
      drawRoster();
    }).catch(function (e) {
      var l = $('acxsbTl'); if (l) l.innerHTML = 'Could not load your team.<br><small>' + esc(e.message) + '</small><br>Ask the developer to run <b>acacia_team.sql</b> in Supabase.';
    });
  }
  function drawRoster() {
    var l = $('acxsbTl'); if (!l || peer) return;
    var q = ($('acxsbTs') && $('acxsbTs').value || '').toLowerCase().trim();
    var rows = roster.filter(function (x) { return !q || String(x.name || x.user_key).toLowerCase().indexOf(q) > -1; });
    rows.sort(function (a, b) { return (b.unread - a.unread) || (a.status === 'offline') - (b.status === 'offline') || String(a.name || a.user_key).localeCompare(String(b.name || b.user_key)); });
    l.className = '';
    l.innerHTML = rows.length ? rows.map(function (x) {
      var s = stInfo(x.status), nm = x.name || x.user_key;
      return '<button type="button" class="tm" data-k="' + esc(x.user_key) + '"><div class="av" style="background:' + colorFor(x.user_key) + '">' + esc(ini(nm)) + '</div>' +
        '<div style="min-width:0"><b>' + esc(nm) + '</b><div class="meta"><span class="dot" style="display:inline-block;background:' + s.color + '"></span> ' + s.label + '</div></div>' +
        (x.unread ? '<span class="bd">' + x.unread + '</span>' : '') + '</button>';
    }).join('') : '<div class="meta" style="text-align:center;padding:14px 0">No teammates found yet. People appear here after they sign in to any Acacia app.</div>';
    [].forEach.call(l.querySelectorAll('[data-k]'), function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-k');
        openConv(roster.filter(function (x) { return x.user_key === k; })[0]);
      };
    });
  }
  function openConv(p) {
    var m = me(); if (!m || !p) return;
    peer = p; lastN = -1; stopTeamPoll();
    var s = stInfo(p.status), nm = p.name || p.user_key;
    titleEl.textContent = '💬 ' + nm;
    body.innerHTML =
      '<div class="row" style="margin-bottom:8px"><button class="btn l" id="acxsbBk" type="button">←</button>' +
      '<div class="av" style="background:' + colorFor(p.user_key) + '">' + esc(ini(nm)) + '</div>' +
      '<div><b>' + esc(nm) + '</b><div class="meta"><span class="dot" style="display:inline-block;background:' + s.color + '"></span> ' + s.label + '</div></div></div>' +
      '<div class="msgs" id="acxsbMs"><div class="meta">Loading...</div></div>' +
      '<div class="row"><input id="acxsbMi" placeholder="Type a message..." autocomplete="off" style="margin:0"><button class="btn" id="acxsbMsend" type="button">Send</button></div>' +
      '<div class="meta" id="acxsbMe" style="color:#dc2626"></div>';
    $('acxsbBk').onclick = function () { stopTeamPoll(); team(); };
    var go = function () {
      var t = ($('acxsbMi').value || '').trim(); if (!t) return;
      $('acxsbMsend').disabled = true;
      rpc('acx_team_send', { p_company: m.company, p_from: m.key, p_from_name: m.name, p_to: p.user_key, p_body: t }).then(function () {
        $('acxsbMi').value = ''; $('acxsbMsend').disabled = false; $('acxsbMe').textContent = ''; pullThread();
      }).catch(function (e) { $('acxsbMsend').disabled = false; $('acxsbMe').textContent = 'Could not send: ' + e.message; });
    };
    $('acxsbMsend').onclick = go;
    $('acxsbMi').onkeydown = function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    pullThread(); teamTimer = setInterval(pullThread, 4000);
    setTimeout(function () { var i = $('acxsbMi'); if (i) i.focus(); }, 50);
  }
  function pullThread() {
    var m = me(); if (!m || !peer) return;
    rpc('acx_team_thread', { p_company: m.company, p_me: m.key, p_peer: peer.user_key }).then(function (rows) {
      rows = rows || []; var box = $('acxsbMs'); if (!box || rows.length === lastN) return;
      lastN = rows.length;
      box.innerHTML = rows.length ? rows.map(function (x) {
        var mine = x.from_key === m.key;
        return '<div class="m ' + (mine ? 'me' : '') + '"><div class="b">' + esc(x.body) + '<small>' + esc(new Date(x.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })) + '</small></div></div>';
      }).join('') : '<div class="meta" style="text-align:center">Say hello 👋</div>';
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

  /* ---------- Organization details (read from the Books organization profile) ---------- */
  function org() {
    titleEl.textContent = '🏢 Organization Details';
    var m = me(), cid = companyId();
    body.innerHTML = '<div class="meta">Loading...</div>';
    var u = user() || {}, fallbackName = u.companyName || u.company || '';
    rpc('acx_books_read', { p_company: cid, p_keys: ['orgInfo', 'orgInfo_' + cid] }).then(function (rows) {
      var info = null;
      (rows || []).sort(function (a, b) { return new Date(b.updated_at) - new Date(a.updated_at); }).some(function (r) {
        try { var v = r.value; if (typeof v === 'string') v = JSON.parse(v); if (typeof v === 'string') v = JSON.parse(v); if (v && typeof v === 'object') { info = v; return true; } } catch (e) {}
        return false;
      });
      if (!$('acxsbBody') || current !== 'org') return;
      if (!info) {
        body.innerHTML = '<div class="kv"><b>Company:</b> ' + esc(fallbackName || cid) + '</div><div class="kv"><b>Company ID:</b> ' + esc(cid) + '</div>' +
          '<div class="meta" style="margin-top:8px">No organization profile found yet. Fill it in under Organization Profile in Acacia Books.</div>';
        return;
      }
      var F = [['Company Name', 'name'], ['PIN/Tax ID', 'pin'], ['Industry', 'industry'], ['Location', 'location'], ['Address', 'address'], ['Phone', 'phone'], ['Email', 'email'],
        ['Currency', 'currency'], ['Base Currency', 'baseCurrency'], ['Fiscal Year', 'fiscalYear'], ['Report Basis', 'reportBasis'], ['Language', 'language'], ['Time Zone', 'timeZone'],
        ['Date Format', 'dateFormat'], ['Primary Contact', 'primaryContact'], ['Primary Email', 'primaryContactEmail'], ['Company ID', 'companyId']];
      var h = (info.logo && /^data:image\//i.test(String(info.logo)) || safeUrl(info.logo)) ? '<div style="text-align:center;margin-bottom:8px"><img src="' + esc(info.logo) + '" alt="Logo" style="width:72px;height:72px;object-fit:contain;border:1px solid #e2e8f0;border-radius:8px;background:#fff"></div>' : '';
      F.forEach(function (f) { if (info[f[1]]) h += '<div class="kv"><b>' + f[0] + ':</b> ' + esc(info[f[1]]) + '</div>'; });
      if (Array.isArray(info.additionalFields) && info.additionalFields.length) {
        h += '<hr style="margin:8px 0"><div class="meta"><b>Additional Information</b></div>';
        info.additionalFields.forEach(function (f) { h += '<div class="kv"><b>' + esc(f.label) + ':</b> ' + esc(f.value) + '</div>'; });
      }
      body.innerHTML = h || '<div class="meta">Organization profile is empty.</div>';
    }).catch(function (e) {
      if (current !== 'org') return;
      body.innerHTML = '<div class="kv"><b>Company:</b> ' + esc(fallbackName || cid) + '</div><div class="kv"><b>Company ID:</b> ' + esc(cid) + '</div>' +
        '<div class="meta" style="margin-top:8px">Could not load the organization profile (' + esc(e.message) + '). Ask the developer to run the latest SQL.</div>';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
