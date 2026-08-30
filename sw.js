// Minimal fallback service worker (keeps site installable as a PWA).
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ self.clients.claim(); });
self.addEventListener('fetch', function(event){}); 
