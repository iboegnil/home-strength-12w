/* 离线缓存：第一次联网打开时把全部文件存进缓存，之后断网也能打开。
   改了任何文件都要把 VERSION 加一，手机下次联网打开时会自动换成新版本（记录存在 localStorage，不受影响）。 */
var VERSION = 'v1';
var PREFIX = 'home-strength-12w-';
var CACHE = PREFIX + VERSION;
var FILES = ['./', 'index.html', 'figure.js', 'moves1.js', 'moves2.js', 'moves3.js', 'plan.js', 'app.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

// Safari 不接受带重定向标记的缓存页面，存之前去掉
function clean(res) {
  if (!res.redirected) return Promise.resolve(res);
  return res.blob().then(function (b) { return new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers }); });
}

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) {
      return fetch(new Request(f, { cache: 'reload' })).then(function (res) {
        if (!res.ok) throw new Error(f + ' ' + res.status);
        return clean(res).then(function (r) { return c.put(f, r); });
      });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf(PREFIX) === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// 先用缓存，缓存里没有再走网络；断网时打开任何页面都给 index.html
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).catch(function () {
        return req.mode === 'navigate' ? c.match('index.html') : Response.error();
      });
    });
  }));
});
