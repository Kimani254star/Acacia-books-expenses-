/* acacia-actions.js ? the same row action buttons Books uses, in the Books style:
 *   [Edit] [Delete] [Preview] [Share] [More ? ? Email ? Preview Email ? Clone]
 * Usage inside a table row template:
 *   ${ACX_ACT({ view:"openX('id')", edit:"openEditX('id')", clone:"cloneX('id')", del:"deleteX('id')" })}
 * Each value is the JavaScript to run on click. Leave edit / clone / del out and that button is not drawn.
 * Preview, Share, Email and Preview Email are always drawn. When no `view` is given, Preview opens a
 * details card built from the row itself. Email / Preview Email / Share also read the row itself
 * (table headers + cells), so they work on every table without extra wiring.
 * Optional: spec.email = "someone@x.com" pre-fills the recipient; spec.title = "Invoice INV-001" sets the subject.
 * Clicks never bubble to the row, so rows that open a detail page on click keep working.
 * Shared file: Plans, Inventory, Sell, CRM, Expenses, Projects and Payroll (same file). */
(function (w) {
  'use strict';
  if (w.ACX_ACT && w.ACX_ACT.__v3) return;

  var css = document.createElement('style');
  css.textContent =
    '.acx-actions{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;position:relative;flex-wrap:nowrap}' +
    '.acx-act{display:inline-flex;align-items:center;justify-content:center;border:1px solid #1e3a8a;background:#1e3a8a;color:#fff;' +
    'font-weight:700;font-size:12px;line-height:1;padding:6px 7px;border-radius:4px;cursor:pointer;transition:background .12s}' +
    '.acx-act:hover{background:#1e40af}.acx-act:focus-visible{outline:2px solid #2563eb;outline-offset:1px}' +
    '.acx-menu{display:none;position:fixed;min-width:150px;background:#fff;border:1px solid #e5e7eb;' +
    'border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.14);z-index:9999;flex-direction:column;overflow:hidden;text-align:left}' +
    '.acx-menu.open{display:flex}' +
    '.acx-mi{display:block;width:100%;text-align:left;padding:8px 10px;font-size:13px;color:#1e3a8a;background:#fff;border:0;cursor:pointer}' +
    '.acx-mi:hover{background:#1e3a8a;color:#fff}' +
    'td.acx-cell,th.acx-cell{text-align:right;width:1%;white-space:nowrap}' +
    '.acx-ov{position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px}' +
    '.acx-dlg{background:#fff;color:#111827;border-radius:10px;width:100%;max-width:620px;max-height:90vh;overflow:auto;box-shadow:0 20px 50px rgba(0,0,0,.3);font-size:14px}' +
    '.acx-dh{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid #e5e7eb;font-weight:700;font-size:16px;color:#1e3a8a}' +
    '.acx-dh button{border:0;background:transparent;font-size:22px;cursor:pointer;color:#6b7280}' +
    '.acx-db{padding:16px 18px}.acx-df{display:flex;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid #e5e7eb;flex-wrap:wrap}' +
    '.acx-db label{display:block;font-size:12px;font-weight:600;color:#4b5563;margin:10px 0 4px}' +
    '.acx-db input,.acx-db textarea{width:100%;border:1px solid #d1d5db;border-radius:6px;padding:8px 10px;font-size:14px;color:#111827;background:#fff;box-sizing:border-box}' +
    '.acx-db textarea{min-height:170px;font-family:inherit}' +
    '.acx-kv{width:100%;border-collapse:collapse}.acx-kv td{padding:7px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}' +
    '.acx-kv td:first-child{font-weight:600;color:#4b5563;width:38%}' +
    '.acx-btn2{border:1px solid #d1d5db;background:#fff;color:#1e3a8a;font-weight:700;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px}' +
    '.acx-btn2:hover{background:#f1f5f9}.acx-btn1{border:1px solid #1e3a8a;background:#1e3a8a;color:#fff;font-weight:700;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px}' +
    '.acx-btn1:hover{background:#1e40af}' +
    '.acx-mail{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}.acx-mail-h{background:#f8fafc;padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #e5e7eb}' +
    '.acx-mail-b{padding:16px;white-space:pre-wrap;line-height:1.55}';
  (document.head || document.documentElement).appendChild(css);

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function txt(el) { return (el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim(); }
  function appName() {
    var t = (document.title || '').split(/[|\-\u2013\u00b7]/)[0].trim();
    return t || 'Acacia';
  }
  function userName() {
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/session|currentUser/i.test(k)) { var u = JSON.parse(localStorage.getItem(k) || 'null'); if (u && (u.companyName || u.name)) return u.companyName || u.name; } } } catch (e) {}
    return '';
  }

  /* read the row the button sits in \u2192 [{k,v}] */
  function rowData(btn) {
    var tr = btn && btn.closest ? btn.closest('tr') : null;
    if (!tr) return [];
    var table = tr.closest('table');
    var heads = [];
    if (table) {
      var hr = table.querySelector('thead tr') || table.querySelector('tr');
      if (hr && hr !== tr) heads = Array.prototype.map.call(hr.children, txt);
    }
    var out = [];
    Array.prototype.forEach.call(tr.children, function (td, i) {
      if (td.querySelector('.acx-actions')) return;
      var v = txt(td); if (!v) return;
      out.push({ k: heads[i] || ('Field ' + (i + 1)), v: v });
    });
    return out;
  }
  function sectionTitle(btn) {
    var n = btn.closest('table'); var h = null;
    while (n && n !== document.body && !h) {
      var p = n.previousElementSibling;
      while (p && !h) { h = p.matches && p.matches('h1,h2,h3') ? p : (p.querySelector && p.querySelector('h1,h2,h3')); p = p.previousElementSibling; }
      n = n.parentElement;
    }
    return h ? txt(h) : 'Record';
  }
  function recordTitle(data, spec, btn) {
    if (spec.title) return spec.title;
    var first = data[0] ? data[0].v : '';
    return sectionTitle(btn) + (first ? ' \u2014 ' + first : '');
  }
  function plainBody(title, data) {
    var who = userName();
    return 'Hello,\n\nPlease find the details of ' + title + ' below.\n\n' +
      data.map(function (d) { return d.k + ': ' + d.v; }).join('\n') +
      '\n\nKind regards,\n' + (who || appName());
  }
  function guessEmail(data) {
    for (var i = 0; i < data.length; i++) { var m = /[^\s@]+@[^\s@]+\.[^\s@]+/.exec(data[i].v); if (m) return m[0]; }
    return '';
  }
  function fileHtml(title, data) {
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>' +
      '<style>body{font-family:Arial,sans-serif;color:#111827;padding:32px;max-width:720px;margin:auto}h1{color:#1e3a8a;font-size:22px}' +
      'table{width:100%;border-collapse:collapse}td{padding:8px;border-bottom:1px solid #e5e7eb}td:first-child{font-weight:bold;color:#4b5563;width:38%}</style></head><body>' +
      '<h1>' + esc(title) + '</h1><p style="color:#6b7280">' + esc(appName()) + ' \u00b7 ' + new Date().toLocaleString() + '</p><table>' +
      data.map(function (d) { return '<tr><td>' + esc(d.k) + '</td><td>' + esc(d.v) + '</td></tr>'; }).join('') + '</table></body></html>';
  }
  function slug(s) { return String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'record'; }

  /* ---------- dialogs ---------- */
  function dialog(title, body, foot) {
    closeMenus();
    var ov = document.createElement('div'); ov.className = 'acx-ov';
    ov.innerHTML = '<div class="acx-dlg" role="dialog" aria-modal="true"><div class="acx-dh"><span>' + esc(title) + '</span><button type="button" aria-label="Close">&times;</button></div>' +
      '<div class="acx-db">' + body + '</div><div class="acx-df">' + (foot || '') + '</div></div>';
    function close() { ov.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.querySelector('.acx-dh button').onclick = close;
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    ov.close = close;
    return ov;
  }
  function kvTable(data) {
    return data.length ? '<table class="acx-kv">' + data.map(function (d) { return '<tr><td>' + esc(d.k) + '</td><td>' + esc(d.v) + '</td></tr>'; }).join('') + '</table>'
      : '<p style="color:#6b7280">No details to show for this row.</p>';
  }
  function toast(msg) {
    if (typeof w.showNotification === 'function') { try { w.showNotification(msg); return; } catch (e) {} }
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#1e3a8a;color:#fff;padding:10px 16px;border-radius:6px;z-index:10001;font-size:13px;font-weight:600';
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }

  function ctx(btn) {
    var spec = {}; try { spec = JSON.parse(btn.closest('.acx-actions').getAttribute('data-acx') || '{}'); } catch (e) {}
    var data = rowData(btn);
    var title = recordTitle(data, spec, btn);
    return { spec: spec, data: data, title: title, to: spec.email || guessEmail(data) };
  }

  function preview(btn) {
    var c = ctx(btn);
    var ov = dialog('Preview \u2014 ' + c.title, kvTable(c.data),
      '<button type="button" class="acx-btn2" data-a="print">Print</button><button type="button" class="acx-btn2" data-a="share">Share</button><button type="button" class="acx-btn1" data-a="email">Email</button>');
    ov.querySelector('[data-a=print]').onclick = function () { var win = w.open('', '_blank'); if (!win) return; win.document.write(fileHtml(c.title, c.data)); win.document.close(); win.focus(); win.print(); };
    ov.querySelector('[data-a=share]').onclick = function () { ov.close(); share(btn); };
    ov.querySelector('[data-a=email]').onclick = function () { ov.close(); email(btn); };
  }

  function email(btn, startInPreview) {
    var c = ctx(btn);
    var ov = dialog('Email \u2014 ' + c.title,
      '<label>To</label><input type="email" data-f="to" placeholder="customer@example.com" value="' + esc(c.to) + '">' +
      '<label>Subject</label><input data-f="sub" value="' + esc(c.title) + '">' +
      '<label>Message</label><textarea data-f="body">' + esc(plainBody(c.title, c.data)) + '</textarea>',
      '<button type="button" class="acx-btn2" data-a="prev">Preview Email</button><button type="button" class="acx-btn1" data-a="send">Send Email</button>');
    var g = function (f) { return ov.querySelector('[data-f=' + f + ']'); };
    ov.querySelector('[data-a=prev]').onclick = function () { var v = { to: g('to').value, sub: g('sub').value, body: g('body').value }; ov.close(); previewEmail(btn, v); };
    ov.querySelector('[data-a=send]').onclick = function () { if (send(g('to').value, g('sub').value, g('body').value)) ov.close(); };
    if (startInPreview) { ov.close(); previewEmail(btn, { to: c.to, sub: c.title, body: plainBody(c.title, c.data) }); }
  }

  function previewEmail(btn, v) {
    if (!v) { var c = ctx(btn); v = { to: c.to, sub: c.title, body: plainBody(c.title, c.data) }; }
    var ov = dialog('Preview Email',
      '<div class="acx-mail"><div class="acx-mail-h"><div><b>To:</b> ' + (v.to ? esc(v.to) : '<i style="color:#b91c1c">no recipient yet</i>') + '</div>' +
      '<div><b>Subject:</b> ' + esc(v.sub) + '</div></div><div class="acx-mail-b">' + esc(v.body) + '</div></div>',
      '<button type="button" class="acx-btn2" data-a="edit">Edit Email</button><button type="button" class="acx-btn1" data-a="send">Send Email</button>');
    ov.querySelector('[data-a=edit]').onclick = function () {
      ov.close();
      var o2 = dialog('Email', '<label>To</label><input type="email" data-f="to" value="' + esc(v.to) + '"><label>Subject</label><input data-f="sub" value="' + esc(v.sub) + '"><label>Message</label><textarea data-f="body">' + esc(v.body) + '</textarea>',
        '<button type="button" class="acx-btn2" data-a="prev">Preview Email</button><button type="button" class="acx-btn1" data-a="send">Send Email</button>');
      var g = function (f) { return o2.querySelector('[data-f=' + f + ']').value; };
      o2.querySelector('[data-a=prev]').onclick = function () { var nv = { to: g('to'), sub: g('sub'), body: g('body') }; o2.close(); previewEmail(btn, nv); };
      o2.querySelector('[data-a=send]').onclick = function () { if (send(g('to'), g('sub'), g('body'))) o2.close(); };
    };
    ov.querySelector('[data-a=send]').onclick = function () {
      if (!v.to) { ov.querySelector('[data-a=edit]').click(); toast('Add a recipient email first.'); return; }
      if (send(v.to, v.sub, v.body)) ov.close();
    };
  }

  function send(to, sub, body) {
    to = String(to || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { toast('Enter a valid recipient email.'); return false; }
    w.location.href = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent(sub || '') + '&body=' + encodeURIComponent(body || '');
    toast('Opening your email app\u2026');
    return true;
  }

  function share(btn) {
    var c = ctx(btn);
    var text = c.title + '\n\n' + c.data.map(function (d) { return d.k + ': ' + d.v; }).join('\n');
    var name = slug(c.title) + '.html';
    var file = null;
    try { file = new File([fileHtml(c.title, c.data)], name, { type: 'text/html' }); } catch (e) {}
    var ov = dialog('Share \u2014 ' + c.title, kvTable(c.data),
      '<button type="button" class="acx-btn2" data-a="wa">WhatsApp</button><button type="button" class="acx-btn2" data-a="copy">Copy</button>' +
      '<button type="button" class="acx-btn2" data-a="dl">Download File</button><button type="button" class="acx-btn1" data-a="file">Share File</button>');
    ov.querySelector('[data-a=wa]').onclick = function () { w.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); };
    ov.querySelector('[data-a=copy]').onclick = function () {
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast('Copied.'); }, function () {
        var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('Copied.'); } catch (e) {} ta.remove();
      });
    };
    function download() {
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([fileHtml(c.title, c.data)], { type: 'text/html' }));
      a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
    ov.querySelector('[data-a=dl]').onclick = download;
    ov.querySelector('[data-a=file]').onclick = function () {
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: c.title, text: c.title }).catch(function () {});
      } else if (navigator.share) {
        navigator.share({ title: c.title, text: text }).catch(function () {});
      } else { download(); toast('File downloaded \u2014 attach it anywhere to share.'); }
    };
  }

  /* ---------- menu ---------- */
  function closeMenus() { Array.prototype.forEach.call(document.querySelectorAll('.acx-menu.open'), function (m) { m.classList.remove('open'); }); }
  w.addEventListener('scroll', closeMenus, true);
  document.addEventListener('click', function (e) { if (!e.target.closest || !e.target.closest('.acx-more-wrap')) closeMenus(); });

  w.__acx = {
    run: function (btn, k) {
      closeMenus();
      if (k === 'preview') return preview(btn);
      if (k === 'share') return share(btn);
      if (k === 'email') return email(btn);
      if (k === 'pemail') return previewEmail(btn);
    },
    more: function (btn) {
      var m = btn.nextElementSibling, open = m.classList.contains('open');
      closeMenus();
      if (!open) { var r = btn.getBoundingClientRect(); m.classList.add('open'); var mh = m.offsetHeight, mw = m.offsetWidth;
        m.style.top = ((r.bottom + 4 + mh > innerHeight) ? Math.max(4, r.top - mh - 4) : r.bottom + 4) + 'px';
        m.style.left = Math.max(4, r.right - mw) + 'px'; }
    }
  };

  function b(label, js, extraCls) {
    return '<button type="button" class="acx-act ' + (extraCls || '') + '" title="' + label + '" aria-label="' + label + '" onclick="event.stopPropagation();' + esc(js) + '">' + label + '</button>';
  }
  function mi(label, js) {
    return '<button type="button" class="acx-mi" onclick="event.stopPropagation();__acx.run && document.querySelectorAll(\'.acx-menu.open\').forEach(function(m){m.classList.remove(\'open\')});' + esc(js) + '">' + label + '</button>';
  }

  /* returns the Books-style button group HTML */
  var ACX = function (spec) {
    spec = spec || {};
    var meta = {}; if (spec.email) meta.email = spec.email; if (spec.title) meta.title = spec.title;
    var out = '';
    if (spec.edit) out += b('Edit', spec.edit, 'acx-edit');
    if (spec.del) out += b('Delete', spec.del, 'acx-del');
    out += b('Preview', spec.view ? spec.view : '__acx.run(this,\'preview\')', 'acx-view');
    out += b('Share', '__acx.run(this,\'share\')', 'acx-share');
    var menu = mi('Email', '__acx.run(this,\'email\')') + mi('Preview Email', '__acx.run(this,\'pemail\')');
    if (spec.view) menu += mi('Quick Preview', '__acx.run(this,\'preview\')');
    if (spec.clone) menu += mi('Clone', spec.clone);
    out += '<span class="acx-more-wrap" style="position:relative;display:inline-block">' +
      '<button type="button" class="acx-act" onclick="event.stopPropagation();__acx.more(this)">More \u25BE</button>' +
      '<span class="acx-menu">' + menu + '</span></span>';
    return '<span class="acx-actions" data-acx="' + esc(JSON.stringify(meta)) + '" onclick="event.stopPropagation()">' + out + '</span>';
  };
  ACX.__v3 = true;
  w.ACX_ACT = ACX;
})(window);
