const CACHE = 'quizhub-v10';
const CORE = ['hub.html', 'manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE))
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
  if(e.request.method !== 'GET') return;
  if(e.request.url.includes('supabase.co')) return;

  e.respondWith(
    fetch(e.request)
      .then(r => {
        if(r.ok && e.request.url.match(/\.(html|js|css|png|ico)(\?|$)/)) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});

// Мгновенное применение обновлений — уведомляем все вкладки
self.addEventListener('message', e => {
  if(e.data === 'skipWaiting') self.skipWaiting();
});
