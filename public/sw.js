const CACHE_NAME = 'demandas-v1';
const urlsToCache = [
  '/',
  'images/icon-192x192.png',
  'images/icon-512x512.png'
];

self.addEventListener('install', event => {
  console.log('✅ Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cache aberto, adicionando URLs...');
        
        // Adiciona URLs ao cache, ignorando erros
        return Promise.all(
          urlsToCache.map(url => {
            return cache.add(url).catch(error => {
              console.log(`⚠️  Não pôde cachear ${url}:`, error.message);
              // Ignora erro e continua
            });
          })
        );
      })
      .then(() => {
        console.log('✅ Cache pré-carregado completo!');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('🔄 Service Worker: Ativado');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️  Removendo cache antigo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('✅ Service Worker pronto para controle!');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  // Ignora requisições não-GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna do cache se existir
        if (response) {
          return response;
        }
        
        // Senão, busca na rede
        return fetch(event.request);
      })
  );
});