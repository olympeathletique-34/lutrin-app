/* Lutrin — works offline once opened. The page itself is refreshed from the network when online. */
const CACHE = 'lutrin-v1';
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const SHELL = ['./', './manifest.webmanifest', './icons/icon.svg', './icons/maskable.svg'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(SHELL);
    for (const f of ['pdf.min.js', 'pdf.worker.min.js']) {
      const r = await fetch(CDN + f, { mode: 'cors' });
      if (r.ok) { await c.put(CDN + f, r.clone()); await c.put(new URL('vendor/pdfjs/' + f, self.registration.scope).href, r); }
    }
  }).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.github.com') return;               // sync always goes to the network
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put('./', c)); return r; })
      .catch(() => caches.match('./')));
    return;
  }
  if (url.origin === location.origin && url.pathname.includes('/vendor/pdfjs/')) {
    const f = url.pathname.split('/').pop();
    e.respondWith(caches.match(req).then(hit => hit || fetch(CDN + f, { mode: 'cors' }).then(r => {
      const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); return r;
    })));
    return;
  }
  const ok = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$|cdnjs\.cloudflare\.com$/.test(url.hostname);
  if (!ok) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); }
    return r;
  })));
});
