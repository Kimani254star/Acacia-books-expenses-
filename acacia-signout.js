/* acacia-signout.js - puts a "Log out" button at the bottom of the LEFT sidebar so it is always one click away.
   Self-contained (own CSS). It calls the app's own logout, so nothing about login/sync changes.
   Works with: handleLogout() (CRM, Expenses, Payroll, Sell, Mail), signOut() (Inventory, Plans),
   and the #aclOut button (School, Hospital, Meet). */
(function () {
  'use strict';
  if (window.__acxSignOut) return; window.__acxSignOut = true;

  var SIDES = ['#sidebar', 'aside.sidebar', 'div.sidebar', 'aside.w-60', 'nav#nav'];

  var css =
    '#acxSignOut{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;margin-top:auto;padding:10px 14px;' +
    'position:sticky;bottom:0;z-index:5;background:inherit;color:inherit;font:inherit;font-weight:600;text-align:left;cursor:pointer;' +
    'border:0;border-top:1px solid rgba(128,128,128,.35);border-radius:0;flex:none}' +
    '#acxSignOut:hover{background:rgba(128,128,128,.22)}' +
    'nav#nav #acxSignOut{border-radius:7px;margin-top:12px}' +
    '#aclOut{display:none!important}';
  var st = document.createElement('style'); st.textContent = css; (document.head || document.documentElement).appendChild(st);

  function findSide() {
    for (var i = 0; i < SIDES.length; i++) {
      var el = document.querySelector(SIDES[i]);
      if (el) return el;
    }
    return null;
  }

  function logout() {
    try {
      if (typeof window.handleLogout === 'function') return window.handleLogout();
      if (typeof window.signOut === 'function') return window.signOut();
    } catch (e) { console.error(e); }
    var o = document.getElementById('aclOut');
    if (o) { o.click(); return; }
    var h = document.querySelector('[onclick*="handleLogout"],[onclick*="signOut"]');
    if (h) h.click();
  }

  function build() {
    var b = document.createElement('button');
    b.id = 'acxSignOut'; b.type = 'button'; b.title = 'Log out of this app';
    b.innerHTML = '<span aria-hidden="true">\u238B</span><span>Log out</span>';
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); logout(); });
    return b;
  }

  function ensure() {
    var side = findSide(); if (!side) return;
    /* School / Hospital / Meet only create their log-out when someone is logged in, so only show it then */
    var needsSession = side.matches('nav#nav');
    var existing = document.getElementById('acxSignOut');
    var loggedIn = !needsSession || !!document.getElementById('aclOut');
    if (!loggedIn) { if (existing) existing.remove(); return; }
    if (existing && existing.parentNode === side && side.lastElementChild === existing) return;
    if (existing) existing.remove();
    side.appendChild(build());
  }

  var t = null;
  function soon() { clearTimeout(t); t = setTimeout(ensure, 60); }

  function start() {
    ensure();
    var side = findSide();
    if (side) new MutationObserver(soon).observe(side, { childList: true });
    if (document.body) new MutationObserver(soon).observe(document.body, { childList: true });
    setTimeout(ensure, 500); setTimeout(ensure, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
