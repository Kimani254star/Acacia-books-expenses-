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
