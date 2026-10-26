/* acacia-bills.js — Bills, Bulk Bills and Recurring Bills for the Acacia Expenses app.
 *
 * They behave exactly like Operational Costs:
 *   - stored in the same Expenses data (db.bills, db.recurringBills), saved and cloud-synced with it
 *   - counted in the Dashboard, Expense Reports and Categories together with Operational Costs
 *   - sent to Books through the same "From other apps" inbox that Payroll and Sell use
 *     (Books posts each bill with its own ledger code: supplier balance, accounts payable, journal)
 * Needs: acacia-bridge.js (queueBills) and Books acacia-app-inbox.js (type "bill"). No new SQL.
 * Load after script.js in index.html. */
(function (w) {
  'use strict';
  var RATES = { '16': 16, '8': 8, '0': 0, 'exempt': 0 };
  var FREQ = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly'], ['yearly', 'Yearly'], ['custom', 'Every N days']];
  var $ = function (id) { return document.getElementById(id); };
  var num = function (v) { return parseFloat(v) || 0; };
  var r2 = function (v) { return Math.round((Number(v) || 0) * 100) / 100; };
  var esc = function (s) { return typeof escapeHtml === 'function' ? escapeHtml(s == null ? '' : String(s)) : String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (v) { return typeof fmtPlain === 'function' ? fmtPlain(v) : r2(v).toLocaleString(); };
  var today = function () { return typeof todayISO === 'function' ? todayISO() : new Date().toISOString().slice(0, 10); };
  var toast = function (m) { if (typeof showToast === 'function') showToast(m); else alert(m); };
  var pad = function (n, w2) { return String(n).padStart(w2 || 5, '0'); };

  function D() {
    var d = (typeof db !== 'undefined') ? db : null; if (!d) return null;
    if (!Array.isArray(d.bills)) d.bills = [];
    if (!Array.isArray(d.recurringBills)) d.recurringBills = [];
    if (!d.nextBillNo) d.nextBillNo = 1;
    if (!d.nextRecNo) d.nextRecNo = 1;
    return d;
  }
  function save() { if (typeof saveDB === 'function') saveDB(); }
  /* a template that came from Books is owned by Books: it makes the bills (they arrive as bills), so Expenses never runs, edits or deletes it */
  function fromBooks(r) { return !!(r && r._bk); }
  function lockedMsg() { toast('This recurring bill comes from Books. Change it in Books and it will update here.'); }
  function sent(b) { var d = D(); return !!(d && d._bkReg && d._bkReg.bill && d._bkReg.bill[b.id]); }
  function addDays(iso, n) { var t = new Date(iso + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  function addMonths(iso, n, anchor) {
    var p = iso.split('-').map(Number), y = p[0], m = p[1] - 1 + n, day = anchor || p[2];
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return y + '-' + pad(m + 1, 2) + '-' + pad(Math.min(day, last), 2);
  }
  function advance(iso, type, days, anchor) {
    if (type === 'daily') return addDays(iso, 1);
    if (type === 'weekly') return addDays(iso, 7);
    if (type === 'monthly') return addMonths(iso, 1, anchor);
    if (type === 'quarterly') return addMonths(iso, 3, anchor);
    if (type === 'yearly') return addMonths(iso, 12, anchor);
    if (type === 'custom') return addDays(iso, Math.max(1, parseInt(days, 10) || 1));
    return null;
  }

  /* ---------- line items ---------- */
  function calcItem(it) {
    var q = num(it.qty), p = num(it.price), sub = r2(q * p), rate = RATES[String(it.taxRate)] || 0;
    return { subtotal: sub, vat: r2(sub * rate / 100) };
  }
  function normItems(items) {
    return (items || []).map(function (it) {
      var c = calcItem(it);
      return { desc: String(it.desc || '').trim(), qty: num(it.qty), price: num(it.price), taxRate: String(it.taxRate == null ? '16' : it.taxRate), subtotal: c.subtotal, vat: c.vat, type: it.type === 'product' ? 'product' : 'service' };
    }).filter(function (it) { return it.desc && it.qty > 0 && it.price >= 0; });
  }
  function totals(items) { var s = 0, v = 0; items.forEach(function (it) { s += it.subtotal; v += it.vat; }); return { subtotal: r2(s), vat: r2(v) }; }

  function makeBill(o) {
    var d = D(), items = normItems(o.items), t = totals(items), rate = num(o.currencyRate) || 1, term = parseInt(o.termDays, 10) || 0;
    var sup = d.suppliers.find(function (s) { return s.id === o.supplierId; });
    var b = {
      id: 'bill_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      billNo: 'BILL-' + pad(d.nextBillNo++), date: o.date || today(), termDays: term, due: addDays(o.date || today(), term),
      supplierId: o.supplierId || null, supplierName: sup ? sup.name : (o.supplierName || ''), category: o.category,
      description: o.description || '', reference: o.reference || '', notes: o.notes || '',
      currency: o.currency || 'KES', currencyRate: rate, items: items, subtotal: t.subtotal, vat: t.vat,
      total: r2((t.subtotal + t.vat) * rate), paidAmount: 0, payments: [], source: o.source || 'bill'
    };
    if (o.recurringId) { b.recurringId = o.recurringId; b.recurringNumber = o.recurringNumber; b.recurringRun = o.recurringRun; }
    return b;
  }
  function status(b) { var p = num(b.paidAmount), t = num(b.total); return t > 0 && p >= t - 0.005 ? 'Paid' : (p > 0 ? 'Partially Paid' : 'Unpaid'); }

  /* ---------- feed Dashboard / Reports / Categories (same as Operational Costs) ---------- */
  w.acxBillRows = function () {
    var d = D(); if (!d) return [];
    return d.bills.map(function (b) {
      var k = num(b.currencyRate) || 1, st = status(b), pct = b.subtotal > 0 ? Math.round(b.vat / b.subtotal * 100) : 0;
      return {
        id: 'bill:' + b.id, expNo: b.billNo, date: b.date, category: b.category, description: b.description || ('Bill ' + b.billNo),
        supplierName: b.supplierName, taxRate: pct, taxAmount: r2(b.vat * k), amount: r2(b.subtotal * k), total: num(b.total),
        status: st === 'Paid' ? 'Paid' : 'Posted', paymentStatus: st === 'Paid' ? 'Paid' : 'Unpaid', _bill: true
      };
    });
  };

  /* ---------- small UI helpers ---------- */
  function modal(id, html) {
    var o = $(id); if (o) o.remove();
    o = document.createElement('div'); o.id = id;
    o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    o.innerHTML = '<div style="background:var(--card,#fff);color:inherit;border-radius:12px;max-width:900px;width:100%;max-height:92vh;overflow:auto;padding:20px">' + html + '</div>';
    o.addEventListener('mousedown', function (e) { if (e.target === o) o.remove(); });
    document.body.appendChild(o); return o;
  }
  function closeModal(id) { var o = $(id); if (o) o.remove(); }
  function supplierOptions(sel) { return (D().suppliers || []).map(function (s) { return '<option value="' + esc(s.id) + '"' + (sel === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join(''); }
  /* Same list as Books' bill "Chart of account" box: Books accounts of the bill types, sorted by code, shown as "Name (code)".
     Until Books has been read once, the Expenses categories are used instead. */
  function accountOptions(sel) {
    var d = D(), ba = (d && d.billAccounts) || [], seen = {};
    if (!ba.length) return allCategoryNames().map(function (c) { return '<option' + (sel === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
    var o = ba.map(function (a) { seen[a.name] = 1; return '<option value="' + esc(a.name) + '"' + (sel === a.name ? ' selected' : '') + '>' + esc(a.name) + ' (' + esc(a.code || '-') + ')</option>'; });
    if (sel && !seen[sel]) o.unshift('<option value="' + esc(sel) + '" selected>' + esc(sel) + ' (not in Books)</option>');
    return '<option value="">Select Account</option>' + o.join('');
  }
  function bankOptions(sel) {
    var d = D(), bl = (d && d.booksBanks) || [];
    if (!bl.length) return '<option value="">(no bank accounts from Books yet)</option>';
    return '<option value="">Select Bank</option>' + bl.map(function (b) { return '<option value="' + esc(b.name) + '"' + (sel === b.name ? ' selected' : '') + '>' + esc(b.name) + (b.currency ? ' (' + esc(b.currency) + ' ' + money(b.balance) + ')' : '') + '</option>'; }).join('');
  }
  function vatOptions(sel) { return [['16', '16%'], ['8', '8%'], ['0', 'Zero'], ['exempt', 'Exempt']].map(function (o) { return '<option value="' + o[0] + '"' + (String(sel) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); }
  function currencyOptions(sel) { return ['KES', 'USD', 'EUR', 'GBP', 'UGX', 'TZS'].map(function (c) { return '<option' + (sel === c ? ' selected' : '') + '>' + c + '</option>'; }).join(''); }
  var inp = 'style="width:100%"';

  function itemRow(it) {
    it = it || { desc: '', qty: 1, price: '', taxRate: '16' };
    return '<tr><td><input class="bi-desc" ' + inp + ' value="' + esc(it.desc) + '" placeholder="Description"></td>' +
      '<td><input type="number" min="0" step="any" class="bi-qty" style="width:80px" value="' + esc(it.qty) + '"></td>' +
      '<td><input type="number" min="0" step="any" class="bi-price" style="width:110px" value="' + esc(it.price) + '"></td>' +
      '<td><select class="bi-vat">' + vatOptions(it.taxRate) + '</select></td>' +
      '<td class="bi-amt num" style="text-align:right;white-space:nowrap">0.00</td>' +
      '<td><button type="button" class="btn btn-sm" onclick="this.closest(\'tr\').remove();acxBillTotals()">✕</button></td></tr>';
  }
  function itemsTable(items) {
    return '<table style="width:100%"><thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>VAT</th><th style="text-align:right">Amount</th><th></th></tr></thead><tbody id="biBody">' +
      (items && items.length ? items : [null]).map(itemRow).join('') + '</tbody></table>' +
      '<div style="margin-top:8px;display:flex;gap:8px;align-items:center"><button type="button" class="btn btn-sm" onclick="acxBillAddRow()">+ Add line</button><span style="flex:1"></span><span id="biSum" style="font-weight:600"></span></div>';
  }
  function readItems() {
    return [].map.call(document.querySelectorAll('#biBody tr'), function (tr) {
      return { desc: tr.querySelector('.bi-desc').value, qty: tr.querySelector('.bi-qty').value, price: tr.querySelector('.bi-price').value, taxRate: tr.querySelector('.bi-vat').value };
    });
  }
  w.acxBillAddRow = function () { var t = document.createElement('tbody'); t.innerHTML = itemRow(); $('biBody').appendChild(t.firstChild); acxBillTotals(); };
  w.acxBillTotals = function () {
    var rows = document.querySelectorAll('#biBody tr'), s = 0, v = 0;
    [].forEach.call(rows, function (tr) {
      var c = calcItem({ qty: tr.querySelector('.bi-qty').value, price: tr.querySelector('.bi-price').value, taxRate: tr.querySelector('.bi-vat').value });
      tr.querySelector('.bi-amt').textContent = money(c.subtotal + c.vat); s += c.subtotal; v += c.vat;
    });
    var el = $('biSum'); if (el) el.textContent = 'Subtotal ' + money(s) + ' · VAT ' + money(v) + ' · Total ' + money(s + v);
  };
  function wireItems(id) { var m = $(id); m.addEventListener('input', function (e) { if (e.target.closest('#biBody')) acxBillTotals(); }); m.addEventListener('change', function (e) { if (e.target.closest('#biBody')) acxBillTotals(); }); acxBillTotals(); }

  /* ---------- BILLS ---------- */
  function listShell(host, title, count, rowsHtml, head, empty) {
    $(host).innerHTML = rowsHtml ? '<table><thead><tr>' + head + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>' : '<div class="empty-state"><div class="title">' + esc(title) + '</div><div class="hint">' + esc(empty) + '</div></div>';
  }
  function badge(b) { return sent(b) ? '<span class="status-pill status-posted" style="font-size:10px">In Books inbox</span>' : '<span class="status-pill status-draft" style="font-size:10px">Sending…</span>'; }
  function payPill(b) { var s = status(b); return '<span class="status-pill ' + (s === 'Paid' ? 'status-paid' : s === 'Unpaid' ? 'status-pending' : 'status-approved') + '">' + s + '</span>'; }

  w.renderBills = function () {
    var d = D(); if (!d || !$('billsHost')) return;
    var q = ($('billFilterText') || {}).value; q = (q || '').trim().toLowerCase();
    var st = ($('billFilterStatus') || {}).value || '';
    var list = d.bills.filter(function (b) { return b.source !== 'bulk'; }).slice().sort(function (a, b) { return String(b.date).localeCompare(a.date) || b.billNo.localeCompare(a.billNo); });
    var all = list.length;
    if (q) list = list.filter(function (b) { return (b.billNo + ' ' + b.supplierName + ' ' + b.description + ' ' + b.category + ' ' + (b.reference || '')).toLowerCase().indexOf(q) > -1; });
    if (st) list = list.filter(function (b) { return status(b) === st; });
    $('billCountLine').textContent = all + ' bill' + (all === 1 ? '' : 's') + (d.bills.some(function (b) { return b.source === 'recurring'; }) ? ' (includes bills made by recurring templates)' : '');
    var rows = list.map(function (b) {
      return '<tr onclick="acxBillView(\'' + b.id + '\')"><td>' + fmtDate(b.date) + '</td><td>' + esc(b.billNo) + (b.source === 'recurring' ? ' <span class="sub">↻</span>' : '') + '</td>' +
        '<td class="desc-cell"><div class="title">' + esc(b.description || '—') + '</div>' + (b.reference ? '<div class="sub">Ref: ' + esc(b.reference) + '</div>' : '') + '</td>' +
        '<td>' + esc(b.supplierName || '—') + '</td><td>' + esc(b.category) + '</td><td>' + fmtDate(b.due) + '</td>' +
        '<td class="num">' + money(b.total) + '</td><td>' + payPill(b) + '</td><td>' + badge(b) + '</td>' +
        '<td class="acx-cell">' + ACX_ACT({ view: "acxBillView('" + b.id + "')", edit: sent(b) ? undefined : "acxBillForm('" + b.id + "')", clone: "acxBillClone('" + b.id + "')", del: "acxBillDelete('" + b.id + "')" }) + '</td></tr>';
    }).join('');
    listShell('billsHost', 'No bills recorded', all, rows, '<th>Date</th><th>Bill #</th><th>Description</th><th>Supplier</th><th>Account</th><th>Due</th><th style="text-align:right">Total</th><th>Payment</th><th>Books</th><th></th>',
      all ? 'No bills match this filter.' : 'Bills you record here count in the Dashboard and Reports and go to Books for posting.');
  };

  w.acxBillForm = function (id) {
    var d = D(), b = id ? d.bills.find(function (x) { return x.id === id; }) : null; if (id && !b) return;
    modal('billModal', '<h3 style="margin:0 0 12px">' + (b ? 'Edit Bill ' + esc(b.billNo) : 'New Bill') + '</h3>' +
      '<div class="form-grid">' +
      '<div class="field"><label>Supplier</label><select id="bm_sup"><option value="">Select supplier...</option>' + supplierOptions(b && b.supplierId) + '</select></div>' +
      '<div class="field"><label>Bill date</label><input type="date" id="bm_date" value="' + (b ? b.date : today()) + '"></div>' +
      '<div class="field"><label>Expense account</label><select id="bm_acc">' + accountOptions(b && b.category) + '</select></div>' +
      '<div class="field"><label>Payment terms (days)</label><input type="number" min="0" id="bm_term" value="' + (b ? b.termDays : 0) + '"></div>' +
      '<div class="field"><label>Currency</label><select id="bm_cur">' + currencyOptions(b ? b.currency : 'KES') + '</select></div>' +
      '<div class="field"><label>Rate to KES</label><input type="number" min="0" step="any" id="bm_rate" value="' + (b ? b.currencyRate : 1) + '"></div>' +
      '<div class="field full"><label>Description</label><input id="bm_desc" value="' + esc(b ? b.description : '') + '" placeholder="e.g. Office rent — October"></div>' +
      '<div class="field full"><label>Reference / LPO</label><input id="bm_ref" value="' + esc(b ? b.reference : '') + '"></div></div>' +
      '<div style="margin:12px 0 6px;font-weight:600">Items</div>' + itemsTable(b && b.items) +
      '<div style="margin-top:14px;display:flex;gap:8px"><span style="flex:1"></span><button class="btn" onclick="closeModal_acx(\'billModal\')">Cancel</button><button class="btn btn-primary" onclick="acxBillSave(\'' + (b ? b.id : '') + '\')">Save Bill</button></div>');
    wireItems('billModal');
  };
  w.closeModal_acx = closeModal;

  function readBillForm() {
    return { supplierId: $('bm_sup').value, date: $('bm_date').value, category: $('bm_acc').value, termDays: $('bm_term').value, currency: $('bm_cur').value, currencyRate: $('bm_rate').value, description: $('bm_desc').value.trim(), reference: $('bm_ref').value.trim(), items: readItems() };
  }
  w.acxBillSave = function (id) {
    var d = D(), o = readBillForm();
    if (!o.supplierId || !o.date || !o.category || !normItems(o.items).length) return toast('Choose a supplier, date, account and add at least one line');
    if (id) {
      var b = d.bills.find(function (x) { return x.id === id; }); if (!b) return;
      var n = makeBill(o); d.nextBillNo--;                                    /* keep the original number */
      ['date', 'termDays', 'due', 'supplierId', 'supplierName', 'category', 'description', 'reference', 'currency', 'currencyRate', 'items', 'subtotal', 'vat', 'total'].forEach(function (k) { b[k] = n[k]; });
      toast('Bill updated');
    } else { d.bills.push(makeBill(o)); toast('Bill saved'); }
    save(); closeModal('billModal'); refreshAll();
  };
  w.acxBillClone = function (id) {
    var d = D(), b = d.bills.find(function (x) { return x.id === id; }); if (!b) return;
    var n = makeBill({ supplierId: b.supplierId, supplierName: b.supplierName, date: today(), category: b.category, termDays: b.termDays, currency: b.currency, currencyRate: b.currencyRate, description: b.description, reference: '', items: b.items, source: b.source === 'bulk' ? 'bulk' : 'bill' });
    d.bills.push(n); save(); refreshAll(); toast('Bill cloned as ' + n.billNo);
  };
  w.acxBillDelete = function (id) {
    var d = D(), b = d.bills.find(function (x) { return x.id === id; }); if (!b) return;
    if (!confirm('Delete bill ' + b.billNo + '?' + (sent(b) ? '\n\nIt was already sent to Books. Deleting it here does NOT remove it from Books — delete it there too if it was posted.' : ''))) return;
    d.bills = d.bills.filter(function (x) { return x.id !== id; }); save(); refreshAll(); toast('Bill deleted');
  };
  w.acxBillView = function (id) {
    var d = D(), b = d.bills.find(function (x) { return x.id === id; }); if (!b) return;
    var rows = b.items.map(function (it) { return '<tr><td>' + esc(it.desc) + '</td><td>' + it.qty + '</td><td class="num">' + money(it.price) + '</td><td>' + (it.taxRate === 'exempt' ? 'Exempt' : it.taxRate + '%') + '</td><td class="num">' + money(it.subtotal + it.vat) + '</td></tr>'; }).join('');
    var pays = (b.payments || []).map(function (p) { return '<div style="font-size:13px">' + fmtDate(p.date) + ' · ' + esc(p.method || '') + (p.bank ? ' · ' + esc(p.bank) : '') + ' · <b>' + money(p.amount) + '</b></div>'; }).join('');
    var bal = r2(b.total - num(b.paidAmount));
    modal('billModal', '<h3 style="margin:0 0 4px">' + esc(b.billNo) + ' ' + payPill(b) + '</h3><div style="color:var(--ink-soft);margin-bottom:10px">' + esc(b.supplierName) + ' · ' + fmtDate(b.date) + ' · due ' + fmtDate(b.due) + ' · ' + esc(b.category) + (b.source !== 'bill' ? ' · ' + b.source : '') + '</div>' +
      '<table style="width:100%"><thead><tr><th>Description</th><th>Qty</th><th style="text-align:right">Price</th><th>VAT</th><th style="text-align:right">Amount</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div style="text-align:right;margin-top:8px">Subtotal ' + money(b.subtotal) + ' · VAT ' + money(b.vat) + '<br><b>Total ' + esc(b.currency) + ' ' + money(b.subtotal + b.vat) + (b.currencyRate !== 1 ? ' (KES ' + money(b.total) + ')' : '') + '</b><br>Paid ' + money(b.paidAmount) + ' · Balance <b>' + money(bal) + '</b></div>' +
      (pays ? '<div style="margin-top:10px"><b>Payments</b>' + pays + '</div>' : '') +
      '<div style="margin-top:10px;font-size:12px;color:var(--ink-soft)">' + (sent(b) ? 'Sent to Books. Post it from the "From other apps" box in Books. Its payments go to the same box once the bill is posted.' : 'Waiting to be sent to Books (needs the same company login as Books).') + '</div>' +
      '<div style="margin-top:14px;display:flex;gap:8px"><span style="flex:1"></span><button class="btn" onclick="closeModal_acx(\'billModal\')">Close</button>' + (bal > 0.005 ? '<button class="btn btn-primary" onclick="acxBillPay(\'' + b.id + '\')">Record payment</button>' : '') + '</div>');
  };
  w.acxBillPay = function (id) {
    var d = D(), b = d.bills.find(function (x) { return x.id === id; }); if (!b) return;
    var bal = r2(b.total - num(b.paidAmount));
    modal('billPayModal', '<h3 style="margin:0 0 4px">Record payment for ' + esc(b.billNo) + '</h3><div style="color:var(--ink-soft);margin-bottom:10px">' + esc(b.supplierName) + ' · balance ' + money(bal) + ' KES</div>' +
      '<div class="form-grid"><div class="field"><label>Date</label><input type="date" id="bp_date" value="' + today() + '"></div>' +
      '<div class="field"><label>Amount (KES)</label><input type="number" min="0.01" step="0.01" id="bp_amt" value="' + bal + '"></div>' +
      '<div class="field"><label>Bank (from Books)</label><select id="bp_bank">' + bankOptions() + '</select></div>' +
      '<div class="field"><label>Payment mode</label><select id="bp_mode"><option>Bank Transfer</option><option>Cash</option><option>M-Pesa</option><option>Cheque</option><option>Card</option></select></div></div>' +
      '<div style="margin-top:14px;display:flex;gap:8px"><span style="flex:1"></span><button class="btn" onclick="closeModal_acx(\'billPayModal\')">Cancel</button><button class="btn btn-primary" onclick="acxBillPaySave(\'' + b.id + '\')">Record payment</button></div>');
    document.getElementById('billPayModal').style.zIndex = 10001;
  };
  w.acxBillPaySave = function (id) {
    var d = D(), b = d.bills.find(function (x) { return x.id === id; }); if (!b) return;
    var bal = r2(b.total - num(b.paidAmount)), a = r2($('bp_amt').value), bank = $('bp_bank').value, bk = ((d.booksBanks || []).filter(function (x) { return x.name === bank; })[0]) || null;
    if (!(a > 0) || a > bal + 0.005) return toast('Enter an amount up to the balance (' + money(bal) + ')');
    if ((d.booksBanks || []).length && !bank) return toast('Choose the bank the payment came from');
    b.paidAmount = r2(num(b.paidAmount) + a);
    (b.payments = b.payments || []).push({ id: 'pay_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), date: $('bp_date').value || today(), amount: a, method: $('bp_mode').value, bank: bank, bankCurrency: bk ? bk.currency : '' });
    save(); closeModal('billPayModal'); closeModal('billModal'); refreshAll(); toast('Payment recorded' + (bank ? ' — sent to Books to post from ' + bank : ''));
  };

  /* ---------- BULK BILLS (one bill per selected supplier, like Books) ---------- */
  w.renderBulkBills = function () {
    var d = D(); if (!d || !$('bulkBillsHost')) return;
    var list = d.bills.filter(function (b) { return b.source === 'bulk'; }).slice().sort(function (a, b) { return String(b.date).localeCompare(a.date) || b.billNo.localeCompare(a.billNo); });
    $('bulkBillCountLine').textContent = list.length + ' bulk bill' + (list.length === 1 ? '' : 's');
    var rows = list.map(function (b) {
      return '<tr onclick="acxBillView(\'' + b.id + '\')"><td>' + fmtDate(b.date) + '</td><td>' + esc(b.billNo) + '</td><td>' + esc(b.supplierName) + '</td><td>' + esc(b.category) + '</td><td>' + b.items.length + '</td><td class="num">' + money(b.total) + '</td><td>' + payPill(b) + '</td><td>' + badge(b) + '</td>' +
        '<td class="acx-cell">' + ACX_ACT({ view: "acxBillView('" + b.id + "')", clone: "acxBillClone('" + b.id + "')", del: "acxBillDelete('" + b.id + "')" }) + '</td></tr>';
    }).join('');
    listShell('bulkBillsHost', 'No bulk bills', list.length, rows, '<th>Date</th><th>Bill #</th><th>Supplier</th><th>Account</th><th>Lines</th><th style="text-align:right">Total</th><th>Payment</th><th>Books</th><th></th>', 'Raise the same bill for several suppliers at once.');
  };
  w.acxBulkBillForm = function () {
    modal('billModal', '<h3 style="margin:0 0 12px">New Bulk Bill</h3><div style="font-size:12px;color:var(--ink-soft);margin-bottom:8px">One bill is created for every supplier you select, each with the lines below.</div>' +
      '<div class="form-grid">' +
      '<div class="field full"><label>Suppliers (hold Ctrl / Cmd to select several)</label><select id="bm_sups" multiple size="6">' + supplierOptions() + '</select></div>' +
      '<div class="field"><label>Bill date</label><input type="date" id="bm_date" value="' + today() + '"></div>' +
      '<div class="field"><label>Expense account</label><select id="bm_acc">' + accountOptions() + '</select></div>' +
      '<div class="field"><label>Payment terms (days)</label><input type="number" min="0" id="bm_term" value="0"></div>' +
      '<div class="field"><label>Currency</label><select id="bm_cur">' + currencyOptions('KES') + '</select></div>' +
      '<div class="field"><label>Rate to KES</label><input type="number" min="0" step="any" id="bm_rate" value="1"></div>' +
      '<div class="field full"><label>Description</label><input id="bm_desc" placeholder="e.g. Monthly service charge"></div></div>' +
      '<div style="margin:12px 0 6px;font-weight:600">Items</div>' + itemsTable() +
      '<div style="margin-top:14px;display:flex;gap:8px"><span style="flex:1"></span><button class="btn" onclick="closeModal_acx(\'billModal\')">Cancel</button><button class="btn btn-primary" onclick="acxBulkBillSave()">Save Bulk Bill</button></div>');
    wireItems('billModal');
  };
  w.acxBulkBillSave = function () {
    var d = D(), sups = [].map.call($('bm_sups').selectedOptions, function (o) { return o.value; }).filter(Boolean);
    var base = { date: $('bm_date').value, category: $('bm_acc').value, termDays: $('bm_term').value, currency: $('bm_cur').value, currencyRate: $('bm_rate').value, description: $('bm_desc').value.trim(), items: readItems(), source: 'bulk' };
    if (!sups.length || !base.date || !base.category || !normItems(base.items).length) return toast('Select at least one supplier, a date, an account and one line');
    sups.forEach(function (sid) { d.bills.push(makeBill(Object.assign({}, base, { supplierId: sid }))); });
    save(); closeModal('billModal'); refreshAll(); toast(sups.length + ' bill' + (sups.length === 1 ? '' : 's') + ' saved');
  };

  /* ---------- RECURRING BILLS ---------- */
  w.renderRecurring = function () {
    var d = D(); if (!d || !$('recurringHost')) return;
    var list = d.recurringBills.slice().sort(function (a, b) { return String(a.nextDate || '9999').localeCompare(b.nextDate || '9999'); });
    $('recurringCountLine').textContent = list.length + ' template' + (list.length === 1 ? '' : 's') + ' · ' + list.filter(function (r) { return r.status === 'Active'; }).length + ' active';
    var rows = list.map(function (r) {
      var t = totals(normItems(r.items)), fq = (FREQ.filter(function (f) { return f[0] === r.recurrenceType; })[0] || [0, r.recurrenceType])[1];
      return '<tr><td>' + esc(r.number) + '</td><td>' + esc(r.supplierName) + '</td><td class="desc-cell"><div class="title">' + esc(r.description || '—') + '</div><div class="sub">' + esc(r.category) + '</div></td>' +
        '<td>' + esc(fq) + (r.recurrenceType === 'custom' ? ' (' + r.recurrenceDays + ')' : '') + '</td><td>' + (r.nextDate ? fmtDate(r.nextDate) : '—') + '</td><td>' + (r.endDate ? fmtDate(r.endDate) : '—') + '</td>' +
        '<td class="num">' + money((t.subtotal + t.vat) * (num(r.currencyRate) || 1)) + '</td><td>' + (r.generated || 0) + '</td>' +
        '<td><span class="status-pill ' + (r.status === 'Active' ? 'status-approved' : r.status === 'Paused' ? 'status-pending' : 'status-paid') + '">' + r.status + '</span></td>' +
        '<td class="acx-cell">' + ACX_ACT({ view: "acxRecView('" + r.id + "')", edit: "acxRecForm('" + r.id + "')", clone: "acxRecClone('" + r.id + "')", del: "acxRecDelete('" + r.id + "')" }) + '</td></tr>';
    }).join('');
    listShell('recurringHost', 'No recurring bills', list.length, rows, '<th>#</th><th>Supplier</th><th>Description</th><th>Repeats</th><th>Next bill</th><th>Ends</th><th style="text-align:right">Amount</th><th>Made</th><th>Status</th><th></th>', 'Set up rent, subscriptions or retainers once — a real bill is created each time one is due.');
  };
  w.acxRecForm = function (id) {
    var d = D(), r = id ? d.recurringBills.find(function (x) { return x.id === id; }) : null; if (id && !r) return;
    if (fromBooks(r)) return lockedMsg();
    modal('billModal', '<h3 style="margin:0 0 12px">' + (r ? 'Edit Recurring Bill ' + esc(r.number) : 'New Recurring Bill') + '</h3>' +
      '<div class="form-grid">' +
      '<div class="field"><label>Supplier</label><select id="bm_sup"><option value="">Select supplier...</option>' + supplierOptions(r && r.supplierId) + '</select></div>' +
      '<div class="field"><label>Expense account</label><select id="bm_acc">' + accountOptions(r && r.category) + '</select></div>' +
      '<div class="field"><label>First bill date</label><input type="date" id="bm_date" value="' + (r ? r.date : today()) + '"></div>' +
      '<div class="field"><label>Repeats</label><select id="bm_freq" onchange="document.getElementById(\'bm_days_f\').style.display=this.value===\'custom\'?\'\':\'none\'">' + FREQ.map(function (f) { return '<option value="' + f[0] + '"' + ((r ? r.recurrenceType : 'monthly') === f[0] ? ' selected' : '') + '>' + f[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="field" id="bm_days_f" style="' + (r && r.recurrenceType === 'custom' ? '' : 'display:none') + '"><label>Every N days</label><input type="number" min="1" id="bm_days" value="' + (r ? r.recurrenceDays || 30 : 30) + '"></div>' +
      '<div class="field"><label>End date (optional)</label><input type="date" id="bm_end" value="' + (r ? r.endDate || '' : '') + '"></div>' +
      '<div class="field"><label>Payment terms (days)</label><input type="number" min="0" id="bm_term" value="' + (r ? r.termDays : 0) + '"></div>' +
      '<div class="field"><label>Currency</label><select id="bm_cur">' + currencyOptions(r ? r.currency : 'KES') + '</select></div>' +
      '<div class="field"><label>Rate to KES</label><input type="number" min="0" step="any" id="bm_rate" value="' + (r ? r.currencyRate : 1) + '"></div>' +
      '<div class="field full"><label>Description</label><input id="bm_desc" value="' + esc(r ? r.description : '') + '" placeholder="e.g. Office rent"></div></div>' +
      '<div style="margin:12px 0 6px;font-weight:600">Items</div>' + itemsTable(r && r.items) +
      '<div style="margin-top:14px;display:flex;gap:8px"><span style="flex:1"></span><button class="btn" onclick="closeModal_acx(\'billModal\')">Cancel</button><button class="btn btn-primary" onclick="acxRecSave(\'' + (r ? r.id : '') + '\')">Save Template</button></div>');
    wireItems('billModal');
  };
  w.acxRecSave = function (id) {
    var d = D(), o = { supplierId: $('bm_sup').value, category: $('bm_acc').value, date: $('bm_date').value, recurrenceType: $('bm_freq').value, recurrenceDays: $('bm_days').value, endDate: $('bm_end').value, termDays: parseInt($('bm_term').value, 10) || 0, currency: $('bm_cur').value, currencyRate: num($('bm_rate').value) || 1, description: $('bm_desc').value.trim(), items: normItems(readItems()) };
    if (!o.supplierId || !o.date || !o.category || !o.items.length) return toast('Choose a supplier, account, start date and add at least one line');
    if (o.endDate && o.endDate < o.date) return toast('End date is before the first bill date');
    var sup = d.suppliers.find(function (s) { return s.id === o.supplierId; }); o.supplierName = sup ? sup.name : '';
    if (id) {
      var r = d.recurringBills.find(function (x) { return x.id === id; }); if (!r) return;
      if (fromBooks(r)) return lockedMsg();
      var startChanged = r.date !== o.date || r.recurrenceType !== o.recurrenceType;
      Object.assign(r, o);
      if (startChanged && !(r.generated > 0)) r.nextDate = o.date;
      if (r.status === 'Completed' && (!r.endDate || (r.nextDate && r.nextDate <= r.endDate))) r.status = 'Active';
      toast('Template updated');
    } else {
      d.recurringBills.push(Object.assign({ id: 'rec_' + Date.now(), number: 'REC-' + pad(d.nextRecNo++), nextDate: o.date, status: 'Active', generated: 0 }, o)); toast('Recurring bill saved');
    }
    save(); closeModal('billModal'); runRecurring(); refreshAll();
  };
  w.acxRecClone = function (id) {
    var d = D(), r = d.recurringBills.find(function (x) { return x.id === id; }); if (!r) return;
    var n = JSON.parse(JSON.stringify(r)); delete n._bk; delete n.source; n.id = 'rec_' + Date.now(); n.number = 'REC-' + pad(d.nextRecNo++); n.date = today(); n.nextDate = today(); n.generated = 0; n.lastGenerated = ''; n.status = 'Paused';
    d.recurringBills.push(n); save(); refreshAll(); toast('Cloned as ' + n.number + ' (paused until you resume it)');
  };
  w.acxRecDelete = function (id) {
    var d = D(), r = d.recurringBills.find(function (x) { return x.id === id; }); if (!r) return;
    if (fromBooks(r)) return lockedMsg();
    if (!confirm('Delete recurring bill ' + r.number + '? Bills it already created stay.')) return;
    d.recurringBills = d.recurringBills.filter(function (x) { return x.id !== id; }); save(); refreshAll(); toast('Template deleted');
  };
  w.acxRecToggle = function (id) {
    var d = D(), r = d.recurringBills.find(function (x) { return x.id === id; }); if (!r || r.status === 'Completed') return;
    if (fromBooks(r)) return lockedMsg();
    r.status = r.status === 'Active' ? 'Paused' : 'Active'; save(); if (r.status === 'Active') runRecurring(); closeModal('billModal'); refreshAll();
  };
  w.acxRecView = function (id) {
    var d = D(), r = d.recurringBills.find(function (x) { return x.id === id; }); if (!r) return;
    var made = d.bills.filter(function (b) { return b.recurringId === r.id; }).sort(function (a, b) { return String(b.date).localeCompare(a.date); });
    modal('billModal', '<h3 style="margin:0 0 4px">' + esc(r.number) + ' · ' + esc(r.supplierName) + '</h3><div style="color:var(--ink-soft);margin-bottom:10px">' + esc(r.description || '') + ' · next ' + (r.nextDate ? fmtDate(r.nextDate) : '—') + ' · ' + r.status + (fromBooks(r) ? ' · managed in Books' : '') + '</div>' +
      '<b>Bills created (' + made.length + ')</b>' + (made.map(function (b) { return '<div style="font-size:13px;padding:4px 0;border-bottom:1px solid var(--line-soft)">' + fmtDate(b.date) + ' · ' + esc(b.billNo) + ' · ' + money(b.total) + ' · ' + status(b) + '</div>'; }).join('') || '<div style="font-size:13px;color:var(--ink-soft)">None yet.</div>') +
      '<div style="margin-top:14px;display:flex;gap:8px"><span style="flex:1"></span><button class="btn" onclick="closeModal_acx(\'billModal\')">Close</button>' + (r.status !== 'Completed' && !fromBooks(r) ? '<button class="btn" onclick="acxRecToggle(\'' + r.id + '\')">' + (r.status === 'Active' ? 'Pause' : 'Resume') + '</button><button class="btn btn-primary" onclick="acxRecRunNow(\'' + r.id + '\')">Create due bills now</button>' : '') + '</div>');
  };
  w.acxRecRunNow = function (id) { var n = runRecurring(id); closeModal('billModal'); refreshAll(); toast(n ? n + ' bill' + (n === 1 ? '' : 's') + ' created' : 'Nothing is due yet'); };

  /* create every bill that is due (catches up missed periods, never twice for the same run date) */
  function runRecurring(onlyId) {
    var d = D(); if (!d) return 0; var made = 0, upto = today();
    d.recurringBills.forEach(function (r) {
      if (fromBooks(r) || r.status !== 'Active' || (onlyId && r.id !== onlyId)) return;
      var nd = r.nextDate, guard = 0, anchor = parseInt(String(r.date || '').split('-')[2], 10) || undefined;
      while (nd && nd <= upto && (!r.endDate || nd <= r.endDate) && guard < 24) {
        guard++;
        var dup = d.bills.some(function (b) { return b.recurringId === r.id && b.recurringRun === nd; });
        if (!dup) {
          var b = makeBill({ supplierId: r.supplierId, supplierName: r.supplierName, date: nd, category: r.category, termDays: r.termDays, currency: r.currency, currencyRate: r.currencyRate, description: r.description, items: r.items, source: 'recurring', recurringId: r.id, recurringNumber: r.number, recurringRun: nd });
          d.bills.push(b); made++; r.generated = (r.generated || 0) + 1; r.lastGenerated = nd;
        }
        nd = advance(nd, r.recurrenceType, r.recurrenceDays, anchor);
      }
      if (!nd || (r.endDate && nd > r.endDate)) { r.nextDate = ''; r.status = 'Completed'; } else r.nextDate = nd;
    });
    if (made || d.recurringBills.some(function (r) { return !fromBooks(r) && r.status === 'Completed' && r.nextDate === ''; })) save();
    return made;
  }
  w.acxRunRecurring = runRecurring;

  function refreshAll() {
    ['renderBills', 'renderBulkBills', 'renderRecurring', 'renderDashboard', 'renderCategories', 'renderSuppliers'].forEach(function (n) {
      try { if (typeof w[n] === 'function') w[n](); else if (typeof window[n] === 'function') window[n](); } catch (e) {}
    });
    try { var v = document.querySelector('.view.active'); if (v && v.id === 'view-reports' && typeof renderReports === 'function') renderReports(); } catch (e) {}
  }

  /* ---------- nav ---------- */
  var HOOK = { bills: 'renderBills', bulkbills: 'renderBulkBills', recurring: 'renderRecurring' };
  document.querySelectorAll('.nav-item[data-view]').forEach(function (it) {
    var v = it.dataset.view; if (!HOOK[v]) return;
    it.addEventListener('click', function () { if (v === 'recurring') runRecurring(); w[HOOK[v]](); });
  });

  /* make bills due today, now and then (also right after login) */
  var lastKey = '';
  setInterval(function () {
    var d = D(); if (!d || typeof CURRENT_USER === 'undefined' || !CURRENT_USER) { lastKey = ''; return; }
    var key = CURRENT_USER.companyId + '|' + today();
    if (key !== lastKey) { lastKey = key; if (runRecurring()) refreshAll(); }
  }, 3000);
})(window);
