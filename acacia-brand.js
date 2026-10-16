/* acacia-brand.js — gives the Acacia apps the same logo and user avatar as Acacia Books.
 *  LOGO   : the sidebar shows acaciabooks-logo.png (same file/name Books, Inventory and Plans use) above the app name.
 *           If the PNG is missing from the app folder nothing changes (the old text/icon stays).
 *  AVATAR : click your avatar to choose a photo (square-cropped to 256px JPEG, exactly like Books). It is saved in this browser
 *           and in the same Supabase table Books uses (app_user_avatars, per company + user), so the photo you set in Books
 *           shows in every app and the other way round. No SQL needed - Books already created the table.
 * Used by Sell, CRM, Expenses, Projects and Payroll vol 2 (same file). Needs acaciabooks-logo.png next to index.html. */
(function (w) {
  'use strict';
  var URL_ = 'https://xglsampckermarjpczdf.supabase.co';
  var KEY_ = 'sb_publishable_x-dPR7pzhvJgag9soW0I8w_yfKTmi6A';
  var H = { apikey: KEY_, Authorization: 'Bearer ' + KEY_, 'Content-Type': 'application/json' };
  var TABLE = 'app_user_avatars', SIZE = 256, MAX_FILE = 10 * 1024 * 1024, EVERY = 60000;
  var LOGO_SRC = 'acaciabooks-logo.png';
  var d = document;
  var low = function (v) { return String(v == null ? '' : v).trim().toLowerCase(); };
  var enc = encodeURIComponent;
  function $(id) { return d.getElementById(id); }
  function rawSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  /* ---------------------------------------------------------------- LOGO */
  var css = d.createElement('style');
  css.textContent =
    '.acx-brand-logo{display:block;width:96px;max-width:70%;height:auto;margin:0 auto 10px;object-fit:contain}' +
    '.acx-logo-ok .mark svg,.acx-logo-ok .mark .leaf,.acx-logo-ok>svg,.acx-logo-ok .brand>svg{display:none!important}' +
    '.acx-logo-ok.acx-hide-mark .mark,.acx-logo-ok.acx-hide-mark .brand-mark{display:none!important}' +
    '.acx-photo{background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important;' +
    'background-color:transparent!important;color:transparent!important;text-shadow:none!important}' +
    '.acx-avatar-click{cursor:pointer}' +
    '#acxProjAvatar{width:34px;height:34px;border-radius:50%;background:#D9A441;color:#1c2b1c;display:flex;align-items:center;' +
    'justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}';
  (d.head || d.documentElement).appendChild(css);

  function brandBox() {
    return d.querySelector('#sidebar .brandbar') || d.querySelector('.sidebar .brand') || d.querySelector('#sidebar .brand');
  }
  function addLogo() {
    var box = brandBox();
    if (!box || box.querySelector('.acx-brand-logo')) return !!box;
    var img = new Image();
    img.className = 'acx-brand-logo';
    img.id = 'sidebarLogo';
    img.alt = 'Acacia';
    img.onload = function () {
      box.classList.add('acx-logo-ok');
      /* Projects / Expenses keep only the app name, so the generic word mark is hidden */
      if (box.querySelector('.brand-mark') || (box.querySelector('.mark') && box.querySelector('h1'))) box.classList.add('acx-hide-mark');
      box.insertBefore(img, box.firstChild);
    };
    img.onerror = function () { img.remove(); };
    img.src = LOGO_SRC;
    return true;
  }

  /* -------------------------------------------------------------- AVATAR */
  function curUser() {
    var u = null;
    try { u = CURRENT_USER; } catch (e) {}
    if (!u || !(u.email || u.name) || !u.companyId) return null;
    return u;
  }
  var ident = null;   /* { company, email, key, alt } for the signed-in user */
  var identFor = '';
  function keysFor(id) { return { img: '__userAvatar_' + id.key, at: '__userAvatarAt_' + id.key, dirty: '__userAvatarDirty_' + id.key }; }

  async function rest(path, opt) {
    var ctl = w.AbortController ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, 12000) : null;
    try {
      var r = await fetch(URL_ + '/rest/v1/' + path, Object.assign({ headers: H, signal: ctl ? ctl.signal : undefined }, opt || {}));
      if (t) clearTimeout(t);
      return r;
    } catch (e) { if (t) clearTimeout(t); return null; }
  }

  /* Books keys the photo on username||email; the apps only know the email, so look the username up once */
  async function resolveIdent() {
    var u = curUser();
    if (!u) { ident = null; identFor = ''; return null; }
    var email = low(u.email), sig = u.companyId + '|' + email;
    if (ident && identFor === sig) return ident;
    var key = email || low(u.name);
    try {
      var r = await rest('app_accounts?select=username&login_id=eq.' + enc(email) + '&company_id=eq.' + enc(u.companyId));
      if (r && r.ok) { var rows = await r.json(); if (rows && rows[0] && rows[0].username) key = low(rows[0].username); }
    } catch (e) {}
    ident = { company: String(u.companyId), email: email, key: key, alt: email, name: u.name || u.email || key };
    identFor = sig;
    return ident;
  }

  function initialsOf(n) {
    var p = String(n || '?').trim().split(/\s+/);
    return ((p[0] || '?').charAt(0) + (p[1] ? p[1].charAt(0) : '')).toUpperCase();
  }

  /* Projects has no avatar in its UI: add one to the sidebar footer */
  function ensureProjectsAvatar() {
    if ($('userAvatar') || $('userBadge') || $('acxProjAvatar')) return;
    var foot = d.querySelector('.sidebar .foot');
    if (!foot || !$('sidebarUser')) return;
    var a = d.createElement('div');
    a.id = 'acxProjAvatar';
    foot.insertBefore(a, foot.firstChild);
  }
  function targets() {
    ensureProjectsAvatar();
    return ['userAvatar', 'userBadge', 'acxProjAvatar'].map($).filter(Boolean);
  }
  function show(src, id) {
    targets().forEach(function (el) {
      if (el.id === 'acxProjAvatar') el.textContent = initialsOf(id ? id.name : '?');
      el.classList.add('acx-avatar-click');
      el.title = 'Click to change your photo';
      if (src) {
        el.classList.add('acx-photo');
        el.style.setProperty('background-image', 'url("' + src + '")', 'important');
      } else {
        el.classList.remove('acx-photo');
        el.style.removeProperty('background-image');
      }
    });
  }

  async function push(id, dataUrl, at) {
    var k = keysFor(id);
    var r = await rest(TABLE + '?on_conflict=company_id,user_key', {
      method: 'POST',
      headers: Object.assign({}, H, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([{ company_id: id.company, user_key: id.key, avatar: dataUrl, updated_at: at }])
    });
    if (r && r.ok) { try { localStorage.removeItem(k.dirty); } catch (e) {} return true; }
    rawSet(k.dirty, '1');
    return false;
  }

  var busy = false;
  async function sync() {
    var id = await resolveIdent();
    if (!id) { show('', null); return; }
    var k = keysFor(id);
    var localImg = localStorage.getItem(k.img) || '', localAt = localStorage.getItem(k.at) || '';
    show(localImg, id);
    if (busy) return;
    busy = true;
    try {
      var keys = id.key === id.alt ? '"' + id.key + '"' : '"' + id.key + '","' + id.alt + '"';
      var r = await rest(TABLE + '?select=avatar,updated_at,user_key&company_id=eq.' + enc(id.company) + '&user_key=in.(' + enc(keys) + ')');
      if (!r || !r.ok) return;
      var rows = (await r.json()) || [], row = null;
      rows.forEach(function (x) { if (x && x.avatar && (!row || new Date(x.updated_at) > new Date(row.updated_at))) row = x; });
      var cloudAt = row ? String(row.updated_at || '') : '';
      var cloudNewer = row && (!localImg || !localAt || new Date(cloudAt) > new Date(localAt));
      if (cloudNewer) {
        rawSet(k.img, row.avatar); rawSet(k.at, cloudAt);
        try { localStorage.removeItem(k.dirty); } catch (e) {}
        show(row.avatar, id);
      } else if (localImg && (!row || localStorage.getItem(k.dirty) || new Date(localAt) > new Date(cloudAt))) {
        var at = localAt || new Date().toISOString();
        rawSet(k.at, at);
        await push(id, localImg, at);
      }
    } catch (e) { /* offline: try again on the next tick */ }
    finally { busy = false; }
  }

  /* same crop/resize as Books: centre square, 256px, JPEG 0.85 */
  function shrink(file) {
    return new Promise(function (ok, bad) {
      var fr = new FileReader();
      fr.onerror = function () { bad(new Error('Could not read the file')); };
      fr.onload = function () {
        var img = new Image();
        img.onerror = function () { bad(new Error('That file is not a valid image')); };
        img.onload = function () {
          var s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) / 2;
          var cv = d.createElement('canvas'); cv.width = cv.height = SIZE;
          var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, SIZE, SIZE);
          cx.drawImage(img, sx, sy, s, s, 0, 0, SIZE, SIZE);
          ok(cv.toDataURL('image/jpeg', 0.85));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  var picker = null;
  function openPicker() {
    if (!picker) {
      picker = d.createElement('input');
      picker.type = 'file'; picker.accept = 'image/*'; picker.style.display = 'none';
      picker.addEventListener('change', onPick);
      d.body.appendChild(picker);
    }
    picker.click();
  }
  async function onPick() {
    var f = picker.files && picker.files[0];
    if (!f) return;
    var id = await resolveIdent();
    if (!id) { alert('User not logged in — cannot save avatar.'); picker.value = ''; return; }
    if (!/^image\//.test(f.type)) { alert('Please choose an image file.'); picker.value = ''; return; }
    if (f.size > MAX_FILE) { alert('That image is too large. Choose one under 10 MB.'); picker.value = ''; return; }
    try {
      var data = await shrink(f), k = keysFor(id), at = new Date().toISOString();
      if (!rawSet(k.img, data)) { alert('Browser storage is full — could not save the photo.'); picker.value = ''; return; }
      rawSet(k.at, at);
      show(data, id);
      await push(id, data, at);
    } catch (err) { alert(err.message || 'Could not use that image.'); }
    picker.value = '';
  }

  /* avatar click = change photo (as in Books); stop it from also opening the user menu */
  d.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('#userAvatar,#userBadge,#acxProjAvatar');
    if (!t || !curUser()) return;
    e.stopPropagation(); e.preventDefault();
    openPicker();
  }, true);

  /* ---------------------------------------------------------------- boot */
  var last = '';
  function tick() {
    addLogo();
    var u = curUser(), sig = u ? u.companyId + '|' + low(u.email) : '';
    if (sig !== last) { last = sig; ident = null; if (u) sync(); else show('', null); }
  }
  function boot() {
    tick();
    setInterval(function () { if (!d.hidden) tick(); }, 2000);
    setInterval(function () { if (!d.hidden) sync(); }, EVERY);
    d.addEventListener('visibilitychange', function () { if (!d.hidden) sync(); });
    w.addEventListener('focus', function () { sync(); });
    w.addEventListener('online', function () { sync(); });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
