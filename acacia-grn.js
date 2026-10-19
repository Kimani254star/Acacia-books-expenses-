/* acacia-grn.js — Goods Received Notes (GRN) for the Acacia Expenses Purchase Hub.
 * Same inputs as Acacia Books "Goods Received": Supplier, GRN Date, Bill, GRN No., Description,
 * Collection Option, Receiving Location, Reference Number, Received By, GRN Track Number,
 * plus received quantities per bill line. Save as Draft / Add GRN.
 * Stored in db.grns (saved and cloud-synced with the rest of the Expenses data).
 * Load after acacia-bills.js. */
(function (w) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var today = function () { return typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10); };
  var toast = function (m) { if (typeof showToast === 'function') showToast(m); else alert(m); };
  var pad = function (n) { return String(n).padStart(5, '0'); };
  var COLLECT = ['Own Transport|Own Transport / Company Vehicle', 'Supplier Delivery', 'G4S Collections', 'Rider / Motorbike', 'Third-Party Courier', 'Postal Service', 'Other'];

  function D() {
    var d = (typeof db !== 'undefined') ? db : null; if (!d) return null;
    if (!Array.isArray(d.grns)) d.grns = [];
    if (!Array.isArray(d.bills)) d.bills = [];
    if (!Array.isArray(d.grnCollectOptions)) d.grnCollectOptions = [];
    if (!Array.isArray(d.grnLocations)) d.grnLocations = [];
    if (!d.nextGrnNo) d.nextGrnNo = 1;
    return d;
  }
  function save() { if (typeof saveDB === 'function') saveDB(); }
  function nextNo() { return 'GRN-' + pad(D().nextGrnNo); }
  function receivedFor(billId, idx, skipId) {
    return D().grns.filter(function (g) { return g.billId === billId && g.status === 'Received' && g.id !== skipId; })
      .reduce(function (s, g) { var l = (g.items || [])[idx]; return s + (l ? Number(l.qtyReceived) || 0 : 0); }, 0);
  }

  function modal(html) {
    var o = $('grnModal'); if (o) o.remove();
    o = document.createElement('div'); o.id = 'grnModal';
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    o.innerHTML = '<div style="background:var(--card,#fff);color:inherit;border-radius:12px;max-width:900px;width:100%;max-height:92vh;overflow:auto;padding:20px">' + html + '</div>';
    o.addEventListener('mousedown', function (e) { if (e.target === o) o.remove(); });
    document.body.appendChild(o);
  }
  w.acxGrnClose = function () { var o = $('grnModal'); if (o) o.remove(); };

  function collectOptions(sel) {
    var list = COLLECT.concat(D().grnCollectOptions);
    return '<option value="">-- Select Collection Option --</option>' + list.map(function (c) {
      var p = c.split('|'), v = p[0], l = p[1] || p[0];
      return '<option value="' + esc(v) + '"' + (sel === v ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('') + '<option value="__add_new__">➕ Add New...</option>';
  }
  function locationOptions(sel) {
    var list = ['Main Store'].concat(D().grnLocations);
    if (sel && list.indexOf(sel) < 0) list.push(sel);
    return '<option value="">-- Select Warehouse --</option>' + list.map(function (l) { return '<option' + (sel === l ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '<option value="__add_new__">➕ Add New...</option>';
  }
  w.acxGrnAddNew = function (el, key, label) {
    if (el.value !== '__add_new__') return;
    var v = (prompt('New ' + label) || '').trim();
    if (!v) { el.value = ''; return; }
    var d = D(); if (d[key].indexOf(v) < 0) d[key].push(v); save();
    var o = document.createElement('option'); o.textContent = v; o.value = v; el.insertBefore(o, el.lastElementChild); el.value = v;
  };

  function supplierOptions(sel) {
    return '<option value="">-- Select Supplier --</option>' + ((D().suppliers) || []).map(function (s) { return '<option value="' + esc(s.id) + '"' + (sel === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('');
  }
  function billOptions(supId, sel) {
    if (!supId) return '<option value="">-- Select Bill --</option>';
    return '<option value="">-- Select Bill --</option>' + D().bills.filter(function (b) { return b.supplierId === supId; })
      .sort(function (a, b) { return String(b.date).localeCompare(a.date); })
      .map(function (b) { return '<option value="' + esc(b.id) + '"' + (sel === b.id ? ' selected' : '') + '>' + esc(b.billNo + ' · ' + b.date + (b.description ? ' · ' + b.description : '')) + '</option>'; }).join('');
  }
  w.acxGrnSupplierChanged = function () { $('grn_bill').innerHTML = billOptions($('grn_sup').value); w.acxGrnBillChanged(); };
  w.acxGrnBillChanged = function (g) {
    var bid = $('grn_bill').value, b = D().bills.find(function (x) { return x.id === bid; }), host = $('grn_items');
    if (!b) { host.innerHTML = '<div class="sub" style="padding:8px 0">Choose a bill to list its items.</div>'; return; }
    if (!$('grn_ref').value) $('grn_ref').value = b.reference || b.billNo;
    if (!$('grn_desc').value && b.description) $('grn_desc').value = b.description;
    var skip = g ? g.id : '';
    host.innerHTML = '<table style="width:100%"><thead><tr><th>Item</th><th style="text-align:right">Billed</th><th style="text-align:right">Already received</th><th>Qty received now</th></tr></thead><tbody>' +
      (b.items || []).map(function (it, i) {
        var done = receivedFor(b.id, i, skip), left = Math.max(0, (Number(it.qty) || 0) - done);
        var cur = g && g.items && g.items[i] ? g.items[i].qtyReceived : left;
        return '<tr><td>' + esc(it.desc) + '</td><td style="text-align:right">' + esc(it.qty) + '</td><td style="text-align:right">' + done + '</td>' +
          '<td><input type="number" min="0" step="any" class="grn-q" data-i="' + i + '" data-max="' + left + '" style="width:110px" value="' + esc(cur) + '"></td></tr>';
      }).join('') + '</tbody></table>';
  };

  w.acxGrnForm = function (id) {
    var d = D(), g = id ? d.grns.find(function (x) { return x.id === id; }) : null; if (id && !g) return;
    var f = function (lbl, inner, full) { return '<div class="field' + (full ? ' full' : '') + '"><label>' + lbl + '</label>' + inner + '</div>'; };
    modal('<h3 style="margin:0 0 12px">' + (g ? 'Edit GRN ' + esc(g.number) : 'Add GRN') + '</h3><div class="form-grid">' +
      f('Supplier', '<select id="grn_sup" onchange="acxGrnSupplierChanged()">' + supplierOptions(g && g.supplierId) + '</select>') +
      f('GRN Date', '<input type="date" id="grn_date" value="' + (g ? g.date : today()) + '">') +
      f('Bill', '<select id="grn_bill" onchange="acxGrnBillChanged()">' + billOptions(g && g.supplierId, g && g.billId) + '</select>') +
      f('GRN No.', '<input id="grn_no" readonly style="opacity:.75" value="' + esc(g ? g.number : nextNo()) + '">') +
      f('Description', '<input id="grn_desc" placeholder="Item Description" value="' + esc(g ? g.description : '') + '">', true) +
      f('Collection Option', '<select id="grn_col" onchange="acxGrnAddNew(this,\'grnCollectOptions\',\'Delivery Option\')">' + collectOptions(g && g.collectionOption) + '</select>') +
      f('Receiving Location', '<select id="grn_loc" onchange="acxGrnAddNew(this,\'grnLocations\',\'Warehouse\')">' + locationOptions(g && g.location) + '</select>') +
      f('Reference Number', '<input id="grn_ref" placeholder="Bill / Reference No." value="' + esc(g ? g.reference : '') + '">') +
      f('Received By', '<input id="grn_rcv" placeholder="Receiver Name" value="' + esc(g ? g.receivedBy : '') + '">') +
      f('GRN Track Number', '<input id="grn_trk" placeholder="Tracking Number / Reference" value="' + esc(g ? g.trackNumber : '') + '">', true) +
      '</div><div style="margin:12px 0 6px;font-weight:600">Items received</div><div id="grn_items"></div>' +
      '<div style="margin-top:14px;display:flex;gap:8px"><span style="flex:1"></span><button class="btn" onclick="acxGrnClose()">Cancel</button>' +
      '<button class="btn" onclick="acxGrnSave(\'' + (g ? g.id : '') + '\',\'Draft\')">Save as Draft</button>' +
      '<button class="btn btn-primary" onclick="acxGrnSave(\'' + (g ? g.id : '') + '\',\'Received\')">Add GRN</button></div>');
    w.acxGrnBillChanged(g);
  };

  w.acxGrnSave = function (id, st) {
    var d = D(), bid = $('grn_bill').value, b = d.bills.find(function (x) { return x.id === bid; });
    if (!$('grn_sup').value || !$('grn_date').value) return toast('Choose a supplier and GRN date');
    if (!b) return toast('Choose the bill these goods belong to');
    var items = [], over = false, any = false;
    [].forEach.call(document.querySelectorAll('#grn_items .grn-q'), function (el) {
      var i = +el.dataset.i, q = parseFloat(el.value) || 0;
      if (q < 0) q = 0; if (q > 0) any = true;
      if (st === 'Received' && q > parseFloat(el.dataset.max) + 1e-9) over = true;
      items[i] = { desc: (b.items[i] || {}).desc || '', qtyBilled: (b.items[i] || {}).qty || 0, qtyReceived: q };
    });
    if (!any) return toast('Enter a received quantity for at least one item');
    if (over) return toast('Received quantity is more than what is still outstanding on the bill');
    var sup = (d.suppliers || []).find(function (s) { return s.id === $('grn_sup').value; });
    var o = {
      supplierId: $('grn_sup').value, supplierName: sup ? sup.name : '', date: $('grn_date').value, billId: b.id, billNo: b.billNo,
      description: $('grn_desc').value.trim(), collectionOption: $('grn_col').value === '__add_new__' ? '' : $('grn_col').value,
      location: $('grn_loc').value === '__add_new__' ? '' : $('grn_loc').value, reference: $('grn_ref').value.trim(),
      receivedBy: $('grn_rcv').value.trim(), trackNumber: $('grn_trk').value.trim(), items: items, status: st
    };
    if (id) { var g = d.grns.find(function (x) { return x.id === id; }); if (!g) return; Object.assign(g, o); }
    else { d.grns.push(Object.assign({ id: 'grn_' + Date.now(), number: nextNo(), createdAt: new Date().toISOString() }, o)); d.nextGrnNo++; }
    save(); w.acxGrnClose(); w.renderGRN(); toast(st === 'Draft' ? 'GRN saved as draft' : 'GRN added');
  };

  w.acxGrnDelete = function (id) {
    var d = D(), g = d.grns.find(function (x) { return x.id === id; }); if (!g) return;
    if (!confirm('Delete ' + g.number + '?')) return;
    d.grns = d.grns.filter(function (x) { return x.id !== id; }); save(); w.renderGRN(); toast('GRN deleted');
  };
  w.acxGrnBulkDelete = function () {
    var ids = [].map.call(document.querySelectorAll('.grn-sel:checked'), function (c) { return c.value; });
    if (!ids.length) return toast('Tick the GRNs to delete');
    if (!confirm('Delete ' + ids.length + ' GRN(s)?')) return;
    var d = D(); d.grns = d.grns.filter(function (x) { return ids.indexOf(x.id) < 0; }); save(); w.renderGRN();
  };
  w.acxGrnView = function (id) {
    var g = D().grns.find(function (x) { return x.id === id; }); if (!g) return;
    var row = function (k, v) { return '<tr><td class="sub" style="width:180px">' + k + '</td><td>' + esc(v || '—') + '</td></tr>'; };
    modal('<h3 style="margin:0 0 12px">Goods Received Note ' + esc(g.number) + '</h3><table style="width:100%">' +
      row('Supplier', g.supplierName) + row('GRN Date', g.date) + row('Bill', g.billNo) + row('Description', g.description) +
      row('Collection Option', g.collectionOption) + row('Receiving Location', g.location) + row('Reference Number', g.reference) +
      row('Received By', g.receivedBy) + row('GRN Track Number', g.trackNumber) + row('Status', g.status) + '</table>' +
      '<div style="margin:12px 0 6px;font-weight:600">Items</div><table style="width:100%"><thead><tr><th>Item</th><th style="text-align:right">Billed</th><th style="text-align:right">Received</th></tr></thead><tbody>' +
      (g.items || []).filter(Boolean).map(function (l) { return '<tr><td>' + esc(l.desc) + '</td><td style="text-align:right">' + esc(l.qtyBilled) + '</td><td style="text-align:right">' + esc(l.qtyReceived) + '</td></tr>'; }).join('') +
      '</tbody></table><div style="margin-top:14px;display:flex;gap:8px"><span style="flex:1"></span><button class="btn" onclick="window.print()">Print</button><button class="btn" onclick="acxGrnForm(\'' + g.id + '\')">Edit</button><button class="btn btn-primary" onclick="acxGrnClose()">Close</button></div>');
  };

  w.renderGRN = function () {
    var d = D(), host = $('grnHost'); if (!d || !host) return;
    var q = (($('grnSearch') || {}).value || '').trim().toLowerCase();
    var list = d.grns.slice().sort(function (a, b) { return String(b.date).localeCompare(a.date) || String(b.number).localeCompare(a.number); });
    $('grnCountLine').textContent = list.length + ' GRN' + (list.length === 1 ? '' : 's');
    if (q) list = list.filter(function (g) { return [g.number, g.supplierName, g.billNo, g.description, g.location, g.reference, g.receivedBy, g.trackNumber].join(' ').toLowerCase().indexOf(q) > -1; });
    if (!list.length) { host.innerHTML = '<div class="empty-state"><div class="title">No goods received yet</div><div class="hint">Record what arrived against a supplier bill — same fields as Goods Received in Books.</div></div>'; return; }
    host.innerHTML = '<table><thead><tr><th><input type="checkbox" onclick="document.querySelectorAll(\'.grn-sel\').forEach(function(c){c.checked=this.checked}.bind(this))"></th><th>GRN No.</th><th>Supplier</th><th>Item</th><th>Date</th><th>Description</th><th>Location</th><th>Reference No.</th><th>Collection Option</th><th>Received By</th><th>Track No.</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map(function (g) {
        var items = (g.items || []).filter(function (l) { return l && l.qtyReceived > 0; }).map(function (l) { return l.desc + ' ×' + l.qtyReceived; }).join(', ');
        return '<tr><td onclick="event.stopPropagation()"><input type="checkbox" class="grn-sel" value="' + g.id + '"></td>' +
          '<td><a href="#" onclick="acxGrnView(\'' + g.id + '\');return false">' + esc(g.number) + '</a></td><td>' + esc(g.supplierName) + '</td><td>' + esc(items) + '</td><td>' + esc(g.date) + '</td><td>' + esc(g.description) + '</td><td>' + esc(g.location) + '</td><td>' + esc(g.reference) + '</td><td>' + esc(g.collectionOption) + '</td><td>' + esc(g.receivedBy) + '</td><td>' + esc(g.trackNumber) + '</td>' +
          '<td><span class="status-pill ' + (g.status === 'Received' ? 'status-paid' : 'status-draft') + '">' + esc(g.status) + '</span></td>' +
          '<td style="white-space:nowrap"><button class="btn btn-sm" onclick="acxGrnForm(\'' + g.id + '\')">Edit</button> <button class="btn btn-sm" onclick="acxGrnDelete(\'' + g.id + '\')">✕</button></td></tr>';
      }).join('') + '</tbody></table>';
  };

  var nav = document.querySelector('.nav-item[data-view="grn"]');
  if (nav) nav.addEventListener('click', function () { w.renderGRN(); });
})(window);
