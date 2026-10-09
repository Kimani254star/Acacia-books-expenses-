/* Acacia Support popup — same help options as Acacia Books: Navigate, AI Assistant, Chat, Email.
   Self-contained: injects its own styles and button, reads this app's own menu (NAV / goTo) to jump to screens. */
(function () {
  'use strict';
  if (window.__acxHelp) return; window.__acxHelp = true;
  var CFG = {
 "app": "Expenses",
 "title": "Acacia Expenses",
 "email": "developeracaciabooks@gmail.com,adminacaciabooks@gmail.com",
 "screens": [
  {
   "id": "dashboard",
   "module": "Dashboard",
   "desc": "overview of your spending.",
   "tip": "The landing view shows your key numbers.",
   "keywords": [
    "home",
    "overview",
    "kpi"
   ]
  },
  {
   "id": "expenses",
   "module": "Operational Costs",
   "desc": "record and review business expenses.",
   "tip": "Under Transactions, click Operational Costs.",
   "keywords": [
    "expense",
    "cost",
    "record expense",
    "add expense",
    "spend",
    "receipt"
   ]
  },
  {
   "id": "suppliers",
   "module": "Suppliers",
   "desc": "the people and companies you buy from.",
   "tip": "Under Purchasing, click Suppliers.",
   "keywords": [
    "supplier",
    "vendor",
    "add supplier"
   ]
  },
  {
   "id": "reports",
   "module": "Expense Reports",
   "desc": "spending reports.",
   "tip": "Under Reports, click Expense Reports.",
   "keywords": [
    "report",
    "export",
    "summary"
   ]
  },
  {
   "id": "categories",
   "module": "Categories",
   "desc": "groups for your expenses.",
   "tip": "Under Settings, click Categories.",
   "keywords": [
    "category",
    "categories",
    "group",
    "classify"
   ]
  },
  {
   "id": "connect",
   "module": "Connect",
   "desc": "connect Expenses with your other Acacia apps.",
   "tip": "Under Settings, click Connect.",
   "keywords": [
    "connect",
    "link",
    "integration",
    "books",
    "payroll"
   ]
  },
  {
   "id": "appearance",
   "module": "Appearance",
   "desc": "colours and look of the app.",
   "tip": "Under Settings, click Appearance.",
   "keywords": [
    "appearance",
    "theme",
    "colour",
    "color",
    "font",
    "dark"
   ]
  }
 ],
 "general": [
  {
   "module": "Sign in & data sync",
   "keywords": [
    "sync",
    "syncing",
    "another device",
    "other computer",
    "phone",
    "data missing",
    "lost data",
    "login",
    "sign in",
    "same email",
    "company name",
    "teammate",
    "team member"
   ],
   "answer": "☁️ <b>Sign in & data sync</b>\n\nSign in with the same <b>email and company name</b> on any computer or phone and you get the same company data.\n1. Changes are saved to the cloud a few seconds after you make them.\n2. The app also checks for your teammates' changes about every 30 seconds.\n3. If two people edit at once, both sets of changes are kept (records are merged, not replaced).\n4. If you are offline, your work is kept in this browser and syncs when you are back online."
  }
 ]
};

  /* ---------- knowledge base: one entry per screen + a few general ones ---------- */
  var KB = CFG.screens.map(function (s) {
    var m = s.module.toLowerCase();
    return {
      module: s.module, tab: s.id,
      keywords: (s.keywords || []).concat([m, 'navigate ' + m, 'open ' + m, 'where is ' + m]),
      answer: (s.icon || '📍') + ' <b>' + s.module + '</b> — ' + s.desc + '\n\nHow to get there:\n1. Open the left sidebar.\n2. Click <b>' + s.module + '</b>.\n3. ' + s.tip
    };
  }).concat(CFG.general || []);

  var history = [];
  function $(id) { return document.getElementById(id); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------- app hooks ---------- */
  function loggedIn() { try { return typeof CURRENT_USER !== 'undefined' && !!CURRENT_USER; } catch (e) { return false; } }
  function currentId() {
    try {
      if (CFG.app === 'Projects') return route.section;
      if (CFG.app === 'CRM') return currentView;
      if (CFG.app === 'Sell') return currentPage;
      if (CFG.app === 'Payroll') return ui.view;
      if (CFG.app === 'Expenses') { var a = document.querySelector('.nav-item.active[data-view]'); return a ? a.getAttribute('data-view') : null; }
    } catch (e) {}
    return null;
  }
  function currentScreen() {
    var id = currentId();
    for (var i = 0; i < CFG.screens.length; i++) if (CFG.screens[i].id === id) return CFG.screens[i];
    return null;
  }
  function go(id) {
    try {
      if (CFG.app === 'Expenses') { var n = document.querySelector('.nav-item[data-view="' + id + '"]'); if (n) n.click(); }
      else if (typeof goTo === 'function') goTo(id);
    } catch (e) { console.error(e); }
    $('acxhPop').classList.remove('open');
  }

  /* ---------- styles + markup ---------- */
  var css = '' +
    '#acxhFab{position:fixed;right:16px;bottom:16px;z-index:9000;width:44px;height:44px;border-radius:50%;border:0;background:#1e3a8a;color:#fff;font:700 20px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.28);display:none}' +
    '#acxhFab:hover{background:#1d4ed8}' +
    '#acxhPop{position:fixed;right:16px;bottom:72px;z-index:9001;width:360px;max-width:calc(100vw - 24px);background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.28);overflow:hidden;display:none;flex-direction:column;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    '#acxhPop.open{display:flex}' +
    '#acxhPop *{box-sizing:border-box}' +
    '.acxh-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #e2e8f0}' +
    '.acxh-head b{font-size:14px}.acxh-head small{display:block;color:#64748b;font-size:12px}' +
    '.acxh-x{border:0;background:none;color:#64748b;font-size:16px;cursor:pointer;width:28px;height:28px;border-radius:8px}.acxh-x:hover{background:#f1f5f9;color:#000}' +
    '.acxh-ctx{display:none;justify-content:space-between;gap:8px;background:#eff6ff;border-bottom:1px solid #dbeafe;color:#1e3a8a;padding:6px 12px;font-size:12.5px}' +
    '.acxh-ctx.show{display:flex}.acxh-ctx button{border:0;background:none;color:#1e3a8a;font-weight:600;text-decoration:underline;cursor:pointer;font-size:12.5px}' +
    '.acxh-pane{display:none;flex-direction:column}.acxh-pane.show{display:flex}' +
    '.acxh-menu{padding:12px;background:#f8fafc}.acxh-menu p{margin:0 0 8px;color:#64748b;font-size:13px}' +
    '.acxh-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
    '.acxh-card{display:flex;flex-direction:column;gap:2px;text-align:left;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px;cursor:pointer;font:inherit}' +
    '.acxh-card:hover{background:#eff6ff;border-color:#93c5fd}.acxh-card b{font-size:13.5px}.acxh-card span{color:#64748b;font-size:12px}' +
    '.acxh-bar{display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid #e2e8f0;background:#fff}' +
    '.acxh-back{border:0;background:none;color:#475569;font-weight:600;cursor:pointer;padding:4px 6px;border-radius:6px;font-size:13px}.acxh-back:hover{background:#f1f5f9}' +
    '.acxh-bar input,.acxh-send input{flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:7px 10px;font:inherit;font-size:13.5px;min-width:0;background:#f8fafc;color:#0f172a}' +
    '.acxh-bar input:focus,.acxh-send input:focus{outline:2px solid #2563eb;background:#fff}' +
    '.acxh-list{height:300px;overflow-y:auto;padding:8px;background:#f8fafc;display:flex;flex-direction:column;gap:6px}' +
    '.acxh-item{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:9px 10px;cursor:pointer;font:inherit;font-weight:600;color:#0f172a}' +
    '.acxh-item:hover{background:#eff6ff;border-color:#93c5fd}.acxh-item i{color:#94a3b8;font-style:normal}' +
    '.acxh-box{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px;line-height:1.5}' +
    '.acxh-go{display:block;width:100%;margin-top:8px;background:#1e3a8a;color:#fff;border:0;border-radius:8px;padding:8px 10px;font:inherit;font-weight:600;cursor:pointer}.acxh-go:hover{background:#1d4ed8}' +
    '.acxh-msgs{height:260px;overflow-y:auto;padding:10px;background:#f8fafc;display:flex;flex-direction:column;gap:8px}' +
    '.acxh-me{align-self:flex-end;background:#1e3a8a;color:#fff;border-radius:10px;padding:8px 10px;max-width:85%}' +
    '.acxh-bot{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;max-width:90%;line-height:1.5}' +
    '.acxh-send{display:flex;gap:6px;padding:8px;border-top:1px solid #e2e8f0;background:#fff}' +
    '.acxh-send button{border:0;background:#1e3a8a;color:#fff;border-radius:8px;padding:0 14px;font:inherit;font-weight:600;cursor:pointer}' +
    '.acxh-esc{display:none;gap:6px;padding:0 8px 8px;background:#fff}.acxh-esc.show{display:flex}' +
    '.acxh-esc button{flex:1;border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:6px;font:inherit;font-size:12.5px;cursor:pointer}.acxh-esc button:hover{background:#f1f5f9}';

  function build() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var fab = document.createElement('button');
    fab.id = 'acxhFab'; fab.type = 'button'; fab.title = 'Help & Support'; fab.textContent = '?';
    var pop = document.createElement('div'); pop.id = 'acxhPop';
    pop.innerHTML =
      '<div class="acxh-head"><div><b>🤖 Acacia Support</b><small>' + esc(CFG.title) + ' · How can we help?</small></div><button class="acxh-x" data-a="close" type="button">✕</button></div>' +
      '<div class="acxh-ctx" id="acxhCtx"></div>' +
      '<div class="acxh-pane acxh-menu show" id="acxhMenu"><p>Pick how you\'d like help:</p><div class="acxh-grid">' +
        '<button class="acxh-card" data-a="nav" type="button"><span>🧭</span><b>Navigate</b><span>Find any screen & how to get there</span></button>' +
        '<button class="acxh-card" data-a="ai" type="button"><span>🤖</span><b>AI Assistant</b><span>Ask a question, get an instant answer</span></button>' +
        '<button class="acxh-card" data-a="chat" type="button"><span>💬</span><b>Chat</b><span>Live chat with our team</span></button>' +
        '<button class="acxh-card" data-a="email" type="button"><span>✉️</span><b>Email</b><span>Send us an email about this screen</span></button>' +
      '</div></div>' +
      '<div class="acxh-pane" id="acxhNav"><div class="acxh-bar"><button class="acxh-back" data-a="menu" type="button">← Back</button><input id="acxhSearch" placeholder="Search screens…" autocomplete="off"></div><div class="acxh-list" id="acxhRes"></div></div>' +
      '<div class="acxh-pane" id="acxhAI"><div class="acxh-bar"><button class="acxh-back" data-a="menu" type="button">← Back</button><b style="font-size:13px">🤖 AI Assistant</b></div><div class="acxh-msgs" id="acxhMsgs"></div>' +
        '<div class="acxh-esc" id="acxhEsc"><button data-a="email" type="button">✉️ Email support</button><button data-a="chat" type="button">💬 Chat with us</button></div>' +
        '<form class="acxh-send" id="acxhForm"><input id="acxhQ" placeholder="Ask about ' + esc(CFG.title) + '…" autocomplete="off"><button type="submit">Send</button></form></div>';
    document.body.appendChild(fab); document.body.appendChild(pop);

    fab.addEventListener('click', toggle);
    pop.addEventListener('click', function (e) {
      var t = e.target.closest('[data-a],[data-m],[data-go]'); if (!t) return;
      if (t.dataset.go) return go(t.dataset.go);
      if (t.dataset.m) return showDetail(t.dataset.m);
      var a = t.dataset.a;
      if (a === 'close') pop.classList.remove('open');
      else if (a === 'menu') show('menu');
      else if (a === 'nav') show('nav');
      else if (a === 'ai') show('ai');
      else if (a === 'chat') openChat();
      else if (a === 'email') openEmail();
      else if (a === 'ctx') { show('nav'); showDetail(t.dataset.name); }
    });
    $('acxhSearch').addEventListener('input', function () { renderList(this.value); });
    $('acxhForm').addEventListener('submit', function (e) { e.preventDefault(); ask(); });
    setInterval(function () { fab.style.display = loggedIn() ? 'block' : 'none'; if (!loggedIn()) pop.classList.remove('open'); }, 1000);
  }

  function show(mode) {
    ['Menu', 'Nav', 'AI'].forEach(function (n) { $('acxh' + n).classList.remove('show'); });
    if (mode === 'nav') { $('acxhNav').classList.add('show'); $('acxhSearch').value = ''; renderList(''); $('acxhSearch').focus(); }
    else if (mode === 'ai') { $('acxhAI').classList.add('show'); initAI(); $('acxhQ').focus(); }
    else $('acxhMenu').classList.add('show');
  }
  function toggle() {
    var pop = $('acxhPop'), opening = !pop.classList.contains('open');
    pop.classList.toggle('open');
    if (opening) { updateCtx(); show('menu'); }
  }
  function updateCtx() {
    var bar = $('acxhCtx'), s = currentScreen();
    if (!s) { bar.className = 'acxh-ctx'; bar.innerHTML = ''; return; }
    bar.className = 'acxh-ctx show';
    bar.innerHTML = '<span>📍 You\'re in <b>' + esc(s.module) + '</b></span><button data-a="ctx" data-name="' + esc(s.module) + '" type="button">Get help with this</button>';
  }

  /* ---------- navigate ---------- */
  function renderList(q) {
    var t = (q || '').toLowerCase().trim(), box = $('acxhRes');
    var rows = KB.filter(function (e) { return e.tab && (!t || e.module.toLowerCase().indexOf(t) > -1 || e.keywords.some(function (k) { return k.toLowerCase().indexOf(t) > -1; })); });
    box.innerHTML = rows.length ? rows.map(function (e) { return '<button class="acxh-item" data-m="' + esc(e.module) + '" type="button"><span>' + esc(e.module) + '</span><i>›</i></button>'; }).join('')
      : '<div style="text-align:center;color:#94a3b8;padding:30px 0">No matching screens. Try a shorter keyword.</div>';
  }
  function showDetail(name) {
    var e = KB.filter(function (x) { return x.module === name; })[0]; if (!e) return;
    $('acxhRes').innerHTML = '<div class="acxh-box"><button class="acxh-back" data-a="nav" type="button" style="padding:0 0 6px">← All screens</button><div>' + e.answer.replace(/\n/g, '<br>') + '</div>' +
      (e.tab ? '<button class="acxh-go" data-go="' + esc(e.tab) + '" type="button">Take me there →</button>' : '') + '</div>';
  }

  /* ---------- AI assistant ---------- */
  function initAI() {
    var m = $('acxhMsgs'); if (m.childNodes.length) return;
    m.innerHTML = '<div class="acxh-bot">👋 <b>Hello!</b> I\'m Acacia AI Support. Ask me how to do something in ' + esc(CFG.title) + ', or where to find a screen.</div>';
  }
  function say(who, html, tab) {
    var m = $('acxhMsgs'), d = document.createElement('div');
    d.className = who === 'me' ? 'acxh-me' : 'acxh-bot';
    d.innerHTML = html + (tab ? '<button class="acxh-go" data-go="' + esc(tab) + '" type="button">📍 Take me there</button>' : '');
    m.appendChild(d); m.scrollTop = m.scrollHeight; return d;
  }
  function search(q) {
    var n = (q || '').toLowerCase(), best = null, score = 0;
    KB.forEach(function (e) {
      var s = 0;
      e.keywords.forEach(function (k) { k = k.toLowerCase(); if (n.indexOf(k) > -1) s += k.indexOf(' ') > -1 ? 2 : 1; });
      if (s > score) { score = s; best = e; }
    });
    return best;
  }
  async function ask() {
    var inp = $('acxhQ'), q = inp.value.trim(); if (!q) return;
    inp.value = ''; say('me', esc(q)); history.push({ role: 'user', text: q });
    var hit = search(q), esc_ = $('acxhEsc');
    if (hit) { history.push({ role: 'assistant', text: hit.answer }); say('bot', hit.answer.replace(/\n/g, '<br>'), hit.tab); esc_.classList.remove('show'); return; }
    var typing = say('bot', '…');
    try {
      var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 5000);
      var r = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, history: history, app: CFG.app }), signal: ctl.signal });
      clearTimeout(t);
      if (!r.ok) throw new Error('bad');
      var j = await r.json();
      if (j.supportRequired || !j.answer) throw new Error('none');
      history.push({ role: 'assistant', text: j.answer });
      typing.innerHTML = esc(j.answer).replace(/\n/g, '<br>'); esc_.classList.remove('show');
    } catch (e) {
      typing.innerHTML = 'I couldn\'t find an exact answer for that.<br><br>Please contact our support team below.';
      esc_.classList.add('show');
    }
    $('acxhMsgs').scrollTop = $('acxhMsgs').scrollHeight;
  }

  /* ---------- email + live chat ---------- */
  function openEmail() {
    var s = currentScreen(), n = s ? CFG.title + ' – ' + s.module : CFG.title;
    var subj = encodeURIComponent('Support request - ' + n);
    var body = encodeURIComponent('Hi Acacia support team,\n\nI need help with: ' + n + '\n\n(Describe your issue here)\n');
    window.location.href = 'mailto:' + CFG.email + '?subject=' + subj + '&body=' + body;
  }
  function openChat() {
    var start = function () { $('acxhPop').classList.remove('open'); window.acxOpenSupportPanel(); };
    if (window.acxOpenSupportPanel) return start();
    try {
      var A = window.AcaciaCloud;
      window.ACX_APP = CFG.app;
      if (A && A.URL && !window.__SUPA_URL__) { window.__SUPA_URL__ = A.URL; window.__SUPA_KEY__ = A.KEY; }
      window.acxSession = window.acxSession || function () { try { return CURRENT_USER && CURRENT_USER.companyId ? { companyId: String(CURRENT_USER.companyId), obj: CURRENT_USER } : null; } catch (e) { return null; } };
    } catch (e) {}
    var s = document.createElement('script'); s.src = 'acacia-support.js';
    s.onload = function () { if (window.acxOpenSupportPanel) start(); else alert('Support chat loaded but did not start correctly. Please refresh and try again, or use Email.'); };
    s.onerror = function () { alert('Live chat is not available in this app yet. Please use Email, or ask the AI Assistant.'); };
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
