/* Public home page: single-view navigation, same behaviour as the Support site */
  function hpMore(btn){
    var card=btn.closest('.hp-tier');
    var open=card.classList.toggle('hp-open');
    btn.innerHTML=open?'Show less &#9652;':'Show '+btn.getAttribute('data-n')+' more features &#9662;';
  }
  function hpBillingToggle(){
    var yearly=document.getElementById('hpBilling').checked;
    document.querySelectorAll('#homePage .hp-amt').forEach(function(el){
      var p=yearly?+el.getAttribute('data-year'):+el.getAttribute('data-month');
      el.textContent='KES '+p.toLocaleString('en-US');
      var per=el.parentElement.querySelector('.hp-per');
      if(per) per.textContent=yearly?'/yr':'/mo';
    });
  }
(function(){
  var root=document.getElementById('homePage');
  var slides=root.querySelectorAll('.hp-slide'),si=0;
  setInterval(function(){
    if(root.style.display!=='block'||slides.length<2) return;
    slides[si].classList.remove('active'); si=(si+1)%slides.length; slides[si].classList.add('active');
  },5000);
  var nav=document.getElementById('hpNav'),burger=document.getElementById('hpBurger');
  burger.addEventListener('click',function(){
    var open=nav.classList.toggle('open');
    burger.setAttribute('aria-expanded',open?'true':'false');
  });
  var pages=root.querySelectorAll('.hp-page');
  var valid={top:1,about:1,features:1,process:1,pricing:1,faq:1,contact:1};
  function show(id){
    if(!valid[id]) id='top';
    pages.forEach(function(p){p.classList.toggle('hp-active',p.getAttribute('data-page')===id);});
    root.querySelectorAll('.hp-nav a').forEach(function(a){a.classList.toggle('hp-current',a.getAttribute('href')==='#'+id);});
    nav.classList.remove('open'); burger.setAttribute('aria-expanded','false');
    root.scrollTop=0;
  }
  root.querySelectorAll('a[data-scroll]').forEach(function(a){
    a.addEventListener('click',function(e){ e.preventDefault(); show(a.getAttribute('href').slice(1)); });
  });
  var y=document.getElementById('footerYear'); if(y) y.textContent=new Date().getFullYear();
  show('top');
  window.hpShowPage=show;
})();
function hpShowHome(){
  document.getElementById('authScreen').style.display='none';
  document.getElementById('homePage').style.display='block';
  window.hpShowPage&&window.hpShowPage('top');
}
function hpHideHome(){ document.getElementById('homePage').style.display='none'; }
function hpShowLogin(tab){
  hpHideHome();
  document.getElementById('authScreen').style.display='flex';
  switchAuthTab(tab||'login');
}
function hpTheme(){
  var r=document.getElementById('homePage'); var d=r.classList.toggle('hp-dark');
  try{ localStorage.setItem('acacia_home_theme', d?'dark':'light'); }catch(e){}
}
try{ if(localStorage.getItem('acacia_home_theme')==='dark') document.getElementById('homePage').classList.add('hp-dark'); }catch(e){}
function hpContact(e){
  e.preventDefault();
  var n=document.getElementById('hpName').value.trim(), m=document.getElementById('hpEmail').value.trim(), t=document.getElementById('hpMsg').value.trim();
  var body='From: '+n+' <'+m+'>\n\n'+t;
  window.location.href='mailto:hello@example.com?subject='+encodeURIComponent('Acacia Expenses enquiry')+'&body='+encodeURIComponent(body);
  document.getElementById('contactConfirm').classList.remove('hidden');
  return false;
}
;
/* ===== acacia-cloud: shared Supabase layer for the Acacia apps (same project as Books) =====
   - Sign in / sign up against the same accounts Books uses (table app_accounts)
   - New companies + users show up in Support (acacia_company_status, app_accounts, acacia_app_usage)
   - Each app's data is saved per company in acacia_app_data and loaded on any device
   Needs acacia_apps_cloud.sql to be run once in Supabase. Offline: falls back to this browser's copy. */
(function (w) {
  'use strict';
  var URL_ = 'https://xglsampckermarjpczdf.supabase.co';
  var KEY_ = 'sb_publishable_x-dPR7pzhvJgag9soW0I8w_yfKTmi6A';
  var H = { apikey: KEY_, Authorization: 'Bearer ' + KEY_, 'Content-Type': 'application/json' };
  var cfg = null, ctx = null, timer = 0, hbTimer = 0;
  var rawSet = Storage.prototype.setItem;
  var low = function (v) { return String(v == null ? '' : v).trim().toLowerCase(); };
  var enc = encodeURIComponent;
  var isCloudId = function (id) { return /^ACC-\d+$/i.test(String(id || '')); };
  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }

  async function req(path, opt) {
    var ctl = w.AbortController ? new AbortController() : null;
    var t = ctl ? setTimeout(function () { ctl.abort(); }, 12000) : null;
    try {
      var r = await fetch(URL_ + '/rest/v1/' + path, Object.assign({ headers: H, signal: ctl ? ctl.signal : undefined }, opt || {}));
      if (t) clearTimeout(t);
      return r;
    } catch (e) { if (t) clearTimeout(t); throw err('offline', 'Cannot reach the Acacia cloud. Check your internet connection.'); }
  }
  async function rpc(name, args) {
    var r = await req('rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) });
    var j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) {
      var m = (j && (j.message || j.hint)) || ('HTTP ' + r.status);
      var e = err(/already exists|exists/i.test(m) ? 'exists' : (r.status === 404 ? 'missing' : 'rpc'), m); e.status = r.status; throw e;
    }
    return j;
  }

  /* same hashing as Books: SHA-256 of "salt:password" */
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function newSalt() { var a = new Uint8Array(16); crypto.getRandomValues(a); return hex(a); }
  async function hash(pass, salt) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pass))); }
  async function verify(d, pass) {
    d = d || {};
    if (d.passwordHash && d.passwordSalt) return (await hash(pass, d.passwordSalt)) === d.passwordHash;
    return typeof d.password === 'string' && d.password === pass;
  }
  function mapRole(r, d) { return cfg && cfg.mapRole ? cfg.mapRole(r, d) : (/^admin/i.test(String(r || '')) ? 'Administrator' : (r || 'Administrator')); }

  /* deleted / suspended companies are blocked (fails open if the cloud can't be reached) */
  async function gate(cid, login) {
    try { if ((await rpc('acx_account_state', { p_company: low(cid), p_login: low(login) })) === 'deleted') return 'This account was removed by Acacia support.'; } catch (e) {}
    try {
      var r = await req('acacia_company_status?select=status&company_id=eq.' + enc(cid));
      if (r.ok) { var j = await r.json(); var s = j[0] && j[0].status; if (s === 'pending') return 'Your company is waiting for approval by Acacia support. You will be able to sign in as soon as it is approved.'; if (s && s !== 'active') return 'Your company account is "' + s + '". Please contact Acacia support.'; }
    } catch (e) {}
    return null;
  }

  async function signIn(email, pass, company) {
    email = low(email);
    var r = await req('app_accounts?select=login_id,username,company_id,data&login_id=eq.' + enc(email));
    if (!r.ok) throw err('offline', 'Could not read accounts (' + r.status + '). Run acacia_apps_cloud.sql in Supabase.');
    var rows = await r.json(), ok = [], cn = low(company);
    if (cn) rows = rows.filter(function (x) { var d = x.data || {}; return low(d.companyName) === cn || low(x.company_id) === cn || (d.previousCompanyNames || []).map(low).indexOf(cn) > -1; });
    for (var i = 0; i < rows.length; i++) if (await verify(rows[i].data, pass)) ok.push(rows[i]);
    if (!ok.length) return null;
    var row = ok[0];
    if (ok.length > 1) {
      var pick = w.prompt('This login belongs to more than one company:\n' + ok.map(function (x, n) { return (n + 1) + '. ' + ((x.data && x.data.companyName) || x.company_id) + ' (' + x.company_id + ')'; }).join('\n') + '\n\nType the number to open:', '1');
      row = ok[(parseInt(pick, 10) || 1) - 1] || ok[0];
    }
    var msg = await gate(row.company_id, email); if (msg) throw err('blocked', msg);
    var d = row.data || {};
    return { companyId: row.company_id, company: d.companyName || '', name: d.fullName || d.username || email.split('@')[0], email: email, role: mapRole(d.role, d), passwordHash: d.passwordHash, passwordSalt: d.passwordSalt };
  }

  async function register(o) {
    var salt = newSalt(), h = await hash(o.password, salt);
    var id = await rpc('acx_register_company', { p_company: o.company, p_name: o.name, p_email: low(o.email), p_hash: h, p_salt: salt, p_app: cfg.app });
    var blocked = await gate(id, o.email);
    return { companyId: id, passwordHash: h, passwordSalt: salt, blocked: blocked };
  }

  /* teammates added inside an app (CRM Users & Roles). The app's own role is kept per app; Books sees admin/user */
  var booksRole = function (r) { return /^admin/i.test(String(r || '')) ? 'admin' : 'user'; };
  async function addUser(o) {
    var salt = newSalt(), h = await hash(o.password, salt);
    await rpc('acx_add_user', { p_company: o.companyId, p_name: o.name, p_email: low(o.email), p_role: booksRole(o.role), p_hash: h, p_salt: salt, p_app: cfg.app, p_app_role: o.role || '' });
    return { passwordHash: h, passwordSalt: salt };
  }
  function setRole(companyId, email, role) { return rpc('acx_set_user_role', { p_company: companyId, p_email: low(email), p_role: booksRole(role), p_app: cfg.app, p_app_role: role || '' }); }
  function removeUser(companyId, email) { return rpc('acx_remove_user', { p_company: companyId, p_email: low(email) }); }

  /* keep a copy of cloud users in this browser so the app's own session code keeps working (and offline sign-in) */
  function cacheUser(usersKey, u) {
    try {
      var list = JSON.parse(localStorage.getItem(usersKey) || '[]');
      var rec = { companyId: u.companyId, company: u.company, name: u.name, email: low(u.email), role: u.role, passwordHash: u.passwordHash, passwordSalt: u.passwordSalt };
      var i = list.findIndex(function (x) { return low(x.email) === rec.email && x.companyId === rec.companyId; });
      if (i > -1) { list[i] = Object.assign({}, list[i], rec); delete list[i].password; } else list.push(rec);
      rawSet.call(localStorage, usersKey, JSON.stringify(list));
    } catch (e) {}
  }
  function verifyLocal(u, pass) { return verify(u, pass); }

  /* accounts that only ever existed in this browser get a cloud company; their data and teammates move with them.
     'all' is the local users array: it is updated in place (caller saves it). Returns the signed-in user's new record. */
  async function migrate(u, pass, all) {
    var oldId = u.companyId, same = (all || [u]).filter(function (x) { return x.companyId === oldId; });
    var owner = same.find(function (x) { return /^admin/i.test(String(x.role || 'Administrator')) && x.password; }) || u;
    var ownerPass = owner === u ? pass : owner.password;
    var r = await register({ company: owner.company, name: owner.name, email: owner.email, password: ownerPass });
    for (var i = 0; i < same.length; i++) {
      var x = same[i];
      if (x === owner) { x.passwordHash = r.passwordHash; x.passwordSalt = r.passwordSalt; }
      else {
        var pw = x === u ? pass : x.password;
        if (pw) { try { var h = await addUser({ companyId: r.companyId, name: x.name, email: x.email, password: pw, role: x.role || 'Administrator' }); x.passwordHash = h.passwordHash; x.passwordSalt = h.passwordSalt; } catch (e) { continue; } }
        else continue;
      }
      delete x.password; x.companyId = r.companyId;
    }
    var o = cfg.dataKey(oldId), n = cfg.dataKey(r.companyId), v = localStorage.getItem(o);
    if (v != null) { rawSet.call(localStorage, n, v); localStorage.removeItem(o); rawSet.call(localStorage, dirtyKey(r.companyId), '1'); }
    return same.find(function (x) { return low(x.email) === low(u.email) && x.companyId === r.companyId; }) || null;
  }

  /* ---- data sync (one JSON blob per company per app) ---- */
  function tsKey(c) { return 'acx_ts_' + cfg.app + '_' + (c || ctx.companyId); }
  function dirtyKey(c) { return 'acx_dirty_' + cfg.app + '_' + (c || ctx.companyId); }
  async function pullRow(app) {
    var r = await req('acacia_app_data?select=value,updated_at&key=eq.data&company_id=eq.' + enc(ctx.companyId) + '&app=eq.' + enc(app));
    if (!r.ok) return null; var j = await r.json(); return j[0] || null;
  }
  async function pushNow() {
    if (!ctx || !isCloudId(ctx.companyId)) return false;
    var v = localStorage.getItem(cfg.dataKey(ctx.companyId)); if (v == null) return false;
    try {
      var r = await req('acacia_app_data?on_conflict=company_id,app,key', { method: 'POST', headers: Object.assign({}, H, { Prefer: 'resolution=merge-duplicates,return=representation' }), body: JSON.stringify({ company_id: ctx.companyId, app: cfg.app, key: 'data', value: v }) });
      if (r.ok) { var j = await r.json(); rawSet.call(localStorage, tsKey(), (j[0] && j[0].updated_at) || ''); localStorage.removeItem(dirtyKey()); return true; }
    } catch (e) {}
    return false;
  }
  function schedule() {
    if (!ctx || !isCloudId(ctx.companyId)) return;
    rawSet.call(localStorage, dirtyKey(), '1');
    clearTimeout(timer); timer = setTimeout(pushNow, 2500);
  }
  function flush() {
    if (!ctx || !isCloudId(ctx.companyId) || localStorage.getItem(dirtyKey()) !== '1') return;
    clearTimeout(timer);
    var v = localStorage.getItem(cfg.dataKey(ctx.companyId)); if (v == null) return;
    try {
      fetch(URL_ + '/rest/v1/acacia_app_data?on_conflict=company_id,app,key', { method: 'POST', keepalive: v.length < 60000, headers: Object.assign({}, H, { Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify({ company_id: ctx.companyId, app: cfg.app, key: 'data', value: v }) }).then(function (r) { if (r.ok) localStorage.removeItem(dirtyKey()); }).catch(function () {});
    } catch (e) {}
  }
  async function pullData() {
    var row = await pullRow(cfg.app);
    var dirty = localStorage.getItem(dirtyKey()) === '1', last = localStorage.getItem(tsKey());
    if (row && !dirty && row.updated_at !== last) { rawSet.call(localStorage, cfg.dataKey(ctx.companyId), row.value); rawSet.call(localStorage, tsKey(), row.updated_at); }
    else if (!row) { if (localStorage.getItem(cfg.dataKey(ctx.companyId)) != null) await pushNow(); }
    else if (dirty) await pushNow();
  }
  /* read-only copies of another app's data (e.g. Expenses reads Payroll) */
  async function pullExtras() {
    var ex = cfg.readFrom || [];
    for (var i = 0; i < ex.length; i++) { try { var row = await pullRow(ex[i].app); if (row) rawSet.call(localStorage, ex[i].dataKey(ctx.companyId), row.value); } catch (e) {} }
  }

  function heartbeat() {
    if (!ctx || !isCloudId(ctx.companyId) || !ctx.email) return;
    var k = 'acx_hb_' + ctx.companyId + '_' + cfg.app + '_' + ctx.email;
    if (Date.now() - Number(localStorage.getItem(k) || 0) < 3e5) return;
    rawSet.call(localStorage, k, String(Date.now()));
    try { fetch(URL_ + '/rest/v1/rpc/acx_heartbeat', { method: 'POST', headers: H, keepalive: true, body: JSON.stringify({ p_company: ctx.companyId, p_app: cfg.app, p_user: ctx.email, p_role: String(ctx.role || '') }) }).catch(function () {}); } catch (e) {}
  }

  /* called when a user enters the app: returns 'ok' | 'local' | 'blocked:<message>' */
  async function start(user) {
    ctx = { companyId: user.companyId, email: low(user.email), role: user.role || '' };
    if (!isCloudId(ctx.companyId)) return 'local';
    var msg = await gate(ctx.companyId, ctx.email); if (msg) return 'blocked:' + msg;
    try { await pullData(); await pullExtras(); } catch (e) {}
    heartbeat(); clearInterval(hbTimer); hbTimer = setInterval(function () { heartbeat(); }, 3e5);
    return 'ok';
  }
  function stop() { flush(); clearInterval(hbTimer); ctx = null; }

  function init(c) {
    cfg = c;
    Storage.prototype.setItem = function (k, v) {
      rawSet.apply(this, arguments);
      try { if (this === w.localStorage && ctx && k === cfg.dataKey(ctx.companyId)) schedule(); } catch (e) {}
    };
    w.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
  }

  w.AcaciaCloud = { init: init, signIn: signIn, register: register, addUser: addUser, setRole: setRole, removeUser: removeUser, cacheUser: cacheUser, verifyLocal: verifyLocal, migrate: migrate, start: start, stop: stop, flush: flush, isCloudId: isCloudId, gate: gate, URL: URL_, KEY: KEY_, rpc: rpc, req: req };
})(window);
;
/* ================= DATA LAYER ================= */
const USERS_KEY = 'acacia-payroll-users';
const SESSION_KEY = 'acacia-payroll-session';
function dataKeyFor(companyId){ return 'acacia_expenses_db_v1_' + companyId; }
function initials(name){ return (name||'').split(' ').filter(Boolean).slice(0,2).map(s=>s[0].toUpperCase()).join(''); }
function uid(prefix){ return prefix + '-' + Math.random().toString(36).slice(2,9); }

const DEFAULT_CATEGORIES = {
  "Operating Expenses": [
    "Rent Expense","Electricity Expense","Water Expense","Internet Expense",
    "Telephone Expense","Fuel Expense","Transport Expense","Office Supplies",
    "Repairs & Maintenance","Advertising","Insurance","Bank Charges",
    "Professional Fees","Software & Subscriptions","Miscellaneous Expense"
  ]
};

function defaultDB(){
  return {
    expenses: [],
    suppliers: [],
    categories: DEFAULT_CATEGORIES,
    nextExpNo: 1
  };
}

function loadDB(companyId){
  try{
    const raw = localStorage.getItem(dataKeyFor(companyId));
    if(!raw) throw new Error('none');
    const parsed = JSON.parse(raw);
    if(!parsed.categories) parsed.categories = DEFAULT_CATEGORIES;
    return parsed;
  }catch(e){
    const blank = defaultDB();
    try{ localStorage.setItem(dataKeyFor(companyId), JSON.stringify(blank)); }catch(e2){ console.error('init save failed', e2); }
    return blank;
  }
}
function saveDB(){ if(!CURRENT_USER) return; localStorage.setItem(dataKeyFor(CURRENT_USER.companyId), JSON.stringify(db)); }

/* ---------------------------- Auth ---------------------------- */
let db = null;
let CURRENT_USER = null;
let currentDetailId = null;
let editingId = null;

AcaciaCloud.init({app:'Expenses', dataKey:dataKeyFor, readFrom:[{app:'Payroll', dataKey:function(c){ return 'acacia-payroll-state_' + c; }}]});
function getUsers(){ try{ return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }catch(e){ return []; } }
function saveUsers(list){ try{ localStorage.setItem(USERS_KEY, JSON.stringify(list)); }catch(e){ console.error(e); } }
function getSession(){ try{ return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }catch(e){ return null; } }
function setSession(user){ try{ localStorage.setItem(SESSION_KEY, JSON.stringify({companyId:user.companyId, company:user.company, name:user.name, email:user.email})); }catch(e){ console.error(e); } }
function clearSession(){ try{ localStorage.removeItem(SESSION_KEY); }catch(e){ /* nothing to clear */ } }

function switchAuthTab(which){
  document.getElementById('tabLoginBtn').classList.toggle('active', which==='login');
  document.getElementById('tabRegisterBtn').classList.toggle('active', which==='register');
  document.getElementById('loginPane').style.display = which==='login' ? 'block' : 'none';
  document.getElementById('registerPane').style.display = which==='register' ? 'block' : 'none';
  document.getElementById('loginError').classList.remove('show');
  document.getElementById('registerError').classList.remove('show');
}
function showAuthError(id, msg){
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
}
async function handleRegister(){
  const company = document.getElementById('regCompany').value.trim();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value;
  if(!company || !name || !email || !password){ showAuthError('registerError','Please fill in every field.'); return; }
  if(password.length < 6){ showAuthError('registerError','Password must be at least 6 characters.'); return; }
  const users = getUsers();
  let user, viaCloud = false;
  try{
    const c = await AcaciaCloud.register({company, name, email, password});
    if(c.blocked){ showAuthError('registerError','Account created. ' + c.blocked); return; }
    user = {companyId:c.companyId, company, name, email, role:'Administrator', passwordHash:c.passwordHash, passwordSalt:c.passwordSalt};
    viaCloud = true;
  }catch(e){
    if(e.code === 'exists'){ showAuthError('registerError','This company already has an account with that email. Please sign in instead.'); return; }
    if(e.code !== 'offline'){ showAuthError('registerError', e.message || 'Could not create the account. Please try again.'); return; }
    if(users.some(u=>u.email===email)){ showAuthError('registerError','An account with that email already exists.'); return; }
    user = {companyId:uid('co'), company, name, email, password, role:'Administrator'};   // offline: uploaded the next time you sign in online
  }
  if(viaCloud) AcaciaCloud.cacheUser(USERS_KEY, user); else { users.push(user); saveUsers(users); }
  setSession(user);
  await enterApp(user);
}
async function handleLogin(){
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const company = (document.getElementById('loginCompany').value || '').trim();
  if(!company || !email || !password){ showAuthError('loginError','Please enter your company name, email and password.'); return; }
  let user = null;
  try{
    user = await AcaciaCloud.signIn(email, password, company);
    if(user) AcaciaCloud.cacheUser(USERS_KEY, user);
  }catch(e){
    if(e.code === 'blocked'){ showAuthError('loginError', e.message); return; }
  }
  if(!user){
    const users = getUsers();
    for(const u of users){ if(u.email === email && String(u.company||'').trim().toLowerCase() === company.toLowerCase() && await AcaciaCloud.verifyLocal(u, password)){ user = u; break; } }
    if(!user){ showAuthError('loginError','That email and password combination was not found.'); return; }
    if(!AcaciaCloud.isCloudId(user.companyId)){
      try{ const moved = await AcaciaCloud.migrate(user, password, users); if(moved){ saveUsers(users); user = moved; } }catch(e){ /* offline: stays on this device for now */ }
    }
  }
  setSession(user);
  await enterApp(user);
}
function handleLogout(){
  AcaciaCloud.stop();
  clearSession();
  CURRENT_USER = null;
  db = null;
  document.querySelector('.shell').classList.remove('ready');
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  switchAuthTab('login');
}
function toggleUserMenu(e){
  e.stopPropagation();
  document.getElementById('userMenuPanel').classList.toggle('open');
}
document.addEventListener('click', ()=>{ const m=document.getElementById('userMenuPanel'); if(m) m.classList.remove('open'); });

async function enterApp(user){
  let res = 'local';
  try{ res = await AcaciaCloud.start(user); }catch(e){}
  if(String(res).indexOf('blocked:') === 0){
    try{ clearSession(); }catch(e){}
    AcaciaCloud.stop();
    alert(String(res).slice(8));
    location.reload();
    return;
  }
  return __enterAppLocal(user);
}
function __enterAppLocal(user){
  CURRENT_USER = user;
  db = loadDB(user.companyId);
  document.getElementById('authScreen').style.display = 'none'; hpHideHome();
  document.querySelector('.shell').classList.add('ready');
  initUser();
  renderDashboard();
  renderExpenseTable();
  renderSuppliers();
  renderCategories();
  renderReports();
}
function boot(){
  const session = getSession();
  if(session && session.companyId){
    enterApp(session);
  }else{
    hpShowHome();
  }
}

/* ================= HELPERS ================= */
function fmt(n){
  n = Number(n)||0;
  return "KES " + n.toLocaleString('en-KE', {minimumFractionDigits:0, maximumFractionDigits:0});
}
function fmtPlain(n){
  n = Number(n)||0;
  return n.toLocaleString('en-KE', {minimumFractionDigits:2, maximumFractionDigits:2});
}
function fmtDate(iso){
  if(!iso) return "";
  const d = new Date(iso+"T00:00:00");
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function todayISO(){ return new Date().toISOString().slice(0,10); }
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}
function allCategoryNames(){
  let out = [];
  Object.values(db.categories).forEach(list => out = out.concat(list));
  return out;
}
function statusClass(s){
  return 'status-' + s.toLowerCase().replace(' approval','').replace(' ','-');
}

/* ================= NAV ================= */
document.querySelectorAll('.nav-item[data-view]').forEach(item=>{
  item.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-item[data-view]').forEach(i=>i.classList.remove('active'));
    item.classList.add('active');
    const v = item.dataset.view;
    document.querySelectorAll('.view').forEach(sec=>sec.classList.remove('active'));
    document.getElementById('view-'+v).classList.add('active');
    if(v==='expenses') renderExpenseTable();
    if(v==='dashboard') renderDashboard();
    if(v==='reports') renderReports();
    if(v==='categories') renderCategories();
    if(v==='connect') renderConnectStatus();
    if(v==='suppliers') renderSuppliers();
  });
});

document.getElementById('globalSearch').addEventListener('input', (e)=>{
  const v = e.target.value.trim();
  if(v.length===0) return;
  document.querySelector('.nav-item[data-view="expenses"]').click();
  document.getElementById('expFilterText').value = v;
  renderExpenseTable();
});

/* ================= INIT USER ================= */
function initUser(){
  if(!CURRENT_USER) return;
  document.getElementById('userName').textContent = CURRENT_USER.name;
  document.getElementById('userBadge').textContent = initials(CURRENT_USER.name) || CURRENT_USER.name.slice(0,1).toUpperCase();
  document.getElementById('userMenuCompany').textContent = CURRENT_USER.company;
}

/* ================= DASHBOARD ================= */
function renderDashboard(){
  const now = new Date();
  document.getElementById('dashDateLine').textContent = now.toLocaleDateString('en-GB',{weekday:'long', day:'numeric', month:'long', year:'numeric'});

  const exps = db.expenses;
  const total = exps.reduce((s,e)=>s+e.total,0);
  const monthKey = now.toISOString().slice(0,7);
  const thisMonth = exps.filter(e=>e.date.slice(0,7)===monthKey).reduce((s,e)=>s+e.total,0);
  const pending = exps.filter(e=>e.status==='Pending Approval').length;
  const approved = exps.filter(e=>e.status==='Approved').length;
  const paid = exps.filter(e=>e.status==='Paid').reduce((s,e)=>s+e.total,0);
  const outstanding = exps.filter(e=>e.paymentStatus==='Unpaid').reduce((s,e)=>s+e.total,0);
  const vat = exps.reduce((s,e)=>s+e.taxAmount,0);
  const operating = exps.reduce((s,e)=>s+e.amount,0);

  document.getElementById('statTotal').textContent = fmt(total);
  document.getElementById('statMonth').textContent = fmt(thisMonth);
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statPaid').textContent = fmt(paid);
  document.getElementById('statOutstanding').textContent = fmt(outstanding);
  document.getElementById('statVat').textContent = fmt(vat);
  document.getElementById('statOperating').textContent = fmt(operating);
  document.getElementById('statApproved').textContent = approved;

  // category bars
  const catHost = document.getElementById('catBars');
  if(exps.length===0){
    catHost.innerHTML = `<div class="empty-state" style="padding:22px;"><div class="hint">No expenses recorded yet — categories will appear here once you add one.</div></div>`;
  } else {
    const byCat = {};
    exps.forEach(e=>{ byCat[e.category] = (byCat[e.category]||0) + e.total; });
    const max = Math.max(...Object.values(byCat));
    catHost.innerHTML = Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>`
      <div class="bar-row">
        <div class="name">${cat}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${(amt/max*100).toFixed(0)}%"></div></div>
        <div class="amt">${fmt(amt)}</div>
      </div>`).join('');
  }

  // recent list
  const recentHost = document.getElementById('recentList');
  if(exps.length===0){
    recentHost.innerHTML = `<div class="empty-state" style="padding:22px;">
        <div class="title">No expenses yet</div>
        <div class="hint">Record your first expense to start seeing activity here.</div>
        <button class="btn btn-primary btn-sm" onclick="openNewExpense()">＋ New Expense</button>
      </div>`;
  } else {
    const recent = [...exps].sort((a,b)=> b.date.localeCompare(a.date) || b.expNo.localeCompare(a.expNo)).slice(0,6);
    recentHost.innerHTML = recent.map(e=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-soft);font-size:13px;">
        <div>
          <div style="font-weight:600;">${escapeHtml(e.description)}</div>
          <div style="font-size:11.5px;color:var(--ink-soft);">${fmtDate(e.date)} · ${e.category}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-variant-numeric:tabular-nums;">${fmt(e.total)}</div>
          <span class="status-pill ${statusClass(e.status)}" style="font-size:10px;">${e.status}</span>
        </div>
      </div>`).join('');
  }
}

/* ================= EXPENSES TABLE ================= */
function populateCategoryFilter(){
  const sel = document.getElementById('expFilterCategory');
  const current = sel.value;
  sel.innerHTML = '<option value="">All categories</option>' + allCategoryNames().map(c=>`<option value="${c}">${c}</option>`).join('');
  sel.value = current;
}

function renderExpenseTable(){
  populateCategoryFilter();
  const textF = document.getElementById('expFilterText').value.trim().toLowerCase();
  const statusF = document.getElementById('expFilterStatus').value;
  const catF = document.getElementById('expFilterCategory').value;

  let list = [...db.expenses];
  if(textF) list = list.filter(e =>
    e.description.toLowerCase().includes(textF) ||
    (e.supplierName||'').toLowerCase().includes(textF) ||
    e.expNo.toLowerCase().includes(textF));
  if(statusF) list = list.filter(e=>e.status===statusF);
  if(catF) list = list.filter(e=>e.category===catF);
  list.sort((a,b)=> b.date.localeCompare(a.date) || b.expNo.localeCompare(a.expNo));

  document.getElementById('expCountLine').textContent = `${db.expenses.length} expense${db.expenses.length===1?'':'s'}`;

  const host = document.getElementById('expenseTableHost');
  if(db.expenses.length===0){
    host.innerHTML = `<div class="empty-state">
      <div class="title">No expenses recorded</div>
      <div class="hint">Everything you record will feed straight into the dashboard, reports, and accounting entries.</div>
      <button class="btn btn-primary btn-sm" onclick="openNewExpense()">＋ Record your first expense</button>
    </div>`;
    return;
  }
  if(list.length===0){
    host.innerHTML = `<div class="empty-state"><div class="hint">No expenses match this filter.</div></div>`;
    return;
  }

  host.innerHTML = `<table>
    <thead><tr>
      <th>Date</th><th>Expense #</th><th>Description</th><th>Supplier</th>
      <th>Category</th><th>Tax</th><th style="text-align:right;">Amount</th><th>Status</th>
    </tr></thead>
    <tbody>
      ${list.map(e=>`
        <tr onclick="openDetail('${e.id}')">
          <td>${fmtDate(e.date)}</td>
          <td>${e.expNo}</td>
          <td class="desc-cell"><div class="title">${escapeHtml(e.description)}</div>${e.reference?`<div class="sub">Ref: ${escapeHtml(e.reference)}</div>`:''}</td>
          <td>${e.supplierName ? escapeHtml(e.supplierName) : '—'}</td>
          <td>${e.category}</td>
          <td>${e.taxRate>0 ? 'VAT '+e.taxRate+'%' : '—'}</td>
          <td class="num">${fmtPlain(e.total)}</td>
          <td><span class="status-pill ${statusClass(e.status)}">${e.status}</span></td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

function escapeHtml(s){
  const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML;
}

/* ================= SUPPLIERS ================= */
function renderSuppliers(){
  const host = document.getElementById('supplierHost');
  if(db.suppliers.length===0){
    host.innerHTML = `<div class="empty-state">
      <div class="title">No suppliers yet</div>
      <div class="hint">Add the vendors you pay so you can attach them to expenses.</div>
      <button class="btn btn-primary btn-sm" onclick="openNewSupplier()">＋ New Supplier</button>
    </div>`;
    return;
  }
  host.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Contact</th><th style="text-align:right;">Expenses recorded</th></tr></thead>
    <tbody>${db.suppliers.map(s=>{
      const count = db.expenses.filter(e=>e.supplierId===s.id).length;
      return `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.contact||'—')}</td><td class="num">${count}</td></tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function openNewSupplier(){
  document.getElementById('s_name').value='';
  document.getElementById('s_contact').value='';
  document.getElementById('s_notes').value='';
  openPanel('supplierPanel');
}
function saveSupplier(){
  const name = document.getElementById('s_name').value.trim();
  if(!name){ showToast('Supplier name is required'); return; }
  db.suppliers.push({id:'sup_'+Date.now(), name, contact:document.getElementById('s_contact').value.trim(), notes:document.getElementById('s_notes').value.trim()});
  saveDB();
  closeAllPanels();
  renderSuppliers();
  populateSupplierSelect();
  showToast('Supplier added');
}

/* ================= CATEGORIES ================= */
function renderCategories(){
  const host = document.getElementById('categoryTree');
  host.innerHTML = Object.entries(db.categories).map(([parent, children])=>{
    return `<div class="tree-parent">${parent}</div>` + children.map(c=>{
      const count = db.expenses.filter(e=>e.category===c).length;
      return `<div class="tree-child"><span>${c}</span><span class="cnt">${count} expense${count===1?'':'s'}</span></div>`;
    }).join('');
  }).join('');
}

/* ================= CONNECT WITH BOOKS ================= */
function getBooksState(){
  if(!CURRENT_USER) return null;
  try{
    const raw = localStorage.getItem('acacia-payroll-state_' + CURRENT_USER.companyId);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}
function refreshBooksConnection(){
  renderConnectStatus();
  showToast('Connection refreshed');
}
function renderConnectStatus(){
  const host = document.getElementById('connectStatusCard');
  const books = getBooksState();
  if(!books){
    host.innerHTML = `<div class="empty-state">
      <div class="title">Not connected yet</div>
      <div class="hint">This account (${CURRENT_USER.company}) hasn't set up Acacia Payroll / Books. Log in to Acacia Payroll with the same email, then come back here.</div>
      <button class="btn btn-primary" onclick="refreshBooksConnection()">Connect</button>
    </div>`;
    return;
  }
  const c = books.company || {};
  const acc = books.payAccounts || {};
  const empCount = (books.employees||[]).length;
  const runCount = (books.payRuns||[]).length;
  host.innerHTML = `
    <div class="panel-box" style="margin-bottom:16px;">
      <h3 style="display:flex;align-items:center;gap:8px;">
        <span class="status-pill status-paid">Connected</span> ${c.name || CURRENT_USER.company}
      </h3>
      <div class="det-grid">
        <div><div class="k">KRA PIN</div><div class="v">${c.kraPin || '—'}</div></div>
        <div><div class="k">Currency</div><div class="v">${c.currency || '—'}</div></div>
        <div><div class="k">Employees</div><div class="v">${empCount}</div></div>
        <div><div class="k">Pay Runs</div><div class="v">${runCount}</div></div>
      </div>
    </div>
    <div class="panel-box">
      <h3>Chart of Accounts (from Books)</h3>
      <table class="acct-table">
        <tr><td>Salary Expense</td><td>${acc.salaryExpense || '—'}</td></tr>
        <tr><td>Statutory Expense</td><td>${acc.statutoryExpense || '—'}</td></tr>
        <tr><td>PAYE Payable</td><td>${acc.payePayable || '—'}</td></tr>
        <tr><td>NSSF Payable</td><td>${acc.nssfPayable || '—'}</td></tr>
        <tr><td>SHIF Payable</td><td>${acc.shifPayable || '—'}</td></tr>
        <tr><td>Net Salaries Payable</td><td>${acc.netPayable || '—'}</td></tr>
        <tr><td>Bank</td><td>${acc.bank || '—'}</td></tr>
      </table>
      <div class="view-sub" style="margin-top:12px;">Read-only, pulled directly from your Acacia Payroll company settings.</div>
    </div>
  `;
}

/* ================= REPORTS ================= */
function renderReports(){
  const exps = db.expenses;
  const wrap = (rows, emptyMsg) => rows.length ? rows.join('') : `<div class="hint" style="color:var(--ink-soft);font-size:13px;">${emptyMsg}</div>`;

  // by category
  const byCat = {};
  exps.forEach(e=> byCat[e.category] = (byCat[e.category]||0)+e.total);
  document.getElementById('repByCategory').innerHTML = wrap(
    Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="report-row"><span>${k}</span><span class="amt">${fmt(v)}</span></div>`),
    'No data yet.'
  );

  // by supplier
  const bySup = {};
  exps.forEach(e=>{ const k = e.supplierName || 'No supplier'; bySup[k] = (bySup[k]||0)+e.total; });
  document.getElementById('repBySupplier').innerHTML = wrap(
    Object.entries(bySup).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="report-row"><span>${k}</span><span class="amt">${fmt(v)}</span></div>`),
    'No data yet.'
  );

  // paid vs unpaid
  const paid = exps.filter(e=>e.paymentStatus==='Paid').reduce((s,e)=>s+e.total,0);
  const unpaid = exps.filter(e=>e.paymentStatus==='Unpaid').reduce((s,e)=>s+e.total,0);
  document.getElementById('repPaidUnpaid').innerHTML = exps.length ? `
    <div class="report-row"><span>Paid</span><span class="amt">${fmt(paid)}</span></div>
    <div class="report-row"><span>Unpaid</span><span class="amt">${fmt(unpaid)}</span></div>
  ` : `<div class="hint" style="color:var(--ink-soft);font-size:13px;">No data yet.</div>`;

  // vat
  const vatByRate = {};
  exps.forEach(e=>{ if(e.taxAmount>0){ const k='VAT '+e.taxRate+'%'; vatByRate[k]=(vatByRate[k]||0)+e.taxAmount; } });
  document.getElementById('repVat').innerHTML = wrap(
    Object.entries(vatByRate).map(([k,v])=>`<div class="report-row"><span>${k}</span><span class="amt">${fmt(v)}</span></div>`),
    'No taxable expenses recorded yet.'
  );
}

/* ================= FORM (NEW / EDIT) ================= */
function populateAccountSelect(){
  const sel = document.getElementById('f_account');
  sel.innerHTML = '<option value="">Select account...</option>' + allCategoryNames().map(c=>`<option value="${c}">${c}</option>`).join('');
}
function populateSupplierSelect(){
  const sel = document.getElementById('f_supplier');
  sel.innerHTML = '<option value="">Select supplier...</option>' + db.suppliers.map(s=>`<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

function openNewExpense(){
  editingId = null;
  document.getElementById('formTitle').textContent = 'New Expense';
  populateAccountSelect();
  populateSupplierSelect();
  document.getElementById('expenseForm').reset();
  document.getElementById('f_date').value = todayISO();
  document.getElementById('f_expno').value = 'EXP-' + String(db.nextExpNo).padStart(5,'0') + ' (auto)';
  document.getElementById('f_tax').value = '16';
  document.getElementById('uploadBox').textContent = 'Click to attach a receipt (filename only, stored locally)';
  document.getElementById('uploadBox').classList.remove('has-file');
  document.getElementById('uploadBox').dataset.filename = '';
  recalcTotals();
  openPanel('formPanel');
}

function openEditExpense(id){
  const e = db.expenses.find(x=>x.id===id);
  if(!e) return;
  editingId = id;
  document.getElementById('formTitle').textContent = 'Edit Expense';
  populateAccountSelect();
  populateSupplierSelect();
  document.getElementById('f_date').value = e.date;
  document.getElementById('f_expno').value = e.expNo;
  document.getElementById('f_supplier').value = e.supplierId || '';
  document.getElementById('f_account').value = e.category;
  document.getElementById('f_desc').value = e.description;
  document.getElementById('f_ref').value = e.reference || '';
  document.getElementById('f_currency').value = e.currency || 'KES';
  document.getElementById('f_amount').value = e.amount;
  document.getElementById('f_tax').value = String(e.taxRate);
  document.getElementById('f_payaccount').value = e.paymentAccount;
  document.getElementById('f_paystatus').value = e.paymentStatus;
  document.getElementById('f_notes').value = e.notes || '';
  const ub = document.getElementById('uploadBox');
  if(e.attachmentName){ ub.textContent = '📎 ' + e.attachmentName; ub.classList.add('has-file'); ub.dataset.filename = e.attachmentName; }
  else { ub.textContent = 'Click to attach a receipt (filename only, stored locally)'; ub.classList.remove('has-file'); ub.dataset.filename=''; }
  recalcTotals();
  openPanel('formPanel');
}

function onAttachChange(){
  const f = document.getElementById('f_attachment').files[0];
  const ub = document.getElementById('uploadBox');
  if(f){ ub.textContent = '📎 ' + f.name; ub.classList.add('has-file'); ub.dataset.filename = f.name; }
}

['f_amount','f_tax'].forEach(id=>{
  document.getElementById(id).addEventListener('input', recalcTotals);
});
function recalcTotals(){
  const amount = parseFloat(document.getElementById('f_amount').value) || 0;
  const rate = parseFloat(document.getElementById('f_tax').value) || 0;
  const taxAmt = amount * rate / 100;
  document.getElementById('f_taxamt').value = fmtPlain(taxAmt);
  document.getElementById('f_total').value = fmtPlain(amount + taxAmt);
}

function saveExpense(statusIfNew){
  const date = document.getElementById('f_date').value;
  const account = document.getElementById('f_account').value;
  const desc = document.getElementById('f_desc').value.trim();
  const amount = parseFloat(document.getElementById('f_amount').value);

  if(!date || !account || !desc || isNaN(amount)){
    showToast('Please fill in date, account, description and amount');
    return;
  }

  const rate = parseFloat(document.getElementById('f_tax').value) || 0;
  const taxAmount = Math.round((amount * rate / 100) * 100) / 100;
  const total = Math.round((amount + taxAmount) * 100) / 100;
  const supplierId = document.getElementById('f_supplier').value;
  const supplier = db.suppliers.find(s=>s.id===supplierId);

  if(editingId){
    const e = db.expenses.find(x=>x.id===editingId);
    Object.assign(e, {
      date, category:account, description:desc,
      reference: document.getElementById('f_ref').value.trim(),
      currency: document.getElementById('f_currency').value,
      amount, taxRate:rate, taxAmount, total,
      supplierId: supplierId||null, supplierName: supplier?supplier.name:'',
      paymentAccount: document.getElementById('f_payaccount').value,
      paymentStatus: document.getElementById('f_paystatus').value,
      notes: document.getElementById('f_notes').value.trim(),
      attachmentName: document.getElementById('uploadBox').dataset.filename || ''
    });
    if(e.paymentStatus==='Paid') e.status='Paid';
    showToast('Expense updated');
  } else {
    const expNo = 'EXP-' + String(db.nextExpNo).padStart(5,'0');
    db.nextExpNo++;
    const paymentStatus = document.getElementById('f_paystatus').value;
    db.expenses.push({
      id: 'exp_'+Date.now(),
      expNo, date, category:account, description:desc,
      reference: document.getElementById('f_ref').value.trim(),
      currency: document.getElementById('f_currency').value,
      amount, taxRate:rate, taxAmount, total,
      supplierId: supplierId||null, supplierName: supplier?supplier.name:'',
      paymentAccount: document.getElementById('f_payaccount').value,
      paymentStatus,
      status: paymentStatus==='Paid' ? 'Paid' : statusIfNew,
      notes: document.getElementById('f_notes').value.trim(),
      attachmentName: document.getElementById('uploadBox').dataset.filename || ''
    });
    showToast(statusIfNew==='Draft' ? 'Draft saved' : 'Expense submitted');
  }

  saveDB();
  closeAllPanels();
  renderExpenseTable();
  renderDashboard();
  renderCategories();
}

/* ================= DETAIL PANEL ================= */
const STATUS_FLOW = ['Draft','Submitted','Pending Approval','Approved','Posted','Paid'];

function openDetail(id){
  currentDetailId = id;
  const e = db.expenses.find(x=>x.id===id);
  if(!e) return;

  document.getElementById('detStatusPill').className = 'status-pill ' + statusClass(e.status);
  document.getElementById('detStatusPill').textContent = e.status;
  document.getElementById('detExpNo').textContent = e.expNo;
  document.getElementById('detExpDesc').textContent = e.supplierName || 'No supplier';
  document.getElementById('detAmount').textContent = fmt(e.total);

  document.getElementById('detGrid').innerHTML = `
    <div><div class="k">Date</div><div class="v">${fmtDate(e.date)}</div></div>
    <div><div class="k">Account</div><div class="v">${e.category}</div></div>
    <div><div class="k">Supplier</div><div class="v">${e.supplierName||'—'}</div></div>
    <div><div class="k">Payment Account</div><div class="v">${e.paymentAccount}</div></div>
    <div><div class="k">Tax</div><div class="v">${e.taxRate>0?'VAT '+e.taxRate+'%':'No tax'}</div></div>
    <div><div class="k">Tax Amount</div><div class="v">${fmt(e.taxAmount)}</div></div>
    <div><div class="k">Payment Status</div><div class="v">${e.paymentStatus}</div></div>
    <div><div class="k">Reference</div><div class="v">${e.reference||'—'}</div></div>
  `;

  const net = e.amount;
  document.getElementById('acctTable').innerHTML = `
    <tr><td>Debit</td><td>${e.category}</td><td class="num">${fmtPlain(net)}</td></tr>
    ${e.taxAmount>0?`<tr><td>Debit</td><td>VAT Input</td><td class="num">${fmtPlain(e.taxAmount)}</td></tr>`:''}
    <tr><td>Credit</td><td>${e.paymentStatus==='Paid'?e.paymentAccount:'Accounts Payable'}</td><td class="num">${fmtPlain(e.total)}</td></tr>
  `;

  document.getElementById('detAttachment').textContent = e.attachmentName ? '📎 '+e.attachmentName : 'No attachment';
  document.getElementById('detNotes').textContent = e.notes || 'No notes added.';

  const nextIdx = STATUS_FLOW.indexOf(e.status);
  const advBtn = document.getElementById('advanceBtn');
  if(e.status==='Rejected' || nextIdx===-1 || nextIdx===STATUS_FLOW.length-1){
    advBtn.style.display='none';
  } else {
    advBtn.style.display='inline-flex';
    advBtn.textContent = 'Mark as ' + STATUS_FLOW[nextIdx+1];
  }

  openPanel('detailPanel');
}

function advanceStatus(){
  const e = db.expenses.find(x=>x.id===currentDetailId);
  if(!e) return;
  const idx = STATUS_FLOW.indexOf(e.status);
  if(idx>-1 && idx<STATUS_FLOW.length-1){
    e.status = STATUS_FLOW[idx+1];
    if(e.status==='Paid') e.paymentStatus='Paid';
    saveDB();
    openDetail(e.id);
    renderExpenseTable();
    renderDashboard();
    showToast('Status updated to ' + e.status);
  }
}

function editCurrentExpense(){ closeAllPanels(); openEditExpense(currentDetailId); }

function duplicateCurrentExpense(){
  const e = db.expenses.find(x=>x.id===currentDetailId);
  if(!e) return;
  const expNo = 'EXP-' + String(db.nextExpNo).padStart(5,'0');
  db.nextExpNo++;
  const copy = {...e, id:'exp_'+Date.now(), expNo, status:'Draft', paymentStatus:'Unpaid', date: todayISO()};
  db.expenses.push(copy);
  saveDB();
  closeAllPanels();
  renderExpenseTable();
  renderDashboard();
  showToast('Expense duplicated as ' + expNo);
}

function deleteCurrentExpense(){
  if(!confirm('Delete this expense? This cannot be undone.')) return;
  db.expenses = db.expenses.filter(x=>x.id!==currentDetailId);
  saveDB();
  closeAllPanels();
  renderExpenseTable();
  renderDashboard();
  renderCategories();
  showToast('Expense deleted');
}

/* ================= PANELS ================= */
function openPanel(id){
  document.getElementById('overlay').classList.add('show');
  document.getElementById(id).classList.add('show');
}
function closeAllPanels(){
  document.getElementById('overlay').classList.remove('show');
  ['detailPanel','formPanel','supplierPanel'].forEach(id=>document.getElementById(id).classList.remove('show'));
}

/* ================= EXPORT ================= */
function exportCSV(){
  if(db.expenses.length===0){ showToast('Nothing to export yet'); return; }
  const headers = ['Date','Expense #','Description','Supplier','Category','Tax Rate','Amount','Tax Amount','Total','Status','Payment Status'];
  const rows = db.expenses.map(e=>[e.date,e.expNo,e.description,e.supplierName,e.category,e.taxRate+'%',e.amount,e.taxAmount,e.total,e.status,e.paymentStatus]);
  const csv = [headers, ...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'acacia-expenses.csv'; a.click();
  URL.revokeObjectURL(url);
}

/* ================= INIT ================= */
boot();
