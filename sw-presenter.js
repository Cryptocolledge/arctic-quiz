const CACHE = 'quizhub-presenter-v27';
// Только критичные файлы — чтобы install не падал на медленном WiFi
const CRITICAL = [
  'presenter.html',
  'manifest-presenter.json',
  'icon-presenter-192.png'
];
// Медиа кэшируются лениво (при первом запросе)
const LAZY = [
  'icon-presenter-512.png',
  'respuesta-correcta.mp3',
  'wrong-1.mp3',
  'Endgame music.mp3',
  'Blic new.mp3',
  'Stavki new.mp3',
  'Млечный%20путь.gif',
  'gagarin.jpg',
  'RIAN_archive_612748_Valentina_Tereshkova.jpg',
  'SPUTNIK_original.jpg',
  'pesec.jpg',
  'narval.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CRITICAL))
      .then(() => self.skipWaiting())
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
  // Supabase всегда из сети
  if(e.request.url.includes('supabase.co')) return;
  // CDN — network-first, fallback cache
  if(e.request.url.includes('cdn.jsdelivr.net') || e.request.url.includes('unpkg.com')){
    e.respondWith(
      fetch(e.request)
        .then(r => { if(r.ok){ const cl=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,cl)); } return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  // HTML + SW — network-first (всегда свежий)
  if(e.request.url.match(/\.html(\?|$)/) || e.request.url.endsWith('/')){
    e.respondWith(
      fetch(e.request, {cache:'no-cache'})
        .then(r => { if(r.ok){ const cl=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,cl)); } return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  // Остальное — cache-first, затем сеть
  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;
      return fetch(e.request).then(r => {
        if(r.ok && r.status===200 && e.request.url.match(/\.(html|js|css|png|ico|mp3|jpg|jpeg|gif|webp)(\?|$)/)){
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return r;
      });
    })
  );
});

self.addEventListener('message', e => {
  if(e.data === 'skipWaiting') self.skipWaiting();
  // Принудительный сброс кэша из страницы
  if(e.data === 'forceRefresh'){
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.matchAll())
      .then(clients => clients.forEach(c => c.postMessage({type:'reloadNow'})));
  }
});
