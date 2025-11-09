// --- PWA用 Service Worker ---
self.addEventListener('install', (event) => {
  console.log('🛠️ Installing PWA Service Worker...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('✅ Service Worker activated');
});