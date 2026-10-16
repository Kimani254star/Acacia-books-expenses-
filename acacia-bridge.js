/* acacia-bridge.js (v2) — keeps Customers, Suppliers and Invoices in step with Acacia Books for the same company.
 * Used by Sell, CRM, Expenses, Payroll and Projects (same file). Needs acacia_cross_app_sync.sql (v2) run once in Supabase and
 * acacia-app-inbox.js added to Books.
 *  - Books <-> app: customers / suppliers / invoices, including edits to invoice lines.
 *  - Deletes: customers & suppliers sync both ways. Invoices deleted in Books are removed here; invoices deleted
 *    here are sent to Books as a "review" item (Books must reverse stock / ledger, so you confirm it there).
 *  - Payments recorded in Sell are sent to Books as "payments to post" (you pick the bank in Books).
 *  - Sell stock follows Books invoices (matched by product name / SKU). */
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
  var today = function () { return new Date().toISOString().slice(0, 10); };

  /* Books company ids look like ACC-123 (made in the apps) or company_1790239285132 (made in Books) */
  var isBooksCo = function (id) { return /^(ACC-\d+|company_[A-Za-z0-9_]+)$/i.test(String(id || '')); };
  var APP = null, busy = false, timer = 0, selfSave = false;
  function db() { try { return DB; } catch (e) { try { return (0, eval)('db'); } catch (e2) { try { return (0, eval)('state'); } catch (e3) { return null; } } } }
  function user() { try { return CURRENT_USER; } catch (e) { return null; } }
  function detect() { var d = db(); if (!d) return null; if (d.suppliers && d.expenses) return 'expenses'; if (d.employees && d.payRuns && 'nextEmpSeq' in d) return 'payroll'; if (d.projects && d.tasks && d.timeEntries) return 'projects'; if (d.contacts && d.deals) return 'crm'; if (d.customers && d.invoices && d.seq) return 'sell'; return null; }
  function reg(key) { var d = db(); d._bkReg = d._bkReg || {}; d._bkReg[key] = d._bkReg[key] || {}; return d._bkReg[key]; }

  /* ---------- views used for change detection ---------- */
  var custView = function (b) { return { n: low(b.name), e: low(b.primaryEmail), p: String(b.phone || ''), a: String(b.billingAddress || ''), k: String(b.kraPin || ''), l: r2(b.creditLimit), c: b.currency || 'KES', s: b.salutation || '' }; };
  var invView = function (b) { return { no: String(b.invoiceNumber || ''), d: String(b.date || ''), c: low(b.customer), nd: Number(b.netDays) || 0, t: r2(b.totalKES != null ? b.totalKES : b.total), v: r2(b.vat), cur: b.currency || 'KES', it: (b.items || []).map(function (i) { return [low(i.desc || i.product || i.description), Number(i.qty) || 0, r2(i.price), Number(i.discount) || 0, Number(i.vatRate) || 0]; }) }; };
  var payView = function (b) { return { s: low(b.status), a: r2(b.amountPaid) }; };

  /* ---------- helpers for Books invoice shape (matches Books' own invoice code) ---------- */
  function bookItem(name, sku, qty, price, disc, ratePct, exempt) {
    var unit = price * (1 - (disc || 0) / 100), sub = unit * qty, vat = exempt ? 0 : sub * ratePct / 100;
    var cat = exempt ? 'Exempt' : (ratePct === 16 ? 'General' : (ratePct === 8 ? 'Other' : (ratePct === 0 ? 'Zero' : 'General')));
    return { desc: name, sku: sku || '', warehouse: 'Main', qty: qty, price: price, discount: disc || 0, vatRate: exempt ? 0 : ratePct, category: cat, subtotal: r2(sub), vat: r2(vat), totalWithVat: r2(sub + vat), batch: '', type: 'product' };
  }
  function bookInvoice(base, items, creating, appName) {
    var sub = 0, vat = 0, disc = 0, cat = { General: 0, Other: 0, Zero: 0, Exempt: 0 };
    items.forEach(function (i) { sub += i.subtotal; vat += i.vat; disc += i.qty * i.price * (i.discount / 100); cat[i.category] = (cat[i.category] || 0) + i.subtotal; });
    var total = sub + vat, o = base;
    o.items = items; o.total = r2(total).toFixed(2); o.vat = r2(vat).toFixed(2); o.discount = r2(disc).toFixed(2); o.vatKES = r2(vat); o.totalKES = r2(total);
    o.salesGeneral = r2(cat.General).toFixed(2); o.salesOther = r2(cat.Other).toFixed(2); o.salesZero = r2(cat.Zero).toFixed(2); o.salesExempt = r2(cat.Exempt).toFixed(2);
    o.currency = 'KES'; o.exchangeRate = 1; o.source = appName;
    if (creating) { o.account = ''; o.salesPerson = ''; o.lpo = ''; o.amountPaid = 0; o.balance = r2(total); o.paid = false; o.status = 'Unpaid'; o.createdAt = new Date().toISOString(); }
    return o;
  }
  function pendingPaid(inbox, bookId) { var s = 0; (inbox || []).forEach(function (x) { if (x && x.type === 'payment' && x.status === 'pending' && String(x.invoiceId) === String(bookId)) s += Number(x.amount) || 0; }); return s; }
  function vatCat(i) { var c = Number(i.vatRate) || 0; return { rate: c, exempt: low(i.category) === 'exempt' }; }

  /* ---------------- adapters ---------------- */
  var A = {
    sell: {
      cust: {
        list: function () { return db().customers; },
        nameOf: function (c) { return c.name; },
        toBooks: function (c) { return { salutation: '', name: c.name, primaryEmail: c.email || '', secondaryEmail: '', phone: c.phone || '', billingAddress: c.location || '', shippingAddress: '', kraPin: '', creditLimit: c.credit || 0, currency: 'KES' }; },
        make: function (b) { return { id: 'BK-' + hx(String(b.id)).slice(0, 8), name: b.name, contact: '', phone: b.phone || '', email: b.primaryEmail || '', location: b.billingAddress || '', credit: Number(b.creditLimit) || 0, balance: 0 }; },
        apply: function (c, b) { c.name = b.name; c.phone = b.phone || ''; c.email = b.primaryEmail || ''; c.location = b.billingAddress || ''; c.credit = Number(b.creditLimit) || 0; },
        add: function (c) { db().customers.unshift(c); },
        inUse: function (c) { var d = db(); return d.invoices.some(function (i) { return i.custId === c.id; }) || (d.quotes || []).some(function (q) { return q.custId === c.id; }) || (d.orders || []).some(function (o) { return o.custId === c.id; }); }
      },
      inv: {
        list: function () { return db().invoices; },
        custById: function (id) { return db().customers.find(function (c) { return c.id === id; }); },
        custByName: function (n) { return db().customers.find(function (c) { return low(c.name) === low(n); }); },
        prodFor: function (name, sku) { return db().products.find(function (p) { return (sku && p.sku && low(p.sku) === low(sku)) || low(p.name) === low(name); }); },
        eligible: function (i) { return !!this.custById(i.custId); },
        numberOf: function (i) { return i.id; },
        bookNo: function (i, taken) { var n = String(i.id); return taken[n] ? 'SL-' + n : n; },
        toBooks: function (i, creating, taken) {
          var self = this, c = self.custById(i.custId), items = (i.lines || []).map(function (l) {
            var p = db().products.find(function (x) { return x.id === l.pid; });
            var nm = p ? p.name : (String(l.pid || '').indexOf('BK:') === 0 ? String(l.pid).slice(3) : (l.desc || l.pid || 'Item'));
            return bookItem(nm, p ? p.sku : '', Number(l.qty) || 0, Number(l.price) || 0, Number(l.disc) || 0, p ? Number(p.vat) || 0 : 16, false);
          });
          var base = { invoiceNumber: this.bookNo(i, taken || {}), date: i.date, customer: c ? c.name : '', customerName: c ? c.name : '', netDays: Math.max(0, Math.round((new Date(i.dueDate) - new Date(i.date)) / 86400000)) || 0, dueDate: i.dueDate || i.date };
          return bookInvoice(base, items, creating, 'Sell');
        },
        make: function (b, taken) {
          var self = this, c = this.custByName(b.customer); if (!c) return null;
          var lines = (b.items || []).map(function (i) { var p = self.prodFor(i.desc || i.product, i.sku); return { pid: p ? p.id : 'BK:' + (i.desc || i.product || 'Item'), qty: Number(i.qty) || 1, price: Number(i.price) || 0, disc: Number(i.discount) || 0 }; });
          var sub = lines.reduce(function (s, l) { return s + l.qty * l.price; }, 0), disc = lines.reduce(function (s, l) { return s + l.qty * l.price * (l.disc / 100); }, 0);
          var id = String(b.invoiceNumber || ''), exists = db().invoices.some(function (x) { return x.id === id; });
          var i = { id: id && !exists ? id : (id ? 'B-' + id : 'BK-' + hx(String(b.id)).slice(0, 8)), custId: c.id, lines: lines, date: b.date || today(), subtotal: sub, discount: disc, vat: Number(b.vat) || 0, total: Number(b.totalKES != null ? b.totalKES : b.total) || 0, paid: 0, status: 'Sent' };
          if (db().invoices.some(function (x) { return x.id === i.id; })) i.id = 'BK-' + hx(String(b.id)).slice(0, 8);
          try { i.dueDate = b.dueDate || addDays(i.date, Number(b.netDays) || 0); } catch (e) { i.dueDate = i.date; }
          return i;
        },
        pay: function (i, b, inbox, bookId) { var tot = Number(i.total) || 0, p = Math.min(tot, (Number(b.amountPaid) || (low(b.status) === 'paid' ? tot : 0)) + pendingPaid(inbox, bookId)); i.paid = p; i.status = tot > 0 && p >= tot ? 'Paid' : (p > 0 ? 'Partially Paid' : 'Sent'); },
        apply: function (i, b) { var n = this.make(b); if (!n) return; Object.keys(n).forEach(function (k) { if (k !== 'id' && k !== 'paid' && k !== 'status') i[k] = n[k]; }); },
        add: function (i) { db().invoices.unshift(i); },
        stockMap: function (i) { var m = {}; (i.lines || []).forEach(function (l) { if (db().products.some(function (p) { return p.id === l.pid; })) m[l.pid] = (m[l.pid] || 0) + (Number(l.qty) || 0); }); return m; },
        stock: function (i, adjust) {
          var now = this.stockMap(i), old = (i._bk && i._bk.sk) || {}, ids = {}; Object.keys(now).concat(Object.keys(old)).forEach(function (k) { ids[k] = 1; });
          if (adjust) Object.keys(ids).forEach(function (k) { var d = (now[k] || 0) - (old[k] || 0), p = db().products.find(function (x) { return x.id === k; }); if (p && d) p.stock = Math.max(0, (Number(p.stock) || 0) - d); });
          if (i._bk) i._bk.sk = now;
        },
        inUse: function () { return false; }
      },
      save: function () { saveCompanyData(); },
      render: function () { renderPage(); }
    },
    payroll: {
      key: 'employees',
      view: function (b) { return { n: low(b.name), p: String(b.position || ''), d: String(b.department || ''), e: low(b.email), ph: String(b.phone || ''), j: String(b.joinDate || ''), s: r2(b.salary) }; },
      cust: {
        noExtras: true,
        list: function () { return db().employees; },
        nameOf: function (e) { return e.name; },
        bookIdFor: function (e) { return String(e.empNo || e.id); },
        match: function (e, b) { return low(e.name) === low(b.name) || (String(e.empNo) === String(b.id) && low(e.name) === low(b.name)); },
        toBooks: function (e) { return { name: e.name, id: String(e.empNo || e.id), position: e.jobTitle || '', department: e.department || '', email: e.email || '', phone: e.phone || '', joinDate: e.employmentDate || '', salary: Number(e.basicSalary) || 0 }; },
        make: function (b) {
          var d = db(), dept = b.department || (d.departments && d.departments[0]) || '', title = b.position || (d.jobTitles && d.jobTitles[0]) || '';
          if (dept && Array.isArray(d.departments) && d.departments.indexOf(dept) < 0) d.departments.push(dept);
          if (title && Array.isArray(d.jobTitles) && d.jobTitles.indexOf(title) < 0) d.jobTitles.push(title);
          return { id: 'emp-bk' + hx(String(b.id) + ':' + String(b.name)).slice(0, 7), empNo: String(b.id), name: b.name, department: dept, jobTitle: title, employmentDate: b.joinDate || today(), basicSalary: Number(b.salary) || 0, phone: b.phone || '', email: b.email || '', bankName: '', bankAccount: '', kraPin: '', nssfNo: '', shifNo: '', status: 'Active', allowances: [], deductions: [], leaveBalance: 21 };
        },
        apply: function (e, b) { e.name = b.name; e.department = b.department || e.department; e.jobTitle = b.position || e.jobTitle; e.employmentDate = b.joinDate || e.employmentDate; e.basicSalary = Number(b.salary) || 0; e.phone = b.phone || ''; e.email = b.email || ''; var d = db(); if (e.department && Array.isArray(d.departments) && d.departments.indexOf(e.department) < 0) d.departments.push(e.department); if (e.jobTitle && Array.isArray(d.jobTitles) && d.jobTitles.indexOf(e.jobTitle) < 0) d.jobTitles.push(e.jobTitle); },
        add: function (e) { db().employees.push(e); },
        inUse: function (e) { return (db().payRuns || []).some(function (r) { return (r.employeeIds || []).indexOf(e.id) > -1; }); }
      },
      save: function () { saveState(); },
      render: function () { renderAll(); }
    },
    projects: {
      key: 'projects',
      view: function (b) { return { n: low(b.title), s: String(b.status || ''), p: String(b.priority || ''), sd: String(b.startDate || ''), ed: String(b.endDate || ''), b: r2(b.budget), g: Number(b.progress) || 0, d: String(b.description || '') }; },
      cust: {
        noExtras: true,
        list: function () { return db().projects; },
        nameOf: function (p) { return p.name; },
        toBooks: function (p, creating) {
          var st = p.status === 'Planning' ? 'Not Started' : (p.status || 'Not Started'), pr = p.priority === 'Urgent' ? 'High' : (p.priority || 'Medium');
          var o = { title: p.name, status: st, priority: pr, startDate: p.startDate || '', endDate: p.endDate || '', budget: String(Number(p.budget) || 0), description: p.description || '', progress: Number(p.progress) || 0 };
          if (creating) { o.department = ''; o.type = ''; o.dateCreated = new Date().toLocaleString(); }
          return o;
        },
        okIn: function (list, v, d) { return Array.isArray(list) && list.indexOf(v) > -1 ? v : d; },
        make: function (b) {
          var d = db(), set = d.settings || {}, code = '';
          try { code = (set.projectNumberingPrefix || 'PRJ-') + String(set.nextProjectNumber || 1).padStart(3, '0'); set.nextProjectNumber = (set.nextProjectNumber || 1) + 1; } catch (e) {}
          return { id: 'projects_bk' + hx(String(b.id)).slice(0, 7), name: b.title || 'Untitled', code: code, client: '', manager: '', status: this.okIn(set.projectStatuses, b.status, 'Not Started'), priority: this.okIn(set.priorities, b.priority, 'Medium'), startDate: b.startDate || '', endDate: b.endDate || '', budget: Number(b.budget) || 0, actualCost: 0, labourCost: 0, materialsCost: 0, servicesCost: 0, otherCost: 0, progress: Number(b.progress) || 0, description: b.description || '' };
        },
        apply: function (p, b) { var set = db().settings || {}; p.name = b.title || p.name; p.status = this.okIn(set.projectStatuses, b.status, p.status); p.priority = this.okIn(set.priorities, b.priority, p.priority); p.startDate = b.startDate || ''; p.endDate = b.endDate || ''; p.budget = Number(b.budget) || 0; p.progress = Number(b.progress) || 0; p.description = b.description || ''; },
        add: function (p) { db().projects.push(p); },
        inUse: function (p) { var d = db(); return ['tasks', 'milestones', 'timeEntries', 'issues', 'documents'].some(function (k) { return (d[k] || []).some(function (x) { return x.projectId === p.id; }); }); }
      },
      save: function () { saveState(); },
      render: function () { render(); }
    },
    expenses: {
      key: 'suppliers',
      view: function (b) { return { n: low(b.name), e: low(b.primaryEmail), p: String(b.phone || '') }; },
      cust: {
        list: function () { return db().suppliers; },
        nameOf: function (s) { return s.name; },
        toBooks: function (s) { var c = String(s.contact || '').trim(), em = /@/.test(c); return { salutation: '', name: s.name, primaryEmail: em ? c : '', phone: em ? '' : c, currency: 'KES' }; },
        make: function (b) { return { id: 'sup_bk' + hx(String(b.id)).slice(0, 8), name: b.name, contact: b.primaryEmail || b.phone || '', notes: '' }; },
        apply: function (s, b) { s.name = b.name; s.contact = b.primaryEmail || b.phone || s.contact || ''; },
        add: function (s) { db().suppliers.push(s); },
        inUse: function (s) { return (db().expenses || []).some(function (e) { return e.supplierId === s.id; }); }
      },
      afterRead: function (rows) {
        var d = db(), changed = false;
        var arr = function (k) { try { var v = rows[k] && JSON.parse(rows[k].value); if (typeof v === 'string') v = JSON.parse(v); return Array.isArray(v) ? v : null; } catch (e) { return null; } };
        var coa = arr('chartOfAccounts'), banks = arr('banks'), nAcc = 0;
        if (coa) {
          var byCode = {}, isParent = {}, groups = {}, order = [];
          coa.forEach(function (a) { if (a && a.code != null) byCode[String(a.code)] = a; });
          coa.forEach(function (a) { if (a && a.parentCode != null && a.parentCode !== '') isParent[String(a.parentCode)] = 1; });
          coa.forEach(function (a) {
            if (!a || !a.name || a.active === false || !/expense|cost of/i.test(String(a.type || ''))) return;
            if (a.code != null && isParent[String(a.code)]) return;                 /* header accounts only name a group */
            var par = a.parentName || (a.parentCode != null && byCode[String(a.parentCode)] && byCode[String(a.parentCode)].name) || a.category || 'Expenses';
            if (low(par) === low(a.name)) par = 'Expenses';
            if (!groups[par]) { groups[par] = []; order.push(par); }
            if (groups[par].indexOf(a.name) < 0) { groups[par].push(a.name); nAcc++; }
          });
          if (nAcc) {
            var used = {}; order.forEach(function (g) { groups[g].forEach(function (n) { used[low(n)] = 1; }); });
            var extra = []; (d.expenses || []).forEach(function (e) { if (e.category && !used[low(e.category)] && extra.indexOf(e.category) < 0) extra.push(e.category); });
            var cats = {}; order.forEach(function (g) { cats[g] = groups[g]; }); if (extra.length) cats['Other (not in Books chart of accounts)'] = extra;
            if (h(cats) !== d._bkCat) { d.categories = cats; d._bkCat = h(cats); changed = true; }
          }
        }
        if (banks) {
          try {
            var sel = document.getElementById('f_payaccount');
            if (sel && sel.options) { banks.forEach(function (b) { var n = b && (b.name || b.bankName || b.accountName); if (!n) return; var has = Array.prototype.some.call(sel.options, function (o) { return low(o.value || o.text) === low(n); }); if (!has) { var o = document.createElement('option'); o.value = o.textContent = n; sel.appendChild(o); } }); }
          } catch (e) {}
        }
        ST.extra = coa ? (nAcc ? nAcc + ' expense accounts come from the Books chart of accounts.' : 'Books has no expense accounts yet, so the built-in categories are being used.') : '';
        return changed;
      },
      save: function () { saveDB(); },
      render: function () { try { renderSuppliers(); populateSupplierSelect(); } catch (e) {} try { populateAccountSelect(); } catch (e) {} try { renderCategories(); } catch (e) {} }
    },
    crm: {
      cust: {
        list: function () { return db().contacts; },
        nameOf: function (c) { return c.companyName || [c.salutation, c.first, c.last].filter(Boolean).join(' '); },
        toBooks: function (c) { return { salutation: c.salutation || '', name: this.nameOf(c), primaryEmail: c.email || '', secondaryEmail: c.email2 || '', phone: c.phone || '', billingAddress: c.billingAddress || '', shippingAddress: c.shippingAddress || '', kraPin: c.kraPin || '', creditLimit: c.creditLimit || 0, currency: c.currency || 'KES' }; },
        make: function (b) { var u = user() || {}; return { id: 'con_bk' + hx(String(b.id)).slice(0, 7), salutation: b.salutation || '', first: b.name, last: '', companyName: '', account: '', owner: u.name || '', email: b.primaryEmail || '', email2: b.secondaryEmail || '', phone: b.phone || '', kraPin: b.kraPin || '', currency: b.currency || 'KES', creditLimit: Number(b.creditLimit) || 0, billingAddress: b.billingAddress || '', shippingAddress: b.shippingAddress || '', source: 'Acacia Books', created: today() }; },
        apply: function (c, b) { if (low(b.name) !== low(this.nameOf(c))) { c.first = b.name; c.last = ''; c.companyName = ''; } c.salutation = b.salutation || ''; c.email = b.primaryEmail || ''; c.email2 = b.secondaryEmail || ''; c.phone = b.phone || ''; c.kraPin = b.kraPin || ''; c.currency = b.currency || 'KES'; c.creditLimit = Number(b.creditLimit) || 0; c.billingAddress = b.billingAddress || ''; c.shippingAddress = b.shippingAddress || ''; },
        add: function (c) { db().contacts.push(c); },
        inUse: function (c) { return (db().deals || []).some(function (d) { return d.contact === c.id; }); }
      },
      inv: {
        list: function () { return db().deals; },
        contactById: function (id) { return db().contacts.find(function (c) { return c.id === id; }); },
        contactByName: function (n) { var self = A.crm.cust; return db().contacts.find(function (c) { return low(self.nameOf(c)) === low(n); }); },
        eligible: function (d) { return !!(d.invoiceNumber && d.contact && (d.items || []).length && d.stage === 'Closed Won' && this.contactById(d.contact)); },
        numberOf: function (d) { return d.invoiceNumber; },
        bookNo: function (d, taken) { var n = String(d.invoiceNumber); return taken[n] ? 'CR-' + n : n; },
        toBooks: function (d, creating, taken) {
          var c = this.contactById(d.contact), items = (d.items || []).map(function (l) {
            var ex = l.tax === 'exempt';
            return bookItem(l.description || '', '', Number(l.qty) || 0, Number(l.price) || 0, Number(l.discount) || 0, ex ? 0 : (Number(l.tax) || 0), ex);
          });
          var nm = c ? A.crm.cust.nameOf(c) : '';
          var base = { invoiceNumber: this.bookNo(d, taken || {}), date: d.invoiceDate || d.created || today(), customer: nm, customerName: nm, netDays: Number(d.netDays) || 0, dueDate: d.dueDate || d.invoiceDate || today() };
          var o = bookInvoice(base, items, creating, 'CRM'); if (creating) { o.salesPerson = d.owner || ''; o.lpo = d.lpo || ''; } return o;
        },
        make: function (b) {
          var c = this.contactByName(b.customer); if (!c) return null;
          var u = user() || {}, items = (b.items || []).map(function (i) { return { description: i.desc || i.product || 'Item', type: 'product', qty: Number(i.qty) || 1, price: Number(i.price) || 0, discount: Number(i.discount) || 0, tax: low(i.category) === 'exempt' ? 'exempt' : String(Number(i.vatRate) || 0) }; });
          var sub = 0; items.forEach(function (l) { sub += l.qty * l.price * (1 - l.discount / 100); });
          var tot = Number(b.totalKES != null ? b.totalKES : b.total) || 0;
          var d = { id: 'deal_bk' + hx(String(b.id)).slice(0, 7), name: 'Invoice ' + (b.invoiceNumber || ''), account: c.account || '', contact: c.id, owner: u.name || c.owner || '', probability: 100, closing: b.date || '', type: 'New Business', source: 'Acacia Books', invoiceNumber: b.invoiceNumber || '', invoiceDate: b.date || '', netDays: Number(b.netDays) || 0, dueDate: b.dueDate || b.date || '', basis: 'accrual', currency: b.currency || 'KES', exchangeRate: 1, items: items, created: today(), subTotal: sub, discountTotal: 0, taxable: sub, vat: Number(b.vat) || 0, total: tot, amount: tot };
          return d;
        },
        pay: function (d, b) { d.stage = low(b.status) === 'draft' ? 'Proposal' : 'Closed Won'; },
        apply: function (d, b) { var n = this.make(b); if (!n) return; Object.keys(n).forEach(function (k) { if (k !== 'id' && k !== 'owner' && k !== 'created' && k !== 'stage') d[k] = n[k]; }); },
        add: function (d) { db().deals.push(d); },
        inUse: function () { return false; }
      },
      save: function () { save(); },
      render: function () { renderView(); }
    }
  };


  /* ---------- visible status (so a failure is never silent) ---------- */
  var ST = { state: 'wait', msg: 'Waiting for login…', at: null, company: '', counts: '', err: '' }, pill = null, pop = null;
  function explain(e) {
    var m = String((e && e.message) || e || ''), c = e && e.code, st = e && e.status;
    if (c === 'missing' || st === 404 || /could not find the function|schema cache/i.test(m)) return 'Supabase does not have the sync functions yet. Run acacia_cross_app_sync.sql (latest version) in Supabase > SQL Editor, then press Sync now.';
    if (st === 401 || st === 403 || /permission denied/i.test(m)) return 'Supabase refused the call (permissions). Re-run acacia_cross_app_sync.sql, which re-grants access. Details: ' + m;
    if (c === 'offline') return 'Cannot reach Supabase. Check the internet connection.';
    return m || 'Unknown error';
  }
  function paint() {
    try {
      if (!document.body || !document.createElement) return;
      if (!pill) {
        pill = document.createElement('button'); pill.type = 'button'; pill.id = 'acxBridgePill';
        pill.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99990;border:0;border-radius:999px;padding:5px 11px;font:600 11px system-ui,sans-serif;color:#fff;cursor:pointer;opacity:.9;box-shadow:0 2px 8px rgba(0,0,0,.25)';
        pill.onclick = function () { togglePop(); }; document.body.appendChild(pill);
      }
      pill.style.background = ST.state === 'ok' ? '#0f766e' : (ST.state === 'error' || ST.state === 'warn' ? '#b45309' : '#6b7280');
      pill.textContent = ST.state === 'ok' ? '🔗 Books sync ✓' : (ST.state === 'error' ? '⚠ Books sync problem' : (ST.state === 'warn' ? '⚠ Books sync: check' : '🔗 Books sync…'));
      if (pop) fillPop();
    } catch (e) {}
  }
  function fillPop() {
    pop.innerHTML = '<div style="font-weight:700;margin-bottom:6px">Books sync</div><div style="margin-bottom:6px">' + String(ST.msg).replace(/</g, '&lt;') + '</div><div style="color:#6b7280;font-size:11px;margin-bottom:8px">Company ID: <b>' + (ST.company || '—') + '</b>' + (ST.at ? ' · last run ' + ST.at.toLocaleTimeString() : '') + (ST.counts ? '<br>' + ST.counts : '') + (ST.extra ? '<br>' + ST.extra : '') + '</div><button id="acxBridgeNow" style="background:#0f766e;color:#fff;border:0;border-radius:6px;padding:5px 10px;cursor:pointer">Sync now</button> <button id="acxBridgeCopy" style="border:1px solid #d1d5db;background:#fff;border-radius:6px;padding:5px 10px;cursor:pointer">Copy details</button> <button id="acxBridgeX" style="border:1px solid #d1d5db;background:#fff;border-radius:6px;padding:5px 10px;cursor:pointer">Close</button>';
    pop.querySelector('#acxBridgeNow').onclick = function () { ST.msg = 'Syncing…'; fillPop(); sync(true); };
    pop.querySelector('#acxBridgeCopy').onclick = function () {
      var u = user() || {}, txt = JSON.stringify({ app: APP, companyId: ST.company, loginEmail: u.email || '', status: ST.state, message: ST.msg, books: ST.counts, extra: ST.extra || '', lastError: ST.err || '', lastRun: ST.at ? ST.at.toISOString() : '', page: (location && location.host || '') + (location && location.pathname || '') }, null, 2), b = this;
      var done = function () { b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = 'Copy details'; }, 1800); };
      try { navigator.clipboard.writeText(txt).then(done, function () { fallbackCopy(txt); done(); }); } catch (e) { fallbackCopy(txt); done(); }
    };
    pop.querySelector('#acxBridgeX').onclick = function () { pop.remove(); pop = null; };
  }
  function fallbackCopy(t) { try { var a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); } catch (e) {} }
  function togglePop() {
    if (pop) { pop.remove(); pop = null; return; }
    pop = document.createElement('div'); pop.style.cssText = 'position:fixed;left:12px;bottom:46px;z-index:99991;background:#fff;color:#111;border:1px solid #e5e7eb;border-radius:10px;padding:12px;width:min(340px,92vw);font:12px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2)';
    document.body.appendChild(pop); fillPop();
  }
  function setSt(state, msg) { ST.state = state; ST.msg = msg; ST.at = new Date(); paint(); }


  /* Projects: offer Books customers as suggestions in the project "Client" box (still free text) */
  var clientNames = [], clientObs = null;
  function applyClientList() {
    try {
      if (APP !== 'projects' || !document.body || !document.querySelectorAll) return;
      var dl = document.getElementById('acxBooksCustomers');
      if (!dl) { dl = document.createElement('datalist'); dl.id = 'acxBooksCustomers'; document.body.appendChild(dl); }
      var want = clientNames.slice(0, 500).map(function (n) { return String(n).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); });
      var html = want.map(function (n) { return '<option value="' + n + '">'; }).join('');
      if (dl.getAttribute('data-h') !== h(want)) { dl.innerHTML = html; dl.setAttribute('data-h', h(want)); }
      Array.prototype.forEach.call(document.querySelectorAll('input[data-key="client"]'), function (i) { if (i.getAttribute('list') !== 'acxBooksCustomers') i.setAttribute('list', 'acxBooksCustomers'); });
      if (!clientObs && typeof MutationObserver !== 'undefined') { clientObs = new MutationObserver(function () { applyClientList(); }); clientObs.observe(document.body, { childList: true, subtree: true }); }
    } catch (e) {}
  }

  /* ---------------- one sync pass for one kind ---------------- */
  function bookId(appId, isInv) { return isInv ? numIdOf(APP + ':' + appId) : uuidOf(APP + ':' + appId); }
  function removeFrom(list, rec) { var i = list.indexOf(rec); if (i > -1) list.splice(i, 1); }

  async function pass(company, K, vw, rows, key, isInv, inbox, out) {
    var changed = false, pushes = [], deletes = [], later = [], row = rows[key], bArr = [], R = reg(key);
    var have = !!row;                                        /* no row = Books has none yet (nothing may be removed from the app then) */
    if (row) { try { var p = JSON.parse(row.value); if (typeof p === 'string') p = JSON.parse(p); if (!Array.isArray(p)) return false; bArr = p; } catch (e) { return false; } }
    var byId = {}, taken = {}; bArr.forEach(function (b) { if (b && b.id != null) { byId[String(b.id)] = b; if (b.invoiceNumber) taken[String(b.invoiceNumber)] = 1; } });
    var recs = K.list(), linked = {};
    recs.forEach(function (r) { if (r._bk) { linked[String(r._bk.id)] = r; if (!R[String(r._bk.id)]) R[String(r._bk.id)] = { a: r.id, m: 0, t: 0 }; else { R[String(r._bk.id)].a = r.id; R[String(r._bk.id)].m = 0; } } });

    /* deleted in the app? (confirmed on two passes in a row) */
    Object.keys(R).forEach(function (bid) {
      var e = R[bid]; if (e.t) { if (!byId[bid]) delete R[bid]; return; }
      if (recs.some(function (x) { return x.id === e.a; })) { e.m = 0; return; }
      if (!byId[bid]) { delete R[bid]; return; }
      e.m = (e.m || 0) + 1;
      if (e.m >= 2) {
        if (isInv) { out.inbox.push({ id: 'del-' + bid, type: 'invoiceDelete', status: 'pending', app: APP === 'sell' ? 'Sell' : 'CRM', invoiceId: byId[bid].id, invoiceNumber: byId[bid].invoiceNumber, customer: byId[bid].customer, amount: byId[bid].totalKES || byId[bid].total, createdAt: new Date().toISOString() }); e.t = 1; }
        else if (out.usedNames && out.usedNames[low(byId[bid].name)]) { e.t = 1; /* Books still has invoices for this customer: keep it there */ }
        else { deletes.push(bid); (function (b2) { later.push(function () { delete R[b2]; }); })(bid); }
        changed = true;
      }
    });

    /* deleted in Books? (two passes in a row; never remove something still in use here) */
    recs.slice().forEach(function (r) {
      if (!r._bk) return; var id = String(r._bk.id);
      if (!have) return;
      if (byId[id]) { r._bk.m = 0; return; }
      r._bk.m = (r._bk.m || 0) + 1;
      if (r._bk.m >= 2 && !(K.inUse && K.inUse(r))) { removeFrom(recs, r); delete R[id]; delete linked[id]; changed = true; }
    });

    /* linked: Books changed -> apply (incl. lines); app changed -> push */
    K.list().forEach(function (r) {
      if (!r._bk) return;
      var b = byId[String(r._bk.id)]; if (!b) return;
      var bh = h(vw(b)), ph = h(payView(b)), ah = h(vw(K.toBooks(r, false, taken)));
      if (bh !== r._bk.bh) {
        K.apply(r, b); if (isInv && K.stock && APP === 'sell') K.stock(r, true);
        r._bk.bh = bh; r._bk.ah = h(vw(K.toBooks(r, false, taken))); r._bk.ph = ph; changed = true;
        if (isInv) K.pay(r, b, inbox, r._bk.id);
      } else if (isInv && ph !== r._bk.ph) { K.pay(r, b, inbox, r._bk.id); r._bk.ph = ph; changed = true; }
      else if (ah !== r._bk.ah) {
        var o = K.toBooks(r, false, taken); o.id = r._bk.id;
        if (isInv && !o.customer) return;                    /* customer removed here: never blank the customer in Books */
        pushes.push(o);
        (function (rr, oo, aa) { later.push(function () { rr._bk.ah = aa; rr._bk.bh = h(vw(oo)); if (isInv && K.stock && APP === 'sell') K.stock(rr, false); }); })(r, o, ah);
      }
    });

    /* Books records not linked yet: pair with a clearly identical app record, else import */
    bArr.forEach(function (b) {
      if (!b || b.id == null || linked[String(b.id)] || R[String(b.id)]) return;
      var mate = null;
      K.list().forEach(function (r) {
        if (mate || r._bk) return;
        if (isInv) { if (K.eligible(r)) { var t = K.toBooks(r, false, {}); if (String(t.invoiceNumber) === String(b.invoiceNumber) && t.date === b.date && low(t.customer) === low(b.customer) && Math.abs(Number(t.totalKES) - Number(b.totalKES != null ? b.totalKES : b.total)) < 0.01) mate = r; } }
        else if (K.match ? K.match(r, b) : low(K.nameOf(r)) === low(b.name)) mate = r;
      });
      if (mate) { mate._bk = { id: b.id, bh: h(vw(b)), ah: h(vw(K.toBooks(mate, false, taken))), ph: h(payView(b)) }; if (isInv && K.stock && APP === 'sell') K.stock(mate, false); R[String(b.id)] = { a: mate.id, m: 0, t: 0 }; changed = true; linked[String(b.id)] = mate; return; }
      var n = K.make(b, taken); if (!n) return;
      n._bk = { id: b.id, bh: h(vw(b)), ah: '', ph: h(payView(b)), imp: 1 };
      if (!K.list().some(function (x) { return x.id === n.id; })) {
        K.add(n); n._bk.ah = h(vw(K.toBooks(n, false, taken)));
        if (isInv) { K.pay(n, b, inbox, b.id); if (K.stock && APP === 'sell') K.stock(n, true); }
        R[String(b.id)] = { a: n.id, m: 0, t: 0 }; changed = true; linked[String(b.id)] = n;
      }
    });

    /* app records Books has never seen */
    K.list().slice().forEach(function (r) {
      if (r._bk) return;
      if (isInv && !K.eligible(r)) return;
      if (!isInv && !String(K.nameOf(r) || '').trim()) return;
      var o = K.toBooks(r, true, taken); o.id = K.bookIdFor ? K.bookIdFor(r) : bookId(r.id, isInv);
      if (K.bookIdFor && byId[String(o.id)]) o.id = String(o.id) + '-' + hx(String(r.id)).slice(0, 3);   /* same number already used by a different person in Books */
      if (!isInv && !K.noExtras) { o.createdAt = new Date().toISOString(); o.receivables = 0; } else if (isInv) taken[o.invoiceNumber] = 1;
      pushes.push(o);
      (function (rr, oo) { later.push(function () { rr._bk = { id: oo.id, bh: h(vw(oo)), ah: h(vw(K.toBooks(rr, false, taken))), ph: h(payView(oo)) }; if (isInv && K.stock && APP === 'sell') K.stock(rr, false); R[String(oo.id)] = { a: rr.id, m: 0, t: 0 }; }); })(r, o);
    });

    var rpc = w.AcaciaCloud.rpc;
    for (var i = 0; i < pushes.length; i += 100) await rpc('acx_books_upsert', { p_company: company, p_key: key, p_records: pushes.slice(i, i + 100) });
    if (deletes.length) await rpc('acx_books_delete', { p_company: company, p_key: key, p_ids: deletes });
    later.forEach(function (f) { f(); });
    if (pushes.length || deletes.length) changed = true;
    return changed;
  }

  /* Sell payments -> Books "payments to post" */
  function queuePayments(ad, out) {
    if (APP !== 'sell') return false;
    var d = db(), R = reg('pay'), any = false;
    (d.payments || []).forEach(function (p) {
      if (R[p.id]) return;
      var inv = d.invoices.find(function (i) { return i.id === p.invoiceId; }); if (!inv || !inv._bk) return;
      var c = d.customers.find(function (x) { return x.id === inv.custId; });
      out.inbox.push({ id: 'pay-' + p.id, type: 'payment', status: 'pending', app: 'Sell', date: p.date || today(), customer: c ? c.name : '', invoiceId: inv._bk.id, invoiceNumber: ad.inv.bookNo(inv, {}), amount: Number(p.amount) || 0, method: p.method || 'Cash', reference: p.id, createdAt: new Date().toISOString() });
      out.paid.push(p.id); any = true;
    });
    return any;
  }


  /* Payroll: approved pay runs -> Books "payroll to post" (Books works out its own statutory deductions) */
  function queueRuns(out) {
    if (APP !== 'payroll') return false;
    var d = db(), R = reg('run'), any = false;
    (d.payRuns || []).forEach(function (run) {
      if (!run || R[run.id] || ['Approved', 'Posted', 'Paid'].indexOf(run.status) < 0) return;
      var lines = (run.lines || []).map(function (l) {
        var e = (d.employees || []).find(function (x) { return x.id === l.employeeId; });
        return { empId: String((e && e._bk && e._bk.id) || l.empNo || l.employeeId), empNo: l.empNo || '', name: l.name || '', gross: r2(l.gross), net: r2(l.net) };
      }).filter(function (l) { return l.gross > 0; });
      if (!lines.length) return;
      var pd = String(run.payDate || '').slice(0, 7) || today().slice(0, 7);
      out.inbox.push({ id: 'run-' + run.id, type: 'payroll', status: 'pending', app: 'Payroll', period: run.period || pd, month: pd, payDate: run.payDate || '', lines: lines, gross: r2(lines.reduce(function (a, l) { return a + l.gross; }, 0)), net: r2(lines.reduce(function (a, l) { return a + l.net; }, 0)), createdAt: new Date().toISOString() });
      out.runs.push(run.id); any = true;
    });
    return any;
  }

  function readKeys() { var k = ['customers', 'invoices', 'suppliers', 'employees', 'projects', 'appInbox']; if (APP === 'expenses') k.push('chartOfAccounts', 'banks'); if (APP === 'projects') k.push('plans', 'budgets'); return k; }

  async function sync(force) {
    if (busy) return; var u = user(); APP = detect();
    if (!u || !APP) return;
    if (!w.AcaciaCloud || !isBooksCo(u.companyId)) { ST.company = u.companyId || ''; setSt('warn', 'This login has no company ID that Books can match (ID "' + (u.companyId || 'none') + '"). Sign in with the same company account that Books uses.'); return; }
    ST.company = u.companyId;
    busy = true;
    try {
      var rows = {}, res = await w.AcaciaCloud.rpc('acx_books_read', { p_company: u.companyId, p_keys: readKeys() });
      (res || []).forEach(function (r) { rows[r.key] = r; });
      if (APP === 'projects' && rows.projects) {
        try { var pj = JSON.parse(rows.projects.value); if (typeof pj === 'string') pj = JSON.parse(pj);
          if (Array.isArray(pj) && pj.some(function (x) { return x && x.id == null; })) {
            await w.AcaciaCloud.rpc('acx_books_upsert', { p_company: u.companyId, p_key: 'projects', p_records: [] });
            rows = {}; ((await w.AcaciaCloud.rpc('acx_books_read', { p_company: u.companyId, p_keys: readKeys() })) || []).forEach(function (r) { rows[r.key] = r; });
          } } catch (e) { throw e; }
      }
      var nB = { c: 0, i: 0, s: 0, e: 0, p: 0 };
      ['customers', 'invoices', 'suppliers', 'employees', 'projects'].forEach(function (k) { try { var a = rows[k] && JSON.parse(rows[k].value); if (typeof a === 'string') a = JSON.parse(a); if (Array.isArray(a)) nB[k[0]] = a.length; } catch (e) {} });
      ST.counts = APP === 'projects' ? 'Books has ' + nB.p + ' projects for this company ID.' : APP === 'payroll' ? 'Books has ' + nB.e + ' employees for this company ID.' : 'Books has ' + nB.c + ' customers, ' + nB.i + ' invoices, ' + nB.s + ' suppliers for this company ID.';
      if (APP === 'projects') { try { var cu = rows.customers && JSON.parse(rows.customers.value); if (typeof cu === 'string') cu = JSON.parse(cu); clientNames = (cu || []).map(function (x) { return x && x.name; }).filter(Boolean).sort(); applyClientList(); } catch (e) {} }
      if (APP === 'projects') {
        var bd = { plans: [], budgets: [] };
        ['plans', 'budgets'].forEach(function (k) { try { var v = rows[k] && JSON.parse(rows[k].value); if (typeof v === 'string') v = JSON.parse(v); if (Array.isArray(v)) bd[k] = v; } catch (e) {} });
        w.AcaciaBooksData = bd; ST.extra = bd.plans.length + ' plans and ' + bd.budgets.length + ' budgets from Books are available in the project form.';
      }
      var inbox = []; try { if (rows.appInbox) { var q = JSON.parse(rows.appInbox.value); if (typeof q === 'string') q = JSON.parse(q); if (Array.isArray(q)) inbox = q; } } catch (e) {}
      var out = { inbox: [], paid: [], runs: [], usedNames: {} }, ad = A[APP], c1 = false, c2 = false, c3 = false;
      try { var iv = rows.invoices && JSON.parse(rows.invoices.value); if (typeof iv === 'string') iv = JSON.parse(iv); (iv || []).forEach(function (x) { if (x && x.customer) out.usedNames[low(x.customer)] = 1; }); } catch (e) {}
      if (ad.cust) c1 = await pass(u.companyId, ad.cust, ad.view || custView, rows, ad.key || 'customers', false, inbox, out);
      if (ad.inv) c2 = await pass(u.companyId, ad.inv, invView, rows, 'invoices', true, inbox, out);
      c3 = queuePayments(ad, out); c3 = queueRuns(out) || c3;
      var keepExtra = ST.extra; ST.extra = APP === 'projects' ? keepExtra : ''; if (ad.afterRead) { try { c3 = ad.afterRead(rows) || c3; } catch (e) { console.warn('[acacia-bridge] accounts', e); } }
      if (out.inbox.length) {
        await w.AcaciaCloud.rpc('acx_books_upsert', { p_company: u.companyId, p_key: 'appInbox', p_records: out.inbox });
        out.paid.forEach(function (id) { reg('pay')[id] = 1; });
        out.runs.forEach(function (id) { reg('run')[id] = 1; });
      }
      setSt((APP === 'projects' ? nB.p : APP === 'payroll' ? nB.e : nB.c + nB.i + nB.s) === 0 ? 'warn' : 'ok', (APP === 'projects' ? nB.p : APP === 'payroll' ? nB.e : nB.c + nB.i + nB.s) === 0 ? 'Connected, but Books has no customers, invoices or suppliers under this company ID (for Payroll: no employees, for Projects: no projects). If Books does have data, Books is using a different company ID than this login — run acacia_sync_diagnose.sql in Supabase to compare.' : 'Connected and in sync.');
      if (c1 || c2 || c3 || out.inbox.length) { selfSave = true; try { ad.save(); } finally { selfSave = false; } try { var a = document.activeElement; if (!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) ad.render(); } catch (e) {} }
    } catch (e) { console.error('[acacia-bridge]', e); ST.err = String((e && (e.message || e.code || e.status)) || e); setSt('error', explain(e)); }
    busy = false;
  }
  function soon(ms) { clearTimeout(timer); timer = setTimeout(sync, ms || 4000); }

  /* sell: show Books line items by name */
  if (typeof w.prodName === 'function') { var _pn = w.prodName; w.prodName = function (id) { return String(id).indexOf('BK:') === 0 ? String(id).slice(3) : _pn(id); }; }

  var rawSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k) { rawSet.apply(this, arguments); try { if (!selfSave && this === w.localStorage && /_(ACC-\d+|company_[A-Za-z0-9_]+)$/i.test(String(k)) && user()) soon(4000); } catch (e) {} };
  setInterval(function () { if (!document.hidden) sync(); }, 20000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) soon(800); });
  setTimeout(function wait() { if (user()) sync(); setTimeout(wait, user() ? 60000 : 1500); }, 1500);
  w.AcaciaBridge = { sync: sync, status: function () { return ST; } };
})(window);
