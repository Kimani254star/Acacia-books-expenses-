/* Session header installer. It lives in the first script of the page so window.fetch is wrapped BEFORE supabase-js or any app code
   captures it. Same block as Books; guarded by "if (w.AcxSession) return" so it only installs once. */
/* ===== merged from acacia-session.js ===== */
/* acacia-session.js - sends the Acacia session token with every Supabase request.
 * Load FIRST in <head> (before supabase-js / any app script). Tokens come from the acx_login RPC. */
(function (w) {
  'use strict';
  if (w.AcxSession) return;
  var BASE = 'https://xglsampckermarjpczdf.supabase.co/rest/v1/';
  var ANON = 'sb_publishable_x-dPR7pzhvJgag9soW0I8w_yfKTmi6A';
  var KEY = 'acx_sessions', MAX = 8, rawFetch = w.fetch;

  function list() { try { var a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(function (t) { return /^[0-9a-f]{64}$/.test(t); }) : []; } catch (e) { return []; } }
  function save(a) { try { if (a.length) localStorage.setItem(KEY, JSON.stringify(a.slice(-MAX))); else localStorage.removeItem(KEY); } catch (e) {} }
  function add(t) { if (!/^[0-9a-f]{64}$/.test(String(t || ''))) return; var a = list().filter(function (x) { return x !== t; }); a.push(t); save(a); }
  function clear(logout) {
    var a = list(); save([]);
    if (logout && rawFetch) a.forEach(function (t) {
      try { rawFetch.call(w, BASE + 'rpc/acx_logout', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: t }), keepalive: true }); } catch (e) {}
    });
  }

  if (rawFetch) w.fetch = function (input, init) {
    var inBase = false;
    try {
      var a = list();
      var url = typeof input === 'string' ? input : (input && input.url) || String(input || '');
      inBase = url.indexOf(BASE) === 0;
      if (a.length && inBase) {
        if (typeof Request !== 'undefined' && input instanceof Request) {
          var h = new Headers(input.headers); h.set('x-acx-session', a.join(',')); input = new Request(input, { headers: h });
        } else {
          init = Object.assign({}, init); var hh = new Headers(init.headers || {}); hh.set('x-acx-session', a.join(',')); init.headers = hh;
        }
      }
    } catch (e) {}
    var pr = rawFetch.call(this, input, init);
    if (inBase) pr = pr.then(function (res) {
      /* the database refused the request because this browser has no valid session token: ask for the password once */
      try { if (res && (res.status === 401 || res.status === 403)) res.clone().text().then(function (t) { if (/42501|Not signed in for this company/.test(t)) askLogin(); }).catch(function () {}); } catch (e) {}
      return res;
    });
    return pr;
  };

  /* Ask the server to check a login. Returns {status:'ok'|'denied'|'missing'|'error', rows:[...]}; rows carry no password fields and one 'session' each.
     Nothing is stored: the caller decides which row to accept and calls add(row.session). */
  var recent = { k: '', t: 0 };
  async function login(email, password, company) {
    try {
      var em = String(email || '').trim().toLowerCase();
      var r = await rawFetch.call(w, BASE + 'rpc/acx_login', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_email: em, p_password: password, p_company: company || null }) });
      if (r.status === 404) return { status: 'missing', rows: [] };
      if (!r.ok) return { status: 'error', rows: [] };
      var rows = await r.json(); rows = Array.isArray(rows) ? rows : [];
      if (rows.length) recent = { k: em, t: Date.now() };
      return { status: rows.length ? 'ok' : 'denied', rows: rows };
    } catch (e) { return { status: 'network', rows: [] }; }
  }

  /* For apps whose own login runs in the browser (Books): after it succeeds, ask the server for a session. */
  async function start(email, password, company) {
    if (recent.k && recent.k === String(email || '').trim().toLowerCase() && Date.now() - recent.t < 60000) return true;   /* login() just did this */
    try {
      var r = await rawFetch.call(w, BASE + 'rpc/acx_login', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_email: String(email || '').trim().toLowerCase(), p_password: password, p_company: company || null }) });
      if (!r.ok) return false;
      var rows = await r.json(); if (!Array.isArray(rows) || !rows.length) return false;
      rows.forEach(function (x) { if (x && x.session) add(x.session); });
      return true;
    } catch (e) { return false; }
  }

  /* Books: check the password on the server first. Only when acx_login is missing or unreachable does it use the old
     'fallback' (which reads the account row). Returns the account data to merge into the local users list, or null. */
  async function accountFirst(email, company, fallback) {
    var pass = ''; try { pass = String((w.document.getElementById('loginPass') || {}).value || '').trim(); } catch (e) {}
    if (!pass) return fallback();
    var res = await login(email, pass, company);
    if (res.status === 'missing' || res.status === 'network') return fallback();
    if (res.status !== 'ok') return null;
    var row = res.rows[0];
    if (company && w.acxCompanyMatches) {
      var m = res.rows.filter(function (x) { var d = Object.assign({}, x.data || {}); d.companyId = d.companyId || x.company_id; return w.acxCompanyMatches(d, company); })[0];
      if (m) row = m;
    }
    var u = Object.assign({}, row.data || {}); u.companyId = u.companyId || row.company_id;
    /* the server just confirmed this password, so keep a salted hash of it on this device for the app's own local check */
    var sb = new Uint8Array(16); w.crypto.getRandomValues(sb);
    var salt = Array.prototype.map.call(sb, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    var dig = await w.crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pass));
    u.passwordHash = Array.prototype.map.call(new Uint8Array(dig), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    u.passwordSalt = salt; delete u.password;
    if (row.session) add(row.session);
    return u;
  }

  /* Someone who signed in before sessions existed (or whose 30-day session ended) has no token. Ask for the password once, get one. */
  var asking = false, lastAsk = 0;
  function who() {
    var ks = ['loggedInUser', 'acacia_session', 'pos_session'];
    for (var i = 0; i < ks.length; i++) {
      try { var u = JSON.parse(localStorage.getItem(ks[i]) || 'null'); var em = u && (u.email || u.login_id || u.username); var co = u && (u.companyId || u.company_id);
        if (em && co) return { email: String(em), company: String(co) }; } catch (e) {}
    }
    return null;
  }
  function askLogin() {
    var u = who();
    if (asking || !u || !w.document || !w.document.body || Date.now() - lastAsk < 60000) return;
    asking = true; lastAsk = Date.now();
    var d = w.document, o = d.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);display:grid;place-items:center;font-family:inherit';
    o.innerHTML = '<div style="background:#fff;color:#111;border-radius:12px;padding:20px;width:min(380px,92vw);box-shadow:0 12px 40px #0006"><b style="font-size:16px">Confirm your password</b>' +
      '<p style="font-size:13px;margin:8px 0">To keep your data syncing securely, enter the password for <b class="acxWho"></b>.</p>' +
      '<input type="password" class="acxPw" autocomplete="current-password" style="width:100%;height:40px;padding:0 10px;border:1px solid #888;border-radius:8px;font:inherit;box-sizing:border-box;color:#111;background:#fff">' +
      '<p class="acxErr" style="color:#c00;font-size:12px;min-height:16px;margin:6px 0"></p>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="acxLater" style="padding:8px 14px;border-radius:8px;border:1px solid #888;background:#fff;color:#111;cursor:pointer">Later</button>' +
      '<button type="button" class="acxGo" style="padding:8px 14px;border-radius:8px;border:0;background:#1e3a8a;color:#fff;cursor:pointer">Continue</button></div></div>';
    d.body.appendChild(o);
    o.querySelector('.acxWho').textContent = u.email;
    var pw = o.querySelector('.acxPw'), er = o.querySelector('.acxErr');
    function close(later) { try { o.remove(); } catch (e) {} asking = false; if (later) lastAsk = Date.now() + 540000; }
    async function go() {
      if (!pw.value) return; er.textContent = 'Checking...';
      var res = await login(u.email, pw.value, u.company);
      if (res.status === 'ok') { res.rows.forEach(function (x) { if (x && x.session) add(x.session); }); close(false); }
      else er.textContent = res.status === 'denied' ? 'That password is not correct.' : 'Could not reach the server. Try again.';
    }
    o.querySelector('.acxGo').onclick = go;
    o.querySelector('.acxLater').onclick = function () { close(true); };
    pw.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    setTimeout(function () { try { pw.focus(); } catch (e) {} }, 50);
  }

  w.AcxSession = { add: add, list: list, clear: clear, start: start, login: login, accountFirst: accountFirst, ask: askLogin };
})(window);

/* Acacia Theme - one place for Light / Dark / System Default, same as Books.
 * The choice is picked in Settings > Appearance (card added by acacia-appearance.js) and is
 * remembered on this device in localStorage "acacia_theme_pref" ("light" | "dark" | "system").
 * It replaces the little moon/sun buttons that used to sit on the home pages and in the headers.
 *
 * Works with every way the apps already style dark mode:
 *   html[data-theme="dark"]  ·  body.dark (Mail)  ·  #homePage.hp-dark (Expenses home page)
 * and keeps the old per-app keys in step so nothing fights it on the next page load.
 */
(function () {
  if (window.AcaciaTheme) return;
  var KEY = "acacia_theme_pref";
  var root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* first run: pick up whatever the old toggles had saved so nobody's choice is lost */
  function migrate() {
    var v;
    v = lsGet("acacia_theme") || lsGet("acacia-payroll-theme") || lsGet("acxTheme") || lsGet("acacia_home_theme");
    if (v === "dark" || v === "light") return v;
    v = lsGet("pos_theme");
    if (v === "dark" || v === "light") return v;
    if (v === "auto") return "system";
    try {
      var m = JSON.parse(lsGet("acacia_mail_settings") || "{}").theme;
      if (m === "Dark") return "dark";
      if (m === "System") return "system";
    } catch (e) {}
    return "light";
  }

  function get() {
    var v = lsGet(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
    return migrate();
  }
  function resolve(p) {
    if (p === "system") return mq && mq.matches ? "dark" : "light";
    return p === "dark" ? "dark" : "light";
  }

  /* keep the old keys in step so each app's own start-up code agrees with the choice */
  function syncLegacy(p, r) {
    lsSet("acacia_theme", r);
    lsSet("acacia-payroll-theme", r);
    lsSet("acxTheme", r);
    lsSet("acacia_home_theme", r);
    if (lsGet("pos_theme") !== null || lsGet("posTheme") !== null || document.getElementById("themeSel")) {
      lsSet("pos_theme", p === "system" ? "auto" : p);
    }
    try {
      var raw = lsGet("acacia_mail_settings");
      if (raw !== null || document.getElementById("stTheme")) {
        var s = JSON.parse(raw || "{}") || {};
        s.theme = p === "dark" ? "Dark" : p === "system" ? "System" : "Light";
        lsSet("acacia_mail_settings", JSON.stringify(s));
      }
    } catch (e) {}
  }

  function paint(p) {
    var r = resolve(p);
    root.setAttribute("data-theme", r);
    root.setAttribute("data-theme-choice", p);
    root.style.colorScheme = r;
    var dark = r === "dark";
    if (document.body) {
      document.body.classList.toggle("dark", dark);
      var hp = document.getElementById("homePage");
      if (hp) hp.classList.toggle("hp-dark", dark);
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && meta.getAttribute("data-acx-orig") === null) meta.setAttribute("data-acx-orig", meta.getAttribute("content") || "");
    if (meta) meta.setAttribute("content", dark ? "#0b1220" : (meta.getAttribute("data-acx-orig") || "#1e3a8a"));
    var sel = document.getElementById("stTheme");
    if (sel) sel.value = p === "dark" ? "Dark" : p === "system" ? "System" : "Light";
    markCards(p);
    return r;
  }

  function markCards(p) {
    var cards = document.querySelectorAll("[data-acx-theme-choice]");
    for (var i = 0; i < cards.length; i++) {
      var on = cards[i].getAttribute("data-acx-theme-choice") === p;
      cards[i].classList.toggle("acx-theme-active", on);
      var c = cards[i].querySelector(".acx-theme-check");
      if (c) c.style.display = on ? "block" : "none";
    }
  }

  function set(p) {
    if (p !== "light" && p !== "dark" && p !== "system") p = "light";
    lsSet(KEY, p);
    var r = paint(p);
    syncLegacy(p, r);
    try { window.dispatchEvent(new CustomEvent("acacia-theme-change", { detail: { choice: p, theme: r } })); } catch (e) {}
  }

  /* the old toggle buttons are retired - hidden everywhere, theme now lives in Settings */
  var st = document.createElement("style");
  st.textContent =
    ".hp-theme,.themeToggle,#themeToggle,#themeBtn,#darkToggle,.theme-toggle,.auth-theme-toggle,#themeToggleBtn,#authThemeToggleBtn,#themeSel,.theme-row{display:none!important}";
  (document.head || root).appendChild(st);

  var initial = get();
  paint(initial);
  syncLegacy(initial, resolve(initial));

  document.addEventListener("DOMContentLoaded", function () {
    var p0 = get(); syncLegacy(p0, paint(p0));
    /* Mail keeps its own "Interface theme" select in Settings - keep it in step, and hide the duplicate */
    var sel = document.getElementById("stTheme");
    if (sel) {
      sel.style.display = "none";
      var lb = sel.previousElementSibling;
      if (lb && lb.tagName === "LABEL") lb.style.display = "none";
    }
  });
  window.addEventListener("load", function () { var p1 = get(); syncLegacy(p1, paint(p1)); });

  if (mq) {
    var onSys = function () { if (get() === "system") { var p = "system"; syncLegacy(p, paint(p)); } };
    if (mq.addEventListener) mq.addEventListener("change", onSys); else if (mq.addListener) mq.addListener(onSys);
  }

  /* the Appearance card (and Mail's old select) call in here */
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("[data-acx-theme-choice]") : null;
    if (t) set(t.getAttribute("data-acx-theme-choice"));
  });
  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "stTheme") {
      var v = e.target.value;
      set(v === "Dark" ? "dark" : v === "System" ? "system" : "light");
    }
  });
  /* other tabs / windows of the same app follow along */
  window.addEventListener("storage", function (e) { if (e.key === KEY) paint(get()); });

  window.AcaciaTheme = { get: get, set: set, resolve: function () { return resolve(get()); } };
})();
