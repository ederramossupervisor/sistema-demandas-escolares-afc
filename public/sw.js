// public/sw.js
const CACHE_NAME = 'demandas-v2';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png',
  '/images/favicon.ico',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];
// ============================================
// CONFIGURAÇÃO DE ÍCONES (USANDO SEUS ÍCONES)
// ============================================
const APP_ICONS = {
    notification: '/images/icon-192x192.png',
    badge: '/images/icon-192x192.png',
    large: '/images/icon-512x512.png',
    favicon: '/images/favicon.ico'
};
self.addEventListener('install', event => {
  console.log('✅ Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cache aberto, adicionando URLs...');
        
        // Tenta adicionar cada URL, mas continua mesmo se alguma falhar
        const cachePromises = urlsToCache.map(url => {
          return cache.add(url).catch(error => {
            console.log(`⚠️  Não pôde cachear ${url}:`, error.message);
            return Promise.resolve(); // Continua mesmo com erro
          });
        });
        
        return Promise.all(cachePromises);
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
  // Ignora requisições não-GET e do Chrome DevTools
  if (event.request.method !== 'GET' || 
      event.request.url.includes('chrome-extension://') ||
      event.request.url.includes('sockjs-node')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna do cache se existir
        if (response) {
          console.log(`📂 Servindo do cache: ${event.request.url}`);
          return response;
        }
        
        // Senão, busca na rede
        console.log(`🌐 Buscando na rede: ${event.request.url}`);
        return fetch(event.request)
          .then(networkResponse => {
            // Se for uma resposta válida, cacheia para uso futuro
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                  console.log(`💾 Cache atualizado: ${event.request.url}`);
                });
            }
            return networkResponse;
          })
          .catch(error => {
            console.log('🌐 Rede falhou:', error);
            // Pode retornar uma página offline personalizada aqui
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
            return new Response('Conteúdo offline não disponível', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});
// ============================================
// NOTIFICAÇÕES PUSH
// ============================================
self.addEventListener('push', event => {
  console.log('🔔 Evento push recebido via Service Worker');
  
  if (!event.data) {
    console.log('⚠️  Push sem dados');
    return;
  }
  
  let data = {};
  try {
    data = event.data.json();
    console.log('📨 Dados da notificação:', data);
  } catch (error) {
    console.log('📨 Dados de notificação (texto):', event.data.text());
    data = {
      titulo: 'Sistema Escolar',
      mensagem: event.data.text() || 'Nova notificação'
    };
  }
  
  const options = {
    body: data.mensagem || 'Você tem uma nova notificação',
    icon: APP_ICONS.notification,
    badge: APP_ICONS.badge,
    tag: data.id || 'demanda-notification',
    data: data,
    vibrate: [200, 100, 200],
    renotify: true,
    requireInteraction: false,
    actions: []
  };
  
  // Adicionar ação baseada no tipo
  if (data.tipo === 'demanda') {
    options.actions.push({
      action: 'open-demanda',
      title: '📋 Abrir Demanda'
    });
  }
  
  options.actions.push({
    action: 'close',
    title: '❌ Fechar'
  });
  
  event.waitUntil(
    self.registration.showNotification(
      data.titulo || 'Sistema de Demandas Escolares',
      options
    )
  );
});

// ============================================
// CLICK EM NOTIFICAÇÕES
// ============================================
self.addEventListener('notificationclick', event => {
  console.log('👆 Notificação clicada:', event.notification);
  
  event.notification.close();
  
  const data = event.notification.data || {};
  const action = event.action;
  
  // Determinar URL baseada na ação ou dados
  let url = '/';
  
  if (action === 'open-demanda' || data.tipo === 'demanda') {
    url = '/demandas';
  } else if (data.url) {
    url = data.url;
  }
  
  // Abrir/focar na janela
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // Verificar se já existe uma janela aberta
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Se não existir, abrir nova janela
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ============================================
// SINCRONIZAÇÃO EM BACKGROUND
// ============================================
self.addEventListener('sync', event => {
  console.log('🔄 Sync event:', event.tag);
  
  if (event.tag === 'sync-notifications') {
    event.waitUntil(
      syncNotifications()
    );
  }
});

async function syncNotifications() {
  console.log('📡 Sincronizando notificações em background...');
  
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch('/api/notificacoes/ultimas');
    
    if (response.ok) {
      const notifications = await response.json();
      console.log(`📊 ${notifications.length} notificações sincronizadas`);
      
      // Armazenar no cache para uso offline
      const cacheData = {
        notifications: notifications,
        lastSync: new Date().toISOString()
      };
      
      await cache.put(
        new Request('/api/notificacoes/cache'),
        new Response(JSON.stringify(cacheData))
      );
    }
  } catch (error) {
    console.log('⚠️  Erro na sincronização:', error);
  }
}

console.log('✅ Service Worker com suporte a push notifications carregado!');