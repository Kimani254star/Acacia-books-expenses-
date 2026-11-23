/* Acacia Expenses - works offline: the app files and the libraries it loads from CDNs are saved on first visit.
   Supabase (your data) is never cached here. Pages are fetched fresh when online and served from the saved copy when offline. */
var V = 'acx-expenses-v2';
var LOCAL = ["./", "acacia-theme.js", "style.css", "acacia-appearance.js", "acacia-actions.js", "script.js", "acacia-bills.js", "acacia-grn.js", "acacia-bridge.js", "acacia-help.js", "acacia-sidebar.js", "acacia-brand.js", "acacia-signout.js", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "favicon-32.png"];
var CDN = ["https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css"];
var CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'cdn.tailwindcss.com', 'cdn.quilljs.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com'];
function save(c, u) { return fetch(u).then(function (r) { if (r && (r.ok || r.type === 'opaque')) return c.put(u, r); }).catch(function () {}); }
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(V).then(function (c) { return Promise.all(LOCAL.concat(CDN).map(function (u) { return save(c, u); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (x) { return x.indexOf('acx-expenses-') === 0 && x !== V; }).map(function (x) { return caches.delete(x); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request; if (r.method !== 'GET') return;
  var u = new URL(r.url);
  if (u.origin === self.location.origin) {
    e.respondWith(fetch(r).then(function (res) {
      if (res && res.ok && res.type === 'basic') { var cp = res.clone(); caches.open(V).then(function (c) { c.put(r, cp); }); }
      return res;
    }).catch(function () { return caches.match(r).then(function (m) { return m || caches.match('index.html'); }); }));
    return;
  }
  if (CDN_HOSTS.indexOf(u.hostname) >= 0) {   /* libraries and fonts: saved copy first, refreshed in the background */
    e.respondWith(caches.match(r).then(function (m) {
      var net = fetch(r).then(function (res) { if (res && (res.ok || res.type === 'opaque')) { var cp = res.clone(); caches.open(V).then(function (c) { c.put(r, cp); }); } return res; });
      return m || net;
    }));
  }
});
