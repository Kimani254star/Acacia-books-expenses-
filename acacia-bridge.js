/* acacia-bridge.js — keeps Customers + Invoices in step with Acacia Books for the same company.
 * Used by Sell and CRM (same file in both). Needs acacia_cross_app_sync.sql run once in Supabase.
 * Books -> app: new/changed customers and invoices appear here.
 * App -> Books: customers (and Sell invoices / CRM "Closed Won" deals with an invoice) are added to Books.
 * Nothing is ever deleted by the bridge. */
(function (w) {
  'use strict';
  var low = function (v) { return String(v == null ? '' : v).trim().toLowerCase(); };
  var r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }
  function h(o) { var s = canon(o), x = 5381, i; for (i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return String(x >>> 0); }
  function hx(s) { var o = '', k; for (k = 1; k <= 4; k++) { var x = 5381 * k, i; for (i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i) * k) | 0; o += ('00000000' + (x >>> 0).toString(16)).slice(-8); } return o; }
  function uuidOf(s) { var x = hx(s); return x.slice(0, 8) + '-' + x.slice(8, 12) + '-4' + x.slice(13, 16) + '-a' + x.slice(17, 20) + '-' + x.slice(20, 32); }
  function numIdOf(s) { return 9000000000000 + (parseInt(hx(s).slice(0, 8), 16) % 900000000); }

  var APP = null, busy = false, timer = 0, selfSave = false;
  function db() { try { return DB; } catch (e) { try { return (0, eval)('db'); } catch (e2) { return null; } } }
  function user() { try { return CURRENT_USER; } catch (e) { return null; } }
  function detect() { var d = db(); if (!d) return null; if (d.suppliers && d.expenses) return 'expenses'; if (d.contacts && d.deals) return 'crm'; if (d.customers && d.invoices && d.seq) return 'sell'; return null; }

  /* ---------------- views used for change detection (same fields both sides) ---------------- */
  var custView = function (b) { return { n: low(b.name), e: low(b.primaryEmail), p: String(b.phone || ''), a: String(b.billingAddress || ''), k: String(b.kraPin || ''), l: r2(b.creditLimit), c: b.currency || 'KES', s: b.salutation || '' }; };
  var invView = function (b) { return { no: String(b.invoiceNumber || ''), d: String(b.date || ''), c: low(b.customer), nd: Number(b.netDays) || 0, t: r2(b.total), v: r2(b.vat), cur: b.currency || 'KES', it: (b.items || []).map(function (i) { return [low(i.product || i.description || i.name), Number(i.qty) || 0, r2(i.price), Number(i.discount) || 0]; }) }; };
  var payView = function (b) { return { s: low(b.status), a: r2(b.amountPaid) }; };

  /* ---------------- adapters ---------------- */
  var A = {
    sell: {
      cust: {
        list: function () { return db().customers; },
        toBooks: function (c) { return { salutation: '', name: c.name, primaryEmail: c.email || '', secondaryEmail: '', phone: c.phone || '', billingAddress: c.location || '', shippingAddress: '', kraPin: '', creditLimit: c.credit || 0, currency: 'KES' }; },
        make: function (b) { return { id: 'BK-' + hx(b.id).slice(0, 8), name: b.name, contact: '', phone: b.phone || '', email: b.primaryEmail || '', location: b.billingAddress || '', credit: Number(b.creditLimit) || 0, balance: 0 }; },
        apply: function (c, b) { c.name = b.name; c.phone = b.phone || ''; c.email = b.primaryEmail || ''; c.location = b.billingAddress || ''; c.credit = Number(b.creditLimit) || 0; },
        nameOf: function (c) { return c.name; },
        add: function (c) { db().customers.unshift(c); }
      },
      inv: {
        list: function () { return db().invoices; },
        custById: function (id) { return db().customers.find(function (c) { return c.id === id; }); },
        custByName: function (n) { return db().customers.find(function (c) { return low(c.name) === low(n); }); },
        eligible: function (i) { return !!this.custById(i.custId); },
        numberOf: function (i) { return i.id; },
        toBooks: function (i, creating) {
          var self = this, c = self.custById(i.custId), total = Number(i.total) || 0, paid = Number(i.paid) || 0;
          var items = (i.lines || []).map(function (l) {
            var p = db().products.find(function (x) { return x.id === l.pid; });
            var nm = p ? p.name : (String(l.pid || '').indexOf('BK:') === 0 ? String(l.pid).slice(3) : (l.desc || l.pid || 'Item'));
            var base = (l.qty * l.price) * (1 - (l.disc || 0) / 100), rate = p ? (p.vat || 0) / 100 : 0.16;
            return { itemType: 'product', product: nm, description: nm, qty: l.qty, price: l.price, discount: l.disc || 0, vat: r2(base * rate), total: r2(base) };
          });
          var b = { invoiceNumber: i.id, date: i.date, customer: c ? c.name : '', netDays: Math.max(0, Math.round((new Date(i.dueDate) - new Date(i.date)) / 86400000)) || 0, account: '', items: items, total: r2(total).toFixed(2), vat: r2(i.vat).toFixed(2), currency: 'KES', source: 'Sell' };
          if (creating) { b.amountPaid = paid; b.balance = r2(total - paid); b.status = paid >= total && total > 0 ? 'Paid' : (paid > 0 ? 'Partial' : 'Unpaid'); b.paid = b.status === 'Paid'; }
          return b;
        },
        make: function (b) {
          var c = this.custByName(b.customer); if (!c) return null;
          var lines = (b.items || []).map(function (i) { return { pid: 'BK:' + (i.product || i.description || 'Item'), qty: Number(i.qty) || 1, price: Number(i.price) || 0, disc: Number(i.discount) || 0 }; });
          var sub = lines.reduce(function (s, l) { return s + l.qty * l.price; }, 0), disc = lines.reduce(function (s, l) { return s + l.qty * l.price * (l.disc / 100); }, 0);
          var i = { id: 'BK-' + hx(String(b.id)).slice(0, 8), custId: c.id, lines: lines, date: b.date || new Date().toISOString().slice(0, 10), subtotal: sub, discount: disc, vat: Number(b.vat) || 0, total: Number(b.total) || 0, paid: 0, status: 'Sent' };
          try { i.dueDate = addDays(i.date, Number(b.netDays) || 0); } catch (e) { i.dueDate = i.date; }
          if (b.invoiceNumber && !db().invoices.some(function (x) { return x.id === b.invoiceNumber; })) i.id = String(b.invoiceNumber);
          this.pay(i, b); return i;
        },
        pay: function (i, b) { var tot = Number(i.total) || 0, p = Number(b.amountPaid) || (low(b.status) === 'paid' ? tot : 0); i.paid = p; i.status = tot > 0 && p >= tot ? 'Paid' : (p > 0 ? 'Partially Paid' : 'Sent'); },
        apply: function (i, b) { var n = this.make(b); if (!n) return; Object.keys(n).forEach(function (k) { if (k !== 'id') i[k] = n[k]; }); },
        add: function (i) { db().invoices.unshift(i); }
      },
      save: function () { saveCompanyData(); },
      render: function () { renderPage(); }
    },
    expenses: {
      key: 'suppliers',
      view: function (b) { return { n: low(b.name), e: low(b.primaryEmail), p: String(b.phone || '') }; },
      cust: {
        list: function () { return db().suppliers; },
        nameOf: function (s) { return s.name; },
        toBooks: function (s) { var c = String(s.contact || '').trim(), em = /@/.test(c); return { salutation: '', name: s.name, primaryEmail: em ? c : '', phone: em ? '' : c, currency: 'KES' }; },
        make: function (b) { return { id: 'sup_bk' + hx(b.id).slice(0, 8), name: b.name, contact: b.primaryEmail || b.phone || '', notes: '' }; },
        apply: function (s, b) { s.name = b.name; s.contact = b.primaryEmail || b.phone || s.contact || ''; },
        add: function (s) { db().suppliers.push(s); }
      },
      save: function () { saveDB(); },
      render: function () { try { renderSuppliers(); populateSupplierSelect(); } catch (e) {} }
    },
    crm: {
      cust: {
        list: function () { return db().contacts; },
        nameOf: function (c) { return c.companyName || [c.salutation, c.first, c.last].filter(Boolean).join(' '); },
        toBooks: function (c) { return { salutation: c.salutation || '', name: this.nameOf(c), primaryEmail: c.email || '', secondaryEmail: c.email2 || '', phone: c.phone || '', billingAddress: c.billingAddress || '', shippingAddress: c.shippingAddress || '', kraPin: c.kraPin || '', creditLimit: c.creditLimit || 0, currency: c.currency || 'KES' }; },
        make: function (b) { var u = user() || {}; return { id: 'con_bk' + hx(b.id).slice(0, 7), salutation: b.salutation || '', first: b.name, last: '', companyName: '', account: '', owner: u.name || '', email: b.primaryEmail || '', email2: b.secondaryEmail || '', phone: b.phone || '', kraPin: b.kraPin || '', currency: b.currency || 'KES', creditLimit: Number(b.creditLimit) || 0, billingAddress: b.billingAddress || '', shippingAddress: b.shippingAddress || '', source: 'Acacia Books', created: new Date().toISOString().slice(0, 10) }; },
        apply: function (c, b) { if (low(b.name) !== low(this.nameOf(c))) { c.first = b.name; c.last = ''; c.companyName = ''; } c.salutation = b.salutation || ''; c.email = b.primaryEmail || ''; c.email2 = b.secondaryEmail || ''; c.phone = b.phone || ''; c.kraPin = b.kraPin || ''; c.currency = b.currency || 'KES'; c.creditLimit = Number(b.creditLimit) || 0; c.billingAddress = b.billingAddress || ''; c.shippingAddress = b.shippingAddress || ''; },
        add: function (c) { db().contacts.push(c); }
      },
      inv: {
        list: function () { return db().deals; },
        contactById: function (id) { return db().contacts.find(function (c) { return c.id === id; }); },
        contactByName: function (n) { var self = A.crm.cust; return db().contacts.find(function (c) { return low(self.nameOf(c)) === low(n); }); },
        eligible: function (d) { return !!(d.invoiceNumber && d.contact && (d.items || []).length && d.stage === 'Closed Won' && this.contactById(d.contact)); },
        numberOf: function (d) { return d.invoiceNumber; },
        calc: function (d) {
          var sub = 0, vat = 0;
          var items = (d.items || []).map(function (l) {
            var base = (Number(l.qty) || 0) * (Number(l.price) || 0) * (1 - (Number(l.discount) || 0) / 100), t = l.tax === 'exempt' ? 0 : (Number(l.tax) || 0);
            sub += base; vat += base * t / 100;
            return { itemType: l.type || 'product', product: l.description || '', description: l.description || '', qty: Number(l.qty) || 0, price: Number(l.price) || 0, discount: Number(l.discount) || 0, vat: r2(base * t / 100), total: r2(base) };
          });
          return { items: items, sub: sub, vat: vat, total: sub + vat };
        },
        toBooks: function (d, creating) {
          var c = this.contactById(d.contact), k = this.calc(d);
          var b = { invoiceNumber: d.invoiceNumber, date: d.invoiceDate || d.created || new Date().toISOString().slice(0, 10), customer: c ? A.crm.cust.nameOf(c) : '', netDays: Number(d.netDays) || 0, account: '', items: k.items, total: r2(k.total).toFixed(2), vat: r2(k.vat).toFixed(2), currency: d.currency || 'KES', salesPerson: d.owner || '', lpo: d.lpo || '', source: 'CRM' };
          if (creating) { b.status = 'Unpaid'; b.paid = false; b.amountPaid = 0; b.balance = r2(k.total); }
          return b;
        },
        make: function (b) {
          var c = this.contactByName(b.customer); if (!c) return null;
          var u = user() || {}, items = (b.items || []).map(function (i) { var t = Number(i.total) || 0, v = Number(i.vat) || 0, rate = t > 0 ? Math.round(v / t * 100) : 16; return { description: i.product || i.description || 'Item', type: 'product', qty: Number(i.qty) || 1, price: Number(i.price) || 0, discount: Number(i.discount) || 0, tax: String(rate) }; });
          var d = { id: 'deal_bk' + hx(String(b.id)).slice(0, 7), name: 'Invoice ' + (b.invoiceNumber || ''), account: c.account || '', contact: c.id, owner: u.name || c.owner || '', probability: 100, closing: b.date || '', type: 'New Business', source: 'Acacia Books', invoiceNumber: b.invoiceNumber || '', invoiceDate: b.date || '', netDays: Number(b.netDays) || 0, dueDate: b.date || '', basis: 'accrual', currency: b.currency || 'KES', exchangeRate: 1, items: items, created: new Date().toISOString().slice(0, 10) };
          var sub = 0; items.forEach(function (l) { sub += l.qty * l.price * (1 - l.discount / 100); });
          d.subTotal = sub; d.discountTotal = 0; d.taxable = sub; d.vat = Number(b.vat) || 0; d.total = Number(b.total) || 0; d.amount = d.total;
          this.pay(d, b); return d;
        },
        pay: function (d, b) { d.stage = low(b.status) === 'draft' ? 'Proposal' : 'Closed Won'; },
        apply: function (d, b) { var n = this.make(b); if (!n) return; Object.keys(n).forEach(function (k) { if (k !== 'id' && k !== 'owner' && k !== 'created') d[k] = n[k]; }); },
        add: function (d) { db().deals.push(d); }
      },
      save: function () { save(); },
      render: function () { renderView(); }
    }
  };

  /* ---------------- one sync pass for one kind (customers / invoices) ---------------- */
  function bookId(kind, appId, isInv) { return isInv ? numIdOf(APP + ':' + appId) : uuidOf(APP + ':' + appId); }

  async function pass(company, K, vw, rows, key, isInv) {
    var changed = false, pushes = [], later = [];
    var row = rows[key], bArr = [];
    if (row) { try { var p = JSON.parse(row.value); if (typeof p === 'string') p = JSON.parse(p); if (Array.isArray(p)) bArr = p; } catch (e) { return false; } }
    var byId = {}; bArr.forEach(function (b) { if (b && b.id != null) byId[String(b.id)] = b; });
    var recs = K.list(), linked = {};
    recs.forEach(function (r) { if (r._bk) linked[String(r._bk.id)] = r; });

    /* a. already linked */
    recs.forEach(function (r) {
      if (!r._bk) return;
      var b = byId[String(r._bk.id)]; if (!b) return;
      var bh = h(vw(b)), ph = h(payView(b)), ah = h(vw(K.toBooks(r, false)));
      if (bh !== r._bk.bh) {
        if (!isInv || r._bk.imp) { K.apply(r, b); changed = true; }
        r._bk.bh = bh; r._bk.ah = h(vw(K.toBooks(r, false))); r._bk.ph = ph; changed = true;
        if (isInv) { K.pay(r, b); }
      } else if (isInv && ph !== r._bk.ph) { K.pay(r, b); r._bk.ph = ph; changed = true; }
      else if (ah !== r._bk.ah) {
        var out = K.toBooks(r, false); out.id = r._bk.id; pushes.push(out);
        (function (rr, o) { later.push(function () { rr._bk.ah = ah; rr._bk.bh = h(vw(o)); }); })(r, out);
      }
    });

    /* b. Books records not linked yet: pair with a same-named / same-numbered app record, else import */
    bArr.forEach(function (b) {
      if (!b || b.id == null || linked[String(b.id)]) return;
      var mate = null;
      recs.forEach(function (r) {
        if (mate || r._bk) return;
        if (isInv) { if (K.eligible(r) ? String(K.numberOf(r)) === String(b.invoiceNumber) : false) mate = r; }
        else if (low(K.nameOf(r)) === low(b.name)) mate = r;
      });
      if (mate) { mate._bk = { id: b.id, bh: h(vw(b)), ah: h(vw(K.toBooks(mate, false))), ph: h(payView(b)) }; changed = true; linked[String(b.id)] = mate; return; }
      var n = K.make(b); if (!n) return;
      n._bk = { id: b.id, bh: h(vw(b)), ah: '', ph: h(payView(b)), imp: 1 };
      if (!recs.some(function (x) { return x.id === n.id; })) { K.add(n); n._bk.ah = h(vw(K.toBooks(n, false))); changed = true; linked[String(b.id)] = n; }
    });

    /* c. app records Books has never seen */
    K.list().slice().forEach(function (r) {
      if (r._bk) return;
      if (isInv && !K.eligible(r)) return;
      if (!isInv && !String(K.nameOf(r) || '').trim()) return;
      var out = K.toBooks(r, true); out.id = bookId(key, r.id, isInv);
      out.createdAt = new Date().toISOString(); if (!isInv) out.receivables = 0;
      pushes.push(out);
      (function (rr, o) { later.push(function () { rr._bk = { id: o.id, bh: h(vw(o)), ah: h(vw(K.toBooks(rr, false))), ph: h(payView(o)) }; }); })(r, out);
    });

    if (pushes.length) {
      for (var i = 0; i < pushes.length; i += 100) await w.AcaciaCloud.rpc('acx_books_upsert', { p_company: company, p_key: key, p_records: pushes.slice(i, i + 100) });
      later.forEach(function (f) { f(); }); changed = true;
    }
    return changed;
  }

  async function sync() {
    if (busy) return; var u = user(); APP = detect();
    if (!u || !APP || !w.AcaciaCloud || !w.AcaciaCloud.isCloudId(u.companyId)) return;
    busy = true;
    try {
      var rows = {}, res = await w.AcaciaCloud.rpc('acx_books_read', { p_company: u.companyId, p_keys: ['customers', 'invoices', 'suppliers'] });
      (res || []).forEach(function (r) { rows[r.key] = r; });
      var ad = A[APP], c1 = false, c2 = false;
      if (ad.cust) c1 = await pass(u.companyId, ad.cust, ad.view || custView, rows, ad.key || 'customers', false);
      if (ad.inv) c2 = await pass(u.companyId, ad.inv, invView, rows, 'invoices', true);
      if (c1 || c2) { selfSave = true; try { ad.save(); } finally { selfSave = false; } try { var a = document.activeElement; if (!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) ad.render(); } catch (e) {} }
    } catch (e) { console.warn('[acacia-bridge]', e && e.message || e); }
    busy = false;
  }
  function soon(ms) { clearTimeout(timer); timer = setTimeout(sync, ms || 4000); }

  /* sell: show Books line items by name */
  if (typeof w.prodName === 'function') { var _pn = w.prodName; w.prodName = function (id) { return String(id).indexOf('BK:') === 0 ? String(id).slice(3) : _pn(id); }; }

  var rawSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k) { rawSet.apply(this, arguments); try { if (!selfSave && this === w.localStorage && /_ACC-\d+$/.test(String(k)) && user()) soon(4000); } catch (e) {} };
  setInterval(function () { if (!document.hidden) sync(); }, 20000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) soon(800); });
  setTimeout(function wait() { if (user()) sync(); setTimeout(wait, user() ? 60000 : 1500); }, 1500);
  w.AcaciaBridge = { sync: sync };
})(window);
