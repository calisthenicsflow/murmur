// Murmur service worker — versioned app-shell cache + runtime font cache.
// Pages are always fetched fresh (bypassing the 10-min HTTP cache) so a new index.html → new ?v= assets right away.
const VERSION = '1.3.6';
const SHELL = `murmur-shell-${VERSION}`, FONTS = 'murmur-fonts-v1';
const ASSETS = ['./', 'index.html', 'css/app.css?v=1.3.6', 'js/app.js?v=1.3.6', 'js/db.js?v=1.3.6', 'js/i18n.js?v=1.3.6', 'js/text.js?v=1.3.6', 'js/covers.js?v=1.3.6', 'js/engines.js?v=1.3.6', 'js/player.js?v=1.3.6', 'js/translate.js?v=1.3.6', 'js/stats.js?v=1.3.6', 'js/quotes.js?v=1.3.6', 'js/importers.js?v=1.3.6', 'js/samples.js?v=1.3.6', 'js/voices.js?v=1.3.6', 'js/formats.js?v=1.3.6', 'js/ocr.js?v=1.3.6',
  'vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'vendor/jszip.min.js', 'manifest.webmanifest?v=1.3.6', 'icons/icon-96.png?v=1.3.6', 'icons/icon-128.png?v=1.3.6', 'icons/icon-192.png?v=1.3.6', 'icons/icon-256.png?v=1.3.6', 'icons/icon-384.png?v=1.3.6', 'icons/icon-512.png?v=1.3.6', 'icons/apple-touch-icon.png?v=1.3.6', 'icons/favicon-32.png?v=1.3.6', 'favicon.ico?v=1.3.6', 'audio/index.json', 'config.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('murmur-shell-') && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async c => { const hit = await c.match(e.request); if (hit) return hit; const r = await fetch(e.request); if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; }));
    return;
  }
  if (u.origin !== location.origin) return;
  if (/\/(version|config)\.json$/.test(u.pathname)) { e.respondWith(fetch(e.request).catch(() => caches.match(e.request))); return; }
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request.url, { cache: 'no-store', credentials: 'same-origin' }).then(r => { caches.open(SHELL).then(c => c.put('index.html', r.clone())); return r; }).catch(() => caches.match('index.html'))); return; }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { if (r.ok) { const cl = r.clone(); caches.open(SHELL).then(c => c.put(e.request, cl)); } return r; })));
});
