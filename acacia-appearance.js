/* Acacia Appearance - sidebar colour, sidebar text colour, font and font size.
 * Same feature as the Appearance card in the Developer site, shared by every module.
 *
 * Each site sets, BEFORE loading this file:
 *   window.ACACIA_APPEARANCE = { sidebar: '.sidebar', items: '.sidebar .nav-item' };
 * and puts <div data-acacia-appearance></div> wherever the Appearance card should show.
 * Settings are saved in localStorage ("acacia_appearance") and applied on every page load.
 * Anything left unset keeps the site's original look.
 */
(function () {
  var CFG = window.ACACIA_APPEARANCE || {};
  var KEY = "acacia_appearance";
  var SB = CFG.sidebar || ".sidebar";
  var IT = CFG.items || (SB + " button, " + SB + " a, " + SB + " .nav-item");
  var PRESETS = [
    ["#0A1615", "#E7ECEB"], ["#0E2B29", "#E7ECEB"], ["#22615D", "#F1F7F6"], ["#1e3a8a", "#E8EEFF"],
    ["#4c1d95", "#F1E9FF"], ["#7f1d1d", "#FFEDED"], ["#374151", "#F3F4F6"], ["#ffffff", "#0e2b29"]
  ];
  var FONTS = [
    ["Default", [["", "Site default"]]],
    ["Sans-serif (web fonts)", [["'Inter', sans-serif", "Inter"], ["'Roboto', sans-serif", "Roboto"], ["'Open Sans', sans-serif", "Open Sans"], ["'Lato', sans-serif", "Lato"], ["'Poppins', sans-serif", "Poppins"], ["'Montserrat', sans-serif", "Montserrat"], ["'Nunito', sans-serif", "Nunito"], ["'Source Sans 3', sans-serif", "Source Sans 3"], ["'DM Sans', sans-serif", "DM Sans"], ["'Work Sans', sans-serif", "Work Sans"]]],
    ["Serif (web fonts)", [["'Merriweather', serif", "Merriweather"], ["'Playfair Display', serif", "Playfair Display"], ["'Lora', serif", "Lora"], ["'PT Serif', serif", "PT Serif"], ["'Crimson Text', serif", "Crimson Text"]]],
    ["Monospace (web fonts)", [["'JetBrains Mono', monospace", "JetBrains Mono"], ["'Fira Code', monospace", "Fira Code"], ["'Source Code Pro', monospace", "Source Code Pro"]]],
    ["System fonts", [["Georgia, serif", "Georgia"], ["'Times New Roman', Times, serif", "Times New Roman"], ["'Palatino Linotype', Palatino, serif", "Palatino"], ["Garamond, serif", "Garamond"], ["Cambria, Georgia, serif", "Cambria"], ["Arial, Helvetica, sans-serif", "Arial"], ["Verdana, Geneva, sans-serif", "Verdana"], ["Tahoma, Geneva, sans-serif", "Tahoma"], ["'Trebuchet MS', sans-serif", "Trebuchet MS"], ["'Segoe UI', Roboto, sans-serif", "Segoe UI"], ["Calibri, Candara, sans-serif", "Calibri"], ["system-ui, -apple-system, sans-serif", "System default"], ["'Courier New', monospace", "Courier New"]]]
  ];
  var SIZES = [["", "Site default"], ["0.8rem", "Small"], ["1rem", "Large"], ["1.125rem", "Extra large"]];
  var WEBFONT_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@400;500;700&family=Open+Sans:wght@400;600;700&family=Lato:wght@400;700&family=Poppins:wght@400;500;600&family=Montserrat:wght@400;500;600&family=Nunito:wght@400;600;700&family=Source+Sans+3:wght@400;600&family=DM+Sans:wght@400;500;700&family=Work+Sans:wght@400;500;600&family=Merriweather:wght@400;700&family=Playfair+Display:wght@400;600&family=Lora:wght@400;600&family=PT+Serif:wght@400;700&family=Crimson+Text:wght@400;600&family=JetBrains+Mono:wght@400;600&family=Fira+Code:wght@400;500&family=Source+Code+Pro:wght@400;600&display=swap";

  function get() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }

  function loadWebFont(font) {
    if (!font || /^(Georgia|'Times|'Palatino|Garamond|Cambria|Arial|Verdana|Tahoma|'Trebuchet|'Segoe|Calibri|system-ui|'Courier)/.test(font)) return;
    if (document.getElementById("acap-fonts")) return;
    var l = document.createElement("link");
    l.id = "acap-fonts"; l.rel = "stylesheet"; l.href = WEBFONT_URL;
    document.head.appendChild(l);
  }

  /* ---------- apply ---------- */
  function css(a) {
    var out = [];
    var bg = a.sbBg, tx = a.sbText;
    if (bg && !tx) {
      var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(bg);
      if (m) { var L = (0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16)) / 255; tx = L > 0.6 ? "#0e2b29" : "#f3f6f5"; }
    }
    if (bg) out.push(SB + "{background:" + bg + " !important;}");
    if (tx) {
      out.push(SB + "," + SB + " *:not(svg):not(svg *){color:" + tx + " !important;}");
      out.push(SB + " .disabled{opacity:.5;}");
      out.push(IT + "{background:transparent !important;}");
      out.push(IT.split(",").map(function (s) { return s.trim() + ":hover"; }).join(",") + "{background:color-mix(in srgb," + tx + " 14%,transparent) !important;}");
      out.push(IT.split(",").map(function (s) { s = s.trim(); return s + ".active," + s + ".sb-active"; }).join(",") + "{background:color-mix(in srgb," + tx + " 24%,transparent) !important;}");
    } else if (bg) {
      /* background changed but text left alone: keep a readable default */
    }
    if (a.font) out.push("body,body *:not(i):not(.fa):not(svg):not(svg *){font-family:" + a.font + " !important;}");
    if (a.fs) {
      out.push("body p,body td,body th,body li,body label,body input,body select,body textarea,body button,body a,body small," + SB + " *:not(svg):not(svg *){font-size:" + a.fs + " !important;}");
    }
    return out.join("\n");
  }
  function apply() {
    var a = get();
    var st = document.getElementById("acap-style");
    if (!st) { st = document.createElement("style"); st.id = "acap-style"; (document.head || document.documentElement).appendChild(st); }
    st.textContent = css(a);
    if (a.font) loadWebFont(a.font);
    syncControls();
  }

  /* ---------- UI ---------- */
  function toHex(c) {
    var m = /rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(c || "");
    if (!m) return null;
    return "#" + [m[1], m[2], m[3]].map(function (n) { return ("0" + (+n).toString(16)).slice(-2); }).join("");
  }
  function siteDefaults() {
    var d = { bg: "#0a1615", text: "#e7eceb" };
    try {
      var s = document.querySelector(SB.split(",")[0]);
      if (s) {
        /* temporarily read the original look: computed values already include overrides only if set */
        var cs = getComputedStyle(s);
        d.bg = toHex(cs.backgroundColor) || d.bg;
        d.text = toHex(cs.color) || d.text;
        var it = document.querySelector(IT.split(",")[0]);
        if (it) d.text = toHex(getComputedStyle(it).color) || d.text;
      }
    } catch (e) {}
    return d;
  }
  function esc(s) { return String(s).replace(/"/g, "&quot;"); }
  function cardHTML() {
    var fonts = FONTS.map(function (g) {
      return '<optgroup label="' + g[0] + '">' + g[1].map(function (o) { return '<option value="' + esc(o[0]) + '">' + o[1] + "</option>"; }).join("") + "</optgroup>";
    }).join("");
    var sizes = SIZES.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + "</option>"; }).join("");
    var sw = PRESETS.map(function (p, i) { return '<button type="button" class="acap-sw" data-acap-preset="' + i + '" title="' + p[0] + '" style="background:' + p[0] + '"></button>'; }).join("");
    return '' +
      '<div class="acap-card">' +
      '<div class="acap-head"><h3>🎨 Appearance</h3><span class="acap-tag">Theme</span></div>' +
      '<div class="acap-body">' +
      '<div><label class="acap-l">Sidebar colour</label><div class="acap-row"><input type="color" data-acap="sbBg"><span class="acap-v" data-acap-val="sbBg"></span></div><div class="acap-sws">' + sw + '</div></div>' +
      '<div><label class="acap-l">Sidebar text colour</label><div class="acap-row"><input type="color" data-acap="sbText"><span class="acap-v" data-acap-val="sbText"></span></div></div>' +
      '<div><label class="acap-l">Font</label><select data-acap="font">' + fonts + '</select></div>' +
      '<div><label class="acap-l">Font size</label><select data-acap="fs">' + sizes + '</select></div>' +
      '<button type="button" class="acap-reset" data-acap-reset>Reset appearance</button>' +
      '<p class="acap-note">Changes apply instantly and are remembered on this device.</p>' +
      '</div></div>';
  }
  function syncControls() {
    var a = get(), d = null;
    document.querySelectorAll("[data-acap]").forEach(function (el) {
      var k = el.getAttribute("data-acap"), v = a[k];
      if (el.type === "color") {
        if (!v) { d = d || siteDefaults(); v = k === "sbBg" ? d.bg : d.text; }
        el.value = v;
      } else { el.value = v || ""; }
    });
    document.querySelectorAll("[data-acap-val]").forEach(function (el) {
      var k = el.getAttribute("data-acap-val");
      el.textContent = a[k] || "site default";
    });
  }
  function mount() {
    document.querySelectorAll("[data-acacia-appearance]:not([data-acap-ready])").forEach(function (el) {
      el.setAttribute("data-acap-ready", "1");
      el.innerHTML = cardHTML();
    });
    syncControls();
  }
  function setKey(k, v) {
    var a = get();
    if (v) a[k] = v; else delete a[k];
    save(a); apply();
  }

  document.addEventListener("input", function (e) {
    var el = e.target; if (!el || !el.getAttribute) return;
    var k = el.getAttribute("data-acap");
    if (k && el.type === "color") setKey(k, el.value);
  });
  document.addEventListener("change", function (e) {
    var el = e.target; if (!el || !el.getAttribute) return;
    var k = el.getAttribute("data-acap");
    if (k && el.tagName === "SELECT") setKey(k, el.value);
  });
  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-acap-preset],[data-acap-reset]") : null;
    if (!t) return;
    if (t.hasAttribute("data-acap-reset")) { try { localStorage.removeItem(KEY); } catch (x) {} apply(); return; }
    var p = PRESETS[+t.getAttribute("data-acap-preset")];
    var a = get(); a.sbBg = p[0]; a.sbText = p[1]; save(a); apply();
  });

  /* ---------- styles for the card (neutral, works on any site/theme) ---------- */
  var base = document.createElement("style");
  base.id = "acap-base";
  base.textContent =
    ".acap-card{border:1px solid rgba(128,128,128,.28);border-radius:10px;padding:18px 20px;max-width:560px;background:transparent;color:inherit;margin-bottom:16px}" +
    ".acap-head{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(128,128,128,.22);padding-bottom:10px;margin-bottom:14px}" +
    ".acap-head h3{margin:0;font-size:15px;font-weight:700}" +
    ".acap-tag{font-size:11px;padding:2px 8px;border-radius:5px;background:rgba(128,128,128,.16)}" +
    ".acap-body{display:flex;flex-direction:column;gap:14px}" +
    ".acap-l{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.7;margin-bottom:5px}" +
    ".acap-row{display:flex;align-items:center;gap:10px}" +
    ".acap-row input[type=color]{width:56px;height:36px;padding:2px;border:1px solid rgba(128,128,128,.4);border-radius:6px;background:transparent;cursor:pointer}" +
    ".acap-v{font-size:12px;opacity:.65}" +
    ".acap-sws{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}" +
    ".acap-sw{width:26px;height:26px;border-radius:50%;border:2px solid rgba(128,128,128,.45);padding:0;cursor:pointer}" +
    ".acap-sw:hover{transform:scale(1.12)}" +
    ".acap-card select{width:100%;padding:8px 10px;border:1px solid rgba(128,128,128,.4);border-radius:7px;background:transparent;color:inherit;font-size:13px}" +
    ".acap-card select option,.acap-card select optgroup{color:#222;background:#fff}" +
    ".acap-reset{width:100%;padding:9px 12px;border:1px solid rgba(128,128,128,.45);border-radius:7px;background:transparent;color:inherit;font-size:13px;cursor:pointer}" +
    ".acap-reset:hover{background:rgba(128,128,128,.12)}" +
    ".acap-note{margin:0;font-size:11.5px;opacity:.6}";
  (document.head || document.documentElement).appendChild(base);

  /* ---------- boot ---------- */
  apply();
  function boot() {
    mount(); apply();
    try {
      new MutationObserver(function () {
        if (document.querySelector("[data-acacia-appearance]:not([data-acap-ready])")) mount();
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.AcaciaAppearance = { apply: apply, mount: mount, reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} apply(); } };
})();
