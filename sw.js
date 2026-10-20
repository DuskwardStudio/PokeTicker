// PokéTicker service worker: keeps the app opening when you're offline.
// Network first (so you always get the newest version), falling back to the saved copy.
// Price files come from another address and are never cached here; your data lives in the app's own database.
const CACHE = 'poketicker-shell-v2';
const SHELL = ['./', './index.html', './style.css', './core.js', './analysis.js', './security.js', './views-main.js', './views-more.js', './boot.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  const key = url.search ? new Request(url.origin + url.pathname) : e.request;     // a shared link (?text=...) still opens the saved page offline
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
      return res;
    }).catch(() => caches.match(key).then(r => r || caches.match('./index.html')))
  );
});
