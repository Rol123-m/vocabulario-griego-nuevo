// Service Worker para Griego Koiné - Vivos para Servir
const CACHE_NAME = 'griego-koine-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@fontsource/source-sans-3@5.0.5/index.css',
  'https://cdn.jsdelivr.net/npm/@fontsource/source-serif-4@5.0.5/index.css'
];

// Instalar Service Worker y cachear archivos
self.addEventListener('install', event => {
  console.log('[Service Worker] Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Cacheando archivos');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('[Service Worker] Error al cachear:', err))
  );
  self.skipWaiting();
});

// Activar y limpiar caches viejos
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando cache antiguo:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia: Cache First, luego red
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // No cachear llamadas a APIs externas
  if (url.hostname.includes('postimg.cc') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('github.io')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - devolver respuesta cacheada
        if (response) {
          console.log('[Service Worker] Sirviendo desde cache:', event.request.url);
          return response;
        }
        
        // Clonar request porque se consume una vez
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(response => {
          // Verificar respuesta válida
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clonar respuesta para cachearla
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
            console.log('[Service Worker] Cacheando nuevo recurso:', event.request.url);
          });
          
          return response;
        }).catch(error => {
          console.error('[Service Worker] Error fetching:', error);
          
          // Si falla la red, devolver página offline para navegación
          if (event.request.mode === 'navigate') {
            return caches.match('./offline.html');
          }
          
          return new Response('Error de conexión', {
            status: 408,
            statusText: 'Offline'
          });
        });
      })
  );
});

// Sincronización en segundo plano (para cuando vuelva internet)
self.addEventListener('sync', event => {
  console.log('[Service Worker] Sync event:', event.tag);
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

function syncData() {
  return new Promise((resolve, reject) => {
    // Aquí podrías sincronizar datos pendientes
    console.log('[Service Worker] Sincronizando datos...');
    resolve();
  });
}

// Notificaciones push
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Griego Koiné';
  const options = {
    body: data.body || '¡Continúa tu estudio del griego bíblico!',
    icon: './icons/icon-192.png',
    badge: './icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || './'
    }
  };
  
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || './')
  );
});