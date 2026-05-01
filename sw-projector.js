const CACHE = 'quizhub-proj-v11';
const CORE = [
  'projector.html',
  'Млечный%20путь.gif',
  'gagarin.jpg',
  'RIAN_archive_612748_Valentina_Tereshkova.jpg',
  'SPUTNIK_original.jpg',
  'pesec.jpg',
  'narval.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Supabase — всегда из сети
  if (e.request.url.includes('supabase.co')) return;
  // CDN — network-first, fallback cache
  if (e.request.url.includes('cdn.jsdelivr.net') || e.request.url.includes('unpkg.com')) {
    e.respondWith(
      fetch(e.request)
        .then(r => { if (r.ok) { const cl = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cl)); } return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  // HTML — network-first (всегда свежий)
  if (e.request.url.match(/\.html(\?|$)/) || e.request.url.endsWith('/')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then(r => {
          if (r.ok) { const cl = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cl)); }
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  // Остальное — cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(r => {
        if (r.ok && r.status===200 && e.request.url.match(/\.(js|css|png|ico|mp3|svg|jpg|jpeg|gif|webp)(\?|$)/)) {
          const cl = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, cl));
        }
        return r;
      });
    })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
