const CACHE_NAME = 'sard-pwa-v1';
const APP_SHELL = [
  './',
  './superadmin.html',
  './index.html',
  './css/sard.css',
  './js/config.js',
  './js/api.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// لا نعمل Fetch caching عام حتى لا نتداخل مع بيانات Supabase أو صفحات النظام.
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'برنامج السرد';
  const options = {
    body: data.body || 'لديك تنبيه جديد',
    icon: './icons/icon-192.png',
    badge: './icons/badge-96.png',
    dir: 'rtl',
    lang: 'ar-SA',
    tag: data.tag || 'sard-admin',
    renotify: true,
    data: {
      url: data.url || './superadmin.html',
      createdAt: Date.now()
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || './superadmin.html';

  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(targetUrl);
        return;
      }
    }
    if (clients.openWindow) return clients.openWindow(targetUrl);
  })());
});
