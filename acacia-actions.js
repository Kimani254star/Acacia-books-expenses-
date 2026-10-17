/* acacia-actions.js — the same row action buttons Books uses: Preview, Edit, Clone, Delete.
 * Usage inside a table row template:   ${ACX_ACT({ view:"openX('id')", edit:"openEditX('id')", clone:"cloneX('id')", del:"deleteX('id')" })}
 * Each value is the JavaScript to run on click. Leave a key out and that button is not drawn.
 * Clicks never bubble to the row, so rows that open a detail page on click keep working.
 * Used by Sell, CRM, Expenses, Projects and Payroll vol 2 (same file). */
(function (w) {
  'use strict';
  var ICONS = {
    view: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
    clone: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
    del: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>'
  };
  var TITLES = { view: 'Preview', edit: 'Edit', clone: 'Clone', del: 'Delete' };

  var css = document.createElement('style');
  css.textContent =
    '.acx-actions{display:inline-flex;align-items:center;gap:2px;white-space:nowrap}' +
    '.acx-act{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:0;border:0;border-radius:6px;' +
    'background:transparent;color:#4b5563;cursor:pointer;transition:background .12s,color .12s}' +
    '.acx-act:hover{background:rgba(0,0,0,.07);color:#111827}' +
    '.acx-act:focus-visible{outline:2px solid #2563eb;outline-offset:1px}' +
    '.acx-act.acx-view:hover{color:#1d4ed8}.acx-act.acx-edit:hover{color:#047857}.acx-act.acx-clone:hover{color:#b45309}' +
    '.acx-act.acx-del{color:#b91c1c}.acx-act.acx-del:hover{background:#fee2e2;color:#991b1b}' +
    'td.acx-cell,th.acx-cell{text-align:right;width:1%;white-space:nowrap}';
  (document.head || document.documentElement).appendChild(css);

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  /* returns the button group HTML */
  w.ACX_ACT = function (spec) {
    spec = spec || {};
    var out = '';
    ['view', 'edit', 'clone', 'del'].forEach(function (k) {
      if (!spec[k]) return;
      out += '<button type="button" class="acx-act acx-' + k + '" title="' + TITLES[k] + '" aria-label="' + TITLES[k] + '" ' +
        'onclick="event.stopPropagation();' + esc(spec[k]) + '">' + ICONS[k] + '</button>';
    });
    return '<span class="acx-actions" onclick="event.stopPropagation()">' + out + '</span>';
  };
})(window);
